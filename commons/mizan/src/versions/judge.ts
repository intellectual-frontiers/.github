/**
 * The version check (commons 0026-works-versioning FR-007, FR-009 to FR-014, FR-022, FR-037): for each work, whether its record decodes, whether its version matches the pattern of its kind's scheme,
 * whether its identity is the one it had at the base, and, where files of the work changed since the base, whether its version grew by its scheme.
 *
 * @remarks
 * Pure: it is given the tracked paths and the records of two trees (the head and the base), the paths Git says changed between them, and, for the editions of prose, what Git said of the commits
 * the editions name (their day and which is the ancestor of which). A work is told from another by its slug, so a work that moved to another folder is the same work; a work whose folder holds
 * a record of another slug is a new work only where its record names the one it replaces (`replaces`), and a change of slug, IRI or position otherwise is `versions/identity-changed`. A version
 * grows by the scheme of its kind: Semantic Version precedence (build ignored), an edition by its day and then the history, a snapshot by a later day and another digest (and a schema version that
 * grew where the schema's files changed), a revision by a greater number.
 *
 * @limits
 * It reads no Git: `git.ts` gives it the facts. A base whose record does not decode is a base that says nothing, and the work is judged by its head alone.
 *
 * @example
 * ```ts
 * import { judgeWorks } from "./judge.ts";
 * // judgeWorks({ head, base, changed: ["lib/src/a.ts"], editions }) -> [{ rule: "versions/not-grown", ... }] where lib/release.ts did not change
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { formatRecordError } from "../changes/declaration.ts";
import { decodeReleaseSource, type Release } from "./record.ts";
import type { VersionsFinding } from "./rules.ts";
import { compareVersions, parseVersion, schemeOf } from "./scheme.ts";
import { filesOf, isUnder, recordPathOf, scopeOf, workFolders } from "./works.ts";

/** A tree as the check reads it: its tracked paths and the text of each record by the folder of its work. */
export type TreeFacts = { readonly paths: readonly string[]; readonly records: ReadonlyMap<string, string> };

/** What Git said of the commits that editions name: each by its first eight characters, and which commit is an ancestor of which. */
export type EditionFacts = {
  /** The commits the editions of the head and the base name, by the first eight characters of their object names. */
  readonly commits: ReadonlyMap<string, { readonly commit: string; readonly day: string }>;
  /** Pairs `<ancestor> <descendant>` of full object names. */
  readonly ancestry: ReadonlySet<string>;
  /** The head commit. */
  readonly head: string;
};

/** Whether `a` is `b` or an ancestor of it, by the facts given. */
export function isAncestorIn(facts: EditionFacts, a: string, b: string): boolean {
  return a === b || facts.ancestry.has(`${a} ${b}`);
}

/** Everything the check takes: the two trees, the paths that changed between them and the facts about editions. */
export type CheckInput = {
  readonly head: TreeFacts;
  readonly base: TreeFacts;
  readonly changed: readonly string[];
  readonly editions: EditionFacts;
};

/** A record read, with the file it is in. */
export type ReadRecord = { readonly folder: string; readonly file: string; readonly release: Release };

function finding(rule: VersionsFinding["rule"], file: string, work: string, message: string): VersionsFinding {
  return { rule, file, work, message };
}

/** What is wrong with the versions a record carries, by the scheme of its kind (FR-006, FR-010): the version, the schema version of data, the first version of a migration. */
export function versionProblems(r: Release): readonly string[] {
  const scheme = schemeOf(r.kind);
  const out: string[] = [];
  if (r.version !== undefined) {
    const v = parseVersion(scheme, r.version);
    if (v.kind === "err") out.push(`the version of a ${r.kind} is a ${scheme}: ${v.error}`);
  }
  if (r.snapshot !== undefined) {
    const v = parseVersion("SemVer", r.snapshot.schemaVersion);
    if (v.kind === "err") out.push(`the schema version of the snapshot is a SemVer: ${v.error}`);
  }
  if (r.migratedFrom !== undefined) {
    if (r.migratedFrom.scheme === scheme)
      out.push(`migratedFrom names the scheme the work uses now (${scheme}): it names the one it came from`);
    const v = scheme === "NoVersion" ? undefined : parseVersion(scheme, r.migratedFrom.firstVersion);
    if (v?.kind === "err") out.push(`migratedFrom.firstVersion is a ${scheme}: ${v.error}`);
  }
  return out;
}

