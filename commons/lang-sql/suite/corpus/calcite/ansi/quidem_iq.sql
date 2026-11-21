select deptno, stddev_pop(deptno) as sdp from emp group by deptno order by deptno;

select deptno, var_pop(deptno) as vp from emp group by deptno order by deptno;

select deptno, stddev_pop(deptno + 1) as sdp from emp group by deptno order by deptno;

select deptno, min(deptno) as m from emp group by deptno order by deptno;

select deptno, max(deptno) as m, stddev_pop(deptno) as sdp
from emp group by deptno order by deptno;

select count(deptno) as c from emp;

select distinct deptno, count(*) as c from emp group by deptno;

select distinct count(*) as c from emp group by deptno;

select distinct count(*) as c from emp group by deptno order by 1 desc;

SELECT sum(deptno) AS s
FROM (
    SELECT sum(deptno) AS deptno
    FROM dept
    GROUP BY dname);

select some(deptno = 100), every(deptno > 0), intersection(multiset[1, 2]) from emp;

select stddev_pop(deptno) as s from emp;

select gender,
  stddev_pop(deptno) as p,
  stddev_samp(deptno) as s,
  stddev(deptno) as ss,
  count(deptno) as c
from emp
group by gender;

select city, gender as c from emps;

select count(city, gender) as c from emps;

select distinct mod(deptno, 20) as m, gender as c from emps;

select count(mod(deptno, 20), gender) as c from emps;

select deptno, count(*) as c from emps group by grouping sets ((), (deptno));

select 1 as c
from (values ('a', 'b')) as t (a, b)
group by grouping sets ((a), (b), (b, a));

select deptno + 1, count(*) as c
from emp
group by rollup(deptno);

select gender, count(*) as c
from emp
group by rollup(gender);

select gender, count(*) as c
from emp
where false
group by grouping sets (gender, ());

select gender, count(*) as c
from emp
group by rollup(gender)
order by c desc;

select deptno / 2 + 1 as half1, count(*) as c
from emp
group by rollup(deptno / 2, gender), rollup(substring(ename FROM 1 FOR 1));

select deptno, deptno + 1 as d1 from emp group by rollup(deptno);

select deptno, gender, count(*) from emp where deptno = 20 group by cube(deptno, gender), rollup(deptno, gender);

select count(*) from emp where deptno = 20 group by ();

select deptno + 1, count(*) from emp where deptno = 20 group by distinct deptno + 1;

select count(*) as c, grouping(deptno) as g
from emp
group by deptno;

select count(*) as c,
  grouping(deptno) as g,
  group_id() as gid,
  grouping_id(deptno) as gd,
  grouping_id(gender) as gg,
  grouping_id(gender, deptno) as ggd,
  grouping_id(deptno, gender) as gdg
from emp
group by rollup(deptno, gender)
order by c, g, gid, gd, gg, ggd, gdg;

select count(*) as c
from emp
group by rollup(deptno)
order by grouping(deptno), c;

select count(*) as c, deptno, grouping(deptno) as g
from emp
group by rollup(deptno);

select deptno + 1 as d1, deptno + 1 - 1 as d0, count(*) as c
from emp
group by rollup(deptno + 1);

select mod(deptno, 20) as d, count(*) as c, gender as g
from emp
group by rollup(mod(deptno, 20), gender);

select count(*) as c
from emp
group by rollup(1);

select group_id() as g
from "scott".emp
group by ();

select group_id() as g, sum(3) as s3
from "scott".emp
where empno < 0;

select group_id() as g
from "scott".emp
where empno < 0
group by deptno;

select deptno
       , job
       , empno
       , ename
       , sum(sal) sumsal
       , case grouping_id(deptno,job,empno)
           when 0 then 'grouped by deptno,job,empno,ename'
           when 1 then 'grouped by deptno,job'
           when 3 then 'grouped by deptno, grouping set ' || cast(3+group_id() as varchar)
           when 7 then 'grouped by (), grouping set ' || cast(5+group_id() as varchar)
         end gr_text
    from "scott".emp
   group by grouping sets
         ( (deptno,job,empno,ename)
         , (deptno,job)
         , deptno
         , deptno
         , ()
         , ()
         )
   order by deptno
       , job
       , empno;

select deptno, sum(sal) as s
from "scott".emp as t
group by grouping sets (deptno);

select sum(sal) as s
from "scott".emp
group by grouping sets ((job, deptno, comm is null),
  (job, deptno), (job, comm is null), (job, comm is null));

select max(v) as x, min(v) as n
from (values cast(-86.4 as double), cast(-100 as double)) as t(v);

select max(v) as x, min(v) as n
from (values cast(-86.4 as float), cast(-100 as float)) as t(v);

SELECT SUM((select min(cast(deptno as integer)) from "scott".dept)) as s
FROM "scott".emp;

SELECT SUM(
  (select char_length(dname) from "scott".dept where dept.deptno = emp.empno)) as s
FROM "scott".emp;

select cardinality(fusion(empnos)) as f_empnos_length from (select deptno, collect(empno) as empnos
from "scott".emp
group by deptno);

select fusion(deptnos) as deptnos
from (
  select collect(distinct deptno) as deptnos
  from "scott".emp
  group by deptno);

select deptno, collect(distinct job) as jobs
from "scott".emp
group by deptno;

select deptno,
  sum(sal) filter (where job = 'CLERK') c_sal,
  sum(sal) filter (where job = 'CLERK' and deptno > 10) c10_sal,
  max(sal) filter (where job = 'CLERK') as max_c,
  min(sal) filter (where job = 'CLERK') as min_c,
  max(sal) filter (where job = 'CLERK')
    - min(sal) filter (where job = 'CLERK') as range_c,
  max(sal) filter (where job = 'SALESMAN')
    - min(sal) filter (where job = 'SALESMAN') as range_m
from "scott".emp
group by deptno;

select deptno
from "scott".emp
group by deptno
having sum(sal) filter (where job = 'CLERK') > 1000;

select dept.deptno,
  sum(sal) filter (where 1 < 2) as s,
  sum(sal) as s1,
  count(*) filter (where emp.ename < dept.dname) as c
from "scott".emp
join "scott".dept using (deptno)
group by dept.deptno;

select deptno,
 count(distinct job) filter (where job <> 'SALESMAN') as cdj
from "scott".emp
group by deptno;

select  COALESCE(sum(case when x = 1 then 1 else 0 end),0) as a,
        COALESCE(sum(case when x = 1 then 2 else 0 end),0) as b,
        COALESCE(sum(case when x = 1 then 3 else -1 end),0) as c
from (values 0, null, 0, 2) as t(x) where x*x=1;

select  sum(case when x = 1 then 1 else 0 end) as a,
        sum(case when x = 1 then 2 else 0 end) as b,
        sum(case when x = 1 then 3 else -1 end) as c
from (values 0, null, 0, 2) as t(x);

select count(*) filter (where (x = 0) is false) as c
from (values 0, null, 0, 1) as t(x);

select count(distinct deptno) as cd, count(*) as c
from "scott".emp
group by deptno;

select deptno, count(distinct deptno) as c
from "scott".emp
group by deptno;

select deptno,
 count(distinct job) as j, count(distinct mgr) as m
from "scott".emp
group by deptno;

select count(distinct job) as dj,
 count(job) as j,
 count(distinct mgr) as m,
 sum(sal) as s
from "scott".emp;

select deptno, count(*) filter (where job = 'CLERK') as cf, count(*) as c
from (
  select * from "scott".emp where deptno < 20
  union all
  select * from "scott".emp where deptno > 20)
group by deptno;

select sum(sal)
from "scott".emp join "scott".dept using (deptno);

select sum(sal)
from "scott".emp join "scott".dept using (deptno)
group by emp.deptno;

select count(*) as c, sum(sal) as s
from "scott".emp join "scott".dept using (deptno);

select count(*) as c, sum(sal) as s
from "scott".emp join "scott".dept using (deptno) group by emp.job, dept.deptno;

select count(*) as c, sum(sal) as s
from "scott".emp join "scott".dept using (deptno) group by emp.sal;

select sum(e.sal) as s
from "scott".emp e join "scott".emp m on e.mgr = m.empno;

select sum(e.sal) as s
from "scott".emp e join "scott".emp m on e.mgr = m.empno
group by m.empno;

select  sum(x) as sum_cnt,
  count(distinct y) as cnt_dist
from
  (
  select
    count(*)                as x,
          t1.job      as y,
    t1.deptno as z
  from
    "scott".emp t1
  group by t1.job, t1.deptno
  order by t1.job, t1.deptno
) sq(x,y,z)
group by z
order by sum_cnt;

select '1' from "scott".emp where false group by 1;

select count('1') from "scott".emp where false group by ();

select '1' from (values (1, 2), (3, 4)) where false group by 1;

select count('1') from (values (1, 2), (3, 4)) where false group by ();

select '1' from "scott".emp join "scott".dept using (deptno) where false group by 1;

select count('1') from "scott".emp join "scott".dept using (deptno) where false group by ();

select count(*) from "scott".emp having false;

select 2 as two
from emp
group by ();

select (select 2 from emp group by ()) as two
from emp
group by ();

select rowtime, count(*) as c
from (
  select timestamp '1970-1-1 0:0:0' + (floor(timestamp '1970-1-1 0:0:0' + ((rowtime - timestamp '1970-1-1 0:0:0') second) / 2 to hour) - timestamp '1970-1-1 0:0:0') second * 2 as rowtime
  from Orders)
group by rowtime;

select d.deptno, min(e.empid) as empid
from (values (100, 'Bill', 1),
             (200, 'Eric', 1),
             (150, 'Sebastian', 3)) as e(empid, name, deptno)
join (values (1, 'LeaderShip'),
             (2, 'TestGroup'),
             (3, 'Development')) as d(deptno, name)
on e.deptno = d.deptno
group by d.deptno
having count(*) > 1;

select CURRENT_USER as CUSER
from jdbc_scott.emp
group by CURRENT_USER;

select nullif(count(distinct '1'),0)
from (values (1,2),(3,4));

select
 sum(sal) as sum_sal,
 count(distinct case
       when job = 'CLERK'
       then deptno else null end) as count_distinct_clerk,
 sum(case when deptno = 10 then sal end) as sum_sal_d10,
 sum(case when deptno = 20 then sal else 0 end) as sum_sal_d20,
 sum(case when deptno = 30 then 1 else 0 end) as count_d30,
 count(case when deptno = 40 then 'x' end) as count_d40,
 sum(case when deptno = 45 then 1 end) as count_d45,
 sum(case when deptno = 50 then 1 else null end) as count_d50,
 sum(case when deptno = 60 then null end) as sum_null_d60,
 sum(case when deptno = 70 then null else 1 end) as sum_null_d70,
 count(case when deptno = 20 then 1 end) as count_d20
from emp
where false;

WITH EmpAnalytics AS (
    SELECT deptno, job, AVG(sal) AS avg_sal
    FROM "scott".emp
    GROUP BY deptno, job)
SELECT job, AVG(avg_sal) AS avg_sal2
FROM EmpAnalytics
WHERE deptno = 30
GROUP BY job;

select count(distinct DEPTNO), COUNT(JOB), MIN(SAL), MAX(SAL) from "scott".emp;

select MGR, count(distinct DEPTNO, JOB), MIN(SAL), MAX(SAL) from "scott".emp group by MGR;

SELECT any_value(empno) as anyempno from "scott".emp group by sal;

SELECT
  regr_sxx(CAST(COMM AS DECIMAL(12, 4)), CAST(SAL AS DECIMAL(12, 4))) as "REGR_SXX(COMM, SAL)",
  regr_syy(CAST(COMM AS DECIMAL(12, 4)), CAST(SAL AS DECIMAL(12, 4))) as "REGR_SYY(COMM, SAL)",
  regr_sxx(CAST(SAL AS DECIMAL(12, 4)), CAST(COMM AS DECIMAL(12, 4))) as "REGR_SXX(SAL, COMM)",
  regr_syy(CAST(SAL AS DECIMAL(12, 4)), CAST(COMM AS DECIMAL(12, 4))) as "REGR_SYY(SAL, COMM)"
from "scott".emp;

select
  covar_pop(x, y) as cp,
  covar_samp(x, y) as cs,
  regr_sxx(x, y) as sxx,
  regr_syy(x, y) as syy
from (values (1, 0.5e0), (2, 1.0e0)) as t(x, y);

SELECT
  MONTH(HIREDATE) as "MONTH",
  covar_samp(CAST(SAL AS DECIMAL(12, 4)), CAST(COMM AS DECIMAL(12, 4))) as "COVAR_SAMP(SAL, COMM)",
  var_pop(CAST(COMM AS DECIMAL(12, 4))) as "VAR_POP(COMM)",
  var_samp(CAST(SAL AS DECIMAL(12, 4))) as "VAR_SAMP(SAL)"
from "scott".emp
group by MONTH(HIREDATE);

select deptno, collect(empno) within group (order by empno desc) as empnos
from "scott".emp
group by deptno;

select deptno, collect(empno) within group (order by empno desc)
filter (where empno > 7500) as empnos
from "scott".emp
group by deptno;

select dept.deptno,
  collect(sal) within group (order by sal desc) as s,
  collect(sal) within group (order by 1)as s1,
  collect(sal) within group (order by sal) filter (where sal > 2000) as s2
from "scott".emp
join "scott".dept using (deptno)
group by dept.deptno;

select bit_and(deptno), bit_or(deptno), bit_xor(deptno) from "scott".emp;

WITH wikipedia AS (
  SELECT empno AS delta,
    CASE WHEN deptno = 10 THEN 'true' ELSE 'false' END AS isRobot,
    ename AS "user"
  FROM "scott".emp)
SELECT COUNT(DISTINCT
    CASE WHEN (((CASE WHEN wikipedia.delta IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
                      THEN REPLACE('Yes', 'Yes', 'Yes')
                      ELSE REPLACE('No', 'No', 'No') END) = 'No'))
         AND (wikipedia.isRobot = 'true')
         THEN (wikipedia."user")
         ELSE NULL END)
  - (MAX(CASE WHEN (((CASE WHEN wikipedia.delta IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
                           THEN REPLACE('Yes', 'Yes', 'Yes')
                           ELSE REPLACE('No', 'No', 'No') END) = 'No'))
              AND (wikipedia.isRobot = 'true')
              THEN NULL
              ELSE -9223372036854775807 END)
       + 9223372036854775807 + 1) AS "wikipedia.count_distinct_filters_that_dont_work"
FROM wikipedia
LIMIT 500;

select gender, json_arrayagg(json_object('ename': ename, 'deptno': deptno) format json) from emp group by gender;

select json_object('deptno': deptno, 'employees': json_arrayagg(json_object('ename': ename, 'gender': gender) format json) format json) from emp group by deptno;

select gender,
json_arrayagg(deptno order by deptno),
json_arrayagg(deptno order by deptno desc)
from emp group by gender;

select gender,
json_objectagg(ename: deptno),
json_objectagg(ename: deptno absent on null)
from emp group by gender;

select listagg(v, ',') as r from (values ('a')) as t(v) where false;

select listagg(ename) within group(order by gender, ename) as combined_name from emp;

select
    group_concat(distinct ename order by ename) as combined_name,
    group_concat(ename order by ename separator ';') as separated_name
from emp;

select
   group_concat(deptno, ename order by ename separator ';') as separated_name
from emp;

select deptno, countif(gender = 'F') as f
from emp
group by deptno;

select countif(a > 0) + countif(a > 1) + countif(c > 1) as c
from (select 1 as a, 2 as b, 3 as c);

select MODE(distinct gender) as m
from emp;

select MODE(gender) as m
from emp
where deptno > 60;

select deptno, MODE(gender) as m
from emp
where ename = 'Wilma'
group by deptno;

select deptno, MODE(CAST(null AS INTEGER)) as m
from emp
group by deptno;

select ename, deptno, gender, grouping(ename) as g_e,
  grouping(deptno) as g_d, grouping(gender) as g_g
from emp
where gender = 'M'
group by grouping sets (ename, deptno, (ename, deptno),
  (ename, deptno, gender))
having grouping_id(ename, deptno, gender) <> 0
order by ename, deptno;

select
    case when deptno in (1, 2, 3, 4, 5) THEN 1 else 0 end
from emp
group by
    case when deptno in (1, 2, 3, 4, 5) THEN 1 else 0 end;

with
    CTE1(rownr1, val1) as ( select ROW_NUMBER() OVER(ORDER BY id ASC), id from (values (1), (2)) as Vals1(id) ),
    CTE2(rownr2, val2) as ( select ROW_NUMBER() OVER(ORDER BY id ASC), id from (values (1), (2)) as Vals2(id) )
select
    CTE1.rownr1, CTE1.val1, CTE2.rownr2, CTE2.val2
from
    CTE1,CTE2
where
    CTE1.val1 = CTE2.val2;

select arg_min(distinct ename, deptno) as mi, arg_max(distinct ename, deptno) as ma
from emp;

select arg_min(ename, deptno) as mi, arg_max(ename, deptno) as ma
from emp
where deptno > 60;

select g, arg_min(v, c) as mi, arg_max(v, c) as ma
from (values (1, 10, cast(null as integer))) as t(g, v, c)
group by g;

select arg_min(deptno, empno) as mi,
  arg_max(deptno, empno) as ma,
  arg_max(deptno, empno) filter (where job = 'MANAGER') as mamgr
from emp;

select arg_min(x, v) as mi, arg_max(x, v) as ma, min(v) as mn, max(v) as mx
from (values (1, map['a', 2]), (2, map['a', 1]), (3, map['b', 0])) as t(x, v);

select distinct sum(deptno + '1') as deptsum from dept order by 1;

select deptno,
  percentile_cont(0.5) within group (order by empno) as c,
  percentile_disc(0.5) within group (order by empno) as d
from emp
group by deptno
order by deptno;

select
  percentile_cont(0.5) within group (order by v) as c,
  percentile_disc(0.5) within group (order by v) as d
from (values (cast(1.5 as double)),
             (cast(2.5 as double)),
             (cast(4.5 as double)),
             (cast(8.5 as double))) as t(v);

select
  percentile_cont(0.75) within group (order by v) as c
from (values (cast('9999999999999999990' as decimal(19, 0))),
             (cast('9999999999999999994' as decimal(19, 0))),
             (cast('9999999999999999998' as decimal(19, 0)))) as t(v);

select sum(mgr) from emp;

select coalesce(sum(cast(mgr as int)),0) as m
from emp;

SELECT deptno, job, sal, SUM(comm),
       GROUPING(deptno) AS deptno_flag,
       GROUPING(job) AS job_flag,
       GROUPING(sal) AS sal_flag
FROM emp
GROUP BY GROUPING SETS ((deptno, job), (deptno, sal), (deptno, job))
ORDER BY deptno, job, sal;

SELECT deptno, job, sal, SUM(comm),
       GROUPING(deptno) AS deptno_flag,
       GROUPING(job) AS job_flag,
       GROUPING(sal) AS sal_flag,
       GROUP_ID() AS group_id
FROM emp
GROUP BY GROUPING SETS ((deptno, job), (deptno, sal), (deptno, job));

select deptno,
       ename,
       sal as sal_col,
       emp.JOB as full_identifier,
       sal+comm as two_cols_only_one_in_group_by,
       sal+1 as sal_plus_constant,
       3 as constant_3,
       max(sal) as agg_func
from emp group by deptno, sal_col;

SELECT deptno, job, COUNT(DISTINCT ename)
FROM "scott".emp
GROUP BY ROLLUP(deptno, job);

SELECT deptno, COUNT(DISTINCT sal), SUM(sal)
FROM emp
GROUP BY GROUPING SETS ((deptno), ());

SELECT deptno, COUNT(DISTINCT sal), SUM(DISTINCT sal), COUNT(*)
FROM emp
GROUP BY GROUPING SETS ((deptno), ());

SELECT (SELECT max(ename) FROM dept) AS m FROM emp;

WITH empty_aa (a) AS (SELECT 1 FROM emp WHERE 1 = 0),
  xx (x) AS (VALUES 10, 20, 30)
SELECT (SELECT sum(a) FROM xx LIMIT 1) AS sa
FROM empty_aa;

WITH aa (a) AS (VALUES 1, 2, 3),
  xx (x) AS (VALUES 10, 20, 30)
SELECT (SELECT sum(1) FROM xx LIMIT 1) AS s
FROM aa;

WITH aa (a, b) AS (VALUES (1, 10), (2, 20), (3, 30)),
  xx (x) AS (VALUES 100, 200, 300)
SELECT (SELECT sum(a) + sum(b) FROM xx LIMIT 1) AS s
FROM aa;

WITH aa (a, b) AS (VALUES (1, 10), (2, 20), (3, 30)),
  empty_xx (x) AS (SELECT 1 FROM emp WHERE 1 = 0)
SELECT (SELECT sum(a) + sum(b) FROM empty_xx LIMIT 1) AS s
FROM aa;

WITH aa (a) AS (VALUES 1, 2, 3),
  xx (x) AS (VALUES 10, 20, 30)
SELECT (SELECT sum(a) FROM xx LIMIT 1) AS sa,
  (SELECT count(a) FROM xx LIMIT 1) AS ca
FROM aa;

select *, count(*) as c from (values (1, 'a'), (1, 'a'), (2, 'b')) as t(x, y)
group by all
order by x;

select deptno, ename, sum(sal) as sumsal
from emp
group by grouping sets ((deptno), (*))
order by deptno, ename nulls first;

select g, count(*) as cnt
from (
  select grouping(ename) as g
  from emp
  group by grouping sets ((deptno), (*)))
group by g
order by g;

select deptno, ename, sum(sal) as sumsal
from emp
group by grouping sets ((deptno), (*), ())
order by deptno nulls last, ename nulls first;

SELECT floor(empno/2) as empno
FROM emp
GROUP BY floor(empno/2);

SELECT floor(empno/100) as empno
FROM emp
GROUP BY empno;

SELECT floor(empno/100) as X
FROM emp
GROUP BY X;

SELECT sum(empno / 100), EMPNO / 100 as X
FROM EMP
GROUP BY X
ORDER BY X;

SELECT sum(empno / 100), EMPNO / 100 as empno
FROM EMP
GROUP BY empno
HAVING empno > 75;

SELECT MAX(empno)
FROM EMP
GROUP BY deptno
HAVING MOD(MAX(empno), 2) = 0;

SELECT MAX(empno) AS deptno
FROM EMP
HAVING MOD(deptno, 2) = 0;

SELECT *
FROM (VALUES (2, 3)) AS t1(k, t)
ASOF JOIN (VALUES (2.0, 0.0)) AS t2(k, t)
MATCH_CONDITION t2.t < t1.t
ON t1.k = t2.k;

SELECT *
FROM (VALUES (NULL, 0), (1, NULL), (1, 0), (1, 1), (1, 2), (1, 3), (1, 4), (2, 3), (3, 4)) AS t1(k1, ts1)
ASOF JOIN (VALUES (1, NULL), (1, 2), (1, 3), (2, 10), (2, 0)) AS t2(k2, ts2)
MATCH_CONDITION ts2 < ts1
ON k1 = k2;

SELECT *
FROM (VALUES (NULL, 0), (1, NULL), (1, 0), (1, 1), (1, 2), (1, 3), (1, 4), (2, 3), (3, 4)) AS t1(k, t)
ASOF JOIN (VALUES (1, NULL), (1, 2), (1, 3), (2, 10), (2, 0)) AS t2(k, t)
MATCH_CONDITION t2.t >= t1.t
ON t1.k = t2.k;

SELECT *
FROM (VALUES (NULL, 0), (1, NULL), (1, 0), (1, 1), (1, 2), (1, 3), (1, 4), (2, 3), (3, 4)) AS t1(k, t)
LEFT ASOF JOIN (VALUES (1, NULL), (1, 2), (1, 3), (2, 10), (2, 0)) AS t2(k, t)
MATCH_CONDITION t2.t < t1.t
ON t1.k = t2.k;

SELECT *
FROM (VALUES (NULL, 0), (1, NULL), (1, 0), (1, 1), (1, 2), (1, 3), (1, 4), (2, 3), (3, 4)) AS t1(k, t)
LEFT ASOF JOIN (VALUES (1, NULL), (1, 2), (1, 3), (2, 10), (2, 0)) AS t2(k, t)
MATCH_CONDITION t2.t >= t1.t
ON t1.k = t2.k;

CREATE TABLE source_stream_a (
    common_join_attribute SMALLINT,
    join_key_a2 VARCHAR,
    join_key_a1 VARCHAR,
    event_timestamp TIMESTAMP
);

CREATE TABLE source_stream_c (
    join_key_b1 VARCHAR NOT NULL,
    join_key_c2 VARCHAR NOT NULL,
    common_join_attribute SMALLINT,
    epoch_ts_c BIGINT,
    timestamp_c TIMESTAMP,
    event_timestamp TIMESTAMP
);

SELECT *
FROM (VALUES (NULL, 0), (1, NULL), (1, 0), (1, 1), (1, 2), (1, 3), (1, 4), (2, 3), (3, 4)) AS t1(k, t)
ASOF JOIN (VALUES (1, NULL), (1, 2), (1, 3), (2, 10), (2, 0)) AS t2(k, t)
MATCH_CONDITION t2.t < t1.t
ON t1.k = t2.k
WHERE EXISTS (SELECT 1 FROM (VALUES 1) AS t3(k) WHERE t3.k = t1.k);

WITH t1(k, t) AS (VALUES (NULL, 0), (1, NULL), (1, 0), (1, 1), (1, 2), (1, 3), (1, 4), (2, 3), (3, 4)),
t2(k, t) AS (VALUES (1, NULL), (1, 2), (1, 3), (2, 10), (2, 0))
SELECT o.k
FROM (VALUES 1, 2, 3) AS o(k)
WHERE EXISTS (
  SELECT 1 FROM t1 ASOF JOIN t2
  MATCH_CONDITION t2.t < t1.t
  ON t1.k = t2.k
  WHERE t1.k = o.k);

WITH t1(k, t) AS (VALUES (NULL, 0), (1, NULL), (1, 0), (1, 1), (1, 2), (1, 3), (1, 4), (2, 3), (3, 4)),
t2(k, t) AS (VALUES (1, NULL), (1, 2), (1, 3), (2, 10), (2, 0))
SELECT o.k,
  (SELECT COUNT(*) FROM t1 ASOF JOIN t2
   MATCH_CONDITION t2.t < t1.t
   ON t1.k = t2.k
   WHERE t1.k = o.k) AS c
FROM (VALUES 1, 2, 3) AS o(k);

SELECT *
FROM (VALUES (1, 4)) AS t1(k, t)
ASOF JOIN (VALUES (1, 2), (1, 3), (1, 5), (2, 1)) AS t2(k, t)
MATCH_CONDITION t2.t < t1.t
ON t1.k = t2.k;

SELECT *
FROM (VALUES (1, 1)) AS t1(k, t)
LEFT ASOF JOIN (VALUES (1, 2), (1, 3), (1, 5), (2, 1)) AS t2(k, t)
MATCH_CONDITION t2.t < t1.t
ON t1.k = t2.k;

insert into foo values (1, 0);

select * from foo;

select * from bar;

create table table1(i int, j int);

insert into table1 values (1, 2), (1, 3);

select i, j from table1 where table1.j NOT IN (select i from table2 where table1.i=table2.j);

select * from table1 where j not in (select i from table2) or i = 1;

select * from table1 where j not in (select i from table2) or j = 3;

select any_value(r) over(), s from(select map[f, s] r, s from (select 1 as f, 2 as s) t) t;

CREATE TABLE complex_t (
    a INTEGER ARRAY,
    m MAP<VARCHAR, DOUBLE>,
    r ROW(r1 VARCHAR, r2 INTEGER, r3 VARCHAR)
);

select
    max(a) as max_a,
    max(m) as max_m,
    max(r) as max_r,
    min(a) as min_a,
    min(m) as min_m,
    min(r) as min_r
from complex_t;

INSERT INTO EMP VALUES (0, 70, '-2147483649', '-6721455509335307966', 0, '1970-01-01', 0, 0, 1);

CREATE TABLE tmp_emps (
  empid INTEGER NOT NULL,
  deptno INTEGER NOT NULL,
  name VARCHAR(10) NOT NULL,
  salary DECIMAL(10, 2) NOT NULL,
  commission INTEGER);

select * from tmp_emps e1 where EXISTS(select * from (
  select e2.deptno from tmp_emps e2
  where e2.commission = e1.commission) as table3
where  table3.deptno <> e1.deptno);

select cast('2017-05-01 01:23:45.678912345' as
    timestamp);

select cast('2017-05-03 08:59:01.123456789PM 01:30'
    as timestamp FORMAT 'YYYY-MM-DD HH12:MI:SS.FF9PM TZH:TZM');

select cast('20170501120159123456789AM-0130' as
    timestamp FORMAT 'YYYYDDMMHH12MISSFFAMTZHTZM');

select cast('--2017----05-01-' as
    timestamp FORMAT '-YYYY--MM---DD---');

