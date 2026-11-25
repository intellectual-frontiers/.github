/**
 * Workload, the pattern of operated work (commons 0040-workload-pattern): a workload is a unit of operated work, the pattern is Kanon with a core that imports no form, forms as instances of a logical unit, executors behind
 * ports and dialects as instances of a physical unit, the form, the dialect and the trigger are three axes, a form is declared by a tiny contract and built by the rule of two, the core states what is shared, and the
 * library of the pattern is a member of the patterns metapackage at an exact version. Each rule is read from the real library.
 *
 * @module
 */
import { path } from "../commons/system/src/mod.ts";
import { assert, assertEquals, proves } from "../commons/test/src/test.ts";
import { findings as hostFindings, readTable } from "../commons/kanon/src/host.ts";
import { readLibraries } from "../commons/libraries/src/libraries.ts";
import { dependenciesOf, membersOf } from "../commons/libraries/src/metapackages.ts";
import * as governance from "../commons/workload/src/governance/mod.ts";
import { RECONCILE_FORM } from "../commons/workload/src/logical/forms/reconcile/mod.ts";
import { RUNBOOK_FORM } from "../commons/workload/src/logical/forms/runbook/mod.ts";

const REPO = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const LIBRARY = path.join(REPO, "commons", "workload");

proves(["0040-workload-pattern FR-001"], "a workload is a unit of operated work, not running software, in the terms of the library and in the words of the specification", () => {
  assert(governance.DEFINITIONS.workload.startsWith("A unit of operated work, not running software"));
  assert(governance.TERMS.includes("workload") && governance.TERMS.includes("form") && governance.TERMS.includes("trigger"));
  assert(governance.DEFINITIONS.autonomy.includes("derived from its effect and never declared"));
  assert(governance.DEFINITIONS.verb.includes("deterministic"));
});

proves(["0040-workload-pattern FR-002"], "the library is built to Kanon with a core, forms and dialects as instances and executors in the physical layer, and the shared checker finds nothing in its real tree", () => {
  const read = readTable(LIBRARY);
  assertEquals(read.kind, "ok");
  const found = hostFindings(LIBRARY);
  assert(found.kind === "ok", "the tree is read");
  assertEquals(found.value.map((f) => `${f.rule} ${f.file}`), []);
  const raw = read.kind === "ok" ? read.value : undefined;
  assert(raw !== undefined);
  const layered = (folder: string) => {
    const u = raw.units.find((x) => String(x.folder) === folder);
    return u?.kind === "layered" ? u : undefined;
  };
  assertEquals(layered("src/governance/")?.layer, "governance");
  assertEquals(layered("src/logical/")?.layer, "logical");
  assertEquals(layered("src/logical/forms/")?.instances, true);
  assertEquals(layered("src/physical/dialects/")?.instances, true);
  assertEquals(layered("src/physical/")?.layer, "physical");
});

proves(["0040-workload-pattern FR-003"], "the form, the dialect and the trigger are three axes: no dialect is a form and no trigger is a form", () => {
  const dialects = governance.DIALECTS.list().map((d) => d.id as string);
  assertEquals(dialects.filter((d) => (governance.FORM_IDS as readonly string[]).includes(d)), []);
  assertEquals(governance.TRIGGER_KINDS.filter((t) => (governance.FORM_IDS as readonly string[]).includes(t)), []);
  assertEquals(dialects.filter((d) => (governance.TRIGGER_KINDS as readonly string[]).includes(d)), []);
  assert(governance.DEFINITIONS.dialect.includes("never a form") && governance.DEFINITIONS.trigger.includes("never a form"));
});

proves(["0040-workload-pattern FR-004"], "a form is declared by one tiny contract: the two forms with code have exactly its keys", () => {
  const keys = ["fold", "id", "nodeKinds", "plan", "validate"];
  assertEquals(Object.keys(RUNBOOK_FORM).sort(), keys);
  assertEquals(Object.keys(RECONCILE_FORM).sort(), keys);
  assert(RUNBOOK_FORM.nodeKinds.length === 8 && RECONCILE_FORM.nodeKinds.length === 6);
});

proves(["0040-workload-pattern FR-005"], "two forms have code and two are reserved with the criterion for building them", () => {
  assertEquals(governance.BUILT_FORM_IDS, ["runbook", "reconcile"]);
  for (const id of ["graph", "campaign"] as const) {
    const f = governance.FORMS[id];
    assert(f.status === "reserved" && f.criteria.includes("second") || f.status === "reserved" && f.criteria.includes("two"), id);
  }
});

proves(["0040-workload-pattern FR-006"], "the core exports what every form shares and no form", () => {
  const names = Object.keys(governance);
  for (const shared of ["AUTONOMY_TABLE", "STORE_CLASSES", "MODES", "GATE_ACTIONS", "EVIDENCE_KINDS", "VERBS", "createVerbRegistry", "DIALECTS", "decodePolicy", "encodeEnvelope", "decodeEnvelope", "CATALOG", "explainIn", "needs", "control", "FORMS", "OUTCOMES"]) assert(names.includes(shared), shared);
  for (const form of ["decodeRunbook", "RESTORE_DRILL", "STEP_KINDS", "decodeReconcile", "CONVERGE_SETTINGS", "RECONCILE_KINDS", "foldRun", "foldReconcile"]) assertEquals(names.includes(form), false, form);
  assert(governance.VERBS.has("store.checkpoint") && !governance.VERBS.has("rm.rf"));
});

proves(["0040-workload-pattern FR-007"], "the library of the pattern has the role pattern and is a member of the patterns metapackage at its exact version", () => {
  const found = readLibraries(REPO);
  const libraries = found.flatMap((f) => ("library" in f ? [f.library] : []));
  const members = membersOf("patterns", libraries);
  assert(members.kind === "ok");
  const mine = members.value.find((m) => m.library === "workload");
  assert(mine !== undefined, "workload is a member of the patterns metapackage");
  assertEquals(mine.package, "@intellectual-frontiers/workload");
  assertEquals(dependenciesOf(members.value)["@intellectual-frontiers/workload"], libraries.find((l) => l.name === "workload")?.version);
  assertEquals(members.value.some((m) => m.library === "runbooks"), false);
});
