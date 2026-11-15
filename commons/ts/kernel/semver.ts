/**
 * Versions: semantic versions by the rules of semver.org 2.0.0 (parsed, printed, ordered and bumped), and the looser dotted versions that
 * programs print (`2.9.8`, `1.4.4`, `26.13.1`), compared part by part (commons 0005-typescript-runtime FR-007). Taken from erga's kernel
 * (`semver.ts`) and toolchain (`atLeast`), Stolos's `tools/version.ts` and the machine setup.
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
import { absurd } from "./absurd.ts";
import { err, ok, type Result } from "./result.ts";

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
  return version.trim().replace(/^v/, "").split(/[.+_-]/).map((p) => Number.parseInt(p, 10)).map((n) => (Number.isNaN(n) ? 0 : n));
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

/** The first dotted version in a program's output (`deno 2.9.8 (stable, ...)` gives `2.9.8`), or undefined. */
export function versionIn(text: string): string | undefined {
  return /\d+(?:\.\d+)+/.exec(text)?.[0];
}
