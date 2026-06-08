import { createBrowserRouter, Outlet } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { LoginPage } from '@/pages/LoginPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { EventsListPage } from '@/pages/EventsListPage';
import { EventCreatePage } from '@/pages/EventCreatePage';
import { EventDetailPage } from '@/pages/EventDetailPage';
import { ZonesPage } from '@/pages/ZonesPage';
import { ZoneEditorPage } from '@/pages/ZoneEditorPage';
import { HotspotsPage } from '@/pages/HotspotsPage';
import { TeamsPage } from '@/pages/TeamsPage';
import { TeamCreatePage } from '@/pages/TeamCreatePage';
import { CountHomePage } from '@/pages/CountHomePage';
import { SubmissionFormPage } from '@/pages/SubmissionFormPage';
import { CountSubmissionsPage } from '@/pages/CountSubmissionsPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { AnalysisPage } from '@/pages/AnalysisPage';
import { ExportHubPage } from '@/pages/ExportHubPage';
import { ExecutiveReportPage } from '@/pages/ExecutiveReportPage';
import { RedirectHome, RequireAuth } from './guards';

function ProtectedShell() {
  return (
    <RequireAuth>
      <PageLayout>
        <Outlet />
      </PageLayout>
    </RequireAuth>
  );
}

function AdminShell() {
  return (
    <RequireAuth allow={['coc_admin', 'super_admin']}>
      <PageLayout>
        <Outlet />
      </PageLayout>
    </RequireAuth>
  );
}

function VolunteerGuard() {
  // Volunteer pages provide their own mobile-first chrome (VolunteerShell);
  // this wrapper only enforces role-based auth.
  return (
    <RequireAuth allow={['team_lead', 'volunteer', 'coc_admin', 'super_admin']}>
      <Outlet />
    </RequireAuth>
  );
}

export const router = createBrowserRouter([
  { path: '/', element: <RedirectHome /> },
  { path: '/login', element: <LoginPage /> },
  {
    element: <AdminShell />,
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/analysis', element: <AnalysisPage /> },
      { path: '/export/:eventId/report', element: <ExecutiveReportPage /> },
    ],
  },
  {
    element: <ProtectedShell />,
    children: [
      { path: '/events', element: <EventsListPage /> },
      { path: '/events/new', element: <EventCreatePage /> },
      { path: '/events/:id', element: <EventDetailPage /> },
      { path: '/events/:id/zones', element: <ZonesPage /> },
      { path: '/events/:id/zones/new', element: <ZoneEditorPage /> },
      { path: '/events/:id/hotspots', element: <HotspotsPage /> },
      { path: '/events/:id/teams', element: <TeamsPage /> },
      { path: '/events/:id/teams/new', element: <TeamCreatePage /> },
      {
        path: '/users',
        element: (
          <PlaceholderPage
            title="User Management"
            phase="Phase 3"
            description="Manage CoC users — admins, leads, and volunteers."
          />
        ),
      },
      { path: '/exports', element: <ExportHubPage /> },
      { path: '/export/:eventId', element: <ExportHubPage /> },
      {
        path: '/profile',
        element: (
          <PlaceholderPage
            title="Profile"
            phase="Phase 3"
            description="User profile and language toggle."
          />
        ),
      },
    ],
  },
  {
    element: <VolunteerGuard />,
    children: [
      { path: '/count', element: <CountHomePage /> },
      { path: '/count/:eventId', element: <CountHomePage /> },
      { path: '/count/:eventId/submit', element: <SubmissionFormPage /> },
      { path: '/count/:eventId/submissions', element: <CountSubmissionsPage /> },
      { path: '/count/submissions', element: <CountSubmissionsPage /> },
    ],
  },
  { path: '*', element: <RedirectHome /> },
]);
