import { supabase, supabaseConfigured } from '@/lib/supabase';

/**
 * Subscribe to live changes that affect the coordinator dashboard for a given
 * event. Fires `onChange()` whenever:
 *   - a new submission row is inserted for this event
 *   - a team_members row's last_seen_at is updated
 *   - a zone status is updated
 *
 * Real mode: Supabase Realtime channels (Postgres CDC).
 * Demo mode: 5s poll over localStorage with a content fingerprint so we only
 * fire on actual changes.
 *
 * Returns a teardown function. Always call it on effect cleanup.
 */
export function subscribeDashboard(eventId: string, onChange: () => void): () => void {
  if (!supabaseConfigured) return subscribeDemo(onChange);

  const channel = supabase
    .channel(`wp-dashboard-${eventId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'submissions', filter: `count_event_id=eq.${eventId}` },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'team_members' },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'zones', filter: `count_event_id=eq.${eventId}` },
      onChange,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

// -----------------------------------------------------------------------------
// Demo polling
// -----------------------------------------------------------------------------

const DEMO_KEYS = [
  'waypoint-pit-demo-submissions',
  'waypoint-pit-demo-team-members',
  'waypoint-pit-demo-zones',
  'waypoint-pit-demo-teams',
];
const DEMO_POLL_MS = 5_000;

function fingerprint(): string {
  if (typeof window === 'undefined') return '';
  return DEMO_KEYS.map((k) => window.localStorage.getItem(k)?.length ?? 0).join(',');
}

function subscribeDemo(onChange: () => void): () => void {
  let last = fingerprint();
  const tick = () => {
    const next = fingerprint();
    if (next !== last) {
      last = next;
      onChange();
    }
  };
  const id = window.setInterval(tick, DEMO_POLL_MS);
  // Cross-tab writes also fire 'storage' — pick those up immediately.
  const onStorage = (e: StorageEvent) => {
    if (e.key && DEMO_KEYS.includes(e.key)) {
      last = fingerprint();
      onChange();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    window.clearInterval(id);
    window.removeEventListener('storage', onStorage);
  };
}
