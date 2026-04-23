/**
 * SerpAPI Google Hotels fallback.
 * Called when the Amadeus hotel-offers provider is unavailable.
 *
 * Env: SERP_API_KEY — if absent, returns [] immediately (no throw).
 * Docs: https://serpapi.com/google-hotels-api
 */

import type { HotelOffer } from './amadeusHotels.js';
import type { HotelSearchParams } from './hotelLinks.js';
import { buildGoogleHotelsLink } from './hotelLinks.js';

const SERP_BASE = 'https://serpapi.com/search.json';
const MAX_HOTEL_RESULTS = 25;

interface SerpProperty {
  name?: string;
  link?: string;
  gps_coordinates?: { latitude?: number; longitude?: number };
  rate_per_night?: { extracted_lowest?: number; lowest?: string };
  total_rate?: { extracted_lowest?: number; lowest?: string };
  overall_rating?: number;
  extracted_hotel_class?: number;
  hotel_class?: string;
  hotel_id?: string;
  address?: string;
}

function extractPrice(p: SerpProperty, currency: string): { priceTotal: string | undefined; currency: string } {
  const total = p.total_rate?.extracted_lowest ?? p.rate_per_night?.extracted_lowest;
  return {
    priceTotal: total != null ? String(total) : undefined,
    currency,
  };
}

function mapProperty(p: SerpProperty, idx: number, params: HotelSearchParams, searchLink: string): HotelOffer {
  const currency = (params.currency ?? 'USD').toUpperCase();
  const { priceTotal } = extractPrice(p, currency);
  return {
    id: p.hotel_id ?? `serp_h_${idx}`,
    hotelId: p.hotel_id ?? `serp_h_${idx}`,
    name: p.name ?? 'Hotel',
    cityName: params.cityName ?? params.cityCode,
    address: p.address,
    rating: p.extracted_hotel_class ?? (typeof p.overall_rating === 'number' ? Math.round(p.overall_rating) : null),
    latitude: p.gps_coordinates?.latitude,
    longitude: p.gps_coordinates?.longitude,
    priceTotal,
    currency,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    bookingUrl: p.link ?? searchLink,
  };
}

function assertNotPast(date: string, label: string): void {
  const today = new Date().toISOString().slice(0, 10);
  if (date < today) throw new Error(`${label} (${date}) is in the past. Today is ${today}.`);
}

export async function searchHotelsFallback(
  params: HotelSearchParams,
  fetchImpl: typeof fetch = fetch
): Promise<HotelOffer[]> {
  const key = process.env.SERP_API_KEY;
  if (!key) return [];

  assertNotPast(params.checkIn, 'checkIn');
  assertNotPast(params.checkOut, 'checkOut');

  const searchLink = buildGoogleHotelsLink(params).url;
  const dest = params.cityName ?? params.cityCode;
  const qs = new URLSearchParams({
    engine: 'google_hotels',
    q: `Hotels in ${dest}`,
    check_in_date: params.checkIn,
    check_out_date: params.checkOut,
    adults: String(params.adults ?? 1),
    currency: (params.currency ?? 'USD').toUpperCase(),
    hl: 'en',
    api_key: key,
  });
  if (params.rooms && params.rooms > 1) qs.set('rooms', String(params.rooms));

  const url = `${SERP_BASE}?${qs.toString()}`;
  console.log(`[serpHotels] calling SerpAPI: ${url.replace(key, '<key>')}`);
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`SerpAPI hotels ${res.status}: ${await res.text().then((t) => t.slice(0, 200))}`);

  const data = (await res.json()) as { properties?: SerpProperty[]; error?: string };
  if (data.error) throw new Error(`SerpAPI hotels error: ${data.error}`);

  const props = data.properties ?? [];
  console.log(`[serpHotels] got ${props.length} results`);
  return props.slice(0, MAX_HOTEL_RESULTS).map((p, i) => mapProperty(p, i, params, searchLink));
}
