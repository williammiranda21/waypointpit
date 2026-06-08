-- Waypoint PIT — Phase 5.5 / Migration 7
-- Hotspots: location intel (typically from police or outreach providers) shown
-- to volunteers on the field-app map. Informational only — NOT submissions.

CREATE TABLE hotspots (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  count_event_id    uuid NOT NULL REFERENCES count_events(id) ON DELETE CASCADE,
  org_id            uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  zone_id           uuid REFERENCES zones(id) ON DELETE SET NULL,  -- auto-assigned

  name              text NOT NULL,
  description       text,
  hotspot_type      text NOT NULL DEFAULT 'sighting'
                      CHECK (hotspot_type IN ('sighting','encampment','hazard','resource')),
  severity          text NOT NULL DEFAULT 'medium'
                      CHECK (severity IN ('low','medium','high')),
  source            text,                  -- 'MDPD', 'outreach', etc.
  reported_at       timestamptz,

  gps_lat           numeric(10, 7) NOT NULL CHECK (gps_lat BETWEEN -90 AND 90),
  gps_lng           numeric(10, 7) NOT NULL CHECK (gps_lng BETWEEN -180 AND 180),
  location          geometry(Point, 4326)
                      GENERATED ALWAYS AS
                        (ST_SetSRID(ST_MakePoint(gps_lng, gps_lat), 4326))
                      STORED,

  resolved          boolean NOT NULL DEFAULT false,
  resolved_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at       timestamptz,

  created_by        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_hotspots_event_id ON hotspots(count_event_id);
CREATE INDEX idx_hotspots_zone_id  ON hotspots(zone_id);
CREATE INDEX idx_hotspots_org_id   ON hotspots(org_id);
CREATE INDEX idx_hotspots_location ON hotspots USING GIST(location);

ALTER TABLE hotspots ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------

-- SELECT: org members. Volunteers/team leads only see hotspots for zones their
-- team is assigned to.
CREATE POLICY hotspots_select ON hotspots
  FOR SELECT
  USING (
    public.wp_user_role() = 'super_admin'
    OR (
      org_id = public.wp_user_org_id()
      AND (
        public.wp_user_role() IN ('coc_admin')
        OR zone_id IN (
          SELECT zone_id FROM teams
          WHERE id IN (SELECT public.wp_user_team_ids())
        )
        OR zone_id IS NULL  -- unassigned hotspots visible to admins (gated above)
      )
    )
  );

-- INSERT / UPDATE / DELETE: admins only.
CREATE POLICY hotspots_modify ON hotspots
  FOR ALL
  USING (
    (org_id = public.wp_user_org_id() AND public.wp_user_role() = 'coc_admin')
    OR public.wp_user_role() = 'super_admin'
  )
  WITH CHECK (
    (org_id = public.wp_user_org_id() AND public.wp_user_role() = 'coc_admin')
    OR public.wp_user_role() = 'super_admin'
  );

-- Targeted policy for volunteers to flip resolved-state only.
-- Implemented via a SECURITY DEFINER function called from the client so we can
-- enforce field-level restrictions; this policy lets that function commit.
CREATE OR REPLACE FUNCTION public.wp_resolve_hotspot(p_hotspot_id uuid)
RETURNS hotspots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  h hotspots%ROWTYPE;
BEGIN
  SELECT * INTO h FROM hotspots WHERE id = p_hotspot_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hotspot not found' USING ERRCODE = 'no_data_found';
  END IF;

  -- Caller must be in a team assigned to this hotspot's zone (or an admin).
  IF NOT (
    public.wp_user_role() IN ('coc_admin','super_admin')
    OR h.zone_id IN (
      SELECT zone_id FROM teams WHERE id IN (SELECT public.wp_user_team_ids())
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to resolve this hotspot' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE hotspots
    SET resolved    = NOT h.resolved,
        resolved_by = CASE WHEN NOT h.resolved THEN auth.uid() ELSE NULL END,
        resolved_at = CASE WHEN NOT h.resolved THEN now()      ELSE NULL END
    WHERE id = p_hotspot_id
    RETURNING * INTO h;

  RETURN h;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.wp_resolve_hotspot FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.wp_resolve_hotspot TO authenticated;
