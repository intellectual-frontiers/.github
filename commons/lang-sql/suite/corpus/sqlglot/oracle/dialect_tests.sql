SELECT VAR_SAMP(x) FROM t;

SELECT purchases, LAST_VALUE(item) OVER item_window AS most_popular FROM Produce WINDOW item_window AS (PARTITION BY purchases ORDER BY purchases NULLS FIRST ROWS BETWEEN 2 PRECEDING AND 2 FOLLOWING);

SELECT LAST_DAY(CAST('2008-11-25' AS DATE));

SELECT to_date(substr(a.eta, 1,10), 'YYYY-MM-DD');

SELECT LAG(salary, 1, 0) OVER (ORDER BY hire_date) AS prev_sal FROM employees;

SELECT LEAD(salary, 1, 0) OVER (ORDER BY hire_date) AS prev_sal FROM employees;

CREATE TABLE a LIKE b;

SELECT DECODE(a, 1, 'one');

SELECT DECODE(a, 1, 'one', 'default');

SELECT DECODE(a, NULL, 'null');

SELECT DECODE(a, b, c);

SELECT DECODE(tbl.col, 'some_string', 'foo');

SELECT NVL(REGEXP_LIKE(x, '^[' || CHR(1) || '-' || CHR(127) || ']*$'), TRUE);

SELECT NVL2(a, b, c);

SELECT NVL2(a, b);

SELECT * FROM t FETCH FIRST ROWS ONLY;

SELECT * FROM t FETCH FIRST 10 ROWS ONLY;

SELECT x FROM y FETCH FIRST 10 ROWS ONLY;

SELECT x FROM y OFFSET 5 ROWS FETCH FIRST 10 ROWS ONLY;

SELECT x FROM y OFFSET 10 ROWS FETCH FIRST 3 ROWS ONLY;

CREATE TABLE t (c CHAR, nc NCHAR, v1 VARCHAR2, v2 VARCHAR2, nv NVARCHAR2, nv2 NVARCHAR2);

CREATE TABLE t (b1 BLOB, b2 BLOB(1024), c1 CLOB, c2 CLOB(1024));

WITH t AS (SELECT 1 AS x, 2 AS y) SELECT x AS x FROM t GROUP BY x;

WITH t AS (SELECT 1 AS x, 2 AS y) SELECT SUM(x) AS y, y AS x FROM t GROUP BY y;

SELECT y AS x FROM my_table t;

SELECT * FROM (SELECT * FROM my_table t) tbl;

WITH cte1 AS (SELECT a, b FROM table1), cte2 AS (SELECT c, e AS d FROM table2) SELECT b, d AS dd FROM cte1 t CROSS JOIN cte2 WHERE cte1.a = cte2.c;

SELECT * FROM (SELECT *, COUNT(*) OVER () AS _w FROM t) _t WHERE _w > 1;

SELECT "user id", some_id, other_id, "2 nd id" FROM (SELECT "user id", some_id, 1 AS other_id, 2 AS "2 nd id", COUNT(*) OVER () AS _w FROM t) _t WHERE _w > 1;

SELECT SUM(X) OVER (PARTITION BY x RANGE BETWEEN 1 PRECEDING AND CURRENT ROW EXCLUDE NO OTHERS);

SELECT SUM(X) OVER (PARTITION BY x RANGE BETWEEN 1 PRECEDING AND CURRENT ROW);

SELECT 1 EXCEPT ALL SELECT 1;

SELECT 1 UNION SELECT 2 INTERSECT SELECT 3;

SELECT 1 INTERSECT SELECT 2 INTERSECT SELECT 3 UNION SELECT 4;

SELECT 1 UNION (SELECT 2 INTERSECT SELECT 3);

(SELECT 1 UNION SELECT 2) INTERSECT SELECT 3;

SELECT x BETWEEN 2 AND 10;

SELECT (x BETWEEN 10 AND 2 OR x BETWEEN 2 AND 10);

SELECT x BETWEEN 10 AND 2;

SELECT CAST('2020-02-02 00:00:00' AS DATE);

SELECT JSON_ARRAY(1, NULL, 2 NULL ON NULL);

SELECT JSON_OBJECT('a' VALUE 1, 'b' VALUE NULL NULL ON NULL);

SELECT CAST('foo' AS TIMESTAMP);

SELECT LISTAGG(x, ',') WITHIN GROUP (ORDER BY y) FROM t;

SELECT TO_CHAR(CAST('2024-07-08 13:45:00' AS TIMESTAMP), 'DY');

SELECT TO_CHAR(CAST('1999-12-31' AS DATE)) AS TO_CHAR;

