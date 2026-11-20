/**
 * Tests of `repoctl status` and `repoctl release` (commons repoctl 0004-repoctl-status-release FR-001 to FR-010): the rows of the status from a real repository with a real remote and real tags (the registry of npm is the one thing that needs
 * an account and the network, so a record of what it shows stands in for it), the plan, the preview and the gate of the publication, and a publication of real tarballs in a real repository whose `npm` is a program of the test that
 * checks how it is called: the credential is in no stream, no outcome and no argument, its file is private, outside the repository and gone afterwards, the tarball is an absolute path, and each release is tried in order.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { err, ok } from "@intellectual-frontiers/core";
import { secretOf } from "@intellectual-frontiers/headless/logical";
import { fs, path } from "@intellectual-frontiers/system";
import { TIERS } from "@intellectual-frontiers/repoctl/governance";
import {
  confirmationPhrase,
  findingsOfStatus,
  gate,
  greatest,
  compareSemver,
  npmrcText,
  planPublish,
  type Process,
  type Registry,
  type ReleaseEntry,
  runStatus,
  stateOf,
  STAGED_NOTE,
  tableOf,
  tagsOf,
  tarballPath,
  type World,
} from "@intellectual-frontiers/repoctl/logical";
import { manifestLibraries, systemFiles, systemProcess, systemWorld } from "@intellectual-frontiers/repoctl/physical";
import { CAN_RUN, execute, git, hostOf, put } from "./world.ts";

const TOKEN = `npm_${"A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8"}`;

const manifest = (name: string, version: string, distribution: readonly string[]): string =>
  `export const library = ${JSON.stringify({ name, level: "L0", verify: "bun run verify", version, exports: ["."], distribution })};\n`;

/** A registry of the test: what npm shows of each package, or a reason it cannot be asked. */
const registryOf = (shown: Readonly<Record<string, { latest: string; versions: readonly string[] } | "absent" | "down">>, asked: string[] = []): Registry => ({
  view: (name) => {
    asked.push(name);
    const s = shown[name];
    if (s === undefined || s === "absent") return Promise.resolve(ok("absent"));
    return Promise.resolve(s === "down" ? err("the registry answered 503") : ok({ latest: s.latest, versions: s.versions }));
  },
});

proves(["0004-repoctl-status-release FR-001"], "versions are ordered by their numbers, tags are read from `git ls-remote` and `git tag`, and the state is from the three versions", () => {
  assertEquals(compareSemver("0.10.0", "0.9.9"), 1);
  assertEquals(compareSemver("1.0.0-rc.1", "1.0.0"), -1);
  assertEquals(greatest(["0.1.0", "0.10.0", "0.9.0"]), "0.10.0");
  assertEquals(greatest([]), undefined);
  const tags = tagsOf("abc\trefs/tags/core-v0.1.0\nabc\trefs/tags/core-v0.1.0^{}\ndef\trefs/tags/integrations-github-v1.2.3-rc.1\nbeef\trefs/tags/not-a-release\ncore-v0.2.0\n");
  assertEquals([...tags.entries()], [["core", ["0.1.0", "0.2.0"]], ["integrations-github", ["1.2.3-rc.1"]]]);
  const found = { kind: "found", latest: "0.1.0", hasRepoVersion: true } as const;
  const tagged = { kind: "found", latest: "0.1.0", hasRepoVersion: true, source: "remote" } as const;
  assertEquals(stateOf({ npm: true }, found, tagged), "released");
  assertEquals(stateOf({ npm: true }, { ...found, hasRepoVersion: false }, tagged), "unpublished");
  assertEquals(stateOf({ npm: true }, { kind: "absent" }, tagged), "unpublished");
  assertEquals(stateOf({ npm: false }, { kind: "not-published" }, { ...tagged, hasRepoVersion: false }), "untagged");
  assertEquals(stateOf({ npm: true }, found, { kind: "none", source: "remote" }), "untagged");
  assertEquals(stateOf({ npm: true }, { kind: "skipped" }, tagged), "unknown");
  assertEquals(stateOf({ npm: true }, { kind: "unreachable", why: "x" }, tagged), "unknown");
});

