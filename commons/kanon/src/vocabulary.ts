// Spec: 0002-kanon-content-checks FR-002, FR-003
/**
 * The checks of a model's vocabulary and relations (commons 0033-kanon FR-028, FR-029): two elements with one id, an element or a relation of a kind that the model's vocabulary does not list, an annotation of
 * Governance whose name it does not list, and a relation whose end is no element or whose ends are in two layers. Pure: it reads the model and returns findings in the form of the import check, so that one baseline
 * holds all of them. A model with no vocabulary has no kind and no name checked; the duplicate ids and the relations are checked for every model.
 *
 * @remarks
 * What is an orphan, a broken external link or a chain of redirects is the host's, not Kanon's. A relation may be cyclic: a cycle is no finding.
 *
 * @example
 * ```ts
 * import { modelFindings, type LayeredModel } from "@intellectual-frontiers/kanon";
 * declare const model: LayeredModel;
 * modelFindings(model).map((f) => f.key);
 * ```
 *
 * @module
 */
import { type Finding, finding } from "./imports.ts";
import { traceGraph } from "./trace.ts";
import type { ElementId, LayeredModel, ModelElement } from "./model.ts";

const where = (el: ModelElement | undefined): { readonly file: string; readonly line: number } => ({ file: el?.source.file ?? "(model)", line: el?.source.line ?? 1 });

/** Every finding of the model's vocabulary, relations and ids, in the order of the elements, then of the relations. */
export function modelFindings(model: LayeredModel): readonly Finding[] {
  const out: Finding[] = [];
  const byId = new Map<ElementId, ModelElement>();
  for (const el of model.elements) {
    const first = byId.get(el.id);
    if (first !== undefined) {
      const at = where(el);
      out.push(finding("kanon/duplicate-id", at.file, at.line, `${el.id} is the id of two elements, the first at ${first.source.file}:${first.source.line}`, el.id));
    } else byId.set(el.id, el);
  }
  const v = model.vocabulary;
  if (v !== undefined) {
    const top = model.layers[0]?.id;
    for (const el of model.elements) {
      const listed = v.kinds.find((k) => k.layer === el.layer)?.kinds ?? [];
      const at = where(el);
      if (!listed.includes(el.kind))
        out.push(finding("kanon/kind", at.file, at.line, `${el.id} is of the kind ${JSON.stringify(el.kind)}, which the vocabulary does not list for the layer ${el.layer}`, `${el.id} ${el.kind}`));
      if (el.layer === top)
        for (const name of Object.keys(el.properties))
          if (!v.annotations.includes(name))
            out.push(finding("kanon/annotation", at.file, at.line, `${el.id} has the annotation ${JSON.stringify(name)}, which the vocabulary does not list`, `${el.id} ${name}`));
    }
  }
  for (const r of model.relations ?? []) {
    const from = byId.get(r.from);
    const to = byId.get(r.to);
    const at = where(from);
    const key = `${r.from} ${r.kind} ${r.to}`;
    if (v !== undefined && !v.relationKinds.includes(r.kind))
      out.push(finding("kanon/kind", at.file, at.line, `the relation ${key} is of a kind that the vocabulary does not list`, key));
    if (from === undefined || to === undefined) {
      out.push(finding("kanon/dangling", at.file, at.line, `the relation ${key} has ${from === undefined ? r.from : r.to}, which is no element of the model`, key));
      continue;
    }
    if (from.layer !== to.layer)
      out.push(finding("kanon/relation-layer", at.file, at.line, `the relation ${key} joins the layer ${from.layer} to the layer ${to.layer}: between layers is a trace edge`, key));
  }
  const graph = traceGraph(model, byId);
  for (const edge of graph.invalid) {
    const at = where(byId.get(edge.from) ?? byId.get(edge.to));
    out.push(finding("kanon/trace-invalid", at.file, at.line, `${edge.from} → ${edge.to} must connect adjacent layers in projection order`, `${edge.from} ${edge.to}`));
  }
  const governance = model.elements.filter((element) => element.layer === "governance");
  const connected = graph.downstreamOf(governance.map((element) => element.id));
  for (const element of model.elements) {
    if (element.layer === "governance" || connected.has(element.id)) continue;
    const at = where(element);
    out.push(finding("kanon/trace-missing", at.file, at.line, `${element.id} has no valid trace from Governance`, element.id));
  }
  const dispositions = new Set<string>();
  for (const disposition of model.dispositions) {
    const key = JSON.stringify([disposition.element, disposition.annotation, disposition.instance]);
    if (dispositions.has(key)) {
      const at = where(byId.get(disposition.element));
      out.push(finding("kanon/disposition-duplicate", at.file, at.line, `${disposition.element} gives ${disposition.annotation} more than one disposition for ${disposition.instance ?? "all instances"}`, key));
    }
    dispositions.add(key);
  }
  return out;
}