select cast('2017-./,\';

select cast("2013\\'09-01" as
    timestamp FORMAT "YYYY'MM-DD");

select cast("2013\\\\'09-03" as
    timestamp FORMAT "YYYY'MM-DD");

select cast('2017-05-01-12:30' as
    timestamp FORMAT 'YYYY-MM-DD-');

select cast('2017-05-01-' as
    timestamp FORMAT 'YYYY-MM-DD-HH12');

select cast(cast('2012-11-04 13:02:59.123456' as timestamp)
    as char(50) format 'DD-MM-YYYY MI:HH12:SS A.M. FF9 DDD SSSSS HH12 HH24');

select cast(cast(NULL as timestamp) as varchar
    FORMAT 'YYYY-MM-DD');

select cast('2018-11-09t15:11:04Z' as
    timestamp FORMAT 'YYYY-MM-DDTHH24:MI:SSz');

select cast(cast('2018-11-10 15:11:04' as
    timestamp) as varchar format 'YYYY-MM-DDTHH24:MI:SSZ');

select cast('2019-300 15:59:44.123456789 01:01' as
    timestamp format 'yyyy-ddd hh24:mi:ss.ff9 tzh-tzm');

select cast('2019-11-22 10000.123456789 02:02'
    as timestamp format 'yyyy-mm-dd sssss ff9 tzh-tzm');

select cast('95-02-28' as
    timestamp FORMAT 'YYYY-MM-DD');

select cast('95-04-30' as
    timestamp FORMAT 'YYY-MM-DD');

select cast('5-06-30' as
    timestamp FORMAT 'YY-MM-DD');

select cast('950831' as
    timestamp FORMAT 'YYMMDD');

select cast(cast('2019-01-01' as timestamp) as varchar
    format 'YYYY');

select cast(cast('2019-01-01' as timestamp) as varchar
    format 'YYY');

select cast('1400-05-21' as
    timestamp FORMAT 'RRRR-MM-DD');

select cast('017-01-31' as
    timestamp FORMAT 'RRRR-MM-DD');

select cast('49-03-31' as
    timestamp FORMAT 'RRRR-MM-DD');

select cast('49-03-31' as
    timestamp FORMAT 'RR-MM-DD');

select cast(cast('2019-01-01' as timestamp) as varchar
    format 'RRRR');

select cast('2010-February-11' as timestamp FORMAT
    'YYYY-MONTH-DD');

select cast('APRIL 13 2010' as date FORMAT
    'MONTH DD YYYY');

select cast('2010 14 June' as timestamp FORMAT
    'YYYY DD MONTH');

select cast('2010 14 AUGUST' as timestamp FORMAT
    'YYYY DD MONTH');

select cast('2010 14 october' as date FORMAT
    'YYYY DD month');

select cast('2010 14 December' as date FORMAT
    'YYYY DD month');

select cast(date'2010-10-18' as varchar FORMAT
    'MONTH Month month');

select cast(date'2010-12-19' as varchar FORMAT
    'MONTH Month month');

select cast(date'2010-02-19' as varchar FORMAT
    'MONTH Month month');

select cast(date'2010-04-19' as varchar FORMAT
    'MONTH Month month');

select cast(date'2010-06-19' as varchar FORMAT
    'MONTH Month month');

select cast(date'2010-08-19' as varchar FORMAT
    'MONTH Month month');

select cast(date'2010-09-20' as varchar FORMAT
    'MOnth MONth MONTh');

select cast(date'2010-10-18' as varchar FORMAT
    'FMMONTH FMMonth FMmonth');

select cast(date'2010-12-19' as varchar FORMAT
    'FMMONTH FMMonth FMmonth');

select cast(date'2010-02-19' as varchar FORMAT
    'FMMONTH FMMonth FMmonth');

select cast(date'2010-04-19' as varchar FORMAT
    'FMMONTH FMMonth FMmonth');

select cast(date'2010-06-19' as varchar FORMAT
    'FMMONTH FMMonth FMmonth');

select cast(date'2010-08-19' as varchar FORMAT
    'FMMONTH FMMonth FMmonth');

select cast('2010SEPTEMBER17' as date FORMAT
    'YYYYMONTHDD');

select cast(cast('2010-07-20' as timestamp) as varchar
    FORMAT 'YYYYmonthDD');

select cast(cast('2010-08-20' as timestamp) as varchar
    FORMAT 'YYYYFMMonthDD');

select cast('2010-February-19' as timestamp FORMAT
    'FXYYYY-MONTH-DD');

select cast('2010-February 22' as date FORMAT
    'FXYYYY-MONTHDD');

select cast('2015-Feb-11' as timestamp FORMAT
    'YYYY-MON-DD');

select cast('APR 13 2015' as timestamp FORMAT
    'MON DD YYYY');

select cast('2015 14 jun' as timestamp FORMAT
    'YYYY DD MON');

select cast('2015 14 AUG' as timestamp FORMAT
    'YYYY DD MON');

select cast('2015 14 oct' as timestamp FORMAT
    'YYYY DD mon');

select cast('2015 14 DEC' as timestamp FORMAT
    'YYYY DD mon');

select cast(date'2015-10-18' as varchar FORMAT
    'MON Mon mon');

select cast(date'2015-12-19' as varchar FORMAT
    'MON Mon mon');

select cast(date'2015-02-19' as varchar FORMAT
    'MON Mon mon');

select cast(date'2015-04-19' as varchar FORMAT
    'MON Mon mon');

select cast(date'2015-06-19' as varchar FORMAT
    'MON Mon mon');

select cast(date'2015-08-19' as varchar FORMAT
    'MON Mon mon');

select cast(date'2010-09-22' as varchar FORMAT
    'MOn mON moN');

select cast(cast('2015-07-20' as timestamp) as varchar
    FORMAT 'YYYYmonDD');

select cast(date'2015-09-22' as varchar
    FORMAT 'FXYYYYFMMonDD');

select cast(date'2019-01-07' as varchar
    FORMAT 'WW');

select cast(date'2019-02-01' as varchar
    FORMAT 'WW');

select cast(date'2019-12-01' as varchar
    FORMAT 'WW');

select cast(date'2019-12-03' as varchar
    FORMAT 'WW');

select cast(date'2019-12-31' as varchar
    FORMAT 'WW');

select cast(cast('2019-01-01' as timestamp) as varchar
    FORMAT 'W');

select cast(cast('2019-01-08' as timestamp) as varchar
    FORMAT 'W');

select cast(cast('2019-01-15' as timestamp) as varchar
    FORMAT 'W');

select cast(cast('2019-01-22' as timestamp) as varchar
    FORMAT 'W');

select cast(cast('2019-01-29' as timestamp) as varchar
    FORMAT 'W');

select cast('2019 1' as timestamp FORMAT 'YYYY DDD');

select cast('2019 32' as timestamp FORMAT 'YYYY DDD');

select cast('2019 365' as timestamp FORMAT 'YYYY DDD');

select cast('2000 60' as timestamp FORMAT 'YYYY DDD');

select cast('2000 366' as timestamp FORMAT 'YYYY DDD');

select cast('20190011120' as timestamp
    FORMAT 'YYYYDDDHH12MI');

select cast(cast('2019-12-31' as timestamp) as varchar
    format'DDD');

select cast(cast('2019 123' as timestamp
    format 'YYYY DDD') as varchar format'DDD');

select cast('2010-08-Tue' as timestamp FORMAT 'IYYY-IW-DY'),
           cast('2010-mon-08' as timestamp FORMAT 'IYYY-DY-IW'),
           cast('2010-Wed-08' as date FORMAT 'IYYY-DY-IW'),
           cast('2010 08 THU' as timestamp FORMAT 'IYYY IW DY'),
           cast('2010 08 Fri' as date FORMAT 'IYYY IW DY'),
           cast('2010 08 sat' as timestamp FORMAT 'IYYY IW DY'),
           cast('sUn 2010 08' as date FORMAT 'DY IYYY IW'),
           cast('Mon 2010 09' as date FORMAT 'DY IYYY IW');

select cast('2010MONDAY09' as date FORMAT 'IYYYDAYIW'),
           cast('2010WEDNESDAY9' as timestamp FORMAT 'IYYYDAYIW');

select cast('2010-Monday-09' as timestamp FORMAT 'FXIYYY-DAY-IW'),
           cast('2010-Monday  X-09' as timestamp FORMAT 'FXIYYY-DAY-IW');

select cast('2010-Monday-09' as timestamp FORMAT 'FXIYYY-FMDAY-IW'),
           cast('2010-Monday09' as timestamp FORMAT 'FXIYYY-FMDAYIW'),
           cast('2010Monday09' as date FORMAT 'FXIYYYFMDAYIW');

select cast(cast('2019-11-14' as timestamp) as varchar
    format 'DAY Day day DY Dy dy');

select cast(cast('2019-11-16' as timestamp) as varchar
    format 'DAY Day day DY Dy dy');

select cast(cast('2019-11-18' as timestamp) as varchar
    format 'DAY Day day DY Dy dy');

select cast(cast('2019-11-13' as timestamp) as varchar
    format 'FMDAY FMDay FMday FMDY FMDy FMdy');

select cast(cast('2019-11-15' as timestamp) as varchar
    format 'FMDAY FMDay FMday FMDY FMDy FMdy');

select cast(cast('2019-11-17' as timestamp) as varchar
    format 'FMDAY FMDay FMday FMDY FMDy FMdy');

select cast(cast('2019-11-19' as timestamp) as varchar
    format 'FMDAY FMDay FMday FMDY FMDy FMdy');

select cast(date'2019-11-11' as varchar
    format 'YYYYDayMonth');

select cast(cast('2019-01-01' as timestamp) as varchar
    format 'FXYYYY DAY DD');

select cast(cast('2019-02-02' as timestamp) as varchar
    format 'FXYYYY DY DD');

select cast('2019-11-10 86399.11' as
    timestamp FORMAT 'YYYY-MM-DD SSSSS.FF2');

select cast('11-10 036612019' as
    timestamp FORMAT 'MM-DD SSSSSYYYY');

select cast(cast('2019-01-01 01:01:01' as timestamp)
    as varchar format 'SSSSS');

select cast(cast('2019-01-01 23:59:59' as timestamp)
    as varchar format 'SSSSS');

select cast(cast('2019-11-03' as date) as varchar
    FORMAT 'D');

select cast(cast('2019-11-06' as date) as varchar
    FORMAT 'D');

select cast(cast('2019-11-09' as date) as varchar
    FORMAT 'D');

select cast(cast('2019-12-02' as date) as varchar
    FORMAT 'FXFMD');

select cast('2019-11-08 1' as
    timestamp FORMAT 'YYYY-MM-DD FF');

select cast('2019-11-08' as
    timestamp FORMAT 'YYYY-MM-DD FF');

select cast('2017-05-04 08 PM' as
    timestamp FORMAT 'YYYY-MM-DD HH12 PM');

select cast('2017-05-06 P.M.12' as
    timestamp FORMAT 'YYYY-MM-DD AMHH12');

select cast('2017-05-08 pm09' as
    timestamp FORMAT 'YYYY-MM-DD P.M.HH12');

select cast('2017-05-11 9.AM.10' as
    timestamp FORMAT 'YYYY-MM-DD HH12.P.M..MI');

select cast(cast('2019-01-01 00:15:10' as timestamp)
    as varchar format 'HH12 P.M.');

select cast(cast('2019-01-01 13:15:10' as timestamp)
    as varchar format 'HH12 a.m.');

select cast('2018-01-01 10:00 AM +15:59' as
    timestamp FORMAT 'YYYY-MM-DD HH12:MI A.M. TZH:TZM');

select cast('2018-12-31 08:00 AM 01:-59' as
    timestamp FORMAT 'YYYY-MM-DD HH12:MI A.M. TZH:TZM');

select cast('2018-12-31 08:00 AM-5:00' as
    timestamp FORMAT 'YYYY-MM-DD HH12:MI A.M.TZH:TZM');

select cast('2016-01-01 10:00 AM +16:00' as
    timestamp FORMAT 'YYYY-MM-DD HH12:MI A.M. TZH:TZM');

select cast('2016-01-01 10:00 AM 16:00' as
    timestamp FORMAT 'YYYY-MM-DD HH12:MI A.M. TZH:TZM');

select cast('2018-12-31 12:01 -1' as timestamp
    FORMAT 'YYYY-MM-DD HH24:MI TZH');

select cast('201812310800AM0515' as
    timestamp FORMAT 'YYYYMMDDHH12MIA.M.TZHTZM');

select cast('2018-01-01 10:00 AM +00:59' as
    timestamp FORMAT 'YYYY-MM-DD HH12:MI A.M. TZH:TZM');

select cast('2018-01-01 15 10:00 1 AM' as
    timestamp FORMAT 'YYYY-MM-DD TZM HH12:MI TZH A.M.');

select cast('2018-01-01 01:30' as timestamp
    FORMAT 'YYYY-MM-DD TZH:TZM');

select cast('2018-09-11 17:30:10 ab:10' as timestamp
    FORMAT 'YYYY-MM-DD HH24:MI:SS TZH:TZM');

select cast('2018-09-11 17:30:10 +ab:10' as timestamp
    FORMAT 'YYYY-MM-DD HH24:MI:SS TZH:TZM');

select cast('1985-11-19T01:02:03Z' as timestamp
    format 'YYYY-MM-DD"T"HH24:MI:SS"Z"');

select cast('19801985-11-20' as timestamp
    format '"1980"YYYY-MM-DD');

select cast('1985-11-22' as timestamp
    format 'YYYY-MM-DD""""""');

select cast('1985-12-10-' as date
    format 'FXYYYY-MM-DD-""');

select cast('1985-11-24Z01:02:03Z' as timestamp
    format 'YYYY-MM-DD"T"HH24:MI:SS"Z"');

select cast('1985-11-2401:02:05Z' as timestamp
    format 'YYYY-MM-DD"T"HH24:MI:SS"Z"');

select cast('1985-11-24 01:02:07te' as timestamp
    format 'YYYY-MM-DD HH24:MI:SS"text"');

select cast('1985-11text1text2-25' as timestamp
    format 'YYYY-MM"text1""text2"-DD');

select cast("1986-11'25" as date
    format "YYYY-MM\"'\"DD");

select cast("1986-10-'25" as timestamp
    format "FXYYYY-MM-\"'\"DD");

select cast("year: 1985, month: 11, day: 27" as date
    r''' format "\"year: \"YYYY\", month: \"MM\", day: \"DD")'';

select cast("1985 some 'text 11-29" as date
     format 'YYYY" some \'text "MM-DD');

select cast(cast("1985-11-30" as date) as varchar
    format "YYYY-\"text\"MM-DD");

select cast(cast("1985-12-01" as timestamp) as
    string format "YYYY-\"text1\"\"text2\"MM-DD");

select cast(cast("1985-12-02" as timestamp) as
    string format "YYYY-\" -'./,:\"MM-DD");

select cast(cast('1985-12-03' as timestamp) as
    string format 'YYYY-"some \"text"MM-DD');

select cast(cast("1985-12-04" as timestamp) as
    string format "YYYY-\"some \\\"text\"MM-DD");

select cast(cast("1985-12-06" as date) as varchar
    format 'YYYY-"some \ text"MM-DD');

select cast(cast("1985-12-08" as date) as varchar
    format 'YYYY-"\some text"MM-DD');

select cast(cast("1985-12-10" as date) as varchar
    format 'YYYY"\ttext\n"MM-DD');

select cast(cast("1985-12-12" as timestamp) as
    string format 'YYYY"\ttext\n"MM-DD');

select cast(cast("1985-12-14" as date) as varchar
    format 'YYYY"some\\text"MM-DD');

select cast("1985\\12\\14 01:12:10" as timestamp
    format 'YYYY"\\"MM"\\"DD HH12:MI:SS');

select cast(date'0001-01-01' as varchar format 'IYYY/IW/ID'),
           cast(date'9999-12-31' as varchar format 'IYYY/IW/ID');

select cast(cast('1400-01-01' as timestamp) as varchar format 'IYYY/IW/ID'),
           cast(cast('9999-12-31' as timestamp) as varchar format 'IYYY/IW/ID');

select cast('1400/01/02' as timestamp format 'IYYY/IW/ID'),
           cast('9999/52/06' as timestamp format 'IYYY/IW/ID'),
           cast('9999/53/01' as timestamp format 'IYYY/IW/ID');

select cast('2019/52/07' as date format 'IYYY/IW/ID'),
           cast('2020/01/01' as date format 'IYYY/IW/ID'),
           cast('2020/01/02' as date format 'IYYY/IW/ID'),
           cast('2020/01/03' as date format 'IYYY/IW/ID'),
           cast('2020/53/04' as date format 'IYYY/IW/ID'),
           cast('2020/53/05' as date format 'IYYY/IW/ID');

select cast('2020/01/03' as date format 'IYYY/IW/ID'),
           cast('020/01/03' as date format 'IYYY/IW/ID'),
           cast('20/01/03' as date format 'IYYY/IW/ID'),
           cast('0/01/03' as date format 'IYYY/IW/ID'),
           cast('020/01/03' as date format 'IYY/IW/ID'),
           cast('20/01/03' as date format 'IYY/IW/ID'),
           cast('0/01/03' as date format 'IYY/IW/ID'),
           cast('20/01/03' as date format 'IY/IW/ID'),
           cast('0/01/03' as date format 'IY/IW/ID'),
           cast('0/01/03' as date format 'I/IW/ID');

select cast('2020/53/4' as date format 'IYYY/IW/ID'),
           cast('2020/1/3' as date format 'IYYY/IW/ID');

select cast('2001-03-01 03:10:15.123456 -01:30' as
    timestamp format 'FXYYYY-MM-DD HH12:MI:SS.FF6 TZH:TZM');

select cast('2001-03-03 03:10:15' as timestamp format
    'FXYYYY-MM-DD HH12::MI:SS');

select cast('2001\'04-01' as timestamp format
     'FXYYYY\'MM-DD');

select cast('2001\'04-03' as timestamp format
     "FXYYYY'MM-DD");

select cast('2001-3-05' as timestamp format
    'FXYYYY-MM-DD');

select cast('15-03-07' as date format 'FXYY-MM-DD');

select cast('2001-03-08 03:15:00 AM' as timestamp
    format 'FXYYYY-MM-DD HH12:MI:SS P.M.');

select cast('2001-03-09 03:15:00.12345' as timestamp
    format 'FXYYYY-MM-DD HH12:MI:SS.FF4');

select cast('2015/3/05' as timestamp format 'FXIYYY/IW/ID'),
           cast('2015/03/5' as timestamp format 'FXIYYY/IW/ID'),
           cast('015/03/05' as timestamp format 'FXIYYY/IW/ID'),
           cast('15/03/05' as timestamp format 'FXIYYY/IW/ID'),
           cast('5/03/05' as timestamp format 'FXIYYY/IW/ID');

select cast('2001-03-09 some "text03:25:00'
    as timestamp format "FXYYYY-MM-DD \"some \\\"text\"HH12:MI:SS");

select cast('019-03-10 04:15:00' as timestamp
    format 'FXFMYYYY-MM-DD HH12:MI:SS');

select cast('2001-3-11 3:15:00.12345' as timestamp
    format 'FXYYYY-FMMM-DD FMHH12:MI:SS.FMFF');

select cast('2001-3-12 3:1:00.12345' as timestamp
    format 'FXYYYY-FMMM-DD FMHH12:MI:SS.FMFF');

select cast('1999-10-2' as timestamp format
    ''' 'FXYYYY-MMFM-DD');

select cast('2001-03-13 03:01:0' as timestamp
    format 'FXYYYY-MM-DD HH12:MI:SSFM');

select cast(date'0001-01-10' as varchar format 'FXIYYY-IW-ID'),
           cast(date'0001-10-10' as varchar format 'FXIYYY-IW-ID');

select cast(cast('0001-03-09' as date)
    as varchar format 'FMYYYY-FMMM-FMDD');

select cast(date'0001-01-10' as varchar format 'FMIYYY-FMIW-FMID'),
           cast(date'0001-10-10' as varchar format 'FMIYYY-FMIW-FMID');

select cast(cast('0001-04-09' as date)
    as varchar format 'FXYYYY-FMMM-FMDD');

select cast(date'0001-01-10' as varchar format 'FXFMIYYY-FMIW-FMID'),
           cast(date'0001-10-10' as varchar format 'FXFMIYYY-FMIW-FMID');

select cast(date'2001-01-01' as varchar
    FORMAT 'YYYY Q MM');

select cast(date'2001-4-1' as varchar
    FORMAT 'YYYY Q MM');

select cast(date'2001-7-1' as varchar
    FORMAT 'YYYY Q MM');

select cast(date'2001-10-1' as varchar
    FORMAT 'YYYY Q MM');

select CAST(1 AS SMALLINT) + CAST(2 AS SMALLINT) AS C;

values cast('1969-07-21 12:34:56' as timestamp);

values cast('1969-07-21' as date);

values cast('196907' as integer);

values cast('123.45' as decimal(5, 2));

values cast('false' as boolean);

values cast('TR' || 'UE' as boolean);

values cast('12.34e5678' as float);

values cast(' -5 ' as double);

select cast(5.5 as tinyint),
       cast(3.5 as tinyint),
       cast(1.6 as tinyint),
       cast(1.1 as tinyint),
       cast(1.0 as tinyint),
       cast(-1.0 as tinyint),
       cast(-1.1 as tinyint),
       cast(-1.6 as tinyint),
       cast(-2.5 as tinyint),
       cast(15.5 as tinyint)
from (values 0) as t(x);

select cast(5.5 as bigint),
       cast(3.5 as bigint),
       cast(1.6 as bigint),
       cast(1.1 as bigint),
       cast(1.0 as bigint),
       cast(-1.0 as bigint),
       cast(-1.1 as bigint),
       cast(-1.6 as bigint),
       cast(-2.5 as bigint),
       cast(15.5 as bigint)
from (values 0) as t(x);

select cast('5.5' as decimal(2, 0)),
       cast('3.5' as decimal(2, 0)),
       cast('1.6' as decimal(2, 0)),
       cast('1.1' as decimal(2, 0)),
       cast('1.0' as decimal(2, 0)),
       cast('-1.0' as decimal(2, 0)),
       cast('-1.1' as decimal(2, 0)),
       cast('-1.6' as decimal(2, 0)),
       cast('-2.5' as decimal(2, 0)),
       cast('15.5' as decimal(2, 0))
from (values 0) as t(x);

select cast(cast(5.55 as float) as decimal(2,1)),
       cast(cast(3.55 as float) as decimal(2,1)),
       cast(cast(1.66 as float) as decimal(2,1)),
       cast(cast(1.11 as float) as decimal(2,1)),
       cast(cast(1.00 as float) as decimal(2,1)),
       cast(cast(-1.00 as float) as decimal(2,1)),
       cast(cast(-1.11 as float) as decimal(2,1)),
       cast(cast(-1.66 as float) as decimal(2,1)),
       cast(cast(-2.55 as float) as decimal(2,1)),
       cast(cast(15.55 as float) as decimal(3,1))
from (values 0) as t(x);

select cast(cast(5.55 as double) as decimal(2,1)),
       cast(cast(3.55 as double) as decimal(2,1)),
       cast(cast(1.66 as double) as decimal(2,1)),
       cast(cast(1.11 as double) as decimal(2,1)),
       cast(cast(1.00 as double) as decimal(2,1)),
       cast(cast(-1.00 as double) as decimal(2,1)),
       cast(cast(-1.11 as double) as decimal(2,1)),
       cast(cast(-1.66 as double) as decimal(2,1)),
       cast(cast(-2.55 as double) as decimal(2,1)),
       cast(cast(15.55 as double) as decimal(3,1))
from (values 0) as t(x);

select cast(-1.0 as int) = -1 as value1,
       cast(-1.0 as int) = -2 as value2,
       cast(-1.1 as int) = -1 as value3,
       cast(-1.1 as int) = -2 as value4,
       cast(-1.6 as int) = -1 as value5,
       cast(-1.6 as int) = -2 as value6,
       cast(-2.5 as int) = -2 as value7,
       cast(-2.5 as int) = -3 as value8
from (values 0) as t(x);

values cast(0 as decimal(3,3));

values cast(15.3 as decimal(3,1));

values cast(15.6 as decimal(3,1));

values cast(' 15.3 ' as decimal(3,1));

values cast(' 15.66 ' as decimal(3,1));

values cast(15 as decimal(3,1));

values cast(cast(15.3 as double) as decimal(3,0));

values cast(cast(15.6 as double) as decimal(3,0));

values cast(cast(15.3 as float) as decimal(3,0));

values cast(cast(15.6 as float) as decimal(3,0));

values cast(cast(15.3 as real) as decimal(3,0));

values cast(cast(15.6 as real) as decimal(3,0));

select cast(deptno as integer) IS NOT NULL from "scott".dept;

select cast(mgr as integer) IS NOT NULL from "scott".emp;

select cast(comm as integer) IS NOT NULL from "scott".emp;

select cast(99999 as decimal(2, -3));

select cast(12340 as decimal(6, -1));

select cast(12340 as decimal(4, -1));

select cast(12340 as decimal(5, -3));

select cast(12340 as decimal(5, -6));

values cast(156.6 as decimal(3, -1));

values cast(' 156.6 ' as decimal(3, -1));

values cast(cast(156.3 as double) as decimal(3, -1));

values cast(cast(156.3 as float) as decimal(3, -1));

values cast(cast(156.3 as real) as decimal(3, -1));

select cast(-99499 as decimal(2, -3));

values cast(cast(156.6 as double) as decimal(3, -1));

VALUES (1, 2, 3),
  (CAST(5E0 AS REAL), 5E0, NULL);

WITH emp2 AS (SELECT CAST(sal AS DOUBLE) as x FROM emp)
SELECT COUNT(*) AS c
FROM emp2
WHERE x BETWEEN 2 AND 4
  OR x IN (1, 2, 4, 800);

SELECT CAST(CAST(ARRAY[CAST(1.1111 AS DECIMAL(2, 1)), CAST(3.06754 AS DECIMAL(2, 1))] AS SMALLINT ARRAY) as INTEGER ARRAY);

SELECT CAST(ARRAY[ARRAY[1, 2], ARRAY[3, 4]] AS INTEGER ARRAY ARRAY);

SELECT CAST(CAST(CAST(ARRAY[ARRAY[1.11, 2.22], ARRAY[3.33, 4.44]] AS DECIMAL ARRAY ARRAY) as INTEGER ARRAY ARRAY) as DECIMAL(2, 1) ARRAY ARRAY);

SELECT CAST(ARRAY[CAST(1.1111 AS DECIMAL(2, 1)), CAST(3.06754 AS DECIMAL(2, 1))] AS INTEGER MULTISET);

SELECT CAST(CAST(ARRAY[CAST(1.1111 AS DECIMAL(2, 1)), CAST(3.06754 AS DECIMAL(2, 1))] AS SMALLINT MULTISET) as INTEGER MULTISET);

SELECT CAST(CAST(ARRAY[CAST(1.1111 AS DECIMAL(2, 1)), CAST(3.06754 AS DECIMAL(2, 1))] AS INTEGER MULTISET) as DOUBLE MULTISET);

SELECT CAST(CAST(ARRAY[ARRAY[1.11, 2.22], ARRAY[3.33, 4.44]] AS DECIMAL ARRAY MULTISET) as INTEGER ARRAY MULTISET);

SELECT CAST(NULL AS DATE) UNION ALL SELECT TIMESTAMP '2025-07-04 10:00:00';

SELECT MAP[1, 2, 3, 4] UNION ALL SELECT NULL;

select cast(mod(deptno, 3) as BOOLEAN), mod(deptno, 3) from emp;

values (cast(array[null] as integer array));

values (cast(multiset[null] as integer multiset));

SELECT CAST(ROW(ROW(2, 'b'), 20) AS ROW(a ROW(x INTEGER, y CHAR(1)), b INTEGER)) AS r
FROM (VALUES (0)) AS t(zero);

SELECT ARRAY[ROW(ROW(1, 'a'), 10), NULL] AS xs
FROM (VALUES (0)) AS t(zero);

SELECT CAST(CAST(deptno AS DOUBLE) AS VARCHAR) AS d1,
  CAST(CAST(deptno AS DECIMAL(5, 2)) AS VARCHAR) AS d2,
  CAST(CAST(sal AS DECIMAL(10, 4)) AS VARCHAR) AS d3,
  CAST(CAST(deptno AS INTEGER) AS VARCHAR) AS d4
FROM emp
WHERE empno = 7369;

SELECT CAST(CAST(deptno AS VARCHAR) AS BIGINT) AS b1,
  CAST(CAST(deptno AS VARCHAR) AS DOUBLE) AS b2
FROM emp
WHERE empno = 7369;

SELECT CAST(CAST(CAST(deptno AS REAL) AS DOUBLE) AS BOOLEAN) AS b1,
  CAST(CAST(CAST(deptno - 20 AS REAL) AS DOUBLE) AS BOOLEAN) AS b2
FROM emp
WHERE empno = 7369;

SELECT CAST(CAST(CAST(deptno * 1000 AS DECIMAL(2, -3)) AS VARCHAR(3)) AS VARCHAR) AS n1
FROM emp
WHERE empno = 7369;

SELECT CASE WHEN true THEN ARRAY[1, 2] WHEN false THEN ARRAY[3] ELSE null END AS c;

WITH t(x) AS (VALUES(ROW(ROW(1)))) SELECT x NOT IN (x) AS e FROM t;

with tmp(a, b) as (
  values (1, 1), (1, 0), (1, cast(null as int))
       , (0, 1), (0, 0), (0, cast(null as int))
       , (cast(null as int), 1), (cast(null as int), 0), (cast(null as int), cast(null as int)))
select *
  from tmp
 where a = 1 or b = 1
 order by 1, 2;

with tmp(a, b) as (
  values (1, 1), (1, 0), (1, cast(null as int))
       , (0, 1), (0, 0), (0, cast(null as int))
       , (cast(null as int), 1), (cast(null as int), 0), (cast(null as int), cast(null as int)))
select *
  from tmp
 where a = 1 AND b = 1
 order by 1, 2;

select "value" from "nullables" a where "value" = 'A' or "value" = 'B' order by 1;

select "value" from "nullables" a where not (not ("value" = 'A' or "value" = 'B')) order by 1;

select "value" from "nullables" a where not ("value" = 'A' and "value" = 'B') order by 1;

select "value" from "nullables" a
 where case when not ("value" = 'A' or "value" = 'B') then 1 else 0 end = 1
 order by 1;

select "value" from "nullables" a
 where
   case when not ("value"='A' or "value"='B')
     then
       case when not /* <--diff from above */ ("value"='A' or "value"='B') then 1 else 2 end
     else 0
   end = 1 /* <- diff from above*/
 order by 1;

select "value" from "nullables" a
 where
   case when not ("value"='A' or "value"='B')
     then
       case when not ("value"='A' or "value"='B') then 1 else 2 end
     else 0
   end = 2 /* <- diff from above*/
 order by 1;

with ax(s) as (values (1),(0))
select case when s=0 then false else 100/s > 0 end from ax;

select *
from "scott".emp
where deptno > 5 AND deptno < 20 AND mgr IS NOT NULL;

select * from "scott".emp where deptno = 25 and deptno <> 20;

select empno
from emp as r
         left join dept as s on (select count(true) > 0 from emp)
where empno = 7369;

select r.empno, s.deptno
from emp as r
         left join dept as s on (select count(job) > 0 from bonus);

SELECT emp.empno
FROM emp
         LEFT JOIN (select *
                    from dept
                             LEFT JOIN (SELECT COUNT(*) > 0 AS "EXPR$0"
                                        FROM emp) AS "t0" ON TRUE) as "dt0*" ON "EXPR$0"
where emp.empno = 7902;

select *
from "scott".emp
where 5 < cast(deptno as integer) OR 5 >= cast(deptno as integer) OR deptno IS NULL;

SELECT 1 + 1 FROM DUAL;

SELECT * FROM DUAL;

select *
from (values (1), (2), (3), (4)) as t(x)
fetch next (1 + abs(-2)) rows only;

select *
from (values (1), (2), (3), (4)) as t(x)
fetch next (cast(9223372036854775808 as decimal(20, 0)) + 1) rows only;

select deptno, dname
from dept
order by deptno
fetch next (1 + 1) rows only;

select deptno
from dept
order by deptno
fetch next (abs(-3)) rows only;

select bit_count(8);

select bit_count('a');

select bit_count(null);

select bit_count(true);

select cbrt(-8);

SELECT ExtractValue('<a>c</a>', '//a');

SELECT CONCAT('a');

with t as (select concat('c', 'h', 'a', null, 'r') as c)
select c, c is null as c_is_null
from t;

select concat_ws(',', 'a', 'b', 'c');

select concat_ws(',', '', '', '');

with t as (select concat_ws('', '', '') as c)
select c, c is null as c_is_null
from t;

with t as (select concat_ws(cast(null as varchar), 'a', 'b') as c)
select c, c is null as c_is_null
from t;

select convert('abcd', latin1, utf8);

select convert(cast("employee_id" as varchar), utf8, latin1) as alia
from "employee"
limit 3;

SELECT EXTRACT(DAY FROM DATE '2013-12-25') AS the_day;

SELECT EXTRACT(YEAR FROM INTERVAL -34 MONTHS) as extr;

SELECT EXTRACT(MONTH FROM INTERVAL -14 MONTHS) as extr;

SELECT EXTRACT(SECOND FROM INTERVAL '-1 2:3:4.567' DAY TO SECOND) as extr;

select cosh(1);

select sinh(1);

select concat('a', null);

select concat(cast(null as varchar), 'a');

select convert('abcd', utf8);

SELECT XMLTRANSFORM(
                   '<?xml version="1.0"?>
                    <Article>
                      <Title>My Article</Title>
                      <Authors>
                        <Author>Mr. Foo</Author>
                        <Author>Mr. Bar</Author>
                      </Authors>
                      <Body>This is my article text.</Body>
                    </Article>'
                   ,
                   '<?xml version="1.0"?><xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
                      <xsl:output method="text"/><xsl:template match="/">Article - <xsl:value-of select="/Article/Title"/>Authors: <xsl:apply-templates select="/Article/Authors/Author"/>
                      </xsl:template>
                      <xsl:template match="Author">- <xsl:value-of select="." /></xsl:template>
                    </xsl:stylesheet>'
                   );

SELECT EXISTSNODE(
            '<Article><Title>Article1</Title><Authors><Author>Foo</Author><Author>Bar</Author></Authors><Body>article text</Body></Article>'
            , '/Article/Title'
        );

select CONVERT(INTEGER, 45.4);

select CONVERT(FLOAT, '34.5');

select CONVERT(DATE, '2011-01-05', 999);

select CONVERT(INTEGER, NULL, NULL);

select concat_ws(',', 'a', 'b');

select concat_ws(cast(null as varchar), 'a', cast(null as varchar), 'b');

with t as (select concat(null, '') as c)
select c, c is null as c_is_null
from t;

select concat('a', null, 'b');

select concat(cast(null as varchar), 'a', 'b');

select replace('ciAao', 'a', 'ciao');

select translate('abcd' using utf8);

select translate(cast("employee_id" as varchar) using latin1) as alia
from "employee"
limit 3;

select convert('abcd' using utf8);

select replace('ciao', '', 'ciao');

with t as (select replace(null, 'ciao', 'ci') as c)
select c, c is null as c_is_null
from t;

with t as (select replace('ciao', 'ci', cast(null as varchar)) as c)
select c, c is null as c_is_null
from t;

select convert(cast("employee_id" as varchar) using latin1) as alia
from "employee"
limit 3;

select t1, t1."i", t2, v
from
table(AUX.TBLFUN_IDENTITY(1)) as t1,
table(AUX.TBLFUN_IDENTITY(2)) as t2,
table(AUX.TBLFUN_IDENTITY(3)) as t3(v);

SELECT SUBSTRING(x'123456' FROM 2 FOR 2147483647) AS c;

SELECT SUBSTRING(x'123456' FROM 2 FOR 2147483645) AS c;

SELECT SUBSTR(x'123456', 2, 2147483647) AS c;

SELECT '[' || SUBSTRING(v FROM s FOR l) || ']' AS c
FROM (VALUES ('abc', CAST(-3 AS BIGINT), CAST(2 AS BIGINT))) AS t(v, s, l);

SELECT SUBSTRING('abc' FROM CAST(-3000000000 AS BIGINT) FOR CAST(3000000002 AS BIGINT)) AS c;

SELECT SUBSTRING(x'123456' FROM CAST(-3 AS BIGINT) FOR 5) AS c;

SELECT SUBSTRING(x'123456' FROM CAST(-3000000000 AS BIGINT) FOR CAST(3000000002 AS BIGINT)) AS c;

with t1 (id1, col11, col12) as (values (1, 11, 111), (2, 12, 122), (3, 13, 133), (4, 14, 144), (5, 15, 155)),
t2 (id2, col21, col22) as (values (1, 21, 211), (2, 22, 222), (3, 23, 233), (4, 24, 244), (5, 25, 255)),
t3 (id3, col31, col32) as (values (1, 31, 311), (2, 32, 322), (3, 33, 333), (4, 34, 344), (5, 35, 355))
select * from t1, t2, t3 where id1 = id2 and id1 = id3 and
(
(col11 > 11 and col31 <= 32)
or
(col22 < 255 and col32 >= 344)
);

select i, i * 10 as j
from (values 1, 2, 3, 4) as t (i)
where i <> 2
order by i;

select t.i, u.y
from (values (1, 'a'), (2, 'b'), (3, 'c')) as t (i, x)
join (values (1, 'p'), (3, 'q')) as u (j, y) on t.i = u.j
order by t.i;

select i from (
  values 1, 1, 1, 2, 2, 3 except all values 1 except all values 1, 2
) as t (i)
order by i;

select i from (
  values 1, 1, 2, 2, 3 intersect all values 1, 2, 2, 3, 3
  intersect all values 1, 2, 3, 3
) as t (i)
order by i;

select g.deptno, g.total_sal, d.dname
from (select deptno, sum(sal) as total_sal
              from emp group by deptno) g
join dept d on g.deptno = d.deptno
where d.dname = 'RESEARCH';

with t (i) as (values (0), (1))
select *
from t as t1
   cross join t as t2,
 t as t3
   cross join t as t4
where t1.i + t2.i + t3.i + t4.i = 1;

with t (i) as (values (0), (1))
select *
from t as t1,
 t as t2
   cross join t as t3
where t1.i + t2.i + t3.i = 1;

with s (c0) as (values 'a', 'b'),
  t (x) as (values 1, 2),
  u (y) as (values 10, 20)
select s.c0, t.x, u.y
from s, t right join u on t.x = u.y;

with s (c0) as (values 'a', 'b'),
  t (x) as (values 1, 2),
  u (y) as (values 10, 20)
select s.c0, t.x, u.y
from s, t full join u on t.x = u.y;

select *
from emp
join dept
on emp.deptno = dept.deptno or emp.ename = dept.dname;

select
   "product_class"."product_family" as "c0",
   "product_class"."product_department" as "c1",
   "customer"."country" as "c2",
   "customer"."state_province" as "c3",
   "customer"."city" as "c4"
from
   "sales_fact_1997" as "sales_fact_1997"
join ("product" as "product"
     join "product_class" as "product_class"
     on "product"."product_class_id" = "product_class"."product_class_id")
on  "sales_fact_1997"."product_id" = "product"."product_id"
join "customer" as "customer"
on  "sales_fact_1997"."customer_id" = "customer"."customer_id"
join "promotion" as "promotion"
on "sales_fact_1997"."promotion_id" = "promotion"."promotion_id"
where ("promotion"."media_type" = 'Radio'
 or "promotion"."media_type" = 'TV'
 or "promotion"."media_type" = 'Sunday Paper'
 or "promotion"."media_type" = 'Street Handout')
 and ("product_class"."product_family" = 'Drink')
 and ("customer"."country" = 'USA'
   and "customer"."state_province" = 'WA'
   and "customer"."city" = 'Bellingham')
group by "product_class"."product_family",
   "product_class"."product_department",
   "customer"."country",
   "customer"."state_province",
   "customer"."city"
order by "product_class"."product_family" asc nulls first,
   "product_class"."product_department" asc nulls first,
   "customer"."country" asc nulls first,
   "customer"."state_province" asc nulls first,
   "customer"."city" asc nulls first;

with clerk as (select * from emp where job = 'CLERK')
select e.ename, d.dname, c.ename
from dept as d
 natural left join emp as e
 left join clerk as c using (empno);

select d.dname, b.ename, b.job, e.job, e.ename
from dept as d
cross join (bonus as b
  cross join emp as e);

select e.ename, d.dname
from emp as e
natural join (table dept) as d;

select *
from (select * from emp where deptno <> 10) as e
full join (select * from dept where deptno <> 20) as d
  using (deptno);

select ename
from emp
join dept using (deptno)
order by deptno, ename;

select deptno, dname
from emp
full join dept using (deptno)
order by deptno, ename;

select distinct dept.deptno
from "scott".emp join "scott".dept using (deptno);

select distinct emp1.deptno, emp3.ename
from "scott".emp emp1 join "scott".emp emp2 on (emp1.deptno = emp2.deptno)
join "scott".emp emp3 on (emp1.deptno + emp2.deptno = emp3.deptno + 10);

select *
from (values (100, 'Bill', 1),
             (200, 'Eric', 1),
             (150, 'Sebastian', 3)) as e(empid, name, deptno)
join (values (1, 'LeaderShip'),
             (2, 'TestGroup'),
             (3, 'Development')) as d(deptno, name)
using (deptno);

select 2 as two, * from emp natural join dept;

select empno as two, * from emp natural join dept;

select e.empno, e.ename, c.ono from emp e
left join (select 7934 as ono, current_timestamp as t) c on e.empno = c.ono;

select e.empno, e.ename, c.ono from emp e inner join (select 7934 as ono, current_timestamp as t) c on e.empno=c.ono;

select e.empno, e.ename, c.ono from emp e
left join (select 7934 as ono, current_timestamp as t) c on e.empno = c.ono
left join (select 7566 as ono, current_timestamp as t) c1 on c.ono = c1.ono;

SELECT *
FROM (VALUES (2, 3), (4, 6), (6, 9)) AS t1(a, b)
JOIN (VALUES (2, 5), (6, 15)) AS t2(a, c) USING (a)
JOIN (VALUES (2, 7), (4, 14), (6, 21), (8, 28)) AS t3(a, d) USING (a);

SELECT f.k + 1 AS x
FROM (VALUES (CAST(2147483647 AS INTEGER))) AS d(k)
JOIN (VALUES (CAST(2147483647 AS BIGINT))) AS f(k) USING (k);

SELECT t1.a
FROM (VALUES (1), (2)) AS t1(a)
JOIN (VALUES (1), (null)) AS t2(a)
ON t1.a IS DISTINCT FROM t2.a;

SELECT t1.a
FROM (VALUES (1), (2), (null)) AS t1(a)
JOIN (VALUES (1), (null)) AS t2(a)
ON t1.a IS NOT DISTINCT FROM t2.a;

SELECT t1.a
FROM (VALUES (true), (false), (null)) AS t1(a)
JOIN (VALUES (true), (null)) AS t2(a)
ON t1.a IS NOT DISTINCT FROM t2.a;

SELECT t1.a
FROM (VALUES (TIMESTAMP '2025-05-10 10:22:34'), (TIMESTAMP '2025-05-11 10:22:34'), (null)) AS t1(a)
JOIN (VALUES (TIMESTAMP '2025-05-10 10:22:34'), (null)) AS t2(a)
ON t1.a IS NOT DISTINCT FROM t2.a;

SELECT t1.a
FROM (VALUES (ARRAY[1.0, 1.0]), (ARRAY[2.0, 2.0]), (CAST(NULL AS DOUBLE ARRAY))) AS t1(a)
JOIN (VALUES (ARRAY[1.0, 1.0]), (CAST(NULL AS DOUBLE ARRAY))) AS t2(a)
ON t1.a IS NOT DISTINCT FROM t2.a;

SELECT t1.a, t1.b
FROM (VALUES (ROW('k1', 1.0)), (ROW('k2', 2.0)), (ROW(NULL, NULL)) ) AS t1(a, b)
JOIN (VALUES (ROW('k1', 1.0)), (ROW(NULL, NULL)) ) AS t2(a, b)
ON t1.a IS NOT DISTINCT FROM t2.a;

select *
from (select 1 id) t1
left join (select 2 id) t2
on not exists(select *
               from (select 3 id) p
               where p.id = t2.id);

select *
from (select 1 id) t1
left join (select 2 id) t2
on t1.id = t2.id or exists(select *
                           from (select 3 id) p
                           where p.id = t2.id);

SELECT "t"."EMPNO", "EMP0"."EMPNO" AS "EMPNO0"
FROM (SELECT "EMPNO"
FROM "scott"."EMP") AS "t"
INNER JOIN "scott"."EMP" AS "EMP0" ON "t"."EMPNO" = "EMP0"."EMPNO"
WHERE EXISTS (SELECT 1
FROM (SELECT "t1"."EMPNO", "EMP2"."EMPNO" AS "EMPNO0"
FROM (SELECT "EMPNO"
FROM "scott"."EMP") AS "t1"
INNER JOIN "scott"."EMP" AS "EMP2" ON "t1"."EMPNO" = "EMP2"."EMPNO") AS "t2"
WHERE "t"."EMPNO" = "t2"."EMPNO" AND "t"."EMPNO" > "t2"."EMPNO");

SELECT * FROM (VALUES (NULLIF(5, 5)), (NULLIF(5, 5))) a, (VALUES (NULLIF(5, 5)), (NULLIF(5, 5))) b;

select "EXISTS"(array(1,2,3), x -> x = 4);

select "EXISTS"(array(1,2,3), x -> power(x, 2) = 9);

select "EXISTS"(array(1,2,3), x -> cast(null as boolean));

select "EXISTS"(array[array[1, 2], array[3, 4]], x -> x[1] = 1);

select "EXISTS"(array(ROW(1, 2)), x -> x."EXPR$1" > 1);

select (select "EXISTS"(t.arr, x -> x."EXPR$0"."EXPR$0"."EXPR$1" = 2) from (values (0)))
from (select array(ROW(ROW(ROW(1, 2), 3), 4)) as arr) as t;

select "EXISTS"(array(select ROW(ROW(1, 2), 3) from (values (0))),
    x -> x."EXPR$0"."EXPR$1" = 2);

select "EXISTS"(a.arr, x -> x."EXPR$0"."EXPR$1" = 2) as e,
    cardinality(a.arr) as c,
    a.arr[1]."EXPR$0"."EXPR$1" as v
from (select array(ROW(ROW(1, 2), 3)) as arr) as a;

select "EXISTS"(array(1, 2, 3), x -> "EXISTS"(array(1, 2, 3), y -> x + y = 4));

select "EXISTS"(array(1, 2), x -> x = t.r."EXPR$0") from (select ROW(1, 2) as r) as t;

select (select count(*) from (values (array[1, 2])) as s(b)
        where "EXISTS"(s.b, e -> e = t.x)) as c
from (values (1)) as t(x);

select t.x,
  (select "EXISTS"(s.b, e -> e = t.x) from (values (array[1, 5])) as s(b)) as c
from (values (1), (7)) as t(x);

select t.x,
  (select count(*) from (values (array[1, 2])) as s(b)
   where "EXISTS"(s.b, e -> "EXISTS"(array[3], f -> e + f = t.x))) as c
from (values (4), (6)) as t(x);

select t.x
from (values (1), (7)) as t(x)
where exists (select 1 from (values (array[1, 5])) as s(b)
              where "EXISTS"(s.b, e -> e = t.x));

select *
from (values (1), (5)) as b(v),
  lateral (select "EXISTS"(array[1, 2], e -> e = b.v) as r
           from (values (0)) as z(z));

select k2, "EXISTS"(array[1, 2], e -> e = k2) as r
from (values (0, 1), (0, 1), (0, 3)) as t(k1, k2)
group by k2;

select k2,
  "EXISTS"(array[array[1], array[4]], a -> "EXISTS"(a, e -> e = k2)) as r
from (values (0, 1, 5), (0, 3, 2)) as t(k1, k2, k3)
group by k2, k3;

select k2, k3, "EXISTS"(array[2], e -> e = k3) as r
from (values (0, 1, 5), (0, 3, 2)) as t(k1, k2, k3)
group by rollup(k2, k3);

select x as e from (values (1, array[1]), (3, array[2])) as t(x, a)
order by "EXISTS"(a, e -> e = 2) desc, "EXISTS"(array[1, 2], e -> e = 1);

select x,
  "EXISTS"(array[row_number() over (order by x)], e -> e * 100 = z) as r
from (values (1, 100), (2, 300), (3, 300)) as t(x, z);

select x, "EXISTS"(array[1, 2], e -> e = rn) as r
from (select x, row_number() over (order by x) as rn
      from (values (1), (3), (2)) as t(x)) as s;

select * from lateral (select * from "scott".emp) where deptno = 10;

select * from (table "scott".emp) where deptno = 10;

select *
from "scott".dept,
  lateral (select * from "scott".emp where emp.deptno = dept.deptno) as e;

with dept (deptno, dname)
    as (values (10, 'ACCOUNTING'), (20, 'RESEARCH')),
  emp (empno, deptno, ename)
    as (values (7369, 20, 'SMITH'), (7782, 10, 'CLARK'), (7499, 30, 'ALLEN'))
select *
from dept,
  lateral (select * from emp where emp.deptno = dept.deptno) as emp;

with dept (deptno, dname)
    as (values (10, 'ACCOUNTING'), (20,'RESEARCH')),
  emp (empno, deptno, ename)
    as (values (7369, 20, 'SMITH'), (7782, 10, 'CLARK'), (7499, 30, 'ALLEN'))
select dept.deptno, emp.ename, v.v
from dept,
  (values ('A'), ('M')) as v (v)
  left join lateral (select * from emp
    where emp.deptno = dept.deptno
    and position(v.v in emp.ename) > 0) as emp on true;

with dept (deptno, dname)
    as (values (10, 'ACCOUNTING'), (20,'RESEARCH')),
  emp (empno, deptno, ename)
    as (values (7369, 20, 'SMITH'), (7782, 10, 'CLARK'), (7499, 30, 'ALLEN'))
select dept.deptno, emp.ename, v.v
from dept,
  (values ('A'), ('M')) as v (v)
  cross join lateral (select * from emp
    where emp.deptno = dept.deptno
    and position(v.v in emp.ename) > 0
    and position(v.v in emp.ename) < 4) as emp;

with t (x, ys)
  as (values (1, array [2,3]), (4, array [5]))
select *
from t,
  lateral unnest(t.ys) as y;

select t.dd, t.x
from dept d,
lateral (select d.deptno as dd, u.x
         from unnest(array[d.deptno + 100]) as u(x)) as t
where d.dname = 'SALES';

select d.deptno, t.x
from (select deptno,
        case when deptno = 10 then array[deptno, deptno + 1] end as path
      from dept) as d,
lateral (select * from unnest(coalesce(d.path, array[cast(null as integer)])) as u(x)) as t
order by d.deptno, t.x;

select d.deptno, t.s
from dept as d
cross join lateral (select sum(e.sal) as s from emp as e where e.deptno = d.deptno limit 1) as t;

select d.deptno, t.s, t.x
from dept as d
left join lateral (
  select a.s, b.x
  from (values (1)) as b(x)
  join (select sum(e.sal) as s from emp as e where e.deptno = d.deptno) as a on true) as t on true
order by d.deptno;

select d.deptno, t.x, t.s
from dept as d
cross join lateral (
  select b.x, a.s
  from (values (1)) as b(x)
  left join (select sum(e.sal) as s from emp as e where e.deptno = d.deptno) as a on true) as t
order by d.deptno;

select d.deptno, t.x, t.c
from dept as d
cross join lateral (
  select b.x, a.c
  from (values (1)) as b(x)
  left join (select count(*) as c from emp as e where e.deptno = d.deptno) as a on true) as t
order by d.deptno;

select d.deptno, t.s, t.x
from dept as d
cross join lateral (
  select a.s, b.x
  from (select sum(e.sal) as s from emp as e where e.deptno = d.deptno) as a
  full join (values (1)) as b(x) on a.s > 9000) as t
order by d.deptno, t.s, t.x;

SELECT MAP[1, 2, 3, 4] = MAP[1, 2, 3, 4] AS eq;

SELECT MAP['a', 1, 'b', 2] = MAP['b', 2, 'a', 1] AS eq;

SELECT MAP[1, 2, 3, 4] = MAP[1, 2, 3, 5] AS eq;

SELECT MAP[1, 2, 3, 4] = MAP[1, 2] AS eq;

SELECT MAP[1, 2, 3, 4] IS DISTINCT FROM MAP[3, 4, 1, 2] AS x;

SELECT MAP[1, NULL, 3, 4] = MAP[3, 4, 1, NULL] AS eq;

SELECT ARRAY[MAP[1, 2, 3, 4]] = ARRAY[MAP[3, 4, 1, 2]] AS eq;

SELECT MAP[1, MAP[1, 2, 3, 4], 2, MAP[5, 6]] = MAP[2, MAP[5, 6], 1, MAP[3, 4, 1, 2]] AS eq;

SELECT COUNT(*) AS c FROM (VALUES 1) WHERE MAP[1, 2, 3, 4] = MAP[3, 4, 1, 2];

SELECT COUNT(*) AS c
FROM (SELECT DISTINCT m FROM (VALUES MAP[1, 2, 3, 4], MAP[3, 4, 1, 2]) AS t(m));

SELECT COUNT(*) AS c
FROM (VALUES MAP[1, 2, 3, 4]) AS l(m)
JOIN (VALUES MAP[3, 4, 1, 2]) AS r(m) ON l.m = r.m;

SELECT *
FROM "scott".emp MATCH_RECOGNIZE(
  ORDER BY hiredate
  MEASURES 1 AS m1
  PATTERN (s up)
  DEFINE up AS up.deptno < prev(up.deptno));

select *
from "hr"."emps" match_recognize (
    order by "empid" desc
    measures "commission" as c,
    "empid" as empid
    pattern (s up)
    define up as up."commission" < prev(up."commission"));

select *
from "hr"."emps" match_recognize (
    order by "empid" desc
    measures "commission" as c,
    LAST("empid") as empid
    pattern (s up)
    define up as up."commission" < prev(up."commission"));

select *
from "hr"."emps" match_recognize (
    order by "empid" desc
    measures "commission" as c,
    CLASSIFIER() as cl,
    LAST(S."empid") as empid
    pattern (s up)
    define up as up."commission" < prev(up."commission"));

select *
from "hr"."emps" as "A" match_recognize (
    order by "empid" desc
    measures "commission" as c
    pattern ("A" up)
    define up as "commission" < prev("commission"));

SELECT *
FROM ticker
   MATCH_RECOGNIZE (
     PARTITION BY symbol
     ORDER BY tstamp
     MEASURES  STRT.tstamp AS start_tstamp,
               LAST(DOWN.tstamp) AS bottom_tstamp,
               LAST(UP.tstamp) AS end_tstamp
     ONE ROW PER MATCH
     AFTER MATCH SKIP TO LAST UP
     PATTERN (STRT DOWN+ UP+)
     DEFINE
        DOWN AS DOWN.price < PREV(DOWN.price),
        UP AS UP.price > PREV(UP.price)
     ) MR
     ORDER BY MR.symbol, MR.start_tstamp;

CREATE VIEW "Orders" AS
SELECT * FROM (VALUES
 ('Happy', 'Alice', DATE '2023-11-28', 6, 4),
 ('Acme', 'Bob', DATE '2023-11-27', 5, 2),
 ('Happy', 'Alice', DATE '2024-11-28', 7, 4),
 ('Whizz', 'Celia', DATE '2023-11-25', 3, 1),
 ('Happy', 'Bob', DATE '2022-11-27', 4, 1))
  AS t ("prodName", "custName", "orderDate", "revenue", "cost");

CREATE VIEW "SummarizedOrders" AS
  SELECT "prodName", "orderDate",
    CAST(SUM("revenue") - SUM("cost") AS DECIMAL(4,2)) / SUM("revenue")
      AS "profitMargin"
  FROM "Orders"
  GROUP BY "prodName", "orderDate";

SELECT *
FROM "SummarizedOrders";

SELECT "prodName",
  CAST(SUM("revenue") - SUM("cost") AS DECIMAL(4,2)) / SUM("revenue")
    AS "profitMargin"
FROM "Orders"
GROUP BY "prodName";

SELECT "custName",
  CAST(SUM("revenue") - SUM("cost") AS DECIMAL(4,2)) / SUM("revenue")
    AS "profitMargin"
FROM "Orders"
GROUP BY "custName";

SELECT "prodName", AGGREGATE("profitMargin")
FROM "EnhancedOrders"
GROUP BY "prodName";

SELECT "prodName",
  (SELECT
      CAST(SUM(i."revenue") - SUM(i."cost") AS DECIMAL(4, 2)) / SUM(i."revenue")
    FROM "Orders" AS i
    WHERE i."prodName" = o."prodName") AS "profitMargin",
  COUNT(*) AS "count"
FROM "Orders" AS o
GROUP BY "prodName";

SELECT "prodName", "sumRevenue",
  "sumRevenue" / "sumRevenue" AT (ALL "prodName")
    AS "proportionOfTotalRevenue"
FROM (SELECT *,
    SUM("revenue") AS MEASURE "sumRevenue"
  FROM Orders) AS o
GROUP BY "prodName";

SELECT o."prodName",
  COUNT(*) AS "c",
  AGGREGATE(o."sumRevenue") AS "rAgg",
  o."sumRevenue" AT (VISIBLE) AS "rViz",
  o."sumRevenue" AS r
FROM (SELECT *,
    SUM("revenue") AS MEASURE "sumRevenue"
  FROM "Orders") AS o
WHERE o."custName" <> 'Bob'
GROUP BY ROLLUP(o."prodName");

WITH "EnhancedCustomers" AS (
  SELECT *, AVG("age") AS MEASURE "avgAge"
  FROM "Customers")
SELECT o."prodName",
  AVG(c."age") AS "weightedAvgAge",
  c."avgAge" AS "avgAge"
FROM "Orders" AS o
JOIN "EnhancedCustomers" AS c USING ("custName")
GROUP BY o."prodName";

CREATE VIEW "OrdersWithRevenue" AS
  SELECT *, SUM("revenue") AS MEASURE "sumRevenue"
  FROM "Orders";

SELECT o.prodName, YEAR(o."orderDate") AS orderYear,
    computeSumRevenue(
      r -> r."prodName" = o."prodName" AND
           YEAR(r."orderDate") = YEAR(o."orderDate"))
  / computeSumRevenue (
      r -> r."prodName" = o."prodName" AND
           YEAR(r."orderDate") = YEAR(o."orderDate") - 1)
  AS "ratio"
FROM "Orders" AS o
GROUP BY "prodName", YEAR("orderDate");

SELECT o."prodName", o."orderDate"
FROM "Orders" AS o
LEFT JOIN
  (SELECT "prodName", AVG("revenue") AS "avgRevenue"
    FROM "Orders"
    GROUP BY "prodName") AS o2
ON o."prodName" = o2."prodName"
WHERE o."revenue" > o2."avgRevenue";

SELECT o."prodName", o."orderDate"
FROM
  (SELECT "prodName", "orderDate", "revenue",
      AVG("revenue") AS MEASURE "avgRevenue"
    FROM "Orders") AS o
    WHERE o."revenue" >
      o."avgRevenue" AT (WHERE "prodName" = o."prodName");

create view empm as
select *, avg(sal) as measure avg_sal
from emp;

select job, avg_sal as a
from (
  select *, avg(sal) as measure avg_sal
  from "scott".emp
) as empm
group by job;

with empm as (
  select *, min(empno) as measure avg_sal
  from emp
)
select deptno, avg_sal as a
from empm
group by deptno;

with empm as (
  select deptno, job, avg(sal) as measure avg_sal
  from emp)
select job, aggregate(avg_sal) as a
from empm
group by job;

select AGGREGATE(avg_sal) as a
from empm;

WITH empm AS (
    SELECT *, AVG(empno) AS MEASURE avg_empno
    FROM emp)
SELECT job, avg_empno
FROM empm
GROUP BY job;

with emp2 as (
  select *, 2 as measure two
  from emp
)
select job, two
from emp2
group by job;

select avg_sal as a, deptno
from empm;

select avg_sal as a, ename, deptno
from empm
order by ename limit 3;

select avg_sal, deptno
from empm
order by avg_sal desc limit 3;

select *
from (
  select deptno,
      empno + 1 as measure e1,
      e1 + deptno as measure e2
  from "scott".emp
  where job = 'CLERK');

select e.empno + 1 as deptno,
    deptno + e.deptno as measure d,
    deptno + e.deptno as d2
from "scott".emp as e
where job = 'CLERK';

select deptno, aggregate(count_plus_100) as count_plus_100
from (
  select empno, deptno, job,
      count(*) + 100 as measure count_plus_100
  from "scott".emp)
group by deptno;

select empno, count_plus_100
from (
  select empno, deptno, job,
      count(*) + 100 as measure count_plus_100
  from "scott".emp)
order by 1;

select deptno, cdj1
from (
  select empno, deptno, job,
      count(distinct job) + 1 as measure cdj1
  from "scott".emp)
group by deptno;

select deptno,
    count(*) as c,
    avg(sal) as avg_sal,
    count(*) filter (where job in ('ANALYST', 'SALESMAN')) as c1,
    avg(sal) filter (where job in ('ANALYST', 'SALESMAN')) as avg_sal1
from "scott".emp
group by deptno;

select job,
    c,
    aggregate(avg_sal) as avg_sal,
    aggregate(c) filter (where deptno = 20) as c2,
    aggregate(avg_sal) filter (where deptno = 20) as avg_sal2
from (
  select *, count(*) as measure c, avg(sal) as measure avg_sal
  from "scott".emp
  where job <> 'PRESIDENT')
where deptno < 25
group by job;

create view emp1 as
select empno, ename, job, sal,
    case when job = 'ANALYST' then null else deptno end as deptno
from emp;

select ename, deptno,
    count(*) over (partition by deptno) as c
from emp1 as e1;

with empm as (
  select *, avg(sal) as measure avg_sal
  from emp)
select deptno, avg_sal
from empm
group by rollup(deptno);

with deptm as (
  select *,
      sum(deptno) as measure sum_deptno
  from dept)
select *
from deptm as d
join emp as e using (deptno);

with deptm as (
  select *,
      sum(deptno) as measure sum_deptno
  from dept)
select e.ename, d.dname, d.sum_deptno, count(*) as c
from deptm as d
left join emp as e using (deptno)
group by deptno;

SELECT TIME '10:00:00' + CAST('1' AS INTERVAL SECOND);

SELECT TIME '10:00:00' + CAST('1' AS INTERVAL MINUTE);

SELECT CAST('123e4567-e89b-12d3-a456-426655440000' AS UUID);

SELECT CAST('{123e4567-e89b-12d3-a456-426655440000}' AS UUID);

SELECT CAST(UUID '123e4567-e89b-12d3-a456-426655440000' AS VARCHAR);

SELECT CAST(x'123e4567e89b12d3a456426655440000' AS UUID);

SELECT UUID '123e4567-e89b-12d3-a456-426655440000'
     = CAST('123e4567-e89b-12d3-a456-426655440000' AS CHAR(36)) AS C;

SELECT UUID '123e4567-e89b-12d3-a456-426655440000'
     IN ('123e4567-e89b-12d3-a456-426655440000',
         '123E4567-E89B-12D3-A456-426655440001') AS C;

SELECT u = f AS EQ_FULL, u = g AS EQ_UPPER, u = b AS EQ_BINARY
FROM (VALUES (CAST('123e4567-e89b-12d3-a456-426655440000' AS UUID),
              '123e4567-e89b-12d3-a456-426655440000',
              '123E4567-E89B-12D3-A456-426655440000',
              x'123e4567e89b12d3a456426655440000'),
             (CAST(NULL AS UUID),
              '123e4567-e89b-12d3-a456-426655440000',
              '123E4567-E89B-12D3-A456-426655440000',
              x'123e4567e89b12d3a456426655440000'))
  AS t(u, f, g, b);

WITH t(u) AS (VALUES (CAST('123e4567-e89b-12d3-a456-426655440000' AS UUID)),
                     (CAST(NULL AS UUID)))
SELECT CAST(u AS VARBINARY) AS B, u = u AS SELF FROM t;

WITH t(u) AS (VALUES (CAST('123e4567-e89b-12d3-a456-426655440000' AS UUID)),
                     (CAST('123e4567-e89b-12d3-a456-426655440001' AS UUID)))
SELECT t1.u FROM t AS t1 JOIN t AS t2 ON t1.u = t2.u ORDER BY 1;

SELECT x'123e4567e89b12d3a456426655440000' = UUID '123e4567-e89b-12d3-a456-426655440000' AS C;

SELECT CAST(NULL AS UUID);

SELECT ROW('1') > ROW(0) AS C;

select "hr"."emps"."empid"
from "hr"."emps";

select distinct "hr"."emps"."empid" + 1 as e
from "hr"."emps"
group by "hr"."emps"."empid";

SELECT 1 IS NOT DISTINCT FROM NULL;

select *, upper("name")
from "hr"."emps";

select count(distinct "salary") as c
from "hr"."emps"
join "hr"."depts" on "emps"."deptno" = "depts"."deptno"
having count(1) > 0;

select e."deptno", d."deptno"
from "hr"."emps" as e
join "hr"."depts" as d
on ( d."deptno" + 2 - 2 = e."deptno" + 1 - 1  and d."deptno" + 20 - 20 = e."deptno" + 10 - 10);

select e."empid", d."name", e."name"
from "hr"."emps" as e
join "hr"."depts" as d
on e."deptno" = d."deptno"
and e."name" <> d."name";

select "deptno" from "hr"."depts"
where exists (select 1 from "hr"."emps");

select "deptno" from "hr"."depts"
where exists (select 1 from "hr"."emps" where "empid" < 0);

select * from (values (10)) as t(x)
where exists (select 1 from "hr"."emps");

select "deptno" from "hr"."depts"
where exists (select 1 from (values (1)) as t(x));

select * from "hr"."emps"
where exists (
  select 1 from "hr"."depts" where "depts"."deptno" = "emps"."deptno");

select * from "hr"."emps"
where not exists (
  select 1 from "hr"."depts" where "depts"."deptno" = "emps"."deptno")
or not exists (
  select 1 from "hr"."depts" where "depts"."deptno" + 90 = "emps"."empid");

select * from (
  select * from "hr"."emps" as e
  where e."deptno" < 30) as e
where e."deptno" > 10 or e."name" = 'Sebastian';

select 1 from "hr"."emps";

select count(*) as c from "everyTypes" where "sqlDate" = DATE '1970-01-01';

select count(*) as c from "everyTypes" where "sqlDate" > DATE '1970-01-01';

select count(*) as c from "everyTypes" where "sqlTimestamp" = TIMESTAMP '1970-01-01 01:23:45';

select period("sqlDate", INTERVAL '1' YEAR) as p
from "everyTypes";

select *
from "sales_fact_1997" as s
  join "customer" as c on s."customer_id" = c."customer_id"
  join "product" as p on s."product_id" = p."product_id"
where c."city" = 'San Francisco';

select * from (
  select * from "days"
  where "day" = 1)
where "day" = 1;

with src (key, "value")
  as (select * from (values (1, 'a'), (2, 'z')) as t(key, "value"))
select b.key, count(*) as c
from src b
group by b.key
having exists
  (select a.key
  from src a
  where a.key = b.key and a."value" > 'val_9');

SELECT a, b
FROM (
  WITH sub AS (SELECT 1 AS a, 2 AS b)
  SELECT * FROM sub)
WHERE a IS NOT NULL;

select 1 as a, 2 as a from (values (true));

select case when a=1 then 1 else 2 end
from "days" t1(a,x) join "days" t2(b,x) on a=b
group by case when a=1 then 1 else 2 end;

SELECT MAX("day") as m, COUNT(T."week_day") AS c
FROM "days" T
GROUP BY T."week_day"
HAVING COUNT(T."week_day") = 1;

select distinct gender from emp group by gender, deptno;

select distinct gender, deptno from emp group by gender, deptno, ename;

select distinct gender, deptno from emp group by gender, ename, deptno;

select gender, sum(deptno) as s from emp group by gender, deptno;

select distinct gender, sum(deptno) as s from emp group by gender, ename;

select distinct gender, sum(deptno) as s from emp group by gender, deptno, ename;

create view v as
  select * from (values (1, 'a'), (2, 'b')) as t (x, y);

select distinct deptno, job
from "scott".emp
order by substring(job from 2 for 1), -deptno;

select count(*) as c from "scott".emp group by deptno
union
select count(*) as c from "scott".emp group by deptno;

select count(*) as c from "scott".emp where empno > null;

select * from "scott".emp where '1981-01-02' > hiredate;

select * from "scott".emp where hiredate > '1986-01-02';

select * from "scott".emp where '1986-' || '01-02' < hiredate;

select * from "scott".emp where empno in ('7369', '7876');

select * from "scott".emp where '7369' between empno and '7876';

SELECT a FROM (VALUES (0, 0)) AS T(A, "*");

SELECT "." FROM (VALUES (1, 2, 3, 4)) AS T("a", "A", ".", "*");

SELECT * FROM (VALUES (1, 2, 3, 4)) AS T("a", "A", ".", "*");

select deptno, row (empno, deptno) as r
from "scott".emp;

select deptno, collect(r) as empnos
from (select deptno, (empno, deptno) as r
  from "scott".emp)
group by deptno;

select empno, mgr, date '1970-01-01' + interval empno day as d,
  timestamp '1970-01-01 00:00:00' + interval (mgr / 100) minute as ts
from "scott".emp
order by empno;

select 8388608/(60+27.39);

select 2 + 2 as a, 'b' as b;

select distinct 2 as a, 'b' as b
order by 2;

select deptno, deptno from "scott".emp
union
select deptno, deptno from "scott".dept;

select * from (
  select 2 as a, 3 as b)
where a < b;

select count(*) as c from "scott".dept where exists (select 1);

select deptno from "scott".emp
intersect distinct
select deptno from "scott".dept;

select job, comm from "scott".emp where mgr = 7698
intersect
select job, comm from "scott".emp where deptno = 10;

select (case when (true) then 1 end) from (values(1));

select i, rand_integer(-1, 5) as r
from (values 1, 2, 3, 4, 5) as t(i);

select i, rand(-1) as r
from (values 1, 2, 3, 4, 5) as t(i);

values pi();

select * from "scott".emp where not (ename not in ('Fred'));

select count(*) as c from "scott".emp where deptno > deptno;

select
  TIMESTAMP '2016-02-26 19:06:00.12345678',
  CAST('2016-02-26 19:06:00.12345678' as TIMESTAMP),
  TIMESTAMPDIFF(SECOND,
    TIMESTAMP '2016-02-26 19:06:00.123456789',
    CAST('2016-02-26 19:06:00.123456789' as TIMESTAMP));

select array[1,2] as a from (values (1));

values array['a',null,'bcd'],
  array['efgh'];

select "sqlTimestamp" as T
from "everyTypes"
where "sqlTimestamp" >= {ts '1969-01-01 00:00:00'}
and "sqlTimestamp" < {ts '1998-01-01 00:00:00'};

select *
from "scott".emp
WHERE hiredate = '1980-12-17';

SELECT DISTINCT T.B
FROM (VALUES (1, 'X'),(2, 'Y'),(3, 'X'),(4, 'X')) AS T(A, B);

values power(0.5, 2);

values ((date '1999-12-01', date '2001-12-31') overlaps (date '2001-01-01' , date '2002-11-11'));

values ((date '2001-12-31', date '1999-12-01') overlaps (date '2002-11-11', date '2001-01-01'));

select mycol['b'] as x
from (select map['a', false, 'b', true] from (values (2))) as t(mycol);

with data(c_date, c_timestamp) as (select * from (values
    (DATE'1965-01-10', TIMESTAMP '1965-01-10 20:20:20'),
    (DATE'2019-01-01', TIMESTAMP '2019-01-01 18:19:20'),
    (DATE'2019-02-20', TIMESTAMP '2019-02-20 00:00:00'),
    (DATE'2019-02-28', TIMESTAMP '2019-02-28 03:04:05'),
    (DATE'2019-03-02', TIMESTAMP '2019-03-02 15:10:05'),
    (DATE'2019-06-28', TIMESTAMP '2019-06-28 17:32:01'),
    (DATE'2019-12-12', TIMESTAMP '2019-12-12 12:12:01')))
select last_day(c_date), last_day(c_timestamp) from data;

SELECT CASE WHEN "Z" < 77 AND "Z" > 0 THEN 99 ELSE 88 END
FROM (
  SELECT SUM("X") / NULLIF(SUM(0),0) AS Z
  FROM (VALUES (1.1, 2.5), (4.51, 32.5)) A(X, Y)
  GROUP BY "Y");

SELECT
  CASE WHEN A=0 THEN (B+C+D)*1.0
  WHEN B=0 THEN 1.0/A+(C+D)*1.0
  WHEN C=0 THEN 1.0/A+1.0/B+D*1.0
  WHEN D=0 THEN 1.0/A+1.0/B+1.0/C
  ELSE 1.0/A+1.0/B+1.0/C+1.0/D
  END AS V
FROM (VALUES (0, 2, 4, 8),
   (1, 0, 4, 8),
   (1, 2, 0, 8),
   (1, 2, 4, 0),
   (0, 0, 0, 0),
   (1, 2, 4, 8),
   (CAST(null as int), CAST(null as int), CAST(null as int), CAST(null as int))) AS T(A,B,C,D) order by V;

SELECT TIMESTAMP '1969-07-20' + i AS ts
FROM (VALUES (INTERVAL '1' DAY)) AS t (i)
GROUP BY TIMESTAMP '1969-07-20 00:00:00' + i;

select decimal'12.3' + 5.6;

SELECT
  map['foo', null],
  map[null, 'foo'],
  map[1, 'foo', 2, null],
  map[1, null, 2, 'foo'];

select empno as x, x as y from emp;

select empno as x, x+1 as y from emp
group by x, y;

select empno as x, x+1 as y from emp
group by x, y
having x > 7800;

WITH t0(t0a, t0b) AS (VALUES (1, 1), (2, 0)),
     t1(t1a, t1b, t1c) AS (VALUES (1, 1, 3)),
     t2(t2a, t2b, t2c) AS (VALUES (1, 1, 5), (2, 2, 7))
SELECT * FROM t0 WHERE t0a <
(SELECT sum(t1c) FROM
  (SELECT t1c
   FROM   t1 JOIN t2 ON (t1a < t0a AND t2b >= t1b))
);

INSERT INTO emps (empid, deptno, name, salary, commission) VALUES
(100, 10, 'Bill', 10000.00, 1000),
(200, 20, 'Eric', 8000.00, 500),
(150, 10, 'Sebastian', 7000.00, NULL),
(110, 10, 'Theodore', 11500.00, 250),
(170, 30, 'Theodore', 11500.00, 250),
(140, 10, 'Sebastian', 7000.00, NULL);

SELECT dname, (SELECT emp.comm FROM "scott".emp WHERE dept.deptno = emp.deptno ORDER BY emp.comm LIMIT 1) FROM "scott".dept;

select empno, deptno in (select 10) from emp;

WITH tb as (select array(SELECT * FROM (VALUES (TRUE), (NULL)) as x(a)) as a)
SELECT TRUE IN (SELECT b FROM UNNEST(a) AS x1(b)) AS test FROM tb;

select 1 in (values(null), (null));

SELECT dept.deptno, (
  SELECT max(emp.empno)
  FROM emp
  WHERE empno = (SELECT max(empno) AS maxDept
                 FROM emp e2
                 WHERE e2.deptno = dept.deptno)
        AND emp.deptno = dept.deptno),
  dept.dname
FROM dept;

SELECT e.ename, e.job, e.sal
FROM emp e
WHERE EXISTS (
    SELECT 1
    FROM (
        SELECT * FROM bonus b WHERE b.ename = e.ename
    ) foo
    RIGHT JOIN dept d
    ON foo.job = d.loc
);

SELECT E.EMPNO
FROM EMP E
JOIN DEPT D ON E.DEPTNO = D.DEPTNO
WHERE E.EMPNO > 10 AND D.DEPTNO = (
    SELECT MIN(D_INNER.DEPTNO)
    FROM DEPT D_INNER
    WHERE D_INNER.DEPTNO = E.DEPTNO);

SELECT e1.empno
FROM emp e1, dept d1
where e1.deptno = d1.deptno
and e1.deptno < 10 and d1.deptno < 15
and e1.sal > (select avg(sal) from emp e2 where e1.empno = e2.empno)
order by e1.empno;

SELECT empno, (SELECT row_number() OVER (PARTITION BY dname ORDER BY emp.sal) FROM dept WHERE dept.deptno = emp.deptno) as rn FROM emp;

select *
from (values (1), (2), (3), (4)) as t(x)
offset 1 + abs(-1) rows;

select *
from (values (1), (2), (3), (4)) as t(x)
offset cast(9223372036854775808 as decimal(20, 0)) + 1 rows;

select *
from (values (1), (2), (3)) as t(x)
offset 1 + 1 rows;

select deptno, dname
from dept
order by deptno
offset 1 + 1 rows
fetch next (1 + 1) rows only;

select deptno
from dept
order by deptno
offset 2 - 2 rows;

select * from "scott".emp where not sal > 1300;

select count(*) as c from "scott".emp where not not ename = 'SMITH';

SELECT CAST(empno AS BIGINT) ^ CAST(deptno AS BIGINT) AS foo FROM "scott".emp LIMIT 5;

SELECT CAST(deptno AS INTEGER) << CAST(comm AS INTEGER) AS foo FROM "scott".emp
WHERE comm IS NOT NULL LIMIT 4;

SELECT COALESCE(DATE '2021-07-08', DATE '2020-01-01') as d;

values multiset ['a', 'c', 'a'] multiset except all multiset ['a'];

values multiset ['a', 'c', 'b'] multiset union multiset ['a'];

values multiset ['a', 'c', 'b'] multiset union distinct multiset ['a'];

values multiset ['a', 'c', 'a', 'a'] multiset intersect all multiset ['a', 'a'];

select v,
  case when b then 'ceil' else 'floor' end as op,
  case when b then ceil(v to year) else floor(v to year) end as y,
  case when b then ceil(v to quarter) else floor(v to quarter) end as q,
  case when b then ceil(v to month) else floor(v to month) end as m,
  case when b then ceil(v to week) else floor(v to week) end as w,
  case when b then ceil(v to day) else floor(v to day) end as d
from (values (date '2019-07-05')) as t(v),
 (values false, true) as u(b)
order by 1,2;

select v,
  case when b then 'ceil' else 'floor' end as op,
  case when b then ceil(v to year) else floor(v to year) end as y,
  case when b then ceil(v to quarter) else floor(v to quarter) end as q,
  case when b then ceil(v to month) else floor(v to month) end as m,
  case when b then ceil(v to week) else floor(v to week) end as w,
  case when b then ceil(v to day) else floor(v to day) end as d,
  case when b then ceil(v to hour) else floor(v to hour) end as h,
  case when b then ceil(v to minute) else floor(v to minute) end as mi,
  case when b then ceil(v to second) else floor(v to second) end as s
from (values (time '12:34:56.7')) as t(v),
  (values false, true) as u(b)
order by 1,2;

select "T"."X"[CAST(2 AS BIGINT)] as x2 from (VALUES (ROW(ROW(3, 7), ROW(4, 8)))) as T(x, y);

select "T"."Y"[CAST(2 AS SMALLINT)] as y2 from (VALUES (ROW(ROW(3, 7), ROW(4, 8)))) as T(x, y);

select au."birthPlace"[2] as city from "bookstore"."authors" au;

select array[1, 2] < array[1, 2] as foo;

select array[1, 2] < array[1] as foo;

select array[1, 2] < array[1, null] as foo;

select array[1, 2] <= array[2, 3] as foo;

select array[1] <= array[1, 2] as foo;

select array[1, 2] > array[1, 2] as foo;

select array[1, 2] > array[1] as foo;

select array[1, 2] > array[1, null] as foo;

select array[1, 2] >= array[2, 3] as foo;

select array[1] >= array[1, 2] as foo;

select array[array[1, 2]] < array[array[2, 3]] as foo;

select array[array[1, 2], array[3, 4]] < array[array[1, 2], array[5, 6]] as foo;

select row(array[1, 2], array[3, 4]) < row(array[1, 2], array[5, 6]) as foo;

SELECT 0 ^ 0 AS foo;

SELECT 5 ^ 2 AS foo;

-- Bitwise LEFT SHIFT operator `<<`
SELECT
  1 << 0 AS shift1,
  1 << 1 AS shift2,
  2 << 2 AS shift3,
  4 << 3 AS shift4,
  CAST(2 AS SMALLINT) << CAST(3 AS INTEGER) AS cast_shift;

select floor(x) = interval '3' hour as f,
  ceil(x) = interval '4' hour as c
from (values (interval '3:4:5' hour to second)) as t(x);

select floor(interval '2' hour + interval '90' minute) = interval '3' hour as fa,
  ceil(interval '2' hour + interval '90' minute) = interval '4' hour as ca;

select * from emp;

select * from emp join dept on emp.deptno = dept.deptno and emp.gender = 'F';

select * from (select * from emp where gender ='F') as emp join dept on emp.deptno = dept.deptno;

select * from emp left join dept on emp.deptno = dept.deptno where emp.gender = 'F';

select * from emp right join dept on emp.deptno = dept.deptno and emp.gender = 'F';

select * from (select * from emp where gender ='F') as emp right join dept on emp.deptno = dept.deptno;

select * from emp full join dept on emp.deptno = dept.deptno where emp.gender = 'F';

select * from (select * from emp where gender ='F') as emp full join dept on emp.deptno - dept.deptno = 0;

with t1(x) as (select * from (values 1, 2, cast(null as integer))),
  t2(x) as (select * from (values 1, cast(null as integer)))
select t1.x from t1 left join t2 on t1.x = t2.x;

with t1(x, y) as (select * from (values (1, 10), (2, 20), (cast(null as integer), 30)) as t),
  t2(x, y) as (select * from (values (1, 100), (cast(null as integer), 200)) as t)
select * from t1 left join t2 on t1.x = t2.x;

select * from "scott".emp right join "scott".dept on sal < 100;

from emp |> where deptno = 10;

select ename from (from emp |> where deptno = 10) where sal > 1500;

select ename, deptno as dno from emp order by sal + 1 desc, empno
|> where exists (select 1 from dept as d where d.deptno = dno and d.loc = 'DALLAS');

select ename, dname from (
from emp as e join dept as d on e.deptno = d.deptno
|> where d.deptno = 10 |> where e.sal > 2000);

SELECT *
FROM   (SELECT deptno, job, sal
        FROM   emp)
PIVOT  (SUM(sal) AS sum_sal, COUNT(*) AS "COUNT"
        FOR (job) IN ('CLERK', 'MANAGER' mgr, 'ANALYST' AS "a"))
ORDER BY deptno;

SELECT *
FROM (SELECT job, deptno FROM emp)
PIVOT (COUNT(*) AS "COUNT" FOR deptno IN (10, 50, 20));

SELECT job, SUM("10_COUNT") AS sum10, SUM("20_COUNT" + "50_COUNT") AS sum20
FROM (SELECT job, deptno FROM emp)
PIVOT (COUNT(*) AS "COUNT" FOR deptno IN (10, 50, 20)) AS e
WHERE e.job <> 'MANAGER'
GROUP BY job;

SELECT mgr,
  SUM(sal) FILTER (WHERE job = 'CLERK' AND deptno = 20) AS c20_ss,
  COUNT(*) FILTER (WHERE job = 'CLERK' AND deptno = 20) AS c20_c,
  SUM(sal) FILTER (WHERE job = 'MANAGER' AND deptno = 10) AS m10_ss,
  COUNT(*) FILTER (WHERE job = 'MANAGER' AND deptno = 10) AS m10_c
FROM emp
GROUP BY mgr
ORDER BY 1 NULLS FIRST;

SELECT *
FROM (SELECT deptno, mgr FROM   emp)
PIVOT (COUNT(*) AS c FOR mgr IN (7839, null, 7698))
ORDER BY deptno;

SELECT *
FROM (select hiredate, sal from emp)
PIVOT (SUM(sal) FOR hiredate IN ('1981-12-03', '1981-11-17'));

SELECT "20"
FROM (SELECT deptno, sal FROM emp)
PIVOT (SUM(sal) FOR (deptno) IN (10, 10, 20));

SELECT a_c, a_b_b_c
FROM (SELECT sal, deptno FROM emp)
PIVOT (SUM(sal) AS b_c, COUNT(*) AS c FOR deptno IN (10 as a, 20 as a_b));

SELECT "10_SUM_EMPNO"
FROM (SELECT sal, empno, deptno FROM emp)
PIVOT (SUM(sal), COUNT(*), SUM(empno) AS sum_empno FOR deptno IN (10, 20));

SELECT *
FROM (
 SELECT deptno, job, sal,
   CASE WHEN ename < 'F' THEN 'F' ELSE 'M' END AS gender
 FROM emp)
PIVOT (sum(sal) AS ss, count(*) AS c
     FOR (job, deptno) IN (('CLERK', 10) AS C10,
                           ('CLERK', 20) AS C20,
                           ('ANALYST', 20) AS A20));

SELECT *
FROM (
  SELECT *
  FROM (
     SELECT deptno, job, sal,
       CASE WHEN ename < 'F' THEN 'F' ELSE 'M' END AS gender
     FROM emp)
  PIVOT (sum(sal) AS ss, count(*) AS c
         FOR (job, deptno)
         IN (('CLERK', 10) AS C10,
             ('CLERK', 20) AS C20,
             ('ANALYST', 20) AS A20)))
UNPIVOT (
  (sum_sal, count_star)
  FOR (job, deptno)
  IN ((c10_ss, c10_c) AS ('CLERK', 10),
      (c20_ss, c20_c) AS ('CLERK', 20),
      (a20_ss, a20_c) AS ('ANALYST', 20)));

SELECT e.gender, t.*
FROM (
  SELECT *
  FROM (
    SELECT deptno, job, sal,
        CASE WHEN ename < 'F' THEN 'F' ELSE 'M' END AS gender
    FROM emp)
  PIVOT (sum(sal) AS ss, count(*) AS c
     FOR (job, deptno) IN (('CLERK', 10) AS C10,
                           ('CLERK', 20) AS C20,
                           ('ANALYST', 20) AS A20))) AS e
CROSS JOIN LATERAL (VALUES
   ('CLERK', 10, e.c10_ss, e.c10_c),
   ('CLERK', 20, e.c20_ss, e.c20_c),
   ('ANALYST', 20, e.a20_ss, e.a20_c)) AS t (job, deptno, sum_sal, count_star);

SELECT *
FROM (
  SELECT *
  FROM (
     SELECT deptno, job, sal,
       CASE WHEN ename < 'F' THEN 'F' ELSE 'M' END AS gender
     FROM emp)
  PIVOT (sum(sal) AS ss, count(*) AS c
         FOR (job, deptno)
         IN (('CLERK', 10) AS C10,
             ('CLERK', 20) AS C20,
             ('ANALYST', 20) AS A20)))
UNPIVOT (
  (sum_sal)
  FOR (job, deptno)
  IN ((c10_ss) AS ('CLERK', 10),
      (c20_ss) AS ('CLERK', 20),
      (c20_ss) AS ('CLERK', 20),
      (c10_ss) AS ('ANALYST', 20)));

SELECT *
FROM emp
UNPIVOT INCLUDE NULLS (remuneration
  FOR remuneration_type IN (comm, sal));

SELECT deptno,
  SUM(remuneration) AS r,
  SUM(remuneration) FILTER (WHERE job = 'CLERK') AS cr
FROM emp
UNPIVOT INCLUDE NULLS (remuneration
  FOR remuneration_type IN (comm, sal))
GROUP BY deptno
HAVING COUNT(*) > 6
ORDER BY deptno;

SELECT *
FROM (
  SELECT *
  FROM (VALUES (0, 1, 2, 3, 4),
               (10, 11, 12, 13, 14))
          AS t (c0, c1, c2, c3, c4))
UNPIVOT ((m0, m1, m2)
    FOR (a0, a1)
     IN ((c1, c2, c3) as ('col1','col2'),
         (c2, c3, c4)));

select min(deptno), max(deptno) from emp;

CREATE TABLE D(sk_cid INT, dt DATE, dm_sym VARCHAR, fhd DATE);

CREATE TABLE S(sk_sid INT, sym VARCHAR);

create table t_empty (id int);

select a from (values (1.0), (2.0), (3.0), (4.0), (5.0)) as t1 (a)
intersect
select a from (values (1), (2)) as t2 (a)
intersect
select a from (values (1.0), (4.0), (null)) as t3 (a);

select
 sum(sal) filter(where deptno = 10) as sum_match,
 count(distinct deptno) filter(where job = 'CLERK') as count_distinct_match,
 count(*) filter(where deptno = 40) as count_star_match
 from emp;

select d.deptno, empno from "scott"."DEPT" d
right join "scott"."EMP" e using (deptno) limit 10 offset 2;

select * from (select * from "scott".emp) e left join (
  select * from "scott".dept d) using (deptno)
order by empno limit 3 offset 1;

select l.id as left_id, r.id as right_id
from (values (1), (3), (5)) as l(id)
right join (values (0), (4), (6)) as r(id) on l.id > r.id
where l.id is null
order by r.id;

SELECT empno, ename, deptno
FROM "scott".emp
QUALIFY ROW_NUMBER() over (partition by ename order by deptno) = 1;

SELECT empno, ename, deptno, ROW_NUMBER() over (partition by ename order by deptno) as row_num
FROM "scott".emp
QUALIFY row_num = 1;

WITH t0 AS (SELECT deptno, sal FROM emp),
t1 AS (SELECT deptno
    FROM t0
    QUALIFY row_number() OVER (PARTITION BY deptno
                               ORDER BY sal DESC) = 1)
SELECT deptno FROM t1;

WITH RECURSIVE FactorialCTE(n, a) AS (
    SELECT 1, 1
    UNION ALL
    SELECT n + 1, a * (n + 1)
    FROM FactorialCTE
    WHERE n < 11
)
SELECT a FROM FactorialCTE WHERE n = 10;

WITH RECURSIVE CumulativeSumCTE(n, a) AS (
    SELECT 1, 10
    UNION ALL
    SELECT n + 1, a + (n + 1)
    FROM CumulativeSumCTE
    WHERE n < 20
)
SELECT a FROM CumulativeSumCTE;

with RECURSIVE files(id,name, parent_id) as (
    select * from (values
    (1, 'Root', NULL),
    (2, 'Folder 1', 1),
    (3, 'File 1', 2),
    (4, 'Folder 2', 1),
    (5, 'File 2', 4))
),
FileSystemCTE(id, name, parent_id) AS (
    SELECT id, name, parent_id
    FROM files
    WHERE parent_id IS NULL
    UNION ALL
    SELECT f.id, f.name, f.parent_id
    FROM files f
    JOIN FileSystemCTE c ON f.parent_id = c.id
)
SELECT id, name FROM FileSystemCTE;

with RECURSIVE hierarchy(id, name, parent_id) as (
    select * from (values
    (1, 'Root', NULL),
    (2, 'Node 1', 1),
    (3, 'Node 2', 1),
    (4, 'Node 1.1', 2),
    (5, 'Node 1.2', 2))
),
AncestorsCTE(id, name, parent_id) AS (
    SELECT id, name, parent_id
    FROM hierarchy
    WHERE id = 5
    UNION ALL
    SELECT h.id, h.name, h.parent_id
    FROM hierarchy h
    JOIN AncestorsCTE a ON h.id = a.parent_id
)
SELECT id, name FROM AncestorsCTE WHERE id <> 5;

with RECURSIVE graph(source_node, target_node) as (
    select * from (values
    ('A', 'B'),
    ('B', 'C'),
    ('B', 'D'),
    ('C', 'E')) as foo
),
PathCTE(node, path) AS (
    SELECT source_node, cast(source_node as varchar)
    FROM graph
    WHERE source_node = 'A'
    UNION ALL
    SELECT g.target_node, cast(path || ',' || g.target_node as varchar)
    FROM graph g
    JOIN PathCTE p ON g.source_node = p.node
),
CTE(node, path) as (
    SELECT node, path from PathCTE
    UNION ALL
    SELECT node, path from PathCTE
)
SELECT * FROM CTE WHERE node = 'D';

WITH RECURSIVE aux(i) AS
  (
   VALUES (0)
   UNION SELECT MOD((i+1), 10)
   FROM aux
   WHERE i < 10 )
SELECT *
FROM aux;

WITH RECURSIVE delta(n, fact) AS
  (
   VALUES (0,
           1)
   UNION ALL SELECT n+1,
                    (n+1)*fact
   FROM delta
   WHERE n < 7 )
SELECT *
FROM delta;

WITH RECURSIVE aux(i) AS
  (WITH RECURSIVE aux1(i) AS
     (
      VALUES (1)
      UNION ALL SELECT i+1
      FROM aux1
      WHERE i < 11 ) SELECT *
   FROM aux1)
SELECT *
FROM aux;

WITH RECURSIVE graph(src, dst) AS (
    VALUES ('A', 'B'), ('B', 'C'), ('C', 'A'), ('B', 'D')
),
walk(node) AS (
    VALUES ('A')
    UNION ALL
    SELECT g.dst FROM walk w JOIN graph g ON g.src = w.node
)
CYCLE node SET is_cycle TO 'Y' DEFAULT 'N' USING cycle_path
SELECT node, is_cycle, cycle_path FROM walk
ORDER BY CARDINALITY(cycle_path), node;

WITH RECURSIVE t(n) AS (
    VALUES (1), (1)
    UNION DISTINCT
    SELECT n FROM t
)
CYCLE n SET is_cycle USING cycle_path
SELECT n, is_cycle, cycle_path FROM t
ORDER BY CARDINALITY(cycle_path);

WITH RECURSIVE edges(src, dst) AS (
    VALUES (0, 2), (0, 1), (1, 4), (2, 3)
),
walk(node) AS (
    VALUES (0)
    UNION ALL
    SELECT e.dst FROM walk w JOIN edges e ON e.src = w.node
)
SEARCH DEPTH FIRST BY node SET seq
SELECT * FROM walk ORDER BY seq;

WITH RECURSIVE t(n, k, depth) AS (
    VALUES (0, 0, 0)
    UNION ALL
    SELECT v.n, v.k, t.depth + 1
    FROM t CROSS JOIN (VALUES (1, 2), (2, 1), (1, 1)) AS v(n, k)
    WHERE t.depth < 1
)
SEARCH DEPTH FIRST BY k, n SET seq
SELECT n, k, seq FROM t ORDER BY seq;

WITH RECURSIVE "Walk"("Node") AS (
    VALUES (1)
    UNION ALL
    SELECT "Node" + 1 FROM "Walk" WHERE "Node" < 3
)
SEARCH DEPTH FIRST BY "Node" SET "Sequence",
u AS (SELECT * FROM "Walk")
SELECT "Node" FROM u ORDER BY "Sequence";

WITH RECURSIVE t(n) AS (
    VALUES (2), (1), (1)
    UNION DISTINCT
    SELECT n + 2 FROM t WHERE n < 3
)
SEARCH BREADTH FIRST BY n SET seq
SELECT * FROM t ORDER BY seq;

WITH RECURSIVE edges(src, dst) AS (
    VALUES (0, 1), (0, 1), (1, 2), (1, 2)
),
walk(node) AS (
    VALUES (0)
    UNION DISTINCT
    SELECT e.dst FROM walk w JOIN edges e ON e.src = w.node
)
SEARCH BREADTH FIRST BY node SET seq
SELECT * FROM walk ORDER BY seq;

WITH RECURSIVE edges(src, dst) AS (
    VALUES (0, 1), (1, 3), (0, 3)
),
walk(node) AS (
    VALUES (0)
    UNION DISTINCT
    SELECT e.dst FROM walk w JOIN edges e ON e.src = w.node
)
SEARCH BREADTH FIRST BY node SET seq
SELECT * FROM walk ORDER BY seq;

WITH RECURSIVE t(n) AS (
    SELECT n FROM (VALUES (1)) AS v(n) WHERE FALSE
    UNION ALL
    SELECT n + 1 FROM t WHERE n < 3
)
SEARCH BREADTH FIRST BY n SET seq
SELECT n FROM t ORDER BY seq;

SELECT r, COUNT(*) AS c
FROM (SELECT ROW(x, y) AS r
      FROM (VALUES (1, 'a'), (2, NULL), (2, NULL)) AS v(x, y)) AS t
GROUP BY r
ORDER BY c;

SELECT DISTINCT r
FROM (SELECT ROW(x, y) AS r
      FROM (VALUES (1, 'a'), (1, 'a'), (2, NULL), (2, NULL)) AS v(x, y)) AS t
ORDER BY r;

SELECT ROW(x, y) AS r
FROM (VALUES (1, 'a'), (2, 'b')) AS v(x, y)
INTERSECT
SELECT ROW(x, y) AS r
FROM (VALUES (2, 'b'), (3, 'c')) AS w(x, y);

WITH t(x, r) AS (
  SELECT x, ROW(x, y)
  FROM (VALUES (1, 'a'), (2, 'b')) AS v(x, y))
SELECT t1.x AS x1, t2.x AS x2
FROM t AS t1
JOIN t AS t2 ON t1.r = t2.r
ORDER BY x1;

WITH t(x, r) AS (
  SELECT x, ROW(x, y)
  FROM (VALUES (1, 'a'), (2, NULL)) AS v(x, y))
SELECT t1.x AS x1, t2.x AS x2
FROM t AS t1
JOIN t AS t2 ON t1.r = t2.r
ORDER BY x1;

WITH t(x, r) AS (
  SELECT x, ROW(x, y)
  FROM (VALUES (1, 'a'), (2, NULL)) AS v(x, y))
SELECT t1.x AS x1, t2.x AS x2
FROM t AS t1
JOIN t AS t2 ON t1.r IS NOT DISTINCT FROM t2.r
ORDER BY x1;

WITH t(id, a, b) AS (
  SELECT id, ROW(x, y), ROW(z, w)
  FROM (VALUES (1, 1, 'a', 1, 'a'),
               (2, 1, NULL, 1, NULL),
               (3, 1, NULL, 2, NULL),
               (4, 1, 'a', 2, 'b')) AS v(id, x, y, z, w))
SELECT id, a = b AS eq, a <> b AS ne, a IS DISTINCT FROM b AS dist
FROM t
ORDER BY id;

SELECT ROW(1, CAST(NULL AS VARCHAR))
     = ROW(1, CAST(NULL AS VARCHAR)) AS flat,
       ROW(ROW(1, CAST(NULL AS VARCHAR)), 2)
     = ROW(ROW(1, CAST(NULL AS VARCHAR)), 2) AS nested2,
       ROW(ROW(ROW(1, CAST(NULL AS VARCHAR)), 2), 3)
     = ROW(ROW(ROW(1, CAST(NULL AS VARCHAR)), 2), 3) AS nested3;

WITH t(id, a, b) AS (
  SELECT id, ROW(ROW(ROW(x, y), x), x), ROW(ROW(ROW(z, w), z), z)
  FROM (VALUES (1, 1, 'a', 1, 'a'),
               (2, 1, NULL, 1, NULL),
               (3, 1, NULL, 2, NULL)) AS v(id, x, y, z, w))
SELECT id, a = b AS eq, a IS DISTINCT FROM b AS dist,
       a IS NOT DISTINCT FROM b AS ndf
FROM t
ORDER BY id;

SELECT COUNT(*) AS n FROM (
  SELECT r FROM (
    SELECT ROW(ROW(x, y), x) AS r
    FROM (VALUES (1, 'a'), (2, NULL)) AS v(x, y)
    UNION ALL
    SELECT ROW(ROW(x, y), x) AS r
    FROM (VALUES (1, 'a'), (2, NULL)) AS w(x, y)) AS u
  GROUP BY r) AS g;

WITH t(id, r) AS (
  SELECT id, ROW(ROW(x, y), x)
  FROM (VALUES (1, 1, 'a'), (2, 1, NULL)) AS v(id, x, y))
SELECT id,
       EXISTS (SELECT 1 FROM t AS u WHERE u.r = t.r) AS ex,
       EXISTS (SELECT 1 FROM t AS u WHERE u.r IS NOT DISTINCT FROM t.r) AS ex_ndf
FROM t
ORDER BY id;

WITH t(id, a, b) AS (
  SELECT id, ROW(x, y), ROW(z, w)
  FROM (VALUES (1, 1, 'a', 1, 'a'),
               (2, 1, NULL, 1, NULL),
               (3, 1, NULL, 2, NULL)) AS v(id, x, y, z, w))
SELECT id, a IN (b) AS in_b, a NOT IN (b) AS notin_b
FROM t
ORDER BY id;

SELECT * FROM (SELECT ROW(1, 2) AS r) AS t WHERE r IN (ROW(1, 2), ROW(3, 4));

WITH t(id, a) AS (
  SELECT id, ROW(x, y)
  FROM (VALUES (1, 1, 'a'), (2, 1, NULL), (3, 2, 'c')) AS v(id, x, y))
SELECT id,
  LAG(a) OVER (ORDER BY id) IN (ROW(1, 'a'), ROW(2, 'b')) AS lag_in_list,
  LEAD(a) OVER (ORDER BY id) IN (ROW(1, 'a'), ROW(2, 'b')) AS lead_in_list,
  LAG(a) OVER (ORDER BY id) IN (SELECT 1, 'a') AS lag_in_subq
FROM t
ORDER BY id;

SELECT ARRAY[ROW(1, CAST(NULL AS VARCHAR))]
     = ARRAY[ROW(2, CAST(NULL AS VARCHAR))] AS differ;

SELECT ROW(1, ARRAY[ROW(1, CAST(NULL AS VARCHAR))])
     = ROW(1, ARRAY[ROW(1, CAST(NULL AS VARCHAR))]) AS row_of_array;

SELECT c
FROM (SELECT COUNT(*) AS c
      FROM (SELECT MAP['k', ROW(x, y)] AS m
            FROM (VALUES (1, 'a'), (2, NULL), (2, NULL)) AS v(x, y)) AS t
      GROUP BY m) AS g
ORDER BY c;

SELECT ARRAY_POSITION(ARRAY[ROW(x, y)], ROW(z, w)) AS r
FROM (VALUES (1, 'Foo', 1, 'Foo'), (2, 'Bar', 2, 'Car')) AS t(x, y, z, w);

SELECT ARRAY_DISTINCT(ARRAY[ROW(x, y), ROW(z, w)]) AS r
FROM (VALUES (1, 'Foo', 1, 'Foo'), (2, 'Bar', 2, 'Car')) AS t(x, y, z, w);

SELECT ARRAY_INTERSECT(ARRAY[ROW(x, y)], ARRAY[ROW(z, w)]) AS r
FROM (VALUES (1, 'Foo', 1, 'Foo'), (2, 'Bar', 2, 'Car')) AS t(x, y, z, w);

SELECT ARRAYS_OVERLAP(ARRAY[ROW(x, y)], ARRAY[ROW(z, w)]) AS r
FROM (VALUES (1, 'Foo', 1, 'Foo'), (2, 'Bar', 2, 'Car')) AS t(x, y, z, w);

SELECT ARRAY_POSITION(ARRAY[ROW(ROW(x, y), 10)], ROW(ROW(z, w), 10)) AS r
FROM (VALUES (1, 'Foo', 1, 'Foo'), (2, 'Bar', 2, 'Car')) AS t(x, y, z, w);

SELECT ARRAY_DISTINCT(ARRAY[ROW(ROW(x, y), 10), ROW(ROW(z, w), 10)]) AS r
FROM (VALUES (1, 'Foo', 1, 'Foo'), (2, 'Bar', 2, 'Car')) AS t(x, y, z, w);

SELECT ARRAY_INTERSECT(ARRAY[ROW(ROW(x, y), 10)], ARRAY[ROW(ROW(z, w), 10)]) AS r
FROM (VALUES (1, 'Foo', 1, 'Foo'), (2, 'Bar', 2, 'Car')) AS t(x, y, z, w);

SELECT ARRAYS_OVERLAP(ARRAY[ROW(ROW(x, y), 10)], ARRAY[ROW(ROW(z, w), 10)]) AS r
FROM (VALUES (1, 'Foo', 1, 'Foo'), (2, 'Bar', 2, 'Car')) AS t(x, y, z, w);

SELECT ARRAY_POSITION(ARRAY[ROW(ARRAY[ROW(x, y)], 10)], ROW(ARRAY[ROW(z, w)], 10)) AS r
FROM (VALUES (1, 'Foo', 1, 'Foo'), (2, 'Bar', 2, 'Car')) AS t(x, y, z, w);

SELECT ARRAY_DISTINCT(ARRAY[ROW(ARRAY[ROW(x, y)], 10), ROW(ARRAY[ROW(z, w)], 10)]) AS r
FROM (VALUES (1, 'Foo', 1, 'Foo'), (2, 'Bar', 2, 'Car')) AS t(x, y, z, w);

SELECT ARRAY_INTERSECT(ARRAY[ROW(ARRAY[ROW(x, y)], 10)], ARRAY[ROW(ARRAY[ROW(z, w)], 10)]) AS r
FROM (VALUES (1, 'Foo', 1, 'Foo'), (2, 'Bar', 2, 'Car')) AS t(x, y, z, w);

SELECT ARRAYS_OVERLAP(ARRAY[ROW(ARRAY[ROW(x, y)], 10)], ARRAY[ROW(ARRAY[ROW(z, w)], 10)]) AS r
FROM (VALUES (1, 'Foo', 1, 'Foo'), (2, 'Bar', 2, 'Car')) AS t(x, y, z, w);

SELECT ARRAY_POSITION(ARRAY[ROW(x, CAST(NULL AS INTEGER))], ROW(z, CAST(NULL AS INTEGER))) AS r
FROM (VALUES (1, 'Foo', 1, 'Foo'), (2, 'Bar', 2, 'Car')) AS t(x, y, z, w);

SELECT ARRAY_DISTINCT(ARRAY[ROW(x, CAST(NULL AS INTEGER)), ROW(z, CAST(NULL AS INTEGER))]) AS r
FROM (VALUES (1, 'Foo', 1, 'Foo'), (2, 'Bar', 2, 'Car')) AS t(x, y, z, w);

SELECT ARRAY_INTERSECT(ARRAY[ROW(x, CAST(NULL AS INTEGER))], ARRAY[ROW(z, CAST(NULL AS INTEGER))]) AS r
FROM (VALUES (1, 'Foo', 1, 'Foo'), (2, 'Bar', 2, 'Car')) AS t(x, y, z, w);

SELECT ARRAYS_OVERLAP(ARRAY[ROW(x, CAST(NULL AS INTEGER))], ARRAY[ROW(z, CAST(NULL AS INTEGER))]) AS r
FROM (VALUES (1, 'Foo', 1, 'Foo'), (2, 'Bar', 2, 'Car')) AS t(x, y, z, w);

SELECT id, ROW(x, y) MEMBER OF MULTISET[ROW(z, w)] AS r
FROM (VALUES
    (1, 1, 'Foo', 1, 'Foo'),
    (2, 2, 'Bar', 2, 'Car'),
    (3, 3, 'Baz', 4, 'Baz'),
    (4, 5, NULL, 5, NULL)) AS t(id, x, y, z, w)
ORDER BY id;

SELECT id,
    MULTISET[ROW(x, y), ROW(x, y)]
        SUBMULTISET OF MULTISET[ROW(z, w), ROW(z, w), ROW(z, w), ROW(9, 'Zzz')] AS r,
    MULTISET[ROW(x, y), ROW(x, y)]
        NOT SUBMULTISET OF MULTISET[ROW(z, w), ROW(z, w), ROW(z, w), ROW(9, 'Zzz')] AS not_r
FROM (VALUES
    (1, 1, 'Foo', 1, 'Foo'),
    (2, 2, 'Bar', 2, 'Car'),
    (3, 3, 'Baz', 4, 'Baz'),
    (4, 5, NULL, 5, NULL)) AS t(id, x, y, z, w)
ORDER BY id;

SELECT id, ROW(a, b) AS r
FROM (
    SELECT id,
        MULTISET[ROW(x, y), ROW(x, y), ROW(9, 'Zzz')]
        MULTISET INTERSECT ALL
        MULTISET[ROW(z, w), ROW(z, w), ROW(z, w), ROW(8, 'Yyy')] AS m
    FROM (VALUES
        (1, 1, 'Foo', 1, 'Foo'),
        (2, 2, 'Bar', 2, 'Car'),
        (3, 3, 'Baz', 4, 'Baz'),
        (4, 5, NULL, 5, NULL)) AS t(id, x, y, z, w)) AS t
CROSS JOIN UNNEST(m) AS u(a, b)
ORDER BY id, a, b;

SELECT id, ROW(a, b) AS r
FROM (
    SELECT id,
        MULTISET[ROW(x, y), ROW(x, y), ROW(9, 'Zzz')]
        MULTISET EXCEPT ALL
        MULTISET[ROW(z, w), ROW(z, w), ROW(z, w), ROW(8, 'Yyy')] AS m
    FROM (VALUES
        (1, 1, 'Foo', 1, 'Foo'),
        (2, 2, 'Bar', 2, 'Car'),
        (3, 3, 'Baz', 4, 'Baz'),
        (4, 5, NULL, 5, NULL)) AS t(id, x, y, z, w)) AS t
CROSS JOIN UNNEST(m) AS u(a, b)
ORDER BY id, a, b;

SELECT id, ROW(a, b) AS r
FROM (
    SELECT id,
        MULTISET[ROW(x, y), ROW(x, y), ROW(9, 'Zzz')]
        MULTISET UNION DISTINCT
        MULTISET[ROW(z, w), ROW(z, w), ROW(z, w), ROW(8, 'Yyy')] AS m
    FROM (VALUES
        (1, 1, 'Foo', 1, 'Foo'),
        (2, 2, 'Bar', 2, 'Car'),
        (3, 3, 'Baz', 4, 'Baz'),
        (4, 5, NULL, 5, NULL)) AS t(id, x, y, z, w)) AS t
CROSS JOIN UNNEST(m) AS u(a, b)
ORDER BY id, a, b;

SELECT id, ROW(ROW(x, y), p) MEMBER OF MULTISET[ROW(ROW(z, w), q)] AS r
FROM (VALUES
    (1, 1, 'Foo', 10, 1, 'Foo', 10),
    (2, 2, 'Bar', 10, 2, 'Car', 10),
    (3, 3, 'Baz', 10, 4, 'Baz', 10),
    (4, 5, NULL, 10, 5, NULL, 10),
    (5, 6, 'Qux', 10, 6, 'Qux', 11)) AS t(id, x, y, p, z, w, q)
ORDER BY id;

SELECT id,
    MULTISET[ROW(ROW(x, y), p), ROW(ROW(x, y), p)]
        SUBMULTISET OF MULTISET[ROW(ROW(z, w), q), ROW(ROW(z, w), q), ROW(ROW(z, w), q), ROW(ROW(9, 'Zzz'), 10)] AS r,
    MULTISET[ROW(ROW(x, y), p), ROW(ROW(x, y), p)]
        NOT SUBMULTISET OF MULTISET[ROW(ROW(z, w), q), ROW(ROW(z, w), q), ROW(ROW(z, w), q), ROW(ROW(9, 'Zzz'), 10)] AS not_r
FROM (VALUES
    (1, 1, 'Foo', 10, 1, 'Foo', 10),
    (2, 2, 'Bar', 10, 2, 'Car', 10),
    (3, 3, 'Baz', 10, 4, 'Baz', 10),
    (4, 5, NULL, 10, 5, NULL, 10),
    (5, 6, 'Qux', 10, 6, 'Qux', 11)) AS t(id, x, y, p, z, w, q)
ORDER BY id;

SELECT id, ROW(a, b) AS r
FROM (
    SELECT id,
        MULTISET[ROW(ROW(x, y), p), ROW(ROW(x, y), p), ROW(ROW(9, 'Zzz'), 10)]
        MULTISET INTERSECT ALL
        MULTISET[ROW(ROW(z, w), q), ROW(ROW(z, w), q), ROW(ROW(z, w), q), ROW(ROW(8, 'Yyy'), 10)] AS m
    FROM (VALUES
        (1, 1, 'Foo', 10, 1, 'Foo', 10),
        (2, 2, 'Bar', 10, 2, 'Car', 10),
        (3, 3, 'Baz', 10, 4, 'Baz', 10),
        (4, 5, NULL, 10, 5, NULL, 10),
        (5, 6, 'Qux', 10, 6, 'Qux', 11)) AS t(id, x, y, p, z, w, q)) AS t
CROSS JOIN UNNEST(m) AS u(a, b)
ORDER BY id, u.a."EXPR$0", u.a."EXPR$1", b;

SELECT id, ROW(a, b) AS r
FROM (
    SELECT id,
        MULTISET[ROW(ROW(x, y), p), ROW(ROW(x, y), p), ROW(ROW(9, 'Zzz'), 10)]
        MULTISET EXCEPT ALL
        MULTISET[ROW(ROW(z, w), q), ROW(ROW(z, w), q), ROW(ROW(z, w), q), ROW(ROW(8, 'Yyy'), 10)] AS m
    FROM (VALUES
        (1, 1, 'Foo', 10, 1, 'Foo', 10),
        (2, 2, 'Bar', 10, 2, 'Car', 10),
        (3, 3, 'Baz', 10, 4, 'Baz', 10),
        (4, 5, NULL, 10, 5, NULL, 10),
        (5, 6, 'Qux', 10, 6, 'Qux', 11)) AS t(id, x, y, p, z, w, q)) AS t
CROSS JOIN UNNEST(m) AS u(a, b)
ORDER BY id, u.a."EXPR$0", u.a."EXPR$1", b;

SELECT id, ROW(a, b) AS r
FROM (
    SELECT id,
        MULTISET[ROW(ROW(x, y), p), ROW(ROW(x, y), p), ROW(ROW(9, 'Zzz'), 10)]
        MULTISET UNION DISTINCT
        MULTISET[ROW(ROW(z, w), q), ROW(ROW(z, w), q), ROW(ROW(z, w), q), ROW(ROW(8, 'Yyy'), 10)] AS m
    FROM (VALUES
        (1, 1, 'Foo', 10, 1, 'Foo', 10),
        (2, 2, 'Bar', 10, 2, 'Car', 10),
        (3, 3, 'Baz', 10, 4, 'Baz', 10),
        (4, 5, NULL, 10, 5, NULL, 10),
        (5, 6, 'Qux', 10, 6, 'Qux', 11)) AS t(id, x, y, p, z, w, q)) AS t
CROSS JOIN UNNEST(m) AS u(a, b)
ORDER BY id, u.a."EXPR$0", u.a."EXPR$1", b;

SELECT id, ROW(x, CAST(NULL AS INTEGER)) MEMBER OF MULTISET[ROW(z, CAST(NULL AS INTEGER))] AS r
FROM (VALUES
    (1, 1, 1),
    (2, 2, 3)) AS t(id, x, z)
ORDER BY id;

SELECT id,
    MULTISET[ROW(x, CAST(NULL AS INTEGER)), ROW(x, CAST(NULL AS INTEGER))]
        SUBMULTISET OF MULTISET[ROW(z, CAST(NULL AS INTEGER)), ROW(z, CAST(NULL AS INTEGER)), ROW(z, CAST(NULL AS INTEGER)), ROW(9, CAST(NULL AS INTEGER))] AS r,
    MULTISET[ROW(x, CAST(NULL AS INTEGER)), ROW(x, CAST(NULL AS INTEGER))]
        NOT SUBMULTISET OF MULTISET[ROW(z, CAST(NULL AS INTEGER)), ROW(z, CAST(NULL AS INTEGER)), ROW(z, CAST(NULL AS INTEGER)), ROW(9, CAST(NULL AS INTEGER))] AS not_r
FROM (VALUES
    (1, 1, 1),
    (2, 2, 3)) AS t(id, x, z)
ORDER BY id;

SELECT id, ROW(a, b) AS r
FROM (
    SELECT id,
        MULTISET[ROW(x, CAST(NULL AS INTEGER)), ROW(x, CAST(NULL AS INTEGER)), ROW(9, CAST(NULL AS INTEGER))]
        MULTISET INTERSECT ALL
        MULTISET[ROW(z, CAST(NULL AS INTEGER)), ROW(z, CAST(NULL AS INTEGER)), ROW(z, CAST(NULL AS INTEGER)), ROW(8, CAST(NULL AS INTEGER))] AS m
    FROM (VALUES
        (1, 1, 1),
        (2, 2, 3)) AS t(id, x, z)) AS t
CROSS JOIN UNNEST(m) AS u(a, b)
ORDER BY id, a, b;

SELECT id, ROW(a, b) AS r
FROM (
    SELECT id,
        MULTISET[ROW(x, CAST(NULL AS INTEGER)), ROW(x, CAST(NULL AS INTEGER)), ROW(9, CAST(NULL AS INTEGER))]
        MULTISET EXCEPT ALL
        MULTISET[ROW(z, CAST(NULL AS INTEGER)), ROW(z, CAST(NULL AS INTEGER)), ROW(z, CAST(NULL AS INTEGER)), ROW(8, CAST(NULL AS INTEGER))] AS m
    FROM (VALUES
        (1, 1, 1),
        (2, 2, 3)) AS t(id, x, z)) AS t
CROSS JOIN UNNEST(m) AS u(a, b)
ORDER BY id, a, b;

SELECT id, ROW(a, b) AS r
FROM (
    SELECT id,
        MULTISET[ROW(x, CAST(NULL AS INTEGER)), ROW(x, CAST(NULL AS INTEGER)), ROW(9, CAST(NULL AS INTEGER))]
        MULTISET UNION DISTINCT
        MULTISET[ROW(z, CAST(NULL AS INTEGER)), ROW(z, CAST(NULL AS INTEGER)), ROW(z, CAST(NULL AS INTEGER)), ROW(8, CAST(NULL AS INTEGER))] AS m
    FROM (VALUES
        (1, 1, 1),
        (2, 2, 3)) AS t(id, x, z)) AS t
CROSS JOIN UNNEST(m) AS u(a, b)
ORDER BY id, a, b;

select deptno, (select min(empno) from "scott".emp where deptno = dept.deptno) as x from "scott".dept;

select deptno, (select count(*) from "scott".emp where deptno = dept.deptno group by deptno) as x from "scott".dept;

select deptno, (select count(*) from "scott".emp where 1 = 0) as x from "scott".dept;

select deptno, (select sum(empno) from "scott".emp where 1 = 0) as x from "scott".dept;

select deptno, (select empno from "scott".emp where emp.deptno = dept.deptno and job = 'PRESIDENT') as x from "scott".dept;

select deptno, (select sum(cast(empno as bigint)) from "scott".emp where deptno = dept.deptno limit 1) as x from "scott".dept;

select deptno, (select deptno from "scott".emp where deptno = dept.deptno limit 0) as x from "scott".dept;

select deptno, (select empno from "scott".emp order by empno limit 1) as x from "scott".dept;

select
    (select count(t2.id)
        from (values (1), (2), (2), (4)) t2(id)
        where t2.id = t1.id) as c
from (values (1), (3)) t1(id);

select exists (select *
               from (values (1), (2), (2), (4)) t2(id)
               where t2.id = t1.id) as e
from (values (1), (3)) t1(id);

SELECT empno, (SELECT COUNT(*) AS c
FROM "scott".emp
WHERE mgr < "t".mgr) AS "$f1"
FROM "scott".emp as "t"
WHERE sal > 10;

select current value for "my_seq" as c from (values 1, 2);

select * from "metadata".tables;

select * from
(select x, y from (values (1, 'a'), (1, 'a'), (1, 'a'), (2, 'b'), (3, 'c')) as t(x, y))
intersect
(select x, y from (values (1, 'a'), (1, 'a'), (2, 'c'), (4, 'x')) as t2(x, y));

select * from
(select x, y from (values (cast(NULL as int), cast(NULL as varchar(1))),
  (cast(NULL as int), cast(NULL as varchar(1))), (cast(NULL as int), cast(NULL as varchar(1)))) as t(x, y))
intersect
(select x, y from (values (cast(NULL as int), cast(NULL as varchar(1))),
  (cast(NULL as int), cast(NULL as varchar(1)))) as t2(x, y));

select * from
(select x, y from (values (1, 'a'), (1, 'a'), (2, 'b'), (3, 'c')) as t(x, y))
union
(select x, y from (values (1, 'a'), (2, 'c'), (4, 'x')) as t2(x, y));

select * from
(select x, y from (values (cast(NULL as int), cast(NULL as varchar(1))),
  (cast(NULL as int), cast(NULL as varchar(1))), (cast(NULL as int), cast(NULL as varchar(1)))) as t(x, y))
union
(select x, y from (values (cast(NULL as int), cast(NULL as varchar(1))),
  (cast(NULL as int), cast(NULL as varchar(1)))) as t2(x, y));

select * from
(select x, y from (values (1, 'a'), (1, 'a'), (1, 'a'), (2, 'b'), (3, 'c')) as t(x, y))
except
(select x, y from (values (1, 'a'), (2, 'c'), (4, 'x')) as t2(x, y));

select * from
(select x, y from (values (cast(NULL as int), cast(NULL as varchar(1))),
  (cast(NULL as int), cast(NULL as varchar(1))), (cast(NULL as int), cast(NULL as varchar(1)))) as t(x, y))
except all
(select x, y from (values (cast(NULL as int), cast(NULL as varchar(1))),
  (cast(NULL as int), cast(NULL as varchar(1)))) as t2(x, y));

(select * from emp where deptno = 10
 union all
 select * from emp where job = 'CLERK')
intersect
select * from emp where job = 'CLERK';

select * from (values (10, 1), (30, 3), (30, 3)) as t (x, y)
union
select * from (values (20, 2)) as t (x, y) where x > 30;

SELECT deptno FROM dept WHERE deptno > 12
EXCEPT
SELECT deptno FROM emp e1 WHERE EXISTS (
    SELECT 1 FROM emp e2
    WHERE e2.comm = e1.comm);

select * from "scott".emp
where empno = any (select empno from "scott".emp);

select * from "scott".emp
where sal > any (select comm from "scott".emp);

select *, sal > all (select comm from "scott".emp) as x
from "scott".emp;

select *, sal <= some (select comm from "scott".emp) as x
from "scott".emp;

select *, empno <> some (values (100), (200)) as x
from "scott".emp;

select *, empno <> some (values (7499), (NULL)) as x
from "scott".emp;

select *, empno <> some (select empno from "scott".emp where empno = 8000) as x
from "scott".emp;

select *, emp.comm <> some (values (300), (500)) as x
from "scott".emp;

select *, emp.comm <> some (select comm from "scott".emp) as x
from "scott".emp;

select *, emp.comm <> some (select comm from "scott".emp where comm = 800) as x
from "scott".emp;

select * from "scott".emp
where comm < some (select comm from "scott".emp where 1 = 0);

select * from "scott".emp
where sal > all(500, 2000);

select * from "scott".emp
where sal > some (4000, 2000);

select * from "scott".emp
where comm > (select comm from "scott".emp where comm = 300.00);

select * from "scott".emp
where sal < all (select sal * 2 from "scott".emp)
order by sal desc;

select * from "scott".emp
where sal < all (select comm * 2 from "scott".emp);

select * from "scott".emp
where sal < any (select comm * 2 from "scott".emp) is unknown;

select * from "scott".emp
where sal > any (select comm from "scott".emp where comm < 1000);

select * from "scott".emp
where sal > any (select comm * 2 from "scott".emp where comm < 2000);

select * from "scott".emp
where sal > all (select comm from "scott".emp where comm is not null);

WITH tb as (select array(SELECT * FROM (VALUES (FALSE), (TRUE)) as x(a)) as a)
SELECT TRUE IN (SELECT b FROM UNNEST(a) AS x1(b)) AS test FROM tb;

select 1 = any(Array [1, 2, 3]),
  4 = any(Array [1, 2, 3]),
  1 > any(Array [1, 2, 3]),
  1 < any(Array [1, 2, 3]);

select * from "days" order by "day";

select * from "days" where "day" between 2 and 4 order by "day";

select "store_id", "grocery_sqft" from "store"
where "store_id" < 3
order by "florist", 2 DESC;

select "store_id", "grocery_sqft" from "store"
where "store_id" < 3
order by "florist", 2;

select *
from dept
order by deptno limit 2 offset 1;

select *
from dept
order by deptno limit 2;

select *
from dept
order by deptno offset 1;

select *
from dept
order by deptno offset 1 limit 2;

select *
from dept
order by deptno limit 1, all;

with e as (select "empid" as empid from "hr"."emps" where "empid" < 120)
select * from e as e1, e as e2 order by e1.empid + e2.empid, e1.empid;

select * from "hr"."emps" offset 0;

select distinct count("empid") as c
from "hr"."emps"
group by "empid"
order by 1;

select * from
(values
    (2, array[2, 3]),
    (3, array[3, 4]),
    (1, array[1, 2]),
    (4, array[4, 5])) as t(id, arr)
order by arr desc;

select * from
(values
    (2, array[null, 3]),
    (3, array[3, 4]),
    (1, array[1, 2]),
    (4, array[4, 5]),
    (5, cast(null as integer array))) as t(id, arr)
order by arr nulls first;

select * from
(values
    (2, array[null, 3]),
    (3, array[3, 4]),
    (1, array[1, 2]),
    (4, array[4, 5]),
    (5, cast(null as integer array))) as t(id, arr)
order by arr nulls last;

SELECT * FROM emp ORDER BY deptno, null, empno;

select x, y from (values (2, 'b'), (1, 'a'), (1, 'c')) as t(x, y)
order by all;

SELECT id
FROM (
  VALUES
    (1, ARRAY[2, 0]),
    (2, ARRAY[1, 2]),
    (3, ARRAY[1, 1])
) AS t(id, k)
ORDER BY k, id;

SELECT id
FROM (VALUES (1, MAP[1, 10, 2, 20]), (2, MAP[1, 5, 2, 20]),
    (3, MAP[2, 20, 1, 10])) AS t(id, k)
ORDER BY k, id;

select count(*) as c from GEO."countries";

select count(*) as c from GEO."parks";

SELECT ST_AsEWKT('LINESTRING (1 2, 3 4)');

SELECT ST_AsGML('LINESTRING (1 2, 3 4)');

SELECT ST_AsWKT('POINT(-71.064544 42.28787)');

SELECT ST_AsText('01030000000100000005000000000000000000
000000000000000000000000000000000000000000000000
F03F000000000000F03F000000000000F03F000000000000F03
F000000000000000000000000000000000000000000000000');

SELECT ST_AsText(ST_Force2D('POINT(-10 10)'));

SELECT ST_AsText(ST_Force2D('LINESTRING(-10 10 2, 10 10 3)'));

SELECT ST_GeomFromGeoJSON('{"type":"LineString","coordinates":[[1,2],[3,4]],"crs":{"type":"name","properties":{"name":"EPSG:0"}}}');

SELECT ST_AsEWKT(ST_GeomFromGML('<gml:LineString><gml:coordinates>1.0,2.0 3.0,4.0</gml:coordinates></gml:LineString>', 4326));

SELECT ST_GeomFromText('LINESTRING(-71.160281 42.258729,-71.160837 42.259113,-71.161144 42.25932)',4269);

SELECT ST_GeomFromText('POINT(-71.064544 42.28787)');

SELECT ST_GeomFromText('MULTIPOLYGON(((-71.1031880899493 42.3152774590236,
-71.1031627617667 42.3152960829043,-71.102923838298 42.3149156848307,
-71.1023097974109 42.3151969047397,-71.1019285062273 42.3147384934248,
-71.102505233663 42.3144722937587,-71.10277487471 42.3141658254797,
-71.103113945163 42.3142739188902,-71.10324876416 42.31402489987,
-71.1033002961013 42.3140393340215,-71.1033488797549 42.3139495090772,
-71.103396240451 42.3138632439557,-71.1041521907712 42.3141153348029,
-71.1041411411543 42.3141545014533,-71.1041287795912 42.3142114839058,
-71.1041188134329 42.3142693656241,-71.1041112482575 42.3143272556118,
-71.1041072845732 42.3143851580048,-71.1041057218871 42.3144430686681,
-71.1041065602059 42.3145009876017,-71.1041097995362 42.3145589148055,
-71.1041166403905 42.3146168544148,-71.1041258822717 42.3146748022936,
-71.1041375307579 42.3147318674446,-71.1041492906949 42.3147711126569,
-71.1041598612795 42.314808571739,-71.1042515013869 42.3151287620809,
-71.1041173835118 42.3150739481917,-71.1040809891419 42.3151344119048,
-71.1040438678912 42.3151191367447,-71.1040194562988 42.3151832057859,
-71.1038734225584 42.3151140942995,-71.1038446938243 42.3151006300338,
-71.1038315271889 42.315094347535,-71.1037393329282 42.315054824985,
-71.1035447555574 42.3152608696313,-71.1033436658644 42.3151648370544,
-71.1032580383161 42.3152269126061,-71.103223066939 42.3152517403219,
-71.1031880899493 42.3152774590236)),
((-71.1043632495873 42.315113108546,-71.1043583974082 42.3151211109857,
-71.1043443253471 42.3150676015829,-71.1043850704575 42.3150793250568,-71.1043632495873 42.315113108546)))',4326);

