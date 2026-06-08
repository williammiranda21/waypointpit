import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Copy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { PageHeader } from '@/components/ui/PageHeader';
import { useCreateEvent, useEventsList } from '@/hooks/useEvents';
import { cloneEventSetup } from '@/lib/db/clone';
import type { SubmissionMode } from '@/lib/database.types';
import { cn } from '@/lib/cn';

export function EventCreatePage() {
  const navigate = useNavigate();
  const createMutation = useCreateEvent();
  const { data: existingEvents = [] } = useEventsList();

  const [name, setName] = useState('');
  const [countDate, setCountDate] = useState(defaultDateString());
  const [description, setDescription] = useState('');
  const [enforce, setEnforce] = useState(false);
  const [buffer, setBuffer] = useState<number>(25);
  const [submissionMode, setSubmissionMode] = useState<SubmissionMode>('tally_only');
  const [cloneFromId, setCloneFromId] = useState<string>('');
  const [cloneStatus, setCloneStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!countDate) {
      setError('Count date is required.');
      return;
    }
    if (buffer < 0 || buffer > 5000) {
      setError('Buffer must be between 0 and 5000 meters.');
      return;
    }

    try {
      const created = await createMutation.mutateAsync({
        name: name.trim(),
        count_date: countDate,
        description: description.trim() || null,
        enforce_zone_boundary: enforce,
        zone_buffer_meters: buffer,
        submission_mode: submissionMode,
        cloned_from_event_id: cloneFromId || null,
      });

      if (cloneFromId) {
        setCloneStatus('Copying zones, teams, members, and unresolved hotspots…');
        try {
          const summary = await cloneEventSetup(cloneFromId, created.id);
          setCloneStatus(
            `Cloned ${summary.zonesCopied} zones, ${summary.teamsCopied} teams, ` +
              `${summary.membersCopied} members, ${summary.hotspotsCopied} hotspots.`,
          );
        } catch (cloneErr) {
          // The event itself was created — let the user proceed to it and try
          // again from the zones/teams pages. Surface a non-fatal warning.
          setError(
            `Event created but clone failed: ${
              cloneErr instanceof Error ? cloneErr.message : 'unknown error'
            }. You can still configure zones/teams manually.`,
          );
          setCloneStatus(null);
          navigate(`/events/${created.id}`, { replace: true });
          return;
        }
      }

      navigate(`/events/${created.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create event.');
    }
  };

  return (
    <div className="max-w-2xl">
      <Link
        to="/events"
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary mb-3"
      >
        <ArrowLeft size={14} />
        Back to events
      </Link>

      <PageHeader
        title="New Count Event"
        description="Configure when the count happens and how strict zone boundaries should be."
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {existingEvents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Start from an existing event</CardTitle>
              <CardDescription>
                Optional. Copies the source event&rsquo;s zones, teams, and member rosters into
                the new event so you don&rsquo;t have to recreate them. Submissions are not carried.
              </CardDescription>
            </CardHeader>
            <CardBody>
              <label
                htmlFor="clone_from"
                className="block text-sm font-medium text-text-body mb-1.5"
              >
                Source event
              </label>
              <select
                id="clone_from"
                value={cloneFromId}
                onChange={(e) => setCloneFromId(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">Start from scratch</option>
                {existingEvents.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} — {e.count_date}
                  </option>
                ))}
              </select>
              {cloneFromId && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-text-muted">
                  <Copy size={12} />
                  Zones, teams, and members will be cloned after the event is created.
                </p>
              )}
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Event details</CardTitle>
            <CardDescription>
              Volunteers will see this name on the count app.
            </CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-text-body mb-1.5">
                Name <span className="text-status-alert">*</span>
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="January 2027 PIT Count"
                required
              />
            </div>

            <div>
              <label
                htmlFor="count_date"
                className="block text-sm font-medium text-text-body mb-1.5"
              >
                Count date <span className="text-status-alert">*</span>
              </label>
              <Input
                id="count_date"
                type="date"
                value={countDate}
                onChange={(e) => setCountDate(e.target.value)}
                required
              />
              <p className="mt-1 text-xs text-text-muted">
                The night the count is conducted. Status flips to active when you launch the event.
              </p>
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-text-body mb-1.5"
              >
                Description
              </label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Notes for coordinators or volunteers"
                rows={3}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Volunteer submission methodology</CardTitle>
            <CardDescription>
              Decide how volunteers log observations this count. Mixing both keeps the data harder
              to compare across counts &mdash; most CoCs pick one mode per event.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(
                [
                  {
                    id: 'tally_only',
                    title: 'Quick Tally only',
                    description: 'Headcount + location type. Fastest. Matches observation-only methodology.',
                  },
                  {
                    id: 'survey_only',
                    title: 'Individual Survey only',
                    description: 'One submission per person with demographics. Maximum detail.',
                  },
                  {
                    id: 'both',
                    title: 'Volunteer chooses',
                    description: 'Each submission picks. Use when methodology varies during the count.',
                  },
                ] as Array<{ id: SubmissionMode; title: string; description: string }>
              ).map((opt) => {
                const active = opt.id === submissionMode;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSubmissionMode(opt.id)}
                    className={cn(
                      'text-left p-3 rounded-xl border-2 transition-all',
                      active
                        ? 'border-primary bg-primary-light/40'
                        : 'border-wp-border bg-white hover:border-gray-300',
                    )}
                  >
                    <p className="text-sm font-semibold text-text-primary">{opt.title}</p>
                    <p className="mt-0.5 text-xs text-text-muted">{opt.description}</p>
                  </button>
                );
              })}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Zone-boundary enforcement</CardTitle>
            <CardDescription>
              Controls how submissions outside a team&rsquo;s assigned zone are handled.
            </CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <span className="block text-sm font-medium text-text-body mb-2">
                When a submission is captured outside the assigned zone
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(
                  [
                    {
                      value: false,
                      title: 'Flag the submission',
                      description: 'Volunteers can still submit; the submission is saved and flagged for coordinator review.',
                    },
                    {
                      value: true,
                      title: 'Refuse the submission',
                      description: 'The submission is blocked — volunteers must be inside the zone (plus buffer) to submit.',
                    },
                  ] as Array<{ value: boolean; title: string; description: string }>
                ).map((opt) => {
                  const active = opt.value === enforce;
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => setEnforce(opt.value)}
                      className={cn(
                        'text-left p-3 rounded-xl border-2 transition-all',
                        active
                          ? 'border-primary bg-primary-light/40'
                          : 'border-wp-border bg-white hover:border-gray-300',
                      )}
                    >
                      <p className="text-sm font-semibold text-text-primary">{opt.title}</p>
                      <p className="mt-0.5 text-xs text-text-muted">{opt.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="buffer" className="block text-sm font-medium text-text-body mb-1.5">
                GPS buffer (meters)
              </label>
              <Input
                id="buffer"
                type="number"
                min={0}
                max={5000}
                step={5}
                value={buffer}
                onChange={(e) => setBuffer(parseInt(e.target.value || '0', 10))}
                className="max-w-[160px]"
              />
              <p className="mt-1 text-xs text-text-muted">
                Submissions within this distance of the zone polygon are considered inside.
                Default 25 m absorbs typical urban GPS error.
              </p>
            </div>
          </CardBody>
        </Card>

        {cloneStatus && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800" role="status">
            {cloneStatus}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-status-alert" role="alert">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Link to="/events">
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating…' : 'Create event'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function defaultDateString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
