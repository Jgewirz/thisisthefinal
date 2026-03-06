import crypto from 'crypto';
import type { Request, Response } from 'express';

export const SESSION_COOKIE_NAME = 'girlbot_session';
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 365;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION_SECRET = process.env.SESSION_SECRET?.trim() || process.env.OPENAI_API_KEY?.trim() || '';

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};

  return cookieHeader.split(';').reduce<Record<string, string>>((cookies, part) => {
    const index = part.indexOf('=');
    if (index === -1) return cookies;

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function sign(value: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function isValidSessionUserId(userId: string): boolean {
  return UUID_PATTERN.test(userId);
}

export function createSessionToken(userId: string): string {
  const signature = sign(userId);
  return `${userId}.${signature}`;
}

export function verifySessionToken(token?: string): string | null {
  if (!token) return null;

  const splitIndex = token.lastIndexOf('.');
  if (splitIndex <= 0) return null;

  const userId = token.slice(0, splitIndex);
  const signature = token.slice(splitIndex + 1);
  if (!isValidSessionUserId(userId)) return null;

  const expected = sign(userId);
  return safeEqual(signature, expected) ? userId : null;
}

export function readSessionUserId(req: Request): string | null {
  const cookies = parseCookies(req.headers.cookie);
  return verifySessionToken(cookies[SESSION_COOKIE_NAME]);
}

export function setSessionCookie(res: Response, userId: string) {
  res.cookie(SESSION_COOKIE_NAME, createSessionToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  });
}
