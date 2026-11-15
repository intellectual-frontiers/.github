CREATE TABLE IF NOT EXISTS "hub_order" (
    "hub_order_id" TEXT NOT NULL PRIMARY KEY,
    "order_number" TEXT NOT NULL,
    "load_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "record_source" TEXT NOT NULL,
    CONSTRAINT "hub_order_order_number_uq" UNIQUE ("order_number")
);
COMMENT ON TABLE "hub_order" IS 'Hub: the business key of order';
COMMENT ON COLUMN "hub_order"."hub_order_id" IS 'The key of the order in the vault';
COMMENT ON COLUMN "hub_order"."order_number" IS 'The number on the order';
COMMENT ON COLUMN "hub_order"."load_at" IS 'When the row was loaded';
COMMENT ON COLUMN "hub_order"."record_source" IS 'Where the row came from: the system, file or feed';

CREATE TABLE IF NOT EXISTS "hub_customer" (
    "hub_customer_id" TEXT NOT NULL PRIMARY KEY,
    "customer_number" TEXT NOT NULL,
    "load_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "record_source" TEXT NOT NULL,
    CONSTRAINT "hub_customer_customer_number_uq" UNIQUE ("customer_number")
);
COMMENT ON TABLE "hub_customer" IS 'Hub: the business key of customer';
COMMENT ON COLUMN "hub_customer"."hub_customer_id" IS 'The key of the customer in the vault';
COMMENT ON COLUMN "hub_customer"."customer_number" IS 'The number the business knows the customer by';
COMMENT ON COLUMN "hub_customer"."load_at" IS 'When the row was loaded';
COMMENT ON COLUMN "hub_customer"."record_source" IS 'Where the row came from: the system, file or feed';

CREATE TABLE IF NOT EXISTS "link_customer_order" (
    "link_customer_order_id" TEXT NOT NULL PRIMARY KEY,
    "hub_customer_id" TEXT NOT NULL,
    "hub_order_id" TEXT NOT NULL,
    "load_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "record_source" TEXT NOT NULL,
    CONSTRAINT "link_customer_order_hub_customer_id_hub_order_id_uq" UNIQUE ("hub_customer_id", "hub_order_id"),
    CONSTRAINT "link_customer_order_hub_customer_id_fk" FOREIGN KEY ("hub_customer_id") REFERENCES "hub_customer" ("hub_customer_id"),
    CONSTRAINT "link_customer_order_hub_order_id_fk" FOREIGN KEY ("hub_order_id") REFERENCES "hub_order" ("hub_order_id")
);
COMMENT ON TABLE "link_customer_order" IS 'Link: customer_order';
COMMENT ON COLUMN "link_customer_order"."link_customer_order_id" IS 'The key of this customer_order';
COMMENT ON COLUMN "link_customer_order"."hub_customer_id" IS 'The customer related';
COMMENT ON COLUMN "link_customer_order"."hub_order_id" IS 'The order related';
COMMENT ON COLUMN "link_customer_order"."load_at" IS 'When the row was loaded';
COMMENT ON COLUMN "link_customer_order"."record_source" IS 'Where the row came from: the system, file or feed';

CREATE TABLE IF NOT EXISTS "sat_order_state" (
    "sat_order_state_id" TEXT NOT NULL PRIMARY KEY,
    "hub_order_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "due" DATE,
    "load_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "record_source" TEXT NOT NULL,
    CONSTRAINT "sat_order_state_hub_order_id_fk" FOREIGN KEY ("hub_order_id") REFERENCES "hub_order" ("hub_order_id")
);
COMMENT ON TABLE "sat_order_state" IS 'Satellite: the state of order, a row for each change';
COMMENT ON COLUMN "sat_order_state"."sat_order_state_id" IS 'The key of this state of state';
COMMENT ON COLUMN "sat_order_state"."hub_order_id" IS 'The order this is known of';
COMMENT ON COLUMN "sat_order_state"."status" IS 'Where the order stands';
COMMENT ON COLUMN "sat_order_state"."due" IS 'When it is due';
COMMENT ON COLUMN "sat_order_state"."load_at" IS 'When the row was loaded';
COMMENT ON COLUMN "sat_order_state"."record_source" IS 'Where the row came from: the system, file or feed';

CREATE TABLE IF NOT EXISTS "sat_customer_contact" (
    "sat_customer_contact_id" TEXT NOT NULL PRIMARY KEY,
    "hub_customer_id" TEXT NOT NULL,
    "email" TEXT,
    "load_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "record_source" TEXT NOT NULL,
    CONSTRAINT "sat_customer_contact_hub_customer_id_fk" FOREIGN KEY ("hub_customer_id") REFERENCES "hub_customer" ("hub_customer_id")
);
COMMENT ON TABLE "sat_customer_contact" IS 'Satellite: the contact of customer, a row for each change';
COMMENT ON COLUMN "sat_customer_contact"."sat_customer_contact_id" IS 'The key of this state of contact';
COMMENT ON COLUMN "sat_customer_contact"."hub_customer_id" IS 'The customer this is known of';
COMMENT ON COLUMN "sat_customer_contact"."email" IS 'Where to write';
COMMENT ON COLUMN "sat_customer_contact"."load_at" IS 'When the row was loaded';
COMMENT ON COLUMN "sat_customer_contact"."record_source" IS 'Where the row came from: the system, file or feed';
