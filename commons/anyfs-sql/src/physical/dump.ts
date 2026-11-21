// Spec: 0008-sql-dump FR-001, FR-002, FR-003, FR-004, FR-005
/**
 * The dump of a database that merges, and what is done with one. The mergeable tables (the version rows and the blobs) are the whole of what a dump carries: one `INSERT` for each row, the text the command
 * `sqlite3 x.db ".dump --data-only <tables>"` writes. Replaying such a text into a database that has the layout (the schema is made first, since a dump has none) in one transaction adds the rows it does not hold and
 * ignores the rest, so that the replay of any number of dumps, in any order, twice and overlapping, is the replay of their union: that is the merge. `dumpText` makes the dump in the same form, in key order; `parseDump` reads a dump
 * as its rows and nothing else (the comments the command writes are skipped), and refuses any text that is anything but plain inserts of literals into the two tables, so that a dump is data and never a program; `importDumps` replays dumps through the store of the database
 * (its trust stands in front of the rows) and then makes the index of search again and checks every row and blob.
 *
 * @example
 * ```ts
 * import { dumpText, importDumps } from "./dump.ts";
 * const text = await dumpText(a.port, a.facts.naming);
 * const done = await importDumps(b, [text]);
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { type MergeFinding, parseReplicaId, type ReplicaId, timeOfId, type VersionId } from "@intellectual-frontiers/anyfs/governance";
import type { Signer } from "@intellectual-frontiers/anyfs/merge";
import { type Naming, type SqlDialect, type SqlRunner, tableOf, type SqlPort } from "@intellectual-frontiers/anyfs-sql/governance";
import { layoutOf } from "./layout.ts";
import { type Dump, type DumpedVersion, redump } from "./redump.ts";

export type { Dump, DumpedVersion };
export { redump };
import { execQ, latestEpoch, runQ } from "./merge.ts";
import { bytesOf, numberOf, sqlFor, textOf } from "./sql.ts";
import type { SqlStore } from "./store.ts";

/** The tables a dump carries, by the names they have in a store with a naming: the version rows and the blobs. */
export function dumpTables(naming: Naming): readonly [string, string] {
  return [tableOf(naming, "versions"), tableOf(naming, "blobs")];
}

/** The command that makes the dump of a database file with the real `sqlite3`: the data of the mergeable tables alone, as one `INSERT` for each row, and no schema. */
export function dumpArgv(file: string, naming: Naming): readonly string[] {
  return ["sqlite3", file, `.dump --data-only ${dumpTables(naming).join(" ")}`];
}

/** The dump of a database as text, in key order: one `INSERT` for each version row and for each blob. A SQLite database gives it in the form the command makes (the engine's `quote`); any other engine gives the rows in its own form (see `redump`). */
export async function dumpText(port: SqlPort, naming: Naming): Promise<string> {
  const sql = sqlFor(port.dialect, naming);
  const l = layoutOf(sql);
  if (port.dialect !== "sqlite") return redump(await rowsDump(port, naming), port.dialect, naming);
  const lines: string[] = [];
  for (const row of await runQ(port, l.dumpVersions())) lines.push(textOf(row["line"] ?? null));
  for (const row of await runQ(port, l.dumpBlobs())) lines.push(textOf(row["line"] ?? null));
  return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
}

/** The rows of a database as a dump holds them: read through the layout, whatever the engine. */
async function rowsDump(port: SqlPort, naming: Naming): Promise<Dump> {
  const l = layoutOf(sqlFor(port.dialect, naming));
  const versions: DumpedVersion[] = [];
  for (const row of await runQ(port, l.selectVersionRows())) {
    const parent = row["parent"] ?? null;
    const blob = row["blob"] ?? null;
    versions.push([textOf(row["id"] ?? null), textOf(row["sum"] ?? null), textOf(row["replica"] ?? null), numberOf(row["seq"] ?? null), textOf(row["path"] ?? null), parent === null ? null : textOf(parent), textOf(row["merged"] ?? null), textOf(row["kind"] ?? null), blob === null ? null : textOf(blob)]);
  }
  const blobs: { sha: string; bytes: Uint8Array }[] = [];
  for (const row of await runQ(port, l.selectBlobRows())) blobs.push({ sha: textOf(row["sha"] ?? null), bytes: bytesOf(row["bytes"] ?? null) });
  return { versions, blobs };
}

