SELECT "person"."party_id" AS "id", "party"."name" AS "name", "person"."height" AS "height" FROM "person" JOIN "party" ON "person"."party_id" = "party"."party_id" ORDER BY "person"."party_id";

SELECT "party"."name" AS "name", "note"."body" AS "body" FROM "party" LEFT JOIN "note" ON "note"."about" = "party"."party_id" ORDER BY "party"."name", "note"."body";

WITH "big_people" ("id") AS (SELECT "person"."party_id" AS "id" FROM "person" WHERE ("person"."height" > 180) = TRUE) SELECT "party"."name" AS "name" FROM "big_people" JOIN "party" ON "party"."party_id" = "big_people"."id";

SELECT "party"."party_id" AS "id" FROM "party" EXCEPT SELECT "person"."party_id" AS "id" FROM "person";

INSERT INTO "kind" ("code", "label") VALUES ('person', 'Person'), ('org', 'Organization') ON CONFLICT ("code") DO UPDATE SET "label" = excluded."label";

UPDATE "person" SET "height" = "height" + 1 WHERE "person"."given" = 'Ada' RETURNING "party_id" AS "id";

DELETE FROM "note" WHERE "note"."body" = '' RETURNING "note_id" AS "id";
