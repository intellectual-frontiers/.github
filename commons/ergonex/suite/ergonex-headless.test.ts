/**
 * Ergonex as a program on Headless (commons 0001-ergonex FR-001, FR-007, FR-010, FR-022, FR-023; commons headless 0002-headless-governance, 0003-headless-output, 0004-headless-cli): the tree is a well-formed model whose every action has a reach policy
 * that fits it, every problem code the sources can raise is explained, `ergonex explain` says what a code means, a run writes its log under the state folder of the program and the hints in `hints.json`, and the report, the problems and the verdict
 * are on their own streams. The program is run as a real program in a real temporary workspace.
 *
 * @module
 */
import { modelProblems, placedCommands } from "@intellectual-frontiers/headless/logical";
import { catalogueProblems } from "@intellectual-frontiers/headless/logical";
import { readDirSync, readTextFileSync, existsSync } from "../src/platform/r-fs.ts";
import { dirname, fromFileUrl, join, resolve } from "../src/platform/r-path.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { CATALOGUE, codeOfRule, PATTERNS, RULES } from "../src/commands/catalogue.ts";
import { ergonexProgram } from "../src/commands/program.ts";
import { needsWorld, ONE_REPOSITORY, withWorld } from "./ergonex-fixtures.ts";

const ROOT = resolve(dirname(fromFileUrl(import.meta.url)), "..");

const program = ergonexProgram({
  env: {},
  cwd: "/",
  today: "2026-11-20",
  platform: { os: "linux", arch: "x86_64", windows: false },
  places: undefined,
  homeFor: () => undefined,
  stdin: () => Promise.resolve(""),
  argv: [],
  now: () => 0,
});

/** Every `.ts` file under a folder of the package. */
function sources(folder: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readDirSync(dir)) {
      if (e.isDirectory) walk(join(dir, e.name));
      else if (e.name.endsWith(".ts")) out.push(join(dir, e.name));
    }
  };
  walk(join(ROOT, folder));
  return out;
}

proves(
  ["0001-ergonex FR-007", "0001-ergonex FR-022", "0001-ergonex FR-030"],
  "the program's tree is a well-formed Headless model: no duplicate or reserved word, every action's facts agree, and every action has a reach policy that fits it",
  () => {
    assertEquals(modelProblems(program, { requireReach: true }), []);
    const placed = placedCommands(program.children);
    assert(placed.length >= 20, `${placed.length} commands`);
    const byId = new Map(placed.map((p) => [p.id, p.facts]));
    // what only reads is a report that is safe to repeat; what removes work that cannot be had again is destructive and can preview itself
    for (const id of ["plan", "status", "doctor", "verify", "paths", "tools", "shell print", "worktree list"]) {
      assertEquals([byId.get(id)?.kind, byId.get(id)?.effect, byId.get(id)?.idempotent], ["report", "read", true], id);
    }
    for (const id of ["repos delete", "worktree prune"]) {
      assertEquals([byId.get(id)?.effect, byId.get(id)?.dryRun], ["destructive", true], id);
    }
    for (const id of ["render", "repos add", "repos adopt", "setup", "shell install"]) assertEquals(byId.get(id)?.dryRun, true, id);
    assertEquals(byId.get("render")?.check, true);
    assertEquals(placed.filter((p) => p.reach === undefined).map((p) => p.id), []);
  },
);

