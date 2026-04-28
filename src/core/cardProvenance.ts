import type { RichCardType } from './types';

/**
 * Where the data in a rich card actually came from, and whether the card
 * rendered "live" provider results or fell back to booking/aggregator links.
 *
 * This is pure data — no React imports — so it can be unit-tested in
 * isolation and reused by any surface (chat, saved items, history view).
 */
export type ProvenanceMode = 'live' | 'links' | 'internal';

export interface CardProvenance {
  /** Human-readable provider name, e.g. "Amadeus", "Google Places". */
  source: string;
  /**
   * - `live`: returned real provider results (offers/places).
   * - `links`: provider unavailable or empty; we're showing booking/aggregator
   *   deep links the user can click to search externally.
   * - `internal`: sourced from the user's own data or the model itself (no
   *   external provider for the caller to worry about).
   */
  mode: ProvenanceMode;
  /**
   * Optional short detail for accessibility / tooltips
   * ("provider temporarily unavailable", "no offers matched").
   */
  detail?: string;
}

interface ListLikeData {
  offers?: unknown[];
  studios?: unknown[];
  places?: unknown[];
  providerError?: string;
}

function offerCount(data: unknown): number {
  const d = (data ?? {}) as ListLikeData;
  if (Array.isArray(d.offers)) return d.offers.length;
  if (Array.isArray(d.studios)) return d.studios.length;
  if (Array.isArray(d.places)) return d.places.length;
  return 0;
}

function providerError(data: unknown): string | undefined {
  const d = (data ?? {}) as ListLikeData;
  return typeof d.providerError === 'string' && d.providerError.length > 0
    ? d.providerError
    : undefined;
}

/**
 * Resolve provenance for any supported rich card.
 * Pure function; safe to call during render.
 */
export function resolveCardProvenance(
  type: RichCardType,
  data: unknown,
): CardProvenance {
  switch (type) {
    case 'place':
    case 'placesList':
      return { source: 'Google Places', mode: 'live' };

    case 'flight':
      return { source: 'Amadeus', mode: 'live' };

    case 'flightList': {
      const err = providerError(data);
      const count = offerCount(data);
      if (err) {
        return { source: 'Amadeus', mode: 'links', detail: err };
      }
      if (count === 0) {
        return {
          source: 'Amadeus',
          mode: 'links',
          detail: 'No live offers matched — showing booking links',
        };
      }
      return { source: 'Amadeus', mode: 'live' };
    }

    case 'hotel':
      return { source: 'Amadeus', mode: 'live' };

    case 'hotelList': {
      const err = providerError(data);
      const count = offerCount(data);
      if (err) {
        return { source: 'Amadeus', mode: 'links', detail: err };
      }
      if (count === 0) {
        return {
          source: 'Amadeus',
          mode: 'links',
          detail: 'No live offers matched — showing booking links',
        };
      }
      return { source: 'Amadeus', mode: 'live' };
    }

    case 'classList': {
      const err = providerError(data);
      const count = offerCount(data);
      if (err) {
        return { source: 'Google Places', mode: 'links', detail: err };
      }
      if (count === 0) {
        return {
          source: 'Google Places',
          mode: 'links',
          detail: 'No studios matched — showing aggregator links',
        };
      }
      return { source: 'Google Places', mode: 'live' };
    }

    case 'fitnessClass':
      return { source: 'Google Places', mode: 'live' };

    case 'outfit':
    case 'colorSeason':
      return { source: 'OpenAI Vision', mode: 'internal' };

    case 'reminder':
      return { source: 'Saved to your account', mode: 'internal' };

    default:
      return { source: 'Internal', mode: 'internal' };
  }
}

/**
 * Short label shown alongside the source name.
 * - `live`  → "Live"
 * - `links` → "Links only"
 * - `internal` → "" (nothing; the source name already explains it)
 */
export function provenanceModeLabel(mode: ProvenanceMode): string {
  switch (mode) {
    case 'live':
      return 'Live';
    case 'links':
      return 'Links only';
    case 'internal':
      return '';
  }
}

