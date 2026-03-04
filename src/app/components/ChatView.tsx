import { Search, MoreVertical, Loader2, Trash2 } from 'lucide-react';
import { AgentId, agents, Message } from '../types';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { useChatStore } from '../../stores/chat';
import { useMemo, useRef, useEffect } from 'react';
import { sendMessage, loadChatHistory, clearChatHistory } from '../../lib/api';

interface ChatViewProps {
  agentId: AgentId;
}

export function ChatView({ agentId }: ChatViewProps) {
  const agent = agents[agentId];
  const { messages, isStreaming, historyLoaded } = useChatStore((s) => s.agents[agentId]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load history from DB on first mount for this agent
  useEffect(() => {
    if (!historyLoaded) {
      loadChatHistory(agentId);
    }
  }, [agentId, historyLoaded]);

  // Auto-scroll to bottom on new messages or streaming tokens
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = '';
    let currentGroup: Message[] = [];

    messages.forEach((msg) => {
      const msgDate = msg.timestamp.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
      });

      if (msgDate !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, messages: currentGroup });
        }
        currentDate = msgDate;
        currentGroup = [msg];
      } else {
        currentGroup.push(msg);
      }
    });

    if (currentGroup.length > 0) {
      groups.push({ date: currentDate, messages: currentGroup });
    }

    return groups;
  }, [messages]);

  const handleSend = (text: string, imageBase64?: string) => {
    if (isStreaming) return;
    sendMessage(agentId, text, imageBase64);
  };

  const handleClear = async () => {
    if (messages.length === 0) return;
    if (!window.confirm('Clear this conversation? This cannot be undone.')) return;
    await clearChatHistory(agentId);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div
        className="h-14 flex items-center justify-between px-4 border-b"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--bg-surface-elevated)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
            style={{ backgroundColor: 'var(--accent-global)', color: 'var(--bg-primary)' }}
          >
            G
          </div>
          <div>
            <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              GirlBot
            </div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {agent.name} Agent
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleClear}
            className="p-2 rounded-lg transition-all duration-150 hover:bg-[var(--bg-surface-elevated)] active:scale-90"
            title="Clear conversation"
          >
            <Trash2 size={20} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <button
            className="p-2 rounded-lg transition-all duration-150 hover:bg-[var(--bg-surface-elevated)] active:scale-90"
          >
            <Search size={20} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <button
            className="p-2 rounded-lg transition-all duration-150 hover:bg-[var(--bg-surface-elevated)] active:scale-90"
          >
            <MoreVertical size={20} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 pb-20 sm:pb-6"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        {groupedMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: 'var(--bg-surface)' }}
            >
              <span className="text-2xl">👋</span>
            </div>
            <h2
              className="text-xl font-semibold mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              Hey gorgeous! I'm GirlBot
            </h2>
            <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
              {agent.description}
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                className="px-4 py-2 rounded-full border transition-all duration-150 hover:brightness-110 active:scale-95"
                style={{
                  borderColor: agent.color,
                  color: agent.color,
                }}
                onClick={() => handleSend("What can you help me with?")}
              >
                Get Started
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {groupedMessages.map((group, idx) => (
              <div key={idx}>
                {/* Date separator */}
                <div className="flex justify-center mb-4">
                  <div
                    className="px-3 py-1 rounded-full text-sm"
                    style={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {group.date}
                  </div>
                </div>

                {/* Messages */}
                <div className="space-y-4">
                  {group.messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                </div>
              </div>
            ))}

            {/* Streaming indicator */}
            {isStreaming && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <Loader2
                    size={14}
                    className="animate-spin"
                    style={{ color: 'var(--accent-global)' }}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    typing...
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat Input */}
      <ChatInput agentId={agentId} onSend={handleSend} disabled={isStreaming} />
    </div>
  );
}
