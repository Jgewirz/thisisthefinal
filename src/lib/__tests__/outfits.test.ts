import { describe, expect, it } from 'vitest';
import { generateOutfits, type OutfitConstraints } from '../outfits';
import type { WardrobeItem, WardrobeCategory, WardrobeSeason, WardrobeWarmth } from '../wardrobeApi';

function mk(partial: Partial<WardrobeItem> & { id: string; category: WardrobeCategory }): WardrobeItem {
  // Default to a VERIFIED item (photo + verified flag) so the existing
  // composition / filter / scoring tests run under strict-by-default mode.
  // Draft-specific tests override image_url/attributes explicitly.
  return {
    id: partial.id,
    user_id: 'u1',
    image_url: `https://example.com/${partial.id}.jpg`,
    category: partial.category,
    subtype: null,
    color: null,
    color_hex: null,
    pattern: null,
    seasons: [] as WardrobeSeason[],
    occasions: [],
    warmth: null as WardrobeWarmth | null,
    attributes: { verified: true },
    created_at: '2026-04-20T00:00:00Z',
    ...partial,
  };
}

describe('generateOutfits — composition', () => {
  it('returns no outfits when the wardrobe has no top+bottom or dress', () => {
    const outfits = generateOutfits([
      mk({ id: 'sh', category: 'shoes', color: 'black' }),
      mk({ id: 'acc', category: 'accessory' }),
    ]);
    expect(outfits).toEqual([]);
  });

  it('builds a top+bottom combo when both exist', () => {
    const outfits = generateOutfits([
      mk({ id: 't1', category: 'top', color: 'white' }),
      mk({ id: 'b1', category: 'bottom', color: 'navy' }),
    ]);
    expect(outfits).toHaveLength(1);
    const ids = outfits[0].items.map((i) => i.id);
    expect(ids).toContain('t1');
    expect(ids).toContain('b1');
  });

  it('builds a dress-only combo', () => {
    const outfits = generateOutfits([mk({ id: 'd1', category: 'dress', color: 'black' })]);
    expect(outfits).toHaveLength(1);
    expect(outfits[0].items[0].id).toBe('d1');
  });

  it('produces one candidate per (top × bottom) pair, plus one per dress', () => {
    const wardrobe = [
      mk({ id: 't1', category: 'top' }),
      mk({ id: 't2', category: 'top' }),
      mk({ id: 'b1', category: 'bottom' }),
      mk({ id: 'b2', category: 'bottom' }),
      mk({ id: 'd1', category: 'dress' }),
    ];
    const outfits = generateOutfits(wardrobe);
    // 2 tops × 2 bottoms + 1 dress = 5
    expect(outfits).toHaveLength(5);
  });

  it('attaches shoes and accessories when available', () => {
    const outfits = generateOutfits([
      mk({ id: 't1', category: 'top', color: 'white' }),
      mk({ id: 'b1', category: 'bottom', color: 'black' }),
      mk({ id: 'sh', category: 'shoes', color: 'black' }),
      mk({ id: 'acc', category: 'accessory', color: 'gold' }),
    ]);
    const ids = outfits[0].items.map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(['t1', 'b1', 'sh', 'acc']));
  });

  it('warns when no shoes are available', () => {
    const [outfit] = generateOutfits([
      mk({ id: 't1', category: 'top' }),
      mk({ id: 'b1', category: 'bottom' }),
    ]);
    expect(outfit.warnings.some((w) => /shoes/i.test(w))).toBe(true);
  });
});

