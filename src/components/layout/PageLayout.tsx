import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface PageLayoutProps {
  children: ReactNode;
}

export function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-page-bg">
      <Sidebar />
      <div className="ml-64 transition-[margin] duration-200">
        <TopBar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
