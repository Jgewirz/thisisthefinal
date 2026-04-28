import { X, LogOut, Palette } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { useStyleStore } from '../../stores/style';
import { useNavigate } from 'react-router';

interface ProfileDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ProfileDialog({ open, onClose }: ProfileDialogProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const profile = useStyleStore((s) => s.profile);
  const navigate = useNavigate();

  if (!open) return null;

  const handleLogout = () => {
    logout();
    onClose();
    navigate('/login', { replace: true });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 cursor-pointer" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl mx-4" style={{ backgroundColor: 'var(--bg-surface)' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Profile
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-all duration-150 hover:brightness-125 active:scale-90"
            style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
          >
            <X size={18} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {user && (
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold"
                style={{ backgroundColor: 'var(--accent-global)', color: 'var(--bg-primary)' }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
                  {user.name}
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {user.email}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <Palette size={16} />
            Style Profile
          </h3>

          {profile.onboardingComplete ? (
            <div className="p-3 rounded-lg space-y-2" style={{ backgroundColor: 'var(--bg-primary)' }}>
              {profile.skinTone && (
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Color Season
                  </span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {profile.skinTone.season}
                  </span>
                </div>
              )}
              {profile.bodyType && (
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Body Type
                  </span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {profile.bodyType}
                  </span>
                </div>
              )}
              {profile.budgetRange && (
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Budget
                  </span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {profile.budgetRange}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Wardrobe Items
                </span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {profile.wardrobeItems.length}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
              Not set up yet — chat with the Style agent to build your profile!
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full p-3 rounded-lg transition-all duration-150 hover:opacity-80 active:scale-[0.98]"
          style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}
        >
          <LogOut size={18} style={{ color: 'var(--error)' }} />
          <span style={{ color: 'var(--error)' }}>Log Out</span>
        </button>
      </div>
    </div>
  );
}