/** A repository with a bare remote, two libraries and tags pushed to the remote. */
async function withRemote<T>(use: (dir: string, world: World) => Promise<T>): Promise<T> {
  return await fs.withTempDir(async (base) => {
    const remote = path.join(base, "origin.git");
    const dir = path.join(base, "work");
    await fs.mkdir(dir);
    await git(base, "init", "-q", "--bare", remote);
    await git(dir, "init", "-q");
    await git(dir, "remote", "add", "origin", remote);
    await put(dir, "commons/alpha/library.ts", manifest("alpha", "0.2.0", ["github", "npm"]));
    await put(dir, "commons/beta/library.ts", manifest("beta", "0.1.0", ["github"]));
    await put(dir, "commons/gamma/library.ts", manifest("gamma", "0.3.0", ["github", "npm"]));
    await git(dir, "add", ".");
    await git(dir, "commit", "-q", "-m", "Start");
    await git(dir, "tag", "alpha-v0.1.0");
    await git(dir, "tag", "beta-v0.1.0");
    await git(dir, "tag", "gamma-v0.3.0");
    await git(dir, "push", "-q", "origin", "HEAD:main", "--tags");
    await git(dir, "tag", "-d", "gamma-v0.3.0");
    return await use(dir, systemWorld(dir, () => undefined));
  });
}

proves(["0004-repoctl-status-release FR-001", "0004-repoctl-status-release FR-003"], "a row has the three versions and a state as a table and as JSON, and what npm does not list is shown as not listed with no word of staging", async () => {
  if (!CAN_RUN) return;
  await withRemote(async (dir, base) => {
    const asked: string[] = [];
    const world: World = { ...base, registry: registryOf({ "@intellectual-frontiers/alpha": { latest: "0.1.0", versions: ["0.1.0"] }, "@intellectual-frontiers/gamma": { latest: "0.3.0", versions: ["0.3.0"] } }, asked) };
    const r = await runStatus(world, { offline: false });
    assert(r.kind === "ok");
    assertEquals(r.value.rows.map((x) => `${x.library} ${x.repo} ${x.state}`), ["alpha 0.2.0 unpublished", "beta 0.1.0 released", "gamma 0.3.0 released"]);
    assertEquals(asked.sort(), ["@intellectual-frontiers/alpha", "@intellectual-frontiers/gamma"], "a library that names no npm is not asked about");
    const table = tableOf(r.value);
    assertStringIncludes(table, "0.1.0 (this version not listed)");
    assertStringIncludes(table, "not on npm");
    assertStringIncludes(table, "0.1.0 (this version not tagged)");
    assert(!/staged|on its way|live/i.test(table), "nothing says a version is staged");
    assertEquals(findingsOfStatus(r.value), []);
    const out = await execute(hostOf(world), ["status", "--json"]);
    assertEquals(out.code, 0, out.err);
    const doc = JSON.parse(out.out) as { data: { rows: { library: string; npm: { kind: string }; tag: { kind: string; source: string } }[] } };
    assertEquals(doc.data.rows.map((x) => `${x.library} ${x.npm.kind} ${x.tag.kind} ${x.tag.source}`), ["alpha found found remote", "beta not-published found remote", "gamma found found remote"]);
    // the local clone lacks the tag of gamma, and the remote has it: the table says what each shows
    assertEquals((await git(dir, "tag", "--list")).includes("gamma"), false);
  });
});

proves(["0004-repoctl-status-release FR-002"], "--offline asks no registry and reads the local tags", async () => {
  if (!CAN_RUN) return;
  await withRemote(async (_dir, base) => {
    const asked: string[] = [];
    const world: World = { ...base, registry: registryOf({}, asked) };
    const r = await runStatus(world, { offline: true });
    assert(r.kind === "ok");
    assertEquals(asked, []);
    assertEquals(r.value.rows.map((x) => `${x.library} ${x.npm.kind} ${x.tag.kind === "found" ? x.tag.source : x.tag.kind} ${x.state}`), ["alpha skipped local unknown", "beta not-published local released", "gamma skipped none unknown"]);
    const out = await execute(hostOf(world), ["status", "--offline"]);
    assertEquals(out.code, 0, out.err);
    assertEquals(asked, []);
  });
});

