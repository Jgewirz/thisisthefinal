import { describe, expect, it } from 'vitest';
import { errorMessage, errorStack } from '../utils/errors';

describe('server utils/errors', () => {
  it('extracts message from Error', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });

  it('handles string throws', () => {
    expect(errorMessage('nope')).toBe('nope');
  });

  it('stringifies object throws', () => {
    expect(errorMessage({ code: 123 })).toBe(JSON.stringify({ code: 123 }));
  });

  it('returns undefined stack for non-Error', () => {
    expect(errorStack('x')).toBeUndefined();
  });
});