SELECT ST_GeomFromText('CIRCULARSTRING(220268 150415,220227 150505,220227 150406)');

SELECT ST_GeomFromWKB(ST_AsWKB('LINESTRING (1 2, 3 4)'));

SELECT ST_LineFromText('LINESTRING(1 2, 3 4)') AS aline,
  ST_LineFromText('POINT(1 2)') AS null_return;

SELECT ST_LineFromWKB(ST_AsWKB('LINESTRING (5 5, 1 2, 3 4, 99 3)'));

SELECT ST_MLineFromText('MULTILINESTRING((1 2, 3 4), (4 5, 6 7))');

SELECT ST_AsEWKT(ST_MPointFromText('MULTIPOINT(-70.9590 42.1180, -70.9611 42.1223)', 4326));

SELECT ST_MPolyFromText('MULTIPOLYGON(((-70.916 42.1002,-70.9468 42.0946,-70.9765 42.0872,-70.9754 42.0875,-70.9749 42.0879,-70.9752 42.0881,-70.9754 42.0891,-70.9758 42.0894,-70.9759 42.0897,-70.9759 42.0899,-70.9754 42.0902,-70.9756 42.0906,-70.9753 42.0907,-70.9753 42.0917,-70.9757 42.0924,-70.9755 42.0928,-70.9755 42.0942,-70.9751 42.0948,-70.9755 42.0953,-70.9751 42.0958,-70.9751 42.0962,-70.9759 42.0983,-70.9767 42.0987,-70.9768 42.0991,-70.9771 42.0997,-70.9771 42.1003,-70.9768 42.1005,-70.977 42.1011,-70.9766 42.1019,-70.9768 42.1026,-70.9769 42.1033,-70.9775 42.1042,-70.9773 42.1043,-70.9776 42.1043,-70.9778 42.1048,-70.9773 42.1058,-70.9774 42.1061,-70.9779 42.1065,-70.9782 42.1078,-70.9788 42.1085,-70.9798 42.1087,-70.9806 42.109,-70.9807 42.1093,-70.9806 42.1099,-70.9809 42.1109,-70.9808 42.1112,-70.9798 42.1116,-70.9792 42.1127,-70.979 42.1129,-70.9787 42.1134,-70.979 42.1139,-70.9791 42.1141,-70.9987 42.1116,-71.0022 42.1273,
    -70.9408 42.1513,-70.9315 42.1165,-70.916 42.1002)))',4326);

