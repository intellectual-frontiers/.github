CREATE TABLE t1 (id INTEGER, data VARCHAR);

CREATE TRIGGER my_trigger AFTER INSERT ON t1 INSERT INTO log_table VALUES (1);

CREATE TRIGGER del_trigger BEFORE DELETE ON t1 INSERT INTO log_table VALUES (2);

CREATE TRIGGER upd_trigger AFTER UPDATE ON t1 INSERT INTO log_table VALUES (3);

CREATE TRIGGER upd_col_trigger AFTER UPDATE OF id ON t_upd_of INSERT INTO log_table VALUES (4);

CREATE TABLE t_ifne (id INTEGER);

CREATE TRIGGER IF NOT EXISTS ifne_trigger AFTER INSERT ON t_ifne INSERT INTO log_table VALUES (1);

CREATE TABLE t_upd_body (id INTEGER);

SELECT trigger_name, sql FROM duckdb_triggers() WHERE trigger_name = 'update_body_trigger';

CREATE TRIGGER delete_body_trigger BEFORE DELETE ON t_del_body DELETE FROM log_table WHERE log_table.id = 1;

CREATE TABLE t_ins_sel (id INTEGER);

SELECT trigger_name, sql FROM duckdb_triggers() WHERE trigger_name = 'insert_select_trigger';

CREATE TABLE "t upsert" ("Two Words" INTEGER PRIMARY KEY, "V v" INTEGER, "select" INTEGER, MixedCase INTEGER);

SELECT trigger_name, sql FROM duckdb_triggers() WHERE trigger_name = 'upsert_trigger';

CREATE TRIGGER upsert_trigger AFTER INSERT ON t_upsert_src FOR EACH STATEMENT INSERT INTO "t upsert" (VALUES (1, 1, 1, 1)) ON CONFLICT ("Two Words") DO UPDATE SET "V v" = ("t upsert"."V v" + 1), "select" = excluded."select", MixedCase = 2 WHERE ("t upsert"."V v" < 10);

INSERT INTO t_upsert_src VALUES (1), (2);

SELECT * FROM "t upsert";

DROP TABLE log_table CASCADE;

CREATE TABLE my_schema.t2 (id INTEGER);

CREATE TRIGGER schema_trigger AFTER INSERT ON my_schema.t2 INSERT INTO my_schema.log2 VALUES (1);

DROP TABLE my_schema.t2 CASCADE;

DROP SCHEMA my_schema CASCADE;

CREATE TABLE b (id INTEGER);

CREATE TRIGGER same_name AFTER INSERT ON a INSERT INTO log_ab VALUES (1);

SELECT trigger_name, table_name FROM duckdb_triggers() WHERE trigger_name = 'same_name' ORDER BY table_name;

DROP TABLE a CASCADE;

DROP TABLE log_ab;

CREATE TABLE trig_cat.t_base (id INTEGER);

CREATE TRIGGER cat_qualified_trigger AFTER INSERT ON trig_cat.t_base FOR EACH STATEMENT
    INSERT INTO trig_cat.t_audit VALUES ('fired');

INSERT INTO trig_cat.t_base VALUES (1);

DROP TABLE trig_cat.t_base CASCADE;

DETACH trig_cat;

CREATE VIEW base_view AS SELECT * FROM base_tbl;

ATTACH ':memory:' AS sqlite_db (TYPE SQLITE);

CREATE TABLE sqlite_db.my_ext_audit (msg VARCHAR);

PRAGMA disable_checkpoint_on_shutdown;

CREATE TRIGGER del_trigger BEFORE DELETE ON t1 DELETE FROM log_table WHERE log_table.id = 1;

USE memory;

SELECT trigger_name, table_name, action_timing, event_manipulation FROM duckdb_triggers() WHERE database_name = 'triggerdb' ORDER BY trigger_name;

CREATE TABLE t3 (a INTEGER, b INTEGER, c INTEGER);

CREATE TRIGGER multi_col_trigger AFTER UPDATE OF b, c ON t3 INSERT INTO audit3 VALUES (1);

SELECT trigger_name, columns FROM duckdb_triggers() WHERE trigger_name = 'multi_col_trigger';

ALTER TABLE t3 RENAME COLUMN a TO a2;

CREATE TABLE audit2 (x INTEGER);

INSERT INTO t2 VALUES (0, 0);

SELECT trigger_name, columns FROM duckdb_triggers() WHERE trigger_name = 'rename_trigger';

SELECT COUNT(*) FROM audit2;

SELECT COUNT(*) FROM duckdb_triggers() WHERE trigger_name = 'my_trigger' AND table_name = 't1';

DROP TRIGGER IF EXISTS my_trigger ON t1;

CREATE TRIGGER drop_me AFTER UPDATE ON t1 INSERT INTO log_table VALUES (3);

SELECT trigger_name, table_name FROM duckdb_triggers() WHERE table_name = 't1';

SELECT COUNT(*) FROM duckdb_triggers() WHERE trigger_name = 'schema_trigger';

CREATE TABLE a (x INTEGER);

CREATE TRIGGER same_name AFTER INSERT ON a INSERT INTO log_table VALUES (1);

DROP TRIGGER same_name ON a;

DROP TRIGGER same_name ON b;

ATTACH ':memory:' AS mydb;

CREATE TABLE mydb.main.cat_log (id INTEGER);

SELECT COUNT(*) FROM duckdb_triggers() WHERE trigger_name = 'cat_trigger' AND database_name = 'mydb';

DROP TABLE mydb.main.cat_table;

DETACH mydb;

DROP TABLE a;

DROP TRIGGER IF EXISTS trg_missing ON sqlite_db.my_ext_table;

CREATE TRIGGER keep_trigger AFTER INSERT ON t1 INSERT INTO log_table VALUES (1);

DROP TRIGGER drop_trigger ON t1;

SELECT COUNT(*) FROM duckdb_triggers() WHERE trigger_name = 'drop_trigger';

CREATE TABLE u(a INT);

CREATE TRIGGER b BEFORE INSERT ON u FOR EACH STATEMENT INSERT INTO l VALUES (1);

INSERT INTO t VALUES (1);

INSERT INTO t VALUES (2), (3);

DELETE FROM t WHERE a = 1;

INSERT INTO t VALUES (4), (4);

SELECT count(*) FROM l;

CREATE TABLE audit(msg VARCHAR);

CREATE TEMPORARY TABLE tmp_audit(msg VARCHAR);

CREATE TRIGGER trg AFTER INSERT ON tmp FOR EACH STATEMENT INSERT INTO tmp_audit VALUES ('fired');

INSERT INTO tmp VALUES (1);

CREATE TRIGGER trg_persistent AFTER INSERT ON t FOR EACH STATEMENT INSERT INTO audit VALUES ('fired');

SELECT trigger_name, temporary FROM duckdb_triggers();

INSERT INTO target VALUES (1), (2), (3);

CREATE TRIGGER trg_basic AFTER DELETE ON target FOR EACH STATEMENT
    INSERT INTO audit VALUES ('deleted');

