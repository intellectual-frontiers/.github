$x := 5;

SELECT getvariable('x');

SELECT $x;

$x := 6;

$y := $x * 2;

SELECT $y;

SET VARIABLE x = 1;

$x := 2;

$animal := 'duck';

$numbers := [1, 2, 3];

$point := {'x': 1, 'y': 2};

$ts := TIMESTAMP '2020-01-01 00:00:00';

SELECT $animal, $numbers, $point, $ts;

CREATE TABLE tbl AS SELECT range AS i FROM range(10);

$total := (SELECT sum(i) FROM tbl);

SELECT $total;

$greeting := 'hello' || ' ' || 'world';

SELECT $greeting;

$"my var" := 42;

SELECT getvariable('my var');

RESET VARIABLE x;

PREPARE p AS SELECT $a + $b;

EXECUTE p(a := 1, b := 2);

$a := 1;

$b := 2;

SELECT $a + $b;

SET VARIABLE animal = 'duck';

SELECT $animal;

SELECT $animal = getvariable('animal');

SET VARIABLE x = 42;

SELECT $x + 1;

SET VARIABLE greeting = 'hello';

SELECT $x, $greeting;

SET VARIABLE animal = 'goose';

RESET VARIABLE animal;

SET VARIABLE multiplier = 10;

PREPARE stmt_default AS SELECT $multiplier * $x AS result;

EXECUTE stmt_default;

EXECUTE stmt_default(multiplier := 2, x := 5);

EXECUTE stmt_default(multiplier := 3);

EXECUTE stmt_default(x := 1);

SET VARIABLE "1" = 5;

PREPARE stmt_positional_auto AS SELECT ?;

EXECUTE stmt_positional_auto(7);

PREPARE stmt_positional_numbered AS SELECT $1;

EXECUTE stmt_positional_numbered(8);

SET VARIABLE a1 = 9;

PREPARE stmt_named_digit AS SELECT $a1;

EXECUTE stmt_named_digit;

SET VARIABLE multiplier = 100;

EXECUTE stmt_default(multiplier := 1, x := 1);

CREATE TABLE t (i INTEGER);

INSERT INTO t VALUES (1), (2), (3), (4), (5);

SET VARIABLE threshold = 3;

SELECT i FROM t WHERE i > $threshold ORDER BY i;

SELECT count(*) FROM t WHERE i <= $threshold;

PREPARE filter_stmt AS SELECT i FROM t WHERE i > $threshold ORDER BY i;

EXECUTE filter_stmt;

EXECUTE filter_stmt(threshold := 1);

SET VARIABLE limit_val = 2;

SELECT i FROM t ORDER BY i LIMIT $limit_val;

SELECT GETVARIABLE('animal');

PREPARE v1 AS SELECT GETVARIABLE($1);

EXECUTE v1('animal');

CREATE MACRO _(x) AS getvariable(x);

SELECT _('animal');

SET VARIABLE animal='bird';

FROM duckdb_variables();

SHOW VARIABLES;

CREATE TABLE animal_list(a VARCHAR);

INSERT INTO animal_list VALUES ('duck'), ('goose');

SET VARIABLE animals=(SELECT LIST(a) FROM animal_list);

SELECT GETVARIABLE('animals');

SELECT GETVARIABLE('xxx');

SET VARIABLE qualified = a.b.c;

SELECT GETVARIABLE('qualified');
