-- ISLM plan for duckdb: 3 change(s), 0 non-idempotent

-- step table:main.account (idempotent) sha256 92dd9b230a6e26dcf2e465938f40beb534adc3d909ecef5bb0be81512de5e880
CREATE TABLE IF NOT EXISTS "account" (
    "id" VARCHAR NOT NULL PRIMARY KEY,
    "name" VARCHAR NOT NULL,
    "credit" INTEGER
);

-- step index:main.account_name_idx (idempotent) sha256 77d82b25acb940794e9e04304544c145d31137d5f9c6dacc2dcfabb4b1e4d9da
CREATE INDEX IF NOT EXISTS "account_name_idx" ON "account" ("name");

-- step view:main.account_names (idempotent) sha256 2e7fa8904633a9a927f63710df534c89d27640846ada2c38d141931a7535b682
CREATE OR REPLACE VIEW "account_names" ("name") AS
SELECT "account"."name" FROM "account";
