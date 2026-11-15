CREATE TABLE IF NOT EXISTS "party_kind" (
    "code" VARCHAR NOT NULL PRIMARY KEY,
    "label" VARCHAR NOT NULL,
    "description" VARCHAR
);
COMMENT ON TABLE "party_kind" IS 'The kinds of party: a person or an organization';
COMMENT ON COLUMN "party_kind"."code" IS 'The code other tables point to: a short word that does not change';
COMMENT ON COLUMN "party_kind"."label" IS 'What a person is shown for the code';
COMMENT ON COLUMN "party_kind"."description" IS 'What the code means, where the label is not enough';

CREATE TABLE IF NOT EXISTS "party" (
    "party_id" VARCHAR NOT NULL PRIMARY KEY,
    "party_kind_code" VARCHAR NOT NULL,
    "display_name" VARCHAR NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR,
    "updated_at" TIMESTAMPTZ,
    "updated_by" VARCHAR,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" VARCHAR,
    CONSTRAINT "party_party_kind_code_fk" FOREIGN KEY ("party_kind_code") REFERENCES "party_kind" ("code")
);
COMMENT ON TABLE "party" IS 'A party: anyone or anything a business deals with as one, whether a person or an organization. What is true of both is here; what is true of one only is in `person` or `organization`, under the same key.';
COMMENT ON COLUMN "party"."party_id" IS 'The party''s key, a ULID the application makes.';
COMMENT ON COLUMN "party"."party_kind_code" IS 'Whether the party is a person or an organization.';
COMMENT ON COLUMN "party"."display_name" IS 'The name the party is shown by, whatever its parts are.';
COMMENT ON COLUMN "party"."created_at" IS 'When the row was made';
COMMENT ON COLUMN "party"."created_by" IS 'Who made the row';
COMMENT ON COLUMN "party"."updated_at" IS 'When the row was last changed';
COMMENT ON COLUMN "party"."updated_by" IS 'Who last changed the row';
COMMENT ON COLUMN "party"."deleted_at" IS 'When the row was marked as removed';
COMMENT ON COLUMN "party"."deleted_by" IS 'Who marked the row as removed';

CREATE TABLE IF NOT EXISTS "electronic_contact" (
    "electronic_contact_id" VARCHAR NOT NULL PRIMARY KEY,
    "party_id" VARCHAR NOT NULL,
    "medium" VARCHAR NOT NULL CHECK ("medium" IN ('email', 'telephone', 'web')),
    "address" VARCHAR NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT FALSE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR,
    "updated_at" TIMESTAMPTZ,
    "updated_by" VARCHAR,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" VARCHAR,
    CONSTRAINT "electronic_contact_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "party" ("party_id")
);
COMMENT ON TABLE "electronic_contact" IS 'A way to reach a party over a network: an email address, a telephone number, a web address.';
COMMENT ON COLUMN "electronic_contact"."electronic_contact_id" IS 'The key of the contact point.';
COMMENT ON COLUMN "electronic_contact"."party_id" IS 'The party reached this way.';
COMMENT ON COLUMN "electronic_contact"."medium" IS 'Whether this is an email address, a telephone number or a web address.';
COMMENT ON COLUMN "electronic_contact"."address" IS 'The address or number itself.';
COMMENT ON COLUMN "electronic_contact"."is_primary" IS 'Whether this is the first way to try for its medium.';
COMMENT ON COLUMN "electronic_contact"."created_at" IS 'When the row was made';
COMMENT ON COLUMN "electronic_contact"."created_by" IS 'Who made the row';
COMMENT ON COLUMN "electronic_contact"."updated_at" IS 'When the row was last changed';
COMMENT ON COLUMN "electronic_contact"."updated_by" IS 'Who last changed the row';
COMMENT ON COLUMN "electronic_contact"."deleted_at" IS 'When the row was marked as removed';
COMMENT ON COLUMN "electronic_contact"."deleted_by" IS 'Who marked the row as removed';

