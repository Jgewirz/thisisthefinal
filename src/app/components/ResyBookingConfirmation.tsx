import { useState } from 'react';
import { UtensilsCrossed, Loader2, Check, AlertCircle, X, MapPin, Users, Clock } from 'lucide-react';
import { bookResy } from '../../lib/api';

interface ResyBookingConfirmationProps {
  venueName: string;
  venueId: number;
  configToken: string;
  date: string;
  time: string;
  seatingType: string;
  partySize: number;
  onConfirm: (result: any) => void;
  onCancel: () => void;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.getTime() === today.getTime()) return 'Tonight';
    if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr: string): string {
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

export function ResyBookingConfirmation({
  venueName,
  venueId,
  configToken,
  date,
  time,
  seatingType,
  partySize,
  onConfirm,
  onCancel,
}: ResyBookingConfirmationProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accentColor = 'var(--accent-lifestyle)';

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await bookResy({
        venueId,
        configToken,
        date,
        partySize,
        venueName,
      });

      if (result.status === 'BOOKED' || result.status === 'RESERVATION_CONFIRMED') {
        onConfirm(result);
      } else if (result.status === 'NO_AVAILABILITY') {
        setError('This time was just taken. Try another slot.');
      } else if (result.status === 'PAYMENT_REQUIRED') {
        setError('This reservation requires a credit card on file in your Resy account.');
      } else if (result.status === 'LOGIN_REQUIRED') {
        setError('Your Resy session expired. Please re-link your account.');
      } else {
        setError(result.message || 'Booking failed. Try again.');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="rounded-xl p-4 border space-y-3"
      style={{ borderColor: accentColor + '30', backgroundColor: 'var(--bg-surface)' }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ backgroundColor: accentColor + '20' }}
          >
            <UtensilsCrossed size={18} style={{ color: accentColor }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Confirm reservation?
            </p>
          </div>
        </div>
        <button onClick={onCancel} className="p-1 rounded-full" style={{ color: 'var(--text-secondary)' }}>
          <X size={16} />
        </button>
      </div>

      <div
        className="p-3 rounded-lg space-y-1.5"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {venueName}
        </p>
        <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {formatDate(date)} · {formatTime(time)}
          </span>
          <span className="flex items-center gap-1">
            <Users size={11} />
            {partySize} {partySize === 1 ? 'guest' : 'guests'}
          </span>
          {seatingType && (
            <span className="flex items-center gap-1">
              <MapPin size={11} />
              {seatingType}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--warning)' }}>
          <AlertCircle size={12} className="flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-opacity disabled:opacity-60 flex items-center justify-center gap-1.5"
          style={{ backgroundColor: accentColor, color: 'var(--bg-primary)' }}
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Check size={14} />
          )}
          {loading ? 'Booking...' : 'Confirm'}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2.5 rounded-lg text-sm border transition-colors"
          style={{ borderColor: 'var(--text-secondary)' + '30', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
