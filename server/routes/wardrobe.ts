import { Router, Request, Response } from 'express';
import { idempotency } from '../middleware/idempotency.js';
import { errorMessage } from '../utils/errors.js';
import {
  WARDROBE_CATEGORIES,
  createWardrobeItem,
  deleteWardrobeItem,
  listWardrobeItems,
  updateWardrobeItem,
  type WardrobeCategory,
} from '../services/wardrobe.js';

const router = Router();

function parseCategory(value: unknown): WardrobeCategory | undefined {
  if (typeof value !== 'string') return undefined;
  return (WARDROBE_CATEGORIES as readonly string[]).includes(value)
    ? (value as WardrobeCategory)
    : undefined;
}

// GET /api/style/wardrobe?category=top
router.get('/', async (req: Request, res: Response) => {
  try {
    const category = parseCategory(req.query.category);
    if (req.query.category !== undefined && !category) {
      res.status(400).json({
        error: `invalid category — expected one of ${WARDROBE_CATEGORIES.join(', ')}`,
      });
      return;
    }
    const items = await listWardrobeItems(req.user!.id, { category });
    res.json({ items });
  } catch (err: unknown) {
    console.error('listWardrobeItems error:', errorMessage(err));
    res.status(500).json({ error: 'Failed to load wardrobe' });
  }
});

// POST /api/style/wardrobe — idempotent create.
// Body: { imageUrl?, category, subtype?, color?, colorHex?, pattern?,
//         seasons?, occasions?, warmth?, attributes? }
router.post('/', idempotency(), async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    if (!body.category) {
      res.status(400).json({ error: 'category is required' });
      return;
    }
    const item = await createWardrobeItem({
      userId: req.user!.id,
      imageUrl: body.imageUrl ?? null,
      category: body.category,
      subtype: body.subtype ?? null,
      color: body.color ?? null,
      colorHex: body.colorHex ?? null,
      pattern: body.pattern ?? null,
      seasons: body.seasons,
      occasions: body.occasions,
      warmth: body.warmth ?? null,
      attributes: body.attributes ?? undefined,
    });
    res.status(201).json({ item });
  } catch (err: unknown) {
    const msg = errorMessage(err);
    // Input-validation errors carry a readable message; treat them as 400.
    if (/required|invalid|max \d+/i.test(msg)) {
      res.status(400).json({ error: msg });
      return;
    }
    console.error('createWardrobeItem error:', msg);
    res.status(500).json({ error: 'Failed to save wardrobe item' });
  }
});

// PATCH /api/style/wardrobe/:id — partial update.
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const patch = req.body ?? {};
    const updated = await updateWardrobeItem(req.params.id, req.user!.id, patch);
    if (!updated) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json({ item: updated });
  } catch (err: unknown) {
    const msg = errorMessage(err);
    if (/invalid|max \d+/i.test(msg)) {
      res.status(400).json({ error: msg });
      return;
    }
    console.error('updateWardrobeItem error:', msg);
    res.status(500).json({ error: 'Failed to update wardrobe item' });
  }
});

// DELETE /api/style/wardrobe/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const ok = await deleteWardrobeItem(req.params.id, req.user!.id);
    if (!ok) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err: unknown) {
    console.error('deleteWardrobeItem error:', errorMessage(err));
    res.status(500).json({ error: 'Failed to delete wardrobe item' });
  }
});

export default router;
