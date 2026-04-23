import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const apiSrc = readFileSync(resolve(here, '..', 'api.ts'), 'utf8');

describe('src/lib/api.ts — chat history persisted to DB', () => {
  it('awaits persist for user and assistant messages (no text-only gate on bot)', () => {
    expect(apiSrc).toContain('await persistMessage(userMsg)');
    expect(apiSrc).toContain("if (lastBot?.type === 'bot')");
    expect(apiSrc).toContain('await persistMessage(lastBot)');
    expect(apiSrc).not.toMatch(/lastBot\.text\)\s*\{\s*await persistMessage/);
  });

  it('persists bot message after stream errors (catch path)', () => {
    expect(apiSrc).toContain('if (errBot?.type === \'bot\')');
    expect(apiSrc).toContain('await persistMessage(errBot)');
  });

  it('loads up to server max history on refresh', () => {
    expect(apiSrc).toContain('/api/chat/history?agentId=${agentId}&limit=200');
  });

  it('persistMessage returns boolean from res.ok', () => {
    expect(apiSrc).toMatch(/async function persistMessage\(msg: Message\): Promise<boolean>/);
    expect(apiSrc).toContain('return res.ok');
  });

  it('Idempotency-Key is partitioned by richCard presence so re-persist after style analysis does not 409', () => {
    // The bug: using `msg:${msg.id}` for both writes trips the server's
    // "same key, different body" guard when a rich card is attached later.
    expect(apiSrc).not.toMatch(/'Idempotency-Key':\s*`msg:\$\{msg\.id\}`/);
    expect(apiSrc).toContain("const variant = msg.richCard ? 'with-card' : 'no-card';");
    expect(apiSrc).toContain("'Idempotency-Key': `msg:${msg.id}:${variant}`");
  });
});
