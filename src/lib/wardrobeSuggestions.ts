import type {
  CreateWardrobePayload,
  WardrobeCategory,
  WardrobeSeason,
  WardrobeWarmth,
} from './wardrobeApi';

/**
 * Pure helpers that turn a raw `/api/style/analyze` (type=clothing_tag)
 * response into editable defaults for the Review screen.
 *
 * The server's LLM response shape (see server/services/anthropic.ts) is:
 *   { category, color, colorHex, style, seasons[], occasions[], pairsWith[] }
 * but LLM output is never fully trusted, so every field here is validated and
 * silently dropped if it doesn't match our canonical enums.
 */

const VALID_CATEGORIES: readonly WardrobeCategory[] = [
  'top',
  'bottom',
  'dress',
  'outerwear',
  'shoes',
  'accessory',
  'activewear',
];

const VALID_SEASONS: readonly WardrobeSeason[] = ['spring', 'summer', 'fall', 'winter'];

export interface WardrobeSuggestion {
  category: WardrobeCategory;
  subtype: string | null;
  color: string | null;
  colorHex: string | null;
  seasons: WardrobeSeason[];
  warmth: WardrobeWarmth | null;
  occasions: string[];
}

/**
 * Convert an analysis response into a defensively-typed suggestion object.
 * Unknown/invalid fields fall back to sensible blank defaults so users see
 * controls they can fill in rather than garbage.
 */
export function suggestFromClothingAnalysis(result: unknown): WardrobeSuggestion {
  const r = (result ?? {}) as Record<string, unknown>;

  const category = VALID_CATEGORIES.includes(r.category as WardrobeCategory)
    ? (r.category as WardrobeCategory)
    : 'top';

  const color = typeof r.color === 'string' && r.color.trim() ? r.color.trim().toLowerCase() : null;

  const colorHex =
    typeof r.colorHex === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(r.colorHex) ? r.colorHex : null;

  const seasons = Array.isArray(r.seasons)
    ? (r.seasons.filter((s): s is WardrobeSeason =>
        typeof s === 'string' && VALID_SEASONS.includes(s as WardrobeSeason)
      ) as WardrobeSeason[])
    : [];

  const occasions = Array.isArray(r.occasions)
    ? r.occasions.filter((o): o is string => typeof o === 'string' && o.trim().length > 0)
    : [];

  // Warmth isn't directly returned; infer a sensible default from style/season.
  const warmth = inferWarmth(r.style, seasons);

  // No subtype in the server response; leave blank so user can add it.
  return {
    category,
    subtype: null,
    color,
    colorHex,
    seasons,
    warmth,
    occasions,
  };
}

function inferWarmth(style: unknown, seasons: WardrobeSeason[]): WardrobeWarmth | null {
  const hasWinter = seasons.includes('winter');
  const hasFall = seasons.includes('fall');
  const hasSummer = seasons.includes('summer');
  if (hasWinter) return 'heavy';
  if (hasFall) return 'medium';
  if (hasSummer) return 'light';
  // No strong signal from seasons — check style label.
  if (typeof style === 'string') {
    if (/athleisure|sport/i.test(style)) return 'light';
    if (/business|formal/i.test(style)) return 'medium';
  }
  return null;
}

/**
 * Convert a suggestion + user-edited overrides into a ready-to-POST payload.
 * `verified` controls whether we set `attributes.verified = true`.
 */
export function suggestionToPayload(
  suggestion: WardrobeSuggestion,
  imageUrl: string | null,
  verified: boolean
): CreateWardrobePayload {
  return {
    imageUrl,
    category: suggestion.category,
    subtype: suggestion.subtype,
    color: suggestion.color,
    colorHex: suggestion.colorHex,
    seasons: suggestion.seasons,
    occasions: suggestion.occasions,
    warmth: suggestion.warmth,
    attributes: verified ? { verified: true } : {},
  };
}
