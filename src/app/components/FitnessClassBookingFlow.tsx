import { useState, useEffect, useRef } from 'react';
import { X, Dumbbell, Loader2, Check, ExternalLink, CalendarPlus, AlertCircle, Chrome } from 'lucide-react';

interface UserInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  useGoogleLogin: boolean;
}

interface BookingStep {
  step: string;
  status: string;
  timestamp: number;
}

interface FitnessClassBookingFlowProps {
  classData: any;
  onClose: () => void;
  onComplete: (result: any) => void;
  prefillEmail?: string;
  prefillName?: string;
}

export function FitnessClassBookingFlow({
  classData,
  onClose,
  onComplete,
  prefillEmail,
  prefillName,
}: FitnessClassBookingFlowProps) {
  const [phase, setPhase] = useState<'info' | 'progress' | 'result'>('info');
  const [userInfo, setUserInfo] = useState<UserInfo>({
    firstName: prefillName?.split(' ')[0] || '',
    lastName: prefillName?.split(' ').slice(1).join(' ') || '',
    email: prefillEmail || '',
    useGoogleLogin: true,
  });
  const [jobId, setJobId] = useState<string | null>(null);
  const [steps, setSteps] = useState<BookingStep[]>([]);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('queued');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      const res = await fetch('/api/fitness/book-browser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classData, userInfo }),
      });

      if (!res.ok) throw new Error('Failed to start booking');

      const data = await res.json();
      setJobId(data.jobId);

      pollingRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/fitness/book-browser/${data.jobId}/status`);
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

      // Stop polling after 2.5 minutes max (fitness may take longer)
      setTimeout(() => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          if (status !== 'completed' && status !== 'failed') {
            setError('Booking is taking too long. Check back later or book manually.');
            setPhase('result');
          }
        }
      }, 150000);
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
    { key: 'navigating', label: 'Opening studio website...' },
    { key: 'finding_class', label: 'Finding your class...' },
    { key: 'filling_form', label: 'Filling in your details...' },
    { key: 'processing', label: 'Processing results...' },
  ];

  const getStepStatus = (stepKey: string) => {
    const stepIndex = progressSteps.findIndex((s) => s.key === stepKey);
    const currentIndex = progressSteps.findIndex((s) => s.key === status);
    if (currentIndex > stepIndex) return 'done';
    if (currentIndex === stepIndex) return 'active';
    return 'pending';
  };

  const studioUrl = classData.studioWebsite || classData.bookingUrl || '';

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
            style={{ backgroundColor: 'var(--accent-fitness)' + '20' }}
          >
            <Dumbbell size={20} style={{ color: 'var(--accent-fitness)' }} />
          </div>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Book Class
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {classData.className} at {classData.studioName}
            </p>
          </div>
        </div>

        {/* ── Phase 1: User Info ── */}
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
                  value={userInfo.lastName}
                  onChange={(e) => setUserInfo({ ...userInfo, lastName: e.target.value })}
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
                value={userInfo.email}
                onChange={(e) => setUserInfo({ ...userInfo, email: e.target.value })}
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
                value={userInfo.phone || ''}
                onChange={(e) => setUserInfo({ ...userInfo, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border-0 outline-none"
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  color: 'var(--text-primary)',
                }}
                placeholder="+1 555 123 4567"
              />
            </div>

            {/* Google Login toggle */}
            <button
              onClick={() => setUserInfo({ ...userInfo, useGoogleLogin: !userInfo.useGoogleLogin })}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
              style={{
                backgroundColor: userInfo.useGoogleLogin
                  ? 'rgba(66, 133, 244, 0.15)'
                  : 'var(--bg-surface-elevated)',
                border: userInfo.useGoogleLogin
                  ? '1px solid rgba(66, 133, 244, 0.3)'
                  : '1px solid transparent',
              }}
            >
              <Chrome
                size={18}
                style={{ color: userInfo.useGoogleLogin ? '#4285F4' : 'var(--text-secondary)' }}
              />
              <span style={{ color: userInfo.useGoogleLogin ? '#4285F4' : 'var(--text-secondary)' }}>
                Sign in with Google if available
              </span>
              <div
                className="ml-auto w-8 h-5 rounded-full relative transition-colors"
                style={{
                  backgroundColor: userInfo.useGoogleLogin ? '#4285F4' : 'var(--bg-primary)',
                }}
              >
                <div
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                  style={{ left: userInfo.useGoogleLogin ? '14px' : '2px' }}
                />
              </div>
            </button>

            {/* Class summary */}
            <div
              className="p-3 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
            >
              <div className="flex justify-between">
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {classData.className}
                </span>
              </div>
              <div className="mt-1">
                {classData.date} · {classData.time}
                {classData.duration ? ` · ${classData.duration}` : ''}
              </div>
              {classData.instructor && (
                <div className="mt-0.5">with {classData.instructor}</div>
              )}
              <div className="mt-0.5">{classData.studioName}</div>
            </div>

            <button
              onClick={startBooking}
              disabled={!userInfo.firstName || !userInfo.lastName || !userInfo.email}
              className="w-full py-2.5 rounded-full text-sm font-medium transition-opacity disabled:opacity-40"
              style={{
                backgroundColor: 'var(--accent-fitness)',
                color: 'var(--bg-primary)',
              }}
            >
              Start Booking
            </button>
          </div>
        )}

        {/* ── Phase 2: Live Progress ── */}
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
                          stepStatus === 'active' ? 'var(--accent-fitness)' :
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

            {userInfo.useGoogleLogin && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                style={{ backgroundColor: 'rgba(66, 133, 244, 0.1)', color: '#4285F4' }}
              >
                <Chrome size={14} />
                Using Google login when available
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

        {/* ── Phase 3: Result ── */}
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
            ) : result?.status === 'booked' || result?.status === 'already_registered' ? (
              <div className="text-center space-y-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
                  style={{ backgroundColor: 'var(--success)' + '20' }}
                >
                  <Check size={24} style={{ color: 'var(--success)' }} />
                </div>
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {result.status === 'already_registered' ? 'Already registered!' : 'Class booked!'}
                  </p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {result.status === 'already_registered'
                      ? "You're already signed up for this class."
                      : `You're all set for ${classData.className} at ${classData.time}.`}
                  </p>
                </div>
              </div>
            ) : result?.status === 'payment_required' ? (
              <div className="text-center space-y-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
                  style={{ backgroundColor: 'var(--accent-fitness)' + '20' }}
                >
                  <AlertCircle size={24} style={{ color: 'var(--accent-fitness)' }} />
                </div>
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Payment required</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    This class requires payment. Complete checkout on the studio website.
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
              {studioUrl && (
                <a
                  href={studioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 rounded-full text-sm text-center flex items-center justify-center gap-1.5 border"
                  style={{
                    borderColor: 'var(--accent-fitness)' + '40',
                    color: 'var(--accent-fitness)',
                  }}
                >
                  <ExternalLink size={14} />
                  Open Website
                </a>
              )}
              {(result?.status === 'booked' || result?.status === 'already_registered') && (
                <button
                  onClick={() => {
                    onComplete(result);
                    onClose();
                  }}
                  className="flex-1 py-2 rounded-full text-sm flex items-center justify-center gap-1.5"
                  style={{
                    backgroundColor: 'var(--accent-fitness)',
                    color: 'var(--bg-primary)',
                  }}
                >
                  <CalendarPlus size={14} />
                  Add to Schedule
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
