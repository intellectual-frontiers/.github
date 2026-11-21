CREATE TABLE Stock(item_id int, balance int);

CREATE TABLE Buy(item_id int, volume int);

INSERT INTO Buy values(10, 1000);

INSERT INTO Buy values(30, 300);

WITH initial_stocks(item_id, balance) AS (VALUES (10, 2200), (20, 1900))
MERGE INTO Stock USING initial_stocks ON FALSE
WHEN MATCHED THEN DO NOTHING
WHEN NOT MATCHED THEN INSERT VALUES (initial_stocks.item_id, initial_stocks.balance);

WITH initial_stocks(item_id, balance) AS (VALUES (10, 2200), (20, 1900))
MERGE INTO Stock USING initial_stocks USING (item_id)
WHEN NOT MATCHED THEN INSERT VALUES (item_id, initial_stocks.balance);

FROM Stock ORDER BY item_id;

MERGE INTO Stock AS s USING Buy AS b ON s.item_id = b.item_id
WHEN MATCHED THEN UPDATE SET balance = balance + b.volume
WHEN NOT MATCHED THEN INSERT VALUES (b.item_id, b.volume);

CREATE TABLE merge_distinct_target(tableticker VARCHAR NOT NULL, figi VARCHAR, cik VARCHAR, lastupdated DATE NOT NULL);

INSERT INTO merge_distinct_target VALUES ('tablepermaticker', 'old_figi', 'old_cik', DATE '2026-04-30');

MERGE INTO merge_distinct_target AS t
USING (
	SELECT 'tablepermaticker' AS tableticker, 'new_figi' AS figi, 'new_cik' AS cik, DATE '2026-05-01' AS lastupdated
	ORDER BY tableticker
) AS q
ON t.tableticker = q.tableticker
WHEN MATCHED AND t IS DISTINCT FROM q THEN UPDATE
WHEN NOT MATCHED THEN INSERT;

FROM merge_distinct_target ORDER BY tableticker;

CREATE TABLE Sale(item_id int, volume int);

INSERT INTO Sale VALUES (10, 2200);

INSERT INTO Sale VALUES (20, 1900);

MERGE INTO Stock USING Sale ON Stock.item_id = Sale.item_id
WHEN MATCHED AND Sale.volume > balance THEN ERROR
WHEN MATCHED AND Sale.volume = balance THEN DELETE
WHEN MATCHED AND TRUE THEN UPDATE SET balance = balance - Sale.volume
WHEN MATCHED THEN ERROR
WHEN NOT MATCHED THEN ERROR;

CREATE VIEW my_view AS SELECT 42 item_id;

CREATE TABLE dest (id INTEGER, val INTEGER);

CREATE TABLE src  (id INTEGER, val INTEGER);

INSERT INTO dest VALUES (1, 10);

INSERT INTO src  VALUES (1, 100), (2, 200);

MERGE INTO dest AS DBT_INTERNAL_DEST
USING src AS DBT_INTERNAL_SOURCE
    ON DBT_INTERNAL_SOURCE.id = DBT_INTERNAL_DEST.id
WHEN MATCHED THEN UPDATE SET
    "id"  = DBT_INTERNAL_SOURCE."id",
    "val" = DBT_INTERNAL_SOURCE."val"
WHEN NOT MATCHED THEN INSERT
    ("id", "val")
VALUES
    ("id", "val");

SELECT * FROM dest order by all;

DELETE FROM dest;

DELETE FROM src;

INSERT INTO dest VALUES (1, 10), (2, 20);

INSERT INTO src  VALUES (1, 100);

MERGE INTO dest AS DBT_INTERNAL_DEST
USING src AS DBT_INTERNAL_SOURCE
    ON DBT_INTERNAL_SOURCE.id = DBT_INTERNAL_DEST.id
WHEN MATCHED THEN UPDATE SET
    "id"  = DBT_INTERNAL_SOURCE."id",
    "val" = DBT_INTERNAL_SOURCE."val"
WHEN NOT MATCHED BY SOURCE THEN
	UPDATE SET val=val+1;

INSERT INTO Stock VALUES (5, 10), (10, 20), (20, 30);

