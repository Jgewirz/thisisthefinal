import { describe, it, expect } from 'vitest';
import {
  resolveCardProvenance,
  provenanceModeLabel,
} from '../cardProvenance';

describe('resolveCardProvenance — live provider cases', () => {
  it('attributes place / placesList to Google Places (live)', () => {
    expect(resolveCardProvenance('place', {})).toMatchObject({
      source: 'Google Places',
      mode: 'live',
    });
    expect(resolveCardProvenance('placesList', { places: [{}] })).toMatchObject({
      source: 'Google Places',
      mode: 'live',
    });
  });

  it('attributes single flight / hotel to Amadeus (live)', () => {
    expect(resolveCardProvenance('flight', {}).source).toBe('Amadeus');
    expect(resolveCardProvenance('flight', {}).mode).toBe('live');
    expect(resolveCardProvenance('hotel', {}).source).toBe('Amadeus');
    expect(resolveCardProvenance('hotel', {}).mode).toBe('live');
  });

  it('attributes flightList with offers to Amadeus live', () => {
    const p = resolveCardProvenance('flightList', {
      offers: [{ id: '1' }, { id: '2' }],
    });
    expect(p).toMatchObject({ source: 'Amadeus', mode: 'live' });
  });

  it('attributes hotelList with offers to Amadeus live', () => {
    const p = resolveCardProvenance('hotelList', { offers: [{ id: '1' }] });
    expect(p).toMatchObject({ source: 'Amadeus', mode: 'live' });
  });

  it('attributes classList with studios to Google Places live', () => {
    const p = resolveCardProvenance('classList', { studios: [{}, {}] });
    expect(p).toMatchObject({ source: 'Google Places', mode: 'live' });
  });
});

describe('resolveCardProvenance — fallback (links) cases', () => {
  it('flightList falls back to links when provider errors', () => {
    const p = resolveCardProvenance('flightList', {
      offers: [],
      providerError: 'Amadeus flight-offers 500',
    });
    expect(p.source).toBe('Amadeus');
    expect(p.mode).toBe('links');
    expect(p.detail).toContain('500');
  });

  it('flightList falls back to links when zero offers (no error)', () => {
    const p = resolveCardProvenance('flightList', { offers: [] });
    expect(p.mode).toBe('links');
    expect(p.detail).toMatch(/no live offers|booking links/i);
  });

  it('hotelList falls back to links on providerError', () => {
    const p = resolveCardProvenance('hotelList', {
      offers: [],
      providerError: 'hotels 401',
    });
    expect(p.mode).toBe('links');
    expect(p.detail).toContain('401');
  });

  it('hotelList falls back to links when empty', () => {
    const p = resolveCardProvenance('hotelList', { offers: [] });
    expect(p.mode).toBe('links');
  });

  it('classList falls back when zero studios', () => {
    const p = resolveCardProvenance('classList', { studios: [] });
    expect(p.source).toBe('Google Places');
    expect(p.mode).toBe('links');
  });

  it('classList falls back on providerError', () => {
    const p = resolveCardProvenance('classList', {
      studios: [],
      providerError: 'Places 429',
    });
    expect(p.mode).toBe('links');
    expect(p.detail).toContain('429');
  });
});

describe('resolveCardProvenance — internal sources', () => {
  it('outfit + colorSeason come from OpenAI Vision', () => {
    expect(resolveCardProvenance('outfit', {}).source).toBe('OpenAI Vision');
    expect(resolveCardProvenance('outfit', {}).mode).toBe('internal');
    expect(resolveCardProvenance('colorSeason', {}).source).toBe('OpenAI Vision');
  });

  it('reminder is saved-to-account (internal)', () => {
    const p = resolveCardProvenance('reminder', {});
    expect(p.mode).toBe('internal');
    expect(p.source.toLowerCase()).toContain('saved');
  });

  it('fitnessClass (legacy) attributes to Google Places live', () => {
    const p = resolveCardProvenance('fitnessClass', {});
    expect(p.source).toBe('Google Places');
    expect(p.mode).toBe('live');
  });
});

describe('provenanceModeLabel', () => {
  it('labels live / links explicitly', () => {
    expect(provenanceModeLabel('live')).toBe('Live');
    expect(provenanceModeLabel('links')).toBe('Links only');
  });

  it('internal has no suffix label', () => {
    expect(provenanceModeLabel('internal')).toBe('');
  });
});
