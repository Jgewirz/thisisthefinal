import { create } from 'zustand';
import type { AgentId, Message, RichCard } from '../app/types';

interface AgentState {
  messages: Message[];
  isStreaming: boolean;
  isAnalyzing: boolean;
}

interface ChatStore {
  agents: Record<AgentId, AgentState>;
  addMessage: (agentId: AgentId, message: Message) => void;
  appendToLastBot: (agentId: AgentId, token: string) => void;
  setRichCardOnLastBot: (agentId: AgentId, richCard: RichCard) => void;
  setStreaming: (agentId: AgentId, streaming: boolean) => void;
  setAnalyzing: (agentId: AgentId, analyzing: boolean) => void;
  getMessages: (agentId: AgentId) => Message[];
}

const defaultAgentState = (): AgentState => ({
  messages: [],
  isStreaming: false,
  isAnalyzing: false,
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

  setAnalyzing: (agentId, analyzing) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [agentId]: {
          ...state.agents[agentId],
          isAnalyzing: analyzing,
        },
      },
    })),

  getMessages: (agentId) => get().agents[agentId].messages,
}));
