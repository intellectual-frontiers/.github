// Spec: 0006-integrations-exchange FR-004, FR-005, FR-006, FR-007
/**
 * Schema and Profile as typed constraints over the abstract tree, and validation (commons integrations 0006-integrations-exchange): a schema says which paths a
 * transaction has and how many times, a profile adds constraints to a schema, a terminology says which codes a binding allows, and validation gives findings at the level
 * where each was found (syntax, schema, profile, terminology, business rule).
 *
 * @remarks
 * A finding has a level, a severity, a path, a code and a message made of the code and the path: it never holds a value of the payload, so that findings may be logged
 * (commons integrations 0003-integrations-logical FR-003). A business rule is a function of the tree that returns findings, supplied by an agreement.
 *
 * @module
 */
import { absurd, type Result } from "@intellectual-frontiers/core";
import type { BindingStrength, Ref, StandardUrn } from "@intellectual-frontiers/integrations/governance";
import { entries, occurrences, pathsOf, type Transaction } from "./tree.ts";

/** Where a finding was found. */
export type FindingLevel = "syntax" | "schema" | "profile" | "terminology" | "business-rule";

/** How bad a finding is. */
export type Severity = "error" | "warning" | "information";

/** What a finding says. */
export type FindingCode =
  | "syntax-error"
  | "unknown-path"
  | "cardinality-min"
  | "cardinality-max"
  | "value-pattern"
  | "value-fixed"
  | "code-not-in-terminology"
  | "terminology-unavailable"
  | "business-rule"
  | "unmapped-source-field"
  | "lossy-mapping"
  | "mapping-target-conflict";

const FINDING_CODE_TABLE: Readonly<Record<FindingCode, true>> = {
  "syntax-error": true,
  "unknown-path": true,
  "cardinality-min": true,
  "cardinality-max": true,
  "value-pattern": true,
  "value-fixed": true,
  "code-not-in-terminology": true,
  "terminology-unavailable": true,
  "business-rule": true,
  "unmapped-source-field": true,
  "lossy-mapping": true,
  "mapping-target-conflict": true,
};

/** Every finding code, as a closed list of strings a consumer may carry as data; the compiler holds it complete against `FindingCode`. */
export const FINDING_CODES: readonly FindingCode[] = Object.keys(FINDING_CODE_TABLE).filter((k): k is FindingCode => Object.hasOwn(FINDING_CODE_TABLE, k));

/** Every level of a finding. */
export const FINDING_LEVELS: readonly FindingLevel[] = ["syntax", "schema", "profile", "terminology", "business-rule"];

/** A finding: never a value of the payload. */
export type Finding = { readonly level: FindingLevel; readonly severity: Severity; readonly code: FindingCode; readonly path: string; readonly message: string };

/** A finding from its parts, its message made of the code and the path. */
export const finding = (level: FindingLevel, severity: Severity, code: FindingCode, path: string, note = ""): Finding => ({ level, severity, code, path, message: `${code} at ${path}${note === "" ? "" : `: ${note}`}` });

/** What a path of a schema must be. */
export type Constraint =
  | { readonly kind: "cardinality"; readonly path: string; readonly min: number; readonly max: number | "*" }
  | { readonly kind: "choice"; readonly path: string; readonly alternatives: readonly string[]; readonly min: number; readonly max: number | "*" }
  | { readonly kind: "pattern"; readonly path: string; readonly regex: string }
  | { readonly kind: "fixed"; readonly path: string; readonly value: string }
  | { readonly kind: "binding"; readonly path: string; readonly terminology: Ref<"terminology">; readonly strength: BindingStrength };

/** A schema: the paths a kind of transaction has, with their constraints. A path with no constraint is allowed; a path not listed (and not below a listed one) is unknown. */
export type Schema = { readonly id: Ref<"schema">; readonly transaction: string; readonly paths: readonly string[]; readonly constraints: readonly Constraint[] };

/** A profile: more constraints on a schema. */
export type Profile = { readonly id: Ref<"profile">; readonly schema: Ref<"schema">; readonly constraints: readonly Constraint[] };

/** A code system or value set, as the codes it holds. Loaded from data the user supplies or the issuer publishes; the library embeds none. */
export type Terminology = { readonly id: Ref<"terminology">; readonly codes: ReadonlySet<string> };

/** Terminologies by urn. */
export type Terminologies = ReadonlyMap<StandardUrn, Terminology>;

/** A rule of business: a function of a transaction that gives findings (never of values). */
export type BusinessRule = (t: Transaction) => readonly Finding[];

