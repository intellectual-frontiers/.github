// Spec: 0003-machine-probe-observation FR-004
/**
 * Asking a probe: a request sent through a way of running the command (the ssh client on a target, a container, the machine itself), the facts read into an observation, and one osquery SELECT answered as rows. A probe that cannot be
 * reached, refuses, or gives what cannot be read is an error that says so, never an observation that is guessed.
 *
 * @example
 * ```ts
 * import { observe } from "./run.ts";
 * const r = await observe(async () => ({ code: 0, stdout: "@probe\nat=2026-12-01T00:00:00Z\nversion=1\n", stderr: "" }));
 * r.kind; // "ok"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { encodeRequest, parseRequest, sshArgv, type ProbeRequest, type ProbeTarget } from "@intellectual-frontiers/machine-probe/governance";
import { parseProbe, toObserved, type Observed } from "@intellectual-frontiers/machine-probe/logical";
import * as proc from "@intellectual-frontiers/system/proc";

/** What running a command gave. */
export type Ran = { readonly code: number; readonly stdout: string; readonly stderr: string };

/** A way of sending one request to a probe and getting what it printed: the request is the text the probe is given. */
export type Send = (request: string) => Promise<Ran>;

/** Why a probe gave no answer. */
export type ProbeError = { readonly kind: "refused" | "unreachable" | "unreadable"; readonly message: string };

/** The facts of a machine as an observation, or why none: `unreachable` where the command did not run, `refused` where the probe refused, `unreadable` where what it printed is not facts. */
export async function observe(send: Send): Promise<Result<Observed, ProbeError>> {
  let ran: Ran;
  try {
    ran = await send(encodeRequest({ kind: "facts" }));
  } catch (e) {
    return err({ kind: "unreachable", message: e instanceof Error ? e.message : String(e) });
  }
  if (ran.code === 255) return err({ kind: "unreachable", message: ran.stderr.trim() || "the ssh client could not reach the machine" });
  if (ran.code !== 0) return err({ kind: "refused", message: ran.stderr.trim() || `the probe ended with ${ran.code}` });
  const o = toObserved(parseProbe(ran.stdout));
  return o.kind === "ok" ? ok(o.value) : err({ kind: "unreadable", message: o.error });
}

/** One row of an osquery answer: every value is text, as osquery prints it. */
export type Row = Readonly<Record<string, string>>;

/** The rows of one osquery SELECT, or why not: the query is refused here before it is sent where it is not a single SELECT. */
export async function query(send: Send, sql: string): Promise<Result<readonly Row[], ProbeError>> {
  const request: ProbeRequest = { kind: "osquery", sql };
  const checked = parseRequest(encodeRequest(request));
  if (checked.kind === "err") return err({ kind: "refused", message: checked.error });
  let ran: Ran;
  try {
    ran = await send(encodeRequest(checked.value));
  } catch (e) {
    return err({ kind: "unreachable", message: e instanceof Error ? e.message : String(e) });
  }
  if (ran.code === 255) return err({ kind: "unreachable", message: ran.stderr.trim() || "the ssh client could not reach the machine" });
  if (ran.code !== 0) return err({ kind: "refused", message: ran.stderr.trim() || `the probe ended with ${ran.code}` });
  try {
    const rows: unknown = JSON.parse(ran.stdout);
    if (!Array.isArray(rows)) return err({ kind: "unreadable", message: "osquery did not print a list of rows" });
    return ok(rows.map((r) => Object.fromEntries(Object.entries(r as Record<string, unknown>).map(([k, v]) => [k, String(v)]))));
  } catch {
    return err({ kind: "unreadable", message: "osquery did not print JSON" });
  }
}

/** A way of sending requests to a machine through the system's ssh client, with the key restricted to the probe and the host key checked against the file given. */
export function sshSend(target: ProbeTarget): Send {
  return async (request) => {
    const parsed = parseRequest(request);
    if (parsed.kind === "err") return { code: 2, stdout: "", stderr: parsed.error };
    const argv = sshArgv(target, parsed.value);
    if (argv.kind === "err") return { code: 2, stdout: "", stderr: argv.error };
    const r = await proc.run(argv.value);
    return { code: r.code, stdout: r.stdout, stderr: r.stderr };
  };
}