SELECT ST_AsEWKT(ST_PointFromText('POINT(-71.064544 42.28787)', 4326));

SELECT ST_PointFromWKB(ST_AsWKB('POINT (5 5)'));

SELECT ST_AsWKT(ST_PolyFromText('POLYGON Z((0 0 1,20 0 1,20 20 1,0 20 1,0 0 1))'));

SELECT ST_PolyFromText('POLYGON((0 0, 0 1, 1 1, 0 0))');

SELECT ST_PolyFromWKB(ST_AsWKB('POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))'));

SELECT ST_ReducePrecision('POINT(1.412 19.323)', 0.1);

SELECT ST_ReducePrecision('POINT(1.412 19.323)', 10);

SELECT ST_ToMultiLine('GEOMETRYCOLLECTION(LINESTRING(1 4 3, 10 7 9, 12 9 22), POLYGON((1 1 -1, 3 1 0, 3 2 1, 1 2 2, 1 1 -1)))');

SELECT ST_ToMultiPoint('MULTIPOINT(5 5, 1 2, 3 4, 99 3)');

SELECT ST_ToMultiSegments('LINESTRING(5 4, 1 1, 3 4, 4 5)');

SELECT ST_ToMultiSegments('POLYGON((0 0, 10 0, 10 6, 0 6, 0 0), (1 1, 2 1, 2 5, 1 5, 1 1))');

