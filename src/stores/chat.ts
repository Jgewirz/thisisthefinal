import { create } from 'zustand';
import type { ActivityState, AgentId, Message, RichCard } from '../app/types';

interface AgentState {
  messages: Message[];
  isStreaming: boolean;
  historyLoaded: boolean;
  /**
   * Live tool / model activity indicator. Cleared on the first streamed token
   * or when the stream ends (success or error). Never persisted.
   */
  activity: ActivityState | null;
}

interface ChatStore {
  agents: Record<AgentId, AgentState>;
  addMessage: (agentId: AgentId, message: Message) => void;
  setMessages: (agentId: AgentId, messages: Message[]) => void;
  clearMessages: (agentId: AgentId) => void;
  clearAllMessages: () => void;
  appendToLastBot: (agentId: AgentId, token: string) => void;
  setRichCardOnLastBot: (agentId: AgentId, richCard: RichCard) => void;
  updateLastBotAgentId: (storeAgentId: AgentId, classifiedAgentId: AgentId) => void;
  setStreaming: (agentId: AgentId, streaming: boolean) => void;
  setActivity: (agentId: AgentId, activity: ActivityState | null) => void;
  setHistoryLoaded: (agentId: AgentId) => void;
  getMessages: (agentId: AgentId) => Message[];
}

const defaultAgentState = (): AgentState => ({
  messages: [],
  isStreaming: false,
  historyLoaded: false,
  activity: null,
});

export const useChatStore = create<ChatStore>((set, get) => ({
  agents: {
    all: defaultAgentState(),
    style: defaultAgentState(),
    travel: defaultAgentState(),
    fitness: defaultAgentState(),
    lifestyle: defaultAgentState(),
  },

  addMessage: (agentId, message) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [agentId]: {
          ...state.agents[agentId],
          messages: [...state.agents[agentId].messages, message],
        },
      },
    })),

  setMessages: (agentId, messages) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [agentId]: {
          ...state.agents[agentId],
          messages,
        },
      },
    })),

  clearMessages: (agentId) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [agentId]: {
          ...state.agents[agentId],
          messages: [],
          historyLoaded: true, // prevent re-fetching empty history
        },
      },
    })),

  clearAllMessages: () =>
    set((state) => {
      const agents = { ...state.agents };
      for (const id of Object.keys(agents) as AgentId[]) {
        agents[id] = { ...agents[id], messages: [], historyLoaded: true };
      }
      return { agents };
    }),

  appendToLastBot: (agentId, token) =>
    set((state) => {
      const agentMessages = [...state.agents[agentId].messages];
      const last = agentMessages[agentMessages.length - 1];
      if (last && last.type === 'bot') {
        agentMessages[agentMessages.length - 1] = {
          ...last,
          text: last.text + token,
        };
      }
      return {
        agents: {
          ...state.agents,
          [agentId]: {
            ...state.agents[agentId],
            messages: agentMessages,
            // First visible token means the backend is done "thinking/writing".
            activity: null,
          },
        },
      };
    }),

  setRichCardOnLastBot: (agentId, richCard) =>
    set((state) => {
      const agentMessages = [...state.agents[agentId].messages];
      const last = agentMessages[agentMessages.length - 1];
      if (last && last.type === 'bot') {
        agentMessages[agentMessages.length - 1] = { ...last, richCard };
      }
      return {
        agents: {
          ...state.agents,
          [agentId]: {
            ...state.agents[agentId],
            messages: agentMessages,
          },
        },
      };
    }),

  updateLastBotAgentId: (storeAgentId, classifiedAgentId) =>
    set((state) => {
      const agentMessages = [...state.agents[storeAgentId].messages];
      const last = agentMessages[agentMessages.length - 1];
      if (last && last.type === 'bot') {
        agentMessages[agentMessages.length - 1] = { ...last, agentId: classifiedAgentId };
      }
      return {
        agents: {
          ...state.agents,
          [storeAgentId]: {
            ...state.agents[storeAgentId],
            messages: agentMessages,
          },
        },
      };
    }),

  setStreaming: (agentId, streaming) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [agentId]: {
          ...state.agents[agentId],
          isStreaming: streaming,
          // A finished stream can never be "still searching…"
          activity: streaming ? state.agents[agentId].activity : null,
        },
      },
    })),

  setActivity: (agentId, activity) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [agentId]: {
          ...state.agents[agentId],
          activity,
        },
      },
    })),

  setHistoryLoaded: (agentId) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [agentId]: {
          ...state.agents[agentId],
          historyLoaded: true,
        },
      },
    })),

  getMessages: (agentId) => get().agents[agentId].messages,
}));
