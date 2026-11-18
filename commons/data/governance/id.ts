// Spec: 0003-governance FR-005
/**
 * The identity of an element (commons data 0003-governance FR-005): made of the element's names and no more, so that it does not change while the names do not, and so that the
 * logical and the physical layers can link back to it. A domain `d`, a concept `d/c`, an attribute `d/c.a`, a relationship `d/c>r`, a code list `d/list:l` and a code `d/list:l.k`.
 *
 * @module
 */
import type { Brand } from "@intellectual-frontiers/commons/ts/kernel";

/** The identity of an element. */
export type ElementId = Brand<string, "ElementId">;

/** The kinds of element. */
export type ElementKind = "domain" | "concept" | "attribute" | "relationship" | "codelist" | "code";

/** A name of an element: lower-case words joined by `_`. */
export const NAME = /^[a-z][a-z0-9_]*$/;

// the one place a text becomes an ElementId: the functions below build it from names, and nothing else does
const made = (text: string): ElementId => text as ElementId;

/** The identity of a domain. */
export const domainId = (domain: string): ElementId => made(domain);
/** The identity of a concept of a domain. */
export const conceptId = (domain: string, concept: string): ElementId => made(`${domain}/${concept}`);
/** The identity of an attribute of a concept. */
export const attributeId = (domain: string, concept: string, attribute: string): ElementId => made(`${domain}/${concept}.${attribute}`);
/** The identity of a relationship of a concept. */
export const relationshipId = (domain: string, concept: string, relationship: string): ElementId =>
  made(`${domain}/${concept}>${relationship}`);
/** The identity of a code list of a domain. */
export const codeListId = (domain: string, list: string): ElementId => made(`${domain}/list:${list}`);
/** The identity of a code of a code list. */
export const codeId = (domain: string, list: string, code: string): ElementId => made(`${domain}/list:${list}.${code}`);
