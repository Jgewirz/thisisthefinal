/**
 * Client wrappers for the password-reset endpoints.
 *
 * Both endpoints are public (no JWT); failures surface as a thrown
 * `AuthApiError` so callers can render a message without branching on
 * fetch-level details.
 */

export class AuthApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'AuthApiError';
  }
}

export interface ForgotPasswordResult {
  ok: true;
  /** Present only when the server runs in non-production (dev help). */
  devResetUrl?: string;
  devResetToken?: string;
}

async function parseJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

export async function forgotPassword(email: string): Promise<ForgotPasswordResult> {
  const res = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new AuthApiError(data.error || 'Request failed', res.status);
  }
  return data as ForgotPasswordResult;
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new AuthApiError(data.error || 'Reset failed', res.status);
  }
}
