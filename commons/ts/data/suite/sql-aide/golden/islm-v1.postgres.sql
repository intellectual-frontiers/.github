-- ISLM plan for postgres: 3 change(s), 0 non-idempotent

-- step table:public.account (idempotent) sha256 12608a55ee9136345c390674eeef74799d1ed6b70b651c8559e810720e09b049
CREATE TABLE IF NOT EXISTS "account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "credit" INTEGER
);

-- step index:public.account_name_idx (idempotent) sha256 77d82b25acb940794e9e04304544c145d31137d5f9c6dacc2dcfabb4b1e4d9da
CREATE INDEX IF NOT EXISTS "account_name_idx" ON "account" ("name");

-- step view:public.account_names (idempotent) sha256 2e7fa8904633a9a927f63710df534c89d27640846ada2c38d141931a7535b682
CREATE OR REPLACE VIEW "account_names" ("name") AS
SELECT "account"."name" FROM "account";
