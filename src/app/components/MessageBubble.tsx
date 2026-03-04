import { Message, agents } from '../types';
import { Check, CheckCheck, Star } from 'lucide-react';
import { PlaceCard } from './cards/PlaceCard';
import { ColorSeasonCard } from './cards/ColorSeasonCard';
import { FitnessClassCard } from './cards/FitnessClassCard';
import { FlightCard } from './cards/FlightCard';
import ReactMarkdown from 'react-markdown';

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
    <div
      className="p-4 rounded-xl space-y-3"
      style={{ backgroundColor: 'var(--bg-surface)' }}
    >
      {/* Score */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold" style={{ color: agentColor }}>
          Outfit Rating
        </h3>
        <div className="flex items-center gap-1">
          <Star size={18} fill={agentColor} style={{ color: agentColor }} />
          <span className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {data.score}/10
          </span>
        </div>
      </div>

      {/* Vibe */}
      <div
        className="px-3 py-1 rounded-full text-sm inline-block"
        style={{ backgroundColor: agentColor + '20', color: agentColor }}
      >
        {data.overallVibe}
      </div>

      {/* Strengths */}
      {data.strengths?.length > 0 && (
        <div>
          <div className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
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

      {/* Improvements */}
      {data.improvements?.length > 0 && (
        <div>
          <div className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
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

      {/* Accessory suggestions */}
      {data.accessorySuggestions?.length > 0 && (
        <div>
          <div className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
            Accessory ideas
          </div>
          <div className="flex flex-wrap gap-2">
            {data.accessorySuggestions.map((s, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-full text-xs border"
                style={{ borderColor: agentColor, color: agentColor }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Color harmony */}
      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        Color harmony:{' '}
        <span style={{ color: 'var(--text-primary)' }}>{data.colorHarmony}</span>
      </div>
    </div>
  );
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const agent = agents[message.agentId];
  const isUser = message.type === 'user';

  const timeStr = message.timestamp.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Don't render empty bot messages (streaming placeholder before first token)
  if (!isUser && !message.text && !message.richCard) {
    return null;
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] sm:max-w-[70%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}
      >
        {/* Agent badge for bot messages */}
        {!isUser && (
          <div
            className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{
              backgroundColor: agent.color + '20',
              color: agent.color,
            }}
          >
            {agent.name}
          </div>
        )}

        {/* Message bubble */}
        <div
          className="px-4 py-2.5 rounded-2xl"
          style={{
            backgroundColor: isUser ? 'var(--user-bubble)' : 'var(--bot-bubble)',
            color: 'var(--text-primary)',
            borderBottomRightRadius: isUser ? '4px' : undefined,
            borderBottomLeftRadius: !isUser ? '4px' : undefined,
          }}
        >
          {/* Image thumbnail for user messages */}
          {message.imageUrl && (
            <div className="mb-2">
              <img
                src={message.imageUrl}
                alt="Uploaded"
                className="max-h-48 max-w-full rounded-lg object-cover"
              />
            </div>
          )}

          {message.text && (
            isUser ? (
              <p className="whitespace-pre-wrap">{message.text}</p>
            ) : (
              <div className="prose-bot">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => (
                      <h1 className="text-lg font-bold mt-3 mb-1.5" style={{ color: 'var(--text-primary)' }}>{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-base font-bold mt-3 mb-1.5" style={{ color: 'var(--text-primary)' }}>{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-sm font-bold mt-2 mb-1" style={{ color: 'var(--text-primary)' }}>{children}</h3>
                    ),
                    p: ({ children }) => (
                      <p className="mb-2 last:mb-0 leading-relaxed" style={{ color: 'var(--text-primary)' }}>{children}</p>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold" style={{ color: 'var(--text-primary)' }}>{children}</strong>
                    ),
                    em: ({ children }) => (
                      <em className="italic">{children}</em>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>
                    ),
                    li: ({ children }) => (
                      <li className="leading-relaxed" style={{ color: 'var(--text-primary)' }}>{children}</li>
                    ),
                    hr: () => (
                      <hr className="my-2 border-0 h-px" style={{ backgroundColor: 'var(--bg-surface-elevated)' }} />
                    ),
                    code: ({ children }) => (
                      <code className="px-1.5 py-0.5 rounded text-sm" style={{ backgroundColor: 'var(--bg-surface-elevated)', color: agent.color }}>{children}</code>
                    ),
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="underline transition-opacity duration-150 hover:opacity-75" style={{ color: agent.color }}>{children}</a>
                    ),
                  }}
                >
                  {message.text}
                </ReactMarkdown>
              </div>
            )
          )}

          {/* Rich card */}
          {message.richCard && (
            <div className="mt-3">
              {message.richCard.type === 'place' && (
                <PlaceCard data={message.richCard.data} agentColor={agent.color} />
              )}
              {message.richCard.type === 'colorSeason' && (
                <ColorSeasonCard data={message.richCard.data} agentColor={agent.color} />
              )}
              {message.richCard.type === 'fitnessClass' && (
                <FitnessClassCard data={message.richCard.data} agentColor={agent.color} />
              )}
              {message.richCard.type === 'flight' && (
                <FlightCard data={message.richCard.data} agentColor={agent.color} />
              )}
              {message.richCard.type === 'outfit' && (
                <OutfitRatingCard
                  data={message.richCard.data}
                  agentColor={agent.color}
                />
              )}
              {message.richCard.type === 'reminder' && (
                <div
                  className="flex items-start gap-2 p-3 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-surface)' }}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'var(--success)' }}
                  >
                    <Check size={14} style={{ color: 'var(--bg-primary)' }} />
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-primary)' }}>
                      Reminder set for{' '}
                      <span className="font-semibold">{message.richCard.data.time}</span>
                    </div>
                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {message.richCard.data.action}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Timestamp and status */}
        <div
          className={`flex items-center gap-1 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
        >
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {timeStr}
          </span>
          {isUser && <CheckCheck size={14} style={{ color: 'var(--text-secondary)' }} />}
        </div>
      </div>
    </div>
  );
}
