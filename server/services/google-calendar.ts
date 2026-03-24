import crypto from 'crypto';
import { google } from 'googleapis';
import {
  isTokenEncryptionConfigured,
  getAuthenticatedClient,
  hasGoogleTokens,
  revokeGoogleTokens,
} from './google-tokens.js';

// ── Public API ──────────────────────────────────────────────────────────

export function isGoogleCalendarConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    isTokenEncryptionConfigured()
  );
}

export function getConnectionStatus(userId: string): { connected: boolean } {
  return { connected: hasGoogleTokens(userId) };
}

export async function fetchGoogleEvents(
  userId: string,
  timeMin: string,
  timeMax: string
): Promise<Array<{ id: string; title: string; date: string; time?: string; endTime?: string }>> {
  const client = await getAuthenticatedClient(userId);
  if (!client) return [];

  const calendar = google.calendar({ version: 'v3', auth: client });
  const res = await calendar.events.list({
    calendarId: 'primary',
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

export async function createCalendarEvent(
  userId: string,
  event: {
    summary: string;
    description: string;
    startDateTime: string;
    endDateTime: string;
    location?: string;
  }
): Promise<{ eventId: string } | null> {
  const client = await getAuthenticatedClient(userId);
  if (!client) return null;

  const calendar = google.calendar({ version: 'v3', auth: client });
  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: event.summary,
      description: event.description,
      start: { dateTime: event.startDateTime },
      end: { dateTime: event.endDateTime },
      location: event.location,
    },
  });

  return res.data.id ? { eventId: res.data.id } : null;
}

export async function disconnectGoogle(userId: string): Promise<void> {
  await revokeGoogleTokens(userId);
}
