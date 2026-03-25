import { useState, useEffect, useCallback } from 'react';
import {
  Link2, Moon, UtensilsCrossed, Chrome, Loader2,
  CheckCircle2, XCircle, ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react';
import { ResyLinkForm } from './ResyLinkForm';
import { HatchLinkForm } from './HatchLinkForm';
import { useLifestyleStore } from '../../stores/lifestyle';
import { loginWithGoogle } from '../../lib/session';

// ── Types ────────────────────────────────────────────────────────────────

interface ServiceStatus {
  linked: boolean;
  email?: string | null;
  displayName?: string | null;
  status?: string | null;
  lastUsed?: string | null;
  linkedAt?: string | null;
  connectedAt?: string | null;
  devices?: any[];
}

interface AccountsStatus {
  google: ServiceStatus;
  resy: ServiceStatus;
  hatch: ServiceStatus;
}

type LinkType = 'oauth' | 'credentials';

interface ServiceDef {
  key: string;
  name: string;
  description: string;
  Icon: React.ComponentType<any>;
  color: string;
  linkType: LinkType;
}

// ── Service definitions ──────────────────────────────────────────────────

const SERVICES: ServiceDef[] = [
  {
    key: 'google',
    name: 'Google',
    description: 'Calendar sync & Gmail',
    Icon: Chrome,
    color: '#4285F4',
    linkType: 'oauth',
  },
  {
    key: 'resy',
    name: 'Resy',
    description: 'Restaurant reservations & time slots',
    Icon: UtensilsCrossed,
    color: 'var(--accent-lifestyle)',
    linkType: 'credentials',
  },
  {
    key: 'hatch',
    name: 'Hatch',
    description: 'Sound machine & sunrise alarm control',
    Icon: Moon,
    color: 'var(--accent-lifestyle)',
    linkType: 'credentials',
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Service Card ─────────────────────────────────────────────────────────

function ServiceCard({
  service,
  status,
  onConnect,
  onDisconnect,
}: {
  service: ServiceDef;
  status: ServiceStatus | undefined;
  onConnect: (serviceKey: string) => void;
  onDisconnect: (serviceKey: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const linked = status?.linked ?? false;
  const { Icon } = service;

  const handleDisconnect = async () => {
    if (!confirmDisconnect) {
      setConfirmDisconnect(true);
      return;
    }
    setDisconnecting(true);
    onDisconnect(service.key);
    setConfirmDisconnect(false);
    setDisconnecting(false);
  };

  const handleConnect = () => {
    if (service.linkType === 'oauth') {
      onConnect(service.key);
    } else {
      setExpanded(true);
    }
  };

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--bg-surface-elevated)', backgroundColor: 'var(--bg-surface)' }}
    >
      <div className="flex items-center gap-3 p-4">
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: linked ? service.color + '20' : 'var(--bg-surface-elevated)',
          }}
        >
          <Icon
            size={20}
            style={{ color: linked ? service.color : 'var(--text-secondary)' }}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
              {service.name}
            </span>
            {linked ? (
              <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
            ) : (
              <XCircle size={14} style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
            )}
          </div>

          {linked && status?.email ? (
            <div className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
              {status.email}
              {status.lastUsed && (
                <span className="ml-2 text-xs opacity-70">
                  Used {timeAgo(status.lastUsed)}
                </span>
              )}
            </div>
          ) : (
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {service.description}
            </div>
          )}

          {/* Hatch devices count */}
          {linked && service.key === 'hatch' && status?.devices?.length ? (
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {status.devices.length} device{status.devices.length !== 1 ? 's' : ''} linked
            </div>
          ) : null}

          {/* Expired status */}
          {status?.status === 'expired' && (
            <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: 'var(--warning)' }}>
              <AlertTriangle size={10} />
              Session expired — reconnect to continue
            </div>
          )}
        </div>

        {/* Action button */}
        {linked ? (
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              backgroundColor: confirmDisconnect ? 'var(--error, #ef4444)' + '20' : 'var(--bg-surface-elevated)',
              color: confirmDisconnect ? 'var(--error, #ef4444)' : 'var(--text-secondary)',
            }}
          >
            {disconnecting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : confirmDisconnect ? (
              'Confirm'
            ) : (
              'Disconnect'
            )}
          </button>
        ) : (
          <button
            onClick={handleConnect}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ backgroundColor: service.color, color: 'var(--bg-primary)' }}
          >
            Connect
          </button>
        )}
      </div>

      {/* Inline credential form (Resy / Hatch) */}
      {expanded && !linked && service.linkType === 'credentials' && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--bg-surface-elevated)' }}>
          <div className="pt-3">
            {service.key === 'resy' && (
              <ResyLinkForm
                onLinked={(email) => {
                  setExpanded(false);
                  useLifestyleStore.getState().setResyStatus({
                    linked: true,
                    email,
                    checkedAt: new Date().toISOString(),
                  });
                }}
                onCancel={() => setExpanded(false)}
              />
            )}
            {service.key === 'hatch' && (
              <HatchLinkForm
                onLinked={(email, deviceCount) => {
                  setExpanded(false);
                  useLifestyleStore.getState().setHatchStatus({
                    linked: true,
                    email,
                    devices: [],
                    checkedAt: new Date().toISOString(),
                  });
                }}
                onCancel={() => setExpanded(false)}
              />
            )}
          </div>
        </div>
      )}

      {/* Expand/collapse toggle for credential services when not linked */}
      {!linked && service.linkType === 'credentials' && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center py-1.5 border-t"
          style={{ borderColor: 'var(--bg-surface-elevated)', color: 'var(--text-secondary)' }}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      )}
    </div>
  );
}

// ── Main View ────────────────────────────────────────────────────────────

export function AccountsView() {
  const [statuses, setStatuses] = useState<AccountsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatuses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/accounts/status', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setStatuses(data);
      setError(null);
    } catch {
      setError('Could not load account status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  const handleConnect = (serviceKey: string) => {
    if (serviceKey === 'google') {
      loginWithGoogle();
    }
  };

  const handleDisconnect = async (serviceKey: string) => {
    try {
      const res = await fetch('/api/accounts/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ service: serviceKey }),
      });
      if (res.ok) {
        // Refresh statuses
        await fetchStatuses();

        // Clear frontend store caches
        if (serviceKey === 'resy') {
          useLifestyleStore.getState().setResyStatus({ linked: false });
        }
        if (serviceKey === 'hatch') {
          useLifestyleStore.getState().setHatchStatus({ linked: false, devices: [] });
        }
      }
    } catch {
      // Silent — will show stale status until next refresh
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <div
        className="h-14 flex items-center gap-3 px-4 border-b flex-shrink-0"
        style={{ borderColor: 'var(--bg-surface-elevated)' }}
      >
        <Link2 size={20} style={{ color: 'var(--accent-global)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Connected Accounts
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-20 sm:pb-4">
        <div className="max-w-2xl mx-auto p-4 space-y-3">
          {loading && !statuses ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-secondary)' }} />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{error}</p>
              <button
                onClick={fetchStatuses}
                className="mt-2 text-sm underline"
                style={{ color: 'var(--accent-global)' }}
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm pb-1" style={{ color: 'var(--text-secondary)' }}>
                Link your accounts so GirlBot can book, sync, and control on your behalf.
              </p>

              {SERVICES.map((service) => (
                <ServiceCard
                  key={service.key}
                  service={service}
                  status={statuses?.[service.key as keyof AccountsStatus]}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                />
              ))}

              <p className="text-xs text-center pt-4" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
                Credentials are encrypted and stored locally on the server. They are never shared with third parties.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
