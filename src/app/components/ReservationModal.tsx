import { useState } from 'react';
import { X, UtensilsCrossed, Users, CalendarDays, Clock, MessageSquare, Loader2 } from 'lucide-react';
import { useUserStore } from '../../stores/user';
import type { RestaurantCardData } from './cards/RestaurantCard';

interface ReservationModalProps {
  open: boolean;
  restaurant: RestaurantCardData | null;
  onClose: () => void;
  onSubmit: (data: ReservationFormData) => Promise<void>;
}

export interface ReservationFormData {
  restaurantName: string;
  restaurantPlaceId: string;
  restaurantEmail: string | null;
  restaurantPhone: string | null;
  restaurantAddress: string;
  date: string;
  time: string;
  partySize: number;
  specialRequests: string;
}

const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8];
const TIME_SLOTS: string[] = [];
for (let h = 11; h <= 22; h++) {
  TIME_SLOTS.push(`${h.toString().padStart(2, '0')}:00`);
  TIME_SLOTS.push(`${h.toString().padStart(2, '0')}:30`);
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export function ReservationModal({ open, restaurant, onClose, onSubmit }: ReservationModalProps) {
  const user = useUserStore((s) => s.user);
  const [date, setDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [time, setTime] = useState('19:00');
  const [partySize, setPartySize] = useState(2);
  const [specialRequests, setSpecialRequests] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open || !restaurant) return null;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit({
        restaurantName: restaurant.name,
        restaurantPlaceId: restaurant.id,
        restaurantEmail: null, // Google Places doesn't return email — will fall back to phone
        restaurantPhone: restaurant.phone,
        restaurantAddress: restaurant.address,
        date,
        time,
        partySize,
        specialRequests,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const agentColor = 'var(--accent-travel)';
  const hasEmail = false; // Will be populated if we can extract email from website

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden animate-slide-in"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--bg-surface-elevated)' }}
        >
          <div className="flex items-center gap-2">
            <UtensilsCrossed size={18} style={{ color: agentColor }} />
            <div>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                Reserve a Table
              </h3>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {restaurant.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
          >
            <X size={18} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* User info (pre-filled, read-only) */}
          {user && (
            <div
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: agentColor, color: 'var(--bg-primary)' }}
                >
                  {(user.displayName || '?')[0]}
                </div>
              )}
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {user.displayName || 'Guest'}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {user.email || 'Not signed in'}
                </div>
              </div>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              <CalendarDays size={13} />
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--bg-surface-elevated)',
              }}
            />
          </div>

          {/* Time */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              <Clock size={13} />
              Time
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot}
                  onClick={() => setTime(slot)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: time === slot ? agentColor : 'var(--bg-surface-elevated)',
                    color: time === slot ? 'var(--bg-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {formatTime(slot)}
                </button>
              ))}
            </div>
          </div>

          {/* Party size */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              <Users size={13} />
              Party Size
            </label>
            <div className="flex gap-1.5">
              {PARTY_SIZES.map((n) => (
                <button
                  key={n}
                  onClick={() => setPartySize(n)}
                  className="w-10 h-10 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: partySize === n ? agentColor : 'var(--bg-surface-elevated)',
                    color: partySize === n ? 'var(--bg-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Special requests */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              <MessageSquare size={13} />
              Special Requests (optional)
            </label>
            <textarea
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              placeholder="Dietary needs, occasion, seating preference..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--bg-surface-elevated)',
              }}
            />
          </div>

          {/* Info note */}
          <div
            className="text-xs p-3 rounded-lg"
            style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
          >
            {hasEmail
              ? 'A reservation request will be sent from your Gmail to the restaurant.'
              : restaurant.phone
                ? `No email on file. Call ${restaurant.phone} to confirm your reservation.`
                : 'No contact info on file. Reservation will be saved to your calendar.'}
          </div>
        </div>

        {/* Submit */}
        <div
          className="px-4 py-3 border-t"
          style={{ borderColor: 'var(--bg-surface-elevated)' }}
        >
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !date || !time}
            className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: agentColor, color: 'var(--bg-primary)' }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <UtensilsCrossed size={16} />
                {hasEmail ? 'Send Reservation Request' : 'Save Reservation'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