/** A dump written in the form of another engine, from the text of a dump of any form: what a SQLite dump becomes for PostgreSQL or DuckDB. */
export function redumpText(text: string, target: SqlDialect, naming: Naming): Result<string, string> {
  const d = parseDump(text, naming);
  return d.kind === "err" ? d : ok(redump(d.value, target, naming));
}

/** The one call `pg_dump` writes before its rows besides `SET`: the setting of the search path, skipped. */
const PG_PREAMBLE = ["SEL", "ECT PG_CATALOG.SET_CONFIG("].join("");

type Literal = string | number | null | Uint8Array;

/** A dump read as its rows, or why the text is not a dump: the line of the first thing that is not a plain insert of literals into a table of the dump. */
export function parseDump(text: string, naming: Naming): Result<Dump, string> {
  const [versionsName, blobsName] = dumpTables(naming);
  const versions: DumpedVersion[] = [];
  const blobs: { sha: string; bytes: Uint8Array }[] = [];
  let at = 0;
  let line = 1;
  const fail = (what: string): Result<Dump, string> => err(`line ${line} of the dump: ${what}`);
  const skipSpace = (): void => {
    while (at < text.length) {
      const c = text.charCodeAt(at);
      if (c === 10) line++;
      else if (c === 47 && text[at + 1] === "*") {
        // a comment the command writes at the head of a dump: skipped, and counted for the line
        const close = text.indexOf("*/", at + 2);
        if (close < 0) return;
        for (let i = at; i < close; i++) if (text.charCodeAt(i) === 10) line++;
        at = close + 2;
        continue;
      } else if (c === 45 && text[at + 1] === "-") {
        // a comment to the end of the line: `pg_dump` writes them
        const end = text.indexOf("\n", at);
        at = end < 0 ? text.length : end;
        continue;
      } else if (c !== 32 && c !== 13 && c !== 9) break;
      at++;
    }
  };
  const word = (w: string): boolean => {
    if (text.slice(at, at + w.length).toUpperCase() !== w) return false;
    at += w.length;
    return true;
  };
  const name = (): string | undefined => {
    if (text[at] === '"') {
      const close = text.indexOf('"', at + 1);
      if (close < 0) return undefined;
      const n = text.slice(at + 1, close);
      at = close + 1;
      return n;
    }
    const m = /^[A-Za-z0-9_.]+/u.exec(text.slice(at, at + 128));
    if (m === null) return undefined;
    at += m[0].length;
    return m[0];
  };
  const literal = (): Literal | undefined => {
    const c = text[at];
    if (c === "'") {
      let out = "";
      at++;
      for (;;) {
        const close = text.indexOf("'", at);
        if (close < 0) return undefined;
        out += text.slice(at, close);
        if (text[close + 1] === "'") {
          out += "'";
          at = close + 2;
          continue;
        }
        at = close + 1;
        return out;
      }
    }
    if ((c === "X" || c === "x") && text[at + 1] === "'") {
      const close = text.indexOf("'", at + 2);
      if (close < 0) return undefined;
      const hex = text.slice(at + 2, close);
      if (hex.length % 2 !== 0 || !/^[0-9A-Fa-f]*$/u.test(hex)) return undefined;
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      at = close + 1;
      return bytes;
    }
    if (word("NULL")) return null;
    if (word("UNHEX(")) {
      // DuckDB writes bytes as `unhex('hex')`
      skipSpace();
      const hex = literal();
      skipSpace();
      if (typeof hex !== "string" || text[at] !== ")" || hex.length % 2 !== 0 || !/^[0-9A-Fa-f]*$/u.test(hex)) return undefined;
      at++;
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      return bytes;
    }
    const m = /^-?[0-9]+/u.exec(text.slice(at, at + 24));
    if (m === null) return undefined;
    at += m[0].length;
    return Number(m[0]);
  };
  for (;;) {
    skipSpace();
    if (at >= text.length) break;
    if (text[at] === "\\") {
      // the two commands of `psql` that a recent `pg_dump` puts around its rows (a key that guards the restore): skipped to the end of the line
      const m = /^\\(un)?restrict [A-Za-z0-9]+/u.exec(text.slice(at, at + 200));
      if (m === null) return fail("a command of psql that is not \\restrict or \\unrestrict");
      at += m[0].length;
      continue;
    }
    if (word("SET ") || word(PG_PREAMBLE)) {
      // the only other statements `pg_dump` writes before the rows: a setting, skipped to its end
      const end = text.indexOf(";", at);
      if (end < 0) return fail("a setting that does not end");
      at = end + 1;
      continue;
    }
    if (!word("INSERT")) return fail("a statement that is not an INSERT");
    skipSpace();
    if (word("OR")) {
      skipSpace();
      if (!word("IGNORE")) return fail("an INSERT OR that is not OR IGNORE");
      skipSpace();
    }
    if (!word("INTO")) return fail("an INSERT with no INTO");
    skipSpace();
    const qualified = name();
    if (qualified === undefined) return fail("an INSERT with no table");
    const table = qualified.slice(qualified.lastIndexOf(".") + 1);
    skipSpace();
    if (!word("VALUES")) return fail("an INSERT that has no VALUES");
    skipSpace();
    if (text[at] !== "(") return fail("VALUES with no parenthesis");
    at++;
    const values: Literal[] = [];
    for (;;) {
      skipSpace();
      const v = literal();
      if (v === undefined) return fail("a value that is not a literal (a number, text, NULL or X'hex')");
      values.push(v);
      skipSpace();
      if (text[at] === ",") {
        at++;
        continue;
      }
      if (text[at] === ")") {
        at++;
        break;
      }
      return fail("a value list that does not end");
    }
    skipSpace();
    if (word("ON")) {
      skipSpace();
      if (!word("CONFLICT")) return fail("an INSERT with an ON that is not ON CONFLICT");
      skipSpace();
      if (!word("DO")) return fail("an ON CONFLICT with no DO");
      skipSpace();
      if (!word("NOTHING")) return fail("an ON CONFLICT that does not DO NOTHING");
      skipSpace();
    }
    if (text[at] !== ";") return fail("an INSERT with no semicolon");
    at++;
    if (table === versionsName) {
      const [id, sum, replica, seq, path, parent, merged, kind, blob] = values;
      if (values.length !== 9 || typeof id !== "string" || typeof sum !== "string" || typeof replica !== "string" || typeof seq !== "number" || typeof path !== "string" || (parent !== null && typeof parent !== "string") || typeof merged !== "string" || typeof kind !== "string" || (blob !== null && typeof blob !== "string"))
        return fail(`a row of ${versionsName} that has not the nine values of a version`);
      versions.push([id, sum, replica, seq, path, parent ?? null, merged, kind, blob ?? null]);
    } else if (table === blobsName) {
      const [sha, given] = values;
      // PostgreSQL writes bytes as a text of hex after `\x`
      const bytes = typeof given === "string" && /^\\x([0-9A-Fa-f]{2})*$/u.test(given) ? Uint8Array.from(given.slice(2).match(/../gu) ?? [], (h) => Number.parseInt(h, 16)) : given;
      if (values.length !== 2 || typeof sha !== "string" || !(bytes instanceof Uint8Array)) return fail(`a row of ${blobsName} that is not a digest and bytes`);
      blobs.push({ sha, bytes });
    } else return fail(`an INSERT into ${table}, which is not a table a dump carries`);
  }
  return ok({ versions, blobs });
}

