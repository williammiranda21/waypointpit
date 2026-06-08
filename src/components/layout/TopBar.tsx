import { Bell, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useOfflineQueueStore } from '@/stores/offlineQueueStore';
import { cn } from '@/lib/cn';

interface TopBarProps {
  hasNotifications?: boolean;
}

export function TopBar({ hasNotifications = false }: TopBarProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const connectivity = useOfflineQueueStore((s) => s.connectivity);
  const pendingCount = useOfflineQueueStore((s) => s.pendingCount);

  const initials = (user?.fullName ?? 'WP')
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // PIT-specific connectivity indicator. Only renders when not steady-state online,
  // so the bar stays as clean as HMIS in normal use.
  const showConnectivity = connectivity !== 'online' || pendingCount > 0;
  const dotColor =
    connectivity === 'offline'
      ? 'bg-orange-500'
      : connectivity === 'syncing'
        ? 'bg-yellow-400 animate-pulse'
        : connectivity === 'synced'
          ? 'bg-primary'
          : 'bg-primary';
  const dotLabel =
    connectivity === 'offline'
      ? t('status.offline')
      : connectivity === 'syncing'
        ? t('status.syncing')
        : connectivity === 'synced'
          ? t('status.synced')
          : t('status.online');

  return (
    <header className="sticky top-0 z-20 h-14 bg-white border-b border-gray-100 flex items-center px-4 gap-4">
      <div className="flex-1 max-w-2xl relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
        />
        <input
          type="search"
          placeholder="Search… (Ctrl+K)"
          className="block w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 h-9 text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {showConnectivity && (
          <div className="hidden sm:flex items-center gap-2 text-xs text-text-muted">
            <span className={cn('inline-block h-2 w-2 rounded-full', dotColor)} aria-hidden />
            <span>{dotLabel}</span>
            {pendingCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-orange-100 text-orange-800 text-[10px] font-semibold px-1.5 min-w-[18px] h-[18px]">
                {pendingCount}
              </span>
            )}
          </div>
        )}

        <button
          type="button"
          className="relative p-2 rounded-md text-text-muted hover:bg-gray-100"
          aria-label="Notifications"
        >
          <Bell size={18} />
          {hasNotifications && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-status-alert" />
          )}
        </button>

        <div className="h-8 w-8 rounded-full bg-primary text-white text-xs font-semibold inline-flex items-center justify-center">
          {initials}
        </div>
      </div>
    </header>
  );
}
