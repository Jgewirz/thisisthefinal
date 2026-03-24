import OpenAI from 'openai';
import { getAgentConfig, buildSystemPrompt } from '../config/agents.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export async function* streamChat(
  agentId: string,
  messages: ChatMessage[],
  styleProfile?: object,
  travelProfile?: object,
  fitnessProfile?: object,
  userLocation?: object,
  lifestyleProfile?: object,
  crossAgentContext?: object
): AsyncGenerator<string> {
  const config = getAgentConfig(agentId);
  const systemPrompt = buildSystemPrompt(agentId, styleProfile, travelProfile, fitnessProfile, userLocation, lifestyleProfile, crossAgentContext);

  const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system' as const, content: systemPrompt },
    ...messages.map((m): OpenAI.Chat.Completions.ChatCompletionMessageParam => {
      if (m.role === 'assistant') {
        return { role: 'assistant', content: typeof m.content === 'string' ? m.content : '' };
      }
      return { role: 'user', content: m.content as any };
    }),
  ];

  const stream = await openai.chat.completions.create({
    model: config.model,
    messages: openaiMessages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      yield delta;
    }
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

  const response = await openai.chat.completions.create({
    model: process.env.STYLE_VISION_MODEL || process.env.OPENAI_MODEL || 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompts[analysisType] },
          { type: 'image_url', image_url: { url: imageBase64 } },
        ],
      },
    ],
    temperature: parseFloat(process.env.STYLE_VISION_TEMPERATURE || '0.3'),
    max_tokens: 1000,
  });

  const text = response.choices[0]?.message?.content ?? '{}';
  // Extract JSON from possible markdown code fences
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, text];
  const raw = jsonMatch[1]!.trim();

  try {
    return JSON.parse(raw);
  } catch {
    // Try to find a JSON object in the response text
    const objectMatch = raw.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }
    throw new Error('Failed to parse image analysis response as JSON');
  }
}

// ── Travel intent extraction ───────────────────────────────────────────

export interface TravelIntent {
  type: 'flight_search' | 'hotel_search' | 'poi_search' | 'cheapest_dates' | 'none';
  params: Record<string, any>;
}

