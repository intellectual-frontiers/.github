// Spec: 0003-governance FR-005, FR-006
/**
 * The elements of a domain and the graph they make (commons data 0003-governance FR-005, FR-006): every element with its identity, kind, name, definition, parent and
 * annotations, in a fixed order, and the graph of what holds what and what refers to what. The logical and the physical layers link their own elements to these identities.
 *
 * @module
 */
import type { Annotation } from "./annotation.ts";
import { attributeId, codeId, codeListId, conceptId, domainId, type ElementId, type ElementKind, relationshipId } from "./id.ts";
import { type Domain, resolve } from "./model.ts";

/** An element of a domain. */
export interface Element {
  readonly id: ElementId;
  readonly kind: ElementKind;
  readonly name: string;
  readonly definition: string;
  /** What holds it; none for the domain. */
  readonly parent?: ElementId;
  readonly annotations: readonly Annotation[];
}

/**
 * Every element of a domain, in a fixed order: the domain, then each concept with its attributes and its relationships, then each code list with its codes.
 *
 * @param d - the domain
 * @returns the elements
 */
export function elementsOf(d: Domain): readonly Element[] {
  const out: Element[] = [{ id: domainId(d.name), kind: "domain", name: d.name, definition: d.definition, annotations: d.annotations }];
  for (const c of d.concepts) {
    const cid = conceptId(d.name, c.name);
    out.push({ id: cid, kind: "concept", name: c.name, definition: c.definition, parent: domainId(d.name), annotations: c.annotations });
    for (const [key, a] of Object.entries(c.attributes)) {
      out.push({
        id: attributeId(d.name, c.name, key),
        kind: "attribute",
        name: key,
        definition: a.definition,
        parent: cid,
        annotations: a.annotations,
      });
    }
    for (const [key, r] of Object.entries(c.relationships)) {
      out.push({
        id: relationshipId(d.name, c.name, key),
        kind: "relationship",
        name: key,
        definition: r.definition,
        parent: cid,
        annotations: r.annotations,
      });
    }
  }
  for (const l of d.codeLists) {
    const lid = codeListId(d.name, l.name);
    out.push({ id: lid, kind: "codelist", name: l.name, definition: l.definition, parent: domainId(d.name), annotations: l.annotations });
    for (const [key, code] of Object.entries(l.codes)) {
      out.push({
        id: codeId(d.name, l.name, key),
        kind: "code",
        name: key,
        definition: code.definition ?? code.label,
        parent: lid,
        annotations: [],
      });
    }
  }
  return out;
}

/** What an edge of the trace graph says. */
export type EdgeKind = "contains" | "identifies" | "references";

/** An edge of the trace graph. */
export interface Edge {
  readonly from: ElementId;
  readonly to: ElementId;
  readonly kind: EdgeKind;
}

/** The elements of a domain and how they are joined. */
export interface TraceGraph {
  readonly nodes: readonly Element[];
  readonly edges: readonly Edge[];
}

/**
 * The trace graph of a domain: its elements as nodes, and as edges `contains` (from an element to what it holds), `identifies` (from a concept to its identifying attributes) and
 * `references` (from a relationship to the concept it points to, and from an attribute of a code list to the list).
 *
 * @param d - the domain
 * @returns the graph
 */
export function traceGraph(d: Domain): TraceGraph {
  const nodes = elementsOf(d);
  const edges: Edge[] = [];
  for (const n of nodes) if (n.parent !== undefined) edges.push({ from: n.parent, to: n.id, kind: "contains" });
  for (const c of d.concepts) {
    const cid = conceptId(d.name, c.name);
    for (const key of c.identifiedBy) {
      edges.push({
        from: cid,
        to: key in c.attributes ? attributeId(d.name, c.name, key) : relationshipId(d.name, c.name, key),
        kind: "identifies",
      });
    }
    for (const [key, r] of Object.entries(c.relationships)) {
      edges.push({ from: relationshipId(d.name, c.name, key), to: conceptId(d.name, resolve(r.to).name), kind: "references" });
    }
    for (const [key, a] of Object.entries(c.attributes)) {
      if (a.type.kind === "code")
        edges.push({ from: attributeId(d.name, c.name, key), to: codeListId(d.name, a.type.list.name), kind: "references" });
    }
  }
  return { nodes, edges };
}
