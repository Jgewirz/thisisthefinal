import { describe, it, expect } from 'vitest';
import { classifyDomainKeyword as classifyDomain } from '../services/classifier.js';

describe('classifyDomainKeyword (fallback)', () => {
  describe('style queries', () => {
    it('detects outfit-related queries', () => {
      expect(classifyDomain('What should I wear to a wedding?')).toBe('style');
      expect(classifyDomain('Rate my outfit please')).toBe('style');
      expect(classifyDomain('Help me pick a dress for date night')).toBe('style');
    });

    it('detects beauty queries', () => {
      expect(classifyDomain('What makeup should I use?')).toBe('style');
      expect(classifyDomain('Best foundation for my skin tone')).toBe('style');
      expect(classifyDomain('Analyze my selfie for color season')).toBe('style');
    });

    it('detects wardrobe queries', () => {
      expect(classifyDomain('Help me organize my closet')).toBe('style');
      expect(classifyDomain('What shoes go with this?')).toBe('style');
      expect(classifyDomain('Is this necklace too much?')).toBe('style');
    });
  });

  describe('travel queries', () => {
    it('detects trip planning', () => {
      expect(classifyDomain('Plan a trip to Paris')).toBe('travel');
      expect(classifyDomain('I want to go on vacation to Bali')).toBe('travel');
      expect(classifyDomain('Best destination for a honeymoon')).toBe('travel');
    });

    it('detects transport queries', () => {
      expect(classifyDomain('Find me cheap flights to Tokyo')).toBe('travel');
      expect(classifyDomain('I need a hotel for next weekend')).toBe('travel');
      expect(classifyDomain('Best cruise lines for couples')).toBe('travel');
    });

    it('detects dining/attraction queries', () => {
      expect(classifyDomain('Best restaurants in New York')).toBe('travel');
      expect(classifyDomain("What's the best museum to visit?")).toBe('travel');
    });
  });

  describe('fitness queries', () => {
    it('detects workout queries', () => {
      expect(classifyDomain('Give me a workout routine')).toBe('fitness');
      expect(classifyDomain('Best exercises for glutes')).toBe('fitness');
      expect(classifyDomain('How to do a proper squat?')).toBe('fitness');
    });

    it('detects class/gym queries', () => {
      expect(classifyDomain('Best yoga classes near me')).toBe('fitness');
      expect(classifyDomain('Find a gym with pilates')).toBe('fitness');
      expect(classifyDomain('I want to try crossfit')).toBe('fitness');
    });

    it('detects nutrition queries', () => {
      expect(classifyDomain('How much protein do I need?')).toBe('fitness');
      expect(classifyDomain('Help me with meal prep for the week')).toBe('fitness');
      expect(classifyDomain('Best supplements for recovery')).toBe('fitness');
    });
  });

  describe('lifestyle queries (fallback)', () => {
    it('detects productivity/planning', () => {
      expect(classifyDomain('Set a reminder for 3pm')).toBe('lifestyle');
      expect(classifyDomain('Help me organize my schedule')).toBe('lifestyle');
      expect(classifyDomain('I need to be more productive')).toBe('lifestyle');
    });

    it('detects wellness queries', () => {
      expect(classifyDomain('How to deal with stress?')).toBe('lifestyle');
      expect(classifyDomain('Best meditation apps')).toBe('lifestyle');
      expect(classifyDomain('I want to start a journal')).toBe('lifestyle');
    });

    it('defaults to lifestyle for generic messages', () => {
      expect(classifyDomain('Hello!')).toBe('lifestyle');
      expect(classifyDomain('How are you?')).toBe('lifestyle');
      expect(classifyDomain('Can you help me?')).toBe('lifestyle');
    });
  });
});
