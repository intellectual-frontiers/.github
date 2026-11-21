SELECT v::INT FROM (VALUES (-123), (5), (-1), (100), (0)) t(v)
ORDER BY v::INT::VARIANT;

SELECT v::INT FROM (VALUES (-123), (5), (-1), (100), (0)) t(v)
ORDER BY v::INT::VARIANT DESC;

SELECT v FROM (VALUES ('nan'::DOUBLE), (1.5::DOUBLE), (-1.5::DOUBLE), ('-inf'::DOUBLE), ('inf'::DOUBLE), (0.0::DOUBLE)) t(v)
ORDER BY v::VARIANT;

SELECT variant_comparator('-0.0'::DOUBLE::VARIANT) = variant_comparator('0.0'::DOUBLE::VARIANT);

SELECT v FROM (VALUES ('banana'), ('apple'), ('cherry')) t(v)
ORDER BY v::VARCHAR::VARIANT;

SELECT variant_comparator({'b': 10, 'a': 1}::VARIANT) = variant_comparator({'a': 1, 'b': 10}::VARIANT);

SELECT variant_comparator({'a': 1, 'b': 10}::VARIANT) = variant_comparator({'a': 1, 'b': 11}::VARIANT);

SELECT v::INT[]::VARCHAR FROM (VALUES ([1,2,3]), ([1,2]), ([1,3]), ([1])) t(v)
ORDER BY v::INT[]::VARIANT;

SELECT
    variant_comparator(1::TINYINT::VARIANT) = variant_comparator(1::INTEGER::VARIANT),
    variant_comparator(1::BIGINT::VARIANT) = variant_comparator(1::UINTEGER::VARIANT),
    variant_comparator(1::HUGEINT::VARIANT) = variant_comparator(1::UTINYINT::VARIANT),
    variant_comparator(1::INTEGER::VARIANT) = variant_comparator(1::UHUGEINT::VARIANT);

SELECT
    variant_comparator(5::INTEGER::VARIANT) = variant_comparator(5.00::DECIMAL(5,2)::VARIANT),
    variant_comparator(5::BIGINT::VARIANT) = variant_comparator(5::BIGNUM::VARIANT),
    variant_comparator(5.00::DECIMAL(5,2)::VARIANT) = variant_comparator(5::BIGNUM::VARIANT);

SELECT v::VARCHAR FROM (VALUES
    ((-100.5)::DECIMAL(5,1)::VARIANT),
    (3::TINYINT::VARIANT),
    (1000000000000000000000000000::BIGNUM::VARIANT),
    (0::UTINYINT::VARIANT),
    (1.5::DECIMAL(2,1)::VARIANT),
    ((-128)::TINYINT::VARIANT),
    (15::BIGINT::VARIANT)
) t(v)
ORDER BY v;

SELECT (-100.5)::DECIMAL(5,1)::VARIANT > 0;

SELECT variant_comparator(1.5::FLOAT::VARIANT) = variant_comparator(1.5::DOUBLE::VARIANT);

SELECT variant_comparator(1::INTEGER::VARIANT) = variant_comparator(1.0::DOUBLE::VARIANT);

SELECT v FROM (VALUES (true), (false), (true), (false)) t(v)
ORDER BY v::BOOLEAN::VARIANT;

SELECT v::VARCHAR FROM (VALUES
    ('0'::BIT::VARIANT),
    ('10101010'::BIT::VARIANT),
    ('00'::BIT::VARIANT),
    ('01'::BIT::VARIANT),
    ('1'::BIT::VARIANT)
) t(v)
ORDER BY v;

SELECT
    variant_comparator('2020-01-01'::DATE::VARIANT) = variant_comparator('2020-01-01 00:00:00'::TIMESTAMP::VARIANT),
    variant_comparator('2020-01-01 00:00:00'::TIMESTAMP_S::VARIANT) = variant_comparator('2020-01-01 00:00:00'::TIMESTAMP_MS::VARIANT),
    variant_comparator('2020-01-01 00:00:00'::TIMESTAMP::VARIANT) = variant_comparator('2020-01-01 00:00:00'::TIMESTAMP_NS::VARIANT);

SELECT v::VARCHAR FROM (VALUES
    ('2019-12-31'::DATE::VARIANT),
    ('2020-01-01 00:00:01'::TIMESTAMP_MS::VARIANT),
    ('2020-01-01 00:00:00'::TIMESTAMP_S::VARIANT),
    ('2020-01-02'::DATE::VARIANT),
    ('2020-01-01 00:00:00.5'::TIMESTAMP_NS::VARIANT)
) t(v)
ORDER BY v;

