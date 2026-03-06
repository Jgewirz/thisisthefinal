import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getDb } from '../db/sqlite.js';
import { readSessionUserId, setSessionCookie } from '../services/auth.js';

const router = Router();

function ensureUser(userId: string) {
  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)').run(userId);
}

router.post('/session', (req: Request, res: Response) => {
  const existingUserId = readSessionUserId(req);
  if (existingUserId) {
    ensureUser(existingUserId);
    res.json({ authenticated: true });
    return;
  }

  const userId = crypto.randomUUID();

  ensureUser(userId);
  setSessionCookie(res, userId);
  res.json({ authenticated: true });
});

export default router;