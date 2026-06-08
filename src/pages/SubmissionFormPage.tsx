import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Building2,
  Car,
  CheckCircle2,
  ClipboardList,
  DoorClosed,
  Loader2,
  MapPin,
  Minus,
  Mountain,
  Plus,
  Trees,
  Users as UsersIcon,
} from 'lucide-react';
import { VolunteerShell } from '@/components/layout/VolunteerShell';
import { GeofenceBanner } from '@/components/volunteer/GeofenceBanner';
import { LocationPicker } from '@/components/volunteer/LocationPicker';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { Textarea } from '@/components/ui/Textarea';
import { useActiveSession } from '@/hooks/useActiveSession';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useCreateSubmission } from '@/hooks/useSubmissions';
import { pointInPolygon } from '@/components/map/geo';
import { toast } from '@/stores/toastStore';
import type {
  AgeRange,
  Ethnicity,
  Gender,
  LocationType,
  Race,
  SubmissionType,
} from '@/lib/database.types';
import { cn } from '@/lib/cn';

const LOCATION_TYPES: { id: LocationType; icon: typeof Building2 }[] = [
  { id: 'street', icon: MapPin },
  { id: 'encampment', icon: Trees },
  { id: 'vehicle', icon: Car },
  { id: 'doorway', icon: DoorClosed },
  { id: 'park', icon: Trees },
  { id: 'underpass', icon: Mountain },
  { id: 'abandoned', icon: Building2 },
  { id: 'other', icon: MapPin },
];

const AGE_RANGES: AgeRange[] = ['under_18', '18_24', '25_34', '35_44', '45_54', '55_64', '65_plus'];
const GENDERS: Gender[] = ['male', 'female', 'non_binary', 'unknown'];
const RACES: Race[] = [
  'american_indian_alaska_native',
  'asian',
  'black_african_american',
  'native_hawaiian_pacific_islander',
  'white',
  'multi_racial',
  'unknown',
];
const ETHNICITIES: Ethnicity[] = ['hispanic', 'not_hispanic', 'unknown'];

export function SubmissionFormPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { data: session, isLoading } = useActiveSession();

  if (isLoading) {
    return (
      <VolunteerShell>
        <p className="px-4 py-6 text-sm text-text-muted">Loading…</p>
      </VolunteerShell>
    );
  }
  if (!session) return <Navigate to="/count" replace />;
  if (eventId && session.event.id !== eventId) return <Navigate to="/count" replace />;

  return (
    <VolunteerShell teamName={session.team.name} zoneName={session.zone.name}>
      <GeofenceBanner zone={session.zone} />
      <SubmissionForm session={session} onDone={() => navigate(`/count/${session.event.id}`)} />
    </VolunteerShell>
  );
}

interface SubmissionFormProps {
  session: NonNullable<ReturnType<typeof useActiveSession>['data']>;
  onDone: () => void;
}

