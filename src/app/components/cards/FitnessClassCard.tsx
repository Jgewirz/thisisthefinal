import { Clock, MapPin, User, Users, Bookmark, ExternalLink, Dumbbell, Check } from 'lucide-react';

export interface FitnessClassCardData {
  classId: number | string;
  className: string;
  classDescription: string;
  instructor: string;
  studioName: string;
  studioAddress: string;
  startDateTime: string;
  date: string;
  time: string;
  duration: string;
  spotsRemaining: number | null;
  maxCapacity: number;
  isAvailable: boolean;
  isCanceled: boolean;
  isWaitlistAvailable: boolean;
  difficulty: string | null;
  category: string;
  bookingStatus: 'available' | 'full' | 'waitlist' | 'canceled' | 'booked';
  siteId: string;
  studioLat: number | null;
  studioLng: number | null;
  distance: string | null;
  // Extended booking fields
  bookingPlatform?: 'mindbody' | 'website' | 'none';
  bookingUrl?: string;
  mindbodySiteId?: string;
  mindbodyClassId?: string;
  studioWebsite?: string;
  studioGoogleMapsUrl?: string;
  // User location context (for booking agent city/region selection)
  userCity?: string;
  userRegion?: string;
}

interface FitnessClassCardProps {
  data: FitnessClassCardData;
  agentColor: string;
  isScheduled?: boolean;
  isBooked?: boolean;
  onSchedule?: (data: FitnessClassCardData) => void;
  onBookmark?: (data: FitnessClassCardData) => void;
  onBook?: (data: FitnessClassCardData) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  Yoga: '🧘',
  Pilates: '🤸',
  HIIT: '🔥',
  Spinning: '🚴',
  Barre: '🩰',
  Boxing: '🥊',
  Strength: '🏋️',
  Dance: '💃',
  Stretch: '🙆',
  Meditation: '🧘‍♀️',
  Cardio: '❤️‍🔥',
  'Boot Camp': '⚡',
  Fitness: '💪',
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  available: { label: 'Available', bg: 'var(--success)', text: 'var(--bg-primary)' },
  full: { label: 'Full', bg: 'var(--error)', text: 'white' },
  waitlist: { label: 'Waitlist', bg: 'var(--warning)', text: 'var(--bg-primary)' },
  canceled: { label: 'Canceled', bg: 'var(--text-secondary)', text: 'var(--bg-primary)' },
  booked: { label: 'Booked', bg: 'var(--success)', text: 'var(--bg-primary)' },
};

