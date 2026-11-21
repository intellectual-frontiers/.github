-- all parts take one draw from every 8 baseline marks. The first draw of a small part always reads its 12-mark window,
-- and the second draw reads the 4-mark window with a chance of 1/2. When the parts that read both windows counted exactly,
-- the other parts took 16 surviving marks each, and the span missed the real granules
SELECT
    (SELECT count() FROM system.parts WHERE database = currentDatabase() AND table = 't_full_parts' AND active) AS parts,
    extract(sampled, 'sampled_marks: +(\\d+ / \\d+)') AS sampled_marks,
    extractGroups(sampled, 'With idx_v [^\\n]*\\n +status: +applicable\\n +marks: +(\\d+)\\n +marks_span: +(\\d+) to (\\d+)') AS estimate,
    toUInt64(extract(full, 'With idx_v [^\\n]*\\n +status: +applicable\\n +marks: +(\\d+)')) AS real,
    real BETWEEN toUInt64(estimate[2]) AND toUInt64(estimate[3]) AS real_in_span
FROM
(
    SELECT
        (SELECT arrayStringConcat(groupArray(explain), '\n')
         FROM (EXPLAIN WHATIF index_scan_budget_rows = 960 SELECT a FROM t_full_parts WHERE b = 0 AND v = 0)) AS sampled,
        (SELECT arrayStringConcat(groupArray(explain), '\n')
         FROM (EXPLAIN WHATIF index_scan_budget_rows = 0 SELECT a FROM t_full_parts WHERE b = 0 AND v = 0)) AS full
);

SELECT r.k, x.k, x.e, x.heavy FROM r JOIN (SELECT k, e, heavy FROM l ARRAY JOIN arr AS e) AS x ON r.k = x.e
ORDER BY x.k DESC, r.k LIMIT 6
SETTINGS query_plan_lazy_materialization_for_join = 0;

SELECT 'Tuple(UInt64, UInt8)',
    (SELECT uniqExact(x) FROM (SELECT (number % 300000, toUInt8(number % 300000 % 7)) AS x FROM numbers_mt(2000000)) SETTINGS optimize_uniq_exact_radix_partitioning = 1),
    (SELECT uniqExact(x) FROM (SELECT (number % 300000, toUInt8(number % 300000 % 7)) AS x FROM numbers_mt(2000000)) SETTINGS optimize_uniq_exact_radix_partitioning = 0),
    (SELECT count() > 0 FROM (EXPLAIN PIPELINE SELECT uniqExact(x) FROM (SELECT (number % 300000, toUInt8(number % 300000 % 7)) AS x FROM numbers_mt(2000000)) SETTINGS optimize_uniq_exact_radix_partitioning = 1)
        WHERE explain LIKE '%RadixUniqExactRouteTransform%');

SELECT number, nonNegativeDerivative(number, toDateTime(number), toIntervalSecond(number + 1)) OVER (ORDER BY number) AS d
FROM numbers(4)
SETTINGS max_block_size = 1, max_threads = 1;

INSERT INTO polygon_typed_points VALUES (0.5, 0, 0), (-0.5, 0, 0), (10, 10, 1);

INSERT INTO ts_rows (metric_name, tags, samples) VALUES
    ('m', map('env', 'prod'), [(toDateTime64(100, 3), 1.), (toDateTime64(4000, 3), 2.)]),
    ('m', map('env', 'dev'), [(toDateTime64(150, 3), 10.)]);

-- Reduces rows: two source rows per group.
CREATE MATERIALIZED VIEW mv_agg TO dst_agg AS SELECT g, count() AS c FROM src GROUP BY g;

SELECT ifNull(if(number = 0, toNullable('first'), NULL), CAST(if(number > 0, 'x', NULL) AS Nullable(Enum8('x' = 1, 'y' = 2)))) FROM numbers(3) SETTINGS short_circuit_function_evaluation = 'enable';

SELECT 'DateTime, America/Santiago', arraySort(groupUniqArray(toDate(x))) FROM (SELECT x FROM obfuscate(
    SELECT toDateTime('2024-09-08 01:00:00', 'America/Santiago') + toIntervalSecond(number * 37) AS x FROM numbers(2000)) LIMIT 2000);

ALTER TABLE t_05448 MODIFY COLUMN x Int8 STATISTICS(basic) SETTINGS mutations_sync = 0, alter_sync = 0;

-- Compressed chunk whose snappy length prefix is a truncated varint.
INSERT INTO FUNCTION file(currentDatabase() || '.snp', 'RawBLOB') SELECT unhex('ff060000734e615070590005000000000000ff');

DROP TABLE IF EXISTS t_sgm_build_ab;

DROP TABLE t_sgm_probe;

SELECT coalesce(if(number < 3, toNullable(tuple('first')), NULL), tuple(CAST(if(number > 0, 'x', 'y') AS Nullable(Enum8('x' = 1, 'y' = 2))))) FROM numbers(3) SETTINGS short_circuit_function_evaluation = 'enable';

-- Such operands are still simple `SELECT` queries in a materialized view.
DROP TABLE IF EXISTS mv1;

SELECT count(), min(k) FROM tab PREWHERE a;

CREATE VIEW v_none_sampling SQL SECURITY NONE AS SELECT id FROM t_sampling;

DROP TABLE inner_d_plain;

DROP TABLE ts_tags;

-- Random settings limits: prefer_localhost_replica=(1, 1)
-- The RETURNING query of an INSERT reads the inserted table through `merge`, a `Merge` table and `remote`
-- while the query shares one storage snapshot per table between all its reads.

SET enable_shared_storage_snapshot_in_query = 1;

-- In an outer join, an OR of equalities with constants on one table each keeps working.
SELECT count(), sum(t6.yb) FROM t5 LEFT JOIN t6 ON t5.xk = t6.yk AND (t5.xa = 1 OR t6.yb = 5);

DROP TABLE r_str_mt;

SELECT 'iv', uniqExact(iv), min(iv), max(iv), length(groupUniqArray(iv)) FROM t_mem;

DROP ROW POLICY IF EXISTS p_05453_final_ver ON t_final_ver;

CREATE TABLE m_memory_default (tenant String, payload String) ENGINE = Merge(currentDatabase(), '^t_memory_default$');

CREATE ROW POLICY p_05453_alias ON t_alias USING t2 = 'a' TO ALL;

INSERT INTO t_nested VALUES ('a', '5'), ('a', '20'), ('b', 'secret'), ('a', '30');

DROP ROW POLICY p_05453_nested_both_merge ON m_nested_both_inner;

ALTER TABLE t_partial_projection ADD PROJECTION by_v (SELECT * ORDER BY v);

INSERT INTO t_empty_insert_middle SELECT toUInt32(number) FROM numbers(10) WHERE number > 100;

SELECT 'c7 desc on', f64 FROM t_topk_nan_threshold ORDER BY f64 DESC LIMIT 3
SETTINGS use_skip_indexes_for_top_k = 0, use_top_k_dynamic_filtering = 1;

SELECT trim(explain) FROM (EXPLAIN actions = 1 SELECT id FROM kv_float WHERE k = 5) WHERE explain ILIKE '%ReadType%';

INSERT INTO kv_array VALUES ([-0.], 0), ([0.], 1);

-- The mutation is killed, and the part keeps the old type.
SELECT min(x), max(x) FROM t_05454_narrowing;

SELECT avgWeightedDistinct(v, w), avgWeightedDistinct(v::Nullable(UInt32), w::Nullable(Float64)) FROM t_variant_tuple_distinct;

SELECT 'dynamic', (SELECT arraySort(groupArray((x, toString((d.Int64, d))))) FROM t_dynamic) = (SELECT arraySort(groupArray((x, toString((d.Int64, d))))) FROM t_dynamic_mem);

DROP TABLE IF EXISTS t_lc_fixed_empty;

SELECT 'computed primary key';

DROP TABLE IF EXISTS probe_ts;

DROP TABLE build_dt;

SELECT 'only NULL keys anti', count(), sum(v) FROM probe AS p LEFT ANTI JOIN build_null AS b ON p.k = b.k;

SELECT JSONExtract('{"createdAt":"2026-10-19T07:30:26.743Z"}', 'createdAt', 'DateTime64(3, \'UTC\')');

-- Compact sources merged into a Wide part: a Compact part has no per-column sizes, so the merge must size
-- its granularity by the Compact parts' total size rather than by nothing, which would make one huge granule.
DROP TABLE IF EXISTS t_json_gran_cw;

DROP TABLE kv_dec;

SELECT '(a, b) IN (SELECT toFloat32(0.29), 1)', arraySort(groupArray(id)) FROM kv_multi WHERE (a, b) IN (SELECT toFloat32(0.29), 1);

-- The GROUP BY top-K heap ranks the rows one by one and keeps the count state. CI's profile sets max_rows_to_group_by
-- and randomizes the top-K limit, which turn the heap off, so both are pinned and the plan is checked.
SELECT 'top_k_heap',
    (SELECT groupArray((s, c)) FROM (SELECT s, count() AS c FROM t_lc_count GROUP BY s ORDER BY s LIMIT 10 SETTINGS enable_group_by_top_k_optimization = 1, max_rows_to_group_by = 0, query_plan_max_limit_for_top_k_optimization = 1000, serialize_query_plan = 0, enable_parallel_replicas = 0))
    = (SELECT groupArray((s, c)) FROM (SELECT CAST(s AS String) AS s, count() AS c FROM t_lc_count GROUP BY s ORDER BY s LIMIT 10 SETTINGS enable_group_by_top_k_optimization = 0));

DROP TABLE t_small_read;

INSERT INTO t_set_shadow SELECT number, number % 10, number % 7 FROM numbers(100);

