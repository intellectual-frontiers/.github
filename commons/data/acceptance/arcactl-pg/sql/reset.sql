-- Takes the UAT out of the database (commons data 0001-arcactl-pg-kit FR-003): the schemas, the seal and the roles. Run by bin/reset, as a superuser:
--
--   psql -v ON_ERROR_STOP=1 -v unlock="$ARCA_UNLOCK_SECRET" -f sql/reset.sql
--
-- The guard refuses to drop a table of a sealed schema unless the session holds the unlock secret, so the first statement says it.
SELECT set_config('ifc.ddl_unlock', :'unlock', false);
DROP SCHEMA IF EXISTS api CASCADE;
DROP SCHEMA IF EXISTS data CASCADE;
DROP SCHEMA IF EXISTS ifc_seal CASCADE;
DROP OWNED BY uat_reader, uat_writer, uat_support, uat_operator, crm_reader, crm_writer, crm_support, crm_owner;
DROP ROLE IF EXISTS uat_reader, uat_writer, uat_support, uat_operator, crm_reader, crm_writer, crm_support, crm_owner;
SELECT set_config('ifc.ddl_unlock', '', false);
