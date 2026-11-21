SET TimeZone = 'America/New_York';

SELECT count(*) FROM tz WHERE t = ANY (SELECT t FROM ts);

SELECT TIMESTAMPTZ '2024-03-10 07:15:00+00' < ALL (SELECT stamp FROM stamps);

INSERT INTO t0 VALUES (1);

SET scalar_subquery_error_on_multiple_rows=false;

SELECT 1 > ANY(SELECT * FROM integers);

INSERT INTO integers VALUES (NULL);

SELECT x FROM s WHERE x = ANY(ARRAY(SELECT y FROM allowed ORDER BY y));

SELECT 'a' = ANY((SELECT y FROM allowed));

INSERT INTO t1 VALUES (1, true), (2, false), (NULL, NULL);

SET default_null_order='nulls_first';

SELECT i FROM integers i1 WHERE i=ANY(SELECT i FROM integers WHERE i=i1.i) ORDER BY i;

SELECT i=ALL(SELECT i FROM integers WHERE i=i1.i) FROM integers i1 ORDER BY i;

SELECT i>ALL(SELECT (i+i1.i-1)/2 FROM integers) FROM integers i1 ORDER BY i;

SELECT (SELECT SUM(i)+SUM(i1.i) FROM integers)>ANY(SELECT i FROM integers WHERE i>MIN(i1.i)) FROM integers i1;

SELECT n, (
    WITH a AS (SELECT unnest(string_split(v.t, ' ')) AS w),
         b AS (SELECT unnest(string_split(v.q, ' ')) AS w)
    SELECT list(w ORDER BY w) FROM a WHERE w IN (SELECT w FROM b)
) AS found
FROM (VALUES (1, 'alpha beta gamma', 'alpha'),
             (2, 'beta gamma delta', 'gamma'),
             (3, 'delta alpha beta', 'delta')) v(n, t, q)
ORDER BY n;

INSERT INTO t VALUES (1), (2), (NULL);

SELECT x, (
    SELECT COUNT(*)
    FROM t a LEFT JOIN t b ON b.i IN (SELECT v.x FROM s)
    WHERE b.i IN (SELECT i FROM s)
) FROM t v(x) ORDER BY x NULLS LAST;

INSERT INTO probes VALUES(0,0,NULL),(1,1,1),(2,1,7),(3,1,NULL),(4,2,1),(5,2,2),(6,2,NULL),(7,3,1),(8,3,NULL),(9,NULL,1),(10,2,2);

SELECT list(marker ORDER BY id) FROM (SELECT id,v IN(SELECT c.v FROM candidates c WHERE c.g IS NOT DISTINCT FROM p.g AND (SELECT k FROM lookup)=1) marker FROM probes p);

DELETE FROM candidates;

SELECT t1.a FROM t1 WHERE (a, b) IN (SELECT (t2.a, t2.b) FROM t2 WHERE t2.c = t1.c) ORDER BY ALL;

SELECT row(NULL::INT, 8) IN (SELECT * FROM (VALUES (2, 6), (3, 7)) rhs(x, y)),
       row(NULL::INT, 8) NOT IN (SELECT * FROM (VALUES (2, 6), (3, 7)) rhs(x, y));

CREATE TABLE mark_join_rhs AS SELECT i::INT AS a, i::INT AS b FROM range(3000) t(i);

SELECT row([1, NULL::INT], 0) IN (
	SELECT * FROM (VALUES ([1, NULL::INT], 0)) rhs(a, b)
);

SELECT row({'a': 1, 'b': NULL::INT}, 0) IN (
	SELECT * FROM (VALUES ({'a': 1, 'b': 2}, 0)) rhs(a, b)
);

SELECT row(1, 2) = ANY (
	SELECT s FROM (VALUES (row(1, NULL::INT))) rhs(s)
);

WITH RECURSIVE r(i, j) AS (
	VALUES (0, 0)
	UNION ALL
	SELECT outer_r.i + 1, 0
	FROM r outer_r
	WHERE outer_r.i < 3
	  AND row(outer_r.i + 1, 0) NOT IN (
		  SELECT inner_r.i, NULL::INT FROM r inner_r
	  )
)
SELECT * FROM r ORDER BY i;

SELECT (0, 0) < ANY(SELECT a, b FROM test_data);

SELECT (2, 0) > ANY(SELECT a, b FROM test_data WHERE a IS NOT NULL);

SELECT (2, 0) >= ANY(SELECT 1, 5);

SELECT (3, 0) > ALL(SELECT * FROM (VALUES (1, 0), (2, 0)));

SELECT (1, 1) >= ALL(SELECT 1, 0);

SELECT (1, 2) != ANY(SELECT 1, 3);

SELECT (0, 0, 0) < ANY(SELECT 1, 0, 0);

SELECT (1, 1) < ANY(SELECT 1, 1);

SELECT (1, 1) > ANY(SELECT * FROM (VALUES (0, 0), (2, 0), (1, 0)));

SELECT (3, NULL::INT) <> ANY (
	SELECT * FROM (VALUES (2, 1)) rhs(a, b)
);

SELECT (1, NULL::INT) <> ANY (SELECT * FROM (VALUES (1, 2), (2, 2)) t(x, y));

SELECT 1 = ANY(SELECT NULL);

SELECT 1 = ALL(SELECT 2);

SELECT 1 IN (SELECT 2);

SELECT * FROM integers WHERE (i IN (SELECT * FROM integers)) IS NULL ORDER BY 1;

INSERT INTO test VALUES (3, 23);

SELECT 2 = SOME(SELECT 1 UNION ALL SELECT 2);

SELECT 2 >= SOME(SELECT 2);

SELECT i, i >= ALL(SELECT i FROM integers) FROM integers ORDER BY i;

SELECT i FROM integers WHERE i <= ALL(SELECT i FROM integers);

SELECT i FROM integers WHERE i <> ALL(SELECT i FROM integers WHERE i IS NOT NULL);

SELECT i, i >= ANY(SELECT i FROM integers WHERE i>10) FROM integers ORDER BY i;

SELECT (SELECT EXISTS(SELECT * FROM integers WHERE i>2)) FROM integers;

SELECT i, SUM(CASE WHEN (i >= ALL(SELECT i FROM integers WHERE i=2)) THEN 1 ELSE 0 END) FROM integers GROUP BY i ORDER BY i;

SELECT i FROM integers WHERE i > ANY(SELECT i FROM integers) ORDER BY 1;

SELECT i FROM integers WHERE i = ANY(SELECT i FROM integers) order by i;

SELECT i, i = ANY(SELECT i1.i FROM integers i1, integers i2, integers i3, integers i4, integers i5, integers i6 WHERE i1.i IS NOT NULL) FROM integers ORDER BY i;

SELECT 127::INTEGER::VARIANT >= ALL (SELECT v FROM v);

SELECT 127::INTEGER::VARIANT <= ANY (SELECT v FROM v);

CREATE TABLE c(x VARCHAR);

SELECT 5 > ALL (SELECT x FROM (VALUES (1),(2),(NULL)) s(x));

CREATE TABLE t2(c0 INT);

