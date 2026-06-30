import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarRange,
  Users,
  Download,
  LogOut,
  ChevronLeft,
  ChevronRight,
  MapPin,
  ClipboardList,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/authStore';
import { signOut } from '@/lib/auth';

interface NavSection {
  labelKey: string;
  items: NavItem[];
  roles: Array<'super_admin' | 'coc_admin' | 'team_lead' | 'volunteer'>;
}

interface NavItem {
  labelKey: string;
  to: string;
  icon: typeof LayoutDashboard;
}

const sections: NavSection[] = [
  {
    labelKey: 'nav.sectionAdmin',
    roles: ['super_admin', 'coc_admin'],
    items: [
      { labelKey: 'nav.dashboard', to: '/dashboard', icon: LayoutDashboard },
      { labelKey: 'nav.events', to: '/events', icon: CalendarRange },
      { labelKey: 'nav.analysis', to: '/analysis', icon: Sparkles },
      { labelKey: 'nav.users', to: '/users', icon: Users },
      { labelKey: 'nav.exports', to: '/exports', icon: Download },
    ],
  },
  {
    labelKey: 'nav.sectionField',
    roles: ['team_lead', 'volunteer'],
    items: [
      { labelKey: 'nav.myCount', to: '/count', icon: MapPin },
      { labelKey: 'nav.submissions', to: '/count/submissions', icon: ClipboardList },
    ],
  },
];

interface SidebarProps {
  /** Mobile drawer open state (ignored on lg+, where the sidebar is always shown). */
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const user = useAuthStore((s) => s.user);

  const initials = (user?.fullName ?? 'WP')
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleLogout = () => {
    void signOut();
    navigate('/login', { replace: true });
  };

  return (
    <>
      {/* Mobile backdrop — tap to dismiss the drawer. */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar-bg text-gray-200',
          'transition-transform duration-200 lg:transition-[width]',
          // Mobile: full-width drawer that slides in/out. Desktop: always visible,
          // honoring the collapse toggle.
          'w-64',
          collapsed ? 'lg:w-16' : 'lg:w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
        )}
      >
      <div
        className={cn(
          'flex items-center px-4',
          collapsed ? 'justify-center' : 'gap-2',
        )}
        style={{
          height: 'calc(3.5rem + env(safe-area-inset-top))',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <Logo size={20} />
        {!collapsed && (
          <span className="text-white font-bold tracking-tight whitespace-nowrap">
            Waypoint PIT
          </span>
        )}
      </div>

      {/* Floating collapse handle, anchored to the sidebar's right edge — matches HMIS */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="absolute top-16 -right-3 z-10 hidden lg:inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-text-muted shadow-sm hover:text-text-primary hover:border-gray-300"
        aria-label="Toggle sidebar"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <nav className="flex-1 overflow-y-auto wp-sidebar-scroll px-2 pt-2 pb-3">
        {sections.map((section) => {
          const visible = !user || section.roles.includes(user.role);
          if (!visible) return null;
          return (
            <div key={section.labelKey}>
              {!collapsed && <div className="wp-section-label">{t(section.labelKey)}</div>}
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/dashboard'}
                  onClick={() => onClose?.()}
                  className={({ isActive }) =>
                    cn('wp-nav-item my-0.5', isActive && 'wp-nav-item--active', collapsed && 'justify-center')
                  }
                  title={collapsed ? t(item.labelKey) : undefined}
                >
                  <item.icon size={18} className="shrink-0" />
                  {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      <div className="p-3">
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <div className="h-9 w-9 rounded-full bg-primary text-white text-sm font-semibold inline-flex items-center justify-center shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white truncate">{user?.fullName ?? 'Signed out'}</p>
              <p className="text-xs text-gray-400 truncate capitalize">
                {user?.role?.replace('_', ' ') ?? '—'}
              </p>
            </div>
          )}
          {!collapsed && (
            <button
              type="button"
              onClick={handleLogout}
              className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-800"
              aria-label={t('nav.logout')}
              title={t('nav.logout')}
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
      </aside>
    </>
  );
}
