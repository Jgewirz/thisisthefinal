import { X, Trash2, Moon } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { clearAllHistory } from '../../lib/api';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const user = useAuthStore((s) => s.user);

  if (!open) return null;

  const handleClearAll = async () => {
    if (!window.confirm('Clear ALL conversations across all agents? This cannot be undone.')) return;
    await clearAllHistory();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 cursor-pointer"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl mx-4"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-all duration-150 hover:brightness-125 active:scale-90"
            style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
          >
            <X size={18} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* General Section */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
            General
          </h3>

          <div className="space-y-3">
            <div
              className="flex items-center justify-between p-3 rounded-lg"
              style={{ backgroundColor: 'var(--bg-primary)' }}
            >
              <div className="flex items-center gap-3">
                <Moon size={18} style={{ color: 'var(--text-secondary)' }} />
                <span style={{ color: 'var(--text-primary)' }}>Theme</span>
              </div>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Dark</span>
            </div>

            {user && (
              <div
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ backgroundColor: 'var(--bg-primary)' }}
              >
                <div>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Account</div>
                  <div style={{ color: 'var(--text-primary)' }}>{user.email}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Data Section */}
        <div>
          <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
            Data
          </h3>

          <button
            onClick={handleClearAll}
            className="flex items-center gap-3 w-full p-3 rounded-lg transition-all duration-150 hover:opacity-80 active:scale-[0.98]"
            style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}
          >
            <Trash2 size={18} style={{ color: 'var(--error)' }} />
            <span style={{ color: 'var(--error)' }}>Clear all conversations</span>
          </button>
        </div>
      </div>
    </div>
  );
}
