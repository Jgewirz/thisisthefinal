import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { extractTravelParams } from '../services/openai.js';
import {
  searchFlights,
  searchHotels,
  searchCheapestDates,
  autocompleteLocation,
  isAmadeusConfigured,
} from '../services/amadeus.js';
import {
  searchPlaces,
  fetchPlacePhoto,
  isGooglePlacesConfigured,
} from '../services/google-places.js';
import { enrichHotelsWithPlaces } from '../services/hotel-enricher.js';
import { createCalendarEvent } from '../services/google-calendar.js';
import { getDb } from '../db/sqlite.js';

const BOOKING_AGENT_URL = process.env.BOOKING_AGENT_URL || 'http://localhost:8000';

const router = Router();

// ── Ensure user row exists ─────────────────────────────────────────────
function ensureUser(userId: string) {
  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)').run(userId);
}

// ── POST /api/travel/extract — GPT extracts structured params ──────────
router.post('/extract', async (req: Request, res: Response) => {
  const { message, context, userLocation, lastSearchIntent } = req.body as {
    message: string;
    context?: Array<{ role: string; content: string }>;
    userLocation?: object;
    lastSearchIntent?: { type: string; params: Record<string, any> };
  };

  if (!message) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  try {
    const intent = await extractTravelParams(message, context, userLocation as any, lastSearchIntent);
    console.log('[Travel Extract]', message, '→', JSON.stringify(intent));
    res.json({ intent });
  } catch (err: any) {
    console.error('Travel extraction error:', err.message);
    res.status(500).json({ error: 'Failed to extract travel parameters' });
  }
});

// ── POST /api/travel/flights — Amadeus flight search ───────────────────
router.post('/flights', async (req: Request, res: Response) => {
  if (!isAmadeusConfigured()) {
    res.status(503).json({ error: 'Amadeus API not configured' });
    return;
  }

  const { origin, destination, departureDate, returnDate, adults, cabinClass, currency, nonStop, maxPrice, includedAirlineCodes, excludedAirlineCodes } = req.body;

  if (!origin || !destination || !departureDate) {
    res.status(400).json({ error: 'origin, destination, and departureDate are required' });
    return;
  }

  try {
    const userId = (req as any).userId as string;
    ensureUser(userId);

    const results = await searchFlights({
      origin,
      destination,
      departureDate,
      returnDate,
      adults,
      cabinClass,
      currency,
      nonStop,
      maxPrice,
      includedAirlineCodes,
      excludedAirlineCodes,
    });

    // Log the search
    const db = getDb();
    db.prepare(
      'INSERT INTO travel_searches (id, user_id, intent_type, params, result_count) VALUES (?, ?, ?, ?, ?)'
    ).run(
      crypto.randomUUID(),
      userId,
      'flight_search',
      JSON.stringify({ origin, destination, departureDate, returnDate, adults, cabinClass }),
      results.length
    );

    res.json({ results });
  } catch (err: any) {
    console.error('Flight search error:', err.message);
    res.status(500).json({ error: 'Flight search failed' });
  }
});

// ── POST /api/travel/cheapest-dates — Amadeus cheapest dates search ────
router.post('/cheapest-dates', async (req: Request, res: Response) => {
  if (!isAmadeusConfigured()) {
    res.status(503).json({ error: 'Amadeus API not configured' });
    return;
  }

  const { origin, destination, departureDate } = req.body;

  if (!origin || !destination) {
    res.status(400).json({ error: 'origin and destination are required' });
    return;
  }

  try {
    const userId = (req as any).userId as string;
    ensureUser(userId);

    const results = await searchCheapestDates({ origin, destination, departureDate });

    const db = getDb();
    db.prepare(
      'INSERT INTO travel_searches (id, user_id, intent_type, params, result_count) VALUES (?, ?, ?, ?, ?)'
    ).run(
      crypto.randomUUID(),
      userId,
      'cheapest_dates',
      JSON.stringify({ origin, destination, departureDate }),
      results.length
    );

    res.json({ results, origin, destination });
  } catch (err: any) {
    console.error('Cheapest dates search error:', err.message);
    res.status(500).json({ error: 'Cheapest dates search failed' });
  }
});

