// Spec: 0005-reach-and-targets FR-005, FR-006, FR-007, FR-008, FR-009
/**
 * An action run on a target (commons headless 0005-reach-and-targets): the target (its id, class, address, port, jump chain, the reference of its host key and
 * of its credential, never a value), the invocation that runs `<program> run --json <verb> ...` there, and what comes back as the typed outcome and the one JSON
 * envelope of a local run. A host that cannot be reached, a host key that does not match and a time out are the environment's (status 3); a forced command
 * that refuses is a usage problem (status 2); a partial failure over many targets is status 1 with a table for each host.
 *
 * @example
 * ```ts
 * import { target, remoteArgv } from "./remote.ts";
 * const t = target({ id: "alpha", class: "server", address: "10.0.0.5" });
 * remoteArgv({ program: "ops", verb: ["boot", "doctor"], args: ["--quiet"] }); // ["ops", "run", "--json", "boot", "doctor", "--quiet"]
 * ```
 *
 * @module
 */
import { array, err, formatDecodeError, integer, json, literal, mapErr, object, ok, string, unknownValue, type Result } from "@intellectual-frontiers/core";
import type { Problem, TargetClass } from "@intellectual-frontiers/headless/governance";
import { problem, TARGET_CLASSES } from "@intellectual-frontiers/headless/governance";
import { ENVELOPE_SCHEMA } from "./envelope.ts";
import type { Catalogue } from "./explain.ts";
import { textOf, type Fanned, type Output } from "./executor.ts";
import { problemDecoder } from "./nested.ts";
import { mergeOutcomes, outcomeOf, type Outcome } from "./outcome.ts";

/** A credential, by reference: the name a program resolves to a key file or an agent at the moment it is needed. It is never the credential. */
export type CredentialRef = { readonly kind: "ref"; readonly name: string };

/** A machine a command can run on. */
export type Target = {
  readonly id: string;
  readonly class: TargetClass;
  /** A host name or an address; never one that begins with a dash. */
  readonly address: string;
  readonly user: string | undefined;
  readonly port: number | undefined;
  /** The ids of the targets this one is reached through, in order. */
  readonly jump: readonly string[];
  /** The reference of the host's key (a fingerprint's name in the repository's known hosts), not the key. */
  readonly hostKeyRef: string | undefined;
  readonly credential: CredentialRef | undefined;
};

/** What `target` takes. */
export type TargetDefinition = {
  readonly id: string;
  readonly class: TargetClass;
  readonly address: string;
  readonly user?: string;
  readonly port?: number;
  readonly jump?: readonly string[];
  readonly hostKeyRef?: string;
  readonly credential?: string;
};

const ID = /^[a-z][a-z0-9-]*$/;
const HOST = /^[A-Za-z0-9][A-Za-z0-9.:_-]*$/;
const USER = /^[A-Za-z_][A-Za-z0-9._-]*$/;

/** A target, or why it is not one: an id of lower-case words, a class there is, an address that cannot be taken for an option, a port in range, a user and jump ids that are names. */
export function target(d: TargetDefinition): Result<Target, string> {
  if (!ID.test(d.id)) return err(`${JSON.stringify(d.id)} is not a target id: lower-case words joined by dashes`);
  if (!TARGET_CLASSES.includes(d.class)) return err(`${d.id}: ${String(d.class)} is not a class of target`);
  if (!HOST.test(d.address)) return err(`${d.id}: ${JSON.stringify(d.address)} is not a host name or address (it may not begin with a dash or hold a space)`);
  if (d.port !== undefined && (!Number.isInteger(d.port) || d.port < 1 || d.port > 65_535)) return err(`${d.id}: ${String(d.port)} is not a port`);
  if (d.user !== undefined && !USER.test(d.user)) return err(`${d.id}: ${JSON.stringify(d.user)} is not a user name`);
  for (const j of d.jump ?? []) if (!ID.test(j) || j === d.id) return err(`${d.id}: ${JSON.stringify(j)} is not a target to jump through`);
  if (d.credential !== undefined && !ID.test(d.credential)) return err(`${d.id}: a credential is a reference by name, not a value`);
  return ok({
    id: d.id,
    class: d.class,
    address: d.address,
    user: d.user,
    port: d.port,
    jump: d.jump ?? [],
    hostKeyRef: d.hostKeyRef,
    credential: d.credential === undefined ? undefined : { kind: "ref", name: d.credential },
  });
}