MERGE INTO Stock USING (VALUES (5, 20), (10, 30)) new_accounts(item_id, balance) USING (item_id)
WHEN MATCHED THEN UPDATE
WHEN NOT MATCHED BY TARGET THEN INSERT
WHEN NOT MATCHED BY SOURCE THEN DELETE;

FROM Stock ORDER BY ALL;

MERGE INTO Stock USING (VALUES (10)) new_accounts(item_id) USING (item_id)
WHEN NOT MATCHED BY SOURCE THEN DELETE;

CREATE TABLE Stock(item_id int NOT NULL, balance int, CHECK (balance>0));

MERGE INTO Stock USING (VALUES (1, 10)) new_accounts(item_id, balance) USING (item_id)
WHEN NOT MATCHED THEN INSERT VALUES (new_accounts.item_id, new_accounts.balance);

CREATE TABLE Items(item_id int NOT NULL, total_cost INTEGER, base_cost INTEGER, tax_cost INTEGER, CHECK (total_cost = base_cost + tax_cost));

INSERT INTO Items VALUES (1, 10, 8, 2);

MERGE INTO Items USING (VALUES (1, 15)) new_prices(item_id, total_cost) USING (item_id)
WHEN MATCHED THEN UPDATE SET total_cost = new_prices.total_cost, base_cost = new_prices.total_cost - 2;

FROM Items;

CREATE TABLE Stock(item_id int, balance int DEFAULT 0);

MERGE INTO Stock USING (VALUES (10)) new_accounts(item_id) USING (item_id)
WHEN NOT MATCHED THEN INSERT VALUES (new_accounts.item_id, DEFAULT);

MERGE INTO Stock USING (VALUES (20)) new_accounts(item_id) USING (item_id)
WHEN NOT MATCHED THEN INSERT (item_id) VALUES (new_accounts.item_id);

MERGE INTO Stock USING (VALUES (30)) new_accounts(item_id) USING (item_id)
WHEN NOT MATCHED THEN INSERT DEFAULT VALUES;

UPDATE Stock SET balance=100;

MERGE INTO Stock USING (VALUES (10)) reset_accounts(item_id) USING (item_id)
WHEN MATCHED THEN UPDATE SET balance=DEFAULT
WHEN NOT MATCHED THEN ERROR;

CREATE TABLE Buys(item_id int, volume int);

INSERT INTO Buys VALUES (42, 100);

MERGE INTO Stock USING Buys USING (item_id)
WHEN NOT MATCHED AND true THEN INSERT
WHEN NOT MATCHED AND error('this should not be executed') THEN INSERT
WHEN NOT MATCHED THEN ERROR;

SELECT COUNT(*) FROM Stock;

FROM Stock;

SET threads=4;

CREATE TABLE target(i INTEGER);

CREATE TABLE source AS SELECT i::INTEGER AS i FROM range(200000) t(i);

EXPLAIN ANALYZE MERGE INTO target USING (SELECT 1 i) s ON target.i = s.i WHEN NOT MATCHED THEN INSERT VALUES (s.i);

EXPLAIN ANALYZE MERGE INTO target USING source AS s ON target.i = s.i WHEN NOT MATCHED THEN INSERT VALUES (s.i);

SELECT count(*) FROM target;

CREATE TABLE Accounts(id INTEGER, username VARCHAR PRIMARY KEY, favorite_numbers INT[]);

INSERT INTO Accounts VALUES (1, 'user1', NULL);

MERGE INTO Accounts USING (
	VALUES (1, 'user2', [1, 2, 3])
) new_account(id) USING (id)
WHEN MATCHED THEN UPDATE
WHEN NOT MATCHED THEN INSERT;

FROM Accounts WHERE username='user2';

MERGE INTO Stock USING (VALUES (5, 10)) new_accounts(item_id, balance) USING (item_id)
WHEN NOT MATCHED THEN INSERT *;

MERGE INTO Stock USING (VALUES (6, 12)) new_accounts(item_id, balance) USING (item_id)
WHEN NOT MATCHED THEN INSERT;

