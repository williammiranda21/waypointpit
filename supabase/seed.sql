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