SELECT ST_AsText(ST_Force3D('POINT(-10 10)'));

SELECT ST_ReducePrecision(ST_asText(ST_BoundingCircle('POLYGON((1 1, 1 4, 4 4, 4 1, 1 1))')), 0.01);

SELECT ST_ReducePrecision(ST_asText(ST_BoundingCircle('LINESTRING(1 1, 4 5, 3 2)')), 0.01);

SELECT ST_Expand('POINT(4 4)', 5, 2);

SELECT ST_ReducePrecision(ST_AsText(ST_MakeEllipse('POINT(5 5)', 2, 5)), 0.01);

SELECT ST_AsText(ST_MakeEnvelope(12.0, -1.0, 6.0, 4.0, 4326));

SELECT * FROM TABLE(ST_MakeGridPoints(ST_Point(13.0,22.0), 10.0, 5.0));

SELECT ST_MakeLine(ST_Point(1.0,1.0), ST_Point(-1.0,-1.0));

SELECT ST_MakePoint(-71.1043443253471, 42.3150676015829);

SELECT ST_AsWKT(ST_MakePoint(1.0, 2.0, 1.5));

SELECT ST_Y(ST_MakePoint(1.0, 2.0,1.5));

select "name", ST_MakePoint("longitude", "latitude") AS p
from GEO."countries" AS c
ORDER BY "latitude" DESC LIMIT 3;

SELECT ST_MakePolygon('LINESTRING(0 5, 4 5, 4 0, 0 0, 0 5)', 'LINESTRING(1 1, 1 2, 2 2, 2 1, 1 1)');

SELECT ST_MinimumDiameter('LINESTRING(0 0, 1 1, 3 9, 7 1)');

SELECT ST_MinimumRectangle('POLYGON((1 2, 3 0, 5 2, 3 2, 2 3, 1 2))');

SELECT ST_AsText(ST_Boundary('LINESTRING(1 1,0 0, -1 1)'));

SELECT ST_AsText(ST_Boundary('POLYGON Z((1 1 1,0 0 1, -1 1 1, 1 1 1))'));

SELECT ST_Centroid('MULTIPOINT((4 4), (1 1), (1 0), (0 3))');

SELECT ST_Centroid('MULTILINESTRING((1 5, 6 5), (5 1, 5 4))');

SELECT ST_Centroid('MULTIPOLYGON(((0 2, 3 2, 3 6, 0 6, 0 2)), ((5 0, 7 0, 7 1, 5 1, 5 0)))');

SELECT ST_CoordDim('Point(1 2 3)');

SELECT ST_CoordDim('Point Empty');

SELECT ST_Dimension('LINESTRING(2 1, 1 3, 5 2)');

SELECT ST_Distance(
    ST_GeomFromText('POINT(10 10)'),
    ST_GeomFromText('POINT(40 50)'));

SELECT round(ST_Distance(
    ST_GeomFromText('POINT(-72.1235 42.3521)', 4326),
    ST_GeomFromText('LINESTRING(-72.1260 42.45, -72.123 42.1546)', 4326)), 10);

SELECT round(ST_Distance(
    ST_Transform(ST_GeomFromText('POINT(-72.1235 42.3521)', 4326), 2163),
    ST_Transform(ST_GeomFromText('LINESTRING(-72.1260 42.45, -72.123 42.1546)', 4326), 2163)), 10);

SELECT ST_EndPoint('MULTILINESTRING((1 1, 1 6, 2 2, -1 2))');

SELECT ST_AsText(ST_Envelope('LINESTRING(0 0, 1 3)'));

SELECT ST_AsText(ST_Envelope('POLYGON((0 0, 0 1, 1.0000000001 1, 1.0000000001 0, 0 0))'));

SELECT t1.id, t2.geom, t2.index
FROM (SELECT 1 as id, 'MULTIPOINT((1 1), (2 2))' as points UNION ALL SELECT 2 as id, 'MULTIPOINT((3 3), (4 4))' as points) as t1,
LATERAL table(ST_Explode(t1.points)) as t2(geom, index);

SELECT ST_Extent('POINT(5 6)');

SELECT ST_ExteriorRing('POLYGON((0 -1, 0 2, 3 2, 3 -1, 0 -1))');

SELECT ST_GeometryN('MULTIPOLYGON(((0 0, 3 -1, 1.5 2, 0 0)), ((1 2, 4 2, 4 6, 1 6, 1 2)))', 1);

SELECT ST_InteriorRing('POLYGON((0 0, 10 0, 10 6, 0 6, 0 0), (1 1, 2 1, 2 5, 1 5, 1 1), (8 5, 8 4, 9 4, 9 5, 8 5))', 0);

SELECT ST_IsClosed('LINESTRING(2 1, 1 3, 5 2)');

SELECT ST_IsEmpty('MULTIPOINT((4 4), (1 1), (1 0), (0 3))');

SELECT ST_IsEmpty('POLYGON EMPTY');

SELECT ST_IsRectangle('POLYGON((0 0, 10 0, 10 7, 0 5, 0 0))');

SELECT ST_IsRing('LINESTRING(2 1, 1 3, 6 6)');

SELECT ST_IsRing('LINESTRING(2 1, 1 3, 6 6, 5 7, 5 2)');

SELECT ST_IsSimple('MULTILINESTRING((0 2, 3 2, 3 6, 0 6, 0 2), (5 0, 7 0, 7 1, 5 1, 5 0))');

SELECT ST_IsSimple('LINESTRING(2 1, 1 3, 6 6, 5 7, 5 6)');

SELECT ST_IsValid('POLYGON((0 0, 10 0, 10 5, 0 5, 0 0))');

SELECT ST_NumGeometries('LINESTRING(2 1, 1 3, 5 2)');

SELECT ST_NumGeometries('POLYGON(
  (0 0, 10 0, 10 6, 0 6, 0 0),
  (1 1, 2 1, 2 5, 1 5, 1 1),
  (8 5, 8 4, 9 4, 9 5, 8 5))');

SELECT ST_NumGeometries('GEOMETRYCOLLECTION(
  MULTIPOINT((4 4), (1 1), (1 0), (0 3)),
  LINESTRING(2 6, 6 2),
  POLYGON((1 2, 4 2, 4 6, 1 6, 1 2)))');

SELECT ST_NumInteriorRings('POLYGON(
  (0 0, 10 0, 10 6, 0 6, 0 0),
  (1 1, 2 1, 2 5, 1 5, 1 1),
  (8 5, 8 4, 9 4, 9 5, 8 5))');

SELECT ST_NumInteriorRings('GEOMETRYCOLLECTION(
  MULTIPOINT((4 4), (1 1), (1 0), (0 3)),
  LINESTRING(2 6, 6 2),
  POLYGON((1 2, 4 2, 4 6, 1 6, 1 2)))');

SELECT ST_NumPoints('POINT(2 2)');

SELECT ST_NumPoints('MULTIPOINT(2 2, 4 4, 4 4)');

SELECT ST_NumPoints('POLYGON((0 0, 10 0, 10 6, 0 6, 0 0), (1 1, 2 1, 2 5, 1 5, 1 1), (8 5, 8 4, 9 4, 9 5, 8 5))');

SELECT ST_PointN('MULTILINESTRING((1 1, 1 6, 2 2, -1 2))', 3);

