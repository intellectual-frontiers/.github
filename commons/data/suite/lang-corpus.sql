-- A corpus of this library's own, for the lexer's benchmark (commons data 0065-sql-lang FR-018): ordinary statements
-- in the common ground of the dialects, with the comments, strings and quoted names that a lexer has to get right.

/** The people of the company. */
CREATE TABLE person (
  id          INTEGER PRIMARY KEY,          -- the key
  given_name  VARCHAR(100) NOT NULL,        -- as written on the passport
  family_name VARCHAR(100) NOT NULL,
  born        DATE,
  email       TEXT UNIQUE CHECK (email LIKE '%_@_%'),
  "order"     INTEGER DEFAULT 0             /* a reserved word, quoted */
);

CREATE INDEX person_name ON person (family_name, given_name);

CREATE VIEW adult AS
  SELECT id, given_name, family_name FROM person
  WHERE born <= CURRENT_DATE - INTERVAL '18' YEAR;

SELECT p.id, p.given_name || ' ' || p.family_name AS full_name, count(o.id) AS orders, sum(o.total) AS spent
FROM person AS p
LEFT JOIN "order" AS o ON o.person_id = p.id AND o.placed >= '2026-01-01'
WHERE p.email IS NOT NULL AND p.family_name NOT IN ('Smith', 'O''Brien', 'Müller')
GROUP BY p.id, p.given_name, p.family_name
HAVING sum(o.total) > 1000.50
ORDER BY spent DESC, full_name
LIMIT 25 OFFSET 50;

WITH RECURSIVE tree (id, parent_id, depth) AS (
  SELECT id, parent_id, 0 FROM node WHERE parent_id IS NULL
  UNION ALL
  SELECT n.id, n.parent_id, t.depth + 1 FROM node n JOIN tree t ON n.parent_id = t.id
)
SELECT * FROM tree WHERE depth < 10 ORDER BY depth, id;

SELECT CASE WHEN score >= 90 THEN 'A' WHEN score >= 80 THEN 'B' ELSE 'C' END AS grade,
       CAST(score AS DECIMAL(5, 2)) / 100 AS ratio,
       coalesce(nickname, given_name) AS shown,
       row_number() OVER (PARTITION BY team ORDER BY score DESC) AS place
FROM result;

INSERT INTO person (id, given_name, family_name, born, email)
VALUES (1, 'Ada', 'Lovelace', '1815-12-10', 'ada@example.org'),
       (2, 'Alan', 'Turing', '1912-06-23', 'alan@example.org'),
       (3, 'Grace', 'Hopper', '1906-12-09', 'grace@example.org');

UPDATE person SET email = lower(email), born = NULL WHERE id IN (SELECT person_id FROM bounced);
DELETE FROM person WHERE born IS NULL AND email IS NULL;

/* A longer note, in a block,
   over two lines, with 'quotes' and "names" and -- dashes that are not comments. */
SELECT 1.5e-3 + .25 * 3. - 42 AS number, 'a -- b' AS text, "x /* y */ z" AS name FROM dual;

SELECT a.x, b.y, c.z FROM a JOIN b ON a.id = b.a_id JOIN c ON c.b_id = b.id WHERE a.x <> b.y OR b.y <= c.z AND NOT (c.z >= 10) ;

ALTER TABLE person ADD COLUMN phone TEXT;
ALTER TABLE person DROP COLUMN phone;
DROP VIEW adult;
DROP TABLE person;
