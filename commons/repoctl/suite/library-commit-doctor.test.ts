/**
 * Tests of `repoctl new library`, `repoctl commit` and `repoctl doctor` (commons repoctl 0005-repoctl-library-commit-doctor FR-001 to FR-008): the files of a scaffold and the names it refuses; a library scaffolded into a copy of the real repository
 * that passes its own `verify` and leaves `sync --check` at 0; commits in real repositories as the repository's identity with the trailers in order, and the refusals (the folder of an agent, installed packages, secrets, a stale generator,
 * nothing staged); and the findings of a checkout in the order to fix them.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { ok } from "@intellectual-frontiers/core";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { type CommitPolicy, type DoctorPolicy, DEFAULT_ALLOWED_PATHS, DEFAULT_FORBIDDEN_PATHS, DEFAULT_SECRET_PATTERNS, sessionUrlOfRemote, TIERS } from "@intellectual-frontiers/repoctl/governance";
import { acceptName, actorsOf, diagnose, type Facts, filesOf, forbidden, gatherFacts, type Held, majorOf, messageOf, messageText, type Process, ROLES, secretLike, titleOf, withRole, withSpecKit, type World } from "@intellectual-frontiers/repoctl/logical";
import { systemProcess, systemWorld } from "@intellectual-frontiers/repoctl/physical";
import { main } from "@intellectual-frontiers/repoctl";
import { CAN_RUN, CHECKOUT, checkVerdict, execute, git, hostOf, LIBRARIES, put, TEST_CO_AUTHOR, TEST_IDENTITY, withRepo } from "./world.ts";

const CO_AUTHOR = TEST_CO_AUTHOR;
const IDENTITY = TEST_IDENTITY;
const RULES: CommitPolicy["forbidden"] = { paths: DEFAULT_FORBIDDEN_PATHS, allow: DEFAULT_ALLOWED_PATHS, secrets: DEFAULT_SECRET_PATTERNS, canaries: [] };
const TRAILERS: Pick<CommitPolicy, "issue" | "trailers"> = { issue: { prefix: "Refs #", required: false }, trailers: ["issue", "co-author", "session"] };
const DOCTOR: DoctorPolicy = { minNode: 26, bunPin: undefined, links: { folder: "commons/node_modules/@intellectual-frontiers", fix: ["bun", "commons/libraries/src/link.ts"] }, install: "bun install --frozen-lockfile" };

const SESSION = "https://claude.ai/code/session_test";
/** The start of the line that opens a private key, written in two parts so that this file does not look like it holds one. */
const BEGIN = `${"-----"}BEGIN`;
const HELD: readonly Held[] = [
  { match: { kind: "exact", name: "toolchain" }, host: "toolchain" },
  { match: { kind: "prefix", prefix: "desired-os-state-" }, host: "desired-os-state" },
];

proves(["0005-repoctl-library-commit-doctor FR-001"], "the scaffold has every file of a library, each with the name in it, and a title is made of the name", () => {
  const files = filesOf({ name: "widget-kit", summary: "Widgets, made by the book.", folder: "commons" });
  const paths = files.map((f) => f.path);
  for (const p of ["library.ts", "package.json", "release.ts", "tsconfig.json", "about.ts", "src/mod.ts", "src/governance/mod.ts", "src/logical/mod.ts", "src/physical/mod.ts", "spec-kit/registry.tsv", "spec-kit/enforcement.tsv", "spec-kit/mizan.baseline.txt", "spec-kit/specs/0001-widget-kit-layers/spec.md", "suite/layers.test.ts", "tools/check.ts", "tools/pack.ts", "trace.baseline.txt"])
    assert(paths.includes(`commons/widget-kit/${p}`), `${p} is made`);
  assertEquals(new Set(paths).size, paths.length);
  assertEquals(titleOf("widget-kit"), "Widget Kit");
  const lib = files.find((f) => f.path.endsWith("/library.ts"))?.text ?? "";
  assertStringIncludes(lib, 'name: "widget-kit"');
  assertStringIncludes(lib, 'summary: "Widgets, made by the book."');
  assertStringIncludes(lib, "kanon:");
  const pkg = JSON.parse(files.find((f) => f.path.endsWith("/package.json"))?.text ?? "{}") as { name: string; scripts: { verify: string } };
  assertEquals(pkg.name, "@intellectual-frontiers/widget-kit");
  assertStringIncludes(pkg.scripts.verify, "bun ../kanon/src/check.ts");
  assertEquals(filesOf({ name: "widget-kit", summary: "Widgets, made by the book.", folder: "commons" }), files, "the same name gives the same files");
});

