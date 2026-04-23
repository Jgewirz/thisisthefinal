import { beforeEach, describe, expect, it } from 'vitest';
import { useChatStore } from '../chat';
import type { ActivityState, Message } from '../../app/types';

const act: ActivityState = { kind: 'search_places', startedAt: 123 };

function resetStore() {
  useChatStore.setState((s) => {
    const agents = { ...s.agents };
    for (const id of Object.keys(agents) as (keyof typeof agents)[]) {
      agents[id] = { ...agents[id], messages: [], isStreaming: false, activity: null };
    }
    return { agents };
  });
}

function botPlaceholder(): Message {
  return {
    id: 'bot-1',
    type: 'bot',
    text: '',
    timestamp: new Date(0),
    agentId: 'fitness',
  };
}

describe('chat store — activity lifecycle', () => {
  beforeEach(resetStore);

  it('setActivity writes the pill state on the target agent only', () => {
    useChatStore.getState().setActivity('fitness', act);
    expect(useChatStore.getState().agents.fitness.activity).toEqual(act);
    expect(useChatStore.getState().agents.travel.activity).toBeNull();
  });

  it('first streamed token clears the activity pill (handoff to real text)', () => {
    useChatStore.getState().addMessage('fitness', botPlaceholder());
    useChatStore.getState().setActivity('fitness', act);
    useChatStore.getState().appendToLastBot('fitness', 'Hel');
    expect(useChatStore.getState().agents.fitness.activity).toBeNull();
    // Extra tokens keep activity null (idempotent).
    useChatStore.getState().appendToLastBot('fitness', 'lo');
    expect(useChatStore.getState().agents.fitness.activity).toBeNull();
  });

  it('ending the stream clears any stuck activity', () => {
    useChatStore.getState().setActivity('travel', {
      kind: 'search_flights',
      detail: 'JFK → CDG',
      startedAt: 1,
    });
    useChatStore.getState().setStreaming('travel', true);
    useChatStore.getState().setStreaming('travel', false);
    expect(useChatStore.getState().agents.travel.activity).toBeNull();
  });

  it('setStreaming(true) leaves an existing activity untouched', () => {
    useChatStore.getState().setActivity('travel', act);
    useChatStore.getState().setStreaming('travel', true);
    expect(useChatStore.getState().agents.travel.activity).toEqual(act);
  });
});
