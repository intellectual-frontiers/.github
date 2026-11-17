/**
 * The typed record of a work (commons 0026-works-versioning FR-008, FR-013, FR-027, FR-028, FR-037): the file `<work>/release.ts`, whose only export is `release`, an object literal read as data
 * and never run (`kernel/ts-literal.ts`, as 0020-ifccm reads a harness's declaration), so that a record at a past commit, read from Git, reads like the present one. The decoder, the checks of
 * what a record says against its kind, and the template that writes it.
 *
 * @remarks
 * Pure: text in, data out. A field the record does not know and a field of the wrong type are errors that name the field. A tool writes a record only through {@link releaseSource}, which gives
 * every record the same layout and the same order of fields, so that a diff of two records shows only what changed. The version of a record is text here; `scheme.ts` reads it by the scheme of
 * the work's kind.
 *
 * @limits
 * It does not read Git, and does not judge a record against an earlier one (`judge.ts`). A person or agent that edits a record by hand is outside what it can prevent: the check finds the result.
 *
 * @example
 * ```ts
 * import { decodeReleaseSource, releaseSource } from "./record.ts";
 * const text = releaseSource({ slug: "lib", kind: "Library", title: "A library", authors: [{ name: "A. Person" }], version: "0.1.0" });
 * decodeReleaseSource(text).kind; // "ok"
 * ```
 *
 * @module
 */
import type { Brand } from "../../kernel/brand.ts";
import {
  array,
  type DecodeError,
  type Decoder,
  describe,
  formatDecodeError,
  integer,
  literal,
  object,
  refine,
  string,
} from "../../kernel/decode.ts";
import { err, ok, type Result } from "../../kernel/result.ts";
import { exportedLiteral, type Literal, tsLiteral } from "../../kernel/ts-literal.ts";
import { dayOf, type Day, type RecordError } from "../changes/declaration.ts";
import { companionOf, SCHEMES, type Scheme, schemeOf, type WorkKind, WORK_KINDS } from "./scheme.ts";

/** The slug of a work: lower-case letters, digits and hyphens, the prefix of its tags. */
export type Slug = Brand<string, "Slug">;

/** Text as a slug, or undefined where it is not lower-case letters, digits and single hyphens between them. */
export function slugOf(text: string): Slug | undefined {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text) ? (text as Slug) : undefined; // checked just now: the brand's one constructor
}

/** One author: a name. */
export type Author = { readonly name: string };

/** The approval of a controlled document's revision (FR-013): a person, a role, a day and the Decision. */
export type Approval = { readonly approvedBy: string; readonly role: string; readonly on: Day; readonly decision: string };

/** A retired version (FR-028): the day, what replaces it, the day it was archived and, once its bytes are gone, the day they were removed (the tombstone, FR-027). */
export type Retired = {
  readonly version: string;
  readonly on: Day;
  readonly replacedBy?: string;
  readonly archivedOn?: Day;
  readonly bytesRemovedOn?: Day;
};

/** The snapshot of a work of data (FR-012): the SHA-256 of the snapshot, the Semantic Version of its schema and, where named, the paths of the schema's files. */
export type Snapshot = { readonly digest: string; readonly schemaVersion: string; readonly schemaPaths?: readonly string[] };

/** A change of scheme (FR-037): the scheme it came from and the first version of the new scheme. */
export type Migration = { readonly scheme: Scheme; readonly firstVersion: string };

/** The record of a work. */
export type Release = {
  readonly slug: Slug;
  readonly kind: WorkKind;
  readonly title: string;
  readonly authors: readonly Author[];
  /** Written by the scheme of the kind; absent for a specification (FR-014). */
  readonly version?: string;
  readonly iri?: string;
  readonly partOf?: Slug;
  readonly position?: number;
  readonly identifier?: string;
  readonly repository?: string;
  /** Paths of the folder that are not the work's files (FR-009). */
  readonly exclude?: readonly string[];
  readonly snapshot?: Snapshot;
  readonly approval?: Approval;
  /** An ISO 8601 duration, from the release's day (FR-027). */
  readonly retention?: string;
  readonly retired?: readonly Retired[];
  readonly migratedFrom?: Migration;
  /** The slug of the work this one replaces, where it is a renamed or renumbered one (FR-007). */
  readonly replaces?: Slug;
};

/** The fields a record may carry, in the order a template writes them. */
export const RECORD_FIELDS = [
  "slug",
  "kind",
  "title",
  "authors",
  "version",
  "iri",
  "partOf",
  "position",
  "identifier",
  "repository",
  "exclude",
  "snapshot",
  "approval",
  "retention",
  "retired",
  "migratedFrom",
  "replaces",
] as const;

/** The name of a record's file in a work's folder. */
export const RECORD_FILE = "release.ts";

