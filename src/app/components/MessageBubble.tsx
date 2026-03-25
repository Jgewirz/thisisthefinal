import { useMemo } from 'react';
import { Message, agents } from '../types';
import { Check, CheckCheck, Star } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PlaceCard } from './cards/PlaceCard';
import { ColorSeasonCard } from './cards/ColorSeasonCard';
import { FitnessClassCard } from './cards/FitnessClassCard';
import type { FitnessClassCardData } from './cards/FitnessClassCard';
import { FitnessStudioCard } from './cards/FitnessStudioCard';
import type { FitnessStudioCardData } from './cards/FitnessStudioCard';
import { BookingConfirmationCard } from './cards/BookingConfirmationCard';
import { ReservationConfirmationCard } from './cards/ReservationConfirmationCard';
import { FlightCard } from './cards/FlightCard';
import { HotelCard } from './cards/HotelCard';
import { WardrobeItemCard } from './cards/WardrobeItemCard';
import { CheapestDatesCard } from './cards/CheapestDatesCard';
import { RestaurantCard } from './cards/RestaurantCard';
import type { ResySlotData } from './cards/RestaurantCard';
import { FlightBookingConfirmationCard } from './cards/FlightBookingConfirmationCard';
import { FlightFallbackCard } from './cards/FlightFallbackCard';
import { ResyLinkForm } from './ResyLinkForm';
import { HatchLinkForm } from './HatchLinkForm';
import { HatchControlCard } from './cards/HatchControlCard';
import { useTravelStore } from '../../stores/travel';
import { useFitnessStore } from '../../stores/fitness';
import { useLifestyleStore } from '../../stores/lifestyle';

interface MessageBubbleProps {
  message: Message;
  onAction?: (text: string) => void;
  onReserve?: (data: any) => void;
  onBookFlight?: (data: any) => void;
  onBookFitnessClass?: (data: any) => void;
  onBookLifestyle?: (data: any) => void;
  onSelectResySlot?: (slot: ResySlotData & { venueId: number; venueName: string }) => void;
}

