import { Plane, Check, ExternalLink, CalendarPlus } from 'lucide-react';

interface FlightBookingConfirmationData {
  airline: string;
  flightNumber?: string;
  departure: { city: string; time: string };
  arrival: { city: string; time: string };
  departureDate?: string;
  price: string;
  duration: string;
  stops: number;
  status: 'completed' | 'awaiting_payment' | 'unknown';
  confirmationCode?: string;
  bookingUrl?: string;
  calendarEventId?: string;
}

interface FlightBookingConfirmationCardProps {
  data: FlightBookingConfirmationData;
  agentColor: string;
  onAddToCalendar?: () => void;
}

export function FlightBookingConfirmationCard({ data, agentColor, onAddToCalendar }: FlightBookingConfirmationCardProps) {
  return (
    <div
      className="p-4 rounded-xl border"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--success)' + '40',
      }}
    >
      {/* Status header */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: data.status === 'completed' ? 'var(--success)' + '20' : agentColor + '20' }}
        >
          {data.status === 'completed' ? (
            <Check size={16} style={{ color: 'var(--success)' }} />
          ) : (
            <Plane size={16} style={{ color: agentColor }} />
          )}
        </div>
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {data.status === 'completed' ? 'Flight Booked!' :
             data.status === 'awaiting_payment' ? 'Ready for Payment' :
             'Booking Processed'}
          </p>
          {data.confirmationCode && (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Confirmation: {data.confirmationCode}
            </p>
          )}
        </div>
      </div>

      {/* Flight details */}
      <div
        className="p-3 rounded-lg mb-3"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
            {data.airline} {data.flightNumber || ''}
          </span>
          <span className="font-semibold" style={{ color: agentColor }}>
            {data.price}
          </span>
        </div>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {data.departure.city} {data.departure.time} → {data.arrival.city} {data.arrival.time}
        </div>
        <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          {data.departureDate} · {data.duration} · {data.stops === 0 ? 'Nonstop' : `${data.stops} stop${data.stops > 1 ? 's' : ''}`}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {data.bookingUrl && (
          <a
            href={data.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-1.5 rounded-full text-xs text-center flex items-center justify-center gap-1 border"
            style={{
              borderColor: agentColor + '40',
              color: agentColor,
            }}
          >
            <ExternalLink size={12} />
            View Booking
          </a>
        )}
        {onAddToCalendar && !data.calendarEventId && (
          <button
            onClick={onAddToCalendar}
            className="flex-1 py-1.5 rounded-full text-xs flex items-center justify-center gap-1"
            style={{
              backgroundColor: agentColor,
              color: 'var(--bg-primary)',
            }}
          >
            <CalendarPlus size={12} />
            Add to Calendar
          </button>
        )}
        {data.calendarEventId && (
          <span
            className="flex-1 py-1.5 rounded-full text-xs text-center flex items-center justify-center gap-1"
            style={{ color: 'var(--success)' }}
          >
            <Check size={12} />
            Added to Calendar
          </span>
        )}
      </div>
    </div>
  );
}
