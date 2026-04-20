export type AgentId = 'all' | 'style' | 'travel' | 'fitness' | 'lifestyle';

export interface AgentConfig {
  id: AgentId;
  name: string;
  icon: string;
  color: string;
  description: string;
}

export const agents: Record<AgentId, AgentConfig> = {
  all: {
    id: 'all',
    name: 'All',
    icon: 'Grid3x3',
    color: 'var(--accent-global)',
    description: 'All conversations'
  },
  style: {
    id: 'style',
    name: 'Style',
    icon: 'Palette',
    color: 'var(--accent-style)',
    description: 'Color analysis, outfit feedback, wardrobe'
  },
  travel: {
    id: 'travel',
    name: 'Travel',
    icon: 'Plane',
    color: 'var(--accent-travel)',
    description: 'Flights, hotels, itinerary planning'
  },
  fitness: {
    id: 'fitness',
    name: 'Fitness',
    icon: 'Dumbbell',
    color: 'var(--accent-fitness)',
    description: 'Gym search, classes, workout recommendations'
  },
  lifestyle: {
    id: 'lifestyle',
    name: 'Lifestyle',
    icon: 'Coffee',
    color: 'var(--accent-lifestyle)',
    description: 'General chat, reminders, wellness'
  }
};

export interface Message {
  id: string;
  type: 'user' | 'bot';
  text: string;
  timestamp: Date;
  agentId: AgentId;
  imageUrl?: string;
  richCard?: RichCard;
}

export type RichCardType =
  | 'place'
  | 'placesList'
  | 'flight'
  | 'flightList'
  | 'hotel'
  | 'hotelList'
  | 'outfit'
  | 'colorSeason'
  | 'fitnessClass'
  | 'classList'
  | 'reminder';

export type ReminderStatus = 'pending' | 'fired' | 'completed' | 'dismissed';
export type ReminderNotifyVia = 'in_app' | 'email' | 'push';

export interface ReminderData {
  id: string;
  user_id?: string;
  agent_id: AgentId | string;
  title: string;
  notes: string | null;
  due_at: string;
  notify_via: ReminderNotifyVia;
  status: ReminderStatus;
  created_at?: string;
  fired_at?: string | null;
}

export interface PlaceResult {
  id: string;
  name: string;
  address: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  googleMapsUri?: string;
  websiteUri?: string;
  location?: { lat: number; lng: number };
}

export interface FlightSegmentResult {
  carrier: string;
  flightNumber: string;
  from: string;
  to: string;
  departAt: string;
  arriveAt: string;
  durationMinutes: number;
}

export interface FlightItineraryResult {
  durationMinutes: number;
  stops: number;
  segments: FlightSegmentResult[];
}

export interface FlightOfferResult {
  id: string;
  priceTotal: string;
  currency: string;
  itineraries: FlightItineraryResult[];
  bookingUrl: string;
}

export interface BookingProviderLinkResult {
  id: 'google' | 'kayak' | 'skyscanner' | 'momondo';
  name: string;
  url: string;
}

export interface HotelOfferResult {
  id: string;
  hotelId: string;
  name: string;
  cityName?: string;
  address?: string;
  rating?: number | null;
  latitude?: number;
  longitude?: number;
  priceTotal?: string;
  currency?: string;
  checkIn: string;
  checkOut: string;
  bookingUrl: string;
}

export interface HotelBookingLinkResult {
  id: 'booking' | 'hotels' | 'airbnb' | 'google';
  name: string;
  url: string;
}

export interface HotelListData {
  query: {
    cityCode: string;
    cityName?: string;
    checkIn: string;
    checkOut: string;
    adults?: number;
    rooms?: number;
    currency?: string;
  };
  offers: HotelOfferResult[];
  searchLink: string;
  providerError?: string;
  bookingLinks?: HotelBookingLinkResult[];
}

export interface FitnessAggregatorLinkResult {
  id: 'classpass' | 'mindbody' | 'googlemaps';
  name: string;
  url: string;
}

export interface ClassListData {
  query: {
    activity: string;
    cityName?: string;
    when?: string;
    radiusMeters?: number;
  };
  studios: PlaceResult[];
  aggregatorLinks: FitnessAggregatorLinkResult[];
  providerError?: string;
}

export interface FlightListData {
  query: {
    origin: string;
    destination: string;
    departDate: string;
    returnDate?: string;
    adults?: number;
    nonStop?: boolean;
    currency?: string;
  };
  offers: FlightOfferResult[];
  searchLink: string;
  providerError?: string;
  bookingLinks?: BookingProviderLinkResult[];
}

export interface RichCard {
  type: RichCardType;
  data: any;
}
