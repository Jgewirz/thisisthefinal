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

export interface RoomOffer {
  roomType?: string;
  bedType?: string;
  roomDescription?: string;
  boardType?: string;
  cancellation?: {
    type: 'FREE' | 'PARTIAL' | 'NON_REFUNDABLE';
    deadline?: string;
    fee?: string;
  };
  paymentType?: string;
  pricePerNight: string;
  totalPrice: string;
  basePricePerNight?: string;
  taxes?: string;
  /** Raw per-night number for sorting/filtering on the frontend */
  rawPerNight: number;
}

export interface HotelOffer {
  name: string;
  rating: number;
  address: string;
  /** Cheapest per-night price across all room offers */
  pricePerNight: string;
  totalPrice: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  amenities: string[];
  bookingUrl?: string;
  // Featured (cheapest) room details — kept for backward compat
  roomType?: string;
  bedType?: string;
  roomDescription?: string;
  boardType?: string;
  cancellation?: {
    type: 'FREE' | 'PARTIAL' | 'NON_REFUNDABLE';
    deadline?: string;
    fee?: string;
  };
  paymentType?: string;
  basePricePerNight?: string;
  taxes?: string;
  cityCode?: string;
  // All available room/rate options for this hotel
  roomOffers?: RoomOffer[];
  // Amadeus geo/identity fields
  hotelId?: string;
  latitude?: number;
  longitude?: number;
  chainCode?: string;
  // Google Places enrichment fields
  photoUrl?: string | null;
  userRating?: number | null;
  reviewCount?: number | null;
  editorialSummary?: string | null;
  googleMapsUrl?: string | null;
  phone?: string | null;
  website?: string | null;
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
  priceMin?: number | null;
  priceMax?: number | null;
  ratings?: number[] | null;
  boardType?: string | null;
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

    const hostname = (process.env.AMADEUS_HOSTNAME as 'test' | 'production') || 'test';
    console.log(`[amadeus] Initializing with ${hostname} environment`);
    if (hostname === 'test') {
      console.warn('[amadeus] Using TEST environment — flight/hotel inventory is limited. Set AMADEUS_HOSTNAME=production for full data.');
    }

    amadeus = new Amadeus({
      clientId,
      clientSecret,
      hostname,
    });
  }
  return amadeus;
}

