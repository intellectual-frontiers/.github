/**
 * The generic host on a fixture repository with a minimal `repoctl.config.ts` that is no repository of ours (commons repoctl 0009-repoctl-config FR-002 to FR-005; 0010-repoctl-host FR-001, FR-002): `sync --check`, `check`, `commit`, `merge`
 * and `hygiene` work from the configuration alone, a configuration that is missing or wrong is its typed problem, the capabilities turn verbs on and off, and the source of the host names no path of the repository of commons.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { main } from "@intellectual-frontiers/repoctl";
import { CAN_RUN, CHECKOUT, generatorScript, git, put } from "./world.ts";

const GOVERNANCE = path.join(CHECKOUT, "commons/repoctl/src/governance/mod.ts");
const SESSION = "https://claude.example/session/1";

/** The text of the configuration of the fixture: one generator, one check, a hygiene policy of its own, the docs verbs and no capability. */
function configText(extra = ""): string {
  return `import { defineConfig } from ${JSON.stringify(GOVERNANCE)};
export default defineConfig({
  repo: "acme/fixture",
  commit: { identity: { name: "Fix Ture", email: "fix@example.test" }, issue: { prefix: "Refs #", required: false }, trailers: ["issue", "co-author", "session"] },
  generators: [{ id: "out", command: ["bun", "gen.mjs"], inputs: ["a.txt", "b.txt"], outputs: ["out.txt"] }],
  checks: [{ id: "notes", summary: "The notes are in order.", command: ["bun", "notes.mjs"] }],
  hygiene: { scope: "@acme/", gitSources: ["acme/platform"], pathSegment: "platform", sourceMarker: "" },
  docs: {},${extra}
});
`;
}

type Out = { readonly code: number; readonly out: string; readonly err: string };

async function run(cwd: string, argv: readonly string[], env: Readonly<Record<string, string>> = {}): Promise<Out> {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd, env, out: (t) => void out.push(t), err: (t) => void err.push(t) });
  return { code, out: out.join(""), err: err.join("") };
}

/** A real Git repository holding the fixture's files, committed. */
async function withFixture<T>(use: (dir: string) => Promise<T>, config = configText()): Promise<T> {
  return await fs.withTempDir(async (dir) => {
    await git(dir, "init", "-q");
    await put(dir, "repoctl.config.ts", config);
    await put(dir, "gen.mjs", generatorScript("out.txt", ["a.txt", "b.txt"]));
    await put(dir, "notes.mjs", "process.exit(0);\n");
    await put(dir, "a.txt", "1\n");
    await put(dir, "b.txt", "1\n");
    await git(dir, "add", ".");
    await git(dir, "commit", "-q", "-m", "Start");
    return await use(dir);
  });
}

proves(["0009-repoctl-config FR-003"], "sync --check names the stale generator, sync makes it, a second check ends with 0, and check reports a section for the generator and for the named check", async () => {
  if (!CAN_RUN) return;
  await withFixture(async (dir) => {
    const stale = await run(dir, ["sync", "--check"]);
    assertEquals(stale.code, 1, stale.err);
    assertStringIncludes(stale.err, "E-STALE-GENERATED");
    assertStringIncludes(stale.out + stale.err, "bun gen.mjs");
    assertEquals((await run(dir, ["sync"])).code, 0);
    assertEquals(await fs.readTextFile(path.join(dir, "out.txt")), "a=1 b=1\n");
    assertEquals((await run(dir, ["sync", "--check"])).code, 0);
    const checked = await run(dir, ["check", "--json"]);
    assertEquals(checked.code, 0, checked.err);
    const ids = (JSON.parse(checked.out) as { data: { sections: { id: string }[] } }).data.sections.map((s) => s.id);
    assertEquals(ids, ["generator:out", "notes"]);
    await put(dir, "notes.mjs", 'console.error("a note is wrong");\nprocess.exit(1);\n');
    const failing = await run(dir, ["check"]);
    assertEquals(failing.code, 1);
    assertStringIncludes(failing.err, "E-CHECK-FAILED");
    assertStringIncludes(failing.err, "a note is wrong");
  });
});

proves(["0009-repoctl-config FR-003"], "a generator that is a typed function is run and checked through the function", async () => {
  if (!CAN_RUN) return;
  const typed = `import { defineConfig } from ${JSON.stringify(GOVERNANCE)};
import { existsSync, writeFileSync } from "node:fs";
export default defineConfig({
  repo: "acme/fixture",
  commit: { identity: { name: "Fix Ture", email: "fix@example.test" } },
  generators: [{
    id: "made",
    command: async ({ repo }) => { writeFileSync(repo + "/made.txt", "made\\n"); return { code: 0, stdout: "", stderr: "" }; },
    check: async ({ repo }) => ({ code: existsSync(repo + "/made.txt") ? 0 : 1, stdout: "", stderr: "made.txt is missing" }),
    outputs: ["made.txt"],
  }],
});
`;
  await withFixture(async (dir) => {
    assertEquals((await run(dir, ["sync", "--check"])).code, 1);
    assertEquals((await run(dir, ["sync"])).code, 0);
    assert(await fs.exists(path.join(dir, "made.txt")));
    assertEquals((await run(dir, ["sync", "--check"])).code, 0);
  }, typed);
});

