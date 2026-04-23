import type { WardrobeItem } from './wardrobeApi';

/**
 * Verification policy (Phase 1 of the photo-grounded plan).
 *
 * An item is "verified" when:
 *   - it has a photo (`image_url` non-empty), AND
 *   - the user has explicitly confirmed its tags (we store this as
 *     `attributes.verified === true`).
 *
 * Items without both are treated as DRAFT — they're fine for inventory, but
 * are excluded from *strict* outfit generation so we don't claim accurate
 * matches from category-only metadata.
 *
 * We intentionally store the flag inside the existing `attributes` JSONB
 * column for now (no migration). If this becomes hot enough, we promote it
 * to a real column in a future slice.
 */

export type VerificationStatus = 'draft' | 'verified';

export function isVerifiedItem(item: WardrobeItem): boolean {
  if (!item.image_url || !item.image_url.trim()) return false;
  const v = (item.attributes as Record<string, unknown> | undefined)?.verified;
  return v === true;
}

export function verificationStatus(item: WardrobeItem): VerificationStatus {
  return isVerifiedItem(item) ? 'verified' : 'draft';
}

/**
 * Merge the `verified: true` flag into an item's attributes without clobbering
 * other keys. Returns a patch-ready object (camelCase matches the API client).
 */
export function verifiedAttributesPatch(
  currentAttributes: Record<string, unknown> | undefined | null
): Record<string, unknown> {
  return { ...(currentAttributes ?? {}), verified: true };
}

export function draftAttributesPatch(
  currentAttributes: Record<string, unknown> | undefined | null
): Record<string, unknown> {
  const next = { ...(currentAttributes ?? {}) };
  delete next.verified;
  return next;
}

export function countVerified(items: WardrobeItem[]): {
  verified: number;
  draft: number;
} {
  let v = 0;
  let d = 0;
  for (const it of items) {
    if (isVerifiedItem(it)) v += 1;
    else d += 1;
  }
  return { verified: v, draft: d };
}