/** The targets a selector names: `all`, `class:<class>`, or ids joined by commas; an id or class that is not known is an error naming it. */
export function selectTargets(all: readonly Target[], selector: string): Result<readonly Target[], string> {
  if (selector === "all") return ok(all);
  if (selector.startsWith("class:")) {
    const c = selector.slice("class:".length);
    return (TARGET_CLASSES as readonly string[]).includes(c) ? ok(all.filter((t) => t.class === c)) : err(`${c} is not a class of target: ${TARGET_CLASSES.join(", ")}`);
  }
  const picked: Target[] = [];
  for (const id of selector.split(",").filter((x) => x !== "")) {
    const t = all.find((x) => x.id === id);
    if (t === undefined) return err(`${id} is not a target`);
    if (!picked.includes(t)) picked.push(t);
  }
  return picked.length === 0 ? err("a selector names no target") : ok(picked);
}

/** What is run on a target: the program, the verb's words and the arguments. */
export type RemoteInvocation = { readonly program: string; readonly verb: readonly string[]; readonly args: readonly string[] };

/** The argument vector that runs the invocation: `<program> run --json <verb> ...`, the one way a command is dispatched to a target. */
export function remoteArgv(i: RemoteInvocation): readonly string[] {
  return [i.program, "run", "--json", ...i.verb, ...i.args];
}

/** What came of a run on a target. */
export type RemoteKind = "ran" | "unreachable" | "hostkey" | "timeout" | "refused" | "missing" | "malformed";

/** A run on one target, as a report: how it went, its status, and what it found as the typed outcome. */
export type RemoteOutcome = {
  readonly target: string;
  readonly kind: RemoteKind;
  /** The status this target's run counts as: its own where it ran, 3 where it could not be reached, 2 where it refused. */
  readonly code: number;
  readonly outcome: Outcome;
};

/** The codes that remote failures carry, with their explanations, for a program to merge into its catalogue. */
export const REMOTE_CATALOGUE: Catalogue = {
  "E000-REMOTE-UNREACHABLE": {
    title: "A target could not be reached",
    what: "The connection to the target was not made, or ended before the command ran.",
    why: "The target is off, the address or the network is wrong, or the login was refused.",
    fix: "Check that the target is on and reachable, then run it again.",
  },
  "E000-REMOTE-HOSTKEY": {
    title: "The key of a target is not the one that is known",
    what: "The target showed a host key that does not match the known one, or none that is known, and nothing was run.",
    why: "The target was reinstalled, or something else answers at its address.",
    fix: "Compare the fingerprint with the one you know; only if it is right, trust the host again with the program's explicit verb.",
  },
  "E000-REMOTE-TIMEOUT": {
    title: "A target took too long",
    what: "The command did not finish in the time allowed for each target.",
    why: "The target is slow or stuck, or the time allowed is short.",
    fix: "Run it on that target alone with a longer time.",
  },
  "E000-REMOTE-REFUSED": {
    title: "A target refused the command",
    what: "The target's forced command accepted only what its key is for, and this was not.",
    why: "The key may only read, or only run the program's verbs, and this asked for more.",
    fix: "Use a key that is allowed to do it, or run a verb that only reads.",
  },
  "E000-REMOTE-NO-PROGRAM": {
    title: "The program is not on the target",
    what: "The target has no such program, or may not run it.",
    why: "It is not installed there, or not on the path of that login.",
    fix: "Install the program on the target.",
  },
  "E000-REMOTE-MALFORMED": {
    title: "A target answered with something that is not a report",
    what: "The command ran, but what it wrote is not the one JSON document of a run.",
    why: "The program there is another version, or something wrote before it.",
    fix: "Run it on that target by hand with --json and read what it wrote.",
  },
};

const ENVELOPE = object({
  schema: literal(ENVELOPE_SCHEMA),
  exit: object({ code: integer, name: string }),
  problems: array(problemDecoder),
  outcomes: array(string),
  hints: array(object({ id: string, message: string }, { command: string })),
  next: array(string),
  data: unknownValue,
});

/** The outcome and the status of the one JSON envelope a remote run wrote, or why it is not one. */
export function decodeEnvelope(text: string): Result<{ readonly code: number; readonly outcome: Outcome }, string> {
  const r = mapErr(json(text, ENVELOPE), formatDecodeError);
  if (r.kind === "err") return err(r.error);
  const v = r.value;
  return ok({
    code: v.exit.code,
    outcome: outcomeOf(v.data, {
      problems: v.problems.map((p): Problem => ({ ...p })),
      outcomes: v.outcomes,
      hints: v.hints.map((h) => ({ ...h })),
      next: v.next,
    }),
  });
}

const failed = (target: string, kind: RemoteKind, code: number, text: string, errCode: string, raw?: string): RemoteOutcome => ({
  target,
  kind,
  code,
  outcome: outcomeOf(null, { problems: [problem("fail", text, { code: errCode, phase: target, ...(raw === undefined || raw === "" ? {} : { raw }) })] }),
});