/**
 * The findings a record has by itself, which a folder can judge offline (FR-032), and the record where it decoded: that it decodes, that its version matches the pattern of its kind's
 * scheme, and that the revision of a controlled document has its approval (FR-013).
 */
export function recordFindings(
  folder: string,
  text: string | undefined,
): { readonly found: readonly VersionsFinding[]; readonly record?: ReadRecord } {
  const file = recordPathOf(folder);
  if (text === undefined) return { found: [finding("versions/record-invalid", file, folder, "the record cannot be read")] };
  const d = decodeReleaseSource(text);
  if (d.kind === "err") return { found: [finding("versions/record-invalid", file, folder, formatRecordError(d.error))] };
  const release = d.value;
  const slug: string = release.slug;
  const found: VersionsFinding[] = versionProblems(release).map((m) => finding("versions/scheme-mismatch", file, slug, m));
  for (const p of release.paths ?? [])
    if (isUnder(p, folder))
      found.push(
        finding(
          "versions/record-invalid",
          file,
          slug,
          `paths names ${p}, which is ${folder === "" ? "in the root, where the work already holds every file" : `inside the folder ${folder}, which the work already holds`}: paths names what is outside the folder`,
        ),
      );
  if (release.kind === "ControlledDocument" && release.approval === undefined)
    found.push(
      finding(
        "versions/approval-missing",
        file,
        slug,
        `revision ${release.version ?? "?"} of a controlled document has no approval record (approvedBy, role, on, decision): a revision with no approval is a finding`,
      ),
    );
  return { found, record: { folder, file, release } };
}

/** The first eight characters of the commits that the editions of Prose works name, at the head and the base: what the host asks Git about. */
export function editionsNeeded(head: TreeFacts, base: TreeFacts): readonly string[] {
  const out = new Set<string>();
  for (const tree of [head, base])
    for (const folder of workFolders(tree.paths)) {
      const text = tree.records.get(folder);
      const d = text === undefined ? undefined : decodeReleaseSource(text);
      if (d?.kind !== "ok" || d.value.kind !== "Prose" || d.value.version === undefined) continue;
      const v = parseVersion("CommitDateEdition", d.value.version);
      if (v.kind === "ok" && v.value.scheme === "CommitDateEdition") out.add(v.value.commit8);
    }
  return [...out].sort();
}

function underAny(paths: readonly string[], prefixes: readonly string[]): boolean {
  return paths.some((p) => prefixes.some((x) => isUnder(p, x)));
}

/** Whether `a` is a greater Semantic Version than `b` (both plain). */
function semverGrew(a: string, b: string): boolean | undefined {
  const x = parseVersion("SemVer", a);
  const y = parseVersion("SemVer", b);
  if (x.kind === "err" || y.kind === "err") return undefined;
  const c = compareVersions(x.value, y.value);
  return c === undefined ? undefined : c > 0;
}

