// Spec: 0001-grc-engineering FR-006
/**
 * Evidence: JSON's canonical form and the digest it gives, a hash-chained ledger, a manifest of files and a deterministic bundle (commons
 * 0001-grc-engineering FR-006 to FR-009). The kernel holds no key: a manifest's signature is made and checked by functions the caller gives.
 *
 * - `canonicalize` writes RFC 8785's JSON Canonicalization Scheme: object members sorted by the UTF-16 code units of their names, numbers
 *   as ECMAScript writes them, strings with JSON's minimal escapes, no white space; `evidenceDigest` is the SHA-256 of its UTF-8 (FR-006).
 * - A ledger is append-only and hash-chained: entry `seq` (from 1) holds the digest of the entry before (64 zeros for the first), its time,
 *   kind, subject and evidence digest, and its own `digest`, the SHA-256 of the canonical form of the rest. It is written as JSON lines,
 *   and `verifyLedger` names the first entry that was changed, removed, inserted or reordered (FR-007). Removing the last entries leaves a
 *   valid chain, so a signature covers a head (`LedgerHead`) that `verifyLedger` is then given.
 * - A manifest lists files by path, size and SHA-256 in the byte order of their paths; `verifyManifest` names each file missing, extra or
 *   different, and `verifyManifestSignature` checks its bytes with a `VerifySignature` the caller gives (FR-008).
 * - A bundle is a gzip of a ustar archive whose first entry is the manifest (then its signature, if any), the same bytes every time for the
 *   same files; `readBundle` gives the files back only where the manifest (and the signature, if a verifier is given) holds (FR-009).
 *
 * @example
 * ```ts
 * import { canonicalize, evidenceDigest } from "./evidence.ts";
 * canonicalize({ b: 1, a: 2.0 }); // { kind: "ok", value: '{"a":2,"b":1}' }
 * await evidenceDigest({ a: 2, b: 1 }); // the same digest as for { b: 1, a: 2.0 }
 * ```
 *
 * @module
 */
import {
  absurd,
  type Decoder,
  type DecodeError,
  array,
  formatDecodeError,
  integer,
  object,
  refine,
  string,
  err,
  ok,
  type Result,
} from "@intellectual-frontiers/core";
import {
  type ArchiveError,
  type Files,
  concat,
  filesOf,
  gunzip,
  gzip,
  isSafePath,
  sortedPaths,
  tar,
  tarHeader,
  untar,
} from "@intellectual-frontiers/formats/archive";
import { type Instant, type SubjectRef, instantDecoder } from "./grc.ts";
import { type Sha256, sha256, sha256Of } from "@intellectual-frontiers/crypto/sha256";

// ---------------------------------------------------------------------------------------------------------------------------- JCS (FR-006)

/** Why a value has no canonical JSON form: where it is (`$.a[2]`) and what it is. */
export type CanonicalError = { readonly kind: "canonical"; readonly path: string; readonly reason: string };

function memberPath(path: string, key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
}

