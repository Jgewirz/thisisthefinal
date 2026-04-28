import { ExternalLink, Plane, AlertCircle } from 'lucide-react';
import type {
  BookingProviderLinkResult,
  FlightListData,
  FlightItineraryResult,
} from '../../../core/types';
import { SaveButton } from '../SaveButton';

interface FlightListCardProps {
  data: FlightListData;
  agentColor: string;
}

function fmtDuration(mins: number): string {
  if (!mins || mins < 1) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function Itinerary({ itin, agentColor }: { itin: FlightItineraryResult; agentColor: string }) {
  const first = itin.segments[0];
  const last = itin.segments[itin.segments.length - 1];
  if (!first || !last) return null;
  const stopLabel = itin.stops === 0 ? 'Nonstop' : `${itin.stops} stop${itin.stops > 1 ? 's' : ''}`;
  return (
    <div className="text-xs space-y-1">
      {/* Route: times + airport codes */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
          {fmtTime(first.departAt)}
        </span>
        <span
          className="font-semibold px-1.5 py-px rounded text-[11px]"
          style={{ backgroundColor: `${agentColor}22`, color: agentColor }}
        >
          {first.from}
        </span>
        <Plane className="w-3 h-3 shrink-0" style={{ color: agentColor, opacity: 0.7 }} />
        <span
          className="font-semibold px-1.5 py-px rounded text-[11px]"
          style={{ backgroundColor: `${agentColor}22`, color: agentColor }}
        >
          {last.to}
        </span>
        <span className="font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
          {fmtTime(last.arriveAt)}
        </span>
      </div>
      {/* Duration + stops chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {fmtDuration(itin.durationMinutes) && (
          <span
            className="px-1.5 py-px rounded text-[11px]"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              color: 'var(--text-secondary)',
            }}
          >
            {fmtDuration(itin.durationMinutes)}
          </span>
        )}
        <span
          className="px-1.5 py-px rounded text-[11px]"
          style={{
            backgroundColor: itin.stops === 0 ? `${agentColor}18` : 'var(--bg-surface-elevated)',
            color: itin.stops === 0 ? agentColor : 'var(--text-secondary)',
          }}
        >
          {stopLabel}
        </span>
        {fmtDate(first.departAt) && (
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {fmtDate(first.departAt)}
          </span>
        )}
      </div>
    </div>
  );
}

function BookingLinks({
  links,
  agentColor,
  fallbackUrl,
  primaryId,
}: {
  links?: BookingProviderLinkResult[];
  agentColor: string;
  fallbackUrl: string;
  primaryId?: string;
}) {
  const list: BookingProviderLinkResult[] =
    links && links.length > 0
      ? links
      : [{ id: 'google', name: 'Google Flights', url: fallbackUrl }];
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

export function FlightListCard({ data, agentColor }: FlightListCardProps) {
  const offers = data.offers ?? [];
  const { origin, destination, departDate, returnDate } = data.query;
  const hadError = Boolean(data.providerError);

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
            {hadError ? 'Live flight data is temporarily unavailable. ' : 'No live flight offers found for '}
            <span className="font-semibold" style={{ color: agentColor }}>
              {origin} → {destination}
            </span>
            {' '}on {fmtDate(departDate) || departDate}
            {returnDate ? ` · return ${fmtDate(returnDate)}` : ''}.
          </div>
        </div>
        <div style={{ color: 'var(--text-primary)' }}>
          {hadError
            ? 'Continue your search on Google Flights — the link is pre-filled with your route and date:'
            : 'Try searching on a booking site — links are pre-filled with your route and date:'}
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
          <Plane className="w-3.5 h-3.5 shrink-0" style={{ color: agentColor }} />
          <span className="text-xs font-semibold" style={{ color: agentColor }}>
            {origin} → {destination}
          </span>
          <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
            · {fmtDate(departDate) || departDate}
            {returnDate ? ` · return ${fmtDate(returnDate)}` : ''}
          </span>
        </div>
        <span
          className="shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ml-2"
          style={{ backgroundColor: `${agentColor}22`, color: agentColor }}
        >
          {offers.length} offer{offers.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Flight rows */}
      <ul className="divide-y" style={{ borderColor: `${agentColor}12` }}>
        {offers.map((offer) => (
          <li key={offer.id} className="relative">
            <a
              href={offer.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-3 pr-10 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--bg-primary)' }}
              aria-label={`Book flight ${offer.id}`}
            >
              {/* Carrier + price row */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <span
                  className="text-xs font-medium uppercase tracking-wide"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {offer.itineraries[0]?.segments[0]?.carrier || 'Multiple'}
                  {offer.itineraries[0]?.segments[0]?.flightNumber
                    ? ` · ${offer.itineraries[0].segments[0].flightNumber}`
                    : ''}
                </span>
                <span
                  className="shrink-0 text-sm font-bold px-2 py-0.5 rounded tabular-nums"
                  style={{ backgroundColor: `${agentColor}22`, color: agentColor }}
                >
                  {offer.priceTotal} {offer.currency}
                </span>
              </div>

              {/* Itineraries */}
              <div className="space-y-2">
                {offer.itineraries.map((itin, idx) => (
                  <Itinerary key={idx} itin={itin} agentColor={agentColor} />
                ))}
              </div>

              {/* Book CTA */}
              <div className="flex justify-end mt-2.5">
                <span
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-medium"
                  style={{ backgroundColor: agentColor, color: '#fff' }}
                >
                  Book <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </a>

            {/* Save button */}
            <div className="absolute top-3 right-2">
              <SaveButton
                kind="flight"
                externalId={offer.id}
                data={{
                  priceTotal: offer.priceTotal,
                  currency: offer.currency,
                  bookingUrl: offer.bookingUrl,
                  itineraries: offer.itineraries,
                }}
                agentColor={agentColor}
                label="flight"
              />
            </div>
          </li>
        ))}
      </ul>

      {/* Compare footer */}
      <div
        className="px-3 pt-2 pb-3"
        style={{ borderTop: `1px solid ${agentColor}22` }}
      >
        <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Or compare on other booking sites:
        </p>
        <BookingLinks
          links={data.bookingLinks}
          agentColor={agentColor}
          fallbackUrl={data.searchLink}
        />
      </div>
    </div>
  );
}