/** The judgement of one work present at the head against the same work at the base. */
function judgeGrowth(
  head: ReadRecord,
  base: ReadRecord,
  changedFiles: readonly string[],
  changedAll: readonly string[],
  editions: EditionFacts,
): readonly VersionsFinding[] {
  const h = head.release;
  const b = base.release;
  const slug: string = h.slug;
  const at = head.file;
  const notGrown = (m: string): VersionsFinding => finding("versions/not-grown", at, slug, m);
  const scheme = schemeOf(h.kind);
  const was = schemeOf(b.kind);
  if (scheme !== was) {
    // a change of scheme begins the new scheme at the version the record names (FR-037)
    const m = h.migratedFrom;
    if (m === undefined)
      return [
        finding(
          "versions/scheme-mismatch",
          at,
          slug,
          `the work changed from ${was} to ${scheme} and its record has no migratedFrom (FR-037)`,
        ),
      ];
    if (m.scheme !== was)
      return [finding("versions/scheme-mismatch", at, slug, `migratedFrom names ${m.scheme} and the work came from ${was}`)];
    return h.version === m.firstVersion
      ? []
      : [
          finding(
            "versions/scheme-mismatch",
            at,
            slug,
            `the first version of the new scheme is ${m.firstVersion} and the version is ${h.version ?? "none"}`,
          ),
        ];
  }
  if (scheme === "NoVersion" || h.version === undefined || b.version === undefined) return [];
  const hv = parseVersion(scheme, h.version);
  const bv = parseVersion(scheme, b.version);
  if (hv.kind === "err" || bv.kind === "err") return []; // the mismatch is found by the record's own judgement
  const moved = changedFiles.length > 0;
  switch (scheme) {
    case "SemVer": {
      const c = compareVersions(hv.value, bv.value);
      if (c === undefined) return [];
      if (c < 0) return [notGrown(`the version went back from ${b.version} to ${h.version}`)];
      return c === 0 && moved
        ? [notGrown(`${changedFiles.length} files of the work changed (${sample(changedFiles)}) and the version is still ${h.version}`)]
        : [];
    }
    case "IntegerRevision": {
      const c = compareVersions(hv.value, bv.value);
      if (c === undefined) return [];
      if (c < 0) return [notGrown(`the revision went back from ${b.version} to ${h.version}`)];
      return c === 0 && moved
        ? [notGrown(`${changedFiles.length} files of the work changed (${sample(changedFiles)}) and the revision is still ${h.version}`)]
        : [];
    }
    case "SnapshotDate": {
      const out: VersionsFinding[] = [];
      const c = compareVersions(hv.value, bv.value);
      const digestChanged = h.snapshot?.digest !== b.snapshot?.digest;
      if (c !== undefined && c < 0) out.push(notGrown(`the snapshot date went back from ${b.version} to ${h.version}`));
      else if (c === 0 && (moved || digestChanged))
        out.push(
          notGrown(
            `the snapshot of ${h.version} changed (${digestChanged ? "its digest differs" : `${changedFiles.length} files changed`}) and the date is not later: a snapshot taken again is a later day`,
          ),
        );
      else if (c !== undefined && c > 0 && !digestChanged)
        out.push(notGrown(`the snapshot date is later (${h.version}) and the digest is the same as ${b.version}'s`));
      const paths = h.snapshot?.schemaPaths ?? [];
      if (
        h.snapshot !== undefined &&
        b.snapshot !== undefined &&
        paths.length > 0 &&
        underAny(
          changedAll.map((p) => relativeTo(p, head.folder)),
          paths,
        )
      ) {
        if (semverGrew(h.snapshot.schemaVersion, b.snapshot.schemaVersion) !== true)
          out.push(
            notGrown(
              `the files of the schema changed and its version is ${h.snapshot.schemaVersion}, not greater than ${b.snapshot.schemaVersion}`,
            ),
          );
      }
      return out;
    }
    case "CommitDateEdition": {
      const order = (x: string, y: string): number => {
        const cx = editions.commits.get(x);
        const cy = editions.commits.get(y);
        if (cx === undefined || cy === undefined) return 0;
        return isAncestorIn(editions, cy.commit, cx.commit) ? 1 : isAncestorIn(editions, cx.commit, cy.commit) ? -1 : 0;
      };
      const c = compareVersions(hv.value, bv.value, order);
      if (c === undefined) return [];
      if (c < 0) return [notGrown(`the edition ${h.version} is before the base's edition ${b.version}`)];
      if (c === 0 && h.version !== b.version)
        return [
          notGrown(
            `the edition ${h.version} is not later than ${b.version}: on the same day its commit is not a descendant of the base's edition commit`,
          ),
        ];
      return c === 0 && moved
        ? [notGrown(`${changedFiles.length} files of the work changed (${sample(changedFiles)}) and the edition is still ${h.version}`)]
        : [];
    }
    default:
      return absurd(scheme);
  }
}

function relativeTo(path: string, folder: string): string {
  return folder === "" ? path : path.startsWith(`${folder}/`) ? path.slice(folder.length + 1) : path;
}

function sample(paths: readonly string[]): string {
  return paths.length <= 2 ? paths.join(", ") : `${paths.slice(0, 2).join(", ")}, ...`;
}

