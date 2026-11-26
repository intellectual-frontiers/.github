/**
 * Tests of the repository's CI on the graph form (commons workload 0016-ci-on-graph FR-001 to FR-005): the direction of the dependency between workload and libraries, the guard (the generator finds no file different, the
 * golden copies hold), the measure of what is thin and what is not, the parity of the emitter with the typed model for a thin graph, and the record of the workflows (none is thin) and why, kept true against the real definitions.
 *
 * @module
 */
import { synchronize } from "@intellectual-frontiers/libraries/generate-workflows";
import { expr, job, run, use, type Workflow } from "@intellectual-frontiers/libraries/workflows/model";
import { renderWorkflow } from "@intellectual-frontiers/libraries/workflows/render";
import { workflows } from "@intellectual-frontiers/libraries/workflows/definitions";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import { authored, nodeId, parseCite, storeRef, verbId, workloadId } from "@intellectual-frontiers/workload/governance";
import { callsOf, type Graph } from "@intellectual-frontiers/workload/forms/graph";
import { type BlockerKind, thinBlockers, workflowOf } from "@intellectual-frontiers/workload/runners/github-actions";
import { emitPlan, planHash } from "@intellectual-frontiers/workload/physical";
import { must } from "./kit.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const REPO = path.join(ROOT, "..", "..");

async function* walk(dir: string): AsyncGenerator<string> {
  for await (const e of fs.readDir(dir)) {
    if (e.name === "node_modules" || e.name === "dist") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory) yield* walk(p);
    else if (p.endsWith(".ts")) yield p;
  }
}

