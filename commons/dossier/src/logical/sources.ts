// Spec: 0002-dossier-core FR-001
/**
 * Sources (0046-dossiers FR-001, FR-005): making one, and checking a set of them before a build reads any: each hash is the hash of its content, no id is in the set with two different contents,
 * and a set holds each id once.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import type { BuildError, DisclosureClass, Json, Source } from "@intellectual-frontiers/dossier/governance";
import { canonicalize } from "@intellectual-frontiers/grc/logical";
import { INSTANT } from "./selection.ts";

/** Ids: lower case words joined by hyphens, dots, colons and slashes. */
export const SOURCE_ID = /^[a-z0-9][a-z0-9._:/-]*$/;

/** The SHA-256 of the canonical form of a body. */
export async function bodyHash(body: Json): Promise<string> {
  return sha256(canonicalize(body));
}

/** What a source is made from. */
export interface SourceParts {
  readonly id: string;
  readonly kind: string;
  readonly observedAt: string;
  readonly body: Json;
  readonly class?: DisclosureClass;
  readonly signer?: string;
  readonly about?: readonly string[];
  readonly tags?: readonly string[];
}

/** A source made from its parts: the hash is worked out, the class is `internal` where none is given, and the id and the instant are checked. */
export async function sourceOf(p: SourceParts): Promise<Result<Source, string>> {
  if (!SOURCE_ID.test(p.id)) return err(`${JSON.stringify(p.id)} is not a source id: lower case words joined by hyphens, dots, colons and slashes`);
  if (!INSTANT.test(p.observedAt)) return err(`${JSON.stringify(p.observedAt)} is not an instant like 2026-11-26T12:00:00Z`);
  const base = { id: p.id, kind: p.kind, observedAt: p.observedAt, hash: await bodyHash(p.body), about: [...(p.about ?? [])].sort(), tags: [...(p.tags ?? [])].sort(), class: p.class ?? "internal", body: p.body };
  return ok(p.signer === undefined ? base : { ...base, signer: p.signer });
}

/** A set of sources that a build may read: each hash is the hash of its content, and an id is in it once (the same id with the same hash is read once). */
export async function checkSources(sources: readonly Source[]): Promise<Result<readonly Source[], BuildError>> {
  const seen = new Map<string, Source>();
  for (const s of [...sources].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const want = await bodyHash(s.body);
    if (want !== s.hash) return err({ code: "E-DOSSIER-SOURCE-HASH", message: `source ${s.id} holds a body whose hash is ${want}, not the ${s.hash} it states` });
    const old = seen.get(s.id);
    if (old !== undefined && old.hash !== s.hash) return err({ code: "E-DOSSIER-SOURCE-CONFLICT", message: `source ${s.id} is given with two different contents (${old.hash} and ${s.hash})` });
    seen.set(s.id, s);
  }
  return ok([...seen.values()]);
}
