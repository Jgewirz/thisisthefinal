import { google } from 'googleapis';
import { getAuthenticatedClient } from './google-tokens.js';
import { getDb } from '../db/sqlite.js';

interface ReservationEmailData {
  restaurantName: string;
  restaurantEmail: string;
  date: string;       // YYYY-MM-DD
  time: string;       // HH:mm
  partySize: number;
  specialRequests?: string;
}

function formatDateForEmail(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimeForEmail(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function buildReservationEmail(
  userName: string,
  userEmail: string,
  data: ReservationEmailData
): { subject: string; html: string; text: string } {
  const dateFormatted = formatDateForEmail(data.date);
  const timeFormatted = formatTimeForEmail(data.time);

  const subject = `Reservation Request — ${dateFormatted} at ${timeFormatted} (${data.partySize} guest${data.partySize !== 1 ? 's' : ''})`;

  const specialLine = data.specialRequests
    ? `\n  Special requests: ${data.specialRequests}\n`
    : '';

  const text = `Hi,

I'd like to request a reservation at ${data.restaurantName}:

  Date: ${dateFormatted}
  Time: ${timeFormatted}
  Party size: ${data.partySize}
  Name: ${userName}
${specialLine}
Please confirm at your earliest convenience.

Thank you,
${userName}
${userEmail}`;

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto;">
  <p>Hi,</p>
  <p>I'd like to request a reservation at <strong>${escapeHtml(data.restaurantName)}</strong>:</p>
  <table style="border-collapse: collapse; margin: 16px 0;">
    <tr><td style="padding: 4px 16px 4px 0; color: #666;">Date</td><td style="padding: 4px 0;"><strong>${escapeHtml(dateFormatted)}</strong></td></tr>
    <tr><td style="padding: 4px 16px 4px 0; color: #666;">Time</td><td style="padding: 4px 0;"><strong>${escapeHtml(timeFormatted)}</strong></td></tr>
    <tr><td style="padding: 4px 16px 4px 0; color: #666;">Party size</td><td style="padding: 4px 0;"><strong>${data.partySize}</strong></td></tr>
    <tr><td style="padding: 4px 16px 4px 0; color: #666;">Name</td><td style="padding: 4px 0;"><strong>${escapeHtml(userName)}</strong></td></tr>
    ${data.specialRequests ? `<tr><td style="padding: 4px 16px 4px 0; color: #666;">Special requests</td><td style="padding: 4px 0;">${escapeHtml(data.specialRequests)}</td></tr>` : ''}
  </table>
  <p>Please confirm at your earliest convenience.</p>
  <p>Thank you,<br>${escapeHtml(userName)}<br><a href="mailto:${escapeHtml(userEmail)}">${escapeHtml(userEmail)}</a></p>
</div>`.trim();

  return { subject, html, text };
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildRawEmail(from: string, to: string, subject: string, html: string, text: string): string {
  const boundary = `boundary_${Date.now()}`;

  const raw = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    ``,
    text,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    ``,
    html,
    ``,
    `--${boundary}--`,
  ].join('\r\n');

  // Gmail API requires URL-safe base64
  return Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sendReservationEmail(
  userId: string,
  data: ReservationEmailData
): Promise<{ messageId: string } | null> {
  const client = await getAuthenticatedClient(userId);
  if (!client) {
    console.error('[gmail] No authenticated Google client for user', userId);
    return null;
  }

  // Get user info for the from address
  const db = getDb();
  const user = db
    .prepare('SELECT email, display_name FROM users WHERE id = ?')
    .get(userId) as any;

  if (!user?.email) {
    console.error('[gmail] No email found for user', userId);
    return null;
  }

  const userName = user.display_name || user.email.split('@')[0];
  const { subject, html, text } = buildReservationEmail(userName, user.email, data);
  const raw = buildRawEmail(user.email, data.restaurantEmail, subject, html, text);

  const gmail = google.gmail({ version: 'v1', auth: client });

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });

  return { messageId: res.data.id || '' };
}
