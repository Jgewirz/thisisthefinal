import type { ActivityState } from '../../core/types';
import { activityBaseLabel, activityLabel } from '../../core/activityLabels';

interface ThinkingIndicatorProps {
  activity: ActivityState;
  agentColor: string;
}

/**
 * Small pill shown on the active bot message while tools / the model are
 * working. Uses CSS animations, but respects `prefers-reduced-motion`
 * (handled by Tailwind's `motion-safe` / `motion-reduce` variants).
 *
 * Accessibility: exposed as an `aria-live="polite"` region so screen-readers
 * hear transitions like "Searching flights" → "Writing response" without
 * interrupting the current announcement.
 */
export function ThinkingIndicator({ activity, agentColor }: ThinkingIndicatorProps) {
  const label = activityLabel(activity);
  const base = activityBaseLabel(activity.kind);
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={base}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
      style={{
        backgroundColor: 'var(--bg-surface-elevated, rgba(255,255,255,0.06))',
        color: 'var(--text-secondary)',
      }}
    >
      <span className="inline-flex items-center gap-1" aria-hidden="true">
        <Dot color={agentColor} delay={0} />
        <Dot color={agentColor} delay={150} />
        <Dot color={agentColor} delay={300} />
      </span>
      <span className="truncate max-w-[14rem]" title={label}>
        {label}
      </span>
    </div>
  );
}

function Dot({ color, delay }: { color: string; delay: number }) {
  return (
    <span
      className="block w-1.5 h-1.5 rounded-full motion-safe:animate-pulse motion-reduce:opacity-60"
      style={{ backgroundColor: color, animationDelay: `${delay}ms` }}
    />
  );
}
