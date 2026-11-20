// Spec: 0002-grc-governance FR-001, FR-002, FR-003, FR-005, FR-007, FR-008
/**
 * What governance says about its documents, as pure functions: the URN of a control, the controls a crosswalk reaches, when a policy is next reviewed, whether an exception applies, the enforcement
 * register a requirement's verification is a row of, and the problems of a set of documents (a control no framework holds, a check nothing names).
 *
 * @example
 * ```ts
 * import { controlUrn, parseControlUrn } from "./rules.ts";
 * controlUrn("nist-800-53", "5.2.0", "AC-2"); // "urn:grc:nist-800-53:5.2.0:AC-2"
 * parseControlUrn("urn:grc:a:1:B-1"); // { kind: "ok", value: { framework: "a", version: "1", control: "B-1" } }
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Document } from "./document.ts";
import { globMatches } from "./glob.ts";
import type { Check, Crosswalk, Exception, Framework, Mechanism, Policy, Relationship, Requirement } from "./kinds.ts";
import { MECHANISMS } from "./kinds.ts";
import { STABLE_ID } from "./registry.ts";
import { addDuration, instantMs, parseDuration } from "./time.ts";

/** The parts of a control's URN. */
export type ControlRef = { readonly framework: string; readonly version: string; readonly control: string };

/** The stable URN of a control: `urn:grc:<framework>:<version>:<control>`. */
export function controlUrn(framework: string, version: string, control: string): string {
  return `urn:grc:${framework}:${version}:${control}`;
}

/** The parts of a control's URN, or why the text is not one. */
export function parseControlUrn(urn: string): Result<ControlRef, string> {
  const m = /^urn:grc:([a-z][a-z0-9-]*):([A-Za-z0-9._-]+):([^\s:]+)$/.exec(urn);
  if (m === null || m[1] === undefined || m[2] === undefined || m[3] === undefined) return err(`${urn} is not urn:grc:<framework>:<version>:<control>`);
  return ok({ framework: m[1], version: m[2], control: m[3] });
}

/** The URNs of every control of the frameworks. */
export function controlUrns(frameworks: readonly Framework[]): readonly string[] {
  return frameworks.flatMap((f) => f.controls.map((c) => controlUrn(f.id, f.version, c.id)));
}

/** A control a crosswalk reaches. */
export type Mapped = { readonly urn: string; readonly relationship: Relationship; readonly strength: number; readonly via: string };

const FLIP: Readonly<Record<Relationship, Relationship>> = {
  equal: "equal",
  "subset-of": "superset-of",
  "superset-of": "subset-of",
  "intersects-with": "intersects-with",
  "no-relationship": "no-relationship",
};

/** The controls reached from `urn` through the crosswalks, in both directions (a reverse mapping reads the relationship the other way), in the order of their URNs. */
export function mappedControls(crosswalks: readonly Crosswalk[], urn: string): readonly Mapped[] {
  const out: Mapped[] = [];
  for (const c of crosswalks) {
    for (const m of c.mappings) {
      if (m.from === urn) out.push({ urn: m.to, relationship: m.relationship, strength: m.strength, via: c.id });
      else if (m.to === urn) out.push({ urn: m.from, relationship: FLIP[m.relationship], strength: m.strength, via: c.id });
    }
  }
  return out.sort((a, b) => (a.urn < b.urn ? -1 : a.urn > b.urn ? 1 : 0));
}

/** When a policy's review falls due: its cadence after the last review (or after it was created). */
export function reviewDue(p: Policy): Result<string, string> {
  return addDuration(p.review.lastReviewed ?? p.createdAt, p.review.cadence);
}

/** Whether an exception applies to a subject at an instant: after it is granted, before it expires, and covering the subject. */
export function exceptionApplies(e: Exception, subject: string, at: string): boolean {
  const t = instantMs(at);
  const g = instantMs(e.grantedAt);
  const x = instantMs(e.expiresAt);
  if (t === undefined || g === undefined || x === undefined) return false;
  return t >= g && t < x && e.subjects.some((s) => globMatches(s, subject));
}

/** A row of the enforcement register of Mizan (`enforcement.tsv`): a requirement, how it is enforced, by what. */
export type EnforcementRow = { readonly requirement: string; readonly mechanism: Mechanism; readonly by: string; readonly note: string };