ALTER TABLE Payments ADD (Stock NUMBER(38, 0), dropid VARCHAR2(500));

CREATE TABLE t (foo BLOB);

SELECT a FROM tbl FOR UPDATE;

SELECT a FROM tbl FOR SHARE;

SELECT FIRST_VALUE(col1) OVER (ORDER BY col2 NULLS FIRST ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) FROM table1;

SELECT FIRST_VALUE(col1) RESPECT NULLS OVER (ORDER BY col2 NULLS FIRST) FROM table1;

SELECT LAST_VALUE(col1) OVER (PARTITION BY col3 ORDER BY col2 NULLS FIRST ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) FROM table1;

SELECT LAG(col1) OVER (ORDER BY CASE WHEN col2 IS NULL THEN 1 ELSE 0 END NULLS FIRST, col2 NULLS FIRST) FROM table1;

SELECT LEAD(col1, 1) RESPECT NULLS OVER (ORDER BY col2 NULLS FIRST) FROM table1;

CREATE TABLE t (id NUMBER) TABLESPACE "Mixed Ts";

create table t (id number) pctfree 10 nologging;

CREATE TABLE "t" ("id" NUMBER) PCTFREE 10 NOLOGGING;

CREATE TABLE t (id NUMBER) storage (initial 64 k next 1 m) nologging;

CREATE TABLE t (id NUMBER) STORAGE (INITIAL 64K NEXT 1M) NOLOGGING;

CREATE TABLE t (
  id NUMBER
)
PCTFREE 10
STORAGE (INITIAL 64K NEXT 1M)
LOGGING;

SELECT * FROM "SH"."SALES" PARTITION ("P1") s;

SELECT * FROM "SH"."SALES" PARTITION("P1") s;

SELECT s.col1 FROM sales PARTITION(p1) s JOIN sales SUBPARTITION(sp1) t ON s.id = t.id;

INSERT INTO sales PARTITION (p1) (col1) VALUES (1);

INSERT INTO sales PARTITION(p1) (col1) VALUES (1);

INSERT INTO "SH"."SALES" SUBPARTITION("P1") s (col1) VALUES (1);

INSERT INTO sales s (col1) VALUES (1);

INSERT INTO sales "PARTITION" (col1) VALUES (1);

INSERT INTO sales PARTITION(p1) (col1) SELECT col1 FROM source;

SELECT * FROM sales PARTITION(p1) AS OF SCN 123456 s;

SELECT * FROM sales SAMPLE (10) AS OF SCN 123456 s;

SELECT * FROM sales SUBPARTITION(sp1) SAMPLE (10) AS OF TIMESTAMP SYSDATE - 1 s WHERE s.id = 1;

SELECT * FROM sales SAMPLE (10) AS OF TIMESTAMP TO_TIMESTAMP('2026-10-10 12:00:00', 'YYYY-MM-DD HH24:MI:SS.FF6') s;

SELECT s.col1 FROM sales AS OF SCN 123456 s JOIN sales AS OF SCN 123457 t ON s.id = t.id;

SELECT * FROM sales AS s;

SELECT * FROM sales s;

SELECT * FROM sales AS OF TIMESTAMP TO_TIMESTAMP('2026-10-10 12:00:00', 'YYYY-MM-DD HH24:MI:SS.FF6') s;

SELECT * FROM sales AS OF TIMESTAMP TO_TIMESTAMP('2026-10-10 12:00:00.123456', 'YYYY-MM-DD HH24:MI:SS.FF6') s;

SELECT CONNECT_BY_ROOT x y;

SELECT CONNECT_BY_ROOT x AS y;

SELECT NTH_VALUE(x, 2) FROM FIRST OVER (ORDER BY y) AS c FROM t;

SELECT NTH_VALUE(x, 2) FROM LAST IGNORE NULLS OVER (ORDER BY y) AS c FROM t;

SELECT NTH_VALUE(x, 2) FROM FIRST RESPECT NULLS OVER (ORDER BY y) AS c FROM t;

SELECT BITMAP_BUCKET_NUMBER(32769);

SELECT BITMAP_CONSTRUCT_AGG(value);

CREATE GLOBAL TEMPORARY TABLE t AS SELECT * FROM orders;

CREATE PRIVATE TEMPORARY TABLE t AS SELECT * FROM orders;

SELECT SYSTIMESTAMP AT TIME ZONE 'UTC';

ALTER TABLE tbl_name DROP FOREIGN KEY fk_symbol;

ALTER TABLE Payments ADD Stock NUMBER NOT NULL;

SELECT x FROM t WHERE cond FOR UPDATE;

SELECT JSON_OBJECT(k1: v1 FORMAT JSON, k2: v2 FORMAT JSON);