proves(["0005-repoctl-library-commit-doctor FR-002"], "an invalid, a reserved and an existing name are refused with their codes", () => {
  const code = (name: string): string => {
    const r = acceptName(name, HELD, ["core", "widget"], "commons");
    return r.kind === "ok" ? "ok" : r.error.code;
  };
  assertEquals(["Bad_Name", "9x", "", "ok-name", "toolchain", "desired-os-state-x", "widget", "desired-os-state"].map(code), ["E-LIBRARY-NAME", "E-LIBRARY-NAME", "E-LIBRARY-NAME", "ok", "E-LIBRARY-RESERVED", "E-LIBRARY-RESERVED", "E-LIBRARY-EXISTS", "ok"]);
});

proves(["0005-repoctl-library-commit-doctor FR-003"], "the role is written into the map of roles, after the last library of its role, once", () => {
  const source = 'export const ROLE_OF: ReadonlyMap<string, Role> = new Map<string, Role>([\n  ["core", "foundation"],\n  ["data", "program"],\n  ["libraries", "program"],\n  ["mizan", "standard"],\n]);\nconst after = 1;\n';
  const made = withRole(source, "widget", "program");
  assert(made.kind === "ok");
  assertEquals(made.value, source.replace('  ["libraries", "program"],\n', '  ["libraries", "program"],\n  ["widget", "program"],\n'));
  assertEquals(withRole(made.value, "widget", "program"), ok(made.value), "a library that is there is not added twice");
  const last = withRole('export const ROLE_OF = new Map([\n  ["a", "foundation"],\n  ["z", "standard"],\n]);', "y", "standard");
  assert(last.kind === "ok" && last.value.includes('  ["z", "standard"],\n  ["y", "standard"],\n]);'), "a library of the role that ends the map goes inside the map");
  const pattern = withRole(source, "shape", "pattern");
  assert(pattern.kind === "ok" && pattern.value.includes('  ["shape", "pattern"],\n]);'), "a role with no library yet goes at the end of the map");
  assertEquals(withRole("nothing", "x", "program").kind, "err");
  assertEquals(ROLES, ["foundation", "pattern", "program", "standard"]);
});

proves(["0005-repoctl-library-commit-doctor FR-001", "0005-repoctl-library-commit-doctor FR-002"], "new library --dry-run lists the files and writes nothing, and a name that is refused writes nothing", async () => {
  if (!CAN_RUN) return;
  await fs.withTempDir(async (dir) => {
    await put(dir, "commons/core/library.ts", "export const library = {};\n");
    const host = hostOf(systemWorld(dir, () => undefined, LIBRARIES));
    const dry = await execute(host, ["new", "library", "widget", "--summary", "Widgets.", "--dry-run", "--json"]);
    assertEquals(dry.code, 0, dry.err);
    const doc = JSON.parse(dry.out) as { data: { files: string[] } };
    assert(doc.data.files.includes("commons/widget/library.ts"));
    assertEquals(await fs.exists(path.join(dir, "commons/widget")), false);
    for (const [name, code] of [["Bad_Name", "E-LIBRARY-NAME"], ["desired-os-state-x", "E-LIBRARY-RESERVED"], ["core", "E-LIBRARY-EXISTS"]] as const) {
      const r = await execute(host, ["new", "library", name, "--summary", "x"]);
      assertEquals(r.code, 1, `${name}: ${r.err}`);
      assertStringIncludes(r.err, code);
      assertEquals(await fs.exists(path.join(dir, `commons/${name}/library.ts`)), name === "core" ? true : false);
    }
    assertEquals((await execute(host, ["new", "library", "widget", "--summary", "x", "--role", "nope"])).code, 2);
  });
});

