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

describe('AddWardrobeDialog (smoke)', () => {
  it('renders core form controls', async () => {
    const { AddWardrobeDialog } = await import('../components/AddWardrobeDialog');
    const html = renderToString(
      React.createElement(AddWardrobeDialog, { onClose: () => {} })
    );
    expect(html).toMatch(/role="dialog"/);
    expect(html).toMatch(/aria-label="Add wardrobe item"/);
    expect(html).toContain('>Photo<');
    expect(html).toContain('>Category<');
    expect(html).toContain('>Color<');
    expect(html).toContain('>Subtype<');
    expect(html).toContain('>Warmth<');
    expect(html).toContain('>Seasons<');
    expect(html).toContain('Save item');
  });

  it('renders the prefilled image when imageUrl is provided', async () => {
    const { AddWardrobeDialog } = await import('../components/AddWardrobeDialog');
    const html = renderToString(
      React.createElement(AddWardrobeDialog, {
        onClose: () => {},
        imageUrl: 'data:image/png;base64,AAA',
      })
    );
    expect(html).toMatch(/src="data:image\/png;base64,AAA"/);
  });

  it('does not render an image when imageUrl is omitted', async () => {
    const { AddWardrobeDialog } = await import('../components/AddWardrobeDialog');
    const html = renderToString(
      React.createElement(AddWardrobeDialog, { onClose: () => {} })
    );
    expect(html).not.toMatch(/<img\s/);
  });

  it('respects defaultCategory', async () => {
    const { AddWardrobeDialog } = await import('../components/AddWardrobeDialog');
    const html = renderToString(
      React.createElement(AddWardrobeDialog, {
        onClose: () => {},
        defaultCategory: 'shoes',
      })
    );
    // The <select> starts with the defaultCategory selected.
    expect(html).toMatch(/<option value="shoes" selected="">shoes<\/option>/);
  });
});
