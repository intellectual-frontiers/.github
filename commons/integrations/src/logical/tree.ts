// Spec: 0006-integrations-exchange FR-001, FR-002, FR-003
/**
 * The abstract typed tree of exchange (commons integrations 0006-integrations-exchange): an interchange of groups of transactions of segments and loops of
 * elements, the one shape that X12, HL7 v2, EDIFACT and FHIR all map to, so that validation, mapping and redaction are written once.
 *
 * @remarks
 * A path is the ids from the transaction down, joined by `.`, an element with an empty id (the value of a segment that is one value, a primitive of FHIR) adding
 * nothing: `Patient.birthDate`, `PID.05`, `NM1.03`. A path with no indices is the path of the schema; an indexed one (`Patient.name[0].family`) is of one instance.
 *
 * @module
 */
import type { Ref } from "@intellectual-frontiers/integrations/governance";

/** An element: one value, which may have components (an HL7 v2 composite, an X12 composite). */
export type Element = { readonly kind: "element"; readonly id: string; readonly value: string; readonly components: readonly Element[] };
/** A segment: a named run of elements. */
export type Segment = { readonly kind: "segment"; readonly id: string; readonly elements: readonly Element[] };
/** A loop: a named run of segments and loops. */
export type Loop = { readonly kind: "loop"; readonly id: string; readonly children: readonly Part[] };
/** What a loop or a transaction holds. */
export type Part = Segment | Loop;
/** The segments that open and close a node, where its syntax has them (X12's ISA and IEA, GS and GE, ST and SE): kept so that what was read is written back and its control counts can be checked. */
export type Envelope = { readonly header: readonly Segment[]; readonly trailer: readonly Segment[] };
/** A transaction: one message or document (an 837, an ADT^A01, a FHIR resource). */
export type Transaction = { readonly kind: "transaction"; readonly id: string; readonly control: string; readonly children: readonly Part[]; readonly envelope?: Envelope };
/** A group of transactions of one kind. */
export type Group = { readonly kind: "group"; readonly id: string; readonly control: string; readonly transactions: readonly Transaction[]; readonly envelope?: Envelope };
/** An interchange: what is sent in one go, in one syntax. */
export type Interchange = { readonly kind: "interchange"; readonly syntax: Ref<"syntax">; readonly control: string; readonly groups: readonly Group[]; readonly envelope?: Envelope };
/** Any node of the tree. */
export type TreeNode = Interchange | Group | Transaction | Part | Element;

/** An element. */
export const element = (id: string, value: string, components: readonly Element[] = []): Element => ({ kind: "element", id, value, components });
/** A segment. */
export const segment = (id: string, ...elements: readonly Element[]): Segment => ({ kind: "segment", id, elements });
/** A loop. */
export const loop = (id: string, ...children: readonly Part[]): Loop => ({ kind: "loop", id, children });

/** One value of a tree, with where it is. */
export type Entry = { readonly path: string; readonly at: string; readonly value: string };

const join = (a: string, b: string): string => (a === "" ? b : b === "" ? a : `${a}.${b}`);

/** Calls `visit` for each element (components included) of a transaction, with its path and its indexed path. */
function walkParts(parts: readonly Part[], path: string, at: string, visit: (e: Element, path: string, at: string) => void, node: (kind: "segment" | "loop", path: string, at: string, parent: string) => void): void {
  const seen = new Map<string, number>();
  for (const p of parts) {
    const k = seen.get(`${p.kind}:${p.id}`) ?? 0;
    seen.set(`${p.kind}:${p.id}`, k + 1);
    const here = join(path, p.id);
    const hereAt = `${join(at, p.id)}[${k}]`;
    node(p.kind, here, hereAt, at);
    switch (p.kind) {
      case "segment":
        for (const e of p.elements) walkElement(e, here, hereAt, visit);
        break;
      case "loop":
        walkParts(p.children, here, hereAt, visit, node);
        break;
    }
  }
}

function walkElement(e: Element, path: string, at: string, visit: (e: Element, path: string, at: string) => void): void {
  const here = join(path, e.id);
  const hereAt = e.id === "" ? at : join(at, e.id);
  visit(e, here, hereAt);
  for (const c of e.components) walkElement(c, here, hereAt, visit);
}

