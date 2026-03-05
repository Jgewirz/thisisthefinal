import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { extractFitnessParams } from '../services/openai.js';
import { searchPlaces, isGooglePlacesConfigured } from '../services/google-places.js';
import { getDb } from '../db/sqlite.js';

const router = Router();

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

    const results = await searchPlaces({
      textQuery: queryParts.join(' '),
      latitude: userLat,
      longitude: userLng,
      cityName,
    });

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

export default router;
