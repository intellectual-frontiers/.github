SET threads=1;

SELECT p, o, ms, me
FROM test MATCH_RECOGNIZE(
    PARTITION BY p
    ORDER BY o
    MEASURES A.v AS a_val, B.v as b_val, FINAL FIRST(o) AS ms, FINAL LAST(o) AS me
    ALL ROWS PER MATCH
    AFTER MATCH SKIP TO LAST B
    PATTERN (A B)
    DEFINE A as (v-1) > 0.11, B as (v2-10) > 0.2
)
ORDER BY p,o;

SELECT COUNT(*)
FROM test AS t MATCH_RECOGNIZE(
    MEASURES A.v AS a_val
    PATTERN ((A (B C)))
    DEFINE A as (v-1) > 0.11,  B as (v-1) > 0.11,  C as (v-1) > 0.11
) AS s;

SELECT COUNT(*)
FROM test AS t MATCH_RECOGNIZE(
    MEASURES A.v AS a_val
    PATTERN (((A | B) | C)+ | (D  E))
    DEFINE A as (v-1) > 0.11,  B as (v-1) > 0.11,  C as (v-1) > 0.11,  D as (v-1) > 0.11,  E as (v-1) > 0.11
) AS s;

SELECT r, n FROM (VALUES (1,10),(2,12),(3,15),(4,30),(5,31),(6,60)) t(rn, v) MATCH_RECOGNIZE(
    ORDER BY rn MEASURES first(rn) AS r, count(*) AS n ONE ROW PER MATCH AFTER MATCH SKIP TO NEXT ROW
    PATTERN (Y+) DEFINE Y AS max(Y.v) - min(Y.v) < FIRST(Y.v)
) ORDER BY r;

SELECT rn, cls, e FROM (VALUES (1,3),(3,2),(5,4),(12,1),(13,5)) t(rn, days) MATCH_RECOGNIZE(
    ORDER BY rn MEASURES CLASSIFIER() AS cls, A.rn + sum(days) - days AS e ALL ROWS PER MATCH
    PATTERN (A B*) DEFINE B AS rn <= A.rn + sum(days) - days
) ORDER BY rn;

SELECT r, n, nxt FROM (VALUES (1,100),(2,110),(3,121),(4,130),(5,131),(6,100)) t(rn, c) MATCH_RECOGNIZE(
    ORDER BY rn MEASURES first(rn) AS r, FINAL count(*) AS n, NEXT(FINAL LAST(c)) AS nxt
    ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (P+) DEFINE P AS (NEXT(c) * 1.0 / FIRST(c) - 1) / RUNNING count(*) >= 0.04
);

SELECT rn, cls FROM (VALUES (1,10),(2,9),(3,9),(4,8),(5,9),(6,9),(7,11),(8,7)) t(rn, v) MATCH_RECOGNIZE(
    ORDER BY rn MEASURES CLASSIFIER() AS cls ALL ROWS PER MATCH AFTER MATCH SKIP TO LAST PAT
    PATTERN (S ((DN+ {- FLAT -}*)+ (UP+ {- FLAT -}*)+)+ BRK) SUBSET PAT = (DN, UP, BRK)
    DEFINE UP AS v > PREV(v) AND v <= S.v, DN AS v < PREV(v), BRK AS v > S.v, FLAT AS v = PREV(v)
) ORDER BY rn;

insert into ticks values (1,10),(2,16),(3,13),(4,9);

SELECT cls FROM (VALUES (1,1),(2,1),(3,10)) t(rn,v) MATCH_RECOGNIZE(
    ORDER BY rn MEASURES CLASSIFIER() AS cls ALL ROWS PER MATCH
    PATTERN (A+ B) DEFINE A AS v < 5, B AS v > avg(A.v) * 3
) ORDER BY rn;

SELECT n FROM (VALUES (1,10),(2,NULL),(3,20)) t(rn,v) MATCH_RECOGNIZE(
    ORDER BY rn MEASURES count(*) AS n ONE ROW PER MATCH
    PATTERN (A+) DEFINE A AS coalesce(sum(A.v), 0) < 25
) ORDER BY n;

SELECT n FROM (VALUES (1,5),(2,7),(3,9)) t(rn,v) MATCH_RECOGNIZE(
    ORDER BY rn MEASURES count(*) AS n ONE ROW PER MATCH
    PATTERN (B* A+) DEFINE B AS v > 100, A AS count(B.v) = 0 AND sum(B.v) IS NULL
);

SELECT n FROM (VALUES (1,1),(2,2),(3,3)) t(rn,v) MATCH_RECOGNIZE(
    ORDER BY rn MEASURES count(*) AS n ONE ROW PER MATCH PATTERN (A+) DEFINE A AS avg(A.v) <= 2.0
);

SELECT n FROM (VALUES (1,5),(2,7),(3,9),(4,2)) t(rn,v) MATCH_RECOGNIZE(
    ORDER BY rn MEASURES count(*) AS n ONE ROW PER MATCH PATTERN (A+) DEFINE A AS count(*) <= 2
);

SELECT rn, cls FROM (VALUES (1,10,'a'),(2,20,'b'),(3,30,'a'),(4,40,'c'),(5,50,'a'),(6,60,'b')) t(rn,v,p)
MATCH_RECOGNIZE(
    ORDER BY rn MEASURES CLASSIFIER() AS cls ALL ROWS PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN ((A | B)+) DEFINE A AS p = 'a' AND sum(A.v) < 100, B AS p <> 'a'
) ORDER BY rn;

SELECT rn, cls FROM (VALUES (1,10),(2,20),(3,30),(4,40),(5,50),(6,60)) t(rn,v) MATCH_RECOGNIZE(
    ORDER BY rn MEASURES CLASSIFIER() AS cls ALL ROWS PER MATCH
    PATTERN (A B+) SUBSET U = (A, B) DEFINE A AS v < 15, B AS v > LAST(U.v, 1) AND v < 50
) ORDER BY rn;

SELECT rn, cls FROM (VALUES (1,10),(2,20),(3,30),(4,40),(5,50),(6,60)) t(rn,v) MATCH_RECOGNIZE(
    ORDER BY rn MEASURES CLASSIFIER() AS cls ALL ROWS PER MATCH
    PATTERN ({- Y Y -} X {- Y Z -}) SUBSET W = (Y, Z) DEFINE Z AS X.v > 0.7 * avg(W.v)
) ORDER BY rn;

SELECT n FROM (VALUES (1,9),(2,3),(3,7),(4,1)) t(rn,v) MATCH_RECOGNIZE(
    ORDER BY rn MEASURES count(*) AS n ONE ROW PER MATCH
    PATTERN (A+) DEFINE A AS min(A.v) <= LAST(A.v) AND count(A.v) <= 3
) ORDER BY n;

SELECT rn, cls FROM (VALUES (1,8),(2,11),(3,-2)) t(rn,v) MATCH_RECOGNIZE(
    ORDER BY rn MEASURES CLASSIFIER() AS cls ALL ROWS PER MATCH
    PATTERN (A{1,2} B+) DEFINE A AS true, B AS min(B.v) > 0
) ORDER BY rn;

