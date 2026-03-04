import Amadeus from 'amadeus';

// ── Supporting Types ──────────────────────────────────────────────────

export interface FlightSegment {
  flightNumber: string;
  departureAirport: string;
  departureTerminal?: string;
  departureTime: string;
  arrivalAirport: string;
  arrivalTerminal?: string;
  arrivalTime: string;
  duration: string;
  carrierCode: string;
  carrierName: string;
  operatingCarrierName?: string;
  aircraftCode?: string;
}

export interface LayoverInfo {
  airport: string;
  duration: string;
}

export interface BagAllowance {
  checkedBags: string;
  cabinBags: string;
}

export interface FlightAmenity {
  name: string;
  isChargeable: boolean;
}

// ── Main Types ────────────────────────────────────────────────────────

export interface FlightOffer {
  // Original 7 fields (backward compat)
  airline: string;
  departure: { city: string; time: string };
  arrival: { city: string; time: string };
  duration: string;
  stops: number;
  price: string;
  tier: 'Budget' | 'Balanced' | 'Premium';
  // Expanded fields
  flightNumber: string;
  departureDate: string;
  arrivalDate: string;
  departureTerminal?: string;
  arrivalTerminal?: string;
  isOvernight: boolean;
  baseFare: string;
  taxes: string;
  rawPrice: number;
  cabinClass: string;
  bags: BagAllowance;
  seatsRemaining: number | null;
  lastTicketingDate?: string;
  amenities: FlightAmenity[];
  segments: FlightSegment[];
  layovers: LayoverInfo[];
  returnTrip: {
    departure: { city: string; time: string };
    arrival: { city: string; time: string };
    duration: string;
    stops: number;
    departureDate: string;
    arrivalDate: string;
    departureTerminal?: string;
    arrivalTerminal?: string;
    isOvernight: boolean;
    segments: FlightSegment[];
    layovers: LayoverInfo[];
  } | null;
  validatingAirlineCode: string;
  bookingUrl: string;
}

export interface CheapestDateResult {
  departureDate: string;
  returnDate?: string;
  price: string;
  rawPrice: number;
}

export interface HotelOffer {
  name: string;
  rating: number;
  address: string;
  pricePerNight: string;
  totalPrice: string;
  checkIn: string;
  checkOut: string;
  amenities: string[];
  bookingUrl?: string;
}

export interface POI {
  name: string;
  category: string;
  address: string;
  rating?: number;
  description?: string;
}

export interface LocationResult {
  iataCode: string;
  name: string;
  cityName: string;
  countryCode: string;
}

export interface FlightSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults?: number;
  cabinClass?: string;
  currency?: string;
  nonStop?: boolean;
  maxResults?: number;
  maxPrice?: number;
  includedAirlineCodes?: string[];
  excludedAirlineCodes?: string[];
}

export interface HotelSearchParams {
  cityCode: string;
  checkIn: string;
  checkOut: string;
  adults?: number;
  currency?: string;
  maxResults?: number;
}

export interface POISearchParams {
  latitude: number;
  longitude: number;
  radius?: number;
  categories?: string[];
}

// ── Rate throttle ──────────────────────────────────────────────────────

const REQUEST_WINDOW_MS = 1000;
const MAX_REQUESTS_PER_WINDOW = 8; // under Amadeus test limit of 10/sec
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

// ── SDK initialization ─────────────────────────────────────────────────

let amadeus: Amadeus | null = null;

function getClient(): Amadeus {
  if (!amadeus) {
    const clientId = process.env.AMADEUS_CLIENT_ID;
    const clientSecret = process.env.AMADEUS_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET are required');
    }

    amadeus = new Amadeus({
      clientId,
      clientSecret,
      hostname: (process.env.AMADEUS_HOSTNAME as 'test' | 'production') || 'test',
    });
  }
  return amadeus;
}

export function isAmadeusConfigured(): boolean {
  return !!(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET);
}

// ── Transformers ───────────────────────────────────────────────────────

const CABIN_TO_TIER: Record<string, FlightOffer['tier']> = {
  ECONOMY: 'Budget',
  PREMIUM_ECONOMY: 'Balanced',
  BUSINESS: 'Balanced',
  FIRST: 'Premium',
};

