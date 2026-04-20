/**
 * JWT secret validation.
 *
 * Fails fast in production if the secret is missing, too short, or a known
 * default. In development a loud warning is logged and an ephemeral random
 * secret is generated so local dev never silently signs tokens with
 * "dev-secret".
 */
import crypto from 'node:crypto';

const MIN_LENGTH = 32;

/** Known default/placeholder secrets shipped by example repos. */
const WEAK_DEFAULTS = new Set<string>([
  'secret',
  'dev-secret',
  'changeme',
  'change-me',
  'please-change-me',
  'your-secret-here',
  'girlbot-secret-change-in-production',
]);

export type JwtSecretSource = 'env' | 'dev-ephemeral';

export interface JwtSecretResult {
  secret: string;
  source: JwtSecretSource;
  warning?: string;
}

/**
 * Pure function: validates a given env object and returns the secret to use.
 * Throws in production for invalid values; never throws in non-production.
 */
export function validateJwtSecret(env: NodeJS.ProcessEnv = process.env): JwtSecretResult {
  const raw = (env.JWT_SECRET ?? '').trim();
  const isProd = env.NODE_ENV === 'production';

  if (!raw) {
    if (isProd) {
      throw new Error(
        'JWT_SECRET is required in production. Set a cryptographically random string of ' +
          MIN_LENGTH +
          '+ characters.'
      );
    }
    const ephemeral = crypto.randomBytes(48).toString('base64url');
    return {
      secret: ephemeral,
      source: 'dev-ephemeral',
      warning:
        'JWT_SECRET is not set. An ephemeral dev secret was generated; all JWTs will invalidate on restart.',
    };
  }

  if (WEAK_DEFAULTS.has(raw)) {
    if (isProd) {
      throw new Error(
        'JWT_SECRET matches a well-known default. Generate a random ' +
          MIN_LENGTH +
          '+ char secret.'
      );
    }
    return {
      secret: raw,
      source: 'env',
      warning:
        'JWT_SECRET matches a well-known default. Replace it before deploying to production.',
    };
  }

  if (raw.length < MIN_LENGTH) {
    if (isProd) {
      throw new Error(
        `JWT_SECRET must be at least ${MIN_LENGTH} characters in production (got ${raw.length}).`
      );
    }
    return {
      secret: raw,
      source: 'env',
      warning: `JWT_SECRET is only ${raw.length} chars. Use ${MIN_LENGTH}+ in production.`,
    };
  }

  return { secret: raw, source: 'env' };
}

let _cached: JwtSecretResult | null = null;

/**
 * Returns the validated JWT secret, caching the result for the process
 * lifetime. Prints the warning once. Safe to call eagerly at startup to
 * fail fast in production.
 */
export function getJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  if (!_cached) {
    _cached = validateJwtSecret(env);
    if (_cached.warning) {
      console.warn('⚠ JWT secret:', _cached.warning);
    }
  }
  return _cached.secret;
}

/** Test hook — reset cached secret so tests can change env vars between cases. */
export function __resetJwtSecretCache(): void {
  _cached = null;
}
