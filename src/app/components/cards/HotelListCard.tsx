import { ExternalLink, Hotel, AlertCircle, MapPin, Moon } from 'lucide-react';
import type { HotelBookingLinkResult, HotelListData } from '../../types';
import { SaveButton } from '../SaveButton';
import { useMemo, useState } from 'react';

interface HotelListCardProps {
  data: HotelListData;
  agentColor: string;
}

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function nightCount(checkIn: string, checkOut: string): number {
  const n = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Renders N filled + (5-N) empty Unicode stars as a tinted badge. */
function StarBadge({ count, agentColor }: { count: number; agentColor: string }) {
  const n = Math.min(5, Math.max(1, Math.round(count)));
  return (
    <span
      className="inline-flex items-center gap-px px-1.5 py-0.5 rounded text-xs font-medium tracking-tight shrink-0"
      style={{ backgroundColor: `${agentColor}22`, color: agentColor }}
    >
      {'★'.repeat(n)}
      <span style={{ opacity: 0.3 }}>{'★'.repeat(5 - n)}</span>
    </span>
  );
}

function BookingLinks({
  links,
  agentColor,
  fallbackUrl,
  primaryId,
}: {
  links?: HotelBookingLinkResult[];
  agentColor: string;
  fallbackUrl: string;
  primaryId?: string;
}) {
  const list: HotelBookingLinkResult[] =
    links && links.length > 0
      ? links
      : [{ id: 'google', name: 'Google Hotels', url: fallbackUrl }];
  const primary = primaryId ? list.find((l) => l.id === primaryId) : undefined;
  const secondary = primary ? list.filter((l) => l.id !== primaryId) : list;

  return (
    <div className="space-y-2 pt-1">
      {primary && (
        <a
          href={primary.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
          style={{ backgroundColor: agentColor, color: '#fff' }}
        >
          Search on {primary.name} <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
      {secondary.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {secondary.map((l) => (
            <a
              key={l.id}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium hover:opacity-80 transition-opacity"
              style={{
                backgroundColor: `${agentColor}14`,
                color: agentColor,
                border: `1px solid ${agentColor}33`,
              }}
            >
              {l.name} <ExternalLink className="w-3 h-3" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function HotelListCard({ data, agentColor }: HotelListCardProps) {
  const offers = data.offers ?? [];
  const { cityName, cityCode, checkIn, checkOut } = data.query;
  const city = cityName || cityCode;
  const hadError = Boolean(data.providerError);
  const nights = nightCount(checkIn, checkOut);
  const [expanded, setExpanded] = useState(false);
  const defaultVisible = 8;
  const hasMore = offers.length > defaultVisible;

  const visibleOffers = useMemo(() => {
    if (!hasMore) return offers;
    return expanded ? offers : offers.slice(0, defaultVisible);
  }, [offers, expanded, hasMore]);

  if (offers.length === 0) {
    return (
      <div
        className="p-4 rounded-xl text-sm space-y-3"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: `1px solid ${agentColor}22`,
          color: 'var(--text-secondary)',
        }}
      >
        <div className="flex items-start gap-2">
          {hadError && (
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: agentColor }} />
          )}
          <div>
            {hadError ? 'Live hotel data is temporarily unavailable. ' : 'No live hotel offers found in '}
            <span className="font-semibold" style={{ color: agentColor }}>{city}</span>
            {' '}· {fmtDate(checkIn)} → {fmtDate(checkOut)}.
          </div>
        </div>
        <div style={{ color: 'var(--text-primary)' }}>
          {hadError
            ? 'Continue your search on Google Hotels — the link is pre-filled with your city and dates:'
            : 'Try searching on a booking site — links are pre-filled with your city and dates:'}
        </div>
        <BookingLinks
          links={data.bookingLinks}
          agentColor={agentColor}
          fallbackUrl={data.searchLink}
          primaryId={hadError ? 'google' : undefined}
        />
      </div>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: `1px solid ${agentColor}22`,
      }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{
          backgroundColor: `${agentColor}12`,
          borderBottom: `1px solid ${agentColor}22`,
        }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Hotel className="w-3.5 h-3.5 shrink-0" style={{ color: agentColor }} />
          <span className="text-xs font-semibold truncate" style={{ color: agentColor }}>
            {city}
          </span>
          <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
            · {fmtDate(checkIn)} → {fmtDate(checkOut)}
          </span>
        </div>
        <span
          className="shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ml-2"
          style={{ backgroundColor: `${agentColor}22`, color: agentColor }}
        >
          {offers.length} hotels
        </span>
      </div>

      {/* Hotel rows */}
      <ul className="divide-y" style={{ borderColor: `${agentColor}12` }}>
        {visibleOffers.map((offer) => (
          <li key={offer.id} className="relative">
            {/* Clickable main area */}
            <a
              href={offer.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-3 pr-10 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--bg-primary)' }}
              aria-label={`Book ${offer.name}`}
            >
              {/* Name */}
              <div
                className="font-semibold text-sm leading-snug mb-1.5"
                style={{ color: 'var(--text-primary)' }}
              >
                {offer.name}
              </div>

              {/* Chips row: stars + city */}
              <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                {typeof offer.rating === 'number' && offer.rating > 0 && (
                  <StarBadge count={offer.rating} agentColor={agentColor} />
                )}
                {offer.cityName && (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {offer.cityName}
                  </span>
                )}
              </div>

              {/* Address */}
              {offer.address && (
                <div
                  className="flex items-center gap-1 text-xs mb-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <MapPin className="w-2.5 h-2.5 shrink-0 opacity-60" />
                  <span className="truncate">{offer.address}</span>
                </div>
              )}

              {/* Footer: nights + price + book CTA */}
              <div className="flex items-center gap-2 flex-wrap mt-1">
                {nights > 0 && (
                  <span
                    className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <Moon className="w-2.5 h-2.5" />
                    {nights} night{nights !== 1 ? 's' : ''}
                  </span>
                )}
                {offer.priceTotal ? (
                  <span
                    className="text-sm font-bold px-2 py-0.5 rounded"
                    style={{ backgroundColor: `${agentColor}22`, color: agentColor }}
                  >
                    {offer.priceTotal} {offer.currency || ''}
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Check rates
                  </span>
                )}
                <span
                  className="ml-auto inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium"
                  style={{ backgroundColor: agentColor, color: '#fff' }}
                >
                  Book <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </a>

            {/* Save button — absolute, clear of text */}
            <div className="absolute top-3 right-2">
              <SaveButton
                kind="hotel"
                externalId={offer.hotelId || offer.id}
                data={{
                  name: offer.name,
                  address: offer.address,
                  cityName: offer.cityName,
                  priceTotal: offer.priceTotal,
                  currency: offer.currency,
                  checkIn: offer.checkIn,
                  checkOut: offer.checkOut,
                  bookingUrl: offer.bookingUrl,
                }}
                agentColor={agentColor}
                label={`hotel ${offer.name}`}
              />
            </div>
          </li>
        ))}
      </ul>

      {/* Expand / collapse */}
      {hasMore && (
        <div
          className="px-3 py-2 flex items-center justify-center"
          style={{ borderTop: `1px solid ${agentColor}12`, backgroundColor: 'var(--bg-primary)' }}
        >
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full transition-opacity hover:opacity-90"
            style={{
              color: agentColor,
              backgroundColor: `${agentColor}14`,
              border: `1px solid ${agentColor}33`,
            }}
            aria-label={expanded ? 'Show fewer hotels' : 'Show all hotels'}
          >
            {expanded ? 'Show less' : `Show all (${offers.length})`}
          </button>
        </div>
      )}

      {/* Compare footer */}
      <div
        className="px-3 pt-2 pb-3"
        style={{ borderTop: `1px solid ${agentColor}22` }}
      >
        <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Compare on other booking sites:
        </p>
        <BookingLinks
          links={data.bookingLinks}
          agentColor={agentColor}
          fallbackUrl={data.searchLink}
          primaryId={undefined}
        />
      </div>
    </div>
  );
}
