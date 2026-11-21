CREATE TABLE list_probes AS
SELECT * FROM (VALUES (0,NULL::INTEGER[]),(1,[1,2]),(2,[]::INTEGER[]),(3,NULL::INTEGER[]),
                     (4,[1,NULL::INTEGER]),(5,[2,1]),(6,NULL::INTEGER[]),(7,[1,2])) p(id,k);

SELECT list(k ORDER BY id, n)
FROM (SELECT id, k, unnest([0,1]) AS n FROM list_probes) p;

CREATE TABLE kinds AS SELECT
	i,
	CASE WHEN i % 2 = 0 THEN i END AS n,
	i::HUGEINT * 1000000000000000 AS h,
	INTERVAL (i) DAY AS iv,
	i % 3 = 0 AS b,
	CASE WHEN i % 4 <> 3 THEN [repeat('l', 20) || i::VARCHAR, NULL] END AS l,
	CASE WHEN i % 4 <> 2 THEN {'a': i, 's': repeat('s', 20) || i::VARCHAR} END AS st,
	CASE WHEN i % 4 <> 1 THEN [i, i + 1, i + 2]::INTEGER[3] END AS arr,
	MAP {i: repeat('v', 20) || i::VARCHAR} AS m,
	CASE WHEN i % 2 = 0 THEN i::UNION(num BIGINT, str VARCHAR) ELSE (repeat('u', 20) || i::VARCHAR)::UNION(num BIGINT, str VARCHAR) END AS un,
	{'k': i, 'v': [repeat('w', 20)]}::VARIANT AS va
FROM range(8) t(i);

SELECT bool_or(vector_type(i) = 'CONSTANT_VECTOR'), bool_or(vector_type(n) = 'CONSTANT_VECTOR'),
	bool_or(vector_type(h) = 'CONSTANT_VECTOR'), bool_or(vector_type(iv) = 'CONSTANT_VECTOR'),
	bool_or(vector_type(b) = 'CONSTANT_VECTOR'), bool_or(vector_type(l) = 'CONSTANT_VECTOR'),
	bool_or(vector_type(st) = 'CONSTANT_VECTOR'), bool_or(vector_type(arr) = 'CONSTANT_VECTOR'),
	bool_or(vector_type(m) = 'CONSTANT_VECTOR'), bool_or(vector_type(un) = 'CONSTANT_VECTOR'),
	bool_or(vector_type(va) = 'CONSTANT_VECTOR')
FROM (SELECT *, unnest(range(5000)) AS r FROM kinds);

SELECT count(*), count(DISTINCT (i, n, h, iv, b, l, st, arr, m, un, va)) FROM (SELECT *, unnest(range(5000)) AS r FROM kinds);

SELECT count(*) FROM ((SELECT DISTINCT * EXCLUDE (r) FROM (SELECT *, unnest(range(5000)) AS r FROM kinds)) EXCEPT ALL FROM kinds);

SELECT count(*) FROM (FROM kinds EXCEPT ALL (SELECT DISTINCT * EXCLUDE (r) FROM (SELECT *, unnest(range(5000)) AS r FROM kinds)));

SELECT bool_and(vector_type(i) = 'DICTIONARY_VECTOR'), bool_and(vector_type(n) = 'DICTIONARY_VECTOR'),
	bool_and(vector_type(l) = 'DICTIONARY_VECTOR'), bool_and(vector_type(st.s) = 'DICTIONARY_VECTOR'),
	bool_and(vector_type(m) = 'DICTIONARY_VECTOR')
FROM kinds SEMI JOIN (VALUES (5), (3), (1)) v(x) ON i = x;

SELECT i, count(*), bool_and(i IN (1, 3, 5)), count(DISTINCT (i, n, h, iv, b, l, st, arr, m, un, va))
FROM (SELECT *, unnest(range(5000)) AS r FROM kinds SEMI JOIN (VALUES (5), (3), (1)) v(x) ON i = x)
GROUP BY i ORDER BY i;

SELECT count(*) FROM ((SELECT DISTINCT * EXCLUDE (r) FROM (SELECT *, unnest(range(5000)) AS r FROM kinds SEMI JOIN (VALUES (5), (3), (1)) v(x) ON i = x)) EXCEPT ALL FROM kinds);

SELECT bool_and(vector_type(c) = 'CONSTANT_VECTOR') FROM (SELECT repeat('c', 30) AS c FROM range(3));

SELECT count(*), count(DISTINCT c), min(c) FROM (SELECT repeat('c', 30) AS c, unnest(range(5000)) FROM range(3));

SET variant_minimum_shredding_size = 10;

CREATE TABLE db.variants AS SELECT i, {'k': i, 's': repeat('v', 20) || i::VARCHAR}::VARIANT AS v FROM range(20) t(i);

