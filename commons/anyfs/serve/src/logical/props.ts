// Spec: 0003-anyfs-serve-logical FR-005
/**
 * The properties of a resource and the multistatus that lists them. The live properties are the ones a store knows: the type, the length, the time, the entity tag (the revision, quoted), the content type, the
 * name and the locks. A property a caller asks for and the server has not is answered `404` in its own part of the answer, as the protocol says. Dead properties are not stored: a request to set one is `403`.
 *
 * @example
 * ```ts
 * import { propfindRequest } from "./props.ts";
 * propfindRequest("").kind; // "ok": no body asks for every property
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { PosixPath } from "@intellectual-frontiers/anyfs-posix/governance";
import { statusLine, type Status } from "@intellectual-frontiers/anyfs-serve/governance";
import { contentTypeOf } from "@intellectual-frontiers/anyfs-serve/governance";
import { hrefOf } from "./href.ts";
import type { Lock } from "./lock.ts";
import { childElements, dav, DAV_NS, el, isNamed, parseXml, type QName, type XmlElement, type XmlLimits } from "./xml.ts";

/** What a PROPFIND asks for: every property, the names of the properties, or a list of properties. */
export type PropfindRequest = { readonly kind: "allprop" } | { readonly kind: "propname" } | { readonly kind: "prop"; readonly names: readonly QName[] };

/** What the server knows of a resource when it answers. */
export type ResourceFacts = {
  readonly path: PosixPath;
  readonly collection: boolean;
  readonly size?: number;
  /** The revision, unquoted. */
  readonly etag?: string;
  /** An ISO instant. */
  readonly modified?: string;
  readonly locks: readonly Lock[];
};

/** The request of a PROPFIND body, or why it is not one. An empty body asks for every property. */
export function propfindRequest(body: string, limits?: XmlLimits): Result<PropfindRequest, string> {
  if (body.trim() === "") return ok({ kind: "allprop" });
  const doc = parseXml(body, limits ?? { maxBytes: 1024 * 1024, maxDepth: 32, maxNodes: 20000 });
  if (doc.kind === "err") return err(`the body is not read: ${doc.error.kind}`);
  const root = doc.value;
  if (!isNamed(root, DAV_NS, "propfind")) return err("the body of a PROPFIND is a propfind element of DAV:");
  const kids = childElements(root);
  if (kids.some((k) => isNamed(k, DAV_NS, "propname"))) return ok({ kind: "propname" });
  const prop = kids.find((k) => isNamed(k, DAV_NS, "prop"));
  if (prop !== undefined) return ok({ kind: "prop", names: childElements(prop).map((e) => e.name) });
  return ok({ kind: "allprop" });
}

/** The names of the live properties, in the order a listing shows them. */
export const LIVE_PROPS: readonly string[] = ["creationdate", "displayname", "getcontentlength", "getcontenttype", "getetag", "getlastmodified", "lockdiscovery", "resourcetype", "supportedlock"];

const httpDate = (iso: string): string => new Date(iso).toUTCString();

/** The lock as the element a client reads it as. */
export function lockElement(l: Lock, base?: string): XmlElement {
  const href = base === undefined ? [] : [el(dav("href"), [hrefOf(l.path, false, base)])];
  return el(dav("activelock"), [
    el(dav("locktype"), [el(dav("write"))]),
    el(dav("lockscope"), [el(dav("exclusive"))]),
    el(dav("depth"), [l.depth]),
    el(dav("owner"), [{ kind: "text", text: l.owner } as const]),
    el(dav("timeout"), [`Second-${l.seconds}`]),
    el(dav("locktoken"), [el(dav("href"), [l.token])]),
    el(dav("lockroot"), href.length > 0 ? href : [el(dav("href"), [l.path])]),
  ]);
}