const AIRLINE_NAMES: Record<string, string> = {
  AA: 'American Airlines', DL: 'Delta Air Lines', UA: 'United Airlines',
  WN: 'Southwest Airlines', B6: 'JetBlue Airways', AS: 'Alaska Airlines',
  NK: 'Spirit Airlines', F9: 'Frontier Airlines', G4: 'Allegiant Air',
  HA: 'Hawaiian Airlines', SY: 'Sun Country Airlines',
  BA: 'British Airways', LH: 'Lufthansa', AF: 'Air France',
  KL: 'KLM', IB: 'Iberia', AZ: 'ITA Airways', SK: 'SAS',
  AY: 'Finnair', TP: 'TAP Portugal', LX: 'Swiss International',
  OS: 'Austrian Airlines', SN: 'Brussels Airlines', EI: 'Aer Lingus',
  U2: 'easyJet', FR: 'Ryanair', W6: 'Wizz Air', VY: 'Vueling',
  EK: 'Emirates', QR: 'Qatar Airways', EY: 'Etihad Airways',
  TK: 'Turkish Airlines', SV: 'Saudia', GF: 'Gulf Air',
  WY: 'Oman Air', KU: 'Kuwait Airways',
  NH: 'ANA (All Nippon)', JL: 'Japan Airlines', KE: 'Korean Air',
  OZ: 'Asiana Airlines', SQ: 'Singapore Airlines', CX: 'Cathay Pacific',
  TG: 'Thai Airways', MH: 'Malaysia Airlines', GA: 'Garuda Indonesia',
  BR: 'EVA Air', CI: 'China Airlines', PR: 'Philippine Airlines',
  QF: 'Qantas', NZ: 'Air New Zealand', VA: 'Virgin Australia',
  FJ: 'Fiji Airways',
  AC: 'Air Canada', WS: 'WestJet', AM: 'Aeromexico',
  CM: 'Copa Airlines', AV: 'Avianca', LA: 'LATAM Airlines',
  VS: 'Virgin Atlantic', DY: 'Norwegian', FI: 'Icelandair',
  AI: 'Air India', '6E': 'IndiGo', SG: 'SpiceJet',
  CA: 'Air China', CZ: 'China Southern', MU: 'China Eastern',
  HU: 'Hainan Airlines', '3U': 'Sichuan Airlines',
  ET: 'Ethiopian Airlines', SA: 'South African Airways',
  MS: 'EgyptAir', RJ: 'Royal Jordanian', ME: 'Middle East Airlines',
};

const AIRCRAFT_NAMES: Record<string, string> = {
  '318': 'Airbus A318', '319': 'Airbus A319', '320': 'Airbus A320', '321': 'Airbus A321',
  '32N': 'Airbus A321neo', '32Q': 'Airbus A321neo', '333': 'Airbus A330-300',
  '332': 'Airbus A330-200', '339': 'Airbus A330-900neo', '340': 'Airbus A340',
  '346': 'Airbus A340-600', '350': 'Airbus A350', '359': 'Airbus A350-900',
  '388': 'Airbus A380', '738': 'Boeing 737-800', '73H': 'Boeing 737-800',
  '7M8': 'Boeing 737 MAX 8', '7M9': 'Boeing 737 MAX 9', '744': 'Boeing 747-400',
  '763': 'Boeing 767-300', '764': 'Boeing 767-400', '772': 'Boeing 777-200',
  '77W': 'Boeing 777-300ER', '773': 'Boeing 777-300', '789': 'Boeing 787-9',
  '788': 'Boeing 787-8', '78J': 'Boeing 787-9',
  'E75': 'Embraer E175', 'E90': 'Embraer E190', 'E95': 'Embraer E195',
  'CR9': 'Bombardier CRJ-900', 'CRJ': 'Bombardier CRJ',
};

function resolveAirlineName(code: string): string {
  return AIRLINE_NAMES[code] || code;
}

function resolveAircraftName(code: string): string | undefined {
  if (!code) return undefined;
  return AIRCRAFT_NAMES[code] || code;
}

function parseIsoDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return iso;
  const hours = match[1] ? `${match[1]}h` : '';
  const minutes = match[2] ? ` ${match[2]}m` : '';
  return `${hours}${minutes}`.trim();
}

function parseIsoDurationMinutes(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return 0;
  return (parseInt(match[1] || '0', 10) * 60) + parseInt(match[2] || '0', 10);
}

function formatPrice(amount: string, currency: string): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return `${currency} ${amount}`;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

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

function getDatePart(dateTimeStr: string): string {
  return dateTimeStr.split('T')[0];
}

