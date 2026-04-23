import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';

describe('WardrobeCard — Ready/Draft badge', () => {
  it('shows Ready when item has photo + verified flag', async () => {
    const { WardrobeCard } = await import('../components/WardrobeCard');
    const html = renderToString(
      React.createElement(WardrobeCard, {
        item: {
          id: 'w1',
          user_id: 'u1',
          image_url: 'data:image/png;base64,AAA',
          category: 'top',
          subtype: null,
          color: null,
          color_hex: null,
          pattern: null,
          seasons: [],
          occasions: [],
          warmth: null,
          attributes: { verified: true },
          created_at: '2026-04-22T00:00:00Z',
        },
        onOpen: () => {},
        onDelete: () => {},
      })
    );
    expect(html).toContain('Ready');
    expect(html).toMatch(/aria-label="Ready for outfits"/);
  });

  it('shows Draft when item is missing the verification requirement', async () => {
    const { WardrobeCard } = await import('../components/WardrobeCard');
    const html = renderToString(
      React.createElement(WardrobeCard, {
        item: {
          id: 'w2',
          user_id: 'u1',
          image_url: null,
          category: 'top',
          subtype: null,
          color: null,
          color_hex: null,
          pattern: null,
          seasons: [],
          occasions: [],
          warmth: null,
          attributes: { verified: true },
          created_at: '2026-04-22T00:00:00Z',
        },
        onOpen: () => {},
        onDelete: () => {},
      })
    );
    expect(html).toContain('Draft');
    expect(html).toMatch(/aria-label="Draft item"/);
  });
});

