import { ExternalLink, MapPin, Star } from 'lucide-react';
import type { PlaceResult } from '../../types';
import { SaveButton } from '../SaveButton';

interface PlacesListCardProps {
  data: { query: string; places: PlaceResult[] };
  agentColor: string;
}

function wantsReservation(query: string): boolean {
  return /\b(reserve|reservation|book|booking|table|dinner|lunch|brunch|restaurant)\b/i.test(
    query ?? ''
  );
}

function priceSymbol(level?: string): string {
  switch (level) {
    case 'PRICE_LEVEL_FREE':
      return 'Free';
    case 'PRICE_LEVEL_INEXPENSIVE':
      return '$';
    case 'PRICE_LEVEL_MODERATE':
      return '$$';
    case 'PRICE_LEVEL_EXPENSIVE':
      return '$$$';
    case 'PRICE_LEVEL_VERY_EXPENSIVE':
      return '$$$$';
    default:
      return '';
  }
}

function directionsUrl(p: PlaceResult): string {
  if (p.googleMapsUri) return p.googleMapsUri;
  const q = encodeURIComponent(`${p.name} ${p.address}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function shortLocation(address: string | undefined): string {
  const a = (address ?? '').trim();
  if (!a) return '';
  // Prefer the tail of a "Shibuya, Tokyo, Japan" style address.
  const parts = a.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) return parts.slice(-2).join(', ');
  // Otherwise, collapse long postal strings to keep the query stable.
  return a.length > 60 ? a.slice(0, 60) : a;
}

function reservationSearchText(p: PlaceResult): string {
  const loc = shortLocation(p.address);
  return `${p.name}${loc ? ` ${loc}` : ''}`.trim();
}

type ReservationProvider = 'opentable' | 'resy' | 'tabelog' | 'gurunavi';

function reservationProviderFromWebsite(url: string | undefined): ReservationProvider | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('opentable.')) return 'opentable';
    if (host === 'resy.com' || host.endsWith('.resy.com')) return 'resy';
    if (host === 'tabelog.com' || host.endsWith('.tabelog.com')) return 'tabelog';
    if (host.endsWith('gurunavi.co.jp')) return 'gurunavi';
    return null;
  } catch {
    return null;
  }
}

function providerLabel(p: ReservationProvider): string {
  switch (p) {
    case 'opentable':
      return 'OpenTable';
    case 'resy':
      return 'Resy';
    case 'tabelog':
      return 'Tabelog';
    case 'gurunavi':
      return 'Gurunavi';
  }
}

function isJapanAddress(address: string | undefined): boolean {
  const a = (address ?? '').toLowerCase();
  return (
    a.includes('japan') ||
    a.includes('tokyo') ||
    // Basic Japanese character ranges
    /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9faf]/.test(address ?? '')
  );
}

function openTableUrl(p: PlaceResult): string {
  // Direct OpenTable search (no Google). Note: availability varies by region.
  const term = encodeURIComponent(reservationSearchText(p));
  return `https://www.opentable.com/s?term=${term}`;
}

function tabelogUrl(p: PlaceResult): string {
  // Direct Tabelog search (Japan-focused).
  const term = encodeURIComponent(reservationSearchText(p));
  return `https://tabelog.com/en/rstLst/?sk=${term}`;
}

function gurunaviUrl(p: PlaceResult): string {
  const term = encodeURIComponent(reservationSearchText(p));
  return `https://r.gnavi.co.jp/area/jp/rs/?fw=${term}`;
}

export function PlacesListCard({ data, agentColor }: PlacesListCardProps) {
  const places = data.places ?? [];
  const showReservationLinks = wantsReservation(data.query);

  if (places.length === 0) {
    return (
      <div
        className="p-4 rounded-xl text-sm"
        style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
      >
        No results found for <span style={{ color: agentColor }}>{data.query}</span>. Try widening
        your search or enabling location.
      </div>
    );
  }

  return (
    <div
      className="p-3 rounded-xl space-y-2"
      style={{ backgroundColor: 'var(--bg-surface)' }}
    >
      <div className="flex items-center gap-2 px-1">
        <MapPin size={14} style={{ color: agentColor }} />
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {places.length} result{places.length === 1 ? '' : 's'} for{' '}
          <span style={{ color: agentColor }}>{data.query}</span>
        </span>
      </div>

      <ul className="space-y-2">
        {places.map((p) => (
          <li
            key={p.id}
            className="p-3 rounded-lg flex flex-col gap-1.5"
            style={{ backgroundColor: 'var(--bg-primary)' }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div
                  className="font-semibold truncate"
                  style={{ color: 'var(--text-primary)' }}
                  title={p.name}
                >
                  {p.name}
                </div>
                <div
                  className="text-xs truncate"
                  style={{ color: 'var(--text-secondary)' }}
                  title={p.address}
                >
                  {p.address}
                </div>
              </div>
              {typeof p.rating === 'number' && (
                <div
                  className="flex items-center gap-1 flex-shrink-0"
                  title={`${p.userRatingCount ?? 0} reviews`}
                >
                  <Star size={12} fill={agentColor} style={{ color: agentColor }} />
                  <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
                    {p.rating.toFixed(1)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {priceSymbol(p.priceLevel) && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: agentColor + '20', color: agentColor }}
                >
                  {priceSymbol(p.priceLevel)}
                </span>
              )}
              <a
                href={directionsUrl(p)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2 py-1 rounded-md inline-flex items-center gap-1 transition-opacity hover:opacity-80"
                style={{ backgroundColor: agentColor, color: 'var(--bg-primary)' }}
              >
                Directions
                <ExternalLink size={11} />
              </a>
              {showReservationLinks && (() => {
                const provider = reservationProviderFromWebsite(p.websiteUri);
                // If the official website is already a reservation platform, prefer it as the
                // primary CTA and avoid extra (often irrelevant) search links.
                if (provider && p.websiteUri) {
                  return (
                    <a
                      href={p.websiteUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-2 py-1 rounded-md inline-flex items-center gap-1 transition-opacity hover:opacity-80"
                      style={{ backgroundColor: agentColor, color: 'var(--bg-primary)' }}
                      aria-label={`Reserve ${p.name} on ${providerLabel(provider)}`}
                    >
                      Reserve on {providerLabel(provider)}
                      <ExternalLink size={11} />
                    </a>
                  );
                }
                const isJapan = isJapanAddress(p.address);
                return (
                  <>
                    {isJapan ? (
                      <>
                        <a
                          href={tabelogUrl(p)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-2 py-1 rounded-md inline-flex items-center gap-1 border transition-opacity hover:opacity-80"
                          style={{ borderColor: agentColor, color: agentColor }}
                          aria-label={`Search ${p.name} on Tabelog`}
                        >
                          Tabelog
                          <ExternalLink size={11} />
                        </a>
                        <a
                          href={gurunaviUrl(p)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-2 py-1 rounded-md inline-flex items-center gap-1 border transition-opacity hover:opacity-80"
                          style={{ borderColor: agentColor, color: agentColor }}
                          aria-label={`Search ${p.name} on Gurunavi`}
                        >
                          Gurunavi
                          <ExternalLink size={11} />
                        </a>
                      </>
                    ) : (
                      <a
                        href={openTableUrl(p)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-2 py-1 rounded-md inline-flex items-center gap-1 border transition-opacity hover:opacity-80"
                        style={{ borderColor: agentColor, color: agentColor }}
                        aria-label={`Search ${p.name} on OpenTable`}
                      >
                        OpenTable
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </>
                );
              })()}
              {/* Hide generic Website chip when it's already a reservation platform (Reserve CTA above). */}
              {p.websiteUri && reservationProviderFromWebsite(p.websiteUri) == null && (
                <a
                  href={p.websiteUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-1 rounded-md inline-flex items-center gap-1 border transition-opacity hover:opacity-80"
                  style={{ borderColor: agentColor, color: agentColor }}
                >
                  Website
                  <ExternalLink size={11} />
                </a>
              )}
              <div className="ml-auto">
                <SaveButton
                  kind="place"
                  externalId={p.id || p.name}
                  data={{
                    name: p.name,
                    address: p.address,
                    rating: p.rating,
                    priceLevel: p.priceLevel,
                    googleMapsUri: p.googleMapsUri,
                    websiteUri: p.websiteUri,
                  }}
                  agentColor={agentColor}
                  size={14}
                  label={`place ${p.name}`}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
