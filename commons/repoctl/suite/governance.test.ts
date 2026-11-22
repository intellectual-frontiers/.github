/**
 * Tests of the Governance layer of Repoctl (commons repoctl 0002-repoctl-governance FR-001 to FR-006): the identities and their smart constructors, the table of verbs and that no verb contradicts its facts or its reach, the ladder of
 * tiers, the problem codes and their explanations, the table of generators (and that every generator of the repository is in it) and the table of checks.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { actionProblems, defineAction, defineReach, isProblemCode as isHeadlessCode, reachProblems, tierGate } from "@intellectual-frontiers/headless/governance";
import { catalogueProblems } from "@intellectual-frontiers/headless/logical";
import { fs, path } from "@intellectual-frontiers/system";
import {
  CATALOGUE,
  isProblemCode,
  LADDER,
  parseGitRef,
  parseIssueNumber,
  parseLibraryName,
  parseSemver,
  parseSessionUrl,
  parseSubject,
  PROBLEM_CODES,
  tierOf,
  TIER_IDS,
  TIERS,
  VERBS,
  verbIds,
  type VerbId,
  type Config,
} from "@intellectual-frontiers/repoctl/governance";
import { loadConfigFile } from "@intellectual-frontiers/repoctl/physical";
import { ROOT_INSTALLED } from "./world.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "../../..");

proves(["0002-repoctl-governance FR-001"], "each identity is made only by its constructor, which says why a text is not one", () => {
  assertEquals(parseLibraryName("repoctl").kind, "ok");
  for (const bad of ["Repoctl", "9lives", "a_b", "", "a".repeat(61)]) assertEquals(parseLibraryName(bad).kind, "err", bad);
  for (const good of ["1.2.3", "0.1.0-rc.1", "10.20.30+build.5"]) assertEquals(parseSemver(good).kind, "ok", good);
  for (const bad of ["1.2", "latest", "^1.2.3", "01.2.3", "1.2.3."]) {
    const r = parseSemver(bad);
    assert(r.kind === "err" && r.error.includes(bad), bad);
  }
  assertEquals([parseIssueNumber("10").kind, parseIssueNumber("#10").kind, parseIssueNumber("0").kind, parseIssueNumber("ten").kind], ["ok", "ok", "err", "err"]);
  assertEquals([parseSessionUrl("https://claude.ai/code/session_x").kind, parseSessionUrl("http://claude.ai/x").kind, parseSessionUrl("https://user:pw@claude.ai/x").kind, parseSessionUrl("").kind], ["ok", "err", "err", "err"]);
  assertEquals([parseSubject("Add the doctor").kind, parseSubject("Ends with a stop.").kind, parseSubject("two\nlines").kind, parseSubject(" padded").kind, parseSubject("x".repeat(101)).kind, parseSubject("").kind], ["ok", "err", "err", "err", "err", "err"]);
  assertEquals([parseGitRef("origin/main").kind, parseGitRef("feature/x").kind, parseGitRef("-x").kind, parseGitRef("a b").kind, parseGitRef("a..b").kind, parseGitRef("x.lock").kind, parseGitRef("").kind], ["ok", "ok", "err", "err", "err", "err", "err"]);
});

proves(["0002-repoctl-governance FR-002"], "every verb is in the table and no verb contradicts its facts or its reach", () => {
  const ids = verbIds();
  assertEquals([...ids].sort(), (Object.keys(VERBS) as VerbId[]).sort());
  assertEquals(new Set(ids).size, ids.length);
  for (const id of ids) {
    const f = VERBS[id];
    assertEquals(f.id, id);
    assert(f.summary.trim() !== "", `${id} has a summary`);
    const facts = defineAction({ id, summary: f.summary, kind: f.kind, effect: f.effect, idempotent: f.idempotent, dryRun: f.dryRun, check: f.check, humanOnly: f.humanOnly, tier: TIERS[f.tier] });
    assertEquals(actionProblems(facts), [], `${id} facts`);
    const reach = defineReach({ channels: f.channels, readOnly: f.effect === "read", idempotent: f.idempotent, confirmation: f.confirmation });
    assertEquals(reachProblems(facts, reach), [], `${id} reach`);
  }
  assertEquals(VERBS["release publish"].effect, "destructive");
  assertEquals(VERBS["release publish"].confirmation, "person");
  assertEquals(VERBS["release publish"].humanOnly, ["confirm"]);
});

proves(["0002-repoctl-governance FR-003"], "the ladder has three tiers and each verb is at its tier", () => {
  assertEquals(TIER_IDS, ["public", "contributor", "releaser"]);
  assertEquals(LADDER.ladder.map(String), ["public", "contributor", "releaser"]);
  assertEquals(String(LADDER.default), "contributor");
  assertEquals(tierOf("releaser"), TIERS.releaser);
  assertEquals(tierOf("administrator"), undefined);
  const seen = (verb: VerbId, held: keyof typeof TIERS): boolean => tierGate(LADDER, TIERS[VERBS[verb].tier], TIERS[held]).kind === "visible";
  assertEquals(seen("release publish", "contributor"), false);
  assertEquals(seen("release publish", "releaser"), true);
  assertEquals(seen("sync", "public"), false);
  assertEquals(seen("sync", "contributor"), true);
  for (const id of verbIds()) if (VERBS[id].effect === "read") assertEquals(VERBS[id].tier, "public", id);
  for (const id of ["sync", "merge", "commit", "new library", "release apply"] as const) assertEquals(VERBS[id].tier, "contributor", id);
});

proves(["0002-repoctl-governance FR-004"], "every code has an explanation and the catalogue is valid", () => {
  assertEquals(new Set(PROBLEM_CODES).size, PROBLEM_CODES.length);
  assertEquals([...PROBLEM_CODES].sort(), Object.keys(CATALOGUE).sort());
  for (const c of PROBLEM_CODES) {
    assert(isProblemCode(c) && isHeadlessCode(c), `${c} is a code of the shape Headless accepts`);
    const e = CATALOGUE[c];
    for (const field of [e.title, e.what, e.why, e.fix]) assert(field.trim() !== "", `${c} has every part`);
  }
  assertEquals(isProblemCode("E-NOPE"), false);
  assertEquals(catalogueProblems(CATALOGUE), []);
});

/** The generators of the repository that are programs with a `--check`: the `generate-*.ts` of the tools and the four generators of the libraries. */
async function generatorFiles(): Promise<readonly string[]> {
  const out: string[] = [];
  const commons = path.join(ROOT, "commons");
  for (const lib of await fs.listDirs(commons)) {
    const tools = path.join(commons, lib, "tools");
    if (!(await fs.exists(tools))) continue;
    for (const f of await fs.listFiles(tools, ".ts")) if (f.startsWith("generate-")) out.push(`commons/${lib}/tools/${f}`);
  }
  return out;
}

