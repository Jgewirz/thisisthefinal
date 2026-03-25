import { useState, useEffect, useRef } from 'react';
import { X, UtensilsCrossed, Scissors, Sparkles, Loader2, Check, ExternalLink, CalendarPlus, AlertCircle, Chrome, Phone } from 'lucide-react';
import { useUserStore } from '../../stores/user';

interface UserInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

interface LifestyleBookingFlowProps {
  bookingData: {
    bookingType: 'restaurant' | 'salon' | 'spa' | 'nails' | 'selfcare';
    venueName: string;
    venueWebsite?: string;
    bookingUrl?: string;
    venueAddress?: string;
    venuePhone?: string;
    venueGoogleMapsUrl?: string;
    venuePlaceId?: string;
    date?: string;
    time?: string;
    partySize?: number;
    serviceType?: string;
  };
  onClose: () => void;
  onComplete: (result: any) => void;
}

const typeIcons = {
  restaurant: UtensilsCrossed,
  salon: Scissors,
  spa: Sparkles,
  nails: Sparkles,
  selfcare: Sparkles,
};

const typeLabels = {
  restaurant: 'Reserve Table',
  salon: 'Book Appointment',
  spa: 'Book Treatment',
  nails: 'Book Appointment',
  selfcare: 'Book Service',
};

