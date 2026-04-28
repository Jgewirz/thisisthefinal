import { Circle, AlertTriangle, CircleSlash2, Loader2 } from 'lucide-react';
import { useStatusStore } from '../../stores/status';
import { agentStatusView, type AgentHealth } from '../../core/agentStatus';
import type { AgentId } from '../../core/types';

interface AgentStatusPillProps {
  agentId: AgentId;
}

function colorFor(health: AgentHealth): string {
  switch (health) {
    case 'live':
      return 'var(--success, #10b981)';
    case 'links':
      return 'var(--warning, #f59e0b)';
    case 'offline':
      return 'var(--error, #ef4444)';
    case 'unknown':
      return 'var(--text-secondary)';
  }
}

/**
 * Tiny provider-status pill rendered inside the chat header. Lets the user
 * see at a glance whether the current agent is live, in links-only mode,
 * offline, or still being checked — before they type.
 */
export function AgentStatusPill({ agentId }: AgentStatusPillProps) {
  const status = useStatusStore((s) => s.status);
  const loaded = useStatusStore((s) => s.loaded);
  const loading = useStatusStore((s) => s.loading);

  // Until we've loaded once, prefer an explicit "Checking…" state over a
  // potentially wrong "Live" — but don't disable the UI.
  const view = loaded
    ? agentStatusView(agentId, status)
    : {
        id: agentId,
        health: 'unknown' as AgentHealth,
        label: 'Checking…',
        detail: 'Checking provider status…',
      };

  const color = colorFor(view.health);
  const Icon =
    view.health === 'live'
      ? Circle
      : view.health === 'links'
        ? AlertTriangle
        : view.health === 'offline'
          ? CircleSlash2
          : Loader2;

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={`${agentId} agent: ${view.label}. ${view.detail}`}
      title={view.detail}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border"
      style={{
        backgroundColor: 'var(--bg-surface-elevated, rgba(0,0,0,0.06))',
        borderColor: 'var(--bg-surface-elevated, rgba(0,0,0,0.1))',
        color,
      }}
    >
      <Icon
        size={9}
        className={!loaded && loading ? 'animate-spin' : ''}
        style={{ color }}
        aria-hidden="true"
        fill={view.health === 'live' ? color : 'none'}
      />
      <span>{view.label}</span>
    </span>
  );
}
