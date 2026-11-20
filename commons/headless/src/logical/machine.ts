// Spec: 0006-machine-verbs FR-001, FR-002, FR-003
/**
 * The two verbs of a machine (commons headless 0006-machine-verbs): `machine query` takes a query string and `machine check` a check id, each with a target
 * selector (`--on`, as any command that may be reached through ssh), and returns the typed outcome of a report. Headless does not learn what a query is: the string
 * is opaque to it, handed to the backend byte for byte, and what answers it (SQL over a database, an osquery schema, a check of governance, risk and compliance) is
 * the backend's, which the program that uses these verbs gives. This module imports neither the data library nor the grc library, and no layer of Headless MAY.
 *
 * @example
 * ```ts
 * import { machineVerbs } from "./machine.ts";
 * const verbs = machineVerbs({ query: async () => outcomeOf([]), check: async () => outcomeOf(null) });
 * verbs.name; // "machine"
 * ```
 *
 * @module
 */
import { suggest } from "@intellectual-frontiers/terminal/args";
import { defineReach, problem } from "@intellectual-frontiers/headless/governance";
import { branch, command, type Branch, type Context } from "./model.ts";
import { outcomeOf, type Outcome } from "./outcome.ts";

/** What answers a machine verb: the program's own (data's queries, grc's checks), given to the verbs. */
export type MachineBackend = {
  /** Answers a query string, which it alone reads. */
  query(query: string, ctx: Context): Promise<Outcome>;
  /** Runs the check with this id. */
  check(id: string, ctx: Context): Promise<Outcome>;
  /** The ids of the checks there are, where the backend knows them, so that a wrong id is told the nearest. */
  checks?(): readonly string[];
};

/** The reach of both verbs: they only read, are safe to repeat, and may come through every channel. */
const REACH = defineReach({ channels: ["local", "ssh", "mcp", "rest"], readOnly: true, idempotent: true });

/** Whether a text can stand as a check id: not empty, one line, no NUL. */
export function validCheckId(id: string): boolean {
  return id.trim() !== "" && !/[\u0000\r\n]/.test(id);
}

/** The branch `machine` with the verbs `query` and `check`, answered by the backend. */
export function machineVerbs(backend: MachineBackend): Branch {
  return branch({
    name: "machine",
    summary: "Ask a machine, or run a check on it.",
    children: [
      command({
        name: "query",
        summary: "Answer a query about a machine (the query is the backend's, and is not read here).",
        options: {},
        operands: [{ name: "QUERY", help: "The query, as the backend takes it.", arity: "one" }],
        examples: [{ args: ["'<a query>'", "--on", "class:server"], says: "Ask every server." }],
        action: { kind: "report", reach: REACH },
        run: async (args, ctx) => {
          const [query, ...extra] = args.positionals;
          if (query === undefined || extra.length > 0 || query === "") return outcomeOf(null, { problems: [problem("fail", "machine query takes exactly one query", { code: "E000-USAGE-QUERY" })] });
          return await backend.query(query, ctx);
        },
      }),
      command({
        name: "check",
        summary: "Run a check on a machine, by its id.",
        options: {},
        operands: [{ name: "ID", help: "The id of the check.", arity: "one" }],
        examples: [{ args: ["some-check", "--on", "alpha"], says: "Run it on alpha." }],
        action: { kind: "report", reach: REACH },
        run: async (args, ctx) => {
          const [id, ...extra] = args.positionals;
          if (id === undefined || extra.length > 0 || !validCheckId(id)) return outcomeOf(null, { problems: [problem("fail", "machine check takes exactly one check id", { code: "E000-USAGE-CHECK" })] });
          const known = backend.checks?.();
          if (known !== undefined && !known.includes(id)) {
            const near = suggest(id, known);
            return outcomeOf(null, { problems: [problem("fail", `${id} is not a check${near === undefined ? "" : `; did you mean ${near}?`}`, { code: "E000-USAGE-CHECK" })] });
          }
          return await backend.check(id, ctx);
        },
      }),
    ],
  });
}
