import { describe, expect, it } from 'vitest';
import {
  formatFailureAsMessage,
  interpretAnalysisResponse,
  pickAnalysisType,
  type StyleAnalysisResult,
} from '../styleAnalysis';

describe('pickAnalysisType', () => {
  it.each([
    ['rate my outfit please', 'outfit_rating'],
    ['how does this outfit look?', 'outfit_rating'],
    ['fit check?', 'outfit_rating'],
    ['tag this clothing item', 'clothing_tag'],
    ['add to wardrobe', 'clothing_tag'],
    ['what season am I', 'skin_tone'],
    ['find my colors', 'skin_tone'],
    ['', 'skin_tone'],
  ])('classifies %j as %s', (text, expected) => {
    expect(pickAnalysisType(text)).toBe(expected);
  });

  it('tolerates undefined / non-string input', () => {
    // @ts-expect-error — runtime robustness
    expect(pickAnalysisType(undefined)).toBe('skin_tone');
  });
});

describe('interpretAnalysisResponse', () => {
  it('maps a skin_tone success into a colorSeason card', () => {
    const out = interpretAnalysisResponse('skin_tone', {
      season: 'Autumn',
      bestColors: ['rust', 'olive', 'navy'],
      bestMetals: 'gold',
      depth: 'medium',
      undertone: 'warm',
    });
    expect(out.kind).toBe('card');
    if (out.kind !== 'card') throw new Error('unreachable');
    expect(out.card.type).toBe('colorSeason');
    expect((out.card.data as any).season).toBe('Autumn');
    expect((out.card.data as any).colors).toEqual(['rust', 'olive', 'navy']);
  });

  it('maps outfit_rating with score into an outfit card', () => {
    const out = interpretAnalysisResponse('outfit_rating', {
      score: 8,
      strengths: ['clean lines'],
      improvements: [],
      accessorySuggestions: [],
      colorHarmony: 'complementary',
      overallVibe: 'polished',
    });
    expect(out.kind).toBe('card');
    if (out.kind !== 'card') throw new Error('unreachable');
    expect(out.card.type).toBe('outfit');
  });

  it('maps clothing_tag success to kind:none (side-effect flow lives in caller)', () => {
    const out = interpretAnalysisResponse('clothing_tag', {
      category: 'top',
      color: 'white',
    });
    expect(out.kind).toBe('none');
  });

  it('returns a refusal with suggestions when the model declines', () => {
    const out = interpretAnalysisResponse('skin_tone', {
      refused: true,
      reason:
        "I'm sorry, but I can't identify individuals in photos. Let me know if you have other questions!",
    });
    expect(out.kind).toBe('refused');
    if (out.kind !== 'refused') throw new Error('unreachable');
    expect(out.message.length).toBeLessThanOrEqual(160);
    expect(out.suggestions.length).toBeGreaterThanOrEqual(2);
    expect(out.suggestions.some((s) => /face|flat-lay|mirror/i.test(s))).toBe(true);
  });

  it('uses a fallback headline when refusal reason is missing', () => {
    const out = interpretAnalysisResponse('outfit_rating', { refused: true });
    expect(out.kind).toBe('refused');
    if (out.kind !== 'refused') throw new Error('unreachable');
    expect(out.message).toMatch(/couldn.t analyze/i);
    // Outfit-specific suggestion bullet present.
    expect(out.suggestions.some((s) => /full-body/i.test(s))).toBe(true);
  });

  it('returns an error when the server reports a parse error', () => {
    const out = interpretAnalysisResponse('skin_tone', {
      error: 'Failed to parse AI response',
    });
    expect(out.kind).toBe('error');
  });

  it('returns an error for skin_tone without season/bestColors', () => {
    const out = interpretAnalysisResponse('skin_tone', { bestColors: ['red'] });
    expect(out.kind).toBe('error');
  });

  it('returns an error for outfit_rating without a numeric score', () => {
    const out = interpretAnalysisResponse('outfit_rating', { overallVibe: 'nice' });
    expect(out.kind).toBe('error');
  });

  it('returns an error for clothing_tag without a category', () => {
    const out = interpretAnalysisResponse('clothing_tag', { color: 'blue' });
    expect(out.kind).toBe('error');
  });

  it('handles non-object / null result gracefully', () => {
    expect(interpretAnalysisResponse('skin_tone', null).kind).toBe('error');
    expect(interpretAnalysisResponse('skin_tone', 'refused by model').kind).toBe('error');
  });
});

describe('formatFailureAsMessage', () => {
  it('produces markdown with a headline and bullet list for refusals', () => {
    const failure = {
      kind: 'refused',
      message: 'The model declined this photo.',
      suggestions: ['Try flat-lay', 'Avoid faces'],
    } satisfies Extract<StyleAnalysisResult, { kind: 'refused' }>;
    const out = formatFailureAsMessage(failure);
    expect(out).toMatch(/\*\*.+\*\*/);
    expect(out).toContain('- Try flat-lay');
    expect(out).toContain('- Avoid faces');
    expect(out).toMatch(/couldn.t analyze/i);
  });

  it('differentiates headlines for error vs refusal', () => {
    const refused = formatFailureAsMessage({
      kind: 'refused',
      message: 'x',
      suggestions: ['a'],
    });
    const err = formatFailureAsMessage({
      kind: 'error',
      message: 'y',
      suggestions: ['b'],
    });
    expect(refused).not.toEqual(err);
    expect(err).toMatch(/analysis failed/i);
  });
});