/** Every value of a transaction, in order, as entries. */
export function entries(t: Transaction): readonly Entry[] {
  const out: Entry[] = [];
  walkParts(t.children, t.id, t.id, (e, path, at) => out.push({ path, at, value: e.value }), () => undefined);
  return out;
}

/** Every transaction of an interchange, in order. */
export const transactionsOf = (i: Interchange): readonly Transaction[] => i.groups.flatMap((g) => g.transactions);

/** The paths of a transaction (no indices), each once, in order of first appearance: its segments, loops and elements. */
export function pathsOf(t: Transaction): readonly string[] {
  const seen = new Set<string>();
  walkParts(t.children, t.id, t.id, (_e, path) => seen.add(path), (_k, path) => seen.add(path));
  return [...seen];
}

/** How many times each node of a path occurs under each instance of its parent: `[parent instance, count]`; the root is the transaction itself. */
export function occurrences(t: Transaction, path: string): readonly (readonly [string, number])[] {
  const counts = new Map<string, number>();
  const parentOf = path.includes(".") ? path.slice(0, path.lastIndexOf(".")) : "";
  walkParts(
    t.children,
    t.id,
    t.id,
    (e, p, at) => {
      if (p === path && e.id !== "") {
        const parent = at.slice(0, at.lastIndexOf("."));
        counts.set(parent, (counts.get(parent) ?? 0) + 1);
      }
    },
    (_kind, p, at, parent) => {
      if (p === path) counts.set(parent, (counts.get(parent) ?? 0) + 1);
      else if (p === parentOf) counts.set(at, counts.get(at) ?? 0);
    },
  );
  if (path === t.id) return [[t.id, 1]];
  if (parentOf === t.id && counts.size === 0) return [[t.id, 0]];
  return [...counts];
}

/** Every distinct value of a tree, longest first: what a scrub of a text must hide. */
export function valuesOf(i: Interchange): readonly string[] {
  const out = new Set<string>();
  const envelopes = [i.envelope, ...i.groups.flatMap((g) => [g.envelope, ...g.transactions.map((t) => t.envelope)])];
  for (const env of envelopes) for (const s of [...(env?.header ?? []), ...(env?.trailer ?? [])]) for (const e of s.elements) if (e.value.trim() !== "") out.add(e.value.trim());
  for (const t of transactionsOf(i)) for (const e of entries(t)) if (e.value !== "") out.add(e.value);
  return [...out].sort((a, b) => b.length - a.length);
}

/** The text that stands where a value was hidden. */
export const HIDDEN = "[redacted]";

function redactElement(e: Element, path: string, hide: (path: string) => boolean): Element {
  const here = join(path, e.id);
  const hidden = hide(here);
  return { kind: "element", id: e.id, value: hidden && e.value !== "" ? HIDDEN : e.value, components: e.components.map((c) => redactElement(c, here, hide)) };
}

function redactParts(parts: readonly Part[], path: string, hide: (path: string) => boolean): readonly Part[] {
  return parts.map((p): Part => {
    const here = join(path, p.id);
    switch (p.kind) {
      case "segment":
        return { kind: "segment", id: p.id, elements: p.elements.map((e) => redactElement(e, here, hide)) };
      case "loop":
        return { kind: "loop", id: p.id, children: redactParts(p.children, here, hide) };
    }
  });
}

/** The interchange with every value hidden whose path (no indices) `hide` says, or whose ancestor path it says: redaction is written once for every syntax. */
export function redactTree(i: Interchange, hide: (path: string) => boolean): Interchange {
  const covered = (path: string): boolean => {
    for (let p = path; p !== ""; p = p.includes(".") ? p.slice(0, p.lastIndexOf(".")) : "") if (hide(p)) return true;
    return false;
  };
  return { ...i, groups: i.groups.map((g) => ({ ...g, transactions: g.transactions.map((t) => ({ ...t, children: redactParts(t.children, t.id, covered) })) })) };
}

/** A predicate that hides every path equal to, or below, one of `paths`: what minimum-necessary does when it lists the elements a recipient may have (`allowed`), hiding the rest. */
export const hidingAllBut = (allowed: readonly string[]): ((path: string) => boolean) => (path) => !allowed.some((a) => a === path || a.startsWith(`${path}.`) || path.startsWith(`${a}.`));