proves(["0004-repoctl-status-release FR-003"], "a registry that cannot be asked is a warning with a code and not a failure", async () => {
  if (!CAN_RUN) return;
  await withRemote(async (_dir, base) => {
    const world: World = { ...base, registry: registryOf({ "@intellectual-frontiers/alpha": "down", "@intellectual-frontiers/gamma": "down" }) };
    const r = await runStatus(world, { offline: false });
    assert(r.kind === "ok");
    assertEquals(findingsOfStatus(r.value).map((f) => `${f.level} ${f.code}`), ["warn E-NPM-UNREACHABLE", "warn E-NPM-UNREACHABLE"]);
    const out = await execute(hostOf(world), ["status"]);
    assertEquals(out.code, 0, "a warning does not fail the run");
    assertStringIncludes(out.err, "E-NPM-UNREACHABLE");
    assertStringIncludes(out.out, "unreachable");
  });
});

proves(["0004-repoctl-status-release FR-004", "0004-repoctl-status-release FR-005"], "the plan of a real repository is given and nothing is written, and apply with --dry-run is the plan", async () => {
  if (!CAN_RUN) return;
  await fs.withTempDir(async (dir) => {
    for (const [name, version] of [["libraries", "0.4.0"], ["alpha", "0.1.0"]] as const) {
      await put(dir, `commons/${name}/library.ts`, manifest(name, version, ["github", "npm"]));
      await put(dir, `commons/${name}/package.json`, `${JSON.stringify({ name: `@intellectual-frontiers/${name}`, version, exports: { ".": "./src/mod.ts" } }, null, 2)}\n`);
      await put(dir, `commons/${name}/src/mod.ts`, `export const ${name} = 1;\n`);
      await put(dir, `commons/${name}/release.ts`, `export const release = ${JSON.stringify({ slug: name, kind: "Library", title: name, authors: [{ name: "x" }], version, repository: "https://example.org/r" })};\n`);
    }
    await git(dir, "init", "-q");
    await git(dir, "add", ".");
    await git(dir, "commit", "-q", "-m", "Start");
    await git(dir, "tag", "alpha-v0.1.0");
    await git(dir, "tag", "libraries-v0.4.0");
    await put(dir, "commons/alpha/src/mod.ts", "export const alpha = 2;\n");
    await git(dir, "commit", "-q", "-am", "Change alpha\n\nImpact: minor");
    const before = await git(dir, "status", "--porcelain");
    const host = hostOf(systemWorld(dir, () => undefined));
    const plan = await execute(host, ["release", "plan", "--offline", "--json"]);
    assertEquals(plan.code, 0, plan.err);
    const doc = JSON.parse(plan.out) as { data: { steps: { library: string; from: string; to: string }[] } };
    assertEquals(doc.data.steps.map((s) => `${s.library} ${s.from}>${s.to}`), ["alpha 0.1.0>0.2.0"]);
    const dry = await execute(host, ["release", "apply", "--offline", "--dry-run"]);
    assertEquals(dry.code, 0, dry.err);
    assertStringIncludes(dry.out, "alpha 0.1.0 -> 0.2.0");
    assertEquals(await git(dir, "status", "--porcelain"), before, "nothing is written");
    const bad = await execute(host, ["release", "plan", "--offline", "--raise", "alpha=huge"]);
    assertEquals(bad.code, 2);
  });
});

