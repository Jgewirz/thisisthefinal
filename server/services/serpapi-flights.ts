/**
 * SerpAPI Google Flights client.
 *
 * Primary flight data source — returns real prices from Google Flights.
 * Falls back gracefully when SERP_API_KEY is not configured.
 *
 * Free tier: 100 searches/month. Paid: $50/mo for 5,000.
 * Signup: https://serpapi.com/
 */

import type { FlightOffer, FlightSegment, LayoverInfo, BagAllowance, FlightAmenity } from './amadeus.js';

// ── Config ────────────────────────────────────────────────────────────

export function isSerpApiConfigured(): boolean {
  return !!process.env.SERP_API_KEY?.trim();
}

// ── Airline code lookup (for SerpAPI which returns full names) ─────────

const AIRLINE_TO_CODE: Record<string, string> = {
  'american airlines': 'AA', 'delta air lines': 'DL', 'delta': 'DL',
  'united airlines': 'UA', 'united': 'UA', 'southwest airlines': 'WN',
  'southwest': 'WN', 'jetblue airways': 'B6', 'jetblue': 'B6',
  'alaska airlines': 'AS', 'spirit airlines': 'NK', 'spirit': 'NK',
  'frontier airlines': 'F9', 'frontier': 'F9', 'allegiant air': 'G4',
  'hawaiian airlines': 'HA', 'sun country airlines': 'SY',
  'british airways': 'BA', 'lufthansa': 'LH', 'air france': 'AF',
  'emirates': 'EK', 'qatar airways': 'QR', 'turkish airlines': 'TK',
  'air canada': 'AC', 'westjet': 'WS',
  'singapore airlines': 'SQ', 'cathay pacific': 'CX',
  'ana': 'NH', 'japan airlines': 'JL', 'korean air': 'KE',
  'qantas': 'QF', 'virgin atlantic': 'VS',
};

function resolveAirlineCode(name: string): string {
  if (!name) return '';
  // If it's already a 2-letter code, return as-is
  if (/^[A-Z0-9]{2}$/.test(name)) return name;
  return AIRLINE_TO_CODE[name.toLowerCase()] || name.slice(0, 2).toUpperCase();
}

