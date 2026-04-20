import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rateLimit } from '../middleware/rateLimit.js';
import { MemoryKV, setKVForTests } from '../services/kv.js';

interface FakeRes {
  statusCode: number;
  body: any;
  headers: Record<string, string>;
  status: (c: number) => FakeRes;
  json: (b: any) => FakeRes;
  setHeader: (k: string, v: string) => FakeRes;
}

function makeRes(onDone: () => void): FakeRes {
  const res: any = { statusCode: 200, body: undefined, headers: {} };
  res.status = (c: number) => {
    res.statusCode = c;
    return res;
  };
  res.json = (b: any) => {
    res.body = b;
    onDone();
    return res;
  };
  res.setHeader = (k: string, v: string) => {
    res.headers[k] = v;
    return res;
  };
  return res as FakeRes;
}

async function run(
  req: any,
  mw: ReturnType<typeof rateLimit>
): Promise<{ passed: boolean; res: FakeRes }> {
  return new Promise((resolve) => {
    let passed = false;
    const res = makeRes(() => resolve({ passed, res }));
    mw(req as any, res as any, () => {
      passed = true;
      resolve({ passed, res });
    });
  });
}

describe('rateLimit middleware', () => {
  let kv: MemoryKV;

  beforeEach(() => {
    kv = new MemoryKV();
    setKVForTests(kv);
  });
  afterEach(() => setKVForTests(null));

  it('allows up to `max` requests and blocks the overflow', async () => {
    const mw = rateLimit({ name: 't', windowMs: 60_000, max: 3, kv });
    const req = { user: { id: 'u1' }, headers: {} };
    const r1 = await run(req, mw);
    const r2 = await run(req, mw);
    const r3 = await run(req, mw);
    const r4 = await run(req, mw);
    expect(r1.passed && r2.passed && r3.passed).toBe(true);
    expect(r4.passed).toBe(false);
    expect(r4.res.statusCode).toBe(429);
    expect(r4.res.body.error).toMatch(/too many requests/i);
    expect(r4.res.headers['Retry-After']).toBeDefined();
    expect(r4.res.headers['RateLimit-Limit']).toBe('3');
    expect(r4.res.headers['RateLimit-Remaining']).toBe('0');
  });

  it('separates buckets per user', async () => {
    const mw = rateLimit({ name: 't', windowMs: 60_000, max: 1, kv });
    const a = await run({ user: { id: 'a' }, headers: {} }, mw);
    const b = await run({ user: { id: 'b' }, headers: {} }, mw);
    expect(a.passed).toBe(true);
    expect(b.passed).toBe(true);
  });

  it('falls back to X-Forwarded-For when unauthenticated', async () => {
    const mw = rateLimit({ name: 't', windowMs: 60_000, max: 1, kv });
    const req = {
      headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' },
      ip: '127.0.0.1',
    };
    const r1 = await run(req, mw);
    const r2 = await run(req, mw);
    expect(r1.passed).toBe(true);
    expect(r2.passed).toBe(false);
  });

  it('resets the counter after the window rolls over', async () => {
    let clock = 1_000_000;
    const mw = rateLimit({
      name: 't',
      windowMs: 100,
      max: 1,
      kv,
      now: () => clock,
    });
    const req = { user: { id: 'u1' }, headers: {} };
    const r1 = await run(req, mw);
    const r2 = await run(req, mw);
    expect(r1.passed).toBe(true);
    expect(r2.passed).toBe(false);

    clock += 150; // advance past the window
    // Also age out the MemoryKV entry so its internal TTL gate resets.
    await new Promise((r) => setTimeout(r, 110));

    const r3 = await run(req, mw);
    expect(r3.passed).toBe(true);
  });

  it('fails open when the KV throws on incr', async () => {
    const brokenKV: any = {
      kind: 'memory',
      get: async () => null,
      setWithTtl: async () => {},
      incr: async () => {
        throw new Error('boom');
      },
      delete: async () => {},
      close: async () => {},
    };
    const mw = rateLimit({ name: 't', windowMs: 60_000, max: 1, kv: brokenKV });
    const r = await run({ user: { id: 'u1' }, headers: {} }, mw);
    expect(r.passed).toBe(true);
    expect(r.res.statusCode).toBe(200);
  });
});
