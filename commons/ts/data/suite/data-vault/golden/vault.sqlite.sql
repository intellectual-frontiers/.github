-- Hub: the business key of order
CREATE TABLE IF NOT EXISTS "hub_order" (
    -- The key of the order in the vault
    "hub_order_id" TEXT NOT NULL PRIMARY KEY,
    -- The number on the order
    "order_number" TEXT NOT NULL,
    -- When the row was loaded
    "load_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Where the row came from: the system, file or feed
    "record_source" TEXT NOT NULL,
    CONSTRAINT "hub_order_order_number_uq" UNIQUE ("order_number")
);

-- Hub: the business key of customer
CREATE TABLE IF NOT EXISTS "hub_customer" (
    -- The key of the customer in the vault
    "hub_customer_id" TEXT NOT NULL PRIMARY KEY,
    -- The number the business knows the customer by
    "customer_number" TEXT NOT NULL,
    -- When the row was loaded
    "load_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Where the row came from: the system, file or feed
    "record_source" TEXT NOT NULL,
    CONSTRAINT "hub_customer_customer_number_uq" UNIQUE ("customer_number")
);

-- Link: customer_order
CREATE TABLE IF NOT EXISTS "link_customer_order" (
    -- The key of this customer_order
    "link_customer_order_id" TEXT NOT NULL PRIMARY KEY,
    -- The customer related
    "hub_customer_id" TEXT NOT NULL,
    -- The order related
    "hub_order_id" TEXT NOT NULL,
    -- When the row was loaded
    "load_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Where the row came from: the system, file or feed
    "record_source" TEXT NOT NULL,
    CONSTRAINT "link_customer_order_hub_customer_id_hub_order_id_uq" UNIQUE ("hub_customer_id", "hub_order_id"),
    CONSTRAINT "link_customer_order_hub_customer_id_fk" FOREIGN KEY ("hub_customer_id") REFERENCES "hub_customer" ("hub_customer_id"),
    CONSTRAINT "link_customer_order_hub_order_id_fk" FOREIGN KEY ("hub_order_id") REFERENCES "hub_order" ("hub_order_id")
);

-- Satellite: the state of order, a row for each change
CREATE TABLE IF NOT EXISTS "sat_order_state" (
    -- The key of this state of state
    "sat_order_state_id" TEXT NOT NULL PRIMARY KEY,
    -- The order this is known of
    "hub_order_id" TEXT NOT NULL,
    -- Where the order stands
    "status" TEXT NOT NULL,
    -- When it is due
    "due" TEXT,
    -- When the row was loaded
    "load_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Where the row came from: the system, file or feed
    "record_source" TEXT NOT NULL,
    CONSTRAINT "sat_order_state_hub_order_id_fk" FOREIGN KEY ("hub_order_id") REFERENCES "hub_order" ("hub_order_id")
);

-- Satellite: the contact of customer, a row for each change
CREATE TABLE IF NOT EXISTS "sat_customer_contact" (
    -- The key of this state of contact
    "sat_customer_contact_id" TEXT NOT NULL PRIMARY KEY,
    -- The customer this is known of
    "hub_customer_id" TEXT NOT NULL,
    -- Where to write
    "email" TEXT,
    -- When the row was loaded
    "load_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Where the row came from: the system, file or feed
    "record_source" TEXT NOT NULL,
    CONSTRAINT "sat_customer_contact_hub_customer_id_fk" FOREIGN KEY ("hub_customer_id") REFERENCES "hub_customer" ("hub_customer_id")
);
