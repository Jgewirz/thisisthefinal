import { describe, expect, it } from 'vitest';
import { savedItemHref, savedItemTitle } from '../components/SavedDrawer';
import type { SavedItem } from '../../lib/savedApi';

const base: Omit<SavedItem, 'data' | 'kind' | 'external_id'> = {
  id: 'id',
  user_id: 'u',
  created_at: '2026-04-20T12:00:00Z',
};

describe('savedItemHref', () => {
  it('prefers an explicit bookingUrl', () => {
    const item: SavedItem = {
      ...base,
      kind: 'hotel',
      external_id: 'h1',
      data: { bookingUrl: 'https://booking.com/hotel/1', websiteUri: 'https://ignored' },
    };
    expect(savedItemHref(item)).toBe('https://booking.com/hotel/1');
  });

  it('falls back to websiteUri, then googleMapsUri', () => {
    const web: SavedItem = {
      ...base,
      kind: 'studio',
      external_id: 's1',
      data: { websiteUri: 'https://studio.example/site' },
    };
    expect(savedItemHref(web)).toBe('https://studio.example/site');

    const maps: SavedItem = {
      ...base,
      kind: 'studio',
      external_id: 's2',
      data: { googleMapsUri: 'https://maps.google.com/?cid=42' },
    };
    expect(savedItemHref(maps)).toBe('https://maps.google.com/?cid=42');
  });

  it('builds a Google Maps search when no direct link exists', () => {
    const item: SavedItem = {
      ...base,
      kind: 'place',
      external_id: 'p1',
      data: { name: 'Café Rose', address: '12 rue de Rivoli, Paris' },
    };
    const href = savedItemHref(item);
    expect(href.startsWith('https://www.google.com/maps/search/?api=1&query=')).toBe(true);
    expect(href).toContain(encodeURIComponent('Café Rose'));
  });
});

describe('savedItemTitle', () => {
  it('uses data.name when present', () => {
    const item: SavedItem = {
      ...base,
      kind: 'hotel',
      external_id: 'h',
      data: { name: 'Le Meurice' },
    };
    expect(savedItemTitle(item)).toBe('Le Meurice');
  });

  it('synthesises a flight title from price + currency', () => {
    const item: SavedItem = {
      ...base,
      kind: 'flight',
      external_id: 'ABC',
      data: { priceTotal: '450', currency: 'EUR' },
    };
    expect(savedItemTitle(item)).toBe('Flight 450 EUR');
  });

  it('falls back to kind + external_id when nothing else is known', () => {
    const item: SavedItem = {
      ...base,
      kind: 'place',
      external_id: 'xyz',
      data: {},
    };
    expect(savedItemTitle(item)).toBe('place xyz');
  });
});