SELECT COUNT(*) FROM audit;

DELETE FROM target;

CREATE TABLE row_audit (deleted_id INTEGER);

INSERT INTO row_target VALUES (10), (20), (30);

SELECT deleted_id FROM row_audit ORDER BY deleted_id;

INSERT INTO strict_target VALUES (1);

INSERT INTO strict_log VALUES (999);

SELECT COUNT(*) FROM strict_target;

CREATE TABLE t_multi (id INTEGER);

CREATE TRIGGER trg_multi_a AFTER DELETE ON t_multi FOR EACH STATEMENT
    INSERT INTO t_multi_audit VALUES ('a');

INSERT INTO t_multi VALUES (1);

SELECT COUNT(*) FROM t_multi_audit;

INSERT INTO t_del_target VALUES (1), (2), (3);

INSERT INTO t_counter VALUES (0);

DELETE FROM t_del_target WHERE id = 1;

DELETE FROM t_del_target WHERE id = 2;

INSERT INTO t_del2_target VALUES (1);

INSERT INTO t_scratch VALUES (1), (2), (3);

DELETE FROM t_del2_target;

CREATE TABLE target (id INTEGER, val VARCHAR);

CREATE TRIGGER trg_ref AFTER DELETE ON target
REFERENCING OLD TABLE AS deleted
FOR EACH STATEMENT
    INSERT INTO audit SELECT id, val FROM deleted;

SELECT id, val FROM audit;

CREATE TABLE t_rows (id INTEGER);

CREATE TRIGGER trg_rows AFTER DELETE ON t_rows
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT
    INSERT INTO t_rows_log SELECT COUNT(*) FROM old_rows;

DELETE FROM t_rows WHERE id <= 3;

DELETE FROM t_rows WHERE id > 3;

CREATE TABLE t_agg_log (total INTEGER, cnt INTEGER);

INSERT INTO t_agg VALUES (10), (20), (30);

SELECT total, cnt FROM t_agg_log;

CREATE TABLE t_tosql_log (id INTEGER);

SELECT sql LIKE '%REFERENCING OLD TABLE AS del%' FROM duckdb_triggers() WHERE trigger_name = 'trg_tosql';

CREATE TABLE log_old_alias_shadow (s VARCHAR);

INSERT INTO t_old_alias_shadow VALUES (1);

SELECT s FROM log_old_alias_shadow;

INSERT INTO target VALUES (1);

INSERT INTO target VALUES (10), (11), (12);

CREATE TABLE multi_audit (fired_id INTEGER);

INSERT INTO multi_target VALUES (1), (2), (3);

CREATE TRIGGER trg_fail AFTER INSERT ON strict_target FOR EACH STATEMENT
    INSERT INTO strict_log VALUES (999);

CREATE TRIGGER trg_multi_b AFTER INSERT ON t_multi FOR EACH STATEMENT
    INSERT INTO t_multi_audit VALUES ('b');

CREATE TABLE t_no_fire (id INTEGER UNIQUE);

INSERT INTO t_no_fire VALUES (1);

SELECT COUNT(*) FROM t_no_fire_log;

CREATE TABLE t_zero_log (msg VARCHAR);

INSERT INTO t_zero SELECT * FROM t_zero;

CREATE TABLE t_upd_target (id INTEGER);

INSERT INTO t_upd_counter VALUES (0);

INSERT INTO t_upd_target VALUES (1);

INSERT INTO t_upd_target VALUES (2);

INSERT INTO t_del_scratch VALUES (1), (2), (3);

INSERT INTO t_del_target VALUES (99);

CREATE SCHEMA other_schema;

CREATE TABLE t_cross (id INTEGER);

INSERT INTO t_cross VALUES (1);

CREATE TABLE t_conflict (id INTEGER PRIMARY KEY);

CREATE TRIGGER trg_conflict AFTER INSERT ON t_conflict FOR EACH STATEMENT
    INSERT INTO t_conflict_log VALUES ('fired');

SELECT COUNT(*) FROM t_conflict_log;

CREATE TABLE t_upsert (id INTEGER PRIMARY KEY, val INTEGER);

CREATE TRIGGER trg_upsert AFTER INSERT ON t_upsert FOR EACH STATEMENT
    INSERT INTO t_upsert_log VALUES ('fired');

INSERT INTO t_upsert VALUES (1, 99) ON CONFLICT (id) DO UPDATE SET val = excluded.val;

SELECT COUNT(*) FROM t_upsert_log;

CREATE TABLE t_chain_b (msg VARCHAR);

CREATE TRIGGER trg_chain_b AFTER INSERT ON t_chain_b FOR EACH STATEMENT
    INSERT INTO t_chain_c VALUES ('fired from b');

INSERT INTO t_chain_a VALUES (1);

SELECT COUNT(*) FROM t_chain_c;

CREATE TABLE t_mutual_b (id INTEGER);

CREATE TABLE t_recursive (id INTEGER);

CREATE TABLE t_nn_log (msg VARCHAR);

SELECT COUNT(*) FROM t_nn_log;

CREATE TABLE t_returning_log (msg VARCHAR);

INSERT INTO t_returning VALUES (1) RETURNING id;

CREATE TABLE t_merge_source (id INTEGER, val INTEGER);

CREATE TABLE t_merge_log (msg VARCHAR);

CREATE TABLE trigger_source(i INTEGER);

INSERT INTO trigger_target VALUES (1);

WITH ins AS (INSERT INTO trigger_source VALUES (1) RETURNING i)
SELECT count(*), count(i) FROM trigger_target;

INSERT INTO target VALUES (1, 'a');

INSERT INTO target VALUES (2, 'b'), (3, 'c'), (4, 'd');

INSERT INTO t_rows VALUES (1), (2), (3);

CREATE TABLE t_plain (id INTEGER);

CREATE TRIGGER trg_plain AFTER INSERT ON t_plain FOR EACH STATEMENT
    INSERT INTO t_plain_log VALUES ('fired');

SELECT COUNT(*) FROM t_plain_log;

SELECT sql LIKE '%REFERENCING NEW TABLE AS ins%' FROM duckdb_triggers() WHERE trigger_name = 'trg_tosql';

CREATE TABLE t_conflict_log (id INTEGER);

INSERT INTO t_conflict VALUES (1), (2), (3) ON CONFLICT DO NOTHING;

CREATE TABLE t_upsert_log (id INTEGER, val INTEGER);

CREATE TRIGGER trg_upsert AFTER INSERT ON t_upsert
REFERENCING NEW TABLE AS ins
FOR EACH STATEMENT
    INSERT INTO t_upsert_log SELECT id, val FROM ins;

CREATE TABLE t_rollback_log (id INTEGER UNIQUE);

CREATE TRIGGER trg_rollback AFTER INSERT ON t_rollback
REFERENCING NEW TABLE AS ins
FOR EACH STATEMENT
    INSERT INTO t_rollback_log SELECT id FROM ins;

