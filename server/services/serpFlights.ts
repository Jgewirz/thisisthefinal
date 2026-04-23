/**
 * SerpAPI Google Flights fallback.
 * Called when the Amadeus flight-offers provider is unavailable.
 *
 * Env: SERP_API_KEY — if absent, returns [] immediately (no throw).
 * Docs: https://serpapi.com/google-flights-api
 */

import type { FlightOffer, FlightItinerary, FlightSegment, FlightSearchParams } from './amadeus.js';
import { buildGoogleFlightsUrl } from './amadeus.js';

const SERP_BASE = 'https://serpapi.com/search.json';

interface SerpSegment {
  departure_airport?: { id?: string; name?: string; time?: string };
  arrival_airport?: { id?: string; name?: string; time?: string };
  duration?: number;
  airline?: string;
  flight_number?: string;
}

interface SerpFlightGroup {
  flights?: SerpSegment[];
  total_duration?: number;
  price?: number;
}

function isoFromSerpTime(t: string | undefined): string {
  if (!t) return '';
  // SerpAPI format: "2026-05-01 18:00" → ISO 8601
  return t.includes('T') ? t : t.replace(' ', 'T') + ':00';
}

function mapSegments(raw: SerpSegment[]): FlightSegment[] {
  return raw.map((s) => ({
    carrier: String(s.airline ?? 'Unknown').slice(0, 30),
    flightNumber: String(s.flight_number ?? ''),
    from: String(s.departure_airport?.id ?? ''),
    to: String(s.arrival_airport?.id ?? ''),
    departAt: isoFromSerpTime(s.departure_airport?.time),
    arriveAt: isoFromSerpTime(s.arrival_airport?.time),
    durationMinutes: typeof s.duration === 'number' ? s.duration : 0,
  }));
}

function mapGroup(g: SerpFlightGroup, idx: number, params: FlightSearchParams, searchLink: string): FlightOffer {
  const segments = mapSegments(g.flights ?? []);
  const itinerary: FlightItinerary = {
    durationMinutes: typeof g.total_duration === 'number' ? g.total_duration : 0,
    stops: Math.max(0, segments.length - 1),
    segments,
  };
  return {
    id: `serp_f_${idx}`,
    priceTotal: typeof g.price === 'number' ? String(g.price) : '—',
    currency: (params.currency ?? 'USD').toUpperCase(),
    itineraries: [itinerary],
    bookingUrl: searchLink,
  };
}

function assertNotPast(date: string, label: string): void {
  const today = new Date().toISOString().slice(0, 10);
  if (date < today) throw new Error(`${label} (${date}) is in the past. Today is ${today}.`);
}

export async function searchFlightsFallback(
  params: FlightSearchParams,
  fetchImpl: typeof fetch = fetch
): Promise<FlightOffer[]> {
  const key = process.env.SERP_API_KEY;
  if (!key) return [];

  assertNotPast(params.departDate, 'departDate');
  if (params.returnDate) assertNotPast(params.returnDate, 'returnDate');

  const searchLink = buildGoogleFlightsUrl(params);
  const qs = new URLSearchParams({
    engine: 'google_flights',
    departure_id: params.origin,
    arrival_id: params.destination,
    outbound_date: params.departDate,
    currency: (params.currency ?? 'USD').toUpperCase(),
    adults: String(params.adults ?? 1),
    hl: 'en',
    api_key: key,
  });
  if (params.returnDate) qs.set('return_date', params.returnDate);

  const url = `${SERP_BASE}?${qs.toString()}`;
  console.log(`[serpFlights] calling SerpAPI: ${url.replace(key, '<key>')}`);
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`SerpAPI flights ${res.status}: ${await res.text().then((t) => t.slice(0, 200))}`);

  const data = (await res.json()) as {
    best_flights?: SerpFlightGroup[];
    other_flights?: SerpFlightGroup[];
    error?: string;
  };

  if (data.error) throw new Error(`SerpAPI flights error: ${data.error}`);

  const all = [...(data.best_flights ?? []), ...(data.other_flights ?? [])];
  console.log(`[serpFlights] got ${all.length} results`);
  return all.slice(0, 8).map((g, i) => mapGroup(g, i, params, searchLink));
}
