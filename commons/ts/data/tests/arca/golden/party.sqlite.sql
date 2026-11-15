-- The kinds of party: a person or an organization
CREATE TABLE IF NOT EXISTS "party_kind" (
    -- The code other tables point to: a short word that does not change
    "code" TEXT NOT NULL PRIMARY KEY,
    -- What a person is shown for the code
    "label" TEXT NOT NULL,
    -- What the code means, where the label is not enough
    "description" TEXT
);

-- A party: anyone or anything a business deals with as one, whether a person or an organization. What is true of both is here; what is true of one only is in `person` or `organization`, under the same key.
CREATE TABLE IF NOT EXISTS "party" (
    -- The party's key, a ULID the application makes.
    "party_id" TEXT NOT NULL PRIMARY KEY,
    -- Whether the party is a person or an organization.
    "party_kind_code" TEXT NOT NULL,
    -- The name the party is shown by, whatever its parts are.
    "display_name" TEXT NOT NULL,
    -- When the row was made
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Who made the row
    "created_by" TEXT,
    -- When the row was last changed
    "updated_at" TEXT,
    -- Who last changed the row
    "updated_by" TEXT,
    -- When the row was marked as removed
    "deleted_at" TEXT,
    -- Who marked the row as removed
    "deleted_by" TEXT,
    CONSTRAINT "party_party_kind_code_fk" FOREIGN KEY ("party_kind_code") REFERENCES "party_kind" ("code")
);

-- A way to reach a party over a network: an email address, a telephone number, a web address.
CREATE TABLE IF NOT EXISTS "electronic_contact" (
    -- The key of the contact point.
    "electronic_contact_id" TEXT NOT NULL PRIMARY KEY,
    -- The party reached this way.
    "party_id" TEXT NOT NULL,
    -- Whether this is an email address, a telephone number or a web address.
    "medium" TEXT NOT NULL CHECK ("medium" IN ('email', 'telephone', 'web')),
    -- The address or number itself.
    "address" TEXT NOT NULL,
    -- Whether this is the first way to try for its medium.
    "is_primary" INTEGER NOT NULL DEFAULT FALSE,
    -- When the row was made
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Who made the row
    "created_by" TEXT,
    -- When the row was last changed
    "updated_at" TEXT,
    -- Who last changed the row
    "updated_by" TEXT,
    -- When the row was marked as removed
    "deleted_at" TEXT,
    -- Who marked the row as removed
    "deleted_by" TEXT,
    CONSTRAINT "electronic_contact_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "party" ("party_id")
);

-- An organization: a party that is a company, an agency, a club or any other body. Its key is its party's key.
CREATE TABLE IF NOT EXISTS "organization" (
    -- The organization's key, which is the key of its party.
    "party_id" TEXT NOT NULL PRIMARY KEY,
    -- The name the organization is registered under.
    "legal_name" TEXT NOT NULL,
    -- The day the organization was founded.
    "founded_on" TEXT,
    -- When the row was made
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Who made the row
    "created_by" TEXT,
    -- When the row was last changed
    "updated_at" TEXT,
    -- Who last changed the row
    "updated_by" TEXT,
    -- When the row was marked as removed
    "deleted_at" TEXT,
    -- Who marked the row as removed
    "deleted_by" TEXT,
    CONSTRAINT "organization_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "party" ("party_id")
);

-- The kinds of identifier a party may hold
CREATE TABLE IF NOT EXISTS "party_identifier_kind" (
    -- The code other tables point to: a short word that does not change
    "code" TEXT NOT NULL PRIMARY KEY,
    -- What a person is shown for the code
    "label" TEXT NOT NULL,
    -- What the code means, where the label is not enough
    "description" TEXT
);

-- An identifier a party holds, as someone else issued it: a tax number, a passport number. A party holds one of a kind once.
CREATE TABLE IF NOT EXISTS "party_identifier" (
    -- The key of the identifier as Arca keeps it.
    "party_identifier_id" TEXT NOT NULL PRIMARY KEY,
    -- The party who holds the identifier.
    "party_id" TEXT NOT NULL,
    -- The kind of identifier.
    "party_identifier_kind_code" TEXT NOT NULL,
    -- The identifier itself, as it was issued.
    "identifier" TEXT NOT NULL,
    -- Who issued the identifier.
    "issued_by" TEXT,
    -- When the row was made
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Who made the row
    "created_by" TEXT,
    -- When the row was last changed
    "updated_at" TEXT,
    -- Who last changed the row
    "updated_by" TEXT,
    -- When the row was marked as removed
    "deleted_at" TEXT,
    -- Who marked the row as removed
    "deleted_by" TEXT,
    CONSTRAINT "party_identifier_party_id_party_identifier_kind_code_uq" UNIQUE ("party_id", "party_identifier_kind_code"),
    CONSTRAINT "party_identifier_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "party" ("party_id"),
    CONSTRAINT "party_identifier_party_identifier_kind_code_fk" FOREIGN KEY ("party_identifier_kind_code") REFERENCES "party_identifier_kind" ("code")
);

-- The ways one party may be related to another
CREATE TABLE IF NOT EXISTS "party_relation_kind" (
    -- The code other tables point to: a short word that does not change
    "code" TEXT NOT NULL PRIMARY KEY,
    -- What a person is shown for the code
    "label" TEXT NOT NULL,
    -- What the code means, where the label is not enough
    "description" TEXT
);