describe('generateOutfits — hard filters', () => {
  const base = [
    mk({ id: 't-sum', category: 'top', seasons: ['summer'] }),
    mk({ id: 't-win', category: 'top', seasons: ['winter'] }),
    mk({ id: 'b-any', category: 'bottom' }),
  ];

  it('filters tops by season when the tag is set', () => {
    const out = generateOutfits(base, { season: 'summer' });
    const topsUsed = out.map((o) => o.items[0].id);
    expect(topsUsed).toContain('t-sum');
    expect(topsUsed).not.toContain('t-win');
  });

  it('treats items with no season tags as wildcards', () => {
    const out = generateOutfits(
      [mk({ id: 't-any', category: 'top' }), mk({ id: 'b-any', category: 'bottom' })],
      { season: 'fall' }
    );
    expect(out).toHaveLength(1);
  });

  it('filters out items in avoidColors', () => {
    const out = generateOutfits(
      [
        mk({ id: 't-yellow', category: 'top', color: 'yellow' }),
        mk({ id: 't-blue', category: 'top', color: 'blue' }),
        mk({ id: 'b1', category: 'bottom' }),
      ],
      { avoidColors: ['Yellow'] }
    );
    const topsUsed = new Set(out.map((o) => o.items[0].id));
    expect(topsUsed.has('t-yellow')).toBe(false);
    expect(topsUsed.has('t-blue')).toBe(true);
  });

  it('filters by occasion when tagged, with untagged wildcards allowed', () => {
    const out = generateOutfits(
      [
        mk({ id: 't-work', category: 'top', occasions: ['work'] }),
        mk({ id: 't-gym', category: 'top', occasions: ['gym'] }),
        mk({ id: 't-any', category: 'top' }),
        mk({ id: 'b1', category: 'bottom' }),
      ],
      { occasion: 'work' }
    );
    const tops = out.map((o) => o.items[0].id);
    expect(tops).toContain('t-work');
    expect(tops).toContain('t-any');
    expect(tops).not.toContain('t-gym');
  });

  it('enforces warmth tolerance of ±1 tier', () => {
    const out = generateOutfits(
      [
        mk({ id: 't-light', category: 'top', warmth: 'light' }),
        mk({ id: 't-med', category: 'top', warmth: 'medium' }),
        mk({ id: 't-heavy', category: 'top', warmth: 'heavy' }),
        mk({ id: 'b1', category: 'bottom' }),
      ],
      { warmth: 'light' }
    );
    const tops = out.map((o) => o.items[0].id);
    expect(tops).toContain('t-light');
    expect(tops).toContain('t-med');
    expect(tops).not.toContain('t-heavy');
  });
});

describe('generateOutfits — scoring & rationale', () => {
  it('ranks palette-matching candidates higher', () => {
    const out = generateOutfits(
      [
        mk({ id: 't-navy', category: 'top', color: 'navy' }),
        mk({ id: 't-red', category: 'top', color: 'red' }),
        mk({ id: 'b-white', category: 'bottom', color: 'white' }),
      ],
      { colorPalette: ['navy', 'white'] }
    );
    expect(out[0].items.map((i) => i.id)).toContain('t-navy');
    expect(out[0].score).toBeGreaterThan(out[1].score);
    expect(out[0].reasons.some((r) => /palette/i.test(r))).toBe(true);
  });

  it('rewards outfits anchored with at least one neutral', () => {
    const [outfit] = generateOutfits([
      mk({ id: 't1', category: 'top', color: 'red' }),
      mk({ id: 'b1', category: 'bottom', color: 'black' }),
    ]);
    expect(outfit.reasons.some((r) => /neutral/i.test(r))).toBe(true);
  });

  it('mentions season, warmth, and occasion when they match', () => {
    const [outfit] = generateOutfits(
      [
        mk({
          id: 't1',
          category: 'top',
          seasons: ['winter'],
          warmth: 'heavy',
          occasions: ['work'],
        }),
        mk({
          id: 'b1',
          category: 'bottom',
          seasons: ['winter'],
          warmth: 'heavy',
          occasions: ['work'],
        }),
      ],
      { season: 'winter', warmth: 'heavy', occasion: 'work' }
    );
    const text = outfit.reasons.join(' | ');
    expect(text).toMatch(/winter/i);
    expect(text).toMatch(/heavy/i);
    expect(text).toMatch(/work/i);
  });

  it('caps score at 100', () => {
    const wardrobe = [
      mk({ id: 't', category: 'top', color: 'navy', warmth: 'medium', seasons: ['fall'], occasions: ['work'] }),
      mk({ id: 'b', category: 'bottom', color: 'white', warmth: 'medium', seasons: ['fall'], occasions: ['work'] }),
      mk({ id: 'sh', category: 'shoes', color: 'black', warmth: 'medium', seasons: ['fall'], occasions: ['work'] }),
      mk({ id: 'a', category: 'accessory', color: 'gold', warmth: 'medium', seasons: ['fall'], occasions: ['work'] }),
    ];
    const [outfit] = generateOutfits(wardrobe, {
      season: 'fall',
      warmth: 'medium',
      occasion: 'work',
      colorPalette: ['navy', 'white', 'black'],
    });
    expect(outfit.score).toBeLessThanOrEqual(100);
    expect(outfit.score).toBeGreaterThanOrEqual(80);
  });

  it('produces stable ids (piped item ids) for a given item selection', () => {
    const wardrobe = [
      mk({ id: 't1', category: 'top' }),
      mk({ id: 'b1', category: 'bottom' }),
    ];
    const [a] = generateOutfits(wardrobe);
    const [b] = generateOutfits(wardrobe);
    expect(a.id).toBe(b.id);
    expect(a.id.includes('|')).toBe(true);
  });

  it('honors the limit option', () => {
    const wardrobe: WardrobeItem[] = [];
    for (let i = 0; i < 5; i++) wardrobe.push(mk({ id: `t${i}`, category: 'top' }));
    for (let i = 0; i < 5; i++) wardrobe.push(mk({ id: `b${i}`, category: 'bottom' }));
    // 5×5 = 25 raw candidates
    const out = generateOutfits(wardrobe, { limit: 3 } as OutfitConstraints);
    expect(out).toHaveLength(3);
  });
});

