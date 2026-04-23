import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

vi.mock('../components/SaveButton', () => ({
  SaveButton: () => React.createElement('div', null, 'Save'),
}));

describe('ClassListCard — expand control', () => {
  it('renders a "Show all" button when there are more than 5 studios', async () => {
    const studios = Array.from({ length: 9 }, (_, i) => ({
      id: `s${i}`,
      name: `Studio ${i}`,
      address: 'Addr',
      websiteUri: 'https://example.com',
      rating: 4.2,
    }));

    const { ClassListCard } = await import('../components/cards/ClassListCard');
    const html = renderToString(
      React.createElement(ClassListCard, {
        agentColor: '#00aaff',
        data: {
          query: { activity: 'yoga', cityName: 'Paris', when: 'tomorrow 8am' },
          studios,
          aggregatorLinks: [
            { id: 'classpass', name: 'ClassPass', url: 'https://classpass.com/search?q=yoga' },
            { id: 'mindbody', name: 'Mindbody', url: 'https://explore.mindbodyonline.com/search?search_text=yoga' },
            { id: 'googlemaps', name: 'Google Maps', url: 'https://www.google.com/maps/search/?query=yoga' },
          ],
        },
      })
    );

    expect(html).toContain('Show all (9)');
    expect(html).toMatch(/aria-label="Show all studios"/);
  });
});