SELECT ST_PointN('MULTILINESTRING((1 1, 1 6, 2 2, -1 2), (0 1, 2 4))', 4);

SELECT ST_PointOnSurface('MULTIPOINT((4 4), (1 1), (1 0), (0 3)))');

SELECT ST_PointOnSurface('POLYGON((0 0, 0 5, 5 5, 5 0, 0 0))');

SELECT ST_SRID(ST_GeomFromText('LINESTRING(2 1, 1 3, 5 2, 2 1)', 4326));

SELECT ST_X('POINT Z(1 2 3)');

SELECT ST_XMax('LINESTRING(1 3 4, 5 6 7)');

SELECT ST_Y('POINT Z(1 2 3)');

SELECT ST_YMax('LINESTRING(1 3 4, 5 6 7)');

SELECT ST_Is3D('POINT Z(1 2 0)');

SELECT ST_Z('POINT Z(1 2 3)');

SELECT ST_ZMax('LINESTRING(1 2 3, 4 5 6)');

SELECT ST_ZMin('LINESTRING(1 2 3, 4 5 6)');

SELECT ST_Contains(ST_Point(0.0, 0.0), ST_Point(1.0, 2.0));

-- Example demonstrating difference between contains and contains properly
SELECT ST_GeometryType(geomA) As geomtype, ST_Contains(geomA,geomA) AS acontainsa, ST_ContainsProperly(geomA, geomA) AS acontainspropa,
   ST_Contains(geomA, ST_Boundary(geomA)) As acontainsba, ST_ContainsProperly(geomA, ST_Boundary(geomA)) As acontainspropba
FROM (VALUES ( ST_Buffer(ST_Point(1.0,1.0), 5/*,1*/) ),
             ( ST_MakeLine(ST_Point(1.0,1.0), ST_Point(-1.0,-1.0) ) ),
             ( ST_Point(1.0,1.0))) As foo(geomA);

SELECT ST_CoveredBy('POINT(1 1)', ST_Buffer('POINT(0 0)', 1));

SELECT ST_Covers(ST_Buffer('POINT(0 0)', 1), 'POINT(1 1)');

select "name" from GEO."countries" AS c
where ST_Distance(ST_MakePoint(-0.12, 51.5), ST_MakePoint("longitude", "latitude")) < 10;

SELECT ST_Disjoint('LINESTRING(1 3, 5 3)', 'LINESTRING(1 1, 5 2, 2 5)');

SELECT ST_Equals('LINESTRING(1 3, 5 3)', 'LINESTRING(1 1, 5 2, 2 5)');

SELECT ST_OrderingEquals('LINESTRING(0 0 1, 0 0, 10 10 3)', 'LINESTRING(0 0 1, 0 0, 10 10 3)');

SELECT ST_OrderingEquals('POLYGON ((0 0, 10 10, 10 5, 0 0))', 'POLYGON ((0 0, 10 5, 10 10, 0 0))');

SELECT ST_Relate('LINESTRING(1 2, 3 4)', 'LINESTRING(5 6, 7 3)');

SELECT ST_Relate('POLYGON((1 1, 4 1, 4 5, 1 5, 1 1))', 'POLYGON((3 2, 6 2, 6 6, 3 6, 3 2))', '212101212');

SELECT ST_Relate('POINT(1 2)', ST_Buffer('POINT(1 2)', 2), '0F*FFF212');

SELECT ST_Within('LINESTRING(1 3, 5 3)', 'LINESTRING(1 1, 5 2, 2 5)');

SELECT ST_ReducePrecision(ST_AsWKT(ST_Buffer('LINESTRING(10 10,30 10)', 5)), 0.01);

SELECT ST_Buffer('POLYGON((10 10,10 20,20 20,20 10, 10 10))', -1);

SELECT ST_PrecisionReducer(ST_Buffer('POINT(100 90)', 50, 'quad_segs=2'), 3);

SELECT ST_PrecisionReducer(ST_Buffer('LINESTRING(50 50,150 150,150 50)', 10, 'endcap=square join=round'), 3);

SELECT ST_PrecisionReducer(ST_Buffer('LINESTRING(50 50,150 150,150 50)', 10, 'join=bevel'), 3);

SELECT ST_PrecisionReducer(ST_Buffer('LINESTRING(50 50,150 150,150 50)', 10, 'join=mitre mitre_limit=1.0'), 3);

SELECT ST_PrecisionReducer(ST_Buffer('LINESTRING(50 50,150 150,150 50)', 10, 'side=right'), 3);

SELECT ST_ConvexHull('GEOMETRYCOLLECTION(
                        POINT(1 2),
                        LINESTRING(1 4, 4 7),
                        POLYGON((3 1, 7 1, 7 6, 3 1)))');

SELECT ST_Difference('POLYGON((3 2, 8 2, 8 8, 3 8, 3 2))', 'POLYGON((1 1, 7 1, 7 6, 1 6, 1 1))');

SELECT ST_Intersection('POLYGON((1 1, 4 1, 4 6, 1 6, 1 1))', 'POLYGON((4 2, 8 2, 8 8, 4 8, 4 2))');

SELECT ST_Intersection('LINESTRING(2 2, 6 6)', 'LINESTRING(2 8, 8 2)');

SELECT ST_ReducePrecision(ST_OffsetCurve('LINESTRING(0 0, 10 0, 10 10)', 2, ''), 0.01);

SELECT ST_SymDifference('POLYGON((1 1, 7 1, 7 6, 1 6, 1 1))', 'POLYGON((3 2, 8 2, 8 8, 3 8, 3 2))');

SELECT ST_AsText(ST_UnaryUnion('POINT(1 2)', 'POINT(1 2)'));

SELECT ST_Union(ARRAY(SELECT the_geom FROM sometable));

SELECT ST_Rotate('LINESTRING(1 3, 1 1, 2 1)', pi());

SELECT ST_Rotate('LINESTRING(1 3, 1 1, 2 1)', -pi() / 2, ST_PointFromText('POINT(2 1)'));

SELECT ST_Scale('LINESTRING(1 2, 4 5)', 0.5, 0.75);

SELECT ST_Translate('LINESTRING(0 0, 1 0)', 1, 2);

SELECT ST_Translate('MULTIPOINT((0 1), (2 2), (1 3))', 1, 0);

SELECT ST_AsText(ST_Translate('POINT Z(1 2 3)', 10, 20));

SELECT ST_AddPoint('LINESTRING(0 0, 1 1)', 'POINT(2 2)');

SELECT ST_Densify('POINT(14 2)', 10);

SELECT ST_Densify('LINESTRING(1 11, 8 1)', 10);

SELECT ST_FlipCoordinates('POINT(1 2)');

SELECT ST_FlipCoordinates('POLYGON ((0 1, 2 3, 3 2, 2 1, 0 1))');

SELECT ST_Holes('POLYGON((0 0, 10 0, 10 5, 0 5, 0 0), (1 1, 2 1, 2 4, 1 4, 1 1))');

SELECT ST_Holes('LINESTRING(5 5, 1 2, 3 4, 9 3)');

SELECT ST_Normalize('MULTIPOINT((2 2), (2 5), (10 3), (7 1), (5 1), (5 3))');

SELECT ST_RemoveRepeatedPoints( 'LINESTRING (0 0, 0 0, 1 1, 5 5, 1 1, 2 2)', 2);

SELECT ST_RemoveRepeatedPoints('LINESTRING(1 1, 2 2, 2 2, 1 3, 1 3, 3 3, 3 3, 5 2, 5 2, 5 1)');

SELECT ST_RemoveRepeatedPoints('POLYGON((2 4, 1 3, 2 1, 2 1, 6 1, 6 3, 4 4, 4 4, 2 4))');

SELECT ST_RemoveRepeatedPoints('MULTIPOINT((4 4), (1 1), (1 0), (0 3), (4 4))');

SELECT ST_RemoveHoles('POLYGON((1 5, 0 4, 0 1, 1 0, 4 0, 4 2, 5 4, 5 4, 1 5))');

SELECT ST_RemovePoint('LINESTRING(0 0, 1 1, 2 2, 3 3)', 2);

SELECT ST_RemovePoint('LINESTRING(0 0, 1 1, 2 2, 3 3)', 3);

SELECT ST_Reverse('MULTILINESTRING((10 260, 150 290, 186 406, 286 286), (120 120, 130 125, 142 129, 360 160, 357 170, 380 340), (1 1, 5 5))');

SELECT ST_Reverse('MULTIPOLYGON(((2 4, 1 3, 2 1, 6 1, 6 3, 4 4, 2 4)), ((1 6, 6 6, 6 5, 1 5, 1 6)), ((0 1, 1 1, 1 0, 0 0, 0 1)))');

SELECT ST_AsText(ST_AddZ('MULTIPOINT((190 300 1), (10 11 0))', 10));

SELECT ST_AsText(ST_AddZ('MULTIPOINT Z((190 300 10), (10 11 5))', -10));

SELECT ST_Area('POINT(0 12)');

SELECT ST_Area('POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))');

SELECT ST_Area('GEOMETRYCOLLECTION(LINESTRING(5 4, 1 1, 3 4, 4 5), POINT(0 12), POLYGON((0 0, 10 0, 10 10, 0 10, 0 0)), POLYGON((5 4, 1 1, 3 4, 4 5, 5 4)))');

SELECT ST_ClosestCoordinate('POINT(4 2.5)', 'POLYGON((0 0, 10 0, 10 5, 0 5, 0 0))');

SELECT  ST_ClosestPoint('POLYGON((0 0, 10 0, 10 5, 0 5, 0 0))', 'POINT(4 2)');

SELECT ST_ClosestPoint('LINESTRING(1 1, 1 5))', 'LINESTRING(2 1, 2 5))') A,
       ST_ClosestPoint('LINESTRING(1 1, 1 5))', 'LINESTRING(2 5, 2 1))') B;

SELECT ST_FurthestCoordinate('POINT(0 0)', 'POLYGON((2 2, 10 0, 10 5, 0 5, 2 2))');

SELECT ST_FurthestCoordinate('POINT(5 2.5)', 'POLYGON((0 0, 10 0, 10 5, 0 5, 0 0))');

SELECT ST_Length('LINESTRING(2 1, 1 3, 5 2)');

SELECT ST_Length('MULTIPOLYGON(((0 2, 3 2, 3 6, 0 6, 0 2)), ((5 0, 7 0, 7 1, 5 1, 5 0)))');

SELECT ST_LocateAlong('LINESTRING(1 1, 5 4)', 0.5, 2.0);

SELECT ST_LocateAlong('POLYGON((1 1, 4 1, 4 3, 1 3, 1 1))', 0.5, -1.0);

SELECT ST_LongestLine('POLYGON ((0 1, 1 1, 1 0, 0 0, 0 1))', 'POLYGON ((2 3, 2 2, 3 2, 4 3, 2 3))');

SELECT ST_LongestLine('POLYGON ((0 1, 1 1, 1 0, 0 0, 0 1))', 'POINT (3 2)');

SELECT ST_LongestLine('POLYGON ((1 3, 0 0, 3 2, 1 3))', 'POLYGON ((1 3, 0 0, 3 2, 1 3))');

SELECT ST_MaxDistance('POLYGON ((0 1, 1 1, 1 0, 0 0, 0 1))', 'LINESTRING (1 3, 4 3)');

SELECT ST_MaxDistance('POLYGON ((1 3, 0 0, 3 2, 1 3))', 'POLYGON ((1 3, 0 0, 3 2, 1 3))');

SELECT ST_Perimeter('MULTIPOLYGON(((0 2, 3 2, 3 6, 0 6, 0 2)), ((5 0, 7 0, 7 1, 5 1, 5 0)))');

SELECT ST_Perimeter('LINESTRING(2 1, 1 3, 5 2)');

SELECT ST_PROJECTPOINT('POINT(2 4)', 'MULTILINESTRING ((0 0, 4 0), (0 2, 4 2))');

SELECT ST_PROJECTPOINT('POINT(0 4)', 'POLYGON ((2 4, 0 2, 3 0, 2 4))');

SELECT ST_LineMerge('MULTILINESTRING ((1 1, 1 4), (1 4, 5 4), (5 4, 5 1), (3 3, 3 4))');

SELECT ST_Polygonize('LINESTRING(1 2, 2 4, 4 4, 5 2, 1 2)');

SELECT ST_Simplify('POLYGON((2 1, 1 2, 2 2, 2 3, 3 3, 3 2, 4 2, 4 1, 3 0, 2 0, 2 1))', 0.5);

SELECT ST_Simplify('POLYGON((2 1, 1 2, 2 2, 2 3, 3 3, 3 2, 4 2, 4 1, 3 0, 2 0, 2 1))', 2);

SELECT ST_Simplify('LINESTRING(250 250, 280 290, 300 230, 340 300, 360 260, 440 310, 470 360, 604 286)', 40);

SELECT ST_SimplifyPreserveTopology('POLYGON((8 25, 28 22, 28 20, 15 11, 33 3, 56 30, 46 33,  46 34, 47 44, 35 36, 45 33, 43 19, 29 21, 29 22, 35 26, 24 39, 8 25))', 20);

SELECT ST_Snap('LINESTRING(1 2, 2 4, 4 4, 5 2)', 'LINESTRING(5 2, 2 1, 1 2)', 1);

SELECT ST_Snap('LINESTRING(1 2, 2 4, 4 4, 5 2)', 'LINESTRING(5 2, 2 1, 1 2)', 3);

SELECT ST_Snap('POLYGON((3 3, 1 2, 0 2, 0 1, -2 1, -1 7, 3 6, 4 8, 7 8, 6 6, 9 6, 8 1, 8 1, 3 3))', 'POLYGON((1 1, 1 7, 7 7, 7 1, 1 1))', 2);

SELECT ST_Split('MULTILINESTRING ((5 0, 5 10), (0 5, 10 5))', 'POINT(5 5)');

SELECT ST_Split('MULTILINESTRING ((1 0, 1 10), (2 0, 2 10))', 'LINESTRING(0 5, 4 5))');

SELECT ST_Split('MULTIPOLYGON (((0 0, 0 5, 2 5, 2 0, 0 0)), ((2 0, 2 5, 5 5, 5 0, 2 0)))', 'LINESTRING(0 2, 5 2)');

SELECT ST_AsEWKT(ST_Transform(ST_SetSRID(ST_MakePoint(-123.365556, 48.428611),4326),3785)) As sphere_merc;

SELECT ST_ConstrainedDelaunay('POLYGON((0 0, 0 10, 10 10, 10 0, 0 0))');

SELECT ST_Delaunay('MULTIPOINT((1 1), (0 4), (3 2), (3 7), (4 5), (5 2), (7 1), (7 6), (8 4), (5 8), (1 8), (4 0))');

SELECT ST_Accum(tmp.geom)
FROM (
  SELECT ST_GeomFromText('POINT(1 1)') as geom
  UNION ALL
  SELECT ST_GeomFromText('POINT(2 2)') as geom
) AS tmp;

SELECT ST_Union(tmp.geom)
FROM (
  SELECT ST_GeomFromText('POINT(1 1)') as geom
  UNION ALL
  SELECT ST_GeomFromText('POINT(2 2)') as geom
) AS tmp;

SELECT ST_AsText(st_union(the_geom))
FROM (
  SELECT ST_GeomFromText('POLYGON((-7 4.2,-7.1 4.2,-7.1 4.3,-7 4.2))') as the_geom
  UNION ALL
  SELECT ST_GeomFromText('POINT Z(5 5 5)') as the_geom
  UNION ALL
  SELECT ST_GeomFromText('POINT Z(-2 3 1)') as the_geom
  UNION ALL
  SELECT ST_GeomFromText('LINESTRING Z(5 5 5, 10 10 10)') as the_geom ) as foo;

select *
from GEO."states" as s
order by "name";

select s."name", p."name"
from GEO."states" as s
cross apply table(ST_MakeGrid(s."geom", 5.0, 5.0)) as sg,
    GEO."parks" as p
cross apply table(ST_MakeGrid(p."geom", 5.0, 5.0)) as pg
where (sg.abs_col, sg.abs_row) = (pg.abs_col, pg.abs_row)
order by 2, 1;

select x, y, hilbert(ST_Point(x, y))
from (
  values (0.0, 0.0),
     (0, 1),
     (1, 0),
     (0, -1),
     (10, 10),
     (20, 20)) as t(x, y);

WITH S AS (SELECT *, CAST(ROWTIME AS TIMESTAMP(3)) + INTERVAL '0.5' SECONDS AS TS FROM ORDERS)
SELECT * FROM TABLE(TUMBLE((SELECT * FROM S), DESCRIPTOR(TS), INTERVAL '20:10.525' MINUTE TO SECOND));

SELECT * FROM TABLE(TUMBLE(TABLE ORDERS, DESCRIPTOR(ROWTIME), INTERVAL '1' MINUTE));

SELECT * FROM TABLE(TUMBLE((SELECT * FROM ORDERS), DESCRIPTOR(ROWTIME), INTERVAL '10' MINUTE, INTERVAL '3' MINUTE));

SELECT * FROM TABLE(
  TUMBLE(
    (SELECT * FROM (VALUES
      (CAST(NULL AS TIMESTAMP), 'a'),
      (CAST(NULL AS TIMESTAMP), 'b')) AS T(TS, UID)),
    DESCRIPTOR(TS), INTERVAL '1' HOUR));

SELECT * FROM TABLE(
  HOP(
    DATA => TABLE ORDERS,
    TIMECOL => DESCRIPTOR(ROWTIME),
    SLIDE => INTERVAL '5' MINUTE,
    SIZE => INTERVAL '10' MINUTE));

SELECT * FROM TABLE(HOP((SELECT * FROM ORDERS), DESCRIPTOR(ROWTIME), INTERVAL '5' MINUTE, INTERVAL '10' MINUTE));

SELECT * FROM TABLE(
  HOP(
    (SELECT * FROM (VALUES
      (CAST(NULL AS TIMESTAMP), 'a'),
      (CAST(NULL AS TIMESTAMP), 'b')) AS T(TS, UID)),
    DESCRIPTOR(TS), INTERVAL '30' MINUTE, INTERVAL '1' HOUR));

SELECT * FROM TABLE(
  SESSION(
    DATA => TABLE ORDERS,
    TIMECOL => DESCRIPTOR(ROWTIME),
    KEY => DESCRIPTOR(PRODUCT),
    SIZE => INTERVAL '20' MINUTE));

SELECT * FROM TABLE(SESSION(TABLE ORDERS, DESCRIPTOR(ROWTIME), INTERVAL '1' HOUR));

SELECT * FROM TABLE(
  SESSION(
    (SELECT * FROM (VALUES
      (TIMESTAMP '2020-01-01 10:00:00', 'a'),
      (TIMESTAMP '2020-01-01 10:05:00', 'a'),
      (TIMESTAMP '2020-01-01 10:30:00', 'a'),
      (TIMESTAMP '2020-01-01 10:40:00', 'a'),
      (TIMESTAMP '2020-01-01 11:30:00', 'a')) AS T(TS, UID)),
    DESCRIPTOR(TS), DESCRIPTOR(UID), INTERVAL '15' MINUTE))
ORDER BY TS;

SELECT * FROM TABLE(
  SESSION(
    (SELECT * FROM (VALUES
      (TIMESTAMP '2020-01-01 10:00:00', 'a'),
      (CAST(NULL AS TIMESTAMP), 'a'),
      (TIMESTAMP '2020-01-01 10:05:00', 'a')) AS T(TS, UID)),
    DESCRIPTOR(TS), DESCRIPTOR(UID), INTERVAL '15' MINUTE))
ORDER BY TS;

select distinct * from (values
    (1, ROW(1,1)),
    (1, ROW(1,1)),
    (2, ROW(2,2))) as v(id,struct);

select * from
(values
    (1, ROW(2, ROW(4,3))),
    (2, ROW(2, ROW(3,4))),
    (3, ROW(1, ROW(3,4))),
    (4, ROW(2, ROW(3,4)))) as t(id,struct)
where t.struct = ROW(2, ROW(3,4));

SELECT deptno, job,
  CASE
  WHEN deptno = 20 AND job = 'CLERK' THEN 1
  WHEN deptno = 30 AND job = 'SALESMAN' THEN 2
  ELSE 3
  END AS x
FROM "scott".emp
WHERE empno < 7600;

select row(*) from emp limit 1;

select row(emp.*, dept.*) from emp join dept on emp.deptno = dept.deptno limit 1;

select row(* exclude(empno)) from emp order by empno limit 1;

select row(* exclude(empno, mgr)) from emp order by empno limit 1;

select row(emp.* exclude(emp.empno), dept.* exclude(dept.deptno)) from emp join dept on emp.deptno = dept.deptno order by emp.empno limit 1;

select row(1 as a, 'hello' as b).a;

select row(row(1 as x, 2 as y) as inner_row, 'hello' as name).inner_row.x;

select row(emp.*).ename from emp order by empno limit 3;

select row(emp.*, dept.*).deptno0 from emp join dept on emp.deptno = dept.deptno order by emp.empno limit 1;

select t.arr[1] as v from (select ARRAY[ROW(1, 2)] as arr) as t;

select case when x = 1 then arr[1] else arr[2] end as v
from (values (1)) as t(x), (select ARRAY[ROW(1, 2), ROW(3, 4)] as arr) as u;

select t.r."EXPR$0" as v from (select ROW(ROW(1, 2), 3) as r) as t;

select cast(t.arr[1] as row(x integer, y integer)) as v
from (select ARRAY[ROW(1, 2)] as arr) as t;

select coalesce(t.r, ROW(9, 9)) as v from (select ROW(1, 2) as r) as t;

with
t1(x) as (select * from  (values (1),(2),(case when 1 = 1 then null else 3 end)) as t1),
t2(x) as (select * from  (values (1),(case when 1 = 1 then null else 3 end)) as t2)
select *
from t1
where t1.x not in (select t2.x from t2);

SELECT "hr"."emps"."empid", "hr"."emps"."deptno",
 (SELECT count(*) FROM "hr"."emps" AS x WHERE x."salary">"hr"."emps"."salary" AND x."deptno"<"hr"."emps"."deptno")
FROM "hr"."emps"
 WHERE "hr"."emps"."empid"<"hr"."emps"."salary"
 ORDER BY 1,2,3;

select deptno, deptno     in (select deptno from emp) from dept;

select * from dept where deptno not in (select deptno from emp where deptno is null);

select deptno, deptno not in (select deptno from emp where deptno is null) from dept;

select deptno, deptno     in (select deptno from emp where deptno is not null) from dept;

select count(*) as c from (select * from emp order by deptno offset 4);

select count(*) as c from (select * from emp order by deptno limit 99);

select deptno, deptno in (select deptno from emp where false) from dept;

select * from dept
where deptno in (select deptno from emp where gender = 'F')
or deptno in (select deptno from emp where gender = 'M');

select * from dept
where (deptno, deptno) in (select deptno * 2 - deptno, deptno from emp where gender = 'F');

SELECT count(*) AS c
FROM "scott".emp
GROUP BY emp.deptno
HAVING sum(case when emp.empno in (7369, 7839, 7902) then emp.sal else 0 end)
     BETWEEN 5000.0 AND 10000.0;

SELECT emp.deptno,
  max(emp.empno) > (SELECT min(emp.empno) FROM "scott".emp) as bbbb
FROM "scott".emp
GROUP BY emp.deptno;

select empno from "scott".emp as e
join "scott".dept as d using (deptno)
where e.job in (
  select e2.job from "scott".emp as e2 where e2.deptno > e.deptno);

SELECT empno FROM emp JOIN dept on emp.deptno <= ALL(SELECT deptno FROM dept) and emp.deptno = dept.deptno;

select empno from "scott".emp as e
join "scott".dept as d using (deptno)
where e.job not in (
  select e2.job from "scott".emp as e2 where e2.deptno > e.deptno);

SELECT dname FROM "scott".dept WHERE 2000 > (SELECT emp.sal FROM "scott".emp where dept.deptno = emp.deptno ORDER BY emp.sal limit 1);

SELECT dname FROM "scott".dept WHERE 2000 > (SELECT emp.sal FROM "scott".emp where dept.deptno = emp.deptno and mgr > 8000 ORDER BY emp.sal limit 1);

SELECT dname FROM "scott".dept WHERE 2000 > (SELECT emp.sal FROM "scott".emp where dept.deptno = emp.deptno and mgr > 8000 ORDER BY year(hiredate), emp.sal limit 1);

SELECT dname, (SELECT emp.comm FROM "scott".emp where dept.deptno = emp.deptno ORDER BY emp.comm desc limit 1) FROM "scott".dept;

SELECT dname, (SELECT emp.sal FROM "scott".emp where dept.deptno = emp.deptno ORDER BY year(hiredate), emp.sal limit 1) FROM "scott".dept;

select count(*) as c
from "scott".emp
where sal + 100 not in (
  select comm from "scott".emp
  where job = 'SALESMAN');

select count(*) as c
from "scott".emp as e
where sal + 100 not in (
  select comm
  from "scott".emp
  where job = e.job);

with t (a, b) as (select * from (values (1, 2)))
select * from t where exists (select 1 from "scott".emp where deptno = t.a);

with t (a, b) as (select * from (values (60, 'b')))
select * from t where a in (select deptno from "scott".dept);

select *
from "scott".emp as e
join "scott".dept as d using (deptno)
where sal = (
  select max(sal)
  from "scott".emp as e2
  join "scott".dept as d2 using (deptno)
  where d2.deptno = d.deptno);

select *
from "scott".emp as e
join "scott".dept as d using (deptno)
where d.dname = (
  select max(dname)
  from "scott".dept as d2
  where d2.deptno = d.deptno);

select deptno,
  (select min(1) from "scott".emp where empno > d.deptno) as i0,
  (select min(0) from "scott".emp where deptno = d.deptno and ename = 'SMITH') as i1
from "scott".dept as d;

SELECT (WITH t2 AS (SELECT t.a)
        SELECT a FROM t2) AS c
FROM (SELECT 1 AS a) AS t;

SELECT ename,
       (SELECT Sum(sal + COALESCE((SELECT Sum(sal) FROM "scott".emp AS subord2
                   WHERE
                           subord2.mgr =
                           subord.empno), 0))
        FROM   "scott".emp AS subord
        WHERE  subord.mgr = bosses.empno) AS deep2sal
FROM   "scott".emp AS bosses;

select sal
from "scott".emp
where empno IN (
  select deptno
  from "scott".dept
  where emp.job = dept.dname);

select TJOIN1.RNUM, TJOIN1.C1,
  case when 10 in ( select C1 from ( values (1) ) T(C1) ) then 'yes' else 'no' end C3
from (
  values (0, 10, 15),
    (1, 20, 25),
    (2, cast(NULL as integer), 50)) TJOIN1 (RNUM, C1, C2);

SELECT *
FROM "scott".emp
WHERE job in (select job from "scott".emp ee where ee.hiredate = DATE '1980-12-17')
OR EXISTS (select * from "scott".emp e where emp.deptno = e.deptno + 20);

select empno
from "scott".emp
where not (empno not in (select empno from "scott".emp)
  and empno not in (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
                    15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25))
and empno in (7876, 7698, 7900);

select empno
from "scott".emp
where (empno in (select empno from "scott".emp)
      and empno in (7876, 7698, 7900))
and empno in (7876, 7698, 7900);

select sal,
  123 IN (
    select cast(null as int)
    from "scott".dept)
from "scott".emp;

select sal,
  cast(null as int) IN (
    select deptno
    from "scott".dept)
from "scott".emp;

select sal,
  10 IN (
    select deptno
    from "scott".dept)
from "scott".emp;

select sal,
  cast(null as int) NOT IN (
    select cast(null as int)
    from "scott".dept)
from "scott".emp;

select sal,
  cast(null as int) NOT IN (
    select 1
    from "scott".dept)
from "scott".emp;

select sal,
  cast(null as int) NOT IN (
    select case when deptno > 0 then deptno else null end
    from "scott".dept)
from "scott".emp;

select sal,
  10 NOT IN (
    select case when deptno > 0 then deptno else null end
    from "scott".dept)
from "scott".emp;

select sal from "scott".emp
  where cast(null as int) IN (
    select cast(null as int)
    from "scott".dept);

select sal from "scott".emp
  where cast(null as int) IN (
    select 1
    from "scott".dept);

select sal from "scott".emp
  where cast(null as int) IN (
    select case when deptno > 0 then deptno else null end
    from "scott".dept);

select sal from "scott".emp
  where 10 IN (
    select case when deptno > 0 then deptno else null end
    from "scott".dept);

select sal from "scott".emp
  where 123 NOT IN (
    select cast(null as int)
    from "scott".dept);

select sal from "scott".emp
  where cast(null as int) NOT IN (
    select deptno
    from "scott".dept);

select sal from "scott".emp
  where 10 NOT IN (
    select deptno
    from "scott".dept);

select sal from "scott".emp
  where cast(null as int) IN (
    select deptno
    from "scott".dept) is unknown;

select sal from "scott".emp e
  where 123 IN (
    select cast(null as int)
    from "scott".dept d where e.deptno=d.deptno);

select sal from "scott".emp e
  where cast(null as int) IN (
    select deptno
    from "scott".dept d where e.deptno=d.deptno);

select sal from "scott".emp e
  where cast(null as int) IN (
    select case when deptno > 0 then deptno else null end
    from "scott".dept d where e.deptno=d.deptno);

select sal from "scott".emp e
  where 10 IN (
    select case when deptno > 0 then deptno else null end
    from "scott".dept d where e.deptno=d.deptno);

select sal from "scott".emp e
  where 123 NOT IN (
    select cast(null as int)
    from "scott".dept d where e.deptno=d.deptno);

select sal from "scott".emp e
  where cast(null as int) NOT IN (
    select deptno
    from "scott".dept d where e.deptno=d.deptno);

select sal from "scott".emp e
  where 10 NOT IN (
    select deptno
    from "scott".dept d where e.deptno=d.deptno);

select sal from "scott".emp e
  where cast(null as int) IN (
    select deptno
    from "scott".dept d where e.deptno=d.deptno) is unknown;

select sal,
  20 IN (
    select case when deptno > 10 then deptno else null end
    from "scott".dept
    where deptno < 0)
from "scott".emp;

select * from emp where deptno IN (select (select max(deptno) from "scott".emp t1) from "scott".emp t2);

select * from emp as e1 where empno in (select empno from emp e2);

select * from emp as e1 where deptno not in (select coalesce(deptno, 0) from emp e2);

select empno from "scott".emp as e
where e.empno > ANY(
  select 2 from "scott".dept e2 where e2.deptno = e.deptno);

select ename
from "scott".emp as e1
where exists
    (select 1 from "scott".emp as e2 where coalesce(e1.mgr,0)=coalesce(e2.mgr,0));

select empno, empno <> some (select emp2.empno from "scott".emp emp2 where emp2.empno = emp1.empno) as x
from "scott".emp emp1;

select *, empno <> some (select comm from "scott".emp where deptno = emp1.deptno) as x
from "scott".emp as emp1;

select *, empno <> some (select 2 from "scott".dept dept1 where dept1.deptno = emp1.empno) as x
from "scott".emp as emp1;

select *, comm <> some (select 2 from "scott".dept dept1 where dept1.deptno = emp1.empno) as x
from "scott".emp as emp1;

select *, emp1.comm <> some (select comm from "scott".emp where sal = emp1.sal) as x
from "scott".emp emp1;

select empno, comm in (select comm from emp where deptno = 30) as s,
  comm = all (select comm from emp where empno = 7499) as a
from emp where deptno = 30;

WITH tb as (select array(SELECT * FROM (VALUES (TRUE), (NULL)) as x(a)) as a)
SELECT TRUE = ALL (
    SELECT b
    FROM UNNEST(a) AS x1(b)
) AS test
FROM tb;

select deptno, unique (select comm from "scott".emp where comm is not null) as u
from "scott".dept;

select deptno
from "scott".dept
where unique (select comm from "scott".emp);

select deptno
from "scott".dept
where unique (select comm from "scott".emp where comm is null);

select deptno
from "scott".dept
where unique (select comm, sal from "scott".emp where comm is not null);

select deptno
from "scott".dept
where unique (select comm, sal from "scott".emp);

select deptno
from "scott".dept
where unique (select deptno from "scott".emp);

select deptno
from "scott".dept
where unique (select deptno, sal from "scott".emp where sal = 3000);

select deptno, not unique (select deptno, sal from "scott".emp where sal = 3000) as u
from "scott".dept;

select deptno, unique (select deptno from "scott".emp where deptno = 35) as u
from "scott".dept;

select *
from "scott".dept
where unique (select deptno from "scott".emp limit 1);

select deptno
from "scott".dept
where unique (select job from "scott".emp group by job);

select *, unique (select 1 from "scott".emp where dept.deptno = emp.deptno) as u
from "scott".dept;

select *, not unique (select 1 from "scott".emp where dept.deptno = emp.deptno) as u
from "scott".dept;

select *, comm in (300, 500, null) as i from "scott".emp;

select *, comm not in (300, 500, null) as i from "scott".emp;

select * from "scott".emp where empno in (null);

select * from "scott".emp where empno not in (null);

SELECT empno, ename, mgr FROM "scott".emp WHERE (7782, 7839) IN ((empno, mgr), (mgr, empno));

select * from "scott".emp where empno not in (null, 7782);

select * from "scott".emp where (mgr, deptno) not in ((1, 2), (3, null), (cast(null as integer), cast(null as integer)));

select * from "scott".emp where (empno, deptno) not in ((7369, 20), (7499, 30));

select *
from dept as d
where EXISTS (select count(*) from emp e where d.deptno = e.deptno and 1 = 2);

select *
from dept as d
where NOT EXISTS (select count(*) from emp e having false);

SELECT ARRAY(SELECT s.x) FROM (SELECT 1 as x) s;

select empno from "scott".emp as e
where 10 in (
  select deptno from "scott".dept where dname = 'FAKE-DEPT')
or 20 in (
  select deptno from "scott".dept where dname = 'RESEARCH');

