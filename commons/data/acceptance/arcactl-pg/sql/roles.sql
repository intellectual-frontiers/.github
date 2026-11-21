-- The roles of the UAT kit (commons data 0001-arcactl-pg-kit FR-003). Run it ONCE, as a PostgreSQL superuser, in the UAT database:
--
--   psql -v ON_ERROR_STOP=1 -v uat_password="$UAT_PASSWORD" -f sql/roles.sql
--
-- crm_owner                      owns the schemas, tables and views; nobody logs in as it. Row security is forced on it too.
-- crm_reader, crm_writer, crm_support
--                                the roles the application's grants name; nobody logs in as them.
-- uat_reader, uat_writer, uat_support, uat_operator
--                                the people of the UAT, who log in with the password you gave. None is a superuser, owns
--                                anything or bypasses row security, so row security applies to every one of them.
--
-- A UAT password is for a throw-away database: never reuse one that protects anything.
SELECT set_config('uat.password', :'uat_password', false);

DO $roles$
DECLARE
  r text;
  pw text := current_setting('uat.password');
BEGIN
  FOREACH r IN ARRAY ARRAY['crm_owner', 'crm_reader', 'crm_writer', 'crm_support'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOBYPASSRLS', r);
    END IF;
  END LOOP;
  FOREACH r IN ARRAY ARRAY['uat_reader', 'uat_writer', 'uat_support', 'uat_operator'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE', r, pw);
    ELSE
      EXECUTE format('ALTER ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS', r, pw);
    END IF;
  END LOOP;
END
$roles$;

GRANT crm_reader TO uat_reader;
GRANT crm_writer TO uat_writer;
GRANT crm_support TO uat_support;
GRANT crm_reader TO uat_operator;
SELECT set_config('uat.password', '', false);
