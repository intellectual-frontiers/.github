SELECT a == b, j->'x', j->>'y', x GLOB 'a*', y REGEXP 'b', `quoted`, [bracketed], "dq" FROM t;
SELECT ?, ?1, :name, @v, $x FROM t;
INSERT INTO t VALUES (X'ff', 0x1F);
