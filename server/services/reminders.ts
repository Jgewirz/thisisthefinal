import { randomUUID } from 'node:crypto';
import { pool } from './db.js';

export type ReminderStatus = 'pending' | 'fired' | 'completed' | 'dismissed';
export type ReminderNotifyVia = 'in_app' | 'email' | 'push';

export interface Reminder {
  id: string;
  user_id: string;
  agent_id: string;
  title: string;
  notes: string | null;
  due_at: string; // ISO 8601
  notify_via: ReminderNotifyVia;
  status: ReminderStatus;
  created_at: string;
  fired_at: string | null;
}

export interface CreateReminderInput {
  userId: string;
  agentId?: string;
  title: string;
  notes?: string;
  dueAt: string | Date;
  notifyVia?: ReminderNotifyVia;
}

const MAX_TITLE = 200;
const MAX_NOTES = 2000;

/**
 * Normalize & validate a future due date. Returns a Date in UTC.
 * Throws a user-readable Error on invalid/past input.
 */
export function parseDueAt(value: string | Date, now: Date = new Date()): Date {
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) {
    throw new Error('dueAt is not a valid ISO 8601 date/time');
  }
  // Allow up to 60s clock skew so "remind me in 1 minute" works.
  if (d.getTime() < now.getTime() - 60_000) {
    throw new Error('dueAt must be in the future');
  }
  return d;
}

function rowToReminder(row: any): Reminder {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    agent_id: String(row.agent_id),
    title: String(row.title),
    notes: row.notes == null ? null : String(row.notes),
    due_at: new Date(row.due_at).toISOString(),
    notify_via: row.notify_via as ReminderNotifyVia,
    status: row.status as ReminderStatus,
    created_at: new Date(row.created_at).toISOString(),
    fired_at: row.fired_at ? new Date(row.fired_at).toISOString() : null,
  };
}

export async function createReminder(input: CreateReminderInput): Promise<Reminder> {
  if (!input.userId) throw new Error('userId is required');
  const title = (input.title ?? '').trim();
  if (!title) throw new Error('title is required');
  if (title.length > MAX_TITLE) throw new Error(`title exceeds ${MAX_TITLE} chars`);
  const notes = input.notes ? input.notes.trim().slice(0, MAX_NOTES) : null;

  const due = parseDueAt(input.dueAt);
  const notifyVia: ReminderNotifyVia = input.notifyVia ?? 'in_app';
  if (!['in_app', 'email', 'push'].includes(notifyVia)) {
    throw new Error(`notifyVia must be in_app|email|push, got ${notifyVia}`);
  }

  const id = randomUUID();
  const agentId = input.agentId ?? 'lifestyle';

  const { rows } = await pool.query(
    `INSERT INTO reminders (id, user_id, agent_id, title, notes, due_at, notify_via)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [id, input.userId, agentId, title, notes, due.toISOString(), notifyVia]
  );
  return rowToReminder(rows[0]);
}

export async function listReminders(
  userId: string,
  opts: { status?: ReminderStatus | ReminderStatus[]; limit?: number } = {}
): Promise<Reminder[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const statuses = Array.isArray(opts.status)
    ? opts.status
    : opts.status
      ? [opts.status]
      : null;

  try {
    if (statuses) {
      const { rows } = await pool.query(
        `SELECT * FROM reminders
         WHERE user_id = $1 AND status = ANY($2::text[])
         ORDER BY due_at ASC
         LIMIT $3`,
        [userId, statuses, limit]
      );
      return rows.map(rowToReminder);
    }
    const { rows } = await pool.query(
      `SELECT * FROM reminders
       WHERE user_id = $1
       ORDER BY due_at ASC
       LIMIT $2`,
      [userId, limit]
    );
    return rows.map(rowToReminder);
  } catch (err: any) {
    // Fail-open: reminders are non-critical. If the DB is temporarily
    // unavailable (timeouts, restarts), return an empty list instead of
    // crashing the caller/poller.
    return [];
  }
}

/**
 * Return pending reminders whose due_at <= now.
 * Does NOT mutate status — caller decides (e.g. poll returns them, then client
 * calls markFired on acknowledgement).
 */
export async function getDueReminders(
  userId: string,
  now: Date = new Date()
): Promise<Reminder[]> {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM reminders
       WHERE user_id = $1
         AND status = 'pending'
         AND due_at <= $2
       ORDER BY due_at ASC
       LIMIT 50`,
      [userId, now.toISOString()]
    );
    return rows.map(rowToReminder);
  } catch (err: any) {
    // Fail-open for poller.
    return [];
  }
}

export async function updateReminderStatus(
  id: string,
  userId: string,
  status: ReminderStatus
): Promise<Reminder | null> {
  if (!['pending', 'fired', 'completed', 'dismissed'].includes(status)) {
    throw new Error(`invalid status: ${status}`);
  }
  const firedAtExpr = status === 'fired' ? 'NOW()' : 'fired_at';
  const { rows } = await pool.query(
    `UPDATE reminders
       SET status = $3, fired_at = ${firedAtExpr}
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [id, userId, status]
  );
  return rows[0] ? rowToReminder(rows[0]) : null;
}

export async function deleteReminder(id: string, userId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM reminders WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return (rowCount ?? 0) > 0;
}
