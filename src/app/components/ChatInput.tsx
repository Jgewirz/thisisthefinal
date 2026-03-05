import { Paperclip, MapPin, Send, X, Camera, Palette, Shirt, Tag } from 'lucide-react';
import { AgentId, agents } from '../types';
import { useState, useRef, useCallback } from 'react';
import { compressImage } from '../../lib/image';
import { useLocationStore } from '../../stores/location';
import { toast } from 'sonner';

interface ChatInputProps {
  agentId: AgentId;
  onSend: (text: string, imageBase64?: string, analysisType?: string) => void;
  disabled?: boolean;
}

const quickActions: Record<AgentId, string[]> = {
  all: [],
  style: ['Analyze my colors', 'Rate my outfit', 'Wardrobe check'],
  travel: ['Plan a trip', 'Find flights', 'Hotel search'],
  fitness: ['Studios near me', 'Yoga classes', 'Gym finder'],
  lifestyle: ['Set reminder', 'My schedule', 'Wellness check'],
};

const imageIntentChips = [
  { label: 'Analyze colors', type: 'skin_tone', icon: Palette, text: 'Analyze my color season from this selfie' },
  { label: 'Rate outfit', type: 'outfit_rating', icon: Shirt, text: 'Rate this outfit' },
  { label: 'Tag for wardrobe', type: 'clothing_tag', icon: Tag, text: 'Tag this item for my wardrobe' },
];

export function ChatInput({ agentId, onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const agent = agents[agentId];
  const actions = quickActions[agentId];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const locationStore = useLocationStore();

  const handleLocationRequest = useCallback(async () => {
    try {
      await locationStore.requestLocation();
      const loc = useLocationStore.getState().location;
      if (loc?.city && loc.region) {
        toast.success(`Location set: ${loc.city}, ${loc.region}`);
      } else if (loc) {
        toast.success('Location updated');
      }
      const err = useLocationStore.getState().error;
      if (err) {
        toast.error(err);
      }
    } catch {
      toast.error('Failed to get location');
    }
  }, [locationStore]);

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
    (action: string) => {
      if (disabled) return;
      onSend(action);
    },
    [disabled, onSend]
  );

  const handleImageIntent = useCallback(
    (chip: typeof imageIntentChips[0]) => {
      if (disabled || !pendingImage) return;
      const img = pendingImage;
      setPendingImage(null);
      setMessage('');
      onSend(chip.text, img, chip.type);
    },
    [disabled, pendingImage, onSend]
  );

  const handleAttachment = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';

      try {
        const compressed = await compressImage(file);
        setPendingImage(compressed);
      } catch {
        const reader = new FileReader();
        reader.onload = () => setPendingImage(reader.result as string);
        reader.readAsDataURL(file);
      }
    },
    []
  );

  const clearPendingImage = useCallback(() => {
    setPendingImage(null);
  }, []);

  const locationLoading = locationStore.isRequesting;
  const hasLocation = !!locationStore.location;

  const showImageIntentChips = pendingImage && agentId === 'style';

  return (
    <div
      className="border-t"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--bg-surface-elevated)',
      }}
    >
      {/* Quick action chips (no image) */}
      {actions.length > 0 && !pendingImage && (
        <div className="px-4 py-3 flex gap-2 overflow-x-auto">
          {actions.map((action) => (
            <button
              key={action}
              onClick={() => handleQuickAction(action)}
              disabled={disabled}
              className="px-3 py-1.5 rounded-full text-sm whitespace-nowrap border transition-colors flex-shrink-0 hover:bg-opacity-10 disabled:opacity-50"
              style={{
                borderColor: agent.color,
                color: agent.color,
                backgroundColor: 'transparent',
              }}
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
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--error)' }}
            >
              <X size={14} style={{ color: 'var(--bg-primary)' }} />
            </button>
          </div>

          {/* Image intent chips for Style agent */}
          {showImageIntentChips ? (
            <div className="flex gap-2 mt-3 overflow-x-auto">
              {imageIntentChips.map((chip) => {
                const Icon = chip.icon;
                return (
                  <button
                    key={chip.type}
                    onClick={() => handleImageIntent(chip)}
                    disabled={disabled}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap border transition-colors flex-shrink-0 hover:bg-opacity-10 disabled:opacity-50"
                    style={{
                      borderColor: agent.color,
                      color: agent.color,
                      backgroundColor: 'transparent',
                    }}
                  >
                    <Icon size={14} />
                    {chip.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
              Image attached — type a message and send
            </p>
          )}
        </div>
      )}

      {/* Input area */}
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Attachment buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleAttachment}
            className="p-2 rounded-lg hover:bg-opacity-50 transition-colors"
            style={{ backgroundColor: 'transparent' }}
          >
            <Paperclip
              size={20}
              style={{ color: pendingImage ? agent.color : 'var(--text-secondary)' }}
            />
          </button>
          {agentId === 'style' ? (
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="p-2 rounded-lg hover:bg-opacity-50 transition-colors"
              style={{ backgroundColor: 'transparent' }}
            >
              <Camera size={20} style={{ color: 'var(--text-secondary)' }} />
            </button>
          ) : (
            <button
              onClick={handleLocationRequest}
              disabled={locationLoading}
              className="p-2 rounded-lg hover:bg-opacity-50 transition-colors disabled:opacity-50"
              style={{ backgroundColor: 'transparent' }}
              title={hasLocation ? `Location: ${locationStore.location!.city || 'Set'}, ${locationStore.location!.region || ''}` : 'Share your location'}
            >
              <MapPin
                size={20}
                style={{ color: hasLocation ? agent.color : 'var(--text-secondary)' }}
              />
            </button>
          )}
        </div>

        {/* Text input */}
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            pendingImage
              ? showImageIntentChips
                ? 'Or type your own request...'
                : 'Describe what you want analyzed...'
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
          className="w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent-global)' }}
        >
          <Send size={18} style={{ color: 'var(--bg-primary)' }} />
        </button>
      </div>
    </div>
  );
}
