/**
 * The file side of an ephemeral build (commons 0009-sql-aide FR-054, FR-055): writing the generated files, checking that the committed
 * ones are what the source makes, and making a database from an `.auto.sql` through a driver, in a temporary file renamed over the old
 * one, so that a reader sees the old database or the new one, never one half made.
 *
 * @module
 */
import { err, ok, type Result } from "../../../kernel/mod.ts";
import { fs } from "../../../runtime/mod.ts";

/** A generated file: where it goes and its text. */
export interface FileText {
  /** The path. */
  readonly path: string;
  /** The text. */
  readonly text: string;
}

/**
 * Writes generated files.
 *
 * @param files - the files
 */
export async function writeFiles(files: readonly FileText[]): Promise<void> {
  for (const f of files) await fs.writeTextFile(f.path, f.text);
}

/**
 * The paths of the files whose committed text is not what the source makes now, or that are not there (FR-055).
 *
 * @param files - the files as the source makes them
 */
export async function staleFiles(files: readonly FileText[]): Promise<readonly string[]> {
  const out: string[] = [];
  for (const f of files) {
    const committed = await fs.readTextOr(f.path);
    if (committed !== f.text) out.push(f.path);
  }
  return out;
}

/** A database being made: what runs the script in it, and what lets it go so that its file can be renamed. */
export interface Opened {
  /** Runs a script. */
  readonly exec: (text: string) => Promise<void>;
  /** Lets the database go. */
  readonly close: () => Promise<void>;
}

/**
 * Makes a database from an `.auto.sql` (FR-054): in `<database>.building`, through what `open` gives for that path, then renamed over
 * the database. Where it fails, the old database is left as it was. A database that is a folder (PGlite's) is removed before the
 * rename, as a folder cannot be renamed over one that is not empty; a reader may then find none for that moment.
 *
 * @param sql - the text of the `.auto.sql`
 * @param database - the path of the database
 * @param open - opens a new, empty database at a path through a driver of its engine
 */
export async function materialize(sql: string, database: string, open: (path: string) => Promise<Opened>): Promise<Result<void, string>> {
  const building = `${database}.building`;
  await fs.remove(building, { recursive: true }).catch(() => undefined);
  let opened: Opened | undefined;
  try {
    opened = await open(building);
    await opened.exec(sql);
    await opened.close();
    opened = undefined;
    const info = await fs.stat(database).catch(() => undefined);
    if (info !== undefined && info.isDirectory) await fs.remove(database, { recursive: true });
    await fs.rename(building, database);
    return ok(undefined);
  } catch (thrown) {
    await opened?.close().catch(() => undefined);
    await fs.remove(building, { recursive: true }).catch(() => undefined);
    return err(thrown instanceof Error ? thrown.message : String(thrown));
  }
}
