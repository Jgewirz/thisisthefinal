import { useState, useEffect } from 'react';
import { X, CalendarDays, Clock, Flag } from 'lucide-react';
import type { CalendarTask } from '../../stores/calendar';

interface TaskFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (task: {
    title: string;
    description: string;
    dueDate: string;
    dueTime: string | null;
    priority: 'low' | 'medium' | 'high';
    completed: boolean;
  }) => void;
  editTask?: CalendarTask | null;
  initialDate?: string;
}

const priorityColors = {
  low: '#A8E6CF',
  medium: '#FFD580',
  high: '#F87171',
};

export function TaskFormDialog({ open, onClose, onSubmit, editTask, initialDate }: TaskFormDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');

  useEffect(() => {
    if (editTask) {
      setTitle(editTask.title);
      setDescription(editTask.description || '');
      setDueDate(editTask.dueDate);
      setDueTime(editTask.dueTime || '');
      setPriority(editTask.priority);
    } else {
      setTitle('');
      setDescription('');
      setDueDate(initialDate || new Date().toISOString().slice(0, 10));
      setDueTime('');
      setPriority('medium');
    }
  }, [editTask, initialDate, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;

    onSubmit({
      title: title.trim(),
      description: description.trim(),
      dueDate,
      dueTime: dueTime || null,
      priority,
      completed: editTask?.completed ?? false,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className="relative w-full max-w-md rounded-2xl p-6 shadow-xl"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3
            className="text-lg font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {editTask ? 'Edit Task' : 'New Task'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <input
              type="text"
              placeholder="Task title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg border-none outline-none"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Description */}
          <div>
            <textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg border-none outline-none resize-none"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Date + Time row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="flex items-center gap-1.5 text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                <CalendarDays size={14} />
                Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border-none outline-none"
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  color: 'var(--text-primary)',
                  colorScheme: 'dark',
                }}
              />
            </div>
            <div className="flex-1">
              <label className="flex items-center gap-1.5 text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                <Clock size={14} />
                Time (optional)
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border-none outline-none"
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  color: 'var(--text-primary)',
                  colorScheme: 'dark',
                }}
              />
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="flex items-center gap-1.5 text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              <Flag size={14} />
              Priority
            </label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    backgroundColor:
                      priority === p
                        ? priorityColors[p]
                        : 'var(--bg-surface-elevated)',
                    color:
                      priority === p
                        ? 'var(--bg-primary)'
                        : 'var(--text-secondary)',
                    opacity: priority === p ? 1 : 0.7,
                  }}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!title.trim() || !dueDate}
            className="w-full py-2.5 rounded-lg font-medium transition-opacity disabled:opacity-40"
            style={{
              backgroundColor: 'var(--accent-calendar)',
              color: 'var(--bg-primary)',
            }}
          >
            {editTask ? 'Save Changes' : 'Add Task'}
          </button>
        </form>
      </div>
    </div>
  );
}
