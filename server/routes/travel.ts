import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { extractTravelParams } from '../services/openai.js';
import {
  searchFlights,
  searchHotels,
  searchPOIs,
  searchCheapestDates,
  autocompleteLocation,
  isAmadeusConfigured,
} from '../services/amadeus.js';
import { getDb } from '../db/sqlite.js';

const router = Router();

// ── Ensure user row exists ─────────────────────────────────────────────
function ensureUser(userId: string) {
  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)').run(userId);
}

// ── POST /api/travel/extract — GPT extracts structured params ──────────
router.post('/extract', async (req: Request, res: Response) => {
  const { message, context } = req.body as {
    message: string;
    context?: Array<{ role: string; content: string }>;
  };

  if (!message) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  try {
    const intent = await extractTravelParams(message, context);
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

// ── POST /api/travel/hotels — Amadeus hotel search ─────────────────────
router.post('/hotels', async (req: Request, res: Response) => {
  if (!isAmadeusConfigured()) {
    res.status(503).json({ error: 'Amadeus API not configured' });
    return;
  }

  const { cityCode, checkIn, checkOut, adults, currency } = req.body;

  if (!cityCode || !checkIn || !checkOut) {
    res.status(400).json({ error: 'cityCode, checkIn, and checkOut are required' });
    return;
  }

  try {
    const userId = (req as any).userId as string;
    ensureUser(userId);

    const results = await searchHotels({ cityCode, checkIn, checkOut, adults, currency });

    const db = getDb();
    db.prepare(
      'INSERT INTO travel_searches (id, user_id, intent_type, params, result_count) VALUES (?, ?, ?, ?, ?)'
    ).run(
      crypto.randomUUID(),
      userId,
      'hotel_search',
      JSON.stringify({ cityCode, checkIn, checkOut, adults }),
      results.length
    );

    res.json({ results });
  } catch (err: any) {
    console.error('Hotel search error:', err.message);
    res.status(500).json({ error: 'Hotel search failed' });
  }
});

// ── POST /api/travel/pois — Amadeus POI search ────────────────────────
router.post('/pois', async (req: Request, res: Response) => {
  if (!isAmadeusConfigured()) {
    res.status(503).json({ error: 'Amadeus API not configured' });
    return;
  }

  const { latitude, longitude, radius, categories } = req.body;

  if (latitude == null || longitude == null) {
    res.status(400).json({ error: 'latitude and longitude are required' });
    return;
  }

  try {
    const userId = (req as any).userId as string;
    ensureUser(userId);

    const results = await searchPOIs({ latitude, longitude, radius, categories });

    const db = getDb();
    db.prepare(
      'INSERT INTO travel_searches (id, user_id, intent_type, params, result_count) VALUES (?, ?, ?, ?, ?)'
    ).run(
      crypto.randomUUID(),
      userId,
      'poi_search',
      JSON.stringify({ latitude, longitude, radius }),
      results.length
    );

    res.json({ results });
  } catch (err: any) {
    console.error('POI search error:', err.message);
    res.status(500).json({ error: 'POI search failed' });
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

export default router;
