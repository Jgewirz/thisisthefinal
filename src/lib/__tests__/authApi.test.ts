import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiError, forgotPassword, resetPassword } from '../authApi';

const originalFetch = globalThis.fetch;

function jsonResponse(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('forgotPassword', () => {
  it('POSTs to /api/auth/forgot-password with a JSON email body', async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async () => jsonResponse({ ok: true })
    );
    globalThis.fetch = fetchMock as any;

    const result = await forgotPassword('a@b.com');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/auth/forgot-password');
    expect(init!.method).toBe('POST');
    expect((init!.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.parse(init!.body as string)).toEqual({ email: 'a@b.com' });
    expect(result).toEqual({ ok: true });
  });

  it('surfaces dev-only fields when present', async () => {
    globalThis.fetch = (async () =>
      jsonResponse({
        ok: true,
        devResetToken: 'tok',
        devResetUrl: 'http://localhost:5173/reset?token=tok',
      })) as any;

    const result = await forgotPassword('a@b.com');
    expect(result.devResetToken).toBe('tok');
    expect(result.devResetUrl).toContain('/reset?token=tok');
  });

  it('throws AuthApiError with status + message on 4xx/5xx', async () => {
    globalThis.fetch = (async () =>
      jsonResponse({ error: 'Too many requests' }, 429)) as any;

    await expect(forgotPassword('a@b.com')).rejects.toMatchObject({
      name: 'AuthApiError',
      status: 429,
      message: 'Too many requests',
    });
  });

  it('falls back to generic message when response has no error field', async () => {
    globalThis.fetch = (async () => new Response('', { status: 500 })) as any;
    await expect(forgotPassword('a@b.com')).rejects.toBeInstanceOf(AuthApiError);
  });
});

describe('resetPassword', () => {
  it('POSTs token + newPassword and resolves on 200', async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async () => jsonResponse({ ok: true })
    );
    globalThis.fetch = fetchMock as any;

    await expect(resetPassword('tok', 'new-pass-123')).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/auth/reset-password');
    expect(init!.method).toBe('POST');
    expect(JSON.parse(init!.body as string)).toEqual({
      token: 'tok',
      newPassword: 'new-pass-123',
    });
  });

  it('throws AuthApiError on invalid token (400)', async () => {
    globalThis.fetch = (async () =>
      jsonResponse({ error: 'Invalid or expired reset token' }, 400)) as any;

    await expect(resetPassword('bad', 'abcdef')).rejects.toMatchObject({
      name: 'AuthApiError',
      status: 400,
      message: /Invalid or expired/,
    });
  });
});
