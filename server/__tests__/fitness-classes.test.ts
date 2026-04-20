import { describe, expect, it, vi } from 'vitest';
import {
  activityToPlacesQuery,
  buildAggregatorLinks,
  buildClasspassLink,
  buildGoogleMapsLink,
  buildMindbodyLink,
  normalizeActivity,
  searchFitnessClasses,
  type FitnessClassSearchParams,
} from '../services/fitnessClasses.js';

const paris = { lat: 48.8566, lng: 2.3522 };

const base: FitnessClassSearchParams = {
  activity: 'YOGA',
  cityName: 'Paris',
  when: 'tomorrow 8am',
  location: paris,
};

describe('normalizeActivity', () => {
  it('maps common synonyms to canonical labels', () => {
    expect(normalizeActivity('Hot Yoga')).toBe('yoga');
    expect(normalizeActivity('Spin')).toBe('cycling');
    expect(normalizeActivity('kickboxing')).toBe('boxing');
    expect(normalizeActivity('HIIT bootcamp')).toBe('hiit');
    expect(normalizeActivity('Zumba dance')).toBe('dance');
    expect(normalizeActivity('CrossFit')).toBe('crossfit');
    expect(normalizeActivity('lifting')).toBe('gym');
    expect(normalizeActivity('')).toBe('fitness');
    expect(normalizeActivity('Parkour & free-run')).toBe('parkour free run');
  });
});

describe('activityToPlacesQuery', () => {
  it('adds "studio" suffix for class-style activities', () => {
    expect(activityToPlacesQuery('yoga')).toBe('yoga studio');
    expect(activityToPlacesQuery('pilates')).toBe('pilates studio');
  });
  it('uses activity-specific phrasing for non-class facilities', () => {
    expect(activityToPlacesQuery('gym')).toBe('gym');
    expect(activityToPlacesQuery('climbing')).toBe('climbing gym');
    expect(activityToPlacesQuery('swimming')).toBe('swimming pool');
    expect(activityToPlacesQuery('crossfit')).toBe('crossfit gym');
  });
});

describe('aggregator deep-links', () => {
  it('ClassPass link embeds activity + city', () => {
    const { url } = buildClasspassLink(base);
    expect(url).toMatch(/^https:\/\/classpass\.com\/search\?/);
    expect(url).toContain('q=yoga');
    expect(url).toContain('Paris');
  });

  it('Mindbody link embeds activity + city', () => {
    const { url } = buildMindbodyLink(base);
    expect(url).toMatch(/^https:\/\/explore\.mindbodyonline\.com\/search\?/);
    expect(url).toContain('search_text=yoga');
    expect(decodeURIComponent(url)).toContain('location=Paris');
  });

  it('Google Maps link embeds activity + city', () => {
    const { url } = buildGoogleMapsLink(base);
    expect(url).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?/);
    expect(url).toContain('api=1');
    expect(url).toContain('query=yoga');
    expect(url).toContain('Paris');
  });

  it('falls back to lat,lng when cityName is missing', () => {
    const links = buildAggregatorLinks({ ...base, cityName: undefined });
    for (const l of links) {
      expect(decodeURIComponent(l.url)).toContain('48.8566,2.3522');
    }
  });

  it('buildAggregatorLinks returns exactly 3 providers in stable order', () => {
    const links = buildAggregatorLinks(base);
    expect(links.map((l) => l.id)).toEqual(['classpass', 'mindbody', 'googlemaps']);
  });
});

describe('searchFitnessClasses', () => {
  it('queries Places with normalized activity + location and returns studios + links', async () => {
    const placesSpy = vi.fn(async () => [
      {
        id: 'p1',
        name: 'Paris Flow Yoga',
        address: '12 Rue',
        rating: 4.7,
        websiteUri: 'https://paris-flow.example',
      },
      { id: 'p2', name: 'Second Studio', address: '2 Rue' },
    ]);

    const result = await searchFitnessClasses(
      { ...base, activity: 'Hot Yoga', radiusMeters: 5000, maxStudios: 4 },
      { searchPlaces: placesSpy as any }
    );

    expect(placesSpy).toHaveBeenCalledTimes(1);
    expect(placesSpy).toHaveBeenCalledWith('yoga studio', {
      lat: paris.lat,
      lng: paris.lng,
      radiusMeters: 5000,
      maxResults: 4,
    });

    expect(result.activity).toBe('yoga');
    expect(result.studios).toHaveLength(2);
    expect(result.aggregatorLinks.map((l) => l.id)).toEqual([
      'classpass',
      'mindbody',
      'googlemaps',
    ]);
    expect(result.when).toBe('tomorrow 8am');
  });

  it('wraps Places errors with a descriptive prefix', async () => {
    const placesSpy = vi.fn(async () => {
      throw new Error('Places API 500: boom');
    });
    await expect(
      searchFitnessClasses(base, { searchPlaces: placesSpy as any })
    ).rejects.toThrow(/find_fitness_classes:.*Places API 500/);
  });

  it('clamps maxStudios to [1, 10]', async () => {
    const placesSpy = vi.fn(async () => []);
    await searchFitnessClasses(
      { ...base, maxStudios: 999 },
      { searchPlaces: placesSpy as any }
    );
    expect(placesSpy.mock.calls[0]![1].maxResults).toBe(10);

    await searchFitnessClasses(
      { ...base, maxStudios: -5 },
      { searchPlaces: placesSpy as any }
    );
    expect(placesSpy.mock.calls[1]![1].maxResults).toBe(1);
  });
});
