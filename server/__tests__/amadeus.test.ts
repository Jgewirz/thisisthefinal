import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildGoogleFlightsUrl,
  getAccessToken,
  searchFlights,
  __resetAmadeusTokenCache,
  getAmadeusHost,
} from '../services/amadeus.js';

function makeResp(status: number, body: unknown): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as Response;
}

describe('amadeus service', () => {
  beforeEach(() => {
    __resetAmadeusTokenCache();
    process.env.AMADEUS_CLIENT_ID = 'cid';
    process.env.AMADEUS_CLIENT_SECRET = 'csec';
    delete process.env.AMADEUS_HOST;
  });

  it('builds a Google Flights fallback URL', () => {
    const url = buildGoogleFlightsUrl({
      origin: 'JFK',
      destination: 'LHR',
      departDate: '2026-05-01',
      returnDate: '2026-05-10',
      adults: 2,
    });
    expect(url).toMatch(/^https:\/\/www\.google\.com\/travel\/flights\?q=/);
    const decoded = decodeURIComponent(url.split('q=')[1]!);
    expect(decoded).toContain('Flights from JFK to LHR on 2026-05-01');
    expect(decoded).toContain('through 2026-05-10');
    expect(decoded).toContain('2 adults');
  });

  it('fetches and caches the access token', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.method).toBe('POST');
      expect((init?.headers as any)['Content-Type']).toBe('application/x-www-form-urlencoded');
      const body = (init?.body as URLSearchParams).toString();
      expect(body).toContain('grant_type=client_credentials');
      expect(body).toContain('client_id=cid');
      return makeResp(200, { access_token: 'abc', expires_in: 1799 });
    });

    const now = () => 1_000_000;
    const t1 = await getAccessToken(fetchMock as any, now);
    const t2 = await getAccessToken(fetchMock as any, now);
    expect(t1).toBe('abc');
    expect(t2).toBe('abc');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws a clear error when auth fails', async () => {
    const fetchMock = vi.fn(async () => makeResp(401, 'bad creds'));
    await expect(getAccessToken(fetchMock as any)).rejects.toThrow(/Amadeus auth 401/);
  });

  it('searches flight offers and parses them', async () => {
    const fetchMock = vi
      .fn()
      // token
      .mockResolvedValueOnce(makeResp(200, { access_token: 'tok', expires_in: 1799 }))
      // flight-offers
      .mockResolvedValueOnce(
        makeResp(200, {
          data: [
            {
              id: '1',
              price: { total: '432.10', currency: 'USD' },
              itineraries: [
                {
                  duration: 'PT12H30M',
                  segments: [
                    {
                      carrierCode: 'UA',
                      number: '901',
                      departure: { iataCode: 'JFK', at: '2026-05-01T18:00:00' },
                      arrival: { iataCode: 'LHR', at: '2026-05-02T06:30:00' },
                      duration: 'PT12H30M',
                    },
                  ],
                },
              ],
            },
          ],
        })
      );

    const result = await searchFlights(
      { origin: 'jfk', destination: 'lhr', departDate: '2026-05-01', adults: 2 },
      fetchMock as any
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const url = fetchMock.mock.calls[1]![0] as string;
    expect(url).toContain(`https://${getAmadeusHost()}/v2/shopping/flight-offers?`);
    expect(url).toContain('originLocationCode=JFK');
    expect(url).toContain('destinationLocationCode=LHR');
    expect(url).toContain('departureDate=2026-05-01');
    expect(url).toContain('adults=2');
    expect(url).toContain('currencyCode=USD');

    const [, init] = fetchMock.mock.calls[1]!;
    const authHeader = ((init as RequestInit).headers as Record<string, string>).Authorization;
    expect(authHeader).toBe('Bearer tok');

    expect(result.offers).toHaveLength(1);
    expect(result.offers[0]).toMatchObject({
      id: '1',
      priceTotal: '432.10',
      currency: 'USD',
    });
    expect(result.offers[0]!.itineraries[0]!.durationMinutes).toBe(750);
    expect(result.offers[0]!.itineraries[0]!.stops).toBe(0);
    expect(result.offers[0]!.itineraries[0]!.segments[0]).toMatchObject({
      carrier: 'UA',
      flightNumber: 'UA901',
      from: 'JFK',
      to: 'LHR',
    });
    expect(result.searchLink).toContain('google.com/travel/flights');
  });

  it('clamps max results and forwards nonStop + returnDate', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResp(200, { access_token: 'tok', expires_in: 1799 }))
      .mockResolvedValueOnce(makeResp(200, { data: [] }));

    await searchFlights(
      {
        origin: 'SFO',
        destination: 'HND',
        departDate: '2026-06-01',
        returnDate: '2026-06-10',
        max: 99,
        nonStop: true,
      },
      fetchMock as any
    );

    const url = fetchMock.mock.calls[1]![0] as string;
    expect(url).toContain('max=10');
    expect(url).toContain('nonStop=true');
    expect(url).toContain('returnDate=2026-06-10');
  });

  it('surfaces Amadeus errors with status and body snippet', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResp(200, { access_token: 'tok', expires_in: 1799 }))
      .mockResolvedValueOnce(makeResp(400, 'invalid origin'));

    await expect(
      searchFlights(
        { origin: 'ZZZ', destination: 'LHR', departDate: '2026-05-01' },
        fetchMock as any
      )
    ).rejects.toThrow(/Amadeus flight-offers 400.*invalid origin/);
  });

  it('unwraps Amadeus structured error payloads', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResp(200, { access_token: 'tok', expires_in: 1799 }))
      .mockResolvedValueOnce(
        makeResp(400, {
          errors: [
            { code: 477, title: 'INVALID FORMAT', detail: 'invalid date', status: 400 },
          ],
        })
      );
    await expect(
      searchFlights(
        { origin: 'JFK', destination: 'LHR', departDate: 'nope' },
        fetchMock as any
      )
    ).rejects.toThrow(/INVALID FORMAT — invalid date/);
  });

  it('retries once on 5xx from flight-offers', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResp(200, { access_token: 'tok', expires_in: 1799 }))
      .mockResolvedValueOnce(makeResp(500, ''))
      .mockResolvedValueOnce(makeResp(200, { data: [] }));

    const result = await searchFlights(
      { origin: 'JFK', destination: 'LHR', departDate: '2026-05-01' },
      fetchMock as any
    );
    expect(result.offers).toEqual([]);
    // token + first flight-offers + retry = 3 calls
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('flags empty-response 5xx clearly', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResp(200, { access_token: 'tok', expires_in: 1799 }))
      .mockResolvedValueOnce(makeResp(500, ''))
      .mockResolvedValueOnce(makeResp(500, ''));
    await expect(
      searchFlights(
        { origin: 'JFK', destination: 'LHR', departDate: '2026-05-01' },
        fetchMock as any
      )
    ).rejects.toThrow(/Amadeus flight-offers 500 \(empty response\)/);
  });
});
