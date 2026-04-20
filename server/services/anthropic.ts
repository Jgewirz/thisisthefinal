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

export type StreamEvent =
  | { type: 'token'; text: string }
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
    !!userLocation &&
    (agentId === 'fitness' || agentId === 'travel' || agentId === 'lifestyle' || agentId === 'all');
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
  if (placesAllowed) tools.push(SEARCH_PLACES_TOOL);
  if (flightsAllowed) tools.push(SEARCH_FLIGHTS_TOOL);
  if (hotelsAllowed) tools.push(SEARCH_HOTELS_TOOL);
  if (fitnessClassesAllowed) tools.push(FIND_FITNESS_CLASSES_TOOL);
  if (remindersAllowed) tools.push(CREATE_REMINDER_TOOL);

  const canUseTools = tools.length > 0;
  const openaiMessages = toOpenAIMessages(systemPrompt, messages);

  // ── Step 1: non-streaming tool-check ──────────────────────
  if (canUseTools) {
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
          let places: Place[] = [];
          try {
            if (query) {
              places = await searchPlaces(query, {
                lat: userLocation!.lat,
                lng: userLocation!.lng,
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
          let offers: FlightOffer[] = [];
          let searchLink = buildGoogleFlightsUrl(params);
          let toolErr: string | undefined;
          try {
            if (params.origin && params.destination && params.departDate) {
              const result = await searchFlights(params);
              offers = result.offers;
              searchLink = result.searchLink;
            }
          } catch (err: any) {
            toolErr = err.message;
            flightProviderError = toolErr;
            console.error('search_flights error:', err.message);
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
          let hotelOffers: HotelOffer[] = [];
          let hotelSearchLink = buildHotelBookingLinks(hp)[0]!.url;
          let toolErr: string | undefined;
          try {
            if (hp.cityCode && hp.checkIn && hp.checkOut) {
              const result = await searchHotels(hp);
              hotelOffers = result.offers;
              hotelSearchLink = result.searchLink;
            }
          } catch (err: any) {
            toolErr = err.message;
            hotelProviderError = toolErr;
            console.error('search_hotels error:', err.message);
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
        } else if (name === 'create_reminder' && remindersAllowed) {
          usedTools.add('create_reminder');
          let reminder: Reminder | null = null;
          let toolErr: string | undefined;
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
        content: 'You are a helpful assistant. Return ONLY valid JSON.',
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

  const text = response.choices?.[0]?.message?.content ?? '{}';
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, text];
  try {
    return JSON.parse(jsonMatch[1]!.trim());
  } catch (err: any) {
    console.error('Failed to parse image analysis JSON:', err.message, '\nRaw text:', text);
    return { error: 'Failed to parse AI response', raw: text };
  }
}
