/**
 * `versions`, how works are versioned (commons 0026-works-versioning): `check` finds a work whose files changed since the base and whose version did not grow by its scheme, `bump` writes the next
 * version into a work's record, `tag` creates the annotated (and, where Git is set to sign, signed) tag `<slug>-v<version>`, `notes` prints the release notes from the capabilities closed since the
 * last tag, `cite` writes `CITATION.cff` from the record, and `ledger` derives the ledger of releases from the tags.
 *
 *     bun commons/ts/mizan/versions.ts check [--base REV]                          judge every work against the merge base with REV (origin/main by default)
 *     bun commons/ts/mizan/versions.ts bump WORK --impact major|minor|patch|auto   write the next version into WORK's record (auto: the greatest `Impact:` of the commits since its last tag)
 *     bun commons/ts/mizan/versions.ts tag WORK [--tier TIER] [--declaration FILE] create the annotated tag at HEAD, signed where Git signs; a regulated harness releases only on its declared tier
 *     bun commons/ts/mizan/versions.ts notes WORK [--from TAG]                     release notes (Markdown) from the `Closes #N` lines of the commits since the last tag
 *     bun commons/ts/mizan/versions.ts cite WORK [--check]                         write CITATION.cff (--check: exit 1 where the file is not what the record makes)
 *     bun commons/ts/mizan/versions.ts ledger [WORK] [--json] [--against FILE]     the releases, from the tags; --against finds a tag that moved or is gone since an earlier --json
 *     other flags: --repo DIR (the repository, the working folder by default)
 *
 * A work is named by its slug or by its folder. Exit status: 0 where it did what was asked and found nothing, 1 where it found something (or `cite --check` finds the file different, or a release
 * is refused), 2 for a usage error (an unknown command, option or work, a work of no version, no commit that states an impact), 3 where the environment cannot do it. A run that could not run says
 * `not_run` with its reason (Git absent, no repository, a base that cannot be found) and writes no record (FR-031). It reads only Git: a repository on plain Git, with no host, is enough.
 *
 * @module
 */
