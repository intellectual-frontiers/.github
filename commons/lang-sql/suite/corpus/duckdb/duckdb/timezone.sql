set disable_timestamptz_casts=false;

select cast('2020-01-01T00:00:00'::timestamp as timestamptz);

select cast('2020-01-01T15:00:00+0000'::timestamptz as timestamp);

set disable_timestamptz_casts=true;

set calendar='gregorian';

set TimeZone='America/Los_Angeles';

SET TimeZone = 'UTC';

SET Calendar = 'gregorian';

SET TimeZone = 'America/Los_Angeles';

SELECT name FROM icu_calendar_names()
GROUP BY 1
ORDER BY 1;

SELECT name, value, description, input_type, scope FROM duckdb_settings() WHERE name = 'Calendar';

SET TimeZone = 'Asia/Tokyo';

CREATE TABLE timestamps AS SELECT ts::TIMESTAMPTZ AS ts, era FROM (VALUES
	('0645-06-30 00:00:00+00', 'Taika'),
	('1867-01-01 00:00:00+00', 'Keiou'),
	('1868-09-07 00:00:00+00', 'Keiou'),
	('1868-09-08 00:00:00+00', 'Meiji'),
	('1912-07-29 00:00:00+00', 'Meiji'),
	('1912-07-30 00:00:00+00', 'Taisho'),
	('1926-12-24 00:00:00+00', 'Taisho'),
	('1926-12-25 00:00:00+00', 'Showa'),
	('1989-01-06 00:00:00+00', 'Showa'),
	('1989-01-08 00:00:00+00', 'Heisei'),
	('2019-05-01 00:00:00+00', 'Reiwa'),
	('2022-01-01 00:00:00+00', 'Reiwa')
) tbl(ts, era);

SET Calendar = 'japanese';

SELECT era, ts, DATE_PART(['era', 'year', 'month', 'day'], ts)
FROM timestamps
ORDER BY 2;

SET CALENDAR='islamic-umalqura';

SELECT strftime(TIMESTAMPTZ '-260722-3-4 0:3:52',TIMESTAMP '-285441-5-3 8:3:4'::VARCHAR);

SET CALENDAR='indian';

SELECT TIMESTAMPTZ '-276069-9-30 0:0:00 America/Whitehorse';

SET CALENDAR='japanese';

SET TimeZone='UTC';

SET Calendar='coptic';

SELECT ts, year(ts), month(ts), day(ts), era(ts), dayofyear(ts) FROM (VALUES
  ('2024-06-15 12:00:00+00'::TIMESTAMPTZ), ('0284-08-29 12:00:00+00'), ('0283-08-29 12:00:00+00'),
  ('1970-01-01 00:00:00+00'), ('2024-09-10 12:00:00+00'), ('2024-09-11 12:00:00+00'),
  ('2023-09-11 12:00:00+00'), ('2027-09-11 12:00:00+00'), ('0001-01-01 12:00:00+00')) t(ts);

SELECT make_timestamptz(1740, 13, 5, 12, 0, 0.0, 'UTC');

SELECT make_timestamptz(1739, 13, 6, 12, 0, 0.0, 'UTC');

SELECT make_timestamptz(1740, 13, 6, 12, 0, 0.0, 'UTC');

SELECT make_timestamptz(1740, 1, 1, 0, 0, 0.0, 'UTC');

SELECT make_timestamptz(1, 1, 1, 0, 0, 0.0, 'UTC');

SELECT date_trunc('year', '2024-06-15 12:00:00+00'::TIMESTAMPTZ);

SELECT date_trunc('month', '2024-06-15 12:00:00+00'::TIMESTAMPTZ);

SELECT date_trunc('quarter', '2024-06-15 12:00:00+00'::TIMESTAMPTZ);

SELECT date_trunc('decade', '2024-06-15 12:00:00+00'::TIMESTAMPTZ);

SELECT last_day('2024-06-15 12:00:00+00'::TIMESTAMPTZ);

SELECT last_day('2024-09-05 12:00:00+00'::TIMESTAMPTZ);

SELECT date_diff('year', '1900-06-15 12:00:00+00'::TIMESTAMPTZ, '2024-06-15 12:00:00+00'::TIMESTAMPTZ);

SELECT date_diff('month', '2023-06-15 12:00:00+00'::TIMESTAMPTZ, '2024-06-15 12:00:00+00'::TIMESTAMPTZ);

SELECT date_part(['year','month','day','era','dayofyear','week','isoyear'], '2024-06-15 12:00:00+00'::TIMESTAMPTZ);

SELECT * FROM generate_series('2024-09-05 12:00:00+00'::TIMESTAMPTZ, '2024-09-15 12:00:00+00'::TIMESTAMPTZ, INTERVAL 2 DAY);

SET Calendar='ethiopic';

SELECT ts, year(ts), month(ts), day(ts), era(ts), dayofyear(ts) FROM (VALUES
  ('2024-06-15 12:00:00+00'::TIMESTAMPTZ), ('0008-08-29 12:00:00+00'), ('0007-08-29 12:00:00+00'),
  ('1970-01-01 00:00:00+00'), ('2024-09-10 12:00:00+00'), ('2024-09-11 12:00:00+00'),
  ('0001-01-01 12:00:00+00'), ('5500-01-01 (BC) 12:00:00+00')) t(ts);

SELECT make_timestamptz(2016, 13, 5, 12, 0, 0.0, 'UTC');

SELECT make_timestamptz(2016, 1, 1, 0, 0, 0.0, 'UTC');

SET Calendar='ethiopic-amete-alem';

SELECT ts, year(ts), month(ts), day(ts), era(ts), dayofyear(ts) FROM (VALUES
  ('2024-06-15 12:00:00+00'::TIMESTAMPTZ), ('0008-08-29 12:00:00+00'), ('0007-08-29 12:00:00+00'),
  ('1970-01-01 00:00:00+00'), ('0001-01-01 12:00:00+00'), ('5500-01-01 (BC) 12:00:00+00')) t(ts);

SELECT make_timestamptz(7516, 13, 5, 12, 0, 0.0, 'UTC');

SELECT make_timestamptz(7516, 1, 1, 0, 0, 0.0, 'UTC');

SET Calendar='hebrew';