CREATE TABLE t_naming (id INTEGER);

CREATE TRIGGER trg_naming AFTER INSERT ON t_naming
REFERENCING NEW TABLE AS __duckdb_trigger_base
FOR EACH STATEMENT
    INSERT INTO t_naming_log SELECT id FROM __duckdb_trigger_base;

SELECT id FROM t_naming_log;

INSERT INTO __duckdb_trigger_base VALUES (999);

CREATE TABLE t_real_ref_log (id INTEGER);

INSERT INTO t_real_ref VALUES (1);

CREATE TABLE t_cte_scope (id INTEGER);

CREATE TRIGGER trg_cte_scope AFTER INSERT ON t_cte_scope
REFERENCING NEW TABLE AS ins
FOR EACH STATEMENT
    INSERT INTO t_cte_scope_log SELECT id FROM ins;

SELECT id FROM t_cte_scope_log;

CREATE TABLE log_alias_shadow (s VARCHAR);

INSERT INTO t_alias_shadow VALUES (1);

CREATE TABLE t_copy_source (i INTEGER);

CREATE TABLE t_copy (i INTEGER);

CREATE TRIGGER tr_copy AFTER INSERT ON t_copy
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT
    INSERT INTO t_copy_log SELECT i FROM new_rows;

CREATE TABLE target (id INTEGER, val INTEGER);

CREATE TRIGGER trg_basic AFTER UPDATE ON target FOR EACH STATEMENT
    INSERT INTO audit VALUES ('updated');

UPDATE target SET val = 100 WHERE id = 2;

CREATE TABLE strict_target (id INTEGER, val INTEGER);

CREATE TRIGGER trg_fail AFTER UPDATE ON strict_target FOR EACH STATEMENT
    INSERT INTO strict_log VALUES (999);

CREATE TRIGGER trg_multi_a AFTER UPDATE ON t_multi FOR EACH STATEMENT
    INSERT INTO t_multi_audit VALUES ('a');

UPDATE t_multi SET id = 2;

INSERT INTO t_upd_target VALUES (1, 0);

UPDATE t_upd_target SET val = 1;

INSERT INTO t_upd2_target VALUES (1, 0);

UPDATE t_upd2_target SET val = 1;

CREATE TABLE t_col (id INTEGER, val INTEGER, other INTEGER);

CREATE TABLE t_col_audit (msg VARCHAR);

UPDATE t_col SET val = 20 WHERE id = 1;

UPDATE t_col SET other = 200 WHERE id = 1;

CREATE TABLE t_multi_col (a INTEGER, b INTEGER, c INTEGER);

CREATE TABLE t_multi_col_audit (msg VARCHAR);

UPDATE t_multi_col SET a = 10;

UPDATE t_multi_col SET b = 20;

UPDATE t_multi_col SET a = 100, c = 300;

INSERT INTO t_mix VALUES (1, 2);

CREATE TRIGGER trg_mix_before BEFORE UPDATE OF a ON t_mix FOR EACH STATEMENT
    INSERT INTO t_mix_audit VALUES ('before');

UPDATE t_mix SET a = 10;

UPDATE t_mix SET b = 20;

CREATE TRIGGER trg_old AFTER UPDATE ON target
REFERENCING OLD TABLE AS o
FOR EACH STATEMENT
    INSERT INTO old_audit SELECT id, val FROM o;

SELECT id, val FROM old_audit;

CREATE TRIGGER trg_both AFTER UPDATE ON target
REFERENCING OLD TABLE AS o NEW TABLE AS n
FOR EACH STATEMENT
    INSERT INTO both_audit SELECT n.id, o.val, n.val FROM o JOIN n ON o.id = n.id;

SELECT id, old_val, new_val FROM both_audit;

CREATE TABLE t2_audit (id INTEGER, old_val INTEGER, new_val INTEGER);

CREATE TRIGGER trg_no AFTER UPDATE ON t2
REFERENCING NEW TABLE AS n OLD TABLE AS o
FOR EACH STATEMENT
    INSERT INTO t2_audit SELECT o.id, o.val, n.val FROM o JOIN n ON o.id = n.id;

SELECT id, old_val, new_val FROM t2_audit;

CREATE TABLE t_zero_log (old_cnt INTEGER, new_cnt INTEGER);

CREATE TRIGGER trg_zero AFTER UPDATE ON t_zero
REFERENCING OLD TABLE AS o NEW TABLE AS n
FOR EACH STATEMENT
    INSERT INTO t_zero_log SELECT (SELECT COUNT(*) FROM o), (SELECT COUNT(*) FROM n);

SELECT old_cnt, new_cnt FROM t_zero_log;

CREATE TABLE t_noop_log (id INTEGER, old_val INTEGER, new_val INTEGER);

CREATE TRIGGER trg_noop AFTER UPDATE ON t_noop
REFERENCING OLD TABLE AS o NEW TABLE AS n
FOR EACH STATEMENT
    INSERT INTO t_noop_log SELECT o.id, o.val, n.val FROM o JOIN n ON o.id = n.id;

SELECT id, old_val, new_val FROM t_noop_log;

CREATE TABLE t_src (id INTEGER, v INTEGER);

INSERT INTO t_from VALUES (1, 1), (2, 2), (3, 3);

CREATE TRIGGER trg_from AFTER UPDATE ON t_from
REFERENCING OLD TABLE AS o NEW TABLE AS n
FOR EACH STATEMENT
    INSERT INTO t_from_log SELECT o.id, o.val, n.val FROM o JOIN n ON o.id = n.id;

SELECT id, old_val, new_val FROM t_from_log;

CREATE SEQUENCE seq_vol START 1;

INSERT INTO t_vol VALUES (1, 0), (2, 0), (3, 0);

UPDATE t_vol SET val = nextval('seq_vol');

SELECT MAX(new_val) - MIN(new_val) FROM t_vol_log;

CREATE TABLE t_di_log (id INTEGER, old_val INTEGER, new_val INTEGER);

CREATE TRIGGER trg_di AFTER UPDATE ON t_di
REFERENCING OLD TABLE AS o NEW TABLE AS n
FOR EACH STATEMENT
    INSERT INTO t_di_log SELECT o.id, o.val, n.val FROM o JOIN n ON o.id = n.id;

UPDATE t_di SET val = val + 1 WHERE id >= 2;

SELECT id, old_val, new_val FROM t_di_log;

CREATE TABLE t_list_log (id INTEGER, old_len INTEGER, new_len INTEGER);

CREATE TRIGGER trg_list AFTER UPDATE ON t_list
REFERENCING OLD TABLE AS o NEW TABLE AS n
FOR EACH STATEMENT
    INSERT INTO t_list_log SELECT o.id, len(o.vals), len(n.vals) FROM o JOIN n ON o.id = n.id;

SELECT id, old_len, new_len FROM t_list_log;

CREATE TABLE t_gen_log (id INTEGER, old_a INTEGER, old_total INTEGER, new_a INTEGER, new_total INTEGER);