SELECT JSON_OBJECT('name': first_name || ' ' || last_name) FROM t;

SELECT * FROM TABLE(foo);

SELECT a$x#b;

SELECT :OBJECT;

SELECT * FROM t FOR UPDATE;

SELECT * FROM t FOR UPDATE WAIT 5;

SELECT * FROM t FOR UPDATE NOWAIT;

SELECT * FROM t FOR UPDATE SKIP LOCKED;

SELECT * FROM t FOR UPDATE OF s.t.c, s.t.v;

SELECT * FROM t FOR UPDATE OF s.t.c, s.t.v NOWAIT;

SELECT * FROM t FOR UPDATE OF s.t.c, s.t.v SKIP LOCKED;

SELECT STANDARD_HASH('hello');

SELECT STANDARD_HASH('hello', 'MD5');

SELECT * FROM table_name@dblink_name.database_link_domain;

SELECT * FROM table_name SAMPLE (25) s;

SELECT COUNT(*) * 10 FROM orders SAMPLE (10) SEED (1);

SELECT * FROM V$SESSION;

SELECT TO_DATE('January 15, 1989, 11:00 A.M.');

SELECT TO_DATE(c, 'DD-MON-YYYY', 'NLS_DATE_LANGUAGE = AMERICAN') FROM t;

SELECT TO_TIMESTAMP(c, 'DD-MON-YYYY', 'NLS_DATE_LANGUAGE = AMERICAN') FROM t;

SELECT INSTR(haystack, needle);

SELECT fred FROM barney WHERE dino ^= 'wilma';

SELECT fred FROM barney WHERE dino <> 'wilma';

SELECT (TIMESTAMP '2025-12-30 20:00:00' - TIMESTAMP '2025-12-29 14:30:00') DAY TO SECOND;

SELECT (TO_TIMESTAMP('2025-12-30 20:00:00', 'YYYY-MM-DD HH24:MI:SS.FF6') - TO_TIMESTAMP('2025-12-29 14:30:00', 'YYYY-MM-DD HH24:MI:SS.FF6')) DAY TO SECOND;

SELECT (SYSTIMESTAMP - order_date) DAY(9) TO SECOND FROM orders;

SELECT (SYSTIMESTAMP - order_date) DAY(9) TO SECOND(3) FROM orders;

SELECT * FROM consumer LEFT JOIN groceries ON consumer.groceries_id = consumer.id PIVOT(MAX(type_id) FOR consumer_type IN (1, 2, 3, 4));

SELECT * FROM test UNPIVOT INCLUDE NULLS (value FOR Description IN (col AS 'PREFIX ' || CHR(38) || ' SUFFIX'));

SELECT * FROM sales UNPIVOT(q FOR p IN (q1 AS 'Prod1', q2 AS 'Prod2'));

SELECT * FROM sales UNPIVOT(q FOR p IN (q1 AS 1, q2 AS 2));

SELECT last_name, employee_id, manager_id, LEVEL FROM employees START WITH employee_id = 100 CONNECT BY PRIOR employee_id = manager_id ORDER SIBLINGS BY last_name;

ALTER TABLE Payments ADD (Stock NUMBER NOT NULL, dropid VARCHAR2(500) NOT NULL);

SELECT JSON_ARRAYAGG(JSON_OBJECT('RNK': RNK, 'RATING_CODE': RATING_CODE, 'DATE_VALUE': DATE_VALUE, 'AGENT_ID': AGENT_ID RETURNING CLOB) RETURNING CLOB) AS JSON_DATA FROM tablename;

SELECT JSON_ARRAY(FOO() FORMAT JSON, BAR() NULL ON NULL RETURNING CLOB STRICT);

SELECT JSON_ARRAYAGG(FOO() FORMAT JSON ORDER BY bar NULL ON NULL RETURNING CLOB STRICT);

SELECT COUNT(1) INTO V_Temp FROM TABLE(CAST(somelist AS data_list)) WHERE col LIKE '%contact';

SELECT * FROM t WHERE c LIKE (:v);

SELECT department_id INTO v_department_id FROM departments FETCH FIRST 1 ROWS ONLY;

SELECT department_id BULK COLLECT INTO v_department_ids FROM departments;

SELECT department_id, department_name BULK COLLECT INTO v_department_ids, v_department_names FROM departments;

SELECT MIN(column_name) KEEP (DENSE_RANK FIRST ORDER BY column_name DESC) FROM table_name;

SELECT CAST('January 15, 1989, 11:00 A.M.' AS DATE DEFAULT NULL ON CONVERSION ERROR, 'Month dd, YYYY, HH:MI A.M.') FROM DUAL;