select deptno in (select deptno from emp) is true
from emp;

select ename, deptno
from emp
where deptno in (select deptno
  from "scott".dept
  where "scott".dept.deptno > 20);

select *
from "scott".emp as e
where exists (
  select empno
  from "scott".emp as ee
  where e.empno = ee.empno or e.comm >= ee.sal
);

SELECT
  i1.COMM,
  i1.COMM = ANY(SELECT COMM FROM EMP WHERE COMM=i1.COMM)
FROM EMP i1 ORDER BY COMM;

SELECT deptno
FROM dept d
WHERE 'Regular' IN (
    SELECT CASE WHEN SUM(sal) > 10 then 'VIP' else 'Regular' END expr
    FROM emp e
    WHERE d.deptno = e.deptno
);

SELECT d1.dname, d1.deptno + (
  SELECT max(e1.empno)
  FROM emp e1
  WHERE d1.deptno = e1.deptno and
        e1.sal = (
          SELECT max(sal)
          FROM emp e2
          WHERE e1.sal = e2.sal and
                e1.deptno = e2.deptno and
                d1.deptno <= e2.deptno))
FROM dept d1;

SELECT deptno FROM dept d1 WHERE EXISTS (
 SELECT 1 FROM dept d2 WHERE d2.deptno = d1.deptno and EXISTS (
  SELECT 1 FROM dept d3 WHERE d3.dname = d1.dname));

SELECT e1.*
FROM emp e1
JOIN dept d
  ON e1.deptno = d.deptno
  AND d.deptno IN (
    SELECT e3.empno
    FROM emp e3
    WHERE d.deptno > e3.comm
  )
ORDER BY e1.empno, e1.deptno;

SELECT e1.*
FROM emp e1
LEFT JOIN dept d
  ON e1.deptno = d.deptno
  AND e1.empno IN (
    SELECT e3.empno
    FROM emp e3
    WHERE e1.comm > e3.comm
  )
ORDER BY e1.empno, e1.deptno;

SELECT empno
FROM emp e
FULL JOIN dept d
  ON e.deptno = d.deptno
 AND e.sal < (
    SELECT MAX(e2.sal)
    FROM emp e2
    WHERE e2.deptno = d.deptno
  )
ORDER BY empno;

SELECT empno
FROM emp e
FULL JOIN dept d
  ON e.deptno = d.deptno
 AND d.deptno <= ALL (
    SELECT d2.deptno
    FROM dept d2
    WHERE d2.dname <> d.dname
  )
ORDER BY empno;

SELECT map(SELECT empno, deptno from emp where empno = 7369);

SELECT array(SELECT empno FROM emp);

SELECT array(SELECT empno FROM emp WHERE empno > 7800 ORDER BY empno DESC);

WITH agg_sal AS
 (SELECT deptno, sum(sal) AS total FROM emp GROUP BY deptno)
SELECT 1 FROM agg_sal s1
WHERE s1.total > (SELECT avg(total) FROM agg_sal s2 WHERE s1.deptno = s2.deptno);

select comm, comm in (500, 300, 0) from emp;

select empno, (empno, empno) in ((7369, 7369), (7499, 7499), (7521, 7521)) from emp;

select comm, (comm, comm) in ((500, 500), (300, 300), (0, 0), (null , null)) from emp;

select *
from dept
where cast(deptno as bigint) in (select deptno from dept);

select *
from emp
where cast(empno - 7349 as smallint)  in (select deptno from emp) and ename = 'SMITH';

select *
from emp
where empno in (select cast(deptno + 7349 as bigint) from emp);

select deptno, deptno > some(select deptno from dept where false) from emp;

select * from emp where deptno > any(select deptno from dept where false);

select * from emp where unique (select deptno from dept where false);

select * from emp where not unique (select deptno from dept where false);

select deptno from emp where deptno not in (50, 20);

select * from emp where exists (select count(deptno) from dept where dept.deptno = emp.deptno and 1 = 2);

select * from emp where deptno <> (select count(deptno) + 10  from dept where dept.deptno = emp.deptno and 1 = 2);

SELECT deptno, ename, job, sal,
    sal / (SELECT SUM(sal) FROM Emp WHERE deptno = e.deptno) AS pct_dept
FROM Emp AS e
WHERE job = 'CLERK'
ORDER BY deptno;

select d.dname,
  (select count(*)
   from emp e
   where e.deptno = d.deptno
   and e.sal > (
     select min(s.losal)
     from (VALUES (1, 700, 1200), (2, 1201, 1400), (3, 1401, 2000), (4, 2001, 3000), (5, 3001, 9999)) AS s(grade, losal, hisal)
     where e.sal BETWEEN s.losal AND s.hisal
     and s.hisal > d.deptno * 10
   )
  ) as high_paid_count
from dept d
order by d.dname;

select d.deptno
from dept d
where exists (
  select 1
  from emp e
  where e.deptno = d.deptno
  and exists (
    select 1
    from (VALUES (1, 700, 1200), (2, 1201, 1400), (3, 1401, 2000), (4, 2001, 3000), (5, 3001, 9999)) AS s(grade, losal, hisal)
    where s.grade = 1
    and s.hisal >= e.sal
    and s.losal <= d.deptno * 20
  )
)
order by d.deptno;

select e.ename
from emp e
where exists (
  select 1
  from dept d
  join emp e2 on d.deptno = e2.deptno
  where d.deptno = e.deptno
  and exists (
    select 1
    from (values (10), (20), (30)) as v(deptno)
    where v.deptno = e2.deptno
    and v.deptno = e.deptno
  )
  and e2.empno = e.empno
)
order by e.ename;

SELECT deptno
FROM emp e
WHERE EXISTS
    (SELECT *
    FROM dept d
    WHERE EXISTS
        (SELECT *
        FROM bonus b
        WHERE b.ename = e.ename
        AND d.deptno = e.deptno));

WITH t0(t0a, t0b) AS (VALUES (1, 1), (1, 2), (2, 1), (2, 2), (2, 0)),
     t1(t1a, t1b, t1c) AS (VALUES (1, 1, 3)),
     t2(t2a, t2b, t2c) AS (VALUES (1, 1, 5), (2, 2, 7))
SELECT t0a
FROM t0 e
WHERE EXISTS
    (SELECT *
    FROM t1 d
    WHERE EXISTS
        (SELECT *
        FROM t2 b
        WHERE b.t2b = e.t0b
        AND d.t1a = e.t0a));

SELECT *,
    (SELECT COUNT(*)
    FROM
        (
        SELECT empno, ename, job, comm
        FROM emp
        WHERE emp.deptno = dept.deptno
        ORDER BY empno LIMIT 1
        ) AS sub
    GROUP BY sub.comm
    ) AS num_dept_groups
FROM dept;

select * from (values (2,2), (2,2)) as t(c,d)
cross join lateral
(select c,a*c as f from (values 2) as s(a)
where c+d=a*c);

SELECT d.dname
FROM dept d
WHERE EXISTS (
  SELECT 1
  FROM emp e
  WHERE e.deptno = d.deptno
  AND (
    SELECT SUM(x)
    FROM (
        SELECT COUNT(*) as x
        FROM bonus b
        WHERE b.ename = e.ename
        UNION ALL
        SELECT COUNT(*) as x
        FROM emp e2
        WHERE e2.deptno = d.deptno
    ) t
  ) > 5
);

SELECT ename,
    (SELECT sum(c)
    FROM
        (SELECT deptno AS c
        FROM dept
        WHERE dept.deptno = emp.deptno
        UNION ALL
        SELECT 2 AS c
        FROM bonus
        WHERE bonus.job = emp.job) AS union_subquery
    ) AS correlated_sum
FROM emp
ORDER BY ename;

WITH t0(t0a, t0b) AS (VALUES (1, 1), (2, 0)),
     t1(t1a, t1b, t1c) AS (VALUES (1, 1, 3)),
     t2(t2a, t2b, t2c) AS (VALUES (1, 1, 5), (2, 2, 7))
SELECT t0a, (SELECT sum(c) FROM
  (SELECT t1c as c
  FROM   t1
  WHERE  t1a = t0a
  UNION ALL
  SELECT t2c as c
  FROM   t2
  WHERE  t2b = t0b) as tmp
)
FROM t0;

WITH t0(t0a, t0b) AS (VALUES (1, 1), (2, 0)),
     t1(t1a, t1b, t1c) AS (VALUES (1, 1, 3)),
     t2(t2a, t2b, t2c) AS (VALUES (1, 1, 5), (2, 2, 7))
SELECT t0a, (SELECT sum(c) FROM
  (SELECT t1c as c
  FROM   t1
  WHERE  t1a = t0a
  UNION ALL
  SELECT t2c as c
  FROM   t2
  WHERE  t2a = t0a) as tmp
)
FROM t0;

WITH t0(t0a, t0b) AS (VALUES (1, 1), (2, 0)),
     t1(t1a, t1b, t1c) AS (VALUES (1, 1, 3)),
     t2(t2a, t2b, t2c) AS (VALUES (1, 1, 5), (2, 2, 7))
SELECT t0a, (SELECT sum(t1c) FROM
  (SELECT t1c
  FROM   t1
  WHERE  t1a = t0a
  UNION ALL
  SELECT t2c
  FROM   t2
  WHERE  t2b = t0b) as tmp
)
FROM t0;

WITH t0(t0a, t0b) AS (VALUES (1, 1), (2, 0)),
     t1(t1a, t1b, t1c) AS (VALUES (1, 1, 3)),
     t2(t2a, t2b, t2c) AS (VALUES (1, 1, 5), (2, 2, 7))
SELECT t0a, (SELECT sum(d) FROM
  (SELECT t1a - t0a as d
  FROM   t1
  UNION ALL
  SELECT t2a - t0a as d
  FROM   t2) as tmp
)
FROM t0;

WITH t0(t0a, t0b) AS (VALUES (1, 1), (2, 0)),
     t1(t1a, t1b, t1c) AS (VALUES (1, 1, 3)),
     t2(t2a, t2b, t2c) AS (VALUES (1, 1, 5), (2, 2, 7))
SELECT * FROM t0 WHERE t0a <
(SELECT sum(c) FROM
  (SELECT t1c as c
  FROM   t1
  WHERE  t1a = t0a
  UNION DISTINCT
  SELECT t2c as c
  FROM   t2
  WHERE  t2b = t0b) as tmp
);

WITH t0(t0a, t0b) AS (VALUES (1, 1), (2, 0)),
     t1(t1a, t1b, t1c) AS (VALUES (1, 1, 3)),
     t2(t2a, t2b, t2c) AS (VALUES (1, 1, 5), (2, 2, 7))
SELECT t0a, (SELECT sum(c) FROM
  (SELECT t1c as c
  FROM   t1
  WHERE  t1a > t0a
  UNION DISTINCT
  SELECT t2c as c
  FROM   t2
  WHERE  t2b <= t0b) as tmp
)
FROM t0;

WITH t0(t0a, t0b) AS (VALUES (1, 1), (2, 0)),
     t1(t1a, t1b, t1c) AS (VALUES (1, 1, 3)),
     t2(t2a, t2b, t2c) AS (VALUES (1, 1, 5), (2, 2, 7))
SELECT t0a, (SELECT count(t1c) FROM
  (SELECT t1c
  FROM   t1
  WHERE  t1a = t0a
  UNION DISTINCT
  SELECT t2c
  FROM   t2
  WHERE  t2b = t0b) as tmp
)
FROM t0;

WITH t0(t0a, t0b) AS (VALUES (1, 1), (2, 0)),
     t1(t1a, t1b, t1c) AS (VALUES (1, 1, 3)),
     t2(t2a, t2b, t2c) AS (VALUES (1, 1, 5), (2, 2, 7))
SELECT t0a, (SELECT sum(c) FROM
  (SELECT t1c as c
  FROM   t1
  WHERE  t1a = t0a
  INTERSECT ALL
  SELECT t2c as c
  FROM   t2
  WHERE  t2b = t0b) as tmp
)
FROM t0;

WITH t0(t0a, t0b) AS (VALUES (1, 1), (2, 0)),
     t1(t1a, t1b, t1c) AS (VALUES (1, 1, 3)),
     t2(t2a, t2b, t2c) AS (VALUES (1, 1, 5), (2, 2, 7))
SELECT t0a, (SELECT sum(c) FROM
  (SELECT t1c as c
  FROM   t1
  WHERE  t1a = t0a
  INTERSECT ALL
  SELECT t2c as c
  FROM   t2
  WHERE  t2a = t0a) as tmp
)
FROM t0;

WITH t0(t0a, t0b) AS (VALUES (1, 1), (2, 0)),
     t1(t1a, t1b, t1c) AS (VALUES (1, 1, 3)),
     t2(t2a, t2b, t2c) AS (VALUES (1, 1, 5), (2, 2, 7))
SELECT t0a, (SELECT sum(t1c) FROM
  (SELECT t1c
  FROM   t1
  WHERE  t1a = t0a
  INTERSECT ALL
  SELECT t2c
  FROM   t2
  WHERE  t2b = t0b) as tmp
)
FROM t0;

WITH t0(t0a, t0b) AS (VALUES (1, 1), (2, 0)),
     t1(t1a, t1b, t1c) AS (VALUES (1, 1, 3)),
     t2(t2a, t2b, t2c) AS (VALUES (1, 1, 5), (2, 2, 7))
SELECT t0a, (SELECT sum(d) FROM
  (SELECT t1a - t0a as d
  FROM   t1
  INTERSECT ALL
  SELECT t2a - t0a as d
  FROM   t2) as tmp
)
FROM t0;

WITH t0(t0a, t0b) AS (VALUES (1, 1), (2, 0)),
     t1(t1a, t1b, t1c) AS (VALUES (1, 1, 3)),
     t2(t2a, t2b, t2c) AS (VALUES (1, 1, 5), (2, 2, 7))
SELECT * FROM t0 WHERE t0a <
(SELECT sum(c) FROM
  (SELECT t1c as c
  FROM   t1
  WHERE  t1a = t0a
  INTERSECT DISTINCT
  SELECT t2c as c
  FROM   t2
  WHERE  t2b = t0b) as tmp
);

WITH t0(t0a, t0b) AS (VALUES (1, 1), (2, 0)),
     t1(t1a, t1b, t1c) AS (VALUES (1, 1, 3)),
     t2(t2a, t2b, t2c) AS (VALUES (1, 1, 5), (2, 2, 7))
SELECT t0a, (SELECT sum(c) FROM
  (SELECT t1c as c
  FROM   t1
  WHERE  t1a > t0a
  INTERSECT DISTINCT
  SELECT t2c as c
  FROM   t2
  WHERE  t2b <= t0b) as tmp
)
FROM t0;

WITH t0(t0a, t0b) AS (VALUES (1, 1), (2, 0)),
     t1(t1a, t1b, t1c) AS (VALUES (1, 1, 3)),
     t2(t2a, t2b, t2c) AS (VALUES (1, 1, 5), (2, 2, 7))
SELECT t0a, (SELECT count(t1c) FROM
  (SELECT t1c
  FROM   t1
  WHERE  t1a = t0a
  INTERSECT DISTINCT
  SELECT t2c
  FROM   t2
  WHERE  t2b = t0b) as tmp
)
FROM t0;

WITH t0(t0a, t0b) AS (VALUES (1, 1), (2, 0)),
     t1(t1a, t1b, t1c) AS (VALUES (1, 1, 3)),
     t2(t2a, t2b, t2c) AS (VALUES (1, 1, 5), (2, 2, 7))
SELECT t0a, (SELECT sum(c) FROM
  (SELECT t1c as c
  FROM   t1
  WHERE  t1a = t0a
  EXCEPT ALL
  SELECT t2c as c
  FROM   t2
  WHERE  t2b = t0b) as tmp
)
FROM t0;

WITH t0(t0a, t0b) AS (VALUES (1, 1), (2, 0)),
     t1(t1a, t1b, t1c) AS (VALUES (1, 1, 3)),
     t2(t2a, t2b, t2c) AS (VALUES (1, 1, 5), (2, 2, 7))
SELECT t0a, (SELECT sum(c) FROM
  (SELECT t1c as c
  FROM   t1
  WHERE  t1a = t0a
  EXCEPT ALL
  SELECT t2c as c
  FROM   t2
  WHERE  t2a = t0a) as tmp
)
FROM t0;

WITH t0(t0a, t0b) AS (VALUES (1, 1), (2, 0)),
     t1(t1a, t1b, t1c) AS (VALUES (1, 1, 3)),
     t2(t2a, t2b, t2c) AS (VALUES (1, 1, 5), (2, 2, 7))
SELECT t0a, (SELECT sum(t1c) FROM
  (SELECT t1c
  FROM   t1
  WHERE  t1a = t0a
  EXCEPT ALL
  SELECT t2c
  FROM   t2
  WHERE  t2b = t0b) as tmp
)
FROM t0;

WITH t0(t0a, t0b) AS (VALUES (1, 1), (2, 0)),
     t1(t1a, t1b, t1c) AS (VALUES (1, 1, 3)),
     t2(t2a, t2b, t2c) AS (VALUES (1, 1, 5), (2, 2, 7))
SELECT t0a, (SELECT sum(d) FROM
  (SELECT t1a - t0a as d
  FROM   t1
  EXCEPT ALL
  SELECT t2a - t0a as d
  FROM   t2) as tmp
)
FROM t0;

WITH t0(t0a, t0b) AS (VALUES (1, 1), (2, 0)),
     t1(t1a, t1b, t1c) AS (VALUES (1, 1, 3)),
     t2(t2a, t2b, t2c) AS (VALUES (1, 1, 5), (2, 2, 7))
SELECT * FROM t0 WHERE t0a <
(SELECT sum(c) FROM
  (SELECT t1c as c
  FROM   t1
  WHERE  t1a = t0a
  EXCEPT DISTINCT
  SELECT t2c as c
  FROM   t2
  WHERE  t2b = t0b) as tmp
);

WITH t0(t0a, t0b) AS (VALUES (1, 1), (2, 0)),
     t1(t1a, t1b, t1c) AS (VALUES (1, 1, 3)),
     t2(t2a, t2b, t2c) AS (VALUES (1, 1, 5), (2, 2, 7))
SELECT t0a, (SELECT sum(c) FROM
  (SELECT t1c as c
  FROM   t1
  WHERE  t1a > t0a
  EXCEPT DISTINCT
  SELECT t2c as c
  FROM   t2
  WHERE  t2b <= t0b) as tmp
)
FROM t0;

WITH t0(t0a, t0b) AS (VALUES (1, 1), (2, 0)),
     t1(t1a, t1b, t1c) AS (VALUES (1, 1, 3)),
     t2(t2a, t2b, t2c) AS (VALUES (1, 1, 5), (2, 2, 7))
SELECT t0a, (SELECT count(t1c) FROM
  (SELECT t1c
  FROM   t1
  WHERE  t1a = t0a
  EXCEPT DISTINCT
  SELECT t2c
  FROM   t2
  WHERE  t2b = t0b) as tmp
)
FROM t0;

SELECT
  E1.*
FROM
  EMP E1
WHERE
  E1.EMPNO = (
    SELECT D1.DEPTNO FROM DEPT D1
    WHERE E1.ENAME IN (SELECT B1.ENAME FROM BONUS B1));

SELECT E1.ENAME
FROM EMP E1
WHERE EXISTS (
    SELECT 1
    FROM DEPT D
    LEFT JOIN BONUS B
    ON D.LOC = 'NEW YORK' OR B.JOB = E1.JOB
);

SELECT E1.EMPNO, E1.SAL
FROM EMP E1
WHERE E1.COMM > (
    SELECT COUNT(*)
    FROM BONUS B
    LEFT JOIN DEPT D
    ON B.SAL > E1.SAL AND D.DEPTNO = 10
);

SELECT E1.ENAME
FROM EMP E1
WHERE EXISTS (
    SELECT 1
    FROM DEPT D
    LEFT JOIN BONUS B
    ON D.DNAME = B.ENAME AND B.JOB = E1.JOB
    WHERE B.ENAME IS NULL
);

SELECT E1.ENAME
FROM EMP E1
WHERE E1.SAL IN (
    SELECT B.SAL
    FROM BONUS B
    JOIN DEPT D
    ON D.DEPTNO = E1.DEPTNO
    AND B.SAL = (CASE WHEN E1.COMM IS NULL THEN 0 ELSE E1.COMM END + 100)
);

SELECT E1.*
FROM EMP E1
WHERE NOT EXISTS (
    SELECT 1
    FROM EMP E2
    JOIN BONUS B
    ON E2.SAL = E1.SAL AND B.JOB = E1.JOB
    WHERE E2.EMPNO <> E1.EMPNO
);

WITH t0(t0a, t0b) AS (VALUES (1, 1), (2, 0)),
     t1(t1a, t1b, t1c) AS (VALUES (1, 1, 3)),
     t2(t2a, t2b, t2c) AS (VALUES (1, 1, 5), (2, 2, 7))
SELECT * FROM t0 WHERE t0a <
(SELECT sum(t1c) FROM
  (SELECT t1c
  FROM  t1 LEFT JOIN t2 ON (t1a = t0a AND t2b = t0b))
);

SELECT deptno, ename
FROM
  (SELECT DISTINCT deptno FROM emp) t1,
  LATERAL (
    SELECT ename, sal
    FROM emp
    WHERE deptno = t1.deptno
    ORDER BY sal
    DESC LIMIT 3) s;

SELECT *
FROM dept d
WHERE d.deptno IN (
  SELECT e.deptno
  FROM emp e
  WHERE d.deptno = e.deptno
  LIMIT 10
  OFFSET 2
)
LIMIT 2
OFFSET 1;

SELECT *
FROM dept d
WHERE d.deptno IN (
  SELECT e.deptno
  FROM emp e
  WHERE d.deptno = e.deptno
  OFFSET 2
)
OFFSET 1;

SELECT *
FROM dept d
JOIN LATERAL (
  SELECT *
  FROM emp e
  WHERE e.deptno = d.deptno
  OFFSET 2
) s ON TRUE;

SELECT *
FROM dept d
WHERE (
  SELECT SUM(e.sal)
  FROM emp e
  WHERE e.deptno = d.deptno
  OFFSET 2
) > 2;

SELECT e.ename
FROM   emp e
JOIN LATERAL (
  SELECT MAX(d.deptno) AS a
  FROM   dept d
  WHERE  d.deptno = e.deptno
  GROUP  BY d.loc
  ORDER  BY d.loc
  OFFSET 1
) s ON TRUE;

SELECT e.ename
FROM   emp e
WHERE  EXISTS (
  SELECT MAX(d.deptno) AS a
  FROM   dept d
  WHERE  d.deptno = e.deptno
  GROUP  BY d.loc
  ORDER  BY d.loc
  LIMIT 2
  OFFSET 1
);

SELECT *
FROM dept d
WHERE EXISTS (
  SELECT *
  FROM emp e
  WHERE e.deptno = d.deptno
  LIMIT 1
  OFFSET 2
);

SELECT e.ename,
  (SELECT ROW_NUMBER() OVER (PARTITION BY e.deptno ORDER BY e.empno, d.deptno)
   FROM dept d
   WHERE e.deptno = d.deptno) AS rn
FROM emp e
ORDER BY e.empno;

SELECT e.ename, d.deptno, d.rn
FROM emp e
JOIN LATERAL (
  SELECT d.deptno,
    ROW_NUMBER() OVER (PARTITION BY e.deptno ORDER BY e.empno, d.deptno) AS rn
  FROM dept d
  WHERE e.deptno = d.deptno
) d ON TRUE
ORDER BY e.empno;

WITH bonus(ENAME, JOB, SAL, COMM) AS (
  VALUES ('ALLEN', 'SALESMAN', 1600.00, 300.00),
         ('WARD', 'SALESMAN', 1250.00, 500.00)
)
SELECT *
FROM BONUS
WHERE EXISTS(SELECT RANK() OVER (PARTITION BY hiredate ORDER BY sal) AS s
                    FROM EMP, DEPT where EMP.deptno = DEPT.deptno
                        AND DEPT.dname < BONUS.ENAME);

create view calcite_7584_t1 as
select * from (values
  ('val1a', cast(6 as smallint), 8, cast(10 as bigint)),
  ('val1b', cast(8 as smallint), 16, cast(19 as bigint)),
  ('val1a', cast(16 as smallint), 12, cast(21 as bigint)),
  ('val1a', cast(16 as smallint), 12, cast(10 as bigint)),
  ('val1c', cast(8 as smallint), 16, cast(19 as bigint)),
  ('val1d', cast(null as smallint), 16, cast(22 as bigint)),
  ('val1d', cast(null as smallint), 16, cast(19 as bigint)),
  ('val1e', cast(10 as smallint), cast(null as integer), cast(25 as bigint)),
  ('val1e', cast(10 as smallint), cast(null as integer), cast(19 as bigint)),
  ('val1d', cast(10 as smallint), cast(null as integer), cast(12 as bigint)),
  ('val1a', cast(6 as smallint), 8, cast(10 as bigint)),
  ('val1e', cast(10 as smallint), cast(null as integer), cast(19 as bigint))
) as t(t1a, t1b, t1c, t1d);

create view calcite_7584_t3 as
select * from (values
  ('val3a', cast(6 as smallint), 12, cast(110 as bigint)),
  ('val3a', cast(6 as smallint), 12, cast(10 as bigint)),
  ('val1b', cast(10 as smallint), 12, cast(219 as bigint)),
  ('val1b', cast(10 as smallint), 12, cast(19 as bigint)),
  ('val1b', cast(8 as smallint), 16, cast(319 as bigint)),
  ('val1b', cast(8 as smallint), 16, cast(19 as bigint)),
  ('val3c', cast(17 as smallint), 16, cast(519 as bigint)),
  ('val3c', cast(17 as smallint), 16, cast(19 as bigint)),
  ('val1b', cast(null as smallint), 16, cast(419 as bigint)),
  ('val1b', cast(null as smallint), 16, cast(19 as bigint)),
  ('val3b', cast(8 as smallint), cast(null as integer), cast(719 as bigint)),
  ('val3b', cast(8 as smallint), cast(null as integer), cast(19 as bigint))
) as t(t3a, t3b, t3c, t3d);

SELECT 1
FROM calcite_7584_t1 t1
WHERE t1b < (SELECT SUM(t2b) OVER (PARTITION BY t2c ORDER BY t2d) AS s
               FROM calcite_7584_t2 t2 WHERE t2.t2d = t1.t1d
             ORDER BY s DESC
             LIMIT 1);

SELECT 1
FROM calcite_7584_t1 t1
WHERE t1b < (SELECT SUM(t2b) OVER (PARTITION BY t2c ORDER BY t2d) AS s
               FROM calcite_7584_t2 t2 WHERE t2.t2d <= t1.t1d
             ORDER BY s DESC
             LIMIT 1);

SELECT t1b
FROM calcite_7584_t1 t1
WHERE t1b > (SELECT MAX(tmp.s) FROM (
             SELECT RANK() OVER (PARTITION BY t3c, t3d ORDER BY t3c) AS s
               FROM (SELECT t3b, t3c, MAX(t3d) AS t3d
                       FROM calcite_7584_t3 t3 GROUP BY t3b, t3c) AS g) AS tmp)
ORDER BY t1b;

SELECT t1a
FROM calcite_7584_t1 t1
WHERE t1b IN (SELECT RANK() OVER (PARTITION BY t3c ORDER BY t2b) AS s
              FROM calcite_7584_t2 t2, calcite_7584_t3 t3
              WHERE t2.t2c = t3.t3c AND t2.t2a < t1.t1a);

SELECT empno
      FROM emp AS e
      LEFT JOIN dept AS d
        ON d.deptno = e.deptno
          AND (EXISTS (
            SELECT e2.deptno FROM emp AS e2
            WHERE e2.deptno = d.deptno
            GROUP BY e2.deptno
            HAVING SUM(e2.sal) > 1000000));

CREATE TABLE a (
  deptno INTEGER NOT NULL,
  ename VARCHAR(10)
);

INSERT INTO a VALUES
  (10, 'ALLEN'),
  (20, 'WARD'),
  (30, 'WARD'),
  (40, 'SMITH');

SELECT deptno
FROM b as b1
WHERE deptno NOT IN (
    SELECT deptno
    FROM a
    WHERE deptno = b1.deptno AND ename = 'WARD' AND b1.ename = 'WARD'
);

SELECT deptno
FROM b as a
WHERE deptno NOT IN (
    SELECT deptno
    FROM a as a2
    WHERE deptno = a.deptno AND ename = 'WARD' AND a.ename = 'WARD'
);

SELECT
    d.dname,
    (
        SELECT COUNT(sub.empno)
        FROM (
            SELECT * FROM emp e2 WHERE e2.deptno = d.deptno
        ) sub
        RIGHT JOIN emp e
        ON sub.mgr = e.mgr
    ) as matched_subordinate_count
FROM dept d;

SELECT * FROM dept d
WHERE NOT EXISTS (
    SELECT 1
    FROM emp e
    LEFT JOIN (
        SELECT * FROM emp e3 WHERE e3.deptno = d.deptno
    ) foo
    ON e.empno = foo.mgr
);

SELECT * FROM dept d
WHERE NOT EXISTS (
    SELECT 1
    FROM (
        SELECT * FROM emp e3 WHERE e3.deptno = d.deptno
    ) foo
    FULL JOIN emp e
    ON foo.mgr = e.empno
);

SELECT empno FROM emp e1
WHERE EXISTS (
    SELECT 1
    FROM dept d
    LEFT JOIN (
        SELECT * FROM emp e2
        WHERE e2.sal > (e1.sal + COALESCE(e1.comm, 0))
    ) foo
    ON d.deptno = foo.deptno
);

SELECT empno FROM emp e1
WHERE EXISTS (
    SELECT 1
    FROM (
        SELECT * FROM emp e2
        WHERE e2.sal > (e1.sal + COALESCE(e1.comm, 0))
    ) foo
    FULL JOIN dept d
    ON foo.deptno = d.deptno
);

SELECT d.deptno
FROM dept d
WHERE EXISTS (
    SELECT 1
    FROM (
        SELECT deptno FROM emp WHERE deptno = d.deptno
    ) foo
    RIGHT JOIN emp e
    ON TRUE
    WHERE foo.deptno IS NOT DISTINCT FROM d.deptno
);

SELECT * FROM dept
WHERE EXISTS (
    SELECT * FROM emp
    LEFT JOIN (
        SELECT * FROM emp e_sub
        WHERE e_sub.deptno = dept.deptno
    ) foo
    ON emp.deptno = foo.deptno
);

SELECT * FROM dept
WHERE EXISTS (
    SELECT * FROM (
        SELECT * FROM emp e_sub
        WHERE e_sub.deptno = dept.deptno
    ) foo
    FULL JOIN emp
    ON foo.deptno = emp.deptno
);

WITH
  t1(a, b, c) AS (VALUES (2, 2, 2), (3, 3, 3), (4, 4, 4)),
  t2(a, b, c) AS (VALUES (1, 1, 1), (3, 3, 3), (4, 4, 4)),
  t3(a, b, c) AS (VALUES (1, 1, 1), (2, 2, 2), (4, 4, 4))
SELECT * FROM t1 WHERE EXISTS (
SELECT * FROM (SELECT * FROM t3 WHERE t3.a = t1.a) foo
LEFT JOIN t2
ON foo.a = t2.a
);

WITH
  t1(a, b, c) AS (VALUES (2, 2, 2), (3, 3, 3), (4, 4, 4)),
  t2(a, b, c) AS (VALUES (1, 1, 1), (3, 3, 3), (4, 4, 4)),
  t3(a, b, c) AS (VALUES (1, 1, 1), (2, 2, 2), (4, 4, 4))
SELECT * FROM t1 WHERE EXISTS (
SELECT * FROM (SELECT * FROM t3 WHERE t3.a = t1.a) foo
FULL JOIN t2
ON foo.a = t2.a
);

SELECT d.deptno
FROM dept d
WHERE EXISTS (
  SELECT *
  FROM (
    SELECT *
    FROM emp e
    WHERE e.deptno = d.deptno
  ) l
  JOIN (
    SELECT *
    FROM dept d2
    WHERE d2.deptno = d.deptno
  ) r
  ON TRUE
)
ORDER BY d.deptno;

select e.ename,
  (select count(*)
    from emp as f
    where f.comm is not distinct from e.comm) as c
from emp as e;

select deptno,
  (select min(1) from emp where empno > d.deptno) as i0,
  (select min(0) from emp where deptno = d.deptno and ename = 'SMITH' and d.deptno > 0) as i1
from dept as d;

SELECT *
FROM emp e
WHERE e.ename NOT IN (
    SELECT d.dname
    FROM dept d
    WHERE e.deptno = d.deptno OR e.sal > 2000.0);

select Header.Name from ( VALUES (1, 'A'), (2, 'B')) as Header(Id, Name)
join (values (11, 1), (12, 1), (21, 2)) as Version(Id, Parent)
on not exists (select 1 from (values (11, 1), (12, 1), (21, 2)) as Version2(Id, Parent)
where Version2.Parent = Header.Id and Version2.Id > Version.Id);

select v,
  row(v, 0) in (values (1, 0), (2, cast(null as integer))) as r
from (values (1), (2), (3)) as t(v);

WITH t1(id, sal) as (VALUES (1, 10), (2, 20), (3, 30)),
t2(id, sal) as (VALUES (2, 20), (2, 200), (3, 30)),
t3(id, sal) as (VALUES (3, 30), (4, 40)),
t4(id, sal) as (VALUES (2, 200), (5, 50))
select * from
t1,
lateral(
  select t2.id, t2.sal from t2 join t3 on exists(
    select t4.id from t4 where t4.id=t1.id and t4.sal=t2.sal
  )
);

SELECT t.deptno,
  (SELECT COUNT(*) FROM emp e
   WHERE e.deptno = t.deptno AND e.sal > t.s)
FROM (SELECT deptno, SUM(sal) AS s FROM emp GROUP BY deptno) t;