SELECT sumMapArgMax(t, k)
FROM (SELECT if(number = 1, NULL, tuple(['a'], [(number + 1)::Variant(UInt64)])) AS t, number::UInt8::Variant(UInt8) AS k FROM numbers(3));

INSERT INTO t_graphite_final_partitions VALUES ('sum_1', 960001300, 2, 2);

CREATE DICTIONARY range_dict_sc
(
    id UInt64,
    range_start Date,
    range_end Date,
    arr Array(String),
    m Map(String, UInt64),
    str String,
    nstr Nullable(String),
    n UInt64,
    j JSON,
    nj Nullable(JSON)
)
PRIMARY KEY id
SOURCE(CLICKHOUSE(TABLE 'dict_src' DB currentDatabase()))
LIFETIME(MIN 0 MAX 0)
LAYOUT(RANGE_HASHED())
RANGE(MIN range_start MAX range_end);

SELECT age('week', toDateTime64('2290-01-07 00:00:00.000', 3), toDateTime64('2015-08-18 00:00:00.000', 3)), age('week', toDateTime64('2290-01-08 00:00:00.000', 3), toDateTime64('2015-08-18 00:00:00.000', 3));

SELECT coalesce(if(number = 0, toNullable('first'), NULL), coalesce(CAST('x' AS Enum8('x' = 1, 'y' = 2)), intDiv(1, number + 1))) FROM numbers(3) SETTINGS short_circuit_function_evaluation = 'force_enable';

SELECT count() FROM system.parts WHERE database = currentDatabase() AND table LIKE '.inner_id.samples.%' AND active;

insert into spill_scheduler_05459_1 select cast(rand() as String) as k, cast(rand() as String) as x from numbers(1000000);

-- Tag no-parallel: the failpoints fail the deferred fsync of all inserts with `fsync_after_insert` and the syncs of all deduplication logs in the server
-- Tag no-fasttest: tests that enable a failpoint run alone, so they are kept out of the fast test
-- Tag no-object-storage: fsync is not applicable to object storage

-- When the fsync of a part fails, the part is removed from the deduplication log, and the removal is synced before the part is detached.
-- If syncing the removal fails, the part is not detached. The removal is not known to be durable then, and syncing the log again
-- would not prove otherwise, so later attempts to detach a part that failed to sync must not detach it either.

DROP TABLE IF EXISTS t_fsync_error_dedup_log;

SELECT tags, value FROM prometheusQuery(ts, 'last_over_time(absent_over_time(up[5m])[1s:1m])', 1700000000);

-- `b` and `p` take only one of the empty keys of `keys`, so that the empty keys do not multiply the result.
CREATE TABLE b (k String, j UInt64) ENGINE = Memory;

-- a throwing `max_rows_to_read` turns off skip indexes on data read, the test profile sets it
SET max_rows_to_read = 0;

SELECT k FROM t_skip_index_vector ORDER BY L2Distance(vec, [1.0, 0.0]) LIMIT 1 SETTINGS log_comment = 'skip_index_vector_1';

SELECT 'hash', count() FROM p JOIN b ON p.k = b.k
SETTINGS join_algorithm = 'hash', min_rows_for_packed_string_keys_in_hash_join = 0, log_comment = '05463:hash:0';

-- idx_a is applied at read time, the projections read all parts, so idx_a is not used
SELECT k FROM t_skip_index_projection WHERE a = 5 SETTINGS optimize_use_projections = 1, use_skip_indexes_on_data_read = 1, log_comment = 'skip_index_projection_8';

DROP TABLE t_skip_index_runtime_fact;

SELECT (SELECT groupArray((g, u)) FROM (SELECT g, uniqExact(ip) AS u FROM t_grouped_uniq_exact GROUP BY g ORDER BY g))
     = (SELECT groupArray((g, u)) FROM (SELECT g, toUInt64(count()) AS u FROM (SELECT DISTINCT g, ip FROM t_grouped_uniq_exact) GROUP BY g ORDER BY g));

-- Defaults that read each other through a subcolumn cannot be ordered, as for `INSERT INTO t_cycle (id) VALUES`.
CREATE TABLE t_cycle (id UInt32, a Tuple(x UInt32) DEFAULT tuple(b), b UInt32 DEFAULT a.x) ENGINE = MergeTree ORDER BY id;

INSERT INTO t_unconvertible_stats VALUES (2, '2026-07-17 00:00:00');

SELECT toTypeName(toStartOfInterval(toDate32('2000-01-01'), INTERVAL 1 YEAR)), toTypeName(toStartOfInterval(toDate32('2000-01-01'), INTERVAL 1 DAY));

SELECT count() FROM t_epoch WHERE toStartOfInterval(d, INTERVAL 1 WEEK) >= toDate('2100-01-01');

SELECT 'the primary key is still used where the rounding fits';

CREATE TABLE t_tuple_sparse (k UInt8, t Tuple(a UInt64, b UInt64)) ENGINE = MergeTree ORDER BY tuple() SETTINGS ratio_of_defaults_for_sparse_serialization = 0.5;

INSERT INTO t_first_applicable_ttl SELECT number, toString(number) FROM numbers(10000);

DROP TABLE t_first_applicable_pco;

SELECT j, JSONAllPathsWithTypes(arrayElement(j.e1[], 1)), JSONAllPathsWithTypes(arrayElement(j.e2[], 1))
FROM (SELECT CAST('{"a" : 0, "e1" : [{"x" : "hello"}], "e2" : [{"x" : "2024/01/02"}]}', 'JSON') AS j);

SELECT toTypeName(sumMergeStateOrNull(s)), finalizeAggregation(sumMergeStateOrNull(s)) FROM aggregate_merge_or_null;

DROP TABLE aggregate_merge_or_null_state;

SELECT 'arrays with more than one NULL';

SELECT coalesce(if(intDiv(100, number) > 0, NULL, NULL), if(number = 0, toNullable(1), NULL), intDiv(100, number)) FROM numbers(2);

DROP TABLE IF EXISTS two_keys_b;

CREATE TABLE two_keys_b (k UInt64, s UInt64, v UInt64) ENGINE = MergeTree ORDER BY k;

INSERT INTO two_keys_b SELECT number % 2, intHash64(number), number FROM numbers(1000);

SELECT if(explain LIKE '%FullSortingMergeJoin%', 'merge join', 'hash join') FROM (EXPLAIN PLAN SELECT sum(probe.v + build_small.v) FROM probe JOIN build_small ON probe.k = build_small.k)
WHERE explain LIKE '%Algorithm:%';

SELECT '-- join_algorithm set explicitly in a subquery only: its join stays a hash join';

DROP TABLE sorted3;

SELECT count() FROM system.detached_parts WHERE database = currentDatabase() AND table = 't_fsync_error_evicted_dedup_record';

SELECT formatQuerySingleLine('SELECT x[`not`], f(`not`, 1), `not`.y');

SET enable_lateral_join = 0;

CREATE TABLE t_update (d DateTime('UTC'), p UInt8, v UInt64)
ENGINE = ReplicatedMergeTree('/clickhouse/tables/{database}/t_update', 'r1')
PARTITION BY p ORDER BY d
TTL d + INTERVAL 1 DAY
SETTINGS ttl_only_drop_parts = 1, materialize_ttl_recalculate_only = 0;

SELECT 'single child';

CREATE TABLE neg_named_merge (k UInt8, t Tuple(UInt8, UInt8, UInt8)) ENGINE = Merge(currentDatabase(), '^neg_named$');

-- The part has no `n`, so it is computed from `s` when the part is read.
ALTER TABLE t_prewhere_default ADD COLUMN n UInt64 DEFAULT toUInt64(s);

INSERT INTO t_relation_stats_uk_r SELECT number, number % 1000, 1000 + number % 1000, number % 1000 FROM numbers(1000);

-- The `SHUFFLE` clause returns the rows in a random order. The tests check that the set of rows is preserved
-- (the order is random, so the results are checked in an order-independent way).

-- The clause is experimental.
SET allow_experimental_shuffle_query = 0;

SELECT 'Subqueries';

WITH
    (SELECT extract(explain, '\\bd\\[(?:no_stats~)?(\\d+)\\]') FROM (EXPLAIN actions = 1, compact = 1, pretty = 1
        SELECT sum(f.v) FROM fact AS f JOIN dim AS d ON f.k = d.k WHERE d.y = 1) WHERE explain LIKE '%⋈%') AS alone,
    (SELECT arraySort(groupArray(extract(explain, '\\bd\\[(?:no_stats~)?(\\d+)\\]'))) FROM (EXPLAIN actions = 1, compact = 1, pretty = 1
        SELECT sum(v) FROM branches WHERE tag = 'a' AND y = 1) WHERE explain LIKE '%⋈%') AS by_string,
    (SELECT arraySort(groupArray(extract(explain, '\\bd\\[(?:no_stats~)?(\\d+)\\]'))) FROM (EXPLAIN actions = 1, compact = 1, pretty = 1
        SELECT sum(v) FROM branches WHERE b = 1 AND y = 1) WHERE explain LIKE '%⋈%') AS by_cast_integer,
    (SELECT arraySort(groupArray(extract(explain, '\\bd\\[(?:no_stats~)?(\\d+)\\]'))) FROM (EXPLAIN actions = 1, compact = 1, pretty = 1
        SELECT sum(v) FROM branches WHERE n IS NOT NULL AND y = 1) WHERE explain LIKE '%⋈%') AS by_null,
    (SELECT arraySort(groupArray(extract(explain, '\\bd\\[(?:no_stats~)?(\\d+)\\]'))) FROM (EXPLAIN actions = 1, compact = 1, pretty = 1
        SELECT sum(v) FROM branches WHERE n IS NULL AND y = 1) WHERE explain LIKE '%⋈%') AS by_is_null
SELECT alone NOT IN ('', '0'), by_string = arraySort(['0', alone]), by_cast_integer = arraySort(['0', alone]), by_null = arraySort(['0', alone]), by_is_null = arraySort(['0', alone]);

