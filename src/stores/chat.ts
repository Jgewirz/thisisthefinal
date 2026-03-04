import { create } from 'zustand';
import type { AgentId, Message, RichCard } from '../app/types';

interface AgentState {
  messages: Message[];
  isStreaming: boolean;
  historyLoaded: boolean;
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
  setHistoryLoaded: (agentId: AgentId) => void;
  getMessages: (agentId: AgentId) => Message[];
}

const defaultAgentState = (): AgentState => ({
  messages: [],
  isStreaming: false,
  historyLoaded: false,
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
