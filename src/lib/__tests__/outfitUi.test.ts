import { describe, expect, it } from 'vitest';
import { explainEmptyOutfits } from '../outfitUi';
import type { OutfitConstraints } from '../outfits';
import type { WardrobeItem } from '../wardrobeApi';

function mk(
  category: WardrobeItem['category'],
  overrides: Partial<WardrobeItem> = {}
): WardrobeItem {
  // Default = verified so strict-mode branches aren't triggered accidentally.
  return {
    id: `${category}-${Math.random().toString(36).slice(2, 8)}`,
    user_id: 'u1',
    image_url: `https://x/${category}.jpg`,
    category,
    subtype: null,
    color: null,
    color_hex: null,
    pattern: null,
    seasons: [],
    occasions: [],
    warmth: null,
    attributes: { verified: true },
    created_at: '2026-04-20T00:00:00Z',
    ...overrides,
  };
}

describe('explainEmptyOutfits', () => {
  it('explains an empty wardrobe', () => {
    const out = explainEmptyOutfits([], {});
    expect(out.title).toMatch(/empty/i);
    expect(out.tips.join(' ')).toMatch(/top|bottom|dress/i);
  });

  it('explains missing base pieces when only accessories exist', () => {
    const out = explainEmptyOutfits([mk('shoes'), mk('accessory')], {});
    expect(out.title).toMatch(/not enough/i);
    expect(out.detail).toMatch(/top|bottom|dress/i);
  });

  it('explains filters being too strict when base pieces exist', () => {
    const wardrobe = [mk('top'), mk('bottom')];
    const constraints: OutfitConstraints = { season: 'winter', avoidColors: ['black'] };
    const out = explainEmptyOutfits(wardrobe, constraints);
    expect(out.title).toMatch(/filters/i);
    expect(out.tips.join(' ')).toMatch(/clear|remove/i);
  });

  it('falls back to a generic message when no filters are set but generation is impossible', () => {
    const wardrobe = [mk('top')]; // hasAnyPieces true but no base outfit.
    const out = explainEmptyOutfits(wardrobe, {});
    expect(out.title).toMatch(/not enough|couldn/i);
  });

  it('surfaces "no verified items" when the user only has drafts in strict mode', () => {
    const drafts = [
      mk('top', { image_url: null, attributes: {} }),
      mk('bottom', { image_url: null, attributes: {} }),
    ];
    const out = explainEmptyOutfits(drafts, { mode: 'strict' });
    expect(out.title).toMatch(/verified/i);
    expect(out.detail).toMatch(/draft/i);
    expect(out.tips.join(' ')).toMatch(/photo|explore/i);
  });

  it('falls back to the empty-wardrobe message in explore mode when nothing is there', () => {
    const out = explainEmptyOutfits([], { mode: 'explore' });
    expect(out.title).toMatch(/empty/i);
  });
});

