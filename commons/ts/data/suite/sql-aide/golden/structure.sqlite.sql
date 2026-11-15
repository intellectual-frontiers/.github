CREATE TABLE IF NOT EXISTS "author" (
    "author_id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "retired_at" TEXT
);

CREATE TABLE IF NOT EXISTS "book" (
    "book_id" TEXT NOT NULL PRIMARY KEY,
    "author_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "pages" INTEGER NOT NULL,
    "published_on" TEXT,
    CONSTRAINT "book_author_id_fk" FOREIGN KEY ("author_id") REFERENCES "author" ("author_id")
);

DROP VIEW IF EXISTS "long_book";
CREATE VIEW "long_book" ("title", "author", "pages") AS
SELECT "book"."title", "author"."name", "book"."pages"
  FROM "book" JOIN "author" ON "author"."author_id" = "book"."author_id"
 WHERE "book"."pages" >= 500;

CREATE UNIQUE INDEX IF NOT EXISTS "book_title_once" ON "book" ("title");

CREATE INDEX IF NOT EXISTS "book_author_id_title_idx" ON "book" ("author_id", "title");
