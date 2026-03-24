import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  Trash2,
  Pencil,
  Loader2,
  Unlink,
} from 'lucide-react';
import {
  useCalendarStore,
  type CalendarEvent,
  type CalendarTask,
} from '../../stores/calendar';
import { disconnectGoogleCalendar } from '../../lib/api';
import { useUserStore } from '../../stores/user';
import { TaskFormDialog } from './TaskFormDialog';

// ── Helpers ─────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay(); // 0=Sun
}

function formatMonthYear(year: number, month: number) {
  return new Date(year, month).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

const sourceLabels: Record<string, string> = {
  task: 'Task',
  travel: 'Travel',
  fitness: 'Fitness',
  dining: 'Dining',
  google: 'Google',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Component ───────────────────────────────────────────────────────────

export function CalendarView() {
  const {
    events,
    googleStatus,
    selectedDate,
    isLoading,
    setSelectedDate,
    fetchEvents,
    fetchGoogleStatus,
    toggleTask,
    removeTask,
    addTask,
    updateTask,
  } = useCalendarStore();

  const [searchParams] = useSearchParams();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CalendarTask | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const userProvider = useUserStore((s) => s.user?.provider);

  // Parse selectedDate into year/month
  const selectedYear = parseInt(selectedDate.slice(0, 4), 10);
  const selectedMonth = parseInt(selectedDate.slice(5, 7), 10) - 1; // 0-indexed
  const selectedDay = parseInt(selectedDate.slice(8, 10), 10);

  // ── Google OAuth callback detection ───────────────────────────────
  useEffect(() => {
    const gParam = searchParams.get('google');
    if (gParam === 'connected') {
      setToastMsg('Google Calendar connected!');
      fetchGoogleStatus();
      // Refresh events to include Google events
      const from = new Date(selectedYear, selectedMonth, 1).toISOString().slice(0, 10);
      const to = new Date(selectedYear, selectedMonth + 1, 6).toISOString().slice(0, 10);
      fetchEvents(from, to);
    } else if (gParam === 'error') {
      setToastMsg('Failed to connect Google Calendar');
    }
  }, [searchParams]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMsg) {
      const t = setTimeout(() => setToastMsg(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMsg]);

  // ── Fetch events when month changes ───────────────────────────────
  useEffect(() => {
    const from = new Date(selectedYear, selectedMonth, -6).toISOString().slice(0, 10);
    const to = new Date(selectedYear, selectedMonth + 1, 6).toISOString().slice(0, 10);
    fetchEvents(from, to);
  }, [selectedYear, selectedMonth]);

  // ── Calendar grid computation ─────────────────────────────────────
  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
    const firstDay = getFirstDayOfWeek(selectedYear, selectedMonth);

    const days: Array<{ date: string; day: number; isCurrentMonth: boolean }> = [];

    // Previous month overflow
    const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
    const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
    const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      days.push({
        date: toDateStr(prevYear, prevMonth, d),
        day: d,
        isCurrentMonth: false,
      });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        date: toDateStr(selectedYear, selectedMonth, d),
        day: d,
        isCurrentMonth: true,
      });
    }

    // Next month overflow
    const nextMonth = selectedMonth === 11 ? 0 : selectedMonth + 1;
    const nextYear = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
    const remaining = 42 - days.length; // 6 rows x 7 cols

    for (let d = 1; d <= remaining; d++) {
      days.push({
        date: toDateStr(nextYear, nextMonth, d),
        day: d,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [selectedYear, selectedMonth]);

  // ── Events grouped by date ────────────────────────────────────────
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const evt of events) {
      const list = map.get(evt.date) || [];
      list.push(evt);
      map.set(evt.date, list);
    }
    return map;
  }, [events]);

  const selectedDayEvents = eventsByDate.get(selectedDate) || [];
  const todayStr = new Date().toISOString().slice(0, 10);

  // ── Navigation ────────────────────────────────────────────────────
  const goToPrevMonth = useCallback(() => {
    const d = new Date(selectedYear, selectedMonth - 1, 1);
    setSelectedDate(toDateStr(d.getFullYear(), d.getMonth(), 1));
  }, [selectedYear, selectedMonth, setSelectedDate]);

  const goToNextMonth = useCallback(() => {
    const d = new Date(selectedYear, selectedMonth + 1, 1);
    setSelectedDate(toDateStr(d.getFullYear(), d.getMonth(), 1));
  }, [selectedYear, selectedMonth, setSelectedDate]);

  const goToToday = useCallback(() => {
    setSelectedDate(todayStr);
  }, [todayStr, setSelectedDate]);

  // ── Google Calendar ───────────────────────────────────────────────
  const handleGoogleDisconnect = async () => {
    await disconnectGoogleCalendar();
    fetchGoogleStatus();
    const from = new Date(selectedYear, selectedMonth, -6).toISOString().slice(0, 10);
    const to = new Date(selectedYear, selectedMonth + 1, 6).toISOString().slice(0, 10);
    fetchEvents(from, to);
    setToastMsg('Google Calendar disconnected');
  };

  // ── Task form handlers ────────────────────────────────────────────
  const handleCreateTask = () => {
    setEditingTask(null);
    setTaskDialogOpen(true);
  };

  const handleEditTask = (task: CalendarTask) => {
    setEditingTask(task);
    setTaskDialogOpen(true);
  };

  const handleTaskSubmit = async (taskData: {
    title: string;
    description: string;
    dueDate: string;
    dueTime: string | null;
    priority: 'low' | 'medium' | 'high';
    completed: boolean;
  }) => {
    if (editingTask) {
      await updateTask(editingTask.id, taskData);
    } else {
      await addTask(taskData);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div
        className="h-14 flex items-center justify-between px-4 border-b shrink-0"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--bg-surface-elevated)',
        }}
      >
        <div className="flex items-center gap-3">
          <CalendarDays size={20} style={{ color: 'var(--accent-calendar)' }} />
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            Calendar
          </span>
          {isLoading && (
            <Loader2
              size={14}
              className="animate-spin"
              style={{ color: 'var(--text-secondary)' }}
            />
          )}
        </div>

        {/* Google Calendar status */}
        <div>
          {googleStatus.connected ? (
            <button
              onClick={handleGoogleDisconnect}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                color: '#F87171',
              }}
            >
              <Unlink size={12} />
              Disconnect Google
            </button>
          ) : userProvider === 'google' ? (
            <span
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                color: 'var(--text-secondary)',
              }}
            >
              <Loader2 size={12} className="animate-spin" />
              Syncing...
            </span>
          ) : (
            <span
              className="px-3 py-1.5 rounded-full text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              Sign in with Google to sync
            </span>
          )}
        </div>
      </div>

      {/* ── Calendar Content ────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto pb-20 sm:pb-4"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="max-w-2xl mx-auto p-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={goToPrevMonth} className="p-2 rounded-lg" style={{ color: 'var(--text-secondary)' }}>
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
              <h2
                className="text-lg font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {formatMonthYear(selectedYear, selectedMonth)}
              </h2>
              {selectedDate !== todayStr && (
                <button
                  onClick={goToToday}
                  className="px-2 py-0.5 rounded text-xs font-medium"
                  style={{
                    backgroundColor: 'var(--accent-calendar)',
                    color: 'var(--bg-primary)',
                  }}
                >
                  Today
                </button>
              )}
            </div>
            <button onClick={goToNextMonth} className="p-2 rounded-lg" style={{ color: 'var(--text-secondary)' }}>
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_NAMES.map((d) => (
              <div
                key={d}
                className="text-center text-xs font-medium py-2"
                style={{ color: 'var(--text-secondary)' }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--bg-surface-elevated)' }}>
            {calendarDays.map((cell) => {
              const isToday = cell.date === todayStr;
              const isSelected = cell.date === selectedDate;
              const dayEvents = eventsByDate.get(cell.date) || [];
              const uniqueSources = [...new Set(dayEvents.map((e) => e.source))];

              return (
                <button
                  key={cell.date}
                  onClick={() => setSelectedDate(cell.date)}
                  className="relative flex flex-col items-center py-2 min-h-[52px] transition-colors"
                  style={{
                    backgroundColor: isSelected
                      ? 'var(--bg-surface-elevated)'
                      : 'var(--bg-surface)',
                    opacity: cell.isCurrentMonth ? 1 : 0.4,
                  }}
                >
                  <span
                    className={`text-sm font-medium ${isToday ? 'w-7 h-7 flex items-center justify-center rounded-full' : ''}`}
                    style={{
                      color: isSelected
                        ? 'var(--accent-calendar)'
                        : 'var(--text-primary)',
                      backgroundColor: isToday ? 'var(--accent-calendar)' : 'transparent',
                      ...(isToday ? { color: 'var(--bg-primary)' } : {}),
                    }}
                  >
                    {cell.day}
                  </span>

                  {/* Event dots */}
                  {uniqueSources.length > 0 && (
                    <div className="flex gap-0.5 mt-1">
                      {uniqueSources.slice(0, 4).map((src) => {
                        const evt = dayEvents.find((e) => e.source === src);
                        return (
                          <div
                            key={src}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: evt?.color || '#666' }}
                          />
                        );
                      })}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Selected Day Events Panel ───────────────────────── */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3
                className="font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </h3>
              <span
                className="text-xs"
                style={{ color: 'var(--text-secondary)' }}
              >
                {selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? 's' : ''}
              </span>
            </div>

            {selectedDayEvents.length === 0 ? (
              <div
                className="text-center py-8 rounded-xl"
                style={{ backgroundColor: 'var(--bg-surface)' }}
              >
                <CalendarDays
                  size={32}
                  className="mx-auto mb-2"
                  style={{ color: 'var(--text-secondary)', opacity: 0.5 }}
                />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  No events for this day
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedDayEvents.map((evt) => (
                  <EventRow
                    key={evt.id}
                    event={evt}
                    onToggle={evt.source === 'task' ? () => toggleTask(evt.data?.taskId) : undefined}
                    onDelete={evt.source === 'task' ? () => removeTask(evt.data?.taskId) : undefined}
                    onEdit={
                      evt.source === 'task'
                        ? () => {
                            const task = useCalendarStore
                              .getState()
                              .tasks.find((t) => t.id === evt.data?.taskId);
                            if (task) handleEditTask(task);
                          }
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Legend ──────────────────────────────────────────── */}
          <div className="mt-6 flex flex-wrap gap-4">
            {[
              { label: 'Tasks', color: '#C4A8FF' },
              { label: 'Travel', color: '#7EC8E3' },
              { label: 'Fitness', color: '#A8E6CF' },
              { label: 'Dining', color: '#F97316' },
              { label: 'Google', color: '#F87171' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FAB: Add Task ──────────────────────────────────────── */}
      <button
        onClick={handleCreateTask}
        className="fixed bottom-20 sm:bottom-6 right-4 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform active:scale-95 z-40"
        style={{
          backgroundColor: 'var(--accent-calendar)',
          color: 'var(--bg-primary)',
        }}
      >
        <Plus size={24} />
      </button>

      {/* ── Task Form Dialog ───────────────────────────────────── */}
      <TaskFormDialog
        open={taskDialogOpen}
        onClose={() => {
          setTaskDialogOpen(false);
          setEditingTask(null);
        }}
        onSubmit={handleTaskSubmit}
        editTask={editingTask}
        initialDate={selectedDate}
      />

      {/* ── Toast ──────────────────────────────────────────────── */}
      {toastMsg && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm font-medium shadow-lg z-50 animate-slide-in"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            color: 'var(--text-primary)',
          }}
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}

// ── Event Row Sub-component ─────────────────────────────────────────────

function EventRow({
  event,
  onToggle,
  onDelete,
  onEdit,
}: {
  event: CalendarEvent;
  onToggle?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl group"
      style={{ backgroundColor: 'var(--bg-surface)' }}
    >
      {/* Colored dot / checkbox */}
      {onToggle ? (
        <button
          onClick={onToggle}
          className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors"
          style={{
            borderColor: event.color,
            backgroundColor: event.completed ? event.color : 'transparent',
          }}
        >
          {event.completed && <Check size={12} style={{ color: 'var(--bg-primary)' }} />}
        </button>
      ) : (
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: event.color }}
        />
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div
          className={`text-sm font-medium truncate ${event.completed ? 'line-through opacity-60' : ''}`}
          style={{ color: 'var(--text-primary)' }}
        >
          {event.title}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {event.time && (
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {event.time}
              {event.endTime ? ` — ${event.endTime}` : ''}
            </span>
          )}
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: event.color + '20',
              color: event.color,
            }}
          >
            {sourceLabels[event.source] || event.source}
          </span>
        </div>
      </div>

      {/* Actions (task-only) */}
      {(onEdit || onDelete) && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Pencil size={14} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: '#F87171' }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