CREATE TABLE IF NOT EXISTS "organization" (
    "party_id" VARCHAR NOT NULL PRIMARY KEY,
    "legal_name" VARCHAR NOT NULL,
    "founded_on" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR,
    "updated_at" TIMESTAMPTZ,
    "updated_by" VARCHAR,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" VARCHAR,
    CONSTRAINT "organization_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "party" ("party_id")
);
COMMENT ON TABLE "organization" IS 'An organization: a party that is a company, an agency, a club or any other body. Its key is its party''s key.';
COMMENT ON COLUMN "organization"."party_id" IS 'The organization''s key, which is the key of its party.';
COMMENT ON COLUMN "organization"."legal_name" IS 'The name the organization is registered under.';
COMMENT ON COLUMN "organization"."founded_on" IS 'The day the organization was founded.';
COMMENT ON COLUMN "organization"."created_at" IS 'When the row was made';
COMMENT ON COLUMN "organization"."created_by" IS 'Who made the row';
COMMENT ON COLUMN "organization"."updated_at" IS 'When the row was last changed';
COMMENT ON COLUMN "organization"."updated_by" IS 'Who last changed the row';
COMMENT ON COLUMN "organization"."deleted_at" IS 'When the row was marked as removed';
COMMENT ON COLUMN "organization"."deleted_by" IS 'Who marked the row as removed';

CREATE TABLE IF NOT EXISTS "party_identifier_kind" (
    "code" VARCHAR NOT NULL PRIMARY KEY,
    "label" VARCHAR NOT NULL,
    "description" VARCHAR
);
COMMENT ON TABLE "party_identifier_kind" IS 'The kinds of identifier a party may hold';
COMMENT ON COLUMN "party_identifier_kind"."code" IS 'The code other tables point to: a short word that does not change';
COMMENT ON COLUMN "party_identifier_kind"."label" IS 'What a person is shown for the code';
COMMENT ON COLUMN "party_identifier_kind"."description" IS 'What the code means, where the label is not enough';

CREATE TABLE IF NOT EXISTS "party_identifier" (
    "party_identifier_id" VARCHAR NOT NULL PRIMARY KEY,
    "party_id" VARCHAR NOT NULL,
    "party_identifier_kind_code" VARCHAR NOT NULL,
    "identifier" VARCHAR NOT NULL,
    "issued_by" VARCHAR,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR,
    "updated_at" TIMESTAMPTZ,
    "updated_by" VARCHAR,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" VARCHAR,
    CONSTRAINT "party_identifier_party_id_party_identifier_kind_code_uq" UNIQUE ("party_id", "party_identifier_kind_code"),
    CONSTRAINT "party_identifier_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "party" ("party_id"),
    CONSTRAINT "party_identifier_party_identifier_kind_code_fk" FOREIGN KEY ("party_identifier_kind_code") REFERENCES "party_identifier_kind" ("code")
);
COMMENT ON TABLE "party_identifier" IS 'An identifier a party holds, as someone else issued it: a tax number, a passport number. A party holds one of a kind once.';
COMMENT ON COLUMN "party_identifier"."party_identifier_id" IS 'The key of the identifier as Arca keeps it.';
COMMENT ON COLUMN "party_identifier"."party_id" IS 'The party who holds the identifier.';
COMMENT ON COLUMN "party_identifier"."party_identifier_kind_code" IS 'The kind of identifier.';
COMMENT ON COLUMN "party_identifier"."identifier" IS 'The identifier itself, as it was issued.';
COMMENT ON COLUMN "party_identifier"."issued_by" IS 'Who issued the identifier.';
COMMENT ON COLUMN "party_identifier"."created_at" IS 'When the row was made';
COMMENT ON COLUMN "party_identifier"."created_by" IS 'Who made the row';
COMMENT ON COLUMN "party_identifier"."updated_at" IS 'When the row was last changed';
COMMENT ON COLUMN "party_identifier"."updated_by" IS 'Who last changed the row';
COMMENT ON COLUMN "party_identifier"."deleted_at" IS 'When the row was marked as removed';
COMMENT ON COLUMN "party_identifier"."deleted_by" IS 'Who marked the row as removed';

CREATE TABLE IF NOT EXISTS "party_relation_kind" (
    "code" VARCHAR NOT NULL PRIMARY KEY,
    "label" VARCHAR NOT NULL,
    "description" VARCHAR
);
COMMENT ON TABLE "party_relation_kind" IS 'The ways one party may be related to another';
COMMENT ON COLUMN "party_relation_kind"."code" IS 'The code other tables point to: a short word that does not change';
COMMENT ON COLUMN "party_relation_kind"."label" IS 'What a person is shown for the code';
COMMENT ON COLUMN "party_relation_kind"."description" IS 'What the code means, where the label is not enough';

