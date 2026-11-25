// Spec: 0004-workbench-catalog FR-001, FR-002, FR-003
/**
 * The closed catalog of what can go wrong. Each failure an operator can meet has one code, `E-WB-<CONCEPT>-<KIND>`, with the concept it belongs to, who may fix it (the agent, a person, the environment's owner or CI), the one fix
 * and whether it is a safety rule. A failure that is in no entry is `E-WB-UNKNOWN`, and meeting one is itself a finding: it is classified, given a check and a test and documented in one change. Until the day a contract
 * says (`enforceFrom`) every finding that is not a safety rule is only a hint.
 *
 * @example
 * ```ts
 * import { explain, severityOf } from "./catalog.ts";
 * explain("E-WB-WORKSHOP-MISSING-PROGRAM").fixer; // "agent"
 * severityOf(explain("E-WB-WORKSHOP-MISSING-PROGRAM"), false, "2026-12-01", "2027-01-01"); // "hint"
 * ```
 *
 * @module
 */
import type { Concept } from "./terms.ts";

/** Who may fix a failure: a closed list. */
export const FIXERS = ["agent", "person", "environment", "ci"] as const;
/** One kind of fixer. */
export type Fixer = (typeof FIXERS)[number];

/** How a finding is reported: a hint says what to do and never fails; a warning is reported; an error fails. */
export const SEVERITIES = ["hint", "warn", "error"] as const;
/** One severity. */
export type Severity = (typeof SEVERITIES)[number];

/** The codes of the catalog. */
export type CatalogCode =
  | "E-WB-WORKSHOP-MISSING-PROGRAM"
  | "E-WB-WORKSHOP-WRONG-VERSION"
  | "E-WB-WORKSHOP-NETWORK-REFUSED"
  | "E-WB-WORKSHOP-DRIFT"
  | "E-WB-WORKSPACE-GIT-STATE"
  | "E-WB-WORKSPACE-INSTALL-MISSING"
  | "E-WB-WORKSPACE-LAYOUT"
  | "E-WB-WORKBENCH-MISSING-CREDENTIAL"
  | "E-WB-WORKBENCH-AUTHORITY-DENIED"
  | "E-WB-WORKBENCH-SECRET-EXPOSED"
  | "E-WB-WORKSTATION-HARNESS-CONFIG"
  | "E-WB-WORKSTATION-AUTHORITY"
  | "E-WB-UNKNOWN";

/** One entry. `fix` may hold `{name}`, `{minimum}`, `{host}`, `{ref}`, `{folder}`, `{gate}` and `{install}`, filled from the requirement. */
export type CatalogEntry = {
  readonly code: CatalogCode;
  readonly concept: Concept;
  readonly kind: string;
  readonly title: string;
  readonly what: string;
  readonly fixer: Fixer;
  readonly fix: string;
  /** A safety rule is strict whatever the date. */
  readonly safety: boolean;
};

const e = (code: CatalogCode, concept: Concept, kind: string, title: string, what: string, fixer: Fixer, fix: string, safety = false): CatalogEntry => ({ code, concept, kind, title, what, fixer, fix, safety });

