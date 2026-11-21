SELECT * FROM information_schema.tables;

SELECT * FROM y.information_schema.tables;

SELECT * FROM x.y.information_schema.tables;

SELECT * FROM x.y.information_schema.tables AS z;

SELECT results FROM Coordinates, coordinates.position AS results;

SELECT results FROM db.coordinates, Coordinates.position AS results;

WITH Coordinates AS (SELECT [1, 2] AS position) SELECT results FROM Coordinates, `Coordinates.position` AS results;

CREATE TEMPORARY FUNCTION f() RETURNS STRING AS ((((SELECT 'foo'))));