export function LifestyleBookingFlow({
  bookingData,
  onClose,
  onComplete,
}: LifestyleBookingFlowProps) {
  const user = useUserStore((s) => s.user);

  const nameParts = (user?.displayName || '').split(' ');
  const autoFirstName = nameParts[0] || '';
  const autoLastName = nameParts.slice(1).join(' ') || '';
  const autoEmail = user?.email || '';
  const isGoogleUser = user?.provider === 'google';

  const hasAutoInfo = !!(autoFirstName && autoEmail);
  const isRestaurant = bookingData.bookingType === 'restaurant';

  const [phase, setPhase] = useState<'info' | 'confirm' | 'progress' | 'result'>(
    hasAutoInfo ? 'confirm' : 'info'
  );
  const [userInfo, setUserInfo] = useState<UserInfo>({
    firstName: autoFirstName,
    lastName: autoLastName,
    email: autoEmail,
  });
  const [date, setDate] = useState(bookingData.date || '');
  const [time, setTime] = useState(bookingData.time || '');
  const [partySize, setPartySize] = useState(bookingData.partySize || 2);
  const [serviceType, setServiceType] = useState(bookingData.serviceType || '');
  const [specialRequests, setSpecialRequests] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('queued');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasGoogleProfile, setHasGoogleProfile] = useState<boolean | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const TypeIcon = typeIcons[bookingData.bookingType] || Sparkles;
  const typeLabel = typeLabels[bookingData.bookingType] || 'Book';
  const accentColor = 'var(--accent-lifestyle)';

  // Check browser profile on mount
  useEffect(() => {
    fetch('/api/fitness/browser-profile', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setHasGoogleProfile(data.hasProfile === true))
      .catch(() => setHasGoogleProfile(false));
  }, []);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const startBooking = async () => {
    if (!userInfo.firstName || !userInfo.lastName || !userInfo.email) return;

    setPhase('progress');
    setError(null);

    try {
      const fullBookingData = {
        ...bookingData,
        date,
        time,
        partySize: isRestaurant ? partySize : undefined,
        serviceType: !isRestaurant ? serviceType : undefined,
        specialRequests: specialRequests || undefined,
      };

      const res = await fetch('/api/lifestyle/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ bookingData: fullBookingData, userInfo }),
      });

      if (!res.ok) throw new Error('Failed to start booking');

      const data = await res.json();
      setJobId(data.jobId);

      pollingRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/lifestyle/book/${data.jobId}/status`, { credentials: 'include' });
          if (!statusRes.ok) return;

          const statusData = await statusRes.json();
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

      // Stop polling after 5.5 minutes max
      setTimeout(() => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          if (status !== 'completed' && status !== 'failed') {
            setError('Booking is taking too long. Check back later or book manually.');
            setPhase('result');
          }
        }
      }, 330000);
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

  const progressSteps = [
    { key: 'navigating', label: 'Opening venue website...' },
    { key: 'finding_form', label: 'Finding booking form...' },
    { key: 'filling_details', label: 'Filling in your details...' },
    { key: 'processing', label: 'Processing results...' },
  ];

  const getStepStatus = (stepKey: string) => {
    const stepIndex = progressSteps.findIndex((s) => s.key === stepKey);
    const currentIndex = progressSteps.findIndex((s) => s.key === status);
    if (currentIndex > stepIndex) return 'done';
    if (currentIndex === stepIndex) return 'active';
    return 'pending';
  };

  const venueUrl = bookingData.venueWebsite || bookingData.bookingUrl || '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 relative max-h-[90vh] overflow-y-auto"
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
            style={{ backgroundColor: accentColor + '20' }}
          >
            <TypeIcon size={20} style={{ color: accentColor }} />
          </div>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              {typeLabel}
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {bookingData.venueName}
            </p>
          </div>
        </div>

        {/* ── Phase: Confirm (auto-filled) ── */}
        {phase === 'confirm' && (
          <div className="space-y-4">
            {/* Venue summary */}
            <div
              className="p-3 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
            >
              <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {bookingData.venueName}
              </div>
              {bookingData.venueAddress && (
                <div className="mt-0.5 text-xs">{bookingData.venueAddress}</div>
              )}
              <div className="mt-1">
                {date && <span>{date}</span>}
                {time && <span> · {time}</span>}
                {isRestaurant && <span> · {partySize} guests</span>}
                {!isRestaurant && serviceType && <span> · {serviceType}</span>}
              </div>
            </div>

            {/* Booking as user */}
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                style={{ backgroundColor: accentColor + '20', color: accentColor }}
              >
                {userInfo.firstName[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ color: 'var(--text-primary)' }}>
                  {userInfo.firstName} {userInfo.lastName}
                </div>
                <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                  {userInfo.email}
                </div>
              </div>
              <button
                onClick={() => setPhase('info')}
                className="text-xs px-2 py-1 rounded-full"
                style={{ color: accentColor }}
              >
                Edit
              </button>
            </div>

            {/* Date/Time/Party size quick edit for restaurants */}
            {isRestaurant && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg text-xs border-0 outline-none"
                    style={{ backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Time</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg text-xs border-0 outline-none"
                    style={{ backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Guests</label>
                  <select
                    value={partySize}
                    onChange={(e) => setPartySize(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-lg text-xs border-0 outline-none"
                    style={{ backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-primary)' }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Google profile status */}
            {hasGoogleProfile && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                style={{ backgroundColor: 'rgba(66, 133, 244, 0.1)', color: '#4285F4' }}
              >
                <Chrome size={14} />
                Google account connected — auto sign-in enabled
              </div>
            )}

            <button
              onClick={startBooking}
              disabled={!date && isRestaurant}
              className="w-full py-2.5 rounded-full text-sm font-medium transition-opacity disabled:opacity-40"
              style={{ backgroundColor: accentColor, color: 'var(--bg-primary)' }}
            >
              {typeLabel} Now
            </button>
          </div>
        )}

        {/* ── Phase: Info (manual entry) ── */}
        {phase === 'info' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>First Name</label>
                <input
                  type="text"
                  value={userInfo.firstName}
                  onChange={(e) => setUserInfo({ ...userInfo, firstName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm border-0 outline-none"
                  style={{ backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-primary)' }}
                  placeholder="Jane"
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Last Name</label>
                <input
                  type="text"
                  value={userInfo.lastName}
                  onChange={(e) => setUserInfo({ ...userInfo, lastName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm border-0 outline-none"
                  style={{ backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-primary)' }}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Email</label>
              <input
                type="email"
                value={userInfo.email}
                onChange={(e) => setUserInfo({ ...userInfo, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border-0 outline-none"
                style={{ backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-primary)' }}
                placeholder="jane@example.com"
              />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Phone (optional)</label>
              <input
                type="tel"
                value={userInfo.phone || ''}
                onChange={(e) => setUserInfo({ ...userInfo, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border-0 outline-none"
                style={{ backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-primary)' }}
                placeholder="+1 555 123 4567"
              />
            </div>

            {/* Restaurant-specific fields */}
            {isRestaurant && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-2 py-2 rounded-lg text-sm border-0 outline-none"
                    style={{ backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Time</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-2 py-2 rounded-lg text-sm border-0 outline-none"
                    style={{ backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Guests</label>
                  <select
                    value={partySize}
                    onChange={(e) => setPartySize(Number(e.target.value))}
                    className="w-full px-2 py-2 rounded-lg text-sm border-0 outline-none"
                    style={{ backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-primary)' }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Salon/spa fields */}
            {!isRestaurant && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-2 py-2 rounded-lg text-sm border-0 outline-none"
                    style={{ backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Time</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-2 py-2 rounded-lg text-sm border-0 outline-none"
                    style={{ backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
            )}

            {/* Special requests */}
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Special Requests (optional)</label>
              <input
                type="text"
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border-0 outline-none"
                style={{ backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-primary)' }}
                placeholder={isRestaurant ? 'Window seat, birthday celebration...' : 'Any preferences...'}
              />
            </div>

            {/* Venue summary */}
            <div
              className="p-3 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
            >
              <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {bookingData.venueName}
              </div>
              {bookingData.venueAddress && (
                <div className="mt-0.5 text-xs">{bookingData.venueAddress}</div>
              )}
            </div>

            <button
              onClick={() => {
                if (userInfo.firstName && userInfo.lastName && userInfo.email) {
                  startBooking();
                }
              }}
              disabled={!userInfo.firstName || !userInfo.lastName || !userInfo.email}
              className="w-full py-2.5 rounded-full text-sm font-medium transition-opacity disabled:opacity-40"
              style={{ backgroundColor: accentColor, color: 'var(--bg-primary)' }}
            >
              {typeLabel} Now
            </button>
          </div>
        )}

        {/* ── Phase: Live Progress ── */}
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
                          stepStatus === 'active' ? accentColor :
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

            {hasGoogleProfile && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                style={{ backgroundColor: 'rgba(66, 133, 244, 0.1)', color: '#4285F4' }}
              >
                <Chrome size={14} />
                Using your Google account for auto sign-in
              </div>
            )}

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

        {/* ── Phase: Result ── */}
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
            ) : result?.status === 'booked' ? (
              <div className="text-center space-y-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
                  style={{ backgroundColor: 'var(--success)' + '20' }}
                >
                  <Check size={24} style={{ color: 'var(--success)' }} />
                </div>
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {isRestaurant ? 'Reservation confirmed!' : 'Appointment booked!'}
                  </p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {isRestaurant
                      ? `You're all set at ${bookingData.venueName} for ${partySize} on ${date} at ${time}.`
                      : `Your appointment at ${bookingData.venueName} is confirmed for ${date} at ${time}.`}
                  </p>
                </div>
              </div>
            ) : result?.status === 'payment_required' ? (
              <div className="text-center space-y-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
                  style={{ backgroundColor: accentColor + '20' }}
                >
                  <AlertCircle size={24} style={{ color: accentColor }} />
                </div>
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Payment required</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    This booking requires a deposit or payment. Complete it on the venue's website.
                  </p>
                </div>
              </div>
            ) : result?.status === 'no_availability' ? (
              <div className="text-center space-y-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
                  style={{ backgroundColor: 'var(--warning)' + '20' }}
                >
                  <AlertCircle size={24} style={{ color: 'var(--warning)' }} />
                </div>
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>No availability</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    No slots available for the requested date/time. Try a different time or date.
                  </p>
                </div>
              </div>
            ) : result?.status === 'login_required' ? (
              <div className="text-center space-y-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
                  style={{ backgroundColor: 'var(--warning)' + '20' }}
                >
                  <AlertCircle size={24} style={{ color: 'var(--warning)' }} />
                </div>
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Sign in required</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    You need to sign into {result.domain || 'this venue'} first. Use the email-based reservation as a fallback.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {result?.message?.substring(0, 200) || 'Processing complete.'}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              {venueUrl && (
                <a
                  href={venueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 rounded-full text-sm text-center flex items-center justify-center gap-1.5 border"
                  style={{ borderColor: accentColor + '40', color: accentColor }}
                >
                  <ExternalLink size={14} />
                  Open Website
                </a>
              )}
              {bookingData.venuePhone && (
                <a
                  href={`tel:${bookingData.venuePhone}`}
                  className="py-2 px-4 rounded-full text-sm flex items-center justify-center gap-1.5 border"
                  style={{ borderColor: accentColor + '40', color: accentColor }}
                >
                  <Phone size={14} />
                  Call
                </a>
              )}
              {result?.status === 'booked' && (
                <button
                  onClick={() => {
                    onComplete(result);
                    onClose();
                  }}
                  className="flex-1 py-2 rounded-full text-sm flex items-center justify-center gap-1.5"
                  style={{ backgroundColor: accentColor, color: 'var(--bg-primary)' }}
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
