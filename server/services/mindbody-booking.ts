// ── Mindbody Staff API Booking Service ─────────────────────────────────
// Uses the Staff (not Public) API to book classes on behalf of users.
// Requires MINDBODY_API_KEY, MINDBODY_SOURCE_NAME, and staff credentials.

import crypto from 'crypto';
import { getDb } from '../db/sqlite.js';

const MINDBODY_STAFF_BASE = 'https://api.mindbodyonline.com/public/v6';

interface MindbodyConfig {
  apiKey: string;
  sourceName: string;
  staffUsername: string;
  staffPassword: string;
}

function getConfig(): MindbodyConfig | null {
  const apiKey = process.env.MINDBODY_API_KEY;
  const sourceName = process.env.MINDBODY_SOURCE_NAME;
  const staffUsername = process.env.MINDBODY_STAFF_USERNAME;
  const staffPassword = process.env.MINDBODY_STAFF_PASSWORD;

  if (!apiKey || !sourceName || !staffUsername || !staffPassword) return null;
  return { apiKey, sourceName, staffUsername, staffPassword };
}

export function isMindbodyBookingConfigured(): boolean {
  return getConfig() !== null;
}

// ── Staff token cache (per site) ──────────────────────────────────────

const staffTokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getStaffToken(siteId: string): Promise<string | null> {
  const config = getConfig();
  if (!config) return null;

  const cached = staffTokenCache.get(siteId);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  try {
    const res = await fetch(`${MINDBODY_STAFF_BASE}/usertoken/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': config.apiKey,
        'SiteId': siteId,
      },
      body: JSON.stringify({
        Username: config.staffUsername,
        Password: config.staffPassword,
      }),
    });

    if (!res.ok) {
      console.warn(`[mindbody-booking] Staff token failed for site ${siteId}: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const token = data.AccessToken;
    if (!token) return null;

    // Cache for 23 hours (tokens last 24h)
    staffTokenCache.set(siteId, { token, expiresAt: Date.now() + 23 * 60 * 60 * 1000 });
    return token;
  } catch (err: any) {
    console.error(`[mindbody-booking] Token error:`, err.message);
    return null;
  }
}

// ── Client management ─────────────────────────────────────────────────

function getStoredClientId(userId: string, siteId: string): string | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT client_id FROM mindbody_clients WHERE user_id = ? AND site_id = ?'
  ).get(userId, siteId) as { client_id: string } | undefined;
  return row?.client_id ?? null;
}

function storeClientId(userId: string, siteId: string, clientId: string): void {
  const db = getDb();
  db.prepare(
    'INSERT OR REPLACE INTO mindbody_clients (id, user_id, site_id, client_id) VALUES (?, ?, ?, ?)'
  ).run(crypto.randomUUID(), userId, siteId, clientId);
}

async function ensureClientId(userId: string, siteId: string, staffToken: string): Promise<string | null> {
  // Check DB first
  const stored = getStoredClientId(userId, siteId);
  if (stored) return stored;

  const config = getConfig();
  if (!config) return null;

  // Try to get or create a client via the Mindbody API
  // For sandbox, use the default client. For production, you'd create a real client.
  try {
    const res = await fetch(`${MINDBODY_STAFF_BASE}/client/clients?request.SearchText=${userId}&request.Limit=1`, {
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': config.apiKey,
        'SiteId': siteId,
        'Authorization': staffToken,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.Clients?.length > 0) {
        const clientId = data.Clients[0].Id;
        storeClientId(userId, siteId, clientId);
        return clientId;
      }
    }

    // Create a new client (sandbox-safe)
    const createRes = await fetch(`${MINDBODY_STAFF_BASE}/client/addclient`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': config.apiKey,
        'SiteId': siteId,
        'Authorization': staffToken,
      },
      body: JSON.stringify({
        FirstName: 'GirlBot',
        LastName: `User_${userId.slice(0, 8)}`,
        Email: `user_${userId.slice(0, 8)}@girlbot.app`,
      }),
    });

    if (createRes.ok) {
      const createData = await createRes.json();
      const clientId = createData.Client?.Id;
      if (clientId) {
        storeClientId(userId, siteId, clientId);
        return clientId;
      }
    }

    return null;
  } catch (err: any) {
    console.error(`[mindbody-booking] Client error:`, err.message);
    return null;
  }
}

// ── Booking ───────────────────────────────────────────────────────────

export interface BookingResult {
  success: boolean;
  externalBookingId?: string;
  error?: string;
}

export async function bookMindbodyClass(
  userId: string,
  siteId: string,
  classId: string
): Promise<BookingResult> {
  const config = getConfig();
  if (!config) return { success: false, error: 'Mindbody not configured' };

  const staffToken = await getStaffToken(siteId);
  if (!staffToken) return { success: false, error: 'Could not authenticate with studio' };

  const clientId = await ensureClientId(userId, siteId, staffToken);
  if (!clientId) return { success: false, error: 'Could not create client account' };

  try {
    const res = await fetch(`${MINDBODY_STAFF_BASE}/class/addclienttoclass`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': config.apiKey,
        'SiteId': siteId,
        'Authorization': staffToken,
      },
      body: JSON.stringify({
        ClientId: clientId,
        ClassId: parseInt(classId, 10),
        RequirePayment: false,
        Waitlist: false,
        SendEmail: false,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData.Error?.Message || `API returned ${res.status}`;
      console.warn(`[mindbody-booking] Book failed:`, msg);
      return { success: false, error: msg };
    }

    const data = await res.json();
    const visit = data.Visit;
    return {
      success: true,
      externalBookingId: visit?.Id?.toString() || undefined,
    };
  } catch (err: any) {
    console.error(`[mindbody-booking] Booking error:`, err.message);
    return { success: false, error: 'Network error during booking' };
  }
}

export async function cancelMindbodyBooking(
  siteId: string,
  visitId: string
): Promise<{ success: boolean; error?: string }> {
  const config = getConfig();
  if (!config) return { success: false, error: 'Mindbody not configured' };

  const staffToken = await getStaffToken(siteId);
  if (!staffToken) return { success: false, error: 'Could not authenticate with studio' };

  try {
    const res = await fetch(`${MINDBODY_STAFF_BASE}/class/removeclientfromclass`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': config.apiKey,
        'SiteId': siteId,
        'Authorization': staffToken,
      },
      body: JSON.stringify({
        ClassId: parseInt(visitId, 10),
        SendEmail: false,
      }),
    });

    return { success: res.ok };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
