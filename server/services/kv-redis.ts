import type { KVStore } from './kv.js';

/**
 * Minimal Redis client surface we depend on. Implemented by `ioredis`.
 * Kept as a structural type so tests can inject a stub without installing
 * the real package.
 */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'PX', ttl: number): Promise<unknown>;
  del(key: string): Promise<number>;
  incr(key: string): Promise<number>;
  pexpire(key: string, ttlMs: number): Promise<number>;
  quit(): Promise<'OK' | string>;
}

export class RedisKV implements KVStore {
  readonly kind = 'redis' as const;
  constructor(private client: RedisLike) {}

  async get<T = unknown>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setWithTtl(key: string, value: unknown, ttlMs: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'PX', ttlMs);
  }

  async incr(key: string, windowMs: number): Promise<number> {
    // Two-step: INCR + PEXPIRE. The first caller inside a window stamps the
    // TTL; subsequent callers inside the window skip the TTL reset so we get
    // a fixed-window limiter (simple, predictable, good enough).
    const next = await this.client.incr(key);
    if (next === 1) {
      await this.client.pexpire(key, windowMs);
    }
    return next;
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async close(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      // swallow — client may already be closed
    }
  }
}

/**
 * Construct a RedisKV from a connection URL. Lazily `import()`s `ioredis`
 * so environments that don't use Redis never pay the dependency cost.
 *
 * If `ioredis` is not installed, this throws and the caller should fall
 * back to MemoryKV.
 */
export async function createRedisKV(url: string): Promise<KVStore> {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore -- optional peer: ioredis may not be installed.
  const mod = await import('ioredis');
  const Ctor = (mod as any).default ?? (mod as any).Redis ?? (mod as any);
  const client: RedisLike = new Ctor(url);
  // Fail fast if the URL is garbage.
  await client.get('__kv_ping__');
  return new RedisKV(client);
}
