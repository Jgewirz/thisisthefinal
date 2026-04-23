import { Router, Request, Response } from 'express';
import { idempotency } from '../middleware/idempotency.js';
import {
  SAVED_ITEM_KINDS,
  type SavedItemKind,
  saveItem,
  listSavedItems,
  deleteSavedItem,
  deleteSavedItemByExternal,
} from '../services/savedItems.js';

const router = Router();

function parseKind(value: unknown): SavedItemKind | undefined {
  if (typeof value !== 'string') return undefined;
  return (SAVED_ITEM_KINDS as readonly string[]).includes(value)
    ? (value as SavedItemKind)
    : undefined;
}

// GET /api/saved?kind=hotel
router.get('/', async (req: Request, res: Response) => {
  try {
    const kind = parseKind(req.query.kind);
    if (req.query.kind !== undefined && !kind) {
      res.status(400).json({ error: `invalid kind — expected one of ${SAVED_ITEM_KINDS.join(', ')}` });
      return;
    }
    const items = await listSavedItems(req.user!.id, kind);
    res.json({ items });
  } catch (err: any) {
    console.error('listSavedItems error:', err?.message || err);
    res.status(500).json({ error: 'Failed to load saved items' });
  }
});

// POST /api/saved — idempotent create. Body: { kind, externalId, data }
router.post('/', idempotency(), async (req: Request, res: Response) => {
  try {
    const { kind: rawKind, externalId, data } = req.body ?? {};
    const kind = parseKind(rawKind);
    if (!kind) {
      res.status(400).json({ error: `kind required; expected one of ${SAVED_ITEM_KINDS.join(', ')}` });
      return;
    }
    if (typeof externalId !== 'string' || externalId.length === 0 || externalId.length > 256) {
      res.status(400).json({ error: 'externalId is required and must be <= 256 chars' });
      return;
    }
    if (data !== undefined && (typeof data !== 'object' || data === null || Array.isArray(data))) {
      res.status(400).json({ error: 'data must be a JSON object when provided' });
      return;
    }
    const item = await saveItem({
      userId: req.user!.id,
      kind,
      externalId,
      data: data ?? {},
    });
    res.status(201).json({ item });
  } catch (err: any) {
    console.error('saveItem error:', err?.message || err);
    res.status(500).json({ error: 'Failed to save item' });
  }
});

// DELETE /api/saved/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const ok = await deleteSavedItem(req.params.id, req.user!.id);
    if (!ok) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err: any) {
    console.error('deleteSavedItem error:', err?.message || err);
    res.status(500).json({ error: 'Failed to delete saved item' });
  }
});

// DELETE /api/saved?kind=hotel&externalId=xyz — unsave by natural key
router.delete('/', async (req: Request, res: Response) => {
  try {
    const kind = parseKind(req.query.kind);
    const externalId = req.query.externalId;
    if (!kind || typeof externalId !== 'string' || externalId.length === 0) {
      res.status(400).json({ error: 'kind and externalId query params required' });
      return;
    }
    const ok = await deleteSavedItemByExternal(req.user!.id, kind, externalId);
    if (!ok) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err: any) {
    console.error('deleteSavedItemByExternal error:', err?.message || err);
    res.status(500).json({ error: 'Failed to delete saved item' });
  }
});

export default router;