export function isAmadeusTestMode(): boolean {
  return (process.env.AMADEUS_HOSTNAME || 'test') === 'test';
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

// ── Booking URL builders ────────────────────────────────────────────────

function buildBookingUrl(origin: string, destination: string, departureDate: string, returnDate?: string): string {
  // Google Flights search URL
  const base = `https://www.google.com/travel/flights?q=flights+from+${origin}+to+${destination}+on+${departureDate}`;
  if (returnDate) {
    return `${base}+return+${returnDate}`;
  }
  return base;
}

function buildHotelBookingUrl(name: string, cityCode: string, checkIn: string, checkOut: string): string {
  const q = encodeURIComponent(`${name} ${cityCode}`);
  return `https://www.google.com/travel/hotels?q=${q}&dates=${checkIn},${checkOut}`;
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

  // Step 1: Find hotels in the city — pass rating filter if available
  const cityQuery: Record<string, any> = {
    cityCode: params.cityCode,
  };
  if (params.ratings?.length) {
    cityQuery.ratings = params.ratings.join(',');
  }

  const hotelsResponse = await client.referenceData.locations.hotels.byCity.get(cityQuery);

  // Fetch more candidates when we have price filters — we'll narrow down after pricing
  const candidateCount = (params.priceMin || params.priceMax) ? 15 : (params.maxResults || 5);
  const hotelCandidates = (hotelsResponse.data || []).slice(0, candidateCount);
  const hotelIds = hotelCandidates
    .map((h: any) => h.hotelId)
    .filter(Boolean);

  // Build a lookup of geo/identity data from Step 1 for later enrichment
  const hotelMeta = new Map<string, { lat?: number; lng?: number; chainCode?: string }>();
  for (const h of hotelCandidates) {
    if (h.hotelId) {
      hotelMeta.set(h.hotelId, {
        lat: h.geoCode?.latitude ?? h.latitude,
        lng: h.geoCode?.longitude ?? h.longitude,
        chainCode: h.chainCode,
      });
    }
  }

  if (hotelIds.length === 0) return [];

  // Step 2: Get offers — pass price range to Amadeus if available
  await throttle();
  const offersQuery: Record<string, any> = {
    hotelIds: hotelIds.join(','),
    checkInDate: params.checkIn,
    checkOutDate: params.checkOut,
    adults: params.adults || 1,
    currency: params.currency || 'USD',
  };
  if (params.priceMin != null && params.priceMax != null) {
    offersQuery.priceRange = `${params.priceMin}-${params.priceMax}`;
  } else if (params.priceMax != null) {
    offersQuery.priceRange = `0-${params.priceMax}`;
  }
  if (params.boardType) {
    offersQuery.boardType = params.boardType;
  }

  const offersResponse = await client.shopping.hotelOffersSearch.get(offersQuery);

  const offers = offersResponse.data || [];
  const nights = Math.max(1, Math.ceil(
    (new Date(params.checkOut).getTime() - new Date(params.checkIn).getTime()) / (1000 * 60 * 60 * 24)
  ));

  let mapped = offers.map((hotel: any): HotelOffer & { _rawPerNight: number } => {
    const allOffers: any[] = hotel.offers || [];
    const hotelName = hotel.hotel?.name || 'Hotel';

    // Parse every offer into a RoomOffer
    const roomOffers: RoomOffer[] = allOffers.map((offer: any) => {
      const price = offer?.price;
      const totalNum = parseFloat(price?.total || '0');
      const currency = price?.currency || 'USD';

      const roomEst = offer?.room?.typeEstimated;
      const roomCategory = roomEst?.category
        ? roomEst.category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())
        : undefined;
      const bedCount = roomEst?.beds || 1;
      const bedKind = roomEst?.bedType
        ? roomEst.bedType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())
        : undefined;
      const bedType = bedKind ? `${bedCount} ${bedKind} Bed${bedCount > 1 ? 's' : ''}` : undefined;
      const roomDescription = offer?.room?.description?.text || undefined;

      const rawBoard = offer?.boardType;
      const boardType = rawBoard
        ? rawBoard.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())
        : undefined;

      const rawCancel = offer?.policies?.cancellation;
      let cancellation: RoomOffer['cancellation'] = undefined;
      if (rawCancel) {
        const cancelType = rawCancel.type === 'FULL_STAY' ? 'NON_REFUNDABLE' as const
          : rawCancel.amount ? 'PARTIAL' as const
          : 'FREE' as const;
        cancellation = {
          type: cancelType,
          deadline: rawCancel.deadline || undefined,
          fee: rawCancel.amount ? formatPrice(rawCancel.amount, currency) : undefined,
        };
      }

      const paymentType = offer?.policies?.paymentType
        ? offer.policies.paymentType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())
        : undefined;

      const taxesArr = price?.taxes || [];
      const taxTotal = taxesArr.reduce((sum: number, t: any) => sum + parseFloat(t.amount || '0'), 0);
      const baseNum = totalNum - taxTotal;
      const perNight = Math.round(totalNum / nights);

      return {
        roomType: roomCategory,
        bedType,
        roomDescription,
        boardType,
        cancellation,
        paymentType,
        pricePerNight: formatPrice(String(perNight), currency),
        totalPrice: formatPrice(price?.total || '0', currency),
        basePricePerNight: taxTotal > 0 ? formatPrice(String(Math.round(baseNum / nights)), currency) : undefined,
        taxes: taxTotal > 0 ? formatPrice(String(Math.round(taxTotal)), currency) : undefined,
        rawPerNight: perNight,
      };
    });

    // Sort room offers by price and deduplicate by room type + price
    roomOffers.sort((a, b) => a.rawPerNight - b.rawPerNight);
    const seen = new Set<string>();
    const uniqueOffers = roomOffers.filter((ro) => {
      const key = `${ro.roomType || ''}|${ro.rawPerNight}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // The cheapest offer is the featured/headline offer
    const cheapest = uniqueOffers[0] || roomOffers[0];
    const cheapestPerNight = cheapest?.rawPerNight ?? 0;

    return {
      name: hotelName,
      rating: hotel.hotel?.rating ? parseInt(hotel.hotel.rating, 10) : 0,
      address: [hotel.hotel?.address?.lines?.[0], hotel.hotel?.address?.cityName]
        .filter(Boolean)
        .join(', ') || '',
      pricePerNight: cheapest?.pricePerNight || '$0',
      totalPrice: cheapest?.totalPrice || '$0',
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      nights,
      amenities: (hotel.hotel?.amenities || []).slice(0, 8).map((a: string) =>
        a.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())
      ),
      bookingUrl: buildHotelBookingUrl(hotelName, params.cityCode, params.checkIn, params.checkOut),
      // Featured room details (cheapest offer)
      roomType: cheapest?.roomType,
      bedType: cheapest?.bedType,
      roomDescription: cheapest?.roomDescription,
      boardType: cheapest?.boardType,
      cancellation: cheapest?.cancellation,
      paymentType: cheapest?.paymentType,
      basePricePerNight: cheapest?.basePricePerNight,
      taxes: cheapest?.taxes,
      cityCode: params.cityCode,
      // All room/rate options (up to 6 distinct options)
      roomOffers: uniqueOffers.slice(0, 6),
      // Amadeus identity/geo fields for enrichment
      hotelId: hotel.hotel?.hotelId || undefined,
      latitude: hotelMeta.get(hotel.hotel?.hotelId)?.lat ?? undefined,
      longitude: hotelMeta.get(hotel.hotel?.hotelId)?.lng ?? undefined,
      chainCode: hotelMeta.get(hotel.hotel?.hotelId)?.chainCode ?? undefined,
      // Placeholders for Google Places enrichment (filled by hotel-enricher)
      photoUrl: null,
      userRating: null,
      reviewCount: null,
      editorialSummary: null,
      googleMapsUrl: null,
      phone: null,
      website: null,
      _rawPerNight: cheapestPerNight,
    };
  });

  // Post-filter by per-night price as a safety net (Amadeus priceRange filters on total, not per-night)
  if (params.priceMin != null) {
    mapped = mapped.filter((h) => h._rawPerNight >= params.priceMin!);
  }
  if (params.priceMax != null) {
    mapped = mapped.filter((h) => h._rawPerNight <= params.priceMax!);
  }

  // Sort by price ascending, then cap results
  mapped.sort((a, b) => a._rawPerNight - b._rawPerNight);
  const maxResults = params.maxResults || 5;

  // Strip internal field before returning
  return mapped.slice(0, maxResults).map(({ _rawPerNight, ...rest }) => rest);
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
