import { randomUUID } from 'node:crypto';
import { pool } from './db.js';

/**
 * Canonical wardrobe-item category. Mirrors the CHECK constraint in
 * db.ts — keep the two lists in sync or migrations will reject inserts.
 */
export type WardrobeCategory =
  | 'top'
  | 'bottom'
  | 'dress'
  | 'outerwear'
  | 'shoes'
  | 'accessory'
  | 'activewear';

export const WARDROBE_CATEGORIES: readonly WardrobeCategory[] = [
  'top',
  'bottom',
  'dress',
  'outerwear',
  'shoes',
  'accessory',
  'activewear',
] as const;

export type WardrobeWarmth = 'light' | 'medium' | 'heavy';
export const WARDROBE_WARMTHS: readonly WardrobeWarmth[] = ['light', 'medium', 'heavy'] as const;

export type WardrobeSeason = 'spring' | 'summer' | 'fall' | 'winter';
export const WARDROBE_SEASONS: readonly WardrobeSeason[] = [
  'spring',
  'summer',
  'fall',
  'winter',
] as const;

export interface WardrobeItem {
  id: string;
  user_id: string;
  image_url: string | null;
  category: WardrobeCategory;
  subtype: string | null;
  color: string | null;
  color_hex: string | null;
  pattern: string | null;
  seasons: WardrobeSeason[];
  occasions: string[];
  warmth: WardrobeWarmth | null;
  attributes: Record<string, unknown>;
  created_at: string;
}

export interface CreateWardrobeInput {
  userId: string;
  imageUrl?: string | null;
  category: WardrobeCategory;
  subtype?: string | null;
  color?: string | null;
  colorHex?: string | null;
  pattern?: string | null;
  seasons?: WardrobeSeason[];
  occasions?: string[];
  warmth?: WardrobeWarmth | null;
  attributes?: Record<string, unknown>;
}

export interface UpdateWardrobeInput {
  imageUrl?: string | null;
  category?: WardrobeCategory;
  subtype?: string | null;
  color?: string | null;
  colorHex?: string | null;
  pattern?: string | null;
  seasons?: WardrobeSeason[];
  occasions?: string[];
  warmth?: WardrobeWarmth | null;
  attributes?: Record<string, unknown>;
}

const MAX_TEXT = 200;
// Photos uploaded from the chat come through as base64 data URLs, which are
// tens to thousands of KB. We still cap them to keep rogue payloads out of
// the DB — aligned with the 8 MB upload ceiling enforced by /api/style/analyze.
const MAX_IMAGE_URL = 12 * 1024 * 1024;
const MAX_OCCASIONS = 10;
const MAX_SEASONS = 4;

function rowToItem(row: any): WardrobeItem {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    image_url: row.image_url ?? null,
    category: row.category as WardrobeCategory,
    subtype: row.subtype ?? null,
    color: row.color ?? null,
    color_hex: row.color_hex ?? null,
    pattern: row.pattern ?? null,
    seasons: Array.isArray(row.seasons) ? (row.seasons as WardrobeSeason[]) : [],
    occasions: Array.isArray(row.occasions) ? (row.occasions as string[]) : [],
    warmth: (row.warmth ?? null) as WardrobeWarmth | null,
    attributes: row.attributes ?? {},
    created_at:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

/**
 * Normalize + validate input for both create and patch flows. Throws a
 * user-readable Error so the route layer can map it to a 400.
 */
function normalizeSeasons(seasons?: WardrobeSeason[]): WardrobeSeason[] | undefined {
  if (seasons === undefined) return undefined;
  if (!Array.isArray(seasons)) throw new Error('seasons must be an array of strings');
  const unique = Array.from(new Set(seasons.map((s) => String(s).trim() as WardrobeSeason)));
  if (unique.length > MAX_SEASONS) throw new Error(`seasons: max ${MAX_SEASONS} entries`);
  for (const s of unique) {
    if (!WARDROBE_SEASONS.includes(s)) {
      throw new Error(`invalid season: ${s}`);
    }
  }
  return unique;
}

function normalizeOccasions(occasions?: string[]): string[] | undefined {
  if (occasions === undefined) return undefined;
  if (!Array.isArray(occasions)) throw new Error('occasions must be an array of strings');
  const cleaned = Array.from(
    new Set(
      occasions
        .map((o) => String(o).trim().toLowerCase())
        .filter((o) => o.length > 0 && o.length <= 40)
    )
  );
  if (cleaned.length > MAX_OCCASIONS) {
    throw new Error(`occasions: max ${MAX_OCCASIONS} entries`);
  }
  return cleaned;
}

function validateCategory(category?: string): WardrobeCategory | undefined {
  if (category === undefined) return undefined;
  if (!WARDROBE_CATEGORIES.includes(category as WardrobeCategory)) {
    throw new Error(
      `invalid category: ${category} — expected one of ${WARDROBE_CATEGORIES.join(', ')}`
    );
  }
  return category as WardrobeCategory;
}

function validateWarmth(warmth?: string | null): WardrobeWarmth | null | undefined {
  if (warmth === undefined) return undefined;
  if (warmth === null) return null;
  if (!WARDROBE_WARMTHS.includes(warmth as WardrobeWarmth)) {
    throw new Error(`invalid warmth: ${warmth}`);
  }
  return warmth as WardrobeWarmth;
}

function validateText(
  value: string | null | undefined,
  field: string,
  max: number = MAX_TEXT
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > max) {
    throw new Error(`${field}: max ${max} chars`);
  }
  return trimmed;
}

