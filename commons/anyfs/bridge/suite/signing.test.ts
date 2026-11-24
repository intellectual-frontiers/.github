/**
 * Tests of the exchange and the merge with signed deltas (commons anyfs-bridge 0009-bridge-merge-signing FR-001 to FR-004): a replica that has a signer publishes files that carry its signature and a replica under signed
 * trust takes them; an unsigned file, a file with a signature of another key and a file whose rows were changed after it was signed are refused with the kind they have and are put aside for good (a key not yet known waits);
 * the trust of the exchange refuses what the replica would have taken; and a merge of two stores signs each delta with the key of its origin.
 *
 * @module
 */
import { expectAny, type ReplicaId } from "@intellectual-frontiers/anyfs/governance";
import { memoryMergeStore } from "@intellectual-frontiers/anyfs/memory-merge";
import { decodeDelta, DEFAULT_LIMITS, encodeDelta, generateSigningKey, makeSigner, rosterTrust } from "@intellectual-frontiers/anyfs/merge";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { applyMerge, memoryCursor, type Mergeable, planMerge, syncThrough, type ExchangeOptions } from "../src/exchange/mod.ts";
import { listing, medium, newId, path } from "./exchange.ts";

const enc = new TextEncoder();
type Side = { readonly id: ReplicaId; readonly replica: ReturnType<typeof memoryMergeStore>; readonly cursor: ReturnType<typeof memoryCursor> };

async function side(trust: Parameters<typeof memoryMergeStore>[0] extends infer O ? (O extends { trust?: infer T } ? T : never) : never, id: ReplicaId = newId()): Promise<Side> {
  let now = Date.UTC(2026, 0, 1);
  return { id, replica: memoryMergeStore({ name: id.slice(0, 4), replica: id, clock: () => (now += 7), trust }), cursor: memoryCursor() };
}
const put = async (s: Side, file: string, body: string): Promise<void> => {
  const w = await s.replica.store.write(path(file), enc.encode(body), expectAny);
  assert(w.kind === "ok");
};
const opts = (s: Side, m: ReturnType<typeof medium>, more: Partial<ExchangeOptions> = {}): ExchangeOptions => ({ self: s.id, replica: s.replica.store as Mergeable, medium: m, cursor: s.cursor, ...more });
const run = async (s: Side, m: ReturnType<typeof medium>, more: Partial<ExchangeOptions> = {}) => {
  const r = await syncThrough(opts(s, m, more));
  assert(r.kind === "ok", JSON.stringify(r));
  return r.value;
};

proves(["0009-bridge-merge-signing FR-001"], "a replica with a signer publishes files that carry its signature, and a replica under signed trust takes them and holds the same rows", async () => {
  const [ka, kb] = await Promise.all([generateSigningKey(newId()), generateSigningKey(newId())]);
  const roster = [ka.entry, kb.entry];
  const a = await side(rosterTrust(roster), ka.entry.replica);
  const b = await side(rosterTrust(roster), kb.entry.replica);
  const m = medium();
  await put(a, "x.txt", "one");
  const out = await run(a, m, { signer: await makeSigner(ka) });
  assertEquals(out.published.length, 1);
  const file = await m.read(path(out.published[0]?.path as string));
  assert(file.kind === "ok");
  const decoded = decodeDelta(new TextDecoder().decode(file.value.bytes), DEFAULT_LIMITS);
  assert(decoded.kind === "ok" && decoded.value.signature?.startsWith(`ed25519:${ka.entry.keyId}:`) === true);
  const taken = await run(b, m, { signer: await makeSigner(kb) });
  assertEquals([taken.pulled.applied, taken.pulled.aside.length], [1, 0]);
  const read = await b.replica.store.read(path("x.txt"));
  assert(read.kind === "ok");
});

