// Spec: 0004-evidence-capture-seal FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
/**
 * Sealing the journal and exporting a bundle (commons evidence-capture 0004-evidence-capture-seal): a seal is a person's signature, made with their SSH key, over the head of the journal at an instant, kept on the branch with an entry of the journal; a bundle is
 * the journal up to an instant, the states it names by their digests, the evidence documents, a manifest and the signature over it, in the folder `grc` verifies offline. The collector never signs: both are made by a person, on demand, with a key whose
 * passphrase only `ssh-keygen` sees.
 *
 * @example
 * ```ts
 * import { sealPayload } from "./bundle.ts";
 * sealPayload({ fleet: "fcr", branch: "evidence", seq: 3, head: "ab".repeat(32), at: "2026-12-01T10:00:00Z" }).includes("opsfolio-seal/1"); // true
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { evidencePolicy, instantMs, provenanceOf, type EvidencePolicy } from "@intellectual-frontiers/grc/governance";
import { appendEntry, canonicalize, makeManifest, manifestBytes } from "@intellectual-frontiers/grc/logical";
import { bundleOk, evidenceOf, MANIFEST_PAYLOAD_TYPE, readBundle, verifyBundle, type BundleFinding, type BundleReport, type Trust } from "@intellectual-frontiers/grc/physical";
import type { GitRefStore } from "@intellectual-frontiers/grc/stores/gitref";
import { fingerprintOf, sshsigSigner, type SignKey } from "@intellectual-frontiers/grc/signers/sshsig";
import { fs, path } from "@intellectual-frontiers/system";
import { readJournal } from "./collect.ts";
import { encodeEntry, journalPath, textDigest } from "@intellectual-frontiers/evidence-capture/logical";

const enc = new TextEncoder();
const text = (b: Uint8Array | undefined): string | undefined => (b === undefined ? undefined : new TextDecoder().decode(b));

/** The payload a seal signs: the fleet, the branch and the position and digest of the head of the journal, and when. */
export function sealPayload(s: { readonly fleet: string; readonly branch: string; readonly seq: number; readonly head: string; readonly at: string }): string {
  return canonicalize({ format: "opsfolio-seal/1", fleet: s.fleet, branch: s.branch, seq: s.seq, head: s.head, sealedAt: s.at });
}

/** The payload type of a seal. */
export const SEAL_PAYLOAD_TYPE = "application/vnd.opsfolio.seal+json";

/** A signer a seal or a bundle is verified with: its name, its role and its public key line. */
export type TrustedSigner = { readonly name: string; readonly role: string; readonly key: string };

/** The path of a seal on the branch, by the position of the head it covers. */
export const sealPath = (seq: number): string => `seals/${String(seq).padStart(8, "0")}.json`;

/** Seals the journal: signs its head with the key and keeps the envelope and an entry `seal` on the branch, in one commit made at the instant. */
export async function sealJournal(store: GitRefStore, o: { readonly fleet: string; readonly key: SignKey; readonly now: string }): Promise<Result<{ readonly seq: number; readonly head: string; readonly commit: string | undefined }, string>> {
  const journal = await readJournal(store);
  if (journal.kind === "err") return journal;
  const head = journal.value.at(-1);
  if (head === undefined) return err("the journal is empty: there is nothing to seal");
  const payload = enc.encode(sealPayload({ fleet: o.fleet, branch: store.branch, seq: head.seq, head: head.digest, at: o.now }));
  const signed = await sshsigSigner.sign(SEAL_PAYLOAD_TYPE, payload, [o.key]);
  if (signed.kind === "err") return err(signed.error.message);
  const envelope = canonicalize(signed.value);
  const entry = await appendEntry(head, { at: o.now, type: "seal", subject: o.fleet, evidence: await textDigest(envelope) });
  const file = journalPath(o.now);
  const made = await store.commit(
    [
      { path: sealPath(head.seq), bytes: enc.encode(`${envelope}\n`) },
      { path: file, bytes: enc.encode(`${text(await store.read(file)) ?? ""}${encodeEntry(entry)}`) },
    ],
    `sealed ${o.fleet} at ${head.seq}: ${head.digest.slice(0, 12)}`,
    o.now,
  );
  return made.kind === "err" ? err(made.error.message) : ok({ seq: head.seq, head: head.digest, commit: made.value.commit });
}

