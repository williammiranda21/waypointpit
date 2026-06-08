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
    // h-[100dvh] = the *visible* viewport on mobile (excludes the browser toolbar
    // area that 100vh wrongly includes on iOS), so the top bar and bottom action
    // stay on-screen. The top bar is fixed-height; content scrolls inside <main>.
    <div className="flex h-[100dvh] flex-col bg-page-bg">
      <VolunteerTopBar teamName={teamName} zoneName={zoneName} />
      <main className="flex-1 min-h-0 flex flex-col overflow-y-auto">{children}</main>
    </div>
  );
}
