import { describe, expect, it } from 'vitest';
import {
  buildAirbnbLink,
  buildBookingDotComLink,
  buildGoogleHotelsLink,
  buildHotelBookingLinks,
  buildHotelsDotComLink,
  type HotelSearchParams,
} from '../services/hotelLinks.js';

const base: HotelSearchParams = {
  cityCode: 'PAR',
  cityName: 'Paris',
  checkIn: '2026-05-01',
  checkOut: '2026-05-05',
  adults: 2,
  rooms: 1,
  currency: 'EUR',
};

describe('hotelLinks', () => {
  it('booking.com URL includes ss, checkin, checkout, group_adults, no_rooms', () => {
    const { url } = buildBookingDotComLink(base);
    expect(url).toContain('booking.com/searchresults.html');
    expect(url).toContain('ss=Paris');
    expect(url).toContain('checkin=2026-05-01');
    expect(url).toContain('checkout=2026-05-05');
    expect(url).toContain('group_adults=2');
    expect(url).toContain('no_rooms=1');
  });

  it('hotels.com URL uses destination, startDate, endDate, adults, rooms', () => {
    const { url } = buildHotelsDotComLink(base);
    expect(url).toContain('hotels.com/Hotel-Search');
    expect(url).toContain('destination=Paris');
    expect(url).toContain('startDate=2026-05-01');
    expect(url).toContain('endDate=2026-05-05');
    expect(url).toContain('adults=2');
    expect(url).toContain('rooms=1');
  });

  it('airbnb URL embeds city as slug', () => {
    const { url } = buildAirbnbLink(base);
    expect(url).toContain('airbnb.com/s/Paris/homes');
    expect(url).toContain('checkin=2026-05-01');
    expect(url).toContain('adults=2');
  });

  it('google hotels URL uses free-text query', () => {
    const { url } = buildGoogleHotelsLink(base);
    expect(url).toContain('google.com/travel/hotels?q=');
    expect(decodeURIComponent(url)).toContain('Hotels in Paris');
    expect(decodeURIComponent(url)).toContain('2026-05-01');
    expect(decodeURIComponent(url)).toContain('2026-05-05');
  });

  it('clamps absurd adults/rooms values', () => {
    const { url } = buildBookingDotComLink({ ...base, adults: 99, rooms: 50 });
    expect(url).toContain('group_adults=9');
    expect(url).toContain('no_rooms=9');
  });

  it('falls back to cityCode when cityName is missing', () => {
    const { url } = buildBookingDotComLink({ ...base, cityName: undefined });
    expect(url).toContain('ss=PAR');
  });

  it('buildHotelBookingLinks returns 4 providers in a stable order', () => {
    const links = buildHotelBookingLinks(base);
    expect(links.map((l) => l.id)).toEqual(['booking', 'hotels', 'airbnb', 'google']);
    expect(links.every((l) => l.url.startsWith('https://'))).toBe(true);
  });
});