proves(["0004-repoctl-status-release FR-005"], "apply raises the version into the record, the manifest, the package and the constant the manifest names, makes the generated files by the table and commits nothing", async () => {
  if (!CAN_RUN) return;
  await fs.withTempDir(async (dir) => {
    const name = "libraries";
    const manifestText = (v: string): string => `export const library = ${JSON.stringify({ name, level: "L0", verify: "bun run verify", version: v, exports: ["."], distribution: ["github", "npm"], versionConstants: [{ file: "src/version.ts", name: "LIBRARIES_VERSION" }] })};\n`;
    await put(dir, `commons/${name}/library.ts`, manifestText("0.1.0"));
    await put(dir, `commons/${name}/package.json`, `${JSON.stringify({ name: `@intellectual-frontiers/${name}`, version: "0.1.0", exports: { ".": "./src/mod.ts" } }, null, 2)}\n`);
    await put(dir, `commons/${name}/src/mod.ts`, "export const x = 1;\n");
    await put(dir, `commons/${name}/src/version.ts`, 'export const LIBRARIES_VERSION = "0.1.0";\n');
    await put(dir, `commons/${name}/release.ts`, `export const release = ${JSON.stringify({ slug: name, kind: "Library", title: name, authors: [{ name: "x" }], version: "0.1.0", repository: "https://example.org/r" })};\n`);
    await git(dir, "init", "-q");
    await git(dir, "add", ".");
    await git(dir, "commit", "-q", "-m", "Start");
    await git(dir, "tag", "libraries-v0.1.0");
    await put(dir, `commons/${name}/src/mod.ts`, "export const x = 2;\n");
    await git(dir, "commit", "-q", "-am", "Change\n\nImpact: minor");
    const made: string[] = [];
    const releasing = { generate: () => Promise.resolve(ok(undefined)), prove: () => Promise.resolve(ok(undefined)) };
    const generators = [{ id: "readme" as const, summary: "the readme of a test", command: ["make-readme.mjs"], inputs: ["commons/*/library.ts"], outputs: ["README.md"] }];
    await put(dir, "make-readme.mjs", `import { writeFileSync, readFileSync } from "node:fs";\nconst v = readFileSync("commons/libraries/src/version.ts", "utf8").match(/"([^"]+)"/)?.[1];\nconst text = "libraries " + v + "\\n";\nif (process.argv.includes("--check")) process.exit(readFileSync("README.md", "utf8") === text ? 0 : 1);\nwriteFileSync("README.md", text);\n`);
    await put(dir, "README.md", "libraries 0.1.0\n");
    await git(dir, "add", ".");
    await git(dir, "commit", "-q", "-m", "The README");
    const out = await execute(hostOf(systemWorld(dir, () => undefined), { generators, releasing }), ["release", "apply", "--offline", "--no-tests"]);
    assertEquals(out.code, 0, out.err);
    made.push(await fs.readTextFile(path.join(dir, `commons/${name}/src/version.ts`)));
    assertEquals(made[0], 'export const LIBRARIES_VERSION = "0.2.0";\n');
    assertStringIncludes(await fs.readTextFile(path.join(dir, `commons/${name}/library.ts`)), '"version":"0.2.0"');
    assertStringIncludes(await fs.readTextFile(path.join(dir, `commons/${name}/package.json`)), '"version": "0.2.0"');
    assertEquals(await fs.readTextFile(path.join(dir, "README.md")), "libraries 0.2.0\n", "the generators of the table are made after the versions");
    assertEquals((await git(dir, "log", "--oneline")).trim().split("\n").length, 3, "nothing is committed");
  });
});

/** Entries of a record and the files of a publication in a real repository: a, b and c go to npm, d is not packed, e is only tagged. */
async function withRecord<T>(use: (dir: string, entries: readonly ReleaseEntry[]) => Promise<T>, pack: readonly string[] = ["a", "b", "c"]): Promise<T> {
  return await fs.withTempDir(async (dir) => {
    await git(dir, "init", "-q");
    const entries: ReleaseEntry[] = ["a", "b", "c", "d", "e"].map((slug) => ({ slug, package: `@intellectual-frontiers/${slug}`, version: "1.0.0", folder: `commons/${slug}`, tag: `${slug}-v1.0.0`, publish: slug !== "e" }));
    for (const e of entries) if (pack.includes(e.slug)) await put(dir, `${e.folder}/dist/intellectual-frontiers-${e.slug}-${e.version}.tgz`, "tarball");
    const record = { generated: "test", releases: entries.map(({ slug, package: pkg, version, folder, tag, publish }) => ({ slug, package: pkg, version, folder, tag, publish })) };
    await put(dir, "commons/generated/release.auto.json", `${JSON.stringify(record, null, 2)}\n`);
    return await use(dir, entries);
  });
}