SELECT TO_DATE('January 15, 1989, 11:00 A.M.', 'Month dd, YYYY, HH12:MI A.M.') FROM DUAL;

SELECT TRUNC(SYSDATE);

SELECT TRUNC(SYSDATE, 'DD');

SELECT JSON_OBJECT(KEY 'key1' IS emp.column1, KEY 'key2' IS emp.column1) "emp_key" FROM emp;

SELECT JSON_OBJECT('key1': emp.column1, 'key2': emp.column1) AS "emp_key" FROM emp;

SELECT JSON_OBJECTAGG(KEY department_name VALUE department_id) FROM dep WHERE id <= 30;

SELECT JSON_OBJECTAGG(department_name: department_id) FROM dep WHERE id <= 30;

SELECT last_name, department_id, salary, MIN(salary) KEEP (DENSE_RANK FIRST ORDER BY commission_pct) OVER (PARTITION BY department_id) AS "Worst", MAX(salary) KEEP (DENSE_RANK LAST ORDER BY commission_pct) OVER (PARTITION BY department_id) AS "Best" FROM employees ORDER BY department_id, salary, last_name;

SELECT UNIQUE col1, col2 FROM table;

SELECT DISTINCT col1, col2 FROM table;

SELECT * FROM T ORDER BY I OFFSET NVL(:variable1, 10) ROWS FETCH NEXT NVL(:variable2, 10) ROWS ONLY;

SELECT * FROM t SAMPLE (.25);

SELECT * FROM t SAMPLE (0.25);

SELECT TO_CHAR(-100, 'L99', 'NL_CURRENCY = '' AusDollars '' ');

SELECT * FROM t START WITH col CONNECT BY NOCYCLE PRIOR col1 = col2;

SELECT id FROM t START WITH (parent_id IS NULL) CONNECT BY PRIOR id = parent_id;

SELECT id FROM t START WITH (x) CONNECT BY PRIOR id = parent_id;

SELECT NTH_VALUE(x, 2) FROM LAST OVER (ORDER BY y) AS c FROM t;

SELECT DBMS_RANDOM.VALUE();

SELECT DBMS_RANDOM.VALUE;

SELECT TRIM('|' FROM '||Hello ||| world||');

SELECT department_id, department_name INTO v_department_id, v_department_name FROM departments FETCH FIRST 1 ROWS ONLY;

SELECT * FROM test WHERE MOD(col1, 4) = 3;

SELECT CAST(NULL AS VARCHAR2(2328 CHAR)) AS COL1;

SELECT CAST(NULL AS VARCHAR2(2328 BYTE)) AS COL1;

SELECT TO_CHAR(x, 'IYYY-IW');

SELECT TO_CHAR(CAST(x AS DATE), 'IYYY-IW');

SELECT TO_TIMESTAMP('2024-12-12 12:12:12.000000', 'YYYY-MM-DD HH24:MI:SS.FF6');

SELECT TO_DATE('2024-12-12', 'YYYY-MM-DD');

SELECT * FROM t ORDER BY a ASC NULLS LAST, b ASC NULLS FIRST, c DESC NULLS LAST, d DESC NULLS FIRST;

SELECT * FROM t ORDER BY a ASC, b ASC NULLS FIRST, c DESC NULLS LAST, d DESC;

SELECT /*+ ORDERED */* FROM tbl;

SELECT /*+ ORDERED */ * FROM tbl;

SELECT /* test */ /*+ ORDERED */* FROM tbl;

/* test */ SELECT /*+ ORDERED */ * FROM tbl;

SELECT /*+ ORDERED */*/* test */ FROM tbl;

SELECT /*+ ORDERED */ * /* test */ FROM tbl;

CREATE OR REPLACE FORCE VIEW foo1.foo2;

SELECT TO_TIMESTAMP('05 Dec 2000 10:00 AM', 'DD Mon YYYY HH12:MI AM');

SELECT TO_TIMESTAMP('05 Dec 2000 10:00 PM', 'DD Mon YYYY HH12:MI PM');

SELECT TO_TIMESTAMP('05 Dec 2000 10:00 A.M.', 'DD Mon YYYY HH12:MI A.M.');

SELECT TO_TIMESTAMP('05 Dec 2000 10:00 P.M.', 'DD Mon YYYY HH12:MI P.M.');

SELECT CUME_DIST(15, 0.05) WITHIN GROUP (ORDER BY col1, col2) FROM t;

SELECT DENSE_RANK(15, 0.05) WITHIN GROUP (ORDER BY col1, col2) FROM t;

SELECT RANK(15, 0.05) WITHIN GROUP (ORDER BY col1, col2) FROM t;