ALTER TABLE t_set ADD COLUMN x UInt64;

SELECT count() FROM t_cmp_const_string WHERE intDiv(10, x) > 1 AND notEmpty(s);

DROP VIEW IF EXISTS v_05481_preallocated;

DROP VIEW v_05481;

CREATE VIEW v_cross AS SELECT id, y, k FROM t ARRAY JOIN a AS x CROSS JOIN r ARRAY JOIN x AS y;

-- Groups with equal counts can take each other's place, so only the counts are compared.
SELECT 'keys64, ORDER BY count() LIMIT',
    (SELECT arraySort(groupArray(cnt)) FROM (SELECT d, s, count() AS cnt FROM v_05482 GROUP BY d, s ORDER BY cnt DESC LIMIT 10)
        SETTINGS enable_fixed_and_packed_string_keys_in_aggregation = 1, enable_adaptive_aggregator = 1)
    = (SELECT arraySort(groupArray(cnt)) FROM (SELECT d, s, count() AS cnt FROM v_05482 GROUP BY d, s ORDER BY cnt DESC LIMIT 10)
        SETTINGS enable_fixed_and_packed_string_keys_in_aggregation = 0, enable_adaptive_aggregator = 0)
SETTINGS log_comment = '05482_keys64_top_k';

SELECT count(), countIf(r % 2 != 0) FROM (SELECT number, r FROM (SELECT number, rand() AS r FROM numbers_mt(10000)) WHERE r % 2 = 0 ORDER BY r LIMIT 1000);

SELECT * FROM format(TSV, 'c1 String, c2 Float64, c3 String', 'a\t') SETTINGS input_format_tsv_allow_variable_number_of_columns = 1, input_format_tsv_empty_as_default = 1;

SELECT CASE 1 WHEN 0 THEN 'a' ELSE 1 END AS r, toTypeName(r);

SET query_plan_join_swap_table = 0, query_plan_optimize_join_order_limit = 10, query_plan_optimize_join_order_randomize = 0;

ALTER TABLE t MODIFY SETTING allow_experimental_cleanup_old_data_files_compaction = 1;

SELECT '-- json_type_escape_dots_in_keys of an insert or a query does not change the result, with and without the index';

-- Without GROUP BY keys the parts are merged in any order, so the replicas still share the shard.
SELECT count() FROM remote('127.0.0.{1|2|3}', currentDatabase(), t_offset_pr_sample)
SETTINGS parallel_replicas_mode = 'sampling_key', use_hedged_requests = 0, log_queries = 1, log_comment = 'offset_pr_count';

-- A non-aggregate function at that column number is accepted in GROUP BY.
CREATE TABLE pos_arg_function (a UInt64, CONSTRAINT c CHECK a IN (SELECT number + 1 FROM numbers(2) GROUP BY 1))
ENGINE = MergeTree ORDER BY a;

SELECT toUTCTimestamp(toDateTime64('2026-10-25 01:00:00.5', 1), 'Europe/Berlin');

SELECT
    (SELECT groupArray(k) FROM (SELECT k FROM t_aj_topk ARRAY JOIN arr AS x ARRAY JOIN range(x) AS y ORDER BY k LIMIT 10))
    = (SELECT groupArray(k) FROM (SELECT k FROM t_aj_topk ARRAY JOIN arr AS x ARRAY JOIN range(x) AS y ORDER BY k LIMIT 10 SETTINGS query_plan_top_k_through_array_join = 0));

SELECT MVTEncode('l', 2147483647)((0., 0.)::Point::Geometry)
     = MVTEncode('l', toInt64(2147483647))((0., 0.)::Point::Geometry);

SELECT k FROM t_pk_offset WHERE k > 31 AND _part_starting_offset + _part_offset = 40 SETTINGS log_comment = 'pk_offset_6' FORMAT Null;

SELECT p, round(contingency(b, c), 6) FROM t_crosstab_window_wrapped GROUP BY p ORDER BY p;

INSERT INTO g_est SELECT number, number FROM numbers(300);

DROP TABLE g_real;

SELECT parseDateTimeBestEffortOrNull('Nov-08-202', 'UTC');

INSERT INTO shuffle_injection_replicated SELECT number FROM numbers(1000);

SELECT k, dictGetOrNull('d_66294_hashed', 'value', k) AS v, toTypeName(v), dictGetOrNull('d_66294_hashed', 'name', k)
FROM (SELECT arrayJoin([0, 5, NULL, 7]::Array(Nullable(UInt64))) AS k);

SELECT groupArraySorted(3)(x) = arraySlice(arraySort(groupArray(x)), 1, 3) FROM values('x Float64', (nan), (3), (-inf), (1));

SELECT isIPAddressInRange(materialize(CAST(NULL AS Nullable(String))), '192.168.44.0/24'), toTypeName(isIPAddressInRange(materialize(CAST(NULL AS Nullable(String))), '192.168.44.0/24'));

-- Computed `LIMIT BY` expressions must run on the finalizer, including after-aggregation stages.
SELECT count() = 1000, uniqExact(number) = 1000
FROM
(
    SELECT DISTINCT number FROM remote('127.0.0.{1,2}', numbers(10000))
    SHUFFLE LIMIT 1 BY number % 1000
)
SETTINGS distributed_group_by_no_merge = 2, distributed_push_down_limit = 0;

SELECT dateDiff('microsecond', toDateTime64('1969-12-31 23:59:59.999999999', 9, 'UTC'), toDateTime64('1970-01-01 00:00:00', 9, 'UTC'));

SELECT 'sweep around the epoch, DateTime64(9), rows that disagree';

SELECT formatReadableTimeDelta(-0.25, 'seconds', 'milliseconds');

OPTIMIZE TABLE f_est FINAL;

-- The asserted per-query counters would depend on the coordinator's assignment under parallel replicas.
SET enable_parallel_replicas = 0;

DROP TABLE IF EXISTS t_rf_global_row_index_cast_name_skip;

-- A `NaN` member of a literal `IN` set cannot equal any integer: it is left out of the set, the other members are
-- kept. The mixed-type list makes the set convert its members one by one.

SELECT toInt32(0) IN (nan, 0);

ALTER TABLE t_proj_tuple_eq MATERIALIZE PROJECTION p SETTINGS mutations_sync = 1;

-- Two series of 'foo' with identifiers outside the id range of 'foo': one inside the selected time range, one after it.
-- The table name is qualified because an asynchronous insert through a table function resolves an unqualified name in the default database.
INSERT INTO FUNCTION timeSeriesTags({CLICKHOUSE_DATABASE:Identifier}.ts) (id, metric_name, tags) VALUES
    ((1, '00000000-0000-0000-0000-000000000001'), 'foo', map('env', 'other_id_inside')),
    ((2, '00000000-0000-0000-0000-000000000002'), 'foo', map('env', 'other_id_after'));

INSERT INTO s_real SELECT 0, number, number FROM numbers(300);

SELECT isNaN(roundToExp2(materialize(nan)));

SELECT
    (SELECT groupArray(name) FROM (SELECT name FROM t_aj_chain LEFT ARRAY JOIN a AS x LEFT ARRAY JOIN range(x) AS y ORDER BY name LIMIT 31))
    = (SELECT groupArray(name) FROM (SELECT name FROM t_aj_chain LEFT ARRAY JOIN a AS x LEFT ARRAY JOIN range(x) AS y ORDER BY name LIMIT 31 SETTINGS query_plan_top_k_through_array_join = 0));

SELECT id, j.p, dynamicType(j.p) FROM (SELECT id, json::JSON AS j FROM values('id UInt8, json String',
    (1, '{"p": "2024-01-01 00:00:00"}'), (2, '{"p": "1"}'), (3, '{"p": "1.5"}'), (4, '{"p": "2024-01-02 03:04:05"}')))
ORDER BY id;

SELECT 'real projection part: ' || toString(rows) || ' rows, ' || toString(marks - 1) || ' marks'
FROM system.projection_parts WHERE database = currentDatabase() AND table = 'k_real' AND name = 'p' AND active;

ALTER TABLE t_delete UPDATE d1 = toDateTime('2095-01-01 00:00:00', 'UTC') WHERE 1;

-- A `Buffer` over a `Distributed` table plans its buffers with a copy of the query, which must read only the columns the buffers provide.

-- An ALIAS column smaller than the physical ones.
CREATE TABLE dst_a (s String, a UInt8 ALIAS 1) ENGINE = MergeTree ORDER BY tuple();

DROP TABLE IF EXISTS t_first_applicable_lc;

SELECT 'scalar alias';

SELECT multiIf(number = 0, materialize(toDecimal32(-2147483648, 0)), number = 1, toDecimal32(1, 0), toDecimal128(1, 28)) FROM numbers(1);

SELECT 'Null that fits the inferred type';

-- An early `LIMIT` cancels the partitions that are still merging, whose source tables then destroy the states they keep.
SELECT 'early limit';

SELECT median(3) IGNORE NULLS FROM file(currentDatabase() || '_05497_x.parquet')
PREWHERE and(materialize(toNullable(materialize(1))), not(materialize(100) = *));

DROP TABLE IF EXISTS tab_p1_first;

SELECT 'file IN result', count() FROM (SELECT * FROM src WHERE k IN (5, 50000)) AS s INNER JOIN file(currentDatabase() || '_05497.parquet', Parquet, 'k Int64') AS t ON s.k = t.k
SETTINGS log_comment = '05497_file_in';

INSERT INTO src_types VALUES (1, '2020-01-02', '2020-01-02', 1.5, 5, 5, 'abc', '2020-01-02 00:00:00', '00000000-0000-0000-0000-000000000001', 'abc', 1.5, 5);

