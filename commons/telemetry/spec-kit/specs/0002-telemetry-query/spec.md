# Feature Specification: Questions of captured signals in SQL

**Spec ID:** 0002-telemetry-query
**Status:** Active
**Owner:** if
**Domain:** telemetry

**Input:** A journal of signals answers what a person asks of a run: the slowest spans, the errors of a service, the warnings logged in one trace. Reading the lines of OTLP JSON by hand answers them badly. This feature makes the spans, log records and metric points of a journal (or of any batches) into relations and answers one read-only SQL over them with the SQL language library, without a database and without a way to change a signal.

## Relations

- **FR-001**: The relations MUST be `spans` (`trace_id`, `span_id`, `parent_span_id`, `name`, `kind`, `service`, `scope`, `start_time`, `duration_ms`, `status`, `status_message`), `span_attributes` (`trace_id`, `span_id`, `key`, `value`), `span_events` (`trace_id`, `span_id`, `name`, `time`), `logs` (`time`, `service`, `scope`, `severity`, `severity_text`, `event_name`, `body`, `trace_id`, `span_id`) and `metric_points` (`name`, `unit`, `kind`, `service`, `time`, `value`, `count`, `attributes`); a time MUST be an ISO 8601 instant to the millisecond, a duration in milliseconds, the service the resource's `service.name`, and an attribute's or a body's value its text (a number or a boolean as it is written, a list or a map as JSON); a histogram point MUST have its sum as the value and its count.
- **FR-002**: `signalsCatalog()` MUST give the catalog of those relations with the type of each column, so that a name or a column that is not there is found before a question is answered.

## Questions

- **FR-003**: `querySignals(signals, sql, options?)` MUST answer one query that the guard of the SQL language library judges to be a single read and binds to the catalog, with the engine of the same library, and MUST give an error value, never a throw, for anything else (a statement that writes, more than one statement, an unknown relation or column with the name it is closest to), with the sentence of the guard and its place; an answer MUST hold at most `options.limit` rows (1000 where none is given) and say whether it was cut; parameters (`?`) MUST be given by `options.params` and never read as SQL.

## The journal and the command

- **FR-004**: `readJournal(paths)` MUST read journal files in the order given, each line one OTLP/JSON export request (`resourceSpans`, `resourceLogs` or `resourceMetrics`) decoded as the exporter encoded it, and MUST count and leave out a line that does not decode (a blank line is nothing); a file that is not there MUST be empty.
- **FR-005**: `bun tools/query.ts [--limit N] [--json] FILE... -- "SELECT ..."` MUST print the answer as an aligned table or as JSON and write nothing, say how many journal lines did not decode, and end with 0 where it answered, 1 where the question is refused and 2 for a command line that does not fit.

## Out of scope

- A question over a live pipeline or over signals not yet exported, and a question that joins two journals' resources.

## Edge cases

- A journal with no span: `spans` has no rows, per FR-001.
- A log record with no trace: `trace_id` and `span_id` are null, per FR-001.

## Assumptions

- A journal is the one `journalExporter` writes, one export request to a line.

## Open questions

- None.

## Key entities

- **Signals**: the trace, log and metric batches a question is about.
- **Relation**: a table of values that a question may name.

## Success criteria

- The slowest spans and the errors of a service are found by one line of SQL over a journal.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
