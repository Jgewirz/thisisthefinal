import { useState } from 'react';
import {
  Building2, Star, MapPin, Bookmark, Check, ExternalLink,
  BedDouble, Coffee, Wifi, Dumbbell, ParkingCircle, Waves,
  UtensilsCrossed, Wind, ShieldCheck, CalendarDays, Moon, CreditCard,
  Ban, CircleAlert, Phone, Globe, Map, StarHalf, ChevronDown, ChevronUp,
} from 'lucide-react';

interface RoomOfferData {
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
  pricePerNight: string;
  totalPrice: string;
  basePricePerNight?: string;
  taxes?: string;
  rawPerNight: number;
}

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
  roomOffers?: RoomOfferData[];
  // Google Places enrichment
  photoUrl?: string | null;
  userRating?: number | null;
  reviewCount?: number | null;
  editorialSummary?: string | null;
  googleMapsUrl?: string | null;
  phone?: string | null;
  website?: string | null;
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

/** Render fractional star ratings (e.g., 4.3 → 4 full + 1 half) */
function UserRatingStars({ rating, color }: { rating: number; color: string }) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.3;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: fullStars }).map((_, i) => (
        <Star key={`f${i}`} size={11} fill={color} style={{ color }} />
      ))}
      {hasHalf && <StarHalf size={11} fill={color} style={{ color }} />}
      {Array.from({ length: Math.max(0, emptyStars) }).map((_, i) => (
        <Star key={`e${i}`} size={11} style={{ color: color + '40' }} />
      ))}
    </div>
  );
}

function formatReviewCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(count);
}