/** The edition's own findings: its commit is found, its day is that commit's UTC day, and the commit is in the history of the head (FR-011). */
function editionFindings(r: ReadRecord, editions: EditionFacts): readonly VersionsFinding[] {
  if (r.release.kind !== "Prose" || r.release.version === undefined) return [];
  const v = parseVersion("CommitDateEdition", r.release.version);
  if (v.kind === "err" || v.value.scheme !== "CommitDateEdition") return [];
  const slug: string = r.release.slug;
  const at = (m: string): VersionsFinding => finding("versions/scheme-mismatch", r.file, slug, m);
  const c = editions.commits.get(v.value.commit8);
  if (c === undefined) return [at(`the commit ${v.value.commit8} of the edition ${r.release.version} is not found in this repository`)];
  const out: VersionsFinding[] = [];
  if (c.day !== v.value.day)
    out.push(
      at(
        `the edition ${r.release.version} says ${v.value.day} and the committer date in UTC of ${v.value.commit8} is ${c.day}: the date is the commit's, never the clock's`,
      ),
    );
  if (!isAncestorIn(editions, c.commit, editions.head))
    out.push(at(`the commit ${v.value.commit8} of the edition ${r.release.version} is not in the history of the head`));
  return out;
}

/**
 * The version check over the works of the head against the base (FR-022): the findings of each record by itself, a change of identity (FR-007), and for each work whose files changed since
 * the base a version that did not grow by its scheme (FR-010 to FR-014).
 */
export function judgeWorks(input: CheckInput): readonly VersionsFinding[] {
  const { head, base, changed, editions } = input;
  const out: VersionsFinding[] = [];
  const headFolders = workFolders(head.paths);
  const baseFolders = workFolders(base.paths);
  const headRecords: ReadRecord[] = [];
  for (const folder of headFolders) {
    const r = recordFindings(folder, head.records.get(folder));
    out.push(...r.found);
    if (r.record !== undefined) headRecords.push(r.record);
  }
  const baseRecords: ReadRecord[] = [];
  for (const folder of baseFolders) {
    const d = base.records.get(folder);
    const read = d === undefined ? undefined : decodeReleaseSource(d);
    if (read?.kind === "ok") baseRecords.push({ folder, file: recordPathOf(folder), release: read.value });
  }
  const seen = new Map<string, string>();
  for (const r of headRecords) {
    const slug: string = r.release.slug;
    const other = seen.get(slug);
    if (other !== undefined)
      out.push(
        finding(
          "versions/record-invalid",
          r.file,
          slug,
          `the slug ${slug} is also the slug of the work in ${other === "" ? "the root" : other}: a slug names one work`,
        ),
      );
    else seen.set(slug, r.folder);
    out.push(...editionFindings(r, editions));
  }
  for (const h of headRecords) {
    const slug: string = h.release.slug;
    const bySlug = baseRecords.find((b) => b.release.slug === h.release.slug);
    const byFolder = baseRecords.find((b) => b.folder === h.folder);
    if (bySlug === undefined) {
      if (byFolder !== undefined && byFolder.release.slug !== h.release.slug && h.release.replaces !== byFolder.release.slug)
        out.push(
          finding(
            "versions/identity-changed",
            h.file,
            slug,
            `the slug of the work in ${h.folder === "" ? "the root" : h.folder} changed from ${byFolder.release.slug} to ${slug}: a renamed work is a new work whose record names the one it replaces (replaces: "${byFolder.release.slug}")`,
          ),
        );
      continue; // a new work: nothing to compare with
    }
    const b = bySlug;
    const was = b.release;
    const now = h.release;
    if (was.iri !== undefined && now.iri !== was.iri)
      out.push(
        finding(
          "versions/identity-changed",
          h.file,
          slug,
          `the IRI of the work changed from ${was.iri} to ${now.iri ?? "none"}: an identity never changes`,
        ),
      );
    if (was.position !== undefined && now.position !== was.position)
      out.push(
        finding(
          "versions/identity-changed",
          h.file,
          slug,
          `the position of the volume changed from ${was.position} to ${now.position ?? "none"}: a position never changes`,
        ),
      );
    const inHead = scopeOf(h.folder, headFolders, now.exclude ?? [], now.paths ?? []);
    const inBase = scopeOf(b.folder, baseFolders, was.exclude ?? [], was.paths ?? []);
    const filesChanged = changed.filter((p) => inHead(p) || inBase(p));
    out.push(...judgeGrowth(h, b, filesChanged, changed, editions));
  }
  return out;
}

/** The files of a work at a tree, for the commands that list them. */
export function workFiles(tree: TreeFacts, folder: string, exclude: readonly string[], paths: readonly string[] = []): readonly string[] {
  return filesOf(tree.paths, folder, workFolders(tree.paths), exclude, paths);
}