/** A copy of the real repository (what Git tracks and what it does not ignore), with the links of the libraries and the packages installed at the root shared with the real one. */
async function copyOfRepository(into: string): Promise<void> {
  const listed = await systemProcess.run(["git", "-C", CHECKOUT, "ls-files", "-z", "--cached", "--others", "--exclude-standard"]);
  for (const file of listed.stdout.split("\0").filter((f) => f !== "")) {
    if (file.split("/").includes("node_modules") || !(await fs.exists(path.join(CHECKOUT, file)))) continue;
    await fs.ensureDir(path.dirname(path.join(into, file)));
    await fs.copyFile(path.join(CHECKOUT, file), path.join(into, file));
  }
  await systemProcess.run(["cp", "-a", path.join(CHECKOUT, "commons/node_modules"), path.join(into, "commons/node_modules")]);
  await fs.symlink(path.join(CHECKOUT, "node_modules"), path.join(into, "node_modules"));
}

proves(["0005-repoctl-library-commit-doctor FR-001", "0005-repoctl-library-commit-doctor FR-003"], "a library made in a copy of the repository passes its own verify and leaves sync --check at 0", async () => {
  if (!CAN_RUN || proc.build.os === "windows") return;
  await fs.withTempDir(async (dir) => {
    await copyOfRepository(dir);
    const out: string[] = [];
    const err: string[] = [];
    const io = { cwd: dir, out: (t: string) => void out.push(t), err: (t: string) => void err.push(t) };
    assertEquals(await main(["new", "library", "probe", "--summary", "Probes, made by the book. They check what a new library is."], io), 0, `${out.join("")}${err.join("")}`);
    for (const f of ["library.ts", "LICENSE", "spec-kit/registry.tsv", "suite/layers.test.ts"]) assert(await fs.exists(path.join(dir, "commons/probe", f)), `${f} is there`);
    assertStringIncludes(await fs.readTextFile(path.join(dir, "commons/libraries/src/readme.ts")), '["probe", "program"]');
    assertStringIncludes(await fs.readTextFile(path.join(dir, "README.md")), "probe");
    assertStringIncludes(await fs.readTextFile(path.join(dir, "commons/docs.config.ts")), '{ layout: "commons", dir: "commons/probe/spec-kit" },');
    out.length = 0;
    assertEquals(await main(["sync", "--check"], io), 0, `${out.join("")}${err.join("")}`);
    const lib = path.join(dir, "commons/probe");
    const installed = await systemProcess.run(["bun", "install", "--frozen-lockfile"], { cwd: lib });
    assertEquals(installed.code, 0, installed.stderr);
    const verified = await systemProcess.run(["bun", "run", "verify"], { cwd: lib });
    assertEquals(verified.code, 0, `${verified.stdout}\n${verified.stderr}`);
    out.length = 0;
    const checked = await main(["check", "--json"], io);
    assertEquals(checkVerdict(checked, out.join("")), "", err.join(""));
    assertEquals(await main(["new", "library", "probe", "--summary", "again"], io), 1, "a second time the library exists");
  });
}, { timeout: 300_000 });

proves(["0005-repoctl-library-commit-doctor FR-005"], "the message is the subject, a blank line, and the trailers in order, each on its own line, and a refs line only where an issue is given", () => {
  const m = messageOf(TRAILERS, { subject: "Add the doctor", refs: "10", coAuthor: CO_AUTHOR, session: SESSION });
  assertEquals(m.trailers, ["Refs #10", CO_AUTHOR, `Claude-Session: ${SESSION}`]);
  assertEquals(messageText(m), `Add the doctor\n\nRefs #10\n${CO_AUTHOR}\nClaude-Session: ${SESSION}\n`);
  assertEquals(messageOf(TRAILERS, { subject: "S", refs: undefined, coAuthor: CO_AUTHOR, session: SESSION }).trailers, [CO_AUTHOR, `Claude-Session: ${SESSION}`]);
  assertEquals(messageOf({ ...TRAILERS, trailers: ["issue", "impact", "co-author", "session"] }, { subject: "S", refs: "10", impact: "major", coAuthor: CO_AUTHOR, session: SESSION }).trailers, ["Refs #10", "Impact: major", CO_AUTHOR, `Claude-Session: ${SESSION}`]);
});

