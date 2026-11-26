// Spec: 0009-estate-sightings FR-005
/**
 * The pure functions of sightings (0009-estate-sightings): the resolution of a set of keys to an asset that never merges by itself, the fold of sightings into the assets seen, what nobody declared and what a relay
 * no longer sees, the capability tier and the minimums an enrolled asset has (commons 0041-telemetry-and-reach FR-001, FR-011), and the hash a person's approval names.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import {
  type AssetTier,
  type EnrollmentMinimum,
  KEY_ORDER,
  KEY_STRENGTH,
  type IdentityKey,
  type TierFacts,
  type Minimum,
  type Sighting,
  SIGHTING_PROTOCOLS,
  type SightingProtocol,
  keyOf,
  keyText,
  KEY_KINDS,
  type KeyKind,
} from "@intellectual-frontiers/estate/governance";
import { deviceIdOf } from "@intellectual-frontiers/estate/logical";

/** An asset and the keys it is known by. */
export type KnownKeys = { readonly id: string; readonly keys: readonly IdentityKey[] };

/** What a set of keys resolves to (FR-005): nothing known, one asset by a strong key, one asset by weak keys only (a person confirms), or more than one. */
export type Resolution =
  | { readonly kind: "new" }
  | { readonly kind: "adopt"; readonly assetId: string; readonly matchedOn: readonly KeyKindMatch[] }
  | { readonly kind: "candidate"; readonly assetId: string; readonly matchedOn: readonly KeyKindMatch[] }
  | { readonly kind: "conflict"; readonly assetIds: readonly string[] };

/** The kind of a key that matched. */
export type KeyKindMatch = KeyKind;

/** Resolves keys against the assets known; `weakAdopts` is how the enrollment server keeps its behaviour. It never merges: `adopt` names the asset and a person's approval adds the keys (FR-006). */
export function resolveIdentity(keys: readonly IdentityKey[], known: readonly KnownKeys[], options: { readonly weakAdopts?: boolean } = {}): Resolution {
  const mine = new Set(keys.map(keyText));
  const found = new Map<string, KeyKind[]>();
  for (const a of known) {
    const on = a.keys.filter((k) => mine.has(keyText(k))).map((k) => k.kind);
    if (on.length > 0) found.set(a.id, on);
  }
  if (found.size === 0) return { kind: "new" };
  if (found.size > 1) return { kind: "conflict", assetIds: [...found.keys()].sort() };
  const [assetId, matchedOn] = [...found.entries()][0] as [string, KeyKind[]];
  const strong = matchedOn.some((k) => KEY_STRENGTH[k] === "strong");
  return strong || options.weakAdopts === true ? { kind: "adopt", assetId, matchedOn } : { kind: "candidate", assetId, matchedOn };
}

/** A short stable digest of a text (FNV-1a, 64 bits) in 12 hexadecimal digits: an id, never a secret. */
function shortDigest(text: string): string {
  let h = 0xcbf29ce484222325n;
  for (const b of new TextEncoder().encode(text)) h = ((h ^ BigInt(b)) * 0x100000001b3n) & 0xffffffffffffffffn;
  return h.toString(16).padStart(16, "0").slice(0, 12);
}

/** The id of a seen asset, from its strongest key: `device-` and the MAC without colons for a MAC, `device-` and a short digest of the key for another (FR-007). */
export function seenAssetId(keys: readonly IdentityKey[]): string {
  for (const kind of KEY_ORDER) {
    const k = keys.find((x) => x.kind === kind);
    if (k !== undefined) return k.kind === "mac" ? deviceIdOf(k.value) : `device-${shortDigest(keyText(k))}`;
  }
  return "device-unknown";
}

/** An asset seen by relays (FR-008). */
export type SeenAsset = {
  readonly id: string;
  readonly keys: readonly IdentityKey[];
  readonly first: string;
  readonly last: string;
  readonly count: number;
  readonly relays: readonly string[];
  readonly protocols: readonly SightingProtocol[];
  readonly sightings: readonly string[];
};

