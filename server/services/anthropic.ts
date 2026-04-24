import OpenAI from 'openai';
import { getAgentConfig, buildSystemPrompt } from '../config/agents.js';
import { searchPlaces, type Place } from './places.js';
import {
  searchFlights,
  buildGoogleFlightsUrl,
  type FlightOffer,
  type FlightSearchParams,
} from './amadeus.js';
import { buildBookingLinks, type BookingProviderLink } from './flightLinks.js';
import { createReminder, type Reminder } from './reminders.js';
import { searchHotels, type HotelOffer } from './amadeusHotels.js';
import {
  buildHotelBookingLinks,
  type HotelBookingLink,
  type HotelSearchParams,
} from './hotelLinks.js';
import {
  searchFitnessClasses,
  type FitnessAggregatorLink,
  type FitnessClassSearchParams,
} from './fitnessClasses.js';
import { listWardrobeItems, type WardrobeItem } from './wardrobe.js';
import { searchFlightsFallback } from './serpFlights.js';
import { searchHotelsFallback } from './serpHotels.js';

function getOpenAIAuth() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey) return { apiKey };

  throw new Error(
    [
      'OpenAI authentication is not configured.',
      'Set `OPENAI_API_KEY` in your environment.',
    ].join(' ')
  );
}

// Lazy-initialized OpenAI client. Must be accessed through `getOpenAI()` so
// that module import order (or missing env during tooling/tests) cannot
// crash the process at load time.
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (_openai) return _openai;
  _openai = new OpenAI(getOpenAIAuth());
  return _openai;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface UserLocation {
  lat: number;
  lng: number;
}

/**
 * Activity kinds correspond 1:1 with the tool thsat's currently executing (or
 * `thinking` when we're waiting on the model itself). The client maps the kind
 * to a user-friendly label + icon, so adding a new kind only requires the
 * client-side map to grow.
 */
export type ActivityKind =
  | 'thinking'
  | 'search_places'
  | 'search_flights'
  | 'search_hotels'
  | 'find_fitness_classes'
  | 'create_reminder'
  | 'list_reminders'
  | 'list_wardrobe'
  | 'writing';

export type StreamEvent =
  | { type: 'token'; text: string }
  | { type: 'activity'; kind: ActivityKind; detail?: string }
  | { type: 'card'; card: { type: 'placesList'; data: { query: string; places: Place[] } } }
  | {
      type: 'card';
      card: {
        type: 'flightList';
        data: {
          query: FlightSearchParams;
          offers: FlightOffer[];
          searchLink: string;
          providerError?: string;
          bookingLinks: BookingProviderLink[];
        };
      };
    }
  | { type: 'card'; card: { type: 'reminder'; data: Reminder } }
  | {
      type: 'card';
      card: {
        type: 'hotelList';
        data: {
          query: HotelSearchParams;
          offers: HotelOffer[];
          searchLink: string;
          providerError?: string;
          bookingLinks: HotelBookingLink[];
        };
      };
    }
  | {
      type: 'card';
      card: {
        type: 'classList';
        data: {
          query: {
            activity: string;
            cityName?: string;
            when?: string;
            radiusMeters?: number;
          };
          studios: Place[];
          aggregatorLinks: FitnessAggregatorLink[];
          providerError?: string;
        };
      };
    };

const SEARCH_PLACES_TOOL = {
  type: 'function' as const,
  function: {
    name: 'search_places',
    description:
      'Search Google for real businesses (yoga studios, restaurants, gyms, cafes, bars, etc.) near the user. Use this whenever the user asks to find, book, or locate somewhere.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Natural language search like "yoga class tomorrow morning" or "italian restaurant".',
        },
        radius_meters: {
          type: 'number',
          description: 'Optional search radius in meters (default 10000, max 50000).',
        },
      },
      required: ['query'],
    },
  },
};

const FIND_FITNESS_CLASSES_TOOL = {
  type: 'function' as const,
  function: {
    name: 'find_fitness_classes',
    description:
      'Find real fitness studios + live class schedule links near the user. Use whenever the user asks for yoga, pilates, barre, spin, HIIT, boxing, dance, crossfit, climbing, swimming, or gym classes. We will return matching studios (from Google Places) and pre-filled deep-links to ClassPass, Mindbody, and Google Maps so the user can see real schedules — DO NOT invent class times, instructors, or prices.',
    parameters: {
      type: 'object',
      properties: {
        activity: {
          type: 'string',
          description:
            'Normalized activity keyword: yoga, pilates, barre, cycling, hiit, boxing, dance, crossfit, climbing, swimming, or gym.',
        },
        cityName: {
          type: 'string',
          description: 'Optional human-readable city/neighborhood name the user typed.',
        },
        when: {
          type: 'string',
          description:
            'Free-form time/date the user asked for (e.g. "tomorrow 8am", "Saturday evening"). Passed through to the UI; we do NOT parse it.',
        },
        radius_meters: {
          type: 'number',
          description: 'Optional search radius in meters (default 8000, max 50000).',
        },
      },
      required: ['activity'],
    },
  },
};

