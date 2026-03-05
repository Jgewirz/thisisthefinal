// ── Google Places API (New) service ─────────────────────────────────────
// Uses the Places API (New) with field masks for cost-effective billing.
// Docs: https://developers.google.com/maps/documentation/places/web-service

const API_BASE = 'https://places.googleapis.com/v1';

// ── Types ───────────────────────────────────────────────────────────────

export interface GooglePlace {
  id: string;
  name: string;
  address: string;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: string | null;
  types: string[];
  phone: string | null;
  website: string | null;
  googleMapsUrl: string | null;
  openNow: boolean | null;
  photoUrl: string | null;
  editorialSummary: string | null;
}

export interface PlaceSearchParams {
  textQuery?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
  types?: string[];
  cityName?: string;
}

// ── Rate throttle (same pattern as amadeus.ts) ──────────────────────────

const REQUEST_WINDOW_MS = 1000;
const MAX_REQUESTS_PER_WINDOW = 10;
let requestTimestamps: number[] = [];

async function throttle(): Promise<void> {
  const now = Date.now();
  requestTimestamps = requestTimestamps.filter((t) => now - t < REQUEST_WINDOW_MS);
  if (requestTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldest = requestTimestamps[0];
    const waitMs = REQUEST_WINDOW_MS - (now - oldest) + 10;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  requestTimestamps.push(Date.now());
}

// ── Helpers ─────────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY is not set');
  return key;
}

export function isGooglePlacesConfigured(): boolean {
  return !!process.env.GOOGLE_PLACES_API_KEY;
}

const PRICE_LEVEL_MAP: Record<string, string> = {
  PRICE_LEVEL_FREE: 'Free',
  PRICE_LEVEL_INEXPENSIVE: '$',
  PRICE_LEVEL_MODERATE: '$$',
  PRICE_LEVEL_EXPENSIVE: '$$$',
  PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
};

// Field mask controls billing — only request what we display
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.types',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.currentOpeningHours',
  'places.photos',
  'places.editorialSummary',
].join(',');

function formatType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildPhotoUrl(photoName: string): string {
  // Point to our own proxy to avoid exposing the API key to the client
  return `/api/travel/places/photo?ref=${encodeURIComponent(photoName)}`;
}

function normalizePlace(raw: any): GooglePlace {
  const photoName = raw.photos?.[0]?.name || null;

  return {
    id: raw.id || '',
    name: raw.displayName?.text || 'Unknown',
    address: raw.formattedAddress || '',
    rating: raw.rating ?? null,
    reviewCount: raw.userRatingCount ?? null,
    priceLevel: raw.priceLevel ? (PRICE_LEVEL_MAP[raw.priceLevel] || null) : null,
    types: (raw.types || [])
      .filter((t: string) => !t.startsWith('point_of_interest') && t !== 'establishment')
      .slice(0, 4)
      .map(formatType),
    phone: raw.nationalPhoneNumber || null,
    website: raw.websiteUri || null,
    googleMapsUrl: raw.googleMapsUri || null,
    openNow: raw.currentOpeningHours?.openNow ?? null,
    photoUrl: photoName ? buildPhotoUrl(photoName) : null,
    editorialSummary: raw.editorialSummary?.text || null,
  };
}

// ── Search ──────────────────────────────────────────────────────────────

export async function searchPlaces(params: PlaceSearchParams): Promise<GooglePlace[]> {
  await throttle();
  const apiKey = getApiKey();

  // Decide: use Text Search (natural language) or Nearby Search (lat/lng + type)
  if (params.textQuery) {
    return textSearch(apiKey, params);
  }

  if (params.latitude != null && params.longitude != null) {
    return nearbySearch(apiKey, params);
  }

  return [];
}

async function textSearch(apiKey: string, params: PlaceSearchParams): Promise<GooglePlace[]> {
  const body: any = {
    textQuery: params.textQuery,
    maxResultCount: 6,
  };

  // Optional location bias for better results
  if (params.latitude != null && params.longitude != null) {
    body.locationBias = {
      circle: {
        center: { latitude: params.latitude, longitude: params.longitude },
        radius: (params.radius || 10) * 1000, // km → m
      },
    };
  }

  const res = await fetch(`${API_BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Places Text Search failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return (data.places || []).slice(0, 6).map(normalizePlace);
}

async function nearbySearch(apiKey: string, params: PlaceSearchParams): Promise<GooglePlace[]> {
  const body: any = {
    locationRestriction: {
      circle: {
        center: { latitude: params.latitude, longitude: params.longitude },
        radius: (params.radius || 5) * 1000, // km → m
      },
    },
    maxResultCount: 6,
  };

  if (params.types?.length) {
    body.includedTypes = params.types;
  }

  // Nearby Search uses a different field mask format (no "places." prefix)
  const nearbyFieldMask = FIELD_MASK.replace(/places\./g, 'places.');

  const res = await fetch(`${API_BASE}/places:searchNearby`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': nearbyFieldMask,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Places Nearby Search failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return (data.places || []).slice(0, 6).map(normalizePlace);
}

// ── Photo proxy helper ──────────────────────────────────────────────────

export async function fetchPlacePhoto(
  photoRef: string,
  maxWidth = 400
): Promise<{ buffer: Buffer; contentType: string }> {
  const apiKey = getApiKey();
  // Photo ref is the full resource name: places/{placeId}/photos/{photoRef}
  const url = `${API_BASE}/${photoRef}/media?maxWidthPx=${maxWidth}&key=${apiKey}`;

  const res = await fetch(url, { redirect: 'follow' });

  if (!res.ok) {
    throw new Error(`Google Places photo fetch failed (${res.status})`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || 'image/jpeg';

  return { buffer, contentType };
}