MERGE INTO Stock USING (VALUES (0, 7)) new_accounts(balance, item_id) USING (item_id)
WHEN NOT MATCHED THEN INSERT BY NAME;

MERGE INTO Stock USING (VALUES (12)) new_accounts(item_id) USING (item_id)
WHEN NOT MATCHED THEN INSERT BY NAME;

CREATE TABLE t AS SELECT range a FROM generate_series(0,9) t(range);

CREATE TABLE v0 (v1 INTEGER PRIMARY KEY);

CREATE TABLE target(id INT PRIMARY KEY, val INT);

INSERT INTO target VALUES (1, 10);

CREATE TABLE target2(id INT PRIMARY KEY, val INT);

INSERT INTO target2 VALUES (1, 10), (2, 20);

CREATE TABLE target3(id INT PRIMARY KEY, val INT);

INSERT INTO target3 VALUES (1, 10), (2, 20), (3, 30);

CREATE TABLE target4(id INT PRIMARY KEY, val INT);

INSERT INTO target4 VALUES (1, 10);

CREATE TABLE target5(id INT PRIMARY KEY, val INT);

MERGE INTO target5 AS t
USING (VALUES (1, 100)) AS s(id, val)
ON t.id = s.id
WHEN NOT MATCHED BY TARGET THEN INSERT VALUES (s.id, s.val);

SELECT * FROM target5;

CREATE TABLE target6(id INT PRIMARY KEY, val INT);

INSERT INTO target6 VALUES (1, 10), (2, 20);

MERGE INTO target6 AS t
USING (VALUES (1, 99)) AS s(id, val)
ON t.id = s.id
WHEN MATCHED THEN DO NOTHING
WHEN NOT MATCHED BY SOURCE THEN UPDATE SET val = t.val + 1;

SELECT * FROM target6 ORDER BY id;

CREATE TABLE target7(id INT PRIMARY KEY, val INT);

INSERT INTO target7 VALUES (1, 10);

MERGE INTO target7 AS t
USING (VALUES (1, 99)) AS s(id, val)
ON t.id = s.id
WHEN MATCHED THEN UPDATE SET val = t.val + s.val;

SELECT * FROM target7;

create table foo (bar integer);

insert into foo values (1);

merge into foo as f using (select 2 as bar) b on f.bar is not null when matched then update when not matched then insert;

FROM foo;

create or replace table aaa (id int, status varchar, flag int, starttime datetime, endtime datetime);

merge into aaa
    using (
    	select 	1 as id, 'xx' as status, 1 as flag, now() as starttime, null as endtime
    ) as upserts
    on  (upserts.id = aaa.id and aaa.flag =1::int and aaa.status = upserts.status)
    when matched then
        update set endtime = upserts.starttime
    when not matched then
        insert by name;

CREATE TABLE Entry(type varchar, number int, text varchar, country VARCHAR, date DATE);

INSERT INTO Entry VALUES
	('number', 50, NULL, NULL, NULL),
	('text', NULL, 'Hello', NULL, NULL),
	('country', NULL, NULL, 'Netherlands', NULL),
	('date', NULL, NULL, NULL, DATE '2000-01-01');

CREATE TABLE NewEntry(type varchar, number int, text varchar, country VARCHAR, date DATE);

INSERT INTO NewEntry VALUES
	('number', 100, NULL, NULL, NULL),
	('text', NULL, 'World', NULL, NULL),
	('country', NULL, NULL, 'Germany', NULL),
	('date', NULL, NULL, NULL, DATE '2010-01-01');

MERGE INTO Entry USING NewEntry ON Entry.type=NewEntry.type
WHEN MATCHED AND Entry.type='number' THEN UPDATE SET number=NewEntry.number
WHEN MATCHED AND Entry.type='text' THEN UPDATE SET text=NewEntry.text
WHEN MATCHED AND Entry.type='country' THEN UPDATE SET country=NewEntry.country
WHEN MATCHED AND Entry.type='date' THEN UPDATE SET date=NewEntry.date
WHEN MATCHED THEN ERROR;

FROM Entry ORDER BY type;

