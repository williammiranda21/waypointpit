-- Waypoint PIT — Phase 5.5 follow-up
-- Police-shared hotspot lists routinely include a "# of persons observed"
-- column (e.g. Aventura PD Site Identification Form). Capture it so the
-- operational signal isn't lost.

ALTER TABLE hotspots
  ADD COLUMN expected_count integer
    CHECK (expected_count IS NULL OR expected_count >= 0);