/** `npm` as a program of the test: it records how it is called, looks at the private file it is given, says what it is asked to (the token among it) and fails for the tarballs it is told to. Every other program is the real one. */
function npmProcess(calls: { argv: readonly string[]; mode: number; inside: boolean; content: string }[], failing: readonly string[], repo: string): Process {
  return {
    run: async (argv, options) => {
      if (argv[0] !== "npm") return await systemProcess.run(argv, options);
      const rc = argv[argv.indexOf("--userconfig") + 1] ?? "";
      const stat = fs.statSync(rc);
      calls.push({ argv, mode: (stat.mode ?? 0) & 0o777, inside: rc.startsWith(repo), content: fs.readTextFileSync(rc) });
      const bad = failing.some((f) => argv.some((a) => a.endsWith(f)));
      return { code: bad ? 1 : 0, stdout: "", stderr: bad ? `npm error 403 using ${TOKEN} is not allowed to publish\n` : "" };
    },
  };
}

proves(["0004-repoctl-status-release FR-006"], "the phrase confirms what the plan names, a plan says why a release cannot be sent, and the gate refuses a wrong phrase and a missing token", async () => {
  if (!CAN_RUN) return;
  await withRecord(async (dir, entries) => {
    const world = systemWorld(dir, () => undefined);
    const plan = await planPublish({ ...world, registry: registryOf({ "@intellectual-frontiers/c": { latest: "1.0.0", versions: ["1.0.0"] } }) }, entries, new Set());
    assertEquals(plan.items.map((i) => `${i.entry.slug} ${i.kind}`), ["a ready", "b ready", "c present", "d no-tarball"], "e names no npm, so it is no item");
    assertEquals(plan.phrase, confirmationPhrase(entries));
    assert(/^publish 4 [0-9a-f]{8}$/.test(plan.phrase), plan.phrase);
    assert(confirmationPhrase(entries.slice(0, 2)) !== plan.phrase, "another set of releases is another phrase");
    const tagged = await planPublish({ ...world, registry: registryOf({}) }, entries, new Set(["a-v1.0.0", "b-v1.0.0", "c-v1.0.0", "d-v1.0.0"]));
    assertEquals(tagged.items, [], "what is tagged is not sent again");
    assertEquals(gate({ token: secretOf(TOKEN), typed: plan.phrase, phrase: plan.phrase }), []);
    assertEquals(gate({ token: secretOf(TOKEN), typed: "publish 4 deadbeef", phrase: plan.phrase }).map((f) => f.code), ["E-PUBLISH-REFUSED"]);
    assertEquals(gate({ token: secretOf(TOKEN), typed: undefined, phrase: plan.phrase }).map((f) => f.code), ["E-PUBLISH-REFUSED"]);
    assertEquals(gate({ token: undefined, typed: plan.phrase, phrase: plan.phrase }).map((f) => f.code), ["E-NO-TOKEN"]);
    assertEquals(gate({ token: undefined, typed: "no", phrase: plan.phrase }).map((f) => f.code), ["E-NO-TOKEN", "E-PUBLISH-REFUSED"]);
    assertEquals(tarballPath("/r", entries[0] as ReleaseEntry), "/r/commons/a/dist/intellectual-frontiers-a-1.0.0.tgz");
  });
});

