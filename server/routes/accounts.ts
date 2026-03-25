import { Router, Request, Response } from 'express';
import { getDb } from '../db/sqlite.js';

const router = Router();

// ── GET /api/accounts/status — Aggregated status of all user-linkable services
router.get('/status', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const db = getDb();

    // Resy
    const resy = db.prepare(
      'SELECT service_email, status, token_expiry, last_used, linked_at FROM user_service_accounts WHERE user_id = ? AND service = ?'
    ).get(userId, 'resy') as any;

    const resyExpired = resy?.token_expiry && new Date(resy.token_expiry) < new Date();

    // Hatch
    const hatch = db.prepare(
      'SELECT service_email, status, service_metadata, last_used, linked_at FROM user_service_accounts WHERE user_id = ? AND service = ?'
    ).get(userId, 'hatch') as any;

    let hatchDevices: any[] = [];
    try {
      if (hatch?.service_metadata) {
        const meta = JSON.parse(hatch.service_metadata);
        hatchDevices = meta.devices || [];
      }
    } catch { /* silent */ }

    // Google Calendar
    const google = db.prepare(
      'SELECT token_expiry, connected_at, updated_at FROM google_calendar_tokens WHERE user_id = ?'
    ).get(userId) as any;

    // Google user info (for email/name)
    const user = db.prepare(
      'SELECT email, display_name, auth_provider FROM users WHERE id = ?'
    ).get(userId) as any;

    const googleLinked = !!google && user?.auth_provider === 'google';

    res.json({
      google: {
        linked: googleLinked,
        email: googleLinked ? user?.email : null,
        displayName: googleLinked ? user?.display_name : null,
        connectedAt: google?.connected_at || null,
      },
      resy: {
        linked: !!resy && resy.status === 'active' && !resyExpired,
        email: resy?.service_email || null,
        status: resyExpired ? 'expired' : (resy?.status || null),
        lastUsed: resy?.last_used || null,
        linkedAt: resy?.linked_at || null,
      },
      hatch: {
        linked: !!hatch && hatch.status === 'active',
        email: hatch?.service_email || null,
        devices: hatchDevices,
        lastUsed: hatch?.last_used || null,
        linkedAt: hatch?.linked_at || null,
      },
    });
  } catch (err: any) {
    console.error('Accounts status error:', err.message);
    res.status(500).json({ error: 'Failed to get account status' });
  }
});

// ── POST /api/accounts/disconnect — Unlink a specific service
router.post('/disconnect', (req: Request, res: Response) => {
  const { service } = req.body as { service: string };

  if (!service) {
    res.status(400).json({ error: 'service is required' });
    return;
  }

  try {
    const userId = (req as any).userId as string;
    const db = getDb();

    if (service === 'google') {
      // Delete Google tokens
      db.prepare('DELETE FROM google_calendar_tokens WHERE user_id = ?').run(userId);
      res.json({ success: true, service: 'google' });
      return;
    }

    if (service === 'resy' || service === 'hatch') {
      const result = db.prepare(
        'DELETE FROM user_service_accounts WHERE user_id = ? AND service = ?'
      ).run(userId, service);

      res.json({ success: result.changes > 0, service });
      return;
    }

    res.status(400).json({ error: `Unknown service: ${service}` });
  } catch (err: any) {
    console.error('Disconnect account error:', err.message);
    res.status(500).json({ error: 'Failed to disconnect account' });
  }
});

export default router;
