INSERT INTO "hub_customer" ("hub_customer_id", "customer_number", "record_source")
SELECT DISTINCT CAST(l."customer_number" AS TEXT), l."customer_number", 'shop' FROM "shop_feed" AS l
WHERE NOT EXISTS (SELECT 1 FROM "hub_customer" AS h WHERE h."customer_number" = l."customer_number");

INSERT INTO "hub_order" ("hub_order_id", "order_number", "record_source")
SELECT DISTINCT CAST(l."order_number" AS TEXT), l."order_number", 'shop' FROM "shop_feed" AS l
WHERE NOT EXISTS (SELECT 1 FROM "hub_order" AS h WHERE h."order_number" = l."order_number");

INSERT INTO "sat_customer_contact" ("sat_customer_contact_id", "hub_customer_id", "email", "record_source")
SELECT CAST(l."customer_number" AS TEXT) || '#' || printf('%09d', (SELECT count(*) FROM "sat_customer_contact" AS c WHERE c."hub_customer_id" = CAST(l."customer_number" AS TEXT)) + 1), CAST(l."customer_number" AS TEXT), l."email", 'shop'
FROM (SELECT DISTINCT f."customer_number", f."email" FROM "shop_feed" AS f) AS l
WHERE NOT EXISTS (
    SELECT 1 FROM "sat_customer_contact" AS s
    WHERE s."hub_customer_id" = CAST(l."customer_number" AS TEXT)
      AND s."sat_customer_contact_id" = (SELECT max(m."sat_customer_contact_id") FROM "sat_customer_contact" AS m WHERE m."hub_customer_id" = CAST(l."customer_number" AS TEXT))
      AND s."email" IS NOT DISTINCT FROM l."email");

INSERT INTO "sat_order_state" ("sat_order_state_id", "hub_order_id", "status", "due", "record_source")
SELECT CAST(l."order_number" AS TEXT) || '#' || printf('%09d', (SELECT count(*) FROM "sat_order_state" AS c WHERE c."hub_order_id" = CAST(l."order_number" AS TEXT)) + 1), CAST(l."order_number" AS TEXT), l."status", l."due", 'shop'
FROM (SELECT DISTINCT f."order_number", f."status", f."due" FROM "shop_feed" AS f) AS l
WHERE NOT EXISTS (
    SELECT 1 FROM "sat_order_state" AS s
    WHERE s."hub_order_id" = CAST(l."order_number" AS TEXT)
      AND s."sat_order_state_id" = (SELECT max(m."sat_order_state_id") FROM "sat_order_state" AS m WHERE m."hub_order_id" = CAST(l."order_number" AS TEXT))
      AND s."status" IS NOT DISTINCT FROM l."status" AND s."due" IS NOT DISTINCT FROM l."due");

INSERT INTO "link_customer_order" ("link_customer_order_id", "hub_customer_id", "hub_order_id", "record_source")
SELECT DISTINCT CAST(l."customer_number" AS TEXT) || '~' || CAST(l."order_number" AS TEXT), CAST(l."customer_number" AS TEXT), CAST(l."order_number" AS TEXT), 'shop' FROM "shop_feed" AS l
WHERE NOT EXISTS (SELECT 1 FROM "link_customer_order" AS k WHERE k."hub_customer_id" = CAST(l."customer_number" AS TEXT) AND k."hub_order_id" = CAST(l."order_number" AS TEXT));