SELECT PERCENT_RANK(15, 0.05) WITHIN GROUP (ORDER BY col1, col2) FROM t;

SELECT VAR_POP(a) FROM t;

SELECT APPROX_COUNT_DISTINCT(a) FROM t;

SELECT * FROM t UNPIVOT(revenue FOR month IN (t.jan, t.feb)) AS u;

SELECT * FROM t UNPIVOT(revenue FOR month IN (jan, feb)) u;

SELECT * FROM t PIVOT(SUM(t.val) FOR t.cat IN ('a' AS a)) AS p;

SELECT * FROM t PIVOT(SUM(t.val) FOR cat IN ('a' AS a)) p;

SELECT e1.x, e2.x FROM e e1, e e2 WHERE e1.y (+) = e2.y;

SELECT e1.x, e2.x FROM e e1, e e2 WHERE e1.y = e2.y (+);

SELECT /*+ USE_NL(A B) */ A.COL_TEST FROM TABLE_A A, TABLE_B B;

SELECT /*+ INDEX(v.j jhist_employee_ix (employee_id start_date)) */ * FROM v;

SELECT /*+ USE_NL(A B C) */ A.COL_TEST FROM TABLE_A A, TABLE_B B, TABLE_C C;

SELECT /*+ NO_INDEX(employees emp_empid) */ employee_id FROM employees WHERE employee_id > 200;

SELECT /*+ NO_INDEX_FFS(items item_order_ix) */ order_id FROM order_items items;

SELECT /*+ LEADING(e j) */ * FROM employees e, departments d, job_history j WHERE e.department_id = d.department_id AND e.hire_date = j.start_date;

INSERT /*+ APPEND */ INTO IAP_TBL (id, col1) VALUES (2, 'test2');

INSERT /*+ APPEND_VALUES */ INTO dest_table VALUES (i, 'Value');

INSERT /*+ APPEND(d) */ INTO dest d VALUES (i, 'Value');

INSERT /*+ APPEND(d) */ INTO dest d (i, value) SELECT 1, 'value' FROM dual;

SELECT /*+ LEADING(departments employees) USE_NL(employees) */ * FROM employees JOIN departments ON employees.department_id = departments.department_id;

SELECT /*+ USE_NL(bbbbbbbbbbbbbbbbbbbbbbbb) LEADING(aaaaaaaaaaaaaaaaaaaaaaaa bbbbbbbbbbbbbbbbbbbbbbbb cccccccccccccccccccccccc dddddddddddddddddddddddd) INDEX(cccccccccccccccccccccccc) */ * FROM aaaaaaaaaaaaaaaaaaaaaaaa JOIN bbbbbbbbbbbbbbbbbbbbbbbb ON aaaaaaaaaaaaaaaaaaaaaaaa.id = bbbbbbbbbbbbbbbbbbbbbbbb.a_id JOIN cccccccccccccccccccccccc ON bbbbbbbbbbbbbbbbbbbbbbbb.id = cccccccccccccccccccccccc.b_id JOIN dddddddddddddddddddddddd ON cccccccccccccccccccccccc.id = dddddddddddddddddddddddd.c_id;

SELECT /*+ USE_NL(bbbbbbbbbbbbbbbbbbbbbbbb)
  LEADING(
    aaaaaaaaaaaaaaaaaaaaaaaa
    bbbbbbbbbbbbbbbbbbbbbbbb
    cccccccccccccccccccccccc
    dddddddddddddddddddddddd
  )
  INDEX(cccccccccccccccccccccccc) */
  *
FROM aaaaaaaaaaaaaaaaaaaaaaaa
JOIN bbbbbbbbbbbbbbbbbbbbbbbb
  ON aaaaaaaaaaaaaaaaaaaaaaaa.id = bbbbbbbbbbbbbbbbbbbbbbbb.a_id
JOIN cccccccccccccccccccccccc
  ON bbbbbbbbbbbbbbbbbbbbbbbb.id = cccccccccccccccccccccccc.b_id
JOIN dddddddddddddddddddddddd
  ON cccccccccccccccccccccccc.id = dddddddddddddddddddddddd.c_id;

SELECT /*+ LEADING(departments employees) USE_NL(employees) select where group by is order by */ * FROM employees JOIN departments ON employees.department_id = departments.department_id;

SELECT /*+ LEADING(departments, employees) */ * FROM employees JOIN departments ON employees.department_id = departments.department_id;

SELECT /*+ LEADING(departments select) */ * FROM employees JOIN departments ON employees.department_id = departments.department_id;

SELECT x.* FROM example t, XMLTABLE(XMLNAMESPACES(DEFAULT 'http://example.com/default', 'http://example.com/ns1' AS "ns1"), '/root/data' PASSING t.xml COLUMNS id NUMBER PATH '@id', value VARCHAR2(100) PATH 'ns1:value/text()') x;

