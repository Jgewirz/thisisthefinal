import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getDb } from '../db/sqlite.js';

const router = Router();

const BOOKING_AGENT_URL = process.env.BOOKING_AGENT_URL || 'http://localhost:8000';

function ensureUser(userId: string) {
  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)').run(userId);
}

// ── Helper: extract domain from a URL ─────────────────────────────────
function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// ── Helper: look up learned navigation path for a domain ──────────────
function getLearnedPath(domain: string): any[] | null {
  try {
    const db = getDb();
    const row = db.prepare(
      `SELECT navigation_steps, success_count, fail_count
       FROM booking_paths
       WHERE domain = ? AND path_type = 'lifestyle' AND success_count > fail_count
       ORDER BY success_count DESC LIMIT 1`
    ).get(domain) as any;

    if (row) {
      console.log(`[lifestyle/book] Found learned path for ${domain} (${row.success_count} successes)`);
      return JSON.parse(row.navigation_steps);
    }
  } catch (err: any) {
    console.warn('[lifestyle/book] Failed to look up learned path:', err.message);
  }
  return null;
}

// ── Helper: save or update a navigation path after a booking attempt ──
function saveLearnedPath(domain: string, venueName: string, steps: any[], succeeded: boolean) {
  try {
    const db = getDb();
    const existing = db.prepare(
      `SELECT id, success_count, fail_count FROM booking_paths WHERE domain = ? AND path_type = 'lifestyle'`
    ).get(domain) as any;

    if (existing) {
      if (succeeded) {
        db.prepare(
          `UPDATE booking_paths
           SET navigation_steps = ?, success_count = success_count + 1, last_used_at = datetime('now'), updated_at = datetime('now')
           WHERE id = ?`
        ).run(JSON.stringify(steps), existing.id);
      } else {
        db.prepare(
          `UPDATE booking_paths SET fail_count = fail_count + 1, last_used_at = datetime('now') WHERE id = ?`
        ).run(existing.id);
      }
      console.log(`[lifestyle/book] Updated path for ${domain} (success=${succeeded})`);
    } else if (steps.length > 0) {
      db.prepare(
        `INSERT INTO booking_paths (id, domain, studio_name, path_type, navigation_steps, success_count, fail_count)
         VALUES (?, ?, ?, 'lifestyle', ?, ?, ?)`
      ).run(
        crypto.randomUUID(),
        domain,
        venueName,
        JSON.stringify(steps),
        succeeded ? 1 : 0,
        succeeded ? 0 : 1,
      );
      console.log(`[lifestyle/book] Saved new path for ${domain} (${steps.length} steps, success=${succeeded})`);
    }
  } catch (err: any) {
    console.warn('[lifestyle/book] Failed to save learned path:', err.message);
  }
}

// ── Helper: get/upsert service account ────────────────────────────────
function getServiceAccount(userId: string, service: string): any {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM user_service_accounts WHERE user_id = ? AND service = ?'
  ).get(userId, service) as any;
}

function upsertServiceAccount(userId: string, service: string, fields: Record<string, any>) {
  const db = getDb();
  const existing = getServiceAccount(userId, service);
  if (existing) {
    const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE user_service_accounts SET ${sets} WHERE user_id = ? AND service = ?`)
      .run(...Object.values(fields), userId, service);
  } else {
    db.prepare(
      `INSERT INTO user_service_accounts (id, user_id, service, ${Object.keys(fields).join(', ')})
       VALUES (?, ?, ?, ${Object.keys(fields).map(() => '?').join(', ')})`
    ).run(crypto.randomUUID(), userId, service, ...Object.values(fields));
  }
}

// ── Helper: get user location from DB ─────────────────────────────────
function getUserLocation(userId: string): { lat: number | null; lng: number | null; city: string | null } {
  const db = getDb();
  const row = db.prepare('SELECT location_lat, location_lng, location_city FROM users WHERE id = ?').get(userId) as any;
  return {
    lat: row?.location_lat || null,
    lng: row?.location_lng || null,
    city: row?.location_city || null,
  };
}

// ── POST /api/lifestyle/link-resy — Link Resy account ─────────────────
router.post('/link-resy', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  try {
    const userId = (req as any).userId as string;
    ensureUser(userId);

    const agentRes = await fetch(`${BOOKING_AGENT_URL}/link-resy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, email, password }),
    });

    if (!agentRes.ok) {
      const err = await agentRes.json().catch(() => ({}));
      res.status(agentRes.status).json(err);
      return;
    }

    const data = await agentRes.json() as any;

    // Store tokens in DB
    if (data.success && data.authToken) {
      upsertServiceAccount(userId, 'resy', {
        auth_token: data.authToken,
        service_email: email,
        service_user_id: data.resyUserId ? String(data.resyUserId) : null,
        payment_method_id: data.paymentMethodId ? String(data.paymentMethodId) : null,
        token_expiry: new Date(Date.now() + 45 * 24 * 3600 * 1000).toISOString(),
        status: 'active',
        last_used: new Date().toISOString(),
      });
    }

    res.json(data);
  } catch (err: any) {
    console.error('Link Resy error:', err.message);
    res.status(500).json({ error: 'Failed to link Resy account' });
  }
});

