import { Search, MoreVertical, Loader2, ImageIcon, UserCircle, UtensilsCrossed, Check } from 'lucide-react';
import { AgentId, agents, Message } from '../types';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { StyleProfilePanel } from './StyleProfilePanel';
import { ReservationModal, type ReservationFormData } from './ReservationModal';
import { FlightBookingFlow } from './FlightBookingFlow';
import { FitnessClassBookingFlow } from './FitnessClassBookingFlow';
import { LifestyleBookingFlow } from './LifestyleBookingFlow';
import { ResyBookingConfirmation } from './ResyBookingConfirmation';
import { ResyLinkForm } from './ResyLinkForm';
import type { RestaurantCardData, ResySlotData } from './cards/RestaurantCard';
import { useChatStore } from '../../stores/chat';
import { useFitnessStore } from '../../stores/fitness';
import { useLifestyleStore } from '../../stores/lifestyle';
import { useMemo, useRef, useEffect, useState } from 'react';
import { sendMessage } from '../../lib/api';

interface ChatViewProps {
  agentId: AgentId;
}

export function ChatView({ agentId }: ChatViewProps) {
  const agent = agents[agentId];
  const { messages, isStreaming, isAnalyzing } = useChatStore((s) => s.agents[agentId]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [reservationRestaurant, setReservationRestaurant] = useState<RestaurantCardData | null>(null);
  const [bookingFlight, setBookingFlight] = useState<any>(null);
  const [bookingFitnessClass, setBookingFitnessClass] = useState<any>(null);
  const [bookingLifestyle, setBookingLifestyle] = useState<any>(null);
  const [resyConfirmation, setResyConfirmation] = useState<{
    venueName: string; venueId: number; configToken: string;
    date: string; time: string; seatingType: string; partySize: number;
  } | null>(null);
  const [showResyLink, setShowResyLink] = useState(false);
  const resyLinked = useLifestyleStore((s) => s.resyStatus.linked);
  const isLifestyleAgent = agentId === 'lifestyle' || agentId === 'all';

  // Check Resy status on mount for lifestyle agent
  useEffect(() => {
    if (isLifestyleAgent) {
      useLifestyleStore.getState().checkResyStatus();
    }
  }, [isLifestyleAgent]);

  // Auto-scroll to bottom on new messages or streaming tokens
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = '';
    let currentGroup: Message[] = [];

    messages.forEach((msg) => {
      const msgDate = msg.timestamp.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
      });

      if (msgDate !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, messages: currentGroup });
        }
        currentDate = msgDate;
        currentGroup = [msg];
      } else {
        currentGroup.push(msg);
      }
    });

    if (currentGroup.length > 0) {
      groups.push({ date: currentDate, messages: currentGroup });
    }

    return groups;
  }, [messages]);

  const handleSend = (text: string, imageBase64?: string, analysisType?: string) => {
    if (isStreaming) return;
    sendMessage(agentId, text, imageBase64, analysisType);
  };

  const handleReserve = (restaurantData: RestaurantCardData) => {
    setReservationRestaurant(restaurantData);
  };

  const handleSelectResySlot = (slot: ResySlotData & { venueId: number; venueName: string }) => {
    // Extract the date from the time string ("2026-03-28 19:30:00" → "2026-03-28")
    const datePart = slot.time.split(' ')[0] || '';
    setResyConfirmation({
      venueName: slot.venueName,
      venueId: slot.venueId,
      configToken: slot.configToken,
      date: datePart,
      time: slot.time,
      seatingType: slot.type || 'Dining Room',
      partySize: 2, // Default, could be passed through
    });
  };

  const handleReservationSubmit = async (formData: ReservationFormData) => {
    try {
      const res = await fetch('/api/dining/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const result = await res.json();
        // Add a confirmation message to the chat
        useChatStore.getState().addMessage(agentId, {
          id: crypto.randomUUID(),
          type: 'bot',
          text: result.message,
          timestamp: new Date(),
          agentId,
        });
      }
    } catch (err) {
      console.error('Reservation failed:', err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div
        className="h-14 flex items-center justify-between px-4 border-b"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--bg-surface-elevated)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
            style={{ backgroundColor: 'var(--accent-global)', color: 'var(--bg-primary)' }}
          >
            G
          </div>
          <div>
            <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              GirlBot
            </div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {agent.name} Agent
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isLifestyleAgent && (
            <button
              onClick={() => {
                if (!resyLinked) {
                  setShowResyLink(true);
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                backgroundColor: resyLinked ? 'var(--success)' + '15' : 'var(--accent-lifestyle)' + '15',
                color: resyLinked ? 'var(--success)' : 'var(--accent-lifestyle)',
              }}
              title={resyLinked ? 'Resy connected' : 'Connect Resy to book restaurants'}
            >
              {resyLinked ? <Check size={13} /> : <UtensilsCrossed size={13} />}
              {resyLinked ? 'Resy' : 'Link Resy'}
            </button>
          )}
          {agentId === 'style' && (
            <button
              onClick={() => setProfileOpen(true)}
              className="p-2 rounded-lg hover:bg-opacity-50 transition-colors"
              style={{ backgroundColor: 'transparent' }}
              title="Style Profile"
            >
              <UserCircle size={20} style={{ color: agent.color }} />
            </button>
          )}
          <button
            className="p-2 rounded-lg hover:bg-opacity-50 transition-colors"
            style={{ backgroundColor: 'transparent' }}
          >
            <Search size={20} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <button
            className="p-2 rounded-lg hover:bg-opacity-50 transition-colors"
            style={{ backgroundColor: 'transparent' }}
          >
            <MoreVertical size={20} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 pb-20 sm:pb-6"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        {groupedMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: 'var(--bg-surface)' }}
            >
              <span className="text-2xl">👋</span>
            </div>
            <h2
              className="text-xl font-semibold mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              Hey gorgeous! I'm GirlBot
            </h2>
            <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
              {agent.description}
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                className="px-4 py-2 rounded-full border transition-colors"
                style={{
                  borderColor: agent.color,
                  color: agent.color,
                }}
                onClick={() => handleSend("What can you help me with?")}
              >
                Get Started
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {groupedMessages.map((group, idx) => (
              <div key={idx}>
                {/* Date separator */}
                <div className="flex justify-center mb-4">
                  <div
                    className="px-3 py-1 rounded-full text-sm"
                    style={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {group.date}
                  </div>
                </div>

                {/* Messages */}
                <div className="space-y-4">
                  {group.messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      onAction={(text) => handleSend(text)}
                      onReserve={handleReserve}
                      onBookFlight={(flightData) => setBookingFlight(flightData)}
                      onBookFitnessClass={(classData) => setBookingFitnessClass(classData)}
                      onBookLifestyle={(data) => setBookingLifestyle(data)}
                      onSelectResySlot={handleSelectResySlot}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Streaming indicator */}
            {isStreaming && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <Loader2
                    size={14}
                    className="animate-spin"
                    style={{ color: 'var(--accent-global)' }}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    typing...
                  </span>
                </div>
              </div>
            )}

            {/* Image analysis indicator */}
            {isAnalyzing && !isStreaming && (
              <div className="flex justify-start">
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: 'var(--bg-surface)' }}
                >
                  <ImageIcon
                    size={14}
                    className="animate-pulse"
                    style={{ color: agent.color }}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Analyzing image...
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat Input */}
      <ChatInput agentId={agentId} onSend={handleSend} disabled={isStreaming} />

      {/* Style Profile Panel */}
      {agentId === 'style' && (
        <StyleProfilePanel open={profileOpen} onClose={() => setProfileOpen(false)} />
      )}

      {/* Reservation Modal */}
      <ReservationModal
        open={!!reservationRestaurant}
        restaurant={reservationRestaurant}
        onClose={() => setReservationRestaurant(null)}
        onSubmit={handleReservationSubmit}
      />

      {/* Flight Booking Flow */}
      {bookingFlight && (
        <FlightBookingFlow
          flightData={bookingFlight}
          onClose={() => setBookingFlight(null)}
          onComplete={(result) => {
            // Add confirmation card to chat
            if (result) {
              useChatStore.getState().addMessage(agentId, {
                id: crypto.randomUUID(),
                type: 'bot',
                text: '',
                timestamp: new Date(),
                agentId,
                richCard: {
                  type: 'flightBookingConfirmation',
                  data: {
                    airline: bookingFlight.airline,
                    flightNumber: bookingFlight.flightNumber,
                    departure: bookingFlight.departure,
                    arrival: bookingFlight.arrival,
                    departureDate: bookingFlight.departureDate,
                    price: bookingFlight.price,
                    duration: bookingFlight.duration,
                    stops: bookingFlight.stops,
                    status: result.status || 'unknown',
                    bookingUrl: bookingFlight.bookingUrl,
                    calendarEventId: result.calendarEventId,
                  },
                },
              });
            }
            setBookingFlight(null);
          }}
        />
      )}

      {/* Fitness Class Browser Booking Flow */}
      {bookingFitnessClass && (
        <FitnessClassBookingFlow
          classData={bookingFitnessClass}
          onClose={() => setBookingFitnessClass(null)}
          onComplete={(result) => {
            if (result?.status === 'booked' || result?.status === 'already_registered') {
              useChatStore.getState().addMessage(agentId, {
                id: crypto.randomUUID(),
                type: 'bot',
                text: '',
                timestamp: new Date(),
                agentId,
                richCard: {
                  type: 'bookingConfirmation',
                  data: {
                    bookingId: crypto.randomUUID(),
                    className: bookingFitnessClass.className,
                    instructor: bookingFitnessClass.instructor,
                    studioName: bookingFitnessClass.studioName,
                    studioAddress: bookingFitnessClass.studioAddress,
                    date: bookingFitnessClass.date,
                    time: bookingFitnessClass.time,
                    duration: bookingFitnessClass.duration,
                    category: bookingFitnessClass.category,
                    bookingPlatform: 'browser',
                    bookingStatus: 'confirmed',
                    bookingUrl: bookingFitnessClass.studioWebsite || bookingFitnessClass.bookingUrl,
                    studioGoogleMapsUrl: bookingFitnessClass.studioGoogleMapsUrl,
                  },
                },
              });

              // Also update fitness store
              useFitnessStore.getState().bookClass(bookingFitnessClass, 'browser');
            }
            setBookingFitnessClass(null);
          }}
        />
      )}

      {/* Lifestyle Booking Flow (restaurants, salons, spas — browser automation) */}
      {bookingLifestyle && (
        <LifestyleBookingFlow
          bookingData={bookingLifestyle}
          onClose={() => setBookingLifestyle(null)}
          onComplete={(result) => {
            if (result?.status === 'booked') {
              useChatStore.getState().addMessage(agentId, {
                id: crypto.randomUUID(),
                type: 'bot',
                text: '',
                timestamp: new Date(),
                agentId,
                richCard: {
                  type: 'reservationConfirmation',
                  data: {
                    reservationId: crypto.randomUUID(),
                    restaurantName: bookingLifestyle.venueName,
                    restaurantAddress: bookingLifestyle.venueAddress,
                    date: bookingLifestyle.date,
                    time: bookingLifestyle.time,
                    partySize: bookingLifestyle.partySize,
                    status: 'confirmed',
                    bookingPlatform: 'browser',
                  },
                },
              });
            }
            setBookingLifestyle(null);
          }}
        />
      )}

      {/* Resy inline confirmation (slot tap → confirm → done) */}
      {resyConfirmation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setResyConfirmation(null)}
        >
          <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <ResyBookingConfirmation
              {...resyConfirmation}
              onConfirm={(result) => {
                // Add confirmation card to chat
                useChatStore.getState().addMessage(agentId, {
                  id: crypto.randomUUID(),
                  type: 'bot',
                  text: `Booked! ${resyConfirmation.venueName} — ${result.time || resyConfirmation.time}, ${resyConfirmation.partySize} guests. Confirmation: ${result.confirmation_id || result.reservation_id || ''}`,
                  timestamp: new Date(),
                  agentId,
                  richCard: {
                    type: 'reservationConfirmation',
                    data: {
                      reservationId: result.bookingId || result.confirmation_id || crypto.randomUUID(),
                      restaurantName: resyConfirmation.venueName,
                      date: resyConfirmation.date,
                      time: result.time || resyConfirmation.time,
                      partySize: resyConfirmation.partySize,
                      confirmationCode: result.confirmation_id || '',
                      status: 'confirmed',
                      bookingPlatform: 'resy',
                    },
                  },
                });
                setResyConfirmation(null);
              }}
              onCancel={() => setResyConfirmation(null)}
            />
          </div>
        </div>
      )}

      {/* Resy link form (shown when user needs to connect account) */}
      {showResyLink && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowResyLink(false)}
        >
          <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <ResyLinkForm
              onLinked={(email) => {
                setShowResyLink(false);
                useLifestyleStore.getState().setResyStatus({ linked: true, email, checkedAt: new Date().toISOString() });
                useChatStore.getState().addMessage(agentId, {
                  id: crypto.randomUUID(),
                  type: 'bot',
                  text: `Resy connected with ${email}! You can now book restaurants directly. Try "find me dinner tonight" to get started.`,
                  timestamp: new Date(),
                  agentId,
                });
              }}
              onCancel={() => setShowResyLink(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
