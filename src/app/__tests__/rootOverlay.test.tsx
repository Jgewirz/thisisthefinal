import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { useAuthStore } from '../../stores/auth';

vi.mock('react-router', () => ({
  Outlet: () => React.createElement('div', { 'data-testid': 'outlet' }),
  Navigate: () => React.createElement('div', { 'data-testid': 'navigate' }),
}));

vi.mock('../components/Sidebar', () => ({
  Sidebar: () => React.createElement('div', { 'data-testid': 'sidebar' }),
}));

vi.mock('../components/BottomTabBar', () => ({
  BottomTabBar: () => React.createElement('div', { 'data-testid': 'bottom-tabs' }),
}));

describe('Root layout', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: true } as any);
  });

  it('does not render a top-right absolute overlay (prevents header icon overlap)', async () => {
    const { Root } = await import('../components/Root');
    const html = renderToString(React.createElement(Root));
    expect(html).not.toContain('absolute top-3 right-3');
    // Saved / Reminders controls now live inside the chat header, not Root.
    expect(html).not.toContain('Open saved items');
    expect(html).not.toContain('Reminders');
  });
});