/**
 * What a replica that signs says of a dump it made: which replica made it, the SHA-256 of its text and how many rows and blobs it holds, in its key. A dump is data that anything can write, so under signed trust a dump is replayed only with a manifest
 * whose signature holds; what is signed is the digest with the counts (`<sha256>:<rows>:<blobs>`) under the domain `anyfs-dump/1`, so that a signature of a delta or an epoch is never one of a dump. The file next to a dump is named `<replica>.sql.sig`.
 */
export type DumpManifest = { readonly format: 1; readonly replica: ReplicaId; readonly sha256: string; readonly versions: number; readonly blobs: number; readonly signature: string };

/** A dump with the manifest that was signed for it. */
export type SignedDump = { readonly text: string; readonly manifest: DumpManifest };

const manifestDigest = (sha: string, versions: number, blobs: number): string => `${sha}:${versions}:${blobs}`;

/** Signs a dump: the manifest of its text, from the rows it holds. */
export async function signDump(text: string, naming: Naming, signer: Signer): Promise<Result<SignedDump, string>> {
  const d = parseDump(text, naming);
  if (d.kind === "err") return d;
  const sum = await sha256(text);
  const signature = await signer.sign("anyfs-dump/1", manifestDigest(sum, d.value.versions.length, d.value.blobs.length));
  return ok({ text, manifest: { format: 1, replica: signer.replica, sha256: sum, versions: d.value.versions.length, blobs: d.value.blobs.length, signature } });
}

