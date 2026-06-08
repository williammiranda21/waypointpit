import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, type Role } from '@/stores/authStore';
import { Logo } from '@/components/ui/Logo';

interface RequireAuthProps {
  children: ReactNode;
  allow?: Role[];
}

export function RequireAuth({ children, allow }: RequireAuthProps) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);

  if (status === 'loading') {
    return <AuthSplash />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allow && !allow.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function RedirectHome() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);

  if (status === 'loading') return <AuthSplash />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'volunteer' || user.role === 'team_lead') {
    return <Navigate to="/count" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

/** Centered Waypoint mark while session is restoring on boot. */
function AuthSplash() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-page-bg">
      <Logo variant="circle" size={18} />
      <span className="text-xs text-text-muted">Loading…</span>
    </div>
  );
}
