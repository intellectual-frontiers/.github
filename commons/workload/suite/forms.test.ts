/**
 * Tests of the forms (commons workload 0003-workload-forms): the contract of a form is tiny and closed, the core imports nothing from a form and a form imports nothing from another, and the registry of forms is closed with
 * what is built and what is reserved. The static check reads the sources and the table of the manifest; it needs no machine.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { decodeTable } from "@intellectual-frontiers/kanon";
import { fs, path } from "@intellectual-frontiers/system";
import { AUDIENCES, audienceOf, BUILT_FORM_IDS, CADENCES, FORM_IDS, FORMS, isBuiltForm, OUTCOMES, TRIGGER_KINDS, trigger } from "@intellectual-frontiers/workload/governance";
import { meets } from "@intellectual-frontiers/workload/logical";
import { CONVERGE_SETTINGS, decodeReconcile, RECONCILE_FORM, outcomeOf as reconcileOutcome } from "@intellectual-frontiers/workload/forms/reconcile";
import { decodeRunbook, outcomeOf as runbookOutcome, RESTORE_DRILL, RUNBOOK_FORM, STEP_KINDS } from "@intellectual-frontiers/workload/forms/runbook";
import { decodeWorkload, RECONCILE_RUNNER, RUNBOOK_RUNNER, STARTERS } from "@intellectual-frontiers/workload/physical";
import { library } from "../library.ts";
import { ITEM } from "./kit.ts";

const ITEM_FOR_TEST = ITEM;

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

async function* walk(dir: string): AsyncGenerator<string> {
  for await (const e of fs.readDir(dir)) {
    const p = path.join(dir, e.name);
    if (e.isDirectory) yield* walk(p);
    else if (p.endsWith(".ts")) yield p;
  }
}

/** The module targets a file imports, with the file. */
async function importsOf(folder: string): Promise<readonly { readonly file: string; readonly spec: string }[]> {
  const out: { file: string; spec: string }[] = [];
  for await (const file of walk(path.join(ROOT, folder))) {
    const text = await fs.readTextFile(file);
    for (const m of text.matchAll(/(?:from|import\()\s*"([^"]+)"/gu)) out.push({ file: path.relative(ROOT, file), spec: m[1] ?? "" });
  }
  return out;
}

const names = (form: string): string[] => FORM_IDS.filter((f) => f !== form);

proves(["0003-workload-forms FR-001"], "a form is declared by its id, its closed sum of node kinds, validate, plan, fold and a native runner behind a port, and nothing else", () => {
  assertEquals(Object.keys(RUNBOOK_FORM).sort(), ["fold", "id", "nodeKinds", "plan", "validate"]);
  assertEquals(RUNBOOK_FORM.id, "runbook");
  assertEquals(RUNBOOK_FORM.nodeKinds, STEP_KINDS);
  assertEquals(Object.keys(RUNBOOK_RUNNER).sort(), ["form", "run"]);
  assertEquals(RUNBOOK_RUNNER.form, RUNBOOK_FORM.id);
  assertEquals(Object.keys(RECONCILE_FORM).sort(), Object.keys(RUNBOOK_FORM).sort());
  assertEquals(RECONCILE_RUNNER.form, RECONCILE_FORM.id);
  assertEquals(new Set(STARTERS.map((w) => w.form)), new Set(BUILT_FORM_IDS));
});

proves(["0003-workload-forms FR-002"], "the core imports nothing from a form: no source of the governance or of the shared logical layer names a form, and the table puts no unit of either above a form", async () => {
  for (const folder of ["src/governance", "src/logical"]) {
    for (const i of await importsOf(folder)) {
      if (folder === "src/logical" && i.file.includes("/forms/")) continue;
      assert(!/forms\//u.test(i.spec) && !/\/(runbook|reconcile)$/u.test(i.spec), `${i.file} imports ${i.spec}`);
    }
  }
  const table = decodeTable(library.kanon);
  assert(table.kind === "ok");
  const unit = (folder: string) => table.value.units.find((u) => u.folder === folder);
  assertEquals(unit("src/governance/")?.kind === "layered" && unit("src/governance/")?.mayImport, undefined);
  const shared = unit("src/logical/");
  assert(shared !== undefined && shared.mayImport === undefined, "the shared logical layer has the default row: the layers above it only");
  const forms = unit("src/logical/forms/");
  assert(forms !== undefined && forms.instances === true, "a form is an instance of a unit, so that a form imports no other form");
  assertEquals((forms.mayImport ?? []).map(String), ["src/governance/", "src/logical/"]);
});

proves(["0003-workload-forms FR-003"], "a form imports nothing from another form, in its own folder or by the package entry of the other", async () => {
  for (const form of BUILT_FORM_IDS) {
    const others = names(form);
    let count = 0;
    for (const i of await importsOf(`src/logical/forms/${form}`)) {
      count += 1;
      for (const o of others) assert(!i.spec.includes(`forms/${o}`), `${i.file} imports ${i.spec}`);
    }
    if (form === "runbook") assert(count > 0, "the sources of the form are read");
  }
  for (const i of await importsOf("src/physical/forms")) {
    const own = /src\/physical\/forms\/([a-z]+)\//u.exec(i.file)?.[1] ?? "";
    for (const o of names(own)) assert(!i.spec.includes(`/${o}/`) && !i.spec.endsWith(`forms/${o}`), `${i.file} imports ${i.spec}`);
  }
});

proves(["0003-workload-forms FR-004"], "the forms are a closed registry in the core: those that have code and those reserved, a reserved form has no code and says when to build it", () => {
  assertEquals(FORM_IDS, ["runbook", "reconcile", "graph", "campaign"]);
  assertEquals(BUILT_FORM_IDS, ["runbook", "reconcile", "graph"]);
  for (const id of FORM_IDS) assertEquals(FORMS[id].status === "built", isBuiltForm(id));
  const campaign = FORMS["campaign"];
  assert(campaign.status === "reserved" && campaign.criteria.includes("second"), "campaign");
  assertEquals(isBuiltForm("campaign"), false);
  assertEquals(FORMS["graph"].status, "built");
  for (const form of ["campaign", "teleport", undefined]) {
    const r = decodeWorkload({ form });
    assert(r.kind === "err" && r.error[0]?.code === "E-WL-WORKLOAD-UNKNOWN-FORM", String(form));
  }
  assertEquals(decodeWorkload(JSON.parse(JSON.stringify(RESTORE_DRILL))).kind, "ok");
  assertEquals(decodeWorkload(JSON.parse(JSON.stringify(CONVERGE_SETTINGS))).kind, "ok");
});

proves(["0003-workload-forms FR-005"], "a trigger is a field of every workload, a closed sum of manual, schedule with a cadence, event and alert, and never a form", () => {
  assertEquals(TRIGGER_KINDS, ["manual", "schedule", "event", "alert"]);
  assertEquals(CADENCES, ["hourly", "daily", "weekly", "monthly", "quarterly", "yearly"]);
  for (const t of [{ kind: "manual" }, { kind: "schedule", cadence: "quarterly" }, { kind: "schedule", cadence: "hourly", at: { minute: 43 } }, { kind: "schedule", cadence: "weekly", at: { minute: 17, hour: 3, weekday: 1 } }, { kind: "event", name: "synthetic-event-01" }, { kind: "alert", name: "synthetic-alert-01" }]) assertEquals(trigger(t).kind, "ok");
  for (const t of [{ kind: "cron" }, { kind: "schedule" }, { kind: "schedule", cadence: "minutely" }, { kind: "schedule", cadence: "daily", at: { minute: "7" } }, { kind: "event" }]) assertEquals(trigger(t).kind, "err");
  assertEquals(FORM_IDS.filter((f) => (TRIGGER_KINDS as readonly string[]).includes(f)), []);
  assertEquals(RESTORE_DRILL.trigger.kind, "schedule");
  assertEquals(CONVERGE_SETTINGS.trigger.kind, "schedule");
  const withEvent = { ...JSON.parse(JSON.stringify(RESTORE_DRILL)), trigger: { kind: "event", name: "synthetic-event-01" } };
  assertEquals(decodeRunbook(withEvent).kind, "ok");
  assertEquals(decodeReconcile({ ...JSON.parse(JSON.stringify(CONVERGE_SETTINGS)), trigger: { kind: "alert", name: "synthetic-alert-01" } }).kind, "ok");
  assertEquals(decodeReconcile({ ...JSON.parse(JSON.stringify(CONVERGE_SETTINGS)), trigger: undefined }).kind, "err");
});

proves(["0003-workload-forms FR-006"], "a workload may say the outcome a run is expected to have in three words every form shares, so that a drill or a game day is a workload with a schedule trigger and an expectation", () => {
  assertEquals(OUTCOMES, ["completes", "parks", "fails"]);
  assertEquals(RESTORE_DRILL.expect, { outcome: "completes" });
  assertEquals(meets(RESTORE_DRILL.expect, "completes"), true);
  assertEquals(meets({ outcome: "parks" }, "fails"), false);
  assertEquals(meets(undefined, "parks"), true);
  const finished = (f: "succeeded" | "failed" | "parked" | undefined) => runbookOutcome({ run: ITEM_FOR_TEST, runbook: undefined, steps: {}, attached: [], disposable: true, parked: [], finished: f, refused: [] });
  assertEquals([finished("succeeded"), finished("parked"), finished("failed"), finished(undefined)], ["completes", "parks", "fails", undefined]);
  const converged = (f: "converged" | "failed" | "parked" | undefined) => reconcileOutcome({ run: ITEM_FOR_TEST, loop: undefined, passes: 1, nodes: {}, plan: undefined, approved: [], declined: [], applied: [], planApproved: false, parked: [], finished: f, refused: [] });
  assertEquals([converged("converged"), converged("parked"), converged("failed"), converged(undefined)], ["completes", "parks", "fails", undefined]);
  assertEquals(decodeRunbook({ ...JSON.parse(JSON.stringify(RESTORE_DRILL)), expect: { outcome: "explodes" } }).kind, "err");
});

proves(["0003-workload-forms FR-008"], "a workload and a verb may name an audience of three, `all` where they name none, and a decoder refuses any other", () => {
  assertEquals(AUDIENCES, ["engineer", "compliance", "all"]);
  const plain = decodeRunbook(JSON.parse(JSON.stringify(RESTORE_DRILL)));
  assert(plain.kind === "ok");
  assertEquals(plain.value.audience, undefined);
  assertEquals(audienceOf(plain.value), "all");
  const named = decodeRunbook({ ...JSON.parse(JSON.stringify(RESTORE_DRILL)), audience: "compliance" });
  assert(named.kind === "ok");
  assertEquals(audienceOf(named.value), "compliance");
  assertEquals(decodeRunbook({ ...JSON.parse(JSON.stringify(RESTORE_DRILL)), audience: "everyone" }).kind, "err");
  assertEquals(decodeReconcile({ ...JSON.parse(JSON.stringify(CONVERGE_SETTINGS)), audience: "engineer" }).kind, "ok");
  assertEquals(decodeReconcile({ ...JSON.parse(JSON.stringify(CONVERGE_SETTINGS)), audience: 3 }).kind, "err");
  assertEquals(audienceOf({}), "all");
  assertEquals(audienceOf({ audience: "engineer" }), "engineer");
});

proves(["0003-workload-forms FR-007"], "the form campaign is a named slot with the criterion for building it and has no code: no folder, no entry and no source names it but the registry; the form graph was built by the decision of 0013-form-graph", async () => {
  const campaign = FORMS["campaign"];
  assert(campaign.status === "reserved" && campaign.criteria.length > 40 && campaign.summary.length > 10 && campaign.criteria.includes("sampling"));
  assertEquals(await fs.exists(path.join(ROOT, "src", "logical", "forms", "campaign")), false, "campaign has no folder in the logical layer");
  assertEquals(await fs.exists(path.join(ROOT, "src", "physical", "forms", "campaign")), false, "campaign has no folder in the physical layer");
  assertEquals(library.exports.some((e) => e.includes("campaign")), false);
  const spec = await fs.readTextFile(path.join(ROOT, "spec-kit", "specs", "0003-workload-forms", "spec.md"));
  for (const word of ["`graph`", "`campaign`", "second concrete user", "0013-form-graph", "sampling"]) assert(spec.includes(word), word);
  for (const dir of ["src/governance", "src/logical", "src/physical"]) {
    for (const i of await importsOf(dir)) assert(!/forms\/campaign/u.test(i.spec), `${i.file} imports ${i.spec}`);
  }
});

