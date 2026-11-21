-- Unknown source columns can shadow projection aliases.
SELECT range + 1 AS range, range AS x FROM range(3);

-- A source name can also name one of its columns.
SELECT r FROM range(3) AS r;

-- Unknown local or outer schemas prevent resolving unqualified correlated references.
SELECT p.range FROM range(10) AS p WHERE EXISTS (SELECT 1 FROM range(1) AS q WHERE range > 5);
