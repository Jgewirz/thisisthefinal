import { describe, expect, it } from 'vitest';
import { paramString } from '../utils/paramString.js';

describe('paramString', () => {
  it('returns plain strings unchanged', () => {
    expect(paramString('r1')).toBe('r1');
  });

  it('takes the first segment when Express provides an array', () => {
    expect(paramString(['a', 'b'])).toBe('a');
  });

  it('returns undefined for missing params', () => {
    expect(paramString(undefined)).toBeUndefined();
  });
});