CREATE TRIGGER trg_gen AFTER UPDATE ON t_gen
REFERENCING OLD TABLE AS o NEW TABLE AS n
FOR EACH STATEMENT
    INSERT INTO t_gen_log SELECT o.id, o.a, o.total, n.a, n.total FROM o JOIN n ON o.id = n.id;

SELECT id, old_a, old_total, new_a, new_total FROM t_gen_log;

CREATE TABLE t_gen_order_log (x INTEGER, g2 INTEGER, g1 INTEGER);

CREATE TRIGGER trg_gen_order AFTER UPDATE ON t_gen_order
REFERENCING OLD TABLE AS o
FOR EACH STATEMENT
    INSERT INTO t_gen_order_log SELECT * FROM o;

SELECT x, g2, g1 FROM t_gen_order_log;

CREATE TABLE t_ret_log (id INTEGER, old_val INTEGER, new_val INTEGER);

CREATE TRIGGER trg_ret AFTER UPDATE ON t_ret
REFERENCING OLD TABLE AS o NEW TABLE AS n
FOR EACH STATEMENT
    INSERT INTO t_ret_log SELECT o.id, o.val, n.val FROM o JOIN n ON o.id = n.id;

SELECT id, old_val, new_val FROM t_ret_log;

CREATE TABLE t_shape_old (id INTEGER, val INTEGER);

INSERT INTO t_shape VALUES (1, 10);

CREATE TRIGGER trg_shape_new AFTER UPDATE ON t_shape
REFERENCING NEW TABLE AS n
FOR EACH STATEMENT
    INSERT INTO t_shape_new SELECT * FROM n;

SELECT id, val FROM t_shape_old;

CREATE TABLE t_name (__duckdb_old_col_0 INTEGER, id INTEGER);

INSERT INTO t_name VALUES (10, 1);

UPDATE t_name SET __duckdb_old_col_0 = 999 WHERE id = 1;

SELECT __duckdb_old_col_0, id FROM t_name;

INSERT INTO t_rb VALUES (1, 10), (2, 20);

INSERT INTO t_rb_unique VALUES (999);

SELECT id, val FROM t_rb;

INSERT INTO target VALUES (1, 10), (2, 20);

SELECT trigger_name, table_name, action_timing, event_manipulation FROM duckdb_triggers() WHERE database_name = 'triggerdb';

SELECT id, old_val, new_val FROM audit;

INSERT INTO target VALUES (1, 100), (2, 200), (3, 300);

UPDATE target SET val = val + 1 WHERE id = 1;

UPDATE target SET val = val * 10;

CREATE TABLE t_partial_log (n INTEGER);

CREATE TRIGGER trg_partial AFTER UPDATE ON t_partial
REFERENCING NEW TABLE AS changed
FOR EACH STATEMENT
    INSERT INTO t_partial_log SELECT COUNT(*) FROM changed;

SELECT n FROM t_partial_log;

INSERT INTO t_agg VALUES (1, 10), (2, 20), (3, 30);

UPDATE t_agg SET val = val + 100 WHERE id >= 2;

CREATE TRIGGER trg_zero AFTER UPDATE ON t_zero
REFERENCING NEW TABLE AS changed
FOR EACH STATEMENT
    INSERT INTO t_zero_log SELECT COUNT(*) FROM changed;

CREATE TABLE audit(x INTEGER);

ALTER TABLE t ADD COLUMN j INTEGER;

ALTER TABLE t ALTER COLUMN i SET NOT NULL;

ALTER TABLE t ADD PRIMARY KEY(i);

CREATE TABLE audit2(x INT);

UPDATE t2 SET j = 1;

UPDATE t2 SET i = 99;

ALTER TABLE t2 RENAME COLUMN i TO m;

CREATE TABLE t3(a INT, b INT);

CREATE TRIGGER tr3 AFTER UPDATE OF b ON t3 INSERT INTO dep_log VALUES (1);

INSERT INTO t3 VALUES (0, 0);

SELECT COUNT(*) FROM dep_log;

CREATE SEQUENCE log_seq;

CREATE TRIGGER trg_after AFTER INSERT ON target FOR EACH STATEMENT
    INSERT INTO log VALUES (nextval('log_seq'), 'after');

CREATE TABLE state_target (id INTEGER);

CREATE TABLE state_log (phase VARCHAR, observed_count INTEGER);

CREATE TRIGGER state_after AFTER INSERT ON state_target FOR EACH STATEMENT
    INSERT INTO state_log SELECT 'after', COUNT(*) FROM state_target;

SELECT phase, observed_count FROM state_log ORDER BY phase;

INSERT INTO upd_target VALUES (1, 10);

CREATE TRIGGER upd_before BEFORE UPDATE ON upd_target FOR EACH STATEMENT
    INSERT INTO upd_log SELECT 'before', val FROM upd_target WHERE id = 1;

UPDATE upd_target SET val = 99 WHERE id = 1;

CREATE TABLE del_target (id INTEGER);

CREATE TABLE del_log (phase VARCHAR, observed_count INTEGER);

CREATE TRIGGER del_after AFTER DELETE ON del_target FOR EACH STATEMENT
    INSERT INTO del_log SELECT 'after', COUNT(*) FROM del_target;

SELECT phase, observed_count FROM del_log ORDER BY phase;

CREATE TABLE fail_log (msg VARCHAR);

INSERT INTO fail_unique VALUES (777);

CREATE TRIGGER fail_after AFTER INSERT ON fail_target FOR EACH STATEMENT
    INSERT INTO fail_log VALUES ('after_fired');

SELECT COUNT(*) FROM fail_log;

CREATE TABLE cyc_ba_b (id INTEGER);

CREATE TABLE cyc_ab_a (id INTEGER);

CREATE TRIGGER cyc_ab_after AFTER INSERT ON cyc_ab_a FOR EACH STATEMENT
    INSERT INTO cyc_ab_b VALUES (1);

SELECT COUNT(*) FROM target;

INSERT INTO pre_target VALUES (1), (2), (3);

CREATE TRIGGER trg_pre BEFORE DELETE ON pre_target FOR EACH STATEMENT
    INSERT INTO pre_audit SELECT COUNT(*) FROM pre_target;

SELECT count_before FROM pre_audit;

CREATE TRIGGER trg_fail BEFORE DELETE ON strict_target FOR EACH STATEMENT
    INSERT INTO strict_log VALUES (999);

CREATE TRIGGER trg_multi_b BEFORE DELETE ON t_multi FOR EACH STATEMENT
    INSERT INTO t_multi_audit VALUES ('b');

DROP TRIGGER trg_basic ON target;

INSERT INTO target VALUES (1, 10);

INSERT INTO target VALUES (3, 30), (4, 40), (5, 50);

INSERT INTO pre_target VALUES (4);

CREATE TRIGGER trg_multi_a BEFORE INSERT ON t_multi FOR EACH STATEMENT
    INSERT INTO t_multi_audit VALUES ('a');

