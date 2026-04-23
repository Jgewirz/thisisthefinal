import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

vi.mock('../../lib/wardrobeApi', () => ({
  WARDROBE_CATEGORIES: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory', 'activewear'],
  createWardrobeItem: vi.fn(),
  updateWardrobeItem: vi.fn(),
  deleteWardrobeItem: vi.fn(),
  listWardrobe: vi.fn().mockResolvedValue([]),
}));

describe('EditWardrobeDialog (smoke)', () => {
  it('renders item details, photo control, and the Mark Ready action', async () => {
    const { EditWardrobeDialog } = await import('../components/EditWardrobeDialog');
    const html = renderToString(
      React.createElement(EditWardrobeDialog, {
        item: {
          id: 'w1',
          user_id: 'u1',
          image_url: null,
          category: 'top',
          subtype: 'tee',
          color: 'black',
          color_hex: null,
          pattern: null,
          seasons: [],
          occasions: [],
          warmth: null,
          attributes: {},
          created_at: '2026-04-22T00:00:00Z',
        },
        onClose: () => {},
      })
    );
    expect(html).toMatch(/aria-label="Edit wardrobe item"/);
    expect(html).toContain('Item details');
    expect(html).toContain('>Photo<');
    expect(html).toContain('>Category<');
    expect(html).toMatch(/Mark Ready/);
    expect(html).toMatch(/aria-label="Mark ready for outfits"/);
  });
});

