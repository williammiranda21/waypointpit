import { AlertTriangle } from 'lucide-react';
import { formatLastSeen } from '@/lib/teamStatus';

export interface AlertTeam {
  teamId: string;
  teamName: string;
  zoneName: string;
  lastSeenAt: string | null;
}

interface SilenceBannerProps {
  alerts: AlertTeam[];
}

/**
 * Persistent red notification banner shown when one or more active teams have
 * not checked in for >45 minutes. Per the build spec.
 */
export function SilenceBanner({ alerts }: SilenceBannerProps) {
  if (alerts.length === 0) return null;
  const first = alerts[0];
  const more = alerts.length - 1;

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm"
    >
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {alerts.length === 1
            ? 'Team silence alert'
            : `${alerts.length} teams silent for over 45 minutes`}
        </p>
        <p className="mt-0.5 text-red-700">
          <span className="font-medium">{first.teamName}</span>{' '}
          <span className="text-red-600">({first.zoneName})</span> — last seen{' '}
          {formatLastSeen(first.lastSeenAt)}
          {more > 0 && <span className="text-red-600"> and {more} other{more > 1 ? 's' : ''}.</span>}
        </p>
      </div>
    </div>
  );
}
