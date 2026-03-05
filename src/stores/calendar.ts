import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getUserId } from '../lib/session';

// ── API helpers ───────────────────────────────────────────────────────

function apiHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-User-Id': getUserId(),
  };
}

// ── Types ─────────────────────────────────────────────────────────────

export interface CalendarTask {
  id: string;
  title: string;
  description: string;
  dueDate: string;      // YYYY-MM-DD
  dueTime: string | null;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;          // YYYY-MM-DD
  time?: string;         // HH:mm
  endTime?: string;
  source: 'task' | 'travel' | 'fitness' | 'google';
  color: string;
  completed?: boolean;
  data?: any;
}

export type ViewMode = 'month' | 'week';

interface CalendarStore {
  tasks: CalendarTask[];
  events: CalendarEvent[];
  googleStatus: { configured: boolean; connected: boolean };
  selectedDate: string;        // YYYY-MM-DD
  viewMode: ViewMode;
  isLoading: boolean;

  // Task actions
  addTask: (task: Omit<CalendarTask, 'id' | 'createdAt'>) => Promise<void>;
  updateTask: (id: string, updates: Partial<CalendarTask>) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;

  // View actions
  setSelectedDate: (date: string) => void;
  setViewMode: (mode: ViewMode) => void;

  // Data loading
  fetchEvents: (from: string, to: string) => Promise<void>;
  fetchGoogleStatus: () => Promise<void>;
  hydrateFromDb: () => Promise<void>;
}

const today = new Date().toISOString().slice(0, 10);

export const useCalendarStore = create<CalendarStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      events: [],
      googleStatus: { configured: false, connected: false },
      selectedDate: today,
      viewMode: 'month' as ViewMode,
      isLoading: false,

      // ── Task CRUD ─────────────────────────────────────────────────

      addTask: async (task) => {
        // Optimistic add
        const tempId = crypto.randomUUID();
        const newTask: CalendarTask = {
          ...task,
          id: tempId,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ tasks: [...s.tasks, newTask] }));

        try {
          const res = await fetch('/api/calendar/tasks', {
            method: 'POST',
            headers: apiHeaders(),
            body: JSON.stringify({
              title: task.title,
              description: task.description,
              dueDate: task.dueDate,
              dueTime: task.dueTime,
              priority: task.priority,
            }),
          });

          if (res.ok) {
            const saved = await res.json();
            // Replace temp ID with server ID
            set((s) => ({
              tasks: s.tasks.map((t) => (t.id === tempId ? { ...t, id: saved.id } : t)),
            }));
          }
        } catch {
          // Keep optimistic data
        }

        // Refresh events to include the new task
        const { selectedDate } = get();
        const d = new Date(selectedDate);
        const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
        const to = new Date(d.getFullYear(), d.getMonth() + 1, 6).toISOString().slice(0, 10);
        get().fetchEvents(from, to);
      },

      updateTask: async (id, updates) => {
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        }));

        try {
          await fetch(`/api/calendar/tasks/${id}`, {
            method: 'PUT',
            headers: apiHeaders(),
            body: JSON.stringify(updates),
          });
        } catch {
          // Keep optimistic data
        }
      },

      removeTask: async (id) => {
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));

        try {
          await fetch(`/api/calendar/tasks/${id}`, {
            method: 'DELETE',
            headers: apiHeaders(),
          });
        } catch {
          // Already removed locally
        }

        // Refresh events
        const { selectedDate } = get();
        const d = new Date(selectedDate);
        const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
        const to = new Date(d.getFullYear(), d.getMonth() + 1, 6).toISOString().slice(0, 10);
        get().fetchEvents(from, to);
      },

      toggleTask: async (id) => {
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
          events: s.events.map((e) =>
            e.data?.taskId === id ? { ...e, completed: !e.completed } : e
          ),
        }));

        try {
          await fetch(`/api/calendar/tasks/${id}/toggle`, {
            method: 'PATCH',
            headers: apiHeaders(),
          });
        } catch {
          // Keep optimistic toggle
        }
      },

      // ── View ──────────────────────────────────────────────────────

      setSelectedDate: (date) => set({ selectedDate: date }),
      setViewMode: (mode) => set({ viewMode: mode }),

      // ── Data loading ──────────────────────────────────────────────

      fetchEvents: async (from, to) => {
        set({ isLoading: true });
        try {
          const res = await fetch(`/api/calendar/events?from=${from}&to=${to}`, {
            headers: apiHeaders(),
          });
          if (res.ok) {
            const { events } = await res.json();
            set({ events });
          }
        } catch {
          // Keep cached data
        } finally {
          set({ isLoading: false });
        }
      },

      fetchGoogleStatus: async () => {
        try {
          const res = await fetch('/api/calendar/google/status', {
            headers: apiHeaders(),
          });
          if (res.ok) {
            const data = await res.json();
            set({ googleStatus: { configured: data.configured, connected: data.connected } });
          }
        } catch {
          // Keep current status
        }
      },

      hydrateFromDb: async () => {
        const { selectedDate, fetchEvents, fetchGoogleStatus } = get();
        const d = new Date(selectedDate);
        const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
        const to = new Date(d.getFullYear(), d.getMonth() + 1, 6).toISOString().slice(0, 10);

        await Promise.all([
          fetchEvents(from, to),
          fetchGoogleStatus(),
        ]);

        // Also hydrate tasks list
        try {
          const res = await fetch('/api/calendar/tasks', { headers: apiHeaders() });
          if (res.ok) {
            const { tasks } = await res.json();
            set({ tasks });
          }
        } catch {
          // Keep cached
        }
      },
    }),
    {
      name: 'girlbot-calendar',
      partialState: (state: any) => ({
        tasks: state.tasks,
        events: state.events,
        selectedDate: state.selectedDate,
        viewMode: state.viewMode,
        googleStatus: state.googleStatus,
      }),
      merge: (persisted: any, current: any) => ({
        ...current,
        tasks: persisted?.tasks || [],
        events: persisted?.events || [],
        selectedDate: persisted?.selectedDate || today,
        viewMode: persisted?.viewMode || 'month',
        googleStatus: persisted?.googleStatus || { configured: false, connected: false },
      }),
    } as any
  )
);

// Hydrate from DB on initial load
if (typeof window !== 'undefined') {
  setTimeout(() => {
    useCalendarStore.getState().hydrateFromDb();
  }, 1000);
}
