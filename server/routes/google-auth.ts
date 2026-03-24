import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { google } from 'googleapis';
import { getDb } from '../db/sqlite.js';
import {
  readSessionUserId,
  setSessionCookie,
  SESSION_COOKIE_NAME,
} from '../services/auth.js';
import { storeGoogleTokens } from '../services/google-tokens.js';

const router = Router();

// All scopes granted at login — no separate "Connect" flows needed
const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.send',
];

// In-memory CSRF state store (short-lived, cleared on use)
const pendingStates = new Map<string, { expiresAt: number; anonymousUserId: string | null }>();

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.GOOGLE_AUTH_REDIRECT_URI?.trim() ||
    `http://localhost:5173/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth not configured: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET required');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// ── GET /api/auth/google — Redirect to Google consent screen ──
router.get('/google', (req: Request, res: Response) => {
  try {
    const oauth2Client = getOAuth2Client();

    // Generate CSRF state token
    const state = crypto.randomBytes(32).toString('hex');

    // Capture current anonymous user ID so we can link accounts
    const anonymousUserId = readSessionUserId(req);

    pendingStates.set(state, {
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 min expiry
      anonymousUserId,
    });

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state,
      prompt: 'consent', // Always show consent to ensure we get refresh_token
    });

    res.redirect(authUrl);
  } catch (err: any) {
    console.error('[google-auth] Failed to start OAuth flow:', err.message);
    res.status(500).json({ error: 'Google login is not configured on this server.' });
  }
});

// ── GET /api/auth/google/callback — Handle OAuth callback ──
router.get('/google/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  if (error) {
    console.warn('[google-auth] User denied access:', error);
    res.redirect('/?login=cancelled');
    return;
  }

  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    res.status(400).json({ error: 'Missing code or state parameter' });
    return;
  }

  // Validate CSRF state
  const pending = pendingStates.get(state);
  pendingStates.delete(state);

  if (!pending || pending.expiresAt < Date.now()) {
    res.status(400).json({ error: 'Invalid or expired state. Please try logging in again.' });
    return;
  }

  try {
    const oauth2Client = getOAuth2Client();

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Fetch user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    if (!userInfo.id || !userInfo.email) {
      throw new Error('Google did not return user ID or email');
    }

    const db = getDb();
    const now = new Date().toISOString();

    // Check if this Google account is already linked to a user
    const existingGoogleUser = db
      .prepare('SELECT id FROM users WHERE google_id = ?')
      .get(userInfo.id) as { id: string } | undefined;

    let userId: string;

    if (existingGoogleUser) {
      // Returning Google user — update last login
      userId = existingGoogleUser.id;
      db.prepare(
        `UPDATE users SET display_name = ?, avatar_url = ?, email = ?, last_login_at = ? WHERE id = ?`
      ).run(userInfo.name || null, userInfo.picture || null, userInfo.email, now, userId);
    } else if (pending.anonymousUserId) {
      // Anonymous user signing in with Google — link accounts (keeps all existing data)
      userId = pending.anonymousUserId;
      db.prepare(
        `UPDATE users SET google_id = ?, email = ?, display_name = ?, avatar_url = ?, auth_provider = 'google', last_login_at = ? WHERE id = ?`
      ).run(userInfo.id, userInfo.email, userInfo.name || null, userInfo.picture || null, now, userId);
    } else {
      // Brand new Google user — create account
      userId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO users (id, google_id, email, display_name, avatar_url, auth_provider, last_login_at) VALUES (?, ?, ?, ?, ?, 'google', ?)`
      ).run(userId, userInfo.id, userInfo.email, userInfo.name || null, userInfo.picture || null, now);
    }

    // Store encrypted Google tokens for Calendar + Gmail access
    if (tokens.access_token) {
      storeGoogleTokens(userId, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        expiryDate: tokens.expiry_date || Date.now() + 3600_000,
      });
    }

    // Set session cookie
    setSessionCookie(res, userId);

    // Redirect to app — callback now comes through Vite proxy so we're
    // already on the correct origin; relative redirect works for both dev and prod
    res.redirect('/?login=success');
  } catch (err: any) {
    console.error('[google-auth] OAuth callback error:', err.message);
    res.redirect('/?login=error');
  }
});

// ── POST /api/auth/logout — Clear session ──
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

// ── GET /api/auth/me — Return current user profile ──
router.get('/me', (req: Request, res: Response) => {
  const userId = readSessionUserId(req);
  if (!userId) {
    res.json({ user: null });
    return;
  }

  const db = getDb();
  const user = db
    .prepare('SELECT id, email, display_name, avatar_url, auth_provider FROM users WHERE id = ?')
    .get(userId) as any;

  if (!user) {
    res.json({ user: null });
    return;
  }

  // Check if Google tokens exist (means calendar + gmail are ready)
  const hasTokens = db
    .prepare('SELECT 1 FROM google_calendar_tokens WHERE user_id = ?')
    .get(userId);

  res.json({
    user: {
      id: user.id,
      email: user.email || null,
      displayName: user.display_name || null,
      avatarUrl: user.avatar_url || null,
      provider: user.auth_provider || 'anonymous',
      googleConnected: !!hasTokens,
    },
  });
});

// Cleanup expired states periodically (every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pendingStates) {
    if (val.expiresAt < now) pendingStates.delete(key);
  }
}, 5 * 60 * 1000);

export default router;