function computeLayovers(segments: FlightSegment[]): LayoverInfo[] {
  const layovers: LayoverInfo[] = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const arrival = new Date(segments[i].arrivalTime);
    const departure = new Date(segments[i + 1].departureTime);
    const diffMs = departure.getTime() - arrival.getTime();
    const diffMin = Math.round(diffMs / 60000);
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    const duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    layovers.push({
      airport: segments[i].arrivalAirport,
      duration,
    });
  }
  return layovers;
}

function buildSegments(rawSegments: any[]): FlightSegment[] {
  return rawSegments.map((seg: any): FlightSegment => {
    const carrierCode = seg.carrierCode || '';
    const operatingCode = seg.operating?.carrierCode;
    const operatingName = operatingCode && operatingCode !== carrierCode
      ? resolveAirlineName(operatingCode)
      : undefined;

    return {
      flightNumber: `${carrierCode} ${seg.number || ''}`.trim(),
      departureAirport: seg.departure?.iataCode || '',
      departureTerminal: seg.departure?.terminal || undefined,
      departureTime: seg.departure?.at || '',
      arrivalAirport: seg.arrival?.iataCode || '',
      arrivalTerminal: seg.arrival?.terminal || undefined,
      arrivalTime: seg.arrival?.at || '',
      duration: parseIsoDuration(seg.duration || ''),
      carrierCode,
      carrierName: resolveAirlineName(carrierCode),
      operatingCarrierName: operatingName,
      aircraftCode: resolveAircraftName(seg.aircraft?.code || ''),
    };
  });
}

function extractBags(fareDetail: any): BagAllowance {
  const checked = fareDetail?.includedCheckedBags;
  const cabin = fareDetail?.includedCabinBags;

  let checkedStr = 'No checked bags';
  if (checked) {
    if (checked.quantity != null && checked.quantity > 0) {
      checkedStr = `${checked.quantity} bag${checked.quantity > 1 ? 's' : ''}`;
      if (checked.weight) checkedStr += `, ${checked.weight}${checked.weightUnit || 'kg'}`;
    } else if (checked.weight) {
      checkedStr = `1 bag, ${checked.weight}${checked.weightUnit || 'kg'}`;
    }
  }

  let cabinStr = '1 carry-on';
  if (cabin?.quantity != null) {
    cabinStr = `${cabin.quantity} carry-on${cabin.quantity !== 1 ? 's' : ''}`;
  }

  return { checkedBags: checkedStr, cabinBags: cabinStr };
}

function extractAmenities(fareDetail: any): FlightAmenity[] {
  const raw = fareDetail?.amenities;
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 6).map((a: any): FlightAmenity => ({
    name: (a.description || a.amenityType || 'Unknown')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c: string) => c.toUpperCase()),
    isChargeable: a.isChargeable === true,
  }));
}

function buildItineraryData(itinerary: any, fareDetails: any[], fallbackOrigin: string, fallbackDest: string) {
  const rawSegments = itinerary?.segments || [];
  const segments = buildSegments(rawSegments);
  const layovers = computeLayovers(segments);
  const firstSeg = segments[0];
  const lastSeg = segments[segments.length - 1];
  const firstRaw = rawSegments[0];
  const lastRaw = rawSegments[rawSegments.length - 1];

  const depDate = firstRaw?.departure?.at ? getDatePart(firstRaw.departure.at) : '';
  const arrDate = lastRaw?.arrival?.at ? getDatePart(lastRaw.arrival.at) : '';

  return {
    departure: {
      city: firstSeg?.departureAirport || fallbackOrigin,
      time: firstRaw?.departure?.at ? formatTime(firstRaw.departure.at) : '',
    },
    arrival: {
      city: lastSeg?.arrivalAirport || fallbackDest,
      time: lastRaw?.arrival?.at ? formatTime(lastRaw.arrival.at) : '',
    },
    duration: parseIsoDuration(itinerary?.duration || ''),
    stops: Math.max(0, rawSegments.length - 1),
    departureDate: depDate,
    arrivalDate: arrDate,
    departureTerminal: firstRaw?.departure?.terminal || undefined,
    arrivalTerminal: lastRaw?.arrival?.terminal || undefined,
    isOvernight: depDate !== arrDate,
    segments,
    layovers,
  };
}

// ── Booking URL builder ─────────────────────────────────────────────────

function buildBookingUrl(origin: string, destination: string, departureDate: string, returnDate?: string): string {
  // Google Flights search URL
  const base = `https://www.google.com/travel/flights?q=flights+from+${origin}+to+${destination}+on+${departureDate}`;
  if (returnDate) {
    return `${base}+return+${returnDate}`;
  }
  return base;
}

