// Spec: 0004-repoctl-status-release FR-001
/**
 * The order of versions (commons repoctl 0004-repoctl-status-release FR-001): the greatest of some versions of Semantic Versioning, by their numbers, a pre-release coming before the same numbers without one. Pure.
 *
 * @example
 * ```ts
 * import { compareSemver, greatest } from "./semver.ts";
 * compareSemver("0.10.0", "0.9.9"); // 1
 * greatest(["1.0.0-rc.1", "1.0.0", "0.9.0"]); // "1.0.0"
 * ```
 *
 * @module
 */

const PARTS = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/;

/** The numbers and the pre-release of a version, or undefined where the text is not one. */
function partsOf(text: string): { readonly numbers: readonly [number, number, number]; readonly pre: string | undefined } | undefined {
  const m = PARTS.exec(text);
  if (m === null) return undefined;
  return { numbers: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] };
}

/** -1, 0 or 1 as `a` is before, the same as, or after `b`; a text that is not a version is before every version. */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const x = partsOf(a);
  const y = partsOf(b);
  if (x === undefined || y === undefined) return x === undefined && y === undefined ? 0 : x === undefined ? -1 : 1;
  for (let i = 0; i < 3; i++) {
    const d = (x.numbers[i] ?? 0) - (y.numbers[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  if (x.pre === y.pre) return 0;
  if (x.pre === undefined) return 1;
  if (y.pre === undefined) return -1;
  return x.pre < y.pre ? -1 : 1;
}

/** The greatest of some versions, or undefined where there are none. */
export function greatest(versions: readonly string[]): string | undefined {
  return versions.reduce<string | undefined>((best, v) => (best === undefined || compareSemver(v, best) > 0 ? v : best), undefined);
}
