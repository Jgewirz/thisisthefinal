import { CircleDot, AlertTriangle, Lock } from 'lucide-react';
import { provenanceModeLabel, type CardProvenance } from '../../core/cardProvenance';

interface SourceBadgeProps {
  provenance: CardProvenance;
  agentColor: string;
}

/**
 * Small pill that sits above a rich card and tells the user:
 *   - where the data came from (e.g. "Google Places", "Amadeus")
 *   - whether it's live provider data or a fallback to search links
 *   - why, if applicable ("provider temporarily unavailable")
 *
 * Pure presentational — depends only on `resolveCardProvenance(...)` output.
 */
export function SourceBadge({ provenance, agentColor }: SourceBadgeProps) {
  const { source, mode, detail } = provenance;
  const modeLabel = provenanceModeLabel(mode);

  let dotColor: string;
  let Icon = CircleDot;
  let ariaBase: string;
  switch (mode) {
    case 'live':
      dotColor = 'var(--success, #10b981)';
      Icon = CircleDot;
      ariaBase = `Data source: ${source}, live`;
      break;
    case 'links':
      dotColor = 'var(--warning, #f59e0b)';
      Icon = AlertTriangle;
      ariaBase = `Data source: ${source}, showing booking links only`;
      break;
    case 'internal':
      dotColor = agentColor;
      Icon = Lock;
      ariaBase = `Data source: ${source}`;
      break;
  }

  const aria = detail ? `${ariaBase}. ${detail}` : ariaBase;

  return (
    <div
      role="note"
      aria-label={aria}
      title={detail || aria}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border"
      style={{
        backgroundColor: 'var(--bg-surface-elevated, rgba(0,0,0,0.06))',
        borderColor: 'var(--bg-surface-elevated, rgba(0,0,0,0.08))',
        color: 'var(--text-secondary)',
      }}
    >
      <Icon size={10} style={{ color: dotColor }} aria-hidden="true" />
      <span style={{ color: 'var(--text-primary)' }}>{source}</span>
      {modeLabel && (
        <>
          <span aria-hidden="true" style={{ opacity: 0.5 }}>
            ·
          </span>
          <span style={{ color: dotColor }}>{modeLabel}</span>
        </>
      )}
    </div>
  );
}