SELECT ts, year(ts), month(ts), day(ts), era(ts), dayofyear(ts), monthname(ts) FROM (VALUES
  ('2024-06-15 12:00:00+00'::TIMESTAMPTZ), ('1970-01-01 00:00:00+00'), ('2024-10-02 12:00:00+00'),
  ('2024-10-03 12:00:00+00'), ('2023-09-15 12:00:00+00'), ('2023-09-16 12:00:00+00'),
  ('2022-03-01 12:00:00+00'), ('2024-03-01 12:00:00+00'), ('0001-01-01 12:00:00+00'),
  ('1000-01-01 12:00:00+00'), ('2100-01-01 12:00:00+00'), ('1900-01-01 12:00:00+00')) t(ts);

SELECT y, count(*) FROM (SELECT year(ts) y FROM generate_series('2015-01-01 12:00:00+00'::TIMESTAMPTZ, '2035-01-01 12:00:00+00'::TIMESTAMPTZ, INTERVAL 1 DAY) t(ts) GROUP BY ALL) GROUP BY ALL ORDER BY ALL;

SELECT y, max(m) FROM (SELECT year(ts) y, month(ts) m FROM generate_series('2015-01-01 12:00:00+00'::TIMESTAMPTZ, '2035-01-01 12:00:00+00'::TIMESTAMPTZ, INTERVAL 1 DAY) t(ts)) GROUP BY ALL ORDER BY ALL;

SELECT make_timestamptz(5784, 1, 1, 0, 0, 0.0, 'UTC');

SELECT make_timestamptz(5784, 6, 1, 0, 0, 0.0, 'UTC');

SELECT make_timestamptz(5784, 7, 1, 0, 0, 0.0, 'UTC');

SELECT make_timestamptz(5784, 13, 29, 0, 0, 0.0, 'UTC');

SELECT make_timestamptz(5783, 6, 1, 0, 0, 0.0, 'UTC');

SELECT make_timestamptz(5783, 13, 29, 0, 0, 0.0, 'UTC');

SELECT date_trunc('week', '2024-06-15 12:00:00+00'::TIMESTAMPTZ);

SELECT last_day('2023-11-15 12:00:00+00'::TIMESTAMPTZ);

SELECT date_diff('month', '2022-06-15 12:00:00+00'::TIMESTAMPTZ, '2024-06-15 12:00:00+00'::TIMESTAMPTZ);

SELECT date_diff('day', '2023-06-15 12:00:00+00'::TIMESTAMPTZ, '2024-06-15 12:00:00+00'::TIMESTAMPTZ);

SELECT count(*), sum(hash(ts::VARCHAR)) FROM generate_series('1900-01-01 12:00:00+00'::TIMESTAMPTZ, '2200-01-01 12:00:00+00'::TIMESTAMPTZ, INTERVAL 7 DAY) t(ts);

SET Calendar='islamic-civil';

SELECT ts, year(ts), month(ts), day(ts), era(ts), dayofyear(ts) FROM (VALUES
  ('2024-06-15 12:00:00+00'::TIMESTAMPTZ), ('0622-07-19 12:00:00+00'), ('0622-07-18 12:00:00+00'),
  ('1970-01-01 00:00:00+00'), ('2024-07-07 12:00:00+00'), ('2024-07-08 12:00:00+00'),
  ('1882-11-12 12:00:00+00'), ('2100-01-01 12:00:00+00'), ('1000-01-01 12:00:00+00')) t(ts);

SELECT make_timestamptz(1445, 1, 1, 0, 0, 0.0, 'UTC');

SELECT make_timestamptz(1445, 12, 29, 0, 0, 0.0, 'UTC');

SELECT make_timestamptz(1445, 12, 30, 0, 0, 0.0, 'UTC');

SELECT make_timestamptz(1444, 12, 30, 0, 0, 0.0, 'UTC');

SELECT last_day('2024-07-20 12:00:00+00'::TIMESTAMPTZ);

SELECT age('2024-06-15 12:00:00+00'::TIMESTAMPTZ, '1900-06-15 12:00:00+00'::TIMESTAMPTZ);

SELECT * FROM generate_series('2024-07-01 12:00:00+00'::TIMESTAMPTZ, '2024-07-12 12:00:00+00'::TIMESTAMPTZ, INTERVAL 3 DAY);

SET Calendar='islamic-tbla';

SELECT ts, year(ts), month(ts), day(ts), era(ts), dayofyear(ts) FROM (VALUES
  ('2024-06-15 12:00:00+00'::TIMESTAMPTZ), ('0622-07-19 12:00:00+00'), ('0622-07-18 12:00:00+00'),
  ('1970-01-01 00:00:00+00'), ('2024-07-07 12:00:00+00'), ('1000-01-01 12:00:00+00')) t(ts);

SELECT ts, year(ts), month(ts), day(ts), era(ts), dayofyear(ts) FROM (VALUES
  ('2024-06-15 12:00:00+00'::TIMESTAMPTZ), ('1882-11-12 12:00:00+00'), ('1882-11-11 12:00:00+00'),
  ('1970-01-01 00:00:00+00'), ('2024-07-07 12:00:00+00'), ('2024-07-08 12:00:00+00'),
  ('2077-11-16 12:00:00+00'), ('2077-11-17 12:00:00+00'), ('2200-01-01 12:00:00+00'),
  ('1000-01-01 12:00:00+00'), ('1900-01-01 12:00:00+00'), ('2000-01-01 12:00:00+00')) t(ts);

SELECT make_timestamptz(1300, 1, 1, 0, 0, 0.0, 'UTC');

SELECT make_timestamptz(1600, 12, 29, 0, 0, 0.0, 'UTC');

SELECT make_timestamptz(1601, 1, 1, 0, 0, 0.0, 'UTC');

SELECT make_timestamptz(1299, 1, 1, 0, 0, 0.0, 'UTC');

SELECT count(*), min(y), max(y) FROM (SELECT year(ts) y FROM generate_series('1880-01-01 12:00:00+00'::TIMESTAMPTZ, '2180-01-01 12:00:00+00'::TIMESTAMPTZ, INTERVAL 37 DAY) t(ts));

SELECT sum(hash(ts::VARCHAR)) FROM generate_series('1880-01-01 12:00:00+00'::TIMESTAMPTZ, '2180-01-01 12:00:00+00'::TIMESTAMPTZ, INTERVAL 11 DAY) t(ts);

SET Calendar='islamic';

SELECT ts, year(ts), month(ts), day(ts), era(ts), dayofyear(ts) FROM (VALUES
  ('2024-06-15 12:00:00+00'::TIMESTAMPTZ), ('0622-07-19 12:00:00+00'), ('0622-07-15 12:00:00+00'),
  ('1970-01-01 00:00:00+00'), ('2024-07-07 12:00:00+00'), ('2024-07-08 12:00:00+00'),
  ('2024-03-10 12:00:00+00'), ('2024-03-11 12:00:00+00'), ('2024-04-09 12:00:00+00'),
  ('1900-01-01 12:00:00+00'), ('2100-01-01 12:00:00+00'), ('1500-01-01 12:00:00+00')) t(ts);

