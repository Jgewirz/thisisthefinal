/**
 * Google Places API (v1) — Text Search wrapper.
 * https://developers.google.com/maps/documentation/places/web-service/text-search
 */

export interface Place {
  id: string;
  name: string;
  address: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  googleMapsUri?: string;
  websiteUri?: string;
  location?: { lat: number; lng: number };
}

export interface SearchPlacesOptions {
  lat?: number;
  lng?: number;
  radiusMeters?: number;
  maxResults?: number;
}

/** Build the Places v1 request body (pure function, easy to unit-test). */
export function buildSearchTextBody(query: string, opts: SearchPlacesOptions = {}) {
  const body: Record<string, unknown> = {
    textQuery: query,
    maxResultCount: Math.min(Math.max(opts.maxResults ?? 6, 1), 10),
  };
  if (typeof opts.lat === 'number' && typeof opts.lng === 'number') {
    body.locationBias = {
      circle: {
        center: { latitude: opts.lat, longitude: opts.lng },
        radius: Math.min(Math.max(opts.radiusMeters ?? 10_000, 100), 50_000),
      },
    };
  }
  return body;
}

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.googleMapsUri',
  'places.websiteUri',
  'places.location',
].join(',');

export async function searchPlaces(
  query: string,
  opts: SearchPlacesOptions = {},
  fetchImpl: typeof fetch = fetch
): Promise<Place[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY is not set');
  }

  const res = await fetchImpl('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(buildSearchTextBody(query, opts)),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { places?: any[] };
  return (data.places ?? []).map(
    (p): Place => ({
      id: String(p.id ?? ''),
      name: p.displayName?.text ?? 'Unknown',
      address: p.formattedAddress ?? '',
      rating: typeof p.rating === 'number' ? p.rating : undefined,
      userRatingCount: typeof p.userRatingCount === 'number' ? p.userRatingCount : undefined,
      priceLevel: typeof p.priceLevel === 'string' ? p.priceLevel : undefined,
      googleMapsUri: typeof p.googleMapsUri === 'string' ? p.googleMapsUri : undefined,
      websiteUri: typeof p.websiteUri === 'string' ? p.websiteUri : undefined,
      location:
        p.location && typeof p.location.latitude === 'number'
          ? { lat: p.location.latitude, lng: p.location.longitude }
          : undefined,
    })
  );
}