function severityOf(strength: BindingStrength): Severity | undefined {
  switch (strength) {
    case "required":
      return "error";
    case "extensible":
      return "warning";
    case "preferred":
      return "information";
    case "example":
      return undefined;
    default:
      return absurd(strength);
  }
}

function checkConstraint(c: Constraint, level: "schema" | "profile", t: Transaction, terms: Terminologies): readonly Finding[] {
  const out: Finding[] = [];
  switch (c.kind) {
    case "cardinality":
      for (const [parent, n] of occurrences(t, c.path)) {
        if (n < c.min) out.push(finding(level, "error", "cardinality-min", parent === t.id ? c.path : `${parent}.${c.path.slice(c.path.lastIndexOf(".") + 1)}`, `${n} of at least ${c.min}`));
        if (c.max !== "*" && n > c.max) out.push(finding(level, "error", "cardinality-max", parent === t.id ? c.path : `${parent}.${c.path.slice(c.path.lastIndexOf(".") + 1)}`, `${n} of at most ${c.max}`));
      }
      return out;
    case "choice": {
      // a choice is one of its alternatives: the occurrences of all of them under one parent are counted together, and each is a path the schema knows
      const total = new Map<string, number>();
      const parents = new Set<string>();
      for (const alt of c.alternatives) {
        for (const [parent, n] of occurrences(t, alt)) {
          parents.add(parent);
          total.set(parent, (total.get(parent) ?? 0) + n);
        }
      }
      for (const parent of parents) {
        const n = total.get(parent) ?? 0;
        if (n < c.min) out.push(finding(level, "error", "cardinality-min", `${parent}.${c.path.slice(c.path.lastIndexOf(".") + 1)}[x]`, `${n} of at least ${c.min}`));
        if (c.max !== "*" && n > c.max) out.push(finding(level, "error", "cardinality-max", `${parent}.${c.path.slice(c.path.lastIndexOf(".") + 1)}[x]`, `${n} of at most ${c.max}`));
      }
      return out;
    }
    case "pattern": {
      const re = new RegExp(c.regex);
      for (const e of entries(t)) if (e.path === c.path && !re.test(e.value)) out.push(finding(level, "error", "value-pattern", e.at, "does not match the pattern"));
      return out;
    }
    case "fixed":
      for (const e of entries(t)) if (e.path === c.path && e.value !== c.value) out.push(finding(level, "error", "value-fixed", e.at, "is not the fixed value"));
      return out;
    case "binding": {
      const severity = severityOf(c.strength);
      if (severity === undefined) return out;
      const terminology = terms.get(c.terminology.urn);
      for (const e of entries(t)) {
        if (e.path !== c.path) continue;
        if (terminology === undefined) out.push(finding("terminology", "warning", "terminology-unavailable", e.at, "the terminology was not loaded"));
        else if (!terminology.codes.has(e.value)) out.push(finding("terminology", severity, "code-not-in-terminology", e.at, "the code is not in the bound terminology"));
      }
      return out;
    }
    default:
      return absurd(c);
  }
}

/** Every finding of a transaction against a schema, a profile where given, the terminologies loaded, and the rules of business supplied, in that order of level. Total and pure. */
export function validate(t: Transaction, schema: Schema, options: { readonly profile?: Profile; readonly terminologies?: Terminologies; readonly rules?: readonly BusinessRule[] } = {}): readonly Finding[] {
  const terms = options.terminologies ?? new Map();
  const out: Finding[] = [];
  if (t.id !== schema.transaction) out.push(finding("schema", "error", "unknown-path", t.id, "the transaction is not the schema's"));
  const known = new Set(schema.paths);
  for (const p of pathsOf(t)) {
    if (!known.has(p) && ![...known].some((k) => k !== t.id && p.startsWith(`${k}.`))) out.push(finding("schema", "error", "unknown-path", p));
  }
  for (const c of schema.constraints) out.push(...checkConstraint(c, "schema", t, terms));
  if (options.profile !== undefined) for (const c of options.profile.constraints) out.push(...checkConstraint(c, "profile", t, terms));
  for (const r of options.rules ?? []) out.push(...r(t));
  return out;
}

/** Whether the findings hold an error. */
export const hasErrors = (fs: readonly Finding[]): boolean => fs.some((f) => f.severity === "error");

/** A result of a step that may give findings: the value, or the findings that stopped it. */
export type Checked<T> = Result<T, readonly Finding[]>;
