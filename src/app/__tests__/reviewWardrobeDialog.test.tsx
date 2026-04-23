import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';

describe('ReviewWardrobeDialog (smoke)', () => {
  it('renders photo, category, Save as Draft, and Mark Ready actions', async () => {
    const { ReviewWardrobeDialog } = await import('../components/ReviewWardrobeDialog');
    const html = renderToString(
      React.createElement(ReviewWardrobeDialog, {
        onClose: () => {},
      })
    );
    expect(html).toMatch(/role="dialog"/);
    expect(html).toMatch(/aria-label="Review wardrobe item"/);
    expect(html).toContain('Review');
    expect(html).toContain('>Photo<');
    expect(html).toContain('>Category<');
    expect(html).toContain('>Color<');
    expect(html).toContain('>Subtype<');
    expect(html).toContain('>Warmth<');
    expect(html).toContain('>Seasons<');
    expect(html).toContain('Save as Draft');
    expect(html).toContain('Mark Ready');
    expect(html).toMatch(/aria-label="Mark ready for outfits"/);
  });

  it('shows a preview when a prefilled image is passed', async () => {
    const { ReviewWardrobeDialog } = await import('../components/ReviewWardrobeDialog');
    const html = renderToString(
      React.createElement(ReviewWardrobeDialog, {
        onClose: () => {},
        imageUrl: 'data:image/png;base64,AAA',
      })
    );
    expect(html).toContain('data:image/png;base64,AAA');
    expect(html).toContain('Remove photo');
  });

  it('allows selecting any canonical category', async () => {
    const { ReviewWardrobeDialog } = await import('../components/ReviewWardrobeDialog');
    const html = renderToString(
      React.createElement(ReviewWardrobeDialog, {
        onClose: () => {},
      })
    );
    // category <option> values for every canonical category
    expect(html).toMatch(/<option[^>]*value="top"/);
    expect(html).toMatch(/<option[^>]*value="bottom"/);
    expect(html).toMatch(/<option[^>]*value="dress"/);
    expect(html).toMatch(/<option[^>]*value="outerwear"/);
    expect(html).toMatch(/<option[^>]*value="shoes"/);
    expect(html).toMatch(/<option[^>]*value="accessory"/);
    expect(html).toMatch(/<option[^>]*value="activewear"/);
  });
});
