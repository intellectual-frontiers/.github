-- Snippets for DBeaver (commons data 0001-arcactl-pg-kit FR-006). DBeaver runs in autocommit and keeps one session for each editor, so a scope you set stays
-- until you clear it or close the connection. Make the statement with arcactl (it needs the seal's key, which DBeaver never holds):
--
--   . acceptance/arcactl-pg/bin/env && arcactl scope --tenant acme
--
-- and paste what it prints here, in place of the line below. The mark in it is what the policies trust; a statement you type yourself reaches nothing.

-- 1. set the scope (paste the output of arcactl scope):
-- SELECT set_config('app.tenant', 'acme.<the mark>', false);

-- 2. what the session's scope is, and what it reaches:
SELECT current_user AS who, current_setting('app.tenant', true) AS scope_setting;
SELECT DISTINCT tenant_id FROM api.customer_account ORDER BY 1;

-- 3. clear it:
RESET app.tenant;

-- 4. things to try as a reader (each must be refused or come back empty; see the README, step 11):
-- SELECT * FROM data.customer_account;
-- INSERT INTO api.customer_account VALUES ('x', 'acme', 'X', 'active', now());
-- SELECT secret FROM ifc_seal.key;
