import type { AgentId, Message, RichCard } from '../app/types';
import { useChatStore } from '../stores/chat';
import { useStyleStore, type StyleProfile } from '../stores/style';
import { useTravelStore } from '../stores/travel';
import { useFitnessStore } from '../stores/fitness';
import { useLocationStore } from '../stores/location';
import { useLifestyleStore } from '../stores/lifestyle';

const CHAT_REQUEST_TIMEOUT_MS = 30000;
const STREAM_IDLE_TIMEOUT_MS = 45000;

/**
 * Convert store messages to the shape the API expects.
 * Messages with images become multimodal content arrays for GPT-4o vision.
 */
function toApiMessages(messages: Message[]) {
  return messages.map((m) => {
    // If this message has an image, build a multimodal content array
    if (m.imageUrl) {
      const parts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
      if (m.text) {
        parts.push({ type: 'text', text: m.text });
      }
      parts.push({ type: 'image_url', image_url: { url: m.imageUrl } });
      return {
        role: m.type === 'user' ? ('user' as const) : ('assistant' as const),
        content: parts,
      };
    }

    return {
      role: m.type === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.text,
    };
  });
}

/**
 * Build a metadata-only profile for the chat system prompt.
 * Strips imageUrl/thumbnailUrl to avoid wasting tokens.
 */
function buildChatProfile(profile: StyleProfile) {
  return {
    bodyType: profile.bodyType,
    skinTone: profile.skinTone,
    styleEssences: profile.styleEssences,
    budgetRange: profile.budgetRange,
    occasions: profile.occasions,
    onboardingComplete: profile.onboardingComplete,
    onboardingStep: profile.onboardingStep,
    wardrobe: {
      totalItems: profile.wardrobeItems.length,
      items: profile.wardrobeItems.map(({ id, category, color, colorHex, style, seasons, occasions, pairsWith }) =>
        ({ id, category, color, colorHex, style, seasons, occasions, pairsWith })),
    },
  };
}

/**
 * Build a lean location object for the chat system prompt (no raw lat/lng for privacy).
 */
function buildChatLocation() {
  const loc = useLocationStore.getState().location;
  if (!loc) return undefined;
  return {
    city: loc.city,
    region: loc.region,
    country: loc.country,
    timezone: loc.timezone,
    nearestAirport: loc.nearestAirport,
    hemisphere: loc.lat != null ? (loc.lat >= 0 ? 'Northern' : 'Southern') : undefined,
  };
}

/**
 * Build a full location object for search extraction (includes lat/lng for POI).
 */
function buildFullLocation() {
  const loc = useLocationStore.getState().location;
  if (!loc) return undefined;
  return {
    lat: loc.lat,
    lng: loc.lng,
    city: loc.city,
    region: loc.region,
    country: loc.country,
    timezone: loc.timezone,
    nearestAirport: loc.nearestAirport,
  };
}

const FITNESS_DISCOVERY_TERMS = [
  'yoga',
  'pilates',
  'hiit',
  'spinning',
  'spin',
  'barre',
  'boxing',
  'strength',
  'dance',
  'stretch',
  'meditation',
  'cardio',
  'bootcamp',
  'crossfit',
  'martial arts',
  'swimming',
  'climbing',
  'cycling',
  'gym',
  'studio',
  'class',
  'classes',
];

const FITNESS_SEARCH_ACTIONS = [
  'find',
  'search',
  'look for',
  'show me',
  'where can i',
  'near me',
  'nearby',
  'around me',
  'in my area',
  'book',
  'schedule',
  'available',
  'open',
  'closest',
  'recommend a gym',
  'recommend a studio',
  'sign me up',
  'reserve',
];

const FITNESS_SEARCH_REFINEMENTS = [
  'what about',
  'instead',
  'try',
  'more',
  'another',
  'other',
  'beginner',
  'advanced',
  'morning',
  'afternoon',
  'evening',
  'weekend',
  'today',
  'tomorrow',
  'this week',
  'next week',
  'closer',
  'downtown',
  'cheap',
  'cheaper',
];

const FITNESS_LOCATION_CUES = ['near me', 'nearby', 'around me', 'in my area'];
const FITNESS_TIME_CUES = ['today', 'tomorrow', 'this week', 'next week', 'this weekend', 'weekend'];
const FITNESS_VENUE_CUES = ['gym', 'studio', 'class', 'classes'];
const SHARED_LOCATION_CUES = ['near me', 'nearby', 'around me', 'in my area', 'close to me', 'walking distance'];
const PLACE_DISCOVERY_TERMS = [
  'restaurant',
  'restaurants',
  'cafe',
  'coffee',
  'bar',
  'bars',
  'museum',
  'museums',
  'park',
  'parks',
  'shopping',
  'mall',
  'things to do',
  'attractions',
  'activities',
  'places to visit',
  'food',
  'eat',
  'drink',
  'brunch',
  'hotel',
  'hotels',
  'stay',
  'lodging',
];
const PLACE_SEARCH_ACTIONS = ['find', 'search', 'show me', 'recommend', 'where can i', 'what are', 'best'];

// ── Lifestyle search heuristics ──────────────────────────────────────

const LIFESTYLE_DISCOVERY_TERMS = [
  'restaurant', 'restaurants', 'cafe', 'coffee', 'brunch', 'dinner', 'lunch',
  'dessert', 'bakery', 'bar', 'bars', 'breakfast', 'latte', 'espresso',
  'cocktail', 'cocktails', 'pizza', 'sushi', 'ramen', 'tacos', 'thai',
  'italian', 'mexican', 'chinese', 'french', 'japanese', 'korean', 'indian',
  'mediterranean', 'vegan', 'vegetarian', 'seafood', 'steak', 'bbq',
  'ice cream', 'pastry', 'diner', 'bistro', 'pub', 'wine bar',
  'food', 'eat', 'eating', 'dining', 'hungry', 'cuisine',
];