proves(["0005-repoctl-library-commit-doctor FR-006"], "a path of the agent, of installed packages, of a secret and a text that looks like a secret are named and refused", () => {
  const why = (p: string): string | undefined => forbidden(RULES, p);
  assertStringIncludes(why(".claude/settings.json") ?? "", ".claude/");
  assertStringIncludes(why("commons/x/.claude/a") ?? "", ".claude/");
  assertStringIncludes(why("node_modules/a/index.js") ?? "", "node_modules");
  assertStringIncludes(why("commons/x/node_modules/a") ?? "", "node_modules");
  for (const secret of [".env", "app/.env.local", "server.pem", "id_rsa", "keys/deploy.key", "a/.npmrc", "credentials.json", "x/store.p12"]) assert(why(secret) !== undefined, `${secret} is refused`);
  for (const fine of [".env.example", "commons/repoctl/src/mod.ts", "README.md", "claude.md", "node_modules.md", "docs/.claudeignore"]) assertEquals(why(fine), undefined, fine);
  assertEquals(secretLike(RULES, `${BEGIN} OPENSSH PRIVATE KEY-----\nAAAA`), "a private key");
  assertEquals(secretLike(RULES, `token = npm_${"A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8"}`), "an npm token");
  assertEquals(secretLike(RULES, `ghp_${"A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8"}`), "a GitHub token");
  assertEquals(secretLike(RULES, `AKIA${"ABCDEFGHIJKLMNOP"}`), "an access key of AWS");
  assertEquals(secretLike(RULES, "a note that names a token without holding one: npm_token"), undefined);
});

/** A real repository whose configuration names another person, with one commit, and the files given. */
async function withCommits<T>(table: Parameters<typeof withRepo>[0], use: (dir: string, world: World, generators: Parameters<Parameters<typeof withRepo>[1]>[2]) => Promise<T>): Promise<T> {
  return await withRepo(table, async (dir, world, generators) => {
    await git(dir, "config", "user.name", "Someone Else");
    await git(dir, "config", "user.email", "someone@example.test");
    await put(dir, "README.md", "start\n");
    await git(dir, "add", "README.md");
    await git(dir, "commit", "-q", "-m", "Start");
    return await use(dir, world, generators);
  });
}

const commitArgs = ["commit", "-m", "Add the doctor", "--refs", "10", "--session", SESSION] as const;

proves(["0005-repoctl-library-commit-doctor FR-004", "0005-repoctl-library-commit-doctor FR-005"], "in a real repository the commit has the identity as author and committer and the trailers in order, whatever the checkout's configuration says", async () => {
  if (!CAN_RUN) return;
  await withCommits([], async (dir, world) => {
    await put(dir, "a.txt", "a\n");
    const out = await execute(hostOf(world), [...commitArgs, "a.txt", "--json"]);
    assertEquals(out.code, 0, out.err);
    const who = `${IDENTITY.name} <${IDENTITY.email}>`;
    assertEquals((await git(dir, "log", "-1", "--format=%an <%ae>|%cn <%ce>")).trim(), `${who}|${who}`);
    assertEquals((await git(dir, "log", "-1", "--format=%B")).trim(), `Add the doctor\n\nRefs #10\n${CO_AUTHOR}\nClaude-Session: ${SESSION}`);
    assertEquals((await git(dir, "interpret-trailers", "--parse", "--only-trailers", "--no-divider")).length >= 0, true);
    assertEquals((await git(dir, "show", "--name-only", "--format=", "HEAD")).trim(), "a.txt");
    const fromEnv = await execute(hostOf(world, { env: (n) => (n === "CLAUDE_SESSION_URL" ? SESSION : undefined) }), ["commit", "-m", "Second", "a.txt", "--dry-run"]);
    assertEquals(fromEnv.code, 0, fromEnv.err);
  });
});