/** What the seals of a journal say: each seal that verifies, each that does not and why, and how many entries came after the last good seal. */
export type SealStatus = { readonly seals: readonly { readonly seq: number; readonly ok: boolean; readonly detail: string }[]; readonly lastSealedSeq: number | undefined; readonly unsealed: number };

/** Verifies the seals of the branch with the signers trusted: the signature, and that the head it signed is the entry of the journal at that position. */
export async function sealStatus(store: GitRefStore, trusted: readonly TrustedSigner[]): Promise<Result<SealStatus, string>> {
  const journal = await readJournal(store);
  if (journal.kind === "err") return journal;
  const seals: { seq: number; ok: boolean; detail: string }[] = [];
  let lastGood: number | undefined;
  for (const file of (await store.list("seals")).filter((f) => f.endsWith(".json"))) {
    const at = Number(path.basename(file).replace(".json", ""));
    let envelope: unknown;
    try {
      envelope = JSON.parse(text(await store.read(file)) ?? "");
    } catch {
      seals.push({ seq: at, ok: false, detail: "the seal is not JSON" });
      continue;
    }
    const verified = await sshsigSigner.verify(envelope as never, SEAL_PAYLOAD_TYPE, trusted.map((t) => ({ publicKey: t.key })));
    if (verified.kind === "err") {
      seals.push({ seq: at, ok: false, detail: verified.error.message });
      continue;
    }
    const payload = JSON.parse(new TextDecoder().decode(verified.value)) as { seq?: number; head?: string };
    const entry = journal.value[(payload.seq ?? 0) - 1];
    if (entry === undefined || entry.digest !== payload.head) {
      seals.push({ seq: at, ok: false, detail: "the head that was signed is not the entry of the journal at that position" });
      continue;
    }
    seals.push({ seq: payload.seq ?? at, ok: true, detail: "verifies" });
    lastGood = Math.max(lastGood ?? 0, payload.seq ?? 0);
  }
  const after = journal.value.filter((e) => e.seq > (lastGood ?? 0) && e.type !== "seal").length;
  return ok({ seals, lastSealedSeq: lastGood, unsealed: after });
}

/** What an export is given. */
export type ExportOptions = { readonly fleet: string; readonly out: string; readonly until: string; readonly now: string; readonly key?: SignKey; readonly signers: readonly TrustedSigner[] };

/** What an export made. */
export type Exported = { readonly dir: string; readonly items: number; readonly entries: number; readonly head: string; readonly signed: boolean };

/**
 * Exports the journal up to an instant as a bundle in a folder that does not exist yet: the entries of the journal in order (the chain from the first, so that it verifies on its own), the states the entries name as items by their digests, the evidence documents, the
 * manifest, the signers it was made with, and, where a key is given, the signature of the manifest by that key.
 */
