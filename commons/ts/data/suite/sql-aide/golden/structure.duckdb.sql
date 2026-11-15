CREATE TABLE IF NOT EXISTS "author" (
    "author_id" VARCHAR NOT NULL PRIMARY KEY,
    "name" VARCHAR NOT NULL,
    "retired_at" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS "book" (
    "book_id" VARCHAR NOT NULL PRIMARY KEY,
    "author_id" VARCHAR NOT NULL,
    "title" VARCHAR NOT NULL,
    "pages" INTEGER NOT NULL,
    "published_on" DATE,
    CONSTRAINT "book_author_id_fk" FOREIGN KEY ("author_id") REFERENCES "author" ("author_id")
);

CREATE OR REPLACE VIEW "long_book" ("title", "author", "pages") AS
SELECT "book"."title", "author"."name", "book"."pages"
  FROM "book" JOIN "author" ON "author"."author_id" = "book"."author_id"
 WHERE "book"."pages" >= 500;
COMMENT ON VIEW "long_book" IS 'Books of five hundred pages or more, with who wrote them';

CREATE UNIQUE INDEX IF NOT EXISTS "book_title_once" ON "book" ("title");

CREATE INDEX IF NOT EXISTS "book_author_id_title_idx" ON "book" ("author_id", "title");