// ── Flight search ──────────────────────────────────────────────────────

export async function searchFlights(params: FlightSearchParams): Promise<FlightOffer[]> {
  await throttle();
  const client = getClient();

  const searchParams: any = {
    originLocationCode: params.origin,
    destinationLocationCode: params.destination,
    departureDate: params.departureDate,
    adults: params.adults || 1,
    max: params.maxResults || 5,
    currencyCode: params.currency || 'USD',
  };

  if (params.returnDate) {
    searchParams.returnDate = params.returnDate;
  }
  if (params.cabinClass) {
    searchParams.travelClass = params.cabinClass;
  }
  if (params.nonStop) {
    searchParams.nonStop = true;
  }
  if (params.maxPrice) {
    searchParams.maxPrice = params.maxPrice;
  }
  if (params.includedAirlineCodes?.length) {
    searchParams.includedAirlineCodes = params.includedAirlineCodes.join(',');
  }
  if (params.excludedAirlineCodes?.length) {
    searchParams.excludedAirlineCodes = params.excludedAirlineCodes.join(',');
  }

  const response = await client.shopping.flightOffersSearch.get(searchParams);
  const offers = response.data || [];

  return offers.map((offer: any): FlightOffer => {
    const outbound = offer.itineraries?.[0];
    const returnItinerary = offer.itineraries?.[1] || null;

    // Fare details from first traveler
    const fareDetails = offer.travelerPricings?.[0]?.fareDetailsBySegment || [];
    const firstFareDetail = fareDetails[0];
    const cabin = firstFareDetail?.cabin || 'ECONOMY';
    const airlineCode = offer.validatingAirlineCodes?.[0] || outbound?.segments?.[0]?.carrierCode || '';

    // Build outbound itinerary
    const outboundData = buildItineraryData(outbound, fareDetails, params.origin, params.destination);

    // Build return trip if present
    let returnTrip: FlightOffer['returnTrip'] = null;
    if (returnItinerary) {
      const returnData = buildItineraryData(returnItinerary, fareDetails, params.destination, params.origin);
      returnTrip = {
        departure: returnData.departure,
        arrival: returnData.arrival,
        duration: returnData.duration,
        stops: returnData.stops,
        departureDate: returnData.departureDate,
        arrivalDate: returnData.arrivalDate,
        departureTerminal: returnData.departureTerminal,
        arrivalTerminal: returnData.arrivalTerminal,
        isOvernight: returnData.isOvernight,
        segments: returnData.segments,
        layovers: returnData.layovers,
      };
    }

    // Price breakdown
    const totalStr = offer.price?.total || '0';
    const baseStr = offer.price?.base || totalStr;
    const currency = offer.price?.currency || 'USD';
    const totalNum = parseFloat(totalStr);
    const baseNum = parseFloat(baseStr);
    const taxesNum = totalNum - baseNum;

    // Flight number from first segment
    const firstSeg = outbound?.segments?.[0];
    const flightNum = firstSeg ? `${firstSeg.carrierCode || ''} ${firstSeg.number || ''}`.trim() : '';

    return {
      // Original 7 fields
      airline: resolveAirlineName(airlineCode),
      departure: outboundData.departure,
      arrival: outboundData.arrival,
      duration: outboundData.duration,
      stops: outboundData.stops,
      price: formatPrice(totalStr, currency),
      tier: CABIN_TO_TIER[cabin] || 'Budget',
      // Expanded fields
      flightNumber: flightNum,
      departureDate: outboundData.departureDate,
      arrivalDate: outboundData.arrivalDate,
      departureTerminal: outboundData.departureTerminal,
      arrivalTerminal: outboundData.arrivalTerminal,
      isOvernight: outboundData.isOvernight,
      baseFare: formatPrice(baseStr, currency),
      taxes: formatPrice(String(Math.max(0, taxesNum)), currency),
      rawPrice: totalNum,
      cabinClass: cabin,
      bags: extractBags(firstFareDetail),
      seatsRemaining: offer.numberOfBookableSeats ?? null,
      lastTicketingDate: offer.lastTicketingDate || undefined,
      amenities: extractAmenities(firstFareDetail),
      segments: outboundData.segments,
      layovers: outboundData.layovers,
      returnTrip,
      validatingAirlineCode: airlineCode,
      bookingUrl: buildBookingUrl(
        params.origin,
        params.destination,
        outboundData.departureDate,
        returnTrip?.departureDate
      ),
    };
  });
}

