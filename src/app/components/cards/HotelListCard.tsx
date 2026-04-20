import { ExternalLink, Hotel, Star, AlertCircle, MapPin } from 'lucide-react';
import type { HotelBookingLinkResult, HotelListData } from '../../types';

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

function BookingLinks({
  links,
  agentColor,
  fallbackUrl,
}: {
  links?: HotelBookingLinkResult[];
  agentColor: string;
  fallbackUrl: string;
}) {
  const list: HotelBookingLinkResult[] =
    links && links.length > 0
      ? links
      : [{ id: 'google', name: 'Google Hotels', url: fallbackUrl }];
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

export function HotelListCard({ data, agentColor }: HotelListCardProps) {
  const offers = data.offers ?? [];
  const { cityName, cityCode, checkIn, checkOut } = data.query;
  const city = cityName || cityCode;
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
              ? 'The live hotel-offers provider is temporarily unavailable. '
              : 'No live hotel offers found in '}
            <span className="font-semibold" style={{ color: agentColor }}>
              {city}
            </span>{' '}
            · {fmtDate(checkIn)} → {fmtDate(checkOut)}.
          </div>
        </div>
        <div style={{ color: 'var(--text-primary)' }}>
          Search directly on a booking site — these links are pre-filled with your city and dates:
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
          <Hotel className="inline w-3 h-3 mr-1 opacity-60" />
          <span style={{ color: agentColor }}>{city}</span> · {fmtDate(checkIn)} →{' '}
          {fmtDate(checkOut)}
        </div>
        <div>{offers.length} hotels</div>
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
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div
                className="font-semibold text-sm truncate"
                style={{ color: 'var(--text-primary)' }}
                title={offer.name}
              >
                {offer.name}
              </div>
              {offer.address && (
                <div
                  className="flex items-center gap-1 text-xs mt-0.5 truncate"
                  style={{ color: 'var(--text-secondary)' }}
                  title={offer.address}
                >
                  <MapPin className="w-3 h-3 flex-shrink-0 opacity-60" />
                  <span className="truncate">{offer.address}</span>
                </div>
              )}
              {typeof offer.rating === 'number' && offer.rating > 0 && (
                <div
                  className="flex items-center gap-0.5 text-xs mt-0.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <Star className="w-3 h-3" fill={agentColor} style={{ color: agentColor }} />
                  <span>{offer.rating}</span>
                </div>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              {offer.priceTotal ? (
                <div className="text-sm font-semibold" style={{ color: agentColor }}>
                  {offer.priceTotal} {offer.currency || ''}
                </div>
              ) : (
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Check rates
                </div>
              )}
            </div>
          </div>
        </a>
      ))}

      <div className="pt-1 pl-1" style={{ color: 'var(--text-secondary)' }}>
        <div className="text-xs mb-1">Or compare on other booking sites:</div>
        <BookingLinks
          links={data.bookingLinks}
          agentColor={agentColor}
          fallbackUrl={data.searchLink}
        />
      </div>
    </div>
  );
}