SELECT E1.DEPTNO
FROM EMP E1
WHERE E1.SAL > (SELECT B1.COMM FROM BONUS B1 WHERE E1.ENAME = B1.ENAME LIMIT 2);

select
        (SELECT
          COUNT(*)
        FROM
           "scott".emp
        WHERE
           v.empno >= 2), 3
from "scott".emp as v;

with t(n, r) as (
  values (1, cast(row(10) as row(d integer))),
         (2, cast(row(20) as row(d integer)))
)
select e.n
from t e
where e.n > (
  select avg(e2.n)
  from t e2
  where (e2.r).d = (e.r).d
  and exists (
     select 1
     from (values (1, cast(row(10) as row(d integer)))) as b(k, br)
     where b.k = e2.n
     and (b.br).d = (e.r).d
  )
);

with
t(k, a) as (select * from (values (1, 10), (2, cast(null as int)), (3, 30), (4, 40), (5, cast(null as int)))),
s(k, b) as (select * from (values (1, 10), (3, cast(null as int)), (4, 41), (5, 50)))
select k, a in (select s.b from s where s.k = t.k) as i from t;

with
t(a, k) as (select * from (values (10, 1), (cast(null as int), 2), (30, 3), (40, 4), (cast(null as int), 5))),
s(k, b) as (select * from (values (1, 10), (3, cast(null as int)), (4, 41), (5, 50)))
select k from t group by k having max(a) not in (select s.b from s where s.k = t.k);

select e.ename, d.dname
from emp as e join dept as d
on e.mgr = (select max(s.mgr) from emp as s)
order by d.dname;

select e.ename, d.dname
from emp as e join dept as d
on e.deptno = d.deptno
  and e.empno in (select s.empno from emp as s where s.ename = 'SCOTT')
order by e.ename;

select e.ename, d.dname
from emp as e join dept as d
on e.deptno = d.deptno
  and e.mgr in (select s.mgr from emp as s where s.job = 'ANALYST')
order by e.ename;

select e.ename, d.dname
from emp as e join dept as d
on e.deptno = d.deptno
  and e.sal = (select max(s.sal) from emp as s where s.deptno = d.deptno)
order by e.ename;

select e.ename, d.dname
from emp as e join dept as d
on e.deptno = d.deptno
  and exists (select 1 from emp as s where s.job = 'ANALYST' and s.deptno = d.deptno)
order by e.ename;

select e.ename, d.dname
from emp as e join dept as d
on e.deptno = d.deptno
  and e.empno not in (select s.mgr from emp as s where s.deptno = d.deptno)
order by e.ename;

select e.ename, m.ename as mname
from emp as e join dept as d
on e.deptno = d.deptno
join emp as m
on m.empno = e.mgr
  and m.sal = (select max(s.sal) from emp as s where s.deptno = d.deptno)
order by e.ename;

select e.ename, d.dname
from emp as e join dept as d
on e.deptno = d.deptno
  and exists (select 1 from emp as s where s.mgr = e.empno and s.deptno = d.deptno)
order by e.ename;

select e.ename, d.dname
from emp as e join dept as d
on e.deptno = d.deptno
  and e.mgr not in (select s.mgr from emp as s where s.job = 'CLERK')
order by e.ename;

select e.ename, d.dname, m.ename as mname
from emp as e join dept as d
on e.deptno = d.deptno
  and d.deptno in (select s.deptno from emp as s where s.job = 'ANALYST')
join emp as m
on m.empno = e.mgr
  and m.sal > (select avg(s.sal) from emp as s)
order by e.ename;

select e.ename, d.dname
from emp as e join dept as d
on e.deptno = d.deptno
  and not exists (select 1 from emp as s where s.mgr = e.empno)
order by e.ename;

select e.ename, d.dname
from emp as e join dept as d
on e.deptno = d.deptno
  and e.empno in (7369, 7499, 7521, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    13, 14, 15, 16, 17, 18)
order by e.ename;

select e.ename, d.dname
from emp as e
join lateral (select * from dept as x where x.deptno = e.deptno) as d
on d.loc in (select x.loc from dept as x where x.dname <> 'SALES')
  and e.sal > (select avg(s.sal) from emp as s)
order by e.ename;

select e.ename, d.dname
from emp as e join dept as d
on e.deptno = d.deptno
  and (e.deptno, e.job) in (select s.deptno, s.job from emp as s where s.sal > 2900)
order by e.ename;

select count(*) as c
from emp as e join dept as d
on e.deptno = d.deptno
  and d.deptno in (select s.deptno from emp as s);

select e.ename, d.dname
from emp as e join dept as d
on e.deptno = d.deptno
  and e.sal > (select avg(s.sal) from emp as s)
where exists (select 1 from emp as s where s.deptno = d.deptno and s.job = 'ANALYST')
order by e.ename;

select d.dname, count(*) as c
from emp as e join dept as d
on e.deptno = d.deptno
  and e.mgr in (select s.empno from emp as s where s.job = 'MANAGER')
group by d.dname
having count(*) > (select count(*) from dept as y where y.loc = 'BOSTON')
order by d.dname;

select e.ename
from emp as e join dept as d
on e.deptno = d.deptno
  and e.sal < (select max(s.sal) from emp as s)
  and exists (select 1 from emp as s where s.mgr = e.empno)
order by e.ename;

select emp.deptno, emp.sal
from dept
join emp on emp.deptno = dept.deptno and emp.sal < (
  select avg(emp.sal)
  from emp
  where emp.deptno = dept.deptno)
order by emp.deptno, emp.sal;

SELECT empno,
  SUM(CASE WHEN deptno IN (SELECT deptno FROM dept WHERE deptno < 30) THEN 1 ELSE 0 END)
    OVER (ORDER BY empno) AS s
FROM emp
WHERE empno < 7600;

SELECT empno,
  SUM((SELECT COUNT(*) FROM emp AS e2 WHERE e2.mgr = e.empno))
    OVER (ORDER BY empno) AS s
FROM emp AS e
WHERE deptno = 20
ORDER BY empno;

SELECT empno,
  ROW_NUMBER() OVER (ORDER BY EXISTS (SELECT 1 FROM emp AS e2 WHERE e2.mgr = e.empno) DESC,
    empno) AS rn
FROM emp AS e
WHERE deptno = 20
ORDER BY empno;

SELECT empno,
  SUM(CASE WHEN EXISTS (SELECT 1 FROM emp AS e2 WHERE e2.mgr = e.empno) THEN 1 ELSE 0 END)
    OVER (PARTITION BY deptno IN (SELECT deptno FROM dept WHERE loc = 'DALLAS')
          ORDER BY empno) AS s
FROM emp AS e
ORDER BY empno;

select d.dname,
  (select max((select count(*) from emp as s where s.deptno = d.deptno)
       + (select count(*) from emp as s where s.mgr = e.empno))
   from emp as e) as c
from dept as d
order by d.dname;

select t1.ename as name,
  (select count(1) from emp t2 where t2.ename = t1.ename) as c
from emp t1
order by t1.ename;

select deptno,
  (select count(*) from
     (select count(*) as n from emp where emp.deptno = dept.deptno
      group by grouping sets ((job), (mgr), ())) as t) as g
from dept;

select deptno
from dept
where exists (select 1 from emp where sal > 10000)
  and exists (select 1 from emp where emp.deptno = dept.deptno);

select deptno,
  exists (select 1 from emp where emp.deptno = dept.deptno
          and exists (select 1 from emp where sal > 10000)) as ec
from dept;

select comm from "scott".emp tablesample system(0);

select *
from unnest(array [(1, 'a'), (2, 'b')]) as t (x, y);

select *
from UNNEST(array ['apple', 'banana']) as fruit;

select fruit
from UNNEST(array ['apple', 'banana']) as fruit;

select *
from UNNEST(array ['apple', 'banana']) as "fruit";

SELECT fruit.*
FROM (
  SELECT *
  FROM UNNEST(array ['apple', 'banana']) as x) as fruit;

SELECT fruit.*
FROM (
  SELECT *
  FROM (VALUES 'apple', 'banana') as x) as fruit;

select *
from unnest(multiset [1, 2, 1]) as v;

select upper(f)
from (values 'apple', 'banana', 'pear') as f;

select *
from unnest(array[10, 20, 30], array[1, 2, 3]) as t(a, b);

select *
from unnest(array[10, 20], array[1, 2, 3]) as t(a, b);

select *
from unnest(map['x', 10, 'y', 20], array[1, 2, 3]) as t(k, v, n);

select *
from unnest(array[10, 20, 30], array[1, 2], array['a', 'b', 'c', 'd'])
with ordinality as t(x, y, z, o);

select * from unnest(array[10, 20]) with ordinality as t(i, o);

select * from unnest
(select t.x from (values multiset[10, 20], array[30, 40]) as t(x))
 with ordinality as t(a, o);

select * from unnest(multiset[1, 2]) as t(c);

with
  x as (select * from unnest(array[100, 200]) with ordinality as t1(v, o)),
  y as (select * from unnest(array[1000, 2000]) with ordinality as t2(v, o))
select x.o as o1, x.v as v1, y.o as o2, y.v as v2
from x join y on x.o = y.o;

select *
from unnest(MAP['a', 1, 'b', 2]) with ordinality as um(k, v, i);

select * from unnest(
 select "employees" from "hr"."depts"
 where "deptno" = 10);

select d."name", e.*
from "hr"."depts" as d,
UNNEST(d."employees") as e;

select d."name", e.*
from "hr"."depts" as d,
 UNNEST(d."employees", array[1, 2]) as e (ei, d, n, s, c, i)
where ei + i > 151;

SELECT au."name"
FROM "bookstore"."authors" au
WHERE (
    SELECT COUNT(*) > 0
    FROM UNNEST(au."books") AS "unnested"("title", "year", "pages")
    WHERE "unnested"."year" < 1920
);

SELECT * FROM UNNEST(ARRAY[
    ROW(1, 'x'),
    CAST(NULL AS ROW(a INTEGER, b CHAR(1)))]) WITH ORDINALITY AS t(a, b, o);

SELECT * FROM UNNEST(ARRAY[
    ROW(1, CAST(NULL AS INTEGER)),
    CAST(NULL AS ROW(a INTEGER, b INTEGER))]) AS t(a, b);

select e.emp."name" as ename, e.rn
from "hr"."depts" as d,
UNNEST(d."employees") WITH ORDINALITY as e(emp, rn);

WITH data AS (
    SELECT ARRAY[
        ROW(1, 'Alice'),
        ROW(2, 'Bob'),
        ROW(3, 'Carol'),
        ROW(NULL, 'Dan'),
        NULL
    ] AS people
)
SELECT p.*
FROM data, UNNEST(people) AS p(p);

SELECT * FROM UNNEST(ARRAY[
    ROW(1, 'x'),
    CAST(NULL AS ROW(a INTEGER, b CHAR(1)))]) AS t(r);

WITH t(id, arr) AS (
  SELECT 1, ARRAY[10, 20] FROM (VALUES (0)) AS z(k)
  UNION ALL
  SELECT 2, ARRAY(SELECT 1 FROM (VALUES (0)) AS z(k) WHERE FALSE)
    FROM (VALUES (0)) AS z(k)
  UNION ALL
  SELECT 3, CAST(NULL AS INTEGER ARRAY) FROM (VALUES (0)) AS z(k))
SELECT t.id, u.x
FROM t LEFT JOIN UNNEST(t.arr) AS u(x) ON TRUE
ORDER BY t.id, u.x;

WITH t(id, arr) AS (
  SELECT 1, ARRAY[10, 20] FROM (VALUES (0)) AS z(k)
  UNION ALL
  SELECT 3, CAST(NULL AS INTEGER ARRAY) FROM (VALUES (0)) AS z(k))
SELECT t.id, u.x, u.o
FROM t LEFT JOIN UNNEST(t.arr) WITH ORDINALITY AS u(x, o) ON TRUE
ORDER BY t.id, u.x;

SELECT *
FROM (VALUES (1)) AS t(x)
NATURAL LEFT JOIN UNNEST(ARRAY[2, 3]) AS u(x);

WITH t(id, m) AS (
  SELECT 1, MAP['a', 10, 'b', 20] FROM (VALUES (0)) AS z(k)
  UNION ALL
  SELECT 3, CAST(NULL AS MAP<VARCHAR, INTEGER>) FROM (VALUES (0)) AS z(k))
SELECT t.id, u.k, u.v
FROM t LEFT JOIN UNNEST(t.m) AS u(k, v) ON TRUE
ORDER BY t.id, u.k;

WITH t(id, arr) AS (
  SELECT 1, ARRAY[10, 20] FROM (VALUES (0)) AS z(k))
SELECT t.id, u.x, u.o
FROM t LEFT JOIN UNNEST(t.arr) WITH ORDINALITY AS u(x, o) ON TRUE;

SELECT d."deptno", e."emp"
FROM "hr"."depts" AS d
LEFT JOIN UNNEST(d."employees") AS e("emp") ON TRUE
ORDER BY d."deptno";

SELECT u.x, z, o
FROM (
    SELECT x, collect(y) as ys
    FROM (VALUES (10, 'a'), (10, 'b'), (20, 'c')) AS t (x, y)
    GROUP BY x) AS u,
  UNNEST(u.ys) WITH ORDINALITY AS t(z, o);

SELECT n, b, a
FROM (SELECT 'test' AS n, ARRAY[1, 2, 3] AS arr1, ARRAY[10, 20] AS arr2) AS u,
UNNEST(u.arr2, u.arr1) AS t(b, a);

SELECT id, k, v
FROM (SELECT 42 AS id, MAP['a', 1, 'b', 2] AS m) AS u,
UNNEST(u.m) AS t(k, v);

select d."name", e.*
from "hr"."depts" as d
LEFT JOIN UNNEST(d."employees") as e ON TRUE;

SELECT u.x, z
FROM (VALUES
    (1, ARRAY[10, 20]),
    (2, CAST(NULL AS INTEGER ARRAY)),
    (3, ARRAY[30])) AS u(x, arr),
UNNEST(u.arr) AS z;

SELECT u.x, z, o
FROM (VALUES
    (1, ARRAY[10, 20]),
    (2, CAST(NULL AS INTEGER ARRAY)),
    (3, ARRAY[30])) AS u(x, arr)
LEFT JOIN UNNEST(u.arr) WITH ORDINALITY AS t(z, o) ON TRUE;

select d."name" as dept, e.emp."name" as ename
from "hr"."depts" as d
LEFT JOIN UNNEST(d."employees") as e(emp) ON TRUE;

WITH t(id, arr) AS (
  SELECT 1, ARRAY[10, 20] FROM (VALUES (0)) AS z(k)),
exploded AS (SELECT t.id, u.x FROM t, UNNEST(t.arr) AS u(x))
SELECT e1.id, e1.x, e2.x
FROM exploded AS e1 JOIN exploded AS e2 ON e1.x = e2.x;

SELECT CAST(200 AS INT UNSIGNED) - 100;

SELECT CAST(255 AS TINYINT UNSIGNED);

SELECT CAST(CAST(100 AS INT UNSIGNED) AS INT) - 200;

SELECT CAST(100 AS INT UNSIGNED) * 10;

SELECT CAST('10' AS INT UNSIGNED);

SELECT CAST(10.2e0 AS INT UNSIGNED);

SELECT CAST(65536 AS INT UNSIGNED) * 65535;

SELECT CAST(255 AS TINYINT UNSIGNED) * 255;

SELECT TYPEOF(CAST(CAST(255 AS TINYINT UNSIGNED) AS VARIANT));

SELECT CAST(1000 AS INT UNSIGNED) / 30;

SELECT CAST(1 AS UNSIGNED) * 1.0;

-- BITXOR with NULL and unsigned value
SELECT CAST(NULL AS INTEGER UNSIGNED) ^ CAST(1 AS INTEGER UNSIGNED);

SELECT CAST(MAP['a', 1] AS MAP<VARIANT, VARIANT>)['a'] AS C;

SELECT CAST(1 AS VARIANT) as C;

SELECT CAST(CAST(1 AS TINYINT) AS VARIANT) AS C;

SELECT CAST(CAST(1 AS VARIANT) AS INT) AS C;

select CAST('string' as VARIANT) as C;

SELECT CAST(CAST('abc' AS VARIANT) AS CHAR(3)) AS C;

SELECT VARIANTNULL() IS NULL AS C;

SELECT TYPEOF(VARIANTNULL()) AS C;

SELECT CAST(1 AS VARIANT) = CAST(CAST(1 AS TINYINT) AS VARIANT) AS C;

SELECT MAP['a', CAST(1 AS VARIANT), 'b', CAST('abc' AS VARIANT), 'c', CAST(ARRAY[1,2,3] AS VARIANT)] AS C;

SELECT CAST(ARRAY[1,2,3] AS VARIANT)[1] AS C;

SELECT CAST(ARRAY[1,2,3] AS VARIANT)['name'] AS C;

SELECT CAST(Map[1,'a',2,'b',3,'c'] AS VARIANT)[1] AS C;

SELECT CAST(Map['a',1,'b',2,'c',3] AS VARIANT)."a" AS C;

SELECT CAST(Map['a',1,'b',2,'c',3] AS VARIANT)['a'] AS C;

SELECT CAST(MAP['a', CAST(1 AS VARIANT), 'b', CAST('abc' AS VARIANT), 'c', CAST(ARRAY[1,2,3] AS VARIANT)]
               ['c'][1] AS INTEGER) AS C;

WITH
T(ts, l) AS (VALUES(TIMESTAMP '2020-01-01 10:00:00', 10),
                   (TIMESTAMP '2020-02-01 10:00:00', 10),
                   (TIMESTAMP '2019-12-30 20:00:00', 10)),
IT AS (SELECT(ts - TIMESTAMP '2020-01-01 00:00:00') HOURS AS t, l FROM T)
SELECT *,
   COUNT(*) OVER (
      PARTITION BY l
      ORDER BY t
      RANGE BETWEEN INTERVAL 2 DAYS PRECEDING AND INTERVAL 1 DAYS PRECEDING) AS c
FROM It;

select empno, deptno,
 count(*) over (order by deptno) c1,
 count(*) over (order by deptno range unbounded preceding) c2,
 count(*) over (order by deptno range between unbounded preceding and current row) c3,
 count(*) over (order by deptno rows unbounded preceding) c4,
 count(*) over (order by deptno rows between unbounded preceding and current row) c5,
 count(*) over (order by deptno range between unbounded preceding and unbounded following) c6,
 count(*) over (order by deptno rows between unbounded preceding and unbounded following) c7
from emp;

select count(*) over (rows between 3 preceding and 2 preceding) as c3p2p,
  sum(two) over (rows between 3 preceding and 2 preceding) as s3p2p,
  sum(two) over (rows 1 preceding) as s1p,
  sum(two) over (rows between 1 preceding and 1 following) as s1p1f,
  sum(two) over (rows between current row and 2 following) as s2f
from (select *, 2 as two from emp)
order by 1;

select deptno,
  count(*) over (partition by deptno rows current row) as "rows",
  count(*) over (partition by deptno rows unbounded preceding) as "rowsUp",
  count(*) over (partition by deptno range unbounded preceding) as "rangeUp",
  count(*) over (partition by deptno) as "empty",
  count(*) over (partition by deptno rows between unbounded preceding and unbounded following) as "rowsUpUf",
  count(*) over (partition by deptno range between unbounded preceding and unbounded following) as "rangeUpUf",
  count(*) over (partition by deptno range unbounded preceding) as "rangeUp"
from emp
order by 1, 4;

select empno,
  stddev(CAST(comm AS DECIMAL(12, 4))) over (order by empno rows unbounded preceding) as stdev
from emp
where deptno = 30
order by 1;

select gender,deptno,
  count(*) over (partition by gender,deptno) as count1
from emp;

select *, first_value(deptno) over () from emp;

select *, first_value(ename) over (partition by deptno) from emp;

select *, first_value(ename) over (partition by deptno range unbounded preceding) from emp;

select *, count(*) over (order by deptno) as c from emp;

select *, dense_rank() over (order by deptno) as c from emp;

select deptno,
  ename,
  row_number() over (partition by deptno) as r
from emp
where gender = 'F';

select *, count(*) over (partition by deptno) as c from emp;

select deptno, gender, count(gender, deptno) over w1 as a
from emp
window w1 as ();

select deptno, gender, min(ename) as x, sum(deptno) as y,
  rank() over (partition by gender order by min(ename)) as r,
  sum(sum(deptno)) over (partition by gender order by min(ename)) as s
from emp
group by deptno, gender
order by gender, r;

select a."deptno", a.r as ar, b.r as br
from (
  select "deptno", first_value("empid") over w as r
  from "hr"."emps"
  window w as (partition by "deptno" order by "commission")) a
join (
  select "deptno", last_value("empid") over w as r
  from "hr"."emps"
  window w as (partition by "deptno" order by "commission")) b
on a."deptno" = b."deptno"
order by "deptno", ar, br limit 5;

select
 t1.l, t1.key as key1, t2.key as key2
from
 (
  select
   dense_rank() over (order by key) l,
   key
  from
   unnest(map[1,1,2,2]) k
 ) t1
 join
 (
  select
   dense_rank() over(order by key) l,
   key
  from
   unnest(map[2,2]) k
 ) t2 on (t1.l = t2.l and t1.key + 1 = t2.key);

select emps."AGE", emps."DEPTNO",
 sum(emps."AGE" * emps."DEPTNO") over() as "sum(age * deptno)",
 regr_count(emps."AGE", emps."DEPTNO") over() as "regr_count(age, deptno)",
 covar_pop(emps."DEPTNO", emps."AGE") over() as "covar_pop"
from emps order by emps."AGE";

select emps."AGE", emps."DEPTNO", emps."GENDER",
 covar_samp(emps."AGE", emps."AGE") over() as "var_samp",
 covar_samp(emps."DEPTNO", emps."AGE") over() as "covar_samp",
 covar_samp(emps."EMPNO", emps."DEPTNO") over(partition by emps."MANAGER") as "covar_samp partitioned"
from emps order by emps."AGE";

select emps."AGE", emps."DEPTNO",
 regr_sxx(emps."AGE", emps."DEPTNO") over() as "regr_sxx(age, deptno)",
 regr_syy(emps."AGE", emps."DEPTNO") over() as "regr_syy(age, deptno)"
from emps order by emps."AGE";

select deptno,
  mode(gender) over (partition by deptno) as m
from emp;

select gender,
  arg_min(ename, deptno) over (partition by gender order by ename) as mi,
  arg_max(ename, deptno) over (partition by gender order by ename) as ma
from emp;

select gender, count(*) over(partition by gender order by ename) as count1 from emp where gender = 'F';

select
  count(*) over (order by "one" rows between 2 preceding and 5 following exclude group) as c2p5fxg,
  count(*) over (order by "one" rows between 2 preceding and 5 following) as c2p5f,
  count(*) over (order by "one" rows 20 preceding) as c20p,
  sum("one") over (order by "one" rows between 2 preceding and unbounded following exclude ties) as s2pxt,
  sum("one") over (order by "one" rows between unbounded preceding and unbounded following exclude no others) as sxn,
  sum("one") over (order by "one" rows between unbounded preceding and unbounded following) as s
from (select *, 1 as "one" from emp) as e
order by c20p;

select empno,
  stddev(comm) over (order by empno rows between 2 preceding and 5 following exclude current row) as e1,
  count(*) over (order by empno rows between 2 preceding and 5 following exclude group) as e2,
  sum(sal) over (order by empno rows between 2 preceding and unbounded following exclude ties) as e3,
  sum(sal) over (order by empno rows between unbounded preceding and unbounded following exclude no others) as e4,
  sum(sal) over (order by empno rows between unbounded preceding and unbounded following) as e5
from emp
order by 1;

select empno, deptno,
  sum(sal) filter (where comm is not null) over (partition by deptno) as filtered_sum
from emp
order by empno;

select empno, deptno, sal,
  sum(sal) filter (where sal > 1000) over (partition by deptno order by empno rows between unbounded preceding and current row) as running_sum
from emp
order by empno;

select o, v,
  first_value(v) ignore nulls over (order by o rows 2 preceding) as fv
from (values (1, 1), (2, cast(null as integer)), (3, 3),
             (4, cast(null as integer)), (5, cast(null as integer))) as t(o, v);

select o, v,
  first_value(v) ignore nulls
    over (order by o rows between 1 preceding and 1 preceding) as fv
from (values (1, cast(null as integer)), (2, cast(null as integer)),
             (3, 5)) as t(o, v);

select o, v,
  first_value(v) ignore nulls
    over (order by o rows between unbounded preceding and unbounded following) as fv,
  last_value(v) ignore nulls
    over (order by o rows between unbounded preceding and unbounded following) as lv
from (values (1, 1), (2, cast(null as integer)), (3, 3),
             (4, cast(null as integer)), (5, cast(null as integer))) as t(o, v);

select o, v,
  first_value(v) ignore nulls
    over (order by o range between 1 preceding and 1 following) as fv,
  last_value(v) ignore nulls
    over (order by o range between 1 preceding and 1 following) as lv
from (values (1, 1), (2, cast(null as integer)), (3, 3),
             (4, cast(null as integer)), (5, cast(null as integer))) as t(o, v);

select o, v,
  lag(v, 0) over (order by o) as l,
  lag(o, 0) over (order by o) as lo,
  lead(o, 0, 100) over (order by o) as ld
from (values (1, 10), (2, cast(null as integer)), (3, 30)) as t(o, v);

SELECT y, x, LAG(x, 1, 0) OVER (ORDER BY y) AS l
FROM (VALUES (1, 10), (2, CAST(NULL AS INTEGER)), (3, 30)) AS t(y, x);

SELECT y, x, LAG(x, 1, 'z') OVER (ORDER BY y) AS l
FROM (VALUES (1, 'a'), (2, CAST(NULL AS CHAR(1))), (3, 'c')) AS t(y, x);

select pc."product_family",
  count(*) as c,
  avg(s."unit_sales") as avg_units,
  sum(c."num_cars_owned") as sum_cars,
  avg(cast(c."num_cars_owned" as decimal(6,2))) as avg_cars
from "sales_fact_1997" as s
join "customer" as c using ("customer_id")
join "product" as p using ("product_id")
join "product_class" as pc using ("product_class_id")
group by pc."product_family"
order by 1;

CREATE TABLE emp AS
SELECT * FROM (VALUES
 (7369, 'SMITH',  'CLERK',     7902, DATE '1980-12-17', 800.00,     null, 20),
 (7499, 'ALLEN',  'SALESMAN',  7698, DATE '1981-02-20', 1600.00,  300.00, 30),
 (7521, 'WARD',   'SALESMAN',  7698, DATE '1981-02-22', 1250.00,  500.00, 30),
 (7566, 'JONES',  'MANAGER',   7839, DATE '1981-02-04', 2975.00,    null, 20),
 (7654, 'MARTIN', 'SALESMAN',  7698, DATE '1981-09-28', 1250.00, 1400.00, 30),
 (7698, 'BLAKE',  'MANAGER',   7839, DATE '1981-01-05', 2850.00,    null, 30),
 (7782, 'CLARK',  'MANAGER',   7839, DATE '1981-06-09', 2450.00,    null, 10),
 (7788, 'SCOTT',  'ANALYST',   7566, DATE '1987-04-19', 3000.00,    null, 20),
 (7839, 'KING',   'PRESIDENT', null, DATE '1981-11-17', 5000.00,    null, 10),
 (7844, 'TURNER', 'SALESMAN',  7698, DATE '1981-09-08', 1500.00,    0.00, 30),
 (7876, 'ADAMS',  'CLERK',     7788, DATE '1987-05-23', 1100.00,    null, 20),
 (7900, 'JAMES',  'CLERK',     7698, DATE '1981-12-03',  950.00,    null, 30),
 (7902, 'FORD',   'ANALYST',   7566, DATE '1981-12-03', 3000.00,    null, 20),
 (7934, 'MILLER', 'CLERK',     7782, DATE '1982-01-23', 1300.00,    null, 10)
) AS emp (EMPNO, ENAME, JOB, MGR, HIREDATE, SAL, COMM, DEPTNO);

CREATE TABLE bonus (
  ENAME VARCHAR(10),
  JOB  VARCHAR(9),
  SAL  DECIMAL(6, 2),
  COMM DECIMAL(6, 2));

CREATE TABLE dummy AS
SELECT * FROM (VALUES
  (0)
) AS dummy (DUMMY);

CREATE TABLE emp3 AS
SELECT empno, ename, job,
 (select min(mgr) from emp where (job, deptno) = (e.job, e.deptno)) AS mgr,
 hiredate,
 (select min(sal) from emp where job = e.job) AS sal,
 comm, deptno
FROM emp AS e;

SELECT deptno, SUM(sal), SUM(sal) WITHIN DISTINCT (job)
FROM emp3
GROUP BY deptno;

SELECT deptno,
  count(mgr) WITHIN DISTINCT (job) AS count_mgr,
  count(*) WITHIN DISTINCT (job) AS count_star
FROM emp3
GROUP BY deptno;

SELECT sum(sal) WITHIN DISTINCT (job) AS sum_sal,
  count(sal) WITHIN DISTINCT (job) AS count_sal,
  count(*) WITHIN DISTINCT (job) AS count_star
FROM emp3;

SELECT deptno,
  avg(CAST(sal AS DECIMAL(10, 2))) AS avg_sal,
  avg(CAST(sal AS DECIMAL(10, 2))) WITHIN DISTINCT (job) AS avg_job_sal
from emp3
group by deptno
order by deptno;

select * from job_salary order by job;

create table customers (customer_id int not null,
  name varchar(10) not null,
  age int not null,
  state varchar(2) not null);

create table orders (order_id int not null,
  customer_id int not null,
  payment varchar(4) not null,
  shipping decimal(6, 2) not null);

create table order_items (order_id int not null,
  product varchar(10) not null,
  units int not null);

select * from orders;

select count(*) as "count",
  sum(shipping) as "sum_shipping",
  sum(units) as "sum_units"
from orders
join order_items using (order_id);

select product,
  count(*) as "count",
  sum(shipping) within distinct (orders.order_id) as "sum_shipping",
  sum(units) as "sum_units"
from orders
join order_items using (order_id)
group by product
order by product;

select payment,
  count(*) as "count",
  count(distinct orders.order_id) as "order_count",
  sum(shipping) as "sum_shipping",
  sum(units) as "sum_units"
from orders
join order_items using (order_id)
group by payment
order by payment;

select payment,
  count(*) as "count",
  count(*) filter (where g = 0) as "order_count",
  sum(min_shipping) filter (where g = 0) as "sum_shipping",
  sum(sum_units) filter (where g = 1) as "sum_units"
from (
  select payment,
    grouping(o.order_id) as g,
    sum(o.shipping) as sum_shipping,
    min(o.shipping) as min_shipping,
    sum(i.units) as sum_units
  from orders as o
  join order_items as i on o.order_id = i.order_id
  group by grouping sets ((o.payment), (o.payment, o.order_id)))
group by payment;

create table xxx as
select payment,
  order_id,
  shipping as sum_shipping
from orders;

select payment,
  count(*) as "count",
  count(*) filter (where g = 0) as "order_count",
  sum(sum_shipping) filter (where g = 0) as "sum_shipping",
  sum(sum_units) filter (where g = 1) as "sum_units"
from (
  select payment,
    0 as g,
    sum(sum_shipping) as sum_shipping,
    null as sum_units
  from xxx
  group by payment, order_id
  union all
  select payment,
    1 as g,
    null as sum_shipping,
    sum(sum_units) as sum_units
  from yyy
  group by payment)
group by payment;

select product,
  sum(c) filter (where g = 1) as "count",
  sum(c1) filter (where g = 0) as "order_count",
  sum(min_shipping) filter (where g = 0) as "sum_shipping",
  sum(sum_units) filter (where g = 0) as "sum_units"
from (
  select i.product,
    grouping(o.order_id) as g,
    1 as c1,
    count(*) as c,
    sum(o.shipping) as sum_shipping,
    min(o.shipping) as min_shipping,
    sum(i.units) as sum_units
  from orders as o
  join order_items as i on o.order_id = i.order_id
  group by grouping sets ((i.product), (i.product, o.order_id)))
group by product
order by product;

select o.payment,
  count(distinct o.customer_id) as "customer_count",
  count(distinct o.order_id) as "order_count",
  count(*) as "order_item_count",
  sum(c.age) as "sum_age",
  sum(o.shipping) as "sum_shipping",
  sum(i.units) as "sum_units"
from customers as c
join orders as o using (customer_id)
join order_items as i using (order_id)
group by o.payment
order by o.payment;

CREATE TABLE Friends AS
SELECT * FROM (VALUES
  ('Julian', 16),
  ('Dick', 15),
  ('Anne', 13),
  ('George', 15),
  ('Timmy', 4)) AS Friends (name, age);

SELECT SUM(age) AS sa, SUM(DISTINCT age) AS sda
FROM Friends;

WITH FriendStates
AS (SELECT * FROM (VALUES
  ('Alice', 789, 'UT'),
  ('Bob', 25, 'UT'),
  ('Carlos', 25, 'UT'),
  ('Dan', 12, 'UT'),
  ('Erin', 567, 'WY'),
  ('Frank', 456, 'WY')) AS FriendStates (name, age, state))
SELECT AVG(age) WITHIN DISTINCT (state) FILTER (WHERE age < 100 AND age > 18) AS aa_s,
  COUNT(*) WITHIN DISTINCT (state) FILTER (WHERE age < 100 AND age > 18) AS c_s
FROM FriendStates;

WITH FriendStates
AS (SELECT * FROM (VALUES
  ('Alice', 789, 'UT'),
  ('Bob', 25, 'UT'),
  ('Carlos', 25, 'UT'),
  ('Dan', 678, 'UT'),
  ('Erin', 567, 'WY'),
  ('Forest', NULL, 'WY')) AS FriendStates (name, age, state))
SELECT SUM(age) WITHIN DISTINCT (name) as sum_age,
REPLACE(LISTAGG(name, ',') WITHIN GROUP (ORDER BY name DESC), ' ', '') as ordered_name
FROM FriendStates;
