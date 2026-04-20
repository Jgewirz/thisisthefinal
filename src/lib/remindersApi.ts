import type { ReminderData, ReminderStatus } from '../app/types';
import { useAuthStore } from '../stores/auth';

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

export async function listReminders(
  params: { status?: ReminderStatus[]; due?: boolean } = {}
): Promise<ReminderData[]> {
  const qs = new URLSearchParams();
  if (params.due) qs.set('due', '1');
  if (params.status?.length) qs.set('status', params.status.join(','));
  const res = await authFetch(`/api/reminders?${qs.toString()}`);
  if (!res.ok) return [];
  const { reminders } = (await res.json()) as { reminders: ReminderData[] };
  return reminders ?? [];
}

export async function updateReminderStatus(
  id: string,
  status: ReminderStatus
): Promise<ReminderData | null> {
  const res = await authFetch(`/api/reminders/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) return null;
  const { reminder } = (await res.json()) as { reminder: ReminderData };
  return reminder;
}

export async function deleteReminder(id: string): Promise<boolean> {
  const res = await authFetch(`/api/reminders/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return res.ok;
}
