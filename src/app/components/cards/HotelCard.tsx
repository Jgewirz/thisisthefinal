import {
  Building2, Star, MapPin, Bookmark, Check, ExternalLink,
  BedDouble, Coffee, Wifi, Dumbbell, ParkingCircle, Waves,
  UtensilsCrossed, Wind, ShieldCheck, CalendarDays, Moon, CreditCard,
  Ban, CircleAlert, ArrowRight,
} from 'lucide-react';

interface HotelCardData {
  name: string;
  rating: number;
  address: string;
  pricePerNight: string;
  totalPrice: string;
  checkIn: string;
  checkOut: string;
  nights?: number;
  amenities: string[];
  bookingUrl?: string;
  roomType?: string;
  bedType?: string;
  roomDescription?: string;
  boardType?: string;
  cancellation?: {
    type: 'FREE' | 'PARTIAL' | 'NON_REFUNDABLE';
    deadline?: string;
    fee?: string;
  };
  paymentType?: string;
  basePricePerNight?: string;
  taxes?: string;
  cityCode?: string;
}

interface HotelCardProps {
  data: HotelCardData;
  agentColor: string;
  isSelected?: boolean;
  onSelect?: (data: HotelCardData) => void;
  onBookmark?: (data: HotelCardData) => void;
}

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getRatingTier(rating: number): { label: string; color: string } {
  if (rating >= 5) return { label: 'Luxury', color: 'var(--accent-lifestyle)' };
  if (rating >= 4) return { label: 'Upscale', color: 'var(--accent-travel)' };
  if (rating >= 3) return { label: 'Mid-Range', color: 'var(--success)' };
  return { label: 'Budget', color: 'var(--text-secondary)' };
}

function AmenityIcon({ name }: { name: string }) {
  const lower = name.toLowerCase();
  if (lower.includes('wifi') || lower.includes('internet') || lower.includes('wireless'))
    return <Wifi size={10} />;
  if (lower.includes('pool') || lower.includes('swimming'))
    return <Waves size={10} />;
  if (lower.includes('gym') || lower.includes('fitness'))
    return <Dumbbell size={10} />;
  if (lower.includes('parking') || lower.includes('valet'))
    return <ParkingCircle size={10} />;
  if (lower.includes('restaurant') || lower.includes('dining') || lower.includes('bar'))
    return <UtensilsCrossed size={10} />;
  if (lower.includes('breakfast') || lower.includes('coffee'))
    return <Coffee size={10} />;
  if (lower.includes('air') || lower.includes('conditioning'))
    return <Wind size={10} />;
  return null;
}

function CancellationBadge({ cancellation, agentColor }: { cancellation: HotelCardData['cancellation']; agentColor: string }) {
  if (!cancellation) return null;

  if (cancellation.type === 'FREE') {
    return (
      <span
        className="px-2 py-0.5 rounded-full text-xs flex items-center gap-1"
        style={{ backgroundColor: 'var(--success)' + '20', color: 'var(--success)' }}
      >
        <ShieldCheck size={10} />
        Free cancellation
        {cancellation.deadline && (
          <span className="opacity-70">until {formatDateLabel(cancellation.deadline.split('T')[0])}</span>
        )}
      </span>
    );
  }

  if (cancellation.type === 'PARTIAL') {
    return (
      <span
        className="px-2 py-0.5 rounded-full text-xs flex items-center gap-1"
        style={{ backgroundColor: 'var(--warning)' + '20', color: 'var(--warning)' }}
      >
        <CircleAlert size={10} />
        {cancellation.fee} cancellation fee
      </span>
    );
  }

  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs flex items-center gap-1"
      style={{ backgroundColor: 'var(--error, #ef4444)' + '20', color: 'var(--error, #ef4444)' }}
    >
      <Ban size={10} />
      Non-refundable
    </span>
  );
}

