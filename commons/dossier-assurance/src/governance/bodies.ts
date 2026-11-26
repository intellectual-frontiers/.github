// Spec: 0002-assurance-lenses FR-001
/**
 * The shapes of the sources the lenses of an assurance dossier read (commons dossier-assurance 0002-assurance-lenses FR-001): the run of an acceptance case, a set of findings and the reading of a requirement, each decoded from JSON by a guard that says what is wrong.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Json } from "@intellectual-frontiers/dossier/governance";

/** The kinds of source. */
export const KINDS = { acceptance: "acceptance-run", findings: "finding-set", reading: "reading" } as const;

/** One step of a case. */
export interface Step {
  readonly id: string;
  readonly title: string;
  readonly result: "pass" | "fail" | "not-run";
  readonly by: "tool" | "person";
  readonly note?: string;
}

/** The run of an acceptance case. */
export interface AcceptanceRun {
  readonly case: string;
  readonly title: string;
  readonly os?: string;
  readonly steps: readonly Step[];
  /** The person who approved the run, where one has. */
  readonly approvedBy?: string;
}

/** A finding. */
export interface Finding {
  readonly id: string;
  readonly title: string;
  readonly severity: "critical" | "high" | "medium" | "low";
  readonly status: "open" | "accepted" | "fixed";
  readonly control?: string;
  readonly milestone?: string;
  readonly due?: string;
}

/** A set of findings. */
export interface FindingSet {
  readonly findings: readonly Finding[];
}

/** The standings of a requirement. */
export const STANDINGS = ["met", "partial", "not-met", "no-evidence"] as const;

/** The reading of a requirement. */
export interface Reading {
  readonly requirement: string;
  readonly standing: (typeof STANDINGS)[number];
}

const rec = (j: Json): j is { readonly [k: string]: Json } => typeof j === "object" && j !== null && !Array.isArray(j);
const str = (j: Json | undefined): j is string => typeof j === "string" && j !== "";
const one = <T extends string>(j: Json | undefined, of: readonly T[]): j is T => typeof j === "string" && (of as readonly string[]).includes(j);

/** The run of an acceptance case from a body. */
export function decodeRun(j: Json): Result<AcceptanceRun, string> {
  if (!rec(j) || !str(j["case"]) || !str(j["title"]) || !Array.isArray(j["steps"])) return err("an acceptance run is { case, title, steps }");
  const steps: Step[] = [];
  for (const s of j["steps"]) {
    if (!rec(s) || !str(s["id"]) || !str(s["title"]) || !one(s["result"], ["pass", "fail", "not-run"] as const) || !one(s["by"], ["tool", "person"] as const)) return err("a step is { id, title, result, by }");
    steps.push({ id: s["id"], title: s["title"], result: s["result"], by: s["by"], ...(str(s["note"]) ? { note: s["note"] } : {}) });
  }
  return ok({ case: j["case"], title: j["title"], steps, ...(str(j["os"]) ? { os: j["os"] } : {}), ...(str(j["approvedBy"]) ? { approvedBy: j["approvedBy"] } : {}) });
}

/** A set of findings from a body. */
export function decodeFindings(j: Json): Result<FindingSet, string> {
  if (!rec(j) || !Array.isArray(j["findings"])) return err("a set of findings is { findings }");
  const findings: Finding[] = [];
  for (const f of j["findings"]) {
    if (!rec(f) || !str(f["id"]) || !str(f["title"]) || !one(f["severity"], ["critical", "high", "medium", "low"] as const) || !one(f["status"], ["open", "accepted", "fixed"] as const)) return err("a finding is { id, title, severity, status }");
    findings.push({ id: f["id"], title: f["title"], severity: f["severity"], status: f["status"], ...(str(f["control"]) ? { control: f["control"] } : {}), ...(str(f["milestone"]) ? { milestone: f["milestone"] } : {}), ...(str(f["due"]) ? { due: f["due"] } : {}) });
  }
  return ok({ findings });
}

/** The reading of a requirement from a body. */
export function decodeReading(j: Json): Result<Reading, string> {
  if (!rec(j) || !str(j["requirement"]) || !one(j["standing"], STANDINGS)) return err("a reading is { requirement, standing }");
  return ok({ requirement: j["requirement"], standing: j["standing"] });
}