SELECT * FROM t2, t0 LEFT JOIN Lateral(SELECT t0.c0 AS col_0, t2.c0 AS col_1) as subQuery1 ON ((subQuery1.col_1)<(t0.c0));

SELECT * FROM t0, t1 CROSS JOIN (SELECT t0.c0 AS col_0 WHERE t1.c1) as subQuery0;

SELECT * FROM t0, t2, t1, (SELECT DISTINCT t1.c0 AS col_0, t2.c2 AS col_1 FROM t1) as subQuery0 CROSS JOIN (SELECT t0.c0 AS col_0);

CREATE OR REPLACE MACRO swan_subject_info (duckSubject) AS (
    WITH
        subjectComponents AS (
            SELECT
                duckSubject AS subject,
                STRING_SPLIT(duckSubject, ':') AS parts
        )
    SELECT
        CASE
            WHEN parts[1] = 'EnumField2' THEN STRUCT_PACK(
                subject := subject,
                type := swan_MY_ENUM (parts[2])
            )
            WHEN parts[1] = 'EnumField1' THEN STRUCT_PACK(subject := subject, type := 'EnumField1'::MY_ENUM)
            WHEN REGEXP_MATCHES(
                subject,
                'duckdb.org'
            ) THEN STRUCT_PACK(
                subject := subject,
                type := 'EnumField6'::MY_ENUM
            )
            WHEN NOT REGEXP_FULL_MATCH(subject, '.+@.+\..+') THEN STRUCT_PACK(
                subject := subject,
                type := 'EnumField7'::MY_ENUM
            )
        END AS duckInfo
    FROM
        subjectComponents
);

SELECT l IN (SELECT i1.l FROM (SELECT * FROM lists i1 WHERE i1.l=lists.l) i1 LEFT JOIN generate_series(1, 2, 1) tbl(s) ON i1.l=ARRAY[tbl.s]) FROM lists ORDER BY l NULLS LAST;

SELECT l IN (SELECT i1.l FROM (SELECT * FROM lists i1 WHERE i1.l IS NOT DISTINCT FROM lists.l) i1 LEFT JOIN generate_series(1, 2, 1) tbl(s) ON i1.l=ARRAY[tbl.s] OR (i1.l IS NULL AND tbl.s IS NULL)) FROM lists ORDER BY l NULLS LAST;

SELECT l, (SELECT SUM(a) FROM (SELECT UNNEST(b) AS a FROM (SELECT UNNEST(l) AS b))) FROM nested_lists ORDER BY l;

SELECT i FROM integers i1 WHERE EXISTS(SELECT i FROM integers WHERE i=i1.i) ORDER BY i;

SELECT *
FROM x
LEFT JOIN y ON EXISTS (SELECT * FROM z WHERE z2 = x2)
ORDER BY x1, x2, y1, y2;

SELECT EXISTS(SELECT i+MIN(i1.i) FROM integers WHERE i=3) FROM integers i1;

SELECT (SELECT COVAR_POP(i2.i, i1.i) FROM integers i2) FROM integers i1 ORDER BY 1;

CREATE TABLE exists_sales(o INTEGER, ship_date INTEGER, wh INTEGER);

SELECT t0.c2 FROM t0
WHERE NOT EXISTS (
  SELECT 1 FROM (
    SELECT t0.c2 AS col0 FROM t0
  ) AS subQuery
  WHERE ((t0.c2) IS DISTINCT FROM (subQuery.col0))
);

INSERT INTO posts VALUES
	(1, 1, 'Hello World', 'First post', 100, 10, '2022-01-10 10:00:00', 4.5),
	(2, 1, 'Another Post', NULL,        150, 20, '2022-01-11 11:00:00', 3.0),
	(3, 2, 'Bob Post',     'Content',   NULL,  5, '2022-01-12 12:00:00', NULL),
	(4, 3, NULL,           'Empty',      50,  2, '2022-01-13 13:00:00', 5.0),
	(5, 4, 'Last Post',    'Last',      300, 30, '2022-01-14 14:00:00', 4.9);

DROP TABLE posts;

CREATE TABLE issue23979_s2(o INTEGER, wh INTEGER);

CREATE TABLE e (a INT);

SELECT NOT EXISTS (SELECT 1 FROM e);

select c1 from t1 anti join t2 on (t1.c1 <= t2.c1);

SELECT * FROM integers WHERE EXISTS(SELECT 1) ORDER BY i;

SELECT EXISTS(SELECT * FROM integers), EXISTS(SELECT * FROM integers);

SELECT * FROM integers WHERE 1 IN (SELECT NULL::INTEGER) ORDER BY i;

INSERT INTO tbl VALUES (1, ARRAY[1, 3, 7]), (2, ARRAY[8, NULL]), (3, ARRAY[3, NULL, 4]), (NULL, ARRAY[]::INT[]);

SELECT * FROM tbl JOIN LATERAL (SELECT UNNEST(ARRAY[tbl.i * tbl.i])) t(b) ON (i>=b) ORDER BY i, b;

CREATE TABLE probes(x INTEGER);

SELECT o.k, q.x, q.n
FROM (VALUES (1), (2)) o(k), LATERAL (
    SELECT v.x, t.n
    FROM (VALUES (2)) v(x)
    ASOF JOIN (SELECT o.k AS n) t ON v.x >= t.n
) q ORDER BY ALL;

SELECT o.k, q.ts FROM (VALUES (4), (10)) o(k), LATERAL (
    SELECT t.ts FROM (SELECT o.k AS x) v ASOF JOIN prices t ON v.x >= t.ts
) q ORDER BY ALL;

SELECT o.k, q.x FROM (VALUES (1), (3)) o(k), LATERAL (
    SELECT v.x FROM (VALUES (2)) v(x) ASOF SEMI JOIN (SELECT o.k AS n) t ON v.x >= t.n
) q ORDER BY ALL;

SELECT count(*) FROM (
    SELECT o.cutoff, p.x, 10 * (least(p.x, o.cutoff) - least(p.x, o.cutoff) % 5)
    FROM (VALUES (300), (600), (995)) o(cutoff), big_probes p
    EXCEPT ALL
    SELECT o.cutoff, q.x, q.price
    FROM (VALUES (300), (600), (995)) o(cutoff), LATERAL (
        SELECT p.x, r.price
        FROM big_probes p
        ASOF JOIN (SELECT ts, price FROM big_prices WHERE ts <= o.cutoff) r ON p.x >= r.ts
    ) q
);

from v1;

SELECT o.ss, EXISTS (WITH st(k) AS (VALUES (1), (2))
                     SELECT 1 FROM q WHERE q.k IN (SELECT k FROM st) AND list_contains(o.ss, q.s))
FROM (VALUES ([0, 1]), ([2]), ([5]), ([0, 1])) o(ss)
ORDER BY ALL;

SET debug_verify_serializer=false;

EXPLAIN SELECT count(*) FROM joined_walk WHERE id = 3;

CREATE VIEW owner_walk AS
SELECT o.person, o.class, w.depth
FROM owners o, LATERAL (
    WITH RECURSIVE walk(depth) AS (
        SELECT 0 + coalesce(o.class, 0) * 0
        UNION ALL SELECT depth + 1 FROM walk WHERE depth < 2
    ) SELECT depth FROM walk
) w JOIN vertices v ON v.id = w.depth;

