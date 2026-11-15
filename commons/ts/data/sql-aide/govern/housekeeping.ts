/**
 * Housekeeping: the columns that say who made, changed and removed a row, and when. A table takes them by spreading them among its
 * columns; nothing adds them for it (commons 0006-sql-aide FR-025).
 *
 * @module
 */
import { type Column, text, timestamptz } from "../algebra/column.ts";
import { now } from "../emit/expr.ts";

/** The housekeeping columns. */
export interface Housekeeping {
  /** When the row was made; the database says when if the row does not. */
  readonly created_at: Column<Date, false, "default">;
  /** Who made the row. */
  readonly created_by: Column<string, true>;
  /** When the row was last changed. */
  readonly updated_at: Column<Date, true>;
  /** Who last changed the row. */
  readonly updated_by: Column<string, true>;
  /** When the row was marked as removed; a row with a time here is no longer in use. */
  readonly deleted_at: Column<Date, true>;
  /** Who marked the row as removed. */
  readonly deleted_by: Column<string, true>;
}

/**
 * The housekeeping columns, each with its description.
 *
 * @example
 * const party = table("party", { party_id: pk.ulid(), ...housekeeping() });
 */
export function housekeeping(): Housekeeping {
  return {
    created_at: timestamptz().default(now).doc("When the row was made"),
    created_by: text().nullable().doc("Who made the row"),
    updated_at: timestamptz().nullable().doc("When the row was last changed"),
    updated_by: text().nullable().doc("Who last changed the row"),
    deleted_at: timestamptz().nullable().doc("When the row was marked as removed"),
    deleted_by: text().nullable().doc("Who marked the row as removed"),
  };
}