SELECT 'iceberg', countIf(explain LIKE '%ilter column:%k = 5%') FROM (EXPLAIN PLAN actions = 1
    SELECT count() FROM (SELECT * FROM src WHERE k = 5) AS s INNER JOIN ice AS t ON s.k = t.k);

INSERT INTO tab_asc SELECT 1, number, 1 FROM numbers(32768) SETTINGS max_block_size = 100000, max_insert_block_size = 100000, min_insert_block_size_rows = 100000, min_insert_block_size_bytes = 0, max_insert_threads = 1;

-- Each query must run the index analysis instead of reusing the marks found by a previous one.
SET use_query_condition_cache = 0;

INSERT INTO t_fold SELECT 10, number, 1, 500, number FROM numbers(16);

SELECT
    (SELECT sum(cityHash64(isNull(k), ifNull(k, 0), s)) FROM (SELECT if(number % 7 = 0, NULL, toInt128(number % 8000)) AS k, sum(number) AS s FROM lanes GROUP BY k))
  = (SELECT sum(cityHash64(isNull(k), ifNull(k, 0), s)) FROM (SELECT if(number % 7 = 0, NULL, toInt128(number % 8000)) AS k, sum(number) AS s FROM lanes GROUP BY k) SETTINGS enable_adaptive_aggregator = 0)
SETTINGS enable_adaptive_aggregator = 1, log_comment = 'nullable_wide';

ALTER TABLE t_epl_drop_partition DROP PARTITION 2;

SELECT 'keys256, prefetch off';

DROP TABLE t_json_non_finite;

OPTIMIZE TABLE t_rmt_background_profile FINAL;

-- A long old_parts_lifetime, so that a kept part cannot age out while the test runs.
CREATE TABLE t_default (k UInt32) ENGINE = MergeTree ORDER BY k SETTINGS old_parts_lifetime = 3600;

INSERT INTO c_real SELECT number, number, '' FROM numbers(300);

-- A frame start far before the partition stays at the first row, so every row adds only the rows that
-- entered the frame instead of aggregating the whole frame again.
SET max_execution_time = 20;

CREATE HYPOTHETICAL PROJECTION p ON m_est (SELECT b, uniqExact(v) GROUP BY b);

ALTER TABLE r_real ADD PROJECTION p (SELECT toUInt64(a) AS A, toUInt64(b) AS B, sum(v) GROUP BY A, B)
    WITH SETTINGS (index_granularity = 8192, index_granularity_bytes = 1024);

SELECT number FROM numbers(3) WHERE exists(SELECT 1) ORDER BY number SETTINGS execute_exists_as_scalar_subquery = 0, additional_result_filter = 'number > 0';

INSERT INTO f_est SELECT number, 1 FROM numbers(500);

-- the settings of an insert are not in its part, and they can make the insert copy the states into memory of their own
-- the insert of f_inserted gets smaller blocks of the aggregation than the estimate, so it writes a wide part

SET optimize_use_projections = 1, optimize_use_implicit_projections = 0, prefer_optimize_projection = 0, force_optimize_projection = 0,
    enable_parallel_replicas = 0, optimize_aggregation_in_order = 0;

-- The set is built once, and the query reads as many rows as without parallel replicas.
SELECT
    log_comment,
    ProfileEvents['SetsBuiltFromSubquery'] AS sets_built,
    read_rows = (
        SELECT read_rows FROM system.query_log
        WHERE type = 'QueryFinish' AND is_initial_query AND current_database = currentDatabase()
          AND event_date >= yesterday() AND log_comment = '05507_join_to_in_single_node') AS same_rows_as_single_node
FROM system.query_log
WHERE type = 'QueryFinish' AND is_initial_query AND current_database = currentDatabase()
  AND event_date >= yesterday() AND log_comment = '05507_join_to_in';

SELECT 'plan off', count() FROM (EXPLAIN PIPELINE SELECT uniqExact(x) FROM t_uint SETTINGS optimize_aggregation_in_order = 0) WHERE explain LIKE '%UniqExactInOrderTransform%';

-- 0.0, -0.0 and two NaNs with different bits, written by their bits.
INSERT INTO t_float SELECT arrayJoin([0., reinterpretAsFloat64(toUInt64(9223372036854775808)), 1., reinterpretAsFloat64(toUInt64(9221120237041090560)), 2.]);

INSERT INTO t_sorted SELECT i128 FROM t_types;

CREATE TABLE t_sorted (x Tuple(Float64, UInt8)) ENGINE = MergeTree ORDER BY x;

SELECT 'layers', uniqExact(x), (SELECT uniqExact(x) FROM t_layers SETTINGS optimize_aggregation_in_order = 0) FROM t_layers SETTINGS max_threads = 8;

INSERT INTO t_no_layers SELECT toFloat64(number * 4 + 2) FROM numbers(10000);

SELECT sum(b.v) FROM dim AS d1, dim AS d2, fact AS b
WHERE d1.d = b.d AND d2.d = b.d + 1 AND b.k BETWEEN 100000 AND 110000 AND d1.d < 100 AND d2.d > 500
FORMAT Null SETTINGS log_comment = '05508_table_twice_off', enable_parallel_replicas = 0;

SELECT '-- the negated keys cover the whole probe range too, and the range of `k` says nothing about them: as with the alias';

DROP DICTIONARY IF EXISTS hashed_dict_sc;

SELECT '-- x matches both y and z, y does not match z';

-- A path that is a prefix of another path: `x` + `UInt64` and `xU` + `Int64` with the same bits.
SELECT uniqExact(j) FROM (SELECT arrayJoin(['{"x":9223372036854775808}', '{"xU":-9223372036854775808}'])::JSON AS j);

SELECT timestamp, value FROM prometheusQuery('ts_time_arguments', '7', toDateTime('2024-01-01 00:00:00', 'UTC'));

DROP TABLE t_backup;

SELECT count() FROM tab WHERE hasPhrase(s, 'the the') SETTINGS use_skip_indexes = 0, query_plan_direct_read_from_text_index = 0;

SELECT 'no key', cityHash64(hex(uniqExactState(s))), cityHash64(hex(uniqExactState(f5))), cityHash64(hex(uniqExactState(f16))), cityHash64(hex(uniqExactState(f64))), cityHash64(hex(uniqExactState(ip))) FROM uniq_exact_values SETTINGS max_block_size = 7;

SELECT 'GROUP BY, repeats', kr, cityHash64(hex(uniqExactState(sr))), cityHash64(hex(uniqExactState(f5r))), cityHash64(hex(uniqExactState(f16r))), cityHash64(hex(uniqExactState(f64r))), cityHash64(hex(uniqExactState(ipr))) FROM uniq_exact_values GROUP BY kr ORDER BY kr;

INSERT INTO uniq_exact_if_states SELECT uniqExactIfState(s, c), uniqExactIfState(f5, c), uniqExactIfState(f16, c), uniqExactIfState(f64, c), uniqExactIfState(ip, c) FROM uniq_exact_values GROUP BY k SETTINGS max_threads = 4;

SELECT number, lag(number, 2, 100) OVER w AS behind, lagInFrame(number, 2, 100) OVER w AS behind_in_frame, lead(number, 2, 100) OVER w AS ahead, leadInFrame(number, 2, 100) OVER w AS ahead_in_frame
FROM numbers(5) WINDOW w AS (ORDER BY number ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING) ORDER BY number;

CREATE TABLE t_str (k String, v UInt64) ENGINE = MergeTree() ORDER BY k;

SELECT trim(explain) FROM (EXPLAIN WHATIF SELECT a FROM t_bind WHERE b = 42) WHERE explain LIKE '  status:%' OR explain LIKE '  reason:%';

DESCRIBE TABLE v_typed_parameters_invoker(b = true, f = toFloat32(-0.25), d = '2024-01-01 00:00:00.5', n = 7, s = 'x', a = []);

SELECT tupleElement(n, 'zz', tupleElement(n, 'yy', n.c)) FROM t_nested ARRAY JOIN n ORDER BY 1;

-- Short-circuit path: only the missing key 9 gets the default expression.
SELECT 'dictGetOrDefault Array';

SELECT countIf(explain LIKE '%CreatingSet%') > 0 FROM (EXPLAIN SELECT count() FROM fs ANY INNER JOIN s ON x = y SETTINGS query_plan_convert_join_to_in = 1);

-- A `Map` argument, the other half of "array or map".
SELECT y + 1 FROM v1_05511 ARRAY JOIN map('k', 1) AS a ORDER BY 1;

-- `target_function` plus `cluster`; RELOAD FUNCTION prints ON CLUSTER before the name.
SELECT formatQueryFromJSON(parseQueryToJSON('SYSTEM RELOAD FUNCTION f ON CLUSTER c'));

CREATE TABLE l (k UInt64, v UInt64) ENGINE = MergeTree ORDER BY ();

SELECT g, sum(v) FROM t_05513_dist GROUP BY g WITH TOTALS ORDER BY g
    SETTINGS serialize_query_plan = 1;

SELECT x, toDecimalString(x, 0) FROM (SELECT arrayJoin([toDecimal64('1.2', 2), toDecimal64('-1.5', 2), toDecimal64('9.95', 2), toDecimal64('3', 2)]) AS x);

INSERT INTO gs_nested_join VALUES (1, 1), (7, 7);

SELECT 'hash', 'left semi a|b', r.v FROM l LEFT SEMI JOIN r ON l.a = r.a OR l.b = r.b SETTINGS join_algorithm = 'hash';

DROP TABLE IF EXISTS t_lambda;

-- Without a named collection, `x = 1` is an ordinary comparison and `x` resolves to the alias.
WITH 1 AS x SELECT count() FROM numbers(x = 1);

ALTER TABLE t_fold_drop DROP COLUMN b SETTINGS mutations_sync = 2;

SET legacy_array_join_function_nondeterministic_evaluation = 0;