EXPLAIN SELECT count(*) FROM (SELECT * FROM owner_walk LIMIT 1) q WHERE person = 1;

EXECUTE selected_walk(1000);

SELECT count(w.value) FROM owners input, LATERAL (
    WITH RECURSIVE walk(value, depth) AS (
        SELECT nextval('body_calls') + coalesce(input.class, 0) * 0, 0
        UNION ALL SELECT value, depth + 1 FROM walk WHERE depth < 2
    ) SELECT * FROM walk
) w JOIN vertices target ON target.id = w.depth WHERE person = 1;

EXPLAIN SELECT count(*) FROM owner_walk WHERE __internal_barrier(person = 1);

SELECT count(*) FROM owner_walk a JOIN owner_walk b ON a.person = b.person WHERE a.person = 1;

CREATE VIEW shape_union AS
SELECT input.id,w.depth FROM vertices input
CROSS JOIN LATERAL (
    WITH RECURSIVE walk(depth) AS (
        SELECT 0+input.id*0
        UNION
        SELECT depth+1 FROM walk WHERE depth<7
    )
    SELECT depth FROM walk
) w
JOIN vertices target ON target.id=w.depth+1;

EXPLAIN SELECT count(*) FROM shape_exists WHERE id=3;

SELECT count(*) FROM shape_mark_body WHERE id=3;

INSERT INTO owners VALUES (1,10),(1,10),(1,NULL),(2,10),(3,20);

SELECT count(*) FROM (
    SELECT input.person, NOT EXISTS (
        WITH RECURSIVE walk(depth) AS (
            SELECT coalesce(input.class,0)*0
            UNION ALL
            SELECT depth+1 FROM walk WHERE depth<2
        ) SELECT * FROM walk WHERE depth=2 AND input.class IS NOT NULL) AS found
    FROM owners input JOIN vertices target ON target.id=input.person
) q WHERE person=1 AND found;

INSERT INTO person SELECT i, (i%2)::VARCHAR, i IN (3,17,51), 0 FROM range(1000) t(i);

WITH o AS MATERIALIZED (SELECT * FROM person WHERE selected) SELECT count(*),sum(q.x) FROM o JOIN (SELECT DISTINCT i.id, i.tag, i.grp, r.x FROM person i, LATERAL (
WITH RECURSIVE walk(x) USING KEY(x) AS (
 SELECT coalesce(i.id,0) UNION SELECT w.x+1 FROM walk w WHERE w.x<coalesce(i.id,0)+2
 AND NOT EXISTS (SELECT 1 FROM recurring.walk v WHERE v.x=w.x+1)
) SELECT max(x) x FROM walk
) r) q ON o.id = q.id AND o.tag = q.tag;

CREATE TABLE representatives AS SELECT DISTINCT ON (grp) * FROM expanded;

SET disabled_optimizers='filter_pushdown';

SELECT o.k, a.c
FROM (VALUES (1), (7)) AS o(k),
LATERAL (
    SELECT count(*) AS c
    FROM (VALUES (1), (1), (2)) AS i(k)
    WHERE i.k = o.k
    GROUP BY GROUPING SETS ((), (), ())
) AS a
ORDER BY ALL;

SELECT o.k, a.c
FROM (VALUES (NULL), (1)) AS o(k),
LATERAL (
    SELECT count(*) AS c
    FROM (VALUES (1)) AS i(k)
    WHERE i.k = o.k
    GROUP BY GROUPING SETS ((), ())
) AS a
ORDER BY ALL;

SELECT o.k, a.c, a.g, a.h
FROM (VALUES (1), (7)) AS o(k),
LATERAL (
    SELECT count(*) AS c, g, h
    FROM (VALUES (1, 10, 100)) AS i(k, g, h)
    WHERE i.k = o.k
    GROUP BY ROLLUP (g, h)
) AS a
ORDER BY ALL;

SELECT o.k, (
    SELECT GROUPING(g)
    FROM (VALUES (1, 10)) AS i(k, g)
    WHERE i.k = o.k
    GROUP BY GROUPING SETS ((g), ())
) AS gm
FROM (VALUES (7)) AS o(k)
ORDER BY ALL;

SELECT o.k, (
    SELECT count(*)
    FROM (VALUES (1)) AS i(k)
    WHERE i.k = o.k
    GROUP BY GROUPING SETS (())
) AS c
FROM (VALUES (1), (7)) AS o(k)
ORDER BY ALL;

SET delim_join_as_cte = false;

SELECT count(*) FROM notes d
WHERE NOT EXISTS (
    SELECT 1 FROM notes AS a, unnest(CAST(a.payload AS JSON[])) AS t(item)
    WHERE a.id = d.id AND json_valid(a.payload) AND json_extract_string(t.item, '$.kind') = 'X');

SELECT count(*)
FROM docs, unnest(CAST(docs.doc AS JSON[])) AS t(thread), unnest(CAST(json_extract(thread, '$.items') AS JSON[])) AS i(item)
WHERE json_extract_string(item, '$.type') = 'a';

SELECT count(*)
FROM docs LEFT JOIN LATERAL unnest(CAST(json_extract(docs.doc, '$[0].items') AS JSON[])) AS i(item) ON true
WHERE item IS NULL;

SELECT count(*) FROM (SELECT * FROM raw WHERE json_valid(doc)) r
WHERE EXISTS (SELECT 1 FROM unnest(CAST(r.doc AS JSON[])) AS i(item) WHERE json_extract_string(item, '$.type') = 'a')
  AND json_extract_string(r.doc, '$[0].type') = 'a';

SELECT NULL
FROM
  (SELECT 42 AS c1) AS ref,
  LATERAL (SELECT NULL
   FROM
     (SELECT NULL) AS r2,
     (SELECT (SELECT (SELECT ref.c1))) AS r3) AS r4;

select *
  from
  (values (1), (2)) t2(x), lateral (select sum(a) from (select 42 a) where x=1)
order by all;

SELECT * FROM integers CROSS JOIN LATERAL (SELECT [i + 1]) t(k) CROSS JOIN LATERAL (SELECT UNNEST(k)) t2(l) ORDER BY i;

SELECT o.k, q.x, q.ts
FROM (VALUES (1), (2)) o(k), LATERAL (
    SELECT v.x, r.ts
    FROM (SELECT o.k + 2 AS x) v
    ASOF JOIN (VALUES (0), (2)) r(ts)
        ON v.x >= r.ts + o.k
) q ORDER BY ALL;

SELECT o.k, q.x, q.ts
FROM (VALUES (1), (2)) o(k), LATERAL (
    SELECT v.x, r.ts
    FROM (VALUES (4)) v(x)
    ASOF JOIN (VALUES (0), (2)) r(ts)
        ON v.x - o.k >= r.ts + o.k - o.k
) q ORDER BY ALL;

SELECT o.k, q.x, q.ts
FROM (VALUES (1), (2)) o(k), LATERAL (
    SELECT v.x, r.ts
    FROM (SELECT o.k + 2 AS x) v
    ASOF JOIN (VALUES (0), (2)) r(ts)
        ON v.x <= r.ts + o.k
) q ORDER BY ALL;