proves(["0009-bridge-merge-signing FR-002"], "an unsigned file, a file signed by a key of another replica and a file changed after it was signed are refused with the kind they have, and the ones that cannot become good are put aside for good", async () => {
  const [ka, kb, kx] = await Promise.all([generateSigningKey(newId()), generateSigningKey(newId()), generateSigningKey(newId())]);
  const roster = [ka.entry, kb.entry];
  const m = medium();
  const unsigned = await side({ kind: "open" }, ka.entry.replica);
  await put(unsigned, "u.txt", "u");
  await run(unsigned, m);
  const forged = await side({ kind: "open" }, kb.entry.replica);
  await put(forged, "f.txt", "f");
  await run(forged, m, { signer: await makeSigner({ privateJwk: kx.privateJwk, entry: kb.entry }) });
  const b = await side(rosterTrust(roster));
  const result = await run(b, m);
  assertEquals(result.pulled.applied, 0);
  const kinds = result.pulled.aside.map((a) => [a.kind, a.reason.match(/\((.*?)\)/u)?.[1]]);
  assertEquals(kinds.sort(), [["quarantined", "bad-signature"], ["quarantined", "unsigned"]].sort());
  // a file whose rows were changed after it was signed holds no longer
  const honest = await side({ kind: "open" }, ka.entry.replica);
  await put(honest, "h.txt", "honest");
  const m2 = medium();
  const published = await run(honest, m2, { signer: await makeSigner(ka) });
  const path2 = path(published.published[0]?.path as string);
  const file = await m2.read(path2);
  assert(file.kind === "ok");
  const delta = decodeDelta(new TextDecoder().decode(file.value.bytes), DEFAULT_LIMITS);
  assert(delta.kind === "ok");
  const [first] = delta.value.versions;
  assert(first !== undefined);
  await m2.write(path2, enc.encode(encodeDelta({ ...delta.value, versions: [{ ...first, path: "other.txt" }] })), expectAny);
  const victim = await side(rosterTrust(roster));
  const after = await run(victim, m2);
  assertEquals(after.pulled.applied, 0);
  assertEquals(after.pulled.aside.length, 1);
});

proves(["0009-bridge-merge-signing FR-003"], "a key that is not yet on the roster makes a file wait as refused (the roster may come), not put aside for good, and the file is taken once the roster knows the key", async () => {
  const [ka, kb] = await Promise.all([generateSigningKey(newId()), generateSigningKey(newId())]);
  const a = await side({ kind: "open" }, ka.entry.replica);
  await put(a, "x.txt", "one");
  const m = medium();
  await run(a, m, { signer: await makeSigner(ka) });
  const b = await side({ kind: "open" }, kb.entry.replica);
  const before = await run(b, m, { trust: rosterTrust([kb.entry]) });
  assertEquals([before.pulled.applied, before.pulled.aside.map((x) => x.kind)], [0, ["refused"]]);
  const after = await run(b, m, { trust: rosterTrust([ka.entry, kb.entry]) });
  assertEquals(after.pulled.applied, 1);
});

proves(["0009-bridge-merge-signing FR-004"], "the trust of the exchange refuses what the replica itself would have taken, and a merge signs each delta with the key of its origin and each side judges it by its trust", async () => {
  const [ka, kb] = await Promise.all([generateSigningKey(newId()), generateSigningKey(newId())]);
  const roster = [ka.entry, kb.entry];
  const a = await side({ kind: "allowlist", replicas: new Set([ka.entry.replica, kb.entry.replica]) }, ka.entry.replica);
  const b = await side({ kind: "allowlist", replicas: new Set([ka.entry.replica, kb.entry.replica]) }, kb.entry.replica);
  await put(a, "a.txt", "from a");
  await put(b, "b.txt", "from b");
  // with signers for both origins every delta is signed and both sides, judging by the roster, take what the other has
  const prepared = await planMerge(a.replica.store as Mergeable, b.replica.store as Mergeable);
  assert(prepared.kind === "ok");
  const signers = [await makeSigner(ka), await makeSigner(kb)];
  const done = await applyMerge(a.replica.store as Mergeable, b.replica.store as Mergeable, prepared.value, { approved: prepared.value.plan.hash, signers, trust: { a: rosterTrust(roster), b: rosterTrust(roster) } });
  assert(done.kind === "ok" && done.value.vectorsEqual);
  // with a signer for one origin only, the side that takes the other's unsigned delta refuses it
  const c = await side({ kind: "allowlist", replicas: new Set([ka.entry.replica, kb.entry.replica]) }, ka.entry.replica);
  const d = await side({ kind: "allowlist", replicas: new Set([ka.entry.replica, kb.entry.replica]) }, kb.entry.replica);
  await put(c, "c.txt", "c");
  await put(d, "d.txt", "d");
  const again = await planMerge(c.replica.store as Mergeable, d.replica.store as Mergeable);
  assert(again.kind === "ok");
  const partial = await applyMerge(c.replica.store as Mergeable, d.replica.store as Mergeable, again.value, { approved: again.value.plan.hash, signers: [await makeSigner(ka)], trust: { a: rosterTrust(roster), b: rosterTrust(roster) } });
  assert(partial.kind === "ok");
  assertEquals([partial.value.toB?.kind, partial.value.toA?.kind === "refused" ? partial.value.toA.refusal.kind : "taken"], ["applied", "unsigned"]);
  assert(!partial.value.vectorsEqual);
  void listing;
});
