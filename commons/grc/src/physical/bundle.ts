// Spec: 0011-grc-bundles FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-012
/**
 * Verifying a whole evidence bundle offline (0011-grc-bundles): the manifest's items by hash and size, the ledger's hash chain against the head the manifest names, the canonical form of the
 * documents, the signature of the manifest (the signer and the keys are the verifier's, never the bundle's), and the retention of the evidence. The core is pure over the contents of a bundle and
 * names each fault as a typed finding of a closed union that says the item, entry, signature or file it concerns.
 *
 * @remarks
 * It uses no network, no file and no clock: `readBundle` (in `bundle-files.ts`) is the adapter that reads a folder into `BundleContents`.
 *
 * @example
 * ```ts
 * import { codeOfFinding } from "./bundle.ts";
 * codeOfFinding({ kind: "item-missing", digest: "ab".repeat(32) }); // "E-BUNDLE-ITEM-MISSING"
 * ```
 *
 * @module
 */
import { array, type Decoder, err, object, ok, type Result, string } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { type Document, type DocumentKind, type EvidencePolicy, readDocument } from "@intellectual-frontiers/grc/governance";
import {
  canonicalize,
  type EvidenceManifest,
  evidence,
  evidenceManifest,
  ledgerEntry,
  manifestBytes,
  standardKinds,
  verifyLedger,
} from "@intellectual-frontiers/grc/logical";
import { type Signer, signerAllowed } from "./signer.ts";
import { retained } from "./store.ts";

/** The files of a bundle that hold a document. */
export type BundleFile = "manifest.json" | "ledger.json" | "evidence.json" | "signature.json";

/**
 * The payload type of the signature of a manifest.
 *
 * @example
 * ```ts
 * MANIFEST_PAYLOAD_TYPE; // "application/vnd.grc.evidence-manifest+json"
 * ```
 */
export const MANIFEST_PAYLOAD_TYPE = "application/vnd.grc.evidence-manifest+json";

/** What a bundle holds, read: the text of its documents (absent where the file is) and the bytes of its items by digest. */
export type BundleContents = {
  readonly manifest: string | undefined;
  readonly ledger: string | undefined;
  readonly evidence: string | undefined;
  readonly signature: string | undefined;
  readonly items: ReadonlyMap<string, Uint8Array>;
};

/** A key the verifier trusts, the role it may attest in, and the key as its signer takes it. */
export type TrustedKey = { readonly keyid: string; readonly role: string; readonly key: unknown };

/** What the verifier gives: the evidence policy, the signer and the keys it trusts. */
export type Trust = { readonly policy: EvidencePolicy; readonly signer: Signer; readonly keys: readonly TrustedKey[] };

/** Every fault of a bundle, each with what it concerns. */
export type BundleFinding =
  | { readonly kind: "item-missing"; readonly digest: string }
  | { readonly kind: "item-hash-mismatch"; readonly digest: string; readonly actual: string }
  | { readonly kind: "item-size-mismatch"; readonly digest: string; readonly expected: number; readonly actual: number }
  | { readonly kind: "item-extra"; readonly digest: string }
  | { readonly kind: "chain-broken"; readonly seq: number; readonly reason: string }
  | { readonly kind: "not-canonical"; readonly file: BundleFile }
  | { readonly kind: "signature-absent" }
  | { readonly kind: "signature-bad"; readonly keyid: string | undefined; readonly reason: string }
  | { readonly kind: "signer-unallowed"; readonly keyid: string | undefined; readonly why: "unknown-key" | "role" | "custody"; readonly detail: string }
  | { readonly kind: "evidence-expired"; readonly digest: string }
  | { readonly kind: "kind-unknown"; readonly file: BundleFile; readonly found: string }
  | { readonly kind: "schema-unknown"; readonly file: BundleFile; readonly found: string; readonly expected: string }
  | { readonly kind: "document-invalid"; readonly file: BundleFile; readonly message: string };

/** The kind of a finding. */
export type FindingKind = BundleFinding["kind"];

/**
 * Every kind of finding, in the order a report gives them.
 *
 * @example
 * ```ts
 * FINDING_KINDS.includes("item-missing"); // true
 * ```
 */
