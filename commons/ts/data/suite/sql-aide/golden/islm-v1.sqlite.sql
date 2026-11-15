-- ISLM plan for sqlite: 3 change(s), 0 non-idempotent

-- step table:main.account (idempotent) sha256 12608a55ee9136345c390674eeef74799d1ed6b70b651c8559e810720e09b049
CREATE TABLE IF NOT EXISTS "account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "credit" INTEGER
);

-- step index:main.account_name_idx (idempotent) sha256 77d82b25acb940794e9e04304544c145d31137d5f9c6dacc2dcfabb4b1e4d9da
CREATE INDEX IF NOT EXISTS "account_name_idx" ON "account" ("name");

-- step view:main.account_names (idempotent) sha256 ad6ec7a59c029eaa1f0a470ea8b0c71dbefb80827185a8f14e37943647a0f350
DROP VIEW IF EXISTS "account_names";
CREATE VIEW "account_names" ("name") AS
SELECT "account"."name" FROM "account";