/** The text of a manifest, as it is kept in `<replica>.sql.sig`. */
export const manifestText = (m: DumpManifest): string => `${JSON.stringify(m)}\n`;

/** A manifest from its text, or why it is not one. */
export function parseManifest(source: string): Result<DumpManifest, string> {
  let x: unknown;
  try {
    x = JSON.parse(source);
  } catch {
    return err("a manifest of a dump is JSON");
  }
  if (typeof x !== "object" || x === null) return err("a manifest of a dump is an object");
  const o = x as { readonly [k: string]: unknown };
  const replica = typeof o["replica"] === "string" ? parseReplicaId(o["replica"]) : err("a manifest names its replica");
  if (replica.kind === "err") return replica;
  if (o["format"] !== 1 || typeof o["sha256"] !== "string" || !/^[0-9a-f]{64}$/u.test(o["sha256"]) || typeof o["signature"] !== "string") return err("a manifest is format 1 with a digest and a signature");
  if (typeof o["versions"] !== "number" || typeof o["blobs"] !== "number" || !Number.isSafeInteger(o["versions"]) || !Number.isSafeInteger(o["blobs"]) || o["versions"] < 0 || o["blobs"] < 0) return err("a manifest counts the rows and the blobs");
  return ok({ format: 1, replica: replica.value, sha256: o["sha256"], versions: o["versions"], blobs: o["blobs"], signature: o["signature"] });
}

/** What replaying dumps did: the rows and blobs that were new, and what is wrong with the database after. */
export type Imported = { readonly versions: number; readonly blobs: number; readonly findings: readonly MergeFinding[] };

/**
 * Replays dumps into the database of a store: the schema is there (the store made it), every dump is read as rows before anything is written (a text that is not a dump of plain inserts changes nothing), the rows are
 * replayed in one transaction through the trigger that refuses a replica the database does not trust (and the whole replay is undone where one is refused), the index of search is made again, and every row and blob is checked.
 */
