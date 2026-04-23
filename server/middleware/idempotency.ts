import { Request, Response, NextFunction } from 'express';
import { createHash } from 'node:crypto';
import { getKV, MemoryKV, type KVStore } from '../services/kv.js';

/**
 * Idempotency middleware (RFC-style `Idempotency-Key` header).
 *
 * Semantics:
 *   - If the request has no Idempotency-Key header → pass through.
 *   - If the same (user, key, body-hash) is replayed within TTL → replay the
 *     stored response (status + body).
 *   - If the same (user, key) is seen with a DIFFERENT body-hash → 409 Conflict.
 *     (Per IETF draft — reusing a key with mismatched body is an abuse.)
 *   - Backed by the shared KV store, so replays are consistent across replicas
 *     when REDIS_URL is set. Falls back to in-memory per-process otherwise.
 */

interface CacheEntry {
  bodyHash: string;
  statusCode: number;
  body: unknown;
}

const DEFAULT_TTL_MS = 10 * 60_000;

/**
 * Exposed only for legacy tests that reach into the in-memory backend.
 * In production code prefer `getKV()` directly.
 */
export const idempotencyCache = new Map<string, CacheEntry>();

/** Legacy in-memory backend — retained so older tests still observe entries. */
class LegacyCacheKV implements KVStore {
  readonly kind = 'memory' as const;
  async get<T>(key: string) {
    const v = idempotencyCache.get(key);
    return (v ?? null) as T | null;
  }
  async setWithTtl(key: string, value: unknown, ttlMs: number): Promise<void> {
    idempotencyCache.set(key, value as CacheEntry);
    setTimeout(() => idempotencyCache.delete(key), ttlMs).unref?.();
  }
  async incr(): Promise<number> {
    throw new Error('LegacyCacheKV.incr not supported');
  }
  async delete(key: string): Promise<void> {
    idempotencyCache.delete(key);
  }
  async close(): Promise<void> {}
}
const legacyKV = new LegacyCacheKV();

function hashBody(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body ?? {})).digest('hex');
}

function cacheKey(userId: string, idemKey: string): string {
  return `idem::${userId}::${idemKey}`;
}

export interface IdempotencyOptions {
  ttlMs?: number;
  /** If true, require a user on the request (default true). */
  requireUser?: boolean;
  /** Inject a KV store (tests). Defaults to the singleton from `getKV()`. */
  kv?: KVStore;
}

export function idempotency(opts: IdempotencyOptions = {}) {
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
  const requireUser = opts.requireUser ?? true;

  async function resolveKV(): Promise<KVStore> {
    if (opts.kv) return opts.kv;
    const kv = await getKV();
    // Mirror writes into the legacy Map when using the in-memory backend so
    // pre-existing tests that inspect `idempotencyCache` continue to work.
    return kv instanceof MemoryKV ? legacyKV : kv;
  }

  return function idempotencyMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const rawKey = req.header('Idempotency-Key') ?? req.header('idempotency-key');
    if (!rawKey) return next();

    const key = rawKey.trim();
    if (!key || key.length > 255) {
      res.status(400).json({ error: 'Invalid Idempotency-Key header' });
      return;
    }

    const userId = req.user?.id ?? (requireUser ? null : 'anonymous');
    if (!userId) return next();

    const bodyHash = hashBody(req.body);
    const ck = cacheKey(userId, key);

    // Async kernel — resolve KV, check for existing, wrap res.json.
    void (async () => {
      let kv: KVStore;
      try {
        kv = await resolveKV();
      } catch {
        // KV broken → pass through (fail open). The handler will still run.
        return next();
      }

      const existing = await kv.get<CacheEntry>(ck);
      if (existing) {
        if (existing.bodyHash !== bodyHash) {
          res.status(409).json({
            error: 'Idempotency-Key reused with a different request body',
          });
          return;
        }
        res.status(existing.statusCode).json(existing.body);
        return;
      }

      const originalJson = res.json.bind(res);
      res.json = ((body: unknown) => {
        const status = res.statusCode || 200;
        // Only cache final, successful responses. 4xx/5xx are not idempotent
        // operations (the work didn't complete); caching them would trap the
        // client in a 409 loop when they retry with a fixed body.
        if (status < 400) {
          void kv.setWithTtl(ck, { bodyHash, statusCode: status, body }, ttlMs);
        }
        return originalJson(body);
      }) as typeof res.json;

      next();
    })();
  };
}