const SEARCH_HOTELS_TOOL = {
  type: 'function' as const,
  function: {
    name: 'search_hotels',
    description:
      'Search real hotel offers (Amadeus) in a given city for given dates. Use whenever the user asks for hotels, where to stay, or rooms. Convert city names to Amadeus IATA city codes (e.g. Paris -> PAR, New York -> NYC, London -> LON, Tokyo -> TYO, Los Angeles -> LAX, San Francisco -> SFO, Barcelona -> BCN, Rome -> ROM, Berlin -> BER, Amsterdam -> AMS, Dubai -> DXB, Bangkok -> BKK). Pass the ORIGINAL city name in `cityName` so we can build high-quality booking fallback links.',
    parameters: {
      type: 'object',
      properties: {
        cityCode: {
          type: 'string',
          description: 'Amadeus IATA city code, 3 uppercase letters.',
        },
        cityName: {
          type: 'string',
          description: 'Human-readable city name the user typed (used for booking fallback URLs).',
        },
        checkIn: { type: 'string', description: 'YYYY-MM-DD.' },
        checkOut: { type: 'string', description: 'YYYY-MM-DD.' },
        adults: {
          type: 'number',
          description: 'Number of adult guests total (default 1, max 9).',
        },
        rooms: {
          type: 'number',
          description: 'Number of rooms (default 1, max 9).',
        },
        currency: { type: 'string', description: 'ISO currency, default USD.' },
      },
      required: ['cityCode', 'checkIn', 'checkOut'],
    },
  },
};

const CREATE_REMINDER_TOOL = {
  type: 'function' as const,
  function: {
    name: 'create_reminder',
    description:
      'Create a real reminder that will actually fire at the scheduled time. Use this whenever the user asks to be reminded of something, to remember a task, or to schedule a nudge. Convert natural-language times ("tomorrow 8am", "in 10 minutes", "next Monday at noon") into an absolute ISO 8601 timestamp in the user\'s local timezone offset. Never fabricate — if the time is ambiguous, ask.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Short description of what to remind the user about (max 200 chars).',
        },
        dueAt: {
          type: 'string',
          description:
            'ISO 8601 timestamp with timezone offset, e.g. 2026-04-19T08:00:00-04:00. MUST be in the future.',
        },
        notes: {
          type: 'string',
          description: 'Optional longer notes, context, or checklist (max 2000 chars).',
        },
        notifyVia: {
          type: 'string',
          enum: ['in_app', 'email', 'push'],
          description: 'Channel, defaults to in_app. Only in_app is implemented today.',
        },
      },
      required: ['title', 'dueAt'],
    },
  },
};

const LIST_REMINDERS_TOOL = {
  type: 'function' as const,
  function: {
    name: 'list_reminders',
    description:
      'List the user’s real reminders from the database. Use when the user asks what reminders they have, what’s due, or to review their schedule. Do not invent reminders.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description:
            'Optional status filter: pending, fired, completed, dismissed. Omit to include all.',
        },
        limit: {
          type: 'number',
          description: 'Optional max number of reminders to return (default 20, max 100).',
        },
      },
      required: [],
    },
  },
};

const LIST_WARDROBE_TOOL = {
  type: 'function' as const,
  function: {
    name: 'list_wardrobe',
    description:
      'Read the user\'s actual wardrobe items from the database. Call this whenever the user asks about their wardrobe, what they own, what outfits they can make, or requests personalized outfit or styling advice based on their real clothes. Returns item category, color, subtype, seasons, warmth, whether it has a photo, and its Ready status.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory', 'activewear'],
          description: 'Optional: filter by category. Omit to return all items.',
        },
        verified_only: {
          type: 'boolean',
          description:
            'If true, return only items the user has marked "Ready for outfits" (photo-verified). Default false returns all items.',
        },
      },
      required: [],
    },
  },
};

const SEARCH_FLIGHTS_TOOL = {
  type: 'function' as const,
  function: {
    name: 'search_flights',
    description:
      'Search real flight offers (Amadeus). Use this whenever the user asks for specific flights. Convert city names to the most likely IATA airport code (e.g. Chicago -> ORD, Los Angeles -> LAX, Tokyo -> HND or NRT, New York -> JFK). If the user gave an ambiguous city, pick the main airport and mention the choice in your reply.',
    parameters: {
      type: 'object',
      properties: {
        origin: { type: 'string', description: 'IATA airport code, 3 letters.' },
        destination: { type: 'string', description: 'IATA airport code, 3 letters.' },
        departDate: { type: 'string', description: 'YYYY-MM-DD.' },
        returnDate: { type: 'string', description: 'YYYY-MM-DD, optional for one-way.' },
        adults: { type: 'number', description: 'Number of adult passengers (default 1, max 9).' },
        nonStop: { type: 'boolean', description: 'Restrict to direct flights only.' },
        currency: { type: 'string', description: 'ISO currency, default USD.' },
      },
      required: ['origin', 'destination', 'departDate'],
    },
  },
};