// ── Cheapest dates search ──────────────────────────────────────────────

export async function searchCheapestDates(params: {
  origin: string;
  destination: string;
  departureDate?: string;
}): Promise<CheapestDateResult[]> {
  await throttle();
  const client = getClient();

  const searchParams: any = {
    origin: params.origin,
    destination: params.destination,
  };

  if (params.departureDate) {
    searchParams.departureDate = params.departureDate;
  }

  try {
    const response = await (client as any).shopping.flightDates.get(searchParams);
    const results = response.data || [];

    return results.slice(0, 10).map((r: any): CheapestDateResult => ({
      departureDate: r.departureDate,
      returnDate: r.returnDate || undefined,
      price: formatPrice(r.price?.total || '0', r.price?.currency || 'USD'),
      rawPrice: parseFloat(r.price?.total || '0'),
    }));
  } catch (err: any) {
    // flightDates may not be available in test sandbox — return empty
    console.warn('Cheapest dates search failed (may not be available in test mode):', err.message);
    return [];
  }
}

// ── Hotel search (two-step: city→hotels, then hotel→offers) ────────────

export async function searchHotels(params: HotelSearchParams): Promise<HotelOffer[]> {
  await throttle();
  const client = getClient();

  // Step 1: Find hotels in the city
  const hotelsResponse = await client.referenceData.locations.hotels.byCity.get({
    cityCode: params.cityCode,
  });

  const hotelIds = (hotelsResponse.data || [])
    .slice(0, params.maxResults || 5)
    .map((h: any) => h.hotelId)
    .filter(Boolean);

  if (hotelIds.length === 0) return [];

  // Step 2: Get offers for those hotels
  await throttle();
  const offersResponse = await client.shopping.hotelOffersSearch.get({
    hotelIds: hotelIds.join(','),
    checkInDate: params.checkIn,
    checkOutDate: params.checkOut,
    adults: params.adults || 1,
    currency: params.currency || 'USD',
  });

  const offers = offersResponse.data || [];

  return offers.map((hotel: any): HotelOffer => {
    const offer = hotel.offers?.[0];
    const price = offer?.price;
    const totalNum = parseFloat(price?.total || '0');
    const nights = Math.max(1, Math.ceil(
      (new Date(params.checkOut).getTime() - new Date(params.checkIn).getTime()) / (1000 * 60 * 60 * 24)
    ));

    return {
      name: hotel.hotel?.name || 'Hotel',
      rating: hotel.hotel?.rating ? parseInt(hotel.hotel.rating, 10) : 0,
      address: [hotel.hotel?.address?.lines?.[0], hotel.hotel?.address?.cityName]
        .filter(Boolean)
        .join(', ') || '',
      pricePerNight: formatPrice(String(Math.round(totalNum / nights)), price?.currency || 'USD'),
      totalPrice: formatPrice(price?.total || '0', price?.currency || 'USD'),
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      amenities: (hotel.hotel?.amenities || []).slice(0, 6).map((a: string) =>
        a.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())
      ),
    };
  });
}

// ── Points of Interest search ──────────────────────────────────────────

export async function searchPOIs(params: POISearchParams): Promise<POI[]> {
  await throttle();
  const client = getClient();

  const searchParams: any = {
    latitude: params.latitude,
    longitude: params.longitude,
    radius: params.radius || 5,
  };

  if (params.categories?.length) {
    searchParams.categories = params.categories;
  }

  const response = await client.referenceData.locations.pointsOfInterest.get(searchParams);
  const pois = response.data || [];

  return pois.slice(0, 6).map((poi: any): POI => ({
    name: poi.name || 'Unknown',
    category: (poi.category || 'SIGHTS')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c: string) => c.toUpperCase()),
    address: poi.address?.streetAddress || '',
    rating: poi.rank ? Math.min(5, Math.round(poi.rank / 2)) : undefined,
  }));
}

// ── Location autocomplete ──────────────────────────────────────────────

export async function autocompleteLocation(keyword: string): Promise<LocationResult[]> {
  await throttle();
  const client = getClient();

  const response = await client.referenceData.locations.get({
    keyword,
    subType: 'CITY,AIRPORT' as any,
  });

  return (response.data || []).slice(0, 10).map((loc: any): LocationResult => ({
    iataCode: loc.iataCode || '',
    name: loc.name || '',
    cityName: loc.address?.cityName || loc.name || '',
    countryCode: loc.address?.countryCode || '',
  }));
}