proves(["0005-repoctl-library-commit-doctor FR-005"], "a subject, an issue and an address that do not fit are refused before anything is staged", async () => {
  if (!CAN_RUN) return;
  await withCommits([], async (dir, world) => {
    await put(dir, "a.txt", "a\n");
    const host = hostOf(world);
    const bad = async (args: readonly string[], code: string): Promise<void> => {
      const r = await execute(host, ["commit", ...args, "a.txt"]);
      assertEquals(r.code, 2, `${args.join(" ")}: ${r.err}`);
      assertStringIncludes(r.err, code);
    };
    await bad(["-m", "Ends with a stop.", "--session", SESSION], "E-COMMIT-SUBJECT");
    await bad(["-m", "Fine", "--refs", "ten", "--session", SESSION], "E-COMMIT-REFS");
    await bad(["-m", "Fine", "--session", "not a url"], "E-COMMIT-SESSION");
    await bad(["-m", "Fine"], "E-COMMIT-SESSION");
    assertEquals((await git(dir, "diff", "--cached", "--name-only")).trim(), "", "nothing was staged");
    assertEquals((await git(dir, "log", "--oneline")).trim().split("\n").length, 1);
  });
});

proves(["0005-repoctl-library-commit-doctor FR-006"], "a file of the agent, of installed packages or a secret is refused whether it is named or staged, and no commit is made", async () => {
  if (!CAN_RUN) return;
  await withCommits([], async (dir, world) => {
    const host = hostOf(world);
    await put(dir, ".claude/settings.json", "{}\n");
    await put(dir, "node_modules/x/index.js", "x\n");
    await put(dir, ".env", "A=1\n");
    await put(dir, "notes.txt", `the key: ${BEGIN} RSA PRIVATE KEY-----\n`);
    for (const named of [".claude/settings.json", "node_modules/x/index.js", ".env"]) {
      const r = await execute(host, [...commitArgs, named]);
      assertEquals(r.code, 1, named);
      assertStringIncludes(r.err, "E-COMMIT-FORBIDDEN");
    }
    assertEquals((await git(dir, "diff", "--cached", "--name-only")).trim(), "", "a refused path is not staged");
    await git(dir, "add", "-f", ".claude/settings.json", "notes.txt");
    const staged = await execute(host, [...commitArgs]);
    assertEquals(staged.code, 1);
    assertStringIncludes(staged.err, ".claude/settings.json");
    assertStringIncludes(staged.err, "notes.txt holds what looks like a private key");
    assertEquals((await git(dir, "log", "--oneline")).trim().split("\n").length, 1, "no commit was made");
  });
});

proves(["0005-repoctl-library-commit-doctor FR-007"], "a stale generator refuses the commit, nothing staged is said, and the preview shows the message and commits nothing", async () => {
  if (!CAN_RUN) return;
  await withCommits([{ id: "readme", out: "out.txt", from: ["src.txt"] }], async (dir, world, generators) => {
    const host = hostOf(world, { generators });
    await put(dir, "src.txt", "1\n");
    const stale = await execute(host, [...commitArgs, "src.txt"]);
    assertEquals(stale.code, 1);
    assertStringIncludes(stale.err, "E-STALE-GENERATED");
    assertStringIncludes(stale.err, "readme");
    assertEquals((await git(dir, "log", "--oneline")).trim().split("\n").length, 1);
    await systemProcess.run(["bun", "gen-readme.mjs"], { cwd: dir });
    const nothing = await execute(host, [...commitArgs]);
    assertStringIncludes(nothing.err, "E-COMMIT-NOTHING");
    const dry = await execute(host, [...commitArgs, "src.txt", "out.txt", "gen-readme.mjs", "--dry-run", "--json"]);
    assertEquals(dry.code, 0, dry.err);
    const doc = JSON.parse(dry.out) as { data: { message: string; files: string[] } };
    assertStringIncludes(doc.data.message, `Claude-Session: ${SESSION}`);
    assertEquals(doc.data.files, ["src.txt", "out.txt", "gen-readme.mjs"]);
    assertEquals((await git(dir, "diff", "--cached", "--name-only")).trim(), "", "the preview stages nothing");
    const made = await execute(host, [...commitArgs, "src.txt", "out.txt", "gen-readme.mjs"]);
    assertEquals(made.code, 0, made.err);
    assertEquals((await git(dir, "log", "--oneline")).trim().split("\n").length, 2);
  });
});

const GOOD: Facts = { git: { works: true, inside: true, origin: true }, installed: true, unlinked: [], node: "v26.13.1", bun: "1.4.4", pinnedBun: "1.4.4", stale: [] };