// ── GET /api/lifestyle/resy-status — Check if user has linked Resy ────
router.get('/resy-status', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const account = getServiceAccount(userId, 'resy');

    if (!account) {
      res.json({ linked: false, hasTokens: false, isValid: false });
      return;
    }

    const isExpired = account.token_expiry && new Date(account.token_expiry) < new Date();
    res.json({
      linked: true,
      hasTokens: !!account.auth_token,
      isValid: account.status === 'active' && !isExpired,
      email: account.service_email,
      status: account.status,
      expires: account.token_expiry,
    });
  } catch (err: any) {
    console.error('Resy status error:', err.message);
    res.json({ linked: false, hasTokens: false, isValid: false });
  }
});

// ── POST /api/lifestyle/search-restaurants — Resy search with user location ─
router.post('/search-restaurants', async (req: Request, res: Response) => {
  const { query, cuisine, date, partySize, timePreference } = req.body as {
    query?: string; cuisine?: string; date?: string; partySize?: number; timePreference?: string;
  };

  try {
    const userId = (req as any).userId as string;
    const location = getUserLocation(userId);

    // Get Resy tokens from DB
    const account = getServiceAccount(userId, 'resy');
    const isExpired = account?.token_expiry && new Date(account.token_expiry) < new Date();

    const agentRes = await fetch(`${BOOKING_AGENT_URL}/search-restaurants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        query: query || cuisine || 'restaurants',
        date: date || null,
        party_size: partySize || 2,
        time_preference: timePreference || null,
        user_lat: location.lat,
        user_lng: location.lng,
        user_location: location.city,
        // Pass tokens so Python doesn't need DB access
        resy_auth_token: (account?.status === 'active' && !isExpired) ? account.auth_token : null,
        resy_payment_method_id: account?.payment_method_id || null,
        resy_user_id: account?.service_user_id || null,
      }),
    });

    if (!agentRes.ok) {
      const err = await agentRes.json().catch(() => ({}));
      res.status(agentRes.status).json(err);
      return;
    }

    const data = await agentRes.json();
    res.json(data);
  } catch (err: any) {
    console.error('Search restaurants error:', err.message);
    res.status(500).json({ error: 'Failed to search restaurants' });
  }
});

// ── POST /api/lifestyle/book-resy — Book a specific Resy slot (instant) ─
router.post('/book-resy', async (req: Request, res: Response) => {
  const { venueId, configToken, date, partySize, venueName } = req.body as {
    venueId: number; configToken: string; date: string; partySize?: number; venueName?: string;
  };

  if (!venueId || !configToken || !date) {
    res.status(400).json({ error: 'venueId, configToken, and date are required' });
    return;
  }

  try {
    const userId = (req as any).userId as string;
    ensureUser(userId);

    // Get Resy tokens from DB
    const account = getServiceAccount(userId, 'resy');
    if (!account || account.status !== 'active') {
      res.status(401).json({ status: 'LINK_REQUIRED', service: 'resy' });
      return;
    }

    const isExpired = account.token_expiry && new Date(account.token_expiry) < new Date();
    if (isExpired) {
      upsertServiceAccount(userId, 'resy', { status: 'expired' });
      res.status(401).json({ status: 'LINK_REQUIRED', service: 'resy', message: 'Resy session expired. Please re-link.' });
      return;
    }

    const agentRes = await fetch(`${BOOKING_AGENT_URL}/book-resy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        venue_id: venueId,
        config_token: configToken,
        date,
        party_size: partySize || 2,
        resy_auth_token: account.auth_token,
        resy_payment_method_id: account.payment_method_id,
        resy_user_id: account.service_user_id,
      }),
    });

    const result = await agentRes.json() as any;

    // Update last_used
    upsertServiceAccount(userId, 'resy', { last_used: new Date().toISOString() });

    // If booked, save to lifestyle_bookings
    if (result.status === 'BOOKED' || result.status === 'RESERVATION_CONFIRMED') {
      const db = getDb();
      const bookingId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO lifestyle_bookings (id, user_id, booking_type, venue_name, venue_address, booking_date, booking_time, party_size, booking_platform, booking_status, confirmation_code)
         VALUES (?, ?, 'restaurant', ?, NULL, ?, ?, ?, 'resy', 'confirmed', ?)`
      ).run(
        bookingId,
        userId,
        venueName || result.restaurant || 'Restaurant',
        date,
        result.time || '',
        partySize || 2,
        result.confirmation_id || result.confirmation_code || null,
      );
      result.bookingId = bookingId;
    }

    // If token expired during call, mark in DB
    if (result.status === 'LOGIN_REQUIRED') {
      upsertServiceAccount(userId, 'resy', { status: 'expired' });
    }

    res.json(result);
  } catch (err: any) {
    console.error('Book Resy error:', err.message);
    res.status(500).json({ error: 'Failed to book reservation' });
  }
});

// ── POST /api/lifestyle/link-hatch — Link Hatch account ──────────────
router.post('/link-hatch', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  try {
    const userId = (req as any).userId as string;
    ensureUser(userId);

    const agentRes = await fetch(`${BOOKING_AGENT_URL}/link-hatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, email, password }),
    });

    if (!agentRes.ok) {
      const err = await agentRes.json().catch(() => ({}));
      res.status(agentRes.status).json(err);
      return;
    }

    const data = await agentRes.json() as any;

    // Store in user_service_accounts
    if (data.success) {
      upsertServiceAccount(userId, 'hatch', {
        service_email: email,
        service_metadata: JSON.stringify({
          password,
          devices: data.devices || [],
          lastDeviceSync: new Date().toISOString(),
        }),
        status: 'active',
        last_used: new Date().toISOString(),
      });
    }

    // Don't send password back to frontend
    res.json({ success: data.success, error: data.error, deviceCount: data.deviceCount, devices: data.devices });
  } catch (err: any) {
    console.error('Link Hatch error:', err.message);
    res.status(500).json({ error: 'Failed to link Hatch account' });
  }
});

