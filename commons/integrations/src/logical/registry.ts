// Spec: 0005-integrations-observe FR-009, FR-010, FR-011
/**
 * The registry of connectors (commons integrations 0005-integrations-observe): a typed map from a connector id to an entry that pins where the connector came
 * from (a tag or a commit, never a branch) and the SHA-256 of what was taken, a lock that is a persisted document, and the verification of a copy against its pin.
 * Which connectors a consumer runs is the consumer's choice; this is what makes a choice safe to keep.
 *
 * @module
 */
import { array, err, integer, literal, object, ok, string, type DecodeError, type Result } from "@intellectual-frontiers/core";
import { parseConnectorId, parseInstant, parseSha256, type ConnectorId, type Instant, type Sha256 } from "@intellectual-frontiers/integrations/governance";

/** What a source is pinned to: a release tag, or a full commit. Never a branch, which moves. */
export type PinRef = { readonly kind: "tag"; readonly name: string } | { readonly kind: "commit"; readonly sha: string };

/** Where a connector's code comes from, pinned. */
export type PinnedSource = { readonly url: string; readonly ref: PinRef };

/** Why a source is refused. */
export type SourceError = { readonly kind: "no-pin" } | { readonly kind: "not-https" } | { readonly kind: "branch-not-pinned" };

/** A source from `<https url>@<tag or 40-hex commit>`; a ref that is neither a version tag (`v1.2.3`, `1.2.3`) nor a full commit is a branch and is refused. */
export function pinSource(text: string): Result<PinnedSource, SourceError> {
  const at = text.lastIndexOf("@");
  if (at <= 0) return err({ kind: "no-pin" });
  const url = text.slice(0, at);
  const ref = text.slice(at + 1);
  if (!url.startsWith("https://")) return err({ kind: "not-https" });
  if (/^[0-9a-f]{40}$/.test(ref)) return ok({ url, ref: { kind: "commit", sha: ref } });
  if (/^v?\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$/.test(ref)) return ok({ url, ref: { kind: "tag", name: ref } });
  return err({ kind: "branch-not-pinned" });
}

/** The version of the connector contract an entry was written for. */
export const CONTRACT = 1;

/** One entry of the registry. */
export type RegistryEntry = { readonly id: ConnectorId; readonly title: string; readonly source: PinnedSource; readonly sha256: Sha256; readonly contract: typeof CONTRACT; readonly added: Instant };

/** The registry: entries by connector id. */
export type ConnectorRegistry = ReadonlyMap<ConnectorId, RegistryEntry>;

/** Why an entry is not added or a copy not accepted. */
export type LockError = { readonly kind: "duplicate"; readonly id: ConnectorId } | { readonly kind: "digest-mismatch"; readonly id: ConnectorId; readonly expected: Sha256; readonly actual: Sha256 } | { readonly kind: "unknown"; readonly id: ConnectorId };

/** The registry with one more entry, or why not. */
export function addEntry(reg: ConnectorRegistry, e: RegistryEntry): Result<ConnectorRegistry, LockError> {
  return reg.has(e.id) ? err({ kind: "duplicate", id: e.id }) : ok(new Map([...reg, [e.id, e]]));
}

/** Whether a copy with the digest `actual` is what the registry pinned for `id`. */
export function verifyCopy(reg: ConnectorRegistry, id: ConnectorId, actual: Sha256): Result<RegistryEntry, LockError> {
  const e = reg.get(id);
  if (e === undefined) return err({ kind: "unknown", id });
  return e.sha256 === actual ? ok(e) : err({ kind: "digest-mismatch", id, expected: e.sha256, actual });
}

/** The schema id of a persisted lock. */
export const LOCK_SCHEMA = "integrations/connector-lock/1";

/** A lock as the document that is persisted: entries in the order of their ids, so that the same registry is the same text. */
export function lockDocument(reg: ConnectorRegistry): { readonly kind: "connector-lock"; readonly schema: typeof LOCK_SCHEMA; readonly entries: readonly RegistryEntry[] } {
  return { kind: "connector-lock", schema: LOCK_SCHEMA, entries: [...reg.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) };
}

const pinRefD = (input: unknown, path = "$"): Result<PinRef, DecodeError> => {
  const o = object({ kind: literal("tag", "commit") }, { name: string, sha: string })(input, path);
  if (o.kind === "err") return o;
  if (o.value.kind === "tag") return o.value.name === undefined ? err({ kind: "decode", path: `${path}.name`, expected: "a tag name", found: "nothing" }) : ok({ kind: "tag", name: o.value.name });
  return o.value.sha === undefined ? err({ kind: "decode", path: `${path}.sha`, expected: "a commit", found: "nothing" }) : ok({ kind: "commit", sha: o.value.sha });
};

/** Reads a persisted lock back into a registry, refusing a document of another kind or schema, an id or digest that is not one, and an id twice. */
export function parseLock(input: unknown): Result<ConnectorRegistry, DecodeError | LockError> {
  const doc = object({ kind: literal("connector-lock"), schema: literal(LOCK_SCHEMA), entries: array((x) => ok(x)) })(input);
  if (doc.kind === "err") return doc;
  let reg: ConnectorRegistry = new Map();
  for (const [i, raw] of doc.value.entries.entries()) {
    const path = `$.entries[${i}]`;
    const e = object({ id: string, title: string, source: object({ url: string, ref: pinRefD }), sha256: string, contract: integer, added: string })(raw, path);
    if (e.kind === "err") return e;
    const id = parseConnectorId(e.value.id);
    const sha = parseSha256(e.value.sha256);
    const added = parseInstant(e.value.added);
    if (id.kind === "err") return err({ kind: "decode", path: `${path}.id`, expected: id.error.expected, found: "a text that is not that" });
    if (sha.kind === "err") return err({ kind: "decode", path: `${path}.sha256`, expected: sha.error.expected, found: "a text that is not that" });
    if (added.kind === "err") return err({ kind: "decode", path: `${path}.added`, expected: added.error.expected, found: "a text that is not that" });
    if (e.value.contract !== CONTRACT) return err({ kind: "decode", path: `${path}.contract`, expected: String(CONTRACT), found: String(e.value.contract) });
    const next = addEntry(reg, { id: id.value, title: e.value.title, source: e.value.source, sha256: sha.value, contract: CONTRACT, added: added.value });
    if (next.kind === "err") return next;
    reg = next.value;
  }
  return ok(reg);
}