SELECT make_timestamptz(1445, 9, 1, 0, 0, 0.0, 'UTC');

SELECT last_day('2024-03-15 12:00:00+00'::TIMESTAMPTZ);

SELECT count(*), sum(hash(ts::VARCHAR)) FROM generate_series('1950-01-01 12:00:00+00'::TIMESTAMPTZ, '2050-01-01 12:00:00+00'::TIMESTAMPTZ, INTERVAL 5 DAY) t(ts);

SET Calendar='islamic-rgsa';

SELECT ts, year(ts), month(ts), day(ts), era(ts), dayofyear(ts) FROM (VALUES
  ('2024-06-15 12:00:00+00'::TIMESTAMPTZ), ('0622-07-19 12:00:00+00'), ('1970-01-01 00:00:00+00'),
  ('2024-07-07 12:00:00+00'), ('1500-01-01 12:00:00+00')) t(ts);

SELECT ts, era(ts), year(ts), month(ts), day(ts) FROM (VALUES
  ('2024-06-15 12:00:00+00'::TIMESTAMPTZ), ('2019-04-30 12:00:00+00'), ('2019-05-01 12:00:00+00'),
  ('1989-01-07 12:00:00+00'), ('1989-01-08 12:00:00+00'), ('1926-12-24 12:00:00+00'),
  ('1926-12-25 12:00:00+00'), ('1912-07-29 12:00:00+00'), ('1912-07-30 12:00:00+00'),
  ('1868-10-22 12:00:00+00'), ('1868-10-23 12:00:00+00'), ('0645-06-18 12:00:00+00'),
  ('0645-06-19 12:00:00+00'), ('0600-01-01 12:00:00+00'), ('1582-10-04 12:00:00+00'),
  ('1582-10-15 12:00:00+00')) t(ts);

SELECT make_timestamptz(6, 6, 15, 12, 0, 0.0, 'UTC');

SELECT make_timestamptz(31, 4, 30, 12, 0, 0.0, 'UTC');

SELECT make_timestamptz(64, 1, 7, 12, 0, 0.0, 'UTC');

SELECT date_trunc('year', '2019-06-15 12:00:00+00'::TIMESTAMPTZ);

SELECT date_trunc('era', '2024-06-15 12:00:00+00'::TIMESTAMPTZ);

SELECT '2024-06-15 12:00:00+00'::TIMESTAMPTZ + INTERVAL 1 YEAR;

SELECT '2019-04-30 12:00:00+00'::TIMESTAMPTZ + INTERVAL 1 YEAR;

SELECT '2019-04-30 12:00:00+00'::TIMESTAMPTZ + INTERVAL 1 MONTH;

SELECT '2019-04-30 12:00:00+00'::TIMESTAMPTZ + INTERVAL 1 DAY;

SELECT date_diff('year', '2019-01-01 12:00:00+00'::TIMESTAMPTZ, '2024-06-15 12:00:00+00'::TIMESTAMPTZ);

SELECT count(*), count(distinct era) FROM (SELECT era(ts) era FROM generate_series('0600-01-01 12:00:00+00'::TIMESTAMPTZ, '2100-01-01 12:00:00+00'::TIMESTAMPTZ, INTERVAL 31 DAY) t(ts));

SELECT sum(hash(ts::VARCHAR)) FROM generate_series('0600-01-01 12:00:00+00'::TIMESTAMPTZ, '2100-01-01 12:00:00+00'::TIMESTAMPTZ, INTERVAL 13 DAY) t(ts);

SET Calendar='persian';

SELECT ts, year(ts), month(ts), day(ts), era(ts), dayofyear(ts) FROM (VALUES
  ('2024-06-15 12:00:00+00'::TIMESTAMPTZ), ('0622-03-21 12:00:00+00'), ('0622-03-22 12:00:00+00'),
  ('1970-01-01 00:00:00+00'), ('2024-03-19 12:00:00+00'), ('2024-03-20 12:00:00+00'),
  ('2025-03-20 12:00:00+00'), ('2025-03-21 12:00:00+00'), ('2123-03-20 12:00:00+00'),
  ('2124-03-20 12:00:00+00'), ('1500-01-01 12:00:00+00'), ('0001-01-01 12:00:00+00')) t(ts);

SELECT make_timestamptz(1403, 1, 1, 0, 0, 0.0, 'UTC');

SELECT make_timestamptz(1403, 12, 29, 0, 0, 0.0, 'UTC');

SELECT make_timestamptz(1403, 12, 30, 0, 0, 0.0, 'UTC');

SELECT make_timestamptz(1402, 12, 30, 0, 0, 0.0, 'UTC');

SELECT '2024-06-15 12:00:00+00'::TIMESTAMPTZ + INTERVAL 1 MONTH;

SELECT '2024-03-20 12:00:00+00'::TIMESTAMPTZ - INTERVAL 1 DAY;

SELECT last_day('2025-03-01 12:00:00+00'::TIMESTAMPTZ);

SELECT * FROM generate_series('2024-03-15 12:00:00+00'::TIMESTAMPTZ, '2024-03-25 12:00:00+00'::TIMESTAMPTZ, INTERVAL 2 DAY);

SELECT ts, year(ts), month(ts), day(ts), era(ts), dayofyear(ts) FROM (VALUES
  ('2024-06-15 12:00:00+00'::TIMESTAMPTZ), ('0079-03-22 12:00:00+00'), ('0078-03-22 12:00:00+00'),
  ('1970-01-01 00:00:00+00'), ('2024-03-20 12:00:00+00'), ('2024-03-21 12:00:00+00'),
  ('2023-03-21 12:00:00+00'), ('2023-03-22 12:00:00+00'), ('2024-12-31 12:00:00+00'),
  ('2025-01-01 12:00:00+00'), ('0001-01-01 12:00:00+00')) t(ts);

SELECT make_timestamptz(1946, 1, 1, 0, 0, 0.0, 'UTC');

SELECT make_timestamptz(1946, 1, 31, 0, 0, 0.0, 'UTC');

SELECT make_timestamptz(1945, 1, 31, 0, 0, 0.0, 'UTC');

SELECT make_timestamptz(1946, 12, 30, 0, 0, 0.0, 'UTC');

SELECT last_day('2024-04-01 12:00:00+00'::TIMESTAMPTZ);