-- A relation between two parties for a time, read from the first to the second: Ada is employed by Analytical Engines.
CREATE TABLE IF NOT EXISTS "party_relation" (
    -- The key of the relation.
    "party_relation_id" TEXT NOT NULL PRIMARY KEY,
    -- The party the relation is read from.
    "from_party_id" TEXT NOT NULL,
    -- The party the relation is read to.
    "to_party_id" TEXT NOT NULL,
    -- The way the first party is related to the second.
    "party_relation_kind_code" TEXT NOT NULL,
    -- The first day the relation held.
    "valid_from" TEXT NOT NULL,
    -- The last day the relation held; empty while it still does.
    "valid_to" TEXT,
    -- When the row was made
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Who made the row
    "created_by" TEXT,
    -- When the row was last changed
    "updated_at" TEXT,
    -- Who last changed the row
    "updated_by" TEXT,
    -- When the row was marked as removed
    "deleted_at" TEXT,
    -- Who marked the row as removed
    "deleted_by" TEXT,
    CONSTRAINT "party_relation_from_party_id_fk" FOREIGN KEY ("from_party_id") REFERENCES "party" ("party_id"),
    CONSTRAINT "party_relation_to_party_id_fk" FOREIGN KEY ("to_party_id") REFERENCES "party" ("party_id"),
    CONSTRAINT "party_relation_party_relation_kind_code_fk" FOREIGN KEY ("party_relation_kind_code") REFERENCES "party_relation_kind" ("code"),
    CONSTRAINT "party_relation_parties_differ_ck" CHECK ("from_party_id" <> "to_party_id")
);

-- The roles a party may play, such as customer, supplier or employee
CREATE TABLE IF NOT EXISTS "party_role_kind" (
    -- The code other tables point to: a short word that does not change
    "code" TEXT NOT NULL PRIMARY KEY,
    -- What a person is shown for the code
    "label" TEXT NOT NULL,
    -- What the code means, where the label is not enough
    "description" TEXT
);

-- A role a party plays for a time: the same party may be a customer and a supplier at once.
CREATE TABLE IF NOT EXISTS "party_role" (
    -- The key of this playing of a role.
    "party_role_id" TEXT NOT NULL PRIMARY KEY,
    -- The party who plays the role.
    "party_id" TEXT NOT NULL,
    -- The role played.
    "party_role_kind_code" TEXT NOT NULL,
    -- The first day the party played the role.
    "valid_from" TEXT NOT NULL,
    -- The last day the party played the role; empty while they still do.
    "valid_to" TEXT,
    -- When the row was made
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Who made the row
    "created_by" TEXT,
    -- When the row was last changed
    "updated_at" TEXT,
    -- Who last changed the row
    "updated_by" TEXT,
    -- When the row was marked as removed
    "deleted_at" TEXT,
    -- Who marked the row as removed
    "deleted_by" TEXT,
    CONSTRAINT "party_role_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "party" ("party_id"),
    CONSTRAINT "party_role_party_role_kind_code_fk" FOREIGN KEY ("party_role_kind_code") REFERENCES "party_role_kind" ("code")
);

-- A person: a party who is a human being. Their key is their party's key.
CREATE TABLE IF NOT EXISTS "person" (
    -- The person's key, which is the key of their party.
    "party_id" TEXT NOT NULL PRIMARY KEY,
    -- The name a person is given, as they write it.
    "given_name" TEXT NOT NULL,
    -- The name a person shares with their family, as they write it.
    "family_name" TEXT NOT NULL,
    -- The day the person was born.
    "birth_date" TEXT,
    -- When the row was made
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Who made the row
    "created_by" TEXT,
    -- When the row was last changed
    "updated_at" TEXT,
    -- Who last changed the row
    "updated_by" TEXT,
    -- When the row was marked as removed
    "deleted_at" TEXT,
    -- Who marked the row as removed
    "deleted_by" TEXT,
    CONSTRAINT "person_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "party" ("party_id")
);

-- A place a party receives post or may be visited.
CREATE TABLE IF NOT EXISTS "postal_address" (
    -- The key of the address.
    "postal_address_id" TEXT NOT NULL PRIMARY KEY,
    -- The party found at the address.
    "party_id" TEXT NOT NULL,
    -- What the address is used for: where the party lives, is billed or receives deliveries.
    "purpose" TEXT NOT NULL CHECK ("purpose" IN ('home', 'work', 'billing', 'delivery')),
    -- The first line: usually the building and the street.
    "line_1" TEXT NOT NULL,
    -- The second line, where there is one.
    "line_2" TEXT,
    -- The town or city.
    "locality" TEXT NOT NULL,
    -- The state, province or county, where the country uses one.
    "region" TEXT,
    -- The postal code, where the country uses one.
    "postal_code" TEXT,
    -- The country, as its two-letter ISO 3166-1 code.
    "country_code" TEXT NOT NULL,
    -- When the row was made
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Who made the row
    "created_by" TEXT,
    -- When the row was last changed
    "updated_at" TEXT,
    -- Who last changed the row
    "updated_by" TEXT,
    -- When the row was marked as removed
    "deleted_at" TEXT,
    -- Who marked the row as removed
    "deleted_by" TEXT,
    CONSTRAINT "postal_address_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "party" ("party_id")
);
