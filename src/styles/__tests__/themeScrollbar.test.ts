import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('theme.css (scrollbar)', () => {
  it('includes cross-browser scrollbar styling rules', () => {
    const css = readFileSync(new URL('../theme.css', import.meta.url), 'utf8');
    expect(css).toMatch(/scrollbar-width:\s*thin/);
    expect(css).toMatch(/scrollbar-color:\s*var\(--bg-surface-elevated\)\s*var\(--bg-primary\)/);
    expect(css).toMatch(/::\-webkit\-scrollbar/);
    expect(css).toMatch(/::\-webkit\-scrollbar-thumb/);
  });
});