export const FINDING_KINDS = [
  "document-invalid",
  "kind-unknown",
  "schema-unknown",
  "not-canonical",
  "item-missing",
  "item-hash-mismatch",
  "item-size-mismatch",
  "item-extra",
  "chain-broken",
  "evidence-expired",
  "signature-absent",
  "signature-bad",
  "signer-unallowed",
] as const satisfies readonly FindingKind[];

/** The stable problem code of a finding: `E-BUNDLE-` and its kind in upper case. */
export function codeOfFinding(f: BundleFinding): string {
  return codeOfKind(f.kind);
}

/**
 * The stable problem code of a kind of finding.
 *
 * @example
 * ```ts
 * codeOfKind("chain-broken"); // "E-BUNDLE-CHAIN-BROKEN"
 * ```
 */
export function codeOfKind(kind: FindingKind): string {
  return `E-BUNDLE-${kind.toUpperCase()}`;
}

/**
 * What a finding concerns, as one short name: an item, an entry, a signature, or a file.
 *
 * @example
 * ```ts
 * concernOf({ kind: "chain-broken", seq: 3, reason: "entry 3 was changed" }); // "entry 3"
 * ```
 */
export function concernOf(f: BundleFinding): string {
  switch (f.kind) {
    case "item-missing":
    case "item-hash-mismatch":
    case "item-size-mismatch":
    case "item-extra":
    case "evidence-expired":
      return `item ${f.digest}`;
    case "chain-broken":
      return `entry ${f.seq}`;
    case "signature-absent":
      return "signature.json";
    case "signature-bad":
    case "signer-unallowed":
      return f.keyid === undefined ? "signature.json" : `signature ${f.keyid}`;
    case "not-canonical":
    case "kind-unknown":
    case "schema-unknown":
    case "document-invalid":
      return f.file;
  }
}

/**
 * One sentence for a finding.
 *
 * @example
 * ```ts
 * describeFinding({ kind: "signature-absent" }); // "the bundle has no signature"
 * ```
 */
export function describeFinding(f: BundleFinding): string {
  switch (f.kind) {
    case "item-missing":
      return `the manifest lists item ${f.digest}, and the bundle does not hold it`;
    case "item-hash-mismatch":
      return `item ${f.digest} has the digest ${f.actual}`;
    case "item-size-mismatch":
      return `item ${f.digest} has ${f.actual} bytes, and the manifest says ${f.expected}`;
    case "item-extra":
      return `the bundle holds item ${f.digest}, and the manifest does not list it`;
    case "chain-broken":
      return `ledger: ${f.reason}`;
    case "not-canonical":
      return `${f.file} is not in canonical form (RFC 8785)`;
    case "signature-absent":
      return "the bundle has no signature";
    case "signature-bad":
      return `${f.keyid === undefined ? "a signature" : `the signature of ${f.keyid}`} is bad: ${f.reason}`;
    case "signer-unallowed":
      return `${f.keyid === undefined ? "the signer" : `the signer ${f.keyid}`} is not allowed (${f.why}): ${f.detail}`;
    case "evidence-expired":
      return `the evidence ${f.digest} is past its retention`;
    case "kind-unknown":
      return `${f.file} is a document of the kind ${f.found}, which no reader knows`;
    case "schema-unknown":
      return `${f.file} is of schema ${f.found}; this release reads schema ${f.expected}`;
    case "document-invalid":
      return `${f.file}: ${f.message}`;
  }
}

/** What verification gave: the instant, the findings in the order of `FINDING_KINDS`, and how much was checked. */
export type BundleReport = { readonly at: string; readonly items: number; readonly entries: number; readonly findings: readonly BundleFinding[] };

type Read<T> = Result<{ readonly value: T; readonly raw: unknown }, BundleFinding>;

function parse(file: BundleFile, text: string | undefined): Result<unknown, BundleFinding> {
  if (text === undefined) return err({ kind: "document-invalid", file, message: "the file is absent" });
  try {
    return ok(JSON.parse(text));
  } catch (e) {
    return err({ kind: "document-invalid", file, message: `not JSON: ${e instanceof Error ? e.message : String(e)}` });
  }
}