const LIFESTYLE_SEARCH_ACTIONS = [
  'find', 'search', 'show me', 'recommend', 'where', 'best', 'good',
  'near me', 'nearby', 'around me', 'in my area', 'close to me',
  'book', 'reserve', 'reservation', 'book a table',
];

const LIFESTYLE_RESERVATION_PHRASES = [
  'book', 'reserve', 'reservation', 'table for', 'book a table',
  'make a reservation', 'get a table',
];

function shouldRunLifestyleSearch(userText: string): boolean {
  const normalized = userText.toLowerCase().trim();
  if (!normalized) return false;

  // Reservation intent
  const hasReservationPhrase = LIFESTYLE_RESERVATION_PHRASES.some((t) => normalized.includes(t));
  if (hasReservationPhrase) return true;

  const hasDiscoveryTerm = LIFESTYLE_DISCOVERY_TERMS.some((t) => normalized.includes(t));
  const hasSearchAction = LIFESTYLE_SEARCH_ACTIONS.some((t) => normalized.includes(t));

  // A discovery term alone is enough — GPT extraction will determine if it's actually a search.
  // This prevents messages like "Italian restaurants" or "sushi" from being silently ignored.
  return hasDiscoveryTerm || hasSearchAction;
}

const FITNESS_BOOKING_PHRASES = [
  'book the', 'book that', 'sign me up', 'i want to go', 'reserve',
  'book it', 'book this', 'yes book', 'yeah book', 'let\'s book',
  'go ahead and book', 'confirm', 'i\'ll take',
];

function shouldRunFitnessSearch(userText: string): boolean {
  const normalized = userText.toLowerCase().trim();
  if (!normalized) return false;

  // Booking intent — user wants to book a class from recent results
  const hasBookingPhrase = FITNESS_BOOKING_PHRASES.some((term) => normalized.includes(term));
  if (hasBookingPhrase && useFitnessStore.getState().profile.lastSearchResults.length > 0) {
    return true;
  }

  const hasDiscoveryAction = FITNESS_SEARCH_ACTIONS.some((term) => normalized.includes(term));
  const hasDiscoveryTarget = FITNESS_DISCOVERY_TERMS.some((term) => normalized.includes(term));

  // A discovery target alone is enough (e.g. "yoga", "pilates near me").
  // GPT extraction will return "none" if it's not actually a search request.
  if (hasDiscoveryTarget || hasDiscoveryAction) {
    return true;
  }

  const recentFitnessSearches = useFitnessStore.getState().profile.recentSearches;
  const isRefinement = FITNESS_SEARCH_REFINEMENTS.some((term) => normalized.includes(term));
  return recentFitnessSearches.length > 0 && isRefinement;
}

function needsCurrentLocation(userText: string): boolean {
  const normalized = userText.toLowerCase();
  return SHARED_LOCATION_CUES.some((term) => normalized.includes(term));
}

function shouldRunSharedPlaceSearch(userText: string): boolean {
  const normalized = userText.toLowerCase().trim();
  if (!normalized) return false;

  const hasLocationCue = needsCurrentLocation(normalized);
  const hasDiscoveryTerm = PLACE_DISCOVERY_TERMS.some((term) => normalized.includes(term));
  const hasSearchAction = PLACE_SEARCH_ACTIONS.some((term) => normalized.includes(term));

  return (hasLocationCue && hasDiscoveryTerm) || (hasSearchAction && hasDiscoveryTerm);
}

async function ensureLocationForSearchQuery(userText: string): Promise<void> {
  if (!needsCurrentLocation(userText)) return;

  const locationStore = useLocationStore.getState();
  if (locationStore.location || locationStore.isRequesting) return;

  try {
    await locationStore.requestLocation();
  } catch {
    // Fall back to non-location search behavior if the browser denies access.
  }
}

function appendRichCards(agentId: AgentId, cards: RichCard[]) {
  const store = useChatStore.getState();
  if (!cards.length) return;

  store.setRichCardOnLastBot(agentId, cards[0]);

  for (let i = 1; i < cards.length; i++) {
    const cardMsg: Message = {
      id: crypto.randomUUID(),
      type: 'bot',
      text: '',
      timestamp: new Date(),
      agentId,
      richCard: cards[i],
    };
    store.addMessage(agentId, cardMsg);
  }
}

/** Fetch with a timeout to prevent indefinite hangs */
function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 20000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

async function readWithIdleTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number
): Promise<ReadableStreamReadResult<Uint8Array>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('STREAM_IDLE_TIMEOUT')), timeoutMs);
    reader.read().then(resolve, reject).finally(() => clearTimeout(timeout));
  });
}

/** Read an SSE stream and push tokens into the store */
async function readStream(res: Response, agentId: AgentId) {
  const store = useChatStore.getState();

  if (!res.body) {
    store.appendToLastBot(agentId, 'Sorry, I couldn\'t get a response. Please try again!');
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const processBuffer = (chunk: string) => {
    const lines = chunk.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.token) {
          store.appendToLastBot(agentId, data.token);
        }
        if (data.error) {
          const friendly = data.error.includes('unsupported image')
            ? 'That image format isn\'t supported. Please try a JPEG or PNG photo!'
            : data.error.includes('Could not process')
              ? 'I couldn\'t process that image. Could you try a different photo?'
              : 'Sorry, something went wrong. Please try again!';
          store.appendToLastBot(agentId, `\n\n${friendly}`);
        }
      } catch {
        // Skip malformed SSE payloads.
      }
    }
  };

  try {
    while (true) {
      const { done, value } = await readWithIdleTimeout(reader, STREAM_IDLE_TIMEOUT_MS);
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      processBuffer(buffer);
    }
    buffer += decoder.decode();
    processBuffer(buffer + '\n');
  } catch (err) {
    const message = err instanceof Error && err.message === 'STREAM_IDLE_TIMEOUT'
      ? '\n\nThe connection stalled. Please try again.'
      : '\n\nConnection interrupted. Please try again!';
    store.appendToLastBot(agentId, message);
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Reader may already be closed.
    }
  }
}