SELECT * FROM generate_series('2024-03-18 12:00:00+00'::TIMESTAMPTZ, '2024-03-26 12:00:00+00'::TIMESTAMPTZ, INTERVAL 2 DAY);

SET Calendar='chinese';

SELECT year(TIMESTAMPTZ '2024-01-10 04:00:00+00') > 0;

SET TimeZone='America/New_York';

SET Calendar='buddhist';

SELECT ts, year(ts), month(ts), day(ts), era(ts) FROM (VALUES
  ('2024-01-15 12:00:00-05'::TIMESTAMPTZ), ('1970-01-01 00:00:00-05'), ('0001-01-01 12:00:00-05'),
  ('0544-01-01 (BC) 12:00:00-04:56'), ('1582-10-04 12:00:00-04:56'), ('1582-10-15 12:00:00-04:56'),
  ('1000-06-15 12:00:00-04:56'), ('9999-12-31 12:00:00-05')) t(ts);

SELECT make_timestamptz(2567, 1, 15, 12, 0, 0.0, 'UTC');

SELECT '2024-01-15 12:00:00-05'::TIMESTAMPTZ + INTERVAL 1 YEAR;

SELECT '2024-01-15 12:00:00-05'::TIMESTAMPTZ + INTERVAL 13 MONTH;

SELECT date_trunc('year', '2024-06-15 12:00:00-04'::TIMESTAMPTZ);

SELECT date_trunc('decade', '2024-06-15 12:00:00-04'::TIMESTAMPTZ);

SELECT date_trunc('century', '2024-06-15 12:00:00-04'::TIMESTAMPTZ);

SELECT date_diff('year', '0001-01-01 12:00:00-04:56'::TIMESTAMPTZ, '2024-01-01 12:00:00-05'::TIMESTAMPTZ);

SELECT last_day('2024-02-15 12:00:00-05'::TIMESTAMPTZ);

SELECT date_part(['year','month','day','era','dayofyear','week','isoyear'], '2024-06-15 12:00:00-04'::TIMESTAMPTZ);

SET Calendar='roc';

SELECT ts, year(ts), month(ts), day(ts), era(ts) FROM (VALUES
  ('2024-01-15 12:00:00-05'::TIMESTAMPTZ), ('1912-01-01 12:00:00-05'), ('1911-12-31 12:00:00-05'),
  ('1911-01-01 12:00:00-05'), ('1800-01-01 12:00:00-04:56'), ('1582-10-04 12:00:00-04:56'),
  ('1582-10-15 12:00:00-04:56'), ('0001-01-01 12:00:00-04:56')) t(ts);

SELECT make_timestamptz(113, 1, 15, 12, 0, 0.0, 'UTC');

SELECT '1912-01-01 12:00:00-05'::TIMESTAMPTZ - INTERVAL 1 YEAR;

SELECT date_diff('year', '1900-01-01 12:00:00-04:56'::TIMESTAMPTZ, '2024-01-01 12:00:00-05'::TIMESTAMPTZ);

SET Calendar='iso8601';

SELECT ts, year(ts), week(ts), isoyear(ts), dayofweek(ts) FROM (VALUES
  ('2024-01-01 12:00:00-05'::TIMESTAMPTZ), ('2023-01-01 12:00:00-05'), ('2021-01-01 12:00:00-05'),
  ('2020-12-31 12:00:00-05'), ('2019-12-30 12:00:00-05'), ('2016-01-03 12:00:00-05'),
  ('2016-01-04 12:00:00-05'), ('1000-06-15 12:00:00-04:56')) t(ts);

SELECT date_trunc('week', '2024-06-15 12:00:00-04'::TIMESTAMPTZ);

SELECT date_trunc('isoyear', '2024-01-01 12:00:00-05'::TIMESTAMPTZ);

SELECT date_diff('week', '2024-01-01 12:00:00-05'::TIMESTAMPTZ, '2024-12-31 12:00:00-05'::TIMESTAMPTZ);

SELECT make_timestamptz(2024, 6, 15, 12, 0, 0.0, 'UTC');

SELECT date_part(['year','month','day','era','dayofyear','week','isoyear','yearweek'], '2024-06-15 12:00:00-04'::TIMESTAMPTZ);

SELECT * FROM generate_series('2024-01-01 12:00:00-05'::TIMESTAMPTZ, '2024-02-01 12:00:00-05'::TIMESTAMPTZ, INTERVAL 1 WEEK);

SELECT ts, year(ts), month(ts), day(ts), dayofyear(ts) FROM (VALUES
  ('1582-10-01 12:00:00+00'::TIMESTAMPTZ), ('1582-10-04 12:00:00+00'), ('1582-10-05 12:00:00+00'),
  ('1582-10-14 12:00:00+00'), ('1582-10-15 12:00:00+00'), ('1582-12-31 12:00:00+00'),
  ('1500-02-28 12:00:00+00'), ('1700-02-28 12:00:00+00')) t(ts);

SELECT ts, year(ts), month(ts), day(ts), dayofyear(ts) FROM (VALUES
  ('1582-10-04 12:00:00+00'::TIMESTAMPTZ), ('1582-10-15 12:00:00+00'), ('1500-02-28 12:00:00+00')) t(ts);

SELECT name FROM icu_calendar_names() ORDER BY 1;

CREATE TABLE tstzs AS 
	FROM VALUES ('2026-04-09 11:48:07.123456-07'::TIMESTAMPTZ) tbl(t);

CREATE TABLE tsns AS
	FROM VALUES ('2021-01-01 00:00:00.000000123'::TIMESTAMP_NS) tbl(t);

select t::TIMESTAMP_NS from tstzs;

SELECT TIMESTAMPTZ_NS '2021-01-01 00:00:00.000000123+00'::TIMESTAMP_NS;

select t::TIMESTAMPTZ_NS from tsns;

select t::TIMESTAMP from tstzs;

select t::TIMESTAMP_MS from tstzs;

select t::TIMESTAMP_S from tstzs;

select t::DATE from tstzs;

SELECT TRY_CAST(TIMESTAMPTZ '2262-04-11 23:47:16.854776+00' AS TIMESTAMP_NS);

SELECT t::VARCHAR AS formatted, epoch_ns(t) AS nanoseconds
FROM (
    VALUES ('1969-12-31 23:59:59.999999999+00'::TIMESTAMPTZ_NS)
) v(t);

SELECT TRY_CAST(TIMESTAMPTZ '9999-01-01 00:00:00+00' AS TIMESTAMP_NS);

SELECT TRY_CAST(TIMESTAMPTZ '2026-04-09 11:48:07.123456-07' AS TIMESTAMP_NS);

