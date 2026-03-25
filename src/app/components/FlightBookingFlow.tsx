import { useState, useEffect, useRef } from 'react';
import { X, Plane, Loader2, Check, ExternalLink, CalendarPlus, AlertCircle } from 'lucide-react';

interface PassengerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

interface BookingStep {
  step: string;
  status: string;
  timestamp: number;
}

interface FlightBookingFlowProps {
  flightData: any;
  onClose: () => void;
  onComplete: (result: any) => void;
  prefillEmail?: string;
}

export function FlightBookingFlow({ flightData, onClose, onComplete, prefillEmail }: FlightBookingFlowProps) {
  const [phase, setPhase] = useState<'info' | 'progress' | 'result'>('info');
  const [passenger, setPassenger] = useState<PassengerInfo>({
    firstName: '',
    lastName: '',
    email: prefillEmail || '',
  });
  const [jobId, setJobId] = useState<string | null>(null);
  const [steps, setSteps] = useState<BookingStep[]>([]);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('queued');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const startBooking = async () => {
    if (!passenger.firstName || !passenger.lastName || !passenger.email) return;

    setPhase('progress');
    setError(null);

    try {
      const res = await fetch('/api/travel/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          flightData,
          passengerInfo: passenger,
        }),
      });

      if (!res.ok) throw new Error('Failed to start booking');

      const data = await res.json();
      setJobId(data.jobId);

      // Start polling for status
      pollingRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/travel/book/${data.jobId}/status`, { credentials: 'include' });
          if (!statusRes.ok) return;

          const statusData = await statusRes.json();
          setSteps(statusData.steps || []);
          setCurrentStep(statusData.currentStep);
          setStatus(statusData.status);

          if (statusData.status === 'completed') {
            clearInterval(pollingRef.current!);
            pollingRef.current = null;
            setResult(statusData.result);
            setPhase('result');
          } else if (statusData.status === 'failed') {
            clearInterval(pollingRef.current!);
            pollingRef.current = null;
            setError(statusData.error || 'Booking failed');
            setPhase('result');
          }
        } catch {
          // Silently retry
        }
      }, 2000);

      // Stop polling after 2 minutes max
      setTimeout(() => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          if (status !== 'completed' && status !== 'failed') {
            setError('Booking is taking too long. Check back later.');
            setPhase('result');
          }
        }
      }, 120000);
    } catch (err: any) {
      setError(err.message || 'Failed to start booking');
      setPhase('result');
    }
  };

  const cancelBooking = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    onClose();
  };

  const addToCalendar = async () => {
    if (!jobId) return;
    try {
      const res = await fetch(`/api/travel/book/${jobId}/calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        onComplete({ ...result, calendarEventId: data.eventId });
      }
    } catch {
      // Calendar add failed silently
    }
  };

  const progressSteps = [
    { key: 'navigating', label: 'Opening Google Flights...' },
    { key: 'selecting_flight', label: 'Finding your flight...' },
    { key: 'filling_details', label: 'Filling in your details...' },
    { key: 'confirming', label: 'Processing results...' },
  ];

  const getStepStatus = (stepKey: string) => {
    const stepIndex = progressSteps.findIndex((s) => s.key === stepKey);
    const currentIndex = progressSteps.findIndex((s) => s.key === status);
    if (currentIndex > stepIndex) return 'done';
    if (currentIndex === stepIndex) return 'active';
    return 'pending';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 relative"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        {/* Close button */}
        <button
          onClick={cancelBooking}
          className="absolute top-4 right-4 p-1 rounded-full hover:opacity-80"
          style={{ color: 'var(--text-secondary)' }}
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--accent-travel)' + '20' }}
          >
            <Plane size={20} style={{ color: 'var(--accent-travel)' }} />
          </div>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Book Flight
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {flightData.airline} {flightData.flightNumber || ''} — {flightData.departure?.city} → {flightData.arrival?.city}
            </p>
          </div>
        </div>

        {/* ── Step 1: Passenger Info ── */}
        {phase === 'info' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>First Name</label>
                <input
                  type="text"
                  value={passenger.firstName}
                  onChange={(e) => setPassenger({ ...passenger, firstName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm border-0 outline-none"
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="Jane"
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Last Name</label>
                <input
                  type="text"
                  value={passenger.lastName}
                  onChange={(e) => setPassenger({ ...passenger, lastName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm border-0 outline-none"
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Email</label>
              <input
                type="email"
                value={passenger.email}
                onChange={(e) => setPassenger({ ...passenger, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border-0 outline-none"
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  color: 'var(--text-primary)',
                }}
                placeholder="jane@example.com"
              />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Phone (optional)</label>
              <input
                type="tel"
                value={passenger.phone || ''}
                onChange={(e) => setPassenger({ ...passenger, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border-0 outline-none"
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  color: 'var(--text-primary)',
                }}
                placeholder="+1 555 123 4567"
              />
            </div>

            {/* Flight summary */}
            <div
              className="p-3 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
            >
              <div className="flex justify-between">
                <span>{flightData.departure?.time} → {flightData.arrival?.time}</span>
                <span style={{ color: 'var(--accent-travel)', fontWeight: 600 }}>{flightData.price}</span>
              </div>
              <div>{flightData.departureDate} · {flightData.duration} · {flightData.stops === 0 ? 'Nonstop' : `${flightData.stops} stop${flightData.stops > 1 ? 's' : ''}`}</div>
            </div>

            <button
              onClick={startBooking}
              disabled={!passenger.firstName || !passenger.lastName || !passenger.email}
              className="w-full py-2.5 rounded-full text-sm font-medium transition-opacity disabled:opacity-40"
              style={{
                backgroundColor: 'var(--accent-travel)',
                color: 'var(--bg-primary)',
              }}
            >
              Start Booking
            </button>
          </div>
        )}

        {/* ── Step 2: Live Progress ── */}
        {phase === 'progress' && (
          <div className="space-y-4">
            <div className="space-y-3">
              {progressSteps.map((step) => {
                const stepStatus = getStepStatus(step.key);
                return (
                  <div key={step.key} className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor:
                          stepStatus === 'done' ? 'var(--success)' :
                          stepStatus === 'active' ? 'var(--accent-travel)' :
                          'var(--bg-surface-elevated)',
                      }}
                    >
                      {stepStatus === 'done' ? (
                        <Check size={14} style={{ color: 'var(--bg-primary)' }} />
                      ) : stepStatus === 'active' ? (
                        <Loader2 size={14} className="animate-spin" style={{ color: 'var(--bg-primary)' }} />
                      ) : (
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--text-secondary)' }} />
                      )}
                    </div>
                    <span
                      className="text-sm"
                      style={{
                        color: stepStatus === 'pending' ? 'var(--text-secondary)' : 'var(--text-primary)',
                        fontWeight: stepStatus === 'active' ? 500 : 400,
                      }}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              onClick={cancelBooking}
              className="w-full py-2 rounded-full text-sm border transition-colors"
              style={{
                borderColor: 'var(--text-secondary)' + '40',
                color: 'var(--text-secondary)',
                backgroundColor: 'transparent',
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── Step 3: Result ── */}
        {phase === 'result' && (
          <div className="space-y-4">
            {error ? (
              <div className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--warning)' + '15' }}>
                <AlertCircle size={20} style={{ color: 'var(--warning)' }} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--warning)' }}>Booking Issue</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{error}</p>
                </div>
              </div>
            ) : result?.status === 'awaiting_payment' ? (
              <div className="text-center space-y-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
                  style={{ backgroundColor: 'var(--accent-travel)' + '20' }}
                >
                  <Check size={24} style={{ color: 'var(--accent-travel)' }} />
                </div>
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Ready for payment!</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Your details have been filled in. Complete checkout on the airline website.
                  </p>
                </div>
              </div>
            ) : result?.status === 'completed' ? (
              <div className="text-center space-y-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
                  style={{ backgroundColor: 'var(--success)' + '20' }}
                >
                  <Check size={24} style={{ color: 'var(--success)' }} />
                </div>
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Booking complete!</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {result.message?.substring(0, 200)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {result?.message || 'Processing complete.'}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              {result?.bookingUrl && (
                <a
                  href={result.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 rounded-full text-sm text-center flex items-center justify-center gap-1.5 border"
                  style={{
                    borderColor: 'var(--accent-travel)' + '40',
                    color: 'var(--accent-travel)',
                  }}
                >
                  <ExternalLink size={14} />
                  Open Booking
                </a>
              )}
              {(result?.status === 'completed' || result?.status === 'awaiting_payment') && (
                <button
                  onClick={addToCalendar}
                  className="flex-1 py-2 rounded-full text-sm flex items-center justify-center gap-1.5"
                  style={{
                    backgroundColor: 'var(--accent-travel)',
                    color: 'var(--bg-primary)',
                  }}
                >
                  <CalendarPlus size={14} />
                  Add to Calendar
                </button>
              )}
            </div>

            <button
              onClick={() => {
                onComplete(result);
                onClose();
              }}
              className="w-full py-2 rounded-full text-sm border transition-colors"
              style={{
                borderColor: 'var(--text-secondary)' + '40',
                color: 'var(--text-secondary)',
                backgroundColor: 'transparent',
              }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