export async function exportBundle(store: GitRefStore, o: ExportOptions): Promise<Result<Exported, string>> {
  const journal = await readJournal(store);
  if (journal.kind === "err") return journal;
  const limit = instantMs(o.until);
  if (limit === undefined) return err(`${o.until} is not an instant`);
  const entries = journal.value.filter((e) => (instantMs(e.createdAt) ?? 0) <= limit);
  const last = entries.at(-1);
  if (last === undefined) return err("the journal holds nothing up to that instant");
  if (await fs.exists(o.out)) return err(`${o.out} exists: a bundle is made in a folder that does not`);

  const wanted = new Map<string, { subject: string; at: string }>();
  for (const e of entries) if ((e.type === "capture.changed" || e.type === "capture.unchanged") && !wanted.has(e.evidence)) wanted.set(e.evidence, { subject: e.subject, at: e.createdAt });
  const items = new Map<string, Uint8Array>();
  for (const file of (await store.list("state")).filter((f) => f.endsWith(".json"))) {
    for (const h of await store.history(file)) {
      const bytes = await store.read(file, h.commit);
      if (bytes === undefined) continue;
      const digest = await sha256(bytes);
      if (wanted.has(digest)) items.set(digest, bytes);
    }
  }
  const docs = [];
  for (const [digest, bytes] of [...items].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const w = wanted.get(digest);
    docs.push(await evidenceOf(bytes, { subject: w?.subject ?? "", type: "machine-state", mediaType: "application/json", observedAt: w?.at ?? o.now }, "git"));
  }
  const manifest = makeManifest(docs.map((d) => ({ digest: d.digest, size: d.size, mediaType: d.mediaType })), last.digest, o.now);
  await fs.mkdir(path.join(o.out, "items"), { recursive: true });
  for (const [digest, bytes] of items) await fs.writeFile(path.join(o.out, "items", digest), bytes);
  await fs.writeTextFile(path.join(o.out, "manifest.json"), canonicalize(manifest));
  await fs.writeTextFile(path.join(o.out, "ledger.json"), canonicalize(entries));
  await fs.writeTextFile(path.join(o.out, "evidence.json"), canonicalize(docs));
  await fs.writeTextFile(path.join(o.out, "signers.json"), `${JSON.stringify({ fleet: o.fleet, signers: o.signers }, null, 2)}\n`);
  let signed = false;
  if (o.key !== undefined) {
    const sig = await sshsigSigner.sign(MANIFEST_PAYLOAD_TYPE, manifestBytes(manifest), [o.key]);
    if (sig.kind === "err") return err(sig.error.message);
    await fs.writeTextFile(path.join(o.out, "signature.json"), canonicalize(sig.value));
    signed = true;
  }
  return ok({ dir: o.out, items: items.size, entries: entries.length, head: last.digest, signed });
}

/** The policy a bundle is verified with: signers of the roles given may attest, with a key in a file, and evidence is kept as long as the verifier says. */
export function bundlePolicy(roles: readonly string[], retention = "P10Y"): EvidencePolicy {
  const decoded = evidencePolicy.decode({ kind: "grc.evidence-policy", schema: "1", id: "policy:opsfolio-bundle", createdAt: "2026-01-01T00:00:00Z", provenance: provenanceOf([]), counts: [], retention, attesters: [...roles], custody: "file" });
  if (decoded.kind === "err") throw new Error(`the policy of a bundle does not decode: ${decoded.error.path}`);
  return decoded.value;
}

/** What verifying a bundle came to: the report of `grc`, whether it has no finding, and whose keys were trusted. */
export type Verified = { readonly report: BundleReport; readonly ok: boolean; readonly trustedOwn: boolean };

/**
 * Verifies a bundle in a folder offline: every item against the manifest, the chain of the journal against the head the manifest names, and the signature of the manifest with the signers given (or, where none are given, the bundle's own `signers.json`, which
 * is said: a bundle can vouch only for what it holds). Nothing is written and no network is used.
 */
export async function verifyBundleDir(dir: string, signers: readonly TrustedSigner[] | undefined, at: string): Promise<Result<Verified, string>> {
  const contents = await readBundle(dir);
  if (contents.kind === "err") return contents;
  let list = signers;
  let own = false;
  if (list === undefined) {
    try {
      list = (JSON.parse(await fs.readTextFile(path.join(dir, "signers.json"))) as { signers: TrustedSigner[] }).signers;
      own = true;
    } catch {
      return err(`${dir} has no signers.json and no signers were given`);
    }
  }
  const keys: Trust["keys"][number][] = [];
  for (const s of list) {
    const fp = await fingerprintOf(s.key);
    if (fp.kind === "ok") keys.push({ keyid: fp.value, role: s.role, key: { publicKey: s.key } });
  }
  const trust: Trust = { policy: bundlePolicy([...new Set(list.map((s) => s.role))]), signer: sshsigSigner, keys };
  const report = await verifyBundle(contents.value, trust, at);
  return ok({ report, ok: bundleOk(report), trustedOwn: own });
}

export type { BundleFinding };
