import { MapPin, Phone, Globe, Star, ExternalLink, Clock, UtensilsCrossed, DollarSign, Users } from 'lucide-react';

export interface ResySlotData {
  time: string;
  type: string;
  configToken: string;
}

export interface RestaurantCardData {
  id: string;
  name: string;
  address: string;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: string | null;
  types: string[];
  phone: string | null;
  website: string | null;
  googleMapsUrl: string | null;
  openNow: boolean | null;
  photoUrl: string | null;
  editorialSummary: string | null;
  // Resy-specific fields
  venueId?: number;
  neighborhood?: string;
  slots?: ResySlotData[];
  hasAvailability?: boolean;
}

interface RestaurantCardProps {
  data: RestaurantCardData;
  agentColor: string;
  onReserve?: (data: RestaurantCardData) => void;
  onBook?: (data: RestaurantCardData) => void;
  onSelectSlot?: (slot: ResySlotData & { venueId: number; venueName: string }) => void;
}

function RatingStars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.3;
  const stars = [];

  for (let i = 0; i < 5; i++) {
    if (i < full) {
      stars.push(<Star key={i} size={11} fill="currentColor" className="text-yellow-400" />);
    } else if (i === full && hasHalf) {
      stars.push(<Star key={i} size={11} fill="currentColor" className="text-yellow-400 opacity-50" />);
    } else {
      stars.push(<Star key={i} size={11} className="text-yellow-400 opacity-25" />);
    }
  }

  return <div className="flex items-center gap-px">{stars}</div>;
}

function formatSlotTime(timeStr: string): string {
  try {
    const parts = timeStr.split(' ');
    const timePart = parts.length > 1 ? parts[1] : timeStr;
    const [h, m] = timePart.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
  } catch {
    return timeStr;
  }
}

