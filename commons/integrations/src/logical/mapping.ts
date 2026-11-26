// Spec: 0006-integrations-exchange FR-008, FR-009
/**
 * Mappings between standards, declared as data (commons integrations 0006-integrations-exchange): from a standard to a canonical shape or to another standard,
 * such as an X12 837 to a FHIR Claim. Each field of the source ends in exactly one of three states (Kanon rule 5): mapped, carried (kept as it is in a named place)
 * or dropped by name with its reason. A field that ends in none is a finding, and so is a mapping that drops anything, because a lossy mapping is a finding.
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import type { Ref } from "@intellectual-frontiers/integrations/governance";
import { finding, type Finding } from "./constraints.ts";
import { element, entries, pathsOf, segment, type Segment, type Transaction } from "./tree.ts";

/** How a value changes on its way. */
export type Transform =
  | { readonly kind: "identity" }
  | { readonly kind: "upper" }
  | { readonly kind: "lower" }
  | { readonly kind: "trim" }
  | { readonly kind: "table"; readonly table: Readonly<Record<string, string>>; readonly otherwise: "keep" | "drop" };

/** What a mapping does with one field, or a subtree, of the source (a path stands for everything below it). */
export type MapRule =
  | { readonly kind: "map"; readonly from: string; readonly to: string; readonly transform: Transform }
  | { readonly kind: "carry"; readonly from: string; readonly to: string }
  | { readonly kind: "drop"; readonly from: string; readonly reason: string };

/** A mapping between two schemas. */
export type Mapping = { readonly id: string; readonly source: Ref<"schema">; readonly target: Ref<"schema">; readonly sourceTransaction: string; readonly targetTransaction: string; readonly rules: readonly MapRule[] };

/** A value through a transform; `undefined` where a table drops it. */
export function applyTransform(t: Transform, value: string): string | undefined {
  switch (t.kind) {
    case "identity":
      return value;
    case "upper":
      return value.toUpperCase();
    case "lower":
      return value.toLowerCase();
    case "trim":
      return value.trim();
    case "table":
      return Object.hasOwn(t.table, value) ? t.table[value] : t.otherwise === "keep" ? value : undefined;
    default:
      return absurd(t);
  }
}

const covers = (from: string, path: string): boolean => path === from || path.startsWith(`${from}.`);

/** The rule that says what becomes of a path: the most specific one. */
export function ruleFor(m: Mapping, path: string): MapRule | undefined {
  let best: MapRule | undefined;
  for (const r of m.rules) if (covers(r.from, path) && (best === undefined || r.from.length > best.from.length)) best = r;
  return best;
}

/** The findings of a mapping against the paths of its source (the value-bearing ones): a path that ends in no rule, a rule on no path, a target written by two rules, and a drop. */
export function coverage(m: Mapping, sourcePaths: readonly string[]): readonly Finding[] {
  const out: Finding[] = [];
  for (const p of sourcePaths) if (ruleFor(m, p) === undefined) out.push(finding("schema", "error", "unmapped-source-field", p, "no rule maps, carries or drops it"));
  for (const r of m.rules) {
    if (!sourcePaths.some((p) => covers(r.from, p))) out.push(finding("schema", "warning", "unknown-path", r.from, "a rule of the mapping names no field of the source"));
    if (r.kind === "drop") out.push(finding("schema", "warning", "lossy-mapping", r.from, `dropped: ${r.reason}`));
  }
  const targets = new Map<string, string>();
  for (const r of m.rules) {
    if (r.kind === "drop") continue;
    const before = targets.get(r.to);
    if (before !== undefined && before !== r.from) out.push(finding("schema", "error", "mapping-target-conflict", r.to, "two sources are written to it"));
    targets.set(r.to, r.from);
  }
  return out;
}

/** Every path a transaction has: for a schema's own list of paths. */
export const allPaths = pathsOf;

/**
 * A source transaction translated by a mapping into a flat transaction of the target: one segment for each value, its id the path below the target's root. A value of a
 * field that is dropped is not written; a value whose path has no rule stops the translation with `unmapped-source-field`, so that nothing is lost silently.
 */
export function translate(m: Mapping, source: Transaction): Result<Transaction, readonly Finding[]> {
  if (source.id !== m.sourceTransaction) return err([finding("schema", "error", "unknown-path", source.id, "the transaction is not the mapping's source")]);
  const findings: Finding[] = [];
  const children: Segment[] = [];
  for (const e of entries(source)) {
    const r = ruleFor(m, e.path);
    if (r === undefined) {
      findings.push(finding("schema", "error", "unmapped-source-field", e.at));
      continue;
    }
    switch (r.kind) {
      case "drop":
        break;
      case "map":
      case "carry": {
        const v = r.kind === "map" ? applyTransform(r.transform, e.value) : e.value;
        if (v === undefined) break;
        const target = r.to + e.path.slice(r.from.length);
        children.push(segment(target.startsWith(`${m.targetTransaction}.`) ? target.slice(m.targetTransaction.length + 1) : target, element("", v)));
        break;
      }
      default:
        return absurd(r);
    }
  }
  return findings.length > 0 ? err(findings) : ok({ kind: "transaction", id: m.targetTransaction, control: source.control, children });
}