create table anch(p integer, i integer, c varchar);

SELECT count(*), max(len) FROM anch MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS len
    ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (A+ $) DEFINE A AS c='a'
);

SELECT p, len FROM anch MATCH_RECOGNIZE(
    PARTITION BY p ORDER BY i MEASURES count(*) AS len
    ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (^ A{2}) DEFINE A AS c='a'
) ORDER BY p;

insert into rows_aaaaa values (0,'a'),(1,'a'),(2,'a'),(3,'a'),(4,'a');

create table rows_abcd(i integer, c varchar);

insert into rows_aaa values (0,'a'),(1,'a'),(2,'a');

create table rows_b(i integer, c varchar);

insert into rows_aab values (0,'a'),(1,'a'),(2,'b');

create table rows_ab(i integer, c varchar);

insert into rows_aa values (0,'a'),(1,'a');

create table rows_abac(i integer, c varchar);

SELECT count(*), min(len), max(len) FROM rows_aaaaa MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS len
    ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN ((A+)+)
    DEFINE A AS A.c = 'a'
);

SELECT count(*), min(len), max(len) FROM rows_aaab MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS len
    ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (A{0,3} B)
    DEFINE A AS A.c = 'a', B AS B.c = 'b'
);

SELECT count(*), min(len), max(len) FROM rows_aaaa MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS len
    ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN ((A{0,1}){4} A{4})
    DEFINE A AS A.c = 'a'
);

SELECT count(*), min(len), max(len) FROM rows_aaaaa MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS len
    ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN ((A|A){5})
    DEFINE A AS A.c = 'a'
);

SELECT count(*), min(len), max(len) FROM rows_abab MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS len
    ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN ((A B)+)
    DEFINE A AS A.c = 'a', B AS B.c = 'b'
);

SELECT count(*), min(len), max(len) FROM rows_aaab MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS len
    ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN ((A+)+ B)
    DEFINE A AS A.c = 'a', B AS B.c = 'b'
);

SELECT count(*), min(len), max(len) FROM rows_aa MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS len
    ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (A{0,1} A{0,1} A{0,1})
    DEFINE A AS A.c = 'a'
);

SELECT count(*), min(len), max(len) FROM rows_a MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS len
    ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (((A)))
    DEFINE A AS A.c = 'a'
);

SELECT count(*), min(len), max(len) FROM rows_aaab MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS len
    ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (A{2,} B)
    DEFINE A AS A.c = 'a', B AS B.c = 'b'
);

SELECT match_no, len, var_name FROM rows_aab MATCH_RECOGNIZE(
    ORDER BY i MEASURES MATCH_NUMBER() AS match_no, count(*) AS len, CLASSIFIER() AS var_name
    ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (B*)
    DEFINE B AS B.c = 'b'
) ORDER BY match_no;

FROM (VALUES (1), (2)) t(x) MATCH_RECOGNIZE (
    ORDER BY x MEASURES count(*) AS n
    PATTERN (A C | B C)
    DEFINE A AS true, B AS true, C AS FIRST(B.x) IS NOT NULL
);

FROM range(1) t(x) MATCH_RECOGNIZE (
    ORDER BY x MEASURES count(*) AS n
    PATTERN ((A*)* B)
    DEFINE A AS true, B AS FIRST(A.x) < 0
);

FROM range(3) t(x) MATCH_RECOGNIZE (
    ORDER BY x MEASURES count(*) AS n
    PATTERN ((A*?)*? B)
    DEFINE A AS true, B AS FIRST(A.x) < 0
);

CREATE TABLE long_ab AS SELECT i::INTEGER AS i, CASE WHEN i = 999 THEN 'b' ELSE 'a' END AS c FROM range(1000) t(i);

SELECT count(*), max(len) FROM long_a MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS len
    ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (A* A* A* A* B)
    DEFINE A AS A.c = 'a', B AS B.c = 'b'
);

SELECT count(*), max(len) FROM long_ab MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS len
    ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (A+ B)
    DEFINE A AS A.c = 'a', B AS B.c = 'b'
);

SELECT count(*), max(len) FROM fifty_a MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS len
    ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN ((A{0,1}){50} A{50})
    DEFINE A AS A.c = 'a'
);

SELECT g, mno, len FROM shapes MATCH_RECOGNIZE(
    PARTITION BY g ORDER BY seq
    MEASURES MATCH_NUMBER() AS mno, COUNT(*) AS len
    ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (A{1,1000})
    DEFINE A AS 1 = 1
) ORDER BY g, mno;

insert into flat values (5,1),(5,2),(5,3);

insert into t values (1,10,'a'),(2,20,'b'),(3,30,'a'),(4,40,'c'),(5,50,'a'),(6,60,'b');

SELECT c FROM t MATCH_RECOGNIZE(
    ORDER BY rn MEASURES CLASSIFIER(U) AS c ONE ROW PER MATCH
    PATTERN (A B C) SUBSET U = (A, B) DEFINE A AS p = 'a', C AS true
);

SELECT rn, c FROM t MATCH_RECOGNIZE(
    ORDER BY rn MEASURES PREV(CLASSIFIER()) AS c ALL ROWS PER MATCH PATTERN (A B) DEFINE A AS p = 'a'
) ORDER BY rn;

SELECT n FROM t MATCH_RECOGNIZE(
    ORDER BY rn MEASURES count(*) AS n ONE ROW PER MATCH
    PATTERN (A B) DEFINE A AS true, B AS NEXT(CLASSIFIER()) IS NULL
) ORDER BY n;

SELECT rn, c FROM t MATCH_RECOGNIZE(
    ORDER BY rn MEASURES CLASSIFIER() AS c ALL ROWS PER MATCH
    PATTERN (A B C D) SUBSET U = (A, B) DEFINE A AS p = 'a', D AS PREV(FIRST(CLASSIFIER(U), 1), 1) = 'A'
) ORDER BY rn;

create table q(i integer);

SELECT x FROM q MATCH_RECOGNIZE(
    ORDER BY i MEASURES i AS x AFTER MATCH SKIP PAST LAST ROW PATTERN (A A) DEFINE A as true
) ORDER BY x;

SELECT count(*) FROM q MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS n ONE ROW PER MATCH
    AFTER MATCH SKIP TO NEXT ROW PATTERN (A+) DEFINE A as true
);

SELECT x FROM q MATCH_RECOGNIZE(
    ORDER BY i MEASURES i AS x ALL ROWS PER MATCH AFTER MATCH SKIP TO NEXT ROW PATTERN (A A) DEFINE A as true
) ORDER BY x;

SELECT x FROM q MATCH_RECOGNIZE(
    PARTITION BY i%2 ORDER BY i MEASURES i AS x PATTERN (A A) DEFINE A as true
) ORDER BY x;

