import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the pg pool so we can assert SQL + simulate atomic single-use updates.
const queryMock = vi.fn();
vi.mock('../services/db.js', () => ({
  pool: { query: queryMock },
}));

beforeEach(() => {
  queryMock.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('generateResetToken / hashResetToken', () => {
  it('produces a base64url token of 43 chars (256 bits)', async () => {
    const { generateResetToken } = await import('../services/passwordReset.js');
    const tok = generateResetToken();
    expect(tok).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('hashResetToken is deterministic and sha256-sized', async () => {
    const { hashResetToken } = await import('../services/passwordReset.js');
    const h1 = hashResetToken('abc');
    const h2 = hashResetToken('abc');
    const h3 = hashResetToken('abd');
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('createPasswordResetToken', () => {
  it('inserts a sha256(token_hash) with an expires_at = now + ttl', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const { createPasswordResetToken, hashResetToken } = await import(
      '../services/passwordReset.js'
    );
    const now = new Date('2026-05-01T00:00:00Z');
    const id = await createPasswordResetToken('user-1', 'raw-token', 1000, now);
    expect(id).not.toBeNull();

    const [, params] = queryMock.mock.calls[0]!;
    const [idParam, userId, tokenHash, expiresAt] = params as [
      string,
      string,
      string,
      Date,
    ];
    expect(idParam).toMatch(/^[0-9a-f-]{36}$/);
    expect(userId).toBe('user-1');
    expect(tokenHash).toBe(hashResetToken('raw-token'));
    expect(expiresAt.getTime()).toBe(now.getTime() + 1000);
  });

  it('returns null (soft failure) if the insert throws', async () => {
    queryMock.mockRejectedValueOnce(new Error('boom'));
    const { createPasswordResetToken } = await import('../services/passwordReset.js');
    const id = await createPasswordResetToken('user-1', 'raw');
    expect(id).toBeNull();
  });
});

describe('consumePasswordResetToken', () => {
  it('returns user_id when UPDATE... RETURNING matches', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 'tok-1', user_id: 'user-1' }],
    });
    const { consumePasswordResetToken } = await import('../services/passwordReset.js');
    const result = await consumePasswordResetToken('raw');
    expect(result).toEqual({ id: 'tok-1', user_id: 'user-1' });

    const [sql, params] = queryMock.mock.calls[0]!;
    expect(sql).toContain('UPDATE password_reset_tokens');
    expect(sql).toContain('used_at IS NULL');
    expect(sql).toContain('expires_at > NOW()');
    expect(sql).toContain('RETURNING id, user_id');
    // hashed, not raw
    expect(params[0]).not.toBe('raw');
    expect(params[0]).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns null when the token is already used / expired / unknown', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const { consumePasswordResetToken } = await import('../services/passwordReset.js');
    const result = await consumePasswordResetToken('nope');
    expect(result).toBeNull();
  });

  it('returns null (soft failure) on DB errors', async () => {
    queryMock.mockRejectedValueOnce(new Error('db unreachable'));
    const { consumePasswordResetToken } = await import('../services/passwordReset.js');
    const result = await consumePasswordResetToken('raw');
    expect(result).toBeNull();
  });
});
