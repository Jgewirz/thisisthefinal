import crypto from 'crypto';
import { google } from 'googleapis';
import { getDb } from '../db/sqlite.js';

// ── Config ──────────────────────────────────────────────────────────────

const ENCRYPTION_KEY = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || '';

export function isTokenEncryptionConfigured(): boolean {
  return !!ENCRYPTION_KEY && /^[a-fA-F0-9]{64}$/.test(ENCRYPTION_KEY);
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

// ── Token storage ───────────────────────────────────────────────────────

export function storeGoogleTokens(
  userId: string,
  tokens: { accessToken: string; refreshToken?: string; expiryDate: number }
) {
  if (!isTokenEncryptionConfigured()) {
    console.warn('[google-tokens] GOOGLE_TOKEN_ENCRYPTION_KEY not configured, skipping token storage');
    return;
  }

  const db = getDb();

  // Check if we already have a refresh token stored (we don't want to overwrite it with null)
  const existing = db
    .prepare('SELECT refresh_token_enc FROM google_calendar_tokens WHERE user_id = ?')
    .get(userId) as any;

  const refreshTokenEnc = tokens.refreshToken
    ? encrypt(tokens.refreshToken)
    : existing?.refresh_token_enc || null;

  if (!refreshTokenEnc) {
    console.warn('[google-tokens] No refresh token available for user', userId);
    // Still store what we have — access token will work until it expires
  }

  db.prepare(`
    INSERT INTO google_calendar_tokens (user_id, access_token_enc, refresh_token_enc, token_expiry, connected_at, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      access_token_enc = excluded.access_token_enc,
      refresh_token_enc = COALESCE(excluded.refresh_token_enc, google_calendar_tokens.refresh_token_enc),
      token_expiry = excluded.token_expiry,
      updated_at = datetime('now')
  `).run(
    userId,
    encrypt(tokens.accessToken),
    refreshTokenEnc,
    new Date(tokens.expiryDate).toISOString()
  );
}

// ── Get authenticated OAuth2 client for a user ──────────────────────────

export function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID || '',
    process.env.GOOGLE_CLIENT_SECRET || '',
    process.env.GOOGLE_AUTH_REDIRECT_URI || `http://localhost:${process.env.PORT || 3001}/api/auth/google/callback`
  );
}

export async function getAuthenticatedClient(userId: string) {
  if (!isTokenEncryptionConfigured()) return null;

  const db = getDb();
  const row = db.prepare(
    'SELECT access_token_enc, refresh_token_enc, token_expiry FROM google_calendar_tokens WHERE user_id = ?'
  ).get(userId) as any;

  if (!row) return null;

  const client = makeOAuth2Client();
  const accessToken = decrypt(row.access_token_enc);
  const refreshToken = row.refresh_token_enc ? decrypt(row.refresh_token_enc) : undefined;

  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: new Date(row.token_expiry).getTime(),
  });

  // Auto-refresh if expired
  if (new Date(row.token_expiry).getTime() < Date.now() && refreshToken) {
    try {
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
        client.setCredentials(credentials);
      }
    } catch (err: any) {
      console.error('[google-tokens] Token refresh failed:', err.message);
      return null;
    }
  }

  return client;
}

// ── Check connection status ─────────────────────────────────────────────

export function hasGoogleTokens(userId: string): boolean {
  const db = getDb();
  const row = db.prepare(
    'SELECT 1 FROM google_calendar_tokens WHERE user_id = ?'
  ).get(userId);
  return !!row;
}

// ── Disconnect / revoke ─────────────────────────────────────────────────

export async function revokeGoogleTokens(userId: string): Promise<void> {
  const db = getDb();
  const row = db.prepare(
    'SELECT access_token_enc FROM google_calendar_tokens WHERE user_id = ?'
  ).get(userId) as any;

  if (row) {
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