proves(["0005-repoctl-library-commit-doctor FR-008"], "each thing wrong with a checkout is a finding with its code, in the order to fix it, and nothing wrong is nothing", () => {
  assertEquals(diagnose(GOOD, DOCTOR), []);
  assertEquals(majorOf("v26.13.1"), 26);
  assertEquals(majorOf(undefined), undefined);
  const bad: Facts = { git: { works: true, inside: true, origin: false }, installed: false, unlinked: ["core", "net"], node: "v22.1.0", bun: "1.0.0", pinnedBun: "1.4.4", stale: [] };
  assertEquals(diagnose(bad, DOCTOR).map((f) => `${f.level} ${f.code}`), ["warn E-DOCTOR-GIT", "fail E-DOCTOR-INSTALL", "fail E-DOCTOR-LINKS", "fail E-DOCTOR-NODE", "warn E-DOCTOR-BUN"]);
  assertEquals(diagnose({ ...GOOD, git: { works: false, inside: false, origin: false } }, DOCTOR).map((f) => f.code), ["E-DOCTOR-GIT"]);
  assertEquals(diagnose({ ...GOOD, node: undefined }, DOCTOR).map((f) => f.code), ["E-DOCTOR-NODE"]);
  const fix = diagnose(bad, DOCTOR).find((f) => f.code === "E-DOCTOR-LINKS")?.fix;
  assertEquals(fix, "bun commons/libraries/src/link.ts");
});

proves(["0005-repoctl-library-commit-doctor FR-008"], "the facts of a real checkout are gathered through the ports: a folder with no dependencies and an old Node is found as such", async () => {
  if (!CAN_RUN) return;
  await withCommits([], async (dir, base) => {
    await put(dir, "commons/core/library.ts", `export const library = ${JSON.stringify({ name: "core", level: "L0", verify: "bun run verify", maturity: "stable", version: "0.1.0", exports: ["."] })};\n`);
    const old: Process = { run: (argv, options) => (argv[0] === "node" ? Promise.resolve({ code: 0, stdout: "v22.1.0\n", stderr: "" }) : systemProcess.run(argv, options)) };
    const world: World = { ...base, process: old };
    const facts = await gatherFacts(world, [], DOCTOR);
    assertEquals([facts.git, facts.installed, facts.unlinked, facts.node], [{ works: true, inside: true, origin: false }, false, ["core"], "v22.1.0"]);
    const out = await execute(hostOf(world, { config: { doctor: { minNode: 26, links: { folder: "commons/node_modules/@intellectual-frontiers", fix: ["bun", "commons/libraries/src/link.ts"] } } } }), ["doctor"]);
    assertEquals(out.code, 1);
    for (const code of ["E-DOCTOR-INSTALL", "E-DOCTOR-LINKS", "E-DOCTOR-NODE", "E-DOCTOR-GIT"]) assertStringIncludes(out.err, code);
    assertStringIncludes(out.err, "bun install --frozen-lockfile");
  });
});

proves(["0005-repoctl-library-commit-doctor FR-008"], "the real checkout is in order", async () => {
  if (!CAN_RUN) return;
  const out = await execute(hostOf(systemWorld(CHECKOUT, () => undefined, LIBRARIES)), ["doctor", "--json"], { tier: TIERS.public });
  const doc = JSON.parse(out.out) as { problems: { code: string }[]; data: { node: string | null; installed: boolean } };
  // A job that installed only this library's dependencies has no root `node_modules`: the doctor then says so, which is its answer and not a failure of the test.
  assertEquals(doc.data.installed, await fs.exists(path.join(CHECKOUT, "node_modules")));
  const node26 = majorOf(doc.data.node ?? undefined) !== undefined && (majorOf(doc.data.node ?? undefined) ?? 0) >= 26;
  assertEquals(out.code, node26 && doc.data.installed ? 0 : 1, JSON.stringify(doc.problems));
});

