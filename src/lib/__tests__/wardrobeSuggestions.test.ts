import { describe, expect, it } from 'vitest';
import {
  suggestFromClothingAnalysis,
  suggestionToPayload,
} from '../wardrobeSuggestions';

describe('suggestFromClothingAnalysis', () => {
  it('maps a complete valid response 1:1', () => {
    const out = suggestFromClothingAnalysis({
      category: 'top',
      color: 'Black',
      colorHex: '#000000',
      style: 'casual',
      seasons: ['summer', 'spring'],
      occasions: ['work', 'date-night'],
    });
    expect(out.category).toBe('top');
    expect(out.color).toBe('black');
    expect(out.colorHex).toBe('#000000');
    expect(out.seasons).toEqual(['summer', 'spring']);
    expect(out.occasions).toEqual(['work', 'date-night']);
  });

  it('falls back to "top" when category is invalid or missing', () => {
    expect(suggestFromClothingAnalysis({ category: 'hat' }).category).toBe('top');
    expect(suggestFromClothingAnalysis({}).category).toBe('top');
  });

  it('drops invalid seasons but keeps valid ones', () => {
    const out = suggestFromClothingAnalysis({
      seasons: ['summer', 'year-round', 'winter', 42],
    });
    expect(out.seasons).toEqual(['summer', 'winter']);
  });

  it('rejects malformed hex', () => {
    expect(suggestFromClothingAnalysis({ colorHex: 'blue' }).colorHex).toBeNull();
    expect(suggestFromClothingAnalysis({ colorHex: '#abc' }).colorHex).toBe('#abc');
    expect(suggestFromClothingAnalysis({ colorHex: '#A1B2C3' }).colorHex).toBe('#A1B2C3');
  });

  it('filters occasion entries down to non-empty strings', () => {
    const out = suggestFromClothingAnalysis({
      occasions: ['work', '', 1, 'gym'],
    });
    expect(out.occasions).toEqual(['work', 'gym']);
  });

  it('infers warmth=heavy when winter is among seasons', () => {
    expect(
      suggestFromClothingAnalysis({ seasons: ['winter'] }).warmth
    ).toBe('heavy');
  });

  it('infers warmth=medium when only fall is present', () => {
    expect(
      suggestFromClothingAnalysis({ seasons: ['fall'] }).warmth
    ).toBe('medium');
  });

  it('infers warmth=light when only summer is present', () => {
    expect(
      suggestFromClothingAnalysis({ seasons: ['summer'] }).warmth
    ).toBe('light');
  });

  it('falls back to style-based warmth when no season signal', () => {
    expect(
      suggestFromClothingAnalysis({ style: 'athleisure' }).warmth
    ).toBe('light');
    expect(
      suggestFromClothingAnalysis({ style: 'formal' }).warmth
    ).toBe('medium');
  });

  it('returns null warmth when no usable signal', () => {
    expect(suggestFromClothingAnalysis({}).warmth).toBeNull();
  });

  it('tolerates null/undefined input', () => {
    const out = suggestFromClothingAnalysis(null);
    expect(out.category).toBe('top');
    expect(out.seasons).toEqual([]);
  });
});

describe('suggestionToPayload', () => {
  const base = suggestFromClothingAnalysis({
    category: 'bottom',
    color: 'navy',
    seasons: ['winter'],
  });

  it('sets attributes.verified when verified=true', () => {
    const payload = suggestionToPayload(base, 'https://x/y.jpg', true);
    expect(payload.attributes).toEqual({ verified: true });
    expect(payload.imageUrl).toBe('https://x/y.jpg');
    expect(payload.category).toBe('bottom');
  });

  it('leaves attributes empty for drafts (verified=false)', () => {
    const payload = suggestionToPayload(base, null, false);
    expect(payload.attributes).toEqual({});
    expect(payload.imageUrl).toBeNull();
  });
});
