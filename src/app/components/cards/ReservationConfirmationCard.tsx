import { Check, Clock, MapPin, Users, ExternalLink, Navigation, X, Mail } from 'lucide-react';

export interface ReservationConfirmationData {
  reservationId: string;
  restaurantName: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
  restaurantGoogleMapsUrl?: string;
  date: string;
  time: string;
  partySize: number;
  status: 'pending' | 'confirmed' | 'saved' | 'cancelled';
  emailSent: boolean;
}

interface ReservationConfirmationCardProps {
  data: ReservationConfirmationData;
  agentColor: string;
  onCancel?: (reservationId: string) => void;
}

export function ReservationConfirmationCard({
  data,
  agentColor,
  onCancel,
}: ReservationConfirmationCardProps) {
  const isConfirmed = data.status === 'confirmed';
  const isPending = data.status === 'pending';
  const isSaved = data.status === 'saved';

  const statusLabel = isConfirmed
    ? 'Reservation Confirmed'
    : isPending
      ? 'Reservation Requested'
      : isSaved
        ? 'Reservation Saved'
        : 'Reservation Cancelled';

  const statusColor = isConfirmed
    ? '#22c55e'
    : isPending
      ? '#f59e0b'
      : isSaved
        ? agentColor
        : '#ef4444';

  // Format time for display (19:00 → 7:00 PM)
  let displayTime = data.time;
  try {
    const [h, m] = data.time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    displayTime = `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
  } catch { /* use raw time */ }

  // Format date for display
  let displayDate = data.date;
  try {
    const d = new Date(data.date + 'T00:00:00');
    displayDate = d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch { /* use raw date */ }

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
          background: `linear-gradient(135deg, ${statusColor}15, ${statusColor}05)`,
        }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${statusColor}20` }}
        >
          {isConfirmed ? (
            <Check size={16} style={{ color: statusColor }} />
          ) : isPending ? (
            <Mail size={16} style={{ color: statusColor }} />
          ) : (
            <Check size={16} style={{ color: statusColor }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold" style={{ color: statusColor }}>
            {statusLabel}
          </div>
          {data.emailSent && isPending && (
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Email sent to restaurant — waiting for confirmation
            </div>
          )}
          {isSaved && !data.emailSent && (
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Call the restaurant to confirm your reservation
            </div>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="p-4 space-y-2.5">
        <h4 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {data.restaurantName}
        </h4>

        <div className="flex items-center gap-4 text-sm flex-wrap">
          <div className="flex items-center gap-1.5">
            <Clock size={14} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ color: 'var(--text-primary)' }}>
              {displayDate} · {displayTime}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users size={14} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ color: 'var(--text-primary)' }}>
              Party of {data.partySize}
            </span>
          </div>
        </div>

        {data.restaurantAddress && (
          <div className="flex items-start gap-1.5 text-sm">
            <MapPin size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {data.restaurantAddress}
            </span>
          </div>
        )}

        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: `${statusColor}15`,
              color: statusColor,
            }}
          >
            {data.emailSent ? 'Email confirmation sent' : data.restaurantPhone ? `Call to confirm: ${data.restaurantPhone}` : 'Saved to your reservations'}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          {data.restaurantPhone && (
            <a
              href={`tel:${data.restaurantPhone}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: agentColor, color: 'white' }}
            >
              <ExternalLink size={13} />
              Call Restaurant
            </a>
          )}
          {data.restaurantGoogleMapsUrl && (
            <a
              href={data.restaurantGoogleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition-opacity hover:opacity-90"
              style={{ borderColor: 'var(--bg-surface-elevated)', color: 'var(--text-secondary)' }}
            >
              <Navigation size={13} />
              Directions
            </a>
          )}
          {onCancel && data.status !== 'cancelled' && (
            <button
              onClick={() => onCancel(data.reservationId)}
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
