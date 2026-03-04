import { Plane, Clock, Luggage, Wifi, Plug, MonitorPlay, Bookmark, ArrowRight, Users, Check } from 'lucide-react';

interface FlightSegment {
  flightNumber: string;
  departureAirport: string;
  departureTerminal?: string;
  departureTime: string;
  arrivalAirport: string;
  arrivalTerminal?: string;
  arrivalTime: string;
  duration: string;
  carrierCode: string;
  carrierName: string;
  operatingCarrierName?: string;
  aircraftCode?: string;
}

interface LayoverInfo {
  airport: string;
  duration: string;
}

interface BagAllowance {
  checkedBags: string;
  cabinBags: string;
}

interface FlightAmenity {
  name: string;
  isChargeable: boolean;
}

interface ItineraryData {
  departure: { city: string; time: string };
  arrival: { city: string; time: string };
  duration: string;
  stops: number;
  departureDate: string;
  arrivalDate: string;
  departureTerminal?: string;
  arrivalTerminal?: string;
  isOvernight: boolean;
  segments: FlightSegment[];
  layovers: LayoverInfo[];
}

interface FlightCardData {
  // Original fields
  airline: string;
  departure: { city: string; time: string };
  arrival: { city: string; time: string };
  duration: string;
  stops: number;
  price: string;
  tier: 'Budget' | 'Balanced' | 'Premium';
  // Expanded fields
  flightNumber?: string;
  departureDate?: string;
  arrivalDate?: string;
  departureTerminal?: string;
  arrivalTerminal?: string;
  isOvernight?: boolean;
  baseFare?: string;
  taxes?: string;
  rawPrice?: number;
  cabinClass?: string;
  bags?: BagAllowance;
  seatsRemaining?: number | null;
  lastTicketingDate?: string;
  amenities?: FlightAmenity[];
  segments?: FlightSegment[];
  layovers?: LayoverInfo[];
  returnTrip?: ItineraryData | null;
  validatingAirlineCode?: string;
  bookingUrl?: string;
}

interface FlightCardProps {
  data: FlightCardData;
  agentColor: string;
  isSelected?: boolean;
  onSelect?: (data: FlightCardData) => void;
  onBookmark?: (data: FlightCardData) => void;
}

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isBookByUrgent(dateStr?: string): boolean {
  if (!dateStr) return false;
  const diff = new Date(dateStr).getTime() - Date.now();
  return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
}

function AmenityIcon({ name }: { name: string }) {
  const lower = name.toLowerCase();
  if (lower.includes('wifi') || lower.includes('wi-fi')) return <Wifi size={12} />;
  if (lower.includes('power') || lower.includes('plug') || lower.includes('usb')) return <Plug size={12} />;
  if (lower.includes('entertainment') || lower.includes('screen') || lower.includes('ife')) return <MonitorPlay size={12} />;
  return null;
}

