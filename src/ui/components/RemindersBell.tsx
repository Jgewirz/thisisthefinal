import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Check, X, BellOff } from 'lucide-react';
import { useReminderStore } from '../../stores/reminders';
import { remindersApi, requestNotificationPermission } from '../../core/reminders';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const absMin = Math.round(Math.abs(diffMs) / 60_000);
  if (absMin < 60) {
    return diffMs < 0 ? `${absMin}m ago` : `in ${absMin}m`;
  }
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function RemindersBell() {
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);
  const byId = useReminderStore((s) => s.byId);
  const permission = useReminderStore((s) => s.permission);
  const setStatus = useReminderStore((s) => s.setStatus);
  const removeLocal = useReminderStore((s) => s.remove);

  const items = useMemo(
    () =>
      Object.values(byId)
        .filter((r) => r.status === 'pending' || r.status === 'fired')
        .sort(
          (a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
        ),
    [byId]
  );
  const unread = items.filter((r) => r.status === 'fired').length;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const complete = async (id: string) => {
    setStatus(id, 'completed');
    await remindersApi.updateReminderStatus(id, 'completed');
  };
  const dismiss = async (id: string) => {
    setStatus(id, 'dismissed');
    await remindersApi.updateReminderStatus(id, 'dismissed');
  };
  const remove = async (id: string) => {
    removeLocal(id);
    await remindersApi.deleteReminder(id);
  };

  const bellColor = unread > 0 ? 'var(--accent-lifestyle, #f59e0b)' : 'var(--accent-lifestyle, #f59e0b)';

  return (
    <div className="relative" ref={popRef}>
      <button
        aria-label="Reminders"
        onClick={() => setOpen((v) => !v)}
        className="relative flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-all active:scale-90 hover:bg-[var(--bg-hover)]"
      >
        <div className="relative">
          <Bell size={17} style={{ color: bellColor }} />
          {unread > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-[var(--bg-surface)]"
              style={{ backgroundColor: '#ef4444' }}
              aria-label={`${unread} due reminders`}
            />
          )}
        </div>
        <span className="text-[9px] font-medium leading-none" style={{ color: bellColor }}>
          {unread > 0 ? `${unread} due` : 'Reminders'}
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl shadow-lg z-50"
          style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
          role="dialog"
          aria-label="Reminders"
        >
          <div
            className="px-4 py-3 flex items-center justify-between border-b"
            style={{ borderColor: 'var(--bg-surface-elevated)' }}
          >
            <span className="font-semibold">Reminders</span>
            {permission !== 'granted' && permission !== 'unsupported' && (
              <button
                onClick={() => requestNotificationPermission()}
                className="text-xs underline"
                style={{ color: 'var(--text-secondary)' }}
              >
                Enable notifications
              </button>
            )}
            {permission === 'unsupported' && (
              <span
                className="text-xs flex items-center gap-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                <BellOff size={12} /> unsupported
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <div
              className="px-4 py-6 text-sm text-center"
              style={{ color: 'var(--text-secondary)' }}
            >
              No reminders yet. Ask the lifestyle agent: "remind me in 10 minutes".
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--bg-surface-elevated)' }}>
              {items.map((r) => (
                <li key={r.id} className="px-4 py-3 flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm ${r.status === 'fired' ? 'font-semibold' : ''}`}
                      title={r.title}
                    >
                      {r.title}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {formatWhen(r.due_at)}
                      {r.status === 'fired' && ' · due now'}
                    </div>
                    {r.notes && (
                      <div
                        className="text-xs mt-1 line-clamp-2"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {r.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      aria-label="Complete reminder"
                      onClick={() => complete(r.id)}
                      className="p-1 rounded hover:opacity-80"
                      title="Complete"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      aria-label="Dismiss reminder"
                      onClick={() => dismiss(r.id)}
                      className="p-1 rounded hover:opacity-80"
                      title="Dismiss"
                    >
                      <X size={14} />
                    </button>
                    <button
                      aria-label="Delete reminder"
                      onClick={() => remove(r.id)}
                      className="p-1 rounded hover:opacity-80 text-xs"
                      title="Delete"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
