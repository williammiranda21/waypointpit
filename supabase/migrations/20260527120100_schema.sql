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
