import { describe, it, expect, vi } from 'vitest';

// Avoid importing the real OpenAI client during module load.
vi.mock('openai', () => ({ default: class FakeOpenAI {} }));

import { parseAnalysisResponse } from '../services/anthropic.js';

describe('parseAnalysisResponse', () => {
  it('parses unfenced JSON', () => {
    const out = parseAnalysisResponse(
      '{"score":8,"strengths":["a"],"improvements":["b"],"colorHarmony":"good","overallVibe":"x"}'
    );
    expect(out).toMatchObject({ score: 8 });
  });

  it('parses fenced JSON (```json ... ```)', () => {
    const out = parseAnalysisResponse(
      '```json\n{"category":"top","color":"blue","colorHex":"#0000ff","style":"casual","seasons":["spring"],"occasions":["casual"],"pairsWith":["jeans"]}\n```'
    );
    expect(out).toMatchObject({ category: 'top', color: 'blue' });
  });

  it('parses JSON embedded in prose', () => {
    const out = parseAnalysisResponse(
      'Sure! Here is the analysis you asked for: {"score":7,"strengths":["clean"],"improvements":["belt"],"colorHarmony":"good","overallVibe":"smart"} — thanks!'
    );
    expect(out).toMatchObject({ score: 7 });
  });

  it('detects refusals without logging an error', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const out = parseAnalysisResponse(
        "I'm sorry, but I can't help with rating or analyzing the outfit in the photo."
      );
      expect(out.refused).toBe(true);
      expect(typeof out.reason).toBe('string');
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('detects "I cannot" style refusals', () => {
    const out = parseAnalysisResponse('I cannot analyze photos of real people.');
    expect(out.refused).toBe(true);
  });

  it('returns an error record for truly garbled text and logs it', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const out = parseAnalysisResponse('this is neither JSON nor a polite refusal');
      expect(out.error).toBe('Failed to parse AI response');
      expect(out.raw).toBe('this is neither JSON nor a polite refusal');
      expect(errorSpy).toHaveBeenCalledTimes(1);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('handles empty responses', () => {
    const out = parseAnalysisResponse('');
    expect(out.error).toBe('Empty AI response');
  });
});
