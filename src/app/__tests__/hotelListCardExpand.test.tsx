import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

vi.mock('../components/SaveButton', () => ({
  SaveButton: () => React.createElement('div', null, 'Save'),
}));

describe('HotelListCard — expand control', () => {
  it('renders a "Show all" button when there are more than 8 offers', async () => {
    const offers = Array.from({ length: 12 }, (_, i) => ({
      id: `o${i}`,
      hotelId: `H${i}`,
      name: `Hotel ${i}`,
      cityName: 'Paris',
      address: 'Addr',
      rating: 4,
      priceTotal: '100',
      currency: 'EUR',
      checkIn: '2026-05-01',
      checkOut: '2026-05-05',
      bookingUrl: 'https://example.com',
    }));

    const { HotelListCard } = await import('../components/cards/HotelListCard');
    const html = renderToString(
      React.createElement(HotelListCard, {
        agentColor: '#ff00ff',
        data: {
          query: { cityCode: 'PAR', cityName: 'Paris', checkIn: '2026-05-01', checkOut: '2026-05-05' },
          offers,
          bookingLinks: [],
          searchLink: 'https://example.com/search',
        },
      })
    );

    expect(html).toContain('Show all (12)');
    expect(html).toMatch(/aria-label="Show all hotels"/);
  });
});

