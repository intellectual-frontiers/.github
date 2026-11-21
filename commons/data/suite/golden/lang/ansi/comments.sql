-- Header, detached by the blank line below.

-- The people of the company.
CREATE TABLE person ( -- opens
  -- the key
  id INTEGER PRIMARY KEY, -- trailing the key
  name TEXT, /* inline */ born DATE
  -- the last word of the table
);

SELECT 1; -- after the statement
-- before the next
SELECT /* in the list */ a, -- after a
  b FROM t -- the tail
  WHERE a > 1;

-- A statement that cannot be read, and its comment:
SELECT FROM /* inside */ t;
-- the end