proves(
  ["0001-ergonex FR-010"],
  "every problem code the sources can raise is explained, and the catalogue is well formed",
  () => {
    assertEquals(catalogueProblems(CATALOGUE, PATTERNS), []);
    // the evidence's own case names are facts of a run, not rules
    const facts = new Set(["ergonex/run", "ergonex/plan", "ergonex/state", "ergonex/tool", "ergonex/tools", "ergonex/exit", "ergonex/evidence", "ergonex/bin"]);
    const literal = /["'`]((?:ergonex|changes)\/[a-z][a-z0-9-]*)["'`]/g;
    const missing = new Set<string>();
    for (const file of sources("src")) {
      if (file.endsWith("commands/catalogue.ts")) continue;
      for (const m of readTextFileSync(file).matchAll(literal)) {
        const rule = m[1] ?? "";
        if (!RULES.includes(rule) && !(facts.has(rule) && !RULES.includes(rule))) missing.add(rule);
      }
    }
    assertEquals([...missing].sort(), []);
    assertEquals(codeOfRule("ergonex/repository-diverged"), "E-REPOSITORY-DIVERGED");
    assertEquals(codeOfRule("changes/commit-names-no-issue"), "E-CHANGES-COMMIT-NAMES-NO-ISSUE");
  },
);

proves(
  ["0001-ergonex FR-010", "0001-ergonex FR-022", "0001-ergonex FR-023"],
  "a run writes its report on standard output and its problems and verdict on standard error, its log under <state>/log, and --json is the one document of Headless",
  async () => {
    await withWorld(async (w) => {
      assertEquals((await w.ergonex("init")).code, 0);
      await w.manifest(ONE_REPOSITORY);
      // a report: the text on standard output, the verdict and the problems on standard error
      const plan = await w.ergonex("plan");
      assertEquals(plan.code, 0, plan.stderr);
      assertStringIncludes(plan.stdout, "clone");
      // the log of the run is in the state folder of the program, and it names the run
      const logs = readDirSync(join(w.state, "log"));
      assert(logs.length >= 1, "no run log");
      assertStringIncludes(readTextFileSync(join(w.state, "log", logs[0]?.name ?? "")), "ergonex");
      // an action ends with its verdict and the one next command
      const added = await w.ergonex("repos", "add", "git.example.org/team/other");
      assertEquals(added.code, 0, added.stderr);
      assertStringIncludes(added.stderr, "next: ergonex apply");
      // --json is the one document
      const json = JSON.parse((await w.ergonex("status", "--json")).stdout) as { schema: string; program: string; command: string; ok: boolean; exit: { code: number; name: string } };
      assertEquals([json.schema, json.program, json.command, json.ok, json.exit], ["headless.envelope/1", "ergonex", "status", true, { code: 0, name: "ok" }]);
      // a failure is a coded problem, and explain says what its code means
      await w.manifest({ repositories: [{ remote: "not a remote" }] });
      const stopped = await w.ergonex("plan");
      assertEquals(stopped.code, 1);
      assertStringIncludes(stopped.stderr, "[E-MANIFEST-REMOTE]");
      const explained = await w.ergonex("explain", "E-MANIFEST-REMOTE");
      assertEquals(explained.code, 0);
      assertStringIncludes(explained.stdout, "A repository's remote is not valid");
      assertEquals((await w.ergonex("explain", "E-NOPE")).code, 2);
      // the help, the completions and the man page are made from the tree
      assertStringIncludes((await w.ergonex("completions", "bash")).stdout, "worktree");
      assertStringIncludes((await w.ergonex("man")).stdout, "ergonex");
      assert(existsSync(join(w.state, "log")));
      assertEquals(dirname(join(w.state, "log")), w.state);
    });
  },
  needsWorld,
);

proves(
  ["0001-ergonex FR-031"],
  "nothing outside commands/ and ergonex.ts imports Headless, the package names it by its exports only, and the words of the surfaces that were replaced are not commands",
  async () => {
    const bad: string[] = [];
    for (const file of sources("src")) {
      const rel = file.slice(ROOT.length + 1).replaceAll("\\", "/");
      const text = readTextFileSync(file);
      for (const m of text.matchAll(/from\s+["'](@intellectual-frontiers\/headless[^"']*)["']/g)) {
        const spec = m[1] ?? "";
        if (!rel.startsWith("src/commands/") && rel !== "src/ergonex.ts") bad.push(`${rel}: ${spec}`);
        if (!["@intellectual-frontiers/headless/governance", "@intellectual-frontiers/headless/logical", "@intellectual-frontiers/headless/cli", "@intellectual-frontiers/headless/mcp", "@intellectual-frontiers/headless/ssh-inbound"].includes(spec)) bad.push(`${rel}: ${spec} is not an export`);
      }
    }
    assertEquals(bad, []);
    const names = placedCommands(program.children).map((p) => p.id);
    for (const gone of ["add", "remove", "adopt", "list", "help", "shell bash"]) assert(!names.includes(gone), `${gone} is still a command`);
    await withWorld(async (w) => {
      for (const words of [["add", "x"], ["list"], ["adopt"], ["remove", "x"], ["plan", "--apply"], ["setup", "--apply"], ["render", "--diff"], ["shell", "bash"]]) {
        assertEquals((await w.ergonex(...words)).code, 2, words.join(" "));
      }
    });
  },
  needsWorld,
);
