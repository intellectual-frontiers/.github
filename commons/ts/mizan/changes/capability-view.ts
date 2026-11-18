/**
 * The view of the capabilities that touch each rung (commons 0020-ifccm FR-016, FR-017), generated between the markers `<!-- capabilities:begin -->` and `<!-- capabilities:end -->` of a
 * harness's document, and the check that the document still holds it (`--check`). The view is an axis across the ladder and no rung of it.
 *
 * @remarks
 * Pure text in, text out. A capability states its rungs (`ifccm:touchesRung`) and its last revision; a rung states the commands that prove it (`mz:provedBy`). A capability is shown as proved
 * on a rung when every one of the rung's commands has a passing run at the capability's last revision, and as open on it otherwise (0016-ladder FR-003); a rung that names no command
 * cannot be proved, so a capability that touches it is open there. The view lists only the rungs some capability touches, in the order the rungs are given, and the capabilities of a rung by number.
 *
 * @limits
 * It does not run a command: the runs are what the caller gives it, from the quality records of 0021-ifqs where a harness keeps them.
 *
 * @example
 * ```ts
 * import { viewOf } from "./capability-view.ts";
 * viewOf([{ id: "rung-5", label: "Checks", provedBy: ["bun test"] }], [{ id: 10, title: "The check", touchesRung: ["rung-5"], lastRevision: "abc1234" }], []);
 * // "### Checks (rung-5)\n\n- #10 The check: open, `bun test` has no passing run at abc1234\n"
 * ```
 *
 * @module
 */
import { absurd } from "../../kernel/absurd.ts";
import { array, boolean, type DecodeError, formatDecodeError, integer, object, string } from "../../kernel/decode.ts";
import { err, ok, type Result } from "../../kernel/result.ts";
import { exportedLiteral } from "../../kernel/ts-literal.ts";

/** The marker that opens the generated view. */
export const BEGIN = "<!-- capabilities:begin -->";
/** The marker that closes it. */
export const END = "<!-- capabilities:end -->";

/** A rung as the view reads it: its identifier, its label, the commands that prove it and, where the offline trace places files on it, its homes (0020-ifccm FR-035). */
export type RungRecord = {
  readonly id: string;
  readonly label: string;
  readonly provedBy: readonly string[];
  readonly homes?: readonly string[];
};

/** A capability as the view reads it: its change request's number, its title, the rungs it touches and the last revision of its work. */
export type CapabilityRecord = {
  readonly id: number;
  readonly title: string;
  readonly touchesRung: readonly string[];
  readonly lastRevision: string;
};

/** A run of a rung's command at a revision. */
export type CommandRun = { readonly command: string; readonly revision: string; readonly passed: boolean };

/** Whether every command of a rung has a passing run at the revision; a rung with no command is not proved. */
export function isProved(rung: RungRecord, revision: string, runs: readonly CommandRun[]): boolean {
  return rung.provedBy.length > 0 && rung.provedBy.every((c) => runs.some((r) => r.command === c && r.revision === revision && r.passed));
}

