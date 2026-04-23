import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
}));

vi.mock('../../lib/wardrobeApi', () => ({
  WARDROBE_CATEGORIES: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory', 'activewear'],
  createWardrobeItem: vi.fn(),
  updateWardrobeItem: vi.fn(),
  deleteWardrobeItem: vi.fn(),
  listWardrobe: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../stores/wardrobeSaves', () => ({
  useWardrobeSavesStore: (sel: any) => sel({ isSaved: () => false, markSaved: () => {} }),
}));

// The CTA is only about structural rendering; dialog interactivity is not
// tested here (SSR can't drive click handlers). The dialog itself has its own
// smoke test in this folder.

import type { Message } from '../types';

async function render(msg: Message) {
  const { MessageBubble } = await import('../components/MessageBubble');
  return renderToString(React.createElement(MessageBubble, { message: msg }));
}

function baseUserMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm-1',
    type: 'user',
    text: 'hello',
    timestamp: new Date('2026-04-20T10:00:00Z'),
    agentId: 'style',
    ...overrides,
  };
}

describe('MessageBubble — Save to wardrobe CTA', () => {
  it('shows the Save to wardrobe button for a Style-agent user photo', async () => {
    const html = await render(
      baseUserMessage({
        imageUrl: 'data:image/png;base64,AAA',
      })
    );
    expect(html).toContain('Save to wardrobe');
    expect(html).toMatch(/aria-label="Save to wardrobe"/);
  });

  it('hides the CTA when there is no image', async () => {
    const html = await render(baseUserMessage({ imageUrl: undefined }));
    expect(html).not.toContain('Save to wardrobe');
  });

  it('hides the CTA for non-style agents even when there is a photo', async () => {
    const html = await render(
      baseUserMessage({ agentId: 'travel', imageUrl: 'data:image/png;base64,AAA' })
    );
    expect(html).not.toContain('Save to wardrobe');
  });

  it('hides the CTA for bot messages that happen to carry an imageUrl', async () => {
    const html = await render(
      baseUserMessage({
        type: 'bot',
        text: 'here is an image',
        imageUrl: 'data:image/png;base64,AAA',
      })
    );
    expect(html).not.toContain('Save to wardrobe');
  });
});
