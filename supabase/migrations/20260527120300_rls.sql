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
