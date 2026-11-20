// Spec: 0001-formats FR-015
/**
 * Versions: semantic versions by the rules of semver.org 2.0.0 (parsed, printed, ordered and bumped), and the looser dotted versions that
 * programs print (`2.9.8`, `1.4.4`, `26.13.1`), compared part by part (commons 0001-formats FR-015); and npm's ranges, read and
 * satisfied as node-semver reads them (commons 0001-formats FR-014). Taken from erga's kernel (`semver.ts`) and toolchain (`atLeast`), Stolos's
 * `tools/version.ts` and the machine setup.
 *
 * @example
 * ```ts
 * import { atLeast, compareSemVer, parseSemVer } from "./semver.ts";
 * atLeast("2.10.0", "2.9.8"); // true
 * const a = parseSemVer("1.0.0-rc.1"), b = parseSemVer("1.0.0");
 * if (a.kind === "ok" && b.kind === "ok") compareSemVer(a.value, b.value); // negative: a pre-release comes first
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";

/** A semantic version: major, minor and patch, and an optional pre-release and build, each as its dot-separated text. */
export type SemVer = {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly pre?: string;
  readonly build?: string;
};

const NUMERIC = /^(0|[1-9][0-9]*)$/;
const PATTERN =
  /^v?(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-((?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

/** Text read as a semantic version (a leading `v` allowed, as tags carry it), or why it is not one. */
export function parseSemVer(text: string): Result<SemVer, string> {
  const m = PATTERN.exec(text.trim());
  if (m === null) return err(`${JSON.stringify(text)} is not a semantic version (major.minor.patch[-pre][+build])`);
  const [, major = "", minor = "", patch = "", pre, build] = m;
  const parts = [Number(major), Number(minor), Number(patch)] as const;
  if (!parts.every(Number.isSafeInteger)) return err(`${JSON.stringify(text)} has a number too large`);
  return ok({
    major: parts[0],
    minor: parts[1],
    patch: parts[2],
    ...(pre === undefined ? {} : { pre }),
    ...(build === undefined ? {} : { build }),
  });
}

/** A version as text: `1.2.3`, `1.2.3-rc.1` or `1.2.3-rc.1+build.5`. */
export function formatSemVer(v: SemVer): string {
  return `${v.major}.${v.minor}.${v.patch}${v.pre === undefined ? "" : `-${v.pre}`}${v.build === undefined ? "" : `+${v.build}`}`;
}

function comparePre(a: string, b: string): number {
  const x = a.split(".");
  const y = b.split(".");
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const p = x[i] ?? "";
    const q = y[i] ?? "";
    if (p === q) continue;
    const pn = NUMERIC.test(p);
    const qn = NUMERIC.test(q);
    if (pn && qn) return Number(p) - Number(q);
    if (pn) return -1;
    if (qn) return 1;
    return p < q ? -1 : 1;
  }
  return x.length - y.length;
}

/**
 * Negative where `a` comes before `b`, positive where after, zero where they have the same precedence (semver.org 2.0.0 §11): numbers
 * numerically, a pre-release before its release, pre-release identifiers one by one (numeric ones numerically and before the others), and
 * the build ignored.
 */
export function compareSemVer(a: SemVer, b: SemVer): number {
  const d = a.major - b.major || a.minor - b.minor || a.patch - b.patch;
  if (d !== 0) return Math.sign(d);
  if (a.pre === b.pre) return 0;
  if (a.pre === undefined) return 1;
  if (b.pre === undefined) return -1;
  return Math.sign(comparePre(a.pre, b.pre));
}

/** Which part of a version a change raises. */
export type Level = "major" | "minor" | "patch";

/** The next version at a level: the parts after it reset to zero, and the pre-release and build dropped. */
export function bump(v: SemVer, level: Level): SemVer {
  switch (level) {
    case "major":
      return { major: v.major + 1, minor: 0, patch: 0 };
    case "minor":
      return { major: v.major, minor: v.minor + 1, patch: 0 };
    case "patch":
      return { major: v.major, minor: v.minor, patch: v.patch + 1 };
    default:
      return absurd(level);
  }
}

/** The change a surface made, and so the least its version must change by. */
export type Change = { readonly kind: "none" } | { readonly kind: "fix" } | { readonly kind: "addition" } | { readonly kind: "breaking" };

/** Whether moving from `before` to `after` is enough for `change`; before 1.0 a breaking change needs only the minor raised. */
export function bumpSuffices(before: SemVer, after: SemVer, change: Change): boolean {
  const raised = (key: Level): boolean => after[key] > before[key];
  switch (change.kind) {
    case "none":
      return true;
    case "fix":
      return compareSemVer(after, before) > 0;
    case "addition":
      return raised("minor") || raised("major");
    case "breaking":
      return before.major === 0 ? raised("minor") || raised("major") : raised("major");
    default:
      return absurd(change);
  }
}

/** The numbers of a dotted version: split at `.`, `+`, `_` and `-`, each part's leading digits, and 0 where a part has none. */
export function dottedParts(version: string): readonly number[] {
  return version
    .trim()
    .replace(/^v/, "")
    .split(/[.+_-]/)
    .map((p) => Number.parseInt(p, 10))
    .map((n) => (Number.isNaN(n) ? 0 : n));
}

/** Negative, zero or positive as dotted version `a` is below, equal to or above `b`, part by part; a missing part counts as 0. */
export function compareDotted(a: string, b: string): number {
  const x = dottedParts(a);
  const y = dottedParts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return Math.sign(d);
  }
  return 0;
}

/** Whether dotted version `have` is at least `want`. */
export function atLeast(have: string, want: string): boolean {
  return compareDotted(have, want) >= 0;
}

/** The first dotted version in a program's output (`bun 1.4.4 (...)` gives `1.4.4`), or undefined. */
export function versionIn(text: string): string | undefined {
  return /\d+(?:\.\d+)+/.exec(text)?.[0];
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Ranges (commons 0001-formats FR-014), as npm's node-semver reads them
// ---------------------------------------------------------------------------------------------------------------------------------

/** How a comparator compares a version with its bound. */
export type Operator = "<" | "<=" | ">" | ">=" | "=";

/** A version compared with one bound: `>=1.2.3`, `<2.0.0-0`. */
export type Comparator = { readonly op: Operator; readonly version: SemVer };

/**
 * A range: sets of comparators joined by `||`. A version satisfies it where it satisfies every comparator of one set; an empty set holds
 * every version (`*`), and no set at all holds none.
 */
export type Range = { readonly kind: "range"; readonly sets: readonly (readonly Comparator[])[] };

const IDENT = "(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)";
const PART = "(0|[1-9][0-9]*|[xX*])";
const PARTIAL = new RegExp(
  `^v?${PART}(?:\\.${PART}(?:\\.${PART}(?:-(${IDENT}(?:\\.${IDENT})*))?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?)?)?$`,
);

/** A version some of whose parts may be left out or wild (`1`, `1.x`, `1.2.*`); a missing part is `undefined`. */
type Partial = { readonly major?: number; readonly minor?: number; readonly patch?: number; readonly pre?: string };

function partial(text: string): Result<Partial, string> {
  const m = PARTIAL.exec(text);
  if (m === null) return err(`${JSON.stringify(text)} is not a version, nor a partial one such as 1.x`);
  const [, a, b, c, pre] = m;
  const parts = [a, b, c].map((p) => (p === undefined || p === "x" || p === "X" || p === "*" ? undefined : Number(p)));
  const [major, minor, patch] = parts;
  const wild = parts.findIndex((p) => p === undefined);
  if (wild >= 0 && parts.slice(wild).some((p) => p !== undefined)) return err(`${JSON.stringify(text)} has a number after a wildcard`);
  if (!parts.every((p) => p === undefined || Number.isSafeInteger(p))) return err(`${JSON.stringify(text)} has a number too large`);
  if (pre !== undefined && patch === undefined) return err(`${JSON.stringify(text)} has a pre-release but no patch`);
  return ok({
    ...(major === undefined ? {} : { major }),
    ...(minor === undefined ? {} : { minor }),
    ...(patch === undefined ? {} : { patch }),
    ...(pre === undefined ? {} : { pre }),
  });
}

const ver = (major: number, minor: number, patch: number, pre?: string): SemVer => ({
  major,
  minor,
  patch,
  ...(pre === undefined ? {} : { pre }),
});
const at = (op: Operator, version: SemVer): Comparator => ({ op, version });
/** Below every version: what `<0.0.0-0` says, a set no version satisfies. */
const NOTHING: readonly Comparator[] = [at("<", ver(0, 0, 0, "0"))];

/** `^`: changes that do not modify the left-most non-zero part (`^1.2.3` is `>=1.2.3 <2.0.0-0`, `^0.2.3` is `>=0.2.3 <0.3.0-0`). */
function caret(p: Partial): readonly Comparator[] {
  const { major: M, minor: m, patch: q, pre } = p;
  if (M === undefined) return [];
  if (m === undefined) return [at(">=", ver(M, 0, 0)), at("<", ver(M + 1, 0, 0, "0"))];
  if (q === undefined) return [at(">=", ver(M, m, 0)), at("<", M === 0 ? ver(0, m + 1, 0, "0") : ver(M + 1, 0, 0, "0"))];
  const upper = M > 0 ? ver(M + 1, 0, 0, "0") : m > 0 ? ver(0, m + 1, 0, "0") : ver(0, 0, q + 1, "0");
  return [at(">=", ver(M, m, q, pre)), at("<", upper)];
}

/** `~`: patch changes where a minor is given, minor changes where not (`~1.2.3` is `>=1.2.3 <1.3.0-0`, `~1` is `>=1.0.0 <2.0.0-0`). */
function tilde(p: Partial): readonly Comparator[] {
  const { major: M, minor: m, patch: q, pre } = p;
  if (M === undefined) return [];
  if (m === undefined) return [at(">=", ver(M, 0, 0)), at("<", ver(M + 1, 0, 0, "0"))];
  return [at(">=", ver(M, m, q ?? 0, q === undefined ? undefined : pre)), at("<", ver(M, m + 1, 0, "0"))];
}

/** A comparator or a bare version, either maybe partial (`>1.2` is `>=1.3.0`, `<=1` is `<2.0.0-0`, `1.2` is `>=1.2.0 <1.3.0-0`). */
function primitive(op: Operator, p: Partial): readonly Comparator[] {
  const { major: M, minor: m, patch: q, pre } = p;
  if (M === undefined) return op === "<" || op === ">" ? NOTHING : [];
  if (m !== undefined && q !== undefined) return [at(op, ver(M, m, q, pre))];
  // the next version a wildcard leaves out: 2.0.0 for 1.x, 1.3.0 for 1.2.x
  const next = m === undefined ? ver(M + 1, 0, 0) : ver(M, m + 1, 0);
  const first = ver(M, m ?? 0, 0);
  switch (op) {
    case ">":
      return [at(">=", next)];
    case ">=":
      return [at(">=", first)];
    case "<":
      return [at("<", ver(first.major, first.minor, 0, "0"))];
    case "<=":
      return [at("<", { ...next, pre: "0" })];
    case "=":
      return [at(">=", first), at("<", { ...next, pre: "0" })];
    default:
      return absurd(op);
  }
}

/** `A - B`: at least `A`, at most `B` (`1.2 - 2.3.4` is `>=1.2.0 <=2.3.4`, `1.2.3 - 2` is `>=1.2.3 <3.0.0-0`). */
function hyphen(from: Partial, to: Partial): readonly Comparator[] {
  const lower = from.major === undefined ? [] : primitive(">=", from);
  const upper = to.major === undefined ? [] : primitive("<=", to);
  return [...lower, ...upper];
}

const OPERATOR = /^(<=|>=|<|>|=|~>|~|\^)?(.*)$/;

function set(text: string): Result<readonly Comparator[], string> {
  const trimmed = text.trim();
  const range = /^(\S+)\s+-\s+(\S+)$/.exec(trimmed);
  if (range !== null) {
    const from = partial(range[1] ?? "");
    if (from.kind === "err") return from;
    const to = partial(range[2] ?? "");
    if (to.kind === "err") return to;
    return ok(hyphen(from.value, to.value));
  }
  const words = trimmed
    .replace(/(<=|>=|<|>|=|~>|~|\^)\s+/g, "$1")
    .split(/\s+/)
    .filter((w) => w !== "");
  const out: Comparator[] = [];
  for (const word of words) {
    const m = OPERATOR.exec(word);
    const op = m?.[1];
    const rest = m?.[2] ?? "";
    if (rest === "") return err(`${JSON.stringify(word)} has no version after its operator`);
    const p = partial(rest);
    if (p.kind === "err") return p;
    switch (op) {
      case "^":
        out.push(...caret(p.value));
        break;
      case "~":
      case "~>":
        out.push(...tilde(p.value));
        break;
      case "<":
      case "<=":
      case ">":
      case ">=":
      case "=":
        out.push(...primitive(op, p.value));
        break;
      case undefined:
        out.push(...primitive("=", p.value));
        break;
      default:
        return err(`${JSON.stringify(word)} has an operator that is not one`);
    }
  }
  return ok(out);
}

/**
 * Text read as an npm range (commons 0001-formats FR-014), by node-semver's grammar and its desugaring: comparators (`<`, `<=`, `>`, `>=`, `=`) joined by
 * spaces, sets joined by `||`, hyphen ranges (`1.2.3 - 2.3.4`), x-ranges (`*`, `x`, `X` or a missing part), tilde (`~`, `~>`) and caret
 * (`^`) ranges, a space allowed after an operator, a leading `v` and builds ignored. Anything else is an error naming the part.
 */
export function parseRange(text: string): Result<Range, string> {
  const sets: (readonly Comparator[])[] = [];
  for (const part of text.split("||")) {
    const s = set(part);
    if (s.kind === "err") return err(`${JSON.stringify(text)} is not a range: ${s.error}`);
    sets.push(s.value);
  }
  return ok({ kind: "range", sets });
}

/** A range as text: each set's comparators joined by spaces (`=` written as the bare version, an empty set as `*`), the sets by ` || `. */
export function formatRange(range: Range): string {
  return range.sets
    .map((s) => (s.length === 0 ? "*" : s.map((c) => `${c.op === "=" ? "" : c.op}${formatSemVer(c.version)}`).join(" ")))
    .join(" || ");
}

function holds(c: Comparator, v: SemVer): boolean {
  const d = compareSemVer(v, c.version);
  switch (c.op) {
    case "<":
      return d < 0;
    case "<=":
      return d <= 0;
    case ">":
      return d > 0;
    case ">=":
      return d >= 0;
    case "=":
      return d === 0;
    default:
      return absurd(c.op);
  }
}

/** Whether pre-releases are held to the comparators alone (`includePrerelease`), rather than only where a bound names their release. */
export type SatisfiesOptions = { readonly includePrerelease?: boolean };

/**
 * Whether a version satisfies a range (commons 0001-formats FR-014): every comparator of one of its sets holds. A pre-release version satisfies a set only where
 * one of its comparators is a pre-release of the same major, minor and patch (`1.2.3-beta.4` satisfies `^1.2.3-beta.2`, `1.2.4-beta`
 * does not satisfy `^1.2.3`), as node-semver has it, unless `includePrerelease` is given, when the comparators alone decide.
 */
export function satisfies(version: SemVer, range: Range, options: SatisfiesOptions = {}): boolean {
  return range.sets.some(
    (s) =>
      s.every((c) => holds(c, version)) &&
      (version.pre === undefined ||
        options.includePrerelease === true ||
        s.some(
          (c) =>
            c.version.pre !== undefined &&
            c.version.major === version.major &&
            c.version.minor === version.minor &&
            c.version.patch === version.patch,
        )),
  );
}

/** The highest of the versions that satisfy the range, or undefined where none does. */
export function maxSatisfying(versions: readonly SemVer[], range: Range, options: SatisfiesOptions = {}): SemVer | undefined {
  let best: SemVer | undefined;
  for (const v of versions) if (satisfies(v, range, options) && (best === undefined || compareSemVer(v, best) > 0)) best = v;
  return best;
}
