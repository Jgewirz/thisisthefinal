import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { analyzeImage } from '../services/openai.js';
import { uploadWardrobeImage, deleteWardrobeImage } from '../services/cloudinary.js';
import { getDb } from '../db/sqlite.js';

const router = Router();

const VALID_IMAGE_PREFIXES = [
  'data:image/jpeg;base64,',
  'data:image/png;base64,',
  'data:image/webp;base64,',
  'data:image/gif;base64,',
];
const MAX_BASE64_LENGTH = 10 * 1024 * 1024; // ~7.5MB decoded

function isValidImageDataUrl(image: string): boolean {
  return VALID_IMAGE_PREFIXES.some((prefix) => image.startsWith(prefix));
}

// ── Ensure user row exists ─────────────────────────────────────────────
function ensureUser(userId: string) {
  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)').run(userId);
}

// ── POST /api/style/analyze — image analysis ───────────────────────────
router.post('/analyze', async (req: Request, res: Response) => {
  const { image, type } = req.body as {
    image: string;
    type: 'skin_tone' | 'outfit_rating' | 'clothing_tag';
  };

  if (!image || !type) {
    res.status(400).json({ error: 'image and type are required' });
    return;
  }

  if (!isValidImageDataUrl(image)) {
    res.status(400).json({ error: 'image must be a valid base64 data URL (jpeg, png, webp, or gif)' });
    return;
  }

  if (image.length > MAX_BASE64_LENGTH) {
    res.status(413).json({ error: 'Image too large. Please use a smaller image (max ~7.5MB).' });
    return;
  }

  const validTypes = ['skin_tone', 'outfit_rating', 'clothing_tag'];
  if (!validTypes.includes(type)) {
    res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
    return;
  }

  try {
    const result = await analyzeImage(image, type);
    res.json({ result, type });
  } catch (err: any) {
    console.error('Image analysis error:', err.message);
    res.status(500).json({ error: 'Image analysis failed' });
  }
});

// ── GET /api/style/profile — read from SQLite ──────────────────────────
router.get('/profile', (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;

  if (!user) {
    res.json({ profile: null });
    return;
  }

  const profile = {
    bodyType: user.body_type,
    skinTone: user.skin_tone_season
      ? {
          depth: user.skin_tone_depth,
          undertone: user.skin_tone_undertone,
          season: user.skin_tone_season,
          bestColors: JSON.parse(user.skin_tone_best_colors || '[]'),
          bestMetals: user.skin_tone_best_metals,
        }
      : null,
    styleEssences: JSON.parse(user.style_essences || '[]'),
    budgetRange: user.budget_range,
    occasions: JSON.parse(user.occasions || '[]'),
    onboardingComplete: !!user.onboarding_complete,
    onboardingStep: user.onboarding_step,
  };

  res.json({ profile });
});

// ── POST /api/style/profile — upsert into SQLite ──────────────────────
router.post('/profile', (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { profile } = req.body as { profile: any };

  if (!profile) {
    res.status(400).json({ error: 'profile is required' });
    return;
  }

  ensureUser(userId);
  const db = getDb();

  db.prepare(`UPDATE users SET
    body_type = ?,
    skin_tone_depth = ?,
    skin_tone_undertone = ?,
    skin_tone_season = ?,
    skin_tone_best_colors = ?,
    skin_tone_best_metals = ?,
    style_essences = ?,
    budget_range = ?,
    occasions = ?,
    onboarding_complete = ?,
    onboarding_step = ?,
    updated_at = datetime('now')
  WHERE id = ?`).run(
    profile.bodyType || null,
    profile.skinTone?.depth || null,
    profile.skinTone?.undertone || null,
    profile.skinTone?.season || null,
    profile.skinTone?.bestColors ? JSON.stringify(profile.skinTone.bestColors) : null,
    profile.skinTone?.bestMetals || null,
    JSON.stringify(profile.styleEssences || []),
    profile.budgetRange || null,
    JSON.stringify(profile.occasions || []),
    profile.onboardingComplete ? 1 : 0,
    profile.onboardingStep || 0,
    userId
  );

  res.json({ saved: true });
});

// ── POST /api/style/wardrobe — upload item ─────────────────────────────
router.post('/wardrobe', async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { image, category, color, colorHex, style, seasons, occasions, pairsWith } = req.body as {
    image: string;
    category: string;
    color: string;
    colorHex: string;
    style: string;
    seasons: string[];
    occasions: string[];
    pairsWith: string[];
  };

  if (!image || !category || !color || !colorHex || !style) {
    res.status(400).json({ error: 'image, category, color, colorHex, and style are required' });
    return;
  }

  if (!isValidImageDataUrl(image)) {
    res.status(400).json({ error: 'image must be a valid base64 data URL' });
    return;
  }

  try {
    ensureUser(userId);
    const itemId = crypto.randomUUID();

    const { url, publicId, thumbnailUrl } = await uploadWardrobeImage(image, userId, itemId);

    const db = getDb();
    db.prepare(`INSERT INTO wardrobe_items
      (id, user_id, image_url, thumbnail_url, cloudinary_public_id, category, color, color_hex, style, seasons, occasions, pairs_with)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      itemId,
      userId,
      url,
      thumbnailUrl,
      publicId,
      category,
      color,
      colorHex,
      style,
      JSON.stringify(seasons || []),
      JSON.stringify(occasions || []),
      JSON.stringify(pairsWith || [])
    );

    res.json({
      item: {
        id: itemId,
        imageUrl: url,
        thumbnailUrl,
        category,
        color,
        colorHex,
        style,
        seasons: seasons || [],
        occasions: occasions || [],
        pairsWith: pairsWith || [],
        addedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('Wardrobe upload error:', err.message);
    res.status(500).json({ error: 'Failed to upload wardrobe item' });
  }
});

// ── GET /api/style/wardrobe — list items ───────────────────────────────
router.get('/wardrobe', (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const db = getDb();

  let sql = 'SELECT * FROM wardrobe_items WHERE user_id = ?';
  const params: string[] = [userId];

  const category = req.query.category as string | undefined;
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }

  const season = req.query.season as string | undefined;
  if (season) {
    sql += ' AND seasons LIKE ?';
    params.push(`%"${season}"%`);
  }

  sql += ' ORDER BY added_at DESC';

  const rows = db.prepare(sql).all(...params) as any[];
  const items = rows.map((r) => ({
    id: r.id,
    imageUrl: r.image_url,
    thumbnailUrl: r.thumbnail_url,
    category: r.category,
    color: r.color,
    colorHex: r.color_hex,
    style: r.style,
    seasons: JSON.parse(r.seasons),
    occasions: JSON.parse(r.occasions),
    pairsWith: JSON.parse(r.pairs_with),
    addedAt: r.added_at,
  }));

  res.json({ items });
});

// ── DELETE /api/style/wardrobe/:id — remove item ───────────────────────
router.delete('/wardrobe/:id', async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { id } = req.params;
  const db = getDb();

  const row = db.prepare('SELECT cloudinary_public_id FROM wardrobe_items WHERE id = ? AND user_id = ?').get(id, userId) as any;

  if (!row) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  try {
    if (row.cloudinary_public_id) {
      await deleteWardrobeImage(row.cloudinary_public_id);
    }
  } catch (err: any) {
    console.error('Cloudinary delete error (continuing):', err.message);
  }

  db.prepare('DELETE FROM wardrobe_items WHERE id = ? AND user_id = ?').run(id, userId);
  res.json({ deleted: true });
});

export default router;