export async function extractTravelParams(
  message: string,
  context?: Array<{ role: string; content: string }>,
  userLocation?: { city?: string; region?: string; country?: string; nearestAirport?: string; lat?: number; lng?: number; timezone?: string },
  lastSearchIntent?: { type: string; params: Record<string, any> }
): Promise<TravelIntent> {
  const today = new Date().toISOString().split('T')[0];

  let locationRules = '';
  if (userLocation) {
    if (userLocation.nearestAirport) {
      locationRules += `\n- User's home airport is ${userLocation.nearestAirport} (${userLocation.city || 'unknown city'}). Use as default origin when user doesn't specify an origin.`;
    }
    if (userLocation.lat != null && userLocation.lng != null) {
      locationRules += `\n- User's location is (${userLocation.lat}, ${userLocation.lng}). Use for POI searches when user says "near me" or doesn't specify a location.`;
    }
    if (userLocation.city) {
      locationRules += `\n- User is in ${userLocation.city}${userLocation.region ? `, ${userLocation.region}` : ''}. Use this city name for "near me" textQuery in POI searches.`;
    }
  }

  let lastSearchContext = '';
  if (lastSearchIntent) {
    lastSearchContext = `\n\nLAST SUCCESSFUL SEARCH (use these params as the base for follow-up refinements):\n${JSON.stringify(lastSearchIntent)}\nIf the user's message refines, adjusts, or continues this search, carry forward ALL params from above and only change what the user specifies. You MUST return the same type (e.g. "hotel_search") — do NOT return "none" for follow-ups.`;
  }

  const systemPrompt = `You extract structured travel search parameters from natural language. Today's date is ${today}.${lastSearchContext}

Return ONLY valid JSON in one of these formats:

For flights:
{"type":"flight_search","params":{"origin":"JFK","destination":"NRT","departureDate":"2026-06-01","returnDate":"2026-06-15","adults":1,"cabinClass":"ECONOMY","nonStop":false,"maxPrice":null,"includedAirlineCodes":null,"excludedAirlineCodes":null}}

For cheapest/flexible date searches:
{"type":"cheapest_dates","params":{"origin":"JFK","destination":"NRT","departureDate":"2026-06-01"}}

For hotels:
{"type":"hotel_search","params":{"cityCode":"NYC","cityName":"New York City","checkIn":"2026-06-01","checkOut":"2026-06-05","adults":1,"priceMin":null,"priceMax":null,"ratings":null,"boardType":null}}

For points of interest / things to do / restaurants / places:
{"type":"poi_search","params":{"textQuery":"best sushi restaurants in Tokyo","latitude":35.6762,"longitude":139.6503,"cityName":"Tokyo","types":["restaurant"]}}

For non-travel messages:
{"type":"none","params":{}}

GENERAL RULES:
- Resolve city names to IATA city codes for hotels (New York→NYC, London→LON, Tokyo→TYO, Paris→PAR, Los Angeles→LAX, Chicago→CHI, Miami→MIA, San Francisco→SFO, Las Vegas→LAS, Boston→BOS, Washington DC→WAS, Seattle→SEA, Dallas→DFW, Atlanta→ATL, Denver→DEN, Orlando→MCO, Nashville→BNA, New Orleans→MSY, Honolulu→HNL, Barcelona→BCN, Rome→ROM, Dubai→DXB, Bangkok→BKK, Singapore→SIN, Sydney→SYD, Berlin→BER, Amsterdam→AMS, Istanbul→IST, Cancun→CUN, Bali→DPS)
- Parse relative dates: "next month" → first of next month, "in June" → June 1st of current/next year
- Default adults to 1 if not specified

FLIGHT RULES:
- Default cabinClass to "ECONOMY" if not specified
- Default nonStop to false. Set to true ONLY when user says "nonstop", "non-stop", "direct", or "no stops"
- Only return "flight_search" if the user mentions flights, flying, airfare, or is refining a previous flight search
- "flights under $500" or "budget flights under 400" → set maxPrice to the number (e.g. 500, 400)
- "Delta flights only" or "only fly American" or "find American flights" or "flights on American Airlines" or "show me United flights" → set includedAirlineCodes to IATA codes (e.g. ["DL"], ["AA"], ["UA"])
- Common airline IATA codes: American Airlines=AA, Delta=DL, United=UA, Southwest=WN, JetBlue=B6, Spirit=NK, Frontier=F9, Alaska=AS, Air France=AF, British Airways=BA, Lufthansa=LH, Emirates=EK, Qatar=QR
- "no Spirit" or "avoid Frontier" → set excludedAirlineCodes to IATA codes (e.g. ["NK"], ["F9"])
- When the user says "find [airline] flights" or "search [airline] flights" as a follow-up to a previous flight search, carry forward ALL previous search params (origin, destination, dates, etc.) and ADD the airline filter
- "cheapest dates to fly" / "flexible dates" / "when is cheapest to fly" → type "cheapest_dates"

HOTEL RULES:
- Only return "hotel_search" if the user mentions hotels, hotel, accommodation, stay, lodging, resort, place to stay, room, suite, OR if the user is clearly refining a previous hotel search from the conversation context (e.g. "something nicer", "cheaper options", "more affordable", "near central park", "with a pool", "show me 5-star")
- For an INITIAL hotel search, require at minimum: a city/destination AND dates (or length of stay). If guests are not specified, default adults to 1. If BOTH city and dates are missing with no prior search in context, return {"type":"none","params":{}}
- When the user provides number of nights (e.g. "3 nights"), compute checkIn as the earliest sensible date (tomorrow if not specified) and checkOut accordingly
- PRICE FILTERING: Extract price constraints when the user mentions budget, price range, or dollar amounts:
  - "under $300/night" or "less than 300 a night" → priceMax: 300
  - "between $200 and $350 a night" → priceMin: 200, priceMax: 350
  - "around $250/night" → priceMin: 200, priceMax: 300 (±20% range)
  - "budget hotels" → priceMax: 150
  - "mid-range" → priceMin: 150, priceMax: 300
  - "luxury" / "high-end" / "upscale" / "5-star" → priceMin: 400, ratings: [5]
  - "affordable" / "cheap" / "budget-friendly" → priceMax: 150
  - All prices are per night in USD unless the user specifies otherwise
- STAR RATING: Extract when the user mentions star ratings or quality level:
  - "5-star" or "five star" → ratings: [5]
  - "4-star or better" → ratings: [4, 5]
  - "at least 3 stars" → ratings: [3, 4, 5]
  - "luxury" / "high-end" / "premium" → ratings: [4, 5]
  - "boutique" → ratings: [4, 5]
  - If not specified, leave ratings as null (no filter)
- BOARD TYPE: Extract meal preferences when mentioned:
  - "breakfast included" → boardType: "BREAKFAST"
  - "all-inclusive" → boardType: "ALL_INCLUSIVE"
  - If not specified, leave boardType as null
- FOLLOW-UP REFINEMENT (CRITICAL): When the user sends a follow-up that modifies a previous hotel search:
  1. Look at the conversation context to find the previous hotel search parameters (cityCode, checkIn, checkOut, adults)
  2. Carry forward ALL previous params as the base
  3. Apply ONLY the user's new refinements on top (price range, rating, different area, etc.)
  4. Examples:
     - Previous: NYC hotels Jun 10-15 for 3 guests → User: "find hotels near central park between $200 and $350 a night" → carry forward cityCode:NYC, checkIn, checkOut, adults:3, ADD priceMin:200, priceMax:350
     - Previous: NYC hotels Jun 10-15 → User: "show me luxury options" → carry forward all dates/city, ADD ratings:[4,5], priceMin:400
     - Previous: NYC hotels Jun 10-15 → User: "something cheaper" → carry forward dates/city, ADD priceMax:200
     - Previous: NYC hotels Jun 10-15 → User: "try London instead" → change cityCode to LON, keep dates/adults
  5. You MUST return "hotel_search" for these follow-ups even if the user doesn't repeat dates/guests — they were already established

POI RULES:
- Only return "poi_search" if the user mentions things to do, attractions, sightseeing, places, activities, restaurants, cafes, bars, nightlife, museums, parks, shopping, food, eat, drink
- For poi_search, ALWAYS include a "textQuery" that is a natural language search phrase
- For poi_search, include city center coordinates as latitude/longitude when a city is mentioned
- For poi_search, map categories to Google Places types: restaurants→["restaurant"], cafes/coffee→["cafe"], museums→["museum"], bars/nightlife→["bar","night_club"], parks→["park"], shopping→["shopping_mall","clothing_store"], hotels→["lodging"]. For general/mixed queries, omit types

FOLLOW-UP RULES (ALL TYPES):
- For follow-up messages that refine a previous search of ANY type, carry forward ALL params from the LAST SUCCESSFUL SEARCH and only change what the user specifies
- "find [airline] flights" or "show me [airline] options" when there was a previous flight search → carry forward origin, destination, dates, adults from the last search and ADD the airline filter
- When switching search types (e.g. from flights to hotels for the same trip), carry forward relevant shared params like destination city and dates
- CRITICAL: If LAST SUCCESSFUL SEARCH data is provided above, ALWAYS use it as the base for follow-ups. Do NOT return "none" just because the user didn't repeat origin/destination/dates — those are already known from the previous search${locationRules}`;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Add conversation context if provided (last few exchanges for disambiguation)
  if (context?.length) {
    for (const msg of context.slice(-4)) {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }
  }

  messages.push({ role: 'user', content: message });

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    messages,
    temperature: 0.1,
    max_tokens: 500,
  });

  const text = response.choices[0]?.message?.content ?? '{}';

  // Extract JSON from possible markdown code fences
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, text];
  const raw = jsonMatch[1]!.trim();

  try {
    return JSON.parse(raw);
  } catch {
    const objectMatch = raw.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }
    return { type: 'none', params: {} };
  }
}

