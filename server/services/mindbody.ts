// ── Mindbody Public API V6 Service ────────────────────────────────────
// Mirrors amadeus.ts pattern: auth caching, rate throttle, typed transforms

// ── Types ─────────────────────────────────────────────────────────────

export interface FitnessClassOffer {
  classId: number;
  className: string;
  classDescription: string;
  instructor: string;
  studioName: string;
  studioAddress: string;
  startDateTime: string;
  date: string;              // "Mar 6"
  time: string;              // "9:00 AM"
  duration: string;          // "60 min"
  spotsRemaining: number | null;
  maxCapacity: number;
  isAvailable: boolean;
  isCanceled: boolean;
  isWaitlistAvailable: boolean;
  difficulty: string | null;
  category: string;          // Yoga, Pilates, HIIT, etc.
  bookingStatus: 'available' | 'full' | 'waitlist' | 'canceled';
  siteId: string;
  studioLat: number | null;
  studioLng: number | null;
  distance: string | null;       // "1.2 mi" — computed if user location provided
}

export interface StudioLocation {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
}

export interface ClassSearchParams {
  classType?: string;
  startDate?: string;       // YYYY-MM-DD
  endDate?: string;         // YYYY-MM-DD
  timeOfDay?: 'morning' | 'afternoon' | 'evening';
  staffId?: number;
  locationId?: number;
  limit?: number;
  userLat?: number;         // user's latitude for distance calc
  userLng?: number;         // user's longitude for distance calc
}

// ── Rate throttle ─────────────────────────────────────────────────────

const REQUEST_WINDOW_MS = 1000;
const MAX_REQUESTS_PER_WINDOW = 5; // conservative for 1,000/day limit
let requestTimestamps: number[] = [];