// ── GET /api/lifestyle/hatch-status — Check if user has linked Hatch ──
router.get('/hatch-status', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const account = getServiceAccount(userId, 'hatch');

    if (!account) {
      res.json({ linked: false, devices: [] });
      return;
    }

    let devices: any[] = [];
    try {
      const meta = JSON.parse(account.service_metadata || '{}');
      devices = meta.devices || [];
    } catch { /* silent */ }

    res.json({
      linked: true,
      email: account.service_email,
      status: account.status,
      devices,
    });
  } catch (err: any) {
    console.error('Hatch status error:', err.message);
    res.json({ linked: false, devices: [] });
  }
});

// ── POST /api/lifestyle/hatch/control — Control Hatch device ──────────
router.post('/hatch/control', async (req: Request, res: Response) => {
  const { deviceId, action, params } = req.body as {
    deviceId?: string; action: string; params?: Record<string, any>;
  };

  if (!action) {
    res.status(400).json({ error: 'action is required' });
    return;
  }

  try {
    const userId = (req as any).userId as string;

    // Verify account is linked
    const account = getServiceAccount(userId, 'hatch');
    if (!account || account.status !== 'active') {
      res.json({ success: false, error: 'Hatch account not linked.', needsLink: true });
      return;
    }

    const agentRes = await fetch(`${BOOKING_AGENT_URL}/hatch-control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, deviceId: deviceId || null, action, params: params || {} }),
    });

    if (!agentRes.ok) {
      const err = await agentRes.json().catch(() => ({}));
      res.status(502).json({ error: 'Hatch control failed', detail: err });
      return;
    }

    const result = await agentRes.json();

    // Update last_used
    upsertServiceAccount(userId, 'hatch', { last_used: new Date().toISOString() });

    res.json(result);
  } catch (err: any) {
    console.error('Hatch control error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to control Hatch device' });
  }
});

// ── POST /api/lifestyle/book — Start browser booking ──────────────────
router.post('/book', async (req: Request, res: Response) => {
  const { bookingData, userInfo } = req.body as {
    bookingData: any;
    userInfo: { firstName: string; lastName: string; email: string; phone?: string };
  };

  if (!bookingData || !userInfo?.firstName || !userInfo?.lastName || !userInfo?.email) {
    res.status(400).json({ error: 'bookingData and userInfo (firstName, lastName, email) are required' });
    return;
  }

  const siteUrl = bookingData.venueWebsite || bookingData.bookingUrl;
  if (!siteUrl) {
    res.status(400).json({ error: 'bookingData must include venueWebsite or bookingUrl' });
    return;
  }

  try {
    const userId = (req as any).userId as string;
    ensureUser(userId);

    // Inject user location if not already on bookingData
    if (!bookingData.userCity) {
      const db = getDb();
      const userRow = db.prepare('SELECT location_city, location_region FROM users WHERE id = ?').get(userId) as any;
      if (userRow?.location_city) {
        bookingData.userCity = userRow.location_city;
        bookingData.userRegion = userRow.location_region || undefined;
      }
    }

    const domain = extractDomain(siteUrl);
    const knownSteps = getLearnedPath(domain);

    // Check if the user has a browser profile
    let hasGoogleSession = false;
    try {
      const profileRes = await fetch(`${BOOKING_AGENT_URL}/browser-profile/${userId}`);
      if (profileRes.ok) {
        const profileData = await profileRes.json() as any;
        hasGoogleSession = profileData.hasProfile === true;
      }
    } catch {
      // Agent may not be running
    }

    const agentRes = await fetch(`${BOOKING_AGENT_URL}/book-lifestyle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingData,
        userInfo: { ...userInfo, userId, hasGoogleSession },
        knownSteps,
      }),
    });

    if (!agentRes.ok) {
      const err = await agentRes.json().catch(() => ({}));
      res.status(502).json({ error: 'Booking agent error', detail: err });
      return;
    }

    const { jobId, status } = await agentRes.json() as { jobId: string; status: string };

    // Store in lifestyle_bookings
    const db = getDb();
    const bookingId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO lifestyle_bookings (id, user_id, booking_type, venue_name, venue_address, venue_phone, venue_place_id, booking_date, booking_time, party_size, service_type, special_requests, booking_platform, booking_status, booking_url, venue_website, venue_google_maps_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      bookingId,
      userId,
      bookingData.bookingType || 'restaurant',
      bookingData.venueName || 'Venue',
      bookingData.venueAddress || null,
      bookingData.venuePhone || null,
      bookingData.venuePlaceId || null,
      bookingData.date || new Date().toISOString().split('T')[0],
      bookingData.time || '',
      bookingData.partySize || null,
      bookingData.serviceType || null,
      bookingData.specialRequests || null,
      'browser',
      'pending',
      siteUrl,
      bookingData.venueWebsite || null,
      bookingData.venueGoogleMapsUrl || null,
    );

    res.json({ jobId, status, bookingId, hasLearnedPath: !!knownSteps });
  } catch (err: any) {
    console.error('Lifestyle browser booking error:', err.message);
    res.status(500).json({ error: 'Failed to start browser booking' });
  }
});