SELECT p, i, ms, me FROM pt MATCH_RECOGNIZE(
    PARTITION BY p ORDER BY i MEASURES i AS x, FINAL FIRST(i) AS ms, FINAL LAST(i) AS me
    ALL ROWS PER MATCH PATTERN (A A) DEFINE A as true
) ORDER BY p, i;

insert into m values (1,1,1),(1,1,2),(1,2,1),(1,2,2);

insert into coll values (5,1),(5,2),(9,3),(5,4);

insert into one values (7);

SELECT count(*) FROM empty_tbl MATCH_RECOGNIZE(
    MEASURES i AS x PATTERN (A) DEFINE A as true
);

SELECT count(*) FROM q MATCH_RECOGNIZE(
    ORDER BY i MEASURES i AS x, i+1 AS y PATTERN (A) DEFINE A as true
);

insert into wave values (1,40),(2,55),(3,61),(4,67),(5,79),(6,40),(7,49),(8,64),(9,76),(10,79),
                        (11,61),(12,49),(13,79),(14,79),(15,46),(16,40),(17,46),(18,76),(19,73),(20,70);

create table ticks(i integer, v integer);

SELECT match_no, n FROM ticks MATCH_RECOGNIZE(
    ORDER BY i MEASURES MATCH_NUMBER() AS match_no, count(*) AS n
    ONE ROW PER MATCH AFTER MATCH SKIP TO NEXT ROW
    PATTERN (R Z* B)
    DEFINE R AS R.v = 5, B AS B.v > LAST(R.v)
) ORDER BY match_no;

SELECT match_no, n FROM flags MATCH_RECOGNIZE(
    ORDER BY t MEASURES MATCH_NUMBER() AS match_no, count(*) AS n
    ONE ROW PER MATCH PATTERN (rising+ falling+) DEFINE AUTO
) ORDER BY match_no;

SELECT count(*) FROM flags MATCH_RECOGNIZE(
    DEFINE AUTO PATTERN (rising+) ORDER BY t ALL ROWS PER MATCH
);

FROM (VALUES (1), (2)) t(x) MATCH_RECOGNIZE (
    ORDER BY x MEASURES count(*) AS n PATTERN (A B) DEFINE B AS B.x > A.x
);

PREPARE mr_prepared AS
    FROM (VALUES (10), (20)) t(x) MATCH_RECOGNIZE (
        ORDER BY x MEASURES sum(x) AS s PATTERN (A+) DEFINE A AS MATCH_NUMBER() > 0
    );

CREATE MACRO m_nav(v) AS m_first(v);

FROM (VALUES (1), (2), (3)) t(x) MATCH_RECOGNIZE (
    ORDER BY x MEASURES count(*) AS n PATTERN (A B+) DEFINE B AS x > A.x
);

SELECT (SELECT sum(n) FROM (FROM range(6) t(x) MATCH_RECOGNIZE (
            ORDER BY x MEASURES count(*) AS n ONE ROW PER MATCH
            AFTER MATCH SKIP PAST LAST ROW PATTERN (A{2}) DEFINE A AS true))) AS a,
       (SELECT sum(n) FROM (FROM range(6) t(x) MATCH_RECOGNIZE (
            ORDER BY x MEASURES count(*) AS n ALL ROWS PER MATCH
            AFTER MATCH SKIP PAST LAST ROW PATTERN (A{2}) DEFINE A AS true))) AS b;

SELECT (SELECT sum(n) FROM (FROM range(6) t(x) MATCH_RECOGNIZE (
            ORDER BY x MEASURES count(*) AS n AFTER MATCH SKIP PAST LAST ROW
            PATTERN (A+) DEFINE A AS coalesce(x > PREV(x), true)))) AS a,
       (SELECT sum(n) FROM (FROM range(6) t(x) MATCH_RECOGNIZE (
            ORDER BY x DESC MEASURES count(*) AS n AFTER MATCH SKIP PAST LAST ROW
            PATTERN (A+) DEFINE A AS coalesce(x > PREV(x), true)))) AS b;

SELECT (SELECT sum(n) FROM (FROM range(6) t(x) MATCH_RECOGNIZE (
            ORDER BY x MEASURES count(*) AS n AFTER MATCH SKIP PAST LAST ROW PATTERN (A{2}) DEFINE A AS true))) AS a,
       (SELECT sum(n) FROM (FROM range(5) t(x) MATCH_RECOGNIZE (
            ORDER BY x MEASURES count(*) AS n AFTER MATCH SKIP PAST LAST ROW PATTERN (A{2}) DEFINE A AS true))) AS b;

SELECT i, n FROM (
    SELECT i, v FROM ev MATCH_RECOGNIZE(ORDER BY i ALL ROWS PER MATCH PATTERN (A+) DEFINE A AS v > 1)
) x MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS n ALL ROWS PER MATCH PATTERN (B+) DEFINE B AS v > 2
) ORDER BY i;

SELECT g, n, sum(n) OVER () AS tot FROM ev MATCH_RECOGNIZE(
    PARTITION BY g ORDER BY i MEASURES count(*) AS n PATTERN (A+) DEFINE A AS v > 0
) ORDER BY g;

SELECT count(*) FROM ev MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS n PATTERN (A B) DEFINE A AS true, B AS PREV(CLASSIFIER()) = 'A'
);

SELECT count(*) FROM ev MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS n PATTERN (A B) DEFINE A AS true, B AS CLASSIFIER() = 'B'
);

create table mt as SELECT g AS p, n FROM ev MATCH_RECOGNIZE(
    PARTITION BY g ORDER BY i MEASURES count(*) AS n PATTERN (A+) DEFINE A AS v > 0
);

INSERT INTO mi SELECT g, n FROM ev MATCH_RECOGNIZE(
    PARTITION BY g ORDER BY i MEASURES count(*) AS n PATTERN (A+) DEFINE A AS v > 0
);

EXECUTE pq(2);

SELECT n FROM (VALUES (1,1),(2,2)) t(i,v) MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS n PATTERN (A+) DEFINE A AS 1 = 1
);