CREATE TABLE my_timeseries (ts TIMESTAMP, x DOUBLE PRECISION, y DOUBLE PRECISION);

insert into my_timeseries VALUES ('2025-09-15', 43, 39);

CREATE TABLE my_timeseries_new (ts TIMESTAMP, x DOUBLE PRECISION, y DOUBLE PRECISION);

insert into my_timeseries_new VALUES ('2025-09-15', 43, 39);

MERGE INTO my_timeseries old
    USING my_timeseries_new new
    ON (
        old.x = new.x AND
         (  old.ts != new.ts
            OR old.x = 1
        )
    )
WHEN MATCHED THEN UPDATE;

MERGE INTO my_timeseries old
    USING my_timeseries_new new
    USING(ts)
WHEN MATCHED AND (
    old.x  IS DISTINCT FROM new.y
) THEN UPDATE;

CREATE TABLE stock(item_id INTEGER, balance INTEGER);

INSERT INTO stock VALUES (10, 2200), (20, 1900);

CREATE TABLE buy(item_id INTEGER, volume INTEGER);

INSERT INTO buy VALUES (10, 1000), (30, 300);

EXPLAIN MERGE INTO stock USING buy ON stock.item_id = buy.item_id
WHEN MATCHED THEN UPDATE SET balance = balance + buy.volume
WHEN NOT MATCHED THEN INSERT VALUES (buy.item_id, buy.volume);

EXPLAIN ANALYZE MERGE INTO stock USING buy ON stock.item_id = buy.item_id
WHEN MATCHED THEN UPDATE SET balance = balance + buy.volume
WHEN NOT MATCHED THEN INSERT VALUES (buy.item_id, buy.volume);

SELECT * FROM stock;

EXPLAIN MERGE INTO stock USING buy ON stock.item_id = buy.item_id
WHEN MATCHED THEN DO NOTHING;

MERGE INTO stock USING buy ON stock.item_id = buy.item_id
WHEN MATCHED THEN DO NOTHING;

EXPLAIN MERGE INTO stock USING buy ON stock.item_id = buy.item_id
WHEN MATCHED THEN UPDATE SET balance = balance + buy.volume
WHEN NOT MATCHED THEN INSERT VALUES (buy.item_id, buy.volume)
RETURNING merge_action, *;

MERGE INTO stock USING buy ON stock.item_id = buy.item_id
WHEN MATCHED THEN UPDATE SET balance = balance + buy.volume
WHEN NOT MATCHED THEN INSERT VALUES (buy.item_id, buy.volume)
RETURNING merge_action, *;

MERGE INTO stock USING buy ON stock.item_id = buy.item_id
WHEN MATCHED THEN DO NOTHING
RETURNING *;

WITH initial_stocks(item_id, balance) AS (VALUES (10, 2200), (20, 1900))
MERGE INTO Stock USING initial_stocks ON FALSE
WHEN MATCHED THEN DO NOTHING
WHEN NOT MATCHED THEN INSERT VALUES (initial_stocks.item_id, initial_stocks.balance)
RETURNING merge_action, *;

WITH initial_stocks(item_id, balance) AS (VALUES (10, 2200), (20, 1900))
MERGE INTO Stock USING initial_stocks ON (Stock.item_id = initial_stocks.item_id)
WHEN NOT MATCHED THEN INSERT VALUES (initial_stocks.item_id, initial_stocks.balance)
RETURNING *;

MERGE INTO Stock AS s USING Buy AS b ON s.item_id = b.item_id
WHEN MATCHED THEN UPDATE SET balance = balance + b.volume
WHEN NOT MATCHED THEN INSERT VALUES (b.item_id, b.volume)
RETURNING *, merge_action;

MERGE INTO Stock USING Sale ON Stock.item_id = Sale.item_id
WHEN MATCHED AND Sale.volume > balance THEN ERROR
WHEN MATCHED AND Sale.volume = balance THEN DELETE
WHEN MATCHED AND TRUE THEN UPDATE SET balance = balance - Sale.volume
WHEN MATCHED THEN ERROR
WHEN NOT MATCHED THEN ERROR
RETURNING Stock.item_id, merge_action, Stock.balance;

