import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

vi.mock('react-router', () => ({
  Link: ({ children, to, ...rest }: any) =>
    React.createElement('a', { href: to, ...rest }, children),
}));

vi.mock('../../stores/wardrobe', () => ({
  useWardrobeStore: (sel: any) =>
    sel({
      byId: {},
      loaded: false,
      loading: true,
      error: null,
      load: () => Promise.resolve(),
    }),
}));

vi.mock('../../stores/outfitSaves', () => ({
  useOutfitSavesStore: (sel?: any) => {
    const store = {
      savedIds: {},
      isSaved: () => false,
      toggle: () => {},
      clear: () => {},
      getState: () => ({ isSaved: () => false }),
    };
    return sel ? sel(store) : store;
  },
}));

vi.mock('../../lib/wardrobeApi', () => ({
  WARDROBE_CATEGORIES: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory', 'activewear'],
  listWardrobe: vi.fn().mockResolvedValue([]),
  createWardrobeItem: vi.fn(),
  updateWardrobeItem: vi.fn(),
  deleteWardrobeItem: vi.fn(),
}));

// NOTE: Zustand v5 uses getInitialState() as SSR snapshot, so seeding via
// _setForTests is invisible to renderToString. These smoke tests assert
// structural concerns only — generator + sort logic is covered in
// src/lib/__tests__/outfits.test.ts.

describe('OutfitBuilderScreen (smoke)', () => {
  it('renders a back link to /wardrobe and the header', async () => {
    const { OutfitBuilderScreen } = await import('../components/OutfitBuilderScreen');
    const html = renderToString(React.createElement(OutfitBuilderScreen));
    expect(html).toMatch(/href="\/wardrobe"/);
    expect(html).toMatch(/aria-label="Back to wardrobe"/);
    expect(html).toContain('Outfit Builder');
  });

  it('renders the constraint form with all controls', async () => {
    const { OutfitBuilderScreen } = await import('../components/OutfitBuilderScreen');
    const html = renderToString(React.createElement(OutfitBuilderScreen));
    expect(html).toMatch(/aria-label="Outfit constraints"/);
    // Labels use CSS `uppercase` — the DOM text keeps original casing.
    expect(html).toContain('>Occasion<');
    expect(html).toContain('>Season<');
    expect(html).toContain('>Warmth<');
    expect(html).toContain('>Preferred colors<');
    expect(html).toContain('>Avoid colors<');
  });

  it('renders Strict / Explore mode toggle buttons', async () => {
    const { OutfitBuilderScreen } = await import('../components/OutfitBuilderScreen');
    const html = renderToString(React.createElement(OutfitBuilderScreen));
    expect(html).toMatch(/aria-label="Outfit mode"/);
    expect(html).toContain('>strict<');
    expect(html).toContain('>explore<');
    // Strict is pressed by default.
    expect(html).toMatch(/aria-pressed="true"[^>]*>strict</);
  });

  it('uses a mobile-first layout (season/warmth stack, then two columns on sm+)', async () => {
    const { OutfitBuilderScreen } = await import('../components/OutfitBuilderScreen');
    const html = renderToString(React.createElement(OutfitBuilderScreen));
    expect(html).toContain('grid-cols-1');
    expect(html).toContain('sm:grid-cols-2');
  });

  it('renders occasion suggestion chips with aria-pressed', async () => {
    const { OutfitBuilderScreen } = await import('../components/OutfitBuilderScreen');
    const html = renderToString(React.createElement(OutfitBuilderScreen));
    for (const o of ['work', 'casual', 'date', 'gym', 'formal']) {
      expect(html).toMatch(new RegExp(`>${o}<`));
    }
    expect(html).toMatch(/aria-pressed="false"/);
  });

  it('renders every season and warmth chip', async () => {
    const { OutfitBuilderScreen } = await import('../components/OutfitBuilderScreen');
    const html = renderToString(React.createElement(OutfitBuilderScreen));
    for (const s of ['spring', 'summer', 'fall', 'winter']) {
      expect(html).toMatch(new RegExp(`>${s}<`));
    }
    for (const w of ['light', 'medium', 'heavy']) {
      expect(html).toMatch(new RegExp(`>${w}<`));
    }
  });

  it('renders a Regenerate button', async () => {
    const { OutfitBuilderScreen } = await import('../components/OutfitBuilderScreen');
    const html = renderToString(React.createElement(OutfitBuilderScreen));
    expect(html).toContain('Regenerate');
  });

  it('shows the empty-wardrobe CTA linking back to /wardrobe', async () => {
    const { OutfitBuilderScreen } = await import('../components/OutfitBuilderScreen');
    const html = renderToString(React.createElement(OutfitBuilderScreen));
    expect(html).toContain('Add a few pieces to your wardrobe');
    expect(html.match(/href="\/wardrobe"/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('includes a loading affordance label for wardrobe load', async () => {
    const { OutfitBuilderScreen } = await import('../components/OutfitBuilderScreen');
    const html = renderToString(React.createElement(OutfitBuilderScreen));
    expect(html).toMatch(/aria-label="Loading wardrobe"/);
  });
});