SELECT warehouse_name warehouse,
   warehouse2."Water", warehouse2."Rail"
   FROM warehouses,
   XMLTABLE('/Warehouse'
      PASSING warehouses.warehouse_spec
      COLUMNS
         "Water" varchar2(6) PATH 'WaterAccess',
         "Rail" varchar2(6) PATH 'RailAccess')
      warehouse2;

SELECT
  warehouse_name AS warehouse,
  warehouse2."Water",
  warehouse2."Rail"
FROM warehouses, XMLTABLE(
  '/Warehouse'
  PASSING
    warehouses.warehouse_spec
  COLUMNS
    "Water" VARCHAR2(6) PATH 'WaterAccess',
    "Rail" VARCHAR2(6) PATH 'RailAccess'
) warehouse2;

SELECT table_name, column_name, data_default FROM xmltable('ROWSET/ROW'
    passing dbms_xmlgen.getxmltype('SELECT table_name, column_name, data_default FROM user_tab_columns')
    columns table_name      VARCHAR2(128)   PATH '*[1]'
            , column_name   VARCHAR2(128)   PATH '*[2]'
            , data_default  VARCHAR2(2000)  PATH '*[3]'
            );

SELECT
  table_name,
  column_name,
  data_default
FROM XMLTABLE(
  'ROWSET/ROW'
  PASSING
    dbms_xmlgen.getxmltype('SELECT table_name, column_name, data_default FROM user_tab_columns')
  COLUMNS
    table_name VARCHAR2(128) PATH '*[1]',
    column_name VARCHAR2(128) PATH '*[2]',
    data_default VARCHAR2(2000) PATH '*[3]'
);

SELECT
  *
FROM sales_history
MATCH_RECOGNIZE (
  PARTITION BY product
  ORDER BY
    tstamp
  MEASURES
    STRT.tstamp AS start_tstamp,
    LAST(UP.tstamp) AS peak_tstamp,
    LAST(DOWN.tstamp) AS end_tstamp,
    MATCH_NUMBER() AS mno
  ONE ROW PER MATCH
  AFTER MATCH SKIP TO LAST DOWN
  PATTERN (STRT UP+ FLAT* DOWN+)
  DEFINE
    UP AS UP.units_sold > PREV(UP.units_sold),
    FLAT AS FLAT.units_sold = PREV(FLAT.units_sold),
    DOWN AS DOWN.units_sold < PREV(DOWN.units_sold)
) MR;

SELECT SUBSTR(MIN(SQL_ID || SQL_TEXT), 14, 120) SAMPLE FROM V$SQLAREA;

SELECT SUBSTR(MIN(SQL_ID || SQL_TEXT), 14, 120) AS SAMPLE FROM V$SQLAREA;

SELECT 1 FETCH FIRST 1 ROWS ONLY;

SELECT * FROM JSON_TABLE(foo FORMAT JSON, 'bla' ERROR ON ERROR NULL ON EMPTY COLUMNS(foo PATH 'bar'));

SELECT * FROM JSON_TABLE(foo FORMAT JSON, 'bla' ERROR ON ERROR NULL ON EMPTY COLUMNS foo PATH 'bar');

SELECT
  CASE WHEN DBMS_LOB.GETLENGTH(info) < 32000 THEN DBMS_LOB.SUBSTR(info) END AS info_txt,
  info AS info_clob
FROM schemaname.tablename ar
INNER JOIN JSON_TABLE(:emps, '$[*]' COLUMNS(empno NUMBER PATH '$')) jt
  ON ar.empno = jt.empno;

SELECT
  *
FROM JSON_TABLE(res, '$.info[*]' COLUMNS(
  tempid NUMBER PATH '$.tempid',
  NESTED PATH '$.calid[*]' COLUMNS(last_dt PATH '$.last_dt ')
)) src;

SELECT * FROM JSON_TABLE(my_doc, '$.data[*]' COLUMNS(NAME VARCHAR2(200) PATH '$.name', DATA CLOB FORMAT JSON PATH '$.data')) j;

INSERT ALL INTO dest_tab1 (id, description) VALUES (id, description) INTO dest_tab2 (id, description) VALUES (id, description) INTO dest_tab3 (id, description) VALUES (id, description) SELECT id, description FROM source_tab;

INSERT ALL INTO pivot_dest (id, day, val) VALUES (id, 'mon', mon_val) INTO pivot_dest (id, day, val) VALUES (id, 'tue', tue_val) INTO pivot_dest (id, day, val) VALUES (id, 'wed', wed_val) INTO pivot_dest (id, day, val) VALUES (id, 'thu', thu_val) INTO pivot_dest (id, day, val) VALUES (id, 'fri', fri_val) SELECT * FROM pivot_source;

