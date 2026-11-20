/**
 * Tests of the evidence stores and attestation (0006-grc-evidence): the conformance suite on every store (a real folder, a real Git repository, a map behind the object-storage interface) and on
 * the signer (real Web Crypto keys), retention, the ledger, the manifest, custody and the refusal of an attestation. Git is the real program, in a temporary folder.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { signerConformance, storeConformance } from "@intellectual-frontiers/grc/conformance";
import { appendEntry, GENESIS, makeManifest, verifyLedger, verifyManifest, type LedgerEntry } from "@intellectual-frontiers/grc/logical";
import { attest, createSigners, createStores, expired, mayAttest, retained, signerAllowed, type EvidenceStore, type Signer } from "@intellectual-frontiers/grc/physical";
import { dsseSigner } from "@intellectual-frontiers/grc/signers/dsse";
import { filesStore } from "@intellectual-frontiers/grc/stores/files";
import { gitStore } from "@intellectual-frontiers/grc/stores/git";
import { memoryStore } from "@intellectual-frontiers/grc/stores/memory";
import { objectStore } from "@intellectual-frontiers/grc/stores/object";
import { standardSigners } from "../src/standard.ts";
import { evidencePolicyOf, must } from "./fixtures.ts";
import { evidencePolicy } from "@intellectual-frontiers/grc/governance";

const meta = { subject: "host-1", type: "disk-report", mediaType: "text/plain", observedAt: "2026-01-01T00:00:00Z" };
const bytes = new TextEncoder().encode("evidence");

async function temp(): Promise<string> {
  return fs.makeTempDir({ prefix: "grc-evidence-" });
}

proves(["0006-grc-evidence FR-001"], "a store is content-addressed: the digest is the SHA-256 of the bytes, the same bytes are one object and a tampered object is found when read", async () => {
  const s = memoryStore();
  const a = await s.put(bytes, meta);
  const b = await s.put(bytes, { ...meta, subject: "host-9" });
  assertEquals([a.kind, b.kind], ["ok", "ok"]);
  assertEquals(a.kind === "ok" && b.kind === "ok" && a.value.digest === b.value.digest, true);
  assertEquals((await s.list()).length, 1);
  assertEquals((await s.get("f".repeat(64))).kind, "err");
  s.corrupt(a.kind === "ok" ? a.value.digest : "");
  const g = await s.get(a.kind === "ok" ? a.value.digest : "");
  assertEquals(g.kind === "err" ? g.error.kind : "", "tampered");
  assertEquals(must(evidencePolicy.decode, evidencePolicyOf).retention, "P1Y");
});

proves(["0006-grc-evidence FR-002", "0006-grc-evidence FR-008"], "the stores of the library (memory, files, git, object) pass the store conformance suite", async () => {
  const dirs = new Map<EvidenceStore, string>();
  const tamperFiles = async (s: EvidenceStore, digest: string): Promise<void> => {
    const dir = dirs.get(s) ?? "";
    await fs.writeFile(path.join(dir, "objects", digest), new TextEncoder().encode("changed"));
  };
  assertEquals(await storeConformance(() => memoryStore(), async (s, d) => (s as ReturnType<typeof memoryStore>).corrupt(d)), []);
  assertEquals(
    await storeConformance(async () => {
      const dir = await temp();
      const s = filesStore(dir);
      dirs.set(s, dir);
      return s;
    }, tamperFiles),
    [],
  );
  assertEquals(
    await storeConformance(async () => {
      const dir = await temp();
      const s = gitStore(dir);
      dirs.set(s, dir);
      return s;
    }, tamperFiles),
    [],
  );
  const objects = new Map<string, Uint8Array>();
  const client = {
    put: (k: string, v: Uint8Array) => (objects.set(k, v), Promise.resolve()),
    get: (k: string) => Promise.resolve(objects.get(k)),
    head: (k: string) => Promise.resolve(objects.has(k)),
    list: (p: string) => Promise.resolve([...objects.keys()].filter((k) => k.startsWith(p)).sort()),
  };
  assertEquals(
    await storeConformance(() => (objects.clear(), objectStore(client)), async (_s, d) => void objects.set(`objects/${d}`, new TextEncoder().encode("changed"))),
    [],
  );
  const stores = createStores();
  for (const s of [memoryStore(), filesStore(await temp())]) assertEquals(stores.register(s).kind, "ok");
  assertEquals(stores.list().map((s) => s.id), ["files", "memory"]);
  assertEquals(stores.register(memoryStore()).kind, "err");
});

proves(["0006-grc-evidence FR-002"], "the git store commits each object with its digest in the message and leaves no partial object listed", async () => {
  const dir = await temp();
  const s = gitStore(dir);
  const p = await s.put(bytes, meta);
  assertEquals(p.kind, "ok");
  const log = await proc.run(["git", "log", "--format=%s"], { cwd: dir });
  assertStringIncludes(log.stdout, `evidence ${p.kind === "ok" ? p.value.digest : ""}`);
  const again = await s.put(bytes, meta);
  assertEquals(again.kind, "ok");
  const count = await proc.run(["git", "rev-list", "--count", "HEAD"], { cwd: dir });
  assertEquals(count.stdout.trim(), "1");
  await fs.writeFile(path.join(dir, "evidence", "half.json.123.tmp"), new TextEncoder().encode("{"));
  assertEquals((await s.list()).length, 1);
});

proves(["0006-grc-evidence FR-003"], "retention is a pure function and a store never deletes: expired lists what has passed", async () => {
  const s = memoryStore();
  const a = await s.put(bytes, meta);
  const e = a.kind === "ok" ? a.value : (undefined as never);
  assert(retained(e, evidencePolicyOf, "2026-06-01T00:00:00Z"));
  assert(!retained(e, evidencePolicyOf, "2027-01-01T00:00:00Z"));
  assertEquals(expired([e], evidencePolicyOf, "2027-06-01T00:00:00Z").length, 1);
  assertEquals(expired([e], evidencePolicyOf, "2026-06-01T00:00:00Z").length, 0);
  assertEquals((await s.list()).length, 1);
});

proves(["0006-grc-evidence FR-004"], "a ledger is hash-chained and verification names the first entry changed, removed, inserted or reordered", async () => {
  const mk = (n: number) => ({ at: `2026-01-0${n}T00:00:00Z`, type: "observation", subject: `h${n}`, evidence: `${n}`.repeat(64) });
  const e1 = await appendEntry(undefined, mk(1));
  const e2 = await appendEntry(e1, mk(2));
  const e3 = await appendEntry(e2, mk(3));
  const e4 = await appendEntry(e3, mk(4));
  assertEquals([e1.previous, e2.previous], [GENESIS, e1.digest]);
  assertEquals((await verifyLedger([e1, e2, e3, e4], e4.digest)).kind, "ok");
  const fault = async (entries: readonly LedgerEntry[]) => {
    const r = await verifyLedger(entries);
    return r.kind === "err" ? r.error.seq : 0;
  };
  assertEquals(await fault([e1, e2, { ...e3, subject: "edited" }, e4]), 3);
  assertEquals(await fault([e1, e3, e4]), 2);
  assertEquals(await fault([e1, e2, e2, e3]), 3);
  assertEquals(await fault([e2, e1, e3]), 1);
  assertEquals((await verifyLedger([e1, e2, e3], e4.digest)).kind, "err");
});

proves(["0006-grc-evidence FR-009"], "a manifest lists items by digest in order and verification names what is missing, extra or different", () => {
  const items = [
    { digest: "b".repeat(64), size: 2, mediaType: "text/plain" },
    { digest: "a".repeat(64), size: 1, mediaType: "text/plain" },
  ];
  const m = makeManifest(items, "c".repeat(64), "2026-01-01T00:00:00Z");
  assertEquals(m.items.map((i) => i.digest[0]), ["a", "b"]);
  assertEquals(verifyManifest(m, [{ digest: "a".repeat(64), size: 1 }, { digest: "b".repeat(64), size: 2 }]), { missing: [], extra: [], different: [] });
  assertEquals(verifyManifest(m, [{ digest: "a".repeat(64), size: 9 }, { digest: "d".repeat(64), size: 1 }]), { missing: ["b".repeat(64)], extra: ["d".repeat(64)], different: ["a".repeat(64)] });
});

async function keys() {
  const pair = (): Promise<CryptoKeyPair> => crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as Promise<CryptoKeyPair>;
  return { a: await pair(), b: await pair() };
}

proves(["0006-grc-evidence FR-005", "0006-grc-evidence FR-008"], "the dsse signer signs and verifies and passes the signer conformance suite, and reads no key it was not given", async () => {
  const k = await keys();
  assertEquals(
    await signerConformance(dsseSigner, {
      signing: [{ key: k.a.privateKey, keyid: "a" }],
      verifying: [{ key: k.a.publicKey, keyid: "a" }],
      otherVerifying: [{ key: k.b.publicKey, keyid: "a" }],
    }),
    [],
  );
  const none = await dsseSigner.sign("t", bytes, []);
  assertEquals(none.kind, "err");
  const notKey = await dsseSigner.sign("t", bytes, ["/home/someone/.ssh/id"]);
  assertEquals(notKey.kind, "err");
  assertEquals(standardSigners().list().map((s) => s.id), ["dsse"]);
  assertEquals(createSigners().register(dsseSigner).kind, "ok");
});

proves(["0006-grc-evidence FR-006"], "custody is decided by policy: a weaker signer is refused and only a role the policy names may attest", () => {
  const hardware = must(evidencePolicy.decode, { ...evidencePolicyOf, custody: "hardware" });
  const none = must(evidencePolicy.decode, { ...evidencePolicyOf, custody: "none" });
  assert(signerAllowed(evidencePolicyOf, dsseSigner));
  assert(!signerAllowed(hardware, dsseSigner));
  assert(signerAllowed(none, dsseSigner));
  const token: Signer = { ...dsseSigner, id: "token", custody: "hardware" };
  assert(signerAllowed(hardware, token));
  assert(mayAttest(evidencePolicyOf, "ciso") && !mayAttest(evidencePolicyOf, "intern"));
});

proves(["0006-grc-evidence FR-007"], "an attestation is signed by an allowed signer for an allowed role, and refused saying which of the two failed", async () => {
  const k = await keys();
  const input = { subject: "host-1", check: "c1", claim: "pass" as const, statement: "I checked.", attester: "someone", role: "ciso", evidence: ["evidence:x"], at: "2026-06-01T00:00:00Z" };
  const ok1 = await attest(evidencePolicyOf, dsseSigner, [{ key: k.a.privateKey }], input);
  assertEquals(ok1.kind, "ok");
  if (ok1.kind === "ok") {
    assertEquals(ok1.value.signer, "dsse");
    const env = JSON.parse(ok1.value.signature ?? "{}");
    const v = await dsseSigner.verify(env, "application/vnd.grc.attestation+json", [{ key: k.a.publicKey }]);
    assertEquals(v.kind, "ok");
  }
  const role = await attest(evidencePolicyOf, dsseSigner, [{ key: k.a.privateKey }], { ...input, role: "intern" });
  assertEquals(role.kind === "err" ? role.error.kind : "", "role");
  const hardware = must(evidencePolicy.decode, { ...evidencePolicyOf, custody: "hardware" });
  const custody = await attest(hardware, dsseSigner, [{ key: k.a.privateKey }], input);
  assertEquals(custody.kind === "err" ? custody.error.kind : "", "custody");
  const nosigner = await attest(hardware, undefined, [], input);
  assertEquals(nosigner.kind === "err" ? nosigner.error.kind : "", "custody");
  const free = await attest(must(evidencePolicy.decode, { ...evidencePolicyOf, custody: "none" }), undefined, [], input);
  assertEquals(free.kind === "ok" && free.value.signature === undefined, true);
  const bad = await attest(evidencePolicyOf, dsseSigner, [], input);
  assertEquals(bad.kind === "err" ? bad.error.kind : "", "signing");
});
