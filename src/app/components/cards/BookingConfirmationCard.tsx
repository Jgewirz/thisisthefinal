import { Check, MapPin, Clock, ExternalLink, X, Navigation } from 'lucide-react';

export interface BookingConfirmationData {
  bookingId: string;
  className: string;
  instructor?: string;
  studioName: string;
  studioAddress?: string;
  date: string;
  time: string;
  duration?: string;
  category?: string;
  bookingPlatform: 'mindbody' | 'website' | 'manual' | 'browser';
  bookingStatus: 'confirmed' | 'cancelled' | 'pending';
  bookingUrl?: string;
  studioGoogleMapsUrl?: string;
}

interface BookingConfirmationCardProps {
  data: BookingConfirmationData;
  agentColor: string;
  onCancel?: (bookingId: string) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  yoga: '🧘', pilates: '🤸', hiit: '🔥', spinning: '🚴', barre: '🩰',
  boxing: '🥊', strength: '🏋️', dance: '💃', stretch: '🙆',
  meditation: '🧘‍♀️', cardio: '❤️‍🔥', bootcamp: '⚡', crossfit: '💪',
  fitness: '💪',
};

export function BookingConfirmationCard({
  data,
  agentColor,
  onCancel,
}: BookingConfirmationCardProps) {
  const icon = CATEGORY_ICONS[data.category?.toLowerCase() || ''] || '💪';
  const isConfirmed = data.bookingStatus === 'confirmed';
  const isWebsite = data.bookingPlatform === 'website' || data.bookingPlatform === 'browser';

  return (
    <div
      className="rounded-xl overflow-hidden border"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: isConfirmed ? 'rgba(34,197,94,0.3)' : 'var(--bg-surface-elevated)',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{
          background: isConfirmed
            ? 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))'
            : `linear-gradient(135deg, ${agentColor}15, ${agentColor}05)`,
        }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: isConfirmed ? 'rgba(34,197,94,0.2)' : `${agentColor}20` }}
        >
          {isConfirmed ? (
            <Check size={16} style={{ color: '#22c55e' }} />
          ) : (
            <span className="text-base">{icon}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold" style={{ color: isConfirmed ? '#22c55e' : agentColor }}>
            {isConfirmed
              ? (isWebsite ? 'Added to Schedule' : 'Booking Confirmed')
              : 'Booking Pending'}
          </div>
          {isWebsite && (
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Complete your booking on the studio's website
            </div>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="p-4 space-y-2.5">
        <h4 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {icon} {data.className}
        </h4>

        {data.instructor && (
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            with {data.instructor}
          </div>
        )}

        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Clock size={14} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ color: 'var(--text-primary)' }}>
              {data.date} · {data.time}
            </span>
          </div>
          {data.duration && (
            <span
              className="px-2 py-0.5 rounded-full text-xs"
              style={{ backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-secondary)' }}
            >
              {data.duration}
            </span>
          )}
        </div>

        <div className="flex items-start gap-1.5 text-sm">
          <MapPin size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
          <div>
            <div style={{ color: 'var(--text-primary)' }}>{data.studioName}</div>
            {data.studioAddress && (
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {data.studioAddress}
              </div>
            )}
          </div>
        </div>

        {/* Platform badge */}
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: data.bookingPlatform === 'mindbody' ? 'rgba(34,197,94,0.15)' : `${agentColor}15`,
              color: data.bookingPlatform === 'mindbody' ? '#22c55e' : agentColor,
            }}
          >
            {data.bookingPlatform === 'mindbody' ? 'Booked via Mindbody' : data.bookingPlatform === 'browser' ? 'Booked via browser' : 'Tracked on schedule'}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          {data.bookingUrl && (
            <a
              href={data.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: agentColor, color: 'white' }}
            >
              <ExternalLink size={13} />
              {isWebsite ? 'Book on Website' : 'View Booking'}
            </a>
          )}
          {data.studioGoogleMapsUrl && (
            <a
              href={data.studioGoogleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition-opacity hover:opacity-90"
              style={{ borderColor: 'var(--bg-surface-elevated)', color: 'var(--text-secondary)' }}
            >
              <Navigation size={13} />
              Directions
            </a>
          )}
          {onCancel && data.bookingPlatform !== 'website' && (
            <button
              onClick={() => onCancel(data.bookingId)}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition-opacity hover:opacity-90"
              style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}
            >
              <X size={13} />
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