/**
 * What a run on a target came to, from how its program ended: a time out and an exit of 255 (ssh's own failure) are the environment's, status 3, the host key
 * apart from the rest; a 127 or 126 is that the program is not there, status 3; a refusal of the forced command (status 2 with no report) is status 2; a report
 * that is not the one JSON document is malformed; otherwise the remote report, with its own status.
 */
export function outcomeOfRemote(targetId: string, out: Output | undefined, timedOut: boolean): RemoteOutcome {
  if (timedOut || out === undefined) return failed(targetId, "timeout", 3, `${targetId} did not finish in time`, "E000-REMOTE-TIMEOUT");
  const stderr = textOf(out.stderr).trim();
  if (out.code === 255) {
    return /host key|HOST IDENTIFICATION/i.test(stderr)
      ? failed(targetId, "hostkey", 3, `${targetId} showed a host key that is not the known one`, "E000-REMOTE-HOSTKEY", stderr)
      : failed(targetId, "unreachable", 3, `${targetId} could not be reached`, "E000-REMOTE-UNREACHABLE", stderr);
  }
  if (out.code === 127 || out.code === 126) return failed(targetId, "missing", 3, `${targetId} has no program to run`, "E000-REMOTE-NO-PROGRAM", stderr);
  const decoded = decodeEnvelope(textOf(out.stdout));
  if (decoded.kind === "ok") return { target: targetId, kind: "ran", code: decoded.value.code, outcome: decoded.value.outcome };
  if (out.code === 2) return failed(targetId, "refused", 2, `${targetId} refused the command`, "E000-REMOTE-REFUSED", stderr);
  return failed(targetId, "malformed", 1, `${targetId} answered with something that is not a report`, "E000-REMOTE-MALFORMED", decoded.error);
}

/** The outcome a fan-out row comes to. */
export function remoteOfFanned(row: Fanned<RemoteOutcome>): RemoteOutcome {
  switch (row.kind) {
    case "done":
      return row.value;
    case "timeout":
      return outcomeOfRemote(row.id, undefined, true);
    case "failed":
      return failed(row.id, "unreachable", 3, `${row.id} could not be run on`, "E000-REMOTE-UNREACHABLE", row.message);
  }
}

const ENVIRONMENT: readonly RemoteKind[] = ["unreachable", "hostkey", "timeout", "missing"];

/**
 * The status of a run over many targets: 0 where every target's run ended with 0; 3 where every one failed for the environment; 2 where every one refused;
 * else 1, a partial failure, with the table of each host to say which.
 */
export function exitOfRemote(rows: readonly RemoteOutcome[]): number {
  if (rows.every((r) => r.kind === "ran" && r.code === 0)) return 0;
  if (rows.length > 0 && rows.every((r) => ENVIRONMENT.includes(r.kind))) return 3;
  if (rows.length > 0 && rows.every((r) => r.kind === "refused")) return 2;
  return 1;
}

/** The status word of a row for the table. */
export function statusWord(r: RemoteOutcome): string {
  return r.kind === "ran" ? (r.code === 0 ? "ok" : "failed") : r.kind;
}

/** A table of one line for each host: its id, how it went, its status and the first thing it said. */
export function hostTable(rows: readonly RemoteOutcome[]): string {
  const idWidth = Math.max(6, ...rows.map((r) => r.target.length));
  const statusWidth = Math.max(6, ...rows.map((r) => statusWord(r).length));
  const head = `${"TARGET".padEnd(idWidth)}  ${"STATUS".padEnd(statusWidth)}  EXIT  FIRST PROBLEM`;
  const lines = rows.map((r) => `${r.target.padEnd(idWidth)}  ${statusWord(r).padEnd(statusWidth)}  ${String(r.code).padStart(4)}  ${r.outcome.problems[0]?.message ?? ""}`.trimEnd());
  return [head, ...lines].join("\n");
}

/**
 * One report of a run over targets (the nested hand-off for many hosts): the table as its text, the data of each host under its id, and every problem of every
 * host once, each marked with the target it is of; a failure of the run as a whole where some host failed.
 */
export function reportOfRemote(rows: readonly RemoteOutcome[]): Outcome {
  const data = Object.fromEntries(rows.map((r) => [r.target, { kind: r.kind, code: r.code, data: r.outcome.data }]));
  let report: Outcome = outcomeOf(data, { text: hostTable(rows) });
  for (const r of rows) {
    const marked: Outcome = {
      ...r.outcome,
      problems: r.outcome.problems.map((p) => ({ ...p, message: `${r.target}: ${p.message}`, phase: r.target })),
      outcomes: r.outcome.outcomes.map((o) => `${r.target}: ${o}`),
    };
    report = mergeOutcomes(report, { ...marked, data: null, text: undefined });
  }
  return report;
}
