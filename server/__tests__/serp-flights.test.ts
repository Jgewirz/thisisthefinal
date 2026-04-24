import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Stub amadeus module so buildGoogleFlightsUrl is predictable.
vi.mock('../services/amadeus.js', () => ({
  buildGoogleFlightsUrl: (p: any) => `https://google.com/flights?q=${p.origin}-${p.destination}`,
}));

const BASE_PARAMS = {
  origin: 'JFK',
  destination: 'LHR',
  departDate: '2026-05-01',
  adults: 2,
  currency: 'USD',
};

const SERP_RESPONSE = {
  best_flights: [
    {
      flights: [
        {
          departure_airport: { id: 'JFK', name: 'JFK', time: '2026-05-01 18:00' },
          arrival_airport: { id: 'LHR', name: 'Heathrow', time: '2026-05-02 06:30' },
          duration: 450,
          airline: 'United Airlines',
          flight_number: 'UA 901',
        },
      ],
      total_duration: 450,
      price: 432,
    },
  ],
  other_flights: [
    {
      flights: [
        {
          departure_airport: { id: 'JFK', time: '2026-05-01 22:00' },
          arrival_airport: { id: 'LHR', time: '2026-05-02 10:00' },
          duration: 480,
          airline: 'British Airways',
          flight_number: 'BA 112',
        },
      ],
      total_duration: 480,
      price: 389,
    },
  ],
};

describe('searchFlightsFallback', () => {
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
    const { searchFlightsFallback } = await import('../services/serpFlights.js');
    const result = await searchFlightsFallback(BASE_PARAMS);
    expect(result).toEqual([]);
  });

  it('maps SerpAPI best_flights and other_flights to FlightOffer[]', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(SERP_RESPONSE),
    });
    const { searchFlightsFallback } = await import('../services/serpFlights.js');
    const offers = await searchFlightsFallback(BASE_PARAMS, fakeFetch as any);

    expect(offers).toHaveLength(2);

    const first = offers[0]!;
    expect(first.id).toBe('serp_f_0');
    expect(first.priceTotal).toBe('432');
    expect(first.currency).toBe('USD');
    expect(first.itineraries).toHaveLength(1);
    expect(first.itineraries[0]!.durationMinutes).toBe(450);
    expect(first.itineraries[0]!.stops).toBe(0);
    expect(first.itineraries[0]!.segments[0]!.carrier).toBe('United Airlines');
    expect(first.itineraries[0]!.segments[0]!.flightNumber).toBe('UA 901');
    expect(first.itineraries[0]!.segments[0]!.from).toBe('JFK');
    expect(first.itineraries[0]!.segments[0]!.to).toBe('LHR');
    expect(first.itineraries[0]!.segments[0]!.departAt).toBe('2026-05-01T18:00:00');

    const second = offers[1]!;
    expect(second.priceTotal).toBe('389');
    expect(second.itineraries[0]!.segments[0]!.carrier).toBe('British Airways');
  });

  it('caps results at 8 offers', async () => {
    const manyFlights = Array.from({ length: 12 }, (_, i) => ({
      flights: [{ departure_airport: { id: 'X', time: '2026-05-01 10:00' }, arrival_airport: { id: 'Y', time: '2026-05-01 12:00' }, duration: 120, airline: 'Test', flight_number: `T${i}` }],
      total_duration: 120,
      price: 100 + i,
    }));
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ best_flights: manyFlights }),
    });
    const { searchFlightsFallback } = await import('../services/serpFlights.js');
    const offers = await searchFlightsFallback(BASE_PARAMS, fakeFetch as any);
    expect(offers).toHaveLength(8);
  });

  it('throws on non-ok HTTP response', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });
    const { searchFlightsFallback } = await import('../services/serpFlights.js');
    await expect(searchFlightsFallback(BASE_PARAMS, fakeFetch as any)).rejects.toThrow('SerpAPI flights 401');
  });

  it('throws immediately on a past departDate without calling the network', async () => {
    const fakeFetch = vi.fn();
    const { searchFlightsFallback } = await import('../services/serpFlights.js');
    await expect(
      searchFlightsFallback({ ...BASE_PARAMS, departDate: '2020-01-01' }, fakeFetch as any)
    ).rejects.toThrow(/in the past/);
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it('constructs the correct SerpAPI query string', async () => {
    let capturedUrl = '';
    const fakeFetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ best_flights: [] }) });
    });
    const { searchFlightsFallback } = await import('../services/serpFlights.js');
    await searchFlightsFallback({ ...BASE_PARAMS, returnDate: '2026-05-10' }, fakeFetch as any);

    expect(capturedUrl).toContain('engine=google_flights');
    expect(capturedUrl).toContain('departure_id=JFK');
    expect(capturedUrl).toContain('arrival_id=LHR');
    expect(capturedUrl).toContain('outbound_date=2026-05-01');
    expect(capturedUrl).toContain('return_date=2026-05-10');
    expect(capturedUrl).toContain('type=1');
    expect(capturedUrl).toContain('adults=2');
    expect(capturedUrl).toContain('api_key=test-serp-key');
  });

  it('uses one-way type=2 when returnDate is not provided', async () => {
    let capturedUrl = '';
    const fakeFetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ best_flights: [] }) });
    });
    const { searchFlightsFallback } = await import('../services/serpFlights.js');
    await searchFlightsFallback(BASE_PARAMS, fakeFetch as any);
    expect(capturedUrl).toContain('type=2');
    expect(capturedUrl).not.toContain('return_date=');
  });
});
