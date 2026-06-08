import type { ReactNode } from 'react';
import { VolunteerTopBar } from '@/components/volunteer/VolunteerTopBar';

interface VolunteerShellProps {
  children: ReactNode;
  teamName?: string;
  zoneName?: string;
}

/** Mobile-first chrome for the volunteer field app. No sidebar. */
export function VolunteerShell({ children, teamName, zoneName }: VolunteerShellProps) {
  return (
    <div className="min-h-screen bg-page-bg flex flex-col">
      <VolunteerTopBar teamName={teamName} zoneName={zoneName} />
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
