import { useNavigate, useParams } from 'react-router-dom';
import { TeamFormModal } from './TeamFormModal';
import { TeamsPage } from './TeamsPage';

/**
 * /events/:id/teams/new — renders the teams list with the new-team modal open
 * on top. Closing the modal navigates back to the list URL.
 */
export function TeamCreatePage() {
  const { id: eventId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!eventId) {
    return <p className="text-sm text-status-alert">Missing event id.</p>;
  }

  return (
    <>
      <TeamsPage />
      <TeamFormModal eventId={eventId} onClose={() => navigate(`/events/${eventId}/teams`)} />
    </>
  );
}
