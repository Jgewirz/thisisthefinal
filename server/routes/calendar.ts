import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getDb } from '../db/sqlite.js';
import {
  isGoogleCalendarConfigured,
  getConnectionStatus,
  fetchGoogleEvents,
  disconnectGoogle,
} from '../services/google-calendar.js';

const router = Router();

// ── Ensure user row exists ─────────────────────────────────────────────
function ensureUser(userId: string) {
  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)').run(userId);
}

// ═══════════════════════════════════════════════════════════════════════
// TASK CRUD
// ═══════════════════════════════════════════════════════════════════════

// ── GET /api/calendar/tasks — list tasks in date range ────────────────
router.get('/tasks', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { from, to } = req.query as { from?: string; to?: string };

    const db = getDb();
    let rows: any[];

    if (from && to) {
      rows = db.prepare(
        'SELECT * FROM calendar_tasks WHERE user_id = ? AND due_date >= ? AND due_date <= ? ORDER BY due_date ASC, due_time ASC'
      ).all(userId, from, to);
    } else {
      rows = db.prepare(
        'SELECT * FROM calendar_tasks WHERE user_id = ? ORDER BY due_date ASC, due_time ASC'
      ).all(userId);
    }

    const tasks = rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      dueDate: r.due_date,
      dueTime: r.due_time,
      completed: !!r.completed,
      priority: r.priority,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    res.json({ tasks });
  } catch (err: any) {
    console.error('List tasks error:', err.message);
    res.status(500).json({ error: 'Failed to list tasks' });
  }
});