/**
 * Send a text message and stream the response.
 * Optionally attach an image (base64 data URL) which will be:
 *   1. Shown as a thumbnail in the user's message bubble
 *   2. Sent to GPT-4o as vision content so the Stylist can see it
 *   3. For the Style agent: also run through /api/style/analyze for a structured card
 */
export async function sendMessage(
  agentId: AgentId,
  text: string,
  imageBase64?: string,
  analysisType?: string
) {
  const store = useChatStore.getState();
  const effectiveAgent = agentId === 'all' ? 'lifestyle' : agentId;

  // Add user message (with optional image for thumbnail display)
  const userMsg: Message = {
    id: crypto.randomUUID(),
    type: 'user',
    text,
    timestamp: new Date(),
    agentId,
    imageUrl: imageBase64,
  };
  store.addMessage(agentId, userMsg);

  // Create placeholder bot message
  const botMsg: Message = {
    id: crypto.randomUUID(),
    type: 'bot',
    text: '',
    timestamp: new Date(),
    agentId,
  };
  store.addMessage(agentId, botMsg);
  store.setStreaming(agentId, true);

  try {
    const styleProfile =
      effectiveAgent === 'style' ? buildChatProfile(useStyleStore.getState().profile) : undefined;
    const travelProfile =
      effectiveAgent === 'travel' ? buildTravelProfile(useTravelStore.getState().profile) : undefined;
    const fitnessProfile =
      effectiveAgent === 'fitness' ? buildFitnessProfile(useFitnessStore.getState().profile) : undefined;
    const lifestyleProfile =
      effectiveAgent === 'lifestyle' ? buildLifestyleProfile(useLifestyleStore.getState().profile) : undefined;
    const crossAgentContext =
      effectiveAgent === 'lifestyle' ? buildCrossAgentContext() : undefined;

    const allMessages = store.getMessages(agentId);
    // Exclude the empty bot placeholder, limit to last 20 messages to prevent token overflow
    const relevantMessages = allMessages.filter((m) => m.text.length > 0 || m.imageUrl);
    const apiMessages = toApiMessages(relevantMessages.slice(-20));

    // If this is the style agent and an image was sent, run structured analysis
    // in parallel with the streaming chat response
    let analysisPromise: Promise<RichCard | null> | null = null;
    if (effectiveAgent === 'style' && imageBase64) {
      store.setAnalyzing(agentId, true);
      analysisPromise = runStyleAnalysis(imageBase64, text, agentId, analysisType);
    }

    // If this is the travel agent, run search extraction in parallel
    let travelPromise: Promise<RichCard[] | null> | null = null;
    if (effectiveAgent === 'travel') {
      store.setAnalyzing(agentId, true);
      // Pass recent conversation context so follow-ups ("find nonstop") work
      const recentContext = apiMessages.slice(-6).map((m) => ({
        role: m.role as string,
        content: typeof m.content === 'string' ? m.content : '',
      }));
      travelPromise = runTravelSearch(text, agentId, recentContext);
    }

    // If this is the fitness agent, only run discovery when the user explicitly asks to find places/classes
    let fitnessPromise: Promise<RichCard[] | null> | null = null;
    if (effectiveAgent === 'fitness' && shouldRunFitnessSearch(text)) {
      store.setAnalyzing(agentId, true);
      const recentContext = apiMessages.slice(-6).map((m) => ({
        role: m.role as string,
        content: typeof m.content === 'string' ? m.content : '',
      }));
      fitnessPromise = runFitnessSearch(text, agentId, recentContext);
    }

    // Lifestyle agent: use dedicated lifestyle search pipeline (restaurants, cafes, reservations)
    // Falls back to shared place search for generic POI queries
    let lifestylePromise: Promise<RichCard[] | null> | null = null;
    if (effectiveAgent === 'lifestyle') {
      if (shouldRunLifestyleSearch(text)) {
        store.setAnalyzing(agentId, true);
        const recentContext = apiMessages.slice(-6).map((m) => ({
          role: m.role as string,
          content: typeof m.content === 'string' ? m.content : '',
        }));
        lifestylePromise = runLifestyleSearch(text, agentId, recentContext);
      } else if (shouldRunSharedPlaceSearch(text)) {
        store.setAnalyzing(agentId, true);
        const recentContext = apiMessages.slice(-6).map((m) => ({
          role: m.role as string,
          content: typeof m.content === 'string' ? m.content : '',
        }));
        lifestylePromise = runSharedPlaceSearch(text, recentContext);
      }
    }

    // Stream the conversational response
    const res = await fetchWithTimeout('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agentId: effectiveAgent,
        messages: apiMessages,
        styleProfile,
        travelProfile,
        fitnessProfile,
        lifestyleProfile,
        crossAgentContext,
        userLocation: buildChatLocation(),
      }),
    }, CHAT_REQUEST_TIMEOUT_MS);

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    await readStream(res, agentId);

    // Re-enable user input immediately after stream finishes.
    // Travel/analysis results will attach cards in the background.
    store.setStreaming(agentId, false);

    // If analysis was running, wait for it and attach the card
    if (analysisPromise) {
      try {
        const richCard = await analysisPromise;
        if (richCard) {
          store.setRichCardOnLastBot(agentId, richCard);
        }
      } finally {
        store.setAnalyzing(agentId, false);
      }
    }

    // If travel search was running, wait for it and attach cards
    if (travelPromise) {
      try {
        const cards = await travelPromise;
        if (cards && cards.length > 0) {
          appendRichCards(agentId, cards);
        }
      } finally {
        store.setAnalyzing(agentId, false);
      }
    }

    // If fitness search was running, wait for it and attach cards
    if (fitnessPromise) {
      try {
        const cards = await fitnessPromise;
        if (cards && cards.length > 0) {
          appendRichCards(agentId, cards);
        }
      } finally {
        store.setAnalyzing(agentId, false);
      }
    }

    if (lifestylePromise) {
      try {
        const cards = await lifestylePromise;
        if (cards && cards.length > 0) {
          appendRichCards(agentId, cards);
        }
      } finally {
        store.setAnalyzing(agentId, false);
      }
    }
  } catch (err: any) {
    const message = err?.name === 'AbortError'
      ? 'The request timed out. Please try again!'
      : err.message?.includes('API error')
        ? 'Sorry, I had trouble connecting. Please try again!'
        : `Something went wrong: ${err.message}`;
    store.appendToLastBot(
      agentId,
      message
    );
  } finally {
    // Ensure streaming is always reset even if an error occurred before the first reset
    store.setStreaming(agentId, false);
    await store.saveAgentHistory(agentId);
  }
}

