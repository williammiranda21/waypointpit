-- Waypoint PIT — Phase 2 / Migration 5
-- Zone-boundary enforcement.
--
-- BEFORE INSERT on submissions:
--   * Computes ST_Distance from the submission point to the assigned zone
--   * Sets distance_to_zone_meters and outside_zone based on the event's buffer
--   * If count_events.enforce_zone_boundary = true AND outside the buffer,
--     raises check_violation so the insert fails (RLS-friendly: client sees
--     a clean error and can re-queue or surface to the volunteer).

CREATE OR REPLACE FUNCTION public.wp_enforce_zone_boundary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enforce  boolean;
  v_buffer   integer;
  v_distance numeric;
  v_inside   boolean;
BEGIN
  -- Pull the event's enforcement config.
  SELECT enforce_zone_boundary, zone_buffer_meters
    INTO v_enforce, v_buffer
    FROM count_events
   WHERE id = NEW.count_event_id;

  IF v_buffer IS NULL THEN
    -- Belt-and-suspenders: the FK guarantees the row exists, but be defensive.
    v_buffer  := 25;
    v_enforce := false;
  END IF;

  -- Distance in meters from the point to the assigned zone polygon.
  -- ST_Distance with geography returns 0 when the point is inside the polygon.
  SELECT ST_Distance(z.geometry::geography, NEW.location::geography)
    INTO v_distance
    FROM zones z
   WHERE z.id = NEW.zone_id;

  IF v_distance IS NULL THEN
    -- Zone went missing between FK check and trigger? Treat as outside.
    v_distance := 9999999;
  END IF;

  v_inside := v_distance <= v_buffer;

  NEW.distance_to_zone_meters := v_distance;
  NEW.outside_zone            := NOT v_inside;

  IF v_enforce AND NOT v_inside THEN
    RAISE EXCEPTION
      'Submission outside assigned zone boundary (distance % m, buffer % m). This event has strict zone enforcement enabled.',
      round(v_distance, 1),
      v_buffer
      USING ERRCODE = 'check_violation',
            HINT = 'Move within the assigned zone or contact your coordinator to relax enforcement.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_submissions_enforce_zone
  BEFORE INSERT ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.wp_enforce_zone_boundary();