WITH deleted_stocks(item_id) AS (VALUES (30))
MERGE INTO Stock USING deleted_stocks ON Stock.item_id = deleted_stocks.item_id
WHEN MATCHED THEN DELETE
RETURNING *, merge_action;

PRAGMA disable_optimizer;

CREATE TABLE t(i INTEGER);

CREATE TABLE u(i INTEGER);

EXPLAIN MERGE INTO t USING (SELECT 1 AS i) AS s ON t.i=s.i WHEN MATCHED THEN DELETE RETURNING i;

EXPLAIN MERGE INTO t USING (SELECT 1 AS i) AS s ON t.i=s.i WHEN MATCHED THEN UPDATE SET i=2 RETURNING i;

EXPLAIN MERGE INTO t USING (SELECT 1 AS i) AS s ON t.i=s.i WHEN NOT MATCHED THEN INSERT VALUES (s.i) RETURNING i;

EXPLAIN MERGE INTO t USING (SELECT 1 AS i) AS s ON t.i=s.i WHEN MATCHED THEN DO NOTHING RETURNING i;

EXPLAIN MERGE INTO t USING u ON t.i=u.i WHEN MATCHED THEN DELETE RETURNING *;

EXPLAIN ANALYZE MERGE INTO t USING (SELECT 1 AS i) AS s ON t.i=s.i WHEN MATCHED THEN DELETE RETURNING i;

INSERT INTO t VALUES (1), (2);

MERGE INTO t USING (SELECT 1 AS i) AS s ON t.i=s.i WHEN MATCHED THEN DELETE RETURNING i, merge_action;

SELECT * FROM t;

CREATE TABLE Totals(item_id int, balance int);

INSERT INTO Buy values(10, 1000), (30, 300), (20, 2000);

MERGE INTO Totals USING (VALUES (10), (30)) Updates(item_id) ON Totals.item_id = Updates.item_id
WHEN MATCHED THEN UPDATE SET balance = (SELECT SUM(volume) FROM Buy WHERE item_id=Totals.item_id)
WHEN NOT MATCHED THEN INSERT VALUES (Updates.item_id, (SELECT SUM(volume) FROM Buy WHERE item_id=Updates.item_id));

FROM Totals ORDER BY ALL;

INSERT INTO Buy values(10, 2000);

MERGE INTO Totals USING (VALUES (10), (20)) Updates(item_id) ON Totals.item_id = Updates.item_id
WHEN MATCHED THEN UPDATE SET balance = (SELECT SUM(volume) FROM Buy WHERE item_id=Totals.item_id)
WHEN NOT MATCHED THEN INSERT VALUES (Updates.item_id, (SELECT SUM(volume) FROM Buy WHERE item_id=Updates.item_id));

CREATE TABLE Totals(item_id int, balance int, biggest_item BOOL);

MERGE INTO Totals USING Buy USING (item_id)
WHEN NOT MATCHED AND Buy.volume = (SELECT MAX(Volume) FROM Buy)
	THEN INSERT VALUES (Buy.item_id, Buy.volume, true)
WHEN NOT MATCHED
	THEN INSERT VALUES (Buy.item_id, Buy.volume, false);

SELECT * FROM Totals ORDER BY item_id;

CREATE TABLE dummy_edge(id INTEGER, ref_id INTEGER, "value" VARCHAR, note VARCHAR);

CREATE TABLE dummy_user(user_id INTEGER, "name" VARCHAR, email VARCHAR, created_at DATE);

CREATE TABLE dummy_null(id INTEGER, "value" INTEGER, optional_text VARCHAR);

MERGE INTO main.dummy_edge as target_0
USING dummy_user as ref_0
ON target_0.note = ref_0.name
WHEN NOT MATCHED AND EXISTS (
  SELECT id FROM main.dummy_null WHERE true
) THEN DO NOTHING;

INSERT INTO target VALUES (1, 10), (2, 20);

MERGE INTO target AS t
USING (VALUES (1, 99)) AS s(id, val)
ON t.id = s.id AND t.val > (SELECT 5)
WHEN MATCHED THEN UPDATE SET val = s.val;

