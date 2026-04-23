import { Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSavedStore } from '../../stores/saved';
import type { SavedItemKind } from '../../lib/savedApi';

interface SaveButtonProps {
  kind: SavedItemKind;
  externalId: string;
  data: Record<string, unknown>;
  agentColor: string;
  size?: number;
  /** Render inside existing card row; defaults to a tiny transparent button. */
  className?: string;
  label?: string;
}

/**
 * Tiny star-toggle that saves / unsaves a rich-card item. Rendering stays
 * optimistic: the star flips on tap and rolls back on network failure.
 */
export function SaveButton({
  kind,
  externalId,
  data,
  agentColor,
  size = 16,
  className = '',
  label,
}: SaveButtonProps) {
  const saved = useSavedStore((s) => s.isSaved(kind, externalId));
  const loadKind = useSavedStore((s) => s.loadKind);
  const doSave = useSavedStore((s) => s.save);
  const doUnsave = useSavedStore((s) => s.unsave);
  const [busy, setBusy] = useState(false);

  // Ensure we know the current saved state for this kind before the user taps.
  useEffect(() => {
    void loadKind(kind);
  }, [kind, loadKind]);

  const toggle = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy || !externalId) return;
    setBusy(true);
    try {
      if (saved) await doUnsave(kind, externalId);
      else await doSave(kind, externalId, data);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || !externalId}
      aria-pressed={saved}
      aria-label={saved ? `Unsave ${label ?? kind}` : `Save ${label ?? kind}`}
      title={saved ? 'Saved — tap to remove' : 'Save for later'}
      className={`inline-flex items-center justify-center rounded-full p-1 transition-opacity disabled:opacity-50 hover:opacity-80 focus:outline-none focus-visible:ring-2 ${className}`}
      style={{
        color: agentColor,
        backgroundColor: saved ? agentColor + '22' : 'transparent',
      }}
    >
      <Star
        size={size}
        fill={saved ? agentColor : 'none'}
        style={{ color: agentColor }}
      />
    </button>
  );
}
