import { pointInPolygon } from '@/components/map/geo';
import type { BoundaryFeature } from '@/lib/boundaries';
import type { Tables } from '@/lib/database.types';

export type Submission = Tables<'submissions'>;
export type CountEvent = Tables<'count_events'>;
export type Zone = Tables<'zones'>;

export interface BoundaryAggregate {
  feature: BoundaryFeature;
  personCount: number;
  submissionCount: number;
  surveyCount: number;
  /** Set of distinct submission ids inside this polygon. Useful for joins. */
  submissionIds: string[];
}

/**
 * For each boundary polygon, count submissions whose GPS point falls inside
 * it. Submissions that fall outside any polygon land in the `unassigned`
 * bucket (returned separately).
 */
export function aggregateByBoundary(
  features: BoundaryFeature[],
  submissions: Submission[],
): { aggregates: BoundaryAggregate[]; unassigned: Submission[] } {
  const aggregates: BoundaryAggregate[] = features.map((f) => ({
    feature: f,
    personCount: 0,
    submissionCount: 0,
    surveyCount: 0,
    submissionIds: [],
  }));
  const unassigned: Submission[] = [];

  for (const s of submissions) {
    let placed = false;
    for (const a of aggregates) {
      if (pointInPolygon([s.gps_lng, s.gps_lat], a.feature.geometry)) {
        a.personCount += s.person_count;
        a.submissionCount += 1;
        if (s.submission_type === 'survey') a.surveyCount += 1;
        a.submissionIds.push(s.id);
        placed = true;
        break;
      }
    }
    if (!placed) unassigned.push(s);
  }

  return { aggregates, unassigned };
}

/**
 * Returns a function that maps a count (0..max) to a hex color along the
 * Waypoint sequential ramp (light yellow → red).
 */
export function makeChoroplethRamp(max: number): (count: number) => string {
  if (max <= 0) return () => '#F3F4F6';
  // 6-stop ramp: pale → green → amber → red.
  const stops = [
    '#F3F4F6', // 0 — gray
    '#DCFCE7', // 1 — pale green
    '#86EFAC', // green
    '#FCD34D', // amber
    '#F97316', // orange
    '#DC2626', // red
  ];
  return (count: number) => {
    if (count <= 0) return stops[0];
    const t = Math.min(1, count / max);
    const idx = Math.min(stops.length - 1, Math.floor(t * (stops.length - 1)));
    return stops[Math.max(1, idx)];
  };
}

export interface EventTotals {
  eventId: string;
  eventName: string;
  countDate: string;
  totalPersons: number;
  submissionCount: number;
  surveyCount: number;
  perLocationType: Record<string, number>;
  perZone: Record<string, number>;
}

export function aggregateByEvent(
  events: CountEvent[],
  zones: Zone[],
  submissions: Submission[],
): EventTotals[] {
  const zoneById = new Map(zones.map((z) => [z.id, z]));
  return events.map((e) => {
    const eventSubs = submissions.filter((s) => s.count_event_id === e.id);
    const perLocationType: Record<string, number> = {};
    const perZone: Record<string, number> = {};
    let totalPersons = 0;
    let surveyCount = 0;
    for (const s of eventSubs) {
      totalPersons += s.person_count;
      perLocationType[s.location_type] =
        (perLocationType[s.location_type] ?? 0) + s.person_count;
      const zoneName = zoneById.get(s.zone_id)?.name ?? 'Unassigned';
      perZone[zoneName] = (perZone[zoneName] ?? 0) + s.person_count;
      if (s.submission_type === 'survey') surveyCount += 1;
    }
    return {
      eventId: e.id,
      eventName: e.name,
      countDate: e.count_date,
      totalPersons,
      submissionCount: eventSubs.length,
      surveyCount,
      perLocationType,
      perZone,
    };
  });
}

/**
 * Extract themes from submission.notes via simple word-frequency counting.
 * Filters stop words and short tokens. Returns the top N terms with counts.
 */
const STOP_WORDS = new Set([
  'the', 'and', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'is',
  'are', 'was', 'were', 'be', 'been', 'being', 'this', 'that', 'these', 'those',
  'i', 'we', 'they', 'he', 'she', 'it', 'his', 'her', 'their', 'our',
  'have', 'has', 'had', 'do', 'does', 'did', 'but', 'or', 'as', 'by', 'from',
  'about', 'no', 'not', 'so', 'too', 'very', 'just', 'one', 'two', 'three',
  'said', 'says', 'me', 'my', 'mine', 'you', 'your', 'yours', 'us', 'them',
  'near', 'side', 'street', 'st', 'rd', 'ave', 'blvd', 'ne', 'nw', 'sw', 'se',
]);

export interface NotesTheme {
  term: string;
  count: number;
}

export function extractNotesThemes(
  submissions: Submission[],
  topN: number = 12,
): NotesTheme[] {
  const counts = new Map<string, number>();
  for (const s of submissions) {
    if (!s.notes) continue;
    const tokens = s.notes
      .toLowerCase()
      .replace(/[^\p{L}\s]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 4 && !STOP_WORDS.has(t));
    for (const t of tokens) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}
