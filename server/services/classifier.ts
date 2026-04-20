/**
 * Domain classifier for the "All" agent.
 *
 * Two layers:
 *   1. `classifyDomainKeyword(text)` — synchronous, zero-cost keyword match.
 *      Still used as the safety-net fallback.
 *   2. `classifyDomain(text)` — async. Calls a small LLM (default gpt-4o-mini)
 *      with JSON mode to handle natural-language intents the keywords miss,
 *      e.g. "something cheap and close", "morning workout", etc.
 *      Falls back to the keyword classifier on timeout / API error.
 */

import OpenAI from 'openai';

export type DomainId = 'style' | 'travel' | 'fitness' | 'lifestyle';

const DOMAIN_KEYWORDS: Record<DomainId, string[]> = {
  style: [
    'outfit', 'wear', 'dress', 'fashion', 'style', 'color palette', 'wardrobe',
    'clothes', 'clothing', 'shoes', 'accessories', 'jewelry', 'makeup', 'beauty',
    'skincare', 'lipstick', 'foundation', 'mascara', 'blush', 'contour', 'highlight',
    'color season', 'undertone', 'skin tone', 'body type', 'hourglass', 'pear shape',
    'shopping', 'boutique', 'brand', 'designer', 'thrift', 'closet', 'hat', 'bag',
    'purse', 'scarf', 'boots', 'heels', 'sandals', 'sneakers', 'jeans', 'skirt',
    'blazer', 'cardigan', 'sweater', 'blouse', 'necklace', 'earrings',
    'bracelet', 'ring', 'selfie', 'analyze my', 'rate my outfit',
  ],
  travel: [
    'travel', 'trip', 'flight', 'hotel', 'airbnb', 'destination', 'vacation',
    'holiday', 'itinerary', 'airport', 'booking', 'resort', 'beach', 'mountain',
    'passport', 'visa', 'luggage', 'packing', 'sightseeing',
    'tour', 'excursion', 'restaurant', 'café', 'cafe', 'cuisine',
    'museum', 'landmark', 'attraction', 'nightlife', 'bar',
    'uber', 'lyft', 'taxi', 'train station', 'ferry',
    'cruise', 'hostel', 'explore', 'adventure',
  ],
  fitness: [
    'workout', 'exercise', 'gym', 'fitness', 'yoga', 'pilates', 'barre',
    'cardio', 'strength training', 'weight lifting', 'squat', 'deadlift', 'bench press',
    'running', 'jogging', 'cycling', 'swimming', 'hiit', 'crossfit',
    'stretching', 'flexibility', 'mobility', 'recovery', 'protein',
    'calories', 'macros', 'meal prep', 'nutrition', 'supplement',
    'muscle', 'abs', 'core', 'glutes',
    'studio', 'trainer', 'personal training',
    'reps', 'sets', 'progressive overload', 'warm up', 'cool down',
  ],
  lifestyle: [
    'reminder', 'schedule', 'organize', 'productivity', 'habit',
    'self-care', 'wellness', 'meditation', 'mindfulness', 'journal',
    'budget', 'money', 'finance', 'savings', 'book', 'podcast',
    'recommend', 'morning routine', 'routine',
    'sleep', 'hydration', 'stress', 'anxiety', 'relax',
    'declutter', 'goals', 'motivation',
  ],
};

const VALID_DOMAINS: DomainId[] = ['style', 'travel', 'fitness', 'lifestyle'];

/** Legacy keyword-only classifier. Kept as a free, synchronous fallback. */
export function classifyDomainKeyword(text: string): DomainId {
  const lower = text.toLowerCase();
  const scores: Record<DomainId, number> = { style: 0, travel: 0, fitness: 0, lifestyle: 0 };

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS) as [DomainId, string[]][]) {
    for (const keyword of keywords) {
      const pattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
      if (pattern.test(lower)) {
        scores[domain] += keyword.split(' ').length;
      }
    }
  }

  const priority: DomainId[] = ['style', 'travel', 'fitness', 'lifestyle'];
  let bestDomain: DomainId = 'lifestyle';
  let bestScore = 0;
  for (const domain of priority) {
    if (scores[domain] > bestScore) {
      bestScore = scores[domain];
      bestDomain = domain;
    }
  }
  return bestDomain;
}

// ── LLM classifier ─────────────────────────────────────────
// Lazily constructed so tests without OPENAI_API_KEY don't blow up at import time.
let _client: OpenAI | null = null;
function getClient(): OpenAI | null {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  _client = new OpenAI({ apiKey });
  return _client;
}

/** Inject a client for tests. */
export function __setClassifierClient(client: OpenAI | null): void {
  _client = client;
}

const CLASSIFIER_MODEL = process.env.CLASSIFIER_MODEL || 'gpt-4o-mini';
const CLASSIFIER_TIMEOUT_MS = Number(process.env.CLASSIFIER_TIMEOUT_MS) || 2500;

const CLASSIFIER_SYSTEM = `You route a user's message to exactly one of four agents.
Return JSON of the form {"domain":"style"|"travel"|"fitness"|"lifestyle"}.

style     — fashion, outfits, makeup, color analysis, wardrobe.
travel    — trips, flights, hotels, restaurants, local attractions, things-to-do.
fitness   — workouts, gyms, yoga / pilates / barre classes, nutrition for fitness.
lifestyle — reminders, scheduling, productivity, wellness, self-care, anything else.

Think about the user's INTENT, not just keywords. Examples:
- "I want something cheap and close" alone → lifestyle (ambiguous, ask)
- "find a morning workout" → fitness
- "book a table tonight" → travel (restaurant)
- "I'm tired, what should I do" → lifestyle`;

/**
 * LLM-based classifier. Never throws — always resolves with a DomainId.
 * Returns `null` if the LLM path is not available (no API key / disabled).
 */
export async function classifyDomainLLM(text: string): Promise<DomainId | null> {
  const client = getClient();
  if (!client) return null;
  const trimmed = text.trim().slice(0, 600);
  if (!trimmed) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLASSIFIER_TIMEOUT_MS);

  try {
    const res = await client.chat.completions.create(
      {
        model: CLASSIFIER_MODEL,
        temperature: 0,
        max_tokens: 20,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: CLASSIFIER_SYSTEM },
          { role: 'user', content: trimmed },
        ],
      },
      { signal: controller.signal }
    );
    const raw = res.choices?.[0]?.message?.content ?? '';
    const parsed = JSON.parse(raw) as { domain?: string };
    const domain = parsed.domain as DomainId | undefined;
    if (domain && VALID_DOMAINS.includes(domain)) return domain;
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Unified classifier used by the "All" agent route. Tries the LLM first,
 * falls back to the keyword classifier on any error or timeout.
 */
export async function classifyDomain(text: string): Promise<DomainId> {
  const viaLlm = await classifyDomainLLM(text);
  if (viaLlm) return viaLlm;
  return classifyDomainKeyword(text);
}
