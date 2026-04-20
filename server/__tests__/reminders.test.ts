import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory mock of pg.Pool.query supporting the subset of SQL our service uses.
type Row = Record<string, any>;
const store: Row[] = [];
const queryMock = vi.fn(async (sql: string, params: any[] = []) => {
  const s = sql.trim();

  if (s.startsWith('INSERT INTO reminders')) {
    const [id, user_id, agent_id, title, notes, due_at, notify_via] = params;
    const row: Row = {
      id,
      user_id,
      agent_id,
      title,
      notes,
      due_at: new Date(due_at),
      notify_via,
      status: 'pending',
      created_at: new Date(),
      fired_at: null,
    };
    store.push(row);
    return { rows: [row], rowCount: 1 };
  }

  if (s.startsWith('SELECT * FROM reminders') && s.includes("status = 'pending'") && s.includes('due_at <=')) {
    const [userId, nowIso] = params;
    const now = new Date(nowIso);
    const rows = store.filter(
      (r) => r.user_id === userId && r.status === 'pending' && r.due_at <= now
    );
    return { rows, rowCount: rows.length };
  }

  if (s.startsWith('SELECT * FROM reminders') && s.includes('status = ANY')) {
    const [userId, statuses, limit] = params;
    const rows = store
      .filter((r) => r.user_id === userId && statuses.includes(r.status))
      .slice(0, limit);
    return { rows, rowCount: rows.length };
  }

  if (s.startsWith('SELECT * FROM reminders')) {
    const [userId, limit] = params;
    const rows = store.filter((r) => r.user_id === userId).slice(0, limit);
    return { rows, rowCount: rows.length };
  }

  if (s.startsWith('UPDATE reminders')) {
    const [id, userId, status] = params;
    const row = store.find((r) => r.id === id && r.user_id === userId);
    if (!row) return { rows: [], rowCount: 0 };
    row.status = status;
    if (status === 'fired') row.fired_at = new Date();
    return { rows: [row], rowCount: 1 };
  }

  if (s.startsWith('DELETE FROM reminders')) {
    const [id, userId] = params;
    const idx = store.findIndex((r) => r.id === id && r.user_id === userId);
    if (idx === -1) return { rows: [], rowCount: 0 };
    store.splice(idx, 1);
    return { rows: [], rowCount: 1 };
  }

  return { rows: [], rowCount: 0 };
});

vi.mock('pg', () => {
  class Pool {
    on() {}
    query = queryMock;
    async connect() {
      return { query: queryMock, release: () => {} };
    }
  }
  return { default: { Pool } };
});

beforeEach(() => {
  store.length = 0;
  queryMock.mockClear();
});

afterEach(() => vi.restoreAllMocks());

const futureIso = (ms = 60_000) => new Date(Date.now() + ms).toISOString();

describe('reminders service', () => {
  it('createReminder persists a reminder with sane defaults', async () => {
    const { createReminder } = await import('../services/reminders.js');
    const r = await createReminder({
      userId: 'u1',
      title: '  Drink water  ',
      dueAt: futureIso(),
    });
    expect(r.id).toMatch(/[0-9a-f-]{36}/);
    expect(r.user_id).toBe('u1');
    expect(r.title).toBe('Drink water');
    expect(r.agent_id).toBe('lifestyle');
    expect(r.notify_via).toBe('in_app');
    expect(r.status).toBe('pending');
  });

  it('rejects past-dated reminders', async () => {
    const { createReminder } = await import('../services/reminders.js');
    await expect(
      createReminder({ userId: 'u1', title: 'x', dueAt: new Date(Date.now() - 10 * 60_000).toISOString() })
    ).rejects.toThrow(/future/);
  });

  it('rejects empty title', async () => {
    const { createReminder } = await import('../services/reminders.js');
    await expect(
      createReminder({ userId: 'u1', title: '   ', dueAt: futureIso() })
    ).rejects.toThrow(/title is required/);
  });

  it('requires a userId', async () => {
    const { createReminder } = await import('../services/reminders.js');
    await expect(
      createReminder({ userId: '', title: 'x', dueAt: futureIso() })
    ).rejects.toThrow(/userId/);
  });

  it('getDueReminders only returns pending + past-due for the user', async () => {
    const { createReminder, getDueReminders, updateReminderStatus } = await import(
      '../services/reminders.js'
    );
    const past = await createReminder({
      userId: 'u1',
      title: 'past',
      dueAt: futureIso(500),
    });
    await createReminder({ userId: 'u1', title: 'future', dueAt: futureIso(10 * 60_000) });
    await createReminder({ userId: 'u2', title: 'other-user', dueAt: futureIso(500) });

    // Advance time past the first + third reminders.
    const now = new Date(Date.now() + 2_000);
    const due = await getDueReminders('u1', now);
    expect(due.map((r) => r.title)).toEqual(['past']);

    // After marking fired, it must NOT appear in due anymore.
    await updateReminderStatus(past.id, 'u1', 'fired');
    const due2 = await getDueReminders('u1', now);
    expect(due2).toEqual([]);
  });

  it('updateReminderStatus only touches the owner\'s reminder', async () => {
    const { createReminder, updateReminderStatus } = await import('../services/reminders.js');
    const r = await createReminder({ userId: 'u1', title: 't', dueAt: futureIso() });
    const miss = await updateReminderStatus(r.id, 'attacker', 'dismissed');
    expect(miss).toBeNull();
    const hit = await updateReminderStatus(r.id, 'u1', 'completed');
    expect(hit?.status).toBe('completed');
  });

  it('listReminders filters by status and sorts by due_at', async () => {
    const { createReminder, listReminders, updateReminderStatus } = await import(
      '../services/reminders.js'
    );
    const a = await createReminder({ userId: 'u1', title: 'a', dueAt: futureIso(60_000) });
    await createReminder({ userId: 'u1', title: 'b', dueAt: futureIso(30_000) });
    await updateReminderStatus(a.id, 'u1', 'completed');

    const pending = await listReminders('u1', { status: 'pending' });
    expect(pending.map((r) => r.title)).toEqual(['b']);

    const all = await listReminders('u1');
    expect(all).toHaveLength(2);
  });

  it('deleteReminder returns false when not owned', async () => {
    const { createReminder, deleteReminder } = await import('../services/reminders.js');
    const r = await createReminder({ userId: 'u1', title: 't', dueAt: futureIso() });
    expect(await deleteReminder(r.id, 'attacker')).toBe(false);
    expect(await deleteReminder(r.id, 'u1')).toBe(true);
  });
});