CHECKPOINT db;

SELECT bool_and(vector_type(v) = 'SHREDDED_VECTOR') FROM db.variants;

SELECT bool_or(vector_type(v) = 'CONSTANT_VECTOR') FROM (SELECT i, v, unnest(range(5000)) FROM db.variants);

SELECT count(*), count(DISTINCT (i, v)) FROM (SELECT i, v, unnest(range(5000)) FROM db.variants);

SELECT count(*) FROM ((SELECT DISTINCT i, v FROM (SELECT i, v, unnest(range(5000)) FROM db.variants)) EXCEPT ALL FROM db.variants);

CREATE TABLE db.mixed_variants AS SELECT i, CASE WHEN i % 5 = 3 THEN NULL WHEN i % 5 = 4 THEN ('str' || i::VARCHAR)::VARIANT ELSE {'k': i, 's': repeat('v', 20) || i::VARCHAR}::VARIANT END AS v FROM range(20) t(i);

SELECT bool_and(vector_type(v) = 'SHREDDED_VECTOR') FROM db.mixed_variants;

SELECT bool_or(vector_type(v) = 'CONSTANT_VECTOR') FROM (SELECT i, v, unnest(range(5000)) FROM db.mixed_variants);

SELECT count(*), count(v), count(DISTINCT (i, v)), count(DISTINCT v::VARCHAR) FROM (SELECT i, v, unnest(range(5000)) FROM db.mixed_variants);

SELECT count(*) FROM ((SELECT DISTINCT i, v FROM (SELECT i, v, unnest(range(5000)) FROM db.mixed_variants)) EXCEPT ALL FROM db.mixed_variants);

SELECT i, v::VARCHAR, v.k, variant_typeof(v) FROM (SELECT i, v, unnest(range(5000)) AS r FROM db.mixed_variants) WHERE r = 4999 AND i < 5 ORDER BY i;

CREATE TABLE db.nested_variants AS SELECT i, {'a': i, 'v': CASE WHEN i % 5 = 3 THEN NULL WHEN i % 5 = 4 THEN ('str' || i::VARCHAR)::VARIANT ELSE {'k': i, 's': repeat('v', 20) || i::VARCHAR}::VARIANT END} AS s FROM range(20) t(i);

SELECT bool_and(vector_type(s.v) = 'SHREDDED_VECTOR') FROM db.nested_variants;

SELECT bool_or(vector_type(s) = 'CONSTANT_VECTOR') FROM (SELECT i, s, unnest(range(5000)) FROM db.nested_variants);

SELECT count(*), count(s.v), count(DISTINCT (i, s)), count(DISTINCT s.v::VARCHAR) FROM (SELECT i, s, unnest(range(5000)) FROM db.nested_variants);

SELECT count(*) FROM ((SELECT DISTINCT i, s FROM (SELECT i, s, unnest(range(5000)) FROM db.nested_variants)) EXCEPT ALL FROM db.nested_variants);

SELECT i, s.v::VARCHAR, s.v.k, variant_typeof(s.v) FROM (SELECT i, s, unnest(range(5000)) AS r FROM db.nested_variants) WHERE r = 4999 AND i < 5 ORDER BY i;

CREATE TABLE strs AS SELECT * FROM (VALUES (1, repeat('ab', 2500)), (2, repeat('é', 1500)), (3, 'short'), (4, ''), (5, NULL)) t(id, s);

CREATE TABLE unnested AS SELECT id, s, unnest(range(5000)) AS i, {'s': s, 'i': id} AS st FROM strs;

SELECT u.id, count(*), count(u.s), count(DISTINCT u.s), bool_and(u.s IS NOT DISTINCT FROM t.s), bool_and(u.st.s IS NOT DISTINCT FROM t.s)
FROM unnested u JOIN strs t ON u.id = t.id GROUP BY u.id ORDER BY u.id;

CREATE TABLE structs AS SELECT id, {'s': s, 'i': id} AS st FROM strs;

SELECT u.id, count(*), count(u.st.s), count(DISTINCT u.st), bool_and(u.st.s IS NOT DISTINCT FROM t.s)
FROM (SELECT id, st, unnest(range(5000)) FROM structs) u JOIN strs t ON u.id = t.id GROUP BY u.id ORDER BY u.id;

SELECT id, count(*), count(DISTINCT s), sum(length(s))
FROM (SELECT id, s, u FROM strs, LATERAL unnest(range(5000 + id * 0)) t(u) ORDER BY u, id)
GROUP BY id ORDER BY id;

SET enable_fsst_vectors = true;

SELECT bool_or(vector_type(s) = 'DICTIONARY_VECTOR') FROM db.dictionary_strs;

SELECT bool_or(vector_type(s) = 'FSST_VECTOR') FROM db.fsst_strs;
