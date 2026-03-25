import { useState } from 'react';
import { Loader2, UtensilsCrossed, AlertCircle, Check, ExternalLink } from 'lucide-react';
import { linkResy } from '../../lib/api';

interface ResyLinkFormProps {
  onLinked: (email: string) => void;
  onCancel: () => void;
}

export function ResyLinkForm({ onLinked, onCancel }: ResyLinkFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const accentColor = 'var(--accent-lifestyle)';

  const handleSubmit = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError(null);

    try {
      const result = await linkResy(email, password);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => onLinked(email), 800);
      } else {
        setError(result.error || 'Failed to link account');
      }
    } catch {
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div
        className="rounded-xl p-4 border"
        style={{ borderColor: 'var(--bg-surface-elevated)', backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--success)' + '20' }}
          >
            <Check size={16} style={{ color: 'var(--success)' }} />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Resy connected!
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Searching for restaurants...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-4 border space-y-3"
      style={{ borderColor: 'var(--bg-surface-elevated)', backgroundColor: 'var(--bg-surface)' }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: accentColor + '20' }}
        >
          <UtensilsCrossed size={16} style={{ color: accentColor }} />
        </div>
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Link Your Resy Account
          </p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            One-time setup to book restaurants
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Resy email"
          className="w-full px-3 py-2 rounded-lg text-sm border-0 outline-none"
          style={{ backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-primary)' }}
          disabled={loading}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Resy password"
          className="w-full px-3 py-2 rounded-lg text-sm border-0 outline-none"
          style={{ backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-primary)' }}
          disabled={loading}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--warning)' }}>
          <AlertCircle size={12} />
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={handleSubmit}
          disabled={!email || !password || loading}
          className="flex-1 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40 flex items-center justify-center gap-1.5"
          style={{ backgroundColor: accentColor, color: 'var(--bg-primary)' }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : null}
          {loading ? 'Connecting...' : 'Link Account'}
        </button>
        <button
          onClick={onCancel}
          className="py-2 px-3 rounded-lg text-sm"
          style={{ color: 'var(--text-secondary)' }}
        >
          Cancel
        </button>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        Don't have Resy?{' '}
        <a
          href="https://resy.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5"
          style={{ color: accentColor }}
        >
          Create a free account <ExternalLink size={10} />
        </a>
      </p>
    </div>
  );
}