// ── Flight Booking API ──────────────────────────────────────────────────

export async function startFlightBooking(
  flightData: any,
  passengerInfo: { firstName: string; lastName: string; email: string; phone?: string }
): Promise<{ jobId: string }> {
  const res = await fetch('/api/travel/book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flightData, passengerInfo }),
  });
  if (!res.ok) throw new Error('Failed to start booking');
  return res.json();
}

export function streamBookingStatus(
  jobId: string,
  onStatus: (data: any) => void
): { stop: () => void } {
  let active = true;
  const interval = setInterval(async () => {
    if (!active) return;
    try {
      const res = await fetch(`/api/travel/book/${jobId}/status`);
      if (!res.ok) return;
      const data = await res.json();
      onStatus(data);
      if (data.status === 'completed' || data.status === 'failed') {
        clearInterval(interval);
      }
    } catch {
      // Retry silently
    }
  }, 2000);

  // Auto-stop after 2 minutes
  setTimeout(() => {
    active = false;
    clearInterval(interval);
  }, 120000);

  return {
    stop: () => {
      active = false;
      clearInterval(interval);
    },
  };
}

export async function addBookingToCalendar(jobId: string): Promise<{ eventId: string }> {
  const res = await fetch(`/api/travel/book/${jobId}/calendar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to add to calendar');
  return res.json();
}

/**
 * Determine the analysis type from the user's text and run /api/style/analyze.
 * Returns a RichCard if successful, null otherwise.
 */
async function runStyleAnalysis(
  imageBase64: string,
  userText: string,
  agentId: AgentId,
  explicitType?: string
): Promise<RichCard | null> {
  // Use explicit type if provided (from intent chips), otherwise infer from text
  let type: 'skin_tone' | 'outfit_rating' | 'clothing_tag' = 'skin_tone';
  if (explicitType && ['skin_tone', 'outfit_rating', 'clothing_tag'].includes(explicitType)) {
    type = explicitType as typeof type;
  } else {
    const lower = userText.toLowerCase();
    if (lower.includes('outfit') || lower.includes('rate') || lower.includes('wearing') || lower.includes('look')) {
      type = 'outfit_rating';
    } else if (
      lower.includes('wardrobe') ||
      lower.includes('clothing') ||
      lower.includes('tag') ||
      lower.includes('item')
    ) {
      type = 'clothing_tag';
    }
  }

  try {
    const res = await fetch('/api/style/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: imageBase64, type }),
    });

    if (!res.ok) {
      console.warn('[style] /api/style/analyze returned', res.status);
      return null;
    }
    const { result } = await res.json();

    if (type === 'skin_tone' && result?.season && result?.bestColors) {
      // Save to style profile
      useStyleStore.getState().setSkinTone({
        depth: result.depth,
        undertone: result.undertone,
        season: result.season,
        bestColors: result.bestColors,
        bestMetals: result.bestMetals,
      });

      return {
        type: 'colorSeason',
        data: {
          season: result.season,
          colors: result.bestColors,
          metals: result.bestMetals,
          avoidColors: result.avoidColors,
        },
      };
    }

    if (type === 'outfit_rating' && result?.score != null) {
      return {
        type: 'outfit',
        data: result,
      };
    }

    if (type === 'clothing_tag' && result?.category) {
      // Upload to Cloudinary via server + add to wardrobe
      const item = await useStyleStore.getState().uploadAndAddItem(imageBase64, {
        category: result.category,
        color: result.color,
        colorHex: result.colorHex,
        style: result.style,
        seasons: result.seasons,
        occasions: result.occasions,
        pairsWith: result.pairsWith,
      });

      return {
        type: 'wardrobeItem',
        data: {
          category: result.category,
          color: result.color,
          colorHex: result.colorHex,
          style: result.style,
          seasons: result.seasons,
          occasions: result.occasions,
          pairsWith: result.pairsWith,
          imageUrl: item?.imageUrl,
          thumbnailUrl: item?.thumbnailUrl,
        },
      };
    }

    console.warn('[style] Analysis returned unexpected result shape:', result);
    return null;
  } catch (err) {
    console.warn('[style] runStyleAnalysis failed:', err);
    return null;
  }
}

/**
 * Build a lean travel profile for the chat system prompt.
 */
function buildTravelProfile(profile: import('../stores/travel').TravelProfile) {
  return {
    homeAirport: profile.homeAirport,
    preferredCabin: profile.preferredCabin,
    preferredCurrency: profile.preferredCurrency,
    maxPricePreference: profile.maxPricePreference,
    preferredAirlines: profile.preferredAirlines || [],
    excludedAirlines: profile.excludedAirlines || [],
    recentSearches: (profile.recentSearches || []).slice(0, 3).map(({ type, label }) => ({ type, label })),
    bookmarks: (profile.bookmarks || []).slice(0, 5).map(({ type, label }) => ({ type, label })),
    tripSelections: (profile.tripSelections || []).map(({ type, label, data }) => ({
      type,
      label,
      price: data.price || data.totalPrice || data.pricePerNight || null,
      route: type === 'flight' ? `${data.departure?.city} → ${data.arrival?.city}` : null,
      dates: type === 'flight'
        ? { departure: data.departureDate, arrival: data.arrivalDate }
        : { checkIn: data.checkIn, checkOut: data.checkOut },
    })),
  };
}

/**
 * Run travel search in parallel with the SSE stream.
 * Calls /api/travel/extract to get structured params, then the appropriate search endpoint.
 * Returns an array of RichCards if successful, null otherwise.
 */
async function runTravelSearch(
  userText: string,
  agentId: AgentId,
  context?: Array<{ role: string; content: string }>
): Promise<RichCard[] | null> {
  try {
    await ensureLocationForSearchQuery(userText);

    // Include the last successful search intent so GPT can carry forward params for follow-ups
    const lastSearchIntent = useTravelStore.getState().profile.lastSearchIntent || undefined;

    // Step 1: Extract structured intent from user text (with conversation context for follow-ups)
    const extractRes = await fetchWithTimeout('/api/travel/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: userText, context, userLocation: buildFullLocation(), lastSearchIntent }),
    });

    if (!extractRes.ok) {
      console.warn('[travel] /api/travel/extract returned', extractRes.status);
      return null;
    }
    const { intent } = await extractRes.json();

    if (!intent || intent.type === 'none') {
      console.info('[travel] Intent extraction returned "none" for:', userText.slice(0, 80));
      return null;
    }

    // Step 2: Call the appropriate search endpoint
    if (intent.type === 'cheapest_dates') {
      const res = await fetchWithTimeout('/api/travel/cheapest-dates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(intent.params),
      });

      if (!res.ok) return null;
      const { results, origin, destination } = await res.json();

      if (!results?.length) return null;

      useTravelStore.getState().addRecentSearch({
        type: 'cheapest_dates',
        params: intent.params,
        label: `Cheapest dates: ${intent.params.origin} → ${intent.params.destination}`,
      });
      useTravelStore.getState().setLastSearchIntent(intent);

      return [{
        type: 'cheapestDates',
        data: { origin, destination, results },
      }];
    }

    if (intent.type === 'flight_search') {
      // Learn maxPrice preference if user specified one
      if (intent.params.maxPrice) {
        useTravelStore.getState().setMaxPricePreference(intent.params.maxPrice);
      }
      // Learn preferred airlines when user explicitly requests them
      if (intent.params.includedAirlineCodes?.length) {
        const store = useTravelStore.getState();
        for (const code of intent.params.includedAirlineCodes) {
          store.addPreferredAirline(code);
        }
      }
      // Learn excluded airlines
      if (intent.params.excludedAirlineCodes?.length) {
        const store = useTravelStore.getState();
        for (const code of intent.params.excludedAirlineCodes) {
          store.addExcludedAirline(code);
        }
      }

      // Merge stored airline preferences when GPT didn't extract explicit ones
      const profile = useTravelStore.getState().profile;
      const flightParams = { ...intent.params };
      if (!flightParams.includedAirlineCodes?.length && profile.preferredAirlines?.length) {
        flightParams.includedAirlineCodes = profile.preferredAirlines;
      }
      if (!flightParams.excludedAirlineCodes?.length && profile.excludedAirlines?.length) {
        flightParams.excludedAirlineCodes = profile.excludedAirlines;
      }

      const res = await fetchWithTimeout('/api/travel/flights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(flightParams),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        console.warn('[travel] /api/travel/flights returned', res.status, errBody.slice(0, 200));
        return null;
      }
      const { results } = await res.json();

      if (!results?.length) {
        // Tell the user no results were found with details about what was searched
        const airlineNote = flightParams.includedAirlineCodes?.length
          ? ` on ${flightParams.includedAirlineCodes.join(', ')}`
          : '';
        const store = useChatStore.getState();
        const noResultMsg: Message = {
          id: crypto.randomUUID(),
          type: 'bot',
          text: `I couldn't find any flights${airlineNote} from ${flightParams.origin} to ${flightParams.destination} on ${flightParams.departureDate}. Try broadening your search — different dates, removing the airline filter, or checking nearby airports.`,
          timestamp: new Date(),
          agentId: 'travel' as AgentId,
        };
        store.addMessage('travel' as AgentId, noResultMsg);
        return null;
      }

      // Log to recent searches
      useTravelStore.getState().addRecentSearch({
        type: 'flight_search',
        params: intent.params,
        label: `${intent.params.origin} → ${intent.params.destination}`,
      });
      useTravelStore.getState().setLastSearchIntent(intent);

      // Cross-agent signal: travel destination
      emitLifestyleSignal('travel_destination', intent.params.destination);

      return results.map((flight: any): RichCard => ({
        type: 'flight',
        data: flight,
      }));
    }

    if (intent.type === 'hotel_search') {
      const hotelParams = { ...intent.params };

      const res = await fetchWithTimeout('/api/travel/hotels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(hotelParams),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        console.warn('[travel] /api/travel/hotels returned', res.status, errBody.slice(0, 200));
        return null;
      }
      const { results } = await res.json();

      if (!results?.length) {
        const store = useChatStore.getState();
        const noResultMsg: Message = {
          id: crypto.randomUUID(),
          type: 'bot',
          text: `I couldn't find any hotels in ${hotelParams.cityName || hotelParams.cityCode} for those dates. Try adjusting your dates, budget, or star rating filters.`,
          timestamp: new Date(),
          agentId: 'travel' as AgentId,
        };
        store.addMessage('travel' as AgentId, noResultMsg);
        return null;
      }

      // Build a descriptive search label
      const pricePart = hotelParams.priceMin && hotelParams.priceMax
        ? ` $${hotelParams.priceMin}-$${hotelParams.priceMax}/night`
        : hotelParams.priceMax
          ? ` under $${hotelParams.priceMax}/night`
          : '';
      const ratingPart = hotelParams.ratings?.length
        ? ` ${hotelParams.ratings.join('-')}★`
        : '';

      useTravelStore.getState().addRecentSearch({
        type: 'hotel_search',
        params: hotelParams,
        label: `Hotels in ${hotelParams.cityCode}${ratingPart}${pricePart}`,
      });
      useTravelStore.getState().setLastSearchIntent(intent);

      return results.map((hotel: any): RichCard => ({
        type: 'hotel',
        data: hotel,
      }));
    }

    if (intent.type === 'poi_search') {
      const { textQuery, latitude, longitude, radius, types, cityName } = intent.params;

      const res = await fetchWithTimeout('/api/travel/pois', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ textQuery, latitude, longitude, radius, types, cityName }),
      });

      if (!res.ok) return null;
      const { results } = await res.json();

      if (!results?.length) return null;

      useTravelStore.getState().addRecentSearch({
        type: 'poi_search',
        params: intent.params,
        label: textQuery || `Things to do in ${cityName || 'area'}`,
      });
      useTravelStore.getState().setLastSearchIntent(intent);

      // Use restaurant card for restaurant/dining searches
      const isRestaurantSearch = (types || []).some((t: string) =>
        ['restaurant', 'cafe', 'bar', 'meal_delivery', 'meal_takeaway'].includes(t)
      ) || /restaurant|dining|eat|food|brunch|lunch|dinner|sushi|pizza|thai|indian|mexican|italian|chinese|french|japanese|korean/i.test(textQuery || '');

      return results.map((poi: any): RichCard => ({
        type: isRestaurantSearch ? 'restaurant' : 'place',
        data: poi,
      }));
    }

    return null;
  } catch (err) {
    console.warn('[travel] runTravelSearch failed:', err);
    return null;
  }
}