SELECT o.k, q.x, q.ts
FROM (VALUES (1), (2)) o(k), LATERAL (
    SELECT v.x, r.ts
    FROM (SELECT o.k + 2 AS x) v
    ASOF JOIN (VALUES (0), (2)) r(ts)
        ON v.x >= r.ts
) q ORDER BY ALL;

SELECT o.k, q.ts::VARCHAR
FROM (VALUES (1), (2)) o(k), LATERAL (
    SELECT r.ts
    FROM (SELECT TIMESTAMP '2000-01-01' + to_days(o.k + 2) AS t) v
    ASOF JOIN (VALUES (TIMESTAMP '2000-01-01'), (TIMESTAMP '2000-01-03')) r(ts)
        ON v.t >= r.ts + to_days(o.k)
) q ORDER BY ALL;

SELECT o.k, q.x, q.a, q.b
FROM (VALUES (1), (2)) o(k), LATERAL (
    SELECT l.x, r.ts AS a, s.ts AS b
    FROM (VALUES (4)) l(x)
    ASOF JOIN (VALUES (1)) r(ts) ON l.x - o.k >= r.ts
    ASOF JOIN (VALUES (2)) s(ts) ON l.x - o.k >= s.ts
) q ORDER BY ALL;

CREATE SEQUENCE seq_domain START 1;

SELECT l.x, r.y
FROM (VALUES (10)) l(x)
JOIN (VALUES (2)) r(y)
    ON l.x > r.y + nextval('seq_rhs');

CREATE SEQUENCE seq_mark START 1;

SELECT o.k, q.x, q.y
FROM (VALUES ('bad')) o(k), LATERAL (
    SELECT l.x, r.y
    FROM (VALUES (1)) l(x)
    LEFT JOIN range(0) r(y) ON l.x + o.k::BIGINT > r.y
) q;

SELECT o.k, q.x
FROM (VALUES (1)) o(k), LATERAL (
    SELECT l.x FROM (VALUES (1)) l(x)
    ASOF ANTI JOIN range(0) r(y)
        ON l.x + nextval('seq_probe_lazy') + o.k >= r.y
) q;

CREATE SEQUENCE seq_pmj_build START 1;

CREATE SEQUENCE seq_pmj_right START 1;

SELECT o.k, q.x
FROM (VALUES (1), (2)) o(k), LATERAL (
    SELECT l.x FROM (VALUES (3)) l(x)
    ASOF ANTI JOIN (SELECT 2 AS ts WHERE 1=0) r ON l.x - o.k >= r.ts
) q ORDER BY ALL;

SELECT count(*)
FROM (VALUES (1), (1), (1)) o(k), LATERAL (
    SELECT r.y
    FROM (VALUES (0)) l(x)
    JOIN (SELECT o.k AS y) r
        ON l.x + nextval('seq_probe_domain') = r.y
) q;

RESET delim_join_as_cte;

CREATE TABLE tbl (
	x INTEGER
);

CREATE MACRO m1_untyped(a) AS a + 1;

SELECT v, f FROM tbl t LEFT JOIN LATERAL (SELECT m1(t.v) AS f) _ ON true ORDER BY v NULLS LAST;

SELECT f FROM (SELECT 1 AS v, 2 AS w) t, LATERAL (SELECT m2(t.v, t.w) AS f) _;

CREATE MACRO tm(a INTEGER) AS TABLE SELECT a + 1 AS f;

SELECT f FROM (SELECT 1 AS v) t, LATERAL (SELECT m1(41) AS f) _;

SELECT q.f FROM (VALUES (1)) t(v), LATERAL (SELECT (SELECT m1(t.v)) AS f) q;

CREATE MACRO wm(a INTEGER) AS sum(a);

CREATE MACRO tmd(a INTEGER) AS TABLE SELECT 42 AS f;

SELECT * FROM integers LEFT JOIN LATERAL (SELECT integers.i) t(b) ON (i=b) ORDER BY i;

SET delim_join_as_cte=false;

CREATE TABLE person(id BIGINT PRIMARY KEY, selected BOOLEAN);

SELECT count(*) FROM nested_walk WHERE id=-1;

SELECT count(*),sum(x),max(x) FROM deeply_nested WHERE selected;

WITH o AS MATERIALIZED (SELECT id FROM person WHERE selected)
SELECT count(*),sum(q.v)>0 FROM o JOIN (
    SELECT i.id,nextval('target_calls') v,r.x FROM person i, LATERAL (
        WITH RECURSIVE walk(x) AS (
            SELECT i.id UNION ALL SELECT x+1 FROM walk WHERE x<i.id+2
        ) SELECT max(x) x FROM walk
    ) r
) q ON o.id=q.id;

SELECT o.k, a.s
FROM (VALUES (1), (7)) AS o(k),
LATERAL (SELECT DISTINCT sum(i.v) AS s FROM (VALUES (1, 42)) AS i(k, v) WHERE i.k = o.k) AS a
ORDER BY ALL;

CREATE TABLE vertices AS SELECT i::INTEGER AS id FROM range(1, 101) t(i);

EXPLAIN SELECT count(*) FROM (SELECT depth, key AS id FROM (SELECT depth, id AS key FROM walk_rows) a) b WHERE id = 3;

SELECT count(*) FROM (SELECT id, id IS NULL AS missing FROM walk_rows) q WHERE id = 3 OR missing;

EXPLAIN SELECT count(*) FROM (SELECT * FROM walk_rows LIMIT 1) q WHERE id = 3;

SELECT count(*) FROM walk_rows WHERE id = 3;

DELETE FROM vertices;

SELECT * FROM (SELECT [1,2,3,4]::INTEGER[] AS xs, r AS i FROM range(1, 3) t(r)) s
CROSS JOIN (SELECT xs[j] AS a FROM (SELECT elem AS j FROM (SELECT unnest(range(i, 5)) AS elem) b) r) e
ORDER BY i, a;

SELECT * FROM (SELECT [1,2,3]::INTEGER[] AS xs, 5 AS i) s
LEFT JOIN LATERAL (SELECT xs[j] AS a FROM (SELECT elem AS j FROM (SELECT unnest(range(i+1, 4)) AS elem) b) r) e ON true;

SELECT xs, i, (SELECT max(xs[j]) FROM (SELECT elem AS j FROM (SELECT unnest(range(i+1, 4)) AS elem) b) r) AS a
FROM (SELECT [1,2,3]::INTEGER[] AS xs, 1 AS i) s;

SET disabled_optimizers='';

INSERT INTO t VALUES (1, 10, 20, 30, [1, 2]), (2, 10, 20, 30, [1, 2]), (3, NULL, 5, NULL, []), (4, NULL, NULL, NULL, NULL), (5, 7, 7, 7, [NULL, 3]), (6, 1, 2, 3, [4]);

SELECT id, v FROM t, UNNEST([a]) AS u(v) ORDER BY ALL;

