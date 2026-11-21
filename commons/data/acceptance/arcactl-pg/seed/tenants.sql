-- The tenants of the UAT (commons data 0001-arcactl-pg-kit FR-004), made by the platform, never by an application role:
--
--   platform ─┬─ northwind  (a reseller) ─┬─ acme     (a business)
--             │                           └─ initech  (a business)
--             └─ globex     (a business)
--
-- Run it as the superuser of the UAT database, after the schema is applied.
INSERT INTO "data"."tenant" ("tenant_id", "kind", "slug", "display_name", "ancestry", "status", "isolation", "created_at", "parent_tenant_id") VALUES
  ('platform',  'platform', 'platform',  'The Platform',        '/platform/',                       'active', 'shared', '2026-01-01T00:00:00Z', NULL),
  ('northwind', 'reseller', 'northwind', 'Northwind Partners',  '/platform/northwind/',             'active', 'shared', '2026-01-02T00:00:00Z', 'platform'),
  ('acme',      'business', 'acme',      'Acme Corporation',    '/platform/northwind/acme/',        'active', 'shared', '2026-01-03T00:00:00Z', 'northwind'),
  ('initech',   'business', 'initech',   'Initech',             '/platform/northwind/initech/',     'active', 'shared', '2026-01-04T00:00:00Z', 'northwind'),
  ('globex',    'business', 'globex',    'Globex Corporation',  '/platform/globex/',                'active', 'shared', '2026-01-05T00:00:00Z', 'platform')
ON CONFLICT ("tenant_id") DO NOTHING;