export function FitnessClassCard({
  data,
  agentColor,
  isScheduled = false,
  isBooked = false,
  onSchedule,
  onBookmark,
  onBook,
}: FitnessClassCardProps) {
  const effectiveStatus = isBooked ? 'booked' : data.bookingStatus;
  const status = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.available;
  const categoryIcon = CATEGORY_ICONS[data.category] || '💪';
  const bookingUrl = data.bookingUrl || (data.siteId ? `https://clients.mindbodyonline.com/classic/ws?studioid=${data.siteId}` : data.studioWebsite || '');

  // Spots urgency coloring
  const spotsColor =
    data.spotsRemaining === null
      ? 'var(--text-secondary)'
      : data.spotsRemaining === 0
        ? 'var(--error)'
        : data.spotsRemaining <= 5
          ? 'var(--warning)'
          : 'var(--success)';

  return (
    <div
      className="rounded-xl overflow-hidden border"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--bg-surface-elevated)',
      }}
    >
      {/* Header: category + difficulty + booking status */}
      <div
        className="px-4 py-2.5 flex items-center justify-between"
        style={{ backgroundColor: agentColor + '15' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{categoryIcon}</span>
          <span
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: agentColor }}
          >
            {data.category}
          </span>
          {data.difficulty && (
            <span
              className="px-2 py-0.5 rounded-full text-xs"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                color: 'var(--text-secondary)',
              }}
            >
              {data.difficulty}
            </span>
          )}
        </div>
        <span
          className="px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: status.bg + '20', color: status.bg }}
        >
          {status.label}
        </span>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Class name */}
        <h4
          className="text-base font-semibold leading-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          {data.className}
        </h4>

        {/* Instructor */}
        <div className="flex items-center gap-2 text-sm">
          <User size={14} style={{ color: 'var(--text-secondary)' }} />
          <span style={{ color: 'var(--text-primary)' }}>{data.instructor}</span>
        </div>

        {/* Date / time / duration row */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Clock size={14} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ color: 'var(--text-primary)' }}>
              {data.date} · {data.time}
            </span>
          </div>
          <span
            className="px-2 py-0.5 rounded-full text-xs"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              color: 'var(--text-secondary)',
            }}
          >
            {data.duration}
          </span>
        </div>

        {/* Spots remaining */}
        {data.bookingStatus !== 'canceled' && (
          <div className="flex items-center gap-2 text-sm">
            <Users size={14} style={{ color: spotsColor }} />
            <span style={{ color: spotsColor }}>
              {data.spotsRemaining === null
                ? 'Spots available'
                : data.spotsRemaining === 0
                  ? data.isWaitlistAvailable
                    ? 'Full — waitlist open'
                    : 'No spots remaining'
                  : `${data.spotsRemaining} spot${data.spotsRemaining !== 1 ? 's' : ''} left`}
            </span>
          </div>
        )}

        {/* Studio + distance */}
        <div className="flex items-start gap-2 text-sm">
          <MapPin size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--text-primary)' }}>{data.studioName}</span>
              {data.distance && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ml-2"
                  style={{ backgroundColor: agentColor + '15', color: agentColor }}
                >
                  {data.distance}
                </span>
              )}
            </div>
            {data.studioAddress && (
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {data.studioAddress}
              </div>
            )}
          </div>
        </div>

        {/* Booking platform badge */}
        {data.bookingPlatform && (
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: data.bookingPlatform === 'mindbody' ? 'rgba(34,197,94,0.15)' : `${agentColor}15`,
                color: data.bookingPlatform === 'mindbody' ? '#22c55e' : agentColor,
              }}
            >
              {data.bookingPlatform === 'mindbody' ? 'Mindbody' : data.bookingPlatform === 'website' ? 'Website' : 'Schedule only'}
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          {/* Primary Book button */}
          {isBooked ? (
            <div
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
              style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e' }}
            >
              <Check size={14} />
              Booked
            </div>
          ) : onBook ? (
            <button
              onClick={() => onBook(data)}
              disabled={data.bookingStatus === 'canceled' || data.bookingStatus === 'full'}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                backgroundColor: agentColor,
                color: 'var(--bg-primary)',
              }}
            >
              <Dumbbell size={14} />
              Book Class
            </button>
          ) : (
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-opacity hover:opacity-90"
              style={{
                backgroundColor: data.bookingStatus === 'canceled' ? 'var(--text-secondary)' : agentColor,
                color: 'var(--bg-primary)',
                pointerEvents: data.bookingStatus === 'canceled' ? 'none' : 'auto',
                opacity: data.bookingStatus === 'canceled' ? 0.5 : 1,
              }}
            >
              <ExternalLink size={14} />
              Book
            </a>
          )}

          {/* Schedule / Save button */}
          {onSchedule && (
            <button
              onClick={() => onSchedule(data)}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-colors"
              style={{
                borderColor: isScheduled ? agentColor : 'var(--bg-surface-elevated)',
                color: isScheduled ? agentColor : 'var(--text-secondary)',
                backgroundColor: isScheduled ? agentColor + '15' : 'transparent',
              }}
            >
              <Dumbbell size={14} />
              {isScheduled ? 'Scheduled' : 'Add'}
            </button>
          )}

          {/* Bookmark button */}
          {onBookmark && (
            <button
              onClick={() => onBookmark(data)}
              className="flex items-center justify-center w-10 h-10 rounded-full border transition-colors"
              style={{
                borderColor: 'var(--bg-surface-elevated)',
                color: 'var(--text-secondary)',
              }}
            >
              <Bookmark size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