function isPlainObject(v: object): boolean {
  const proto: unknown = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function canonicalText(value: unknown, path: string, parents: Set<object>, out: string[]): CanonicalError | undefined {
  const fail = (reason: string): CanonicalError => ({ kind: "canonical", path, reason });
  if (value === null) out.push("null");
  else if (typeof value === "boolean") out.push(value ? "true" : "false");
  else if (typeof value === "number") {
    if (!Number.isFinite(value)) return fail(`${String(value)} is not a JSON number`);
    out.push(JSON.stringify(value));
  } else if (typeof value === "string") {
    if (!value.isWellFormed()) return fail("the string holds a lone surrogate");
    out.push(JSON.stringify(value));
  } else if (typeof value === "object") {
    if (parents.has(value)) return fail("the value refers to itself");
    parents.add(value);
    if (Array.isArray(value)) {
      out.push("[");
      for (let i = 0; i < value.length; i++) {
        if (i > 0) out.push(",");
        const item: unknown = value[i];
        if (item === undefined) return { kind: "canonical", path: `${path}[${i}]`, reason: "an array holds nothing here" };
        const e = canonicalText(item, `${path}[${i}]`, parents, out);
        if (e !== undefined) return e;
      }
      out.push("]");
    } else {
      if (!isPlainObject(value)) return fail("only plain objects are JSON objects");
      const keys = Object.keys(value).sort();
      out.push("{");
      let first = true;
      for (const key of keys) {
        const member: unknown = Reflect.get(value, key);
        if (member === undefined) continue;
        if (!key.isWellFormed()) return fail(`the member name ${JSON.stringify(key)} holds a lone surrogate`);
        out.push(first ? "" : ",", JSON.stringify(key), ":");
        first = false;
        const e = canonicalText(member, memberPath(path, key), parents, out);
        if (e !== undefined) return e;
      }
      out.push("}");
    }
    parents.delete(value);
  } else return fail(`a ${typeof value} is not JSON`);
  return undefined;
}

/**
 * A value's canonical JSON text (RFC 8785): plain objects, arrays, strings, finite numbers, booleans and `null`. An object member whose
 * value is `undefined` is left out, as `JSON.stringify` leaves it; anything else that is not JSON (a non-finite number, a lone surrogate,
 * a `Date`, a class instance, a cycle, a hole) is an error naming where it is.
 */
export function canonicalize(value: unknown): Result<string, CanonicalError> {
  const out: string[] = [];
  const e = canonicalText(value, "$", new Set(), out);
  return e === undefined ? ok(out.join("")) : err(e);
}

/** A value's canonical JSON as UTF-8 bytes. */
export function canonicalBytes(value: unknown): Result<Uint8Array, CanonicalError> {
  const r = canonicalize(value);
  return r.kind === "ok" ? ok(new TextEncoder().encode(r.value)) : r;
}

/** The address of a piece of evidence: the SHA-256 of its canonical JSON, the same on every runtime. */
export async function evidenceDigest(value: unknown): Promise<Result<Sha256, CanonicalError>> {
  const r = canonicalize(value);
  return r.kind === "ok" ? ok(await sha256(r.value)) : r;
}

// ---------------------------------------------------------------------------------------------------------------------------- ledger (FR-007)

/** The digest the first entry of a ledger names as the one before it: 64 zeros. */
export const GENESIS: Sha256 = "0".repeat(64) as Sha256; // 64 hexadecimal digits by construction

/** What is appended to a ledger: when, what kind of record (`observation`, `assessment`), about what, and the digest of the evidence. */
export type LedgerRecord = { readonly at: Instant; readonly kind: string; readonly subject: SubjectRef; readonly evidence: Sha256 };

/** One entry of a ledger: a record with its place, the digest of the entry before it and its own digest. */
export type LedgerEntry = LedgerRecord & { readonly seq: number; readonly prev: Sha256; readonly digest: Sha256 };

/** The last entry a ledger is known to have reached (what a signature covers): `{ seq: 0, digest: GENESIS }` for an empty one. */
export type LedgerHead = { readonly seq: number; readonly digest: Sha256 };

/** The digest an entry must carry: the SHA-256 of the canonical JSON of every field but `digest`. */
export async function entryDigest(e: Omit<LedgerEntry, "digest">): Promise<Result<Sha256, CanonicalError>> {
  return evidenceDigest({
    seq: e.seq,
    prev: e.prev,
    at: e.at,
    kind: e.kind,
    subject: { kind: e.subject.kind, id: e.subject.id },
    evidence: e.evidence,
  });
}

/** The head of a ledger: its last entry's place and digest. */
export function ledgerHead(entries: readonly LedgerEntry[]): LedgerHead {
  const last = entries.at(-1);
  return last === undefined ? { seq: 0, digest: GENESIS } : { seq: last.seq, digest: last.digest };
}

/** The ledger with one record appended; an error where the record has no canonical form (a lone surrogate in its kind or subject). */
export async function appendEntry(
  entries: readonly LedgerEntry[],
  record: LedgerRecord,
): Promise<Result<readonly LedgerEntry[], CanonicalError>> {
  const head = ledgerHead(entries);
  const body = {
    seq: head.seq + 1,
    prev: head.digest,
    at: record.at,
    kind: record.kind,
    subject: record.subject,
    evidence: record.evidence,
  };
  const d = await entryDigest(body);
  return d.kind === "ok" ? ok([...entries, { ...body, digest: d.value }]) : d;
}

/** A ledger as JSON lines: each entry's canonical JSON and a line feed. */
export function ledgerLines(entries: readonly LedgerEntry[]): string {
  return entries
    .map((e) => {
      const r = canonicalize(e);
      return `${r.kind === "ok" ? r.value : JSON.stringify(e)}\n`;
    })
    .join("");
}

const sha256Decoder: Decoder<Sha256> = (input, path = "$") => {
  const s = typeof input === "string" && /^[0-9a-f]{64}$/.test(input) ? sha256Of(input) : undefined;
  return s === undefined
    ? err({ kind: "decode", path, expected: "a SHA-256 (64 lower-case hexadecimal digits)", found: typeof input })
    : ok(s);
};

/** A ledger entry as its JSON holds it. */
export const ledgerEntryDecoder: Decoder<LedgerEntry> = object({
  seq: refine(integer, "positive", (n) => n >= 1),
  prev: sha256Decoder,
  at: instantDecoder,
  kind: string,
  subject: object({ kind: string, id: string }),
  evidence: sha256Decoder,
  digest: sha256Decoder,
});

/** Why the text of a ledger could not be read: the line (from 1) and what is wrong there. */
export type LedgerParseError = { readonly kind: "ledger-line"; readonly line: number; readonly error: DecodeError };

/** A ledger parse error as one sentence. */
export function formatLedgerParseError(e: LedgerParseError): string {
  return `line ${e.line}: ${formatDecodeError(e.error)}`;
}

/** A ledger from its JSON lines (blank lines skipped), each decoded; the chain is checked by `verifyLedger`. */
export function parseLedger(text: string): Result<readonly LedgerEntry[], LedgerParseError> {
  const entries: LedgerEntry[] = [];
  const lines = text.split("\n");
  for (const [i, raw] of lines.entries()) {
    const line = raw.replace(/\r$/, "");
    if (line.trim() === "") continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch (e) {
      return err({
        kind: "ledger-line",
        line: i + 1,
        error: { kind: "decode", path: "$", expected: "JSON", found: e instanceof Error ? e.message : String(e) },
      });
    }
    const r = ledgerEntryDecoder(value);
    if (r.kind === "err") return err({ kind: "ledger-line", line: i + 1, error: r.error });
    entries.push(r.value);
  }
  return ok(entries);
}

/** The kind of tampering a broken ledger shows. */
export type Tampering = "changed" | "removed" | "inserted" | "reordered";

/** Where a ledger breaks: the place (from 1) of the first entry that was changed, removed, inserted or reordered, and why that is said. */
export type LedgerBreak = { readonly kind: Tampering; readonly seq: number; readonly reason: string };

/** A ledger break as one sentence. */
export function formatLedgerBreak(b: LedgerBreak): string {
  return `entry ${b.seq} was ${b.kind}: ${b.reason}`;
}

/**
 * The ledger's head where every entry's digest is the digest of its content, its `seq` its place and its `prev` the digest of the entry
 * before it (and, where a `head` is given, the ledger reaches it with that digest); else the first break. Entry N edited in place is
 * `changed` at N (edited and re-hashed, it is found at N + 1's link and still named N); entry N gone is `removed` at N; a forged entry
 * slipped in at N is `inserted` at N; two entries swapped are `reordered` at the first of them.
 */
export async function verifyLedger(entries: readonly LedgerEntry[], head?: LedgerHead): Promise<Result<LedgerHead, LedgerBreak>> {
  const brk = (kind: Tampering, seq: number, reason: string): Result<never, LedgerBreak> => err({ kind, seq, reason });
  for (const [i, e] of entries.entries()) {
    const place = i + 1;
    const d = await entryDigest(e);
    if (d.kind === "err" || d.value !== e.digest) return brk("changed", place, "its digest is not the SHA-256 of its content");
    if (e.seq > place) {
      return entries.slice(i + 1).some((x) => x.seq === place)
        ? brk("reordered", place, `entry ${e.seq} stands where entry ${place} should`)
        : brk("removed", place, e.seq === place + 1 ? `entry ${place} is missing` : `entries ${place} to ${e.seq - 1} are missing`);
    }
    if (e.seq < place) {
      const beforePrevious = i >= 2 ? entries[i - 2]?.digest : GENESIS;
      return e.prev === beforePrevious
        ? brk("inserted", Math.max(place - 1, 1), `it is not in the chain: entry ${place} links past it`)
        : brk("inserted", place, `it repeats the place ${e.seq}`);
    }
    const previous = i === 0 ? GENESIS : (entries[i - 1]?.digest ?? GENESIS);
    if (e.prev !== previous)
      return i === 0
        ? brk("changed", 1, "it does not begin the chain")
        : brk("changed", place - 1, `entry ${place} names another digest for it`);
  }
  if (head !== undefined) {
    if (entries.length < head.seq) return brk("removed", entries.length + 1, `the ledger ends before its head, entry ${head.seq}`);
    const at = head.seq === 0 ? GENESIS : entries[head.seq - 1]?.digest;
    if (at !== head.digest) return brk("changed", Math.max(head.seq, 1), "its digest is not the head's");
  }
  return ok(ledgerHead(entries));
}

// ---------------------------------------------------------------------------------------------------------------------------- manifest (FR-008)

/** One file of a manifest. */
export type ManifestEntry = { readonly path: string; readonly size: number; readonly sha256: Sha256 };

/** Files by path, size and SHA-256, in the byte order of their UTF-8 paths. */
export type Manifest = { readonly files: readonly ManifestEntry[] };

/** The manifest of some files. */
export async function manifestOf(files: Files): Promise<Manifest> {
  const out: ManifestEntry[] = [];
  for (const path of sortedPaths(files.keys())) {
    const data = files.get(path) ?? new Uint8Array();
    out.push({ path, size: data.length, sha256: await sha256(data) });
  }
  return { files: out };
}

/** A manifest's bytes: its canonical JSON (RFC 8785) and a line feed. These are the bytes a signature covers. */
export function manifestBytes(m: Manifest): Uint8Array {
  const r = canonicalize({ files: m.files.map((f) => ({ path: f.path, size: f.size, sha256: f.sha256 })) });
  // A manifest's strings are paths and digests; a path with a lone surrogate is written as UTF-8 would replace it.
  return new TextEncoder().encode(`${r.kind === "ok" ? r.value : JSON.stringify(m)}\n`);
}

/** Why a manifest could not be read. */
export type ManifestError =
  | { readonly kind: "manifest-decode"; readonly error: DecodeError }
  | { readonly kind: "manifest-order"; readonly path: string }
  | { readonly kind: "manifest-unsafe-path"; readonly path: string };

/** A manifest error as one sentence. */
export function formatManifestError(e: ManifestError): string {
  switch (e.kind) {
    case "manifest-decode":
      return `the manifest does not decode: ${formatDecodeError(e.error)}`;
    case "manifest-order":
      return `the manifest lists ${JSON.stringify(e.path)} out of byte order or twice`;
    case "manifest-unsafe-path":
      return `the manifest lists a path that would leave its folder: ${JSON.stringify(e.path)}`;
    default:
      return absurd(e);
  }
}

const manifestDecoder: Decoder<Manifest> = object({
  files: array(object({ path: string, size: refine(integer, "size", (n) => n >= 0), sha256: sha256Decoder })),
});

/** A manifest from its bytes (or text), each path checked safe and the list checked in strict byte order. */
export function parseManifest(input: Uint8Array | string): Result<Manifest, ManifestError> {
  const text = typeof input === "string" ? input : new TextDecoder().decode(input);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (e) {
    return err({
      kind: "manifest-decode",
      error: { kind: "decode", path: "$", expected: "JSON", found: e instanceof Error ? e.message : String(e) },
    });
  }
  const r = manifestDecoder(value);
  if (r.kind === "err") return err({ kind: "manifest-decode", error: r.error });
  const paths = r.value.files.map((f) => f.path);
  const sorted = sortedPaths(paths);
  for (const [i, p] of paths.entries()) {
    if (!isSafePath(p)) return err({ kind: "manifest-unsafe-path", path: p });
    if (sorted[i] !== p || (i > 0 && paths[i - 1] === p)) return err({ kind: "manifest-order", path: p });
  }
  return r;
}

/** One way files differ from their manifest. */
export type ManifestMismatch =
  | { readonly kind: "missing"; readonly path: string }
  | { readonly kind: "extra"; readonly path: string }
  | {
      readonly kind: "different";
      readonly path: string;
      readonly expected: { readonly size: number; readonly sha256: Sha256 };
      readonly actual: { readonly size: number; readonly sha256: Sha256 };
    };

/** A mismatch as one sentence. */
export function formatManifestMismatch(m: ManifestMismatch): string {
  switch (m.kind) {
    case "missing":
      return `${m.path} is in the manifest but not among the files`;
    case "extra":
      return `${m.path} is among the files but not in the manifest`;
    case "different":
      return `${m.path} is not the file the manifest lists (${m.actual.size} bytes, ${m.actual.sha256})`;
    default:
      return absurd(m);
  }
}

/** Whether files are exactly what the manifest lists; else every file missing, extra or different, in the byte order of their paths. */
export async function verifyManifest(m: Manifest, files: Files): Promise<Result<Manifest, readonly ManifestMismatch[]>> {
  const listed = new Map(m.files.map((f) => [f.path, f]));
  const out: ManifestMismatch[] = [];
  for (const path of sortedPaths(new Set([...listed.keys(), ...files.keys()]))) {
    const want = listed.get(path);
    const data = files.get(path);
    if (want === undefined) out.push({ kind: "extra", path });
    else if (data === undefined) out.push({ kind: "missing", path });
    else {
      const sum = await sha256(data);
      if (sum !== want.sha256 || data.length !== want.size)
        out.push({
          kind: "different",
          path,
          expected: { size: want.size, sha256: want.sha256 },
          actual: { size: data.length, sha256: sum },
        });
    }
  }
  return out.length === 0 ? ok(m) : err(out);
}

/** A check of a signature over a message, with a key the caller holds (an in-toto/DSSE verifier, `ssh-keygen -Y verify`, ...). */
export type VerifySignature = (message: Uint8Array, signature: Uint8Array) => boolean | Promise<boolean>;

/** A signer of a message, with a key the caller holds. */
export type Sign = (message: Uint8Array) => Uint8Array | Promise<Uint8Array>;

/** Why a signed manifest is refused. */
export type SignatureError = { readonly kind: "unsigned" } | { readonly kind: "bad-signature"; readonly reason: string } | ManifestError;

/** The manifest its bytes hold, where the signature over those exact bytes verifies; a verifier that throws is a bad signature. */
export async function verifyManifestSignature(
  bytes: Uint8Array,
  signature: Uint8Array,
  verify: VerifySignature,
): Promise<Result<Manifest, SignatureError>> {
  let good: boolean;
  try {
    good = await verify(bytes, signature);
  } catch (e) {
    return err({ kind: "bad-signature", reason: e instanceof Error ? e.message : String(e) });
  }
  if (!good) return err({ kind: "bad-signature", reason: "the signature does not verify" });
  return parseManifest(bytes);
}

// ---------------------------------------------------------------------------------------------------------------------------- bundle (FR-009)

/** The path of a bundle's manifest, its first entry. */
export const BUNDLE_MANIFEST = "MANIFEST.json";

/** The path of a bundle manifest's signature, its second entry where there is one. */
export const BUNDLE_SIGNATURE = "MANIFEST.json.sig";

/** What a bundle read back holds: its manifest, its files (the manifest and signature left out), and whether its signature verified. */
export type Bundle = {
  readonly manifest: Manifest;
  readonly files: Files;
  readonly signature:
    { readonly kind: "none" } | { readonly kind: "verified" } | { readonly kind: "unverified"; readonly bytes: Uint8Array };
};

/** Why a bundle could not be written or read. */
export type BundleError =
  | { readonly kind: "archive"; readonly error: ArchiveError }
  | { readonly kind: "reserved-path"; readonly path: string }
  | { readonly kind: "no-manifest" }
  | { readonly kind: "mismatch"; readonly mismatches: readonly ManifestMismatch[] }
  | SignatureError;

/** A bundle error as one sentence. */
export function formatBundleError(e: BundleError): string {
  switch (e.kind) {
    case "archive":
      return `the bundle's archive: ${e.error.kind}`;
    case "reserved-path":
      return `${e.path} is the bundle's own and cannot be one of its files`;
    case "no-manifest":
      return `the bundle does not begin with ${BUNDLE_MANIFEST}`;
    case "mismatch":
      return `the bundle's files are not its manifest's: ${e.mismatches.map(formatManifestMismatch).join("; ")}`;
    case "unsigned":
      return "the bundle has no signature";
    case "bad-signature":
      return `the bundle's signature: ${e.reason}`;
    case "manifest-decode":
    case "manifest-order":
    case "manifest-unsafe-path":
      return formatManifestError(e);
    default:
      return absurd(e);
  }
}

function tarEntry(path: string, data: Uint8Array): Result<Uint8Array, BundleError> {
  const h = tarHeader(path, data.length, false);
  if (h === undefined) return err({ kind: "archive", error: { kind: "too-long", path } });
  return ok(concat([h, data, new Uint8Array((512 - (data.length % 512)) % 512)]));
}

/**
 * A bundle of files: a gzip of a ustar archive whose first entry is the manifest, then its signature where a signer is given, then the
 * files (their folders first) in byte order, every time and date fixed, so the same files (and a deterministic signer) give the same bytes.
 */
export async function writeBundle(files: Files, options: { readonly sign?: Sign } = {}): Promise<Result<Uint8Array, BundleError>> {
  for (const reserved of [BUNDLE_MANIFEST, BUNDLE_SIGNATURE])
    if (files.has(reserved)) return err({ kind: "reserved-path", path: reserved });
  const manifest = manifestBytes(await manifestOf(files));
  const head = tarEntry(BUNDLE_MANIFEST, manifest);
  if (head.kind === "err") return head;
  const parts = [head.value];
  if (options.sign !== undefined) {
    const sig = tarEntry(BUNDLE_SIGNATURE, await options.sign(manifest));
    if (sig.kind === "err") return sig;
    parts.push(sig.value);
  }
  const rest = tar(files);
  if (rest.kind === "err") return err({ kind: "archive", error: rest.error });
  parts.push(rest.value);
  return ok(gzip(concat(parts)));
}

/**
 * A bundle's files, where its first entry is a manifest the files match exactly (one added, removed or changed is named); with `verify`,
 * also where its signature verifies over the manifest's bytes (a bundle with none is then refused as unsigned).
 */
export async function readBundle(
  data: Uint8Array,
  options: { readonly verify?: VerifySignature } = {},
): Promise<Result<Bundle, BundleError>> {
  const unzipped = await gunzip(data);
  if (unzipped.kind === "err") return err({ kind: "archive", error: unzipped.error });
  const entries = untar(unzipped.value);
  if (entries.kind === "err") return err({ kind: "archive", error: entries.error });
  const first = entries.value[0];
  if (first === undefined || first.kind !== "file" || first.path !== BUNDLE_MANIFEST) return err({ kind: "no-manifest" });
  const all = filesOf(entries.value);
  const signature = all.get(BUNDLE_SIGNATURE);
  let manifest: Result<Manifest, SignatureError>;
  if (options.verify !== undefined) {
    if (signature === undefined) return err({ kind: "unsigned" });
    manifest = await verifyManifestSignature(first.data, signature, options.verify);
  } else manifest = parseManifest(first.data);
  if (manifest.kind === "err") return manifest;
  const files = new Map([...all].filter(([p]) => p !== BUNDLE_MANIFEST && p !== BUNDLE_SIGNATURE));
  const checked = await verifyManifest(manifest.value, files);
  if (checked.kind === "err") return err({ kind: "mismatch", mismatches: checked.error });
  return ok({
    manifest: manifest.value,
    files,
    signature:
      signature === undefined
        ? { kind: "none" }
        : options.verify !== undefined
          ? { kind: "verified" }
          : { kind: "unverified", bytes: signature },
  });
}
