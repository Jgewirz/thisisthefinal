import type { ReminderData } from '../app/types';
import { listReminders, updateReminderStatus } from './remindersApi';
import { useReminderStore } from '../stores/reminders';

export interface PollerHandle {
  stop: () => void;
  /** Force an immediate poll — returns the due list it observed. */
  pollNow: () => Promise<ReminderData[]>;
}

export interface PollerOptions {
  /** Poll interval in ms. Defaults to 30s — balances latency vs. request volume. */
  intervalMs?: number;
  /** Notification factory; injectable for tests. Defaults to `window.Notification`. */
  notify?: (title: string, options?: NotificationOptions) => void;
  /** Clock source; injectable for tests. */
  now?: () => number;
}

const DEFAULT_INTERVAL = 30_000;

/**
 * Fire a browser notification for a reminder if permission is granted.
 * No-ops in SSR / unsupported environments.
 */
function defaultNotify(title: string, options?: NotificationOptions) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    // eslint-disable-next-line no-new -- Notification self-registers a system toast.
    new Notification(title, options);
  } catch {
    // Some browsers throw if constructed outside a user gesture; fail silently.
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  const store = useReminderStore.getState();
  if (typeof Notification === 'undefined') {
    store.setPermission('unsupported');
    return 'unsupported';
  }
  try {
    const p = await Notification.requestPermission();
    store.setPermission(p);
    return p;
  } catch {
    store.setPermission('denied');
    return 'denied';
  }
}

/**
 * Start a polling loop that fetches due reminders, fires a browser notification
 * for ones it hasn't notified yet, and marks them `fired` on the server.
 *
 * Safe to call multiple times — each returns its own handle.
 */
export function startReminderPoller(opts: PollerOptions = {}): PollerHandle {
  const interval = opts.intervalMs ?? DEFAULT_INTERVAL;
  const notify = opts.notify ?? defaultNotify;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let inFlight: Promise<ReminderData[]> | null = null;

  const runTick = async (): Promise<ReminderData[]> => {
    let due: ReminderData[] = [];
    try {
      due = await listReminders({ due: true });
    } catch {
      return [];
    }
    const store = useReminderStore.getState();
    store.setMany(due);
    store.setLastPolledAt((opts.now ?? Date.now)());

    // Re-read the most current notifiedIds inside the loop so subsequent
    // reminders in the same tick see the update from the previous iteration.
    for (const r of due) {
      if (useReminderStore.getState().notifiedIds.has(r.id)) continue;
      useReminderStore.getState().markNotified(r.id);
      notify(r.title, {
        body: r.notes || `Due ${new Date(r.due_at).toLocaleString()}`,
        tag: `reminder:${r.id}`,
        icon: '/favicon.ico',
      });
      // Fire-and-forget server-side status update. Client-side notifiedIds
      // is the source of truth for "don't double-notify", so a failure here
      // is safe.
      updateReminderStatus(r.id, 'fired')
        .then((updated) => {
          if (updated) useReminderStore.getState().upsert(updated);
        })
        .catch(() => {});
    }
    return due;
  };

  // Guard against concurrent ticks (auto-kickoff racing with an external
  // pollNow() call, or a slow poll overlapping the next interval).
  const tick = (): Promise<ReminderData[]> => {
    if (inFlight) return inFlight;
    inFlight = runTick().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  const schedule = () => {
    if (stopped) return;
    timer = setTimeout(async () => {
      await tick();
      schedule();
    }, interval);
  };

  // Kick off immediately so users see pending reminders on page load.
  void tick().finally(schedule);

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
    pollNow: tick,
  };
}
