-- integration party_kind_reference: rows:typescript into "party_kind" by upsert
DROP TABLE IF EXISTS "party_kind_reference_landing";
CREATE TABLE "party_kind_reference_landing" (
    "code" TEXT,
    "label" TEXT,
    "description" TEXT
);
INSERT INTO "party_kind_reference_landing" ("code", "label", "description") VALUES
('person', 'Person', 'A human being'),
('organization', 'Organization', 'A company, agency, club or any other body');
INSERT INTO "party_kind" ("code", "label", "description")
SELECT "code", "label", "description" FROM "party_kind_reference_landing" WHERE TRUE
ON CONFLICT ("code") DO UPDATE SET "label" = excluded."label", "description" = excluded."description";
DROP TABLE "party_kind_reference_landing";

-- integration party_role_kind_reference: rows:typescript into "party_role_kind" by upsert
DROP TABLE IF EXISTS "party_role_kind_reference_landing";
CREATE TABLE "party_role_kind_reference_landing" (
    "code" TEXT,
    "label" TEXT,
    "description" TEXT
);
INSERT INTO "party_role_kind_reference_landing" ("code", "label", "description") VALUES
('customer', 'Customer', 'Buys from the business'),
('supplier', 'Supplier', 'Sells to the business'),
('employee', 'Employee', 'Works for the business under a contract of employment'),
('contact', 'Contact', 'Speaks for another party');
INSERT INTO "party_role_kind" ("code", "label", "description")
SELECT "code", "label", "description" FROM "party_role_kind_reference_landing" WHERE TRUE
ON CONFLICT ("code") DO UPDATE SET "label" = excluded."label", "description" = excluded."description";
DROP TABLE "party_role_kind_reference_landing";

-- integration party_relation_kind_reference: rows:typescript into "party_relation_kind" by upsert
DROP TABLE IF EXISTS "party_relation_kind_reference_landing";
CREATE TABLE "party_relation_kind_reference_landing" (
    "code" TEXT,
    "label" TEXT,
    "description" TEXT
);
INSERT INTO "party_relation_kind_reference_landing" ("code", "label", "description") VALUES
('employed_by', 'Employed by', 'A person works for an organization'),
('member_of', 'Member of', 'A party belongs to an organization'),
('subsidiary_of', 'Subsidiary of', 'An organization is controlled by another');
INSERT INTO "party_relation_kind" ("code", "label", "description")
SELECT "code", "label", "description" FROM "party_relation_kind_reference_landing" WHERE TRUE
ON CONFLICT ("code") DO UPDATE SET "label" = excluded."label", "description" = excluded."description";
DROP TABLE "party_relation_kind_reference_landing";

-- integration party_identifier_kind_reference: rows:typescript into "party_identifier_kind" by upsert
DROP TABLE IF EXISTS "party_identifier_kind_reference_landing";
CREATE TABLE "party_identifier_kind_reference_landing" (
    "code" TEXT,
    "label" TEXT,
    "description" TEXT
);
INSERT INTO "party_identifier_kind_reference_landing" ("code", "label", "description") VALUES
('tax_number', 'Tax number', 'A number a tax authority issued'),
('passport_number', 'Passport number', 'The number of a passport a state issued'),
('company_registration', 'Company registration', 'The number a register of companies issued');
INSERT INTO "party_identifier_kind" ("code", "label", "description")
SELECT "code", "label", "description" FROM "party_identifier_kind_reference_landing" WHERE TRUE
ON CONFLICT ("code") DO UPDATE SET "label" = excluded."label", "description" = excluded."description";
DROP TABLE "party_identifier_kind_reference_landing";
