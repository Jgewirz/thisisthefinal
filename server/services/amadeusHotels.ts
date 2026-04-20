/**
 * Amadeus Self-Service hotels wrapper. Two-step flow:
 *   1. `GET /v1/reference-data/locations/hotels/by-city?cityCode=XXX`
 *         → list of hotelIds near that city.
 *   2. `GET /v3/shopping/hotel-offers?hotelIds=...&checkInDate=...&checkOutDate=...`
 *         → priced offers for those hotels on the requested dates.
 *
 * We cap step 1 results so step 2 stays under the Amadeus query-size limit,
 * and we never throw on step 1 quirks — we fall back to an empty result set
 * so the UI can still render the deep-link fallbacks.
 */

import { getAccessToken, getAmadeusHost } from './amadeus.js';
import {
  buildGoogleHotelsLink,
  type HotelSearchParams,
} from './hotelLinks.js';

export interface HotelOffer {
  id: string;                 // offer id (or hotelId as fallback)
  hotelId: string;
  name: string;
  cityName?: string;
  address?: string;
  rating?: number | null;     // Amadeus sends 0-5 "rating" on some records
  latitude?: number;
  longitude?: number;
  priceTotal?: string;
  currency?: string;
  checkIn: string;
  checkOut: string;
  bookingUrl: string;
}

export interface SearchHotelsResult {
  offers: HotelOffer[];
  searchLink: string;
}

/** Hotel-by-city cap keeps the hotel-offers URL length sane. */
const MAX_HOTEL_IDS = 20;

function redactBearer(s: string): string {
  return s.replace(/Bearer\s+\S+/, 'Bearer <redacted>');
}

async function unwrapError(res: Response, url: string): Promise<Error> {
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
  return new Error(
    `Amadeus ${res.status}${detail ? ': ' + detail : ' (empty response)'} [url=${redactBearer(url)}]`
  );
}

/** Helper: fetch with a single retry on 5xx to mitigate test-env flakiness. */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  fetchImpl: typeof fetch
): Promise<Response> {
  let res = await fetchImpl(url, init);
  if (res.status >= 500) {
    await new Promise((r) => setTimeout(r, 400));
    res = await fetchImpl(url, init);
  }
  return res;
}

export async function listHotelIdsByCity(
  cityCode: string,
  fetchImpl: typeof fetch = fetch
): Promise<Array<{ hotelId: string; name: string; latitude?: number; longitude?: number }>> {
  const token = await getAccessToken(fetchImpl);
  const qs = new URLSearchParams({
    cityCode: cityCode.toUpperCase(),
  });
  const url = `https://${getAmadeusHost()}/v1/reference-data/locations/hotels/by-city?${qs.toString()}`;
  const res = await fetchWithRetry(
    url,
    { headers: { Authorization: `Bearer ${token}` } },
    fetchImpl
  );
  if (!res.ok) throw await unwrapError(res, url);
  const data = (await res.json()) as { data?: any[] };
  return (data.data ?? [])
    .map((h: any) => ({
      hotelId: String(h.hotelId ?? ''),
      name: String(h.name ?? ''),
      latitude: typeof h.geoCode?.latitude === 'number' ? h.geoCode.latitude : undefined,
      longitude: typeof h.geoCode?.longitude === 'number' ? h.geoCode.longitude : undefined,
    }))
    .filter((h) => h.hotelId.length > 0);
}

export async function searchHotels(
  params: HotelSearchParams,
  fetchImpl: typeof fetch = fetch
): Promise<SearchHotelsResult> {
  const searchLink = buildGoogleHotelsLink(params).url;

  const ids = await listHotelIdsByCity(params.cityCode, fetchImpl);
  if (ids.length === 0) return { offers: [], searchLink };

  const subset = ids.slice(0, MAX_HOTEL_IDS);
  const idToLookup = new Map(subset.map((h) => [h.hotelId, h]));

  const token = await getAccessToken(fetchImpl);
  const qs = new URLSearchParams({
    hotelIds: subset.map((h) => h.hotelId).join(','),
    checkInDate: params.checkIn,
    checkOutDate: params.checkOut,
    adults: String(Math.max(1, Math.min(params.adults ?? 1, 9))),
    roomQuantity: String(Math.max(1, Math.min(params.rooms ?? 1, 9))),
    currency: (params.currency || 'USD').toUpperCase(),
    bestRateOnly: 'true',
  });
  const url = `https://${getAmadeusHost()}/v3/shopping/hotel-offers?${qs.toString()}`;

  const res = await fetchWithRetry(
    url,
    { headers: { Authorization: `Bearer ${token}` } },
    fetchImpl
  );
  if (!res.ok) throw await unwrapError(res, url);

  const data = (await res.json()) as { data?: any[] };
  const offers: HotelOffer[] = (data.data ?? []).map((row: any): HotelOffer => {
    const hotel = row.hotel ?? {};
    const hotelId = String(hotel.hotelId ?? '');
    const meta = idToLookup.get(hotelId);
    const firstOffer = Array.isArray(row.offers) ? row.offers[0] : null;
    return {
      id: String(firstOffer?.id ?? hotelId),
      hotelId,
      name: String(hotel.name ?? meta?.name ?? 'Hotel'),
      cityName: String(hotel.cityCode ?? params.cityCode).toUpperCase(),
      address: [hotel.address?.lines?.[0], hotel.address?.cityName]
        .filter(Boolean)
        .join(', ') || undefined,
      rating:
        typeof hotel.rating === 'number'
          ? hotel.rating
          : typeof hotel.rating === 'string'
            ? Number(hotel.rating) || null
            : null,
      latitude: hotel.latitude ?? meta?.latitude,
      longitude: hotel.longitude ?? meta?.longitude,
      priceTotal: firstOffer?.price?.total ? String(firstOffer.price.total) : undefined,
      currency: firstOffer?.price?.currency ? String(firstOffer.price.currency) : undefined,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      bookingUrl: searchLink, // direct PNR booking is out-of-scope here
    };
  });

  // Prefer priced offers first, then by hotel name.
  offers.sort((a, b) => {
    const hasA = a.priceTotal ? 1 : 0;
    const hasB = b.priceTotal ? 1 : 0;
    if (hasA !== hasB) return hasB - hasA;
    const pa = Number(a.priceTotal ?? Infinity);
    const pb = Number(b.priceTotal ?? Infinity);
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });

  return { offers, searchLink };
}
