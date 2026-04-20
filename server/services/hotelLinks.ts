/**
 * Deterministic deep-link builders for major hotel booking engines.
 *
 * Used as a guaranteed-actionable fallback whenever Amadeus hotel-offers
 * is unavailable or returns zero rooms. Every link is pre-populated with
 * the user's city + dates + occupancy so they can still book ("chat →
 * action"), regardless of what the sandbox is doing today.
 */

export interface HotelSearchParams {
  cityCode: string;      // IATA city code, uppercased (e.g. "PAR")
  cityName?: string;     // Pretty name for the booking site URL
  checkIn: string;       // YYYY-MM-DD
  checkOut: string;      // YYYY-MM-DD
  adults?: number;       // default 1, clamped [1, 9]
  rooms?: number;        // default 1, clamped [1, 9]
  currency?: string;     // ISO, default USD
}

export interface HotelBookingLink {
  id: 'booking' | 'hotels' | 'airbnb' | 'google';
  name: string;
  url: string;
}

function clamp(n: number | undefined, lo: number, hi: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : lo;
  return Math.max(lo, Math.min(hi, v));
}

function dest(p: HotelSearchParams): string {
  return (p.cityName || p.cityCode || '').trim();
}

export function buildBookingDotComLink(p: HotelSearchParams): HotelBookingLink {
  const adults = clamp(p.adults, 1, 9);
  const rooms = clamp(p.rooms, 1, 9);
  const qs = new URLSearchParams({
    ss: dest(p),
    checkin: p.checkIn,
    checkout: p.checkOut,
    group_adults: String(adults),
    no_rooms: String(rooms),
  });
  return {
    id: 'booking',
    name: 'Booking.com',
    url: `https://www.booking.com/searchresults.html?${qs.toString()}`,
  };
}

export function buildHotelsDotComLink(p: HotelSearchParams): HotelBookingLink {
  const adults = clamp(p.adults, 1, 9);
  const qs = new URLSearchParams({
    destination: dest(p),
    startDate: p.checkIn,
    endDate: p.checkOut,
    rooms: String(clamp(p.rooms, 1, 9)),
    adults: String(adults),
  });
  return {
    id: 'hotels',
    name: 'Hotels.com',
    url: `https://www.hotels.com/Hotel-Search?${qs.toString()}`,
  };
}

export function buildAirbnbLink(p: HotelSearchParams): HotelBookingLink {
  const adults = clamp(p.adults, 1, 9);
  const qs = new URLSearchParams({
    checkin: p.checkIn,
    checkout: p.checkOut,
    adults: String(adults),
  });
  const slug = encodeURIComponent(dest(p));
  return {
    id: 'airbnb',
    name: 'Airbnb',
    url: `https://www.airbnb.com/s/${slug}/homes?${qs.toString()}`,
  };
}

export function buildGoogleHotelsLink(p: HotelSearchParams): HotelBookingLink {
  const q = `Hotels in ${dest(p)} ${p.checkIn} to ${p.checkOut}`;
  return {
    id: 'google',
    name: 'Google Hotels',
    url: `https://www.google.com/travel/hotels?q=${encodeURIComponent(q)}`,
  };
}

export function buildHotelBookingLinks(p: HotelSearchParams): HotelBookingLink[] {
  return [
    buildBookingDotComLink(p),
    buildHotelsDotComLink(p),
    buildAirbnbLink(p),
    buildGoogleHotelsLink(p),
  ];
}