/** The name of a work's citation file (FR-024). */
export const CITATION_FILE = "CITATION.cff";

/** A decoder that also holds a value to a condition, saying what it expected where it does not hold. */
function where<T>(base: Decoder<T>, expected: string, holds: (value: T) => boolean): Decoder<T> {
  return (input, path = "$") => {
    const r = base(input, path);
    if (r.kind === "err") return r;
    return holds(r.value) ? r : err({ kind: "decode", path, expected, found: describe(input) });
  };
}

const nonEmpty: Decoder<string> = where(string, "a non-empty string", (s) => s.trim() !== "");
const slug: Decoder<Slug> = refine(string, "Slug", (s) => slugOf(s) !== undefined);
const day: Decoder<Day> = refine(string, "Day", (s) => dayOf(s) !== undefined);
const kind: Decoder<WorkKind> = literal(...WORK_KINDS);
const scheme: Decoder<Scheme> = literal(...SCHEMES);
const position: Decoder<number> = where(integer, "a position (a whole number from 1)", (n) => n >= 1);
const digest: Decoder<string> = where(string, "a SHA-256 digest (64 hexadecimal digits)", (s) => /^[0-9a-f]{64}$/.test(s));
const DURATION = /^P(?=\d)(?:\d+Y)?(?:\d+M)?(?:\d+W)?(?:\d+D)?$/;
const retention: Decoder<string> = where(string, "an ISO 8601 duration of years, months, weeks and days (P10Y)", (s) => DURATION.test(s));

/** A path of the folder: relative, with `/`, no `.` or `..`, no trailing slash. */
export function folderPathProblem(p: string): string | undefined {
  if (p === "" || p.startsWith("/") || p.includes("\\") || p.endsWith("/")) return "a relative path with / and no trailing /";
  return p.split("/").some((s) => s === "" || s === "." || s === "..") ? "a path with no . or .. part" : undefined;
}
const folderPath: Decoder<string> = where(
  string,
  "a path of the folder (relative, with /, no . or .. part, no trailing /)",
  (s) => folderPathProblem(s) === undefined,
);

const authorDecoder = object({ name: nonEmpty });
const authors: Decoder<readonly Author[]> = where(array(authorDecoder), "a list of one or more authors", (a) => a.length > 0);
const approvalDecoder = object({ approvedBy: nonEmpty, role: nonEmpty, on: day, decision: nonEmpty });
const retiredDecoder = object({ version: nonEmpty, on: day }, { replacedBy: nonEmpty, archivedOn: day, bytesRemovedOn: day });
const snapshotDecoder = object({ digest, schemaVersion: nonEmpty }, { schemaPaths: array(folderPath) });
const migrationDecoder = object({ scheme, firstVersion: nonEmpty });
const body = object(
  { slug, kind, title: nonEmpty, authors },
  {
    version: nonEmpty,
    iri: nonEmpty,
    partOf: slug,
    position,
    identifier: nonEmpty,
    repository: nonEmpty,
    exclude: array(folderPath),
    snapshot: snapshotDecoder,
    approval: approvalDecoder,
    retention,
    retired: array(retiredDecoder),
    migratedFrom: migrationDecoder,
    replaces: slug,
  },
);

function plainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unknownField(input: unknown): DecodeError | undefined {
  if (!plainObject(input)) return undefined;
  const known: readonly string[] = RECORD_FIELDS;
  const bad = Object.keys(input).find((k) => !known.includes(k));
  return bad === undefined
    ? undefined
    : {
        kind: "decode",
        path: `release.${bad}`,
        expected: `one of the fields of a record (${RECORD_FIELDS.join(", ")})`,
        found: "an unknown field",
      };
}

/** What a record says that its kind does not allow (FR-008, FR-012, FR-014): a version on a specification, none on another work, a snapshot on a work that is not data. */
export function kindProblem(r: Release): string | undefined {
  if (schemeOf(r.kind) === "NoVersion") {
    if (r.version !== undefined)
      return `a ${r.kind} has no version (version: ${JSON.stringify(r.version)}): its requirement identifiers are never renumbered and its revision is the commit`;
    if (r.migratedFrom !== undefined) return `a ${r.kind} has no version, so it has no scheme to migrate from`;
    return r.approval !== undefined ? `a ${r.kind} has no revision to approve` : undefined;
  }
  if (r.version === undefined) return `a ${r.kind} has a version (${schemeOf(r.kind)}) and the record carries none`;
  if (r.kind === "Data" && r.snapshot === undefined) return "a work of data carries its snapshot (digest and schemaVersion)";
  if (companionOf(r.kind) === undefined && r.snapshot !== undefined) return `a ${r.kind} has no snapshot: only data has`;
  if (r.kind !== "ControlledDocument" && r.approval !== undefined)
    return `a ${r.kind} has no approval record: only a controlled document has`;
  return undefined;
}