async function throttle(): Promise<void> {
  const now = Date.now();
  requestTimestamps = requestTimestamps.filter((t) => now - t < REQUEST_WINDOW_MS);
  if (requestTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldest = requestTimestamps[0];
    const waitMs = REQUEST_WINDOW_MS - (now - oldest) + 10;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  requestTimestamps.push(Date.now());
}

// ── Configuration ─────────────────────────────────────────────────────

const BASE_URL = 'https://api.mindbodyonline.com/public/v6';

export function isMindbodyConfigured(): boolean {
  return !!(process.env.MINDBODY_API_KEY && process.env.MINDBODY_SITE_ID);
}

function getApiKey(): string {
  const key = process.env.MINDBODY_API_KEY;
  if (!key) throw new Error('MINDBODY_API_KEY is required');
  return key;
}

function getSiteId(): string {
  const id = process.env.MINDBODY_SITE_ID;
  if (!id) throw new Error('MINDBODY_SITE_ID is required');
  return id;
}

/** Public endpoints only need Api-Key + SiteId (no staff token required) */
function publicHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Api-Key': getApiKey(),
    'SiteId': getSiteId(),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

function formatTime(dateTimeStr: string): string {
  const date = new Date(dateTimeStr);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDate(dateTimeStr: string): string {
  const date = new Date(dateTimeStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function computeDuration(startStr: string, endStr: string): string {
  const start = new Date(startStr);
  const end = new Date(endStr);
  const diffMin = Math.round((end.getTime() - start.getTime()) / 60000);
  return `${diffMin} min`;
}

/** Best-effort category from class name / description */
function inferCategory(className: string, description: string): string {
  const text = `${className} ${description}`.toLowerCase();
  if (text.includes('yoga')) return 'Yoga';
  if (text.includes('pilates')) return 'Pilates';
  if (text.includes('hiit') || text.includes('high intensity')) return 'HIIT';
  if (text.includes('spin') || text.includes('cycling') || text.includes('cycle')) return 'Spinning';
  if (text.includes('barre')) return 'Barre';
  if (text.includes('box') || text.includes('kickbox')) return 'Boxing';
  if (text.includes('strength') || text.includes('weight') || text.includes('lift')) return 'Strength';
  if (text.includes('dance') || text.includes('zumba')) return 'Dance';
  if (text.includes('stretch') || text.includes('flexibility')) return 'Stretch';
  if (text.includes('meditation') || text.includes('mindful')) return 'Meditation';
  if (text.includes('cardio')) return 'Cardio';
  if (text.includes('boot camp') || text.includes('bootcamp')) return 'Boot Camp';
  return 'Fitness';
}

function deriveBookingStatus(cls: any): FitnessClassOffer['bookingStatus'] {
  if (cls.IsCanceled) return 'canceled';
  if (cls.IsAvailable === false) {
    return cls.IsWaitlistAvailable ? 'waitlist' : 'full';
  }
  return 'available';
}

/** Haversine distance in miles */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(miles: number): string {
  if (miles < 0.1) return '< 0.1 mi';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

function filterByTimeOfDay(classes: FitnessClassOffer[], timeOfDay?: string): FitnessClassOffer[] {
  if (!timeOfDay) return classes;
  return classes.filter((c) => {
    const hour = new Date(c.startDateTime).getHours();
    if (timeOfDay === 'morning') return hour >= 5 && hour < 12;
    if (timeOfDay === 'afternoon') return hour >= 12 && hour < 17;
    if (timeOfDay === 'evening') return hour >= 17 && hour < 23;
    return true;
  });
}

// ── Search Classes ────────────────────────────────────────────────────

export async function searchClasses(params: ClassSearchParams): Promise<FitnessClassOffer[]> {
  await throttle();

  const query = new URLSearchParams();
  if (params.startDate) query.set('StartDateTime', params.startDate);
  if (params.endDate) query.set('EndDateTime', params.endDate);
  if (params.staffId) query.set('StaffIds', String(params.staffId));
  if (params.locationId) query.set('LocationIds', String(params.locationId));
  query.set('Limit', String(params.limit || 20));

  const res = await fetch(`${BASE_URL}/class/classes?${query.toString()}`, {
    headers: publicHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mindbody class search failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const rawClasses = data.Classes || [];
  const siteId = getSiteId();

  let results: FitnessClassOffer[] = rawClasses.map((cls: any): FitnessClassOffer => {
    const className = cls.ClassDescription?.Name || cls.ClassName || 'Class';
    const description = cls.ClassDescription?.Description || '';
    const startDT = cls.StartDateTime || '';
    const endDT = cls.EndDateTime || '';
    const instructor = cls.Staff?.Name || 'TBD';
    const location = cls.Location || {};

    return {
      classId: cls.Id || cls.ClassId || 0,
      className,
      classDescription: description,
      instructor,
      studioName: location.Name || location.BusinessDescription || 'Studio',
      studioAddress: [location.Address, location.City, location.State]
        .filter(Boolean)
        .join(', '),
      startDateTime: startDT,
      date: startDT ? formatDate(startDT) : '',
      time: startDT ? formatTime(startDT) : '',
      duration: startDT && endDT ? computeDuration(startDT, endDT) : '60 min',
      spotsRemaining: cls.IsAvailable && cls.MaxCapacity && cls.TotalBooked != null
        ? Math.max(0, cls.MaxCapacity - cls.TotalBooked)
        : null,
      maxCapacity: cls.MaxCapacity || 0,
      isAvailable: cls.IsAvailable !== false,
      isCanceled: cls.IsCanceled === true,
      isWaitlistAvailable: cls.IsWaitlistAvailable === true,
      difficulty: cls.ClassDescription?.Level?.Name || null,
      category: inferCategory(className, description),
      bookingStatus: deriveBookingStatus(cls),
      siteId,
      studioLat: location.Latitude || null,
      studioLng: location.Longitude || null,
      distance: null, // computed below if user location provided
    };
  });

  // Compute distance from user and sort by proximity
  if (params.userLat != null && params.userLng != null) {
    for (const cls of results) {
      if (cls.studioLat != null && cls.studioLng != null) {
        const miles = haversineDistance(params.userLat, params.userLng, cls.studioLat, cls.studioLng);
        cls.distance = formatDistance(miles);
      }
    }
    // Sort by distance (nearest first)
    results.sort((a, b) => {
      if (!a.studioLat || !b.studioLat) return 0;
      const dA = haversineDistance(params.userLat!, params.userLng!, a.studioLat!, a.studioLng!);
      const dB = haversineDistance(params.userLat!, params.userLng!, b.studioLat!, b.studioLng!);
      return dA - dB;
    });
  }

  // Filter by class type if specified
  if (params.classType) {
    const target = params.classType.toLowerCase();
    results = results.filter((c) => c.category.toLowerCase() === target || c.className.toLowerCase().includes(target));
  }

  // Filter by time of day
  results = filterByTimeOfDay(results, params.timeOfDay);

  return results;
}

// ── Get Locations ─────────────────────────────────────────────────────

export async function getLocations(): Promise<StudioLocation[]> {
  await throttle();

  const res = await fetch(`${BASE_URL}/site/locations`, {
    headers: publicHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mindbody locations failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const locations = data.Locations || [];

  return locations.map((loc: any): StudioLocation => ({
    id: loc.Id,
    name: loc.Name || 'Studio',
    address: loc.Address || '',
    city: loc.City || '',
    state: loc.StateProvCode || '',
    postalCode: loc.PostalCode || '',
    phone: loc.Phone || '',
    latitude: loc.Latitude || null,
    longitude: loc.Longitude || null,
  }));
}
