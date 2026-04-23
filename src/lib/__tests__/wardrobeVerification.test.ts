import { describe, expect, it } from 'vitest';
import type { WardrobeItem } from '../wardrobeApi';
import {
  countVerified,
  draftAttributesPatch,
  isVerifiedItem,
  verificationStatus,
  verifiedAttributesPatch,
} from '../wardrobeVerification';

function mk(partial: Partial<WardrobeItem> & { id: string }): WardrobeItem {
  return {
    id: partial.id,
    user_id: 'u',
    image_url: null,
    category: 'top',
    subtype: null,
    color: null,
    color_hex: null,
    pattern: null,
    seasons: [],
    occasions: [],
    warmth: null,
    attributes: {},
    created_at: '2026-04-22T00:00:00Z',
    ...partial,
  };
}

describe('isVerifiedItem', () => {
  it('returns false when image_url is missing', () => {
    expect(isVerifiedItem(mk({ id: '1', attributes: { verified: true } }))).toBe(false);
  });

  it('returns false when image_url is blank', () => {
    expect(
      isVerifiedItem(mk({ id: '1', image_url: '   ', attributes: { verified: true } }))
    ).toBe(false);
  });

  it('returns false when verified flag is not true', () => {
    expect(
      isVerifiedItem(mk({ id: '1', image_url: 'https://x/y.jpg', attributes: {} }))
    ).toBe(false);
    expect(
      isVerifiedItem(
        mk({ id: '1', image_url: 'https://x/y.jpg', attributes: { verified: 'yes' } })
      )
    ).toBe(false);
  });

  it('returns true only when both photo and explicit verified flag are set', () => {
    expect(
      isVerifiedItem(
        mk({ id: '1', image_url: 'https://x/y.jpg', attributes: { verified: true } })
      )
    ).toBe(true);
  });
});

describe('verificationStatus', () => {
  it('returns "draft" for unverified items', () => {
    expect(verificationStatus(mk({ id: '1' }))).toBe('draft');
  });

  it('returns "verified" for verified items', () => {
    expect(
      verificationStatus(
        mk({ id: '1', image_url: 'https://x/y.jpg', attributes: { verified: true } })
      )
    ).toBe('verified');
  });
});

describe('attribute patches', () => {
  it('verifiedAttributesPatch merges with existing attributes', () => {
    const patch = verifiedAttributesPatch({ color: 'navy', verified: false });
    expect(patch).toEqual({ color: 'navy', verified: true });
  });

  it('verifiedAttributesPatch handles null/undefined', () => {
    expect(verifiedAttributesPatch(null)).toEqual({ verified: true });
    expect(verifiedAttributesPatch(undefined)).toEqual({ verified: true });
  });

  it('draftAttributesPatch strips only the verified key', () => {
    const patch = draftAttributesPatch({ color: 'navy', verified: true, size: 'M' });
    expect(patch).toEqual({ color: 'navy', size: 'M' });
    expect('verified' in patch).toBe(false);
  });
});

describe('countVerified', () => {
  it('counts verified and draft items separately', () => {
    const items = [
      mk({ id: '1' }), // draft
      mk({ id: '2', image_url: 'https://x/a.jpg', attributes: { verified: true } }),
      mk({ id: '3', image_url: 'https://x/b.jpg' }), // has photo but not confirmed
      mk({ id: '4', image_url: 'https://x/c.jpg', attributes: { verified: true } }),
    ];
    expect(countVerified(items)).toEqual({ verified: 2, draft: 2 });
  });

  it('returns zeros for empty input', () => {
    expect(countVerified([])).toEqual({ verified: 0, draft: 0 });
  });
});