create table parallel_input as
    SELECT (i // 7)::INTEGER AS p, i::INTEGER AS i, (hash(i) % 5)::INTEGER AS v FROM range(0, 7000) t(i);

SELECT column_name, column_type FROM (DESCRIBE FROM (VALUES (1), (2)) t(x) MATCH_RECOGNIZE (
    ORDER BY x ALL ROWS PER MATCH PATTERN (A+)
 DEFINE A AS true));

FROM (VALUES (10), (20)) t(x) MATCH_RECOGNIZE (
    ORDER BY x MEASURES my_sum(x) AS s PATTERN (A+)
 DEFINE A AS true);

FROM (VALUES (10), (20)) t(x) MATCH_RECOGNIZE (
    ORDER BY x MEASURES add_one(FIRST(x)) AS s PATTERN (A+)
 DEFINE A AS true);

CREATE MACRO m_two(v) AS sum(v) + count(v);

CREATE MACRO m_scalar(v) AS v + 1;

FROM (VALUES (10), (20)) t(x) MATCH_RECOGNIZE (
    ORDER BY x MEASURES m_nested(x) AS s PATTERN (A+)
 DEFINE A AS true);

CREATE MACRO m_over(a) AS sum(a), (a, b) AS sum(a) + sum(b);

FROM (VALUES (10), (20)) t(x) MATCH_RECOGNIZE (
    ORDER BY x MEASURES m_sum(x) FILTER (WHERE CLASSIFIER() = 'A') AS s PATTERN (A B)
 DEFINE A AS true);

SELECT * FROM (VALUES (1), (2)) u(k), LATERAL (
    FROM (VALUES (1), (2)) t(x) MATCH_RECOGNIZE (
        ORDER BY x MEASURES count(*) + u.k AS n PATTERN (A+)
     DEFINE A AS true)
) q ORDER BY ALL;

SELECT * FROM (VALUES (0), (5)) u(k), LATERAL (
    FROM (VALUES (1), (2), (3)) t(x) MATCH_RECOGNIZE (
        ORDER BY x MEASURES count(*) AS n PATTERN (A+)
        DEFINE A AS PREV(x) IS NULL OR PREV(x) + u.k < x
    )
) q ORDER BY ALL;

SELECT * FROM mr_view ORDER BY x;

CREATE TABLE wide AS
    SELECT i, i % 13 AS v, repeat('z', 1 + (i % 40)) AS s, {'a': i % 5, 'b': [i % 3, i % 4]} AS st
    FROM range(30000) t(i);

SELECT count(*), sum(n) FROM (
    FROM wide MATCH_RECOGNIZE (
        ORDER BY i MEASURES count(*) AS n
        PATTERN (A+)
        DEFINE A AS st.a < 4 AND (FIRST(st.b[1]) IS NOT NULL) AND MATCH_NUMBER() > 0
    )
);

create table q(i integer, j integer);

SELECT count(*) FROM q MATCH_RECOGNIZE(ORDER BY i ALL ROWS PER MATCH PATTERN (A) DEFINE A as true);

SELECT 1 FROM q MATCH_RECOGNIZE(MEASURES (SELECT min(j) FROM q) AS x PATTERN (A) DEFINE A as true);

SELECT 1 AS match_recognize;

SELECT n FROM q MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS n ONE ROW PER MATCH
    PATTERN ({- A -} B+) DEFINE B AS B.j > 0
);

SELECT j FROM q MATCH_RECOGNIZE(PARTITION BY j ORDER BY i PATTERN (A) DEFINE A as true) ORDER BY j;

SELECT count(*) FROM skips MATCH_RECOGNIZE(
    ORDER BY seq MEASURES count(*) AS n AFTER MATCH SKIP TO LAST B
    PATTERN (A+ B) DEFINE A AS c='a', B AS c='b'
);

FROM (VALUES (10), (20)) t(x) MATCH_RECOGNIZE (
    ORDER BY x MEASURES count(*) AS n PATTERN (A+) DEFINE A AS LAST(CLASSIFIER()) = 'A'
);

SELECT count(*) FROM q MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS n PATTERN (A{0,} B) DEFINE A as i > 900, B as true
);

SELECT s, t FROM q MATCH_RECOGNIZE(
    ORDER BY i MEASURES PREV(i, 0) AS s, NEXT(i, 0) AS t PATTERN (A+) DEFINE A as true
);

insert into tiers values
    (1,'lo',20),(2,'lo',30),(3,'mid',60),(4,'hi',150),(5,'lo',10),
    (6,'mid',70),(7,'mid',80),(8,'hi',120),(9,'hi',200),(10,'lo',5);

SELECT count(*) FROM tiers MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS n ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (A+ (B | C)) DEFINE A AS tier = 'lo', B AS tier = 'mid', C AS tier = 'hi'
);

SELECT count(*) FROM tiers MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS n ONE ROW PER MATCH AFTER MATCH SKIP TO LAST C
    PATTERN (A B* C) DEFINE A AS tier = 'lo', B AS tier = 'mid', C AS tier = 'hi'
);

SELECT s FROM tiers MATCH_RECOGNIZE(
    ORDER BY i MEASURES LAST(C.i) - FIRST(A.i) AS s ONE ROW PER MATCH
    PATTERN (A+ B+ C+) DEFINE A AS tier = 'lo', B AS tier = 'mid', C AS tier = 'hi'
) ORDER BY s;

SELECT count(*) FROM tiers MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS n ONE ROW PER MATCH
    PATTERN (P Q) DEFINE P AS tier = 'lo', Q AS NEXT(P.tier) = 'mid'
);

FROM (VALUES (10)) t(x) MATCH_RECOGNIZE (
    MEASURES list_transform([1, 2], lambda v: v + 1) AS s PATTERN (A)
 DEFINE A AS true);

FROM (VALUES ([1, 2], 100)) t(xs, v) MATCH_RECOGNIZE (
    MEASURES list_transform(xs, lambda w: w + v) AS s PATTERN (A)
 DEFINE A AS true);

FROM (VALUES ([2, 1]), ([1, 1])) t(xs) MATCH_RECOGNIZE (
    ORDER BY list_transform(xs, lambda v: v)[1] MEASURES count(*) AS n PATTERN (A+)
 DEFINE A AS true);

SELECT n FROM (
    FROM range(3) t(x) MATCH_RECOGNIZE (
        ORDER BY x MEASURES count(*) AS n AFTER MATCH SKIP TO NEXT ROW PATTERN (A+)
        DEFINE A AS list_transform([1], lambda v: v * MATCH_NUMBER())[1] < 3
    )
) ORDER BY n;

FROM range(3) t(x) MATCH_RECOGNIZE (
    ORDER BY x MEASURES count(*) AS n PATTERN (A+)
    DEFINE A AS list_transform([1], lambda v: v + x)[1] >= 1
);

FROM (VALUES (10)) t(x) MATCH_RECOGNIZE (
    MEASURES list_transform([{'x': 1}, {'x': 2}], lambda v: v.x + 1) AS s PATTERN (A)
 DEFINE A AS true);

SELECT s FROM (VALUES (1), (2)) t(x) MATCH_RECOGNIZE (
    ORDER BY x MEASURES sum(list_transform([{'A': x}], lambda A: A.A)[1]) AS s PATTERN (A+)
 DEFINE A AS true);

SET match_recognize_max_states=8192;

SET match_recognize_max_states=0;

RESET match_recognize_max_states;

SELECT a_val, b_val, mn, cl FROM ev MATCH_RECOGNIZE(
    ORDER BY i
    MEASURES A.i AS a_val, B.i AS b_val, MATCH_NUMBER() AS mn, CLASSIFIER() AS cl
    ONE ROW PER MATCH PATTERN (A B+) DEFINE A as v=1, B as v=0
) ORDER BY a_val;

SELECT i, c, s FROM ev MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS c, sum(i) AS s
    ALL ROWS PER MATCH PATTERN (A B+) DEFINE A as v=1, B as v=0
) ORDER BY i;

