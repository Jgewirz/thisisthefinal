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
  | 'flight'
  | 'hotel'
  | 'outfit'
  | 'colorSeason'
  | 'fitnessClass'
  | 'reminder';

export interface RichCard {
  type: RichCardType;
  data: any;
}
