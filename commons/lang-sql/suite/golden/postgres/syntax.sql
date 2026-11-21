SELECT a::int, b::numeric(10, 2), c::text[] FROM t;
SELECT x ILIKE 'a%', y NOT ILIKE 'b%';
SELECT d->'k'->>'v', d #> '{a,b}', d @> '{"a":1}';
SELECT E'a\nb', $$dollar 'quoted'$$, $1, 1_000;
SELECT 2 ^ 3 * 4, a ~ 'x', b !~* 'y';
INSERT INTO t (a) VALUES ($1) RETURNING *;
