import { Paperclip, MapPin, Send, X } from 'lucide-react';
import { AgentId, agents } from '../types';
import { useState, useRef, useCallback } from 'react';

interface ChatInputProps {
  agentId: AgentId;
  onSend: (text: string, imageBase64?: string) => void;
  disabled?: boolean;
}

const quickActions: Record<AgentId, string[]> = {
  all: [],
  style: ['Analyze my colors', 'Rate my outfit', 'Wardrobe check'],
  travel: ['Plan a trip', 'Find flights', 'Hotel search'],
  fitness: ['Studios near me', 'Yoga classes', 'Gym finder'],
  lifestyle: ['Set reminder', 'My schedule', 'Wellness check'],
};

export function ChatInput({ agentId, onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const agent = agents[agentId];
  const actions = quickActions[agentId];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    const text = message.trim();
    // Allow send if there's text OR a pending image
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
    (action: string) => {
      if (disabled) return;
      onSend(action);
    },
    [disabled, onSend]
  );

  const handleAttachment = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        setPendingImage(reader.result as string);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    },
    []
  );

  const clearPendingImage = useCallback(() => {
    setPendingImage(null);
  }, []);

  return (
    <div
      className="border-t"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--bg-surface-elevated)',
      }}
    >
      {/* Quick action chips */}
      {actions.length > 0 && !pendingImage && (
        <div className="px-4 py-3 flex gap-2 overflow-x-auto">
          {actions.map((action) => (
            <button
              key={action}
              onClick={() => handleQuickAction(action)}
              disabled={disabled}
              className="px-3 py-1.5 rounded-full text-sm whitespace-nowrap border transition-all duration-150 flex-shrink-0 disabled:opacity-50 active:scale-95"
              style={{
                borderColor: agent.color,
                color: agent.color,
                backgroundColor: 'transparent',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = agent.color + '18'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {/* Image preview strip */}
      {pendingImage && (
        <div className="px-4 py-3">
          <div className="relative inline-block">
            <img
              src={pendingImage}
              alt="Selected"
              className="h-24 w-24 object-cover rounded-xl border-2"
              style={{ borderColor: agent.color }}
            />
            <button
              onClick={clearPendingImage}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-150 hover:brightness-125 active:scale-90"
              style={{ backgroundColor: 'var(--error)' }}
            >
              <X size={14} style={{ color: 'var(--bg-primary)' }} />
            </button>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
            {agentId === 'style'
              ? 'Add a message or tap send — I\'ll analyze it!'
              : 'Image attached — type a message and send'}
          </p>
        </div>
      )}

      {/* Input area */}
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Attachment buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleAttachment}
            className="p-2 rounded-lg transition-all duration-150 hover:bg-[var(--bg-surface-elevated)] active:scale-90"
          >
            <Paperclip
              size={20}
              style={{ color: pendingImage ? agent.color : 'var(--text-secondary)' }}
            />
          </button>
          <button
            className="p-2 rounded-lg transition-all duration-150 hover:bg-[var(--bg-surface-elevated)] active:scale-90"
          >
            <MapPin size={20} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* Text input */}
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            pendingImage
              ? 'Describe what you want analyzed...'
              : 'Ask GirlBot anything...'
          }
          disabled={disabled}
          className="flex-1 px-4 py-2.5 rounded-full outline-none disabled:opacity-50"
          style={{
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)',
          }}
        />

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={disabled || (!message.trim() && !pendingImage)}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 disabled:opacity-50 hover:brightness-110"
          style={{ backgroundColor: 'var(--accent-global)' }}
        >
          <Send size={18} style={{ color: 'var(--bg-primary)' }} />
        </button>
      </div>
    </div>
  );
}
