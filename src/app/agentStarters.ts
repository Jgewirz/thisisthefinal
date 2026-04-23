import type { AgentId } from './types';

/**
 * A "starter" is a concrete, real-outcome example prompt for an agent.
 *
 * - `label`: short chip/card title (what the user sees)
 * - `prompt`: the exact text that gets sent when tapped (what the agent receives)
 * - `hint`: one-line outcome description — sets expectations before tapping
 *
 * Starters are the single source of truth used by both:
 *   1. The empty-state onboarding cards (ChatView)
 *   2. The quick-action chip row above the input (ChatInput)
 */
export interface AgentStarter {
  id: string;
  label: string;
  prompt: string;
  hint: string;
}

export const agentStarters: Record<AgentId, AgentStarter[]> = {
  all: [
    {
      id: 'all-trip',
      label: 'Plan a weekend in Paris',
      prompt: 'Plan a weekend trip to Paris in May — flights, hotels, and one fun thing each day.',
      hint: 'Routes to Travel → flight & hotel cards with booking links',
    },
    {
      id: 'all-yoga',
      label: 'Yoga tomorrow 8am',
      prompt: 'Find yoga classes near me tomorrow at 8am.',
      hint: 'Routes to Fitness → studio list + ClassPass/Mindbody links',
    },
    {
      id: 'all-remind',
      label: 'Remind me in 2 hours',
      prompt: 'Remind me in 2 hours to drink water.',
      hint: 'Routes to Lifestyle → saved reminder + browser notification',
    },
    {
      id: 'all-style',
      label: 'Rate my outfit',
      prompt: 'I want to upload a photo and have you rate my outfit.',
      hint: 'Routes to Style → attach a photo for a rated outfit card',
    },
  ],
  style: [
    {
      id: 'style-colors',
      label: 'Analyze my colors',
      prompt: 'Analyze my color season — I want to upload a selfie.',
      hint: 'Attach a clear selfie for a color-season card with best shades',
    },
    {
      id: 'style-outfit',
      label: 'Rate my outfit',
      prompt: 'Rate this outfit — I\'ll upload a photo.',
      hint: 'Attach a full-length photo for a structured outfit rating',
    },
    {
      id: 'style-tag',
      label: 'Tag a clothing item',
      prompt: 'Tag this clothing item — category, color, and what it pairs with.',
      hint: 'Attach a product photo for category / color / pairing tags',
    },
    {
      id: 'style-occasion',
      label: 'Dress for a job interview',
      prompt: 'What should I wear to a job interview at a tech company?',
      hint: 'Styling advice grounded in occasion & vibe',
    },
  ],
  travel: [
    {
      id: 'travel-flights',
      label: 'Flights NYC → Tokyo next month',
      prompt: 'Find flights from New York to Tokyo departing next month, 1 adult, economy.',
      hint: 'Returns a flight card + Google Flights / Kayak / Skyscanner links',
    },
    {
      id: 'travel-hotels',
      label: 'Hotels in Paris May 2–5',
      prompt: 'Find hotels in Paris for May 2 to May 5, 2 adults, 1 room.',
      hint: 'Returns a hotel card + Booking / Hotels.com / Airbnb links',
    },
    {
      id: 'travel-weekend',
      label: 'Plan a weekend getaway',
      prompt: 'Plan a weekend getaway from Seattle under $800 — suggest 3 cities with flights and hotels.',
      hint: 'Multi-city plan with booking links for each option',
    },
    {
      id: 'travel-itinerary',
      label: '3 days in Rome',
      prompt: 'Give me a 3-day Rome itinerary — morning, afternoon, evening each day.',
      hint: 'Day-by-day itinerary (text; save to reminders from Lifestyle)',
    },
  ],
  fitness: [
    {
      id: 'fitness-yoga',
      label: 'Yoga near me tomorrow 8am',
      prompt: 'Find yoga studios near me with classes tomorrow around 8am.',
      hint: 'Studio list + ClassPass / Mindbody / Google Maps links',
    },
    {
      id: 'fitness-hiit',
      label: 'HIIT this week',
      prompt: 'Find HIIT classes near me this week.',
      hint: 'Studio list + aggregator booking links',
    },
    {
      id: 'fitness-gym',
      label: 'Gym finder',
      prompt: 'Find the highest-rated gyms within 2 miles of me.',
      hint: 'Ranked nearby gyms via Google Places',
    },
    {
      id: 'fitness-plan',
      label: 'Beginner 3-day plan',
      prompt: 'Give me a simple 3-day full-body workout plan for a beginner.',
      hint: 'Structured plan (text; add to reminders from Lifestyle)',
    },
  ],
  lifestyle: [
    {
      id: 'lifestyle-remind-water',
      label: 'Remind me every 2 hours',
      prompt: 'Remind me to drink water in 2 hours.',
      hint: 'Creates a reminder + browser notification when due',
    },
    {
      id: 'lifestyle-remind-meeting',
      label: 'Remind me about a meeting',
      prompt: 'Remind me at 4:30pm today to prep for the 5pm meeting.',
      hint: 'Creates a time-based reminder card',
    },
    {
      id: 'lifestyle-remind-call',
      label: 'Call mom tomorrow',
      prompt: 'Remind me to call mom tomorrow at 6pm.',
      hint: 'Creates a reminder for tomorrow',
    },
    {
      id: 'lifestyle-wellness',
      label: 'Quick wellness check',
      prompt: 'Give me a 2-minute breathing exercise I can do at my desk.',
      hint: 'Short guided routine (text)',
    },
  ],
};

/**
 * Compact label list used for the chip row above the input. Keep it short
 * so it fits on mobile in a single scrollable row.
 */
export function starterChipLabels(agentId: AgentId, max = 3): AgentStarter[] {
  return agentStarters[agentId].slice(0, max);
}