SELECT key, count(), uniqExact(_shard_num) FROM dist GROUP BY key ORDER BY key SETTINGS prefer_localhost_replica = 0;

SELECT uniqExact(x, x) FROM (SELECT number % 3 AS x, number + 0 AS y FROM numbers(6) GROUP BY x, y) WHERE y < 10;

ATTACH TABLE {CLICKHOUSE_DATABASE_1:Identifier}.t_self (x UInt8, c0 Nullable(IPv6) ALIAS c0.null) ENGINE = Memory;

CREATE TABLE t_pr_ship_limit_2 (n UInt64) ENGINE = MergeTree ORDER BY n SETTINGS index_granularity = 128;

CREATE TABLE t_reprice_past_raw (x UInt64) ENGINE = MergeTree ORDER BY tuple()
SETTINGS min_bytes_for_wide_part = 0, index_granularity = 192, index_granularity_bytes = 0, min_compress_block_size = 1,
         enable_adaptive_codec_selection = 1, default_compression_codec = 'ZSTD(1)', adaptive_codec_selection_period = 8;

SELECT 'containers';

DROP TABLE IF EXISTS o;

INSERT INTO jb VALUES (true);

SELECT count() FROM ov WHERE EXISTS (SELECT 1 FROM i8 WHERE i8.u = ov.v);

SELECT 'concat', (SELECT sum(cityHash64(id, s || 'x')) FROM t_sparse_string) = (SELECT sum(cityHash64(id, s || 'x')) FROM t_full_string);

SELECT groupConcatArray(arr, '-') FROM values('arr Array(String)', ['a', 'b'], ['c']);

DROP TABLE IF EXISTS t_pk_folding;

SELECT formatQuerySingleLine('SHOW DATABASES ILIKE \'%sys%\' LIMIT 3');

-- dictGetOrDefault with a lazily executed (short-circuit) default expression on a FLAT
-- dictionary that has Array, Map, JSON and Nullable(JSON) attributes.
--
-- Behaviour source: docs/en/sql-reference/functions/ext-dict-functions.md (dictGetOrDefault)
-- and the description of `short_circuit_function_evaluation` in
-- docs/en/operations/settings/settings.md: a non-constant default expression is evaluated
-- only for the keys that the dictionary does not contain.
--
-- Existing dictionary tests pass a constant default for the complex attribute types, which
-- makes the default column eager; only String/UInt64 attributes were ever queried with a
-- lazily executed default.

SET short_circuit_function_evaluation = 'enable';

SELECT 'grace_hash', count() FROM t_bool JOIN t_int ON t_bool.k = t_int.k SETTINGS join_algorithm = 'grace_hash';

SELECT 'empty array', count() FROM (SELECT (CAST([], 'Array(Array(UInt8))'), k) AS k FROM t_bool) a JOIN (SELECT ([], k) AS k FROM t_int) b ON a.k = b.k;

-- Folding an AND chain must not remove the query's aggregate functions or arrayJoin, https://github.com/ClickHouse/ClickHouse/issues/129858

SET optimize_redundant_comparisons = 1;

-- rowNumberInBlock() = 1 has no columns, a swap of the tables moves it to the other side
SET query_plan_join_swap_table = 0;

CREATE DICTIONARY y (k UInt64, v String) PRIMARY KEY k SOURCE(CLICKHOUSE(TABLE 'x')) LAYOUT(FLAT()) LIFETIME(0);

DROP TABLE IF EXISTS pgi_alter;

SELECT count() FROM t WHERE (k, u) IN (SELECT (k, u) FROM t WHERE k % 2 = 0);

SELECT
    sumIf(n32, c) = sumIf(n32::Nullable(Decimal128(2)), c),
    sumIf(n64, c) = sumIf(n64::Nullable(Decimal128(3)), c),
    avgIf(n64, c) = avgIf(n64::Nullable(Decimal128(3)), c),
    sumIf(d64, nc) = sumIf(d64::Decimal128(3), nc),
    sumIf(n64, nc) = sumIf(n64::Nullable(Decimal128(3)), nc)
FROM t_narrow_decimals;

SELECT 'states, GROUP BY k';

SELECT count() FROM (SELECT 1 FROM t_if_const_agg HAVING if(1, 1, max(a) > 0));

-- The same for a number column.
SELECT countIf(explain LIKE '%Prewhere filter column%__topKFilter%' AND explain LIKE '%Prewhere filter column%n > 3%'),
    countIf(explain LIKE '%Filter column: n > 3%')
FROM (EXPLAIN actions = 1 SELECT n FROM t_top_k_prewhere WHERE n > 3 ORDER BY n LIMIT 5);

CREATE TABLE m_t (a Nullable(Int32), b Int32) ENGINE = Memory;

DROP TABLE IF EXISTS t_skip_index_disjunction;

CREATE TABLE t_l (k Enum8('b' = 2, 'c' = 3), e Enum16('x' = 300, 'y' = 301), t Tuple(Enum8('b' = 2, 'c' = 3))) ENGINE = Memory;

-- The inner join on the probe side hands the left join its key lazily indexed; the settings keep that plan.
SELECT l.x, m.y, r.k FROM (SELECT CAST(if(number % 2 = 0, 'b', 'c'), 'Enum8(\'b\' = 2, \'c\' = 3)') AS k, number AS x FROM numbers(10)) AS l
INNER JOIN (SELECT number AS x, number * 10 AS y FROM numbers(10) WHERE number % 3 != 1) AS m ON l.x = m.x
LEFT JOIN t_r AS r ON l.k = r.k ORDER BY l.x
SETTINGS join_algorithm = 'hash', query_plan_join_swap_table = 0, query_plan_optimize_join_order_limit = 1,
    enable_join_runtime_filters = 0, query_plan_min_columns_for_join_lazy_indexing = 1;

DROP TABLE IF EXISTS t_granules_dropped_estimation;

DROP VIEW v_05569;

SELECT l.n, d.v FROM (SELECT number AS n, 'b' AS k FROM numbers(2)) AS l INNER JOIN dict_cache AS d ON l.k = d.k ORDER BY l.n;

SELECT count() FROM (SELECT 1 FROM numbers(5) HAVING NOT (dictGet('d_simple_keep_agg', 'name', count()) = 'zzz'));

-- Partition pruning of a mutation.
DROP TABLE IF EXISTS t_collision_rmt;

CREATE TABLE t_iceberg (id Int64, m Map(Array(Float32), String), n Map(Map(String, Int64), String), o Map(Array(Tuple(a Int64, b String)), String))
ENGINE = IcebergLocal((SELECT path FROM iceberg_path), 'Parquet');

INSERT INTO t_subquery_join VALUES (1);

DROP TABLE t_subquery_normal;

INSERT INTO t_squash_ratio SELECT number FROM numbers(1000) SETTINGS insert_squashing_max_memory_ratio = 0.000000000001;

INSERT INTO t_ratio_replicated SELECT number + 20000, number * 5, repeat('y', number % 30) FROM numbers(20000);

INSERT INTO t_null_in_sort VALUES (1), (2), (NULL), (3), (1);

ALTER TABLE t_cast_sample COMMENT COLUMN x 'c' SETTINGS cast_keep_nullable = 1;

-- The hashes of the uncompressed content cover the marks (which depend on the buffers), but not the compressed bytes.
-- Projections written on insert use adaptive buffers by the ratio, so they differ.
SELECT 'insert, replicated vs no ratio',
    (SELECT arraySort(groupArray(tuple(hash_of_uncompressed_files, uncompressed_hash_of_compressed_files))) FROM system.projection_parts
        WHERE database = currentDatabase() AND table = 't_proj_ratio_replicated' AND name = 'p1' AND active)
    = (SELECT arraySort(groupArray(tuple(hash_of_uncompressed_files, uncompressed_hash_of_compressed_files))) FROM system.projection_parts
        WHERE database = currentDatabase() AND table = 't_proj_no_ratio_replicated' AND name = 'p1' AND active);

-- A LIMIT range with ALL sets is_limit_after_all and adds LIMIT AFTER and LIMIT UNTIL.
SELECT replaceRegexpOne(maxIf(explain, explain NOT LIKE ' %'), '^QUERY id: [0-9]+', 'QUERY') AS root,
       arraySort(groupArrayIf(trimBoth(explain), explain LIKE '  %' AND explain NOT LIKE '   %')) AS sections
FROM (EXPLAIN QUERY TREE run_passes = 0
      SELECT number FROM numbers(10) ORDER BY number LIMIT AFTER number IN (2, 6) ALL UNTIL number = 4);

-- Genuinely negative (signed) arguments keep their documented meaning.
SELECT left('abcdefghij', -1) AS a, right('abcdefghij', -1) AS b, substring('abcdefghij', 3, -1) AS c, substring('abcdefghij', -1) AS d, byteSlice('hello', 2, -1) AS e;

DROP TABLE IF EXISTS t_lc_05582;

-- Fully owned TimeSeries tables can still be truncated.
CREATE TABLE t_05595_owned ENGINE = TimeSeries;

DROP TABLE IF EXISTS t_variant_datetime64_scale;

SELECT dateDiff('minute', d0, d1), dateDiff('second', d0, d1), dateDiff('millisecond', d0, d1), dateDiff('microsecond', d0, d1), dateDiff('nanosecond', d0, d1), dateDiff('hour', d0, d1, 'Pacific/Tongatapu')
FROM (SELECT toDate('1970-01-01') AS d0, toDate('1970-01-02') AS d1);

ALTER TABLE t_alias ADD COLUMN e UInt8, UPDATE e = 3 WHERE e = 0;

SELECT 'Int8', (SELECT boundingRatio(toInt8(x), toInt8(y)) FROM t_bounding_ratio), (SELECT boundingRatio(toInt8(x), toInt8(y)) FROM t_bounding_ratio GROUP BY k);