SELECT x FROM ev MATCH_RECOGNIZE(
    ORDER BY i MEASURES i*10 AS x
    ONE ROW PER MATCH PATTERN (A B+) DEFINE A as v=1, B as v=0
) ORDER BY x;

insert into im values (1),(2);

insert into pv values (1,1),(1,2),(1,3),(1,4),(2,1),(2,2);

SELECT x FROM ev MATCH_RECOGNIZE(
    ORDER BY i MEASURES i AS x PATTERN (A) DEFINE A as CLASSIFIER()='A'
) ORDER BY x;

SELECT x FROM ev MATCH_RECOGNIZE(
    ORDER BY i MEASURES i AS x PATTERN (A B+)
    DEFINE A as v=1 AND CLASSIFIER()='A', B as v=0 AND CLASSIFIER()='B'
) ORDER BY x;

SELECT x FROM q MATCH_RECOGNIZE(
    ORDER BY i MEASURES i AS x PATTERN (A) DEFINE A as MATCH_NUMBER()=1
) ORDER BY x;

SELECT x FROM q MATCH_RECOGNIZE(
    ORDER BY i MEASURES i AS x PATTERN (A A) DEFINE A as MATCH_NUMBER()<=2
) ORDER BY x;

insert into mp values (1,1),(1,2),(1,3),(2,1),(2,2),(2,3);

FROM (VALUES (1)) t(x) MATCH_RECOGNIZE (
    ORDER BY x MEASURES count(*) AS n
    PATTERN (A) DEFINE A AS CAST(1.0 / MATCH_NUMBER() AS INTEGER) = 1
);

FROM (VALUES (1)) t(x) MATCH_RECOGNIZE (
    ORDER BY x MEASURES x AS bare, LAST(x) AS navigated
    PATTERN (A*) DEFINE A AS false
);

FROM (VALUES (10), (20)) t(x) MATCH_RECOGNIZE (
    ORDER BY x
    MEASURES sum(CASE WHEN CLASSIFIER()='A' THEN x END) AS s
    PATTERN (A B)
 DEFINE A AS true);

FROM (VALUES (10), (20)) t(x) MATCH_RECOGNIZE (
    ORDER BY x
    MEASURES sum(B.x) FILTER (WHERE B.x > 15) AS s
    PATTERN (A B) DEFINE B AS x > 15
);

FROM (VALUES ([1, 2])) t(x) MATCH_RECOGNIZE (
    MEASURES unnest(x) AS u PATTERN (A)
 DEFINE A AS true);

SELECT n FROM (VALUES (1), (2)) t(x) MATCH_RECOGNIZE (
    ORDER BY x MEASURES count(*) AS c PATTERN (A+)
 DEFINE A AS true) mr(n);

CREATE TABLE qualified(x INTEGER);

FROM qualified MATCH_RECOGNIZE (
    ORDER BY x MEASURES max(qualified.x) AS m PATTERN (A+) DEFINE A AS qualified.x > 0
);

FROM (VALUES (10, 99), (20, 99)) t(x, __mr_win_0) MATCH_RECOGNIZE (
    ORDER BY x MEASURES PREV(x) AS p
    PATTERN (A)
 DEFINE A AS true);

FROM (VALUES (10)) t1(x) JOIN (VALUES (20)) t2(x) ON true
MATCH_RECOGNIZE (
    MEASURES t1.x AS ax, t2.x AS bx PATTERN (Z)
 DEFINE Z AS true);

FROM (VALUES ({'v': 10}, 99)) t(x, v) MATCH_RECOGNIZE (
    MEASURES t.x.v AS s PATTERN (A)
 DEFINE A AS true);

FROM (VALUES (10), (20)) t(x) MATCH_RECOGNIZE (
    ORDER BY t.x MEASURES sum(x) AS s PATTERN (A+)
 DEFINE A AS true);

FROM (VALUES (10, 99), (20, 99)) t(x, __mr_measure_0) MATCH_RECOGNIZE (
    ORDER BY x MEASURES sum(x) AS s PATTERN (A+)
 DEFINE A AS true);

FROM (VALUES (1, 2), (3, 4)) t(a, __pattern_window) MATCH_RECOGNIZE (
    ORDER BY a MEASURES sum(a) AS s PATTERN (A+)
 DEFINE A AS true);

FROM (VALUES (10, {'y': 20})) t("x.y", x) MATCH_RECOGNIZE (
    MEASURES "x.y" AS a, x.y AS b PATTERN (A)
 DEFINE A AS true);

INSERT INTO ticks VALUES (1), (2);

FROM mr_schema.ticks MATCH_RECOGNIZE (
    ORDER BY mr_schema.ticks.x MEASURES count(*) AS n PATTERN (A+)
 DEFINE A AS true);

FROM (VALUES (1), (2)) t(x) MATCH_RECOGNIZE (
    ORDER BY x MEASURES count(*) AS a, a + 1 AS b, b + 1 AS c PATTERN (A+)
 DEFINE A AS true);

CREATE TABLE mr_passthrough(a INTEGER, b VARCHAR);

FROM mr_passthrough MATCH_RECOGNIZE (MEASURES 1 AS m ALL ROWS PER MATCH PATTERN (A) DEFINE A AS true);

insert into nav values (1,5),(2,7),(3,6),(4,9),(5,2);

SELECT x FROM nav MATCH_RECOGNIZE(
    ORDER BY i MEASURES i AS x ALL ROWS PER MATCH PATTERN (A B)
    DEFINE A as true, B as v > LAST(A.v)
) ORDER BY x;

SELECT x FROM run MATCH_RECOGNIZE(
    ORDER BY i MEASURES i AS x ALL ROWS PER MATCH PATTERN (A B B)
    DEFINE A as true, B as v > FIRST(A.v)
) ORDER BY x;

SELECT x FROM nav MATCH_RECOGNIZE(
    ORDER BY i MEASURES i AS x ALL ROWS PER MATCH PATTERN (A B)
    DEFINE A as true, B as v > LAST(A.v) AND CLASSIFIER()='B' AND MATCH_NUMBER()=1
) ORDER BY x;

SELECT run, fin FROM ev MATCH_RECOGNIZE(
    ORDER BY i MEASURES RUNNING count(*) AS run, FINAL count(*) AS fin
    ONE ROW PER MATCH PATTERN (A B+) DEFINE A as v=1, B as v=0
) ORDER BY fin;

create table pnav(p integer, i integer, v integer);

SELECT i, next_v FROM pnav MATCH_RECOGNIZE(
    ORDER BY i MEASURES NEXT(v) AS next_v ALL ROWS PER MATCH PATTERN (A+) DEFINE A as true
) ORDER BY i;

SELECT i, prev_v FROM pnav MATCH_RECOGNIZE(
    PARTITION BY p ORDER BY i MEASURES PREV(v) AS prev_v ALL ROWS PER MATCH PATTERN (A+) DEFINE A as true
) ORDER BY i;

