SELECT * FROM range(1) WITH ORDINALITY AS _(ordinality);

SELECT o,range FROM range(1) WITH ORDINALITY AS _(range,o);

SELECT my_range, my_ordinality FROM range(3) WITH ORDINALITY AS _(my_range, my_ordinality) ORDER BY my_range,my_ordinality;

SELECT my_series, my_ordinality FROM generate_series(0,3,1) WITH ORDINALITY AS _(my_series,my_ordinality) ORDER BY my_series, my_ordinality;

SELECT * FROM repeat('x', 5) WITH ORDINALITY ORDER BY ordinality;

SELECT * FROM repeat('x', 9) WITH ORDINALITY WHERE ordinality >  4 ORDER BY ordinality;

CREATE OR REPLACE VIEW view_ordinality AS
SELECT r AS range, o AS my_ordinality
FROM range((select 10)) WITH ORDINALITY AS _(r, o)
WHERE my_ordinality > 4
ORDER BY range, my_ordinality;

SELECT range, my_ordinality FROM view_ordinality ORDER BY range, my_ordinality;

WITH RECURSIVE ordinalityCTE AS (
    SELECT 1 AS ordinality
    UNION
    SELECT oCTE.ordinality + r.ordinality AS ordinality
    FROM
        ordinalityCTE AS oCTE,
        LATERAL range(1) WITH ORDINALITY AS r(range,ordinality)
    WHERE oCTE.ordinality < 5
) SELECT ordinality FROM ordinalityCTE ORDER BY ordinality;

WITH RECURSIVE ordinalityCTE AS (
    SELECT 1 AS ordinality
    UNION ALL
    SELECT oCTE.ordinality + r.ordinality AS ordinality
    FROM
        ordinalityCTE AS oCTE,
        LATERAL range(1) WITH ORDINALITY AS r(range,ordinality)
    WHERE oCTE.ordinality < 5
) SELECT ordinality FROM ordinalityCTE ORDER BY ordinality;

SELECT * FROM unnest([41,42,43]) WITH ORDINALITY;

CREATE TABLE test(a int);

INSERT INTO test VALUES (1),(3);

SELECT a,my_range,my_ordinality FROM test AS t(a), LATERAL range(t.a) WITH ORDINALITY AS _(my_range,my_ordinality) ORDER BY a,my_range;

SELECT a,my_series,my_ordinality FROM test AS t(a), LATERAL generate_series(0,t.a,1) WITH ORDINALITY AS _(my_series,my_ordinality) ORDER BY t.a, my_series, my_ordinality;

WITH ordinalityCTE AS (
    SELECT r AS range, o AS my_ordinality
    FROM range((select 10)) WITH ORDINALITY AS _(r, o)
    WHERE my_ordinality > 4
) SELECT range, my_ordinality FROM ordinalityCTE ORDER BY range, my_ordinality;

WITH RECURSIVE ordinalityCTE AS (
    SELECT 1 AS ordinality
    UNION
    SELECT oCTE.ordinality + r.ordinality AS ordinality
    FROM
        ordinalityCTE AS oCTE,
        LATERAL range(oCTE.ordinality) WITH ORDINALITY AS r(range,ordinality)
    WHERE oCTE.ordinality < 5
) SELECT ordinality FROM ordinalityCTE ORDER BY ordinality;

WITH RECURSIVE ordinalityCTE AS (
      SELECT 1 AS ordinality
      UNION ALL
      SELECT oCTE.ordinality + r.ordinality AS ordinality
      FROM
          ordinalityCTE AS oCTE,
          LATERAL range(oCTE.ordinality) WITH ORDINALITY AS r(range,ordinality)
      WHERE oCTE.ordinality <= 4
  ) SELECT ordinality FROM ordinalityCTE order by ordinality;

CREATE TABLE unnest_test(a char[]);

INSERT INTO unnest_test VALUES (['a1','a2','a3']),(['b1','b2']);

SELECT * FROM unnest_test AS t, LATERAL unnest(t.a) WITH ORDINALITY AS _(unnest,my_ordinality) ORDER BY unnest, my_ordinality;
