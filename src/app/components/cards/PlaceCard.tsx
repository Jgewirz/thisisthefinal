import { MapPin, Phone, Globe, Star, ExternalLink, Clock, Bookmark, Check } from 'lucide-react';

interface PlaceCardData {
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
}

interface PlaceCardProps {
  data: PlaceCardData;
  agentColor: string;
  isSelected?: boolean;
  onSelect?: (data: PlaceCardData) => void;
  onBookmark?: (data: PlaceCardData) => void;
}

function RatingStars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.3;
  const stars = [];

  for (let i = 0; i < 5; i++) {
    if (i < full) {
      stars.push(
        <Star key={i} size={12} fill="currentColor" className="text-yellow-400" />
      );
    } else if (i === full && hasHalf) {
      stars.push(
        <Star key={i} size={12} fill="currentColor" className="text-yellow-400 opacity-50" />
      );
    } else {
      stars.push(
        <Star key={i} size={12} className="text-yellow-400 opacity-25" />
      );
    }
  }

  return <div className="flex items-center gap-px">{stars}</div>;
}

export function PlaceCard({ data, agentColor, isSelected, onSelect, onBookmark }: PlaceCardProps) {
  return (
    <div
      className="rounded-xl overflow-hidden border transition-all"
      style={{
        borderColor: isSelected ? agentColor : 'var(--bg-surface-elevated)',
        backgroundColor: 'var(--bg-surface)',
      }}
    >
      {/* Photo header */}
      {data.photoUrl ? (
        <div className="relative h-36 w-full overflow-hidden">
          <img
            src={data.photoUrl}
            alt={data.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)',
            }}
          />
          {/* Open/Closed badge */}
          {data.openNow !== null && (
            <div className="absolute top-2 right-2">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: data.openNow ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)',
                  color: 'white',
                }}
              >
                {data.openNow ? 'Open' : 'Closed'}
              </span>
            </div>
          )}
          {/* Name overlay on photo */}
          <div className="absolute bottom-2 left-3 right-3">
            <h3 className="font-bold text-white text-base leading-tight drop-shadow-md">
              {data.name}
            </h3>
          </div>
        </div>
      ) : (
        /* No photo — gradient header fallback */
        <div
          className="px-3 py-3 flex items-center justify-between"
          style={{
            background: `linear-gradient(135deg, ${agentColor}22, ${agentColor}08)`,
          }}
        >
          <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
            {data.name}
          </h3>
          {data.openNow !== null && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{
                backgroundColor: data.openNow ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: data.openNow ? '#22c55e' : '#ef4444',
              }}
            >
              <Clock size={10} />
              {data.openNow ? 'Open' : 'Closed'}
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-3 space-y-2.5">
        {/* Rating + Price row */}
        {(data.rating || data.priceLevel) && (
          <div className="flex items-center gap-2 flex-wrap">
            {data.rating && (
              <>
                <RatingStars rating={data.rating} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {data.rating.toFixed(1)}
                </span>
                {data.reviewCount && (
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    ({data.reviewCount.toLocaleString()})
                  </span>
                )}
              </>
            )}
            {data.priceLevel && (
              <span
                className="text-xs font-semibold px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: `${agentColor}15`,
                  color: agentColor,
                }}
              >
                {data.priceLevel}
              </span>
            )}
          </div>
        )}

        {/* Editorial summary */}
        {data.editorialSummary && (
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {data.editorialSummary}
          </p>
        )}

        {/* Type tags */}
        {data.types.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {data.types.map((type) => (
              <span
                key={type}
                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: `${agentColor}12`,
                  color: agentColor,
                }}
              >
                {type}
              </span>
            ))}
          </div>
        )}

        {/* Address */}
        <div className="flex items-start gap-1.5">
          <MapPin size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0, marginTop: 2 }} />
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {data.address}
          </span>
        </div>

        {/* Contact links */}
        <div className="flex items-center gap-3 flex-wrap">
          {data.phone && (
            <a
              href={`tel:${data.phone}`}
              className="flex items-center gap-1 text-xs hover:underline"
              style={{ color: agentColor }}
            >
              <Phone size={12} />
              {data.phone}
            </a>
          )}
          {data.website && (
            <a
              href={data.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs hover:underline"
              style={{ color: agentColor }}
            >
              <Globe size={12} />
              Website
            </a>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1">
          {data.googleMapsUrl && (
            <a
              href={data.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: agentColor, color: 'white' }}
            >
              <ExternalLink size={13} />
              View on Google Maps
            </a>
          )}
          {onBookmark && (
            <button
              onClick={() => onBookmark(data)}
              className="p-2 rounded-lg transition-colors"
              style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
              title="Save place"
            >
              <Bookmark size={14} style={{ color: 'var(--text-secondary)' }} />
            </button>
          )}
          {onSelect && (
            <button
              onClick={() => onSelect(data)}
              className="p-2 rounded-lg transition-colors"
              style={{
                backgroundColor: isSelected ? agentColor : 'var(--bg-surface-elevated)',
              }}
              title={isSelected ? 'Added to trip' : 'Add to trip'}
            >
              <Check
                size={14}
                style={{ color: isSelected ? 'white' : 'var(--text-secondary)' }}
              />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