CREATE TRIGGER trg_del_body BEFORE INSERT ON t_del_target FOR EACH STATEMENT
    DELETE FROM t_scratch;

CREATE TRIGGER trg_upd_body BEFORE INSERT ON t_upd_target FOR EACH STATEMENT
    UPDATE t_counter SET n = n + 1;

CREATE TABLE rec_a (id INTEGER);

INSERT INTO target VALUES (100, 100);

SELECT val FROM target WHERE id = 1;

INSERT INTO pre_target VALUES (1, 10);

CREATE TRIGGER trg_pre BEFORE UPDATE ON pre_target FOR EACH STATEMENT
    INSERT INTO pre_audit SELECT val FROM pre_target WHERE id = 1;

SELECT val_before FROM pre_audit;

CREATE TRIGGER trg_fail BEFORE UPDATE ON strict_target FOR EACH STATEMENT
    INSERT INTO strict_log VALUES (999);

CREATE TRIGGER trg_multi_b BEFORE UPDATE ON t_multi FOR EACH STATEMENT
    INSERT INTO t_multi_audit VALUES ('b');

CREATE TRIGGER trg_multi_col BEFORE UPDATE OF a, b ON t_multi_col FOR EACH STATEMENT
    INSERT INTO t_multi_col_audit VALUES ('ab_changed');

INSERT INTO t_case VALUES (1);

CREATE TRIGGER trg_case BEFORE UPDATE OF VAL ON t_case FOR EACH STATEMENT
    INSERT INTO t_case_audit VALUES ('case');

SELECT COUNT(*) FROM t_case_audit;

UPDATE target SET val = 7 WHERE id = 1;

SELECT trigger_name, columns FROM duckdb_triggers() WHERE trigger_name = 'tr';

UPDATE t SET k = 1;

ALTER TABLE t RENAME COLUMN k TO j;

ALTER TABLE t RENAME COLUMN j TO k;

COMMIT;

UPDATE t SET k = 3;

CREATE TABLE log(i INT);

DROP TABLE log CASCADE;

SELECT COUNT(*) FROM t;

CREATE TABLE t1b(i INT);

CREATE TRIGGER tr1b AFTER INSERT ON t1b FOR EACH STATEMENT INSERT INTO log1b VALUES (1);

DROP TABLE t1b;

CREATE TABLE log2(i INT);

DROP TABLE t2;

DROP TABLE log2 RESTRICT;

CREATE TABLE log3(i INT);

DROP TRIGGER tr3 ON t3;

DROP TABLE t3;

CREATE TABLE b(i INT);

CREATE TABLE log_b(i INT);

CREATE TRIGGER same AFTER INSERT ON b FOR EACH STATEMENT INSERT INTO log_b VALUES (1);

DROP TABLE log_a RESTRICT;

CREATE TABLE t4(i INT);

CREATE TRIGGER tr4 AFTER INSERT ON t4 FOR EACH STATEMENT INSERT INTO log4 SELECT COUNT(*) FROM t4;

DROP TABLE log4 RESTRICT;

CREATE TABLE base5(i INT);

CREATE TABLE log5(i INT);

DROP TABLE t5 CASCADE;

DROP TABLE base5;

CREATE TABLE t6(i INT);

DROP TABLE t6;

CREATE TABLE t7(i INT);

CREATE TRIGGER tr7 AFTER INSERT ON t7 FOR EACH STATEMENT INSERT INTO log7 VALUES (1);

ALTER TABLE t7 RENAME COLUMN j TO k;

DROP TABLE log7;

CREATE TABLE log8(i INT);

DROP TABLE t8 CASCADE;

CREATE TABLE t9(i INTEGER, j INTEGER);

CREATE TRIGGER tr9 AFTER INSERT ON t9 FOR EACH STATEMENT INSERT INTO audit9 SELECT j FROM t9;

DROP TABLE audit9;

CREATE TABLE log10(x INTEGER);

ALTER TABLE t10 RENAME COLUMN j TO k;

DROP TABLE log10;

CREATE TABLE src11(j INTEGER);

CREATE TRIGGER tr11 AFTER INSERT ON t11 FOR EACH STATEMENT INSERT INTO audit11 SELECT j FROM src11;

DROP TABLE src11;

CHECKPOINT;

CREATE TABLE t (id INTEGER, val VARCHAR);

CREATE TRIGGER trg_basic AFTER INSERT ON t FOR EACH ROW
    INSERT INTO audit VALUES (NEW.id, NEW.val);

SELECT row_id, row_val FROM audit ORDER BY row_id;

INSERT INTO t VALUES (5, 'e');

CREATE TABLE audit_dup (row_id INTEGER);

INSERT INTO t_dup VALUES (5, 'a'), (5, 'b'), (5, 'c'), (5, 'd');

SELECT row_id, COUNT(*) FROM audit_dup GROUP BY row_id;

CREATE TABLE t_dup_all (id INTEGER, val VARCHAR);

CREATE TRIGGER trg_dup_all AFTER INSERT ON t_dup_all FOR EACH ROW
    INSERT INTO audit_dup_all VALUES (NEW.id, NEW.val);

SELECT COUNT(*) FROM audit_dup_all;

CREATE TABLE audit2 (msg VARCHAR);

INSERT INTO src VALUES (100), (200);

SELECT COUNT(*) FROM audit WHERE row_id >= 100;

CREATE TABLE audit_unique (fired_id INTEGER);

INSERT INTO t_unique VALUES (1);

CREATE TABLE t_snap (id INTEGER);

CREATE TRIGGER trg_snap AFTER INSERT ON t_snap FOR EACH ROW
    INSERT INTO snap_result SELECT NEW.id, COUNT(*) FROM t_snap;

SELECT DISTINCT cnt FROM snap_result;

CREATE TRIGGER trg_m1 AFTER INSERT ON t_multi FOR EACH ROW
    INSERT INTO audit_multi VALUES (NEW.id * 10);

INSERT INTO t_multi VALUES (1), (2);

SELECT SUM(n) FROM audit_multi;

CREATE TABLE t_upd_totals (total INTEGER);

CREATE TRIGGER trg_upd AFTER INSERT ON t_upd_src FOR EACH ROW
    UPDATE t_upd_totals SET total = total + NEW.amount;

SELECT total FROM t_upd_totals;

CREATE TABLE target_upd1 (id INTEGER, val INTEGER);

CREATE TRIGGER trg_upd1_corr AFTER INSERT ON t_upd1 FOR EACH ROW
    UPDATE target_upd1 SET val = val + 1 WHERE id = NEW.id;

SELECT id, val FROM target_upd1 WHERE val = 1 ORDER BY id;

CREATE TABLE t_upd_ev (id INTEGER);

CREATE TABLE t_del_ev_audit (old_id INTEGER, old_v INTEGER);

INSERT INTO t_del_ev VALUES (1, 10), (2, 20), (3, 30);

SELECT old_id, old_v FROM t_del_ev_audit ORDER BY old_id;