function asKind<T extends Document>(file: BundleFile, kind: DocumentKind<T>, value: unknown): Result<T, BundleFinding> {
  const read = readDocument(standardKinds(), value);
  if (read.kind === "err") {
    const p = read.error;
    switch (p.kind) {
      case "json":
        return err({ kind: "document-invalid", file, message: p.message });
      case "no-kind":
        return err({ kind: "document-invalid", file, message: "a document says its kind" });
      case "unknown-kind":
        return err({ kind: "kind-unknown", file, found: p.found });
      case "schema":
        return err({ kind: "schema-unknown", file, found: p.found, expected: p.expected });
      case "decode":
        return err({ kind: "document-invalid", file, message: `${p.error.path}: expected ${p.error.expected}, found ${p.error.found}` });
    }
  }
  if (read.value.kind !== kind.kind) return err({ kind: "document-invalid", file, message: `expected a ${kind.kind}, found a ${read.value.kind}` });
  const d = kind.decode(value);
  return d.kind === "ok" ? ok(d.value) : err({ kind: "document-invalid", file, message: `${d.error.path}: expected ${d.error.expected}` });
}

function readOne<T extends Document>(file: BundleFile, text: string | undefined, kind: DocumentKind<T>): Read<T> {
  const p = parse(file, text);
  if (p.kind === "err") return p;
  const d = asKind(file, kind, p.value);
  return d.kind === "err" ? d : ok({ value: d.value, raw: p.value });
}

function readMany<T extends Document>(file: BundleFile, text: string | undefined, kind: DocumentKind<T>): Read<readonly T[]> {
  const p = parse(file, text);
  if (p.kind === "err") return p;
  if (!Array.isArray(p.value)) return err({ kind: "document-invalid", file, message: "an array of documents is expected" });
  const out: T[] = [];
  for (const v of p.value as readonly unknown[]) {
    const d = asKind(file, kind, v);
    if (d.kind === "err") return d;
    out.push(d.value);
  }
  return ok({ value: out, raw: p.value });
}

const envelope: Decoder<{ readonly payload: string; readonly payloadType: string; readonly signatures: readonly { readonly keyid?: string; readonly sig: string }[] }> = object({
  payload: string,
  payloadType: string,
  signatures: array(object({ sig: string }, { keyid: string })),
});

const PHASE = (f: BundleFinding): number => FINDING_KINDS.indexOf(f.kind);

function ordered(findings: readonly BundleFinding[]): readonly BundleFinding[] {
  return findings
    .map((f, i) => ({ f, i }))
    .sort((a, b) => PHASE(a.f) - PHASE(b.f) || (concernOf(a.f) < concernOf(b.f) ? -1 : concernOf(a.f) > concernOf(b.f) ? 1 : a.i - b.i))
    .map((x) => x.f);
}

/**
 * Verifies the whole bundle at the instant `at` with the trust the verifier gives; every fault is a finding, in the order of `FINDING_KINDS` and then of what it concerns. Pure: no file, network or clock.
 *
 * @example
 * ```ts
 * // const report = await verifyBundle(contents, { policy, signer, keys }, "2026-06-01T00:00:00Z"); // report.findings
 * ```
 */
