import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
  hydrateFromDb: () => Promise<void>;
  saveAgentHistory: (agentId: AgentId) => Promise<void>;
}

const defaultAgentState = (): AgentState => ({
  messages: [],
  isStreaming: false,
  isAnalyzing: false,
});

function makeDefaultAgents(): Record<AgentId, AgentState> {
  return {
    all: defaultAgentState(),
    style: defaultAgentState(),
    travel: defaultAgentState(),
    fitness: defaultAgentState(),
    lifestyle: defaultAgentState(),
  };
}

function restoreMessage(message: Message): Message {
  return {
    ...message,
    timestamp: message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp),
  };
}

let chatHydrationPromise: Promise<void> | null = null;

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      agents: makeDefaultAgents(),

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

      hydrateFromDb: async () => {
        if (chatHydrationPromise) return chatHydrationPromise;

        chatHydrationPromise = (async () => {
          try {
            const res = await fetch('/api/chat/history', { credentials: 'include' });
            if (!res.ok) return;

            const { history } = await res.json();
            const nextAgents = makeDefaultAgents();
            const localAgents = get().agents;
            const agentsToBackfill: AgentId[] = [];

            for (const agentId of Object.keys(nextAgents) as AgentId[]) {
              const remoteMessages = Array.isArray(history?.[agentId])
                ? history[agentId].map(restoreMessage)
                : [];
              const localMessages = localAgents[agentId].messages;

              nextAgents[agentId] = {
                ...defaultAgentState(),
                messages: remoteMessages.length > 0 ? remoteMessages : localMessages,
              };

              if (remoteMessages.length === 0 && localMessages.length > 0) {
                agentsToBackfill.push(agentId);
              }
            }

            set({ agents: nextAgents });

            for (const agentId of agentsToBackfill) {
              await get().saveAgentHistory(agentId);
            }
          } catch {
            // Keep local cache if DB history is unavailable.
          } finally {
            chatHydrationPromise = null;
          }
        })();

        return chatHydrationPromise;
      },

      saveAgentHistory: async (agentId) => {
        const messages = get().agents[agentId].messages.filter(
          (message) => message.text || message.imageUrl || message.richCard
        );

        try {
          await fetch(`/api/chat/history/${agentId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ messages }),
          });
        } catch {
          // Local persistence remains as fallback cache.
        }
      },
    }),
    {
      name: 'girlbot-chat-history',
      partialize: (state) => ({
        agents: Object.fromEntries(
          Object.entries(state.agents).map(([agentId, agentState]) => [
            agentId,
            {
              ...defaultAgentState(),
              messages: agentState.messages,
            },
          ])
        ) as Record<AgentId, AgentState>,
      }),
      merge: (persisted, current) => {
        const currentState = current as ChatStore;
        const persistedState = persisted as Partial<ChatStore> | undefined;
        const mergedAgents = makeDefaultAgents();

        for (const agentId of Object.keys(mergedAgents) as AgentId[]) {
          const persistedAgent = persistedState?.agents?.[agentId];
          if (!persistedAgent) continue;

          mergedAgents[agentId] = {
            ...defaultAgentState(),
            messages: (persistedAgent.messages || [])
              .map(restoreMessage)
              .filter((message) => message.text || message.richCard || message.imageUrl),
          };
        }

        return {
          ...currentState,
          agents: mergedAgents,
        };
      },
    }
  )
);
