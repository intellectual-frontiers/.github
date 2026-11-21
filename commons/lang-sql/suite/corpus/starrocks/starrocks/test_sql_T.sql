-- name: test_aa_statistic_behavior @sequential @slow

-- This case is used to test statistics collection behavior.
-- Include auto collection/partition first load
-- The order of this case is carefully adjusted. If the case is failed, do not delete it easily, there must be a bug.
-- Since async tablet stats report and auto collect statistics in the background will affect the behavior of statistics collection.
-- The inconsistency of the triggering timing order of the two will lead to inconsistent case results.
-- So we need to use SLEEP command in the case.
-- tablet stats report interval: 3s
-- auto collect statistics interval: 6s
-- sleep 5 means wait for tablet stats report
-- sleep 7 means wait for statistics auto collect
-- Since the default analyze job of collecting statistic will collect all databases and tables.
-- This time is uncontrollable in the testing environment. So we use an analyze job with `statistic_exclude_pattern` to replace it.

DROP DATABASE IF EXISTS test_statistic_behavior;

insert into source select generate_series, '2024-01-01' from table(generate_series(1, 150000));

-- no new partitions, wait for auto collect statistics. full_schedule_times increase once.
drop all analyze job;

create analyze all properties  ("statistic_exclude_pattern"="^(?!.*test_statistic_behavior).*$");

-- name: test_sink_parquet_partitioned @slow

insert into t1 select * from t1;

with 
    w_empty as (select * from t1 where c1 = 'not-exist'),
    w1 as (select k1, k2, count(1) as cnt from t1 group by k1, k2),
    w2 as (select k1, k2, c1, count(1) as cnt from t1 group by k1, k2, c1)
select /*+SET_VAR(enable_runtime_adaptive_dop=true)*/
    count(1) 
from 
    t1 tt1
    join w_empty tt2 on tt1.k1=tt2.k1
    join t1 tt3 on tt1.k1=tt3.k1
    join w1 tt4 on tt1.k1=tt4.k1
    join w2 tt5 on tt1.k1=tt5.k1;

-- name: test_add_drop_field_struct @mac
create database test_add_drop_field_struct;

alter table tab1 modify column c1 add field val1 int;

drop table tab1;

alter table tab1 modify column c1 add field [*].val1 int;

use test_add_drop_field_not_allowed;

select distinct c17,c18,c19,c20,c21,c22,c23,c24 from all_t0 order by 1,2,3,4,5,6,7,8 limit 100,3;

select c7, sum(c1) from all_t0 group by 1 order by 1, 2 limit 3, 1;

select c19, sum(c1) from all_t0 group by 1 order by 1, 2 limit 3, 1;

select c9, sum(c1) from all_t0 group by 1 order by 1 desc, 2 desc limit 1;

select c3, c5, sum(c1) from all_t0 group by 1,2 order by 1, 2, 3 limit 30,1;

select distinct c1,c2,c3,c4 from all_decimal order by 1,2,3,4 limit 100,3;

select c2, c3, sum(c1) from all_decimal group by 1,2 order by 1,2,3 limit 1;

insert into all_numbers_t0 (c1, c2, c3, c4, c5, c13, c14, c15, c16, c17) values (-128, -32768, -2147483648, -9223372036854775808, -170141183460469231731687303715884105728, -128, -32768, -2147483648, -9223372036854775808, -170141183460469231731687303715884105728);

select distinct c4 from all_numbers_t0 order by 1 limit 30,1;

select distinct c2,c1 from all_numbers_t0 order by 1,2 limit 30,1;

insert into all_numbers_t0 (c1, c2, c3, c4, c5, c13, c14, c15, c16, c17) values (127, 32767, 2147483647, 9223372036854775807, 170141183460469231731687303715884105727, 127, 32767, 2147483647, 9223372036854775807, 170141183460469231731687303715884105727);

select distinct k2 from agged_table;

select distinct c9, c10, c11, c12, c13, c14, c15, c16 from all_t1 order by 1,2,3,4,5,6,7,8 desc limit 1;

-- Test Case 40: DATE, DATETIME, STRING
WITH result AS (
    SELECT c6, c7, c8, COUNT(*) AS cnt FROM all_t0 GROUP BY c6, c7, c8 ORDER BY c6, c7, c8 LIMIT 100
) SELECT 'Test Case 40' AS test_name, MD5(GROUP_CONCAT(CONCAT(CAST(c6 AS STRING), ':', CAST(c7 AS STRING), ':', c8, ':', CAST(cnt AS STRING)))) AS result_hash FROM result;

-- Test Case 57: Nullable columns in all_numbers_t0
WITH result AS (
    SELECT c1, c5, COUNT(*) AS cnt FROM all_numbers_t0 GROUP BY c1, c5 ORDER BY c1, c5 NULLS FIRST LIMIT 100
) SELECT 'Test Case 57' AS test_name, MD5(GROUP_CONCAT(CONCAT(CAST(c1 AS STRING), ':', CAST(c5 AS STRING), ':', CAST(cnt AS STRING)))) AS result_hash FROM result;

-- Test Case 91: Colocate single column
-- Test Case 92: Colocate multi-column

-- Test Case 93: STRING with dictionary
WITH result AS (
    SELECT c8, COUNT(*) AS cnt FROM all_t0 GROUP BY c8 ORDER BY c8 LIMIT 100
) SELECT 'Test Case 93' AS test_name, MD5(GROUP_CONCAT(CONCAT(c8, ':', CAST(cnt AS STRING)))) AS result_hash FROM result;

insert into t3 values (1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1);

-- The same assertion as a single number.
select count(*) as num_groups from (select s1, s2 from t_len group by s1, s2) t;

-- DISTINCT goes through the hash set rather than the hash map.
select count(*) from (select distinct s1, s2 from t_len) t;

insert into t_huge values (101, 'short', 'k0');

select count(distinct c0) from t0;

insert into t0 SELECT generate_series, NULL FROM TABLE(generate_series(1,  1500));

select c0 from t0 group by c0 limit 10;

insert into t1 select * from t0;

with cte0 as (select avg(c3), sum(c3) sc3, c0 from t1 group by c0 limit 10000), cte1 as (select avg(c3), sum(c3) sc3, c0 from t0 group by c0 ) select count(*) from (select l.sc3, l.c0 from cte0 l join cte1 r on l.sc3 <=> r.sc3 and l.c0 <=> r.c0) t;

-- agg force streaming
set streaming_preaggregation_mode="force_streaming";

select * from (select max(c3), sum(c3) sc3, c0 from t5 group by c0 limit 10) t order by 3;

select count(*) from (select sum(c3) from t6 group by c1, c2 limit 10) t;

insert into tarray SELECT generate_series, [generate_series], generate_series FROM TABLE(generate_series(1,  100000));

select * from (select max(c3), sum(c3) sc3, c1 from agg_with_limit_seq group by c1 limit 10) t order by 3;

SELECT count(*), sum(if(a_v <=> m_v, 0, 1)), sum(if(a_s <=> m_s, 0, 1)), sum(if(a_w <=> m_w, 0, 1))
FROM (SELECT g, any_value(v) a_v, min(v) m_v, any_value(s) a_s, min(s) m_s, any_value(w) a_w, min(w) m_w
      FROM t GROUP BY g) x;

-- name: test_bucket_agg @mac
set pipeline_dop=1;

select sum(c1) from t0 group by c0, c2 order by 1 limit 5;

insert into t1 SELECT generate_series, 4096 - generate_series, generate_series FROM TABLE(generate_series(1,  4096));

select count(*) from (select distinct c0 from t2 limit 100) tb;

select sum(distinct c0), c2 from skew_agg group by c2;

select sum(distinct c3), avg(c2) from skew_agg group by 'abc';

select sum(distinct c3), avg(c2) from skew_agg;

select     /*+ SET_VAR (streaming_preaggregation_mode = 'auto',new_planner_agg_stage='3') */     (         ifnull(sum(murmur_hash3_32(week)), 0) + ifnull(sum(murmur_hash3_32(c0)), 0) + ifnull(sum(murmur_hash3_32(__col_0)), 0) + ifnull(sum(murmur_hash3_32(__col_1)), 0) + ifnull(sum(murmur_hash3_32(__col_2)), 0) + ifnull(sum(murmur_hash3_32(__col_3)), 0)     ) as fingerprint from     (         select             date_trunc('week', c4) as week,             c0, (array_length(array_agg(c1))) as __col_0,
(sum(distinct length(c2))) as __col_1, (length(group_concat(cast(c3 as VARCHAR)))) as __col_2, (min(c2)) as __col_3         from             skew_agg         group by             date_trunc('week', c4),             c0     ) as t;

select     /*+ SET_VAR (streaming_preaggregation_mode = 'force_streaming',new_planner_agg_stage='3') */  array_length(array_agg(a1)) as cnt from (select split('a,b,c', ',') as a1, 'aaa' as b1) t1 group by b1;

select group_concat(distinct c2, upper(c4) order by abs(c2 + c3)), array_agg(c3 order by 1, c4),  ceil(sum(c5)) from (select * from skew_agg order by 1,2,3,4,5,6 limit 10) t;

select group_concat(distinct 1), array_agg(distinct 2),  sum(c3) from skew_agg group by rollup(c1, c2);

select array_agg(distinct c2), count(distinct c2), sum(c3) from skew_agg group by rollup(c1, c2);

set enable_constant_execute_in_fe = false;

SELECT c0, count(*) FROM t0 GROUP BY GROUPING SETS ((c0), ()) ORDER BY 1 ASC LIMIT 3;

select v2, min(if(xx < 1, v2, v1 + 1)), sum(if(xx < 1, v2, v1 + 1)), max(v2 + v3) / sum(if(xx < 1, v2, v1 + 1)) from (select if(v1=1, 2, 3) as xx, * from t0) ff group by grouping sets ((xx, v2), (v2, v4));

-- Null-safe join runtime filter: IN (NULL, 1) keeps the grand total above the repeat.
SELECT a.c0, a.cnt FROM (SELECT c0, count(*) cnt FROM t0 GROUP BY ROLLUP (c0)) a JOIN [broadcast] r ON a.c0 <=> r.k ORDER BY 1;

INSERT INTO jitli SELECT generate_series, 1 FROM TABLE(generate_series(1, 5000)) g;

select count(*) from t0[_META_];

select count(c0) from t0[_META_];

insert into t1 TEMPORARY PARTITION(tp202403) values ('2024-03-10', 50), ('2024-03-15', 60), ('2024-03-20', 70);

-- name: test_meta_scan_with_renamed_column
create table t2 (
    c0 INT
) DUPLICATE key (c0) DISTRIBUTED BY HASH(c0) BUCKETS 3 PROPERTIES('replication_num' = '1');

-- ARRAY type with the feature enabled:
--   cover statistic-style collection size expressions, NDV and HLL_RAW via CRC32_HASH(v_array),
--   serialized HLL state, and scalar expressions wrapping aggregate results.

SELECT ds_hll_count_distinct_merge(ds_hll_count_distinct_state(s)) FROM t0;

-- make sure execuate dop = 1
create table t1 (
    c0 INT,
    c1 BIGINT
) DUPLICATE KEY(c0) DISTRIBUTED BY HASH(c0) BUCKETS 3 PROPERTIES('replication_num' = '1');

set spill_rand_ratio = 1.0;

select count(distinct tinyint_col_2) from t1;

select count(*), sum(array_length(a)), count(a[1]) from (select k, array_agg(if(1 = 0, v, null)) a from t1 group by k) t;

set enable_push_down_pre_agg_with_rank = true;

-- One non-null row.
with w1 as (select column_0 as c1 from ( values (1) )t)
select round(var_samp(c1), 3) from w1;

select round(var_samp(val1), 3) from t1_nonnull where k > 100;

-- One row.
with w1 as (select column_0 as c1 from ( values (1) )t)
select round(variance_samp(c1), 3) from w1;

select round(variance_samp(val1), 3) from t1_nonnull where k > 100;

-- One row.
with w1 as (select column_0 as c1 from ( values (1) )t)
select round(stddev_samp(c1), 3) from w1;

select round(stddev_samp(val1), 3) from t1_nonnull where k > 100;

-- One row.
with w1 as (select column_0 as c1, column_1 as c2 from ( values (1, 10) )t)
select round(covar_samp(c1, c2), 3) from w1;

SELECT
    k,
    val1,
    val2,
    round(covar_samp(val1, val2) over (
        ORDER BY k ASC 
        ROWS BETWEEN 2 PRECEDING and CURRENT ROW
    ), 3) AS covar_samp_val1
FROM t1
order by k;

-- Normal
--   Input is non-nullable.
select round(covar_samp(val1, val2), 3) from t1_nonnull;

-- Normal
--   Input is non-nullable.
with w1 as (select column_0 as c1, column_1 as c2 from ( values (1, 10), (2, 20), (3, 30) )t)
select round(corr(c1, c2), 3) from w1;

select round(corr(val1, val2), 3) from t1_nonnull where k = 2;

INSERT INTO `t_without_null` (
  `c_id`, `c_tinyint`, `c_smallint`, `c_int`, `c_bigint`, `c_largeint`, `c_float`, `c_double`, `c_char`, `c_varchar`, `c_date`, `c_datetime`, `c_decimal`) 
VALUES 
  (1, 1, 11, 111, 1111, 11111, 1.1, 11.11, 'char1', 'varchar1', '2021-01-01', '2021-01-01 00:00:00', 111.11),
  (2, 1, 11, 111, 1111, 11111, 1.1, 11.11, 'char1', 'varchar1', '2021-01-01', '2021-01-01 00:00:00', 111.11),
  (3, 1, 11, 111, 1111, 11111, 1.1, 11.11, 'char1', 'varchar1', '2021-01-01', '2021-01-01 00:00:00', 111.11),
  (4, 1, 11, 111, 1111, 11111, 1.1, 11.11, 'char1', 'varchar1', '2021-01-01', '2021-01-01 00:00:00', 111.11),
  (5, 1, 11, 111, 1111, 11111, 1.1, 11.11, 'char1', 'varchar1', '2021-01-01', '2021-01-01 00:00:00', 111.11),
  (6, 1, 11, 111, 1111, 11111, 1.1, 11.11, 'char1', 'varchar1', '2021-01-01', '2021-01-01 00:00:00', 111.11),
  (7, 1, 11, 111, 1111, 11111, 1.1, 11.11, 'char1', 'varchar1', '2021-01-01', '2021-01-01 00:00:00', 111.11),
  (8, 1, 11, 111, 1111, 11111, 1.1, 11.11, 'char1', 'varchar1', '2021-01-01', '2021-01-01 00:00:00', 111.11),
  (9, 1, 11, 111, 1111, 11111, 1.1, 11.11, 'char1', 'varchar1', '2021-01-01', '2021-01-01 00:00:00', 111.11),
  (10, 1, 11, 111, 1111, 11111, 1.1, 11.11, 'char1', 'varchar1', '2021-01-01', '2021-01-01 00:00:00', 111.11),

  (11, 2, 22, 222, 2222, 22222, 2.2, 22.22, 'char2', 'varchar2', '2021-01-02', '2021-01-02 00:00:00', 222.22),
  (12, 2, 22, 222, 2222, 22222, 2.2, 22.22, 'char2', 'varchar2', '2021-01-02', '2021-01-02 00:00:00', 222.22),
  (13, 2, 22, 222, 2222, 22222, 2.2, 22.22, 'char2', 'varchar2', '2021-01-02', '2021-01-02 00:00:00', 222.22),
  (14, 2, 22, 222, 2222, 22222, 2.2, 22.22, 'char2', 'varchar2', '2021-01-02', '2021-01-02 00:00:00', 222.22),
  (15, 2, 22, 222, 2222, 22222, 2.2, 22.22, 'char2', 'varchar2', '2021-01-02', '2021-01-02 00:00:00', 222.22),
  (16, 2, 22, 222, 2222, 22222, 2.2, 22.22, 'char2', 'varchar2', '2021-01-02', '2021-01-02 00:00:00', 222.22),
  (17, 2, 22, 222, 2222, 22222, 2.2, 22.22, 'char2', 'varchar2', '2021-01-02', '2021-01-02 00:00:00', 222.22),
  (18, 2, 22, 222, 2222, 22222, 2.2, 22.22, 'char2', 'varchar2', '2021-01-02', '2021-01-02 00:00:00', 222.22),
  (19, 2, 22, 222, 2222, 22222, 2.2, 22.22, 'char2', 'varchar2', '2021-01-02', '2021-01-02 00:00:00', 222.22),

  (21, 3, 33, 333, 3333, 33333, 3.3, 33.33, 'char3', 'varchar3', '2021-01-03', '2021-01-03 00:00:00', 333.33),
  (22, 3, 33, 333, 3333, 33333, 3.3, 33.33, 'char3', 'varchar3', '2021-01-03', '2021-01-03 00:00:00', 333.33),
  (23, 3, 33, 333, 3333, 33333, 3.3, 33.33, 'char3', 'varchar3', '2021-01-03', '2021-01-03 00:00:00', 333.33),
  (24, 3, 33, 333, 3333, 33333, 3.3, 33.33, 'char3', 'varchar3', '2021-01-03', '2021-01-03 00:00:00', 333.33),
  (25, 3, 33, 333, 3333, 33333, 3.3, 33.33, 'char3', 'varchar3', '2021-01-03', '2021-01-03 00:00:00', 333.33),
  (26, 3, 33, 333, 3333, 33333, 3.3, 33.33, 'char3', 'varchar3', '2021-01-03', '2021-01-03 00:00:00', 333.33),
  (27, 3, 33, 333, 3333, 33333, 3.3, 33.33, 'char3', 'varchar3', '2021-01-03', '2021-01-03 00:00:00', 333.33),
  (28, 3, 33, 333, 3333, 33333, 3.3, 33.33, 'char3', 'varchar3', '2021-01-03', '2021-01-03 00:00:00', 333.33),

  (31, 4, 44, 444, 4444, 44444, 4.4, 44.44, 'char4', 'varchar4', '2021-01-04', '2021-01-04 00:00:00', 444.44),
  (32, 4, 44, 444, 4444, 44444, 4.4, 44.44, 'char4', 'varchar4', '2021-01-04', '2021-01-04 00:00:00', 444.44),
  (33, 4, 44, 444, 4444, 44444, 4.4, 44.44, 'char4', 'varchar4', '2021-01-04', '2021-01-04 00:00:00', 444.44),
  (34, 4, 44, 444, 4444, 44444, 4.4, 44.44, 'char4', 'varchar4', '2021-01-04', '2021-01-04 00:00:00', 444.44),
  (35, 4, 44, 444, 4444, 44444, 4.4, 44.44, 'char4', 'varchar4', '2021-01-04', '2021-01-04 00:00:00', 444.44),
  (36, 4, 44, 444, 4444, 44444, 4.4, 44.44, 'char4', 'varchar4', '2021-01-04', '2021-01-04 00:00:00', 444.44),
  (37, 4, 44, 444, 4444, 44444, 4.4, 44.44, 'char4', 'varchar4', '2021-01-04', '2021-01-04 00:00:00', 444.44),

  (41, 5, 55, 555, 5555, 55555, 5.5, 55.55, 'char5', 'varchar5', '2021-01-05', '2021-01-05 00:00:00', 555.55),
  (42, 5, 55, 555, 5555, 55555, 5.5, 55.55, 'char5', 'varchar5', '2021-01-05', '2021-01-05 00:00:00', 555.55),
  (43, 5, 55, 555, 5555, 55555, 5.5, 55.55, 'char5', 'varchar5', '2021-01-05', '2021-01-05 00:00:00', 555.55),
  (44, 5, 55, 555, 5555, 55555, 5.5, 55.55, 'char5', 'varchar5', '2021-01-05', '2021-01-05 00:00:00', 555.55),
  (45, 5, 55, 555, 5555, 55555, 5.5, 55.55, 'char5', 'varchar5', '2021-01-05', '2021-01-05 00:00:00', 555.55),
  (46, 5, 55, 555, 5555, 55555, 5.5, 55.55, 'char5', 'varchar5', '2021-01-05', '2021-01-05 00:00:00', 555.55),

  (51, 6, 66, 666, 6666, 66666, 6.6, 66.66, 'char6', 'varchar6', '2021-01-06', '2021-01-06 00:00:00', 666.66),
  (52, 6, 66, 666, 6666, 66666, 6.6, 66.66, 'char6', 'varchar6', '2021-01-06', '2021-01-06 00:00:00', 666.66),
  (53, 6, 66, 666, 6666, 66666, 6.6, 66.66, 'char6', 'varchar6', '2021-01-06', '2021-01-06 00:00:00', 666.66),
  (54, 6, 66, 666, 6666, 66666, 6.6, 66.66, 'char6', 'varchar6', '2021-01-06', '2021-01-06 00:00:00', 666.66),
  (55, 6, 66, 666, 6666, 66666, 6.6, 66.66, 'char6', 'varchar6', '2021-01-06', '2021-01-06 00:00:00', 666.66),

  (61, 7, 77, 777, 7777, 77777, 7.7, 77.77, 'char7', 'varchar7', '2021-01-07', '2021-01-07 00:00:00', 777.77),
  (62, 7, 77, 777, 7777, 77777, 7.7, 77.77, 'char7', 'varchar7', '2021-01-07', '2021-01-07 00:00:00', 777.77),
  (63, 7, 77, 777, 7777, 77777, 7.7, 77.77, 'char7', 'varchar7', '2021-01-07', '2021-01-07 00:00:00', 777.77),
  (64, 7, 77, 777, 7777, 77777, 7.7, 77.77, 'char7', 'varchar7', '2021-01-07', '2021-01-07 00:00:00', 777.77),

  (71, 8, 88, 888, 8888, 88888, 8.8, 88.88, 'char8', 'varchar8', '2021-01-08', '2021-01-08 00:00:00', 888.88),
  (72, 8, 88, 888, 8888, 88888, 8.8, 88.88, 'char8', 'varchar8', '2021-01-08', '2021-01-08 00:00:00', 888.88),
  (73, 8, 88, 888, 8888, 88888, 8.8, 88.88, 'char8', 'varchar8', '2021-01-08', '2021-01-08 00:00:00', 888.88),

  (81, 9, 99, 999, 9999, 99999, 9.9, 99.99, 'char9', 'varchar9', '2021-01-09', '2021-01-09 00:00:00', 999.99),
  (82, 9, 99, 999, 9999, 99999, 9.9, 99.99, 'char9', 'varchar9', '2021-01-09', '2021-01-09 00:00:00', 999.99),

  (91, 10, 100, 1000, 10000, 100000, 1.01, 100.01, 'char10', 'varchar10', '2021-01-10', '2021-01-10 00:00:00', 1000.01);

SELECT /*+ SET_VAR(streaming_preaggregation_mode='force_preaggregation')*/ APPROX_TOP_K(c_char) FROM t_without_null;

SELECT /*+ SET_VAR(streaming_preaggregation_mode='force_preaggregation')*/ APPROX_TOP_K(c_bigint, 3) FROM t_without_null;

SELECT /*+ SET_VAR(streaming_preaggregation_mode='auto')*/ APPROX_TOP_K(c_decimal, 3) FROM t_without_null;

SELECT /*+ SET_VAR(streaming_preaggregation_mode='auto')*/ APPROX_TOP_K(c_char, 3, 10) FROM t_without_null;

SELECT c_id, APPROX_TOP_K(c_bigint) over() FROM t_without_null WHERE c_id >= 71 AND c_id <= 90 ORDER BY c_id;

SELECT c_id, APPROX_TOP_K(c_decimal) over() FROM t_without_null WHERE c_id >= 71 AND c_id <= 90 ORDER BY c_id;

SELECT /*+ SET_VAR(streaming_preaggregation_mode='force_streaming')*/ c_partition, APPROX_TOP_K(c_float) FROM t_partition GROUP BY c_partition ORDER BY c_partition;

SELECT /*+ SET_VAR(streaming_preaggregation_mode='force_streaming')*/ c_partition, APPROX_TOP_K(c_smallint, 10) FROM t_partition GROUP BY c_partition ORDER BY c_partition;

SELECT /*+ SET_VAR(streaming_preaggregation_mode='force_preaggregation')*/ c_partition, APPROX_TOP_K(c_date, 10) FROM t_partition GROUP BY c_partition ORDER BY c_partition;

SELECT /*+ SET_VAR(streaming_preaggregation_mode='force_preaggregation')*/ c_partition, APPROX_TOP_K(c_float, 3, 10) FROM t_partition GROUP BY c_partition ORDER BY c_partition;

SELECT c_partition, APPROX_TOP_K(c_varchar, 10) OVER(PARTITION BY c_partition) FROM t_partition ORDER BY c_partition;

-- Aggregation
SELECT /*+ SET_VAR(streaming_preaggregation_mode='auto')*/ APPROX_TOP_K(c_bool) FROM t_bool;

SELECT c_id, APPROX_TOP_K(c_bool, 3, 10) OVER() FROM t_bool ORDER BY c_id;

SELECT L_RETURNFLAG, APPROX_TOP_K(L_LINENUMBER, 2) FROM lineitem GROUP BY L_RETURNFLAG ORDER BY L_RETURNFLAG;

SELECT /*+SET_VAR(new_planner_agg_stage=2)*/ c_grp, APPROX_TOP_K(CAST(1 AS TINYINT), 3) FROM t_const_first_arg GROUP BY c_grp ORDER BY c_grp;

-- 80000
insert into __row_util_base select * from __row_util_base;

with w1 as (select approx_top_k(c2, 3) as x from t1) -- non-group-by.
select array_sortby((x) -> x.item, x) from w1;

-- name: testArrayAgg
CREATE TABLE `ss` (
  `id` int(11) NULL COMMENT "",
  `name` varchar(255) NULL COMMENT "",
  `subject` varchar(255) NULL COMMENT "",
  `score` int(11) NULL COMMENT "",
   arr array<int>,
   mmap map<int,varchar(20)>
) ENGINE=OLAP
DUPLICATE KEY(`id`)
DISTRIBUTED BY HASH(`id`) BUCKETS 4
PROPERTIES (
"replication_num" = "1",
"enable_persistent_index" = "true",
"replicated_storage" = "true",
"compression" = "LZ4"
);

insert into ss values (NULL,NULL,NULL,NULL,null,null);

select max(id), array_agg(distinct name) from ss where id < 2  order by 1;

select id, array_agg(distinct name) from ss where id < 2 group by id order by id;

select score, array_agg(distinct name), array_agg(distinct (score > 1)) from ss where id < 2 group by score order by 1;

select array_agg(distinct name order by 1, score), count(distinct id), array_agg(name order by 1) from ss group by id order by 1;

select array_agg(name order by 1 asc), array_agg(name order by 1 desc) from ss order by 1;

select cardinality(array_agg(distinct arr order by score, cardinality(arr), arr)) from ss group by id order by 1;

select array_agg(distinct score order by 1,name) from ss group by id order by 1;

select cardinality(array_agg( name order by score,4.00)), cardinality(array_agg(distinct name order by score,4.00)) from ss group by id order by 1, 2;

select array_agg(distinct name order by 1,score), array_agg(distinct score order by 1) from ss order by 1;

select array_agg(distinct score order by score,4.00),array_agg(subject order by score,4.00, 1),array_agg(subject order by score,4.00, 1)  from ss order by 1;

select array_agg( subject order by score,1), count(distinct id), max(score)  from ss order by 1;

select cardinality(array_agg(distinct arr order by score, 1)) from ss order by 1;

select array_agg(distinct name order by 1,score, 1), count(distinct id), max(score)  from ss group by id order by 1,2,3;

select cardinality(array_agg(distinct arr order by score, cardinality(arr),name)), cardinality(array_agg(distinct mmap order by score,cardinality(mmap),name)) from ss order by 1;

select array_agg() from ss;

select array_agg(json_object("2:3")) from ss;

select array_agg_distinct(name order by 1 asc), array_agg(distinct name order by 1 desc), array_agg(name order by 1 desc) from ss order by 1;

SELECT ARRAY_AGG(col_smallint ORDER BY id ASC) FROM test_array_agg;

SELECT ARRAY_AGG(col_datetime ORDER BY id ASC) FROM test_array_agg;

SELECT id, ARRAY_AGG(col_int ORDER BY id DESC NULLS FIRST) FROM test_array_agg GROUP BY id ORDER BY id;

SELECT id, ARRAY_AGG(col_date ORDER BY id DESC) FROM test_array_agg GROUP BY id ORDER BY id;

SELECT ARRAY_AGG(DISTINCT col_bigint ORDER BY id ASC) FROM test_array_agg;

SELECT ARRAY_AGG(DISTINCT col_array ORDER BY id ASC) FROM test_array_agg;

SELECT id, ARRAY_AGG(DISTINCT col_largeint ORDER BY id DESC) FROM test_array_agg GROUP BY id ORDER BY id;

SELECT id, ARRAY_AGG(DISTINCT col_map ORDER BY id DESC) FROM test_array_agg GROUP BY id ORDER BY id;

-- name: test_array_unique_agg_different_types
create table test_array_agg (
    id INT,
    col_boolean ARRAY<BOOLEAN>,
    col_tinyint ARRAY<TINYINT>,
    col_smallint ARRAY<SMALLINT>,
    col_int ARRAY<INT>,
    col_bigint ARRAY<BIGINT>,
    col_largeint ARRAY<LARGEINT>,
    col_float ARRAY<FLOAT>,
    col_double ARRAY<DOUBLE>,
    col_varchar ARRAY<VARCHAR(100)>,
    col_char ARRAY<CHAR(10)>,
    col_datetime ARRAY<DATETIME>,
    col_date ARRAY<DATE>,
    col_array ARRAY<ARRAY<INT>>,
    col_map ARRAY<MAP<STRING, INT>>,
    col_struct ARRAY<STRUCT<f1 INT, f2 STRING>>
) DUPLICATE KEY(id) DISTRIBUTED BY HASH(id) BUCKETS 3
PROPERTIES ("replication_num" = "1");

SELECT id, ARRAY_MIN(ARRAY_UNIQUE_AGG(col_float)), ARRAY_MAX(ARRAY_UNIQUE_AGG(col_float)) FROM test_array_agg GROUP BY id ORDER BY id;

select avg(v2 - 1.86659630566164 * (v3 - 3.062175673706)) from t1 group by v1;

SELECT BITMAP_TO_STRING(BITMAP_AGG(c7)) FROM t1;

select c1, count(distinct c2), bitmap_union(to_bitmap(c3)), bitmap_agg(c4) from t1 group by c1 order by c1;

select BITMAP_TO_STRING(bitmap_union(to_bitmap(c2))), BITMAP_TO_STRING(bitmap_union(to_bitmap(c3))), BITMAP_TO_STRING(bitmap_agg(c4)) from t1 group by c1 order by c1;

-- basic test
select bool_or(c0), boolor_agg(c1), bool_or(c2), bool_or(c3), bool_or(null) from t1;

-- Only the second argument is folded into a constant, over a multi-row input.
select round(covar_pop(k, c), 3) from (select k, 1 as c from (values(2), (3), (4)) t(k)) s;

select dict_merge(city_array, 255) from test_dict_merge;

insert into t2 select generate_series %5, cast(generate_series as int) %5 from table(generate_series(1, 1000));

INSERT INTO t VALUES (1,10,100),(1,20,100),(1,30,200),(2,10,300),(2,20,NULL),(3,10,400);

SELECT k, ts, AVG(uid) OVER (PARTITION BY k ORDER BY ts ROWS BETWEEN 5 FOLLOWING AND 10 FOLLOWING) AS a
FROM t ORDER BY k, ts;

-- pairwise scalar set ops — estimate composes directly (no state-type plumbing needed)
with a as (select ds_theta_accumulate(id) as sk from t1 where grp = 'A'),
     b as (select ds_theta_accumulate(id) as sk from t1 where grp = 'B')
select cast(ds_theta_estimate(ds_theta_union(a.sk, b.sk)) between 70000 and 80000 as int),
       cast(ds_theta_estimate(ds_theta_intersect(a.sk, b.sk)) between 22500 and 27500 as int),
       cast(ds_theta_estimate(ds_theta_a_not_b(a.sk, b.sk)) between 22500 and 27500 as int)
from a, b;

-- ds_theta_intersect_cond_agg with disjoint sets: intersection estimate ~ 0
with a as (select ds_theta_accumulate(c) as s, 1 as is_anchor
           from (select generate_series as c from table(generate_series(1, 1000))) t),
     b as (select ds_theta_accumulate(c) as s, 0 as is_anchor
           from (select generate_series as c from table(generate_series(2001, 3000))) t),
     combined as (select s, is_anchor from a union all select s, is_anchor from b)
select cast(ds_theta_intersect_cond_agg(s, is_anchor) < 50 as int) as disjoint_intersect_near_zero
from combined;

insert into ss values (2,"Tom",NULL,NULL);

insert into ss values (12,"李四大闹天空","英语外语美誉",NULL);

select group_concat(distinct name,subject order by 1,2) from ss group by id order by 1;

select group_concat(distinct name, score order by score,4.00, 1),group_concat(subject order by score,4.00, 1),array_agg(subject order by score,4.00, 1)  from ss group by id order by 1;

select group_concat( name,subject order by score,1,2), count(distinct id), max(score)  from ss group by id order by 1;

select group_concat( 1,2 order by 1,2) from ss group by id order by 1;

select group_concat(distinct name,subject order by 1,2 ,score,2) from ss order by 1;

select group_concat(distinct score order by 1,2) from ss order by 1;

select group_concat( name,subject order by score,4), count(distinct id), max(score)  from ss order by 1;

select group_concat( 1,2 order by score,2) from ss order by 1;

select group_concat(distinct name,subject order by 1,2), count(distinct score), group_concat(name order by 1) from ss order by 1;

select group_concat("中国",name order by 2, id) from ss;

select group_concat([1,2]) from ss;

set group_concat_max_len = 1;

INSERT INTO t1 VALUES
(1,'fruit'),
(1,'fruit'),
(1,'fruit'),
(2,'fruit'),
(2,'fruit'),
(2,'fruit');

--legacy result
select /*+ set_var(sql_mode = 'GROUP_CONCAT_LEGACY') */ id, group_concat( value ) from t1 group by id order by id;

-- bucket_num = 0 must not crash the BE (returns an error instead of SIGFPE)
SELECT histogram(v, 0, 1.0) FROM t_hist;

select 
    mann_whitney_u_test(x, t, 'greater') 
from 
    TABLE(generate_series(1000, 10000)) as numbers(x), TABLE(generate_series(0, 1)) as idx(t);

select
    mann_whitney_u_test(c3, c2, 'less')
from t1;

select
    mann_whitney_u_test(c6, c2, 'greater')
from t1;

SELECT /*+ SET_VAR(streaming_preaggregation_mode='force_streaming')*/ MIN_N(c_float, 3) FROM t_without_null;

SELECT /*+ SET_VAR(streaming_preaggregation_mode='force_streaming')*/ MIN_N(c_smallint, 1) FROM t_without_null;

SELECT /*+ SET_VAR(streaming_preaggregation_mode='force_streaming')*/ c_id % 4 AS g, MIN_N(c_date, 2) FROM t_without_null GROUP BY g ORDER BY g;

SELECT /*+ SET_VAR(streaming_preaggregation_mode='force_streaming')*/ MIN_N(c_int, 3) FROM t_with_null;

SELECT /*+ SET_VAR(streaming_preaggregation_mode='force_preaggregation')*/ MIN_N(c_datetime, 3) FROM t_with_null;

-- Insert test data with various varbinary values
INSERT INTO tbinary_ndv_test
SELECT generate_series,
       to_binary(CONCAT('value_', CAST(generate_series AS VARCHAR)), 'utf8'),
       (generate_series - 1) % 5 + 1
FROM TABLE(GENERATE_SERIES(1, 100));

-- Test ds_theta_count_distinct with varbinary
SELECT ds_theta_count_distinct(data) AS theta_result FROM tbinary_ndv_test;

SELECT COUNT(DISTINCT data) AS distinct_count_with_null FROM tbinary_ndv_null_test;

-- Multiple COUNT(DISTINCT) in the same SELECT
SELECT COUNT(DISTINCT data1) AS distinct_data1, 
       COUNT(DISTINCT data2) AS distinct_data2,
       COUNT(DISTINCT data3) AS distinct_data3
FROM tbinary_multi_distinct_test;

-- Complex query with multiple distinct aggregations and filters
SELECT category,
       COUNT(DISTINCT data1) AS distinct_data1,
       COUNT(DISTINCT data2) AS distinct_data2,
       ndv(data3) AS ndv_data3,
       COUNT(*) AS total
FROM tbinary_multi_distinct_test
WHERE id > 2
GROUP BY category
HAVING COUNT(DISTINCT data1) > 1
ORDER BY category;

-- Clean up
DROP TABLE IF EXISTS tbinary_ndv_test;

select cast(percentile_approx(c2, 0.9) as int) from t1;

select /*+ SET_VAR (new_planner_agg_stage = '2') */ percentile_approx(c2, [0.1, 0.25, 0.5, 0.75, 0.9]) from t1;

CREATE TABLE `t1_convert_to_serialize_format` (
  `v4` bigint(20) NULL COMMENT "",
  `v5` bigint(20) NULL COMMENT "",
  `v6` bigint(20) NULL COMMENT ""
) ENGINE=OLAP 
DUPLICATE KEY(`v4`, `v5`, `v6`)
DISTRIBUTED BY HASH(`v4`) BUCKETS 3 
PROPERTIES (
"compression" = "LZ4",
"fast_schema_evolution" = "true",
"replicated_storage" = "true",
"replication_num" = "1"
);

select cast(percentile_approx_weighted(c1, 1, 0.9) as int) from t1;

select cast(percentile_approx_weighted(c2, 1, 0.9, 1) as int) from t1;

-- tinyint
select cast(percentile_approx_weighted(c3, c1, 0.5) as int) from t1;

select cast(percentile_approx_weighted(c4, 10, 0.9, 5000) as int) from t1;

select cast(percentile_approx_weighted(c6, c1, 0.9, 10000) as int) from t1;

select cast(percentile_approx_weighted(c11[0], 1, 0.5) as int) from t1;

select cast(percentile_approx_weighted(c13.b, 1, 0.5) as int) from t1;

-- Test percentile parameter validation (single value)
select percentile_approx_weighted(1, 1, 1.5) from t2;

select /*+ SET_VAR (new_planner_agg_stage = '2') */ percentile_approx_weighted(k, v, array<float>[0.0, 0.5, 1.0]) from t2;

-- Test percentile_approx_weighted sorted streaming aggregate
CREATE TABLE `test_sorted_streaming_agg_percentile_weighted`
(
    `id_int` int(11) NOT NULL COMMENT "",
    `value` double NOT NULL COMMENT ""
)
ENGINE=OLAP 
DUPLICATE KEY(`id_int`)
COMMENT "OLAP"
DISTRIBUTED BY HASH(`id_int`)
BUCKETS 1
PROPERTIES (
"replication_num" = "1"
);

-- name: testCorr
CREATE TABLE aggtest(
                        no int,
                        k decimal(10,2) ,
                        v decimal(10,2))
                        DUPLICATE KEY (no)
                        DISTRIBUTED BY HASH (no)
                        PROPERTIES (
                        "replication_num" = "1",
                        "storage_format" = "v2"
                    );

-- two phase agg with force_streaming
select abs(co - 0.9988445981121532)  / 0.9988445981121532 < 0.00001 from (select /*+ SET_VAR (streaming_preaggregation_mode = 'force_streaming',new_planner_agg_stage='2') */CORR(k, v)co FROM aggtest group by no order by no limit 1,1)result;

-- select empty table
select COVAR_SAMP(k, v)co FROM aggtest;

-- [0.9988445981121532,4]
select abs(co - 120)  / 120 < 0.00001,total = 4  from (select /*+ SET_VAR (new_planner_agg_stage='3')*/COVAR_SAMP(k, v)co, count(distinct k)total FROM aggtest group by no order by no limit 1,1)result;

-- without group by
select abs(co - 80)  / 80 < 0.00001 from (select covar_pop(k, v)co FROM aggtest limit 1)result;

select abs(co - 80)  / 80 < 0.00001 from (select covar_pop(k, v) over (partition by no)co FROM aggtest order by co limit 1,4)result;

select string_agg(score, ',' order by 1,name) from ss order by 1;

-- Test sum_map with int keys and double values
select sum_map(c4)[1], sum_map(c4)[2], sum_map(c4)[3] from t1;

select sum_map(c2)[3] from t1;

set streaming_preaggregation_mode=auto;

-- Test FLOAT values
select sum_map(m_float)[1], sum_map(m_float)[2], sum_map(m_float)[3] from t2;

-- Test LARGEINT keys
select sum_map(m_key_largeint)[1], sum_map(m_key_largeint)[2], sum_map(m_key_largeint)[3] from t3;

-- Insert maps with NULL values (should be excluded)
INSERT INTO t5 values
    (3, map{1:15, 2:NULL, 4:40});

-- Test with negative values
select sum_map(m)[1], sum_map(m)[2], sum_map(m)[3], sum_map(m)[4] from (
    select map{1:-10, 2:20, 3:-30} as m
    union all
    select map{1:5, 2:-15, 4:40} as m
) t;

-- Test in having clause
select category, sum_map(metrics)["clicks"] as clicks_total, sum_map(metrics)["views"] as views_total, sum_map(metrics)["impressions"] as impressions_total from t8 group by category having count(*) > 1 order by category;

-- Test all 49 valid numeric key×value type combinations
-- TINYINT keys
select sum_map(m_ti_ti)[1], sum_map(m_ti_ti)[2], sum_map(m_ti_ti)[3] from t11_type_matrix;

select sum_map(m_si_si)[1], sum_map(m_si_si)[2], sum_map(m_si_si)[3] from t11_type_matrix;

select sum_map(m_i_i)[1], sum_map(m_i_i)[2], sum_map(m_i_i)[3] from t11_type_matrix;

select sum_map(m_bi_bi)[1], sum_map(m_bi_bi)[2], sum_map(m_bi_bi)[3] from t11_type_matrix;

select sum_map(m_li_li)[1], sum_map(m_li_li)[2], sum_map(m_li_li)[3] from t11_type_matrix;

select sum_map(m_f_f)[1.0], sum_map(m_f_f)[2.0], sum_map(m_f_f)[3.0] from t11_type_matrix;

select sum_map(m_d_d)[1.0], sum_map(m_d_d)[2.0], sum_map(m_d_d)[3.0] from t11_type_matrix;

INSERT INTO t1 VALUES 
(
  '2024-01-01',                    -- k1
  TRUE,                            -- c0
  127,                             -- c1
  32000,                           -- c2
  2147483647,                      -- c3
  9223372036854775807,             -- c4
  170141183460469231731687303715884105727,  -- c5 (example large integer)
  12345.6789,                      -- c6
  12345.67,                        -- c7
  123.45678901,                    -- c8
  'ExampleCharData',               -- c9
  '2024-01-02',                    -- c10
  '2024-01-01 12:34:56',           -- c11
  [TRUE, FALSE, TRUE],        -- c15 (<boolean>)
  [1, -1, 127],               -- c16 (<tinyint>)
  [100, -100, 32767],         -- c17 (<smallint>)
  [100000, -100000, 2147483647], -- c18 (<int>)
  [10000000000, -10000000000, 9223372036854775807], -- c19 (<bigint>)
  [12345678901234567890, -12345678901234567890, 170141183460469231731687303715884105727], -- c20 (<largeint>)
  [1.23, 4.56, 7.89],         -- c21 (<double>)
  [1.23, 4.56, 7.89],         -- c22 (<float>)
  [1.23456789, 2.34567890, 3.45678901], -- c23 (<decimal(10,8)>)
  ['abc', 'def', 'ghi'],      -- c24 (<char(100)>)
  ['2024-01-01', '2024-01-02'], -- c25 (<date>)
  ['2024-01-01 12:34:56', '2024-01-02 12:34:56'], -- c26 (<datetime>)
  'ExampleVarcharData',            -- c12
  '{"key": "value"}',              -- c13 (JSON data)
  x'4D7956617262696E61727944617461', -- c14 (VARBINARY data in hexadecimal format)
  MAP{'key1':'value1', 'key2':'value2'}, -- c27 (map<varchar, varchar>)
  row('val1'),    -- c28 (struct<col1 <varchar(1048576)>>)
  ['str1', 'str2', 'str3']    -- c29 (<varchar(100)>)
);

CREATE TABLE `t2` (
  `k1` varchar(255) NOT NULL COMMENT "",
  `k2` varchar(255) NOT NULL COMMENT "",
  `k3` int NOT NULL COMMENT ""
) ENGINE=OLAP 
PRIMARY KEY(`k1`)
PROPERTIES ( "replication_num" = "1");

select max(k3) FILTER (where k3 < 0) from t2;

-- name: test_agg_state_table_basic_with_mv @native
CREATE TABLE t1 (
  id BIGINT NOT NULL,
  province VARCHAR(64),
  age SMALLINT,
  dt VARCHAR(10) NOT NULL 
)
DUPLICATE KEY(id)
PARTITION BY (dt)
DISTRIBUTED BY HASH(id) BUCKETS 4;

-- test async synchronized materailized view
CREATE MATERIALIZED VIEW test_mv2
PARTITION BY (dt)
DISTRIBUTED BY RANDOM
as
select 
    dt,
    min(id) as min_id,
    max(id) as max_id,
    sum(id) as sum_id,
    bitmap_union(to_bitmap(id)) as bitmap_union_id,
    hll_union(hll_hash(id)) as hll_union_id,
    percentile_union(percentile_hash(id)) as percentile_union_id,
    ds_hll_count_distinct_union(ds_hll_count_distinct_state(id)) as hll_id,
    avg_union(avg_state(id)) as avg_id,
    array_agg_union(array_agg_state(id)) as array_agg_id,
    min_by_union(min_by_state(province, id)) as min_by_province_id
from t1
group by dt;

SET new_planner_agg_stage = 1;

SELECT region, COUNT(*) AS c_all, COUNT(nullable_score) AS c_non_null
FROM t GROUP BY region ORDER BY region;

CREATE AI PROVIDER IF NOT EXISTS ai_provider_embedding_test TYPE embedding PROPERTIES ("endpoint" = "https://api.openai.com/v1/embeddings", "model" = "text-embedding-3-small");

DROP AI PROVIDER ai_provider_embedding_test;

SHOW AI PROVIDERS LIKE 'ai_provider_rerank_test';

DROP AI PROVIDER IF EXISTS ai_provider_rerank_test;

CREATE MATERIALIZED VIEW mv1 REFRESH IMMEDIATE MANUAL AS SELECT c0 AS k, count(c1) as cnt FROM t0 GROUP BY c0;

-- alter column: k13
ALTER TABLE t1 MODIFY COLUMN k13 decimal(32, 10);

-- name: test_alter_table_column_comment @native
create table t(k int, v int) primary key(k);

-- name: test_alter_table_column_comment_with_type @native
create table t(k int, v int) primary key(k);

INSERT INTO t0 VALUES ('2025-06-25','1',25,25);

ALTER TABLE t0 ADD COLUMN k0 FLOAT;

ALTER TABLE t0 MODIFY COLUMN v1 VARCHAR(100) MAX;

ALTER TABLE t0 DROP COLUMN v1, DROP COLUMN k0;

ALTER TABLE t1 ADD column v2 BIGINT MIN;

ALTER TABLE t1 DROP COLUMN v0, DROP COLUMN v100;

ALTER TABLE t2 ADD COLUMN v2 BIGINT, ADD COLUMN v2 BIGINT KEY;

insert into test values('2020-01-01', '2024-10-30 11:17:01', 'asfgrgte', 'wergergqer', 0, 11, 111, 1111, 11111, 111111, 11.11, 111.111, 1111.1111),('2020-01-01', '2024-10-30 10:17:01', 'asfgrgte', 'wergergqer', 0, 11, 111, 1111, 11111, 111111, 11.11, 111.111, 1111.1111),('2020-01-01', '2024-10-30 09:17:01', 'asfgrgte', 'wergergqer', 0, 11, 111, 1111, 11111, 111111, 11.11, 111.111, 1111.1111),('2020-01-01', '2024-10-30 12:17:01', 'asfgrgte', 'wergergqer', 0, 11, 111, 1111, 11111, 111111, 11.11, 111.111, 1111.1111);

CREATE MATERIALIZED VIEW test_mv2 AS SELECT k0, v1, k1, v0 FROM t0 WHERE v0 > 10 and k1 = '2024-01-01 00:00:00';

select * from t order by k;

USE test_analyze_column;

analyze sample table t1(k3,k4);

select mcv from default_catalog._statistics_.external_histogram_statistics where catalog_name = 'analyze_hive_stats' and db_name = 'hive_oss_db' and table_name = 'hive_oss_par_parquet_snappy' and column_name = 'col_string';

CREATE TABLE `duplicate_table_with_null` (
    `k1`  date,
    `k2`  datetime,
    `k3`  char(20),
    `k4`  varchar(20),
    `k5`  boolean,
    `k6`  tinyint,
    `k7`  smallint,
    `k8`  int,
    `k9`  bigint,
    `k10` largeint,
    `k11` float,
    `k12` double,
    `k13` decimal(27,9) )
DUPLICATE KEY(`k1`, `k2`, `k3`, `k4`, `k5`)
DISTRIBUTED BY HASH(`k1`, `k2`, `k3`) BUCKETS 3
PROPERTIES ('replication_num' = '1');

SELECT k FROM t_ns WHERE to_date(ts_nanos) > '2020-01-01' ORDER BY k;

-- t2 is asymmetric with t1
INSERT INTO t2
WITH series AS (
    SELECT g1 FROM TABLE(generate_series(1, 300)) AS t(g1)
)
SELECT date_add('2020-01-01', 300-s1.g1) as k1 , s1.g1, s2.g1
FROM series s1, series s2
WHERE s1.g1 <= s2.g1
ORDER BY s1.g1;

ANALYZE FULL TABLE t3;

-- expected results
SELECT COUNT(*) FROM t1 JOIN t2 USING (k1);

ANALYZE TABLE t3 UPDATE HISTOGRAM ON k1,k2,k3 PROPERTIES('histogram_sample_ratio' = '1.0', "histogram_mcv_size" = '400');

ANALYZE TABLE t1 UPDATE HISTOGRAM ON k1,k2,k3 PROPERTIES('histogram_sample_ratio' = '1.0', 'histogram_collect_bucket_ndv_mode' = 'hll');

ANALYZE TABLE t3 UPDATE HISTOGRAM ON k1,k2,k3 PROPERTIES('histogram_sample_ratio' = '1.0', "histogram_mcv_size" = '0', 'histogram_collect_bucket_ndv_mode' = 'sample');

SELECT k2, count(*)
FROM t4
GROUP BY k2
ORDER BY k2
LIMIT 10;

SELECT COUNT(*) FROM (t4 n1 JOIN t5 n2 ON n1.k1 = n2.k1) JOIN t6 n3 ON n1.k1 = n3.k1;

ANALYZE TABLE t4 UPDATE HISTOGRAM ON k1,k2,k3 PROPERTIES('histogram_sample_ratio' = '1.0', "histogram_mcv_size" = '0', 'histogram_collect_bucket_ndv_mode' = 'sample');

CREATE TABLE histogram_batch_insert (
    k1 INT,
    k2 BIGINT,
    k3 VARCHAR(20)
)
DUPLICATE KEY(k1)
DISTRIBUTED BY HASH(k1) BUCKETS 1
PROPERTIES ('replication_num' = '1');

-- name: test_histogram_function

drop stats test_first_load;

-- predicate
select count(*) from t1 where c1 = 1;

-- join
create table t2(c5 int, c6 bigint, c7 string, c8 string) 
properties('replication_num'='1');

CREATE TABLE t_collect (k1 int, v1 int)
DUPLICATE KEY(k1) DISTRIBUTED BY HASH(k1) BUCKETS 1
PROPERTIES ('replication_num' = '1', 'enable_statistic_collect_on_first_load' = 'false');

USE test_update_trigger_statistics;

-- UPDATE a few rows should not trigger statistics collection
set @last_analyze_id=(select last_id from last_analyze_id_view);

-- sample result is not stable
-- select * from statistic_verify order by column_name;
select * from analyze_status_verify;

-- Query with long OR predicate (more than 3)
select id, cargo_code, category from test_table
where cargo_code = 900000000 or cargo_code = 900000001 or cargo_code = 900000002 or cargo_code = 900000003 order by 1, 2;

insert into t2 values
(1, [[["10"],["20"],["30"]],[["60"],["5"],["4"]],[["-100","-2"],["-20","10"],["100","23"]]], [[[1.00],[2.00],[3.00]],[[6.00],[5.00],[4.00]],[[-1.00,-2.00],[-2.00,10.00],[100.00,23.00]]]);

select array_generate(9);

select array_generate("2025-10-01", "2025-10-05",interval -1 day);

select array_generate("2025-10-01 14:28:31", "2025-10-01 23:12:36",interval 3 hour);

select array_generate("2025-12-05", "2025-10-01",interval 2 WEEK);

select array_generate("2025-10-01 14:28:32.800000", "2025-10-01 14:28:31",NULL);

-- name: test_array_generate_too_many_elements
CREATE TABLE array_generate_bounds (id INT, s BIGINT, e BIGINT, st BIGINT) DUPLICATE KEY(id) DISTRIBUTED BY HASH(id) BUCKETS 1 PROPERTIES ("replication_num"="1");

-- name: test_cast_array

CREATE TABLE `tbl` (k1 string,k2 string,k3 int) DUPLICATE KEY(`k1`) DISTRIBUTED BY HASH(`k1`) BUCKETS 3 PROPERTIES ("replication_num" = "1");

select count(*), array_length(array_agg(arr)) from (select @arr_str arr from (select t1.k3 from tbl t1) t) t group by arr[1];

-- Window with order by only
select sum(
  coalesce(array_sum(array_map(x -> murmur_hash3_32(coalesce(x, 0)), arr_basic)), 0) +
  coalesce(array_sum(array_map(x -> murmur_hash3_32(coalesce(x, 0)), arr_distinct)), 0) +
  coalesce(array_sum(array_map(x -> murmur_hash3_32(coalesce(x, 0)), arr_order_by)), 0)
) as fingerprint from (
  select v1, v2, v3,
  array_agg(v1) over(order by v2) as arr_basic,
  array_agg(distinct v2) over(order by v2) as arr_distinct,
  array_agg(v3 order by v2) over(order by v2) as arr_order_by
  from t0
) as t;

select sum(
  coalesce(array_sum(array_map(x -> murmur_hash3_32(coalesce(x, 0)), arr_basic)), 0) +
  coalesce(array_sum(array_map(x -> murmur_hash3_32(coalesce(x, 0)), arr_distinct)), 0) +
  coalesce(array_sum(array_map(x -> murmur_hash3_32(coalesce(x, 0)), arr_order_by)), 0)
) as fingerprint from (
  select v1, v2, v3,
  array_agg(v1) over(order by v2) as arr_basic,
  array_agg(distinct v2) over(order by v2) as arr_distinct,
  array_agg(v3 order by v2) over(order by v2) as arr_order_by
  from t0
) as t;

select sum(coalesce(array_sum(array_map(x -> murmur_hash3_32(coalesce(x, 0)), arr_distinct_float)), 0)) as fingerprint from (
  select v1, v2, v6,
  array_agg(distinct v6) over(partition by v1 order by v2) as arr_distinct_float
  from t0
) as t;

select sum(coalesce(array_sum(array_map(x -> murmur_hash3_32(coalesce(x, '')), arr_basic)), 0)) as fingerprint from (
  select v1, v2, v3,
  array_agg(upper(v4)) over(partition by v1 order by v2) as arr_basic
  from t0
) as t;

select sum(coalesce(array_sum(array_map(x -> murmur_hash3_32(coalesce(x, 0)), arr_basic)), 0)) as fingerprint from (
  select v1, v2, v3,
  array_agg(pow(v6, 2)) over(partition by v1 order by v2) as arr_basic
  from t0
) as t;

select sum(coalesce(array_sum(array_map(x -> murmur_hash3_32(coalesce(x, 0)), arr_basic)), 0)) as fingerprint from (
  select v1, v2, v3,
  array_agg(0) over(partition by v1 order by v2) as arr_basic,
  array_agg('constant') over(partition by v1 order by v2) as arr_basic2,
  array_agg(3.14159) over(partition by v1 order by v2) as arr_basic3
  from t0
) as t;

select sum(coalesce(array_sum(array_map(x -> murmur_hash3_32(coalesce(x, 0)), arr_basic)), 0)) as fingerprint from (
  select v1, v2, v3,
  array_agg(v1) over(partition by v1, v2 order by v3) as arr_basic
  from t0
) as t;

select sum(coalesce(array_sum(array_map(x -> murmur_hash3_32(coalesce(x, '')), arr_string)), 0)) as fingerprint from (
  select v1, v2, v4,
  array_agg(v4) over() as arr_string
  from t1
) as t;

select sum(coalesce(array_sum(array_map(x -> murmur_hash3_32(coalesce(x, 0)), arr_order_by)), 0)) as fingerprint from (
  select v1, v2, v3,
  array_agg(v3 order by v2) over(partition by v1 order by v2) as arr_order_by
  from t1
) as t;

select sum(coalesce(array_sum(array_map(x -> murmur_hash3_32(coalesce(x, 0)), arr_basic)), 0)) as fingerprint from (
  select v1, v2, v3,
  array_agg(v3) over() as arr_basic
  from t1
  where v1 = 1 and v2 = 2
) as t;

select sum(
  coalesce(array_sum(array_map(x -> murmur_hash3_32(coalesce(x, 0)), arr_basic)), 0) +
  coalesce(array_sum(array_map(x -> murmur_hash3_32(coalesce(x, 0)), arr_distinct)), 0) +
  coalesce(array_sum(array_map(x -> murmur_hash3_32(coalesce(x, 0)), arr_order_by)), 0)
) as fingerprint from (
  select v1, v2, v3,
  array_agg(v3) over(partition by v1 order by v2) as arr_basic,
  array_agg(distinct v2) over(partition by v1 order by v2) as arr_distinct,
  array_agg(v3 order by v2) over(partition by v1 order by v2) as arr_order_by
  from t1
) as t;

select array_contains([1,2,3,null], null) from t order by pk limit 10;

select sum(array_position(@arr, 100)) from t;

select sum(array_position(arr_decimal, pk)) from t;

insert into t select 1, null, null, null, null;

select array_length(i_1) from array_test order by pk;

select array_length(aad_1) from array_test order by pk;

select array_sum(d_1) from array_test order by pk;

select array_avg(s_1) from array_test order by pk;

select array_avg(d_6) from array_test order by pk;

select array_min(d_1) from array_test order by pk;

select array_min(['a', 'b', 'c']) from array_test order by pk;

select array_max(d_4) from array_test order by pk;

select array_distinct(i_1) from array_test order by pk;

select array_distinct(ai_1) from array_test order by pk;

select array_sort(s_1) from array_test order by pk;

select array_sort(d_6) from array_test order by pk;

select array_agg(d_1) from array_test where pk = 1;

select array_agg(aas_1) from array_test where pk = 1;

select array_distinct(array_agg(d_3)) from array_test where pk = 1;

select array_distinct(array_agg(NULL)) from array_test where pk = 1;

select array_agg(i_1 order by pk) from array_test;

select array_agg(ai_1 order by pk) from array_test;

select reverse(i_1) from array_test order by pk;

select reverse(ai_1) from array_test order by pk;

select array_difference(s_1) from array_test order by pk;

select array_difference(d_6) from array_test order by pk;

select array_difference([[1,2,3], [2,3,4]]) from array_test order by pk;

select array_append(d_2, -1) from array_test order by pk;

select array_append(d_6, 10) from array_test order by pk;

select array_append(aad_1, -10) from array_test order by pk;

select array_contains(f_1, 100) from array_test order by pk;

select array_contains(d_4, 100) from array_test order by pk;

select array_contains(NULL, -10) from array_test order by pk;

select array_contains_all([parse_json('{"addr": 1}'), parse_json('{"addr": 2}')], 
                          [parse_json('{"addr": 1}'), parse_json('{"addr": 2}'), parse_json('{"addr": 3}')]);

select array_remove(ai_1, 1) from array_test order by pk;

select array_remove([[1,2,3], [2,3,4]], 1) from array_test order by pk;

select array_position(aas_1, 1) from array_test order by pk;

select array_slice(s_1, 3) from array_test order by pk;

select array_slice(d_1, -1) from array_test order by pk;

select array_slice(d_3, -10) from array_test order by pk;

select array_slice(d_5, -10) from array_test order by pk;

select array_slice(as_1, -10) from array_test order by pk;

select array_slice([1.0,2.1,3.2,4.3], 3) from array_test order by pk;

select array_concat(s_1, i_1) from array_test order by pk;

select array_concat(s_1, ai_1) from array_test order by pk;

select array_concat(i_1, s_1) from array_test order by pk;

select array_concat(f_1, d_6) from array_test order by pk;

select array_concat(f_1, [[1,2,3], [2,3,4]]) from array_test order by pk;

select array_concat(d_3, d_4) from array_test order by pk;

select array_concat(d_3, ['a', 'b', 'c']) from array_test order by pk;

select array_concat(d_4, aad_1) from array_test order by pk;

select array_concat(d_5, d_2) from array_test order by pk;

select array_concat(d_6, s_1) from array_test order by pk;

select array_concat(d_6, [1.0,2.1,3.2,4.3]) from array_test order by pk;

select array_concat(ai_1, ai_1) from array_test order by pk;

select array_concat(as_1, s_1) from array_test order by pk;

select array_concat(as_1, NULL) from array_test order by pk;

select array_concat(aas_1, aas_1) from array_test order by pk;

select array_concat(aad_1, f_1) from array_test order by pk;

select array_concat(aad_1, NULL) from array_test order by pk;

select array_concat([1.0,2.1,3.2,4.3], s_1) from array_test order by pk;

select array_concat([1.0,2.1,3.2,4.3], NULL) from array_test order by pk;

select array_concat(['a', 'b', 'c'], as_1) from array_test order by pk;

select array_concat([[1,2,3], [2,3,4]], d_1) from array_test order by pk;

select array_sort(array_intersect(d_5, d_4)) from array_test order by pk;

select array_sort(array_intersect(d_6, d_1)) from array_test order by pk;

select array_sort(array_intersect(ai_1, d_2)) from array_test order by pk;

select array_sort(array_intersect(as_1, [1.0,2.1,3.2,4.3])) from array_test order by pk;

select array_sort(array_intersect(aad_1, i_1)) from array_test order by pk;

select array_sort(array_intersect(aad_1, NULL)) from array_test order by pk;

select array_sort(array_intersect(NULL, [[1,2,3], [2,3,4]])) from array_test order by pk;

select array_sort(array_intersect(['a', 'b', 'c'], ai_1)) from array_test order by pk;

select array_sort(array_intersect([[1,2,3], [2,3,4]], s_1)) from array_test order by pk;

select array_sort(array_intersect([[1,2,3], [2,3,4]], [1.0,2.1,3.2,4.3])) from array_test order by pk;

select any_match((x,y) -> x < y, [], []);

select all_match([]);

select d_6, d_5, any_match(d_6,d_5, (x,y)->x >y) from array_test order by pk;

select any_match((x,y) -> x < y, []);

select array_sum(array_map(x->not like(x, 'starRocks'),s_1)) from array_test order by 1;

select ARRAY_DISTINCT( cast ('[40360,40361]' as array<int>));

select array_position( cast ('[40360,40361]' as array<int>), 40360);

select bitmap_to_array(array_to_bitmap(cast ('[40360,40361]' as array<int>)));

select array_cum_sum( cast ('null' as array<int>));

select array_max( cast ('null' as array<int>));

select array_sum( cast ('null' as array<int>));

select array_contains([map{1:2, 2:3, 3:4}, map{3:4, 4:null}], map{3:4, 4:null});

select array_contains_all([map{1:2, 2:3, 3:4}, map{3:4, 4:5}, map{3:4, 4:5}, map{1:2, 2:3, 3:4}], [map{1:2, 2:3, 3:4}, map{3:4, 4:5}]);

select array_remove([row(1,2,3), row(3,4,5)], row(5,6,7));

select array_intersect([row(1,2,3), row(3,4,5)], [row(3,4,5)]);

select array_contains_seq([], []);

select array_contains_seq([json_keys('{"a":1,"b":2}')], [json_keys('{"a":1,"b":2}')]);

select array_contains_seq([1, 2, NULL], [null,2]);

select array_contains_seq(ai_0, ai_1) from array_test_01 order by pk;

select count() from array_map_test where any_match(x->any_match(x->x<10, arr_largeint), arr_largeint);

select id, array_map((x, y) -> x + y, arr_int, arr_int) from array_map_dup order by id;

WITH input AS (
    SELECT id, ARRAY_MAP(arg -> (CAST(MONTH(arg) AS BIGINT) IN (1, 2)), arr_datetime) AS arr
    FROM array_map_in_reuse_t
)
SELECT id, CAST(1 AS BIGINT) FROM input WHERE ARRAY_SUM(arr) ORDER BY id;

-- control: mixing in a non-empty array takes the general path and was already correct
CREATE TABLE amt2 (id INT, arr ARRAY<INT>) DUPLICATE KEY(id)
DISTRIBUTED BY HASH(id) BUCKETS 1 PROPERTIES ("replication_num" = "1");

SELECT id, array_min(array_tinyint) AS result FROM test_array_min_max ORDER BY id;

SELECT id, array_min(array_int) AS result 
FROM test_array_min_max 
WHERE array_length(array_int) > 3 ORDER BY id;

SELECT id, array_min(array_float) AS result 
FROM test_array_min_max 
WHERE array_float IS NOT NULL ORDER BY id;

SELECT id, array_min(array_decimal128) AS result FROM test_array_min_max ORDER BY id;

SELECT id, array_min(array_decimalv2) AS result 
FROM test_array_min_max 
WHERE array_length(array_decimalv2) > 3 ORDER BY id;

SELECT id, array_min(array_varchar) AS result 
FROM test_array_min_max 
WHERE array_varchar IS NOT NULL ORDER BY id;

SELECT id, array_max(array_smallint) AS result FROM test_array_min_max ORDER BY id;

SELECT id, array_max(array_bigint) AS result 
FROM test_array_min_max 
WHERE array_length(array_bigint) > 3 ORDER BY id;

SELECT id, array_max(array_decimal32) AS result 
FROM test_array_min_max 
WHERE array_decimal32 IS NOT NULL ORDER BY id;

SELECT id, array_max(array_double) AS result FROM test_array_min_max ORDER BY id;

SELECT id, array_max(array_date) AS result 
FROM test_array_min_max 
WHERE array_length(array_date) > 3 ORDER BY id;

SELECT id, array_remove(array_boolean, NULL) AS result FROM test_array_remove ORDER BY id;

SELECT id, array_remove(array_int, 50) AS result FROM test_array_remove ORDER BY id;

SELECT id, array_remove(array_largeint, 765432198765432109) AS result FROM test_array_remove ORDER BY id;

SELECT id, array_remove(array_decimal64, NULL) AS result FROM test_array_remove ORDER BY id;

SELECT id, array_remove(array_double, 123.456) AS result FROM test_array_remove ORDER BY id;

SELECT id, array_remove(array_date, '2025-01-13') AS result FROM test_array_remove ORDER BY id;

SELECT distinct array_sort(c1, (x, y) -> IF(x < y, 1, IF(x = y, 0, -1))) from t0;

SELECT distinct array_sort([3, 2, 5, 1, 2], (x, y) -> IF(x < y, 1, IF(x = y, 0, -1))) from t0;

SELECT array_sort([1,2,3,4,5,6,7,8], (x,y)->CASE WHEN (x = 1 and y = 2) or (y = 1 and x = 2) THEN -1 ELSE x - y END);

create table t0 (
    k0 int,
    c0 array<string>,
    c1 array<string>
)
properties(
   "replication_num" = "1"
);

insert into t0 select i
       ,[3,2,null,5,null,1,2] as c0
from table(generate_series(0,10000)) t(i);

SELECT distinct array_sort([[2, 3, 1], [4, 2, 1, 4], [1, 2]], (x, y) -> IF(cardinality(x) < cardinality(y), -1, IF(cardinality(x) = cardinality(y), 0, 1))) from t0;

-- an inconsistent comparator may return an arbitrary permutation, but never anything else
SELECT distinct cardinality(array_sort(c0, (x, y) -> if(x > 100 and y > 100, -1, if(x < y, -1, if(x = y, 0, 1))))) from t0;

-- the validator samples the first 10 distinct values, so give it exactly 10
insert into t0 select i, [1,2,3,4,5,6,7,8,9,10] from table(generate_series(1, 200000)) t(i);

select id, array_col1, array_col2, array_col3, array_col4, array_sortby(array_col1, array_col2, array_col3, array_col4) from t1 order by id asc;

with w1 as (
    select id, array_sortby(int_1, int_2) as x from t1
), w2 as (
    select array_join(x, '-') as x
    from w1
)
select ifnull(sum(murmur_hash3_32(x)), 0)
from w2;

-- Non-nullable source and key columns.
CREATE TABLE t3 (
    id INT(11) not null,
    int_1 ARRAY<INT> not null,
    int_2 ARRAY<INT> not null,
    str_1 ARRAY<VARCHAR(20)> not null,
    date_1 ARRAY<DATE> not null
) ENGINE=OLAP
DUPLICATE KEY(id)
COMMENT "OLAP"
DISTRIBUTED BY HASH(id) BUCKETS 32
PROPERTIES (
    "replication_num" = "1"
);

select array_sortby([1,2,3,4,5,6], ['a', 'b', 'c', 'c', 'b', 'a'], cast(null as array<int>), cast(null as array<string>), [11, 22, 32, 31, 21, 12], cast(null as array<int>));

select array_sortby([1,2,3,4,5,6], ['a', 'b', null, null, 'b', 'a'], cast(['2023-11-02', '2023-11-03', '2023-11-04', '2023-11-05', null ,null] as array<date>));

SELECT array_sortby(array_boolean, [false, true]) FROM test_array_sortby WHERE id = 7;

SELECT array_sortby(array_bigint, [750, 500]) FROM test_array_sortby WHERE id = 7;

SELECT array_sortby(array_decimal32, [45678.90, 12345.67]) FROM test_array_sortby WHERE id = 7;

SELECT array_sortby(array_varchar, ['banana', 'cherry']) FROM test_array_sortby WHERE id = 7;

INSERT INTO test_array_functions VALUES
(1, [true, false, true], [1, 2, 3], [100, 200, 300], [10, 20, 30], [1000, 2000, 3000], 
 [9223372036854775806, 9223372036854775807], [1.5, 2.5, 3.5], [2.34, 1.23, 3.45], 
 [12345.67, 45678.90], [1234567890.12, 987654321.12], [12345678901234567890.1234567890, 9876543210987654321.1234567890], 
 [12345.67, 67890.12]),
(2, [false, true], [4, 5], [400, 500], [40, 50], [4000, 5000], 
 [9223372036854775805, 9223372036854775804], [4.5, 5.5], [4.56, 5.67], 
 [56789.01, 67890.12], [2345678901.23, 3456789012.34], [456789123456789123.1234567890, 789123456789012345.1234567890], 
 [34567.89, 23456.78]),
(3, [true, true], [6, 7], [600, 700], [60, 70], [6000, 7000], 
 [9223372036854775803, 9223372036854775802], [6.5, 7.5], [6.78, 7.89], 
 [78901.12, 12345.67], [987654321.12, 1234567890.12], [9876543210987654321.1234567890, 12345678901234567890.1234567890], 
 [78901.34, 12345.67]),
(4, [false], [8], [800], [80], [8000], 
 [9223372036854775801], [8.5], [8.90], 
 [12345.67], [6789012345.67], [7891234567890123456.1234567890], 
 [45678.90]),
(5, [true, false, true], [9, 10, 11], [900, 1000, 1100], [90, 100, 110], [9000, 10000, 11000], 
 [9223372036854775800, 9223372036854775799, 9223372036854775798], [9.5, 10.5, 11.5], [9.12, 10.34, 11.56], 
 [45678.12, 23456.34, 78901.56], [3456789012.45, 2345678901.23, 1234567890.12], 
 [1234567890123456789.1234567890, 987654321098765432.1234567890, 456789123456789123.1234567890], 
 [56789.12, 23456.34, 78901.56]),
(6, [false, false], [12, 13], [1200, 1300], [120, 130], [12000, 13000], 
 [9223372036854775797, 9223372036854775796], [12.5, 13.5], [12.34, 13.45], 
 [1234.56, 1234.56], [123456.78, 123456.78], [1234567890.1234567890, 1234567890.1234567890], 
 [1234.56, 1234.56]),
(7, [true], [14], [1400], [140], [14000], 
 [9223372036854775795], [14.5], [14.67], 
 [23456.78], [345678901.23], [9876543210123456789.9876543210], 
 [12345.67]),
(8, [false, true, false], [15, 16, 17], [1500, 1600, 1700], [150, 160, 170], [15000, 16000, 17000], 
 [9223372036854775794, 9223372036854775793, 9223372036854775792], [15.5, 16.5, 17.5], [15.34, 16.45, 17.56], 
 [12345.67, 67890.12, 45678.90], [987654321.12, 123123123.45, 1234567890.12], 
 [12345678901234567890.1234567890, 456789123456789123.1234567890, 9876543210987654321.1234567890], 
 [67890.12, 78901.34, 12345.67]),
(9, [true, true, false], [18, 19, 20], [1800, 1900, 2000], [180, 190, 200], [18000, 19000, 20000], 
 [9223372036854775791, 9223372036854775790, 9223372036854775789], [18.5, 19.5, 20.5], [18.67, 19.78, 20.89], 
 [56789.01, 67890.12, 78901.34], [1234567890.12, 2345678901.23, 3456789012.34], 
 [9876543210987654321.1234567890, 12345678901234567890.1234567890, 456789123456789123.1234567890], 
 [34567.89, 45678.90, 12345.67]),
(10, [false, true, false], [21, 22, 23], [2100, 2200, 2300], [210, 220, 230], [21000, 22000, 23000], 
 [9223372036854775788, 9223372036854775787, 9223372036854775786], [21.5, 22.5, 23.5], [21.23, 22.34, 23.45], 
 [1234.56, 4567.89, 6789.01], [345678901.23, 1234567890.12, 987654321.12], 
 [456789123456789123.1234567890, 12345678901234567890.1234567890, 9876543210987654321.1234567890], 
 [1234.56, 4567.89, 6789.01]);

-- Test DOUBLE type with n=3
SELECT id, array_top_n(array_double, 3) AS result FROM test_array_top_n ORDER BY id;

-- Test with n larger than array size
SELECT id, array_top_n(array_int, 10) AS result FROM test_array_top_n WHERE id = 1 ORDER BY id;

-- Test empty inline array
SELECT array_top_n([], 3) AS result;

select arrays_overlap(NULL, -1) from array_test order by pk;

select arrays_overlap(s_1, d_6) from array_test order by pk;

select arrays_overlap(i_1, d_3) from array_test order by pk;

select arrays_overlap(f_1, d_4) from array_test order by pk;

select arrays_overlap(f_1, NULL) from array_test order by pk;

select arrays_overlap(d_1, [4, 5, 2, null, 1]) from array_test order by pk;

select arrays_overlap(d_4, d_4) from array_test order by pk;

select arrays_overlap(d_6, s_1) from array_test order by pk;

select arrays_overlap(ai_1, ai_1) from array_test order by pk;

select arrays_overlap(as_1, aad_1) from array_test order by pk;

select arrays_overlap(aad_1, as_1) from array_test order by pk;

select arrays_overlap([4, 5, 2, null, 1], aad_1) from array_test order by pk;

select arrays_overlap(NULL, ai_1) from array_test order by pk;

select arrays_overlap([parse_json('{"addr": 1}'), parse_json('{"addr": 2}')],
                        [parse_json('{"addr": 3}'), parse_json('{"addr": 4}')]);

insert into t1 values
    (1, null, ['a', 'c', 'b', null]),
    (2, null, ['a', 'c', 'b']),
    (3, null, ['a', 'c']),
    (4, null, ['a']);

select k1, a1, a2, arrays_overlap(a2, ifnull(a1, [])) from t1 order by k1;

select k1, a1, a2, arrays_overlap(ifnull(a1, ['a', null]), ifnull(a1, ['a', 'b', null])) from t1 order by k1;

SELECT * FROM (SELECT 1 AS id) a WHERE a.id = 1 AND arrays_zip([1], ['a']) IS NOT NULL;

-- Test with single element arrays (non-constant)
SELECT pk, arrays_zip(single_element_array, str_array) FROM arrays_zip_test ORDER BY pk;

-- Test with decimal arrays (non-constant)
SELECT pk, arrays_zip(int_array, decimal_array) FROM arrays_zip_test ORDER BY pk;

-- Test arrays_zip with DISTINCT
SELECT DISTINCT arrays_zip([1, 2], ['a', 'b']) FROM arrays_zip_test LIMIT 5;

-- name: test_nested_lambda_topn
-- ORDER BY plus LIMIT builds a TopN node, and its runtime-filter construction asks whether each
-- expression is bound by a set of tuples. That walk descends into the inner lambda and reaches the
-- slot the planner materialised for the cast around array_length(), which belongs to no tuple.
select array_map(a -> array_map(b -> array_length(a) + b, a), ARRAY<ARRAY<TINYINT>>[ARRAY<TINYINT>[1,2]]) order by 1 limit 1;

-- ordering still works over several rows
select x, array_map(a -> array_map(b -> array_length(a) + b, a), ARRAY<ARRAY<TINYINT>>[ARRAY<TINYINT>[1,2]]) from (select 3 as x union all select 1 union all select 2) t order by x desc limit 2;

INSERT INTO arrow_demo.students (id, name, age, enrollment_date) VALUES (1, 'John Doe', 20, '2024-01-10'),(2, 'Jane Smith', 22, '2024-01-11'),(3, 'Emily Davis', 21, '2024-01-12');

UPDATE test SET name = 'Charlie' WHERE id = 1;

INSERT INTO test2 VALUES (1, 18), (2, 20);

select * from t1 order by k1 DESC limit 10;

select distinct k1, c_boolean, c_tinyint, c_smallint, c_int, c_bigint, c_largeint, c_float, c_double, c_decimalv2, c_decimal32, c_decimal64, c_decimal128, c_date, c_datetime, c_varchar, c_char from t1 order by k1 limit 10;

USE test_insert_auto_increment;

INSERT INTO t (id,name,job1,job2) VALUES (1,1,1,1),(100000,1,2,2);

INSERT INTO t (id,name,job1, job2) VALUES (5,5,100,5);

INSERT INTO t3 (id,name,job1,job2) VALUES (1,1,DEFAULT,1);

CREATE TABLE t ( id BIGINT NOT NULL,  name BIGINT NOT NULL, job1 BIGINT NOT NULL, job2 BIGINT NOT NULL AUTO_INCREMENT) Primary KEY (id, name) DISTRIBUTED BY HASH(id) BUCKETS 1 PROPERTIES("replication_num" = "1", "replicated_storage"="true");

CREATE TABLE t ( id BIGINT NOT NULL,  name BIGINT NOT NULL AUTO_INCREMENT, job1 BIGINT NULL, job2 BIGINT NULL) Primary KEY (id) DISTRIBUTED BY HASH(id) BUCKETS 1 PROPERTIES("replication_num" = "1", "replicated_storage"="true");

INSERT INTO t2 VALUES (1, NULL), (2, NULL);

DROP DATABASE test_table_with_null;

-- name: test_auto_increment_partial_update_only
CREATE DATABASE test_auto_increment_partial_update_only;

insert into t_auto_increment_insert_partial_update (k) values (1);

insert into t_auto_increment_insert_partial_update (ts, testString) select 100, "abc";

DROP TABLE t_auto_increment_partial_update_column_upsert;

DROP TABLE t_alter_auto_increment_counter;

DROP DATABASE test_auto_increment_partial_update_column_upsert_2;

alter table t set('bucket_size'='1');

-- name: test_list_partition @sequential
create database ddd;

insert into t values('2021-01-01', 1, 1);

insert into t values('2021-01-05', 3, 3);

alter table t set('mutable_bucket_num'='-1');

insert into t values('2021-01-03', default);

-- explain select * from dt_day where event_day='2023-02-14';
CREATE TABLE dt_year( event_day DATE, pv BIGINT) DUPLICATE KEY(event_day) PARTITION BY date_trunc('year', event_day) DISTRIBUTED BY HASH(event_day) BUCKETS 8 PROPERTIES("replication_num" = "3");

insert into dt_day values('2023-03-14 12:31:07', 2);

CREATE TABLE dt_week( event_day DATE, pv BIGINT) DUPLICATE KEY(event_day) PARTITION BY date_trunc('week', event_day) DISTRIBUTED BY HASH(event_day) BUCKETS 8 PROPERTIES("replication_num" = "3");

-- name: test_multi_fragment_open_new_node_channel @sequential
CREATE TABLE ss( event_day DATE, pv BIGINT) DUPLICATE KEY(event_day) PARTITION BY date_trunc('month', event_day) DISTRIBUTED BY HASH(event_day) BUCKETS 8 PROPERTIES("replication_num" = "3");

CREATE TABLE ss_day( event_day DATETIME, pv BIGINT) DUPLICATE KEY(event_day) PARTITION BY time_slice(event_day, interval 4 day) DISTRIBUTED BY HASH(event_day) BUCKETS 8 PROPERTIES("replication_num" = "3");

-- CREATE TABLE ss_hour( event_day DATETIME, pv BIGINT) DUPLICATE KEY(event_day) PARTITION BY time_slice(event_day, interval 2 hour) DISTRIBUTED BY HASH(event_day) BUCKETS 8 PROPERTIES("replication_num" = "3");
-- insert into ss_hour values('2023-02-14 12:31:07', 2);
-- show partitions from ss_hour;
-- insert into ss_hour values('2023-02-14 13:31:07', 2);
-- show partitions from ss_hour;
-- insert into ss_hour values('2023-02-14 14:31:08', 2);
-- show partitions from ss_hour;
-- name: test_two_replica
CREATE TABLE ss( event_day DATE, pv BIGINT) DUPLICATE KEY(event_day) PARTITION BY date_trunc('month', event_day) DISTRIBUTED BY HASH(event_day) BUCKETS 1 PROPERTIES("replication_num" = "2");

insert into ss values('2002-01-08', 2);

insert into t select 2 FROM TABLE(generate_series(1,  4096));

INSERT INTO lineorder (lo_orderkey, lo_linenumber, lo_custkey, lo_partkey, lo_suppkey, lo_orderdate, lo_orderpriority,
lo_shippriority, lo_quantity, lo_extendedprice, lo_ordtotalprice, lo_discount, lo_revenue, lo_supplycost,
lo_tax, lo_commitdate, lo_shipmode)
VALUES (1, 1, 1, 1, 1, 19920101, 'LOW', 1, 100, 200, 300, 10, 190, 100, 5, 19920201, 'AIR');

CREATE TABLE lineorder_automatic2
PARTITION BY date_trunc('year', `LO_ORDERDATE`)
(
    START ("1992-01-01") END ("1999-01-01") EVERY (INTERVAL 1 YEAR)
)
DISTRIBUTED BY HASH (`LO_ORDERKEY`)
AS SELECT * FROM lineorder;

-- name: test_create_partition_fail @sequential
CREATE TABLE ss( event_day DATE, pv BIGINT, cc int) DUPLICATE KEY(event_day) PARTITION BY date_trunc('month', event_day) DISTRIBUTED BY HASH(event_day) BUCKETS 1 PROPERTIES("replication_num" = "1");

insert into t1 values(1,1,1,'hangzhou', '2022-04-01');

CREATE TABLE position_v6 (
  `group_id` varchar(100) NOT NULL,
  `position_id` bigint(20) NOT NULL,
  `location_country` varchar(100) NULL,
  `job_function` varchar(100) NULL,
  `business_unit` varchar(100) NULL,
  `position_type` varchar(50) NULL
) ENGINE=OLAP
PRIMARY KEY(`group_id`, `position_id`)
PARTITION BY (`group_id`)
DISTRIBUTED BY HASH(`position_id`) BUCKETS 2
ORDER BY(`location_country`, `job_function`, `business_unit`)
PROPERTIES (
    "replication_num" = "1"
);

-- "a-b", "a:b", "a b", "ab" all format to the same partition name "ab"
INSERT INTO collision_tbl VALUES
  ('ab', 1),
  ('a-b', 2),
  ('a:b', 3),
  ('a b', 4);

insert into t values(2,UNIX_TIMESTAMP('2020-01-01 01:01:01'),2);

insert into t1 values(1,UNIX_TIMESTAMP('2020-01-01 01:01:01'),1);

explain select * from t1 where k2=1196389819;

insert into base_tbl_unix_ts values(1592841600, 'beijing', '2020-06-23');

create table t(k1 int, k2 bigint, __generated_partition_column_0 int);

-- name: test_create_table_like @native
CREATE TABLE base_tbl (
                    `k1`  date,
                    `k2`  datetime,
                    `k3`  varchar(20),
                    `k4`  varchar(20),
                    `k5`  boolean,
                    `k6`  tinyint,
                    `k7`  smallint,
                    `k8`  int,
                    `k9`  bigint,
                    `k10` largeint,
                    `k11` float,
                    `k12` double,
                    `k13` decimal(27,9)
                )
                duplicate KEY(k1,k2,k3,k4,k5)
                COMMENT "OLAP"
                PARTITION BY substring(k4, 1, 5), k3, date_trunc("month", k1)
                DISTRIBUTED BY HASH(`k1`, `k2`, `k3`) BUCKETS 3
                PROPERTIES (
                    "replication_num" = "3"
                );

CREATE TABLE ss1(event_day DATETIME, pv BIGINT) PARTITION BY pv, date_trunc('day', event_day) DISTRIBUTED BY HASH(event_day) PROPERTIES("partition_retention_condition" = "event_day >= current_date() - interval 3 day and pv = 1");

ALTER TABLE ss1 set ("partition_retention_condition" = "event_day >= current_date() - interval 3 day and pv = 1");

select id, bins from t_array_binary order by id;

select [to_binary('AABB', 'hex'), null];

-- name: test_base64_to_bitmap

select base64_to_bitmap(null);

select bitmap_contains(base64_to_bitmap('CgsAAABaAAAAAAAAAFsAAAAAAAAAXAAAAAAAAABdAAAAAAAAAF4AAAAAAAAAXwAAAAAAAABgAAAAAAAAAGEAAAAAAAAAYgAAAAAAAABjAAAAAAAAAGQAAAAAAAAA'), 95);

insert into t_base64_bitmap_pred values (90), (95), (100), (200), (50);

drop table t_base64_bitmap_nonconst;

select bitmap_to_string(sub_bitmap(bitmap_from_string('1,0,1,2,3,1,5'), 3, 6));

select bitmap_to_string(bitmap_subset_limit(bitmap_from_string('1,0,1,2,3,1,5'), 0, 3));

SELECT bitmap_to_string(bitmap_subset_limit(bitmap_from_string(group_concat(cast(x as string), ',')), 10, -3)) FROM TABLE(generate_series(1, 64, 1)) t(x);

SELECT bitmap_to_string(bitmap_subset_in_range(bitmap_from_string(group_concat(cast(x as string), ',')), 0, 3)) FROM TABLE(generate_series(1, 64, 1)) t(x);

insert into test_bitmap_table1 select 1, to_bitmap('1');

select bitmap_to_string(bitmap_subset_limit(v1, 0, 3)) from test_bitmap_table1 order by k1;

select bitmap_to_string(bitmap_subset_in_range(v1, 1, 3)) from test_bitmap_table1 order by k1;

-- nullable column (const split size)
truncate table t1;

select c1, bitmap_min(subdivide_bitmap) as min_value, bitmap_to_string(subdivide_bitmap) from t1, subdivide_bitmap(t1.c2, 1) order by c1, min_value;

insert into t2 select 4, 2, to_bitmap(1);

insert into t3 select 1, bitmap_empty();

select c1, bitmap_min(subdivide_bitmap) as min_value, bitmap_to_string(subdivide_bitmap) from t3, subdivide_bitmap(t3.c2, 13) order by c1, min_value;

insert into t4 select 6, 10, bitmap_agg(generate_series) from table(generate_series(1, 60));

SET enable_profile = true;

-- Exactly the buffer size: one full pass per piece and a `taken == 0` on the next one, the boundary
-- where an off-by-one in the loop condition would either drop a piece or spin.
SELECT bitmap_count(subdivide_bitmap) AS cnt, bitmap_min(subdivide_bitmap) AS lo,
       bitmap_max(subdivide_bitmap) AS hi, array_sum(bitmap_to_array(subdivide_bitmap)) AS total
FROM sbs, subdivide_bitmap(b, 4096) ORDER BY lo;

-- name: test_unnest_bitmap
CREATE TABLE `t1` (
  `c1` int(11) NULL COMMENT "",
  `c2` bitmap BITMAP_UNION NULL COMMENT ""
) ENGINE=OLAP
AGGREGATE KEY(`c1`)
DISTRIBUTED BY HASH(`c1`) BUCKETS 1
PROPERTIES ("replication_num" = "1");

select c1, unnest_bitmap as c3 from t1, unnest_bitmap(c2) order by c1 desc, c3 desc limit 5;

-- name: test_broadcast_join_grf_right_offspring_determinism
-- Regression test for #44111 / #48496.
--
-- An upper non-broadcast join must not push its runtime filter onto the local right
-- (build) offsprings of a broadcast join that itself builds a global RF. A broadcast
-- join's build input is replicated, so every instance has to see the SAME rows; if the
-- upper RF prunes that input, instances build different hash tables and emit different
-- GRFs, and the broadcast-mode merge keeps only one of them -- so the probe side
-- silently drops rows.
--
-- The guard lives in PlanFragment.removeRfOnRightOffspringsOfBroadcastJoin() (FE) and
-- in RuntimeFilterProbeCollector::push_down() (BE). Remove either one and the
-- fingerprint below diverges from its enable_global_runtime_filter=false value.
--
-- A single execution only diverges ~90% of the time (it is a race between the upper
-- RF arriving and the broadcast build side being consumed), so the query runs 30
-- times: one wrong execution fails the case, which makes the file deterministic.
--
-- Needs a multi-BE cluster: with a single fragment instance there is nothing to diverge.

DROP TABLE if exists t0;

INSERT INTO t2
    (c0, c1, c2
    )
    VALUES
        ('10', 'hHG9GCIJaE0R1LGw1YOON14EP', 'TSIquQ1H9SuiyrkWXHsPAb'
            ),
        ('12', 'GZjvI0nqA29SNPeJu', 'Jv8hlqasc4X'
            ),
        ('13', 'yZRjWXPvJ5K7', 'Yy8BcdS'
            ),
        ('13', 'Eq3zv98', 'enUAyzJ'
            ),
        ('11', 'KfXyxjNoR1UMJLQVov9gqvqW', 'D8tVXXUt'
            ),
        ('13', '0EMj6DoEnTBfu', '46aDAUNOiCYdlhFt7N1AUtkQduVmr0'
            ),
        ('7', 'sMPdn6duIpSPEakZvgWTHaqGmVCx', 'EXN0OJXKgpJ5GXS5M527hGCutewN2Y'
            ),
        ('8', 'GwtKaeSezvRskPeKQA', '2Q3oSkQI4FjMyNKgBA3qZZwPfAL'
            ),
        ('6', 'RlUBfggH9iqhgxsUcU4e', 'x8xTgfsJX5ymxNUr'
            ),
        ('13', 'RrpepqVmxIYhRv', 'JkLAXbF3n0qFrhKJBFiektS3K1vajU'
            );

create table t1 (id int) duplicate key(id);

select id, tags from t1 order by id;

-- CACHE SELECT over a table with complex-type columns while a predicate on a
-- subset of columns reorders the read schema. The reorder must not misalign the
-- per-column scratch buffer used by get_io_range_vec, otherwise the array/map
-- iterator is paired with a scalar column and the CN crashes.
CREATE TABLE t2 (
    k1 int NOT NULL,
    v_arr array<bigint> NOT NULL,
    v_map map<int, string> NOT NULL,
    dtm int NOT NULL
)
DUPLICATE KEY(k1)
PARTITION BY RANGE(dtm) (PARTITION p20260630 VALUES [("20260630"), ("20260701")))
DISTRIBUTED BY HASH(k1) BUCKETS 1;

-- Buggy CN should crash in ArrayColumnIterator::get_io_range_vec().
-- Fixed CN should execute successfully.
CACHE SELECT c1, arr, c3
FROM t_array
WHERE c3 >= '2025-12-23 00:00:00';

select '3.14'::decimal(10,2)::string;

select '[1,2,3]'::array<int>[1];

insert into dim values
    (1, '1'),
    (2, '10'),
    (3, '100');

-- Create generated column using v0 and v1
ALTER TABLE t_gen ADD COLUMN v2 bigint AS v0+v1;

CREATE TABLE `t` (
    k1 int,
    v0 int,
    v1 int
)
DUPLICATE KEY(`k1`)
DISTRIBUTED BY HASH(`k1`) BUCKETS 3
PROPERTIES('replication_num' = '1');

-- Insert more data to verify MV works correctly
-- After schema changes, column order is: k1, v1, v2, v0
INSERT INTO t (k1, v1, v0) VALUES (2, 2, 'test');

insert into test_array_ndv values
(1, [1,2,3], ['a', 'b', 'c'], [[12], [34], [4444]]),
(3, [1, null], null, [[1, null], null]),
(null, null, null, null),
(4, [], [], []);

select crc32_hash([cast(1 as int), null]);

SELECT arr_int, crc32_hash(arr_int) FROM test_array_comprehensive_ndv ORDER BY k1;

SELECT arr_struct_complex, crc32_hash(arr_struct_complex) FROM test_array_comprehensive_ndv ORDER BY k1;

SELECT crc32_hash([map(1,NULL)]) as array_map_with_null_hash;

drop table test_array_collection_size;

CREATE TABLE test_80col (
    column1 INT NOT NULL,
    column2 INT NOT NULL,
    column3 INT,
    column4 INT,
    column5 INT,
    column6 INT,
    column7 INT,
    column8 INT,
    column9 INT,
    column10 INT,
    column11 INT,
    column12 INT,
    column13 INT,
    column14 INT,
    column15 INT,
    column16 INT,
    column17 INT,
    column18 INT,
    column19 INT,
    column20 INT,
    column21 INT,
    column22 INT,
    column23 INT,
    column24 INT,
    column25 INT,
    column26 INT,
    column27 INT,
    column28 INT,
    column29 INT,
    column30 INT,
    column31 INT,
    column32 INT,
    column33 INT,
    column34 INT,
    column35 INT,
    column36 INT,
    column37 INT,
    column38 INT,
    column39 INT,
    column40 INT,
    column41 INT,
    column42 INT,
    column43 INT,
    column44 INT,
    column45 INT,
    column46 INT,
    column47 INT,
    column48 INT,
    column49 INT,
    column50 INT,
    column51 INT,
    column52 INT,
    column53 INT,
    column54 INT,
    column55 INT,
    column56 INT,
    column57 INT,
    column58 INT,
    column59 INT,
    column60 INT,
    column61 INT,
    column62 INT,
    column63 INT,
    column64 INT,
    column65 INT,
    column66 INT,
    column67 INT,
    column68 INT,
    column69 INT,
    column70 INT,
    column71 INT,
    column72 INT,
    column73 INT,
    column74 INT,
    column75 INT,
    column76 INT,
    column77 INT,
    column78 INT,
    column79 INT,
    column80 INT
)
duplicate key(column1)
partition by (column1)
distributed by hash(column2) buckets 5 properties('replication_num'='1');

CREATE TABLE `t3` (
  `c0` int(11) NULL COMMENT "",
  `c1` varchar(20) NULL COMMENT "",
  `c2` varchar(200) NULL COMMENT "",
  `c3` int(11) NULL COMMENT ""
) ENGINE=OLAP
DUPLICATE KEY(`c0`, `c1`)
COMMENT "OLAP"
DISTRIBUTED BY HASH(`c0`, `c1`) BUCKETS 5
PROPERTIES (
"colocate_with" = "group1",
"replication_num" = "1",
"storage_format" = "DEFAULT",
"enable_persistent_index" = "true",
"replicated_storage" = "true",
"compression" = "LZ4"
);

select t1.c0, t1.c0, t3.c0, t1.c1, t2.c1, t3.c1 from t1 left join t2 on t1.c0<=>t2.c0 and t1.c1=t2.c1 left join t3 on t2.c0<=>t3.c0 and t2.c1=t3.c1 order by 1,2,3,4,5,6;

select t1.c0, t1.c0, t3.c0, t1.c1, t2.c1, t3.c1 from t1 left join t2 on t1.c0 <=>t2.c0 and t1.c1<=>t2.c1 right join t3 on t1.c0 = t3.c0 and t2.c1 = t3.c1 left join t4 on t2.c0 <=> t4.c0 and t2.c3 = t4.c1 order by 1,2,3,4,5,6;

select t1.c0, t2.c0, t1.c1, t2.c1, t3.c1 from t1 left join t2 on t1.c0<=>t2.c0 and t1.c1<=>t2.c1 and t1.c2=t2.c2 left join t3 on t2.c0=t3.c0 and t2.c1=t3.c1 and t2.c2=t3.c2 order by 1,2,3,4,5;

select t3.c0, t3.c1, t.c0, t.c1, t.cnt from t3 left join (select count(*) as cnt, t2.c0, t2.c1 from t1 left join t2 on t1.c0 =t2.c0 and t1.c1=t2.c1 group by t2.c0, t2.c1) t on t3.c0<=>t.c0 and t3.c1= t.c1 order by 1,2,3,4,5;

select t3.c0, t3.c1, t.c0, t.c1, t.cnt from t3 left join (select count(*) as cnt, t2.c0, t2.c1, max(t2.c2) c2 from t1 left join t2 on t1.c0 =t2.c0 and t1.c1=t2.c1 group by t2.c0, t2.c1) t on t3.c0=t.c0 and t3.c1= t.c1 and t3.c2=t.c2 order by 1,2,3,4,5;

select t4.c0, t4.c1, t.c01, t.c13 from t4 left join (select t1.c0 as c01, t2.c0 as c02, t1.c1 as c11, t2.c1 as c12, t3.c1 as c13 from t1 left join t2 on t1.c0<=>t2.c0 and t1.c1<=>t2.c1 and t1.c2=t2.c2 left join t3 on t2.c0=t3.c0 and t2.c1=t3.c1 and t2.c2=t3.c2 group by t1.c0, t2.c0, t1.c1, t2.c1, t3.c1) t on t4.c0 = t.c02 and t4.c1 = t.c13 order by 1,2,3,4;

select t3.c0, t3.c1, t.c0, t.c1, t.cnt, t.c3 from t3 left join (select count(*) as cnt, count(distinct t1.c3) c3,t2.c0, t2.c1 from t1 right join t2 on t1.c0 =t2.c0 and t1.c1=t2.c1 group by t2.c1, t2.c0) t on t3.c0=t.c0 and t3.c1= t.c1 order by 1,2,3,4,5,6;

-- Verify both tables are in the same colocate group
SHOW CREATE TABLE t2;

insert into t_auto values (1, '2026-01-02', 30), (3, '2026-01-02', 40);

insert into t2 values (1, 100), (2, 200);

drop table t_ref;

select k1, count(*) from t group by k1 order by k1;

drop table t_plain;

insert into tenants values (1, 100, 1), (2, 200, 2), (3, 300, 3);

select sum(v) from t;

-- total
select count(*) from t;

insert into t_seed select x, x from table(generate_series(1, 40000)) as g(x);

insert into pk_seed select x, x from table(generate_series(1, 40000)) as g(x);

drop table pk_seed;

-- A three-way split by row count cuts where one load ends and the next begins. Those cuts are changes of
-- k1, so each becomes a ColocateRange boundary and the group gets three ColocateRanges.

select count(*), sum(v1) from r1 [_SYNC_MV_];

-- Accepted: a synchronous materialized view whose sort key starts with the colocate column k1.
create materialized view mv1 as select k1, sum(v1) from t1 group by k1;

-- Rejected: the rollup sort key leaves k1 out.
alter table t1 add rollup r3 (k2, v1) order by (k2);

insert into tp1 select 20 + x % 10, x, x from table(generate_series(2001, 3000)) as g(x);

insert into tp2 values (3, 100001, 10), (15, 100002, 20), (25, 100003, 30), (15, 100004, 40);

-- two rows per k1 across 50 distinct k1 values.
insert into t (k1, k2, v)
select x % 50, x, x from table(generate_series(1, 100)) as g(x);

create table t_ref (k1 int, k2 int, v int) duplicate key(k1, k2) distributed by hash(k2) buckets 3
    properties('replication_num' = '1');

insert into t values (null, 1, 1);

drop table b;

DROP TABLE if exists lineitem1;

insert into lineitem2 
select 
   days_add('1993-01-01', cast(rand()*30 as int)) L_SHIPDATE,
   cast(rand()*10 as bigint) L_ORDERKEY,
   cast(rand()*10 as bigint) L_PARTKEY,
   cast(100.00 + cast(rand()*10 as int) as decimal(7, 2)) L_QUANTITY
from table(generate_series(1, 100000));

create table result (v bigint) properties("replication_num"="1");

insert into result with cte as(
select L_ORDERKEY, L_PARTKEY
from lineitem0 
where L_SHIPDATE between '1993-01-01' AND '1993-12-31'
UNION
select L_ORDERKEY, L_PARTKEY
from lineitem1
where L_SHIPDATE between '1993-01-01' AND '1993-12-31' 
),
cte1 as(
select cte.* 
from cte 
     inner join [bucket] orders on L_ORDERKEY = O_ORDERKEY
     inner join [broadcast] part on L_PARTKEY = P_PARTKEY
where O_ORDERKEY = 4 and O_ORDERDATE = '1993-01-24'
  and P_PARTKEY =2 and P_NAME = "part#0"
)
select /*+SET_VAR(disable_colocate_set=true)*/ sum(murmur_hash3_32(L_ORDERKEY,L_PARTKEY)) as v from cte1;

drop table t_rename_column_unused_output_column_name force;

INSERT INTO `site_access` (`event_day`, `site_id`, `city_code`, `user_name`, `pv`)
VALUES ('2023-10-18', 10, 'SH', 'username_example', 100);

select * from bf_table;

ALTER TABLE t1 RENAME COLUMN v1 TO v2;

insert into site_access(dt,site_id,city_code,user_name,pv) values('2021-01-01',1,1,'1',1);

desc t_recharge_detail;

CREATE TABLE `bill_detail` (
  `bill_code` varchar(200) NOT NULL DEFAULT "" COMMENT "运单号"
) ENGINE=OLAP
PRIMARY KEY(`bill_code`)
PARTITION BY RANGE(cast(substr(bill_code, 3, 11) as bigint))
(PARTITION p1 VALUES [('0'), ('5000000')),
PARTITION p2 VALUES [('5000000'), ('10000000')),
PARTITION p3 VALUES [('10000000'), ('15000000')),
PARTITION p4 VALUES [('15000000'), ('20000000'))
)
DISTRIBUTED BY HASH(`bill_code`) BUCKETS 3
PROPERTIES (
"replication_num" = "1",
"storage_format" = "DEFAULT"
);

-- name: test_wrong_access_path_after_column_rename_cloud @cloud
CREATE TABLE `t_wrong_access_path_after_column_rename` (
  `k` STRING NOT NULL COMMENT "",
  `v` int,
  `JOB_NAME` array<Varchar(2)>,
  `JOB_NAME_NEW` array<Varchar(2)>
) ENGINE=OLAP 
PRIMARY KEY(`k`)
DISTRIBUTED BY HASH(`k`) BUCKETS 1
PROPERTIES (
"compression" = "LZ4",
"fast_schema_evolution" = "true",
"replicated_storage" = "true",
"replication_num" = "1"
);

with cte as(
select lo_partkey,
json_object("value",group_concat(concat_ws(":",lo_partkey,c_custkey,c_name,c_city,c_nation,c_region,c_phone,c_mktsegment))) custkeys
from lineorder inner join customer on lo_custkey = c_custkey
where lo_orderdate between 19920101 and 19921231
group by lo_partkey
)
select /*+SET_VAR(column_view_concat_rows_limit=10000000000000,column_view_concat_bytes_limit=1000000000000000)*/ count(1), 0!=sum(murmur_hash3_32(p_name, custkeys->'$.value'))
from part inner join[broadcast] cte on cte.lo_partkey = part.p_partkey;

--更新
update t1 set v1 = '5' where k1 = 3 and k2 = 3;

create database test_column_with_row_partial_update;

insert into tab1 values (300, "k3_300", 300, 300, 300, "v4_300", "v5_300");

drop database test_column_with_row_partial_update force;

-- test protocol
set global thrift_plan_protocol = "compact";

-- name: test_primary_key_native @sequential @native
create table t(k int, v int) primary key(k) properties('base_compaction_forbidden_time_ranges'='* * * * *');

-- a collection index inside the lambda reads its own path
select id, array_map(x -> x.items[array_length(x.other)].a, [s]) from t order by id;

-- same shape, wider projection - this is the statement the fuzzer found
select map_size(s1.s3), s1.s2[1].a, s1.s3[1], s1.s4.f from scs3
where str in ('aa', (s1.s2[1].a), 'ii', 'cc') order by v1 limit 2;

-- struct cast from VARIANT, several fields, inside an aggregate
select count(s.k1), count(s.k2), count(s.k3), max(s.k1), sum(s.k2) from (select cast(cast(parse_json(j) as variant) as struct<k1 varchar(10), k2 int, k3 array<int>>) s from t1) x;

create database test_unnest_prune_needs_access_path;

select e.engine_name, count(*) from (select cites, engine_id from citations_tbl order by id limit 100) s
left join unnest(s.cites) as t(x) on true
join engines_tbl e on s.engine_id = e.engine_id
group by e.engine_name order by e.engine_name;

insert into tab1 properties("merge_condition" = "v1") values (300, "k3_300", 200, 400, 400, "v4_400", "v5_400");

select group_concat(k2) from (select t1.k2 from tab1 t1 join tab1 t2 join tab1 t3 join tab1 t4 join tab1 t5 join tab1 t6 join tab1 t7) t;

update information_schema.be_configs set value = "16" where name = "starlet_cache_thread_num";

INSERT INTO user_events (user_id, event_ts, event_name, session_id, event_type, event_level, properties) VALUES
('user_001', unix_timestamp('2024-01-14 10:00:00') * 1000, 'product_view', 'session_001', 'view_event', 'view', 
 '{"category_id": "cat_101", "product_id": "prod_201"}'),
('user_001', unix_timestamp('2024-01-14 10:00:01') * 1000, 'product_click', 'session_001', 'click_event', 'click',
 '{"category_id": "cat_101", "product_id": "prod_202"}'),
('user_002', unix_timestamp('2024-01-13 10:00:00') * 1000, 'category_view', 'session_002', 'view_event', 'view',
 '{"category_id": "cat_102"}'),
('user_002', unix_timestamp('2024-01-13 10:00:02') * 1000, 'product_click', 'session_002', 'click_event', 'click',
 '{"category_id": "cat_102", "product_id": "prod_203"}'),
('user_003', unix_timestamp('2024-01-12 10:00:00') * 1000, 'product_view', 'session_003', 'view_event', 'view',
 '{"product_id": "prod_301", "resource_id": "res_401", "resource_type": "1"}'),
('user_003', unix_timestamp('2024-01-12 10:00:03') * 1000, 'product_click', 'session_004', 'click_event', 'click',
 '{"product_id": "prod_302", "resource_id": "res_402", "resource_type": "category"}'),
('user_004', unix_timestamp('2024-01-10 10:00:00') * 1000, 'item_view', 'session_005', 'view_event', 'view',
 '{"product_id": "prod_303"}');

USE test_reject_variant_olap_column_db;

SELECT count(*) FROM vok;

with c(k, mn, mn2, mx, mx2) as (select k % 100, min(s), min(s), max(s), max(s) from t group by k % 100)
select count(*), sum(if(mn = mn2, 1, 0)), sum(if(mx = mx2, 1, 0)), min(mn2), max(mx2)
from (select k, mn, mn2, mx, mx2 from c where k < 30 union all select k, mn, mn2, mx, mx2 from c where k >= 60) u;

-- A CTE consumed on both sides of an outer join whose ON clause reads a late-materialized
-- column of the left side. The fetch of that column used to be pushed into whichever child
-- merely depended on the same scan -- the right side, which consumes the same CTE -- and was
-- then dropped from the join itself, leaving the join's own predicate reading a column no
-- input produced: "Invalid plan: ... required cols {n} cannot obtain from input cols".
--
-- `a.v1 = a.k1` compares a varchar against a bigint and both sides come from the left input,
-- which is what forces a NestLoopJoin and keeps the predicate on the late-materialized column.
-- It matches nothing here, so every left row survives exactly once and the LIMIT never has to
-- break a tie.
with c1 as (select k1, v1, v2 from lm_t order by k1 limit 5),
     c2 as (select count(*) as n from lm_t),
     c3 as (select y.k1 as k, count(*) as cnt, max(x.v9) as m from lm_t x
            join c1 y on y.k1 = x.k1 group by y.k1)
select c2.n, a.k1, a.v1, a.v2, coalesce(z.cnt, 13) as cnt, z.m
from c1 a cross join c2 left outer join c3 z on a.v1 = a.k1
order by a.k1 limit 14;

-- Test 8: Recursive CTE with UNION + UNION ALL    
WITH RECURSIVE numbers AS (    
    SELECT cast(1 as bigint) AS n, cast(1 as bigint) AS category                          
    UNION ALL                                                                             
    SELECT n + 1, 1 FROM numbers WHERE n < 5                                                                             
    UNION    
    SELECT n, 2 FROM numbers
)    
SELECT /*+ SET_VAR(enable_recursive_cte=true)*/ DISTINCT n, category    
FROM numbers    
ORDER BY n, category;

-- Test 13: Error case - the anchor infers DECIMAL(1,1) for bal, so the first iteration produces
-- 1.5 and its insert fails in strict mode. The failure must be reported instead of ending the
-- recursion as if it had converged.
WITH RECURSIVE r AS (
    SELECT 1 AS n, 0.5 AS bal
    UNION ALL
    SELECT n + 1, bal + 1 FROM r WHERE n < 5
)
SELECT /*+ SET_VAR(enable_recursive_cte=true, recursive_cte_max_depth=20, enable_insert_strict=true, insert_max_filter_ratio=0)*/ * FROM r ORDER BY n;

set catalog default_catalog;

CREATE TABLE t1 (
    id INT,
    dt DATETIME,
    from_tz VARCHAR(64),
    to_tz VARCHAR(64)
) DUPLICATE KEY(id)
DISTRIBUTED BY HASH(id) BUCKETS 1
PROPERTIES ("replication_num" = "1");

-- name: test_date_diff
set sql_dialect='StarRocks';

select date_diff('year', '2016-02-28', '2015-02-28');

select date_diff('month', '2016-05-29', '2016-02-29');

select date_diff('month', '2016-06-30', '2016-04-30 00:00:00.01');

select date_diff('day', '2016-02-29 00:00:00.02', '2016-02-28 00:00:00.01');

select date_diff(NULL, '2016-03-01', '2016-02-27');

select date_diff('year', timestamp '2017-02-28', timestamp '2016-02-29 00:00:00.01');

select date_diff('month', timestamp '2016-05-29', timestamp '2016-02-29 00:00:00.001');

select date_diff('day', timestamp '2016-02-29 00:00:00.02', timestamp '2016-02-28 00:00:00.02');

select jodatime_format('2023-04-15 23:45:12', "yyyy-MM-dd'T'HH:mm:ssZZ");

select jodatime_format('2023-01-01 00:00:00.010000', "yyyy-MM-dd HH:mm:ss.SSSSSS");

select jodatime_format('2023-06-25 00:00:00', "yyyyMMdd--'01234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345");

select jodatime_format('2023-06-25 00:00:00', "yyyyMMdd--012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456");

select jodatime_format('2023-06-25 00:00:00', "'0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567'--yyyyMMdd");

insert into test_pk_tbl1 values ('2023-09-07', '2023-09-07 13:35:00', 'a', 'a', true, 1, 1, 1, 10),  ('2023-09-06', '2023-09-07 13:35:00', 'a', 'a', true, 1, 1, 1, 10);

CREATE TABLE t1 (id1 int, id2 int, id3 double) DUPLICATE KEY(id1) COMMENT "c1" DISTRIBUTED BY HASH(id1) BUCKETS 1 properties('replication_num' = '1');

-- name: test_alter_pk_reorder
show backends;

select * from tab1 where k1 = 100;

CREATE TABLE s3 
(
    k1 int not null, k2 int, k3 int
)
DUPLICATE KEY(k1, k2)
DISTRIBUTED BY RANDOM 
PROPERTIES("replication_num" = "1", 'foreign_key_constraints'='s3(k1) REFERENCES s1(k1)');

select s2.k1, s2.k2 from s1 join s2 on s1.k1 = s2.k1 order by 1, 2;

CREATE TABLE s1_new
(
    k1 int not null, k2 int, k3 int
)
DUPLICATE KEY(k1, k2)
DISTRIBUTED BY RANDOM 
PROPERTIES("replication_num" = "1", 'unique_constraints'='s1_new.k1');

INSERT INTO primary_table_with_null_partition values ('2020-06-01', '2020-06-01 00:00:00', 'a', 'a', true, 1, 1, 1, 1, 1, 1.0, 1.0, 1.0), ('2020-07-01', '2020-07-01 00:00:00', 'a', 'a', true, 1, 1, 1, 1, 1, 1.0, 1.0, 1.0), ('2020-08-01', '2020-08-01 00:00:00', 'a', 'a', true, 1, 1, 1, 1, 1, 1.0, 1.0, 1.0);

-- count() over an ARRAY is routed through the decimalv3 rewriting because the item type is
-- decimal, even though there is nothing to widen. The rewritten function used to keep an
-- INVALID return type, which only surfaced while building the fragment as the unrelated-looking
-- "Getting analyzing error. Detail message: slot type shouldn't be invalid.".
select count(a32), count(a64), count(a128) from t_arr_dec;

-- the NULL row's slot holds a value computed by an upstream `a + b`
select k, cast(b + if(k = 1, 10000000000, 0) as decimal(18,9)) from t order by k;

select k, cast(row(s) as struct<a decimal(10,2)>) from t where k < 3 order by k;

select k, d1 / (d2 - d2), d1 % (d2 - d2), d1 div (d2 - d2) from t order by k;

-- Case 2: precision=50 medium precision test
CREATE TABLE decimal_test_p50_s10 (d1 decimal(50, 10)) PROPERTIES("replication_num"="1");

-- ============================================
-- Part 2: Boundary value tests
-- ============================================

-- Case 4: precision=39 boundary test (just within limit)
CREATE TABLE decimal_test_p39_s0 (d1 decimal(39, 0)) PROPERTIES("replication_num"="1");

-- ============================================
-- Part 3: FE Cast Null scenario tests
-- ============================================

-- Case 6: FE cast null test - decimal(76, 40), integer part limit = 77-40 = 37 digits
CREATE TABLE decimal_test_p76_s40_fe_null (d1 decimal(76, 40)) PROPERTIES("replication_num"="1");

INSERT INTO decimal_test_p76_s50_fe_null SELECT -1234567890123456789012345678.12345678901234567890123456789012345678901234567890;

-- 5+35=40, exactly fits
INSERT INTO decimal_test_p40_s35 SELECT 1234567.12345678901234567890123456789012345;

INSERT INTO decimal_test_p55_s50 SELECT 123456.12345678901234567890123456789012345678901234567890;

INSERT INTO decimal_test_p76_s76 SELECT 0.1234567890123456789012345678901234567890123456789012345678901234567890123456;

INSERT INTO decimal_test_p60_s30 SELECT 0;

-- Case 16: Zero integer part with large decimal part
CREATE TABLE decimal_test_p70_s69 (d1 decimal(70, 69)) PROPERTIES("replication_num"="1");

-- Case 18: precision=43 test
CREATE TABLE decimal_test_p43_s12 (d1 decimal(43, 12)) PROPERTIES("replication_num"="1");

-- Case 20: precision=52 test
CREATE TABLE decimal_test_p52_s25 (d1 decimal(52, 25)) PROPERTIES("replication_num"="1");

-- Case 22: precision=62 test
CREATE TABLE decimal_test_p62_s35 (d1 decimal(62, 35)) PROPERTIES("replication_num"="1");

-- Case 24: precision=72 test
CREATE TABLE decimal_test_p72_s45 (d1 decimal(72, 45)) PROPERTIES("replication_num"="1");

-- Case 26: precision=48, scale=0
CREATE TABLE decimal_test_p48_s0 (d1 decimal(48, 0)) PROPERTIES("replication_num"="1");

SELECT * FROM decimal_test_p54_s0 ORDER BY d1;

SELECT * FROM decimal_test_p66_s0 ORDER BY d1;

SELECT * FROM decimal_test_p45_s40 ORDER BY d1;

SELECT * FROM decimal_test_p57_s50 ORDER BY d1;

SELECT * FROM decimal_test_p69_s60 ORDER BY d1;

-- Integer part has 23 digits > 22, should be cast to null by FE
INSERT INTO decimal_test_p65_s55_fe_null SELECT 12345678901234567890123.1234567890123456789012345678901234567890123456789012345;

-- Integer part has 17 digits = 17, should work
INSERT INTO decimal_test_p60_s60_fe_null SELECT 12345678901234567.123456789012345678901234567890123456789012345678901234567890;

INSERT INTO decimal_test_p41_s38 SELECT 1234.12345678901234567890123456789012345678;

-- 6+42=48 > 46, should BE exception
SELECT * FROM decimal_test_p46_s42 ORDER BY d1;

-- 4+58=62 > 61, should BE exception
INSERT INTO decimal_test_p61_s58 SELECT 123.1234567890123456789012345678901234567890123456789012345678;

-- ============================================
-- Part 12: Special Number Pattern Tests
-- ============================================

-- Case 44: All 1s digit test
CREATE TABLE decimal_test_p40_s20 (d1 decimal(40, 20)) PROPERTIES("replication_num"="1");

-- Case 46: Alternating digit pattern test
CREATE TABLE decimal_test_p50_s25 (d1 decimal(50, 25)) PROPERTIES("replication_num"="1");

-- ============================================
-- Part 13: Precise Boundary Tests Near Limits
-- ============================================

-- Case 48: precision=39 boundary precise test
CREATE TABLE decimal_test_p39_s19 (d1 decimal(39, 19)) PROPERTIES("replication_num"="1");

-- Case 50: Mid-range precision boundary test
CREATE TABLE decimal_test_p58_s29 (d1 decimal(58, 29)) PROPERTIES("replication_num"="1");

SELECT * FROM decimal_test_simple_p39_s0 ORDER BY d1;

SELECT * FROM decimal_test_simple_p39_s10 ORDER BY d1;

INSERT INTO decimal_test_simple_p50_s25 SELECT -1;

INSERT INTO decimal_test_simple_p65_s0 SELECT -1;

INSERT INTO decimal_test_simple_p65_s32 SELECT -1.00000000000000000000000000000000;

-- Case 58: Simple values with maximum precision=76 and scale=38
CREATE TABLE decimal_test_simple_p76_s38 (d1 decimal(76, 38)) PROPERTIES("replication_num"="1");

-- Case 59: Simple values with maximum precision=76 and high scale=60
CREATE TABLE decimal_test_simple_p76_s60 (d1 decimal(76, 60)) PROPERTIES("replication_num"="1");

-- Case 60: Simple values with maximum precision=76 and maximum scale=76
CREATE TABLE decimal_test_simple_p76_s76 (d1 decimal(76, 76)) PROPERTIES("replication_num"="1");

-- ============================================
-- Part 15: Edge cases with simple values and high precision scales
-- ============================================

-- Case 61: Simple values with precision=40 and scale=39 (almost all decimal)
CREATE TABLE decimal_test_simple_p40_s39 (d1 decimal(40, 39)) PROPERTIES("replication_num"="1");

-- Case 62: Simple values with precision=45 and scale=44 (almost all decimal)
CREATE TABLE decimal_test_simple_p45_s44 (d1 decimal(45, 44)) PROPERTIES("replication_num"="1");

-- Case 63: Simple values with precision=55 and scale=1 (mostly integer)
CREATE TABLE decimal_test_simple_p55_s1 (d1 decimal(55, 1)) PROPERTIES("replication_num"="1");

INSERT INTO decimal_test_simple_p55_s1 SELECT -1.1;

INSERT INTO decimal_test_simple_p70_s35 SELECT -1.00000000000000000000000000000000000;

INSERT INTO decimal_test_simple_mixed_p60_s20 SELECT -1.0;

SELECT * FROM decimal_test_simple_mixed_p60_s20 ORDER BY d1;

SELECT * FROM decimal_test_p76_s76_fe_null ORDER BY d1;

INSERT INTO decimal_test_p40_s35_fe_null SELECT -1234567890123456789012345678901234567890123.12345678901234567890123456789012345;

-- Case 70: Edge case - decimal(76, 5), integer part limit = 77-5 = 72 digits
CREATE TABLE decimal_test_p76_s5_fe_null (d1 decimal(76, 5)) PROPERTIES("replication_num"="1");

INSERT INTO decimal_test_p60_s58_default_scale SELECT -55;

-- Insert 1234 -> becomes 1234.000....(48 zeros) = 4+48=52 digits > 50, should cause BE exception
INSERT INTO decimal_test_p50_s48_default_scale SELECT 1234;

SELECT * FROM decimal_test_p45_s43_default_scale ORDER BY d1;

-- Case 75: decimal(35, 33) - inserting integer will auto-pad 33 zeros
CREATE TABLE decimal_test_p35_s33_default_scale (d1 decimal(35, 33)) PROPERTIES("replication_num"="1");

-- Insert 12 -> becomes 12.000....(75 zeros) = 2+75=77 digits > 76, should cause BE exception
INSERT INTO decimal_test_p76_s75_default_scale SELECT 12;

INSERT INTO decimal_test_p70_s68_default_scale SELECT -333;

-- Insert 77 -> becomes 77.000....(53 zeros) = 2+53=55 digits = 55, should work
INSERT INTO decimal_test_p55_s53_default_scale SELECT 77;

-- Insert 2 -> becomes 2.000....(64 zeros) = 1+64=65 digits = 65, should work
INSERT INTO decimal_test_p65_s64_single_digit SELECT 2;

-- Insert 12 -> becomes 12.000....(40 zeros) = 2+40=42 digits = 42, should work
INSERT INTO decimal_test_p42_s40_boundary_default SELECT 12;

INSERT INTO decimal_test_p50_s10_rounding SELECT -123.12345678906789;

INSERT INTO decimal_test_p50_s10_overflow SELECT -12345678901234567890123456789012345678901.12345;

-- ============================================
-- Part 19: PRIMARY KEY Table Tests with Decimal256
-- ============================================

-- Case 85: PRIMARY KEY table with decimal(39, 0) as value column
CREATE TABLE decimal_pk_test_p39_s0 (
    user_id varchar(42) NOT NULL,
    asset_id varchar(42) NOT NULL,
    timestamp datetime NOT NULL,
    shop_id int NOT NULL,
    day_bucket DATE NOT NULL,
    value DECIMAL(39, 0) NOT NULL
) ENGINE=OLAP 
PRIMARY KEY(user_id, asset_id, timestamp, shop_id, day_bucket)
PARTITION BY (day_bucket) 
DISTRIBUTED BY HASH(user_id)
PROPERTIES ("replication_num" = "1");

-- Insert various decimal256 values
INSERT INTO decimal_pk_test_p50_s10 VALUES 
(1, 'key001', 100, 1234567890123456789012345678901234567890.1234567890, 12345678901234567890123456789012345678901234567890.123456789012345, 1000);

-- Test point query with primary key
SELECT decimal_value FROM decimal_pk_test_p50_s10 WHERE id1 = 2 AND id2 = 'key002' AND id3 = 200;

-- name: test_deltalake_column_mapping

-- test partition prune with boolean type

-- test partition prune with tinyint type

-- test partition prune with smallint type

-- test partition prune with int type

-- test partition prune with bigint type

-- test partition prune with date type

-- test partition prune with timestamp type

-- test partition prune with string type

select * from delta_lake_par_col_date where col_date >= '2024-04-24' and col_date < '2024-04-26' order by col_smallint;

select * from delta_lake_par_col_string where col_string != 'value1' order by col_smallint;

select * from t_timestamp_ntz where col_timestamp_ntz is not null order by col_int;

select * from t_partition_timestamp_ntz where col_timestamp_ntz is null order by col_int;

select col_struct from delta_lake_data_type where col_struct.sex='male' order by col_tinyint;

DROP TABLE t_dict_mapping_streamload;

-- dict_mapping() fails on the NULL key. When that failure was the input of another
-- expression it used to be unwrapped by the unchecked Expr::evaluate(), which throws
-- BadStatusOrAccess instead of returning the Status and took the whole BE down.
SELECT dict_mapping("dict", col_1, dict_mapping("dict", col_1, col_2)) FROM t;

-- test_dictmapping_nested_null_key keys both calls off col_1, so nothing under the outer
-- dict_mapping is ever rewritten and its shuttle hands the operator back untouched. Keying the
-- inner call off a different column does rewrite a child, and BaseScalarOperatorShuttle then looks
-- up a clone function that was never registered for DictQueryOperator: planning died on a
-- NullPointerException and the client got a bare "Unknown error" with nothing to act on. The
-- statement is still expected to fail -- the inner lookup does not produce a valid composite key --
-- but it has to fail in the engine, with a message that says what went wrong.
SELECT dict_mapping("dict", col_1, dict_mapping("dict", col_2, col_2)) FROM t;

SELECT k, dictionary_get("test_dictionary_null_if_not_exist", k, false) FROM t_dictionary_null_if_not_exist ORDER BY k;

SELECT k, dictionary_get("test_dictionary_null_if_not_exist", k, k) FROM t_dictionary_null_if_not_exist ORDER BY k;

REFRESH DICTIONARY test_dictionary_null_if_not_exist;

-- name: test_distinct_aggregation_over_window_without_sliding_frame
create table t0 (
v1 int,
v2 int,
v3 int
) properties("replication_num"="1");

-- name: test_escape 

-- test column case-insensitive
UPDATE primary_key_with_null SET `K4`  = 'update_k4', `K5`  = 2, `K6`  = 1, `k7`  = 7, `k8`  = 0 WHERE `k3` ="k3" and `k1`='2020-10-22' and `k2`='2020-10-22 00:00:00';

drop table if exists pk_tbl1;

INSERT INTO standalone_meta VALUES (1);

-- predicate that matches no partition values but rows exist: partition should not be wrongly pruned
SELECT v FROM t_range_date WHERE dt BETWEEN '2024-01-03' AND '2024-01-07' ORDER BY v;

-- equality
SELECT v FROM t_range_int WHERE k = 150;

-- IS NOT NULL should return the non-null rows
SELECT v FROM t_range_null_date WHERE dt IS NOT NULL ORDER BY v;

INSERT INTO t_range_null_tinyint VALUES
    (NULL, 1), (NULL, 2),
    (-10, 3), (-1, 4),
    (0, 5), (25, 6),
    (50, 7), (100, 8);

CREATE TABLE t_range_null_smallint (
    k SMALLINT,
    v INT
) ENGINE=OLAP
DUPLICATE KEY(k)
PARTITION BY RANGE(k) (
     PARTITION p1 VALUES LESS THAN ('-3200'),
     PARTITION p2 VALUES LESS THAN ('0'),
     PARTITION p3 VALUES LESS THAN ('32000')
)
DISTRIBUTED BY HASH(k) BUCKETS 1
PROPERTIES ("replication_num" = "1");

INSERT INTO t_list_int VALUES
    (1, 'a'), (2, 'b'), (3, 'c'),
    (4, 'd'), (5, 'e'), (6, 'f'),
    (7, 'g'), (8, 'h'), (9, 'i');

INSERT INTO t_list_null VALUES
    (NULL, 1), (NULL, 2),
    (1, 3), (2, 4),
    (4, 5), (5, 6);

CREATE TABLE t_list_null_mixed (
    k INT,
    v INT
) ENGINE=OLAP
DUPLICATE KEY(k)
PARTITION BY LIST(k) (
    PARTITION p0 VALUES IN (NULL, '0', '1'),
    PARTITION p1 VALUES IN ('2', '3'),
    PARTITION p2 VALUES IN ('4', '5')
)
DISTRIBUTED BY HASH(k) BUCKETS 1
PROPERTIES ("replication_num" = "1");

CREATE TABLE t_list_multi_null (
    c1 INT,
    c2 INT,
    v INT
) ENGINE=OLAP
DUPLICATE KEY(c1)
PARTITION BY LIST(c1, c2) (
    PARTITION p0 VALUES IN ((NULL, NULL)),
    PARTITION p1 VALUES IN (('1', '10'), ('2', '20')),
    PARTITION p2 VALUES IN (('3', '30'), ('4', '40'))
)
DISTRIBUTED BY HASH(c1) BUCKETS 1
PROPERTIES ("replication_num" = "1");

CREATE TABLE t_limit_test (
    k INT NOT NULL,
    v INT
) ENGINE=OLAP
DUPLICATE KEY(k)
PARTITION BY RANGE(k) (
    PARTITION p1 VALUES [('0'), ('100')),
    PARTITION p2 VALUES [('100'), ('200')),
    PARTITION p3 VALUES [('200'), ('300'))
)
DISTRIBUTED BY HASH(k) BUCKETS 1
PROPERTIES ("replication_num" = "1");

drop table t_limit_test force;

drop table t_range_cast force;

SELECT count(*) FROM t_range_multi;

drop table t_range_multi_fixed force;

select * from (select l.c0,r.c1  from t0 l join [bucket](select regexp_replace(sum(c1), '1', '2') c1, c0 from t0 group by c0) r on l.c0 = r.c0) t;

update default_catalog.information_schema.be_configs set `value` = "10000" where name= "pipeline_scan_timeout_guard_ms";

-- name: test_exchange_hash_function_version
-- Test exchange_hash_function_version session variable

-- Create test table
CREATE TABLE `t_hash_test` (
  `c0` int DEFAULT NULL,
  `c1` bigint DEFAULT NULL,
  `c2` string DEFAULT NULL
) ENGINE=OLAP
DUPLICATE KEY(`c0`)
COMMENT "OLAP"
DISTRIBUTED BY HASH(`c0`) BUCKETS 4
PROPERTIES (
"replication_num" = "1"
);

set exchange_hash_function_version = 1;

-- make changes, shrink to its original size
UPDATE information_schema.be_configs SET VALUE = '2' WHERE NAME = 'exec_state_report_max_threads';

grant impersonate on user root to u1;

create role g2_role;

select current_role();

select @@character_set_results AS character_set_results;

CREATE TABLE pksk_tbl (
    c1 int,
    c2 date,
    c3 varchar(10),
    c4 bigint,
    c5 varchar(3),
    c6 datetime,
    c7 string,
    c8 decimal(10,5),
    c9 boolean,
    c10 largeint,
    c11 date,
    c12 float,
    c13 double)
PRIMARY KEY(c1,c2)
DISTRIBUTED BY HASH(c1) BUCKETS 3
ORDER BY(c1,c6,c11,c2);

WITH temp AS (
		SELECT 'test' AS c1, 'test' AS c2, 'test' AS c3
		UNION ALL
		SELECT 'test' AS c1, 'test' AS c2, 'test' AS c3
	)
SELECT c1, c2, c3
FROM (
	SELECT c1, c2, c3
	FROM temp
	UNION ALL
	SELECT 'test1' AS c1, 'test1' AS c2, 'test1' AS c3
	UNION ALL
	SELECT 'test1' AS c1, 'test2' AS c2, 'test3' AS c3
) t;

insert into t_dup select g, g from table(generate_series(1, 10)) t(g);

rollback;

create table t1(id int) primary key(id);

-- Rollback the transaction (ABORTED status)
rollback;

select * from test_csv_snappy_format where a = 'Alice';

select * from test_csv_lzo_format where a = 'Bob';

select count(*) from test_hive_avro_format;

select col_tinyint,col_decimal,col_array from test_hive_rctext_format;

select count(*) from multi_stripes;

set enable_count_star_optimization = false;

select count(*) from empty_row_index;

set connector_max_split_size = 64;

-- external file table always use orc column names
select * from test_orc_column where c0 = '199994';

select count(*),c_enabled from parquet_bool_decoder group by c_enabled order by c_enabled;

select count(*) from tpch_customer_null;

-- Every value in the fixture is under 2000, so a corrupted read is the only way to return a row.
select count(*) from flba_decimal_dict where cat = 'c7' and abs(amt) >= 1e10;

create table t1 (c1 string, c2 int, c3 string, c4 int, c5 string, c6 string, c7 string, c8 string, c9 string, c10 string, c11 string, c12 string);

select * from opt_col_levels where c0 = 403350;

select * from read_range_test where c0 >= 1190 and c0 < 1192;

-- read -> skip -> read
select * from read_range_test where (c0 > 1190 and c0 < 1192) or (c0 > 8200 and c0 < 8202);

-- test conjunct rewrite
select count(*) from read_range_test where c2 = '1';

update default_catalog.information_schema.be_configs set value = "0G" where name = "datacache_mem_size";

-- only one dict filter
select count(*) from struct_in_struct where c_struct_struct.c_struct.c0 = '55';

select count(*) from dict_two_page;

select count(*) from data_two_page_nullable where c0 is null;

CREATE TABLE `t1` (
  `department_id` bigint(20) NULL COMMENT 'department id',
  `project_id` int(11) NULL COMMENT 'project id',
  `department_name` varchar(255) NULL COMMENT 'department name'
) ENGINE=OLAP
DUPLICATE KEY(`department_id`)
DISTRIBUTED BY HASH(`project_id`) BUCKETS 1
PROPERTIES (
"replication_num" = "1"
);

insert into allstring values ('"key"',"1", "2");

ALTER TABLE t_dup ADD COLUMN c_str VARCHAR(20) DEFAULT "dv";

select count(*) from t_dup where c_str < 'zz';

select count(*) from t_dup where c_null is not null;

create table profile_prune properties("replication_num"="1") as
    select line from table(unnest(split(get_query_profile(last_query_id()), "\n"))) t(line);

CREATE TABLE t_uniq (
    k1 int,
    v1 int
) UNIQUE KEY(k1)
DISTRIBUTED BY HASH(k1) BUCKETS 1
PROPERTIES ("replication_num" = "1", "fast_schema_evolution" = "true");

ALTER TABLE t_agg ADD COLUMN c_int INT SUM DEFAULT "0";

select count(*) from t_pk where c_int = 7;

ALTER TABLE t_del ADD COLUMN c_int INT DEFAULT "0";

select * from t1 order by k;

delete from t1 where v3>4;

update tab1 set v3 = 999;

drop database test_fast_schema_evolution;

select dict_merge(v2, 255) from reproducex4 [_META_];

insert into tab1 values (600, "k2_600", 600, 600, 600, "v4_600", "v5_600", 111);

CREATE MATERIALIZED VIEW mv1
    AS
        SELECT
            v5,
            v4,
            k1,
            k2
        FROM tab1;

alter table tab1 add column v6 bigint default "1";

insert into t1 values (1, 10, 100), (2, 20, 200), (3, 30, 300);

create database test_schema_change_string_to_num_null;

ALTER TABLE cc2 MODIFY COLUMN v DOUBLE;

CREATE TABLE t_fast_v2 (
    k1 VARCHAR(10) NOT NULL,
    k2 INT NOT NULL,
    v1 INT
)
DUPLICATE KEY(k1, k2)
DISTRIBUTED BY HASH(k1) BUCKETS 1
PROPERTIES (
    "replication_num" = "1",
    "cloud_native_fast_schema_evolution_v2" = "true"
);

insert into t_dist_fast values ("a", 1, 11);

CREATE TABLE t_varchar_slow (
    k1 VARCHAR(10) NOT NULL,
    k2 INT NOT NULL,
    v1 INT
) ENGINE=OLAP
DUPLICATE KEY(k1, k2)
DISTRIBUTED BY HASH(k2) BUCKETS 1
PROPERTIES (
    "replication_num" = "1",
    "fast_schema_evolution" = "false"
);

CREATE TABLE t_multi_success (
    k1 VARCHAR(10) NOT NULL,
    k2 INT NOT NULL,
    v1 INT
) ENGINE=OLAP
DUPLICATE KEY(k1, k2)
DISTRIBUTED BY HASH(k1) BUCKETS 1
PROPERTIES (
    "replication_num" = "1",
    "fast_schema_evolution" = "true"
);

insert into pre_agg_case select generate_series, generate_series, generate_series, generate_series from TABLE(generate_series(1, 50));

-- 1280000

insert into __row_util_base select * from __row_util_base;

insert into c1_skew select generate_series, 'a', generate_series, generate_series from TABLE(generate_series(1, 10000));

set enable_plan_advisor_blacklist=true;

analyze table skew_table;

-- result:
-- !result
insert into repro_la select generate_series, generate_series from TABLE(generate_series(1, 8));

set enable_sql_transaction = false;

-- Verify update within same transaction
begin;

insert into t_rollback select generate_series, concat('also_disappear_', generate_series) from TABLE(generate_series(1001, 1500));

select count(distinct k1) from t_nobundle;

use test_incorrect_slot_id;

-- name: test_avro_primitive_type

-- Case A: basic1.csv has 4 fields per row; schema declares 2 → extras dropped on every row.

desc ctas_target;

-- name: test_files_schema_partition

-- name: test_files_schema_validation

create table t1 (k1 int, k2 varchar(10));

set time_zone = '+08:00';

-- should not push down k1 not null
create table t1 (k1 int not null, v int);

set time_zone = "Asia/Shanghai";

insert into t1 values (1, 'a'), (2, 'b'), (3, 'c');

-- negative width: clean error (was: wrapped to SIZE_MAX -> unbounded growth / hang)
SELECT length(bar(v, 0, 100, -1)) FROM t_bar;

-- empty input hashes the zero-length message
select blake3('');

select id, blake3(v) from t1 order by id;

-- The digest of a constant argument must equal the digest of the same value materialised,
-- which is what reading index 0 rather than the row index restores. The cast matters: a bare
-- literal 7 is not an INT, and the argument's type is part of the digest.
SELECT count(*) FROM t_fp_const WHERE encode_fingerprint_sha256(v, CAST(k AS INT)) = encode_fingerprint_sha256(v, k);

-- a normal single-row call still produces a 32-byte digest
SELECT length(encode_fingerprint_sha256(7, 11));

SELECT encode_fingerprint_sha256_v2(concat('a', char(8)), 'b') = encode_fingerprint_sha256_v2('a', concat(char(8), 'b'));

select FROM_BINARY(ENCODE_FINGERPRINT_SHA256(NULL, NULL, NULL), 'hex');

select FROM_BINARY(ENCODE_SORT_KEY(NULL, NULL, NULL), 'hex');

select FROM_BINARY(ENCODE_FINGERPRINT_SHA256(v1, v2), 'hex') from t1;

select FROM_BINARY(ENCODE_SORT_KEY(v1, v2), 'hex') from t1;

insert into t2 select generate_series, 7, 'STARROCKS' from TABLE(generate_series(1, 5000));

select to_file(named_struct('uri', '', 'offset', 0, 'size', 0));

select to_file(named_struct('uri', uri, 'size', file_size - 13)) from input_files where id = 1;

select fl_get_uri(try_to_file(named_struct('uri', 'a', 'offset', -1))) is null;

select id, f is null, fl_get_uri(f), hex(fl_get_inline(f)), fl_get_offset(f), fl_get_size(f)
from (select id, try_to_file(named_struct('uri', uri, 'inline', payload, 'offset', file_offset, 'size', file_size)) f from input_files) t order by id;

-- name: test_hll_deserialize_sparse_oob @sequential
-- Regression: hll_deserialize() deserializes user-supplied bytes directly. A SPARSE
-- payload (type 0x02) whose register index is >= HLL_REGISTERS_COUNT (16384) wrote
-- past the end of the 16384-byte register array (heap out-of-bounds write). A single
-- row silently corrupted memory; in bulk it crashed the BE. The fix bound-checks the
-- register index in both HyperLogLog::deserialize and HyperLogLog::is_valid.
-- Blob 0201000000FFFF01 = SPARSE, num_registers=1, register_idx=0xFFFF, value=0x01.
CREATE TABLE t_hll (k INT, b VARBINARY)
  DUPLICATE KEY(k) DISTRIBUTED BY HASH(k) BUCKETS 1
  PROPERTIES("replication_num" = "1");

select __iceberg_transform_truncate(10.65, 50) from t0;

select __iceberg_transform_bucket(i32, 0) from t0;

select __iceberg_transform_bucket(i32, 8) from t0;

select materialize(cast(2.5 as double));

select materialize(cast(null as int));

select sum(materialize(c1)), count(materialize(c2)) from t1;

--------------- cross join -----------------

create table test_vector (id int, data array<float>) ENGINE=olap DUPLICATE KEY (id) DISTRIBUTED BY HASH(id) properties ("replication_num" = "1");

INSERT INTO t_mod_min VALUES
 (1, -128, -32768, -2147483648, -9223372036854775808, -170141183460469231731687303715884105728, -1, -1, -1, -1, -1);

insert into ts values ('xxxx', "not", "xxxxxxxx"), ('xxaxx', 'xx', 'aaa'), ('xaxaxax', 'xax', '-');

select regexp_replace('abc中文def', '中文', 'xx');

select regexp_replace('xxxx', "xxx", "-");

SELECT regexp_extract_all("AbCdExCeF", "([[:lower:]]+)C([[:lower:]]+)", 0);

SELECT regexp_extract_all(str, "([[:lower:]]+)C([[:lower:]]+)", 3) from tsr;

SELECT regexp_position('a1b2c3d', '[0-9]', 5);

SELECT regexp_position('a1b2c3d', '', 2, 8);

SELECT regexp_position('有朋$%X自9远方来', '[0-9]', 7);

SELECT regexp_position(column_0, '61') FROM (VALUES ('2024-01-01T01:61:00')) AS tmp;

-- Test general path queries
SELECT str, pattern, regexp_position(str, pattern) from tsp_general order by str, pattern;

SELECT regexp_position('test', '[0-9]', NULL);

SELECT regexp_position('test string', '*invalid');

insert into tsc values ('abc123def456', '[0-9]'), ('test.com test.net test.org', '\\.'), ('a b  c   d', '\\s+'), ('ababababab', 'ab'), ('', '.'), (NULL, '.');

select regexp_count('abc中文def', '[\\p{Han}]+');

select regexp_count('test string', '(unclosed');

-- Test with VALUES clause (original bug report scenario)
SELECT regexp_replace(column_value, '_package_.*', '') 
FROM (VALUES 
    ('activity_60_package_2'),
    ('activity_50_package_7')
) AS t(column_value);

-- group > 0, constant pattern -> extract_regex_matches(pre-allocated overload)
SELECT regexp_extract_all('bbb', '(a*)', 1);

-- name: test_str_to_map

CREATE TABLE t1(c1 INT, c2 STRING) DUPLICATE KEY(c1) DISTRIBUTED BY HASH(c1) BUCKETS 20;

select SUBSTRING('', 9223372036854775807);

select SUBSTRING('', v) from t1;

insert into t1 values ('placeholder', 'a', 'b');

SELECT TRANSLATE('C|S', 'CS', '测试');

INSERT INTO t1 SELECT CONCAT('C|S', generate_series), 'CS', '测试' FROM TABLE(generate_series(1, 4095*2));

SELECT ifnull(sum(murmur_hash3_32(TRANSLATE(src, '测试', 'C'))), 0) from t1;

SELECT ifnull(sum(murmur_hash3_32(TRANSLATE(src, 'ù七[I%10', NULL))), 0) FROM t1;

SELECT ifnull(sum(murmur_hash3_32(TRANSLATE(src, 'AaPWie', '4AlJzF'))), 0) FROM t1;

SELECT ifnull(sum(murmur_hash3_32(TRANSLATE(src, 'Jf😄dJeCc😂f六˜', '1d44cdQjCX'))), 0) FROM t1;

SELECT ifnull(sum(murmur_hash3_32(TRANSLATE(src, NULL, NULL))), 0) FROM t1;

SELECT ifnull(sum(murmur_hash3_32(TRANSLATE('^😂2æ六d]iBdcc五4?a(😂B1七八1[DC三四])(E0æIæ八一', from_str, to_str))), 0) from t1;

SELECT ifnull(sum(murmur_hash3_32(TRANSLATE('1›i😇一?试0测dh六三BI2%四[]ù%j-c一🙂1û六三âaE一😇😄七fe*4五Egg', from_str, to_str))), 0) from t1;

SELECT ifnull(sum(murmur_hash3_32(TRANSLATE('fiBC#🙂^F八4æJ3ù+˜D试-一+$*😄CæC?›ùJ五2›B二八%%G?五D八b4', from_str, to_str))), 0) from t1;

SELECT ifnull(sum(murmur_hash3_32(TRANSLATE(']C五%四^三🙂Bf一[F六五+一icä八CJBgjJd', from_str, to_str))), 0) from t1;

SELECT ifnull(sum(murmur_hash3_32(TRANSLATE('â试fe?CH+a😇äFC八&c^â?+AAd˜^😂d', from_str, to_str))), 0) from t1;

SELECT ifnull(sum(murmur_hash3_32(TRANSLATE('*六', from_str, to_str))), 0) from t1;

SELECT ifnull(sum(murmur_hash3_32(TRANSLATE('五b›ûûcec)æ+i%cd4iC', from_str, to_str))), 0) from t1;

SELECT ifnull(sum(murmur_hash3_32(TRANSLATE('六六+Idd?æû+四四0二?)*2i四?😂â测-F1H😂[ä三)&]]cD', from_str, to_str))), 0) from t1;

SELECT ifnull(sum(murmur_hash3_32(TRANSLATE('f+七a😂æ五A😄四d一', from_str, to_str))), 0) from t1;

SELECT ifnull(sum(murmur_hash3_32(TRANSLATE('âf›', from_str, to_str))), 0) from t1;

SELECT ifnull(sum(murmur_hash3_32(TRANSLATE('七]三一)æ', from_str, to_str))), 0) from t1;

SELECT ifnull(sum(murmur_hash3_32(TRANSLATE('八五(^', from_str, to_str))), 0) from t1;

SELECT TRANSLATE('-二c%🙂G九c%^#C-^h四›九0三', 'b›不%G试0九cd二cc', '3GCChhc');

SELECT TRANSLATE('ie4eC[g-2九*I😄八jfI😄八)a九âäE🙂4?1一æ六😄4🙂ù四3九3j一?', 'Jg😍9😂😍I一?😄ùC', '3Najg2ei44I');

SELECT TRANSLATE('三aG七^c七*[1CJ九g0æû测äc一🙂C2Fâh四1âf2D2-七j%一âa四cF%e&', 'c测2Fxr0', 'aCSacB7CJa22D');

SELECT TRANSLATE(']一BFj-Ggei*ûh😇+(I#😂七dä', ']😂äh😜😇âä', 'dteGMiFhIIkh0');

SELECT TRANSLATE('😄4jCdha九?😇3H]Fef4试八hgF五五J三c)🙂七2%hF🙂a-If😂a›[#j˜J', '4cxIhufm3hn', '5GxFgChdkHdIa');

SELECT TRANSLATE('-1%0æa0ä六试测2😄😄dæ🙂h+igE😇A八F3六û八😇â+', 'h00gCT0F1kF1', 'aJ测3âihii😍ûnæ%');

SELECT TRANSLATE('%四›-)gF😂›dB+二0bC', '›😂+%四B二Q', 'gC试)›在›+');

SELECT TRANSLATE('31aEi测四3试&a%g', 'i3i3ggN33aiU3a', 'aDaRg1');

SELECT TRANSLATE(']æâ八试五一jd4AJ九%四2b+四D😂ä)]BAhg二E😄九😄Aaù[八AB二&六', 'ABhAgl', '四一A[AD&g二hAX%');

SELECT TRANSLATE('cJe🙂八A#+]d三]九g?%DB›e九DûgCc˜三(i二j四%hH😄H?', 'hA5BHA', 'û三D0二i');

SELECT TRANSLATE(')j九F(›e五[a3[五*eD测😇fûDh七🙂🙂?+六eA测d&]dä五ä八Bgûd-', 'ddjFBG03DeaQfT', 'zBeddd');

SELECT TRANSLATE(')二[ù六一d七&一aB$🙂B😄HùG四+dc😂ha', 'daaBcG', 'dcYaGBZGd');

SELECT ifnull(sum(murmur_hash3_32(TRANSLATE(src, '˜›âä测试😄😂ab', '˜â测😄a试'))), 0) from t1;

SELECT ifnull(sum(murmur_hash3_32(TRANSLATE(src, '˜›âä测试😄😂ab', '˜😄试'))), 0) from t1;

insert into test_uv values('2024-01-01', 1, hll_hash(10));

set always_collect_low_card_dict_on_lake = true;

select c1, cast (c2 as int) as name from t_low;

-- name: test_global_dict_on_lake

set low_cardinality_optimize_on_lake = true;

INSERT INTO lc_union_partial VALUES (1, 'b', 'y');

analyze full table test_table_2;

analyze full table join_table;

analyze full table alias_table_1;

analyze full table diff_table_2;

-- test_union_with_constant_projection
-- expect: Project(Constant) -> Union -> Scan
SELECT fixed_col, id 
FROM (
    SELECT 'Constant1' AS fixed_col, id FROM test_table_1
    UNION ALL
    SELECT 'Constant2' AS fixed_col, id FROM test_table_2
) t order by 1,2;

SELECT alias_c1, COUNT(*) AS cnt
FROM (
    SELECT c1 AS alias_c1 FROM alias_agg_table_1
    UNION ALL
    SELECT c1 AS alias_c1 FROM alias_agg_table_2
) t
GROUP BY alias_c1 order by 1,2;

INSERT INTO exclude_col_table_2 VALUES (4, 40, 'qux'), (5, 50, 'quux'), (6, 60, 'corge');

analyze full table join_cond_table_1;

analyze full table broadcast_dist_table;

SELECT id, name, value, value + 10 AS adjusted_value
FROM (
    SELECT id, name, value FROM func_table_1
    UNION ALL
    SELECT id, name, value FROM func_table_2
) t
WHERE value IS NOT NULL AND value > 100;

-- test_union_integer_computation_with_filters
-- expect: Filter -> Project(ComputedColumn) -> Union(Scan, Scan)
CREATE TABLE compute_table_1 (
    id INT,
    value INT
) DUPLICATE KEY(id)
DISTRIBUTED BY HASH(id) BUCKETS 3
PROPERTIES('replication_num' = '1');

INSERT INTO filter_table_2 VALUES (4, 'electronics', 400), (5, 'furniture', 500), (6, 'fashion', 600);

analyze full table nested_int_table_1;

INSERT INTO join_table_1 VALUES (1, 'info1'), (5, 'info5');

INSERT INTO source_table_1 VALUES (1, 'X'), (2, 'Y'), (3, 'Z');

CREATE TABLE agg_cte_table_2 (
    id INT,
    category VARCHAR(20),
    amount INT
) DUPLICATE KEY(id)
DISTRIBUTED BY HASH(id) BUCKETS 3
PROPERTIES('replication_num' = '1');

CREATE TABLE multi_union_table_3 (
    col1 INT,
    col2 VARCHAR(20)
) DUPLICATE KEY(col1)
DISTRIBUTED BY HASH(col1) BUCKETS 3
PROPERTIES('replication_num' = '1');

-- test_union_with_large_result_and_group_by
-- expect: Aggregate -> Union -> LargeResults -> Scan
CREATE TABLE large_table_1 (
    id INT,
    value VARCHAR(50)
) DUPLICATE KEY(id)
DISTRIBUTED BY HASH(id) BUCKETS 3
PROPERTIES('replication_num' = '1');

-- test_union_with_large_dict_broadcast
-- expect: Broadcast -> Union -> Scan -> LargeDict
CREATE TABLE broadcast_table_1 (
    id INT,
    `key` VARCHAR(50)
) DUPLICATE KEY(id)
DISTRIBUTED BY HASH(id) BUCKETS 3
PROPERTIES('replication_num' = '1');

CREATE TABLE dict_filter_table_2 (
    id INT,
    `text` VARCHAR(100)
) DUPLICATE KEY(id)
DISTRIBUTED BY HASH(id) BUCKETS 3
PROPERTIES('replication_num' = '1');

INSERT INTO multi_column_table VALUES (1, 'b', 'y');

insert into allstringx values (4096, 'S1');

insert into td values (1, 10), (2, 20), (3, 30);

-- a plain varchar column is renamed only once and always worked
select k, m from (select k, max(s) as m from (select t.k as k, t.s as s from tj t join td d on d.k = t.k) x group by k limit 5) y order by k;

select count(test_v3_t0.id),count(test_v3_t0.c0),count(test_v3_t0.c1),count(test_v3_t1.id),count(test_v3_t1.c0),count(test_v3_t1.c1) from test_v3_t0 inner join test_v3_t1 on test_v3_t0.id = test_v3_t1.id;

select count(test_v3_t0.id),count(test_v3_t0.c0),count(test_v3_t0.c1),count(test_v3_t1.id),count(test_v3_t1.c0),count(test_v3_t1.c1) from test_v3_t0 full outer join test_v3_t1 on test_v3_t0.c1 = test_v3_t1.c1;

create materialized view mv1 distributed by hash(c1) buckets 3 refresh manual properties("replication_num" = "1")
as select c1, c2, c3 from t1;

CREATE TABLE `t0` (
  `c0` int(11) NULL COMMENT "",
  `c1` varchar(20) NULL COMMENT "",
  `c2` varchar(200) NULL COMMENT "",
  `c3` int(11) NULL COMMENT ""
) ENGINE=OLAP
DUPLICATE KEY(`c0`, `c1`)
COMMENT "OLAP"
DISTRIBUTED BY HASH(`c0`, `c1`) BUCKETS 48
PROPERTIES (
"replication_num" = "1");

INSERT into blackhole() select c0 + c1,* from t0 where c0 < 10 limit 100,10;

insert into tjs1 values (3, '{"a": 3}');

insert into tpart select generate_series, cast(generate_series as varchar) from table(generate_series(1, 30));

select t0.* from t0 left semi join tc1 on t0.c0 = tc1.c0 where t0.c0 < 20 order by 1,2 limit 1;

-- test with union
insert into blackhole() select * from t0 where c0 < 10 union all select * from t0 where c0 >= 10 limit 1000;

insert into blackhole() select * from tpart where c0 < 20 order by c0 limit 1000;

CREATE TABLE `t1` (
	`id` int(11) NULL COMMENT "",
	`data` int(11) NULL COMMENT "",
	`date` int(11) NULL COMMENT ""
) ENGINE=OLAP
DUPLICATE KEY(`id`)
COMMENT "OLAP"
DISTRIBUTED BY HASH(`id`) BUCKETS 4
PROPERTIES (
"replication_num" = "1");

select *,lower(id) from t0 order by upper(id) limit 10;

-- join
select * from t0 join t1 on t0.id = t1.id order by t0.id, t1.id limit 10;

with cte as (select *, row_number() over (partition by id) rn from t0)
select * from cte where rn = 1 order by 1 limit 10;

-- name: test_glm_native_exception @sequential

set enable_global_late_materialization = true;

ALTER TABLE t_json_schema_change ADD COLUMN col6 int;

SELECT id, get_json_int(data, '$.age') as age FROM t_json_schema_change ORDER BY id;

INSERT INTO tablepk VALUES (1, 10);

update tab1 set v1 = (select sum(tab2.v1) from tab2), v2 = (select sum(tab2.v2) from tab2), v3 = 1000;

alter table t set ('unique_constraints'='txid');

select * from test_v3_t0 order by id limit 10;

-- name: test_glm_native_with_global_dict

-- test with global dictionary
set enable_global_late_materialization = true;

insert into no_partition_t0 select * from no_partition_t0;

CREATE TABLE `result_table` (
  `c0` bigint DEFAULT NULL,
  `c1` bigint DEFAULT NULL,
  `c2` bigint DEFAULT NULL
) ENGINE=OLAP
DUPLICATE KEY(`c0`)
COMMENT "OLAP"
DISTRIBUTED BY HASH(`c0`) BUCKETS 1
PROPERTIES (
"replication_num" = "1"
);

select c1, count(distinct c1), count(*), sum(1) from no_partition_t0 where c2 > 1000 group by c1 order by 1,2 limit 10;

select count(*) from result_table;

select c0, sum(c1), avg(c2) from colocate_partition_t0 group by c0 order by 3,2,1 limit 10;

select c1, count(distinct c0), count(*), sum(1) from colocate_partition_t0 where c2 > 1000 group by c1 order by 1,2 limit 10;

insert into blackhole() select distinct c0, c1, c2 from colocate_partition_t0 limit 100;

select c1, count(distinct c1), count(*), sum(1) from no_colocate_partition_t0 where c2 > 1000 group by c1 order by 1,2 limit 10;

insert into result_one_tablet_table select distinct c0, c1, c2 from no_colocate_partition_t0;

select c0, count(distinct c1), count(*), sum(1) from only_one_tablet group by c0 order by 1,2 limit 10;

select c0, count(distinct c1), count(*), count(distinct c2), count(distinct c1, c2) from only_one_tablet where c0 > 0 group by c0 order by 1,2 limit 1000, 10;

-- name: test_group_execution_colocate_set

-- A colocate Set operator must never be placed inside a colocate exec group.
-- On the BE its branches keep a plain LocalExchangeSink instead of a GroupedExecutionSink,
-- so nothing ever advances ColocateExecutionGroup past its first wave of bucket groups and
-- the query hangs forever. Reproduces as soon as bucket groups >= 2 * physical dop.
set enable_group_execution = true;

-- same shape behind an OLAP table sink: INSERT forces the sink fragment dop down, which is how
-- this was originally hit in production (plain SELECT happened to get one wave and survived)
CREATE TABLE `wid_profile` (
  `seg_id` bigint(20) NULL COMMENT "",
  `wid` varchar(64) NULL COMMENT ""
) ENGINE=OLAP
DUPLICATE KEY(`seg_id`)
DISTRIBUTED BY HASH(`seg_id`) BUCKETS 4
PROPERTIES (
"replication_num" = "1"
);

CREATE TABLE `small_table` (
  `c0` int(11) NULL COMMENT "",
  `c1` varchar(20) NULL COMMENT "",
  `c2` varchar(200) NULL COMMENT "",
  `c3` int(11) NULL COMMENT ""
) ENGINE=OLAP
DUPLICATE KEY(`c0`, `c1`)
COMMENT "OLAP"
DISTRIBUTED BY HASH(`c0`, `c1`, `c2`) BUCKETS 4
PROPERTIES (
"replication_num" = "1"
);

select count(l.c0), avg(l.c0), count(l.c1), count(l.c0), count(r.c1) from t0 l join [colocate] t1 r on l.c0 = r.c0 and l.c1 = r.c1 where r.c3 < 1024;

-- build side empty
select count(l.c0), avg(l.c0), count(l.c1), count(l.c0), count(r.c1) from t0 l join [colocate] t1 r on l.c0 = r.c0 and l.c1 = r.c1 where r.c3 < 0;

select /*+SET_VAR(low_cardinality_optimize_v2=false,global_runtime_filter_build_max_size=-1) */ t0.*,t1.* from t0 join [bucket] small_table t2 on t0.c0=t2.c0 join [colocate] t1 on t1.c1=t0.c1 and t1.c0 =t0.c0 and t1.c2 = t2.c2 where t1.c3 < 10 order by 1,2,3,4,5,6,7,8;

with agged_table as ( select distinct c0, c1 from t0) select count(*) ,sum(l.c0), sum(r.c0), sum(l.c1), sum(r.c1) from agged_table l join [colocate] t0 r on l.c0 = r.c0 and l.c1 = r.c1;

with flat_table as ( select c0, c1 from t0) select /*+SET_VAR(cbo_cte_reuse_rate=-1) */ l.c0, l.c1, count(*) from flat_table l right join [bucket] flat_table r on l.c0 = r.c0 and l.c1 = r.c1 group by 1,2 order by 1,2 limit 10000,2;

-- colocate join with bucket shuffle group by
with agged_table as ( select distinct c0, c1 from t0) select /*+SET_VAR(cbo_cte_reuse_rate=-1) */ count(l.c0), count(l.c1) from t0 l join [colocate] (select l.c0, r.c1 from agged_table l join [bucket] t0 r on l.c0=r.c0 and l.c1 = r.c1) r on l.c0=r.c0 and l.c1 = r.c1;

select count(*), sum(lc0), sum(lc1), sum(rc1) from (select l.c0 lc0, l.c1 lc1, r.c1 rc1, row_number() over (partition by l.c0) rn from t0 l join [colocate] t1 r on l.c0 = r.c0 and l.c1 = r.c1)tb where rn < 10;

select c0,c1 = (select c1 from t1 where c0 != 10) from (select l.c0, r.c1 from t0 l join [colocate] t1 r on l.c0 = r.c0 and l.c1 = r.c1) tb order by 1, 2 limit 10000, 1;

select count(l.c0), avg(l.c0), count(l.c1), count(l.c0), count(r.c1) from t0 l full join [colocate] t1 r on l.c0 = r.c0 and l.c1 = r.c1 where r.c0=1 and r.c1=1;

with 
  tx as (select c0, c1 from t0),
  ty as (select c0, c1 from t0 where c0 = 1 and c1 = 1)
select count(l.c0), avg(l.c0), count(l.c1), count(l.c0), count(r.c1) from tx l full join [colocate] ty r on l.c0 = r.c0 and l.c1 = r.c1;

select c0,c1 from t0 l union select c0,c1 from t1 r order by 1 limit 10000,3;

set enable_predicate_move_around = false;

with
    t1 as (select * from t0 where k1 not in (1,2,3,4)),
    t2 as (select * from t0)
select count(1) from t1 join [colocate] t2 using(k1);

with
    t1 as (select * from t0 where k1 not in (1,2,3,4)),
    t2 as (select * from t0)
select count(*) from (select count(1) from t1 join [bucket] t2 using(k1) group by k1) tb;

with
    t1 as (select * from t0 where k1 >= 1),
    t2 as (select * from t0)
select count(*) from (select count(1) from t2 join [bucket] t1 using(k1) group by k1) tb;

set cbo_push_down_groupingset = true;

set cbo_push_down_groupingset_cascade_level = 5;

-- ---------------------------------------------------------------------------
-- 1. AVG / COUNT / mixed aggregates over ROLLUP.
--    v_dbl is rounded because the rewrite changes the summation order of a double accumulator; a real
--    logic error moves the value far more than 6 decimal places, so this does not weaken the check.
-- ---------------------------------------------------------------------------
set cbo_push_down_groupingset = false;

-- ---------------------------------------------------------------------------
-- 3. AVG under a filter on grouping() applied above the rollup - the exact shape that regressed twice
--    before (#49928 lost the repeat predicate, #58831 copied the having predicate without remapping).
--    The rule fires here, so this exercises predicate remapping across the CTE/union split with an
--    aggregate that no longer exists as a CTE output column.
-- ---------------------------------------------------------------------------
set cbo_push_down_groupingset = false;

SELECT c0, count(c2) FROM t_struct_gs GROUP BY CUBE(c0) ORDER BY c0;

CREATE TABLE `tbl_with_null2` ( 
    `k1`  date, 
    `k2`  datetime, 
    `k3`  varchar(20), 
    `k4`  varchar(20), 
    `k5`  boolean, 
    `k6`  tinyint, 
    `k7`  smallint, 
    `k8`  int, 
    `K9`  bigint, 
    `K10` largeint, 
    `K11` float, 
    `K12` double, 
    `K13` decimal(27,9) 
) DUPLICATE KEY(`k1`) 
DISTRIBUTED BY HASH(`k1`) BUCKETS 9
PROPERTIES ( "replication_num" = "1");

select k1, k2, grouping_id(k1, k2) as f1, grouping(k1, k2) as f2, sum(k8) as v1
from tbl_with_null1 group by cube(k1, k2) order by f1, f2, k1, k2, v1;

select * from t before '2024-01-01 00:00:00';

-- name: test_query_by_timestamp_schema_change
create table t(k int);

-- name: test_h3_native_api
SELECT IF(H3_FromGeo(ST_GeogFromText('POINT (0 0)'), 3) = 592035265791393791, 'OK', 'FAIL');

-- name: test_hive_table_with_comment

CREATE TABLE struct_index (
date varchar(1048576) NULL COMMENT "",
hash varchar(1048576) NULL COMMENT "",
input struct<`index` bigint(20), value double> NULL COMMENT "",
outputs array<struct<`index` bigint(20), value double>> NULL COMMENT ""
);

-- name: testHiveView

select id from t1 order by id;

-- name: test_write_csv_array

drop table t2 force;

-- Test 7: DELETE request with Named Parameters
SELECT json_query(http_request(
    url => 'https://jsonplaceholder.typicode.com/posts/1',
    method => 'DELETE'
), '$.status') as status;

-- Test 15: POST with body as string (not auto-stringify)
SELECT json_query(http_request(
    url => 'https://jsonplaceholder.typicode.com/posts',
    method => 'POST',
    headers => '{"Content-Type": "text/plain"}',
    body => 'plain text body'
), '$.status') as status;

-- Test 26: OPTIONS request - returns allowed methods
SELECT json_query(http_request(
    url => 'https://jsonplaceholder.typicode.com/posts/1',
    method => 'OPTIONS'
), '$.status') as status;

-- Test 1: Default security level (3=RESTRICTED) blocks requests without allowlist
-- Should return error with "allowlist" message
SELECT json_query(http_request(
    url => 'https://jsonplaceholder.typicode.com/posts/1'
), '$.status') as status;

-- Test 10: Level 2 blocks private IP (192.168.x.x)
SELECT json_query(http_request(
    url => 'http://192.168.1.1/api',
    timeout_ms => 1000
), '$.status') as status;

-- Test 21: Non-matching host should be blocked
SELECT json_query(http_request(
    url => 'https://postman-echo.com/get'
), '$.status') as status;

-- Test 30: Host matching regexp should be allowed
SELECT json_query(http_request(
    url => 'https://jsonplaceholder.typicode.com/posts/1'
), '$.status') as status;

-- Test E3: Invalid protocol (ftp) - should fail
SELECT json_query(http_request(url => 'ftp://ftp.example.com/file'), '$.status') as status;

SELECT json_query(http_request(
    url => 'https://jsonplaceholder.typicode.com/posts/1',
    timeout_ms => 1
), '$.status') as status;

-- Test E22: Negative timeout - should clamp to 1ms
SELECT json_query(http_request(
    url => 'https://jsonplaceholder.typicode.com/posts/1',
    timeout_ms => -1000
), '$.status') as status;

insert into test_part_evo values (4, 'data4', '2023-01-04', 400);

-- ############### bucket-aware OFF: ground-truth reference ###############
set enable_bucket_aware_execution_on_lake = false;

create table t3 (id bigint, k bigint, d date) partition by month(d), bucket(id, 4);

-- 0
select count(*) from t1 a left anti join (select id, k from t1 where id in (select id from t1)) r on a.id = r.id and a.k = r.k;

select count(*) from (select id, id as a from t3 except select id, id as a from t3) t;

set pipeline_dop = 0;

-- ============================================================
-- Case 2: SELECT c1, c3
-- ============================================================
select c1, c3 from t_col_proj order by c1;

-- 3. renaming an equality key column: deletes match by field id, so a delete written before the rename still
-- applies after it, and a new delete can name the column by its new name. The first delete file is written by the
-- Iceberg Java writer (parquet field ids, deleting id = 1); a hive-written file has no field ids and is matched by
-- column name, so it cannot be used across a rename.
create table rename_t(
    id int,
    v string
) properties ("format-version" = "2");

-- expected: (2, b) (3, c)
select * from promote_t order by id;

insert into travel_v2_t values (1, 'v1'), (2, 'v2'), (3, 'v3'), (4, 'v4');

alter table travel_v2_t create tag tag_pos_delete;

select count(*) from travel_v2_t version as of "tag_insert" where id = 1;

-- expected: (1, 2) position deletes for p=a and p=b, (2, 2) equality deletes for p=a and p=b
select content, count(*) from compact_v2_t$files where content != 0 group by content order by content;

-- expected: a1new b3
select * from compact_v2_t order by v;

-- ================================================
-- SECTION 1: BASIC TRANSFORM PARTITION TESTS
-- ================================================

-- ================================================
-- SECTION 4: ADVANCED DELETE OPERATIONS
-- ================================================

-- ================================================
-- SECTION 1: SINGLE PARTITION COLUMN TESTS
-- ================================================

-- ================================================
-- SECTION 2: MULTI-PARTITION COLUMN TESTS
-- ================================================

set new_planner_optimize_timeout=30000;

-- 1. USING deletes a row matched several times once; no USING match deletes nothing, even with a partition predicate
delete from t using k where t.p = 1 and k.k = 999;

insert into enc_t values (4, 'a');

set enable_iceberg_eq_delete_runtime_filter_pruning = true;

-- name: test_iceberg_eq_delete_rf_pruning
-- A runtime filter on an identity partition column skips the equality delete files of the partitions it rejects.
-- The delete files are written by hive tables and registered with add_equality_delete_files.

-- a DML target keeps every delete

alter table t drop partition column day(ts);

-- expected: 3,4 then 2 files
select group_concat(id order by id) from t where date_trunc('month', ts) = '2024-02-01 00:00:00';

insert into s_t values (1, 'UNITED'), (2, 'UNIX'), (3, 'UK'), (4, 'CHINA'), (5, '中国人');

set enable_iceberg_function_predicate_pruning = true;

create table src (k int, dt date) duplicate key(k) distributed by hash(k) buckets 1 properties("replication_num" = "1");

select CAST(regexp_extract(get_query_profile(last_query_id()), 'StatisticsSuccessCounter: ([0-9]+)', 1) AS BIGINT) >= 20;

-- name: test_iceberg_global_shuffle_transform

-- test with connector_sink_shuffle_mode = auto
set connector_sink_shuffle_mode = 'auto';

set hash_join_interpolate_passthrough = true;

-- name: test_iceberg_merge_into_partitioned

select c1 from t1 where _file = 'nonexistent' order by c1;

insert into t2 values (4, 2), (5, 3);

-- Delete with dt = '2023-01-03' or region = 'West' - should trigger metadata delete optimization
-- because all data is in dt='2023-01-03' partition, which matches the first part of the OR condition

-- Delete with id > 50 - should trigger metadata delete optimization
-- because file statistics will show that all rows in the files have id > 50

-- Test 3.2: Delete with date condition on month-transformed column

-- ====================================================
-- SECTION 6: Truncate Transform Partition Tests
-- ====================================================

-- the partition values are a struct
select content, `partition`, record_count from part_t$files order by content, `partition`.p;

select count(distinct data_file.file_path) from part_t$all_entries;

set enable_min_max_optimization = true;

drop table ice_tbl_0 force;

-- ============================================================
-- Case 6: all rows are NULL in every queried column.
-- Verifies that the optimization correctly returns NULL instead of
-- incorrect default values when all file statistics are absent.
-- ============================================================
set enable_min_max_optimization = true;

select c_int from ice_tbl_2 order by c_int;

drop table ice_tbl_3 force;

select count(1) from t1 where c_bool != false;

select count(1) from t1 where c_bool is not null;

select count(1) from t1 where c_bool in (true, false) and c_bool not in (true);

select count(1) from t1 where c_tinyint <=> 10;

select count(1) from t1 where c_tinyint not in (10, 10, 100);

select count(1) from t1 where c_smallint >= 10000;

select count(1) from t1 where c_smallint > 10000 AND c_smallint < 100000;

-- INT
select count(1) from t1 where c_int = 100000;

select count(1) from t1 where c_int is null;

select count(1) from t1 where c_int in (10, 100000, 1000000) and c_int not in (10, 100000, 1000000);

select count(1) from t1 where c_bigint <= 100000;

select count(1) from t1 where c_bigint in (10, 100000, 1000000);

select count(1) from t1 where c_float > 100000;

select count(1) from t1 where c_float = 100000 AND c_float != 100000;

-- parse to: c_float > 0 and c_float is not null
select count(1) from t1 where c_float > 0 AND (c_float in (10, 100000, 1000000) OR c_float not in (10, 100000, 1000000));

select count(1) from t1 where c_double <=> null;

select count(1) from t1 where c_double in (1000000, 100000, 10) and c_double in (10, 1000000, 100000, 7, 8, 9, 1);

select count(1) from t1 where c_decimal64 < 100000;

select count(1) from t1 where c_decimal64 >= 100000 AND c_decimal64 <= 1000000;

select count(1) from t1 where c_decimal128 != 100000;

select count(1) from t1 where c_decimal128 is not null;

select count(1) from t1 where c_decimal128 in (10, 100000, 1000000, 7) and c_decimal128 not in (10, 100000, 1000000);

select count(1) from t1 where c_varchar <=> concat('varchar-', 100000);

select count(1) from t1 where c_varchar not in (concat('varchar-', 10), concat('varchar-', 100000), concat('varchar-', 1000000));

select count(1) from t1 where c_char >= concat('char-', 100000);

select count(1) from t1 where c_char > concat('char-', 100000) AND c_char < concat('char-', 1000000);

-- c_date
select count(1) from t1 where c_date = cast(date_sub('2023-01-01', interval 100000 day) as date);

select count(1) from t1 where c_date is null;

select count(1) from t1 where c_date in (cast(date_sub('2023-01-01', interval 10 day) as date), cast(date_sub('2023-01-01', interval 100000 day) as date), cast(date_sub('2023-01-01', interval 1000000 day) as date)) and c_date not in (cast(date_sub('2023-01-01', interval 10 day) as date), cast(date_sub('2023-01-01', interval 100000 day) as date), cast(date_sub('2023-01-01', interval 1000000 day) as date));

select count(1) from t1 where c_datetime <= date_sub('2023-01-01', interval 100000 second);

select count(1) from t1 where c_datetime in (date_sub('2023-01-01', interval 10 second), date_sub('2023-01-01', interval 100000 second), date_sub('2023-01-01', interval 1000000 second));

-- name: test_iceberg_parse_predicates_2 @slow

select count(1) from t1 where c_array_int <=> null;

select count(1) from t1 where c_array_int in ([1000000, 1000000+1, 1000000+2, 1000000+3], [100000, 100000+1, 100000+2, 100000+3], [10, 10+1, 10+2, 10+3]) and c_array_int in ([10, 10+1, 10+2, 10+3], [1000000, 1000000+1, 1000000+2, 1000000+3], [100000, 100000+1, 100000+2, 100000+3], [7, 7+1, 7+2, 7+3], [8, 8+1, 8+2, 8+3], [9, 9+1, 9+2, 9+3]);

select count(1) from t1 where c_map <=> null;

select count(1) from t1 where c_map in ( map{0: 10, 1: 10 + 1, 2: 10 + 2},  map{0: 100000, 1: 100000 + 1, 2: 100000 + 2},  map{0: 1000000, 1: 1000000 + 1, 2: 1000000 + 2},  map{0: 7, 1: 7 + 1, 2: 7 + 2}) and c_map not in ( map{0: 10, 1: 10 + 1, 2: 10 + 2},  map{0: 100000, 1: 100000 + 1, 2: 100000 + 2},  map{0: 1000000, 1: 1000000 + 1, 2: 1000000 + 2});

insert into test_part_middle values (1, '2023-01-01', 'data1');

drop table test_part_end force;

insert into test_part_year_beginning values ('2024-01-01', 2, 'data2');

-- test partition column at the end with day transform
create table test_part_day_end (
  id bigint,
  data string,
  dt date
)
partition by day(dt);

select * from test_part_hour_beginning order by id;

insert into test_part_bucket_end values (1, 'data1', 100);

drop table test_multi_transform force;

CREATE TABLE  test_orders (
  `order_id`     BIGINT,
  `user_id`      BIGINT,
  `amount`       DOUBLE,
  `ts`           DATETIME
) PARTITION BY day(ts);

-- partitions=4/5

SELECT COUNT(*), SUM(amount) FROM test_orders WHERE ts >= '2024-03-01 00:00:00'  AND ts <  '2024-04-01 00:00:00';

INSERT INTO test_users_bucketed VALUES
 (6,  'US',  6.0),
 (7,  'CN',  7.0),
 (16, 'US', 16.0),
 (32, 'CN', 32.0);

CREATE TABLE test_events (
  event_id BIGINT,
  user_id  BIGINT,
  ts       DATETIME,
  country  STRING
) PARTITION BY day(ts), country;

SELECT country, COUNT(*) AS c FROM test_events GROUP BY country ORDER BY country;

select *  from (select line from table(unnest(split(get_query_profile(last_query_id()),"\n"))) t(line)) v where v.line like '%- BloomFilterSuccessCounter%' or v.line like '%- BloomFilterTriedCounter%';

select * from iceberg_oss_db.bloom_filter_table5 where c2 = 'Alice' and c1 = 2;

-- the ratio picks p=1 only
alter table v2_t execute rewrite_data_files(min_file_size_bytes = 1);

select id, _row_id from rowid_multi_rg where id in (0, 99, 100, 101, 1499, 1500, 1599, 1600, 2999) order by id;

-- name: test_iceberg_v3_row_lineage_write_insert_select
-- Test row lineage maintenance during INSERT ... SELECT

-- 2. Create No-Shredding table and load data
CREATE TABLE test_noshredding_variant (
    data VARIANT,
    id BIGINT,
    age INT,
    city VARCHAR
) properties(
  'format-version' = '3'
);

SELECT
    get_variant_int(data, '$.id') as id,
    get_variant_string(data, '$.groups[0].name') as group0_name,
    get_variant_int(data, '$.groups[0].scores[0]') as group0_score0,
    get_variant_int(data, '$.groups[0].scores[1]') as group0_score1,
    get_variant_string(data, '$.groups[1].name') as group1_name,
    get_variant_int(data, '$.groups[1].scores[0]') as group1_score0
FROM test_shredding_variant
ORDER BY id;

SELECT 
    get_variant_int(data, '$.id') as id,
    get_variant_int(data, '$.age') as age,
    get_variant_string(data, '$.city') as city,
    cast(variant_query(data, '$.score') as string) as score,
    get_variant_double(data, '$.profile.salary') as salary,
    get_variant_string(data, '$.profile.department') as dept,
    get_variant_int(data, '$.profile.metrics.views') as views,
    get_variant_string(data, '$.profile.rank') as rank,
    get_variant_string(data, '$.events[0].type') as event0_type
FROM test_noshredding_variant
ORDER BY id;

-- ========================================
-- Query 10: Combined filter — city (dict-encoded STRING, Phase 2)
--           + variant conjunct on views (Phase 4)
-- city = 'city_1' OR 'city_3' selects id=1001,1003; views > 115 selects id=1003
-- ========================================
SELECT id, city, get_variant_int(data, '$.profile.metrics.views') as views
FROM test_shredding_variant
WHERE city IN ('city_1', 'city_3')
  AND get_variant_int(data, '$.profile.metrics.views') > 115
ORDER BY id;

-- name: test_iceberg_string_date_partition_cardinality
-- description: PR2 — a STRING date partition column compared with a temporal value coerces to
-- CAST(c2 AS DATETIME) = <ts>. On the manifest-level cardinality path (Path C, column stats off),
-- the old code pushed the cast to Iceberg's string-domain manifest evaluator, which pruned every
-- manifest and returned rowCount=1 (a severe under-estimate that produces bad CBO/join plans).
-- PR2 keeps such a cast-on-string-partition conjunct as a StarRocks-side residual and prunes
-- manifests by DATETIME-domain partition range, so a matching partition's manifest is counted in
-- full instead of collapsing to 1.
--
-- NOTE: single-table queries are short-circuited to default statistics by
-- disable_table_stats_from_metadata_for_single_table (default true, #64443), so the connector
-- metadata path is never reached. We turn it off here to exercise the path; column statistics stay
-- off so we stay on the manifest path (Path C); query-trigger-analyze is off so cached column
-- statistics do not flip the estimate to ESTIMATE mid-run.

-- cast/interval form: pre-PR2 this collapsed to cardinality=1; PR2 keeps the 2020-06-14 manifest (17 rows).

-- a different partition value keeps a different manifest (23 rows), proving range pruning selects per value.

-- date_sub builtin form must agree with the operator form.

-- control: bare 'yyyy-MM-dd' literal (no cast, always worked) must agree with the cast forms.

drop table t_card force;

drop table t_del_eq force;

insert into t_datestr values (1, '2020-01-02'), (2, '2020-06-08'), (3, '2020-06-14'), (4, '2020-06-15'), (5, '2020-06-22');

select c1, c2 from t_datestr where c2 = cast('2021-06-15' as date) - interval 1 year order by c1;

-- range comparison keeps the correct partitions
select c1, c2 from t_datestr where c2 >= cast('2020-06-15' as date) - interval 1 day order by c1;

drop table test_table force;

-- fix target 1: UNNEST an array column + GROUP BY the required column
select id from t_required, unnest(arr) group by id order by id;

-- regression 9: required column as a plain aggregate argument
select max(id), min(id) from t_required;

select count(distinct id) from t_required, unnest([1, 2]);

-- unpartitioned table with orc (eq-delete && pos-delete) 
/*
 CREATE TABLE `hive_catalog`.`iceberg_ci_db`.`iceberg_v2_orc_unpartitioned_table` (
  `k1` INT NOT NULL,
  `k2` VARCHAR(2147483647),
  CONSTRAINT `7193cf04-1e4f-4aec-be16-2aa54bb92b4c` PRIMARY KEY (`k1`) NOT ENFORCED
) WITH (
  'write-format' = 'orc',
  'write.upsert.enabled' = 'true'
)
*/

-- name: test_iceberg_v3_glm_row_id_order
-- Global late materialization fetches rows by _row_id. A file whose _row_id does not ascend with the
-- row position (here: a sorted rewrite that keeps each row's original _row_id) must still return each
-- row's own values.

set pipeline_sink_dop = 1;

set enable_global_late_materialization = false;

select id, _row_id from rid_t order by id;

-- four data files: (a, p=0), (a, p=1), (b, p=0), (b, p=1)
insert into t select x, concat('a', x), x % 2 from table(generate_series(1, 20)) s(x);

select data_file.content, count(*) from t$entries where status != 2 group by data_file.content order by 1;

-- INSERT OVERWRITE replaces the partitions it writes: p=0 now holds one row, p=1 is kept.
-- expected: (0, 1, 1000), (1, 20, 400)
insert overwrite t select 1000, 'z', 0;

set plan_mode = 'distributed';

-- 4 rows, row 2 is SQL NULL, others include an empty object
CREATE TABLE t_empty (data VARIANT) properties('format-version' = '3');

select count(*) from t_null where data is null;

select count(*) from t_null where data is null or data is not null;

drop table t_nested force;

select
    id,
    case
        when cast(variant_query(variant_from_json, '$.id') as INT) <=> cast(json_query(cast(variant_from_json as json), '$.id') as INT)
         and get_variant_string(variant_from_json, '$.name') <=> cast(json_query(cast(variant_from_json as json), '$.name') as STRING)
        then 'PASS' else 'FAIL' end as status,
    cast(variant_query(variant_from_json, '$.id') as INT) as v_id,
    cast(json_query(cast(variant_from_json as json), '$.id') as INT) as j_id,
    get_variant_string(variant_from_json, '$.name') as v_name,
    cast(json_query(cast(variant_from_json as json), '$.name') as STRING) as j_name
from variant_json_roundtrip
order by id;

insert into variant_json_write
select
    id,
    json_str,
    variant_from_json
from variant_json_roundtrip;

create table plain (id int, v variant) properties ('format-version' = '3');

drop table plain force;

select sum(get_variant_int(v, '$.a')), count(get_variant_int(v, '$.a')), cast(max(get_variant_int(v, '$.a')) as string) from evo;

-- Predicates on a shredded string path (row group statistics apply) and on an integer path.
select count(*), min(id), max(id) from prune where get_variant_string(v, '$.s') = 's001234';

select count(*), sum(id) from prune where variant_query(v, '$.m') is not null and get_variant_int(v, '$.g') = 2;

select count(*), sum(id) from prune_int16 where get_variant_int(v, '$.w') not in (1005, 3995);

-- name: test_iceberg_variant_query_0

-- iceberg catalog on hive does not variant yet.

SELECT
    case_id,
    get_variant_int(variant_from_int, '$')          AS variant_int_value,
    cast(variant_query(variant_from_int, '$') as bigint)          AS variant_int_as_bigint,
    variant_typeof(variant_query(variant_from_float, '$'))          AS variant_float_type,
    variant_typeof(variant_query(variant_from_decimal, '$'))          AS variant_decimal_type,
    CAST(variant_query(variant_from_float, '$') as decimal(22, 8)) as variant_float_value,
    CAST(variant_query(variant_from_decimal, '$') as decimal(22, 8)) as variant_decimal_value,
    get_variant_double(variant_from_float, '$') as variant_float_value2,
    get_variant_double(variant_from_decimal, '$') as variant_decimal_value2,
    get_variant_string(variant_from_string, '$')    AS variant_string_value,
    cast(variant_query(variant_from_string, '$') as string)    AS variant_string_as_string
FROM variant_test_cases
ORDER BY case_id;

SELECT
    case_id,
    CAST(variant_query(variant_mixed, '$.typed.bool_true') AS BOOLEAN)       AS cast_bool_true,
    CAST(variant_query(variant_mixed, '$.typed.bool_false') AS BOOLEAN)      AS cast_bool_false,
    CAST(get_variant_string(variant_mixed, '$.typed.int_as_string') as bigint)   AS cast_bigint_from_string,
    CAST(variant_query(variant_mixed, '$.typed.decimal_text') AS DECIMAL(9, 3)) AS cast_decimal_text,    
    CAST(variant_query(variant_mixed, '$.typed.timestamp_text') AS STRING) AS cast_timestamp,
    CAST(variant_query(variant_mixed, '$.matrix[0][1].val') AS SMALLINT)     AS cast_smallint_nested
FROM variant_test_cases
ORDER BY case_id;

-- ========================================
-- Test 1: Basic Type <-> VARIANT Bidirectional Casting
-- ========================================
SELECT '=== Test 1: Basic Type <-> VARIANT Bidirectional Casting ===' as test_section;

-- ========================================
-- Test 4: ARRAY -> VARIANT Casting
-- ========================================
-- SELECT '=== Test 4: ARRAY -> VARIANT Casting ===' as test_section;

-- -- Test 4.1: Cast ARRAY to VARIANT
-- SELECT
--     id,
--     test_case,
--     array_data,
--     -- Cast ARRAY to VARIANT
--     CAST(array_data AS JSON) as array_as_variant,
--     -- Extract array elements from VARIANT
--     get_json_int(CAST(array_data AS JSON), '$[0].id') as item1_id,
--     get_json_string(CAST(array_data AS JSON), '$[0].name') as item1_name,
--     get_json_double(CAST(array_data AS JSON), '$[0].values[0]') as item1_value1,
--     get_json_string(CAST(array_data AS JSON), '$[0].metadata.status') as item1_status,
--     get_json_string(CAST(array_data AS JSON), '$[0].metadata.priority') as item1_priority
-- FROM variant_test_unified
-- WHERE test_scenario = 'complex_to_variant' AND id = 5;

-- -- Test 4.2: Verify array element counts
-- SELECT
--     id,
--     test_case,
--     -- Extract multiple array elements
--     get_json_int(CAST(array_data AS JSON), '$[0].id') as item1_id,
--     get_json_int(CAST(array_data AS JSON), '$[1].id') as item2_id,
--     get_json_int(CAST(array_data AS JSON), '$[2].id') as item3_id,
--     -- Verify IDs
--     CASE WHEN get_json_int(CAST(array_data AS JSON), '$[0].id') = 1 THEN 'PASS' ELSE 'FAIL' END as item1_check,
--     CASE WHEN get_json_int(CAST(array_data AS JSON), '$[1].id') = 2 THEN 'PASS' ELSE 'FAIL' END as item2_check,
--     CASE WHEN get_json_int(CAST(array_data AS JSON), '$[2].id') = 3 THEN 'PASS' ELSE 'FAIL' END as item3_check
-- FROM variant_test_unified
-- WHERE test_scenario = 'complex_to_variant' AND id = 5;

-- ========================================
-- Test 5: VARIANT -> ARRAY Casting
-- ========================================

SELECT '=== Test 5: VARIANT -> ARRAY Casting ===' as test_section;

-- Test 8.1: E-commerce order deep path extraction
SELECT
    id,
    test_case,
    variant_deep_nested,
    get_variant_string(variant_deep_nested, '$.order.id') as order_id,
    get_variant_string(variant_deep_nested, '$.order.customer.name') as customer_name,
    get_variant_string(variant_deep_nested, '$.order.customer.contact.email') as customer_email,
    get_variant_string(variant_deep_nested, '$.order.customer.contact.address.city') as customer_city,
    CAST(variant_query(variant_deep_nested, '$.order.customer.contact.address.coordinates.lat') as decimal(22, 8)) latitude,
    CAST(variant_query(variant_deep_nested, '$.order.customer.contact.address.coordinates.lng') as decimal(22, 8)) longitude,
    get_variant_string(variant_deep_nested, '$.order.items[0].sku') as item_sku,
    CAST(variant_query(variant_deep_nested, '$.order.items[0].price') as decimal(22, 8)) as item_price,
    get_variant_int(variant_deep_nested, '$.order.items[0].quantity') as item_quantity
FROM variant_test_unified
WHERE test_scenario = 'deep_nested' AND test_case = 'ecommerce_order';

CREATE TABLE variant_boundary_numeric_test (
    test_id INT,
    test_label STRING,
    numeric_type STRING,
    variant_col VARIANT,
    expected_value STRING
)
properties(
  'format-version' = '3'
);

-- ========================================
-- Query 3: Deep Nesting Extraction
-- Test IDs: UNC-3.2.1, UNC-3.2.2, UNC-1.3.1
-- ========================================
SELECT 'Query 3: Validate deep nesting path extraction' AS test_description;

-- ========================================
-- Query 7: BIGINT Boundaries
-- Test IDs: UNC-3.3.3, UNC-3.3.4
-- ========================================
SELECT 'Query 7: Validate BIGINT min/max boundary values' AS test_description;

-- ========================================
-- Query 11: Negative Zero Handling
-- Test ID: UNC-3.3.12
-- ========================================
SELECT 'Query 11: Validate negative zero handling' AS test_description;

drop table variant_boundary_numeric_test force;

-- ========================================
-- P0 Fallback Handling Validation Queries
-- ========================================

-- ========================================
-- Query 1: Invalid Path Returns NULL
-- Test IDs: UNC-2.1.1, UNC-2.1.2, UNC-2.1.3
-- ========================================
SELECT 'Query 1: Validate that invalid paths return NULL' AS test_description;

-- ========================================
-- Query 5: Type Mismatch - Nested Path on Scalar Values
-- Test ID: UNC-2.2.3
-- ========================================
SELECT 'Query 5: Validate nested path on scalar values returns NULL' AS test_description;

-- ========================================
-- Query 9: Variant Type Detection for Error Cases
-- ========================================
SELECT 'Query 9: Verify variant_typeof for various data types' AS test_description;

-- ========================================
-- StarRocks Table Creation for P0 String Extensions
-- ========================================

CREATE TABLE variant_string_unicode_test (
    test_id INT,
    test_label STRING,
    expected_value STRING,
    variant_col VARIANT
)
properties(
  'format-version' = '3'
);

SELECT
    test_id,
    test_label,
    get_variant_string(variant_col, '$') as extracted_value,
    expected_value,
    CASE
        WHEN get_variant_string(variant_col, '$') = expected_value THEN 'PASS'
        ELSE 'FAIL'
    END as test_result,
    variant_typeof(variant_query(variant_col, '$')) as value_type
FROM variant_string_unicode_test
ORDER BY test_id;

SELECT
    test_id,
    test_label,
    CAST(variant_col AS VARCHAR(1000)) as cast_result,
    CASE
        WHEN CAST(variant_col AS VARCHAR(1000)) = expected_value THEN 'PASS'
        ELSE 'FAIL'
    END as test_result
FROM variant_string_unicode_test
WHERE test_id <= 7  -- Skip very long strings for VARCHAR cast
ORDER BY test_id;

-- ========================================
-- Query 3: WHERE Clause - LIKE Pattern Match
-- Test ID: UNC-5.1.3
-- ========================================
SELECT 'Query 3: Filter by VARIANT string LIKE pattern' AS test_description;

-- ========================================
-- Query 7: Aggregation - COUNT
-- Test ID: UNC-5.2.1
-- ========================================
SELECT 'Query 7: COUNT aggregation on VARIANT column' AS test_description;

-- ========================================
-- Query 11: GROUP BY on VARIANT Field
-- Test ID: UNC-5.3.1
-- ========================================
SELECT 'Query 11: GROUP BY on VARIANT extracted field' AS test_description;

-- ========================================
-- Query 15: Real-World Analytics - Log Error Analysis
-- Test ID: UNC-5.5.1
-- ========================================
SELECT 'Query 15: Analyze error logs by type and service' AS test_description;

-- ========================================
-- Query 19: Event Distribution by Type
-- ========================================
SELECT 'Query 19: Event type distribution and metrics' AS test_description;

-- name: test_iceberg_variant_spark_shredding
-- Reads VARIANT data files written with Iceberg 1.12 from the same rows: by Spark 4.1 shredded
-- (write.parquet.shred-variants=true) and unshredded, and by the plain Iceberg Java API shredded
-- (GenericFileWriterFactory). The files and the script that generates them live in
-- be/test/formats/parquet/test_data/variant_spark/ (gen_variant_spark.sh); expected_variant_spark.tsv there
-- holds Spark's answers for the per-path query below. Every query must return the same rows on all tables.

select count(*), count(v), min(id), max(id) from noshred;

select id, get_variant_int(v, '$.i'), get_variant_string(v, '$.i'), get_variant_string(v, '$.s'), get_variant_int(v, '$.x')
from shred where id in (101, 200, 201, 250) order by id;

select id, data, get_variant_string(data, '$.kind') from t_nested order by id;

select get_variant_int(data, '$.id') as id,
       get_variant_string(data, '$.profile.department') as dept
from test_variant_virtual_column
order by id;

select count(*) from test_variant_virtual_column
where get_variant_int(data, '$.profile.metrics.views') < 0;

-- predicate pushdown correctness: nested DOUBLE (ratio) partial match → 3 rows
select count(*) from test_variant_virtual_column
where get_variant_double(data, '$.profile.metrics.ratio') >= 0.2;

-- DECIMAL widening correctness: typed decimal leaf widened to a compatible target decimal
select cast(variant_query(data, '$.profile.price') as decimal(10, 2)) as price_wide
from test_variant_virtual_column
order by price_wide;

-- predicate pushdown correctness: DATE in-range partial → 3 rows
select get_variant_date(data, '$.created_at') as created_at
from test_variant_virtual_column
where get_variant_date(data, '$.created_at') >= '2024-01-03'
order by created_at;

drop table variant_source force;

-- expected: 1 7 (initial-default), 2 7, 3 8, 4 NULL
select id, c from t order by id;

-- Per-column modes: c1 full, c2 none, c3 counts, c4 truncate(4); c5 gets the inferred default truncate(16).
create table t1 (c1 int, c2 int, c3 int, c4 string, c5 string) properties (
    "write.metadata.metrics.column.c1" = "full",
    "write.metadata.metrics.column.c2" = "none",
    "write.metadata.metrics.column.c3" = "counts",
    "write.metadata.metrics.column.c4" = "truncate(4)"
);

-- max-inferred-column-defaults = 1: only c1 gets the default truncate(16), c2 gets none.
create table t3 (c1 int, c2 int) properties ("write.metadata.metrics.max-inferred-column-defaults" = "1");

insert into t5 values (1, 'a'), (2, 'b');

-- ============================================================
-- Setup: shredded variant table (typed shredded fields)
-- ============================================================
CREATE TABLE test_shredding (
    data VARIANT,
    id BIGINT,
    age INT,
    city VARCHAR
) properties(
  'format-version' = '3',
  'iceberg.enableVariantShredding' = 'true'
);

-- ============================================================
-- Test 5: Multiple lazy variant fields in SELECT, predicate only on one.
-- $.name and $.email stay lazy until backfill phase; $.id triggered by predicate.
-- ============================================================
SELECT get_variant_int(data, '$.id') as vid,
       get_variant_string(data, '$.name') as vname,
       get_variant_string(data, '$.email') as vemail
FROM test_shredding
WHERE get_variant_int(data, '$.id') > 1000
ORDER BY vid;

-- Cleanup

drop table test_shredding force;

-- add table properties
alter table payment set  ("unique_constraints" = "id");

SET enable_cbo_table_prune=false;

use  test_gin_index;

-- exact match
select * from t1_primary where value match 'hello';

-- wildcard match with leading %
select * from t1_primary where value match '%hello';

show create table t2_dup;

-- wait for index creation to finish

show create table t2_primary;

-- builtin 变体：imp_lib=builtin，覆盖 builtin 版本的 NOT MATCH 同样排除 NULL 行
CREATE TABLE t_null_builtin (
    id int NOT NULL,
    c  varchar(30) NULL,
    INDEX idx_c (c) USING GIN ("imp_lib" = "builtin", "parser" = "none")
)
DUPLICATE KEY(id)
DISTRIBUTED BY HASH(id) BUCKETS 1
PROPERTIES ("replication_num" = "1");

-- case-insensitive (default behavior): lower_case=true
CREATE TABLE t_gin_lc_ci (
  k bigint(20) NULL COMMENT "",
  msg varchar(100) NULL COMMENT "",
  INDEX idx_msg (msg) USING GIN("imp_lib"="builtin","parser"="english","lower_case"="true") COMMENT ''
) ENGINE=OLAP DUPLICATE KEY(k) DISTRIBUTED BY HASH(k) BUCKETS 1
PROPERTIES ("replication_num"="1");

SELECT k FROM t_gin_lc_ci WHERE msg MATCH 'Hello' ORDER BY k;

INSERT INTO t_gin_lc_default VALUES (1,'Hello World');

ALTER TABLE ngram_index ADD INDEX idx_name1(username) USING NGRAMBF ('gram_num' = "4", "bloom_filter_fpp" = "0.01");

ALTER TABLE ngram_index_case_in_sensitive ADD INDEX idx_name1(Username) USING NGRAMBF ('gram_num' = "4", "bloom_filter_fpp" = "0.01");

-- name: test_ngram_bloom_filter_not_like_absent
CREATE TABLE indexed_strings (
    id INT NOT NULL,
    content VARCHAR(100),
    INDEX idx_content(content) USING NGRAMBF ("gram_num"="4", "case_sensitive"="true", "bloom_filter_fpp"="0.01")
) DUPLICATE KEY(id) DISTRIBUTED BY HASH(id) BUCKETS 1 PROPERTIES ("replication_num"="1");

SELECT sum(content NOT LIKE '%30:30%') FROM indexed_strings;

SELECT count(*) FROM null_strings WHERE content NOT LIKE '%30:30%';

SELECT count(*) FROM mixed_strings WHERE content LIKE '%30:30%';

SELECT count(*) FROM mixed_strings WHERE content NOT LIKE '%missing%' OR content LIKE '%absent%';

SELECT count(*) FROM matching_strings WHERE content LIKE '%30:30%';

SELECT count(*) FROM insensitive_strings WHERE content NOT LIKE '%MISSING%';

-- 32K distinct values span data pages. The first half
-- contains no matching gram; the second half contains the target substring.
INSERT INTO indexed_pages
SELECT generate_series,
       concat(lpad(cast(generate_series AS VARCHAR), 10, '0'), repeat('x', 240),
              if(generate_series < 16384, 'alpha', '30:30'))
FROM TABLE(generate_series(0, 32767));

-- A later load adds a separate rowset with no matching gram.
INSERT INTO indexed_pages VALUES (32768, 'tail-no-match');

-- NULL needle must propagate as a NULL result.

CREATE TABLE t_ngram_null (
    haystack VARCHAR(100),
    needle   VARCHAR(100)
) PROPERTIES ("replication_num" = "1");

-- Non-constant needle must not be pushed down to the ngram bloom filter index.
-- The query must still return correct results even when an index exists on haystack column.
CREATE TABLE t_ngram_idx (
    haystack VARCHAR(100) NOT NULL,
    needle   VARCHAR(100) NOT NULL,
    INDEX idx_haystack(haystack) USING NGRAMBF ("gram_num" = "4", "bloom_filter_fpp" = "0.05")
) PROPERTIES ("replication_num" = "1");

SELECT * FROM information_schema.applicable_roles WHERE IS_MANDATORY = 'NO';

-- name: test_update_be_configs
UPDATE information_schema.be_configs SET VALUE = 'INFO' WHERE name = "sys_log_level";

-- DATETIME_PRECISION must be non-NULL for DATETIME columns so MySQL-protocol
-- clients (e.g. Trino's mysql connector) can derive COLUMN_SIZE; DATE and
-- non-temporal columns stay NULL.
select COLUMN_NAME, DATA_TYPE, DATETIME_PRECISION
from INFORMATION_SCHEMA.COLUMNS
where table_name = 'test_column_datetime_precision' order by ORDINAL_POSITION;

-- name: test_external_catalog_information_schema_pattern

select TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, COLUMN_TYPE from information_schema.columns where table_name like 'a_est' order by COLUMN_NAME;

-- Test 8: Check for common JVM thread names
select count(*) > 0 from information_schema.fe_threads 
where thread_name like '%main%' 
   or thread_name like '%GC%' 
   or thread_name like '%Finalizer%'
   or thread_name like '%Reference Handler%'
   or thread_name like '%RMI%';

select thread_name from information_schema.fe_threads order by user_time_ms desc limit 3;

select * from information_schema.load_tracking_logs where label="not exist";

-- A partition-scoped (partial) refresh must NOT confirm whole-MV freshness.
create table pt (dt date, v int) duplicate key(dt)
partition by range(dt) (partition p1 values [('2024-01-01'),('2024-01-02')), partition p2 values [('2024-01-02'),('2024-01-03')))
distributed by hash(dt) buckets 2 properties('replication_num'='1');

-- mv on view
create view v1 as select * from t1;

alter materialized view mv1 active;

-- name: test_task_run_status

use test_information_schema_task_runs;

-- partial INSERT omitting the GIN-indexed column must succeed (regression: used to hang/fail)
insert into t_gin (pk, v1) values (1, 111), (3, 300);

create table t1(k1 int);

create table t2(k int) 
distributed by hash(k) buckets 96;

INSERT INTO t_gin_upper_key VALUES (1, 'hello world'), (2, 'goodbye world');

set cbo_enable_low_cardinality_optimize = false;

CREATE TABLE `t_alter_gin_col_into_other_type` (
  `id` bigint(20) NOT NULL COMMENT "",
  `v1` varchar(255) NULL COMMENT "",
  INDEX gin_none (`v1`) USING GIN ("parser" = "english")
) ENGINE=OLAP
DUPLICATE KEY(`id`)
DISTRIBUTED BY HASH(`id`) BUCKETS 1
PROPERTIES (
"replication_num" = "1",
"enable_persistent_index" = "true",
"replicated_storage" = "false",
"compression" = "LZ4"
);

INSERT INTO t_gin_var VALUES (1, "abc bcd");

INSERT INTO t_gin_view VALUES (1, "abd bcd");

insert into duplicate_table_demo_datatype_not_replicated_all_varchar values ('1974-08-20 23:13:25', 'xIjfSXnegdnZiZGQMaxo', 'syHwIOMctmDLDGCibEun', 'hIbilUEGdLbCnaZASCVL', 6299, 25361.52081, 'QuTsacRyxiIkBjEmjhNu', -11.4812925061712, True, 'QcLRdQJMhtPXojJUjkUd', 'yUeFlbzomaPDwKeaHylx', 'WqQyGEjEYpvLzfBXYUCB', '', 8, '2015-11-03 16:31:47', [2621, 5950, 13171], '{"job": "Administrator, Civil Service", "company": "Morris-Anderson", "ssn": "823-67-5554", "residence": "59688 Hanna Shoal Apt. 586\nWest Waynefort, CO 69652", "current_location": ["-64.3777465", "21.079566"], "blood_group": "O-", "website": ["http://young.biz/", "https://cobb-bell.com/", "http://www.roberts-garrison.com/", "http://jones.com/"], "username": "howardarcher", "name": "John Mccullough", "sex": "M", "address": "1361 Susan Mountain\nJasonbury, MI 85084", "mail": "lovejennifer@gmail.com", "birthdate": "1928-06-25"}', null, null);

SELECT id1 FROM t_gin_like_underscore WHERE text_column LIKE "a_%" ORDER BY id1;

INSERT INTO t_lw_gin
SELECT generate_series,
       CASE WHEN generate_series < 100 THEN 'alpha needleold gamma'
            ELSE concat('alpha hay gamma ', cast(generate_series as string))
       END
FROM TABLE(generate_series(0, 99999));

SELECT tokenize('standard', 'hello world');

-- A constant that tokenizes to nothing has to be NULL for every row, not for one row.
select array_length(tokenize('english', '')) as n from t_tokenized_table;

CREATE TABLE IF NOT EXISTS `jit_basic` (
	k1 BIGINT, 
	k2 BIGINT, 
	v1 BIGINT REPLACE, 
	v2 BIGINT REPLACE, 
	v3 BIGINT REPLACE,
	v4 BIGINT REPLACE, 
	v5 BIGINT REPLACE, 
	v6 BIGINT REPLACE,
	v7 BIGINT REPLACE,
	v8 BIGINT REPLACE,
	v9 BIGINT REPLACE
) 
ENGINE = olap 
AGGREGATE KEY(k1, k2) 
DISTRIBUTED BY HASH(k1) BUCKETS 10 
PROPERTIES( 
	"replication_num" = "1" 
);

SELECT v1 + v2 + v3 + v4 + v5 + v6 as result FROM jit_basic ORDER BY result;

SELECT v1 - v3 + v5 + v7 - v9 as result FROM jit_basic ORDER BY result;

SELECT v1 * v3 * v5 * v7 - v9 as result FROM jit_basic ORDER BY result;

SELECT (v1 * v2) - (v3 + 0) - (v6 * 0) as result FROM jit_basic ORDER BY result;

-- hard
select bitnot(cast(power(-2,127) as largeint)+1);

SELECT min(((1 / 1) % 1) * 1) from jit_basic;

insert into t values (0,0,0,0),(1,1,1,1),(2,2,null,null),(3,3,30,null),(4,4,null,40),(0,1,null,null),(0,0,null,1),(10,10,null,10);

select case when null then null when 0 then null when 1 then null else null end as cc from t order by 1;

select case null when 0 then int0 when 1 then int1 when 2 then null when 3 then null end as cc from t order by 1;

select case nint0 when case int0 when case when case when int0 < 2 then -2 when nint0 is null then 1 else nint1 end then -2 when int0 then int1 when nint0 then nint1 else false end then nint0 when 1 then nint1 when 2 then null when 3 then null end then int0 when 1 then int1 when 2 then null when 3 then null end as cc from t order by 1;

-- can jit on sort
select int0 from t order by int0 + int1, nint0 * int1;

insert into dict values(3, 'hello world 3', default, 3 * 10);

insert into t1 values (null, 1, 1), (2, null, null), (3, 3, null), (4, 4, 4), (5, 5, 5), (6, 6, 6), (null, null, null), (7, 7, 7), (8, 8, 8);

select count(*) from t0 left join t1 on exists (select v7 from t2 where v8 = v4) or v1 < v5;

-- Insert enough rows to trigger multi-partition build and subsequent merge_ht call.
insert into expr_join_ta SELECT generate_series, cast(generate_series as varchar) FROM TABLE(generate_series(1, 40960));

-- Empty-join pruning replaces joined_value with NULL. Project merging must fold
-- the resulting NULL = 'foo' comparison inside the CASE expression.
select group_key,
       case
           when joined_value = 'foo' and input_value <> 0 then joined_number
           else cast(0.0 as double)
       end = 0.0 as is_zero
from (
    select source.group_key,
           source.input_value,
           empty_side.joined_value,
           empty_side.joined_number
    from t0 source
    left outer join (
        select join_key,
               'foo' as joined_value,
               cast(input_value as double) as joined_number
        from t0
        where 1 = 0
    ) empty_side on empty_side.join_key = source.join_key
) projected
order by group_key;

-- null-aware left anti join
select count(*) from (select * from t0 where c0 not in (select c0 from t1)) t;

select * from nullaware_anti_join_test l1 where l1.k1 not in ( select l3.k1 from nullaware_anti_join_test l3 where  l3.k3 != l1.k3 ) order by 1,2,3;

-- name: test_full_join_empty_side_having

-- A FULL OUTER JOIN with an empty side becomes a projection whose columns from that side are NULL
-- constants. Grouped on such a column, the key is constant and PruneGroupByKeysRule removed it,
-- writing the constant into the HAVING predicate in its place: `b.s <> a.s` became `NULL <> a.s`,
-- with the constant on the left. Statistics estimation refuses that shape, and every such query failed
-- with "Constant-cmp-Column not supported here". A HAVING that compares the two sides on its own is
-- pushed below the aggregate earlier, so only one combined with an aggregate under OR stayed to fail.

create table t_left (k int, s varchar(10), x double)
duplicate key(k) distributed by hash(k) buckets 1 properties("replication_num" = "1");

-- name: test_join_linear_chained @sequential @slow

set enable_hash_join_range_direct_mapping_opt = false;

select count(tt1.k1), count(tt2.k1) from t1 tt1 join t1 tt2 using(c_int);

select count(tt1.c_string) from t1 tt1 join t1 tt2 using(c_string) where tt1.k1 % 100 = 0;

select count(tt1.k1) from t1 tt1 left semi join t1 tt2 using(c_int) where tt1.k1 % 2 = 0;

select count(tt1.k1) from t1 tt1 left semi join t1 tt2 on tt1.c_int=tt2.c_int and tt1.c_bigint=tt2.c_bigint and tt1.c_string=tt2.c_string;

select count(tt1.k1), count(tt2.k1) from t1 tt1 left outer join t1 tt2 using(c_int) where tt1.k1 % 100 = 0;

select count(tt1.k1), count(tt2.k1) from t1 tt1 left outer join t1 tt2 on -tt1.c_int=tt2.c_int;

-- UNION on both sides
select count(*) from (select id from ja union select id from ja) y
  join (select id from jb union select id from jb) z on y.id = z.id;

-- control: a join key that is not the distribution key, so neither side can claim the bucket
-- transform and both take the plain hash
select count(*) from (select g from ja union select g from ja) z join jb on z.g = jb.g;

-- both knobs at once
set enable_wait_dependent_event = true;

select count(*), min(fa.id), max(fa.id), sum(fa.id) from fa join [bucket] fb on fa.id = fb.id;

select count(*) from fa join [shuffle] fb on fa.id = fb.id;

insert into map_test values (4, null,null,null,null,null,null);

select t.map0, s.map5 from map_test t join map_test s where s.map0 = t.map5 order by t.pk;

select t.map3, s.map4 from map_test t join map_test s where s.map3 = t.map4 order by t.pk;

select t.map3, s.map5 from map_test t join map_test s where s.map3 <=> t.map5 order by t.pk;

select map3 from map_test t where exists (select 1 from map_test s where t.map3 = s.map3) order by t.pk;

select map5 from map_test t where map5 in (select map5 from map_test s) order by t.pk;

select map4 not in (select map5 from map_test s) from map_test order by 1;

select t.map4, s.map4 from map_test t right join map_test s on s.map4 = t.map4 order by t.pk;

select t.map2, s.map5 from map_test t full join map_test s on s.map2 = t.map5 order by t.pk;

insert into t1 
select
    idx,

    idx % 2 = 0, -- c_bool
    if (idx % 7 = 0, idx % 2 = 0, null),

    idx % 128, -- c_tinyint
    if (idx % 12 = 0, idx % 128, null),

    idx % 32768, -- c_smallint
    if (idx % 13 = 0, idx % 32768, null),

    idx / 2, -- c_int
    if (idx % 14 = 0, idx, null),

    idx / 2, -- c_bigint
    if (idx % 15 = 0, idx, null),

    idx / 2, -- c_largeint
    if (idx % 16 = 0, idx, null),

    idx / 2, -- c_float
    if (idx % 17 = 0, idx, null),

    idx / 2, -- c_double
    if (idx % 18 = 0, idx, null),

    idx / 2, -- c_decimalv2
    if (idx % 23 = 0, idx, null),

    idx / 2, -- c_decimal32
    if (idx % 24 = 0,idx, null),

    idx / 2, -- c_decimal64
    if (idx % 25 = 0, idx, null),

    idx / 2, -- c_decimal128
    if (idx % 26 = 0, idx, null),

    date_add('2023-01-01', idx / 2), -- c_date
    if (idx % 19 = 0, date_add('2023-01-01', idx), null),

    date_add('2023-01-01 00:00:00', idx / 2), -- c_datetime
    if (idx % 20 = 0, date_add('2023-01-01 00:00:00', idx), null),

    concat('char_', idx / 2), -- c_char
    if (idx % 21 = 0, concat('char_', idx), null),

    concat('varchar_', idx / 2), -- c_varchar
    if (idx % 22 = 0, concat('varchar_', idx), null)

from __row_util;

with w1 as (select * from t1 where k1 < 10000)
select count(1), count(t1.k1), count(t1.c_smallint_null)
from t1 full join w1 t2 on t1.c_smallint_null = t2.c_smallint_null;

-- c_bigint
select count(1), count(t1.k1), count(t1.c_bigint)
from t1 join t1 t2 on t1.c_bigint = t2.c_bigint;

select count(1), count(t1.k1), count(t1.c_largeint)
from t1 left semi join t1 t2 on t1.c_float = t2.c_float;

select count(1), count(t1.k1), count(t1.c_float_null)
from t1 full join t1 t2 on t1.c_float_null = t2.c_float_null;

-- c_decimalv2
select count(1), count(t1.k1), count(t1.c_decimalv2)
from t1 join t1 t2 on t1.c_decimalv2 = t2.c_decimalv2;

select count(1), count(t1.k1), count(t1.c_decimal32)
from t1 left semi join t1 t2 on t1.c_float = t2.c_float;

select count(1), count(t1.k1), count(t1.c_decimal64_null)
from t1 full join t1 t2 on t1.c_decimal64_null = t2.c_decimal64_null;

-- c_date
select count(1), count(t1.k1), count(t1.c_date)
from t1 join t1 t2 on t1.c_date = t2.c_date;

select count(1), count(t1.k1), count(t1.c_datetime)
from t1 left semi join t1 t2 on t1.c_float = t2.c_float;

select count(1), count(t1.k1), count(t1.c_char_null)
from t1 full join t1 t2 on t1.c_char_null = t2.c_char_null;

-- name: test_join_range_direct_mapping @sequential @slow

CREATE TABLE __row_util_base (
  k1 bigint NULL
) ENGINE=OLAP
DUPLICATE KEY(`k1`)
DISTRIBUTED BY HASH(`k1`) BUCKETS 32
PROPERTIES (
    "replication_num" = "1"
);

with w1 as (
    select * from t1 union all select * from t1
)
SELECT count(t1.c_int), count(t1.c_bigint), count(t2.c_int), count(t2.c_bigint)
FROM w1 t1 JOIN [broadcast] w1 t2 on t1.c_int = t2.c_int;

with w1 as (
    select * from t1 union all select * from t1
)
SELECT count(t1.c_int), count(t1.c_bigint), count(t2.c_int), count(t2.c_bigint)
FROM w1 t1 JOIN [broadcast] w1 t2 on t1.c_bigint = t2.c_bigint where t2.c_int % 10 != 0;

-- # DENSE_RANGE_DIRECT_MAPPING for LEFT SEMI JOIN
-- ## All rows
-- ### no duplicated key
SELECT count(t1.c_int), count(t1.c_bigint)
FROM t1 LEFT SEMI JOIN [broadcast] t1 t2 on t1.c_int = t2.c_int;

SELECT count(t1.c_int), count(t1.c_bigint)
FROM t1 LEFT ANTI JOIN [broadcast] t1 t2 on t1.c_bigint = t2.c_bigint;

CREATE TABLE `t1` (
  `c0` int(11) NULL COMMENT "",
  `c1` varchar(20) NULL COMMENT "",
  `c2` varchar(200) NULL COMMENT "",
  `c3` int(11) NULL COMMENT ""
) ENGINE=OLAP
DUPLICATE KEY(`c0`, `c1`)
COMMENT "OLAP"
DISTRIBUTED BY HASH(`c0`, `c1`) BUCKETS 48
PROPERTIES (
"replication_num" = "1"
);

INSERT INTO d VALUES (1, 10), (2, 20);

INSERT INTO t_a VALUES (1, 1, 10), (1, 1, 5), (1, 2, 7), (2, 1, 3), (NULL, 1, 4), (3, 3, 1);

-- name: test_partition_hash_join @sequential

CREATE TABLE __row_util_base (
  k1 bigint NULL
) ENGINE=OLAP
DUPLICATE KEY(`k1`)
DISTRIBUTED BY HASH(`k1`) BUCKETS 32
PROPERTIES (
    "replication_num" = "1"
);

select count(tt1.k1) from t1 tt1 join [broadcast] t1 tt2 using(c_bigint_null) where tt1.k1 % 5 = 0;

select count(tt2.c_string) from t1 tt1 join [broadcast] t1 tt2 using(c_bigint_null) where tt1.k1 % 2 = 0;

-- name: test_skew_join

CREATE TABLE t1 (
    c_key      INT NOT NULL,
    c_tinyint  TINYINT,
    c_smallint SMALLINT,
    c_int      INT,
    c_bigint   BIGINT,
    c_largeint LARGEINT,
    c_float    FLOAT,
    c_double   DOUBLE,
    c_decimal  DECIMAL(26,2),
    c_date     DATE,
    c_datetime DATETIME,
    c_string   STRING
)
DUPLICATE KEY(c_key)
DISTRIBUTED BY HASH(c_key) BUCKETS 1
PROPERTIES (
    "replication_num"="1"
);

select t1.c_key, t2.c_key from t2 join [skew|t1.c_tinyint(1,2,8)] t1 on t1.c_tinyint=t2.c_tinyint order by t1.c_key, t2.c_key;

select t1.c_key, t2.c_key from t1 left join [skew|t1.c_smallint(1,1111,4444)] t2 on t1.c_smallint=t2.c_smallint order by t1.c_key, t2.c_key;

select t1.c_key, t2.c_key from t2 left join [skew|t1.c_int(1,1234567,4444)] t1 on t1.c_int=t2.c_int order by t1.c_key, t2.c_key;

-- largeint
truncate table t1;

insert into t1(c_key, c_float) values (1, 1.1), (2, 1.1), (3, 1.1), (4, 2.1), (5, 2.1), (6, 3);

insert into t2(c_key, c_double) values (1, 1.1), (2, 2.1), (3, 3);

select t1.c_key, t2.c_key from t1 join [skew|t1.c_decimal(1.1,2.1,4444)] t2 on t1.c_decimal=t2.c_decimal order by t1.c_key, t2.c_key;

select t1.c_key, t2.c_key from t2 join [skew|t1.c_date("2024-01-01","2024-01-02","2024-01-04")] t1 on t1.c_date=t2.c_date order by t1.c_key, t2.c_key;

select t1.c_key, t2.c_key from t1 left join [skew|t1.c_datetime("2024-01-01 00:00:00","2024-01-02","2024-01-04")] t2 on t1.c_datetime=t2.c_datetime order by t1.c_key, t2.c_key;

select t1.c_key, t2.c_key from t2 left join [skew|t1.c_string("1","1234567","4444")] t1 on t1.c_string=t2.c_string order by t1.c_key, t2.c_key;

select t1.c_key, t2.c_key from t1 join [skew|t1.c_bigint(1,2,99999)] t2 on t1.c_bigint=t2.c_int order by t1.c_key, t2.c_key;

select t1.c_key, t2.c_key from t2 left join [skew|t1.c_string("1","2","99999")] t1 on t1.c_string=t2.c_int order by t1.c_key, t2.c_key;

-- The rewrite salts the skewed child and replicates the OTHER child once per salt value. Naming the
-- skew column on sj_build puts the skewed child on the right, so the child being replicated is
-- sj_probe -- the preserved side of the left outer join. Every replica that matches nothing emits
-- its own null-padded row, so each skew-valued probe row used to come back up to
-- skew_join_rand_range + 1 times and the count moved with rand() between runs.
select count(*) from sj_probe left join [skew|sj_build.c_val(7)] sj_build on sj_build.c_val = sj_probe.c_val;

-- on predicate with complex expr
select t1.c_key, t2.c_key from t2 join [skew|t2.c_int(1,2,99999)] t1 on abs(t1.c_bigint)=abs(t2.c_int) order by t1.c_key, t2.c_key;

-- NULL-only skew: expect IS NULL / IS NOT NULL split without relying on IN-list.
select count(*) from t1 left join [skew|t1.c_bigint(null)] t2 on abs(t1.c_bigint)=abs(t2.c_int);

select t1.c_key, t2.c_key from t2 join [skew|t1.c_bigint(1,2,99999)] t1 on t1.c_bigint=t2.c_int order by t1.c_key, t2.c_key limit 2;

select t1.c_key, t2.c_key from t2 join [skew|t1.c_bigint(1,1234567,3)] t1 on t1.c_bigint=t2.c_int order by t1.c_key, t2.c_key;

select t1.c_key, t2.c_key from t2 left join [skew|t1.c_bigint(1,1234567,3,4)] t1 on t1.c_bigint=t2.c_int order by t1.c_key, t2.c_key;

CREATE TABLE skew_t1 (
    c_key      INT NOT NULL,
    c_tinyint  TINYINT,
    c_smallint SMALLINT,
    c_int      INT,
    c_bigint   BIGINT,
    c_largeint LARGEINT,
    c_float    FLOAT,
    c_double   DOUBLE,
    c_decimal  DECIMAL(26,2),
    c_date     DATE,
    c_datetime DATETIME,
    c_string   STRING
)
DUPLICATE KEY(c_key)
DISTRIBUTED BY HASH(c_key) BUCKETS 1
PROPERTIES (
    "replication_num"="1"
);

select count(1) from skew_t1 as t1 join [skew|t1.c_bigint(1,2,99999)] t2 on t1.c_smallint=t2.c_smallint;

select count(1) from skew_t1 as t1 left join [skew|t1.c_bigint(1,2,99999)] t2 on t1.c_bigint=t2.c_int;

select count(1) from skew_t1 as t1 left join [skew|t1.c_bigint(1,2,99999)] t2 on t1.c_decimal=t2.c_decimal;

set enable_stats_to_optimize_skew_join = true;

insert into t_mcv_l select generate_series + 2, 1 from table(generate_series(1, 2500));

-- Expression join key (MCV propagation through expression stats): (k + 10) => IN (11, 12)
with l as (select (cast(k as bigint) + 10) as k2, v from t_mcv_l), r as (select (cast(k as bigint) + 10) as k2, v from t_mcv_r) select count(*) from l join[shuffle] r on l.k2 = r.k2;

-- Left table: near-uniform keys 1..10000
insert into t_mcv_l2 select generate_series, 1 from table(generate_series(1, 10000));

-- LEFT OUTER JOIN forbids right-side skew rewrite => should not rewrite
select count(*) from t_mcv_l2 left join[shuffle] t_mcv_r2 on t_mcv_l2.k = t_mcv_r2.k;

insert into t_null_l select 1, 1 from table(generate_series(1, 2000));

drop table t_null_l;

insert into t_or_b values (1,5,1),(2,6,2),(9,2,3);

select x.v3 + 1000 c3, b.v6 + 2000 c6, x.v1 + 3000 c1, b.v4 + 4000 c4 from (select v1, v2, v3, v1 + 0 as p0, v1 + 1 as p1, v1 + 2 as p2, v1 + 3 as p3, v1 + 4 as p4, v1 + 5 as p5 from t_or_a) x join t_or_b b on x.v1 = b.v4 or x.v2 = b.v5 order by 1, 2, 3, 4;

select x.v3 + 1000 c3, b.v6 + 2000 c6, x.v1 + 3000 c1, b.v4 + 4000 c4 from (select v1, v2, v3, v1 + 0 as p0, v1 + 1 as p1, v1 + 2 as p2, v1 + 3 as p3, v1 + 4 as p4, v1 + 5 as p5, v1 + 6 as p6, v1 + 7 as p7, v1 + 8 as p8, v1 + 9 as p9, v1 + 10 as p10, v1 + 11 as p11, v1 + 12 as p12, v1 + 13 as p13 from t_or_a) x join t_or_b b on x.v1 = b.v4 or x.v2 = b.v5 order by 1, 2, 3, 4;

select cast(json_query(j,'$.o') as string) from t order by id limit 2;

SET cbo_prune_json_subfield=false;

ALTER TABLE t SET ("base_compaction_forbidden_time_ranges"="");

USE test_invalid_json;

SELECT CAST(regexp_extract(get_query_profile(last_query_id()), 'TableFunctionExecCount: ([0-9]+)', 1) AS BIGINT) >= 10;

-- 1. Simple Object
SELECT json_pretty('{"a": 1, "b": 2}');

-- 8. Numbers Formatting
SELECT json_pretty('{"int": 123, "float": 12.34}');

CREATE DATABASE test_json_subfield_case_collision;

-- min/max exercises the global-dict path over the colliding pair (previously "Dict Decode failed").
SELECT min(get_json_string(fields, 'Campaign')) AS mn_caps,
       max(get_json_string(fields, 'Campaign')) AS mx_caps,
       min(get_json_string(fields, 'campaign')) AS mn_low,
       max(get_json_string(fields, 'campaign')) AS mx_low
FROM activity;

-- 'Campaign' (via t1) and 'campaign' (via t2) address two distinct fields and must return their own
-- values: caps = CAP1/CAP2, low = low1/low2. Before the cross-scan guard, caps came back as low1/low2.
SELECT t1.id AS id,
       get_json_string(t1.fields, 'Campaign') AS caps,
       get_json_string(t2.fields, 'campaign') AS low
FROM t t1 JOIN t t2 ON t1.id = t2.id
ORDER BY t1.id;

select count(*) from t where get_json_string(j, 'f2') = 'hello';

-- A LIKE predicate on the string form of $.c while the other scan reads it as an int. This is the
-- shape that crashed the backend, so reaching the result at all is most of the assertion.
select a.k from t a join t b on a.k + 1 = b.k
  where get_json_string(a.j, '$.c') like 'str%' and get_json_int(b.j, '$.c') > 3
  order by a.k;

select k, get_json_string(j, '$.a') as as_str from base order by k;

insert into t values
  (1, parse_json('{"x":1,"y":"s1"}')),
  (2, parse_json('{"x":"s2","y":"s2"}')),
  (3, parse_json('{"x":3,"y":"s3"}'));

select count(*) as str_cnt from t where get_json_string(j, '$.x') = 's2';

-- Control: with the rewrite off both answers must be identical.
set cbo_json_v2_rewrite = false;

-- (b') dotted-key predicate -> must NOT drop rows. Correct answer = 2.
set cbo_prune_json_subfield = false;

-- Three subfields (still a multi-child tree): must also complete.
SELECT length(dict_merge(get_json_string(fields, 'Campaign'), 255)) a,
       length(dict_merge(get_json_string(fields, 'campaign'), 255)) b,
       length(dict_merge(get_json_string(fields, 'title'), 255)) c
FROM t [_META_];

insert into t_dst select id, parse_json(s) from t_pj;

insert into edge values
 (1, '{"a": 1, "b": "x", "c": {"d": [1, 2, {"e": null}]}}'),
 (2, '{"a": 9223372036854775807, "b": 1.5e308, "c": 18446744073709551615}'),
 (3, '{"a": "line\\nbreak \\u00e9 \\"q\\"", "b": true, "c": false}'),
 (4, '[{"a": 1}, {"a": 2}]'),
 (5, 'not json at all'),
 (6, '{"a": 1,'),
 (7, ''),
 (8, NULL),
 (9, '   {"a" : "  spaced  " }   '),
 (10, '"just a string"'),
 (11, '123'),
 (12, '{"a": {"b": {"c": "deep"}}, "b": [], "c": {}}'),
 (13, '{"a": 1, "a": 2}'),
 (14, '{"": "empty key", "a.b": "dotted"}');

select id, get_json_string(doc, '$.a'), get_json_int(doc, '$.b'), get_json_double(doc, '$.c') from t order by id;

create table t (id int, j json) duplicate key(id) distributed by hash(id) buckets 1 properties('replication_num' = '1');

INSERT INTO t0 VALUES (1, NULL);

INSERT INTO tbl1
VALUES
    ("2020-01-12",4,100),
    ("2020-01-11",5,100),
    ("2020-01-11",4,100);

-- name: test_late_materialize_struct_subfield_predicate
CREATE TABLE src (
  v1 bigint,
  str string,
  s1 struct<s1 int>
) DUPLICATE KEY(v1)
DISTRIBUTED BY HASH(v1) BUCKETS 3
PROPERTIES ("replication_num" = "1");

-- each predicate alone reads the column through the ordinary path
select v1 from scs where str = 'dd' order by v1 limit 3;

select c0, lag(c1, 5) over() from common_duplicate;

select c0, lead(c2, 5, day('2021-01-02')) over() from common_duplicate;

select c0, lead(c6, 5, '2021-11-11') over() from common_duplicate;

SELECT col_1, col_2 , LEAD(col_2 IGNORE NULLS, 2, col_3) OVER (ORDER BY col_1) AS lag_result FROM test_col_value;

INSERT INTO test_array_value (col_1, arr1, arr2) VALUES
    (1, [1, 11], [101, 111]),
    (2, [2, 22], [102, 112]),
    (3, [3, 33], [103, 113]),
    (4, NULL,    [104, 114]),
    (5, [5, 55], [105, 115]),
    (6, [6, 66], [106, 116]);

-- Enable array low-cardinality optimization and test array<string> lead/lag
SET array_low_cardinality_optimize = true;

SHOW CREATE TABLE t_alter_basic;

INSERT INTO t_schema_change VALUES (1, 'a'), (2, 'b');

ALTER TABLE t_rollup ADD ROLLUP rollup_c0_c1 (c0, c1);

SELECT * FROM t_hash_no_bucket;

SELECT * FROM t_random;

SELECT * FROM t_partition;

-- 1.5 ADD PARTITION
CREATE TABLE t_add_part (
    dt DATE NOT NULL,
    c0 INT
) DUPLICATE KEY(dt, c0)
PARTITION BY RANGE(dt) (
    PARTITION p20240101 VALUES [('2024-01-01'), ('2024-01-02'))
)
DISTRIBUTED BY HASH(c0) BUCKETS 4
PROPERTIES("light_weight_tablet_creation" = "true");

SELECT COUNT(*) AS cnt_after_truncate FROM t_truncate;

DROP TABLE t_overwrite;

-- 1.10.2 expression LIST auto partition (INSERT-triggered)
CREATE TABLE t_list_auto (
    city STRING NOT NULL,
    c0 INT
) DUPLICATE KEY(city, c0)
PARTITION BY (city)
DISTRIBUTED BY HASH(c0) BUCKETS 4
PROPERTIES("light_weight_tablet_creation" = "true");

-- Test 2: ends-with match for literal "\asdf"  (%\\asdf)
SELECT c0, c1 FROM t_like_escape WHERE c1 LIKE '%\\\\asdf' ORDER BY c0;

DROP TABLE t_like_escape;

SELECT 'abcXyz' LIKE 'abc\\%%';

SELECT 'xyzabcdef' LIKE '%abc%';

SELECT ('a_b' LIKE 'a\\_b')     AS fe_fold, (txt LIKE 'a\\_b')  AS be_exec FROM t_like_cmp WHERE id = 4;

SELECT ('abc\\' LIKE 'abc\\\\') AS fe_fold, (txt LIKE 'abc\\\\') AS be_exec FROM t_like_cmp WHERE id = 12;

select count(*) from (select * from t0 limit 20, 20) xx;

select COUNT(*) from (select * from (select * from t0 limit 30, 10) x limit 2) xx;

select count(*) from (select * from TABLE(generate_series(1, 100000)) limit 1, 1000) x;

SELECT * FROM t_p_error WHERE calendar_year = '2024';

SELECT * FROM t_p_error WHERE calendar_year = '2012';

select c1 from t_multi order by c1;

select c1 from t_gen where c1 not in ('2024-01-02 12:00:00', '2024-01-03 12:00:00') order by c1;

SELECT k, city FROM fact WHERE city != 'shanghai' ORDER BY k;

SELECT k, city FROM fact_null_only WHERE city != 'shanghai' ORDER BY k;

create table t_dict(k string, v string) primary key(k) distributed by hash(k) buckets 1 properties('replication_num'='1');

select g, count(*), count(s), min(s), max(s), length(group_concat(s, ' '))
from agg_mixed_dict_t where s is null or s != 'V0' group by g order by g;

insert into dict_expr_exchange
select
    generate_series,
    case
        when generate_series % 4 = 0 then 'created'
        when generate_series % 7 = 0 then null
        else 'running'
    end
from TABLE(generate_series(1, 4096));

CREATE TABLE t (s STRING, name STRING) PROPERTIES ("replication_num" = "1");

-- IN predicate with found values
SELECT id FROM t_dict_in WHERE val IN ('alpha', 'gamma', 'epsilon', 'eta', 'iota', 'lambda', 'nu', 'omicron', 'rho', 'tau') ORDER BY id;

-- NOT IN predicate with large list: exclude 50 values, plus 100 non-existent values = 150 total
SELECT COUNT(*) AS cnt FROM t_dict_large
WHERE val NOT IN (
    'val_0', 'val_1', 'val_2', 'val_3', 'val_4', 'val_5', 'val_6', 'val_7', 'val_8', 'val_9',
    'val_10', 'val_11', 'val_12', 'val_13', 'val_14', 'val_15', 'val_16', 'val_17', 'val_18', 'val_19',
    'val_20', 'val_21', 'val_22', 'val_23', 'val_24', 'val_25', 'val_26', 'val_27', 'val_28', 'val_29',
    'val_30', 'val_31', 'val_32', 'val_33', 'val_34', 'val_35', 'val_36', 'val_37', 'val_38', 'val_39',
    'val_40', 'val_41', 'val_42', 'val_43', 'val_44', 'val_45', 'val_46', 'val_47', 'val_48', 'val_49',
    'nx_00', 'nx_01', 'nx_02', 'nx_03', 'nx_04', 'nx_05', 'nx_06', 'nx_07', 'nx_08', 'nx_09',
    'nx_10', 'nx_11', 'nx_12', 'nx_13', 'nx_14', 'nx_15', 'nx_16', 'nx_17', 'nx_18', 'nx_19',
    'nx_20', 'nx_21', 'nx_22', 'nx_23', 'nx_24', 'nx_25', 'nx_26', 'nx_27', 'nx_28', 'nx_29',
    'nx_30', 'nx_31', 'nx_32', 'nx_33', 'nx_34', 'nx_35', 'nx_36', 'nx_37', 'nx_38', 'nx_39',
    'nx_40', 'nx_41', 'nx_42', 'nx_43', 'nx_44', 'nx_45', 'nx_46', 'nx_47', 'nx_48', 'nx_49',
    'nx_50', 'nx_51', 'nx_52', 'nx_53', 'nx_54', 'nx_55', 'nx_56', 'nx_57', 'nx_58', 'nx_59',
    'nx_60', 'nx_61', 'nx_62', 'nx_63', 'nx_64', 'nx_65', 'nx_66', 'nx_67', 'nx_68', 'nx_69',
    'nx_70', 'nx_71', 'nx_72', 'nx_73', 'nx_74', 'nx_75', 'nx_76', 'nx_77', 'nx_78', 'nx_79',
    'nx_80', 'nx_81', 'nx_82', 'nx_83', 'nx_84', 'nx_85', 'nx_86', 'nx_87', 'nx_88', 'nx_89',
    'nx_90', 'nx_91', 'nx_92', 'nx_93', 'nx_94', 'nx_95', 'nx_96', 'nx_97', 'nx_98', 'nx_99'
);

-- IN list (single element - should behave like EQ after optimization)
SELECT id FROM t_dict_eq WHERE val IN ('foo', 'bar') ORDER BY id;

analyze full table s2;

select lower(upper(array_min(reverse(array_sort(a1)))))
from s2 where a2[2] = 'GD' order by v1 limit 2;

with cte as (select array_slice(array_agg(a1[1] order by v1, v2), 1, 3)  as arr from s1)
select array_contains(arr, 'Hunan'), array_contains_all(arr, ['Henan', 'Tibet']), array_contains_seq(arr, ['Henan', 'Hunan']), array_intersect(arr, ['Henan', 'Yunnan']),
       array_position(arr, 'Macao'), array_remove(arr, 'Henan') from cte;

drop table t_force_encode force;

-- name: test_low_cardinality_parquet_cancel @sequential

-- The columns are low-cardinality, so the frontend collects a global dictionary for them and
-- the plan rewrites them to dictionary codes. Touch them first: collection is asynchronous.
select v1, count(*) from lm_dict group by v1 order by v1;

analyze full table topn_decoded_fact;

select * from map_top_n order by c2["key1"] limit 1,10;

select map{}['a'];

-- name: test_generated_column_complex_rewrite
set low_cardinality_optimize_v2 = false;

CREATE VIEW t_generated_column_complex_rewrite_view AS SELECT * FROM t_generated_column_complex_rewrite_1;

CREATE VIEW t_generated_column_complex_rewrite_view AS WITH tmp as (SELECT * FROM (SELECT * FROM t_generated_column_complex_rewrite_1) t_generated_column_complex_rewrite_1 WHERE CONCAT(CAST(id AS STRING), "_abc") IS NOT NULL) select * from tmp where CONCAT(CAST(id AS STRING), "_abc") IS NOT NULL;

INSERT INTO t_generated_column_complex_rewrite_5 values (1,"{\"a\" : \"b\"}");

CREATE TABLE t_typed (id int, a int, x boolean AS array_contains(ARRAY<BIGINT>[1, 2], a))
DUPLICATE KEY(id) DISTRIBUTED BY HASH(id) BUCKETS 1 PROPERTIES("replication_num" = "1");

select * from t_typed order by id;

CREATE TABLE t_pk (id int NOT NULL, a int, b int, d date, s varchar(20),
x int AS named_struct('f', a).f, y boolean AS array_contains(ARRAY<DATE>['2020-1-1'], d),
c boolean AS array_contains([a, b], 3), m varchar(20) AS map{1: s}[1])
PRIMARY KEY(id) DISTRIBUTED BY HASH(id) BUCKETS 1 PROPERTIES("replication_num" = "1");

CREATE TABLE t ( id BIGINT NOT NULL,  array_data ARRAY<int> NOT NULL, mc INT AS (array_avg(array_data)) ) Primary KEY (id) DISTRIBUTED BY HASH(id) BUCKETS 7 PROPERTIES("replication_num" = "1", "replicated_storage" = "true", "fast_schema_evolution" = "true");

CREATE TABLE t ( mc INT AS (1) ) PRIMARY KEY (mc) DISTRIBUTED BY HASH(mc) BUCKETS 7 PROPERTIES("replication_num" = "1", "replicated_storage" = "true", "fast_schema_evolution" = "true");

ALTER TABLE t DROP COLUMN job;

INSERT INTO t VALUES (1), (2), (3);

INSERT INTO t VALUES (1, 2, 3);

-- name: test_schema_change_for_after @native
CREATE DATABASE test_schema_change_for_after;

alter table t0 add column testcol1 BIGINT as v1 + 10, add column testcol2 BIGINT after testcol1;

CREATE TABLE t0 ( v1 BIGINT NOT NULL, v2 BIGINT NOT NULL) DUPLICATE KEY (v1) DISTRIBUTED BY HASH(v1) BUCKETS 1 PROPERTIES("replication_num" = "1", "replicated_storage" = "true", "fast_schema_evolution" = "true");

CREATE TABLE `t` (
  `c1` BIGINT NOT NULL COMMENT "",
  `c2` BIGINT NOT NULL COMMENT "",
  `c3` BIGINT as `c1` + `c2`
) ENGINE=OLAP 
PRIMARY KEY(`c1`)
DISTRIBUTED BY HASH(`c1`) BUCKETS 1
PROPERTIES (
"replication_num" = "1",
"enable_persistent_index" = "true",
"replicated_storage" = "true",
"compression" = "LZ4"
);

insert into t_fix_adding_and_col_partial_update_conflict values (1,2,3),(2,3,4),(3,4,5);

INSERT INTO t1 VALUES 
    ('2024-04-01', 1),
    ('2024-04-02', 1),
    ('2024-04-03', 1),
    ('2024-04-04', 1),
    ('2024-04-05', 1);

-- name: test_create_materialized_view

create database test_create_mv;

SELECT * FROM verify_result WHERE table_name = 'mv1';

SELECT * FROM verify_result WHERE table_name = 'mv_part1';

CREATE TABLE lineitem_hours (
                          l_orderkey    BIGINT,
                          l_partkey     INT,
                          l_suppkey     INT,
                          l_linenumber  INT,
                          l_quantity    DECIMAL(15, 2),
                          l_extendedprice  DECIMAL(15, 2),
                          l_discount    DECIMAL(15, 2),
                          l_tax         DECIMAL(15, 2),
                          l_commitdate  DATETIME,
                          l_receiptdate DATETIME,
                          l_shipinstruct VARCHAR(25),
                          l_shipmode     VARCHAR(10),
                          l_comment      VARCHAR(44),
                          l_shipdate    DATETIME,
                          l_returnflag  VARCHAR(1),
                          l_linestatus  VARCHAR(1)
) PARTITION BY  hour(l_shipdate), l_returnflag, l_linestatus;

alter materialized view mv1 refresh manual;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN DATABASE test_create_mv_with_user TO ROLE role_with_refresh;

-- Test Case 4: Root-based authorization (mv_use_creator_based_authorization=false)
-- This tests when MV refresh always uses ROOT user regardless of creator
EXECUTE AS root with no revert;

DROP ROLE role_without_refresh;

INSERT INTO customer (c_custkey, c_name, c_address, c_city, c_nation
    , c_region, c_phone, c_mktsegment)
VALUES
(1, 'Customer1', '123 Main St', 'City1', 'Nation1', 'Region1', '123-456-7890', 'Segment1'),
(2, 'Customer2', '456 Oak St', 'City2', 'Nation2', 'Region2', '987-654-3210', 'Segment2'),
(3, 'Customer3', '789 Pine St', 'City3', 'Nation3', 'Region3', '555-123-4567', 'Segment3');

select LO_ORDERDATE, sum(LO_REVENUE), max(LO_REVENUE) from lineorder l join dates d on l.LO_ORDERDATE = d.d_date group by LO_ORDERDATE order by LO_ORDERDATE;

select LO_ORDERDATE, sum(LO_REVENUE + 1), max(LO_REVENUE + 1), min(LO_REVENUE + 1), bitmap_union_count(to_bitmap(LO_REVENUE + 1)), approx_count_distinct(LO_REVENUE + 1), PERCENTILE_APPROX(LO_REVENUE + 1, 0.5), PERCENTILE_APPROX(LO_REVENUE + 1, 0.7), sum(distinct LO_REVENUE + 1), count(distinct LO_REVENUE + 1) from lineorder l join dates d on l.LO_ORDERDATE = d.d_date group by LO_ORDERDATE HAVING sum(LO_REVENUE + 1) > 1 order by LO_ORDERDATE;

select LO_ORDERDATE, sum(LO_REVENUE), max(LO_REVENUE), sum(LO_REVENUE), max(LO_REVENUE) , sum(LO_REVENUE), max(LO_REVENUE), count(distinct LO_REVENUE), count(distinct LO_REVENUE) from lineorder l join dates d on l.LO_ORDERDATE = d.d_date where l.LO_ORDERDATE >= '1993-01-01' group by LO_ORDERDATE order by LO_ORDERDATE;

select LO_ORDERDATE, sum(LO_REVENUE + 1), max(LO_REVENUE + 1) from lineorder l join dates d on l.LO_ORDERDATE = d.d_date where l.LO_ORDERDATE >= '1993-01-01' group by LO_ORDERDATE order by LO_ORDERDATE;

CREATE TABLE `test_pt9` (
  `id` bigint(20) NULL COMMENT "id",
  `pt` date NOT NULL COMMENT "",
  `name` varchar(20) NULL COMMENT "gmv"
) ENGINE=OLAP
DUPLICATE KEY(`id`)
COMMENT "OLAP"
PARTITION BY date_trunc('day', pt)
DISTRIBUTED BY HASH(`pt`)
PROPERTIES (
    "replication_num" = "1"
);

INSERT INTO dim_location_area values('1234567890', 'Zone-1'), 
('1234567891', 'Zone-2'),
('1234567892', 'Zone-3'),
('1234567893', 'Zone-4'),
('1234567894', 'Zone-5'),
('1234567895', 'Zone-6'),
('1234567896', 'Zone-7'),
('1234567897', 'Zone-8');

drop table dim_location_area;

insert into mock_tbl values ('2021-07-29',3,10), ('2021-08-02',3,10);

select k1, k2, v1 from mock_tbl where k1 >= '2021-07-23' and k1 < '2021-07-26' order by k1, k2 limit 3;

insert into user_tags values('2023-04-13', 1, 'd', 4);

select user_id, bitmap_union_count(to_bitmap(tag_id)) from user_tags group by user_id order by user_id;

drop materialized view user_tags_mv2;

-- TEST HLL: ROLLUP
create materialized view user_tags_hll_mv2  distributed by hash(user_id) as select user_id, time, hll_union(hll_hash(tag_id)) from user_tags group by user_id, time;

select user_id, percentile_approx_raw(percentile_union(percentile_hash(tag_id)), 1) x from user_tags group by user_id order by user_id;

drop materialized view user_tags_mv3;

insert into emps values(1, 1, 1, 10, "emp_name1", 1000);

create materialized view mv_right_outer
distributed by hash(`empid`) buckets 10
refresh manual
as
select empid, deptno
from emps right outer join depts using (deptno);

select empid, deptno
from emps full outer join depts using (deptno) order by empid;

refresh materialized view mv_left_anti with sync mode;

drop materialized view mv_right_semi;

refresh materialized view test_empty_partition_mv1 with sync mode;

drop table test_empty_partition_tbl;

-- name: test_materialized_view_union_all_rewrite
CREATE TABLE `mt1` (
 k1 INT,
 k2 string,
 v1 INT,
 v2 INT
) ENGINE=OLAP
PARTITION BY RANGE(`k1`)
(
  PARTITION `p1` VALUES LESS THAN ('3'),
  PARTITION `p2` VALUES LESS THAN ('6'),
  PARTITION `p3` VALUES LESS THAN ('9')
)
DISTRIBUTED BY HASH(`k1`) BUCKETS 3
PROPERTIES (
"replication_num" = "1"
);

select * from mt1 where k1<6 and k2  = 'a' and v2 != 4 order by 1;

-- mode 1
set materialized_view_union_rewrite_mode = 1;

select k1, sum(v1), sum(v2) from mt1 where k1 < 5 group by k1 order by 1;

REFRESH MATERIALIZED VIEW test_mv0 WITH SYNC MODE;

REFRESH MATERIALIZED VIEW mv PARTITION START ("2023-07-25") END ("2023-07-26") WITH SYNC MODE;

CREATE MATERIALIZED VIEW sw_mv
PARTITION BY dt
DISTRIBUTED BY HASH(k) BUCKETS 2
REFRESH DEFERRED MANUAL
PROPERTIES ('replication_num' = '1')
AS SELECT dt, k, SUM(v) AS s, COUNT(*) AS c FROM sw_base GROUP BY dt, k;

CREATE MATERIALIZED VIEW bm_mid
PARTITION BY dt
DISTRIBUTED BY HASH(k) BUCKETS 2
REFRESH DEFERRED MANUAL
PROPERTIES ('replication_num' = '1')
AS SELECT dt, k, v FROM bm_base WHERE k < 5;

REFRESH MATERIALIZED VIEW bm_mid_old WITH SYNC MODE;

select k2, k3, sum(k1) from t1 group by k2, k3 order by 1,2;

-- name: test_mv_external_partition_name_collision

-- A materialized view over an external table names each of its partitions after the base partition
-- value, keeping only [a-zA-Z0-9_]. That used to be the whole name, so -1 and 1 both became p1, as did
-- 'a-b' and 'ab': the second partition replaced the first, its rows never reached the view, and every
-- query rewritten onto the view silently lost them.

set enable_materialized_view_rewrite = true;

-- The target rewrite path: AGGREGATE_JOIN_PUSH_DOWN_RULE rewrites the joined
-- aggregation against an MV whose only base table is the Iceberg fact table.
-- Force mode loads the MV plan synchronously and picks the MV whenever the rewrite succeeds. Without it, the MV is
-- skipped while its plan is still being loaded asynchronously from the Iceberg metastore, and the cost-based choice
-- between the MV and the base table is close on this tiny data set, so the check was flaky. A failed rewrite still
-- falls back to the base table, so the check still catches the bug this case covers.
set enable_materialized_view_rewrite = true;

-- name: test_mv_iceberg_datetime_identity_partition

-- An Iceberg identity partition on a DATETIME column carries no granularity, and the view gave each
-- value a one-day range [v, v + 1 day). Two values on the same day then overlap, and every refresh of a
-- view partitioned on the column, directly or by date_trunc, failed with "is intersected with range"
-- or "Partition ranges overlap". The view stayed empty.

refresh materialized view mv_day with sync mode;

set enable_materialized_view_rewrite=false;

REFRESH MATERIALIZED VIEW test_mv2 FORCE WITH SYNC MODE;

REFRESH MATERIALIZED VIEW test_mv3 WITH SYNC MODE;

ALTER MATERIALIZED VIEW mv1 inactive;

select lo_orderkey, lo_linenumber, lo_quantity, lo_revenue, lo_custkey, c_name
from lineorder left outer join customer
on lo_custkey = c_custkey
where c_name = 'name_1';

drop materialized view mv_left_outer_2;

select lo_orderkey, lo_linenumber, lo_quantity, lo_custkey, c_custkey, c_name
from lineorder right outer join customer
on lo_custkey = c_custkey
where lo_orderkey = 10001;

refresh materialized view mv_right_outer_agg with sync mode;

select count() from mv_inner_join;

select lo_orderkey, lo_linenumber, lo_quantity
from lineorder left semi join customer_primary
on lo_custkey = c_custkey
order by lo_orderkey,lo_linenumber;

drop materialized view mv_inner_join_3;

select count() from mv_inner_join_5;

create materialized view mv_full_outer_join
distributed by hash(`lo_orderkey`) buckets 10
refresh manual
as
select lo_orderkey, lo_linenumber, lo_quantity, lo_custkey, c_custkey, c_name
from lineorder full outer join customer
on lo_custkey = c_custkey;

INSERT INTO t2 VALUES (1,1),(2,2),(null,1);

CREATE MATERIALIZED VIEW mv1 REFRESH MANUAL AS select * from t1 right outer join t2 on k1=a;

select inspect_mv_plan('user_tags_mv1', false);

CREATE MATERIALIZED VIEW mv_on_view_1 REFRESH ON_CHANGE AS select * from view1;

-- alter base table of view: not invalidate
ALTER TABLE jj ADD COLUMN extra int;

create materialized view mv_lineorder_1
distributed by hash(`lo_orderkey`) buckets 10
refresh manual
as
select lo_orderkey, lo_linenumber, lo_quantity, lo_revenue, lo_custkey
from lineorder
where lo_orderkey > 10003 or lo_orderkey < 10002;

select lo_orderkey, lo_linenumber, lo_quantity, lo_revenue, lo_custkey
from lineorder
where lo_linenumber < 2 order by lo_orderkey;

drop materialized view mv_lineorder_3;

-- name: test_mv_partition_compensate_mysql @slow
-- create mysql table

set enable_materialized_view_transparent_union_rewrite = true;

-- union rewrite

-- cannot partition prune

-- cannot partition prune

INSERT INTO t1 VALUES ('1988-07-01', 1, 1, 'a');

CREATE MATERIALIZED VIEW mv1
REFRESH ON_CHANGE
PARTITION BY (c1)
AS 
    SELECT c1, c2, c3
    FROM t1;

insert into user_tags values('2023-04-14', 3, 'e', 6);

EXPLAIN logical
select  
   count(distinct ws_order_number) as "order count"
  ,sum(ws_ext_ship_cost) as "total shipping cost"
  ,sum(ws_net_profit) as "total net profit"
from
   web_sales ws1
  ,date_dim
  ,customer_address
  ,web_site
where
    d_date between '1999-2-01' and 
           date_add(cast('1999-2-01' as date), 60)
and ws1.ws_ship_date_sk = d_date_sk
and ws1.ws_ship_addr_sk = ca_address_sk
and ca_state = 'IL'
and ws1.ws_web_site_sk = web_site_sk
and web_company_name = 'pri'
and exists (select *
            from web_sales ws2
            where ws1.ws_order_number = ws2.ws_order_number
              and ws1.ws_warehouse_sk <> ws2.ws_warehouse_sk)
and not exists(select *
               from web_returns wr1
               where ws1.ws_order_number = wr1.wr_order_number)
order by count(distinct ws_order_number)
limit 100;

REFRESH MATERIALIZED VIEW mv0 PARTITION START ('2026-07-01') END ('2026-07-02') WITH SYNC MODE;

INSERT INTO t1 VALUES (1,"2020-06-15"),(2,"2020-06-18"),(3,"2020-06-21"),(4,"2020-06-24"),
    (1,"2020-07-02"),(2,"2020-07-05"),(3,"2020-07-08"),(4,"2020-07-11"),
    (1,"2020-07-16"),(2,"2020-07-19"),(3,"2020-07-22"),(4,"2020-07-25"),
    (2,"2020-06-15"),(3,"2020-06-18"),(4,"2020-06-21"),(5,"2020-06-24"),
    (2,"2020-07-02"),(3,"2020-07-05"),(4,"2020-07-08"),(5,"2020-07-11"),
    (2,"2020-07-16"),(3,"2020-07-19"),(4,"2020-07-22"),(5,"2020-07-25");

-- name: test_mv_with_multi_partition_columns_optimize @slow

CREATE TABLE t1 (
    k1 int,
    k2 date,
    k3 string
)
DUPLICATE KEY(k1)
PARTITION BY date_trunc("day", k2);

create materialized view mv3 refresh manual as select c1, count(*) from t1 group by c1;

INSERT INTO `t1` VALUES
(1, 'varchar_value_1', 'varchar_value_21', 100, 1),
(2, 'varchar_value_2', 'varchar_value_22', 150, 0),
(3, 'varchar_value_3', 'varchar_value_23', 200, 1),
(4, 'varchar_value_4', 'varchar_value_24', 250, 0),
(5, 'varchar_value_5', 'varchar_value_25', 300, 1),
(6, 'varchar_value_6', 'varchar_value_26', 350, 0),
(7, 'varchar_value_7', 'varchar_value_27', 400, 1),
(8, 'varchar_value_8', 'varchar_value_28', 450, 0),
(9, 'varchar_value_9', 'varchar_value_29', 500, 1),
(10, 'varchar_value_10', 'varchar_value_30', 550, 0),
(11, 'varchar_value_11', 'varchar_value_31', 600, 1),
(12, 'varchar_value_12', 'varchar_value_32', 650, 0),
(13, 'varchar_value_13', 'varchar_value_33', 700, 1),
(14, 'varchar_value_14', 'varchar_value_34', 750, 0),
(15, 'varchar_value_15', 'varchar_value_35', 800, 1),
(16, 'varchar_value_16', 'varchar_value_36', 850, 0),
(17, 'varchar_value_17', 'varchar_value_37', 900, 1),
(18, 'varchar_value_18', 'varchar_value_38', 950, 0),
(19, 'varchar_value_19', 'varchar_value_39', 1000, 1),
(20, 'varchar_value_20', 'varchar_value_40', 1050, 0);

create MATERIALIZED VIEW month_mv
REFRESH DEFERRED MANUAL
PROPERTIES (
"replication_num" = "1"
)  as select tinyint_col, date_trunc('month', date_col) as date_col, sum(sum_value) as sum_value from date_mv group by tinyint_col, date_trunc('month', date_col);

select /*+ set_Var(enable_fine_grained_range_predicate = true, enable_force_rule_based_mv_rewrite = true, nested_mv_rewrite_max_level = 10) */
sum(t0.float_col_1 * t1.int_col_1), t0.tinyint_col from  t0 join t1 on t0.tinyint_col = t1.tinyint_col_1 where t0.id in (1, 2, 3, 4, 5, 6, 6, 7, 9, 10)
and date_col > '2024-02-11' and date_col < '2028-05-14' group by tinyint_col order by 1;

show create view sync_mv_rollup;

show create table user_tags_mv1;

select if(@last_refresh_time != @this_refresh_time, 
    'refreshed', concat('no refresh after ', @last_refresh_time));

SELECT * FROM information_schema.materialized_views WHERE TABLE_SCHEMA = 'test_show_materialized_view' and table_name like 'user_tags_mv1';

show materialized views where name like '%user_tags_mv1%';

-- bitmap
select count(1) from user_tags_mv1 [_SYNC_MV_];

select user_id, hll_cardinality(hll_union(hll_hash(tag_id))) x from user_tags group by user_id  order by 1,2;

create materialized view same_column_ref_mv1 
as select user_id + 1 as col2, time, sum(tag_id* 10) as sum1 , sum(tag_id* 100) as sum2, count(tag_id* 10) as count1 from user_tags group by col2, time;

-- user_tags_percential_mv2
select user_id + 1 as col1, time, percentile_union(percentile_hash(cast(tag_id * 10 as double))) as agg1 from user_tags group by col1, time;

select * from tbl1 order by k1;

drop materialized view UPPER_MV1;

CREATE TABLE user_event (
    ds date   NOT NULL,
    id  varchar(256)    NOT NULL,
    user_id int DEFAULT NULL,
    user_id1    varchar(256)    DEFAULT NULL,
    user_id2    varchar(256)    DEFAULT NULL,
    column_01   int DEFAULT NULL,
    column_02   int DEFAULT NULL,
    column_03   int DEFAULT NULL,
    column_04   int DEFAULT NULL,
    column_05   int DEFAULT NULL,
    column_06   DECIMAL(12,2)   DEFAULT NULL,
    column_07   DECIMAL(12,3)   DEFAULT NULL,
    column_08   JSON   DEFAULT NULL,
    column_09   DATETIME    DEFAULT NULL,
    column_10   DATETIME    DEFAULT NULL,
    column_11   DATE    DEFAULT NULL,
    column_12   varchar(256)    DEFAULT NULL,
    column_13   varchar(256)    DEFAULT NULL,
    column_14   varchar(256)    DEFAULT NULL,
    column_15   varchar(256)    DEFAULT NULL,
    column_16   varchar(256)    DEFAULT NULL,
    column_17   varchar(256)    DEFAULT NULL,
    column_18   varchar(256)    DEFAULT NULL,
    column_19   varchar(256)    DEFAULT NULL,
    column_20   varchar(256)    DEFAULT NULL,
    column_21   varchar(256)    DEFAULT NULL,
    column_22   varchar(256)    DEFAULT NULL,
    column_23   varchar(256)    DEFAULT NULL,
    column_24   varchar(256)    DEFAULT NULL,
    column_25   varchar(256)    DEFAULT NULL,
    column_26   varchar(256)    DEFAULT NULL,
    column_27   varchar(256)    DEFAULT NULL,
    column_28   varchar(256)    DEFAULT NULL,
    column_29   varchar(256)    DEFAULT NULL,
    column_30   varchar(256)    DEFAULT NULL,
    column_31   varchar(256)    DEFAULT NULL,
    column_32   varchar(256)    DEFAULT NULL,
    column_33   varchar(256)    DEFAULT NULL,
    column_34   varchar(256)    DEFAULT NULL,
    column_35   varchar(256)    DEFAULT NULL,
    column_36   varchar(256)    DEFAULT NULL,
    column_37   varchar(256)    DEFAULT NULL
)
partition by date_trunc("day", ds)
distributed by hash(id);

select
ds
,column_19 
,column_36
,sum(column_01) as column_01_sum
,bitmap_union_count(to_bitmap( user_id)) as user_id_dist_cnt
,bitmap_union_count(to_bitmap(case when column_01 > 1 and column_34 IN ('1','34')   then user_id2 else null end)) as filter_dist_cnt_1
,bitmap_union_count(to_bitmap( case when column_02 > 60 and column_35 IN ('11','13') then  user_id2 else null end)) as filter_dist_cnt_2
,bitmap_union_count(to_bitmap(case when column_03 > 70 and column_36 IN ('21','23') then  user_id2 else null end)) as filter_dist_cnt_3
,bitmap_union_count(to_bitmap(case when column_04 > 20 and column_27 IN ('31','27') then  user_id2 else null end)) as filter_dist_cnt_4
,bitmap_union_count(to_bitmap( case when column_05 > 90 and column_28 IN ('41','43') then  user_id2 else null end)) as filter_dist_cnt_5
 from user_event
 where ds >= '2023-11-02'
 group by
 ds
 ,column_19
 ,column_36
 order by 
 ds
 ,column_19
 ,column_36;

insert into duplicate_tbl values 
    ('2023-06-15', '2023-06-15 00:00:00', 'a', 'a', false, 1, 1, 1, 1, 1, 1.0, 1.0, 1.0),
    ('2023-06-15', '2023-06-15 00:00:00', 'a', 'a', false, 1, 1, 1, 1, 1, 1.0, 1.0, 1.0),
    ('2023-06-15', '2023-06-15 00:00:00', 'a', 'a', false, 1, 1, 1, 1, 1, 1.0, 1.0, 1.0),
    ('2023-06-16', '2023-06-15 00:00:00', 'a', 'a', false, 1, 1, 1, 1, 1, 1.0, 1.0, 1.0);

select k1, count(k6 + 1) as c_k6, min(k7 * 10) as m_k7 from duplicate_tbl group by 1 order by 1,2;

CREATE TABLE case_when_tbl1 (
    k1 INT,
    k2 char(20))
DUPLICATE KEY(k1)
DISTRIBUTED BY HASH(k1);

drop materialized view case_when_mv2;

-- check hit sync mv's order key

select * from test_base_table1 where col2 >='2022-04-30 12:00:00' order by 1;

select * from (select col0, col2, col3, id, col1 from test_base_table1 where col0=123456789 union select col0, col2, col3, id, col1 from mv_test_base_table1 [_SYNC_MV_] where col2 >='2022-04-30 12:00:00') t order by 1;

ALTER TABLE t1 COMPACT;

create materialized view user_tags_percential_mv1 
PROPERTIES ("colocate_mv" = "true")
as select user_id, time, percentile_union(percentile_hash(tag_id)) from user_tags group by user_id, time;

INSERT INTO `t1` (`v4`, `v5`, `v6`) VALUES (3, 30, 300);

INSERT INTO `t2` (`c4`, `c5`, `c6`) VALUES (5, NULL, 10010);

refresh materialized view mv_2 with sync mode;

INSERT INTO c2agg_base VALUES (1, 5000000000);

insert into c3_base values (1, 10), (2, 20);

create table c5_base (k int, v decimal(10,2)) properties('format-version'='2');

insert into c5_base values (3, 1234567890.12);

SELECT col_str, col_int, dt FROM test_pct_scan ORDER BY col_int;

REFRESH MATERIALIZED VIEW test_pct_agg WITH SYNC MODE;

REFRESH MATERIALIZED VIEW test_ivm_scan WITH SYNC MODE;

drop materialized view test_ivm_agg;

SELECT count(*), sum(v) FROM mv_arpl_alter;

create table base (region string, amount int);

SELECT region, count(*) FROM mv_range_pre_split GROUP BY region ORDER BY region;

-- Baseline refresh: hybrid processor falls back to PCT, so no IMV source range is
-- recorded for this job (IMV_SOURCE_VERSION_RANGE / IMV_SOURCE_TIMESTAMP_RANGE stay NULL).
REFRESH MATERIALIZED VIEW test_mv1 WITH SYNC MODE;

insert into t_src values (1, 10), (2, 20);

SELECT k, dt, cnt FROM mv_wrapped ORDER BY k, dt;

-- name: test_ivm_whitelist_widening
-- Verifies the widened IVM aggregate-function whitelist:
--   * MIN/MAX(VARCHAR) — enabled by #73095 (state_union accepts compatible string types)
--   * AVG(DECIMAL)     — enabled by #73012 (preserve AggStateDesc on state_union)
--   * MIN/MAX(DECIMAL) — state is the value itself; no AVG-style (sum, count) plumbing
--   * ARRAY_AGG(arg)   — single-arg accepted; ORDER BY variant rejected
--   * BITMAP_UNION(to_bitmap(...)) — accepted: normalizes to bitmap_agg
--   * HLL_UNION / BITMAP_UNION over a metric sketch (hll_hash / bitmap_hash) — accepted directly

SELECT k, dt, avg_d FROM mv_avg_dec ORDER BY k, dt;

SELECT k, dt, bitmap_count(b2) AS dc FROM mv_bmp_hash ORDER BY k, dt;

-- bootstraps through PCT, which records no IVM window
REFRESH MATERIALIZED VIEW mv_skip WITH SYNC MODE;

SELECT col_str, col_int, dt FROM test_mv1 WHERE dt <= '2023-12-02' ORDER BY col_str, col_int, dt limit 3;

SELECT dt, col_int1, col_int2, sum_col_int1, sum_col_int2, avg_col_int1, avg_col_int2, min_col_int1, min_col_int2, max_col_int1, max_col_int2, count_col_int1, count_col_int2, approx_count_distinct_col_str1, approx_count_distinct_col_str2, approx_count_distinct_col_str3 FROM test_mv1 ORDER BY dt, col_int1, col_int2 limit 5;

create table t1 (k int, v int);

create table t5 (
  col1 string,
  col2 int,
  dt date
) partition by(dt);

-- ==============================================================
-- Part A: refresh_mode = "auto" — IVM -> PCT fallback -> IVM recovery
-- ==============================================================

insert into dist_base values (1, 10), (1, 10), (2, 20);

DROP MATERIALIZED VIEW test_mv_dup;

SELECT k, cnt FROM test_mv_ord ORDER BY k;

-- Regression coverage: every GROUP BY shape that used to fail analyzer-time
-- with "Table null.null.test_mv1 is not found" because of the auto-generated
-- self-referencing UniqueConstraint on the IVM MV's PRIMARY_KEYS.
SELECT k, count(*) FROM test_mv1 GROUP BY k ORDER BY k;

SELECT count(*) FROM test_mv_multi;

-- Establish the TVR baseline (one run over the initial 2 rows).
REFRESH MATERIALIZED VIEW test_mv_batch WITH SYNC MODE;

-- Async refresh: the 6-row delta is split into multiple bounded INCREMENTAL runs.
REFRESH MATERIALIZED VIEW test_mv_batch;

CREATE TABLE IF NOT EXISTS `part` (
  `p_partkey` int(11) NOT NULL COMMENT "",
  `p_name` varchar(23) NOT NULL COMMENT "",
  `p_mfgr` varchar(7) NOT NULL COMMENT "",
  `p_category` varchar(8) NOT NULL COMMENT "",
  `p_brand` varchar(10) NOT NULL COMMENT "",
  `p_color` varchar(12) NOT NULL COMMENT "",
  `p_type` varchar(26) NOT NULL COMMENT "",
  `p_size` int(11) NOT NULL COMMENT "",
  `p_container` varchar(11) NOT NULL COMMENT ""
);

REFRESH MATERIALIZED VIEW lineorder_flat_mv WITH SYNC MODE;

create materialized view mv_rollup
partition by (date_trunc('month', event_day))
REFRESH DEFERRED MANUAL
distributed by hash(event_day, id) buckets 3
PROPERTIES ("replication_num" = "1")
as select event_day, id, sum(imp) as imp from base_f group by event_day, id;

select sum(imp) from mv_rollup where event_day < '2026-09-01';

select sum(imp) from base_f;

create materialized view mv_fact_dim
partition by (date_trunc('day', fd))
REFRESH DEFERRED MANUAL
distributed by hash(fd) buckets 3
PROPERTIES ("replication_num" = "1")
as select f.d as fd, f.id as fid, f.imp as fimp, dm.label as dlabel
   from fact_d f left join dim_d dm on f.d = dm.d;

refresh materialized view mv_rollup_year with sync mode;

-- An mv finer than its base table fans out across the whole base range, and every one of its
-- partitions under a dropped base partition loses its only source and is dropped as an orphan.
CREATE TABLE base_monthly (
  event_day datetime NOT NULL,
  id bigint NOT NULL,
  imp bigint SUM NOT NULL DEFAULT "0"
)
AGGREGATE KEY(event_day, id)
PARTITION BY date_trunc('month', event_day)
DISTRIBUTED BY HASH(event_day, id) BUCKETS 3
PROPERTIES ("replication_num" = "1");

-- List partitioning is 1:1 with the mv, so the dropped value's mv partition goes with it.
CREATE TABLE base_list (
  province varchar(64) NOT NULL,
  id bigint NOT NULL,
  imp bigint SUM NOT NULL DEFAULT "0"
)
AGGREGATE KEY(province, id)
PARTITION BY LIST (province) (
  PARTITION pbj VALUES IN ("beijing"),
  PARTITION pgd VALUES IN ("guangdong")
)
DISTRIBUTED BY HASH(province, id) BUCKETS 3
PROPERTIES ("replication_num" = "1");

drop materialized view mv_list;

-- name: test_mv_refresh_emptied_partition_version_map_reset
-- A base partition emptied by TRUNCATE sits at its initial version under a new id. Once the mv's version map is reset,
-- it reads as a new, empty partition; the mv partition still holding its old rows must be refreshed all the same, and
-- must not answer a rewritten query before that.

REFRESH MATERIALIZED VIEW mv_u WITH SYNC MODE;

SELECT count(*) FROM mv_u;

-- First refresh
REFRESH MATERIALIZED VIEW test_mv1 WITH SYNC MODE;

-- Second refresh without explicit FORCE - should skip because config=1 only affects non-partitioned MVs
REFRESH MATERIALIZED VIEW test_mv2 WITH SYNC MODE;

CREATE MATERIALIZED VIEW test_mv4
partition by (date_trunc("day", k1), k2)
REFRESH DEFERRED MANUAL
PROPERTIES ("partition_refresh_number"="-1")
AS select k1, k2, sum(k3) from t3 group by k1, k2;

REFRESH MATERIALIZED VIEW test_mv5 WITH SYNC MODE;

DROP MATERIALIZED VIEW test_mv6;

select * from test_mv4 order by year, month;

INSERT INTO bt1 VALUES (1, "sample-domain.com");

-- second refresh:
-- before fix: fails with Duplicate partition name psampledomain2ecom
-- after fix: succeeds and creates a renamed MV partition
REFRESH MATERIALIZED VIEW mv_dup_partition_name_repro WITH SYNC MODE;

--------- t5 ---------
-- test sync refresh & partition_refresh_number= -1
create materialized view test_mv1
partition by dt
REFRESH DEFERRED MANUAL
distributed by hash(dt, province) buckets 10 
PROPERTIES (
      'partition_refresh_number' = '-1',
      'session.enable_insert_strict' = 'true',
      "replication_num" = "1"
) 
as select dt, province, sum(age) from t5 group by dt, province;

CREATE TABLE `u4` (
  `id` int(11) NOT NULL,
  `dt` date NOT NULL
) ENGINE=OLAP 
PRIMARY KEY(`id`, `dt`)
PARTITION BY RANGE(`dt`)
(
  PARTITION p1 VALUES [("2023-01-01"), ("2024-01-01")),
  PARTITION p2 VALUES [("2024-01-01"), ("2025-01-01"))
)
DISTRIBUTED BY HASH(`id`)
PROPERTIES (
"replication_num" = "1"
);

INSERT INTO u6 (id,dt) VALUES
	 (1,'2024-03-10'),
	 (2,'2024-03-11'),
	 (4,'2024-03-12');

CREATE MATERIALIZED VIEW IF NOT EXISTS `test_mv12`
PARTITION BY date_trunc('week', `dt`)
DISTRIBUTED BY HASH(`dt`)
REFRESH DEFERRED MANUAL 
AS 
    select dt from u1
    union all
    select dt from u2
    union all
    select dt from u3
    union all
    select dt from u4
    union all
    select dt from u5
    union all
    select dt from u6;

select count(1) from test_mv12;

select dt, count(1) from test_mv11 group by dt order by 1;

select dt, sum(id) from u6 group by dt order by 1;

INSERT INTO u5 (id,dt) VALUES (131,'2024-04-10'), (1,'2024-03-10');

CREATE MATERIALIZED VIEW mv3 DISTRIBUTED BY HASH(col_int) BUCKETS 10 
REFRESH DEFERRED MANUAL
AS
SELECT col_int, count_ts, sum_int from mv2 where col_int >1;

CREATE TABLE non_partition_table (dt2 date, int2 int, str2 string);

-- case3: mv1 with join
CREATE MATERIALIZED VIEW test_mv1 
PARTITION BY (dt1) 
REFRESH DEFERRED MANUAL
PROPERTIES ("partition_refresh_number"="1")
AS 
SELECT dt1, dt2, sum(int1), sum(int2) 
from partition_table t1
join non_partition_table t2 on t1.dt1 = t2.dt2 
group by dt1, dt2;

CREATE MATERIALIZED VIEW IF NOT EXISTS `test_mv3`
PARTITION BY date_trunc('week', `dt`)
DISTRIBUTED BY HASH(`dt`)
REFRESH DEFERRED MANUAL
PROPERTIES (
    "partition_refresh_strategy" = "adaptive"
)
AS select dt, sum(id) as s1 from u3 group by dt;

select dt, s1 from test_mv2 order by 1, 2;

-- name: test_mv_with_list_partitions_hive

USE test_mv_avg_distinct_rewrite_db;

-- non-distinct avg may still use the MV rewrite and must stay correct
SELECT k, avg(x) FROM t_avgd GROUP BY k ORDER BY k;

SELECT date_trunc('month', dt) mo, sum(v) s FROM wkt GROUP BY date_trunc('month', dt) ORDER BY mo;

-- The MV groups by the same key the queries below group by, which is what puts the rewrite on
-- its non-rollup path, but it stores sum(x)/count(x) -- nothing that can satisfy an aggregate
-- over k.
CREATE MATERIALIZED VIEW mv_avgd
REFRESH MANUAL
AS SELECT k, sum(x) AS s, count(x) AS c FROM t_avgd GROUP BY k;

CREATE TABLE t2_s026 (
    id BIGINT, dt DATE, region VARCHAR(32), amount DECIMAL(18, 2)
) PRIMARY KEY(id, dt, region) DISTRIBUTED BY HASH(id) BUCKETS 4;

-- test for time series with multi mvs
CREATE MATERIALIZED VIEW IF NOT EXISTS test_mv1
PARTITION BY (dt)
REFRESH DEFERRED MANUAL
PROPERTIES (
"replication_num" = "1"
) as select date_trunc('hour', ts) as dt, sum(v1) as sum_v1, sum(v2) as sum_v2
from t0 group by date_trunc('hour', ts);

select sum(v1), sum(v2) from t0 where ts > '2020-02-23 12:12:00' order by 1;

CREATE MATERIALIZED VIEW IF NOT EXISTS test_mv2
PARTITION BY (dt)
REFRESH DEFERRED MANUAL
PROPERTIES (
"replication_num" = "1"
) as select date_trunc('day', dt) as dt, sum(sum_v1) as sum_v1, sum(sum_v2) as sum_v2
from test_mv1 group by date_trunc('day', dt);

SELECT count(*), max(k3), min(k3), count(k3) FROM update_table_with_null_partition PARTITION (p202006);

SELECT count(*), max(k11), min(k11), count(k11) FROM update_table_with_null_partition PARTITION (p202006);

SELECT count(*), max(k6), min(k6), count(k6) FROM update_table_with_null_partition PARTITION (p202007);

SELECT count(*), max(k1), min(k1), count(k1) FROM update_table_with_null_partition PARTITION (p202008);

SELECT count(*), max(k9), min(k9), count(k9) FROM update_table_with_null_partition PARTITION (p202008);

SELECT count(*), max(k4), min(k4), count(k4) FROM update_table_with_null_partition PARTITION (p202009);

SELECT count(*), max(k12), min(k12), count(k12) FROM update_table_with_null_partition PARTITION (p202009);

ALTER TABLE meta_schema_change RENAME COLUMN c_move TO c_renamed;

SELECT k1, c0, added_null, added_default, c_renamed, v1 FROM meta_schema_change ORDER BY k1;

select count(*), count(distinct k1), sum(k1), sum(v2) from t_local;

insert into t_local select generate_series, cast(generate_series % 7 as int), concat('v', generate_series), generate_series * 3 from table(generate_series(1, 20000));

select count(*), sum(k1) from t_pk;

-- A second load into the partitions the first one created. They are in the plan this time, so this
-- also checks that rowsets folded from several nodes accumulate across the two paths rather than
-- replace each other.
insert into t_auto select date_add('2026-01-01', cast(generate_series % 5 as int)), generate_series, concat('w', generate_series) from table(generate_series(1, 20000));

-- Automatic bucketing, the other way a load gets tablets the plan never saw. A bucket_size of one
-- byte makes the sub-partition being written immutable as soon as it holds any data, so FE keeps
-- adding sub-partitions during the load and hands their tablets back over the immutable-partition
-- RPC. Every sink instance asks for them separately and must get the same node list per tablet.
create table t_bucket (k1 bigint, v1 string)
    duplicate key(k1)
    distributed by random buckets 1
    properties('replication_num' = '1', 'file_bundling' = 'true', 'bucket_size' = '1');

insert into t_auto_off select date_add('2026-01-01', cast(generate_series % 5 as int)), generate_series, concat('w', generate_series) from table(generate_series(1, 20000));

insert into t_txn values(3);

DESC test_mv1;

SELECT dt, c0, count(c1) as cnt_c1, count(c2) as cnt_c2, sum(c4) as sum_c4 from t1 group by dt, c0 order by ALL limit 3;

SELECT dt, c0, count(c1) as cnt_c1, c4 from t1 group by dt, c0, c4 order by ALL limit 3;

DESC test_mv2;

SELECT dt, c0, c1, c4 FROM test_mv2 ORDER BY dt, c0, c1, c4 LIMIT 3;

-- Create MV on aggregate base table
CREATE MATERIALIZED VIEW test_mv_agg1
PARTITION BY date_trunc('day', dt)
DISTRIBUTED BY hash(c0)
PROPERTIES (
    "replication_num" = "1"
)
AS
SELECT dt, c0, SUM(c3) as sum_c3, SUM(row_cnt) as cnt_rows
FROM t1_agg
GROUP BY dt, c0;

-- Test base table add aggregation column (REPLACE type)
ALTER TABLE t1_agg ADD COLUMN c5 VARCHAR(100) REPLACE;

SELECT dt, c0, SUM(c3) as sum_c3, SUM(row_cnt) as cnt_rows, SUM(c6) as sum_c6 FROM t1_agg GROUP BY dt, c0 ORDER BY ALL LIMIT 3;

drop materialized view if exists test_mv_agg2;

DESC test_mv_agg2;

-- Test MV drop column
ALTER MATERIALIZED VIEW test_mv_agg2 DROP COLUMN cnt_c1;

REFRESH MATERIALIZED VIEW test_mv_agg3 WITH SYNC MODE;

DESC t3_agg;

-- Test 4: Aggregate table - Multiple aggregations and schema evolution (dt, category_id as key)
drop table if exists t4_agg;

-- Test: Base table add aggregation column
ALTER TABLE t4_agg ADD COLUMN profit DECIMAL(20, 2) SUM;

-- Insert to set region for existing row (use 0 for SUM columns to avoid double-counting)
INSERT INTO t4_agg VALUES ('2026-01-03', 3, 300, 0, 0, 0, 'Product C', 0, 'north');

-- Create MV on aggregate base table with multiple aggregation functions
CREATE MATERIALIZED VIEW test_mv_agg2
PARTITION BY date_trunc('day', dt)
DISTRIBUTED BY HASH(c0)
PROPERTIES (
    "replication_num" = "1",
    "query_rewrite_consistency" = "force_mv"
)
AS
SELECT dt, c0, SUM(c2) as sum_c2, MAX(c3) as max_c3, MIN(c3) as min_c3, AVG(c5) as avg_c5
FROM t2_agg
GROUP BY dt, c0;

INSERT INTO t1 VALUES ('2026-01-01', 1, 10), ('2026-01-01', 2, 20), ('2026-01-02', 1, 30);

-- Data refreshed before the switch stays readable after its metadata is rewritten.
SELECT * FROM mv_off ORDER BY dt, k1;

SELECT * FROM test_mv1 order by c0, c1 limit 3;

SELECT count(1) FROM test_mv1 where c0 = 10;

CREATE TABLE t1 (id int, dt date, val int)
PARTITION BY (dt);

use `abc-~!@#$%^&<>=+abc`;

SELECT ST_AsText(ST_Buffer(ST_GeomFromText('POLYGON ((0 0,10 0,10 10,0 10,0 0))', 'EPSG:3857'), -5.0));

SELECT id, ST_Area(ST_Buffer(ST_GeomFromText('POLYGON ((0 0,10 0,10 10,0 10,0 0))', 'EPSG:3857'), r)) FROM (SELECT 1 AS id, CAST(0 AS DOUBLE) AS r UNION ALL SELECT 2, CAST(-1 AS DOUBLE) UNION ALL SELECT 3, CAST(NULL AS DOUBLE)) radii ORDER BY id;

SELECT ST_AsText(ST_CoverageSimplify(ST_GeomFromText('MULTIPOLYGON EMPTY','EPSG:4326'),1) OVER());

SELECT ST_Intersects(ST_GeomFromText('POLYGON ((0 0,4 0,4 4,0 4,0 0))','EPSG:4326'),ST_GeomFromText('POLYGON ((2 -1,5 -1,5 2,2 2,2 -1))','EPSG:4326'));

CREATE TABLE shapes (id INT,wkt STRING) DUPLICATE KEY(id) DISTRIBUTED BY HASH(id) BUCKETS 1 PROPERTIES("replication_num"="1");

SELECT ST_IsValid(ST_GeogFromWKB(unhex('010300000001000000040000000000000000000000000000000000000000000000000000400000000000000000000000000000f03f000000000000004000000000000000000000000000000000'))), ST_IsValid(ST_GeogFromWKB(unhex('0000000003000000010000000400000000000000000000000000000000400000000000000000000000000000003ff0000000000000400000000000000000000000000000000000000000000000')));

SELECT ST_Area(ST_GeomFromText('POLYGON ((0 0,1 0,1 1,0 1,0 0))')), ST_Perimeter(ST_GeomFromText('POLYGON ((0 0,1 0,1 1,0 1,0 0))'));

WITH t AS (SELECT ST_Intersection(ST_GeomFromText('POLYGON ((0 0,4 0,4 4,0 4,0 0))', 'EPSG:3857'), ST_GeomFromText('POLYGON ((4 0,8 0,8 4,4 4,4 0))', 'EPSG:3857')) AS g) SELECT ST_GeometryType(g), ST_Length(g) FROM t;

WITH t AS (SELECT ST_Intersection(ST_GeomFromText('POLYGON ((0 0,8 0,8 8,0 8,0 0),(2 2,2 6,6 6,6 2,2 2))', 'EPSG:3857'), ST_GeomFromText('POLYGON ((2 2,6 2,6 6,2 6,2 2))', 'EPSG:3857')) AS g) SELECT ST_GeometryType(g), ST_Length(g), ST_Area(g) FROM t;

SELECT ST_AsText(ST_Difference(ST_GeomFromText('POLYGON ((0 0,4 0,4 4,0 4,0 0))', 'EPSG:3857'), NULL));

SELECT ST_Distance(ST_GeomFromText('POINT (0 0)','EPSG:4326'),ST_GeomFromText('POINT (3 4)','EPSG:4326')), ST_Distance(ST_GeogFromText('POINT (0 0)'),ST_GeogFromText('POINT (1 0)')) BETWEEN 111195.10117748 AND 111195.10117749;

SELECT ST_GeomFromWKB(UNHEX('0101000000000000000000F87F0000000000000000'), 'EPSG:4326') IS NULL, ST_GeomFromWKB(UNHEX('0101000000000000000000F07F0000000000000000'), 'EPSG:4326') IS NULL, ST_GeomFromWKB(UNHEX('0101000000000000000000F0FF0000000000000000'), 'EPSG:4326') IS NULL;

-- name: test_geo_insert_assignment
CREATE TABLE geo_insert_src (id INT, wkt VARCHAR(160)) PROPERTIES('replication_num'='1');

INSERT INTO geo_insert_binary SELECT id,ST_AsBinary(ST_GeomFromText(wkt,'EPSG:3857')) FROM geo_insert_src;

-- name: test_scalar_geo_geometry

SELECT CASE WHEN true THEN ST_AsText(g) END, hex(ST_AsBinary(g)), g IS NULL from (select ST_GeomFromText('POINT (1 2)', 'EPSG:3857') g) t;

-- name: test_native_geo_topology_incremental_index

SELECT ST_AsText(ST_SimplifyPreserveTopology(ST_GeomFromText('LINESTRING (0 0,0 0,1 0,1 0,2 0,2 0)', 'EPSG:3857'), 0.01));

SELECT ST_AsText(ST_SimplifyPreserveTopology(ST_GeomFromText('POLYGON EMPTY', 'EPSG:3857'), 0.01));

SELECT ST_AsText(ST_SimplifyPreserveTopology(ST_GeomFromText('POINT (1 2)', 'EPSG:3857'), NULL));

insert into nlj_probe select generate_series, generate_series from table(generate_series(1, 10));

select count(*) from nlj_build_multi_chunk left join nlj_probe on nlj_build_multi_chunk.k > nlj_probe.k + 1000000
where abs(nlj_build_multi_chunk.v + coalesce(nlj_probe.v, 0)) > 5
   or abs(nlj_build_multi_chunk.v + coalesce(nlj_probe.v, 0)) < 3;

create database test_number_bf5a0936_6183_11ed_b695_00163e0b9de0;

CREATE TABLE `test_decimal_type6` (
               `dec_1_2` decimal32(2, 1) NOT NULL COMMENT "",
               `dec_18_0` decimal64(18, 0) NOT NULL COMMENT "",
               `dec_18_2` decimal64(18, 18) NOT NULL COMMENT ""
             ) ENGINE=OLAP
             DUPLICATE KEY(`dec_1_2`)
             COMMENT "OLAP"
             DISTRIBUTED BY HASH(`dec_1_2`) BUCKETS 10
             PROPERTIES (
             "replication_num" = "1",
             "enable_persistent_index" = "true"
             );

CREATE TABLE `ollo` (
              `dt_year` datetime NOT NULL COMMENT "yyyy-01-01 00:00:00",
              `dt_month` datetime NOT NULL COMMENT "yyyy-MM-01 00:00:00",
              `dt_day` datetime NOT NULL COMMENT "yyyy-MM-dd 00:00:00",
                ol  DECIMAL(38,18) NOT NULL COMMENT "1",
                lo  DECIMAL(38,18) NOT NULL COMMENT "2"
            ) ENGINE=OLAP 
            DUPLICATE KEY(`dt_year`, `dt_month`, `dt_day`)
            COMMENT "OLAP"
            PARTITION BY RANGE(`dt_day`)
            (PARTITION p20220410 VALUES [('2022-04-10 00:00:00'), ('2022-04-11 00:00:00')),
            PARTITION p20220411 VALUES [('2022-04-11 00:00:00'), ('2022-04-12 00:00:00')),
            PARTITION p20220421 VALUES [('2022-04-21 00:00:00'), ('2022-04-22 00:00:00')))
            DISTRIBUTED BY HASH(`dt_year`) BUCKETS 2
            PROPERTIES ("replication_num" = "1");

insert into t values ('2026-01-01', 1, 101), ('2026-01-01', 2, 102), ('2026-01-02', 1, 201), ('2026-01-03', 1, 301), ('2026-02-03', 1, 2301);

insert overwrite t values ('2026-01-15', 1, 9151), ('2026-02-03', 1, 9231), ('2026-03-05', 1, 9351);

alter table t2 partition by time_slice(b, interval 1 minute);

alter table t partition by time_slice(b, interval 1 day);

alter table t partition by date_trunc('day', k);

alter table t distributed by hash(k) buckets 4;

alter table t partitions(p202006,p202008) distributed by random;

INSERT INTO t VALUES(7, '2020-06-01'),(7, '2020-07-01'),(7, '2020-08-01');

INSERT INTO t VALUES(15, '2020-06-01'),(15, '2020-07-01'),(15, '2020-08-01');

create table tpk(k int) primary key(k) distributed by hash(k) buckets 10;

insert into tpk values(6);

insert into tpk values(14);

-- Mid-optimize, so which partitions have been re-bucketed by now is whatever order the
-- job reached them in -- nothing stable to assert. The one after the wait is the assertion.
-- show partitions from t;
select count(*) from t;

insert into t values(4, '2020-06-01'),(5, '2020-07-02'),(6, '2020-08-02');

insert into t values(4, '2020-06-01'),(5, '2020-07-01'),(6, '2020-08-06');

CREATE TABLE t2 (
  k1 int,
  v1 int
) DUPLICATE KEY(k1)
DISTRIBUTED BY HASH(k1) BUCKETS 2
PROPERTIES ("replication_num" = "1");

select id, variant_typeof(v) from variant_basic order by 1;

select count(*) from image_blob;

set chunk_size = 1024;

-- Insert multiple batches to generate multiple rowsets
INSERT INTO pk_parallel_2 VALUES (1, 1, 'a', 100), (2, 2, 'b', 200);

-- Set very small compaction bytes per subtask to trigger parallel compaction
UPDATE information_schema.be_configs SET VALUE = '1' WHERE name = 'lake_compaction_max_bytes_per_subtask';

-- Create PK table with higher parallel compaction (max_parallel = 5)
CREATE TABLE `pk_parallel_5` (
    `k1` BIGINT NOT NULL,
    `k2` INT NOT NULL,
    `v1` VARCHAR(100),
    `v2` BIGINT
)
PRIMARY KEY(`k1`, `k2`)
DISTRIBUTED BY HASH(`k1`) BUCKETS 1
PROPERTIES (
    "lake_compaction_max_parallel" = "5"
);

INSERT INTO pk_parallel_5 VALUES (15, 15, 'o', 1500), (16, 16, 'p', 1600);

-- Create AGG table with parallel compaction enabled
CREATE TABLE `agg_parallel` (
    `k1` BIGINT NOT NULL,
    `k2` INT NOT NULL,
    `v1` BIGINT SUM,
    `v2` BIGINT MAX
)
AGGREGATE KEY(`k1`, `k2`)
DISTRIBUTED BY HASH(`k1`) BUCKETS 1
PROPERTIES (
    "lake_compaction_max_parallel" = "3"
);

SELECT * FROM agg_parallel ORDER BY k1, k2;

INSERT INTO uniq_parallel VALUES (3, 3, 'c', 300), (4, 4, 'd', 400);

-- NOTE: nothing below distinguishes a parallel compaction from a serial one. Both settle at a
-- single output rowset (each subtask writes segments and tablet_parallel_compaction_manager merges
-- them into one, .cpp:1265-1345), and at this data size the split path is unreachable anyway:
-- _is_large_rowset_for_split needs data_size >= 2 * lake_compaction_max_rowset_size, i.e. 8GiB by
-- default (.cpp:1755,1770), while these tables hold a handful of rows. Measured runs come back with
-- one rowset and one segment, so assertions on either shape pass unchanged if
-- lake_compaction_max_parallel stops taking effect. Covering that needs a direct observation of the
-- subtask count, or the setup test_pk_large_rowset_split uses (it lowers lake_compaction_max_rowset_size
-- to 2MB first).

-- Verify data correctness after compaction (unique results should be same)
SELECT COUNT(*) FROM uniq_parallel;

INSERT INTO pk_no_parallel VALUES (7, 7, 'g', 700), (8, 8, 'h', 800);

-- Alter property back to enable
ALTER TABLE pk_alter_parallel SET ("lake_compaction_max_parallel" = "3");

UPDATE pk_with_updates SET v1 = 'b_v2', v2 = 220 WHERE k1 = 2;

-- NOTE: nothing below distinguishes a parallel compaction from a serial one. Both settle at a
-- single output rowset (each subtask writes segments and tablet_parallel_compaction_manager merges
-- them into one, .cpp:1265-1345), and at this data size the split path is unreachable anyway:
-- _is_large_rowset_for_split needs data_size >= 2 * lake_compaction_max_rowset_size, i.e. 8GiB by
-- default (.cpp:1755,1770), while these tables hold a handful of rows. Measured runs come back with
-- one rowset and one segment, so assertions on either shape pass unchanged if
-- lake_compaction_max_parallel stops taking effect. Covering that needs a direct observation of the
-- subtask count, or the setup test_pk_large_rowset_split uses (it lowers lake_compaction_max_rowset_size
-- to 2MB first).

-- Verify data correctness after compaction
SELECT COUNT(*) FROM pk_with_updates;

INSERT INTO pk_large_data SELECT generate_series, REPEAT('w', 100), generate_series * 10 FROM TABLE(generate_series(3001, 4000));

-- Set write config for multiple segments
UPDATE information_schema.be_configs SET VALUE = 'false' WHERE name = 'enable_load_spill';

UPDATE information_schema.be_configs SET VALUE = '3145728' WHERE name = 'lake_compaction_max_bytes_per_subtask';

insert into tab1 (k1, v1, v2) values (301, 3, 3);

-- name: test_lake_column_partial_update_with_condition_update @sequential @cloud
create database test_lake_column_partial_update_with_condition_update;

CREATE TABLE tab1 (
  k INT NOT NULL,
  v1 INT NULL,
  v2 INT NULL,
  v3 INT NULL,
  ver INT NOT NULL,
  v4 INT NULL
) ENGINE=OLAP
PRIMARY KEY(k)
DISTRIBUTED BY HASH(k) BUCKETS 1
PROPERTIES ("replication_num" = "1");

-- Append a new nullable column with a non-NULL default.
alter table tab1 add column v2 INT NULL DEFAULT "999";

CREATE table tab1 (
      k1 INTEGER,
      v1 CHAR(20),
      v2 VARCHAR(20),
      v3 CHAR(20)
)
ENGINE=OLAP
PRIMARY KEY(`k1`)
DISTRIBUTED BY HASH(`k1`) BUCKETS 10
PROPERTIES (
    "replication_num" = "1"
);

update tab1 set v3 = 'bbb' where k1 = 4;

select pk, get_json_int(j, '$.x'), get_json_string(j, '$.y'), cast(j as varchar) from tab1 order by pk;

insert into tab1 values (100, "k2_100", 100, 100, 100, "v4_100", "v5_100", 100, 100, 100, "v9_100", "v10_100", 100, 100, 100, "v14_100", "v15_100");

-- name: test_partial_update_upsert
show backends;

create database test_partial_update_verify_order;

update tab1 set V1 = 101 where k1 = 100 and k2 = "k2_100";

insert into t1 (k, v1) values (1, 111), (2, 222);

insert into t2 (k, v2) values (1, 2222);

alter table t1 add partitions start ("2024-01-05") end ("2024-01-10") every (interval 1 week);

alter table t2 add partitions start ("2024-01-05") end ("2024-01-10") every (interval 1 week);

select * from partition_unixtime_ms PARTITION(p20210105);

CREATE TABLE partition_unixtime2 (
                        dt bigint,
                        id int
                )
                PARTITION BY RANGE(from_unixtime(dt))(
                START ("2021-01-01") END ("2021-01-10") EVERY (INTERVAL 1 DAY)
                );

alter table partition_unixtime_ms add partition p20231226 VALUES [("2023-12-26"), ("2023-12-27"));

-- "not (dt < c)" normalizes to the same shape and must behave the same way
select dt, id from t_pred_ms where not (dt < 1609689600500) order by id;

-- from_unixtime is NULL for a negative ts, so those rows land in the NULL partition,
-- and a row with a NULL ts lands there too
insert into partition_unixtime_null values(1, 1196440219),(2, 1196440219),(3, 1500000000);

select id, ts from partition_unixtime_null where (ts > 1196440219) is null order by id;

select id, d from partition_years_add_null where not (d <= '2022-01-01') order by id;

select id, d from partition_str_to_date_null where d > '2022-01-01' order by id;

select count(*) from partition_months_add_null;

-- name: test_list_partition_prune_reversed_expr
-- A generated partition column lets the pruner rewrite a predicate on the source column onto the
-- partition column, keeping the comparison operator. That is only sound while the expression grows
-- with its column: an expression that runs backwards deduces a bound pointing the wrong way and
-- prunes the partitions that hold the matching rows.
CREATE TABLE t_reversed (
        c1 int NOT NULL,
        c2 bigint NULL AS (100 - c1)
)
DUPLICATE KEY(c1)
PARTITION BY (c2)
DISTRIBUTED BY HASH(c1) BUCKETS 1
PROPERTIES ("replication_num" = "1");

-- the three branches of a predicate must still add up to the whole table
select count(*) from (
        (select * from t_reversed where c1 < 20)
        union all (select * from t_reversed where c1 >= 20)) t;

select c1 from t_minus_const where c1 < 20 order by c1;

select dt, id from t_retention order by id;

-- The NULL row is in p0, whose upper bound is (-128, 10); the old lookup key (-128, 100) sits above
-- that boundary and selected p1 instead.
select v from t_null_lead where id1 is null and id2 = 100;

-- (40, NULL) is not on a partition boundary, so this one was already correct.
select v from t_null_trail where a = 40 and b is null;

-- ternary logic partitioning: the three branches must add up to the whole table
select count(*) from (
        (select * from bill_detail where bill_code > '998425506019')
        union all (select * from bill_detail where not (bill_code > '998425506019'))
        union all (select * from bill_detail where (bill_code > '998425506019') is null)) t;

select v from t_prefix_null where a >= 5 and a <= 5 order by v;

insert into t_pinned_utc values (1636250400,1);

select dt, id from t_pinned_utc where dt < 1636264800 order by id;

select count(*) from t_unix_ms;

-- name: test_range_partition_prune_strict_bounds
-- Guards the bounds the rewrite must NOT loosen. A range predicate maps onto a partition expression
-- by keeping its comparison operator, and loosening one that did not need it costs more than the
-- pruning it buys: OptOlapPartitionPruner.prunePartitionPredicates reads a bound that meets the last
-- selected partition's range end as implying the predicate and drops the predicate entirely, so rows
-- the predicate rejects come back in the result.
set time_zone = 'Asia/Shanghai';

insert into t_guard_s2d values ('20210101',1),('20210104',4),('20210105',5);

-- name: test_pass_through_cancel
-- Functional smoke test for the local (same-process) pass-through exchange when the
-- receiver is cancelled. An INSERT ... SELECT over a shuffle join whose build (right)
-- side is empty ONLY at runtime makes the hash join short-circuit the probe, which
-- cancels/closes the probe-side pass-through receiver while the sink may still be
-- feeding. The query must complete cleanly and return the correct (empty) result.
create table src (k int, v int) duplicate key(k)
distributed by hash(k) buckets 8 properties("replication_num" = "1");

-- Pass-through path still correct after the short-circuit cancel.
insert into dst select k, count(*), sum(v) from src group by k;

create table TMP like t0;

truncate table TMP;

-- cte join cte
with agged_table as ( select distinct c0, c1 from t0) select /*+SET_VAR(cbo_cte_reuse_rate=-1) */ count(l.c0), count(l.c1) from t0 l join [colocate] (select l.c0, r.c1 from agged_table l join agged_table r on l.c0=r.c0 and l.c1 = r.c1) r on l.c0=r.c0 and l.c1 = r.c1;

set enable_async_profile=true;

set query_debug_options = '{"execDebugOptions":[{"plan_node_id":3, "debug_action":"BLOCK_SOURCE_OPERATOR", "value":500}]}';

select c1, count(*) from t0 group by c1 order by c1;

set query_debug_options = '{"execDebugOptions":[{"plan_node_id":3, "debug_action":"BLOCK_SINK_OPERATOR", "value":100}]}';

set query_debug_options = '{"execDebugOptions":[{"plan_node_id":4, "debug_action":"BLOCK_SINK_OPERATOR", "value":100}]}';

insert into t2 SELECT generate_series FROM TABLE(generate_series(1, 200));

insert into t0 SELECT generate_series, 4096 - generate_series, generate_series FROM TABLE(generate_series(1, 1000));

-- case2: grf exceed
set runtime_join_filter_push_down_limit = 1;

-- name: test_prepare_statement
create database test_prepare_1;

PREPARE cte_stmt_1 FROM with cte as (select * from prepare_stmt where k1 = ?) select * from cte where v9 = ?;

set @t = '2021-02-01 00:00:12';

-- deallocate is alias
drop prepare stmt3;

SET @customer_key = 1;

CREATE MATERIALIZED VIEW `mv1` AS
SELECT `v1`, SUM(`v2`) FROM `t0`
GROUP BY `v1`;

INSERT INTO `t0` (v1, v2, v3) values
    (1, 1, 1),
    (1, 1, 2),
    (1, 1, 3),
    (1, 2, 4),
    (1, 2, 5),
    (1, 2, 6),
    (2, 3, 7),
    (2, 3, 8),
    (2, 3, 9),
    (2, 4, 10),
    (2, 4, 11),
    (2, 4, 12);

-- name: test_push_down_distinct_below_window_join
DROP TABLE if exists pdw_t0;

INSERT INTO pdw_t2 VALUES (1,1,1),(2,2,2),(3,3,3);

select x.v1, x.s from (select distinct v1, sum(v3) over (partition by v2) as s from pdw_t0) x join pdw_t1 on x.v1 = pdw_t1.v4 join pdw_t2 on pdw_t1.v4 = pdw_t2.v7 order by 1,2;

select e, s from (select distinct v1 + v3 as e, sum(v3) over () as s from pdw_t3) t order by 1,2;

insert into t_heavy select g, case when g % 97 = 0 then 'n' else 'y' end, case when g % 200 = 1 then concat('a/b/c/no-date-', cast(g as string)) else concat('a/b/c/2026-07-15/part-', cast(g as string)) end from (select generate_series as g from table(generate_series(1001, 1200))) t;

insert into t_heavy select g, case when g % 97 = 0 then 'n' else 'y' end, case when g % 200 = 1 then concat('a/b/c/no-date-', cast(g as string)) else concat('a/b/c/2026-07-15/part-', cast(g as string)) end from (select generate_series as g from table(generate_series(2601, 2800))) t;

select /*+SET_VAR(push_down_heavy_exprs=false)*/ substr(s, 1, 6) as p, min(nullif(regexp_extract(s, '(\\d\\d\\d\\d-\\d\\d-\\d\\d)', 1), '')) as k from t_heavy where flag = 'y' group by p;

INSERT INTO t0_pk (ts,k0,k1,v0,v1)
VALUES
('2022-01-11 20:42:26', 'n4AGcEqYp', 'hhbawx', '799393174109549', '8029.42'),
('2022-01-27 18:17:59', 'i66lt', 'mtrtzf', '100400167', '10000.88'),
('2022-01-28 20:10:44', 'z6', 'oqkeun', '-58681382337', '59881.87'),
('2022-01-29 14:54:31', 'qQ', 'dzytua', '-19682006834', '43807.02'),
('2022-01-31 08:08:11', 'qQ', 'dzytua', '7970665929984223925', '-8947.74'),
('2022-01-15 00:40:58', '65', 'hhbawx', '4054945', '156.56'),
('2022-01-24 16:17:51', 'onqR3JsK1', 'udtmfp', '-12962', '-72127.53'),
('2022-01-01 22:36:24', 'n4AGcEqYp', 'fabnct', '-50999821', '17349.85'),
('2022-01-21 08:41:50', 'Nlpz1j3h', 'dzytua', '-60162', '287.06'),
('2022-01-30 23:44:55', '', 'slfght', '62891747919627339', '8014.98'),
('2022-01-18 19:14:28', 'z6', 'dzytua', '-1113001726', '73258.24'),
('2022-01-30 14:54:59', 'z6', 'udtmfp', '111175577438857975', '-15280.41'),
('2022-01-08 22:08:26', 'z6', 'ympyls', '3', '2.07'),
('2022-01-03 08:17:29', 'Nlpz1j3h', 'udtmfp', '-234492', '217.58'),
('2022-01-27 07:28:47', 'Pc', 'cawanm', '-1015', '-20631.50'),
('2022-01-17 14:07:47', 'Nlpz1j3h', 'lbsvqu', '2295574006197343179', '93768.75'),
('2022-01-31 14:00:12', 'onqR3JsK1', 'umlkpo', '-227', '-66199.05'),
('2022-01-05 20:31:26', '65', 'lbsvqu', '684307', '36412.49'),
('2022-01-06 00:51:34', 'z6', 'dzytua', '11700309310', '-26064.10'),
('2022-01-26 02:59:00', 'n4AGcEqYp', 'slfght', '-15320250288446', '-58003.69'),
('2022-01-05 03:26:26', 'z6', 'cawanm', '19841055192960542', '-5634.36'),
('2022-01-17 08:51:23', 'Pc', 'ghftus', '35476438804110', '13625.99'),
('2022-01-30 18:56:03', 'n4AGcEqYp', 'lbsvqu', '3303892099598', '8.37'),
('2022-01-22 14:17:18', 'i66lt', 'umlkpo', '-27653110', '-82306.25'),
('2022-01-02 10:25:01', 'qQ', 'ghftus', '-188567166', '71442.87'),
('2022-01-30 04:58:14', 'Pc', 'ympyls', '-9983', '-82071.59'),
('2022-01-05 00:16:56', '7Bh', 'hhbawx', '43712', '84762.97'),
('2022-01-25 03:25:53', '65', 'mtrtzf', '4604107', '-2434.69'),
('2022-01-27 21:09:10', '65', 'udtmfp', '476134823953365199', '38736.04'),
('2022-01-11 13:35:44', '65', 'qmwhvr', '1', '0.28'),
('2022-01-03 19:13:07', '', 'lbsvqu', '11', '-53084.04'),
('2022-01-20 02:27:25', 'i66lt', 'umlkpo', '3218824416', '-71393.20'),
('2022-01-04 04:52:36', '7Bh', 'ghftus', '-112543071', '-78377.93'),
('2022-01-27 18:27:06', 'Pc', 'umlkpo', '477', '-98060.13'),
('2022-01-04 19:40:36', '', 'udtmfp', '433677211', '-99829.94'),
('2022-01-20 23:19:58', 'Nlpz1j3h', 'udtmfp', '361394977', '-19284.18'),
('2022-01-05 02:17:56', 'Pc', 'oqkeun', '-552390906075744662', '-25267.92'),
('2022-01-02 16:14:07', '65', 'dzytua', '132', '2393.77'),
('2022-01-28 23:17:14', 'z6', 'umlkpo', '61', '-52028.57'),
('2022-01-12 08:05:44', 'qQ', 'hhbawx', '-9579605666539132', '-87801.81'),
('2022-01-31 19:48:22', 'z6', 'lbsvqu', '9883530877822', '34006.42'),
('2022-01-11 20:38:41', '', 'piszhr', '56108215256366', '-74059.80'),
('2022-01-01 04:15:17', '65', 'cawanm', '-440061829443010909', '88960.51'),
('2022-01-05 07:26:09', 'qQ', 'umlkpo', '-24889917494681901', '-23372.12'),
('2022-01-29 18:13:55', 'Nlpz1j3h', 'cawanm', '-233', '-24294.42'),
('2022-01-10 00:49:45', 'Nlpz1j3h', 'ympyls', '-2396341', '77723.88'),
('2022-01-29 08:02:58', 'n4AGcEqYp', 'slfght', '45212', '93099.78'),
('2022-01-28 08:59:21', 'onqR3JsK1', 'oqkeun', '76', '-78641.65'),
('2022-01-26 14:29:39', '7Bh', 'umlkpo', '176003552517', '-99999.96'),
('2022-01-03 18:53:37', '7Bh', 'piszhr', '3906151622605106', '55723.01'),
('2022-01-04 07:08:19', 'i66lt', 'ympyls', '-240097380835621', '-81800.87'),
('2022-01-28 14:54:17', 'Nlpz1j3h', 'slfght', '-69018069110121', '90533.64'),
('2022-01-22 07:48:53', 'Pc', 'ympyls', '22396835447981344', '-12583.39'),
('2022-01-22 07:39:29', 'Pc', 'uqkghp', '10551305', '52163.82'),
('2022-01-08 22:39:47', 'Nlpz1j3h', 'cawanm', '67905472699', '87831.30'),
('2022-01-05 14:53:34', '7Bh', 'dzytua', '-779598598706906834', '-38780.41'),
('2022-01-30 17:34:41', 'onqR3JsK1', 'oqkeun', '346687625005524', '-62475.31'),
('2022-01-29 12:14:06', '', 'qmwhvr', '3315', '22076.88'),
('2022-01-05 06:47:04', 'Nlpz1j3h', 'udtmfp', '-469', '42747.17'),
('2022-01-19 15:20:20', '7Bh', 'lbsvqu', '347317095885', '-76393.49'),
('2022-01-08 16:18:22', 'z6', 'fghmcd', '2', '90315.60'),
('2022-01-02 00:23:06', 'Pc', 'piszhr', '-3651517384168400', '58220.34'),
('2022-01-12 08:23:31', 'onqR3JsK1', 'udtmfp', '5636394870355729225', '33224.25'),
('2022-01-28 10:46:44', 'onqR3JsK1', 'oqkeun', '-28102078612755', '6469.53'),
('2022-01-23 23:16:11', 'onqR3JsK1', 'ghftus', '-707475035515433949', '63422.66'),
('2022-01-03 05:32:31', 'z6', 'hhbawx', '-45', '-49680.52'),
('2022-01-27 03:24:33', 'qQ', 'qmwhvr', '375943906057539870', '-66092.96'),
('2022-01-25 20:07:22', '7Bh', 'slfght', '1', '72440.21'),
('2022-01-04 16:07:24', 'qQ', 'uqkghp', '751213107482249', '16417.31'),
('2022-01-23 19:22:00', 'Pc', 'hhbawx', '-740731249600493', '88439.40'),
('2022-01-05 09:04:20', '7Bh', 'cawanm', '23602', '302.44');

INSERT INTO av1 VALUES (1,100),(2,100),(3,100),(4,100),(5,100),(6,100),(7,100),(8,100);

-- The other direction, on a table whose entries are cold, so the failure cannot hide behind
-- whichever order happened to run first.
CREATE TABLE af2 (
  dt date NOT NULL,
  c1 int NOT NULL,
  ts bigint NOT NULL,
  v1 bigint NOT NULL
) ENGINE=OLAP
DUPLICATE KEY(dt, c1)
PARTITION BY RANGE(dt) (START ("2022-01-01") END ("2022-02-01") EVERY (INTERVAL 1 day))
DISTRIBUTED BY HASH(c1) BUCKETS 4
PROPERTIES("replication_num" = "1");

-- Empty build side. Before the fix this hung until query_timeout with the cache on.
set enable_query_cache = true;

-- The cost-based gate wants a TopN-with-limit or a limit-after-join at the plan root; this shape
-- has an aggregation there, so GLM is forced on to reach the same plan a top-level LIMIT would.
set enable_global_late_materialization = true;

select sum(s) from (select n1.c1, sum(n1.v1) s from n1 join n2
  on n1.c1 = n2.c1 and (n2.ts % 9) > n1.ts and (n2.ts % 9) < n1.v1 group by n1.c1) x;

-- And the cache must still be usable afterwards -- the entry is invalidated, not disabled.
set enable_query_cache = true;

-- name: test_query_cache_topn_filter_stale_entry
-- c1 is both the distribution key and the group-by key, so `group by c1 order by c1 limit 10` is
-- planned as a one-phase aggregation and the partial TopN stays in the scan fragment, right above
-- the aggregation where the query cache interpolates its cache operator. That SortNode builds a
-- TOPN_FILTER that probes the scan feeding the cache point, so the per-tablet results that get
-- populated only hold the rows below the boundary that filter happened to reach. The
-- boundary is a property of the whole query's data scope, not of the tablet, and it is not part of
-- the cache key -- so the entries are only accidentally safe while every later reader's scope is a
-- superset of the writer's. Dropping the partitions that held the small keys narrows the scope,
-- and the surviving tablets keep their version and their region, hence their entries are reused.
CREATE TABLE days (d int) DUPLICATE KEY(d) DISTRIBUTED BY HASH(d) BUCKETS 1
PROPERTIES("replication_num" = "1");

alter table t1 drop partition p20220103;

-- Two well-separated clusters: ids 1..10 near [1,1,1,1,1], ids 101..110 near [9,9,9,9,9].
-- A query vector near one cluster returns that cluster's ids, so the two vectors below select
-- disjoint build-side rows -- and since the ids straddle 50, the two answers differ.
INSERT INTO wvec VALUES
 (1,[1,1,1,1,1]),(2,[1,1,1,1,2]),(3,[1,1,1,2,1]),(4,[1,1,2,1,1]),(5,[1,2,1,1,1]),
 (6,[2,1,1,1,1]),(7,[1,1,1,2,2]),(8,[1,1,2,2,1]),(9,[1,2,2,1,1]),(10,[2,2,1,1,1]),
 (101,[9,9,9,9,9]),(102,[9,9,9,9,8]),(103,[9,9,9,8,9]),(104,[9,9,8,9,9]),(105,[9,8,9,9,9]),
 (106,[8,9,9,9,9]),(107,[9,9,9,8,8]),(108,[9,9,8,8,9]),(109,[9,8,8,9,9]),(110,[8,8,9,9,9]);

select ifnull(sum(s),0) from (select w2.c1, sum(w2.v1) s from w2
  join (select c0 as k from wvec order by approx_l2_distance([9,9,9,9,9], vec) limit 5) b
  on w2.ts > b.k group by w2.c1) x;

insert into t0 values('2023-01-02', 'foo_0001', 'bar_0011', 1);

truncate table _statistics_.query_history;

set global query_history_load_interval_seconds=900;

insert into t values(1,1);

create table t1(k int, v int) partition by range(k) (partition p1 values less than ("0")) distributed by random;

alter table t add partition p5 values less than ("50") distributed by hash(k) buckets 10;

create table t5(k int, v int sum) aggregate key(k) distributed by hash(k);

REFRESH MATERIALIZED VIEW tva WITH SYNC MODE;

create table ref (
    k1 int,
    k2 int,
    id bigint,
    v int
)
duplicate key(k1)
distributed by hash(k1) buckets 1
properties('replication_num' = '1');

-- Step 3: new rows still get fresh ids, and the dual write reaches the MV.
insert into t (k1, k2, v) values (100, 100, 100);

-- Step 6: ADD ROLLUP with an independent sort key that includes id keeps ids stable.
truncate table ref;

insert into ref2 select k1, k2, id, v from t2;

-- Step 8: a PRIMARY KEY table whose AUTO_INCREMENT column is a non-key column is still rejected.
create table t4 (
    k1 int not null,
    id bigint not null auto_increment,
    v int
)
primary key(k1)
order by(k1)
properties('replication_num' = '1');

-- The join on the colocate column is still planned colocated, and a colocated scan fails unless every
-- tablet of both tables lies inside one ColocateRange. It returns the same rows as a join that is not
-- colocated.

select count(*), sum(t1.v), sum(t2.w) from t1 join t2 on t1.k1 = t2.k1;

-- No rejected ALTER registered a job.

-- Accepted: the new sort key (k1, k3) keeps the colocate column k1 first.
alter materialized view mv1 order by (k1, k3);

create table t (
    k1 int not null,
    k2 int not null,
    v int not null
)
duplicate key(k1, k2)
order by(k1, k2)
properties('replication_num' = '1');

alter materialized view mv_plain order by (k2, k1);

select count(*) from t where c1 = 3;

alter table t split tablet properties('tablet_reshard_target_size' = '1024');

insert into t values (1, 1, 300, 'c'), (2, 2, 200, 'b'), (3, 3, 100, 'a');

insert into t values (2, 2, 20, 'bb');

-- Rejected: a split of this shape rewrites the children wholesale, which needs bundled files.
create table t_no_bundling (
    k1 int not null,
    v1 int not null
)
primary key(k1)
order by(v1)
properties('replication_num' = '1', 'file_bundling' = 'false');

-- name: test_range_orderby_dml @cloud
-- SQL integration: write paths on a range-distributed PRIMARY KEY table whose ORDER BY
-- differs from the primary key. Routing and dedup live in primary-key space, so upsert,
-- UPDATE, condition update and DELETE must behave exactly as on any other primary key table.
-- Partial update has rules of its own on this shape; those live in
-- test_range_orderby_partial_update.
set enable_range_distribution = true;

-- UPDATE with a WHERE clause rewrites whole rows, sort key columns included.
update t set v1 = 50, v2 = 'y' where k1 = 1 and k2 = 2;

create table t (
    k1 int not null,
    k2 int not null,
    v1 int not null,
    v2 varchar(32) not null,
    c1 int not null,
    c2 int not null,
    c3 int not null,
    c4 int not null
)
primary key(k1, k2)
order by(v1, v2)
properties('replication_num' = '1');

-- Without a WHERE clause UPDATE becomes a partial update, so the same rule applies: a set
-- of columns that misses the sort key is refused ...
update t set c1 = 998;

-- v1 descends as the primary key ascends, so the sort order is the reverse of the routing
-- order. The md5 padding resists compression, so the tablet really does reach the threshold.
insert into t
select x, x % 7, 100000 - x, repeat(md5(cast(x as varchar)), 6), x, x * 2, x * 3, x * 4
from table(generate_series(1, 20000)) as g(x);

select k1, k2, v1, c1, c2 from t where k1 = 19000;

alter table t split tablet partition(p1) properties('tablet_reshard_target_size' = '1024');

-- name: test_range_orderby_split @cloud @sequential
-- SQL integration: splitting a range-distributed PRIMARY KEY table whose ORDER BY differs
-- from the primary key. Such a split cannot range-filter the parent's shared segments, so
-- every child is rewritten wholesale by an UNSHARE compaction while reads keep being served
-- from the parent. Data must be intact throughout, and writes must land on the children
-- afterwards.
--
-- [UC] on the split statement only avoids asserting on its uuid-bearing message; that the
-- fan-out really happened is asserted separately, on the partition's bucket count.
set enable_range_distribution = true;

-- Writes after the split: a new row, an upsert of an existing primary key, and a delete.
insert into t values (999999, 1, 1, 'tail');

-- r_dup's DUPLICATE KEY (k2) is a strict prefix of its sort key (k2, k1); its tablets are cut on both columns.
alter table t add rollup r_dup(k2, k1, v1) duplicate key(k2) order by (k2, k1);

-- v1 leads the sort key of r_v but is not in the base sort key: it can be neither dropped nor retyped.
alter table t add rollup r_v(v1, k1) order by (v1, k1);

-- name: test_set_partition_version @native

CREATE TABLE t (a int);

analyze sample table activities with sync mode;

-- Only good rows committed
select * from t order by id;

-- Row 2: "toolongname" (11 chars) > varchar(5)

select * from t order by id;

-- =============================================================
-- ORC rejection via INSERT FROM FILES (stream load does not accept orc).
-- =============================================================

-- name: test_rejected_records_orc_type_mismatch @sequential
-- INSERT INTO ... SELECT * FROM FILES('format'='orc'): bad row rejected in tablet_sink.
-- Uses the same OSS-based fixture distribution as the parquet case.

-- =============================================================
-- Row access policy
-- =============================================================

-- name: test_rejected_records_row_access_policy @sequential
-- Non-root user sees only records for tables they hold SELECT on.

-- =============================================================
-- INSERT FROM FILES with CSV: load_type tagged INSERT, raw_record
-- captured for the rejected row.
-- =============================================================

-- name: test_rejected_records_files_csv @sequential
-- Verifies that INSERT FROM FILES (CSV format) writes a rejected_records
-- row tagged as load_type=INSERT, with raw_record populated. The
-- rejection here is a NULL_VIOLATION raised in tablet_sink (cast('bad'
-- as int) yields NULL on a NOT NULL column), not a per-row capture from
-- csv_scanner; that path doesn't carry the file name into source_info,
-- so we don't assert on source_info content here.
-- CSV files have no header, so columns are referenced positionally
-- ($1, $2) rather than by name.

SELECT sleep(5);

insert into t1 select row_number() over() as idx from __row_util_base;

-- name: test_create_resource_group_with_mem_pool

drop resource group shared_resource_group_for_test_user;

alter resource group shared_resource_group_for_james with (
    'max_cpu_cores' = "1"
);

drop resource group shared_resource_group_for_brad;

alter resource group shared_resource_group_for_vader with (
    'mem_limit' = '99%',
    'mem_pool' = 'other_pool'
);

ALTER TABLE tbl2 MODIFY COLUMN k2 BIGINT;

SELECT k3, k2, mv_sum_v1 FROM mv_1 [_SYNC_MV_] ORDER BY 1, 2;

-- name: test_show_alter_materialized_view_predicates
-- Test Point:
--   SHOW ALTER MATERIALIZED VIEW answers from the same layout. ShowAlterStmtAnalyzer routes both
--   ROLLUP and MATERIALIZED_VIEW to /jobs/<dbId>/rollup, and a synchronous materialized view is
--   stored as a rollup index -- processCreateMaterializedView and processBatchAddRollup both end
--   in MaterializedViewHandler#createMaterializedViewJob. So the predicates were dropped on this
--   statement too, and they have to come back on it too.
-- Method: mirrors the rollup case above, through the materialized view spelling of the statement.

SHOW ROUTINE LOAD FOR rl_commit_offset;

select timestamp_progress from information_schema.routine_load_jobs where name = "rl_offset_lag" order by id desc limit 1;

-- name: test_multicolumn_global_runtime_filter_prune_column @slow
set enable_multicolumn_global_runtime_filter=true;

INSERT INTO TABLE_OBJECT SELECT generate_series, generate_series, [1, 2, 3, 4, 5] FROM TABLE(generate_series(1, 1000000));

-- Without a join, as the reference: NULL -> 38 rows, 5 -> 19 rows, none of them rejected by s <> 'b'.
SELECT dk, COUNT(*) AS c, SUM(IF(s IS NULL OR s = 'b', 1, 0)) AS rejected FROM probe_t
WHERE s <> 'b' AND (dk IS NULL OR dk = 5) GROUP BY dk ORDER BY dk;

-- 800 probe rows: 100 keys x 50 dates
INSERT INTO t_a SELECT g % 100, g % 50, g FROM TABLE(generate_series(0, 799)) t(g);

SELECT CAST(regexp_extract(get_query_profile(last_query_id()), '(?s)EXCHANGE_SINK \\(plan_node_id=9\\):.*?PushRowNum: ([0-9]+)', 1) AS BIGINT) < 800;

insert into t1 select idx, 4, 4 from __row_util where idx < 160000 - 10;

set global_runtime_filter_wait_timeout = 10000;

INSERT INTO b_minus SELECT generate_series - 4000 FROM TABLE(generate_series(1, 100));

-- Controls: arithmetic on the build side, and a bare probe key. Neither takes the expression path.
SELECT count(*) FROM p JOIN [broadcast] b_minus b ON p.a = b.k + 4000;

INSERT INTO big
SELECT date_add('2024-01-01', interval (generate_series % 7) day),
       concat('u', generate_series % 200),
       concat('d', generate_series % 20),
       concat('p', generate_series % 5),
       generate_series
FROM table(generate_series(1, 4000));

SELECT if(count(1) > 0, "yes", "no") AS local_in_filter_delivered FROM (
  SELECT unnest AS line FROM (values(1))t(v)
  JOIN unnest(split(get_query_profile(last_query_id()), "\n"))
) p
WHERE trim(line) LIKE "- RuntimeInFilterNum: %"
  AND cast(regexp_extract(trim(line), "- RuntimeInFilterNum: ([0-9]+)", 1) AS int) > 0;

USE test_runtime_filter_scenarios;

SELECT
  if(sum(CASE WHEN trim(line) LIKE "- RuntimeInFilterNum: %"
               AND cast(regexp_extract(trim(line), "- RuntimeInFilterNum: ([0-9]+)", 1) AS int) > 0
              THEN 1 ELSE 0 END) > 0, "yes", "no") AS local_in_filter_delivered,
  if(sum(CASE WHEN trim(line) LIKE "- RuntimeFilterDesc: %" THEN 1 ELSE 0 END) > 0,
     "yes", "no") AS bloom_filter_delivered
FROM (
  SELECT unnest AS line FROM (values(1))t(v)
  JOIN unnest(split(get_query_profile(last_query_id()), "\n"))
) p;

DROP DATABASE test_runtime_filter_scenarios;

with cte0 as (
select t1.c0, sum(murmur_hash3_32(t1.c1)) as c1, sum(murmur_hash3_32(t1.c2)) as c2
from t1
group by t1.c0
), 
cte1 as(
select  cte0.c0, sum(cte0.c1) c1, sum(cte0.c2) c2
from cte0 LEFT SEMI JOIN[broadcast] t0 on t0.c0 = cte0.c0
group by 1
),
cte2 as( 
select cte1.c0, cte1.c1, cte1.c2, murmur_hash3_32(t2.c0) as e0, murmur_hash3_32(t2.c1) as e1, murmur_hash3_32(t2.c2) as e2
from cte1 inner join[shuffle] t2 on cte1.c0 = t2.c0
)
select coalesce(sum(murmur_hash3_32(c0)+c1+c2+e0+e1+e2), 0)  as fingerprint
from cte2;

-- name: test_scan_or_not_in_null_dropped_column
-- `c NOT IN (.., NULL)` never holds, so the scan predicate builder drops it from an OR without leaving a predicate on c.
-- The FE had already marked c unused (only pushed-down conjuncts read it), so c was read but neither filtered on nor
-- output, and SegmentIterator::_finish_late_materialization wrote past the output chunk (SIGSEGV, issue #80374).
create table t_or_notin_str (id int not null, b varchar(20) null, c varchar(20) null)
duplicate key(id) distributed by hash(id) buckets 1 properties("replication_num" = "1");

select /*+ SET_VAR(enable_predicate_col_late_materialize = false) */ id from t_or_notin_str where b > 'X' or c not in ('Y', NULL) order by id;

select count(*), count(distinct v) from dict_reject_whole_page;

-- c2: unique 500-byte strings (never dictionary encoded, ~130 rows per page) whose prefix is the block id, so its zone
-- map keeps block 10 of every 40-block cycle (2560 rows) and nothing else. s: plain varchar whose page holds thousands
-- of rows, so one page of s contains at least two surviving sub-ranges; blocks 11..19 are NULL, which is exactly where
-- a linear walk of the null flags would land for the second sub-range.
create table predicate_lm_sparse_nulls (k bigint, c2 varchar(600), s varchar(64), v int)
duplicate key(k) distributed by hash(k) buckets 1 properties("replication_num" = "1");

drop table if exists predicate_lm_sparse_nulls;

-- arguments
select count(k1), sum(k1), sum(k2) from t1 sample('method'='by_nothing');

-- page sample
-- somehow, the result is unstable
-- select count(k1), sum(k1) from t1 sample('seed'='1', 'method'='by_page', 'percent'='1');
-- select count(k1), sum(k1) from t1 sample('seed'='1', 'method'='by_page', 'percent'='10');
-- select count(k1), sum(k1) from t1 sample('seed'='123', 'method'='by_page', 'percent'='10');

-- delete data
delete from t1 where k2 = 1;

-- by_page needs the scan to read a single column, so use a single-column table here.
create table t1_page (k1 int) duplicate key(k1) distributed by hash(k1) buckets 1 properties("replication_num" = "1");

SET enable_pipeline_engine = true;

SET tablet_internal_parallel_mode = 'force_split';

SELECT * FROM string_probe ORDER BY k, suffix;

SELECT * FROM widening_probe ORDER BY k,s,d;

CREATE TABLE t1 (
    k1 int,
    v1 int,
    v2 string
) DUPLICATE KEY(k1)
DISTRIBUTED BY HASH(k1) BUCKETS 1
PROPERTIES ("replication_num" = "1");

select count(*) from t1 where v1 = 20;

-- Written before the column exists, so no segment physically contains it.
insert into t_v2_bundled select x, x * 13 + 1, repeat('x', 32) from table(generate_series(1, 2000)) t(x);

select assert_true(count(*) = 100) from t_v2_bundled where bfc = 7;

-- Case C: fast schema evolution v2 disabled. The tablet metadata schema syncs
-- through the older path, so name resolution succeeds and the failure used to
-- surface from the other layer instead (".dat does not contain column of id N").
CREATE TABLE t_v1 (
    k bigint NOT NULL,
    v bigint,
    pad varchar(64)
) DUPLICATE KEY(k)
DISTRIBUTED BY HASH(k) BUCKETS 1
PROPERTIES (
    "replication_num" = "1",
    "cloud_native_fast_schema_evolution_v2" = "false"
);

-- Case D: file bundling off, historical data present. Bundling changes how
-- segments are packed into physical files, which the per-segment index builder
-- has to account for, so both settings are covered.
CREATE TABLE t_unbundled (
    k bigint NOT NULL,
    v bigint,
    pad varchar(64)
) DUPLICATE KEY(k)
DISTRIBUTED BY HASH(k) BUCKETS 1
PROPERTIES (
    "replication_num" = "1",
    "file_bundling" = "false",
    "cloud_native_fast_schema_evolution_v2" = "true"
);

insert into t_nullable select x, x from table(generate_series(1, 500)) t(x);

-- Case G: PRIMARY KEY table. The soak run hit this on t_pk_0 too, and PK tablets
-- publish through a different txn-log applier than non-PK ones, so the schema
-- installation has to propagate on both.
CREATE TABLE t_pk (
    k bigint NOT NULL,
    v bigint
) PRIMARY KEY(k)
DISTRIBUTED BY HASH(k) BUCKETS 1
PROPERTIES ("replication_num" = "1");

insert into t_bitmap select x, x from table(generate_series(1, 1000)) t(x);

select count(*) from t1 where v2 = 's_300';

delete from t1 where k1 = 600;

select count(*) from t1 where v2 = 'apple';

-- Columns present at CREATE TABLE: index historical data after renaming.
CREATE TABLE t_original (
    k int,
    b int,
    s varchar(64),
    f int
) DUPLICATE KEY(k)
DISTRIBUTED BY HASH(k) BUCKETS 1
PROPERTIES ("replication_num" = "1");

select assert_true(count(*) = 2) from t_original where br = 20;

insert into t_added (k, br) values (3, 9);

insert into t_reused select x, x, x + 10000 from table(generate_series(1, 2000)) t(x);

select count(*) from t_reused where v = 10200;

update t_noidx set v1 = 777 where k1 <= 2;

select * from t_fast order by k1;

select * from t_bf order by k1;

-- Drive profile-based assertion that the IDG-backed NGRAMBF was actually
-- consulted. We verify the BloomFilterFilter counter has non-zero time
-- (= the .idx file was opened and the ngram BF probed). The data was
-- inserted BEFORE the alter, so the BF can only come from the IDG
-- sidecar (.idx) — segment footers have no BF payload.
set enable_profile = true;

CREATE TABLE t1 (
    k1 int,
    v1 int,
    v2 varchar(32)
) DUPLICATE KEY(k1)
DISTRIBUTED BY HASH(k1) BUCKETS 1
PROPERTIES ("replication_num" = "1");

INSERT INTO t1 values(1, '2022-04-17 00:00:00', 'k3', 1, 1, 1.0, 'k7'), (2, '2022-04-20 00:00:00', 'k4', 1, 1, 1.0, 'k7');

alter table t1 drop column k7;

drop security integration ldap_pattern;

insert into sc2 values (1, [11,NULL,31,41], [map{11: 110}, map{101: 101}], [row(11, 12), row(12, 13)], map{14: 41, NULL: 11, 12: 31}, map{101: [1, 10, 11, 23]}, map{101: row(NULL, 12)}, row(1, [1, 10, 11], map{101: 111, NULL: NULL}, row(111, 110)));

insert into sc2 values (4, [14,24,3,44], [map{44: 440}, map{404: 401}], [row(41, 42), row(42, 43)], map{44: 44, 46: 14, 42: 34}, map{3: [4, 3, 41, 23]}, map{404: row(41, 42)}, row(3, [4, 3, 41], map{3: 444}, row(110, 330)));

select * from sc2 where array3 = [row(21,22),null] order by v1;

select cast(row(1, null) as struct<a int, b array<int>>);

select * from sc2 where map1 = map{null:null, 54:45,56:15} order by v1;

select array1 = [map{"a":21,"b":22},null] from sc2 order by v1;

select map1 = map{44:44,46:14,42:34} from sc2 order by v1;

select map1 = map{null:null, 54:45,56:15} from sc2 order by v1;

select * from sc2 where array3 = [map{"a":21,"b":22},3] order by v1;

select * from sc2 where map3 = map{505:row(3, 52)} order by v1;

select array3 <=> [row(21,22),null] from sc2 order by v1;

select map2 <=> map{null:null} from sc2 order by v1;

select st1 <=> named_struct("s1", 5,"s2",[5,50,51],"s3",null,"s4", row(null,550)) from sc2 order by v1;

select array3 != [row(21,22),null] from sc2 order by v1;

select map2 != map{null:null} from sc2 order by v1;

select st1 != named_struct("s1", 5,"s2",[5,50,51],"s3",null,"s4", row(null,550)) from sc2 order by v1;

select map{1:1,null:2} != map{null:3,1:null};

SELECT count(c2) FROM t1;

SELECT id, my_json_col->'$.key1' FROM test_json_config ORDER BY id;

SELECT id, my_json_col->'$.key3' FROM test_json_config ORDER BY id;

-- Step 7: Disable flat JSON again
ALTER TABLE test_json_config SET ("flat_json.enable" = "false");

SELECT my_json_col->'$.key1' FROM test_json_config ORDER BY id;

insert into test_json_cast_map values
(1, '{"level1": {"level2": {"level3": {"level4": {"5":"abc"}}}}}'),
(2, '{"level1": {"level2": {"level3": {"level4": {}}}}}');

insert into test_json_cast_map values
(1, '{"level1": {"level2": {"level3": {"level4": {"5":"abc"}}}}}'),
(2, '{"level1": {"level2": {"level3": {"level4": {}}}}}'),
(3, '{"level1": {"level2": {"level3": {}}}}'),
(4, '{"level1": {"level2": {}}}'),
(5, '{"level1": {}}');

CREATE TABLE test_json_cast_map (c1 int, c2 json) 
DISTRIBUTED BY RANDOM BUCKETS 1;

-- bucket 5
drop table test_json_cast_map;

select c2 -> '$.k9.k2.k2' from t_flat_json_remain;

insert into t_flat_json_remain values
(1, '{"k9": {"k2": {"k0": "A", "k1": "B", "k2": 10, "k3": 20, "k4": "Z"}}}'),
(2, '{"k9": {"k1": "JSON"}}');

-- Test dict_merge function
select dict_merge(get_json_string(c1, 'f1'), 255) from js2 [_META_];

-- inspect the dict itself
select get_json_string(inspect_global_dict('js2', 'c1'), 'dict');

select min(get_json_string(c1, 'f2')) from js2;

select get_json_string(c1, 'f5') k1, count(*) from js2 group by k1 order by k1 limit 3;

-- Test mixed data types with string
insert into js2 
select 
    generate_series, 
    json_object(
        'f1', generate_series % 10,                                 -- integer
        'f2', cast((generate_series % 20) * 1.5 as double),         -- float
        'f3', if(generate_series % 2 = 0, true, false),             -- boolean
        'f4', null,                                                 -- null
        'f5', json_array(generate_series % 5, 'arr', 1.23)          -- array
        )
from (table(generate_series(1, 1000)));

select get_json_string(inspect_global_dict('js3', 'c1.null_field'), 'dict');

select get_json_string(inspect_global_dict('js3', 'c1.deep_nested.level1.level2'), 'dict');

create view profile_filter_rows as
select trim(unnest) as line
from table(unnest(split(get_query_profile(last_query_id()), '\n')))
where unnest like '%FilterRows%'
and trim(unnest) not like '- %: 0'
order by unnest;

select * from js2 where get_json_int(j1, '$.f1') in (1, 2, 3, 4);

select get_json_int(j1, '$.f2') from js2 where get_json_int(j1, '$.f1') = 1;

select * from js2 where get_json_int(j1, '$.f2') = 1;

select j1 from js2 where get_json_int(j1, '$.f2') = 1;

select count(get_json_int(j1, '$.f2')) from js2 where get_json_int(j1, '$.f1') < 100;

select count(*) from js3 where get_json_string(j1, 'f_bool') = 'false';

select count(*) from js3 where get_json_bool(j1, 'f_double') = true;

select count(*) from js3 where get_json_double(j1, 'f_none') < 500;

insert into scs3 values (1, "aa", [1,2,3],[row(1,11),row(2,21),row(3,31)], map{1:11, 2:21}, map{1:row(11, [111, 221, 331]), 2:row(22, [221, 221, 331])}, row(1, [row(1,1), row(2,1)], map{1:11, 2:21}, row(1,1)));

insert into scs3 values (9, "ii", [9,2,3],[row(1,13),row(2,23),row(3,33)], map{1:13, 2:23}, map{1:row(13, [113, 223, 333]), 2:row(22, [223, 223, 333])}, row(1, [row(1,3), row(2,3)], map{1:13, 2:23}, row(1,3)));

select map_size(m1), s1.s2[1].a, s1.s3[1], s1.s4.f from scs3 where str in ("aa", "bb", "cc") order by v1 limit 2;

select array_length(a1), a2[1].a  from scs3 where str <= "gg" and s1.s1 > 2 order by v1 limit 2;

select count(1) from t1 where 
    c_int in (cast(parse_json("[10, 11,12,13]") as array<INT>)[1]) 
    OR c_int in (cast(parse_json("[20, 21,22,23]") as array<INT>)[1]);

-- CastStructExpr
select count(1) from t1 where 
    c_struct in (struct(10, 11)) 
    OR c_struct not in (struct(20, 21));

CREATE TABLE `s2` (
  `c1` int NULL,
  `c2` varchar(64) NULL
) ENGINE=OLAP
DUPLICATE KEY(`c1`)
DISTRIBUTED BY HASH(`c1`) BUCKETS 1
PROPERTIES ("replication_num" = "1");

insert into s2 select generate_series, concat('v', generate_series) from table(generate_series(10, 5000));

-- the same with the UNION on the build side
select count(*) from (
  select z.idx from (select idx from t1 union select idx from t1) z
  except
  select idx from t1) x;

create table b (id bigint, g bigint) duplicate key(id)
  distributed by hash(id) buckets 32 properties("replication_num" = "1");

-- UNION on both sides = 3001..5000
select count(*) from (
  select z.id from (select id from a union select id from a) z
  except
  select y.id from (select id from b union select id from b) y) x;

-- three-way, still colocate
select count(*), min(k), max(k) from (
  select k from cg1
  intersect
  select k from cg2
  intersect
  select k from cg1 where k >= 600) x;

set enable_wait_dependent_event = true;

select k from t_exc except select k from t_exc where k = 5 order by k;

select k, j from t1 except select k, j from t2 order by k;

insert into dup_tbl select 1,6,1,1.001,10.1,1110.1,'2001-01-07','2021-10-30 12:10:23','hello world','hi hello',true;

insert into dup_tbl select * from dup_tbl;

SET enable_shared_scan = true;

set enable_short_circuit = true;

-- name: testShortCircuit @no_arrow_flight_sql
set enable_short_circuit=true;

CREATE TABLE short_circuit_bool
    (k1 int,
     k2 boolean,
    c2  int)
    PRIMARY KEY(k1, k2)
    DISTRIBUTED BY HASH(k1, k2)
    BUCKETS 4
    PROPERTIES ("replication_num" = "1");

insert into t_short_circuit_part values("2026-04-01", 1, 1), ("2026-04-02", 2, 1);

-- name: test_show_limit_offset
-- Test Point:
--   A SHOW statement's LIMIT clamped the end of its range and not the start, so an offset past
--   the last row left subList(offset, size), which subListRangeCheck rejects with
--   IllegalArgumentException. MySQL answers an offset past the end with no rows. Both values are
--   declared long as well, and an offset of 2^32 truncated to an int is 0 -- a valid index, so
--   the statement answered with the first rows of the list rather than none.
-- Method: a table with three partitions, and the alter lists of a database that has no alter
--         jobs at all, which is where an offset is past the end without setting anything up.

insert into t_dst select cast(v as int) from t_src;

-- Order matters: the TEMPORARY partition is loaded first, so it ends up with the OLDER
-- visible-version time, and swapping it in later drags the table-level maximum down.
INSERT INTO t TEMPORARY PARTITION (tp) VALUES ('2024-01-05', 10);

-- The ordinary path is unchanged: a plain load bumps a partition's visible version, so the
-- entry that has just been reloaded is not served to the query that follows the load.
INSERT INTO t VALUES ('2024-01-25', 500);

-- inspect_minmax() goes through getStatsSync(), so the cache is warm synchronously.
SELECT inspect_minmax('test_minmax_schema_change.t', 'v');

USE test_stale_tablet_stat;

-- Deliberately NOT asserted here: information_schema.TABLES.TABLE_ROWS reads the
-- cached row count through the same chain (InformationSchemaDataSource
-- .genNormalTableInfo) and goes stale together with it, but TABLE_ROWS is an
-- approximation by definition (MySQL reports an estimate there for InnoDB too), so
-- it is not a correctness bug. COUNT(*) is what must be exact.

DROP DATABASE test_stale_tablet_stat;

-- NOTE: avoid NULL here. With csv.escape='\\', the fixed NULL marker "\N" is
-- indistinguishable from an escaped literal N on re-import (the reader's
-- ESCAPE state strips the backslash), so NULL does not roundtrip under this
-- escape mode. NULL roundtrip is covered by the RFC4180 case above, which
-- uses csv.escape='"' and keeps \N intact.
insert into t2 values (1, 'hello', 'plain'), (2, 'say "hi"', 'val'), (3, 'path\\to', 'val'), (4, 'a\\"b', 'x');

-- name: testCsvFilesSink1

-- name: test_sink_orc_fault_injection_oss @sequential

-- version 1.0

--todo: read datetime result should transform

-- name: testIcebergSinkNullPartition

set enable_optimize_skew_join_v2 = true;

-- name: test_skew_join_with_pre_topn

CREATE TABLE IF NOT EXISTS skew_customer (
    c_custkey     INT NOT NULL,
    c_name        VARCHAR(25) NOT NULL,
    c_address     VARCHAR(40) NOT NULL,
    c_nationkey   INT NOT NULL,
    c_phone       CHAR(15) NOT NULL,
    c_acctbal     DECIMAL(15,2)   NOT NULL,
    c_mktsegment  CHAR(10) NOT NULL,
    c_comment     VARCHAR(117) NOT NULL
)
DUPLICATE KEY(c_custkey)
DISTRIBUTED BY HASH(c_custkey) BUCKETS 3
PROPERTIES (
    "replication_num"="1"
);

SELECT n_nationkey, COUNT(*) as cnt FROM nation JOIN [skew|nation.n_nationkey(1,2,8)] skew_customer ON c_custkey = n_nationkey GROUP BY n_nationkey ORDER BY n_nationkey;

select c_custkey, c_name, c_acctbal, n_name, c_address, c_phone, n_nationkey, count(1) from skew_customer left join [skew|nation.n_nationkey(1,2,8)] nation on c_custkey = n_nationkey group by c_custkey, c_name, c_acctbal, c_phone, n_name, c_address, n_nationkey order by all limit 3;

select c_custkey, c_name, c_acctbal, n_name, c_address, c_phone, n_nationkey, count(1) from skew_customer left join [skew|skew_customer.c_custkey(1,2,8)] nation on c_custkey = n_nationkey group by c_custkey, c_name, c_acctbal, c_phone, n_name, c_address, n_nationkey order by all limit 3;

SELECT n_nationkey, COUNT(*) as cnt FROM nation LEFT JOIN [skew|nation.n_nationkey(1,2,8)] skew_customer ON c_custkey = n_nationkey GROUP BY n_nationkey ORDER BY n_nationkey LIMIT 5;

INSERT INTO lineitem (l_shipdate, l_orderkey, l_linenumber, l_partkey, l_suppkey, l_quantity, l_extendedprice, l_discount, l_tax, l_returnflag, l_linestatus, l_commitdate, l_receiptdate, l_shipinstruct, l_shipmode, l_comment) VALUES    
('1995-01-16', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('1995-01-16', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

select l_returnflag, avg(l_extendedprice), avg(l_discount), sum(l_returnflag), count(l_receiptdate) from lineitem group by l_returnflag order by l_returnflag limit 1;

select l_partkey, avg(l_extendedprice), avg(l_discount), sum(l_returnflag), count(l_receiptdate) from lineitem group by l_partkey order by l_partkey limit 10;

select l_shipmode, avg(l_extendedprice), avg(l_discount), sum(l_returnflag), count(l_receiptdate) from lineitem group by l_shipmode order by l_shipmode limit 10;

select l_linestatus, avg(l_extendedprice), avg(l_discount), sum(l_returnflag), count(l_receiptdate) from lineitem group by l_linestatus order by l_linestatus limit 100;

select l_shipdate, l_suppkey, avg(l_extendedprice), avg(l_discount), sum(l_returnflag), count(l_receiptdate) from lineitem group by l_shipdate, l_suppkey order by l_shipdate, l_suppkey limit 10;

select l_shipdate, l_comment, avg(l_extendedprice), avg(l_discount), sum(l_returnflag), count(l_receiptdate) from lineitem group by l_shipdate, l_comment order by l_shipdate, l_comment limit 10;

select l_shipdate, l_shipinstruct, avg(l_extendedprice), avg(l_discount), sum(l_returnflag), count(l_receiptdate) from lineitem group by l_shipdate, l_shipinstruct order by l_shipdate, l_shipinstruct limit 100;

select l_shipdate, l_partkey, l_linenumber, l_shipmode, l_comment, avg(l_extendedprice), avg(l_discount), sum(l_returnflag), count(l_receiptdate) from lineitem group by l_shipdate, l_partkey, l_linenumber, l_shipmode, l_comment order by l_shipdate, l_partkey, l_linenumber, l_shipmode, l_comment limit 1000;

select l_commitdate, avg(l_extendedprice), avg(l_discount), sum(l_returnflag), count(l_receiptdate) from lineitem group by l_commitdate order by l_commitdate nulls last limit 1;

select l_linenumber, avg(l_extendedprice), avg(l_discount), sum(l_returnflag), count(l_receiptdate) from lineitem group by l_linenumber order by l_linenumber nulls last limit 10;

select l_shipdate, avg(l_extendedprice), avg(l_discount), sum(l_returnflag), count(l_receiptdate) from lineitem group by l_shipdate order by l_shipdate nulls last limit 100;

select l_receiptdate, avg(l_extendedprice), avg(l_discount), sum(l_returnflag), count(l_receiptdate) from lineitem group by l_receiptdate order by l_receiptdate nulls last limit 100;

select l_shipdate, l_returnflag, avg(l_extendedprice), avg(l_discount), sum(l_returnflag), count(l_receiptdate) from lineitem group by l_shipdate, l_returnflag order by l_shipdate, l_returnflag nulls last limit 10;

select l_shipdate, l_partkey, avg(l_extendedprice), avg(l_discount), sum(l_returnflag), count(l_receiptdate) from lineitem group by l_shipdate, l_partkey order by l_shipdate, l_partkey nulls last limit 100;

select l_shipdate, l_comment, avg(l_extendedprice), avg(l_discount), sum(l_returnflag), count(l_receiptdate) from lineitem group by l_shipdate, l_comment order by l_shipdate, l_comment nulls last limit 100;

CREATE TABLE `t2` (
  `c0` int(11) NULL COMMENT "",
  `c1` varchar(20) NULL COMMENT "",
  `c2` varchar(200) NULL COMMENT "",
  `c3` int(11) NULL COMMENT ""
) ENGINE=OLAP
DUPLICATE KEY(`c0`, `c1`)
COMMENT "OLAP"
DISTRIBUTED BY HASH(`c0`, `c1`) BUCKETS 48
PROPERTIES (
"replication_num" = "1",
"in_memory" = "false",
"storage_format" = "DEFAULT",
"enable_persistent_index" = "true",
"replicated_storage" = "true",
"compression" = "LZ4"
);

select l.c0, l.c1, count(l.c0), avg(l.c0), count(l.c1), count(l.c0), count(r.c1) from t0 l join [broadcast] t1 r on l.c0 = r.c0 and l.c1 = r.c1 group by l.c0, l.c1 order by l.c0, l.c1 limit 10;

select l.c0, count(l.c0), avg(l.c0), count(l.c1), count(l.c0), count(r.c1) from t0 l join t2 r on l.c0 = r.c0 and l.c1 = r.c1 group by l.c0 order by l.c0 nulls last limit 1;

select l.c0, l.c1, r.c1, count(l.c0), avg(l.c0), count(l.c1), count(l.c0), count(r.c1) from t0 l join [shuffle] t2 r on l.c0 = r.c0 and l.c1 = r.c1 group by l.c0, l.c1, r.c1 order by l.c0, l.c1, r.c1 nulls last limit 10;

select count(*) from (select id, v, rank() over (order by v) rk from rk) s where rk <= 129;

select *,row_number() over (partition by c0 order by c1) from t0;

select c0 from t0 order by 1 asc nulls first limit 10;

-- materialize
select * from t0 order by 1 where c0 > 10 limit 10;

select c1 from t2 order by c1 asc limit 10;

select c1 from t3 order by c1 asc limit 10;

insert into t4 SELECT generate_series, generate_series + 3 FROM TABLE(generate_series(1,  81920));

create table t5 (
    c0 INT,
    c1 BIGINT
) PRIMARY KEY(c0) DISTRIBUTED BY HASH(c0) BUCKETS 1 PROPERTIES('replication_num' = '1');

select c0,c1 from t5 order by c0 desc limit 10;

select c1 from tlow group by c0, c1 order by c1 nulls first limit 10;

-- name: test_topn_with_large_limit

set pipeline_dop=1;

select * from agg_t order by k1;

-- Add key column without specifying position
alter table agg_t add column k5 int key default '0';

-- Add key column at middle position (AFTER k1)
alter table uniq_t add column k4 int key default '0' after k1;

insert into agg_test values (1,3,2,10,9),(2,2,2,9,7),(3,1,2,8,8);

alter table agg_test modify column k1 bigint key;

drop database sort_key_test_agg_with_rollup;

insert into dup_test values (1,2,2,10,9),(2,3,2,9,7),(2,1,2,8,8);

use sort_key_test_pri;

show create table pri_test;

CREATE TABLE `uni_test` (
    `k1` int(11) NOT NULL COMMENT "",
    `k2` int(11) NOT NULL COMMENT "",
    `v1` bigint REPLACE NULL COMMENT "",
    `v2` bigint REPLACE NULL COMMENT "",
    `v3` bigint REPLACE NULL COMMENT ""
)
UNIQUE KEY(k1, k2)
COMMENT "OLAP"
DISTRIBUTED BY HASH(`k1`) BUCKETS 1
ORDER BY (k2,k1,k2)
PROPERTIES (
    "replication_num" = "1",
    "in_memory" = "false",
    "storage_format" = "DEFAULT"
);

alter table uni_test order by (k1,k2);

use sort_key_uni_tbl_with_rollup;

-- test
select c0 from t0 group by c0 order by c0;

select c0, c1, sum(c1) from t0 group by c0, c1 order by c0, c1;

insert into t3 values(2, 300.25, 3000.789, 'type3');

insert into t4 values(1, '2023-01-02 11:00:00', '2023-01-02', 'batch2');

insert into t5 values(1, true, true, 'status2');

-- Test with FLOAT and DOUBLE data types
create table t6(
    c0 INT,
    c1 FLOAT,
    c2 DOUBLE,
    c3 STRING
) DUPLICATE KEY(c0) DISTRIBUTED BY HASH(c0) BUCKETS 3 PROPERTIES('replication_num' = '1');

select c0, c1, c2, count(*) from t6 group by c0, c1, c2 order by c0, c1, c2;

select c0, sum(c1), count(*) from t7 group by c0 order by c0;

-- Test VARCHAR aggregation
select c0, c1, count(*) from t8 group by c0, c1 order by c0, c1;

insert into t9 values('group3', 2, 500.99, '2023-01-03 11:00:00', true);

insert into t10 values(null, 1, 200.75, '2023-01-01 11:00:00');

select c1, c0, c2, c3, count(*) from t10 group by c1, c0, c2, c3 order by c1, c0, c2, c3;

CREATE TABLE `large_table` (
  `c0` bigint DEFAULT NULL,
  `c1` bigint DEFAULT NULL,
  `c2` bigint DEFAULT NULL
) ENGINE=OLAP
DUPLICATE KEY(`c0`)
COMMENT "OLAP"
DISTRIBUTED BY HASH(`c0`) BUCKETS 48
PROPERTIES (
"replication_num" = "1"
);

create table t1 like t0;

-- test timeout case
set query_timeout=5;

insert into t0
    select generate_series, generate_series % 4096, percentile_approx_state(cast(generate_series as double), 0.5)
    from table(generate_series(1, 40960));

select avg(k1) x from (select * from t1 union all select * from t1)t group by k2 order by x limit 10;

-- name: test_spill_agg
set enable_spill=true;

select avg(sl) from (select sum(c1) sl from t0 group by c0) tb;

select distinct c0, c1 from t3 order by 1, 2 limit 2;

select c0, sum(c1) as sc1 from (select c0, c1 from t3 where c0 < -1 limit 100) tb group by c0;

-- 
create table t5 (
    c0 INT,
    c1 BIGINT
) DUPLICATE KEY(c0) DISTRIBUTED BY HASH(c0) BUCKETS 16 PROPERTIES('replication_num' = '1');

select count(*) from (select distinct c0, c1 from t5 limit 10) tb;

select count(l.c0), avg(l.c0), count(l.c1) from t0 l left anti join [broadcast] t1 r on l.c0 = r.c0 and l.c1 >= r.c1;

select count(*), count(l.c0), avg(l.c0), count(l.c1) from empty_t l left semi join [shuffle] t1 r on l.c0 = r.c0;

select count(*), count(r.c0), avg(r.c0), count(r.c1) from empty_t l right outer join [bucket] t1 r on l.c0 = r.c0;

select count(*), count(r.c0), avg(r.c0), count(r.c1) from t1 l right semi join [bucket] empty_t r on l.c0 = r.c0;

-- make sure each time we only load one partition
set spill_operator_max_bytes=0;

select count(l.c0),sum(length(l.c0)), sum(length(l.c1)) from tstring l left join tstring r on l.c0 = r.c0;

-- name: test_spill_hash_join_restore_cancelled @sequential

CREATE TABLE `t0` (
  `c0` int(11) NULL COMMENT "",
  `c1` varchar(20) NULL COMMENT "",
  `c2` varchar(200) NULL COMMENT "",
  `c3` int(11) NULL COMMENT ""
) ENGINE=OLAP
DUPLICATE KEY(`c0`, `c1`)
COMMENT "OLAP"
DISTRIBUTED BY HASH(`c0`, `c1`) BUCKETS 1
PROPERTIES (
"replication_num" = "1"
);

-- Sanity: with the failpoint off the same spilling join succeeds, proving the BE survived.
select sum(l.c0), sum(r.c1) from t0 l join t0 r on l.c0 = r.c0;

CREATE TABLE `hj_probe` (
  `k` bigint(20) NULL COMMENT ""
) ENGINE=OLAP
DUPLICATE KEY(`k`)
DISTRIBUTED BY HASH(`k`) BUCKETS 1
PROPERTIES (
"compression" = "LZ4",
"fast_schema_evolution" = "true",
"replicated_storage" = "true",
"replication_num" = "1"
);

insert into t0 values (null,null);

-- name: test_spill_nl_join
set enable_spill=true;

select count(*) from t0 l join [broadcast] t0 r where l.c0 < 0;

select count(d.c0) from t0 d join [broadcast] (select l.c0 from t0 l join empty_t r) t;

select c2 from (select c3,c2 from (select sleep(1) as c2) tbr join [broadcast] (select 1 c3) tbl where c3 + c2 = 0) tb join [broadcast] t0;

CREATE TABLE t1 (
    k1 INT,
    k2 VARCHAR(100))
DUPLICATE KEY(k1)
DISTRIBUTED BY HASH(k1) PROPERTIES('replication_num'='1');

create table t_sort (
    c0 INT,
    c1 INT,
    c2 INT
) DUPLICATE KEY(c0) DISTRIBUTED BY HASH(c0) BUCKETS 4 PROPERTIES('replication_num' = '1');

-- Parallel merge path (LocalParallelMergeSortSourceOperator): the leaf
-- chunk_provider used to drop chunks_sorter->get_next status with (void).
set enable_parallel_merge=true;

CREATE TABLE t1 (
    k1 INT,
    k2 VARCHAR(64),
    k3 VARCHAR(128))
DUPLICATE KEY(k1)
DISTRIBUTED BY HASH(k1) BUCKETS 8 PROPERTIES('replication_num'='1');

set disable_spill_to_local_disk=true;

insert into blackhole() select k1,k2 from t1 order by k1,k2 limit 1000;

insert into blackhole() select k1,k2 from tempty order by k1,k2 limit 100;

create table tmp as select k1,k2 from t1 order by k1,k2 limit 100;

insert into t0 SELECT generate_series, 4096 - generate_series FROM TABLE(generate_series(1,  40960));

truncate table res_table;

insert into res_table with cte as (
select 
[named_struct("key1", lo_orderkey, "key2", lo_custkey), named_struct("key1",lo_partkey, "key2", lo_suppkey)] as group_by,
lo_quantity
from lineorder2
),
cte1 as(
select group_by, sum(lo_quantity) as sum_qty from cte
group by group_by
)
select /*+SET_VAR(new_planner_agg_stage=3,spill_mode='force',enable_spill=false,spill_partitionwise_agg=true, enable_agg_spill_preaggregation=true, spill_partitionwise_agg_skew_elimination=true) */ sum(murmur_hash3_32(group_by[1].key1,group_by[1].key2, group_by[2].key1,group_by[2].key2, sum_qty)) from cte1;

insert into res_table with cte as(
select distinct lo_custkey,lo_orderkey,lo_quantity 
from lineorder2
)
select /*+SET_VAR(new_planner_agg_stage=3,spill_mode='force',enable_spill=true,spill_partitionwise_agg=true, enable_agg_spill_preaggregation=true, spill_partitionwise_agg_skew_elimination=true, spill_mem_table_size=4096) */ sum(murmur_hash3_32(lo_custkey,lo_orderkey,lo_quantity)) from cte;

insert into res_table with cte as(
select lo_partkey, lo_suppkey,  sum(lo_quantity) as sum_qty, count(distinct lo_shipmode) as cnt_shipmode  from lineorder2  group by lo_partkey,lo_suppkey
)
select /*+SET_VAR(new_planner_agg_stage=3,spill_mode='force',enable_spill=true,spill_partitionwise_agg=true, enable_agg_spill_preaggregation=false, spill_partitionwise_agg_skew_elimination=false) */ sum(murmur_hash3_32(lo_partkey,lo_suppkey,sum_qty, cnt_shipmode)) fp from cte;

-- name: test_split_or
CREATE TABLE `low_card_duplicate` (
  `c0` int(11) NULL COMMENT "",
  `c1` varchar(500) NULL COMMENT "",
  `c2` varchar(500) NOT NULL COMMENT "",
  `c3` varchar(500) NULL COMMENT "",
  `c4` varchar(500) NULL COMMENT "",
  `c5` float NULL COMMENT "",
  `c6` decimal128(38, 20) NULL COMMENT "",
  INDEX index1_c0 (`c0`) USING BITMAP
) ENGINE=OLAP
DUPLICATE KEY(`c0`, `c1`, `c2`)
COMMENT "OLAP"
DISTRIBUTED BY HASH(`c2`, `c1`, `c0`) BUCKETS 3
PROPERTIES (
"replication_num" = "1",
"bloom_filter_columns" = "c3, c4",
"enable_persistent_index" = "true",
"replicated_storage" = "true",
"compression" = "LZ4"
);

select count(*) from low_card_duplicate where c0 = 1 or c2 = 'M' or c1 = 'vI7jmgbw';

select count(*) from low_card_duplicate where c4 in ('hangzhou', null) or c3 in ('shenzhen', null);

select id > 0 or cast(cast(parse_json(j) as varchar) as int) > 0, id > 0 or cast(cast(parse_json(j) as varchar) as int) > 1 from t1;

select 1%0;

create table t_div_src (k1 int, k2 int)properties('replication_num' = '1');

select str_to_date(NULL, '%Y-%m-%d');

insert into t_str_date_src values ('valid', '%Y-%m-%d'), ('invalid', '%Y-%m-%d'), ('2024-01-01', '%Y-%m-%d');

select id, array_filter(x -> if(random() < 2, x + cast(j as int), 0) > 2, xs) from t order by id;

-- With ONLY_FULL_GROUP_BY enabled, the same query should be rejected.
set sql_mode = 'ONLY_FULL_GROUP_BY';

DROP STORAGE VOLUME IF EXISTS storage_volume_alter;

CREATE STORAGE VOLUME IF NOT EXISTS storage_volume_partioned_prefix_fail1 TYPE = S3 LOCATIONS = ('s3://bucketname/subpath') PROPERTIES ("aws.s3.use_aws_sdk_default_behavior" = "true", "aws.s3.enable_partitioned_prefix" = "true", "aws.s3.num_partitioned_prefix" = "1024");

DROP STORAGE VOLUME storage_volume_drop;

DROP STORAGE VOLUME IF EXISTS storage_volume_grant;

SHOW STORAGE VOLUMES like 'storage_volume_default%';

CREATE TABLE `t0`
(
    `id` int(11) NOT NULL COMMENT "user id",
    `name` varchar(65533) NULL COMMENT "user name",
    `score` int(11) NOT NULL COMMENT "user score"
)
ENGINE=OLAP
PRIMARY KEY(`id`)
DISTRIBUTED BY HASH(`id`)
PROPERTIES (
 "replication_num" = "1"
);

CREATE TABLE `table1` (
  `id` int,
  `name` varchar(100)
) ENGINE=OLAP
DUPLICATE KEY(`id`)
DISTRIBUTED BY HASH(`id`) BUCKETS 1;

-- test_debezium_error_null_before
CREATE TABLE t1 (
    id INT NOT NULL,
    name VARCHAR(100),
    age INT
) PRIMARY KEY (id)
DISTRIBUTED BY HASH(id) BUCKETS 1
PROPERTIES ("replication_num" = "1");

-- Test 1: Basic transaction - LOAD fails, commit should fail

-- LOAD with missing column (should return ANALYSIS_ERROR)

-- Commit should fail (transaction was auto-aborted)

-- Test 2: Multi-statement - LOAD fails, commit should fail

-- LOAD with missing column (should return FAILED)

-- Commit should fail

-- Verify table is empty
select count(*) from table_strict;

-- name: test_multi_txn_load_failure_then_load_different_table @sequential
-- Test LOAD failure to one table, then LOAD to different table
-- Now consistent with basic transaction: LOAD failure auto-aborts entire transaction

CREATE TABLE t_json (id INT, name VARCHAR(32), v DOUBLE) DUPLICATE KEY(id) DISTRIBUTED BY HASH(id) BUCKETS 3 PROPERTIES("replication_num" = "1");

select reverse('');

select reverse(s) from t_reverse order by id;

select reverse(cast(12345678901234 as bigint));

select reverse(cast('2024-01-15 12:34:56' as datetime));

select reverse(c_double)   from t_reverse_types order by id;

-- Exact bytes of the first part (hex keeps it ASCII-safe); must equal the input prefix.
SELECT id, hex(split_part(s, '', 1)) AS sp_hex FROM t ORDER BY id;

select url_decode(NULL);

select substring_index("com.mysql.com", ".", -1);

select substring_index(c0, " ", -2) from t2;

select crc32("STARROCKS");

select ngram_search("chinese","CHINESE",4);

select ngram_search(rowkey,"000073a7-274f-46bf-bfaf-678868cc26cd",4) as a from string_table order by a;

-- Test with Cyrillic characters (Russian/Tajik names transliteration comparison)
-- Same name should have high similarity
select ngram_search('Расулов Сунатулло', 'Расулов Сунатулло', 4);

select ngram_search('北京大学', '北京师范大学', 4);

-- Case insensitive search
select id, ngram_search_case_insensitive(name_cyrillic, 'РАСУЛОВ СУНАТУЛЛО', 4) as similarity
from utf8_names
order by similarity desc, id;

select strpos('abc', 'b', 1);

select strpos('abcabc', 'abc', -3);

select strpos(null, 'abc');

select format_bytes(123);

select format_bytes(null);

-- 1.00 GB
select format_bytes(2147483648);

-- ~1.05 MB

-- Test with table data
create table t_format_bytes(bytes bigint)
        DUPLICATE KEY(bytes)
        DISTRIBUTED BY HASH(bytes)
        BUCKETS 1
        PROPERTIES('replication_num'='1');

select raise_error(msg) from t_raise_error order by id;

SELECT TRIM(LEADING 'x' FROM 'xxxbarxxx');

-- non-reserved keyword still usable as an identifier
SELECT leading FROM (SELECT 1 AS leading) t;

-- name: test_url_extract_parameter_truncated_escape
-- description: url_extract_parameter on a column value whose parameter ends in a truncated
--              percent-escape ("...%" or "...%X") must not read past the value. The decoder
--              previously read value[i+1]/value[i+2] with no bound check; for the non-NUL-
--              terminated column slice that was an out-of-bounds read of adjacent row bytes,
--              so the result depended on neighbouring data. With the fix it is a clean error
--              (NULL) regardless of what follows in memory, and valid escapes still decode.

CREATE DATABASE IF NOT EXISTS test_url_extract_parameter_truncated_escape_db;

-- value ending in a single trailing hex digit after '%' is also truncated -> clean NULL
INSERT INTO ta VALUES (3, 'http://x/p?k1=cd%4');

-- The defect: DISTINCT aggregate + window + uncorrelated EXISTS.
SELECT count(DISTINCT a) OVER () FROM dw_t1 WHERE EXISTS (SELECT 1 FROM dw_t2);

with cte1 as (
select count(1) N1 from t0 inner join lateral unnest(t0.xs) t1(x) on true
),
cte2 as (
select count(id) N2 from t0 inner join lateral unnest(t0.xs) t1(x) on true
),
cte3 as (
select count(id) N3 from t0 inner join lateral unnest(t0.xs) t1(x) on true where coalesce(murmur_hash3_32(t1.x), -1)!=0
)
select assert_true(N1 > 0 and N1 = N2 and N2 = N3) from cte1, cte2, cte3;

-- Small dimension whose key covers every t.k2 value, so the join pushes a runtime filter that
-- is present but non-selective: the probe scan still reads the whole tablet (many splits) while
-- the runtime-filter snapshot bookkeeping on the prepared-split path is exercised.
create table ds8 (
    id int
) duplicate key(id)
distributed by hash(id) buckets 1
properties('replication_num' = '1');

set enable_lake_tablet_internal_parallel = true;

-- A runtime-filter join over the prepared-split path (exercises the RF snapshot bookkeeping).
select count(*) from t join ds8 on t.k2 = ds8.id;

-- Query cache is mutually exclusive with the optimization by design: no marker when it is on.
set enable_query_cache = true;

-- (A) Huge skew ratio: the big tablet is not "skewed enough", so the count gate holds -> no prepared split
-- (RefinedMorsels stays 0).
set lake_tablet_internal_parallel_skew_split_ratio = 1000;

-- name: test_tablet_internal_parallel_profile @sequential @native @slow

-- setup be config to minimize the split size.

-- config.
set enable_async_profile=false;

with 
    profile as (
        select unnest as line from (values(1))t(v) join unnest(split(get_query_profile(last_query_id()), "\n") )
    ), result as (
        -- format: "ShortKeyFilterRows: 9.009K (9009)" or "ShortKeyFilterRows: 100"
        select "ShortKeyFilterRows" as `key`, regexp_extract(line, ".*- ShortKeyFilterRows: (?:.*\\()?(\\d+)\\)?", 1) as value from profile where line like "%- ShortKeyFilterRows%"
        UNION ALL
        select "__MAX_OF_ShortKeyFilterRows" as `key`, regexp_extract(line, ".*- __MAX_OF_ShortKeyFilterRows: (?:.*\\()?(\\d+)\\)?", 1) as value from profile where line like "%- __MAX_OF_ShortKeyFilterRows%"
        UNION ALL
        select "__MIN_OF_ShortKeyFilterRows" as `key`, regexp_extract(line, ".*- __MIN_OF_ShortKeyFilterRows: (?:.*\\()?(\\d+)\\)?", 1) as value from profile where line like "%- __MIN_OF_ShortKeyFilterRows%"
        UNION ALL
        
        select "SegmentZoneMapFilterRows" as `key`, regexp_extract(line, ".*- SegmentZoneMapFilterRows: (?:.*\\()?(\\d+)\\)?", 1) as value from profile where line like "%- SegmentZoneMapFilterRows%"
        UNION ALL
        select "__MAX_OF_SegmentZoneMapFilterRows" as `key`, regexp_extract(line, ".*- __MAX_OF_SegmentZoneMapFilterRows: (?:.*\\()?(\\d+)\\)?", 1) as value from profile where line like "%- __MAX_OF_SegmentZoneMapFilterRows%"
        UNION ALL
        select "__MIN_OF_SegmentZoneMapFilterRows" as `key`, regexp_extract(line, ".*- __MIN_OF_SegmentZoneMapFilterRows: (?:.*\\()?(\\d+)\\)?", 1) as value from profile where line like "%- __MIN_OF_SegmentZoneMapFilterRows%"
        UNION ALL

        select "RemainingRowsAfterShortKeyFilter" as `key`, regexp_extract(line, ".*- RemainingRowsAfterShortKeyFilter: (?:.*\\()?(\\d+)\\)?", 1) as value from profile where line like "%- RemainingRowsAfterShortKeyFilter%"
    )
select * from result order by `key`, value;

create table src (k int, v bigint) properties('replication_num' = '1');

select count(*), count(distinct k), sum(k), sum(v), min(k), max(k), count(extra) from dst_partial;

create table src (account_id bigint, activity_date datetime, tenant_id bigint) properties('replication_num' = '1');

select tenant_id, activity_date_month, count(*) from dst group by tenant_id, activity_date_month
order by tenant_id, activity_date_month;

SHOW CREATE TABLE t_ddl;

-- Automatic split sizes against the table's own target. 1 MiB is far below the cluster-wide
-- tablet_reshard_target_size and below tablet_reshard_min_split_size, so only this table's property can
-- make a tablet of a few MiB split.
CREATE TABLE t_split (k BIGINT, p1 VARCHAR(64), p2 VARCHAR(64)) DUPLICATE KEY(k)
PROPERTIES ('replication_num' = '1', 'tablet_reshard_target_size' = '1048576');

-- Baseline row count, before the split.
SELECT count(*) FROM t_varchar_sort_key;

drop task alter_task;

drop task not_exist_task;

create temporary table if not exists `t0` (
    `c1` int,
    `c2` int
) engine=OLAP primary key(`c1`) distributed by hash(`c1`) buckets 3 properties("replication_num" = "1");

select * from `t0` order by `c1`, `c2`;

-- name: test_select_out_file
create temporary table `t` (
    `c1` int,
    `c2` int
) engine=OLAP primary key(`c1`) distributed by hash(`c1`) buckets 3 properties("replication_num" = "1");

CREATE TABLE `hits_daily_list` (
  `CounterID` int(11) NULL COMMENT "",
  `EventDate` date NOT NULL COMMENT "",
  `UserID` bigint(20) NOT NULL COMMENT "",
  `EventTime` datetime NOT NULL COMMENT "",
  `WatchID` bigint(20) NOT NULL COMMENT "",
  `LoadTime` datetime NOT NULL COMMENT "",
  `Title` varchar(65533) NOT NULL COMMENT "",
  `GoodEvent` smallint(6) NOT NULL COMMENT "",
  `ClientIP` int(11) NOT NULL COMMENT "",
  `RegionID` int(11) NOT NULL COMMENT "",
  `URL` string NOT NULL COMMENT ""
) ENGINE=OLAP
DUPLICATE KEY(`CounterID`, `EventDate`, `UserID`, `EventTime`, `WatchID`)
COMMENT "OLAP"
PARTITION BY LIST(`LoadTime`)
(
PARTITION p01 VALUES IN ("2013-07-01"),
PARTITION p02 VALUES IN ("2013-07-02"),
PARTITION p03 VALUES IN ("2013-07-03"),
PARTITION p04 VALUES IN ("2013-07-04"),
PARTITION p05 VALUES IN ("2013-07-05"),
PARTITION p06 VALUES IN ("2013-07-06"),
PARTITION p07 VALUES IN ("2013-07-07"),
PARTITION p08 VALUES IN ("2013-07-08"),
PARTITION p09 VALUES IN ("2013-07-09"),
PARTITION p10 VALUES IN ("2013-07-10"),
PARTITION p11 VALUES IN ("2013-07-11"),
PARTITION p12 VALUES IN ("2013-07-12"),
PARTITION p13 VALUES IN ("2013-07-13"),
PARTITION p14 VALUES IN ("2013-07-14"),
PARTITION p15 VALUES IN ("2013-07-15"),
PARTITION p16 VALUES IN ("2013-07-16"),
PARTITION p17 VALUES IN ("2013-07-17"),
PARTITION p18 VALUES IN ("2013-07-18"),
PARTITION p19 VALUES IN ("2013-07-19"),
PARTITION p20 VALUES IN ("2013-07-20"),
PARTITION p21 VALUES IN ("2013-07-21"),
PARTITION p22 VALUES IN ("2013-07-22"),
PARTITION p23 VALUES IN ("2013-07-23"),
PARTITION p24 VALUES IN ("2013-07-24"),
PARTITION p25 VALUES IN ("2013-07-25"),
PARTITION p26 VALUES IN ("2013-07-26"),
PARTITION p27 VALUES IN ("2013-07-27"),
PARTITION p28 VALUES IN ("2013-07-28"),
PARTITION p29 VALUES IN ("2013-07-29"),
PARTITION p30 VALUES IN ("2013-07-30"),
PARTITION p31 VALUES IN ("2013-07-31")
)
DISTRIBUTED BY HASH(`UserID`) BUCKETS 48
PROPERTIES (
"replication_num" = "1",
"in_memory" = "false",
"time_drift_constraint" = "EventTime between seconds_add(LoadTime, -300) and seconds_add(LoadTime, 600)",
"enable_persistent_index" = "true"
);

INSERT INTO t_joda_m VALUES (1, "2023-05-15 10:20:30", repeat("m", 200));

select dayofweek_iso(NULL);

select sec_to_time(-1);

select timestampdiff(MONTH, '2021-01-15', '2021-03-01'), timestampdiff(MONTH, '2021-03-01', '2021-01-15');

select to_tera_date("04.1988,08","mm.yyyy,dd");

select to_tera_timestamp("1988/04/08 14","yyyy/mm/dd hh24");

select to_tera_date("1988/04/08","yy/mm/dd");

select to_tera_timestamp(";", ";yyyy");

select str_to_jodatime(";", ";yyyy");

drop table to_tera_date_test;

select DATE_FORMAT(v1, '%Y-%m-%d') from test_to_date_table1 group by DATE_FORMAT(v1, '%Y-%m-%d') order by 1;

set sql_dialect = 'trino';

insert into t0 select t0.* from t0, Table(generate_series(1,10));

-- test mv with t1
CREATE MATERIALIZED VIEW test_mv1 
REFRESH DEFERRED MANUAL 
PROPERTIES ("replication_num" = "1")
AS 
  SELECT dt, sum(num) as num FROM external_mysql_t1 GROUP BY dt;

-- partial refresh
REFRESH MATERIALIZED VIEW test_mv1 PARTITION (('2025-01-01'), ('2025-01-02'), ('2025-01-03')) WITH SYNC MODE;

DROP MATERIALIZED VIEW test_days;

SELECT * FROM test_date where l_shipdate >= '2024-11-13 00:00:00' order by l_orderkey;

SELECT * FROM t1 order by id, province, dt limit 3;

select count(*) from test_datetime_partitioned_table_with_null_mv;

INSERT INTO lineitem_years SELECT l_orderkey, l_partkey, l_suppkey, l_linenumber, l_quantity, l_extendedprice, l_discount, l_tax, to_date(l_commitdate), to_date(l_receiptdate), l_shipinstruct, l_shipmode, l_comment, l_shipdate, l_returnflag, l_linestatus FROM t1;

REFRESH MATERIALIZED VIEW test_months PARTITION (('R', 'F', '2024-11-12 08:00:00')) WITH SYNC MODE;

-- Query should not hit MV since it's stale (partition was dropped)

-- Refresh MV to sync with base table
REFRESH MATERIALIZED VIEW non_partitioned_mv WITH SYNC MODE;

-- Verify MV contains data
SELECT * FROM partitioned_mv_force ORDER BY dt;

SELECT dt, num FROM test_mv1 where dt='2020-06-15' order by 1, 2 limit 3;

SELECT dt,sum(num) FROM test_mv1 where dt>'2020-06-15' GROUP BY dt order by 1, 2 limit 3;

SELECT dt,sum(num) FROM test_mv1 GROUP BY dt order by 1, 2 limit 3;

-- name: test_transparent_mv_mysql @slow
-- create mysql table

set enable_materialized_view_transparent_union_rewrite = true;

CREATE MATERIALIZED VIEW test_mv1
PARTITION BY dt
REFRESH DEFERRED MANUAL 
PROPERTIES ("transparent_mv_rewrite_mode" = "true")
AS  select * from (SELECT dt, num FROM test_mv20 UNION ALL SELECT dt, num FROM test_mv21)as t order by 1, 2;

DROP MATERIALIZED VIEW test_mv1;

SELECT * FROM t1 order by 1, 2 limit 3;

SELECT dt, sum(num) as num FROM t1 where dt > '2020-06-20'  GROUP BY dt order by 1, 2 limit 3;

SELECT t2.dt, sum(t2.num) as num FROM t1 join t2 on t1.dt = t2.dt where t2.dt > '2020-06-20' GROUP BY t2.dt order by 1, 2 limit 3;

select c2['not-existed'] from map_array_tbl order by c1;

select TIMESTAMP '2020-05-01 12:34:56.123456 Asia/Kathmandu';

select TIMESTAMP '2024-01-01 09:00:00' AT TIME ZONE 'Asia/Tokyo';

-- name: test_download @no_arrow_flight_sql

set enable_group_execution = true;

-- Scalar: a + b + 1, NULL when any argument is NULL
SELECT id, arrow_add(a, b) AS r FROM t_arrow ORDER BY id;

-- name: test_jvm_date_udf @no_arrow_flight_sql

select echo_datetime(dt2) from t_dt;

-- UDAF correctness
SELECT dec_sum(d18_4) FROM t_dec;

DROP TABLE t_dec;

select EchoNestedArray([[1,2],[3,4]]);

select * from t_nested where EchoNestedArray(arr) = [[1,2],[3,4]];

select struct_agg(stru1) from t_struct;

select echo_struct_a(stru1) from t_struct order by id;

select echo_nested_struct(row(row(0, "value0"), [row(1, "value1"), row(2, "value2")]));

select count(udtffloat) from t0, udtffloat(c1);

-- test group by limit case:
set streaming_preaggregation_mode="force_streaming";

select c0,echo_map(c3) from tlistarray order by 1;

insert into map_table values (1, map{"a": 10, "b": 20}), (1, map{"a": 20, "c": 20}),  (2, map{"d": 20, "e": 30}), (2, map{null: 40, "d": 30});

select sumbigint(x)
from (
  select null as x
)t;

select concat_str_va(5, "10");

select concat_str_va(1, null);

-- Minimum required args (exactly one array<int>)
select echo_array_va([1,2,3]);

-- With null as extra vararg
select echo_map_va(map(1,'a'), null);

CREATE FUNCTION get_type(int) RETURNS 
string 
properties(
    "symbol" = "echo", 
    "type" = "Python",     
    "file" = "inline",
    "input" = "scalar"
)
AS  
$$ 
def echo(x):
    return str(type(x))  
$$;

select get_type('1');

select nested_arr_map([map('a', 1), map('b', 2)]);

select return_struct_arr(3);

CREATE FUNCTION vector_echo(array<int>) RETURNS 
array<int> 
properties(
    "symbol" = "echo", 
    "type" = "Python",     
    "file" = "inline",
    "input" = "arrow"
)
AS  
$$ 
def echo(x):
    return type(x)  
$$;

-- non-group-by: global sumbigint must equal global builtin sum
select assert_true(sumbigint_cache_shared(c1) = sum(c1)) from t_udaf_cache;

-- non-group-by correctness
select assert_true(sumbigint_cache_private(c1) = sum(c1)) from t_udaf_cache;

with t as (
    SELECT
        MAX(CASE WHEN line LIKE '%HitCount%' THEN CAST(trim(split_part(line, ':', 2)) AS INT) END) as hit_count,
        MAX(CASE WHEN line LIKE '%PopulateCount%' THEN CAST(trim(split_part(line, ':', 2)) AS INT) END) as populate_count
    FROM (
        SELECT line FROM table(unnest(split(get_query_profile(last_query_id()), '\n'))) t(line)
    ) v
    WHERE v.line LIKE '%- UdafCacheHitCount%' OR v.line LIKE '%- UdafCachePopulateCount%'
)
select assert_true((hit_count is null or hit_count = 0) and (populate_count is null or populate_count = 0)) from t;

INSERT INTO t_jr VALUES (1, 1), (2, 2);

SELECT count(1) FROM t_jr a JOIN t_jr b ON a.c0 = b.c0;

select col_date from dup_tbl where col_varchar like '%hello' union select @test_union;

select * from ( select * from (select * from duplicate_table_with_null order by k2 limit 3) t1 union all select * from (select * from duplicate_table_with_null order by k2 limit 1)t2 ) t order by k1 limit 1;

select * from ( select * from (select * from duplicate_table order by k2 limit 3) t1 union all select * from (select * from duplicate_table_with_null order by k2 limit 1)t2 ) t order by k1 limit 1;

-- LEFT JOIN takes the same path (the extra NULL row is part of the expansion here), so it must batch
-- too rather than falling back to a single call.
SET chunk_size = 2;

SET chunk_size = 13;

-- name: test_array_of_struct_no_prune_all_subfields
select c_struct.c1, c_struct.c2 from TABLE(unnest(array<struct<c1 int, c2 int>>[named_struct('c1', 10, 'c2', 1), named_struct('c1', 20, 'c2', 2)])) t(c_struct);

-- left join on true
select id, scores, unnest from student_score left join unnest([1, 2]) as unnest on true order by 1, 3;

use test_unnest_stacked_same_array_join_crash;

-- name: test_unnest_stacked_same_array_prune
-- Repro guard for the stacked-UNNEST access-group overwrite (PR #75012): two UNNESTs on the
-- SAME array column whose downstream consumers need DIFFERENT subfields. setUnnest's hard put
-- of the access group lets the second UNNEST drop the subfield the first one needs, so the scan
-- prunes a still-needed field. This is a prune-ON vs prune-OFF differential: the prune must not
-- change the result. (On an OLAP build that does not physically prune the array<struct> read the
-- mis-prune is latent and both match; on a build that honors it, prune-ON would diverge or crash.)
drop database if exists test_unnest_stacked_same_array_prune;

-- Reversed roles: t1 needs c2_sub2, t2 needs c2_sub1.
select sum(t1.c2_sub2), count(t2.c2_sub1) from array_struct_nest,
  unnest(c2) as t(t1), unnest(c2) as tt(t2) where t2.c2_sub1 = 5;

-- Use only the FIRST subfield -> output narrows to struct<c1>.
select s.c1 from ts_arr, unnest(arr) as t(s) order by s.c1;

INSERT INTO t0
  (id, url, param_key, expect, only_null)
VALUES
  ('0', 'https://starrocks.com/doc?k1=10', 'k1', '10', 'false'),
  ('1', 'https://starrocks.com/doc?kk12=10', 'k1', '', 'true'),
  ('2', 'https://starrocks.com/doc?kk12=10', 'kk1', '', 'true'),
  ('3', 'https://starrocks.com/doc?kk12=10', 'k12', '', 'true'),
  ('4', 'https://starrocks.com/doc?k0=100&k1=10', 'k1', '10', 'false'),
  ('5', 'https://starrocks.com/doc?k0=abc&kk12=10', 'k1', '', 'true'),
  ('6', 'https://starrocks.com/doc?k0=100&kk12=10', 'kk1', '', 'true'),
  ('7', 'https://starrocks.com/doc?k0=1000kk12=10', 'k12', '', 'true'),
  ('8', 'https://starrocks.com/doc?k0=abc&k1=10#section1', 'k1', '10', 'false'),
  ('9', 'https://starrocks.com/doc?k0=100&k1=10=20', 'k1', '10=20', 'false'),
  ('10', 'https://starrocks.com/doc?k0=1000&k1', 'k1', '', 'false'),
  ('11', 'https://starrocks.com/doc?k0=1000&k1&k1=2', 'k1', '', 'false'),
  ('12', 'https://starrocks.com/doc?k0=1000&k1&=2', 'k1', '', 'false'),
  ('13', 'https://starrocks.com/doc?k0=1000&k1=100&k1=200', 'k1', '100', 'false'),
  ('14', 'https://starrocks.com/doc?k0=1000&k1:200=100&k1=200', 'k1:200', '100', 'false'),
  ('15', 'https://starrocks.com/doc?k0=1000&k1: 200=100&k1=200', 'k1: 200', '', 'true'),
  ('16', '', 'k1', '', 'true'),
  ('17', 'https://starrocks.com/doc?k0=10&k1=%21%23%24%26%27%28%29%2A%2B%2C%2F%3A%3B%3D%3F%40%5B%5D%20%22%25%2D%2E%3C%3E%5C%5E%5F%60%7B%7C%7D%7E&k2', 'k1', '!#$&\'()*+,/:;=?@[] "%-.<>\\^_`{|}~', 'false');

select (case only_null when true then url_extract_parameter('https://starrocks.com/doc?kk12=10', 'k1') is NULL else url_extract_parameter('https://starrocks.com/doc?kk12=10', 'k1') = expect end) as result from t0 where id = 1;

select (case only_null when true then url_extract_parameter('https://starrocks.com/doc?kk12=10', 'k12') is NULL else url_extract_parameter('https://starrocks.com/doc?kk12=10', 'k12') = expect end) as result from t0 where id = 3;

select (case only_null when true then url_extract_parameter('https://starrocks.com/doc?k0=abc&kk12=10', 'k1') is NULL else url_extract_parameter('https://starrocks.com/doc?k0=abc&kk12=10', 'k1') = expect end) as result from t0 where id = 5;

select (case only_null when true then url_extract_parameter('https://starrocks.com/doc?k0=1000kk12=10', 'k12') is NULL else url_extract_parameter('https://starrocks.com/doc?k0=1000kk12=10', 'k12') = expect end) as result from t0 where id = 7;

select (case only_null when true then url_extract_parameter('https://starrocks.com/doc?k0=100&k1=10=20', 'k1') is NULL else url_extract_parameter('https://starrocks.com/doc?k0=100&k1=10=20', 'k1') = expect end) as result from t0 where id = 9;

select (case only_null when true then url_extract_parameter('https://starrocks.com/doc?k0=1000&k1&k1=2', 'k1') is NULL else url_extract_parameter('https://starrocks.com/doc?k0=1000&k1&k1=2', 'k1') = expect end) as result from t0 where id = 11;

select (case only_null when true then url_extract_parameter('https://starrocks.com/doc?k0=1000&k1=100&k1=200', 'k1') is NULL else url_extract_parameter('https://starrocks.com/doc?k0=1000&k1=100&k1=200', 'k1') = expect end) as result from t0 where id = 13;

select (case only_null when true then url_extract_parameter('https://starrocks.com/doc?k0=1000&k1: 200=100&k1=200', 'k1: 200') is NULL else url_extract_parameter('https://starrocks.com/doc?k0=1000&k1: 200=100&k1=200', 'k1: 200') = expect end) as result from t0 where id = 15;

select (case only_null when true then url_extract_parameter('https://starrocks.com/doc?k0=10&k1=%21%23%24%26%27%28%29%2A%2B%2C%2F%3A%3B%3D%3F%40%5B%5D%20%22%25%2D%2E%3C%3E%5C%5E%5F%60%7B%7C%7D%7E&k2', 'k1') is NULL else url_extract_parameter('https://starrocks.com/doc?k0=10&k1=%21%23%24%26%27%28%29%2A%2B%2C%2F%3A%3B%3D%3F%40%5B%5D%20%22%25%2D%2E%3C%3E%5C%5E%5F%60%7B%7C%7D%7E&k2', 'k1') = expect end) as result from t0 where id = 17;

-- user variable generate from SQL
set @var = (select count(*) from t0 limit 1);

select      /*+ set_user_variable(@a = (select c0 * 0.1 from always1)) */ percentile_approx(c0, @a) is not null  from t0;

SELECT CAST(CAST(PARSE_JSON('{"First Name": "Kyle"}') AS VARIANT) AS STRUCT<`First Name` STRING>);

select id from t_sync order by approx_l2_distance([0.9,0.1,0,0], v) limit 1;

select id, val from t order by id;

CREATE TABLE vt (
    id   bigint        NOT NULL,
    vec  ARRAY<FLOAT>  NOT NULL,
    cat  int           NOT NULL,   -- scalar, no index; cat = id % 10  (10 uniform buckets)
    tag  int           NOT NULL,   -- scalar, no index; tag = id % 100 (for very-low selectivity)
    doc  varchar(64)   NOT NULL,   -- fulltext, GIN index
    INDEX idx_vec (vec) USING VECTOR (
        "index_type"       = "hnsw",
        "dim"              = "5",
        "metric_type"      = "l2_distance",
        "is_vector_normed" = "false",
        "M"                = "160",
        "efconstruction"   = "400",
        "efsearch"         = "200"),
    INDEX idx_doc (doc) USING GIN ("parser" = "english")
) ENGINE=OLAP
DUPLICATE KEY(id)
DISTRIBUTED BY HASH(id) BUCKETS 1
PROPERTIES ("replication_num" = "1");

DROP INDEX index_vector1 ON t_test_vector_table;

insert into t_test_vector_table values(2, [4,5,6,7,8]);

-- Restore default before exercising search-time cache lifecycle.
update information_schema.be_configs set value = "20%" where name = "vector_query_cache_capacity";

DROP TABLE t_vi_cache;

-- basic queries.

with w1 as (
    select *, approx_l2_distance(v1, [1, 1, 1, 1, 1]) as dis from t2
)
select * from w1 order by dis limit 10;

with w1 as (
    select *, approx_l2_distance(v1, [10000, 10001, 10002, 10003, 10004]) as dis from t2
), w2 as (
    select * from w1
    where dis <= 100 and dis <= 1000
    order by dis limit 20
) select * from w2 order by dis, id;

-- Scenario 1: SELECT id only (v not in projection) — lazy-mat must prune v from
-- scan output; the result must still be correct top-K ordered by distance.
-- Tie-breaker on id keeps the recorded output deterministic for distance ties.
select id, approx_l2_distance(v, [1, 1, 1, 1, 1]) as d
from lm_hnsw
order by d, id limit 3;

-- name: test_vector_index_hnsw_quantizer @sequential @native

-- =====================================================================
-- HNSW + quantizer DDL: SQ4 / SQ8 / PQ acceptance and rejection.
-- Covers the FE analyzer path (quantizer / m_pq / nbits_pq properties).
-- SQ4 / SQ8 cases also INSERT + SELECT to verify the build/query path. They set
-- index_build_threshold=1 so the .vi is actually built: the default is 10000, which a
-- handful of rows never reaches, and without it both queries would run the missing-.vi
-- fallback and no quantized index would be exercised at all.
-- PQ is DDL-only: PQ training needs many samples per sub-quantizer (e.g.
-- 256 at nbits_pq=8) which is impractical inside a SQL-tester case.
-- =====================================================================

-- HNSW + SQ8 (most common quantizer)
CREATE TABLE t_hnsw_sq8 (
  id bigint NOT NULL,
  vec ARRAY<float> NOT NULL,
  INDEX vec_idx (vec) USING VECTOR (
    "index_type" = "hnsw",
    "dim" = "4",
    "metric_type" = "l2_distance",
    "is_vector_normed" = "false",
    "M" = "16",
    "efconstruction" = "40",
    "quantizer" = "sq8",
    "index_build_threshold" = "1"
  )
) ENGINE=OLAP
DUPLICATE KEY(id)
DISTRIBUTED BY HASH(id) BUCKETS 1
PROPERTIES ("replication_num" = "1");

-- DDL rejection: m_pq does not divide dim
CREATE TABLE t_hnsw_pq_bad_m (
  id bigint NOT NULL,
  vec ARRAY<float> NOT NULL,
  INDEX vec_idx (vec) USING VECTOR (
    "index_type" = "hnsw",
    "dim" = "8",
    "metric_type" = "l2_distance",
    "is_vector_normed" = "false",
    "M" = "16",
    "efconstruction" = "40",
    "quantizer" = "pq",
    "m_pq" = "3"
  )
) ENGINE=OLAP
DUPLICATE KEY(id)
DISTRIBUTED BY HASH(id) BUCKETS 1
PROPERTIES ("replication_num" = "1");

-- name: test_vector_index_insert @sequential @native

CREATE TABLE t1 (
    id bigint(20) NOT NULL,
    v1 ARRAY<FLOAT> NOT NULL,
    v2 ARRAY<FLOAT> NULL,
    INDEX index_vector (v1) USING VECTOR (
        "index_type" = "hnsw", 
        "dim"="5", 
        "metric_type" = "cosine_similarity", 
        "is_vector_normed" = "true", 
        "M" = "16", 
        "efconstruction" = "40")
) ENGINE=OLAP
DUPLICATE KEY(id)
DISTRIBUTED BY HASH(id) BUCKETS 64
PROPERTIES (
    "replication_num" = "1"
);

INSERT INTO t1 values
    (1, [0.13483997249264842, 0.26967994498529685, 0.40451991747794525, 0.5393598899705937, 0.674199862463242], 
        [0.13483997249264842, 0.26967994498529685, 0.40451991747794525, 0.5393598899705937, 0.674199862463242]),
    (4, null, null),
    (2, [0.29019050004400465, 0.36273812505500586, 0.435285750066007, 0.5078333750770082, 0.5803810000880093],
        [0.29019050004400465, 0.36273812505500586, 0.435285750066007, 0.5078333750770082, 0.5803810000880093]),
    (3, [0.3368607684266076, 0.42107596053325946, 0.5052911526399114, null, 0.6737215368532152],
        [0.3368607684266076, 0.42107596053325946, 0.5052911526399114, null, 0.6737215368532152]),
    (3, null, null),
    (5, null, null),
    (6, null, null),
    (7, null, null),
    (8, null, null),
    (9, null, null),
    (10, null, null);

-- name: test_vector_index_ivfpq @sequential @native

-- IVFPQ is a quantized index; turn refine on so distances are recomputed exactly and the
-- distance-range filter is rechecked on the exact distance (results are exact and stable).
SET enable_vector_index_refine = true;

with w1 as (
    select *, approx_l2_distance(v1, [640064, 640064, 640064, 640064]) as dis from t1
)
select * from w1
order by dis limit 10;

-- cannot use vector index
with w1 as (
    select *, approx_l2_distance(v1, [1, 1, 1, 1]) as dis from t1
)
select * from w1 
where dis >= 100 and dis <= 1000
order by dis limit 10;

-- name: test_vector_index_refine @sequential @native

-- =====================================================================
-- Quantized vector index + enable_vector_index_refine on/off.
--   refine on  : the index produces candidates, the exact distance is recomputed on the
--                full-precision vectors -> exact ranking + exact distance-range recheck.
--   refine off : trust the (lossy) quantized index distance.
-- Covered: IVFPQ and HNSW+sq8 (quantized) under both settings, plus HNSW+flat where the
-- session variable is a no-op (a non-quantized index is already exact). The first section
-- exercises the WITH-.vi (index) path; the last section exercises the missing-.vi fallback.
--
-- index_build_threshold=1 forces the (default sync) inline .vi build for these small row counts;
-- the default threshold is 10000, which a SQL-tester-sized table never reaches, so without this
-- the queries would silently run the missing-.vi fallback instead of the index path.
-- The IVFPQ table uses threshold 16 instead (DDL now requires threshold >= nlist); HNSW tables keep 1.
-- =====================================================================

CREATE TABLE __refine_rows (
  k1 bigint NULL
) ENGINE=OLAP
DUPLICATE KEY(k1)
DISTRIBUTED BY HASH(k1) BUCKETS 4
PROPERTIES ("replication_num" = "1");

select id from t_ivfpq order by approx_l2_distance([100,100,100,100], v), id limit 1;

-- ============================ HNSW + flat (non-quantized, WITH .vi) ============================
-- A non-quantized index is exact, so enable_vector_index_refine has no effect: the result is
-- identical whether refine is on or off.
CREATE TABLE t_hnsw_flat (
  id bigint NOT NULL,
  v ARRAY<float> NOT NULL,
  INDEX idx (v) USING VECTOR (
    "index_type" = "hnsw", "dim" = "4", "metric_type" = "l2_distance",
    "is_vector_normed" = "false", "M" = "16", "efconstruction" = "40",
    "index_build_threshold" = "1")
) ENGINE=OLAP
DUPLICATE KEY(id)
DISTRIBUTED BY HASH(id) BUCKETS 1
PROPERTIES ("replication_num" = "1");

DROP TABLE IF EXISTS t_ivfpq;

-- Overflowing element must be a clean error, not a BE crash.
select id from t_ivfpq_overflow order by approx_l2_distance(ARRAY<FLOAT>[1e308, 0.0, 0.0, 0.0], v) limit 1;

create view v1 as select * from t1;

select * from v3;

-- Test 3: GROUP BY virtual column for data distribution analysis
select _tablet_id_, count(*) as row_count, sum(k2) as sum_k2
from olap_table
group by _tablet_id_
order by _tablet_id_;

CREATE TABLE `t0` (
  `c0` int(11) NULL COMMENT "",
  `c1` varchar(20) NULL COMMENT "",
  `c2` varchar(200) NULL COMMENT "",
  `c3` int(11) NULL COMMENT ""
) ENGINE=OLAP
DUPLICATE KEY(`c0`, `c1`)
COMMENT "OLAP"
DISTRIBUTED BY HASH(`c0`, `c1`) BUCKETS 10
PROPERTIES (
"replication_num" = "1"
);

insert into result_tab
with cte as(
SELECT c0,c1,c2, 
lead(c2,1,0) OVER(PARTITION BY c0 ORDER BY c1) c3,
sum(c2) OVER(PARTITION BY c0 ORDER BY c1 ROWS BETWEEN UNBOUNDED PRECEDING AND  1 FOLLOWING) c4,
max(c2) OVER(PARTITION BY c0 ORDER BY c1 ROWS BETWEEN UNBOUNDED PRECEDING AND  1 FOLLOWING) c5
FROM t0)
select sum(murmur_hash3_32(c0,c1,c2,c4,c5,c3)) from cte;

-- ========================================================= COUNT =========================================================

-- COUNT(HAS_NULL) without partition by
SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT COUNT(v2) OVER(ORDER BY v5 ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT COUNT(v2) OVER(ORDER BY v5 ROWS BETWEEN CURRENT ROW AND 5 FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT COUNT(v2) OVER(ORDER BY v6 RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT COUNT(v2) OVER(PARTITION BY v1 ORDER BY v5 ROWS BETWEEN 10 PRECEDING AND 5 PRECEDING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT COUNT(v2) OVER(PARTITION BY v1 ORDER BY v5 ROWS BETWEEN 10000 PRECEDING AND CURRENT ROW) AS wv FROM t1) a;

-- COUNT(NOT_NULL) without partition by
SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT COUNT(v3) OVER(ORDER BY v5 ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT COUNT(v3) OVER(ORDER BY v5 ROWS BETWEEN CURRENT ROW AND 5 FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT COUNT(v3) OVER(ORDER BY v6 RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT COUNT(v3) OVER(PARTITION BY v1 ORDER BY v5 ROWS BETWEEN 10 PRECEDING AND 5 PRECEDING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT COUNT(v3) OVER(PARTITION BY v1 ORDER BY v5 ROWS BETWEEN 10000 PRECEDING AND CURRENT ROW) AS wv FROM t1) a;

-- COUNT(ALL_NULL) without partition by
SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT COUNT(v4) OVER(ORDER BY v5 ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT COUNT(v4) OVER(ORDER BY v5 ROWS BETWEEN CURRENT ROW AND 5 FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT COUNT(v4) OVER(ORDER BY v6 RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT COUNT(v4) OVER(PARTITION BY v1 ORDER BY v5 ROWS BETWEEN 10 PRECEDING AND 5 PRECEDING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT COUNT(v4) OVER(PARTITION BY v1 ORDER BY v5 ROWS BETWEEN 10000 PRECEDING AND CURRENT ROW) AS wv FROM t1) a;

-- ========================================================= SUM =========================================================

-- SUM(HAS_NULL) without partition by
SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v2) OVER(ORDER BY v5 ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v2) OVER(ORDER BY v5 ROWS BETWEEN CURRENT ROW AND 5 FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v2) OVER(ORDER BY v6 RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v2) OVER(PARTITION BY v1 ORDER BY v5 ROWS BETWEEN 10 PRECEDING AND 5 PRECEDING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v2) OVER(PARTITION BY v1 ORDER BY v5 ROWS BETWEEN 10000 PRECEDING AND CURRENT ROW) AS wv FROM t1) a;

-- SUM(NOT_NULL) without partition by
SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v3) OVER(ORDER BY v5 ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v3) OVER(ORDER BY v5 ROWS BETWEEN CURRENT ROW AND 5 FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v3) OVER(ORDER BY v6 RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v3) OVER(PARTITION BY v1 ORDER BY v5 ROWS BETWEEN 10 PRECEDING AND 5 PRECEDING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v3) OVER(PARTITION BY v1 ORDER BY v5 ROWS BETWEEN 10000 PRECEDING AND CURRENT ROW) AS wv FROM t1) a;

-- SUM(ALL_NULL) without partition by
SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v4) OVER(ORDER BY v5 ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v4) OVER(ORDER BY v5 ROWS BETWEEN CURRENT ROW AND 5 FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v4) OVER(ORDER BY v6 RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v4) OVER(PARTITION BY v1 ORDER BY v5 ROWS BETWEEN 10 PRECEDING AND 5 PRECEDING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v4) OVER(PARTITION BY v1 ORDER BY v5 ROWS BETWEEN 10000 PRECEDING AND CURRENT ROW) AS wv FROM t1) a;

-- name: test_first_last_value_reverse
CREATE TABLE t_rev_dec (
    id INT,
    grp INT,
    kind INT,
    amt DECIMAL(38, 10)
) ENGINE=OLAP
DUPLICATE KEY(id)
DISTRIBUTED BY HASH(id) BUCKETS 4
PROPERTIES ("replication_num" = "1");

SELECT id, v FROM t_rev_dec_sink ORDER BY id;

INSERT INTO `test_range_offset_window` VALUES
    (1, NULL, NULL, NULL, NULL, 10),
    (2, NULL, NULL, NULL, NULL, 20),
    (3, 1, 1.00, '2024-01-01', '2024-01-01 00:00:00', 1),
    (4, 2, 2.25, '2024-01-02', '2024-01-15 00:00:00', 2),
    (5, 2, 2.25, '2024-01-02', '2024-02-01 00:00:00', 3),
    (6, 3, 3.50, '2024-01-04', '2024-02-15 00:00:00', 4),
    (7, 5, 5.75, '2024-02-01', '2024-03-01 00:00:00', 5);

-- INT key, peer-group RANGE frame: CURRENT ROW to CURRENT ROW.
SELECT id, k,
       SUM(v) OVER (ORDER BY k ASC NULLS LAST RANGE BETWEEN CURRENT ROW AND CURRENT ROW) AS w
FROM test_range_offset_window
ORDER BY id;

-- INT key, finite FOLLOWING to finite FOLLOWING; produces empty SUM frames.
SELECT id, k,
       SUM(v) OVER (ORDER BY k ASC NULLS LAST RANGE BETWEEN 1 FOLLOWING AND 2 FOLLOWING) AS w
FROM test_range_offset_window
ORDER BY id;

-- name: test_rows_following_frame_with_removed_rows
CREATE TABLE `t0` (
    `k` bigint(20) NOT NULL,
    `v` bigint(20) NOT NULL
) ENGINE=OLAP
DUPLICATE KEY(`k`)
DISTRIBUTED BY HASH(`k`) BUCKETS 1
PROPERTIES (
    "replication_num" = "1"
);

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v2) OVER([skewed] PARTITION BY v1 ORDER BY v5 ROWS BETWEEN UNBOUNDED PRECEDING AND 10 FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v2) OVER([skewed] PARTITION BY v1 ORDER BY v5 ROWS BETWEEN 5000 FOLLOWING AND 15000 FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v2) OVER([skewed] PARTITION BY v2 ORDER BY v5 ROWS BETWEEN UNBOUNDED PRECEDING AND 10 FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v2) OVER([skewed] PARTITION BY v2 ORDER BY v5 ROWS BETWEEN 5000 FOLLOWING AND 15000 FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v2) OVER([skewed] PARTITION BY v3 ORDER BY v5 ROWS BETWEEN UNBOUNDED PRECEDING AND 10 FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v2) OVER([skewed] PARTITION BY v3 ORDER BY v5 ROWS BETWEEN 5000 FOLLOWING AND 15000 FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v2) OVER([skewed] PARTITION BY v4 ORDER BY v5 ROWS BETWEEN UNBOUNDED PRECEDING AND 10 FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v2) OVER([skewed] PARTITION BY v4 ORDER BY v5 ROWS BETWEEN 5000 FOLLOWING AND 15000 FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v2) OVER([skewed] PARTITION BY v5 ORDER BY v5 ROWS BETWEEN UNBOUNDED PRECEDING AND 10 FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v2) OVER([skewed] PARTITION BY v5 ORDER BY v5 ROWS BETWEEN 5000 FOLLOWING AND 15000 FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v2) OVER([skewed] PARTITION BY v6 ORDER BY v5 ROWS BETWEEN UNBOUNDED PRECEDING AND 10 FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v2) OVER([skewed] PARTITION BY v6 ORDER BY v5 ROWS BETWEEN 5000 FOLLOWING AND 15000 FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v2) OVER([skewed] PARTITION BY v7 ORDER BY v5 ROWS BETWEEN UNBOUNDED PRECEDING AND 10 FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v2) OVER([skewed] PARTITION BY v7 ORDER BY v5 ROWS BETWEEN 5000 FOLLOWING AND 15000 FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v2) OVER([skewed] PARTITION BY v8 ORDER BY v5 ROWS BETWEEN UNBOUNDED PRECEDING AND 10 FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v2) OVER([skewed] PARTITION BY v8 ORDER BY v5 ROWS BETWEEN 5000 FOLLOWING AND 15000 FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v2) OVER([skewed] PARTITION BY v9 ORDER BY v5 ROWS BETWEEN UNBOUNDED PRECEDING AND 10 FOLLOWING) AS wv FROM t1) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v2) OVER([skewed] PARTITION BY v9 ORDER BY v5 ROWS BETWEEN 5000 FOLLOWING AND 15000 FOLLOWING) AS wv FROM t1) a;

INSERT INTO `t1` (v1, v2, v3, v4) values
    (101, 101, 101, NULL),
    (101, 101, 102, NULL),
    (101, NULL, 103, NULL),
    (101, NULL, 104, NULL),
    (101, 102, 105, NULL),
    (101, 102, 106, NULL),
    (101, NULL, 107, NULL),
    (101, NULL, 108, NULL),
    (102, 103, 109, NULL),
    (102, 103, 110, NULL),
    (102, NULL, 111, NULL),
    (102, NULL, 112, NULL),
    (102, 104, 113, NULL),
    (102, 104, 114, NULL),
    (102, NULL, 115, NULL),
    (102, NULL, 116, NULL),
    (NULL, 103, 117, NULL),
    (NULL, 103, 118, NULL),
    (NULL, NULL, 119, NULL),
    (NULL, NULL, 120, NULL),
    (NULL, 104, 121, NULL),
    (NULL, 104, 122, NULL),
    (NULL, NULL, 123, NULL),
    (NULL, NULL, 124, NULL);

SELECT COUNT(*), SUM(rk), MIN(rk), MAX(rk) FROM (SELECT dense_rank() OVER (PARTITION BY v2 ORDER BY v1) AS rk FROM t1)a WHERE rk > 1;

SELECT /*+ SET_VAR(pipeline_dop='1')*/ COUNT(*), SUM(wv), MIN(wv), MAX(wv) FROM (SELECT CAST(percent_rank() OVER (PARTITION BY v2 ORDER BY v1) AS decimal64(18,5)) AS wv FROM t1)a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT lead(v3, 1) OVER(PARTITION BY v2 ORDER BY v4) AS wv FROM t5) a;

SELECT SUM(wv), AVG(wv), MIN(wv), MAX(wv) FROM (SELECT SUM(v3) OVER(PARTITION BY v2 ORDER BY v4 ROWS BETWEEN UNBOUNDED PRECEDING AND 10 PRECEDING) AS wv FROM t5) a;

create table nt2 as select * from nt0;

INSERT INTO t1 VALUES 
(
  '2024-01-01',                    -- k1
  TRUE,                            -- c0
  127,                             -- c1
  32000,                           -- c2
  2147483647,                      -- c3
  9223372036854775807,             -- c4
  170141183460469231731687303715884105727,  -- c5 (example large integer)
  12345.6789,                      -- c6
  12345.67,                        -- c7
  123.45678901,                    -- c8
  'ExampleCharData',               -- c9
  '2024-01-02',                    -- c10
  '2024-01-01 12:34:56',           -- c11
  [TRUE, FALSE, TRUE],        -- c15 (<boolean>)
  [1, -1, 127],               -- c16 (<tinyint>)
  [100, -100, 32767],         -- c17 (<smallint>)
  [100000, -100000, 2147483647], -- c18 (<int>)
  [10000000000, -10000000000, 9223372036854775807], -- c19 (<bigint>)
  [12345678901234567890, -12345678901234567890, 170141183460469231731687303715884105727], -- c20 (<largeint>)
  [1.23, 4.56, 7.89],         -- c21 (<double>)
  [1.23, 4.56, 7.89],         -- c22 (<float>)
  [1.23456789, 2.34567890, 3.45678901], -- c23 (<decimal(10,8)>)
  ['abc', 'def', 'ghi'],      -- c24 (<char(100)>)
  ['2024-01-01', '2024-01-02'], -- c25 (<date>)
  ['2024-01-01 12:34:56', '2024-01-02 12:34:56'], -- c26 (<datetime>)
  'ExampleVarcharData',            -- c12
  '{"key": "value"}',              -- c13 (JSON data)
  x'4D7956617262696E61727944617461', -- c14 (VARBINARY data in hexadecimal format)
  MAP{'key1':'value1', 'key2':'value2'}, -- c27 (map<varchar, varchar>)
  row('val1'),    -- c28 (struct<col1 <varchar(1048576)>>)
  ['str1', 'str2', 'str3']    -- c29 (<varchar(100)>)
),
(
  '2024-01-02',                    -- k1
  FALSE,                            -- c0
  128,                             -- c1
  32100,                           -- c2
  2047483647,                      -- c3
  9023372036854775807,             -- c4
  100141183460469231731687303715884105727,  -- c5 (example large integer)
  123450.6789,                      -- c6
  123450.67,                        -- c7
  1230.45678901,                    -- c8
  'a',               -- c9
  '2024-01-01',                    -- c10
  '2024-01-01 13:34:56',           -- c11
  [FALSE, FALSE, FALSE],        -- c15 (<boolean>)
  [1, 1, 127],               -- c16 (<tinyint>)
  [100, 100, 32767],         -- c17 (<smallint>)
  [100000, 100000, 2147483647], -- c18 (<int>)
  [10000000000, 10000000000, 9223372036854775807], -- c19 (<bigint>)
  [12345678901234567890, 12345678901234567890, 170141183460469231731687303715884105727], -- c20 (<largeint>)
  [1.23, 4.56, 7.89],         -- c21 (<double>)
  [1.23, 4.56, 7.89],         -- c22 (<float>)
  [1.23456789, 2.34567890, 3.45678901], -- c23 (<decimal(10,8)>)
  ['abc', 'def', 'ghi'],      -- c24 (<char(100)>)
  ['2024-01-01', '2024-01-02'], -- c25 (<date>)
  ['2024-01-01 12:34:56', '2024-01-02 12:34:56'], -- c26 (<datetime>)
  'ExampleVarcharData',            -- c12
  '{"key": "value"}',              -- c13 (JSON data)
  x'4D7956617262696E61727944617461', -- c14 (VARBINARY data in hexadecimal format)
  MAP{'key1':'value1', 'key2':'value2'}, -- c27 (map<varchar, varchar>)
  row('val1'),    -- c28 (struct<col1 <varchar(1048576)>>)
  ['str1', 'str2', 'str3']    -- c29 (<varchar(100)>)
),
(
  '2024-01-03',                    -- k1
  FALSE,                            -- c0
  128,                             -- c1
  32100,                           -- c2
  2047483647,                      -- c3
  9023372036854775807,             -- c4
  100141183460469231731687303715884105727,  -- c5 (example large integer)
  123450.6789,                      -- c6
  123450.67,                        -- c7
  1230.45678901,                    -- c8
  'a',               -- c9
  '2024-01-01',                    -- c10
  '2024-01-01 13:34:56',           -- c11
  [FALSE, FALSE, FALSE],        -- c15 (<boolean>)
  [1, 1, 127],               -- c16 (<tinyint>)
  [100, 100, 32767],         -- c17 (<smallint>)
  [100000, 100000, 2147483647], -- c18 (<int>)
  [10000000000, 10000000000, 9223372036854775807], -- c19 (<bigint>)
  [12345678901234567890, 12345678901234567890, 170141183460469231731687303715884105727], -- c20 (<largeint>)
  [1.23, 4.56, 7.89],         -- c21 (<double>)
  [1.23, 4.56, 7.89],         -- c22 (<float>)
  [1.23456789, 2.34567890, 3.45678901], -- c23 (<decimal(10,8)>)
  ['abc', 'def', 'ghi'],      -- c24 (<char(100)>)
  ['2024-01-01', '2024-01-02'], -- c25 (<date>)
  ['2024-01-01 12:34:56', '2024-01-02 12:34:56'], -- c26 (<datetime>)
  'ExampleVarcharData',            -- c12
  '{"key": "value"}',              -- c13 (JSON data)
  x'4D7956617262696E61727944617461', -- c14 (VARBINARY data in hexadecimal format)
  MAP{'key1':'value1', 'key2':'value2'}, -- c27 (map<varchar, varchar>)
  row('val1'),    -- c28 (struct<col1 <varchar(1048576)>>)
  ['str1', 'str2', 'str3']    -- c29 (<varchar(100)>)
),
(
  '2024-01-04',                    -- k1
  FALSE,                            -- c0
  128,                             -- c1
  32100,                           -- c2
  2047483647,                      -- c3
  9023372036854775807,             -- c4
  100141183460469231731687303715884105727,  -- c5 (example large integer)
  123450.6789,                      -- c6
  123450.67,                        -- c7
  1230.45678901,                    -- c8
  'a',               -- c9
  '2024-01-01',                    -- c10
  '2024-01-01 13:34:56',           -- c11
  [FALSE, FALSE, FALSE],        -- c15 (<boolean>)
  [1, 1, 127],               -- c16 (<tinyint>)
  [100, 100, 32767],         -- c17 (<smallint>)
  [100000, 100000, 2147483647], -- c18 (<int>)
  [10000000000, 10000000000, 9223372036854775807], -- c19 (<bigint>)
  [12345678901234567890, 12345678901234567890, 170141183460469231731687303715884105727], -- c20 (<largeint>)
  [1.23, 4.56, 7.89],         -- c21 (<double>)
  [1.23, 4.56, 7.89],         -- c22 (<float>)
  [1.23456789, 2.34567890, 3.45678901], -- c23 (<decimal(10,8)>)
  ['abc', 'def', 'ghi'],      -- c24 (<char(100)>)
  ['2024-01-01', '2024-01-02'], -- c25 (<date>)
  ['2024-01-01 12:34:56', '2024-01-02 12:34:56'], -- c26 (<datetime>)
  'ExampleVarcharData',            -- c12
  '{"key": "value"}',              -- c13 (JSON data)
  x'4D7956617262696E61727944617461', -- c14 (VARBINARY data in hexadecimal format)
  MAP{'key1':'value1', 'key2':'value2'}, -- c27 (map<varchar, varchar>)
  row('val1'),    -- c28 (struct<col1 <varchar(1048576)>>)
  ['str1', 'str2', 'str3']    -- c29 (<varchar(100)>)
),
(
  '2024-01-05',                    -- k1
  NULL,                            -- c0
  NULL,                             -- c1
  NULL,                           -- c2
  NULL,                      -- c3
  NULL,             -- c4
  NULL,  -- c5 (example large integer)
  NULL,                      -- c6
  NULL,                        -- c7
  NULL,                    -- c8
  NULL,               -- c9
  NULL,                    -- c10
  NULL,           -- c11
  NULL,        -- c15 (<boolean>)
  NULL,               -- c16 (<tinyint>)
  NULL,         -- c17 (<smallint>)
  NULL, -- c18 (<int>)
  NULL, -- c19 (<bigint>)
  NULL, -- c20 (<largeint>)
  NULL,         -- c21 (<double>)
  NULL,         -- c22 (<float>)
  NULL, -- c23 (<decimal(10,8)>)
  NULL,      -- c24 (<char(100)>)
  NULL, -- c25 (<date>)
  NULL, -- c26 (<datetime>)
  NULL,            -- c12
  NULL,              -- c13 (JSON data)
  NULL, -- c14 (VARBINARY data in hexadecimal format)
  NULL, -- c27 (map<varchar, varchar>)
  NULL,    -- c28 (struct<col1 <varchar(1048576)>>)
  NULL    -- c29 (<varchar(100)>)
);

SELECT FIRST_VALUE(c7) OVER(ORDER BY k1 ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) wv FROM t1;

SELECT FIRST_VALUE(c15) OVER(ORDER BY k1 ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) wv FROM t1;

with cte as( SELECT FIRST_VALUE(c23) OVER(ORDER BY k1 ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) wv FROM t1) select sum(murmur_hash3_32(array_join(array_map(x->murmur_hash3_32(x),wv),","))) from cte;

SELECT FIRST_VALUE(c25) OVER(ORDER BY c3 ROWS BETWEEN UNBOUNDED PRECEDING AND 10 PRECEDING) wv FROM t1;

SELECT FIRST_VALUE(c25 IGNORE NULLS) OVER(ORDER BY c3 ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) wv FROM t1;

-- FIRST_VALUE(HAS_NULL) with partition by
SELECT FIRST_VALUE(c25) OVER(PARTITION BY k1 ORDER BY c3 ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) wv FROM t1;

SELECT FIRST_VALUE(c25) OVER(PARTITION BY k1 ORDER BY c3 ROWS BETWEEN CURRENT ROW AND 5 FOLLOWING) wv FROM t1;

SELECT FIRST_VALUE(c25 IGNORE NULLS) OVER(PARTITION BY k1 ORDER BY c3 ROWS BETWEEN 5 PRECEDING AND CURRENT ROW) wv FROM t1;

SELECT LAST_VALUE(c6) OVER(ORDER BY k1 ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) wv FROM t1;

SELECT LAST_VALUE(c14) OVER(ORDER BY k1 ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) wv FROM t1;

with cte as( SELECT LAST_VALUE(c22) OVER(ORDER BY k1 ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) wv FROM t1) select sum(murmur_hash3_32(array_join(array_map(x->murmur_hash3_32(x),wv),","))) from cte;

SELECT LAST_VALUE(c25) OVER(ORDER BY c3 ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) wv FROM t1;

SELECT LAST_VALUE(c25 IGNORE NULLS) OVER(ORDER BY c3 ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) wv FROM t1;

SELECT LAST_VALUE(c25 IGNORE NULLS) OVER(ORDER BY c3 ROWS BETWEEN CURRENT ROW AND 5 FOLLOWING) wv FROM t1;

SELECT LAST_VALUE(c25) OVER(PARTITION BY k1 ORDER BY c3 ROWS BETWEEN 5 PRECEDING AND CURRENT ROW) wv FROM t1;

SELECT LAST_VALUE(c25 IGNORE NULLS) OVER(PARTITION BY k1 ORDER BY c3 ROWS BETWEEN 5 FOLLOWING AND 10 FOLLOWING) wv FROM t1;

SELECT LEAD(c5) OVER(ORDER BY k1) wv FROM t1;

SELECT LEAD(c13) OVER(ORDER BY k1) wv FROM t1;

with cte as( SELECT LEAD(c21) OVER(ORDER BY k1) wv FROM t1) select sum(murmur_hash3_32(array_join(array_map(x->murmur_hash3_32(x),wv),","))) from cte;

-- LEAD(HAS_NULL) without partition by
SELECT LEAD(c25) OVER(ORDER BY k1) AS wv FROM t1;

SELECT LEAD(c25, 5, -1) OVER(PARTITION BY k1 ORDER BY k1) AS wv FROM t1;

SELECT LAG(c4) OVER(ORDER BY k1) wv FROM t1;

SELECT LAG(c12) OVER(ORDER BY k1) wv FROM t1;

SELECT LAG(c20) OVER(ORDER BY k1) wv FROM t1;

SELECT LAG(c28) OVER(ORDER BY k1) wv FROM t1;

SELECT LAG(c25, 3) OVER(PARTITION BY k1 ORDER BY k1) AS wv FROM t1;

INSERT INTO test_ignore_nulls_page_uv VALUES (1, '2020-06-23 02:30:30', to_bitmap(1002), hll_hash(5));

select BITMAP_COUNT(last_value(visit_users) over(order by visit_date)) as val from test_ignore_nulls_page_uv order by val;

ANALYZE TABLE window_merge_sort_t1 UPDATE HISTOGRAM ON p, s
PROPERTIES(
   "histogram_sample_ratio" = "1.0"
);

-- Stacked windows sharing one SortGroup: hinting only the upper window must not change results.
WITH baseline AS (
    SELECT p, s, x,
        sum(x) OVER (PARTITION BY p, s ORDER BY x ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) AS f1,
        sum(x) OVER (PARTITION BY p, s ORDER BY x) AS f2
    FROM window_merge_sort_t1
),
hinted AS (
    SELECT p, s, x,
        sum(x) OVER (PARTITION BY p, s ORDER BY x ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) AS f1,
        sum(x) OVER ([merge_sort] PARTITION BY p, s ORDER BY x) AS f2
    FROM window_merge_sort_t1
)
SELECT count(*) FROM baseline b JOIN hinted h ON (b.p <=> h.p) AND (b.s <=> h.s) AND b.x = h.x
WHERE NOT (b.f1 <=> h.f1) OR NOT (b.f2 <=> h.f2);

-- Subqueries in both PARTITION BY and ORDER BY, plus one nested in an expression.
select k1,
       sum(k2) over (partition by (select min(v1) from t0) order by k1 + (select count(*) from t0)) as s
from t1 order by k1;

-- name: test_window_pre_agg_with_rank
CREATE TABLE t1 (
    c1 INT NOT NULL,
    c2 INT NOT NULL,
    c3 INT NOT NULL
)
DUPLICATE KEY(c1)
DISTRIBUTED BY HASH(c1) BUCKETS 10
PROPERTIES (
    "replication_num" = "1"
);

-- name: test_window_pre_agg_with_bitmap_union_count
DROP TABLE IF EXISTS t_rank_bitmap_crash;

select k, sum(v) over(partition by k), max(v) over(partition by k) from t0;

ANALYZE TABLE window_skew_mvc_t1 UPDATE HISTOGRAM ON pk,v1,v2 PROPERTIES("histogram_sample_ratio" = "1.0");

-- Prepare data
INSERT INTO window_skew_t1 (pk, v1,v2 ) VALUES (1, 1, 1), (2, 2, 2), (3, 3, 3);

CREATE TABLE `tsmall` (
  `c0` string NOT NULL,
  `c1` bigint NOT NULL,
  `c2` bigint NOT NULL
) ENGINE=OLAP
DUPLICATE KEY(`c0`)
COMMENT "OLAP"
DISTRIBUTED BY HASH(`c0`) BUCKETS 16
PROPERTIES (
"replication_num" = "1"
);

insert into t_zstd_col values
  (1, '{"role":"assistant","parts":[{"type":"text","content":"row one"}]}', parse_json('{"a":1}')),
  (2, '{"role":"assistant","parts":[{"type":"text","content":"row two"}]}', parse_json('{"a":2}')),
  (3, '{"role":"assistant","parts":[{"type":"text","content":"row three"}]}', parse_json('{"a":3}'));

-- restore the default (true): the switch was only exercised above to prove flipping it never affects reads
update information_schema.be_configs set value = "true" where name = "enable_zstd_compression_dict";

ALTER TABLE t_page SET ("zstd_compression_columns" = "v:256k, w");