async function runSharedPlaceSearch(
  userText: string,
  context?: Array<{ role: string; content: string }>
): Promise<RichCard[] | null> {
  try {
    await ensureLocationForSearchQuery(userText);

    const extractRes = await fetchWithTimeout('/api/travel/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: userText, context, userLocation: buildFullLocation() }),
    });

    if (!extractRes.ok) return null;
    const { intent } = await extractRes.json();

    if (!intent || intent.type !== 'poi_search') return null;

    const { textQuery, latitude, longitude, radius, types, cityName } = intent.params;

    const res = await fetchWithTimeout('/api/travel/pois', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ textQuery, latitude, longitude, radius, types, cityName }),
    });

    if (!res.ok) return null;
    const { results } = await res.json();

    if (!results?.length) return null;

    return results.map((poi: any): RichCard => ({
      type: 'place',
      data: poi,
    }));
  } catch (err) {
    console.warn('[travel] runSharedPlaceSearch failed:', err);
    return null;
  }
}

/**
 * Run lifestyle search (restaurants, cafes, reservations) in parallel with chat.
 * Only fires for the lifestyle agent.
 */
async function runLifestyleSearch(
  userText: string,
  agentId: AgentId,
  context?: Array<{ role: string; content: string }>
): Promise<RichCard[] | null> {
  try {
    await ensureLocationForSearchQuery(userText);

    // Step 1: Extract structured intent
    const extractRes = await fetchWithTimeout('/api/lifestyle/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userText, context, userLocation: buildFullLocation() }),
    });

    if (!extractRes.ok) {
      console.warn('[lifestyle] /api/lifestyle/extract returned', extractRes.status);
      return null;
    }
    const { intent } = await extractRes.json();

    if (!intent || intent.type === 'none' || intent.type === 'recommendation') {
      console.info('[lifestyle] Intent extraction returned', intent?.type || 'null', 'for:', userText.slice(0, 80));
      return null;
    }

    // Step 2: Restaurant or coffee search
    if (intent.type === 'restaurant_search' || intent.type === 'coffee_search') {
      const searchParams = {
        textQuery: intent.params.textQuery,
        latitude: intent.params.latitude,
        longitude: intent.params.longitude,
        radius: intent.params.radius,
        types: intent.params.types || (intent.type === 'coffee_search' ? ['cafe'] : ['restaurant']),
        cuisine: intent.params.cuisine,
        cityName: intent.params.cityName,
      };

      const res = await fetchWithTimeout('/api/lifestyle/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchParams),
      });

      if (!res.ok) return null;
      const { results } = await res.json();

      if (!results?.length) return null;

      // Fire-and-forget observation signal
      const signalKey = intent.params.cuisine || (intent.type === 'coffee_search' ? 'coffee' : 'dining');
      emitLifestyleSignal(intent.type === 'coffee_search' ? 'coffee' : 'cuisine', signalKey);

      // Store last search results in lifestyle store
      useLifestyleStore.getState().setLastSearchResults(results);
      useLifestyleStore.getState().addRecentSearch({
        type: intent.type,
        params: intent.params,
        label: intent.params.textQuery || `${intent.params.cuisine || ''} ${intent.type === 'coffee_search' ? 'cafes' : 'restaurants'}`.trim(),
      });

      return results.map((place: any): RichCard => ({
        type: 'restaurant',
        data: place,
      }));
    }

    // Step 3: Reservation — find the place first if needed, then book
    if (intent.type === 'reservation') {
      const { restaurantName, date, time, partySize } = intent.params;

      if (!restaurantName) return null;

      // Search for the restaurant to get its details
      const searchRes = await fetchWithTimeout('/api/lifestyle/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textQuery: restaurantName,
          latitude: intent.params.latitude || buildFullLocation()?.lat,
          longitude: intent.params.longitude || buildFullLocation()?.lng,
          types: ['restaurant'],
        }),
      });

      if (!searchRes.ok) return null;
      const { results } = await searchRes.json();

      if (!results?.length) return null;

      const restaurant = results[0];

      // If all required params present, make the reservation
      if (date && time && partySize) {
        try {
          const reserveRes = await fetchWithTimeout('/api/dining/reserve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              restaurantName: restaurant.name || restaurantName,
              restaurantPlaceId: restaurant.id,
              restaurantEmail: restaurant.email || null,
              restaurantPhone: restaurant.phone || null,
              restaurantAddress: restaurant.address,
              date,
              time,
              partySize,
              specialRequests: intent.params.specialRequests || null,
            }),
          });

          if (reserveRes.ok) {
            const reservation = await reserveRes.json();
            emitLifestyleSignal('reservation_made', restaurantName, intent.params.cuisine);

            return [{
              type: 'reservationConfirmation',
              data: {
                reservationId: reservation.id,
                restaurantName: restaurant.name || restaurantName,
                restaurantAddress: restaurant.address,
                restaurantPhone: restaurant.phone,
                restaurantGoogleMapsUrl: restaurant.googleMapsUrl,
                date,
                time,
                partySize,
                status: reservation.status || 'saved',
                emailSent: reservation.emailSent || false,
              },
            }];
          }
        } catch {
          // Reservation failed — show the restaurant card instead so user can use modal
        }
      }

      // Missing params or reservation failed — show restaurant card, let GPT ask for details
      return results.slice(0, 1).map((place: any): RichCard => ({
        type: 'restaurant',
        data: place,
      }));
    }

    return null;
  } catch (err) {
    console.warn('[lifestyle] runLifestyleSearch failed:', err);
    return null;
  }
}

