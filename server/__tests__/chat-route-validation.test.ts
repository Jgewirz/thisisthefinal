import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('server/routes/chat.ts — message content validation', () => {
  it('allows empty-string content and only rejects null/undefined', () => {
    const src = readFileSync(resolve(process.cwd(), 'server/routes/chat.ts'), 'utf8');
    expect(src).toContain('content == null');
    expect(src).not.toMatch(/!m\.content\)/);
  });
});