INSERT ALL WHEN id <= 3 THEN INTO dest_tab1 (id, description) VALUES (id, description) WHEN id BETWEEN 4 AND 7 THEN INTO dest_tab2 (id, description) VALUES (id, description) WHEN id >= 8 THEN INTO dest_tab3 (id, description) VALUES (id, description) SELECT id, description FROM source_tab;

INSERT ALL WHEN id <= 3 THEN INTO dest_tab1 (id, description) VALUES (id, description) WHEN id BETWEEN 4 AND 7 THEN INTO dest_tab2 (id, description) VALUES (id, description) WHEN 1 = 1 THEN INTO dest_tab3 (id, description) VALUES (id, description) SELECT id, description FROM source_tab;

INSERT FIRST WHEN id <= 3 THEN INTO dest_tab1 (id, description) VALUES (id, description) WHEN id <= 5 THEN INTO dest_tab2 (id, description) VALUES (id, description) ELSE INTO dest_tab3 (id, description) VALUES (id, description) SELECT id, description FROM source_tab;

INSERT FIRST WHEN id <= 3 THEN INTO dest_tab1 (id, description) VALUES (id, description) ELSE INTO dest_tab2 (id, description) VALUES (id, description) INTO dest_tab3 (id, description) VALUES (id, description) SELECT id, description FROM source_tab;

/* COMMENT */ INSERT FIRST WHEN salary > 4000 THEN INTO emp2 WHEN salary > 5000 THEN INTO emp3 WHEN salary > 6000 THEN INTO emp4 SELECT salary FROM employees;

INSERT WHEN k > 1 THEN INTO t VALUES (k) ELSE INTO u VALUES (k) SELECT k FROM x;

INSERT ALL WHEN k > 1 THEN INTO t VALUES (k) ELSE INTO u VALUES (k) SELECT k FROM x;

SELECT JSON_VALUE(doc, '$.a') FROM t;

SELECT JSON_VALUE(doc, '$.a' RETURNING NUMBER) FROM t;

SELECT JSON_VALUE(doc, '$.a' RETURNING VARCHAR2(10)) FROM t;

SELECT JSON_VALUE(doc, '$.a' RETURNING NUMBER NULL ON ERROR) FROM t;

SELECT JSON_VALUE(doc, '$.a' RETURNING NUMBER DEFAULT 0 ON ERROR NULL ON EMPTY) FROM t;

GRANT SELECT ON TABLE t TO maria, harry;

GRANT SELECT ON TABLE s.v TO PUBLIC;

GRANT SELECT ON TABLE t TO purchases_reader_role;

GRANT UPDATE, TRIGGER ON TABLE t TO anita, zhi;

GRANT EXECUTE ON PROCEDURE p TO george;

GRANT USAGE ON SEQUENCE order_id TO sales_role;

REVOKE SELECT ON TABLE t FROM maria, harry;

REVOKE SELECT ON TABLE s.v FROM PUBLIC;

REVOKE SELECT ON TABLE t FROM purchases_reader_role;

REVOKE UPDATE, TRIGGER ON TABLE t FROM anita, zhi;

REVOKE EXECUTE ON PROCEDURE p FROM george;

REVOKE USAGE ON SEQUENCE order_id FROM sales_role;

SELECT ADD_MONTHS(DATE '2024-02-29', 1);

SELECT ADD_MONTHS(TO_DATE('2024-02-29', 'YYYY-MM-DD'), 1);

ANALYZE TABLE tbl;

ANALYZE INDEX ndx;

ANALYZE TABLE db.tbl PARTITION(foo = 'foo', bar = 'bar');

ANALYZE TABLE db.tbl SUBPARTITION(foo = 'foo', bar = 'bar');

ANALYZE INDEX db.ndx PARTITION(foo = 'foo', bar = 'bar');

ANALYZE INDEX db.ndx PARTITION(part1);

ANALYZE CLUSTER db.cluster;

ANALYZE TABLE tbl VALIDATE REF UPDATE;

ANALYZE LIST CHAINED ROWS;

ANALYZE LIST CHAINED ROWS INTO tbl;

ANALYZE DELETE STATISTICS;

ANALYZE DELETE SYSTEM STATISTICS;

ANALYZE VALIDATE REF UPDATE;

ANALYZE VALIDATE REF UPDATE SET DANGLING TO NULL;

ANALYZE VALIDATE STRUCTURE;

ANALYZE VALIDATE STRUCTURE CASCADE FAST;