// ── POST /api/travel/hotels — Amadeus + Google Places hybrid hotel search ──
router.post('/hotels', async (req: Request, res: Response) => {
  const { cityCode, checkIn, checkOut, adults, currency, priceMin, priceMax, ratings, boardType } = req.body;

  if (!cityCode || !checkIn || !checkOut) {
    res.status(400).json({ error: 'cityCode, checkIn, and checkOut are required' });
    return;
  }

  try {
    const userId = (req as any).userId as string;
    ensureUser(userId);

    // Resolve a human-readable city name for Google Places enrichment
    const cityName = req.body.cityName || cityCode;

    let results: any[] = [];
    let searchStrategy = 'none';

    // ── Strategy 1: Full Amadeus search with all filters ──
    if (isAmadeusConfigured()) {
      results = await searchHotels({
        cityCode,
        checkIn,
        checkOut,
        adults,
        currency,
        priceMin: priceMin ?? undefined,
        priceMax: priceMax ?? undefined,
        ratings: Array.isArray(ratings) ? ratings : undefined,
        boardType: boardType ?? undefined,
      });
      searchStrategy = 'amadeus_filtered';

      // ── Strategy 2: Relax price filters if results are thin ──
      if (results.length < 3 && (priceMin != null || priceMax != null)) {
        const relaxedResults = await searchHotels({
          cityCode,
          checkIn,
          checkOut,
          adults,
          currency,
          ratings: Array.isArray(ratings) ? ratings : undefined,
          boardType: boardType ?? undefined,
        });
        // Merge: original filtered results first, then relaxed results that aren't duplicates
        const existingNames = new Set(results.map((r) => r.name));
        const additional = relaxedResults.filter((r: any) => !existingNames.has(r.name));
        results = [...results, ...additional].slice(0, 8);
        if (additional.length > 0) searchStrategy = 'amadeus_relaxed_price';
      }

      // ── Strategy 3: Relax star rating filters if still thin ──
      if (results.length < 3 && ratings?.length) {
        const noRatingResults = await searchHotels({
          cityCode,
          checkIn,
          checkOut,
          adults,
          currency,
          priceMin: priceMin ?? undefined,
          priceMax: priceMax ?? undefined,
        });
        const existingNames = new Set(results.map((r) => r.name));
        const additional = noRatingResults.filter((r: any) => !existingNames.has(r.name));
        results = [...results, ...additional].slice(0, 8);
        if (additional.length > 0) searchStrategy = 'amadeus_relaxed_rating';
      }
    }

    // ── Strategy 4: Google Places fallback if Amadeus unavailable or empty ──
    if (results.length === 0 && isGooglePlacesConfigured()) {
      const priceHint = priceMax ? (priceMax <= 150 ? 'budget' : priceMax <= 300 ? '' : 'luxury') : '';
      const ratingHint = ratings?.includes(5) ? '5-star' : ratings?.includes(4) ? 'upscale' : '';
      const query = `${ratingHint} ${priceHint} hotels in ${cityName}`.replace(/\s+/g, ' ').trim();

      const places = await searchPlaces({ textQuery: query });
      results = places.map((p) => ({
        name: p.name,
        rating: Math.round(p.rating || 0),
        address: p.address,
        pricePerNight: p.priceLevel || 'Check rates',
        totalPrice: '',
        checkIn,
        checkOut,
        nights: Math.max(1, Math.ceil(
          (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)
        )),
        amenities: p.types || [],
        bookingUrl: p.googleMapsUrl || undefined,
        photoUrl: p.photoUrl,
        userRating: p.rating,
        reviewCount: p.reviewCount,
        editorialSummary: p.editorialSummary,
        googleMapsUrl: p.googleMapsUrl,
        phone: p.phone,
        website: p.website,
        cityCode,
      }));
      searchStrategy = 'google_places_fallback';
    }

    // ── Enrich Amadeus results with Google Places data (photos, reviews, etc.) ──
    if (searchStrategy.startsWith('amadeus') && results.length > 0) {
      results = await enrichHotelsWithPlaces(results, cityName);
    }

    const db = getDb();
    db.prepare(
      'INSERT INTO travel_searches (id, user_id, intent_type, params, result_count) VALUES (?, ?, ?, ?, ?)'
    ).run(
      crypto.randomUUID(),
      userId,
      'hotel_search',
      JSON.stringify({ cityCode, checkIn, checkOut, adults, priceMin, priceMax, ratings, boardType, searchStrategy }),
      results.length
    );

    res.json({ results, searchStrategy });
  } catch (err: any) {
    console.error('Hotel search error:', err.message);
    res.status(500).json({ error: 'Hotel search failed' });
  }
});

