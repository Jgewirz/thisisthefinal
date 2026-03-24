// ── Hotel enrichment: merges Google Places discovery data into Amadeus hotel offers ──
//
// For each hotel, searches Google Places by name + city to retrieve:
//   - Photo URL (proxied through our server)
//   - User rating (e.g., 4.5 from Google reviews)
//   - Review count (e.g., 2,341 reviews)
//   - Editorial summary (Google's description)
//   - Google Maps URL (direct link)
//   - Phone number
//   - Website
//
// Runs in parallel with a per-hotel timeout so slow lookups don't block the response.

import type { HotelOffer } from './amadeus.js';
import { searchPlaces, isGooglePlacesConfigured, type GooglePlace } from './google-places.js';

const ENRICHMENT_TIMEOUT_MS = 4000; // max 4s per hotel lookup
const MAX_PARALLEL_LOOKUPS = 5; // don't exceed 5 concurrent Google Places calls

/**
 * Enrich an array of HotelOffers with Google Places data.
 * Non-blocking: if Google Places is unavailable or slow, returns hotels unchanged.
 */
export async function enrichHotelsWithPlaces(
  hotels: HotelOffer[],
  cityName?: string
): Promise<HotelOffer[]> {
  if (!isGooglePlacesConfigured() || hotels.length === 0) {
    return hotels;
  }

  // Enrich in parallel, capped to MAX_PARALLEL_LOOKUPS
  const enrichPromises = hotels.slice(0, MAX_PARALLEL_LOOKUPS).map((hotel) =>
    enrichSingleHotel(hotel, cityName)
  );

  const enriched = await Promise.all(enrichPromises);

  // Append any hotels beyond the parallel cap unchanged
  if (hotels.length > MAX_PARALLEL_LOOKUPS) {
    enriched.push(...hotels.slice(MAX_PARALLEL_LOOKUPS));
  }

  return enriched;
}

async function enrichSingleHotel(hotel: HotelOffer, cityName?: string): Promise<HotelOffer> {
  try {
    const place = await Promise.race([
      findMatchingPlace(hotel, cityName),
      timeout(ENRICHMENT_TIMEOUT_MS),
    ]);

    if (!place) return hotel;

    return {
      ...hotel,
      photoUrl: place.photoUrl,
      userRating: place.rating,
      reviewCount: place.reviewCount,
      editorialSummary: place.editorialSummary,
      googleMapsUrl: place.googleMapsUrl,
      phone: place.phone,
      website: place.website,
    };
  } catch {
    // Enrichment failed — return hotel as-is with Amadeus data only
    return hotel;
  }
}

async function findMatchingPlace(hotel: HotelOffer, cityName?: string): Promise<GooglePlace | null> {
  // Build a targeted search query: "Hotel Name, City"
  const city = cityName || hotel.address?.split(',').pop()?.trim() || hotel.cityCode || '';
  const query = `${hotel.name} hotel ${city}`.trim();

  const results = await searchPlaces({ textQuery: query });

  if (!results.length) return null;

  // Take the best match — Google Places text search already ranks by relevance
  // Validate the match: name should have some overlap
  const best = results[0];
  if (isReasonableMatch(hotel.name, best.name)) {
    return best;
  }

  // If the top result doesn't match well, try the second
  if (results.length > 1 && isReasonableMatch(hotel.name, results[1].name)) {
    return results[1];
  }

  // Fall back to top result anyway — Google's relevance ranking is usually good
  return best;
}

/**
 * Basic fuzzy name match: checks if key words from the hotel name
 * appear in the Google Places result name, or vice versa.
 */
function isReasonableMatch(amadeusName: string, placesName: string): boolean {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

  const a = normalize(amadeusName);
  const b = normalize(placesName);

  // Exact containment
  if (a.includes(b) || b.includes(a)) return true;

  // Word overlap: at least 2 significant words match
  const stopWords = new Set(['the', 'hotel', 'a', 'an', 'and', 'by', 'at', 'in', 'of', 'resort', 'suites']);
  const wordsA = a.split(' ').filter((w) => w.length > 2 && !stopWords.has(w));
  const wordsB = new Set(b.split(' ').filter((w) => w.length > 2 && !stopWords.has(w)));

  const overlap = wordsA.filter((w) => wordsB.has(w)).length;
  return overlap >= 1;
}

function timeout(ms: number): Promise<null> {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
}
