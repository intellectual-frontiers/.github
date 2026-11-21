CREATE TABLE binding_left(i INTEGER, s VARCHAR);

INSERT INTO binding_left VALUES (1, 'alpha'), (2, 'beta'), (3, 'gamma');

CREATE TABLE binding_right(i INTEGER, s VARCHAR);

INSERT INTO binding_right VALUES (1, 'a'), (2, 'z'), (4, 'gamma');

SELECT l.i, r.i, l.s
FROM binding_left l
JOIN binding_right r ON l.i = r.i AND starts_with(l.s, r.s)
ORDER BY ALL;

SELECT l.i
FROM binding_left l
SEMI JOIN binding_right r ON l.i + r.i = 5 OR l.s = r.s
ORDER BY ALL;

SELECT l.i, (SELECT count(*)
             FROM binding_right r
             WHERE r.i <= l.i AND starts_with(l.s, r.s))
FROM binding_left l
ORDER BY ALL;

CREATE INDEX binding_expression_index ON binding_left ((i + length(s)));

SELECT i FROM binding_left WHERE i + length(s) = 6;

WITH RECURSIVE binding_cte(i) AS (
    SELECT 1
    UNION ALL
    SELECT i + 1 FROM binding_cte WHERE i < 3
)
SELECT i FROM binding_cte ORDER BY ALL;

SET debug_verification_mode = 'verify_functions';

SELECT abs(i)
FROM (VALUES (1), (NULL), (-2)) t(i);

SELECT abs(a + b), greatest(a, b)
FROM (VALUES (1, 2), (NULL, 3), (4, NULL)) t(a, b);

SELECT count(*), sum(i), min(i)
FROM range(0) t(i);

SELECT count(DISTINCT i), sum(DISTINCT i)
FROM (VALUES (1), (1), (2), (NULL)) t(i);

RESET debug_verification_mode;

SET threads=1;

SELECT true WHERE random() >= 0;

SELECT sum(s) FROM (
    SELECT sum(i) OVER (ORDER BY i ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) s
    FROM range(20000) t(i)
);

SELECT sum(s) FROM (
    SELECT sum(i) OVER (ORDER BY i RANGE BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) s
    FROM range(20000) t(i)
);

CREATE TABLE batches AS SELECT i, CASE WHEN i % 7 = 0 THEN NULL ELSE i END AS v,
    CASE WHEN i % 3 = 0 THEN repeat('x', 100) ELSE 'y' END AS s
FROM range(20000) t(i);

SELECT sum((v + 3) * 2), sum(length(upper(s) || reverse(s))) FROM batches;

SELECT sum(CASE WHEN i % 2 = 0 THEN v + 1 ELSE v - 1 END),
       count(TRY((CASE WHEN i % 3 = 0 THEN 'bad' ELSE v::VARCHAR END)::BIGINT)),
       sum(length(CASE WHEN i % 2 = 0 THEN s || s ELSE reverse(s) END)) FROM batches;

SELECT count(*), sum(a.v), sum(length(b.s)) FROM batches a JOIN batches b ON a.i % 1000 = b.i % 1000
WHERE a.i % 3 <> 0;

PREPARE repeat_batch AS SELECT sum(v), sum(length(s)) FROM batches WHERE i >= $1;

EXECUTE repeat_batch(0);

EXECUTE repeat_batch(17000);

PREPARE runtime_percent AS SELECT i FROM range(10) t(i) LIMIT ?%;

EXECUTE runtime_percent(NULL);

PREPARE runtime_offset AS SELECT i FROM range(5) t(i) LIMIT 50% OFFSET ?;

EXECUTE runtime_offset(NULL);

SET debug_verify_vector = 'dictionary_operator';

SELECT i, CASE WHEN i % 2 = 0 THEN NULL ELSE i::VARCHAR END
FROM range(4) t(i);

SET debug_verify_vector = 'constant_operator';

SELECT i, i % 2
FROM range(4) t(i);

SET debug_verify_vector = 'sequence_operator';

SELECT i::TINYINT, (i * 200)::SMALLINT, CASE WHEN i = 2 THEN NULL ELSE i END
FROM range(4) t(i);

SELECT i, i / 2, INTERVAL '1 day' * i
FROM range(4) t(i);

SELECT *
FROM (VALUES (1, 5), (1, 5), (2, 5), (4, 5)) t(irregular, constant_value);

SELECT * FROM (VALUES (1), (2), (4)) t(irregular);

SELECT *
FROM (VALUES
	((-128)::TINYINT, (-32768)::SMALLINT, (-2147483648)::INTEGER, (-9223372036854775808)::BIGINT),
	(127::TINYINT, 32767::SMALLINT, 2147483647::INTEGER, 9223372036854775807::BIGINT)
) t(tiny_value, small_value, integer_value, bigint_value);

SELECT * FROM (VALUES (1), (NULL)) t(nullable_value);

SELECT unnest([empty_struct::VARIANT, struct::VARIANT]) FROM test_all_types();

SELECT variant_typeof(v), variant_typeof(s.v), variant_typeof(l[1]), variant_typeof(a[1])
FROM (
	SELECT v, {'v': v} AS s, [v] AS l, [v]::VARIANT[1] AS a
	FROM (VALUES (42::VARIANT), (42::DOUBLE::VARIANT), ('42'::VARIANT), (NULL::VARIANT)) t(v)
);

SET debug_verify_vector = 'nested_shuffle';

SELECT [i, i + 1], {'id': i, 'label': i::VARCHAR}
FROM range(4) t(i);

SET debug_verify_vector = 'variant_vector';

SELECT i + 1 FROM range(4) t(i);

SET debug_verify_vector = 'shredded_vector';

SELECT i::VARIANT FROM range(4) t(i);

RESET debug_verify_vector;

SELECT *
FROM range(2) a(i)
POSITIONAL JOIN range(3) b(j)
POSITIONAL JOIN range(4) c(k);

SET debug_verify_serializer = true;

SELECT *
FROM range(4) a(i)
POSITIONAL JOIN range(2) b(j)
POSITIONAL JOIN range(3) c(k);

RESET debug_verify_serializer;
