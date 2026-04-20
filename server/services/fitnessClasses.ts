/**
 * Grounded fitness-class discovery.
 *
 * Neither Mindbody nor ClassPass expose a self-service public schedule API
 * (Mindbody requires a partner key + per-studio activation; ClassPass has
 * no public API at all). So instead of inventing class times, we:
 *
 *   1. Use Google Places to find real studios matching the activity
 *      (yoga, pilates, barre, spin, boxing, HIIT, gym) near the user.
 *   2. Emit deterministic aggregator deep-links (ClassPass + Mindbody +
 *      Google Maps) pre-filled with the activity + city/location so the
 *      user can see real, live schedules on the vendor site in one click.
 *
 * Every piece of grounded data comes from a real API or a deterministic
 * builder; the LLM is not allowed to invent studio names, times, or prices.
 */
import { searchPlaces, type Place, type SearchPlacesOptions } from './places.js';

export interface FitnessClassSearchParams {
  activity: string;               // "yoga" | "pilates" | "barre" | "spin" | "cycling" | "hiit" | "boxing" | "gym" | free-form
  location: { lat: number; lng: number };
  cityName?: string;              // best-effort human-readable
  when?: string;                  // free-form "tomorrow 8am", "Sat evening" (passed through, not parsed)
  radiusMeters?: number;
  maxStudios?: number;
}

export interface FitnessAggregatorLink {
  id: 'classpass' | 'mindbody' | 'googlemaps';
  name: string;
  url: string;
}

export interface FitnessClassSearchResult {
  activity: string;
  when?: string;
  cityName?: string;
  studios: Place[];
  aggregatorLinks: FitnessAggregatorLink[];
}

/** Normalized activity label for URL slugs + query phrasing. */
export function normalizeActivity(raw: string): string {
  const a = (raw || '').toLowerCase().trim();
  if (!a) return 'fitness';
  if (/\byoga\b/.test(a)) return 'yoga';
  if (/\bpilates\b/.test(a)) return 'pilates';
  if (/\bbarre\b/.test(a)) return 'barre';
  if (/\bspin|cycl/.test(a)) return 'cycling';
  if (/\bhiit|bootcamp/.test(a)) return 'hiit';
  if (/\bbox|kickbox|muay/.test(a)) return 'boxing';
  if (/\bdance|zumba/.test(a)) return 'dance';
  if (/\bcrossfit\b/.test(a)) return 'crossfit';
  if (/\bclimb/.test(a)) return 'climbing';
  if (/\bswim/.test(a)) return 'swimming';
  if (/\bgym|strength|lift/.test(a)) return 'gym';
  return a.replace(/[^a-z0-9]+/g, ' ').trim() || 'fitness';
}

/**
 * Build the Places text query for the given activity. We deliberately phrase
 * it as "{activity} studio" so Google returns actual studios/gyms, not blog
 * posts or retail stores.
 */
export function activityToPlacesQuery(activity: string): string {
  const a = normalizeActivity(activity);
  if (a === 'gym') return 'gym';
  if (a === 'climbing') return 'climbing gym';
  if (a === 'swimming') return 'swimming pool';
  if (a === 'crossfit') return 'crossfit gym';
  return `${a} studio`;
}

function where(p: FitnessClassSearchParams): string {
  if (p.cityName && p.cityName.trim()) return p.cityName.trim();
  return `${p.location.lat.toFixed(4)},${p.location.lng.toFixed(4)}`;
}

/** ClassPass search (works with a free-form `q` param + fallback to /search). */
export function buildClasspassLink(p: FitnessClassSearchParams): FitnessAggregatorLink {
  const activity = normalizeActivity(p.activity);
  const qs = new URLSearchParams({ q: `${activity} ${where(p)}`.trim() });
  return {
    id: 'classpass',
    name: 'ClassPass',
    url: `https://classpass.com/search?${qs.toString()}`,
  };
}

/** Mindbody consumer explorer — free-text search with location hint. */
export function buildMindbodyLink(p: FitnessClassSearchParams): FitnessAggregatorLink {
  const activity = normalizeActivity(p.activity);
  const qs = new URLSearchParams({
    search_text: activity,
    location: where(p),
  });
  return {
    id: 'mindbody',
    name: 'Mindbody',
    url: `https://explore.mindbodyonline.com/search?${qs.toString()}`,
  };
}

/** Google Maps search — safest universal fallback; always resolves. */
export function buildGoogleMapsLink(p: FitnessClassSearchParams): FitnessAggregatorLink {
  const activity = normalizeActivity(p.activity);
  const qs = new URLSearchParams({
    api: '1',
    query: `${activity} ${where(p)}`.trim(),
  });
  return {
    id: 'googlemaps',
    name: 'Google Maps',
    url: `https://www.google.com/maps/search/?${qs.toString()}`,
  };
}

export function buildAggregatorLinks(p: FitnessClassSearchParams): FitnessAggregatorLink[] {
  return [buildClasspassLink(p), buildMindbodyLink(p), buildGoogleMapsLink(p)];
}

export async function searchFitnessClasses(
  params: FitnessClassSearchParams,
  deps: {
    searchPlaces?: (
      query: string,
      opts: SearchPlacesOptions
    ) => Promise<Place[]>;
  } = {}
): Promise<FitnessClassSearchResult> {
  const placesFn = deps.searchPlaces ?? searchPlaces;
  const activity = normalizeActivity(params.activity);
  const query = activityToPlacesQuery(activity);
  const max = Math.min(Math.max(params.maxStudios ?? 6, 1), 10);

  let studios: Place[] = [];
  try {
    studios = await placesFn(query, {
      lat: params.location.lat,
      lng: params.location.lng,
      radiusMeters: params.radiusMeters,
      maxResults: max,
    });
  } catch (err: any) {
    // Let the caller decide how to react to provider errors. Re-throw so
    // grounding prompt can tell the model the live provider is unavailable.
    throw new Error(`find_fitness_classes: ${err?.message ?? 'search failed'}`);
  }

  return {
    activity,
    when: params.when,
    cityName: params.cityName,
    studios,
    aggregatorLinks: buildAggregatorLinks(params),
  };
}
