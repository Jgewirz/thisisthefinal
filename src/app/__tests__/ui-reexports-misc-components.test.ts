import { describe, it, expect } from 'vitest';

import { ThinkingIndicator as AppThinkingIndicator } from '../components/ThinkingIndicator';
import { SourceBadge as AppSourceBadge } from '../components/SourceBadge';
import { AgentStatusPill as AppAgentStatusPill } from '../components/AgentStatusPill';
import { RemindersBell as AppRemindersBell } from '../components/RemindersBell';

import { ThinkingIndicator as UiThinkingIndicator } from '../../ui/components/ThinkingIndicator';
import { SourceBadge as UiSourceBadge } from '../../ui/components/SourceBadge';
import { AgentStatusPill as UiAgentStatusPill } from '../../ui/components/AgentStatusPill';
import { RemindersBell as UiRemindersBell } from '../../ui/components/RemindersBell';

describe('Misc UI component re-export stubs', () => {
  it('keeps ThinkingIndicator wired through src/ui', () => {
    expect(UiThinkingIndicator).toBe(AppThinkingIndicator);
  });

  it('keeps SourceBadge wired through src/ui', () => {
    expect(UiSourceBadge).toBe(AppSourceBadge);
  });

  it('keeps AgentStatusPill wired through src/ui', () => {
    expect(UiAgentStatusPill).toBe(AppAgentStatusPill);
  });

  it('keeps RemindersBell wired through src/ui', () => {
    expect(UiRemindersBell).toBe(AppRemindersBell);
  });
});