export function HotelCard({ data, agentColor, isSelected, onSelect, onBookmark }: HotelCardProps) {
  const tier = data.rating > 0 ? getRatingTier(data.rating) : null;
  const nights = data.nights || Math.max(1, Math.ceil(
    (new Date(data.checkOut).getTime() - new Date(data.checkIn).getTime()) / (1000 * 60 * 60 * 24)
  ));

  return (
    <div
      className="p-4 rounded-xl border transition-all"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: isSelected ? agentColor : 'var(--bg-surface-elevated)',
        boxShadow: isSelected ? `0 0 0 1px ${agentColor}` : undefined,
      }}
    >
      {/* Header: Hotel name + tier badge */}
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

        <div className="flex flex-col items-end gap-1">
          {/* Star rating */}
          {data.rating > 0 && (
            <div className="flex items-center gap-0.5">
              {Array.from({ length: data.rating }).map((_, i) => (
                <Star key={i} size={12} fill={agentColor} style={{ color: agentColor }} />
              ))}
            </div>
          )}
          {/* Tier badge */}
          {tier && (
            <div
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{
                backgroundColor: tier.color + '20',
                color: tier.color,
              }}
            >
              {tier.label}
            </div>
          )}
        </div>
      </div>

      {/* Stay timeline: Check-in → Nights → Check-out */}
      <div className="mb-3">
        <div className="flex items-center justify-between">
          {/* Check-in */}
          <div className="flex-shrink-0">
            <div className="text-xs uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-secondary)' }}>
              Check-in
            </div>
            <div className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {formatDateLabel(data.checkIn)}
            </div>
          </div>

          {/* Duration connector */}
          <div className="flex-1 flex flex-col items-center px-3 min-w-0">
            <div className="w-full flex items-center gap-1">
              <div className="flex-1 h-px" style={{ backgroundColor: agentColor + '40' }} />
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: agentColor }}
              />
              <div className="flex-1 h-px" style={{ backgroundColor: agentColor + '40' }} />
            </div>
            <div className="flex items-center gap-1 mt-1">
              <Moon size={11} style={{ color: 'var(--text-secondary)' }} />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {nights} night{nights !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Check-out */}
          <div className="flex-shrink-0 text-right">
            <div className="text-xs uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-secondary)' }}>
              Check-out
            </div>
            <div className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {formatDateLabel(data.checkOut)}
            </div>
          </div>
        </div>
      </div>

      {/* Room details + policies pills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {data.roomType && (
          <span
            className="px-2 py-0.5 rounded-full text-xs flex items-center gap-1"
            style={{ backgroundColor: agentColor + '15', color: agentColor }}
          >
            <CalendarDays size={10} />
            {data.roomType}
          </span>
        )}
        {data.bedType && (
          <span
            className="px-2 py-0.5 rounded-full text-xs flex items-center gap-1"
            style={{ backgroundColor: agentColor + '15', color: agentColor }}
          >
            <BedDouble size={10} />
            {data.bedType}
          </span>
        )}
        {data.boardType && (
          <span
            className="px-2 py-0.5 rounded-full text-xs flex items-center gap-1"
            style={{
              backgroundColor: data.boardType.toLowerCase().includes('breakfast')
                ? 'var(--success)' + '15'
                : agentColor + '15',
              color: data.boardType.toLowerCase().includes('breakfast')
                ? 'var(--success)'
                : agentColor,
            }}
          >
            <Coffee size={10} />
            {data.boardType}
          </span>
        )}
        {data.paymentType && (
          <span
            className="px-2 py-0.5 rounded-full text-xs flex items-center gap-1"
            style={{ backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-secondary)' }}
          >
            <CreditCard size={10} />
            {data.paymentType}
          </span>
        )}
        <CancellationBadge cancellation={data.cancellation} agentColor={agentColor} />
      </div>

      {/* Room description */}
      {data.roomDescription && (
        <div
          className="text-xs mb-3 px-3 py-2 rounded-lg leading-relaxed"
          style={{ backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-secondary)' }}
        >
          {data.roomDescription.length > 150
            ? data.roomDescription.slice(0, 150) + '...'
            : data.roomDescription}
        </div>
      )}

      {/* Amenities */}
      {data.amenities.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {data.amenities.map((amenity, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-full text-xs flex items-center gap-1"
              style={{
                backgroundColor: agentColor + '15',
                color: agentColor,
              }}
            >
              <AmenityIcon name={amenity} />
              {amenity}
            </span>
          ))}
        </div>
      )}

      {/* Price section */}
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
            {data.basePricePerNight && data.taxes && (
              <span> &middot; incl. {data.taxes} taxes</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {data.bookingUrl && (
            <a
              href={data.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-full transition-colors text-sm flex items-center gap-1 border"
              style={{
                borderColor: agentColor + '40',
                color: agentColor,
                backgroundColor: 'transparent',
              }}
            >
              <ExternalLink size={14} />
              Book
            </a>
          )}
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