// ── GET /api/lifestyle/book/:jobId/status — Poll booking status ───────
router.get('/book/:jobId/status', async (req: Request, res: Response) => {
  const { jobId } = req.params;

  try {
    const agentRes = await fetch(`${BOOKING_AGENT_URL}/status/${jobId}`);
    if (!agentRes.ok) {
      res.status(agentRes.status).json({ error: 'Job not found' });
      return;
    }

    const data = await agentRes.json() as any;
    const db = getDb();
    const userId = (req as any).userId as string;

    if (data.status === 'completed') {
      const resultStatus = data.result?.status;
      const succeeded = resultStatus === 'booked';

      if (succeeded) {
        db.prepare(
          `UPDATE lifestyle_bookings SET booking_status = 'confirmed', confirmation_code = ? WHERE user_id = ? AND booking_platform = 'browser' AND booking_status = 'pending' ORDER BY booked_at DESC LIMIT 1`
        ).run(data.result?.confirmationCode || null, userId);
      }

      // Save the learned navigation path
      const navSteps = data.result?.navigationSteps;
      const venueWebsite = data.result?.venueWebsite;
      if (venueWebsite && navSteps?.length > 0) {
        const domain = extractDomain(venueWebsite);
        const booking = db.prepare(
          `SELECT venue_name FROM lifestyle_bookings WHERE user_id = ? AND booking_platform = 'browser' ORDER BY booked_at DESC LIMIT 1`
        ).get(userId) as any;
        saveLearnedPath(domain, booking?.venue_name || domain, navSteps, succeeded);
      }
    } else if (data.status === 'failed') {
      db.prepare(
        `UPDATE lifestyle_bookings SET booking_status = 'failed' WHERE user_id = ? AND booking_platform = 'browser' AND booking_status = 'pending' ORDER BY booked_at DESC LIMIT 1`
      ).run(userId);
    }

    res.json(data);
  } catch (err: any) {
    console.error('Lifestyle booking status error:', err.message);
    res.status(502).json({ error: 'Cannot reach booking agent' });
  }
});