SELECT id, v FROM t, LATERAL (SELECT v FROM (SELECT unnest([a, b, c]) AS v) WHERE v > 5 AND a IS NOT NULL) ORDER BY ALL;

SELECT id, u.v, name FROM t CROSS JOIN UNNEST([a, b, c]) AS u(v) JOIN names ON names.v = u.v ORDER BY ALL;

SELECT id, v, o FROM t, UNNEST([a, b, c]) WITH ORDINALITY AS u(v, o) ORDER BY ALL;

SELECT id, v FROM t, UNNEST([a::VARCHAR, 'k' || b]) AS u(v) ORDER BY ALL;

SELECT id, v FROM t JOIN UNNEST([a, b, c]) AS u(v) ON v > b ORDER BY ALL;

SELECT id, (SELECT sum(v) FROM (SELECT t.a + 1 AS k) q, UNNEST([q.k, 100]) AS u(v)) FROM t ORDER BY ALL;

SELECT id, v, w FROM t, LATERAL (SELECT unnest(l) AS v, unnest([a, b, c]) AS w) WHERE id > 4 ORDER BY ALL;

SELECT id, v FROM t, LATERAL (SELECT unnest([a, b, c]) AS v WHERE b > 5) ORDER BY ALL;

PREPARE p AS SELECT id, v FROM t, UNNEST([a, ?::INTEGER]) AS u(v) WHERE id > 4 ORDER BY ALL;

CREATE TABLE z(id INTEGER, a DOUBLE, f FLOAT);

SELECT id, v FROM z, UNNEST([signbit(a), signbit(f)]) AS u(v) ORDER BY ALL;

SELECT id, v FROM (SELECT id, unnest([i]) AS v FROM iz) ORDER BY id;

SELECT id, v FROM (SELECT id, unnest([s, s || 'x']) AS v FROM cz) ORDER BY id, v COLLATE "C";

INSERT INTO guarded VALUES (1, '[1, 2]'), (2, 'not a list'), (3, '[3]'), (4, NULL);

SELECT id, v FROM guarded, LATERAL (SELECT v FROM (SELECT unnest(CAST(s AS INTEGER[])) AS v WHERE s LIKE '[%')) ORDER BY ALL;

SELECT nextval('on_seq');

EXPLAIN SELECT id, v FROM t, UNNEST(list_reverse(l)) AS u(v);

EXPLAIN SELECT id, u.v, w.x FROM t, UNNEST([a, b]) AS u(v), UNNEST([u.v, c]) AS w(x);

EXPLAIN SELECT id, k FROM t, LATERAL (SELECT k FROM (SELECT v AS k, a IS NULL AS n FROM (SELECT unnest([b, c]) AS v) WHERE v > 5) WHERE NOT n);

EXPLAIN SELECT id, v FROM z, UNNEST([a, f]) AS u(v);

EXPLAIN SELECT id, v FROM t, UNNEST([a, (random() * 0)::INTEGER]) AS u(v);

EXPLAIN SELECT count(*) FROM dup JOIN UNNEST([a]) AS u(v) ON nextval('on_seq') > v;

SET explain_output = 'physical_only';

SELECT * FROM integers a, integers b JOIN LATERAL (VALUES (a.i)) ss(x) ON (true) ORDER BY a.i, b.i;

INSERT INTO INT2_TBL(f1) VALUES
  ('0   '),
  ('  1234 '),
  ('    -1234'),
  ('32767'),  -- largest and smallest values
  ('-32767');

CREATE TABLE TEXT_TBL (f1 text);

select * from
  (select 1 as x) ss1 left join (select 2 as y) ss2 on (true),
  lateral (select ss2.y as z limit 1) ss3;

select ss2.* from
  int4_tbl i41
  left join int8_tbl i8
    join (select i42.f1 as c1, i43.f1 as c2, 42 as c3
          from int4_tbl i42, int4_tbl i43) ss1
    on i8.q1 = ss1.c2
  on i41.f1 = ss1.c1,
  lateral (select i41.*, i8.*, ss1.* from text_tbl limit 1) ss2
where ss1.c2 = 0;

select *, (select r from (select q1 as q2) x, (select q2 as r) y) from int8_tbl;

select count(*) from tenk1 a,
  tenk1 b join lateral (values(a.unique1),(-1)) ss(x) on b.unique2 = ss.x;

