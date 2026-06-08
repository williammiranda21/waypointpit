import { useEffect, useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { MapView, type MapPolygon } from '@/components/map/MapView';
import type { MapMarker } from '@/components/map/markers';
import { VolunteerShell } from '@/components/layout/VolunteerShell';
import { GeofenceBanner } from '@/components/volunteer/GeofenceBanner';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { useActiveSession } from '@/hooks/useActiveSession';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { useHotspotsForEvent } from '@/hooks/useHotspots';
import { useSubmissionsForTeam } from '@/hooks/useSubmissions';
import { useAuthStore } from '@/stores/authStore';

export function CountHomePage() {
  const { eventId } = useParams<{ eventId?: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: session, isLoading } = useActiveSession();
  const userId = useAuthStore((s) => s.user?.id);
  useHeartbeat(session?.team.id, userId);

  // Redirect /count → /count/:eventId once we know the session.
  useEffect(() => {
    if (!eventId && session?.event.id) {
      navigate(`/count/${session.event.id}`, { replace: true });
    }
  }, [eventId, session?.event.id, navigate]);

  // If a specific eventId was provided but it doesn't match the user's active
  // session, bounce back to /count to resolve again.
  if (eventId && session && session.event.id !== eventId) {
    return <Navigate to="/count" replace />;
  }

  return (
    <VolunteerShell teamName={session?.team.name} zoneName={session?.zone.name}>
      {isLoading && (
        <p className="px-4 py-6 text-sm text-text-muted">Loading…</p>
      )}

      {!isLoading && !session && (
        <div className="px-4 py-8">
          <Card>
            <CardBody>
              <h2 className="text-base font-semibold text-text-primary">
                {t('volunteer.noActiveSession')}
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                {t('volunteer.noActiveSessionDescription')}
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      {session && <CountHomeContent session={session} />}
    </VolunteerShell>
  );
}

function CountHomeContent({ session }: { session: NonNullable<ReturnType<typeof useActiveSession>['data']> }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { event, team, zone } = session;

  const { data: hotspots = [] } = useHotspotsForEvent(event.id);
  const { data: submissions = [] } = useSubmissionsForTeam(team.id);

  // Hotspots: only those assigned to the volunteer's zone (or unassigned).
  const visibleHotspots = useMemo(
    () => hotspots.filter((h) => !h.zone_id || h.zone_id === zone.id),
    [hotspots, zone.id],
  );

  const polygons: MapPolygon[] = useMemo(
    () => [{ id: zone.id, name: zone.name, geometry: zone.geometry, color: zone.color }],
    [zone],
  );

  const markers: MapMarker[] = useMemo(
    () => [
      ...visibleHotspots.map((h) => ({
        id: `hotspot-${h.id}`,
        lng: h.gps_lng,
        lat: h.gps_lat,
        hotspot_type: h.hotspot_type,
        severity: h.severity,
        expected_count: h.expected_count,
        resolved: h.resolved,
        label: h.name,
      })),
      // Render own submissions as green (resource-colored) dots, low severity,
      // resolved=true so they appear muted compared to active hotspots.
      ...submissions.map((s) => ({
        id: `sub-${s.id}`,
        lng: s.gps_lng,
        lat: s.gps_lat,
        hotspot_type: 'resource' as const,
        severity: 'low' as const,
        resolved: true,
        label: `${s.person_count} · ${s.location_type}`,
      })),
    ],
    [visibleHotspots, submissions],
  );

  return (
    <>
      <GeofenceBanner zone={zone} />
      {/* min-h-0 lets the map shrink to fill only the space between the bar and
          the button (no fixed 60vh floor that overflowed the screen). */}
      <div className="relative flex-1 min-h-0">
        <MapView polygons={polygons} markers={markers} className="absolute inset-0" />
      </div>

      <div className="shrink-0 bg-white border-t border-wp-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button
          fullWidth
          size="lg"
          onClick={() => navigate(`/count/${event.id}/submit`)}
          className="h-14 text-base"
        >
          <Plus size={20} />
          {t('actions.addObservation')}
        </Button>
      </div>
    </>
  );
}
