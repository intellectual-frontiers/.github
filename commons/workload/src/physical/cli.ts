// Spec: 0001-workload-layers FR-006
/**
 * The command `workload`: `check` (the static check of the starter workloads, whatever their form), `plan ID` (the nodes and the autonomy derived for each), `project [--dialect D]` (the files of every registered dialect,
 * or one), `forms` (the forms, built and reserved), `explain CODE` (across the catalogs of the core and of each form) and `verb ID`, which checks the id against the registry: an id that is not registered is refused with its
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
import { describeFinding, explainIn, FORM_IDS, FORMS, finding, VERBS } from "@intellectual-frontiers/workload/governance";
import { projectAll } from "@intellectual-frontiers/workload/logical";
import { DIALECT_IMPLS } from "./dialects.ts";
import { CATALOGS, checkWorkload, levelsOfWorkload, STARTERS, viewOfWorkload } from "./workloads.ts";

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
      io.err("usage: workload check | plan ID | project [--dialect D] | forms | explain CODE | verb ID");
      return 1;
  }
}
