import type { ReactNode } from 'react';

export interface ConfirmDialogProps {
  title: string;
  detail?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export function ConfirmDialog({
  title,
  detail,
  confirmText = 'Yes',
  cancelText = 'No',
  destructive = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-md rounded-xl p-5 space-y-3"
        style={{ backgroundColor: 'var(--bg-surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1">
          <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            {title}
          </div>
          {detail && (
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {detail}
            </div>
          )}
        </div>

        {children}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              color: 'var(--text-primary)',
            }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: destructive ? 'rgba(248, 113, 113, 0.18)' : 'var(--accent-style)',
              color: destructive ? '#f87171' : 'var(--bg-primary)',
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