type OpenAIMessage =
  | { role: 'system'; content: string }
  | {
      role: 'user' | 'assistant';
      content:
        | string
        | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
    };

function toOpenAIMessages(systemPrompt: string, messages: ChatMessage[]): OpenAIMessage[] {
  const converted: OpenAIMessage[] = [{ role: 'system', content: systemPrompt }];

  for (const m of messages) {
    if (typeof m.content === 'string') {
      converted.push({ role: m.role, content: m.content });
      continue;
    }

    const parts: Array<
      { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
    > = [];
    for (const part of m.content) {
      if (part.type === 'text' && typeof part.text === 'string') {
        parts.push({ type: 'text', text: part.text });
      } else if (part.type === 'image_url' && part.image_url?.url) {
        parts.push({ type: 'image_url', image_url: { url: part.image_url.url } });
      }
    }
    converted.push({ role: m.role, content: parts.length > 0 ? parts : '' });
  }

  return converted;
}

function isReservationIntent(query: string): boolean {
  return /\b(reserve|reservation|book|booking|table|dinner|lunch|brunch|restaurant)\b/i.test(
    query ?? ''
  );
}

export async function* streamChat(
  agentId: string,
  messages: ChatMessage[],
  styleProfile?: object,
  abortSignal?: AbortSignal,
  userLocation?: UserLocation,
  userId?: string
): AsyncGenerator<StreamEvent> {
  const config = getAgentConfig(agentId);
  let systemPrompt = buildSystemPrompt(agentId, styleProfile);
  if (userLocation) {
    systemPrompt += `\n\n# USER LOCATION\nLat: ${userLocation.lat}, Lng: ${userLocation.lng}. When searching for places, use the \`search_places\` tool; the server will pass this location automatically.`;
  } else {
    systemPrompt += `\n\n# USER LOCATION\nUnknown — if the user asks for nearby places, ask them to tap the location icon next to the chat input so we can find real results.`;
  }

  // Hard grounding rule — do not invent any specific external facts.
  systemPrompt += `\n\n# GROUNDING (HARD RULE)
Do NOT invent specific businesses, studios, restaurants, hotels, flights, class schedules, instructors, phone numbers, addresses, URLs, or prices. If you cannot ground a specific claim via a tool result in this conversation, either describe the category generically or ask the user for more info. Do not emit fenced JSON.`;

  // Build the tools list based on agent + available context.
  const tools: any[] = [];
  const placesAllowed =
    // For Travel/Lifestyle/All, allow `search_places` even without GPS. Google
    // Places Text Search can work without a location bias if the user provides
    // a city/neighborhood in the query (e.g. "Shibuya Tokyo sushi").
    // For Fitness, keep it location-gated to avoid "near me" without coordinates.
    agentId === 'travel' || agentId === 'lifestyle' || agentId === 'all' || (agentId === 'fitness' && !!userLocation);
  const flightsAllowed = agentId === 'travel' || agentId === 'all';
  const hotelsAllowed = agentId === 'travel' || agentId === 'all';
  const fitnessClassesAllowed =
    !!userLocation && (agentId === 'fitness' || agentId === 'all');
  const remindersAllowed =
    !!userId &&
    (agentId === 'lifestyle' ||
      agentId === 'fitness' ||
      agentId === 'travel' ||
      agentId === 'style' ||
      agentId === 'all');
  const wardrobeAllowed = !!userId && (agentId === 'style' || agentId === 'all');
  if (placesAllowed) tools.push(SEARCH_PLACES_TOOL);
  if (flightsAllowed) tools.push(SEARCH_FLIGHTS_TOOL);
  if (hotelsAllowed) tools.push(SEARCH_HOTELS_TOOL);
  if (fitnessClassesAllowed) tools.push(FIND_FITNESS_CLASSES_TOOL);
  if (remindersAllowed) {
    tools.push(CREATE_REMINDER_TOOL);
    tools.push(LIST_REMINDERS_TOOL);
  }
  if (wardrobeAllowed) tools.push(LIST_WARDROBE_TOOL);

  const canUseTools = tools.length > 0;
  const openaiMessages = toOpenAIMessages(systemPrompt, messages);

  // ── Step 1: non-streaming tool-check ──────────────────────
  if (canUseTools) {
    yield { type: 'activity', kind: 'thinking' };
    const first = await getOpenAI().chat.completions.create(
      {
        model: config.model,
        messages: openaiMessages as any,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        tools,
        tool_choice: 'auto',
      },
      abortSignal ? { signal: abortSignal } : undefined
    );

    const choice = first.choices?.[0]?.message;
    const toolCalls = choice?.tool_calls ?? [];

    if (toolCalls.length > 0) {
      const toolMessages: any[] = [];
      let totalPlaces = 0;
      let totalFlights = 0;
      let totalHotels = 0;
      let totalFitnessStudios = 0;
      let flightProviderError: string | undefined;
      let hotelProviderError: string | undefined;
      let fitnessProviderError: string | undefined;
      let reminderCreated: Reminder | null = null;
      let remindersListedCount = 0;
      let lastPlacesQuery = '';
      const usedTools = new Set<string>();

      for (const tc of toolCalls) {
        if (tc.type !== 'function') continue;
        const name = tc.function.name;
        let args: any = {};
        try {
          args = JSON.parse(tc.function.arguments || '{}');
        } catch {
          // leave args empty
        }

        if (name === 'search_places' && placesAllowed) {
          usedTools.add('search_places');
          const query = (args.query || '').trim();
          lastPlacesQuery = query;
          yield { type: 'activity', kind: 'search_places', detail: query || undefined };
          let places: Place[] = [];
          try {
            if (query) {
              places = await searchPlaces(query, {
                // Location bias is optional — when GPS is unknown, Places still
                // works if the query includes the city/neighborhood.
                lat: userLocation?.lat,
                lng: userLocation?.lng,
                radiusMeters: args.radius_meters,
              });
            }
          } catch (err: any) {
            console.error('search_places error:', err.message);
          }
          totalPlaces += places.length;
          yield { type: 'card', card: { type: 'placesList', data: { query, places } } };
          toolMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify({ query, count: places.length, places }),
          });
        } else if (name === 'search_flights' && flightsAllowed) {
          usedTools.add('search_flights');
          const params: FlightSearchParams = {
            origin: String(args.origin || '').trim(),
            destination: String(args.destination || '').trim(),
            departDate: String(args.departDate || '').trim(),
            returnDate: args.returnDate ? String(args.returnDate).trim() : undefined,
            adults: typeof args.adults === 'number' ? args.adults : undefined,
            nonStop: typeof args.nonStop === 'boolean' ? args.nonStop : undefined,
            currency: args.currency ? String(args.currency).trim() : undefined,
          };

          // Guard: if required params are missing the model called too early.
          // Return a structured error so the model knows exactly what to ask for.
          const missingFlightParams: string[] = [];
          if (!params.origin) missingFlightParams.push('origin airport/city');
          if (!params.destination) missingFlightParams.push('destination airport/city');
          if (!params.departDate) missingFlightParams.push('departure date (YYYY-MM-DD)');

          if (missingFlightParams.length > 0) {
            toolMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify({
                error: 'missing_required_params',
                missing: missingFlightParams,
                instruction:
                  `Ask the user for the missing information before retrying: ${missingFlightParams.join(', ')}.`,
              }),
            });
          } else {
            let offers: FlightOffer[] = [];
            let searchLink = buildGoogleFlightsUrl(params);
            let toolErr: string | undefined;
            yield {
              type: 'activity',
              kind: 'search_flights',
              detail: `${params.origin} → ${params.destination}`,
            };
            try {
              const result = await searchFlights(params);
              offers = result.offers;
              searchLink = result.searchLink;
            } catch (amadeusErr: any) {
              console.error('search_flights amadeus error:', amadeusErr.message);
              try {
                const serpOffers = await searchFlightsFallback(params);
                if (serpOffers.length > 0) {
                  offers = serpOffers;
                } else {
                  toolErr = amadeusErr.message;
                  flightProviderError = toolErr;
                }
              } catch (serpErr: any) {
                console.error('search_flights serp error:', serpErr.message);
                toolErr = amadeusErr.message;
                flightProviderError = toolErr;
              }
            }
            totalFlights += offers.length;
            const bookingLinks = buildBookingLinks(params);
            yield {
              type: 'card',
              card: {
                type: 'flightList',
                data: {
                  query: params,
                  offers,
                  searchLink,
                  providerError: toolErr,
                  bookingLinks,
                },
              },
            };
            toolMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify({
                query: params,
                count: offers.length,
                offers: offers.slice(0, 6),
                searchLink,
                bookingLinks: bookingLinks.map((l) => `${l.name}: ${l.url}`),
                error: toolErr,
              }),
            });
          }
        } else if (name === 'find_fitness_classes' && fitnessClassesAllowed) {
          usedTools.add('find_fitness_classes');
          const fp: FitnessClassSearchParams = {
            activity: String(args.activity || '').trim(),
            cityName: args.cityName ? String(args.cityName).trim() : undefined,
            when: args.when ? String(args.when).trim() : undefined,
            radiusMeters:
              typeof args.radius_meters === 'number' ? args.radius_meters : undefined,
            location: { lat: userLocation!.lat, lng: userLocation!.lng },
          };
          let studios: Place[] = [];
          let aggregatorLinks: FitnessAggregatorLink[] = [];
          let toolErr: string | undefined;
          yield {
            type: 'activity',
            kind: 'find_fitness_classes',
            detail: fp.activity || undefined,
          };
          try {
            const result = await searchFitnessClasses(fp);
            studios = result.studios;
            aggregatorLinks = result.aggregatorLinks;
          } catch (err: any) {
            toolErr = err.message;
            fitnessProviderError = toolErr;
            console.error('find_fitness_classes error:', err.message);
            // Still show the aggregator links so the UX stays actionable.
            const {
              buildAggregatorLinks,
            } = await import('./fitnessClasses.js');
            aggregatorLinks = buildAggregatorLinks(fp);
          }
          totalFitnessStudios += studios.length;
          yield {
            type: 'card',
            card: {
              type: 'classList',
              data: {
                query: {
                  activity: fp.activity,
                  cityName: fp.cityName,
                  when: fp.when,
                  radiusMeters: fp.radiusMeters,
                },
                studios,
                aggregatorLinks,
                providerError: toolErr,
              },
            },
          };
          toolMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify({
              activity: fp.activity,
              when: fp.when,
              count: studios.length,
              studios: studios.slice(0, 6),
              aggregatorLinks: aggregatorLinks.map((l) => `${l.name}: ${l.url}`),
              error: toolErr,
            }),
          });
        } else if (name === 'search_hotels' && hotelsAllowed) {
          usedTools.add('search_hotels');
          const hp: HotelSearchParams = {
            cityCode: String(args.cityCode || '').trim().toUpperCase(),
            cityName: args.cityName ? String(args.cityName).trim() : undefined,
            checkIn: String(args.checkIn || '').trim(),
            checkOut: String(args.checkOut || '').trim(),
            adults: typeof args.adults === 'number' ? args.adults : undefined,
            rooms: typeof args.rooms === 'number' ? args.rooms : undefined,
            currency: args.currency ? String(args.currency).trim() : undefined,
          };

          // Guard: if required params are missing the model called too early.
          const missingHotelParams: string[] = [];
          if (!hp.cityCode) missingHotelParams.push('city code (e.g. PAR for Paris)');
          if (!hp.checkIn) missingHotelParams.push('check-in date (YYYY-MM-DD)');
          if (!hp.checkOut) missingHotelParams.push('check-out date (YYYY-MM-DD)');

          if (missingHotelParams.length > 0) {
            toolMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify({
                error: 'missing_required_params',
                missing: missingHotelParams,
                instruction:
                  `Ask the user for the missing information before retrying: ${missingHotelParams.join(', ')}.`,
              }),
            });
          } else {
            let hotelOffers: HotelOffer[] = [];
            let hotelSearchLink = buildHotelBookingLinks(hp)[0]!.url;
            let toolErr: string | undefined;
            yield {
              type: 'activity',
              kind: 'search_hotels',
              detail: hp.cityName || hp.cityCode,
            };
            try {
              const result = await searchHotels(hp);
              hotelOffers = result.offers;
              hotelSearchLink = result.searchLink;
            } catch (amadeusErr: any) {
              console.error('search_hotels amadeus error:', amadeusErr.message);
              try {
                const serpOffers = await searchHotelsFallback(hp);
                if (serpOffers.length > 0) {
                  hotelOffers = serpOffers;
                } else {
                  toolErr = amadeusErr.message;
                  hotelProviderError = toolErr;
                }
              } catch (serpErr: any) {
                console.error('search_hotels serp error:', serpErr.message);
                toolErr = amadeusErr.message;
                hotelProviderError = toolErr;
              }
            }
            totalHotels += hotelOffers.length;
            const hotelLinks = buildHotelBookingLinks(hp);
            yield {
              type: 'card',
              card: {
                type: 'hotelList',
                data: {
                  query: hp,
                  offers: hotelOffers,
                  searchLink: hotelSearchLink,
                  providerError: toolErr,
                  bookingLinks: hotelLinks,
                },
              },
            };
            toolMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify({
                query: hp,
                count: hotelOffers.length,
                offers: hotelOffers.slice(0, 6),
                searchLink: hotelSearchLink,
                bookingLinks: hotelLinks.map((l) => `${l.name}: ${l.url}`),
                error: toolErr,
              }),
            });
          }
        } else if (name === 'create_reminder' && remindersAllowed) {
          usedTools.add('create_reminder');
          let reminder: Reminder | null = null;
          let toolErr: string | undefined;
          yield {
            type: 'activity',
            kind: 'create_reminder',
            detail: args.title ? String(args.title).slice(0, 60) : undefined,
          };
          try {
            reminder = await createReminder({
              userId: userId!,
              agentId,
              title: String(args.title || '').trim(),
              notes: args.notes ? String(args.notes) : undefined,
              dueAt: String(args.dueAt || ''),
              notifyVia: args.notifyVia,
            });
          } catch (err: any) {
            toolErr = err.message;
            console.error('create_reminder error:', err.message);
          }
          if (reminder) {
            reminderCreated = reminder;
            yield { type: 'card', card: { type: 'reminder', data: reminder } };
          }
          toolMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(
              reminder
                ? {
                    ok: true,
                    id: reminder.id,
                    title: reminder.title,
                    dueAt: reminder.due_at,
                    notifyVia: reminder.notify_via,
                  }
                : { ok: false, error: toolErr ?? 'unknown error' }
            ),
          });
        } else if (name === 'list_reminders' && remindersAllowed) {
          usedTools.add('list_reminders');
          yield { type: 'activity', kind: 'list_reminders' };
          let toolErr: string | undefined;
          let reminders: Reminder[] = [];
          try {
            const { listReminders } = await import('./reminders.js');
            const rawStatus = args.status ? String(args.status).trim() : '';
            const status =
              rawStatus && ['pending', 'fired', 'completed', 'dismissed'].includes(rawStatus)
                ? (rawStatus as any)
                : undefined;
            const limit =
              typeof args.limit === 'number' && Number.isFinite(args.limit)
                ? Math.min(Math.max(args.limit, 1), 100)
                : 20;
            reminders = await listReminders(userId!, { status, limit });
          } catch (err: any) {
            toolErr = err.message;
            console.error('list_reminders error:', err.message);
          }
          remindersListedCount = reminders.length;
          toolMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(
              toolErr
                ? { ok: false, error: toolErr }
                : {
                    ok: true,
                    count: reminders.length,
                    reminders: reminders.map((r) => ({
                      id: r.id,
                      title: r.title,
                      due_at: r.due_at,
                      status: r.status,
                      notify_via: r.notify_via,
                    })),
                  }
            ),
          });
        } else if (name === 'list_wardrobe' && wardrobeAllowed) {
          usedTools.add('list_wardrobe');
          yield { type: 'activity', kind: 'list_wardrobe' };
          let wardrobeItems: WardrobeItem[] = [];
          let toolErr: string | undefined;
          try {
            const category = args.category as string | undefined;
            wardrobeItems = await listWardrobeItems(userId!, {
              category: category as any,
              limit: 200,
            });
            if (args.verified_only) {
              wardrobeItems = wardrobeItems.filter(
                (it) => it.attributes?.verified === true
              );
            }
          } catch (err: any) {
            toolErr = err.message;
            console.error('list_wardrobe error:', err.message);
          }
          // Strip base64 image_url to keep the context window lean.
          const compact = wardrobeItems.map((it) => ({
            id: it.id,
            category: it.category,
            subtype: it.subtype ?? null,
            color: it.color ?? null,
            warmth: it.warmth ?? null,
            seasons: it.seasons,
            occasions: it.occasions,
            has_photo: Boolean(it.image_url),
            ready: it.attributes?.verified === true,
          }));
          toolMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(
              toolErr
                ? { error: toolErr }
                : {
                    total: compact.length,
                    ready: compact.filter((i) => i.ready).length,
                    draft: compact.filter((i) => !i.ready).length,
                    items: compact,
                  }
            ),
          });
        } else {
          toolMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify({ error: `tool ${name} not available for this agent` }),
          });
        }
      }

      const groundingParts: string[] = [];
      if (usedTools.has('search_places')) {
        groundingParts.push(
          totalPlaces === 0
            ? 'search_places returned zero results — DO NOT invent businesses; tell the user no results and suggest widening the search.'
            : isReservationIntent(lastPlacesQuery)
              ? 'Summarize places from search_places above. Only reference businesses in the tool result; do not add prices, phone numbers, or hours the tool did not return. The user is trying to book a reservation — explicitly tell them to use the booking links on the card (OpenTable / Resy / the official website / Google Maps) to reserve.'
              : 'Summarize places from search_places above. Only reference businesses in the tool result; do not add prices, phone numbers, or hours the tool did not return.'
        );
      }
      if (usedTools.has('create_reminder')) {
        if (reminderCreated) {
          const when = new Date(reminderCreated.due_at).toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          });
          groundingParts.push(
            `Reminder saved: "${reminderCreated.title}" for ${when}. Confirm to the user in 1–2 sentences that it's scheduled and will fire at that time. Do not invent extra details.`
          );
        } else {
          groundingParts.push(
            'create_reminder failed — the time was likely invalid or in the past. Ask the user for a clearer future time. Keep it under 2 sentences.'
          );
        }
      }
      if (usedTools.has('list_reminders')) {
        groundingParts.push(
          remindersListedCount === 0
            ? 'list_reminders returned zero reminders. Do NOT invent any; tell the user they have no reminders that match and offer to create one.'
            : 'Summarize the reminders from list_reminders above (title + due time + status). Do NOT invent reminders or times not in the tool result. Keep it under 4 sentences.'
        );
      }
      if (usedTools.has('list_wardrobe')) {
        groundingParts.push(
          'You now have the user\'s real wardrobe from list_wardrobe. Reference their actual items by category and color when making outfit or styling suggestions. Only mention items that appear in the tool result — do NOT invent clothing the user does not own. If an item has ready: false, note it is a draft and may need a photo to verify. Keep suggestions grounded and specific.'
        );
      }
      if (usedTools.has('find_fitness_classes')) {
        if (fitnessProviderError) {
          groundingParts.push(
            `find_fitness_classes failed: "${fitnessProviderError.slice(0, 200)}". DO NOT invent studios or class times. Tell the user the live studio directory is temporarily unavailable and point them to the aggregator links on the card below (ClassPass, Mindbody, Google Maps), which are pre-filled with their activity and city. Keep it under 3 sentences.`
          );
        } else if (totalFitnessStudios === 0) {
          groundingParts.push(
            'find_fitness_classes returned zero matching studios. DO NOT invent any. Tell the user no live studios matched their activity + location and that the ClassPass/Mindbody/Google Maps links on the card are pre-filled to widen the search.'
          );
        } else {
          groundingParts.push(
            'Reference studios from find_fitness_classes above (names + neighborhoods only) and remind the user to tap a studio or ClassPass/Mindbody to see live class times. DO NOT invent specific class times, instructors, or prices — the tool result does not include schedules. Keep it under 4 sentences.'
          );
        }
      }
      if (usedTools.has('search_hotels')) {
        if (hotelProviderError) {
          groundingParts.push(
            `The live hotel-offers provider (Amadeus) returned an error: "${hotelProviderError.slice(0, 200)}". DO NOT invent hotels, star ratings, prices, or addresses. Tell the user the live hotel service is temporarily unavailable and that the card below has pre-filled booking links to Booking.com, Hotels.com, Airbnb, and Google Hotels for their city + dates. Keep it under 3 sentences.`
          );
        } else if (totalHotels === 0) {
          groundingParts.push(
            'search_hotels returned zero offers — DO NOT invent hotels, addresses, or prices. Tell the user no live offers were found and that the booking links on the card (Booking.com, Hotels.com, Airbnb, Google Hotels) are pre-filled with their city and dates.'
          );
        } else {
          groundingParts.push(
            'Summarize hotels from search_hotels above. Only reference hotels in the tool result; do not invent prices, addresses, or star ratings the tool did not return. Keep it under 4 sentences; the UI already shows the list and direct booking links.'
          );
        }
      }
      if (usedTools.has('search_flights') && totalFlights === 0 && !flightProviderError) {
        // Check if ANY flight tool message contains a missing_required_params error.
        const hasMissingFlightParams = toolMessages.some(
          (m) => m.role === 'tool' && m.content.includes('missing_required_params')
        );
        if (hasMissingFlightParams) {
          groundingParts.push(
            'The search_flights tool was called but required parameters (origin, destination, or departure date) were missing. Ask the user for the missing information in a friendly, concise way. Do NOT invent flight options or speculate on routes.'
          );
        }
      }
      if (usedTools.has('search_hotels') && totalHotels === 0 && !hotelProviderError) {
        const hasMissingHotelParams = toolMessages.some(
          (m) => m.role === 'tool' && m.content.includes('missing_required_params')
        );
        if (hasMissingHotelParams) {
          groundingParts.push(
            'The search_hotels tool was called but required parameters (city code, check-in date, or check-out date) were missing. Ask the user for the missing information in a friendly, concise way. Do NOT invent hotel options.'
          );
        }
      }
      if (usedTools.has('search_flights')) {
        if (flightProviderError) {
          groundingParts.push(
            `The live flight-offers provider (Amadeus) returned an error: "${flightProviderError.slice(0, 200)}". DO NOT invent flights. Tell the user the live flight-offers service is temporarily unavailable and that the card below has direct booking links to Google Flights, Kayak, Skyscanner, and Momondo pre-filled with their search so they can still book. Keep it under 3 sentences.`
          );
        } else if (totalFlights === 0) {
          groundingParts.push(
            'search_flights returned zero offers — DO NOT invent airlines, flight numbers, times, or prices. Tell the user no live offers were found and that the booking links on the card (Google Flights, Kayak, Skyscanner, Momondo) are pre-filled with their route and date so they can still search externally.'
          );
        } else {
          groundingParts.push(
            'Summarize flights from search_flights above. Only reference carriers, flight numbers, times, stops, and prices present in the tool result. Do not invent extras. Keep it under 4 sentences; the UI already shows the full list and direct booking links.'
          );
        }
      }
      const groundingMsg = {
        role: 'system' as const,
        content:
          (groundingParts.join(' ') || 'Respond using only facts grounded in the tool results above.') +
          ' Keep it under 4 sentences.',
      };

      yield { type: 'activity', kind: 'writing' };
      const finalStream = await getOpenAI().chat.completions.create(
        {
          model: config.model,
          messages: [...(openaiMessages as any), choice, ...toolMessages, groundingMsg],
          temperature: config.temperature,
          max_tokens: config.maxTokens,
          stream: true,
        },
        abortSignal ? { signal: abortSignal } : undefined
      );
      for await (const chunk of finalStream) {
        if (abortSignal?.aborted) return;
        const token = chunk.choices?.[0]?.delta?.content;
        if (typeof token === 'string' && token.length > 0) {
          yield { type: 'token', text: token };
        }
      }
      return;
    }

    // No tool call — send the content we already have as a single token event.
    const content = choice?.content ?? '';
    if (content) yield { type: 'token', text: content };
    return;
  }

  // ── Plain streaming path (no tools) ───────────────────────
  yield { type: 'activity', kind: 'thinking' };
  const stream = await getOpenAI().chat.completions.create(
    {
      model: config.model,
      messages: openaiMessages as any,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stream: true,
    },
    abortSignal ? { signal: abortSignal } : undefined
  );

  const STREAM_TIMEOUT_MS = 60_000;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const resetTimeout = () => {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    timeoutHandle = setTimeout(() => {
      // AbortController is handled by the request signal; we just stop consuming.
    }, STREAM_TIMEOUT_MS);
  };
  resetTimeout();

  try {
    for await (const chunk of stream) {
      if (abortSignal?.aborted) return;
      resetTimeout();
      const token = chunk.choices?.[0]?.delta?.content;
      if (typeof token === 'string' && token.length > 0) {
        yield { type: 'token', text: token };
      }
    }
  } catch (err: any) {
    if (abortSignal?.aborted) return;
    throw err;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

export async function analyzeImage(
  imageBase64: string,
  analysisType: 'skin_tone' | 'outfit_rating' | 'clothing_tag'
): Promise<object> {
  const prompts: Record<string, string> = {
    skin_tone: `Analyze this selfie for color season analysis. Return ONLY valid JSON:
{
  "depth": "fair" | "light" | "medium" | "tan" | "deep",
  "undertone": "warm" | "cool" | "neutral",
  "season": "<one of: Light Spring, True Spring, Bright Spring, Light Summer, True Summer, Soft Summer, Soft Autumn, True Autumn, Deep Autumn, Deep Winter, True Winter, Bright Winter>",
  "confidence": <0.0-1.0>,
  "bestColors": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5", "#hex6", "#hex7", "#hex8"],
  "bestMetals": "Gold, Rose Gold" | "Silver, Platinum" | etc,
  "avoidColors": ["#hex1", "#hex2", "#hex3"]
}`,
    outfit_rating: `Rate this outfit photo. Return ONLY valid JSON:
{
  "score": <1-10>,
  "strengths": ["strength1", "strength2"],
  "improvements": ["improvement1", "improvement2"],
  "accessorySuggestions": ["suggestion1", "suggestion2"],
  "colorHarmony": "excellent" | "good" | "needs work",
  "overallVibe": "<2-3 word description>"
}`,
    clothing_tag: `Tag this clothing item. Return ONLY valid JSON:
{
  "category": "top" | "bottom" | "dress" | "outerwear" | "shoes" | "accessory",
  "color": "<color name>",
  "colorHex": "#hex",
  "style": "casual" | "smart-casual" | "business" | "formal" | "athleisure",
  "seasons": ["spring", "summer", "fall", "winter"],
  "occasions": ["work", "casual", "date-night", "formal", "workout"],
  "pairsWith": ["item1", "item2", "item3"]
}`,
  };

  const config = getAgentConfig('style');

  const response = await getOpenAI().chat.completions.create({
    model: config.model,
    messages: [
      {
        role: 'system',
        content:
          'You are a helpful assistant. Respond with ONLY valid JSON matching the user\'s schema. No prose, no code fences, no apologies.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompts[analysisType] },
          { type: 'image_url', image_url: { url: imageBase64 } },
        ],
      },
    ],
    temperature: 0.3,
    max_tokens: 1000,
  });

  const text = response.choices?.[0]?.message?.content ?? '';
  return parseAnalysisResponse(text);
}