export function RestaurantCard({ data, agentColor, onReserve, onBook, onSelectSlot }: RestaurantCardProps) {
  const rating = data.rating != null ? Number(data.rating) : null;
  const hasSlots = data.slots && data.slots.length > 0 && onSelectSlot && data.venueId;

  return (
    <div
      className="rounded-xl overflow-hidden border transition-all"
      style={{
        borderColor: 'var(--bg-surface-elevated)',
        backgroundColor: 'var(--bg-surface)',
      }}
    >
      {/* Photo header */}
      {data.photoUrl ? (
        <div className="relative h-40 w-full overflow-hidden">
          <img
            src={data.photoUrl}
            alt={data.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 40%, transparent 60%)',
            }}
          />

          {/* Top-right badges */}
          <div className="absolute top-2 right-2 flex items-center gap-1.5">
            {data.priceLevel && (
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm"
                style={{ backgroundColor: 'rgba(0,0,0,0.55)', color: '#4ade80' }}
              >
                {data.priceLevel}
              </span>
            )}
            {data.openNow !== null && (
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm"
                style={{
                  backgroundColor: data.openNow ? 'rgba(34,197,94,0.85)' : 'rgba(239,68,68,0.85)',
                  color: 'white',
                }}
              >
                {data.openNow ? 'Open' : 'Closed'}
              </span>
            )}
          </div>

          {/* Bottom overlay: name + meta */}
          <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5 pt-6">
            <h3 className="font-bold text-white text-[15px] leading-tight drop-shadow-md">
              {data.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              {rating != null && rating > 0 && (
                <div className="flex items-center gap-1">
                  <RatingStars rating={rating} />
                  <span className="text-[11px] font-semibold text-white/90">
                    {rating.toFixed(1)}
                  </span>
                  {data.reviewCount != null && data.reviewCount > 0 && (
                    <span className="text-[10px] text-white/60">
                      ({data.reviewCount})
                    </span>
                  )}
                </div>
              )}
              {data.neighborhood && (
                <span className="text-[10px] text-white/70 font-medium">
                  {data.neighborhood}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* No-photo header */
        <div
          className="px-3 py-3"
          style={{
            background: `linear-gradient(135deg, ${agentColor}22, ${agentColor}08)`,
          }}
        >
          <div className="flex items-start justify-between">
            <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
              {data.name}
            </h3>
            <div className="flex items-center gap-1.5">
              {data.priceLevel && (
                <span
                  className="text-[11px] font-bold px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: `${agentColor}15`, color: agentColor }}
                >
                  {data.priceLevel}
                </span>
              )}
              {data.openNow !== null && (
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
                  style={{
                    backgroundColor: data.openNow ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    color: data.openNow ? '#22c55e' : '#ef4444',
                  }}
                >
                  <Clock size={9} />
                  {data.openNow ? 'Open' : 'Closed'}
                </span>
              )}
            </div>
          </div>
          {/* Rating row for no-photo cards */}
          {(rating != null || data.neighborhood) && (
            <div className="flex items-center gap-2 mt-1.5">
              {rating != null && rating > 0 && (
                <div className="flex items-center gap-1">
                  <RatingStars rating={rating} />
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {rating.toFixed(1)}
                  </span>
                  {data.reviewCount != null && data.reviewCount > 0 && (
                    <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                      ({data.reviewCount})
                    </span>
                  )}
                </div>
              )}
              {data.neighborhood && (
                <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {data.neighborhood}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-3 space-y-2">
        {/* Editorial summary */}
        {data.editorialSummary && (
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {data.editorialSummary}
          </p>
        )}

        {/* Cuisine tags */}
        {data.types.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {data.types.map((type) => (
              <span
                key={type}
                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: `${agentColor}12`, color: agentColor }}
              >
                {type}
              </span>
            ))}
          </div>
        )}

        {/* Address */}
        <div className="flex items-start gap-1.5">
          <MapPin size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0, marginTop: 2 }} />
          <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {data.address}
          </span>
        </div>

        {/* Contact row */}
        {(data.phone || data.website) && (
          <div className="flex items-center gap-3 flex-wrap">
            {data.phone && (
              <a
                href={`tel:${data.phone}`}
                className="flex items-center gap-1 text-[11px] hover:underline"
                style={{ color: agentColor }}
              >
                <Phone size={11} />
                {data.phone}
              </a>
            )}
            {data.website && (
              <a
                href={data.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] hover:underline"
                style={{ color: agentColor }}
              >
                <Globe size={11} />
                {data.website.includes('resy.com') ? 'View on Resy' : 'Website'}
              </a>
            )}
          </div>
        )}

        {/* Time slot pills (Resy availability) */}
        {hasSlots && (
          <div className="space-y-1.5 pt-0.5">
            <p className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
              Available times — tap to book:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.slots!.map((slot, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelectSlot!({ ...slot, venueId: data.venueId!, venueName: data.name })}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                  style={{
                    backgroundColor: agentColor + '18',
                    color: agentColor,
                    border: `1px solid ${agentColor}30`,
                  }}
                  title={slot.type || 'Dining Room'}
                >
                  {formatSlotTime(slot.time)}
                  {slot.type && slot.type !== 'Dining Room' && (
                    <span className="ml-1 opacity-60 text-[9px]">{slot.type}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-0.5">
          {onBook && data.website && !hasSlots && (
            <button
              onClick={() => onBook(data)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: agentColor, color: 'white' }}
            >
              <UtensilsCrossed size={13} />
              Book Now
            </button>
          )}
          {onReserve && !(onBook && data.website) && !hasSlots && (
            <button
              onClick={() => onReserve(data)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: agentColor, color: 'white' }}
            >
              <UtensilsCrossed size={13} />
              Reserve a Table
            </button>
          )}
          {data.googleMapsUrl && (
            <a
              href={data.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg transition-colors"
              style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
              title="View on Google Maps"
            >
              <ExternalLink size={14} style={{ color: 'var(--text-secondary)' }} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
