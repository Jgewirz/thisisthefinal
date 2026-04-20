import { describe, it, expect } from 'vitest';
import {
  buildBookingLinks,
  buildGoogleFlightsLink,
  buildKayakLink,
  buildSkyscannerLink,
  buildMomondoLink,
} from '../services/flightLinks.js';

describe('flight booking deep-link builders', () => {
  const base = {
    origin: 'jfk',
    destination: 'hnd',
    departDate: '2026-05-01',
    returnDate: '2026-05-10',
    adults: 2,
  };

  it('uppercases IATA codes on Google Flights and encodes adults', () => {
    const link = buildGoogleFlightsLink(base);
    expect(link.id).toBe('google');
    const decoded = decodeURIComponent(link.url.split('q=')[1]!);
    expect(decoded).toContain('Flights from JFK to HND on 2026-05-01');
    expect(decoded).toContain('through 2026-05-10');
    expect(decoded).toContain('2 adults');
  });

  it('builds a Kayak path with round-trip + adults segment', () => {
    const link = buildKayakLink(base);
    expect(link.id).toBe('kayak');
    expect(link.url).toBe(
      'https://www.kayak.com/flights/JFK-HND/2026-05-01/2026-05-10/2adults?sort=bestflight_a'
    );
  });

  it('omits the adults segment on Kayak for single adult', () => {
    const link = buildKayakLink({ ...base, adults: 1 });
    expect(link.url).toBe(
      'https://www.kayak.com/flights/JFK-HND/2026-05-01/2026-05-10?sort=bestflight_a'
    );
  });

  it('builds a Skyscanner URL with yymmdd dates and adultsv2', () => {
    const link = buildSkyscannerLink(base);
    expect(link.id).toBe('skyscanner');
    expect(link.url).toBe(
      'https://www.skyscanner.com/transport/flights/jfk/hnd/260501/260510/?adultsv2=2'
    );
  });

  it('one-way Skyscanner URL has a single date path segment', () => {
    const link = buildSkyscannerLink({
      origin: 'SFO',
      destination: 'LHR',
      departDate: '2026-06-01',
      adults: 1,
    });
    expect(link.url).toBe(
      'https://www.skyscanner.com/transport/flights/sfo/lhr/260601/?adultsv2=1'
    );
  });

  it('builds a Momondo URL with IATA/date/adults segments', () => {
    const link = buildMomondoLink(base);
    expect(link.id).toBe('momondo');
    expect(link.url).toBe(
      'https://www.momondo.com/flight-search/JFK-HND/2026-05-01/2026-05-10/2adults'
    );
  });

  it('buildBookingLinks returns all four providers in a stable order', () => {
    const links = buildBookingLinks(base);
    expect(links.map((l) => l.id)).toEqual(['google', 'kayak', 'skyscanner', 'momondo']);
    for (const l of links) expect(l.url).toMatch(/^https:\/\//);
  });
});