proves(["0004-repoctl-status-release FR-006", "0004-repoctl-status-release FR-007"], "the preview prints the phrase and sends nothing; a wrong phrase or no token sends nothing; the tier releaser alone sees the verb", async () => {
  if (!CAN_RUN) return;
  await withRecord(async (dir) => {
    const calls: { argv: readonly string[]; mode: number; inside: boolean; content: string }[] = [];
    const base = systemWorld(dir, () => undefined);
    const world: World = { ...base, process: npmProcess(calls, [], dir), registry: registryOf({}), credentials: { npmToken: () => secretOf(TOKEN) } };
    const host = hostOf(world);
    const preview = await execute(host, ["release", "publish", "--dry-run", "--json"], { tier: TIERS.releaser });
    const doc = JSON.parse(preview.out) as { data: { phrase: string; items: { library: string; state: string }[] } };
    assertEquals(preview.code, 1, "the preview fails: d has no tarball");
    assertEquals(doc.data.items.map((i) => `${i.library} ${i.state}`), ["a ready", "b ready", "c ready", "d no-tarball"]);
    assert(/^publish 4 [0-9a-f]{8}$/.test(doc.data.phrase));
    assertEquals((JSON.parse(preview.out) as { problems: { code: string }[] }).problems.map((p) => p.code), ["E-NO-TARBALL"]);
    assertEquals(calls, [], "a preview sends nothing");
    const wrong = await execute(host, ["release", "publish", "--yes", "--confirm", "publish 4 deadbeef"], { tier: TIERS.releaser });
    assertEquals(wrong.code, 1);
    assertStringIncludes(wrong.err, "E-PUBLISH-REFUSED");
    assertEquals(calls, []);
    const bare = await execute(host, ["release", "publish", "--yes"], { tier: TIERS.releaser });
    assertStringIncludes(bare.err, "E-PUBLISH-REFUSED");
    const none = await execute(hostOf({ ...world, credentials: { npmToken: () => undefined } }), ["release", "publish", "--yes", "--confirm", doc.data.phrase], { tier: TIERS.releaser });
    assertStringIncludes(none.err, "E-NO-TOKEN");
    assertEquals(calls, []);
    const without = await execute(host, ["release", "publish", "--confirm", doc.data.phrase], { tier: TIERS.releaser });
    assertEquals(without.code === 0 || calls.length === 0, true, "without --yes a destruction is not confirmed on a run with no terminal");
    assertEquals(calls, []);
    const hidden = await execute(host, ["release", "publish", "--dry-run"], { tier: TIERS.contributor });
    assertEquals(hidden.code, 2);
    assertStringIncludes(hidden.err, "releaser");
  });
});

