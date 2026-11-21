-- Sample rows of the tenant northwind (commons data 0071-uat-kit FR-004), written by uat_writer through the views, in the scope of northwind
-- (the kit's seed script sets the scope first), so that every row is held to the policy's WITH CHECK as it is written. Each insert says ON CONFLICT DO NOTHING, so that the seed can be run again.
INSERT INTO "api"."customer_account" ("account_id", "tenant_id", "name", "status", "created_at") VALUES
  ('northwind-a1', 'northwind', 'Northwind Industrial',  'active', '2026-02-01T09:00:00Z'),
  ('northwind-a2', 'northwind', 'Northwind Logistics',   'on_hold', '2026-02-02T09:00:00Z') ON CONFLICT DO NOTHING;
INSERT INTO "api"."contact" ("contact_id", "tenant_id", "full_name", "email", "account_customer_account_account_id") VALUES
  ('northwind-c1', 'northwind', 'Northwind Buyer',  'buyer@northwind.example',  'northwind-a1'),
  ('northwind-c2', 'northwind', 'Northwind Finance', 'finance@northwind.example', 'northwind-a2') ON CONFLICT DO NOTHING;
INSERT INTO "api"."support_ticket" ("ticket_id", "tenant_id", "subject", "severity", "status", "opened_at", "account_customer_account_account_id") VALUES
  ('northwind-t1', 'northwind', 'Cannot log in',        'high',   'open',    '2026-03-01T10:00:00Z', 'northwind-a1'),
  ('northwind-t2', 'northwind', 'Invoice looks wrong',  'normal', 'waiting', '2026-03-02T10:00:00Z', 'northwind-a2') ON CONFLICT DO NOTHING;
INSERT INTO "api"."ticket_comment" ("comment_id", "tenant_id", "author", "body", "written_at", "ticket_support_ticket_ticket_id") VALUES
  ('northwind-m1', 'northwind', 'support', 'We are looking into it.', '2026-03-01T10:05:00Z', 'northwind-t1') ON CONFLICT DO NOTHING;
