// Spec: 0001-workload-layers FR-006
/**
 * The command `workload`: `check` (the static check of the starter workloads, whatever their form), `plan ID` (the nodes and the autonomy derived for each), `project [--dialect D]` (the files of every registered dialect,
 * or one), `forms` (the forms, built and reserved), `runners` (the runners and what each can carry), `needs ID` (what a workload needs of a runner and which runner can carry it), `emit ID RUNNER` (the artifact of an integration runner, to the output), `schedule ID RUNNER` (the files that start a scheduled workload, or where its schedule is) and `explain CODE` (across the catalogs of the core and of each form) and `verb ID`, which checks the id against the registry: an id that is not registered is refused with its
 * code, and a registered one says that the host that has the pinned package binds it, and exits non-zero until it does. Every refusal prints its code and its fix. It reads nothing and writes nothing.
 *
 * @example
 * ```ts
 * import { main } from "./cli.ts";
 * // const code = await main(["explain", "E-WL-JUDGE-EFFECT"], { out, err })
 * ```
 *
 * @module
 */
import { authored, describeFinding, explainIn, FORM_IDS, FORMS, finding, runnerId, RUNNERS, VERBS } from "@intellectual-frontiers/workload/governance";
import { lacksOf, projectAll } from "@intellectual-frontiers/workload/logical";
import { graphFleet } from "@intellectual-frontiers/workload/forms/graph";
import { bootstrapFleet, FIXTURES } from "@intellectual-frontiers/workload/forms/runbook";
import { DIALECT_IMPLS } from "./dialects.ts";
import { emitSchedule, emitWorkload } from "./runners.ts";
import { type AnyWorkload, CATALOGS, checkWorkload, levelsOfWorkload, runnerNeedsOfWorkload, STARTERS, viewOfWorkload } from "./workloads.ts";

const KNOWN: readonly AnyWorkload[] = [...STARTERS, ...FIXTURES];
const FLEET = { fleet: (over: "tenants" | "hosts" | "fleets", source: string) => bootstrapFleet(over, source) ?? graphFleet(over, source) };

/** Where the command writes. */
export type Io = { readonly out: (text: string) => void; readonly err: (text: string) => void };