// ── Fitness intent extraction ─────────────────────────────────────────

export interface FitnessIntent {
  type: 'studio_search' | 'class_search' | 'book_class' | 'none';
  params: Record<string, any>;
}

// ── Lifestyle intent extraction ──────────────────────────────────────

export interface LifestyleIntent {
  type: 'restaurant_search' | 'coffee_search' | 'reservation' | 'recommendation' | 'none';
  params: Record<string, any>;
}

export async function extractLifestyleParams(
  message: string,
  context?: Array<{ role: string; content: string }>,
  userLocation?: { city?: string; region?: string; lat?: number; lng?: number }
): Promise<LifestyleIntent> {
  const today = new Date().toISOString().split('T')[0];
  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  let locationRules = '';
  if (userLocation) {
    if (userLocation.city) {
      locationRules += `\n- User is in ${userLocation.city}${userLocation.region ? `, ${userLocation.region}` : ''}. Use for "near me" searches.`;
    }
    if (userLocation.lat != null && userLocation.lng != null) {
      locationRules += `\n- User's coordinates: (${userLocation.lat}, ${userLocation.lng}). Include as latitude/longitude for proximity-based results.`;
    }
  }

  const systemPrompt = `You extract structured lifestyle search parameters from natural language. Today is ${dayOfWeek}, ${today}.

Return ONLY valid JSON in one of these formats:

For restaurant searches:
{"type":"restaurant_search","params":{"textQuery":"Italian restaurants near me","cuisine":"italian","latitude":30.27,"longitude":-97.74,"cityName":"Austin","types":["restaurant"]}}

For coffee/cafe searches:
{"type":"coffee_search","params":{"textQuery":"best oat milk lattes near me","latitude":30.27,"longitude":-97.74,"cityName":"Austin","types":["cafe"]}}

For reservations (user wants to book a specific restaurant):
{"type":"reservation","params":{"restaurantName":"Nobu","date":"${today}","time":"19:00","partySize":2,"specialRequests":null}}

For general recommendations (what to do, date night ideas, etc.):
{"type":"recommendation","params":{"query":"date night ideas","category":"dining","timeOfDay":"evening"}}

For non-lifestyle-search messages:
{"type":"none","params":{}}

Rules:
- "restaurant_search": user wants to find/discover restaurants or dining spots. Signals: "find", "search", "show me", "recommend", "where", "best", "near me" + restaurant/dining/food/cuisine terms
- "coffee_search": user wants to find cafes or coffee shops. Signals: coffee, cafe, latte, espresso, tea + search terms
- "reservation": user explicitly wants to BOOK a table at a named restaurant. Signals: "book", "reserve", "reservation", "table for". Extract: restaurantName, date, time, partySize. Parse relative dates ("Friday" → next Friday, "tomorrow" → tomorrow's date). Parse "7pm" → "19:00".
- "recommendation": user asks open-ended lifestyle questions like "what should I do tonight", "date night ideas", "any suggestions for brunch". These are NOT searches for specific places — they want advice/ideas.
- Return "none" for: general chat, reminders, planning, productivity, wellness advice, or anything not clearly a place search or reservation
- IMPORTANT: Do NOT extract intent for travel bookings (flights/hotels), fitness classes, or fashion — those belong to other agents
- For follow-up messages refining a previous search, look at conversation context${locationRules}`;

  const messages_arr: import('openai').default.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ];

  if (context?.length) {
    for (const msg of context.slice(-4)) {
      messages_arr.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }
  }

  messages_arr.push({ role: 'user', content: message });

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    messages: messages_arr,
    temperature: 0.1,
    max_tokens: 500,
  });

  const text = response.choices[0]?.message?.content ?? '{}';

  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, text];
  const raw = jsonMatch[1]!.trim();

  try {
    return JSON.parse(raw);
  } catch {
    const objectMatch = raw.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }
    return { type: 'none', params: {} };
  }
}

