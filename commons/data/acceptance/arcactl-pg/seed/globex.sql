-- Sample rows of the tenant globex (commons data 0071-uat-kit FR-004), written by uat_writer through the views, in the scope of globex
-- (the kit's seed script sets the scope first), so that every row is held to the policy's WITH CHECK as it is written. Each insert says ON CONFLICT DO NOTHING, so that the seed can be run again.
INSERT INTO "api"."customer_account" ("account_id", "tenant_id", "name", "status", "created_at") VALUES
  ('globex-a1', 'globex', 'Globex Industrial',  'active', '2026-02-01T09:00:00Z'),
  ('globex-a2', 'globex', 'Globex Logistics',   'on_hold', '2026-02-02T09:00:00Z') ON CONFLICT DO NOTHING;
INSERT INTO "api"."contact" ("contact_id", "tenant_id", "full_name", "email", "account_customer_account_account_id") VALUES
  ('globex-c1', 'globex', 'Globex Buyer',  'buyer@globex.example',  'globex-a1'),
  ('globex-c2', 'globex', 'Globex Finance', 'finance@globex.example', 'globex-a2') ON CONFLICT DO NOTHING;
INSERT INTO "api"."support_ticket" ("ticket_id", "tenant_id", "subject", "severity", "status", "opened_at", "account_customer_account_account_id") VALUES
  ('globex-t1', 'globex', 'Cannot log in',        'high',   'open',    '2026-03-01T10:00:00Z', 'globex-a1'),
  ('globex-t2', 'globex', 'Invoice looks wrong',  'normal', 'waiting', '2026-03-02T10:00:00Z', 'globex-a2') ON CONFLICT DO NOTHING;
INSERT INTO "api"."ticket_comment" ("comment_id", "tenant_id", "author", "body", "written_at", "ticket_support_ticket_ticket_id") VALUES
  ('globex-m1', 'globex', 'support', 'We are looking into it.', '2026-03-01T10:05:00Z', 'globex-t1') ON CONFLICT DO NOTHING;