FROM target ORDER BY id;

CREATE TABLE t2(k INTEGER, w INTEGER, v VARCHAR);

INSERT INTO t2 VALUES (5, 7, 'a'), (6, 8, 'b');

CREATE TABLE t3(id INTEGER);

INSERT INTO t3 VALUES (7);

MERGE INTO t2 USING (SELECT 5 AS k) sq ON t2.k = sq.k AND t2.w = (SELECT max(id) FROM t3) WHEN MATCHED THEN DELETE RETURNING *;

SELECT * FROM t2;

MERGE INTO t2 USING (SELECT 6 AS k) sq ON t2.k = sq.k AND t2.w IN (SELECT 8) WHEN MATCHED THEN DELETE WHEN NOT MATCHED BY SOURCE THEN DELETE RETURNING *;

MERGE INTO t2 USING (SELECT 5 AS k) sq ON t2.k = sq.k AND t2.w = (SELECT max(id) FROM t3) WHEN MATCHED THEN DELETE WHEN NOT MATCHED BY TARGET THEN INSERT VALUES (sq.k, 0, 'c') RETURNING *;

SELECT * FROM t2 ORDER BY ALL;

CREATE TABLE p(k INTEGER PRIMARY KEY, w INTEGER);

INSERT INTO p VALUES (1, 5), (2, 6);

CREATE TABLE s(id INTEGER);

INSERT INTO s VALUES (5);

BEGIN;

MERGE INTO p USING (SELECT 1 AS k) sq ON p.k = sq.k AND p.w = (SELECT max(id) FROM s) WHEN MATCHED THEN DELETE;

INSERT INTO p VALUES (1, 9);

COMMIT;

SELECT * FROM p ORDER BY k;

CREATE TABLE q(k INTEGER UNIQUE, w INTEGER);

INSERT INTO q VALUES (1, 1);

MERGE INTO q USING (SELECT 1 AS k) sq ON q.k = sq.k AND q.k IN (SELECT 1) WHEN MATCHED THEN DELETE;

SELECT count(*) FROM q;

CREATE TABLE people (id INTEGER, name VARCHAR, salary FLOAT);

INSERT INTO people VALUES (1, 'John', 92_000.0), (2, 'Anna', 100_000.0);

INSERT INTO Stock (item_id) VALUES (5), (10), (20);

MERGE INTO Stock USING (VALUES (5, 10)) new_accounts(item_id) USING (item_id)
WHEN MATCHED THEN UPDATE;

MERGE INTO Stock USING (VALUES (10, 30)) new_accounts(item_id, balance) USING (item_id)
WHEN MATCHED THEN UPDATE SET *;

MERGE INTO Stock USING (VALUES (100, 20)) new_accounts(balance, item_id) USING (item_id)
WHEN MATCHED THEN UPDATE BY NAME;

CREATE OR REPLACE TABLE Stock(item_id int, balance int);

INSERT INTO Stock VALUES (5, 10), (10, 20), (15, 30);

MERGE INTO Stock USING (VALUES (5)) new_accounts(item_id) USING (item_id)
WHEN NOT MATCHED BY SOURCE AND balance = 30 THEN UPDATE SET balance = 0
RETURNING merge_action, item_id;

MERGE INTO Stock USING (VALUES (5, 1)) new_accounts(item_id, delta) USING (item_id)
WHEN MATCHED THEN UPDATE SET balance = balance + delta
WHEN NOT MATCHED BY SOURCE AND item_id = 10 THEN DELETE
RETURNING merge_action, item_id;

MERGE INTO Stock USING (VALUES (5)) new_accounts(item_id)
ON (Stock.item_id = new_accounts.item_id AND Stock.balance IN (SELECT 11))
WHEN NOT MATCHED BY SOURCE THEN UPDATE SET balance = balance + 100;

MERGE INTO Stock USING (VALUES (5)) new_accounts(item_id) USING (item_id)
WHEN NOT MATCHED BY SOURCE THEN DELETE;

