import { Router, Request, Response } from 'express';
import { getDb } from '../db/sqlite.js';

const router = Router();

// ── Static airport lookup: metro area → nearest IATA code ────────────
const METRO_AIRPORTS: Record<string, string> = {
  'New York': 'JFK', 'Los Angeles': 'LAX', 'Chicago': 'ORD', 'Houston': 'IAH',
  'Phoenix': 'PHX', 'Philadelphia': 'PHL', 'San Antonio': 'SAT', 'San Diego': 'SAN',
  'Dallas': 'DFW', 'Austin': 'AUS', 'Jacksonville': 'JAX', 'San Jose': 'SJC',
  'Fort Worth': 'DFW', 'Columbus': 'CMH', 'Charlotte': 'CLT', 'Indianapolis': 'IND',
  'San Francisco': 'SFO', 'Seattle': 'SEA', 'Denver': 'DEN', 'Nashville': 'BNA',
  'Oklahoma City': 'OKC', 'El Paso': 'ELP', 'Portland': 'PDX', 'Las Vegas': 'LAS',
  'Memphis': 'MEM', 'Louisville': 'SDF', 'Baltimore': 'BWI', 'Milwaukee': 'MKE',
  'Albuquerque': 'ABQ', 'Tucson': 'TUS', 'Fresno': 'FAT', 'Sacramento': 'SMF',
  'Mesa': 'PHX', 'Kansas City': 'MCI', 'Atlanta': 'ATL', 'Omaha': 'OMA',
  'Colorado Springs': 'COS', 'Raleigh': 'RDU', 'Miami': 'MIA', 'Tampa': 'TPA',
  'Orlando': 'MCO', 'Minneapolis': 'MSP', 'Cleveland': 'CLE', 'New Orleans': 'MSY',
  'Pittsburgh': 'PIT', 'St. Louis': 'STL', 'Cincinnati': 'CVG', 'Salt Lake City': 'SLC',
  'Detroit': 'DTW', 'Washington': 'DCA', 'Boston': 'BOS', 'Honolulu': 'HNL',
  'London': 'LHR', 'Paris': 'CDG', 'Tokyo': 'NRT', 'Dubai': 'DXB',
  'Sydney': 'SYD', 'Toronto': 'YYZ', 'Singapore': 'SIN', 'Hong Kong': 'HKG',
  'Mumbai': 'BOM', 'Bangkok': 'BKK', 'Seoul': 'ICN', 'Berlin': 'BER',
  'Rome': 'FCO', 'Madrid': 'MAD', 'Amsterdam': 'AMS', 'Mexico City': 'MEX',
};

function findNearestAirport(city: string, region: string): string | null {
  // Try exact city match
  if (METRO_AIRPORTS[city]) return METRO_AIRPORTS[city];

  // Try partial city match
  for (const [metro, iata] of Object.entries(METRO_AIRPORTS)) {
    if (city.toLowerCase().includes(metro.toLowerCase()) ||
        metro.toLowerCase().includes(city.toLowerCase())) {
      return iata;
    }
  }

  // Try region/state match for common US states
  const stateAirports: Record<string, string> = {
    'Hawaii': 'HNL', 'Alaska': 'ANC', 'Montana': 'BZN', 'Wyoming': 'JAC',
    'North Dakota': 'FAR', 'South Dakota': 'FSD', 'Idaho': 'BOI',
    'Vermont': 'BTV', 'Maine': 'PWM', 'New Hampshire': 'MHT',
    'West Virginia': 'CRW', 'Delaware': 'PHL', 'Rhode Island': 'PVD',
    'Connecticut': 'BDL', 'Arkansas': 'LIT', 'Mississippi': 'JAN',
    'Iowa': 'DSM', 'Nebraska': 'OMA', 'Kansas': 'MCI',
  };
  if (stateAirports[region]) return stateAirports[region];

  return null;
}

// ── Ensure user row exists ────────────────────────────────────────────
function ensureUser(userId: string) {
  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)').run(userId);
}

// ── GET /api/location — read stored location ─────────────────────────
router.get('/', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const db = getDb();
    const row = db.prepare(
      `SELECT location_lat, location_lng, location_city, location_region,
              location_country, location_timezone, location_nearest_airport,
              location_updated_at
       FROM users WHERE id = ?`
    ).get(userId) as any;

    if (!row || row.location_lat == null) {
      res.json({ location: null });
      return;
    }

    res.json({
      location: {
        lat: row.location_lat,
        lng: row.location_lng,
        city: row.location_city,
        region: row.location_region,
        country: row.location_country,
        timezone: row.location_timezone,
        nearestAirport: row.location_nearest_airport,
        updatedAt: row.location_updated_at,
      },
    });
  } catch (err: any) {
    console.error('Get location error:', err.message);
    res.status(500).json({ error: 'Failed to get location' });
  }
});

// ── POST /api/location — save/update location ───────────────────────
router.post('/', (req: Request, res: Response) => {
  const { lat, lng, city, region, country, timezone, nearestAirport } = req.body;

  if (lat == null || lng == null) {
    res.status(400).json({ error: 'lat and lng are required' });
    return;
  }

  try {
    const userId = (req as any).userId as string;
    ensureUser(userId);

    const db = getDb();
    db.prepare(
      `UPDATE users SET
        location_lat = ?, location_lng = ?, location_city = ?,
        location_region = ?, location_country = ?, location_timezone = ?,
        location_nearest_airport = ?, location_updated_at = datetime('now')
       WHERE id = ?`
    ).run(lat, lng, city || null, region || null, country || null, timezone || null, nearestAirport || null, userId);

    res.json({ success: true });
  } catch (err: any) {
    console.error('Save location error:', err.message);
    res.status(500).json({ error: 'Failed to save location' });
  }
});

// ── POST /api/location/reverse-geocode — coords → city/region/country
router.post('/reverse-geocode', async (req: Request, res: Response) => {
  const { lat, lng } = req.body;

  if (lat == null || lng == null) {
    res.status(400).json({ error: 'lat and lng are required' });
    return;
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  // If no Google API key, return just the airport lookup with empty city info
  if (!apiKey) {
    res.json({ city: null, region: null, country: null, nearestAirport: null });
    return;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&result_type=locality|administrative_area_level_1|country`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results?.length) {
      res.json({ city: null, region: null, country: null, nearestAirport: null });
      return;
    }

    let city: string | null = null;
    let region: string | null = null;
    let country: string | null = null;

    // Parse address components from the first result
    for (const result of data.results) {
      for (const component of result.address_components || []) {
        const types: string[] = component.types || [];
        if (types.includes('locality') && !city) {
          city = component.long_name;
        }
        if (types.includes('administrative_area_level_1') && !region) {
          region = component.short_name; // e.g. "TX" for Texas
        }
        if (types.includes('country') && !country) {
          country = component.short_name; // e.g. "US"
        }
      }
    }

    const nearestAirport = city && region ? findNearestAirport(city, region) : null;

    res.json({ city, region, country, nearestAirport });
  } catch (err: any) {
    console.error('Reverse geocode error:', err.message);
    // Graceful fallback — don't fail the whole location flow
    res.json({ city: null, region: null, country: null, nearestAirport: null });
  }
});

export default router;
