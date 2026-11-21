SELECT id AS email FROM t ORDER BY email || '';

--------------------------------------
-- Hint with table reference
--------------------------------------
SELECT /*+ BROADCAST(y) */ x.b FROM x JOIN y ON x.b = y.b;

SELECT c FROM t LATERAL VIEW EXPLODE(rel.arr) l AS c;

SELECT * FROM x LEFT SEMI JOIN y USING (b);

SELECT * FROM x JOIN y USING (b) LEFT SEMI JOIN z USING (c);
