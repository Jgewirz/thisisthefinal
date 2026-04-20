/**
 * Amadeus Self-Service flight-offers wrapper.
 * OAuth2 client-credentials token is cached in-memory and refreshed ~30s before expiry.
 *
 * Env:
 *   AMADEUS_CLIENT_ID / AMADEUS_API_KEY      — required
 *   AMADEUS_CLIENT_SECRET / AMADEUS_SECRET_KEY — required
 *   AMADEUS_HOST — optional, defaults to test.api.amadeus.com
 */

export interface FlightSegment {
  carrier: string;
  flightNumber: string;
  from: string;
  to: string;
  departAt: string;
  arriveAt: string;
  durationMinutes: number;
}

export interface FlightItinerary {
  durationMinutes: number;
  stops: number;
  segments: FlightSegment[];
}

export interface FlightOffer {
  id: string;
  priceTotal: string;
  currency: string;
  itineraries: FlightItinerary[];
  bookingUrl: string;
}

export interface FlightSearchParams {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  adults?: number;
  nonStop?: boolean;
  currency?: string;
  max?: number;
}

const DEFAULT_HOST = 'test.api.amadeus.com';

export function getAmadeusHost(): string {
  return (process.env.AMADEUS_HOST || DEFAULT_HOST).replace(/^https?:\/\//, '');
}

/**
 * Look up an env var by any of the provided names. Also scans process.env
 * for keys whose trimmed name matches, to tolerate `.env` lines like
 * `AMADEUS_API_KEY = value` which some parsers load with a trailing space.
 */
function envFuzzy(...names: string[]): string | undefined {
  for (const name of names) {
    const v = process.env[name];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v !== 'string' || v.trim().length === 0) continue;
    if (names.includes(k.trim())) return v.trim();
  }
  return undefined;
}

function getCreds(): { clientId: string; clientSecret: string } {
  const clientId = envFuzzy('AMADEUS_CLIENT_ID', 'AMADEUS_API_KEY');
  const clientSecret = envFuzzy('AMADEUS_CLIENT_SECRET', 'AMADEUS_SECRET_KEY');
  if (!clientId || !clientSecret) {
    throw new Error(
      'AMADEUS credentials missing: set AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET in .env (no spaces around =)'
    );
  }
  return { clientId, clientSecret };
}

interface TokenCacheEntry {
  token: string;
  expiresAt: number;
}

let _tokenCache: TokenCacheEntry | null = null;

/** Exposed for tests so we can reset between cases. */
export function __resetAmadeusTokenCache(): void {
  _tokenCache = null;
}

export async function getAccessToken(
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now
): Promise<string> {
  if (_tokenCache && _tokenCache.expiresAt > now()) return _tokenCache.token;

  const { clientId, clientSecret } = getCreds();
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetchImpl(`https://${getAmadeusHost()}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Amadeus auth ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error('Amadeus auth: missing access_token');
  const ttlMs = Math.max(60_000, ((data.expires_in ?? 1799) - 30) * 1000);
  _tokenCache = { token: data.access_token, expiresAt: now() + ttlMs };
  return data.access_token;
}

function iso8601DurationToMinutes(s: string | undefined): number {
  if (!s) return 0;
  const m = s.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/);
  if (!m) return 0;
  return (parseInt(m[1] ?? '0', 10) * 60) + parseInt(m[2] ?? '0', 10);
}

export function buildGoogleFlightsUrl(p: FlightSearchParams): string {
  const adults = p.adults ?? 1;
  let q = `Flights from ${p.origin} to ${p.destination} on ${p.departDate}`;
  if (p.returnDate) q += ` through ${p.returnDate}`;
  if (adults > 1) q += ` for ${adults} adults`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
}

export interface SearchFlightsResult {
  offers: FlightOffer[];
  searchLink: string;
}

export async function searchFlights(
  params: FlightSearchParams,
  fetchImpl: typeof fetch = fetch
): Promise<SearchFlightsResult> {
  const token = await getAccessToken(fetchImpl);
  const search = new URLSearchParams({
    originLocationCode: params.origin.toUpperCase(),
    destinationLocationCode: params.destination.toUpperCase(),
    departureDate: params.departDate,
    adults: String(Math.max(1, Math.min(params.adults ?? 1, 9))),
    currencyCode: params.currency || 'USD',
    max: String(Math.min(Math.max(params.max ?? 6, 1), 10)),
  });
  if (params.returnDate) search.set('returnDate', params.returnDate);
  if (params.nonStop) search.set('nonStop', 'true');

  const url = `https://${getAmadeusHost()}/v2/shopping/flight-offers?${search.toString()}`;
  let res = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
  // Amadeus test env occasionally returns an empty 5xx; retry once.
  if (res.status >= 500) {
    await new Promise((r) => setTimeout(r, 400));
    res = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
  }

  if (!res.ok) {
    const text = (await res.text()) || '';
    let detail = text.slice(0, 400);
    try {
      const parsed = JSON.parse(text);
      const first = Array.isArray(parsed?.errors) ? parsed.errors[0] : null;
      if (first?.detail || first?.title) {
        detail = `${first.title ?? ''}${first.detail ? ' — ' + first.detail : ''}`.trim();
      }
    } catch {
      // keep raw text
    }
    throw new Error(
      `Amadeus flight-offers ${res.status}${detail ? ': ' + detail : ' (empty response)'} [url=${url.replace(/Bearer\s+\S+/, 'Bearer <redacted>')}]`
    );
  }

  const data = (await res.json()) as { data?: any[] };
  const searchLink = buildGoogleFlightsUrl(params);

  const offers: FlightOffer[] = (data.data ?? []).map((offer: any): FlightOffer => {
    const itineraries: FlightItinerary[] = (offer.itineraries ?? []).map((it: any) => {
      const segments: FlightSegment[] = (it.segments ?? []).map((s: any) => ({
        carrier: s.carrierCode ?? '',
        flightNumber: `${s.carrierCode ?? ''}${s.number ?? ''}`,
        from: s.departure?.iataCode ?? '',
        to: s.arrival?.iataCode ?? '',
        departAt: s.departure?.at ?? '',
        arriveAt: s.arrival?.at ?? '',
        durationMinutes: iso8601DurationToMinutes(s.duration),
      }));
      return {
        durationMinutes: iso8601DurationToMinutes(it.duration),
        stops: Math.max(0, segments.length - 1),
        segments,
      };
    });
    return {
      id: String(offer.id ?? ''),
      priceTotal: String(offer.price?.total ?? ''),
      currency: String(offer.price?.currency ?? 'USD'),
      itineraries,
      bookingUrl: searchLink,
    };
  });

  return { offers, searchLink };
}