CREATE TABLE IF NOT EXISTS "party_relation" (
    "party_relation_id" VARCHAR NOT NULL PRIMARY KEY,
    "from_party_id" VARCHAR NOT NULL,
    "to_party_id" VARCHAR NOT NULL,
    "party_relation_kind_code" VARCHAR NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR,
    "updated_at" TIMESTAMPTZ,
    "updated_by" VARCHAR,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" VARCHAR,
    CONSTRAINT "party_relation_from_party_id_fk" FOREIGN KEY ("from_party_id") REFERENCES "party" ("party_id"),
    CONSTRAINT "party_relation_to_party_id_fk" FOREIGN KEY ("to_party_id") REFERENCES "party" ("party_id"),
    CONSTRAINT "party_relation_party_relation_kind_code_fk" FOREIGN KEY ("party_relation_kind_code") REFERENCES "party_relation_kind" ("code"),
    CONSTRAINT "party_relation_parties_differ_ck" CHECK ("from_party_id" <> "to_party_id")
);
COMMENT ON TABLE "party_relation" IS 'A relation between two parties for a time, read from the first to the second: Ada is employed by Analytical Engines.';
COMMENT ON COLUMN "party_relation"."party_relation_id" IS 'The key of the relation.';
COMMENT ON COLUMN "party_relation"."from_party_id" IS 'The party the relation is read from.';
COMMENT ON COLUMN "party_relation"."to_party_id" IS 'The party the relation is read to.';
COMMENT ON COLUMN "party_relation"."party_relation_kind_code" IS 'The way the first party is related to the second.';
COMMENT ON COLUMN "party_relation"."valid_from" IS 'The first day the relation held.';
COMMENT ON COLUMN "party_relation"."valid_to" IS 'The last day the relation held; empty while it still does.';
COMMENT ON COLUMN "party_relation"."created_at" IS 'When the row was made';
COMMENT ON COLUMN "party_relation"."created_by" IS 'Who made the row';
COMMENT ON COLUMN "party_relation"."updated_at" IS 'When the row was last changed';
COMMENT ON COLUMN "party_relation"."updated_by" IS 'Who last changed the row';
COMMENT ON COLUMN "party_relation"."deleted_at" IS 'When the row was marked as removed';
COMMENT ON COLUMN "party_relation"."deleted_by" IS 'Who marked the row as removed';

CREATE TABLE IF NOT EXISTS "party_role_kind" (
    "code" VARCHAR NOT NULL PRIMARY KEY,
    "label" VARCHAR NOT NULL,
    "description" VARCHAR
);
COMMENT ON TABLE "party_role_kind" IS 'The roles a party may play, such as customer, supplier or employee';
COMMENT ON COLUMN "party_role_kind"."code" IS 'The code other tables point to: a short word that does not change';
COMMENT ON COLUMN "party_role_kind"."label" IS 'What a person is shown for the code';
COMMENT ON COLUMN "party_role_kind"."description" IS 'What the code means, where the label is not enough';

CREATE TABLE IF NOT EXISTS "party_role" (
    "party_role_id" VARCHAR NOT NULL PRIMARY KEY,
    "party_id" VARCHAR NOT NULL,
    "party_role_kind_code" VARCHAR NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR,
    "updated_at" TIMESTAMPTZ,
    "updated_by" VARCHAR,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" VARCHAR,
    CONSTRAINT "party_role_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "party" ("party_id"),
    CONSTRAINT "party_role_party_role_kind_code_fk" FOREIGN KEY ("party_role_kind_code") REFERENCES "party_role_kind" ("code")
);
COMMENT ON TABLE "party_role" IS 'A role a party plays for a time: the same party may be a customer and a supplier at once.';
COMMENT ON COLUMN "party_role"."party_role_id" IS 'The key of this playing of a role.';
COMMENT ON COLUMN "party_role"."party_id" IS 'The party who plays the role.';
COMMENT ON COLUMN "party_role"."party_role_kind_code" IS 'The role played.';
COMMENT ON COLUMN "party_role"."valid_from" IS 'The first day the party played the role.';
COMMENT ON COLUMN "party_role"."valid_to" IS 'The last day the party played the role; empty while they still do.';
COMMENT ON COLUMN "party_role"."created_at" IS 'When the row was made';
COMMENT ON COLUMN "party_role"."created_by" IS 'Who made the row';
COMMENT ON COLUMN "party_role"."updated_at" IS 'When the row was last changed';
COMMENT ON COLUMN "party_role"."updated_by" IS 'Who last changed the row';
COMMENT ON COLUMN "party_role"."deleted_at" IS 'When the row was marked as removed';
COMMENT ON COLUMN "party_role"."deleted_by" IS 'Who marked the row as removed';