proves(["0009-repoctl-config FR-004"], "commit makes the commit as the configuration's identity with its trailers in order, the co-author from the flag or the variable, and refuses a path the configuration forbids", async () => {
  if (!CAN_RUN) return;
  await withFixture(async (dir) => {
    await run(dir, ["sync"]);
    await put(dir, "c.txt", "c\n");
    const made = await run(dir, ["commit", "-m", "Add c", "--refs", "212", "--session", SESSION, "--co-author", "Co-Authored-By: Pair <pair@example.test>", "c.txt", "out.txt"]);
    assertEquals(made.code, 0, made.err);
    assertEquals((await git(dir, "log", "-1", "--format=%an <%ae>|%cn <%ce>")).trim(), "Fix Ture <fix@example.test>|Fix Ture <fix@example.test>");
    assertEquals((await git(dir, "log", "-1", "--format=%B")).trim(), `Add c\n\nRefs #212\nCo-Authored-By: Pair <pair@example.test>\nClaude-Session: ${SESSION}`);
    await put(dir, "d.txt", "d\n");
    const viaEnv = await run(dir, ["commit", "-m", "Add d", "d.txt"], { CLAUDE_SESSION_URL: SESSION, REPOCTL_CO_AUTHOR: "Co-Authored-By: Env <env@example.test>" });
    assertEquals(viaEnv.code, 0, viaEnv.err);
    assertStringIncludes(await git(dir, "log", "-1", "--format=%B"), "Co-Authored-By: Env <env@example.test>");
    await put(dir, ".env", "KEY=value\n");
    const refused = await run(dir, ["commit", "-m", "Add env", ".env"], { CLAUDE_SESSION_URL: SESSION });
    assertEquals(refused.code, 1);
    assertStringIncludes(refused.err, "E-COMMIT-FORBIDDEN");
    const noSession = await run(dir, ["commit", "-m", "No session", "c.txt"]);
    assertEquals(noSession.code, 2);
    assertStringIncludes(noSession.err, "E-COMMIT-SESSION");
  });
});

proves(["0009-repoctl-config FR-003"], "merge makes a conflicted generated file again from the configuration's generators and commits the merge as its identity", async () => {
  if (!CAN_RUN) return;
  await withFixture(async (dir) => {
    await run(dir, ["sync"]);
    await git(dir, "add", ".");
    await git(dir, "commit", "-q", "-m", "Generated");
    await git(dir, "checkout", "-q", "-b", "feature");
    await put(dir, "a.txt", "2\n");
    await run(dir, ["sync"]);
    await git(dir, "commit", "-q", "-am", "Feature");
    await git(dir, "checkout", "-q", "main");
    await put(dir, "b.txt", "3\n");
    await run(dir, ["sync"]);
    await git(dir, "commit", "-q", "-am", "Main");
    const merged = await run(dir, ["merge", "feature"]);
    assertEquals(merged.code, 0, merged.err + merged.out);
    assertEquals(await fs.readTextFile(path.join(dir, "out.txt")), "a=2 b=3\n");
    assertEquals((await git(dir, "log", "-1", "--format=%an")).trim(), "Fix Ture");
    assertEquals((await run(dir, ["sync", "--check"])).code, 0);
  });
});

proves(["0009-repoctl-config FR-005"], "hygiene reads the policy of the configuration: its scope, its Git sources and its path segment", async () => {
  if (!CAN_RUN) return;
  await withFixture(async (dir) => {
    await put(dir, "package.json", JSON.stringify({ name: "app", dependencies: { "@acme/core": "1.0.0" } }));
    await put(dir, "bun.lock", '{ "lockfileVersion": 1, "packages": { "@acme/core": ["@acme/core@1.0.0", "", {}, "x"] } }');
    assertEquals((await run(dir, ["hygiene"])).code, 0);
    await put(dir, "package.json", JSON.stringify({ name: "app", dependencies: { "@acme/core": "github:acme/platform#abc", "@acme/net": "link:../platform/net" } }));
    const found = await run(dir, ["hygiene"]);
    assertEquals(found.code, 1);
    assertStringIncludes(found.out + found.err, "E-HYGIENE-GIT");
    assertStringIncludes(found.out + found.err, "E-HYGIENE-PATH");
  });
});