/** The command: the exit status, 0 where it did what was asked, 1 where it refused and 2 where it cannot yet. */
export async function main(argv: readonly string[], io: Io): Promise<0 | 1 | 2> {
  const [command, arg] = argv;
  switch (command) {
    case "check": {
      let code: 0 | 1 = 0;
      for (const w of STARTERS) {
        const found = checkWorkload(w);
        for (const f of found) io.err(describeFinding(f));
        if (found.length > 0) code = 1;
        else io.out(`${w.id} (${w.form}): no finding`);
      }
      return code;
    }
    case "plan": {
      const w = STARTERS.find((x) => x.id === arg);
      if (w === undefined) {
        io.err(`no starter workload ${arg ?? ""}; the starters are ${STARTERS.map((x) => x.id).join(", ")}`);
        return 1;
      }
      const found = checkWorkload(w);
      if (found.length > 0) {
        for (const f of found) io.err(describeFinding(f));
        return 1;
      }
      for (const l of levelsOfWorkload(w)) io.out(`${l.id}: ${l.kind}, ${l.autonomy}${l.raisedBy === undefined ? "" : ` (raised by ${l.raisedBy})`}`);
      return 0;
    }
    case "project": {
      const only = argv[1] === "--dialect" ? argv[2] : undefined;
      const files = projectAll(STARTERS.map(viewOfWorkload), DIALECT_IMPLS.filter((d) => only === undefined || d.info.id === only));
      if (only !== undefined && Object.keys(files).length === 0) {
        io.err(`the dialect ${only} is not registered; the dialects are ${DIALECT_IMPLS.map((d) => d.info.id).join(", ")}`);
        return 1;
      }
      for (const [dialect, list] of Object.entries(files)) for (const f of list) io.out(`=== ${dialect} ${f.path}\n${f.text}`);
      return 0;
    }
    case "forms": {
      for (const id of FORM_IDS) {
        const f = FORMS[id];
        io.out(`${id}: ${f.status}: ${f.summary}${f.status === "reserved" ? ` Build it when: ${f.criteria.charAt(0).toLowerCase()}${f.criteria.slice(1)}` : ""}`);
      }
      return 0;
    }
    case "runners": {
      for (const r of RUNNERS.list()) io.out(`${r.id}: ${r.kind}: ${r.title}; can carry ${r.capabilities.join(", ")}`);
      return 0;
    }
    case "needs": {
      const w = KNOWN.find((x) => x.id === arg);
      if (w === undefined) {
        io.err(`no workload ${arg ?? ""}; the workloads are ${KNOWN.map((x) => x.id).join(", ")}`);
        return 1;
      }
      const needs = runnerNeedsOfWorkload(w);
      for (const n of needs) io.out(`${n.node}: needs ${n.capability}: ${n.why}`);
      for (const r of RUNNERS.list()) {
        const lacks = lacksOf(needs, r);
        io.out(`${r.id}: ${lacks.length === 0 ? "can carry it" : `cannot carry it: lacks ${[...new Set(lacks.map((n) => n.capability))].join(", ")}`}`);
      }
      return 0;
    }
    case "emit": {
      const w = KNOWN.find((x) => x.id === arg);
      const runner = argv[2];
      if (w === undefined || runner === undefined || !RUNNERS.has(runner)) {
        io.err(`usage: workload emit ID RUNNER; the workloads are ${KNOWN.map((x) => x.id).join(", ")} and the runners ${RUNNERS.list().map((r) => r.id).join(", ")}`);
        return 1;
      }
      const made = await emitWorkload(w, authored(runnerId(runner)), FLEET);
      if (made.kind === "err") {
        for (const f of made.error) io.err(describeFinding(f));
        return 1;
      }
      io.out(made.value.text);
      return 0;
    }
    case "schedule": {
      const w = KNOWN.find((x) => x.id === arg);
      const runner = argv[2];
      if (w === undefined || runner === undefined || !RUNNERS.has(runner)) {
        io.err(`usage: workload schedule ID RUNNER; the workloads are ${KNOWN.map((x) => x.id).join(", ")} and the runners ${RUNNERS.list().map((r) => r.id).join(", ")}`);
        return 1;
      }
      const made = await emitSchedule(w, authored(runnerId(runner)), FLEET);
      if (made.kind === "err") {
        for (const f of made.error) io.err(describeFinding(f));
        return 1;
      }
      if (made.value.where === "none") io.out(`${w.id} is started by hand: it has no schedule`);
      else if (made.value.where === "workflow") io.out(`${w.id}: the schedule of ${runner} is in its workflow (on.schedule): emit it with: workload emit ${w.id} ${runner}`);
      else for (const f of made.value.files) io.out(`=== ${f.path}\n${f.text}`);
      return 0;
    }
    case "explain": {
      const e = explainIn(CATALOGS, arg ?? "");
      io.out(`${e.code}: ${e.title}\n${e.what}\nfixer: ${e.fixer}\nfix: ${e.fix}`);
      return 0;
    }
    case "verb": {
      const v = arg === undefined ? undefined : VERBS.get(arg);
      if (v === undefined) {
        io.err(describeFinding(finding("E-WL-VERB-UNKNOWN", "", `${arg ?? "(no id)"} is not registered`, { verb: arg ?? "" })));
        return 1;
      }
      io.err(`${v.id} is registered (${v.package}), and this program holds no binding that runs it: the host that has the package registers it and calls the runner`);
      return 2;
    }
    default:
      io.err("usage: workload check | plan ID | project [--dialect D] | forms | runners | needs ID | emit ID RUNNER | schedule ID RUNNER | explain CODE | verb ID");
      return 1;
  }
}