export async function extractFitnessParams(
  message: string,
  context?: Array<{ role: string; content: string }>,
  userLocation?: { city?: string; region?: string; lat?: number; lng?: number }
): Promise<FitnessIntent> {
  const today = new Date().toISOString().split('T')[0];

  let locationRules = '';
  if (userLocation) {
    if (userLocation.city) {
      locationRules += `\n- User is in ${userLocation.city}${userLocation.region ? `, ${userLocation.region}` : ''}. Use for "near me" searches.`;
    }
    if (userLocation.lat != null && userLocation.lng != null) {
      locationRules += `\n- User's coordinates: (${userLocation.lat}, ${userLocation.lng}). Include as userLat/userLng for proximity-based results.`;
    }
  }

  const systemPrompt = `You extract structured fitness studio/gym search parameters from natural language. Today's date is ${today}.

Return ONLY valid JSON in one of these formats:

For fitness studio/gym searches (find studios):
{"type":"studio_search","params":{"classType":"yoga","cityName":"Austin","userLat":30.27,"userLng":-97.74}}

For fitness class searches (find individual classes with times):
{"type":"class_search","params":{"classType":"yoga","timePreference":"evening","date":"${today}","cityName":"Austin","userLat":30.27,"userLng":-97.74}}

For booking a class (user wants to book a specific class from recent results):
{"type":"book_class","params":{"classIndex":0,"className":"Power Yoga","time":"6:00 PM","studioName":"CorePower Yoga"}}

For non-fitness messages:
{"type":"none","params":{}}

Rules:
- classType: normalize to one of: yoga, pilates, hiit, spinning, barre, boxing, strength, dance, stretch, meditation, cardio, bootcamp, crossfit, martial arts, swimming, climbing, cycling. If not specific, use "fitness"
- cityName: extract city name if user mentions a location, otherwise omit
- userLat/userLng: include the user's coordinates if available (from location rules below) for "near me" searches
- timePreference: "morning" (5am-12pm), "afternoon" (12pm-5pm), "evening" (5pm-10pm), or omit if not specified
- date: default to today's date (${today}). Parse "tomorrow", "this weekend", "next Monday" etc. into YYYY-MM-DD
- Use "class_search" when user asks to find classes with time/schedule focus (e.g. "find yoga classes this evening", "what classes are available tomorrow morning")
- Use "studio_search" when user asks to find studios/gyms without time focus (e.g. "find yoga studios near me", "best gyms in Austin")
- Use "book_class" when user says things like "book the 6pm one", "sign me up for that", "book the first one", "I want to go to the Power Yoga class". Use conversation context to match which class they mean. classIndex is 0-based from the most recent search results.
- Only return "studio_search" or "class_search" if the user is explicitly trying to discover a place, class, studio, or gym. Strong signals include phrases like "find", "search", "show me", "near me", "nearby", "where can I", "book", "schedule", "available", or a direct request for classes/gyms/studios in a place or time window
- Return "none" for: general fitness advice, workout plans, nutrition questions, motivation, technique questions, recovery questions, program design, exercise explanations, or any message that is fitness-related but not clearly asking to find a location/class
- Do NOT treat a generic topic like "yoga", "pilates", "boxing", "strength training", or "workout" by itself as search intent unless the message also asks to find classes, gyms, studios, or nearby options
- IMPORTANT: Do NOT extract intent for travel, fashion, or general lifestyle topics — those belong to other agents
- For follow-up messages refining a previous search (e.g. "try pilates instead", "what about boxing"), look at conversation context to carry forward parameters${locationRules}`;

  const messages: import('openai').default.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ];

  if (context?.length) {
    for (const msg of context.slice(-4)) {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }
  }

  messages.push({ role: 'user', content: message });

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    messages,
    temperature: 0.1,
    max_tokens: 500,
  });

  const text = response.choices[0]?.message?.content ?? '{}';

  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, text];
  const raw = jsonMatch[1]!.trim();

  try {
    return JSON.parse(raw);
  } catch {
    const objectMatch = raw.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }
    return { type: 'none', params: {} };
  }
}
