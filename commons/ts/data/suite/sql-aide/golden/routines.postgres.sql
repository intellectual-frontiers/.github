CREATE TABLE IF NOT EXISTS "person" (
    "person_id" TEXT NOT NULL PRIMARY KEY,
    "given_name" TEXT NOT NULL,
    "family_name" TEXT NOT NULL,
    "born" DATE,
    "retired_by" TEXT
);

CREATE OR REPLACE PROCEDURE "retire_person"("id" TEXT, "by" TEXT) LANGUAGE plpgsql AS $ifc$
BEGIN
    UPDATE "person" SET "retired_by" = "retire_person"."by" WHERE "person_id" = "retire_person"."id";
    IF NOT FOUND THEN
        RAISE EXCEPTION 'no person %', "retire_person"."id";
    END IF;
END;
$ifc$;

CREATE OR REPLACE FUNCTION "families"() RETURNS TABLE ("family_name" TEXT, "people" INTEGER) LANGUAGE sql AS $ifc$
SELECT "family_name", count(*)::int FROM "person" GROUP BY 1
$ifc$;

CREATE OR REPLACE FUNCTION "family_size"("family" TEXT) RETURNS INTEGER LANGUAGE plpgsql AS $ifc$
DECLARE
    "n" INTEGER := 0;
BEGIN
    SELECT count(*) INTO "n" FROM "person" WHERE "person"."family_name" = "family_size"."family";
    IF "n" = 0 THEN
        RAISE NOTICE 'nobody is called %', "family_size"."family";
    END IF;
    RETURN "n";
END;
$ifc$;

CREATE OR REPLACE FUNCTION "born_since"("since" DATE) RETURNS SETOF "person" LANGUAGE sql STABLE AS $ifc$
SELECT * FROM "person" WHERE "person"."born" >= "born_since"."since"
$ifc$;

CREATE OR REPLACE FUNCTION "initials"("given" TEXT, "family" TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $ifc$
SELECT upper(substr("initials"."given", 1, 1) || substr("initials"."family", 1, 1))
$ifc$;
