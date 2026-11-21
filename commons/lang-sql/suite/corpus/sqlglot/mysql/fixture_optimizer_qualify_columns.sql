SELECT * FROM table_a as A WHERE A.col1 IN (SELECT MAX(B.col2) FROM table_b as B UNION ALL SELECT MAX(C.col2) FROM table_b as C);

SELECT * FROM y JOIN z USING (c, b);