function SubmissionForm({ session, onDone }: SubmissionFormProps) {
  const { t } = useTranslation();
  const { event, team, zone } = session;
  const createMutation = useCreateSubmission(team.id, event.id);
  const { position, error: gpsError } = useGeolocation({ watch: true, highAccuracy: true, throttleMs: 1500 });

  // Honor the event's submission mode: skip the chooser entirely when the
  // mode is fixed for this event.
  const initialType: SubmissionType | null =
    event.submission_mode === 'tally_only'
      ? 'tally'
      : event.submission_mode === 'survey_only'
        ? 'survey'
        : null;
  const initialStep: 1 | 2 = initialType ? 2 : 1;

  const [step, setStep] = useState<1 | 2>(initialStep);
  const [submissionType, setSubmissionType] = useState<SubmissionType | null>(initialType);
  const [personCount, setPersonCount] = useState(1);
  const [locationType, setLocationType] = useState<LocationType | null>(null);
  const [notes, setNotes] = useState('');
  const [ageRange, setAgeRange] = useState<AgeRange | ''>('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [race, setRace] = useState<Race | ''>('');
  const [ethnicity, setEthnicity] = useState<Ethnicity | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  // Location source: 'gps' (geolocation API) or 'manual' (tap-to-drop pin).
  const [locationMode, setLocationMode] = useState<'gps' | 'manual'>('gps');
  const [manualPosition, setManualPosition] = useState<{ lat: number; lng: number } | null>(null);

  // Effective coordinates used by handleSubmit.
  const effectivePosition =
    locationMode === 'manual'
      ? manualPosition
        ? { lat: manualPosition.lat, lng: manualPosition.lng, accuracy: null as number | null }
        : null
      : position
        ? { lat: position.lat, lng: position.lng, accuracy: position.accuracy as number | null }
        : null;

  // Move to step 2 as soon as a type is chosen.
  useEffect(() => {
    if (submissionType && step === 1) setStep(2);
  }, [submissionType, step]);

  const gpsReady = !!position;
  const locationReady = !!effectivePosition;
  const insideZone = useMemo(() => {
    if (!effectivePosition) return null;
    return pointInPolygon([effectivePosition.lng, effectivePosition.lat], zone.geometry);
  }, [effectivePosition, zone.geometry]);

  const handleSubmit = async (e?: FormEvent<HTMLFormElement>, skipConfirm = false) => {
    e?.preventDefault();
    setError(null);

    if (!submissionType) {
      setError('Choose a submission type.');
      return;
    }
    if (!locationType) {
      setError('Choose a location type.');
      return;
    }
    if (personCount < 1) {
      setError('Person count must be at least 1.');
      return;
    }
    if (!effectivePosition) {
      setError(
        locationMode === 'manual'
          ? t('submission.locationNotChosen')
          : t('submission.gps.waiting'),
      );
      return;
    }

    // Outside zone behavior:
    //   - Strict mode: refuse outright (the server would also reject)
    //   - Soft mode: warn once via confirm dialog, then save with outside_zone=true
    if (insideZone === false) {
      if (event.enforce_zone_boundary) {
        setError(t('submission.outsideZoneBlocked'));
        return;
      }
      if (!skipConfirm) {
        setConfirming(true);
        return;
      }
    }

    try {
      const result = await createMutation.mutateAsync({
        count_event_id: event.id,
        team_id: team.id,
        zone_id: zone.id,
        submission_type: submissionType,
        person_count: personCount,
        location_type: locationType,
        gps_lat: effectivePosition.lat,
        gps_lng: effectivePosition.lng,
        gps_accuracy_meters: effectivePosition.accuracy,
        notes: notes.trim() || null,
        estimated_age_range: ageRange || null,
        observed_gender: gender || null,
        observed_race: race || null,
        observed_ethnicity: ethnicity || null,
        zone_geometry: zone.geometry,
        zone_buffer_meters: event.zone_buffer_meters,
      });

      toast({
        tone: result.queuedOffline ? 'warning' : 'success',
        message: result.queuedOffline
          ? t('submission.savedOffline')
          : result.submission.outside_zone
            ? t('submission.savedOutsideZone')
            : t('submission.saved'),
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save submission.');
    }
  };

  return (
    <>
      <div className="px-4 pt-3 pb-2">
        <Link
          to={`/count/${event.id}`}
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary"
        >
          <ArrowLeft size={14} />
          {t('actions.cancel')}
        </Link>
      </div>

      {step === 1 && (
        <div className="px-4 pb-6">
          <h1 className="text-xl font-bold text-text-primary mb-4">{t('submission.chooseType')}</h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TypeCard
              icon={<UsersIcon size={28} className="text-primary" />}
              title={t('submission.quickTallyTitle')}
              description={t('submission.quickTallyDescription')}
              onClick={() => setSubmissionType('tally')}
            />
            <TypeCard
              icon={<ClipboardList size={28} className="text-primary" />}
              title={t('submission.surveyTitle')}
              description={t('submission.surveyDescription')}
              onClick={() => setSubmissionType('survey')}
            />
          </div>
        </div>
      )}

      {step === 2 && submissionType && (
        <form onSubmit={handleSubmit} className="px-4 pb-6 space-y-5">
          {/* Person count */}
          <div>
            <label className="block text-sm font-medium text-text-body mb-2">
              {t('submission.personCount')}
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPersonCount((c) => Math.max(1, c - 1))}
                className="h-14 w-14 rounded-xl bg-primary text-white inline-flex items-center justify-center disabled:opacity-50"
                disabled={personCount <= 1}
                aria-label="Decrement"
              >
                <Minus size={24} />
              </button>
              <span className="flex-1 text-center text-4xl font-bold text-text-primary tabular-nums">
                {personCount}
              </span>
              <button
                type="button"
                onClick={() => setPersonCount((c) => c + 1)}
                className="h-14 w-14 rounded-xl bg-primary text-white inline-flex items-center justify-center"
                aria-label="Increment"
              >
                <Plus size={24} />
              </button>
            </div>
          </div>

          {/* Location type grid */}
          <div>
            <label className="block text-sm font-medium text-text-body mb-2">
              {t('submission.locationType')}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {LOCATION_TYPES.map(({ id, icon: Icon }) => {
                const active = locationType === id;
                return (
                  <button
                    type="button"
                    key={id}
                    onClick={() => setLocationType(id)}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1 p-3 rounded-xl border transition-colors min-h-[80px]',
                      active
                        ? 'border-primary bg-primary-light/50 text-primary'
                        : 'border-wp-border bg-white text-text-body hover:border-gray-300',
                    )}
                  >
                    <Icon size={22} />
                    <span className="text-[11px] font-medium text-center leading-tight">
                      {t(`locationTypes.${id}`)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Location source — GPS auto-detect, or tap-to-drop pin */}
          <div>
            <label className="block text-sm font-medium text-text-body mb-2">
              {t('submission.location')}
            </label>
            <Tabs
              activeId={locationMode}
              onChange={(id) => setLocationMode(id as 'gps' | 'manual')}
              items={[
                { id: 'gps', label: t('submission.locationMode.gps') },
                { id: 'manual', label: t('submission.locationMode.manual') },
              ]}
            />

            {locationMode === 'gps' && (
              <div
                className={cn(
                  'mt-2 rounded-lg border px-3 py-2 text-sm flex items-center gap-2',
                  gpsReady
                    ? 'border-green-200 bg-green-50 text-green-800'
                    : 'border-gray-200 bg-gray-50 text-text-muted',
                )}
              >
                {gpsReady ? (
                  <>
                    <CheckCircle2 size={16} className="shrink-0" />
                    <span>{t('submission.gps.captured')}</span>
                    {position && (
                      <span className="font-mono text-xs">
                        · {position.lat.toFixed(5)}, {position.lng.toFixed(5)} · ±
                        {Math.round(position.accuracy)} m
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <Loader2 size={16} className="animate-spin shrink-0" />
                    <span className="flex-1">{gpsError ?? t('submission.gps.waiting')}</span>
                  </>
                )}
              </div>
            )}
            {locationMode === 'gps' && !gpsReady && (
              <p className="mt-1 text-[11px] text-text-muted">
                {t('submission.locationGpsFallbackHint')}
              </p>
            )}

            {locationMode === 'manual' && (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-text-muted">{t('submission.locationManualHint')}</p>
                <LocationPicker
                  zone={zone}
                  value={manualPosition}
                  onChange={(lat, lng) => setManualPosition({ lat, lng })}
                />
              </div>
            )}
          </div>

          {/* Survey-only fields */}
          {submissionType === 'survey' && (
            <Card>
              <CardBody className="space-y-3">
                <SurveySelect
                  id="age_range"
                  label={t('submission.ageRange')}
                  value={ageRange}
                  onChange={(v) => setAgeRange(v as AgeRange | '')}
                  options={AGE_RANGES.map((id) => ({ id, label: t(`ageRanges.${id}`) }))}
                />
                <SurveySelect
                  id="gender"
                  label={t('submission.gender')}
                  value={gender}
                  onChange={(v) => setGender(v as Gender | '')}
                  options={GENDERS.map((id) => ({
                    id,
                    label: id === 'unknown' ? t('submission.unknown') : t(`genders.${id}`),
                  }))}
                />
                <SurveySelect
                  id="race"
                  label={t('submission.race')}
                  value={race}
                  onChange={(v) => setRace(v as Race | '')}
                  options={RACES.map((id) => ({
                    id,
                    label: id === 'unknown' ? t('submission.unknown') : t(`races.${id}`),
                  }))}
                />
                <SurveySelect
                  id="ethnicity"
                  label={t('submission.ethnicity')}
                  value={ethnicity}
                  onChange={(v) => setEthnicity(v as Ethnicity | '')}
                  options={ETHNICITIES.map((id) => ({
                    id,
                    label: id === 'unknown' ? t('submission.unknown') : t(`ethnicities.${id}`),
                  }))}
                />
              </CardBody>
            </Card>
          )}

          {/* Notes */}
          <div>
            <label htmlFor="sub_notes" className="block text-sm font-medium text-text-body mb-1.5">
              {t('submission.notes')}
            </label>
            <Textarea
              id="sub_notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('submission.notesPlaceholder')}
              maxLength={300}
              rows={3}
            />
            <p className="mt-1 text-xs text-text-muted">{notes.length}/300</p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-status-alert" role="alert">
              {error}
            </div>
          )}

          <Button
            type="submit"
            fullWidth
            size="lg"
            disabled={createMutation.isPending || !locationReady}
            className="h-14 text-base"
          >
            {createMutation.isPending ? t('submission.submitting') : t('submission.submit')}
          </Button>
        </form>
      )}

      {confirming && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-5">
            <h3 className="text-base font-semibold text-text-primary">{t('submission.outsideZoneWarn')}</h3>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                {t('actions.cancel')}
              </Button>
              <Button
                onClick={() => {
                  setConfirming(false);
                  void handleSubmit(undefined, true);
                }}
              >
                {t('submission.submit')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface TypeCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

function TypeCard({ icon, title, description, onClick }: TypeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left p-5 rounded-2xl border-2 border-wp-border bg-white hover:border-primary hover:shadow-sm transition-all"
    >
      <div className="h-12 w-12 rounded-xl bg-primary-light/60 inline-flex items-center justify-center">
        {icon}
      </div>
      <h3 className="mt-3 text-base font-semibold text-text-primary">{title}</h3>
      <p className="mt-1 text-sm text-text-muted">{description}</p>
    </button>
  );
}

interface SurveySelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; label: string }>;
}

function SurveySelect({ id, label, value, onChange, options }: SurveySelectProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-text-body mb-1.5">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
