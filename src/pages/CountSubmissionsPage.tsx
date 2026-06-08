import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, AlertTriangle, CloudOff, Loader2, RefreshCw } from 'lucide-react';
import { VolunteerShell } from '@/components/layout/VolunteerShell';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useActiveSession } from '@/hooks/useActiveSession';
import { useSubmissionsForTeam } from '@/hooks/useSubmissions';

export function CountSubmissionsPage() {
  const { data: session, isLoading } = useActiveSession();

  if (isLoading) {
    return (
      <VolunteerShell>
        <p className="px-4 py-6 text-sm text-text-muted">Loading…</p>
      </VolunteerShell>
    );
  }
  if (!session) return <Navigate to="/count" replace />;

  return (
    <VolunteerShell teamName={session.team.name} zoneName={session.zone.name}>
      <Content teamId={session.team.id} eventId={session.event.id} />
    </VolunteerShell>
  );
}

function Content({ teamId, eventId }: { teamId: string; eventId: string }) {
  const { t } = useTranslation();
  const { data: submissions = [], isLoading } = useSubmissionsForTeam(teamId);

  return (
    <div className="px-4 py-4 space-y-3">
      <Link
        to={`/count/${eventId}`}
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary"
      >
        <ArrowLeft size={14} />
        {t('actions.back')}
      </Link>
      <h1 className="text-xl font-bold text-text-primary">{t('nav.submissions')}</h1>

      {isLoading && <p className="text-sm text-text-muted">Loading…</p>}

      {!isLoading && submissions.length === 0 && (
        <Card>
          <EmptyState
            title="No submissions yet"
            description="Submissions you and your team capture tonight will appear here."
          />
        </Card>
      )}

      {submissions.map((s) => (
        <Card key={s.id}>
          <CardBody className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-primary-light text-primary inline-flex items-center justify-center font-bold">
              {s.person_count}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-text-primary">
                  {t(`locationTypes.${s.location_type}`)}
                </p>
                <Badge tone={s.submission_type === 'survey' ? 'pending' : 'neutral'}>
                  {s.submission_type === 'survey' ? t('submission.surveyTitle') : t('submission.quickTallyTitle')}
                </Badge>
                {s.queueStatus === 'pending' && (
                  <span className="inline-flex items-center gap-1 text-xs text-orange-700">
                    <CloudOff size={12} /> Saved offline
                  </span>
                )}
                {s.queueStatus === 'syncing' && (
                  <span className="inline-flex items-center gap-1 text-xs text-yellow-700">
                    <Loader2 size={12} className="animate-spin" /> Syncing
                  </span>
                )}
                {s.queueStatus === 'failed' && (
                  <span className="inline-flex items-center gap-1 text-xs text-status-alert">
                    <RefreshCw size={12} /> Sync failed
                  </span>
                )}
                {s.outside_zone && (
                  <span className="inline-flex items-center gap-1 text-xs text-status-alert">
                    <AlertTriangle size={12} /> {Math.round(s.distance_to_zone_meters ?? 0)} m out
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-text-muted">
                {new Date(s.device_submitted_at).toLocaleString()} ·{' '}
                <span className="font-mono">
                  {s.gps_lat.toFixed(5)}, {s.gps_lng.toFixed(5)}
                </span>
              </p>
              {s.notes && (
                <p className="mt-1 text-sm text-text-body line-clamp-2">{s.notes}</p>
              )}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