SELECT TRY_CAST(DATE '5877642-06-25' AS TIMESTAMPTZ);

SELECT 1;

SELECT date_add('2000-01-01 00:00:00+00'::TIMESTAMPTZ, INTERVAL 3 MONTH);

SELECT date_add('2000-01-31 00:00:00+00'::TIMESTAMPTZ, INTERVAL 1 MONTH);

SELECT '2000-01-01 00:00:00+00'::TIMESTAMPTZ - INTERVAL 1 MONTH;

SET TimeZone='Asia/Kathmandu';

SELECT (TIMESTAMPTZ '1900-01-01 00:00:00+00')::VARCHAR;

SELECT (TIMESTAMPTZ '1900-01-01 00:00:00+00')::VARCHAR::TIMESTAMPTZ = TIMESTAMPTZ '1900-01-01 00:00:00+00';

SET TimeZone='Europe/Amsterdam';

SELECT (TIMESTAMPTZ '2020-06-01 00:00:00+00')::VARCHAR;

SELECT (TIMESTAMPTZ '2020-01-01 00:00:00+00')::VARCHAR;

SELECT s::TIMESTAMPTZ FROM (VALUES (1, '2024-01-01 00:00:00 Asia/Tokyo'), (2, '2024-01-01 00:00:00'), (3, '2024-01-01 00:00:00 America/New_York'), (4, '2024-01-01 00:00:00')) t(i, s) ORDER BY i;

SELECT s::TIMESTAMPTZ_NS FROM (VALUES (1, '2024-01-01 00:00:00 Asia/Tokyo'), (2, '2024-01-01 00:00:00')) t(i, s) ORDER BY i;

SELECT strptime(s, ['%Y-%m-%d %H:%M:%S %Z', '%Y-%m-%d %H:%M:%S']) FROM (VALUES (1, '2024-01-01 00:00:00 Asia/Tokyo'), (2, '2024-01-01 00:00:00')) t(i, s) ORDER BY i;

SELECT try_strptime(s, ['%Y-%m-%d %H:%M:%S %Z', '%Y-%m-%d %H:%M:%S']) FROM (VALUES (1, '2024-01-01 00:00:00 Asia/Tokyo'), (2, '2024-01-01 00:00:00'), (3, '2024-01-01 00:00:00 Not/AZone')) t(i, s) ORDER BY i;

SELECT s::TIMESTAMPTZ FROM (VALUES (1, '2024-01-01 00:00:00 Asia/Tokyo'), (2, '2024-01-01 00:00:00')) t(i, s) ORDER BY i;

SELECT name, value, description, input_type, scope FROM duckdb_settings() WHERE name = 'TimeZone';

SELECT  '2001-02-16 20:38:40'::TIMESTAMP AT TIME ZONE 'America/Denver';

SELECT '2001-02-16 20:38:40-05'::TIMESTAMPTZ AT TIME ZONE 'America/Denver';

SELECT  NULL::TIMESTAMP AT TIME ZONE 'America/Denver';

SELECT NULL::TIMESTAMPTZ AT TIME ZONE 'America/Denver';

SELECT  '2001-02-16 20:38:40'::TIMESTAMP AT TIME ZONE NULL;

SELECT '2001-02-16 20:38:40-05'::TIMESTAMPTZ AT TIME ZONE NULL;

select '12:15:37.123456-08'::TIMETZ AT TIME ZONE 'America/Phoenix';

select timezone('America/Phoenix', '12:15:37.123456-08'::TIMETZ);

SELECT '2020-01-01'::DATE::TIMESTAMPTZ AS dttz;

SELECT 'infinity'::DATE::TIMESTAMPTZ AS dttz;

SELECT '-infinity'::DATE::TIMESTAMPTZ AS dttz;

CREATE TABLE attimezone (ts TIMESTAMP, tstz TIMESTAMPTZ, ttz TIMETZ, tz VARCHAR);

INSERT INTO attimezone (VALUES
	('2001-02-16 20:38:40', '2001-02-16 19:38:40-08', '19:38:40-08', 'America/Phoenix'),
	('2001-02-16 18:38:40', '2001-02-16 20:38:40-05', '20:38:40-05', 'America/Phoenix'),
	('infinity', 'infinity', '19:38:40-08', 'America/Phoenix'),
	('-infinity', '-infinity', '20:38:40-05', 'America/Phoenix'),
	(NULL, NULL, NULL, 'America/Phoenix'),
	('2001-02-16 20:38:40', '2001-02-16 19:38:40-08', '19:38:40+08', 'UTC'),
	('2001-02-16 18:38:40', '2001-02-16 20:38:40-05', '20:38:40+15:59', 'UTC'),
	('infinity', 'infinity', '12:15:37.123456-08', 'UTC'),
	('-infinity', '-infinity', '20:38:40-15:59', 'UTC'),
	(NULL, NULL, NULL, 'UTC'),
	('2001-02-16 20:38:40', '2001-02-16 19:38:40-08', '19:38:40-08', NULL),
	('2001-02-16 18:38:40', '2001-02-16 20:38:40-05', '20:38:40-05', NULL),
	('infinity', 'infinity', '12:15:37.123456-08', NULL),
	('-infinity', '-infinity', '20:38:40-15:59', NULL),
);

SELECT ts AT TIME ZONE tz, tstz AT TIME ZONE tz, ttz AT TIME ZONE tz
FROM attimezone;

SELECT ts AT TIME ZONE tz, tstz AT TIME ZONE tz, ttz AT TIME ZONE tz
FROM attimezone
WHERE ts > '2001-02-16 18:38:40'::TIMESTAMP;

SELECT DATE '2026-11-01' AT TIME ZONE 'Asia/Shanghai';

SELECT typeof(DATE '2026-11-01' AT TIME ZONE 'Asia/Shanghai');

SELECT DATE '2026-11-01' AT TIME ZONE 'Asia/Shanghai' AT TIME ZONE 'UTC' <= now();

SELECT  '2019-01-01 00:00:00.123456789+00'::TIMESTAMPTZ_NS AT TIME ZONE 'UTC';

SELECT '2019-01-01 00:00:00.123456789'::TIMESTAMP_NS AT TIME ZONE 'UTC' t;

select value from duckdb_settings() where name = 'TimeZone';

select localtimestamp;

select localtime;

select current_localtimestamp();

select current_localtime();

SELECT name, abbrev FROM pg_timezone_names() ORDER BY name;

SET TimeZone = 'Asia/Amman';

SELECT '2022-10-29 00:00:00+00'::TIMESTAMPTZ;