/** Fire-and-forget lifestyle observation signal */
function emitLifestyleSignal(type: string, key: string, value?: string) {
  fetch('/api/lifestyle/observe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, key, value }),
  }).catch(() => {});
}

/**
 * Build a lean fitness profile for the chat system prompt.
 */
function buildFitnessProfile(profile: import('../stores/fitness').FitnessProfile) {
  return {
    homeLocation: profile.homeLocation,
    preferredClassTypes: profile.preferredClassTypes || [],
    preferredTimes: profile.preferredTimes || [],
    fitnessLevel: profile.fitnessLevel,
    recentSearches: (profile.recentSearches || []).slice(0, 3).map(({ type, label }) => ({ type, label })),
    bookmarks: (profile.bookmarks || []).slice(0, 5).map(({ type, label }) => ({ type, label })),
    schedule: (profile.schedule || []).map(({ type, label, data }) => ({
      type,
      label,
      className: data.className || null,
      date: data.date || null,
      time: data.time || null,
    })),
  };
}

/**
 * Run fitness class search in parallel with the SSE stream.
 * Only fires for the fitness agent — never for travel, style, or lifestyle.
 */
async function runFitnessSearch(
  userText: string,
  agentId: AgentId,
  context?: Array<{ role: string; content: string }>
): Promise<RichCard[] | null> {
  try {
    await ensureLocationForSearchQuery(userText);

    // Step 1: Extract structured intent (fitness-only extraction)
    const extractRes = await fetchWithTimeout('/api/fitness/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: userText, context, userLocation: buildFullLocation() }),
    });

    if (!extractRes.ok) {
      console.warn('[fitness] /api/fitness/extract returned', extractRes.status);
      return null;
    }
    const { intent } = await extractRes.json();

    if (!intent || intent.type === 'none') {
      console.info('[fitness] Intent extraction returned "none" for:', userText.slice(0, 80));
      return null;
    }

    // Step 2: Search for gyms/studios via Google Places
    if (intent.type === 'studio_search') {
      // Learn preferred class type
      if (intent.params.classType) {
        useFitnessStore.getState().addPreferredClassType(intent.params.classType);
      }

      // Attach user location if available for proximity-based results
      const location = useFitnessStore.getState().profile.homeLocation;
      const searchParams = {
        ...intent.params,
        ...(location && !intent.params.userLat ? { userLat: location.lat, userLng: location.lng } : {}),
      };

      const res = await fetchWithTimeout('/api/fitness/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchParams),
      });

      if (!res.ok) return null;
      const { results } = await res.json();

      if (!results?.length) return null;

      // Log to recent searches
      useFitnessStore.getState().addRecentSearch({
        type: 'class_search',
        params: intent.params,
        label: `${intent.params.classType || 'Fitness'} studios${intent.params.cityName ? ` in ${intent.params.cityName}` : ' nearby'}`,
      });

      return results.map((studio: any): RichCard => ({
        type: 'fitnessStudio',
        data: studio,
      }));
    }

    // Step 2b: Search for individual classes (flattened)
    if (intent.type === 'class_search') {
      if (intent.params.classType) {
        useFitnessStore.getState().addPreferredClassType(intent.params.classType);
      }

      const location = useFitnessStore.getState().profile.homeLocation;
      const searchParams = {
        ...intent.params,
        ...(location && !intent.params.userLat ? { userLat: location.lat, userLng: location.lng } : {}),
      };

      const res = await fetchWithTimeout('/api/fitness/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchParams),
      });

      if (!res.ok) return null;
      const { results } = await res.json();

      if (!results?.length) return null;

      // Store results so book_class can reference them
      useFitnessStore.getState().setLastSearchResults(results);

      useFitnessStore.getState().addRecentSearch({
        type: 'class_search',
        params: intent.params,
        label: `${intent.params.classType || 'Fitness'} classes${intent.params.timePreference ? ` (${intent.params.timePreference})` : ''}${intent.params.cityName ? ` in ${intent.params.cityName}` : ' nearby'}`,
      });

      // Cross-agent signal: fitness class preference
      if (intent.params.classType) {
        emitLifestyleSignal('fitness_class', intent.params.classType, intent.params.timePreference);
      }

      return results.map((cls: any): RichCard => ({
        type: 'fitnessClass',
        data: {
          classId: cls.classId,
          className: cls.className,
          classDescription: '',
          instructor: cls.instructor,
          studioName: cls.studioName,
          studioAddress: cls.studioAddress,
          startDateTime: '',
          date: cls.date,
          time: cls.time,
          duration: cls.duration,
          spotsRemaining: cls.spotsRemaining,
          maxCapacity: 0,
          isAvailable: true,
          isCanceled: false,
          isWaitlistAvailable: false,
          difficulty: cls.level || null,
          category: cls.category,
          bookingStatus: cls.spotsRemaining === 0 ? 'full' : 'available',
          siteId: cls.mindbodySiteId || '',
          studioLat: cls.studioLat,
          studioLng: cls.studioLng,
          distance: cls.distance || null,
          // Extended fields for booking
          bookingPlatform: cls.bookingPlatform,
          bookingUrl: cls.bookingUrl,
          mindbodySiteId: cls.mindbodySiteId,
          mindbodyClassId: cls.mindbodyClassId,
          studioWebsite: cls.studioWebsite,
          studioGoogleMapsUrl: cls.studioGoogleMapsUrl,
        },
      }));
    }

    // Step 2c: Book a class from recent results
    if (intent.type === 'book_class') {
      const store = useFitnessStore.getState();
      const lastResults = store.profile.lastSearchResults;

      if (!lastResults?.length) return null;

      // Match the class — by index, name, or time
      let matchedClass = null;
      const { classIndex, className, time, studioName } = intent.params;

      if (classIndex != null && lastResults[classIndex]) {
        matchedClass = lastResults[classIndex];
      } else if (className || time) {
        matchedClass = lastResults.find((c: any) => {
          const nameMatch = !className || c.className?.toLowerCase().includes(className.toLowerCase());
          const timeMatch = !time || c.time?.includes(time);
          const studioMatch = !studioName || c.studioName?.toLowerCase().includes(studioName.toLowerCase());
          return nameMatch && timeMatch && studioMatch;
        });
      }

      if (!matchedClass) {
        matchedClass = lastResults[0]; // Default to first result
      }

      const platform = matchedClass.bookingPlatform || 'manual';
      const booking = await store.bookClass(matchedClass, platform);

      if (!booking) return null;

      return [{
        type: 'bookingConfirmation',
        data: {
          bookingId: booking.id,
          className: booking.className,
          instructor: booking.instructor,
          studioName: booking.studioName,
          studioAddress: booking.studioAddress,
          date: booking.date,
          time: booking.time,
          duration: booking.duration,
          category: booking.category,
          bookingPlatform: booking.bookingPlatform,
          bookingStatus: booking.bookingStatus,
          bookingUrl: booking.bookingUrl,
          studioGoogleMapsUrl: matchedClass.studioGoogleMapsUrl,
        },
      }];
    }

    return null;
  } catch (err) {
    console.warn('[fitness] runFitnessSearch failed:', err);
    return null;
  }
}

