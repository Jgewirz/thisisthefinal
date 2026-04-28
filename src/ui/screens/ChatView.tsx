import { Loader2, Trash2, ArrowRight, Bookmark, Shirt, MapPin, X } from 'lucide-react';
import { Link } from 'react-router';
import { AgentId, agents, Message } from '../../app/types';
import { MessageBubble } from '../components/MessageBubble';
import { ChatInput } from '../components/ChatInput';
import { useChatStore } from '../../stores/chat';
import { useMemo, useRef, useEffect, useState } from 'react';
import { chatCore } from '../../core/chat';
import { agentStarters } from '../../app/agentStarters';
import { AgentStatusPill } from '../components/AgentStatusPill';
import { ThinkingIndicator } from '../components/ThinkingIndicator';
import { RemindersBell } from '../components/RemindersBell';
import { SavedDrawer } from '../components/SavedDrawer';
import { useLocationStore } from '../../stores/location';

interface ChatViewProps {
  agentId: AgentId;
}

const LOCATION_AGENTS: AgentId[] = ['travel', 'fitness'];

export function ChatView({ agentId }: ChatViewProps) {
  const agent = agents[agentId];
  const { messages, isStreaming, historyLoaded, activity } = useChatStore(
    (s) => s.agents[agentId]
  );
  const [savedOpen, setSavedOpen] = useState(false);
  const [locationNudgeDismissed, setLocationNudgeDismissed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const locationStatus = useLocationStore((s) => s.status);
  const requestLocation = useLocationStore((s) => s.request);

  const showLocationNudge =
    LOCATION_AGENTS.includes(agentId) &&
    !locationNudgeDismissed &&
    (locationStatus === 'idle' || locationStatus === 'denied' || locationStatus === 'error');

  useEffect(() => {
    if (!historyLoaded) chatCore.loadChatHistory(agentId);
  }, [agentId, historyLoaded]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

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
        if (currentGroup.length > 0) groups.push({ date: currentDate, messages: currentGroup });
        currentDate = msgDate;
        currentGroup = [msg];
      } else {
        currentGroup.push(msg);
      }
    });
    if (currentGroup.length > 0) groups.push({ date: currentDate, messages: currentGroup });
    return groups;
  }, [messages]);

  const handleSend = (text: string, imageBase64?: string) => {
    if (isStreaming) return;
    chatCore.sendMessage(agentId, text, imageBase64);
  };

  const handleClear = async () => {
    if (messages.length === 0) return;
    if (!window.confirm('Clear this conversation? This cannot be undone.')) return;
    await chatCore.clearChatHistory(agentId);
  };

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* ── Header ── */}
      <header
        className="h-14 flex items-center justify-between px-4 shrink-0"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {/* Left: agent dot + name + status */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{
              backgroundColor: agent.color,
              boxShadow: `0 0 8px ${agent.color}88`,
            }}
          />
          <span className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
            {agent.name}
          </span>
          <AgentStatusPill agentId={agentId} />
        </div>

        {/* Right: action buttons — icon + label for discoverability */}
        <div className="flex items-center gap-1 shrink-0">
          {agentId === 'style' && (
            <Link
              to="/wardrobe"
              aria-label="Open wardrobe"
              className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-all active:scale-90 hover:bg-[var(--bg-hover)]"
            >
              <Shirt size={17} style={{ color: 'var(--accent-style)' }} />
              <span className="text-[9px] font-medium leading-none" style={{ color: 'var(--accent-style)' }}>
                Wardrobe
              </span>
            </Link>
          )}
          <button
            type="button"
            aria-label="Open saved items"
            onClick={() => setSavedOpen(true)}
            className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-all active:scale-90 hover:bg-[var(--bg-hover)]"
          >
            <Bookmark size={17} style={{ color: 'var(--accent-global)' }} />
            <span className="text-[9px] font-medium leading-none" style={{ color: 'var(--accent-global)' }}>
              Saved
            </span>
          </button>
          <RemindersBell />
          <button
            onClick={handleClear}
            aria-label="Clear conversation"
            className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-all active:scale-90 hover:bg-[rgba(239,68,68,0.08)]"
          >
            <Trash2 size={17} style={{ color: 'rgba(239,68,68,0.7)' }} />
            <span className="text-[9px] font-medium leading-none" style={{ color: 'rgba(239,68,68,0.7)' }}>
              Clear
            </span>
          </button>
        </div>
      </header>

      {/* ── Location nudge banner ── */}
      {showLocationNudge && (
        <div
          className="shrink-0 flex items-center gap-3 px-4 py-2.5 text-xs"
          style={{
            backgroundColor: `${agent.color}14`,
            borderBottom: `1px solid ${agent.color}30`,
          }}
          role="status"
          aria-label="Location permission nudge"
        >
          <MapPin size={14} style={{ color: agent.color, flexShrink: 0 }} />
          <span className="flex-1 leading-snug" style={{ color: 'var(--text-secondary)' }}>
            {locationStatus === 'denied'
              ? 'Location access is blocked — enable it in your browser settings to find nearby places.'
              : 'Share your location for nearby restaurants, hotels, and local activities.'}
          </span>
          {locationStatus !== 'denied' && (
            <button
              onClick={requestLocation}
              className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-all active:scale-95"
              style={{
                backgroundColor: agent.color,
                color: '#fff',
              }}
            >
              Enable
            </button>
          )}
          <button
            onClick={() => setLocationNudgeDismissed(true)}
            aria-label="Dismiss"
            className="shrink-0 p-1 rounded-md transition-all hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── Messages ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto py-6 pb-20 sm:pb-6"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        {groupedMessages.length === 0 ? (
          /* Empty state */
          <div className="h-full flex items-center justify-center px-4">
            <div className="w-full max-w-xl">
              <div className="text-center mb-8">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 mx-auto text-2xl"
                  style={{
                    background: `linear-gradient(135deg, ${agent.color}33, ${agent.color}11)`,
                    border: `1px solid ${agent.color}44`,
                  }}
                >
                  👋
                </div>
                <h2 className="text-2xl font-bold mb-2 tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  {agentId === 'all' ? "Hi — I'm GirlBot" : `${agent.name} Agent`}
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {agent.description}. Try one of these to get started.
                </p>
              </div>

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" aria-label="Example prompts">
                {agentStarters[agentId].map((starter) => (
                  <li key={starter.id}>
                    <button
                      type="button"
                      onClick={() => handleSend(starter.prompt)}
                      aria-label={`Try: ${starter.prompt}`}
                      className="group w-full text-left p-4 rounded-2xl transition-all duration-150 active:scale-[0.99]"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = `${agent.color}55`;
                        e.currentTarget.style.backgroundColor = 'var(--bg-surface-elevated)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-subtle)';
                        e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                          {starter.label}
                        </span>
                        <ArrowRight
                          size={14}
                          className="shrink-0 mt-0.5 opacity-40 group-hover:opacity-100 transition-opacity"
                          style={{ color: agent.color }}
                        />
                      </div>
                      <div className="mt-1 text-xs line-clamp-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                        {starter.hint}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 space-y-1">
            {groupedMessages.map((group, idx) => (
              <div key={idx}>
                {/* Date separator — hairline rule with floating label */}
                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-subtle)' }} />
                  <span
                    className="text-[11px] font-medium uppercase tracking-widest shrink-0 select-none"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {group.date}
                  </span>
                  <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-subtle)' }} />
                </div>

                <div className="space-y-2">
                  {group.messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                </div>
              </div>
            ))}

            {/* Streaming indicators */}
            {isStreaming && activity && (
              <div className="flex justify-start pt-2">
                <ThinkingIndicator activity={activity} agentColor={agent.color} />
              </div>
            )}
            {isStreaming && !activity && (
              <div className="flex justify-start pt-2 pl-11">
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <Loader2 size={13} className="animate-spin" style={{ color: agent.color }} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    typing…
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Input ── */}
      <ChatInput agentId={agentId} onSend={handleSend} disabled={isStreaming} />
      <SavedDrawer open={savedOpen} onClose={() => setSavedOpen(false)} agentColor="var(--accent-all, #7c6afc)" />
    </div>
  );
}