SET TimeZone = 'America/Chihuahua';

SELECT '2022-11-01 00:00:00+00'::TIMESTAMPTZ;

SET TimeZone = 'America/Ciudad_Juarez';

SELECT '2023-05-01 12:00:00+00'::TIMESTAMPTZ;

SET TimeZone = 'Egypt';

SELECT '2023-05-15 12:00:00+00'::TIMESTAMPTZ;

SET TimeZone = 'Asia/Beirut';

SELECT '2023-03-26 12:00:00+00'::TIMESTAMPTZ, '2023-04-21 12:00:00+00'::TIMESTAMPTZ;

SET TimeZone = 'America/Nuuk';

SELECT '2022-10-30 03:00:00-07'::TIMESTAMPTZ, '2023-10-30 02:00:00-07'::TIMESTAMPTZ;

SET TimeZone = 'America/Scoresbysund';

SELECT '2024-03-31 00:59:00-01'::TIMESTAMPTZ, '2024-03-31 01:00:00-01'::TIMESTAMPTZ;

SET TimeZone = 'Asia/Almaty';

select '2024-02-29 00:00:00+06'::TIMESTAMPTZ, '2024-03-01 01:00:00+06'::TIMESTAMPTZ;

SET TimeZone = 'Atlantic/Azores';

select '1981-09-27 01:00:00+00'::TIMESTAMPTZ;

set timezone='America/Asuncion';

select '2025-03-23'::timestamptz;

select utc_offset, is_dst
from pg_timezone_names() 
where name = 'America/Asuncion';

set timezone='America/Coyhaique';

select '2025-04-05'::timestamptz;

select utc_offset, is_dst
from pg_timezone_names() 
where name = 'America/Coyhaique';

set timezone='Mexico/BajaNorte';

select '1962-07-31'::timestamptz;

set timezone='Europe/Chisinau';

select 
	'2022-03-27 02:00:00+02'::timestamptz,
	'2022-03-27 03:00:00+02'::timestamptz,
	'2022-10-30 03:00:00+03'::timestamptz,
	'2022-10-30 04:00:00+03'::timestamptz,;

set timezone='America/Vancouver';

select '2026-11-10'::timestamptz;

set TimeZone = 'America/Edmonton';

select '2026-12-01'::TIMESTAMPTZ;

set timezone='America/Yellowknife';

select '2026-11-02'::TIMESTAMPTZ;

set timezone='America/Winnipeg';

set timezone='America/Havana';

SELECT ts, ts::TIMESTAMPTZ FROM (VALUES
  ('2024-03-10 01:59:59'::TIMESTAMP), ('2024-03-10 02:00:00'), ('2024-03-10 02:30:00'),
  ('2024-03-10 02:59:59'), ('2024-03-10 03:00:00'),
  ('2024-11-03 00:59:59'), ('2024-11-03 01:00:00'), ('2024-11-03 01:30:00'),
  ('2024-11-03 01:59:59'), ('2024-11-03 02:00:00')) t(ts);

SET TimeZone='Australia/Lord_Howe';

SELECT ts, ts::TIMESTAMPTZ FROM (VALUES
  ('2024-04-07 01:29:59'::TIMESTAMP), ('2024-04-07 01:30:00'), ('2024-04-07 01:45:00'),
  ('2024-10-06 01:59:59'), ('2024-10-06 02:00:00'), ('2024-10-06 02:15:00')) t(ts);

SET TimeZone='Pacific/Apia';

SELECT ts, ts::TIMESTAMPTZ FROM (VALUES
  ('2011-12-29 23:59:59'::TIMESTAMP), ('2011-12-30 00:00:00'), ('2011-12-30 12:00:00'),
  ('2011-12-31 00:00:00'), ('2011-12-31 23:59:59')) t(ts);

SELECT '2011-12-29 23:59:59+13'::TIMESTAMPTZ + INTERVAL 1 DAY;

SELECT '2011-12-29 23:59:59+13'::TIMESTAMPTZ + INTERVAL 1 MONTH;

SET TimeZone='Europe/Dublin';

SELECT ts, ts::TIMESTAMPTZ, date_part('timezone', ts::TIMESTAMPTZ) FROM (VALUES
  ('2024-01-15 12:00:00'::TIMESTAMP), ('2024-07-15 12:00:00'),
  ('1970-01-15 12:00:00'), ('1970-07-15 12:00:00')) t(ts);

SELECT ts, ts::TIMESTAMPTZ FROM (VALUES
  ('1800-01-01 00:00:00'::TIMESTAMP), ('1900-01-01 00:00:00'),
  ('1937-06-30 23:59:59'), ('1937-07-01 00:00:00')) t(ts);

SELECT ts, ts::TIMESTAMPTZ FROM (VALUES
  ('1500-01-01 00:00:00'::TIMESTAMP), ('1919-12-31 00:00:00'),
  ('1986-01-01 00:00:00')) t(ts);

SELECT ts, ts::TIMESTAMPTZ FROM (VALUES
  ('4000-01-01 (BC) 00:00:00'::TIMESTAMP), ('0001-01-01 00:00:00'),
  ('1582-10-04 00:00:00'), ('1582-10-15 00:00:00'),
  ('9999-12-31 23:59:59'), ('99999-01-01 00:00:00')) t(ts);

SELECT part, date_trunc(part, '2024-03-10 03:30:00-04'::TIMESTAMPTZ)
FROM (VALUES ('millennium'),('century'),('decade'),('year'),('quarter'),('month'),('week'),
             ('day'),('hour'),('minute'),('second'),('millisecond'),('microsecond')) t(part);

SELECT part, date_trunc(part, '2024-11-03 01:30:00-05'::TIMESTAMPTZ)
FROM (VALUES ('year'),('quarter'),('month'),('week'),('day'),('hour'),('minute')) t(part);

SELECT part, date_part(part, '2024-03-10 03:30:00-04'::TIMESTAMPTZ)
FROM (VALUES ('era'),('year'),('quarter'),('month'),('day'),('dayofweek'),('isodow'),
             ('dayofyear'),('week'),('isoyear'),('yearweek'),('hour'),('minute'),('second'),
             ('timezone'),('timezone_hour'),('timezone_minute')) t(part);

SELECT date_part('epoch', '2024-03-10 03:30:00-04'::TIMESTAMPTZ);

SELECT i, '2024-03-09 12:00:00-05'::TIMESTAMPTZ + i FROM (VALUES
  (INTERVAL 1 DAY), (INTERVAL 24 HOUR), (INTERVAL 1 MONTH), (INTERVAL 1 YEAR),
  (INTERVAL '1 day 2 hours'), (-INTERVAL 1 DAY), (-INTERVAL 24 HOUR)) t(i);

