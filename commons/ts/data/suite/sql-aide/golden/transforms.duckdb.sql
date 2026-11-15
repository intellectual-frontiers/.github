CREATE TABLE IF NOT EXISTS "customer" (
    "id" VARCHAR NOT NULL PRIMARY KEY,
    "name" VARCHAR NOT NULL,
    "region" VARCHAR NOT NULL CHECK ("region" IN ('north', 'south', 'west'))
);

CREATE TABLE IF NOT EXISTS "sale" (
    "sale_id" VARCHAR NOT NULL PRIMARY KEY,
    "customer_id" VARCHAR NOT NULL,
    "amount" INTEGER NOT NULL,
    CONSTRAINT "sale_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customer" ("id")
);

CREATE OR REPLACE VIEW "customer_sales" ("sale_id", "customer_id", "name", "amount") AS
SELECT "sale"."sale_id" AS "sale_id", "customer"."id" AS "customer_id", "customer"."name" AS "name", "sale"."amount" AS "amount" FROM "sale" JOIN "customer" ON "sale"."customer_id" = "customer"."id";

-- model regions is ephemeral: it is written in where it is read

CREATE OR REPLACE VIEW "sales_by_region" ("sale_id", "region") AS
SELECT "customer_sales"."sale_id" AS "sale_id", "regions"."region" AS "region" FROM "customer_sales" JOIN (SELECT "customer"."id" AS "id", "customer"."region" AS "region" FROM "customer") AS "regions" ON "regions"."id" = "customer_sales"."customer_id";

DROP TABLE IF EXISTS "big_sales";
CREATE TABLE "big_sales" AS
SELECT "customer_sales"."sale_id" AS "sale_id", "customer_sales"."customer_id" AS "customer_id", "customer_sales"."amount" AS "amount" FROM "customer_sales" WHERE "customer_sales"."amount" > 100;

CREATE TABLE IF NOT EXISTS "sale_log" AS
SELECT * FROM (SELECT "sale"."sale_id" AS "sale_id", "sale"."amount" AS "amount" FROM "sale") AS s WHERE 1 = 0;
INSERT INTO "sale_log" ("sale_id", "amount")
SELECT s."sale_id", s."amount" FROM (SELECT "sale"."sale_id" AS "sale_id", "sale"."amount" AS "amount" FROM "sale") AS s WHERE NOT EXISTS (SELECT 1 FROM "sale_log" AS t WHERE t."sale_id" = s."sale_id");
