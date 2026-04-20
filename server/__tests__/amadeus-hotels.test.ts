import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('amadeusHotels.searchHotels', () => {
  beforeEach(() => {
    process.env.AMADEUS_CLIENT_ID = 'cid';
    process.env.AMADEUS_CLIENT_SECRET = 'csec';
    delete process.env.AMADEUS_HOST;
  });
  afterEach(async () => {
    const { __resetAmadeusTokenCache } = await import('../services/amadeus.js');
    __resetAmadeusTokenCache();
    vi.restoreAllMocks();
  });

  function mockFetchFlow({
    hotelsBody,
    offersBody,
    hotelsStatus = 200,
    offersStatus = 200,
  }: {
    hotelsBody: any;
    offersBody: any;
    hotelsStatus?: number;
    offersStatus?: number;
  }) {
    return vi.fn(async (url: string) => {
      if (url.includes('/v1/security/oauth2/token')) {
        return new Response(
          JSON.stringify({ access_token: 'tok', expires_in: 1800 }),
          { status: 200 }
        );
      }
      if (url.includes('/v1/reference-data/locations/hotels/by-city')) {
        return new Response(JSON.stringify(hotelsBody), { status: hotelsStatus });
      }
      if (url.includes('/v3/shopping/hotel-offers')) {
        return new Response(JSON.stringify(offersBody), { status: offersStatus });
      }
      return new Response('not found', { status: 404 });
    });
  }

  it('returns priced offers, sorted: priced first then by cheapest', async () => {
    const fetchMock = mockFetchFlow({
      hotelsBody: {
        data: [
          { hotelId: 'H1', name: 'Hotel Uno', geoCode: { latitude: 1, longitude: 2 } },
          { hotelId: 'H2', name: 'Hotel Duo' },
          { hotelId: 'H3', name: 'Hotel Tres' },
        ],
      },
      offersBody: {
        data: [
          {
            hotel: {
              hotelId: 'H1',
              name: 'Hotel Uno',
              address: { lines: ['1 Rue'], cityName: 'Paris' },
              rating: 4,
              cityCode: 'PAR',
            },
            offers: [{ id: 'o1', price: { total: '220.00', currency: 'EUR' } }],
          },
          {
            hotel: {
              hotelId: 'H2',
              name: 'Hotel Duo',
              rating: '3',
              cityCode: 'PAR',
            },
            offers: [{ id: 'o2', price: { total: '150.00', currency: 'EUR' } }],
          },
          {
            hotel: { hotelId: 'H3', name: 'Hotel Tres', cityCode: 'PAR' },
            offers: [],
          },
        ],
      },
    });

    const { searchHotels } = await import('../services/amadeusHotels.js');
    const { offers, searchLink } = await searchHotels(
      {
        cityCode: 'par',
        cityName: 'Paris',
        checkIn: '2026-05-01',
        checkOut: '2026-05-05',
        adults: 2,
        rooms: 1,
        currency: 'eur',
      },
      fetchMock
    );

    // request shape: cityCode uppercased; offers URL has adults + currency clamps
    const urls = fetchMock.mock.calls.map((c: any[]) => String(c[0]));
    const hotelsByCityUrl = urls.find((u) => u.includes('by-city'))!;
    expect(hotelsByCityUrl).toContain('cityCode=PAR');
    const offersUrl = urls.find((u) => u.includes('hotel-offers'))!;
    expect(offersUrl).toContain('hotelIds=H1%2CH2%2CH3');
    expect(offersUrl).toContain('adults=2');
    expect(offersUrl).toContain('currency=EUR');
    expect(offersUrl).toContain('checkInDate=2026-05-01');
    expect(offersUrl).toContain('checkOutDate=2026-05-05');

    expect(offers).toHaveLength(3);
    // Priced ones first (H2 cheaper than H1), then the unpriced H3.
    expect(offers.map((o) => o.hotelId)).toEqual(['H2', 'H1', 'H3']);
    expect(offers[0]!.priceTotal).toBe('150.00');
    expect(offers[1]!.priceTotal).toBe('220.00');
    expect(offers[2]!.priceTotal).toBeUndefined();

    expect(offers[0]!.currency).toBe('EUR');
    expect(offers[1]!.address).toBe('1 Rue, Paris');
    expect(offers[1]!.rating).toBe(4);
    expect(offers[0]!.rating).toBe(3); // string "3" parsed to number

    expect(searchLink).toContain('google.com/travel/hotels?q=');
  });

  it('returns empty offers (no error) when hotels-by-city returns zero', async () => {
    const fetchMock = mockFetchFlow({
      hotelsBody: { data: [] },
      offersBody: { data: [] },
    });
    const { searchHotels } = await import('../services/amadeusHotels.js');
    const result = await searchHotels(
      {
        cityCode: 'ZZZ',
        checkIn: '2026-05-01',
        checkOut: '2026-05-05',
      },
      fetchMock
    );
    expect(result.offers).toEqual([]);
    expect(result.searchLink).toMatch(/^https:\/\/www\.google\.com\/travel\/hotels/);
    // Must NOT have called hotel-offers when there are no ids.
    const urls = fetchMock.mock.calls.map((c: any[]) => String(c[0]));
    expect(urls.some((u) => u.includes('hotel-offers'))).toBe(false);
  });

  it('throws a structured error when hotel-offers returns 4xx', async () => {
    const fetchMock = mockFetchFlow({
      hotelsBody: { data: [{ hotelId: 'H1', name: 'X' }] },
      offersBody: {
        errors: [{ title: 'Invalid input', detail: 'checkInDate must be in the future' }],
      },
      offersStatus: 400,
    });
    const { searchHotels } = await import('../services/amadeusHotels.js');
    await expect(
      searchHotels(
        { cityCode: 'PAR', checkIn: '2020-01-01', checkOut: '2020-01-02' },
        fetchMock
      )
    ).rejects.toThrow(/Amadeus 400.*Invalid input.*checkInDate/);
  });

  it('retries once on 5xx for hotels-by-city', async () => {
    let calls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('oauth2/token')) {
        return new Response(
          JSON.stringify({ access_token: 'tok', expires_in: 1800 }),
          { status: 200 }
        );
      }
      if (url.includes('by-city')) {
        calls += 1;
        if (calls === 1) {
          return new Response('', { status: 503 });
        }
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      return new Response('nope', { status: 404 });
    });
    const { searchHotels } = await import('../services/amadeusHotels.js');
    const result = await searchHotels(
      { cityCode: 'PAR', checkIn: '2026-05-01', checkOut: '2026-05-05' },
      fetchMock
    );
    expect(result.offers).toEqual([]);
    expect(calls).toBe(2);
  });
});
