/**
 * The `versions` tool on real Git (commons 0026-works-versioning): real repositories in temporary folders with real commits, real branches, real annotated tags (signed with an SSH key that the real
 * `ssh-keygen` makes where it is installed, else that case is skipped with its reason), and the command itself, in this process and as a program on the runtime this test runs on (Bun, or Node 26 under
 * `node --test`). Nothing of the tool is faked; the Git host is not involved, as the tool reads only Git.
 *
 * @module
 */
import { type Literal, tsLiteral } from "../kernel/ts-literal.ts";
import { sha256File, makeTempDir, mkdirSync, readTextFileSync, remove, withTempDir, writeTextFileSync } from "../runtime/fs.ts";
import { dirname, fromFileUrl, join, resolve } from "../runtime/path.ts";
import { execPath, run as spawn } from "../runtime/proc.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../runtime/test.ts";
import { run as versions } from "../mizan/versions.ts";
import { decodeReleaseSource } from "../mizan/versions/record.ts";
import { needsGit, needsSshKeygen, sshSigning } from "./quality-fixtures.ts";

const HERE = dirname(fromFileUrl(import.meta.url));
const VERSIONS = resolve(HERE, "..", "mizan", "versions.ts");
const ROOT = resolve(HERE, "..", "..", "..");

// ------------------------------------------------------------------------------------------------------------------------------- fixtures

