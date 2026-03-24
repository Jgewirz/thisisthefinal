import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { extractFitnessParams } from '../services/openai.js';
import { searchPlaces, isGooglePlacesConfigured } from '../services/google-places.js';
import { enrichStudios } from '../services/studio-enricher.js';
import { bookMindbodyClass, cancelMindbodyBooking, isMindbodyBookingConfigured } from '../services/mindbody-booking.js';
import { getDb } from '../db/sqlite.js';

const router = Router();

const BOOKING_AGENT_URL = process.env.BOOKING_AGENT_URL || 'http://localhost:8000';

// ── Ensure user row exists ─────────────────────────────────────────────
function ensureUser(userId: string) {
  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)').run(userId);
}

// ── POST /api/fitness/extract — GPT extracts structured params ─────────
router.post('/extract', async (req: Request, res: Response) => {
  const { message, context, userLocation } = req.body as {
    message: string;
    context?: Array<{ role: string; content: string }>;
    userLocation?: object;
  };

  if (!message) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  try {
    const intent = await extractFitnessParams(message, context, userLocation as any);
    res.json({ intent });
  } catch (err: any) {
    console.error('Fitness extraction error:', err.message);
    res.status(500).json({ error: 'Failed to extract fitness parameters' });
  }
});

// ── POST /api/fitness/search — Google Places gym/studio discovery ──────
router.post('/search', async (req: Request, res: Response) => {
  if (!isGooglePlacesConfigured()) {
    res.status(503).json({ error: 'Google Places API not configured — set GOOGLE_PLACES_API_KEY' });
    return;
  }

  const { classType, userLat, userLng, cityName } = req.body;

  try {
    const userId = (req as any).userId as string;
    ensureUser(userId);

    // Build a search query for gyms/studios offering the requested class type
    const queryParts = [classType || 'fitness', 'classes near me'];
    if (cityName) queryParts.push(`in ${cityName}`);

    const places = await searchPlaces({
      textQuery: queryParts.join(' '),
      latitude: userLat,
      longitude: userLng,
      cityName,
    });

    // Enrich top 4 studios with class schedule data from their websites
    const results = await enrichStudios(places, 4);

    // Log the search
    const db = getDb();
    db.prepare(
      'INSERT INTO fitness_searches (id, user_id, intent_type, params, result_count) VALUES (?, ?, ?, ?, ?)'
    ).run(
      crypto.randomUUID(),
      userId,
      'studio_search',
      JSON.stringify({ classType, cityName }),
      results.length
    );

    res.json({ results });
  } catch (err: any) {
    console.error('Fitness search error:', err.message);
    res.status(500).json({ error: 'Studio search failed' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// BOOKMARKS — saved fitness classes
// ═══════════════════════════════════════════════════════════════════════

// ── GET /api/fitness/bookmarks ─────────────────────────────────────────
router.get('/bookmarks', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const db = getDb();
    const rows = db.prepare(
      'SELECT id, type, data, label, created_at FROM fitness_bookmarks WHERE user_id = ? ORDER BY created_at DESC'
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
    console.error('List fitness bookmarks error:', err.message);
    res.status(500).json({ error: 'Failed to list bookmarks' });
  }
});

// ── POST /api/fitness/bookmarks ────────────────────────────────────────
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
      'INSERT INTO fitness_bookmarks (id, user_id, type, data, label) VALUES (?, ?, ?, ?, ?)'
    ).run(id, userId, type, JSON.stringify(data), label || '');

    res.json({ id, type, label, createdAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('Save fitness bookmark error:', err.message);
    res.status(500).json({ error: 'Failed to save bookmark' });
  }
});

// ── DELETE /api/fitness/bookmarks/:id ──────────────────────────────────
router.delete('/bookmarks/:id', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const db = getDb();
    const result = db.prepare(
      'DELETE FROM fitness_bookmarks WHERE id = ? AND user_id = ?'
    ).run(req.params.id, userId);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Bookmark not found' });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete fitness bookmark error:', err.message);
    res.status(500).json({ error: 'Failed to delete bookmark' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// SCHEDULE — user's planned class schedule
// ═══════════════════════════════════════════════════════════════════════

// ── GET /api/fitness/schedule ──────────────────────────────────────────
router.get('/schedule', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const db = getDb();
    const rows = db.prepare(
      'SELECT id, type, data, label, selected_at FROM fitness_schedule WHERE user_id = ? ORDER BY selected_at ASC'
    ).all(userId) as any[];

    const schedule = rows.map((r) => ({
      id: r.id,
      type: r.type,
      data: JSON.parse(r.data),
      label: r.label,
      selectedAt: r.selected_at,
    }));

    res.json({ schedule });
  } catch (err: any) {
    console.error('List fitness schedule error:', err.message);
    res.status(500).json({ error: 'Failed to list schedule' });
  }
});

// ── POST /api/fitness/schedule ─────────────────────────────────────────
router.post('/schedule', (req: Request, res: Response) => {
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
      'SELECT id FROM fitness_schedule WHERE user_id = ? AND label = ?'
    ).get(userId, label) as any;

    if (existing) {
      res.json({ id: existing.id, type, label, alreadyExists: true });
      return;
    }

    const id = crypto.randomUUID();
    db.prepare(
      'INSERT INTO fitness_schedule (id, user_id, type, data, label) VALUES (?, ?, ?, ?, ?)'
    ).run(id, userId, type, JSON.stringify(data), label);

    res.json({ id, type, label, selectedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('Add fitness schedule error:', err.message);
    res.status(500).json({ error: 'Failed to add to schedule' });
  }
});

// ── DELETE /api/fitness/schedule/:id ───────────────────────────────────
router.delete('/schedule/:id', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const db = getDb();
    const result = db.prepare(
      'DELETE FROM fitness_schedule WHERE id = ? AND user_id = ?'
    ).run(req.params.id, userId);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Schedule item not found' });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete fitness schedule error:', err.message);
    res.status(500).json({ error: 'Failed to delete schedule item' });
  }
});

