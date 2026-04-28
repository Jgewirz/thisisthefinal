import { useState } from 'react';
import { Link } from 'react-router';
import { forgotPassword, type ForgotPasswordResult } from '../../lib/authApi';

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [result, setResult] = useState<ForgotPasswordResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await forgotPassword(email.trim());
      setResult(data);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset link');
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
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold mb-4"
            style={{ backgroundColor: 'var(--accent-global)', color: 'var(--bg-primary)' }}
          >
            G
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Reset your password
          </h1>
          <p className="text-sm mt-1 text-center" style={{ color: 'var(--text-secondary)' }}>
            {sent
              ? 'If that email is registered, we sent a reset link.'
              : "Enter your email and we'll send a reset link."}
          </p>
        </div>

        {error && (
          <div
            className="mb-4 px-4 py-2.5 rounded-lg text-sm"
            style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: 'var(--error)' }}
          >
            {error}
          </div>
        )}

        {!sent ? (
          <form onSubmit={onSubmit} className="space-y-4">
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
                required
                placeholder="you@example.com"
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
              disabled={loading || !email}
              className="w-full py-2.5 rounded-lg font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-50 hover:brightness-110 hover:shadow-lg"
              style={{
                backgroundColor: 'var(--accent-global)',
                color: 'var(--bg-primary)',
              }}
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        ) : (
          <div className="space-y-4 text-sm" style={{ color: 'var(--text-primary)' }}>
            <p>Check your inbox. The link expires in 30 minutes.</p>
            {result?.devResetUrl && (
              <div
                className="p-3 rounded-lg text-xs space-y-1"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px dashed var(--accent-global)',
                }}
              >
                <div className="font-semibold" style={{ color: 'var(--accent-global)' }}>
                  DEV MODE — your reset link:
                </div>
                <Link
                  to={result.devResetUrl.replace(/^https?:\/\/[^/]+/, '')}
                  className="underline break-all"
                  style={{ color: 'var(--text-primary)' }}
                  data-testid="dev-reset-link"
                >
                  {result.devResetUrl}
                </Link>
                <div style={{ color: 'var(--text-secondary)' }}>
                  (Shown only when NODE_ENV ≠ production.)
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="text-sm font-medium hover:underline"
            style={{ color: 'var(--accent-global)' }}
          >
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
