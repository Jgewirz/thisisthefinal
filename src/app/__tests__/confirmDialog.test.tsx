import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

describe('ConfirmDialog (smoke)', () => {
  it('renders title, detail, and yes/no buttons', async () => {
    const { ConfirmDialog } = await import('../components/ConfirmDialog');
    const html = renderToString(
      React.createElement(ConfirmDialog, {
        title: 'Remove this item?',
        detail: 'This will permanently remove it.',
        confirmText: 'Yes, remove',
        cancelText: 'No, keep',
        destructive: true,
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      })
    );
    expect(html).toMatch(/role="dialog"/);
    expect(html).toMatch(/Remove this item\?/);
    expect(html).toMatch(/permanently remove/i);
    expect(html).toContain('Yes, remove');
    expect(html).toContain('No, keep');
  });
});

