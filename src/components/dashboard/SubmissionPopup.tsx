import { X } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { Tables } from '@/lib/database.types';

interface SubmissionPopupProps {
  submission: Tables<'submissions'>;
  teamName: string | null;
  zoneName: string | null;
  onClose: () => void;
}

const LOCATION_LABEL: Record<string, string> = {
  street: 'Street',
  encampment: 'Encampment',
  vehicle: 'Vehicle',
  doorway: 'Doorway',
  park: 'Park',
  underpass: 'Underpass',
  abandoned: 'Abandoned bldg',
  other: 'Other',
};

export function SubmissionPopup({ submission, teamName, zoneName, onClose }: SubmissionPopupProps) {
  const submittedAt = new Date(submission.device_submitted_at);
  return (
    <Card className="absolute right-4 top-4 z-10 w-[280px] shadow-card">
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Submission
            </p>
            <p className="text-sm font-semibold text-text-primary truncate">
              {teamName ?? 'Team'} · {zoneName ?? 'Zone'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 -mr-1 -mt-1 rounded-md p-1 text-text-muted hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-text-primary leading-none">
            {submission.person_count}
          </span>
          <span className="text-xs text-text-muted">
            person{submission.person_count === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral">{LOCATION_LABEL[submission.location_type] ?? submission.location_type}</Badge>
          <Badge tone={submission.submission_type === 'survey' ? 'pending' : 'active'}>
            {submission.submission_type === 'survey' ? 'Survey' : 'Tally'}
          </Badge>
          {submission.outside_zone && <Badge tone="alert">Outside zone</Badge>}
        </div>

        {submission.notes && (
          <p className="text-xs text-text-body whitespace-pre-wrap">{submission.notes}</p>
        )}

        <p className="text-[11px] text-text-muted pt-1 border-t border-wp-border">
          {submittedAt.toLocaleString()}
        </p>
      </CardBody>
    </Card>
  );
}