proves(["0016-ci-on-graph FR-001"], "libraries imports nothing of workload and depends on none of it, and workload imports from libraries only the pure model and writer of workflows", async () => {
  const libs = path.join(REPO, "commons", "libraries");
  for await (const file of walk(libs)) {
    const text = await fs.readTextFile(file);
    for (const m of text.split("\n").filter((l) => !l.trimStart().startsWith("*") && !l.trimStart().startsWith("//")).join("\n").matchAll(/(?:from|import\()\s*"([^"]+)"/gu)) assert(!/^@intellectual-frontiers\/workload(?:\/|$)|commons\/workload/u.test(m[1] ?? ""), `${file} imports ${m[1]}`);
  }
  const lib = await fs.readTextFile(path.join(libs, "package.json"));
  assert(!lib.includes("@intellectual-frontiers/workload"), "libraries has no dependency on workload");
  const manifest = await fs.readTextFile(path.join(libs, "library.ts"));
  for (const e of ["./workflows/model", "./workflows/render", "./workflows/definitions"]) assert(manifest.includes(`"${e}"`), e);
  const seen = new Set<string>();
  for await (const file of walk(path.join(ROOT, "src"))) for (const m of (await fs.readTextFile(file)).split("\n").filter((l) => !l.trimStart().startsWith("*")).join("\n").matchAll(/from "(@intellectual-frontiers\/libraries[^"]*)"/gu)) seen.add(m[1] ?? "");
  assertEquals([...seen].sort(), ["@intellectual-frontiers/libraries/workflows/model", "@intellectual-frontiers/libraries/workflows/render"]);
  for await (const file of walk(path.join(libs, "src", "workflows"))) assert(!(await fs.readTextFile(file)).includes("commons/workload"), file);
});

proves(["0016-ci-on-graph FR-002"], "the generator finds no file of the repository different from what the model makes and the golden copies are the files: the files are the golden copies", async () => {
  const r = synchronize(REPO, false);
  assertEquals(r.problems, []);
  assertEquals(r.stale, []);
  for (const w of workflows()) {
    const golden = await fs.readTextFile(path.join(REPO, "tests", "fixtures", "workflows-golden", `${w.file}.auto.yml`));
    assertEquals(renderWorkflow(w), golden, `${w.file} is its golden copy`);
  }
});

const thick: Workflow = {
  file: "synthetic-thick-01",
  name: "synthetic-thick-01",
  on: { push: {}, workflowDispatch: true },
  jobs: {
    a: job({ runsOn: "windows-latest", timeoutMinutes: 5, when: "always()", outputs: { x: expr("steps.s.outputs.x") }, strategy: { matrix: expr("fromJSON(needs.p.outputs.m)") }, environment: { name: "e", url: "https://example.invalid" }, steps: [use("actions/checkout@v4", { continueOnError: true, with: { "fetch-depth": 0 } }), run("a\nb\n", { id: "s", workingDirectory: "x" }), run("a | b"), run("echo ${{ github.sha }}"), run("x", { when: "cond", env: { K: expr("github.token") } }), use("actions/upload-artifact@v4")] }),
  },
};

proves(["0016-ci-on-graph FR-003"], "the measure names every reason a workflow is not what the emitter writes, from a closed list, and finds none in what the emitter writes", async () => {
  const kinds = new Set(thinBlockers(thick).map((b) => b.kind));
  const expected: readonly BlockerKind[] = ["trigger", "runner", "condition", "continue-on-error", "inline-script", "shell-logic", "expression", "action", "checkout-options", "matrix-from-output", "output", "step-id", "environment-url", "working-directory"];
  assertEquals([...kinds].sort(), [...expected].sort());
  assertEquals(thinBlockers(thick).filter((b) => b.job === "").map((b) => b.kind), ["trigger"]);
  const thin: Workflow = { file: "synthetic-thin-01", name: "synthetic-thin-01", on: { workflowDispatch: true }, jobs: { a: job({ runsOn: "ubuntu-24.04", timeoutMinutes: 5, steps: [use("actions/checkout@v4"), use("./.github/actions/bun"), run("bun commons/libraries/src/link.ts")] }) } };
  assertEquals(thinBlockers(thin), []);
  const graph1 = (await import("@intellectual-frontiers/workload/forms/graph")).SYNTHETIC_GRAPH_01;
  const plan = must(callsOf(graph1, { fleet: (await import("@intellectual-frontiers/workload/forms/graph")).graphFleet }));
  assertEquals(thinBlockers(workflowOf(plan, await planHash(plan), { cli: "workload", trigger: graph1.trigger })), [], "what the emitter writes is thin");
});

proves(["0016-ci-on-graph FR-004"], "for a thin graph the emitter writes exactly the bytes of the typed model of the equivalent workflow", async () => {
  const id = (t: string) => authored(nodeId(t));
  const effect = { store: authored(storeRef("synthetic-evidence-01")), class: "durable", mode: "append", reversible: true } as const;
  const head = (t: string) => ({ id: id(t), title: `Step ${t}`, spec: [authored(parseCite("0016-ci-on-graph FR-004"))] });
  const g: Graph = {
    id: authored(workloadId("synthetic-parity-01")),
    form: "graph",
    title: "Synthetic parity",
    version: "0.1.0",
    summary: "Two jobs, one after the other.",
    given: [],
    needs: [],
    trigger: { kind: "manual" },
    inputs: [],
    stores: [{ ref: authored(storeRef("synthetic-evidence-01")), class: "durable", needs: ["read", "append"] }],
    limit: "append",
    results: [id("second")],
    nodes: [
      { ...head("first"), kind: "verb", after: [], verb: authored(verbId("work.record")), inputs: { order: { kind: "literal", value: "synthetic-order-01" } }, effect },
      { ...head("second"), kind: "verb", after: [id("first")], verb: authored(verbId("work.record")), inputs: { order: { kind: "literal", value: "synthetic-order-02" } }, effect },
    ],
  };
  const p = must(callsOf(g, { fleet: () => undefined }));
  const made = must(await emitPlan(p, authored((await import("@intellectual-frontiers/workload/governance")).runnerId("github-actions")), { trigger: g.trigger, github: { provenance: false, commands: { "work.record": ["bun", "tools/record.ts"] } } }));
  const by = (n: string, order: string, needs: readonly string[]) =>
    job({
      name: `Step ${n}`,
      comment: `step ${n}: verb, agent-acts-human-reviews`,
      runsOn: "ubuntu-24.04",
      timeoutMinutes: 15,
      ...(needs.length === 0 ? {} : { needs }),
      permissions: { contents: "read" },
      steps: [use("actions/checkout@v4"), run(`bun tools/record.ts --in 'order=${order}'`, { name: n, shell: "bash" })],
    });
  const model: Workflow = { file: "synthetic-parity-01", name: "synthetic-parity-01", on: { workflowDispatch: true }, permissions: { contents: "read" }, concurrency: { group: "synthetic-parity-01", cancelInProgress: false }, jobs: { first: by("first", "synthetic-order-01", []), second: by("second", "synthetic-order-02", ["first"]) } };
  assertEquals(made.text, renderWorkflow(model));
  assertEquals(thinBlockers(model), []);
});

/** What the measure finds in the real definitions: the kinds of blocker of each workflow, which the record of the specification names. */
const RECORD: Readonly<Record<string, { readonly jobs: number; readonly kinds: readonly BlockerKind[] }>> = {
  ci: { jobs: 5, kinds: ["action", "checkout-options", "condition", "continue-on-error", "expression", "inline-script", "matrix-from-output", "output", "runner", "step-id", "trigger", "working-directory"] },
  conformance: { jobs: 4, kinds: ["action", "checkout-options", "condition", "continue-on-error", "expression", "inline-script", "runner", "shell-logic", "step-id", "trigger", "working-directory"] },
  evidence: { jobs: 7, kinds: ["action", "checkout-options", "condition", "continue-on-error", "expression", "inline-script", "matrix-from-output", "output", "step-id", "working-directory"] },
  maintenance: { jobs: 2, kinds: ["checkout-options", "condition", "continue-on-error", "inline-script"] },
  release: { jobs: 5, kinds: ["action", "checkout-options", "condition", "continue-on-error", "expression", "inline-script", "matrix-from-output", "output", "step-id", "working-directory"] },
  site: { jobs: 5, kinds: ["action", "checkout-options", "condition", "continue-on-error", "environment-url", "expression", "inline-script", "shell-logic", "step-id", "trigger", "working-directory"] },
  tests: { jobs: 8, kinds: ["action", "checkout-options", "condition", "continue-on-error", "expression", "inline-script", "runner", "shell-logic", "step-id", "trigger", "working-directory"] },
};

proves(["0016-ci-on-graph FR-005"], "no job of the real workflows is thin, and the record of the specification names each workflow and what blocks it", async () => {
  const all = workflows();
  assertEquals(all.map((w) => w.file).sort(), Object.keys(RECORD).sort(), "a workflow the record does not name");
  const spec = await fs.readTextFile(path.join(ROOT, "spec-kit", "specs", "0016-ci-on-graph", "spec.md"));
  assert(spec.includes("No job is thin."));
  for (const w of all) {
    const blockers = thinBlockers(w);
    const jobs = Object.keys(w.jobs);
    assertEquals(jobs.filter((j) => !blockers.some((b) => b.job === j)), [], `${w.file}: a job that could move`);
    assertEquals({ jobs: jobs.length, kinds: [...new Set(blockers.map((b) => b.kind))].sort() }, { jobs: RECORD[w.file]?.jobs, kinds: [...(RECORD[w.file]?.kinds ?? [])].sort() }, w.file);
    assert(spec.includes(`\`${w.file}.auto.yml\``) && new RegExp(`\\| ${w.file} \\| ${jobs.length} \\| 0 \\|`, "u").test(spec), `${w.file} is in the table of the specification`);
  }
});