function OutfitRatingCard({
  data,
  agentColor,
}: {
  data: {
    score: number;
    strengths: string[];
    improvements: string[];
    accessorySuggestions: string[];
    colorHarmony: string;
    overallVibe: string;
  };
  agentColor: string;
}) {
  return (
    <div
      className="p-4 rounded-xl space-y-3"
      style={{ backgroundColor: 'var(--bg-surface)' }}
    >
      {/* Score */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold" style={{ color: agentColor }}>
          Outfit Rating
        </h3>
        <div className="flex items-center gap-1">
          <Star size={18} fill={agentColor} style={{ color: agentColor }} />
          <span className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {data.score}/10
          </span>
        </div>
      </div>

      {/* Vibe */}
      <div
        className="px-3 py-1 rounded-full text-sm inline-block"
        style={{ backgroundColor: agentColor + '20', color: agentColor }}
      >
        {data.overallVibe}
      </div>

      {/* Strengths */}
      {data.strengths?.length > 0 && (
        <div>
          <div className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
            Strengths
          </div>
          <ul className="space-y-1">
            {data.strengths.map((s, i) => (
              <li key={i} className="text-sm flex items-start gap-1.5">
                <span style={{ color: 'var(--success)' }}>+</span>
                <span style={{ color: 'var(--text-primary)' }}>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Improvements */}
      {data.improvements?.length > 0 && (
        <div>
          <div className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
            Could improve
          </div>
          <ul className="space-y-1">
            {data.improvements.map((s, i) => (
              <li key={i} className="text-sm flex items-start gap-1.5">
                <span style={{ color: 'var(--warning)' }}>~</span>
                <span style={{ color: 'var(--text-primary)' }}>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Accessory suggestions */}
      {data.accessorySuggestions?.length > 0 && (
        <div>
          <div className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
            Accessory ideas
          </div>
          <div className="flex flex-wrap gap-2">
            {data.accessorySuggestions.map((s, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-full text-xs border"
                style={{ borderColor: agentColor, color: agentColor }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Color harmony */}
      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        Color harmony:{' '}
        <span style={{ color: 'var(--text-primary)' }}>{data.colorHarmony}</span>
      </div>
    </div>
  );
}

function makeFlightLabel(data: any): string {
  const base = `${data.airline || 'Flight'} ${data.departure?.city || ''} → ${data.arrival?.city || ''}`;
  const flight = data.flightNumber ? ` ${data.flightNumber}` : '';
  const time = data.departure?.time ? ` ${data.departure.time}` : '';
  return `${base}${flight}${time}`;
}

function makeHotelLabel(data: any): string {
  return `${data.name || 'Hotel'} (${data.checkIn || ''} - ${data.checkOut || ''})`;
}

function FlightCardWithSelection({
  data,
  agentColor,
  onAction,
  onBook,
}: {
  data: any;
  agentColor: string;
  onAction?: (text: string) => void;
  onBook?: (data: any) => void;
}) {
  const label = makeFlightLabel(data);
  const isSelected = useTravelStore((s) => s.profile.tripSelections.some((t) => t.label === label));
  const isSaved = useTravelStore((s) => s.profile.bookmarks.some((b) => b.label === label));

  return (
    <FlightCard
      data={data}
      agentColor={agentColor}
      isSelected={isSelected}
      isSaved={isSaved}
      onBook={onBook}
      onSelect={(flightData) => {
        const store = useTravelStore.getState();
        const flightLabel = makeFlightLabel(flightData);
        const alreadySelected = store.profile.tripSelections.some((s) => s.label === flightLabel);

        if (alreadySelected) {
          const sel = store.profile.tripSelections.find((s) => s.label === flightLabel);
          if (sel) store.removeTripSelection(sel.id);
        } else {
          store.addTripSelection({
            type: 'flight',
            data: flightData,
            label: flightLabel,
          });
        }
      }}
      onBookmark={(flightData) => {
        const store = useTravelStore.getState();
        const flightLabel = makeFlightLabel(flightData);
        const existing = store.profile.bookmarks.find((b) => b.label === flightLabel);

        if (existing) {
          store.removeBookmark(existing.id);
        } else {
          store.addBookmark({
            type: 'flight',
            data: {
              bookingUrl: flightData.bookingUrl || '',
              airline: flightData.airline,
              flightNumber: flightData.flightNumber || '',
              price: flightData.price,
              departure: flightData.departure,
              arrival: flightData.arrival,
              departureDate: flightData.departureDate || '',
              returnDate: flightData.returnTrip?.departureDate || null,
            },
            label: flightLabel,
          });
        }
      }}
    />
  );
}

function HotelCardWithSelection({
  data,
  agentColor,
  onAction,
}: {
  data: any;
  agentColor: string;
  onAction?: (text: string) => void;
}) {
  const label = makeHotelLabel(data);
  const isSelected = useTravelStore((s) => s.profile.tripSelections.some((t) => t.label === label));

  return (
    <HotelCard
      data={data}
      agentColor={agentColor}
      isSelected={isSelected}
      onSelect={(hotelData) => {
        const store = useTravelStore.getState();
        const hotelLabel = makeHotelLabel(hotelData);
        const alreadySelected = store.profile.tripSelections.some((s) => s.label === hotelLabel);

        if (alreadySelected) {
          const sel = store.profile.tripSelections.find((s) => s.label === hotelLabel);
          if (sel) store.removeTripSelection(sel.id);
        } else {
          store.addTripSelection({
            type: 'hotel',
            data: hotelData,
            label: hotelLabel,
          });
        }
      }}
      onBookmark={(hotelData) => {
        useTravelStore.getState().addBookmark({
          type: 'hotel',
          data: hotelData,
          label: makeHotelLabel(hotelData),
        });
      }}
    />
  );
}

function makeFitnessLabel(data: FitnessClassCardData): string {
  return `${data.className} — ${data.date} ${data.time} (${data.studioName})`;
}

function FitnessClassCardWithSelection({
  data,
  agentColor,
  onBookClass,
}: {
  data: FitnessClassCardData;
  agentColor: string;
  onBookClass?: (data: FitnessClassCardData) => void;
}) {
  const label = makeFitnessLabel(data);
  const isScheduled = useFitnessStore((s) => s.profile.schedule.some((t) => t.label === label));
  const isBooked = useFitnessStore((s) =>
    s.profile.bookings.some((b) =>
      b.className === data.className && b.time === data.time && b.studioName === data.studioName && b.bookingStatus === 'confirmed'
    )
  );

  // Use browser booking flow when studio has a website, otherwise fall back to add-to-schedule
  const hasWebsite = !!(data.studioWebsite || data.bookingUrl);

  return (
    <FitnessClassCard
      data={data}
      agentColor={agentColor}
      isScheduled={isScheduled}
      isBooked={isBooked}
      onBook={hasWebsite && onBookClass
        ? (classData) => onBookClass(classData)
        : async (classData) => {
            const store = useFitnessStore.getState();
            const platform = (classData as any).bookingPlatform || 'manual';
            await store.bookClass(classData, platform);
          }
      }
      onSchedule={(classData) => {
        const store = useFitnessStore.getState();
        const classLabel = makeFitnessLabel(classData);
        const alreadyScheduled = store.profile.schedule.some((s) => s.label === classLabel);

        if (alreadyScheduled) {
          const sel = store.profile.schedule.find((s) => s.label === classLabel);
          if (sel) store.removeFromSchedule(sel.id);
        } else {
          store.addToSchedule({
            type: 'class',
            data: classData as any,
            label: classLabel,
          });
        }
      }}
      onBookmark={(classData) => {
        useFitnessStore.getState().addBookmark({
          type: 'class',
          data: classData as any,
          label: makeFitnessLabel(classData),
        });
      }}
    />
  );
}

function FitnessStudioCardWithActions({
  data,
  agentColor,
}: {
  data: FitnessStudioCardData;
  agentColor: string;
}) {
  const isBookmarked = useFitnessStore((s) =>
    s.profile.bookmarks.some((b) => b.label === data.name)
  );
  const schedule = useFitnessStore((s) => s.profile.schedule);
  const scheduledLabels = useMemo(() => schedule.map((item) => item.label), [schedule]);

  return (
    <FitnessStudioCard
      data={data}
      agentColor={agentColor}
      isBookmarked={isBookmarked}
      scheduledLabels={scheduledLabels}
      onBookmark={(studioData) => {
        const store = useFitnessStore.getState();
        const existing = store.profile.bookmarks.find((b) => b.label === studioData.name);
        if (existing) {
          store.removeBookmark(existing.id);
        } else {
          store.addBookmark({
            type: 'class',
            data: studioData as any,
            label: studioData.name,
          });
        }
      }}
      onScheduleClass={(studioData, cls) => {
        const label = `${cls.name} — ${cls.time} (${studioData.name})`;
        const store = useFitnessStore.getState();
        const exists = store.profile.schedule.find((s) => s.label === label);
        if (exists) {
          store.removeFromSchedule(exists.id);
        } else {
          store.addToSchedule({
            type: 'class',
            data: {
              ...cls,
              studioName: studioData.name,
              studioAddress: studioData.address,
              website: studioData.website,
              googleMapsUrl: studioData.googleMapsUrl,
            } as any,
            label,
          });
        }
      }}
    />
  );
}

export function MessageBubble({ message, onAction, onReserve, onBookFlight, onBookFitnessClass, onBookLifestyle, onSelectResySlot }: MessageBubbleProps) {
  const agent = agents[message.agentId];
  const isUser = message.type === 'user';

  const timeStr = message.timestamp.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Don't render empty bot messages (streaming placeholder before first token)
  if (!isUser && !message.text && !message.richCard) {
    return null;
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] sm:max-w-[70%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}
      >
        {/* Agent badge for bot messages */}
        {!isUser && (
          <div
            className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{
              backgroundColor: agent.color + '20',
              color: agent.color,
            }}
          >
            {agent.name}
          </div>
        )}

        {/* Message bubble */}
        <div
          className="px-4 py-2.5 rounded-2xl"
          style={{
            backgroundColor: isUser ? 'var(--user-bubble)' : 'var(--bot-bubble)',
            color: 'var(--text-primary)',
            borderBottomRightRadius: isUser ? '4px' : undefined,
            borderBottomLeftRadius: !isUser ? '4px' : undefined,
          }}
        >
          {/* Image thumbnail for user messages */}
          {message.imageUrl && (
            <div className="mb-2">
              <img
                src={message.imageUrl}
                alt="Uploaded"
                className="max-h-48 max-w-full rounded-lg object-cover"
              />
            </div>
          )}

          {message.text && (
            isUser ? (
              <p className="whitespace-pre-wrap">{message.text}</p>
            ) : (
              <div className="prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_p]:my-1.5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_strong]:font-semibold [&_a]:underline" style={{ color: 'var(--text-primary)' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
              </div>
            )
          )}

          {/* Rich card */}
          {message.richCard && (
            <div className="mt-3">
              {message.richCard.type === 'place' && (
                <PlaceCard data={message.richCard.data} agentColor={agent.color} />
              )}
              {message.richCard.type === 'colorSeason' && (
                <ColorSeasonCard data={message.richCard.data} agentColor={agent.color} onAction={onAction} />
              )}
              {message.richCard.type === 'fitnessClass' && (
                <FitnessClassCardWithSelection
                  data={message.richCard.data}
                  agentColor={agent.color}
                  onBookClass={onBookFitnessClass}
                />
              )}
              {message.richCard.type === 'fitnessStudio' && (
                <FitnessStudioCardWithActions
                  data={message.richCard.data}
                  agentColor={agent.color}
                />
              )}
              {message.richCard.type === 'restaurant' && (
                <RestaurantCard
                  data={message.richCard.data}
                  agentColor={agent.color}
                  onReserve={onReserve}
                  onBook={onBookLifestyle ? (data) => onBookLifestyle({
                    bookingType: 'restaurant' as const,
                    venueName: data.name,
                    venueWebsite: data.website || undefined,
                    venueAddress: data.address,
                    venuePhone: data.phone || undefined,
                    venueGoogleMapsUrl: data.googleMapsUrl || undefined,
                    venuePlaceId: data.id,
                  }) : undefined}
                  onSelectSlot={onSelectResySlot}
                />
              )}
              {message.richCard.type === 'flight' && (
                <FlightCardWithSelection
                  data={message.richCard.data}
                  agentColor={agent.color}
                  onAction={onAction}
                  onBook={onBookFlight}
                />
              )}
              {message.richCard.type === 'flightFallback' && (
                <FlightFallbackCard data={message.richCard.data} />
              )}
              {message.richCard.type === 'flightBookingConfirmation' && (
                <FlightBookingConfirmationCard
                  data={message.richCard.data}
                  agentColor={agent.color}
                />
              )}
              {message.richCard.type === 'hotel' && (
                <HotelCardWithSelection
                  data={message.richCard.data}
                  agentColor={agent.color}
                  onAction={onAction}
                />
              )}
              {message.richCard.type === 'outfit' && (
                <OutfitRatingCard
                  data={message.richCard.data}
                  agentColor={agent.color}
                />
              )}
              {message.richCard.type === 'wardrobeItem' && (
                <WardrobeItemCard
                  data={message.richCard.data}
                  agentColor={agent.color}
                />
              )}
              {message.richCard.type === 'cheapestDates' && (
                <CheapestDatesCard
                  data={message.richCard.data}
                  agentColor={agent.color}
                  onSelectDate={(origin, destination, date) => {
                    onAction?.(`Find flights from ${origin} to ${destination} on ${date}`);
                  }}
                />
              )}
              {message.richCard.type === 'bookingConfirmation' && (
                <BookingConfirmationCard
                  data={message.richCard.data}
                  agentColor={agent.color}
                  onCancel={async (bookingId) => {
                    await useFitnessStore.getState().cancelBooking(bookingId);
                  }}
                />
              )}
              {message.richCard.type === 'reservationConfirmation' && (
                <ReservationConfirmationCard
                  data={message.richCard.data}
                  agentColor={agent.color}
                  onCancel={async (reservationId) => {
                    try {
                      await fetch(`/api/dining/reservations/${reservationId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ status: 'cancelled' }),
                      });
                    } catch { /* silent */ }
                  }}
                />
              )}
              {message.richCard.type === 'hatchLink' && (
                <HatchLinkForm
                  onLinked={(email, deviceCount) => {
                    useLifestyleStore.getState().setHatchStatus({ linked: true, email, devices: [], checkedAt: new Date().toISOString() });
                    onAction?.(`My Hatch is connected! I found ${deviceCount} device${deviceCount !== 1 ? 's' : ''}.`);
                  }}
                  onCancel={() => {}}
                />
              )}
              {message.richCard.type === 'hatchControl' && (
                <HatchControlCard
                  data={message.richCard.data}
                  agentColor={agent.color}
                />
              )}
              {message.richCard.type === 'resyLink' && (
                <ResyLinkForm
                  onLinked={(email) => {
                    useLifestyleStore.getState().setResyStatus({ linked: true, email, checkedAt: new Date().toISOString() });
                    // Re-trigger search so user sees time slots
                    onAction?.('Show me those restaurants again with available times');
                  }}
                  onCancel={() => {
                    // Dismissed — card stays visible but user can still use restaurants without Resy
                  }}
                />
              )}
              {message.richCard.type === 'reminder' && (
                <div
                  className="flex items-start gap-2 p-3 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-surface)' }}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'var(--success)' }}
                  >
                    <Check size={14} style={{ color: 'var(--bg-primary)' }} />
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-primary)' }}>
                      Reminder set for{' '}
                      <span className="font-semibold">{message.richCard.data.time}</span>
                    </div>
                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {message.richCard.data.action}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Timestamp and status */}
        <div
          className={`flex items-center gap-1 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
        >
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {timeStr}
          </span>
          {isUser && <CheckCheck size={14} style={{ color: 'var(--text-secondary)' }} />}
        </div>
      </div>
    </div>
  );
}
