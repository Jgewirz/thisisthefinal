import { Router, Request, Response } from 'express';
import {
  createReminder,
  deleteReminder,
  getDueReminders,
  listReminders,
  updateReminderStatus,
  type ReminderStatus,
} from '../services/reminders.js';
import { idempotency } from '../middleware/idempotency.js';

const router = Router();

const VALID_STATUSES: ReminderStatus[] = ['pending', 'fired', 'completed', 'dismissed'];

// GET /api/reminders?status=pending&due=1
// - status: single or comma-separated list. Defaults to all.
// - due=1: restrict to pending+past-due only. Used by the client poller.
router.get('/', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  try {
    if (req.query.due === '1' || req.query.due === 'true') {
      const reminders = await getDueReminders(userId);
      res.json({ reminders });
      return;
    }
    const raw = (req.query.status as string) || '';
    const statuses = raw
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is ReminderStatus => VALID_STATUSES.includes(s as ReminderStatus));
    const reminders = await listReminders(userId, {
      status: statuses.length ? statuses : undefined,
    });
    res.json({ reminders });
  } catch (err: any) {
    console.error('List reminders error:', err.message);
    res.status(500).json({ error: 'Failed to list reminders' });
  }
});

// POST /api/reminders — manual create (client-driven, idempotent)
router.post('/', idempotency(), async (req: Request, res: Response) => {
  const { title, dueAt, notes, notifyVia, agentId } = req.body as {
    title: string;
    dueAt: string;
    notes?: string;
    notifyVia?: 'in_app' | 'email' | 'push';
    agentId?: string;
  };
  if (!title || !dueAt) {
    res.status(400).json({ error: 'title and dueAt are required' });
    return;
  }
  try {
    const reminder = await createReminder({
      userId: req.user!.id,
      title,
      dueAt,
      notes,
      notifyVia,
      agentId,
    });
    res.status(201).json({ reminder });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/reminders/:id — update status (acknowledge, complete, dismiss)
router.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body as { status?: ReminderStatus };
  if (!status || !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join('|')}` });
    return;
  }
  try {
    const updated = await updateReminderStatus(id, req.user!.id, status);
    if (!updated) {
      res.status(404).json({ error: 'reminder not found' });
      return;
    }
    res.json({ reminder: updated });
  } catch (err: any) {
    console.error('Update reminder error:', err.message);
    res.status(500).json({ error: 'Failed to update reminder' });
  }
});

// DELETE /api/reminders/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const ok = await deleteReminder(req.params.id, req.user!.id);
    if (!ok) {
      res.status(404).json({ error: 'reminder not found' });
      return;
    }
    res.json({ deleted: true });
  } catch (err: any) {
    console.error('Delete reminder error:', err.message);
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
});

export default router;
