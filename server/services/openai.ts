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
  travelProfile?: object
): AsyncGenerator<string> {
  const config = getAgentConfig(agentId);
  const systemPrompt = buildSystemPrompt(agentId, styleProfile, travelProfile);

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
  context?: Array<{ role: string; content: string }>
): Promise<TravelIntent> {
  const today = new Date().toISOString().split('T')[0];

  const systemPrompt = `You extract structured travel search parameters from natural language. Today's date is ${today}.

Return ONLY valid JSON in one of these formats:

For flights:
{"type":"flight_search","params":{"origin":"JFK","destination":"NRT","departureDate":"2026-06-01","returnDate":"2026-06-15","adults":1,"cabinClass":"ECONOMY","nonStop":false,"maxPrice":null,"includedAirlineCodes":null,"excludedAirlineCodes":null}}

For cheapest/flexible date searches:
{"type":"cheapest_dates","params":{"origin":"JFK","destination":"NRT","departureDate":"2026-06-01"}}

For hotels:
{"type":"hotel_search","params":{"cityCode":"LON","checkIn":"2026-06-01","checkOut":"2026-06-05","adults":1}}

For points of interest / things to do:
{"type":"poi_search","params":{"latitude":51.5074,"longitude":-0.1278,"cityName":"London"}}

For non-travel messages:
{"type":"none","params":{}}

Rules:
- Resolve city names to IATA airport/city codes (New York→JFK, London→LON, Tokyo→NRT, Paris→CDG, etc.)
- Parse relative dates: "next month" → first of next month, "in June" → June 1st of current/next year
- Default adults to 1 if not specified
- Default cabinClass to "ECONOMY" if not specified
- Default nonStop to false. Set to true ONLY when user says "nonstop", "non-stop", "direct", or "no stops"
- For hotels without dates, use tomorrow +3 nights
- For POIs, use well-known city center coordinates
- returnDate is optional (omit for one-way)
- Only return "flight_search" if the user mentions flights, flying, airfare, or is refining a previous flight search (e.g. "show me nonstop only", "find cheaper flights")
- Only return "hotel_search" if the user mentions hotels, accommodation, stay, lodging
- Only return "poi_search" if the user mentions things to do, attractions, sightseeing, places, activities
- "flights under $500" or "budget flights under 400" → set maxPrice to the number (e.g. 500, 400)
- "Delta flights only" or "only fly American" → set includedAirlineCodes to IATA codes (e.g. ["DL"], ["AA"])
- "no Spirit" or "avoid Frontier" → set excludedAirlineCodes to IATA codes (e.g. ["NK"], ["F9"])
- "cheapest dates to fly" / "flexible dates" / "when is cheapest to fly" / "cheapest time to fly" → type "cheapest_dates"
- IMPORTANT: For follow-up messages that refine a previous search (e.g. "only nonstop", "make it business class", "try a different date"), look at the conversation context to carry forward the origin, destination, dates, and other params from the previous search, then apply the user's refinement`;

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
