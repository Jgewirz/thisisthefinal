import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';

const getUserByEmailMock = vi.fn();
const updateUserPasswordMock = vi.fn();
const createUserMock = vi.fn();

vi.mock('../services/db.js', () => ({
  getUserByEmail: getUserByEmailMock,
  updateUserPassword: updateUserPasswordMock,
  createUser: createUserMock,
}));

const createPasswordResetTokenMock = vi.fn();
const consumePasswordResetTokenMock = vi.fn();

vi.mock('../services/passwordReset.js', () => ({
  createPasswordResetToken: createPasswordResetTokenMock,
  consumePasswordResetToken: consumePasswordResetTokenMock,
  generateResetToken: () => 'raw-token-fixed',
}));

beforeEach(() => {
  process.env.JWT_SECRET = 'x'.repeat(48);
  process.env.NODE_ENV = 'development';
  getUserByEmailMock.mockReset();
  updateUserPasswordMock.mockReset();
  createPasswordResetTokenMock.mockReset();
  consumePasswordResetTokenMock.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

interface InvokeResult {
  status: number;
  body: any;
}

async function invoke(
  method: string,
  url: string,
  body: any = undefined,
  headers: Record<string, string> = {}
): Promise<InvokeResult> {
  const { default: router } = await import('../routes/auth.js');
  const [pathname] = url.split('?');
  const req: any = {
    method,
    url,
    originalUrl: url,
    baseUrl: '',
    path: pathname,
    query: {},
    body,
    headers: { 'content-type': 'application/json', ...headers },
    get: (h: string) => req.headers[h.toLowerCase()],
    app: { get: () => undefined },
  };

  return new Promise<InvokeResult>((resolve, reject) => {
    let status = 200;
    let payload: any;
    const res: any = {
      statusCode: 200,
      headersSent: false,
      setHeader() {},
      getHeader() {},
      removeHeader() {},
      status(code: number) {
        status = code;
        this.statusCode = code;
        return this;
      },
      json(data: any) {
        payload = data;
        resolve({ status, body: data });
        return this;
      },
      end(data?: any) {
        if (payload === undefined) payload = data;
        resolve({ status, body: payload });
        return this;
      },
    };
    (router as any).handle(
      req as IncomingMessage,
      res as ServerResponse,
      (err?: any) => {
        if (err) return reject(err);
        resolve({ status: 404, body: { error: 'not matched' } });
      }
    );
  });
}

describe('POST /forgot-password', () => {
  it('returns 200 with devResetUrl when user exists (development)', async () => {
    getUserByEmailMock.mockResolvedValue({
      id: 'user-1',
      email: 'a@b.com',
      name: 'A',
      password_hash: 'h',
    });
    createPasswordResetTokenMock.mockResolvedValue('tok-id');

    const { status, body } = await invoke(
      'POST',
      '/forgot-password',
      { email: 'A@B.com' },
      { origin: 'http://localhost:5173' }
    );

    expect(getUserByEmailMock).toHaveBeenCalledWith('a@b.com');
    expect(createPasswordResetTokenMock).toHaveBeenCalledWith('user-1', 'raw-token-fixed');
    expect(status).toBe(200);
    expect(body).toEqual({
      ok: true,
      devResetToken: 'raw-token-fixed',
      devResetUrl: 'http://localhost:5173/reset?token=raw-token-fixed',
    });
  });

  it('returns 200 with no extras when user does not exist (no enumeration)', async () => {
    getUserByEmailMock.mockResolvedValue(null);
    const { status, body } = await invoke('POST', '/forgot-password', { email: 'ghost@b.com' });
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(createPasswordResetTokenMock).not.toHaveBeenCalled();
  });

  it('returns 200 with no extras when email is missing', async () => {
    const { status, body } = await invoke('POST', '/forgot-password', {});
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(getUserByEmailMock).not.toHaveBeenCalled();
  });

  it('does not leak the token in production mode', async () => {
    process.env.NODE_ENV = 'production';
    getUserByEmailMock.mockResolvedValue({
      id: 'user-1',
      email: 'a@b.com',
      name: 'A',
      password_hash: 'h',
    });
    createPasswordResetTokenMock.mockResolvedValue('tok-id');

    const { body } = await invoke('POST', '/forgot-password', { email: 'a@b.com' });
    expect(body).toEqual({ ok: true });
    expect((body as any).devResetToken).toBeUndefined();
    expect((body as any).devResetUrl).toBeUndefined();
  });

  it('still returns 200 when getUserByEmail throws', async () => {
    getUserByEmailMock.mockRejectedValue(new Error('db down'));
    const { status, body } = await invoke('POST', '/forgot-password', { email: 'a@b.com' });
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true });
  });
});

describe('POST /reset-password', () => {
  it('400 when token is missing', async () => {
    const { status, body } = await invoke('POST', '/reset-password', {
      newPassword: 'abcdef',
    });
    expect(status).toBe(400);
    expect(body).toEqual({ error: 'token is required' });
  });

  it('400 when newPassword is too short', async () => {
    const { status, body } = await invoke('POST', '/reset-password', {
      token: 't',
      newPassword: '123',
    });
    expect(status).toBe(400);
    expect((body as any).error).toMatch(/at least 6 characters/);
  });

  it('400 when token is invalid / expired', async () => {
    consumePasswordResetTokenMock.mockResolvedValue(null);
    const { status, body } = await invoke('POST', '/reset-password', {
      token: 'bad',
      newPassword: 'abcdef',
    });
    expect(status).toBe(400);
    expect((body as any).error).toMatch(/Invalid or expired/);
    expect(updateUserPasswordMock).not.toHaveBeenCalled();
  });

  it('updates the password and returns ok on valid token', async () => {
    consumePasswordResetTokenMock.mockResolvedValue({ id: 'tok', user_id: 'user-1' });
    updateUserPasswordMock.mockResolvedValue(true);

    const { status, body } = await invoke('POST', '/reset-password', {
      token: 'good',
      newPassword: 'brand-new-password',
    });

    expect(consumePasswordResetTokenMock).toHaveBeenCalledWith('good');
    expect(updateUserPasswordMock).toHaveBeenCalledTimes(1);
    const [userId, hash] = updateUserPasswordMock.mock.calls[0]!;
    expect(userId).toBe('user-1');
    expect(typeof hash).toBe('string');
    expect((hash as string).startsWith('$2')).toBe(true); // bcrypt hash
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true });
  });

  it('returns 500 when updateUserPassword fails', async () => {
    consumePasswordResetTokenMock.mockResolvedValue({ id: 'tok', user_id: 'user-1' });
    updateUserPasswordMock.mockResolvedValue(false);
    const { status } = await invoke('POST', '/reset-password', {
      token: 'good',
      newPassword: 'brand-new-password',
    });
    expect(status).toBe(500);
  });

  it('is single-use: a second consume of the same token is rejected', async () => {
    consumePasswordResetTokenMock
      .mockResolvedValueOnce({ id: 'tok', user_id: 'user-1' })
      .mockResolvedValueOnce(null);
    updateUserPasswordMock.mockResolvedValue(true);

    const first = await invoke('POST', '/reset-password', {
      token: 'same',
      newPassword: 'abcdef1',
    });
    expect(first.status).toBe(200);

    const second = await invoke('POST', '/reset-password', {
      token: 'same',
      newPassword: 'abcdef2',
    });
    expect(second.status).toBe(400);
  });
});
