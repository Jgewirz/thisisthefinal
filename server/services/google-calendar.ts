import crypto from 'crypto';
import { google } from 'googleapis';
import { getDb } from '../db/sqlite.js';

// ── Config ──────────────────────────────────────────────────────────────

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/calendar/google/callback';
const ENCRYPTION_KEY = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || '';

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

export function isGoogleCalendarConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET && ENCRYPTION_KEY);
}

// ── Encryption helpers ──────────────────────────────────────────────────

function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), encrypted.toString('hex'), tag.toString('hex')].join(':');
}

function decrypt(data: string): string {
  const [ivHex, encHex, tagHex] = data.split(':');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(encHex, 'hex', 'utf8') + decipher.final('utf8');
}

// ── CSRF state helper ───────────────────────────────────────────────────

function signState(userId: string): string {
  const hmac = crypto.createHmac('sha256', CLIENT_SECRET).update(userId).digest('hex').slice(0, 16);
  return `${userId}.${hmac}`;
}

function verifyState(state: string): string | null {
  const dot = state.indexOf('.');
  if (dot < 0) return null;
  const userId = state.slice(0, dot);
  const expected = signState(userId);
  if (state !== expected) return null;
  return userId;
}

// ── OAuth2 client factory ───────────────────────────────────────────────

function makeOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

// ── Public API ──────────────────────────────────────────────────────────

export function getAuthUrl(userId: string): string {
  const client = makeOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: signState(userId),
    prompt: 'consent',
  });
}

export async function handleCallback(code: string, state: string): Promise<string> {
  const userId = verifyState(state);
  if (!userId) throw new Error('Invalid state parameter');

  const client = makeOAuth2Client();
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Missing tokens from Google');
  }

  const db = getDb();
  db.prepare(`
    INSERT INTO google_calendar_tokens (user_id, access_token_enc, refresh_token_enc, token_expiry, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      access_token_enc = excluded.access_token_enc,
      refresh_token_enc = excluded.refresh_token_enc,
      token_expiry = excluded.token_expiry,
      updated_at = datetime('now')
  `).run(
    userId,
    encrypt(tokens.access_token),
    encrypt(tokens.refresh_token),
    new Date(tokens.expiry_date || Date.now() + 3600_000).toISOString()
  );

  return userId;
}

export function getConnectionStatus(userId: string): { connected: boolean; connectedAt?: string } {
  const db = getDb();
  const row = db.prepare(
    'SELECT connected_at FROM google_calendar_tokens WHERE user_id = ?'
  ).get(userId) as any;

  return row
    ? { connected: true, connectedAt: row.connected_at }
    : { connected: false };
}

export async function fetchGoogleEvents(
  userId: string,
  timeMin: string,
  timeMax: string
): Promise<Array<{ id: string; title: string; date: string; time?: string; endTime?: string }>> {
  const db = getDb();
  const row = db.prepare(
    'SELECT access_token_enc, refresh_token_enc, token_expiry, calendar_id FROM google_calendar_tokens WHERE user_id = ?'
  ).get(userId) as any;

  if (!row) return [];

  const client = makeOAuth2Client();
  const accessToken = decrypt(row.access_token_enc);
  const refreshToken = decrypt(row.refresh_token_enc);

  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: new Date(row.token_expiry).getTime(),
  });

  // Auto-refresh if expired
  if (new Date(row.token_expiry).getTime() < Date.now()) {
    const { credentials } = await client.refreshAccessToken();
    if (credentials.access_token) {
      db.prepare(`
        UPDATE google_calendar_tokens
        SET access_token_enc = ?, token_expiry = ?, updated_at = datetime('now')
        WHERE user_id = ?
      `).run(
        encrypt(credentials.access_token),
        new Date(credentials.expiry_date || Date.now() + 3600_000).toISOString(),
        userId
      );
    }
  }

  const calendar = google.calendar({ version: 'v3', auth: client });
  const res = await calendar.events.list({
    calendarId: row.calendar_id || 'primary',
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 100,
  });

  return (res.data.items || []).map((evt) => {
    const start = evt.start?.dateTime || evt.start?.date || '';
    const end = evt.end?.dateTime || evt.end?.date || '';
    const isAllDay = !evt.start?.dateTime;

    return {
      id: evt.id || crypto.randomUUID(),
      title: evt.summary || '(No title)',
      date: isAllDay ? start : start.slice(0, 10),
      time: isAllDay ? undefined : start.slice(11, 16),
      endTime: isAllDay ? undefined : end.slice(11, 16),
    };
  });
}

export async function disconnectGoogle(userId: string): Promise<void> {
  const db = getDb();
  const row = db.prepare(
    'SELECT access_token_enc FROM google_calendar_tokens WHERE user_id = ?'
  ).get(userId) as any;

  if (row) {
    // Try to revoke the token with Google (best-effort)
    try {
      const client = makeOAuth2Client();
      client.setCredentials({ access_token: decrypt(row.access_token_enc) });
      await client.revokeCredentials();
    } catch {
      // Token may already be invalid
    }

    db.prepare('DELETE FROM google_calendar_tokens WHERE user_id = ?').run(userId);
  }
}