// ── POST /api/calendar/tasks — create task ────────────────────────────
router.post('/tasks', (req: Request, res: Response) => {
  const { title, description, dueDate, dueTime, priority } = req.body;

  if (!title || !dueDate) {
    res.status(400).json({ error: 'title and dueDate are required' });
    return;
  }

  try {
    const userId = (req as any).userId as string;
    ensureUser(userId);

    const id = crypto.randomUUID();
    const db = getDb();
    db.prepare(
      'INSERT INTO calendar_tasks (id, user_id, title, description, due_date, due_time, priority) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, userId, title, description || '', dueDate, dueTime || null, priority || 'medium');

    res.json({
      id,
      title,
      description: description || '',
      dueDate,
      dueTime: dueTime || null,
      completed: false,
      priority: priority || 'medium',
      createdAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Create task error:', err.message);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// ── PUT /api/calendar/tasks/:id — update task ─────────────────────────
router.put('/tasks/:id', (req: Request, res: Response) => {
  const { title, description, dueDate, dueTime, priority, completed } = req.body;

  try {
    const userId = (req as any).userId as string;
    const db = getDb();

    const existing = db.prepare(
      'SELECT id FROM calendar_tasks WHERE id = ? AND user_id = ?'
    ).get(req.params.id, userId);

    if (!existing) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    db.prepare(`
      UPDATE calendar_tasks SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        due_date = COALESCE(?, due_date),
        due_time = COALESCE(?, due_time),
        priority = COALESCE(?, priority),
        completed = COALESCE(?, completed),
        updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).run(
      title ?? null,
      description ?? null,
      dueDate ?? null,
      dueTime ?? null,
      priority ?? null,
      completed != null ? (completed ? 1 : 0) : null,
      req.params.id,
      userId
    );

    res.json({ success: true });
  } catch (err: any) {
    console.error('Update task error:', err.message);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// ── DELETE /api/calendar/tasks/:id — delete task ──────────────────────
router.delete('/tasks/:id', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const db = getDb();
    const result = db.prepare(
      'DELETE FROM calendar_tasks WHERE id = ? AND user_id = ?'
    ).run(req.params.id, userId);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete task error:', err.message);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// ── PATCH /api/calendar/tasks/:id/toggle — toggle completed ──────────
router.patch('/tasks/:id/toggle', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const db = getDb();

    const row = db.prepare(
      'SELECT completed FROM calendar_tasks WHERE id = ? AND user_id = ?'
    ).get(req.params.id, userId) as any;

    if (!row) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const newCompleted = row.completed ? 0 : 1;
    db.prepare(
      "UPDATE calendar_tasks SET completed = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
    ).run(newCompleted, req.params.id, userId);

    res.json({ completed: !!newCompleted });
  } catch (err: any) {
    console.error('Toggle task error:', err.message);
    res.status(500).json({ error: 'Failed to toggle task' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// UNIFIED CALENDAR EVENTS
// ═══════════════════════════════════════════════════════════════════════

interface CalendarEvent {
  id: string;
  title: string;
  date: string;        // YYYY-MM-DD
  time?: string;       // HH:mm
  endTime?: string;    // HH:mm
  source: 'task' | 'travel' | 'fitness' | 'google';
  color: string;
  completed?: boolean;
  data?: any;
}

// ── GET /api/calendar/events — aggregated from all sources ────────────
router.get('/events', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { from, to } = req.query as { from?: string; to?: string };

    if (!from || !to) {
      res.status(400).json({ error: 'from and to query params are required' });
      return;
    }

    const db = getDb();
    const events: CalendarEvent[] = [];

    // 1. Calendar tasks
    const tasks = db.prepare(
      'SELECT * FROM calendar_tasks WHERE user_id = ? AND due_date >= ? AND due_date <= ?'
    ).all(userId, from, to) as any[];

    for (const t of tasks) {
      events.push({
        id: `task-${t.id}`,
        title: t.title,
        date: t.due_date,
        time: t.due_time || undefined,
        source: 'task',
        color: '#C4A8FF',
        completed: !!t.completed,
        data: { taskId: t.id, description: t.description, priority: t.priority },
      });
    }

    // 2. Trip selections (travel bookmarks for active trip)
    const trips = db.prepare(
      'SELECT * FROM trip_selections WHERE user_id = ?'
    ).all(userId) as any[];

    for (const trip of trips) {
      try {
        const data = JSON.parse(trip.data);
        // Flights have departureDate, hotels have checkIn
        const date = data.departureDate || data.checkIn;
        if (date && date >= from && date <= to) {
          events.push({
            id: `travel-${trip.id}`,
            title: trip.label || `${trip.type === 'flight' ? 'Flight' : 'Hotel'} booking`,
            date,
            time: data.departureTime?.slice(0, 5),
            source: 'travel',
            color: '#7EC8E3',
            data,
          });
        }
        // For hotels, also show checkout date
        if (data.checkOut && data.checkOut >= from && data.checkOut <= to && data.checkOut !== date) {
          events.push({
            id: `travel-${trip.id}-checkout`,
            title: `${trip.label || 'Hotel'} — Checkout`,
            date: data.checkOut,
            source: 'travel',
            color: '#7EC8E3',
            data,
          });
        }
      } catch {
        // skip malformed JSON
      }
    }

    // 3. Fitness schedule
    const fitness = db.prepare(
      'SELECT * FROM fitness_schedule WHERE user_id = ?'
    ).all(userId) as any[];

    for (const cls of fitness) {
      try {
        const data = JSON.parse(cls.data);
        const date = data.date || (data.startDateTime ? data.startDateTime.slice(0, 10) : null);
        if (date && date >= from && date <= to) {
          events.push({
            id: `fitness-${cls.id}`,
            title: cls.label || data.className || 'Fitness class',
            date,
            time: data.time || (data.startDateTime ? data.startDateTime.slice(11, 16) : undefined),
            source: 'fitness',
            color: '#A8E6CF',
            data,
          });
        }
      } catch {
        // skip malformed JSON
      }
    }

    // 4. Dining reservations
    const reservations = db.prepare(
      'SELECT * FROM reservations WHERE user_id = ? AND date >= ? AND date <= ? AND status != ?'
    ).all(userId, from, to, 'cancelled') as any[];

    for (const r of reservations) {
      events.push({
        id: `dining-${r.id}`,
        title: `${r.restaurant_name} — ${r.party_size} guests`,
        date: r.date,
        time: r.time,
        source: 'dining' as any,
        color: '#F97316', // orange
        data: {
          reservationId: r.id,
          restaurantName: r.restaurant_name,
          partySize: r.party_size,
          status: r.status,
          phone: r.restaurant_phone,
          address: r.restaurant_address,
        },
      });
    }

    // 5. Google Calendar events (if connected)
    if (isGoogleCalendarConfigured()) {
      try {
        const gcEvents = await fetchGoogleEvents(
          userId,
          new Date(from).toISOString(),
          new Date(to + 'T23:59:59').toISOString()
        );

        for (const ge of gcEvents) {
          events.push({
            id: `google-${ge.id}`,
            title: ge.title,
            date: ge.date,
            time: ge.time,
            endTime: ge.endTime,
            source: 'google',
            color: '#F87171',
          });
        }
      } catch (err: any) {
        console.warn('Google Calendar fetch error (excluded from results):', err.message);
      }
    }

    // Sort by date then time
    events.sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return (a.time || '').localeCompare(b.time || '');
    });

    res.json({ events });
  } catch (err: any) {
    console.error('Calendar events error:', err.message);
    res.status(500).json({ error: 'Failed to load calendar events' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// GOOGLE CALENDAR OAUTH
// ═══════════════════════════════════════════════════════════════════════

// ── GET /api/calendar/google/status — check connection ────────────────
router.get('/google/status', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const configured = isGoogleCalendarConfigured();
    const status = configured ? getConnectionStatus(userId) : { connected: false };
    res.json({ configured, ...status });
  } catch (err: any) {
    console.error('Google status error:', err.message);
    res.status(500).json({ error: 'Failed to check Google status' });
  }
});

// ── DELETE /api/calendar/google/disconnect — remove connection ────────
router.delete('/google/disconnect', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    await disconnectGoogle(userId);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Google disconnect error:', err.message);
    res.status(500).json({ error: 'Failed to disconnect Google Calendar' });
  }
});

export default router;
