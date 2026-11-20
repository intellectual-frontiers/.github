/**
 * Tests of evidence bundles (0011-grc-bundles): a bundle made and signed here, each way it can be wrong shown as a typed finding that names the item, entry, signature or file, the file adapter, and the
 * verb `grc bundle verify` with its exit statuses and the explanation of its codes. Nothing uses a network.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { countsOf, exitOfNamed } from "@intellectual-frontiers/headless/governance";
import { modelProblems, NO_CREDENTIALS, NO_PROGRESS, NO_PROMPT, placedCommands, programOf, type Context, type Outcome } from "@intellectual-frontiers/headless/logical";
import type { EvidencePolicy } from "@intellectual-frontiers/grc/governance";
import { appendEntry, canonicalize, type EvidenceManifest, makeManifest, type LedgerEntry } from "@intellectual-frontiers/grc/logical";
import {
  type BundleContents,
  type BundleFinding,
  bundleOk,
  codeOfFinding,
  concernOf,
  createRunners,
  describeFinding,
  evidenceOf,
  FINDING_KINDS,
  MANIFEST_PAYLOAD_TYPE,
  readBundle,
  readTrust,
  type Trust,
  verifyBundle,
} from "@intellectual-frontiers/grc/physical";
import { standardSigners } from "../src/standard.ts";
import { dsseSigner } from "@intellectual-frontiers/grc/signers/dsse";
import { BUNDLE_CATALOGUE, bundleCatalogueProblems, grcBranch, type GrcHost } from "@intellectual-frontiers/grc/surfaces/headless";
import { standardSerializers } from "../src/standard.ts";
import { aCheck, AT, A1, ex, evidencePolicyOf } from "./fixtures.ts";

const enc = new TextEncoder();
const PAYLOADS = ["alpha", "beta", "gamma"].map((t) => enc.encode(t));

type Made = { readonly contents: BundleContents; readonly trust: Trust; readonly manifest: EvidenceManifest; readonly ledger: readonly LedgerEntry[]; readonly keys: { readonly publicJwk: JsonWebKey; readonly privateKey: CryptoKey }; readonly policy: EvidencePolicy };

async function pair(): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey }> {
  const k = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
  if (!("publicKey" in k)) throw new Error("a key pair is expected");
  return k;
}

async function sign(manifest: unknown, privateKey: CryptoKey, keyid: string): Promise<string> {
  const e = await dsseSigner.sign(MANIFEST_PAYLOAD_TYPE, enc.encode(canonicalize(manifest)), [{ key: privateKey, keyid }]);
  if (e.kind === "err") throw new Error(e.error.message);
  return JSON.stringify(e.value);
}

async function made(): Promise<Made> {
  const items = new Map<string, Uint8Array>();
  const docs = [];
  for (const bytes of PAYLOADS) {
    const e = await evidenceOf(bytes, { subject: "host-1", type: "observation", mediaType: "text/plain", observedAt: AT }, "files");
    items.set(e.digest, bytes);
    docs.push(e);
  }
  const ledger: LedgerEntry[] = [];
  let last: LedgerEntry | undefined;
  for (const d of docs) {
    last = await appendEntry(last, { at: AT, type: "observation", subject: "host-1", evidence: d.digest });
    ledger.push(last);
  }
  const manifest = makeManifest(docs.map((d) => ({ digest: d.digest, size: d.size, mediaType: d.mediaType })), last?.digest ?? "", AT);
  const { publicKey, privateKey } = await pair();
  const contents: BundleContents = {
    manifest: canonicalize(manifest),
    ledger: canonicalize(ledger),
    evidence: canonicalize(docs),
    signature: await sign(manifest, privateKey, "signer-1"),
    items,
  };
  const policy: EvidencePolicy = { ...evidencePolicyOf, attesters: ["ciso"], custody: "file" };
  const trust: Trust = { policy, signer: dsseSigner, keys: [{ keyid: "signer-1", role: "ciso", key: { key: publicKey, keyid: "signer-1" } }] };
  return { contents, trust, manifest, ledger, keys: { publicJwk: await crypto.subtle.exportKey("jwk", publicKey), privateKey }, policy };
}

const kinds = (fs_: readonly BundleFinding[]): readonly string[] => fs_.map((f) => f.kind);
const at = "2026-06-02T00:00:00Z";

proves(["0011-grc-bundles FR-001"], "a bundle is a folder of its documents and items; the trust is the verifier's and never read from the bundle", async () => {
  const b = await made();
  const dir = await fs.makeTempDir({ prefix: "bundle-" });
  try {
    await fs.writeTextFile(path.join(dir, "manifest.json"), b.contents.manifest ?? "");
    await fs.writeTextFile(path.join(dir, "ledger.json"), b.contents.ledger ?? "");
    await fs.writeTextFile(path.join(dir, "evidence.json"), b.contents.evidence ?? "");
    await fs.writeTextFile(path.join(dir, "signature.json"), b.contents.signature ?? "");
    await fs.mkdir(path.join(dir, "items"));
    for (const [d, bytes] of b.contents.items) await fs.writeFile(path.join(dir, "items", d), bytes);
    const r = await readBundle(dir);
    assert(r.kind === "ok");
    assertEquals([r.value.manifest, r.value.signature, r.value.items.size], [b.contents.manifest, b.contents.signature, 3]);
    assertEquals(bundleOk(await verifyBundle(r.value, b.trust, at)), true);
    assertEquals((await readBundle(path.join(dir, "nothing"))).kind, "err");
    await fs.writeTextFile(path.join(dir, "keys.json"), JSON.stringify({ keys: [] }));
    assertEquals(kinds((await verifyBundle(r.value, { ...b.trust, keys: [] }, at)).findings), ["signer-unallowed"]);
  } finally {
    await fs.remove(dir, { recursive: true });
  }
});

proves(["0011-grc-bundles FR-002"], "the core is pure over contents: the same contents and trust give the same report, and nothing is read from a file, a network or a clock", async () => {
  const b = await made();
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error("the network was used");
  };
  try {
    const [x, y] = [await verifyBundle(b.contents, b.trust, at), await verifyBundle(b.contents, b.trust, at)];
    assertEquals(canonicalize(x), canonicalize(y));
    assertEquals([x.items, x.entries, x.findings], [3, 3, []]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

proves(["0011-grc-bundles FR-003"], "every finding is of the closed union and names what it concerns, with one sentence and a stable code", () => {
  const d = "ab".repeat(32);
  const all: readonly BundleFinding[] = [
    { kind: "item-missing", digest: d },
    { kind: "item-hash-mismatch", digest: d, actual: "cd".repeat(32) },
    { kind: "item-size-mismatch", digest: d, expected: 1, actual: 2 },
    { kind: "item-extra", digest: d },
    { kind: "chain-broken", seq: 3, reason: "entry 3 was changed" },
    { kind: "not-canonical", file: "manifest.json" },
    { kind: "signature-absent" },
    { kind: "signature-bad", keyid: "k", reason: "no" },
    { kind: "signer-unallowed", keyid: "k", why: "role", detail: "x" },
    { kind: "evidence-expired", digest: d },
    { kind: "kind-unknown", file: "ledger.json", found: "x" },
    { kind: "schema-unknown", file: "manifest.json", found: "2", expected: "1" },
    { kind: "document-invalid", file: "evidence.json", message: "m" },
  ];
  assertEquals(new Set(all.map((f) => f.kind)), new Set(FINDING_KINDS));
  assertEquals(all.map(concernOf), [`item ${d}`, `item ${d}`, `item ${d}`, `item ${d}`, "entry 3", "manifest.json", "signature.json", "signature k", "signature k", `item ${d}`, "ledger.json", "manifest.json", "evidence.json"]);
  assertEquals(codeOfFinding({ kind: "chain-broken", seq: 1, reason: "r" }), "E-BUNDLE-CHAIN-BROKEN");
  assert(all.every((f) => describeFinding(f).length > 10 && codeOfFinding(f).startsWith("E-BUNDLE-")));
});

proves(["0011-grc-bundles FR-004"], "an item is missing, has the wrong hash or size, or is extra", async () => {
  const b = await made();
  const [first, second] = [...b.contents.items.keys()].sort();
  assert(first !== undefined && second !== undefined);
  const run = async (items: ReadonlyMap<string, Uint8Array>) => (await verifyBundle({ ...b.contents, items }, b.trust, at)).findings;
  const without = new Map(b.contents.items);
  without.delete(first);
  assertEquals(await run(without), [{ kind: "item-missing", digest: first }]);
  const edited = new Map(b.contents.items);
  edited.set(second, enc.encode("tampered"));
  const hash = await sha256(enc.encode("tampered"));
  assertEquals(await run(edited), [
    { kind: "item-hash-mismatch", digest: second, actual: hash },
    { kind: "item-size-mismatch", digest: second, expected: b.manifest.items.find((i) => i.digest === second)?.size ?? 0, actual: 8 },
  ]);
  const extra = new Map(b.contents.items);
  extra.set("ff".repeat(32), enc.encode("x"));
  assertEquals(await run(extra), [{ kind: "item-extra", digest: "ff".repeat(32) }]);
});

proves(["0011-grc-bundles FR-005"], "the ledger is verified against the head the manifest names and the first entry at fault is named", async () => {
  const b = await made();
  const entries = b.ledger.map((e) => ({ ...e }));
  const changed = entries.map((e, i) => (i === 1 ? { ...e, subject: "host-9" } : e));
  const r1 = await verifyBundle({ ...b.contents, ledger: canonicalize(changed) }, b.trust, at);
  assertEquals(r1.findings.map((f) => (f.kind === "chain-broken" ? f.seq : f.kind)), [2]);
  const cut = await verifyBundle({ ...b.contents, ledger: canonicalize(b.ledger.slice(0, 2)) }, b.trust, at);
  assertEquals(cut.findings.map((f) => (f.kind === "chain-broken" ? f.seq : f.kind)), [3]);
  const reordered = await verifyBundle({ ...b.contents, ledger: canonicalize([b.ledger[1], b.ledger[0], b.ledger[2]]) }, b.trust, at);
  assertEquals(reordered.findings.map((f) => (f.kind === "chain-broken" ? f.seq : f.kind)), [1]);
});

proves(["0011-grc-bundles FR-006"], "a manifest, ledger or evidence list that is not in canonical form is found", async () => {
  const b = await made();
  const pretty = (text: string | undefined): string => JSON.stringify(JSON.parse(text ?? ""), null, 2);
  const r = await verifyBundle({ ...b.contents, manifest: pretty(b.contents.manifest), ledger: pretty(b.contents.ledger), evidence: pretty(b.contents.evidence) }, b.trust, at);
  assertEquals(r.findings, [
    { kind: "not-canonical", file: "evidence.json" },
    { kind: "not-canonical", file: "ledger.json" },
    { kind: "not-canonical", file: "manifest.json" },
  ]);
});

proves(["0011-grc-bundles FR-007"], "the signature verifies over the canonical manifest with the verifier's keys, and an absent, bad or unallowed one is found", async () => {
  const b = await made();
  const run = async (c: Partial<BundleContents>, t: Trust = b.trust) => (await verifyBundle({ ...b.contents, ...c }, t, at)).findings;
  assertEquals(await run({ signature: undefined }), [{ kind: "signature-absent" }]);
  assertEquals(await run({ signature: JSON.stringify({ payloadType: MANIFEST_PAYLOAD_TYPE, payload: "", signatures: [] }) }), [{ kind: "signature-absent" }]);
  const other = await pair();
  const forged = await run({ signature: await sign(b.manifest, other.privateKey, "signer-1") });
  assertEquals(kinds(forged), ["signature-bad"]);
  const wrongPayload = await run({ signature: await sign({ ...b.manifest, id: "other" }, b.keys.privateKey, "signer-1") });
  assertEquals(wrongPayload.map((f) => f.kind === "signature-bad" && f.reason), [ "the signed payload is not the manifest" ]);
  const stranger = await run({ signature: await sign(b.manifest, other.privateKey, "signer-2") });
  assertEquals(stranger.map((f) => f.kind === "signer-unallowed" && f.why), ["unknown-key"]);
  const role = await run({}, { ...b.trust, keys: b.trust.keys.map((k) => ({ ...k, role: "intern" })) });
  assertEquals(role.map((f) => f.kind === "signer-unallowed" && f.why), ["role"]);
  const custody = await run({}, { ...b.trust, policy: { ...b.policy, custody: "hardware" } });
  assertEquals(custody.map((f) => f.kind === "signer-unallowed" && f.why), ["custody"]);
  assertEquals(kinds(await run({ signature: "{" })), ["document-invalid"]);
});

proves(["0011-grc-bundles FR-008"], "evidence past its retention at the instant is found", async () => {
  const b = await made();
  const late = await verifyBundle(b.contents, b.trust, "2028-01-01T00:00:00Z");
  assertEquals(late.findings.map((f) => f.kind), ["evidence-expired", "evidence-expired", "evidence-expired"]);
  assertEquals(bundleOk(await verifyBundle(b.contents, b.trust, "2026-12-31T00:00:00Z")), true);
});

proves(["0011-grc-bundles FR-009"], "a file that is absent, not JSON or does not decode is invalid; a kind or a schema no reader knows is named", async () => {
  const b = await made();
  const run = async (c: Partial<BundleContents>) => (await verifyBundle({ ...b.contents, ...c }, b.trust, at)).findings;
  assertEquals((await run({ manifest: undefined })).map((f) => f.kind), ["document-invalid"]);
  assertEquals((await run({ ledger: "not json" })).map((f) => f.kind), ["document-invalid"]);
  const m = JSON.parse(b.contents.manifest ?? "");
  assertEquals((await run({ manifest: canonicalize({ ...m, schema: "2" }) })).filter((f) => f.kind === "schema-unknown"), [{ kind: "schema-unknown", file: "manifest.json", found: "2", expected: "1" }]);
  assertEquals((await run({ evidence: canonicalize([{ ...JSON.parse(b.contents.evidence ?? "[]")[0], kind: "grc.other" }]) })), [{ kind: "kind-unknown", file: "evidence.json", found: "grc.other" }]);
  assertEquals((await run({ evidence: canonicalize({}) })).map((f) => f.kind), ["document-invalid"]);
});

function host(): GrcHost {
  return { frameworks: [ex], crosswalks: [], policies: [], checks: [aCheck("c", [A1])], requirements: [], exceptions: [], subjects: [], runners: createRunners(), serializers: standardSerializers(), signers: standardSigners(), now: () => at };
}

async function run(words: readonly string[], options: Record<string, unknown> = {}): Promise<{ outcome: Outcome; exit: number }> {
  const program = programOf({ name: "t", summary: "T.", version: "1", children: [grcBranch(host())] });
  const placed = placedCommands(program.children).find((p) => p.id === `grc ${words[0]}${words[0] === "bundle" ? " verify" : ""}`);
  if (placed === undefined) throw new Error(`no command ${words.join(" ")}`);
  const ctx: Context = { program: "t", command: placed.id, facts: placed.facts, mode: "apply", verbosity: "calm", interactive: false, progress: NO_PROGRESS, prompt: NO_PROMPT, credentials: NO_CREDENTIALS, env: () => undefined, signal: new AbortController().signal };
  const outcome = await placed.command.run({ kind: "args", options, positionals: words.slice(1), rest: [] } as never, ctx);
  return { outcome, exit: exitOfNamed(countsOf(outcome.problems), outcome.exit) };
}

async function onDisk(b: Made): Promise<{ dir: string; keys: string; policy: string }> {
  const dir = await fs.makeTempDir({ prefix: "bundle-verb-" });
  const folder = path.join(dir, "bundle");
  await fs.mkdir(path.join(folder, "items"), { recursive: true });
  for (const [name, text] of [["manifest.json", b.contents.manifest], ["ledger.json", b.contents.ledger], ["evidence.json", b.contents.evidence], ["signature.json", b.contents.signature]] as const) await fs.writeTextFile(path.join(folder, name), text ?? "");
  for (const [d, bytes] of b.contents.items) await fs.writeFile(path.join(folder, "items", d), bytes);
  const keys = path.join(dir, "keys.json");
  await fs.writeTextFile(keys, JSON.stringify({ keys: [{ keyid: "signer-1", role: "ciso", jwk: b.keys.publicJwk }] }));
  const policy = path.join(dir, "policy.json");
  await fs.writeTextFile(policy, JSON.stringify(b.policy));
  return { dir: folder, keys, policy };
}

proves(["0011-grc-bundles FR-010"], "the verb is grc bundle verify, a read-only report with a reach, and grc evidence verify stays the verification of the store", async () => {
  const program = programOf({ name: "t", summary: "T.", version: "1", children: [grcBranch(host())] });
  const placed = placedCommands(program.children);
  assertEquals(placed.map((p) => p.id), ["grc check", "grc assess", "grc explain", "grc evidence", "grc bundle verify"]);
  assertEquals(modelProblems(program, { requireReach: true }), []);
  const verify = placed.find((p) => p.id === "grc bundle verify");
  assertEquals([verify?.facts.kind, verify?.facts.effect], ["report", "read"]);
  assertEquals((await run(["evidence", "verify"])).outcome.problems.map((p) => p.code), ["E-EVIDENCE-NO-STORE"]);
});

proves(["0011-grc-bundles FR-011"], "the exit is ok, findings, usage or environment, and each finding's code is explained", async () => {
  const b = await made();
  const f = await onDisk(b);
  try {
    const good = await run(["bundle", f.dir], { keys: f.keys, policy: f.policy });
    assertEquals([good.exit, good.outcome.problems], [0, []]);
    await fs.writeFile(path.join(f.dir, "items", [...b.contents.items.keys()][0] ?? ""), enc.encode("tampered"));
    const bad = await run(["bundle", f.dir], { keys: f.keys, policy: f.policy });
    assertEquals(bad.exit, 1);
    assertEquals(bad.outcome.problems.map((p) => p.code), ["E-BUNDLE-ITEM-HASH-MISMATCH", "E-BUNDLE-ITEM-SIZE-MISMATCH"]);
    assertEquals((await run(["bundle"], {})).exit, 2);
    assertEquals((await run(["bundle", f.dir], { keys: f.keys, policy: f.policy, at: "tomorrow" })).exit, 2);
    assertEquals((await run(["bundle", f.dir], { keys: f.keys, policy: f.policy, signer: "nothing" })).exit, 2);
    assertEquals((await run(["bundle", path.join(f.dir, "nothing")], { keys: f.keys, policy: f.policy })).exit, 3);
    assertEquals((await run(["bundle", f.dir], { keys: path.join(f.dir, "no.json"), policy: f.policy })).exit, 3);
  } finally {
    await fs.remove(path.dirname(f.dir), { recursive: true });
  }
  assertEquals(bundleCatalogueProblems(), []);
  for (const k of FINDING_KINDS) assert(BUNDLE_CATALOGUE[`E-BUNDLE-${k.toUpperCase()}`] !== undefined, k);
  const explained = await run(["explain", "e-bundle-item-missing"]);
  assertStringIncludes(explained.outcome.text ?? "", "Likely cause");
  assertStringIncludes(explained.outcome.text ?? "", "E-BUNDLE-ITEM-MISSING");
});

proves(["0011-grc-bundles FR-012"], "verifying uses no network and writes nothing", async () => {
  const b = await made();
  const f = await onDisk(b);
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error("the network was used");
  };
  const snapshot = async (): Promise<string> => {
    const names: string[] = [];
    for await (const e of fs.readDir(path.dirname(f.dir))) names.push(`${e.name}:${(await fs.stat(path.join(path.dirname(f.dir), e.name))).mtime?.getTime()}`);
    for await (const e of fs.readDir(f.dir)) names.push(`${e.name}:${(await fs.stat(path.join(f.dir, e.name))).mtime?.getTime()}`);
    return names.sort().join("\n");
  };
  try {
    const before = await snapshot();
    const r = await run(["bundle", f.dir], { keys: f.keys, policy: f.policy });
    assertEquals(r.exit, 0);
    assertEquals(await snapshot(), before);
    const trust = await readTrust(f.policy, f.keys, dsseSigner);
    assertEquals(trust.kind, "ok");
  } finally {
    globalThis.fetch = realFetch;
    await fs.remove(path.dirname(f.dir), { recursive: true });
  }
});