/** The view: for each rung some capability touches, in the order of `rungs`, the capabilities that touch it and whether each is proved or open there. */
export function viewOf(rungs: readonly RungRecord[], capabilities: readonly CapabilityRecord[], runs: readonly CommandRun[]): string {
  const out: string[] = [];
  for (const rung of rungs) {
    const touching = capabilities.filter((c) => c.touchesRung.includes(rung.id)).sort((a, b) => a.id - b.id);
    if (touching.length === 0) continue;
    out.push(`### ${rung.label} (${rung.id})`, "");
    for (const c of touching) {
      const rev = c.lastRevision.slice(0, 7);
      if (isProved(rung, c.lastRevision, runs)) out.push(`- #${c.id} ${c.title}: proved at ${rev}`);
      else if (rung.provedBy.length === 0) out.push(`- #${c.id} ${c.title}: open, the rung names no command that proves it`);
      else {
        const missing = rung.provedBy.filter((cmd) => !runs.some((r) => r.command === cmd && r.revision === c.lastRevision && r.passed));
        out.push(`- #${c.id} ${c.title}: open, ${missing.map((m) => `\`${m}\``).join(", ")} has no passing run at ${rev}`);
      }
    }
    out.push("");
  }
  return out.join("\n");
}

/** Why a document cannot hold the view. */
export type ViewError = { readonly kind: "no-markers" } | { readonly kind: "misplaced-markers" };

/** A view error as a sentence. */
export function formatViewError(e: ViewError): string {
  switch (e.kind) {
    case "no-markers":
      return `the document has no ${BEGIN} and ${END} lines`;
    case "misplaced-markers":
      return `${BEGIN} must come once, before ${END}, which must come once`;
    default:
      return absurd(e);
  }
}

/** The text between the markers of a document, and where it starts and ends. */
function between(document: string): Result<{ readonly start: number; readonly end: number }, ViewError> {
  const b = document.indexOf(BEGIN);
  const e = document.indexOf(END);
  if (b < 0 && e < 0) return err({ kind: "no-markers" });
  if (b < 0 || e < 0 || e < b || document.indexOf(BEGIN, b + 1) >= 0 || document.indexOf(END, e + 1) >= 0)
    return err({ kind: "misplaced-markers" });
  return ok({ start: b + BEGIN.length, end: e });
}

/** The document with the view between its markers. */
export function spliceView(document: string, view: string): Result<string, ViewError> {
  const r = between(document);
  if (r.kind === "err") return r;
  return ok(`${document.slice(0, r.value.start)}\n\n${view.trim()}\n\n${document.slice(r.value.end)}`);
}

/** Whether the document holds the view as it would be generated (`--check`): `ok(true)` where it does, `ok(false)` where it differs. */
export function viewIsCurrent(document: string, view: string): Result<boolean, ViewError> {
  const r = spliceView(document, view);
  return r.kind === "err" ? r : ok(r.value === document);
}

const rungDecoder = object({ id: string, label: string, provedBy: array(string) }, { homes: array(string) });
const capabilityDecoder = object({ id: integer, title: string, touchesRung: array(string), lastRevision: string });
const runDecoder = object({ command: string, revision: string, passed: boolean });

/** What a harness states for the view: its rungs, its capabilities and the runs of the rungs' commands. */
export type ViewRecord = {
  readonly rungs: readonly RungRecord[];
  readonly capabilities: readonly CapabilityRecord[];
  readonly runs: readonly CommandRun[];
};

/** One exported list of a file read as data and decoded, or why not; `required` says whether its absence is an error. */
function readList<T>(
  source: string,
  name: string,
  decoder: (input: unknown, path?: string) => Result<readonly T[], DecodeError>,
  required: boolean,
): Result<readonly T[], string> {
  if (!new RegExp(`export const ${name}\\b`).test(source)) return required ? err(`the file has no export const ${name}`) : ok([]);
  const lit = exportedLiteral(source, name);
  if (lit.kind === "err") return err(`${name} cannot be read as data: expected ${lit.error.expected}`);
  const r = decoder(lit.value, name);
  return r.kind === "ok" ? ok(r.value) : err(formatDecodeError(r.error));
}

/**
 * The record of a harness's capabilities read from its file's text (`export const rungs`, `export const capabilities` and, where it has them, `export const runs`), as data and never run. The offline
 * view derives its capabilities from the commits (0020-ifccm FR-035), and then the file needs no `capabilities` (`capabilitiesRequired` false).
 * The runs are stated here until the quality records of 0021-ifqs are read in their place.
 */
export function decodeViewRecord(source: string, capabilitiesRequired = true): Result<ViewRecord, string> {
  const rungs = readList(source, "rungs", array(rungDecoder), true);
  if (rungs.kind === "err") return rungs;
  const capabilities = readList(source, "capabilities", array(capabilityDecoder), capabilitiesRequired);
  if (capabilities.kind === "err") return capabilities;
  const runs = readList(source, "runs", array(runDecoder), false);
  if (runs.kind === "err") return runs;
  return ok({ rungs: rungs.value, capabilities: capabilities.value, runs: runs.value });
}
