import { UNKNOWN_STATUS, type ProviderStatus } from '../app/agentStatus';

/**
 * Fetch the public `/api/status` snapshot. Fails open: if the request
 * fails or returns an unexpected shape, we hand back an optimistic
 * default so the UI never blocks on this.
 */
export async function fetchProviderStatus(): Promise<ProviderStatus> {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) return UNKNOWN_STATUS;
    const raw = (await res.json()) as Partial<ProviderStatus>;
    return {
      openai: Boolean(raw.openai),
      googlePlaces: Boolean(raw.googlePlaces),
      amadeus: Boolean(raw.amadeus),
      db: Boolean(raw.db),
      redis: Boolean(raw.redis),
      checkedAt: typeof raw.checkedAt === 'string' ? raw.checkedAt : undefined,
    };
  } catch {
    return UNKNOWN_STATUS;
  }
}
