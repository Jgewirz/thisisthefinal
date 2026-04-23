import type {
  WardrobeCategory,
  WardrobeItem,
  WardrobeSeason,
  WardrobeWarmth,
} from './wardrobeApi';
import { isVerifiedItem } from './wardrobeVerification';

/**
 * Pure, deterministic outfit generator.
 *
 * Takes a user's wardrobe and a set of constraints and returns ranked outfit
 * candidates with human-readable rationales. No LLM involvement: the logic
 * here is cheap, predictable, and trivially testable.
 *
 * Ranking rules (highest-level summary):
 *   - Hard filters: season / occasion / avoid-color / warmth (±1 tier)
 *   - Points for palette hits, neutrals anchoring non-neutrals, season match,
 *     warmth match, occasion tag match, and a closing accessory.
 */

export type Formality = 'casual' | 'smart-casual' | 'formal';

/**
 * `strict`  — only photo-backed, user-verified items qualify. This is the
 *             product default: we don't claim accurate outfits from category-
 *             only drafts.
 * `explore` — include drafts. UI must clearly label the result as lower-
 *             confidence so users don't mistake it for a grounded suggestion.
 */
export type OutfitMode = 'strict' | 'explore';

export interface OutfitConstraints {
  /** Casual tag like "work", "date", "gym", "brunch". Matches item.occasions. */
  occasion?: string;
  season?: WardrobeSeason;
  warmth?: WardrobeWarmth;
  formality?: Formality;
  /** If true, force-include outerwear; default is season/warmth-driven. */
  includeOuterwear?: boolean;
  /** Preferred color names (case-insensitive, e.g. "navy", "ivory"). */
  colorPalette?: string[];
  /** Colors to exclude entirely (case-insensitive). */
  avoidColors?: string[];
  /** Cap on returned candidates (default 12). */
  limit?: number;
  /** Default: 'strict'. See OutfitMode. */
  mode?: OutfitMode;
}

export interface Outfit {
  /** Deterministic id: pipe-joined item ids — stable across regenerations. */
  id: string;
  items: WardrobeItem[];
  /** 0–100. Used to sort candidates. */
  score: number;
  reasons: string[];
  warnings: string[];
}

const NEUTRALS = new Set([
  'black',
  'white',
  'ivory',
  'beige',
  'cream',
  'tan',
  'taupe',
  'gray',
  'grey',
  'charcoal',
  'navy',
  'denim',
]);

const DEFAULT_LIMIT = 12;

const WARMTH_RANK: Record<WardrobeWarmth, number> = {
  light: 0,
  medium: 1,
  heavy: 2,
};

/**
 * Public entry point. Returns outfits sorted by score descending; ties fall
 * back to the original wardrobe order so output is stable for a given input.
 */
export function generateOutfits(
  wardrobe: WardrobeItem[],
  constraints: OutfitConstraints = {}
): Outfit[] {
  const mode: OutfitMode = constraints.mode ?? 'strict';
  const pool = mode === 'strict' ? wardrobe.filter(isVerifiedItem) : wardrobe;
  const buckets = partition(pool);
  const tops = applyHardFilters(buckets.top, constraints);
  const bottoms = applyHardFilters(buckets.bottom, constraints);
  const dresses = applyHardFilters(buckets.dress, constraints);
  const outerwear = applyHardFilters(buckets.outerwear, constraints);
  const shoes = applyHardFilters(buckets.shoes, constraints);
  const accessories = applyHardFilters(buckets.accessory, constraints);

  const candidates: Outfit[] = [];

  for (const top of tops) {
    for (const bottom of bottoms) {
      candidates.push(
        buildOutfit([top, bottom], { outerwear, shoes, accessories }, constraints)
      );
    }
  }
  for (const dress of dresses) {
    candidates.push(
      buildOutfit([dress], { outerwear, shoes, accessories }, constraints)
    );
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, constraints.limit ?? DEFAULT_LIMIT);
}

function partition(items: WardrobeItem[]): Record<WardrobeCategory, WardrobeItem[]> {
  const base: Record<WardrobeCategory, WardrobeItem[]> = {
    top: [],
    bottom: [],
    dress: [],
    outerwear: [],
    shoes: [],
    accessory: [],
    activewear: [],
  };
  for (const it of items) base[it.category].push(it);
  return base;
}

