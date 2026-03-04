/**
 * Lightweight domain classifier for the "All" agent.
 * Uses keyword matching to route messages to the appropriate specialist.
 * Avoids an extra API call — fast and free.
 */

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

/**
 * Classify a user message into a domain.
 * Returns the domain with the highest keyword match score.
 * Multi-word keywords get proportionally higher weight.
 * Falls back to 'lifestyle' if no matches found.
 */
export function classifyDomain(text: string): DomainId {
  const lower = text.toLowerCase();
  const scores: Record<DomainId, number> = { style: 0, travel: 0, fitness: 0, lifestyle: 0 };

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS) as [DomainId, string[]][]) {
    for (const keyword of keywords) {
      // Leading word boundary prevents "hat" matching inside "what",
      // no trailing boundary so "flight" still matches "flights"
      const pattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
      if (pattern.test(lower)) {
        // Multi-word phrases get higher weight (more specific)
        scores[domain] += keyword.split(' ').length;
      }
    }
  }

  // Priority order: specific domains first, lifestyle as fallback.
  // This means if style/travel/fitness tie with lifestyle, the specific domain wins.
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
