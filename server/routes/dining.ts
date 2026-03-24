import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getDb } from '../db/sqlite.js';
import { searchPlaces, isGooglePlacesConfigured } from '../services/google-places.js';
import { sendReservationEmail } from '../services/gmail-send.js';

const router = Router();

// ── POST /api/dining/search — Search for restaurants ──────────────────
router.post('/search', async (req: Request, res: Response) => {
  if (!isGooglePlacesConfigured()) {
    res.status(503).json({ error: 'Google Places not configured' });
    return;
  }

  const { textQuery, latitude, longitude, radius, cuisine, cityName } = req.body;

  if (!textQuery && latitude == null) {
    res.status(400).json({ error: 'textQuery or latitude/longitude required' });
    return;
  }

  try {
    // Build a restaurant-specific query
    let query = textQuery || '';
    if (cuisine && !query.toLowerCase().includes(cuisine.toLowerCase())) {
      query = `${cuisine} restaurants${cityName ? ` in ${cityName}` : ''}`;
    }
    if (!query && cityName) {
      query = `restaurants in ${cityName}`;
    }

    const results = await searchPlaces({
      textQuery: query || undefined,
      latitude,
      longitude,
      radius: radius || 10,
      types: ['restaurant'],
      cityName,
    });

    res.json({ results });
  } catch (err: any) {
    console.error('[dining] Search error:', err.message);
    res.status(500).json({ error: 'Restaurant search failed' });
  }
});

// ── POST /api/dining/reserve — Create reservation + send email ────────
router.post('/reserve', async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const {
    restaurantName,
    restaurantPlaceId,
    restaurantEmail,
    restaurantPhone,
    restaurantAddress,
    date,
    time,
    partySize,
    specialRequests,
  } = req.body;

  if (!restaurantName || !date || !time || !partySize) {
    res.status(400).json({ error: 'restaurantName, date, time, and partySize are required' });
    return;
  }

  try {
    const id = crypto.randomUUID();
    const db = getDb();

    // Send reservation email via Gmail if restaurant email is available
    let gmailMessageId: string | null = null;

    if (restaurantEmail) {
      try {
        const result = await sendReservationEmail(userId, {
          restaurantName,
          restaurantEmail,
          date,
          time,
          partySize,
          specialRequests,
        });
        gmailMessageId = result?.messageId || null;
      } catch (err: any) {
        console.warn('[dining] Gmail send failed (reservation still saved):', err.message);
      }
    }

    // Save reservation to DB
    db.prepare(`
      INSERT INTO reservations (id, user_id, restaurant_name, restaurant_place_id, restaurant_email, restaurant_phone, restaurant_address, date, time, party_size, special_requests, status, gmail_message_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId,
      restaurantName,
      restaurantPlaceId || null,
      restaurantEmail || null,
      restaurantPhone || null,
      restaurantAddress || null,
      date,
      time,
      partySize,
      specialRequests || null,
      gmailMessageId ? 'pending' : 'saved',
      gmailMessageId
    );

    res.json({
      id,
      status: gmailMessageId ? 'pending' : 'saved',
      emailSent: !!gmailMessageId,
      message: gmailMessageId
        ? 'Reservation request sent! Check your Gmail for the restaurant\'s reply.'
        : restaurantEmail
          ? 'Reservation saved but email could not be sent. Try calling the restaurant.'
          : 'Reservation saved! No email on file — call the restaurant to confirm.',
    });
  } catch (err: any) {
    console.error('[dining] Reserve error:', err.message);
    res.status(500).json({ error: 'Failed to create reservation' });
  }
});

// ── GET /api/dining/reservations — List user's reservations ───────────
router.get('/reservations', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const db = getDb();

    const rows = db.prepare(
      'SELECT * FROM reservations WHERE user_id = ? ORDER BY date ASC, time ASC'
    ).all(userId) as any[];

    const reservations = rows.map((r) => ({
      id: r.id,
      restaurantName: r.restaurant_name,
      restaurantPlaceId: r.restaurant_place_id,
      restaurantEmail: r.restaurant_email,
      restaurantPhone: r.restaurant_phone,
      restaurantAddress: r.restaurant_address,
      date: r.date,
      time: r.time,
      partySize: r.party_size,
      specialRequests: r.special_requests,
      status: r.status,
      emailSent: !!r.gmail_message_id,
      createdAt: r.created_at,
    }));

    res.json({ reservations });
  } catch (err: any) {
    console.error('[dining] List reservations error:', err.message);
    res.status(500).json({ error: 'Failed to list reservations' });
  }
});

// ── PATCH /api/dining/reservations/:id — Update status ────────────────
router.patch('/reservations/:id', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { status } = req.body;

    if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
      res.status(400).json({ error: 'Invalid status. Must be pending, confirmed, or cancelled.' });
      return;
    }

    const db = getDb();
    const result = db.prepare(
      "UPDATE reservations SET status = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
    ).run(status, req.params.id, userId);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Reservation not found' });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('[dining] Update reservation error:', err.message);
    res.status(500).json({ error: 'Failed to update reservation' });
  }
});

// ── DELETE /api/dining/reservations/:id — Delete reservation ──────────
router.delete('/reservations/:id', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const db = getDb();

    const result = db.prepare(
      'DELETE FROM reservations WHERE id = ? AND user_id = ?'
    ).run(req.params.id, userId);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Reservation not found' });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('[dining] Delete reservation error:', err.message);
    res.status(500).json({ error: 'Failed to delete reservation' });
  }
});

export default router;
