import { ExternalLink, Plane, AlertCircle } from 'lucide-react';
import type {
  BookingProviderLinkResult,
  FlightListData,
  FlightItineraryResult,
} from '../../types';

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

function Itinerary({ itin }: { itin: FlightItineraryResult }) {
  const first = itin.segments[0];
  const last = itin.segments[itin.segments.length - 1];
  if (!first || !last) return null;
  return (
    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-primary)' }}>
      <div className="font-semibold">{fmtTime(first.departAt)}</div>
      <div style={{ color: 'var(--text-secondary)' }}>{first.from}</div>
      <Plane className="w-3 h-3 opacity-60" />
      <div style={{ color: 'var(--text-secondary)' }}>
        {fmtDuration(itin.durationMinutes)} ·{' '}
        {itin.stops === 0
          ? 'Nonstop'
          : `${itin.stops} stop${itin.stops > 1 ? 's' : ''}`}
      </div>
      <div style={{ color: 'var(--text-secondary)' }}>{last.to}</div>
      <div className="font-semibold">{fmtTime(last.arriveAt)}</div>
    </div>
  );
}

function BookingLinks({
  links,
  agentColor,
  fallbackUrl,
}: {
  links?: BookingProviderLinkResult[];
  agentColor: string;
  fallbackUrl: string;
}) {
  const list: BookingProviderLinkResult[] =
    links && links.length > 0
      ? links
      : [{ id: 'google', name: 'Google Flights', url: fallbackUrl }];
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {list.map((l) => (
        <a
          key={l.id}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium hover:opacity-90"
          style={{
            backgroundColor: 'var(--bg-elevated, rgba(0,0,0,0.04))',
            color: agentColor,
            border: `1px solid ${agentColor}33`,
          }}
        >
          {l.name} <ExternalLink className="w-3 h-3" />
        </a>
      ))}
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
        style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
      >
        <div className="flex items-start gap-2">
          {hadError && (
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: agentColor }} />
          )}
          <div>
            {hadError
              ? 'The live flight-offers provider is temporarily unavailable. '
              : 'No live flight offers found for '}
            <span className="font-semibold" style={{ color: agentColor }}>
              {origin} → {destination}
            </span>{' '}
            on {fmtDate(departDate) || departDate}
            {returnDate ? ` · return ${fmtDate(returnDate)}` : ''}.
          </div>
        </div>
        <div style={{ color: 'var(--text-primary)' }}>
          Search directly on a booking site — these links are pre-filled with your route and date:
        </div>
        <BookingLinks
          links={data.bookingLinks}
          agentColor={agentColor}
          fallbackUrl={data.searchLink}
        />
      </div>
    );
  }

  return (
    <div
      className="p-3 rounded-xl space-y-2"
      style={{ backgroundColor: 'var(--bg-surface)' }}
    >
      <div
        className="flex items-center justify-between px-1 text-xs"
        style={{ color: 'var(--text-secondary)' }}
      >
        <div>
          <span style={{ color: agentColor }}>
            {origin} → {destination}
          </span>{' '}
          · {fmtDate(departDate) || departDate}
          {returnDate ? ` · return ${fmtDate(returnDate)}` : ''}
        </div>
        <div>{offers.length} offers</div>
      </div>

      {offers.slice(0, 5).map((offer) => (
        <a
          key={offer.id}
          href={offer.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block p-3 rounded-lg hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--bg-elevated, rgba(0,0,0,0.03))' }}
        >
          <div className="flex items-center justify-between mb-1">
            <div
              className="text-xs font-medium uppercase tracking-wide"
              style={{ color: 'var(--text-secondary)' }}
            >
              {offer.itineraries[0]?.segments[0]?.carrier || 'Multiple'}
              {offer.itineraries[0]?.segments[0]?.flightNumber
                ? ` · ${offer.itineraries[0].segments[0].flightNumber}`
                : ''}
            </div>
            <div className="text-sm font-semibold" style={{ color: agentColor }}>
              {offer.priceTotal} {offer.currency}
            </div>
          </div>
          <div className="space-y-1">
            {offer.itineraries.map((itin, idx) => (
              <Itinerary key={idx} itin={itin} />
            ))}
          </div>
        </a>
      ))}

      <div className="pt-1 pl-1" style={{ color: 'var(--text-secondary)' }}>
        <div className="text-xs mb-1">Or search other booking sites:</div>
        <BookingLinks
          links={data.bookingLinks}
          agentColor={agentColor}
          fallbackUrl={data.searchLink}
        />
      </div>
    </div>
  );
}
