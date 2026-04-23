import { useAuthStore } from '../stores/auth';

export type SavedItemKind = 'hotel' | 'flight' | 'place' | 'studio' | 'reminder';

export interface SavedItem {
  id: string;
  user_id: string;
  kind: SavedItemKind;
  external_id: string;
  data: Record<string, unknown>;
  created_at: string;
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { token } = useAuthStore.getState();
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 401) {
    useAuthStore.getState().logout();
    throw new Error('Session expired');
  }
  return res;
}

export async function listSavedItems(kind?: SavedItemKind): Promise<SavedItem[]> {
  const qs = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  const res = await authFetch(`/api/saved${qs}`);
  if (!res.ok) return [];
  const { items } = (await res.json()) as { items: SavedItem[] };
  return items ?? [];
}

export async function saveItem(
  kind: SavedItemKind,
  externalId: string,
  data: Record<string, unknown>
): Promise<SavedItem | null> {
  const res = await authFetch('/api/saved', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Deterministic key per (kind, id) so repeated taps never duplicate.
      'Idempotency-Key': `saved:${kind}:${externalId}`,
    },
    body: JSON.stringify({ kind, externalId, data }),
  });
  if (!res.ok) return null;
  const { item } = (await res.json()) as { item: SavedItem };
  return item ?? null;
}

export async function unsaveItem(
  kind: SavedItemKind,
  externalId: string
): Promise<boolean> {
  const qs = `?kind=${encodeURIComponent(kind)}&externalId=${encodeURIComponent(externalId)}`;
  const res = await authFetch(`/api/saved${qs}`, { method: 'DELETE' });
  return res.ok;
}
