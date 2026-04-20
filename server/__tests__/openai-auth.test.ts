import { describe, it, expect, vi } from 'vitest';

// Mock OpenAI so constructing it succeeds; we're only asserting that our
// auth guard runs when the key is missing.
vi.mock('openai', () => {
  class FakeOpenAI {
    chat = { completions: { create: vi.fn() } };
    constructor(_: unknown) {}
  }
  return { default: FakeOpenAI };
});

describe('OpenAI auth env', () => {
  it('imports cleanly with no OPENAI_API_KEY (lazy init does not crash module load)', async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    await expect(import('../services/anthropic.js')).resolves.toBeDefined();
    if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
  });

  it('throws a helpful error when streamChat is invoked without OPENAI_API_KEY', async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const mod = await import('../services/anthropic.js');
    const gen = mod.streamChat('fitness', [{ role: 'user', content: 'hi' }]);
    await expect(gen.next()).rejects.toThrow(/OpenAI authentication is not configured/i);

    if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
  });
});
