-- Waypoint PIT — Phase 5 / Migration 6
-- Track cloned event lineage so the detail page can show "Cloned from X".
-- The actual clone copy logic (zones + teams + members) runs in app code,
-- not in a trigger — keeps the DB simple and the operation transactional
-- on the client.

ALTER TABLE count_events
  ADD COLUMN cloned_from_event_id uuid
    REFERENCES count_events(id) ON DELETE SET NULL;

CREATE INDEX idx_count_events_cloned_from ON count_events(cloned_from_event_id);
