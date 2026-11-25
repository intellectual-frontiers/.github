// Spec: 0005-runbooks-runners FR-008
/**
 * The command `runbooks`: `check` (the static check of the starter runbooks), `plan ID` (the steps and the autonomy derived for each), `project [--dialect D]` (the files of every registered dialect, or one), `explain CODE`
 * and `verb ID`, which checks the id against the registry: an id that is not registered is refused with its code, and a registered one says that the host that has the pinned package binds it, and exits non-zero until it does.
 * Every refusal prints its code and its fix. It reads nothing and writes nothing.
 *
 * @example
 * ```ts
 * import { main } from "./cli.ts";
 * // const code = await main(["explain", "E-RB-JUDGE-EFFECT"], { out, err })
 * ```
 *
 * @module
 */
import { describeFinding, explain, finding, STARTERS, VERBS } from "@intellectual-frontiers/runbooks/governance";
import { check, DIALECT_IMPLS, levelsOf, projectAll } from "@intellectual-frontiers/runbooks/logical";

/** Where the command writes. */
export type Io = { readonly out: (text: string) => void; readonly err: (text: string) => void };

/** The command: the exit status, 0 where it did what was asked, 1 where it refused and 2 where it cannot yet. */
export async function main(argv: readonly string[], io: Io): Promise<0 | 1 | 2> {
  const [command, arg] = argv;
  switch (command) {
    case "check": {
      let code: 0 | 1 = 0;
      for (const r of STARTERS) {
        const found = check(r);
        for (const f of found) io.err(describeFinding(f));
        if (found.length > 0) code = 1;
        else io.out(`${r.id}: no finding`);
      }
      return code;
    }
    case "plan": {
      const r = STARTERS.find((x) => x.id === arg);
      if (r === undefined) {
        io.err(`no starter runbook ${arg ?? ""}; the starters are ${STARTERS.map((x) => x.id).join(", ")}`);
        return 1;
      }
      const found = check(r);
      if (found.length > 0) {
        for (const f of found) io.err(describeFinding(f));
        return 1;
      }
      for (const l of levelsOf(r)) io.out(`${l.id}: ${l.kind}, ${l.autonomy}${l.raisedBy === undefined ? "" : ` (raised by ${l.raisedBy})`}`);
      return 0;
    }
    case "project": {
      const only = argv[1] === "--dialect" ? argv[2] : undefined;
      const files = projectAll(STARTERS, DIALECT_IMPLS.filter((d) => only === undefined || d.info.id === only));
      if (only !== undefined && Object.keys(files).length === 0) {
        io.err(`the dialect ${only} is not registered; the dialects are ${DIALECT_IMPLS.map((d) => d.info.id).join(", ")}`);
        return 1;
      }
      for (const [dialect, list] of Object.entries(files)) for (const f of list) io.out(`=== ${dialect} ${f.path}\n${f.text}`);
      return 0;
    }
    case "explain": {
      const e = explain(arg ?? "");
      io.out(`${e.code}: ${e.title}\n${e.what}\nfixer: ${e.fixer}\nfix: ${e.fix}`);
      return 0;
    }
    case "verb": {
      const v = arg === undefined ? undefined : VERBS.get(arg);
      if (v === undefined) {
        io.err(describeFinding(finding("E-RB-VERB-UNKNOWN", "", `${arg ?? "(no id)"} is not registered`, { verb: arg ?? "" })));
        return 1;
      }
      io.err(`${v.id} is registered (${v.package}), and this program holds no binding that runs it: the host that has the package registers it and calls the runner`);
      return 2;
    }
    default:
      io.err("usage: runbooks check | plan ID | project [--dialect D] | explain CODE | verb ID");
      return 1;
  }
}