SELECT i, '2024-11-02 12:00:00-04'::TIMESTAMPTZ + i FROM (VALUES
  (INTERVAL 1 DAY), (INTERVAL 24 HOUR), (INTERVAL 1 MONTH), (-INTERVAL 1 DAY)) t(i);

SELECT ts, ts + INTERVAL 1 MONTH, ts + INTERVAL 1 YEAR FROM (VALUES
  ('2024-01-31 12:00:00-05'::TIMESTAMPTZ), ('2024-02-29 12:00:00-05'),
  ('2023-03-31 12:00:00-04'), ('2024-05-31 12:00:00-04')) t(ts);

SELECT age('2024-03-11 12:00:00-04'::TIMESTAMPTZ, '2024-03-09 12:00:00-05'::TIMESTAMPTZ);

SELECT age('2025-03-09 12:00:00-05'::TIMESTAMPTZ, '2024-03-09 12:00:00-05'::TIMESTAMPTZ);

SELECT age('2024-02-29 12:00:00-05'::TIMESTAMPTZ, '2020-02-29 12:00:00-05'::TIMESTAMPTZ);

SELECT part, date_diff(part, '2024-03-09 12:00:00-05'::TIMESTAMPTZ, '2024-11-05 12:00:00-05'::TIMESTAMPTZ)
FROM (VALUES ('year'),('quarter'),('month'),('week'),('day'),('hour'),('minute')) t(part);

SELECT make_timestamptz(2024, 3, 10, 2, 30, 0.0, 'America/New_York');

SELECT make_timestamptz(2024, 13, 1, 0, 0, 0.0, 'UTC');

SELECT make_timestamptz(2024, 0, 1, 0, 0, 0.0, 'UTC');

SELECT make_timestamptz(2024, 2, 30, 0, 0, 0.0, 'UTC');

SELECT make_timestamptz(2024, 1, 1, 25, 70, 90.5, 'UTC');

SELECT make_timestamptz(0, 1, 1, 0, 0, 0.0, 'UTC');

SELECT make_timestamptz(-1, 1, 1, 0, 0, 0.0, 'UTC');

SELECT make_timestamptz(-4713, 11, 24, 12, 0, 0.0, 'UTC');

SELECT b, time_bucket(b, '2024-03-10 03:30:00-04'::TIMESTAMPTZ) FROM (VALUES
  (INTERVAL 1 DAY), (INTERVAL 2 DAY), (INTERVAL 1 MONTH), (INTERVAL 1 HOUR),
  (INTERVAL 30 MINUTE), (INTERVAL 1 YEAR)) t(b);

SELECT * FROM generate_series('2024-03-09 12:00:00-05'::TIMESTAMPTZ, '2024-03-12 12:00:00-04'::TIMESTAMPTZ, INTERVAL 1 DAY);

SELECT * FROM generate_series('2024-11-02 12:00:00-04'::TIMESTAMPTZ, '2024-11-05 12:00:00-05'::TIMESTAMPTZ, INTERVAL 1 DAY);

SELECT strptime('2024-03-10 02:30:00', '%Y-%m-%d %H:%M:%S')::TIMESTAMPTZ;

SELECT strptime('2024-03-10 02:30:00 +0530', '%Y-%m-%d %H:%M:%S %z');

SELECT strptime('2024-11-03 01:30:00', '%Y-%m-%d %H:%M:%S')::TIMESTAMPTZ;

SELECT strftime('2024-03-10 03:30:00-04'::TIMESTAMPTZ, '%Y-%m-%d %H:%M:%S %Z');

SELECT timezone('America/New_York', '2024-03-10 02:30:00'::TIMESTAMP);

SELECT timezone('America/New_York', '2024-11-03 01:30:00'::TIMESTAMP);

SELECT timezone('America/New_York', '2024-03-10 07:30:00+00'::TIMESTAMPTZ);

SELECT ts, last_day(ts), monthname(ts), dayname(ts) FROM (VALUES
  ('2024-02-15 12:00:00+00'::TIMESTAMPTZ), ('2023-02-15 12:00:00+00'),
  ('2024-12-31 23:59:59+00'), ('2024-01-01 00:00:00+00')) t(ts);

SELECT '2024-03-10 03:30:00-04'::TIMESTAMPTZ::TIMETZ;

SELECT '2024-01-10 03:30:00-05'::TIMESTAMPTZ::TIMETZ;

SELECT timezone('Asia/Kathmandu', '12:00:00+00'::TIMETZ);

SELECT '2038-01-19 03:14:07+00'::TIMESTAMPTZ;

SELECT '2038-01-19 03:14:08+00'::TIMESTAMPTZ;

SELECT '2038-01-15 12:00:00+00'::TIMESTAMPTZ, '2038-07-15 12:00:00+00'::TIMESTAMPTZ;

SELECT '2099-01-15 12:00:00+00'::TIMESTAMPTZ, '2099-07-15 12:00:00+00'::TIMESTAMPTZ;

SELECT '2500-07-15 12:00:00+00'::TIMESTAMPTZ;

SELECT '2045-03-12 06:59:59+00'::TIMESTAMPTZ, '2045-03-12 07:00:00+00'::TIMESTAMPTZ;

SELECT '2045-11-05 05:59:59+00'::TIMESTAMPTZ, '2045-11-05 06:00:00+00'::TIMESTAMPTZ;

CREATE MACRO transitions(zone) AS TABLE
    WITH days(day) AS (
        SELECT '2038-01-01'::DATE + to_days(i::INTEGER) FROM range(23000) t(i)
    ), offsets AS (
        SELECT day,
               epoch(timezone(zone, day::TIMESTAMP + INTERVAL 12 HOUR)) - epoch(day::TIMESTAMP + INTERVAL 12 HOUR)
                   AS off
        FROM days
    ), changes AS (
        SELECT day, off, lag(off) OVER (ORDER BY day) AS previous FROM offsets
    )
    SELECT day, previous > off AS starts_daylight_saving
    FROM changes WHERE previous IS NOT NULL AND off <> previous;

