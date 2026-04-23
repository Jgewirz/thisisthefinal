import { randomUUID } from 'node:crypto';
import { pool } from './db.js';

/**
 * Kinds of items a user can save from a rich card. Keep this enum in lockstep
 * with the `saved_items.kind` CHECK constraint in db.ts.
 */
export type SavedItemKind = 'hotel' | 'flight' | 'place' | 'studio' | 'reminder';

export const SAVED_ITEM_KINDS: readonly SavedItemKind[] = [
  'hotel',
  'flight',
  'place',
  'studio',
  'reminder',
] as const;

export interface SavedItem {
  id: string;
  user_id: string;
  kind: SavedItemKind;
  external_id: string;
  data: Record<string, unknown>;
  created_at: string;
}

export interface SaveItemInput {
  userId: string;
  kind: SavedItemKind;
  externalId: string;
  data: Record<string, unknown>;
}

function rowToItem(row: any): SavedItem {
  return {
    id: row.id,
    user_id: row.user_id,
    kind: row.kind as SavedItemKind,
    external_id: row.external_id,
    data: row.data ?? {},
    created_at:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

/**
 * Idempotent save. If (user_id, kind, external_id) already exists we return
 * the existing row instead of raising — so double-taps and retries are safe.
 */
export async function saveItem(input: SaveItemInput): Promise<SavedItem> {
  if (!SAVED_ITEM_KINDS.includes(input.kind)) {
    throw new Error(`invalid saved-item kind: ${input.kind}`);
  }
  if (!input.externalId || input.externalId.length > 256) {
    throw new Error('externalId is required and must be <= 256 chars');
  }

  const id = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO saved_items (id, user_id, kind, external_id, data)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (user_id, kind, external_id)
       DO UPDATE SET data = EXCLUDED.data
     RETURNING *`,
    [id, input.userId, input.kind, input.externalId, JSON.stringify(input.data ?? {})]
  );
  return rowToItem(rows[0]);
}

export async function listSavedItems(
  userId: string,
  kind?: SavedItemKind
): Promise<SavedItem[]> {
  const sql = kind
    ? `SELECT * FROM saved_items WHERE user_id = $1 AND kind = $2 ORDER BY created_at DESC`
    : `SELECT * FROM saved_items WHERE user_id = $1 ORDER BY created_at DESC`;
  const params = kind ? [userId, kind] : [userId];
  const { rows } = await pool.query(sql, params);
  return rows.map(rowToItem);
}

/**
 * Delete a single saved item, scoped to the owner. Returns `true` when a row
 * was removed; `false` if nothing matched (owner-scope or not-found).
 */
export async function deleteSavedItem(id: string, userId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM saved_items WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Delete by the natural key (kind + external_id). Useful for "unsave" buttons
 * that don't know the server-issued row id.
 */
export async function deleteSavedItemByExternal(
  userId: string,
  kind: SavedItemKind,
  externalId: string
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM saved_items WHERE user_id = $1 AND kind = $2 AND external_id = $3`,
    [userId, kind, externalId]
  );
  return (rowCount ?? 0) > 0;
}