SELECT i, prev_v, next_v FROM pnav MATCH_RECOGNIZE(
    ORDER BY i MEASURES PREV(A.v) AS prev_v, NEXT(A.v) AS next_v
    ALL ROWS PER MATCH PATTERN (A+) DEFINE A as true
) ORDER BY i;

SELECT s, t FROM pnav MATCH_RECOGNIZE(
    ORDER BY i MEASURES PREV(FIRST(A.v), 0) AS s, PREV(FIRST(A.v, 1), 0) AS t
    PATTERN (A+) DEFINE A as true
);

create table tie(ts integer, k integer);

FROM (VALUES (10), (20)) t(x) MATCH_RECOGNIZE (
    ORDER BY x MEASURES FIRST(x, 1) AS s PATTERN (A+)
 DEFINE A AS true);

FROM (VALUES (1), (2), (3)) t(x) MATCH_RECOGNIZE (
    ORDER BY x MEASURES FIRST(x, 0) AS f, LAST(x, 0) AS l PATTERN (A+)
 DEFINE A AS true);

FROM (VALUES (1), (2), (3)) t(x) MATCH_RECOGNIZE (
    ORDER BY x MEASURES count(*) AS n PATTERN (A+)
    DEFINE A AS FIRST(x, 1) IS NULL OR FIRST(x, 1) = 2
);

create table nav_expr(i integer, v integer);

create table nav_mixed(i integer, v integer);

create table nav_nulls(i integer, v integer);

create table nav_define(i integer, v integer);

SELECT n, s FROM nav_define MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS n, FIRST(i) AS s
    ONE ROW PER MATCH PATTERN (A B+) DEFINE A AS true, B AS v > FIRST(A.v)
);

SELECT m FROM nav_lambda MATCH_RECOGNIZE(
    ORDER BY i MEASURES FIRST(list_transform(A.xs, lambda A: A.v + 100)) AS m
    ONE ROW PER MATCH PATTERN (A+) DEFINE A AS true
);

INSERT INTO pstep VALUES (1,10),(2,20),(3,30),(4,40),(5,50);

SELECT rn, c FROM pstep MATCH_RECOGNIZE(
    ORDER BY rn MEASURES CLASSIFIER() AS c ALL ROWS PER MATCH
    PATTERN (A+) DEFINE A as PREV(A.price) > 20
) ORDER BY rn;

insert into n values (1,1),(2,NULL),(3,2),(4,3),(5,NULL),(6,4);

SELECT i FROM n MATCH_RECOGNIZE(
    ORDER BY i MEASURES i AS x ALL ROWS PER MATCH PATTERN (A+) DEFINE A as v > PREV(v)
) ORDER BY i;

SELECT lav, fav FROM n MATCH_RECOGNIZE(
    ORDER BY i MEASURES LAST(A.v) AS lav, FIRST(A.v) AS fav PATTERN (A+) DEFINE A as v IS NOT NULL
) ORDER BY fav;

insert into pn values (1,1,1),(1,2,2),(NULL,3,3),(NULL,4,4),(2,5,5);

insert into onull values (1,10),(NULL,20),(2,30);

CREATE TABLE runs AS
    SELECT i // 250 AS g, i % 250 AS i, CASE WHEN (i % 250) % 7 < 3 THEN 1 ELSE 0 END AS up
    FROM range(4000) t(i);

SELECT count(*) FROM runs MATCH_RECOGNIZE (
    PARTITION BY g ORDER BY i
    MEASURES count(*) AS n ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (A+) DEFINE A AS up = 1
);

SELECT count(*) FROM runs MATCH_RECOGNIZE (
    PARTITION BY g ORDER BY i
    MEASURES count(*) AS n ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (A+) DEFINE A AS up = 1 AND i >= FIRST(i)
);

SELECT x FROM seq MATCH_RECOGNIZE(
    ORDER BY i MEASURES i AS x PATTERN (A) DEFINE A as v=1
) ORDER BY x;

SELECT x FROM seq MATCH_RECOGNIZE(
    ORDER BY i MEASURES i AS x PATTERN (A A) DEFINE A as v=1
) ORDER BY x;

SELECT x FROM seq MATCH_RECOGNIZE(
    ORDER BY i MEASURES i AS x PATTERN (A{2,3}) DEFINE A as v=1
) ORDER BY x;

SELECT x FROM seq MATCH_RECOGNIZE(
    ORDER BY i MEASURES i AS x PATTERN (A?) DEFINE A as v=1
) ORDER BY x;

SELECT i, cl FROM seq MATCH_RECOGNIZE(
    ORDER BY i MEASURES i AS x, CLASSIFIER() AS cl ALL ROWS PER MATCH PATTERN (A B?) DEFINE A as v=1, B as v=0
) ORDER BY i;

SELECT x FROM seq MATCH_RECOGNIZE(
    ORDER BY i MEASURES i AS x PATTERN (B A) DEFINE A as v=1, B as v=0
) ORDER BY x;

SELECT x FROM seq MATCH_RECOGNIZE(
    ORDER BY i MEASURES i AS x PATTERN (A+ B A+) DEFINE A as v=1, B as v=0
) ORDER BY x;

SELECT x FROM seq MATCH_RECOGNIZE(
    ORDER BY i MEASURES i AS x PATTERN ((A) (B)) DEFINE A as v=1, B as v=0
) ORDER BY x;

SELECT x FROM seq MATCH_RECOGNIZE(
    ORDER BY i MEASURES i AS x PATTERN (((A))) DEFINE A as v=1
) ORDER BY x;

SELECT count(*) FROM seq MATCH_RECOGNIZE(
    MEASURES i AS x PATTERN (((A | B) | A)+ | (B A)) DEFINE A as v=1, B as v=0
);

SELECT count(*), max(len) FROM five MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS len
    ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (A+ B)
    DEFINE A AS A.v = 'a', B AS B.v = 'a'
);

SELECT count(*), max(len) FROM five MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS len
    ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (A+ B C)
    DEFINE A AS A.v = 'a', B AS B.v = 'a', C AS C.v = 'a'
);

SELECT count(*), max(len) FROM five MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS len
    ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (A{2,4} B B)
    DEFINE A AS A.v = 'a', B AS B.v = 'a'
);

SELECT count(*), max(len) FROM five MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS len
    ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (A B+ C C)
    DEFINE A AS A.v = 'a', B AS B.v = 'a', C AS C.v = 'a'
);

SELECT count(*), max(first_day), max(len) FROM climbs MATCH_RECOGNIZE(
    ORDER BY day MEASURES FIRST(day) AS first_day, count(*) AS len
    ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (RISE+ PEAK DROP)
    DEFINE RISE AS RISE.level > PREV(RISE.level), PEAK AS true,
           DROP AS DROP.level < PREV(DROP.level)
);

insert into lbl values (1,1,10),(2,2,20),(3,1,30);

SELECT i, cl FROM lbl MATCH_RECOGNIZE(
    ORDER BY i MEASURES i AS x, CLASSIFIER() AS cl
    ALL ROWS PER MATCH PATTERN ("up down"+) DEFINE "up down" AS "up down".v > 1
) ORDER BY i;

