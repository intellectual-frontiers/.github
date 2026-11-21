-- Sample rows of the tenant initech (commons data 0071-uat-kit FR-004), written by uat_writer through the views, in the scope of initech
-- (the kit's seed script sets the scope first), so that every row is held to the policy's WITH CHECK as it is written.
INSERT INTO "api"."customer_account" ("account_id", "tenant_id", "name", "status", "created_at") VALUES
  ('initech-a1', 'initech', 'Initech Industrial',  'active', '2026-02-01T09:00:00Z'),
  ('initech-a2', 'initech', 'Initech Logistics',   'on_hold', '2026-02-02T09:00:00Z');
INSERT INTO "api"."contact" ("contact_id", "tenant_id", "full_name", "email", "account_customer_account_account_id") VALUES
  ('initech-c1', 'initech', 'Initech Buyer',  'buyer@initech.example',  'initech-a1'),
  ('initech-c2', 'initech', 'Initech Finance', 'finance@initech.example', 'initech-a2');
INSERT INTO "api"."support_ticket" ("ticket_id", "tenant_id", "subject", "severity", "status", "opened_at", "account_customer_account_account_id") VALUES
  ('initech-t1', 'initech', 'Cannot log in',        'high',   'open',    '2026-03-01T10:00:00Z', 'initech-a1'),
  ('initech-t2', 'initech', 'Invoice looks wrong',  'normal', 'waiting', '2026-03-02T10:00:00Z', 'initech-a2');
INSERT INTO "api"."ticket_comment" ("comment_id", "tenant_id", "author", "body", "written_at", "ticket_support_ticket_ticket_id") VALUES
  ('initech-m1', 'initech', 'support', 'We are looking into it.', '2026-03-01T10:05:00Z', 'initech-t1');