CREATE TABLE t_del_noref (id INTEGER);

CREATE TABLE t_ref (id INTEGER);

CREATE TABLE t_from_new (id INTEGER);

CREATE TABLE t_self (id INTEGER);

CREATE TABLE t_mix_log (msg VARCHAR);

CREATE TABLE t_mix2 (id INTEGER);

CREATE TRIGGER trg_mix2_row AFTER INSERT ON t_mix2 FOR EACH ROW
    INSERT INTO t_mix2_log VALUES (CAST(NEW.id AS VARCHAR));

CREATE TABLE t_mix3_log (msg VARCHAR);

CREATE TABLE t_mix4 (id INTEGER);

CREATE TRIGGER trg_mix4_after_row AFTER INSERT ON t_mix4 FOR EACH ROW
    INSERT INTO t_mix4_log VALUES (CAST(NEW.id AS VARCHAR));

CREATE TABLE t_ret_log (id INTEGER);

CREATE TABLE t_conflict (id INTEGER PRIMARY KEY, val VARCHAR);

INSERT INTO t_conflict VALUES (1, 'a');

CREATE TABLE casc_b (id INTEGER);

CREATE TRIGGER trg_casc_a AFTER INSERT ON casc_a FOR EACH ROW
    INSERT INTO casc_b VALUES (NEW.id + 100);

CREATE TABLE casc2_a (id INTEGER);

CREATE TABLE casc2_c (id INTEGER);

CREATE TABLE casc3_a (id INTEGER);

CREATE TABLE casc3_c (id INTEGER);

CREATE TABLE t_ins2 (id INTEGER);

CREATE TABLE audit_ins2 (id INTEGER);

CREATE TRIGGER trg_ins2 AFTER INSERT ON t_ins2 FOR EACH ROW
    INSERT INTO audit_ins2 SELECT NEW.id;

SELECT COUNT(*) FROM audit_ins2;

CREATE TABLE other_del1 (id INTEGER);

CREATE TRIGGER trg_del1 AFTER INSERT ON t_del1 FOR EACH ROW
    DELETE FROM other_del1 WHERE id = NEW.id;

SELECT COUNT(*) FROM other_del1;

CREATE TABLE t_gen_log (a INTEGER);

CREATE TABLE replace_log (id INTEGER);

CREATE OR REPLACE TRIGGER replace_trg AFTER INSERT ON replace_t FOR EACH ROW
    INSERT INTO replace_log VALUES (NEW.id);

SELECT id FROM replace_log ORDER BY id;

CREATE TABLE del_audit (row_id INTEGER, row_val VARCHAR);

INSERT INTO del_t VALUES (1, 'a'), (2, 'b'), (3, 'c');

SELECT row_id, row_val FROM del_audit ORDER BY row_id;

DELETE FROM del_t WHERE id = 999;

CREATE TABLE del_dup (id INTEGER, val VARCHAR);

CREATE TRIGGER del_trg_dup AFTER DELETE ON del_dup FOR EACH ROW
    INSERT INTO del_dup_audit VALUES (OLD.id);

DELETE FROM del_dup;

SELECT row_id, COUNT(*) FROM del_dup_audit GROUP BY row_id;

CREATE TABLE del_dup_all_audit (row_id INTEGER, row_val VARCHAR);

INSERT INTO del_dup_all VALUES (1, 'same'), (1, 'same'), (1, 'same');

SELECT COUNT(*) FROM del_dup_all_audit;

CREATE TABLE del_fk_audit (fired_id INTEGER);

INSERT INTO del_fk VALUES (1);

SELECT COUNT(*) FROM del_fk_audit;

CREATE TABLE del_ref (id INTEGER);

INSERT INTO del_ref VALUES (10), (20), (30), (40);

DELETE FROM del_src WHERE id IN (10, 30);

CREATE TABLE del_multi (id INTEGER);

CREATE TRIGGER del_trg_m1 AFTER DELETE ON del_multi FOR EACH ROW
    INSERT INTO del_multi_audit VALUES (OLD.id * 10);

INSERT INTO del_multi VALUES (1), (2);

SELECT COUNT(*) FROM del_multi_audit;

CREATE TABLE del_sel (id INTEGER);

CREATE TRIGGER del_trg_sel AFTER DELETE ON del_sel FOR EACH ROW
    INSERT INTO del_sel_audit SELECT OLD.id;

DELETE FROM del_sel;

CREATE TABLE del_ret (id INTEGER);

CREATE TRIGGER del_trg_ret AFTER DELETE ON del_ret FOR EACH ROW
    INSERT INTO del_ret_log VALUES (OLD.id);

CREATE TABLE del_self (id INTEGER);

CREATE TABLE del_casc_b (id INTEGER);

CREATE TRIGGER del_trg_casc_b AFTER DELETE ON del_casc_b FOR EACH ROW
    INSERT INTO del_casc_c VALUES (OLD.id);

CREATE TABLE del_replace_log (id INTEGER);

CREATE OR REPLACE TRIGGER del_replace_trg AFTER DELETE ON del_replace_t FOR EACH ROW
    INSERT INTO del_replace_log VALUES (OLD.id);

DELETE FROM del_replace_t;

CREATE TABLE copy_row_source (id INTEGER);

CREATE TABLE copy_row_target (id INTEGER);

CREATE TRIGGER copy_row_trg AFTER INSERT ON copy_row_target FOR EACH ROW
    INSERT INTO copy_row_log VALUES (NEW.id);

CREATE TABLE audit1 (msg VARCHAR);

CREATE TRIGGER trg2 AFTER INSERT ON t1 FOR EACH STATEMENT
    INSERT INTO audit2 VALUES ('trg2 fired');

SELECT COUNT(*) FROM audit1;

CREATE TABLE order_audit (seq_val INTEGER, name VARCHAR);

CREATE TRIGGER a_trg AFTER INSERT ON t2 FOR EACH STATEMENT
    INSERT INTO order_audit VALUES (nextval('order_seq'), 'a_trg');

SELECT seq_val, name FROM order_audit ORDER BY seq_val;

CREATE SEQUENCE order_seq2 START 1;

CREATE TRIGGER a_trg2 AFTER INSERT ON t2b FOR EACH STATEMENT
    INSERT INTO order_audit2 VALUES (nextval('order_seq2'), 'a_trg2');

INSERT INTO t2b VALUES (1);

CREATE TABLE t3 (id INTEGER);

INSERT INTO count3 VALUES (0);

CREATE TRIGGER trg3_b AFTER INSERT ON t3 FOR EACH STATEMENT
    UPDATE count3 SET n = n + 1;

INSERT INTO t3 VALUES (1);

CREATE TABLE t4 (id INTEGER);

CREATE TRIGGER t4_ins1 AFTER INSERT ON t4 FOR EACH STATEMENT
    INSERT INTO mixed_audit VALUES ('insert1');

CREATE TRIGGER t4_del AFTER DELETE ON t4 FOR EACH STATEMENT
    INSERT INTO mixed_audit VALUES ('delete');