select * from (select f1 // 1000000000 from int4_tbl) x(lb),
  lateral generate_series(lb,4) x4
ORDER BY ALL;

select * from xx1;

SELECT (SELECT o.* EXCLUDE (j)) FROM outer_rows o ORDER BY 1;

SELECT x.i FROM outer_rows o,
LATERAL (
	SELECT y.* FROM (VALUES (7)) o(i), LATERAL (SELECT o.*) y
) x ORDER BY ALL;

SELECT x.renamed_i, x.j FROM outer_rows o,
LATERAL (SELECT o.* RENAME (i AS renamed_i)) x ORDER BY ALL;

SELECT x.* FROM generated_outer o, LATERAL (SELECT o.*) x ORDER BY ALL;

EXECUTE qualified_star_plan(2);

select * from (select array[1, 2, 3] a), unnest((select (select (select a))));

select * from (select [42, 43, 44]) t(a), (select unnest(t.a)) order by all;

select * from (select array[42, 43, 44]) t(a) join (select unnest(t.a)) t2(b) on (true) order by all;

select * from (select 42) t(a) join lateral (select t.a + 1) t2(b) on (true);

CREATE TABLE exams(sid INTEGER, course VARCHAR, curriculum VARCHAR, grade INTEGER, year INTEGER);

INSERT INTO exams VALUES (2, 'Database Systems', 'CS', 7, 2015);

insert into t values (1),(2),(3),(4),(4);

SELECT ARRAY(SELECT i FROM t ORDER BY t.rowid);

select array(select * from unnest(['a', 'b']) as _t(u) order by if(u='a',100, 1)) as out;

SELECT i, ARRAY(
	SELECT i1.i FROM integers i1, integers i2, integers i3, integers i4 WHERE i1.i=integers.i LIMIT 3
) top
FROM integers
ORDER BY i;

SELECT i, (WITH c AS (SELECT (SELECT v) AS r FROM (SELECT 1 AS v) s) SELECT r + i1.i FROM c) FROM integers i1 ORDER BY i NULLS FIRST;

SELECT i, (WITH c AS MATERIALIZED (WITH d AS MATERIALIZED (SELECT (SELECT v) AS r FROM (SELECT 1 AS v) s) SELECT r FROM d) SELECT r + i1.i FROM c) FROM integers i1 ORDER BY i NULLS FIRST;

SELECT i, (WITH c AS MATERIALIZED (SELECT (SELECT v) AS r FROM (SELECT 1 AS v) s) SELECT (SELECT r FROM c) + (SELECT max(r) FROM c) + i1.i) FROM integers i1 ORDER BY i NULLS FIRST;

SELECT (WITH c AS MATERIALIZED (SELECT (SELECT v) AS r FROM (SELECT 1 AS v) s) SELECT r FROM c);

CREATE TABLE stores(day DATE, is_open INT);

SELECT x::BIGINT, (SELECT x::BIGINT) FROM t GROUP BY 1 ORDER BY 1 NULLS LAST;

SELECT x::BIGINT, (SELECT x::BIGINT) FROM t GROUP BY x::BIGINT ORDER BY 1 NULLS LAST;

CREATE TABLE u(x INT);

SELECT x::BIGINT, count(*), (SELECT x::BIGINT) FROM t GROUP BY ROLLUP(1) ORDER BY 1 NULLS LAST, 2;

CREATE TABLE sales(id INT, ts TIMESTAMP, region VARCHAR, amount INT);

SELECT ts::DATE AS day, count(*) AS n,
       (SELECT sum(t.target) FROM targets t WHERE t.day = ts::DATE) AS day_target,
       (SELECT count(*) FROM targets t WHERE t.day < ts::DATE) AS earlier_days
FROM sales GROUP BY 1 ORDER BY 1 NULLS LAST;

SELECT s.ts::DATE AS day, t.region, sum(s.amount) AS total, max(t.target) AS target,
       (SELECT count(*) FROM targets t2 WHERE t2.day = s.ts::DATE) AS targets_that_day
FROM sales s JOIN targets t ON t.day = s.ts::DATE AND t.region = s.region
GROUP BY 1, 2 ORDER BY 1, 2;

CREATE TABLE lookup AS SELECT 2 AS v;

SET pivot_filter_threshold=0;

INSERT INTO lists VALUES ([1, 2]), ([3]);

SELECT MIN(i), (SELECT SUM(i1.i)) FROM integers i1;

SELECT i, (SELECT SUM(i + 1) OVER ()) FROM integers ORDER BY i;

SELECT (SELECT SUM(list_transform([1, 2], lambda unshadowed: unshadowed + i1.i)[1])) FROM integers i1;

SELECT b FROM t WHERE (1 IN ((SELECT max(1) WHERE b), 1)) <> b;

SELECT b FROM t WHERE b <> (1 IN ((SELECT max(1) WHERE b), 1));

INSERT INTO t VALUES (true), (NULL);

SELECT (SELECT count(*) FROM (SELECT unnest(l) AS x) a JOIN (SELECT unnest(l) AS x) b ON a.x = b.x)
FROM (SELECT [1, 1, NULL] AS l);

SELECT (SELECT count(*) FROM (SELECT unnest(l) AS x) a JOIN (SELECT unnest(l) AS x) b ON a.x = b.x)
FROM (SELECT list(CASE WHEN i % 10 = 0 THEN NULL ELSE i END ORDER BY i) AS l FROM range(100) r(i));

SELECT id, (SELECT count(*) FROM (SELECT unnest(l) AS x) a LEFT JOIN (SELECT unnest(l) AS x) b ON a.x = b.x)
FROM (VALUES (1, [1, NULL, 1]), (2, [NULL, 2, 2, 2]), (3, [3]), (4, [NULL]), (5, NULL)) t(id, l)
ORDER BY id;

CREATE TABLE table2(i INTEGER);

SELECT (SELECT max((SELECT subq_0.c0 AS c1)) OVER () AS c6) FROM (SELECT NULL AS c0) AS subq_0;

INSERT INTO int4_tbl VALUES (0), (123456), (-123456), (2147483647), (-2147483647);

select q1, (select q1) as ss
from int8_tbl i81 full outer join int8_tbl i82 using (q1)
group by q1 order by q1;

select (select a),
       (select b),
       (select grouping(a, b)),
       (select sum(t1.v)),
       (select max(t2.c))
  from gstest1 t1 full join gstest2 t2 using (a,b)
 group by grouping sets ((a, b), ())
 order by 1 nulls last, 2 nulls last;

SELECT ROW(1, 2) IN (SELECT i, i + 1 FROM integers);

SELECT ROW(1, 2) IN (SELECT i1.i, i1.i + 1)
FROM integers i1;

SELECT * FROM integers s1 INNER JOIN integers s2 ON (SELECT 2*SUM(i)*s1.i FROM integers)=(SELECT SUM(i)*s2.i FROM integers) ORDER BY s1.i;

SELECT * FROM integers s1 LEFT OUTER JOIN integers s2 ON s1.i=s2.i AND (SELECT CASE WHEN s2.i>2 THEN TRUE ELSE FALSE END) ORDER BY s1.i;

SELECT i, (SELECT row_number() OVER (ORDER BY i)) FROM integers i1 ORDER BY i;

SELECT i, (SELECT i FROM integers WHERE i=i1.i INTERSECT SELECT i FROM integers WHERE i=i1.i) AS j FROM integers i1 ORDER BY i;

SELECT EXISTS(SELECT t1.b+t1.c) FROM tbl t1;

SELECT * FROM tbl t1 LEFT JOIN tbl t2 ON (SELECT t2.a)<100;

SELECT (
  SELECT r.ret FROM (
    SELECT CAST((SELECT count(p)) AS BIGINT) AS ret
    FROM (SELECT caller.v AS p) AS sc0
  ) AS r
)
FROM (SELECT 7 AS v) AS caller(v);

SELECT v, (
  SELECT r.ret FROM (
    SELECT CAST((SELECT count(p)) AS BIGINT) AS ret
    FROM (SELECT s.w AS p FROM s WHERE s.w = t.v) AS sc0
  ) AS r
)
FROM t ORDER BY v NULLS LAST;

SELECT (SELECT (SELECT count(p)) FROM (SELECT caller.v AS p) sc0 GROUP BY p) FROM (SELECT 7 AS v) caller(v);

SELECT v, (SELECT v IN (SELECT count(p)) FROM (SELECT s.w AS p FROM s WHERE s.w = t.v) sc0) FROM t ORDER BY v NULLS LAST;

SELECT v, (SELECT (SELECT count(p) + CASE WHEN random() >= 0 THEN 0 ELSE 0 END) FROM (SELECT s.w AS p FROM s WHERE s.w = t.v) sc0) FROM t ORDER BY v NULLS LAST;

SELECT v, (SELECT (SELECT count(p)) FROM (SELECT s2.w AS p FROM s2 WHERE s2.w = t2.v) sc0) FROM t2 ORDER BY v NULLS LAST;

CREATE TABLE a(x INT);

SELECT (SELECT count(*) + (SELECT w.x) FROM a WHERE a.x = w.x) FROM w ORDER BY w.x;

SELECT i, (SELECT COUNT(*) FROM (SELECT i1.i FROM integers GROUP BY GROUPING SETS((i1.i), (), (i1.i), (i1.i, i1.i))) tbl) AS j FROM integers i1 ORDER BY i;

INSERT INTO outer_values VALUES (1), (2);

SELECT outer_values.i,
       EXISTS (SELECT sum(inner_values.i) FROM inner_values WHERE inner_values.i = outer_values.i HAVING true),
       1 IN (SELECT sum(inner_values.i) FROM inner_values WHERE inner_values.i = outer_values.i HAVING true)
FROM outer_values
ORDER BY outer_values.i;

EXPLAIN SELECT (SELECT avg(inner_values.i) * 0.2
                FROM inner_values
                WHERE inner_values.i = outer_values.i
                HAVING true)
FROM outer_values;

SELECT COUNT(DISTINCT
	(SELECT concat(gen_random_uuid()::VARCHAR, r::VARCHAR))
  ) as total_seats
FROM (SELECT 1 FROM generate_series(1, 100, 1)) AS t(r);

SELECT i, (SELECT 42+i1.i FROM integers) AS j FROM integers i1 ORDER BY i;

SELECT i, EXISTS(SELECT i FROM integers WHERE 1=0 AND i1.i=i) AS j FROM integers i1 ORDER BY i;

SELECT x, (SELECT count(*) FROM (SELECT v FROM generate_series(1, 100) t(v) WHERE v >= x LIMIT 9223372036854775807 OFFSET 1)) FROM (VALUES (3), (100)) t(x) ORDER BY x;

SELECT i, (SELECT 42 WHERE i1.i IS NULL) AS j FROM integers i1 ORDER BY i;

SELECT i, (SELECT CASE WHEN sum(i) > 1 THEN 0 ELSE 1 END FROM integers WHERE i=i1.i) FROM integers i1 ORDER BY ALL;

SELECT
  (
    WITH nt AS (SELECT length(s) AS n)
    SELECT (FROM (FROM nt) WHERE 'a' = s[n])
  ) AS a1,
  (
    WITH nt AS (SELECT length(s) AS n)
    SELECT (FROM (FROM nt) WHERE 'a' = s[n])
  ) AS a2
FROM unnest(['a','ab']) _(s);

SELECT i, (WITH i2 AS (SELECT 42+i1.i AS j FROM integers) SELECT j FROM i2 LIMIT 0) AS j FROM integers i1 ORDER BY i;

SELECT i, (WITH i2 AS (SELECT i+i1.i FROM integers ORDER BY 1 NULLS LAST LIMIT 1 OFFSET 1) SELECT * FROM i2) AS j FROM integers i1 ORDER BY i;

SELECT i, (WITH i2 AS (SELECT i+1 FROM integers WHERE i=i1.i) SELECT * FROM i2) AS j FROM integers i1 ORDER BY i;

SELECT i, (SELECT SUM((SELECT i + 1)) OVER () WHERE i>=2) FROM integers ORDER BY i;

SELECT i, (SELECT COUNT(*) FROM integers i2 WHERE i2.i>i1.i) FROM integers i1 ORDER BY i;

SELECT i, (SELECT i FROM integers i2 WHERE i-2=(SELECT COUNT(*) FROM integers i2 WHERE i2.i>i1.i)) FROM integers i1 ORDER BY 1;

INSERT INTO integers VALUES (1, 1), (2, 2), (3, 3), (4, NULL);

CREATE TABLE another_T (col1 INT, col2 INT, col3 INT, col4 INT, col5 INT, col6 INT, col7 INT, col8 INT);

SELECT col1 IN (SELECT ColID + col1 FROM tbl_ProductSales) FROM another_T GROUP BY col1;

SELECT CASE WHEN 1 IN (SELECT MAX(col7) UNION ALL (SELECT MIN(ColID) FROM tbl_ProductSales INNER JOIN another_T t2 ON t2.col5 = t2.col1)) THEN 2 ELSE NULL END FROM another_T t1;

SELECT (SELECT MIN(ColID) FROM tbl_ProductSales INNER JOIN another_T t2 ON t1.col7 <> ANY(SELECT MAX(t1.col1 + t3.col4) FROM another_T t3)) FROM another_T t1;

CREATE TABLE test (x INT, y INT);

create table r as select * from values (1, 1, 'a', 'A'), (1, null, 'b', 'B'), (1, 2, 'c', 'C'), (2, null, 'd', 'D') t(ra, rb, x, y);

CREATE TABLE t1(fuel_type VARCHAR, location_country VARCHAR);

WITH __activity_data AS
(
	SELECT  *
	FROM
	(
		VALUES ( 'natural_gas', 'US', 'PGE', 'CA', 'SF', json('{}'))
	) AS t("fuel", "country", "grid", "state", "city", tags)
), "fuel_kgco2e_per_mmbtu" AS
(
	SELECT  *
	       ,ROW_NUMBER() over () AS row_id
	FROM
	( VALUES ('natural_gas', 'US', NULL, 'CA', 'SF', 2),
	) AS t( fuel_type, location_country, location_grid, location_state, location_city, kgco2e_per_mmbtu)
), __input AS
(
	SELECT  *
	       ,ROW_NUMBER() OVER () AS __input_row_id
	FROM "__activity_data"
), "fuel_kgco2e_per_mmbtu__1" AS
(
	SELECT  *
	       ,ROW_NUMBER() OVER () AS __row_id
	FROM "fuel_kgco2e_per_mmbtu"
), __stage0 AS
(
	SELECT  __input_row_id
	       ,fuel    AS "__input.fuel"
	       ,country AS "__input.country"
	       ,grid    AS "__input.grid"
	       ,state   AS "__input.state"
	       ,city    AS "__input.city"
	FROM __input
)
SELECT  __p.*
       ,(
SELECT  { 'kgco2e_per_mmbtu': FIRST("kgco2e_per_mmbtu")
       ,__row_id: FIRST(__row_id)
       ,__candidates: LIST(__row_id) }
FROM
(
	SELECT  *
	FROM "fuel_kgco2e_per_mmbtu__1"
	WHERE "fuel_type" IS NOT DISTINCT
	FROM "__input.fuel"
	ORDER BY "location_country" IS NOT NULL DESC, "location_grid" IS NOT NULL DESC, "location_state" IS NOT NULL DESC, "location_city" IS NOT NULL DESC
	LIMIT 1
)
GROUP BY  TRUE )            AS __ref1
         ,CAST(1 AS DOUBLE) AS "__p.__functional_unit__"
FROM __stage0 AS __p;

SELECT array_rv_coal(arr) FROM t ORDER BY arr;

INSERT INTO test VALUES (11, 1, 'a'), (12, 2, 'b'), (13, 3, 'c');

SELECT * FROM test WHERE EXISTS(SELECT * FROM test2 WHERE test.a=test2.a AND test.b<>test2.c) order by b;

SELECT 1+(SELECT 1);

SELECT (SELECT 42);

EXPLAIN SELECT (SELECT 42 WHERE false LIMIT 1);

INSERT INTO test VALUES (11, 22);

CREATE TABLE t1(a INTEGER, b INTEGER, c INTEGER, d INTEGER, e INTEGER);

SELECT a, (SELECT SUM(b) FROM test tsub WHERE test.a=tsub.a) FROM test;

SELECT * FROM test WHERE EXISTS (SELECT a FROM test ts WHERE ts.a = test.a AND b>21);

SELECT 1=(WITH cte AS (SELECT NULL) SELECT * FROM cte);

SELECT (WITH cte AS (SELECT a * 42 FROM test) SELECT * FROM cte) IN (462, 504, 546);

SELECT n, x, (WITH cte AS (SELECT n AS v) SELECT (SELECT v FROM cte WHERE x = 10 LIMIT 1)) AS z
FROM (VALUES (1,10),(1,20),(2,10),(2,20)) t(n,x)
ORDER BY n, x;

SELECT * FROM (WITH cte AS (SELECT 42 AS a, 44 AS a) SELECT * FROM cte) tbl1;

SELECT i IN (SELECT i1.i FROM generate_series(1, 2, 1) tbl(i) RIGHT JOIN (SELECT * FROM integers i1 WHERE i1.i=integers.i) i1 ON i1.i=tbl.i) FROM integers ORDER BY i NULLS LAST;

SELECT * FROM item i1 WHERE (SELECT count(*) AS item_cnt FROM item WHERE (i_manufact = i1.i_manufact AND i_manufact=3) OR (i_manufact = i1.i_manufact AND i_manufact=3)) > 0 ORDER BY 1 LIMIT 100;

SELECT TRY((SELECT max(10 // i) FROM integers));

SELECT TRY((SELECT 10 // (i - 1) FROM integers WHERE i = 1));

SELECT o.i, TRY((SELECT max(i2.i + o.i) FROM integers i2)) FROM integers o ORDER BY o.i;

SELECT TRY((SELECT max(i) FROM integers WHERE i > 100));

SELECT TRY((SELECT max(10 // i) + min(i) FROM integers));

SELECT TRY((SELECT max(10 // (i - 3)) FROM integers GROUP BY i < 100));

RESET debug_verify_aggregate_state_export;

SELECT TRY((SELECT (SELECT 10 // (i - 3) FROM integers WHERE i = 3) + 1));

SELECT i FROM integers WHERE TRY((SELECT max(10 // (i2.i - 3)) FROM integers i2)) IS NULL ORDER BY i;

SELECT TRY((SELECT i FROM integers ORDER BY i DESC LIMIT 1));

WITH c AS MATERIALIZED (SELECT 10 AS x) SELECT TRY((SELECT max(x) FROM c));

UPDATE update_target SET a = TRY((SELECT max(10 // (i - 3)) FROM integers));

SELECT TRY(1 + (SELECT i FROM integers WHERE i > 100));

SELECT TRY(CAST((SELECT 7) AS INTEGER));

SELECT TRY(COALESCE((SELECT (SELECT 1 // 1)), 42));

SELECT TRY((SELECT 10 // i FROM (VALUES (0)) t(i) ORDER BY ALL));

SELECT TRY(1 + (WITH c AS MATERIALIZED (SELECT DISTINCT i FROM (VALUES (1)) t(i)) SELECT i FROM c));

SELECT o.i,
       TRY(1 + (SELECT 10 // count(1 // x) FROM (VALUES (0), (1)) t(x) WHERE x = o.i)),
       HAS_ERROR(1 + (SELECT 10 // count(1 // x) FROM (VALUES (0), (1)) t(x) WHERE x = o.i))
FROM (VALUES (0), (1), (0)) o(i) ORDER BY o.i;

SELECT TRY((SELECT * FROM integers WHERE i = 2));

CREATE MACRO div_shift(a) AS 10 // (a - 3);

SELECT TRY((SELECT s.upper() FROM (VALUES ('inner')) a(s))) FROM (VALUES ('outer')) b(s);

SELECT TRY((SELECT max(10 // (i - 10)) + max(o.x) FROM (VALUES (10)) q(i))) FROM (VALUES (1), (2)) o(x);

SELECT TRY((SELECT count(*) + max(10 // i) FROM integers));

SELECT TRY((SELECT ((SELECT random()) * 0 + 1)::INTEGER));

SELECT TRY((SELECT w FROM (SELECT row_number() OVER () AS w FROM (VALUES (1)) t(i)) d));

SELECT TRY((SELECT max(10 // i) + g FROM (VALUES (1)) t(i), (VALUES (5)) s(g) GROUP BY g));

SELECT (SELECT max(i) FROM integers);

SELECT TRY('abc'::INTEGER);

SELECT TRY((SELECT COALESCE((SELECT 1//x), 42))) FROM (VALUES (1)) v(x);

SELECT TRY((SELECT max(i) + COALESCE(TRY(1 + (SELECT 1//0)), 9) FROM (VALUES (5)) t(i)));

SELECT TRY((SELECT (SELECT 1//x) FROM (VALUES (0)) t(y) GROUP BY ALL)) FROM (VALUES (0)) v(x);

DEALLOCATE try_transport;

SELECT TRY((SELECT count(*) + COALESCE(42, (SELECT 1 // 0))));

SELECT TRY((SELECT (SELECT 10 // i FROM (VALUES (0)) t(i) ORDER BY i LIMIT 1)));

SELECT TRY((SELECT count(*) IN (2, (SELECT 1 // 0))));

SELECT TRY((SELECT COALESCE(NULLIF(count(*), 2) + (SELECT 1 // 1), 42)));

SELECT * FROM integers WHERE i=(SELECT SUM(1));

SELECT i, MAX((SELECT 42)) FROM integers GROUP BY i ORDER BY i;

SELECT * FROM integers WHERE EXISTS (SELECT i, i + 2 FROM integers);

INSERT INTO strings VALUES ('hello'), ('world'), (NULL);

SELECT * FROM strings WHERE EXISTS(SELECT NULL);

SELECT (SELECT UNNEST([NULL]));

SELECT (SELECT SUM(k) FROM (SELECT UNNEST(i)) tbl(k)) FROM (VALUES ([1, 2, 3])) tbl(i);

SELECT 4=ANY(SELECT UNNEST(i)) FROM (VALUES ([1, 2, 3, NULL])) tbl(i);

SELECT (SELECT 1+i[1]=ANY(SELECT UNNEST(i))) FROM (VALUES ([1, 2, 3])) tbl(i);

UPDATE integers i1 SET i=DEFAULT WHERE i=(SELECT MIN(i) FROM integers WHERE i1.id<id);

SELECT 'hello' IN (SELECT * FROM strings WHERE v=s1.v or v IS NULL) FROM strings s1 ORDER BY v;

SELECT (SELECT v FROM strings WHERE v=s1.v) FROM strings s1 ORDER BY v;

SELECT i, (SELECT SUM(i) OVER (ORDER BY i) FROM integers WHERE i1.i=i) FROM integers i1 ORDER BY i;

CREATE VIEW v_mark AS SELECT f.id, f.customer_id, EXISTS (SELECT 1 FROM UNNEST(f.dim_ids) AS u(dim_id) WHERE u.dim_id = 8) AS has8 FROM facts f;

SELECT id, dim_names FROM v_single WHERE customer_id = 7 AND id >= 9900 ORDER BY id LIMIT 2;

SELECT id FROM v_edge WHERE customer_id = 7 AND (in8 OR max_dim = 1) ORDER BY id;

create table a(i integer);

CREATE TABLE test (i INTEGER, j INTEGER);

SELECT * FROM (SELECT i, j FROM test) AS a, (SELECT i+1 AS r,j FROM test) AS b, test WHERE a.i=b.r AND test.j=a.i ORDER BY 1;

SELECT * FROM (VALUES (42, 43));

SELECT s.name, e.course, e.grade FROM students s, exams e WHERE s.id=e.sid AND e.grade=(SELECT MAX(e2.grade) FROM exams e2 WHERE s.id=e2.sid) ORDER BY name, course;