// ── Duration formatting ───────────────────────────────────────────────

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatTime(dateTimeStr: string): string {
  const date = new Date(dateTimeStr);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getDatePart(dateTimeStr: string): string {
  // SerpAPI format: "2026-05-24 09:30" or ISO
  return dateTimeStr.split(/[T ]/)[0];
}

function formatPrice(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ── Booking URL builders ──────────────────────────────────────────────

function buildGoogleFlightsUrl(origin: string, dest: string, date: string, returnDate?: string): string {
  const base = `https://www.google.com/travel/flights?q=flights+from+${origin}+to+${dest}+on+${date}`;
  return returnDate ? `${base}+return+${returnDate}` : base;
}

// ── SerpAPI response types ────────────────────────────────────────────

interface SerpFlight {
  airline: string;
  airline_logo?: string;
  flight_number?: string;
  departure_airport: { id: string; name: string; time: string };
  arrival_airport: { id: string; name: string; time: string };
  duration: number; // minutes
  airplane?: string;
  legroom?: string;
  extensions?: string[];
  often_delayed_by_over_30_min?: boolean;
  overnight?: boolean;
  travel_class?: string;
}

interface SerpFlightGroup {
  flights: SerpFlight[];
  total_duration: number;
  price: number;
  type?: string;
  airline_logo?: string;
  carbon_emissions?: { this_flight: number };
  layovers?: Array<{
    name: string;
    id: string;
    duration: number;
    overnight?: boolean;
  }>;
}

interface SerpApiResponse {
  best_flights?: SerpFlightGroup[];
  other_flights?: SerpFlightGroup[];
  search_metadata?: { status: string };
  error?: string;
}

// ── Transform SerpAPI → FlightOffer ───────────────────────────────────

function transformSegment(seg: SerpFlight): FlightSegment {
  const carrierCode = resolveAirlineCode(seg.airline);

  return {
    flightNumber: seg.flight_number || `${carrierCode}`,
    departureAirport: seg.departure_airport.id,
    departureTime: seg.departure_airport.time,
    arrivalAirport: seg.arrival_airport.id,
    arrivalTime: seg.arrival_airport.time,
    duration: formatDuration(seg.duration),
    carrierCode,
    carrierName: seg.airline,
    aircraftCode: seg.airplane || undefined,
  };
}

function computeLayovers(group: SerpFlightGroup): LayoverInfo[] {
  if (!group.layovers?.length) return [];
  return group.layovers.map((lo) => ({
    airport: lo.id || lo.name,
    duration: formatDuration(lo.duration),
  }));
}

function extractAmenities(seg: SerpFlight): FlightAmenity[] {
  if (!seg.extensions?.length) return [];
  return seg.extensions.slice(0, 6).map((ext) => {
    const isChargeable = /fee|charge|paid|purchase/i.test(ext);
    // Clean up the extension text
    const name = ext
      .replace(/\s*\(.*?\)\s*/g, '')   // remove parentheticals
      .replace(/\b(for a fee|at a charge)\b/gi, '')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return { name, isChargeable };
  });
}

function transformFlightGroup(
  group: SerpFlightGroup,
  origin: string,
  destination: string,
  tier: FlightOffer['tier'],
): FlightOffer {
  const segs = group.flights.map(transformSegment);
  const firstSeg = segs[0];
  const lastSeg = segs[segs.length - 1];
  const firstRaw = group.flights[0];
  const lastRaw = group.flights[group.flights.length - 1];

  const depDate = getDatePart(firstRaw.departure_airport.time);
  const arrDate = getDatePart(lastRaw.arrival_airport.time);
  const primaryAirline = firstRaw.airline;
  const airlineCode = resolveAirlineCode(primaryAirline);
  const price = group.price;

  const bags: BagAllowance = {
    checkedBags: 'See airline',
    cabinBags: '1 carry-on',
  };

  const amenities = extractAmenities(firstRaw);
  const layovers = computeLayovers(group);

  // Determine cabin class from extensions
  const cabin = firstRaw.travel_class || 'ECONOMY';

  return {
    airline: primaryAirline,
    departure: {
      city: firstSeg.departureAirport,
      time: formatTime(firstRaw.departure_airport.time),
    },
    arrival: {
      city: lastSeg.arrivalAirport,
      time: formatTime(lastRaw.arrival_airport.time),
    },
    duration: formatDuration(group.total_duration),
    stops: Math.max(0, group.flights.length - 1),
    price: formatPrice(price),
    tier,
    flightNumber: firstRaw.flight_number || `${airlineCode}`,
    departureDate: depDate,
    arrivalDate: arrDate,
    isOvernight: depDate !== arrDate || group.flights.some((f) => f.overnight),
    baseFare: formatPrice(price),
    taxes: '$0',
    rawPrice: price,
    cabinClass: cabin,
    bags,
    seatsRemaining: null,
    amenities,
    segments: segs,
    layovers,
    returnTrip: null, // Handled separately for round trips
    validatingAirlineCode: airlineCode,
    bookingUrl: buildGoogleFlightsUrl(origin, destination, depDate),
  };
}

// ── Tiering algorithm ─────────────────────────────────────────────────

function assignTiers(flights: FlightOffer[]): FlightOffer[] {
  if (flights.length === 0) return [];
  if (flights.length === 1) {
    flights[0].tier = 'Balanced';
    return flights;
  }

  // Sort by price for ranking
  const byPrice = [...flights].sort((a, b) => a.rawPrice - b.rawPrice);
  const byDuration = [...flights].sort((a, b) => {
    const aDur = a.segments.reduce((s, seg) => s + parseDurationToMin(seg.duration), 0);
    const bDur = b.segments.reduce((s, seg) => s + parseDurationToMin(seg.duration), 0);
    return aDur - bDur;
  });

  const priceRank = new Map<FlightOffer, number>();
  const durationRank = new Map<FlightOffer, number>();
  const stopsRank = new Map<FlightOffer, number>();

  byPrice.forEach((f, i) => priceRank.set(f, i));
  byDuration.forEach((f, i) => durationRank.set(f, i));

  const byStops = [...flights].sort((a, b) => a.stops - b.stops);
  byStops.forEach((f, i) => stopsRank.set(f, i));

  // Budget = cheapest
  const budget = byPrice[0];
  budget.tier = 'Budget';

  // Premium = shortest duration with fewest stops (best experience)
  const premium = byDuration.find((f) => f !== budget) || byPrice[byPrice.length - 1];
  premium.tier = 'Premium';

  // Value = best composite score among remaining
  const remaining = flights.filter((f) => f !== budget && f !== premium);
  if (remaining.length > 0) {
    const n = flights.length;
    remaining.sort((a, b) => {
      const aScore = ((priceRank.get(a) || 0) / n) * 0.4 +
                     ((durationRank.get(a) || 0) / n) * 0.3 +
                     ((stopsRank.get(a) || 0) / n) * 0.3;
      const bScore = ((priceRank.get(b) || 0) / n) * 0.4 +
                     ((durationRank.get(b) || 0) / n) * 0.3 +
                     ((stopsRank.get(b) || 0) / n) * 0.3;
      return aScore - bScore;
    });
    remaining[0].tier = 'Balanced';
  }

  // Return in order: Budget, Balanced, Premium
  const tiered = [budget];
  const balanced = flights.find((f) => f.tier === 'Balanced' && f !== budget);
  if (balanced) tiered.push(balanced);
  tiered.push(premium);

  return tiered;
}

function parseDurationToMin(dur: string): number {
  const hMatch = dur.match(/(\d+)h/);
  const mMatch = dur.match(/(\d+)m/);
  return (parseInt(hMatch?.[1] || '0', 10) * 60) + parseInt(mMatch?.[1] || '0', 10);
}

// ── Main search function ──────────────────────────────────────────────

export interface SerpApiSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string | null;
  adults?: number;
  cabinClass?: string;
  includedAirlineCodes?: string[] | null;
  excludedAirlineCodes?: string[] | null;
}

export async function searchFlightsSerpApi(params: SerpApiSearchParams): Promise<FlightOffer[]> {
  const apiKey = process.env.SERP_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('SERP_API_KEY is not configured');
  }

  const isRoundTrip = !!params.returnDate;
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_flights');
  url.searchParams.set('departure_id', params.origin);
  url.searchParams.set('arrival_id', params.destination);
  url.searchParams.set('outbound_date', params.departureDate);
  url.searchParams.set('type', isRoundTrip ? '1' : '2'); // 1=round-trip, 2=one-way
  url.searchParams.set('currency', 'USD');
  url.searchParams.set('hl', 'en');
  url.searchParams.set('adults', String(params.adults || 1));
  url.searchParams.set('api_key', apiKey);

  if (params.returnDate) {
    url.searchParams.set('return_date', params.returnDate);
  }

  if (params.includedAirlineCodes?.length) {
    url.searchParams.set('include_airlines', params.includedAirlineCodes.join(','));
  }
  if (params.excludedAirlineCodes?.length) {
    url.searchParams.set('exclude_airlines', params.excludedAirlineCodes.join(','));
  }

  // Map cabin class
  if (params.cabinClass) {
    const cabinMap: Record<string, string> = {
      ECONOMY: '1', PREMIUM_ECONOMY: '2', BUSINESS: '3', FIRST: '4',
    };
    const mapped = cabinMap[params.cabinClass.toUpperCase()];
    if (mapped) url.searchParams.set('travel_class', mapped);
  }

  console.log(`[serpapi] Searching flights ${params.origin}→${params.destination} on ${params.departureDate}`);

  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    throw new Error(`SerpAPI returned ${response.status}: ${await response.text().catch(() => '')}`);
  }

  const data: SerpApiResponse = await response.json();

  if (data.error) {
    throw new Error(`SerpAPI error: ${data.error}`);
  }

  const bestFlights = data.best_flights || [];
  const otherFlights = data.other_flights || [];
  const allGroups = [...bestFlights, ...otherFlights];

  if (allGroups.length === 0) {
    console.log('[serpapi] Zero flight results');
    return [];
  }

  // Transform all groups into FlightOffer objects (tier will be reassigned)
  const offers = allGroups
    .filter((g) => g.price && g.flights?.length)
    .map((g) => transformFlightGroup(g, params.origin, params.destination, 'Budget'));

  // Deduplicate by flight number + price
  const seen = new Set<string>();
  const unique = offers.filter((o) => {
    const key = `${o.flightNumber}|${o.rawPrice}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Assign tiers and return top 3
  const tiered = assignTiers(unique.slice(0, 8));

  console.log(`[serpapi] Returning ${tiered.length} tiered flights for ${params.origin}→${params.destination}`);
  return tiered.slice(0, 3);
}