CREATE TABLE IF NOT EXISTS "person" (
    "party_id" VARCHAR NOT NULL PRIMARY KEY,
    "given_name" VARCHAR NOT NULL,
    "family_name" VARCHAR NOT NULL,
    "birth_date" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR,
    "updated_at" TIMESTAMPTZ,
    "updated_by" VARCHAR,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" VARCHAR,
    CONSTRAINT "person_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "party" ("party_id")
);
COMMENT ON TABLE "person" IS 'A person: a party who is a human being. Their key is their party''s key.';
COMMENT ON COLUMN "person"."party_id" IS 'The person''s key, which is the key of their party.';
COMMENT ON COLUMN "person"."given_name" IS 'The name a person is given, as they write it.';
COMMENT ON COLUMN "person"."family_name" IS 'The name a person shares with their family, as they write it.';
COMMENT ON COLUMN "person"."birth_date" IS 'The day the person was born.';
COMMENT ON COLUMN "person"."created_at" IS 'When the row was made';
COMMENT ON COLUMN "person"."created_by" IS 'Who made the row';
COMMENT ON COLUMN "person"."updated_at" IS 'When the row was last changed';
COMMENT ON COLUMN "person"."updated_by" IS 'Who last changed the row';
COMMENT ON COLUMN "person"."deleted_at" IS 'When the row was marked as removed';
COMMENT ON COLUMN "person"."deleted_by" IS 'Who marked the row as removed';

CREATE TABLE IF NOT EXISTS "postal_address" (
    "postal_address_id" VARCHAR NOT NULL PRIMARY KEY,
    "party_id" VARCHAR NOT NULL,
    "purpose" VARCHAR NOT NULL CHECK ("purpose" IN ('home', 'work', 'billing', 'delivery')),
    "line_1" VARCHAR NOT NULL,
    "line_2" VARCHAR,
    "locality" VARCHAR NOT NULL,
    "region" VARCHAR,
    "postal_code" VARCHAR,
    "country_code" VARCHAR NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR,
    "updated_at" TIMESTAMPTZ,
    "updated_by" VARCHAR,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by" VARCHAR,
    CONSTRAINT "postal_address_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "party" ("party_id")
);
COMMENT ON TABLE "postal_address" IS 'A place a party receives post or may be visited.';
COMMENT ON COLUMN "postal_address"."postal_address_id" IS 'The key of the address.';
COMMENT ON COLUMN "postal_address"."party_id" IS 'The party found at the address.';
COMMENT ON COLUMN "postal_address"."purpose" IS 'What the address is used for: where the party lives, is billed or receives deliveries.';
COMMENT ON COLUMN "postal_address"."line_1" IS 'The first line: usually the building and the street.';
COMMENT ON COLUMN "postal_address"."line_2" IS 'The second line, where there is one.';
COMMENT ON COLUMN "postal_address"."locality" IS 'The town or city.';
COMMENT ON COLUMN "postal_address"."region" IS 'The state, province or county, where the country uses one.';
COMMENT ON COLUMN "postal_address"."postal_code" IS 'The postal code, where the country uses one.';
COMMENT ON COLUMN "postal_address"."country_code" IS 'The country, as its two-letter ISO 3166-1 code.';
COMMENT ON COLUMN "postal_address"."created_at" IS 'When the row was made';
COMMENT ON COLUMN "postal_address"."created_by" IS 'Who made the row';
COMMENT ON COLUMN "postal_address"."updated_at" IS 'When the row was last changed';
COMMENT ON COLUMN "postal_address"."updated_by" IS 'Who last changed the row';
COMMENT ON COLUMN "postal_address"."deleted_at" IS 'When the row was marked as removed';
COMMENT ON COLUMN "postal_address"."deleted_by" IS 'Who marked the row as removed';