// ── GET /api/lifestyle/bookings — List user's lifestyle bookings ──────
router.get('/bookings', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const db = getDb();
    const rows = db.prepare(
      `SELECT * FROM lifestyle_bookings WHERE user_id = ? AND booking_status != 'cancelled' ORDER BY booking_date ASC, booking_time ASC`
    ).all(userId) as any[];

    const bookings = rows.map((r: any) => ({
      id: r.id,
      bookingType: r.booking_type,
      venueName: r.venue_name,
      venueAddress: r.venue_address,
      venuePhone: r.venue_phone,
      bookingDate: r.booking_date,
      bookingTime: r.booking_time,
      partySize: r.party_size,
      serviceType: r.service_type,
      specialRequests: r.special_requests,
      bookingPlatform: r.booking_platform,
      bookingStatus: r.booking_status,
      bookingUrl: r.booking_url,
      venueWebsite: r.venue_website,
      venueGoogleMapsUrl: r.venue_google_maps_url,
      confirmationCode: r.confirmation_code,
      bookedAt: r.booked_at,
    }));

    res.json({ bookings });
  } catch (err: any) {
    console.error('List lifestyle bookings error:', err.message);
    res.status(500).json({ error: 'Failed to list bookings' });
  }
});

// ── PATCH /api/lifestyle/bookings/:id — Cancel booking ────────────────
router.patch('/bookings/:id', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const db = getDb();
    const result = db.prepare(
      `UPDATE lifestyle_bookings SET booking_status = 'cancelled', cancelled_at = datetime('now') WHERE id = ? AND user_id = ?`
    ).run(req.params.id, userId);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Cancel lifestyle booking error:', err.message);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// ── GET /api/lifestyle/learned-paths — View all learned paths ─────────
router.get('/learned-paths', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare(
      `SELECT id, domain, studio_name, success_count, fail_count, last_used_at, created_at
       FROM booking_paths
       WHERE path_type = 'lifestyle'
       ORDER BY success_count DESC`
    ).all() as any[];

    res.json({
      paths: rows.map((r: any) => ({
        id: r.id,
        domain: r.domain,
        venueName: r.studio_name,
        successCount: r.success_count,
        failCount: r.fail_count,
        lastUsedAt: r.last_used_at,
        createdAt: r.created_at,
      })),
    });
  } catch (err: any) {
    console.error('List lifestyle learned paths error:', err.message);
    res.status(500).json({ error: 'Failed to list learned paths' });
  }
});

export default router;