SELECT COUNT(*) FROM mixed_audit WHERE event LIKE 'insert%';

DELETE FROM t4;

CREATE TABLE ref_audit (val INTEGER);

CREATE TRIGGER t5_ref2 AFTER INSERT ON t5
    REFERENCING NEW TABLE AS new_rows2
    FOR EACH STATEMENT
    INSERT INTO ref_audit SELECT id * 10 FROM new_rows2;

SELECT COUNT(*) FROM ref_audit;

CREATE TABLE t6 (id INTEGER);

CREATE TRIGGER t6_a AFTER INSERT ON t6
    REFERENCING NEW TABLE AS inserted
    FOR EACH STATEMENT
    INSERT INTO same_alias_audit SELECT id FROM inserted;

INSERT INTO t6 VALUES (3);

SELECT SUM(val) FROM same_alias_audit;

CREATE TABLE t6b_audit (msg VARCHAR);

CREATE TABLE alias_parent (id INTEGER);

CREATE TABLE alias_audit (id INTEGER);

CREATE TRIGGER a_alias AFTER INSERT ON alias_parent
    REFERENCING NEW TABLE AS shadow_alias
    FOR EACH STATEMENT
    INSERT INTO alias_audit SELECT id FROM shadow_alias;

INSERT INTO alias_parent VALUES (7);

SELECT COUNT(*) FROM alias_audit WHERE id = 1000;

CREATE TABLE t_chain2_child (id INTEGER);

CREATE TRIGGER t_chain2_child_trg AFTER INSERT ON t_chain2_child FOR EACH STATEMENT
    INSERT INTO t_chain2_audit VALUES ('child fired');

CREATE TRIGGER t_chain2_parent_b AFTER INSERT ON t_chain2_parent FOR EACH STATEMENT
    INSERT INTO t_chain2_child VALUES (2);

SELECT COUNT(*) FROM t_chain2_child;

CREATE TABLE t7 (id INTEGER);

CREATE TABLE chain_audit (msg VARCHAR);

CREATE TRIGGER t7_direct AFTER INSERT ON t7 FOR EACH STATEMENT
    INSERT INTO chain_audit VALUES ('t7 direct');

INSERT INTO t7 VALUES (1);

SELECT COUNT(*) FROM t7b;

CREATE TABLE tb (id INTEGER);

CREATE TABLE tb_audit (msg VARCHAR);

CREATE TRIGGER tb_trg AFTER INSERT ON tb FOR EACH STATEMENT
    INSERT INTO tb_audit VALUES ('tb fired');

INSERT INTO tb VALUES (2);

SELECT COUNT(*) FROM tb_audit;

CREATE TABLE t_cycle_a (id INTEGER);

CREATE TABLE t_cycle_audit (msg VARCHAR);

CREATE TRIGGER t_cycle_a_to_b AFTER INSERT ON t_cycle_a FOR EACH STATEMENT
    INSERT INTO t_cycle_b VALUES (1);

CREATE TABLE t_cycle2_b (id INTEGER);

CREATE TRIGGER t_cycle2_a_to_b AFTER INSERT ON t_cycle2_a FOR EACH STATEMENT
    INSERT INTO t_cycle2_b VALUES (1);

CREATE TABLE t9 (id INTEGER);

CREATE TRIGGER t9_keep AFTER INSERT ON t9 FOR EACH STATEMENT
    INSERT INTO drop_audit VALUES ('keep');

DROP TRIGGER t9_drop ON t9;

SELECT COUNT(*) FROM drop_audit WHERE msg = 'keep';

CREATE TABLE t10 (id INTEGER);

CREATE TRIGGER t10_a AFTER INSERT ON t10 FOR EACH STATEMENT
    INSERT INTO replace_audit VALUES ('original_a');

CREATE OR REPLACE TRIGGER t10_a AFTER INSERT ON t10 FOR EACH STATEMENT
    INSERT INTO replace_audit VALUES ('replaced_a');

SELECT COUNT(*) FROM replace_audit WHERE msg = 'original_a';

SELECT COUNT(*) FROM replace_audit WHERE msg = 'b';

CREATE TABLE t_old_upd_log (id INTEGER);

CREATE TABLE t_before (i INTEGER);

CREATE TABLE t_both_upd_log (id INTEGER);

CREATE TRIGGER trg_both_upd2 AFTER UPDATE ON t
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
FOR EACH STATEMENT
    INSERT INTO t_both_upd_log SELECT o.id FROM old_rows o JOIN new_rows n ON o.id = n.id;

CREATE TABLE t_reserved_log (id INTEGER);

INSERT INTO t VALUES (77);

CREATE TABLE t (a INTEGER, b INTEGER GENERATED ALWAYS AS (a + 1));

CREATE TABLE other (x INTEGER);

CREATE TABLE g (a INTEGER, gen INTEGER GENERATED ALWAYS AS (a * 2), b INTEGER);

CREATE TRIGGER tr_g AFTER INSERT ON g FOR EACH STATEMENT
    INSERT INTO glog VALUES ('g');

INSERT INTO g(a, b) VALUES (3, 4) RETURNING *;

CREATE TRIGGER tr_after_ins AFTER INSERT ON t FOR EACH STATEMENT
    INSERT INTO log VALUES ('after_ins');

INSERT INTO t VALUES (20) RETURNING a * 2 AS double_a;

INSERT INTO t VALUES (40) RETURNING t.a;

INSERT INTO t VALUES (70) RETURNING * EXCLUDE (b);

SELECT COUNT(*) FROM log WHERE msg = 'after_ins';

CREATE TABLE log2 (msg VARCHAR);

INSERT INTO t2 VALUES (5) RETURNING a;

CREATE TABLE t3 (a INTEGER);

CREATE TRIGGER tr3_before BEFORE INSERT ON t3 FOR EACH STATEMENT
    INSERT INTO log3 VALUES ('before');

INSERT INTO t3 VALUES (7) RETURNING a;

CREATE TABLE upd (id INTEGER, val INTEGER);

CREATE TABLE ulog (msg VARCHAR);

UPDATE upd SET val = val + 1 RETURNING id, val;

UPDATE upd AS u SET val = 0 RETURNING u.id;

INSERT INTO del VALUES (10), (20), (30);

CREATE TRIGGER tr_del AFTER DELETE ON del FOR EACH STATEMENT
    INSERT INTO dlog VALUES ('deleted');

SELECT COUNT(*) FROM dlog;

INSERT INTO ref_t VALUES (1, 100);

CREATE TRIGGER tr_ref AFTER INSERT ON ref_t
    REFERENCING NEW TABLE AS new_rows
    FOR EACH STATEMENT
    INSERT INTO ref_log SELECT id FROM new_rows;

SELECT captured FROM ref_log ORDER BY captured;

CREATE TABLE zerolog (msg VARCHAR);

INSERT INTO zero SELECT id FROM zero RETURNING id;

CREATE TABLE of_t (a INTEGER, b INTEGER);

