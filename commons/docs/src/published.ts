// Spec: 0001-docs FR-033
/**
 * The release a build of the site describes (docs 0001-docs FR-033): the newest stable version of the package that the registry holds, read from the evidence (`registry.json`, kept by the workflow that builds the site), or, where there is no such file, the version of the package's own `package.json`, shown as unconfirmed. Everything here is a pure function of what it is given: the registry, the local version, the commit and the count of commits since the release record are read by the caller.
 *
 * @remarks
 * A version that only `package.json` holds is never shown as the registry's: `source` says which it is, and the footer and the tooltip of the version say so. The commits since the release are counted from the commit that made the release record, and are shown only where the record names the version shown and the history is whole.
 *
 * @limits
 * It does not read the registry, the git history or any file; it keeps no history of releases beyond the versions the registry holds.
 *
 * @module
 */

/** One version the registry holds. */
export interface RegistryVersion {
  /** The version, `0.4.2`. */
  readonly version: string;
  /** The day it was published (`2026-11-22`), where the registry says. */
  readonly date: string | undefined;
}

/** What `registry.json` says: the versions, or why they could not be read. */
export type RegistryEvidence = { readonly kind: "versions"; readonly versions: readonly RegistryVersion[] } | { readonly kind: "unreadable"; readonly why: string };

/** The release a site describes. */
export interface Release {
  /** The version shown. */
  readonly version: string;
  /** Where it was read: the registry, or the package's own `package.json` (not confirmed on the registry). */
  readonly source: "registry" | "package.json";
  /** The day it was published, where the registry says. */
  readonly date: string | undefined;
  /** The short commit the site was built from. */
  readonly commit: string | undefined;
  /** The commits since the release record, where known. */
  readonly ahead: number | undefined;
  /** Every version the registry holds, newest first (empty where it was not read). */
  readonly published: readonly RegistryVersion[];
}

/** What the caller read. */
export interface ReleaseInputs {
  /** The registry's answer, where there is a file. */
  readonly registry: RegistryEvidence | undefined;
  /** The `version` of the package's own `package.json`. */
  readonly local: string | undefined;
  /** The short commit of the build. */
  readonly commit: string | undefined;
  /** The version the release record (a file of the repository) names. */
  readonly recorded: string | undefined;
  /** The commits since the commit that made the release record, where the history is whole. */
  readonly ahead: number | undefined;
}

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

/** Whether a text is a version of the form `1.2.3` or `1.2.3-beta.1`. */
export const isVersion = (v: string): boolean => SEMVER.test(v);

/** The comparison of two versions by the rules of semantic versioning (a version with a pre-release is before the same without one); a text that is not a version is before one that is. */
export function compareVersions(a: string, b: string): number {
  const x = SEMVER.exec(a);
  const y = SEMVER.exec(b);
  if (x === null || y === null) return x === null && y === null ? a.localeCompare(b) : x === null ? -1 : 1;
  for (const i of [1, 2, 3] as const) {
    const d = Number(x[i]) - Number(y[i]);
    if (d !== 0) return d;
  }
  const p = x[4];
  const q = y[4];
  if (p === undefined || q === undefined) return p === q ? 0 : p === undefined ? 1 : -1;
  const ps = p.split(".");
  const qs = q.split(".");
  for (let i = 0; i < Math.max(ps.length, qs.length); i++) {
    const l = ps[i];
    const r = qs[i];
    if (l === undefined) return -1;
    if (r === undefined) return 1;
    const ln = /^\d+$/.test(l);
    const rn = /^\d+$/.test(r);
    const d = ln && rn ? Number(l) - Number(r) : ln ? -1 : rn ? 1 : l.localeCompare(r);
    if (d !== 0) return d;
  }
  return 0;
}

/** The release a site describes, or `undefined` where neither the registry nor the package says a version. */
export function resolveRelease(i: ReleaseInputs): Release | undefined {
  const published = i.registry?.kind === "versions" ? [...i.registry.versions].filter((v) => isVersion(v.version)).sort((a, b) => compareVersions(b.version, a.version)) : [];
  const stable = published.find((v) => !v.version.includes("-"));
  const newest = stable ?? published[0];
  if (newest !== undefined) {
    const ahead = i.recorded === newest.version && i.ahead !== undefined && i.ahead > 0 ? i.ahead : undefined;
    return { version: newest.version, source: "registry", date: newest.date, commit: i.commit, ahead, published };
  }
  if (i.local === undefined || !isVersion(i.local)) return undefined;
  return { version: i.local, source: "package.json", date: undefined, commit: i.commit, ahead: undefined, published };
}

/** The sentence of the footer about the release. */
export function releaseSentence(name: string, r: Release): string {
  const parts = [`${name} v${r.version}`];
  if (r.source === "registry") parts.push(r.date === undefined ? "published on the package registry" : `published on the package registry on ${r.date}`);
  else parts.push("the version of package.json, not confirmed on the package registry");
  if (r.commit !== undefined) parts.push(`built from commit ${r.commit}`);
  return parts.join(" · ");
}

/** The parse of `registry.json`: `{ "versions": [{ "version": "0.4.2", "createdAt": "2026-11-22T10:00:00Z" }] }` or `{ "error": "why" }`. */
export function parseRegistry(text: string): { readonly value: RegistryEvidence } | { readonly error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { error: `is not JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return { error: "is not an object with `versions` or `error`" };
  const o = data as Record<string, unknown>;
  if (typeof o["error"] === "string") return { value: { kind: "unreadable", why: o["error"] } };
  const list = o["versions"];
  if (!Array.isArray(list)) return { error: "has neither `versions` nor `error`" };
  const versions: RegistryVersion[] = [];
  for (const item of list) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    const version = r["version"];
    if (typeof version !== "string") continue;
    const at = r["createdAt"] ?? r["date"];
    versions.push({ version, date: typeof at === "string" ? at.slice(0, 10) : undefined });
  }
  return { value: { kind: "versions", versions } };
}
