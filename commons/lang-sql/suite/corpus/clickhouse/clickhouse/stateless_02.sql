SELECT dumpColumnStructure(s), hex(s), count()
FROM 04259_filter_constant_column_after_where_ipv6
WHERE s = toIPv6('::1')
GROUP BY ALL
ORDER BY ALL;

-- Randomized statistics may make the tables look large enough for a sort-merge join, which has no runtime filter.
SET query_plan_optimize_join_order_randomize = 0;

-- Ordinary forward and reverse to verify the inner loop still works.
SELECT range(toInt64(1), toInt64(10), toInt64(3));

DROP TABLE IF EXISTS t_case_lc_nullable;

SELECT d::Float64 AS r, toTypeName(r) FROM t_dynamic_no_keep ORDER BY 1;

-- 1. EXPLAIN PIPELINE over a SELECT with two MATERIALIZED CTEs, one of which
--    references the other. This is the exact fuzzer trigger.
SELECT count() > 0 FROM (
  EXPLAIN PIPELINE
  WITH ct AS MATERIALIZED (SELECT DISTINCT c FROM t_04260 LIMIT 2147483648),
       rs AS MATERIALIZED (SELECT 65537, * FROM t_04260 WHERE c IN (SELECT c FROM ct GROUP BY 1))
  SELECT -2 FROM rs AS a, rs AS b
);

DROP TABLE test_variant_null_expr;

-- This SELECT triggered SEGFAULT before the fix (deserialization of aggregate state).
SELECT id, singleValueOrNullMerge(s) FROM t_single_value_or_null_json GROUP BY id ORDER BY id;

SELECT v != 42 FROM test_v2 ORDER BY id;

SELECT v = 42 FROM test_d2 ORDER BY id;

-- Dynamic: same regression for Dynamic type
SELECT 'dynamic: value-dependent exception propagates';

SELECT 'JSONExtract';

-- Case 3: A string-typed parameter that parses cleanly within `Int64` must still
-- work (regression guard — make sure the `NO_SANITIZE_UNDEFINED` attribute does
-- not silently change the value for normal-range inputs).
SELECT length(timeSeriesLastToGrid('1577836800', '1577836810', '1', '1')(timestamp, value)) AS grid_len
FROM ts_decimal_overflow;

SELECT 'quantileBFloat16 cross-function merge',
    quantilesBFloat16Merge(0.5)(state)
FROM (SELECT quantileBFloat16State(0.5)(number) AS state FROM numbers(5));

SELECT position(prewhere_line, 'col_high_null') > position(prewhere_line, 'col_low_null') AS range_first FROM (
    SELECT extractAll(explain, 'Prewhere filter column: ([^\n]+)')[1] AS prewhere_line FROM (
        EXPLAIN actions=1 SELECT count(*) FROM test_basic_prewhere
        WHERE col_high_null IS NULL AND col_low_null < 5
    ) WHERE explain LIKE '%Prewhere filter column%'
);

SELECT count() FROM (
    EXPLAIN actions=1 SELECT count() FROM test_fallback_selectivity WHERE a = 1 AND b = 1
) WHERE explain LIKE '%Prewhere filter column%b%a%';

INSERT INTO t_ttl_json_subcol VALUES ('{"d" : "2099-01-01"}', 20);

SELECT sum(if(isFinite(L2Distance(u8, f64)), 1, 0)) = 4
FROM array_distance_mixed_large;

DROP TABLE t_clear_column_special_collapsing_105782;

ALTER TABLE t_on_fly_mut_lc MODIFY COLUMN c LowCardinality(String)
    SETTINGS mutations_sync = 0, alter_sync = 0;

WITH keys AS (SELECT arrayJoin([100::UInt64, 100000::UInt64, 199900::UInt64]) AS id)
SELECT count() FROM url('http://localhost:11111/test/04267_url_parquet_in_subquery/' || currentDatabase() || '.parquet', Parquet)
WHERE id IN (SELECT id FROM keys)
SETTINGS enable_filesystem_cache = 0, log_comment = '100743_url_cte';

WITH CAST(u8, 'Array(Float64)') AS u8_f64
SELECT countIf(LinfDistance(u8, f64) = LinfDistance(u8_f64, f64)) = 4
FROM array_distance_simd_coverage_large;

DROP TABLE t_bool_detach;

SELECT toFloat64(v) AS r, toTypeName(r) FROM t_variant_null ORDER BY 1 NULLS LAST;

DROP TABLE IF EXISTS t_variant_all_null;

SELECT 'absent typed path';

SELECT replaceRegexpAll(explain, '^\s*', '') FROM (EXPLAIN actions=1 SELECT number FROM numbers(12) ORDER BY number % 2, number % 3, number LIMIT 1 BY number % 2, number % 3) WHERE match(explain, '^\s*(LimitBy|Length |Offset )');

INSERT INTO t_on_fly_del_then_mod SELECT number + 100, toString(number + 100) FROM numbers(100);

SELECT bitmapContains(bitmapBuild([toUInt64(4294967296)]), toUInt64(4294967296));

CREATE TABLE t_nullable_json_null_compact (id UInt32, json Nullable(JSON))
ENGINE = MergeTree ORDER BY id
SETTINGS min_rows_for_wide_part = 100000000, min_bytes_for_wide_part = 1000000000;

SELECT toStartOfMicrosecond(toDateTime64('2026-05-20 10:11:12.456789123', 9, 'UTC'));

DROP TABLE t_89802_u8;

-- The original AST-fuzzer-found shape from the issue, slimmed down.
DROP TABLE IF EXISTS t_issue_105649;

-- Regression test for https://github.com/ClickHouse/ClickHouse/issues/105738
-- Sibling reproducer for https://github.com/ClickHouse/ClickHouse/issues/99959.
-- In a LEFT ANTI JOIN, the result contains only rows from the left table that have no
-- matching row in the right table. The right-table columns (including the join key)
-- must contain default values for those unmatched rows, not the left key value.
-- The #105738 reproducer self-joins a MergeTree table and varies the presence of a
-- WHERE predicate, which previously could pick different plans and expose the
-- right-key projection inconsistency.

DROP TABLE IF EXISTS m_105738;

DROP DICTIONARY IF EXISTS dict_date_attr;

-- Date attr compared to DateTime constant: SQL `=` promotes Date to DateTime(midnight), no
-- match at noon. Rewrite must not cast the DateTime to Date inside `dictGetKeys` and find
-- spurious matches.
CREATE TABLE ref_date_attr (id UInt64, d Date) ENGINE = MergeTree ORDER BY id;

SELECT 'Wide dict key vs narrow column, rewrite - plan';

DROP TABLE data_float_nan;

CREATE TABLE t2 (c Int32) ENGINE = Memory;

SELECT name FROM merge(currentDatabase(), '^users_86313$') WHERE time > 1 ORDER BY time, age LIMIT 1;

SELECT count() FROM tab WHERE message LIKE '%World%' ESCAPE '|';

SELECT 'The ESCAPE form is handed to the index at data-read time too, like the 2-argument form';

INSERT INTO t64_default SELECT number FROM numbers(100000);

-- When a `view(...)` table function wraps a `remote(...)` subquery, the outer
-- `WHERE` predicate sits above `ReadFromRemote` in the plan and the fallback
-- `addFilters` path in `ReadFromRemote.cpp` is responsible for pushing it into
-- the remote query via `tryBuildAdditionalFilterAST`. The remote query lands
-- as `SELECT ... FROM numbers(3) AS __table1`, where the table expression is a
-- `TableFunctionNode`. Previously `addFilters` only accepted `TableNode`, so
-- the predicate was silently dropped from the remote query.

SET explain_query_plan_default = 'legacy';

CREATE TABLE t_json_minmax_forbidden_replicated_r2 (
    id Int32,
    col1 JSON
) ENGINE = ReplicatedMergeTree('/clickhouse/tables/{database}/04278_json_minmax_index_mixed_type_array_two_replicas', 'r2') ORDER BY id
SETTINGS allow_minmax_index_for_json = 1;

SELECT 'rewrite  isNotNull(n)=' , count() FROM t_sparse_nullable WHERE n IS NOT NULL
    SETTINGS optimize_trivial_count_with_sparsity_filter=1;

SELECT count() FROM numbers(10) WHERE materialize(now()) > toDateTime('1970-01-01');

-- tuple comparison decomposes a constant tuple into constant element columns, so a nested
-- string / non-string pair with the string side constant folds the same way a top-level one does
SELECT 'mixed tuple comparison with const string folded', countIf(explain LIKE '%Filter column%') = 0
FROM (EXPLAIN PLAN actions = 1 SELECT count() FROM numbers(1) WHERE materialize(tuple(toUInt8(1))) = tuple('1'));

SELECT count() FROM numbers(100) WHERE materialize(CAST(NULL AS Nullable(UInt8))) IS NULL;

CHECK TABLE t_drop SETTINGS check_query_single_value_result = 1;

SELECT 'reload isNull', extract(explain, '[A-Za-z].*') FROM (EXPLAIN SELECT count() FROM t_persist WHERE n IS NULL    SETTINGS optimize_trivial_count_with_sparsity_filter = 1) WHERE explain LIKE '%Optimized trivial count with sparsity filter%';

-- First insert without quorum, then sync r2 so both replicas hold the part
-- (4000 default zeros + 1000 ones). The earlier `insert_quorum = 2,
-- insert_quorum_parallel = 0` design here was flaky under CI: randomised
-- `max_insert_threads > 1` spawns multiple `ReplicatedMergeTreeSink`
-- instances, and the precondition check of the second sink races against
-- the first sink's `/quorum/status`, throwing
-- `UNSATISFIED_QUORUM_FOR_PREVIOUS_WRITE`.
INSERT INTO t_sparse_seq_consistency_r1
SELECT number, if(number < 4000, 0, 1)::UInt32 FROM numbers(5000)
SETTINGS optimize_on_insert = 0;

SELECT 'IS UNKNOWN'     AS predicate, count() FROM bool_set_idx WHERE b IS UNKNOWN           SETTINGS enable_parallel_replicas = 0, log_comment = '04290 IS UNKNOWN',     optimize_trivial_count_with_sparsity_filter = 0;

SELECT trimLeft(explain) AS explain FROM (
    EXPLAIN indexes = 1
    SELECT * FROM tab2 WHERE s LIKE 'a\\b%' ESCAPE '\\'
) WHERE explain LIKE '%Condition:%';

-- Query B — verbatim AST-fuzzer query that originally surfaced the failure
-- (https://s3.amazonaws.com/clickhouse-test-reports/json.html?PR=105041&sha=latest&name_0=PR).
-- ReplacingMergeTree because the fuzzer's FINAL keyword requires it; ORDER BY a
-- so `b` stays non-PK (matching the fuzzer's `t2_04227__fuzz_37` schema). The
-- shape exercises:
--   * GLOBAL IN whose subquery is a UNION DISTINCT of two `ct` references
--     (the per-branch safety-net race);
--   * a regular `WHERE b IN (SELECT b FROM ct)` (the simpler runtime-set path);
--   * non-materialized `rs` CTE inlined into the outer query (so all `ct`
--     references end up in the outer plan, not in a nested materialized CTE);
--   * PREWHERE / FINAL / QUALIFY / constant filters that the fuzzer injected.
-- Wrapped in `SELECT count() FROM (...)` so the test pins a single integer
-- instead of an unordered row set.
DROP TABLE IF EXISTS t2_04227__fuzz_37 SYNC;

ATTACH TABLE v_intersect_union_right;

DETACH TABLE v_except_union_distinct SYNC;

SELECT * FROM v_mixed_chain ORDER BY all;

SELECT count() FROM system.instrumentation WHERE handler = 'sleep' AND entry_type = 'Entry' AND toString(arguments) = '[-1,1]';

-- MODIFY COLUMN with the postfix modifier, single-word and multiword types, both directions.
ALTER TABLE t_alter_null MODIFY COLUMN c Int32 NULL;

-- backward-compat: `at` and `local` must remain usable as column names and aliases
SELECT at, local FROM (SELECT 1 AS at, 2 AS local);

SELECT c0 FROM test_intdiv_neg WHERE c0 = -1 ORDER BY c0 SETTINGS force_primary_key = 1, max_rows_to_read = 4;

DROP TABLE test_divide_neg;

SELECT '-- MVTEncodeGeom: (0,0) projects to pixel (0,0) at the centre tile for every zoom (no Web Mercator drift)';

SELECT '-- MVTEncode: feature_id_name must name an existing unsigned-integer element (signed integers are rejected)';

SELECT hex(MVTEncodeMerge('points')(s))
FROM
(
    SELECT MVTEncodeState('points')((124.0, 3384.0)::Point::Geometry, tuple(toUInt64(3))::Tuple(cluster_count UInt64)) AS s
);

-- The MergeTree documentation is migrated in full, so it contains its section headers.
SELECT
    position(description, '## Projections') > 0 AS has_projections_section,
    position(description, '## Data storage') > 0 AS has_data_storage_section
FROM system.table_engines
WHERE name = 'MergeTree';

SELECT count() FROM (SELECT * FROM u_4263 WHERE uid = 10) WHERE uid = 10;

WITH
    MVTBoundingBox(10, 550, 335) AS bb,
    (bb.3 - bb.1) / 4096 AS deg_per_px,
    bb.3 + deg_per_px * 5 AS lon_just_outside,
    (bb.2 + bb.4) / 2 AS lat_mid
SELECT
    MVTEncodeGeom((lon_just_outside, lat_mid)::Point, 10, 550, 335, 4096, 0) IS NULL AS buf0_clips,
    MVTEncodeGeom((lon_just_outside, lat_mid)::Point, 10, 550, 335, 4096, 16) IS NOT NULL AS buf16_keeps;

SELECT '-- MVTEncodeGeom: a self-crossing sliver clips to a small valid polygon, not a whole-tile fill';

DROP TABLE t_alter_seg_validation;

INSERT INTO t04303 VALUES ('2025-05-04 10:00:02', 1.0);

-- Whole-hour negative offset (UTC-5 in EST).
SELECT EXTRACT(TIMEZONE_HOUR   FROM toDateTime('2024-01-15 12:00:00', 'America/New_York'));

-- Regression test: a join runtime filter must NOT be served from the query condition cache.
--
-- The runtime-filter handle carried by `__applyFilter` has a deterministic, structural name
-- (`_runtime_filter_<structural_hash>`), so the PREWHERE expression on the probe table is
-- byte-identical across executions of the same plan. The actual filter contents, however, depend
-- on the right side of the join, which differs from execution to execution. `__applyFilter` is
-- therefore marked non-deterministic so it is excluded from the query condition cache: otherwise
-- the first execution would cache a per-granule "no match -> skip" result that a later execution
-- with different right-side keys would reuse, silently dropping rows.
--
-- With the fix every execution returns correct results. If `__applyFilter` were deterministic (or
-- the old query-scoped name lookup were restored), the later executions would reuse the stale
-- granule skips from the first and return 0 rows.

SET enable_join_runtime_filters = 1;

-- `has` is turned into a set as well; 80000 rows have `k` in {0, 3}.
SELECT trimLeft(explain) FROM (EXPLAIN indexes = 1 SELECT count() FROM t_ifnull_keycond WHERE team_id = 1 AND ifNull(has([0, 3], k), 0) SETTINGS enable_parallel_replicas = 0) WHERE explain LIKE '%Condition%' OR explain LIKE '%Granules%';

SELECT count() FROM t_ifnull_bf WHERE coalesce(equals(x, '100'), 0) SETTINGS force_data_skipping_indices = 'idx';

SELECT number FROM view(SELECT number FROM remote('127.0.0.1', numbers(3))) WHERE number = 1 ORDER BY number;

INSERT INTO t_52624 SELECT number + 3  * 100000 FROM numbers(16384);

INSERT INTO t_04303 VALUES (1, 10), (2, 20);

DROP TABLE gh_04303;

SELECT '-- the index is still recognized by force_data_skipping_indices (it is read, just prunes nothing)';

SELECT toTypeName(toDayOfMonth(materialize(INTERVAL 300 DAY)::Dynamic));

CREATE TABLE prewhere_stats_group (
    a UInt64 STATISTICS(tdigest, countmin),
    b UInt64 STATISTICS(countmin)
) ENGINE = MergeTree ORDER BY tuple()
-- Pin compact parts (per-column sizes = 0) so PREWHERE ordering is by selectivity alone, stable under CI-randomized part-type/serialization settings.
SETTINGS min_bytes_for_wide_part = 1000000000000, min_rows_for_wide_part = 1000000000000;

-- Results must be unchanged by the pruning (one matching row each).
SELECT count() FROM int_pk WHERE (k = 42) IS TRUE                       SETTINGS optimize_trivial_count_query = 0;

DROP TABLE IF EXISTS t_adaptive_insert;

INSERT INTO t_adaptive_compact SELECT number, number, toString(number), number, number, [toInt32(number)] FROM numbers(1000, 1000);

-- SIMD path: the left argument is a constant vector, the right one is the column.
-- Every metric must match the Float64 reference within tolerance (1 = pass).
WITH (SELECT v FROM bf16_vectors WHERE id = 0) AS a
SELECT
    max(abs(L1Distance(a, v)        - arraySum(arrayMap((x, y) -> abs(toFloat64(x) - toFloat64(y)), a, v)))) < 0.01,
    max(abs(L2SquaredDistance(a, v) - arraySum(arrayMap((x, y) -> (toFloat64(x) - toFloat64(y)) * (toFloat64(x) - toFloat64(y)), a, v)))) < 0.1,
    max(abs(L2Distance(a, v)        - sqrt(arraySum(arrayMap((x, y) -> (toFloat64(x) - toFloat64(y)) * (toFloat64(x) - toFloat64(y)), a, v))))) < 0.01,
    max(abs(LinfDistance(a, v)      - arrayMax(arrayMap((x, y) -> abs(toFloat64(x) - toFloat64(y)), a, v)))) < 0.001,
    max(abs(cosineDistance(a, v)    - (1 - arraySum(arrayMap((x, y) -> toFloat64(x) * toFloat64(y), a, v))
        / (sqrt(arraySum(arrayMap(x -> toFloat64(x) * toFloat64(x), a))) * sqrt(arraySum(arrayMap(y -> toFloat64(y) * toFloat64(y), v))))))) < 0.0001
FROM bf16_vectors;

SET parallel_replicas_prefer_local_join=1;

-- Basic CREATE with an exact URL, default method (GET) and default type (query).
CREATE HANDLER h04305_a URL '/test_04305/a' AS SELECT 1 AS x;

-- All four HTTP methods are accepted.
CREATE HANDLER h04305_methods URL '/test_04305/m' METHODS (GET, POST, PUT, DELETE) AS SELECT 1;

DROP HANDLER h04305_post_a;

-- Database engines expose embedded documentation via system.database_engines.

-- Representative engines must have a non-empty description and syntax.
-- Only engines that are always compiled in are listed here, so the test is build-independent.
SELECT name, length(description) > 0 AS has_description, length(syntax) > 0 AS has_syntax
FROM system.database_engines
WHERE name IN ('Atomic', 'Replicated', 'Memory')
ORDER BY name;

DROP TABLE t_month32;

INSERT INTO local_nested VALUES ('2024-01-01 00:00:00', 10);

DROP TABLE dist_prefix;

CREATE TABLE dist_dup_mixed
(
    `dt` DateTime,
    `x` UInt8,
    `flag_a` String ALIAS concat(toString(x), '_suffix'),
    `flag_b` String ALIAS toString(x)
)
ENGINE = Distributed('test_cluster_two_shards_localhost', currentDatabase(), local_dup_mixed, rand());

INSERT INTO local_const_stage VALUES (10, 'a'), (20, 'b');

SELECT 'RIGHT+LEFT dpsub:';

SELECT number FROM remote('127.0.0.{1,2,3}', numbers_mt(10)) ORDER BY number LIMIT AFTER number >= 7;

select regexpExtract('100-200', '\\d+');

-- Original reproducer from the issue (used to throw LOGICAL_ERROR). The `0`
-- row must be filtered out -- if the policy stopped being applied we would
-- see four rows instead of three.
SELECT c0 FROM t_106099 ORDER BY c0;

SELECT c0 FROM t_106099_u8 ORDER BY c0 SETTINGS additional_table_filters = {'t_106099_u8':'c0'};

SELECT toString(CAST(CAST(-1.5 AS Time64(1)) AS Time));

SELECT countIf(toStartOfYear(c1) >= toDate('2100-01-01')) FROM t_date32_upper;

SELECT count() FROM t_keycond_nan_eq WHERE c0 < -20;

SELECT formatQueryFromJSON(parseQueryToJSON('DELETE FROM t ON CLUSTER c WHERE id = 1'));

-- Related disk types are exposed as an array.
SELECT length(related) > 0
FROM system.disk_types
WHERE name = 'local';

INSERT INTO issue_repro SELECT toDate32('1905-01-01') + toIntervalDay(number * 30)    FROM numbers(9);

select regexpExtract(materialize('100-200'), '\\d+', 0);

WITH ['a', 'cd'] AS needles
SELECT (SELECT arraySort(groupArray(id)) FROM tab WHERE multiMatchAny(str, needles) SETTINGS use_skip_indexes = 1) AS ids,
       ids = (SELECT arraySort(groupArray(id)) FROM tab WHERE multiMatchAny(str, needles) SETTINGS use_skip_indexes = 0);

SELECT trim(explain)
FROM (EXPLAIN PLAN indexes = 1 SELECT id FROM tab WHERE multiMatchAny(str, ['k']))
WHERE explain LIKE '%Granules: %';

SELECT sumMap(statusMap.goal_id, statusMap.revenue) FROM sum_map_nested_nullable_decimal;

DROP TEMPORARY TABLE t_tmp_skip_idx;

SELECT '-- a valid multi-byte UTF-8 needle is code-point aligned and matches through the index (expect 1 and 1)';

SELECT * LIKE 'foo%' EXCEPT (foo) FROM (SELECT 1 AS foo, 2 AS foobar, 3 AS FooBar);

-- DISTINCT in order + collation: exact values, analyzer.
SELECT arraySort(groupArray(s))
FROM (SELECT DISTINCT s FROM (SELECT arrayJoin(['a', 'A', 'a', 'A', 'á', 'Á', 'b']) AS s ORDER BY s COLLATE 'en-u-ks-level2'))
SETTINGS optimize_distinct_in_order = 1;

CREATE TABLE t_on_cluster_not_null ON CLUSTER test_shard_localhost
(
    key Int64 NOT NULL,
    value String
)
ENGINE = MergeTree
ORDER BY tuple()
FORMAT Null;

-- Start from an empty cache so the first execution is a guaranteed cold miss.
SYSTEM CLEAR TEXT INDEX POSTINGS CACHE;

INSERT INTO t_collision_expr VALUES ('2024-01-01', 7, 10);

CREATE TABLE t2 (c0 Int32) ENGINE = MergeTree() ORDER BY (sqrt(c0)) PARTITION BY c0 SETTINGS allow_suspicious_indices = 1;

SELECT id FROM tab WHERE hasAllTokens(doc, ['北京邮电大学'], 'chinese') ORDER BY id SETTINGS use_skip_indexes = 1, query_plan_direct_read_from_text_index = 1;

SELECT replaceRegexpOne(explain, '^[ ]*(.*)', '\1') FROM (EXPLAIN PIPELINE SELECT k FROM test_reverse_offset LIMIT 2 OFFSET 1 BY k SETTINGS optimize_limit_by_in_order = 1) WHERE explain LIKE '%LimitBy%Transform%' OR explain LIKE '%MergingSortedTransform%';

INSERT INTO test_merge_mixed_dir_part_1 SELECT number % 20, number      FROM numbers(1000);

EXPLAIN indexes = 1
SELECT count() FROM t_sparse_pk_truncation
WHERE c0 <= 1 AND c0 >= 3
SETTINGS use_lightweight_primary_key_index_analysis = 1;

SELECT id, arrayJoin(a) AS v FROM t ORDER BY id, pos LIMIT 1 BY id SETTINGS max_threads = 2;

-- Tests the `skip_unavailable_shards_mode` setting on the SELECT path.
-- Shard 2 (of 3) raises an exception via `throwIf` before returning any data; whether the
-- exception is ignored depends on the mode (see the setting description in src/Core/Settings.cpp).

-- `unavailable_or_exception_before_processing`: the exception arrives before any data, so shard 2 is skipped.
SELECT * FROM remote('127.0.0.{1,2,3}', view(SELECT throwIf(shardNum() = 2) AS x, shardNum() AS sn)) ORDER BY sn
SETTINGS prefer_localhost_replica = 0, skip_unavailable_shards = 1, skip_unavailable_shards_mode = 'unavailable_or_exception_before_processing';

DROP TABLE IF EXISTS t_106573_norm_proj;

CREATE TABLE inner_parallel ENGINE = Memory AS
SELECT l.k AS k, l.t AS t, l.v AS lv, r.v AS rv
FROM asof_left AS l
ASOF INNER JOIN asof_right AS r
    ON l.k = r.k AND l.t >= r.t
SETTINGS hash_join_layout = 'parallel', log_comment = '04319_inner_parallel';

DROP TABLE inner_serial;

-- Vector path
SELECT dictGetKeys('dict_consistency', 'f64', materialize(CAST(nan AS Float64)));

INSERT INTO test_permuted_multi SELECT number % 50, number % 7, number      FROM numbers(1000);

SELECT replaceRegexpOne(explain, '^[ ]*(.*)', '\1') FROM (EXPLAIN PIPELINE SELECT c, a FROM test_permuted_reverse LIMIT 1 BY c, a SETTINGS optimize_limit_by_in_order = 1) WHERE explain LIKE '%LimitBy%Transform%' OR explain LIKE '%MergingSortedTransform%';

INSERT INTO tab_opt_out VALUES ('Bob', 4, 100, '1'), ('Nikita', 2, 54, '1'), ('Nikita', 1, 228, '1'), ('Alex', 4, 83, '1'), ('Alex', 4, 134, '1'), ('Alex', 1, 65, '0'), ('Alex', 4, 134, '1'), ('Bob', 2, 53, '0'), ('Alex', 4, 83, '0'), ('Alex', 1, 63, '1'), ('Bob', 2, 53, '1'), ('Alex', 4, 192, '1'), ('Alex', 2, 128, '1'), ('Nikita', 2, 148, '0'), ('Bob', 4, 177, '0'), ('Nikita', 1, 173, '0'), ('Alex', 1, 239, '0'), ('Alex', 1, 63, '0'), ('Alex', 2, 224, '1'), ('Bob', 4, 177, '0'), ('Alex', 2, 128, '1'), ('Alex', 4, 134, '0'), ('Alex', 4, 83, '1'), ('Bob', 4, 100, '0'), ('Nikita', 2, 54, '1'), ('Alex', 1, 239, '1'), ('Bob', 2, 187, '1'), ('Alex', 1, 65, '1'), ('Bob', 2, 53, '1'), ('Alex', 2, 224, '0'), ('Alex', 4, 192, '0'), ('Nikita', 1, 173, '1'), ('Nikita', 2, 148, '1'), ('Bob', 2, 187, '1'), ('Nikita', 2, 208, '1'), ('Nikita', 2, 208, '0'), ('Nikita', 1, 228, '0'), ('Nikita', 2, 148, '0');

-- ============================================================
-- Case 2: flat named Tuple, insert subfield in the middle
-- ============================================================
CREATE TABLE t_named_tuple_alter (id UInt64, t Tuple(a Int64, b String))
ENGINE = MergeTree ORDER BY id;

-- ============================================================
-- Case 8: multiple sequential ALTERs adding fields at varying positions
-- ============================================================
CREATE TABLE t_named_tuple_alter (id UInt64, t Tuple(a Int64, b String))
ENGINE = MergeTree ORDER BY id;

-- ============================================================
-- Case 14 (REJECT): stream-name collision is still rejected
-- ============================================================
SET flatten_nested = 0;

-- Sanity: appending a subfield to a Tuple that is NOT in any key still works.
CREATE TABLE t_named_tuple_alter (id UInt64, t Tuple(a UInt64, b UInt64))
ENGINE = MergeTree ORDER BY id;

ALTER TABLE t_named_tuple_alter
    MODIFY COLUMN `data` Tuple(a Int64, b Int64, c Int64);

ALTER TABLE t_named_tuple_alter
    MODIFY COLUMN t Tuple(a UInt64, b UInt64) SETTINGS alter_sync = 2;

-- With the optimization disabled the redundant key is kept and the result is unchanged.
EXPLAIN SYNTAX run_query_tree_passes = 1 SELECT g FROM test ORDER BY x LIMIT 2 BY g, g + 1 SETTINGS optimize_limit_by_function_keys = 0;

-- Dense-ish series spanning the windows' reach back to 60 (T_0 - window); includes resets at 88 and 108.
INSERT INTO ts_two_stacks VALUES
    (60, 1), (65, 3), (72, 6), (80, 10), (88, 9), (95, 14), (101, 20), (108, 5), (114, 8), (120, 13);

SELECT timeSeriesStdvarToGrid(100, 120, 2, 51)(timestamp, value) FROM ts_two_stacks;

DROP TABLE IF EXISTS ts_memo;

SELECT timeSeriesDerivToGrid(0, 80, 10, 25)(timestamp, value) FROM ts_split;

DROP TABLE t_arrayjoin_limit_no_sort;

SELECT formatQueryFromJSON('{"type":"Literal","value":{"field_type":"Bool","value":"yes"}}');

DROP TABLE IF EXISTS t_read_rejects;

SELECT DISTINCT trim(BOTH ' ' FROM explain) FROM (EXPLAIN PIPELINE SELECT g, x FROM test_neg_permuted_offset ORDER BY g, x LIMIT -2 OFFSET -1 BY x, g) WHERE explain ILIKE '%NegativeLimitBy%';

-- Constant arguments of an injective function are dropped; the remaining argument becomes the key.
EXPLAIN SYNTAX run_query_tree_passes = 1 SELECT g FROM test ORDER BY x LIMIT 2 BY tuple(g, 1);

EXPLAIN SYNTAX SYSTEM START t;

SELECT '--- a bare verb needs a parseable table, else it is a syntax error ---';

-- The engine-level `unavailable` mode does not ignore it.
CREATE TABLE dist_sus_strict (x UInt8) ENGINE = Distributed('test_cluster_two_shards_different_databases', '', v_sus)
SETTINGS skip_unavailable_shards = 1, skip_unavailable_shards_mode = 'unavailable';

SELECT count() FROM (SELECT number FROM numbers(100) ARRAY JOIN if(number < 3, [], [number]) AS x ARRAY JOIN [1, 2] AS y LIMIT 3);

-- Permuted LIMIT BY pushed into the sort: ORDER BY (key, val) covers the LIMIT BY keys (val, key) in a
-- different order. The optimizer installs the per-stream LIMIT BY hint with the permuted columns, and at
-- runtime (several sorted streams) the per-stream LimitBySortedStreamTransform pre-cap runs before the merge.
DROP TABLE IF EXISTS test_push_permuted;

CREATE TABLE t_session_tz_lc_dt
(
    a DateTime,
    b LowCardinality(DateTime)
) ENGINE = Memory
SETTINGS allow_suspicious_low_cardinality_types = 1;

SELECT 'after parens:', count(), groupArray(id), groupArray(value) FROM (SELECT * FROM t_mem_2380 ORDER BY id);

-- Values above the maximum are clamped, and the session survives those too.
SET format_avro_schema_registry_max_retries = 21;

INSERT INTO test_collapse_extra SELECT number % 50, intDiv(number, 50) % 4, number+1000 FROM numbers(1000);

SELECT if(CAST(NULL, 'Nullable(Nothing)'), 1, 2);

DROP TABLE test_in_order_no_partition;

WITH A AS
(
    SELECT * FROM t_in_order
    UNION ALL
    SELECT * FROM t_no_order
)
SELECT timestamp, id FROM A ORDER BY timestamp DESC LIMIT 10;

SELECT sumMap([1, 2], [true, false]);

SELECT
    res = arrayReverseSort(res)                                                  AS is_sorted,
    arrayCount(p -> p.1 < p.2, arrayZip(arrayPopBack(res), arrayPopFront(res)))  AS order_violations
FROM
(
    SELECT groupArray(k) AS res FROM
    (
        WITH A AS ( SELECT k FROM t_union_narrow UNION ALL SELECT k FROM t_union_narrow )
        SELECT k FROM A ORDER BY k DESC LIMIT 3200
    )
)
SETTINGS optimize_read_in_order = 1, read_in_order_use_virtual_row = 0,
         max_threads = 8, max_streams_to_max_threads_ratio = 1,
         max_streams_for_union_step = 2, max_streams_for_union_step_to_max_threads_ratio = 0;

SYSTEM STOP MERGES test_outer_finish_sort;

SELECT toTypeName(JSON_VALUE('{"a": 1}', '$.a'));

SELECT JSON_EXISTS('{"a": 1, "b": 2}'::Dynamic, tuple('$.a', toLowCardinality('$.b')));

-- Ensure conversion to two level is enabled even in single threaded cases.
SET max_bytes_ratio_before_external_group_by = 0;

-- A `CREATE OR REPLACE MATERIALIZED VIEW` that owns an over-limit inner
-- `MergeTree` table must fail the size guard for the same reason a plain
-- `DROP TABLE mv` does (see `03667_drop_inner_table_size_limits.sql`):
-- replace must not be a privileged path that bypasses what plain drop refuses.
CREATE TABLE t04326_mv_src (id UInt64) ENGINE = MergeTree() ORDER BY id;

-- ============================================
-- 3. Missing / nonexistent keys
-- ============================================
SELECT 'missing_key';

SELECT 'explain_optimized_chain';

SELECT '{"a" : 42}'::JSON(a UInt32) AS json, json['a'];

SELECT 'JSONHas with setting';

CREATE TABLE test_json_nested (json JSON(a.b Nullable(Int64))) ENGINE = Memory;

SELECT 'non-nullable has with setting';

SELECT count() FROM (SELECT * FROM numbers(10) SETTINGS limit = 0.5);

-- no-parallel-replicas: EXPLAIN output differs for parallel replicas.

-- materialize_statistics_on_insert is orthogonal to minmax NaN pruning and, when randomized on, makes
-- even the use_skip_indexes=0 reference count wrong for the NaN rows, so pin it off.
SET materialize_statistics_on_insert = 0;

DROP TABLE IF EXISTS t_minmax_nan_chain;

-- Same liveness assertion for this layer, on its own negated predicate and its own index type.
SELECT countIf(explain LIKE '%Description: set GRANULARITY 1%')
FROM (EXPLAIN indexes = 1 SELECT count() FROM t_set_idx_nan WHERE NOT ((val >= 0.) AND (val <= 3.)));

-- LowCardinality(Float*) and LowCardinality(Nullable(Float*)) hide a NaN the same way, so the rule has
-- to see through both wrappers.

SET allow_suspicious_low_cardinality_types = 1;

-- Single-sided negated comparison (issue #110266): NOT(f > c) is reduced by KeyCondition to the range
-- f <= c, and a min=max=NaN granule reports "cannot match" and is pruned. But NOT(NaN > c) = NOT(false)
-- = true, so the NaN row must be returned. Same for NOT(f < c). Non-negated forms are unaffected.

DROP TABLE IF EXISTS t_minmax_nan_single;

SELECT count() FROM t_like_pk WHERE value != 'example.com';

SELECT count() FROM t_like_unknown_escape WHERE value NOT LIKE '\\w' SETTINGS force_primary_key = 1;

SELECT 'Adaptive OFF';

SELECT toTypeName(ifNull(materialize(toNullable(toDecimal64(1, 2))), 0.));

-- But the expression form `CASE expr WHEN ... END` (function caseWithExpression) is outside the
-- setting: it follows use_variant_as_common_type, so mixed numeric branches with no lossless
-- common type produce a Variant regardless of the setting, which value-combining aggregates reject.
SELECT toTypeName(CASE materialize(1) WHEN 1 THEN toDecimal64(1, 2) ELSE 0. END);

SELECT arrayLevenshteinDistanceWeighted([1, 2], [3, 4], [18446744073709551615, 18446744073709551615]::Array(UInt64), [18446744073709551615, 18446744073709551615]::Array(UInt64));

-- (1) An `UPDATE` JSON that injects a `format_ast` cannot produce `UPDATE ... FORMAT Null`:
-- the output options are not read for this query type, so the extra field is ignored.
SELECT formatQueryFromJSON('{"type":"UpdateQuery","table":{"type":"Identifier","name":"t"},"assignments":{"type":"ExpressionList","children":[{"type":"Assignment","column_name":"x","children":[{"type":"Literal","value":{"field_type":"UInt64","value":1}}]}]},"predicate":{"type":"Literal","value":{"field_type":"UInt64","value":1}},"format_ast":{"type":"Identifier","name":"Null"}}');

-- Tag no-fasttest: Depends on OpenSSL

-- Encrypting/decrypting with a constant key (and absent or empty IV) must produce exactly
-- the same result as with a non-constant key, for every row. This guards against any
-- constant-key specialization diverging from the generic path -- e.g. by reusing a single
-- cipher context across rows and leaking the IV state of the previous row into the next.
-- The per-row (correct) path is forced by materializing the key into a non-constant column,
-- so every comparison below must be 1, independently of the data, for all stateful modes.
-- https://github.com/ClickHouse/ClickHouse/pull/99105

-- The input has a repeated row so that a leak of IV state across rows would change the
-- second occurrence and break the equality.

WITH unhex('00112233445566778899aabbccddeeff') AS key
SELECT
    'aes-128-cbc' AS mode,
    hex(encrypt('aes-128-cbc', p, key)) = hex(encrypt('aes-128-cbc', p, materialize(key))) AS encrypt_no_iv_matches,
    hex(encrypt('aes-128-cbc', p, key, '')) = hex(encrypt('aes-128-cbc', p, materialize(key), '')) AS encrypt_empty_iv_matches,
    decrypt('aes-128-cbc', encrypt('aes-128-cbc', p, key), key) = p AS roundtrip_no_iv_ok
FROM (SELECT arrayJoin(['the quick brown!', 'the quick brown!', 'lazy dog jumped!']) AS p)
ORDER BY p;

SELECT formatQuerySingleLine('SELECT m[1], (x -> x AS g).3[2] FROM t');

-- Both colliding joins run in ONE query, so both filters live in one registry under the same
-- fingerprint name (verified above) but with distinct random rendezvous keys. A cross-wire would apply
-- subquery 1's filter (built from a.k < 300) to subquery 2 (or vice versa) and prune rows that should
-- match. The `count()` and the payload hash (sensitive to every surviving row and pairing) must be
-- identical with runtime filters on (the colliding case) and off.
SELECT 'rf on',
    (SELECT (count(), sum(cityHash64(t.k, t.v, a.w))) FROM rf_fp_t t JOIN rf_fp_a a ON t.k = a.k WHERE a.k < 300),
    (SELECT (count(), sum(cityHash64(t.k, t.v, a.w))) FROM rf_fp_t t JOIN rf_fp_a a ON t.k = a.k WHERE a.k >= 700)
SETTINGS enable_join_runtime_filters = 1;

INSERT INTO test_json_dots_typed FORMAT JSONAsObject {"a.b": 1, "c": 100};

SET query_plan_max_limit_for_top_k_optimization = 100;

DETACH TABLE t_nullable_partition SYNC;

DETACH TABLE t_lc_nullable_composite SYNC;

SELECT 'x' LIKE pattern FROM (SELECT arrayJoin(['%', '_', 'x', 'y']) AS pattern);

-- A materialized CTE may read the recursive CTE from the outer query.
WITH RECURSIVE walk AS
(
    SELECT 1 AS x
    UNION ALL
    SELECT x + 1 FROM walk WHERE x < 3
),
total AS MATERIALIZED
(
    SELECT sum(x) AS s FROM walk
)
SELECT * FROM total;

-- Release coverage: the debug self-check above is compiled out on release builds, where the bug
-- surfaces as a silently wrong row order. Tag every output row with its position and assert that
-- no adjacent pair is out of DESC NULLS FIRST order. The key is NULL-safe (isNull is the
-- high-order component, so NULL sorts greatest as required by DESC NULLS FIRST), so every pair is
-- compared. Prints 1 with the fix, 0 with the bug.
WITH src AS
(
    SELECT
        if(number % 3 = 0, ['a', 'b'], emptyArrayString())                          AS c1,
        if(number % 5 = 0, toNullable(toString(cityHash64(number, 10) % 4)), NULL)  AS c2,
        toString(cityHash64(number * 3, 10) % 12)                                   AS c3,
        if(number % 5 = 0, toNullable(toString(number % 3)), NULL)                  AS c4,
        toString(number % 4)                                                        AS c5
    FROM numbers(1170)
),
sorted AS
(
    SELECT c1, c2, c3, c4, c5, rowNumberInAllBlocks() AS rn
    FROM (SELECT * FROM src ORDER BY ALL DESC NULLS FIRST LIMIT 400)
),
neighbors AS
(
    SELECT
        tuple(c1, isNull(c2), ifNull(c2, ''), c3, isNull(c4), ifNull(c4, ''), c5)                                AS cur,
        lagInFrame(tuple(c1, isNull(c2), ifNull(c2, ''), c3, isNull(c4), ifNull(c4, ''), c5)) OVER (ORDER BY rn) AS prev,
        rn
    FROM sorted
)
SELECT countIf(rn > 0 AND cur > prev) = 0 AS output_is_sorted
FROM neighbors;

CREATE TABLE t_empty
(
    Hour DateTime('UTC'),
    NetworkId UInt16,
    BundleDomain Int32,
    AppSiteChannelId Int32,
    DeviceTypeId UInt16,
    Impressions UInt64,
    Clicks UInt64,
)
ENGINE = MergeTree()
PARTITION BY toYearWeek(Hour)
ORDER BY (Hour, NetworkId, BundleDomain, AppSiteChannelId, DeviceTypeId)
SETTINGS index_granularity=10;

SELECT trimLeft(explain) AS e
FROM
(
    SELECT *
    FROM viewExplain('EXPLAIN', '', (
        SELECT
            BundleDomain AS AppOrSiteIdDomain,
            DeviceTypeId,
            sum(Impressions) AS Impressions,
            sum(Clicks) AS Clicks
        FROM v_pruned_second
        WHERE ((Hour >= '2024-01-15') AND (Hour <= '2024-01-25')) AND (DeviceTypeId > 0)
        GROUP BY
            AppOrSiteIdDomain,
            DeviceTypeId
        ORDER BY
            AppOrSiteIdDomain ASC,
            DeviceTypeId ASC
        SETTINGS parallel_replicas_local_plan = 1, parallel_replicas_allow_view_over_mergetree = 1, parallel_replicas_min_number_of_rows_per_replica = 1
    ))
)
WHERE e IN ('Aggregating', 'MergingAggregated');

INSERT INTO t_reader_executor_metrics
SELECT number, number * 2, concat('row_', toString(number))
FROM numbers(300000);

SELECT sum(if(dummy = 0, null, 1)) FROM remote('127.0.0.{1,2}', system.one);

-- Tuple(Variant): several distinct values on the right (the set path with negative lookup), NULL on both sides.
SELECT
    (SELECT arraySort(groupArray(toString(k))) FROM (SELECT tuple(v, 1) AS k FROM format(TSV, 'v Variant(String, Bool)', '\\N\ntrue\nfalse\nstr')) AS t1 LEFT ANTI JOIN (SELECT tuple(v, 1) AS k FROM format(TSV, 'v Variant(String, Bool)', '\\N\ntrue')) AS t2 USING (k) SETTINGS enable_join_runtime_filters = 0)
  = (SELECT arraySort(groupArray(toString(k))) FROM (SELECT tuple(v, 1) AS k FROM format(TSV, 'v Variant(String, Bool)', '\\N\ntrue\nfalse\nstr')) AS t1 LEFT ANTI JOIN (SELECT tuple(v, 1) AS k FROM format(TSV, 'v Variant(String, Bool)', '\\N\ntrue')) AS t2 USING (k) SETTINGS enable_join_runtime_filters = 1);

-- LowCardinality(Bool) key column vs LowCardinality(Nullable(UInt8)) constant (original AST fuzzer crash shape).
SELECT '-- LowCardinality(Bool) statistics pruning';

CREATE TABLE t_dotted_partition
(
    id UInt64,
    metrics Tuple(`p.x` UInt64, y UInt64),
    `metrics.p` UInt64
)
ENGINE = SummingMergeTree
PARTITION BY `metrics.p`
ORDER BY id
SETTINGS allow_tuple_element_aggregation = 1;

-- Works over a column too (set built once, applied per row).
SELECT trimLeft(s, 'SRID=4326;POINT (') FROM values('s String', 'SRID=4326;POINT (10 20)', 'SRID=4326;POINT (-1 -2)');

SELECT count() FROM t_04327_stripe_log SETTINGS lock_acquire_timeout = 100000000000;

SELECT count() FROM t_106533_float WHERE f <= 5;

-- An all-finite part is still pruned for a range no value satisfies. A separate single-part table keeps
-- this merge-stable (the Min-Max prunes the only part, so EXPLAIN shows Parts: 0/1).

DROP TABLE IF EXISTS t_106533_partlevel_finite;

OPTIMIZE TABLE t_adaptive_none FINAL;

-- Tests that joins on a single LowCardinality key column produce the same results as the
-- equivalent join with the key materialized to its plain type. A non-nullable LowCardinality key
-- now uses a dictionary-aware hash map (low_cardinality_key*), so this guards that the dictionary
-- handling, the conditional key materialization, and the offset-based used-flags are all correct.
-- Each query prints 1 when the LowCardinality result equals the plain-type result for that join
-- kind; the per-row checksum is order-independent.

SET allow_suspicious_low_cardinality_types = 1;

INSERT INTO lcj_fs_pl SELECT toFixedString(leftPad(toString(number % 50), 4, '0'), 4), number FROM numbers(2000);

DROP TABLE IF EXISTS t_set_variant_lc;

DROP TABLE IF EXISTS t_dotted_element_names;

INSERT INTO realt SELECT number, 1 FROM numbers(10);

CREATE TABLE t_add_memory (`n.a` Array(Tuple(aa UInt64))) ENGINE = Memory;

-- The statistics hints claim big tables with high-NDV group keys so that shuffle aggregation
-- wins for the subquery; the physical tables stay small to keep the test fast in debug builds.
SET param__internal_join_table_stat_hints = '{"t_dist_left": {"cardinality": 100000, "avg_row_bytes": 24, "distinct_keys": {"a": 1000, "b": 100}}, "t_dist_right": {"cardinality": 1000000, "avg_row_bytes": 24, "distinct_keys": {"a": 1000, "b": 100}}}';

-- (UInt16, UInt16) clause [keys32] OR (UInt32, UInt32) clause [keys64] -> merged to keys64.
SELECT 'keys32_or_keys64',
    (SELECT (count(), sum(cityHash64(l.v, r.w))) FROM orj_l AS l ALL INNER JOIN orj_r AS r ON (l.a = r.a AND l.b = r.b) OR (l.c = r.c AND l.d = r.d))
  = (SELECT (count(), sum(cityHash64(l.v, r.w))) FROM orj_l AS l, orj_r AS r WHERE (l.a = r.a AND l.b = r.b) OR (l.c = r.c AND l.d = r.d));

CREATE TABLE t_jn3_nullable (id Nullable(UInt64), value String) ENGINE = MergeTree ORDER BY tuple() SETTINGS allow_nullable_key = 1;

DROP TABLE t_b;

DROP TABLE t_jn1;

CREATE TABLE t_gating_dim (k UInt64) ENGINE = MergeTree() ORDER BY k;

-- `join_any_take_last_row` pins which matching row an ANY join keeps: the last one built into
-- the hash table. A commutativity swap changes the build side, so it would change the result;
-- the swap alternative is not generated for such joins (the non-Cascades reordering suppresses
-- the swap the same way). `max_threads = 1` keeps the build order, and so the expected row,
-- deterministic.
SELECT '-- 14. ANY join with join_any_take_last_row is not swapped (must return the last row)';

SET param__internal_join_table_stat_hints = '';

SELECT trimLeft(explain)
FROM (
    EXPLAIN actions = 1
    SELECT l.x, r.y
    FROM l04330 AS l
    INNER JOIN r04330 AS r USING (a)
    WHERE (l.x = 'FRANCE' AND r.y = 'GERMANY') OR (l.x = 'GERMANY' AND r.y = 'FRANCE')
    ORDER BY l.x
)
WHERE explain ILIKE '%Filter column: %' SETTINGS use_join_disjunctions_push_down = 1, enable_join_runtime_filters = 0, enable_parallel_replicas = 0, query_plan_optimize_join_order_randomize = 0, optimize_move_to_prewhere = 0, query_plan_optimize_prewhere = 0 -- Pinned because the test asserts on join plan/order, and `Memory` tables support PREWHERE, so the move would turn the pushed-down filters into `Prewhere filter column`
FORMAT TSV;

-- SHOW CREATE <entity> <name> FORMAT ... (a real name present) was already fine
-- and must stay so.
EXPLAIN AST SHOW CREATE USER u_04330 FORMAT TabSeparated;

CREATE TABLE t_gsets (a UInt64, b UInt64, x UInt64) ENGINE = MergeTree() ORDER BY (a, b);

-- Multiple typed paths
select '{"a" : 42, "a" : {"b" : 42}, "c" : "hello", "c" : {"d" : 1}}'::JSON(a Int32, c String) as json, json.a, json.c, json.a.b, json.c.d, json.@a, json.@c;

DROP TABLE IF EXISTS t_leaf_collision_disabled;

SELECT '-- 1. PASTE JOIN is rejected under Cascades';

INSERT INTO FUNCTION file(currentDatabase() || '_04335.arrows', ArrowStream)
    SELECT number AS x, repeat('a', 3000) AS s FROM numbers(10000)
    SETTINGS max_block_size = 65536, min_insert_block_size_rows = 0, min_insert_block_size_bytes = 0, max_insert_threads = 1, output_format_arrow_compression_method = 'none', engine_file_truncate_on_insert = 1;

DROP TABLE t_nt;

DROP TABLE sk_r32;

DROP TABLE t_flat_map_in_sk;

-- PREWHERE over the multi-expression key. The line prints the predicate, the count with index
-- analysis, the count of a full scan, the marks selected by index analysis and the key condition.
SELECT 'PREWHERE ts > toDateTime(\'2026-04-01 00:00:00\', \'UTC\')', (SELECT count() FROM test_consumers PREWHERE ts > toDateTime('2026-04-01 00:00:00', 'UTC')),
    (SELECT count() FROM test_consumers PREWHERE ts > toDateTime('2026-04-01 00:00:00', 'UTC') SETTINGS use_primary_key = 0, use_partition_pruning = 0, use_skip_indexes = 0),
    (SELECT sum(marks) FROM (EXPLAIN ESTIMATE SELECT 1 FROM test_consumers PREWHERE ts > toDateTime('2026-04-01 00:00:00', 'UTC'))),
    (SELECT arrayStringConcat(groupArray(trimLeft(explain)), ' | ') FROM (EXPLAIN indexes = 1 SELECT 1 FROM test_consumers PREWHERE ts > toDateTime('2026-04-01 00:00:00', 'UTC')) WHERE trimLeft(explain) LIKE 'Condition:%')
FORMAT TSVRaw;

SELECT 'u32_select',  (SELECT groupBitXor(cityHash64(k, v)) FROM sj_lc_u32) = (SELECT groupBitXor(cityHash64(k, v)) FROM sj_pl_u32);

SELECT formatQueryFromJSON(parseQueryToJSON('SELECT 1 + 2 + 3 + 4 + 5'));

-- Keys and IVs varying per row and alternating keys exercise the key schedule cache
-- transitions; results must not depend on the previous row's key or IV state.
WITH
    arrayJoin(range(20)) AS n,
    leftPad(toString(n), 3, '0') AS n3,
    concat('key-key-key-k', n3) AS vkey,
    concat('iviviviviviiv', n3) AS viv,
    concat('key-key-key-k', leftPad(toString(n % 2), 3, '0')) AS akey,
    repeat('p', 1 + (n * 7) % 40) AS plain
SELECT
    n,
    hex(encrypt('aes-128-cbc', plain, vkey, viv)) AS vkey_viv,
    hex(encrypt('aes-128-cbc', plain, akey, viv)) AS akey_viv,
    hex(encrypt('aes-128-ecb', plain, vkey)) AS vkey_ecb,
    hex(encrypt('aes-128-cbc', plain, 'key-key-key-key+', viv)) AS ckey_viv,
    hex(encrypt('aes-128-cbc', plain, vkey, 'iviviviviviviviv')) AS vkey_civ
ORDER BY n;

SELECT 'arrayElement Array(LowCardinality)';

SELECT [10, 2, 13, 15][toNullable(toLowCardinality(1))] AS v, toTypeName(v);

-- Multipolygon of two squares (0.5, 0.5) - (3.5, 3.5) and (4.5, 4.5) - (8.5, 8.5):
-- inside for x, y in [1, 3] and for x, y in [5, 8].
SELECT sum(pointInPolygon((number % 10, intDiv(number, 10) % 10), [[[(0.5, 0.5), (3.5, 0.5), (3.5, 3.5), (0.5, 3.5)]], [[(4.5, 4.5), (8.5, 4.5), (8.5, 8.5), (4.5, 8.5)]]]))
FROM numbers_mt(1000000)
SETTINGS max_threads = 8, max_block_size = 4096;

CREATE TABLE quorum_break_r2 (x UInt64) ENGINE = ReplicatedMergeTree('/clickhouse/tables/{database}/04337/break', 'r2') ORDER BY x;

SELECT sum(countSubstrings(explain, 'function_name: anyLast_respect_nulls')) > 0
FROM (EXPLAIN QUERY TREE run_passes = 1 SELECT anyLast_respect_nulls(if(number < 3, number, NULL)) FROM numbers(4));

DROP TABLE old_export2;

ALTER TABLE topk_lwd_otf UPDATE _row_exists = 0 WHERE c0 = 0;

SELECT 'lwu DESC LIMIT 1', c0 FROM topk_lwu ORDER BY c0 DESC LIMIT 1 SETTINGS use_skip_indexes_for_top_k = 1;

DROP TABLE topk_lwu_other;

DROP TABLE topk_modify_other;

DROP TABLE test_ttl_agg_dynamic_agnostic;

-- A type-agnostic Dynamic consumer that handles every representative payload is still accepted.
CREATE TABLE test_ttl_agg_dynamic_finalize_agnostic
(
    key UInt64,
    d DateTime,
    dyn Dynamic
)
ENGINE = MergeTree()
ORDER BY key
TTL d + INTERVAL 1 DAY DELETE WHERE isNotNull(dyn) AND dynamicType(dyn) != 'UInt64';

-- The escape hatch also covers consumers of computed carriers.
SET allow_suspicious_ttl_expressions = 1;

DROP TABLE IF EXISTS test_ttl_selector_different_domains_reject;

CREATE TABLE test_ttl_selector_lifted_string_branch_reject
(
    cond UInt8,
    n UInt32,
    s String,
    d DateTime
)
ENGINE = MergeTree()
ORDER BY tuple()
TTL toDateTime(if(cond, CAST(n, 'Dynamic'), s)) + INTERVAL 1 DAY;

SELECT arraySort(x -> toString(x), [NULL, CAST('hi', 'Variant(Int32, String)')]);

SELECT accurateCastOrNull(CAST(tuple(CAST(NULL, 'Variant(Float32, String)')), 'Tuple(Variant(Float32, String))'), 'Tuple(Nullable(Float32))') AS r, toTypeName(r);

DROP TABLE IF EXISTS t_async_user_src;

SELECT arrayPushFront([toDateTime64('2020-01-01 00:00:00', 5)], changeMonth(materialize(toDateTime64('2020-01-01 12:00:00', 5)), 6));

SELECT sum(k) > 0 FROM t_cc_estimate
SETTINGS use_columns_cache = 1,
    columns_cache_max_estimated_bytes_to_write_to_cache = 150000;

SELECT (n IN (0) ? 'type_in' : 'other') AS x FROM t_04338_dist FORMAT Null
SETTINGS enable_parallel_replicas = 1, max_parallel_replicas = 2,
         cluster_for_parallel_replicas = 'test_cluster_two_shards_localhost',
         parallel_replicas_for_non_replicated_merge_tree = 1;

-- A later `UPDATE a = 'x'` puts `a` in the on-fly chain's overwritten set, while an
-- earlier `UPDATE b = isNotNull(materialize(a))` step still reads `a` as a function
-- input. When the query reads `a` too (so the `UPDATE a` is not dropped), `a` must
-- still be converted to the post-`MODIFY` `LowCardinality(Nullable(String))` type the
-- `materialize(a)` action expects. Without the fix `materialize` aborts with
-- `LOGICAL_ERROR: Unexpected return type from materialize`.

DROP TABLE IF EXISTS t_read_overwritten_lc SYNC;

SELECT sum(b), any(`info.name`)
FROM t_dotted_physical
SETTINGS apply_mutations_on_fly = 1, optimize_functions_to_subcolumns = 0;

SELECT v, b
FROM t_keep_old_nonconst_cond
ORDER BY id
LIMIT 8
SETTINGS apply_mutations_on_fly = 1;

SELECT ProfileEvents['QueryConditionCacheHits'] = 0
FROM system.query_log
WHERE current_database = currentDatabase() AND log_comment = '04338_afterdrop' AND type = 'QueryFinish'
ORDER BY event_time_microseconds DESC LIMIT 1;

SELECT '-- an arm-local setting on a non-last arm plus SETTINGS on the last arm is ambiguous and rejected';

DROP TABLE IF EXISTS t_create_as_select;

SELECT id FROM t_countmin_num WHERE id <= 10 AND value IN (SELECT '5') ORDER BY id;

SELECT count() FROM t_codec_change WHERE hasToken(s, 'foo');

-- Correctness: the suppressed queries still return the right rows via the fallback path.
-- 04338_dist holds {1, 2, 3}; 04338_filter holds {1, 2}.
SELECT id FROM 04338_view WHERE id IN (SELECT id FROM 04338_filter) ORDER BY id;

CREATE TABLE t_null_carrying_mem (tup Nullable(Tuple(a Dynamic, v Variant(UInt64), s LowCardinality(Nullable(String))))) ENGINE = Memory;

SELECT count() > 0, uniqExact(_part) FROM t_105356_lc;

DROP TABLE t_agg_in_order_limit_filter;

SELECT formatQueryFromJSON(parseQueryToJSON('SELECT any(x) IGNORE NULLS FROM t'));

SELECT tokens('仰面', 'chinese');

-- `hasToken` on a chinese-indexed column uses splitByNonAlpha at the row level, so it
-- never matches a Jieba sub-token inside a CJK run; it must agree with and without the index.
SELECT '-- hasToken on chinese text index agrees with row-level evaluation';

-- Longer sequence crossing zero: -2, -1, 0, 1, 2. Expected: 4 deltas of +1 = 4
SELECT deltaSumTimestamp(toInt32(value), toUInt32(ts))
FROM (SELECT number::Int32 - 2 AS value, number::UInt32 AS ts FROM numbers(5));

SELECT c0 FROM t_107503_part WHERE (c0 GLOBAL IN (SELECT c2 FROM t_107503_set)) != 0 ORDER BY c0;

DROP TABLE t_vrow_filtered;

-- Under `query_plan_optimize_join_order_randomize` (a test-only fuzzing setting) the join-order
-- optimizer draws fresh random table statistics on every plan build. The single-replica plan and
-- the parallel-replicas candidate plan are built independently, so they can draw different random
-- statistics and pick different join orders; the plan-hash match in
-- `considerEnablingParallelReplicas` then fails ("Cannot find step with matching hash in
-- single-node plan"), no reading step gets instrumented, and `input_bytes` stays 0. Pin it off.
SET query_plan_optimize_join_order_randomize=0;

-- Row policies are deferred after FINAL by default (`apply_row_policy_after_final`);
-- the clone must keep that deferral too.
SELECT '-- deferred row policy survives the Cascades clone';

SELECT id FROM tab WHERE hasAllTokens(doc, ['网易']) ORDER BY id;

-- Sanity: a UInt range that stays below the wrap point must still prune (monotonic inference preserved).
CREATE TABLE t_intdiv_mono (a UInt64) ENGINE = MergeTree ORDER BY a SETTINGS index_granularity = 1;

INSERT INTO t_intdiv_mono VALUES (2147483646), (2147483647), (2147483648), (2147483649), (4294967296);

-- Reversed key: the direction claim and `KeyOrder` both feed `Range::invert`, so cover `DESC` as well.
CREATE TABLE t_intdiv_mono (a Decimal(5, 4)) ENGINE = MergeTree ORDER BY a DESC SETTINGS index_granularity = 2;

CREATE ROW POLICY rp_04340 ON t_04340 FOR SELECT
USING arrayExists(x -> (1 = 1), ['y']) OR arrayExists(x -> has([], b), ['y'])
TO ALL;

INSERT INTO aj_small SELECT number * 2 FROM numbers(6.25e4);

SELECT 1 NOT IN (1, 2);

OPTIMIZE TABLE t_dyn_mut FINAL;

CREATE TABLE t_stats_b (id UInt64 STATISTICS(uniq), y UInt64) ENGINE = MergeTree ORDER BY tuple();

INSERT INTO t_json_codec SELECT '{"a":' || toString(number) || ',"b":' || toString(number * 2) || '}'
FROM numbers(100000);

-- ON: a long connection was opened and reused (a held connection serves more than one window), the
-- held path served real bytes, and over-read is expected -- gap-bridging reads past the requested
-- window, so source bytes are at least the requested bytes (the inverse of 04327's strict equality).
SELECT
    ProfileEvents['ReaderExecutorLongConnectionOpened'] > 0,
    ProfileEvents['ReaderExecutorLongConnectionHits'] > 0,
    ProfileEvents['ReaderExecutorLongConnectionBytes'] > 0,
    ProfileEvents['ReaderExecutorBytesFromSource'] >= ProfileEvents['ReaderExecutorDeliveredBytes']
FROM system.query_log
WHERE log_comment = '04341_long_conn_on' AND type = 'QueryFinish' AND current_database = currentDatabase()
ORDER BY event_time_microseconds DESC LIMIT 1;

SELECT formatQueryFromJSON(parseQueryToJSON('CREATE DICTIONARY d (`k` UInt64, `v` String) PRIMARY KEY k SOURCE(CLICKHOUSE(TABLE \'t\')) LAYOUT(FLAT()) LIFETIME(0)'));

INSERT INTO oj_s SELECT number, number FROM numbers(100000);

-- The unchanged `dummy` column must still be present and consistent.
SELECT count(), countIf(dummy = 'value_' || toString(id)) FROM t_dyn_dummy;

-- The other MOVE destinations must keep formatting correctly.
SELECT formatQuery('ALTER TABLE x MOVE PART \'p\' TO DISK \'d1\'');

SELECT positionCaseInsensitiveUTF8(repeat('a', 80) || ' xyz', ' xyz');

-- Verifies a distributed Cascades plan keeps a hash distribution across a VIEW boundary: the
-- view aggregates and is joined on its grouping key, so the join is a distributed Shuffle join
-- and the view's scan runs in parallel, not funnelled onto a single node.

DROP TABLE IF EXISTS facts;

SELECT startsWithCaseInsensitiveUTF8('', '');

SELECT formatQueryFromJSON(parseQueryToJSON('ALTER TABLE t (UPDATE x = 1 WHERE 1)'));

-- Keep this table on the local disk: on a write-through filesystem cache, debug and sanitizer builds run
-- randomized full-cache consistency checks that can block a part write past max_execution_time.
CREATE TABLE t_04344 (a UInt64, b String, c Array(UInt64)) ENGINE = MergeTree ORDER BY a
SETTINGS storage_policy = 'default';

SELECT formatQueryFromJSON(parseQueryToJSON('SYSTEM SYNC REPLICA db.t'));

SELECT '-- CREATE ... AS SELECT without construction settings still works (all 10 rows)';

-- Distributed regression: the AFTER/UNTIL boundary predicate references a column (y) that is not in
-- the SELECT list. When a shard produces a mergeable aggregation-state stage (e.g. forced here via
-- distributed_group_by_no_merge = 2 or distributed_push_down_limit), the shard must still carry the
-- boundary column in its output so the initiator can evaluate LimitRangeStep over it. Otherwise the
-- shard prunes y in its Projection and the initiator fails with NOT_FOUND_COLUMN_IN_BLOCK.
-- Single localhost shard is enough to exercise the shard/initiator split.



SELECT x FROM remote('127.0.0.1', view(SELECT number AS x, number * 2 AS y FROM numbers(10))) ORDER BY x LIMIT 3 AFTER y >= 10 SETTINGS distributed_group_by_no_merge = 2;

SET order = '';

SELECT countIf(explain LIKE '%Parts: 1/2%') FROM (EXPLAIN indexes = 1 SELECT count() FROM t_106533_stats_basic WHERE val IN (150.) SETTINGS use_skip_indexes = 0);

SELECT formatQueryFromJSON(parseQueryToJSON('SELECT a FROM t LIMIT 1 BY ALL'));

-- UNTIL with REPLACE: a*10 until a*10 >= 30 => stop before 30, open from start.
SELECT * REPLACE(a * 10 AS a) FROM (SELECT number AS a FROM numbers(10)) ORDER BY a LIMIT UNTIL a >= 30;

SELECT 'Index analysis with a consumed escape character also narrows to 8 of 24 granules';

SELECT count() > 0 FROM (
    EXPLAIN actions = 1 SELECT id FROM tab WHERE hasAnyTokens(doc, ['hello'], 'splitByNonAlpha')
    SETTINGS query_plan_direct_read_from_text_index = 1
) WHERE explain ILIKE '%__text_index_idx_hasAnyTokens%';

SELECT 'hasAnyTokens', 0, three, two FROM (
    SELECT (SELECT groupArray(id) FROM (SELECT id FROM tab WHERE hasAnyTokens(doc, ['the'], 'splitByNonAlpha') ORDER BY id)) AS three,
           (SELECT groupArray(id) FROM (SELECT id FROM tab WHERE hasAnyTokens(doc, ['the']) ORDER BY id)) AS two
) WHERE three != two SETTINGS use_skip_indexes = 0;

CREATE TABLE tab
(
    id UInt32,
    doc String,
    INDEX idx doc TYPE text(tokenizer = splitByString([' ', 'x']), postprocessor = lower(doc))
)
ENGINE = MergeTree
ORDER BY id
SETTINGS index_granularity = 1;

SELECT 'table settings feed the index layout';

SELECT l.number
FROM numbers(2) AS l SEMI JOIN numbers(3) AS r ON 1
ORDER BY l.number
SETTINGS join_algorithm = 'hash';

SELECT toYear(d), toMonth(d), toDayOfMonth(d), toHour(d)
FROM (SELECT toDateTime64('2500-06-15 23:45:01', 0, 'UTC') AS d);

INSERT INTO t_final_layers_col SELECT number, number, 1 FROM numbers(100000);

-- numbers(): wrapped predicate prunes identically to the bare one.
SELECT count() FROM numbers(1000000) WHERE number < 100;

SELECT x FROM (SELECT number AS x, number + 10 AS y FROM numbers(5) ORDER BY x) LIMIT UNTIL y >= 3 + 10;

CREATE TABLE t_pk_minmax_dropped (event_time UInt32, id UInt32)
ENGINE = MergeTree PARTITION BY intDiv(event_time, 1000) ORDER BY (id, event_time)
SETTINGS index_granularity = 1, add_minmax_index_for_numeric_columns = 0, primary_key_ratio_of_unique_prefix_values_to_skip_suffix_columns = 0.01;

CREATE TABLE t_pk_minmax_nullable (p Nullable(Int32), id UInt32)
ENGINE = MergeTree PARTITION BY p ORDER BY (id, p)
SETTINGS index_granularity = 1, add_minmax_index_for_numeric_columns = 0, allow_nullable_key = 1, primary_key_ratio_of_unique_prefix_values_to_skip_suffix_columns = 0.01;

SELECT count() FROM t_pk_minmax_paths_loaded WHERE (id = 0 AND event_time = 10) OR (id = 5 AND event_time > 1000) SETTINGS use_lightweight_primary_key_index_analysis = 0, use_partition_minmax_for_primary_key_pruning = 1;

INSERT INTO t_agg_proj2 VALUES (0, 10), (0, 20);

DROP TABLE IF EXISTS t_local_04357_wg;

DROP TABLE t_left_04357;

-- GROUP BY on duplicate ALIAS columns.
SELECT a1, a2 FROM dist_same_expr GROUP BY a1, a2 ORDER BY a1;

-- DISTINCT over duplicate ALIAS columns.
SELECT DISTINCT a1, a2 FROM dist_same_expr ORDER BY a1;

SELECT dt, alias_base_0, alias_base_1 FROM remote('127.0.0.2', currentDatabase(), ph_dist) ORDER BY dt LIMIT 1
SETTINGS enable_parallel_replicas = 1, max_parallel_replicas = 1, cluster_for_parallel_replicas = 'test_cluster_one_shard_three_replicas_localhost', parallel_replicas_for_non_replicated_merge_tree = 1;

DROP TABLE dist_adv;

-- use a join algorithm that collects statistics.

SET enable_join_runtime_filters = 1;

DROP TABLE t_json_nested_pool;

-- Aliases are rendered as a reference to the canonical entity.
SELECT count() > 0 FROM system.documentation WHERE description LIKE 'Alias of %';

DROP TABLE 04357_local;

DROP TABLE t_vc;

SELECT 'PREWHERE distributed', count(), sum(v) FROM t_mod FINAL PREWHERE k % 3 = 0 SETTINGS make_distributed_plan = 1, distributed_plan_fallback_to_local_execution = 0;

DROP TABLE t_ni_rep;

CREATE TABLE t_arrayjoin_bf
(
    id UInt64,
    tags Array(String),
    INDEX idx_tags tags TYPE bloom_filter GRANULARITY 1
)
-- Pin granule layout (query-level SETTINGS override CI-randomized merge tree settings) so the
-- Granules: X/Y counts below are deterministic: 100000 rows / 8192 = 13 granules.
ENGINE = MergeTree ORDER BY id SETTINGS index_granularity = 8192, index_granularity_bytes = 0, min_bytes_for_wide_part = 0;

SELECT count() FROM t_arrayjoin_bf_default WHERE arrayJoin(tags) = 'x_1' SETTINGS use_skip_indexes = 0;

CREATE TABLE t_arrayjoin_bf_domain_num
(
    id UInt64,
    u Array(UInt8),
    f Array(Float64),
    INDEX idx_u u TYPE bloom_filter(0.0001) GRANULARITY 1,
    INDEX idx_f f TYPE bloom_filter(0.0001) GRANULARITY 1
)
ENGINE = MergeTree ORDER BY id SETTINGS index_granularity = 1, index_granularity_bytes = 0, min_bytes_for_wide_part = 0;

SELECT count() FROM t_arrayjoin_bf_domain_enum WHERE arrayJoin(e) = 'missing' SETTINGS use_skip_indexes = 0, validate_enum_literals_in_operators = 0;

CREATE TABLE test_split_oob4
(
    id UInt64, url String, region String,
    extra1 String DEFAULT 'e1', extra2 String DEFAULT 'e2',
    PROJECTION region_proj (SELECT _part_offset, extra1, extra2 ORDER BY region, url)
)
ENGINE = MergeTree ORDER BY (id)
SETTINGS index_granularity = 1, min_bytes_for_wide_part = 0;

DROP TABLE IF EXISTS mv_04365;

SELECT 'text hasToken LowCardinality';

-- Bloom-filter sibling (MergeTreeIndexBloomFilterText.cpp) of the map-key path: a
-- `mapKeys(...)` tokenbf_v1/ngrambf_v1 index. A LowCardinality(Nullable(String)) key used to fail the
-- raw string-type gate and degrade to a full scan. Each variant must prune to the SAME single granule
-- as the plain-String key.
DROP TABLE IF EXISTS t_map_tokenbf;

SELECT count(), min(id) FROM t_fixed_text WHERE s = toLowCardinality(toFixedString('rareword', 12));

SELECT (has_filter AND fl < ll) AS filter_above_limitby
FROM (
    SELECT countIf(explain LIKE '%Filter (%') > 0 AS has_filter,
           minIf(ln, explain LIKE '%Filter (%') AS fl,
           minIf(ln, explain LIKE '%LimitBy%')  AS ll
    FROM (
        SELECT explain, rowNumberInAllBlocks() AS ln
        FROM (
            EXPLAIN
            SELECT l.key FROM (
                SELECT key, ts FROM t_04366 ORDER BY key, ts LIMIT 1 BY key
            ) AS l INNER JOIN t_04366_rhs AS r ON l.key = r.key
            WHERE l.key = '5'
            SETTINGS query_plan_filter_push_down = 0, query_plan_filter_push_down_below_limit_by = 0,
                     enable_join_runtime_filters = 1, enable_parallel_replicas = 0,
                     query_plan_optimize_join_order_randomize = 0
        )
    )
);

CREATE TABLE t_dst (x UInt64) ENGINE = MergeTree ORDER BY x;

CREATE TABLE base107946_4 (key Int, value Int) ENGINE = MergeTree ORDER BY key;

INSERT INTO 04367_dist VALUES (1), (2);

SELECT argMinArray([1, 2, 3], [3, 2, 1]);

DROP TABLE legacy_ils;

SELECT name FROM users_rls_proj ORDER BY name;

DROP ROW POLICY rp_pid_rls_proj ON pid_rls_proj;

CREATE TABLE limit_rls_proj (id UInt64) ENGINE = MergeTree ORDER BY id;

SELECT '-- row policy and additional_table_filters both apply (expect 1, 4)';

CREATE TABLE materialized_dep_rls_proj (x UInt64, m UInt64 MATERIALIZED x + 1) ENGINE = MergeTree ORDER BY x;

ALTER TABLE shadow_rls_proj ADD PROJECTION p (SELECT a, (a = 1) AS c ORDER BY a);

DROP ROW POLICY IF EXISTS rp_pparent_rls_proj ON pparent_rls_proj;

ALTER TABLE onfly_rls_proj MATERIALIZE PROJECTION p SETTINGS mutations_sync = 2;

DROP VIEW IF EXISTS t04369_view;

SELECT toTypeName(id), id FROM 04370_view ORDER BY id;

SELECT projections = [currentDatabase() || '.t_04371.p'], ProfileEvents['ParallelReplicasQueryCount'] > 0
FROM system.query_log
WHERE log_comment = '04371_local_projection' AND type = 'QueryFinish'
  AND current_database = currentDatabase() AND is_initial_query
  AND event_date >= yesterday() AND event_time >= now() - INTERVAL 30 MINUTE
ORDER BY event_time_microseconds DESC LIMIT 1;

-- ... and the result must be identical with the setting on and off.
SELECT
    (SELECT count() FROM view_gba_04372 SETTINGS optimize_trivial_view_pushdown_to_distributed = 1)
  = (SELECT count() FROM view_gba_04372 SETTINGS optimize_trivial_view_pushdown_to_distributed = 0)
  AS results_match;

-- The view rewrites the sharding-key column `id` to intDiv(id, 2) but keeps the name `id`.
CREATE VIEW view_04374 AS SELECT intDiv(id, 2) AS id, value FROM dist_04374;

CREATE TABLE t_json_lcn
(
    id UInt64,
    data JSON(x LowCardinality(Nullable(String))),
    INDEX x_minmax data.x TYPE minmax GRANULARITY 1
)
ENGINE = MergeTree
ORDER BY id
SETTINGS index_granularity = 64;

SELECT length(largestTriangleThreeBucketsMerge(3)(s)) FROM (SELECT largestTriangleThreeBucketsState(3)(number::Float64, number::Float64) AS s FROM numbers(100));

INSERT INTO t_alias VALUES ('5');

SELECT `c0.inner.x`, `c0.inner.y`, `c0.z` FROM file(currentDatabase() || '_04401_nested.orc', 'ORC', '`c0.inner.x` UInt32, `c0.inner.y` String, `c0.z` UInt64') ORDER BY `c0.inner.x`;

SELECT `c0.x`, `c0.y` FROM file(currentDatabase() || '_04401_coll.arrow', 'Arrow', '`c0.x` Array(UInt32), `c0.y` Array(String)');

SELECT id, tupleElement(materialize(n), 'a'), tupleElement(materialize(n), 'arr'), tupleElement(materialize(n), 'm') FROM file(currentDatabase() || '_04401_hidden.arrow', 'Arrow', 'id UInt8, n Nullable(Tuple(a Tuple(x UInt32), arr Array(UInt32), m Map(String, String)))') ORDER BY id;

-- The expanded names come from the REPLACE target, not the untupled source expression.
SELECT * REPLACE (untuple(b) AS a) FROM (SELECT 10 AS a, (1, 2) AS b) FORMAT TSVWithNames;

SELECT * APPLY (x -> x, 'p_'), * APPLY (x -> x, 'q_') FROM (SELECT 1 AS a) FORMAT TSVWithNames;

SELECT count() FROM t_d32_mono WHERE toRelativeMinuteNum(d) >= 15778080 SETTINGS force_primary_key = 1;

INSERT INTO 04401_range_source VALUES
    (4, 5, '2018-11-28 16:10:05.636720', '2019-04-01 00:00:00.451254', 50),
    (4, 5, '2019-04-01 00:00:00.451254', '2019-11-30 23:59:59.000000', 100),
    (4, 4, '2019-11-30 23:59:59.000000', NULL, 250);

SELECT 'Decimal range argument';

SELECT c0 FROM t1 ORDER BY c0 DESC WITH FILL TO -6 STEP -2 SETTINGS optimize_const_name_size = 0;

INSERT INTO t_imv_alter SELECT number, toString(number) FROM numbers(10);

SELECT
    (SELECT uniqExactMerge(s) FROM amt_skew WHERE g = 2) = 300000
    AND (SELECT max(u) FROM (SELECT uniqExactMerge(s) AS u FROM amt_skew WHERE g != 2 GROUP BY g)) = 1
        AS skewed_groups_correct;

CREATE TABLE t0 (a Int64, b Int64) ENGINE = MergeTree() PARTITION BY a ORDER BY a;

-- no-replicated-database: EXPLAIN output differs for replicated database.
-- no-parallel-replicas: EXPLAIN output differs for parallel replicas.
-- no-random-merge-tree-settings: the test asserts exact `Granules: N/M` counts, which depend on the
--   data layout; randomized MergeTree settings (index_granularity, use_const_adaptive_granularity, ...)
--   change the granule boundaries and flip the counts.
-- See `src/Storages/MergeTree/KeyCondition.cpp` (atom_map "isNotDistinctFrom",
-- reverseComparisonOperator, tryRewriteIsTrueCondition, tryRewriteInTruthyCondition).

SET use_query_condition_cache = 0;

SELECT '--- (k < c) IS TRUE prunes an ordered condition ---';

SELECT count() > 0 FROM (EXPLAIN indexes = 1 SELECT * FROM part WHERE b IN (true)) WHERE explain ILIKE '%Parts: 1/2%';

-- A NULL-preserving conversion (`toUInt32(Nullable(UInt32))` stays Nullable) is still a wrapper, so it
-- also declines and does NOT prune (the count is unchanged: a full scan returns the same NULL rows).
SELECT '--- toUInt32(k) IS NOT DISTINCT FROM NULL does NOT prune to the NULL granule (0/) ---';

SELECT '--- isNull(intDiv(k, 2)) (also wrapped) does NOT prune ---';

SELECT 'ndf_nullable', count() FROM pk_null WHERE k IS NOT DISTINCT FROM 42;

-- ifNull / coalesce composed wrapper forms match the bare wrapped atom.
SELECT 'ifnull_bare', count() FROM pk WHERE ifNull(k = 42, 0);

-- Regression test for https://github.com/ClickHouse/ClickHouse/issues/108776
-- Partition pruning was silently disabled when a LowCardinality(FixedString) key column
-- was wrapped in a function in the partition key (e.g. PARTITION BY sipHash64(k) % N) and the
-- WHERE compared it against a String literal. Transforming the String constant into key space
-- failed because the LowCardinality wrapper is not nullable-able, so the accuracy probe in
-- applyDeterministicDagToColumn rejected the String -> LowCardinality(FixedString) cast and the
-- partition condition degraded to "true" (scan all partitions). The test asserts the
-- optimization is PRESERVED: a real partition condition is built and prunes, and that it is
-- still abandoned for a literal that does not fit the key column. Correct-result checks alone
-- cannot catch this regression.

SET allow_suspicious_low_cardinality_types = 1;

INSERT INTO lcv VALUES (-0.0);

-- Full part rewrite: DROP COLUMN of a MATERIALIZED column takes `MutateAllPartColumnsTask`.
-- The skip indices are not recalculated, so they are hardlinked from the source part.
ALTER TABLE t_skip_idx_checksums DROP COLUMN m SETTINGS mutations_sync = 2;

-- Explicit = TRUE, partition pruning enabled (default).
SELECT (SELECT count() FROM t_04401 WHERE c0 = TRUE)
     = (SELECT countIf(c0 = TRUE) FROM t_04401);

SELECT DISTINCT toTypeName(max(s)) FROM t_lc_group_key GROUP BY s;

SELECT count() FROM numbers(10) WHERE number IN (SELECT number FROM numbers(3));

SELECT countIf(explain ILIKE '%function_type: aggregate%')
FROM (EXPLAIN QUERY TREE SELECT anyHeavy(s) FROM t_lc_more_aggs GROUP BY s);

INSERT INTO t_lc_having_type VALUES ('x', 'x', 1), ('y', NULL, 2);

SELECT '-- correlated scalar subquery as the whole filter root must not underflow the filter depth';

SELECT '-- IN over an eliminated LowCardinality key in HAVING';

CREATE VIEW v_pr_view AS SELECT a FROM mt_pr_view;

DROP VIEW v_91641;

SELECT count() FROM 04401_rocksdb_empty;

-- text index on p.s, SELECT * : all four access forms must prune to a single granule.
SELECT count() > 0 FROM (EXPLAIN indexes = 1 SELECT * FROM t_tuple_subcol_index WHERE p.s = '10') WHERE explain ILIKE '%Granules: 1/16%';

-- trimRight / trimBoth / custom-character trims.
SELECT trimRight('hello   '), trimBoth('  hi  '), trim(LEADING '0' FROM '000123'), trim(LEADING 'ab' FROM 'abcabc');

SET param__internal_cascades_task_limit = 1;

-- Regression: the non-throwing UInt64 path cast to a signed time_t before clamping, so 18446744073709551615 became -1
-- and produced a pre-epoch DateTime64. It must compare in the unsigned domain and saturate to the per-scale maximum.
SELECT toYear(toDateTime64(18446744073709551615, 9, 'UTC')) = 2262,
       toYear(toDateTime64(18446744073709551615, 0, 'UTC')) = 9999;

CREATE TABLE float_parsing_cases (x String) ENGINE = Memory;

DROP TABLE IF EXISTS ip_trie_src;

SELECT '-- mapConcat preserves LowCardinality when all inputs agree, otherwise falls back';

SELECT mapFilter((k, v) -> 1, map('a'::LowCardinality(String), tuple(map('x'::LowCardinality(String), 'y'))));

SELECT positiveModuloOrNull(toFloat64(2.2250738585072014e-308), toFloat64(-1)) IS NULL;

-- extractAll: last letter of each word (already worked, kept as a regression guard)
SELECT extractAll('new york is the greatest', '(\\w)\\b');

-- Regression for the analyzer CNF: `similarTo`/`notSimilarTo` must be present in the analyzer's
-- `pushNotIntoFunction`/`pullNotOutFunctions` inverse maps (src/Analyzer/Passes/CNF.cpp), mirroring
-- the legacy `TreeCNFConverter`. Otherwise, `NOT (s SIMILAR TO p)` is
-- not normalized to `notSimilarTo(s, p)`, so constraint-based optimization diverges from the
-- explicit `s NOT SIMILAR TO p` form (which the parser already produces as `notSimilarTo`).

SET convert_query_to_cnf = 1;

-- Filtering only on the truncated suffix `b`: the only referenced key column is not loaded in the
-- sparse prefix, so no usable key column remains and no granule is pruned
-- (Granules: 100/100). This covers the empty-sparse fallback and that the lightweight path (=1)
-- matches the legacy path (=0); the `!is_key_col_present` branch itself is exercised by the
-- prefix-constrained cases below.
EXPLAIN indexes = 1
SELECT count() FROM t_sparse_pk_trunc_isnull
WHERE b IS NULL
SETTINGS use_lightweight_primary_key_index_analysis = 0, enable_parallel_replicas = 0;

CREATE TABLE t_join_all (k UInt32, a UInt64, b String) ENGINE = Join(ALL, INNER, k);

-- no-random-merge-tree-settings: reads mergeTreeCodecBlockCounts, randomized block-number/offset columns add rows.

-- Adaptive codec selection must not override an explicit RECOMPRESS CODEC(X). RECOMPRESS CODEC(Default) stays adaptive.

DROP TABLE IF EXISTS t_h;

CREATE DICTIONARY nb_bad (ngram String, class_id UInt32 DEFAULT 0, count String DEFAULT '')
PRIMARY KEY ngram SOURCE(CLICKHOUSE(TABLE 'nb_bad_src')) LAYOUT(NAIVE_BAYES(class_attribute 'class_id' n 1 mode 'token')) LIFETIME(0);

CREATE TABLE nb_empty_src (class_id UInt32, ngram String, count UInt64) ENGINE = MergeTree ORDER BY (class_id, ngram);

CREATE DICTIONARY nb_byte_ok (ngram String, class_id UInt32 DEFAULT 0, count UInt64 DEFAULT 0)
PRIMARY KEY ngram SOURCE(CLICKHOUSE(TABLE 'nb_utf8_src')) LAYOUT(NAIVE_BAYES(class_attribute 'class_id' n 2 mode 'byte')) LIFETIME(0);

-- `DateTime` columns can carry an explicit timezone that differs from the server timezone. The
-- obfuscator preserves the date component, which is the date as *displayed* in the column's
-- timezone, so `DateTimeModel` must use the column's timezone (via `DataTypeDateTime::getTimeZone`)
-- rather than the server timezone. Otherwise values near local midnight move to a neighbouring date.
--
-- All inputs below are on the Tokyo date 2024-01-01 (00:00:00 .. 00:16:39 'Asia/Tokyo'), which maps
-- to the UTC date 2023-12-31. With the server timezone (UTC) the preserved date would be 2023-12-31
-- and many obfuscated values would display on a neighbouring Tokyo date; with the column timezone
-- every obfuscated value keeps the Tokyo date 2024-01-01.
--
-- `obfuscate(...)` is an effectively infinite, repeating source, so the inner subquery needs an
-- explicit `LIMIT` (pushed inside, next to the obfuscate settings); otherwise the outer
-- `SELECT DISTINCT` keeps reading the repeating stream until it hits `max_rows_to_read`. One full
-- pass over the 1000 input rows is enough to observe every preserved date.

SELECT DISTINCT toDate(x, 'Asia/Tokyo')
FROM (
    SELECT * FROM obfuscate(
        SELECT toDateTime('2024-01-01 00:00:00', 'Asia/Tokyo') + toIntervalSecond(number) AS x
        FROM numbers(1000)) LIMIT 1000
    SETTINGS obfuscate_seed = 'obfuscate_datetime_timezone');

DROP TABLE t_qbit_subcol_index;

-- accurateCastOrDefault goes through the same accurateOrNull path internally.
SELECT accurateCastOrDefault(CAST(tuple(1), 'Tuple(Dynamic)'), 'Tuple(Float32)') AS r, toTypeName(r);

INSERT INTO qbits_8 VALUES (2, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -32]);

DROP TABLE array_8;

-- Every element position, both nullable and not.
SELECT 'nullable combos';

SELECT * FROM format(CSV, 'x Array(Int32)', $$\N$$);

-- This test bounds the resident memory of a NAIVE_BAYES dictionary to a small number of bytes per
-- n-gram, so that a change which makes the dictionary store much more per n-gram than it needs to
-- will fail here. The current representation keeps each n-gram in well under 256 bytes.
--
-- A dictionary load does not run under the triggering query's max_memory_usage tracker, so this
-- test checks the resident bytes_allocated reported by system.dictionaries rather than the peak
-- memory used while the dictionary is being built.

DROP DICTIONARY IF EXISTS nb_mem;

WITH [0, 1, 2, 3, 4, 5, 6, 7] AS reference_vec
SELECT id, round(cosineDistanceTransposed(vec, reference_vec, 8), 2) AS dist FROM qbit ORDER BY id;

DROP TABLE IF EXISTS qbit_length_test;

-- Classifying 'good' lazily loads the dictionary. It is trained only for class 0, so it returns 0.
SELECT 'classify before update';

-- naiveBayesClassifier and dictGet are equivalent, including for empty input: an empty string is
-- classified (from the priors, as it forms no n-grams) rather than rejected. This pins that equivalence for
-- an n-1 and an n-2 model, that a batch containing an empty row classifies every row, and that the
-- probability entry points also accept empty input.

DROP DICTIONARY IF EXISTS nb_empty_uni;

-- Values beyond the codebook saturate to the extreme codes.
SELECT quantizeBFloat16ToInt8(toBFloat16(100.0)), quantizeBFloat16ToInt8(toBFloat16(-100.0));

SELECT '-- A nullable element type keeps NULL out of bounds in both modes';

SELECT [[1, 2], [3, 4], [5, 6]][[2, 1, 9]];

SELECT arr[[1]] FROM test_arr_idx ORDER BY ALL;

SELECT arrayElementOrNull([10, 20, 30], [5, NULL, -9]);

SELECT toTypeName(x) = toTypeName(y) AND toString(x) = toString(y) FROM (SELECT arrayElementOrNull([1, NULL, 3], [2, 5]) AS x, arrayMap(i -> arrayElementOrNull([1, NULL, 3], i), [2, 5]) AS y);

DROP TABLE IF EXISTS dep SYNC;

-- toRelativeHourNum / toRelativeMinuteNum standard precision. A fractional-offset time zone
-- forces the slow code path even for a positive argument. The standard-precision result is
-- UInt32 and now saturates for out-of-range arguments (kept monotonic for primary-key pruning).
SELECT toRelativeHourNum(reinterpret(9223372036854775807, 'DateTime64(0)'), 'Asia/Kolkata');

DROP TABLE dec_or_in;

-- The bare virtual column is the PREWHERE filter column itself.
SELECT EventId FROM repro PREWHERE _part_offset ORDER BY Id DESC LIMIT 10;

INSERT INTO merged_json_patch_states
SELECT
    1 AS id,
    mergedJSONPatchState(patch, version) AS state
FROM
(
    SELECT '{"a":{"x":1}}'::JSON AS patch, 1 AS version
    UNION ALL
    SELECT '{"a":{"y":2}}'::JSON, 2
);

-- Typed Date path must also round-trip correctly (JSON(d Date)).
SELECT toJSONString(mergedJSONPatch(patch, version))
FROM (
    SELECT CAST('{"d":"2020-01-01"}', 'JSON(d Date)') AS patch, 1 AS version
    UNION ALL
    SELECT CAST('{"d":"2021-06-15"}', 'JSON(d Date)'), 2
);

SELECT toJSONString(mergedJSONPatch(CAST(patch, 'JSON'), t_right_comp.ver_str))
FROM t_left_comp LEFT JOIN t_right_comp ON t_left_comp.id = t_right_comp.id;

DROP DICTIONARY nb_ct8;

-- The Kronecker transform is orthogonal (norm-preserving): ||y||^2 / ||x||^2 == 1.
SELECT round(abs(arraySum(x -> x * x, randomHadamardTransform(CAST(range(12), 'Array(Float32)'), 5)) / arraySum(x -> x * x, CAST(range(12), 'Array(Float32)')) - 1), 4),
       round(abs(arraySum(x -> x * x, randomHadamardTransform(CAST(range(20), 'Array(Float32)'), 5)) / arraySum(x -> x * x, CAST(range(20), 'Array(Float32)')) - 1), 4),
       round(abs(arraySum(x -> x * x, randomHadamardTransform(CAST(range(768), 'Array(Float32)'), 7)) / arraySum(x -> x * x, CAST(range(768), 'Array(Float32)')) - 1), 4);

SELECT count() FROM tab_v1_with_codec WHERE hasToken(str, 'foo');

SELECT count() FROM tab_codec_arg WHERE hasToken(str, 'foo');

DROP TABLE tab_v1_with_codec;

SELECT count()
FROM (SELECT d FROM remote('127.0.0.{1,2}', currentDatabase(), t_04409_dec))
WHERE d = toDecimal64('123456789012.34567', 5);

EXPLAIN actions = 1
SELECT encrypt('aes-128-ecb', toString(number), 'MY_SUPER_SECRET_KEY_123')
FROM numbers(3);

-- Test compact parts with advanced_chunked serialization.
-- 12 rows with target_chunk_rows=4 produces 3 chunks.
drop table if exists test_compact_chunked;

select 'compact chunked merge: select json, json.^a, json.a.a1, json.a.arr[].arr1, json.b, json.arr';

insert into test_wide_chunked_merge select * from source;

select id, data.a from test_array_json_compact_chunked order by id;

SELECT 'S6: bucket_indexes stream present';

-- The largest class id that fits (UInt32 max) loads and is returned unchanged.
DROP TABLE IF EXISTS nb_cid_src;

-- Each system table that has a captured documentation source points to a repository source file. Empty remains valid
-- for dynamically attached tables whose documentation owner is unknown; the representative rows below test each owner.
SELECT count() FROM system.documentation WHERE type = 'System Table' AND source != '' AND source NOT LIKE 'src/%';

DROP TABLE IF EXISTS recent_table;

-- Insert new data with escaping disabled.
insert into test_fallback select tuple(7, 8)::Tuple(a UInt32, b UInt32);

-- Exactly representable BFloat16 values give exact results.
SELECT max2(toBFloat16(3), toBFloat16(5));

-- id=1: 10 < 15 -> match; id=2: 20 < 10 -> no match; id=3: 30 < 35 -> match; id=4: 40 < 38 -> no match
INSERT INTO t_rf_mixed_left VALUES (1, 10), (2, 20), (3, 30), (4, 40);

-- Section 3: DISTINCT on Map column
DROP TABLE IF EXISTS t;

-- q1: miss (cold cache)
SELECT count() FROM paimon_sys_drop_t1
SETTINGS log_comment = '04410-q1-miss'
FORMAT Null;

CREATE TABLE prop_orders   (orderkey UInt64, custkey UInt64, payload String) ENGINE = MergeTree ORDER BY orderkey;

-- Both inputs filtered: each direction sees the other side as it was before the first copy
SELECT 'both sides propagate',
       countIf(explain LIKE '%ilter column:%orderkey = 555%'),
       countIf(explain LIKE '%ilter column:%custkey = 7%')
FROM (
    EXPLAIN PLAN actions=1
    SELECT count()
    FROM (SELECT * FROM prop_two_key WHERE orderkey = 555) AS a
    INNER JOIN (SELECT * FROM prop_two_key WHERE custkey = 7) AS b
        ON a.orderkey = b.orderkey AND a.custkey = b.custkey
);

-- Re-home before any read: rows get fresh block numbers, offsets become part offsets.
ALTER TABLE t DETACH PARTITION tuple();

-- ------------------------------------------------------------------------------------------------
-- correlated_subqueries_use_in_memory_buffer = 1 (default): the common subplan is buffered directly.
-- ------------------------------------------------------------------------------------------------

-- INTERSECT with a correlated subquery in each branch, default_join_kind = 'left'. Both branches keep
-- the rows where 2 * i = 8, i.e. i = 4 (once per part). Before the fix this aborted the server.
SELECT i FROM t_chunk_buffer_set_op WHERE 8 = ((SELECT _part_offset) + i)
  SETTINGS correlated_subqueries_substitute_equivalent_expressions = 0,
           correlated_subqueries_default_join_kind = 'left'
INTERSECT
SELECT i FROM t_chunk_buffer_set_op WHERE 8 <=> (i + (SELECT _part_offset))
ORDER BY i;

SELECT 'all_inner_true';

SELECT 'any_right_true';

SELECT l, r
FROM values('l UInt8', 1, 2) AS l_tbl
LEFT ANTI JOIN values('r UInt8', 10, 20) AS r_tbl ON 0
ORDER BY l, r;

-- partition key is a function of the DISTINCT key
DROP TABLE IF EXISTS test_partition_func_of_key;

INSERT INTO test_with_filter_step SELECT number, number FROM numbers_mt(200);

-- NEGATIVE: DISTINCT key excludes one partition column
DROP TABLE IF EXISTS test_key_excludes_partition_col;

DROP TABLE test_single_partition;

-- (no-object-storage: with_buckets writes many small per-bucket files; on S3 under ASan this
--  can time out. The splitter bug is storage-agnostic, so local-only coverage loses nothing.)

-- Regression test for parallel reads of Map primary key with with_buckets serialization.
--
-- When a Map column is the primary key and the part uses with_buckets serialization,
-- the primary key index stores Map values in insertion order, while without the key
-- order preservation fix, data files would store keys reordered by bucket index.
-- The PartsSplitter boundary calculation compares index values against actual data rows;
-- under positional ColumnMap::compareAt, mismatched key order causes
-- FilterSortedStreamByRange to drop rows.
--
-- The MapBucketIndexes fix ensures data files preserve the original key insertion order,
-- so the index and data agree and PartsSplitter works correctly.

-- Section 1: Basic Map primary key with PartsSplitter injection
DROP TABLE IF EXISTS t;

SELECT 'S5: Tuple(Map, UInt32) PK with injection';

INSERT INTO horizontal_batch_04411 SELECT * FROM source_04411 WHERE id % 3 = 2;

DROP TABLE nb_not_nb_src;

CREATE TABLE users_full
(
    user String,
    host String,
    INDEX user_idx user TYPE text(tokenizer = sparseGrams(3)),
    INDEX host_idx host TYPE text(tokenizer = sparseGrams(3))
)
ENGINE = MergeTree ORDER BY tuple();

-- Plain result types over a fixed frame still produce correct values.
SELECT DISTINCT sum(number) OVER () FROM numbers(10000);

SELECT k, s FROM mv_dst FINAL ORDER BY k;

OPTIMIZE TABLE vertical_granularity_batch_04412 FINAL SETTINGS optimize_throw_if_noop = 1;

CREATE DICTIONARY nb_byte_empty_start (ngram String, class_id UInt32 DEFAULT 0, count UInt64 DEFAULT 0)
PRIMARY KEY ngram SOURCE(CLICKHOUSE(TABLE 'nb_pad_byte')) LAYOUT(NAIVE_BAYES(class_attribute 'class_id' n 2 mode 'byte' start_token '' end_token '0xFF')) LIFETIME(0);

DROP TABLE nb_pad_cp;

-- A granule larger than one read batch must validate across batches, not stop after the first.
CREATE TABLE t_validate_multi_batch_granularity (x UInt8)
ENGINE = MergeTree() ORDER BY tuple()
SETTINGS index_granularity_bytes = 0, index_granularity = 2000000, min_rows_for_wide_part = 0, min_bytes_for_wide_part = 0, ratio_of_defaults_for_sparse_serialization = 1;

SELECT changeDay(toDateTime64('2024-01-01 10:20:30.123456789', 9), 31);

SELECT changeDay(toDateTime64('2262-04-01 00:00:00.000000000', 9), 10);

DROP TABLE src_order;

DROP TABLE source_04413;

-- POSITIVE: DISTINCT above LIMIT BY (LIMIT BY skips and preserves disjointness upward to the DISTINCT)
SELECT replaceRegexpOne(explain, '^[ ]*(.*)', '\\1') FROM (EXPLAIN actions = 1 SELECT DISTINCT a FROM (SELECT a FROM t LIMIT 5 BY a) SETTINGS allow_distinct_partitions_independently = 1, allow_limit_by_partitions_independently = 1) WHERE explain LIKE '%Skip stream merging%' OR explain LIKE '%Skip merging: 1%' OR explain LIKE '%Read each partition through separate port%';

DROP TABLE alias_async_nodedup_target SYNC;

DROP TABLE test_single;

SELECT 'skewed partitions, forced:';

SELECT toStartOfInterval(toDateTime64(-9223372036854775807, 0, 'UTC'), INTERVAL 1 HOUR) FORMAT Null;

-- Peer groups by ts: {10: 1,2}, {20: 3}, {30: 4,5,6}
INSERT INTO t_groups VALUES (10, 1) (10, 2) (20, 3) (30, 4) (30, 5) (30, 6);

CREATE TABLE t_part (sym String, ts Int32, x Int32) ENGINE = MergeTree ORDER BY (sym, ts, x);

SELECT k, id, arraySort(groupArray(id) OVER (ORDER BY k GROUPS BETWEEN 1 PRECEDING AND 1 FOLLOWING)) AS frame
FROM (SELECT number AS id, toLowCardinality(['a', 'a', 'b', 'b', 'c', 'c'][number + 1]) AS k FROM numbers(6))
ORDER BY k, id SETTINGS max_block_size = 1;

DROP TABLE IF EXISTS t_groups;

SELECT naiveBayesNgrams('the cat sat', 2, 'token');

-- n = 1024 is accepted (no n-grams here)

-- ---- per-row vectorization: offsets across rows of varying length ----
SELECT s, naiveBayesNgrams(s, 2, 'byte') FROM (SELECT arrayJoin(['', 'a', 'ab', 'abc']) AS s) ORDER BY s;

INSERT INTO folding_force_minmax VALUES (1, 10), (2, 20);

-- C) Nullable leading key column with NULLs (NULL_LAST ordering) combined with a dropped, bounded suffix:
--    the last-mark handling maps NULL to +inf while the suffix uses its constant partition-minmax bound.
DROP TABLE IF EXISTS t_pmm_oracle_nullable;

SELECT toTypeName(naiveBayesClassifierWithProb('nb_nullable_dict', CAST('good' AS Nullable(String))));

-- Regression test for https://github.com/ClickHouse/ClickHouse/issues/71288
-- Before the fix (~24.9), querying a `Memory`-engine `DateTime64(3)` column with
-- value `0` (i.e. epoch 1970-01-01 00:00:00.000) via `remote('127.0.0.{1,2}', ...)`
-- failed with `CANNOT_PARSE_DATETIME: while converting '0' to DateTime64(3)` on
-- the analyzer path. The non-analyzer path returned the correct count.
--
-- The fixture holds one matching epoch-zero row plus one non-matching row, so a
-- silently dropped remote `WHERE r IN (...)` filter would degenerate to an
-- unfiltered count and return `4` instead of `2`. That is, this test fails if the
-- filter path is lost, not only if the query errors out.
-- Both paths must now return `2` (one matching row per shard).
-- `session_timezone='UTC'` is pinned so the `DateTime` literal interpretation is
-- stable under CI's randomized session timezone; the bug being tested is
-- independent of timezone.
-- Probable duplicate of https://github.com/ClickHouse/ClickHouse/issues/66773.

DROP TABLE IF EXISTS test_71288;

SELECT arrayReduce('uniqForEach', [[NULL], [NULL, NULL, NULL]]);

SELECT 'line\nbreak' AS value FORMAT Vertical;

-- one token, not two

-- codepoint mode at query time decodes invalid UTF-8 best-effort rather than rejecting it.
SELECT arrayMap(x -> hex(x), naiveBayesNgrams(unhex('C241'), 1, 'codepoint'));

SELECT naiveBayesClassifier('nb_cp', unhex('C241')) IN (0, 1);

-- An all-OOV input reduces to the prior, exactly like an empty input, under either prior mode.
SELECT naiveBayesClassifier('nb_oov_u', 'zzz yyy xxx') = naiveBayesClassifier('nb_oov_u', '');

DROP DICTIONARY nb_null;

-- FINAL is a per-table modifier: `<t1> FINAL JOIN <t2>` must read only `t1` with FINAL, not `t2`.

DROP TABLE IF EXISTS t1_final_join;

SELECT 'result both',  arraySort(groupArray(lhs_final.s || '/' || rhs_final.s)) FROM lhs_final FINAL JOIN rhs_final FINAL ON rhs_final.id = lhs_final.id;

DROP TEMPORARY TABLE IF EXISTS t_47240_temp_from_join;

SET restore_replace_external_engines_to_null = 0;

INSERT INTO t_status_desync SELECT number FROM numbers(10);

WITH geoToUTM(2.294497, 48.858222, 32) AS t SELECT round(t.1, 3), round(t.2, 3), t.3, t.4;

CREATE TABLE test_infoschema_compat
(
    id UInt32,
    s String,
    m UInt32 MATERIALIZED id * 2,
    a UInt32 ALIAS id + 1
)
ENGINE = MergeTree ORDER BY id;

-- Regression test for the cross-version compatibility guarantee of `SettingFieldMaxThreads`.
--
-- Context: https://github.com/ClickHouse/ClickHouse/pull/108657
--          https://github.com/ClickHouse/ClickHouse/issues/68748
--
-- `system.settings` now renders the automatic value of `max_threads` (and friends) as the clean
-- `auto(N)` form instead of the legacy `'auto(N)'` form that had the single quotes baked into the
-- string value. That rendering change is only safe because `stringToMaxThreads` keeps accepting
-- BOTH forms when parsing: settings travel between servers as their string representation and are
-- re-parsed on the receiving side, so an older replica still sends the quoted `'auto(N)'` over the
-- wire and a new server must understand it.
--
-- This test pins that parsing contract directly. Removing the `startsWith(str, "'auto")` branch in
-- `stringToMaxThreads` would make `SET max_threads = '''auto(8)'''` throw a parse error (the value
-- `'auto(8)'` is not a number), so this test would fail loudly - which is exactly the mixed-version
-- regression we want to guard against.
--
-- We assert on `startsWith(value, 'auto(')` and `position(value, '''') = 0` rather than the exact
-- core count, so the test does not depend on the machine it runs on.

-- 1. The clean `auto(N)` form is accepted and stays auto.
SET max_threads = 'auto(8)';

INSERT INTO t_not_ready_set_errors SELECT sum(value) FROM system.errors WHERE name = 'NOT_IMPLEMENTED';

SELECT 'one_partition_total_active_parts', count()
FROM system.parts
WHERE database = currentDatabase() AND table = 't_optimize_final_one_part' AND active;

SELECT [1, 2, 3, 4, 5, 6, 7, 8, 9]::QBit(Float64, 9)::Array(Float64);

SELECT DISTINCT toTypeName(vec) FROM qbit_stride;

SELECT count() FROM 04489_dt64
WHERE dt = toDateTime64('1970-01-01 00:00:01.20', 2) AND dt != toDateTime64('1970-01-01 00:00:01.20', 2)
SETTINGS optimize_redundant_comparisons = 1;

SELECT '-- same IN result without the analyzer';

INSERT INTO t_values_template_scalar SETTINGS input_format_values_deduce_templates_of_expressions = 1 VALUES (0.1 + 0), (0.2 + 0);

SELECT '-- plan keeps inner/any with constant key, not cross';

SELECT '-- ANY LEFT ON 1 over comma join child';

SELECT
    reinterpretAsUInt64(-1.0 * toFloat64(0)) = 0x8000000000000000 AS f64_is_negative_zero,
    reinterpretAsUInt32(toFloat32(toFloat32(-1) * toFloat32(0))) = 0x80000000 AS f32_is_negative_zero;

SELECT variantType(geometry) FROM format(GeoJSON, '{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"MultiPoint","coordinates":[[1,2],[3,4]]},"properties":{}}]}') SETTINGS input_format_geojson_unsupported_geometry_handling = 'null';

SELECT 'b1', * FROM t1 ANY JOIN t2 ON t1.k = t2.k SETTINGS join_any_take_last_row = 0;

INSERT INTO pe_fact2 SELECT number, number, number FROM numbers(2000);

SELECT d.tag, sum(f.v)
FROM pe_fact2 AS f
INNER JOIN pe_dim2 AS d ON f.k = d.k
WHERE d.tag = 'hot'
GROUP BY d.tag
FORMAT Null
SETTINGS log_comment = '04490_pe_skip';

-- The boundary values of the allowed range are accepted.
SELECT count() FROM (SELECT * FROM obfuscate(SELECT toString(number) AS s FROM numbers(8)) LIMIT 8 SETTINGS obfuscate_markov_order = 1, obfuscate_seed = 'seed');

INSERT INTO t1 VALUES (1, 3.14), (2, 2.72);

DROP TABLE t_readonly_partition_commands;

INSERT INTO src_direct VALUES (1, 'a'), (2, 'b'), (3, 'a'), (4, 'c'), (5, 'a');

-- Sanity check: with no inner settings the invalid session value still applies and the query fails.
SELECT count() FROM (
    SELECT * FROM obfuscate(SELECT 'hello world' AS s FROM numbers(8)) LIMIT 8);

-- full precision over all dims => 16 planes x 4 groups = 64 streams.
SELECT 'p=16 dims=4096 (expect 64)', arrayUniq(extractAll(arrayStringConcat((SELECT groupArray(explain) FROM (EXPLAIN actions = 1 WITH arrayMap(i -> toBFloat16(i), range(4096)) AS ref SELECT L2DistanceTransposed(vec, ref, 16, 4096) FROM qbit_io)), ' '), 'vec\\.[0-9]+'));

-- Enabling `allow_aggregate_partitions_independently` by default must not break the global
-- `max_rows_to_group_by` limit. When the partition key is a function of the GROUP BY key, the
-- optimization aggregates each partition independently and skips the merge phase, which is where
-- the global limit is enforced. The optimization must therefore be disabled when
-- `max_rows_to_group_by` is set, matching the sharded-aggregation and distributed-plan paths.

DROP TABLE IF EXISTS t_apart_max_rows;

SELECT count() FROM (SELECT aiEmbed(x, 'embed-model') AS r FROM tab);

SELECT '-- DateTime64(3): unquoted float (the reported bug)';

SELECT * FROM format(JSONEachRow, 't DateTime64(3), n Int32', '{"t":1703363853.035,"n":7}');

-- The settings randomizer injects an explicit `max_insert_threads`, which marks the setting as
-- changed and prevents the `compatibility` setting from restoring its previous default below.

-- Since 26.8, `max_insert_threads` defaults to auto (the number of CPU cores) instead of 1,
-- so `INSERT SELECT` is parallelized by default.

-- The default is `auto(N)`; the exact N depends on the machine, so only check the `auto` marker.
SELECT default LIKE '%auto(%' FROM system.settings WHERE name = 'max_insert_threads';

CREATE TABLE t_or_like_chain_nul (s String) ENGINE = Memory;

OPTIMIZE TABLE t_proj_ttl_wide FINAL;

SELECT 'Partial-dimension distance over the first 8 dims';

-- `[ATTACH|REPLACE] PARTITION ... FROM` source table.
SELECT formatQueryFromJSON(parseQueryToJSON('ALTER TABLE t ATTACH PARTITION 1 FROM src'));

INSERT INTO target VALUES (1000);

WITH t AS (SELECT number, * FROM numbers(3))
SELECT *, (SELECT t.number WHERE t.number >= 0) AS r FROM t
ORDER BY 1
SETTINGS correlated_subqueries_default_join_kind = 'right', correlated_subqueries_use_in_memory_buffer = 0;

-- Multiple spill rounds (every chunk is dumped as a separate run under the tiny threshold).
SELECT count(), sum(cityHash64(k)) FROM (SELECT DISTINCT number % 100000 AS k FROM numbers(300000)) SETTINGS max_bytes_before_external_distinct = 1, max_block_size = 65409, max_untracked_memory = 0;

SET min_count_to_compile_regular_expression = 0;

SELECT match('anything at all', '.*');

SELECT match('the cat sat', '\\bcat\\b');

DROP TABLE t_04493_plain;

DESCRIBE file(currentDatabase() || '_04493.arrowstream', 'ArrowStream');

INSERT INTO pfsmj_rio_left SELECT number, number FROM numbers(30000, 30000);

SELECT sqr(toFloat64(-1.5)) = multiply(toFloat64(-1.5), toFloat64(-1.5)), toTypeName(sqr(toFloat64(-1.5))) = toTypeName(multiply(toFloat64(-1.5), toFloat64(-1.5)));

SELECT 'agg_allowed created';

SELECT formatQueryFromJSON(parseQueryToJSON('SYSTEM STOP LISTEN TCP'));

SELECT count() FROM (SELECT DISTINCT toString(number % 1000) AS k FROM numbers(10000)) SETTINGS log_comment = '04494_external_distinct_key_types/string';

SELECT replaceRegexpOne('hello 123 world 456', '[0-9]+', 'N');

SELECT match(concat(repeat('a', 64), 'b'), 'a?a?a?a?a?a?a?a?a?a?a?a?a?a?a?a?b');

-- Regression test for the AST JSON review finding on hidden UUID state in nested table references.
--
-- A `REFRESH DEPENDS ON src UUID '...'` dependency (an `ASTTableIdentifier`) and a materialized-view
-- `TO tgt` target (`ASTViewTargets` `table_id`) can carry a `UUID` that execution honours
-- (`ASTTableIdentifier::getTableId` / the target `StorageID`). But the SQL formatters for those nested
-- references never emit a `UUID` clause: `ASTIdentifier::formatImplWithoutAlias` prints only the name, and
-- `ASTViewTargets::formatTarget` prints only `db.table` for a `table_id` target (only `inner_uuid` is emitted,
-- as `INNER UUID '...'`). `formatQueryFromJSON` would therefore print a name-only reference while the JSON AST
-- still resolves the table by `UUID`. Such payloads must fail closed with `BAD_ARGUMENTS` at the boundary
-- instead of round-tripping to SQL that refers to a different table than the JSON AST executes against.

-- ---------------------------------------------------------------------------
-- Valid shapes without a nested UUID must keep round-tripping.
-- ---------------------------------------------------------------------------
SELECT formatQueryFromJSON(parseQueryToJSON('CREATE MATERIALIZED VIEW v REFRESH DEPENDS ON src ENGINE = Memory AS SELECT 1'));

-- FixedString, non-substring chain (would otherwise become `multiMatchAny`).
SELECT count() FROM t_or_like_fs WHERE s LIKE 'app%' OR s LIKE 'ban%' OR s LIKE 'cher%' SETTINGS optimize_or_like_chain = 0;

INSERT INTO pfsmj_nfloat_left  SELECT number, if(number % 3 = 0, NULL, if(number % 2 = 0, -0.0, toFloat64(number))) FROM numbers(0, 2000);

-- Correctness against `hash` for every join kind.
SELECT 'inner',
    (SELECT (sum(l.a + r.b), count()) FROM pfsmj_rio_left AS l INNER JOIN pfsmj_rio_right AS r ON l.id = r.id SETTINGS join_algorithm = 'parallel_full_sorting_merge')
  = (SELECT (sum(l.a + r.b), count()) FROM pfsmj_rio_left AS l INNER JOIN pfsmj_rio_right AS r ON l.id = r.id SETTINGS join_algorithm = 'hash');

SELECT 'Element type conversion during cast (QBit(Float32, 16, 8) -> Array(Float64))';

SELECT number FROM numbers(3) SETTINGS sort = 'number,,number';

SELECT match(concat(repeat('1', 137), 'a'), '(?:)?[0-9]+a');

DROP TABLE pfsmj_json_left;

-- `full_sorting_merge` first -> selected -> NOT sharded, even though `parallel_full_sorting_merge` follows.
SELECT 'analyzer full_first_not_scattered', countIf(explain LIKE '%ScatterByPartitionTransform%') = 0
FROM (EXPLAIN PIPELINE SELECT l.id FROM pfsmj_prio_left AS l INNER JOIN pfsmj_prio_right AS r ON l.k = r.k SETTINGS join_algorithm = 'full_sorting_merge,parallel_full_sorting_merge', max_threads = 4);

SELECT round(contingencyMerge(s.`AggregateFunction(contingency, UInt8, UInt8)`), 4)
FROM
(
    SELECT contingencyState(toUInt8(number % 10), toUInt8(number % 6)) OVER () AS s FROM numbers(100) LIMIT 1
    EXCEPT DISTINCT
    SELECT contingencyState(toUInt8(number % 10), toInt128OrDefault(number % 65535)) AS s FROM numbers(100)
    EXCEPT DISTINCT
    SELECT contingencyState(toUInt8(number % 10), toUInt8(number % 65535)) AS s FROM numbers(100)
);

-- 0 means unlimited.
ALTER DATABASE {CLICKHOUSE_DATABASE_1:Identifier} MODIFY SETTING max_tables = 0;

CREATE DICTIONARY {CLICKHOUSE_DATABASE_1:Identifier}.dict (x UInt64) PRIMARY KEY x SOURCE(CLICKHOUSE(TABLE 'dict_source')) LIFETIME(0) LAYOUT(FLAT());

create table t (x DateTime64(`nan`)) engine Memory;

SELECT 'key32';

INSERT INTO gt_int8_asc
SELECT k_i8, count(), sum(val)
FROM t_gbylimit_signed GROUP BY k_i8 ORDER BY k_i8 ASC LIMIT 10;

SELECT * FROM (SELECT * FROM gt_int32_asc)
EXCEPT
SELECT * FROM (SELECT k_i32, count(), sum(val)
FROM t_gbylimit_signed GROUP BY k_i32 ORDER BY k_i32 ASC LIMIT 10);

INSERT INTO gt_date32_desc
SELECT k_d32, count(), sum(val)
FROM t_gbylimit_signed GROUP BY k_d32 ORDER BY k_d32 DESC LIMIT 10;

CREATE TABLE gt_float64_desc ENGINE = Memory EMPTY AS
SELECT k_f64, count(), sum(val)
FROM t_gbylimit_float GROUP BY k_f64 ORDER BY k_f64 DESC LIMIT 10;

SELECT k_f32, count(), sum(val)
FROM t_gbylimit_float GROUP BY k_f32 ORDER BY k_f32 DESC NULLS LAST LIMIT 10
EXCEPT
SELECT * FROM gt_float32_desc_nulls_last;

SELECT 'datetime_desc';

INSERT INTO gt_nullable_key32
SELECT k_nu32, count(), sum(val)
FROM t_gbylimit_str GROUP BY k_nu32 ORDER BY k_nu32 ASC LIMIT 10;

SELECT k, count() FROM (SELECT toUInt64(99999 - number) AS k FROM numbers(100000)) GROUP BY k ORDER BY k ASC LIMIT 10 SETTINGS log_comment = '04498_engage_key64' FORMAT Null;

DROP TABLE gt_float32_desc;

INSERT INTO mh_d1 SELECT number, number FROM numbers(2000);

-- Non-deterministic LHS (`rand`): the rewrite must keep two separate LIKE expressions.
EXPLAIN QUERY TREE run_passes = 1
SELECT *
FROM (SELECT 1 AS x)
WHERE (toString(rand()) LIKE '%1%') OR (toString(rand()) LIKE '%2%');

-- Correctness: the sharded algorithm must match `full_sorting_merge`. Without the guard the equal `Dynamic`
-- keys hash into different shards and the merge join misses matches (returns 24 rows instead of 100).
SELECT 'dynamic_key_matches_fsm',
    (SELECT (sum(l.id + r.id), count()) FROM pfsmj_dyn_left AS l INNER JOIN pfsmj_dyn_right AS r ON l.k = r.k SETTINGS join_algorithm = 'parallel_full_sorting_merge', max_threads = 4)
  = (SELECT (sum(l.id + r.id), count()) FROM pfsmj_dyn_left AS l INNER JOIN pfsmj_dyn_right AS r ON l.k = r.k SETTINGS join_algorithm = 'full_sorting_merge', max_threads = 4);

CREATE TABLE 04498_date (d Date) ENGINE = Memory;

-- Ordinary exponents keep working.
SELECT formatQuerySingleLine('SELECT 1 FROM numbers(1) SAMPLE 1.23e-1');

DROP TABLE IF EXISTS t_gbylimit_comp;

DROP TABLE IF EXISTS gt_prefix_one_of_two;

SELECT 'composite_two_level';

DROP TABLE IF EXISTS gt_nullable_nulls_last_desc;

SELECT 'trailing_agg_all_keys';

-- The COLLATE sits past the matched key prefix: `a` alone identifies a group, so
-- the collated tie-break can never affect which groups qualify - the optimization
-- fires for this shape by design.
SELECT 'trailing_collate: optimized by design';

SELECT count() FROM (EXPLAIN actions = 1
    SELECT k1, k2, count() AS c FROM (SELECT number % 10 AS k1, number % 7 AS k2 FROM numbers(1000)) GROUP BY k1, k2 ORDER BY k1 ASC, c DESC LIMIT 5
) WHERE explain LIKE '%Top-K%';

SELECT countIf(explain LIKE '%Top-K%') FROM (EXPLAIN actions = 1
    SELECT k1, k2, count() FROM (SELECT intDiv(99999 - number, 10) AS k1, number % 7 AS k2 FROM numbers(100000)) GROUP BY k1, k2 ORDER BY k1 ASC LIMIT 10);

CREATE TABLE 04499_time64 (t Time64(1)) ENGINE = Memory;

-- Midnight (lossless) case for a `Date32` column: a genuine contradiction, still optimized to no rows.
SELECT 'date32_eq_neq_dt64_midnight';

SELECT toStartOfInterval(toDateTime('2021-06-22 13:42:42', 'UTC'), INTERVAL 7 MINUTE);

DROP TABLE IF EXISTS t_gbylimit_noob;

SELECT 'composite_two_key_aggregates';

DROP TABLE gt_noob_a;

INSERT INTO gt_u8 SELECT k, sum(v) FROM (SELECT toUInt8(255 - (number % 256)) AS k, 1 AS v FROM numbers(1024)) GROUP BY k;

DROP TABLE gt_u8;

INSERT INTO pfsmj_rio_left SELECT number, number FROM numbers(2000, 2000);

CREATE TABLE t_prewhere_final_float (a UInt64, f Float64, v UInt64) ENGINE = ReplacingMergeTree(v) ORDER BY (a, f);

INSERT INTO t2 SELECT number, if(number % 4 = 0, NULL, number) FROM numbers(500);

-- WKB source that already carries the non-canonical single empty ring is normalized to numRings = 0.
SELECT hex(wkb(readWKBPolygon(unhex('01030000000100000000000000'))));

-- A distributed sub-query forwarded to a remote shard must carry a known (non-zero) initiator
-- version: the receiving server uses it for version-gated compatibility decisions. Queries
-- initiated from an internally synthesized `INITIAL_QUERY` context (a refreshable materialized
-- view refresh, or an async insert flush) used to leave the client version at 0.0.0, which now
-- makes `RemoteQueryExecutor` throw a logical error. These contexts must be filled with this
-- server's own version, because this server is the real initiator of the query and of any
-- distributed sub-query it spawns. See https://github.com/ClickHouse/ClickHouse/pull/109408

DROP TABLE IF EXISTS src;

DROP TABLE ins_dictsrc_dist;

SELECT formatQuerySingleLine('SELECT 1 AS local');

SELECT 'Float64 key with nan';

SELECT a, b, count() FROM (SELECT if(number % 1000 = 995, NULL, toNullable(toUInt32(99 - intDiv(number % 1000, 10)))) AS a, toString(number % 10) AS b FROM numbers(2000)) GROUP BY a, b ORDER BY a ASC NULLS LAST, b ASC LIMIT 10 SETTINGS log_comment = '04501_engage_18';

SELECT 'alternating NaN payloads, LIMIT 1';

CREATE TABLE gt_composite_no_order_by_freeze ENGINE = Memory EMPTY AS
SELECT a, b, min(v) AS s FROM (SELECT number % 10 + 1 AS a, number % 10 + 2 AS b, number AS v FROM numbers(600000)) GROUP BY a, b;

SELECT _block_number, _block_offset, * FROM t_ttl_group_by_block_columns ORDER BY ALL;

CREATE TABLE t_null_right (id Nullable(Int32), v Int32) ENGINE = Memory;

SELECT id FROM t1 INNER JOIN t2 ON id = t2.id ORDER BY id SETTINGS single_join_prefer_left_table = 1;

SELECT range(16)::Array(Float32)::QBit(Float32, 16, 8)::QBit(Float64, 16) = range(16)::Array(Float32)::QBit(Float64, 16);

SELECT id, CAST(vec AS QBit(Float32, 16))::Array(Float32) FROM qbit_cast_params_test ORDER BY id;

SELECT accurateCastOrNull([0.1, 0.2, 0.3, 0.4]::QBit(BFloat16, 4), 'QBit(Float32, 4)') IS NULL;

-- Correctness: the optimization must not change the values, and NULL rows must stay NULL. On any single build the
-- optimization-on and optimization-off paths compute bit-identical results, so instead of two coarsely rounded golden
-- blocks (whose absolute values differ in the last decimals across architectures and would be flaky) we compare the two
-- executions directly and assert they are identical, values and NULL mask alike. Each comparison must print 1.

DROP TABLE IF EXISTS qbit_ns;

DROP TABLE qbit_dynamic_ref;

INSERT INTO qbit_q_nullable
SELECT id, codes::QBit(Int8, 8)
FROM
(
    SELECT 1 AS id, arrayMap(x -> quantizeBFloat16ToInt8(x), [0.10, -0.50, 0.30, -0.20, 0.05, -0.90, 1.20, -1.50]::Array(BFloat16)) AS codes
    UNION ALL
    SELECT 3 AS id, arrayMap(x -> quantizeBFloat16ToInt8(x), [0.42, -0.11, 0.88, -0.05, 0.15, -0.33, 0.60, -0.77]::Array(BFloat16)) AS codes
)
ORDER BY id;

SELECT 'strided 4-arg used_dims=8, optimization off (L2, cosine, dot)';

-- quantizeBFloat16ToInt8 / dequantizeInt8ToBFloat16 applied to whole vectors (Array and QBit),
-- in addition to the scalar overloads. The vector overloads apply the same 256-level Gaussian
-- Lloyd-Max codec elementwise, so they must agree with the scalar version applied via arrayMap.

-- Array overloads and their result types.
SELECT quantizeBFloat16ToInt8([0.1, -0.5, 2.0, -3.25]::Array(BFloat16)) AS codes;

-- A more elaborate case matching the original report: the alias is defined outside a lambda
-- while another alias lives inside the lambda body.
-- Uses the non-cryptographic `cityHash64` rather than `MD5` or `SHA256` so the case runs in every
-- build configuration: `MD5` is unavailable in OpenSSL-FIPS builds and `SHA256` is unavailable in
-- builds without OpenSSL (such as the Fast test build). Any string-producing function exercises the
-- same alias-resolution path.

DROP TABLE IF EXISTS t_04502_nested;

INSERT INTO t04502_4 VALUES (2), (3), (4);

SELECT 'huge limit: gated off';

DROP TABLE IF EXISTS gt_having;

SELECT 'negative_having';

SELECT * FROM (SELECT * FROM gt_two_level_string
SETTINGS group_by_two_level_threshold = 100000, group_by_two_level_threshold_bytes = 50000000)
EXCEPT
SELECT * FROM (SELECT toString(number) AS k, count()
FROM numbers(600000) GROUP BY k ORDER BY k ASC LIMIT 10);

-- Regression test: enable_group_by_top_k_optimization with the Distinct
-- combinator caused a use-after-destroy.
-- https://github.com/ClickHouse/ClickHouse/pull/96630

DROP TABLE IF EXISTS t_gbylimit_distinct;

DROP TABLE t_ttl_finished;

SELECT formatQuerySingleLine('CREATE INDEX i0 ON t04502 (((a, b) -> a)) TYPE minmax');

WITH CAST(arrayMap(x -> toFloat32(x), range(8)), 'Dynamic(max_types=8)') AS ref
SELECT DISTINCT toTypeName(L2DistanceTransposed(vec, ref, 3)) FROM qbit_plain SETTINGS optimize_qbit_distance_function_reads = 1;

SELECT quantileExactTupleMerge(0.25)(s)
FROM
(
    SELECT quantileExactTupleState(0.5)((NULL, toFloat64(number))) AS s FROM numbers(1, 50)
    UNION ALL
    SELECT quantileExactTupleState(0.9)((NULL, toFloat64(number))) FROM numbers(51, 50)
);

-- Single-byte elements and FixedString are byte-exact on every architecture (no byte-order ambiguity).
SELECT hex(reinterpret([toUInt8(1), toUInt8(2), toUInt8(255)]::Array(UInt8), 'String'));

SELECT id, hex(reinterpret(arr, 'String')) FROM tab_04503 ORDER BY id;

SELECT corrTuple((toFloat64(1), toFloat64(2)), (toFloat64(3), toFloat64(4)), (toFloat64(5), toFloat64(6)));

SELECT 'At p < 8 the Array(Int8) reference is still reconstructed at full 8-bit precision (every *_matches must be 1, pass on or off)';

DROP TABLE qbit_f32;

CREATE TABLE t_any_scatter (k UInt32, v Int64) ENGINE = MergeTree ORDER BY k
  SETTINGS auto_statistics_types = '';

INSERT INTO t_dyn VALUES ('{"x":1}');

-- 8 buckets, not 4: with 4 the two pre-fix hashes happen to land in the same bucket and the join
-- still matches, so 4 buckets would not catch a regression in `ColumnObject::computeHashInto`.
SELECT 'two_path_grace_hash', count() FROM t2_both AS a INNER JOIN t2_both AS b ON a.k = b.k SETTINGS join_algorithm = 'grace_hash', grace_hash_join_initial_buckets = 8, max_block_size = 1;

-- Hash-based joins must match the two representations (4 = 2 rows x 2 rows).
SELECT 'dyn_hash', count() FROM d_both AS a INNER JOIN d_both AS b ON a.k = b.k SETTINGS join_algorithm = 'hash';

INSERT INTO d_u8_shared VALUES ('fill'::String), (5::UInt8);

DROP TABLE s_typed;

SYSTEM STOP MERGES t_uc_small;

SELECT 'RIGHT ANTI swapped', count(), sum(k), sum(length(w)) FROM t_uc_small RIGHT ANTI JOIN t_uc_big USING (k)
  SETTINGS enable_cascades_optimizer = 1, make_distributed_plan = 1, distributed_plan_fallback_to_local_execution = 0;

SELECT '-- row_number OVER (ORDER BY)';

SELECT geometryIntersectCartesian((1., 1.)::Point, [[(0., 0.), (0., 2.), (2., 2.), (2., 0.)]]::Polygon);

SELECT geometryIntersectSpherical([(4.3613577, 50.8651821), (4.349556, 50.8535879), (4.3602419, 50.8435626), (4.3830299, 50.8428851)]::Ring, [(4.36, 50.85), (4.37, 50.86)]::LineString);

UPDATE t_lwu_modify_order_by SET v = 'bar' WHERE a < 100;

SELECT 'string scalars';

SELECT count(), sum(c) FROM (SELECT toLowCardinality(toString(number % 5000)) AS g, count() AS c FROM numbers_mt(300000) GROUP BY g);

INSERT INTO t_reverse_final VALUES (0, 0, 12);

SELECT 'version column';

SELECT x, y FROM t_reverse_final FINAL ORDER BY x DESC;

SELECT (SELECT uniqExactTuple((number, intDiv(number, 2))) FROM numbers_mt(300000)) = (SELECT (uniqExact(number), uniqExact(intDiv(number, 2))) FROM numbers_mt(300000));

INSERT INTO t1 VALUES (0, 'Join_1_Value_0'), (1, 'Join_1_Value_1'), (2, 'Join_1_Value_2');

INSERT INTO iea_l16 VALUES (1,1),(1,1),(1,1),(2,2),(3,3),(3,3);

DROP TABLE IF EXISTS test_json_collision;

-- 6. Single-use materialized CTE (no UNION, no other reference): still inlined,
--    exactly as without this task's merging logic -- zero materializations.
SELECT count() FROM (
    EXPLAIN
    WITH t AS MATERIALIZED (SELECT number FROM numbers(10))
    SELECT number FROM t
) WHERE explain LIKE '%MaterializingCTE (Materializing CTE:%';

SELECT part_name, column FROM mergeTreeCodecBlockCounts(currentDatabase(), t_pushdown) WHERE column = 'a' OR mapContains(codec_block_counts, 'ZSTD(1)') ORDER BY part_name, column;

SELECT hex(MVTEncodeMerge('t', 4096, 'fid')(s)) FROM mvt_state_id;

SELECT 'break mode returns a partial result';

INSERT INTO jr_any VALUES (2, 'c');

SELECT _table FROM 04507_view LIMIT 1;

SELECT '-- a plain view works; a `= DEFAULT` reset on the reading query is applied there (no limit, 10 rows)';

SELECT t FROM format(JSONEachRow, 't Nullable(DateTime)', '{"t":18446744073709551615}');

UPDATE t_lwu_subcolumn_key SET v = v + 1000000 WHERE tup.a = 3;

CREATE DICTIONARY nb_analysis_dict (ngram String, class_id UInt32 DEFAULT 0, count UInt64 DEFAULT 0)
PRIMARY KEY ngram SOURCE(CLICKHOUSE(TABLE 'nb_analysis_src'))
LAYOUT(NAIVE_BAYES(class_attribute 'class_id' n 1 mode 'token')) LIFETIME(0);

CREATE TABLE t1_16 (key UInt16, a UInt32, attr String) ENGINE = MergeTree ORDER BY key;

-- Bounded range read.
SELECT count(), min(id), max(id) FROM t_reader_executor_encrypted WHERE id BETWEEN 100000 AND 100099;

select sum(t.a), sum(t.b) from t_shared_meta_tuple;

-- Native filter still runs and the policy is applied (regression guard for the lenient check).
SELECT c1 FROM t_04509 ORDER BY c1
SETTINGS additional_table_filters = {'t_04509':'c0'};

SELECT a < b FROM t_arr_cmp ORDER BY a;

SELECT arraySort(materialize([toUInt8(3), 255, 0, 128, 1])), arrayReverseSort(materialize([toUInt8(3), 255, 0, 128, 1]));

SELECT arraySort(arrayMap(x -> toUInt8(intDiv(x, 2)), range(256))) = arrayMap(x -> toUInt8(intDiv(x, 2)), range(256)),
       arrayReverseSort(arrayMap(x -> toUInt8(intDiv(255 - x, 2)), range(256))) = arrayMap(x -> toUInt8(intDiv(255 - x, 2)), range(256));

-- no-parallel: enables a global failpoint

-- Regression test: a BACKUP ... TO Memory(...) that fails before finalization (before the `.backup`
-- metadata file is written) must still clean up after itself. The cleanup used to throw
-- BACKUP_ENTRY_NOT_FOUND on the missing `.backup` file and abort, leaving the backup registered, so
-- re-using the same name failed with BACKUP_ALREADY_EXISTS.

DROP TABLE IF EXISTS t_backup_mem_cleanup;

SELECT '-- 1. the FINAL read is distributed';

SELECT 'Positive: an XGBOOST dictionary with explicit hyperparameters';

SELECT 'Negative: predictXGBoost against a non-XGBoost dictionary';

SELECT 'Train on demand with SYSTEM RELOAD DICTIONARY';

EXPLAIN ESTIMATE SELECT * FROM tab WHERE hasAnyTokens(str, tokens('上海', 'icu', 'zh'));

SELECT greatest(materialize(toNullable(nan)), materialize(CAST(NULL, 'Nullable(Float64)'))) AS x, toTypeName(x);

ALTER TABLE t_lwu_key_prefix ADD COLUMN b UInt64, MODIFY ORDER BY (a, b);

DROP ROW POLICY 04509_policy_true ON t_row_policy;

SELECT readWKBMultiPoint(wkb([(1., 2.), (3., 4.)]::MultiPoint)) AS mp, toTypeName(mp);

-- Dates, UUIDs, and Enums. An Enum element matches a needle of the Enum type, and also a plain
-- string equal to the name of the enum value, because the common type of `Enum` and `String` is
-- `String` and that is what `equals` compares.
SELECT notHas([toDate('2026-01-01'), toDate('2026-01-02')], toDate('2026-01-02'));

CREATE TABLE test_not_has_float (x Float64) ENGINE = MergeTree
ORDER BY x
SETTINGS index_granularity = 1, add_minmax_index_for_numeric_columns = 0;

SELECT '-- an exactly-representable literal resolves the partition';

SELECT '' FROM cluster(test_cluster_two_shards, currentDatabase(), preferred_local_prelimit)
WHERE id < 30 ORDER BY id LIMIT 1 OFFSET 3 FORMAT Template;

CREATE TABLE test_reverse_multi (ts DateTime('UTC')) ENGINE = MergeTree
ORDER BY (toYYYYMM(ts) DESC, toDate(ts) DESC, ts DESC)
SETTINGS index_granularity = 1, index_granularity_bytes = 0, add_minmax_index_for_numeric_columns = 0, min_rows_for_wide_part = 0, min_bytes_for_wide_part = 0;

-- Multi-byte UTF-8 separator
SELECT tokens('a→b→c', 'splitByRegexp', '→');

SELECT 'Column values with match_tokens = 1: tokens should be non-constant';

SELECT countIf(toStartOfInterval(t, INTERVAL 1 MINUTE) != toStartOfMinute(t))
     + countIf(toStartOfInterval(t, INTERVAL 5 MINUTE) != toStartOfFiveMinutes(t))
     + countIf(toStartOfInterval(t, INTERVAL 15 MINUTE) != toStartOfFifteenMinutes(t))
     + countIf(toStartOfInterval(t, INTERVAL 1 HOUR) != toStartOfHour(t))
FROM (SELECT toDateTime64(arrayJoin([-2209000000., -3786749363., 16725303245., 10413800000.]) + number * 97.13, 3, 'Asia/Kolkata') AS t FROM numbers(20000));

-- Subquery embedded as an operand: likewise suppressed and correct.
SELECT countIf(explain LIKE '%VIEW subquery%') > 0 AS pushdown_suppressed
FROM (EXPLAIN SELECT id FROM 04509_view
      SETTINGS additional_table_filters = {'04509_view': 'id = (SELECT id FROM 04509_local_filter LIMIT 1)'});

SELECT * FROM format(CSV, 'x Array(Bool)', '"[true,0,1,false]"');

SELECT clamp(materialize(toNullable(toUInt32(25))), materialize(toUInt32(10)), materialize(toUInt32(20))) AS x, toTypeName(x);

INSERT INTO t_users_108299 VALUES (1231, 'John', 33), (6666, 'Ksenia', 48), (8888, 'Alice', 50);

CREATE TABLE t_mut_subcol (c0 UInt32, tup Tuple(_sample_factor Float64, _table UInt8)) ENGINE = MergeTree ORDER BY c0;

SELECT count() FROM test_not_has WHERE NOT has([1], x) SETTINGS optimize_rewrite_has_to_in = 0;

-- A NULL set element against a String key must be dropped from the set like it is for any other key
-- type, not rejected. A Nullable source cannot be safely cast to a non-Nullable target, so the set
-- columns take the accurate-or-null conversion that filters unrepresentable elements out.
DROP TABLE IF EXISTS test_string_null_set;

SYSTEM STOP MERGES test_dynamic_null_set;

CREATE TABLE test_array_null_set (a Array(String)) ENGINE = MergeTree
ORDER BY a
SETTINGS index_granularity = 1, auto_statistics_types = '';

SELECT count() FROM test_tuple_array_key WHERE has([tuple(['a'])], t);

-- A scalar key reached through the same transform keeps its index, so declining the container target
-- above does not cost pruning here.
DROP TABLE IF EXISTS test_scalar_expr_key;

SELECT trimLeft(explain) FROM (EXPLAIN indexes = 1 SELECT k FROM test_nullable_key_prune WHERE has([CAST('3', 'Nullable(String)')], k)) WHERE explain LIKE '%Granules:%/%';

SELECT trimLeft(explain) FROM (EXPLAIN indexes = 1 SELECT k FROM test_nullable_key_null_elem WHERE has([CAST(NULL, 'LowCardinality(Nullable(String))')], k)) WHERE explain LIKE '%Granules:%/%';

SELECT count() FROM test_not_has_enum WHERE has([100], x) SETTINGS optimize_rewrite_has_to_in = 0, use_primary_key = 0;

-- Tuples with Nullable elements compare three-valued; their Nullable result makes the whole
-- `AND` chain Nullable, which the pass skips: results stay NULL and nothing is derived.
SELECT
    'tuple nullable keeps null',
    (SELECT x < y AND y < CAST(tuple(2), 'Tuple(Nullable(Int32))')
     FROM (SELECT materialize(CAST(tuple(3), 'Tuple(Nullable(Int32))')) AS x,
                  materialize(CAST(tuple(NULL), 'Tuple(Nullable(Int32))')) AS y)
     SETTINGS optimize_and_compare_chain = 1)
        IS NULL,
    (SELECT x < y AND y < CAST(tuple(2), 'Tuple(Nullable(Int32))')
     FROM (SELECT materialize(CAST(tuple(3), 'Tuple(Nullable(Int32))')) AS x,
                  materialize(CAST(tuple(NULL), 'Tuple(Nullable(Int32))')) AS y)
     SETTINGS optimize_and_compare_chain = 0)
        IS NULL,
    (SELECT count()
     FROM (EXPLAIN QUERY TREE
           SELECT x < y AND y < CAST(tuple(2), 'Tuple(Nullable(Int32))')
           FROM (SELECT materialize(CAST(tuple(3), 'Tuple(Nullable(Int32))')) AS x,
                        materialize(CAST(tuple(NULL), 'Tuple(Nullable(Int32))')) AS y)
           SETTINGS optimize_and_compare_chain = 1)
     WHERE explain LIKE '%function_name: less,%')
        =
    (SELECT count()
     FROM (EXPLAIN QUERY TREE
           SELECT x < y AND y < CAST(tuple(2), 'Tuple(Nullable(Int32))')
           FROM (SELECT materialize(CAST(tuple(3), 'Tuple(Nullable(Int32))')) AS x,
                        materialize(CAST(tuple(NULL), 'Tuple(Nullable(Int32))')) AS y)
           SETTINGS optimize_and_compare_chain = 0)
     WHERE explain LIKE '%function_name: less,%');

SELECT k FROM t_04510_virt WHERE _partition_id = '202001' AND v BETWEEN 10 AND 20 ORDER BY k
    SETTINGS optimize_use_projections = 0;

CREATE TABLE t_04510_sg
(
    id UInt32,
    s String,
    INDEX idx s TYPE text(tokenizer = sparseGrams(3, 20, 5)) GRANULARITY 1
)
ENGINE = MergeTree PARTITION BY id ORDER BY id SETTINGS index_granularity = 1;

SELECT id, vec[id], vec[-toInt64(id)], vec[id * 100], arrayElement(vec, materialize(0)) FROM qbit ORDER BY id;

SELECT 'Distance over a sliced strided QBit';

SELECT materialize(map('a', 'b'))[CAST(NULL, 'Nullable(String)')] AS v, toTypeName(v);

CREATE TABLE t_04510 (x UInt8)
ENGINE = S3('http://localhost:11111/test/04510', 'ak', 'SEKRIT_SAK',
            session_token = 'SEKRIT_ST',
            google_adc_client_secret = 'SEKRIT_ADCCS',
            google_adc_refresh_token = 'SEKRIT_ADCRT',
            extra_credentials(role_arn = 'visible_role_arn', external_id = 'SEKRIT_EID'),
            format = 'TSV');

-- A valid non-secret named override (use_environment_credentials) must stay visible while
-- secret_access_key is hidden. This CREATE succeeds (the S3 database is lazy), so use a unique
-- database name to avoid collisions across parallel runs, and drop it after.
DROP DATABASE IF EXISTS {CLICKHOUSE_DATABASE_1:Identifier};

SELECT bitmapToArray(bitmapSubsetInRange(bitmapBuild(arrayConcat(CAST(range(31), 'Array(Int16)'), [-32768, -1]::Array(Int16))), 40000, 65536));

-- always write wide parts so statistics files are written

SET materialize_statistics_on_insert = 1;

DROP TABLE 04510_local;

SELECT addWeeks(materialize(toDateTime64('2020-02-28 23:30:00.25', 2, 'UTC')), number) FROM numbers(3);

-- A DateTime is a UInt32 and its whole domain lies inside the lookup table, so the day shift never
-- needs the source-range escape path for it. Pin both ends of that domain.
SELECT addDays(toDateTime(0, 'UTC'), 1) AS x, toUInt32(x);

-- Non-constant argument.
SELECT L2Normalize(materialize([3, 4]));

SELECT * FROM format(JSONEachRow, 'x Bool', '{"x":0}');

DROP TABLE rsj_dim1;

SELECT count() FROM (SELECT DISTINCT a, b FROM (SELECT a, b FROM t_distinct_break_runs ORDER BY a)) SETTINGS query_plan_remove_redundant_sorting = 0;

-- inside, outside the hole -> 1
SELECT pointInPolygon((20., 20.), [[(0, 0), (10, 0), (10, 10), (0, 10)], [(4, 4), (6, 4), (6, 6), (4, 6)]]::Polygon);

INSERT INTO pip_geo VALUES (2, readWKT('MULTIPOLYGON(((0 0, 10 0, 10 10, 0 10)), ((20 20, 30 20, 30 30, 20 30)))'));

SYSTEM START TTL MERGES t_proj_codec;

SELECT count() FROM test_reverse_nullable_no_final_mark WHERE x = 5;

-- 6 of every 7 rows are default. The period of non-default rows must not be a multiple
-- of 10: the ratio of default rows is estimated by sampling of every 10-th row and with
-- an aliasing pattern the column would not be serialized as sparse. Cardinalities are
-- chosen to exercise all container regimes of `CombinedCardinalityEstimator` for both
-- `uniqCombined(12)` and `uniqCombined64(12)`: small array (<= 16 elements), medium
-- hash set (<= 256/128 elements) and the large HyperLogLog. Column `z` consists of
-- defaults only.
INSERT INTO t_uniq_sparse SELECT
    number,
    if(number % 7 = 0, 1 + intDiv(number, 7) % 10, 0),
    if(number % 7 = 0, 1 + intDiv(number, 7) % 100, 0),
    if(number % 7 = 0, 1 + intDiv(number, 7), 0),
    if(number % 7 = 0, 'str_' || toString(intDiv(number, 7) % 10), ''),
    if(number % 7 = 0, 'str_' || toString(intDiv(number, 7) % 100), ''),
    if(number % 7 = 0, 'str_' || toString(intDiv(number, 7)), ''),
    0
FROM numbers(140000);

SELECT 'merge of states from sparse and dense paths';

SELECT toUInt32OrDefault(CAST(NULL, 'LowCardinality(Nullable(String))'));

SELECT count() FROM t_constraint_subcolumn;

SELECT '-- internal distinct must ignore user distinct limits --';

-- Constant expressions.
SELECT * FROM eval('SEL' || 'ECT 1 AS x');

OPTIMIZE TABLE t_04512 FINAL;

CREATE TABLE t_04512_arr (arr Array(UInt8)) ENGINE = Memory;

DROP TABLE t_04512_nested;

SELECT length(fs) FROM fsbug WHERE id = 7;

-- 0-level part: no materialized _block_offset/_block_number. Must not throw.
ALTER TABLE t_mat_imv_offset MATERIALIZE INDEX auto_minmax_index__block_offset SETTINGS mutations_sync = 2;

SELECT 'statistics are materialized by the merge';

SELECT 'not applied: `sum` of a column without `basic` statistics';

-- Three branches: Variant sorts the branch types, so the tags/discriminators are remapped on write and read.
INSERT INTO FUNCTION file(currentDatabase() || '_04512_3.orc', ORC, 'v Variant(Int32, String, Float64)')
      SELECT 42::Int32::Variant(Int32, String, Float64)
UNION ALL SELECT 'hi'::String::Variant(Int32, String, Float64)
UNION ALL SELECT (3.14::Float64)::Variant(Int32, String, Float64)
UNION ALL SELECT CAST(NULL, 'Variant(Int32, String, Float64)');

SELECT 'UInt64',  sum(u64 != toUInt64(id * 1000000007)) FROM t_pco;

INSERT INTO t_pco_small SELECT number, toInt32(number) - 2 FROM numbers(3);

DROP TABLE pip_geo_mismatch;

SELECT count() = 2 FROM (
    EXPLAIN SELECT * FROM (SELECT number AS x FROM numbers(10)) a
    INNER JOIN (SELECT number AS y FROM numbers(100)) b ON a.x = b.y AND 1 = 2
) WHERE explain ILIKE '%ReadNothing%';

SELECT 'FULL', a.x, b.y FROM (SELECT number AS x FROM numbers(5)) a
    FULL JOIN (SELECT number AS y FROM numbers(3)) b ON a.x = b.y AND 1 = 2 ORDER BY a.x, b.y;

SELECT materialize(toDecimal256('-1.5', 20)) != materialize(toInt256(-1));

SELECT materialize(toUInt8(200)) + materialize(toUInt256(55)) AS x, toTypeName(x);

SELECT '-- two unsigned operands are computed in the wider unsigned type, exact at the type maximum';

SELECT addYears(toDateTime64('1970-01-01 00:00:00', 9, 'UTC'), 9223372036854775807);

-- Force the two-level aggregation and the memory-efficient merge, and keep several threads so the
-- partial flush runs in parallel.
SET group_by_two_level_threshold = 1;

UPDATE t_lwu_combine SET b = 2 WHERE a % 4 = 0;

DROP TABLE t_pco_alter;

DROP TABLE t_prewhere_stats_cost;

-- Alias defined and referenced at the top level of the predicate.
SELECT count() > 0 FROM mergeTreeAnalyzeIndexes(currentDatabase(), t_04514, (key AS a) = a);

DROP TABLE t_04515;

INSERT INTO dim_04516 SELECT number FROM numbers(10000);

CREATE TABLE t0_04516 (c0 Bool, c1 Int32) ENGINE = MergeTree ORDER BY c0;

-- The inner join really reads its MergeTree side in order (the nested read-in-order this test is about).
SELECT 'analyzer inner_reads_in_order', countIf(explain LIKE '%InOrder%') >= 1
FROM (EXPLAIN PIPELINE
  SELECT s.k FROM (SELECT l.k AS k FROM pfsmj_nrio_ord AS l INNER JOIN pfsmj_nrio_dim AS r ON l.d = r.d ORDER BY l.k SETTINGS join_algorithm = 'hash') AS s
  INNER JOIN pfsmj_nrio_probe AS p ON s.k = p.k
  SETTINGS join_algorithm = 'parallel_full_sorting_merge', max_threads = 4, optimize_read_in_order = 1, read_in_order_use_virtual_row = 1, query_plan_join_shard_by_pk_ranges = 0);

-- Under parallel replicas the marks are spread over the participants, so sum the events
-- over all queries initiated by the marked one. ParallelReplicasReadMarks counts marks
-- after refinement (only the ones which reach a reader): 2 surviving marks, not 256.
SELECT
    sum(ProfileEvents['ReadPoolRangeRefinerDroppedMarks']) > 200 AS dropped_marks,
    sum(ProfileEvents['ParallelReplicasReadMarks']) < 10 AS read_marks_counted_after_refinement
FROM system.query_log
WHERE type = 'QueryFinish'
    AND initial_query_id IN (
        SELECT query_id FROM system.query_log
        WHERE current_database = currentDatabase()
            AND type = 'QueryFinish'
            AND is_initial_query
            AND query LIKE '%refiner_query_parallel_replicas_default%'
            AND query NOT LIKE '%query_log%');

ALTER TABLE t_proj_agg_drift MODIFY COLUMN c UInt64 ALIAS d + 1;

DROP TABLE s3_table_cte;

-- First key an expression over a nullable column
SELECT count() > 0 FROM (
    EXPLAIN actions = 1
    SELECT dt, count() FROM scd2 JOIN calendar_scd2 ON dt <= ifNull(range_end, toDate('2099-01-01')) AND range_start <= dt GROUP BY dt
) WHERE explain LIKE '%IEJoin%';

DROP TABLE IF EXISTS pfsmj_pkr_dim;

-- Tuple mixing a plain column with an aggregate: the aggregate is not part of the grouping key.
SELECT (c0, sum(c1)) FROM (SELECT number % 3 AS c0, number AS c1 FROM numbers(10)) GROUP BY ALL ORDER BY ALL
    SETTINGS optimize_injective_functions_in_group_by = 0;

DROP TABLE IF EXISTS flags;

-- Token generators: the separator (splitByChar / splitByString / splitByRegexp) and the
-- max_substrings option are constant.
SELECT signature FROM system.functions WHERE name = 'splitByChar';

SELECT count() > 0 FROM (EXPLAIN actions = 1 SELECT l.id FROM left_small l LEFT ANTI JOIN right_small r ON l.start < r.stop AND r.start < l.stop) WHERE explain LIKE '%IEJoin%';

SELECT 'anti symbol';

SELECT CAST('{"t":-0.5}', 'JSON(t DateTime)');

-- ASC-friendly operator pair: the first condition `<` keeps the L1 order ascending, so the
-- pre-sorted inputs are merged forward.
SELECT count() > 0 FROM (
    EXPLAIN actions = 1 SELECT count() FROM rio_l l JOIN rio_r r ON l.x < r.x AND l.y > r.y SETTINGS optimize_read_in_order = 1
) WHERE explain LIKE '%IEJoin%';

SELECT '>  <=', (SELECT (count(), sum(cityHash64(l.id, r.id))) FROM ties_l l JOIN ties_r r ON l.x > r.x AND l.y <= r.y) = (SELECT (count(), sum(cityHash64(l.id, r.id))) FROM ties_l l, ties_r r WHERE l.x > r.x AND l.y <= r.y) AS ok, (SELECT count() FROM ties_l l JOIN ties_r r ON l.x > r.x AND l.y <= r.y) AS cnt;

-- BETWEEN desugars to `>=` + `<=`: opposite families, merge shortcut.
SELECT 'between', (SELECT (count(), sum(cityHash64(p.id, b.id))) FROM pts p JOIN bands b ON p.x BETWEEN b.lo AND b.hi) = (SELECT (count(), sum(cityHash64(p.id, b.id))) FROM pts p, bands b WHERE p.x BETWEEN b.lo AND b.hi) AS ok, (SELECT count() FROM pts p JOIN bands b ON p.x BETWEEN b.lo AND b.hi) AS cnt;

CREATE TABLE t_cast_expired_materialize (a String, m Int64 MATERIALIZED toInt64OrDefault(a)) ENGINE = MergeTree ORDER BY tuple();

DROP TABLE t_cast_expired_materialize;

DROP TABLE rpad;

SELECT 'enum json';

DROP TABLE tro;

SELECT l.id, l.start, l.stop, l.symbol, l.price FROM wide_ranges_anti l LEFT ANTI JOIN narrow_ranges_anti r
    ON l.start < r.stop AND r.start < l.stop AND r.symbol = l.symbol AND l.price + r.bid < 375 ORDER BY id;

DROP TABLE IF EXISTS enc_l;

SELECT 'DateTime', (SELECT (count(), sum(cityHash64(l.id, r.id))) FROM enc_l l JOIN enc_r r ON l.dta <= r.dta AND l.dtb < r.dtb) = (SELECT (count(), sum(cityHash64(l.id, r.id))) FROM enc_l l, enc_r r WHERE l.dta <= r.dta AND l.dtb < r.dtb) AS ok, (SELECT count() FROM enc_l l JOIN enc_r r ON l.dta <= r.dta AND l.dtb < r.dtb) AS cnt;

SELECT '<' AS op1, '<' AS op2, (SELECT arraySort(groupArray((l.id, r.id))) FROM t1 l JOIN t2 r ON l.x < r.x AND l.y < r.y) = (SELECT arraySort(groupArray((l.id, r.id))) FROM t1 l, t2 r WHERE (l.x < r.x) AND (l.y < r.y)) AS ok, (SELECT count() FROM t1 l JOIN t2 r ON l.x < r.x AND l.y < r.y) AS cnt;

SELECT count() FROM (SELECT s, n FROM t_agg_in_order_serialized_mt GROUP BY s, n)
SETTINGS optimize_aggregation_in_order = 1, optimize_read_in_order = 1,
         max_threads = 4, max_block_size = 16384, max_execution_time = 120;

SELECT a.x FROM (SELECT toInt64(number) AS x, toInt64(number) AS y FROM numbers(10)) a JOIN (SELECT toInt64(number + 100) AS x, toInt64(number) - 1 AS y FROM numbers(1)) b ON a.x < b.x AND a.y > b.y ORDER BY a.x SETTINGS max_block_size = 5;

-- VALID FOR together with an authentication method (credential level).
CREATE USER user_04537_valid_for IDENTIFIED WITH plaintext_password BY 'x' VALID FOR INTERVAL 2 DAY;

SELECT count() FROM t_dt64_mono WHERE toRelativeWeekNum(d) >= 1565 SETTINGS force_primary_key = 1;

SELECT '-- toStartOfInterval 1 DAY';

INSERT INTO delta_decode_roundtrip
SELECT
    3000000 + number,
    toUInt8(intHash64(number)), toUInt8(intHash64(number)),
    toUInt16(intHash64(number)), toUInt16(intHash64(number)),
    toUInt32(intHash64(number)), toUInt32(intHash64(number)),
    intHash64(number), intHash64(number)
FROM numbers(15);

-- Read-in-order with a small limit and no filtering: intersecting ranges must not be split
-- into layers, the result is expected to be produced by a single lazy merging stream.
SELECT 'in-order small limit, layers:', countIf(explain LIKE '%FilterSortedStreamByRange%') > 0
FROM (EXPLAIN PIPELINE SELECT k, v FROM t_final_layers FINAL ORDER BY k LIMIT 10);

SELECT 'collapsing small limit, layers:', countIf(explain LIKE '%FilterSortedStreamByRange%') > 0
FROM (EXPLAIN PIPELINE SELECT k FROM t_final_layers_collapsing FINAL ORDER BY k LIMIT 10);

DROP TABLE west;

-- ALTER MODIFY COLUMN of a sort-key column may wrap or unwrap LowCardinality (the only
-- class-changing conversion allowed for key columns). Until the rewriting mutation
-- materializes, v2 patch parts and main parts hold sort-key columns of different classes:
-- patches written before the ALTER keep the old type, patches written after it carry the
-- new type, while main parts still store the old one.

SET enable_lightweight_update = 1;

CREATE TABLE t_lwu_multi_nested (id UInt64, n Nested(a UInt64, b String))
ENGINE = MergeTree ORDER BY tuple()
SETTINGS enable_block_number_column = 1, enable_block_offset_column = 1;

DROP TABLE IF EXISTS heredoc_mv_04538;

-- Non-constant (materialized)
SELECT materialize(CAST('1', 'UInt64')) IS DISTINCT FROM materialize(CAST('-1', 'Int64'));

SELECT NULL IS DISTINCT FROM [1]::Array(UInt64);

-- The same query, but resetting query-cache-related settings via `= DEFAULT`. These resets do not
-- affect the result and must be normalized away, so the query is served from the cache (passive mode).
-- Note: the target query below must follow a statement (not a comment), otherwise query_log stores
-- the preceding comment as part of its `query` text and the exact-match lookup misses it.
SELECT '---';

SELECT count(), countIf(query_id = queryID()), max(sequence_number) - min(sequence_number) + 1 = count() FROM system.session_query_ids;

INSERT INTO t_arith_key VALUES (3, 4, '2020-01-01');

DROP TABLE IF EXISTS t_es16_narrow;

-- *OrNull variant exercises the Null execution error policy (the null map is mapped back too).
SELECT 'hasTokenOrNull', sum(hasTokenOrNull(c, 'A') != hasTokenOrNull(toString(c), 'A')) FROM t_es8;

DROP TABLE t_es16_narrow;

-- A small LIMIT without ORDER BY stops reading early: lazy FINAL must be disabled.
SELECT 'small limit:', countIf(explain LIKE '%InputSelector%') > 0
FROM (EXPLAIN SELECT k FROM t_lazy_final_gates FINAL WHERE v = 7 LIMIT 10);

CREATE TABLE t_lazy_final_gates_disjoint (k UInt64, v UInt64, s String) ENGINE = ReplacingMergeTree ORDER BY k;

SELECT '--- Multi-conjunct TopK still returns the planted row';

CREATE TABLE t_uniq_fs_nul (s FixedString(8)) ENGINE = MergeTree ORDER BY tuple();

-- Regression test: EXPLAIN ANALYZE executes the inner SELECT, so once a transaction has failed
-- (ROLLED_BACK) it must be rejected like a plain SELECT and not sneak through the
-- "special query" exemption for EXPLAIN. Non-executing EXPLAIN kinds keep working.

DROP TABLE IF EXISTS t_04540;

-- The non-NULL values do match themselves
SELECT a.x, b.x FROM test6861 AS a JOIN test6861 AS b ON a.x BETWEEN b.x AND b.x ORDER BY ALL;

-- A row policy is a reader-embedded filter as well: lazy materialization applies even
-- without WHERE, and the returned rows respect the policy.
CREATE ROW POLICY policy_04540 ON t_lazy_final_limit FOR SELECT USING k < 50000 TO ALL;

SELECT readWKTMultiPolygon('MULTIPOLYGON EMPTY');

SELECT 'no_orphan', count() FROM system.tables WHERE database = currentDatabase() AND name = 'missing';

INSERT INTO bf_r SELECT
    number,
    [nan, -nan, inf, -inf, 0., 2.5, -1.5, -3.][1 + intDiv(number, 2) % 8]::BFloat16,
    [nan, inf, -inf, 0., 1.5, -2.5][1 + intDiv(number, 3) % 6]::BFloat16,
    [NULL, nan, 2.5, -1.5, 0., -inf][1 + intDiv(number, 5) % 6]::Nullable(BFloat16)
FROM numbers(48);

SELECT * FROM full_side l LEFT ANTI JOIN empty_side r ON l.x < r.x AND l.y > r.y ORDER BY l.id;

INSERT INTO neg_r VALUES (1, 1, 1, 'a%', 1.0), (2, 2, 3, 'b%', 2.0), (3, 3, 2, '%', 3.0);

DROP TABLE IF EXISTS t1_04545;

-- Very large finite values, above the range of time_t after the cast to Float64,
-- must also saturate instead of hitting an undefined float-to-integer cast.
SELECT toDateTime32(CAST(1e38 AS BFloat16), 'UTC');

SELECT toDate32(toUInt64(9223372036854775808), 'UTC');

CREATE TABLE t_bf_null_in_n
(
    a Nullable(String),
    b LowCardinality(String),
    c LowCardinality(Nullable(String)),
    INDEX idx_a a TYPE bloom_filter GRANULARITY 1,
    INDEX idx_b b TYPE bloom_filter GRANULARITY 1,
    INDEX idx_c c TYPE bloom_filter GRANULARITY 1
)
ENGINE = MergeTree ORDER BY tuple() SETTINGS index_granularity = 4;

CREATE TABLE t_bf_null_in_arr (x Array(UInt32), INDEX idx_x x TYPE bloom_filter GRANULARITY 1)
ENGINE = MergeTree ORDER BY tuple() SETTINGS index_granularity = 2;

SELECT 'Tuple: IN does not prune with transform_null_in=1';

SELECT count() FROM t_subplan_ref_clone WHERE idx IN (SELECT idx FROM t_subplan_ref_clone WHERE (SELECT dt) > 256) SETTINGS query_plan_optimize_join_order_randomize = 2;

-- Referencing a column no longer throws; it returns zero rows.
SELECT a FROM format(JSONEachRow, 'a UInt32', '') WHERE a > 0;

SELECT x, isNull(x) AS x_is_null, str FROM t_left_04545 FULL JOIN t_full_nulls_04545 USING (x) ORDER BY str, x;

DROP TABLE t_full_nulls_04545;

SELECT l.s, l.le, r.e8, r.e16, r.ne FROM tl AS l FULL JOIN tr AS r ON l.s = r.s ORDER BY l.s, r.s, r.e8 SETTINGS join_algorithm = 'full_sorting_merge', join_use_nulls = 0;

-- force spilling to disk (it rehashes at half of this)
SET max_bytes_ratio_before_external_join = 0;

SELECT 'UInt256 identity', groupBitOrIf(v, c0) = CAST(0, 'UInt256'), groupBitAndIf(v, c0) = bitNot(CAST(0, 'UInt256')), groupBitXorIf(v, c0) = CAST(0, 'UInt256') FROM (SELECT bitOr(bitOr(bitShiftLeft(CAST(cityHash64(number, 1), 'UInt256'), 192), bitShiftLeft(CAST(cityHash64(number, 2), 'UInt256'), 128)), bitOr(bitShiftLeft(CAST(cityHash64(number, 3), 'UInt256'), 64), CAST(cityHash64(number, 4), 'UInt256'))) AS v, number > 100 AS c0 FROM numbers(100));

-- Constructed non-saturating masking check. The random cross-checks above OR to all-ones and
-- AND to all-zeros over 70k rows, so groupBitOrIf/groupBitAndIf reach the right answer regardless
-- of which rows their keep_mask selects. Here bit 0 is set only in kept rows and the top bit only
-- in dropped rows, so groupBitOrIf(v, c) != groupBitOr(v) and groupBitAndIf(v, c) != groupBitAnd(v):
-- each -If kernel proves its own masking formula instead of leaning on groupBitXorIf as a proxy.
-- Covers the scalar path (UInt8) and the wide-integer memset path (UInt256), plain and Nullable.
SELECT 'UInt8 masked',
    groupBitOrIf(v, c)  = arrayReduce('groupBitOr',  groupArrayIf(v, c)),
    groupBitAndIf(v, c) = arrayReduce('groupBitAnd', groupArrayIf(v, c)),
    groupBitXorIf(v, c) = arrayReduce('groupBitXor', groupArrayIf(v, c)),
    groupBitOrIf(vn, c)  = arrayReduce('groupBitOr',  groupArrayIf(vn, c)),
    groupBitAndIf(vn, c) = arrayReduce('groupBitAnd', groupArrayIf(vn, c)),
    groupBitXorIf(vn, c) = arrayReduce('groupBitXor', groupArrayIf(vn, c)),
    groupBitOrIf(v, c)  != groupBitOr(v),
    groupBitAndIf(v, c) != groupBitAnd(v)
FROM (SELECT toUInt8(bitOr(if(bitAnd(number, 1) = 0, 1, 128), bitShiftLeft(bitAnd(number, 15), 1))) AS v, bitAnd(number, 1) = 0 AS c, if(bitAnd(number, 3) = 1, NULL, toUInt8(bitOr(if(bitAnd(number, 1) = 0, 1, 128), bitShiftLeft(bitAnd(number, 15), 1)))) AS vn FROM numbers(14));

DROP TABLE IF EXISTS lc_l;

-- bare NULL literal: NULL result
SELECT toTypeName(naiveBayesNgrams(NULL, 2, 'token'));

DROP TABLE IF EXISTS nl;

SET optimize_or_like_chain_min_patterns = 1;

SYSTEM DISABLE FAILPOINT parallel_replicas_skip_aggregate_projection_on_follower;

select count() from file(currentDatabase() || '_04545_dec.parquet', Parquet, 'd Decimal128(20)')
    where d > toDecimal128(1500.5, 20) settings log_comment = '04545prune_dec_widen';

-- Composite sorting key: implicit-bool filter on the second key column must not sum a or b.
DROP TABLE IF EXISTS t_04545_composite;

SELECT number FROM numbers(10) LIMIT {limit:UInt8};

-- like inside throwIf stayed correct before and after the fix.
SELECT throwIf(like(s, '%bar%'), 'unexpected throw like bar') FROM t_throwif_lc;

-- Symmetric high bound: a positive out-of-range `ExtendedDayNum` (a `Date32` pushed past `9999-12-31` by
-- arithmetic) must clamp to the last representable Monday `9999-12-27` (day `2932892`), not to the raw
-- maximum day `9999-12-31` (a Friday, off the lattice). Before the fix the high clamp used `max_daynum`
-- directly and returned `9999-12-31`, breaking the `4 + 7 * n` invariant.
SELECT toInt32(toStartOfInterval(toDate32('2299-12-31') + INTERVAL 100000000 DAY, INTERVAL 2 WEEK)) = 2932892
    SETTINGS enable_extended_results_for_datetime_functions = 1;

DESCRIBE mergeTreeIndex(currentDatabase(), t_totime_legacy_created);

DROP TABLE t_zxc_src;

INSERT INTO t_strings SELECT number, concat('str_', toString(number), repeat('x', 64)) FROM numbers(10);

DROP TABLE IF EXISTS ext_r;

-- GROUPING SETS: dropping the function-of-key must not change the non-member set row default.
SELECT toString(number) AS v, number, count()
FROM numbers(3)
GROUP BY GROUPING SETS ((v, number), (number))
ORDER BY number, v, GROUPING(v)
SETTINGS optimize_group_by_function_keys = 0;

SELECT 'LowCardinality(String) subcolumns=1', m['d'] FROM t_map_types WHERE id = 2 SETTINGS optimize_functions_to_subcolumns = 1;

DROP TABLE IF EXISTS t_04546_right;

SELECT '--- zero pool size is rejected when passed through a named collection ---';

-- The empty fragment header only arises when this pass runs, and the test runner randomizes the
-- setting off, where the cases below would pass without reaching the shape they are about.
SET query_plan_remove_unused_columns = 1;

SELECT count() FROM (SELECT 1 FROM t_pr_name_clash LIMIT 500);

DROP TABLE t_tuple_subcolumn_default;

-- Empty selection and all-false flags must give NaN (no rows accumulated).
SELECT 'empty', isNaN(varSamp(v)), isNaN(kurtPop(v)), isNaN(corr(v, v)) FROM (SELECT toFloat64(number) AS v FROM numbers(100) WHERE number > 100);

DROP TABLE IF EXISTS ttl_delete_where_recalc;

ALTER TABLE clear_column_materialized_chain MATERIALIZE COLUMN m2 SETTINGS mutations_sync = 2;

SELECT m2, count() FROM derived_materialized_projection_index
GROUP BY m2 ORDER BY m2
SETTINGS optimize_use_projections = 0;

ALTER TABLE clear_column_unrelated_materialized_index MODIFY COLUMN other Int64 MATERIALIZED 2 SETTINGS mutations_sync = 2;

SET join_overflow_mode = 'throw';

-- Regression test for PR #97522: non-deterministic uncompressed_hash in compact
-- MergeTree parts with multiple distinct compression codecs.
--
-- MergeTreeDataPartWriterCompact::addToChecksums iterates a streams_by_codec map
-- when computing each part's uncompressed_hash. Before the fix this was a
-- std::unordered_map with non-deterministic iteration order, so two identical
-- parts could get different uncompressed_hash values. The fix uses std::map.
--
-- Deduplication is disabled here so the two identical inserts stay as two separate
-- compact parts, and we assert their uncompressed_hash values are identical. This
-- targets system.parts.uncompressed_hash_of_compressed_files, which still consumes
-- the checksum path today (unlike insert deduplication, which now hashes the block).

DROP TABLE IF EXISTS t_04548_mc_dedup;

SELECT 'inequalities, ie_join last', count() > 0 FROM (EXPLAIN SELECT count() FROM prio_l l JOIN prio_r r ON l.x < r.x AND l.y > r.y) WHERE explain LIKE '%IEJoin%';

INSERT INTO t_part_storage_type_wide VALUES (1, 'a');

-- mixed nullability: one side Nullable elements, the other not
SELECT [1]::Array(Nullable(UInt64)) =  [1]::Array(Int64);

SELECT isNotDistinctFrom([NULL], [[1]]), isDistinctFrom([NULL], [[1]]);

-- An expression over both sides as the residual
SELECT 'both-sides expression', (
    SELECT arraySort(groupArray((lid, rid))) FROM (
        SELECT l.id AS lid, r.id AS rid
        FROM tlr l FULL JOIN trr r ON l.x < r.x AND l.y > r.y AND l.z + r.z > 8
    )
) = (
    SELECT arraySort(groupArray((lid, rid))) FROM (
        SELECT l.id AS lid, r.id AS rid FROM tlr l, trr r WHERE l.x < r.x AND l.y > r.y AND l.z + r.z > 8
        UNION ALL
        SELECT id, toUInt32(0) FROM tlr
        WHERE id NOT IN (SELECT l.id FROM tlr l, trr r WHERE l.x < r.x AND l.y > r.y AND l.z + r.z > 8)
        UNION ALL
        SELECT toUInt32(0), id FROM trr
        WHERE id NOT IN (SELECT r.id FROM tlr l, trr r WHERE l.x < r.x AND l.y > r.y AND l.z + r.z > 8)
    )
);

INSERT INTO t_lc_shared_dict_compact
SELECT
    number,
    toString(number % 10),
    multiIf(number % 3 = 0, NULL, number % 3 = 1, CAST(concat('s', toString(number % 10)), 'Variant(LowCardinality(String), UInt64)'), CAST(number, 'Variant(LowCardinality(String), UInt64)')),
    (toString(number % 10), number)
FROM numbers(100000);

-- The abort only reproduces with the whole plan built on the local initiator.
SET prefer_localhost_replica = 1;

DROP TABLE t_virtual_row_distinct;

DROP TABLE IF EXISTS tsl;

CREATE TABLE t_big (k UInt64) ENGINE = MergeTree ORDER BY k;

SELECT l.id FROM tel l LEFT ANTI JOIN ter r ON l.x < r.x AND l.y > r.y AND l.n <= r.n ORDER BY ALL;

DROP TABLE t_json_shared_data_ownership;

-- ASOF join stays on the ASOF path (its ON has an equality plus one inequality)
SELECT 'asof not routed', count() FROM (EXPLAIN SELECT * FROM neg_l l ASOF JOIN neg_r r ON l.k = r.k AND l.t >= r.t) WHERE explain LIKE '%IEJoin%';

SELECT 'left', (
    SELECT count() FROM sp_l l LEFT JOIN sp_r r ON l.x < r.x AND l.y > r.y
) = (
    SELECT (SELECT count() FROM sp_l l, sp_r r WHERE l.x < r.x AND l.y > r.y)
         + (SELECT count() FROM sp_l)
         - (SELECT uniqExact(l.id) FROM sp_l l, sp_r r WHERE l.x < r.x AND l.y > r.y)
) AS ok, (SELECT count() FROM sp_l l LEFT JOIN sp_r r ON l.x < r.x AND l.y > r.y) AS cnt;

-- The outer/anti fallback is the block nested loop join, which evaluates the same comparison.
SELECT 'tuple anti',
    (SELECT count() FROM ttk_l l LEFT ANTI JOIN ttk_r r ON l.tn > r.tn AND l.y < r.y)
  = (SELECT count() FROM ttk_l l WHERE l.id NOT IN (SELECT l.id FROM ttk_l l, ttk_r r WHERE l.tn > r.tn AND l.y < r.y)) AS ok;

-- Set operators (UNION / UNION ALL / UNION DISTINCT / EXCEPT / INTERSECT) inside a subquery must work
-- in the predicate and in the assignment expressions of DELETE and ALTER UPDATE mutations.
-- Regression test for https://github.com/ClickHouse/ClickHouse/issues/72853

DROP TABLE IF EXISTS t_union_mut;

TRUNCATE TABLE t_union_lwu;

DROP TABLE ie_sj_inner;

insert into test_200_parts select number, number*100 from numbers(1e6) settings max_partitions_per_insert_block=200, max_block_size=1e6;

SELECT toDateTimeOrNull(toUInt64(18446744073709551615), 'UTC'), toDateTimeOrNull(toInt64(-9223372036854775808), 'UTC');

-- Regression: a detached `Remote` storage engine table with explicit columns over a local-shard
-- table-function target must be re-attachable with a short `ATTACH TABLE t` even when the target's
-- source table is gone. The short form reads the definition back from the metadata stored on this
-- server (it cannot carry a fresh definition), so it must trust the persisted columns instead of
-- re-analyzing the table-function target (which would throw because the source is gone).
--
-- Before the fix, a short `ATTACH` reached `StorageFactory` with `LoadingStrictnessLevel::ATTACH`,
-- which `isLoadingFromExistingMetadata` does not cover, so the table-function target was re-analyzed
-- and re-attaching a valid table failed.

DROP TABLE IF EXISTS remote_short_attach_src SYNC;

CREATE VIEW v_window_params AS
    SELECT sum(x) OVER w AS s FROM t_window_params
    WINDOW w AS (ORDER BY x ROWS BETWEEN {frame:UInt8} PRECEDING AND CURRENT ROW)
    ORDER BY s;

CREATE TABLE pfsmj_fb_left_lc (k LowCardinality(String), lv UInt8) ENGINE = MergeTree ORDER BY tuple();

-- None of the rejected statements changed the stored deadline or left a user behind.
SELECT count() FROM system.users WHERE name = 'user_04602_valid_until';

SELECT
    (SELECT sum(s), count() FROM (SELECT toUInt32(b % 100000) AS k, sum(b) AS s FROM test GROUP BY k SETTINGS enable_adaptive_aggregator = 0))
    =
    (SELECT sum(s), count() FROM (SELECT toUInt32(b % 100000) AS k, sum(b) AS s FROM test GROUP BY k SETTINGS enable_adaptive_aggregator = 1));

SELECT 'uniqExact (aggregate states with arena allocations)';

SELECT 'Empty table';

-- Absolute-value guard: self-comparing cells cannot catch a defect shared by both paths, so pin
-- two adaptive results to analytically-known values over deterministic data.
SELECT 'Analytic guard: count per key over numbers_mt';

CREATE TABLE tb (kb UInt8) ENGINE = Memory;

SELECT '=== describe: COLUMNS(col) identifier-list form stays bare, setting ON ===';

SELECT '=== describe: COLUMNS(qualified) keeps the written name, setting ON ===';

-- Different data: must NOT be deduplicated, count reaches 8.
INSERT INTO t SETTINGS async_insert = 1, wait_for_async_insert = 1, async_insert_deduplicate = 1
VALUES (0,'E'),(1,'F'),(2,'G'),(3,'H');

SELECT bitmaskToArray(bitShiftLeft(toUInt128(1), 127));

SET analyzer_compatibility_join_using_top_level_identifier = 0;

SELECT '-- offset 3 alone over 3 + 2 rows: return 2';

SELECT
    countIf(explain LIKE '%ParallelReplicasSplit%') > 0 AS has_split,
    countIf(explain LIKE '%Union%') > 0 AS has_union,
    countIf(explain LIKE '%ReadFromMergeTree%') > 0 AS has_read,
    countIf(explain LIKE '%ReadFromParallelReplicas%') > 0 AS has_remote_read
FROM (EXPLAIN optimize = 1, description = 0 SELECT count(), sum(a) FROM v_pr_novf);

DROP TABLE tab_sz3_non_finite;

SELECT
    (SELECT count(), sum(c), sum(sm) FROM (SELECT k, count() AS c, sum(k) AS sm FROM test_skew GROUP BY k SETTINGS enable_adaptive_aggregator = 0))
    =
    (SELECT count(), sum(c), sum(sm) FROM (SELECT k, count() AS c, sum(k) AS sm FROM test_skew GROUP BY k SETTINGS enable_adaptive_aggregator = 1));

-- R4: shadowing variant; the alias `id` shadows the real column `id`, so the shard joins by the real column and returns `0`, deliberately differing from the local result of `11`.
CREATE TABLE t_shadow2 (x UInt64, id UInt64) ENGINE = MergeTree ORDER BY x;

-- The same logical schema and data, direct-encoded.
SELECT '-- char/string union, direct-encoded';

DROP VIEW v_force_index_pr_pb;

-- In the mantissa-truncation regime (precision > exponent bits) the all-zero cell is collapsed back to zero, but the
-- test for the zero cell must be made after masking off the sign bit: `-0.0` keeps only the sign bit, so a naive
-- `word != 0` check would OR the centre fill into it and reconstruct a non-zero negative subnormal instead of a signed
-- zero. Read the reconstructed first coordinate back through a dot product with a unit reference: a stored `-0.0` must
-- reconstruct to exactly 0. For Float64 the subnormal is directly visible (before the fix this returned the subnormal
-- -2^-1023 ~ -1.11e-308); for BFloat16/Float32 the SIMD kernels flush subnormals to zero, but the reconstruction was
-- equally wrong. The reviewer's cosine repro of two identical signed-zero vectors is then 0 (identical, not dissimilar).
SELECT '-- Signed zero (-0.0) reconstructs to a zero, not a subnormal (mantissa-truncation regime)';

-- Stop background merges so the pre-merge assertion below sees the data after exactly one lossy pass.
-- Otherwise a background merge could fire between the second INSERT and that SELECT, recompress the
-- column through the lossy codec, and inflate the error past the one-pass bound, making the test flaky.
SYSTEM STOP MERGES tab_sz3_lorenzo_reg;

SELECT 'Thaw: String key and String aggregate state';

-- A plain literal reference vector with parallel replicas, reading from remote replicas only.
SELECT id FROM qbit_pr_const
ORDER BY cosineDistanceTransposed(qb, [toFloat32(0), 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31], 16) ASC, id ASC
LIMIT 3
SETTINGS enable_parallel_replicas = 1, automatic_parallel_replicas_mode = 0, max_parallel_replicas = 3,
         cluster_for_parallel_replicas = 'test_cluster_one_shard_three_replicas_localhost',
         parallel_replicas_for_non_replicated_merge_tree = 1, parallel_replicas_local_plan = 0,
         parallel_replicas_min_number_of_rows_per_replica = 0;

-- VALID FOR resolves to a deadline the interval away from now.
CREATE USER user_04606_no_auth IDENTIFIED WITH no_authentication VALID FOR INTERVAL 1 DAY;

SELECT length(valid_until),
       valid_until[1] = valid_until[2],
       valid_until[1] BETWEEN now() + INTERVAL 23 HOUR AND now() + INTERVAL 25 HOUR
FROM system.users WHERE name = 'user_04607_valid_for';

-- The distributed result must match the single-node plan.
SELECT 'distributed', count(), sum(s), min(k), max(k) FROM (
    SELECT k, sum(c) AS s, any(name)
    FROM (SELECT k, count() AS c, intDiv(k, 100) AS g FROM t_bk_fact GROUP BY k) AS f
    JOIN t_bk_dim AS d ON f.g = d.g
    GROUP BY k
    SETTINGS make_distributed_plan = 1, enable_cascades_optimizer = 1,
             distributed_plan_force_shuffle_aggregation = 1, enable_join_runtime_filters = 0,
             distributed_plan_execute_locally = 1
);

CREATE TABLE bf_dim_cap (k UInt64, tag String) ENGINE = MergeTree ORDER BY k;

-- The full transform keeps the exact C_9 path (output length == input length, no padding), whether
-- output_dims is omitted or set explicitly to the input length.
SELECT length(randomHadamardTransform(CAST(range(18), 'Array(Float32)'))),
       length(randomHadamardTransform(CAST(range(18), 'Array(Float32)'), 0, 18)),
       length(randomHadamardTransform(CAST(range(1152), 'Array(Float32)'))),
       length(randomHadamardTransform(CAST(range(1152), 'Array(Float32)'), 0, 1152));

-- CREATE USER: user-level VALID FOR with an explicit method-level VALID FOR.
-- Method 1 takes the user-level 1 day; method 2 keeps its own 30 days.
CREATE USER user_04611_b
    VALID FOR INTERVAL 1 DAY
    IDENTIFIED WITH plaintext_password BY 'p1',
                    plaintext_password BY 'p2' VALID FOR INTERVAL 30 DAY;

-- Lightweight DELETE goes through the same mutation preparation.
DELETE FROM t_alias_in_set WHERE label = 'YES';

DROP TABLE IF EXISTS t_gt;

SELECT count() FROM t_nul_gt WHERE toFixedString('abc', 257) = p;

INSERT INTO t_lcn_skip SELECT if(number < 9000, 'abc', concat('x', toString(number))) FROM numbers(10000);

SELECT '-- inner, multi-column key, first column with duplicate runs';

SELECT 'full_sorting_merge';

DROP TABLE anti_dim;

INSERT INTO t_04612_part SELECT number, number FROM numbers(20);

DROP TABLE t_lc_pk_pending;

ALTER TABLE t_mutation_pruning_exotic UPDATE y = 10 WHERE _part LIKE '202402%';

SELECT randomHadamardTransform(CAST(range(7), 'Array(Float32)'), 1) = randomHadamardTransform(CAST(range(7), 'Array(Float32)'), 2);

SELECT count() FROM t_str_int WHERE g >= 'novel' AND r = 3;

INSERT INTO t_both_rev SELECT 1 + intDiv(number, 3), 1 + number % 3 FROM numbers(9);

SELECT 'binary search over many granules';

SELECT count() FROM t_nofinal WHERE g = 2 AND r = 1 SETTINGS use_lightweight_primary_key_index_analysis = 1;

CREATE TABLE t_unloaded (a UInt16, b UInt16, c UInt16)
ENGINE = MergeTree ORDER BY (a, b DESC, c)
SETTINGS index_granularity = 4,
         primary_key_ratio_of_unique_prefix_values_to_skip_suffix_columns = 0.01;

CREATE TABLE t_asc (g String, r Int8) ENGINE = MergeTree ORDER BY (g, r);

SELECT trimLeft(explain) FROM (EXPLAIN indexes = 1, actions = 0, pretty = 0 SELECT count() FROM t_nan_asc WHERE g = 1 AND r = 5 SETTINGS use_lightweight_primary_key_index_analysis = 0, enable_parallel_replicas = 0) WHERE explain LIKE '%Condition%' OR explain LIKE '%Parts%' OR explain LIKE '%Granules%' OR explain LIKE '%Search Algorithm%';

SELECT countIf(org = 'org_z' AND dt < toDateTime('2026-06-10', 'UTC')) FROM t_ranges;

-- The same fall-through must work when the compat setting prunes JOIN resolution by qualifier.
SELECT {CLICKHOUSE_DATABASE_1:Identifier}.tbl.value
FROM {CLICKHOUSE_DATABASE:Identifier}.{CLICKHOUSE_DATABASE_1:Identifier}
JOIN {CLICKHOUSE_DATABASE_1:Identifier}.tbl USING (id)
SETTINGS analyzer_compatibility_prefer_alias_over_subcolumn = 1;

ALTER TABLE ts_version MODIFY SETTING tags_deduplication_cache_expiration_seconds = 600;

DROP TABLE ts_version_2;

-- equals against a NULL-valued constant inside an AND chain.
SELECT 'equals_null_variant';

OPTIMIZE TABLE t_ttl_single_default FINAL;

-- `identity` prevents constant folding, so the sorting expression remains `ColumnConst`.
CREATE TABLE constant_sort_key_single (payload UInt64)
ENGINE = MergeTree
ORDER BY identity(1);

SELECT count() FROM system.dictionaries WHERE database = currentDatabase() AND name IN ('dict_then_view', 'dict_then_table');

-- Tag no-fasttest: Depends on AWS

-- The `deletes_db/eq_deletes_table` fixture has 1010 data rows, 30 position deletes and
-- equality deletes that remove 99 more rows, leaving 881 live rows. Its snapshot summary
-- claims `total-records = 1010`. An equality delete file records delete predicates, not
-- the number of data rows they match, so no metadata can produce an exact count: the
-- trivial count optimization must NOT be applied and count() must fall back to a real
-- scan that applies the equality delete transformers.

-- Must return the live row count, not 1010 (summary) and not 980 (data rows minus
-- position deletes only). `optimize_count_from_files` is pinned ON: the count-only fast
-- path feeds synthetic default-valued chunks to the equality-delete FilterTransform (its
-- predicate then matches the wrong rows), so it must be demoted to a real read for files
-- with attached deletes -- with a regression there this query returns 1010, not 881.
-- The settings are pinned because the test runner randomizes them.
SELECT count() FROM icebergS3(s3_conn, filename = 'deletes_db/eq_deletes_table')
    SETTINGS optimize_trivial_count_query = 1, optimize_count_from_files = 1, use_cache_for_count_from_files = 1;

-- A table named select is not the SELECT keyword either: its own alias without AS keeps working
DROP TABLE IF EXISTS `select`;

SELECT '-- AGGREGATE of the whole table';

FROM orders |> SELECT customer |> UNION ALL (SELECT 'bob') |> WHERE customer = 'bob' |> AGGREGATE count() AS c;

-- When the query continues with a clause that a query-level OFFSET cannot precede, there is no
-- ambiguity and SELECT stays optional
FROM sampled SAMPLE 1 OFFSET 0 WHERE id > 8;

EXPLAIN SYNTAX oneline = 1 WITH 100 AS threshold FROM orders |> WHERE amount >= threshold |> AGGREGATE count() AS c;

DROP ROW POLICY IF EXISTS rp_atf ON t_atf_rp;

SELECT toTypeName(valid_until), toYear(valid_until[1]), toUnixTimestamp64Second(valid_until[1]) FROM system.users WHERE name = 'user_04613_valid_until';

CREATE NAMED COLLECTION ai_embed_remote_http AS
    provider = 'openai', endpoint = 'http://ai.example.com/v1/embeddings', api_key = 'fake-key';

SELECT '-- UNION CTE body';

-- no-fasttest: needs the async insert queue to coalesce several entries into one flush.

-- Two identical async-insert entries (no user token, data-hash path), each spanning two
-- partitions, coalesced into one flush. Self-deduplication must drop the second token, and
-- the per-partition block rewrite must keep only the current partition's rows: the
-- deduplication-retry chain ends with `SelectPartitionTransform`, so a row of another
-- partition must never leak into this partition's part.

DROP TABLE IF EXISTS dedup_identical_multi_partition;

SELECT arrayMap(x -> length(finalizeAggregation(x)), t.1), arrayMap(x -> length(finalizeAggregation(x)), t.2) FROM (SELECT groupArrayStateResampleTuple(0, 2, 1)((number, number + 1), (number % 2, number % 2)) AS t FROM numbers(2000)) SETTINGS max_threads = 1;

-- Surviving rows keep their physical row numbers, with gaps at the deleted positions.
-- The rows with `id < 10` are the second batch of the table: two data files with `id` 0..4
-- and 5..9 at physical rows 0..4 of each file. An equality delete removes `id = 3` and
-- `id = 9`, so `id = 4` must keep the physical row number 4 (not get renumbered to 3).
SELECT id, _row_number FROM icebergS3(s3_conn, filename = 'deletes_db/eq_deletes_table') WHERE id < 10 ORDER BY id;

INSERT INTO t_probe_nullable SELECT if(number % 50 = 0, NULL, toInt32(number % 250)) FROM numbers(20000);

INSERT INTO rf_dim SELECT number * 16 + 8  FROM numbers(500);

CREATE TABLE projection_batch_04614 AS projection_default_04614
ENGINE = MergeTree
ORDER BY k
SETTINGS
    merge_use_batch_sorting_queue = 1,
    enable_vertical_merge_algorithm = 1,
    vertical_merge_algorithm_min_rows_to_activate = 1,
    vertical_merge_algorithm_min_bytes_to_activate = 0,
    vertical_merge_algorithm_min_columns_to_activate = 1,
    index_granularity = 8,
    index_granularity_bytes = 0,
    merge_max_block_size = 64,
    max_bytes_to_merge_at_max_space_in_pool = 1,
    min_bytes_for_wide_part = 0,
    min_rows_for_wide_part = 0;

CREATE TABLE t_pr_tlu_1 (a UInt64) ENGINE = MergeTree ORDER BY a;

SELECT sum(k = finalizeAggregation(s)) FROM t_uniq_states;

SELECT isNull(UTMToGeo(easting, 5411935.13, 31, 'U')) FROM values('easting Nullable(Float64)', (NULL), (448251.6));

SELECT formatQueryFromJSON('{"type":"ShowColumnsQuery","table":"t","case_insensitive_like":true}');

DROP TABLE rf_shared_dim;

-- len_range and string_range.
_msg:len_range(1, 30) | fields _msg | sort by (_msg);

* | stats count() if (level:error) as errors, count() as total;

-- extract_regexp
* | extract_regexp "user=(?P<username>[a-z]+)" | fields username | sort by (username);

* | stats json_values(level) limit 5 as all_levels;

DROP VIEW date_pv_ctas;

-- `ParserStreamSettings` produces `cursor_tree` only as a flat `Map` of `(String path, unsigned
-- integer leaf)` tuples, and `buildCursorTree` relies on that shape via `safeGet`. Malformed
-- payloads must fail with `BAD_ARGUMENTS` at deserialization, not inside formatter/analyzer code.
SELECT formatQueryFromJSON(parseQueryToJSON('SELECT * FROM t STREAM CURSOR {''a'': {''b'': 10}, ''c'': 20}'));

INSERT INTO t_json_key_safety SELECT number, toJSONString(map('a', number)) FROM numbers(64);

SELECT formatQueryFromJSON(parseQueryToJSON('CREATE TABLE t (id Int32 AUTO_INCREMENT) ENGINE = MergeTree ORDER BY tuple()'))
     = formatQuerySingleLine('CREATE TABLE t (id Int32 AUTO_INCREMENT) ENGINE = MergeTree ORDER BY tuple()');

SELECT countIf(explain LIKE '%ReadFromParallelReplicas%') > 0 AS has_remote_read
FROM (EXPLAIN optimize = 1, description = 0 SELECT count() FROM mv_pr_append);

CREATE TABLE t_jit_nothing (uid Int16, age Int16) ENGINE = MergeTree ORDER BY tuple();

SELECT t FROM format(CustomSeparated, 't DateTime64(3)', '''2023-12-23 20:37:33.035''\n')
SETTINGS format_custom_escaping_rule = 'Quoted';

DROP TABLE IF EXISTS detach_fsync_packed_proj;

INSERT INTO t_delete_in_partition_rocksdb VALUES (1, 'a'), (2, 'b');

-- Shadowing a constant aggregate-state column with a compatible constant of a different aggregate
-- function under the same alias. The planner compares the constant values of the same-name INPUT
-- and COLUMN nodes when finalizing an actions chain step, and the plain `Field` comparison of the
-- aggregate states throws for different function names. Such constants must compare as different
-- without throwing, so that the redefinition is preserved.
SELECT finalizeAggregation(s) FROM
(
    SELECT arrayReduce('quantilesState(0.9)', [1]) AS s
    FROM
    (
        SELECT arrayReduce('quantileState(0.5)', [1]) AS s
    )
);

-- 2) The optimizer still runs on such a `Nothing`-collapsed AND: the directly-Nullable operand is
--    kept as-is (the new opaque-filter fallback) while a redundant non-null comparison in the SAME
--    AND is still folded. In `x > 3 AND x > 5`, `x > 3` is redundant and pruned, so exactly one
--    `greater` survives when enabled against both when disabled. Pin both counts: a relative
--    comparison also holds when the predicates disappear entirely.
SELECT count() = 1 FROM (EXPLAIN QUERY TREE SELECT tuple((materialize(toNullable(NULL)) = 1) AND (materialize(toInt32(5)) > 3) AND (materialize(toInt32(5)) > 5) AND (assumeNotNull(materialize(toNullable(NULL))) = 2)) SETTINGS optimize_redundant_comparisons = 1) WHERE explain LIKE '%function_name: greater,%';

SELECT 1 FROM t_and_chain_array_join AS tx ARRAY JOIN [] AS a0 LEFT JOIN t_and_chain_array_join AS t2 ON (t2.c0 = a0) AND (toNullable(t2.c0) > 0) SETTINGS optimize_and_compare_chain = 0, optimize_redundant_comparisons = 1;

CREATE TABLE t_ok_04626 AS remote('127.0.0.1', currentDatabase(), 'base_04626');

SELECT toDate32(-1000000);

SELECT 'changeDate';

CREATE TABLE t_lwu_key_column_default (a UInt64, v String)
ENGINE = MergeTree
PRIMARY KEY a
ORDER BY a
SETTINGS enable_block_number_column = 1, enable_block_offset_column = 1, patch_parts_version = 'v2';

SET param_date = '2026-06-25';

ATTACH TABLE t_mutation_param_tuple1;

-- Compatibility setting for the fix of FINAL leaking onto other tables of a JOIN
-- (https://github.com/ClickHouse/ClickHouse/pull/108979).

-- The setting `analyzer_compatibility_apply_final_to_all_joined_tables` has an effect only when
-- the analyzer is enabled. The old analyzer has different semantics of FINAL in JOIN (it ignores
-- FINAL on the right table), so pin the analyzer explicitly.

DROP TABLE IF EXISTS t_left;

DROP DICTIONARY IF EXISTS dict_empty;

SELECT t.pref, dd.v FROM (SELECT CAST('', 'Nullable(String)') AS pref) AS t
LEFT JOIN dict_empty AS dd ON t.pref = dd.k;

INSERT INTO traces_04627 VALUES ('cluster1', 1, 'trace007');

SELECT 'wide base rows', count() FROM t_lwd_norm_proj_wide;

-- Projection that references no column: the source block must still carry the surviving row count.
DROP TABLE IF EXISTS t_lwd_count_proj;

DETACH TABLE 04627_unreachable;

INSERT INTO pfsmj_vr_c SELECT number * 2, number FROM numbers(5000);

CREATE TABLE t_04627_coalescing (k UInt32, s Int64)
ENGINE = CoalescingMergeTree ORDER BY k SETTINGS optimize_on_insert = 0;

SELECT count() FROM t_null_const_set_index WHERE (v = 1 AND toUInt8OrNull('x')) OR v < 50;

-- prometheusQuery: Nullable(String) / LowCardinality(String) accepted for table, promql and database args
SELECT value FROM prometheusQuery(CAST('ts', 'Nullable(String)'), '1 + 2', 1000);

-- The derived comparison appears wrapped in `indexHint` in the analyzed tree.
SELECT 'derived_as_hint';

DROP TABLE t_chain_hint_r;

CREATE TABLE base_dlk_2 (key Int, value Int) ENGINE = MergeTree ORDER BY key;

DROP TABLE IF EXISTS rk_fact_desc_second;

-- Per shape, prove both predicate shapes engaged and that the range branch really ran rather than
-- silently falling back to the IN-set. Because the two hot values are far apart, the exact IN-set
-- prunes every granule outside {10, 90} while the [10, 90] range keeps the whole span, so the range
-- path must drop strictly fewer granules than the IN-set path and still drop at least one. A silent
-- IN-set fallback would make the two counts equal; a wrongly-inverted reverse-key range would drop
-- nothing.
SELECT shape,
    maxIf(dropped, is_in) > 0 AS in_prunes,
    maxIf(dropped, NOT is_in) > 0 AS range_prunes,
    maxIf(dropped, NOT is_in) < maxIf(dropped, is_in) AS range_drops_fewer
FROM
(
    SELECT
        replaceRegexpOne(log_comment, '^04628_(in|range)_', '') AS shape,
        log_comment LIKE '04628\_in\_%' AS is_in,
        argMax(ProfileEvents['RuntimeFilterGranulesDropped'], event_time) AS dropped
    FROM system.query_log
    WHERE current_database = currentDatabase()
        AND log_comment IN ('04628_in_desc_second', '04628_in_desc_first', '04628_in_desc_single',
                            '04628_range_desc_second', '04628_range_desc_first', '04628_range_desc_single')
        AND type = 'QueryFinish'
    GROUP BY log_comment
)
GROUP BY shape
ORDER BY shape;

SELECT 'mixed';

-- OR -> IN: aggregate (windowFunnel + -Null combinator) parent, mirroring the fuzzer query.
SELECT windowFunnel(1)(toUInt8(1), (b = '10') OR (b = '22') OR (b = '6')) FROM t_var GROUP BY x ORDER BY x;

SELECT count() FROM t_dt WHERE (d != toDateTime('2020-01-01 12:00:00', 'UTC')) AND (d != toDateTime('2020-01-02 12:00:00', 'UTC')) AND (d != toDateTime('2020-01-03 12:00:00', 'UTC'))
SETTINGS optimize_min_inequality_conjunction_chain_length = 100;

SYSTEM STOP MERGES t_multistep_prewhere_subcolumn;

SELECT '--- PREWHERE TopK still returns the planted row';

-- Distributed aggregation cannot enforce a global max_rows_to_group_by, and the functional-test
-- profile sets it nonzero, so pin it off. Trivial-count would fold the aggregation away.
SET make_distributed_plan = 1, enable_parallel_replicas = 0,
    distributed_plan_execute_locally = 1, distributed_plan_max_rows_to_broadcast = 0,
    max_rows_to_group_by = 0, optimize_trivial_count_query = 0;

SELECT t FROM format(Regexp, 't DateTime64(3)', '1703363853035\n');

SELECT 'arm-local filter reset does not affect the union';

-- Compensated summation keeps samples far below the running sum: a plain Float64 sum of 1e16 and four 1s
-- gives 1e16, the compensated one gives 1e16 + 4.
SELECT 'compensated sum and avg keep the small samples beside a large one (all 1):';

SELECT toStartOfWeek(toDate32('1970-01-01') - INTERVAL 2147483647 DAY, 0), toLastDayOfWeek(toDate32('1970-01-01') - INTERVAL 2147483647 DAY, 0);

ATTACH TABLE v_union_intersect_distinct;

SELECT * FROM v_standalone_intersect ORDER BY all;

-- Check that -Merge returns the same result as computing directly on the original table
SELECT timeSeriesStddevToGrid(90, 210, 15, 45)(timestamp, value) FROM ts_raw_data;

SELECT timeSeriesStdvarToGrid(100, 100, 1, 10)([92, 98, 98]::Array(UInt32), [1, 3, 5]::Array(Float32));

-- Positive cases: legitimate finalization still works.
SELECT '-- single homogeneous state';

CREATE TABLE t_multistep_prewhere_default_patch (k UInt32, s String) ENGINE = MergeTree ORDER BY tuple()
SETTINGS enable_block_number_column = 1, enable_block_offset_column = 1;

-- The `index` slot of a projection declaration is parser-produced only as a non-empty
-- `ASTExpressionList` (`ParserProjectionDeclaration` uses `ParserNotEmptyExpressionList`). With
-- `TYPE commit_order`, `ProjectionIndexCommitOrder::fillProjectionDescription` clones `index` into
-- the projection SELECT slot, and `ASTProjectionSelectQuery::cloneToASTSelect` raises an internal
-- error unless that slot is an `ASTExpressionList`, so `readJSON` must reject any other shape at
-- the deserialization boundary.

-- Parser-produced shapes round-trip byte-identically.
SELECT formatQueryFromJSON(parseQueryToJSON('CREATE TABLE t (a UInt64, PROJECTION p INDEX a TYPE commit_order) ENGINE = MergeTree ORDER BY a'));

SELECT b FROM t_dv;

INSERT INTO shard_1.t VALUES (20, 2), (40, 5);

INSERT INTO t_prewhere_guard_map
SELECT number,
       if(number % 3 = 0, map('safe', '', 'val', 'not a number'), map('safe', 'y', 'val', toString(number % 100))),
       repeat('x', 200)
FROM numbers(100000);

SELECT 'non throwing map conditions are rewritten to subcolumns';

SELECT 'runtime filter reaches the LowCardinality probe side read';

SELECT formatQueryFromJSON(parseQueryToJSON('OPTIMIZE TABLE t PARTITION {p:String}'));

-- Positive control: without a time limit the same eligible query writes its block.
INSERT INTO t_04633_break_writes_nothing
SELECT number FROM numbers(4)
SETTINGS async_insert = 1, wait_for_async_insert = 1, async_insert_select_as_async_insert = 1,
         max_block_size = 4, max_threads = 1;

SELECT
    variantType(g2) AS t,
    areaCartesian(g2) AS area,
    perimeterCartesian(g2) AS perimeter
FROM
(
    SELECT CAST(g, 'Geometry') AS g2
    FROM
    (
        SELECT arrayJoin([
            CAST((0., 0.)::Point, 'Variant(Ring, Polygon, Point, MultiPoint)'),
            CAST([(1., 2.), (3., 4.)]::MultiPoint, 'Variant(Ring, Polygon, Point, MultiPoint)'),
            CAST([[(0., 0.), (4., 0.), (4., 4.), (0., 4.), (0., 0.)]]::Polygon, 'Variant(Ring, Polygon, Point, MultiPoint)'),
            CAST([(0., 0.), (4., 0.), (4., 4.), (0., 4.), (0., 0.)]::Ring, 'Variant(Ring, Polygon, Point, MultiPoint)')
        ]) AS g
    )
);

ALTER TABLE t_skip_empty_rename_drop RENAME COLUMN b TO c, DROP COLUMN c, ADD COLUMN c UInt64 DEFAULT 999;

SELECT toTypeName(u), u FROM format(ORC, 'u Variant(Int8, Int64)', unhex('4f52430a061204080350000a0a0a0200001204080350000a120a020000120c080212060809100c180250000a210a020000121b08011215089693d89fee47109693d89fee47189693d89fee475000fd000100fefb067a00023ee3f609960a060806100018080a0608061001180c0a060806100218140a060806100318230a060801100118040a060801100218030a060801100318081204080010001204080010001204080010001204080210001a03474d540a370a04080350000a04080350000a0c080212060809100c180250000a1b08011215089693d89fee47109693d89fee47189693d89fee475000080310af011a0a0803104b180f20552803220e080c1201011a0175200028003000220c080d12020203200028003000220808012000280030002208080420002800300030033a04080350003a04080350003a0c080212060809100c180250003a1b08011215089693d89fee47109693d89fee47189693d89fee47500040904e48016205322e322e320888011000188080042202000c2839300682f403034f524318'));

-- The Settings and asynchronous_read_counters columns of system.query_log are written by
-- QueryLogElement::appendToBlock straight into the Map subcolumns. This asserts they still
-- serialize with the right contents and row alignment.

DROP TABLE IF EXISTS t_query_log_maps;

SELECT 'toYYYYMM outside the LUT range is rewritten to a key range';

SELECT toInt32(toTime(toInt256(-4000000)));

CREATE TABLE buf_dst (x UInt64) ENGINE = MergeTree ORDER BY x;

SELECT c0.a FROM t_buffer_dynamic_subcolumn WHERE c0.a = 7;

INSERT INTO t_exact_unloaded SELECT intDiv(number, 100), intDiv(number % 100, 10), number % 10 FROM numbers(1000);

OPTIMIZE TABLE t_exact_unloaded_rev FINAL;

SELECT t1.a, arrayMap(z -> sipHash64(t2.*), [1]) AS r FROM t1 LEFT JOIN t2 ON t1.a = t2.x ORDER BY t1.a SETTINGS join_use_nulls = 1;

SELECT '-- 9b. USING join is reconciled by its own mechanism, must not regress';

SELECT sum(sipHash64(b.*)) AS s, toTypeName(s) FROM t1 LEFT JOIN t2 AS b ON t1.a = b.x SETTINGS join_use_nulls = 1;

SELECT arrayMap(z -> tuple(a, v), [1]) AS r, toTypeName(r) FROM p1 FULL JOIN p2 USING (a) PREWHERE p1.v > 0 ORDER BY r SETTINGS join_use_nulls = 1;

DROP TABLE IF EXISTS aj1;

DROP TABLE p1;

SELECT '--- The TopK read of the same predicate still writes no QCC entry';

-- Ground truth: the row-scan spelling of the same predicate, with no index involved.
SELECT 'rowscan', count(), sum(id) FROM t_lazy_single_posting_segment WHERE hasToken(s, 'aaa') AND hasToken(s, 'bbb') SETTINGS use_skip_indexes = 0;

-- `query_plan_optimize_join_order_limit` is randomized in CI, and only 0 and 1 keep both children
-- of the enclosing join dummy-only, so it is pinned per statement.

DROP TABLE IF EXISTS t1;

SELECT 'left', count() FROM (SELECT l.id FROM t_04648 AS l LEFT JOIN t_04648 AS r ON l.id = r.id AND CAST(NULL AS Nullable(UInt8)));

DROP TABLE IF EXISTS t_stats_affected_materialized;

CREATE TABLE t_stats_materialize_index (id Int64, e Enum8('a' = 1, 'b' = 2) MATERIALIZED 'a' STATISTICS(uniq, basic))
ENGINE = MergeTree ORDER BY id SETTINGS min_bytes_for_wide_part = 1;

-- - no-parallel - global failpoint `prepared_sets_build_ordered_set_inplace_fail` and the shared query result cache
-- - no-fasttest - tests that run alone are kept out of the fast test

-- Regression test for "Not-ready Set is passed as the second argument" when the `IN` subquery result
-- also goes through the query result cache.
--
-- With `query_cache_for_subqueries = 1` the Planner wraps the subquery plan with
-- `StreamInQueryResultCacheStep` on the write path, and replaces the whole plan with
-- `ReadFromQueryResultCacheStep` on a cache hit. Neither step used to implement `clone`, so
-- `FutureSetFromSubquery::buildOrderedSetInplace` fell back to consuming the canonical `source` plan,
-- and a silent in-place build failure (forced here by the failpoint) left the set permanently unbuilt
-- so `FunctionIn` threw.
--
-- `StreamInQueryResultCacheStep::clone` copies the cache writer (same key, fresh buffer, so the two
-- plans cannot buffer the same rows twice) and `ReadFromQueryResultCacheStep::clone` replays the
-- cached chunks, so both shapes keep the source plan intact and the deferred
-- `DelayedCreatingSetsStep::makePlansForSets` can rebuild the set.

-- The subquery query result cache is not used with plan-based parallel replicas:
-- https://github.com/ClickHouse/ClickHouse/issues/131463
SET parallel_replicas_plan_based = 0;

-- The last assignment to the same parameter wins, on both paths.
SELECT * FROM 04648_pv(name = 'a', name = 'b');

SELECT 'LEFT SEMI', count() FROM jl_04648 LEFT SEMI JOIN jr_04648 ON jl_04648.id = jr_04648.id;

SELECT '--- three conjuncts, including a String column';

SELECT id FROM tab WHERE flag = 1 ORDER BY L2Distance(vec, [0., 0., 0.]) LIMIT 2 SETTINGS vector_search_with_rescoring = 1, use_query_condition_cache = 1;

SELECT toString(arrayJoin(c)) FROM (SELECT [map('a', 1)::JSON::Dynamic] AS c FROM numbers(2)) ORDER BY 1;

DESC format(CSV, '0.0');

DESC format(TSV, '0');

DESC format(TSV, '0001-01-01');

SELECT 'group 10: malformed exponent forms stay String, now via inference itself';

DESC format(TSV, '09') SETTINGS input_format_try_infer_integers = 0;

SELECT * FROM format(TSKV, 'x=0.5\n');

SELECT count(), sum(v) FROM t_ttl_group_by_consecutive_keys;

SELECT 'String keys under constant pressure';

SELECT '-- hash DISTINCT keeps binary identity: all four rows survive';

SELECT count(), sum(c), sum(cityHash64(lc, c)) FROM (SELECT toLowCardinality(s) AS lc, count() AS c FROM t_04649 GROUP BY lc)
    SETTINGS enable_packed_string_keys_in_aggregation = 1;

SELECT 'FULL remote', countIf(explain LIKE '%ReadFromParallelReplicas%') > 0
FROM (EXPLAIN optimize = 1, description = 0 SELECT count() FROM jd_l FULL JOIN jd_r ON jd_l.id = jd_r.id);

-- `GLOBAL IN` rewrites the argument into an external table. Before the fix, sharing the node with
-- the join tree made the rewrite collide on the generated `FROM` alias:
--   `Code: 179 Duplicate aliases __table2 for table expressions in FROM section are not allowed`
-- An identifier naming a join-tree table expression resolves through two distinct paths, the alias
-- map (`tryResolveIdentifierFromAliases`) and the table-expression lookup
-- (`tryResolveIdentifierFromTableExpression`), so all three spellings are exercised. Each of the
-- three aborted with `Code: 179` before the fix.
SELECT 'GLOBAL IN, subquery alias';

-- The shapes below come from the same sharing reached through `QUALIFY` on a `MergeTree` source;
-- before the fix they aborted with `Logical error: 'No set is registered for key ...'`.
CREATE TABLE t_04650_mt (y Int32) ENGINE = MergeTree ORDER BY y;

CREATE TABLE t1 (id Int64, grp Int64) ENGINE = Memory;

SELECT 'left join, LowCardinality repeated condition';

SET materialize_statistics_on_insert_max_table_size = 26843545600;

SELECT 'argmin-argmax', t, ok
FROM
(
    SELECT 'Int128' AS t, (argMin(number, x) = 1234) AND (argMax(number, x) = 5678) AS ok
    FROM (SELECT number, toInt128(if(number = 1234, -1000000, if(number = 5678, 1000000, 0))) AS x FROM numbers(100000))
    UNION ALL
    SELECT 'Decimal128', (argMin(number, x) = 1234) AND (argMax(number, x) = 5678)
    FROM (SELECT number, toDecimal128(if(number = 1234, -1000000, if(number = 5678, 1000000, 0)), 2) AS x FROM numbers(100000))
    UNION ALL
    SELECT 'UInt256', (argMinIf(number, x, number % 2 = 0) = 1234) AND (argMaxIf(number, x, number % 2 = 0) = 5678)
    FROM (SELECT number, toUInt256(if(number = 1234, 1, if(number = 5678, 1000000, 500))) AS x FROM numbers(100000))
)
ORDER BY t;

DROP TABLE IF EXISTS aio_mono;

SYSTEM STOP MERGES aio_desc_lead;

SYSTEM STOP MERGES aio_agree_1;

SELECT countIf(explain LIKE '%AggregatingInOrderTransform%') > 0 FROM (EXPLAIN PIPELINE SELECT a, b, sum(b) FROM aio_desc_lead GROUP BY a, b SETTINGS optimize_aggregation_in_order = 1);

SELECT countIf(explain LIKE '%DistinctSortedStreamTransform%') > 0 FROM (EXPLAIN PIPELINE SELECT DISTINCT a, b FROM aio_mixed SETTINGS optimize_distinct_in_order = 1);

DROP TABLE aio_pd;

-- Over a Nullable column the result is Nullable, NULLs are skipped, and a single
-- remaining value still gives NaN. The plain form and the wrapped forms agree, as they do for sum.
SELECT toTypeName(gini(x)), gini(x) FROM (SELECT [1, NULL, 3] :: Array(Nullable(Int32)) AS arr) ARRAY JOIN arr AS x;

DROP TABLE IF EXISTS m_cv_i8n;

SELECT 'c2 divide pos c<0 eq', (SELECT count() FROM t_cv_pos WHERE divide(toInt32(-1000), a) = -25) = (SELECT count() FROM m_cv_pos WHERE divide(toInt32(-1000), a) = -25);

SELECT 'c4 u64 hi pos', (SELECT count() FROM t_cv_i64p WHERE intDiv(toUInt64('9223372036854775808'), a) >= -461168601842738790) = (SELECT count() FROM m_cv_i64p WHERE intDiv(toUInt64('9223372036854775808'), a) >= -461168601842738790);

DROP TABLE IF EXISTS m_cv_zl;

SELECT 'c6 zero left le', (SELECT count() FROM t_cv_zl WHERE divide(toInt32(-1000), a) <= -50) = (SELECT count() FROM m_cv_zl WHERE divide(toInt32(-1000), a) <= -50);

SELECT 'c6 wrap pos eq 1', (SELECT count() FROM t_cv_u8 WHERE intDiv(toInt8(127), a) = 1) = (SELECT count() FROM m_cv_u8 WHERE intDiv(toInt8(127), a) = 1);

DROP TABLE IF EXISTS m_cv_d32p;

SELECT 'c5i d32 var eq', (SELECT count() FROM t_cv_d32p WHERE intDiv(toUInt32(3000000000), a) = -129496729) = (SELECT count() FROM m_cv_d32p WHERE intDiv(toUInt32(3000000000), a) = -129496729);

SELECT 'c7 float64 divide', (SELECT count() FROM t_cv_f64n WHERE divide(toInt32(-1000), a) = 25) = (SELECT count() FROM m_cv_f64n WHERE divide(toInt32(-1000), a) = 25);

DROP TABLE m_cv_nul;

SELECT 'c9ii ip key g8 intDiv', (SELECT count() FROM t_cv_ip8 WHERE intDiv(1, a) = 0) = (SELECT count() FROM m_cv_ip8 WHERE intDiv(1, a) = 0);

DROP TABLE m_cv_ip8;

SELECT s.a.b, s.a, f.a.b, f.a, d.a.b, d.a, m.a.b, m.a FROM t_04651_leaves;

DROP TABLE IF EXISTS pfsmj_topk_right;

SELECT 'inner/any non-leftmost under a left leftmost join: reads from remote replicas';

SELECT countIf(explain ILIKE '%ReadFromRemoteParallelReplicas%') FROM (
    EXPLAIN SELECT * FROM t1 ANY INNER JOIN t2 ON 1 ORDER BY ALL);

SELECT v1 FROM tab WHERE v2 IN (10000, 11000, 12000) ORDER BY v1 ASC LIMIT 5;

-- zookeeper: SYSTEM SYNC TRANSACTION LOG reads the transaction log from Keeper after access is granted.
-- no-parallel: creates a temporary user; avoid concurrent GRANT/DROP races on the same name pattern.

DROP USER IF EXISTS user_test_04651;

-- The values that were outside the old `[1900-01-01, 2299-12-31]` range are now ordinary values.
SELECT accurateCast(toInt32(-25568), 'Date32'), accurateCastOrNull(toInt32(-100000), 'Date32'), accurateCastOrNull(toInt64(10413792000), 'Date32');

SELECT 1 FROM view(SELECT t.p FROM (SELECT 1, 2) t(p, q)) ty;

SELECT 1 FROM view(SELECT t.p FROM (SELECT 1, 2) t(p, q) WHERE (t.p, t.q) IN (SELECT 1, 2)) ty SETTINGS rewrite_in_to_join = 1;

INSERT INTO t_key_arr64_04652 VALUES ([10,100]),([11,5]),([12,0]),([20,0]);

INSERT INTO t_mem_ntup_04652 VALUES ((10,100)),((11,5)),((12,0)),((20,0));

CREATE TABLE t_mem_arri8_04652 (a Array(Int8)) ENGINE = Memory;

-- A tiny divisor sends every element to `inf`, so element width is not a safe exemption either.
DROP TABLE IF EXISTS t_key_arri32_04652 SETTINGS ignore_drop_queries_probability = 0;

CREATE TABLE t_key_ovf_04652 (a Array(Int64)) ENGINE = MergeTree ORDER BY a SETTINGS index_granularity = 1;

-- A scalar `String` key with `INTERVAL` is the reason the check must test containerness directly
-- rather than `isValueRepresentedByNumber()`, which is false for `String` and would silently
-- disable this working pruning.
DROP TABLE IF EXISTS t_key_str_04652 SETTINGS ignore_drop_queries_probability = 0;

-- `multiply` over a compound key answered correctly before the fix and must keep doing so.
SELECT 'multiply(Array key, scalar const) answers', (SELECT count() FROM t_key_arr64_04652 WHERE multiply(a, toInt64(3)) = [toInt64(33), toInt64(15)]) AS keyed, (SELECT count() FROM t_mem_arr64_04652 WHERE multiply(a, toInt64(3)) = [toInt64(33), toInt64(15)]) AS oracle;

DROP TABLE t_key_arrnz_04652 SETTINGS ignore_drop_queries_probability = 0;

DROP TABLE IF EXISTS probe_sparse;

SELECT 'Sparse mapping equals hash join mapping';

CREATE TABLE pk_nullable (v Nullable(String)) ENGINE = MergeTree ORDER BY v
SETTINGS index_granularity = 1, allow_nullable_key = 1;

SELECT 'partition_key', (SELECT groupArray(v) FROM pk_partition WHERE v = CAST('7', 'Enum8(\'7\' = 3)')
    SETTINGS optimize_use_implicit_projections = 0)
    = (SELECT groupArray(v) FROM ref_str WHERE v = CAST('7', 'Enum8(\'7\' = 3)'));

SELECT 'bloom_filter_fixed_string_prunes', (SELECT sum(toUInt64OrZero(extract(explain, 'Granules: (\\d+)/')))
    FROM (EXPLAIN indexes = 1 SELECT count() FROM bf_fixed4 WHERE v = CAST('7', 'Enum8(\'7\' = 3)')))
    = (SELECT sum(toUInt64OrZero(extract(explain, 'Granules: (\\d+)/')))
    FROM (EXPLAIN indexes = 1 SELECT count() FROM bf_fixed4 WHERE v = '7'));

DROP TABLE bf_fixed4;

SELECT 'a ipv4 wide signed', (SELECT count() FROM ip_mono_t4 WHERE intDiv(a, toInt32(1000000)) < 0) = (SELECT count() FROM ip_mono_m4 WHERE intDiv(a, toInt32(1000000)) < 0);

-- (C) Must-keep-pruning controls: an unsigned constant divisor is monotonic, so a guard that
-- rejected IP dividends outright would silently delete this optimization.
CREATE OR REPLACE TABLE ip_mono_t4g1 (a IPv4) ENGINE = MergeTree ORDER BY a SETTINGS index_granularity = 1;

INSERT INTO ip_mono_m4lc VALUES ('1.2.3.4'), ('127.255.255.255'), ('128.0.0.0'), ('200.1.1.1');

DROP TABLE ip_mono_m6p;

INSERT INTO t_mut_block_columns VALUES (1, 1), (2, 2), (3, 3);

DROP VIEW IF EXISTS mv_two;

SELECT '-- and a matching column still works --';

SELECT '-- a Buffer-only type drift converts at read: PREWHERE fails like the WHERE twin, not with an abort --';

CREATE ROW POLICY rp_04652_mat ON buf_mat FOR SELECT USING y > 5 TO CURRENT_USER;

SELECT count() FROM het_m;

DROP TABLE ali_leaf;

CREATE TABLE rem_leaf (x UInt64, y UInt64) ENGINE = MergeTree ORDER BY x;

SELECT count() FROM cm_mv_merge WHERE x != 0 SETTINGS optimize_move_to_prewhere = 1;

DROP TABLE IF EXISTS rp_inner;

CREATE MATERIALIZED VIEW rp_mv_one TO rp_mv_dst AS SELECT CAST(x, 'Nullable(UInt64)') AS x, y FROM rp_mv_src;

SELECT '-- and through a Merge whose origin type matches the leaf --';

INSERT INTO t_dyn_wide SELECT * FROM t_dyn;

-- Row 5 makes Tuple(a Nullable(UInt32), b String) a real alternative of this column, so the paired
-- query below resolves it as a Variant element instead of falling back to the shared variant.
INSERT INTO t_controls VALUES (5, CAST(tuple(CAST(1, 'Nullable(UInt32)'), 's'), 'Tuple(a Nullable(UInt32), b String)'));

SELECT DISTINCT part_name, minmax__block_number, minmax__block_offset
FROM mergeTreeIndex(currentDatabase(), 't_mut', with_minmax = 1) ORDER BY part_name;

-- B: the strictness modifier must still be printed everywhere the parser accepts it, and the
-- PASTE kind itself must still be printed. Every count below is 1 with and without the fix.
SELECT 'B1', count() FROM (EXPLAIN SYNTAX oneline = 1 SELECT * FROM t_paste_l AS l ALL INNER JOIN t_paste_l AS r ON l.a = r.a) WHERE explain ILIKE '%ALL INNER JOIN%';

INSERT INTO nf SELECT number, number FROM numbers(1000);

DROP TABLE IF EXISTS tab_indexed;

SELECT 'a different predicate is not served from the collapsed entry';

SELECT a FROM format(JSONEachRow, '{"a":null}\n{"a":1.5}') ORDER BY a NULLS FIRST;

-- `.` carries the same divergence at stock settings, so the group keeps a live assertion either way.
SELECT d, dynamicType(d) FROM format(TSV, 'd Dynamic', '.');

-- The prefetched pool must drop the same marks as the default pool (task boundaries are
-- pre-split there, so do not assert on the number of fully dropped tasks).
SELECT
    ProfileEvents['ReadPoolRangeRefinerDroppedMarks'] > 200 AS dropped_marks
FROM system.query_log
WHERE current_database = currentDatabase()
    AND type = 'QueryFinish'
    AND query LIKE '%skip_refiner_query_prefetched_pool%'
    AND query NOT LIKE '%query_log%';

-- The record that renames a setting does not claim to introduce the old name when that name is older than it:
-- `evaluation_time` appeared in 25.8 and became an alias of `promql_evaluation_time` in 25.9, so the version it
-- was introduced in is the one it appeared in and not the one of the rename.
SELECT position(description, '**Introduced in:** v25.8') > 0,
       position(description, '\n- **25.9** — the default value remained `auto`. The setting was renamed.') > 0
FROM system.documentation WHERE type = 'Setting' AND name = 'evaluation_time';

-- 2^128 - 1
SELECT toString(toUInt256('340282366920938463463374607431768211456'));

SELECT 'Serialized query plan carries the settings';

-- A retry succeeds and the view works: it has the populated rows and receives new inserts.
CREATE MATERIALIZED VIEW mv_04653 ENGINE = MergeTree ORDER BY n POPULATE AS SELECT n FROM src_04653;

CREATE TABLE t_in_main (id UInt64, v UInt64) ENGINE = MergeTree ORDER BY id;

INSERT INTO t_top_k_size_hint SELECT number % 3, number FROM numbers(100000);

-- long: the test itself takes about a second, but it covers many scenarios (each with its
-- own DDL and a fill), and the flaky check runs several instances of it in parallel against
-- one debug server; the tag lifts the flaky-check run-time cap which such runners exceed.

-- Test for enable_join_seal_gated_reading: the probe side of a hash JOIN is read through
-- SealGatedReadTransforms which start reading only after the build side completes its runtime
-- filter, and the filter then prunes whole mark ranges by the primary key at task-cut time.

-- Runtime filters (and therefore the gating) exist only with the analyzer.
SET enable_join_runtime_filters = 1;

SELECT /* seal_final */ count(), sum(p.k) FROM t_seal_probe_final AS p FINAL JOIN t_seal_build AS b ON p.k = b.k;

INSERT INTO t_seal_probe_ab SELECT number % 100, intDiv(number, 100), toString(number) FROM numbers(50000);

-- A part can carry an older type for a column than the table metadata does, because an `ALTER TABLE
-- ... MODIFY COLUMN` is not always applied to the data right away. A mutation that rewrites the whole
-- part re-reads every column at the type in the metadata, so the resulting part must record that type
-- and not the stale one from the source part.

-- Read-in-order on the base table would decline the forced projections in this test
-- (`PROJECTION_NOT_USED`), so disable it: plan shape is not this test's subject.
SET optimize_read_in_order = 0;

SELECT '--- a stale tuple type and its serialization info ---';

DROP TABLE t_stale_part_type_4;

SELECT 'rows', count() = 2
FROM system.part_log
WHERE database = currentDatabase() AND table LIKE 'packed_commit_%' AND event_type = 'MutatePart';

SELECT count() FROM local_data AS t JOIN pv(tenants = ['t1']) ON t.tenant_id = pv.tenant_id SETTINGS joined_subquery_requires_alias = 0;

SELECT count(), sum(mt_dim.v)
FROM rmt_fact LEFT JOIN mt_dim ON rmt_fact.k = mt_dim.k
SETTINGS parallel_replicas_for_non_replicated_merge_tree = 0;

-- Now run the same subquery with reads from the cache disabled, so that the subquery plan still ends
-- with `StreamInQueryResultCacheStep` and its writer takes the early-skip branch. The outer query is
-- spelled differently on purpose, so that it is a cache miss and the set is really built.
SET enable_reads_from_query_cache = 0;

SELECT x, y FROM tf_drift ORDER BY y LIMIT 3;

DROP TABLE t_text_defer_final_pp;

DROP TABLE IF EXISTS k_lcnstr;

-- `Array(String)`: `hasAny`/`hasAll` cast both arrays to the common type, so they compare the
-- unpadded value.
SELECT 'str hasAny FS3', (SELECT count() FROM o_str WHERE hasAny(v,[toFixedString('V0',3)])) = (SELECT count() FROM k_str WHERE hasAny(v,[toFixedString('V0',3)]));

SELECT 'lcstr has FS5', (SELECT count() FROM o_lcstr WHERE has(v,toFixedString('V0',5))) = (SELECT count() FROM k_lcstr WHERE has(v,toFixedString('V0',5)));

SELECT 'null str hasAll NStr', (SELECT count() FROM o_str WHERE hasAll(v,[CAST(NULL AS Nullable(String))])) = (SELECT count() FROM k_str WHERE hasAll(v,[CAST(NULL AS Nullable(String))]));

DROP TABLE o_lcnstr;

INSERT INTO keys VALUES (1);

OPTIMIZE TABLE async_buf;

CREATE ROW POLICY rp_04654 ON lm_mv FOR SELECT USING x != 0 TO CURRENT_USER;

SELECT
    extract(arrayStringConcat(groupArray(explain), '\n'), 'Type: (\\w+)') AS join_kind,
    countIf(explain LIKE '%Filter column:%') AS filters_above_join
FROM (
    EXPLAIN SELECT * FROM t1 ALL INNER JOIN tj ON t1.a = tj.a WHERE t1.a = tj.d
);

DROP TABLE lzi_left SYNC;

-- Far past the boundary.
SELECT 'esc_300', getMaxTableNameLengthForDatabase(repeat('d', 300));

SELECT formatQueryFromJSON(parseQueryToJSON($$CREATE MATERIALIZED VIEW mv REFRESH EVERY 1 DAY OFFSET 1 HOUR RANDOMIZE FOR 1 MINUTE APPEND TO dst AS SELECT 1$$))
    = formatQuerySingleLine($$CREATE MATERIALIZED VIEW mv REFRESH EVERY 1 DAY OFFSET 1 HOUR RANDOMIZE FOR 1 MINUTE APPEND TO dst AS SELECT 1$$);

INSERT INTO t_distinct_join_l SELECT number FROM numbers(800);

-- The assertions below count the rows the heap itself rejects. With the dynamic filter the reading
-- step drops the rows beyond the heap boundary before they reach the aggregation, so keep it off here.
SET enable_group_by_top_k_dynamic_filtering = 0;

DROP TABLE gt_plateau_first;

SELECT * FROM (SELECT number FROM numbers(10) SETTINGS limit = 3, offset = 1);

-- Worker task entries log the task id ('main', 'stage_N_M' - not SQL) as the query text and carry a
-- query_id of their own ('<plan uuid>::<task id>'), rooted at the initiator through initial_query_id;
-- their Settings column shows the task context, where the overrides appear as changed settings.
-- query_log rows outlive the database that wrote them and a fixed `--database` repeats it, so the
-- family is rooted at the initiator row of the statement under test, which every execution writes; a
-- task row is not a sound anchor, since its absence is what this probe has to report. The task-id
-- filter excludes that initiator row (logged before the auto-switch, so it keeps the user-set
-- values), and the probe runs with make_distributed_plan = 0 so it does not spawn 'main' tasks.
SELECT DISTINCT Settings['use_skip_indexes_on_data_read'], Settings['compile_expressions']
FROM system.query_log
WHERE event_date >= yesterday() AND type = 'QueryStart'
  AND query NOT ILIKE '%SELECT%'
  AND initial_query_id = (
      SELECT query_id FROM system.query_log
      WHERE event_date >= yesterday() AND type = 'QueryStart'
        AND current_database = currentDatabase()
        AND is_initial_query
        AND Settings['log_comment'] = '04656_distributed_plan_auto_switch'
      ORDER BY event_time_microseconds DESC
      LIMIT 1)
SETTINGS make_distributed_plan = 0;

SHOW CREATE TABLE table_over_cluster_function;

-- Single-node heap mechanics: under parallel replicas the no-`ORDER BY` shape
-- is gated off entirely, and memory-bound merging turns the partial aggregation
-- in-order, dropping the heap the assertions below observe.
SET enable_parallel_replicas = 0;

-- Explicit grace_hash: a carrier the issue does not mention. It needs at least two initial
-- buckets, because with grace_hash_join_initial_buckets = 1 nothing is delayed and the cell
-- would be vacuous.
SELECT t1.k
FROM (SELECT number AS k FROM numbers(50000)) AS t1
INNER JOIN (SELECT number AS k FROM numbers(50000)) AS t2 ON t1.k = t2.k
SETTINGS log_comment = '04657_grace_inner', join_algorithm = 'grace_hash',
    max_bytes_before_external_join = 100000, grace_hash_join_initial_buckets = 4
FORMAT Null;

-- Filtering effective (selective right side) on several threads: results must match the `hash` algorithm.
SELECT 'analyzer filtered_inner',
    (SELECT (count(), sum(l.c)) FROM pfsmj_sotf_left AS l INNER JOIN pfsmj_sotf_right AS r ON l.c = r.c
     SETTINGS join_algorithm = 'parallel_full_sorting_merge', max_rows_in_set_to_optimize_join = 100000000,
              query_plan_join_swap_table = 0, max_threads = 4)
  = (SELECT (count(), sum(l.c)) FROM pfsmj_sotf_left AS l INNER JOIN pfsmj_sotf_right AS r ON l.c = r.c
     SETTINGS join_algorithm = 'hash');

SELECT 'an INTERVAL step over Date and DateTime is rejected when it leaves the column type before reaching a TO out of range in the fill direction';

SELECT count() FROM (SELECT toDateTime64('2000-01-01 00:00:00', 0, 'UTC') AS t ORDER BY t ASC WITH FILL FROM -62167219200 TO -62167219100 STEP INTERVAL 1 MINUTE);

SELECT 'a numeric step that overflows the Int64 arithmetic carrier stops at TO';

-- Anchored at 11 it stops at 254 and stays an ordinary fill.
SELECT count(), max(b) FROM (SELECT a, b FROM (SELECT 1 AS a, toUInt8(11) AS b UNION ALL SELECT 3, toUInt8(20)) ORDER BY a WITH FILL, b WITH FILL TO 257 STEP 3);

SELECT groupArray(x) FROM (SELECT toInt64(9223372036854775805) AS x ORDER BY x WITH FILL STALENESS 3);

SELECT count() FROM (SELECT toDateTime64(-62167219199, 0, 'UTC') - toIntervalSecond(number * 2) AS t FROM numbers(2) ORDER BY t DESC WITH FILL);

DROP TABLE tab_proj;

SELECT count() FROM text_index_negative_cache WHERE hasAnyTokens(message, 'missing_enabled');

DROP TABLE IF EXISTS sj_all_left_2col;

INSERT INTO sj_all_left_lc VALUES ('k1', 10), ('k1', 20);

-- ALL INNER hoists the residual to a post-join filter, so it never becomes a mixed
-- expression. The residual is discriminating (only the a = 20 right row qualifies) and the
-- value is asserted against a Memory twin, so an all-true or all-false evaluation is caught.
SELECT 'K1 join', t1.a, sj_all_inner.a FROM t1 INNER JOIN sj_all_inner ON (t1.key = sj_all_inner.key) AND (sj_all_inner.a - t1.a > 15) ORDER BY t1.a, sj_all_inner.a;

DROP TABLE t1_lc;

ALTER TABLE t_column_comment_order MODIFY COLUMN b UInt64 CODEC(ZSTD) COMMENT 'b newer comment' SETTINGS mutations_sync = 2;

DROP TABLE IF EXISTS 04660_keeper_map_delete SYNC;

SELECT accurateCast(toFloat64(0), 'DateTime'), accurateCastOrNull(toFloat32(0), 'DateTime');

SELECT '-- A valueless boolean setting is rejected the same way, as in `EXPLAIN` itself';

SELECT 'OFFSET distributed', a, substring(payload, 1, 4) FROM t_dist_lazy ORDER BY b, a LIMIT 5 OFFSET 25
SETTINGS make_distributed_plan = 1, distributed_plan_fallback_to_local_execution = 0;

-- Reading a `Merge` table on a single replica, which is what happens whenever it is not expanded into
-- the reads of its underlying tables. Those reads are planned lazily, while the outer plan is already
-- being executed, and shipping such a plan of its own used to lose the filters pushed down into it
-- (silently returning wrong results) and, when a filter referenced a subquery set whose plan the outer
-- `addStepsToBuildSets` had already moved out, to throw `Cannot serialize FutureSetFromSubquery with no
-- query plan` while serializing it. Distributing a `Merge` by expanding it is a different mechanism,
-- covered by its own tests.

DROP TABLE IF EXISTS t_merge_pr_local;

DROP TABLE t_merge_pr_dist;

SELECT DISTINCT part_name, minmax__block_number, minmax__block_offset
FROM mergeTreeIndex(currentDatabase(), 't_mut_reload', with_minmax = 1) ORDER BY part_name;

SELECT formatQueryFromJSON(parseQueryToJSON('UPDATE t SET y = 1 IN PARTITION 1, 2 WHERE x = 1'));

DROP TABLE t_negative;

SELECT 'INNER ANY', count(), sum(t2.a) FROM t1 INNER ANY JOIN t2 ON (t1.key = t2.key) AND (t1.a * 10 < t2.a)
SETTINGS join_algorithm = 'full_sorting_merge,hash';

SELECT 'dict LEFT ANY, no settings', count(), sum(d.a) FROM t3 LEFT ANY JOIN dict AS d ON (t3.key = d.key) AND (t3.a * 10 < d.a);

-- the parallel pre-deduplication is visible in the pipeline: one DistinctTransform per partition port
-- feeding the single set-filling transform
SELECT replaceRegexpOne(explain, '^[ ]*(.*)', '\\1') FROM (EXPLAIN PIPELINE SELECT count() FROM numbers(100) WHERE number IN (SELECT a FROM test_in_partition_eq_key) SETTINGS allow_creating_set_partitions_independently = 1) WHERE explain LIKE '%DistinctTransform%' OR explain LIKE '%CreatingSetsTransform%';

-- injective function of the partition column as the subquery output
DROP TABLE IF EXISTS test_in_injective_wrapper;

SELECT (SELECT count() FROM numbers(100) WHERE number IN (SELECT DISTINCT a FROM test_in_through_distinct) SETTINGS allow_creating_set_partitions_independently = 0, allow_distinct_partitions_independently = 0) = (SELECT count() FROM numbers(100) WHERE number IN (SELECT DISTINCT a FROM test_in_through_distinct) SETTINGS allow_creating_set_partitions_independently = 1, allow_distinct_partitions_independently = 1, max_rows_in_distinct = 0, max_bytes_in_distinct = 0);

SELECT replaceRegexpOne(explain, '^[ ]*(.*)', '\\1') FROM (EXPLAIN actions = 1 SELECT count() FROM numbers(100) WHERE number IN (SELECT a FROM test_in_with_group_by GROUP BY a) SETTINGS allow_creating_set_partitions_independently = 1) WHERE explain LIKE '%Pre-distinct%';

CREATE TABLE test_in_lc_nullable_key (a LowCardinality(Nullable(String))) ENGINE = MergeTree ORDER BY tuple() PARTITION BY sipHash64(coalesce(a, '')) % 8;

CREATE TABLE test_in_lc_dup_prefix (s LowCardinality(String)) ENGINE = MergeTree ORDER BY s PARTITION BY cityHash64(s) % 8;

INSERT INTO test_in_wide_keys SELECT concat(toString(number), repeat('x', 700)) FROM numbers_mt(320000);

SELECT toDate32(toInt256('-57896044618658097711785492504343953926634992332820282019728792003956564819968'));

-- Fusion is skipped under plan serialization, the result is still correct.
SELECT (SELECT sum(cityHash64(elem, payload)) FROM (SELECT elem, payload FROM t_fuse ARRAY JOIN arr AS elem WHERE elem = 'e2') SETTINGS query_plan_fuse_filter_into_array_join = 1, serialize_query_plan = 1)
     = (SELECT sum(cityHash64(elem, payload)) FROM (SELECT elem, payload FROM t_fuse ARRAY JOIN arr AS elem WHERE elem = 'e2') SETTINGS query_plan_fuse_filter_into_array_join = 0);

SELECT x, y FROM t_unsigned INNER JOIN t_signed ON x = y ORDER BY ALL;

SELECT 'A Tuple with nullable integer elements is supported: NULL and out-of-range elements do not match';

SELECT 'The stored key is the common subtype: the probe key is converted, and an out-of-range value does not match anything';

DROP DICTIONARY IF EXISTS t_direct_dictionary;

DROP TABLE t_probe;

DROP TABLE points_fixed_x;

SELECT count() FROM t_qcc_lwd WHERE id = 0;

-- The pretty EXPLAIN output decorates plan lines with tree-drawing characters; use the legacy format
-- so the assertions below match plain `Skip scatter by partition: 1` lines.
SET explain_query_plan_default = 'legacy';

CREATE TABLE test_win_stacked (a UInt32, b UInt32) ENGINE = MergeTree ORDER BY tuple() PARTITION BY a % 8;

-- NEGATIVE: window without PARTITION BY has no scatter to skip
DROP TABLE IF EXISTS test_win_no_partition_by;

-- NEGATIVE: FINAL
DROP TABLE IF EXISTS test_win_with_final;

INSERT INTO test_win_scatter_source SELECT number % 64, number + 1600 FROM numbers_mt(400);

INSERT INTO t_any VALUES (1, 2), (1, 3), (2, 4);

datatable (Name:string, Score:long) ['a', 10, 'b', 20] | project Name;

datatable (N:long) [1, 1, 2] | count as Total;

SELECT '-- the explicit rewrite executes IN as a distributed join';

SELECT 'A dt64 s9 .000000070', toString(toDateTime64('2024-01-01 00:00:00.000000070', 9, 'UTC'));

SELECT 'B dt64 s9 .000100000', toString(toDateTime64('2024-01-01 00:00:00.0001', 9, 'UTC'));

SELECT 'D array s7', toString([toDateTime64('2024-01-01 00:00:00.1234567', 7, 'UTC')]);

-- A WHERE that references the right side rejects the NULL-extended rows, so the join is an INNER
-- join by the time constants are substituted. Without that rewrite the join has no equi key at all
-- and is not supported, hence `query_plan_convert_outer_join_to_inner_join` is pinned here.
SELECT 'left join with bounds in WHERE';

// true: '-' separates terms
print p = 'abc' has 'ab';

print p = 'ABC' != 'abc';

DROP TABLE tj2;

-- Right side only.
SELECT count(), sum(t2.a) FROM t1 LEFT JOIN t2 ON (t1.key = t2.key) AND (t2.a < arrayJoin(t2.arr));

-- -3 (truncates toward zero)

print '-- substring indexes from 0, and a negative start counts from the end --';

print iif(1 < 2, 'y', 'n');

print array_index_of(dynamic([10, 20, 30]), 20);

-- The set has exactly 100 distinct values, so the boundary is strict in both overflow modes.
SELECT '-- a set of exactly max_rows_to_transfer rows ships';

INSERT INTO ev VALUES ('n1', 'c1', 'r1'), ('n1', 'c2', 'r2'), ('n2', 'c1', 'r1');

SELECT groupArray(t) = arraySort(x -> x, groupArray(t)) FROM (
    SELECT (name::Nullable(String), code) AS t FROM ev ORDER BY name::Nullable(String), code LIMIT 10);

DROP TABLE IF EXISTS oracle_fixed_string_5;

SELECT 'Nullable(String) key, Variant(FixedString(3))',
    (SELECT count() FROM oracle WHERE s = CAST(toFixedString('V0', 3) AS Variant(FixedString(3), UInt64)))
        = (SELECT count() FROM pk_nullable WHERE s = CAST(toFixedString('V0', 3) AS Variant(FixedString(3), UInt64)));

DROP TABLE pk_fixed_string_3;

print '-- a function is usable more than once in a statement, and composes --';

let shadowed = 100;

print '-- a tabular function joins and unions like any other source --';

-- The arguments of a staged record are copied out of the block into the record, the lazily
-- replicated ones materialized first, and rebuilt into columns at the merge. A non-zero count of
-- staged records is what distinguishes the three arms having gone through that from their having
-- agreed on a value without staging anything.
SYSTEM FLUSH LOGS query_log;

print datetime_add('week', 1, make_datetime(2017,1,1));

// true

print '-- ipv4_is_private is RFC 1918 only, so loopback is not private --';

INSERT INTO t_share_sets SELECT number+30000000,  '' FROM numbers(100000);

SELECT '-- empty arguments';

SELECT arrayIntersect([[1, 2], [3]], [[3], [4]]);

SELECT replaceRegexpAll('', '(a)?', '[\\1]');

DROP TABLE test_ttl_dynamic_attach;

DROP TABLE IF EXISTS f1;

SELECT 'length first, tuple rewritten', count()
FROM (EXPLAIN QUERY TREE SELECT length(arr), tupleElement(t, 'a') FROM f2)
WHERE explain ILIKE '%t.a%';

DROP TABLE IF EXISTS t_dedup_json_renamed_pair;

SELECT 'renamed nested path kept', count() FROM t_dedup_json_renamed_nested;

DROP TABLE t_dedup_json_renamed_pair;

INSERT INTO t_dedup_sparse_nested_dst SELECT * FROM t_dedup_sparse_nested_src SETTINGS insert_deduplication_token = 'token_2';

DROP TABLE t_dedup_sparse_nested_src;

SELECT count()
FROM points_non_lightweight_fixed_x
WHERE pointInPolygon(coord, [(0, 0), (0, 25000), (200, 25000), (200, 0)])
SETTINGS use_lightweight_primary_key_index_analysis = 0, force_primary_key = 1, max_rows_to_read = 40000;

SELECT '-- the filtered array is also used on its own';

OPTIMIZE TABLE t_totime_reload FINAL;

SELECT count() FROM system.mutations WHERE database = currentDatabase() AND table = 't_merge_mutation' AND command LIKE '%currentDatabase%';

UPDATE {CLICKHOUSE_DATABASE_1:Identifier}.t_lwu SET v = 3 WHERE id IN (SELECT id FROM merge('^t_lwu_src$'));

SELECT 'Point key column, dense index analysis';

SELECT trimLeft(explain) AS explain FROM (
    EXPLAIN indexes = 1
    SELECT count()
    FROM points_key_expression
    WHERE pointInPolygon((x, y), [(0, 0), (0, 25000), (25000, 25000), (25000, 0)])
    SETTINGS use_lightweight_primary_key_index_analysis = 1
) WHERE explain LIKE '%Granules%';

DESCRIBE (SELECT * FROM (SELECT 1 AS k, 'D' AS Date) AS ll LEFT JOIN (SELECT 1 AS k) AS t1 ON ll.k = t1.k LEFT JOIN (SELECT 1 AS k) AS t2 ON ll.k = t2.k GROUP BY GROUPING SETS ((ll.k, ll.Date), (t1.k, t2.k)));

SELECT 'the dedicated setting also enables the codec in the codec-valued MergeTree settings';

-- The memory spill scheduler should be able to spill a `SpillingHashJoin`, not just a top-level `grace_hash`.
create table spill_scheduler_04695_1 (`k` String, `x` String) Engine=Memory;

SELECT count() FROM tab_postings_order WHERE hasAnyTokens(s, ['common1', 'zrare']);

DROP VIEW IF EXISTS 04695_view;

SELECT 'the dedicated setting enables SZ3';

CREATE TABLE t_mutation_pruning_subcolumn_key (d Date, x UInt32, y UInt32, t Tuple(a UInt32, b String))
ENGINE = ReplicatedMergeTree('/clickhouse/tables/{database}/t_mutation_pruning_subcolumn_key', 'r1')
PARTITION BY t.a ORDER BY x;

drop table t_custom_type_name;

SELECT 'a NULL right key is not in the hash table, both algorithms';

CREATE TABLE t_dyn (k UInt64, `skp_idx_a` Dynamic, s String,
    INDEX `a.variant_discr`(s) TYPE set(100) GRANULARITY 1)
ENGINE = MergeTree ORDER BY k
SETTINGS min_bytes_for_wide_part = 0, min_rows_for_wide_part = 0, escape_index_filenames = 0,
         packed_skip_index_max_bytes = 0;

DROP TABLE t_vert_merge;

-- ADD COLUMN is metadata-only, so a mutation is how an existing table reaches this state. Before
-- this check the index's marks file was hardlinked onto the column's base, CHECK TABLE reported OK,
-- and only reading the column revealed the corruption.
CREATE TABLE t_carry (k UInt64, s String, INDEX a(s) TYPE set(100) GRANULARITY 1)
ENGINE = MergeTree ORDER BY k
SETTINGS min_bytes_for_wide_part = 0, min_rows_for_wide_part = 0, packed_skip_index_max_bytes = 0;

-- A mutation of an already-empty part claims through sites that run before any block is written:
-- the carried-column helper in prepare and the recalculated index in initSkipIndices. Neither can
-- share marks in a part that has none, so both must stay quiet.
CREATE TABLE t_empty_mut_ok (k UInt64, d DateTime, s String, INDEX a(s) TYPE set(100) GRANULARITY 1)
ENGINE = MergeTree ORDER BY k TTL d + INTERVAL 1 SECOND
SETTINGS min_bytes_for_wide_part = 0, min_rows_for_wide_part = 0, merge_with_ttl_timeout = 0,
         packed_skip_index_max_bytes = 0;

-- An ordinary mutation carries the whole source directory, so an over-broad claim would break every
-- mutation in the product.
CREATE TABLE t_mut_ok (k UInt64, s String, v UInt64, INDEX a(s) TYPE set(100) GRANULARITY 1)
ENGINE = MergeTree ORDER BY k
SETTINGS min_bytes_for_wide_part = 0, min_rows_for_wide_part = 0;

ALTER TABLE t_nested_ok RENAME COLUMN nested.a TO nested.aa, RENAME COLUMN nested.b TO nested.bb;

SELECT 'legacy: grace_hash needs no spill threshold';

SELECT formatQuerySingleLine($$BACKUP TABLE t TO Disk('d', 'b') SETTINGS foo = DEFAULT, CLUSTER_HOST_IDS = DEFAULT$$);

-- Regressions for KQL join kinds, join key qualification, `let` rebinding and `bin_at`.

SET enable_kusto_dialect = 1;

print '-- bin propagates null --';

-- Exercise partition pruning for high-precision `TIMESTAMP WITH LOCAL TIME ZONE` while the session
-- uses a non-UTC time zone.
SELECT id, tsltz FROM paimonS3(s3_conn, filename='paimon_timestamp_partition/ltz')
WHERE tsltz = '2025-07-31 08:30:00.123456'
ORDER BY id SETTINGS use_paimon_partition_pruning = 1;

DROP TABLE t_113234;

INSERT INTO 04701_mem_map VALUES (map('a', '1'), 'x'), (map('b', '2'), 'y');

SELECT trimLeft(explain) FROM (EXPLAIN actions = 1 SELECT count() FROM 04701_rdb_lc_nullable WHERE k IN (SELECT CAST('a', 'Variant(String, UInt8)'))) WHERE explain LIKE '%ReadType%';

SELECT accurateCastOrNull(CAST(1, 'UInt128'), 'IPv6');

SELECT '-- tuple element becomes a subcolumn read';

DROP TABLE IF EXISTS vstr;

-- EXCEPT sibling
SELECT countIf(explain LIKE '%MaterializingCTETransform%') > 0, countIf(explain LIKE '%ExtremesOnlyTransform%') > 0
FROM viewExplain('EXPLAIN PIPELINE', '', (
    WITH a AS MATERIALIZED (SELECT number AS id FROM numbers(20))
    SELECT id FROM a WHERE id IN (SELECT id FROM a) EXCEPT SELECT id FROM a WHERE id < 5
)) SETTINGS extremes = 1;

INSERT INTO t_sparse VALUES ('2001:db8::');

CREATE TABLE t_map_values_search (m Map(String, String), INDEX idx mapValues(m) TYPE ngrambf_v1(3, 512, 3, 0)) ENGINE = MergeTree ORDER BY tuple() SETTINGS index_granularity = 1;

-- `max_concurrent_threads_ratio_to_cores`: `ratio * cores` exceeds `Int64` range.
CREATE WORKLOAD 04718_w1 IN 04718_all SETTINGS max_concurrent_threads_ratio_to_cores = 9223372036854775807;

-- macOS filesystem (APFS) is case-insensitive, so MergeTree hashes stream filenames
-- unconditionally (replace_long_file_name_to_hash = 0 cannot be honored). The arms below need the
-- column to keep its unhashed name: they cover producers that claim an index's LOGICAL name, which
-- can only meet a column whose on-disk name is logical too. Under forced hashing the column becomes
-- bare hex, the pair is genuinely legal, and the refusals below correctly stop happening.
-- The rest of the matrix hashes both sides to one base and stays platform-agnostic in 04698.

SET mutations_sync = 2;

CREATE TABLE m_alias   (`A` UInt64) ENGINE = Merge(currentDatabase(), '^(a_inner|dist_pos)$');

SELECT '-- window sort with no top-level ORDER BY (the shape the fuzzer reported)';

CREATE TABLE t_lc_i32 (A LowCardinality(Int32)) ENGINE = MergeTree ORDER BY A;

-- `contains` accepts this pair: the name sets are disjoint, so it falls back to testing the
-- TRUNCATED value, and 128 truncated to Int8 is -128, which the target does hold. The cast
-- truncates the data the same way, so ascending 0, 128 arrives as 0, -128, i.e. reversed.
CREATE TABLE t_e16_wide (A Enum16('a' = 0, 'b' = 128)) ENGINE = MergeTree ORDER BY A;

CREATE TABLE dist_arr_i64 AS t_arr_i64 ENGINE = Distributed('test_cluster_two_shards_localhost', currentDatabase(), t_arr_i64);

SELECT DISTINCT A FROM m_lc_flip ORDER BY A ASC LIMIT 3;

SELECT r.key FROM (SELECT key FROM t_left) AS l
RIGHT JOIN (SELECT dummy AS key FROM system.one) AS r ON l.key = r.key
ORDER BY r.key;

-- The optimization must still be applied when both sides hold an eligible table.

SELECT '-- both sides eligible: JOIN is offloaded';

DROP TABLE IF EXISTS t_merge_left;

DROP TABLE t_merge_left;

DROP VIEW IF EXISTS v_left;

-- all_3_3_0
INSERT INTO t_commit_order_snapshot SELECT number FROM numbers(16);

INSERT INTO t_minmax_repair_merged SELECT toDate('2018-10-01') + number % 3, toString(number), number FROM numbers(3, 3);

DROP VIEW IF EXISTS v_union_both;

SET enable_parallel_replicas = 1, max_parallel_replicas = 3, cluster_for_parallel_replicas = 'test_cluster_one_shard_three_replicas_localhost', parallel_replicas_for_non_replicated_merge_tree = 1, parallel_replicas_allow_view_over_mergetree = 1;

DROP VIEW v_plain;

SELECT
    number,
    arrayRemoveAt(
        [10, 20, 30, 40],
        multiIf(number = 0, toInt8(1), number = 1, toInt8(-1), number = 2, toInt8(2), toInt8(10)))
FROM numbers(4)
ORDER BY number;

DROP TABLE t_window_state_variant;

SELECT 'control', rows_where_ttl_info.min, rows_where_ttl_info.max
FROM system.parts WHERE database = currentDatabase() AND table = 't_distinct' AND active;

CREATE TABLE t_str (n UInt64, s String ALIAS 'hello') ENGINE = MergeTree ORDER BY tuple();

CREATE ROW POLICY p_04738 ON t_pol USING n > 1 TO ALL;

-- Reading a Buffer whose destination declares a column differently logs a warning per read.
SET send_logs_level = 'error';

CREATE TABLE t04741_arr_dst (k UInt8, a Array(UInt64)) ENGINE = MergeTree ORDER BY tuple();

SELECT count() > 0 FROM (EXPLAIN actions = 1, pretty = 0 SELECT m FROM t04741_map_buf PREWHERE mapContains(m, 'b') ORDER BY m)
WHERE explain LIKE '%Row level filter column:%';

DROP ROW POLICY p04741_same ON t04741_same_buf;

CREATE TABLE t04743_pq_buf (k UInt8, m Map(String, UInt64))
    ENGINE = Buffer(currentDatabase(), t04743_pq_dst, 1, 100, 100, 1000, 10000, 1000000, 10000000);

INSERT INTO t_r VALUES (7), (0), (1);

INSERT INTO t_l VALUES ('5'), ('1');

SELECT 'lc_uint128 highbits', a.id FROM t_l a JOIN t_r b ON a.id = b.id ORDER BY a.id;

SELECT count(*) OVER () FROM cluster('test_cluster_two_shards_localhost', view(SELECT 1 AS a));

SELECT '--- UNION ALL and JOIN';

SELECT count(*) OVER () FROM (SELECT count(*) AS c FROM d_plain GROUP BY k);

SELECT hex(groupConcat('|', 2)(x)) FROM (SELECT CAST('ab', 'FixedString(5)') AS x FROM numbers(4));

-- Compact parts keep per-column offsets and were never affected; a control against overfitting.
CREATE TABLE t_shared_offsets_compact
(
    `id` UInt64,
    `arr.id` Array(UInt64),
    `arr.nested` Array(Tuple(a String, b Float64))
)
ENGINE = MergeTree ORDER BY id
SETTINGS share_nested_offsets = 1, min_bytes_for_wide_part = 1000000000, min_rows_for_wide_part = 1000000000;

-- Pin full part storage: a mutation of a packed part rebuilds all of its projections.
CREATE TABLE t_modify_projection_materialize
(
    k UInt64,
    v UInt64,
    PROJECTION p (SELECT v ORDER BY v) WITH SETTINGS (index_granularity = 1024)
)
ENGINE = MergeTree ORDER BY k
SETTINGS index_granularity = 8192, index_granularity_bytes = 10485760, min_bytes_for_full_part_storage = 0;

SELECT
    countIf(explain LIKE '%Left: rows%') AS left_group,
    countIf(explain LIKE '%Right: rows%') AS right_group,
    countIf(explain LIKE '%Buffer:%') AS buffer_group,
    countIf(explain LIKE '%Spill:%') AS spill_group,
    maxIf(extract(explain, 'matched (not collected|[0-9]+)'), explain LIKE '%Left: rows%') AS matched_left,
    maxIf(extract(explain, 'matched (not collected|[0-9]+)'), explain LIKE '%Right: rows%') AS matched_right
FROM (EXPLAIN ANALYZE matches = 1 SELECT count() FROM left_side CROSS JOIN (SELECT * FROM right_side LIMIT 3) AS r);

DROP TABLE IF EXISTS logs_04757;

-- America/Los_Angeles enters DST on 2026-03-08: 01:59:59 PST (09:59:59 UTC) is
-- immediately followed by 03:00:00 PDT (10:00:00 UTC), so this civil day is 23 hours long.
INSERT INTO t_optimize_to_date_preimage VALUES
    ('2025-12-28 23:59:59'),
    ('2025-12-29 00:00:00'),
    ('2026-02-28 23:59:59'),
    ('2026-03-07 23:59:59'),
    ('2026-03-08 00:00:00'),
    ('2026-03-08 01:59:59'),
    ('2026-03-08 03:00:00'),
    ('2026-03-08 23:59:59'),
    ('2026-03-09 00:00:00'),
    ('2026-04-01 00:00:00'),
    ('2027-01-03 23:59:59'),
    ('2027-01-04 00:00:00');

SELECT 'month index condition retains function', count()
FROM
(
    EXPLAIN indexes = 1
    SELECT ts
    FROM t_optimize_to_date_preimage
    WHERE toStartOfMonth(ts) = toStartOfMonth(toDate('2026-03-08'))
    SETTINGS optimize_time_filter_with_preimage = 1
)
WHERE explain ILIKE '%toStartOfMonth(ts)%';

SELECT l.a_v FROM t_ship_plain AS p GLOBAL INNER JOIN t_ship_alias AS l ON p.k = l.k ORDER BY ALL DESC LIMIT 3;

SELECT count() FROM t_minmax_widened WHERE _block_number = 100 SETTINGS max_rows_to_read = 1;

CREATE TABLE r_112029 (b UInt32) ENGINE = MergeTree ORDER BY b;

CREATE VIEW v_112029 AS SELECT a, b FROM t_view_112029;

DROP TABLE IF EXISTS nb_local;

INSERT INTO t_optimize_date_preimage VALUES
    ('2026-02-28'),
    ('2026-03-01'),
    ('2026-03-31'),
    ('2026-04-01');

SELECT 'source has dependents after failed CREATE:', count() FROM system.tables WHERE database = currentDatabase() AND name = 'src_04759' AND notEmpty(dependencies_table);

// -2, a signed literal is a literal
let s = (a:timespan = 1h) { a };

SELECT 'the whole chain, plain and aggregated and filtered';

DROP TABLE tj;

-- Three of the four packed bytes are used, so the key is narrower than the map key.
CREATE TABLE tj (a FixedString(3), w UInt64) ENGINE = Join(ALL, INNER, a);

INSERT INTO src SELECT * FROM tj;

INSERT INTO t_join_arr SELECT number, [number, number + 1] FROM numbers(20);

-- A `JOIN USING` key that is an `ALIAS` column declared only on the `Distributed` table can be resolved
-- by the shard only if the shipped SQL carries the alias body: `USING (x AS a)` rather than `USING (a)`,
-- because the shard's table has `x` and has never heard of `a`.
-- The initiator cannot tell the difference on its own: `buildQueryTreeDistributed` replaces the source
-- with a dummy built from the `Distributed` table's own columns, so the key does look resolvable there.

DROP TABLE IF EXISTS shard_using_alias;

INSERT INTO other_expr_key SELECT number FROM numbers(6);

SELECT 'positive control: one Variant argument resolves and executes normally';

OPTIMIZE TABLE t_merge_spin FINAL;

CREATE TABLE t_nullable_tuple (a Array(Tuple(Nullable(UInt64), UInt64))) ENGINE = Memory;

DROP TABLE IF EXISTS t_map_uint8;

DROP TABLE t_nested_nothing_tuple;

-- The re-added member is missing from the part, so its subcolumn is synthesized from the offsets
-- stream `arr.id` and `arr.s` also read. A block boundary inside the range must not corrupt them.
SELECT max_block_size, sum(length(nb)), countIf(aid != [id]), countIf(asx != [toString(id)]), countIf(empty(aid))
FROM
(
    SELECT 100000 AS max_block_size, id, `arr.nested`.b AS nb, `arr.id` AS aid, `arr.s` AS asx
    FROM t_nested_shared_offsets
    SETTINGS max_block_size = 100000, local_filesystem_read_prefetch = 0, max_threads = 1
)
GROUP BY max_block_size;

DROP TABLE t_nested_map_in_tuple;

INSERT INTO t_in_memory (cleared) VALUES ('x');

SELECT type FROM system.parts_columns
WHERE database = currentDatabase() AND table = 't_dotted_null_wide' AND active AND column = 'arr.n';

SELECT plain, plain.null FROM t_plain_null_wide;

SELECT arrayExists(x -> x = 'V0\0\0', v) FROM t_fs SETTINGS optimize_rewrite_array_exists_to_has = 0;

CREATE TABLE t_tuple (v Array(Tuple(FixedString(3)))) ENGINE = Memory;

-- Mixed nesting: the pair is reached through a tuple and then an array.
SELECT arrayExists(x -> x = tuple(['V0\0']), [tuple([toFixedString('V0', 3)])]) SETTINGS optimize_rewrite_array_exists_to_has = 0;

SELECT count() FROM (EXPLAIN QUERY TREE SELECT arrayExists(x -> x = map('k', 'V0\0'), v) FROM t_nested_map SETTINGS optimize_rewrite_array_exists_to_has = 1) WHERE explain ILIKE '%function_name: has%';

INSERT INTO src_04796 SELECT number FROM numbers(100);

-- A lightweight delete in patch mode supplies _row_exists from a patch part rather than from the
-- source part's own columns. A later mutation that rewrites all columns applies that mask on read
-- and physically drops the masked rows, so its result must not be declared to carry the mask.

SELECT '-- lightweight_update: heavyweight DELETE after a patch-mode lightweight DELETE';

DELETE FROM t_force WHERE k % 3 = 0 SETTINGS lightweight_delete_mode = 'lightweight_update_force';

DROP TABLE IF EXISTS t_partial SYNC;

CREATE TABLE t_proj (k UInt64, v UInt64, PROJECTION p (SELECT v, count() GROUP BY v))
ENGINE = MergeTree PARTITION BY (k % 2) ORDER BY k
SETTINGS enable_block_number_column = 1, enable_block_offset_column = 1,
         min_bytes_for_wide_part = 0, min_bytes_for_full_part_storage = 0,
         deduplicate_merge_projection_mode = 'rebuild', lightweight_mutation_projection_mode = 'rebuild';

DROP TABLE IF EXISTS empty_t;

SELECT count() FROM (SELECT 1 FROM local_t GROUP BY materialize(NULL)) SETTINGS group_by_use_nulls = 1;

SELECT '-- timeSeriesLimitKMasks: selection by sampling key, candidacy still requires a value';

SELECT 'SKIP unrelated path, key subcolumn unchanged -> allowed:';

SELECT toFloat64(-0.0) IN (arraySum(x -> x, [toFloat64(0.0)]));

SELECT '{"a" : 123456789123456789123456789}'::JSON(a UInt128) AS j, j.a;

SELECT JSONExtractString('{"id":"123","big_number":100000000000000000000000000}', 'id');

SELECT t FROM t_adv_nomarks ORDER BY t.b;

-- 1. The original repro: `View` child before `Distributed` child. No row can satisfy both
--    `x IN (t)` and `x NOT IN (t)`.
WITH t AS MATERIALIZED (SELECT number AS c FROM numbers(2))
SELECT count() FROM merge(currentDatabase(), '^t_04811_(const|dist)$')
WHERE (x IN (t)) AND (x NOT IN (t));

-- `currentDatabase()` inside a table function is substituted on the initiator, before the query
-- reaches the distributed DDL queue: the host cannot recover it, because the queue rewrite has
-- already replaced it with the database of the session.
UPDATE {CLICKHOUSE_DATABASE_1:Identifier}.t_lwu ON CLUSTER test_shard_localhost
    SET v = 4 WHERE id IN (SELECT id FROM merge(currentDatabase(), '^t_lwu_src$'));

-- No `min_bytes_for_wide_part` override, so the part is compact and per-column sizes are 0.
CREATE TABLE t_prewhere_stats_compact
(
    id UInt64,
    x Int64 STATISTICS(tdigest),
    y Int64 STATISTICS(tdigest)
) ENGINE = MergeTree ORDER BY id SETTINGS auto_statistics_types = '';

SELECT * FROM prometheusQueryRange('prometheus', 'topk(1, last_over_time(m[10])) by (dc)', 100, 130, 10) ORDER BY tags;

SELECT * FROM prometheusQuery('prometheus', 'topk(3, m)', 130);

-- Statistics-based part pruning must not drop parts for negated predicates over floating-point
-- columns that contain NaN. Column min/max statistics are computed with `getExtremes`, which skips
-- NaN, so the stored range excludes NaN; yet NaN sorts after +inf and satisfies negated predicates
-- like NOT (f < c), f <> c and f NOT IN (...). The result with pruning on must match pruning off.

SET min_marks_per_part_to_load_statistics = 0;

-- The first execution scans and records a bailout; the second uses the cache.
SELECT count() FROM text_index_pattern_bypass_cache WHERE message LIKE '%pa%' SETTINGS log_comment = '04811_01_first';

SYSTEM START MERGES t_modify_index_projection;

-- Compare against the flatten-then-count workaround on non-trivial data, over many small blocks.
SELECT countIf(arrayFlattenedLength(arr) != length(arrayFlatten(arr))), sum(arrayFlattenedLength(arr))
FROM
(
    SELECT arrayMap(i -> range(i % 5), range(number % 7)) AS arr
    FROM numbers(1000)
)
SETTINGS max_block_size = 7;

DROP TABLE IF EXISTS t_codec_chain_fpc_over;

SELECT count() FROM t_codec_chain_gorilla_over;

DROP TABLE t_codec_chain_gorilla_max;

SELECT toTypeName(1 GLOBAL NOT IN (t_04812)) AS t, 1 GLOBAL NOT IN (t_04812) AS s
FROM remote('127.0.0.1', system, one)
GROUP BY GROUPING SETS ((1 GLOBAL NOT IN (t_04812)))
SETTINGS group_by_use_nulls = 1;

SELECT 'GROUPING(), GLOBAL IN';

CREATE TABLE t_rf_asof_right (id UInt64, ts UInt64, val UInt64) ENGINE = MergeTree ORDER BY (id, ts);

CREATE TABLE t04812_json3 (json JSON) ENGINE = MergeTree ORDER BY tuple();

SELECT '-- fixture check: the path must be in shared data and the parent must be non-empty';

size:<20 | fields _msg;

SELECT 'set table';

DROP TABLE u04812_phys;

-- The plan must count the fully-matched interior granules through the exact-count projection.
SELECT countIf(explain LIKE '%_exact_count_projection%') FROM (EXPLAIN indexes = 1 SELECT count() FROM t_injective_key WHERE x = 5 SETTINGS optimize_use_implicit_projections = 1);

INSERT INTO t_nested_tuple VALUES (1, ['(\'p\')', '(\'q\')']);

SELECT '-- control: a dotted column that is not an Array never joins a group';

SELECT '-- 5 two untuples, predicate on the second';

ALTER TABLE t_rename_swap RENAME COLUMN a1 TO b, RENAME COLUMN b1 TO a SETTINGS alter_sync = 2;

SELECT * FROM format(TSV, 'a Int64', '-007\n-00\n-03242\n-0100\n');

SELECT * FROM format(TSV, 'a UInt64', '007\n');

SET param_pad = '007';

SELECT trimBoth(explain) FROM (EXPLAIN indexes = 1 SELECT v FROM cmp_04812 WHERE id = '007' SETTINGS enable_parallel_replicas = 0) WHERE explain ILIKE '%Condition:%';

-- Verify that allow_statistics = 0 also blocks the column-declaration spelling
-- ALTER TABLE ... ADD/MODIFY COLUMN ... STATISTICS(...), like it blocks the
-- dedicated ADD/DROP/MODIFY STATISTICS commands.
SET allow_statistics = 1;

-- The same switch on its own. Only the operator is off: the paths above it still claim what they
-- claimed.
SET allow_block_nested_loop_join = 0;

-- Object present but some typed paths absent: the absent ones get defaults.
SELECT '{"a": 10}'::JSON(a Int64, b Int64, e Enum8('x' = 1, 'y' = 2)) AS j;

let T = F;

-- Two `Distributed` children with two shards each produce four streams. With a stream multiplier
-- of one they must be narrowed down to a single stream, so no transform runs in four copies.
SELECT countIf(explain LIKE '%× 4%')
FROM
(
    EXPLAIN PIPELINE SELECT A, sum(A) OVER (ORDER BY A) FROM merge_dist ORDER BY A LIMIT 5
)
SETTINGS max_threads = 1, max_streams_multiplier_for_merge_tables = 1, distributed_aggregation_memory_efficient = 0;

CREATE TABLE bnl_totals_r (id Int32, y Int32) ENGINE = MergeTree ORDER BY id;

INSERT INTO t04814_b SELECT number + 1000, number FROM numbers(1000);

SELECT tuple(NULL, NULL)::Nullable(Tuple(Nullable(UInt32), Nullable(UInt32))) IN (materialize(NULL), materialize(NULL)), tuple(NULL, NULL)::Nullable(Tuple(Nullable(UInt32), Nullable(UInt32))) NOT IN (materialize(NULL), materialize(NULL)) SETTINGS transform_null_in = 1;

DROP TABLE target_04815;

CREATE TABLE t_mrg_ck_1 (k UInt64) ENGINE = MergeTree ORDER BY k AS SELECT number FROM numbers(100000);

INSERT INTO ts_agg_states SELECT 1, initializeAggregation('timeSeriesRateToGridState(100, 200, 20, 100)', arrayMap(x -> toDateTime64(x, 3, 'UTC'), [155, 110, 200, 125, 140, 185, 170]), [5., 1, 8, 3, 2, 6, 4]);

DROP DICTIONARY IF EXISTS d_04816;

-- All parts have the projection: the aggregation becomes merge-only, the heap
-- cannot run, so no Top-K annotation and no leftover synthesized sort.
SELECT 'full_projection';

INSERT INTO opt_projection_mixed
SELECT k, sum(v) AS s FROM t_top_k_proj_mixed GROUP BY k ORDER BY k LIMIT 10;

SELECT count() AS series_count, sum(length(samples)) AS sample_count
FROM prometheusQueryRange(
    'prometheus',
    'last_over_time(dense_unless_left[10]) unless on(test_case) last_over_time(sparse_unless_right[10])',
    100, 130, 10);

CREATE TABLE 04817_m_rocksdb (k UInt64) ENGINE = EmbeddedRocksDB PRIMARY KEY (k);

SELECT l, r
FROM (SELECT 1::UInt8 AS l) AS t1
CROSS JOIN (SELECT toUInt8(moduloOrNull(number, 10)) AS r FROM numbers(1) ARRAY JOIN [1]) AS t2
SETTINGS enable_lazy_columns_replication = 1, query_plan_join_swap_table = false, query_plan_optimize_join_order_limit = 0;

-- 2024-01-01 is a Monday, 2024-01-06 is a Saturday.
INSERT INTO logs_04817 VALUES
    ('2024-01-01 06:00:00', 'monday-morning', '5'),
    ('2024-01-01 22:00:00', 'monday-night', '7'),
    ('2024-01-06 12:00:00', 'saturday-noon', '11');

SELECT '-- old analyzer: refused';

INSERT INTO t_wpb_saf SELECT number, uniqState(number) FROM numbers(6) GROUP BY number;

SELECT default_kind, default_expression, compression_codec FROM system.columns
WHERE database = currentDatabase() AND table = 't_mat_to_alias' AND name = 'type_uid';

CREATE TABLE t_mat_codec_to_alias
(event String, type_uid UInt32 MATERIALIZED JSONExtractUInt(event, 'type_uid') CODEC(T64, LZ4))
ENGINE = MergeTree() ORDER BY tuple();

CREATE TABLE t_streams_mult_4 (id Int32) ENGINE = MergeTree ORDER BY id;

-- A subquery inside PREWHERE still rewrites its own IN; only the PREWHERE predicate itself does not
SELECT count() FROM t_114026 PREWHERE s IN (SELECT s FROM t_114026 WHERE k IN (SELECT number FROM numbers(3))) SETTINGS rewrite_in_to_join = 1, allow_correlated_subqueries = 1;

SET logsql_table = 'logs_04821';

SELECT count(), countIf(rv != ''), sum(k)
FROM t04821_l AS l LEFT JOIN (SELECT k, rv FROM t04821_r GROUP BY k, rv WITH TOTALS) AS r
USING (k)
SETTINGS join_algorithm = 'hash';

SELECT array_position(current_schemas(false), currentDatabase()) FROM system.one;

print timespan(null);

print make_timespan(0, -1, 0);

INSERT INTO logs_dst_04822 SELECT toDateTime('2024-03-30 00:00:00', 'Europe/Amsterdam') + number * 1380, 'm' FROM numbers(120);

-- A tie at the boundary rounds half to even: avg = ...806.5 -> ...806.
SELECT avg(x) FROM (SELECT fromUnixTimestamp64Nano(if(number % 2 = 0, 9223372036854775807, 9223372036854775806), 'UTC') AS x FROM numbers(100));

SELECT 'semi same', (SELECT arraySort(groupArray(l.id)) FROM bnl_l l LEFT SEMI JOIN bnl_r r ON l.x < r.y WHERE l.id > 3)
  = (SELECT arraySort(groupArray(l.id)) FROM bnl_l l LEFT SEMI JOIN bnl_r r ON l.x < r.y WHERE l.id > 3
     SETTINGS query_plan_filter_push_down = 0, optimize_move_to_prewhere = 0) AS ok;

CREATE TABLE logs_04824
(
    `_time` DateTime64(9, 'UTC'),
    `_msg` String,
    `num` UInt64,
    `size` String
) ENGINE = MergeTree ORDER BY _time;

-- The parser produces a bare `SelectWithUnionQuery` argument of `viewIfPermitted` only for the table
-- function form `viewIfPermitted(SELECT ... ELSE table_function(...))`: `ViewLayer` pushes the select,
-- and after `ELSE` only a function call is accepted, so the shape is always exactly (select, function)
-- without parameters. `ASTFunction::formatImplWithoutAlias` prints the `ELSE` form (parseable only by
-- the table function parser) for exactly that shape, so `ASTFunction::readJSON` must reject any other
-- combination that contains a bare select, which the parser cannot produce and which would otherwise
-- format to unparseable text. Note that in an expression context `viewIfPermitted` parses as an
-- ordinary function (e.g. `viewIfPermitted(1, 2)`), so shapes without a bare select stay accepted.

SET enable_json_ast_dialect = 1;

-- Regressions for `let` binding source-only tabular right-hand sides (a parenthesized
-- source, `union`), for the tabular-subquery form of `in` (`x in (T | project key)`), and
-- for datetime `bin_at` returning null for a negative bin size like the numeric form does.

SET enable_kusto_dialect = 1;

print '-- in~ does not take a tabular expression --';

SELECT quantileDeterministicMerge(state) FROM quantile_deterministic_alter_modify;

DROP DICTIONARY bnl_ps_dict;

-- - no-parallel - due to usage of fail points

-- A plain INSERT fans out to `max_insert_threads` parallel sinks. The "too many parts" check must
-- not count the parts committed by the insert's own sibling sinks: an insert that brings the table
-- exactly to `parts_to_throw_insert` used to be spuriously rejected with `TOO_MANY_PARTS` when one
-- of its sinks started late (e.g. on a loaded machine). The failpoint skews the sinks' start times
-- to make the race deterministic.
-- https://github.com/ClickHouse/ClickHouse/issues/114015

DROP TABLE IF EXISTS test_too_many_parts_race;

DROP TABLE t_date32_numeric_field_range;

-- The cancelled shard never sends a Totals packet, so the totals port asserted above delivers zero
-- chunks. The right side must still be finalized: reading it unmerged dereferences a null
-- `RowBitmaps`.
-- The result is the oracle, so it is printed rather than discarded: `8 0` means the shard was
-- cancelled as intended, and `8 8` would mean the right rows arrived and the starved-totals path
-- was never taken. A throwing timeout keeps an incomplete execution from passing as success.
SELECT '-- starved totals port';

-- the fold itself still happens and the filter passes
SELECT count() FROM (
    WITH '1234567890123456' AS key, materialize(key) = '1234567890123456' AS cond
    SELECT encrypt('aes-128-ecb', 'v', key) FROM numbers(1) WHERE cond);

-- Positives: both parser-produced forms round-trip.

SELECT formatQueryFromJSON(parseQueryToJSON($$SELECT * FROM view(SELECT 1)$$))
    = formatQuerySingleLine($$SELECT * FROM view(SELECT 1)$$);

SELECT 1 IN (materialize(1), 'x', NULL);

-- A literal that does not fit even the full Decimal256 precision (77 fractional digits)
-- falls back to the lossy Float64 comparison instead of silently truncating.
num:=0.11111111111111111111111111111111111111111111111111111111111111111111111111111 | count();

-- The initiator-local arm was built for the affected shape, which is the arm holding the clone under test.
-- The snapshot replica is pinned only on that arm, so a regression routing this shape to the remote-only
-- arm would stop exercising the clone while the counter above stayed green.
SYSTEM FLUSH LOGS query_log, text_log;

range d from datetime(2026-01-02) to datetime(2026-01-01) step 1d | count;

DROP TABLE t_nested_path;

SELECT count() FROM (SELECT f + 1.0 AS k, count() FROM t_float GROUP BY k) SETTINGS force_aggregate_partitions_independently = 1;

DROP TABLE IF EXISTS mrp_b;

INSERT INTO mrp_pk SELECT number, number * 10 FROM numbers(40);

SELECT 'parallel replicas, merge tables allowed';

DROP TABLE mrp_allow;

SELECT (SELECT count() FROM k_fs WHERE mapContainsKey(m, 'K1')) = (SELECT count() FROM o_fs WHERE mapContainsKey(m, 'K1'));

-- Regressions for three review findings: `range` over integers must count exactly (a
-- `Float64` cannot tell integers above 2^53 apart), aggregate functions are rejected
-- outside the aggregation list of `summarize`, and a `let` may bind a bare physical table
-- name (`let T = Events;`), also through a parameterless function body.

SET enable_kusto_dialect = 1;

print b;

-- The parentheses do not have to be at the top level of the expression.
DROP TABLE IF EXISTS t_nested_parens_src;

-- Read in order with `ORDER BY` under plan-based parallel replicas (`parallel_replicas_plan_based`).
--
-- The split is lifted through the `SortingStep`, so the sort ships inside the fragment and each replica reads
-- in order; the initiator merges the already sorted streams. Both sides re-derive read-in-order from the same
-- sort description, so they agree on `CoordinationMode::WithOrder` (ASC) or `ReverseOrder` (DESC) - a
-- disagreement would throw "Replica ... decided to read in ... mode, not in ...".
--
-- The correctness half of the test is direction-agnostic: `ORDER BY` results must be identical to
-- non-parallel execution, with LIMIT and with a deep OFFSET. Every ordered query is run with the split off
-- and on, so the two blocks must match line for line - a rewrite that loses one side of the union, or a merge
-- that does not respect the shipped sort description, changes them.

DROP TABLE IF EXISTS t_pr_read_in_order;

-- `LIMIT BY` picks N rows per key from the ordered stream, so it is order-sensitive in a different way: the
-- per-key selection happens on the initiator, above the merge of the per-replica streams.
SELECT '--- LIMIT BY, local ---';

SELECT a FROM t_pr_read_in_order ORDER BY a      LIMIT 5 SETTINGS exact_rows_before_limit = 1, enable_parallel_replicas = 0;

SELECT timestamp, value FROM timeSeriesSelector(ts_clustered, 'foo{env!=""}', 0, 1000, 'timestamp_and_value') ORDER BY value, timestamp;

INSERT INTO FUNCTION timeSeriesTimeRanges({CLICKHOUSE_DATABASE:Identifier}.ts_foreign_id) (id, min_time, max_time) VALUES
    (tuple(1, toUUID('00000000-0000-0000-0000-000000000001')), toDateTime64(100, 3), toDateTime64(100, 3));

-- `ASTWindowDefinition::frame_begin_offset`, a child of the definition an inline `OVER` clause
-- holds by pointer.
SELECT k, s FROM (
    SELECT 1 AS k, sum(w) AS s FROM view(SELECT sum(number) OVER (ORDER BY number ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) AS w FROM numbers(4))
    UNION ALL
    SELECT 2 AS k, sum(w) AS s FROM view(SELECT sum(number) OVER (ORDER BY number ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS w FROM numbers(4))
) ORDER BY k;

-- `make_distributed_plan` rejects a nonzero aggregation cap because it cannot enforce it
-- globally after splitting the aggregation. The aggregate cutoff must stay disabled here:
-- if it armed, the plan-level distribution would reject the capped `AggregatingStep` with
-- an exception instead of returning the rows. `max_rows_to_group_by = 0` clears the CI
-- profile's global cap (the convention of the other `make_distributed_plan` tests), and a
-- single localhost shard is used because `make_distributed_plan` rejects the fragment a
-- shard receives from a remote initiator regardless of the cutoff.
-- `prefer_localhost_replica = 1` is pinned for the same reason: with 0 (randomized in CI)
-- even the localhost shard receives its fragment over TCP as a remote initiator.
SELECT count() FROM
(
    SELECT k, count()
    FROM remote('127.0.0.1', view(SELECT toUInt64(number % 97) AS k FROM numbers(10000)))
    GROUP BY k LIMIT 10
    SETTINGS make_distributed_plan = 1, distributed_plan_execute_locally = 1, max_rows_to_group_by = 0, prefer_localhost_replica = 1
);

SELECT id FROM 04836_view_not_in ORDER BY id SETTINGS optimize_trivial_view_pushdown_to_distributed = 0;

DROP TABLE IF EXISTS t_t64;

-- Tag no-shared-merge-tree, no-replicated-database: the test joins two explicit replicas of one
-- ReplicatedMergeTree table to compare what each of them has written to ZooKeeper.
-- Tag no-random-merge-tree-settings: the test shows the definition of a table, and the randomized
-- settings would be printed with it.

-- A replica compares its own definitions with the ones stored in ZooKeeper, which may have been
-- written by a server that did not remember the redundant parentheses the user wrote (they became
-- a part of the AST only in 26.5). Neither the comparison nor the stored form may depend on them.

DROP TABLE IF EXISTS t_parens_zk_r1 SYNC;

SELECT '--- all replicas announce (empty result expected), plan_based = 1, local_plan = 0 ---';

INSERT INTO 04837_other VALUES (100);

-- The same when the subcolumn is used in the partition key
CREATE TABLE test (a Tuple(x UInt64, y UInt64), b UInt64) ENGINE = MergeTree PARTITION BY a.x ORDER BY b;

DROP TABLE IF EXISTS t_filter_dim;

EXPLAIN SELECT sum(v) OVER (PARTITION BY a % 2 ORDER BY v) AS s FROM t_window_shapes;

SELECT '-- RANGE frame';

SELECT 'no hint', count() FROM t_index_hint WHERE id >= 1 AND id <= 3;

SELECT 'typed null', count() > 0 FROM system.tables
WHERE database = currentDatabase() AND indexHint(CAST(NULL, 'Nullable(String)'));

SELECT 'and branch', count() FROM t_index_hint WHERE (id >= 1 AND id <= 3) AND toNullable(256);

SELECT 'indexed no boolean', count() FROM t_index_hint_minmax WHERE (id >= 1 AND id <= 3) AND indexHint(CAST(NULL, 'Nullable(String)'));

-- Two parts each, so that the row index spans parts.
INSERT INTO l SELECT number, number % 97, concat('l', toString(number)) FROM numbers(5000);

SELECT countIf(explain LIKE '%LazilyReadFromMergeTree%') FROM (EXPLAIN compact = 0 SELECT l.k, l.heavy, s.c FROM l JOIN (SELECT b, count() AS c FROM r GROUP BY b) AS s ON l.a = s.b ORDER BY l.a, l.k LIMIT 3);

SELECT l.k, l.heavy, r.rheavy FROM l JOIN r ON l.a = r.b WHERE l.k < 300 AND r.k < 900 ORDER BY l.k, r.k LIMIT 6 SETTINGS query_plan_lazy_materialization_for_join = 0;

SELECT b, a FROM t_pr_top_k ORDER BY b, a LIMIT 5;

-- A deep OFFSET, applied once above the merge, while a replica may stop at `LIMIT` + `OFFSET` rows.
SELECT '--- Top-K disabled, deep OFFSET, local ---';

SELECT 'normal_results';

INSERT INTO t_codec_plain SELECT number, number FROM numbers(1e5);

DROP TABLE IF EXISTS t_stats_gate_dist;

let T = system.['one'];

SELECT f.k, f.v, f.heavy, d.dheavy FROM d LEFT JOIN f FINAL ON f.k = d.k WHERE d.b = 2 AND d.k >= 29980 ORDER BY d.k LIMIT 6 SETTINGS query_plan_optimize_lazy_final = 1, join_use_nulls = 1;

select v from test_escape_compact;

CREATE TABLE t_json_combined_text
(
    json JSON,
    INDEX idx JSONAllPaths(json) TYPE text(tokenizer = 'splitByNonAlpha') GRANULARITY 1
)
ENGINE = MergeTree ORDER BY tuple()
SETTINGS index_granularity = 2;

SELECT 'path named ^a index used';

INSERT INTO t_minmax_widened_merge SELECT toDate('2018-10-01') + number % 3, toString(number), number FROM numbers(3, 3);

-- ORDER BY keeps the printed rows deterministic; without it the three returned rows depend on
-- read order, while rows_before_limit_at_least is what this case actually asserts.
SELECT DISTINCT n FROM t_erbl ORDER BY n LIMIT 3 FORMAT JSONCompact SETTINGS exact_rows_before_limit = 1, output_format_write_statistics = 0;

SELECT (SELECT count() FROM k_lcfsv WHERE has(mapValues(m), 'V0')) = (SELECT count() FROM o_lcfsv WHERE has(mapValues(m), 'V0'));

-- toDateTime, toDateTime32 and toDateTime64 inherit the time zone of their argument.
SELECT toTypeName(toDateTime(toDateTime('2020-01-01 00:00:00', 'Europe/Amsterdam')));

print isnull(bin_at(datetime(2017-05-15 10:20:00), -1d, datetime(2017-05-15 12:00:00)));

-- CREATE ... POPULATE reaches the same hop through the population insert, not a user INSERT.
INSERT INTO src VALUES (2);

INSERT INTO test_wrapped_key SELECT '2026-04-15 12:00:00.500' FROM numbers(3);

CREATE TABLE test_wrapped_key_signed (ts DateTime64(3))
ENGINE = MergeTree ORDER BY toInt128(ts) SETTINGS index_granularity = 1;

DROP TABLE test_wrapped_key_uint128;

INSERT INTO o_has_lcfs VALUES (0, {'K1':1}), (1, {'XYZ':2});

-- `default` is the negation of all the explicit cases, wherever it is written.
* | stats count() switch(default as others, case (level:=info) as infos);

INSERT INTO t04849_lf_dst SELECT number, 1, if(number % 2 = 0, ['bar', 'baz'], ['baz']) FROM numbers(64);

SELECT 'M lazy FINAL, single predicate';

DROP TABLE t_mut_prune_multi SYNC;

DROP VIEW v_04850;

insert into tab select number + 5 * 100000, 1 from numbers(100000);

INSERT INTO t_stats_prune_in_throwing VALUES ('a', 1), ('a', 100), ('a', 200);

SELECT count() FROM plain_mt_pr_pinned AS p JOIN quorum1_pr_pinned AS q ON p.n = q.n
SETTINGS parallel_replicas_local_plan = 0, parallel_replicas_prefer_local_replica = 0, select_sequential_consistency = 0;

SET format_custom_field_delimiter = ',';

SELECT k, b, length(b) FROM t_missing_marker_conflict ORDER BY k;

ALTER TABLE t_missing_marker_absent ADD COLUMN b UInt64;

-- A constant column above the magnitude bound, weighted: the ratio evaluator has its own
-- equal-endpoint return.
SELECT quantileInterpolatedWeighted(0.6)(x, 1) FROM (SELECT toDecimal128('1700000000000000001', 0) AS x FROM numbers(2));

INSERT INTO t_curve_nested_key SELECT number, number FROM numbers(20000);

CREATE TABLE fpc_32 (f32 Float32 CODEC(FPC))
    ENGINE = MergeTree ORDER BY tuple()
    SETTINGS min_rows_for_wide_part = 1000000000, min_bytes_for_wide_part = 1000000000,
             index_granularity = 8192, index_granularity_bytes = 10485760;

INSERT INTO gcd_16 SELECT (number % 100) * 11 FROM numbers(20000);

CREATE TABLE t_or_head (a2 Int32, b2 Int32, probe_order UInt8) ENGINE = MergeTree ORDER BY probe_order;

SELECT count(), uniqExact(a1), countIf(a2 = 0) FROM
(
    SELECT a1, a2 FROM t_or_groups ANY LEFT JOIN t_or_probes ON (b1 = a2 OR a1 = b2) AND a1 + a2 != -12345
) SETTINGS query_plan_join_swap_table = 'true';

-- x becomes its type default, so m has to be recomputed through the alias to (0 + 100) + 1.
ALTER TABLE t_clear_over_alias CLEAR COLUMN x IN PARTITION tuple();

-- A cleared column that feeds no MATERIALIZED column must still not be recomputed into the part,
-- and the block columns must not make the mutation invent one.
DROP TABLE IF EXISTS t_clear_unrelated_block_columns;

-- Tests that the DPsub join-order algorithm keeps single-table filter predicates that live in a
-- join's ON clause (e.g. `... JOIN t ON t.a = u.a AND t.b = 'x'`). DPsub attaches such a predicate
-- at the join that introduces its relation. Two earlier placement bugs silently dropped the
-- predicate, letting extra rows through:
--   1. attaching only at two-relation joins dropped it when the relation was introduced against an
--      already-multi-relation subplan (e.g. `t1 JOIN (t2 JOIN t3)`);
--   2. gating on fromLeft()/fromRight() dropped it for any filter on a relation whose id is >= 2,
--      because those helpers test relation ids 0 and 1 specifically.
-- For each shape we print the result with the 'greedy' algorithm (the reference, which places the
-- predicate correctly) and with 'dpsub'; the two must be identical row-for-row.
--
-- `query_plan_enable_optimizations = 0` is required to expose the bug and does NOT disable join
-- reordering (that is controlled by `query_plan_optimize_join_order_algorithm`). It disables the
-- general plan-optimization passes, notably filter push-down; with push-down enabled the
-- single-table filter is applied independently of the join and masks the dropped ON-clause
-- conjunct, so the wrong-result would not surface.

DROP TABLE IF EXISTS t1;

DROP TABLE IF EXISTS t_json_max_buckets_compact;

SELECT x, m1, m2, m3 FROM t_on_fly;

SYSTEM STOP MERGES t_on_fly_unaffected;

SYSTEM START MERGES t_on_fly_ephemeral;

CREATE TABLE t_typed_alias (x UInt16, a UInt8 ALIAS x, m UInt16 MATERIALIZED a)
ENGINE = MergeTree ORDER BY tuple();

CREATE TABLE t_merge_filter_wide (id Int64) ENGINE = MergeTree ORDER BY id;

ALTER TABLE t_compact_readonly_dependency UPDATE a = a + 1 WHERE 1 SETTINGS mutations_sync = 2;

CREATE TABLE t_delete_over_chain
(
    x Int32,
    y Int32,
    m1 Int32 MATERIALIZED x + 1,
    m2 Int32 MATERIALIZED m1 + 1
)
ENGINE = MergeTree ORDER BY tuple();

SYSTEM START MERGES t_subcolumn_in_predicate;

SELECT countIf(explain LIKE '%ScatterByPartitionTransform%') > 0, countIf(explain LIKE '%DistinctTransform × 4%') > 0
FROM (EXPLAIN PIPELINE SELECT DISTINCT number % 1000 FROM numbers_mt(10000000));

SELECT groupArray(a) = arraySort(groupArray(a)) FROM (SELECT DISTINCT a FROM t_parallel_distinct ORDER BY a);

SELECT '-- Raw: captures without a tab are unchanged';

SELECT '-- well-formed fields are still accepted';

SELECT count() = 0 FROM (EXPLAIN indexes = 1 SELECT count() FROM t_absent_col WHERE c = 0) WHERE extract(explain, 'Granules: (\d+/\d+)') NOT IN ('', '16/16');

SELECT count() > 0 FROM (EXPLAIN indexes = 1 SELECT count() FROM t_materialize_absent WHERE c = 150) WHERE explain ILIKE '%Granules: 1/16%';

SELECT '-- 26d. the same on a compact part, where a later mutation reads the column for the index again';

ALTER TABLE t_rematerialize_absent MATERIALIZE INDEX idx SETTINGS mutations_sync = 2, alter_sync = 2;

DROP TABLE IF EXISTS merge_distinct;

datatable (x:string, y:string) ['a', 'z', 'b', 'c'] | where x in (y, 'b') | project x;

print timespan(null) / 1h;

SELECT kqlBin(toDateTime64('2026-08-01 12:34:56', 7, 'UTC'), toLowCardinality(toIntervalHour(1)));

SELECT kqlBin(toDate('2026-08-01'), toIntervalDay(1)) SETTINGS session_timezone = 'UTC';

SELECT count() FROM t_stale_tz_nullable WHERE toHour(dt) = 9 SETTINGS use_skip_indexes = 0, use_query_condition_cache = 0;

SELECT count() > 0 FROM (EXPLAIN indexes = 1 SELECT count() FROM t_keep_tz_expr WHERE toHour(dt) = 5) WHERE explain ILIKE '%Granules: 3/16%';

SELECT count() > 0 FROM (EXPLAIN indexes = 1 SELECT count() FROM t_keep_agg WHERE toHour(finalizeAggregation(v)) = 5) WHERE explain ILIKE '%Granules: 3/16%';

SELECT count() > 0 FROM (EXPLAIN indexes = 1 SELECT count() FROM t_keep_json_int WHERE toString(j) = 'x') WHERE explain ILIKE '%Granules: 0/16%';

SELECT count() FROM numbers(1) WHERE CAST((toUInt16(256), number), 'Nullable(Tuple(UInt16, UInt64))') NOT IN (SELECT CAST((0, 0), 'Tuple(Int8, UInt64)'));

INSERT INTO t_sub_dst SELECT 1000 + number, tuple(number % 2) FROM numbers(4);

SELECT count() FROM t_keep_subexpr_dst WHERE toString(p.x) = '0';

SYSTEM STOP MERGES t_keep_quant_dotted;

SELECT '-- 28. dropping the LowCardinality wrapper is a framing change, so it must refuse';

DROP TABLE t_keep_quant_src;

SELECT length(vec), id FROM tab_vec_consumers
ORDER BY L2Distance(vec, [0., 2.]) ASC
LIMIT 3
SETTINGS vector_search_with_rescoring = 0, query_plan_optimize_lazy_materialization = 0;

INSERT INTO p_lcnstr SELECT number, [if(number = 7, 'V0', concat('z', toString(number)))] FROM numbers(64);

-- The reduction is real and both modes agree on it: all four select exactly the granule holding row 7.
SELECT 'prune lcfs3 has FS3 is 7', (SELECT groupArray(id) FROM (SELECT id FROM p_lcfs3 WHERE has(v,toFixedString('V0',3)) ORDER BY id)) = [7];

-- Two needles across three granules: one row has only the first, one only the second, one both. So
-- dropping EITHER hash changes the selected ROW SET, which a result cell can see; with both needles
-- on a single row it does not, and only the granule count moves. `hasAny` is the cell that sees it:
-- the index ORs the hashes, so a missing hash prunes a granule the runtime can never bring back.
-- `hasAll` ANDs them, so a missing hash only ADDS granules and the runtime `hasAll` removes the
-- extra rows again, which is why the cell below it is a must-not-change control rather than a
-- dropped-hash detector.
SELECT 'prune fs3m hasAny ids are 5 7 11', (SELECT groupArray(id) FROM (SELECT id FROM p_fs3m WHERE hasAny(v,[toFixedString('V0',5),toFixedString('V0A',5)]) ORDER BY id)) = [5,7,11];

SELECT 'carrier any convert=0', count()
FROM (SELECT a FROM events_04872 ANY LEFT JOIN keys_04872 ON events_04872.a = keys_04872.b
      WHERE runningConcurrency(s, e) = 2 AND keys_04872.b > 1)
SETTINGS query_plan_convert_any_join_to_semi_or_anti_join = 0;

-- Negative control: a deterministic TTL expression is still accepted.
CREATE TABLE ttl_plain_04872 (a UInt64, s DateTime, e DateTime) ENGINE = MergeTree ORDER BY a
    TTL s + toIntervalSecond(1);

-- The pass disables itself for the whole query when a join can wrap results in Nullable, so
-- stress workers setting join_use_nulls = 1 would make the positive-control arm assert 0.
SET join_use_nulls = 0;

-- Negative control: a deterministic query still caches.
SELECT 'deterministic', a FROM events_04874 SETTINGS use_query_cache = 1;

-- Sibling control: a running function that already opted out of lazy execution behaves the same,
-- which is the precedent this fix follows.
SELECT 'sibling', groupArray(m) FROM
    (SELECT if(i % 2 = 0, rowNumberInAllBlocks(), 999) AS m FROM (SELECT * FROM events_04876 ORDER BY s))
SETTINGS short_circuit_function_evaluation = 'enable';

EXPLAIN PLAN SELECT k, sum(v) FROM t_shuffle_bucket_order GROUP BY k
    SETTINGS make_distributed_plan = 1,
             distributed_aggregation_memory_efficient = 1,
             enable_memory_bound_merging_of_aggregation_results = 1,
             distributed_plan_force_shuffle_aggregation = 1;

-- An Enum needle reaches a float element through its underlying number, so it must be declined too.
SELECT arrayMap(x -> reinterpretAsUInt64(x), a) AS stored_bits, has(a, CAST('z', 'Enum8(\'z\' = 0, \'o\' = 1)')) AS enum8_needle, indexOf(a, CAST('z', 'Enum8(\'z\' = 0, \'o\' = 1)')) AS enum8_index, countEqual(a, CAST('z', 'Enum16(\'z\' = 0, \'o\' = 1)')) AS enum16_count, length(arrayFilter(x -> x = toFloat64(0), a)) AS oracle FROM format(JSONEachRow, 'a Array(LowCardinality(Float64))', '{"a":[-0.0,1.5]}');

SELECT 'ctl materialize', count() FROM t_pw FINAL PREWHERE materialize(b) SETTINGS apply_prewhere_after_final = 1;

-- Deferred bare subcolumn policy stacked with a deferred bare column PREWHERE. The expected count
-- is computed from the source data, independently of any read path.
SELECT 'policy subcolumn and pw', count() FROM t_rp_sub FINAL PREWHERE ov SETTINGS apply_prewhere_after_final = 1;

DROP TABLE t_eng3;

SELECT 'flip policy deferred', count() FROM t_ver_rp FINAL;

drop table t_04883;

INSERT INTO t_const_window SELECT number % 10, number + 40000000 FROM numbers(4000);

select count(), sum(key) from test_dia_proj where value in (500000, 2500000) settings cluster_for_parallel_replicas='parallel_replicas', distributed_index_analysis=1;

SELECT '-- shuffle join, setting on: states crossed the exchange';

DROP TABLE IF EXISTS t_u16_r;

CREATE TABLE t_rf_l (k UInt8) ENGINE = MergeTree ORDER BY tuple();

SELECT
    (SELECT arraySort(groupArray((l.k, l.v, r.v))) FROM t_i16_l AS l INNER JOIN t_i16_r AS r ON l.k = r.k SETTINGS hash_join_layout = 'parallel')
    = (SELECT arraySort(groupArray((l.k, l.v, r.v))) FROM t_i16_l AS l INNER JOIN t_i16_r AS r ON l.k = r.k);

SET logsql_table = 'logs_04891';

SELECT '-- mergeTreeAnalyzeIndexes returns mark ranges, not values, so the policy does not apply';

CREATE DICTIONARY dict_two_keys
(
    k UUID,
    k2 String,
    attr String DEFAULT ''
)
PRIMARY KEY k, k2
SOURCE(CLICKHOUSE(TABLE 'ref_source'))
LAYOUT(COMPLEX_KEY_HASHED())
LIFETIME(0);

-- `like` also rewrites into the `IN` subquery form.
SELECT 'tuple(k), like - plan';

SELECT count() FROM data
WHERE dictGet('dict_single_key', 'attr', if(k != '33333333-3333-3333-3333-333333333333', tuple(k), NULL)) LIKE 'pay%';

SELECT 'implicit key conversion, simple key, equals - plan';

SELECT count() FROM data_wide WHERE dictGet('dict_narrow_key', 'attr', w) = 'paywall'
SETTINGS optimize_inverse_dictionary_lookup = 0;

SELECT count() FROM data_nk WHERE isNull(dictGet('dict_nullable_key', 'attr', if(id != 0, tuple(id), NULL)) = 'x')
SETTINGS optimize_inverse_dictionary_lookup = 0;

DROP TABLE IF EXISTS data_mc;

SELECT count() FROM data_mc WHERE dictGet('dict_mc', 'attr', kt) = 'paywall';

INSERT INTO tab SELECT
    if(number < 8192, number, 8192 + intHash32(number) % 4294959104),
    number,
    number >= 8192
FROM numbers(100_000)
SETTINGS max_insert_threads = 1, max_insert_block_size = 2_000_000, min_insert_block_size_rows = 2_000_000;

CREATE ROW POLICY policy_04891 ON tab FOR SELECT USING w = 1 TO user_04891;

INSERT INTO t1 SELECT number FROM numbers(10);

-- SEMI and ANTI, which exist for LEFT and RIGHT only. Without a side they are LEFT.
SELECT count() FROM t1 SEMI LEFT JOIN t2 ON t1.a = t2.a FORMAT Null SETTINGS log_comment = '04891_join_count_matrix_11_semi_left';

SELECT used_number_of_joins, used_join_algorithms, used_join_kinds, used_join_strictness, spilled_to_disk
FROM joins_log
WHERE type = 'QueryFinish'
  AND log_comment LIKE '04891\_join\_count\_none%'
ORDER BY log_comment;

SELECT 'partial merge spilling';

SELECT toDateTime(tumbleEnd(toDateTime('2020-01-09 12:00:01', 'US/Samoa'), INTERVAL '1' DAY, 'US/Samoa'), 'US/Samoa');

INSERT INTO ts_lc (metric_name, tags, samples) VALUES
    ('foo', map('env', 'prod'), [(toDateTime64(100, 3), 1.), (toDateTime64(200, 3), 2.), (toDateTime64(300, 3), 3.)]),
    ('foo', map('env', 'dev'), [(toDateTime64(150, 3), 10.), (toDateTime64(250, 3), 20.)]),
    ('foo', map(), [(toDateTime64(100, 3), 5.)]),
    ('bar', map('env', 'dev'), [(toDateTime64(100, 3), 100.), (toDateTime64(300, 3), 300.)]);

select cast(null, 'Nullable(JSON(a UInt32))').a as x, toTypeName(x);

INSERT INTO small_nullable SELECT number * 100 FROM numbers(100);

SELECT accurateCastOrDefault(toTime64('00:00:00.5', 1), 'Time', toTime('01:02:03'));

DROP TABLE t1_04893;

SELECT uniqExact(extract(query, '^rf_merge_\\d+_(_runtime_filter_\\d+)')) = 2
   AND (
       SELECT sum(ProfileEvents['RuntimeFilterStatesSent'])
       FROM system.query_log
       WHERE type = 'QueryFinish' AND event_date >= yesterday() AND query LIKE 'stage_%'
         AND initial_query_id IN (
             SELECT query_id FROM system.query_log
             WHERE type = 'QueryFinish' AND is_initial_query AND event_date >= yesterday()
               AND current_database = currentDatabase() AND log_comment = '04894_nested_placement')
   ) >= 2
FROM system.query_log
WHERE type = 'QueryFinish' AND event_date >= yesterday() AND query LIKE 'rf_merge_%'
  AND initial_query_id IN (
      SELECT query_id FROM system.query_log
      WHERE type = 'QueryFinish' AND is_initial_query AND event_date >= yesterday()
        AND current_database = currentDatabase() AND log_comment = '04894_nested_placement');

CREATE TABLE t_large (lid UInt64) ENGINE = MergeTree ORDER BY lid SETTINGS index_granularity = 8192, index_granularity_bytes = '10Mi';

SELECT toTypeName(LpDistance([toFloat32(1)], [toFloat32(1)], toInt128(2)));

SELECT 'flag still active outside the view boundary';

SELECT '-- rollup, group_by_use_nulls = 0';

SELECT 'bowtie 3-arg, lightweight',
    (SELECT count() FROM pip_pk WHERE pointInPolygon((x, y), [(0., 0.), (4., 4.), (4., 0.), (0., 4.)], [(1., 1.), (2., 1.), (2., 2.), (1., 2.)])
        SETTINGS use_lightweight_primary_key_index_analysis = 1),
    (SELECT count() FROM pip_nopk WHERE pointInPolygon((x, y), [(0., 0.), (4., 4.), (4., 0.), (0., 4.)], [(1., 1.), (2., 1.), (2., 2.), (1., 2.)]));

SELECT 'increase with offset, range:';

DROP TABLE t_grouping_dist;

INSERT INTO i_lc SELECT number, toFloat64(number) FROM numbers(512, 9488);

SELECT 'idx dnl', count() FROM (EXPLAIN indexes = 1 SELECT v FROM i_lead ORDER BY v DESC LIMIT 3) WHERE explain ILIKE '%topk granules%';

SELECT '-- cube over three keys';

SELECT arraySort(groupArray(r.x))
FROM numbers(3) AS l
INNER JOIN merge(currentDatabase(), '^t04903_(physical|alias)$') AS r ON l.number = r.key;

-- `NOT has` keeps the atom, so the index is still analyzed. It prunes nothing: a bloom filter only answers "the needle
-- may be present in this granule", so the negation of that answer is always "may be true".
SELECT trimLeft(explain) FROM (EXPLAIN indexes = 1 SELECT count() FROM t_not_has_bloom_filter WHERE NOT has(arr, 3)) WHERE explain LIKE '%Name: idx%' OR explain LIKE '%Granules:%';

SELECT count() FROM t_not_has_text WHERE notHas(arr, 'w3');

SELECT t.id
FROM tab_04903 AS t
GLOBAL JOIN (SELECT toUInt32(number) AS rid FROM numbers(2)) AS r ON t.id = r.rid
PREWHERE hasTokenCaseInsensitive(t.key, 'foo')
WHERE hasAllTokens(t.key, 'foo');

SELECT '5', c FROM t_mod_def;

ALTER TABLE t_mod_def MODIFY COLUMN c UInt32 MATERIALIZED JSONExtractUInt(event, 'x'),
                      MODIFY COLUMN c UInt64;

SELECT 'max_threads = 2';

-- The target-only row `k = 0` must not evaluate the throwing predicate
SELECT count()
FROM (SELECT * FROM prop_throwing_src WHERE intDiv(1, k) = 1) AS s
INNER JOIN prop_throwing_dst AS d ON s.k = d.k;

SELECT 'multiIf strings not expected to work';

INSERT INTO t_replacing_is_deleted_04906 VALUES (2, 'test4', 2, 1);

SELECT count() > 0 AS lazy_read_step
FROM (
    EXPLAIN PLAN header = 1
    SELECT key, someCol FROM t_replacing_is_deleted_04906 FINAL PREWHERE (ver > 0) OR (database != '') ORDER BY key LIMIT 1
    SETTINGS explain_query_plan_default = 'legacy', query_plan_remove_unused_columns = 1,
             query_plan_optimize_lazy_materialization = 0
)
WHERE explain LIKE '%LazilyReadFromMergeTree%';

SELECT key, someCol FROM t_replacing_04906 FINAL PREWHERE (ver > 0) OR (database != '') ORDER BY key
SETTINGS query_plan_remove_unused_columns = 0;

INSERT INTO t_versioned_collapsing_04906 VALUES (2, 'test2', 1, 2);

SELECT toDate('2023-08-25', toLowCardinality('UTC'));

-- `Merge` can contain arbitrary table engines, not only `MergeTree` tables. `GenerateRandom`
-- creates one source per requested stream and does not reduce that count when the query has no
-- `LIMIT`. Verify that `Merge` rejects an absurd count before passing it to the child.

DROP TABLE IF EXISTS t_merge_generate_random;

DROP TABLE v0_r1 SYNC;

INSERT INTO pv_data VALUES ('a');

INSERT INTO t_prec SELECT number % 32, [number % 3, number % 5], number FROM numbers(1000);

INSERT INTO t_pr_merge_1 SELECT number, number % 10 FROM numbers(50000);

DROP TABLE m_pr_mergefinal;

SELECT toDecimalString(toDecimal64('0.499', 3), 0), toDecimalString(toDecimal64('-0.499', 3), 0);

DROP ROW POLICY 04907_vector_row_policy ON tab_vec_row_policy;

SELECT count() FROM t_max_size_rows;

DROP TABLE t_max_size_mv;

INSERT INTO t_pbm_2 SELECT number + 1000, number FROM numbers(1000);

CREATE TABLE t_pbm_log (k UInt64, v UInt64) ENGINE = Log;

DROP TABLE t_pbm_base;

CREATE TABLE t_distinct_proj_two_keys
(
    v Int64,
    w Int64,
    PROJECTION p (SELECT v, w, count() GROUP BY v, w)
)
ENGINE = MergeTree ORDER BY v;

DROP TABLE t_distinct_proj_nullable;

SELECT
    max(ProfileEvents['AggregationTopKHeapsFrozen']),
    max(ProfileEvents['AggregationTopKKeysEvicted']) BETWEEN 1 AND 999
FROM system.query_log
WHERE event_date >= yesterday() AND current_database = currentDatabase()
    AND type = 'QueryFinish' AND log_comment = '04909_burst_then_quiet';

SELECT count() FROM t WHERE id < 1000;

SELECT count() FROM t_max_size_r1;

DROP TABLE IF EXISTS t_pbmj_dim;

SELECT count(), sum(m.v) FROM t_pbmj_dim AS d INNER JOIN m_pbmj AS m ON d.k = m.k;

DROP TABLE t_pbmj_1;

DETACH TABLE test_04909_plain_wildcard;

SELECT max(ProfileEvents['AggregationTopKKeysPruned']) > 10000
FROM system.query_log
WHERE event_date >= yesterday() AND current_database = currentDatabase()
    AND type = 'QueryFinish' AND log_comment = '04910_long_serialized';

SELECT IPv4StringToNum(toLowCardinality('1.2.3.4')) = IPv4StringToNum('1.2.3.4');

CREATE TABLE t_pbmn_02 (k UInt64) ENGINE = MergeTree ORDER BY k;

SELECT countIf(explain LIKE '%Concat%') > 0 AS has_concat
FROM (EXPLAIN PIPELINE SELECT count() FROM m_pbmn
      SETTINGS max_streams_for_union_step = 0, max_streams_for_union_step_to_max_threads_ratio = 0);

SELECT 'Explicit LowCardinality branches do not leak into Variant';

SELECT 'Fully constant expressions stay String (no LowCardinality for constants)';

-- Four committed parts: enough marks that the coordinator distributes ranges over
-- more than one replica. A single-part table hides the bug, because every range is
-- then assigned to one replica and the pinned boundary is never crossed.
INSERT INTO t_pinned_pr_r1 SELECT number FROM numbers(3000);

DROP TABLE rmv_04913 SETTINGS ignore_drop_queries_probability = 1;

WITH CAST(NULL AS Nullable(String)) AS f SELECT if(number % 2, f, f) AS res, toTypeName(res) FROM numbers(2);

SELECT toTypeName(multiIf(number % 2, toLowCardinality(materialize('a')), toLowCardinality(materialize('b')))) AS t, multiIf(number % 2, toLowCardinality(materialize('a')), toLowCardinality(materialize('b')))
FROM numbers(2);

CREATE TABLE src (k UInt64, v UInt32) ENGINE = Memory;

CREATE MATERIALIZED VIEW mv ENGINE = TimeSeries AS SELECT 1 AS a;

-- Widening to `DateTime` (equal scales, a separate cast path).
SELECT if(number % 2 = 0, toTime('-01:00:00'), toDateTime('1970-01-01 00:00:00')) FROM numbers(2);

SELECT '-- 1. huge left side, few distinct keys: partial aggregation is pushed below the LEFT JOIN';

SELECT '-- 8. the same executions without the distributed planner must match';

SELECT '-- 18. B-dominance negative: a GROUP BY key from the other side falls back to variant A';

DROP TABLE t_push_dims_multi;

-- no-parallel-replicas: EXPLAIN ANALYZE rejects distributed plans (NOT_IMPLEMENTED).

-- `EXPLAIN ANALYZE` must reach the joins inside a view whose SQL security rebuilds the context
-- (`DEFINER` and `NONE` start from the global context). Under `hash` the `Left` group is reported
-- only when the join was told to collect statistics, so a zero count means the mode did not arrive.

SET join_algorithm = 'hash';

EXPLAIN QUERY TREE SELECT k1, k2, grouping(k1) + grouping(k2) AS level, sum(v)
FROM t_grouping_validation GROUP BY k1, k2;

DROP TABLE IF EXISTS t_merge_log_num_streams_limit;

SELECT formatQuery('ALTER QUOTA q FOR INTERVAL 1 MINUTE MAX queries = 7 FOR INTERVAL 1 HOUR MAX queries = 8');

-- Every scenario runs twice: through the cascades optimizer with `cascades_aggregation_pushdown`
-- steered towards the pushed plan by stat hints, and classically (`enable_cascades_optimizer = 0`,
-- `make_distributed_plan = 0`). The two result blocks of each scenario must be identical.
-- Scenarios 11-22 live in `05048_cascades_aggregation_pushdown_correctness_2`: the scenario list
-- is split in two so each half fits the flaky-check time budget.

DROP TABLE IF EXISTS t_corr_left;

SELECT t1.k AS k, count() AS c, sum(t1.v) AS s FROM t_corr_left AS t1 INNER JOIN t_corr_right_multi AS t2 ON t1.k = t2.k GROUP BY t1.k ORDER BY k
SETTINGS make_distributed_plan = 0, enable_cascades_optimizer = 0;

SELECT t1.big AS b, count() AS c FROM t_corr_left AS t1 LEFT ANTI JOIN t_corr_right_uniq AS t2 ON t1.k = t2.k GROUP BY t1.big ORDER BY b
SETTINGS make_distributed_plan = 0, enable_cascades_optimizer = 0;

CREATE TABLE t_date_preimage_lower_edge (ts DateTime('Asia/Tokyo'), d Date) ENGINE = Memory;

INSERT INTO t_on_fly_patch (id, x, z) VALUES (1, 10, 100);

SELECT * FROM t_cache_compact FORMAT Vertical;

CREATE TABLE t_cache_sparse (i UInt64, s String, arr Array(UInt64), t Tuple(a UInt64, b String))
ENGINE = MergeTree ORDER BY i
SETTINGS min_bytes_for_wide_part = 0, ratio_of_defaults_for_sparse_serialization = 0.1, index_granularity = 3;

SELECT 'bitmaskToArray and bitPositionsToArray';

SELECT 'Nullable(Date32) + DateTime64(3)', (SELECT groupArray(if(number % 2 = 0, toNullable(toDate32('1900-01-01')), toDateTime64('1970-01-01', 3))) FROM numbers(2) SETTINGS compile_expressions = 1)
    = (SELECT groupArray(if(number % 2 = 0, toNullable(toDate32('1900-01-01')), toDateTime64('1970-01-01', 3))) FROM numbers(2) SETTINGS compile_expressions = 0);

alter table test_qcc_offset drop part 'all_2_2_0';

CREATE TABLE t_shadowed_string_size (c Tuple(`a.size` UInt64, `a` String)) ENGINE = Memory;

INSERT INTO t_shadowed_map_values VALUES (([7, 8], {'k': 1}));

-- A sibling element can flatten to the same name as a nested one, and declaration order decides
-- which one a read returns. Only the case where the sibling is declared first is wrong.

DROP TABLE IF EXISTS t_shadowed_tuple_element;

SELECT c.`j.m`['nokey'] FROM t_element_shadowed_by_sibling_path SETTINGS optimize_functions_to_subcolumns = 0;

SELECT 'still optimized';

SELECT count() FROM (EXPLAIN QUERY TREE SELECT distinctJSONPaths(j) FROM t_json_array_plain) WHERE explain LIKE '%groupUniqArrayArray%';

DROP TABLE t_nested_plain;

DROP TABLE IF EXISTS loop_no_columns_target;

-- Indexing an empty array with a Dynamic argument returns NULL for every row.

-- One stored type, no NULLs.
SELECT arrayElement([], d) FROM (SELECT CAST(1, 'Dynamic') AS d);

INSERT INTO t_desc_trailing SELECT 1, number, 'foo' FROM numbers(1000);

SELECT 'complex key', count() FROM mod_complex;

-- A value outside the range of the partition key type addresses no partition and is rejected.
CREATE TABLE mod_range (c0 Int32) ENGINE = MergeTree ORDER BY tuple() PARTITION BY (c0 % 37528);

ALTER TABLE mod_narrow DROP PARTITION -1294967296;

INSERT INTO t_wpk_edge SELECT toInt64(number) - 32768 FROM numbers(16);

DROP TABLE t_wpk_chain_unsorted;

INSERT INTO pk_null_lc SELECT if(number % 5 = 0, NULL, number) FROM numbers(500);

SELECT toString(max(k)), toString((SELECT max(k) FROM pk_tuple_null_mixed SETTINGS optimize_use_implicit_projections = 0)) FROM pk_tuple_null_mixed;

INSERT INTO pk_null_no_final_mark VALUES (1),(200),(NULL);

SELECT count() > 0 FROM (EXPLAIN SELECT max(k) FROM ok_nullable_no_nulls) WHERE explain ILIKE '%_minmax_count_projection%';

CREATE TABLE ok_mm_scalar (p Int64, v Int64) ENGINE = MergeTree PARTITION BY intDiv(p, 1000000) ORDER BY v;

SELECT '--- only the slot that needs the unusable bound loses the projection';

SELECT '-- a branch header that diverges structurally still deduplicates';

-- In the log, a key-value metric is written as one row per key.
SYSTEM FLUSH LOGS asynchronous_metric_log;

SELECT * FROM format(CSV, 'v Date', '2149-06-06');

SELECT parseDateTimeBestEffortOrNull('0000-01-01 00:00:00'), parseDateTimeBestEffortOrZero('0000-01-01 00:00:00');

DROP TABLE t_05019_left;

SELECT count() FROM (SELECT tenant_id FROM t_05019 UNION ALL SELECT tenant_id FROM t_05019 SETTINGS additional_table_filters = {'t_05019':'1'});

SELECT engine_full FROM system.tables WHERE database = currentDatabase() AND name LIKE '.inner\_id.recentsamples.%';

DROP TABLE ts_recent_declared;

SELECT '-- computed sort key';

SELECT '-- LIMIT BY between the sort and the ARRAY JOIN';

SELECT count(), sum(x), min(x), max(x) FROM (SELECT x FROM t_aj_ragged LEFT ARRAY JOIN arr ORDER BY x LIMIT 17) SETTINGS query_plan_top_k_through_array_join = 0;

SELECT '-- syntax: ARRAY literals';

SELECT strpos('héllo', 'llo'), reverse('ab');

SELECT map_entries(map(ARRAY['a'], ARRAY[1]))[1].key, map_entries(map(ARRAY['a'], ARRAY[1]))[1].value;

SELECT bitwise_left_shift(CAST(1 AS TINYINT), 4), toTypeName(bitwise_left_shift(1, 8));

INSERT INTO t_05019 VALUES (1, 'a'), (2, 'b');

SELECT json_array_contains('[1, 2, 3]', 2), json_array_contains('["x", "y"]', 'x'), json_array_contains('[true, false]', false);

CREATE TABLE t_aj_explain (pk UInt64, x UInt64, payload String, arr Array(UInt32), arr2 Array(UInt32))
ENGINE = MergeTree ORDER BY pk;

EXPLAIN PLAN description = 0
SELECT x FROM t_aj_explain ARRAY JOIN arr ORDER BY pk LIMIT 10
SETTINGS optimize_read_in_order = 1, read_in_order_use_virtual_row = 0, query_plan_top_k_through_array_join = 1;

SELECT '-- skip-index route, non-empty shipped set';

SELECT count(), sum(v) FROM t_probe_final FINAL WHERE k IN (SELECT k FROM t_keys WHERE k = 5);

SELECT '' FROM t_aj_rbl ARRAY JOIN arr ORDER BY x LIMIT 3
SETTINGS query_plan_top_k_through_array_join = 0
FORMAT Template;

SELECT sum(x) FILTER(WHERE x > 1), sum(x) FROM (VALUES 1, 1, 0, 2, 3, 3) t(x);

SELECT k, v1, v2, t.v1, u.v2 FROM (VALUES (1, 'a')) AS t(k, v1) JOIN(VALUES (1, 'b')) AS u(k, v2) USING (k);

SELECT (ROW (1, 'a')).*;

SELECT REGEXP_LIKE('Stevens', '^Ste(v|ph)en$');

SELECT ARRAY_INTERSECT(NULL, ARRAY[NULL]);

SELECT reduce(ARRAY [5, 6, 10, 20], 0.0E0, (s, x) -> s + x, s -> s);

SELECT bitwise_left_shift(TINYINT '-128', 0);

SELECT 'monkey' like 'm____y';

SELECT 1 IS DISTINCT FROM 1;

SELECT 'e' between 'c' and 'd';

SELECT 3 in (2, null, 3, 5);

SELECT case true when null then 10000000000 when true then 33 end;

SELECT extract(quarter FROM TIMESTAMP '2001-07-01 00:00:00.000');

SELECT IS_JSON_SCALAR('"str"');

SELECT JSON_ARRAY_CONTAINS('[[2]]', 2);

SELECT JSON_ARRAY_CONTAINS(JSON '[1, "foo", null]', 'foo');

-- no-random-merge-tree-settings: to avoid randomized sparse serialization

DROP TABLE IF EXISTS t_non_candidate_fallback;

-- A `GROUPING SETS` aggregation distributes with the two-phase split: every worker builds
-- partial states for every grouping set over its share of the data, tagged with
-- `__grouping_set`, and one node merges them per set. The shuffle strategy stays inapplicable:
-- rows of one subtotal group would land in several buckets and the group would be emitted
-- several times.

SET enable_cascades_optimizer = 1;

INSERT INTO customer_address VALUES (100);

SELECT format('plan: cross_joins={} substituted={} null_prefiltered={}',
              toString(countIf(explain ILIKE '%cross%')),
              toString(countIf(explain LIKE '%Renaming correlated columns to equivalent expressions in subquery%') > 0),
              toString(countIf(explain LIKE '%Filter values of expressions equivalent to correlated columns that cannot match%') > 0))
FROM (EXPLAIN PLAN actions = 1 SELECT x, (SELECT count() FROM t_inner_5 AS i WHERE i.x = o.x) FROM t_outer_5 AS o);

SELECT x FROM t_outer_9 AS o WHERE EXISTS (SELECT 1 FROM t_inner_9 AS i WHERE i.x = o.x) ORDER BY x;

SELECT format('plan: substituted={}',
              toString(countIf(explain LIKE '%Renaming correlated columns to equivalent expressions in subquery%') > 0))
FROM (EXPLAIN PLAN actions = 1 SELECT x FROM t_outer_13 AS o WHERE EXISTS (SELECT 1 FROM t_inner_13 AS i WHERE i.x = o.x));

SELECT code, dictHas('dict_current_database', code) FROM distributed_table ORDER BY ALL;

DROP TABLE IF EXISTS t_sel_r;

INSERT INTO t_sel_null_group
SELECT 150, 300, if(number < 900, NULL, toNullable(toUInt32(80000 + number)))
FROM numbers(1000);

INSERT INTO test_05023_different_types (x, y) SELECT c, c FROM file(concat(database(), '.data_05023.jsonl'));

SELECT '-- a right payload column, keys not selected';

CREATE TABLE t_05023_1 (a UInt32, b UInt32, c UInt32, PROJECTION p_c (SELECT * ORDER BY c))
ENGINE = MergeTree ORDER BY a SETTINGS index_granularity = 8;

-- Tag no-replicated-database: the DDL worker re-parses the DDL with the session `dialect`, which cannot parse the added `UUID`

-- Conformance queries derived from the convention-based (Tempto) product tests
-- of Presto and Trino (https://github.com/prestodb/presto and
-- https://github.com/trinodb/trino, both Apache License 2.0), executed against
-- the fixture tables of those tests (TPC-H nation/region are scale-independent).
-- Expected results verified against the .result files of the original tests.

SET enable_trino_dialect = 1;

SELECT sum(c1) from empty;

SELECT count(*) FROM nation UNION ALL SELECT sum(n_nationkey) FROM nation GROUP BY n_regionkey UNION ALL SELECT n_regionkey FROM nation ORDER BY 1 DESC;

SELECT * FROM (SELECT DISTINCT r_name FROM region) ORDER BY ALL;

SELECT * FROM (SELECT n_name FROM nation LEFT JOIN region ON n_nationkey = r_regionkey WHERE r_name is null) ORDER BY ALL;

SELECT * FROM (WITH wnation AS (SELECT n_nationkey, n_regionkey FROM nation), wregion AS (SELECT r_regionkey, r_name FROM region) select n.n_nationkey, r.r_regionkey from wnation n join wregion r on n.n_regionkey = r.r_regionkey where r.r_name = 'AFRICA') ORDER BY ALL;

SET obfuscate_markov_order = DEFAULT;

SELECT hex(b'00000001');

-- Dedicated long-lived arenas are labeled, and the label is constant within an arena.
SELECT
    (SELECT countIf(purpose NOT IN ('', 'mergetree', 'jit', 'cache')) FROM system.jemalloc_arena_bins) = 0,
    (SELECT countIf(purposes != 1) FROM (SELECT arena, uniqExact(purpose) AS purposes FROM system.jemalloc_arena_bins GROUP BY arena)) = 0;

SELECT endsWith(value, 'primary key: (key\n')
FROM system.zookeeper
WHERE path = '/test_keeper_map/' || currentDatabase() || '/05024_keeper_map_parenthesized_metadata'
    AND name = 'metadata';

CREATE TABLE t_max_size_attach_dst (x UInt64) ENGINE = MergeTree ORDER BY x
    SETTINGS max_table_size_rows = 10, max_bytes_to_merge_at_max_space_in_pool = 1;

SELECT * FROM dest ORDER BY object;

SELECT number AS n, (number * 2, toString(number))::Tuple(twice UInt64, s String) AS t FROM numbers(3) FORMAT PrettyCompact;

SET async_insert_use_adaptive_busy_timeout = 0, async_insert_busy_timeout_min_ms = 10000, async_insert_busy_timeout_max_ms = 50000;

DROP TABLE time_values_negative;

-- The Cascades cost model's parallelism input follows `max_threads`; pin it so `Q18`'s
-- plan does not depend on the machine's core count.
SET max_threads = 32;

select abs(cast(1 as int)), abs(cast(1 as smallint)), abs(cast(1 as tinyint)), abs(cast(8589934592 as bigint)), abs(cast(-1.3 as double)), abs(cast(-1.3 as float)), abs(cast(-1.32223 as decimal(8,3)));

CREATE TABLE t_ttl_nullable_tuple_datetime_overflow
(
    t Nullable(Tuple(id UInt64, ts DateTime)),
    value UInt64
)
ENGINE = MergeTree
ORDER BY value;

SELECT '-- 4. a float partition key keeps the window on a single node';

-- The planner omits the sort before a window whose order the previous window already
-- provides. The global window must still get one sorted stream: on several streams each
-- `WindowTransform` would number only its own rows. The query uses `s`, so the partitioned
-- window is kept and runs per node.
SELECT '-- 13. a global window after a partitioned window in the same SELECT numbers all rows';

SELECT length(groupConcat(t)) FROM t_group_concat_sparse_nullable_tuple;

-- Same for the replicated engine: the queue must not re-apply the cap to these entries,
-- otherwise it postpones them forever and the query hangs.
DROP TABLE IF EXISTS t_min_unreserved_rep_final;

SELECT 'accurateCastOrNull to DateTime';

-- The wrapped columns cover the sort column's type matrix: the header carries the column whatever its
-- type, so all of these reach the same branch.
CREATE TABLE t_passthrough_sort
(
    a UInt32,
    a_nullable Nullable(UInt32),
    a_low_cardinality LowCardinality(String),
    a_low_cardinality_nullable LowCardinality(Nullable(String)),
    a_array Array(UInt32),
    v UInt32
)
ENGINE = MergeTree ORDER BY (a, v) SETTINGS index_granularity = 256, allow_nullable_key = 1;

INSERT INTO t_idx SELECT number FROM numbers(64);

SELECT
    countIf(explain LIKE '%Condition: (c in 1-element set)%') AS pk_condition_lines,
    countIf(match(explain, 'Granules: [0-9]+/[0-9]+')
            AND toUInt32(extract(explain, 'Granules: ([0-9]+)/'))
              < toUInt32(extract(explain, 'Granules: [0-9]+/([0-9]+)'))) AS strictly_pruned_lines
FROM (
    EXPLAIN indexes = 1
    WITH ct AS MATERIALIZED (SELECT 1 AS c),
         rs AS MATERIALIZED (SELECT * FROM dist_idx WHERE c IN (SELECT c FROM mid_pop WHERE c IN (SELECT c FROM ct)))
    SELECT count() FROM rs AS a, rs AS b
    SETTINGS prefer_localhost_replica = 1, use_index_for_in_with_subqueries = 0
);

DROP TABLE target_70830;

SELECT count() FROM system.tables WHERE database = currentDatabase() AND name LIKE '.inner\_id.recentsamples%';

DROP TABLE uniq_legacy;

SELECT rand() = rand(), c FROM (SELECT rand() AS a, rand() AS b, a = b AS c);

SELECT normalize('㈱㌧㌦Ⅲ', NFKC);

DROP TABLE IF EXISTS t_array_of_map_constant;

SELECT x, m FROM (SELECT arrayJoin([1, 2, 3]) AS x, x IN (SELECT 2) AS m GROUP BY x, m) AS t WHERE EXISTS (SELECT 1 WHERE t.x > 1) ORDER BY x
SETTINGS correlated_subqueries_use_in_memory_buffer = 1;

SELECT count() FROM t_qrc_set_source_big WHERE k IN (SELECT id FROM t_qrc_set_source_memory WHERE id < 50 SETTINGS use_query_cache = 1)
    SETTINGS make_distributed_plan = 1, distributed_plan_execute_locally = 1;

DROP TABLE IF EXISTS t_view_inner_num_streams;

ALTER NAMED COLLECTION 05029_nats_existing_sql_collection
    SET nats_secure = 1, nats_ca_file = '/etc/clickhouse-server/server.crt';

SELECT count() FROM test_not_has_s WHERE has([toFixedString('V0', 3)], s) SETTINGS optimize_rewrite_has_to_in = 0;

SELECT 'delete preview sampled', count() FROM t_ofsf_del SAMPLE 0.5 SETTINGS apply_mutations_on_fly = 1;

SYSTEM START MERGES t_ofsf_shadow;

SELECT '-- 28. a second index over the same absent column keeps the column absent';

ALTER TABLE t_two_indices_dotted MODIFY COLUMN `a.b` REMOVE TTL SETTINGS alter_sync = 2;

SELECT '-- 36. a mutation that rewrites the whole part rebuilds a sibling index refused for its column type';

INSERT INTO t_adopted_src SELECT number FROM numbers(32);

SELECT count() FROM t_adopted_update WHERE _block_number = 1 SETTINGS use_skip_indexes = 0;

SELECT timeSeriesLastToGrid(100, 100, 1, 10)([95, 95]::Array(UInt32), [nan, 3]::Array(Float64));

SELECT 'An alias defined inside a tuple can be referenced if it is defined once';

SELECT '-- 33. a sibling index rebuilt by MODIFY COLUMN does not keep the column absent';

ALTER TABLE t_sibling_cleared MATERIALIZE TTL SETTINGS mutations_sync = 2, alter_sync = 2;

ALTER TABLE t_sibling_cleared_shadowed MODIFY COLUMN c String DEFAULT 'new' SETTINGS alter_sync = 2;

SELECT count() = 2 FROM system.mutations WHERE database = currentDatabase()
    AND table = 't_sibling_modified_shadowed' AND NOT is_done;

SELECT count() FROM t_sibling_ttl_recalculate_only WHERE c = '';

-- p.x reads 0 for every row post-expiry, but the granules hold 0, 3, 6, ...: pruning on them keeps
-- only the granule that happens to contain 0 and drops the other 15.
SELECT count() = 0 FROM (EXPLAIN indexes = 1 SELECT count() FROM t_absent_sub WHERE p.x = 0) WHERE extract(explain, 'Granules: (\d+/\d+)') NOT IN ('', '16/16');

SYSTEM STOP MERGES t_absent_bool_dotted;

SELECT count() FROM t_keep_qbit_sub WHERE `vec.8` = CAST(unhex('02'), 'FixedString(1)') SETTINGS use_skip_indexes = 0;

SELECT count() > 0 FROM (EXPLAIN PLAN distributed = 1 SELECT count() FROM dist_05031_all_dead)
SETTINGS skip_unavailable_shards = 1, serialize_query_plan = 1;

SELECT count() > 0 FROM system.parts_columns WHERE database = currentDatabase() AND table = 't_sibling_ttl_rebuilt' AND active AND column = 'g';

SELECT countIf(data_uncompressed_bytes > 0) FROM system.data_skipping_indices WHERE database = currentDatabase() AND table = 't_sibling_materialize_ttl_rebuilt';

CREATE TABLE t_sibling_materialized_alias_rebuilt (
    k UInt64,
    d DateTime,
    c String TTL d + INTERVAL 1 SECOND,
    e UInt64,
    a_alias UInt64 ALIAS e * 2,
    m UInt64 MATERIALIZED a_alias,
    INDEX idx_old (c, m) TYPE set(100) GRANULARITY 1)
ENGINE = MergeTree ORDER BY k
SETTINGS index_granularity = 4, min_bytes_for_wide_part = 0, min_rows_for_wide_part = 0;

ALTER TABLE t_sibling_materialized_ttl_only ADD INDEX idx_new c TYPE set(100) GRANULARITY 1 SETTINGS alter_sync = 2;

SYSTEM START MERGES t_sibling_materialized_cleared_rebuilt;

SELECT count(), countIf(c4 = 'AB'), min(c1), max(c1)
FROM
(
    SELECT c1, arrayFirst(s -> endsWith(upper(c3), s), ['AB', 'CD']) AS c4
    FROM t_lazy_cf
    WHERE arrayExists(s -> endsWith(upper(c3), s), ['AB', 'CD'])
    ORDER BY c2 DESC
    LIMIT 1000
)
SETTINGS query_plan_optimize_lazy_materialization = 1, query_plan_max_limit_for_lazy_materialization = 10000, max_threads = 1, max_block_size = 100;

insert into t_rename_materialized_by_merge select number, number, number from numbers(3, 3);

-- An alias on the argument does not get in the way.
SELECT CAST(0.1 AS x, 'Decimal256(76)');

EXPLAIN SYNTAX SELECT CAST(0.1 AS Float64);

DROP TABLE IF EXISTS t_in_empty_set_nullable;

INSERT INTO t_in_empty_set_lc VALUES ('x', 2);

SELECT '-- row count';

SELECT a.c0, v.c0
FROM t_a_05038 AS a
INNER JOIN v_shadow_05038 AS v
ON a.c0 = v.c0
ORDER BY ALL;

CREATE TABLE t_lwu_asc (id UInt64, v UInt64)
ENGINE = MergeTree
ORDER BY id
SETTINGS enable_block_number_column = true, enable_block_offset_column = true;

-- Numbered placeholders work at any depth, including inside operators.
SELECT arrayMap(_1 * 2 + 1, [1, 2, 3]);

SELECT toTypeName(CAST(CAST(NULL, 'Variant(String, UInt8)'), 'LowCardinality(String)')), CAST(CAST(NULL, 'Variant(String, UInt8)'), 'LowCardinality(String)');

SELECT '-- every startsWith and endsWith name --';

DROP TABLE t_autopr_sets_join;

INSERT INTO t_inner_18 VALUES (NULL), ('a'), (NULL), ('b'), ('zz');

CREATE TABLE t_inner_22 (x Int64) ENGINE = MergeTree ORDER BY tuple();

CREATE TABLE t_outer_26 (x Int32) ENGINE = MergeTree ORDER BY tuple();

SELECT '-- Case 30: guarded, outer DateTime(''UTC'') vs inner DateTime(''Asia/Tokyo''); ->equals ignores the DateTime timezone, but the timezone changes meaning: a substituted Asia/Tokyo member would make toHour(o.ts) see hour 9 instead of UTC hour 0 and drop the row';

SELECT toUnixTimestamp64Nano(toDateTime64(2.534023008e11, 9)) = 9223372036854775807;

SELECT toDateTime64(toInt128('9223372036854775808'), 9), toDateTime64(toInt128('-9223372036854775809'), 9);

SELECT k, count() AS c, min(v), max(v), uniqExact(u) FROM threshold_top_k GROUP BY k ORDER BY c DESC LIMIT 5 SETTINGS query_plan_aggregation_bucket_top_k = 0;

SELECT k, max(v) AS m FROM threshold_top_k GROUP BY k ORDER BY m DESC LIMIT 5 SETTINGS query_plan_aggregation_bucket_top_k = 0;

SELECT 'DESC direction';

DROP TABLE IF EXISTS t_sel_edge_l;

SELECT extract(explain, 'Conditions: .*') FROM (
    EXPLAIN actions = 1
    SELECT count() FROM t_sel_edge_l AS l JOIN (SELECT * FROM t_sel_edge_r LIMIT 1000) AS r
    ON l.a1 < r.b1 AND l.a2 < r.b2 AND l.a3 < r.b3
) WHERE explain LIKE '%Conditions:%';

CREATE TABLE t_sel_edge_topk (c UInt32, b1 UInt32, b2 UInt32, b3 UInt32, INDEX idx_b3 b3 TYPE minmax GRANULARITY 1)
ENGINE = MergeTree ORDER BY tuple()
SETTINGS auto_statistics_types = 'basic, uniq_v2', index_granularity = 1, index_granularity_bytes = 10485760;

-- Validation of incremental refreshable materialized view definitions at CREATE and ALTER:
-- exactly one plain source table whose engine supports streaming, and no MODIFY QUERY.

DROP TABLE IF EXISTS val_src;

val:<=+Infinity | count();

-- Gaps of 4 between the keys, so `WITH FILL STEP 2` has something to fill in every gap.
INSERT INTO t_pr_with_fill SELECT number * 4, toString(number) FROM numbers(100);

CREATE TABLE t_pr_with_fill_probe (a UInt64) ENGINE = MergeTree ORDER BY a;

INSERT INTO ta SELECT number, number FROM numbers(10);

-- `parallel_hash` is an alias of `hash`, so a join that lists it reports `HASH` whatever layout it builds.
SELECT count() FROM t1 JOIN t2 ON t1.a = t2.a
FORMAT Null
SETTINGS log_comment = '05042_join_algorithms_parallel_hash', join_algorithm = 'parallel_hash', max_threads = 4;

SELECT used_number_of_joins, used_join_algorithms, used_join_kinds, used_join_strictness, spilled_to_disk
FROM joins_log
WHERE type = 'QueryFinish'
  AND log_comment LIKE '05042\_join\_views\_subquery\_in%'
ORDER BY log_comment;

SELECT 'direct join with a dictionary';

SELECT 'stream lazy steps', count() FROM (EXPLAIN actions = 1
    SELECT id, value, region FROM t_streaming_lazy_mat STREAM BOUNDED
    WHERE region = 'rare' ORDER BY id ASC LIMIT 5
    SETTINGS query_plan_optimize_lazy_materialization = 1, query_plan_max_limit_for_lazy_materialization = 10000,
        max_threads = 1, optimize_read_in_order = 1)
WHERE explain ILIKE '%LazilyReadFromMergeTree%';

SELECT count() FROM tab_bp_merge WHERE hasPhrase(s, 'alpha beta') SETTINGS use_skip_indexes = 1;

SELECT count() FROM tab_bp_mat_multi WHERE hasToken(s, 'freq7') SETTINGS use_skip_indexes = 0;

-- no-parallel: SYSTEM ENABLE FAILPOINT is server-global and the failpoint is one-shot, so a concurrent query would consume it
-- no-ordinary-database: the test uses transactions

SET optimize_trivial_count_query = 1;

SELECT intDiv(toUInt128('18446744073709551617'), toUInt128('18446744073709551616'));

SELECT id, hasAll(arr, ['zz']), hasAny(arr, ['zz'])
FROM t_null_map_text ORDER BY id SETTINGS use_skip_indexes = 0;

-- A union inside the set is the same question one step further: `UnionStep` does not collect dataflow
-- statistics either, and a check that walked the set source plan would reject this too.
SELECT key, pad FROM t_autopr_set_source
WHERE non_key IN (SELECT number FROM numbers(500) UNION ALL SELECT number FROM numbers(500, 500))
FORMAT Null SETTINGS log_comment = '05043_autopr_set_source_leaf_steps_2_union';

SELECT x FROM t_outer_33 AS o WHERE EXISTS (SELECT 1 FROM t_inner_33 AS i WHERE i.n = o.x AND i.n = i.c AND intDiv(1, 2 - o.x) >= 0) ORDER BY x;

SELECT x FROM t_outer_35 AS o WHERE EXISTS (SELECT 1 FROM t_inner_35a AS i WHERE i.x = o.x UNION ALL SELECT 1 FROM t_inner_35b AS i WHERE i.x = o.x AND intDiv(1, 2 - o.x) <= 1) ORDER BY x;

INSERT INTO t_inner_39d VALUES (2), (3);

SELECT al AS category, cur, row_number() OVER (PARTITION BY a ORDER BY dt DESC) AS rn
FROM loc_win ORDER BY rn;

SELECT 'server dependent alias body';

SELECT s1, s2, row_number() OVER (ORDER BY dt) AS rn
FROM remote('127.0.0.{1,2}', currentDatabase(), loc_dup) ORDER BY rn;

-- A single shard needs no reconciliation at all.
SELECT al AS category, cur, row_number() OVER (ORDER BY a) AS rn
FROM remote('127.0.0.1', currentDatabase(), loc_win) ORDER BY rn;

DROP TABLE loc_jdl;

SELECT k, min(u) AS m FROM threshold_top_k_events GROUP BY k ORDER BY m DESC LIMIT 10
    SETTINGS log_comment = '05043_ttkm_p_min_descending' FORMAT Null;

SELECT name, endsWith(value, 'primary key: (key + 1) * 2\n')
FROM system.zookeeper
WHERE path = '/test_keeper_map/' || currentDatabase() || '/05043_keeper_map_canonical_writer_required'
    AND name IN ('data', 'metadata')
ORDER BY name;

SELECT k, v FROM t_memory_prewhere PREWHERE k = 1000000;

SELECT count() FROM t_memory_prewhere_null PREWHERE n IS NULL;

DROP VIEW IF EXISTS t05043_throwing;

SELECT count() FROM merge(currentDatabase(), '^t05043_alias$') WHERE _table = 't05043_alias';

SELECT a, b, c FROM m_read_in_order_prefix ORDER BY a, b, c LIMIT 3
    SETTINGS optimize_read_in_order = 0;

SELECT count() FROM t_not_pk WHERE NOT ((NOT (NOT c0)) >= 2);

DROP TABLE t_not_pk;

SELECT 'The exemption can be disabled';

SELECT extract('abc', '^a\\.c$');

SELECT match(s, '^abc') FROM (SELECT arrayJoin(['abc', 'xabc', 'abcx', 'ab', '', 'abcabc', 'xabcabc', 'abcabcx']) AS s) ORDER BY s;

SELECT extract('a=b', '^a\\=b');

INSERT INTO FUNCTION s3('http://localhost:11111/test/05043_' || currentDatabase() || '.tsv', 'test', 'testtest', 'TSV', 'x UInt64')
    SELECT number FROM numbers(50000) SETTINGS s3_truncate_on_insert = 1;

SELECT 'baseline outside a transaction, non-defaults of `s`';

SELECT abs(CAST(NULL AS DOUBLE));

SELECT ceil(-123.45E0);

SELECT truncate(REAL '17.88');

SELECT floor(-123.0E0);

SELECT pmod(SMALLINT '-7', SMALLINT '3');

SELECT is_nan(REAL '0.0' / REAL '0.0');

SELECT round(-3000000000);

SELECT round(-3000000000, 0);

SELECT round(BIGINT '3', 1);

SELECT round(DOUBLE '9223372036854775900.0');

SELECT greatest(TINYINT'1', TINYINT'2');

SELECT greatest(1.0E0, 2);

SELECT least(-1.5E0, -2.3E0, -5/3);

SELECT cosine_similarity(array [], null);

-- A float nested inside Nullable must not scatter either.
SELECT DISTINCT c FROM (SELECT count() OVER (PARTITION BY nk) AS c FROM t_window_scatter_float) ORDER BY c
SETTINGS max_threads = 8;

CREATE TABLE t_autopr_nested_in_mid (x UInt64, y UInt64) ENGINE = MergeTree ORDER BY x;

CREATE TABLE t_bf_array_in_all_empty (x Array(UInt32), INDEX idx_x x TYPE bloom_filter GRANULARITY 1)
ENGINE = MergeTree ORDER BY tuple() SETTINGS index_granularity = 2;

SELECT count() FROM t_bf_array_in_tuple_one_index WHERE (x, y) IN (([], 1), ([2], 3)) SETTINGS use_skip_indexes = 0;

-- Merging two aggregate states compares the stored `Field`s directly, which is a different overload
-- from the per-row path above.
SELECT minMerge(s) FROM (
    SELECT minState(materialize([[[[[[[[[[[[[[[[[[[[[[[[[[[[[[1]]]]]]]]]]]]]]]]]]]]]]]]]]]]]])) AS s
    FROM numbers(200) GROUP BY number % 200
);

SELECT a FROM t_fill_dist WHERE a > 780 ORDER BY a DESC WITH FILL STEP -2 STALENESS -6
SETTINGS make_distributed_plan = 0;

SELECT kqlToTimespan(toDecimal64('0.57', 2));

-- empty arrays produce zero rows (inner semantics), preserved
SELECT (SELECT groupArray((id, x)) FROM (SELECT id, arrayJoin(a) AS x FROM t_laj ORDER BY id, x) SETTINGS query_plan_lower_array_join_function = 1)
     = (SELECT groupArray((id, x)) FROM (SELECT id, arrayJoin(a) AS x FROM t_laj ORDER BY id, x) SETTINGS query_plan_lower_array_join_function = 0);

DROP TABLE IF EXISTS t_memory_count;

SELECT 'direct join with a rocksdb table';

SELECT toDate('1970-01-01') IN (CAST('00:00:00.5', 'Time64(1)'));

SELECT 'Float32 DESC unoptimized';

SELECT CONCAT('hello', ' world');

SELECT LEVENSHTEIN_DISTANCE('helo word', 'hello world');

SELECT REPLACE('', '');

SELECT SUBSTRING('信念,爱,希望' FROM 4);

SELECT SPLIT_PART('abcdddddef', 'dd', 1);

SELECT RTRIM('  信念 爱 希望');

SELECT LTRIM(' hello world ', ' x');

SELECT TRIM(' hello world ', ' ehlowrd');

SELECT RPAD('信念 爱 希望  ', 11, '望');

SELECT ends_with(NULL, 'ba');

SELECT length(CAST('a' AS VARBINARY));

SELECT from_ieee754_64(to_ieee754_64(-4.9E-324));

CREATE TABLE t_ml_facts (key UInt32, value Int64) ENGINE = MergeTree ORDER BY key
  SETTINGS auto_statistics_types = '';

SELECT s FROM t_hdr_05045 FINAL PREWHERE v <= 10 WHERE 10 > v GROUP BY ALL WITH CUBE ORDER BY s
SETTINGS distributed_plan_execute_locally = 1, apply_prewhere_after_final = 1, distributed_plan_fallback_to_local_execution = 0;

SELECT count() > 1 AS multi_part FROM system.parts
WHERE database = currentDatabase() AND table = 't_rp_05045' AND active
SETTINGS enable_cascades_optimizer = 0, make_distributed_plan = 0;

INSERT INTO t_fallback_memory SELECT number FROM numbers(10);

SELECT '-- except distinct, rule-based';

SELECT compose(1, 2);

-- Identifiers that the parser reads back as a literal rather than an identifier must be quoted when
-- an AST is formatted. `ParserNumber` hands a bare word to `strtod`, which accepts `inf`, `infinity`
-- and `nan`, and `true`/`false` are parsed as `Bool` literals, so leaving such a name unquoted
-- silently turns a column reference into a constant.

SELECT formatQuerySingleLine('SELECT `inf`, `infinity`, `nan`, `true`, `false`');

CREATE TABLE dpsub_state_d (k UInt32, x UInt32 STATISTICS(uniq), one UInt8 STATISTICS(uniq)) ENGINE = MergeTree ORDER BY k;

-- Array of named tuples from array-of-arrays. The existing rule for invalid
-- elements applies unchanged: the array is empty only when every element fails,
-- while one valid element keeps its length and defaults the rest. With the
-- setting off every element is valid and fills positionally.
SELECT JSONExtract('{"l":[["a","b"],["c","d"]]}', 'l', 'Array(Tuple(x String, y String))');

INSERT INTO t_memory_row_policy SELECT number, toString(number) FROM numbers(100, 100);

SELECT count() FROM merge({CLICKHOUSE_DATABASE_1:String}, '^t05045_leaf$') WHERE _table = 't05045_leaf';

SELECT count() FROM (EXPLAIN SELECT min(str), max(str) FROM t_basic_stats) WHERE explain LIKE '%_statistics_projection%';

CREATE TABLE test_not_has_ipv4 (ip IPv4) ENGINE = MergeTree
ORDER BY ip
SETTINGS index_granularity = 1, add_minmax_index_for_numeric_columns = 0;

SELECT 'lowcardinality nullable', count(), countIf(m IS NULL) FROM (SELECT moduloOrNull(byteSize(x), toLowCardinality(toNullable(0))) AS m FROM test);

INSERT INTO pr_rf_build SELECT number FROM numbers(10);

INSERT INTO t_dup SELECT number % 100 FROM numbers(40000);

CREATE TABLE t_qcc_lambda (a Int64, b Int64) ENGINE = MergeTree ORDER BY a;

INSERT INTO t4 SELECT number FROM numbers(10);

SELECT count() FROM (EXPLAIN actions = 1 SELECT a, c FROM mt_fixed_key WHERE b = 1 ORDER BY a DESC LIMIT 5) WHERE explain LIKE '%ReadType: In%';

CREATE TABLE test_nullcount_pruning
(
    bucket UInt8,
    id UInt64,
    value Nullable(Int64) STATISTICS(basic),
    value_for_range Nullable(Int64) STATISTICS(basic),
    value_lc LowCardinality(Nullable(String)) STATISTICS(basic),
    value_lc_num LowCardinality(Nullable(Int64)) STATISTICS(basic)
)
ENGINE = MergeTree()
PARTITION BY bucket
ORDER BY id
-- `nullable_serialization_version` is pinned: randomized `allow_sparse` enables the
-- sparsity-filter trivial count rewrite for `count() ... WHERE col IS NULL`, which
-- replaces ReadFromMergeTree in EXPLAIN and hides the `Statistics` index section.
SETTINGS auto_statistics_types = '', nullable_serialization_version = 'basic';

SELECT countIf(explain LIKE '%Statistics%') > 0, countIf(explain LIKE '%Parts: 2/4%') > 0
FROM (EXPLAIN indexes = 1 SELECT count() FROM test_nullcount_pruning WHERE value IS NULL SETTINGS optimize_functions_to_subcolumns = 0);

SELECT 'Test 18: `LIKE` / `!=` on `Nullable(String)` do not activate statistics pruning';

SELECT count() FROM test_float_inf_pruning WHERE f IS NULL;

INSERT INTO t_text_block_size_small VALUES (1, 'alpha beta'), (2, 'gamma delta');

ALTER TABLE mv_totime_alter MODIFY QUERY SELECT toTime(c0) AS t FROM t_totime_alter;

SELECT t.x, t.n
FROM (VALUES 1) AS s(d)
CROSS JOIN UNNEST(ARRAY['a', 'b']) WITH ORDINALITY AS t(x, n)
ORDER BY t.n;

CREATE TABLE uniq_foreach_v1 (state AggregateFunction(uniqForEach, Array(UInt64))) ENGINE = MergeTree ORDER BY tuple();

-- `SelectStreamFactory::createForShardImpl` builds and ships a `QueryPlan` only with the analyzer; the
-- old-analyzer run would silently fall back to shipping SQL text and never exercise the serialization.
SET serialize_query_plan = 1;

DROP TABLE IF EXISTS t_ms_dims;

SELECT formatQuerySingleLine('CREATE TOKEN VALID FOR INTERVAL 1 DAY GRANTS (USAGE ON *.*) FORMAT TSVRaw');

-- SerializationMap reads a Field through its own body, not through SerializationArray.
CREATE TABLE m (id UInt64, a Map(String, Bool), INDEX idx_a a TYPE minmax GRANULARITY 1)
ENGINE = MergeTree ORDER BY id
SETTINGS index_granularity = 3, index_granularity_bytes = 0, min_bytes_for_wide_part = 0;

INSERT INTO oj VALUES (1, '{"a": false}'), (2, '{"a": false}'), (3, '{"a": false}');

SELECT 'nullable map >= noidx', count(), sum(id) FROM mnu WHERE a >= map('k', false) SETTINGS use_skip_indexes = 0;

DROP TABLE IF EXISTS mrg_b;

SELECT json_extract('{"a": {"b c": [7, 8]}}', '$.a[''b c''][0]');

-- no-flaky-check: every distributed-plan statement pays for a full optimizer run and multi-stage
-- execution, and this one also spills; the flaky check's repeated runs exceed its budget.

-- End-to-end external-aggregation (spill) coverage for the merge-only `Aggregating` above the
-- pushed variant-A join. The full-`Params` copy in the rule and the settings round trip of the
-- serialized fragment must deliver `max_bytes_before_external_group_by` (and the two-level
-- thresholds - `mergeOnBlock` spills only after the two-level conversion) to the worker that
-- executes the merge; result equality alone proves nothing about the deserialized limit being
-- honored, so server-side spill evidence is asserted below.
--
-- ATTRIBUTION: the spill events are query-wide and the pushed partial aggregation carries the
-- same spill settings (full-`Params` copy), so the scenario is built to be structurally
-- attributable: the pushed side groups by the lone join-condition column `j` with only 2 distinct
-- values - the partial's hash table can never reach `group_by_two_level_threshold = 256` rows
-- (and the bytes threshold is disabled), so it can never convert to two-level and never spill.
-- The rebuilt join then fans those 2 state rows out to 100000 distinct `g` values, so only the
-- top merge crosses the two-level threshold and the external-aggregation limit.

DROP TABLE IF EXISTS t_spill_facts;

-- these tests are timezone sensitive
set optimize_use_implicit_projections = 0;

-- An exactly continuous key range is searched by binary search, a range that is not by generic
-- exclusion; the raw-key arm is the control that shows the probe can print either value.
SELECT count() > 0 FROM (EXPLAIN indexes = 1 SELECT count() FROM test32z WHERE toDateTime32(d) > toDateTime('1970-01-10 12:00:00') SETTINGS session_timezone = 'Europe/Moscow') WHERE explain ILIKE '%generic exclusion search%';

print F(true);

-- A `LowCardinality` argument is enforced by the type its dictionary holds: the wrapper is never
-- itself nullable, so a `LowCardinality(Nullable(...))` argument is nullable and its NULL survives,
-- while a `LowCardinality(...)` one does not become nullable. `Nanosecond` has its own path.
let F = (t:timespan) { t };

-- The reported kind is the executed one, and the optimizer may execute a join with its sides
-- swapped, which reverses LEFT and RIGHT.
SET query_plan_join_swap_table = 0;

SELECT 'mv', * FROM mv_totime_names;

SELECT t1.k AS k, count() AS c, sum(t1.v) AS s FROM t_corr_left AS t1 LEFT JOIN t_corr_empty_right AS t2 ON t1.k = t2.k GROUP BY t1.k ORDER BY k
SETTINGS make_distributed_plan = 0, enable_cascades_optimizer = 0;

SELECT count() FROM t_corr_empty AS t1 LEFT JOIN t_corr_right_uniq AS t2 ON t1.k = t2.k
SETTINGS distributed_plan_fallback_to_local_execution = 0;

drop table if exists testbb;

SYSTEM DISABLE FAILPOINT stored_columns_index_throw_on_add;

CREATE TABLE test_not_has_tuple_int8 (t Tuple(x Int8)) ENGINE = MergeTree
ORDER BY t
SETTINGS index_granularity = 1, add_minmax_index_for_numeric_columns = 0;

-- Same signedness across widths stays prunable.
SELECT count() FROM test_not_has_array_int8 WHERE notHas([[toInt64(2)]], a);

SELECT parseISO8601Duration('P1DT12H');

-- A join reports metrics of its own -- how many rows each side saw, how large the hash table grew --
-- only when the query runs with the join analyze mode on, which `log_query_plans` turns on. The
-- plan stored for a query with a join therefore carries a `Left`, a `Right` and a `HashTable` group
-- alongside its I/O and its timings.
--
-- The mode has to be set before the interpreter is built, because every join reads it while the
-- planner constructs it; a join built without it does not even allocate the counters. That makes
-- this easy to break silently, and the assertions below are what would catch it.

DROP TABLE IF EXISTS j_left;

-- Isolate this pass: `optimize_rewrite_aggregate_function_with_if` can reach the same rewrite by another route.
SET optimize_rewrite_aggregate_function_with_if = 0;

DROP TABLE IF EXISTS t_sum_kahan_offset;

SELECT 'updated', v FROM t_totime_mutation ORDER BY c0;

CREATE DICTIONARY model_05048_eval_metric (x1 Float64, x2 Float64, y Float64)
PRIMARY KEY (x1, x2)
SOURCE(CLICKHOUSE(TABLE 'training_05048'))
LAYOUT(XGBOOST(num_iterations 10 eval_metric 'mae'))
LIFETIME(0);

-- The spill did happen for the query above.
SYSTEM FLUSH LOGS query_log;

-- The constant can also hold a NaN only after it is converted to the key type:
-- `'nan'` becomes a Float64 NaN, and `1 < nan` is false, so the row is returned.

DROP TABLE IF EXISTS t2;

-- The result must not depend on the optimization.
SELECT count() FROM (SELECT 1 FROM numbers(10) GROUP BY toString(number, NULL)) SETTINGS optimize_injective_functions_in_group_by = 0;

SELECT DISTINCT c FROM (SELECT count() OVER (PARTITION BY d + INTERVAL 1 MONTH) AS c FROM t_win_month) ORDER BY c SETTINGS force_window_partitions_independently = 1;

DROP TABLE tab_topk_proj;

CREATE TABLE states_ks_05053 (k UInt8, st AggregateFunction(kolmogorovSmirnovTest, Float64, UInt8), arr Array(UInt8)) ENGINE = Memory;

EXPLAIN SELECT t1.k AS k, count() AS c, sum(t1.v) AS s
FROM t_corr_left AS t1
INNER JOIN t_corr_right_multi AS t2 ON t1.k = t2.k
LEFT JOIN t_corr_right_uniq AS t3 ON t1.k = t3.k
GROUP BY t1.k ORDER BY k
SETTINGS make_distributed_plan = 1, enable_cascades_optimizer = 1, explain_query_plan_default = 'legacy',
    enable_join_runtime_filters = 1, optimize_move_to_prewhere = 1;

SELECT 'runningDifference', groupArray(runningDifference(i128))
FROM (SELECT i128 FROM t_rep ARRAY JOIN arr LIMIT 100) SETTINGS enable_lazy_columns_replication = 0;

SELECT 'dynamic', any(toTypeName(x)), groupArray(x)
FROM (SELECT runningAccumulate(st, dyn) AS x FROM (SELECT st, dyn FROM t_dv ARRAY JOIN arr LIMIT 100))
SETTINGS enable_lazy_columns_replication = 0;

SELECT 'generateUUIDv4 cast', any(toTypeName(u)), uniqExact(u) > 2 FROM (SELECT generateUUIDv4(CAST(s AS String)) AS u FROM t_gen);

-- The operator keeps working while such a function exists.
SELECT arrayMap(plus(_, 1) | multiply(_, 2), [1, 2, 3]);

DROP TABLE IF EXISTS dg_enum;

SELECT 'arm1 full_sorting_merge', count(), sum(cityHash64(*)) FROM dg_probe JOIN dg_build USING (k)
SETTINGS join_algorithm = 'full_sorting_merge', query_plan_join_swap_table = 0, join_use_nulls = 0,
    join_output_by_rowlist_perkey_rows_threshold = 1000000, joined_block_split_single_row = 0;

-- Arm 7: lazy replication under an upstream `arrayJoin` wraps the right columns wider than 8 bytes
-- (`u`, `w`, `d`) in `ColumnReplicated`, which the gather reads through the per-block indexes:
-- `row' = indexes[row]` addresses the nested column. The two key ranges overlap, so all 45 rows
-- reach the probe emit path. Every column here fits the row store's inclusive 32-byte limit, so it
-- is pinned off to keep them all on the columnar path.
SELECT 'arm7 replicated', count(), sum(cityHash64(*)) FROM
(
    SELECT number AS k FROM numbers(1, 9)
) AS l
RIGHT JOIN
(
    SELECT number AS k, reinterpretAsUUID(toFixedString(leftPad(toString(number), 16, '0'), 16)) AS u,
        toFixedString(leftPad(toString(number), 32, 'z'), 32) AS w,
        CAST(number * 7 AS Decimal128(6)) AS d, arrayJoin(range(number)) AS i
    FROM numbers(10)
) AS r USING (k)
SETTINGS enable_lazy_columns_replication = 1, join_algorithm = 'hash', query_plan_join_swap_table = 0,
    join_use_nulls = 0, join_output_by_rowlist_perkey_rows_threshold = 1000000,
    joined_block_split_single_row = 0, enable_hash_join_row_store = 0;

-- Arm 11e: a `Variant` below an `Array`. The array kernel hands its nested plane ranges rather than
-- row words, so this is the only shape that reaches `gatherVariantRanges` - and the only one where a
-- variant's coordinate is an element index instead of a block row.
CREATE TABLE dg_variant_array (k UInt64, va Array(Variant(String, UInt64)), w FixedString(40)) ENGINE = MergeTree ORDER BY tuple();

INSERT INTO dg_or SELECT number, number + 10000, number * 1000003,
    toFixedString(leftPad(toString(number), 40, 'o'), 40) FROM numbers(400);

SELECT 'arm28 enum defaults', count(), sum(cityHash64(*)),
    countIf(e8 = 'a'), countIf(e_neg = 'z'), countIf(e_neg = 'y'), countIf(e16 = 'p'),
    countIf(ne IS NULL), countIf(assumeNotNull(ne) = 'n'), countIf(assumeNotNull(ne) = 'z'),
    sum(length(ae)), countIf(te.e = 'a')
FROM dg_mixed_probe LEFT JOIN dg_enum USING (k)
SETTINGS join_algorithm = 'hash', query_plan_join_swap_table = 0, join_use_nulls = 0,
    enable_hash_join_row_store = 0,
    join_output_by_rowlist_perkey_rows_threshold = 1000000, joined_block_split_single_row = 0;

SYSTEM STOP MERGES dg_json;

SYSTEM STOP MERGES dg_agg;

SELECT 'arm20 storage join subset a', count(), sum(cityHash64(k, a)) FROM dg_probe LEFT JOIN dg_sj USING (k)
SETTINGS join_use_nulls = 0, enable_hash_join_row_store = 0,
    join_output_by_rowlist_perkey_rows_threshold = 1000000, joined_block_split_single_row = 0;

DROP TABLE dg_lc;

-- wide integers are exact, so the gate must not be narrowed to native widths
DROP TABLE IF EXISTS t_int128;

SELECT replaceRegexpOne(explain, '^[ ]*(.*)', '\\1') FROM (EXPLAIN actions = 1 SELECT DISTINCT d + 1 AS d1 FROM t_date SETTINGS allow_distinct_partitions_independently = 1) WHERE explain LIKE '%Skip stream merging%' OR explain LIKE '%Read each partition through separate port%';

SELECT count(), sum(y) FROM t_nullable_key WHERE isNull(x) OR toDate(x) = toDate('2026-03-02');

CREATE TABLE dst_chain_first (a UInt64) ENGINE = MergeTree ORDER BY a;

DROP TABLE dst_one;

-- Without the aggressive-path exemption the gate rejects this fresh 3-part range and OPTIMIZE is a no-op.
OPTIMIZE TABLE t_small_parts_optimize SETTINGS optimize_throw_if_noop = 1;

-- Tests that MATERIALIZE TTL on a storage that is not a MergeTree, but whose metadata carries a
-- TTL, runs the mutation instead of crashing the server. Two storages qualify: an Alias table,
-- which returns its target's metadata, and a materialized view declaring a TTL on its own column.

DROP TABLE IF EXISTS alias_ttl_target;

-- Pin one part per INSERT so the block numbers the cursor refers to are deterministic.
SYSTEM STOP MERGES t_stream_count;

SELECT toTypeName(timeSeriesGroupArraySimpleState(timestamp, value))
FROM (SELECT '2026-08-28 10:00:00.000'::DateTime64(3, 'UTC') AS timestamp, 42.::Float64 AS value);

SELECT timeSeriesChangesToGrid(90, 240, 15, 45)(arrayZip(timestamps, values)) FROM ts_data;

DROP TABLE IF EXISTS ts_dist;

SELECT max(abs(predictXGBoost('model_05054', x1, x2) - y)) < 1 FROM training_05054;

INSERT INTO t_deserialize_allocation_bomb_refill
SELECT (SELECT groupUniqArrayState(s) FROM (SELECT repeat('x', 1000000) AS s UNION ALL SELECT repeat('y', 1000000) AS s));

-- Every returned group must be complete.
SELECT sum(x) = 3
FROM t_agg_in_order_limit_prefix_reads
GROUP BY a, b
ORDER BY a
LIMIT 5
SETTINGS optimize_aggregation_in_order = 1, optimize_aggregation_in_order_limit = 1,
         max_threads = 2, max_block_size = 65409, aggregation_in_order_max_block_bytes = 50000000;

-- `value` is incompressible so the input and output byte estimators agree; the check rests on their ratio.
INSERT INTO t SELECT number, rand64() FROM numbers(1e6) SETTINGS max_insert_threads = 1;

-- bitmapAndnotCardinality is deliberately absent: it is not commutative.

SELECT '--- UInt32: operand order, Large x Small vs Small x Large ---';

-- Roaring64Map keys each element by its high 32 bits, so operands spread across several
-- of those keys exercise the merge over sub-bitmaps rather than a single one.

SELECT '--- UInt64: many high-32 keys, shared element ---';

SELECT '-- a doubly negated condition folds back to a positive atom and still uses the index';

-- `mk` is recomputed from the cleared `x`. `me` reads the EPHEMERAL `e`, so it is absent from the
-- dependency graph the closure walks and keeps its stored value. `me2` reads only `me`, so the
-- closure starting at `x` never reaches it either -- it is not recomputed, and keeps its value too.
ALTER TABLE t_clear_ephemeral CLEAR COLUMN x IN PARTITION tuple();

CREATE TABLE {CLICKHOUSE_DATABASE_1:Identifier}.src (x UInt32) ENGINE = MergeTree ORDER BY x;

SELECT 'disabled', length(a), dumpColumnStructure(a) LIKE '%Const%'
FROM filter_constant_column_large_array
WHERE a = range(1000001)
SETTINGS optimize_constant_columns_after_filter = 0;

SELECT toFloat64(number) + 1 FROM numbers(2)
    SETTINGS compile_expressions = 1, min_count_to_compile_expression = 0, log_comment = '05055_control' FORMAT Null;

-- The count above came from the exact-count projection while the range was exact, so its absence is
-- asserted directly and not left to the row count, which is 0 either way.
SELECT count() > 0 FROM (EXPLAIN SELECT count() FROM t_keycond_nan_norm WHERE f = 'nan'
    SETTINGS optimize_use_projections = 1, optimize_use_implicit_projections = 1, enable_parallel_replicas = 0)
WHERE explain ILIKE '%_exact_count_projection%';

SELECT s, s LIKE '%a\\%' AS matched
FROM t_like_suffix_escape
ORDER BY s;

-- The merge in partition 3 has to happen, and the merged part has to record both mutations as
-- applied: the update is irrelevant for this partition, and the drop is materialized by the merge
-- itself. So the merged part is `3_3_4_1_6` with data version 6, not `3_3_4_1` with data version 4.
select 'merged into', name, data_version from system.parts
where database = currentDatabase() and table = 't_merge_past_multi_partition_update' and active and partition = '3';

SELECT 'the merged part is a single part covered by statistics';

-- nothing is parsed, so malformed text is hashed rather than rejected
SELECT normalizedQueryHashUnordered('SELECT * FROM') = normalizedQueryHashUnordered('FROM * SELECT');

SELECT trimLeft(explain) FROM (EXPLAIN indexes = 1 SELECT count() FROM test_not_has_dynamic_float WHERE notHas(CAST([2.0], 'Array(Dynamic)'), k)) WHERE explain LIKE '%Condition%' OR explain LIKE '%Granules:%/%';

SELECT 'suffix / rewrite on, hyperscan off', count() FROM t_or_like_end_anchor WHERE s LIKE '%tenant-a' OR s LIKE '%never' SETTINGS optimize_or_like_chain = 1, allow_hyperscan = 0;

CREATE TABLE t_pr_local_pd (tenant UInt64, arr Array(UInt64), ts UInt64)
    ENGINE = MergeTree ORDER BY (tenant, ts) SETTINGS index_granularity = 128;

SET allow_push_predicate_ast_for_distributed_subqueries = 0;

CREATE TABLE t_pr_step_description (a UInt64, b UInt64) ENGINE = MergeTree ORDER BY a;

DROP TABLE IF EXISTS t_string_filter_wide;

SELECT count(), sum(cityHash64(s)) FROM t_string_filter_wide PREWHERE startsWith(s, 'needle at') SETTINGS apply_string_filters_during_scan = 1;

SELECT count(), sum(cityHash64(s)), sum(cityHash64(n)) FROM t_string_filter_wide PREWHERE s LIKE '%needle%' AND n LIKE '%needle%' SETTINGS apply_string_filters_during_scan = 0;

SELECT 'the optimization is applied';

SELECT
    sum(ProfileEvents['StringValueFilterValuesChecked']) > 0,
    sum(ProfileEvents['StringValueFilterValuesReplaced']) > 0
FROM system.query_log
WHERE current_database = currentDatabase() AND type = 'QueryFinish' AND log_comment = '05055_string_filter_applied';

SELECT count() FROM (SELECT id FROM t_05055 WHERE s != 'x8' UNION ALL SELECT id FROM t_05055 WHERE s != 'x9' SETTINGS use_query_cache = 1);

SELECT max(abs(predictXGBoost('model_05055_int', x1, x2) - y)) < 1 FROM training_05055_int;

-- `LowCardinality` hands the text over to the type it wraps, the same as `Nullable` and `Array`:
-- the conversion of a field strips `LowCardinality` before looking at the value, so a numeral would
-- otherwise take the same lossy `Float64` path as with the wrapped type alone.
-- https://github.com/ClickHouse/ClickHouse/issues/116025

SET session_timezone = 'UTC';

-- `UInt8` is the accepted argument type: the compiled and the interpreted path agree.
SELECT (SELECT groupArray(__bitSwapLastTwo(bitNot(c0))) FROM t_bit_swap_last_two
            SETTINGS compile_expressions = 1, min_count_to_compile_expression = 0)
     = (SELECT groupArray(__bitSwapLastTwo(bitNot(c0))) FROM t_bit_swap_last_two
            SETTINGS compile_expressions = 0);

SET optimize_read_in_order = 1, optimize_aggregation_in_order = 0;

DROP DICTIONARY IF EXISTS model_05056;

SELECT k, s FROM t_memory_prewhere_in ORDER BY k;

DETACH TABLE ts;

SELECT 'a recursive CTE with one join, in the SELECT of a materialized view';

INSERT INTO t_array_index_accurate VALUES (1, [18446744073709551615]), (2, [5]);

SELECT 'LowCardinality matching pairs still match';

SELECT indexOf(CAST([toDate('2024-01-02'), toDate('2024-01-01')], 'Array(Date)'), toDateTime('2024-01-01 00:00:00')) AS const, indexOf(materialize(CAST([toDate('2024-01-02'), toDate('2024-01-01')], 'Array(Date)')), toDateTime('2024-01-01 00:00:00')) AS materialized, indexOf(materialize(CAST([toDate('2024-01-02'), toDate('2024-01-01')], 'Array(LowCardinality(Date))')), toDateTime('2024-01-01 00:00:00')) AS low_cardinality;

-- The same for `DateTime` (which is `UInt32`) to `Int32`, wrapping around after 2038-01-19.

DROP TABLE IF EXISTS t_datetime;

-- A function that reads the query context at execution time (`dictGet`, `joinGet`) must keep
-- that context alive: the analyzer shares one resolved function instance between scopes whose
-- query-tree hash is equal, so the planning scope of a distributed sub-query can hand its
-- instance to the outer projection.
-- https://github.com/ClickHouse/ClickHouse/issues/117753

CREATE TABLE dict_src (id UInt64, attr String) ENGINE = MergeTree ORDER BY id AS SELECT 1, '1';

CREATE TABLE t_probe_i (k UInt64, v Int64) ENGINE = MergeTree ORDER BY k;

SELECT count(),
       countIf(ProfileEvents['ExternalDistinctWritePart'] > 0 AND ProfileEvents['ExternalDistinctMerge'] > 0)
FROM system.query_log
WHERE event_date >= yesterday() AND event_time >= now() - 600 AND type = 'QueryFinish'
    AND NOT is_initial_query AND log_comment = '05059_external_distinct_order_by/remote'
    AND initial_query_id IN (
        SELECT query_id FROM system.query_log
        WHERE event_date >= yesterday() AND event_time >= now() - 600 AND type = 'QueryFinish'
            AND is_initial_query AND current_database = currentDatabase()
            AND log_comment = '05059_external_distinct_order_by/remote');

-- An `ORDER BY` the join key above a merge join is a merge as well, and it stays correct when the order
-- has to be finished by a suffix column.
SELECT 'order by plan', countIf(explain LIKE '%Sort description:%'), countIf(explain LIKE '%Prefix sort description:%')
FROM (EXPLAIN PLAN sorting = 1
    SELECT a.id, b.v FROM fsmj_order_a AS a INNER JOIN fsmj_order_b AS b ON a.id = b.id ORDER BY a.id, b.v);

-- The same with the lower join in a sorted subquery.
SELECT 'pk range sharding sorted subquery', count(), sum(s.k), sum(c.id)
FROM (SELECT a.id AS k FROM fsmj_order_a AS a INNER JOIN fsmj_order_b AS b ON a.id = b.id ORDER BY a.id) AS s
INNER JOIN fsmj_order_c AS c ON s.k = c.v
SETTINGS join_algorithm = 'hash';

-- ... and single-level partial states.
SELECT k, uniqExact(n) AS u
FROM remote('127.0.0.{1,2}', view(SELECT if(number < 60000, toUInt64(0), number % 4) AS k, number AS n FROM numbers_mt(80000)))
GROUP BY k ORDER BY k
SETTINGS max_threads = 4, distributed_aggregation_memory_efficient = 0;

SELECT k, uniqExactResample(0, 2, 1)(n, n % 2) AS r
FROM remote('127.0.0.{1,2}', view(SELECT if(number < 200000, toUInt64(0), number % 4) AS k, number AS n FROM numbers_mt(240000)))
GROUP BY k ORDER BY k
SETTINGS max_threads = 4, distributed_aggregation_memory_efficient = 0;

SELECT 'indexOfAssumeSorted';

SELECT count() FROM (SELECT MACNumToString(x) AS k FROM (SELECT arrayJoin([toUInt64(1), toUInt64(1) + 281474976710656]) AS x) GROUP BY k);

-- The same claim is consumed by `tryConvertAnyOuterJoinToInnerJoin`, which peels an injective
-- function off the join key of the aggregated side to decide that every row of the other side has
-- at most one match, and then rewrites `ANY OUTER` into `ALL INNER`. With a false claim two
-- aggregation groups collapse onto one join key, so the rewritten join duplicates rows instead of
-- keeping the single row `ANY` returns. Both prints must give one row.
SELECT 'ANY OUTER JOIN to INNER JOIN';

-- A view whose body ends with a `LIMIT [n] AFTER/UNTIL` range selects rows by their position in the
-- view's own stream, so an outer `ORDER BY ... LIMIT` must not be pushed into the view: the injected
-- `ORDER BY` would change which rows the boundaries select, and the injected count would cap a range
-- that had none. The rows are inserted as one block into a `Memory` table, so the view reads them in
-- insertion order and the expected results are fixed.
SET max_threads = 1;

-- A patch part written with non-adaptive granularity has no final mark, so its index does not bound its
-- last granule from above. A data part whose patch rows begin in that granule was not patched at all,
-- and the loss also survived materialization of the patch part.

DROP TABLE IF EXISTS t_lwu_patch_last_mark;

SELECT map('k', 42::UInt64::Variant(UInt64, String)) FROM remote('127.0.0.1', system.one) SETTINGS prefer_localhost_replica = 0;

-- A `parallel_full_sorting_merge` join scatters both sides into a fixed number of shards and pairs the
-- shards of the two sides positionally, so neither side may merge its shards back into one stream.

-- The one-thread side on the left.
SELECT count(), sum(cityHash64(l.number, r.number))
FROM (SELECT number FROM system.numbers LIMIT 10) AS l
INNER JOIN (SELECT number FROM system.numbers LIMIT 10 UNION ALL SELECT number FROM system.numbers LIMIT 10) AS r
    ON l.number = r.number
SETTINGS join_algorithm = 'parallel_full_sorting_merge', max_threads = 4;

SELECT tags, value FROM prometheusQuery('prometheus', 'topk(1, m) by ()', 100) ORDER BY tags;

-- A full-text index with the default splitByNonAlpha tokenizer must
-- still reject an invalid regexp used by match().
DROP TABLE IF EXISTS regexp_text_idx;

-- Carrier: IStorage::read (Join discards num_streams and returns a single source)
CREATE TABLE t_resize_join (k UInt64, v UInt64) ENGINE = Join(ANY, LEFT, k);

SELECT count() FROM t_text_index_on_fly WHERE hasAllTokens(s, ['tok1', 'word']);

SELECT 'Ground truth (no index)';

SELECT 'Before merge, materialize';

SELECT 'Table setting';

DROP TABLE IF EXISTS ts_src;

DROP TABLE ts_nullable_copy;

-- One stream: rows tied on the sort key are ordered by the stream that read them.
SELECT
    (SELECT groupArray(k) FROM (SELECT k FROM t_topk_blocksize PREWHERE k % 10 < 9 ORDER BY grp, rowNumberInBlock() LIMIT 20) SETTINGS use_top_k_dynamic_filtering = 0, max_threads = 1)
  = (SELECT groupArray(k) FROM (SELECT k FROM t_topk_blocksize PREWHERE k % 10 < 9 ORDER BY grp, rowNumberInBlock() LIMIT 20) SETTINGS use_top_k_dynamic_filtering = 1, max_threads = 1);

SELECT groupArray(id) FROM (SELECT id, s FROM t_topk_proj WHERE a < 2000 ORDER BY s ASC LIMIT 20)
SETTINGS use_top_k_dynamic_filtering = 0;

-- The reported query, and the same divergence for every other pass that creates an `in`-family node.
-- Mode 2 throws instead of falling back to a local read, whose answer is the same `6`.
SELECT 'has, parallel replicas', sumIf(id, has([1, 2, 3], id)) FROM t_112032
SETTINGS enable_parallel_replicas = 2, max_parallel_replicas = 3, parallel_replicas_local_plan = 0,
         parallel_replicas_for_non_replicated_merge_tree = 1,
         cluster_for_parallel_replicas = 'test_cluster_one_shard_three_replicas_localhost';

DROP TABLE t_112032;

SET enforce_strict_identifier_format = 1;

SELECT trimLeft(explain) FROM (
    EXPLAIN indexes = 1
    SELECT id
    FROM tab
    ORDER BY L2Distance(vec, [0., 2.])
    LIMIT 18446744073709551615 OFFSET 1
)
WHERE explain LIKE '%vector_similarity%';

CREATE TABLE t_cc_multi_block (id UInt64, s String)
ENGINE = MergeTree ORDER BY id
SETTINGS min_bytes_for_wide_part = 0, index_granularity = 8192;

SELECT count() FROM system.tables WHERE database = {CLICKHOUSE_DATABASE_2:String};

SELECT 'var_in', (SELECT arraySort(groupArray(v)) FROM carrier_str
        WHERE v IN (CAST(CAST('7', 'Enum8(\'7\' = 3)') AS Variant(Array(UInt8), Enum8('7' = 3)))))
    = (SELECT arraySort(groupArray(v)) FROM carrier_str WHERE v IN ('7'));

SELECT sum(finalizeAggregation(s)), min(finalizeAggregation(s)), max(finalizeAggregation(s)) FROM (SELECT DISTINCT s FROM states) SETTINGS max_bytes_before_external_distinct = 0, log_comment = '05060_external_distinct_non_comparable_keys/disabled_values';

DROP TABLE t_outer_range_src;

CREATE TABLE t_map_enum_numeric
(
    id UInt64,
    m Map(Enum8('a' = 1, 'b' = 2, 'c' = 3), Int64)
)
ENGINE = MergeTree ORDER BY id
-- The key subcolumn rewrite applies only to bucketed Maps.
SETTINGS map_serialization_version = 'with_buckets', map_serialization_version_for_zero_level_parts = 'with_buckets';

-- `index_granularity = 1` puts `NaN` into the primary key index as a mark boundary.
CREATE TABLE t_nan_pk (c0 Float32) ENGINE = MergeTree ORDER BY c0 SETTINGS index_granularity = 1;

SELECT count(), countIf(isNaN(c0)) FROM t_nan_pk_large WHERE c0 BETWEEN 100 AND 200;

SELECT `c0.c2`.size0 FROM t_nested_cleared;

SELECT 'Same data';

-- The statistics-based part pruning consults the same claim.
DROP TABLE IF EXISTS t_unix_ts_statistics;

-- The rewrite still fires, both for a non-Nullable and for a Nullable column without modifiers.
SELECT 'still optimized';

INSERT INTO t_signed_zero_reinterpret VALUES (-0.0), (-0.5), (0.0), (2.0);

SELECT count() FROM v_trivial_range_until SETTINGS optimize_trivial_view_pushdown_to_distributed = 1;

INSERT INTO t_map_enum_bf_keys_values VALUES (1, map('a', 10, 'c', 30)), (2, map('b', 20));

SELECT 1 FORMAT Null SETTINGS log_comment = '05061_finish';

SELECT id FROM t_has_enum_bf WHERE has(CAST(['a'], 'Array(Enum8(\'a\' = 1, \'b\' = 2))'), f) ORDER BY id SETTINGS use_skip_indexes = 0;

SELECT id FROM t_has_any_enum_column_bf WHERE hasAny(e, [toFixedString('a', 2)]) ORDER BY id;

SELECT count() FROM t_str WHERE k IN (tuple('(\'a\',\'b\')', 'zzz')) SETTINGS use_primary_key = 0;

SELECT extract(explain, 'Condition:.*') FROM (
    EXPLAIN indexes = 1 SELECT * FROM t_float WHERE k NOT IN (tuple(toFloat64(3), toFloat64(1)))
) WHERE explain ILIKE '%Condition:%';

SELECT count() FROM t_time WHERE k IN (SELECT t, toUInt8(1) FROM format(RowBinary, 't Time', unhex('80EE3600')));

WITH 2 AS after SELECT groupArray(number) FROM (SELECT number FROM numbers(6) ORDER BY number LIMIT 2 OFFSET after);

SELECT DISTINCT bech32Encode('bc', repeat('x', 60) || toString(number)) = '' FROM numbers(4);

SELECT count() FROM (SELECT bech32Encode('bc', p) AS k FROM bech32_dist LIMIT 1 BY k);

CREATE TABLE t_nanosecond_key (d DateTime64(9)) ENGINE = MergeTree ORDER BY d
    SETTINGS index_granularity = 1, index_granularity_bytes = 0, min_bytes_for_wide_part = 0;

SELECT count() BETWEEN 730000 AND 770000
FROM (SELECT number % 2 AS a FROM numbers(1000000)) t1
CROSS JOIN (SELECT DISTINCT number AS b FROM numbers(2)) t2
WHERE t1.a = t2.b + arrayExists(x -> (rand(x) % 2) = 0, materialize([1]))
SETTINGS query_plan_merge_filter_into_join_condition = 1;

INSERT INTO t_check_array_join VALUES (1, [1, 2]);

CREATE TABLE t_merge_expr_2 (b UInt64) ENGINE = MergeTree ORDER BY b AS SELECT number FROM numbers(1000);

CREATE TABLE t_scalar_range (x UInt8) ENGINE = Memory;

-- A numeric mapping value is cast to the `Enum` without a membership check, so a value that is not
-- representable as a member must not become one.
SELECT transform(CAST(materialize('B') AS Enum8('A' = 0, 'B' = 1)), [1.5], ['x'], 'z');

OPTIMIZE TABLE t_column_ttl_materialized_own_ttl FINAL;

INSERT INTO t_ttl_array_join VALUES (1, [now() - 3600, now() - 3600], now()), (2, [now() + 100000], now());

-- Add the TTL without applying it, so that the command below is the only thing that can.
SET materialize_ttl_after_modify = 0;

ALTER TABLE t_materialize_ttl_extra_inputs
    MODIFY COLUMN x Int32 TTL d + INTERVAL 1 SECOND SETTINGS mutations_sync = 2;

-- Shedding before the hint is reached leaves the final step responsible for exact deduplication.
SELECT count()
FROM (SELECT DISTINCT bitXor(intDiv(number, 100), 5) AS k FROM numbers_mt(100000) LIMIT 100)
SETTINGS log_comment = '05076_external_distinct_preliminary_policy/pressure_first';

INSERT INTO t_json_key_safety SELECT number, toJSONString(map('a', -1)) FROM numbers(2);

SELECT '-- MODIFY/RESET SETTING are still refused, and change nothing:';

INSERT INTO t_materialize_ttl_skip_index_wide (d, x) VALUES ('2000-01-01 00:00:00', 41);

select 'merged into', name from system.parts
where database = currentDatabase() and table = 't_merge_refused_before_pending_rename' and active;

SELECT '-- not shared: group_left, instant';

INSERT INTO t_qbit_group_by VALUES (1, [1, 2, 3, 4]), (2, [1, 2, 3, 4]), (3, [5, 6, 7, 8]);

CREATE ROW POLICY rp_target_policy ON rp_target FOR SELECT USING tenant_id = 1 TO CURRENT_USER;

SELECT '-- the JSON path is a separate implementation of the same decision';

SELECT k, sum(sum(x)) OVER (ORDER BY k) AS running_total_of_an_aggregate,
    any(toTypeName(k)) OVER (ORDER BY k) AS the_window_argument
FROM values('k String, x UInt8', ('a', 1), ('b', 2)) GROUP BY k WITH ROLLUP WITH TOTALS ORDER BY ALL;

SELECT k, row_number() OVER w AS r
FROM values('k String', ('a'), ('b')) GROUP BY k WITH ROLLUP WINDOW w AS (PARTITION BY k) ORDER BY ALL;

CREATE TABLE t_rf_right (k UInt64) ENGINE = MergeTree ORDER BY tuple();

SELECT 'GROUP BY SET TTL on subcolumn, subcolumn type change -> reject:';

-- ============================================================
-- Setting off: the same change as the ORDER-BY-subcolumn case in
-- 04616_json_lazy_type_hints_key_safety goes through a full mutation
-- (existing non-lazy behavior), which forbids altering a key subcolumn.
-- ============================================================
SET enable_json_lazy_type_hints = 0;

INSERT INTO t_unknown_dim SELECT number FROM numbers(100);

SELECT '-- and the answer is the same either way';

SELECT id FROM remote('127.0.0.1', currentDatabase(), t_map_text_index)
WHERE m['hello world'] IN (SELECT arrayJoin(['val0', 'val1', 'val2'])) AND 'text_index_owned_set' != ''
ORDER BY id
SETTINGS serialize_query_plan = 1, enable_parallel_replicas = 0, automatic_parallel_replicas_mode = 0;

SELECT count() FROM v_view_pushdown WHERE id NOT IN (SELECT id FROM t_view_pushdown_probe);

-- UInt64 (line 92): UInt64 literal cast to UInt64; hits the same-type branch.
CREATE TABLE t_pfl_05079 (s AggregateFunction(quantile(1::UInt64), Float64)) ENGINE = Memory;

-- The whole point: the estimate must not depend on the order the conjuncts were written in.
SELECT 'order does not change the estimate', uniqExact(estimated_rows) = 1
FROM t_atom_order_estimates;

CREATE TABLE t_alter (c0 String, c1 Int8) ENGINE = MergeTree ORDER BY c1;

SELECT 'C4 index over a wrapped type';

CREATE TABLE t_index_hint_dim (id UInt64) ENGINE = MergeTree ORDER BY id
SETTINGS auto_statistics_types = 'basic, uniq_v2';

INSERT INTO t_not_absorbed_estimates
SELECT 'negated_clause', toUInt64OrNull(extract(explain, 't_not_absorbed\\[(\\d+)\\]'))
FROM (EXPLAIN PLAN keep_logical_steps = 1
      SELECT count() FROM t_not_absorbed INNER JOIN t_not_absorbed_dim
      ON t_not_absorbed_dim.id = t_not_absorbed.a
      WHERE NOT (t_not_absorbed.b < 1000 AND t_not_absorbed.b > t_not_absorbed.c)
      SETTINGS use_statistics = 1, enable_cascades_optimizer = 0, enable_parallel_replicas = 0,
               query_plan_optimize_join_order_limit = 10, query_plan_optimize_join_order_randomize = 0,
               use_hash_table_stats_for_join_reordering = 0)
WHERE explain LIKE '%Join:%' LIMIT 1;

SELECT count() FROM tab_fixed_string WHERE s IN (SELECT toFixedString('hello', 10)) SETTINGS use_skip_indexes = 0;

SELECT '-- ngrambf_v1 on a FixedString column';

SELECT count() FROM tab_array WHERE has(arr, 'hello') SETTINGS use_skip_indexes = 0, query_plan_direct_read_from_text_index = 0;

INSERT INTO t_signed_zero VALUES (1, -0.0, [-0.0]), (2, 0.0, [0.0]), (3, 1.5, [1.5]);

INSERT INTO t_signed_zero_lc SELECT 0.0;

SELECT extract(h, '(\\d)\\Q.*$') FROM (SELECT materialize('1x') AS h) SETTINGS optimize_rewrite_regexp_functions = 0;

-- `b > c` compares two columns and cannot be analysed, so it is an unknown atom. `b < 1000` is an
-- ordinary range atom estimated from the column statistics.
INSERT INTO t_not_unknown_estimates
SELECT 'unknown', toUInt64OrNull(extract(explain, 't_not_unknown\\[(\\d+)\\]'))
FROM (EXPLAIN PLAN keep_logical_steps = 1
      SELECT count() FROM t_not_unknown INNER JOIN t_not_unknown_dim
      ON t_not_unknown_dim.id = t_not_unknown.a
      WHERE t_not_unknown.b > t_not_unknown.c
      SETTINGS use_statistics = 1, enable_cascades_optimizer = 0, enable_parallel_replicas = 0,
               query_plan_optimize_join_order_limit = 10, query_plan_optimize_join_order_randomize = 0,
               use_hash_table_stats_for_join_reordering = 0)
WHERE explain LIKE '%Join:%' LIMIT 1;

-- More NULLs than values, so a count that trusts the key range is off by more than one row.
DROP TABLE IF EXISTS t_nullable_key_wide;

SELECT 'columns of the projection parts written on insert';

DROP TABLE t_projection_analyzer_offset;

-- Statistics are materialized by a merge, so two parts and an OPTIMIZE are required.
INSERT INTO t_absorb_reuse SELECT number,         number % 50000, number % 50000 FROM numbers(50000);

CREATE TABLE t_shadowed_size0 (id UInt64, `a.size0` UInt64, a Array(UInt64)) ENGINE = MergeTree ORDER BY id;

-- The type inferred from the SELECT is accepted, and it is the type the view really has.
CREATE VIEW v AS SELECT x FROM t;

SELECT length(n.x), length(n.y) FROM t_merge_drops_nested_offsets;

DROP TABLE t_lc_ip;

SELECT 'a referenced default value is still processed';

SELECT count() FROM t_ttl_group_by_set_sorting_key;

SELECT 'a correlated scalar subquery';

-- The resolver collapses the result type, so this expression is one constant NULL over all 7 rows.
SELECT toTypeName(concatAssumeInjective(fs, NULL)) FROM t_nothing_key LIMIT 1;

SELECT countIf(toDate(d) >= toDate('2100-01-01')) FROM t_wrap_date32;

DROP TABLE IF EXISTS t_wrap_tz_dt64;

SELECT 'the same aliased IN twice in the projection';

-- https://github.com/ClickHouse/ClickHouse/issues/117215
-- https://github.com/ClickHouse/ClickHouse/issues/117216
-- `useDefaultImplementationForLowCardinalityColumns` unwraps `LowCardinality` arguments for the
-- result type computation, but `buildImpl` used to receive the original wrapped types, so an
-- overload resolver branching on an argument type picked a different implementation than the one its
-- own declared result type describes.

SELECT 'least and greatest';

SELECT hasPhrase(materialize('a b c'), toLowCardinality('c b'));

SELECT count() FROM t_semi_anti_algo AS o WHERE EXISTS (SELECT 1 FROM t_semi_anti_algo AS i WHERE i.b = o.b AND i.a = 5) SETTINGS join_algorithm = 'hash';

SELECT count() FROM t_preimage_date WHERE toYear(d) != 2149 SETTINGS optimize_time_filter_with_preimage = 0;

INSERT INTO t_preimage_ordinary VALUES ('2019-12-31'),('2020-01-01'),('2020-06-15'),('2020-12-31'),('2021-01-01');

SELECT 'a non-constant condition, which always worked';

SELECT match(materialize(']b'), '[]a]b'), match(materialize('zz'), '[]a]b');

SELECT match(materialize('Qx'), 'foo|[[:alpha:]]x'), match(materialize('foo'), 'foo|[[:alpha:]]x'), match(materialize('bar'), 'foo|[[:alpha:]]x');

SELECT count() FROM t_prefix_flag_group WHERE match(s, '^ab(?i)*c');

SELECT countIf(match(s, '^ab(?:c)*')) FROM t_prefix_flag_group;

SELECT 'a multi-byte literal without a quantifier still prunes';

-- Baseline: the same query planned for a single node.
SELECT sum(l.v), sum(r.v) FROM t_transplant_left AS l INNER JOIN t_transplant_right AS r ON l.key = r.key
WHERE r.key < 20000
FORMAT Null SETTINGS enable_parallel_replicas = 0, automatic_parallel_replicas_mode = 0,
    log_comment = '05098_single_node';

-- a LEFT ANTI b -> {0,2,4,5}; INNER JOIN c ON a.k = c.k -> {0,2,4} = 3.
SELECT 'nested ANTI dpsub cd_c', count() FROM a LEFT ANTI JOIN b ON a.k = b.k INNER JOIN c ON a.k = c.k
    SETTINGS query_plan_optimize_join_order_algorithm = 'dpsub', query_plan_optimize_join_order_conflict_detector = 'c';

DROP TABLE t_defer_int;

SELECT h, extract(h, '(?i)b.*$') FROM t_extract_flag_group ORDER BY h SETTINGS optimize_rewrite_regexp_functions = 0;

DROP TABLE t_autopr_range_split;

SELECT count() FROM t_pb_probe INNER JOIN t_pb_bcast ON t_pb_probe.key = t_pb_bcast.id
WHERE t_pb_bcast.id < 5000
FORMAT Null SETTINGS log_comment = '05099_plan_based_prewhere';

DROP VIEW IF EXISTS v_corr_view_local;

CREATE MATERIALIZED VIEW mv_corr_view_dist_target TO t_corr_view_dist AS SELECT * FROM t_corr_view_local;

-- Numeric -> DateTime64 / Time64 conversions must honour `date_time_overflow_behavior`.

SET enable_time_time64_type = 1;

SELECT accurateCastOrDefault(toDateTime64('2299-12-31 00:00:00', 0, 'UTC'), 'DateTime64(9, \'UTC\')', toDateTime64('2025-01-01 00:00:00', 9, 'UTC'));

CREATE DICTIONARY d_hier (id UInt64, parent_id UInt64 HIERARCHICAL)
PRIMARY KEY id SOURCE(CLICKHOUSE(TABLE 't_hier_src')) LAYOUT(FLAT()) LIFETIME(0);

-- A multi-digit quotient, which the priming loop reaches the same way as before.
SELECT divideDecimal(toDecimal256(-12, 0), toDecimal32(2.1, 1), 10);

-- Either prewhere setting at 0 stops the PREWHERE move and makes every assertion below vacuous.
SET optimize_move_to_prewhere = 1;

-- Must-stay-working controls: a non-key column is never in the sorting key, the join key is already
-- in the read output, and a filtered column kept in the output was never pruned.
SELECT 'control non-key col', (SELECT sum(cityHash64(d)) FROM (SELECT l.d AS d FROM ok2 AS l INNER JOIN ok2 AS r ON l.a = r.a WHERE r.d = '3'))
                            = (SELECT sum(cityHash64(d)) FROM (SELECT l.d AS d FROM ok2 AS l INNER JOIN ok2 AS r ON l.a = r.a WHERE r.d = '3') SETTINGS join_algorithm = 'hash', query_plan_join_shard_by_pk_ranges = 0);

INSERT INTO t05099 SELECT toString(number % 10), number, number % 7 FROM numbers(1000);

-- Unfiltered reads and the two endpoints were never affected.
select count() from file(currentDatabase() || '_05099_u3.parquet', Parquet, 'u UUID');

SELECT count() FROM t_qcc_formatdatetime WHERE formatDateTime(d, '%f') = '0' SETTINGS use_query_condition_cache = 0, formatdatetime_f_prints_single_zero = 1;

DROP TABLE t_qcc_variant;

SELECT count() FROM t_qcc_session_timezone WHERE toUnixTimestamp(toDateTime(s)) = 1714953600 SETTINGS session_timezone = 'UTC';

ALTER TABLE {CLICKHOUSE_DATABASE_1:Identifier}.t
    UPDATE v = (WITH RECURSIVE src AS (SELECT 7 AS id) SELECT max(id) FROM src) * 1000
             + (WITH RECURSIVE src AS (SELECT 10 AS id) SELECT max(id) FROM src)
    WHERE id = 1 SETTINGS mutations_sync = 2;

SELECT 'W8', v FROM {CLICKHOUSE_DATABASE_1:Identifier}.u WHERE id = 1;

SELECT 'C18', s FROM {CLICKHOUSE_DATABASE_1:Identifier}.v10;

INSERT INTO t_agg_if_nullable_cond VALUES (1, 100), (0, 10), (NULL, 7);

DROP TABLE tab_quantized;

DROP TABLE t_autopr_skip_index;

INSERT INTO t_storage_join_left SELECT number, number FROM numbers(100);

SELECT _table, key FROM t_merge_hint_all WHERE indexHint(_table = 't_merge_hint_1') ORDER BY key;

SELECT arrayElementOrNull(materialize([(1, 'a'), (2, 'b')]), materialize(toUInt64(18446744073709551614)));

-- https://github.com/ClickHouse/ClickHouse/issues/113445
-- A predicate pushed to remote shards as an AST skips conjuncts it cannot convert (a lambda, or a
-- function marked non-deterministic). Skipping a conjunct weakens an `AND`, which is only sound with
-- positive polarity: under `NOT` it makes the pushed predicate stronger, so the shard dropped rows
-- the initiator-side filter can never bring back.

-- The predicate is pushed as an AST only when the remote query is sent as text. With
-- `serialize_query_plan` the shard receives a serialized plan instead, and the `system.query_log`
-- assertion on the query text below is meaningless, so pin the AST path.
SET serialize_query_plan = 0;

DROP TABLE t_push_ast;

OPTIMIZE TABLE ttl_group_by_no_parens FINAL;

SELECT count() FROM (
    SELECT o.id, (SELECT count() FROM t_correlated_filter AS i WHERE i.v = o.v) FROM t_correlated_filter AS o);

SELECT 'a duration spanning the epoch is compared as a signed value';

SELECT 'a correlated NOT EXISTS';

SELECT 'formatting keeps the clause';

SELECT k, s FROM t_interpolate_in WHERE s IN ('8') ORDER BY k WITH FILL FROM 0 TO 4 INTERPOLATE (s AS s || 'x');

SELECT uniqExact(reverseUTF8(s)) FROM (SELECT arrayJoin(['a\xC2', '\xC2a']) AS s);

INSERT INTO t_set VALUES (1), (2), (3);

WITH RECURSIVE src AS (SELECT 1 AS id UNION ALL SELECT id + 1 FROM src WHERE id < 3)
SELECT sum(id) AS s FROM src
EXCEPT
SELECT count() AS s FROM src;

SELECT lima, toYear(lima), lima64, toYYYYMM(lima64), managua, toYear(managua), managua64, toYYYYMM(managua64) FROM t_preimage_transition ORDER BY lima;

SELECT count() FROM t_preimage_transition WHERE toYYYYMM(managua) = 199301 SETTINGS optimize_time_filter_with_preimage = 0;

DROP TABLE IF EXISTS t_preimage_year_zero;

SELECT count() FROM t_preimage_year_zero_date32 WHERE toYYYYMM(d) = 1;

SELECT count() FROM t_monotonicity_finite WHERE k * 2 > 80;

SELECT 'an increasing function of the key';

DROP TABLE IF EXISTS t_read_in_order_nan_lc;

DROP TABLE IF EXISTS t_delete_in_partition;

SELECT toStartOfInterval(toDateTime64('1930-06-15 12:00:34', 0, 'Europe/Amsterdam'), INTERVAL 1 MINUTE),
       toStartOfInterval(toDateTime64('1930-06-15 12:00:34', 0, 'Europe/Amsterdam'), INTERVAL 5 MINUTE),
       toStartOfInterval(toDateTime64('1930-06-15 12:30:00', 0, 'Europe/Amsterdam'), INTERVAL 1 HOUR),
       toStartOfInterval(toDateTime64('1930-06-15 12:00:34', 0, 'Europe/Amsterdam'), INTERVAL 30 SECOND);

CREATE TABLE t_readd_same_type (id UInt64, c UInt64) ENGINE = MergeTree ORDER BY id
SETTINGS min_bytes_for_wide_part = 0;

SELECT groupArray(c) FROM (SELECT c FROM t_readd_compact ORDER BY id);

DROP TABLE IF EXISTS t_tuple_key_no_nan;

SELECT
    id,
    arr,
    arrayMin(x -> 7, arr),
    arrayMax(x -> 7, arr),
    arraySum(x -> 7, arr),
    arrayAvg(x -> 7, arr),
    arrayProduct(x -> 7, arr)
FROM values('id UInt8, arr Array(Int32)', (1, []), (2, []), (3, [1, 2]), (4, [3]), (5, []), (6, []))
ORDER BY id;

INSERT INTO t_05136 VALUES (1), (2);

SELECT 'IN with UNION ALL and prefer_global_in_and_join';

CREATE DICTIONARY dict_05136 (key UInt64, value UInt64)
PRIMARY KEY key
SOURCE(CLICKHOUSE(TABLE data_05136))
LAYOUT(HASHED_ARRAY())
LIFETIME(0);

SELECT 'full_sorting_merge', count() FROM fs JOIN s ON fs.x = s.y SETTINGS join_algorithm = 'full_sorting_merge';

SELECT hex(x), hex(fs.x), hex(s2.x) FROM fs FULL JOIN (SELECT y AS x, j FROM s) AS s2 USING (x) ORDER BY ALL SETTINGS join_algorithm = 'hash';

SELECT countIf(l.t = r.t) FROM (SELECT CAST(tuple(x), 'Nullable(Tuple(FixedString(3)))') AS t FROM fs UNION ALL SELECT NULL) AS l, (SELECT CAST(tuple(y), 'Nullable(Tuple(String))') AS t FROM s UNION ALL SELECT NULL) AS r;

-- The granule assertions below are layout-dependent, and the runner randomizes `index_granularity`
-- (1..65536) and `index_granularity_bytes`. An explicit per-DDL SETTINGS clause wins over that
-- injection (`ClientBase::addMergeTreeSettings` only adds a setting the CREATE does not already
-- carry), so pin both here instead of opting the whole test out of randomization.
-- `min_bytes_for_wide_part = 0` keeps the CREATE quiet: with `index_granularity_bytes = 0` the
-- wide-part thresholds are unreachable, so a nonzero one only earns a warning on stderr.
CREATE TABLE t_05136_lc (k LowCardinality(UInt32), v String) ENGINE = MergeTree ORDER BY k
    SETTINGS index_granularity = 8192, index_granularity_bytes = 0, min_bytes_for_wide_part = 0;

CREATE TABLE t_05136_lc3 (a UInt64, b LowCardinality(Bool))
    ENGINE = MergeTree ORDER BY (a, b) PARTITION BY b
    SETTINGS index_granularity = 1, allow_nullable_key = 1,
             primary_key_ratio_of_unique_prefix_values_to_skip_suffix_columns = 0.5;

SELECT count() FROM (SELECT * FROM numbers(10) LIMIT 18446744073709551614 OFFSET 2);

SELECT '-- 3 witness: ARRAY JOIN reaches the same rewrite';

SELECT count() FROM t_merge_count_over_memory;

INSERT INTO t_rp_allow SELECT number FROM numbers(50);

CREATE FUNCTION test_scope_inner_alias_05136 AS (app, endpoint) -> (untuple(CAST((app, endpoint) AS Tuple(app String, endpoint String))) AS innerscope);

WITH () -> * APPLY (x -> untuple(tuple(x))) AS apply_pair SELECT apply_pair() AS scope FROM (SELECT 1 AS a, 2 AS b) FORMAT TSVWithNames;

-- Expression merging would fold the two expressions of the chain together and shorten it, so pin it off
-- to keep the set step surrounded on both sides.
SET query_plan_merge_expressions = 0;

DELETE FROM t_delete_param WHERE {all:UInt8};

SYSTEM DISABLE FAILPOINT distributed_plan_delay_root_cause_report;

DROP TABLE IF EXISTS t_aj_row;

-- LEFT: fused too
SELECT count() FROM (EXPLAIN actions = 1 SELECT count() FROM t_aj_row LEFT ARRAY JOIN arr AS x WHERE x = key) WHERE explain ILIKE '%Element filter column%';

SELECT tryIdnaEncode('٠ا');

SELECT count() FROM s JOIN fs ON s.y = fs.x SETTINGS join_algorithm = 'parallel_hash';

SELECT '-- right side of the plan carries only the Nullable key';

SELECT l.k, r.k, r.w FROM l LEFT JOIN r ON l.k = r.k ORDER BY ALL SETTINGS join_algorithm = 'hash', max_bytes_before_external_join = 100000000;

SELECT '-- swapped';

SYSTEM STOP MERGES {CLICKHOUSE_DATABASE_1:Identifier}.t2;

INSERT INTO m0 VALUES (1, 5, 11), (2, 6, 21);

SELECT portRFC('https://[::1]:9440/path');

select count() > 0 from (select id from Z final) as s inner join Y as j on s.id = j.id where exists (select 1 from X where X.id = s.id)
    settings enable_parallel_replicas = 2;

-- A conversion is protected at 'enable' too: the guard asks the generic suitability predicate, not a
-- list of arithmetic functions.
SELECT count(if(s = 'bad', NULL, toDate(s))) FROM (SELECT arrayJoin(['2020-01-01', 'bad']) AS s);

SELECT 'cda', t1.k, t2.k, t3.k FROM t1 LEFT JOIN t2 ON t2.a = 5 JOIN t3 ON t1.k = t3.k AND t2.k = t3.k ORDER BY ALL
    SETTINGS query_plan_optimize_join_order_algorithm = 'dpsub', query_plan_optimize_join_order_conflict_detector = 'a';

CREATE TABLE right_distributed_05138 AS right_local_05138
ENGINE = Distributed('test_cluster_two_shards_localhost', currentDatabase(), right_local_05138);

DROP TABLE shared_left_distributed_05138;

-- Several inserts, so the table consists of multiple blocks.
INSERT INTO t_memory_read_rows SELECT number, toString(number) FROM numbers(0, 500);

DROP TABLE mc_child1;

DROP TABLE t_pr_fuse;

INSERT INTO right_local_05139 VALUES (1, 'A'), (2, 'B'), (3, 'C');

SELECT 'semi_global';

-- The same oracle with the non-deterministic call HIDDEN in a lambda body, which constant folding
-- turns into a ColumnFunction whose body is a separate inner DAG. A guard that reads the metadata of
-- the node holding it, the way B1's visible `rand` is read, cannot observe this one.
SELECT 'B3 hidden non deterministic', abs((
    (SELECT count() FROM (
        SELECT t_left_big.a FROM t_left_big LEFT JOIN t_right_big ON t_left_big.a = t_right_big.a
        WHERE arrayExists(z -> rand(z) % 2 = 0, [t_left_big.a])) SETTINGS
            query_plan_filter_push_down = 1, use_join_disjunctions_push_down = 1) /
    (SELECT count() FROM (
        SELECT t_left_big.a FROM t_left_big LEFT JOIN t_right_big ON t_left_big.a = t_right_big.a
        WHERE arrayExists(z -> rand(z) % 2 = 0, [t_left_big.a])) SETTINGS
            query_plan_filter_push_down = 0)) - 1.) < 0.05;

-- The rows themselves are right: only `s = ''`, i.e. `k = 0`, can satisfy the `IN`, so exactly one row
-- matches and the other 99 get the default `v`.
SELECT countIf(t_join_on_dim.v > 0) FROM t_join_on_fact ALL LEFT JOIN t_join_on_dim
    ON t_join_on_fact.k = t_join_on_dim.k
    AND t_join_on_fact.s IN (SELECT x FROM generateRandom('x String', 1, 0, 1) LIMIT 3);

SELECT '-- LEFT ARRAY JOIN inside subquery';

WITH [('2025-06-01 00:00:00'::DateTime64(3), 1.), ('2025-06-01 00:00:30'::DateTime64(3), 2.), ('2025-06-01 00:01:00'::DateTime64(3), 3.)] AS samples
SELECT timeSeriesSliceSortedArray(samples, '2025-06-01 00:00:15'::DateTime64(3), '2025-06-01 00:01:00'::DateTime64(3)) AS datetime64_bounds,
       timeSeriesSliceSortedArray(samples, toDateTime('2025-06-01 00:00:30'), toDateTime('2025-06-01 00:00:59')) AS datetime_bounds,
       timeSeriesSliceSortedArray(samples, 1748736000, 1748736030) AS integer_bounds,
       timeSeriesSliceSortedArray(samples, 1748736000.5, 1748736059.999) AS fractional_bounds,
       timeSeriesSliceSortedArray(samples, '2025-06-01 00:00:30'::DateTime64(6), '2025-06-01 00:00:30.000001'::DateTime64(6)) AS other_scale_bounds
FORMAT Vertical;

SELECT n, label, value, arrays FROM cut_shared ORDER BY n;

SELECT 'nested_inner_then_right_global';

-- The rewriting mutation must still be pending, otherwise the reads below cover nothing.
SELECT count() > 0 FROM system.mutations
WHERE database = currentDatabase() AND table = 't_mt_index_key_type' AND NOT is_done;

OPTIMIZE TABLE ts FINAL;

DROP TABLE ts_types;

-- Exercise constant numeric needles across the optimized numeric search path.

SELECT 'UInt8',
    has(materialize(range(64)::Array(UInt8)), toUInt8(0)),
    has(materialize(range(64)::Array(UInt8)), toUInt8(63)),
    has(materialize(range(64)::Array(UInt8)), toUInt8(64)),
    indexOf(materialize(range(64)::Array(UInt8)), toUInt8(0)),
    indexOf(materialize(range(64)::Array(UInt8)), toUInt8(63)),
    indexOf(materialize(range(64)::Array(UInt8)), toUInt8(64));

CREATE TABLE right_distributed_05141 AS right_local_05141
ENGINE = Distributed('test_cluster_two_shards_localhost', currentDatabase(), right_local_05141);

DROP TABLE t_filter_const_sparse;

UPDATE t_lwu_parenthesized_key SET v = v + 1 WHERE 1;

SELECT timeSeriesMinToGridMerge(0, 0, 0, 10)(min_agg) FROM ts_dup_agg;

DROP TABLE ts_all_nan;

-- A user whose every method is expired keeps them: a user with no authentication method at all is read
-- back as `no_password`, so dropping the last expired method would turn a lapsed credential into an
-- unauthenticated one. The user stays in the fail-closed state it is already in.
CREATE USER user_05141_expired_methods IDENTIFIED WITH plaintext_password BY 'a' VALID UNTIL '2020-01-01 00:00:00 UTC';

SELECT extract(name, '^\.inner_id\.(\w+)\.') AS inner_table, engine_full
FROM system.tables WHERE database = currentDatabase() AND name LIKE '.inner\_id.%samples.%' ORDER BY inner_table;

INSERT INTO ar VALUES (100, 1, 'a');

SELECT * APPLY (x -> toString(x)) APPLY (y -> length(y)) FROM al JOIN ar USING (id, g) FORMAT TSVWithNames;

-- A `Buffer` whose destination is a sharded `Distributed` table still fans the query out
-- across shards, so the rewrite must look through it the same way as a bare `Distributed` table.
SELECT 'buffer_global';

-- Legacy value-only patches must also allow a metadata-only count.
CREATE TABLE t_lwu_trivial_count
(
    id UInt64,
    v UInt64
)
ENGINE = MergeTree
ORDER BY id
SETTINGS enable_block_number_column = 1,
    enable_block_offset_column = 1,
    patch_parts_version = 'v1';

SELECT timeSeriesTimestampOfMinToGridMerge(90, 210, 15, 45)(state)
FROM
(
    SELECT timeSeriesTimestampOfMinToGridState(90, 210, 15, 45)(timestamp, value) AS state
    FROM ts_min_max_data
    GROUP BY toUnixTimestamp64Milli(timestamp) % 2
);

-- One draw per row selects about half of the million rows. Before the fix the conjunct was cloned
-- into the pre-filter below the join and drawn a second time, so about a quarter of the rows
-- survived both draws.
SELECT count() BETWEEN 490000 AND 510000
FROM t_disj_left JOIN t_disj_right ON t_disj_left.k = t_disj_right.k
WHERE (t_disj_left.a = 1 AND rand() % 2 = 0) OR (t_disj_left.a = 2)
SETTINGS use_join_disjunctions_push_down = 1;

DROP TABLE t_ngram_backslash;

SELECT count() FROM t_scale_cast_key WHERE d = toDateTime64(1675262799, 6, 'UTC');

SELECT count() FROM t_kv_date_literal WHERE (dt, id) = (CAST(toDate('2024-01-02'), 'Nullable(Date)'), 1);

SELECT domainRFC('.com') FORMAT CSV;

-- The same through a partition key.

CREATE TABLE t_has_named_tuple (t Tuple(b UInt8, a UInt8)) ENGINE = MergeTree PARTITION BY sipHash64(t) ORDER BY tuple()
SETTINGS add_minmax_index_for_numeric_columns = 0;

SELECT materialize(2.0) + materialize(0.0) + materialize(1.0) FROM numbers(2)
    SETTINGS compile_expressions = 1, min_count_to_compile_expression = 0, log_comment = '05153_control' FORMAT Null;

DROP TABLE IF EXISTS t_ord0;

SELECT 'compatibility-setting-off', count() FROM (SELECT upper(a._part) AS _part FROM t_src AS a JOIN t_up USING (_part)) SETTINGS analyzer_compatibility_join_using_top_level_identifier = 0;

CREATE TABLE store (SNO Int32) ENGINE = Memory;

-- The scan-time string filter (`apply_string_filters_during_scan`) replaces non-matching values with
-- empty strings, and the row is rejected only after the whole PREWHERE expression has been evaluated.
-- Therefore the optimization must be disabled for a column that another PREWHERE expression reads:
-- that expression would otherwise be evaluated on the substituted empty string. Here `throwIf` would
-- fire for every non-matching row, and `length` would report zero for it.

DROP TABLE IF EXISTS t_string_filter_guard;

SELECT count() FROM t_string_filter_shared
PREWHERE throwIf(position(s, 'needle-one') = 0) = 0 AND position(s, 'needle-one') > 0 AND s LIKE '%needle-two%'
SETTINGS log_comment = '05153_shared_conjunct_guard';

-- `SET ROLE` must reach the role parser instead of being read as an assignment
-- to a setting named `ROLE`.
SET ROLE NONE;

DROP TABLE uniq_tuple_v1;

INSERT INTO t_virtual_row_widen_const SELECT number % 10, number % 7 FROM numbers(2000, 2000);

-- getURLHostRFC() returns a bracketed IP-literal host without its brackets, so it may contain ':',
-- which a reg-name host never does. An IP address is not a DNS name, so it has no significant
-- subdomain to extract, and must not be treated as one.
SELECT firstSignificantSubdomainRFC('http://[::ffff:192.0.2.128]:80');

SELECT count() FROM (SELECT number FROM numbers(10)) AS l LEFT JOIN (SELECT number FROM numbers(1000) WHERE sipHash64(number) = 42) AS r ON l.number = r.number;

SELECT domainRFC('http://user@[v1.a]:80/') FORMAT CSV;

SELECT toDateTime(toUInt128(1000000)), toDateTime64(toInt256(1000000), 3), toTime64(toUInt128(3600), 0) SETTINGS date_time_overflow_behavior = 'throw';

SELECT 'x * nan', countIf(explain LIKE '%InOrder%') FROM (EXPLAIN PLAN actions = 1 SELECT x * nan AS n FROM t_read_in_order_nan ORDER BY n);

SELECT count() FROM t_read_in_order_nan_ranges WHERE x / inf = 1;

-- An operand that fits is unaffected, and so is a wider decimal.

SELECT a * 2, a + 3, a - 1, a / 2, intDiv(a, 1) FROM t_decimal_operand;

INSERT INTO t_join_shard_right SELECT nan, 95000 + number FROM numbers(5);

DROP TABLE IF EXISTS json_column;

-- Nullable columns and NULL arguments keep their existing behavior.
SELECT
    number,
    least(toNullable(number), toNullable(10), toNullable(20)) AS least_value,
    greatest(toNullable(number), toNullable(10), toNullable(20)) AS greatest_value
FROM numbers(3)
ORDER BY number
FORMAT TabSeparatedRaw;

BACKUP TABLE t_src_restore, TABLE mv_restore, TABLE mv_restore_target
    TO Memory('backup_05161_mv_set_operation') FORMAT Null;

INSERT INTO t_pk_tuple_nan_data VALUES ((1.,1),0),((2.,1),0),((10.,1),1),((500.,7),1),((nan,2),0),((nan,3),0),((nan,4),0),((nan,5),0);

SELECT count(), sum(x) FROM t_pk_tuple_nan_in WHERE t NOT IN ((nan, 3));

SELECT count() FROM (SELECT * FROM t_pk_tuple_nan_inside WHERE t >= (2, 0.));

SELECT count() FROM t_pk_null_data_assume_not_null WHERE n != 2;

INSERT INTO t_pk_tuple_null_safe_transform VALUES ((0,0),1),((NULL,1),1),((5,1),1),((NULL,2),1);

SELECT count() FROM t_pk_tuple_null_inner_tuple WHERE t >= (2, (0, 0)) SETTINGS optimize_use_projections = 1, optimize_use_implicit_projections = 1;

SELECT count() FROM v_pr_union_mode_ordered WHERE tenant = 5;

SELECT 'RIGHT small probe remote', count() FROM jd_probe RIGHT JOIN jd_build ON jd_probe.id = jd_build.id
SETTINGS parallel_replicas_local_plan = 0;

-- The `bloom_filter` skip index hashes the elements of a constant array argument of `hasAny`/`hasAll`
-- after converting them to the indexed type. A `Date` literal carries a unit, so converting it without
-- its own type re-based the day number as seconds and no granule matched; a `Date32` literal took the
-- throwing path of the same conversion instead. The index must answer as the function does.

-- A `Date32` literal and a `DateTime` column meet in a `DateTime64` supertype, and the literal is
-- converted with the session's time zone, so the comparison is only time-zone independent when the
-- session time zone is fixed.
SET session_timezone = 'UTC';

CREATE TABLE t_lossy_const_key (d DateTime('UTC')) ENGINE = MergeTree ORDER BY toString(d);

-- The set path normalizes an element into the key type with no key transform involved at all, so a
-- bare key has the same hole, in both directions: `notIn` excluded a point the predicate does not
-- name, and `in` was read as certainly true over that point, which answered a `count()` from the
-- part without filtering its rows at all.
SELECT 'the same set element against a bare key';

CREATE TABLE t_lossy_const_dynamic (k Int64) ENGINE = MergeTree ORDER BY k;

SELECT count() FROM t_lossy_const_str WHERE s != '007';

SELECT count() FROM (SELECT x FROM (SELECT arrayJoin(range(4)) AS x FROM numbers(100)) WHERE rand64() % 1 = 0);

SELECT key, tupleElement(t.inner, 1) FROM t_nullable_tuple_element ORDER BY key SETTINGS optimize_functions_to_subcolumns = 1;

DROP TABLE IF EXISTS t_rename_swap_statistics SYNC;

-- Every row above is a value oracle, so all of them would still pass if the conversion silently
-- stopped or started being compiled. The shapes below pin which of them compiles. Each conversion
-- shape holds exactly two compilable nodes, the addition and the conversion fused into it, so once
-- the conversion is declined nothing is left to compile. `CompiledFunctionExecute` counts executions
-- of an already-compiled node, so a warm compiled cache does not change any of them.
SELECT CAST(x AS Int32) + 1 FROM t_jit_cast_no_null
    SETTINGS compile_expressions = 1, min_count_to_compile_expression = 0, log_comment = '05170_declined' FORMAT Null;

SYSTEM START MERGES t_clear_racing_loss;

INSERT INTO t_null_tuple_key VALUES (tuple(1)), (tuple(NULL)), (NULL);

SELECT a.key, b.pad FROM t_autopr_lazy_read AS a
    INNER JOIN (SELECT key, pad FROM t_autopr_lazy_read_other ORDER BY ord LIMIT 10) AS b ON a.key = b.key
FORMAT Null
SETTINGS query_plan_optimize_lazy_materialization = 1, log_comment = '05175_autopr_lazy_read_join';

SELECT 'the weakened conjunct is not pushed', countIf(query LIKE '%not(and(%') FROM system.query_log
WHERE current_database = currentDatabase() AND event_date >= yesterday() AND event_time > now() - 600
    AND type = 'QueryFinish' AND is_initial_query = 0 AND query LIKE '%mergeTreeAnalyzeIndexesUUID%';

-- leading escape sequences are skipped in keys and are invalid for values
SELECT extractKeyValuePairsWithEscaping('\\:name:val');

SELECT arraySort(mapKeys(extractKeyValuePairs(arrayStringConcat(arrayMap(i -> concat('k', toString(i), ':', toString(i)), range(30)), ' '))));

SELECT '-- different numeric types share one axis: UInt32 keys against Int64 keys with negative values';

DROP TABLE t_sel_null_l;

SELECT count() FROM t_hint_truthy WHERE (id >= 1 AND id <= 3) AND indexHint(toUInt16(256));

SELECT count() FROM t_hint_null WHERE indexHint(id < 10) AND id < 10;

SELECT 'part types', table, arraySort(arrayDistinct(groupArray(part_type))) FROM system.parts
WHERE database = currentDatabase() AND table LIKE 't\_lwu\_rr\_%' AND active
GROUP BY table ORDER BY table;

SELECT count() > 0
FROM (EXPLAIN actions = 1 SELECT m FROM t_map_has_subcolumn WHERE notHas(m, 'debug'))
WHERE explain LIKE '%m.keys%';

SELECT count() FROM t_materialize_statistics_gate;

DROP TABLE t_mutation_drops_physical;

SELECT 'they work as window functions';

SELECT 'regr_count counts, so it answers with a number even when every row was NULL';

SELECT regr_slope(1);

-- The replicas resolve the name the same way whichever analyzer plans the query.
SELECT '-- the same without the analyzer';

-- A table function that builds a storage of its own is not a reference to a table that every replica
-- has, so it must not drive the read. `timeSeriesSelector` reads through the `TimeSeries` table but
-- returns a storage of its own, so it stays on a single replica and still returns each row once.
SELECT '-- a table function that is not a plain table reference';

SELECT tokens('0123456789abcde ', 'splitByString', [' ']);

SELECT groupArray(id) FROM t_split_by_string_blocks WHERE hasAnyTokens(s, ['g', 'h']) SETTINGS force_data_skipping_indices = 'idx';

SELECT position(create_table_query, '`c` Int64 CODEC(ZSTD(3)) STATISTICS(tdigest)') > 0, position(create_table_query, '`d` Int64 CODEC(NONE) STATISTICS(uniq, minmax)') > 0, position(create_table_query, 'INDEX i c TYPE minmax') > 0, position(create_table_query, 'auto_statistics_types = \'basic, uniq_v2\'') > 0 FROM system.tables WHERE database = currentDatabase() AND name = 'ok';

-- Small and with statistics, so a join against it broadcasts it. Four parts, so it is read on four streams.
CREATE TABLE t_exchange_layout_small (sid UInt64, s UInt64) ENGINE = MergeTree ORDER BY sid SETTINGS auto_statistics_types = 'basic';

-- The largest `UInt64` is parsed exactly instead of rounding through `Float64` to 2^64.
* | limit 18446744073709551615 | count();

SELECT id, m
FROM t_map_keys_values_filter_only
WHERE has(mapValues(m), 'api')
ORDER BY id
SETTINGS optimize_functions_to_subcolumns = 0;

SELECT id, arrayMap(hex, tokens(s, 'splitByNonAlpha'))
FROM values('id UInt8, s String', (1, 'aaaaaaaaaaaaaaa'), (2, 'bbbbbbbbbbbbbbbb'),
    (3, ''), (4, '________________'), (5, '\xff\xff'), (6, 'z'))
ORDER BY id;

SELECT 'UTF-8 separators across every block alignment';

SELECT arraySort(groupArray(id)) FROM byte_tokenizer_corners WHERE hasAnyTokens(multi_byte, ['hit', 'hitter'], 'splitByString([\'ab\', \'aba\', \'::\'])') SETTINGS use_skip_indexes = 0;

-- https://github.com/ClickHouse/ClickHouse/issues/113854
-- A table-backed set converts the probe column into the set's key type. A value the key type cannot
-- represent is simply not a member - which is what the literal `IN` list concludes - but the strict
-- conversion raised `CANNOT_CONVERT_TYPE` on the rows the read path happened to deliver, so the same
-- query succeeded or failed depending on how much the plan pruned.

DROP TABLE IF EXISTS t_set_engine;

INSERT INTO t_probe_nullable VALUES (1), (-1), (NULL);

SELECT nullIn(CAST(1 AS Nullable(Int64)), t_set_nullable2);

SELECT uniqExact(rand(1)) >= 99 FROM numbers(100);

-- The primary key analyzes the `const * variable` chain (see the liveness probe below) and must keep every
-- granule here, because `0 * inf` is `NaN`.
SELECT toUInt64OrZero(extract(explain, 'Granules: (\\d+)/')) = toUInt64OrZero(extract(explain, 'Granules: \\d+/(\\d+)')) AS all_granules_kept
FROM (EXPLAIN indexes = 1 SELECT count() FROM t_monotonicity_nan_const_dividend WHERE 0 * k = 0 SETTINGS use_statistics_for_part_pruning = 0)
WHERE explain LIKE '%Granules: %/%';

SELECT 'mixed-width integers';

DROP TABLE oba_part;

CREATE TABLE t_correlated_having_totals (id UInt32, v Int64) ENGINE = MergeTree ORDER BY id;

INSERT INTO t3 VALUES (10);

-- A typed path that can be wrapped in `Nullable` carries the outer NULL, a typed `Array` path has no
-- NULL representation and is default-filled -- exactly like reading the subcolumn directly.
SELECT json['a'], toTypeName(json['a']), json.a, json['arr'], toTypeName(json['arr']), json.arr
FROM t_nullable_json_typed;

DROP TABLE IF EXISTS json_shared_bucketed_map_compact;

-- LIMIT still shrinks the block size with arrayJoin, only the source-side limit stays off (#82279)
DROP TABLE IF EXISTS t_aj_limit;

-- Read the comment back after a reload, so that the stored CREATE query has to carry it too.
DETACH TABLE mv_comment_inner;

DROP TABLE mv_comment_buffer;

-- A refreshable view has an inner table too, and a non-APPEND refresh replaces that table, so read
-- the comment back after one.
CREATE MATERIALIZED VIEW rmv_comment REFRESH EVERY 1 YEAR (id UInt64 COMMENT 'initial')
    ENGINE = MergeTree ORDER BY id EMPTY AS SELECT id FROM rmv_comment_src;

ALTER TABLE t_modify_setting_default_column MODIFY COLUMN s MODIFY SETTING max_compress_block_size = DEFAULT;

ALTER TABLE prewhere_sizes_pruned ADD COLUMN added UInt64 DEFAULT k + 1;

-- Disabling partition pruning must still keep the complete statistics scope.
SELECT sum(value) FROM prewhere_partition_statistics
WHERE team_id = 3 AND ts = '2026-08-01' AND value % 2 = 0
SETTINGS use_statistics = 1, use_partition_pruning = 0, log_comment = '05182_pruning_off';

SELECT replaceRegexpAll(h, '(?im:A)$', 'x') FROM (SELECT 'a\nb\na' AS h);

SELECT count(), sum(k) FROM skip_order_pruned WHERE p IN (7, 15) AND (x = 11 OR y = 7) SETTINGS use_skip_indexes = 0, per_part_index_stats = 1;

-- Both randomized in CI: the aggregation needs more than one stream, and it has to stay single-level
-- so the states are estimated off one hash table.
SET max_threads=4;

-- Check complete expected keys and states, including missing or unexpected keys.
SELECT count(), uniqExact(tuple(type, id)), countIf(status != 20 OR sign != 1),
       countIf((type, id) NOT IN
           (SELECT toDecimal64(number % 64 + 1, 4) / 10000, toDecimal64(1000001 + number, 4) / 10000 FROM numbers(100)))
FROM collapsing_stable_decimal FINAL;

SELECT 'Variant  rows limit=0', t1.a, t2.a, t3.tag FROM t1 LEFT JOIN t2 ON t1.a = t2.a LEFT JOIN t3 ON t2.k = t3.k ORDER BY ALL
    SETTINGS join_use_nulls = 1, query_plan_optimize_join_order_limit = 0;

-- With these two on, the same read reaches an earlier unguarded dereference of the same null query.
SELECT 'alias, plan-based parallel replicas', sum(x)
FROM remote('127.0.0.2', currentDatabase(), t_merge_proxy_alias)
SETTINGS parallel_replicas_plan_based = 1, parallel_replicas_allow_merge_tables = 1;

SELECT count() FROM v_join_pr_rewrite_shapes WHERE tenant = 2;

CREATE TABLE prewhere_statistics_throwing_partition (p Int64, value UInt64)
ENGINE = MergeTree PARTITION BY p ORDER BY tuple()
SETTINGS auto_statistics_types = 'basic, uniq_v2';

-- Cross the default HyperLogLog thresholds and the thinning threshold in `uniq`.
INSERT INTO uniq_multi_place SELECT number % 8, intDiv(number, 8) FROM numbers(8 * 140001);

SELECT
    'query_cache',
    -- One of each: the first execution filled the cache, the second was served from it.
    countIf(query_cache_usage = 'Write'),
    countIf(query_cache_usage = 'Read'),
    -- The one that executed has a plan.
    countIf(query_cache_usage = 'Write' AND length(JSONExtractArrayRaw(toJSONString(query_plan), 'Nodes')) > 0),
    -- The one served from the cache has none, because nothing ran.
    countIf(query_cache_usage = 'Read' AND empty(JSONExtractArrayRaw(toJSONString(query_plan), 'Nodes')))
FROM system.query_log
WHERE current_database = currentDatabase() AND type = 'QueryFinish' AND log_comment = '05184_query_cache';

CREATE TABLE src_dpc (x UInt64) ENGINE = MergeTree ORDER BY x;

WITH s AS MATERIALIZED (SELECT x FROM t_dpc WHERE x IN (SELECT x FROM t_dpc2 WHERE x < 60000)) SELECT count() FROM (SELECT x FROM s UNION ALL SELECT x FROM s) SETTINGS log_comment = '05185_dpc_21_materialized_cte_union';

DROP VIEW v_dpc;

ALTER TABLE readonly_outdated MODIFY SETTING table_readonly = 0;

-- Both numberings keep pruning granules: neither reads all 14 marks of the table, and the counts above show
-- that no matching row is lost.
SELECT
    (SELECT marks FROM (EXPLAIN ESTIMATE SELECT count() FROM t_dow_date WHERE toDayOfWeek(d, 1) >= 5)) < 14
    AND (SELECT marks FROM (EXPLAIN ESTIMATE SELECT count() FROM t_dow_date WHERE toDayOfWeek(d, 2) >= 5)) < 14 AS both_modes_prune;

INSERT INTO t_shadow_ngrambf VALUES ({'abc' : 'x'}, 'hello');

-- A typed JSON path is enumerated as a subcolumn by a different serialization than a Tuple element, so it
-- claims the name through its own code path. Dots separate JSON paths, so the claiming path is a sub-path
-- of the map path: the map itself stays empty and every key probe misses.
DROP TABLE IF EXISTS t_shadow_json_path;

-- The predicate is expanded by a separate call, so it is asserted separately: it marks the row the
-- updated database names (2), not the one the session database names (99).
UPDATE {CLICKHOUSE_DATABASE_1:Identifier}.u
    SET v = 11
    WHERE id IN (WITH src AS (SELECT 7 AS id) SELECT (SELECT max(id) FROM src SETTINGS enable_global_with_statement = 0));

SELECT v FROM {CLICKHOUSE_DATABASE_1:Identifier}.u WHERE id = 28;

DROP TABLE IF EXISTS t_rf_merge;

SELECT 'mixed engines: not in reverse order';

INSERT INTO t_rf_b SELECT number + 5000, 3 FROM numbers(10000);

-- Plan gates for a descending sorting key, where the reading direction is the sort description's
-- direction flipped by the key's reverse flag. Counting the Sort + Limit pairs alone cannot tell
-- a sound deferral from one where the second pass rejects the read afterwards (both leave only
-- the outer pair), so these also count the reading types: the deferral is only correct when it
-- ends in an in-order or reverse-order read of the left table.
SELECT 'plan_desc_key_asc_sort_on' AS label,
       countIf(explain LIKE '%Sorting%') AS sort_count,
       countIf(explain LIKE '%InReverseOrder%') AS reverse_reads,
       countIf(explain LIKE '%: InOrder%') AS direct_reads
FROM ( EXPLAIN actions = 1
    SELECT l.k, r.v FROM t_desc_key AS l FINAL LEFT JOIN t_right AS r ON r.k = l.k
    ORDER BY l.k ASC LIMIT 10 SETTINGS optimize_read_in_reverse_order_final = 1
);

SELECT arrayShiftLeft([1::Int64, 2, 3], 1, NULL::Nullable(Int64));

SELECT 'prewhere_with_set';

SELECT 'the ROLLUP and GROUPING SETS forms';

SELECT '-- a narrower unsigned divisor was always correct, because promotion lifts both to signed int';

SELECT moduloLegacy(toInt256(-1), toUInt256(10));

-- The array-joined values themselves, to show the filter selects the right rows.
SELECT 'the values', id, data FROM t_05197_merge ARRAY JOIN data WHERE data = 'ccc' AND id < 5 ORDER BY id;

INSERT INTO t_05198_scalar SELECT '{"x":42}' FROM numbers(4);

INSERT INTO t_05198_text_paths SELECT '{"a":{"b":42}}' FROM numbers(4);

SELECT engine FROM system.tables WHERE database = currentDatabase() AND name = 'lazy_bound';

DROP TABLE t_05199_merge;

SELECT 'the first part, without pruning', count() FROM t_05200 WHERE x = 10 SETTINGS use_statistics_for_part_pruning = 0;

CREATE TABLE t_05200_topk (a UInt64, b UInt64, INDEX idx b TYPE minmax GRANULARITY 1) ENGINE = MergeTree ORDER BY a
SETTINGS index_granularity = 10, min_bytes_for_wide_part = 0;

INSERT INTO t_05200_qcc SELECT number, number + 1000, 'x' FROM numbers(100);

KILL MUTATION WHERE database = currentDatabase() AND table = 't_05200_type' SYNC FORMAT Null;

SELECT 'the rewrite dropped the column', countIf(column = 'c') FROM system.parts_columns
WHERE database = currentDatabase() AND table = 't_05202' AND active;

SELECT 'with rescoring', count() FROM (SELECT id FROM t_05205 ORDER BY L2Distance(v, [5.0, 5.0]) LIMIT 3 SETTINGS vector_search_with_rescoring = 1);

-- The nested value of a NULL slot is unspecified, and for a `Nullable(Enum)` it is usually not a
-- member of the type: `INSERT ... VALUES (NULL)` and the padding of non-joined rows under
-- `join_use_nulls = 1` both leave a raw 0 there. `LIKE`, `ILIKE`, `NOT LIKE`, `match` and the other
-- string searches read the nested column without the null map, so a single NULL row made them throw
-- `UNKNOWN_ELEMENT_OF_ENUM` (`Unexpected value 0 in enum`), while `toString`, `=` and `IN` on the
-- same rows worked. Those slots now hold the enum's default before a function sees them.

DROP TABLE IF EXISTS t_05207;

DROP TABLE t_05207_zero;

SELECT 'sums', sum(a), sum(b), sum(c), sum(d) FROM t_05209_merge;

SELECT countIf(explain ILIKE '%MergingAggregated%') - 1 = countIf(explain ILIKE '%GatherExchange%'),
       countIf(explain ILIKE '%GatherExchange%') > 0
    FROM (EXPLAIN PLAN distributed = 1 SELECT k, sum(v) FROM remote('127.0.0.{2,3}', currentDatabase(), t_cascades_bucket_order) GROUP BY k
        SETTINGS make_distributed_plan = 1, enable_cascades_optimizer = 1, distributed_plan_workers_num = 2,
                 distributed_aggregation_memory_efficient = 1, enable_memory_bound_merging_of_aggregation_results = 0)
    SETTINGS make_distributed_plan = 0;

DROP TABLE IF EXISTS right_local_05210;

-- 1. The reported symptom: a correlated scalar subquery over an all-NaN column is decorrelated into a
-- join, and the runtime filter emptied its probe side, so every scalar came back NULL.
CREATE TABLE nan_scalar (id UInt64, f Float64) ENGINE = MergeTree ORDER BY id;

-- Bracket syntax `json['key']` with a nullable key: `arrayElement` accepts a constant `Nullable(String)`
-- key and a NULL key for `Array` and `Map`, and the `JSON` overload must keep that contract.

DROP TABLE IF EXISTS t_json_nullable_key;

CREATE TABLE json_compact_parent_cache
(
    id UInt64,
    j JSON(p UInt64, q String, max_dynamic_paths = 0),
    wrapped Tuple(data JSON(p UInt64, max_dynamic_paths = 0))
)
ENGINE = MergeTree ORDER BY id
SETTINGS min_bytes_for_wide_part = '200G', min_rows_for_wide_part = 1,
    write_marks_for_substreams_in_compact_parts = 0, index_granularity = 2;

INSERT INTO lower_upper_utf8_mixed_ascii VALUES
    (1, 'ASCII prefix'),
    (2, 'MÜNCHEN'),
    (3, 'ASCII middle'),
    (4, 'Straße'),
    (5, 'ASCII suffix'),
    (6, '東京'),
    (7, ''),
    (8, 'ASCII tail'),
    (9, 'İ'),
    (10, 'ASCII after expansion'),
    (11, '\xe2'),
    (12, 'ASCII after invalid UTF-8'),
    (13, 'K'),
    (14, 'ASCII after contraction'),
    (15, 'é'),
    (16, 'Ab');

ALTER TABLE t_05210_replicated DROP COLUMN c;

INSERT INTO t_nullable_tuple_element_rewrite VALUES (1, (10, 'x', 'lc1')), (2, NULL), (3, (30, NULL, 'lc3')), (4, (40, 'y', 'lc4'));

SELECT 'all value sum', numericIndexedVectorAllValueSum(groupNumericIndexedVectorState(1::UInt32, v)) FROM (SELECT arrayJoin([5, 3])::UInt64 AS v) SETTINGS max_threads = 1;

SELECT 'not equal to zero, merged', numericIndexedVectorToMap(numericIndexedVectorPointwiseNotEqual(groupNumericIndexedVectorMergeState(s), 0))
FROM (SELECT groupNumericIndexedVectorState(k, v) AS s FROM t_05210_zero GROUP BY i);

CREATE TABLE t_qp_05210
(
    d AggregateFunction(quantile(0.5::Decimal32(1)), Float64),
    w AggregateFunction(quantile(1::Int256), Float64),
    u AggregateFunction(quantile('00000000-0000-0000-0000-000000000000'::UUID), Float64),
    t AggregateFunction(quantileExactTuple(0.5::Decimal32(1)), Tuple(Float64))
)
ENGINE = MergeTree ORDER BY tuple();

INSERT INTO test_sfc_uint64_hilbert_pk VALUES (4294967296, 0);

DROP TABLE IF EXISTS t_ckn_index;

SELECT timeSeriesPresentToGrid(100, 120, 10, 30)([1, 2, 3]::Array(UInt32), 1.);

OPTIMIZE TABLE t_ttl_vert_repl_no_version FINAL;

SELECT 'test4_cols', sum(c1), sum(c2), sum(c3) FROM t_ttl_vert_repl_where;

DROP TABLE t_ap_05211;

SELECT arrayFilter((x, keep) -> keep, CAST([1, NULL, 2], 'Array(Nullable(Int8))'), materialize([1, 1, 1]));

DROP TABLE IF EXISTS right_distributed_05211;

-- Constant patterns must produce the same results on both paths, including
-- matches at the first and last positions, misses, empty Maps, and multi-element Maps.
DROP TABLE IF EXISTS t_map_contains_like_constants;

DROP TABLE t_map_contains_like_fixed;

DROP TABLE t_map_contains_like_nullable_pattern;

-- Dividing by an index that is missing gives zero, and that index keeps its explicit zero too.
WITH (SELECT groupNumericIndexedVectorState(k, x) FROM VALUES('k UInt32, x Int8', (1, 1), (2, 7))) AS v1,
     (SELECT groupNumericIndexedVectorState(k, x) FROM VALUES('k UInt32, x Int8', (1, 2))) AS v2
SELECT 'divide by a missing index', numericIndexedVectorToMap(numericIndexedVectorPointwiseDivide(v1, v2));

CREATE TABLE t_prewhere_pinned_r2 (k UInt64, a String CODEC(NONE), b String CODEC(NONE), payload String CODEC(NONE))
ENGINE = ReplicatedMergeTree('/clickhouse/tables/{database}/test_05211/t', 'r2') ORDER BY k
SETTINGS min_bytes_for_wide_part = 0, min_rows_for_wide_part = 0;

SELECT 'absent_over_time: series differing only by the metric name do not clash in the presence grid';

INSERT INTO t_ttl_vert_coll_off SELECT * FROM t_ttl_vert_coll;

-- `query_plan_aggregation_bucket_top_k` controls both conversion-stage selection and threshold
-- merging. The global query-plan optimization switch disables both paths as well.
SET query_plan_enable_optimizations = 1;

-- One thread compresses `b` right after `a`, so the 1 MiB window and long-range matching of `ZSTD(3, 20)` must not leak into `ZSTD(1)`:
-- the period of `b` (800 KB) is beyond the 512 KiB window of `ZSTD(1)`, so `b` stays incompressible.
DROP TABLE IF EXISTS t_zstd_pooled;

INSERT INTO t_isnull_wide SELECT if(number % 3, NULL, materialize('x')) FROM numbers(30);

DROP TABLE t_isnull_compact;

-- On a storage with case-sensitive name resolution a top-level `M.keys` column does not shadow the
-- m.keys subcolumn, so has(), notHas() and mapContainsKey() must still be rewritten and must still
-- read the Map's own keys. The same holds for mapContainsValue() next to a top-level `M.values`.
DROP TABLE IF EXISTS t_05212_map_keys_ci;

-- Named, unsigned, signed positive and negative indices identify the same element.
SELECT tupleElement(t, 'u'), tupleElement(t, 1), tupleElement(t, 1::Int64), tupleElement(t, -6)
FROM nullable_tuple_elements ORDER BY id;

DROP TABLE nullable_tuple_containers;

-- pointwiseMultiply only reaches initializeFromVectorAndValue when all values of lhs are 1.
DROP TABLE IF EXISTS uin_ones_f64;

SELECT count(), uniqExact(k) FROM (SELECT DISTINCT number % 100 AS k FROM numbers_mt(100000) LIMIT 5);

DROP TABLE IF EXISTS t_05212_src SYNC;

SELECT timeSeriesQuantileToGrid(100, 120, 10, 30)(timestamp, value, 1) FROM quantile_input;

-- Grid [100, 110] with a 30 second window: the first grid point sees only (100, 1),
-- the second one sees all three samples.
WITH [100, 105, 110]::Array(DateTime) AS timestamps, [1, nan, 2]::Array(Float64) AS values
SELECT timeSeriesQuantileToGrid(100, 110, 10, 30)(timestamps, values, 0.5);

-- Basic behavior and first ties.
SELECT arrayMinIndex([5, 3, 2, 7]), arrayMaxIndex([5, 3, 2, 7]);

-- The read asks for nothing but the re-added member, so `injectRequiredColumns` adds the smallest
-- column of the part to carry the row count - and that column is the one the cache has an entry
-- for, which is what turns the second read into a hit.
SELECT sum(length(`arr.nested`.b)) FROM t_cc_remote_partially_read SETTINGS
    use_columns_cache = 1,
    enable_writes_to_columns_cache = 1,
    enable_reads_from_columns_cache = 1,
    allow_prefetched_read_pool_for_remote_filesystem = 1,
    remote_filesystem_read_method = 'threadpool',
    remote_filesystem_read_prefetch = 1,
    max_threads = 1,
    log_comment = '05213_cold';

-- The stale alias is on a nested node: the outer toString is unwrapped down to the key toString(c0)...
SELECT toString(toString(c0) AS y) AS s, sum(c1) AS m FROM t_limit_by_aliased_key GROUP BY toString(c0) WITH ROLLUP ORDER BY s, m LIMIT 1 BY 1;

SET max_execution_time = 10;

SELECT 'quantile_over_time(0, up[3m]) and quantile_over_time(1, up[3m]): the minimum and the maximum';

SELECT number, substring(concat('value_', toString(number)), 1)
FROM numbers(3)
ORDER BY number;

-- A budget below the uncompressed size of the whole part but far above the surviving granule.
-- Without the refiner every selected mark is charged, the gate trips and nothing is written.
SELECT max(payload) != '' FROM t_cc_estimate_refiner WHERE region = 'rare'
SETTINGS use_columns_cache = 1, enable_writes_to_columns_cache = 1, enable_reads_from_columns_cache = 1,
    use_indexes_refiner_in_read_pools = 0,
    columns_cache_max_estimated_bytes_to_write_to_cache = 4000000;

INSERT INTO 05214_skip VALUES ('2024-01-02 03:00:00', 1), ('2024-01-02 20:00:00', 2), ('2024-01-05 12:00:00', 3);

SELECT trim(explain)
FROM (
    EXPLAIN indexes = 1 SELECT count() FROM 05214_day WHERE dt = '2024-01-03 05:00:00'
)
WHERE trim(explain) ilike 'condition: %' OR trim(explain) ilike 'parts: %'
SETTINGS session_timezone = 'Asia/Tokyo';

-- The join is inside the shipped fragment, so the fragment carries a `JoinLogical` step.
SELECT 'the join is shipped to the replicas';

-- A query with a condition reads `s` only for the rows that pass, in pieces of the granules:
-- every piece is served from the entries above, nothing is read from the part.
SELECT sum(length(s)) FROM t_cc_granules WHERE v = 3
SETTINGS use_columns_cache = 1, log_comment = 'cc_granules_condition';

-- Consumers of globally sorted `DISTINCT` input retain its order.
SELECT groupArray(k) = range(1000) FROM (SELECT DISTINCT k FROM (SELECT number % 1000 AS k FROM numbers_mt(50000) ORDER BY k)) SETTINGS optimize_distinct_in_order = 0;

SELECT count(), sum(r.key), sum(l.generate_series) FROM generate_series(0, 18, 2) AS l
RIGHT JOIN t_numbers_join AS r ON l.generate_series = r.key;

-- A vertical rows-TTL merge builds the TTL expressions twice; a `WHERE ... IN (SELECT ...)` set must be
-- filled once and shared, and without the shared cache the counter below reads 2. Settings are pinned:
-- `SetsBuiltFromSubquery` reaches `part_log` only while a small set is built on the merge's own thread.

SET optimize_throw_if_noop = 0;

-- Observability of tie extension (review feedback): the correct top-5 by
-- (v ASC, id DESC) lives in the LAST tied granules (ids 199..195). If a
-- regression kept only the first n*index_granularity granules, the result
-- would be 79..75 instead — the queries above could not see that.
SELECT id FROM t_topk_handle_ties
ORDER BY v ASC, id DESC LIMIT 5
SETTINGS use_skip_indexes_for_top_k = 1, use_skip_indexes = 1, query_plan_max_limit_for_top_k_optimization = 0, use_top_k_dynamic_filtering = 0;

DROP TABLE t_shipped_limits_small SYNC;

SELECT
(
    SELECT sum(cityHash64(a, b, c, s)) FROM
    (
        SELECT a, b, count() AS c, sum(v) AS s FROM t_agg_in_order_fixed_keys_runs GROUP BY a, b
        SETTINGS optimize_aggregation_in_order = 1, optimize_read_in_order = 1,
                 max_threads = 1, max_block_size = 200000,
                 preferred_block_size_bytes = 0, preferred_max_column_in_block_size_bytes = 0
    )
)
=
(
    SELECT sum(cityHash64(a, b, c, s)) FROM
    (
        SELECT a, b, count() AS c, sum(v) AS s FROM t_agg_in_order_fixed_keys_runs GROUP BY a, b
        SETTINGS optimize_aggregation_in_order = 0, optimize_read_in_order = 0
    )
);

-- The null map subcolumn alone, the whole column, and both columns: without the cache, with the
-- cache while it is filled, and with the cache warm.
SELECT 'null map', countIf(n IS NULL), countIf(n IS NOT NULL) FROM t_cc_sparse_null SETTINGS use_columns_cache = 0;

DROP VIEW external_distinct_nested_keys;

SELECT id,
    dictGet('conversion_null_scalar', 'attr', s) = 'hit',
    dictGet('conversion_null_scalar', 'attr', tuple(s)) = 'many',
    dictGet('conversion_null_scalar', 'attr', s) LIKE 'hi%',
    dictGet('conversion_null_first', 'attr', (s, 'a')) = 'hit',
    dictGet('conversion_null_first', 'attr', kt) LIKE 'hi%',
    dictGet('conversion_null_second', 'attr', ('a', s)) = 'other',
    dictGet('conversion_null_second', 'attr', ('a', s)) LIKE 'oth%'
FROM conversion_strings ORDER BY id SETTINGS optimize_inverse_dictionary_lookup = 0;

SELECT count() FROM conversion_arrays WHERE dictGet('conversion_numbers', 'attr', x) LIKE 'si%' SETTINGS optimize_inverse_dictionary_lookup = 0;

SELECT if(x[1] = 0, 1, dictGet('conversion_numbers_composite', 'attr', (toUInt8(1), x)) LIKE 'si%') FROM conversion_arrays SETTINGS optimize_inverse_dictionary_lookup = 1;

INSERT INTO t_pushdown_u64 VALUES (0, 'u64_0'), (1, 'u64_1'), (4, 'u64_4');

DROP TABLE t_pushdown_str;

SELECT id, time FROM t_mut_in64 ORDER BY id;

SELECT hex(reverse(unhex('01020304050607')));

-- Window result columns alone do not determine the input partition.
SELECT count(), sum(c), min(c), max(c) FROM
(
    SELECT rn, s, count() AS c
    FROM
    (
        SELECT k, row_number() OVER w AS rn, sum(x) OVER w AS s
        FROM (SELECT DISTINCT number % 10 AS k FROM numbers_mt(10000))
        ARRAY JOIN [0, 1] AS x
        WINDOW w AS (PARTITION BY k ORDER BY x)
    )
    GROUP BY rn, s
);

SELECT '-- mapValues: the index prunes granules through the cast';

SELECT 'toNullable', trimLeft(explain) FROM (EXPLAIN indexes = 1 SELECT id FROM tab_s WHERE hasToken(toNullable(s), 'network')) WHERE explain LIKE '%Name:%' OR explain LIKE '%Granules:%';

DROP TABLE tab_ns;

SELECT 'missing and empty labels';

SELECT count() FROM ts_text_memory;

SELECT accurateCastOrNull(253402300799.9::Float64, 'DateTime64(1, \'UTC\')') SETTINGS date_time_overflow_behavior = 'throw';

DROP DICTIONARY IF EXISTS d_revert;

ALTER TABLE t_reset_implicit_indices
    ADD COLUMN b UInt64,
    MODIFY SETTING min_bytes_for_wide_part = 7, enable_block_number_column = DEFAULT;

DROP VIEW v_any_alias;

-- Never considered: FINAL is rejected before the eligibility check, by the plan itself.
SELECT b, count() FROM t_autopr_gate FINAL GROUP BY b FORMAT Null
SETTINGS log_comment = 'autopr_gate_ineligible_final';

-- A plan that builds a set is rooted in the `CreatingSetStep` that fills it, and `addPlansForSets`
-- optimizes it like any other plan, so AutoPR gets to consider it. It must not: switching to the
-- parallel-replicas candidate replaces the root of the plan, and that root is what makes the plan a
-- set-building one - the candidate is built without it, so `CreatingSetsStep` would be handed a plan
-- carrying the subquery's own columns instead of the empty header it requires.
--
-- A `GLOBAL IN` runs its subquery as a plan of its own, which is what brings a set-building plan in front
-- of AutoPR here, and the optimization logs the refusal when it declines to take it. That log line is what
-- this test looks for, in both implementations of parallel replicas.

DROP TABLE IF EXISTS t_autopr_set_root_hits;

SELECT CAST(0x1p3 AS Decimal32(2)), CAST((1e3) AS Decimal32(2));

SELECT trim(explain) FROM (
    EXPLAIN PLAN actions = 1
    SELECT count(), sum(f.v) FROM fact AS f LEFT JOIN mid AS m ON f.id = m.id INNER JOIN small AS s ON m.val IS NOT DISTINCT FROM s.val
) WHERE trim(explain) IN ('Type: INNER', 'Type: LEFT', 'Type: RIGHT', 'Type: FULL');

SELECT count() FROM t_dt64_in_set WHERE dt IN (toUInt64(1));

select count() from (select 1 where toTime64('999:59:59', 6) in (3600000));

select count() from (select 1 where toDateTime64('1970-01-01 00:00:01', 3, 'UTC') in (toDecimal128('999999999999', 0)));

select count() from (select 1 where toTime64('00:00:01', 6) in (3600000.5));

select count() from t_05218 where dt in (1, 99999999999999999);

select 'A DateTime64 constant inserted into a Time64 column: VALUES must agree with SELECT';

insert into t_05218_time64_nullable_source values (cast(toDateTime64('1970-01-02 12:34:56.789', 3, 'UTC') as Nullable(DateTime64(3, 'UTC'))));

-- no-fasttest: AES_128_GCM_SIV depends on OpenSSL.

-- The structural substreams (`.size`, `.null`, `.dict`, `.size0`) must be encrypted like the values.

DROP TABLE IF EXISTS t_enc_substreams;

SET optimize_move_to_prewhere = 1, query_plan_remove_unused_columns = 1;

CREATE TABLE t_pb_r (x UInt32, y UInt32, d UInt32)
ENGINE = MergeTree ORDER BY tuple()
SETTINGS auto_statistics_types = 'basic, uniq_v2';

SELECT formatQuerySingleLine('SELECT 1 WINDOW w AS (ORDER BY a), x AS (ROWS UNBOUNDED PRECEDING)');

DROP DICTIONARY comparison_first;

SELECT count() FROM (SELECT id, 0 AS c FROM t_ann_matched) AS m ANY RIGHT JOIN t_ann_left ON t_ann_left.id = m.id
WHERE assumeNotNull(nullIf(m.c, 0) + 42);

SELECT l.k, r.k, r.w FROM t_lc_l AS l FULL JOIN t_lc_r AS r ON l.k = r.k
ORDER BY ALL SETTINGS join_algorithm = 'hash', query_plan_join_swap_table = 0;

SELECT '-- 7. ASOF LEFT, LowCardinality key, full_sorting_merge';

SELECT JSONExtractRaw(json, 'a'), JSONExtractRaw(json, 'a.b') FROM t_json_both_typed_null ORDER BY rowNumberInAllBlocks()
SETTINGS type_json_skip_null_typed_paths = 1;

SELECT toTypeName(mapContainsKeyValue(map('k1', 'v1'), 'k1', 'v1'));

SELECT mapContainsKeyValue(CAST(map('k', NULL) AS Map(String, Nullable(String))), 'k', materialize(CAST(NULL AS Nullable(String))));

CREATE TABLE t_map_lc_wide (id UInt64, m Map(LowCardinality(String), String))
ENGINE = MergeTree ORDER BY id SETTINGS min_bytes_for_wide_part = 0;

CREATE TABLE t_map_key_types (id UInt64, m Map(IPv6, String)) ENGINE = MergeTree ORDER BY id SETTINGS min_bytes_for_wide_part = 0;

DROP TABLE t_map_value_types;

DROP TABLE IF EXISTS mv_05218;

SELECT t.d, t.e, t.s, t.c FROM t_named_tuple_retype ORDER BY id;

SELECT count(), uniqExact(k) FROM (SELECT DISTINCT k FROM distinct_reused_limits LIMIT 7);

-- A `NOT` under an `OR` is still not weakened.
SELECT count() FROM t_projection_polarity WHERE a = 1 AND (x = 5 OR NOT (a = 1 AND b = 2));

SELECT '--- applies ---';

SELECT 'negative bound', count() FROM (EXPLAIN actions = 1
    SELECT a, count() AS cnt FROM having_prefilter GROUP BY a HAVING cnt > -1
) WHERE explain LIKE '%HAVING pre-filter%';

-- An arrayJoin lowered out of the HAVING leaves the bound in its own filter directly above the
-- aggregation; each surviving group is expanded into two rows above it.
SELECT count(), sum(cnt) FROM (SELECT a, count() AS cnt FROM having_prefilter GROUP BY a HAVING cnt > 3 AND arrayJoin([1, 2, 2]) = 2)
    SETTINGS query_plan_aggregation_having_prefilter = 0, query_plan_lower_array_join_function = 1, log_comment = '05218hp_gt_arrayjoin_off';

INSERT INTO having_prefilter_parts SELECT number % 1000, number FROM numbers_mt(10000);

CREATE ROW POLICY rp_set_rp ON set_rp USING 1 TO ALL;

SET max_block_size = 7;

-- A later decisive value overrides an earlier NULL and skips the throwing suffix.
SELECT groupArray(tuple(and(if(number = 0, NULL, toNullable(toUInt8(1))), number != 0, intDiv(1, toInt64(number))))) FROM numbers(8);

-- `payload` is read by the main reader, since the filter is on `message` alone. Without granule-tail
-- trimming it is read for all 8192 rows of each selected granule instead of for the matching row.
-- The counter is only meaningful if the text index reader is the one in the chain; the third
-- column is nonzero only when MergeTreeReaderTextIndex::readRows ran.
SELECT log_comment,
    argMax(ProfileEvents['RowsReadByMainReader'], event_time_microseconds),
    argMax(ProfileEvents['TextIndexReaderTotalMicroseconds'], event_time_microseconds) > 0
FROM system.query_log
WHERE current_database = currentDatabase() AND type = 'QueryFinish' AND event_date >= yesterday()
    AND log_comment IN ('05218_selective', '05218_selective_midmark')
GROUP BY log_comment
ORDER BY log_comment;

SELECT '-- quotes, backslashes and control bytes in a pair are escaped in the descriptions';

SELECT 'suffix', groupArray(id) FROM tab WHERE message LIKE '%tobb0' SETTINGS log_comment = '05218_suffix';

SELECT 'two parts', groupArray(id) FROM tab_parts WHERE message LIKE 'toaa%';

INSERT INTO tab_no_literal VALUES
    (1, 'a1b1c1d'), (2, 'a2b2c2d'), (3, 'a3b3c3d'), (4, 'a4b4c4d'),
    (5, 'a5b5c5d'), (6, 'toaa0'), (7, 'toaa1'), (8, 'tobb0'),
    (9, 'tocc0'), (10, 'todd0'), (11, 'toee0'), (12, 'toff0');

SELECT type, subcolumn_codecs['value'] AS value_codec, count()
FROM system.columns
WHERE database = currentDatabase() AND name = 'samples'
    AND (table LIKE '.inner_id.samples.%' OR table LIKE '.inner_id.recentsamples.%')
GROUP BY type, value_codec
ORDER BY type, value_codec;

SELECT count(), sum(id), sum(length(b)) FROM t_zero_byte_first WHERE NOT ignore(*) SETTINGS max_block_size = 3;

INSERT INTO t_statements (id) SELECT number FROM numbers(10);

DROP TABLE t_statements;

DROP TABLE truncate_mv_src;

SELECT 'consistency with sort order';

DROP TABLE t_transplant_self;

SELECT '-- `coalesce` does not allow converting.';

DROP TABLE mid_two;

CREATE DICTIONARY container_map (m Map(String, Nullable(UInt8)), attr String DEFAULT '')
PRIMARY KEY m SOURCE(CLICKHOUSE(TABLE 'container_key_source')) LAYOUT(COMPLEX_KEY_HASHED()) LIFETIME(0);

SELECT 'FULL + LEFT JOIN USING, cross-type keys: the push-down does not change the result';

CREATE TABLE repro_offsets
(
    x UInt64,
    payload UInt64,
    PROJECTION commit_order INDEX *, _part_offset TYPE commit_order
        WITH SETTINGS (index_granularity = 1)
)
ENGINE = MergeTree
ORDER BY x
SETTINGS
    enable_block_number_column = 1,
    enable_block_offset_column = 1,
    allow_commit_order_projection = 1,
    part_minmax_index_columns = 'with_block_number_offset',
    add_minmax_index_for_block_number_column = 1,
    add_minmax_index_for_block_offset_column = 1,
    index_granularity = 8,
    merge_selector_algorithm = 'Manual';

SELECT count() FROM (SELECT m.val AS val FROM fact AS f LEFT JOIN mid AS m ON f.id = m.id GROUP BY m.val) AS g INNER JOIN small AS s ON g.val = s.val;

SELECT 'narrower signed type, equals - plan';

SELECT 'nullable probe, opt off';

SELECT count() FROM tab WHERE m[CAST(NULL AS LowCardinality(Nullable(String)))] = 'value5';

CREATE TABLE storage_join (val UInt64, s Nullable(String)) ENGINE = Join(ALL, LEFT, val);

SELECT trim(explain) FROM (
    EXPLAIN PLAN actions = 1
    SELECT count(), sum(f.v) FROM fact AS f LEFT JOIN mid AS m ON f.id = m.id LEFT ANTI JOIN small AS s ON m.val = s.val
) WHERE trim(explain) IN ('Type: INNER', 'Type: LEFT', 'Type: RIGHT', 'Type: FULL', 'Strictness: SEMI', 'Strictness: ANTI');

SELECT '-- absent key, empty FixedString needle: all rows match';

SELECT 'a seeded sample stays deterministic';

-- The shipped shard queries are read back from `system.query_log` below. A local replica is read
-- in process and is never logged, so the TCP path has to be forced (as `03546` does).
SET prefer_localhost_replica = 0;

-- A boundary mark of a `Tuple` key column can hold a `NULL` inside the tuple. The key stores NULLs
-- last, while `Field` order puts them below every value, so such a mark used to compare below the mark
-- before it: the granule between them looked empty and the rows it holds were never read.

DROP TABLE IF EXISTS t_pk_tuple_nullable_element;

CREATE TABLE t_pk_tuple_nullable_element (t Tuple(UInt8, Nullable(UInt8)), x Int32) ENGINE = MergeTree ORDER BY t
SETTINGS index_granularity = 2, allow_nullable_key = 1;

SELECT '-- 33b. a sibling index rebuilt by MODIFY COLUMN of a marker-only column does not keep the column absent';

CREATE TABLE t_sibling_marker_cleared (k UInt64, d DateTime, c String TTL d + INTERVAL 1 SECOND,
    g UInt64, INDEX idx_old (c, g) TYPE set(100) GRANULARITY 1)
ENGINE = MergeTree ORDER BY k
SETTINGS index_granularity = 4, min_bytes_for_wide_part = 0, min_rows_for_wide_part = 0,
    ratio_of_defaults_for_sparse_serialization = 1.0,
    skip_empty_columns_on_insert = 1, serialization_info_version = 'with_missing_columns';

SELECT 'created read-only, empty', count() FROM t_readonly_streaming STREAM BOUNDED;

INSERT INTO t_text_padded_needle SELECT 2, 'world';

INSERT INTO t_text_padded_needle SELECT 1, [concat('hello', unhex('0000000000')), 'foo'];

SELECT '---- a needle longer than the column declines the index';

SELECT groupArray(id) FROM (SELECT id FROM t_text_padded_needle WHERE mapContainsKey(m, toFixedString('hello', 10)) ORDER BY id) SETTINGS use_skip_indexes = 0;

SELECT toDateTime64('1970-01-01 00:00:00', 0) IN (toDateTime64('1970-01-01 00:00:00.0', 1));

SELECT 'quantileDeterministic multiply via groupArray', finalizeAggregation(arrayJoin(groupArray(s))) FROM (SELECT quantileDeterministicState(number, number) * 2 AS s FROM numbers(10));

SELECT count(), countIf(r.id IS NOT NULL), countIf(l.a <=> r.a) FROM t_ns_left l ANY LEFT JOIN t_ns_right r ON l.a <=> r.a SETTINGS join_use_nulls = 1;

SELECT count(), countIf(l.a IS NULL), sum(l.id + r.id) FROM t_ns_left l INNER JOIN t_ns_right r ON l.a::Nullable(UInt256) <=> r.a::Nullable(UInt256) AND l.d <=> r.d;

SELECT count() FROM (EXPLAIN actions = 1
    SELECT toUInt64(number) AS k, count() FROM numbers_mt(100000) GROUP BY k LIMIT 5
    SETTINGS query_plan_max_limit_for_top_k_optimization = 4)
WHERE explain LIKE '%Top-K%' OR explain LIKE '%Sorting for GROUP BY top-K%';

-- The mirrored shape: an integer column wider than the native width of the `Decimal` constant.
DROP TABLE IF EXISTS t_aggregate_arithmetic_int;

-- Generic hashed types must count `NULL` separately from the nested type's default value.
SELECT arrayUniq([NULL, toDecimal32(0, 2)]);

CREATE TABLE t_autopr_forced_projection (key UInt64, val UInt64,
    PROJECTION p_by_val (SELECT key % 997 AS g, count() GROUP BY key % 997))
ENGINE = MergeTree ORDER BY key;

DROP TABLE t_autopr_subquery_settings;

SELECT '-- a column CODEC accepts any spelling and stores the canonical description';

SELECT '-- `Default` needs an enclosing default, so it is rejected in a codec given as a string, in any spelling';

SELECT 'a column predicate is still pushed down';

SELECT x, y, v, v.String, v.UInt64 FROM t_cc_alter_variant ORDER BY x SETTINGS use_columns_cache = 1;

SELECT countIf(toDayOfWeek(d, 3) = 1), count() FROM t_day_of_week_mode WHERE toDayOfWeek(d, 3) = 1;

SELECT count() FROM (SELECT DISTINCT s FROM dist_int8);

-- The mismatched column can be selected as long as it is not sorted by.
SELECT s FROM dist_mixed ORDER BY k DESC LIMIT 2;

SELECT '-- a single shard groups and deduplicates by its own type, so a key over the column is refused there';

-- https://github.com/ClickHouse/ClickHouse/issues/116955
-- `enable_automatic_decision_for_merging_across_partitions_for_final` skips the cross-partition FINAL
-- merge when the partition expression only reads primary-key columns, on the assumption that equal
-- primary-key values give equal partition values. The FINAL comparator is coarser than value identity
-- for floats: `-0.0` equals `0.0` and every `NaN` bit pattern equals every other, and a partition
-- expression can tell them apart, so rows the comparator merges landed in different partitions.

DROP TABLE IF EXISTS t_final_neg_zero;

INSERT INTO t_final_int VALUES (1, 1);

DROP TABLE t_final_float_nonkey;

DROP TABLE t_final_tuple_int_plan;

-- `basic` statistics hold the column min/max the pruner reads; pin it because `auto_statistics_types` is randomized by clickhouse-test.
CREATE TABLE t_nan_stats (k UInt64, f Float64) ENGINE = MergeTree ORDER BY k SETTINGS auto_statistics_types = 'basic';

DROP TABLE IF EXISTS t_no_nan;

SELECT count() FROM (SELECT 1 FROM (SELECT arrayJoin(['a', 'a\0']) AS x) GROUP BY toFixedString(x, 2)) SETTINGS optimize_injective_functions_in_group_by = 0;

SELECT 'an out-of-range Date32';

CREATE TABLE t_array_join_shadow (dt UInt32, arr Array(DateTime('Europe/Amsterdam'))) ENGINE = Memory;

-- Distinct representations stay injective.
SELECT count() FROM (SELECT 1 FROM (SELECT arrayJoin([false, true]) AS b) GROUP BY toString(b)) SETTINGS bool_true_representation = 'yes', bool_false_representation = 'no';

SELECT 'the same view on both sides, neither aliased';

SELECT 'a comma join, which the restriction covers as well';

SELECT count() FROM t_scale_array_cast_key WHERE arr IN ([toDateTime64(1675252800, 6, 'UTC')], [toDateTime64('2023-02-01 12:00:00.000001', 6, 'UTC')]);

SELECT count(), (SELECT marks < 4 FROM (EXPLAIN ESTIMATE SELECT count() FROM t_signed_zero_mixed_tuple WHERE k = (0, 0.5))) FROM t_signed_zero_mixed_tuple WHERE k = (0, 0.5);

INSERT INTO t_load_outdated_parts VALUES (1);

-- A mutation that deletes the rest brings the table back under the limit.
ALTER TABLE t_max_table_size_rows DELETE WHERE p = 0;

DROP TABLE t_memory_in_place_keys;

ALTER TABLE t_clear_marker_index MATERIALIZE INDEX i SETTINGS mutations_sync = 2;

DROP TABLE t_clear_marker_materialized;

SELECT 'alias subcolumn';

SELECT 'lambda parameter inside a column definition';

-- Lightweight delete also goes through a mutation.
DELETE FROM t_mutation_table_virtual WHERE _database != '' AND key = 4;

SELECT 'p and 1', count() FROM tab WHERE hasPhrase(text, 'ello50 wor') AND 1;

SELECT count() = 2 FROM
(
    SELECT materialize(toUInt64(0)) AS k FROM system.numbers_mt
    UNION DISTINCT
    SELECT materialize(toUInt64(1)) AS k FROM system.numbers_mt
)
SETTINGS max_rows_in_distinct = 2, distinct_overflow_mode = 'break', max_execution_time = 10, max_rows_to_read = 0;

DROP TABLE t_part_virtual;

CREATE TABLE t_pruning_eval_error_repeat (k Int64) ENGINE = MergeTree ORDER BY k SETTINGS index_granularity = 1;

SYSTEM START MERGES t_pending_rename_nested;

CREATE TABLE t_pending_rename_subcolumn (id UInt8, `n.a` Array(UInt8), `n.b` Array(Nullable(UInt8)))
ENGINE = MergeTree ORDER BY tuple() SETTINGS min_bytes_for_wide_part = 0;

CREATE TABLE t_projection_filters_create (a UInt64, b String, PROJECTION p (SELECT b, sum(a), count() GROUP BY b))
ENGINE = MergeTree PARTITION BY b ORDER BY a SETTINGS materialize_projections_on_insert = 1
SETTINGS additional_table_filters = {'system.one' : 'a != 0'};

DROP TABLE qbit_one_bit;

SELECT 'and a repeat of the default session keeps its own verdict', count()
FROM t_qcc_conversion_settings WHERE toFloat64(s) = 1.1e-300 SETTINGS use_query_condition_cache = 1;

ALTER TABLE t_swap_types_statistics DETACH PARTITION tuple();

SELECT replaceRegexpAll(h, '(o|)$', 'Z') FROM (SELECT 'foo' AS h) SETTINGS optimize_rewrite_regexp_functions = 0;

SELECT replaceRegexpAll(h, '\\x41?$', 'Z') FROM (SELECT 'A' AS h) SETTINGS optimize_rewrite_regexp_functions = 0;

SELECT replaceRegexpAll(h, 'o{0,2}$', 'Z') FROM (SELECT 'foo' AS h) SETTINGS optimize_rewrite_regexp_functions = 0;

SELECT '-- 2. Dynamic column, IS NULL on the granule path';

SELECT 'granules 16/16', count() FROM (EXPLAIN indexes = 1 SELECT count() FROM t_var WHERE v IS NULL
    SETTINGS secondary_indices_enable_bulk_filtering = 0) WHERE explain LIKE '%Granules: 16/16%';

DROP TABLE t_json_absent;

SELECT count(), sum(b) FROM (SELECT b FROM t_prewhere_projection PREWHERE a);

-- Compact part: MATERIALIZE INDEX rewrites the part and materializes the hint, so the index prunes
-- through the ordinary path (no override recorded). Kept as a regression check.
SELECT '-- compact part';

SELECT count() FROM t_upd WHERE v = 999999 SETTINGS apply_mutations_on_fly = 1, use_skip_indexes = 0;

INSERT INTO fact_05227 SELECT 2, number % 10 FROM numbers(1000);

SELECT '--- a custom setting the context holds is a query setting too ---';

SELECT count() FROM t_string_filter_row_policy PREWHERE s LIKE '%needle%' SETTINGS log_comment = '05227_row_policy_guard';

SYSTEM SYNC REPLICA t_rep PULL;

WITH ['t_a', 't_c'] AS wanted
SELECT
    'projections',
    (SELECT count() FROM system.projections WHERE database = currentDatabase() AND table IN ('t_a', 't_c'))
        = (SELECT countIf(has(wanted, table)) FROM system.projections WHERE database = currentDatabase());

CREATE TABLE ts_t64 (samples Array(Tuple(DateTime, Float64))) ENGINE = TimeSeries;

SELECT count()
FROM (SELECT toDate32('0000-01-01') + number AS d FROM numbers(1000) UNION ALL SELECT toDate32('9999-12-31') - number FROM numbers(1000))
WHERE toWeek(d, 3) != toISOWeek(d) OR toWeek(d, 3) < 1 OR toWeek(d, 3) > 53;

INSERT INTO t_json_dst SELECT j FROM t_json_src WHERE n % 2 = 0
SETTINGS min_insert_block_size_rows = 0, min_insert_block_size_bytes = 0;

SELECT 'a Dynamic typed subcolumn in additional_table_filters', count() FROM v_05227
SETTINGS additional_table_filters = {'v_05227': 'd.UInt64 < 3'};

-- The same aliasing is reachable from a `DateTime64` key, whose day numbers also leave the `Date` range.

DROP TABLE IF EXISTS t_day_of_week_datetime64;

SELECT count() FROM t_hint_join_left AS l LEFT JOIN t_hint_join_right AS r ON l.id = r.id
WHERE r.id < 150
SETTINGS use_join_disjunctions_push_down = 1;

-- A lambda parameter named like a non-deterministic virtual column does not read it.
ALTER TABLE t_repl_05228 DELETE WHERE arrayExists(_table -> _table = 0, [key]) SETTINGS mutations_sync = 2;

SELECT key, value FROM t_repl_05228_alias ORDER BY key;

CREATE TABLE m_05228 (key UInt64, e String EPHEMERAL _database, d String DEFAULT 'x')
    ENGINE = ReplicatedMergeTree('/clickhouse/tables/{database}/test_05228/m', 'r1') ORDER BY key;

SELECT key, value, toTypeName(value) FROM cc_05228 ORDER BY key;

SELECT '-- tables enumerated';

DROP TABLE test_transformer_alias;

SELECT number, uniqExact(r) FROM (SELECT number, arrayJoin([1, 2, 3]) AS e, arrayMap(i -> rand64(i), [number])[1] AS r FROM numbers(2)) GROUP BY number ORDER BY number SETTINGS legacy_array_join_function_nondeterministic_evaluation = 1;

SELECT (from IS NULL) FROM (SELECT 1 AS `from`);

-- A partition expression is arbitrary user SQL, so it can name a different partition every time it is
-- evaluated. The partitions of a scoped command are therefore resolved exactly once, when the mutation
-- entry is created, and both the on-the-fly read path and the background materialization read that one
-- resolved set: the rows a pending read reports as deleted are the rows the mutation really deletes.

DROP TABLE IF EXISTS t_delete_in_partition_dynamic;

SELECT '64 distinct needles', countIf(hasAll(lc, arrayMap(j -> concat('d', toString(j)), range(64)))), countIf(hasAll(plain, arrayMap(j -> concat('d', toString(j)), range(64)))),
    sum(cityHash64(id, hasAll(lc, arrayMap(j -> concat('d', toString(j)), range(64))))) = sum(cityHash64(id, hasAll(plain, arrayMap(j -> concat('d', toString(j)), range(64)))))
FROM (SELECT number AS id, CAST(arr AS Array(LowCardinality(String))) AS lc, arr AS plain FROM (SELECT number, arrayMap(j -> concat('d', toString(j)), range(64 - number % 2)) AS arr FROM numbers(10)));

INSERT INTO nested_tags SELECT number, arr, arr FROM (SELECT number, [arrayMap(j -> concat('g', toString((number + j) % 4)), range(2))] AS arr FROM numbers(40));

SELECT 'UUID matching needle', countIf(hasAll(uuid_lc, [toUUID('00000000-0000-0000-0000-000000000003')])), countIf(hasAll(uuid_plain, [toUUID('00000000-0000-0000-0000-000000000003')])),
    sum(cityHash64(id, hasAll(uuid_lc, [toUUID('00000000-0000-0000-0000-000000000003')]))) = sum(cityHash64(id, hasAll(uuid_plain, [toUUID('00000000-0000-0000-0000-000000000003')]))) FROM typed;

INSERT INTO indexed_text SELECT number, arr, arr FROM (SELECT number, arrayMap(j -> concat('b', toString((number + j) % 12)), range(1 + number % 3)) AS arr FROM numbers(200));

-- The subquery form of `contains_any` and `contains_all` matches word boundaries,
-- exactly like the literal form.
_msg:contains_any(foo) | fields _msg | sort by (_msg);

SELECT 'T1 old part, b', count() FROM t_minmax_order_prune WHERE b = 100
SETTINGS use_partition_pruning = 1, use_skip_indexes = 1, optimize_use_projections = 0, optimize_use_implicit_projections = 0;

INSERT INTO t_minmax_order_merge (a, b) VALUES (1000, 150);

DROP TABLE t_minmax_order_unsorted;

-- `ESC` is never replaced either, so that the ANSI escape sequences carried by the data keep being
-- interpreted by the terminal. They take no visible position, so the table outline is preserved.
SELECT '\x1b[31mred\x1b[0m' AS value FORMAT PrettyCompact;

-- Merge, so that the two parts that hold the rows stay on disk under the merged `1_1_2_1`.
OPTIMIZE TABLE t_replace_cover_all_outdated_dst PARTITION 1 FINAL;

SELECT count() FROM (SELECT m.k FROM t_left AS m LEFT JOIN (SELECT k, argMax(sev, v) AS sev FROM t_right WHERE throwIf(v >= 0, 'right side executed') GROUP BY k) AS p ON m.k = p.k WHERE (ifNull(p.sev, m.sev) = 'Low') AND (ifNull(p.sev, m.sev) = 'Medium') SETTINGS optimize_redundant_comparisons = 0, optimize_and_compare_chain = 0);

-- The second pass exists only if the plan really is the lazy one; otherwise everything below
-- would be an ordinary read and would prove nothing about `LazyReadFromMergeTreeSource`.
SELECT 'lazy plan', countIf(explain LIKE '%LazilyReadFromMergeTree%') > 0
FROM (EXPLAIN PLAN SELECT a, payload FROM t_cc_lazy ORDER BY b, a LIMIT 5);

SELECT sum(intDiv(x, 2)) FROM (SELECT if(number = 0, NULL, number)::Nullable(UInt64) AS x FROM numbers(1000))
SETTINGS log_comment = 'declining_with_nulls';

INSERT INTO t_05230_union VALUES (4, 0);

-- A widening flip, where the width comparison cannot help: the same INT32 file read as UInt64. The kept
-- signed max 5 is not an upper bound in 64-bit unsigned order either.
select count() from file(currentDatabase() || '_05230_i32.parquet', Parquet, 'x UInt64')
    where x = 18446744073709551615;

insert into function file(currentDatabase() || '_05230_d32lo.parquet', Parquet, 'x Date32')
    select arrayJoin([toDate32('0000-01-01') - 1, toDate32('0000-01-01')]) as x;

-- The page index leg alone prunes an integer and a `DATE` file, so the page-only arms above do reach it.
select count() from file(currentDatabase() || '_05230_c_i32.parquet', Parquet, 'x Int32') where x > 3500
    settings log_comment = '05230page_i32', input_format_parquet_filter_push_down = 0,
             input_format_parquet_dictionary_filter_push_down = 0, input_format_parquet_bloom_filter_push_down = 0;

INSERT INTO t_shuffle_states SELECT number % 5000, toString(number % 7), if(number % 11 = 0, NULL, number % 13), number FROM numbers(100000);

-- no-fasttest: the dispatched arm needs the stateless worker configuration (tests/config/config.d/distributed_query.xml).

-- A task of a distributed query plan is a query of its own, so system.query_log must report the
-- task's own metrics in a row of its own, correlated to the initiator by initial_query_id. The
-- values recorded below hold for both ways of running the tasks, on workers and in-process: the
-- initiator's row reports none of the parts its tasks read, and each task row reports the parts the
-- coordinator assigned it, all of which it either scanned or pruned.

-- The stress profile sets `ast_fuzzer_runs = 5`; a fuzzed re-run inherits `log_comment` and would
-- win the lookup against `system.query_log` below.
SET ast_fuzzer_runs = 0;

DROP TABLE IF EXISTS data_variant;

CREATE TABLE data_dynamic (dk Dynamic) ENGINE = MergeTree ORDER BY tuple();

SELECT 'dynamic key, LIKE, declined', countIf(explain ILIKE '%function_name: dictGet,%') > 0 FROM (EXPLAIN QUERY TREE SELECT count() FROM data_dynamic WHERE dictGet('dict_keys_012', 'a', dk) LIKE 'x' SETTINGS optimize_inverse_dictionary_lookup = 1, optimize_or_like_chain = 0, optimize_rewrite_like_perfect_affix = 0);

SELECT 'increase';

WITH toDateTime64(1000.5, 3, 'UTC') AS grid_start, toDateTime64(1010.5, 3, 'UTC') AS grid_end, toDecimal64(2.5, 3) AS grid_step, toDecimal64(3.5, 3) AS grid_window
SELECT
    timeSeriesLastToGrid(grid_start, grid_end, grid_step, grid_window)(ts_dt64_3, value) AS expected,
    timeSeriesLastToGrid(grid_start, grid_end, grid_step, grid_window)(ts_dt64_6, value) = expected,
    timeSeriesLastToGrid(1000.5, 1010.5, 2.5, 3.5)(ts_dt64_6, value) = expected,
    timeSeriesTimestampOfMaxToGrid(grid_start, grid_end, grid_step, grid_window)(ts_dt64_6, value) AS ts_of_max_dt64_6
FROM ts_scales;

CREATE TABLE t_map_state_version (m Map(String, AggregateFunction(medianDeterministic, UInt64, UInt64))) ENGINE = MergeTree ORDER BY tuple();

SELECT k, dictGetOrDefault('d_05232', 'b', k, if(k = 1, 'abc', '7')) FROM keys_05232 ORDER BY k
    SETTINGS short_circuit_function_evaluation = 'force_enable';

SELECT count(), sum(c) FROM t_exclusion_search_unknown_atoms
WHERE b BETWEEN 2000 AND 7000 AND c % 7 = 1
SETTINGS merge_tree_generic_exclusion_search_max_steps = 0, log_comment = '05232_unknown_atoms and_unknown unlimited';

CREATE TABLE ts_dt (samples Array(Tuple(DateTime('UTC'), Float64))) ENGINE = TimeSeries;

SELECT sum(length(samples)) FROM timeSeriesSelector(ts_dt, 'up', -5000000000, 5000000000, 'samples');

-- With `aggregate_function_input_format` = 'value' or 'array', every input format reads an `AggregateFunction(f, T)` column
-- as `T` (a `Tuple` of the argument types if there are several of them), or as an `Array` of them,
-- in the representation the format uses for that type. The states are built from the values afterwards.

SET aggregate_function_input_format = 'value';

INSERT INTO t_05233 SETTINGS async_insert = 0 FORMAT JSONEachRow {"k":1} {"k":2,"x":5};

CREATE TABLE al_1 ENGINE = Alias(currentDatabase(), 'j');

SELECT part_type, arraySort(groupArray(column)) FROM system.parts_columns
WHERE database = currentDatabase() AND table = 't_compact' AND active GROUP BY part_type;

SELECT '(c0 IS NOT NULL) < true', (SELECT count() FROM t_flat WHERE (c0 IS NOT NULL) < true), (SELECT count() FROM t_part WHERE (c0 IS NOT NULL) < true);

SELECT trimLeft(explain) FROM (
    EXPLAIN indexes = 1 SELECT c0 FROM t_nonull WHERE isZeroOrNull(c0) >= true
    SETTINGS optimize_use_implicit_projections = 0, optimize_use_projections = 0
) WHERE explain LIKE '%Parts%' OR explain LIKE '%Min-Max%' OR explain LIKE '%Partition%';

SELECT count(), sum(s) FROM (SELECT k, sum(v) AS s FROM t_shuffle_merge_unordered GROUP BY k)
SETTINGS log_processors_profiles = 1, log_comment = '05233_shuffle_merge';

CREATE TABLE t_correlated_window (id UInt32, v Int64) ENGINE = MergeTree ORDER BY id;

SELECT x, dictGetOrDefault('d_05233', 'b', CAST(NULL, 'Nullable(UInt64)'), if(x = 1, NULL, '7'))
FROM keys_05233 ORDER BY x;

DROP ROW POLICY kv_rls_public ON kv_rls;

-- Every arm of a UNION is analyzed.
SELECT
    countIf(explain ILIKE '%Function eval%') AS table_function_kept,
    countIf(explain ILIKE '%Asterisk%') AS asterisk_left
FROM (EXPLAIN AST optimize = 1 SELECT * FROM eval('SELECT 5 AS x') UNION ALL SELECT 6 AS x);

SELECT 'WHERE on another column';

DROP TABLE IF EXISTS incr_count_src;

SELECT 'prewarmed', value FROM system.metrics WHERE metric = 'IndexMarkCacheFiles' ORDER BY value;

INSERT INTO kr_05233 VALUES (1, 2), (2, 3);

SELECT 'Enum8 over ie_join', count()
FROM kie_l_05233 AS l LEFT JOIN kie_r_05233 AS r ON l.x > r.x AND l.y < r.y
WHERE toInt8(r.e) = 0
SETTINGS join_algorithm = 'ie_join';

SELECT 'duplicate key, all elements present';

SELECT JSONExtract(materialize('[1,2]'), 'Tuple(a UInt8, b UInt8)') FROM numbers(3);

DROP TABLE t_unconvertible_monotonic;

SELECT count() FROM t_local;

SELECT arrayMap(x -> x.2, samples)
FROM prometheusQueryRange(ts, 'min_of(time() - 100, 2)', 100, 104, 1);

SELECT '-- Scalar and string results';

INSERT INTO t_string_filter_fixed_string
SELECT number, if(number % 3 = 0, 'hello', 'nothing interesting ' || toString(number)) FROM numbers(10000);

-- Both posting lists have rows in every mark: no early exit.
SELECT 'all aall codd', count(), sum(id) FROM tab_bf_early_exit WHERE hasAllTokens(s, ['aall', 'codd'])
    SETTINGS log_comment = '05233_bf_aall_codd';

DROP TABLE d_src;

SELECT arrayEnumerateUniq(CAST(['alpha', 'beta', 'alpha', 'gamma', 'beta'] AS Array(FixedString(32))));

CREATE TABLE dist_05234 AS data_05234
    ENGINE = Distributed(test_cluster_two_shards, currentDatabase(), data_05234, key % 2);

SELECT k, v FROM t_autopr_stats_key_sampled ORDER BY k FORMAT Null
    SETTINGS log_comment='05234_query_04_unsampled_again';

-- A SETTINGS clause written inside the subquery must not re-enable parallel replicas either: the cluster
-- named below exists in no configuration, so the statement only survives while the setting stays off.
CREATE TABLE t_scalar_constraint_inner (x UInt64, CONSTRAINT c CHECK x < (SELECT max(id) + 1000 FROM t_scalar_constraint_source SETTINGS allow_experimental_parallel_reading_from_replicas = 1, max_parallel_replicas = 2, parallel_replicas_for_non_replicated_merge_tree = 1, cluster_for_parallel_replicas = 'no_such_cluster')) ENGINE = MergeTree ORDER BY tuple();

SELECT grp, sumForEachIf(arr, if(grp = 2, NULL, cond)) FROM test_foreach_if GROUP BY grp ORDER BY grp;

-- A lightweight UPDATE that fails while its pipeline runs must release the lightweight update lock.
-- The follow-up updates use lock_acquire_timeout = 0, so they fail at once if the lock is still held.

DROP TABLE IF EXISTS t_lwu_lock_release;

INSERT INTO t_map_nan_key VALUES (1, map((nan, 1), 'nan-hit', (1.5, 1), 'one-five')), (2, map((2.5, 1), 'other')), (3, map((1.5, 1), 'plain'));

DROP TABLE t_pr_in_set_memory;

CREATE TABLE ts_dt (samples Array(Tuple(DateTime('UTC'), Float32))) ENGINE = TimeSeries;

DESCRIBE prometheusQueryRange(ts_u32, 'up', 1000, toDateTime(1030, 'Asia/Tokyo'), 15);

SELECT '--- results are unchanged ---';

SELECT '--- the pre-filter is applied while dataflow statistics are collected ---';

SELECT '-- without a policy';

INSERT INTO t_sub_right SELECT number FROM numbers(100);

-- The check below counts reads of local files; on object storage the posting list is not read through a file
-- descriptor at all.

-- Posting lists are read through streams whose buffer is sized to the segments they read. This test pins the
-- effect: a lazy read of a posting list of a few hundred KiB takes a handful of read syscalls instead of one per
-- 16 KiB.

SET enable_full_text_index = 1;

-- The same inside a branch of another short-circuit function, where `coalesce` itself is evaluated lazily.

SELECT number, if(number > 0, coalesce(if(number = 1, toNullable(10), NULL), intDiv(100, number - 1)), 0) FROM numbers(3) ORDER BY number;

SELECT '-- the samples fall into the last bucket of that grid: no overflow while calculating the bucket index';

SELECT extract(create_table_query, 'processing_threads_num = (\\d+)')
FROM system.tables WHERE database = currentDatabase() AND name = 't_s3queue_default_reset';

-- case 4: WITH alias takes priority over a real left column (old-analyzer-compatible).
WITH x + 10 AS id SELECT sum(x) FROM (SELECT 1 AS x, 2 AS id) t1 JOIN (SELECT 2 AS id) t2 USING (id);

ALTER TABLE t_qcc_patch_where UPDATE v = 0 WHERE id >= 50 SETTINGS alter_update_mode = 'lightweight_force', enable_lightweight_update = 1, mutations_sync = 1;

SELECT 'plain before', count() FROM plain;

SELECT avg(toIntervalMinute(number)) AS a, toTypeName(a) FROM numbers(5);

SELECT '-- GROUP BY';

SELECT count(), uniqExact(dynamicType(d)), countIf(NOT isDynamicElementInSharedData(d)),
       countIf(match(dynamicType(d), '^(String|Int64|Float64|Bool|DateTime|Date|UInt64|Array\\(Nullable\\((String|Int64|Float64|Bool|DateTime|Date|UInt64)\\)\\))$'))
FROM (SELECT * FROM generateRandom('d Dynamic(max_types=0)', 1, SETTINGS null_ratio = 0) LIMIT 100);

-- take the output ratio out of the decision
SET collect_hash_table_stats_during_joins = 0;

DROP TABLE asof_probe;

SELECT count() FROM t1 WHERE dictGet(concat(currentDatabase(), '.dict_uuid'), 'c2', tuple(c1)) = 'a';

DROP TABLE signed_src;

DROP TABLE t_skip_regexp;

SELECT '-- aggregate arguments using the correlated column';

SELECT count() FROM (SELECT variantElement(seed, 'UInt8') AS v FROM merge('t_05237_seeds_.*')) WHERE v >= 2;

DROP TABLE t_05237_partial_a;

-- Tag no-parallel-replicas: the initiator sends the argument of `timeSeriesMetricFamilies` to the replicas unqualified,
-- so they look the table up in the `default` database, see https://github.com/ClickHouse/ClickHouse/issues/118130.

-- Tables of versions before 6 name the column of the "metric families" target table with the name of a metric family
-- `metric_family_name` (see TimeSeriesVersion.h) and stay readable and writable. The generation of the column and
-- the checks of its name are covered by the unit test gtest_normalize_time_series_definition.cpp.

SET allow_experimental_time_series_table = 1;

INSERT INTO ts_first_agg SELECT toUnixTimestamp64Milli(timestamp) % 3,
    initializeAggregation('timeSeriesFirstToGridState(90, 210, 15, 45)', timestamp, value),
    initializeAggregation('timeSeriesTimestampOfFirstToGridState(90, 210, 15, 45)', timestamp, value)
FROM ts_first_data;

SELECT 'before alter', count() FROM t_sparse_alter WHERE v = 0;

-- Compatibility setting `analyzer_compatibility_allow_cte_redefinition`: a CTE name may be defined more than once
-- in one WITH clause, a later definition shadowing the earlier ones as the query analysis before v24.3 did.
-- Expected values come from that analysis (26.8 with enable_analyzer = 0), except where noted.

DROP TABLE IF EXISTS t_cte_redefinition;

SELECT '-- 12 view';

CREATE TABLE t_05238_c (a UInt64) ENGINE = MergeTree ORDER BY a;

SELECT '-- query_log reports INNER for a real inner join, CD-C';

SELECT '-- the key set does not depend on the number of streams';

SELECT '-- every generated type is one the JSON parser would infer';

DROP TABLE IF EXISTS in_subquery_child;

DROP TABLE in_subquery_constraint_bare;

SELECT groupArray(id) FROM float_probes WHERE dictGet('dict_float', 'attr', f) LIKE 'n%';

INSERT INTO t_pr_join_fact SELECT number FROM numbers(20);

SELECT countIf(explain ILIKE '%ParallelReplicas%') > 0
   AND countIf(explain ILIKE '%JoinLogical%') > 0 FROM (
    EXPLAIN SELECT count(), sum(l.price), sum(r.item_id) FROM t_algo_left AS l LEFT JOIN t_algo_right AS r ON l.item_id = r.item_id)
SETTINGS join_algorithm = 'hash', parallel_replicas_prefer_local_join = 1;

SYSTEM STOP MERGES t_scattered;

SELECT trimBoth(explain) FROM
(
    EXPLAIN indexes = 1 SELECT a, b FROM t_scattered_composite FINAL WHERE v = 1
)
WHERE explain ILIKE '%Granules:%'
ORDER BY rowNumberInAllBlocks() DESC
LIMIT 1;

SELECT sumResample(0, 2, 1)(toIntervalDay(number), number % 2) AS s, toTypeName(s) FROM numbers(10);

-- A union of patterns must retain the smaller seek target. Mixing in an infix
-- pattern uses the literal scan; neither case may lose rows.
SELECT arraySort(groupArray(id)) FROM text_automaton WHERE body LIKE 'servicea%error' OR body LIKE 'serviceb%error';

SELECT '-- inserting the generated documents into a table, with the structure taken from it';

CREATE TABLE t_05239 (x UInt8) ENGINE = MergeTree ORDER BY x;

INSERT INTO invoices VALUES (1, 1, 100, 'a'), (2, 1, 200, NULL), (3, 2, 50, 'b'), (4, 2, 70, 'c'), (5, 2, 80, 'a');

SELECT countIf(explain ILIKE '%ParallelReplicas%') FROM (
    EXPLAIN SELECT t1.c, a FROM t1 ARRAY JOIN [1, 2] AS a ANY INNER JOIN t3 ON 1 ORDER BY ALL);

SELECT replaceRegexpAll(h, 'a\\Q\\E{0,1}$', 'Z') FROM (SELECT 'a' AS h);

DROP TABLE IF EXISTS k_cast;

DROP TABLE IF EXISTS oracle_map_nul;

DROP TABLE IF EXISTS k_nul_prune;

INSERT INTO k_order_g1 SELECT toDateTime(1675195200, 'UTC');

-- Carrier 11: `has` reaches the same helper through a different route, taking the element type from the
-- array's nested type rather than from a subquery result. Disabling `optimize_rewrite_has_to_in` is
-- load-bearing: at its default the pass turns this predicate into a literal `IN`, which never reaches the
-- helper at all (measured: with the rewrite on, this reads 1 before the fix, i.e. it becomes
-- `control_literal_in`).
SET optimize_rewrite_has_to_in = 0;

SELECT 'partition_by_nullable_key', count() FROM k_nul_key_part WHERE ts = toDateTime(1675195200);

CREATE TABLE oracle_arr_dt64 (a Array(DateTime64(3, 'UTC'))) ENGINE = Memory;

INSERT INTO k_arr_tup SELECT [(toDateTime(1675195200, 'UTC'), 1)];

SELECT 'key_bool_direct_cast_in', count() FROM (SELECT b FROM k_bool_cast WHERE b IN (SELECT 1::UInt8));

INSERT INTO k_map_keytype SELECT map(toDateTime(1675195200, 'UTC'), 1);

INSERT INTO oracle_saf_outer_bool SELECT [false];

SELECT 'control_negation_not_in', arraySort(groupArray(toUnixTimestamp(ts))) FROM (SELECT ts FROM k_negation WHERE ts NOT IN (SELECT toDateTime(1675195200)));

SELECT 'oracle_variant', count() FROM oracle_variant WHERE v = CAST(toDateTime(1675195200, 'Asia/Kolkata') AS Variant(DateTime('Asia/Kolkata'), String));

DROP TABLE k_samename;

DROP TABLE k_tup;

DROP TABLE oracle_variant_amb;

SELECT countIf(explain ILIKE '%ParallelReplicas%') FROM (
    EXPLAIN SELECT count(), sum(r.key), sum(l.key) FROM v_left AS l RIGHT JOIN t_right AS r ON l.key = r.key);

SELECT count() FROM t_map_keys WHERE m['k'] = '';

SELECT groupBitmapMerge(s) FROM (SELECT groupBitmapState(number::UInt32) AS s FROM numbers(1000));

SELECT s, p, count(), sum(v) FROM lc_serialized_group_by GROUP BY s, p ORDER BY s, p NULLS FIRST;

CREATE MATERIALIZED VIEW mv_join_final TO dst AS
    SELECT 'join_final' AS name, s.k AS k, t.c AS c FROM src AS s CROSS JOIN (SELECT count() AS c FROM src FINAL) AS t;

select count() from file(currentDatabase() || '_05241_i8.parquet', Parquet, 'x UInt8') where x = 255
    settings input_format_parquet_filter_push_down = 0, input_format_parquet_page_filter_push_down = 0;

-- value_preserving with the requested type equal to the decoded one, at the declared width and at the
-- physical width.
select count() from file(currentDatabase() || '_05241_c_u8.parquet', Parquet, 'x UInt8') where x = 200
    settings log_comment = 'hfilter_d_01_u8_u8', input_format_parquet_filter_push_down = 0,
             input_format_parquet_page_filter_push_down = 0, input_format_parquet_bloom_filter_push_down = 0,
             input_format_parquet_dictionary_filter_push_down = 1048576;

select count() from file(currentDatabase() || '_05241_c_u32.parquet', Parquet, 'x Nullable(UInt32)')
    where x = 3500
    settings log_comment = 'hfilter_b_12_u32_nu32', input_format_parquet_filter_push_down = 0,
             input_format_parquet_page_filter_push_down = 0, input_format_parquet_bloom_filter_push_down = 1,
             input_format_parquet_dictionary_filter_push_down = 0;

SELECT tags, arrayMap(x -> (toUnixTimestamp64Milli(x.1), x.2), samples) FROM prometheusQueryRange(ts, 'timestamp(m)', 100, 200, 50);

DROP TABLE IF EXISTS t_rp_nan_key;

CREATE ROW POLICY pol_rp_tuple_key ON t_rp_tuple_key USING toString(t) = '(0,1)' TO ALL;

SELECT timeSeriesMadToGridIf(100, 140, 10, 50)(timestamp, value, value != 3) FROM mad_input;

WITH [100, 110, 120]::Array(DateTime) AS timestamps, [nan, 1, 2]::Array(Float64) AS values
SELECT timeSeriesMadToGrid(100, 130, 10, 20)(timestamps, values);

CREATE TABLE quantize_read_task_compact
(
    id UInt32,
    vec Array(Float32) CODEC(Quantized('int8', 64))
)
ENGINE = MergeTree ORDER BY id
SETTINGS min_bytes_for_wide_part = '10G', min_rows_for_wide_part = 1000000000, write_marks_for_substreams_in_compact_parts = 1;

SELECT number, accurateCastOrNull(toUInt128(number) * 100000000000, 'DateTime64(3, \'UTC\')'), accurateCastOrNull(toInt256(number) * 1000000 - 2000000, 'Time64(3)') FROM numbers(5) SETTINGS date_time_overflow_behavior = 'ignore';

CREATE TABLE outer_t (id UInt32, k UInt32) ENGINE = MergeTree ORDER BY id;

SELECT arraySort(groupArray(id)) FROM tab WHERE hasToken(toNullable(s), 'Foo') SETTINGS query_plan_direct_read_from_text_index = 1;

SET max_block_size = 6, max_threads = 1;

-- Same scale, wider scale and an exactly representable narrower scale are fine.
SELECT accurateCast(toDateTime64('1970-01-01 12:34:56.789', 3, 'UTC'), 'Time64(3)');

SELECT count() FROM t_enum_key WHERE e != 'c';

SELECT count() FROM t_enum_null WHERE e != 'c';

SELECT f64, count() FROM t_top_k_nan GROUP BY f64 ORDER BY f64 DESC LIMIT 2;

-- `FINAL`: only the latest version of every hot row, and no runtime filter granule pruning.
SELECT 'final', count(), sum(f.v)
FROM rf_final_fact AS f FINAL INNER JOIN rf_final_dim AS d ON f.id = d.id
WHERE d.tag = 'hot'
SETTINGS log_comment = '05243_final';

SELECT count(), (SELECT count() FROM t_signed_zero_in WHERE f IN (-0.0) SETTINGS use_primary_key = 0) FROM t_signed_zero_in WHERE f IN (-0.0);

-- `LATERAL` is only treated as the `JOIN LATERAL` keyword when a parenthesized subquery follows it,
-- so a table named `lateral` on the right side of a join still parses, regardless of the setting.

DROP TABLE IF EXISTS t_lateral_left;

CREATE MATERIALIZED VIEW mv_populate ENGINE = Memory POPULATE AS SELECT src.a AS a FROM src JOIN t2 ON src.a = t2.a
SETTINGS log_comment = '05243_join_views_mv_populate', join_algorithm = 'hash';

SELECT '-- Concurrent build: parallel_hash switches to MergeJoin from multiple threads';

SELECT count() = 0 FROM system.parts_columns WHERE database = currentDatabase()
    AND table = 't_sibling_marker_materialized' AND active AND column = 'c';

INSERT INTO ts (metric_family, type, unit, help) VALUES ('f1', 'gauge', '', 'A');

INSERT INTO ts (metric_family, type, unit, help) VALUES ('x', 'gauge', '', 'A');

-- Every metric family goes to its own partition, so `max_partitions_per_insert_block = 1` fails an insert of two metric families.
CREATE TABLE ts_fail ENGINE = TimeSeries METRIC FAMILIES INNER ENGINE = MergeTree PARTITION BY metric_family ORDER BY metric_family;

SELECT
    toTypeName(toStartOfInterval(toDateTime64('2023-01-15 14:30:00', 3, 'UTC'), INTERVAL 1 HOUR)),
    toTypeName(toStartOfInterval(toDate32('2023-01-15'), INTERVAL 1 MONTH))
FORMAT TSV;

ALTER TABLE t_rename (RENAME COLUMN al TO al2), (MODIFY SETTING fsync_part_directory = 1);

-- 50000 equal-key left rows x 1000 sorted right blocks: a per-row match index would allocate
-- 50M entries (~600 MB) before any output and trip the memory limit; the shared lists need
-- 1000 ranges. LIMIT 1 also pins that no full-output materialization happens before emission.
DROP TABLE IF EXISTS l_repeated;

SELECT groupArray(A) FROM (SELECT A FROM t_top_k_reverse_key ORDER BY A DESC LIMIT 10);

-- Concurrent probe streams racing for the claims: the counts must stay exact.
SELECT count(), uniqExact(t) FROM (
    SELECT any_inner_l.t AS t FROM any_inner_l ANY INNER JOIN any_inner_r ON any_inner_l.id = any_inner_r.id
    ORDER BY any_inner_l.t
    SETTINGS join_algorithm = 'parallel_hash', hash_join_layout = 'parallel', max_threads = 8,
             max_bytes_before_external_join = 250000, max_bytes_ratio_before_external_join = 0,
             enable_analyzer = 1, enable_parallel_replicas = 0, optimize_read_in_order = 1,
             query_plan_read_in_order_through_join = 1, read_in_order_use_virtual_row = 1, query_plan_join_swap_table = 0
);

CREATE TABLE fj_guard_left_any (j UInt32, v String) ENGINE = Join(ANY, LEFT, j);

CREATE TABLE er_events (t UInt32, id UInt32) ENGINE = MergeTree ORDER BY t;

SELECT count(), countIf(v > 0), countIf(payload != ''), countIf(v > 0 AND payload != '') FROM (
    SELECT fa_left.v AS v, fa_right.payload AS payload FROM fa_left
    FULL JOIN fa_right ON fa_left.k = fa_right.k AND fa_right.flag = 1
)
SETTINGS join_algorithm = 'hash', max_bytes_before_external_join = 1000000,
         log_comment = '05245_full_all_filtered_hash';

DROP TABLE IF EXISTS tn_payloads;

-- P1: the reported query. One Nullable single-table conjunct is pushed down, two joint conjuncts
-- remain, so an `and` survives with fewer arguments than it was typed for.
SELECT 'P1 dist', count(), sum(l.number), sum(r.number)
FROM t_and_type_l AS l CROSS JOIN t_and_type_r AS r
WHERE l.n > 0 AND l.number + r.number > 1 AND l.number + r.number < 9;

-- P12: the declared type needs both parts again, but one surviving conjunct already reports `Bool`
-- on its own, so only the Nullable part is missing. `j.m > 3` must still reach PREWHERE once the
-- join becomes an inner one. Same pair of counters as P10.
SELECT 'P12 counters',
       countIf(explain ILIKE '%Prewhere filter column:%m > 3%'),
       countIf(explain ILIKE '%Filter column:%m > 3%' AND explain NOT ILIKE '%Prewhere%')
FROM (
    EXPLAIN actions = 1
    SELECT c, count() FROM t_and_type_l AS l LEFT JOIN t_and_type_j AS j ON l.number = j.number
    WHERE (l.n > 0 AND toBool(j.m > 3) AND l.number + j.m < 15) AS c
    GROUP BY c
    SETTINGS make_distributed_plan = 0, query_plan_filter_push_down = 1,
             query_plan_convert_outer_join_to_inner_join = 1,
             query_plan_merge_filter_into_join_condition = 0,
             query_plan_propagate_predicate_across_join = 0,
             enable_join_runtime_filters = 0, query_plan_merge_filters = 1);

SELECT 'N10 plain', c, toTypeName(c), count()
FROM t_and_type_l AS l CROSS JOIN t_and_type_r AS r
WHERE (toLowCardinality(l.number > 0) AND l.number + r.number > 1 AND l.number + r.number < 9) AS c
GROUP BY c ORDER BY c
SETTINGS make_distributed_plan = 0, query_plan_filter_push_down = 0;

DETACH DICTIONARY dict_setting_name;

CREATE TABLE t1 (c0 String, c1 Nullable(Float64)) ENGINE = MergeTree ORDER BY c0;

SELECT ProfileEvents['RuntimeFilterRowsChecked'] + ProfileEvents['RuntimeFilterRowsSkipped'] >= 2000
FROM system.query_log
WHERE current_database = currentDatabase() AND log_comment = '05255_rf_probe' AND type = 'QueryFinish'
ORDER BY event_time_microseconds DESC LIMIT 1;

SELECT toTypeName(nullInIgnoreSet(if(number = 0, NULL, number), (1))) AS t,
       nullInIgnoreSet(if(number = 0, NULL, number), (1)) AS v, count()
FROM numbers(4) GROUP BY t, v ORDER BY t, v
SETTINGS collect_hash_table_stats_during_aggregation = 1;

WITH shapes AS
(
    SELECT log_comment, argMax(ProfileEvents['CompiledFunctionExecute'] > 0, event_time_microseconds) AS compiled
    FROM system.query_log
    WHERE current_database = currentDatabase() AND type = 'QueryFinish' AND log_comment LIKE '05255_%'
    GROUP BY log_comment
)
-- The control keeps the first four columns honest in a build without the embedded compiler, where
-- every shape is interpreted and an absolute assertion would go green on nothing being compiled.
SELECT
    (SELECT compiled FROM shapes WHERE log_comment = '05255_int')
        = (SELECT compiled FROM shapes WHERE log_comment = '05255_control'),
    (SELECT compiled FROM shapes WHERE log_comment = '05255_limbs')
        = (SELECT compiled FROM shapes WHERE log_comment = '05255_control'),
    (SELECT compiled FROM shapes WHERE log_comment = '05255_float')
        = (SELECT compiled FROM shapes WHERE log_comment = '05255_control'),
    (SELECT compiled FROM shapes WHERE log_comment = '05255_cast')
        = (SELECT compiled FROM shapes WHERE log_comment = '05255_control'),
    (SELECT compiled FROM shapes WHERE log_comment = '05255_alone') = 0;

-- A scalar nested into another scalar, as a common table expression builds it.
ALTER TABLE t_upd_idx UPDATE v = (WITH s AS (SELECT 7 AS id) SELECT (SELECT max(id) FROM t_upd_src SETTINGS enable_global_with_statement = 0)) WHERE id = 2 SETTINGS mutations_sync = 2;

DROP TABLE IF EXISTS t_stored;

ALTER TABLE t_stored MATERIALIZE STATISTICS w;

DROP ROW POLICY payroll_policy ON payroll;

-- Tag no-fasttest: PromQL needs ANTLR4, which is disabled in the fast-test build.
-- Tag no-parallel-replicas: every parallel replica reads all rows of the table behind `timeSeriesTimeRanges`, so each row
-- is returned once per replica until https://github.com/ClickHouse/ClickHouse/pull/119350 is merged.
--
-- The selector filters time series by the time ranges stored in the "time ranges" table (the write path and which tables
-- the selector reads are checked in 05255_timeseries_time_ranges_table.sql). A stored time range can't be changed through
-- the TimeSeries table, so a time series is written directly into the inner tables with a time range which doesn't intersect
-- its samples: the selectors trust the stored time range and hide the time series, which is the only way to see the filtering.

SET allow_experimental_time_series_table = 1;

SELECT sum(length(samples)) FROM timeSeriesSelector(ts_no_ranges, 'm', 0, 2500, 'samples') SETTINGS log_comment = 'ts_no_ranges_m';

INSERT INTO test_05256_wide VALUES
    (0, 1, 'a', 0), (1, 1, 'b', 0), (2, 1, 'c', 0), (3, 2, 'a', 0),
    (4, 2, 'd', 0), (5, 1, 'd', 0), (6, 1, 'e', 0), (7, 1, 'f', 0);

SELECT * FROM format(JSONEachRow, 'a Float64', '{"a": 1}\n{"a": null}');

DROP TABLE t_upd_plain;

SELECT count() FROM system.unicode WHERE notation IN ('U+0041', 'U+1F602', 'U+100000');

SELECT toStartOfInterval(toDateTime('2023-05-17 12:34:56', 'Asia/Tokyo'), INTERVAL 15 MINUTE) AS x, toTypeName(x);

SELECT toStartOfInterval(toDateTime64('1900-01-02 03:04:05.678', 3, 'Asia/Kolkata') + toIntervalDay(number * 10000), INTERVAL 1 MINUTE) FROM numbers(4);

SELECT toStartOfInterval(toDateTime64('2023-10-09 10:11:12.987654321', 9), toIntervalMicrosecond(1), toDateTime64('2023-10-09 10:11:12.123456789', 9)) AS x, toTypeName(x);

CREATE TABLE t_times (ts DateTime('UTC'), v UInt32) ENGINE = MergeTree ORDER BY (ts, v);

DROP TABLE t_period_1;

SELECT 'the strictness the plan ends up with';

DROP TABLE t_cascades_shard_group_by_limit;

SELECT id FROM t_enum_arr_bf WHERE has(arr, toFixedString('a', 2)) ORDER BY id SETTINGS use_skip_indexes = 0;

DROP TABLE IF EXISTS oracle_named;

DROP TABLE oracle_anon;

INSERT INTO t_materialize_ttl_statistics (d, x, s) VALUES ('2000-01-01 00:00:00', 41, 'a');

DROP TABLE t_memory_global_in_keys;

SELECT toStartOfInterval(toDateTime64('1969-12-31 23:59:59.500', 3), INTERVAL 1 SECOND);

SELECT count() FROM (EXPLAIN actions=1 SELECT id FROM t_prewhere_final_float FINAL WHERE toString(f) = '0') WHERE explain LIKE '%Prewhere filter%';

INSERT INTO t_prewhere_final_null VALUES (1, 0.0, 1);

INSERT INTO t_prewhere_final_int VALUES (1, 5, 1, 'stale');

CREATE OR REPLACE TEMPORARY TABLE tmp2 (y String);

INSERT INTO tmp_evicting SELECT number FROM numbers(50000) SETTINGS max_block_size = 50000, max_insert_block_size = 50000;

ALTER TABLE tmp_mt DETACH PARTITION tuple();

SYSTEM STOP TTL MERGES rows_ttl_horizontal;

SELECT * FROM merged_parts WHERE table LIKE 'rows_ttl_vertical%' ORDER BY table;

SELECT * FROM merged_parts WHERE table LIKE 'move_ttl%' OR table LIKE 'recompression_ttl%' ORDER BY table;

OPTIMIZE TABLE group_by_ttl FINAL;

ALTER TABLE t_update_in_partition_pinned UPDATE v = v WHERE 0 SETTINGS mutations_sync = 2;

INSERT INTO t_vector_index_analysis_limit SELECT number, [number / 100, number / 100] FROM numbers(100);

SELECT groupArray(c) FROM (SELECT count() OVER (ORDER BY number RANGE BETWEEN 1 + 1 PRECEDING AND CURRENT ROW) AS c FROM numbers(4));

-- count() used by the outer query; an unused one is dropped from the aggregation.
SELECT max(bs) < 20000 AND sum(c) = 200000
FROM (SELECT blockSize() AS bs, c FROM (SELECT number % 20000 AS k, count() AS c FROM numbers(200000) GROUP BY k));

SELECT toString([[toDateTime64(number, 3)]] + [[(2, NULL)]]) FROM numbers(2);

DROP TABLE t_abtk_facts;

INSERT INTO t_narrow VALUES (1), (2), (3);

SELECT count() FROM system.text_log
WHERE event_date >= yesterday() AND event_time >= now() - 600
    AND level = 'Error'
    AND message LIKE '%Error while loading MergeTree deduplication log%'
    AND message LIKE '%' || (SELECT toString(uuid) FROM system.tables WHERE database = currentDatabase() AND name = 't_dedup_log_alter_window') || '%'
SETTINGS max_rows_to_read = 0;

ALTER TABLE t_datetime DROP PARTITION '2024-03-01';

DROP TABLE t_digits_date;

-- A cast between named tuples uses the names to match the elements.
ALTER TABLE t_tuple DROP PARTITION (tupleElement(CAST(CAST(('2024-02-29', '2024-03-01'), 'Tuple(b String, a String)'), 'Tuple(a Date, b Date)'), 'a'), 1);

INSERT INTO t_default_arguments VALUES ('{"a":1}', '{"b":2}'), (NULL, '{"c":3}');

SELECT clamp(5, 1, x), widthBucket(10.15, -8.6, 23, x), regexpPosition('aXbXcXd', 'X', x) FROM (SELECT arrayJoin([4, NULL]) AS x) ORDER BY ALL;

SELECT f, s FROM t_memory_prewhere_column PREWHERE f ORDER BY s;

SELECT [toInt8(127)] = '[-129]';

-- in-range values, and element types that read their own text, are unaffected
SELECT [toUInt64(18446744073709551615)] = '[18446744073709551615]';

-- Without PREWHERE only blocks that WHERE empties are recorded, hence one granule per block.
SELECT count(), sum(length(p.pad)) FROM probe AS p INNER JOIN build AS b ON p.k = b.k WHERE p.k IN (101, 5001, 12346)
SETTINGS enable_join_runtime_filters = 0, optimize_move_to_prewhere = 0, max_block_size = 128, log_comment = 'qcc_no_rf_1';

SELECT count(), sum(length(p.pad)) FROM probe AS p INNER JOIN build AS b ON p.k = b.k PREWHERE p.pad != '' WHERE p.k IN (100, 5006, 12345)
SETTINGS optimize_prewhere_after_pushdown = 1, use_query_condition_cache = 0;

SELECT '= plain read, non-deterministic folded lambda body: not cached =';

SELECT sum(c) FROM t_readd_agg_projection;

-- A bucket start clipped by `addMonths` to the end of a shorter month is rounded to itself.
SELECT 'Clipped';

SELECT count(), sum(id) FROM tab WHERE hasPhrase(lc, 'v17 w3');

INSERT INTO tab_merge_lc SELECT number, concat('a', toString(number % 50 % 5), ' b', toString(number % 50)) FROM numbers(1500, 1500);

SELECT countIf(isNaN(tup.2[1])) FROM (SELECT tup FROM t_top_k_nan_array ORDER BY tup ASC NULLS FIRST LIMIT 150);

ALTER TABLE modify_route_control MODIFY TTL d + INTERVAL 100 YEAR;

SELECT '-- Signed key crossing zero, 2 PRECEDING AND 2 FOLLOWING';

DROP VIEW mv_modify_expansion;

-- The overhead of automatic parallel replicas is reported in parts: building the plan with parallel
-- replicas (`AutoParallelReplicasPlanBuildMicroseconds`), the rest of the optimization
-- (`AutoParallelReplicasOptimizationMicroseconds`), and collecting statistics while the query runs
-- (`RuntimeDataflowStatistics{Input,Output}Nanoseconds`). The first run has no statistics yet, so it
-- collects them; the second decides from them and collects nothing.

DROP TABLE IF EXISTS t_autopr_overhead_split;

CREATE DICTIONARY c_05259 (k1 UInt64, k2 String, v String DEFAULT 'dv')
PRIMARY KEY k1, k2 SOURCE(CLICKHOUSE(TABLE 'c_src_05259')) LAYOUT(COMPLEX_KEY_HASHED()) LIFETIME(0);

SELECT 'dictGetString(\'d_05259\', \'s\', k) NOT IN (\'a\', \'b\')';

SELECT arraySort(groupArray(k)) FROM (SELECT k FROM t_05259 WHERE dictGetUInt64('d_05259', 'n', k) IN (1, 2)) SETTINGS optimize_inverse_dictionary_lookup = 1;

SELECT 'dictGetUInt64(\'d_05259\', \'n\', k) NOT IN (-1, 2)';

SELECT arraySort(groupArray(k)) FROM (SELECT k FROM t_05259 WHERE dictGet('c_05259', 'v', (k, 'x')) NOT IN ('p', 'dv')) SETTINGS optimize_inverse_dictionary_lookup = 1;

-- zookeeper: the replicated arm needs Keeper.
-- no-fasttest: waiting for the failed replicated mutation takes about 30 seconds:
--   https://github.com/ClickHouse/ClickHouse/issues/67936
-- no-shared-merge-tree: the arms rely on how `MergeTree` and `ReplicatedMergeTree` report and kill a
--   failed mutation.
-- no-replicated-database: the replicated arm names its Keeper path explicitly, which a `Replicated`
--   database rejects (`database_replicated_allow_replicated_engine_arguments` defaults to 0).

-- A part can hold only columns the table no longer has: here a partition is detached, its only column
-- is replaced by a new one, and the partition is re-attached. Reads of such a part fail with
-- `NO_SUCH_COLUMN_IN_TABLE` and keep it, so its data can be recovered by adding the column back. A
-- mutation that reads nothing from the part (`MODIFY COLUMN`, `RENAME COLUMN` of the new column) must
-- fail the same way and keep the part too, not write a part with no columns, which can be neither read
-- nor loaded.

DROP TABLE IF EXISTS t_compact;

ALTER TABLE t_replicated DETACH PARTITION ALL;

SELECT n.generate_series FROM generate_series(0, 99) AS n INNER JOIN (SELECT 50 AS x) AS t ON n.generate_series = t.x LIMIT 1;

-- Tag no-parallel: Messes with internal cache
--
-- An `ORDER BY ... LIMIT n` (TopK) read records in the query condition cache the granules its dynamic
-- `__topKFilter` rejected: none of their rows is in the top N of the whole table. A `SAMPLE` read computes
-- its top N from a subset of the rows, which can lie in exactly those granules, so it must not reuse such
-- entries. It still returns what it returns with the cache off.

SET use_query_condition_cache = 1;

-- A row policy on a `Memory` table, which applies the policy inside the reading step,
-- must be applied to a read shipped as a serialized query plan.

SET serialize_query_plan = 1, prefer_localhost_replica = 0;

SELECT count() FROM numbers(100) WHERE sleepEachRow(0.001) = 0 AND number % 100 = 5
SETTINGS short_circuit_function_evaluation = 'enable', short_circuit_function_evaluation_reorder_arguments = 1, max_block_size = 10,
    log_comment = '05259_sleep_where';

DROP USER IF EXISTS user_05259;

SELECT _part_offset, a, b FROM t_topk_part_offset ORDER BY _part_offset LIMIT 3
SETTINGS use_top_k_dynamic_filtering = 1, prefer_optimize_projection = 1;

-- RANGE frames with offsets over a Nullable ORDER BY key: the NULL keys form one peer group at the start or at the end.

DROP TABLE IF EXISTS t_nk;

SELECT sum(k) FROM t FORMAT Null SETTINGS enable_parallel_replicas = 1, automatic_parallel_replicas_mode = 1, log_comment = '05260_enabled_mode_1';

CREATE TABLE t_oor_key32 (k Int32) ENGINE = MergeTree ORDER BY k SETTINGS index_granularity = 1;

INSERT INTO t_oor_join_memory SELECT toString(number) FROM numbers(20);

INSERT INTO t4 SELECT number, number, if(number % 2 = 0, 'g1', 'g2'), 's' FROM numbers(250);

SELECT count() FROM (SELECT number AS k, number % 3 AS x, number % 2 AS k2 FROM numbers(8)) AS a INNER JOIN (SELECT number AS k, number % 4 AS y, number % 3 AS k2 FROM numbers(8)) AS b ON (a.k = b.k AND (a.x = 1 OR b.y = 2)) OR a.k2 = b.k2 SETTINGS join_algorithm = 'auto';

-- A constant `TTL ... DELETE WHERE` whose condition is not a plain `UInt8` column: an INSERT records the TTL
-- for a part only if one of its rows matches the condition, and rejects a condition that cannot be a filter.

SET allow_suspicious_ttl_expressions = 1;

CREATE TABLE t_nullable_int8 (x Nullable(Int8)) ENGINE = MergeTree ORDER BY tuple()
TTL toDateTime('2100-01-01 00:00:00', 'UTC') DELETE WHERE x;

-- Ranking functions over a Nullable ORDER BY key with ties: NULLS FIRST and NULLS LAST in both directions.

DROP TABLE IF EXISTS t_rk;

-- The reads have to be pruned by their own key conditions - that is what the transplant carries over -
-- and not by a filter built from another side at runtime.
SET enable_join_runtime_filters = 0;

INSERT INTO t_set_dt64 VALUES ('2024-01-02 00:00:00', 2);

SELECT count() > 0 FROM (EXPLAIN SELECT min(v), max(v) FROM ttl_stats_orphan_partial)
WHERE explain ILIKE '%_statistics_projection%';

CREATE TABLE t_coord_baseline (c UInt64) ENGINE = Memory;

SELECT groupArray(value) FROM (SELECT value FROM prometheusQuery(rx, 'a_total{job!~"api|web"}', 1000) ORDER BY value);

SELECT number, lag(toInt32(number), 5) OVER (ORDER BY number) AS l, lead(toInt32(number), 5, -1) OVER (ORDER BY number) AS n FROM numbers(3) ORDER BY number;

SELECT predictXGBoost('model_05262_xgb', NULL, 2.0) = predictXGBoost('model_05262_xgb', nan, 2.0);

SELECT '-- any and anyLast behave like first_value and last_value';

SELECT count() > 0 FROM (EXPLAIN actions = 1 SELECT groupArray(a) FROM (SELECT a FROM merge(currentDatabase(), '^t_proj$') WHERE b < 5000 ORDER BY a LIMIT 12)
    SETTINGS force_optimize_projection_name = 'p', explain_query_plan_default = 'pretty') WHERE explain ILIKE '%Read type: Default%';

SELECT count() > 0 FROM (EXPLAIN actions = 1 SELECT groupArray(a) FROM (SELECT a FROM merge(currentDatabase(), '^t_desc$') WHERE b < 5000 ORDER BY a DESC LIMIT 12)
    SETTINGS prefer_optimize_projection = 1, force_optimize_projection_name = 'p', explain_query_plan_default = 'pretty') WHERE explain ILIKE '%Read type: Default%';

SELECT i,
    medianExact(toFloat64(v) / 4) OVER w AS f,
    medianExact(toDecimal64(v, 2)) OVER w AS dec,
    medianExact(toDate('2024-01-01') + v) OVER w AS d,
    medianExact(toDateTime('2024-01-01 00:00:00', 'UTC') + v) OVER w AS dt,
    quantile(0.5)(toInt16(v) - 5) OVER w AS signed_interpolated
FROM t_q WINDOW w AS (ORDER BY i ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING) ORDER BY i;

-- Renaming a column renames its subcolumns: the old subcolumn names must not stay resolvable,
-- neither through a Buffer table that still has the old names nor after a new column reuses an old name.

-- The Buffer table reports every column missing in its destination with a warning.
SET send_logs_level = 'fatal';

SELECT number,
    groupConcat(',')(number) OVER w AS n,
    groupConcat(',')(toDate('2024-01-01') + number) OVER w AS d,
    groupConcat(',')([number, number]) OVER w AS arr,
    groupConcat(',')(toLowCardinality(toString(number))) OVER w AS lc
FROM numbers(3) WINDOW w AS (ORDER BY number) ORDER BY number;

SELECT 'objective', predictXGBoost('model_05265_objective', 30.0, 4.0) != predictXGBoost('model_05265_base', 30.0, 4.0);

CREATE TABLE t_ma (p UInt8, i UInt8, x Float64, y Float64, b Bool, n Nullable(UInt32), s String) ENGINE = MergeTree ORDER BY (p, i);

-- Each side is a separate top-level query, so that its `max_block_size` applies to the read it predicts on.
CREATE TABLE predictions_05266 (pass String, id UInt64, p Float64) ENGINE = MergeTree ORDER BY (pass, id);

-- With reordering disabled, the runtime filter must not be the one condition moved to PREWHERE.
SELECT a.c1, b.m, avgMerge(a.s1), avgMerge(a.s2) FROM t41 AS a INNER JOIN t42 AS b ON (a.time = b.m) AND (a.c1 = b.c1) WHERE a.time IN ('2026-08-07 08:35:00', '2026-08-07 08:47:00', '2026-08-07 09:40:00', '2026-08-08 12:04:00', '2026-08-08 20:04:00', '2026-08-09 11:03:00', '2026-08-09 16:32:00') GROUP BY a.c1, b.m ORDER BY a.c1, b.m
SETTINGS join_algorithm = 'grace_hash', max_bytes_to_read = '22500000', enable_join_runtime_filters = 1, allow_reorder_prewhere_conditions = 0, move_all_conditions_to_prewhere = 0, log_comment = 'rf_c' FORMAT Null;

SELECT a.n, a.c AS by_parity, b.c AS by_third, count() OVER w AS running
FROM (SELECT number AS n, count() OVER w AS c FROM numbers(6) WINDOW w AS (PARTITION BY number % 2)) AS a
JOIN (SELECT number AS n, count() OVER w AS c FROM numbers(6) WINDOW w AS (PARTITION BY number % 3)) AS b USING (n)
WINDOW w AS (ORDER BY n)
ORDER BY n;

SELECT '-- A run of a hundred NULL keys at the end does not count into the last value row';

WITH ['a'] AS ns SELECT '1 needle', countIf(hasAny(s, ns)), countIf(hasAny(s, ns) != hasAny(s, materialize(ns))), countIf(hasAny(lc, ns) != hasAny(lc, materialize(ns))), countIf(hasAny(fs, ns) != hasAny(fs, materialize(ns))) FROM t_has_any_const_strings;

SELECT '-- binary operator';

INSERT INTO t05288_events
SELECT 'worker_before', count()
FROM system.query_log
WHERE event_date >= yesterday() AND is_initial_query = 0 AND has(databases, currentDatabase())
  AND has(tables, currentDatabase() || '.t05288_worker_src');

SELECT 'declared_skips_recorded',
       (SELECT ifNull(sum(value), 0) FROM system.events
        WHERE event = 'ASTFuzzerSkippedCollaborativeWorker')
     - (SELECT workers FROM t05288_events WHERE label = 'skips_before_declared') > 0;

DROP TABLE t05288_dst;

SELECT 'external',
    count(), sum(c), sum(sv), sum(cityHash64(s, t) * c), countIf(s = ''), countIf(t = '')
FROM
(
    SELECT s, t, count() AS c, sum(k) AS sv
    FROM lc_serialized_group_by_external
    GROUP BY s, t
)
SETTINGS max_bytes_before_external_group_by = 1, max_bytes_ratio_before_external_group_by = 0,
    group_by_two_level_threshold = 1, max_block_size = 4096, max_threads = 2, log_comment = '05289_external';

SELECT groupArray(k) FROM t_memory_prewhere_steps_stateful PREWHERE k % 2 = 1 AND rowNumberInBlock() < 4 SETTINGS enable_multiple_prewhere_read_steps = 0;

SELECT 'ALTER UPDATE applied on fly';

CREATE TABLE t_ttl_pr_set
(
    id UInt64,
    ver UInt64,
    d DateTime,
    c1 UInt64,
    c2 UInt64
)
ENGINE = ReplacingMergeTree(ver)
ORDER BY id
TTL d + INTERVAL 1 DAY WHERE id IN (SELECT id FROM {CLICKHOUSE_DATABASE:Identifier}.t_ttl_pr_set_keys SETTINGS enable_parallel_replicas = 1, max_parallel_replicas = 3, cluster_for_parallel_replicas = 'test_cluster_one_shard_three_replicas_localhost', parallel_replicas_for_non_replicated_merge_tree = 1)
SETTINGS
    min_bytes_for_wide_part = 0,
    min_bytes_for_full_part_storage = 0,
    enable_block_number_column = 0,
    enable_block_offset_column = 0,
    vertical_merge_algorithm_min_rows_to_activate = 1,
    vertical_merge_algorithm_min_columns_to_activate = 1,
    vertical_merge_optimize_ttl_delete = 1,
    merge_with_ttl_timeout = 0,
    ratio_of_defaults_for_sparse_serialization = 1.0;

SELECT x FROM in_sub_cte_ttl ORDER BY x;

CREATE TABLE t1 (a UInt32, b UInt32) ENGINE = Memory;

-- `a` repeats every 1000 rows and `b` is unique, so a range condition on `a` prunes by the primary key
-- while the join on `b` reads everything.
INSERT INTO t_self_coord SELECT number % 1000, number, number FROM numbers(300000);

-- The stored definition keeps the value of a key-value argument, not its expression.
SET use_hive_partitioning = 1;

-- A `Date32` constant whose midnight does not fit the `Int64` ticks of a high-scale `DateTime64` must follow
-- `date_time_overflow_behavior` on the `Field` materialization paths (the `INSERT ... VALUES` expression fallback and
-- the `values` table function) exactly like `CAST` does, instead of degrading into a generic NULL insertion error.
--
-- `clickhouse-client` parses inline `VALUES` data itself unless `send_table_structure_on_insert_with_inline_data = 0`
-- (randomized by the test harness) hands the raw data to the server, so the expected exception may be raised on
-- either side: the `INSERT` hints use the side-agnostic `error` form.

DROP TABLE IF EXISTS t_values_date32_overflow;

CREATE TABLE t_05291 (v UInt64) ENGINE = MergeTree ORDER BY v;

SET use_iceberg_metadata_files_cache = 0;

SELECT sum(s) FROM (SELECT k, v, sum(v) OVER (PARTITION BY k) AS s FROM t_hint_window QUALIFY indexHint(v < 41) AND v < 41);

CREATE TABLE t_plain (x UInt64, json JSON(a UInt64, b String, c Array(UInt8))) ENGINE = MergeTree ORDER BY x
SETTINGS min_bytes_for_wide_part = 0, min_rows_for_wide_part = 0, index_granularity = 4, min_compress_block_size = 1;

SELECT toTypeName(CAST('{}', 'JSON(Shared a UInt64, `Shared` String)'));

DESCRIBE t_mixed SETTINGS describe_include_subcolumns = 1;

INSERT INTO t_sibling_plain SELECT number, concat('{"a":', toString(number), '}'), number + 100 FROM numbers(3);

SELECT count() > 0 FROM (EXPLAIN WHATIF SELECT * FROM t2 WHERE c1 = 5);

ATTACH DICTIONARY dict;

DROP TABLE dst_join;

CREATE MATERIALIZED VIEW {CLICKHOUSE_DATABASE_1:Identifier}.rmv REFRESH EVERY 1 YEAR TO {CLICKHOUSE_DATABASE_1:Identifier}.rdst (id UInt64 COMMENT 'id comment', v UInt64 COMMENT 'v comment') EMPTY AS SELECT id, v FROM {CLICKHOUSE_DATABASE_1:Identifier}.src;

SELECT '-- projection index, rows out of 800 within 7 standard deviations of the expected count';

DROP ROW POLICY IF EXISTS p2 ON t;

SELECT 'rand', count() > 0 FROM (EXPLAIN indexes = 1 SELECT count() FROM t_set WHERE rand() % 2 = 0 SETTINGS enable_parallel_replicas = 0, use_query_condition_cache = 0) WHERE explain LIKE '%Name: s_idx%';

CREATE TABLE t_05291 (id UInt64, v UInt64) ENGINE = MergeTree ORDER BY id;

SELECT '1 2 inf', varPopStable(x), stddevPopStable(x) FROM (SELECT arrayJoin([1., 2., inf]) AS x);

DROP TABLE t_rename_modify_dotted;

SYSTEM STOP MERGES r_05292;

DROP TABLE t_fill_dt64_date;

INSERT INTO t_empty_compact VALUES (3, {'k': 'v'}, {'k': 'v'}, ('v', 1), 'v', 'v', '{"a": "v"}');

DROP TABLE t_empty_wide;

INSERT INTO t_deep SELECT number, concat('{"a1":{"b":{"c":', toString(number), '}},"a2":[{"b":', toString(number), '},{"b":', toString(number + 1), '}],"a3":{"k":{"x":', toString(number * 2), '}},"a4":', if(number % 2 = 0, concat('{"b":', toString(number), '}'), concat('"s', toString(number), '"')), ',"a5":', if(number % 2 = 0, concat('"d', toString(number), '"'), concat('[', toString(number), ',', toString(number), ']')), '}') FROM numbers(8);

SELECT '-- bracket access is the combined subcolumn of a SHARED path';

DROP TABLE br_memory;

DROP TABLE IF EXISTS mv_in;

SELECT count() FROM numbers(1000) WHERE match('12345', '.*' || toString(number % 10) || '.')
    SETTINGS max_block_size = 1000, max_threads = 1, log_comment = '05292_const_haystack';

CREATE VIEW v_cluster (k UInt64) AS SELECT k FROM cluster(
    (SELECT if(count() > 0, 'test_shard_localhost', '') FROM t_probe AS p, t_build AS b WHERE p.k = b.k), currentDatabase(), 't_dep');

DROP TABLE IF EXISTS t_ttl_const_where_nullable;

-- Ties spread over many chunks
SELECT 'Int64 large', argMin(number, if(number < 20000, 5, (number + 1) % 3)), argMax(number, if(number < 20000, -5, (number + 1) % 3)) FROM numbers(100000);

OPTIMIZE TABLE t_plan_based_big FINAL;

SELECT comment FROM system.databases WHERE name = {CLICKHOUSE_DATABASE_1:String};

-- Nothing reads it above the filter, so only the constant is left.
SELECT 'unused filter column folded', countIf(explain LIKE '%Filter column%') = 0
FROM (EXPLAIN PLAN actions = 1 SELECT count() FROM (SELECT materialize(1) = 1 AS c, number FROM numbers(10) WHERE c));

SELECT o.id, sub.v, sub.cnt
FROM outer_t AS o
INNER JOIN LATERAL (SELECT i.v, count() AS cnt FROM inner_t AS i WHERE i.k = o.k GROUP BY i.v) AS sub ON true
ORDER BY o.id, sub.v
SETTINGS max_rows_to_group_by = 100, group_by_overflow_mode = 'throw';

SELECT k FROM t_memory_nested_member WHERE has(n.b, 0) ORDER BY k SETTINGS optimize_move_to_prewhere = 0;

ALTER TABLE t_memory_nested_member_dropped DROP COLUMN `n.b`;

ALTER TABLE t_memory_nested_member_shadow ADD COLUMN `n.a.x` Array(Array(UInt8));

SELECT countIf(explain ILIKE '%JoinLogical%'), countIf(explain ILIKE '%ParallelReplicas%') FROM (
    EXPLAIN SELECT * FROM (SELECT key FROM t_inel_mem) AS l
    RIGHT JOIN (SELECT key FROM t_inel_right) AS r ON l.key = r.key
    SETTINGS parallel_replicas_prefer_local_join = 1);

SELECT tags, value FROM prometheusQuery(ts, 'histogram_quantile(0.16666666666666666, req_bucket)', 100);

SELECT value FROM prometheusQuery(ts, '2 <= bool 1', 100);

SELECT sum(a) FROM t_shipped_limits_break;

DROP TABLE IF EXISTS t_in_create;

INSERT INTO t_ext SETTINGS enable_extended_results_for_datetime_functions = 1 VALUES ('2100-01-01 00:00:00');

SELECT x, count() OVER w, groupArray(x) OVER w
FROM values('x Nullable(Float64)', (0), (1), (1.5), (2), (nan), (NULL), (inf), (NULL), (nan))
WINDOW w AS (ORDER BY x ASC NULLS LAST RANGE BETWEEN 1 PRECEDING AND 1 FOLLOWING)
ORDER BY x ASC NULLS LAST, count() OVER w;

SELECT groupArray(id) FROM container_probes WHERE NOT (dictGet('dict_array', 'attr', a) = 'negative zero');

SELECT 'sub [json.t.p]', (SELECT arraySort(groupArray((x, toString(json.t.p)))) FROM sub_w SETTINGS max_threads = 1) = (SELECT arraySort(groupArray((x, toString(json.t.p)))) FROM sub_mem), (SELECT arraySort(groupArray((x, toString(json.t.p)))) FROM sub_cm SETTINGS max_threads = 1) = (SELECT arraySort(groupArray((x, toString(json.t.p)))) FROM sub_mem), (SELECT arraySort(groupArray((x, toString(json.t.p)))) FROM sub_cn SETTINGS max_threads = 1) = (SELECT arraySort(groupArray((x, toString(json.t.p)))) FROM sub_mem), (SELECT toString(json.t.p) FROM sub_w WHERE x = 2);

SELECT 'sub [json]', (SELECT arraySort(groupArray((x, toString(json)))) FROM sub_w SETTINGS max_threads = 1) = (SELECT arraySort(groupArray((x, toString(json)))) FROM sub_mem), (SELECT arraySort(groupArray((x, toString(json)))) FROM sub_cm SETTINGS max_threads = 1) = (SELECT arraySort(groupArray((x, toString(json)))) FROM sub_mem), (SELECT arraySort(groupArray((x, toString(json)))) FROM sub_cn SETTINGS max_threads = 1) = (SELECT arraySort(groupArray((x, toString(json)))) FROM sub_mem), (SELECT toString(json) FROM sub_w WHERE x = 2);

CREATE TABLE tc_mem (x UInt64, c Tuple(json JSON(a UInt64, arr Array(UInt8)))) ENGINE = Memory;

CREATE TABLE nes_cm (x UInt64, json JSON(SHARED a.x UInt64, SHARED a.arr Array(UInt8), SHARED b UInt64)) ENGINE = MergeTree ORDER BY x SETTINGS min_bytes_for_wide_part = 1000000000, min_rows_for_wide_part = 1000000000, index_granularity = 4, write_marks_for_substreams_in_compact_parts = 1, map_serialization_version = 'basic', map_serialization_version_for_zero_level_parts = 'basic';

DROP TABLE IF EXISTS mix_cn;

DROP TABLE IF EXISTS deep_cm;

SELECT '-- containers whose next substream follows the typed shared data in the granule';

SELECT 'sib [(t.j, t.s)] max_block_size = 5', (SELECT arraySort(groupArray((x, toString((t.j, t.s))))) FROM sib_w SETTINGS max_threads = 1, max_block_size = 5) = (SELECT arraySort(groupArray((x, toString((t.j, t.s))))) FROM sib_mem), (SELECT arraySort(groupArray((x, toString((t.j, t.s))))) FROM sib_cm SETTINGS max_threads = 1, max_block_size = 5) = (SELECT arraySort(groupArray((x, toString((t.j, t.s))))) FROM sib_mem), (SELECT arraySort(groupArray((x, toString((t.j, t.s))))) FROM sib_cn SETTINGS max_threads = 1, max_block_size = 5) = (SELECT arraySort(groupArray((x, toString((t.j, t.s))))) FROM sib_mem), (SELECT toString((t.j, t.s)) FROM sib_w WHERE x = 2);

INSERT INTO t_guard_plain_alias (t) VALUES ((1));

DROP TABLE IF EXISTS mb_cm;

-- The filter is not moved to PREWHERE.
SET optimize_move_to_prewhere_if_final = 0;

CREATE TABLE t1_05296 (a Int64) ENGINE = MergeTree ORDER BY a;

SELECT a + 1 AS b, t3.b AS right_b, t3.c FROM (SELECT 1 AS a, 10 AS k) t1 JOIN (SELECT 10 AS k) t2 USING (k) JOIN (SELECT 2 AS b, 7 AS c) t3 USING (b);

DROP TABLE IF EXISTS nj_w;

DROP TABLE IF EXISTS ns_w;

SELECT 'ns [(json.a.^p, json.t.a.x)] max_block_size = 5', (SELECT arraySort(groupArray((x, toString((json.a.^p, json.t.a.x))))) FROM ns_w  SETTINGS max_threads = 1, max_block_size = 5) = (SELECT arraySort(groupArray((x, toString((json.a.^p, json.t.a.x))))) FROM ns_mem ), (SELECT arraySort(groupArray((x, toString((json.a.^p, json.t.a.x))))) FROM ns_cm  SETTINGS max_threads = 1, max_block_size = 5) = (SELECT arraySort(groupArray((x, toString((json.a.^p, json.t.a.x))))) FROM ns_mem ), (SELECT arraySort(groupArray((x, toString((json.a.^p, json.t.a.x))))) FROM ns_cn  SETTINGS max_threads = 1, max_block_size = 5) = (SELECT arraySort(groupArray((x, toString((json.a.^p, json.t.a.x))))) FROM ns_mem ), (SELECT toString((json.a.^p, json.t.a.x)) FROM ns_w WHERE x = 10);

SELECT 'na [(json.a.p.arr.size0, json.a)] max_block_size = 5', (SELECT arraySort(groupArray((x, toString((json.a.p.arr.size0, json.a))))) FROM na_w  SETTINGS max_threads = 1, max_block_size = 5) = (SELECT arraySort(groupArray((x, toString((json.a.p.arr.size0, json.a))))) FROM na_mem ), (SELECT arraySort(groupArray((x, toString((json.a.p.arr.size0, json.a))))) FROM na_cm  SETTINGS max_threads = 1, max_block_size = 5) = (SELECT arraySort(groupArray((x, toString((json.a.p.arr.size0, json.a))))) FROM na_mem ), (SELECT arraySort(groupArray((x, toString((json.a.p.arr.size0, json.a))))) FROM na_cn  SETTINGS max_threads = 1, max_block_size = 5) = (SELECT arraySort(groupArray((x, toString((json.a.p.arr.size0, json.a))))) FROM na_mem ), (SELECT toString((json.a.p.arr.size0, json.a)) FROM na_w WHERE x = 10);

INSERT INTO nd_cm SELECT number, concat('{"d":', multiIf(number % 3 = 0, toString(number), number % 3 = 1, concat('"d', toString(number), '"'), concat('[', toString(number), ']')), ',"j":{"k":', toString(number), ',"p":{"a":', toString(number * 2), ',"b":"b', toString(number % 3), '"}}}') FROM numbers(20);

CREATE TABLE arr_cm (x UInt64, arr Array(JSON(SHARED a UInt64, SHARED b String))) ENGINE = MergeTree ORDER BY x SETTINGS min_bytes_for_wide_part = 1000000000, min_rows_for_wide_part = 1000000000, index_granularity = 4, write_marks_for_substreams_in_compact_parts = 1, map_serialization_version = 'basic', map_serialization_version_for_zero_level_parts = 'basic';

SELECT '-- Array(JSON(SHARED ...)): granules of empty arrays alternating with granules of elements';

SELECT 'alt [(arr.a, arr)] max_block_size = 7 WHERE x >= 4 AND x < 30', (SELECT arraySort(groupArray((x, toString((arr.a, arr))))) FROM alt_w WHERE x >= 4 AND x < 30 SETTINGS max_threads = 1, max_block_size = 7) = (SELECT arraySort(groupArray((x, toString((arr.a, arr))))) FROM alt_mem WHERE x >= 4 AND x < 30), (SELECT arraySort(groupArray((x, toString((arr.a, arr))))) FROM alt_cm WHERE x >= 4 AND x < 30 SETTINGS max_threads = 1, max_block_size = 7) = (SELECT arraySort(groupArray((x, toString((arr.a, arr))))) FROM alt_mem WHERE x >= 4 AND x < 30), (SELECT arraySort(groupArray((x, toString((arr.a, arr))))) FROM alt_cn WHERE x >= 4 AND x < 30 SETTINGS max_threads = 1, max_block_size = 7) = (SELECT arraySort(groupArray((x, toString((arr.a, arr))))) FROM alt_mem WHERE x >= 4 AND x < 30), (SELECT toString((arr.a, arr)) FROM alt_w WHERE x = 10);

CREATE TABLE aa_cn (x UInt64, aa Array(Array(JSON(SHARED c Array(UInt8)))), az Array(JSON(SHARED zz Array(Array(Nullable(Int64))))), json JSON(SHARED items Array(JSON(SHARED big String, SHARED small String)))) ENGINE = MergeTree ORDER BY x SETTINGS min_bytes_for_wide_part = 1000000000, min_rows_for_wide_part = 1000000000, index_granularity = 4, write_marks_for_substreams_in_compact_parts = 0, map_serialization_version = 'basic', map_serialization_version_for_zero_level_parts = 'basic';

-- A MATERIALIZED CTE read more than once inside an IN subquery of a parallel replicas read with a local
-- plan: the query shipped to the other replicas reads the CTE by its temporary table name, so the CTE
-- must be materialized before it is sent to them (issue #112642). The CTE bodies sleep so that the other
-- replicas always start before the local read finishes.

SET enable_materialized_cte = 1;

INSERT INTO t_pr_proj_aio_normal SELECT number % 10, number FROM numbers(100000, 100000);

-- Arm B. With GROUP BY, a shard sends several states in one block, which is marshalled in parallel.
SELECT g, medianDeterministicMerge(state)
FROM remote('127.0.0.{1,2}', currentDatabase(), qd_states)
WHERE (part < 3) = (shardNum() = 1)
GROUP BY g ORDER BY g
SETTINGS enable_parallel_blocks_marshalling = 1, group_by_two_level_threshold = 0, group_by_two_level_threshold_bytes = 0;

SELECT toUInt256('115792089237316195423570985008687907853269984665640564039457584007913129639935') / toUInt8(1);

SELECT count(), sum(cityHash64(id)) FROM tab WHERE hasToken(s, 'r');

SELECT count(), sum(cityHash64(id)) FROM tab_odd WHERE hasToken(s, 'y');

INSERT INTO tab_arr SELECT id, splitByChar(' ', s) FROM tab;

DROP TABLE t_topk_alias;

INSERT INTO r_cm SELECT number, intDiv(number, 4) % 2, concat('{"a":', toString(number * 10), ',"b":"', repeat('x', number % 7), '","c":', toString(range(number % 4)), if(number % 2 = 0, concat(',"d":', toString(number)), ''), '}') FROM numbers(60);

SELECT 'r [json] WHERE x < 8 OR (x >= 12 AND x < 24)', (SELECT arraySort(groupArray((x, toString(v)))) FROM (SELECT x, json AS v FROM r_w WHERE x < 8 OR (x >= 12 AND x < 24)  SETTINGS max_threads = 1)) = (SELECT arraySort(groupArray((x, toString(v)))) FROM (SELECT x, json AS v FROM r_mem WHERE x < 8 OR (x >= 12 AND x < 24) )), (SELECT arraySort(groupArray((x, toString(v)))) FROM (SELECT x, json AS v FROM r_cm WHERE x < 8 OR (x >= 12 AND x < 24)  SETTINGS max_threads = 1)) = (SELECT arraySort(groupArray((x, toString(v)))) FROM (SELECT x, json AS v FROM r_mem WHERE x < 8 OR (x >= 12 AND x < 24) )), (SELECT arraySort(groupArray((x, toString(v)))) FROM (SELECT x, json AS v FROM r_cn WHERE x < 8 OR (x >= 12 AND x < 24)  SETTINGS max_threads = 1)) = (SELECT arraySort(groupArray((x, toString(v)))) FROM (SELECT x, json AS v FROM r_mem WHERE x < 8 OR (x >= 12 AND x < 24) )), (SELECT count() FROM r_w WHERE x < 8 OR (x >= 12 AND x < 24));

SELECT 'granules r WHERE y = 0 AND x >= 9', replaceRegexpAll(explain, '^[│ ]+', '') FROM (EXPLAIN indexes = 1 SELECT sum(json.a) FROM r_w WHERE y = 0 AND x >= 9 SETTINGS max_threads = 1, use_skip_indexes = 1, use_skip_indexes_on_data_read = 0, use_query_condition_cache = 0, use_skip_indexes_if_final = 1, force_index_by_date = 0, force_primary_key = 0, optimize_use_implicit_projections = 0, optimize_trivial_count_query = 0, optimize_move_to_prewhere = 0) WHERE explain LIKE '%Granules%';

INSERT INTO s_cn SELECT number, intDiv(number, 4) % 2, concat('{"arr":', toString(range(number % 3)), ',"t":{"p":', toString(number), ',"q":"q', toString(number % 3), '"},"d":', if(number % 3 = 0, toString(number), concat('"d', toString(number), '"')), '}') FROM numbers(40);

ALTER TABLE r_cm MATERIALIZE INDEX ib SETTINGS mutations_sync = 2;

SELECT 'r_pk [json] after the mutation', (SELECT arraySort(groupArray((x, toString(json)))) FROM r_pk SETTINGS max_threads = 1) = (SELECT arraySort(groupArray((x, toString(json)))) FROM r_mem);

SELECT 'k [json] WHERE json.a BETWEEN 100 AND 200', (SELECT arraySort(groupArray((x, toString(v)))) FROM (SELECT x, json AS v FROM k_w WHERE json.a BETWEEN 100 AND 200  SETTINGS max_threads = 1)) = (SELECT arraySort(groupArray((x, toString(v)))) FROM (SELECT x, json AS v FROM k_mem WHERE json.a BETWEEN 100 AND 200 )), (SELECT arraySort(groupArray((x, toString(v)))) FROM (SELECT x, json AS v FROM k_cm WHERE json.a BETWEEN 100 AND 200  SETTINGS max_threads = 1)) = (SELECT arraySort(groupArray((x, toString(v)))) FROM (SELECT x, json AS v FROM k_mem WHERE json.a BETWEEN 100 AND 200 )), (SELECT arraySort(groupArray((x, toString(v)))) FROM (SELECT x, json AS v FROM k_cn WHERE json.a BETWEEN 100 AND 200  SETTINGS max_threads = 1)) = (SELECT arraySort(groupArray((x, toString(v)))) FROM (SELECT x, json AS v FROM k_mem WHERE json.a BETWEEN 100 AND 200 )), (SELECT count() FROM k_w WHERE json.a BETWEEN 100 AND 200);

INSERT INTO p_cm SELECT number, intDiv(number, 4) % 2, concat('{"a":', toString(number * 10), ',"b":"', repeat('x', number % 7), '","c":', toString(range(number % 4)), if(number % 2 = 0, concat(',"d":', toString(number)), ''), '}') FROM numbers(60);

CREATE TABLE exact_division_key (x Int64) ENGINE = MergeTree PARTITION BY x ORDER BY x / 2;

DROP TABLE IF EXISTS t_w;

SELECT 't_w after lightweight delete', count() FROM t_w;

SELECT 't_cn [(json.a, json.c.size0, json.d)]', (SELECT arraySort(groupArray((x, toString((json.a, json.c.size0, json.d))))) FROM t_cn  SETTINGS max_threads = 1) = (SELECT arraySort(groupArray((x, toString((json.a, json.c.size0, json.d))))) FROM mem );

SELECT 't_cn dropped', count(), sum(z) FROM t_cn;

SELECT '-- an emptied part, an insert of no rows, a row count that is a multiple of the granularity';

SELECT 'e_cn [(json.a, json)]', (SELECT arraySort(groupArray((x, toString((json.a, json))))) FROM e_cn  SETTINGS max_threads = 1) = (SELECT arraySort(groupArray((x, toString((json.a, json))))) FROM mem );

SELECT 'r FINAL whole optimize_functions_to_subcolumns = 0', (SELECT arraySort(groupArray((x, toString(json)))) FROM r FINAL SETTINGS max_threads = 1, optimize_functions_to_subcolumns = 0) = (SELECT arraySort(groupArray((number, if(number % 2 = 0, concat('{"a":', toString(number * 10 + 1), ',"b":"v2","c":[9]}'), concat('{"a":', toString(number * 10), ',"b":"', repeat('x', number % 7), '","c":', toString(range(number % 4)), if(number % 2 = 0, concat(',"d":', toString(number)), ''), '}'))))) FROM numbers(40));

SELECT 'pr by y', count(), sum(json.a) FROM pr WHERE y = 3 SETTINGS max_threads = 1, optimize_use_projections = 1, force_optimize_projection = 1;

SELECT sum(n), count()
FROM fileCluster('test_cluster_one_shard_three_replicas_localhost', currentDatabase() || '_05300.tsv', 'TSV', 'n UInt64')
WHERE n IN (SELECT x FROM merge('', '^t_implicit_db_'));

SELECT 'a_w [(json.c.size0, json)]', (SELECT arraySort(groupArray((x, toString((json.c.size0, json))))) FROM a_w  SETTINGS max_threads = 1) = (SELECT arraySort(groupArray((x, toString((json.c.size0, json))))) FROM mem );

SELECT 'n_w [json.b]', (SELECT arraySort(groupArray((x, toString(json.b)))) FROM n_w  SETTINGS max_threads = 1) = (SELECT arraySort(groupArray((x, toString(json.b)))) FROM nmem );

SELECT 'b_w [json.d]', (SELECT arraySort(groupArray((x, toString(json.d)))) FROM b_w  SETTINGS max_threads = 1) = (SELECT arraySort(groupArray((x, toString(json.d)))) FROM bmem );

SELECT '-- cn: shape A, the plain type to SHARED and back, lazily';

DROP TABLE a_cn;

SELECT 'b_cn paths before', JSONDynamicPaths(json), JSONSharedDataPaths(json) FROM b_cn WHERE x = 2;

ALTER TABLE c_cn MODIFY COLUMN json JSON(SHARED a UInt64, SHARED b String, SHARED c Array(UInt8)) SETTINGS enable_json_lazy_type_hints = 0, mutations_sync = 2;

SELECT 'arr [(arr.a, arr)] max_block_size = 5', (SELECT arraySort(groupArray((x, toString((arr.a, arr))))) FROM arr  SETTINGS max_threads = 1, max_block_size = 5) = (SELECT arraySort(groupArray((x, toString((arr.a, arr))))) FROM amem );

SELECT '-- the removed path is a dynamic path again; its typed subcolumn over the old Wide part reads as NULL, a pre-existing limitation of lazy type hints that the plain type shares (Compact parts give the values)';

INSERT INTO p_cn SELECT number + 100, concat('{"a":"', toString(number), '","c":"c"}') FROM numbers(4);

INSERT INTO ab_cn SELECT number, concat('{"a":', toString(number), '}') FROM numbers(8);

INSERT INTO t_modify VALUES (1, 5), (2, 6);

ALTER TABLE t_materialize MATERIALIZE COLUMN d;

SELECT sampling_key, create_table_query NOT LIKE '% AS %' FROM system.tables WHERE database = currentDatabase() AND name = 't_alter_alias';

SELECT 'next granule, the column', (SELECT arraySort(groupArray((x, toString(json)))) FROM packed WHERE x >= 12 AND x < 16) = (SELECT arraySort(groupArray((x, toString(json)))) FROM mem WHERE x >= 12 AND x < 16);

SELECT 'three parts: whole table', (SELECT (count(), sum(cityHash64(x, toString(json))), sum(cityHash64(a, b, s, arr, arr_size, n IS NULL, ifNull(n, 0), lc, dx, dy, d, m, q))) FROM (SELECT x, json, json.a AS a, json.b AS b, json.s AS s, json.arr AS arr, json.arr.size0 AS arr_size, json.n AS n, json.lc AS lc, json.d.x AS dx, json.d.y AS dy, json.^d AS d, toString(json.m) AS m, toString(json.q) AS q FROM t  )) AS shared, (SELECT (count(), sum(cityHash64(x, toString(json))), sum(cityHash64(a, b, s, arr, arr_size, n IS NULL, ifNull(n, 0), lc, dx, dy, d, m, q))) FROM (SELECT x, json, json.a AS a, json.b AS b, json.s AS s, json.arr AS arr, json.arr.size0 AS arr_size, json.n AS n, json.lc AS lc, json.d.x AS dx, json.d.y AS dy, json.^d AS d, toString(json.m) AS m, toString(json.q) AS q FROM p  )) AS plain, shared = plain;

SELECT 'other keys, cube', number, multiIf(number > 0, number, 0) AS k, count() FROM numbers(2) GROUP BY CUBE(number, k) ORDER BY ALL;

EXPLAIN AST (INSERT INTO t SELECT 1) FORMAT TSV;

CREATE TABLE t_gb_dyn_block (a UInt32, b UInt32)
ENGINE = MergeTree ORDER BY b SETTINGS index_granularity = 128;

DROP TABLE t_s3 SETTINGS ignore_drop_queries_probability = 1;

DROP TABLE t_s3;

SET logsql_table = 'logs_05315';

ALTER TABLE t_map_lc UPDATE n = length(m.keys) + length(toString(m)) WHERE 1 SETTINGS mutations_sync = 2;

-- The spans of the three traces, labelled by the log_comment of their initiator query. The span log
-- is large on a busy server, so it is never on the build side of a join: the few trace ids are
-- collected first and the spans are then read with an IN filter, whatever the join settings are.
CREATE TEMPORARY TABLE traced_queries ENGINE = Memory AS
SELECT DISTINCT query_id, replaceOne(log_comment, 'otel worker spans: ', '') AS label
FROM system.query_log
WHERE current_database = currentDatabase() AND log_comment LIKE 'otel worker spans: %';

INSERT INTO r1 VALUES (0, 0, 0, 0);

SELECT count() FROM r2 WHERE i = 60 AND g = 4 SETTINGS optimize_use_projections = 1, force_optimize_projection_name = 'pr', enable_parallel_replicas = 0;

SELECT 'a NaN in y with a constant x is not a vertical line either';

-- The sorting key reads a subcolumn before the merge; the index reads it again from the merged rows.
CREATE TABLE t_coalescing_subcolumn
(
    id UInt64,
    stats Tuple(k Nullable(UInt64), m Map(String, UInt64)),
    INDEX im mapKeys(stats.m) TYPE bloom_filter GRANULARITY 1
)
ENGINE = CoalescingMergeTree ORDER BY (id, length(stats.m)) SETTINGS index_granularity = 100;

DROP TABLE t_summing_length;

SELECT groupArray(id) FROM (SELECT id FROM t_text_index_cache_bitpacking WHERE id < 128 AND hasAnyTokens(message, ['rare', 'missing']) ORDER BY id);

-- A dictionary definition in the AST JSON format is rejected when a key-value pair has no value: in the source or
-- in the layout parameters, at any depth of a bracketed list, and whether `second` is absent or null.

SET enable_json_ast_dialect = 1;

SELECT 'correlated subquery', (SELECT c0) FROM (SELECT 1::Bool) t0(c0) GROUP BY GROUPING SETS ((c0), ()) ORDER BY c0 NULLS LAST SETTINGS group_by_use_nulls = 1;

CREATE TABLE t_05316_s3 (key Int64) ENGINE = S3(s3_conn, filename = currentDatabase() || '/05316/c=1/key=9/data.orc', format = ORC);

INSERT INTO inner_t VALUES (10, 1), (20, 2);

SELECT sum(cityHash64(number, mortonEncode(toUInt8(h0)))) FROM v;

SELECT sum(cityHash64(number, mortonEncode((8, 1), toUInt32(h0), toUInt64(h1)))) FROM v;

SELECT '-- minmax';

SELECT id FROM tab WHERE CAST(s_ngram, 'LowCardinality(String)') LIKE '%ngram5%' SETTINGS force_data_skipping_indices = 'idx_ngram';

SELECT TRY_CAST('2020-01-02' AS DATE), TRY_CAST('not a date' AS DATE);

SELECT current_timezone() = timezone();

CREATE TEMPORARY TABLE tmp_05317_ttl (k UInt64);

ALTER TABLE t_reset_statistics MODIFY SETTING auto_statistics_types = DEFAULT;

SELECT count() FROM (SELECT 1 AS k) AS t1 FULL JOIN (SELECT k, 1 AS k) AS t2 ON t2.k > t1.k;

-- Named tuple element in the sorting key.
DROP TABLE IF EXISTS t_named;

SELECT 'projection', countIf(explain LIKE '%AggregatingProjection%') = 1, countIf(match(explain, 'Memory: bytes [1-9]')) = 1
FROM (EXPLAIN ANALYZE SELECT k, uniqExact(v) FROM t_agg_proj GROUP BY k
    SETTINGS optimize_use_projections = 1, force_optimize_projection = 1);

CREATE VIEW v_whatif_forced AS SELECT a, b, v FROM t_whatif_force_nested SETTINGS force_optimize_projection = 1;

SELECT 'typed paths only', type FROM system.parts_columns
WHERE database = currentDatabase() AND table = 't_json_lazy_non_hint' AND column = 'j' AND active ORDER BY name;

-- Download the data into the filesystem cache, so that the cache files are in the OS page cache.
SELECT count() FROM t_local_read_throttler_fs_cache WHERE NOT ignore(*)
SETTINGS enable_filesystem_cache = 1, read_from_filesystem_cache_if_exists_otherwise_bypass_cache = 0,
    min_bytes_to_use_direct_io = 0, use_uncompressed_cache = 0, use_page_cache_for_disks_without_file_cache = 0, use_columns_cache = 0;

SELECT mapEntries(map('a', 1, 'b', 2)) FORMAT TabSeparatedRaw;

SELECT count(x), countIf(x IS NULL), countIf(x IS NOT NULL), countIf(t.a IS NULL), countIf(isNull(v.String))
FROM t_05317_m SETTINGS optimize_functions_to_subcolumns = 0;

-- Lazily read rows, one in each 1000-row block of the last row group.
SELECT k, bp, rle, s, c, p FROM file(currentDatabase() || '_05317.parquet') ORDER BY k % 1000 DESC, k DESC LIMIT 10
SETTINGS query_plan_optimize_lazy_materialization = 1, query_plan_max_limit_for_lazy_materialization = 100,
    input_format_parquet_max_block_size = 1000, input_format_parquet_prefer_block_bytes = 0,
    input_format_parquet_filter_push_down = 0, input_format_parquet_bloom_filter_push_down = 0,
    input_format_parquet_dictionary_filter_push_down = 0, use_query_condition_cache = 0;

DROP ROW POLICY rp_proj_rls_alter ON t_proj_rls_alter;

-- Same query with the on-fly apply flags at their defaults: must also work and give the same result.
SELECT count()
FROM t_skip_index_alter_nullable
WHERE value = 300
SETTINGS use_skip_indexes = 1, use_skip_indexes_on_data_read = 0, optimize_use_projections = 1, optimize_use_implicit_projections = 1, use_statistics_for_part_pruning = 0, use_query_condition_cache = 0;

SELECT 'Float32', uniqExact(toFloat32(number)) FROM numbers_mt(1000000);

SELECT 'statistics set', uniqExact(number) FROM numbers_mt(400000) SETTINGS collect_hash_table_stats_during_aggregation = 1;

-- `hasAll` and `hasAny` on integer arrays, compared with a reference that checks each element of the second array with `has`.
-- Lengths cross the 16-element groups and 128-byte blocks of the vectorized search, small value ranges make both found
-- and missing values common, and nulls are placed in neither, either or both arrays, including a first array of only nulls.

DROP TABLE IF EXISTS arrays;

SELECT JSONRemove('[{"a":1}]', '$.a.b') FORMAT TSV;

SELECT JSONRemove('[1e309,2]', '$[0]') FORMAT TSV;

SELECT JSONRemove('{"a":[0,1,2]}', '$.a[1]', '$.a[1]') FORMAT TSV;

SELECT ['half', 'third'] AS tokens, 'any', count() FROM tab_bitpacking WHERE hasAnyTokens(text, ['half', 'third']);

SELECT ['half', 'rare'] AS tokens, 'all bruteforce', count() FROM tab_bitpacking WHERE hasAllTokens(text, ['half', 'rare']) SETTINGS text_index_postings_intersection_algorithm = 'bruteforce';

SELECT count() FROM tab_bitpacking WHERE hasAllTokens(text, ['half', 'third']) SETTINGS text_index_posting_list_apply_mode = 'materialize';

-- parts can have different projection histories, so the span covers each part in each of its own layouts
SET optimize_use_projections = 1, optimize_use_implicit_projections = 0, prefer_optimize_projection = 0, enable_parallel_replicas = 0, mutations_sync = 1;

DROP TABLE IF EXISTS inner_policy_t;

DROP TABLE IF EXISTS vectors;

SELECT * FROM t_clear_statistics_name_reuse;

-- The statements carrying a canary are logged with their values hidden, and no canary is logged.
SELECT
    countIf(position(query, 't_secret' || '_key') > 0 AND position(query, '[HIDDEN]') > 0) > 0,
    countIf(position(query, 'key_without_value' || '_canary') > 0 OR position(query, 'first_value' || '_canary') > 0
        OR position(query, 'extra_value' || '_canary') > 0 OR position(query, 'malformed' || '_canary') > 0),
    countIf(position(query, 'disk(equals(pass' || 'word, ') > 0 AND position(query, '[HIDDEN]') > 0) > 0,
    countIf(position(query, 'max_block' || '_size') > 0 AND position(query, '[HIDDEN]') > 0) > 0,
    countIf(position(query, 't_posit' || 'ional') > 0 AND position(query, '[HIDDEN]') > 0) > 0
FROM system.query_log
WHERE current_database = currentDatabase() AND event_date >= yesterday();

INSERT INTO t_big SELECT toString(number % 10), number FROM numbers(100000);

SELECT o.id, l.v FROM outer_t o
INNER JOIN LATERAL (SELECT v FROM inner_t WHERE inner_t.k = o.k ORDER BY v DESC OFFSET 1) AS l ON true
ORDER BY o.id, l.v;

SELECT replaceRegexpOne(explain, '^[ │├└─]*', '') FROM (EXPLAIN actions = 1 SELECT * FROM t_memory_top_k WHERE s LIKE '%7%' ORDER BY v DESC LIMIT 5) WHERE explain LIKE '%TopN filter%';

INSERT INTO t_memory_top_k (k, v, s, p, n, d) VALUES (100002, 1, 'a', 'b', 0, 5);

SELECT k, materialize(n.m.size1) FROM t_nested_add_wide ORDER BY k;

DROP TABLE t_nested_add_wide;

SELECT count() FROM t1_05320 AS x1 LEFT JOIN t3_05320 AS x2 ON x2.c2 >= toDateTime(x1.c3)
WHERE (x2.c4 = 1 AND x2.c1 IN (SELECT c1 FROM t4_05320)) OR x2.c4 = 3;

-- Positive control: without the setting the whole join still ships.
SELECT arrayStringConcat(groupArray(step), ' ')
FROM (
    SELECT trimLeft(explain) AS step
    FROM (
        EXPLAIN actions = 0, pretty = 0, optimize = 1, description = 0, header = 0
        SELECT count() FROM t_l ANY RIGHT JOIN t_r ON t_l.k = t_r.k
        SETTINGS enable_parallel_replicas = 1, max_parallel_replicas = 3, cluster_for_parallel_replicas = 'test_cluster_one_shard_three_replicas_localhost',
            parallel_replicas_for_non_replicated_merge_tree = 1, parallel_replicas_min_number_of_rows_per_replica = 0, parallel_replicas_plan_based = 1,
            parallel_replicas_local_plan = 1, any_join_distinct_right_table_keys = 0
    )
    WHERE step IN ('Aggregating', 'Union', 'Join', 'ReadFromMergeTree', 'ReadFromParallelReplicas')
);

INSERT INTO t_proj_unrelated_drop SELECT number, number % 100, number FROM numbers(100000);

SELECT * FROM prometheusQueryRange(ts, 'last_over_time(a[50s]) * on(dc) group_right(host) last_over_time(c[50s])', 100, 200, 100) ORDER BY ALL;

SELECT '-- series of the left side with values at the same step are duplicates even if the comparison keeps only one of them';

SELECT 'ifNull', count() FROM t_set_nullable_prune WHERE ifNull(c = 5, 1) SETTINGS use_skip_indexes = 0;

-- One part per insert: a merge right after the insert would race with the first query.
SET max_insert_threads = 1;

-- no-parallel-replicas: the test checks EXPLAIN of plans with reading steps replaced by prepared sources.

-- `sum`, `avg` and `sumCount` are answered from per-part `basic` statistics, and `count(column)` from the row counts,
-- with exactly the result of reading the data, also when the sums wrap around within a part and across parts.

SET optimize_use_projections = 1, optimize_use_implicit_projections = 1;

SELECT sum(i64), avg(u256), sumCount(d128) FROM t_sum;

SELECT countIf(explain LIKE '%_statistics_projection%') FROM (EXPLAIN SELECT sum(f) FROM t_sum);

-- Negation keeps the empty array the least, and a prefix less than its extension.
SELECT min(arr * -1), max(arr * -1) FROM t_aggregate_arithmetic_array;

SELECT avg(i + INTERVAL 1 DAY), avg(i - INTERVAL 1 DAY) FROM (SELECT toIntervalDay(number) AS i FROM numbers(2))
SETTINGS optimize_arithmetic_operations_in_aggregate_functions = 0;

-- `s` is about 2000 bytes per row, so the quota allows about 100 rows per block (rounded up to a granule),
-- far below `max_block_size`. A narrow column is needed after `PREWHERE`, the wide one is not.
SELECT max(blockSize()) < 2048, sum(k)
FROM t_prewhere_only_columns
PREWHERE s LIKE '%a%'
SETTINGS max_threads = 1, max_block_size = 8192, preferred_block_size_bytes = 200000, query_plan_remove_unused_columns = 1;

SYSTEM STOP MERGES t_column_ttl_stopped;

SELECT 'sparse_hashed', count(), sum(cityHash64(*)) FROM dict_sparse_hashed SETTINGS max_block_size = 7, max_threads = 4;

DROP DICTIONARY dict_range_hashed;

DROP TABLE IF EXISTS in_sub_mv_src;

-- Non-ASCII characters at every position of the 64-byte blocks of the ASCII scan, and in a stretch of more than 64 KiB.
SELECT sum(cityHash64(i, lowerUTF8(s))), sum(cityHash64(i, upperUTF8(s)))
FROM
(
    SELECT arrayJoin(arrayMap(i -> (i, if(i < 1000,
        concat(repeat('a', i % 150), 'É', repeat('b', i % 70), 'é', repeat('c', (i * 7) % 130)),
        concat('é', repeat('a', 10), 'é', repeat('a', 70000), 'É', 'x'))), range(1001))) AS t,
        t.1 AS i,
        t.2 AS s
);

SELECT sum(cityHash64(*)) FROM (SELECT * FROM t_memory_lazy_compressed WHERE v % 3 = 1 ORDER BY v DESC, k LIMIT 1000 SETTINGS query_plan_optimize_lazy_materialization = 0);

DROP TABLE IF EXISTS t_05321_a_int8;

SELECT countIf(explain LIKE '%DistinctSortedStreamTransform%'), countIf(explain LIKE '%ScatterByPartitionTransform%') > 0
FROM (EXPLAIN PIPELINE SELECT DISTINCT number % 1000 FROM numbers_mt(10000000));

-- Control: the same file read as UInt8 prunes pages.
select count() from file(currentDatabase() || '_05321_pg.parquet', Parquet, 'x UInt8') where x = 2
    settings log_comment = '05321page_u8', input_format_parquet_filter_push_down = 0,
             input_format_parquet_bloom_filter_push_down = 0, input_format_parquet_dictionary_filter_push_down = 0;

-- A `String` constant still fixes a `String` column.
SELECT extract(explain, 'Prefix sort description: .*') FROM (EXPLAIN actions = 1 SELECT k, s FROM t_rio_string WHERE s = 'V0' ORDER BY k, s DESC) WHERE explain LIKE '%Prefix sort description%';

DROP TABLE t_rio_string_first;

SELECT k, hex(s) FROM t_rio_fixed WHERE s = 'V0' ORDER BY k, s DESC;

DROP TABLE t_rio_wrapped;

CREATE TABLE t_rio_datetime64 (t DateTime64(9, 'UTC'), ts UInt32) ENGINE = MergeTree ORDER BY (t, ts);

SELECT ts FROM t_rio_datetime WHERE [toLowCardinality(d)] = [toLowCardinality(toDate32('2020-01-01'))] ORDER BY ts;

SELECT trimLeft(explain) FROM (EXPLAIN SELECT count() FROM tab_five_tokens WHERE hasAllTokens(text, ['every', 'half', 'third', 'seventh', 'burst'])) WHERE explain LIKE '%ReadFromTextIndexCount%';

ALTER TABLE t_real ADD PROJECTION p_b (SELECT a, b, v ORDER BY b);

SELECT count(), sum(length(s)) FROM t_memory_qcc WHERE x = 1 SETTINGS optimize_move_to_prewhere = 1;

SELECT '-- the results are the same without the cache';

SELECT pointInPolygon((0.1875, 0.0625), [(0.4375000000000002, 0.4999999999999999), (0.24999999999999994, 0.0), (1.0, 0.5625), (0.5624999999999997, 1.0), (0.0, 0.5625000000000002)]);

CREATE TABLE t_fixed_r1 (a UInt64, b UInt64, s String) ENGINE = ReplicatedMergeTree('/clickhouse/tables/{database}/05323/t', 'r1') ORDER BY a
    SETTINGS index_granularity = 100, index_granularity_bytes = 0, min_bytes_for_wide_part = 0, min_rows_for_wide_part = 0;

-- A LATERAL subquery is evaluated once per distinct value of the correlated columns, so reads that run
-- a script (the `executable` table function, `Executable` and `ExecutablePool` tables) are rejected,
-- like functions that are non-deterministic within a query.

SET allow_experimental_lateral_join = 1;

SELECT (a.n = b.n AND a.n > 2) AS r FROM t_shared_alias AS a JOIN t_shared_alias AS b ON r GROUP BY r ORDER BY r;

CREATE TABLE fuzz_query_t (q String) ENGINE = FuzzQuery('SELECT 1', 500, 1);

DROP TABLE t_many_aliases;

DROP DICTIONARY dict_null_first_sharded;

-- no-msan: DeltaLake is not built with MSan.

-- A key-value argument next to headers(...) must parse in either written order.
set describe_compact_output = 1;

INSERT INTO zero_shards_under_merge_local VALUES (7);

-- The row count cache ignores an entry registered in the same second the file was written.
SELECT sleep(1) FORMAT Null;

SELECT count(), any(old_path) FROM t_05325_iceberg;

SELECT 'IN results';

CREATE TABLE lazy_sort_build (id UInt64, k UInt64) ENGINE = MergeTree ORDER BY id;

-- The values of a `PREWHERE` filter column other than 0 and 1 mean that the row passes.
-- The `Memory` source must not record the granules of such rows as having no matches in the query condition cache.

SET use_query_condition_cache = 1;

INSERT INTO test SELECT number, -1 - number FROM numbers(10000);

-- `compatibility` up to 25.11 sets `query_plan_remove_unused_columns = 0`.
DROP TABLE IF EXISTS t_partial;

INSERT INTO t_part SELECT number FROM numbers(15);

SET query_plan_read_in_order_through_join = 1, max_bytes_ratio_before_external_join = 0, max_bytes_before_external_join = 0;

SELECT l.k, l.v FROM t_col AS l FINAL INNER JOIN r ON l.k = r.k ORDER BY l.k LIMIT 6;

INSERT INTO t_coal SELECT number, NULL, 'x' FROM numbers(100);

SELECT extract(explain, '(?:Prefix sort description|Read type|Virtual row conversions).*') AS e
FROM (EXPLAIN PLAN actions = 1, indexes = 0
    SELECT l.a FROM t_prefix AS l FINAL INNER JOIN r ON l.a = r.k ORDER BY l.a LIMIT 30) WHERE e != '';

ALTER TABLE t_rename_nested_dynamic RENAME COLUMN n.b TO n.z SETTINGS mutations_sync = 2;

SELECT '-- Tuple elements, horizontal merge with cleanup';

DETACH TABLE t_nested;

CREATE MATERIALIZED VIEW {CLICKHOUSE_DATABASE_1:Identifier}.mv_ts_5 ENGINE = TimeSeries AS SELECT 1 AS a FORMAT Null;

WITH
    (
        SELECT groupArray(trimBoth(explain)) FROM (
            EXPLAIN indexes = 1 SELECT count() FROM tab
            WHERE v1 = 100 OR v1 = 200 OR v1 = 300 OR v1 = 400 OR v1 = 500 OR v1 = 600 OR v1 = 700 OR v1 = 800 OR v1 = 900 OR v1 = 1000
               OR v1 = 1100 OR v1 = 1200 OR v1 = 1300 OR v1 = 1400 OR v1 = 1500 OR v1 = 1600 OR v1 = 1700 OR v1 = 1800 OR v1 = 1900 OR v1 = 2000
               OR v1 = 2100 OR v1 = 2200 OR v1 = 2300 OR v1 = 2400 OR v1 = 2500 OR v1 = 2600 OR v1 = 2700 OR v1 = 2800 OR v1 = 2900 OR v1 = 3000
               OR v1 = 3100 OR v1 = 3200 OR v1 = 3300 OR v1 = 3400 OR v1 = 3500 OR v1 = 3600 OR v1 = 3700 OR v1 = 3800 OR v1 = 3900 OR v1 = 4000
               OR v1 = 4100 OR v1 = 4200 OR v1 = 4300 OR v1 = 4400 OR v1 = 4500 OR v1 = 4600 OR v1 = 4700 OR v1 = 4800 OR v1 = 4900 OR v1 = 5000
               OR v1 = 5100 OR v1 = 5200 OR v1 = 5300 OR v1 = 5400 OR v1 = 5500 OR v1 = 5600 OR v1 = 5700 OR v1 = 5800 OR v1 = 5900 OR v1 = 6000
               OR v1 = 6100 OR v1 = 6200 OR v1 = 6300 OR v1 = 6400 OR v1 = 6500 OR v1 = 6600 OR v1 = 6700 OR v1 = 6800 OR v1 = 6900 OR v1 = 7000
               OR v1 = 7100 OR v1 = 7200 OR v1 = 7300 OR v1 = 7400 OR v1 = 7500 OR v1 = 7600 OR v1 = 7700 OR v1 = 7800 OR v1 = 7900 OR v1 = 8000
               OR v1 = 8100 OR v1 = 8200 OR v1 = 8300 OR v1 = 8400 OR v1 = 8500 OR v1 = 8600 OR v1 = 8700 OR v1 = 8800 OR v1 = 8900 OR v1 = 9000
               OR v1 = 9100 OR v1 = 9200 OR v1 = 9300 OR v1 = 9400 OR v1 = 9500 OR v1 = 9600 OR v1 = 9700 OR v1 = 9800 OR v1 = 9900 OR v1 = 10000
               OR v2 = 19900 OR v2 = 19800 OR v2 = 19700 OR v2 = 19600 OR v2 = 19500 OR v2 = 19400 OR v2 = 19300 OR v2 = 19200 OR v2 = 19100 OR v2 = 19000
               OR v2 = 18900 OR v2 = 18800 OR v2 = 18700 OR v2 = 18600 OR v2 = 18500 OR v2 = 18400 OR v2 = 18300 OR v2 = 18200 OR v2 = 18100 OR v2 = 18000
               OR v2 = 17900 OR v2 = 17800 OR v2 = 17700 OR v2 = 17600 OR v2 = 17500 OR v2 = 17400 OR v2 = 17300 OR v2 = 17200 OR v2 = 17100 OR v2 = 17000
               OR v2 = 16900 OR v2 = 16800 OR v2 = 16700 OR v2 = 16600 OR v2 = 16500 OR v2 = 16400 OR v2 = 16300 OR v2 = 16200 OR v2 = 16100 OR v2 = 16000
               OR v2 = 15900 OR v2 = 15800 OR v2 = 15700 OR v2 = 15600 OR v2 = 15500 OR v2 = 15400 OR v2 = 15300 OR v2 = 15200 OR v2 = 15100 OR v2 = 15000
               OR v2 = 14900 OR v2 = 14800 OR v2 = 14700 OR v2 = 14600 OR v2 = 14500 OR v2 = 14400 OR v2 = 14300 OR v2 = 14200 OR v2 = 14100 OR v2 = 14000
               OR v2 = 13900 OR v2 = 13800 OR v2 = 13700 OR v2 = 13600 OR v2 = 13500 OR v2 = 13400 OR v2 = 13300 OR v2 = 13200 OR v2 = 13100 OR v2 = 13000
               OR v2 = 12900 OR v2 = 12800 OR v2 = 12700 OR v2 = 12600 OR v2 = 12500 OR v2 = 12400 OR v2 = 12300 OR v2 = 12200 OR v2 = 12100 OR v2 = 12000
               OR v2 = 11900 OR v2 = 11800 OR v2 = 11700 OR v2 = 11600 OR v2 = 11500 OR v2 = 11400 OR v2 = 11300 OR v2 = 11200 OR v2 = 11100 OR v2 = 11000
               OR v2 = 10900 OR v2 = 10800 OR v2 = 10700 OR v2 = 10600 OR v2 = 10500 OR v2 = 10400 OR v2 = 10300 OR v2 = 10200 OR v2 = 10100 OR v2 = 10000
        )
    ) AS lines,
    indexOf(lines, 'Name: <Combined skip indexes>') AS pos
SELECT lines[pos], lines[pos + 3];

-- Without the count optimizations the read itself filters the parts.
SELECT
    (SELECT count() FROM tbl WHERE _partition_value > toNullable((toDate('2021-04-01'), NULL, NULL))),
    (SELECT count() FROM tbl WHERE NOT (_partition_value > toNullable((toDate('2021-04-01'), NULL, NULL)))),
    (SELECT count() FROM tbl WHERE isNull(_partition_value > toNullable((toDate('2021-04-01'), NULL, NULL))))
SETTINGS optimize_use_implicit_projections = 0, optimize_trivial_count_query = 0;

SELECT * FROM c_vertical ORDER BY key;

INSERT INTO c_materialized (key, s) SETTINGS optimize_on_insert = 0 VALUES (1, 1), (1, -1);

-- Reproducer from https://github.com/ClickHouse/ClickHouse/issues/123363:
-- `use_skip_indexes = 0` must not disable the part-level min-max index on the partition-key columns.

SET enable_parallel_replicas = 0, use_query_condition_cache = 0;

DROP ROW POLICY p_string_filter_applicability ON t_string_filter_applicability;

SELECT 't-test finite', round(studentTTest(x, g).2, 6) FROM VALUES('x Float64, g UInt8', (1, 0), (2, 0), (3, 0), (4, 1), (5, 1), (6, 1));

-- `query_plan_join_shard_by_pk_ranges` splits both sides by ranges of the primary key and joins
-- each range with its own serial table, one per thread. It applies only to a bare `HashJoin`, so it
-- needs the runtime filters and the spilling threshold that are disabled above.
CREATE TABLE sl (a UInt64) ENGINE = MergeTree ORDER BY a SETTINGS index_granularity = 128;

SELECT 'range: histogram_quantile(0.5, clamp(up, 1, -1)) or vector(7)';

CREATE TABLE t_right (id UInt64, r_time DateTime64(6, 'UTC')) ENGINE = MergeTree ORDER BY r_time;

SELECT 'preserved side is a join';

SELECT 'key without columns under a lambda';

SELECT 'global right join swapped to left';

DROP TABLE IF EXISTS t_i64;

SELECT 'Float32 -> Float64', k FROM t_f64 WHERE k IN (SELECT CAST(1, 'Float32')) ORDER BY k;

SELECT a FROM t_decimal_overflow_key WHERE a < 2 AND a + toDecimal32(1, 0) BETWEEN 1 AND 3 ORDER BY a;

SELECT 'B9', count(), sum(cityHash64(c)), countIf(aes_decrypt_mysql('aes-128-ecb', c, k) = p)
FROM
(
    SELECT repeat('z', number % 33) AS p, substring(concat(toString(intDiv(number, 3)), repeat('q', 24)), 1, 24) AS k,
        aes_encrypt_mysql('aes-128-ecb', p, k) AS c
    FROM numbers(5000)
);

SELECT geometryIntersectSpherical(CAST('[[], [(5., 5.), (6., 6.)]]', 'MultiLineString'), CAST('[[(0., 0.), (0., 2.), (2., 2.), (2., 0.)]]', 'Polygon'));

SELECT ipcryptPrefixEncrypt(toIPv4('192.168.1.1'), '00112233445566778899aabbccddeeffffeeddccbbaa99887766554433221100') FORMAT Null;

INSERT INTO anti_right VALUES ('k1', 10), ('k1', 20), ('k2', 30);

SELECT 'all_right_nullable', count() FROM all_right_nullable SETTINGS optimize_trivial_count_query = 1;

INSERT INTO t_lwu_rename VALUES (1, 1), (2, 2);

CREATE TABLE t_lwu_rename_merge (x UInt32, v UInt32)
ENGINE = ReplicatedMergeTree('/clickhouse/tables/{database}/t_lwu_rename_merge', '1') ORDER BY tuple()
SETTINGS enable_block_number_column = 1, enable_block_offset_column = 1, apply_patches_on_merge = 0, max_replicated_mutations_in_queue = 0, merge_selecting_sleep_ms = 100, max_merge_selecting_sleep_ms = 200;

CREATE TABLE t_lwu_rename_stale (x UInt32, v UInt32)
ENGINE = ReplicatedMergeTree('/clickhouse/tables/{database}/t_lwu_rename_stale', '1') ORDER BY tuple()
SETTINGS enable_block_number_column = 1, enable_block_offset_column = 1, apply_patches_on_merge = 0, max_replicated_mutations_in_queue = 0, merge_selecting_sleep_ms = 100, max_merge_selecting_sleep_ms = 200;

INSERT INTO t_map_enum_neg_keys_bf VALUES (1, map('x', 'a')), (2, map('k', 'a')), (3, map('k', 'm'));

DROP TABLE t_memory_qcc_prewhere_after_where;

select any(toUInt8(x)), countIf(x = true), countIf(x in (true)), countIf(x) from file(currentDatabase() || '_05331_plain.parquet', Parquet, 'x Bool')
    settings input_format_parquet_filter_push_down = 0, input_format_parquet_page_filter_push_down = 0,
             input_format_parquet_bloom_filter_push_down = 0, input_format_parquet_dictionary_filter_push_down = 0;

SET optimize_min_max_from_files = 1;

SELECT minIf(i, s > 0), max(i) FROM file(currentDatabase() || '_05331_1.parquet') SETTINGS log_comment = '05331-min_if';

SELECT 'F', count(), sum(cityHash64(k, f)) = (SELECT sum(cityHash64(k, f)) FROM ref WHERE f != toFixedString('a', 16))
FROM file(currentDatabase() || '_05331_a.parquet') PREWHERE f != toFixedString('a', 16) SETTINGS log_comment = '05331:f';

SELECT 'every row';

SELECT 'two steps, the second passes every row';

WITH char(0xCF, 0xB4) AS h, 'θ' AS n SELECT 'theta symbol vs theta', positionCaseInsensitiveUTF8(h, n), positionCaseInsensitiveUTF8(materialize(h), n), positionCaseInsensitiveUTF8(materialize(h), materialize(n)), positionCaseInsensitiveUTF8(h, materialize(n));

WITH concat(char(0xE2, 0x84, 0xAA), char(0xE2, 0x84, 0xAA), char(0xE2, 0x84, 0xAA)) AS h, char(0xE2, 0x84, 0xAA) AS n SELECT 'kelvin from 2', countSubstringsCaseInsensitiveUTF8(h, n, 2), countSubstringsCaseInsensitiveUTF8(materialize(h), n, 2), countSubstringsCaseInsensitiveUTF8(materialize(h), materialize(n), 2), countSubstringsCaseInsensitiveUTF8(h, materialize(n), 2), countSubstringsCaseInsensitiveUTF8(materialize(h), n, materialize(2)), countSubstringsCaseInsensitiveUTF8(materialize(h), materialize(n), materialize(2)), countSubstringsCaseInsensitiveUTF8(h, materialize(n), materialize(2));

SELECT [positionCaseInsensitiveUTF8(concat('a', char(0xE2, 0x84, 0xAA), repeat('x', 0)), 'ak'), positionCaseInsensitiveUTF8(concat('a', char(0xE2, 0x84, 0xAA), repeat('x', 15)), 'ak'), positionCaseInsensitiveUTF8(concat('a', char(0xE2, 0x84, 0xAA), repeat('x', 16)), 'ak'), positionCaseInsensitiveUTF8(concat('a', char(0xE2, 0x84, 0xAA), repeat('x', 31)), 'ak'), positionCaseInsensitiveUTF8(concat('a', char(0xE2, 0x84, 0xAA), repeat('x', 32)), 'ak'), positionCaseInsensitiveUTF8(concat('a', char(0xE2, 0x84, 0xAA), repeat('x', 64)), 'ak'), positionCaseInsensitiveUTF8(concat('a', char(0xE2, 0x84, 0xAA), repeat('x', 100)), 'ak')];

SELECT
    arrayMap(x -> x.2, arraySort(groupArray((id, positionCaseInsensitiveUTF8(s, 'Ⱥb'))))),
    arrayMap(x -> x.2, arraySort(groupArray((id, positionCaseInsensitiveUTF8(s, 'straße'))))),
    arrayMap(x -> x.2, arraySort(groupArray((id, positionCaseInsensitiveUTF8(s, concat(char(0xE2, 0x84, 0xAA), 'zz')))))),
    arrayMap(x -> x.2, arraySort(groupArray((id, positionCaseInsensitiveUTF8(s, 'kzz')))))
FROM tab
SETTINGS max_block_size = 65536;

SELECT
    sum(('a' ILIKE concat('%', s, '%')) != (materialize('a') ILIKE concat('%', s, '%'))) +
    sum((char(0xE2, 0x84, 0xAA) ILIKE concat('%', s, '%')) != (materialize(char(0xE2, 0x84, 0xAA)) ILIKE concat('%', s, '%'))) +
    sum(('ẞ' ILIKE concat('%', s, '%')) != (materialize('ẞ') ILIKE concat('%', s, '%'))) +
    sum(('ⱥȺ' ILIKE concat('%', s, '%')) != (materialize('ⱥȺ') ILIKE concat('%', s, '%'))) +
    sum((concat('k', char(0xE2, 0x84, 0xAA)) ILIKE concat('%', s, '%')) != (materialize(concat('k', char(0xE2, 0x84, 0xAA))) ILIKE concat('%', s, '%'))) +
    sum((char(0xCE, 0xBC) ILIKE concat('%', s, '%')) != (materialize(char(0xCE, 0xBC)) ILIKE concat('%', s, '%')))
FROM needles;

SELECT value FROM prometheusQuery(ts, 'hour(vector(-Inf))', 0);

-- `WITH TOTALS` of a subquery on the right of `IN` must be ignored when `rewrite_in_to_join`
-- rewrites the `IN` into a correlated `EXISTS`, as it is by the regular `IN` set.

SET allow_correlated_subqueries = 1;

DROP VIEW IF EXISTS v_05331;

SELECT count() FROM t_skip_or0 WHERE e < 'c' AND (toString(id) != '5' OR 0)
SETTINGS use_skip_indexes = 1, use_skip_indexes_for_disjunctions = 1;

-- 'alpha' must span several compressed posting blocks, so that it is left to the lazy cursors.
SELECT token, num_posting_blocks > 1, has_compressed_postings FROM mergeTreeTextIndex(currentDatabase(), tab_failed_search, idx) WHERE token = 'alpha';

DROP TABLE IF EXISTS t_merge_filter_bad_view;

DROP TABLE t_merge_filter_a;

ATTACH TABLE v_apply;

-- The `collect` and `rejected` runs must select the same granules, but the query condition cache is server-wide and a parallel
-- test can clear it between them (dropping a table of an `Ordinary` database clears every cache), which looks like drift.
SET use_query_condition_cache = 0;

-- Force two-level states, the shape the bucket-local Top-K conversion serves.
SET max_threads = 4;

SELECT count(), sum(n) FROM t_moved;

-- Explicitly disabling `PREWHERE` in the subquery must still be respected.
CREATE TABLE mutation_set_control AS mutation_set_target;

DROP SETTINGS PROFILE profile_05332_stable_seed;

WITH 'xxⱥ' AS h, 'Ⱥ' AS n SELECT 'a-bar at end', startsWithCaseInsensitiveUTF8(h, n), startsWithCaseInsensitiveUTF8(materialize(h), n), startsWithCaseInsensitiveUTF8(materialize(h), materialize(n)), startsWithCaseInsensitiveUTF8(h, materialize(n)), positionCaseInsensitiveUTF8(h, n) = 1;

WITH 'abc' AS h, '' AS n SELECT 'empty needle', endsWithCaseInsensitiveUTF8(h, n), endsWithCaseInsensitiveUTF8(materialize(h), n), endsWithCaseInsensitiveUTF8(materialize(h), materialize(n)), endsWithCaseInsensitiveUTF8(h, materialize(n));

-- Grouping by a high-cardinality key into many aggregates makes the output several times the read, so a single
-- node wins and the model declines.
--
-- First execution: nothing is remembered, so the plan with parallel replicas is built to find the boundary.
SELECT id, sum(v), sum(v + 1), sum(v + 2), sum(v + 3), sum(v + 4), sum(v + 5), sum(v + 6), sum(v + 7)
FROM t_boundary_key GROUP BY id FORMAT Null SETTINGS log_comment = 'boundary_key_1_collects';

CREATE TABLE t_bf_padded_aj
(
    tags Array(String),
    INDEX idx_padded emptyArrayToSingle(tags) TYPE bloom_filter GRANULARITY 1
)
ENGINE = MergeTree ORDER BY tuple()
SETTINGS index_granularity = 1;

INSERT INTO mutation_set_expressions
SELECT number, number + 10, number + 100, if(number = 1, NULL, number) FROM numbers(4);

ALTER TABLE mutation_cte_target UPDATE v = k IN
(
    SELECT l.k FROM mutation_cte_keys AS l ALL INNER JOIN mutation_cte_rhs AS r
    ON l.k = r.k AND r.k IN (SELECT number FROM numbers(1, 2))
)
WHERE 1;

SELECT max(blockSize()) <= 9, count() FROM t_l JOIN t_r ON t_l.k = t_r.k
SETTINGS join_algorithm = 'grace_hash', max_joined_block_size_rows = 9;

SELECT '-- a String constant parsed into the stored type';

SELECT 'signed zero', count(), (SELECT count() FROM t_float WHERE d = 0.0 SETTINGS use_primary_key = 0) FROM t_float WHERE d = 0.0;

SELECT 'numeric DESC';

-- the subquery sleeps 1 ms for each of its 50 rows, so each run adds 50000 microseconds
SELECT count() FROM (EXPLAIN WHATIF SELECT a, b, v FROM t_facts WHERE a < 2000 AND b IN (SELECT k FROM t_keys WHERE sleepEachRow(0.001) = 0))
SETTINGS log_comment = '05338_in_subquery_runs_once' FORMAT Null;

SELECT countIf(explain ILIKE '%Type: INNER%'), countIf(explain ILIKE '%Type: LEFT%'), countIf(explain ILIKE '%Type: RIGHT%')
FROM (EXPLAIN actions = 1 SELECT * FROM v2);

SELECT c FROM t_not_physical;

ALTER TABLE t_nested ADD INDEX ia a TYPE minmax;

CREATE TABLE t_projection_folded_constants (a UInt64, b String, c Nullable(String))
ENGINE = MergeTree ORDER BY a SETTINGS index_granularity = 4, materialize_projections_on_insert = 1;

SELECT * FROM prometheusQueryRange(ts, 'last_over_time(vector(1)[1500ms:3s]) + 1', 1000, 1020, 5);

DROP TABLE IF EXISTS t_string_filter_position;

-- no-parallel-replicas: the assertions below read query_log and EXPLAIN of the initiator query.
-- Tests that a text index answers multiSearchAny, multiSearchAnyUTF8 and multiSearchAnyCaseInsensitive[UTF8] with one
-- needle as LIKE '%needle%' (ILIKE), for a needle inside one token such as 'PointerExc', and that the rows do not change.
-- Calls with several needles keep reading the column. Every query is compared with use_skip_indexes = 0.

SET use_skip_indexes = 1;

SELECT 'no needles, no index', groupArray(id) FROM tab WHERE multiSearchAnyCaseInsensitive(msg, CAST([], 'Array(String)')) SETTINGS use_skip_indexes = 0;

SELECT 'multiSearchAnyCaseInsensitiveUTF8', countIf(explain LIKE '%\_\_text\_index\_%') > 0, countIf(explain LIKE '%FUNCTION multiSearchAnyCaseInsensitiveUTF8(%') > 0
FROM (EXPLAIN actions = 1 SELECT count() FROM tab WHERE multiSearchAnyCaseInsensitiveUTF8(msg, ['OUTOFMEMORY']));

SELECT 'array, multiSearchAny', countIf(explain LIKE '%\_\_text\_index\_%') > 0, countIf(explain LIKE '%FUNCTION multiSearchAny(%') > 0
FROM (EXPLAIN actions = 1 SELECT count() FROM tab_array WHERE multiSearchAny(name, ['aa%bb']));

ALTER TABLE t_alter_default_nullable ADD COLUMN k_null Int32 NULL;

DROP TABLE t_modify_state_version;

SELECT count() FROM t_sample_left AS l SAMPLE 1/2 JOIN t_sample_right AS r ON l.k = r.k;

SELECT count() FROM (SELECT k FROM remote('127.0.0.{1,2}', currentDatabase(), t_sample_left) SAMPLE 1/2) AS l FULL JOIN t_no_sampling_key AS n ON l.k = n.k;

SELECT o.v FROM t_corr_whole_filter AS o WHERE (SELECT sum(i.v) > 4 FROM t_corr_whole_filter AS i WHERE i.k = o.k) ORDER BY o.v;

SELECT '-- X = 2^98 + 1, X * 10^30 wraps to 10^30';

SELECT count() FROM t_05339 WHERE d IN (toDecimal128(1000000000, 0));

SELECT materialize(toDecimal32(2, 0)) = toDecimal32(2, 9), materialize(toDecimal32(-2, 0)) = toDecimal32(-2, 9);

INSERT INTO set_t VALUES (1);

-- The `Output` line of a fragment shows what its send step sends.
SELECT '-- pretty';

SELECT * FROM num_1 AS l INNER JOIN (SELECT num_2.key, value FROM num_2 INNER JOIN numbers(10000) AS nn ON num_2.key = nn.number) AS r ON l.key = r.key ORDER BY l.key LIMIT 5;

-- `ifNull`: a correlated `count()` over no rows returns NULL, https://github.com/ClickHouse/ClickHouse/issues/111615
CREATE MATERIALIZED VIEW mv_correlated TO dst AS
    SELECT 'correlated' AS name, s.k AS k,
        (SELECT count() FROM src AS t WHERE t.k = s.k) AS c_self,
        ifNull((SELECT count() FROM src AS t WHERE t.k = s.k - 1), 0) AS c_prev
    FROM src AS s;

SELECT countIf(n.null), count() FROM file(currentDatabase() || '_05339.parquet') PREWHERE n > 5 OR number < 3;

CREATE TABLE t_tuple (id UInt64, t Tuple(kind String, payload String)) ENGINE = MergeTree ORDER BY id
SETTINGS min_bytes_for_wide_part = 0, min_rows_for_wide_part = 0;

-- A mutation that rewrites only some columns of a Wide part keeps the lightweight-deleted rows in it,
-- and a projection it rebuilds must still leave them out.

SET mutations_sync = 2, lightweight_deletes_sync = 2;

INSERT INTO t_upd_compact SELECT number, number % 7, number FROM numbers(10);

DROP TABLE t_upd_compact;

SELECT sum(k) FROM t_qrc_local_no_read_dist SETTINGS make_distributed_plan = 1, log_comment = '05339_local_fragment_no_read';

CREATE TABLE t_read_in_order_single_in_decimal (d Decimal(38, 18), ts UInt32) ENGINE = MergeTree ORDER BY (d, ts);

-- The holder has to go before `q_block`, so that the replicated table removes its own Keeper
-- path while the queue path it lives under still exists.
DROP TABLE q_block_holder;

SELECT count() FROM t_summing_final_zero FINAL;

CREATE TABLE t_daily64 (dt DateTime64(3, 'America/New_York')) ENGINE = MergeTree ORDER BY dt SETTINGS index_granularity = 8192, index_granularity_bytes = '10Mi';

INSERT INTO t_nullable SELECT toDateTime('2024-11-02 00:00:00', 'UTC') + number * 900 FROM numbers(300);

DROP TABLE t_skip_nullable;

SELECT 'collected across streams skips marks';

DROP TABLE t_streams;

DROP TABLE IF EXISTS t_ny_key;

INSERT INTO t_lord_howe VALUES (toDateTime('2024-04-06 15:20:00', 'UTC')), (toDateTime('2024-04-06 15:40:00', 'UTC'));

DROP TABLE t_ny64;

SELECT count() > 0 FROM (EXPLAIN actions = 1 SELECT id FROM t_map_bucketed WHERE m['k'] > 7) WHERE explain LIKE '%m.key_k%';

DROP TABLE t_map_merge;

SELECT s, c FROM view(SELECT s, c FROM remote('127.0.0.{1,2}', currentDatabase(), v_pos) ORDER BY s)
SETTINGS prefer_localhost_replica = 1, enable_positional_arguments = 1, analyzer_inline_views = 1;

CREATE TABLE t_pos_buffer_dist AS t_pos_buffer_src ENGINE = Distributed(test_shard_localhost, currentDatabase(), t_pos_buffer_src);

SET enable_parallel_blocks_marshalling = 1, prefer_localhost_replica = 0, max_threads = 3;

DROP TABLE tab_pre;

SELECT '-- Variant(UInt64, String)';

SELECT id FROM tab_map WHERE hasToken(toString(toUInt64(m['status'])), '404') ORDER BY id;

-- Floating-point divisions keep the same aggregate rewrites with either setting value.
SET sql_compatible_division_for_integers = 0;

SELECT groupArray(toString(x / toUInt8('128'))) FROM values('x Int8', ('-128'), ('-1'), ('0'), ('127'));

-- Redefine the index without phrase search while the part is detached, so neither `DROP INDEX` nor the new definition touch it.
ALTER TABLE tab DETACH PARTITION tuple();

-- Metadata written with the setting off has exactly the legacy spelling.
CREATE TABLE division_legacy_metadata
(
    x Int64,
    d Float64 DEFAULT x / 2,
    m Float64 MATERIALIZED divide(x, 2),
    k Float64 ALIAS x / 2,
    CONSTRAINT positive CHECK x / 2 != intDiv(x, 2),
    INDEX division_idx (x / 2) TYPE minmax GRANULARITY 1,
    PROJECTION division_projection (SELECT x / 2, count() GROUP BY x / 2)
)
ENGINE = MergeTree PARTITION BY x / 2 ORDER BY x / 2
SETTINGS allow_floating_point_partition_key = 1;

SELECT '-- LowCardinality values, which keep their type';

SELECT * FROM division_legacy_view ORDER BY 1;

DROP TABLE division_mv_exact;

SELECT 'full', (SELECT sum(cityHash64(tuple(*))) FROM left l FULL JOIN right r ON l.k = r.k SETTINGS enable_hash_join_row_store = 1)
    = (SELECT sum(cityHash64(tuple(*))) FROM left l FULL JOIN right r ON l.k = r.k SETTINGS enable_hash_join_row_store = 0)
SETTINGS log_comment = 'rs_full';

INSERT INTO child_05345 VALUES (1), (2), (3);

CREATE TABLE merge_scalar_05345 (x UInt64) ENGINE = Merge(currentDatabase(), '^child_scalar_05345$');

SELECT '-- LEFT JOIN ON 1';

DROP TABLE t_left_aj;

DROP TABLE t_nullable_string_key;

SELECT uniqExact(number) FROM numbers(9000000);

-- Pending patches of columns that the text index does not depend on disable the direct read only in the patched parts.

SET enable_lightweight_update = 1;

-- `enable_parallel_replicas = 0`: with parallel replicas another replica may do the read,
-- and its `ProfileEvents` never reach this query's `query_log` row.
SELECT count(), sum(id) FROM tab PREWHERE flag = 1 AND hasToken(s, 'third') SETTINGS enable_parallel_replicas = 0, log_comment = 'read_order_flag_first';

INSERT INTO t_prewhere SELECT number, repeat('x', 1000) FROM numbers(262144);

SELECT 5 / 2, (SELECT 5 / 2 SETTINGS sql_compatible_division_for_integers = DEFAULT), 7 / 2;

ALTER TABLE t_real ADD PROJECTION p (SELECT a, b, v WHERE v % 10 = 0 ORDER BY b);

CREATE TABLE d_real AS d_est;

SELECT l.k, l.heavy, y.mheavy FROM l JOIN (SELECT b.k AS k, m.mheavy AS mheavy FROM (SELECT k, k FROM r) AS b JOIN m ON b.k = m.k) AS y ON l.k = y.k
ORDER BY l.k DESC LIMIT 5 SETTINGS query_plan_lazy_materialization_for_join = 0;

SELECT count() > 0 FROM (EXPLAIN actions = 1 WITH if(s LIKE '%a%' OR s LIKE '%b%' OR s LIKE '%c%' OR s LIKE '%1%', s, 'z') AS h SELECT (h LIKE '%a%' OR h LIKE '%b%' OR h LIKE '%c%' OR h LIKE '%1%') AS r, count() FROM t_or_like_shared WHERE h != '' GROUP BY r) WHERE explain LIKE '%multiSearchAny(if((multiSearchAny(%) AND indexHint(), %) AND indexHint()%';

SELECT count() FROM t_string_filter_long_bulk_other PREWHERE s LIKE '%xa%z%'
SETTINGS apply_string_filters_during_scan = 1, enable_parallel_replicas = 0, max_threads = 1, log_comment = '05346_few_candidates';

CREATE TABLE t1 (a Nullable(Int64)) ENGINE = MergeTree ORDER BY tuple() SETTINGS auto_statistics_types = '';

SELECT f.v, d.dheavy FROM rp2_f AS f FINAL JOIN rp2_d AS d ON f.k = d.k ORDER BY d.b, d.k LIMIT 5;

CREATE TABLE t_tuple_elim (s Nullable(String), n UInt64) ENGINE = MergeTree ORDER BY n;

SELECT n FROM t_tuple_elim WHERE (n, arrayJoin([1]), 1) = (4, 1, 2) SETTINGS force_primary_key = 1;

DROP TABLE IF EXISTS t05352_mrg_dst;

SELECT k, v, w FROM t05352_mt_buf PREWHERE v AND w ORDER BY k;

DROP TABLE t05352_mrg_buf;

DROP TABLE 05353_dst;

SELECT 'policy, x and s', x, s FROM m;

-- Blocks that arrive after `output_format_pretty_max_rows` is reached are not rendered, but are counted in the footer.
SET output_format_pretty_squash_consecutive_ms = 0;

DROP TABLE IF EXISTS t_no_constraint;

DETACH TABLE readonly_src;

SELECT j FROM t_topk_runtime_typed ORDER BY j LIMIT 3;

CREATE TABLE t_dist_b AS t_b ENGINE = Distributed(test_shard_localhost, currentDatabase(), t_b);

-- Otherwise the memory-efficient merging drops `bucket_top_k` before the memory-bound merging is applied.
SET distributed_aggregation_memory_efficient = 0;

INSERT INTO src_v4 VALUES ('10.0.0.0/8', 'AA'), ('202.79.32.0/20', 'NP'), ('202.79.32.0/24', 'NQ');

DELETE FROM t_lwu_cte_teardown WHERE ignore(id IN (WITH c AS MATERIALIZED (SELECT number * 2 AS x FROM numbers(3)) SELECT a.x FROM c AS a, c AS b GROUP BY a.x OFFSET 0.5));

SELECT 'ties', a = b, length(a) FROM (SELECT
    (SELECT groupArray(tuple(t)) FROM (SELECT t FROM t_topk_ties ORDER BY t LIMIT 1000)) AS a,
    (SELECT groupArray(tuple(t)) FROM (SELECT t FROM t_topk_ties ORDER BY t LIMIT 1000) SETTINGS use_top_k_dynamic_filtering = 0, use_query_condition_cache = 0) AS b);

-- A read that dropped the rows equal to the threshold records nothing, so a rerun selects the same rows. A read that
-- kept them records its empty granules, so a rerun selects fewer rows. Each pair has its own key (`LIMIT`).
SELECT s FROM t_topk_ties ORDER BY s LIMIT 25 FORMAT Null
SETTINGS use_query_condition_cache = 1, max_threads = 1, max_block_size = 64, query_plan_optimize_lazy_materialization = 0,
    enable_parallel_replicas = 0, automatic_parallel_replicas_mode = 0, serialize_query_plan = 0, log_comment = '05355_q1_run1';

SELECT 'group by dominating smallest key', a = b, a FROM (SELECT
    (SELECT groupArray((k, c, sv)) FROM (SELECT k, count() AS c, sum(v) AS sv FROM t_gb_topk_dominant GROUP BY k ORDER BY k LIMIT 1)
        SETTINGS max_threads = 1, max_block_size = 128, use_query_condition_cache = 0, serialize_query_plan = 0, enable_parallel_replicas = 0,
            automatic_parallel_replicas_mode = 0, max_rows_to_group_by = 0, enable_group_by_top_k_optimization = 1,
            enable_group_by_top_k_dynamic_filtering = 1, optimize_aggregation_in_order = 0, optimize_trivial_group_by_limit_query = 0) AS a,
    (SELECT groupArray((k, c, sv)) FROM (SELECT k, count() AS c, sum(v) AS sv FROM t_gb_topk_dominant GROUP BY k ORDER BY k LIMIT 1)
        SETTINGS enable_group_by_top_k_optimization = 0, use_query_condition_cache = 0) AS b);

SELECT
    id,
    JSONExtractKeysAndValuesRaw(j),
    JSONExtractKeysAndValues(j, 'String'),
    JSONExtractKeys(j),
    JSONExtractArrayRaw(j),
    JSONExtract(j, 'Array(Int64)')
FROM t_json_nullable ORDER BY id;

INSERT INTO FUNCTION file({CLICKHOUSE_DATABASE:String} || '_hive/_idx=6/f.csv', CSV, 'x UInt8') SETTINGS use_hive_partitioning = 0 SELECT 2;

-- 0x07 object_id
SELECT a, z FROM format(BSONEachRow, 'a Int32, z String', x'2c0000001061002a0000000775000102030405060708090a0b0c027a000a0000006f626a6563745f69640000');

-- Hexadecimal floats keep the fraction point, the binary exponent marker and its sign.
SELECT match(obfuscateQueryWithSeed('SELECT 0x1.8p+3', 1), '^SELECT 0x[0-9A-F]\\.[0-9A-F]p\\+[0-9]$') AS hex_float_plus_exponent,
       match(obfuscateQueryWithSeed('SELECT 0xA.Bp-12', 1), '^SELECT 0x[0-9A-F]\\.[0-9A-F]p-[0-9]{2}$') AS hex_float_minus_exponent;

SELECT count() FROM tab WHERE NOT hasPhrase(val, 'the');

-- Higher-order array functions accept lambdas returning `LowCardinality` results,
-- and the result type does not keep `LowCardinality`, because execution materializes it.

SELECT arrayFilter(x -> toLowCardinality(toUInt8(x > 1)), [1, 2, 3]) AS r, toTypeName(r);

INSERT INTO t_remember_boundary_off SELECT number, number FROM numbers(300000);

-- A `NULL` seed keeps the structure random; the sizes of strings and arrays are bounded.
CREATE TABLE t_inferred AS generateRandom(NULL, 10, 2);

SELECT 'inner, parallel_hash_join_threshold = 0';

SELECT replaceRegexpOne(explain, '^[ │├└─]*', '') FROM (EXPLAIN actions = 1 SELECT x, y, z, payload, other FROM t_memory_lazy_default ORDER BY x LIMIT 5) WHERE explain LIKE '%Lazily read columns%';

SET prefer_localhost_replica = 0, serialize_query_plan = 0, automatic_parallel_replicas_mode = 0;

SELECT 'the drop is pending', count() > 0 FROM system.mutations
WHERE database = currentDatabase() AND table = 't_text_index_drop' AND NOT is_done;

SELECT d_d FROM t_interval ORDER BY d_d DESC LIMIT 3;

CREATE TABLE t_interval_memory (d IntervalSecond) ENGINE = Memory;

SELECT UUIDv7ToDateTime(toUUID('018f05c9-4ab8-7b86-b64e-c9f03fbd45d1'), toFixedString('UTC', 3));

SELECT 'limit by', id, a FROM merge(currentDatabase(), '^t_(dist_a|b)$') ORDER BY id LIMIT 1 BY a SETTINGS prefer_localhost_replica = 0;

INSERT INTO t_sequence_next_node VALUES ('2000-01-02 09:00:04',4,'B');

CREATE TABLE t_keyless_owning_state (id UInt64, v UInt64) ENGINE = MergeTree ORDER BY id;

ALTER TABLE t_stale_block_mutation UPDATE two_values = (two_values.1, two_values.2 + 1) WHERE 1 SETTINGS mutations_sync = 2;

-- With `join_use_nulls = 0` the unmatched row of `t_a` gets `t_b.k = 0`, which matches `t_c.bk = 0`.
SELECT '-- LEFT JOIN';

SELECT if(explain ILIKE '%.t1)%', 't1', 't2') FROM (EXPLAIN SELECT count() FROM t1 LEFT JOIN t2 ON t1.k = t2.k WHERE t2.j.f = false) WHERE explain ILIKE '%ReadFromMergeTree%';

-- Only the granule with matches is scanned.
SELECT count() FROM t_memory_qcc_read_rows WHERE x = 1 SETTINGS optimize_move_to_prewhere = 1, max_rows_to_read = 10000, read_overflow_mode = 'throw';

INSERT INTO t_packed_spill SELECT number, toString(number), [number] FROM numbers(200000, 100000) SETTINGS async_insert = 0;

DROP VIEW v_pr_computed_output;

-- Round trip for arbitrary bytes.
SELECT countIf(decodeQuotedPrintable(encodeQuotedPrintable(s)) != s)
FROM (SELECT arrayStringConcat(arrayMap(i -> char(cityHash64(number, i) % 256), range(number % 300))) AS s FROM numbers(1000));

CREATE TABLE tab_json
(
    id UInt32,
    json JSON(t String),
    INDEX idx(JSONAllValues(json)) TYPE text(tokenizer = splitByNonAlpha) GRANULARITY 1
)
ENGINE = MergeTree
ORDER BY id
SETTINGS index_granularity = 1;

TRUNCATE TABLE tab_plain;

-- Q3: peer groups on the totals rows.
SELECT arrayJoin([1, 2, 1]) AS x, rank() OVER (ORDER BY x DESC) AS r
FROM values('k String', 'a') GROUP BY k WITH TOTALS ORDER BY x DESC;

SELECT t_a.k, t_a.flag, t_b.k, t_c.k, t_d.k
FROM t_a INNER JOIN t_b ON t_a.k = t_b.k
FULL JOIN t_c ON t_a.k = t_c.k
INNER JOIN t_d ON t_c.k = t_d.k AND t_a.flag = 0
ORDER BY ALL;

DROP TABLE t_rc;

SELECT groupArray(k) FROM t_memory_qcc_stateful PREWHERE k = 8192;

DROP TABLE IF EXISTS t_packed_s3_no_spill;

CREATE TABLE t_qualify_pushdown (tenant UInt64, ts UInt64) ENGINE = MergeTree ORDER BY (tenant, ts);

OPTIMIZE TABLE tab_ref FINAL;

DROP TABLE IF EXISTS t_packed_spill_without_projection;

CREATE TABLE t_time64_values_negative_local (k UInt8, t Time64(3)) ENGINE = Memory;

-- `ReadFromTextIndexCount` reports the rows of the selected ranges of the answered parts as read rows, not one row per part.

SET use_skip_indexes = 1;

SELECT count(), min(ts), max(ts)
FROM file(currentDatabase() || '_05372.parquet', Parquet, 'ts DateTime(\'UTC\'), v UInt32')
WHERE ts < toDateTime(1700000100, 'UTC')
SETTINGS log_comment = 'q05372_where';

CREATE TABLE t_bucket_top_k_in_order (k UInt64, v UInt64) ENGINE = MergeTree ORDER BY k;

CREATE DICTIONARY d05385 (id UInt64, v String) PRIMARY KEY id SOURCE(NULL()) LAYOUT(FLAT()) LIFETIME(0);

SELECT 'collapses to another key, grouping sets', a, if(0, b, if(0, b, a)) AS k, count()
FROM (SELECT 'x'::String AS a, 'y'::String AS b) t0 GROUP BY GROUPING SETS ((a), (k)) ORDER BY a, k;

SELECT * FROM sum_lc_value;

SELECT if(0, s, if(0, s, if(0, s, if(0, s, s)))) AS r FROM t GROUP BY r HAVING r != '1' ORDER BY r SETTINGS enable_identifier_resolve_cache = 1;

-- From version 11 on, the samples table must be an AggregatingMergeTree, so the version is pinned to keep it a File.
CREATE TABLE ts_05387 ENGINE = TimeSeries SETTINGS version = 7, recent_samples_ttl_seconds = 0
    SAMPLES ENGINE = File(Parquet) TAGS ENGINE = File(Parquet) METRIC FAMILIES ENGINE = File(Parquet);

SELECT * FROM
(
    SELECT a.c1 AS c1, a.c2 AS c2, b.c6 AS c6, sum(a.c4) OVER (PARTITION BY a.c1, a.c2) AS c7
    FROM t_05393_left AS a
    LEFT JOIN (SELECT c3, sum(c5) AS c6 FROM t_05393_right WHERE throwIf(c5 > 0) = 0 GROUP BY c3) AS b ON b.c3 = a.c3
)
WHERE c1 IN (SELECT c1 FROM t_05393_empty)
ORDER BY c2 DESC
LIMIT 200;

SELECT length(s), hex(s), hex(CRC32IEEE(materialize(toFixedString(s, 9)))), hex(CRC64(materialize(toFixedString(s, 9))))
FROM (SELECT s FROM 05394_crc_slice8 WHERE length(s) = 9);

SELECT t FROM values('t Tuple(UInt64)', tuple(0), tuple(70368744177664)) WHERE t = tuple(CAST(toDecimal64('0', 18), 'Dynamic')) ORDER BY t
SETTINGS decimal_check_overflow = 0, optimize_constant_columns_after_filter = 0;

SELECT sum(cityHash64(key, value)) FROM (SELECT key, value FROM t_pr_order WHERE value % 7 = 1 ORDER BY key)
SETTINGS enable_parallel_replicas = 0;

-- Not split if seeks are not allowed: every reader would read the whole file.
SELECT trimLeft(explain) FROM (
    EXPLAIN PIPELINE SELECT sum(id) FROM file(currentDatabase() || '_05394.parquet')
    SETTINGS max_threads = 4, parallelize_output_from_storages = 1, input_format_parquet_preserve_order = 0, input_format_allow_seeks = 0)
WHERE trimLeft(explain) LIKE 'File %';

-- Subquery caching is a Planner feature.
SET enable_analyzer = 1;

-- `sleepEachRow` has observable side effects, so it is executed on all the rows selected by `if`.
SELECT sum(if(number % 3 = 0, sleepEachRow(0.001) = 0 AND number % 2 = 0, 0)), sum(number % 2 = 0)
FROM numbers(100)
SETTINGS max_block_size = 10, short_circuit_function_evaluation = 'enable',
    short_circuit_function_evaluation_reorder_arguments = 0, compile_expressions = 0, log_comment = '05394_sleep_0';

-- Functions that support Variant natively are not affected.
SELECT count(v), groupArray(v), toTypeName(any(v)) FROM t_variant_agg;

-- Vertical merge into a `Wide` part with `Packed` storage. Every gathered column is written by its own
-- writer into the same in-memory archive, which rejects a second write of the same file, so the shared
-- offsets of `Nested` must be written only once. Skip indexes over gathered columns are built by the
-- per-column writers, while an index over several columns is built in the horizontal stage.
-- The result is compared with a horizontal merge of the same data into a `Full` part.

SET flatten_nested = 1;

-- The layout is pinned: the cost model works off the estimated bytes to read.
CREATE TABLE t_nested (key UInt64, kind UInt8, value UInt64) ENGINE = MergeTree ORDER BY key
    SETTINGS index_granularity = 8192, min_bytes_for_wide_part = 0;

INSERT INTO t_map_buckets_signed_zero_json SELECT 2, map(CAST('{"z":0.0}', 'JSON(z Float64)'), 'b');

SELECT count() FROM t_vertical_packed_empty;

SELECT part_name, token, count(), min(row_id), max(row_id), sum(length(positions))
FROM mergeTreeTextIndex(currentDatabase(), tab_postings, idx_s)
WHERE token IN ('a', 'b')
GROUP BY part_name, token ORDER BY part_name, token;

ALTER TABLE t_alp_ga ADD COLUMN y Float32 DEFAULT x CODEC(ALP, ZSTD);

-- `ifNotFinite` follows the common-type settings of `if`.
SELECT ifNotFinite(toFloat64('nan'), 'missing') AS x, toTypeName(x) SETTINGS use_variant_as_common_type = 1;

SELECT count(), sum(cityHash64(id, x, w)) FROM t_fuse_left LEFT ARRAY JOIN arr AS x, arrayMap(v -> v * 2, arr) AS w WHERE w = 2 * x AND x != 1;

SELECT if(1, tuple(a), tuple(0)) AS k, count() FROM (SELECT number % 3 AS a FROM numbers(10)) GROUP BY CUBE(k) ORDER BY ALL SETTINGS group_by_use_nulls = 1, optimize_if_chain_to_multiif = 0;

INSERT INTO t_implicit_alias_dict_src VALUES (1, 'a', 10, '2026-01-01'), (2, 'b', 20, '2026-01-02'), (3, 'c', 30, '2026-01-03');

INSERT INTO t_implicit_alias_db VALUES (1);

SELECT 'compact';

DROP TABLE IF EXISTS ur1;

INSERT INTO t_memory_qcc_alter VALUES (1, [10, 20]), (2, [30]);

CREATE TABLE t_autopr_drifted (k UInt64, v UInt64) ENGINE = MergeTree ORDER BY k;

DROP TABLE t_filter_const_subquery_settings;

-- Lazy materialization over joins at the rows an outer join leaves unmatched: a column read lazily, and a value
-- recomputed under the mask of the join, have the default the join stands there, the one of the type. For an `Enum`
-- that is its first element, and for a `Date32` the epoch, unlike the default of the column. Every query is followed
-- by the number of lazy reads in its plan, and the results are compared with the optimization disabled.

SET query_plan_optimize_lazy_materialization = 1;

CREATE TABLE t_set_equal_bound (x Int32, s String, z Int32)
ENGINE = MergeTree PARTITION BY (s, z) ORDER BY (x, s, z)
SETTINGS index_granularity = 8192, index_granularity_bytes = '10Mi';

SELECT number AS a, 2 - number AS b FROM numbers(3) ORDER BY a SETTINGS additional_result_filter = 'intDiv(1, a + b) = 0 AND b >= 1', query_plan_merge_filters = 1;

SELECT a, b FROM values('a Int64, b Int64', (0, 0), (-1, 2), (2, -1)) SETTINGS additional_result_filter = 'arrayJoin([a + b]) != 0 AND arrayJoin([intDiv(1, arrayJoin([a + b]))]) >= 0', query_plan_split_filter = 0, query_plan_fuse_filter_into_array_join = 1, serialize_query_plan = 0, max_threads = 1, max_block_size = 8192, extremes = 0;

SELECT '-- a filter below the sorting step';

DROP TABLE IF EXISTS m_policy_mixed;

SELECT count(), sum(b), max(b) FROM m_policy_mixed;

SELECT '-- tokenizer';

SELECT 'distinct in order a, nb', count(), sum(cityHash64(toString((a, nb)))) FROM
(
    SELECT DISTINCT a, nb FROM t_nullable_fixed_keys_in_order
)
SETTINGS optimize_distinct_in_order = 1, optimize_read_in_order = 1, max_threads = 1, max_block_size = 100000,
         preferred_block_size_bytes = 0, preferred_max_column_in_block_size_bytes = 0;

-- Random settings limits: index_granularity=(8192, None); index_granularity_bytes=(10485760, None)
-- Every query reads the whole table in one thread with tiny read tasks, so the run time grows with the
-- number of granules: small randomized granules push the test past the timeout.

-- When automatic parallel replicas switches a query, the sets the single-node plan has already
-- prepared are handed to the parallel-replicas plan, paired by hash. A set that has no counterpart
-- used to fail the query with "Cannot find a matching set in the map of sets from single-replica plan";
-- now the query keeps the single-node plan instead.
-- https://github.com/ClickHouse/ClickHouse/issues/124322

DROP TABLE IF EXISTS t_autopr_unpaired_sets;

INSERT INTO t_djp VALUES (1, '{"a":1}', '{}', []), (2, '{"b":2}', '{}', [1]), (3, '{"a":3}', '{}', [1]), (4, '{"b":4}', '{}', [1]);

-- SAMPLE: the first row of the part is outside the sample.
DROP TABLE IF EXISTS t_djp_sample;

SELECT distinctJSONPaths(j) FROM t_djp_merge SETTINGS optimize_functions_to_subcolumns = 0;

SELECT distinctJSONPaths(j) FROM t_djp_alter SETTINGS optimize_functions_to_subcolumns = 1;

-- Float32 and BFloat16 values converted to 128- and 256-bit integers, and Float32 values converted to Decimal128/Decimal256.

SELECT toInt128(toFloat32(1e20)) = toInt128(toFloat64(toFloat32(1e20))), toInt256(toFloat32(-1e20)) = toInt256(toFloat64(toFloat32(-1e20)));

INSERT INTO threshold_top_k_empty_key SELECT if(number % 100 = 0, '', toString(number)), if(number % 100 = 0, 1000000 + number, number) FROM numbers(40000, 20000);

CREATE TABLE t_enum_needle (id UInt32, e Enum8('a' = 1, 'b' = 2), ne Nullable(Enum8('a' = 1, 'b' = 2)), INDEX bf e TYPE bloom_filter GRANULARITY 1)
ENGINE = MergeTree ORDER BY id SETTINGS index_granularity = 1;

-- Differs from the query above only in a constant.
SELECT a + 3 AS k FROM t_05401 GROUP BY k FORMAT Null SETTINGS log_comment = 'q05401_plus3_1';

-- a derived hint inside an OR does not keep the OR above the aggregation
SELECT trimLeft(explain) FROM (EXPLAIN indexes = 1 SELECT a, b FROM t_chain_keys GROUP BY a, b HAVING (b < a AND a < 10) OR a = 500) WHERE explain LIKE '%Granules: %/%';

-- a derived hint that crosses ARRAY JOIN is dropped, not bound to the array of the same name
SELECT countIf(explain LIKE '%indexHint(%') > 0 FROM (EXPLAIN SYNTAX run_query_tree_passes = 1 SELECT count() FROM (SELECT x, v FROM t_hint_alias AS t ARRAY JOIN [w, v] AS x) WHERE x < v AND v < 3);

OPTIMIZE TABLE t_hint_qcc FINAL;

SELECT count() FROM t_returning WHERE id >= 2000000 AND id < 3000000;

-- Integer casts with magnitude > INT_MAX
SELECT intExp10(toInt64(4294967297));

INSERT INTO t_ipcrypt_lc_filtered VALUES ('1.2.3.4'), ('not an ip');

SELECT count() FROM (SELECT number, flag FROM (SELECT number, toNullable(1) AS flag FROM numbers(2)) GROUP BY number, flag) AS a
RIGHT JOIN numbers(3) AS b ON a.number = b.number
WHERE isConstant(a.flag) = 1;

SELECT a.number, b.flag, c.number FROM numbers(3) AS a LEFT JOIN (SELECT x.number AS number, y.flag AS flag FROM numbers(2) AS x LEFT JOIN (SELECT number, toNullable(1) AS flag FROM numbers(2)) AS y ON x.number = y.number) AS b ON a.number = b.number
INNER JOIN numbers(3) AS c ON b.flag = c.number WHERE isConstant(b.flag) = 0 ORDER BY 1;

SET compatibility = '26.11';

SELECT countIf(explain LIKE '%LazilyReadFromMergeTree%') > 0 FROM (
    EXPLAIN SELECT l.k, l.heavy, t.c, t.s, t.rheavy FROM l LEFT JOIN (SELECT k, 42 AS c, 'const' AS s, rheavy FROM r) AS t ON l.k = t.k
    ORDER BY l.k DESC LIMIT 4 SETTINGS join_use_nulls = 1);

SELECT 'offset compact storage', part_type, part_storage_type, rows FROM system.parts
WHERE database = currentDatabase() AND table = 't_lwd_offset_compact' AND active;

-- A correlated subquery in a view body must not be read with parallel replicas, also when the body is
-- expanded on a remote shard (a parallel replicas initiator for its own replicas) or on every replica.

DROP VIEW IF EXISTS v_corr;

SELECT sum(v), sum(k) FROM t_pr_follower_skip_idx WHERE (k BETWEEN 30 AND 39 OR p = 100) AND v = 42
SETTINGS enable_parallel_replicas = 0, log_comment = '05401_single';

-- A server that receives a query from another server skips positional arguments only in that query,
-- not in the queries it analyzes itself (materialized views, row policies, view(), parameterized views).
-- A query re-analyzed from its printed form (by `Buffer`, `Merge`, `*Cluster`, a `GLOBAL IN` filter, or the
-- `INSERT SELECT` sent to parallel replicas) skips them on every node, also inside a view.

SET enable_positional_arguments = 1;

CREATE TABLE t_rp (k Int64) ENGINE = MergeTree ORDER BY k;

INSERT INTO t_merge_m1 SELECT number + 10 FROM numbers(2);

-- The cut falls right after the underline of a digit group.
SELECT 12345678901234 AS n FORMAT PrettyCompact;

CREATE TABLE t_projection_positional_literal (c0 UInt64)
ENGINE = MergeTree ORDER BY c0
SETTINGS materialize_projections_on_insert = 1;

SELECT count() FROM merge(currentDatabase(), '^t_(?P<table_name>named_group)$');

SELECT 'drop_chain', count() FROM t_rename_drop_chain WHERE c = 5000;

CREATE TABLE t_left (b String) ENGINE = MergeTree ORDER BY b;

INSERT INTO t_skip_final_nan_pk VALUES (1, reinterpretAsFloat64(toUInt64(9221120237041090560)), 1);

SELECT toIPv4(materialize('256.1.1.1'));

SELECT fa.k, fb.k FROM fa, fb WHERE fa.f = fb.f ORDER BY ALL;

INSERT INTO t_enum_null_slots VALUES
    (1, ['a', NULL], ['a', NULL], [NULL], {'x': NULL}, ['a'], ['a'], {'a': 1}, NULL, NULL),
    (2, ['b', NULL], ['b', NULL], [('b')], {'y': 'b'}, ['b'], ['b'], {'b': 1}, 'b', 'b'),
    (3, [NULL], [NULL], [NULL, ('a')], {'z': NULL, 'w': 'a'}, ['a'], ['a'], {'a': 1}, 'a', 'a'),
    (4, [], [], [], {}, [], [], {}, NULL, 'a');

SYSTEM STOP MERGES t_column_ttl_add_column;

DROP TABLE pso;

CREATE ROW POLICY OR REPLACE p_null ON child_null USING x IN src_null TO ALL;

SELECT n FROM
(
    SELECT NULL IN (NULL) AS n
    UNION ALL
    (SELECT NULL IN (NULL) AS n EXCEPT ALL SELECT 0 AS n SETTINGS transform_null_in = 1)
)
ORDER BY n NULLS FIRST;

-- The same function over different windows and different functions over the same window are kept apart.
SELECT trimLeft(explain) FROM
(
    EXPLAIN actions = 1
    SELECT
        ntile(2) OVER (ORDER BY number) AS w1,
        ntile(2) OVER (ORDER BY number DESC) AS w2,
        ntile(3) OVER (ORDER BY number) AS w3,
        w1 + w1 + w2 + w2 + w3 + w3 AS s
    FROM numbers(10)
)
WHERE explain LIKE '%ntile(%' AND explain NOT LIKE '%->%';

SELECT 's3Cluster parquet', _size, count(), sum(x), sum(y) FROM s3Cluster('test_cluster_two_shards', 'http://localhost:11111/test/05403_' || currentDatabase() || '_dup.tar.gz :: *', 'test', 'testtest', 'Parquet') GROUP BY _size ORDER BY _size SETTINGS cluster_function_process_archive_on_multiple_nodes = 1, schema_inference_mode = 'union';

SELECT '-- a branch that throws where its condition skips it, on the side of an outer join';

SELECT count() FROM t_bf_codec WHERE c = 1000 SETTINGS force_data_skipping_indices = 'bf_repeated';

-- An `INSERT` that is deduplicated relies on the part written by another `INSERT`,
-- that may not be synced yet, so it syncs this part before it is acknowledged.
CREATE TABLE t_fsync_dedup (k UInt64) ENGINE = MergeTree ORDER BY k
SETTINGS fsync_after_insert = 1, non_replicated_deduplication_window = 100;

SELECT count() FROM t_partitioned WHERE x > 9000000000000000000;

CREATE TABLE t_rf_asof_fsm_right (id UInt64, ts String, val UInt64) ENGINE = MergeTree ORDER BY (id, ts);

CREATE TABLE t1 (id UInt64, k UInt64) ENGINE = MergeTree ORDER BY id;

-- Subcolumns of a `Memory` table with `compress = 1` are decompressed without the rest of the column.
-- They are compared with the same data in a table with `compress = 0`. The first block of the compressed
-- table is compressed, the second one is below `min_size_to_compress` and stays uncompressed.

DROP TABLE IF EXISTS t_compressed;

INSERT INTO t_nested_compressed SELECT * FROM t_nested_uncompressed WHERE id < 30000 SETTINGS min_insert_block_size_rows = 100000, min_insert_block_size_bytes = 0, max_insert_threads = 1;

-- The layer filter of `PartsSplitter` refers to the key columns by name and is composed with the table's
-- own key expression. A computed key suffix that is not read by the join-by-shards layers, which split only on
-- the common prefix, used to break it. An aliased key is covered by 05427_parts_splitter_layer_filter_aliased_key.

DROP TABLE IF EXISTS t_jbs_l;

CREATE DICTIONARY dict_cell_clip (geometry Array(Array(Array(Tuple(Float64, Float64)))), id String)
PRIMARY KEY geometry SOURCE(CLICKHOUSE(TABLE 'polygons_cell_clip' DB currentDatabase())) LIFETIME(0) LAYOUT(POLYGON());

DROP TABLE IF EXISTS aj_src_eager;

DROP DICTIONARY IF EXISTS dict_grid_each_leaf;

DROP DICTIONARY dict_grid_cell;

DROP TABLE IF EXISTS t_05406;

SELECT number AS k, count() FROM numbers(600000) GROUP BY k LIMIT 10 FORMAT Null SETTINGS max_block_size = 600000, log_comment = 'q05406_6b_limit_same_cap';

-- A filter on the array-joined elements leaves 6 rows in `s`; the estimate of its input must not make `aj_r` the build side.
-- The third count is the plans that show no row estimate for `s`.
SELECT 'ARRAY JOIN, element filter', countIf(explain ILIKE '%Join: aj_r%'), countIf(explain ILIKE '%Join: s%'), countIf(explain ILIKE '%s[no_stats~?]%')
FROM (EXPLAIN actions = 1, keep_logical_steps = 1
    SELECT count() FROM aj_r INNER JOIN (SELECT id FROM aj_l ARRAY JOIN arr AS k WHERE k = 5) AS s ON aj_r.id = s.id
    SETTINGS query_plan_fuse_filter_into_array_join = 1)
WHERE explain ILIKE '%Join:%';

-- A preliminary `DISTINCT` must not coalesce its output above a view: the query of the view is stored
-- outside the plan tree and can stop emitting rows (here, an inner `DISTINCT` over an unbounded input),
-- so the coalesced keys would never reach the outer `LIMIT`.

SET allow_parallel_distinct = 1, max_threads = 4, max_block_size = 1000;

SET automatic_parallel_replicas_mode = 0, parallel_replicas_local_plan = 0;

-- 2500 of the 10000 rows satisfy `v < 2500`.
SELECT 'low first', toUInt64OrZero(extract(explain, 't_low_first\\[(\\d+)\\]')) BETWEEN 2250 AND 2750
FROM (EXPLAIN PLAN keep_logical_steps = 1 SELECT count() FROM t_low_first INNER JOIN t_dim ON t_low_first.v = t_dim.k WHERE t_low_first.v < 2500)
WHERE explain LIKE '%Join:%' LIMIT 1;

SELECT s.item, r.order_id FROM sales_view_without_min_rows s, returns r
WHERE s.item = r.item AND s.order_id = r.order_id AND s.item BETWEEN 100 AND 120 AND r.item BETWEEN 100 AND 120
LIMIT 10 FORMAT Null SETTINGS log_comment = '05407_view_without_min_rows';

SELECT count(), sum(k) FROM compact_ttl_deferred_projection;

DROP TABLE t_date_to_datetime_in_set_wrapped;

SET input_format_csv_empty_as_default = 0;

SET input_format_csv_use_best_effort_in_schema_inference = 0;

SELECT 'templates=1';

DROP TABLE t_dynamic_values_null_default;

SELECT '-- hash exchange on two keys';

CREATE TABLE t_json_compact_strings (id UInt64, s String) ENGINE = File(JSONCompactStrings);

INSERT INTO t_json_each_row_array VALUES (1, 'a');

DROP TABLE t_custom_separated;

ALTER TABLE t_real ADD PROJECTION p (SELECT b, sum(v), count() GROUP BY b);

SELECT '-- the projection does not apply';

CREATE HYPOTHETICAL PROJECTION p_c ON c_est (SELECT d, count() GROUP BY d);

SELECT JSONExtract(CAST(NULL AS Nullable(String)), k, 'Array(Int64)') FROM values('k String', 'a', 'b');

SELECT maxIf(ProfileEvents['ReadCompressedBytes'], log_comment = '05407_all_buckets')
    > 2 * maxIf(ProfileEvents['ReadCompressedBytes'], log_comment = '05407_one_bucket')
FROM system.query_log
WHERE event_date >= yesterday() AND current_database = currentDatabase() AND type = 'QueryFinish'
    AND log_comment IN ('05407_one_bucket', '05407_all_buckets');

-- A closed line has the same length as the perimeter of the ring with the same points.
SELECT perimeterCartesian([(0., 0.), (1., 0.), (1., 1.), (0., 1.), (0., 0.)]::LineString) = perimeterCartesian([(0., 0.), (1., 0.), (1., 1.), (0., 1.), (0., 0.)]::Ring);

SELECT * FROM (EXPLAIN SELECT count(), sum(a) FROM t_stats_parallel_load WHERE a >= 4500 AND b = 3)
SETTINGS use_statistics = 0, use_statistics_for_part_pruning = 1, max_threads = 8, log_comment = 'stats_parallel_load_explain_pruning_cold' FORMAT Null;

DROP TABLE t_stats_parallel_load;

SELECT '-- the same read without statistics';

SYSTEM STOP MERGES t_subcolumn_codecs_alter;

-- Without the setting a declaration can be removed but not added.
SET enable_subcolumn_codecs = 0;

-- The streams are listed for the part written by the merge.
OPTIMIZE TABLE t_subcolumn_codecs FINAL;

SELECT count(), round(sum(payload.value)), sum(length(payload.`value.b`)), countIf(payload.note IS NULL) FROM t_subcolumn_codecs_sparse;

DROP TABLE t_subcolumn_codecs_r1 SYNC;

DROP TABLE mv_subcolumn_codecs_inner;

SELECT count() FROM tab WHERE hasAnyTokens(msg, ['alpha', 'beta']) AND msg LIKE '%alpha%' SETTINGS use_skip_indexes = 0;

-- Cascades runs a `DISTINCT` on several nodes only where the result stays the same, and prices it on the rows it
-- gets. The cost config makes an exchange cheap next to a read, as in 05406, so that the distributed plans are the
-- cheapest on a small table.
SET enable_analyzer = 1;

SELECT 'zh', groupArray(id) FROM (SELECT id FROM t_collation_utf8 ORDER BY s COLLATE 'zh', id);

INSERT INTO real_granules SELECT 'b < 60', extract(arrayStringConcat(groupArray(explain), '\n'), '(?s).*Granules: (\\d+)/')
FROM (EXPLAIN indexes = 1 SELECT a FROM t_budget_real WHERE b < 60 SETTINGS use_skip_indexes_on_data_read = 0);

DROP TABLE IF EXISTS t_uneven;

DROP TABLE t_budget_real;

INSERT INTO t_decimal_float_key VALUES ('1', 20), ('1', 30), ('1.000000000000000001', 10), ('1.000000000000000001', 20), ('2', 5);

SELECT arraySort(groupArray(ts)) FROM t_datetime64_float_key WHERE d = toFloat64(1767225600);

SELECT arraySort(groupArray(ts)) FROM t_decimal_float32_set_key WHERE d IN (SELECT toFloat32(1000000));

DROP TABLE t_decimal_exact_float_minmax;

SELECT 'UInt256',
    countIf(any_1 != any_1m), countIf(any_2 != any_2m), countIf(all_1 != all_1m), countIf(all_2 != all_2m),
    countIf(any_1) > 0 AND countIf(NOT any_1) > 0, countIf(all_1) > 0 AND countIf(NOT all_1) > 0,
    countIf(all_2) > 0 AND countIf(NOT all_2) > 0
FROM
(
    SELECT
        hasAny(a, c) AS any_1, hasAny(a, materialize(c)) AS any_1m,
        hasAny(c, a) AS any_2, hasAny(materialize(c), a) AS any_2m,
        hasAll(a, c) AS all_1, hasAll(a, materialize(c)) AS all_1m,
        hasAll(c, a) AS all_2, hasAll(materialize(c), a) AS all_2m
    FROM (SELECT r AS a, c FROM (SELECT number, arraySort(v -> cityHash64(v, number), arrayConcat(arrayFilter((v, i) -> number % 4 IN (0, 2) OR (number % 4 = 1 AND i != cityHash64(number) % 200 + 1), c, arrayEnumerate(c)), if(number % 4 = 2, [], arrayMap(x -> toUInt256(cityHash64(number, x) % 100000), range(cityHash64(number, 1) % 20))))) AS r, c FROM (SELECT number, arrayMap(x -> toUInt256(intHash64(x) % 100000), range(200)) AS c FROM numbers(5000))))
);

WITH [[(0., 0.), (2., 0.), (2., 2.), (0., 2.)]] AS c
SELECT id, polygonsDistanceCartesian(p, c) AS a, a = polygonsDistanceCartesian(p, materialize(c)),
    polygonsDistanceCartesian(c, p) AS b, b = polygonsDistanceCartesian(materialize(c), p)
FROM polygons ORDER BY id;

SELECT count() FROM t_05410 WHERE d64 = toDecimal64(1, 18);

DROP TABLE t_05410;

SELECT parseDateTime('2026-298 01:00:00', '%Y-%j %H:%i:%s', 'Europe/Berlin');

INSERT INTO t_ranges VALUES (1), (2), (3);

SELECT (SELECT count(), sum(cityHash64(tuple(id, x, y))) FROM t_aj_window LEFT ARRAY JOIN a AS x, r AS y SETTINGS enable_unaligned_array_join = 1)
     = (SELECT count(), sum(cityHash64(tuple(id, e.1, e.2))) FROM (SELECT id, arrayJoin(arrayZip(arrayResize(a, greatest(length(a), length(r), 1)), arrayResize(r, greatest(length(a), length(r), 1)))) AS e FROM t_aj_window));

-- A large table-size hint makes Cascades always read the table on several nodes.
SET param__internal_join_table_stat_hints = '{"t_cascades_fill": {"cardinality": 100000000, "avg_row_bytes": 24, "distinct_keys": {"g": 20}}}';

SELECT g, count() AS c FROM t_cascades_fill GROUP BY g ORDER BY g WITH FILL FROM 0 TO 64;

SET
    make_distributed_plan = 1,
    enable_parallel_replicas = 0,
    use_statistics = 0,
    enable_join_runtime_filters = 1,
    distributed_plan_join_runtime_filters = 1,
    distributed_plan_max_rows_to_broadcast = 0,
    distributed_plan_optimize_exchanges = 1,
    distributed_plan_default_shuffle_join_bucket_count = 3,
    distributed_plan_default_reader_bucket_count = 3,
    distributed_plan_force_exchange_kind = 'Streaming';

-- Random settings limits: optimize_read_in_order=(1, 1)

-- Over the native protocol a sparse `Nullable(String)` is sent as the values from index 1, and the NULL
-- default row at index 0 may keep a non-empty nested string ('0' below); the offsets must not include it.

DROP TABLE IF EXISTS t_sparse_int;

SELECT count(), sum(k) FROM
(
    SELECT k FROM t_pr_follower_skip_idx_in_order WHERE v = 42 ORDER BY k
)
SETTINGS enable_parallel_replicas = 1, parallel_replicas_plan_based = 0;

DROP TABLE IF EXISTS t_select_k;

SELECT 'parent rows', count()
FROM mergeTreeProjection(currentDatabase(), t_materialize, p) AS pp
INNER JOIN (SELECT _part AS part, _part_offset AS offset, k, v, s FROM t_materialize) AS tt
    ON pp._part = tt.part AND pp._parent_part_offset = tt.offset
WHERE pp.v = tt.v AND pp.k = tt.k AND tt.s = 'a';

CREATE TABLE t_alias_where_agg (k UInt64, v UInt64, PROJECTION p (SELECT 100 - v AS v, count() WHERE v = 90 GROUP BY v))
ENGINE = MergeTree ORDER BY k;

DROP TABLE t_date32_sparse;

SYSTEM START REPLICATED DDL QUERIES;

SELECT a FROM t_cascades_neg_limit ORDER BY a LIMIT -4;

SELECT a FROM t_cascades_neg_limit ORDER BY a WITH FILL STEP 2 LIMIT -1 BY a % 3 SETTINGS make_distributed_plan = 0;

DROP TABLE IF EXISTS t_w_chunked;

CREATE TABLE t (id Int64)
ENGINE = IcebergLocal((SELECT path FROM iceberg_path), 'Parquet')
SETTINGS iceberg_format_version = 2, allow_experimental_iceberg_compaction = 0, iceberg_compaction_delay_bias = 100;

SELECT tupleElement(u, 'a') + 1 FROM t_arr ARRAY JOIN u INNER JOIN (SELECT CAST((1, 3), 'Tuple(a UInt64, b UInt64)') AS u) AS r USING (u);

SELECT count() FROM t_uuid_stats AS b INNER JOIN t_uuid_stats_alter AS a ON a.u = b.u WHERE a.id < 100;

SELECT count() FROM t_05433 WHERE x IN (SELECT x FROM t_05433 WHERE y < 5 SETTINGS enable_parallel_replicas = 0, parallel_replicas_plan_based = 1)
SETTINGS parallel_replicas_plan_based = 0;

SELECT number, CAST(x AS UInt8) FROM (SELECT number, if(number = 1, NULL, number)::Variant(UInt64, Array(UInt8)) AS x FROM numbers(3)) ORDER BY number;

SELECT id, CAST(d AS UInt8) FROM t_dynamic WHERE id = 1;

SELECT count(), sum(v), sum(length(s)), sum(n) FROM t_cc_compact WHERE id < 1000 OR id BETWEEN 30000 AND 41000 OR id > 99000 SETTINGS use_columns_cache = 0;

-- Rescaling the dividend overflows Int64 above 922337203685477.58: those granules cannot be pruned, the rest still can (only `1` is pruned)
DROP TABLE t;

SELECT count() FROM t WHERE intDiv(price, toDecimal256(3, 1)) < 0;

-- Casting `Enum` to `LowCardinality(String)` gives the same names and errors as casting to `String`.

DROP TABLE IF EXISTS t_enum;

CREATE TABLE t_geo_promotion_variant (id UInt32, g Variant(Polygon, MultiPolygon)) ENGINE = Memory;

SELECT 'path', toUnixTimestamp(Time), Value, Version FROM t_graphite_final_prewhere FINAL WHERE Path = 'sum_1' ORDER BY ALL;

ALTER TABLE t UPDATE a = a WHERE 1 SETTINGS mutations_sync = 2;

-- The types are kept.
DESCRIBE (SELECT * FROM obfuscate(SELECT * FROM v_obfuscate_types));

CREATE TABLE t_add (k UInt64, v UInt64) ENGINE = MergeTree ORDER BY k SETTINGS index_granularity = 4;

SELECT groupArray((w, c)) FROM (SELECT 100 - v AS w, count() AS c FROM t_agg GROUP BY w ORDER BY w)
SETTINGS optimize_use_projections = 1, force_optimize_projection = 1, optimize_aggregation_in_order = 0,
    parallel_replicas_local_plan = 1, parallel_replicas_support_projection = 1;

SELECT t1.number, rowNumberInAllBlocks() AS rn FROM numbers(10) AS t1 LEFT JOIN numbers(5) AS t2 ON t1.number = t2.number ORDER BY t1.number DESC LIMIT 2 SETTINGS query_plan_top_k_through_join = 0;

-- An aggregate projection.
SELECT k % 10 AS r, count(), sum(id) FROM t_cc_proj GROUP BY r ORDER BY r SETTINGS use_columns_cache = 1, force_optimize_projection = 1;

SELECT tuple(1, 'a')::Tuple(`first element` UInt8, `second element` String) AS `t t` FORMAT PrettyCompact SETTINGS output_format_pretty_max_column_name_width_cut_to = 18446744073709551615;

CREATE TABLE training_05442 (x1 Float64, x2 Float64, y Float64) ENGINE = MergeTree ORDER BY tuple();

-- The source table has no deduplication window, so it keeps both rows. In the target table the
-- second insert is a duplicate of the first by token, so only the first row survives.
SELECT 'src', p, v FROM src_dedup_empty ORDER BY v;

INSERT INTO t_gdeflate_plain SELECT * FROM t_gdeflate;

-- A NaN or infinite coordinate has no position on the spheroid.
SELECT
    lengthSpheroid([(0., nan), (1., 0.)]::LineString),
    lengthSpheroid([(nan, 0.), (1., 0.)]::LineString),
    lengthSpheroid([(inf, 0.), (1., 0.)]::LineString),
    lengthSpheroid([(0., -inf), (1., 0.)]::LineString),
    lengthSpheroid([[(0., 0.), (1., 0.)], [(0., 0.), (0., nan)]]::MultiLineString),
    lengthSpheroid([(0., 0.), (1., 0.), (1., inf), (0., 0.)]::Ring);

ATTACH TABLE t_load_part_io_error;

CREATE VIEW v_src AS SELECT
    toDateTime64('2262-04-12 00:00:00', 9, 'Pacific/Kiritimati') + toIntervalSecond(number * 490) + toIntervalNanosecond(number * 1234567) AS kiritimati_max,
    toDateTime64('2262-04-11 00:00:00', 9, 'UTC') + toIntervalSecond(number * 800) + toIntervalNanosecond(number * 7654321) AS utc_max,
    toDateTime64('1677-09-21 00:12:44', 9, 'UTC') + toIntervalSecond(number * 800) + toIntervalNanosecond(number * 7654321) AS utc_min,
    toDateTime64('2020-01-01 00:00:00', 9, 'Europe/Amsterdam') + toIntervalSecond(number * 3607) + toIntervalNanosecond(number * 123456789) AS regular
FROM numbers(100);

SELECT count() FROM t_mat_plain WHERE c = 999999 SETTINGS apply_mutations_on_fly = 1, use_skip_indexes = 0;

-- no-fasttest: needs the SZ3 library

-- A positive SZ3 error bound below the smallest normal double, given directly or derived from subnormal data, is
-- compressed losslessly. `ALGO_LORENZO_REG` used to divide it to zero in its regression predictor
-- (`Assertion 'eb != 0' failed` in debug builds).

SET enable_sz3_codec = 1;

SELECT wkt([[[(139.6, 35.69451), (139.60001, 35.69452), (139.6, 35.69453)]]]::MultiPolygon);

SELECT x, y FROM t_update;

-- Cycle C -> D -> E -> C, F is below C, G is an orphan.
SELECT arrayTreePreorder(['A', 'B', 'C', 'D', 'E', 'F', 'G'], ['', 'A', 'D', 'E', 'C', 'C', 'Z']);

DROP TABLE IF EXISTS x3;

SELECT MVTEncodeGeom([(0.0, 0.0), (1.0, 1.0)]::MultiPoint, 10, 550, 335) IS NULL;

SELECT polygonMinimumRotatedRectangleCartesian([(0., 1.), (0., 0.), (1e-170, 0.), (1., 1.)]::MultiPoint);

SELECT ST_ExteriorRing([[(0., 0.), (1., 0.), (1., 1.), (0., 0.)]]::Polygon), ST_InteriorRingN([[(0., 0.), (9., 0.), (9., 9.), (0., 0.)], [(1., 1.), (2., 1.), (2., 2.), (1., 1.)]]::Polygon, 1), ST_PointN([(1., 2.), (3., 4.)]::LineString, 2);

SELECT '-- an instant selector returns the last sample, a stale marker hides the series';

-- Timestamp bounds of the LogsQL `_time:` filter, as documented in
-- docs/guides/clickhouse/logsql.mdx ("Time filter"): a timestamp prefix denotes
-- the whole period of its precision, and a trailing `+hh:mm`/`-hh:mm` offset may
-- follow any prefix directly, so `2024-01-02:30` is the month `2024-01` read in
-- the zone `-02:30`. Anything else is rejected as a syntax error.
SET session_timezone = 'UTC';

SELECT '-- a copy gets the declarations once';

SELECT 'Decimal64(3)', count(), countIf(toString(x) != s)
FROM
(
    SELECT toString(a) AS s, arrayJoin(arrayWithConstant(number % 4, a)) AS x
    FROM (SELECT CAST(arrayMap(i -> number * 7 + i, range(number % 37)) AS Array(Decimal64(3))) AS a, number FROM numbers(1000))
);

SYSTEM ENABLE FAILPOINT parallel_sync_paths_fail_fsync;