proves(["0009-repoctl-config FR-002"], "the configuration is found above the working folder, and its absence, its failure to load and its invalidity are each their typed problem", async () => {
  if (!CAN_RUN) return;
  await withFixture(async (dir) => {
    await fs.mkdir(path.join(dir, "deep/er"), { recursive: true });
    assertEquals((await run(path.join(dir, "deep/er"), ["sync", "--check"])).code, 1, "it ran in the folder of the file, where out.txt is stale");
    await put(dir, "other.config.ts", configText().replace('"acme/fixture"', '"acme/other"'));
    assertEquals((await run(dir, ["--config", "other.config.ts", "check"])).code, 1);
    await put(dir, "bad.config.ts", "export default 42;\n");
    const load = await run(dir, ["--config", "bad.config.ts", "check"]);
    assertEquals(load.code, 3);
    assertStringIncludes(load.err, "E-CONFIG-LOAD");
    await put(dir, "broken.config.ts", "this is not typescript (\n");
    assertStringIncludes((await run(dir, ["--config", "broken.config.ts", "check"])).err, "E-CONFIG-LOAD");
    await put(dir, "wrong.config.ts", configText().replace('command: ["bun", "notes.mjs"]', 'command: ["bun", "notes.mjs"] }, { id: "notes", command: ["x"]'));
    const invalid = await run(dir, ["--config", "wrong.config.ts", "check"]);
    assertEquals(invalid.code, 3);
    assertStringIncludes(invalid.err, "E-CONFIG-INVALID");
    assertStringIncludes(invalid.err, "used twice");
    const missing = await run(dir, ["--config", "nothing.config.ts", "check"]);
    assertEquals(missing.code, 3);
    assertStringIncludes(missing.err, "E-CONFIG-MISSING");
  });
  await fs.withTempDir(async (dir) => {
    const none = await run(dir, ["check"]);
    assertEquals(none.code, 3);
    assertStringIncludes(none.err, "E-CONFIG-MISSING");
    const doctor = await run(dir, ["doctor"]);
    assertStringIncludes(doctor.out + doctor.err, "E-CONFIG-MISSING");
    assertEquals((await run(dir, ["--help"])).code, 0);
  });
});

proves(["0010-repoctl-host FR-002"], "a capability that is off has no verb: it is not in the help and running it ends with 2; the flags turn release, status, new library and prove on, and the docs verbs and hygiene follow their settings", async () => {
  if (!CAN_RUN) return;
  await withFixture(async (dir) => {
    const help = (await run(dir, ["--help"])).out;
    for (const on of ["check", "sync", "merge", "commit", "doctor", "hygiene", "docs"]) assert(new RegExp(`^\\s+${on}\\b`, "m").test(help), `${on} is listed`);
    for (const off of ["release", "status", "new", "prove"]) assert(!new RegExp(`^\\s+${off}\\b`, "m").test(help), `${off} is not listed`);
    assertEquals((await run(dir, ["release", "plan"])).code, 2);
    assertEquals((await run(dir, ["status"])).code, 2);
  });
  await withFixture(
    async (dir) => {
      const help = (await run(dir, ["--help"])).out;
      for (const on of ["release", "status", "new", "prove"]) assert(new RegExp(`^\\s+${on}\\b`, "m").test(help), `${on} is listed`);
      assert(!/^\s+hygiene\b/m.test(help), "no hygiene policy, no hygiene verb");
      assert(!/^\s+docs\b/m.test(help), "no docs settings, no docs verbs");
    },
    configText().replace('  hygiene: { scope: "@acme/", gitSources: ["acme/platform"], pathSegment: "platform", sourceMarker: "" },\n  docs: {},', '  capabilities: { release: true, status: true, newLibrary: true, prove: true },\n  libraries: { folder: "libs" },'),
  );
  await withFixture(
    async (dir) => {
      const r = await run(dir, ["check"]);
      assertEquals(r.code, 3);
      assertStringIncludes(r.err, "need libraries");
    },
    configText().replace("  docs: {},", "  capabilities: { release: true },"),
  );
});

proves(["0010-repoctl-host FR-001"], "the source of the host names no path of the repository of commons and no scope of it outside the capabilities that read its manifests", async () => {
  const CAPABILITIES = new Set(["src/logical/scaffold.ts", "src/logical/prove.ts", "src/logical/select.ts", "src/logical/surface.ts", "src/governance/proof.ts", "src/physical/prove.ts", "src/physical/prove-run.ts", "src/physical/tests.ts", "src/physical/verbs/prove.ts", "src/physical/verbs/releasing.ts", "src/physical/verbs/library.ts", "src/physical/adapters.ts", "src/logical/publish.ts", "src/logical/status.ts", "src/logical/constants.ts"]);
  const root = path.join(CHECKOUT, "commons/repoctl");
  const found: string[] = [];
  for (const rel of await fs.walkFiles(path.join(root, "src"))) {
    if (!rel.endsWith(".ts") || CAPABILITIES.has(`src/${rel}`)) continue;
    const lines = (await fs.readTextFile(path.join(root, "src", rel))).split("\n");
    for (const [i, line] of lines.entries()) {
      const code = line.trim();
      if (code.startsWith("*") || code.startsWith("//") || code.startsWith("/*")) continue;
      if (/["'`]commons\/|intellectual-frontiers\/\.github/.test(code)) found.push(`src/${rel}:${i + 1}: ${code.slice(0, 90)}`);
    }
  }
  assertEquals(found, []);
});