proves(["0004-repoctl-status-release FR-007", "0004-repoctl-status-release FR-008", "0004-repoctl-status-release FR-009", "0004-repoctl-status-release FR-010"], "a publication of real tarballs: the token is in no stream, outcome or argument, its file is private, outside the repository and removed, the tarball is an absolute path and each release is tried in order", async () => {
  if (!CAN_RUN) return;
  await withRecord(async (dir) => {
    const calls: { argv: readonly string[]; mode: number; inside: boolean; content: string }[] = [];
    const base = systemWorld(dir, () => undefined);
    const world: World = { ...base, process: npmProcess(calls, ["intellectual-frontiers-b-1.0.0.tgz"], dir), registry: registryOf({ "@intellectual-frontiers/c": { latest: "1.0.0", versions: ["1.0.0"] } }), credentials: { npmToken: () => secretOf(TOKEN) } };
    const host = hostOf(world, { env: (n) => (n === "INFRO_NPMJS_TOKEN" ? TOKEN : undefined) });
    const pre = await execute(host, ["release", "publish", "--dry-run", "--json"], { tier: TIERS.releaser });
    const phrase = (JSON.parse(pre.out) as { data: { phrase: string } }).data.phrase;
    // d has no tarball and is reported, not tried; a is sent; b is refused by npm, which says the token; c is on npm
    const run = await execute(host, ["release", "publish", "--yes", "--confirm", phrase, "--json"], { tier: TIERS.releaser, env: { INFRO_NPMJS_TOKEN: TOKEN } });
    assertEquals(run.code, 1);
    const doc = JSON.parse(run.out) as { problems: { code: string }[]; data: { results: { library: string; result: string }[]; staged: boolean } };
    assertEquals(doc.data.results.map((r) => `${r.library} ${r.result}`), ["a published", "b failed", "c present", "d not-run"]);
    assertEquals(doc.data.staged, true);
    assertEquals(calls.map((c) => c.argv[2]), [path.join(dir, "commons/a/dist/intellectual-frontiers-a-1.0.0.tgz"), path.join(dir, "commons/b/dist/intellectual-frontiers-b-1.0.0.tgz")], "each tarball is an absolute path, in order");
    for (const c of calls) {
      assertEquals(c.argv.slice(0, 2), ["npm", "publish"]);
      assert(path.isAbsolute(c.argv[2] ?? ""));
      assertEquals(c.mode, 0o600, "the file that holds the credential is private");
      assertEquals(c.inside, false, "it is outside the repository");
      assertEquals(c.content, `//registry.npmjs.org/:_authToken=${TOKEN}\n`);
      assert(!c.argv.join(" ").includes(TOKEN), "the credential is in no argument");
      assertEquals(await fs.exists(path.dirname(c.argv[c.argv.indexOf("--userconfig") + 1] ?? "")), false, "the folder of the file is removed");
    }
    assert(!run.out.includes(TOKEN) && !run.err.includes(TOKEN), "the token is in no stream");
    assertEquals(doc.problems.map((p) => p.code), ["E-PUBLISH-FAILED", "E-NO-TARBALL"]);
    assertStringIncludes(run.out, "***");
    assertEquals(npmrcText(secretOf(TOKEN)).trim(), `//registry.npmjs.org/:_authToken=${TOKEN}`);
    assertEquals(String(secretOf(TOKEN)), "[redacted]");
    assertEquals(JSON.stringify({ token: secretOf(TOKEN) }), '{"token":"[redacted]"}');
    // the text for a person says that npm stages what is sent by hand, and what to run
    const human = await execute(host, ["release", "publish", "--yes", "--confirm", phrase], { tier: TIERS.releaser, env: { INFRO_NPMJS_TOKEN: TOKEN } });
    assertStringIncludes(human.out, STAGED_NOTE);
    assert(!human.out.includes(TOKEN) && !human.err.includes(TOKEN));
  });
});

proves(["0004-repoctl-status-release FR-008"], "the private file is removed after a run in which every release fails, and nothing is left under the system's temporary folder by it", async () => {
  if (!CAN_RUN) return;
  await withRecord(async (dir) => {
    const calls: { argv: readonly string[]; mode: number; inside: boolean; content: string }[] = [];
    const base = systemWorld(dir, () => undefined);
    const world: World = { ...base, process: npmProcess(calls, ["intellectual-frontiers-a-1.0.0.tgz", "intellectual-frontiers-b-1.0.0.tgz", "intellectual-frontiers-c-1.0.0.tgz"], dir), registry: registryOf({}), credentials: { npmToken: () => secretOf(TOKEN) } };
    const host = hostOf(world);
    const pre = await execute(host, ["release", "publish", "--dry-run", "--json"], { tier: TIERS.releaser });
    const phrase = (JSON.parse(pre.out) as { data: { phrase: string } }).data.phrase;
    const run = await execute(host, ["release", "publish", "--yes", "--confirm", phrase], { tier: TIERS.releaser });
    assertEquals(run.code, 1);
    assertEquals(calls.length, 3);
    for (const c of calls) assertEquals(await fs.exists(c.argv[c.argv.indexOf("--userconfig") + 1] ?? ""), false);
    assert(!run.out.includes(TOKEN) && !run.err.includes(TOKEN));
    assert(!run.out.includes("staged") && !run.out.includes(STAGED_NOTE), "nothing was sent, so nothing is said to be staged");
  }, ["a", "b", "c"]);
});

proves(["0004-repoctl-status-release FR-001"], "the manifests of the real repository are read as libraries with their versions", async () => {
  const r = await manifestLibraries(path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "../../..")).list();
  assert(r.kind === "ok");
  const me = r.value.find((l) => l.name === "repoctl");
  assertEquals([me?.folder, me?.npm, me?.specKit, me?.versionConstants], ["commons/repoctl", true, "spec-kit", [{ file: "src/governance/version.ts", name: "REPOCTL_VERSION" }]]);
  assertEquals(systemFiles === undefined, false);
});
