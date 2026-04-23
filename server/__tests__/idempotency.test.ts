import { describe, it, expect, beforeEach, vi } from 'vitest';
import { idempotency, idempotencyCache } from '../middleware/idempotency.js';

interface FakeRes {
  statusCode: number;
  body: any;
  status: (code: number) => FakeRes;
  json: (body: any) => FakeRes;
}

function makeRes(onRespond: () => void): FakeRes {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (c: number) => {
    res.statusCode = c;
    return res;
  };
  res.json = (b: any) => {
    res.body = b;
    onRespond();
    return res;
  };
  return res as FakeRes;
}

async function runHandler(
  req: any,
  handler: (req: any, res: any) => any,
  opts?: Parameters<typeof idempotency>[0]
) {
  let responded = false;
  return new Promise<FakeRes>((resolve) => {
    const done = (res: FakeRes) => {
      if (!responded) {
        responded = true;
        resolve(res);
      }
    };
    const res = makeRes(() => done(res));
    idempotency(opts)(req, res as any, async () => {
      await handler(req, res);
      done(res);
    });
  });
}

describe('idempotency middleware', () => {
  beforeEach(() => idempotencyCache.clear());

  const user = { id: 'u1', email: 'a@b.co', name: 'A' };

  it('passes through when no Idempotency-Key header is set', async () => {
    const handler = vi.fn((_, res) => res.status(201).json({ ok: true }));
    const res = await runHandler({ user, headers: {}, header: () => undefined, body: {} }, handler);
    expect(handler).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ ok: true });
  });

  it('replays the cached response on exact-same (user, key, body)', async () => {
    const handler = vi.fn((_, res) => res.status(200).json({ id: 'm1', saved: true }));

    const req1 = {
      user,
      header: (h: string) => (h.toLowerCase() === 'idempotency-key' ? 'abc' : undefined),
      body: { id: 'm1', text: 'hi' },
    };
    const r1 = await runHandler(req1, handler);
    expect(r1.body).toEqual({ id: 'm1', saved: true });

    const req2 = { ...req1 };
    const r2 = await runHandler(req2, handler);

    expect(handler).toHaveBeenCalledOnce(); // second call served from cache
    expect(r2.statusCode).toBe(200);
    expect(r2.body).toEqual({ id: 'm1', saved: true });
  });

  it('returns 409 when the same key is reused with a different body', async () => {
    const handler = vi.fn((_, res) => res.status(200).json({ saved: true }));

    const base = {
      user,
      header: (h: string) => (h.toLowerCase() === 'idempotency-key' ? 'abc' : undefined),
    };
    await runHandler({ ...base, body: { text: 'hi' } }, handler);
    const r2 = await runHandler({ ...base, body: { text: 'different' } }, handler);

    expect(handler).toHaveBeenCalledOnce();
    expect(r2.statusCode).toBe(409);
    expect(r2.body).toEqual({
      error: 'Idempotency-Key reused with a different request body',
    });
  });

  it('isolates cache entries per user', async () => {
    const handler = vi.fn((_, res) => res.status(200).json({ who: _.user.id }));

    const reqA = {
      user,
      header: (h: string) => (h.toLowerCase() === 'idempotency-key' ? 'abc' : undefined),
      body: { text: 'hi' },
    };
    const reqB = {
      user: { id: 'u2', email: 'c@d.co', name: 'C' },
      header: (h: string) => (h.toLowerCase() === 'idempotency-key' ? 'abc' : undefined),
      body: { text: 'hi' },
    };

    const rA = await runHandler(reqA, handler);
    const rB = await runHandler(reqB, handler);

    expect(handler).toHaveBeenCalledTimes(2);
    expect(rA.body).toEqual({ who: 'u1' });
    expect(rB.body).toEqual({ who: 'u2' });
  });

  it('expires the cache after ttlMs', async () => {
    const handler = vi.fn((_, res) => res.status(200).json({ n: handler.mock.calls.length }));
    const req = {
      user,
      header: (h: string) => (h.toLowerCase() === 'idempotency-key' ? 'abc' : undefined),
      body: {},
    };

    const r1 = await runHandler(req, handler, { ttlMs: 1 });
    await new Promise((r) => setTimeout(r, 5));
    const r2 = await runHandler(req, handler, { ttlMs: 1 });

    expect(handler).toHaveBeenCalledTimes(2);
    expect(r1.body).toEqual({ n: 1 });
    expect(r2.body).toEqual({ n: 2 });
  });

  it('does NOT cache 4xx responses — retry with a corrected body is allowed', async () => {
    // Handler fails the first time (invalid field), succeeds with corrected body.
    const handler = vi.fn((req: any, res: any) => {
      if (req.body.imageUrl?.length > 10) {
        return res.status(400).json({ error: 'imageUrl: too long' });
      }
      return res.status(201).json({ ok: true });
    });

    const base = {
      user,
      header: (h: string) => (h.toLowerCase() === 'idempotency-key' ? 'k1' : undefined),
    };
    const r1 = await runHandler({ ...base, body: { imageUrl: 'x'.repeat(50) } }, handler);
    expect(r1.statusCode).toBe(400);

    // Client fixes the payload and retries. Must not be blocked by 409.
    const r2 = await runHandler({ ...base, body: { imageUrl: 'short' } }, handler);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(r2.statusCode).toBe(201);
    expect(r2.body).toEqual({ ok: true });
  });

  it('does NOT cache 5xx responses either', async () => {
    const handler = vi.fn((_: any, res: any) => res.status(500).json({ error: 'boom' }));
    const base = {
      user,
      header: (h: string) => (h.toLowerCase() === 'idempotency-key' ? 'k2' : undefined),
      body: {},
    };
    const r1 = await runHandler(base, handler);
    const r2 = await runHandler(base, handler);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(r1.statusCode).toBe(500);
    expect(r2.statusCode).toBe(500);
  });

  it('rejects keys that are too long', async () => {
    const handler = vi.fn();
    const req = {
      user,
      header: () => 'x'.repeat(300),
      body: {},
    };
    const res = await runHandler(req, handler);
    expect(handler).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });
});