CREATE TRIGGER insert_after AFTER INSERT ON people FOR EACH STATEMENT
MERGE INTO people
    USING (
        SELECT
            unnest([3, 1]) AS id,
            unnest(['Sarah', 'John']) AS name,
            unnest([95_000.0, 105_000.0]) AS salary
    ) AS upserts
    ON (upserts.id = people.id)
    WHEN MATCHED THEN UPDATE
    WHEN NOT MATCHED THEN INSERT;

FROM people;

INSERT INTO people VALUES (4, 'Mike', 80_000.0);

CREATE TABLE accounts (id INTEGER, balance INTEGER);

CREATE TABLE account_summary (id INTEGER, balance INTEGER, last_change INTEGER);

CREATE TRIGGER sync_summary AFTER INSERT ON accounts
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT
MERGE INTO account_summary
    USING new_rows ON (account_summary.id = new_rows.id)
    WHEN MATCHED THEN UPDATE SET balance = new_rows.balance, last_change = new_rows.balance
    WHEN NOT MATCHED THEN INSERT (id, balance, last_change) VALUES (new_rows.id, new_rows.balance, new_rows.balance);

INSERT INTO accounts VALUES (1, 100), (2, 200);

SELECT id, balance, last_change FROM account_summary;

INSERT INTO accounts VALUES (1, 150), (3, 300);

CREATE TABLE pending (id INTEGER);

CREATE TABLE processed (id INTEGER);

INSERT INTO processed VALUES (1), (2), (3);

CREATE TRIGGER remove_processed AFTER INSERT ON pending
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT
MERGE INTO processed
    USING new_rows ON (processed.id = new_rows.id)
    WHEN MATCHED THEN DELETE;

INSERT INTO pending VALUES (2);

SELECT id FROM processed;

CREATE TABLE inventory (id INTEGER, qty INTEGER);

INSERT INTO inventory VALUES (1, 50), (2, 30);

CREATE TABLE inventory_log (id INTEGER, qty INTEGER);

CREATE TRIGGER log_qty_change AFTER UPDATE ON inventory
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT
MERGE INTO inventory_log
    USING new_rows ON (inventory_log.id = new_rows.id)
    WHEN MATCHED THEN UPDATE SET qty = new_rows.qty
    WHEN NOT MATCHED THEN INSERT (id, qty) VALUES (new_rows.id, new_rows.qty);

UPDATE inventory SET qty = qty - 10 WHERE id = 1;

SELECT id, qty FROM inventory_log;

UPDATE inventory SET qty = qty + 100 WHERE id = 2;

CREATE TABLE live_orders (id INTEGER, amount INTEGER);

INSERT INTO live_orders VALUES (1, 10), (2, 20), (3, 30);

CREATE TABLE archived_orders (id INTEGER, amount INTEGER);

CREATE TRIGGER archive_deleted AFTER DELETE ON live_orders
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT
MERGE INTO archived_orders
    USING old_rows ON (archived_orders.id = old_rows.id)
    WHEN NOT MATCHED THEN INSERT (id, amount) VALUES (old_rows.id, old_rows.amount);

DELETE FROM live_orders WHERE id = 2;

SELECT id, amount FROM archived_orders;

SELECT COUNT(*) FROM live_orders;

CREATE TABLE t_err_src (id INTEGER);

CREATE TABLE t_err_dst (id INTEGER);

INSERT INTO t_err_dst VALUES (1);

CREATE TRIGGER trg_merge_err AFTER INSERT ON t_err_src
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT
MERGE INTO t_err_dst
    USING new_rows ON (t_err_dst.id = new_rows.id)
    WHEN MATCHED THEN ERROR 'duplicate detected';

SELECT COUNT(*) FROM t_err_src;

CREATE TABLE has_own_trigger (id INTEGER);

CREATE TABLE has_own_trigger_log (msg VARCHAR);

CREATE TRIGGER trg_on_other AFTER INSERT ON has_own_trigger FOR EACH STATEMENT
    INSERT INTO has_own_trigger_log VALUES ('fired');

CREATE TABLE merge_source_table (id INTEGER);

CREATE TABLE row_target (id INTEGER);

CREATE TABLE row_target_2 (id INTEGER);
