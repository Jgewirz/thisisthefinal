import type { AgentId } from './types';

/**
 * Raw provider-capability snapshot returned by `GET /api/status`.
 * Pure booleans — no secrets, no URLs.
 */
export interface ProviderStatus {
  openai: boolean;
  googlePlaces: boolean;
  amadeus: boolean;
  db: boolean;
  redis: boolean;
  checkedAt?: string;
}

export type AgentHealth = 'live' | 'links' | 'offline' | 'unknown';

export interface AgentStatusView {
  id: AgentId;
  health: AgentHealth;
  /** Short label used inline in the header badge. */
  label: string;
  /** Human-readable tooltip describing *why* the agent has this health. */
  detail: string;
}

/**
 * Optimistic default used when the server hasn't responded yet or the
 * request failed. We assume OpenAI is configured so the chat UI doesn't
 * show an alarming "Offline" badge during the first paint; real state
 * replaces it as soon as `/api/status` resolves.
 */
export const UNKNOWN_STATUS: ProviderStatus = {
  openai: true,
  googlePlaces: true,
  amadeus: true,
  db: true,
  redis: false,
};

/**
 * Map raw provider booleans → per-agent display state.
 *
 * Rules (mirror the server-side tool gating + rich-card provenance):
 *   - style:     needs openai (image analysis + chat)
 *   - travel:    openai required; amadeus → "Live", otherwise "Links only"
 *   - fitness:   openai required; googlePlaces → "Live", otherwise "Links only"
 *   - lifestyle: needs openai (reminders don't need a provider)
 *   - all:       worst-case across the four specialists
 */
export function agentStatusView(id: AgentId, status: ProviderStatus): AgentStatusView {
  if (id === 'all') {
    const views = (['style', 'travel', 'fitness', 'lifestyle'] as AgentId[]).map((a) =>
      agentStatusView(a, status)
    );
    const worst = worstHealth(views.map((v) => v.health));
    return {
      id: 'all',
      health: worst,
      label: labelFor(worst),
      detail:
        worst === 'offline'
          ? 'At least one agent is offline. Check server configuration.'
          : worst === 'links'
            ? 'Some providers are unavailable — live results are partial; booking links still work.'
            : worst === 'unknown'
              ? 'Checking provider status…'
              : 'All agents are live.',
    };
  }

  if (!status.openai) {
    return {
      id,
      health: 'offline',
      label: 'Offline',
      detail: 'OpenAI is not configured — chat and tool calls are disabled on the server.',
    };
  }

  switch (id) {
    case 'style':
      return {
        id,
        health: 'live',
        label: 'Live',
        detail: 'Style analysis ready (OpenAI Vision).',
      };
    case 'travel':
      return status.amadeus
        ? {
            id,
            health: 'live',
            label: 'Live',
            detail: 'Flights & hotels via Amadeus, with booking links as fallback.',
          }
        : {
            id,
            health: 'links',
            label: 'Links only',
            detail:
              'Amadeus is not configured — flight/hotel tools will emit booking links instead of live offers.',
          };
    case 'fitness':
      return status.googlePlaces
        ? {
            id,
            health: 'live',
            label: 'Live',
            detail: 'Studio search via Google Places, with ClassPass/Mindbody links.',
          }
        : {
            id,
            health: 'links',
            label: 'Links only',
            detail:
              'Google Places is not configured — fitness tool will emit aggregator links only.',
          };
    case 'lifestyle':
      return {
        id,
        health: 'live',
        label: 'Live',
        detail: 'Reminders and chat ready.',
      };
  }
  return { id, health: 'unknown', label: 'Unknown', detail: '' };
}

function labelFor(h: AgentHealth): string {
  switch (h) {
    case 'live':
      return 'All live';
    case 'links':
      return 'Partial';
    case 'offline':
      return 'Offline';
    case 'unknown':
      return 'Checking…';
  }
}

/**
 * Reduce an array of per-agent health values to the single worst-case one.
 * Priority (worst first): offline > links > unknown > live.
 */
export function worstHealth(items: AgentHealth[]): AgentHealth {
  if (items.includes('offline')) return 'offline';
  if (items.includes('links')) return 'links';
  if (items.includes('unknown')) return 'unknown';
  return 'live';
}