create table abc(i integer, c varchar);

SELECT count(*), max(len) FROM abc MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS len
    ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (A+? B) DEFINE A AS c='a', B AS true
);

SELECT count(*), max(len) FROM abc MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS len
    ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (A{1,3}) DEFINE A AS c='a'
);

SELECT count(*), max(len) FROM abc MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS len
    ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (A+? C) DEFINE A AS c='a', C AS c='b'
);

FROM range(6) t(x) MATCH_RECOGNIZE (
    ORDER BY x MEASURES count(*) AS n AFTER MATCH SKIP PAST LAST ROW PATTERN (A{2,3})
 DEFINE A AS true);

FROM range(4) t(x) MATCH_RECOGNIZE (
    ORDER BY x MEASURES count(*) AS n AFTER MATCH SKIP PAST LAST ROW PATTERN (Z Z)
 DEFINE Z AS true);

SELECT (SELECT sum(n) FROM (FROM range(6) t(x) MATCH_RECOGNIZE (
            ORDER BY x MEASURES count(*) AS n PATTERN (A+) DEFINE A AS x < 3))) AS a,
       (SELECT sum(n) FROM (FROM range(6) t(x) MATCH_RECOGNIZE (
            ORDER BY x MEASURES count(*) AS n PATTERN (A+) DEFINE A AS x < 5))) AS b;

SELECT count(*), max(len) FROM perm MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS len
    ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (PERMUTE(A, B)) DEFINE A AS c='a', B AS c='b'
);

SELECT i, cl FROM perm MATCH_RECOGNIZE(
    ORDER BY i MEASURES i AS x, CLASSIFIER() AS cl ALL ROWS PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (PERMUTE(A, B)) DEFINE A AS true, B AS true
) ORDER BY i;

SELECT count(*), max(len) FROM perm MATCH_RECOGNIZE(
    ORDER BY i MEASURES count(*) AS len
    ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (PERMUTE(A, B)+) DEFINE A AS c='a', B AS c='b'
);

insert into perm3 values (1,0),(2,1),(3,2),(4,1);

SELECT i, cls FROM perm3 MATCH_RECOGNIZE(
    ORDER BY i MEASURES CLASSIFIER() AS cls
    ALL ROWS PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (PERMUTE(A, B C?, B))
    DEFINE A AS A.v > 0, B AS B.v < 2, C AS 1 = 1
) ORDER BY i;

FROM (VALUES (1), (2)) t(x) MATCH_RECOGNIZE (
    ORDER BY x MEASURES count(*) AS n PATTERN (A+)
    DEFINE A AS FIRST(coalesce(lag(x) OVER (ORDER BY x), 0)) = 0
);

FROM (VALUES (1), (2)) t(x) MATCH_RECOGNIZE (
    ORDER BY x MEASURES count(*) AS n PATTERN (A+)
    DEFINE A AS PREV(x) IS NULL
);

FROM wide MATCH_RECOGNIZE (
    ORDER BY i MEASURES count(*) AS n PATTERN (A+)
    DEFINE A AS length(FIRST(v)) = 0 OR length(FIRST(v)) = 512
);

SELECT n FROM (
    FROM (VALUES (1), (2), (3)) t(x) MATCH_RECOGNIZE (
        ORDER BY x MEASURES count(*) AS n AFTER MATCH SKIP TO NEXT ROW PATTERN (A+)
        DEFINE A AS MATCH_NUMBER() < 3
    )
) ORDER BY n;

insert into instrument_tape values
    ('ZPHR', TIMESTAMP '2031-03-04 14:05:00', 20.00),
    ('ZPHR', TIMESTAMP '2031-03-04 14:06:00', 23.00),
    ('ZPHR', TIMESTAMP '2031-03-04 14:07:00', 27.00),
    ('ZPHR', TIMESTAMP '2031-03-04 14:08:00', 25.00),
    ('ZPHR', TIMESTAMP '2031-03-04 14:09:00', 31.00),
    ('ZPHR', TIMESTAMP '2031-03-04 14:10:00', 34.00);

create table wide_tape(ticker varchar, observed_at timestamp, quote decimal(8,2));

create table visit_log(visitor integer, hit_at timestamp);

CREATE TABLE events(
    id VARCHAR, session_id VARCHAR, client_id VARCHAR, item_id VARCHAR,
    occurred_at TIMESTAMP, action_type VARCHAR, ms_since_open BIGINT, attributes JSON
);

SELECT client_id, item_id,
       coalesce(matched_terms::VARCHAR, '-'), coalesce(pct::VARCHAR, '-'), coalesce(first_terms::VARCHAR, '-')
FROM events MATCH_RECOGNIZE(
    PARTITION BY client_id, item_id
    ORDER BY occurred_at
    MEASURES
        first(occurred_at) AS opened_at,
        last((stage_event.attributes ->> 'matched_terms')::DOUBLE) AS matched_terms,
        last((stage_event.attributes ->> 'pct_assets_rendered')::DOUBLE) AS pct,
        first((stage_event.attributes ->> 'matched_terms')::DOUBLE) AS first_terms
    ONE ROW PER MATCH
    AFTER MATCH SKIP PAST LAST ROW
    PATTERN (view_event engage_event* (stage_event | suppress_event | escalate_event)*)
    DEFINE
        view_event AS action_type LIKE 'opened_from_%',
        stage_event AS action_type = 'staged_item',
        suppress_event AS action_type = 'suppressed_item',
        escalate_event AS action_type = 'escalated_item',
        engage_event AS action_type NOT LIKE 'opened_from_%'
            AND action_type NOT IN ('staged_item', 'suppressed_item', 'escalated_item')
) ORDER BY opened_at;

insert into signal_log values
    ('sensor-a', 1,40),('sensor-a', 2,55),('sensor-a', 3,61),('sensor-a', 4,67),('sensor-a', 5,79),
    ('sensor-a', 6,40),('sensor-a', 7,49),('sensor-a', 8,64),('sensor-a', 9,76),('sensor-a',10,79),
    ('sensor-a',11,61),('sensor-a',12,49),('sensor-a',13,79),('sensor-a',14,79),('sensor-a',15,46),
    ('sensor-a',16,40),('sensor-a',17,46),('sensor-a',18,76),('sensor-a',19,73),('sensor-a',20,70);

SELECT day, match_num, var_name, climbs FROM signal_log MATCH_RECOGNIZE(
    PARTITION BY device ORDER BY day
    MEASURES MATCH_NUMBER() AS match_num, CLASSIFIER() AS var_name, count(CLIMB.day) AS climbs
    ALL ROWS PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (ONSET DIP+ CLIMB+)
    DEFINE DIP AS DIP.level < PREV(DIP.level), CLIMB AS CLIMB.level > PREV(CLIMB.level)
) ORDER BY day;

