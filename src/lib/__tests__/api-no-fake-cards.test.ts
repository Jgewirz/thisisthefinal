import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const apiSrc = readFileSync(resolve(here, '..', 'api.ts'), 'utf8');

describe('src/lib/api.ts — fake card extraction is removed', () => {
  it('no longer defines extractRichCard()', () => {
    expect(apiSrc).not.toMatch(/function extractRichCard/);
  });

  it('never parses fenced JSON out of the bot response as a card', () => {
    // The regex used by the legacy extractor — it must be gone.
    expect(apiSrc).not.toMatch(/```\(\?:json\)\?/);
  });

  it('still calls setRichCardOnLastBot for the real /api/style/analyze result', () => {
    // The style-analysis path produces ground-truth rich cards and must remain.
    expect(apiSrc).toMatch(/setRichCardOnLastBot\(agentId, richCard\)/);
  });
});
