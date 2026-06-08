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
