/**
 * The version schemes of works (commons 0026-works-versioning FR-005, FR-006, FR-010 to FR-014): the kinds of work, the one scheme each kind uses, how a version of each scheme is read, compared
 * and raised. Semantic Versioning 2.0.0 for software, libraries, command-line interfaces, ontologies and schemas; the commit-date edition `YYYY.MM.DD-<commit8>` for published prose; the snapshot
 * date `YYYY-MM-DD` for data; an integer revision for a controlled document; and no version for a specification.
 *
 * @remarks
 * Pure: no clock, no Git. The lists are those of `commons/ontology/ifr` (a test holds them equal), so that the tool needs not load the ontology. The kind of a work decides its scheme and a
 * pattern never does: `2026.11.17-1a2b3c4d` is also a Semantic Version, and is an edition where the work is prose (FR-006). Two editions of one day are ordered by the history, which the caller
 * knows and this module does not: it is given the order as a function.
 *
 * @limits
 * It does not read a record or a tag, and does not say whether a commit exists: `record.ts`, `judge.ts` and `git.ts` do.
 *
 * @example
 * ```ts
 * import { compareVersions, parseVersion, schemeOf } from "./scheme.ts";
 * const a = parseVersion(schemeOf("Library"), "1.2.0");
 * const b = parseVersion(schemeOf("Library"), "1.10.0");
 * if (a.kind === "ok" && b.kind === "ok") compareVersions(a.value, b.value); // -1
 * ```
 *
 * @module
 */
import { absurd } from "../../kernel/absurd.ts";
import { err, ok, type Result } from "../../kernel/result.ts";
import { bump, compareSemVer, formatSemVer, parseSemVer, type SemVer } from "../../kernel/semver.ts";
import { dayOf } from "../changes/declaration.ts";

/** The kinds of work (`ifr:WorkKind`; a test holds the two lists equal). */
export const WORK_KINDS = [
  "Software",
  "Library",
  "CommandLineInterface",
  "Ontology",
  "Schema",
  "Prose",
  "Data",
  "ControlledDocument",
  "Specification",
] as const;

/** A kind of work. */
export type WorkKind = (typeof WORK_KINDS)[number];

/** The schemes of version (`ifr:VersionScheme`). */
export const SCHEMES = ["SemVer", "CommitDateEdition", "SnapshotDate", "IntegerRevision", "NoVersion"] as const;

/** A scheme of version. */
export type Scheme = (typeof SCHEMES)[number];

/** The impacts a capability declares (`ifr:Impact`), least first. */
export const IMPACTS = ["patch", "minor", "major"] as const;

/** An impact. */
export type Impact = (typeof IMPACTS)[number];

/** Whether a text names a kind of work. */
export function isWorkKind(text: string): text is WorkKind {
  return WORK_KINDS.some((k) => k === text);
}

/** Whether a text names a scheme. */
export function isScheme(text: string): text is Scheme {
  return SCHEMES.some((s) => s === text);
}

/** The one scheme a kind of work uses (FR-005). */
export function schemeOf(kind: WorkKind): Scheme {
  switch (kind) {
    case "Software":
    case "Library":
    case "CommandLineInterface":
    case "Ontology":
    case "Schema":
      return "SemVer";
    case "Prose":
      return "CommitDateEdition";
    case "Data":
      return "SnapshotDate";
    case "ControlledDocument":
      return "IntegerRevision";
    case "Specification":
      return "NoVersion";
    default:
      return absurd(kind);
  }
}

/** The scheme of the schema a kind of work also carries: `SemVer` for data, none for the others (FR-005). */
export function companionOf(kind: WorkKind): Scheme | undefined {
  return kind === "Data" ? "SemVer" : undefined;
}

/** A version as it is read: a Semantic Version, an edition (its day and the first eight characters of its commit), a snapshot day or an integer revision. */
export type ParsedVersion =
  | { readonly scheme: "SemVer"; readonly semver: SemVer }
  | { readonly scheme: "CommitDateEdition"; readonly day: string; readonly commit8: string }
  | { readonly scheme: "SnapshotDate"; readonly day: string }
  | { readonly scheme: "IntegerRevision"; readonly revision: number };

const EDITION = /^(\d{4})\.(\d{2})\.(\d{2})-([0-9a-f]{8})$/;
const REVISION = /^[1-9][0-9]*$/;

/**
 * A version read by a scheme (FR-006), or why it does not match. A Semantic Version in a record, a tag or a comparison has no build metadata (`+<commit12>`, FR-010) and no leading `v`.
 */
