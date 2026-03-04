import { Building2, Star, MapPin, Bookmark, Check } from 'lucide-react';

interface HotelCardData {
  name: string;
  rating: number;
  address: string;
  pricePerNight: string;
  totalPrice: string;
  checkIn: string;
  checkOut: string;
  amenities: string[];
  bookingUrl?: string;
}

interface HotelCardProps {
  data: HotelCardData;
  agentColor: string;
  isSelected?: boolean;
  onSelect?: (data: HotelCardData) => void;
  onBookmark?: (data: HotelCardData) => void;
}

export function HotelCard({ data, agentColor, isSelected, onSelect, onBookmark }: HotelCardProps) {
  return (
    <div
      className="p-4 rounded-xl border transition-all"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: isSelected ? agentColor : 'var(--bg-surface-elevated)',
        boxShadow: isSelected ? `0 0 0 1px ${agentColor}` : undefined,
      }}
    >
      {/* Hotel name + rating */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded flex items-center justify-center"
            style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
          >
            <Building2 size={16} style={{ color: agentColor }} />
          </div>
          <div>
            <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
              {data.name}
            </div>
            {data.address && (
              <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <MapPin size={10} />
                {data.address}
              </div>
            )}
          </div>
        </div>

        {/* Star rating */}
        {data.rating > 0 && (
          <div className="flex items-center gap-0.5">
            {Array.from({ length: data.rating }).map((_, i) => (
              <Star key={i} size={12} fill={agentColor} style={{ color: agentColor }} />
            ))}
          </div>
        )}
      </div>

      {/* Dates */}
      <div
        className="flex items-center justify-between text-sm mb-3 px-3 py-2 rounded-lg"
        style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
      >
        <div>
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Check-in</div>
          <div style={{ color: 'var(--text-primary)' }}>{data.checkIn}</div>
        </div>
        <div className="text-right">
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Check-out</div>
          <div style={{ color: 'var(--text-primary)' }}>{data.checkOut}</div>
        </div>
      </div>

      {/* Amenities */}
      {data.amenities.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {data.amenities.map((amenity, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-full text-xs"
              style={{
                backgroundColor: agentColor + '15',
                color: agentColor,
              }}
            >
              {amenity}
            </span>
          ))}
        </div>
      )}

      {/* Price and action */}
      <div
        className="flex items-end justify-between pt-3 border-t"
        style={{ borderColor: 'var(--bg-surface-elevated)' }}
      >
        <div>
          <div className="text-2xl font-semibold" style={{ color: agentColor }}>
            {data.pricePerNight}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            per night &middot; {data.totalPrice} total
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onBookmark && (
            <button
              onClick={() => onBookmark(data)}
              className="px-3 py-1.5 rounded-full transition-colors text-sm flex items-center gap-1 border"
              style={{
                borderColor: agentColor + '40',
                color: agentColor,
                backgroundColor: 'transparent',
              }}
            >
              <Bookmark size={14} />
              Save
            </button>
          )}
          <button
            onClick={() => onSelect?.(data)}
            className="px-5 py-1.5 rounded-full transition-colors text-sm font-medium flex items-center gap-1.5"
            style={{
              backgroundColor: isSelected ? 'var(--success)' : agentColor,
              color: 'var(--bg-primary)',
            }}
          >
            {isSelected && <Check size={14} />}
            {isSelected ? 'Selected' : 'Select'}
          </button>
        </div>
      </div>
    </div>
  );
}
