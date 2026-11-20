// Spec: 0001-kanon-checker FR-013
/**
 * How one annotation of Governance ends for one instance (commons 0033-kanon FR-005, FR-022): the single reading of a model's dispositions that both the check of dropped annotations and the matrix
 * of requirement by instance are made from, so that they cannot disagree.
 *
 * @remarks
 * Pure and total: every annotation and instance has a `Cell`, one case of the closed union `Cell`. A disposition given for an instance wins over one given for none; where neither is, or where the
 * one found is empty (no reason) or points at no element of the model, or at an element of another instance, the cell is `dropped`, with the sentence that says why.
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import type { InstanceName } from "./family.ts";
import type { Disposition, ElementId, LayeredModel, ModelElement } from "./model.ts";

/** How an annotation ends for an instance: the three ways of 0033-kanon FR-005, and `dropped` where it ends in none of them (a finding). */
export type Cell =
  | { readonly outcome: "expressed"; readonly target: ElementId }
  | { readonly outcome: "carried"; readonly target: ElementId }
  | { readonly outcome: "unexpressed"; readonly reason: string }
  | { readonly outcome: "dropped"; readonly why: string };

/** The outcomes of a cell, in one list, for a program that walks them. */
export const OUTCOMES = ["expressed", "carried", "unexpressed", "dropped"] as const satisfies readonly Cell["outcome"][];

/** The disposition of an annotation for an instance: the one given for that instance, or else the one given for none. */
function pick(model: LayeredModel, element: ElementId, annotation: string, scope: InstanceName | undefined): Disposition | undefined {
  const mine = model.dispositions.filter((d) => d.element === element && d.annotation === annotation);
  return mine.find((d) => scope !== undefined && d.instance === scope) ?? mine.find((d) => d.instance === undefined);
}

/** The words that name an instance in a sentence: nothing where the model has none. */
export const forInstance = (scope: InstanceName | undefined): string => (scope === undefined ? "" : ` for the instance ${scope}`);

/** How the annotation of an element ends for an instance (`undefined` where the model has no instances): one cell. */
export function accountOf(model: LayeredModel, el: ModelElement, annotation: string, scope: InstanceName | undefined): Cell {
  const d = pick(model, el.id, annotation, scope);
  if (d === undefined)
    return {
      outcome: "dropped",
      why: `${el.id} has the annotation ${annotation}${forInstance(scope)}, and no lower element expresses it or carries it, and nothing names it as unexpressed`,
    };
  switch (d.outcome) {
    case "unexpressed":
      return d.reason.trim() === ""
        ? { outcome: "dropped", why: `${el.id} names ${annotation} as unexpressed${forInstance(scope)} and gives no reason` }
        : { outcome: "unexpressed", reason: d.reason };
    case "expressed":
    case "carried": {
      const target = model.elements.find((e) => e.id === d.target);
      if (target === undefined)
        return { outcome: "dropped", why: `${el.id} says ${annotation} is ${d.outcome}${forInstance(scope)} by ${d.target}, which is no element of the model` };
      if (scope !== undefined && target.instance !== undefined && target.instance !== scope)
        return {
          outcome: "dropped",
          why: `${el.id} says ${annotation} is ${d.outcome} for the instance ${scope} by ${d.target}, which belongs to the instance ${target.instance}`,
        };
      return { outcome: d.outcome, target: d.target };
    }
    default:
      return absurd(d);
  }
}
