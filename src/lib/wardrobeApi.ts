import { useAuthStore } from '../stores/auth';

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
export type WardrobeSeason = 'spring' | 'summer' | 'fall' | 'winter';

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

export interface CreateWardrobePayload {
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

export type UpdateWardrobePayload = Partial<CreateWardrobePayload>;

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { token } = useAuthStore.getState();
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 401) {
    useAuthStore.getState().logout();
    throw new Error('Session expired');
  }
  return res;
}

export async function listWardrobe(category?: WardrobeCategory): Promise<WardrobeItem[]> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : '';
  const res = await authFetch(`/api/style/wardrobe${qs}`);
  if (!res.ok) return [];
  const { items } = (await res.json()) as { items: WardrobeItem[] };
  return items ?? [];
}

/**
 * Idempotent create. Callers should pass a stable `clientId` when the item is
 * derived from a specific photo/message so retries don't insert duplicates.
 */
export async function createWardrobeItem(
  payload: CreateWardrobePayload,
  clientId?: string
): Promise<WardrobeItem | null> {
  const idemKey = clientId
    ? `wardrobe:create:${clientId}`
    : `wardrobe:create:${crypto.randomUUID()}`;
  const res = await authFetch('/api/style/wardrobe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idemKey,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  const { item } = (await res.json()) as { item: WardrobeItem };
  return item ?? null;
}

export async function updateWardrobeItem(
  id: string,
  patch: UpdateWardrobePayload
): Promise<WardrobeItem | null> {
  const res = await authFetch(`/api/style/wardrobe/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) return null;
  const { item } = (await res.json()) as { item: WardrobeItem };
  return item ?? null;
}

export async function deleteWardrobeItem(id: string): Promise<boolean> {
  const res = await authFetch(`/api/style/wardrobe/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return res.ok;
}

/**
 * Run `/api/style/analyze` with `type=clothing_tag` to get tag suggestions for
 * a garment photo. Returns the raw server `result` payload so `suggestFromClothingAnalysis`
 * can normalize it. Returns null on any network/HTTP failure — the caller is
 * expected to fall back to empty suggestions rather than blocking the user.
 */
export async function analyzeClothingPhoto(imageBase64: string): Promise<unknown | null> {
  try {
    const res = await authFetch('/api/style/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64, type: 'clothing_tag' }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: unknown };
    return json?.result ?? null;
  } catch {
    return null;
  }
}
