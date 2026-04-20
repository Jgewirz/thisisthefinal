import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetJwtSecretCache,
  getJwtSecret,
  validateJwtSecret,
} from '../config/jwtSecret.js';

function env(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  // Start from a clean slate so tests don't inherit a real JWT_SECRET.
  return { ...(overrides as Record<string, string>) } as NodeJS.ProcessEnv;
}

describe('validateJwtSecret (production)', () => {
  it('throws when JWT_SECRET is missing', () => {
    expect(() => validateJwtSecret(env({ NODE_ENV: 'production' }))).toThrow(
      /JWT_SECRET is required in production/
    );
  });

  it('throws when JWT_SECRET matches a known default', () => {
    expect(() =>
      validateJwtSecret(
        env({ NODE_ENV: 'production', JWT_SECRET: 'girlbot-secret-change-in-production' })
      )
    ).toThrow(/well-known default/);
    expect(() =>
      validateJwtSecret(env({ NODE_ENV: 'production', JWT_SECRET: 'changeme' }))
    ).toThrow(/well-known default/);
  });

  it('throws when JWT_SECRET is shorter than 32 chars', () => {
    expect(() =>
      validateJwtSecret(env({ NODE_ENV: 'production', JWT_SECRET: 'a'.repeat(16) }))
    ).toThrow(/at least 32 characters/);
  });

  it('accepts a strong 32+ char secret', () => {
    const secret = 'x'.repeat(48);
    const result = validateJwtSecret(env({ NODE_ENV: 'production', JWT_SECRET: secret }));
    expect(result.source).toBe('env');
    expect(result.secret).toBe(secret);
    expect(result.warning).toBeUndefined();
  });
});

describe('validateJwtSecret (development)', () => {
  it('generates an ephemeral secret when unset, with warning', () => {
    const result = validateJwtSecret(env({ NODE_ENV: 'development' }));
    expect(result.source).toBe('dev-ephemeral');
    expect(result.secret.length).toBeGreaterThanOrEqual(32);
    expect(result.warning).toMatch(/ephemeral/i);
  });

  it('warns but does not throw on a weak dev secret', () => {
    const result = validateJwtSecret(
      env({ NODE_ENV: 'development', JWT_SECRET: 'girlbot-secret-change-in-production' })
    );
    expect(result.source).toBe('env');
    expect(result.warning).toMatch(/well-known default/i);
  });

  it('warns but does not throw when a dev secret is too short', () => {
    const result = validateJwtSecret(env({ JWT_SECRET: 'short' }));
    expect(result.source).toBe('env');
    expect(result.warning).toMatch(/only 5 chars/);
  });

  it('returns a clean result for a strong dev secret', () => {
    const secret = 'y'.repeat(40);
    const result = validateJwtSecret(env({ JWT_SECRET: secret }));
    expect(result.source).toBe('env');
    expect(result.warning).toBeUndefined();
  });

  it('trims whitespace before validating', () => {
    const secret = '  ' + 'z'.repeat(40) + '  ';
    const result = validateJwtSecret(env({ NODE_ENV: 'production', JWT_SECRET: secret }));
    expect(result.secret).toBe('z'.repeat(40));
  });
});

describe('getJwtSecret caching', () => {
  beforeEach(() => __resetJwtSecretCache());

  it('caches the first validation result', () => {
    const originalSecret = process.env.JWT_SECRET;
    const originalNodeEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'development';
      process.env.JWT_SECRET = 'a'.repeat(40);
      const first = getJwtSecret();
      process.env.JWT_SECRET = 'b'.repeat(40);
      const second = getJwtSecret();
      expect(second).toBe(first);
    } finally {
      if (originalSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = originalSecret;
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
      __resetJwtSecretCache();
    }
  });
});
