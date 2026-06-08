-- ============================================================================
-- Waypoint PIT — Full database deploy bundle
-- Generated from migrations/*.sql (in order) + seed.sql
-- Paste this entire file into the Supabase SQL Editor and Run.
-- Idempotent seed; migrations are not (run once on a fresh project).
-- ============================================================================


-- ////////////////////////////////////////////////////////////////////////
-- SOURCE: migrations/20260527120000_extensions.sql
-- ////////////////////////////////////////////////////////////////////////

-- Waypoint PIT — Phase 2 / Migration 1
-- Extensions. PostGIS MUST be the first statement of the first migration per spec.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ////////////////////////////////////////////////////////////////////////
-- SOURCE: migrations/20260527120100_schema.sql
-- ////////////////////////////////////////////////////////////////////////

-- Waypoint PIT — Phase 2 / Migration 2
-- Tables, constraints, and indexes for the full PIT data model.
-- Every table carries org_id for future multi-tenancy and is enabled for RLS
-- (policies land in migration 4).

------------------------------------------------------------------------------
-- organizations
------------------------------------------------------------------------------
CREATE TABLE organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  coc_code    text UNIQUE,
  city        text,
  state       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

------------------------------------------------------------------------------
-- profiles  (linked 1:1 with auth.users)
-- Admin creates these rows after creating the user in Supabase Auth.
------------------------------------------------------------------------------
CREATE TABLE profiles (
  id                  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id              uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  full_name           text NOT NULL,
  email               text NOT NULL,
  role                text NOT NULL
                        CHECK (role IN ('super_admin', 'coc_admin', 'team_lead', 'volunteer')),
  preferred_language  text NOT NULL DEFAULT 'en'
                        CHECK (preferred_language IN ('en', 'es')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_org_id ON profiles(org_id);

------------------------------------------------------------------------------
-- count_events
-- enforce_zone_boundary + zone_buffer_meters are PIT-specific additions
-- that gate the trigger in migration 5.
------------------------------------------------------------------------------
CREATE TABLE count_events (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name                    text NOT NULL,
  count_date              date NOT NULL,
  description             text,
  status                  text NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'active', 'closed')),
  enforce_zone_boundary   boolean NOT NULL DEFAULT false,
  zone_buffer_meters      integer NOT NULL DEFAULT 25
                            CHECK (zone_buffer_meters >= 0 AND zone_buffer_meters <= 5000),
  created_by              uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  closed_at               timestamptz
);

CREATE INDEX idx_count_events_org_id ON count_events(org_id);
CREATE INDEX idx_count_events_status ON count_events(status) WHERE status = 'active';

------------------------------------------------------------------------------
-- zone_templates  (predefined polygons; nullable org_id = global)
------------------------------------------------------------------------------
CREATE TABLE zone_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  geometry        geometry(Polygon, 4326) NOT NULL,
  default_color   text NOT NULL DEFAULT '#22C55E',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_zone_templates_org_id ON zone_templates(org_id);
CREATE INDEX idx_zone_templates_geometry ON zone_templates USING GIST(geometry);

------------------------------------------------------------------------------
-- zones  (event-scoped; one team per zone, but enforced at the team layer)
------------------------------------------------------------------------------
CREATE TABLE zones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  count_event_id  uuid NOT NULL REFERENCES count_events(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name            text NOT NULL,
  geometry        geometry(Polygon, 4326) NOT NULL,
  color           text NOT NULL DEFAULT '#22C55E',
  status          text NOT NULL DEFAULT 'not_started'
                    CHECK (status IN ('not_started', 'in_progress', 'complete')),
  template_id     uuid REFERENCES zone_templates(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_zones_count_event_id ON zones(count_event_id);
CREATE INDEX idx_zones_org_id         ON zones(org_id);
CREATE INDEX idx_zones_geometry       ON zones USING GIST(geometry);

------------------------------------------------------------------------------
-- teams
------------------------------------------------------------------------------
CREATE TABLE teams (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  count_event_id  uuid NOT NULL REFERENCES count_events(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  zone_id         uuid NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
  name            text NOT NULL,
  team_lead_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_teams_count_event_id ON teams(count_event_id);
CREATE INDEX idx_teams_org_id         ON teams(org_id);
CREATE INDEX idx_teams_zone_id        ON teams(zone_id);

------------------------------------------------------------------------------
-- team_members  (last_seen_at drives silence alerts on the dashboard)
------------------------------------------------------------------------------
CREATE TABLE team_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_in_team  text NOT NULL
                  CHECK (role_in_team IN ('lead', 'volunteer')),
  last_seen_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

CREATE INDEX idx_team_members_user_id      ON team_members(user_id);
CREATE INDEX idx_team_members_last_seen_at ON team_members(last_seen_at);

------------------------------------------------------------------------------
-- submissions  (client-generated UUID; PostGIS location is generated; the
-- enforce-zone trigger in migration 5 fills outside_zone/distance fields.)
------------------------------------------------------------------------------
CREATE TABLE submissions (
  id                          uuid PRIMARY KEY,  -- client-generated, no DEFAULT
  count_event_id              uuid NOT NULL REFERENCES count_events(id) ON DELETE RESTRICT,
  team_id                     uuid NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  zone_id                     uuid NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
  org_id                      uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  submitted_by                uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  submission_type             text NOT NULL
                                CHECK (submission_type IN ('tally', 'survey')),
  person_count                integer NOT NULL CHECK (person_count >= 1),
  location_type               text NOT NULL
                                CHECK (location_type IN (
                                  'street', 'encampment', 'vehicle', 'doorway',
                                  'park', 'underpass', 'abandoned', 'other'
                                )),
  gps_lat                     numeric(10, 7) NOT NULL
                                CHECK (gps_lat BETWEEN -90 AND 90),
  gps_lng                     numeric(10, 7) NOT NULL
                                CHECK (gps_lng BETWEEN -180 AND 180),
  gps_accuracy_meters         numeric(6, 1),
  location                    geometry(Point, 4326)
                                GENERATED ALWAYS AS
                                  (ST_SetSRID(ST_MakePoint(gps_lng, gps_lat), 4326))
                                STORED,
  estimated_age_range         text CHECK (estimated_age_range IS NULL OR estimated_age_range IN (
                                  'under_18','18_24','25_34','35_44','45_54','55_64','65_plus'
                                )),
  observed_gender             text CHECK (observed_gender IS NULL OR observed_gender IN (
                                  'male','female','non_binary','unknown'
                                )),
  -- HUD HMIS race enum values
  observed_race               text CHECK (observed_race IS NULL OR observed_race IN (
                                  'american_indian_alaska_native',
                                  'asian',
                                  'black_african_american',
                                  'native_hawaiian_pacific_islander',
                                  'white',
                                  'multi_racial',
                                  'unknown'
                                )),
  observed_ethnicity          text CHECK (observed_ethnicity IS NULL OR observed_ethnicity IN (
                                  'hispanic','not_hispanic','unknown'
                                )),
  notes                       text CHECK (notes IS NULL OR char_length(notes) <= 300),
  device_submitted_at         timestamptz NOT NULL,
  server_submitted_at         timestamptz NOT NULL DEFAULT now(),
  is_offline_submission       boolean NOT NULL DEFAULT false,

  -- Zone-boundary metadata (populated by trg_submissions_enforce_zone)
  outside_zone                boolean NOT NULL DEFAULT false,
  distance_to_zone_meters     numeric(8, 1)
);

-- Hot paths from the spec
CREATE INDEX idx_submissions_event_time   ON submissions(count_event_id, server_submitted_at DESC);
CREATE INDEX idx_submissions_team         ON submissions(team_id);
CREATE INDEX idx_submissions_zone         ON submissions(zone_id);
CREATE INDEX idx_submissions_org_id       ON submissions(org_id);
CREATE INDEX idx_submissions_location     ON submissions USING GIST(location);

-- Duplicate-detection helper noted in the spec:
--   (team_id, gps_lat, gps_lng, device_submitted_at)
-- Not enforced as UNIQUE (different teams may legitimately be near each other),
-- but indexed for the dashboard's QA queries.
CREATE INDEX idx_submissions_dup_check
  ON submissions(team_id, gps_lat, gps_lng, device_submitted_at);

------------------------------------------------------------------------------
-- Enable RLS on every table; policies are defined in migration 4.
------------------------------------------------------------------------------
ALTER TABLE organizations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE count_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams          ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions    ENABLE ROW LEVEL SECURITY;


-- ////////////////////////////////////////////////////////////////////////
-- SOURCE: migrations/20260527120200_helpers.sql
-- ////////////////////////////////////////////////////////////////////////

-- Waypoint PIT — Phase 2 / Migration 3
-- SECURITY DEFINER helper functions used by RLS policies. They bypass RLS on
-- profiles/team_members so the policies that *read* those tables don't recurse.

------------------------------------------------------------------------------
-- The signed-in user's org. NULL if unauthenticated.
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wp_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM profiles WHERE id = auth.uid()
$$;

------------------------------------------------------------------------------
-- The signed-in user's role. NULL if unauthenticated.
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wp_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

------------------------------------------------------------------------------
-- Convenience: is the signed-in user an admin (coc_admin or super_admin)?
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wp_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role IN ('super_admin', 'coc_admin') FROM profiles WHERE id = auth.uid()
$$;

------------------------------------------------------------------------------
-- The set of team_ids the signed-in user belongs to. Used by volunteer
-- SELECT policies on submissions and team_members.
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wp_user_team_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM team_members WHERE user_id = auth.uid()
$$;

-- Grant EXECUTE to the authenticated role only. Anon callers cannot use these.
REVOKE EXECUTE ON FUNCTION public.wp_user_org_id    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.wp_user_role      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.wp_user_is_admin  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.wp_user_team_ids  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.wp_user_org_id    TO authenticated;
GRANT EXECUTE ON FUNCTION public.wp_user_role      TO authenticated;
GRANT EXECUTE ON FUNCTION public.wp_user_is_admin  TO authenticated;
GRANT EXECUTE ON FUNCTION public.wp_user_team_ids  TO authenticated;


-- ////////////////////////////////////////////////////////////////////////
-- SOURCE: migrations/20260527120300_rls.sql
-- ////////////////////////////////////////////////////////////////////////

-- Waypoint PIT — Phase 2 / Migration 4
-- Row-Level Security policies.
--
-- Spec contract:
--   * Users read/write only where org_id = their profile org_id
--   * Volunteers: INSERT only on submissions; SELECT only own team's submissions
--   * CoC Admin: full CRUD for their org
--   * Super Admin: bypasses RLS
--
-- super_admin behavior: rather than using BYPASSRLS (which requires Postgres
-- role config), every policy below allows the row when wp_user_role() = 'super_admin'.

------------------------------------------------------------------------------
-- organizations
------------------------------------------------------------------------------
CREATE POLICY organizations_select ON organizations
  FOR SELECT
  USING (
    id = public.wp_user_org_id()
    OR public.wp_user_role() = 'super_admin'
  );

CREATE POLICY organizations_modify ON organizations
  FOR ALL
  USING (public.wp_user_role() = 'super_admin')
  WITH CHECK (public.wp_user_role() = 'super_admin');

------------------------------------------------------------------------------
-- profiles
------------------------------------------------------------------------------
CREATE POLICY profiles_select ON profiles
  FOR SELECT
  USING (
    id = auth.uid()                                  -- self
    OR (
      org_id = public.wp_user_org_id()
      AND public.wp_user_role() IN ('coc_admin', 'super_admin', 'team_lead')
    )
    OR public.wp_user_role() = 'super_admin'
  );

CREATE POLICY profiles_insert ON profiles
  FOR INSERT
  WITH CHECK (
    public.wp_user_role() IN ('super_admin', 'coc_admin')
    AND (org_id = public.wp_user_org_id() OR public.wp_user_role() = 'super_admin')
  );

-- Volunteers can update their own preferred_language (and nothing else of
-- interest); admins can update anyone in their org. Field-level enforcement
-- of which columns volunteers may touch is handled in the API/Edge layer.
CREATE POLICY profiles_update ON profiles
  FOR UPDATE
  USING (
    id = auth.uid()
    OR (
      org_id = public.wp_user_org_id()
      AND public.wp_user_role() IN ('coc_admin', 'super_admin')
    )
    OR public.wp_user_role() = 'super_admin'
  )
  WITH CHECK (
    id = auth.uid()
    OR (
      org_id = public.wp_user_org_id()
      AND public.wp_user_role() IN ('coc_admin', 'super_admin')
    )
    OR public.wp_user_role() = 'super_admin'
  );

CREATE POLICY profiles_delete ON profiles
  FOR DELETE
  USING (
    (org_id = public.wp_user_org_id() AND public.wp_user_role() = 'coc_admin')
    OR public.wp_user_role() = 'super_admin'
  );

------------------------------------------------------------------------------
-- count_events
------------------------------------------------------------------------------
CREATE POLICY count_events_select ON count_events
  FOR SELECT
  USING (
    org_id = public.wp_user_org_id()
    OR public.wp_user_role() = 'super_admin'
  );

CREATE POLICY count_events_modify ON count_events
  FOR ALL
  USING (
    (org_id = public.wp_user_org_id() AND public.wp_user_role() = 'coc_admin')
    OR public.wp_user_role() = 'super_admin'
  )
  WITH CHECK (
    (org_id = public.wp_user_org_id() AND public.wp_user_role() = 'coc_admin')
    OR public.wp_user_role() = 'super_admin'
  );

------------------------------------------------------------------------------
-- zone_templates
-- NULL org_id = global templates, readable by everyone authenticated.
------------------------------------------------------------------------------
CREATE POLICY zone_templates_select ON zone_templates
  FOR SELECT
  USING (
    org_id IS NULL
    OR org_id = public.wp_user_org_id()
    OR public.wp_user_role() = 'super_admin'
  );

CREATE POLICY zone_templates_modify ON zone_templates
  FOR ALL
  USING (
    (org_id = public.wp_user_org_id() AND public.wp_user_role() = 'coc_admin')
    OR public.wp_user_role() = 'super_admin'
  )
  WITH CHECK (
    (org_id = public.wp_user_org_id() AND public.wp_user_role() = 'coc_admin')
    OR public.wp_user_role() = 'super_admin'
  );

------------------------------------------------------------------------------
-- zones
------------------------------------------------------------------------------
CREATE POLICY zones_select ON zones
  FOR SELECT
  USING (
    org_id = public.wp_user_org_id()
    OR public.wp_user_role() = 'super_admin'
  );

CREATE POLICY zones_modify ON zones
  FOR ALL
  USING (
    (org_id = public.wp_user_org_id() AND public.wp_user_role() = 'coc_admin')
    OR public.wp_user_role() = 'super_admin'
  )
  WITH CHECK (
    (org_id = public.wp_user_org_id() AND public.wp_user_role() = 'coc_admin')
    OR public.wp_user_role() = 'super_admin'
  );

------------------------------------------------------------------------------
-- teams
------------------------------------------------------------------------------
CREATE POLICY teams_select ON teams
  FOR SELECT
  USING (
    org_id = public.wp_user_org_id()
    OR public.wp_user_role() = 'super_admin'
  );

CREATE POLICY teams_modify ON teams
  FOR ALL
  USING (
    (org_id = public.wp_user_org_id() AND public.wp_user_role() = 'coc_admin')
    OR public.wp_user_role() = 'super_admin'
  )
  WITH CHECK (
    (org_id = public.wp_user_org_id() AND public.wp_user_role() = 'coc_admin')
    OR public.wp_user_role() = 'super_admin'
  );

------------------------------------------------------------------------------
-- team_members
------------------------------------------------------------------------------
CREATE POLICY team_members_select ON team_members
  FOR SELECT
  USING (
    user_id = auth.uid()                                       -- self
    OR team_id IN (SELECT public.wp_user_team_ids())           -- teammates
    OR (
      public.wp_user_role() IN ('coc_admin', 'super_admin')
      AND team_id IN (SELECT id FROM teams WHERE org_id = public.wp_user_org_id())
    )
    OR public.wp_user_role() = 'super_admin'
  );

-- Admins manage roster; volunteers cannot insert/delete themselves.
CREATE POLICY team_members_insert ON team_members
  FOR INSERT
  WITH CHECK (
    public.wp_user_role() IN ('coc_admin', 'super_admin')
    AND (
      team_id IN (SELECT id FROM teams WHERE org_id = public.wp_user_org_id())
      OR public.wp_user_role() = 'super_admin'
    )
  );

CREATE POLICY team_members_delete ON team_members
  FOR DELETE
  USING (
    (
      public.wp_user_role() = 'coc_admin'
      AND team_id IN (SELECT id FROM teams WHERE org_id = public.wp_user_org_id())
    )
    OR public.wp_user_role() = 'super_admin'
  );

-- Volunteers (and admins) may update their own last_seen_at row.
-- Other fields effectively cannot change because the only meaningful update
-- target is last_seen_at; row-level UPDATE permission combined with no other
-- mutable columns of interest is sufficient.
CREATE POLICY team_members_update ON team_members
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR (
      public.wp_user_role() IN ('coc_admin', 'super_admin')
      AND team_id IN (SELECT id FROM teams WHERE org_id = public.wp_user_org_id())
    )
    OR public.wp_user_role() = 'super_admin'
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (
      public.wp_user_role() IN ('coc_admin', 'super_admin')
      AND team_id IN (SELECT id FROM teams WHERE org_id = public.wp_user_org_id())
    )
    OR public.wp_user_role() = 'super_admin'
  );

------------------------------------------------------------------------------
-- submissions
-- Volunteers: SELECT only their team's; INSERT only as themselves on their team.
-- Admins: full CRUD for their org.
------------------------------------------------------------------------------
CREATE POLICY submissions_select ON submissions
  FOR SELECT
  USING (
    team_id IN (SELECT public.wp_user_team_ids())              -- teammates only
    OR (
      org_id = public.wp_user_org_id()
      AND public.wp_user_role() IN ('coc_admin', 'super_admin')
    )
    OR public.wp_user_role() = 'super_admin'
  );

CREATE POLICY submissions_insert ON submissions
  FOR INSERT
  WITH CHECK (
    submitted_by = auth.uid()
    AND org_id = public.wp_user_org_id()
    AND team_id IN (SELECT public.wp_user_team_ids())
    AND zone_id IN (SELECT zone_id FROM teams WHERE id = submissions.team_id)
  );

CREATE POLICY submissions_modify ON submissions
  FOR UPDATE
  USING (
    (org_id = public.wp_user_org_id() AND public.wp_user_role() = 'coc_admin')
    OR public.wp_user_role() = 'super_admin'
  )
  WITH CHECK (
    (org_id = public.wp_user_org_id() AND public.wp_user_role() = 'coc_admin')
    OR public.wp_user_role() = 'super_admin'
  );

CREATE POLICY submissions_delete ON submissions
  FOR DELETE
  USING (
    (org_id = public.wp_user_org_id() AND public.wp_user_role() = 'coc_admin')
    OR public.wp_user_role() = 'super_admin'
  );


-- ////////////////////////////////////////////////////////////////////////
-- SOURCE: migrations/20260527120400_triggers.sql
-- ////////////////////////////////////////////////////////////////////////

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


-- ////////////////////////////////////////////////////////////////////////
-- SOURCE: migrations/20260527120500_event_cloning.sql
-- ////////////////////////////////////////////////////////////////////////

-- Waypoint PIT — Phase 5 / Migration 6
-- Track cloned event lineage so the detail page can show "Cloned from X".
-- The actual clone copy logic (zones + teams + members) runs in app code,
-- not in a trigger — keeps the DB simple and the operation transactional
-- on the client.

ALTER TABLE count_events
  ADD COLUMN cloned_from_event_id uuid
    REFERENCES count_events(id) ON DELETE SET NULL;

CREATE INDEX idx_count_events_cloned_from ON count_events(cloned_from_event_id);


-- ////////////////////////////////////////////////////////////////////////
-- SOURCE: migrations/20260527120600_hotspots.sql
-- ////////////////////////////////////////////////////////////////////////

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


-- ////////////////////////////////////////////////////////////////////////
-- SOURCE: migrations/20260527120700_hotspot_expected_count.sql
-- ////////////////////////////////////////////////////////////////////////

-- Waypoint PIT — Phase 5.5 follow-up
-- Police-shared hotspot lists routinely include a "# of persons observed"
-- column (e.g. Aventura PD Site Identification Form). Capture it so the
-- operational signal isn't lost.

ALTER TABLE hotspots
  ADD COLUMN expected_count integer
    CHECK (expected_count IS NULL OR expected_count >= 0);


-- ////////////////////////////////////////////////////////////////////////
-- SOURCE: migrations/20260527120800_event_submission_mode.sql
-- ////////////////////////////////////////////////////////////////////////

-- Waypoint PIT — Phase 7 follow-up
-- Methodology decision belongs at the event level. Some counts run pure
-- observation-only (tally), some do full demographic surveys, and some mix.
-- Defaulting to tally_only matches Miami-Dade's current methodology (per spec).

ALTER TABLE count_events
  ADD COLUMN submission_mode text NOT NULL DEFAULT 'tally_only'
    CHECK (submission_mode IN ('tally_only', 'survey_only', 'both'));


-- ////////////////////////////////////////////////////////////////////////
-- SOURCE: seed.sql
-- ////////////////////////////////////////////////////////////////////////

-- Waypoint PIT — Seed data
--
-- 1. Miami-Dade County Homeless Trust (FL-600) organization
-- 2. Eight zone templates with approximate GeoJSON polygons covering common
--    PIT-count areas. Polygons are *approximate*, intended to be refined by
--    the CoC Admin in the Zone Editor before they're used in a real count.
--
-- Idempotent: re-running this file won't create duplicates because we ON
-- CONFLICT match on coc_code / (org_id IS NULL, name).

------------------------------------------------------------------------------
-- Organization
------------------------------------------------------------------------------
INSERT INTO organizations (id, name, coc_code, city, state)
VALUES (
  '00000000-0000-0000-0000-000000000600',
  'Miami-Dade County Homeless Trust',
  'FL-600',
  'Miami',
  'FL'
)
ON CONFLICT (coc_code) DO UPDATE
  SET name = EXCLUDED.name,
      city = EXCLUDED.city,
      state = EXCLUDED.state;

------------------------------------------------------------------------------
-- Zone templates (org_id = NULL marks these as global / preloaded library)
------------------------------------------------------------------------------

-- Helper: re-seedable by name. We DELETE then INSERT for simplicity; safe to
-- run multiple times because nothing FKs into zone_templates except zones,
-- and zones.template_id is ON DELETE SET NULL.
DELETE FROM zone_templates WHERE org_id IS NULL AND name IN (
  'Downtown Miami',
  'Miami Beach',
  'North Miami-Dade',
  'South Dade',
  'Unincorporated Miami-Dade',
  'Hialeah',
  'Homestead/Florida City',
  'Key Biscayne/Coconut Grove'
);

INSERT INTO zone_templates (name, geometry, default_color, org_id) VALUES
-- Downtown Miami — approx. rectangle around Brickell + CBD
('Downtown Miami',
 ST_GeomFromGeoJSON('{
   "type":"Polygon",
   "coordinates":[[
     [-80.2050, 25.7550],
     [-80.1800, 25.7550],
     [-80.1800, 25.7850],
     [-80.2050, 25.7850],
     [-80.2050, 25.7550]
   ]]
 }'),
 '#22C55E', NULL),

-- Miami Beach — South Beach through Mid Beach
('Miami Beach',
 ST_GeomFromGeoJSON('{
   "type":"Polygon",
   "coordinates":[[
     [-80.1400, 25.7600],
     [-80.1200, 25.7600],
     [-80.1200, 25.8700],
     [-80.1400, 25.8700],
     [-80.1400, 25.7600]
   ]]
 }'),
 '#3B82F6', NULL),

-- North Miami-Dade — North Miami, NMB, Aventura corridor
('North Miami-Dade',
 ST_GeomFromGeoJSON('{
   "type":"Polygon",
   "coordinates":[[
     [-80.3000, 25.8700],
     [-80.1400, 25.8700],
     [-80.1400, 25.9800],
     [-80.3000, 25.9800],
     [-80.3000, 25.8700]
   ]]
 }'),
 '#8B5CF6', NULL),

-- South Dade — Cutler Bay south through Princeton
('South Dade',
 ST_GeomFromGeoJSON('{
   "type":"Polygon",
   "coordinates":[[
     [-80.4300, 25.4500],
     [-80.2500, 25.4500],
     [-80.2500, 25.6200],
     [-80.4300, 25.6200],
     [-80.4300, 25.4500]
   ]]
 }'),
 '#F59E0B', NULL),

-- Unincorporated Miami-Dade — broad central/west swath
('Unincorporated Miami-Dade',
 ST_GeomFromGeoJSON('{
   "type":"Polygon",
   "coordinates":[[
     [-80.4800, 25.6200],
     [-80.2050, 25.6200],
     [-80.2050, 25.8400],
     [-80.4800, 25.8400],
     [-80.4800, 25.6200]
   ]]
 }'),
 '#EC4899', NULL),

-- Hialeah
('Hialeah',
 ST_GeomFromGeoJSON('{
   "type":"Polygon",
   "coordinates":[[
     [-80.3300, 25.8400],
     [-80.2600, 25.8400],
     [-80.2600, 25.8900],
     [-80.3300, 25.8900],
     [-80.3300, 25.8400]
   ]]
 }'),
 '#14B8A6', NULL),

-- Homestead / Florida City
('Homestead/Florida City',
 ST_GeomFromGeoJSON('{
   "type":"Polygon",
   "coordinates":[[
     [-80.5000, 25.4200],
     [-80.4300, 25.4200],
     [-80.4300, 25.5000],
     [-80.5000, 25.5000],
     [-80.5000, 25.4200]
   ]]
 }'),
 '#EF4444', NULL),

-- Key Biscayne / Coconut Grove
('Key Biscayne/Coconut Grove',
 ST_GeomFromGeoJSON('{
   "type":"Polygon",
   "coordinates":[[
     [-80.2600, 25.6900],
     [-80.1400, 25.6900],
     [-80.1400, 25.7550],
     [-80.2600, 25.7550],
     [-80.2600, 25.6900]
   ]]
 }'),
 '#06B6D4', NULL);

------------------------------------------------------------------------------
-- Bootstrap note (not executed): to create your first super_admin profile,
-- create the user in Supabase Auth (Dashboard → Authentication → Users),
-- then run:
--
--   INSERT INTO profiles (id, org_id, full_name, email, role)
--   VALUES (
--     '<auth-user-id>',
--     '00000000-0000-0000-0000-000000000600',
--     'Your Name',
--     'you@example.org',
--     'super_admin'
--   );
------------------------------------------------------------------------------