SELECT count(*),
       count(*) FILTER (WHERE dayname(day) <> 'Sunday'),
       count(*) FILTER (WHERE starts_daylight_saving AND (month(day) <> 3 OR ((day(day) - 1) // 7) + 1 <> 2)),
       count(*) FILTER (WHERE NOT starts_daylight_saving AND (month(day) <> 11 OR ((day(day) - 1) // 7) + 1 <> 1))
FROM transitions('America/New_York');

SELECT count(*),
       count(*) FILTER (WHERE dayname(day) <> 'Sunday'),
       count(*) FILTER (WHERE starts_daylight_saving AND (month(day) <> 3 OR day(day) + 7 <= 31)),
       count(*) FILTER (WHERE NOT starts_daylight_saving AND (month(day) <> 10 OR day(day) + 7 <= 31))
FROM transitions('Europe/Berlin');

SELECT count(*),
       count(*) FILTER (WHERE dayname(day) <> 'Sunday'),
       count(DISTINCT month(day))
FROM transitions('Australia/Sydney');

SELECT count(*) FROM transitions('Asia/Tokyo');

SELECT count(*) FROM transitions('Asia/Kolkata');

SELECT year('2044-02-29 12:00:00+00'::TIMESTAMPTZ), dayofyear('2044-12-31 12:00:00+00'::TIMESTAMPTZ);

SELECT '2038-01-19 03:14:07+00'::TIMESTAMPTZ + INTERVAL 10 YEAR;

SELECT date_diff('day', '2037-01-01 00:00:00+00'::TIMESTAMPTZ, '2045-01-01 00:00:00+00'::TIMESTAMPTZ);

SELECT date_diff('year', '2000-01-01 00:00:00+00'::TIMESTAMPTZ, '2100-01-01 00:00:00+00'::TIMESTAMPTZ);

SELECT date_trunc('year', '2045-07-04 12:00:00+00'::TIMESTAMPTZ);

SELECT count(*) FROM (
    SELECT dayofweek(ts) AS dow,
           lag(dayofweek(ts)) OVER (ORDER BY ts) AS previous
    FROM (SELECT '2037-06-01 12:00:00+00'::TIMESTAMPTZ + to_days(i::INTEGER) AS ts FROM range(1000) t(i))
) WHERE previous IS NOT NULL AND dow <> (previous + 1) % 7;

CREATE TEMP TABLE windows AS
SELECT ('2015-01-01'::DATE + (y * INTERVAL 1 YEAR) + (d * INTERVAL 1 DAY))::TIMESTAMPTZ AS start,
       y * 1000 + d AS id
FROM range(10) a(y), (VALUES (0),(59),(80),(100),(120),(170),(260),(280),(300),(310),(330),(364)) b(d);

CREATE TEMP TABLE instants AS
SELECT start + (h * INTERVAL 1 HOUR) AS ts, id FROM windows, range(48) c(h);

CREATE TEMP TABLE converted AS
SELECT name, id, ts, timezone(name, ts) AS local FROM pg_timezone_names(), instants;

SELECT count(*), count(DISTINCT name) FROM converted;

SELECT count(*) FILTER (WHERE timezone(name, local) <> ts),
       count(*) FILTER (WHERE timezone(name, local) < ts),
       max(epoch(timezone(name, local) - ts))
FROM converted;

SELECT name, max(epoch(timezone(name, local) - ts)) shift FROM converted
WHERE timezone(name, local) <> ts GROUP BY name HAVING shift > 3600 ORDER BY 1;

SELECT count(*), min(step), max(step), count(*) FILTER (WHERE step <> 3600)
FROM (SELECT epoch(local - lag(local) OVER (PARTITION BY name, id ORDER BY ts)) AS step FROM converted)
WHERE step IS NOT NULL;

SELECT max(abs(epoch(local - ts::TIMESTAMP))),
       count(*) FILTER (WHERE epoch(local - ts::TIMESTAMP) <> floor(epoch(local - ts::TIMESTAMP)))
FROM converted;

SELECT CAST(CAST('2020-01-02 03:04:05.123456789+00' AS TIMESTAMPTZ_NS) AS DATE), CAST(CAST('2020-01-02 03:04:05.123456+00' AS TIMESTAMPTZ) AS DATE);

SELECT CAST(CAST('2020-01-01 23:59:59.999999999-08' AS TIMESTAMPTZ_NS) AS DATE);

SELECT CAST(CAST('1969-12-31 23:59:59.999999999+00' AS TIMESTAMPTZ_NS) AS DATE);

SELECT CAST('infinity'::TIMESTAMPTZ_NS AS DATE), CAST('-infinity'::TIMESTAMPTZ_NS AS DATE), CAST(NULL::TIMESTAMPTZ_NS AS DATE);

SELECT CAST(CAST('2020-01-02 03:04:05.123456789+00' AS TIMESTAMPTZ_NS) AS DATE);

SELECT CAST(CAST('2020-01-02 03:04:05.123456789+00' AS TIMESTAMPTZ_NS) AS TIMESTAMP), CAST(CAST('2020-01-02 03:04:05.123456499+00' AS TIMESTAMPTZ_NS) AS TIMESTAMP);

SELECT CAST(CAST('1969-12-31 23:59:59.123456789+00' AS TIMESTAMPTZ_NS) AS TIMESTAMP), CAST(CAST('1969-12-31 23:59:59.999999999+00' AS TIMESTAMPTZ_NS) AS TIMESTAMP);

SELECT CAST('infinity'::TIMESTAMPTZ_NS AS TIMESTAMP), CAST('-infinity'::TIMESTAMPTZ_NS AS TIMESTAMP), CAST(NULL::TIMESTAMPTZ_NS AS TIMESTAMP);

SET TimeZone='Etc/GMT-2';

SELECT CAST(TIMESTAMPTZ_NS '2262-04-11 23:00:00+00' AS TIMESTAMP), TRY_CAST(TIMESTAMPTZ_NS '2262-04-11 23:00:00+00' AS TIMESTAMP);

SET TimeZone='Etc/GMT+2';

SELECT CAST(TIMESTAMPTZ_NS '1677-09-21 00:12:44+00' AS TIMESTAMP), TRY_CAST(TIMESTAMPTZ_NS '1677-09-21 00:12:44+00' AS TIMESTAMP);

SET TimeZone='Etc/GMT-1';

SELECT CAST(TIMESTAMPTZ_NS '1969-12-31 23:59:59.999999500+00' AS TIMESTAMP), CAST(TIMESTAMPTZ_NS '1969-12-31 23:59:59.999999499+00' AS TIMESTAMP),
       CAST(TIMESTAMPTZ_NS '1970-01-01 00:00:00.000000500+00' AS TIMESTAMP), CAST(TIMESTAMPTZ_NS '1970-01-01 00:00:00.000000499+00' AS TIMESTAMP);

SELECT CAST(CAST('2020-01-02 03:04:05.123456789+00' AS TIMESTAMPTZ_NS) AS TIMESTAMP);
