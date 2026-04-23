import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

// Keep the component render cheap and network-free.
vi.mock('react-router', () => ({
  Link: ({ children, to, ...rest }: any) =>
    React.createElement('a', { href: to, ...rest }, children),
}));

vi.mock('../../lib/wardrobeApi', () => ({
  WARDROBE_CATEGORIES: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory', 'activewear'],
  listWardrobe: vi.fn().mockResolvedValue([]),
  createWardrobeItem: vi.fn(),
  updateWardrobeItem: vi.fn(),
  deleteWardrobeItem: vi.fn(),
}));

// NOTE: Zustand v5's useStore uses `getInitialState()` as the SSR snapshot,
// so seeding via _setForTests is invisible inside renderToString. These smoke
// tests assert structural concerns only; item-sort / category-filter logic is
// covered directly in src/stores/__tests__/wardrobe.test.ts.

describe('WardrobeScreen (smoke)', () => {
  it('renders a back link to /style and an Add button', async () => {
    const { WardrobeScreen } = await import('../components/WardrobeScreen');
    const html = renderToString(React.createElement(WardrobeScreen));
    expect(html).toMatch(/href="\/style"/);
    expect(html).toMatch(/aria-label="Back to Style agent"/);
    expect(html).toContain('Wardrobe');
    expect(html).toContain('>Add<');
  });

  it('shows an empty state with an add CTA when there are no items', async () => {
    const { WardrobeScreen } = await import('../components/WardrobeScreen');
    const html = renderToString(React.createElement(WardrobeScreen));
    expect(html).toContain('No items in your wardrobe yet');
    expect(html).toContain('Add your first item');
  });

  it('renders a filter chip for "all" plus every canonical category', async () => {
    const { WardrobeScreen } = await import('../components/WardrobeScreen');
    const html = renderToString(React.createElement(WardrobeScreen));
    for (const c of [
      'all',
      'top',
      'bottom',
      'dress',
      'outerwear',
      'shoes',
      'accessory',
      'activewear',
    ]) {
      expect(html).toMatch(new RegExp(`>${c}<`));
    }
    // "all" starts selected.
    expect(html).toMatch(/aria-selected="true"[^>]*>all</);
  });

  it('exposes a tablist for filter chips for accessibility', async () => {
    const { WardrobeScreen } = await import('../components/WardrobeScreen');
    const html = renderToString(React.createElement(WardrobeScreen));
    expect(html).toMatch(/role="tablist"/);
    expect(html).toMatch(/aria-label="Filter by category"/);
  });
});
