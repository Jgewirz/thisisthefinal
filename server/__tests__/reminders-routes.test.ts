import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';

const svc = {
  createReminder: vi.fn(),
  listReminders: vi.fn(),
  getDueReminders: vi.fn(),
  updateReminderStatus: vi.fn(),
  deleteReminder: vi.fn(),
};

vi.mock('../services/reminders.js', () => svc);
vi.mock('../middleware/idempotency.js', () => ({
  idempotency: () => (_req: any, _res: any, next: any) => next(),
}));

interface InvokeResult {
  status: number;
  body: any;
}

/** Invoke the express Router directly without an HTTP server. */
async function invoke(
  method: string,
  url: string,
  body: any = undefined
): Promise<InvokeResult> {
  const { default: router } = await import('../routes/reminders.js');
  const [pathname, search] = url.split('?');
  const query: Record<string, string> = {};
  if (search) {
    for (const part of search.split('&')) {
      const [k, v = ''] = part.split('=');
      query[decodeURIComponent(k)] = decodeURIComponent(v);
    }
  }
  const req: any = {
    method,
    url,
    originalUrl: url,
    baseUrl: '',
    path: pathname,
    query,
    body,
    headers: { 'content-type': 'application/json' },
    user: { id: 'u1', email: 'u1@x.com' },
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
    router.handle(req as IncomingMessage, res as ServerResponse, (err?: any) => {
      if (err) return reject(err);
      resolve({ status: 404, body: { error: 'not matched' } });
    });
  });
}

beforeEach(() => {
  Object.values(svc).forEach((fn) => fn.mockReset());
});
afterEach(() => vi.restoreAllMocks());

describe('reminders routes', () => {
  it('GET /?due=1 returns only due reminders', async () => {
    svc.getDueReminders.mockResolvedValue([{ id: 'r1', title: 'x' }]);
    const res = await invoke('GET', '/?due=1');
    expect(res.status).toBe(200);
    expect(res.body.reminders).toEqual([{ id: 'r1', title: 'x' }]);
    expect(svc.getDueReminders).toHaveBeenCalledWith('u1');
    expect(svc.listReminders).not.toHaveBeenCalled();
  });

  it('GET / filters by comma-separated status list', async () => {
    svc.listReminders.mockResolvedValue([]);
    await invoke('GET', '/?status=pending,fired');
    expect(svc.listReminders).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ status: ['pending', 'fired'] })
    );
  });

  it('POST / validates required body', async () => {
    const res = await invoke('POST', '/', { title: 'x' });
    expect(res.status).toBe(400);
    expect(svc.createReminder).not.toHaveBeenCalled();
  });

  it('POST / returns 201 on success and 400 on service error', async () => {
    svc.createReminder.mockResolvedValueOnce({ id: 'r1' });
    const ok = await invoke('POST', '/', {
      title: 't',
      dueAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(ok.status).toBe(201);
    expect(ok.body.reminder).toEqual({ id: 'r1' });

    svc.createReminder.mockRejectedValueOnce(new Error('dueAt must be in the future'));
    const bad = await invoke('POST', '/', { title: 't', dueAt: '1990-01-01' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/future/);
  });

  it('PATCH /:id updates status, 404s on missing, 400s on invalid', async () => {
    svc.updateReminderStatus.mockResolvedValueOnce({ id: 'r1', status: 'completed' });
    const ok = await invoke('PATCH', '/r1', { status: 'completed' });
    expect(ok.status).toBe(200);
    expect(svc.updateReminderStatus).toHaveBeenCalledWith('r1', 'u1', 'completed');

    svc.updateReminderStatus.mockResolvedValueOnce(null);
    const miss = await invoke('PATCH', '/nope', { status: 'dismissed' });
    expect(miss.status).toBe(404);

    const bad = await invoke('PATCH', '/r1', { status: 'bogus' });
    expect(bad.status).toBe(400);
  });

  it('DELETE /:id returns 404 when not found, 200 when owned', async () => {
    svc.deleteReminder.mockResolvedValueOnce(false);
    const miss = await invoke('DELETE', '/nope');
    expect(miss.status).toBe(404);

    svc.deleteReminder.mockResolvedValueOnce(true);
    const hit = await invoke('DELETE', '/r1');
    expect(hit.status).toBe(200);
  });
});