/**
 * Parse the model's reply for image-analysis endpoints.
 *
 * Models occasionally refuse on photos of real people with a prose apology
 * ("I'm sorry, but I can't help..."). That's not a JSON error — it's a
 * refusal. Return a structured `{ refused: true, ... }` result instead of
 * throwing / spamming stderr. Also tolerates fenced and unfenced JSON.
 *
 * Exported for unit tests.
 */
export function parseAnalysisResponse(raw: string): Record<string, unknown> {
  const text = (raw ?? '').trim();
  if (!text) return { error: 'Empty AI response', raw: '' };

  // 1. Prefer fenced JSON block if present.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const fencedCandidate = fenced?.[1]?.trim();
  if (fencedCandidate) {
    try {
      return JSON.parse(fencedCandidate);
    } catch {
      // fall through
    }
  }

  // 2. Try parsing the whole body (common when we asked for JSON-only).
  try {
    return JSON.parse(text);
  } catch {
    // fall through
  }

  // 3. Extract the first balanced `{...}` block and try that.
  const objStart = text.indexOf('{');
  const objEnd = text.lastIndexOf('}');
  if (objStart >= 0 && objEnd > objStart) {
    try {
      return JSON.parse(text.slice(objStart, objEnd + 1));
    } catch {
      // fall through
    }
  }

  // 4. Refusal heuristic — don't log as an error, the model just declined.
  if (/^\s*(?:i'?m\s+sorry|i\s+can('|no)?t|i\s+cannot|sorry,?\s+but)/i.test(text)) {
    return { refused: true, reason: text.slice(0, 500), raw: text };
  }

  // 5. True parse failure.
  console.error('Failed to parse image analysis JSON. Raw text:', text.slice(0, 500));
  return { error: 'Failed to parse AI response', raw: text };
}
