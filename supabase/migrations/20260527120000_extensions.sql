-- Waypoint PIT — Phase 2 / Migration 1
-- Extensions. PostGIS MUST be the first statement of the first migration per spec.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