/** The value of one live property of a resource, or nothing where the resource has none. */
function liveValue(facts: ResourceFacts, local: string, base: string): XmlElement | undefined {
  const name = dav(local);
  switch (local) {
    case "resourcetype":
      return el(name, facts.collection ? [el(dav("collection"))] : []);
    case "displayname": {
      const last = facts.path.split("/").filter((s) => s !== "").pop() ?? "";
      return el(name, [last]);
    }
    case "getcontentlength":
      return facts.collection || facts.size === undefined ? undefined : el(name, [String(facts.size)]);
    case "getcontenttype":
      return facts.collection ? el(name, ["httpd/unix-directory"]) : el(name, [contentTypeOf(facts.path.split("/").pop() ?? "")]);
    case "getetag":
      return facts.collection || facts.etag === undefined ? undefined : el(name, [`"${facts.etag}"`]);
    case "getlastmodified":
      return facts.modified === undefined ? undefined : el(name, [httpDate(facts.modified)]);
    case "creationdate":
      return facts.modified === undefined ? undefined : el(name, [new Date(facts.modified).toISOString()]);
    case "supportedlock":
      return el(name, [el(dav("lockentry"), [el(dav("lockscope"), [el(dav("exclusive"))]), el(dav("locktype"), [el(dav("write"))])])]);
    case "lockdiscovery":
      return el(name, facts.locks.map((l) => lockElement(l, base)));
    default:
      return undefined;
  }
}

/** One `response` of a multistatus for a resource and a request. */
export function propResponse(facts: ResourceFacts, request: PropfindRequest, base: string): XmlElement {
  const href = el(dav("href"), [hrefOf(facts.path, facts.collection, base)]);
  const found: XmlElement[] = [];
  const missing: XmlElement[] = [];
  if (request.kind === "propname") {
    for (const p of LIVE_PROPS) if (liveValue(facts, p, base) !== undefined) found.push(el(dav(p)));
  } else if (request.kind === "allprop") {
    for (const p of LIVE_PROPS) {
      const v = liveValue(facts, p, base);
      if (v !== undefined) found.push(v);
    }
  } else {
    for (const n of request.names) {
      const v = n.ns === DAV_NS ? liveValue(facts, n.local, base) : undefined;
      if (v !== undefined) found.push(v);
      else missing.push(el(n));
    }
  }
  const parts: XmlElement[] = [href];
  if (found.length > 0 || missing.length === 0) parts.push(el(dav("propstat"), [el(dav("prop"), found), el(dav("status"), [statusLine(200)])]));
  if (missing.length > 0) parts.push(el(dav("propstat"), [el(dav("prop"), missing), el(dav("status"), [statusLine(404)])]));
  return el(dav("response"), parts);
}

/** A `response` that names a resource and a status only: what a failed part of COPY, MOVE or DELETE says. */
export function statusResponse(path: PosixPath, collection: boolean, status: Status, base: string): XmlElement {
  return el(dav("response"), [el(dav("href"), [hrefOf(path, collection, base)]), el(dav("status"), [statusLine(status)])]);
}

/** A multistatus of responses. */
export function multistatus(responses: readonly XmlElement[]): XmlElement {
  return el(dav("multistatus"), responses);
}

/** What a PROPPATCH body asks: the names of the properties it sets and removes. */
export type ProppatchRequest = { readonly set: readonly QName[]; readonly remove: readonly QName[] };

/** The request of a PROPPATCH body, or why it is not one. */
export function proppatchRequest(body: string, limits: XmlLimits): Result<ProppatchRequest, string> {
  const doc = parseXml(body, limits);
  if (doc.kind === "err") return err(`the body is not read: ${doc.error.kind}`);
  if (!isNamed(doc.value, DAV_NS, "propertyupdate")) return err("the body of a PROPPATCH is a propertyupdate element of DAV:");
  const set: QName[] = [];
  const remove: QName[] = [];
  for (const k of childElements(doc.value)) {
    const target = isNamed(k, DAV_NS, "set") ? set : isNamed(k, DAV_NS, "remove") ? remove : undefined;
    if (target === undefined) return err("a propertyupdate holds set and remove elements");
    for (const p of childElements(k)) if (isNamed(p, DAV_NS, "prop")) for (const n of childElements(p)) target.push(n.name);
  }
  return ok({ set, remove });
}
