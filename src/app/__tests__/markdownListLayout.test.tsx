import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

vi.mock('../../stores/wardrobeSaves', () => ({
  useWardrobeSavesStore: (sel: any) => sel({ isSaved: () => false, markSaved: () => {} }),
}));

describe('MessageBubble — markdown list layout', () => {
  it('renders lists with list-outside + padding to avoid broken indentation', async () => {
    const { MessageBubble } = await import('../components/MessageBubble');
    const html = renderToString(
      React.createElement(MessageBubble, {
        message: {
          id: 'm1',
          type: 'bot',
          text: `Here are options:\n\n- First item with a long line that should wrap nicely without messing up the bullet indent\n- Second item\n\n1. Step one\n2. Step two`,
          timestamp: new Date('2026-04-23T00:00:00.000Z'),
          agentId: 'fitness',
        },
      })
    );

    expect(html).toContain('list-outside');
    expect(html).toContain('pl-5');
    expect(html).not.toContain('list-inside');
  });
});