// ── POST /api/fitness/classes — Find individual classes (flattened from studios) ──
router.post('/classes', async (req: Request, res: Response) => {
  if (!isGooglePlacesConfigured()) {
    res.status(503).json({ error: 'Google Places API not configured' });
    return;
  }

  const { classType, timePreference, date, userLat, userLng, cityName } = req.body;

  try {
    const userId = (req as any).userId as string;
    ensureUser(userId);

    const queryParts = [classType || 'fitness', 'classes'];
    if (cityName) queryParts.push(`in ${cityName}`);

    const places = await searchPlaces({
      textQuery: queryParts.join(' '),
      latitude: userLat,
      longitude: userLng,
      cityName,
    });

    // Enrich top 5 studios with schedules
    const enriched = await enrichStudios(places, 5);

    // Flatten into individual class cards
    const today = new Date();
    const classDate = date || today.toISOString().split('T')[0];
    const dateLabel = new Date(classDate + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    interface FlatClass {
      classId: string;
      className: string;
      instructor: string;
      studioName: string;
      studioAddress: string;
      date: string;
      time: string;
      endTime?: string;
      duration: string;
      category: string;
      level?: string;
      spotsRemaining: number | null;
      bookingPlatform: 'mindbody' | 'website' | 'none';
      bookingUrl?: string;
      mindbodySiteId?: string;
      mindbodyClassId?: string;
      studioLat: number | null;
      studioLng: number | null;
      studioWebsite?: string;
      studioGoogleMapsUrl?: string;
      distance?: string;
    }

    const allClasses: FlatClass[] = [];

    for (const studio of enriched) {
      for (const cls of studio.todayClasses) {
        allClasses.push({
          classId: cls.mindbodyClassId || crypto.randomUUID(),
          className: cls.name,
          instructor: cls.instructor || 'TBD',
          studioName: studio.name,
          studioAddress: studio.address,
          date: dateLabel,
          time: cls.time,
          endTime: cls.endTime,
          duration: cls.duration || '',
          category: cls.category || classType || 'fitness',
          level: cls.level,
          spotsRemaining: cls.spotsRemaining ?? null,
          bookingPlatform: cls.bookingPlatform || (studio.scheduleSource === 'mindbody' ? 'mindbody' : studio.website ? 'website' : 'none'),
          bookingUrl: cls.bookingUrl || studio.website || undefined,
          mindbodySiteId: studio.mindbodySiteId,
          mindbodyClassId: cls.mindbodyClassId,
          studioLat: studio.lat ?? null,
          studioLng: studio.lng ?? null,
          studioWebsite: studio.website || undefined,
          studioGoogleMapsUrl: studio.googleMapsUrl || undefined,
          distance: studio.distance || undefined,
        });
      }
    }

    // Filter by time preference if specified
    let filtered = allClasses;
    if (timePreference) {
      filtered = allClasses.filter((cls) => {
        const timeStr = cls.time.toLowerCase();
        const hour = parseTimeToHour(timeStr);
        if (hour === null) return true; // Can't parse, keep it
        if (timePreference === 'morning') return hour >= 5 && hour < 12;
        if (timePreference === 'afternoon') return hour >= 12 && hour < 17;
        if (timePreference === 'evening') return hour >= 17 && hour < 23;
        return true;
      });
      // Fall back to all classes if filter removes everything
      if (filtered.length === 0) filtered = allClasses;
    }

    // Sort by time
    filtered.sort((a, b) => {
      const ha = parseTimeToHour(a.time) ?? 99;
      const hb = parseTimeToHour(b.time) ?? 99;
      return ha - hb;
    });

    // Log the search
    const db = getDb();
    db.prepare(
      'INSERT INTO fitness_searches (id, user_id, intent_type, params, result_count) VALUES (?, ?, ?, ?, ?)'
    ).run(crypto.randomUUID(), userId, 'class_search', JSON.stringify({ classType, timePreference, date, cityName }), filtered.length);

    res.json({ results: filtered.slice(0, 10) });
  } catch (err: any) {
    console.error('Fitness class search error:', err.message);
    res.status(500).json({ error: 'Class search failed' });
  }
});

function parseTimeToHour(timeStr: string): number | null {
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const ampm = match[3]?.toLowerCase();
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  return hour;
}

// ═══════════════════════════════════════════════════════════════════════
// BOOKINGS — book & track fitness classes
// ═══════════════════════════════════════════════════════════════════════

// ── POST /api/fitness/book ────────────────────────────────────────────
router.post('/book', async (req: Request, res: Response) => {
  const { classData, bookingPlatform } = req.body as {
    classData: any;
    bookingPlatform: 'mindbody' | 'website' | 'manual';
  };

  if (!classData) {
    res.status(400).json({ error: 'classData is required' });
    return;
  }

  try {
    const userId = (req as any).userId as string;
    ensureUser(userId);

    const bookingId = crypto.randomUUID();
    let externalBookingId: string | undefined;
    let status: 'confirmed' | 'pending' = 'confirmed';
    let bookingUrl: string | undefined = classData.bookingUrl || classData.studioWebsite;

    // Attempt Mindbody API booking if configured and applicable
    if (bookingPlatform === 'mindbody' && classData.mindbodySiteId && classData.mindbodyClassId && isMindbodyBookingConfigured()) {
      const result = await bookMindbodyClass(userId, classData.mindbodySiteId, classData.mindbodyClassId);
      if (result.success) {
        externalBookingId = result.externalBookingId;
        status = 'confirmed';
      } else {
        // Mindbody booking failed — fall back to manual tracking
        console.warn(`[fitness/book] Mindbody booking failed: ${result.error}. Falling back to manual.`);
        bookingUrl = `https://clients.mindbodyonline.com/classic/ws?studioid=${classData.mindbodySiteId}`;
      }
    }

    // For website bookings, we just track + provide the URL
    if (bookingPlatform === 'website') {
      bookingUrl = classData.bookingUrl || classData.studioWebsite;
    }

    // Persist booking
    const db = getDb();
    db.prepare(
      `INSERT INTO fitness_bookings (id, user_id, class_name, instructor, studio_name, studio_address, class_date, class_time, duration, category, booking_platform, booking_status, external_booking_id, mindbody_site_id, mindbody_class_id, booking_url, studio_lat, studio_lng, studio_website, studio_google_maps_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      bookingId,
      userId,
      classData.className || classData.class_name || 'Class',
      classData.instructor || null,
      classData.studioName || classData.studio_name || 'Studio',
      classData.studioAddress || classData.studio_address || null,
      classData.date || new Date().toISOString().split('T')[0],
      classData.time || classData.class_time || '',
      classData.duration || null,
      classData.category || null,
      bookingPlatform || 'manual',
      status,
      externalBookingId || null,
      classData.mindbodySiteId || null,
      classData.mindbodyClassId || null,
      bookingUrl || null,
      classData.studioLat || null,
      classData.studioLng || null,
      classData.studioWebsite || null,
      classData.studioGoogleMapsUrl || null,
    );

    // Also add to the schedule table for calendar integration
    const scheduleLabel = `${classData.className || 'Class'} — ${classData.time || ''} (${classData.studioName || 'Studio'})`;
    db.prepare(
      'INSERT OR IGNORE INTO fitness_schedule (id, user_id, type, data, label) VALUES (?, ?, ?, ?, ?)'
    ).run(crypto.randomUUID(), userId, 'class', JSON.stringify(classData), scheduleLabel);

    res.json({
      id: bookingId,
      status,
      bookingPlatform,
      bookingUrl,
      externalBookingId,
      className: classData.className,
      studioName: classData.studioName,
      date: classData.date,
      time: classData.time,
    });
  } catch (err: any) {
    console.error('Fitness book error:', err.message);
    res.status(500).json({ error: 'Failed to book class' });
  }
});

// ── DELETE /api/fitness/book/:id ──────────────────────────────────────
router.delete('/book/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const db = getDb();

    const booking = db.prepare(
      'SELECT * FROM fitness_bookings WHERE id = ? AND user_id = ?'
    ).get(req.params.id, userId) as any;

    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    // Try Mindbody cancellation if applicable
    if (booking.booking_platform === 'mindbody' && booking.external_booking_id && booking.mindbody_site_id) {
      await cancelMindbodyBooking(booking.mindbody_site_id, booking.external_booking_id);
    }

    // Update status
    db.prepare(
      "UPDATE fitness_bookings SET booking_status = 'cancelled', cancelled_at = datetime('now') WHERE id = ? AND user_id = ?"
    ).run(req.params.id, userId);

    // Remove from schedule
    const label = `${booking.class_name} — ${booking.class_time} (${booking.studio_name})`;
    db.prepare('DELETE FROM fitness_schedule WHERE user_id = ? AND label = ?').run(userId, label);

    res.json({ success: true });
  } catch (err: any) {
    console.error('Cancel booking error:', err.message);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// ── GET /api/fitness/bookings ─────────────────────────────────────────
router.get('/bookings', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const db = getDb();
    const rows = db.prepare(
      "SELECT * FROM fitness_bookings WHERE user_id = ? AND booking_status != 'cancelled' ORDER BY class_date ASC, class_time ASC"
    ).all(userId) as any[];

    const bookings = rows.map((r) => ({
      id: r.id,
      className: r.class_name,
      instructor: r.instructor,
      studioName: r.studio_name,
      studioAddress: r.studio_address,
      date: r.class_date,
      time: r.class_time,
      duration: r.duration,
      category: r.category,
      bookingPlatform: r.booking_platform,
      bookingStatus: r.booking_status,
      bookingUrl: r.booking_url,
      studioWebsite: r.studio_website,
      studioGoogleMapsUrl: r.studio_google_maps_url,
      bookedAt: r.booked_at,
    }));

    res.json({ bookings });
  } catch (err: any) {
    console.error('List bookings error:', err.message);
    res.status(500).json({ error: 'Failed to list bookings' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// BROWSER BOOKING — browser-use agent proxy for website bookings
// ═══════════════════════════════════════════════════════════════════════

// ── POST /api/fitness/book-browser — trigger a browser-use booking ────
router.post('/book-browser', async (req: Request, res: Response) => {
  const { classData, userInfo } = req.body as {
    classData: any;
    userInfo: { firstName: string; lastName: string; email: string; phone?: string; useGoogleLogin?: boolean };
  };

  if (!classData || !userInfo?.firstName || !userInfo?.lastName || !userInfo?.email) {
    res.status(400).json({ error: 'classData and userInfo (firstName, lastName, email) are required' });
    return;
  }

  if (!classData.studioWebsite && !classData.bookingUrl) {
    res.status(400).json({ error: 'classData must include studioWebsite or bookingUrl' });
    return;
  }

  try {
    const userId = (req as any).userId as string;
    ensureUser(userId);

    const agentRes = await fetch(`${BOOKING_AGENT_URL}/book-fitness`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classData, userInfo }),
    });

    if (!agentRes.ok) {
      const err = await agentRes.json().catch(() => ({}));
      res.status(502).json({ error: 'Booking agent error', detail: err });
      return;
    }

    const { jobId, status } = await agentRes.json() as { jobId: string; status: string };

    // Store in fitness_bookings with browser method
    const db = getDb();
    const bookingId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO fitness_bookings (id, user_id, class_name, instructor, studio_name, studio_address, class_date, class_time, duration, category, booking_platform, booking_status, booking_url, studio_lat, studio_lng, studio_website, studio_google_maps_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      bookingId,
      userId,
      classData.className || 'Class',
      classData.instructor || null,
      classData.studioName || 'Studio',
      classData.studioAddress || null,
      classData.date || new Date().toISOString().split('T')[0],
      classData.time || '',
      classData.duration || null,
      classData.category || null,
      'browser',
      'pending',
      classData.studioWebsite || classData.bookingUrl || null,
      classData.studioLat || null,
      classData.studioLng || null,
      classData.studioWebsite || null,
      classData.studioGoogleMapsUrl || null,
    );

    res.json({ jobId, status, bookingId });
  } catch (err: any) {
    console.error('Fitness browser booking error:', err.message);
    res.status(500).json({ error: 'Failed to start browser booking' });
  }
});

// ── GET /api/fitness/book-browser/:jobId/status — poll booking status ──
router.get('/book-browser/:jobId/status', async (req: Request, res: Response) => {
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

    if (data.status === 'completed' && data.result?.status === 'booked') {
      db.prepare(
        `UPDATE fitness_bookings SET booking_status = 'confirmed' WHERE user_id = ? AND booking_platform = 'browser' AND booking_status = 'pending' ORDER BY booked_at DESC LIMIT 1`
      ).run(userId);
    } else if (data.status === 'failed') {
      db.prepare(
        `UPDATE fitness_bookings SET booking_status = 'cancelled' WHERE user_id = ? AND booking_platform = 'browser' AND booking_status = 'pending' ORDER BY booked_at DESC LIMIT 1`
      ).run(userId);
    }

    res.json(data);
  } catch (err: any) {
    console.error('Fitness booking status error:', err.message);
    res.status(502).json({ error: 'Cannot reach booking agent' });
  }
});

export default router;
