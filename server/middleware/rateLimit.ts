import { Request, Response, NextFunction } from 'express';
import { getKV, type KVStore } from '../services/kv.js';

/**
 * Fixed-window rate limiter, shared-state friendly.
 *
 * When `REDIS_URL` is set the counter lives in Redis, so every replica sees
 * the same totals (replaces the per-process in-memory store used by
 * `express-rate-limit`). Otherwise it falls back to in-process MemoryKV,
 * matching the previous behaviour.
 *
 * Identity precedence for the bucket key:
 *   1. authenticated user id (req.user.id)  — most accurate
 *   2. X-Forwarded-For[0]                    — trust proxy header
 *   3. req.ip                                — socket fallback
 */

export interface RateLimitOptions {
  /** Bucket name so we can rate-limit different endpoints separately. */
  name: string;
  /** Window length in ms. */
  windowMs: number;
  /** Max requests allowed per bucket inside the window. */
  max: number;
  /** Human-readable error message body. */
  message?: string;
  /** Inject a KV store (tests). */
  kv?: KVStore;
  /** Inject a clock (tests). */
  now?: () => number;
}

function clientIdentity(req: Request): string {
  if (req.user?.id) return `u:${req.user.id}`;
  const xff = (req.headers['x-forwarded-for'] ?? '') as string;
  const first = xff.split(',')[0]?.trim();
  if (first) return `ip:${first}`;
  return `ip:${req.ip ?? 'unknown'}`;
}

export function rateLimit(opts: RateLimitOptions) {
  const message = opts.message ?? 'Too many requests. Please wait a moment.';
  const now = opts.now ?? Date.now;

  return function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    void (async () => {
      let kv: KVStore;
      try {
        kv = opts.kv ?? (await getKV());
      } catch {
        // Fail open — never block traffic because the limiter store is down.
        return next();
      }

      const windowStart =
        Math.floor(now() / opts.windowMs) * opts.windowMs;
      const id = clientIdentity(req);
      const key = `rl::${opts.name}::${id}::${windowStart}`;

      let count: number;
      try {
        count = await kv.incr(key, opts.windowMs);
      } catch {
        return next(); // fail open on KV errors
      }

      const remaining = Math.max(0, opts.max - count);
      const resetAt = Math.ceil((windowStart + opts.windowMs) / 1000);
      res.setHeader('RateLimit-Limit', String(opts.max));
      res.setHeader('RateLimit-Remaining', String(remaining));
      res.setHeader('RateLimit-Reset', String(resetAt));

      if (count > opts.max) {
        const retryAfter = Math.max(
          1,
          Math.ceil((windowStart + opts.windowMs - now()) / 1000)
        );
        res.setHeader('Retry-After', String(retryAfter));
        res.status(429).json({ error: message, retryAfter });
        return;
      }

      next();
    })();
  };
}