/** One seen asset for each resolved set of keys: sightings that share a key are one asset, so a device seen by two relays by two protocols is one (FR-007, FR-008). Pure and in a stable order. */
export function foldSightings(sightings: readonly Sighting[]): readonly SeenAsset[] {
  const groups: { keys: Map<string, IdentityKey>; items: Sighting[] }[] = [];
  for (const s of [...sightings].sort((a, b) => (a.at === b.at ? a.id.localeCompare(b.id) : a.at.localeCompare(b.at)))) {
    const hits = groups.filter((g) => s.keys.some((k) => g.keys.has(keyText(k))));
    const merged = { keys: new Map<string, IdentityKey>(), items: [] as Sighting[] };
    for (const g of hits) {
      for (const [t, k] of g.keys) merged.keys.set(t, k);
      merged.items.push(...g.items);
      groups.splice(groups.indexOf(g), 1);
    }
    for (const k of s.keys) merged.keys.set(keyText(k), k);
    merged.items.push(s);
    groups.push(merged);
  }
  return groups
    .map((g): SeenAsset => {
      const keys = [...g.keys.values()].sort((a, b) => keyText(a).localeCompare(keyText(b)));
      const ats = g.items.map((i) => i.at).sort();
      return {
        id: seenAssetId(keys),
        keys,
        first: ats[0] ?? "",
        last: ats.at(-1) ?? "",
        count: g.items.reduce((n, i) => n + i.count, 0),
        relays: [...new Set(g.items.map((i) => i.relay))].sort(),
        protocols: [...new Set(g.items.map((i) => i.protocol))].sort() as SightingProtocol[],
        sightings: g.items.map((i) => i.id).sort(),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** What an estate declares of an asset that a relay may cover: its keys, and whether a relay is to see it. */
export type DeclaredKeys = { readonly asset: string; readonly keys: readonly IdentityKey[]; readonly behindRelay?: boolean };

/** The assets seen that nobody declared, and the declared assets behind a relay that were not seen within `windowMs` of `nowMs` (FR-008). */
export function unexpectedSightings(
  declared: readonly DeclaredKeys[],
  seen: readonly SeenAsset[],
  nowMs: number,
  windowMs: number,
): { readonly unexpected: readonly SeenAsset[]; readonly unseen: readonly string[] } {
  const known = (s: SeenAsset): boolean => declared.some((d) => d.keys.some((k) => s.keys.some((x) => keyText(x) === keyText(k))));
  const recent = (s: SeenAsset): boolean => nowMs - Date.parse(s.last) <= windowMs;
  const covered = (d: DeclaredKeys): boolean => seen.some((s) => recent(s) && d.keys.some((k) => s.keys.some((x) => keyText(x) === keyText(k))));
  return {
    unexpected: seen.filter((s) => !known(s)),
    unseen: declared.filter((d) => d.behindRelay === true && !covered(d)).map((d) => d.asset).sort(),
  };
}

/** How fresh an asset that depends on a relay is (FR-009): a stale relay makes it `unknown`, not stale; silence past `staleAfterMs` is `stale`, never failed. */
export function relayDependentStatus(input: { readonly relayStale: boolean; readonly lastSeenMs: number | undefined; readonly nowMs: number; readonly staleAfterMs: number }): "fresh" | "stale" | "unknown" {
  if (input.relayStale || input.lastSeenMs === undefined) return "unknown";
  return input.nowMs - input.lastSeenMs > input.staleAfterMs ? "stale" : "fresh";
}

/** The hash a person's approval names: the SHA-256 of the sorted sighting ids and keys, so that the approval is of what was looked at (FR-011). */
export async function sightingsHash(sightings: readonly Sighting[]): Promise<string> {
  const lines = [...sightings].sort((a, b) => a.id.localeCompare(b.id)).map((s) => `${s.id} ${[...s.keys].map(keyText).sort().join(",")}`);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(lines.join("\n")));
  return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** The tier of an asset, derived and never stored as an authority (0041 FR-001, FR-002); an exhaustive function of what is observed. */
export function tierOf(facts: TierFacts): AssetTier {
  if (facts.agent) return 4;
  if (facts.login) return facts.osquery ? 3 : 2;
  return facts.identified && facts.protocol ? 1 : 0;
}

/** Whether the tier fell, and what was lost: a fall is a finding that names the loss, never an error and never silent (0041 FR-002). */
export function tierFinding(before: TierFacts, after: TierFacts): string | undefined {
  const a = tierOf(before);
  const b = tierOf(after);
  if (b >= a) return undefined;
  const lost: string[] = [];
  if (before.agent && !after.agent) lost.push("the exporter");
  if (before.osquery && !after.osquery) lost.push("osQuery");
  if (before.login && !after.login) lost.push("the login");
  if (before.protocol && !after.protocol) lost.push("the API or protocol");
  if (before.identified && !after.identified) lost.push("the identification");
  return `the tier fell from ${a} to ${b}: ${lost.join(" and ")} lost`;
}

/** Which of the three minimums an asset lacks (0041 FR-011): an asset that lacks one is not called enrolled. */
export function missingMinimums(m: EnrollmentMinimum): readonly Minimum[] {
  const out: Minimum[] = [];
  if (!m.identity) out.push("identity");
  if (!m.factsAndQuery) out.push("facts-and-query");
  if (!m.telemetry) out.push("telemetry");
  return out;
}

const isKind = (v: unknown): v is KeyKind => typeof v === "string" && (KEY_KINDS as readonly string[]).includes(v);

/** Reads a sighting from outside; it refuses what it does not read, a sighting with no provenance and one with no key (FR-001, FR-002). */
export function decodeSighting(input: unknown): Result<Sighting, string> {
  if (typeof input !== "object" || input === null) return err("a sighting is an object");
  const o = input as Record<string, unknown>;
  for (const f of ["id", "at", "relay", "provenance"] as const) if (typeof o[f] !== "string" || o[f] === "") return err(`a sighting has a ${f}`);
  if (!(SIGHTING_PROTOCOLS as readonly unknown[]).includes(o["protocol"])) return err(`${JSON.stringify(o["protocol"])} is not a protocol of a sighting`);
  if (!Number.isSafeInteger(o["count"]) || (o["count"] as number) < 1) return err("a sighting counts at least one");
  if (!Array.isArray(o["keys"]) || o["keys"].length === 0) return err("a sighting has at least one key");
  const keys: IdentityKey[] = [];
  for (const raw of o["keys"] as unknown[]) {
    const k = raw as { kind?: unknown; value?: unknown };
    if (!isKind(k.kind) || typeof k.value !== "string") return err("a key has a kind and a value");
    const made = keyOf(k.kind, k.value);
    if (made.kind === "err") return made;
    keys.push(made.value);
  }
  return ok({
    id: o["id"] as string,
    at: o["at"] as string,
    relay: o["relay"] as string,
    protocol: o["protocol"] as SightingProtocol,
    keys,
    ...(typeof o["address"] === "string" ? { address: o["address"] } : {}),
    ...(typeof o["hostname"] === "string" ? { hostname: o["hostname"] } : {}),
    count: o["count"] as number,
    provenance: o["provenance"] as string,
  });
}
