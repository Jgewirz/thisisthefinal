import { X, Palette, User, ShoppingBag, Sparkles, DollarSign, Calendar, RotateCcw, Trash2 } from 'lucide-react';
import { useStyleStore } from '../../stores/style';

interface StyleProfilePanelProps {
  open: boolean;
  onClose: () => void;
}

export function StyleProfilePanel({ open, onClose }: StyleProfilePanelProps) {
  const { profile, removeWardrobeItem, resetProfile } = useStyleStore();

  if (!open) return null;

  const hasProfile = profile.skinTone || profile.bodyType || profile.styleEssences.length > 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-80 max-w-full overflow-y-auto border-l animate-slide-in"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--bg-surface-elevated)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--bg-surface-elevated)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            My Style Profile
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-opacity-50 transition-colors"
            style={{ backgroundColor: 'transparent' }}
          >
            <X size={20} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {!hasProfile ? (
            <div className="text-center py-8">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
              >
                <Sparkles size={24} style={{ color: 'var(--accent-style)' }} />
              </div>
              <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                No profile yet
              </p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Chat with the Style agent to build your profile — start with a selfie for color analysis!
              </p>
            </div>
          ) : (
            <>
              {/* Color Season */}
              {profile.skinTone && (
                <Section icon={Palette} title="Color Season">
                  <div
                    className="px-3 py-1.5 rounded-full text-sm font-medium inline-block mb-2"
                    style={{ backgroundColor: 'var(--accent-style)' + '20', color: 'var(--accent-style)' }}
                  >
                    {profile.skinTone.season}
                  </div>
                  <div className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                    {profile.skinTone.depth} skin, {profile.skinTone.undertone} undertone
                  </div>
                  <div className="flex gap-1.5 flex-wrap mt-2">
                    {profile.skinTone.bestColors.map((color, i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full border"
                        style={{ backgroundColor: color, borderColor: 'var(--bg-surface-elevated)' }}
                      />
                    ))}
                  </div>
                  <div className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                    Best metals: <span style={{ color: 'var(--text-primary)' }}>{profile.skinTone.bestMetals}</span>
                  </div>
                </Section>
              )}

              {/* Body Type */}
              {profile.bodyType && (
                <Section icon={User} title="Body Type">
                  <span className="text-sm capitalize" style={{ color: 'var(--text-primary)' }}>
                    {profile.bodyType}
                  </span>
                </Section>
              )}

              {/* Style Essences */}
              {profile.styleEssences.length > 0 && (
                <Section icon={Sparkles} title="Style Essences">
                  <div className="flex flex-wrap gap-1.5">
                    {profile.styleEssences.map((e, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-full text-xs border"
                        style={{ borderColor: 'var(--accent-style)', color: 'var(--accent-style)' }}
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Budget */}
              {profile.budgetRange && (
                <Section icon={DollarSign} title="Budget Range">
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    {profile.budgetRange}
                  </span>
                </Section>
              )}

              {/* Occasions */}
              {profile.occasions.length > 0 && (
                <Section icon={Calendar} title="Occasions">
                  <div className="flex flex-wrap gap-1.5">
                    {profile.occasions.map((o, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-full text-xs capitalize"
                        style={{ backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-primary)' }}
                      >
                        {o}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Wardrobe */}
              <Section icon={ShoppingBag} title="Wardrobe">
                {profile.wardrobeItems.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    No items yet — upload clothing photos to build your wardrobe
                  </p>
                ) : (
                  <>
                    <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                      {profile.wardrobeItems.length} item{profile.wardrobeItems.length !== 1 ? 's' : ''} tagged
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {profile.wardrobeItems.slice(0, 9).map((item) => (
                        <div key={item.id} className="relative group">
                          <img
                            src={item.thumbnailUrl || item.imageUrl}
                            alt={item.category}
                            className="w-full aspect-square object-cover rounded-lg"
                          />
                          <span
                            className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] capitalize"
                            style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                          >
                            {item.category}
                          </span>
                          <button
                            onClick={() => removeWardrobeItem(item.id)}
                            className="absolute top-1 right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ backgroundColor: 'var(--bg-primary)' }}
                            title="Remove item"
                          >
                            <Trash2 size={12} style={{ color: 'var(--error)' }} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {profile.wardrobeItems.length > 9 && (
                      <p className="text-xs mt-1 text-center" style={{ color: 'var(--text-secondary)' }}>
                        +{profile.wardrobeItems.length - 9} more
                      </p>
                    )}
                  </>
                )}
              </Section>

              {/* Reset */}
              <div className="pt-3 border-t" style={{ borderColor: 'var(--bg-surface-elevated)' }}>
                <button
                  onClick={() => { resetProfile(); onClose(); }}
                  className="flex items-center gap-2 text-sm w-full px-3 py-2 rounded-lg transition-colors hover:bg-opacity-10"
                  style={{ color: 'var(--error)', backgroundColor: 'transparent' }}
                >
                  <RotateCcw size={14} />
                  Reset Profile
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} style={{ color: 'var(--accent-style)' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}