export async function createWardrobeItem(input: CreateWardrobeInput): Promise<WardrobeItem> {
  if (!input.userId) throw new Error('userId is required');
  const category = validateCategory(input.category);
  if (!category) throw new Error('category is required');
  const seasons = normalizeSeasons(input.seasons) ?? [];
  const occasions = normalizeOccasions(input.occasions) ?? [];
  const warmth = validateWarmth(input.warmth ?? null) ?? null;

  const id = randomUUID();
  const params = [
    id,
    input.userId,
    validateText(input.imageUrl ?? null, 'imageUrl', MAX_IMAGE_URL) ?? null,
    category,
    validateText(input.subtype ?? null, 'subtype') ?? null,
    validateText(input.color ?? null, 'color') ?? null,
    validateText(input.colorHex ?? null, 'colorHex') ?? null,
    validateText(input.pattern ?? null, 'pattern') ?? null,
    seasons,
    occasions,
    warmth,
    JSON.stringify(input.attributes ?? {}),
  ];

  const { rows } = await pool.query(
    `INSERT INTO wardrobe_items
       (id, user_id, image_url, category, subtype, color, color_hex, pattern,
        seasons, occasions, warmth, attributes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10::text[], $11, $12::jsonb)
     RETURNING *`,
    params
  );
  return rowToItem(rows[0]);
}

export async function listWardrobeItems(
  userId: string,
  opts: { category?: WardrobeCategory; limit?: number } = {}
): Promise<WardrobeItem[]> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  if (opts.category && !WARDROBE_CATEGORIES.includes(opts.category)) {
    throw new Error(`invalid category: ${opts.category}`);
  }
  if (opts.category) {
    const { rows } = await pool.query(
      `SELECT * FROM wardrobe_items
         WHERE user_id = $1 AND category = $2
         ORDER BY created_at DESC
         LIMIT $3`,
      [userId, opts.category, limit]
    );
    return rows.map(rowToItem);
  }
  const { rows } = await pool.query(
    `SELECT * FROM wardrobe_items
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
    [userId, limit]
  );
  return rows.map(rowToItem);
}

export async function getWardrobeItem(
  id: string,
  userId: string
): Promise<WardrobeItem | null> {
  const { rows } = await pool.query(
    `SELECT * FROM wardrobe_items WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return rows[0] ? rowToItem(rows[0]) : null;
}

/**
 * Partial update. Only fields present on `patch` are written. Owner-scoped;
 * returns null if no row matched (not-found or wrong owner).
 */
export async function updateWardrobeItem(
  id: string,
  userId: string,
  patch: UpdateWardrobeInput
): Promise<WardrobeItem | null> {
  const sets: string[] = [];
  const params: unknown[] = [id, userId];
  let idx = 3;
  const push = (col: string, value: unknown, cast?: string) => {
    sets.push(`${col} = $${idx}${cast ?? ''}`);
    params.push(value);
    idx += 1;
  };

  if ('imageUrl' in patch) push('image_url', validateText(patch.imageUrl ?? null, 'imageUrl', MAX_IMAGE_URL) ?? null);
  if ('category' in patch) {
    const cat = validateCategory(patch.category);
    if (cat !== undefined) push('category', cat);
  }
  if ('subtype' in patch) push('subtype', validateText(patch.subtype ?? null, 'subtype') ?? null);
  if ('color' in patch) push('color', validateText(patch.color ?? null, 'color') ?? null);
  if ('colorHex' in patch) push('color_hex', validateText(patch.colorHex ?? null, 'colorHex') ?? null);
  if ('pattern' in patch) push('pattern', validateText(patch.pattern ?? null, 'pattern') ?? null);
  if ('seasons' in patch) {
    const seasons = normalizeSeasons(patch.seasons) ?? [];
    push('seasons', seasons, '::text[]');
  }
  if ('occasions' in patch) {
    const occasions = normalizeOccasions(patch.occasions) ?? [];
    push('occasions', occasions, '::text[]');
  }
  if ('warmth' in patch) {
    const w = validateWarmth(patch.warmth ?? null);
    push('warmth', w ?? null);
  }
  if ('attributes' in patch) {
    push('attributes', JSON.stringify(patch.attributes ?? {}), '::jsonb');
  }

  if (sets.length === 0) {
    // Nothing to change; return current row (or null if not found).
    return getWardrobeItem(id, userId);
  }

  const sql = `UPDATE wardrobe_items
                 SET ${sets.join(', ')}
                 WHERE id = $1 AND user_id = $2
                 RETURNING *`;
  const { rows } = await pool.query(sql, params);
  return rows[0] ? rowToItem(rows[0]) : null;
}

export async function deleteWardrobeItem(id: string, userId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM wardrobe_items WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return (rowCount ?? 0) > 0;
}
