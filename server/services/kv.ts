/**
 * Small key/value store abstraction used by the idempotency middleware
 * and the rate-limiter.  A Redis-backed impl is selected automatically when
 * `REDIS_URL` is set; otherwise an in-process Map is used.
 *
 * The surface area is intentionally tiny so both backends are trivial:
 *   - `get<T>(key)`            — read JSON value, or null.
 *   - `setWithTtl(key, val, ttl)` — write JSON value, expire after ttl ms.
 *   - `incr(key, windowMs)`    — atomic INCR with TTL on first write.
 *   - `delete(key)`            — remove.
 */

export interface KVStore {
  get<T = unknown>(key: string): Promise<T | null>;
  setWithTtl(key: string, value: unknown, ttlMs: number): Promise<void>;
  incr(key: string, windowMs: number): Promise<number>;
  delete(key: string): Promise<void>;
  /** Close underlying client. No-op for in-memory. */
  close(): Promise<void>;
  /** Human-readable backend name, used in startup log / tests. */
  readonly kind: 'memory' | 'redis';
}

interface MemoryEntry {
  value: unknown;
  expiresAt: number;
}

export class MemoryKV implements KVStore {
  readonly kind = 'memory' as const;
  private store = new Map<string, MemoryEntry>();

  // Exported for tests so they can inspect or reset state.
  _raw(): Map<string, MemoryEntry> {
    return this.store;
  }

  private sweep(now: number): void {
    for (const [k, v] of this.store) {
      if (v.expiresAt <= now) this.store.delete(k);
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const now = Date.now();
    const e = this.store.get(key);
    if (!e) return null;
    if (e.expiresAt <= now) {
      this.store.delete(key);
      return null;
    }
    return e.value as T;
  }

  async setWithTtl(key: string, value: unknown, ttlMs: number): Promise<void> {
    this.sweep(Date.now());
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async incr(key: string, windowMs: number): Promise<number> {
    this.sweep(Date.now());
    const existing = this.store.get(key);
    if (!existing || existing.expiresAt <= Date.now()) {
      // First hit in this window — stamp the expiry.
      this.store.set(key, { value: 1, expiresAt: Date.now() + windowMs });
      return 1;
    }
    const next = ((existing.value as number) ?? 0) + 1;
    existing.value = next;
    return next;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async close(): Promise<void> {
    this.store.clear();
  }
}

let _kv: KVStore | null = null;

/**
 * Returns the singleton KV store.  Chosen based on env at first call:
 *   - `REDIS_URL` present → RedisKV (lazy-imports ioredis)
 *   - otherwise           → MemoryKV
 *
 * Tests can override by passing an injected instance via `setKVForTests`.
 */
export async function getKV(): Promise<KVStore> {
  if (_kv) return _kv;
  const url = process.env.REDIS_URL;
  if (url) {
    try {
      const { createRedisKV } = await import('./kv-redis.js');
      _kv = await createRedisKV(url);
      // eslint-disable-next-line no-console
      console.log(`  ✓ KV store: redis (${url.replace(/\/\/[^@]*@/, '//***@')})`);
      return _kv;
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.warn(
        `  ⚠ REDIS_URL set but Redis init failed (${err.message}); falling back to in-memory KV. ` +
          `Install the 'ioredis' package or fix the connection URL to enable Redis.`
      );
    }
  }
  _kv = new MemoryKV();
  return _kv;
}

/** Test-only: override the singleton. Always reset in afterEach. */
export function setKVForTests(kv: KVStore | null): void {
  _kv = kv;
}
