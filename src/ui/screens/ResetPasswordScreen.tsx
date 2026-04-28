import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { resetPassword } from '../../lib/authApi';

export function ResetPasswordScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => navigate('/login', { replace: true }), 2500);
    return () => clearTimeout(t);
  }, [done, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div
          className="w-full max-w-sm rounded-2xl p-8 shadow-xl text-center space-y-4"
          style={{ backgroundColor: 'var(--bg-surface)' }}
        >
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Missing reset token
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Open the reset link from your email, or request a new one.
          </p>
          <Link
            to="/forgot"
            className="inline-block text-sm font-medium hover:underline"
            style={{ color: 'var(--accent-global)' }}
          >
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

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
            {done ? 'Password updated' : 'Choose a new password'}
          </h1>
          {!done && (
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Pick something you don't use elsewhere.
            </p>
          )}
        </div>

        {error && (
          <div
            className="mb-4 px-4 py-2.5 rounded-lg text-sm"
            style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: 'var(--error)' }}
          >
            {error}
          </div>
        )}

        {done ? (
          <div className="space-y-3 text-sm text-center" style={{ color: 'var(--text-primary)' }}>
            <p>You can now sign in with your new password.</p>
            <Link
              to="/login"
              className="inline-block text-sm font-medium hover:underline"
              style={{ color: 'var(--accent-global)' }}
            >
              Go to sign in →
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                New password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
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
                Confirm new password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
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
              disabled={loading || !password || !confirm}
              className="w-full py-2.5 rounded-lg font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-50 hover:brightness-110 hover:shadow-lg"
              style={{
                backgroundColor: 'var(--accent-global)',
                color: 'var(--bg-primary)',
              }}
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
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
