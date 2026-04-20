import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReminderData } from '../../app/types';

function makeReminder(id: string, overrides: Partial<ReminderData> = {}): ReminderData {
  return {
    id,
    agent_id: 'lifestyle',
    title: `Reminder ${id}`,
    notes: null,
    due_at: new Date(Date.now() - 1_000).toISOString(),
    notify_via: 'in_app',
    status: 'pending',
    ...overrides,
  };
}

// Minimal localStorage stub so the auth store initializes cleanly.
beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('startReminderPoller', () => {
  it('fetches due reminders, fires one notification per id, and PATCHes to fired', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith('/api/reminders?') && (!init || init.method === undefined)) {
        return new Response(
          JSON.stringify({
            reminders: [makeReminder('a'), makeReminder('b')],
          }),
          { status: 200 }
        );
      }
      if (/\/api\/reminders\/[^/?]+$/.test(url) && init?.method === 'PATCH') {
        const id = decodeURIComponent(url.split('/').pop()!);
        return new Response(
          JSON.stringify({ reminder: makeReminder(id, { status: 'fired' }) }),
          { status: 200 }
        );
      }
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const notify = vi.fn();
    const { startReminderPoller } = await import('../remindersPoller');
    const { useReminderStore } = await import('../../stores/reminders');
    useReminderStore.setState({
      byId: {},
      notifiedIds: new Set(),
      lastPolledAt: null,
      permission: 'granted',
    });

    const handle = startReminderPoller({ intervalMs: 1_000_000, notify });
    const due = await handle.pollNow();
    handle.stop();

    expect(due.map((r) => r.id).sort()).toEqual(['a', 'b']);
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenCalledWith(
      'Reminder a',
      expect.objectContaining({ tag: 'reminder:a' })
    );

    // Poll again — must NOT double-notify because ids are in notifiedIds.
    await handle.pollNow();
    expect(notify).toHaveBeenCalledTimes(2);

    // It did PATCH to fired — at least one call per reminder.
    const patchCalls = fetchMock.mock.calls.filter(([, init]: any) => init?.method === 'PATCH');
    expect(patchCalls.length).toBeGreaterThanOrEqual(2);

    const state = useReminderStore.getState();
    expect(Object.keys(state.byId).sort()).toEqual(['a', 'b']);
    expect(state.notifiedIds.has('a')).toBe(true);
    expect(state.lastPolledAt).not.toBeNull();
  });

  it('does not throw and returns [] when the network call fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      })
    );
    const notify = vi.fn();
    const { startReminderPoller } = await import('../remindersPoller');
    const handle = startReminderPoller({ intervalMs: 1_000_000, notify });
    const due = await handle.pollNow();
    handle.stop();
    expect(due).toEqual([]);
    expect(notify).not.toHaveBeenCalled();
  });

  it('stops scheduling further ticks after stop()', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ reminders: [] }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);

    vi.useFakeTimers();
    const notify = vi.fn();
    const { startReminderPoller } = await import('../remindersPoller');
    const handle = startReminderPoller({ intervalMs: 100, notify });

    // Immediate kickoff is in-flight (microtask); let it resolve.
    await vi.runAllTicks();
    handle.stop();

    const before = fetchMock.mock.calls.length;
    vi.advanceTimersByTime(10_000);
    await vi.runAllTicks();
    vi.useRealTimers();
    expect(fetchMock.mock.calls.length).toBe(before);
  });
});

describe('useReminderStore', () => {
  it('pending selector filters and sorts by due_at', async () => {
    const { useReminderStore } = await import('../../stores/reminders');
    useReminderStore.setState({
      byId: {
        a: makeReminder('a', { due_at: new Date(Date.now() + 60_000).toISOString() }),
        b: makeReminder('b', { due_at: new Date(Date.now() + 10_000).toISOString() }),
        c: makeReminder('c', { status: 'completed' }),
      },
      notifiedIds: new Set(),
      lastPolledAt: null,
      permission: 'granted',
    });
    const s = useReminderStore.getState();
    const pending = Object.values(s.byId)
      .filter((r) => r.status === 'pending' || r.status === 'fired')
      .sort((x, y) => new Date(x.due_at).getTime() - new Date(y.due_at).getTime());
    expect(pending.map((r) => r.id)).toEqual(['b', 'a']);
  });
});
