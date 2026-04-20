import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuthStore } from '../../stores/auth';

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

  // If already authenticated, redirect to home
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

      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }

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
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 shadow-xl"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold mb-4"
            style={{ backgroundColor: 'var(--accent-global)', color: 'var(--bg-primary)' }}
          >
            G
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {isRegister ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {isRegister
              ? 'Sign up to start chatting with GirlBot'
              : 'Sign in to continue to GirlBot'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            className="mb-4 px-4 py-2.5 rounded-lg text-sm"
            style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: 'var(--error)' }}
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-2.5 rounded-lg outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--bg-surface-elevated)',
                }}
              />
            </div>
          )}

          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-2.5 rounded-lg outline-none transition-colors"
              style={{
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--bg-surface-elevated)',
              }}
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full px-4 py-2.5 rounded-lg outline-none transition-colors"
              style={{
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--bg-surface-elevated)',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-50 hover:brightness-110 hover:shadow-lg"
            style={{
              backgroundColor: 'var(--accent-global)',
              color: 'var(--bg-primary)',
            }}
          >
            {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>

          {!isRegister && (
            <div className="text-center -mt-2">
              <Link
                to="/forgot"
                className="text-xs font-medium hover:underline"
                style={{ color: 'var(--text-secondary)' }}
              >
                Forgot password?
              </Link>
            </div>
          )}
        </form>

        {/* Toggle */}
        <div className="mt-6 text-center">
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {isRegister ? 'Already have an account? ' : "Don't have an account? "}
          </span>
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            className="text-sm font-medium transition-all duration-150 hover:underline hover:brightness-125 active:opacity-70"
            style={{ color: 'var(--accent-global)' }}
          >
            {isRegister ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
}