SELECT variant_comparator('12:00:00'::TIME::VARIANT) = variant_comparator('12:00:00'::TIME_NS::VARIANT);

SELECT v::VARCHAR FROM (VALUES
    ('12:00:01'::TIME::VARIANT),
    ('00:00:00'::TIME_NS::VARIANT),
    ('12:00:00.5'::TIME_NS::VARIANT)
) t(v)
ORDER BY v;

SELECT
    variant_comparator('2020-01-01 00:00:00'::TIMESTAMP::VARIANT) = variant_comparator('2020-01-01 00:00:00+00'::TIMESTAMPTZ::VARIANT),
    variant_comparator('12:00:00'::TIME::VARIANT) = variant_comparator('2020-01-01 12:00:00'::TIMESTAMP::VARIANT),
    variant_comparator('12:00:00'::TIME::VARIANT) = variant_comparator('12:00:00+00'::TIMETZ::VARIANT);

SELECT variant_comparator(NULL::VARIANT) IS NULL;

WITH variants(v) AS (VALUES
    (1::INTEGER::VARIANT),
    (255::INTEGER::VARIANT),
    (256::INTEGER::VARIANT),
    (NULL::VARIANT)
)
SELECT min(v)::VARCHAR, max(v)::VARCHAR FROM variants;

WITH variants(v) AS (VALUES
    (1::INTEGER::VARIANT),
    (255::INTEGER::VARIANT),
    (256::INTEGER::VARIANT),
    (NULL::VARIANT)
)
SELECT min(v, 3)::VARCHAR, max(v, 3)::VARCHAR FROM variants;

WITH variants(v) AS (VALUES
    (5::TINYINT::VARIANT),
    (5.00::DECIMAL(5,2)::VARIANT),
    ((-1)::BIGINT::VARIANT),
    (10::BIGNUM::VARIANT)
)
SELECT min(v)::VARCHAR, max(v)::VARCHAR FROM variants;

WITH variants(v) AS (VALUES
    (1::INTEGER::VARIANT),
    (255::INTEGER::VARIANT),
    (256::INTEGER::VARIANT)
)
SELECT
    finalize(min(v) EXPORT_STATE)::VARCHAR,
    finalize(max(v) EXPORT_STATE)::VARCHAR
FROM variants;

CREATE TABLE huge_numbers AS
SELECT x, x::VARIANT AS v FROM (
    SELECT ((i % 2 * 2 - 1)::BIGNUM * (1 + i % 9)::BIGNUM * ('1' || repeat('0', (i * 7) % 400))::BIGNUM) AS x
    FROM range(3000) t(i)
);

SELECT count(*) FROM (SELECT x, lag(x) OVER (ORDER BY v, x) AS prev FROM huge_numbers) WHERE prev > x;

SELECT count(*) FROM huge_numbers WHERE (v > ('1' || repeat('0', 150))::BIGNUM::VARIANT) <> (x > ('1' || repeat('0', 150))::BIGNUM);

SELECT count(*) FROM huge_numbers WHERE (v < ('-1' || repeat('0', 150))::BIGNUM::VARIANT) <> (x < ('-1' || repeat('0', 150))::BIGNUM);

SELECT count(DISTINCT v) = count(DISTINCT x) FROM huge_numbers;

SELECT list(i ORDER BY v) FROM (VALUES
    (1, ('1' || repeat('0', 126))::BIGNUM::VARIANT),
    (2, ('1' || repeat('0', 127))::BIGNUM::VARIANT),
    (3, ('1' || repeat('0', 125))::BIGNUM::VARIANT),
    (4, ('-1' || repeat('0', 127))::BIGNUM::VARIANT),
    (5, ('-1' || repeat('0', 126))::BIGNUM::VARIANT),
    (6, 0::BIGNUM::VARIANT)
) t(i, v);

SELECT variant_to_parquet_variant(
variant_bytes_to_variant(X'1100000301001903010015030100110301000d03010009030100050301000100')
) IS NOT NULL;

SELECT variant_to_parquet_variant(
variant_bytes_to_variant(X'1100000301001d0301001903010015030100110301000d03010009030100050301000100')
) IS NOT NULL;

SELECT variant_to_parquet_variant(
variant_bytes_to_variant(X'110000030100210301001d0301001903010015030100110301000d03010009030100050301000100')
) IS NOT NULL;
