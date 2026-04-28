import { useState } from 'react';
import { Message, agents } from '../../app/types';
import { Check, CheckCheck, Shirt, Star } from 'lucide-react';
import { PlaceCard } from '../../app/components/cards/PlaceCard';
import { PlacesListCard } from '../../app/components/cards/PlacesListCard';
import { ColorSeasonCard } from '../../app/components/cards/ColorSeasonCard';
import { FitnessClassCard } from '../../app/components/cards/FitnessClassCard';
import { FlightCard } from '../../app/components/cards/FlightCard';
import { FlightListCard } from '../../app/components/cards/FlightListCard';
import { HotelListCard } from '../../app/components/cards/HotelListCard';
import { ClassListCard } from '../../app/components/cards/ClassListCard';
import { SourceBadge } from '../../app/components/SourceBadge';
import { ReviewWardrobeDialog } from './ReviewWardrobeDialog';
import { resolveCardProvenance } from '../../app/cardProvenance';
import ReactMarkdown from 'react-markdown';
import { useWardrobeSavesStore } from '../../stores/wardrobeSaves';

interface MessageBubbleProps {
  message: Message;
}

function OutfitRatingCard({
  data,
  agentColor,
}: {
  data: {
    score: number;
    strengths: string[];
    improvements: string[];
    accessorySuggestions: string[];
    colorHarmony: string;
    overallVibe: string;
  };
  agentColor: string;
}) {
  return (
    <div className="p-4 rounded-xl space-y-3" style={{ backgroundColor: 'var(--bg-surface-elevated)' }}>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold" style={{ color: agentColor }}>
          Outfit Rating
        </h3>
        <div className="flex items-center gap-1">
          <Star size={16} fill={agentColor} style={{ color: agentColor }} />
          <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {data.score}/10
          </span>
        </div>
      </div>

      <div
        className="px-3 py-1 rounded-full text-xs inline-block font-medium"
        style={{ backgroundColor: agentColor + '22', color: agentColor }}
      >
        {data.overallVibe}
      </div>

      {data.strengths?.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Strengths
          </div>
          <ul className="space-y-1">
            {data.strengths.map((s, i) => (
              <li key={i} className="text-sm flex items-start gap-1.5">
                <span style={{ color: 'var(--success)' }}>+</span>
                <span style={{ color: 'var(--text-primary)' }}>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.improvements?.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Could improve
          </div>
          <ul className="space-y-1">
            {data.improvements.map((s, i) => (
              <li key={i} className="text-sm flex items-start gap-1.5">
                <span style={{ color: 'var(--warning)' }}>~</span>
                <span style={{ color: 'var(--text-primary)' }}>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.accessorySuggestions?.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Accessory ideas
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.accessorySuggestions.map((s, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-full text-xs"
                style={{ border: `1px solid ${agentColor}55`, color: agentColor }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Color harmony:{' '}
        <span style={{ color: 'var(--text-secondary)' }}>{data.colorHarmony}</span>
      </div>
    </div>
  );
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const agent = agents[message.agentId];
  const isUser = message.type === 'user';
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const savedToWardrobe = useWardrobeSavesStore((s) => s.isSaved(message.id));
  const markSaved = useWardrobeSavesStore((s) => s.markSaved);

  const timeStr = message.timestamp.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const canSaveToWardrobe = isUser && message.agentId === 'style' && Boolean(message.imageUrl);

  if (!isUser && !message.text && !message.richCard) return null;

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      {!isUser && (
        <div
          className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold self-end mb-5"
          style={{
            background: `linear-gradient(135deg, ${agent.color}cc, ${agent.color}66)`,
            color: '#fff',
          }}
        >
          G
        </div>
      )}

      <div className={`flex flex-col gap-1 max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className="rounded-2xl px-4 py-3 text-sm leading-relaxed"
          style={
            isUser
              ? {
                  backgroundColor: 'var(--user-bubble)',
                  color: 'var(--text-primary)',
                  borderBottomRightRadius: '6px',
                  borderLeft: `3px solid ${agent.color}`,
                }
              : {
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  borderBottomLeftRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                }
          }
        >
          {message.imageUrl && (
            <div className="mb-2.5">
              <img
                src={message.imageUrl}
                alt="Uploaded"
                className="max-h-52 max-w-full rounded-xl object-cover"
              />
              {canSaveToWardrobe && (
                <button
                  type="button"
                  onClick={() => setSaveDialogOpen(true)}
                  disabled={savedToWardrobe}
                  aria-label={savedToWardrobe ? 'Saved to wardrobe' : 'Save to wardrobe'}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium disabled:opacity-60 active:scale-95 transition-all"
                  style={{
                    backgroundColor: savedToWardrobe ? 'var(--bg-surface-elevated)' : agent.color,
                    color: savedToWardrobe ? 'var(--text-secondary)' : '#fff',
                  }}
                >
                  {savedToWardrobe ? (
                    <>
                      <Check size={11} /> Saved
                    </>
                  ) : (
                    <>
                      <Shirt size={11} /> Save to wardrobe
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {message.text &&
            (isUser ? (
              <p className="whitespace-pre-wrap">{message.text}</p>
            ) : (
              <div className="prose-bot">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => (
                      <h1 className="text-base font-bold mt-3 mb-1.5" style={{ color: 'var(--text-primary)' }}>
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-sm font-bold mt-3 mb-1" style={{ color: 'var(--text-primary)' }}>
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-sm font-semibold mt-2 mb-1" style={{ color: 'var(--text-primary)' }}>
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className="mb-2 last:mb-0 leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        {children}
                      </p>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {children}
                      </strong>
                    ),
                    em: ({ children }) => <em className="italic">{children}</em>,
                    ul: ({ children }) => <ul className="list-disc list-outside pl-5 mb-2 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-outside pl-5 mb-2 space-y-1">{children}</ol>,
                    li: ({ children }) => (
                      <li className="leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        {children}
                      </li>
                    ),
                    hr: () => <hr className="my-2 border-0 h-px" style={{ backgroundColor: 'var(--border-subtle)' }} />,
                    code: ({ children }) => (
                      <code
                        className="px-1.5 py-0.5 rounded text-xs font-mono"
                        style={{ backgroundColor: 'var(--bg-surface-elevated)', color: agent.color }}
                      >
                        {children}
                      </code>
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:opacity-75 transition-opacity"
                        style={{ color: agent.color }}
                      >
                        {children}
                      </a>
                    ),
                  }}
                >
                  {message.text}
                </ReactMarkdown>
              </div>
            ))}

          {message.richCard && (
            <div className="mt-3 space-y-2">
              <SourceBadge
                provenance={resolveCardProvenance(message.richCard.type, message.richCard.data)}
                agentColor={agent.color}
              />
              {message.richCard.type === 'place' && <PlaceCard data={message.richCard.data} agentColor={agent.color} />}
              {message.richCard.type === 'placesList' && <PlacesListCard data={message.richCard.data} agentColor={agent.color} />}
              {message.richCard.type === 'colorSeason' && <ColorSeasonCard data={message.richCard.data} agentColor={agent.color} />}
              {message.richCard.type === 'fitnessClass' && <FitnessClassCard data={message.richCard.data} agentColor={agent.color} />}
              {message.richCard.type === 'flight' && <FlightCard data={message.richCard.data} agentColor={agent.color} />}
              {message.richCard.type === 'flightList' && <FlightListCard data={message.richCard.data} agentColor={agent.color} />}
              {message.richCard.type === 'hotelList' && <HotelListCard data={message.richCard.data} agentColor={agent.color} />}
              {message.richCard.type === 'classList' && <ClassListCard data={message.richCard.data} agentColor={agent.color} />}
              {message.richCard.type === 'outfit' && <OutfitRatingCard data={message.richCard.data} agentColor={agent.color} />}
              {message.richCard.type === 'reminder' &&
                (() => {
                  const r = message.richCard.data as {
                    id?: string;
                    title?: string;
                    notes?: string | null;
                    due_at?: string;
                    time?: string;
                    action?: string;
                  };
                  const when = r.due_at
                    ? new Date(r.due_at).toLocaleString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : r.time ?? '';
                  const what = r.title ?? r.action ?? 'Reminder';
                  return (
                    <div className="flex items-start gap-2.5 p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-surface-elevated)' }}>
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: 'var(--success)' }}
                      >
                        <Check size={12} style={{ color: '#fff' }} />
                      </div>
                      <div>
                        <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                          {what}
                        </div>
                        {when && <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{when}</div>}
                        {r.notes && <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{r.notes}</div>}
                      </div>
                    </div>
                  );
                })()}
            </div>
          )}
        </div>

        <div className={`flex items-center gap-1 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {timeStr}
          </span>
          {isUser && <CheckCheck size={12} style={{ color: 'var(--text-muted)' }} />}
        </div>
      </div>

      {saveDialogOpen && message.imageUrl && (
        <ReviewWardrobeDialog
          imageUrl={message.imageUrl}
          clientId={message.id}
          onClose={() => setSaveDialogOpen(false)}
          onSaved={() => markSaved(message.id)}
        />
      )}
    </div>
  );
}