/** A record decoded from data (FR-008): its fields, or the first that is unknown, of the wrong type or at odds with the kind. */
export function decodeRelease(input: unknown): Result<Release, RecordError> {
  const unknown = unknownField(input);
  if (unknown !== undefined) return err({ kind: "decode", message: formatDecodeError(unknown) });
  const r = body(input, "release");
  if (r.kind === "err") return err({ kind: "decode", message: formatDecodeError(r.error) });
  const v = r.value;
  const release: Release = {
    slug: v.slug,
    kind: v.kind,
    title: v.title,
    authors: v.authors,
    ...(v.version === undefined ? {} : { version: v.version }),
    ...(v.iri === undefined ? {} : { iri: v.iri }),
    ...(v.partOf === undefined ? {} : { partOf: v.partOf }),
    ...(v.position === undefined ? {} : { position: v.position }),
    ...(v.identifier === undefined ? {} : { identifier: v.identifier }),
    ...(v.repository === undefined ? {} : { repository: v.repository }),
    ...(v.exclude === undefined ? {} : { exclude: v.exclude }),
    ...(v.snapshot === undefined ? {} : { snapshot: v.snapshot }),
    ...(v.approval === undefined ? {} : { approval: v.approval }),
    ...(v.retention === undefined ? {} : { retention: v.retention }),
    ...(v.retired === undefined ? {} : { retired: v.retired }),
    ...(v.migratedFrom === undefined ? {} : { migratedFrom: v.migratedFrom }),
    ...(v.replaces === undefined ? {} : { replaces: v.replaces }),
  };
  const problem = kindProblem(release);
  if (problem !== undefined) return err({ kind: "decode", message: `release: ${problem}` });
  return ok(release);
}

/**
 * The record read from the text of its file: `export const release = { ... }` and no other export, read as data and never run. A file that exports something else, or that holds a value that is
 * not a literal, is an error that says so.
 */
export function decodeReleaseSource(source: string): Result<Release, RecordError> {
  const exports = source.split("\n").filter((l) => /^export\s/.test(l));
  if (exports.length !== 1)
    return err({ kind: "decode", message: `a record exports only release, and this file has ${exports.length} exports` });
  const lit = exportedLiteral(source, "release");
  if (lit.kind === "err") return err({ kind: "literal", name: "release", expected: lit.error.expected });
  return decodeRelease(lit.value);
}

/** A record as the literal a template writes, with its fields in the order of {@link RECORD_FIELDS}. */
function literalOf(r: Release): Literal {
  const retired = r.retired?.map((e) => ({
    version: e.version,
    on: e.on,
    ...(e.replacedBy === undefined ? {} : { replacedBy: e.replacedBy }),
    ...(e.archivedOn === undefined ? {} : { archivedOn: e.archivedOn }),
    ...(e.bytesRemovedOn === undefined ? {} : { bytesRemovedOn: e.bytesRemovedOn }),
  }));
  return {
    slug: r.slug,
    kind: r.kind,
    title: r.title,
    authors: r.authors.map((a) => ({ name: a.name })),
    version: r.version,
    iri: r.iri,
    partOf: r.partOf,
    position: r.position,
    identifier: r.identifier,
    repository: r.repository,
    exclude: r.exclude === undefined ? undefined : [...r.exclude],
    snapshot:
      r.snapshot === undefined
        ? undefined
        : {
            digest: r.snapshot.digest,
            schemaVersion: r.snapshot.schemaVersion,
            ...(r.snapshot.schemaPaths === undefined ? {} : { schemaPaths: [...r.snapshot.schemaPaths] }),
          },
    approval:
      r.approval === undefined
        ? undefined
        : { approvedBy: r.approval.approvedBy, role: r.approval.role, on: r.approval.on, decision: r.approval.decision },
    retention: r.retention,
    retired,
    migratedFrom: r.migratedFrom === undefined ? undefined : { scheme: r.migratedFrom.scheme, firstVersion: r.migratedFrom.firstVersion },
    replaces: r.replaces,
  };
}

/** The header every record carries. */
const HEADER =
  "/** The release record of this work (commons 0026-works-versioning): data, read and never run. `versions bump` writes it; never edit it by hand. */\n";

/** The text of a record's file, by the one template (FR-008): the header, `export const release = { ... };`, fields in the order of {@link RECORD_FIELDS}, a newline at the end. */
export function releaseSource(r: Release): string {
  return `${HEADER}export const release = ${tsLiteral<Literal>(literalOf(r))};\n`;
}

/** The record with its version replaced: the one change `bump` makes to a record besides the fields of the kinds that move with it. */
export function withVersion(r: Release, version: string): Release {
  return { ...r, version };
}