SELECT start_day, bottom_day, end_day FROM signal_log MATCH_RECOGNIZE(
    PARTITION BY device ORDER BY day
    MEASURES ONSET.day AS start_day, LAST(DIP.day) AS bottom_day, LAST(CLIMB.day) AS end_day
    ONE ROW PER MATCH AFTER MATCH SKIP TO LAST CLIMB
    PATTERN (ONSET DIP+ CLIMB+)
    DEFINE DIP AS DIP.level < PREV(DIP.level), CLIMB AS CLIMB.level > PREV(CLIMB.level)
) ORDER BY start_day;

SELECT n, whole FROM signal_log MATCH_RECOGNIZE(
    PARTITION BY device ORDER BY day
    MEASURES count(*) AS n, count(ALL_OF_IT.level) AS whole
    ONE ROW PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (ONSET DIP+ CLIMB+)
    SUBSET ALL_OF_IT = (ONSET, DIP, CLIMB)
    DEFINE DIP AS DIP.level < PREV(DIP.level), CLIMB AS CLIMB.level > PREV(CLIMB.level)
) ORDER BY n DESC;

SELECT day, var_name, match_num, n FROM signal_log MATCH_RECOGNIZE(
    PARTITION BY device ORDER BY day
    MEASURES CLASSIFIER() AS var_name, MATCH_NUMBER() AS match_num, FINAL count(*) AS n
    ALL ROWS PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN ({- ONSET -} CLIMB+)
    DEFINE CLIMB AS CLIMB.level > PREV(CLIMB.level)
) ORDER BY day;

CREATE TABLE out_order(price INTEGER, extra INTEGER, sym VARCHAR, day INTEGER);

SELECT * FROM out_order MATCH_RECOGNIZE(
    PARTITION BY sym ORDER BY day MEASURES MATCH_NUMBER() AS mno
    ONE ROW PER MATCH PATTERN (A+) DEFINE A AS price > 0
);

CREATE TABLE Ticker(Symbol VARCHAR, Tradeday DATE, Price INTEGER);

SELECT M.Matchno, M.Tradeday, M.Price, M.Classy, M.Startp, M.Bottomp, M.Endp, M.Avgp
FROM Ticker MATCH_RECOGNIZE (
    PARTITION BY Symbol ORDER BY Tradeday
    MEASURES MATCH_NUMBER() AS Matchno, CLASSIFIER() AS Classy, A.Price AS Startp,
             FINAL LAST(B.Price) AS Bottomp, FINAL LAST(C.Price) AS Endp, FINAL AVG(U.Price) AS Avgp
    ALL ROWS PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN (A B+ C+) SUBSET U = (A, B, C)
    DEFINE B AS B.Price < PREV(B.Price), C AS C.Price > PREV(C.Price)
) AS M ORDER BY M.Tradeday;

SELECT M.Matchno, M.Tradeday, M.Price, M.Classy
FROM Ticker MATCH_RECOGNIZE (
    PARTITION BY Symbol ORDER BY Tradeday
    MEASURES MATCH_NUMBER() AS Matchno, CLASSIFIER() AS Classy
    ALL ROWS PER MATCH OMIT EMPTY MATCHES AFTER MATCH SKIP PAST LAST ROW
    PATTERN (A*) DEFINE A AS A.Price > PREV(A.Price)
) AS M ORDER BY M.Tradeday;

INSERT INTO Nav VALUES (1,10),(2,20),(3,30),(4,40),(5,50);

CREATE TABLE Alt(i INTEGER, Price INTEGER);

SELECT M.i, M.cls FROM Alt MATCH_RECOGNIZE (
    ORDER BY i MEASURES CLASSIFIER() AS cls
    ALL ROWS PER MATCH AFTER MATCH SKIP PAST LAST ROW
    PATTERN ((A??)* B) DEFINE A AS false, B AS true
) AS M ORDER BY M.i;

SELECT M.s FROM Nest MATCH_RECOGNIZE (
    ORDER BY rn MEASURES PREV(LAST(A.Price + A.Tax, 1), 3) AS s
    PATTERN (A B A C A) DEFINE A AS Price IN (20,40,60), B AS Price = 30, C AS Price = 50
) AS M;

SELECT n FROM events MATCH_RECOGNIZE (
    ORDER BY seq MEASURES count(*) AS n AFTER MATCH SKIP TO B
    PATTERN (A+ B) DEFINE A AS price > 0, B AS price <= 0
);

SELECT * FROM (
    SELECT * FROM events MATCH_RECOGNIZE (
        ORDER BY seq MEASURES count(*) AS n, FIRST(seq) AS f PATTERN (A | ()) DEFINE A AS price > 0
    )
) ORDER BY f NULLS LAST;

SELECT * FROM events MATCH_RECOGNIZE (
    ORDER BY seq MEASURES 1 + RUNNING SUM(A.price) AS total
    ALL ROWS PER MATCH PATTERN (A+) DEFINE A AS price > 0
) ORDER BY seq;

SELECT running FROM (SELECT 1 AS running);

SELECT * FROM events MATCH_RECOGNIZE (
    ORDER BY seq MEASURES count(*) AS n, CLASSIFIER() AS c, MATCH_NUMBER() AS m
    ALL ROWS PER MATCH OMIT EMPTY MATCHES PATTERN (A*) DEFINE A AS price > 0
) ORDER BY seq;

SELECT x FROM range(6) t(x) MATCH_RECOGNIZE (
    ORDER BY x ALL ROWS PER MATCH SHOW EMPTY MATCHES AFTER MATCH SKIP PAST LAST ROW
    PATTERN ({- A -}* B*) DEFINE A AS x % 3 = 0, B AS x % 3 = 1
) ORDER BY x;

SELECT count(*) FROM quotes;

SELECT count(*) FROM quotes MATCH_RECOGNIZE(
    PARTITION BY isin ORDER BY time DESC, price DESC
    MEASURES count(*) AS len
    ONE ROW PER MATCH AFTER MATCH SKIP TO LAST UP
    PATTERN (STRT DOWN+ UP+ (DOWN+ UP+)+)
    DEFINE DOWN AS DOWN.price < PREV(DOWN.price), UP AS UP.price > PREV(UP.price)
);

SELECT count(*), min(x), max(x) FROM wide MATCH_RECOGNIZE(
    ORDER BY i MEASURES i AS x PATTERN (A) DEFINE A as v=0
);

SELECT count(*), min(i), max(i) FROM spanning MATCH_RECOGNIZE(
    ORDER BY i MEASURES MATCH_NUMBER() AS mn ALL ROWS PER MATCH PATTERN (A+) DEFINE A as v=1
);

SELECT p, count(*) FROM many_parts MATCH_RECOGNIZE(
    PARTITION BY p ORDER BY i MEASURES i AS x PATTERN (A) DEFINE A as v=0
) GROUP BY p ORDER BY p;

SELECT count(*) FROM many_parts MATCH_RECOGNIZE(
    PARTITION BY p ORDER BY i MEASURES i AS x PATTERN (A) DEFINE A as MATCH_NUMBER()<=2
);