export function parseVersion(scheme: Scheme, text: string): Result<ParsedVersion, string> {
  switch (scheme) {
    case "SemVer": {
      if (text.startsWith("v"))
        return err(`${JSON.stringify(text)} starts with v: a version is written without it (the tag carries the v)`);
      const r = parseSemVer(text);
      if (r.kind === "err") return r;
      if (r.value.build !== undefined)
        return err(
          `${JSON.stringify(text)} has build metadata (+${r.value.build}): a record and a tag carry the plain version, and a comparison ignores it`,
        );
      return ok({ scheme, semver: r.value });
    }
    case "CommitDateEdition": {
      const m = EDITION.exec(text);
      const day = m === null ? undefined : dayOf(`${m[1]}-${m[2]}-${m[3]}`);
      if (m === null || day === undefined || m[4] === undefined)
        return err(`${JSON.stringify(text)} is not an edition (YYYY.MM.DD-<commit8>, a real day)`);
      return ok({ scheme, day, commit8: m[4] });
    }
    case "SnapshotDate": {
      const day = dayOf(text);
      return day === undefined ? err(`${JSON.stringify(text)} is not a snapshot date (YYYY-MM-DD, a real day)`) : ok({ scheme, day });
    }
    case "IntegerRevision": {
      if (!REVISION.test(text) || !Number.isSafeInteger(Number(text)))
        return err(`${JSON.stringify(text)} is not a revision (a whole number from 1)`);
      return ok({ scheme, revision: Number(text) });
    }
    case "NoVersion":
      return err("a specification has no version");
    default:
      return absurd(scheme);
  }
}

/** The text of a version in its scheme. */
export function formatVersion(v: ParsedVersion): string {
  switch (v.scheme) {
    case "SemVer":
      return formatSemVer(v.semver);
    case "CommitDateEdition":
      return `${v.day.replaceAll("-", ".")}-${v.commit8}`;
    case "SnapshotDate":
      return v.day;
    case "IntegerRevision":
      return String(v.revision);
    default:
      return absurd(v);
  }
}

/** The order of two editions of one day: negative where `a` is the earlier in the history, positive where later, zero where the history does not say. */
export type EditionOrder = (a: string, b: string) => number;

/**
 * Negative where `a` comes before `b`, positive where after, zero where they are the same version (FR-010 to FR-013): a Semantic Version by its precedence (build ignored), an edition by its
 * day and then by `order` (the history), a snapshot by its day and a revision by its number. Versions of two schemes are never compared (FR-037): the result is `undefined`.
 */
export function compareVersions(a: ParsedVersion, b: ParsedVersion, order: EditionOrder = () => 0): number | undefined {
  switch (a.scheme) {
    case "SemVer":
      return b.scheme === "SemVer" ? compareSemVer(a.semver, b.semver) : undefined;
    case "CommitDateEdition":
      if (b.scheme !== "CommitDateEdition") return undefined;
      return a.day === b.day ? (a.commit8 === b.commit8 ? 0 : Math.sign(order(a.commit8, b.commit8))) : a.day < b.day ? -1 : 1;
    case "SnapshotDate":
      return b.scheme === "SnapshotDate" ? (a.day === b.day ? 0 : a.day < b.day ? -1 : 1) : undefined;
    case "IntegerRevision":
      return b.scheme === "IntegerRevision" ? Math.sign(a.revision - b.revision) : undefined;
    default:
      return absurd(a);
  }
}

/** The next Semantic Version after `version` at an impact (FR-021): major raises the first number and zeroes the others, minor raises the second and zeroes the third, patch raises the third. */
export function nextSemVer(version: string, impact: Impact): Result<string, string> {
  const v = parseVersion("SemVer", version);
  if (v.kind === "err") return v;
  return v.value.scheme === "SemVer" ? ok(formatSemVer(bump(v.value.semver, impact))) : err("not a Semantic Version");
}

/** The greater of two impacts. */
export function greaterImpact(a: Impact, b: Impact): Impact {
  return IMPACTS.indexOf(a) >= IMPACTS.indexOf(b) ? a : b;
}

/** The first eight characters of a commit's object name, as an edition carries them. */
export function commit8Of(commit: string): string {
  return commit.slice(0, 8);
}

/** The edition made at a commit: its UTC day (from the commit's committer time, never the clock) and the first eight characters of its object name (FR-011). */
export function editionAt(commit: string, committedAtSeconds: number): string {
  const day = new Date(committedAtSeconds * 1000).toISOString().slice(0, 10);
  return `${day.replaceAll("-", ".")}-${commit8Of(commit)}`;
}

/** The UTC day of a time given in seconds since the epoch. */
export function utcDay(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}
