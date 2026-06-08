-- Waypoint PIT — Phase 7 follow-up
-- Methodology decision belongs at the event level. Some counts run pure
-- observation-only (tally), some do full demographic surveys, and some mix.
-- Defaulting to tally_only matches Miami-Dade's current methodology (per spec).

ALTER TABLE count_events
  ADD COLUMN submission_mode text NOT NULL DEFAULT 'tally_only'
    CHECK (submission_mode IN ('tally_only', 'survey_only', 'both'));
