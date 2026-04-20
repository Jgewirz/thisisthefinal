import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryKV, getKV, setKVForTests } from '../services/kv.js';

describe('MemoryKV', () => {
  it('get/setWithTtl round-trips JSON values', async () => {
    const kv = new MemoryKV();
    await kv.setWithTtl('k', { a: 1, b: 'x' }, 1000);
    expect(await kv.get('k')).toEqual({ a: 1, b: 'x' });
  });

  it('returns null for missing keys', async () => {
    const kv = new MemoryKV();
    expect(await kv.get('missing')).toBeNull();
  });

  it('expires entries after their TTL', async () => {
    const kv = new MemoryKV();
    await kv.setWithTtl('k', 1, 1);
    await new Promise((r) => setTimeout(r, 5));
    expect(await kv.get('k')).toBeNull();
  });

  it('incr() stamps TTL on first hit and increments subsequent hits', async () => {
    const kv = new MemoryKV();
    expect(await kv.incr('ctr', 1000)).toBe(1);
    expect(await kv.incr('ctr', 1000)).toBe(2);
    expect(await kv.incr('ctr', 1000)).toBe(3);
  });

  it('incr() restarts the counter after the window elapses', async () => {
    const kv = new MemoryKV();
    expect(await kv.incr('ctr', 2)).toBe(1);
    await new Promise((r) => setTimeout(r, 10));
    expect(await kv.incr('ctr', 2)).toBe(1);
  });

  it('delete() removes a key', async () => {
    const kv = new MemoryKV();
    await kv.setWithTtl('k', 1, 1000);
    await kv.delete('k');
    expect(await kv.get('k')).toBeNull();
  });
});

describe('getKV()', () => {
  beforeEach(() => setKVForTests(null));
  afterEach(() => {
    setKVForTests(null);
    delete process.env.REDIS_URL;
    vi.resetModules();
  });

  it('returns MemoryKV when REDIS_URL is not set', async () => {
    delete process.env.REDIS_URL;
    const kv = await getKV();
    expect(kv.kind).toBe('memory');
  });

  it('falls back to MemoryKV with a warning when Redis init fails', async () => {
    process.env.REDIS_URL = 'redis://unreachable:1/0';
    vi.resetModules();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.doMock('../services/kv-redis.js', () => ({
      createRedisKV: async () => {
        throw new Error('ECONNREFUSED');
      },
    }));
    const { getKV: freshGetKV, setKVForTests: freshReset } = await import(
      '../services/kv.js'
    );
    freshReset(null);
    const kv = await freshGetKV();
    expect(kv.kind).toBe('memory');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    vi.doUnmock('../services/kv-redis.js');
  });
});

describe('RedisKV (against a stub client)', () => {
  it('delegates get/set/incr/delete/close correctly', async () => {
    const calls: any[] = [];
    const store = new Map<string, string>();
    const client = {
      async get(k: string) {
        calls.push(['get', k]);
        return store.has(k) ? store.get(k)! : null;
      },
      async set(k: string, v: string, mode: string, ttl: number) {
        calls.push(['set', k, v, mode, ttl]);
        store.set(k, v);
        return 'OK';
      },
      async del(k: string) {
        calls.push(['del', k]);
        return store.delete(k) ? 1 : 0;
      },
      async incr(k: string) {
        const next = (parseInt(store.get(k) ?? '0', 10) || 0) + 1;
        store.set(k, String(next));
        calls.push(['incr', k]);
        return next;
      },
      async pexpire(k: string, ttl: number) {
        calls.push(['pexpire', k, ttl]);
        return 1;
      },
      async quit() {
        calls.push(['quit']);
        return 'OK' as const;
      },
    };
    const { RedisKV } = await import('../services/kv-redis.js');
    const kv = new RedisKV(client);

    await kv.setWithTtl('k', { a: 1 }, 1000);
    expect(await kv.get('k')).toEqual({ a: 1 });
    expect(await kv.incr('ctr', 500)).toBe(1);
    expect(await kv.incr('ctr', 500)).toBe(2); // pexpire only on first
    await kv.delete('k');
    await kv.close();

    const names = calls.map((c) => c[0]);
    expect(names).toEqual(['set', 'get', 'incr', 'pexpire', 'incr', 'del', 'quit']);
  });

  it('returns null when Redis value is not JSON', async () => {
    const { RedisKV } = await import('../services/kv-redis.js');
    const kv = new RedisKV({
      get: async () => 'not json',
      set: async () => 'OK',
      del: async () => 0,
      incr: async () => 0,
      pexpire: async () => 0,
      quit: async () => 'OK',
    });
    expect(await kv.get('anything')).toBeNull();
  });
});
