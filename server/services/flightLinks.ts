/**
 * Deterministic deep-link builders for major flight booking engines.
 *
 * Used as a guaranteed-actionable fallback whenever the Amadeus flight-offers
 * endpoint is unavailable or returns zero results. Every link is pre-populated
 * with the user's search params so they can actually complete a booking
 * ("chat → action"), no matter what Amadeus's test sandbox is doing today.
 */

import type { FlightSearchParams } from './amadeus.js';

export interface BookingProviderLink {
  id: 'google' | 'kayak' | 'skyscanner' | 'momondo';
  name: string;
  url: string;
}

function toIata(s: string | undefined): string {
  return (s ?? '').trim().toUpperCase().slice(0, 3);
}

/** Keep the Google Flights URL shape we already ship to existing cards. */
export function buildGoogleFlightsLink(p: FlightSearchParams): BookingProviderLink {
  const adults = p.adults ?? 1;
  let q = `Flights from ${toIata(p.origin)} to ${toIata(p.destination)} on ${p.departDate}`;
  if (p.returnDate) q += ` through ${p.returnDate}`;
  if (adults > 1) q += ` for ${adults} adults`;
  return {
    id: 'google',
    name: 'Google Flights',
    url: `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`,
  };
}

/**
 * Kayak deep link:
 *   /flights/ORI-DST/2026-05-01[/2026-05-10][/Naadults]
 */
export function buildKayakLink(p: FlightSearchParams): BookingProviderLink {
  const o = toIata(p.origin);
  const d = toIata(p.destination);
  const adults = Math.max(1, Math.min(p.adults ?? 1, 9));
  const segs = [p.departDate];
  if (p.returnDate) segs.push(p.returnDate);
  let path = `${o}-${d}/${segs.join('/')}`;
  if (adults > 1) path += `/${adults}adults`;
  return {
    id: 'kayak',
    name: 'Kayak',
    url: `https://www.kayak.com/flights/${path}?sort=bestflight_a`,
  };
}

/**
 * Skyscanner deep link (search results page):
 *   /transport/flights/ori/dst/yymmdd[/yymmdd]?adultsv2=N
 */
export function buildSkyscannerLink(p: FlightSearchParams): BookingProviderLink {
  const o = toIata(p.origin).toLowerCase();
  const d = toIata(p.destination).toLowerCase();
  const adults = Math.max(1, Math.min(p.adults ?? 1, 9));
  const dep = compactDate(p.departDate);
  const ret = p.returnDate ? compactDate(p.returnDate) : '';
  const pathDates = ret ? `${dep}/${ret}` : dep;
  return {
    id: 'skyscanner',
    name: 'Skyscanner',
    url: `https://www.skyscanner.com/transport/flights/${o}/${d}/${pathDates}/?adultsv2=${adults}`,
  };
}

/**
 * Momondo: uses a search page with IATA codes + dates as query params.
 */
export function buildMomondoLink(p: FlightSearchParams): BookingProviderLink {
  const o = toIata(p.origin);
  const d = toIata(p.destination);
  const adults = Math.max(1, Math.min(p.adults ?? 1, 9));
  const segs = [p.departDate];
  if (p.returnDate) segs.push(p.returnDate);
  let path = `${o}-${d}/${segs.join('/')}`;
  if (adults > 1) path += `/${adults}adults`;
  return {
    id: 'momondo',
    name: 'Momondo',
    url: `https://www.momondo.com/flight-search/${path}`,
  };
}

function compactDate(iso: string): string {
  // YYYY-MM-DD → YYMMDD
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!m) return (iso ?? '').replace(/-/g, '');
  return `${m[1]!.slice(2)}${m[2]}${m[3]}`;
}

export function buildBookingLinks(p: FlightSearchParams): BookingProviderLink[] {
  return [
    buildGoogleFlightsLink(p),
    buildKayakLink(p),
    buildSkyscannerLink(p),
    buildMomondoLink(p),
  ];
}