export async function importDumps(store: SqlStore, inputs: readonly (string | SignedDump)[]): Promise<Result<Imported, string>> {
  const l = store.ctx.l;
  const parsed: Dump[] = [];
  const trust = store.ctx.config.trust;
  for (const input of inputs) {
    const text = typeof input === "string" ? input : input.text;
    const d = parseDump(text, store.facts.naming);
    if (d.kind === "err") return d;
    if (trust.kind === "signed") {
      // under signed trust a dump is data anyone could have written: it is replayed only with the manifest of a replica that is on the list (where there is one) and whose key signed this text and these counts, and no row may be of a replica off the list
      if (typeof input === "string") return err("the dump is not signed, and this database takes signed dumps only");
      const m = input.manifest;
      if (trust.replicas !== undefined && !trust.replicas.has(m.replica)) return err(`the dump is from replica ${m.replica}, which this database does not take rows from`);
      if ((await sha256(text)) !== m.sha256 || d.value.versions.length !== m.versions || d.value.blobs.length !== m.blobs) return err("the dump is not the one its manifest was signed for");
      if (trust.replicas !== undefined) for (const v of d.value.versions) if (!trust.replicas.has(v[2] as ReplicaId)) return err(`the dump holds a row of replica ${v[2]}, which this database does not take rows from`);
      const at = d.value.versions.reduce((n, v) => Math.max(n, timeOfId(v[0] as VersionId).ms), 0);
      const verdict = await trust.verify(manifestDigest(m.sha256, m.versions, m.blobs), m.signature, m.replica, at, "anyfs-dump/1");
      if (verdict !== "ok") return err(verdict === "bad-signature" ? "the signature of the dump does not hold" : `no key of replica ${m.replica} that this database knows made the signature of the dump`);
    }
    parsed.push(d.value);
  }
  let added: { readonly versions: number; readonly blobs: number };
  try {
    added = await store.port.transaction(async (tx) => {
      const lock = l.lockWriters();
      if (lock !== undefined) await runQ(tx, lock);
      const v0 = numberOf((await runQ(tx, l.countVersions()))[0]?.["n"] ?? null);
      const b0 = numberOf((await runQ(tx, l.countBlobs()))[0]?.["n"] ?? null);
      // an engine with no trigger (DuckDB) is held here: the allowlist refuses the whole replay at the first row of a replica it does not trust, and a row an epoch collected is not written
      const held = store.port.dialect === "duckdb" ? await heldBy(tx, store) : undefined;
      for (const d of parsed) {
        for (const v of d.versions) {
          if (held === undefined) continue;
          if (held.trusted !== undefined && !held.trusted.has(v[2])) throw new Error("the replica of this row is not one this database takes rows from");
        }
        for (const b of d.blobs) await execQ(tx, l.replayBlob(b.sha, b.bytes));
        for (const v of d.versions) {
          if (held?.dead(v[0], v[1], v[2], v[3]) === true) continue;
          await execQ(tx, l.replayVersion(v));
        }
      }
      const v1 = numberOf((await runQ(tx, l.countVersions()))[0]?.["n"] ?? null);
      const b1 = numberOf((await runQ(tx, l.countBlobs()))[0]?.["n"] ?? null);
      return { versions: v1 - v0, blobs: b1 - b0 };
    });
  } catch (thrown) {
    return err(`the dumps were not replayed, and the database is as it was: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
  }
  await store.reindex();
  return ok({ ...added, findings: await store.verify() });
}

/** What an engine with no trigger holds of a replay: the replicas it takes rows from (where the trust mode is the allowlist), and whether an epoch collected a row. */
async function heldBy(tx: SqlRunner, store: SqlStore): Promise<{ readonly trusted: ReadonlySet<string> | undefined; dead(id: string, sum: string, replica: string, seq: number): boolean }> {
  const l = store.ctx.l;
  const mode = textOf((await runQ(tx, l.selectFact("trust_mode")))[0]?.["value"] ?? null);
  const trusted = mode === "allowlist" ? new Set((await runQ(tx, l.selectTrust())).map((r) => textOf(r["replica"] ?? null))) : undefined;
  const epoch = await latestEpoch(tx, store.ctx);
  return {
    trusted,
    dead: (id, sum, replica, seq) => epoch !== undefined && seq <= (epoch.horizon[replica] ?? 0) && !epoch.retained.includes(`${id}|${sum}`),
  };
}
