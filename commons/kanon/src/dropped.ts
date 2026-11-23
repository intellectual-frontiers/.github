// Spec: 0001-kanon-checker FR-005, FR-013
/**
 * The check that nothing is silently dropped (commons 0033-kanon FR-005): each annotation of an element of the Governance layer of a model (each of its `properties`) must end in one of three
 * ways, said by a disposition of the model: expressed (a lower element enforces it), carried (a lower element passes it on as data) or unexpressed (named, with its reason). An annotation with
 * none, or whose disposition names a target that is no element of the model, or an unexpressed one with no reason, is a finding `kanon/dropped`. Where the model has instances (dialects) the rule holds for each
 * instance (0033-kanon FR-022): an annotation accounted for one dialect and not another is a finding naming the other.
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
import { traceGraph } from "./trace.ts";
import { accountOf } from "./account.ts";
import { type Finding, finding } from "./imports.ts";
import type { LayeredModel } from "./model.ts";

/** Every annotation of Governance that the model does not account for, for each instance it has, one finding each, in the order of the elements, of their annotations and of the instances. */
export function droppedFindings(model: LayeredModel): readonly Finding[] {
  const top = model.layers[0]?.id;
  if (top === undefined) return [];
  const out: Finding[] = [];
  const scopes = model.instances.length === 0 ? [undefined] : model.instances;
  const graph = traceGraph(model, new Map(model.elements.map((el) => [el.id, el])));
  for (const el of model.elements) {
    if (el.layer !== top) continue;
    const downstream = graph.downstreamOf([el.id]);
    for (const annotation of Object.keys(el.properties)) {
      for (const scope of scopes) {
        const cell = accountOf(model, el, annotation, scope, downstream);
        if (cell.outcome === "dropped")
          out.push(
            finding("kanon/dropped", el.source.file, el.source.line, cell.why, `${el.id} ${annotation}${scope === undefined ? "" : ` @${scope}`}`),
          );
      }
    }
  }
  for (const d of model.dispositions) {
    if (d.instance === undefined || model.instances.includes(d.instance)) continue;
    const el = model.elements.find((e) => e.id === d.element);
    out.push(
      finding(
        "kanon/dropped",
        el?.source.file ?? "(model)",
        el?.source.line ?? 1,
        `${d.element} gives ${d.annotation} a disposition for the instance ${d.instance}, which is no instance of the model`,
        `${d.element} ${d.annotation} @${d.instance}`,
      ),
    );
  }
  return out;
}