export function HotelCard({ data, agentColor, isSelected, onSelect, onBookmark }: HotelCardProps) {
  const tier = data.rating > 0 ? getRatingTier(data.rating) : null;
  const nights = data.nights || Math.max(1, Math.ceil(
    (new Date(data.checkOut).getTime() - new Date(data.checkIn).getTime()) / (1000 * 60 * 60 * 24)
  ));
  const hasPhoto = !!data.photoUrl;
  const hasUserRating = data.userRating != null && data.userRating > 0;
  const roomOffers = data.roomOffers || [];
  const hasMultipleRooms = roomOffers.length > 1;
  const [selectedRoomIdx, setSelectedRoomIdx] = useState(0);
  const [showAllRooms, setShowAllRooms] = useState(false);
  const activeRoom = roomOffers[selectedRoomIdx] || null;

  return (
    <div
      className="rounded-xl border overflow-hidden transition-all"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: isSelected ? agentColor : 'var(--bg-surface-elevated)',
        boxShadow: isSelected ? `0 0 0 1px ${agentColor}` : undefined,
      }}
    >
      {/* Photo header — shows hero image if Google Places enrichment provided one */}
      {hasPhoto ? (
        <div className="relative h-40 overflow-hidden">
          <img
            src={data.photoUrl!}
            alt={data.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {/* Gradient overlay for text readability */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)',
            }}
          />
          {/* Hotel name + tier over the photo */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <div className="flex items-end justify-between">
              <div>
                <div className="font-semibold text-white text-base leading-tight drop-shadow-sm">
                  {data.name}
                </div>
                {data.address && (
                  <div className="flex items-center gap-1 text-xs text-white/80 mt-0.5">
                    <MapPin size={10} />
                    {data.address}
                  </div>
                )}
              </div>
              {tier && (
                <div
                  className="px-2 py-0.5 rounded text-xs font-medium flex-shrink-0"
                  style={{
                    backgroundColor: tier.color + '30',
                    color: 'white',
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  {tier.label}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Fallback: gradient header when no photo */
        <div
          className="relative h-20 flex items-end p-3"
          style={{
            background: `linear-gradient(135deg, ${agentColor}20 0%, ${agentColor}08 100%)`,
          }}
        >
          <div className="flex items-center gap-2 w-full">
            <div
              className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
            >
              <Building2 size={16} style={{ color: agentColor }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {data.name}
              </div>
              {data.address && (
                <div className="flex items-center gap-1 text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                  <MapPin size={10} className="flex-shrink-0" />
                  {data.address}
                </div>
              )}
            </div>
            {tier && (
              <div
                className="px-2 py-0.5 rounded text-xs font-medium flex-shrink-0"
                style={{ backgroundColor: tier.color + '20', color: tier.color }}
              >
                {tier.label}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Card body */}
      <div className="p-4">
        {/* Rating row: Amadeus stars + Google user rating + review count */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {/* Amadeus star classification */}
            {data.rating > 0 && (
              <div className="flex items-center gap-0.5">
                {Array.from({ length: data.rating }).map((_, i) => (
                  <Star key={i} size={12} fill={agentColor} style={{ color: agentColor }} />
                ))}
              </div>
            )}
            {/* Google user rating */}
            {hasUserRating && (
              <div className="flex items-center gap-1.5">
                {data.rating <= 0 && <UserRatingStars rating={data.userRating!} color={agentColor} />}
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  {data.userRating!.toFixed(1)}
                </span>
                {data.reviewCount != null && data.reviewCount > 0 && (
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    ({formatReviewCount(data.reviewCount)} reviews)
                  </span>
                )}
              </div>
            )}
          </div>
          {/* Price per night (prominent, top-right) */}
          <div className="text-right">
            <div className="text-lg font-semibold leading-tight" style={{ color: agentColor }}>
              {data.pricePerNight}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              per night
            </div>
          </div>
        </div>

        {/* Editorial summary from Google Places */}
        {data.editorialSummary && (
          <div
            className="text-xs mb-3 leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            {data.editorialSummary.length > 180
              ? data.editorialSummary.slice(0, 180) + '...'
              : data.editorialSummary}
          </div>
        )}

        {/* Stay timeline: Check-in → Nights → Check-out */}
        <div className="mb-3">
          <div className="flex items-center justify-between">
            <div className="flex-shrink-0">
              <div className="text-xs uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-secondary)' }}>
                Check-in
              </div>
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatDateLabel(data.checkIn)}
              </div>
            </div>

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

            <div className="flex-shrink-0 text-right">
              <div className="text-xs uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-secondary)' }}>
                Check-out
              </div>
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatDateLabel(data.checkOut)}
              </div>
            </div>
          </div>
        </div>

        {/* ── Room offers / price range ── */}
        {hasMultipleRooms ? (
          <div className="mb-3">
            {/* Price range header */}
            <button
              onClick={() => setShowAllRooms(!showAllRooms)}
              className="w-full flex items-center justify-between mb-2"
            >
              <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                {roomOffers.length} room option{roomOffers.length !== 1 ? 's' : ''} &middot;{' '}
                <span style={{ color: agentColor }}>
                  {roomOffers[0].pricePerNight}
                </span>
                {roomOffers.length > 1 && (
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {' '}&ndash;{' '}
                  </span>
                )}
                {roomOffers.length > 1 && (
                  <span style={{ color: agentColor }}>
                    {roomOffers[roomOffers.length - 1].pricePerNight}
                  </span>
                )}
                <span style={{ color: 'var(--text-secondary)' }}> /night</span>
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                {showAllRooms ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </button>

            {/* Room list */}
            <div className="flex flex-col gap-1.5">
              {(showAllRooms ? roomOffers : roomOffers.slice(0, 2)).map((room, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedRoomIdx(idx)}
                  className="w-full text-left px-3 py-2 rounded-lg border transition-all"
                  style={{
                    backgroundColor: selectedRoomIdx === idx ? agentColor + '10' : 'var(--bg-surface-elevated)',
                    borderColor: selectedRoomIdx === idx ? agentColor + '40' : 'transparent',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {selectedRoomIdx === idx && (
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: agentColor }}
                        />
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {room.roomType || 'Standard Room'}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {room.bedType && (
                            <span className="text-xs flex items-center gap-0.5" style={{ color: 'var(--text-secondary)' }}>
                              <BedDouble size={9} />
                              {room.bedType}
                            </span>
                          )}
                          {room.boardType && (
                            <span
                              className="text-xs flex items-center gap-0.5"
                              style={{
                                color: room.boardType.toLowerCase().includes('breakfast')
                                  ? 'var(--success)'
                                  : 'var(--text-secondary)',
                              }}
                            >
                              <Coffee size={9} />
                              {room.boardType}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <div className="text-sm font-semibold" style={{ color: agentColor }}>
                        {room.pricePerNight}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        /night
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              {!showAllRooms && roomOffers.length > 2 && (
                <button
                  onClick={() => setShowAllRooms(true)}
                  className="text-xs py-1 text-center"
                  style={{ color: agentColor }}
                >
                  +{roomOffers.length - 2} more option{roomOffers.length - 2 !== 1 ? 's' : ''}
                </button>
              )}
            </div>

            {/* Selected room details */}
            {activeRoom && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {activeRoom.cancellation && (
                  <CancellationBadge cancellation={activeRoom.cancellation} agentColor={agentColor} />
                )}
                {activeRoom.paymentType && (
                  <span
                    className="px-2 py-0.5 rounded-full text-xs flex items-center gap-1"
                    style={{ backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-secondary)' }}
                  >
                    <CreditCard size={10} />
                    {activeRoom.paymentType}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Single room — original pills layout */
          <>
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
          </>
        )}

        {/* Amenities */}
        {data.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {data.amenities.map((amenity, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-full text-xs flex items-center gap-1"
                style={{ backgroundColor: agentColor + '15', color: agentColor }}
              >
                <AmenityIcon name={amenity} />
                {amenity}
              </span>
            ))}
          </div>
        )}

        {/* Contact links: phone + website from Google Places */}
        {(data.phone || data.website) && (
          <div className="flex flex-wrap gap-3 mb-3 text-xs">
            {data.phone && (
              <a
                href={`tel:${data.phone}`}
                className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Phone size={10} />
                {data.phone}
              </a>
            )}
            {data.website && (
              <a
                href={data.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Globe size={10} />
                Website
              </a>
            )}
          </div>
        )}

        {/* Price section + actions */}
        {(() => {
          const displayRoom = activeRoom || data;
          const displayTotal = hasMultipleRooms && activeRoom ? activeRoom.totalPrice : (data.totalPrice || data.pricePerNight);
          const displayPerNight = hasMultipleRooms && activeRoom ? activeRoom.pricePerNight : data.pricePerNight;
          const displayTaxes = hasMultipleRooms && activeRoom ? activeRoom.taxes : data.taxes;
          const displayBase = hasMultipleRooms && activeRoom ? activeRoom.basePricePerNight : data.basePricePerNight;

          return (
            <div
              className="flex items-end justify-between pt-3 border-t"
              style={{ borderColor: 'var(--bg-surface-elevated)' }}
            >
              <div>
                <div className="text-xl font-semibold" style={{ color: agentColor }}>
                  {displayTotal}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {displayTotal && <>total &middot; {displayPerNight}/night</>}
                  {displayBase && displayTaxes && (
                    <span> &middot; incl. {displayTaxes} taxes</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {data.googleMapsUrl && (
                  <a
                    href={data.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-full transition-colors border"
                    style={{ borderColor: 'var(--bg-surface-elevated)', color: 'var(--text-secondary)' }}
                    title="View on Google Maps"
                  >
                    <Map size={14} />
                  </a>
                )}
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
                  className="px-4 py-1.5 rounded-full transition-colors text-sm font-medium flex items-center gap-1.5"
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
          );
        })()}
      </div>
    </div>
  );
}
