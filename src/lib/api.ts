import type { AgentId, Message, RichCard } from '../app/types';
import { useChatStore } from '../stores/chat';
import { useStyleStore, type StyleProfile } from '../stores/style';
import { useTravelStore } from '../stores/travel';
import { useFitnessStore } from '../stores/fitness';
import { useLocationStore } from '../stores/location';
import { getUserId } from './session';

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

/** Fetch with a timeout to prevent indefinite hangs */
function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 20000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout));
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

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop()!;

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.token) {
            store.appendToLastBot(agentId, data.token);
          }
          if (data.error) {
            // Show user-friendly message instead of raw API errors
            const friendly = data.error.includes('unsupported image')
              ? 'That image format isn\'t supported. Please try a JPEG or PNG photo!'
              : data.error.includes('Could not process')
                ? 'I couldn\'t process that image. Could you try a different photo?'
                : 'Sorry, something went wrong. Please try again!';
            store.appendToLastBot(agentId, `\n\n${friendly}`);
          }
        } catch {
          // skip malformed JSON
        }
      }
    }
  } catch {
    store.appendToLastBot(agentId, '\n\nConnection interrupted. Please try again!');
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

    // If this is the fitness agent, run class search extraction in parallel
    let fitnessPromise: Promise<RichCard[] | null> | null = null;
    if (effectiveAgent === 'fitness') {
      store.setAnalyzing(agentId, true);
      const recentContext = apiMessages.slice(-6).map((m) => ({
        role: m.role as string,
        content: typeof m.content === 'string' ? m.content : '',
      }));
      fitnessPromise = runFitnessSearch(text, agentId, recentContext);
    }

    // Stream the conversational response
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': getUserId(),
      },
      body: JSON.stringify({
        agentId: effectiveAgent,
        messages: apiMessages,
        styleProfile,
        travelProfile,
        fitnessProfile,
        userLocation: buildChatLocation(),
      }),
    });

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
          // Attach first card to the existing bot message
          store.setRichCardOnLastBot(agentId, cards[0]);

          // Add remaining cards as separate bot messages (up to 3 total)
          for (let i = 1; i < Math.min(cards.length, 3); i++) {
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
      } finally {
        store.setAnalyzing(agentId, false);
      }
    }

    // If fitness search was running, wait for it and attach cards
    if (fitnessPromise) {
      try {
        const cards = await fitnessPromise;
        if (cards && cards.length > 0) {
          store.setRichCardOnLastBot(agentId, cards[0]);

          for (let i = 1; i < Math.min(cards.length, 3); i++) {
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
      } finally {
        store.setAnalyzing(agentId, false);
      }
    }
  } catch (err: any) {
    store.appendToLastBot(
      agentId,
      err.message?.includes('API error')
        ? 'Sorry, I had trouble connecting. Please try again!'
        : `Something went wrong: ${err.message}`
    );
  } finally {
    // Ensure streaming is always reset even if an error occurred before the first reset
    store.setStreaming(agentId, false);
  }
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
        'X-User-Id': getUserId(),
      },
      body: JSON.stringify({ image: imageBase64, type }),
    });

    if (!res.ok) return null;
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

    return null;
  } catch {
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
    // Step 1: Extract structured intent from user text (with conversation context for follow-ups)
    const extractRes = await fetchWithTimeout('/api/travel/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': getUserId(),
      },
      body: JSON.stringify({ message: userText, context, userLocation: buildFullLocation() }),
    });

    if (!extractRes.ok) return null;
    const { intent } = await extractRes.json();

    if (!intent || intent.type === 'none') return null;

    // Step 2: Call the appropriate search endpoint
    if (intent.type === 'cheapest_dates') {
      const res = await fetchWithTimeout('/api/travel/cheapest-dates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': getUserId(),
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
      // Learn excluded airlines
      if (intent.params.excludedAirlineCodes?.length) {
        const store = useTravelStore.getState();
        for (const code of intent.params.excludedAirlineCodes) {
          store.addExcludedAirline(code);
        }
      }

      const res = await fetchWithTimeout('/api/travel/flights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': getUserId(),
        },
        body: JSON.stringify(intent.params),
      });

      if (!res.ok) return null;
      const { results } = await res.json();

      if (!results?.length) return null;

      // Log to recent searches
      useTravelStore.getState().addRecentSearch({
        type: 'flight_search',
        params: intent.params,
        label: `${intent.params.origin} → ${intent.params.destination}`,
      });

      return results.map((flight: any): RichCard => ({
        type: 'flight',
        data: flight,
      }));
    }

    if (intent.type === 'hotel_search') {
      const res = await fetchWithTimeout('/api/travel/hotels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': getUserId(),
        },
        body: JSON.stringify(intent.params),
      });

      if (!res.ok) return null;
      const { results } = await res.json();

      if (!results?.length) return null;

      useTravelStore.getState().addRecentSearch({
        type: 'hotel_search',
        params: intent.params,
        label: `Hotels in ${intent.params.cityCode}`,
      });

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
          'X-User-Id': getUserId(),
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

      return results.map((poi: any): RichCard => ({
        type: 'place',
        data: poi,
      }));
    }

    return null;
  } catch {
    return null;
  }
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
    // Step 1: Extract structured intent (fitness-only extraction)
    const extractRes = await fetchWithTimeout('/api/fitness/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': getUserId(),
      },
      body: JSON.stringify({ message: userText, context, userLocation: buildFullLocation() }),
    });

    if (!extractRes.ok) return null;
    const { intent } = await extractRes.json();

    if (!intent || intent.type === 'none') return null;

    // Step 2: Call Mindbody class search
    if (intent.type === 'class_search') {
      // Learn preferred class type
      if (intent.params.classType) {
        useFitnessStore.getState().addPreferredClassType(intent.params.classType);
      }

      // Attach user location if available so results are sorted by distance
      const location = useFitnessStore.getState().profile.homeLocation;
      const searchParams = {
        ...intent.params,
        ...(location ? { userLat: location.lat, userLng: location.lng } : {}),
      };

      const res = await fetchWithTimeout('/api/fitness/classes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': getUserId(),
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
        label: `${intent.params.classType || 'Fitness'} classes${intent.params.timeOfDay ? ` (${intent.params.timeOfDay})` : ''}`,
      });

      return results.map((cls: any): RichCard => ({
        type: 'fitnessClass',
        data: cls,
      }));
    }

    return null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Calendar API helpers
// ═══════════════════════════════════════════════════════════════════════

export async function fetchGoogleCalendarStatus(): Promise<{
  configured: boolean;
  connected: boolean;
}> {
  try {
    const res = await fetch('/api/calendar/google/status', {
      headers: { 'X-User-Id': getUserId() },
    });
    if (!res.ok) return { configured: false, connected: false };
    return res.json();
  } catch {
    return { configured: false, connected: false };
  }
}

export async function getGoogleAuthUrl(): Promise<string | null> {
  try {
    const res = await fetch('/api/calendar/google/auth-url', {
      headers: { 'X-User-Id': getUserId() },
    });
    if (!res.ok) return null;
    const { url } = await res.json();
    return url;
  } catch {
    return null;
  }
}

export async function disconnectGoogleCalendar(): Promise<boolean> {
  try {
    const res = await fetch('/api/calendar/google/disconnect', {
      method: 'DELETE',
      headers: { 'X-User-Id': getUserId() },
    });
    return res.ok;
  } catch {
    return false;
  }
}