ANALYZE TABLE tbl VALIDATE STRUCTURE CASCADE COMPLETE ONLINE INTO db.tbl;

ANALYZE TABLE tbl VALIDATE STRUCTURE CASCADE COMPLETE OFFLINE INTO db.tbl;

SELECT id, PRIOR name AS parent_name, name FROM tree CONNECT BY NOCYCLE PRIOR id = parent_id;

SELECT LISTAGG(last_name, '; ' ON OVERFLOW TRUNCATE '...' WITH COUNT) WITHIN GROUP (ORDER BY hire_date) FROM employees;

SELECT LISTAGG(last_name, '; ' ON OVERFLOW ERROR) WITHIN GROUP (ORDER BY hire_date) FROM employees;

MERGE INTO target tgt USING (SELECT id, col1 FROM source_tbl) src ON tgt.id = src.id WHEN MATCHED THEN UPDATE SET tgt.col1 = src.col1 WHERE tgt.some_column IS NULL WHEN NOT MATCHED THEN INSERT (id, col1) VALUES (src.id, src.col1) WHERE NOT src.col1 IS NULL;

WITH t AS (SELECT 1 AS COL) SELECT col, ROWID FROM t WHERE ROWNUM = 1;

SELECT CHR(187 USING NCHAR_CS);

SELECT CHR(187);

SELECT q'[a''b]' FROM dual;

SELECT 'a''''b' FROM dual;

SELECT q'[a]b]' FROM dual;

SELECT 'a]b' FROM dual;

SELECT q'|\n|' FROM dual;

SELECT '\n' FROM dual;

CREATE TRIGGER check_salary BEFORE INSERT ON employees FOR EACH ROW BEGIN :NEW.status := 'PENDING' END;

CREATE TRIGGER audit_trigger AFTER UPDATE ON accounts FOR EACH ROW BEGIN INSERT INTO audit_log (user_id, old_balance, new_balance, changed_at) VALUES (:OLD.id, :OLD.balance, :NEW.balance, SYSDATE) END;

CREATE TRIGGER view_insert INSTEAD OF INSERT ON employee_view FOR EACH ROW BEGIN INSERT INTO employees (id, name, dept_id) VALUES (:NEW.id, :NEW.name, :NEW.dept_id) END;

SELECT VARIANCE(x) OVER (PARTITION BY y) FROM t;

SELECT VARIANCE(x) FROM t;

SELECT VARIANCE(DISTINCT x) FROM t;

SELECT VARIANCE(DISTINCT x) OVER (PARTITION BY y) FROM t;

SELECT SUM(VARIANCE(x)) OVER () FROM t GROUP BY y;

SELECT VARIANCE(x) FROM (SELECT 1 AS x) t WHERE 1 = 0;

CREATE TABLE t PCTFREE 10 NOLOGGING AS SELECT 1 AS id FROM dual;

CREATE TABLE t (id NUMBER) TABLESPACE ts PCTFREE 10 STORAGE (INITIAL 64K);

CREATE TABLE t STORAGE (INITIAL 64K) NOLOGGING AS SELECT 1 AS id FROM dual;

SELECT 'it''s' FROM dual;

SELECT JSON_OBJECTAGG(KEY k VALUE v) FROM t;

SELECT a, b FROM (SELECT a AS a, b AS b, ROW_NUMBER() OVER (PARTITION BY a ORDER BY c DESC) AS _row_number FROM x) _t WHERE _row_number = 1;

SELECT JSON_ARRAYAGG(name ORDER BY id ASC, name DESC) FROM t;

SELECT JSON_ARRAY(id, name) FROM t;

SELECT JSON_EXISTS('{"a":1}', '$.a');

SELECT * FROM x START WITH a = b CONNECT BY c = PRIOR d;

SELECT MAX(c1), MAX(c2) FROM test;

SELECT MIN(c1), MIN(c2) FROM test;

CREATE GLOBAL TEMPORARY TABLE t (a INT);

CREATE PRIVATE TEMPORARY TABLE ora$ptt_t (a INT);

SELECT 1 MINUS SELECT 1;

SELECT t1.c1, t2.c2 FROM t1, t2 WHERE t1.c1 = t2.c2 (+);

SELECT CHR(72) || CHR(105) || CHR(x);

SELECT LEAST(a, b) FROM t;

SELECT GREATEST(a, b) FROM t;

CREATE TABLE a;

WITH t(c) AS (SELECT 1) SELECT * INTO foo FROM (SELECT c AS c FROM t) temp;

CREATE GLOBAL TEMPORARY TABLE mytemptable (a INT);

SELECT NEXT VALUE FOR db.schema.sequence_name;
