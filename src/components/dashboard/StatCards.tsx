import type { ReactNode } from 'react';
import { Users, FileText, Map as MapIcon, Activity } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

export interface DashboardStats {
  totalPersons: number;
  submissions: number;
  zonesComplete: number;
  zonesTotal: number;
  teamsActive: number;
  teamsTotal: number;
}

interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: ReactNode;
  tone?: 'primary' | 'blue' | 'amber' | 'red';
}

const toneClasses: Record<NonNullable<StatCardProps['tone']>, { iconBg: string; iconText: string }> = {
  primary: { iconBg: 'bg-primary-light', iconText: 'text-primary' },
  blue: { iconBg: 'bg-blue-100', iconText: 'text-blue-600' },
  amber: { iconBg: 'bg-amber-100', iconText: 'text-amber-600' },
  red: { iconBg: 'bg-red-100', iconText: 'text-red-600' },
};

function StatCard({ label, value, sub, icon, tone = 'primary' }: StatCardProps) {
  const t = toneClasses[tone];
  return (
    <Card className="px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold text-text-primary leading-none">{value}</p>
          {sub && <p className="mt-1 text-xs text-text-muted">{sub}</p>}
        </div>
        <span
          className={cn(
            'inline-flex items-center justify-center h-10 w-10 rounded-lg shrink-0',
            t.iconBg,
            t.iconText,
          )}
        >
          {icon}
        </span>
      </div>
    </Card>
  );
}

export function StatCards({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <StatCard
        label="Total Persons"
        value={stats.totalPersons}
        icon={<Users size={20} />}
        tone="primary"
      />
      <StatCard
        label="Submissions"
        value={stats.submissions}
        icon={<FileText size={20} />}
        tone="blue"
      />
      <StatCard
        label="Zones Complete"
        value={
          <span>
            {stats.zonesComplete}
            <span className="text-base text-text-muted font-medium"> / {stats.zonesTotal}</span>
          </span>
        }
        sub={`${stats.zonesTotal - stats.zonesComplete} remaining`}
        icon={<MapIcon size={20} />}
        tone="amber"
      />
      <StatCard
        label="Teams Active"
        value={
          <span>
            {stats.teamsActive}
            <span className="text-base text-text-muted font-medium"> / {stats.teamsTotal}</span>
          </span>
        }
        icon={<Activity size={20} />}
        tone="primary"
      />
    </div>
  );
}
