import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../services/hotelLinks.js', () => ({
  buildGoogleHotelsLink: (p: any) => ({ id: 'google', name: 'Google Hotels', url: `https://google.com/hotels?q=${p.cityCode}` }),
}));

const BASE_PARAMS = {
  cityCode: 'PAR',
  cityName: 'Paris',
  checkIn: '2026-05-01',
  checkOut: '2026-05-05',
  adults: 2,
  currency: 'EUR',
};

const SERP_RESPONSE = {
  properties: [
    {
      name: 'Hotel Lutetia',
      link: 'https://google.com/travel/hotels/entity/lutetia',
      gps_coordinates: { latitude: 48.849, longitude: 2.329 },
      rate_per_night: { extracted_lowest: 200, lowest: '€200' },
      total_rate: { extracted_lowest: 800, lowest: '€800' },
      overall_rating: 4.7,
      extracted_hotel_class: 5,
      hotel_id: 'hotel_lutetia_123',
      address: '45 Boulevard Raspail, Paris',
    },
    {
      name: 'CitizenM Paris',
      link: 'https://google.com/travel/hotels/entity/citizenm',
      rate_per_night: { extracted_lowest: 110 },
      total_rate: { extracted_lowest: 440 },
      overall_rating: 4.3,
      extracted_hotel_class: 4,
      hotel_id: 'hotel_citizenm_456',
    },
  ],
};

describe('searchHotelsFallback', () => {
  const origEnv = process.env.SERP_API_KEY;

  beforeEach(() => {
    vi.resetModules();
    process.env.SERP_API_KEY = 'test-serp-key';
  });

  afterEach(() => {
    process.env.SERP_API_KEY = origEnv;
    vi.restoreAllMocks();
  });

  it('returns [] immediately when SERP_API_KEY is not set', async () => {
    delete process.env.SERP_API_KEY;
    const { searchHotelsFallback } = await import('../services/serpHotels.js');
    const result = await searchHotelsFallback(BASE_PARAMS);
    expect(result).toEqual([]);
  });

  it('maps SerpAPI properties to HotelOffer[]', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(SERP_RESPONSE),
    });
    const { searchHotelsFallback } = await import('../services/serpHotels.js');
    const offers = await searchHotelsFallback(BASE_PARAMS, fakeFetch as any);

    expect(offers).toHaveLength(2);

    const first = offers[0]!;
    expect(first.id).toBe('hotel_lutetia_123');
    expect(first.hotelId).toBe('hotel_lutetia_123');
    expect(first.name).toBe('Hotel Lutetia');
    expect(first.cityName).toBe('Paris');
    expect(first.address).toBe('45 Boulevard Raspail, Paris');
    expect(first.priceTotal).toBe('800');
    expect(first.currency).toBe('EUR');
    expect(first.rating).toBe(5);
    expect(first.latitude).toBe(48.849);
    expect(first.checkIn).toBe('2026-05-01');
    expect(first.checkOut).toBe('2026-05-05');
    expect(first.bookingUrl).toBe('https://google.com/travel/hotels/entity/lutetia');

    const second = offers[1]!;
    expect(second.priceTotal).toBe('440');
    expect(second.rating).toBe(4);
  });

  it('caps results at 25 hotels', async () => {
    const manyProps = Array.from({ length: 40 }, (_, i) => ({
      name: `Hotel ${i}`,
      hotel_id: `h${i}`,
      total_rate: { extracted_lowest: 100 + i },
    }));
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ properties: manyProps }),
    });
    const { searchHotelsFallback } = await import('../services/serpHotels.js');
    const offers = await searchHotelsFallback(BASE_PARAMS, fakeFetch as any);
    expect(offers).toHaveLength(25);
  });

  it('throws on non-ok HTTP response', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Too Many Requests'),
    });
    const { searchHotelsFallback } = await import('../services/serpHotels.js');
    await expect(searchHotelsFallback(BASE_PARAMS, fakeFetch as any)).rejects.toThrow('SerpAPI hotels 429');
  });

  it('throws immediately on a past checkIn date without calling the network', async () => {
    const fakeFetch = vi.fn();
    const { searchHotelsFallback } = await import('../services/serpHotels.js');
    await expect(
      searchHotelsFallback({ ...BASE_PARAMS, checkIn: '2020-01-01', checkOut: '2020-01-05' }, fakeFetch as any)
    ).rejects.toThrow(/in the past/);
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it('constructs the correct SerpAPI query string', async () => {
    let capturedUrl = '';
    const fakeFetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ properties: [] }) });
    });
    const { searchHotelsFallback } = await import('../services/serpHotels.js');
    await searchHotelsFallback(BASE_PARAMS, fakeFetch as any);

    expect(capturedUrl).toContain('engine=google_hotels');
    expect(decodeURIComponent(capturedUrl.replace(/\+/g, ' '))).toContain('Hotels in Paris');
    expect(capturedUrl).toContain('check_in_date=2026-05-01');
    expect(capturedUrl).toContain('check_out_date=2026-05-05');
    expect(capturedUrl).toContain('adults=2');
    expect(capturedUrl).toContain('currency=EUR');
    expect(capturedUrl).toContain('api_key=test-serp-key');
  });
});
