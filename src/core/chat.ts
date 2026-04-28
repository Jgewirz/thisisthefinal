import type { AgentId } from '../app/types';
import { sendMessage, loadChatHistory, clearChatHistory, clearAllHistory } from '../lib/api';

/**
 * Core chat interface used by the UI.
 * UI must not call ../lib/api directly.
 */
export const chatCore = {
  sendMessage: (agentId: AgentId, text: string, imageBase64?: string) =>
    sendMessage(agentId, text, imageBase64),
  loadChatHistory: (agentId: AgentId) => loadChatHistory(agentId),
  clearChatHistory: (agentId: AgentId) => clearChatHistory(agentId),
  clearAllHistory: () => clearAllHistory(),
};

