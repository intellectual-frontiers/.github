/**
 * Tests of the layers of Workload over the shared checker of Kanon (commons workload 0001-workload-layers FR-001 to FR-007): the table in the manifest holds every file of the real tree with no finding, and `verify` runs every check.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { decodeTable } from "@intellectual-frontiers/kanon";
import { findings as hostFindings, readTable } from "@intellectual-frontiers/kanon/host";
import { fs, path } from "@intellectual-frontiers/system";
import { library } from "../library.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

proves(["0001-workload-layers FR-001"], "the shared checker finds nothing in the real tree", () => {
  assertEquals(readTable(ROOT).kind, "ok");
  assertEquals(decodeTable(library.kanon).kind, "ok");
  const found = hostFindings(ROOT);
  assert(found.kind === "ok", "the real tree is read");
  assertEquals(found.value.map((f) => `${f.rule} ${f.file}`), []);
});

proves(["0001-workload-layers FR-002"], "verify runs every check of the library", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { scripts: Record<string, string> };
  const verify = pkg.scripts["verify"] ?? "";
  for (const step of ["tsc -p tsconfig.json", "mizan-check.ts --root spec-kit", "check.ts --root spec-kit --level L1", "bun ../kanon/src/check.ts", "bun tools/check.ts", "bun test suite/"]) {
    assert(verify.includes(step), `verify runs ${step}`);
  }
});

proves(["0001-workload-layers FR-003"], "the library imports other libraries by package name and their allowed entries only, and never by a path out of its folder", async () => {
  const allowed: Readonly<Record<string, readonly string[]>> = {
    "@intellectual-frontiers/anyfs": ["governance"],
    "@intellectual-frontiers/crypto": ["sha256"],
    "@intellectual-frontiers/grc": ["governance"],
    "@intellectual-frontiers/planning": ["governance"],
    "@intellectual-frontiers/workbench": ["governance", "logical"],
    "@intellectual-frontiers/workload": ["governance", "logical", "forms/runbook", "forms/reconcile", "dialects/claude-code", "dialects/codex", "dialects/human", "runners/bash", "runners/pwsh"],
    "@intellectual-frontiers/core": [""],
    "@intellectual-frontiers/system": [""],
  };
  const files: string[] = [];
  for (const dir of ["src", "tools"]) for await (const f of walk(path.join(ROOT, dir))) files.push(f);
  assert(files.length > 5, "the sources are read");
  for (const file of files) {
    const text = await fs.readTextFile(file);
    for (const m of text.matchAll(/from "([^"]+)"/gu)) {
      const spec = m[1] ?? "";
      if (spec.startsWith("node:") || spec.startsWith(".")) {
        assert(!spec.includes("../../../") && !(file.includes("/tools/") && spec.includes("../..") ), `${file}: ${spec}`);
        continue;
      }
      const [scope, name, ...rest] = spec.split("/");
      const pkg = `${scope}/${name}`;
      const subs = allowed[pkg];
      if (subs === undefined) {
        assert(pkg.startsWith("@intellectual-frontiers/mizan") || pkg.startsWith("@intellectual-frontiers/libraries") || pkg.startsWith("@intellectual-frontiers/test"), `${file}: ${spec} is a package the library may not import`);
        continue;
      }
      assert(subs.includes(rest.join("/")) || (rest.join("/") === "" && subs.includes("")) || pkg === "@intellectual-frontiers/core", `${file}: ${spec} is an entry the library may not import`);
    }
  }
  assert(!files.some((f) => f.endsWith(".ts") && /planning\/(logical|physical)/u.test(f)));
});

async function* walk(dir: string): AsyncGenerator<string> {
  for await (const e of fs.readDir(dir)) {
    const p = path.join(dir, e.name);
    if (e.isDirectory) yield* walk(p);
    else if (p.endsWith(".ts")) yield p;
  }
}

proves(["0001-workload-layers FR-004"], "the entries give a program the core (the registry of verbs, the forms, the contract), the shared logical layer, each form and the dialects as values", async () => {
  const g = await import("@intellectual-frontiers/workload/governance");
  assert(g.VERBS.has("store.checkpoint") && g.VERBS.has("work.claim"));
  assertEquals(g.VERBS.has("rm.rf"), false);
  assertEquals(g.BUILT_FORM_IDS, ["runbook", "reconcile"]);
  assertEquals(Object.keys(g).filter((k) => /^(decodeRunbook|RESTORE_DRILL|STARTERS|STEP_KINDS)$/u.test(k)), []);
  const rb = await import("@intellectual-frontiers/workload/forms/runbook");
  assertEquals(rb.decodeRunbook(rb.RESTORE_DRILL).kind, "ok");
  assertEquals(rb.STARTERS.map((r) => r.id), ["restore-drill"]);
  const l = await import("@intellectual-frontiers/workload/logical");
  assert(typeof l.effectAutonomy === "function" && typeof l.skillMd === "function");
  const top = await import("@intellectual-frontiers/workload");
  assert(top.governance.VERBS.has("verb") === false && top.governance.VERBS.has("store.backup"));
  assertEquals(top.runbook.RESTORE_DRILL.id, "restore-drill");
  assertEquals(top.reconcile.CONVERGE_SETTINGS.id, "converge-settings");
  assertEquals((await import("@intellectual-frontiers/workload/forms/reconcile")).decodeReconcile((await import("@intellectual-frontiers/workload/forms/reconcile")).CONVERGE_SETTINGS).kind, "ok");
  for (const d of ["claude-code", "codex", "human"]) assertEquals((await import(`@intellectual-frontiers/workload/dialects/${d}`)).dialect.info.id, d);
});

proves(["0001-workload-layers FR-005"], "the manifest declares github and npm and the folder has the tool that packs it", async () => {
  assertEquals(library.distribution, ["github", "npm"]);
  assert(await fs.exists(path.join(ROOT, "tools", "pack.ts")));
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { scripts: Record<string, string> };
  assert((pkg.scripts["verify"] ?? "").includes("tools/pack.ts --check"));
});

proves(["0001-workload-layers FR-006"], "the program is workload, with the verbs check, plan, project, forms, runners, needs, emit, explain and verb, and every refusal prints its code and its fix", async () => {
  const { main } = await import("@intellectual-frontiers/workload/physical");
  const run = async (argv: string[]): Promise<{ code: number; out: string; err: string }> => {
    let out = "";
    let err = "";
    const code = await main(argv, { out: (t) => void (out += t), err: (t) => void (err += t) });
    return { code, out, err };
  };
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "..", "..", "package.json"))) as { scripts: Record<string, string> };
  assertEquals(pkg.scripts["workload"], "bun commons/workload/src/physical/main.ts");
  const checked = await run(["check"]);
  assertEquals(checked.code, 0);
  assert(checked.out.includes("restore-drill (runbook): no finding") && checked.out.includes("converge-settings (reconcile): no finding"));
  assert((await run(["plan", "converge-settings"])).out.includes("approve-plan: approve, human-only"));
  const projected = await run(["project", "--dialect", "codex"]);
  assert(projected.out.includes("=== codex AGENTS.md") && projected.out.includes("<!-- workload:begin -->") && projected.out.includes("### converge-settings"));
  assertEquals((await run(["project", "--dialect", "mystery"])).code, 1);
  assert((await run(["plan", "restore-drill"])).out.includes("claim-order: verb, agent-acts-human-reviews"));
  assertEquals((await run(["plan", "nope"])).code, 1);
  const forms = await run(["forms"]);
  assert(forms.out.includes("graph: reserved") && forms.out.includes("campaign: reserved") && forms.out.includes("runbook: built"));
  const runners = await run(["runners"]);
  assert(runners.out.includes("native: native:") && runners.out.includes("bash: integration:") && runners.out.includes("pwsh: integration:"));
  const needs = await run(["needs", "restore-drill"]);
  assert(needs.out.includes("summarize-drill: needs judge") && needs.out.includes("bash: cannot carry it: lacks judge, approval") && needs.out.includes("native: can carry it"));
  assert((await run(["needs", "synthetic-bootstrap-01"])).out.includes("pwsh: can carry it"));
  assertEquals((await run(["needs", "nope"])).code, 1);
  const emitted = await run(["emit", "synthetic-bootstrap-01", "bash"]);
  assert(emitted.code === 0 && emitted.out.startsWith("#!/usr/bin/env bash") && emitted.out.includes("run_verb 'claim-order' 'work.claim'"));
  const refusedEmit = await run(["emit", "restore-drill", "bash"]);
  assert(refusedEmit.code === 1 && refusedEmit.err.includes("E-WL-RUNNER-EMIT-UNSUPPORTED") && refusedEmit.err.includes("fix ("));
  assertEquals((await run(["emit", "synthetic-bootstrap-01", "native"])).code, 1);
  assertEquals((await run(["emit", "synthetic-bootstrap-01", "mystery"])).code, 1);
  assert((await run(["explain", "E-WL-RUNNER-UNSUITABLE"])).out.includes("fixer: person"));
  assert((await run(["explain", "E-WL-JUDGE-EFFECT"])).out.includes("fixer: agent"));
  assert((await run(["explain", "E-RB-STORE-NO-CHECKPOINT"])).out.includes("fixer: agent"));
  assert((await run(["explain", "E-NOPE"])).out.includes("E-WL-UNKNOWN"));
  const unknown = await run(["verb", "rm.rf"]);
  assert(unknown.code === 1 && unknown.err.includes("E-WL-VERB-UNKNOWN") && unknown.err.includes("fix ("));
  assertEquals((await run(["verb", "store.checkpoint"])).code, 2);
  assertEquals((await run(["nope"])).code, 1);
});

proves(["0001-workload-layers FR-007"], "the ids are branded and made only by a smart constructor: words with hyphens, a verb as noun.action, a citation as spec id and requirement id", async () => {
  const { nodeId, parseCite, storeRef, verbId, workloadId, dialectId } = await import("@intellectual-frontiers/workload/governance");
  assertEquals(nodeId("take-backup").kind, "ok");
  assertEquals(nodeId("Take Backup").kind, "err");
  assertEquals(nodeId("").kind, "err");
  assertEquals(workloadId("restore-drill").kind, "ok");
  assertEquals(workloadId("Restore Drill").kind, "err");
  assertEquals(verbId("store.checkpoint").kind, "ok");
  assertEquals(verbId("store").kind, "err");
  assertEquals(verbId("rm -rf /").kind, "err");
  assertEquals(storeRef("synthetic-db-01").kind, "ok");
  assertEquals(dialectId("claude-code").kind, "ok");
  assertEquals(parseCite("0002-workload-effects FR-001").kind, "ok");
  assertEquals(parseCite("FR-001").kind, "err");
  assertEquals(parseCite("0002-workload-effects fr-1").kind, "err");
});
