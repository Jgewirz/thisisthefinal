import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { extractLifestyleParams } from '../services/openai.js';
import { searchPlaces, isGooglePlacesConfigured } from '../services/google-places.js';
import { getDb } from '../db/sqlite.js';

const router = Router();

function ensureUser(userId: string) {
  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)').run(userId);
}

// ── POST /api/lifestyle/extract — GPT extracts structured params ──────
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
    const intent = await extractLifestyleParams(message, context, userLocation as any);
    res.json({ intent });
  } catch (err: any) {
    console.error('Lifestyle extraction error:', err.message);
    res.status(500).json({ error: 'Failed to extract lifestyle parameters' });
  }
});

// ── POST /api/lifestyle/search — Restaurant/cafe search via Google Places ──
router.post('/search', async (req: Request, res: Response) => {
  if (!isGooglePlacesConfigured()) {
    res.status(503).json({ error: 'Google Places API not configured — set GOOGLE_PLACES_API_KEY' });
    return;
  }

  const { textQuery, latitude, longitude, radius, types, cuisine, cityName } = req.body;

  try {
    const userId = (req as any).userId as string;
    ensureUser(userId);

    let query = textQuery || '';
    if (cuisine && !query.toLowerCase().includes(cuisine.toLowerCase())) {
      query = `${cuisine} ${types?.includes('cafe') ? 'cafes' : 'restaurants'}${cityName ? ` in ${cityName}` : ''}`;
    }

    const places = await searchPlaces({
      textQuery: query || undefined,
      latitude,
      longitude,
      radius: radius || 10,
      types: types || ['restaurant'],
      cityName,
    });

    res.json({ results: places });
  } catch (err: any) {
    console.error('[lifestyle] Search error:', err.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ── POST /api/lifestyle/observe — Cross-agent signal ingestion ────────
router.post('/observe', (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { type, key, value } = req.body as {
    type: string;
    key: string;
    value?: string;
  };

  if (!type || !key) {
    res.status(400).json({ error: 'type and key are required' });
    return;
  }

  try {
    ensureUser(userId);
    const db = getDb();
    const id = crypto.randomUUID();

    // Upsert: increment signal_count and update confidence on conflict
    db.prepare(`
      INSERT INTO lifestyle_preferences (id, user_id, preference_type, preference_key, preference_value, confidence, signal_count)
      VALUES (?, ?, ?, ?, ?, 0.4, 1)
      ON CONFLICT(user_id, preference_type, preference_key) DO UPDATE SET
        signal_count = signal_count + 1,
        confidence = MIN(1.0, 0.3 + (signal_count + 1) * 0.1),
        preference_value = COALESCE(excluded.preference_value, preference_value),
        last_seen = datetime('now')
    `).run(id, userId, type, key.toLowerCase(), value || null);

    res.json({ success: true });
  } catch (err: any) {
    console.error('[lifestyle] Observe error:', err.message);
    res.status(500).json({ error: 'Failed to record preference' });
  }
});

// ── GET /api/lifestyle/profile — Aggregated lifestyle preferences ─────
router.get('/profile', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const db = getDb();

    const rows = db.prepare(
      `SELECT preference_type, preference_key, preference_value, confidence, signal_count
       FROM lifestyle_preferences
       WHERE user_id = ?
       ORDER BY confidence DESC, signal_count DESC`
    ).all(userId) as any[];

    // Group by type
    const grouped: Record<string, Array<{ key: string; value: string | null; confidence: number; count: number }>> = {};
    for (const row of rows) {
      if (!grouped[row.preference_type]) {
        grouped[row.preference_type] = [];
      }
      grouped[row.preference_type].push({
        key: row.preference_key,
        value: row.preference_value,
        confidence: row.confidence,
        count: row.signal_count,
      });
    }

    const profile = {
      preferredCuisines: (grouped.cuisine || []).slice(0, 5).map((p) => p.key),
      coffeeDrinkPreferences: (grouped.coffee || []).slice(0, 3).map((p) => p.key),
      dietaryPreferences: (grouped.dietary || []).slice(0, 3).map((p) => p.key),
      frequentLocations: (grouped.location || []).slice(0, 5).map((p) => ({ city: p.key, count: p.count })),
      activityPatterns: (grouped.activity || []).slice(0, 5).map((p) => ({ pattern: p.key, confidence: p.confidence })),
      timePatterns: (grouped.time_pattern || []).slice(0, 3).map((p) => ({ pattern: p.key, confidence: p.confidence })),
      fitnessPreferences: (grouped.fitness_class || []).slice(0, 3).map((p) => ({ type: p.key, time: p.value })),
      travelDestinations: (grouped.travel_destination || []).slice(0, 5).map((p) => p.key),
      allPreferences: grouped,
    };

    res.json({ profile });
  } catch (err: any) {
    console.error('[lifestyle] Profile error:', err.message);
    res.status(500).json({ error: 'Failed to load lifestyle profile' });
  }
});

export default router;