/** The repository's own configuration, loaded as the host loads it. */
async function realConfig(): Promise<Config> {
  const loaded = await loadConfigFile(path.join(ROOT, "repoctl.config.ts"));
  if (loaded.kind === "err") throw new Error(loaded.error.message);
  return loaded.value.config;
}

proves(["0002-repoctl-governance FR-005"], "the generators of the repository's configuration name a command, inputs and outputs for each, and every generator with a --check of the repository is in it", async () => {
  const { generators } = await realConfig();
  assertEquals(new Set(generators.map((g) => g.id)).size, generators.length);
  const programs = generators.map((g) => (g.run.kind === "program" ? g.run.argv[1] : undefined));
  for (const g of generators) {
    assert(g.run.kind === "program" && g.inputs.length > 0 && g.outputs.length > 0, `${g.id} says its command, inputs and outputs`);
    const program = g.run.kind === "program" ? g.run.argv[1] : undefined;
    assert(await fs.exists(path.join(ROOT, program ?? "")), `${g.id}: ${program} is a program of the repository`);
  }
  const commands = new Set(programs);
  // generate-dpv reads a CSV from the network, so it is no generator of an offline sync
  for (const f of await generatorFiles()) if (!f.endsWith("generate-dpv.ts")) assert(commands.has(f), `${f} is a generator and is not in the table`);
  for (const f of ["commons/libraries/src/libraries.ts", "commons/libraries/src/readme.ts", "commons/libraries/src/license.ts", "commons/libraries/src/oscal-register.ts", "commons/libraries/src/generate-ontology.ts", "commons/libraries/src/generate-workflows.ts"])
    assert(commands.has(f), `${f} is in the table`);
});

proves(["0002-repoctl-governance FR-006"], "the checks of the repository's configuration have a command and a code for each", async () => {
  const { checks } = await realConfig();
  assertEquals(checks.map((c) => c.id), ["specs", "rules", "accepted-findings", "versions", "types", "tools-types"]);
  for (const c of checks) {
    const program = c.run.kind === "program" ? c.run.argv[1] : undefined;
    // the compiler of the root is the root's install, which a library job has not made
    if (program?.startsWith("node_modules/") !== true || ROOT_INSTALLED) assert(await fs.exists(path.join(ROOT, program ?? "")), `${c.id}: ${program} is a program of the repository`);
    assert(isProblemCode(c.code), c.code);
  }
});
