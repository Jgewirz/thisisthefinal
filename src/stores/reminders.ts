import { create } from 'zustand';
import type { ReminderData, ReminderStatus } from '../app/types';

interface ReminderState {
  byId: Record<string, ReminderData>;
  notifiedIds: Set<string>;
  lastPolledAt: number | null;
  permission: NotificationPermission | 'unsupported';
  setMany: (list: ReminderData[]) => void;
  upsert: (r: ReminderData) => void;
  setStatus: (id: string, status: ReminderStatus) => void;
  markNotified: (id: string) => void;
  remove: (id: string) => void;
  setPermission: (p: ReminderState['permission']) => void;
  setLastPolledAt: (t: number) => void;
}

export const useReminderStore = create<ReminderState>((set) => ({
  byId: {},
  notifiedIds: new Set<string>(),
  lastPolledAt: null,
  permission:
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,

  setMany: (list) =>
    set((s) => {
      const byId = { ...s.byId };
      for (const r of list) byId[r.id] = r;
      return { byId };
    }),

  upsert: (r) => set((s) => ({ byId: { ...s.byId, [r.id]: r } })),

  setStatus: (id, status) =>
    set((s) => {
      const prev = s.byId[id];
      if (!prev) return {};
      return { byId: { ...s.byId, [id]: { ...prev, status } } };
    }),

  markNotified: (id) =>
    set((s) => {
      const next = new Set(s.notifiedIds);
      next.add(id);
      return { notifiedIds: next };
    }),

  remove: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.byId;
      return { byId: rest };
    }),

  setPermission: (permission) => set({ permission }),
  setLastPolledAt: (t) => set({ lastPolledAt: t }),
}));

export function pendingReminders(state = useReminderStore.getState()): ReminderData[] {
  return Object.values(state.byId)
    .filter((r) => r.status === 'pending' || r.status === 'fired')
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
}
