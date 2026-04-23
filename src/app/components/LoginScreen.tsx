import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuthStore } from '../../stores/auth';
import { Loader2 } from 'lucide-react';

export function LoginScreen() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const navigate = useNavigate();

  if (isAuthenticated) {
    navigate('/', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const body = isRegister
        ? { email, password, name: name || email.split('@')[0] }
        : { email, password };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong'); return; }
      login(data.token, data.user);
      navigate('/', { replace: true });
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* ── Left brand panel (hidden on mobile) ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[44%] p-12 relative overflow-hidden"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        {/* Background gradient blobs */}
        <div
          className="absolute top-[-120px] left-[-80px] w-[380px] h-[380px] rounded-full blur-[120px] pointer-events-none"
          style={{ backgroundColor: 'rgba(124, 106, 252, 0.18)' }}
        />
        <div
          className="absolute bottom-[-100px] right-[-60px] w-[300px] h-[300px] rounded-full blur-[100px] pointer-events-none"
          style={{ backgroundColor: 'rgba(232, 121, 160, 0.14)' }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold"
            style={{
              background: 'linear-gradient(135deg, #7c6afc 0%, #e879a0 100%)',
              color: '#fff',
              boxShadow: '0 4px 20px rgba(124,106,252,0.5)',
            }}
          >
            G
          </div>
          <span
            className="text-lg font-bold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            GirlBot
          </span>
        </div>

        {/* Middle: headline */}
        <div className="relative z-10 space-y-5">
          <div className="space-y-3">
            <div
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: 'var(--accent-global)' }}
            >
              AI-powered lifestyle
            </div>
            <h1
              className="text-4xl font-extrabold leading-tight tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              Style. Travel.
              <br />
              Fitness.
              <br />
              <span
                style={{
                  background: 'linear-gradient(90deg, #7c6afc, #e879a0)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                All in one.
              </span>
            </h1>
          </div>
          <p
            className="text-sm leading-relaxed max-w-xs"
            style={{ color: 'var(--text-secondary)' }}
          >
            Your personal AI assistant for outfit advice, flight search, fitness classes,
            and daily lifestyle planning — all in one beautiful app.
          </p>

          {/* Agent pills */}
          <div className="flex flex-wrap gap-2 pt-2">
            {[
              { label: 'Style', color: '#e879a0' },
              { label: 'Travel', color: '#3ab7f5' },
              { label: 'Fitness', color: '#22d3a0' },
              { label: 'Lifestyle', color: '#f5a623' },
            ].map((a) => (
              <span
                key={a.label}
                className="text-xs px-3 py-1 rounded-full font-medium"
                style={{ backgroundColor: `${a.color}18`, color: a.color }}
              >
                {a.label}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom quote */}
        <div className="relative z-10">
          <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
            "The smartest way to plan your day, your outfit, and your life."
          </p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold"
              style={{
                background: 'linear-gradient(135deg, #7c6afc 0%, #e879a0 100%)',
                color: '#fff',
              }}
            >
              G
            </div>
            <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              GirlBot
            </span>
          </div>

          {/* Heading */}
          <div className="space-y-1.5">
            <h2
              className="text-2xl font-bold tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              {isRegister ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {isRegister
                ? 'Sign up to start your GirlBot experience'
                : 'Sign in to continue to GirlBot'}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              className="px-4 py-3 rounded-xl text-sm"
              style={{
                backgroundColor: 'rgba(239,68,68,0.1)',
                color: 'var(--error)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <InputField
                label="Name"
                type="text"
                value={name}
                onChange={setName}
                placeholder="Your name"
                disabled={loading}
              />
            )}
            <InputField
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              required
              disabled={loading}
            />
            <InputField
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              required
              minLength={6}
              disabled={loading}
            />

            {!isRegister && (
              <div className="flex justify-end -mt-2">
                <Link
                  to="/forgot"
                  className="text-xs font-medium hover:underline"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Forgot password?
                </Link>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-150 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              style={{
                background: 'linear-gradient(135deg, #7c6afc, #e879a0)',
                color: '#fff',
                boxShadow: '0 4px 20px rgba(124,106,252,0.35)',
              }}
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? 'Please wait…' : isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          {/* Toggle */}
          <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
            {isRegister ? 'Already have an account? ' : "Don't have an account? "}
            <button
              onClick={() => { setIsRegister(!isRegister); setError(''); }}
              className="font-semibold hover:underline"
              style={{ color: 'var(--accent-global)' }}
            >
              {isRegister ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function InputField({
  label,
  type,
  value,
  onChange,
  placeholder,
  required,
  minLength,
  disabled,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-150 disabled:opacity-50"
        style={{
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          border: focused
            ? '1px solid var(--accent-global)'
            : '1px solid var(--border-subtle)',
          boxShadow: focused ? '0 0 0 2px rgba(124,106,252,0.18)' : 'none',
        }}
      />
    </div>
  );
}
