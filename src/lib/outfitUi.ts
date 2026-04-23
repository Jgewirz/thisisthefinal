import type { OutfitConstraints, OutfitMode } from './outfits';
import type { WardrobeItem } from './wardrobeApi';
import { countVerified, isVerifiedItem } from './wardrobeVerification';

export interface EmptyOutfitsExplanation {
  title: string;
  detail: string;
  tips: string[];
}

/**
 * Explain why the outfit list is empty in a user-actionable way.
 * Pure helper so UI isn't forced to replicate logic from the generator.
 */
export function explainEmptyOutfits(
  wardrobe: WardrobeItem[],
  constraints: OutfitConstraints
): EmptyOutfitsExplanation {
  const mode: OutfitMode = constraints.mode ?? 'strict';
  const pool = mode === 'strict' ? wardrobe.filter(isVerifiedItem) : wardrobe;
  const counts = countCategories(pool);
  const hasBasePieces = (counts.top > 0 && counts.bottom > 0) || counts.dress > 0;
  const hasAnyPieces = pool.length > 0;

  if (!hasAnyPieces) {
    // In strict mode, being empty usually means the user has drafts but no
    // verified items yet — surface that specifically so the fix is obvious.
    if (mode === 'strict' && wardrobe.length > 0) {
      const { draft } = countVerified(wardrobe);
      return {
        title: 'No verified items yet.',
        detail:
          `You have ${draft} draft item${draft === 1 ? '' : 's'} without photo-backed verification. ` +
          'Strict mode only uses items with a photo that you’ve confirmed.',
        tips: [
          'Open an item, add/confirm its photo, then mark it “Ready for outfits.”',
          'Or switch to Explore mode to see suggestions from drafts (lower confidence).',
        ],
      };
    }
    return {
      title: 'Your wardrobe is empty.',
      detail: 'Add a few pieces first, then come back to generate outfits.',
      tips: ['Start with one top + one bottom, or add a dress.'],
    };
  }

  if (!hasBasePieces) {
    const missing: string[] = [];
    if (counts.dress === 0) missing.push('a dress');
    if (counts.top === 0) missing.push('a top');
    if (counts.bottom === 0) missing.push('a bottom');
    return {
      title: 'Not enough base pieces to build an outfit.',
      detail:
        'Outfits need either (top + bottom) or a dress. Right now your wardrobe is missing ' +
        missing.join(', ') +
        '.',
      tips: [
        'Add at least 1 top and 1 bottom (or 1 dress).',
        'Shoes/accessories are optional — they help complete outfits but can’t form one alone.',
      ],
    };
  }

  const hasAnyFilters =
    Boolean(constraints.occasion) ||
    Boolean(constraints.season) ||
    Boolean(constraints.warmth) ||
    (constraints.avoidColors?.length ?? 0) > 0;

  if (hasAnyFilters) {
    return {
      title: 'No outfits match these filters.',
      detail:
        'Your wardrobe has enough pieces, but the current constraints filtered everything out.',
      tips: [
        'Clear season / warmth / occasion and try again.',
        'Remove avoid-colors (it can eliminate most pieces if colors are sparse).',
        'If items are untagged, leave season/warmth blank for best results.',
      ],
    };
  }

  // Catch-all: should be rare, but keep the UI honest.
  return {
    title: 'Couldn’t generate outfits from the current wardrobe.',
    detail: 'Try adding a dress, or add both a top and a bottom.',
    tips: ['If this keeps happening, refresh and try again.'],
  };
}

function countCategories(items: WardrobeItem[]) {
  const out = {
    top: 0,
    bottom: 0,
    dress: 0,
    outerwear: 0,
    shoes: 0,
    accessory: 0,
    activewear: 0,
  };
  for (const it of items) {
    // @ts-expect-error: exhaustive categories are known; fall through otherwise.
    if (out[it.category] !== undefined) out[it.category] += 1;
  }
  return out;
}

