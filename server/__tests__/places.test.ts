import { describe, it, expect, vi } from 'vitest';
import { buildSearchTextBody, searchPlaces } from '../services/places.js';

describe('buildSearchTextBody', () => {
  it('builds a plain textQuery body when no location is given', () => {
    const body = buildSearchTextBody('yoga class');
    expect(body).toEqual({ textQuery: 'yoga class', maxResultCount: 6 });
  });

  it('adds locationBias when lat/lng provided and clamps radius', () => {
    const body = buildSearchTextBody('italian restaurant', {
      lat: 40.7,
      lng: -74,
      radiusMeters: 99_999,
      maxResults: 20,
    }) as any;
    expect(body.textQuery).toBe('italian restaurant');
    expect(body.maxResultCount).toBe(10);
    expect(body.locationBias.circle.center).toEqual({ latitude: 40.7, longitude: -74 });
    expect(body.locationBias.circle.radius).toBe(50_000);
  });
});

describe('searchPlaces', () => {
  it('sends the API key header and parses results', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-key';

    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      new Response(
        JSON.stringify({
          places: [
            {
              id: 'a',
              displayName: { text: 'Sunrise Yoga' },
              formattedAddress: '1 Main St',
              rating: 4.8,
              userRatingCount: 120,
              priceLevel: 'PRICE_LEVEL_MODERATE',
              googleMapsUri: 'https://maps.google.com/?cid=1',
              websiteUri: 'https://sunrise.example',
              location: { latitude: 1, longitude: 2 },
            },
          ],
        }),
        { status: 200 }
      )
    );

    const results = await searchPlaces('yoga', { lat: 1, lng: 2 }, fetchMock as any);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain('places.googleapis.com');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['X-Goog-Api-Key']).toBe('test-key');
    expect(headers['X-Goog-FieldMask']).toContain('places.displayName');

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'a',
      name: 'Sunrise Yoga',
      rating: 4.8,
      location: { lat: 1, lng: 2 },
    });
  });

  it('throws a helpful error when the key is missing', async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    await expect(searchPlaces('yoga')).rejects.toThrow(/GOOGLE_PLACES_API_KEY/);
  });

  it('throws on non-200 responses', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-key';
    const fetchMock = vi.fn(async () => new Response('nope', { status: 403 }));
    await expect(searchPlaces('yoga', {}, fetchMock as any)).rejects.toThrow(/Places API 403/);
  });
});
