import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut, Menu, X } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { signOut } from '@/lib/auth';
import { useAuthStore } from '@/stores/authStore';
import { useOfflineQueueStore } from '@/stores/offlineQueueStore';
import { cn } from '@/lib/cn';
import type { SupportedLanguage } from '@/i18n';

interface VolunteerTopBarProps {
  teamName?: string;
  zoneName?: string;
}

export function VolunteerTopBar({ teamName, zoneName }: VolunteerTopBarProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const connectivity = useOfflineQueueStore((s) => s.connectivity);
  const pendingCount = useOfflineQueueStore((s) => s.pendingCount);

  const dotColor =
    connectivity === 'offline'
      ? 'bg-orange-500'
      : connectivity === 'syncing'
        ? 'bg-yellow-400 animate-pulse'
        : 'bg-primary';

  const toggleLang = () => {
    const next: SupportedLanguage = i18n.language?.startsWith('es') ? 'en' : 'es';
    void i18n.changeLanguage(next);
  };

  const handleLogout = () => {
    // signOut() clears local state synchronously before its network call, so we
    // navigate right away — no waiting on (or hanging behind) the server revoke.
    void signOut();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-wp-border flex items-center px-3 gap-2">
      <Logo size={22} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary truncate">
          <span>Waypoint PIT</span>
        </div>
        {(teamName || zoneName) && (
          <p className="text-[11px] text-text-muted truncate">
            {teamName ?? '—'}{zoneName ? ` · ${zoneName}` : ''}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <span
          className={cn('inline-block h-2 w-2 rounded-full', dotColor)}
          aria-label={connectivity}
        />
        {pendingCount > 0 && (
          <span className="inline-flex items-center justify-center rounded-full bg-orange-100 text-orange-800 text-[10px] font-semibold px-1.5 min-w-[18px] h-[18px]">
            {pendingCount}
          </span>
        )}

        <button
          type="button"
          onClick={toggleLang}
          className="text-[11px] font-semibold text-text-muted hover:text-text-primary px-1.5 py-1 rounded-md"
        >
          {i18n.language?.startsWith('es') ? 'EN' : 'ES'}
        </button>

        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="p-2 rounded-md text-text-muted hover:bg-gray-100"
          aria-label={t('volunteer.menu')}
        >
          <Menu size={18} />
        </button>
      </div>

      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          role="dialog"
          aria-modal="true"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="absolute right-0 top-0 h-full w-72 max-w-[80vw] bg-white shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-wp-border px-4 h-14">
              <span className="text-sm font-semibold text-text-primary">{t('volunteer.menu')}</span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="p-1 rounded-md text-text-muted hover:bg-gray-100"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {user && (
                <div>
                  <p className="text-sm font-medium text-text-primary truncate">{user.fullName}</p>
                  <p className="text-xs text-text-muted truncate">{user.email}</p>
                  <p className="text-xs text-text-muted mt-0.5 capitalize">
                    {user.role.replace('_', ' ')}
                  </p>
                </div>
              )}
              {teamName && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-text-muted">
                    {t('volunteer.team')}
                  </p>
                  <p className="text-sm text-text-primary">{teamName}</p>
                </div>
              )}
              {zoneName && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-text-muted">
                    {t('volunteer.zone')}
                  </p>
                  <p className="text-sm text-text-primary">{zoneName}</p>
                </div>
              )}
            </div>
            <div className="border-t border-wp-border p-3">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 h-10 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <LogOut size={14} />
                {t('nav.logout')}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