/** The catalog: one entry for each code, in the order the explanations are listed. */
export const CATALOG: Readonly<Record<CatalogCode, CatalogEntry>> = {
  "E-WB-WORKSHOP-MISSING-PROGRAM": e("E-WB-WORKSHOP-MISSING-PROGRAM", "workshop", "missing-program", "A program the work needs is not here", "The task runs a program that is not on the PATH of the workshop.", "agent", "install {name}: {install}"),
  "E-WB-WORKSHOP-WRONG-VERSION": e("E-WB-WORKSHOP-WRONG-VERSION", "workshop", "wrong-version", "A program is older than the task needs", "The program is here, at a version below the least the task names.", "agent", "install {name} at {minimum} or later: {install}"),
  "E-WB-WORKSHOP-NETWORK-REFUSED": e("E-WB-WORKSHOP-NETWORK-REFUSED", "workshop", "network-refused", "The network refuses what the task needs", "A host the task reaches is not allowed from this workshop, or refuses the kind of request (a write, a new branch, a tag).", "environment", "ask the owner of the environment to allow {host}, or do this part where it is allowed"),
  "E-WB-WORKSHOP-DRIFT": e("E-WB-WORKSHOP-DRIFT", "workshop", "drift", "The workshop is not what its contract makes", "A cold build of the workshop from the contract is not the workshop that is running.", "ci", "rebuild the workshop from the contract and compare"),
  "E-WB-WORKSPACE-GIT-STATE": e("E-WB-WORKSPACE-GIT-STATE", "workspace", "git-state", "The repository is not in the state the task assumes", "A ref the task compares with is missing (a shallow clone with no origin/main) or the Git identity is not set.", "agent", "fetch what is missing: git fetch --depth 50 origin {ref}"),
  "E-WB-WORKSPACE-INSTALL-MISSING": e("E-WB-WORKSPACE-INSTALL-MISSING", "workspace", "install-missing", "The dependencies of a folder are not installed", "A folder whose tests or build need its own dependencies has no node_modules.", "agent", "install the dependencies of {folder}: {install}"),
  "E-WB-WORKSPACE-LAYOUT": e("E-WB-WORKSPACE-LAYOUT", "workspace", "layout", "The repository is not where the layout puts it", "The checkout is not at $HOME/workspaces/<githost>/<org>/<repo>, so a path does not mean the same here as elsewhere.", "agent", "clone or move it to {path}"),
  "E-WB-WORKBENCH-MISSING-CREDENTIAL": e("E-WB-WORKBENCH-MISSING-CREDENTIAL", "workbench", "missing-credential", "A credential the task needs is not in the environment", "The environment variable the contract names is not set; its value is never read or shown.", "person", "set {name} in the environment of the workshop, with the scope the contract says; never write it in a file"),
  "E-WB-WORKBENCH-AUTHORITY-DENIED": e("E-WB-WORKBENCH-AUTHORITY-DENIED", "workbench", "authority-denied", "This is a person's to do", "The action sits behind a gate that only a person who is not its author may pass.", "person", "stop and hand back: the gate {gate} is passed by its approver"),
  "E-WB-WORKBENCH-SECRET-EXPOSED": e("E-WB-WORKBENCH-SECRET-EXPOSED", "workbench", "secret-exposed", "A secret is in a file", "Text that looks like a credential is in a tracked file that is not a pinned canary.", "person", "remove it, revoke the credential and rewrite what used it", true),
  "E-WB-WORKSTATION-HARNESS-CONFIG": e("E-WB-WORKSTATION-HARNESS-CONFIG", "workstation", "harness-config", "The harness is not configured as the contract says", "A file a dialect generates for the harness is missing or differs from what the contract makes.", "agent", "generate it again: workbench project dialect {name}"),
  "E-WB-WORKSTATION-AUTHORITY": e("E-WB-WORKSTATION-AUTHORITY", "workstation", "authority", "The operator lacks a key or identity the task needs", "A signature, an approval or a login only a person's workstation holds is needed.", "person", "do it from your own workstation: {gate}"),
  "E-WB-UNKNOWN": e("E-WB-UNKNOWN", "workbench", "unknown", "A failure no entry names", "The failure matches no entry of the catalog.", "person", "classify it: add an entry, a check and a test, and document it, in one change"),
};

/** Whether a text is a code of the catalog. */
export function isCatalogCode(text: string): text is CatalogCode {
  return Object.prototype.hasOwnProperty.call(CATALOG, text);
}

/** The entry of a code, or the entry for what is unknown: asking about a code that is none is not an error, it is the first step of classifying it. */
export function explain(code: string): CatalogEntry {
  return isCatalogCode(code) ? CATALOG[code] : CATALOG["E-WB-UNKNOWN"];
}

/** How a finding is reported on a day: a safety rule is always an error; before `enforceFrom` everything else is a hint; from it, an error where the fixer is not the agent alone and a warning where the agent can mend it. */
export function severityOf(entry: CatalogEntry, requirementSafety: boolean, today: string, enforceFrom: string): Severity {
  if (entry.safety || requirementSafety) return "error";
  if (today < enforceFrom) return "hint";
  return entry.fixer === "agent" ? "warn" : "error";
}

/** What `ready` says of one requirement that is not met. */
export type Finding = {
  readonly code: CatalogCode;
  readonly requirement: string;
  readonly concept: Concept;
  readonly severity: Severity;
  readonly message: string;
  readonly fix: string;
  readonly fixer: Fixer;
};

/** A finding as one line. */
export const describeFinding = (f: Finding): string => `${f.severity} ${f.code} ${f.requirement}: ${f.message}; fix (${f.fixer}): ${f.fix}`;