SELECT '-- order by: the sort order of the gather';

-- A `LowCardinality` fixed-width key in the sorting key.
SET allow_suspicious_low_cardinality_types = 1;

CREATE TABLE t_alias (k UInt64, s String ALIAS k) ENGINE = MergeTree ORDER BY k SETTINGS index_granularity = 4;

SELECT 'date', count() FROM (EXPLAIN indexes = 1 SELECT count() FROM t_date WHERE toString(d) IN (SELECT toDate('2020-03-01')))
    WHERE explain ILIKE '%Condition: (toString(d) in %';

DROP TABLE IF EXISTS t_pr_aj_set_left;

CREATE VIEW v_describe DEFINER = CURRENT_USER SQL SECURITY DEFINER AS SELECT {p:UInt64} AS p, (SELECT max(id) FROM t_private) AS m;

SELECT log_comment, count()
FROM system.query_log
WHERE current_database = currentDatabase() AND NOT is_initial_query AND type = 'QueryFinish' AND log_comment IN ('sealed_twice', 'two_views')
GROUP BY log_comment
ORDER BY log_comment;

DROP ROW POLICY IF EXISTS p_rp_const ON t_rp_const;

DROP ROW POLICY p_rp_const ON t_rp_const_graphite;

SELECT '-- transform_null_in';

CREATE TABLE dist_string_as_low_cardinality_05617 (k UInt64, s LowCardinality(String))
ENGINE = Distributed(test_cluster_two_shards_different_databases, '', t_string);

INSERT INTO proj_src SELECT number + 20, toDateTime('2026-01-01 00:00:00') - number, toString(number) FROM numbers(10);

DROP TABLE IF EXISTS proj_minmax_commit_order;

CREATE TABLE proj_stored_src (id UInt64, ts DateTime, v String, PROJECTION by_id (SELECT *, _block_number, _block_offset ORDER BY id))
ENGINE = MergeTree ORDER BY ts
SETTINGS
    enable_block_number_column = 1,
    enable_block_offset_column = 1,
    allow_commit_order_projection = 1,
    part_minmax_index_columns = 'with_block_number_offset',
    index_granularity = 4;

SELECT k FROM t WHERE flag LIMIT 0 SETTINGS exact_rows_before_limit = 1, output_format_write_statistics = 0 FORMAT JSONCompact;

-- A Tuple naming some of the fields, and case-insensitive matching.
SELECT id, l FROM file(currentDatabase() || '_05617.orc', 'ORC', 'id UInt64, l Array(Tuple(a Int32, q Nullable(Int32)))') ORDER BY id;

SELECT id, ln FROM file(currentDatabase() || '_05617.orc', 'ORC', 'id UInt64, ln Nested(a Nullable(Int32), q Nullable(Int32))') ORDER BY id SETTINGS flatten_nested = 0;

-- Read rows, not an aggregate: an aggregate may be answered from part statistics without reading any part,
-- and then no partition is recorded.
SELECT id FROM dst_definer ORDER BY id SETTINGS log_comment = 'read_target' FORMAT Null;

SELECT 'horizontal', count(), countIf(text = 'beta'), min(id), max(id) FROM t_horizontal WHERE hasToken(text, 'beta')
SETTINGS use_skip_indexes = 1, force_data_skipping_indices = 'idx_text';

DETACH TABLE t_detached;

-- The next attempt starts only if the failed one did not terminate the server and scheduled a retry.
SYSTEM WAIT FAILPOINT mt_pause_before_loading_outdated_part PAUSE;

-- With runtime filters the optimized plan holds their lookup keys, so `JoinStep::clone` refuses and the
-- source is consumed by the in-place build, as before `JoinStep::clone` existed. Running a clone that
-- shares the keys with the original would register the same runtime filter twice and fail with
-- "Trying to insert into runtime filter after it was marked as finished".
SET enable_join_runtime_filters = 1;

CREATE TABLE t_full_fd (id UInt64, fs FixedString(5), d32 Decimal32(2), d64 Decimal64(4), d128 Decimal128(10), d256 Decimal256(20), dt DateTime64(3, 'UTC'), nfs Nullable(FixedString(5)), nd Nullable(Decimal64(4)))
ENGINE = MergeTree ORDER BY id
SETTINGS ratio_of_defaults_for_sparse_serialization = 1;

DROP TABLE IF EXISTS t_prune_i64;

DROP TABLE t_prune_i64;

CREATE TABLE t_bf_fixed
(
    m Map(String, String),
    `mapKeys(m)` FixedString(16),
    INDEX idx `mapKeys(m)` TYPE bloom_filter
)
ENGINE = MergeTree ORDER BY tuple();

-- Still used for the column itself.
SELECT count() FROM t_bf_array WHERE has(`mapKeys(m)`, 'x') SETTINGS force_data_skipping_indices = 'idx_k';

-- A column named like a `JSON` subcolumn is not that subcolumn.
CREATE TABLE t_bf_json_shadow
(
    j JSON,
    `j.a` Nullable(String),
    `j.t` Tuple(c String),
    `j.n` JSON,
    INDEX idx JSONAllPaths(j) TYPE bloom_filter,
    INDEX idx_n JSONAllPaths(`j.n`) TYPE bloom_filter
)
ENGINE = MergeTree ORDER BY tuple();

CREATE DICTIONARY dict_complex_direct (k1 UInt64, k2 String, a String, b String) PRIMARY KEY k1, k2
SOURCE(CLICKHOUSE(TABLE 'src_complex_direct')) LAYOUT(COMPLEX_KEY_DIRECT());

-- The tasks of a distributed query plan get an already optimized join and no row estimate. The 1000-row right side is
-- below `min_rows_for_packed_string_keys_in_hash_join`, so they compare the keys exactly, as a local join does.
SELECT count()
FROM t_left AS l INNER JOIN t_right AS r ON l.k = r.k
SETTINGS make_distributed_plan = 1, distributed_plan_execute_locally = 1, distributed_plan_fallback_to_local_execution = 0,
    enable_parallel_replicas = 0, max_rows_to_group_by = 0, join_algorithm = 'hash',
    query_plan_optimize_join_order_limit = 10, query_plan_optimize_join_order_randomize = 0,
    enable_packed_string_keys_in_hash_join = 1, min_rows_for_packed_string_keys_in_hash_join = 100000, log_comment = '05620_plan_small';

SELECT sum(o_price)
FROM orders JOIN (SELECT * FROM customer JOIN nation ON c_nationkey = n_nationkey WHERE n_name = 'a') AS cn ON c_custkey = o_custkey
SETTINGS query_plan_merge_expression_into_join = 1;

SELECT '-- the projection serves some of the parts';

SELECT `a.b` FROM m;

SELECT extract(explain, '(?:Read type|Virtual row conversions).*') AS e
FROM (EXPLAIN PLAN actions = 1, indexes = 0 SELECT b FROM t_fixed_key WHERE a IN (1) ORDER BY a, b LIMIT 5) WHERE e != '';

SYSTEM STOP MERGES t_fixed_key_3;

INSERT INTO t_fixed_key_ts SELECT toDateTime('2024-01-01 00:00:00', 'UTC') + number * 3600, 1000 - number FROM numbers(60);

-- 1. From one bucket to two.
CREATE TABLE q_one (x UInt64)
ENGINE = S3Queue('http://localhost:11111/test/05620_one/', 'username', 'password', CSV)
SETTINGS mode = 'ordered', buckets = 1, last_processed_path = 'one.csv',
         keeper_path = '/clickhouse/{database}/q_one';

-- 6. With pointers in both `<keeper_path>/processed` and bucket 0, the greater one is migrated.
CREATE TABLE q_dual_root (x UInt64)
ENGINE = S3Queue('http://localhost:11111/test/05620_dual_root/', 'username', 'password', CSV)
SETTINGS mode = 'ordered', buckets = 1, last_processed_path = 'd.csv',
         keeper_path = '/clickhouse/{database}/q_dual_root';

SELECT 'peer / bucket 1', count(), max(JSONExtractString(value, 'file_path')) FROM system.zookeeper
WHERE path = '/clickhouse/' || currentDatabase() || '/q_peer/buckets/1' AND name = 'processed';

SELECT 'recalculate, -State';

EXPLAIN
SELECT x, y, countResample(1, 31, 1)(toDayOfMonth(d)) AS days
FROM t_points GROUP BY x, y HAVING count() = 10
SETTINGS param__internal_join_table_stat_hints = '{"t_points": {"cardinality": 2000000000, "avg_row_bytes": 10, "distinct_keys": {"x": 2000000000}}}';

SELECT id, e FROM format(CSV, 'id UInt8, e Enum8(\'x\' = 1, \'y\' = 2)', '1,z\n2,y\n') ORDER BY id SETTINGS input_format_csv_use_default_on_bad_values = 1;

SELECT count() FROM (SELECT count() FROM t_gs_empty_set_filter GROUP BY GROUPING SETS (('k'), (a))) WHERE identity(0);

DROP VIEW ordered_05621;

DROP TABLE t_nested_in;

SELECT
    ProfileEvents['CompressedWriteBufferBlocks'] > 0,
    ProfileEvents['CompressedWriteBufferBytes'] >= 800000
FROM system.query_log
WHERE current_database = currentDatabase() AND type = 'QueryFinish' AND query_kind = 'Insert'
    AND has(tables, currentDatabase() || '.t_compressed_write_buffer');

SELECT a % 2 AS k, sum(a % 2), sum(a), count(), any(a % 2) RESPECT NULLS, quantile(0.5)(a), uniqExact(b) FROM t_projection_stored_query GROUP BY k ORDER BY k SETTINGS force_optimize_projection_name = 'p_alias';

DROP TABLE t_projection_stored_query_distinct;

SELECT [[[number]], [[number + 1], []]] FROM numbers(2);

