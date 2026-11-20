// Spec: 0001-kanon-checker FR-005
/**
 * The check that nothing is silently dropped (commons 0033-kanon FR-005): each annotation of an element of the Governance layer of a model (each of its `properties`) must end in one of three
 * ways, said by a disposition of the model: expressed (a lower element enforces it), carried (a lower element passes it on as data) or unexpressed (named, with its reason). An annotation with
 * none, or whose disposition names a target that is no element of the model, or an unexpressed one with no reason, is a finding `kanon/dropped`.
 *
 * @remarks
 * Pure: it reads the model and returns findings in the form of the import check, so that one baseline holds both. The top layer is the first of the model's layers.
 *
 * @example
 * ```ts
 * import { droppedFindings, type LayeredModel } from "@intellectual-frontiers/kanon";
 * declare const model: LayeredModel;
 * droppedFindings(model).map((f) => f.key);
 * ```
 *
 * @module
 */
import { type Finding, finding } from "./imports.ts";
import type { LayeredModel } from "./model.ts";

/** Every annotation of Governance that the model does not account for, one finding each, in the order of the elements and of their annotations. */
export function droppedFindings(model: LayeredModel): readonly Finding[] {
  const top = model.layers[0]?.id;
  if (top === undefined) return [];
  const ids = new Set(model.elements.map((e) => e.id));
  const out: Finding[] = [];
  for (const el of model.elements) {
    if (el.layer !== top) continue;
    for (const annotation of Object.keys(el.properties)) {
      const d = model.dispositions.find((x) => x.element === el.id && x.annotation === annotation);
      const at = (message: string): Finding => finding("kanon/dropped", el.source.file, el.source.line, message, `${el.id} ${annotation}`);
      if (d === undefined) {
        out.push(
          at(
            `${el.id} has the annotation ${annotation}, and no lower element expresses it or carries it, and nothing names it as unexpressed`,
          ),
        );
      } else if (d.outcome === "unexpressed") {
        if (d.reason.trim() === "") out.push(at(`${el.id} names ${annotation} as unexpressed and gives no reason`));
      } else if (!ids.has(d.target)) {
        out.push(at(`${el.id} says ${annotation} is ${d.outcome} by ${d.target}, which is no element of the model`));
      }
    }
  }
  return out;
}
