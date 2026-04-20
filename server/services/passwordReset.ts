/**
 * Password-reset token service.
 *
 *   - Tokens are 256 random bits, base64url-encoded (43 chars).
 *   - Only sha256(token) is stored server-side; the raw token is never
 *     persisted so a DB breach cannot be used to reset accounts.
 *   - Tokens are single-use (`used_at` stamp) and expire after 30 min.
 *   - `consumePasswordResetToken` is atomic — exactly one caller can
 *     successfully redeem a given token thanks to the UPDATE...RETURNING
 *     + `used_at IS NULL AND expires_at > NOW()` predicate.
 */
import crypto from 'node:crypto';
import { pool } from './db.js';

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

export interface ConsumedResetToken {
  id: string;
  user_id: string;
}

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashResetToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Persist a new reset token for `userId`. The raw token is not stored.
 * Returns the token id (useful for logging), or null if the DB insert
 * failed. Callers should treat a null result as a soft failure.
 */
export async function createPasswordResetToken(
  userId: string,
  rawToken: string,
  ttlMs: number = RESET_TOKEN_TTL_MS,
  now: Date = new Date()
): Promise<string | null> {
  try {
    const id = crypto.randomUUID();
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(now.getTime() + ttlMs);
    await pool.query(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [id, userId, tokenHash, expiresAt]
    );
    return id;
  } catch (err: any) {
    console.error('createPasswordResetToken error:', err.message);
    return null;
  }
}

/**
 * Atomically consume a reset token. Returns the matched record only if the
 * token was valid AND unused AND unexpired at the moment of the update.
 * Any subsequent call with the same token will return null.
 */
export async function consumePasswordResetToken(
  rawToken: string
): Promise<ConsumedResetToken | null> {
  const tokenHash = hashResetToken(rawToken);
  try {
    const { rows } = await pool.query(
      `UPDATE password_reset_tokens
          SET used_at = NOW()
        WHERE token_hash = $1
          AND used_at IS NULL
          AND expires_at > NOW()
        RETURNING id, user_id`,
      [tokenHash]
    );
    return (rows[0] as ConsumedResetToken | undefined) ?? null;
  } catch (err: any) {
    console.error('consumePasswordResetToken error:', err.message);
    return null;
  }
}
