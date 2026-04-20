import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  classifyDomain,
  classifyDomainLLM,
  __setClassifierClient,
} from '../services/classifier.js';

function fakeClient(impl: (body: any) => Promise<any>) {
  return {
    chat: { completions: { create: vi.fn(impl) } },
  };
}

describe('LLM intent classifier', () => {
  beforeEach(() => __setClassifierClient(null));

  it('uses the LLM response when it returns a valid domain', async () => {
    __setClassifierClient(
      fakeClient(async () => ({
        choices: [{ message: { content: JSON.stringify({ domain: 'fitness' }) } }],
      })) as any
    );

    // A phrase that the keyword classifier would mis-route to lifestyle.
    const out = await classifyDomain('I want something cheap and close tomorrow morning');
    expect(out).toBe('fitness');
  });

  it('falls back to the keyword classifier when the LLM errors', async () => {
    __setClassifierClient(
      fakeClient(async () => {
        throw new Error('rate limited');
      }) as any
    );
    const out = await classifyDomain('Find me a yoga class near me tomorrow');
    expect(out).toBe('fitness'); // keyword: "yoga" + "class"
  });

  it('falls back when the LLM returns a non-enum domain', async () => {
    __setClassifierClient(
      fakeClient(async () => ({
        choices: [{ message: { content: JSON.stringify({ domain: 'astrology' }) } }],
      })) as any
    );
    const out = await classifyDomain('Plan a trip to Paris');
    expect(out).toBe('travel'); // keyword fallback
  });

  it('classifyDomainLLM returns null when no client is available', async () => {
    __setClassifierClient(null);
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const out = await classifyDomainLLM('hi');
    expect(out).toBeNull();
    if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
  });

  it('classifyDomainLLM returns null for empty input (no API call)', async () => {
    const mock = vi.fn();
    __setClassifierClient({ chat: { completions: { create: mock } } } as any);
    const out = await classifyDomainLLM('   ');
    expect(out).toBeNull();
    expect(mock).not.toHaveBeenCalled();
  });
});
