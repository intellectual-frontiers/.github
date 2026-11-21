SELECT a // b, 2 ** 3, a::int, x ILIKE 'a%', y GLOB '*.sql', d->>'k', $1, $name FROM t;
SELECT struct_pack(a => 1, b := 2) FROM read_csv('x.csv', header => TRUE) AS r;