// ── POST /api/travel/pois — Google Places search ──────────────────────
router.post('/pois', async (req: Request, res: Response) => {
  if (!isGooglePlacesConfigured()) {
    res.status(503).json({ error: 'Google Places API not configured' });
    return;
  }

  const { textQuery, latitude, longitude, radius, types, cityName } = req.body;

  if (!textQuery && latitude == null && longitude == null) {
    res.status(400).json({ error: 'textQuery or latitude/longitude required' });
    return;
  }

  try {
    const userId = (req as any).userId as string;
    ensureUser(userId);

    const results = await searchPlaces({ textQuery, latitude, longitude, radius, types, cityName });

    const db = getDb();
    db.prepare(
      'INSERT INTO travel_searches (id, user_id, intent_type, params, result_count) VALUES (?, ?, ?, ?, ?)'
    ).run(
      crypto.randomUUID(),
      userId,
      'poi_search',
      JSON.stringify({ textQuery, latitude, longitude, radius, types, cityName }),
      results.length
    );

    res.json({ results });
  } catch (err: any) {
    console.error('POI search error:', err.message);
    res.status(500).json({ error: 'POI search failed' });
  }
});

// ── GET /api/travel/places/photo — proxy Google Places photos ─────────
router.get('/places/photo', async (req: Request, res: Response) => {
  const ref = req.query.ref as string;
  if (!ref) {
    res.status(400).json({ error: 'ref parameter is required' });
    return;
  }

  try {
    const { buffer, contentType } = await fetchPlacePhoto(ref);
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400', // 24h cache
    });
    res.send(buffer);
  } catch (err: any) {
    console.error('Photo proxy error:', err.message);
    res.status(502).json({ error: 'Failed to fetch photo' });
  }
});