describe('generateOutfits — outerwear heuristic', () => {
  it('auto-attaches outerwear in winter when available', () => {
    const [outfit] = generateOutfits(
      [
        mk({ id: 't1', category: 'top' }),
        mk({ id: 'b1', category: 'bottom' }),
        mk({ id: 'coat', category: 'outerwear', color: 'navy' }),
      ],
      { season: 'winter' }
    );
    expect(outfit.items.some((i) => i.id === 'coat')).toBe(true);
  });

  it('does not attach outerwear in summer by default', () => {
    const [outfit] = generateOutfits(
      [
        mk({ id: 't1', category: 'top' }),
        mk({ id: 'b1', category: 'bottom' }),
        mk({ id: 'coat', category: 'outerwear' }),
      ],
      { season: 'summer' }
    );
    expect(outfit.items.some((i) => i.id === 'coat')).toBe(false);
  });

  it('respects an explicit includeOuterwear=true and warns when wardrobe has none', () => {
    const [outfit] = generateOutfits(
      [mk({ id: 't1', category: 'top' }), mk({ id: 'b1', category: 'bottom' })],
      { includeOuterwear: true }
    );
    expect(outfit.warnings.some((w) => /outerwear/i.test(w))).toBe(true);
  });
});

describe('generateOutfits — strict vs explore mode', () => {
  const draftTop = mk({ id: 't-draft', category: 'top', image_url: null, attributes: {} });
  const unverifiedTop = mk({ id: 't-un', category: 'top', attributes: {} }); // has photo but not confirmed
  const verifiedBottom = mk({ id: 'b-ok', category: 'bottom' }); // default = verified

  it('strict mode (default) excludes items without a photo', () => {
    const out = generateOutfits([draftTop, verifiedBottom]);
    expect(out).toEqual([]);
  });

  it('strict mode excludes items with a photo but no verified flag', () => {
    const out = generateOutfits([unverifiedTop, verifiedBottom]);
    expect(out).toEqual([]);
  });

  it('explore mode includes drafts', () => {
    const out = generateOutfits([draftTop, verifiedBottom], { mode: 'explore' });
    expect(out).toHaveLength(1);
    const ids = out[0].items.map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(['t-draft', 'b-ok']));
  });

  it('strict mode still builds outfits when both base pieces are verified', () => {
    const verifiedTop = mk({ id: 't-ok', category: 'top' });
    const out = generateOutfits([verifiedTop, verifiedBottom]);
    expect(out).toHaveLength(1);
  });
});