CREATE TABLE of_log (msg VARCHAR);

UPDATE of_t SET a = 99 RETURNING a;

CREATE TABLE oc (id INTEGER PRIMARY KEY, v INTEGER);

CREATE TRIGGER tr_oc AFTER INSERT ON oc FOR EACH STATEMENT
    INSERT INTO log VALUES ('oc');

CREATE TABLE wcte (id INTEGER);

WITH ins AS (INSERT INTO wcte VALUES (5) RETURNING id) SELECT id FROM ins;

INSERT INTO rowid_del VALUES (10), (20);

CREATE TRIGGER tr_rowid_del AFTER DELETE ON rowid_del FOR EACH STATEMENT
    INSERT INTO rowid_dlog VALUES ('deleted');

CREATE TABLE leak_d (id INTEGER);

CREATE TABLE leak_cap (c INTEGER);

WITH d AS (DELETE FROM leak_d WHERE id = 10 RETURNING rowid)
SELECT typeof(rowid) FROM d;

CREATE TABLE leak_u (id INTEGER, v INTEGER);

CREATE TABLE leak_ucap (id INTEGER, v INTEGER);

UPDATE leak_u SET v = v + 1 WHERE id = 1 RETURNING id, v;

CREATE TABLE dupe_d (id INTEGER);

CREATE TABLE dupe_log (msg VARCHAR);

WITH d AS (DELETE FROM dupe_d WHERE id = 10 RETURNING *, rowid)
SELECT id, typeof(rowid) FROM d;

INSERT INTO dupe_d2 VALUES (10);

CREATE TRIGGER tr_dupe2 AFTER DELETE ON dupe_d2 REFERENCING OLD TABLE AS oldr
    FOR EACH STATEMENT INSERT INTO dupe_cap SELECT * FROM oldr;

SELECT c FROM dupe_cap;

INSERT INTO dupe_d3 VALUES (1);

WITH d AS (DELETE FROM dupe_d3 RETURNING rowid AS my_rid)
SELECT typeof(my_rid) FROM d;

INSERT INTO dupe_d4 VALUES (1);

WITH d AS (DELETE FROM dupe_d4 RETURNING rowid, rowid + 1 AS rid_plus_one)
SELECT typeof(rowid), typeof(rid_plus_one) FROM d;

INSERT INTO rowid_del2 VALUES (99);

CREATE TRIGGER tr_rowid_del2 AFTER DELETE ON rowid_del2 FOR EACH STATEMENT
    INSERT INTO rowid_dlog2 VALUES ('d');

CREATE TABLE rowid_alias (id INTEGER);

CREATE TABLE rowid_alias_log (msg VARCHAR);

WITH d AS (DELETE FROM rowid_alias AS x RETURNING x.rowid)
SELECT typeof(rowid) FROM d;

INSERT INTO rowid_schemaref VALUES (1);

CREATE TRIGGER tr_rowid_schemaref AFTER DELETE ON rowid_schemaref FOR EACH STATEMENT
    INSERT INTO rowid_schemaref_log VALUES ('d');

CREATE TABLE rowid_noalias (id INTEGER);

CREATE TABLE rowid_noalias_log (msg VARCHAR);

WITH d AS (DELETE FROM rowid_noalias RETURNING rowid_noalias.rowid)
SELECT typeof(rowid) FROM d;

INSERT INTO rowid_expr VALUES (1);

CREATE TRIGGER tr_rowid_expr AFTER DELETE ON rowid_expr FOR EACH STATEMENT
    INSERT INTO rowid_expr_log VALUES ('d');

CREATE TABLE rowid_expr2 (id INTEGER);

CREATE TABLE rowid_expr2_log (msg VARCHAR);

WITH d AS (DELETE FROM rowid_expr2 RETURNING rowid + 1 AS rid_plus_one)
SELECT rid_plus_one FROM d;

CREATE TRIGGER tr_rowid_ins AFTER INSERT ON rowid_ins FOR EACH STATEMENT
    INSERT INTO rowid_dlog VALUES ('ins');

INSERT INTO rowid_upd VALUES (1);

CREATE TABLE neg (id INTEGER PRIMARY KEY, v INTEGER);

CREATE TRIGGER tr_neg AFTER INSERT ON neg FOR EACH STATEMENT
    INSERT INTO log VALUES ('neg');

INSERT INTO neg_src VALUES (99);

CREATE TABLE neg_del (id INTEGER);

CREATE TABLE neg_using (x INTEGER);

CREATE TRIGGER tr_neg_del AFTER DELETE ON neg_del FOR EACH STATEMENT
    INSERT INTO log VALUES ('neg_del');

INSERT INTO cv VALUES (7, 70);

CREATE TRIGGER cv_trg AFTER DELETE ON cv FOR EACH STATEMENT
    INSERT INTO cv_log VALUES ('d');

INSERT INTO cv VALUES (8, 80);

CREATE TABLE df (id INTEGER, n INTEGER DEFAULT 42, m INTEGER);

CREATE TRIGGER df_trg AFTER INSERT ON df FOR EACH STATEMENT
    INSERT INTO df_log VALUES ('d');

INSERT INTO df VALUES (2, DEFAULT, NULL) RETURNING id, n, m;

CREATE TABLE nst_log (msg VARCHAR);

INSERT INTO nst VALUES (1, [1, 2, 3], MAP(['a', 'b'], [10, 20])) RETURNING id, l, mp;

CREATE TABLE returning_agg_log (x INTEGER);

CREATE TABLE returning_subquery_target (a INTEGER);

CREATE TRIGGER returning_subquery_trg
AFTER INSERT ON returning_subquery_target
FOR EACH STATEMENT
    INSERT INTO returning_subquery_log VALUES (1);

CREATE TABLE returning_window_log (x INTEGER);

CREATE SCHEMA returning_schema_qual;

INSERT INTO returning_schema_qual.target VALUES (7);

CREATE TRIGGER returning_schema_qual_trg
AFTER DELETE ON returning_schema_qual.target
FOR EACH STATEMENT
    INSERT INTO returning_schema_qual.log VALUES (1);

CREATE SCHEMA returning_wrong_schema;

INSERT INTO returning_wrong_schema.target VALUES (7);

CREATE TRIGGER returning_wrong_schema_trg
AFTER DELETE ON returning_wrong_schema.target
FOR EACH STATEMENT
    INSERT INTO returning_wrong_schema.log VALUES (1);

INSERT INTO returning_physical_rowid_target VALUES (42, 'x');

CREATE TRIGGER returning_physical_rowid_trg
AFTER DELETE ON returning_physical_rowid_target
FOR EACH STATEMENT
    INSERT INTO returning_physical_rowid_log VALUES (1);

CREATE TABLE returning_physical_rowid_ref_target (rowid INTEGER, id VARCHAR);

CREATE TABLE returning_physical_rowid_ref_cap (rowid INTEGER, id VARCHAR);

DELETE FROM returning_physical_rowid_ref_target RETURNING rowid;