export async function verifyBundle(contents: BundleContents, trust: Trust, at: string): Promise<BundleReport> {
  const findings: BundleFinding[] = [];
  const canonicalOf = (file: BundleFile, text: string | undefined, raw: unknown): void => {
    if (text !== undefined && text !== canonicalize(raw)) findings.push({ kind: "not-canonical", file });
  };

  const manifest = readOne("manifest.json", contents.manifest, evidenceManifest);
  if (manifest.kind === "err") findings.push(manifest.error);
  else canonicalOf("manifest.json", contents.manifest, manifest.value.raw);

  const listed: EvidenceManifest["items"] = manifest.kind === "ok" ? manifest.value.value.items : [];
  const actual = new Map<string, string>();
  for (const [name, bytes] of contents.items) actual.set(name, await sha256(bytes));
  const want = new Map(listed.map((i) => [i.digest, i]));
  for (const item of [...listed].sort((a, b) => (a.digest < b.digest ? -1 : 1))) {
    const bytes = contents.items.get(item.digest);
    if (bytes === undefined) {
      findings.push({ kind: "item-missing", digest: item.digest });
      continue;
    }
    const hash = actual.get(item.digest) ?? "";
    if (hash !== item.digest) findings.push({ kind: "item-hash-mismatch", digest: item.digest, actual: hash });
    if (bytes.length !== item.size) findings.push({ kind: "item-size-mismatch", digest: item.digest, expected: item.size, actual: bytes.length });
  }
  if (manifest.kind === "ok") for (const name of contents.items.keys()) if (!want.has(name)) findings.push({ kind: "item-extra", digest: name });

  const ledger = readMany("ledger.json", contents.ledger, ledgerEntry);
  let entries = 0;
  if (ledger.kind === "err") findings.push(ledger.error);
  else {
    canonicalOf("ledger.json", contents.ledger, ledger.value.raw);
    entries = ledger.value.value.length;
    const head = manifest.kind === "ok" ? manifest.value.value.ledgerHead : undefined;
    const v = await verifyLedger(ledger.value.value, head);
    if (v.kind === "err") findings.push({ kind: "chain-broken", seq: v.error.seq, reason: v.error.reason });
  }

  const kept = readMany("evidence.json", contents.evidence, evidence);
  if (kept.kind === "err") findings.push(kept.error);
  else {
    canonicalOf("evidence.json", contents.evidence, kept.value.raw);
    for (const e of kept.value.value) if (!retained(e, trust.policy, at)) findings.push({ kind: "evidence-expired", digest: e.digest });
  }

  findings.push(...(await signatureFindings(contents.signature, manifest.kind === "ok" ? manifest.value.raw : undefined, trust)));
  return { at, items: listed.length, entries, findings: ordered(findings) };
}

async function signatureFindings(text: string | undefined, manifestRaw: unknown, trust: Trust): Promise<readonly BundleFinding[]> {
  if (text === undefined) return [{ kind: "signature-absent" }];
  const p = parse("signature.json", text);
  if (p.kind === "err") return [p.error];
  const e = envelope(p.value);
  if (e.kind === "err") return [{ kind: "document-invalid", file: "signature.json", message: `${e.error.path}: expected ${e.error.expected}, found ${e.error.found}` }];
  if (e.value.signatures.length === 0) return [{ kind: "signature-absent" }];
  const out: BundleFinding[] = [];
  if (!signerAllowed(trust.policy, trust.signer)) {
    out.push({ kind: "signer-unallowed", keyid: undefined, why: "custody", detail: `the policy needs custody of ${trust.policy.custody}, and the signer ${trust.signer.id} has ${trust.signer.custody}` });
  }
  const expected = manifestRaw === undefined ? undefined : new TextEncoder().encode(canonicalize(manifestRaw));
  for (const sig of e.value.signatures) {
    const keyid = sig.keyid;
    const trusted = keyid === undefined ? undefined : trust.keys.find((k) => k.keyid === keyid);
    if (trusted === undefined) {
      out.push({ kind: "signer-unallowed", keyid, why: "unknown-key", detail: "the verifier does not trust this key" });
      continue;
    }
    if (!trust.policy.attesters.includes(trusted.role)) {
      out.push({ kind: "signer-unallowed", keyid, why: "role", detail: `the role ${trusted.role} may not attest: ${trust.policy.attesters.join(", ") || "no role"} may` });
      continue;
    }
    const v = await trust.signer.verify({ payloadType: e.value.payloadType, payload: e.value.payload, signatures: [sig] }, MANIFEST_PAYLOAD_TYPE, [trusted.key]);
    if (v.kind === "err") {
      out.push({ kind: "signature-bad", keyid, reason: v.error.message });
      continue;
    }
    if (expected !== undefined && !sameBytes(v.value, expected)) out.push({ kind: "signature-bad", keyid, reason: "the signed payload is not the manifest" });
  }
  return out;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/**
 * Whether a report has no finding.
 *
 * @example
 * ```ts
 * // bundleOk(report); // true where there is no finding
 * ```
 */
export function bundleOk(report: BundleReport): boolean {
  return report.findings.length === 0;
}

/**
 * The canonical bytes the signature of a manifest covers (the same function the signer of a bundle uses).
 *
 * @example
 * ```ts
 * // signedBytes(manifest); // the canonical bytes a signature covers
 * ```
 */
export function signedBytes(manifest: EvidenceManifest): Uint8Array {
  return manifestBytes(manifest);
}