INSERT INTO t_05627_fact SELECT number, number * 10 FROM numbers(1000);

-- Exercise empty rows, zero repeats and numeric copy sizes on both sides of the 64- and 128-byte boundaries.
-- Validate each result element from its row and element index, independently of the copied source array.

SELECT 'UInt8', count(), countIf(length(a) != number % 132 OR arrayExists((x, i) -> x != (toUInt8(number * 1000 + i - 1)), a, arrayEnumerate(a)))
FROM
(
    SELECT number, arrayJoin(arrayWithConstant(number % 15, arrayMap(i -> toUInt8(number * 1000 + i), range(number % 132)))) AS a
    FROM numbers(512)
);

-- Neither read has an alias, and the two subqueries differ only in `WHERE` against `PREWHERE`.
SELECT count(), sum(d.v), sum(b.v), sum(a.v)
FROM t_occ_d AS d, (SELECT id, k, v FROM t_occ_t WHERE id < 20000) AS a, (SELECT id, k, v FROM t_occ_t PREWHERE id < 20000) AS b
WHERE d.id = b.id AND a.id = b.k
SETTINGS log_comment = '05628_warmup_subqueries';

INSERT INTO t_null_as_default_dst SELECT * FROM file(currentDatabase() || '_null_as_default.avro');

DROP TABLE IF EXISTS t_jit_empty_in_set;

DROP TABLE t_explicit_default;

-- The ANTI JOIN keeps only the rows whose `v` is a number.
SELECT count(), sum(v.u)
FROM (SELECT l.k AS k, toUInt64(l.v) AS u FROM t_rf_str AS l LEFT ANTI JOIN (SELECT k FROM t_rf_right WHERE k != 2) AS b ON l.k = b.k) AS v
INNER JOIN (SELECT toUInt32(2) AS k) AS n ON v.k = n.k;

SET allow_reserved_column_names = 0;

SELECT 'without the cache', max(c), count(), sum(k) FROM (SELECT blockSize() AS c, k FROM t_small_granules_cc) SETTINGS use_columns_cache = 0;

INSERT INTO t_mutation VALUES (1, (5), [(6), (7)], {'k': (8)}), (2, (9), [], {});

SELECT 'JSONStringsEachRow', * FROM format(JSONStringsEachRow, 'e Enum8(\'a\' = 1, \'b\' = 2)', '{"e": "NULL"}');

-- A normal projection that does not cover the query and cannot be read through the projection index only drops
-- parts, so its primary-key analysis stops refining a part at the first match. The dropped parts and the result must not change.

SET explain_query_plan_default = 'legacy';

SET compile_expressions = 0, max_threads = 1, max_block_size = 65536;

DROP TABLE t2_05628;

-- No table freezes, so the partitions of the merge read the tables through their indexes. The states own
-- memory, so they stay in their source tables until the merge of their partition takes them.
SELECT 'string key, no freeze';

SELECT 'Nullable(UInt64)', countIf(byteSize(arrayMap(i -> if(i % 3 = 0, NULL, toUInt64(i)), range(number % 37))) != 8 + 9 * (number % 37)) FROM numbers(1000);

SELECT count(), uniqExact(hex(fs))
FROM (SELECT toFixedString(toString(number % 7), 16) AS fs, arrayJoin(range(number % 5)) AS x FROM numbers(1000));

DROP TABLE ie_ranges;

SELECT number AS `format` FROM numbers(10) LIMIT AFTER `format` = 7;

DROP TABLE t_no_column_read;

-- Key 3: the matching version is the only one.
INSERT INTO t_partitions VALUES (3, 4, 1, 1);

INSERT INTO t_collapsing VALUES (100, 0, 0, -1);

INSERT INTO t_summing VALUES (1, 1, 2);

CREATE TABLE t_window_layers_reverse_read (a Int32, b UInt32) ENGINE = MergeTree ORDER BY (a, b) SETTINGS index_granularity = 100;

-- Windows without scatter keys: a floating-point `PARTITION BY` key, and a window with only `ORDER BY`.
DROP TABLE IF EXISTS t_window_function_settings_no_scatter;

CREATE TABLE t_column_ttl_enum_compact (id UInt32, d DateTime, e Enum8('a' = 1, 'b' = 2) TTL d + INTERVAL 1 DAY)
ENGINE = MergeTree ORDER BY id SETTINGS min_bytes_for_wide_part = 1000000000;

INSERT INTO t_patch_parts_many SELECT number, number, '' FROM numbers(2000, 1000);

DROP TABLE IF EXISTS bnl_enum_r;

DROP TABLE IF EXISTS t_direct_enum_right;

SELECT accurateCastOrNull(t, 'Tuple(e Enum8(\'x\' = 1, \'y\' = 2))') FROM (SELECT CAST(tuple(v), 'Tuple(e Variant(Array(UInt8), String))') AS t FROM (SELECT arrayJoin([[1]::Array(UInt8)::Variant(Array(UInt8), String), NULL]) AS v));

INSERT INTO t_unloaded_nullable_key SELECT number, if(number % 7 = 0, NULL, number) FROM numbers(100);

DROP TABLE t_unloaded_nullable_key_partitioned;

SELECT kqlMultiply(NULL, 3) AS x, toTypeName(x);

DROP TABLE IF EXISTS t_stats;

-- no-parallel: creates the global database `inner`.

-- A TimeSeries target in a database named `inner` is formatted to a query that parses back.
SELECT formatQuerySingleLine(formatQuerySingleLine('ATTACH TABLE ts ENGINE = TimeSeries TAGS `inner`.t'));

SELECT count(), sum(cityHash64(k, v, ver)) FROM t_vf_limit FINAL SETTINGS enable_vertical_final = 1, max_threads = 4, max_block_size = 64;

-- Tag no-fasttest: Iceberg needs Avro for its metadata
-- Tag no-replicated-database: the replicated DDL worker evaluates the `IcebergLocal` arguments without the session, so it does not see the `TEMPORARY TABLE iceberg_path`

-- `RENAME COLUMN` of the source column of a partition field of an Iceberg table failed with `UNKNOWN_IDENTIFIER`:
-- the `PARTITION BY` clause of the stored table definition was not updated, while Iceberg refers to the column by its id.

SET allow_insert_into_iceberg = 1, allow_experimental_iceberg_compaction = 0, use_iceberg_metadata_files_cache = 0, iceberg_delete_data_on_drop = 0, async_insert = 0;

OPTIMIZE TABLE t_map_buckets_order FINAL;

ATTACH TABLE t_compound;

SELECT JSONExtract('{"n": 5, "status": "zzz"}', 'Tuple(n UInt8, status Enum8(\'a\' = 1, \'b\' = 2))');

DROP TABLE t_collapsing_pair_merge;

SELECT 'clear column', id, j FROM t_json_default_add_column ORDER BY id;

DROP TABLE IF EXISTS t_empty_ctas;

SELECT countIf(r = 0), maxIf(b, r = 0) < 32768, count(), countIf(finalizeAggregation(s) = k)
FROM
(
    SELECT blockSize() AS b, rowNumberInBlock() AS r, k, s
    FROM (SELECT number AS k, sumState(number) AS s FROM numbers_mt(9000000) GROUP BY k)
)
SETTINGS max_threads = 2, max_block_size = 65409;

-- A `LIMIT` that reads till the end does not, nor one above the input a join builds its table from.
SELECT countIf(explain ILIKE '%DistinctSortedStreamTransform%') > 0, countIf(explain ILIKE '%SelectByIndicesTransform%') > 0 FROM (EXPLAIN PIPELINE SELECT DISTINCT a, b FROM t_dvf FINAL LIMIT 5 SETTINGS enable_vertical_final = 1, exact_rows_before_limit = 1);

INSERT INTO t_jit_sort_dec VALUES (0, 0, -7.5, '1970-01-01 00:00:00.000', '00:00:00.000', -2.25, 3);

DROP TABLE t_jit_sort_dt64_mt;

CREATE TABLE f (a Array(UInt64), b UInt64) ENGINE = MergeTree ORDER BY arrayFilter(x -> x > b, a);

-- the partition key: the implicit projection and the aggregation of each partition independently
CREATE TABLE t_partition (a UInt32, arr Array(UInt8)) ENGINE = MergeTree ORDER BY a PARTITION BY arraySum(x -> x + a, arr);

ATTACH TABLE v_count;

SELECT 'ordinary, injective function key';

DROP TABLE t_pr_subquery;

SELECT count(), sum(a), countIf(a % 10 != 0) FROM mergeTreeProjection(currentDatabase(), t_pr_projection_read, p);

SYSTEM STOP MERGES statistics_parallel_probe;

-- `Distributed:` in EXPLAIN = the read used distributed index analysis: not with the skip index, but with `use_skip_indexes = 0` or without a skip index
SELECT count() > 0 FROM (EXPLAIN indexes = 1 SELECT count() FROM t_dia_final FINAL WHERE d = '2026-01-01' SETTINGS use_skip_indexes_if_final = 0, distributed_index_analysis = 1, distributed_index_analysis_for_non_shared_merge_tree = 1) WHERE explain LIKE '%Distributed:%';

SELECT toStartOfInterval(toDateTime64('1950-01-01 12:07:00', 0, 'Indian/Maldives'), INTERVAL 10 MINUTE);

SELECT count() FROM timeSeriesSelector(rx, '{__name__=~"zzz|m.*"}', 0, 2000, 'timestamp_and_value') SETTINGS log_comment = 'promql_anchor_3';

-- A nested map with a composite key is merged by `mergeMap`; its `Float64` values are kept as a row of the source column.
CREATE TABLE t_map (k UInt64, FirstMap Nested(k1 UInt32, k2ID Int8, s Float64)) ENGINE = SummingMergeTree ORDER BY k;

