/**
 * The vault's record of what went wrong while loading: a hub of exceptions by their key, a satellite of what was known each time one
 * happened, and a PostgreSQL procedure that records one (commons 0009-sql-aide FR-048).
 *
 * @module
 */
import { proc, SQL, text } from "../sql-aide/mod.ts";
import { hub, satellite } from "./vault.ts";

/** The hub of exceptions: one row for each kind of thing that went wrong, by a key the loader chooses. */
export const exceptionHub = hub("exception", { exception_key: text().doc("What went wrong, as the loader names it") });

/** What was known each time an exception happened. */
export const exceptionDiagnostic = satellite(exceptionHub, "diagnostic", {
  message: text().doc("What the database or the loader said"),
  context: text().nullable().doc("Where it happened: the step, the file, the row"),
});

/** Records an exception: its hub row the first time its key is seen, and a diagnostic row every time. PostgreSQL only. */
export const recordException = proc("record_exception", {
  args: {
    /** What went wrong, as the loader names it. */
    key: text(),
    /** What the database or the loader said. */
    message: text(),
    /** Where the row came from. */
    source: text(),
  },
  uses: [exceptionHub, exceptionDiagnostic],
  body: ({ key, message, source }, pl) =>
    pl.block(
      pl.run(
        SQL`INSERT INTO ${exceptionHub} ("hub_exception_id", "exception_key", "record_source") VALUES (gen_random_uuid()::text, ${key}, ${source}) ON CONFLICT ("exception_key") DO NOTHING`,
      ),
      pl.run(SQL`
        INSERT INTO ${exceptionDiagnostic} ("sat_exception_diagnostic_id", "hub_exception_id", "message", "record_source")
        SELECT gen_random_uuid()::text, "hub_exception_id", ${message}, ${source} FROM ${exceptionHub} WHERE ${exceptionHub.c.exception_key} = ${key}`),
    ),
});
