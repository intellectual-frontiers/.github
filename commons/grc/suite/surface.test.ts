/**
 * Tests of the headless verbs (0007-grc-surface): the branch `grc` with its four verbs over a host that registers a runner, a serializer and a store, run through the commands' own `run`
 * with the context Headless gives a command. The model is checked with Headless' own `modelProblems`.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import { modelProblems, NO_PROGRESS, NO_PROMPT, placedCommands, programOf, type Context, type Outcome } from "@intellectual-frontiers/headless/logical";
import { createRunners } from "@intellectual-frontiers/grc/physical";
import { sqlRunner } from "@intellectual-frontiers/grc/runners/sql";
import { memoryStore } from "@intellectual-frontiers/grc/stores/memory";
import { grcBranch, type GrcHost } from "@intellectual-frontiers/grc/surfaces/headless";
import { standardSerializers } from "../src/standard.ts";
import { aCheck, AT, A1, anException, aRequirement, ex, policyOf, walk } from "./fixtures.ts";


function host(rows: readonly unknown[], store = memoryStore()): GrcHost {
  const runners = createRunners();
  runners.register(sqlRunner({ readOnly: true, query: () => Promise.resolve(rows as never) }));
  return {
    frameworks: [ex],
    crosswalks: [walk],
    policies: [policyOf],
    checks: [aCheck("disk-encrypted", [A1])],
    requirements: [aRequirement("0001-x FR-001", "check", "bun test")],
    exceptions: [anException()],
    subjects: [{ id: "host-1", platform: "linux" }],
    runners,
    serializers: standardSerializers(),
    store,
    now: () => AT,
  };
}

async function run(h: GrcHost, words: readonly string[], options: Record<string, unknown> = {}, mode: "apply" | "dry-run" = "apply"): Promise<Outcome> {
  const program = programOf({ name: "t", summary: "T.", version: "1", children: [grcBranch(h)] });
  const placed = placedCommands(program.children).find((p) => p.id === `grc ${words[0]}`);
  if (placed === undefined) throw new Error(`no command ${words[0]}`);
  const ctx: Context = { program: "t", command: placed.id, facts: placed.facts, mode, verbosity: "calm", interactive: false, progress: NO_PROGRESS, prompt: NO_PROMPT, env: () => undefined, signal: new AbortController().signal };
  return placed.command.run({ kind: "args", options, positionals: words.slice(1), rest: [] } as never, ctx);
}

proves(["0007-grc-surface FR-001"], "the branch has exactly check, assess, explain and evidence, and the model has no defect with the reach required", () => {
  const program = programOf({ name: "t", summary: "T.", version: "1", children: [grcBranch(host([]))] });
  assertEquals(placedCommands(program.children).map((p) => p.id), ["grc check", "grc assess", "grc explain", "grc evidence"]);
  assertEquals(modelProblems(program, { requireReach: true }), []);
});

proves(["0007-grc-surface FR-002"], "check runs the checks, returns the results as data and a problem for each that is not passing, and is a read-only report", async () => {
  const program = programOf({ name: "t", summary: "T.", version: "1", children: [grcBranch(host([]))] });
  const check = placedCommands(program.children).find((p) => p.id === "grc check");
  assertEquals([check?.facts.kind, check?.facts.effect], ["report", "read"]);
  const good = await run(host([]), ["check"]);
  assertEquals(good.problems, []);
  const bad = await run(host([{ disk: "plain" }]), ["check"]);
  assertEquals(bad.problems.map((p) => p.level), ["fail"]);
  assertEquals((bad.data as { results: { status: string }[] }).results.map((r) => r.status), ["fail"]);
  const named = await run(host([]), ["check", "nothing"]);
  assertEquals(named.problems.map((p) => p.code), ["E000-USAGE-CHECK"]);
  const none = await run({ ...host([]), checks: [] }, ["check"]);
  assertEquals(none.hints.length, 1);
  assertEquals(none.problems, []);
});

proves(["0007-grc-surface FR-003"], "assess writes the assessment in the format a registered serializer names, refuses an unknown format, and previews a write under dry-run", async () => {
  const doc = await run(host([{ d: 1 }]), ["assess"]);
  assertStringIncludes(doc.text ?? "", '"kind": "grc.assessment"');
  const sarif = await run(host([{ d: 1 }]), ["assess"], { format: "sarif" });
  assertStringIncludes(sarif.text ?? "", '"version": "2.1.0"');
  const unknown = await run(host([]), ["assess"], { format: "nothing" });
  assertEquals(unknown.problems.map((p) => p.code), ["E000-USAGE-FORMAT"]);
  assertStringIncludes(unknown.problems[0]?.message ?? "", "oscal");
  const dir = await fs.makeTempDir({ prefix: "grc-surface-" });
  const out = path.join(dir, "a.sarif");
  const dry = await run(host([{ d: 1 }]), ["assess"], { format: "sarif", out }, "dry-run");
  assertEquals(await fs.exists(out), false);
  assertStringIncludes(dry.outcomes.join(" "), "would write");
  await run(host([{ d: 1 }]), ["assess"], { format: "sarif", out });
  assertStringIncludes(await fs.readTextFile(out), "2.1.0");
  const program = programOf({ name: "t", summary: "T.", version: "1", children: [grcBranch(host([]))] });
  const facts = placedCommands(program.children).find((p) => p.id === "grc assess")?.facts;
  assertEquals([facts?.kind, facts?.dryRun], ["action", true]);
});

proves(["0007-grc-surface FR-004"], "explain says what a control, policy, check or requirement is and what it maps to, and an unknown id names the nearest", async () => {
  const c = await run(host([]), ["explain", A1]);
  assertStringIncludes(c.text ?? "", "shown by: disk-encrypted");
  assertStringIncludes(c.text ?? "", "disk-policy");
  const p = await run(host([]), ["explain", "disk-policy"]);
  assertStringIncludes(p.text ?? "", "Lost laptops");
  assertStringIncludes((await run(host([]), ["explain", "disk-encrypted"])).text ?? "", "runner sql");
  assertStringIncludes((await run(host([]), ["explain", "0001-x FR-001"])).text ?? "", "verified by check");
  const mapped = await run(host([]), ["explain", "urn:grc:ex:1:B-1"]);
  assertStringIncludes(mapped.text ?? "", "urn:grc:other:2:X-1");
  const unknown = await run(host([]), ["explain", "disk"]);
  assertEquals(unknown.problems.map((x) => x.code), ["E000-USAGE-ID"]);
  assertStringIncludes(unknown.problems[0]?.message ?? "", "disk-encrypted");
});

proves(["0007-grc-surface FR-005"], "evidence lists the store with digests and verify reports each object that does not have its digest", async () => {
  const store = memoryStore();
  const p = await store.put(new TextEncoder().encode("x"), { subject: "host-1", type: "t", mediaType: "text/plain", observedAt: AT });
  const h = host([], store);
  const list = await run(h, ["evidence"]);
  assertStringIncludes(list.text ?? "", p.kind === "ok" ? p.value.digest : "?");
  const good = await run(h, ["evidence", "verify"]);
  assertEquals(good.problems, []);
  store.corrupt(p.kind === "ok" ? p.value.digest : "");
  const bad = await run(h, ["evidence", "verify"]);
  assertEquals(bad.problems.map((x) => [x.level, x.code]), [["fail", "E-EVIDENCE-DIGEST"]]);
  const nostore = await run({ ...h, store: undefined as never }, ["evidence"]);
  assertEquals(nostore.problems.map((x) => x.code), ["E-EVIDENCE-NO-STORE"]);
  assertEquals((await run(h, ["evidence", "frobnicate"])).problems.map((x) => x.code), ["E000-USAGE-WHAT"]);
});

proves(["0007-grc-surface FR-006"], "every verb gives the data of its typed outcome and writes nothing but what it was asked to write", async () => {
  const dir = await fs.makeTempDir({ prefix: "grc-surface-" });
  const before = [...(fs.readDirSync(dir))].length;
  const outcomes = [await run(host([]), ["check"]), await run(host([]), ["explain", A1]), await run(host([]), ["evidence"]), await run(host([]), ["assess"])];
  for (const o of outcomes) assert(o.data !== undefined && o.data !== null);
  assertEquals([...(fs.readDirSync(dir))].length, before);
});