// ── GET /api/travel/locations — autocomplete ───────────────────────────
router.get('/locations', async (req: Request, res: Response) => {
  if (!isAmadeusConfigured()) {
    res.status(503).json({ error: 'Amadeus API not configured' });
    return;
  }

  const q = req.query.q as string;
  if (!q || q.length < 2) {
    res.status(400).json({ error: 'q parameter must be at least 2 characters' });
    return;
  }

  try {
    const results = await autocompleteLocation(q);
    res.json({ results });
  } catch (err: any) {
    console.error('Location autocomplete error:', err.message);
    res.status(500).json({ error: 'Location search failed' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// BOOKMARKS — persisted saved flights/hotels/POIs
// ═══════════════════════════════════════════════════════════════════════

// ── GET /api/travel/bookmarks — list user's saved bookmarks ───────────
router.get('/bookmarks', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const db = getDb();
    const rows = db.prepare(
      'SELECT id, type, data, label, created_at FROM travel_bookmarks WHERE user_id = ? ORDER BY created_at DESC'
    ).all(userId) as any[];

    const bookmarks = rows.map((r) => ({
      id: r.id,
      type: r.type,
      data: JSON.parse(r.data),
      label: r.label,
      createdAt: r.created_at,
    }));

    res.json({ bookmarks });
  } catch (err: any) {
    console.error('List bookmarks error:', err.message);
    res.status(500).json({ error: 'Failed to list bookmarks' });
  }
});

// ── POST /api/travel/bookmarks — save a bookmark ─────────────────────
router.post('/bookmarks', (req: Request, res: Response) => {
  const { type, data, label } = req.body;

  if (!type || !data) {
    res.status(400).json({ error: 'type and data are required' });
    return;
  }

  try {
    const userId = (req as any).userId as string;
    ensureUser(userId);

    const id = crypto.randomUUID();
    const db = getDb();
    db.prepare(
      'INSERT INTO travel_bookmarks (id, user_id, type, data, label) VALUES (?, ?, ?, ?, ?)'
    ).run(id, userId, type, JSON.stringify(data), label || '');

    res.json({ id, type, label, createdAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('Save bookmark error:', err.message);
    res.status(500).json({ error: 'Failed to save bookmark' });
  }
});

// ── DELETE /api/travel/bookmarks/:id — remove a bookmark ──────────────
router.delete('/bookmarks/:id', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const db = getDb();
    const result = db.prepare(
      'DELETE FROM travel_bookmarks WHERE id = ? AND user_id = ?'
    ).run(req.params.id, userId);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Bookmark not found' });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete bookmark error:', err.message);
    res.status(500).json({ error: 'Failed to delete bookmark' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// TRIP SELECTIONS — active trip being planned
// ═══════════════════════════════════════════════════════════════════════

// ── GET /api/travel/trip-selections — list user's trip selections ──────
router.get('/trip-selections', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const db = getDb();
    const rows = db.prepare(
      'SELECT id, type, data, label, selected_at FROM trip_selections WHERE user_id = ? ORDER BY selected_at ASC'
    ).all(userId) as any[];

    const selections = rows.map((r) => ({
      id: r.id,
      type: r.type,
      data: JSON.parse(r.data),
      label: r.label,
      selectedAt: r.selected_at,
    }));

    res.json({ selections });
  } catch (err: any) {
    console.error('List trip selections error:', err.message);
    res.status(500).json({ error: 'Failed to list trip selections' });
  }
});

// ── POST /api/travel/trip-selections — add to trip ────────────────────
router.post('/trip-selections', (req: Request, res: Response) => {
  const { type, data, label } = req.body;

  if (!type || !data || !label) {
    res.status(400).json({ error: 'type, data, and label are required' });
    return;
  }

  try {
    const userId = (req as any).userId as string;
    ensureUser(userId);

    // Check for duplicate by label
    const db = getDb();
    const existing = db.prepare(
      'SELECT id FROM trip_selections WHERE user_id = ? AND label = ?'
    ).get(userId, label) as any;

    if (existing) {
      res.json({ id: existing.id, type, label, alreadyExists: true });
      return;
    }

    const id = crypto.randomUUID();
    db.prepare(
      'INSERT INTO trip_selections (id, user_id, type, data, label) VALUES (?, ?, ?, ?, ?)'
    ).run(id, userId, type, JSON.stringify(data), label);

    res.json({ id, type, label, selectedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('Add trip selection error:', err.message);
    res.status(500).json({ error: 'Failed to add trip selection' });
  }
});

// ── GET /api/travel/trip-selections/:id — get a single selection ───────
router.get('/trip-selections/:id', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const db = getDb();
    const row = db.prepare(
      'SELECT id, type, data, label, selected_at FROM trip_selections WHERE id = ? AND user_id = ?'
    ).get(req.params.id, userId) as any;

    if (!row) {
      res.status(404).json({ error: 'Trip selection not found' });
      return;
    }

    res.json({
      id: row.id,
      type: row.type,
      data: JSON.parse(row.data),
      label: row.label,
      selectedAt: row.selected_at,
    });
  } catch (err: any) {
    console.error('Get trip selection error:', err.message);
    res.status(500).json({ error: 'Failed to get trip selection' });
  }
});

// ── DELETE /api/travel/trip-selections/:id — remove from trip ──────────
router.delete('/trip-selections/:id', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const db = getDb();
    const result = db.prepare(
      'DELETE FROM trip_selections WHERE id = ? AND user_id = ?'
    ).run(req.params.id, userId);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Trip selection not found' });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete trip selection error:', err.message);
    res.status(500).json({ error: 'Failed to delete trip selection' });
  }
});

// ── DELETE /api/travel/trip-selections — clear all trip selections ─────
router.delete('/trip-selections', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const db = getDb();
    db.prepare('DELETE FROM trip_selections WHERE user_id = ?').run(userId);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Clear trip selections error:', err.message);
    res.status(500).json({ error: 'Failed to clear trip selections' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// FLIGHT BOOKING — browser-use agent proxy
// ═══════════════════════════════════════════════════════════════════════

// ── POST /api/travel/book — trigger a booking via the Python agent ────
router.post('/book', async (req: Request, res: Response) => {
  const { flightData, passengerInfo } = req.body;

  if (!flightData || !passengerInfo?.firstName || !passengerInfo?.lastName || !passengerInfo?.email) {
    res.status(400).json({ error: 'flightData and passengerInfo (firstName, lastName, email) are required' });
    return;
  }

  try {
    const userId = (req as any).userId as string;
    ensureUser(userId);

    const agentRes = await fetch(`${BOOKING_AGENT_URL}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flightData, passengerInfo }),
    });

    if (!agentRes.ok) {
      const err = await agentRes.json().catch(() => ({}));
      res.status(502).json({ error: 'Booking agent error', detail: err });
      return;
    }

    const { jobId, status } = await agentRes.json() as { jobId: string; status: string };

    // Store in DB
    const db = getDb();
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO flight_bookings (id, user_id, job_id, flight_data, passenger_info, status)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, userId, jobId, JSON.stringify(flightData), JSON.stringify(passengerInfo), status);

    res.json({ jobId, status });
  } catch (err: any) {
    console.error('Flight booking error:', err.message);
    res.status(500).json({ error: 'Failed to start flight booking' });
  }
});

// ── GET /api/travel/book/:jobId/status — poll booking status ──────────
router.get('/book/:jobId/status', async (req: Request, res: Response) => {
  const { jobId } = req.params;

  try {
    const agentRes = await fetch(`${BOOKING_AGENT_URL}/status/${jobId}`);
    if (!agentRes.ok) {
      res.status(agentRes.status).json({ error: 'Job not found' });
      return;
    }

    const data = await agentRes.json();

    // Update local DB with latest status
    const db = getDb();
    const userId = (req as any).userId as string;
    db.prepare(
      `UPDATE flight_bookings SET status = ?, updated_at = datetime('now') WHERE job_id = ? AND user_id = ?`
    ).run(data.status, jobId, userId);

    if (data.status === 'failed' && data.error) {
      db.prepare(
        `UPDATE flight_bookings SET error_message = ? WHERE job_id = ? AND user_id = ?`
      ).run(data.error, jobId, userId);
    }

    res.json(data);
  } catch (err: any) {
    console.error('Booking status error:', err.message);
    res.status(502).json({ error: 'Cannot reach booking agent' });
  }
});

// ── POST /api/travel/book/:jobId/calendar — create a calendar event ───
router.post('/book/:jobId/calendar', async (req: Request, res: Response) => {
  const { jobId } = req.params;

  try {
    const userId = (req as any).userId as string;
    const db = getDb();

    const booking = db.prepare(
      'SELECT id, flight_data, status FROM flight_bookings WHERE job_id = ? AND user_id = ?'
    ).get(jobId, userId) as any;

    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    if (booking.status !== 'completed' && booking.status !== 'queued') {
      // Allow calendar creation for any non-failed booking
    }

    const flight = JSON.parse(booking.flight_data);
    const depDate = flight.departureDate || new Date().toISOString().slice(0, 10);
    const depTime = flight.departure?.time || '00:00';
    const arrTime = flight.arrival?.time || depTime;

    // Build ISO datetimes
    const startDateTime = `${depDate}T${depTime}:00`;
    // If arrival is next day (overnight), add a day
    const endDate = flight.isOvernight
      ? new Date(new Date(depDate).getTime() + 86400000).toISOString().slice(0, 10)
      : depDate;
    const endDateTime = `${endDate}T${arrTime}:00`;

    const summary = `Flight ${flight.flightNumber || flight.airline || ''} — ${flight.departure?.city || ''} → ${flight.arrival?.city || ''}`;
    const description = [
      `Airline: ${flight.airline || 'N/A'}`,
      `Flight: ${flight.flightNumber || 'N/A'}`,
      `Route: ${flight.departure?.city || ''} → ${flight.arrival?.city || ''}`,
      `Duration: ${flight.duration || 'N/A'}`,
      `Price: ${flight.price || 'N/A'}`,
      flight.bookingUrl ? `Booking: ${flight.bookingUrl}` : '',
    ].filter(Boolean).join('\n');

    const result = await createCalendarEvent(userId, {
      summary,
      description,
      startDateTime,
      endDateTime,
      location: flight.departure?.city,
    });

    if (!result) {
      res.status(400).json({ error: 'Google Calendar not connected' });
      return;
    }

    db.prepare(
      'UPDATE flight_bookings SET calendar_event_id = ? WHERE job_id = ? AND user_id = ?'
    ).run(result.eventId, jobId, userId);

    res.json({ eventId: result.eventId });
  } catch (err: any) {
    console.error('Calendar event error:', err.message);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
});

export default router;