function RouteSection({
  label,
  itinerary,
  agentColor,
}: {
  label?: string;
  itinerary: {
    departure: { city: string; time: string };
    arrival: { city: string; time: string };
    duration: string;
    stops: number;
    departureDate?: string;
    arrivalDate?: string;
    departureTerminal?: string;
    arrivalTerminal?: string;
    isOvernight?: boolean;
    segments?: FlightSegment[];
    layovers?: LayoverInfo[];
  };
  agentColor: string;
}) {
  const hasMultipleSegments = (itinerary.segments?.length || 0) > 1;
  const overnightLabel = itinerary.isOvernight ? ' (+1)' : '';

  return (
    <div className="mb-3">
      {label && (
        <div
          className="text-xs font-medium mb-2 uppercase tracking-wider"
          style={{ color: 'var(--text-secondary)' }}
        >
          {label}
        </div>
      )}

      {/* Route display */}
      <div className="flex items-center justify-between">
        {/* Departure */}
        <div className="flex-shrink-0">
          <div className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            {itinerary.departure.time}
          </div>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {itinerary.departure.city}
            {itinerary.departureTerminal ? ` ${itinerary.departureTerminal}` : ''}
          </div>
          {itinerary.departureDate && (
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {formatDateLabel(itinerary.departureDate)}
            </div>
          )}
        </div>

        {/* Duration and stops */}
        <div className="flex-1 flex flex-col items-center px-3 min-w-0">
          <div className="w-full flex items-center gap-1">
            <div className="flex-1 h-px" style={{ backgroundColor: agentColor + '40' }} />
            {hasMultipleSegments && itinerary.layovers?.map((lo, i) => (
              <div key={i} className="flex items-center gap-1">
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: agentColor }}
                />
                <div className="flex-1 h-px" style={{ backgroundColor: agentColor + '40' }} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1 mt-1">
            <Clock size={11} style={{ color: 'var(--text-secondary)' }} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {itinerary.duration}
            </span>
          </div>
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {itinerary.stops === 0
              ? 'Nonstop'
              : `${itinerary.stops} stop${itinerary.stops > 1 ? 's' : ''}`}
          </div>
        </div>

        {/* Arrival */}
        <div className="flex-shrink-0 text-right">
          <div className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            {itinerary.arrival.time}
            {overnightLabel && (
              <span className="text-xs font-normal" style={{ color: 'var(--warning)' }}>
                {overnightLabel}
              </span>
            )}
          </div>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {itinerary.arrival.city}
            {itinerary.arrivalTerminal ? ` ${itinerary.arrivalTerminal}` : ''}
          </div>
          {itinerary.arrivalDate && (
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {formatDateLabel(itinerary.arrivalDate)}
            </div>
          )}
        </div>
      </div>

      {/* Layover details */}
      {hasMultipleSegments && itinerary.layovers && itinerary.layovers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {itinerary.layovers.map((lo, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                color: 'var(--text-secondary)',
              }}
            >
              {lo.duration} in {lo.airport}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function FlightCard({ data, agentColor, isSelected, onSelect, onBookmark }: FlightCardProps) {
  const tierColors = {
    Budget: 'var(--success)',
    Balanced: 'var(--accent-travel)',
    Premium: 'var(--accent-lifestyle)',
  };

  const hasExpanded = !!data.flightNumber;
  const hasReturn = !!data.returnTrip;

  return (
    <div
      className="p-4 rounded-xl border transition-all"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: isSelected ? agentColor : 'var(--bg-surface-elevated)',
        boxShadow: isSelected ? `0 0 0 1px ${agentColor}` : undefined,
      }}
    >
      {/* Header: Airline + flight number + tier badge */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded flex items-center justify-center"
            style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
          >
            <Plane size={16} style={{ color: agentColor }} />
          </div>
          <div>
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
              {data.airline}
            </span>
            {data.flightNumber && (
              <span className="text-xs ml-2" style={{ color: 'var(--text-secondary)' }}>
                {data.flightNumber}
              </span>
            )}
          </div>
        </div>
        <div
          className="px-2 py-0.5 rounded text-xs font-medium"
          style={{
            backgroundColor: tierColors[data.tier] + '20',
            color: tierColors[data.tier],
          }}
        >
          {data.tier}
        </div>
      </div>

      {/* Outbound route */}
      <RouteSection
        label={hasReturn ? 'Outbound' : undefined}
        itinerary={{
          departure: data.departure,
          arrival: data.arrival,
          duration: data.duration,
          stops: data.stops,
          departureDate: data.departureDate,
          arrivalDate: data.arrivalDate,
          departureTerminal: data.departureTerminal,
          arrivalTerminal: data.arrivalTerminal,
          isOvernight: data.isOvernight,
          segments: data.segments,
          layovers: data.layovers,
        }}
        agentColor={agentColor}
      />

      {/* Return route */}
      {data.returnTrip && (
        <RouteSection
          label="Return"
          itinerary={data.returnTrip}
          agentColor={agentColor}
        />
      )}

      {/* Details pills */}
      {hasExpanded && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {data.cabinClass && (
            <span
              className="px-2 py-0.5 rounded-full text-xs"
              style={{ backgroundColor: agentColor + '15', color: agentColor }}
            >
              {data.cabinClass.charAt(0) + data.cabinClass.slice(1).toLowerCase().replace(/_/g, ' ')}
            </span>
          )}
          {data.bags && data.bags.checkedBags !== 'No checked bags' && (
            <span
              className="px-2 py-0.5 rounded-full text-xs flex items-center gap-1"
              style={{ backgroundColor: agentColor + '15', color: agentColor }}
            >
              <Luggage size={10} />
              {data.bags.checkedBags}
            </span>
          )}
          {data.bags && data.bags.checkedBags === 'No checked bags' && (
            <span
              className="px-2 py-0.5 rounded-full text-xs"
              style={{ backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-secondary)' }}
            >
              No checked bags
            </span>
          )}
          {data.seatsRemaining != null && data.seatsRemaining > 0 && (
            <span
              className="px-2 py-0.5 rounded-full text-xs flex items-center gap-1"
              style={{
                backgroundColor: data.seatsRemaining <= 5 ? 'var(--warning)' + '20' : agentColor + '15',
                color: data.seatsRemaining <= 5 ? 'var(--warning)' : agentColor,
              }}
            >
              <Users size={10} />
              {data.seatsRemaining} seat{data.seatsRemaining !== 1 ? 's' : ''} left
              {data.seatsRemaining <= 5 ? '!' : ''}
            </span>
          )}
          {data.segments?.[0]?.aircraftCode && (
            <span
              className="px-2 py-0.5 rounded-full text-xs"
              style={{ backgroundColor: agentColor + '15', color: agentColor }}
            >
              {data.segments[0].aircraftCode}
            </span>
          )}
        </div>
      )}

      {/* Amenities row */}
      {data.amenities && data.amenities.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {data.amenities.map((amenity, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-full text-xs flex items-center gap-1"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                color: amenity.isChargeable ? 'var(--text-secondary)' : 'var(--success)',
              }}
            >
              <AmenityIcon name={amenity.name} />
              {amenity.name}
              {!amenity.isChargeable ? ' - Free' : ' - Paid'}
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
            {data.price}
          </div>
          {hasExpanded && data.baseFare && data.taxes && (
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              from {data.baseFare} + {data.taxes} taxes
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5">
          {data.lastTicketingDate && (
            <div
              className="text-xs"
              style={{
                color: isBookByUrgent(data.lastTicketingDate) ? 'var(--warning)' : 'var(--text-secondary)',
              }}
            >
              Book by {formatDateLabel(data.lastTicketingDate)}
            </div>
          )}
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
    </div>
  );
}