import process from "node:process";
import { absurd, err, ok } from "@intellectual-frontiers/core";
import {
  flag,
  formatUsageError,
  helpText,
  type Operand,
  parseArgs,
  type Parser,
  suggest,
  value,
} from "@intellectual-frontiers/terminal/args";
import { existsSync, readTextFileSync, sha256File, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { formatGitError } from "@intellectual-frontiers/system/git";
import { join, resolve } from "@intellectual-frontiers/system/path";
import { stdio } from "@intellectual-frontiers/system";
import { dayOf, decodeHarnessRecord, type Declaration, formatRecordError } from "./changes/declaration.ts";
import { citationOf } from "./versions/cite.ts";
import { releaseGate } from "./versions/gate.ts";
import {
  commitsSince,
  commitSeconds,
  createTag,
  editionFacts,
  findBase,
  changedBetween,
  isAncestor,
  isDirty,
  isRepository,
  readTags,
  readTree,
  readWorkingTree,
  resolveCommit,
  signingConfigured,
  tagAncestry,
  tagsMerged,
  text as gitText,
} from "./versions/git.ts";
import { editionsNeeded, judgeWorks, recordFindings, type ReadRecord, type TreeFacts, versionProblems } from "./versions/judge.ts";
import { type EarlierEntry, lastRelease, ledgerJson, ledgerText, readEarlier, readLedger, tagNameOf } from "./versions/ledger.ts";
import { impactOfCommits, notesOf } from "./versions/notes.ts";
import { type Release, releaseSource, CITATION_FILE } from "./versions/record.ts";
import { formatFinding, sortFindings, type VersionsFinding } from "./versions/rules.ts";
import { type Impact, IMPACTS, compareVersions, editionAt, nextSemVer, parseVersion, schemeOf, utcDay } from "./versions/scheme.ts";
import { isReleaseTier } from "./versions/gate.ts";
import { recordPathOf, scopeOf, workFolders } from "./versions/works.ts";

/** What the command is given besides its arguments: where it writes and the clock (the one place the tool reads it, for the day a snapshot or an approval is made). */
export type Deps = {
  readonly out?: (text: string) => void;
  readonly err?: (text: string) => void;
  readonly now?: () => Date;
};

/** The commands, in the order the help lists them. */
export const COMMANDS = ["check", "bump", "tag", "notes", "cite", "ledger"] as const;

type Say = { readonly out: (t: string) => void; readonly err: (t: string) => void };

const REPO = value({ help: "The repository (the working folder where not given).", valueName: "DIR", default: "." });
const dayParser: Parser<string> = (t) => (dayOf(t) === undefined ? err("a day is YYYY-MM-DD") : ok(t));
const impactParser: Parser<Impact | "auto"> = (t) => {
  const i = IMPACTS.find((x) => x === t);
  return i !== undefined ? ok(i) : t === "auto" ? ok("auto") : err("major, minor, patch or auto");
};
const tierParser: Parser<string> = (t) => (isReleaseTier(t) ? ok(t) : err("Tier0, Tier1 or Tier2"));
const WORK: readonly Operand[] = [{ name: "WORK", help: "The work, by its slug or its folder.", arity: "one" }];

const CHECK = {
  repo: REPO,
  base: value({
    help: "The revision to compare with (the merge base with it is the base): origin/main where not given.",
    valueName: "REV",
  }),
};
const BUMP = {
  repo: REPO,
  impact: value({
    help: "The impact of the change: major, minor, patch, or auto (the greatest `Impact:` of the commits since the last tag).",
    valueName: "IMPACT",
    parse: impactParser,
  }),
  snapshot: value({ help: "For data: the file whose SHA-256 is the snapshot's digest.", valueName: "FILE" }),
  day: value({ help: "For data and an approval: the day (the clock where not given).", valueName: "DAY", parse: dayParser }),
  approvedBy: value({ help: "For a controlled document: the person who approves the new revision.", valueName: "NAME" }),
  role: value({ help: "For a controlled document: the role of the approver.", valueName: "ROLE" }),
  decision: value({ help: "For a controlled document: the identifier of the Decision.", valueName: "ID" }),
};
const TAG = {
  repo: REPO,
  tier: value({
    help: "The evidence tier judged by `quality tier` (Tier0, Tier1 or Tier2); a regulated harness releases only on the tier it declares.",
    valueName: "TIER",
    parse: tierParser,
  }),
  declaration: value({ help: "The harness's record (ifccm.declaration.ts of the repository where not given).", valueName: "FILE" }),
};
const NOTES = { repo: REPO, from: value({ help: "The tag to start after (the work's last tag where not given).", valueName: "TAG" }) };
const CITE = { repo: REPO, check: flag({ help: "Write nothing: exit 1 where CITATION.cff is not what the record makes." }) };
const LEDGER = {
  repo: REPO,
  json: flag({ help: "Print a deterministic JSON document." }),
  against: value({ help: "An earlier `ledger --json` output: a tag of it that moved or is gone is a finding.", valueName: "FILE" }),
};

const HELP_SUMMARY: Readonly<Record<(typeof COMMANDS)[number], string>> = {
  check: "Find a work whose files changed and whose version did not grow.",
  bump: "Write the next version into a work's record.",
  tag: "Create the annotated tag of a work's version.",
  notes: "Print the release notes from the capabilities closed since the last tag.",
  cite: "Write CITATION.cff from a work's record.",
  ledger: "Print the releases derived from the tags.",
};

/** One sentence of why a run did not run, in the form every command says it. */
function notRun(s: Say, reason: string): number {
  s.err(`versions: not_run: ${reason}\n`);
  return 3;
}

function usage(s: Say, message: string): number {
  s.err(`versions: ${message}\nusage: versions.ts ${COMMANDS.join("|")} [options] (--help for a command)\n`);
  return 2;
}

type Loaded = {
  readonly repo: string;
  readonly tree: TreeFacts;
  readonly works: readonly ReadRecord[];
  readonly invalid: readonly VersionsFinding[];
};

/** The repository and its records as they are now, or the code and the reason a run could not run. */
async function load(repo: string, s: Say): Promise<Loaded | number> {
  const inside = await isRepository(repo);
  if (inside.kind === "err") return notRun(s, formatGitError(inside.error));
  if (!inside.value) return notRun(s, `${repo} is not a Git repository`);
  const tree = await readWorkingTree(repo);
  if (tree.kind === "err") return notRun(s, formatGitError(tree.error));
  const works: ReadRecord[] = [];
  const invalid: VersionsFinding[] = [];
  for (const folder of workFolders(tree.value.paths)) {
    const r = recordFindings(folder, tree.value.records.get(folder));
    if (r.record === undefined) invalid.push(...r.found);
    else works.push(r.record);
  }
  return { repo, tree: tree.value, works, invalid };
}

/** The work a name means: by slug, or by its folder (`.` for the root); or the code to exit with and what to say. */
function select(l: Loaded, name: string, s: Say): ReadRecord | number {
  const found = l.works.find((w) => w.release.slug === name) ?? l.works.find((w) => w.folder === name || (name === "." && w.folder === ""));
  if (found !== undefined) return found;
  const bad = l.invalid.find((f) => f.file === recordPathOf(name === "." ? "" : name));
  if (bad !== undefined) {
    s.err(`${formatFinding(bad)}\n`);
    return 1;
  }
  return usage(
    s,
    `no work ${JSON.stringify(name)}: the works are ${l.works.map((w) => w.release.slug).join(", ") || "none (no release.ts is tracked)"}`,
  );
}

/** What `checkVersions` found, or why it could not run (`not_run`, FR-031): the findings, the number of works judged and what they were judged against. */
export type VersionsCheck =
  | { readonly kind: "judged"; readonly findings: readonly VersionsFinding[]; readonly works: number; readonly from: string }
  | { readonly kind: "not_run"; readonly reason: string };

/**
 * The version check as data (0026-works-versioning FR-022, FR-040): every work of the repository at `repo` judged against the merge base with `rev` (`origin/main` where not given). It reads only
 * Git, so it runs offline: no host, no network, a base that is any revision the repository holds (a branch, a tag or a commit). A consumer calls this, or `run(["check", "--base", rev, "--repo", repo])`.
 */
export async function checkVersions(repo: string, rev = "origin/main"): Promise<VersionsCheck> {
  const notRunBecause = (reason: string): VersionsCheck => ({ kind: "not_run", reason });
  const inside = await isRepository(repo);
  if (inside.kind === "err") return notRunBecause(formatGitError(inside.error));
  if (!inside.value) return notRunBecause(`${repo} is not a Git repository`);
  const base = await findBase(repo, rev);
  if (base.kind === "err") return notRunBecause(base.error.kind === "git" ? formatGitError(base.error.error) : base.error.reason);
  const head = await readTree(repo, "HEAD");
  if (head.kind === "err") return notRunBecause(formatGitError(head.error));
  const headCommit = await resolveCommit(repo, "HEAD");
  if (headCommit.kind === "err") return notRunBecause(formatGitError(headCommit.error));
  const baseTree =
    base.value.kind === "commit" ? await readTree(repo, base.value.commit) : ok<TreeFacts>({ paths: [], records: new Map() });
  if (baseTree.kind === "err") return notRunBecause(formatGitError(baseTree.error));
  const changed =
    base.value.kind === "commit" ? await changedBetween(repo, base.value.commit, headCommit.value) : ok<readonly string[]>([]);
  if (changed.kind === "err") return notRunBecause(formatGitError(changed.error));
  const editions = await editionFacts(repo, editionsNeeded(head.value, baseTree.value), headCommit.value);
  if (editions.kind === "err") return notRunBecause(formatGitError(editions.error));
  return {
    kind: "judged",
    findings: sortFindings(judgeWorks({ head: head.value, base: baseTree.value, changed: changed.value, editions: editions.value })),
    works: workFolders(head.value.paths).length,
    from: base.value.kind === "commit" ? `the base ${base.value.commit.slice(0, 12)}` : "no base (the first commit)",
  };
}

async function runCheck(rest: readonly string[], s: Say): Promise<number> {
  const p = parseArgs(rest, CHECK);
  if (p.kind === "err") return usage(s, formatUsageError(p.error, "versions check"));
  if (p.value.kind === "help") return help(s, "check", helpText("versions check", HELP_SUMMARY.check, CHECK));
  const repo = resolve(p.value.options.repo);
  const judged = await checkVersions(repo, p.value.options.base ?? "origin/main");
  if (judged.kind === "not_run") return notRun(s, judged.reason);
  const { findings: found, works, from } = judged;
  if (found.length === 0) {
    s.out(`versions: ${works} ${works === 1 ? "work" : "works"} judged against ${from}: nothing found\n`);
    return 0;
  }
  for (const f of found) s.err(`${formatFinding(f)}\n`);
  s.err(
    `versions: ${found.length} ${found.length === 1 ? "finding" : "findings"} in ${works} ${works === 1 ? "work" : "works"}, against ${from}\n`,
  );
  return 1;
}

function help(s: Say, _command: string, text: string): number {
  s.out(`${text}\n`);
  return 0;
}

/** The ledger of a repository for the commands that need it: tags, ancestry and the ledger of the records given. */
async function ledgerOf(repo: string, works: readonly Release[], earlier?: readonly EarlierEntry[]) {
  const tags = await readTags(repo);
  if (tags.kind === "err") return tags;
  const ancestry = await tagAncestry(repo, tags.value);
  if (ancestry.kind === "err") return ancestry;
  const result = readLedger({
    tags: tags.value,
    works,
    isAncestor: (a, b) => ancestry.value.has(`${a} ${b}`),
    ...(earlier === undefined ? {} : { earlier }),
  });
  return ok({ tags: tags.value, ancestry: ancestry.value, ...result });
}

async function runBump(rest: readonly string[], s: Say, now: () => Date): Promise<number> {
  const p = parseArgs(rest, BUMP, WORK);
  if (p.kind === "err") return usage(s, formatUsageError(p.error, "versions bump"));
  if (p.value.kind === "help") return help(s, "bump", helpText("versions bump", HELP_SUMMARY.bump, BUMP, WORK));
  const o = p.value.options;
  const l = await load(resolve(o.repo), s);
  if (typeof l === "number") return l;
  const w = select(l, p.value.positionals[0] ?? "", s);
  if (typeof w === "number") return w;
  const r = w.release;
  const scheme = schemeOf(r.kind);
  if (scheme === "NoVersion" || r.version === undefined)
    return usage(s, `${r.slug} is a ${r.kind}: a specification has no version, and bump does not raise one`);
  const bad = versionProblems(r);
  if (bad.length > 0) {
    s.err(`${w.file}: versions/scheme-mismatch: ${bad.join("; ")}\n`);
    return 1;
  }
  const today = utcDay(now().getTime() / 1000);
  let next: Release;
  switch (scheme) {
    case "SemVer": {
      let impact: Impact;
      if (o.impact === undefined) return usage(s, `bump of a ${r.kind} needs --impact major, minor, patch or auto`);
      if (o.impact === "auto") {
        const led = await ledgerOf(
          l.repo,
          l.works.map((x) => x.release),
        );
        if (led.kind === "err") return notRun(s, formatGitError(led.error));
        const merged = await tagsMerged(l.repo, "HEAD");
        if (merged.kind === "err") return notRun(s, formatGitError(merged.error));
        const last = lastRelease(led.value.entries, r, merged.value);
        const commits = await commitsSince(l.repo, last?.tag);
        if (commits.kind === "err") return notRun(s, formatGitError(commits.error));
        const inScope = scopeOf(w.folder, workFolders(l.tree.paths), r.exclude ?? [], r.paths ?? []);
        const found = impactOfCommits(commits.value.filter((c) => c.files.some(inScope)));
        if (found === undefined)
          return usage(
            s,
            `no commit since ${last?.tag ?? "the beginning"} that touches ${r.slug} states an impact (a line "Impact: major", "Impact: minor" or "Impact: patch")`,
          );
        impact = found;
      } else impact = o.impact;
      const v = nextSemVer(r.version, impact);
      if (v.kind === "err") return usage(s, v.error);
      next = { ...r, version: v.value };
      break;
    }
    case "CommitDateEdition": {
      const head = await resolveCommit(l.repo, "HEAD");
      if (head.kind === "err") return notRun(s, formatGitError(head.error));
      const secs = await commitSeconds(l.repo, head.value);
      if (secs.kind === "err") return notRun(s, formatGitError(secs.error));
      next = { ...r, version: editionAt(head.value, secs.value) };
      break;
    }
    case "SnapshotDate": {
      if (o.snapshot === undefined || r.snapshot === undefined)
        return usage(s, "bump of data needs --snapshot FILE, the snapshot whose SHA-256 the record carries");
      const file = resolve(o.snapshot);
      if (!existsSync(file)) return notRun(s, `${file} does not exist`);
      const digest = String(await sha256File(file));
      const schemaVersion =
        o.impact === undefined
          ? ok(r.snapshot.schemaVersion)
          : o.impact === "auto"
            ? err("bump of data takes an explicit --impact for its schema, not auto")
            : nextSemVer(r.snapshot.schemaVersion, o.impact);
      if (schemaVersion.kind === "err") return usage(s, schemaVersion.error);
      next = { ...r, version: o.day ?? today, snapshot: { ...r.snapshot, digest, schemaVersion: schemaVersion.value } };
      break;
    }
    case "IntegerRevision": {
      const n = Number(r.version) + 1;
      const given = [o.approvedBy, o.role, o.decision];
      if (given.some((g) => g !== undefined) && given.some((g) => g === undefined))
        return usage(s, "an approval needs --approved-by, --role and --decision together");
      const on = dayOf(o.day ?? today);
      if (on === undefined) return usage(s, `${o.day ?? today} is not a day`);
      const { approval: _previous, ...rest0 } = r;
      next =
        o.approvedBy === undefined || o.role === undefined || o.decision === undefined
          ? { ...rest0, version: String(n) }
          : { ...rest0, version: String(n), approval: { approvedBy: o.approvedBy, role: o.role, on, decision: o.decision } };
      break;
    }
    default:
      return absurd(scheme);
  }
  writeTextFileSync(join(l.repo, w.file), releaseSource(next));
  s.out(`${r.slug}: ${r.version} -> ${next.version} (${w.file})\n`);
  if (scheme === "IntegerRevision" && next.approval === undefined)
    s.out("the new revision has no approval yet: the check finds it until the approval is recorded\n");
  return 0;
}

async function runTag(rest: readonly string[], s: Say): Promise<number> {
  const p = parseArgs(rest, TAG, WORK);
  if (p.kind === "err") return usage(s, formatUsageError(p.error, "versions tag"));
  if (p.value.kind === "help") return help(s, "tag", helpText("versions tag", HELP_SUMMARY.tag, TAG, WORK));
  const o = p.value.options;
  const repo = resolve(o.repo);
  const l = await load(repo, s);
  if (typeof l === "number") return l;
  const w = select(l, p.value.positionals[0] ?? "", s);
  if (typeof w === "number") return w;
  const r = w.release;
  const scheme = schemeOf(r.kind);
  if (scheme === "NoVersion" || r.version === undefined)
    return usage(s, `${r.slug} is a ${r.kind}: a specification has no version, and tag does not release one`);
  const refuse = (m: string): number => {
    s.err(`versions: tag refused: ${m}\n`);
    return 1;
  };
  const bad = versionProblems(r);
  if (bad.length > 0) return refuse(`${w.file}: ${bad.join("; ")}`);
  const dirty = await isDirty(repo, w.file);
  if (dirty.kind === "err") return notRun(s, formatGitError(dirty.error));
  if (dirty.value) return refuse(`${w.file} has a change that is not committed: commit the record, then tag the commit`);
  const led = await ledgerOf(
    repo,
    l.works.map((x) => x.release),
  );
  if (led.kind === "err") return notRun(s, formatGitError(led.error));
  const name = tagNameOf(r.slug, r.version);
  if (led.value.tags.some((t) => t.name === name))
    return refuse(`the tag ${name} exists: a published version is immutable, and a correction is a new version`);
  const head = await resolveCommit(repo, "HEAD");
  if (head.kind === "err") return notRun(s, formatGitError(head.error));
  const last = lastRelease(led.value.entries, r);
  const mine = parseVersion(scheme, r.version);
  const before = last === undefined ? undefined : parseVersion(scheme, last.version);
  if (mine.kind === "ok" && before?.kind === "ok" && last !== undefined) {
    const behind = await isAncestor(repo, last.commit, head.value);
    if (behind.kind === "err") return notRun(s, formatGitError(behind.error));
    const c = compareVersions(mine.value, before.value, () => (behind.value ? 1 : 0));
    if (c === undefined || c <= 0)
      return refuse(`the version ${r.version} is not greater than ${last.version}, the last tag of ${r.slug} (${last.tag})`);
  }
  // the gate of a regulated harness (FR-026)
  const declFile = o.declaration === undefined ? join(repo, "ifccm.declaration.ts") : resolve(repo, o.declaration);
  let declaration: Declaration | undefined;
  if (existsSync(declFile)) {
    const rec = decodeHarnessRecord(readTextFileSync(declFile));
    if (rec.kind === "err") return notRun(s, `${declFile}: ${formatRecordError(rec.error)}`);
    declaration = rec.value.declaration;
  } else if (o.declaration !== undefined) return notRun(s, `${declFile} does not exist`);
  const gate = releaseGate(declaration, o.tier !== undefined && isReleaseTier(o.tier) ? o.tier : undefined);
  if (gate.kind === "refused") return refuse(gate.reason);
  const tree = await gitText(repo, ["rev-parse", "HEAD^{tree}"]);
  if (tree.kind === "err") return notRun(s, formatGitError(tree.error));
  const message = `${r.slug} ${r.version}\n\ncommit: ${head.value}\ntree: ${tree.value.trim()}\nscheme: ${scheme}\ntier: ${gate.tier ?? "not judged"}\n`;
  const signing = await signingConfigured(repo);
  if (signing.kind === "err") return notRun(s, formatGitError(signing.error));
  const made = await createTag(repo, name, message, signing.value);
  if (made.kind === "err") return notRun(s, `the tag ${name} was not made: ${formatGitError(made.error)}`);
  s.out(
    `${name}: tagged ${head.value.slice(0, 12)} (${signing.value ? "signed" : "not signed: Git signing is not configured (user.signingkey or tag.gpgSign), so the tag is annotated only"})\n`,
  );
  return 0;
}

async function runNotes(rest: readonly string[], s: Say): Promise<number> {
  const p = parseArgs(rest, NOTES, WORK);
  if (p.kind === "err") return usage(s, formatUsageError(p.error, "versions notes"));
  if (p.value.kind === "help") return help(s, "notes", helpText("versions notes", HELP_SUMMARY.notes, NOTES, WORK));
  const o = p.value.options;
  const l = await load(resolve(o.repo), s);
  if (typeof l === "number") return l;
  const w = select(l, p.value.positionals[0] ?? "", s);
  if (typeof w === "number") return w;
  const r = w.release;
  if (schemeOf(r.kind) === "NoVersion")
    return usage(s, `${r.slug} is a ${r.kind}: a specification has no version, so it has no release notes`);
  let from = o.from;
  if (from === undefined) {
    const led = await ledgerOf(
      l.repo,
      l.works.map((x) => x.release),
    );
    if (led.kind === "err") return notRun(s, formatGitError(led.error));
    const merged = await tagsMerged(l.repo, "HEAD");
    if (merged.kind === "err") return notRun(s, formatGitError(merged.error));
    from = lastRelease(led.value.entries, r, merged.value)?.tag;
  } else {
    const known = await resolveCommit(l.repo, from);
    if (known.kind === "err") return usage(s, `--from ${from} is not a tag or a commit of this repository`);
  }
  const commits = await commitsSince(l.repo, from);
  if (commits.kind === "err") return notRun(s, formatGitError(commits.error));
  const inScope = scopeOf(w.folder, workFolders(l.tree.paths), r.exclude ?? [], r.paths ?? []);
  s.out(notesOf({ slug: r.slug, title: r.title, version: r.version, from, commits: commits.value.filter((c) => c.files.some(inScope)) }));
  return 0;
}

async function runCite(rest: readonly string[], s: Say): Promise<number> {
  const p = parseArgs(rest, CITE, WORK);
  if (p.kind === "err") return usage(s, formatUsageError(p.error, "versions cite"));
  if (p.value.kind === "help") return help(s, "cite", helpText("versions cite", HELP_SUMMARY.cite, CITE, WORK));
  const o = p.value.options;
  const l = await load(resolve(o.repo), s);
  if (typeof l === "number") return l;
  const w = select(l, p.value.positionals[0] ?? "", s);
  if (typeof w === "number") return w;
  const r = w.release;
  if (schemeOf(r.kind) === "NoVersion" || r.version === undefined)
    return usage(s, `${r.slug} is a ${r.kind}: a specification has no version, and cite does not cite one`);
  const tags = await readTags(l.repo);
  if (tags.kind === "err") return notRun(s, formatGitError(tags.error));
  const tag = tags.value.find((t) => t.name === tagNameOf(r.slug, r.version ?? ""));
  let seconds: number;
  if (tag === undefined) {
    const head = await commitSeconds(l.repo, "HEAD");
    if (head.kind === "err") return notRun(s, formatGitError(head.error));
    seconds = head.value;
  } else seconds = tag.seconds;
  const cff = citationOf(r, utcDay(seconds));
  if (cff === undefined) return usage(s, `${r.slug} has no version to cite`);
  const path = join(l.repo, w.folder, CITATION_FILE);
  const shown = w.folder === "" ? CITATION_FILE : `${w.folder}/${CITATION_FILE}`;
  if (o.check) {
    const current = existsSync(path) ? readTextFileSync(path) : undefined;
    if (current === cff) {
      s.out(`${shown}: is what the record makes\n`);
      return 0;
    }
    s.err(`${shown}: ${current === undefined ? "does not exist" : "differs from what the record makes"}; run versions cite ${r.slug}\n`);
    return 1;
  }
  writeTextFileSync(path, cff);
  s.out(`${shown}: written for ${r.slug} ${r.version}\n`);
  return 0;
}

async function runLedger(rest: readonly string[], s: Say): Promise<number> {
  const WORKS: readonly Operand[] = [{ name: "WORK", help: "Only this work, by its slug or its folder.", arity: "optional" }];
  const p = parseArgs(rest, LEDGER, WORKS);
  if (p.kind === "err") return usage(s, formatUsageError(p.error, "versions ledger"));
  if (p.value.kind === "help") return help(s, "ledger", helpText("versions ledger", HELP_SUMMARY.ledger, LEDGER, WORKS));
  const o = p.value.options;
  const l = await load(resolve(o.repo), s);
  if (typeof l === "number") return l;
  let only: string | undefined;
  const name = p.value.positionals[0];
  if (name !== undefined) {
    const w = select(l, name, s);
    if (typeof w === "number") return w;
    only = w.release.slug;
  }
  let earlier: readonly EarlierEntry[] | undefined;
  if (o.against !== undefined) {
    const file = resolve(o.against);
    if (!existsSync(file)) return notRun(s, `${file} does not exist`);
    const e = readEarlier(readTextFileSync(file));
    if (e.kind === "err") return usage(s, `${file} is not a ledger written by --json: ${e.error}`);
    earlier = only === undefined ? e.value : e.value.filter((x) => x.work === only);
  }
  const led = await ledgerOf(
    l.repo,
    l.works.map((x) => x.release),
    earlier,
  );
  if (led.kind === "err") return notRun(s, formatGitError(led.error));
  const entries = only === undefined ? led.value.entries : led.value.entries.filter((e) => e.work === only);
  const findings = sortFindings([
    ...(only === undefined ? l.invalid : []),
    ...led.value.findings.filter((f) => only === undefined || f.work === only),
  ]);
  s.out(o.json ? ledgerJson(entries) : ledgerText(entries));
  for (const f of findings) s.err(`${formatFinding(f)}\n`);
  return findings.length === 0 ? 0 : 1;
}

/** Run the command: the exit status (0, 1 findings, 2 usage, 3 the environment cannot do it). */
export async function run(argv: readonly string[], deps: Deps = {}): Promise<number> {
  const s: Say = {
    out: deps.out ?? ((t: string): void => void stdio.stdout.writeSync(t)),
    err: deps.err ?? ((t: string): void => void stdio.stderr.writeSync(t)),
  };
  const now = deps.now ?? ((): Date => new Date());
  const [command, ...rest] = argv;
  if (command === undefined) return usage(s, "no command");
  if (command === "--help" || command === "-h" || command === "help") {
    s.out(
      `versions: how works are versioned (commons 0026-works-versioning)\n\n${COMMANDS.map((c) => `  ${c.padEnd(7)}${HELP_SUMMARY[c]}`).join("\n")}\n\nversions COMMAND --help says the options of a command.\n`,
    );
    return 0;
  }
  switch (command) {
    case "check":
      return runCheck(rest, s);
    case "bump":
      return runBump(rest, s, now);
    case "tag":
      return runTag(rest, s);
    case "notes":
      return runNotes(rest, s);
    case "cite":
      return runCite(rest, s);
    case "ledger":
      return runLedger(rest, s);
    default: {
      const near = suggest(command, COMMANDS);
      return usage(s, `unknown command ${command}${near === undefined ? "" : ` (did you mean ${near}?)`}`);
    }
  }
}

if (import.meta.main) process.exitCode = await run(process.argv.slice(2), {});