proves(["0005-repoctl-library-commit-doctor FR-003"], "the spec kit of a new library is listed after the last one the configuration of the site lists, once, and a configuration that lists none is refused", () => {
  const source = 'specKits: [\n    { layout: "commons", dir: "commons/a/spec-kit" },\n    { layout: "commons", dir: "commons/b/spec-kit" },\n  ],\n';
  const once = withSpecKit(source, "c", "spec-kit");
  assert(once.kind === "ok");
  assertEquals(once.value, 'specKits: [\n    { layout: "commons", dir: "commons/a/spec-kit" },\n    { layout: "commons", dir: "commons/b/spec-kit" },\n    { layout: "commons", dir: "commons/c/spec-kit" },\n  ],\n');
  assertEquals(withSpecKit(once.value, "c", "spec-kit"), { kind: "ok", value: once.value });
  assertEquals(withSpecKit("specKits: [],\n", "c", "spec-kit").kind, "err");
});

proves(["0005-repoctl-library-commit-doctor FR-010"], "the actors of a commit come from the options and the environment, are refused when malformed, and the session is made from the remote id", () => {
  const WITH = ["issue", "co-author", "session", "prepared-by", "directive", "reviewed-by"];
  const NAMES = { agent: "AI_AGENT", model: "REPOCTL_MODEL" };
  const DIGEST = "a".repeat(64);
  const harness = (name: string): string | undefined => ({ AI_AGENT: "synthetic-harness", REPOCTL_MODEL: "synthetic-model" })[name];
  const nothing = (): string | undefined => undefined;
  // An agent runs the command: Prepared-by is made from the environment, and nobody types it.
  const inferred = actorsOf(WITH, {}, harness, NAMES);
  assert(inferred.kind === "ok" && inferred.value.preparedBy?.kind === "agent" && inferred.value.preparedBy.id === "synthetic-harness");
  const m = messageOf({ issue: TRAILERS.issue, trailers: ["issue", "co-author", "session", "prepared-by", "directive", "reviewed-by"] }, { subject: "S", refs: "10", coAuthor: CO_AUTHOR, session: SESSION, actors: inferred.kind === "ok" ? inferred.value : undefined });
  assertEquals(m.trailers, ["Refs #10", CO_AUTHOR, `Claude-Session: ${SESSION}`, "Prepared-by: synthetic-harness (agent, model synthetic-model reported)"]);
  // No harness and nothing given: no actors, so a human's commit has no actor trailer.
  const human = actorsOf(WITH, {}, nothing, NAMES);
  assert(human.kind === "ok" && human.value.preparedBy === undefined);
  // The options win, the directive and the reviewer are written in order.
  const given = actorsOf(WITH, { preparedBy: "synthetic-person-01 (person)", directive: `work-order-001@1 sha256:${DIGEST}`, reviewedBy: "synthetic-person-02" }, harness, NAMES);
  assert(given.kind === "ok");
  assertEquals(messageOf({ issue: TRAILERS.issue, trailers: WITH.filter((t) => t !== "issue") as never }, { subject: "S", refs: undefined, coAuthor: CO_AUTHOR, session: SESSION, actors: given.kind === "ok" ? given.value : undefined }).trailers.slice(2), ["Prepared-by: synthetic-person-01 (person)", `Directive: work-order-001@1 sha256:${DIGEST}`, "Reviewed-by: synthetic-person-02 (person)"]);
  // A repository that does not list the trailers gets none of them.
  const unlisted = actorsOf(["issue", "co-author", "session"], { directive: "x" }, harness, NAMES);
  assert(unlisted.kind === "ok" && unlisted.value.preparedBy === undefined && unlisted.value.directive === undefined);
  // Malformed values are refused.
  assert(actorsOf(WITH, { preparedBy: "nobody" }, nothing, NAMES).kind === "err");
  assert(actorsOf(WITH, { directive: "work-order" }, nothing, NAMES).kind === "err");
  assert(actorsOf(WITH, { reviewedBy: "synthetic-agent-01 (agent)" }, nothing, NAMES).kind === "err", "only a person reviews");
  // The session address is made from the id a remote session keeps.
  assertEquals(sessionUrlOfRemote("cse_01AbCdEf"), "https://claude.ai/code/session_01AbCdEf");
  assertEquals(sessionUrlOfRemote("abc"), undefined);
  assertEquals(sessionUrlOfRemote(undefined), undefined);
  assertEquals(sessionUrlOfRemote("cse_../x"), undefined);
});
