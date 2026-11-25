/**
 * Tests of the forms (commons workload 0003-workload-forms): the contract of a form is tiny and closed, the core imports nothing from a form and a form imports nothing from another, and the registry of forms is closed with
 * what is built and what is reserved. The static check reads the sources and the table of the manifest; it needs no machine.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { decodeTable } from "@intellectual-frontiers/kanon";
import { fs, path } from "@intellectual-frontiers/system";
import { BUILT_FORM_IDS, FORM_IDS, FORMS, isBuiltForm } from "@intellectual-frontiers/workload/governance";
import { RUNBOOK_FORM, STEP_KINDS } from "@intellectual-frontiers/workload/forms/runbook";
import { RUNBOOK_EXECUTOR } from "@intellectual-frontiers/workload/physical";
import { library } from "../library.ts";

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

proves(["0003-workload-forms FR-001"], "a form is declared by its id, its closed sum of node kinds, validate, plan, fold and an executor behind a port, and nothing else", () => {
  assertEquals(Object.keys(RUNBOOK_FORM).sort(), ["fold", "id", "nodeKinds", "plan", "validate"]);
  assertEquals(RUNBOOK_FORM.id, "runbook");
  assertEquals(RUNBOOK_FORM.nodeKinds, STEP_KINDS);
  assertEquals(Object.keys(RUNBOOK_EXECUTOR).sort(), ["form", "run"]);
  assertEquals(RUNBOOK_EXECUTOR.form, RUNBOOK_FORM.id);
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
  assertEquals(BUILT_FORM_IDS, ["runbook", "reconcile"]);
  for (const id of FORM_IDS) assertEquals(FORMS[id].status === "built", isBuiltForm(id));
  for (const id of ["graph", "campaign"] as const) {
    const f = FORMS[id];
    assert(f.status === "reserved" && f.criteria.includes("second") || f.status === "reserved" && f.criteria.includes("two"), id);
  }
  assertEquals(isBuiltForm("graph"), false);
});