SELECT n FROM t_dotted PREWHERE `n.null` = 1 ORDER BY n;

SELECT uniqExact(x)
FROM
(
    SELECT now64(9) AS x
    UNION ALL
    SELECT now64(9) AS x
    FROM clusterAllReplicas('test_cluster_two_shards', system.one)
);

SELECT a, b FROM (SELECT [CAST('y', 'Enum8(\'x\' = 1, \'y\' = 2)')] AS a, [1, 2] AS b) ARRAY JOIN a, b SETTINGS enable_unaligned_array_join = 1;

-- no-fasttest: needs MinIO.
-- no-distributed-cache: reads through the distributed cache do not use remote prefetches.

-- Merges and queries on an encrypted remote disk must not cancel their prefetches. `ReadBufferFromEncryptedFile::prefetch`
-- used to start the inner prefetch before applying the pending seek and read range, so the first read discarded it.

DROP TABLE IF EXISTS t_encrypted_prefetch;

SELECT l.number, r.h FROM numbers(5, 1) AS l FULL JOIN (SELECT toUInt64(123) AS h FROM (SELECT 1) AS a CROSS JOIN (SELECT 1) AS b) AS r ON l.number = r.h ORDER BY ALL SETTINGS query_plan_join_swap_table = 'false';

SELECT 'v1 count, no index', count() FROM v_kc_null WHERE tenant = 3
  AND ((hr > toDateTime('2025-11-13 08:00:00', 'UTC') AND hr < toDateTime('2025-11-14 07:59:59', 'UTC')) OR hr IS NULL)
  SETTINGS use_primary_key = 0, use_skip_indexes = 0;

SELECT 'isNull(cast) exact count, implicit projections', count() FROM t_kc_null
WHERE CAST(toStartOfHour(ts) AS Nullable(DateTime('UTC'))) IS NULL SETTINGS optimize_use_implicit_projections = 1;

INSERT INTO v_default SELECT * FROM src WHERE id % 3 = 1;

ALTER TABLE big_batch MODIFY SETTING merge_use_batch_sorting_queue = 1;

SELECT 'JSONEachRow Tuple array', CAST(t, 'Tuple(UInt8, Int8)') FROM format(JSONEachRow, 't Tuple(UInt8, Enum8(''a'' = 1, ''b'' = 2))', '{"t": [1, null]}');

INSERT INTO t_nested_enum_null FORMAT JSONEachRow {"id": 3, "a": [null, "b"]}

SELECT id, a FROM t_nested_enum_null ORDER BY id;

SELECT 'Tuple(DateTime, DateTime64)', ts FROM t_rp_time_params ORDER BY ts;

CREATE TABLE t (a UInt64) ENGINE = MergeTree ORDER BY tuple() SETTINGS prewarm_mark_cache = 0;

SELECT fromModifiedJulianDayOrNull(toInt128('-18446744073709551616'));

CREATE TABLE es_overlapping (doc JSON(a Array(JSON), a.b Int64)) ENGINE = Elasticsearch('http://localhost:1', 'idx');

SELECT emptyArrayToSingle(materialize(CAST([], 'Array(Tuple(e Enum8(\'x\' = 1, \'y\' = 2), n UInt8))')));

SELECT JSONExtract('{"t":-4294967297}', 't', 'Nullable(Time)');

-- The end of the read is counted in tasks per thread of the pool, so the pool keeps all its threads.
SET read_backoff_min_latency_ms = 0;

SELECT arrayAll(x -> x = 0, timeSeriesStddevToGrid(300, 600, 30, 300)(arrayMap(i -> toUInt32(i * 10), range(1, 61)), arrayMap(i -> 1.5990505637277868, range(1, 61))));

SELECT payload FROM t_timestamp_guard WHERE s != 'invaliddatetime' AND timestamp(s) > '2020-01-01'
    SETTINGS optimize_move_to_prewhere = 1, query_plan_optimize_prewhere = 1, enable_multiple_prewhere_read_steps = 0;

DESCRIBE format(Form, 'a=%272026-11-17%27');

-- Regression test for https://github.com/ClickHouse/ClickHouse/issues/132103
-- transform() and CASE-with-expression must match a FixedString input against
-- a shorter String/FixedString entry, consistent with `=` semantics.

-- Core report: FixedString input, shorter String entry
SELECT transform(toFixedString('ab', 4), ['ab'], [1], 0);

CREATE VIEW keys AS
    SELECT
        toUInt32(number % 200) AS k,
        multiIf(number % 3 = 0, '', number % 3 = 1, toString(number % 7), repeat('x', 20 + number % 5)) AS s,
        number
    FROM lanes;

SELECT l.id, rr.e, CAST(rr.e, 'Int8'), rr.t, rr.s FROM jte_l AS l INNER JOIN (SELECT any(e) AS e, any(t) AS t, 'x' AS s, arrayJoin(if(count() = 1, [5], [])) AS z FROM jte_r GROUP BY k WITH TOTALS) AS rr ON l.id + 4 = rr.z ORDER BY ALL SETTINGS join_algorithm = 'grace_hash';

SELECT name, column
FROM system.projection_parts_columns
WHERE database = currentDatabase() AND table = 't_projection_window' AND active
ORDER BY name, column;

-- A value of another type in the shared variant.
SELECT d, dynamicType(d) FROM format(RowBinary, 'd Dynamic(max_types=0)', (SELECT formatRowNoNewline('RowBinary', 42::Int64::Dynamic(max_types=0))));

SELECT replaceRegexpAll(replaceRegexpOne(explain, '^[│└├─ ]+', ''), ', (size|set bits) [^,)]+', '')
FROM (EXPLAIN ANALYZE SELECT count() FROM t_probe_uint16 AS p INNER JOIN t_build_uint16 AS b ON p.k = b.k SETTINGS join_runtime_filter_exact_values_limit = 100)
WHERE explain LIKE '%Runtime filter (%';

SELECT a % 10 AS k, max(a % 10), count() FROM t_projection_twice GROUP BY k ORDER BY k
SETTINGS force_optimize_projection = 1, force_optimize_projection_name = 'p_aggregate';

SELECT formatQuery('ALTER NAMED COLLECTION c DELETE a, `b.c`, `d e`, `f.g h`, `i``j`') AS f, formatQuery(f) = f;

-- The format of a plain name does not change.
SELECT formatQuerySingleLine('CREATE WORKLOAD w IN p SETTINGS weight = 2, priority = 1 FOR r') AS f, formatQuerySingleLine(f) = f;

DROP TABLE IF EXISTS t_sorted_u64;

SELECT formatQuerySingleLine('INSERT INTO t FROM INFILE \'x\' FORMAT `My Format`') AS f, formatQuerySingleLine(f) = f;

INSERT INTO t_autopr_skip_in SELECT (number % 1000) * 5, number, repeat('x', 20) FROM numbers(200000);

SELECT DISTINCT CAST(u, 'Bool') AS c, k FROM t_cast_bool ORDER BY c, k SETTINGS optimize_distinct_in_order = 1;

SELECT * FROM format(MySQLDump, $$CREATE TABLE `t2` (`first name` int);

INSERT INTO FUNCTION file(currentDatabase() || '_05829_plain.parquet') SELECT * FROM src
SETTINGS output_format_parquet_write_page_index = 0, output_format_parquet_data_page_size = 100, output_format_parquet_batch_size = 1000,
    output_format_parquet_max_dictionary_size = 0;

SELECT * FROM file(currentDatabase() || '_05829_mismatch.parquet') ORDER BY x SETTINGS input_format_parquet_skip_columns_with_unsupported_types_in_schema_inference = 1;

SELECT id, t.x.x, t.j.a, a.x.x FROM s3(s3_conn, filename = '05829_url_s3/' || currentDatabase() || '.parquet', format = Parquet)
ORDER BY id SETTINGS log_comment = '05829_read_s3';

DROP TABLE IF EXISTS r_same_inner_set;

-- a projection can have a column and a subcolumn of that column

DROP TABLE IF EXISTS t_projection_subcolumn;

INSERT INTO t_projection_insert_settings VALUES (1, 10, 1), (1, 20, NULL), (2, 10, 3), (60, 3, NULL);

SELECT count(), sum(x) FROM file(currentDatabase() || '_05833.parquet') PREWHERE toNullable(1);

SELECT count(), any(s) FROM file(currentDatabase() || '_05833_pruning.parquet') PREWHERE e = 4321 SETTINGS log_comment = 'e_absent';

SELECT id, x FROM src WHERE x IS NOT NULL AND id % 500 = 0 ORDER BY id;

-- a column of the table can have the name that the planner gives to another column

-- parallel replicas can reject a forced projection, and they do not read a column that has such a name
SET enable_parallel_replicas = 0;

DROP DICTIONARY d_absent;

SELECT 'Tuple(UInt128)', count_radix, count_radix = count_ordinary FROM
(
    SELECT
        (SELECT uniqExact(x) FROM (SELECT tuple(toUInt128(number % 200000) * 1000003) AS x FROM numbers_mt(1000000)) SETTINGS optimize_uniq_exact_radix_partitioning = 1) AS count_radix,
        (SELECT uniqExact(x) FROM (SELECT tuple(toUInt128(number % 200000) * 1000003) AS x FROM numbers_mt(1000000)) SETTINGS optimize_uniq_exact_radix_partitioning = 0) AS count_ordinary
);

CREATE TABLE tab
(
    ts DateTime,
    payload String,
    flags Map(LowCardinality(String), Bool),
    INDEX idx_flags_keys mapKeys(flags) TYPE text(tokenizer = 'array')
)
ENGINE = MergeTree
ORDER BY ts
SETTINGS index_granularity = 8;

SELECT sum(v), count() FROM t_enum16 WHERE e > 0;

DROP ROW POLICY test_rp_proj ON test_row_policy_proj;