function applyHardFilters(items: WardrobeItem[], c: OutfitConstraints): WardrobeItem[] {
  const avoid = new Set((c.avoidColors ?? []).map((x) => x.toLowerCase()));
  return items.filter((it) => {
    // Untagged items (empty seasons/occasions) are wildcards — they don't
    // exclude the item from consideration, just don't earn the bonus.
    if (c.season && it.seasons.length > 0 && !it.seasons.includes(c.season)) {
      return false;
    }
    if (c.occasion && it.occasions.length > 0 && !it.occasions.includes(c.occasion)) {
      return false;
    }
    if (it.color && avoid.has(it.color.toLowerCase())) return false;
    if (c.warmth && it.warmth) {
      // Allow within one tier (light vs medium OK, light vs heavy blocked).
      if (Math.abs(WARMTH_RANK[it.warmth] - WARMTH_RANK[c.warmth]) > 1) {
        return false;
      }
    }
    return true;
  });
}

interface Pools {
  outerwear: WardrobeItem[];
  shoes: WardrobeItem[];
  accessories: WardrobeItem[];
}

function buildOutfit(
  base: WardrobeItem[],
  pools: Pools,
  c: OutfitConstraints
): Outfit {
  const items: WardrobeItem[] = [...base];
  const warnings: string[] = [];

  if (shouldIncludeOuterwear(c)) {
    const picked = pickBestMatching(pools.outerwear, items, c);
    if (picked) items.push(picked);
    else if (c.includeOuterwear) {
      warnings.push('No outerwear in wardrobe — add a coat or jacket for cooler days');
    }
  }

  const shoe = pickBestMatching(pools.shoes, items, c);
  if (shoe) items.push(shoe);
  else warnings.push('No shoes in wardrobe for this outfit — consider adding some');

  const accessory = pickBestMatching(pools.accessories, items, c);
  if (accessory) items.push(accessory);

  const { score, reasons } = scoreOutfit(items, c);
  return {
    id: items.map((i) => i.id).join('|'),
    items,
    score,
    reasons,
    warnings,
  };
}

function shouldIncludeOuterwear(c: OutfitConstraints): boolean {
  if (c.includeOuterwear !== undefined) return c.includeOuterwear;
  if (c.warmth === 'heavy') return true;
  return c.season === 'fall' || c.season === 'winter';
}

function pickBestMatching(
  pool: WardrobeItem[],
  chosen: WardrobeItem[],
  c: OutfitConstraints
): WardrobeItem | null {
  if (pool.length === 0) return null;
  const chosenColors = new Set(
    chosen.map((i) => (i.color ?? '').toLowerCase()).filter(Boolean)
  );
  let best: { item: WardrobeItem; score: number } | null = null;
  for (const it of pool) {
    const s = colorAffinity(it.color, chosenColors, c);
    if (!best || s > best.score) best = { item: it, score: s };
  }
  return best?.item ?? null;
}

function colorAffinity(
  color: string | null,
  chosenColors: Set<string>,
  c: OutfitConstraints
): number {
  if (!color) return 0;
  const k = color.toLowerCase();
  const palette = new Set((c.colorPalette ?? []).map((x) => x.toLowerCase()));
  let s = 0;
  if (palette.has(k)) s += 3;
  if (NEUTRALS.has(k)) s += 2;
  for (const other of chosenColors) {
    if (NEUTRALS.has(other) || NEUTRALS.has(k)) s += 1;
    if (other === k) s += 0.5;
  }
  return s;
}

function scoreOutfit(
  items: WardrobeItem[],
  c: OutfitConstraints
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 60;

  const colors = items
    .map((i) => (i.color ?? '').toLowerCase())
    .filter(Boolean);
  const palette = new Set((c.colorPalette ?? []).map((x) => x.toLowerCase()));
  const paletteHits = colors.filter((x) => palette.has(x));

  if (paletteHits.length > 0) {
    score += Math.min(paletteHits.length, 3) * 6;
    reasons.push(`Hits your palette: ${[...new Set(paletteHits)].join(', ')}`);
  }

  const neutralCount = colors.filter((x) => NEUTRALS.has(x)).length;
  if (neutralCount >= 1 && colors.length >= 2) {
    score += 4;
    reasons.push('Anchored with neutrals — the pieces will flatter each other');
  }

  if (
    c.season &&
    items.every((i) => i.seasons.length === 0 || i.seasons.includes(c.season!))
  ) {
    score += 4;
    reasons.push(`All pieces work in ${c.season}`);
  }

  if (c.warmth && items.some((i) => i.warmth === c.warmth)) {
    score += 3;
    const label = c.warmth.charAt(0).toUpperCase() + c.warmth.slice(1);
    reasons.push(`${label}-weight layers for the temperature`);
  }

  if (c.occasion && items.some((i) => i.occasions.includes(c.occasion!))) {
    score += 3;
    reasons.push(`Pieces tagged for ${c.occasion}`);
  }

  if (items.some((i) => i.category === 'accessory')) {
    score += 2;
    reasons.push('Finished with an accessory');
  }

  return { score: Math.min(100, Math.round(score)), reasons };
}
