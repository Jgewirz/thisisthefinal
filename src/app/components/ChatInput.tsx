import { Paperclip, MapPin, Send, X, Loader2 } from 'lucide-react';
import { AgentId, agents } from '../types';
import { useState, useRef, useCallback } from 'react';
import { useLocationStore } from '../../stores/location';
import { starterChipLabels } from '../agentStarters';

interface ChatInputProps {
  agentId: AgentId;
  onSend: (text: string, imageBase64?: string) => void;
  disabled?: boolean;
}

export function ChatInput({ agentId, onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const agent = agents[agentId];
  const actions = starterChipLabels(agentId, 3);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const locationStatus = useLocationStore((s) => s.status);
  const locationError = useLocationStore((s) => s.error);
  const requestLocation = useLocationStore((s) => s.request);

  const canSend = (message.trim().length > 0 || !!pendingImage) && !disabled;

  const handleSubmit = useCallback(() => {
    const text = message.trim();
    if ((!text && !pendingImage) || disabled) return;
    const sendText = text || (pendingImage ? 'Analyze this image' : '');
    setMessage('');
    const img = pendingImage;
    setPendingImage(null);
    onSend(sendText, img ?? undefined);
  }, [message, pendingImage, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleQuickAction = useCallback(
    (prompt: string) => {
      if (disabled) return;
      onSend(prompt);
    },
    [disabled, onSend]
  );

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPendingImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  return (
    <div
      className="shrink-0 pb-4 pb-safe"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Quick-action chips */}
      {actions.length > 0 && !pendingImage && (
        <div
          className="px-4 pb-3 flex gap-2 overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
          aria-label="Quick prompts"
          role="group"
        >
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleQuickAction(action.prompt)}
              disabled={disabled}
              title={action.hint}
              aria-label={`Send: ${action.prompt}`}
              className="px-3 py-1 rounded-full text-xs whitespace-nowrap transition-all duration-150 shrink-0 disabled:opacity-40 active:scale-95"
              style={{
                border: `1px solid ${agent.color}55`,
                color: agent.color,
                backgroundColor: 'transparent',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${agent.color}18`)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Image preview */}
      {pendingImage && (
        <div className="px-4 pb-3 flex items-center gap-3">
          <div className="relative shrink-0">
            <img
              src={pendingImage}
              alt="Selected"
              className="h-16 w-16 object-cover rounded-xl"
              style={{ border: `2px solid ${agent.color}` }}
            />
            <button
              onClick={() => setPendingImage(null)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--error)' }}
            >
              <X size={11} color="#fff" />
            </button>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {agentId === 'style'
              ? "Add a message or tap send — I'll analyze it!"
              : 'Image attached. Type a message and send.'}
          </p>
        </div>
      )}

      {/* Pill input bar */}
      <div className="px-4">
        <div
          className="flex items-center gap-2 rounded-2xl px-3 py-2 transition-all duration-200"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: focused ? `0 0 0 2px ${agent.color}44` : 'none',
          }}
        >
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Attachment */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 p-1.5 rounded-lg transition-all active:scale-90"
            style={{ color: pendingImage ? agent.color : 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Paperclip size={17} />
          </button>

          {/* Location */}
          <button
            onClick={requestLocation}
            disabled={locationStatus === 'requesting'}
            title={
              locationStatus === 'granted'
                ? 'Location shared — tap to refresh'
                : locationStatus === 'denied'
                  ? 'Location permission denied'
                  : locationStatus === 'unavailable'
                    ? 'Geolocation not supported'
                    : locationError || 'Share your location'
            }
            className="shrink-0 p-1.5 rounded-lg transition-all active:scale-90 disabled:opacity-40"
            style={{
              color:
                locationStatus === 'granted'
                  ? agent.color
                  : locationStatus === 'denied' || locationStatus === 'error'
                    ? 'var(--error)'
                    : 'var(--text-muted)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            {locationStatus === 'requesting' ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <MapPin size={17} />
            )}
          </button>

          {/* Text input */}
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={pendingImage ? 'Describe what you want analyzed…' : 'Ask GirlBot anything…'}
            disabled={disabled}
            className="flex-1 bg-transparent outline-none text-sm placeholder:opacity-40 disabled:opacity-50"
            style={{ color: 'var(--text-primary)' }}
          />

          {/* Send button — filled when ready, ghost otherwise */}
          <button
            onClick={handleSubmit}
            disabled={!canSend}
            className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90 disabled:opacity-30"
            style={{
              backgroundColor: canSend ? agent.color : 'transparent',
              border: canSend ? 'none' : '1px solid var(--border-subtle)',
            }}
          >
            <Send
              size={15}
              style={{ color: canSend ? '#fff' : 'var(--text-muted)' }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