/**
 * Build a lean lifestyle profile for the chat system prompt.
 */
function buildLifestyleProfile(profile: import('../stores/lifestyle').LifestyleProfile) {
  return {
    preferredCuisines: profile.preferredCuisines || [],
    coffeeDrinkPreferences: profile.coffeeDrinkPreferences || [],
    preferredPriceLevels: profile.preferredPriceLevels || [],
    favoriteRestaurants: (profile.favoriteRestaurants || []).slice(0, 5).map(({ name, cuisine }) => ({ name, cuisine })),
    frequentLocations: (profile.frequentLocations || []).slice(0, 3),
    activityPatterns: (profile.activityPatterns || []).slice(0, 3),
    recentSearches: (profile.recentSearches || []).slice(0, 3).map(({ type, label }) => ({ type, label })),
  };
}

/**
 * Build cross-agent context snapshot for The Curator's system prompt.
 * Pulls relevant data from other agent stores.
 */
function buildCrossAgentContext() {
  const fitnessProfile = useFitnessStore.getState().profile;
  const travelProfile = useTravelStore.getState().profile;
  const lifestyleProfile = useLifestyleStore.getState().profile;

  return {
    upcomingFitnessClasses: (fitnessProfile.schedule || []).slice(0, 3).map(({ label, data }) => ({
      label,
      date: data.date,
      time: data.time,
      studioName: data.studioName,
    })),
    savedTravelDestinations: (travelProfile.bookmarks || []).slice(0, 3).map(({ type, label }) => ({ type, label })),
    recentTravelSearches: (travelProfile.recentSearches || []).slice(0, 2).map(({ label }) => label),
    recentDiningSearches: (lifestyleProfile.recentSearches || []).slice(0, 3).map(({ label }) => label),
    favoriteRestaurants: (lifestyleProfile.favoriteRestaurants || []).slice(0, 3).map(({ name }) => name),
    fitnessPreferences: {
      classTypes: fitnessProfile.preferredClassTypes?.slice(0, 3) || [],
      times: fitnessProfile.preferredTimes?.slice(0, 2) || [],
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Calendar API helpers
// ═══════════════════════════════════════════════════════════════════════

export async function fetchGoogleCalendarStatus(): Promise<{
  configured: boolean;
  connected: boolean;
}> {
  try {
    const res = await fetch('/api/calendar/google/status');
    if (!res.ok) return { configured: false, connected: false };
    return res.json();
  } catch {
    return { configured: false, connected: false };
  }
}

export async function disconnectGoogleCalendar(): Promise<boolean> {
  try {
    const res = await fetch('/api/calendar/google/disconnect', {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}
