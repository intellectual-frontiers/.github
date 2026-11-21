SET enable_profiling = 'json';

PRAGMA disable_profiling;

SELECT 42;

SELECT 43;

SET tracked_metrics = ['io.total_bytes_written', 'io.total_write_time'];

SET tracked_metrics = ['io.total_bytes_read', 'io.total_read_time'];

SET threads = 1;

SET preserve_insertion_order = false;

SET memory_limit = '100MB';

SET tracked_metrics = ['system.total_bytes_spilled'];

SELECT first(i) FROM (SELECT i FROM range(20000000) t(i) ORDER BY i DESC);