/** The rows of an enforcement register's TSV (comment lines and the header skipped), or why a line is not a row. */
export function fromEnforcementRegister(tsv: string): Result<readonly EnforcementRow[], string> {
  const rows: EnforcementRow[] = [];
  for (const [i, line] of tsv.split("\n").entries()) {
    if (line.trim() === "" || line.startsWith("#") || line.startsWith("requirement\t")) continue;
    const [requirement, mechanism, by, ...note] = line.split("\t");
    const m = MECHANISMS.find((x) => x === mechanism);
    if (requirement === undefined || m === undefined || by === undefined) return err(`line ${i + 1} is not a row of the register: requirement, mechanism, by, note`);
    rows.push({ requirement, mechanism: m, by, note: note.join("\t") });
  }
  return ok(rows);
}

/** The register's TSV of the verification of requirements, in the order given. */
export function toEnforcementRegister(requirements: readonly Requirement[]): string {
  const head = ["requirement\tmechanism\tby\tnote"];
  return [...head, ...requirements.map((r) => `${r.id}\t${r.verification.mechanism}\t${r.verification.by}\t${r.verification.note ?? ""}`)].join("\n") + "\n";
}

/** What `governanceProblems` reads. */
export type GovernanceSet = {
  readonly frameworks: readonly Framework[];
  readonly crosswalks?: readonly Crosswalk[];
  readonly policies?: readonly Policy[];
  readonly checks?: readonly Check[];
  readonly requirements?: readonly Requirement[];
  readonly exceptions?: readonly Exception[];
};

/** The rules of `governanceProblems`. */
export type GovernanceRule =
  | "framework/duplicate-control"
  | "control/unknown"
  | "policy/unknown-check"
  | "policy/no-control"
  | "id/duplicate"
  | "duration/invalid"
  | "runner/unstable-kind"
  | "exception/excuses-nothing";

/** A problem of a set of governance documents. */
export type GovernanceProblem = { readonly rule: GovernanceRule; readonly id: string; readonly message: string };

/** Every problem of a set of governance documents, as data. */
export function governanceProblems(set: GovernanceSet): readonly GovernanceProblem[] {
  const out: GovernanceProblem[] = [];
  const problem = (rule: GovernanceRule, id: string, message: string): number => out.push({ rule, id, message });
  const known = new Set(controlUrns(set.frameworks));
  for (const f of set.frameworks) {
    const seen = new Set<string>();
    for (const c of f.controls) {
      if (seen.has(c.id)) problem("framework/duplicate-control", f.id, `${f.id} holds the control ${c.id} twice`);
      seen.add(c.id);
    }
  }
  const documents: readonly Document[] = [
    ...set.frameworks,
    ...(set.crosswalks ?? []),
    ...(set.policies ?? []),
    ...(set.checks ?? []),
    ...(set.requirements ?? []),
    ...(set.exceptions ?? []),
  ];
  const ids = new Set<string>();
  for (const d of documents) {
    const key = `${d.kind} ${d.id}`;
    if (ids.has(key)) problem("id/duplicate", d.id, `${d.kind} ${d.id} is used twice`);
    ids.add(key);
  }
  const unknown = (owner: string, urns: readonly string[]): void => {
    for (const u of urns) if (!known.has(u)) problem("control/unknown", owner, `${owner} names ${u}, which no framework loaded holds`);
  };
  const checkIds = new Set((set.checks ?? []).map((c) => c.id));
  for (const p of set.policies ?? []) {
    unknown(p.id, p.controls);
    if (p.controls.length === 0) problem("policy/no-control", p.id, `${p.id} maps to no control`);
    for (const c of p.checks) if (!checkIds.has(c)) problem("policy/unknown-check", p.id, `${p.id} names the check ${c}, which does not exist`);
    if (parseDuration(p.review.cadence).kind === "err") problem("duration/invalid", p.id, `${p.id}: ${p.review.cadence} is not a duration`);
  }
  for (const c of set.checks ?? []) {
    unknown(c.id, c.controls);
    if (!STABLE_ID.test(c.runner.kind)) problem("runner/unstable-kind", c.id, `${c.id} names the runner kind ${c.runner.kind}, which is not a stable id`);
    if (parseDuration(c.freshness).kind === "err") problem("duration/invalid", c.id, `${c.id}: ${c.freshness} is not a duration`);
  }
  for (const r of set.requirements ?? []) unknown(r.id, r.controls);
  const policyIds = new Set((set.policies ?? []).map((p) => p.id));
  for (const e of set.exceptions ?? []) {
    const { type, ref } = e.excuses;
    const exists = type === "control" ? known.has(ref) : type === "check" ? checkIds.has(ref) : policyIds.has(ref);
    if (!exists) problem("exception/excuses-nothing", e.id, `${e.id} excuses the ${type} ${ref}, which does not exist`);
  }
  return out;
}
