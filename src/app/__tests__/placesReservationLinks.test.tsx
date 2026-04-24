import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

vi.mock('../components/SaveButton', () => ({
  SaveButton: () => React.createElement('div', null, 'Save'),
}));

describe('PlacesListCard — reservation links', () => {
  it('includes OpenTable and Resy links when query indicates reservation intent', async () => {
    const { PlacesListCard } = await import('../components/cards/PlacesListCard');
    const html = renderToString(
      React.createElement(PlacesListCard, {
        agentColor: '#00aaff',
        data: {
          query: 'reserve a restaurant tonight',
          places: [
            {
              id: 'p1',
              name: 'Sushi Place',
              address: 'Shibuya, Tokyo',
              rating: 4.6,
              userRatingCount: 120,
              googleMapsUri: 'https://maps.example',
              websiteUri: 'https://sushi.example',
            },
          ],
        },
      })
    );
    // Japan addresses prefer Japan-native reservation directories.
    expect(html).toContain('Tabelog');
    expect(html).toContain('Gurunavi');
    expect(html).toMatch(/aria-label="Search Sushi Place on Tabelog"/);
    expect(html).toMatch(/aria-label="Search Sushi Place on Gurunavi"/);
  });

  it('prefers the official reservation platform link when websiteUri is OpenTable', async () => {
    const { PlacesListCard } = await import('../components/cards/PlacesListCard');
    const html = renderToString(
      React.createElement(PlacesListCard, {
        agentColor: '#00aaff',
        data: {
          query: 'book a table tonight',
          places: [
            {
              id: 'p1',
              name: 'Sushi Place',
              address: 'Shibuya, Tokyo',
              googleMapsUri: 'https://maps.example',
              websiteUri: 'https://www.opentable.com/r/sushi-place-tokyo',
            },
          ],
        },
      })
    );
    expect(html).toMatch(/aria-label="Reserve Sushi Place on OpenTable"/);
    // When we have an official link, we avoid extra search-link clutter.
    expect(html).not.toContain('q=opentable');
    expect(html).not.toContain('q=resy');
    // Website chip should be hidden when it equals the reservation platform.
    expect(html).not.toContain('Website');
  });

  it('does not include OpenTable/Resy links for generic non-reservation queries', async () => {
    const { PlacesListCard } = await import('../components/cards/PlacesListCard');
    const html = renderToString(
      React.createElement(PlacesListCard, {
        agentColor: '#00aaff',
        data: {
          query: 'coffee shops',
          places: [
            { id: 'p1', name: 'Cafe', address: 'Tokyo', googleMapsUri: 'https://maps.example' },
          ],
        },
      })
    );
    expect(html).not.toContain('OpenTable');
    expect(html).not.toContain('Resy');
  });
});

