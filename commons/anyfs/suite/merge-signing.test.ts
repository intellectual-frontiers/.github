/**
 * Tests of signed deltas (commons anyfs 0010-anyfs-merge-signing FR-001 to FR-006): a replica that takes signed changes only takes a delta signed by a key of the roster of its replica, refuses every other delta
 * with the reason of its own, holds a key to its window, and takes one delta twice as once; the suite of these laws passes for replicas in memory and fails, with a sentence, for replicas that check nothing, that check
 * the signature and not the list, or that trust everyone.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { runSigningConformance, type MakeSigned } from "../src/logical/conformance/mod.ts";
import { type MergeFace } from "../src/logical/conformance/mod.ts";
import { replicaIdOfBytes, type Trust } from "../src/governance/mod.ts";
import { generateSigningKey, keyIdOf, makeSigner, messageOf, parseRoster, parseSignature, parseSigningKey, rosterText, rosterTrust, signingKeyText, verifySigned } from "../src/merge/mod.ts";
import { memoryMergeStore } from "../src/physical/memory-merge/mod.ts";

const make: MakeSigned = async (ids, trusts) => {
  let t = Date.now();
  const clock = (): number => (t += 1);
  return ids.map((id, i): MergeFace => {
    const r = memoryMergeStore({ name: `r${i}`, replica: id, clock, trust: trusts[i] as Trust });
    return { store: r.store, replica: id };
  });
};

const failing = (reports: readonly { readonly id: string; readonly failure?: string }[]): readonly string[] => reports.filter((r) => r.failure !== undefined).map((r) => r.id);

proves(["0010-anyfs-merge-signing FR-001"], "replicas in memory pass every case of the suite of signed deltas", async () => {
  const reports = await runSigningConformance(make);
  assertEquals(reports.filter((r) => r.failure !== undefined).map((r) => `${r.id}: ${r.failure}`), []);
  assertEquals(reports.length, 9);
});

proves(["0010-anyfs-merge-signing FR-002"], "replicas that check nothing, that check the signature and not the list, or that trust everyone each fail the suite with a sentence", async () => {
  const everything: MakeSigned = (ids, trusts) => make(ids, [trusts[0] as Trust, { kind: "signed", verify: () => "ok" }, trusts[2] as Trust]);
  const notList: MakeSigned = (ids, trusts) => {
    const b = trusts[1];
    return make(ids, [trusts[0] as Trust, b?.kind === "signed" ? { kind: "signed", verify: b.verify } : (b as Trust), trusts[2] as Trust]);
  };
  const open: MakeSigned = (ids, trusts) => make(ids, [trusts[0] as Trust, { kind: "open" }, trusts[2] as Trust]);
  const a = await runSigningConformance(everything);
  assert(failing(a).includes("unsigned-is-refused") === false || failing(a).length > 0);
  assert(failing(a).length >= 3, `a verifier that says ok fails the cases of refusal: ${failing(a).join(", ")}`);
  const b = await runSigningConformance(notList);
  assert(failing(b).includes("listed-and-signed"), `a replica that ignores the list fails its case: ${failing(b).join(", ")}`);
  const c = await runSigningConformance(open);
  assert(failing(c).length >= 4, `a replica that trusts everyone fails the cases of refusal: ${failing(c).join(", ")}`);
  for (const r of [...a, ...b, ...c]) if (r.failure !== undefined) assert(r.failure.length > 20, "a failure is a sentence");
});

proves(["0010-anyfs-merge-signing FR-003", "0010-anyfs-merge-signing FR-004"], "a signature is `ed25519:<key id>:<base64>`, the key id is of the 32 bytes of the key, and a roster is read from text and written back, each entry checked", async () => {
  const replica = replicaIdOfBytes(new Uint8Array(16).fill(3));
  assert(replica.kind === "ok");
  const key = await generateSigningKey(replica.value, { notBefore: 1000, notAfter: 2000 });
  assertEquals(key.entry.keyId, await keyIdOf(Uint8Array.from(atob(key.entry.publicKey), (c) => c.charCodeAt(0))));
  const signer = await makeSigner(key);
  const sig = await signer.sign("anyfs-delta/1", "abc");
  assert(parseSignature(sig).kind === "ok" && sig.startsWith(`ed25519:${key.entry.keyId}:`));
  assertEquals(await verifySigned([key.entry], "anyfs-delta/1", "abc", sig, replica.value, 1500), "ok");
  assertEquals(await verifySigned([key.entry], "anyfs-delta/1", "abd", sig, replica.value, 1500), "bad-signature");
  assertEquals(await verifySigned([key.entry], "anyfs-delta/1", "abc", sig, replica.value, 2500), "unknown-key");
  assertEquals(await verifySigned([key.entry], "anyfs-delta/1", "abc", "not a signature", replica.value, 1500), "bad-signature");
  assertEquals(messageOf("anyfs-dump/1", replica.value, "d"), `anyfs-dump/1\n${replica.value}\nd`);
  const back = parseRoster(rosterText([key.entry]));
  assert(back.kind === "ok");
  assertEquals(back.value, [key.entry]);
  for (const bad of ["", "{}", "[1]", '[{"replica":"x"}]', JSON.stringify([{ ...key.entry, publicKey: "AAAA" }]), JSON.stringify([{ ...key.entry, keyId: "zz" }]), JSON.stringify([{ ...key.entry, notBefore: "x" }])]) assertEquals(parseRoster(bad).kind, "err", bad);
});

proves(["0010-anyfs-merge-signing FR-005"], "a key that is rotated keeps the deltas made under it valid for its window and a new key speaks from where the old one ends", async () => {
  const replica = replicaIdOfBytes(new Uint8Array(16).fill(4));
  assert(replica.kind === "ok");
  const oldKey = await generateSigningKey(replica.value, { notAfter: 1_000 });
  const newKey = await generateSigningKey(replica.value, { notBefore: 1_001 });
  const roster = [oldKey.entry, newKey.entry];
  const old = await (await makeSigner(oldKey)).sign("anyfs-delta/1", "x");
  const fresh = await (await makeSigner(newKey)).sign("anyfs-delta/1", "x");
  assertEquals(await verifySigned(roster, "anyfs-delta/1", "x", old, replica.value, 500), "ok");
  assertEquals(await verifySigned(roster, "anyfs-delta/1", "x", old, replica.value, 2_000), "unknown-key");
  assertEquals(await verifySigned(roster, "anyfs-delta/1", "x", fresh, replica.value, 2_000), "ok");
  assertEquals(await verifySigned(roster, "anyfs-delta/1", "x", fresh, replica.value, 500), "unknown-key");
  const trust = rosterTrust(roster);
  assert(trust.kind === "signed" && trust.replicas === undefined);
});

proves(["0010-anyfs-merge-signing FR-006"], "a signature is for the thing it was made for: a signature of a delta is no signature of an epoch or a dump, the verifier of a trust is asked in the domain of what it checks, and a key file is read back into the key", async () => {
  const replica = replicaIdOfBytes(new Uint8Array(16).fill(4));
  assert(replica.kind === "ok");
  const key = await generateSigningKey(replica.value);
  const signer = await makeSigner(key);
  const sig = await signer.sign("anyfs-delta/1", "digest");
  assertEquals(await verifySigned([key.entry], "anyfs-epoch/1", "digest", sig, replica.value, 1), "bad-signature");
  assertEquals(await verifySigned([key.entry], "anyfs-dump/1", "digest", sig, replica.value, 1), "bad-signature");
  const trust = rosterTrust([key.entry]);
  assert(trust.kind === "signed");
  assertEquals(await trust.verify("digest", sig, replica.value, 1, "anyfs-delta/1"), "ok");
  assertEquals(await trust.verify("digest", sig, replica.value, 1, "anyfs-epoch/1"), "bad-signature");
  const back = parseSigningKey(signingKeyText(key));
  assert(back.kind === "ok");
  assertEquals(back.value.entry, key.entry);
  assertEquals(await (await makeSigner(back.value)).sign("anyfs-delta/1", "digest"), sig);
  for (const bad of ["", "[]", "{}", JSON.stringify({ format: 1, entry: key.entry, privateJwk: { kty: "RSA" } })]) assertEquals(parseSigningKey(bad).kind, "err", bad);
});
