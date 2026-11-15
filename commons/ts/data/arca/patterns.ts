/**
 * Patterns of Arca, as functions: a structure that many models repeat is written once and made for whatever asks for it
 * (commons 0006-sql-aide FR-047).
 *
 * @module
 */
import { type Column, type Table, table, text } from "../sql-aide/mod.ts";

/** The columns of a code table. */
export interface CodeColumns {
  /** The code other tables point to: a short word that does not change. */
  readonly code: Column<string, false, "required", true>;
  /** What a person is shown for the code. */
  readonly label: Column<string>;
  /** What the code means, where the label is not enough. */
  readonly description: Column<string, true>;
}

/**
 * A code table: the closed list of words another table may use for one of its columns (the kinds of party, the kinds of role). Its rows
 * are reference data, loaded with the model.
 *
 * @param name - the table's name
 * @param doc - what the codes are codes of
 * @example
 * const partyKind = codeTable("party_kind", "The kinds of party");
 */
export function codeTable<const N extends string>(name: N, doc: string): Table<N, CodeColumns> {
  return table(
    name,
    {
      code: text().primaryKey().doc("The code other tables point to: a short word that does not change"),
      label: text().doc("What a person is shown for the code"),
      description: text().nullable().doc("What the code means, where the label is not enough"),
    },
    { doc, owner: "arca" },
  );
}
