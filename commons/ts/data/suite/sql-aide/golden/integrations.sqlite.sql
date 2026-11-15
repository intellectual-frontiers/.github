-- integration kinds: rows:typescript into "kind" by upsert
DROP TABLE IF EXISTS "kinds_landing";
CREATE TABLE "kinds_landing" (
    "code" TEXT,
    "label" TEXT,
    "rank" INTEGER
);
INSERT INTO "kinds_landing" ("code", "label", "rank") VALUES
('a', 'A', 1),
('b', 'B''s', 2);
INSERT INTO "kind" ("code", "label", "rank")
SELECT "code", "label", "rank" FROM "kinds_landing" WHERE TRUE
ON CONFLICT ("code") DO UPDATE SET "label" = excluded."label", "rank" = excluded."rank";
DROP TABLE "kinds_landing";

-- integration kinds_snapshot: rows:typescript into "kind" by snapshot
DROP TABLE IF EXISTS "kinds_snapshot_landing";
CREATE TABLE "kinds_snapshot_landing" (
    "code" TEXT,
    "label" TEXT,
    "rank" INTEGER
);
INSERT INTO "kinds_snapshot_landing" ("code", "label", "rank") VALUES
('a', 'A', 1),
('b', 'B''s', 2);
INSERT INTO "kind" ("code", "label", "rank")
SELECT "code", "label", "rank" FROM "kinds_snapshot_landing" WHERE TRUE
ON CONFLICT ("code") DO UPDATE SET "label" = excluded."label", "rank" = excluded."rank";
DELETE FROM "kind" WHERE NOT EXISTS (SELECT 1 FROM "kinds_snapshot_landing" AS l WHERE l."code" = "kind"."code");
DROP TABLE "kinds_snapshot_landing";

-- integration events: rows:typescript into "event_log" by replace
DROP TABLE IF EXISTS "events_landing";
CREATE TABLE "events_landing" (
    "what" TEXT,
    "seen" INTEGER
);
INSERT INTO "events_landing" ("what", "seen") VALUES
('start', 1);
DELETE FROM "event_log";
INSERT INTO "event_log" ("what", "seen")
SELECT "what", "seen" FROM "events_landing";
DROP TABLE "events_landing";

-- integration kinds_db: attached:data/old.db#kind into "kind" by upsert
DROP TABLE IF EXISTS "kinds_db_landing";
CREATE TABLE "kinds_db_landing" (
    "code" TEXT,
    "label" TEXT
);
ATTACH DATABASE 'data/old.db' AS "kinds_db_source";
INSERT INTO "kinds_db_landing" ("code", "label") SELECT "code", "label" FROM "kinds_db_source"."kind";
DETACH DATABASE "kinds_db_source";
INSERT INTO "kind" ("code", "label")
SELECT "code", "label" FROM "kinds_db_landing" WHERE TRUE
ON CONFLICT ("code") DO UPDATE SET "label" = excluded."label";
DROP TABLE "kinds_db_landing";