/** git in `repo`, failing the test where it fails; the dates are those of `date` (an ISO time) where given. */
async function git(repo: string, args: readonly string[], date?: string): Promise<string> {
  const r = await spawn(["git", "-C", repo, ...args], {
    env: { GIT_TERMINAL_PROMPT: "0", ...(date === undefined ? {} : { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }) },
  });
  assert(r.success, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

/** A repository with a committer and no signing, whatever the machine's own configuration says. */
async function newRepo(dir: string): Promise<string> {
  await git(dir, ["init", "-q", "-b", "main"]);
  for (const [k, v] of [
    ["user.name", "ci"],
    ["user.email", "ci@example.com"],
    ["commit.gpgsign", "false"],
    ["tag.gpgSign", "false"],
    ["user.signingkey", ""],
    ["core.autocrlf", "false"],
  ] as const)
    await git(dir, ["config", k, v]);
  return dir;
}

/** A commit of `files` (written first, `null` deletes) with `message`, committed at `at`; its object name. */
async function commit(repo: string, message: string, at: string, files: Readonly<Record<string, string | null>>): Promise<string> {
  for (const [name, text] of Object.entries(files)) {
    if (text === null) await remove(join(repo, name));
    else {
      mkdirSync(dirname(join(repo, name)), { recursive: true });
      writeTextFileSync(join(repo, name), text);
    }
  }
  await git(repo, ["add", "-A"]);
  await git(repo, ["commit", "-q", "--allow-empty", "-m", message], at);
  return git(repo, ["rev-parse", "HEAD"]);
}

const BASE = { slug: "lib", kind: "Library", title: "A library", authors: [{ name: "A. Person" }], version: "1.0.0" };

/** The text of a record file written by hand, as a fixture (the tool's own writes are read back by its decoder). */
function record(over: Readonly<Record<string, Literal | undefined>> = {}): string {
  return `export const release = ${tsLiteral<Literal>({ ...BASE, ...over })};\n`;
}

type Out = { readonly code: number; readonly out: string; readonly err: string };

/** The command run in this process: its exit status and what it wrote. */
async function v(repo: string, ...args: readonly string[]): Promise<Out> {
  let out = "";
  let err = "";
  const code = await versions([...args, "--repo", repo], {
    out: (t) => void (out += t),
    err: (t) => void (err += t),
    now: () => new Date("2026-12-01T10:00:00Z"),
  });
  return { code, out, err };
}

const DAY = (n: number): string => `2026-11-${String(n).padStart(2, "0")}T12:00:00Z`;

/** A repository with a library at 1.0.0 on `main` and a feature branch checked out. */
async function libraryRepo(dir: string, over: Readonly<Record<string, Literal | undefined>> = {}): Promise<string> {
  const repo = await newRepo(dir);
  await commit(repo, "Start\n\nRefs #10", DAY(10), {
    "lib/release.ts": record(over),
    "lib/a.ts": "1\n",
    "lib/docs/g.md": "1\n",
    "other/o.ts": "1\n",
  });
  return repo;
}

// -------------------------------------------------------------------------------------------------------------------------------- check

proves(
  ["0026-works-versioning FR-022", "0026-works-versioning FR-009", "0026-works-versioning FR-010", "0026-works-versioning FR-031"],
  "check against the merge base: a change of a work's files with no version growth is versions/not-grown (exit 1), a change outside them or under exclude is not, a bump makes it pass, and a plain Git repository is enough",
  async () => {
    await withTempDir(async (dir) => {
      const repo = await libraryRepo(dir, { exclude: ["docs"] });
      await git(repo, ["checkout", "-q", "-b", "feature"]);
      await commit(repo, "Docs\n\nRefs #10", DAY(11), { "lib/docs/g.md": "2\n" });
      assertEquals((await v(repo, "check", "--base", "main")).code, 0, "a path the record excludes");
      await commit(repo, "Other\n\nRefs #10", DAY(12), { "other/o.ts": "2\n" });
      const clean = await v(repo, "check", "--base", "main");
      assertEquals(clean.code, 0);
      assertStringIncludes(clean.out, "1 work judged");
      await commit(repo, "Change\n\nRefs #10", DAY(13), { "lib/a.ts": "2\n" });
      const found = await v(repo, "check", "--base", "main");
      assertEquals(found.code, 1);
      assertStringIncludes(found.err, "lib/release.ts: versions/not-grown");
      assertStringIncludes(found.err, "lib/a.ts");
      const bumped = await v(repo, "bump", "lib", "--impact", "minor");
      assertEquals([bumped.code, decodeReleaseSource(readTextFileSync(join(repo, "lib", "release.ts"))).kind], [0, "ok"]);
      await commit(repo, "Bump\n\nRefs #10", DAY(14), { "lib/release.ts": readTextFileSync(join(repo, "lib", "release.ts")) });
      assertEquals((await v(repo, "check", "--base", "main")).code, 0, "the version grew");
      // the head is the base's own revision: its first parent is the base (a push to the branch itself)
      await git(repo, ["checkout", "-q", "main"]);
      await git(repo, ["merge", "-q", "--ff-only", "feature"]);
      assertEquals((await v(repo, "check", "--base", "main")).code, 0, "main as the base of itself: the head's first parent");
      await commit(repo, "Unbumped\n\nRefs #10", DAY(15), { "lib/a.ts": "3\n" });
      assertEquals((await v(repo, "check", "--base", "main")).code, 1, "a push that changed the work and did not bump it");
    });
  },
  needsGit,
);

proves(
  ["0026-works-versioning FR-031"],
  "a directory that is no repository, a base that is not there and a shallow clone with no base are not_run with their reason (exit 3), a usage error is exit 2, and nothing is written by a run that did not run",
  async () => {
    await withTempDir(async (dir) => {
      const plain = join(dir, "plain");
      mkdirSync(plain, { recursive: true });
      writeTextFileSync(join(plain, "release.ts"), record());
      const none = await v(plain, "check");
      assertEquals(none.code, 3);
      assertStringIncludes(none.err, "not_run");
      const bump = await v(plain, "bump", "lib", "--impact", "major");
      assertEquals(bump.code, 3);
      assertEquals(readTextFileSync(join(plain, "release.ts")), record(), "a run that was not run wrote nothing");
    });
    await withTempDir(async (dir) => {
      const repo = join(dir, "origin");
      mkdirSync(repo, { recursive: true });
      await libraryRepo(repo);
      await commit(repo, "Two\n\nRefs #10", DAY(11), { "other/o.ts": "2\n" });
      await commit(repo, "Three\n\nRefs #10", DAY(12), { "other/o.ts": "3\n" });
      const missing = await v(repo, "check", "--base", "no-such-branch");
      assertEquals(missing.code, 3);
      assertStringIncludes(missing.err, "not_run");
      const clone = join(dir, "clone");
      const r = await spawn(["git", "clone", "-q", "--depth", "1", `file://${repo}`, clone], { env: { GIT_TERMINAL_PROMPT: "0" } });
      assert(r.success, r.stderr);
      await git(clone, ["config", "user.name", "ci"]);
      const shallow = await v(clone, "check", "--base", "origin/main");
      assertEquals(shallow.code, 3, "the base is the head and its parent is not in a shallow clone");
      assertStringIncludes(shallow.err, "not_run");
      assertStringIncludes(shallow.err, "shallow");
      // usage
      assertEquals((await v(repo, "frobnicate")).code, 2);
      assertEquals((await v(repo, "check", "--nope")).code, 2);
      assertEquals((await v(repo, "bump", "no-such-work", "--impact", "major")).code, 2);
      assertEquals((await v(repo, "bump", "lib")).code, 2, "a bump of a library needs an impact");
      assertEquals((await v(repo, "bump", "lib", "--impact", "huge")).code, 2);
    });
  },
  needsGit,
);

// --------------------------------------------------------------------------------------------------------------------------------- bump

proves(
  ["0026-works-versioning FR-021", "0026-works-versioning FR-022"],
  "bump writes the next version by the impact: auto takes the greatest Impact line of the commits since the last tag that touch the work's files, exits 2 with no such commit and writes nothing, and the check then finds nothing",
  async () => {
    await withTempDir(async (dir) => {
      const repo = await libraryRepo(dir, { version: "0.4.0" });
      await git(repo, ["tag", "-a", "-m", "lib 0.4.0", "lib-v0.4.0"]);
      await commit(repo, "Add a thing\n\nCloses #4\nImpact: minor", DAY(11), { "lib/a.ts": "2\n" });
      await commit(repo, "Break another thing elsewhere\n\nCloses #5\nImpact: major", DAY(12), { "other/o.ts": "2\n" });
      await commit(repo, "Fix a thing\n\nCloses #6\nImpact: patch", DAY(13), { "lib/a.ts": "3\n" });
      const bumped = await v(repo, "bump", "lib", "--impact", "auto");
      assertEquals(bumped.code, 0, bumped.err);
      assertStringIncludes(bumped.out, "0.4.0 -> 0.5.0");
      const text = readTextFileSync(join(repo, "lib", "release.ts"));
      const decoded = decodeReleaseSource(text);
      assert(
        decoded.kind === "ok" && decoded.value.version === "0.5.0",
        "the Impact line of a commit that touches no file of the work is not read",
      );
      await commit(repo, "Bump\n\nRefs #10", DAY(14), { "lib/release.ts": text });
      assertEquals((await v(repo, "check", "--base", "lib-v0.4.0")).code, 0);
      // no commit that states an impact since the last tag: exit 2 and no write
      await git(repo, ["tag", "-a", "-m", "lib 0.5.0", "lib-v0.5.0"]);
      await commit(repo, "Tidy\n\nRefs #10", DAY(15), { "lib/a.ts": "4\n" });
      const none = await v(repo, "bump", "lib", "--impact", "auto");
      assertEquals(none.code, 2);
      assertEquals(readTextFileSync(join(repo, "lib", "release.ts")), text, "nothing was written");
      for (const [impact, next] of [
        ["major", "1.0.0"],
        ["minor", "0.6.0"],
        ["patch", "0.5.1"],
      ] as const) {
        const r = await v(repo, "bump", "lib", "--impact", impact);
        assertStringIncludes(r.out, `0.5.0 -> ${next}`);
        writeTextFileSync(join(repo, "lib", "release.ts"), text);
      }
    });
  },
  needsGit,
);

proves(
  [
    "0026-works-versioning FR-011",
    "0026-works-versioning FR-012",
    "0026-works-versioning FR-013",
    "0026-works-versioning FR-014",
    "0026-works-versioning FR-031",
  ],
  "bump by the kind: an edition takes the commit's UTC day and its first eight characters, data takes the snapshot's SHA-256 and a later day, a revision is one more with no approval until it is recorded, and a specification is refused with exit 2",
  async () => {
    await withTempDir(async (dir) => {
      const repo = await newRepo(dir);
      // the committer date 2026-11-17 23:30 in New York is 2026-11-18 in UTC: the edition says the UTC day
      const first = await commit(repo, "Start\n\nRefs #10", "2026-11-10T08:00:00Z", { "x.txt": "1\n" });
      const edition = `2026.11.10-${first.slice(0, 8)}`;
      const second = await commit(repo, "Book\n\nRefs #10", "2026-11-17T23:30:00-05:00", {
        "book/release.ts": record({ slug: "book", kind: "Prose", version: edition }),
        "book/ch1.md": "1\n",
        "data/release.ts": record({
          slug: "data",
          kind: "Data",
          version: "2026-11-01",
          snapshot: { digest: "0".repeat(64), schemaVersion: "1.0.0" },
        }),
        "data/snap.csv": "a,b\n1,2\n",
        "pol/release.ts": record({
          slug: "pol",
          kind: "ControlledDocument",
          version: "6",
          approval: { approvedBy: "A. Person", role: "Lead", on: "2026-10-01", decision: "D-1" },
        }),
        "pol/policy.md": "1\n",
        "spec/release.ts": record({ slug: "spec", kind: "Specification", version: undefined }),
        "spec/spec.md": "1\n",
      });
      const book = await v(repo, "bump", "book");
      assertEquals(book.code, 0, book.err);
      assertStringIncludes(readTextFileSync(join(repo, "book", "release.ts")), `2026.11.18-${second.slice(0, 8)}`);
      const snapshot = join(dir, "data", "snap.csv");
      const data = await v(repo, "bump", "data", "--snapshot", snapshot, "--day", "2026-12-01", "--impact", "minor");
      assertEquals(data.code, 0, data.err);
      const d = decodeReleaseSource(readTextFileSync(join(repo, "data", "release.ts")));
      assert(d.kind === "ok" && d.value.version === "2026-12-01" && d.value.snapshot?.schemaVersion === "1.1.0");
      assertEquals(d.value.snapshot?.digest, String(await sha256File(snapshot)));
      assertEquals((await v(repo, "bump", "data")).code, 2, "data needs its snapshot");
      const pol = await v(repo, "bump", "pol");
      assertEquals(pol.code, 0, pol.err);
      const p = decodeReleaseSource(readTextFileSync(join(repo, "pol", "release.ts")));
      assert(p.kind === "ok" && p.value.version === "7" && p.value.approval === undefined, "the new revision has no approval yet");
      await git(repo, ["add", "-A"]);
      await git(repo, ["commit", "-q", "-m", "Bumps"], "2026-12-01T09:00:00Z");
      const found = await v(repo, "check", "--base", second);
      assertEquals(found.code, 1);
      assertStringIncludes(found.err, "versions/approval-missing");
      const approved = await v(
        repo,
        "bump",
        "pol",
        "--approved-by",
        "B. Person",
        "--role",
        "Quality lead",
        "--decision",
        "D-9",
        "--day",
        "2026-12-02",
      );
      assertEquals(approved.code, 0, approved.err);
      const a = decodeReleaseSource(readTextFileSync(join(repo, "pol", "release.ts")));
      assert(
        a.kind === "ok" && a.value.version === "8" && a.value.approval?.approvedBy === "B. Person" && a.value.approval.on === "2026-12-02",
      );
      assertEquals(
        (await v(repo, "bump", "pol", "--approved-by", "B. Person")).code,
        2,
        "an approval is the person, the role and the Decision together",
      );
      // a specification has no version: bump, tag, cite and notes refuse it
      const before = readTextFileSync(join(repo, "spec", "release.ts"));
      for (const cmd of [
        ["bump", "spec", "--impact", "major"],
        ["tag", "spec"],
        ["cite", "spec"],
        ["notes", "spec"],
      ])
        assertEquals((await v(repo, ...cmd)).code, 2, cmd.join(" "));
      assertEquals(readTextFileSync(join(repo, "spec", "release.ts")), before);
      // a work whose files changed, and whose record is the same, is found even for a specification's neighbour
      assertEquals((await v(repo, "check", "--base", first)).code, 1);
    });
  },
  needsGit,
);

// ---------------------------------------------------------------------------------------------------------------------------------- tag

proves(
  ["0026-works-versioning FR-018", "0026-works-versioning FR-017"],
  "tag creates the annotated tag <slug>-v<version> at the head with the commit, tree, scheme and tier in its message, says where it is not signed, and refuses a tag that exists, an uncommitted record and a version not greater than the last tag",
  async () => {
    await withTempDir(async (dir) => {
      const repo = await libraryRepo(dir, { version: "0.5.0" });
      const head = await git(repo, ["rev-parse", "HEAD"]);
      const tree = await git(repo, ["rev-parse", "HEAD^{tree}"]);
      const made = await v(repo, "tag", "lib");
      assertEquals(made.code, 0, made.err);
      assertStringIncludes(made.out, "lib-v0.5.0: tagged");
      assertStringIncludes(made.out, "not signed");
      assertEquals(await git(repo, ["cat-file", "-t", "lib-v0.5.0"]), "tag", "an annotated tag");
      assertEquals(await git(repo, ["rev-parse", "lib-v0.5.0^{commit}"]), head);
      const body = await git(repo, ["tag", "-l", "--format=%(contents)", "lib-v0.5.0"]);
      for (const line of [`commit: ${head}`, `tree: ${tree}`, "scheme: SemVer", "tier: not judged"]) assertStringIncludes(body, line);
      // a tag that exists, a version that is not greater, an uncommitted record
      const again = await v(repo, "tag", "lib");
      assertEquals(again.code, 1);
      assertStringIncludes(again.err, "exists");
      await commit(repo, "Lower\n\nRefs #10", DAY(12), { "lib/release.ts": record({ version: "0.4.0" }) });
      const notGreater = await v(repo, "tag", "lib");
      assertEquals(notGreater.code, 1);
      assertStringIncludes(notGreater.err, "not greater");
      writeTextFileSync(join(repo, "lib", "release.ts"), record({ version: "0.6.0" }));
      const dirty = await v(repo, "tag", "lib");
      assertEquals(dirty.code, 1);
      assertStringIncludes(dirty.err, "not committed");
      assertEquals(await git(repo, ["tag", "-l", "lib-v*"]), "lib-v0.5.0", "no tag was made");
      await commit(repo, "Raise\n\nRefs #10", DAY(13), { "lib/release.ts": record({ version: "0.6.0" }) });
      assertEquals((await v(repo, "tag", "lib")).code, 0);
      // the tag a lightweight tag of the same name would have made is refused as well
      assertEquals(await git(repo, ["tag", "-l", "lib-v*"]), "lib-v0.5.0\nlib-v0.6.0");
    });
  },
  needsGit,
);

proves(
  ["0026-works-versioning FR-018", "0026-works-versioning FR-019"],
  "where Git is set to sign with an SSH key, tag makes a signed annotated tag that git verifies, and the ledger says it is signed",
  async () => {
    await withTempDir(async (dir) => {
      mkdirSync(join(dir, "r"), { recursive: true });
      const repo = await libraryRepo(join(dir, "r"), { version: "2.0.0" });
      const keys = join(dir, "keys");
      mkdirSync(keys, { recursive: true });
      const allowed = await sshSigning(repo, keys);
      await git(repo, ["config", "gpg.ssh.allowedSignersFile", allowed]);
      const made = await v(repo, "tag", "lib");
      assertEquals(made.code, 0, made.err);
      assertStringIncludes(made.out, "(signed)");
      const verified = await spawn(["git", "-C", repo, "tag", "-v", "lib-v2.0.0"], { env: { GIT_TERMINAL_PROMPT: "0" } });
      assert(verified.success, `git tag -v: ${verified.stderr}`);
      const ledger = await v(repo, "ledger", "--json");
      assertStringIncludes(ledger.out, '"signed": true');
      assertStringIncludes((await v(repo, "ledger")).out, "\tsigned\t");
    });
  },
  needsSshKeygen,
);

proves(
  ["0026-works-versioning FR-026"],
  "a regulated harness releases only on the tier it declares: tag refuses with no releaseTier, with no tier judged and below the declared tier, makes no tag, and records the tier on a release that passes",
  async () => {
    await withTempDir(async (dir) => {
      const repo = await libraryRepo(dir, { version: "1.0.0" });
      const declare = async (extra: string): Promise<void> => {
        await commit(repo, `Declare ${extra}\n\nRefs #10`, DAY(11), {
          "ifccm.declaration.ts": `export const declaration = { regulatedDomains: ["DeviceQuality"], productionDeclaredOn: "2027-01-01"${extra} };\n`,
        });
      };
      await declare("");
      const none = await v(repo, "tag", "lib", "--tier", "Tier2");
      assertEquals(none.code, 1);
      assertStringIncludes(none.err, "no releaseTier");
      assertEquals(await git(repo, ["tag", "-l"]), "", "no tag");
      await declare(', "releaseTier": "Tier2"');
      const unjudged = await v(repo, "tag", "lib");
      assertEquals(unjudged.code, 1);
      assertStringIncludes(unjudged.err, "no tier was judged");
      const below = await v(repo, "tag", "lib", "--tier", "Tier1");
      assertEquals(below.code, 1);
      assertStringIncludes(below.err, "releases only on the tier it declares");
      assertEquals(await git(repo, ["tag", "-l"]), "");
      const ok = await v(repo, "tag", "lib", "--tier", "Tier2");
      assertEquals(ok.code, 0, ok.err);
      assertStringIncludes(await git(repo, ["tag", "-l", "--format=%(contents)", "lib-v1.0.0"]), "tier: Tier2");
      assertEquals((await v(repo, "tag", "lib", "--tier", "Tier9")).code, 2);
    });
  },
  needsGit,
);

// -------------------------------------------------------------------------------------------------------------------------------- ledger

proves(
  ["0026-works-versioning FR-019", "0026-works-versioning FR-020", "0026-works-versioning FR-028", "0026-works-versioning FR-017"],
  "the ledger from real tags is deterministic, and against an earlier ledger a tag that moved is versions/tag-moved, a tag that is gone is versions/tag-removed unless the record retires the version, and a tag not greater than one of its own history is versions/ledger-order",
  async () => {
    await withTempDir(async (dir) => {
      const repo = await libraryRepo(dir, { version: "1.0.0" });
      await git(repo, ["tag", "-a", "-m", "lib 1.0.0", "lib-v1.0.0"]);
      const second = await commit(repo, "Two\n\nRefs #10", DAY(11), { "lib/release.ts": record({ version: "1.1.0" }), "lib/a.ts": "2\n" });
      await git(repo, ["tag", "-a", "-m", "lib 1.1.0", "lib-v1.1.0"]);
      await commit(repo, "Three\n\nRefs #10", DAY(12), { "lib/release.ts": record({ version: "1.10.0" }), "lib/a.ts": "3\n" });
      await git(repo, ["tag", "-a", "-m", "lib 1.10.0", "lib-v1.10.0"]);
      const one = await v(repo, "ledger", "--json");
      const two = await v(repo, "ledger", "--json");
      assertEquals([one.code, two.code], [0, 0]);
      assertEquals(one.out, two.out, "the same document twice");
      const doc: unknown = JSON.parse(one.out);
      assert(typeof doc === "object" && doc !== null && "releases" in doc && Array.isArray(doc.releases));
      assertEquals(
        doc.releases.map((r: { version: string }) => r.version),
        ["1.0.0", "1.1.0", "1.10.0"],
        "1.1.0 before 1.10.0",
      );
      assertEquals(new Set(doc.releases.map((r: { tag: string }) => r.tag)).size, 3, "each tag once");
      assertStringIncludes(one.out, `"commit": "${second}"`);
      assertStringIncludes(
        (await v(repo, "ledger", "lib")).out,
        `lib\t1.1.0\t${second}\t${await git(repo, ["rev-parse", `${second}^{tree}`])}\tunsigned\t2026-11-11`,
      );
      assertEquals((await v(repo, "ledger", "nothing")).code, 2);
      // against an earlier ledger
      const kept = join(dir, "earlier.json");
      writeTextFileSync(kept, one.out);
      assertEquals((await v(repo, "ledger", "--against", kept)).code, 0, "nothing moved");
      await git(repo, ["tag", "-d", "lib-v1.1.0"]);
      const gone = await v(repo, "ledger", "--against", kept);
      assertEquals(gone.code, 1);
      assertStringIncludes(gone.err, "versions/tag-removed");
      await commit(repo, "Retire\n\nRefs #10", DAY(13), {
        "lib/release.ts": record({ version: "1.10.0", retired: [{ version: "1.1.0", on: "2026-11-13", replacedBy: "1.10.0" }] }),
      });
      assertEquals((await v(repo, "ledger", "--against", kept)).code, 0, "retired names it");
      await git(repo, ["tag", "-a", "-m", "again", "lib-v1.1.0", second]);
      await git(repo, ["tag", "-f", "-a", "-m", "moved", "lib-v1.0.0", "HEAD"]);
      const moved = await v(repo, "ledger", "--against", kept);
      assertEquals(moved.code, 1);
      assertStringIncludes(moved.err, "versions/tag-moved");
      assertStringIncludes(moved.err, "lib-v1.0.0");
      // a lower version on a later commit
      await git(repo, ["tag", "-a", "-m", "wrong", "lib-v1.5.0", "lib-v1.0.0^{commit}"]);
      await git(repo, ["tag", "-a", "-m", "wrong", "lib-v1.4.0", "HEAD"]);
      const order = await v(repo, "ledger");
      assertEquals(order.code, 1);
      assertStringIncludes(order.err, "versions/ledger-order");
      assertStringIncludes(order.err, "lib-v1.4.0");
      assertEquals((await v(repo, "ledger", "--against", join(dir, "absent.json"))).code, 3);
    });
  },
  needsGit,
);

// --------------------------------------------------------------------------------------------------------------------------- notes, cite

proves(
  ["0026-works-versioning FR-023"],
  "notes from real commits: each Closes line of the commits that touch the work since its last tag, once, under its impact, in order of issue number, the same text twice",
  async () => {
    await withTempDir(async (dir) => {
      const repo = await libraryRepo(dir, { version: "1.0.0" });
      await git(repo, ["tag", "-a", "-m", "lib 1.0.0", "lib-v1.0.0"]);
      await commit(repo, "Fix the edge\n\nCloses #12\nImpact: patch", DAY(11), { "lib/a.ts": "2\n" });
      await commit(repo, "Add the surface\n\nCloses #7\nImpact: minor", DAY(12), { "lib/b.ts": "1\n" });
      await commit(repo, "Elsewhere\n\nCloses #99\nImpact: major", DAY(13), { "other/o.ts": "2\n" });
      await commit(repo, "Work in progress\n\nRefs #3", DAY(14), { "lib/a.ts": "3\n" });
      await commit(repo, "Remove the old surface\n\nCloses #3\nCloses #9\nImpact: major", DAY(15), { "lib/b.ts": null });
      const first = await v(repo, "notes", "lib");
      assertEquals(first.code, 0, first.err);
      const headings = first.out.split("\n").filter((l) => l.startsWith("## "));
      assertEquals(headings, ["## Major", "## Minor", "## Patch"]);
      const items = first.out.split("\n").filter((l) => l.startsWith("- "));
      assertEquals(
        items.map((l) => l.split(" ")[1]),
        ["#3", "#9", "#7", "#12"],
        "by impact, then by issue number",
      );
      assert(!first.out.includes("#99"), "a commit that touches no file of the work is not in its notes");
      assertStringIncludes(first.out, "since lib-v1.0.0");
      assertStringIncludes(first.out, "1 commit closed no capability.");
      assertEquals((await v(repo, "notes", "lib")).out, first.out, "deterministic");
      const all = await v(repo, "notes", "lib", "--from", "main~3");
      assertEquals(all.code, 0);
      assertEquals((await v(repo, "notes", "lib", "--from", "no-such-tag")).code, 2);
    });
  },
  needsGit,
);

proves(
  ["0026-works-versioning FR-024", "0026-works-versioning FR-029"],
  "cite writes CITATION.cff from the record with the day of the release's commit, --check exits 1 where the file is not what the record makes, and a DOI is written only where the record carries one",
  async () => {
    await withTempDir(async (dir) => {
      const repo = await libraryRepo(dir, { version: "1.0.0", repository: "https://example.org/lib.git" });
      await git(repo, ["tag", "-a", "-m", "lib 1.0.0", "lib-v1.0.0"]);
      await commit(repo, "Later\n\nRefs #10", DAY(20), { "lib/a.ts": "2\n" });
      assertEquals((await v(repo, "cite", "lib", "--check")).code, 1, "no file yet");
      const made = await v(repo, "cite", "lib");
      assertEquals(made.code, 0, made.err);
      const cff = readTextFileSync(join(repo, "lib", "CITATION.cff"));
      assertStringIncludes(cff, "cff-version: 1.2.0");
      assertStringIncludes(cff, "date-released: 2026-11-10", "the day of the tagged commit, not of the head or the clock");
      assert(!cff.includes("identifiers"), "no DOI where the record carries none");
      assertEquals((await v(repo, "cite", "lib", "--check")).code, 0);
      // the citation is not the work's file: a change to it needs no bump
      await commit(repo, "Cite\n\nRefs #10", DAY(21), { "lib/CITATION.cff": cff });
      await git(repo, ["checkout", "-q", "-b", "side", "HEAD~1"]);
      await git(repo, ["checkout", "-q", "main"]);
      assertEquals((await v(repo, "check", "--base", "HEAD~1")).code, 0);
      // a record with an identifier
      await commit(repo, "Identify\n\nRefs #10", DAY(22), {
        "lib/release.ts": record({ version: "1.0.0", repository: "https://example.org/lib.git", identifier: "10.5555/lib.1" }),
      });
      assertEquals((await v(repo, "cite", "lib", "--check")).code, 1, "the file is no longer what the record makes");
      assertEquals((await v(repo, "cite", "lib")).code, 0);
      assertStringIncludes(readTextFileSync(join(repo, "lib", "CITATION.cff")), 'value: "10.5555/lib.1"');
    });
  },
  needsGit,
);

// ----------------------------------------------------------------------------------------------------------------------------- as a program

proves(
  ["0026-works-versioning FR-031", "0026-works-versioning FR-033"],
  "the command runs as a program on this runtime: 0 for nothing found, 1 for a finding, 2 for a usage error, 3 for an environment that cannot run it",
  async () => {
    await withTempDir(async (dir) => {
      const repo = await libraryRepo(dir);
      await git(repo, ["checkout", "-q", "-b", "feature"]);
      const run = (...args: string[]) => spawn([execPath(), VERSIONS, ...args, "--repo", repo], { env: { GIT_TERMINAL_PROMPT: "0" } });
      assertEquals((await run("check", "--base", "main")).code, 0);
      await commit(repo, "Change\n\nRefs #10", DAY(11), { "lib/a.ts": "2\n" });
      const found = await run("check", "--base", "main");
      assertEquals(found.code, 1);
      assertStringIncludes(found.stderr, "versions/not-grown");
      assertEquals((await run("nonsense")).code, 2);
      assertEquals((await run("check", "--base", "no-such-branch")).code, 3);
      const help = await spawn([execPath(), VERSIONS, "--help"], { env: { GIT_TERMINAL_PROMPT: "0" } });
      assertEquals(help.code, 0);
      assertStringIncludes(help.stdout, "ledger");
      const outside = await makeTempDir({ dir });
      const notRepo = await spawn([execPath(), VERSIONS, "check", "--repo", outside], {
        env: { GIT_TERMINAL_PROMPT: "0", GIT_CEILING_DIRECTORIES: dir },
      });
      assertEquals(notRepo.code, 3);
      assertStringIncludes(notRepo.stderr, "not_run");
    });
  },
  needsGit,
);

// ------------------------------------------------------------------------------------------------------------------------------- commons

proves(
  ["0026-works-versioning FR-034", "0026-works-versioning FR-035"],
  "commons' two works have records equal to their tags and to their package.json versions, and the ledger of this repository, read from its real tags, finds nothing",
  async () => {
    const decode = (file: string) => {
      const r = decodeReleaseSource(readTextFileSync(join(ROOT, file)));
      assert(r.kind === "ok", `${file}: ${JSON.stringify(r)}`);
      return r.value;
    };
    const ts = decode("commons/ts/release.ts");
    const docs = decode("commons/docs/release.ts");
    assertEquals([ts.slug, ts.version], ["ifc-ts", "0.15.0"]);
    assertEquals([docs.slug, docs.version], ["ifc-docs", "0.1.5"]);
    for (const [dirName, r] of [
      ["ts", ts],
      ["docs", docs],
    ] as const) {
      const pkg: unknown = JSON.parse(readTextFileSync(join(ROOT, "commons", dirName, "package.json")));
      assert(typeof pkg === "object" && pkg !== null && "version" in pkg);
      assertEquals(pkg.version, r.version, `commons/${dirName}/package.json carries the version of its record`);
    }
    const tags = await spawn(["git", "-C", ROOT, "tag", "-l", "ifc-ts-v0.4.0", "ifc-docs-v0.1.0"]);
    if (tags.stdout.trim() === "") return; // a clone with no tags (a shallow checkout) cannot say; the check job fetches them
    const workflow = readTextFileSync(join(ROOT, ".github", "workflows", "tests.auto.yml"));
    assertStringIncludes(workflow, "fetch-depth: 0");
    assertStringIncludes(workflow, "bun commons/ts/mizan/versions.ts check\n");
    assertStringIncludes(workflow, "node commons/ts/mizan/versions.ts check\n");
    const ledger = await v(ROOT, "ledger", "--json");
    assertEquals(ledger.code, 0, ledger.err);
    assertStringIncludes(ledger.out, '"tag": "ifc-ts-v0.4.0"');
    assertStringIncludes(ledger.out, '"tag": "ifc-docs-v0.1.0"');
  },
  needsGit,
);
