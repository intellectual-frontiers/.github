// Spec: 0001-quality-evidence FR-064
/**
 * The offline verifier of an assessor pack (commons 0001-quality-evidence FR-064 to FR-066): small, typed TypeScript with no import and no dependency,
 * run on Bun and on Node 26 with no network and no account, and shipped inside the pack (`verify/verify-pack.ts`) so that the pack checks
 * itself. It is given the pack's files (path to bytes) and checks, in this order, and names the first thing that fails:
 *
 * 1. `manifest`: the manifest reads and is a pack's manifest.
 * 2. `files`: every file the manifest lists is in the pack with the SHA-256 and size it says, and the pack holds no file the manifest does not list.
 * 3. `evidence-chain`: each evidence file names, as `ifc.quality.previous.sha256`, the digest of the file before it, from the manifest's anchor to the head it names.
 * 4. `ledger-chain`: the records of the ledger are numbered from 1 and each names the digest of the one before it.
 * 5. `notes`: each note names a file the pack holds, with the SHA-256 the note says.
 * 6. `signature:<file>`: each signed envelope verifies against the keys in the pack (an allowed-signers file of `ssh-ed25519` keys), and its statement names files the
 *    pack holds, with their digests; every file the pack carries is named by one.
 * 7. `figures`: the figures of the manifest's summary equal the figures computed from the files.
 *
 * A part that cannot be checked (a file the manifest lists and the pack lacks, a key the pack does not hold, no signature at all) is `not_run`
 * with its reason, and a pack with any check not `pass` is not reported verified.
 *
 * @remarks
 * This file imports nothing, on purpose: it is copied into every pack byte for byte. It uses `crypto.subtle` (SHA-256 and Ed25519), `atob`,
 * `TextEncoder` and `JSON`, which Bun and Node 26 both have. `figuresOf` is also what the generator uses for the figures of the page and of the
 * pack's summary, so that the two cannot be computed two ways.
 *
 * @example
 * ```ts
 * import { verifyPack } from "./verify-pack.ts";
 * // const report = await verifyPack(new Map([["manifest.json", bytes]]));
 * // report.verified; report.first?.detail
 * ```
 *
 * @module
 */

/** The files of a pack: path with `/` to bytes. */
export type PackFiles = ReadonlyMap<string, Uint8Array>;

/** What one check found. */
export type PackCheck = {
  readonly name: string;
  readonly status: "pass" | "fail" | "not_run";
  readonly detail: string;
  /** The file it is about, where it is about one. */
  readonly file?: string;
};

/** The verification of a pack. */
export type PackReport = {
  /** Whether every check passed. */
  readonly verified: boolean;
  readonly checks: readonly PackCheck[];
  /** The first check that failed, else the first that could not be run; none where all passed. */
  readonly first?: PackCheck;
};

/** The figures of a pack, computed from its files and stated in its manifest's summary (0001-quality-evidence FR-062, FR-064). */
export type Figures = {
  readonly evidenceFiles: number;
  readonly cases: number;
  readonly passed: number;
  readonly failed: number;
  readonly notRun: number;
  readonly otherCases: number;
  readonly ledgerRecords: number;
  readonly nonconformancesOpen: number;
  readonly nonconformancesClosed: number;
  readonly capasOpen: number;
  readonly capasClosed: number;
};

/** The digest of 64 zeros: what the first file of a chain names as its predecessor. */
export const GENESIS_DIGEST = "0".repeat(64);

/** The attribute that chains the evidence files. */
export const PREVIOUS_ATTRIBUTE = "ifc.quality.previous.sha256";

const EVIDENCE = /^quality\/evidence\/\d{4}\/\d{2}\/\d{2}\/([0-9a-f]{32})\.otlp\.json$/;
const RECORD = /^quality\/records\/(\d{6})-([a-z-]+)\.json$/;
const utf8 = new TextEncoder();
const text = (b: Uint8Array): string => new TextDecoder().decode(b);

/** The SHA-256 of bytes as lower-case hexadecimal. */
export async function digestOf(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function parse(bytes: Uint8Array | undefined): unknown {
  if (bytes === undefined) return undefined;
  try {
    return JSON.parse(text(bytes));
  } catch {
    return undefined;
  }
}

function field(v: unknown, key: string): unknown {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? Object.entries(v).find(([k]) => k === key)?.[1] : undefined;
}

const list = (v: unknown): readonly unknown[] => (Array.isArray(v) ? (v as readonly unknown[]) : []);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The value of a string attribute among an OTLP attribute list. */
function attribute(attributes: unknown, key: string): string | undefined {
  for (const a of list(attributes)) if (field(a, "key") === key) return str(field(field(a, "value"), "stringValue"));
  return undefined;
}

/** What an evidence file says of itself: its predecessor, the trace id of its spans and the outcome of each case. */
export type PackEvidenceFacts = {
  readonly previous: string | undefined;
  readonly traceId: string | undefined;
  readonly outcomes: readonly string[];
  readonly readable: boolean;
};

/** Reads an evidence file (an OTLP/JSON document of 0001-quality-evidence FR-018) for what the verifier needs of it. */
export function evidenceFacts(bytes: Uint8Array | undefined): PackEvidenceFacts {
  const doc = parse(bytes);
  if (doc === undefined) return { previous: undefined, traceId: undefined, outcomes: [], readable: false };
  let previous: string | undefined;
  let traceId: string | undefined;
  const outcomes: string[] = [];
  for (const rs of list(field(doc, "resourceSpans"))) {
    previous ??= attribute(field(field(rs, "resource"), "attributes"), PREVIOUS_ATTRIBUTE);
    for (const ss of list(field(rs, "scopeSpans"))) for (const s of list(field(ss, "spans"))) traceId ??= str(field(s, "traceId"));
  }
  for (const rl of list(field(doc, "resourceLogs"))) {
    previous ??= attribute(field(field(rl, "resource"), "attributes"), PREVIOUS_ATTRIBUTE);
    for (const sl of list(field(rl, "scopeLogs")))
      for (const r of list(field(sl, "logRecords"))) {
        if (field(r, "eventName") !== "ifc.test.case") continue;
        outcomes.push(attribute(field(r, "attributes"), "ifc.test.outcome") ?? "unknown");
      }
  }
  return { previous, traceId, outcomes, readable: true };
}

/** The events of the ledger's files, by kind and identifier (`id` of the event, or the nonconformance or CAPA it names). */
function ledgerEvents(files: PackFiles): readonly { readonly path: string; readonly event: unknown }[] {
  return [...files.keys()]
    .filter((p) => RECORD.test(p))
    .sort(byText)
    .map((path) => ({ path, event: field(parse(files.get(path)), "event") }));
}

/**
 * The figures of a pack computed from its files: the cases of the evidence files by outcome, and the nonconformances and CAPA the ledger's
 * records open and close. The same function is what the generator states, so that a figure of the page equals the same figure of the pack.
 */
export function figuresOf(files: PackFiles): Figures {
  const evidence = [...files.keys()].filter((p) => EVIDENCE.test(p));
  let cases = 0;
  let passed = 0;
  let failed = 0;
  let notRun = 0;
  for (const p of evidence) {
    for (const o of evidenceFacts(files.get(p)).outcomes) {
      cases += 1;
      if (o === "pass") passed += 1;
      else if (o === "fail") failed += 1;
      else if (o === "not_run") notRun += 1;
    }
  }
  const events = ledgerEvents(files);
  const idsOf = (kind: string): ReadonlySet<string> =>
    new Set(events.flatMap((e) => (field(e.event, "kind") === kind ? [str(field(e.event, "id")) ?? ""] : [])));
  const opened = idsOf("nonconformance-opened");
  const closed = idsOf("nonconformance-closed");
  const capasOpened = idsOf("capa-opened");
  const capasClosed = idsOf("capa-closed");
  return {
    evidenceFiles: evidence.length,
    cases,
    passed,
    failed,
    notRun,
    otherCases: cases - passed - failed - notRun,
    ledgerRecords: events.length,
    nonconformancesOpen: [...opened].filter((id) => !closed.has(id)).length,
    nonconformancesClosed: [...opened].filter((id) => closed.has(id)).length,
    capasOpen: [...capasOpened].filter((id) => !capasClosed.has(id)).length,
    capasClosed: [...capasOpened].filter((id) => capasClosed.has(id)).length,
  };
}

// ---------------------------------------------------------------------------------------------------------------------------- keys

/** A public key the pack trusts: the principal its allowed-signers line names and the raw Ed25519 key. */
export type TrustedKey = { readonly principal: string; readonly raw: Uint8Array };

function fromBase64(s: string): Uint8Array | undefined {
  try {
    const bin = atob(s);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return undefined;
  }
}

/** The `ssh-ed25519` keys of an allowed-signers file (`principal [options] ssh-ed25519 KEY [comment]`); other lines are skipped. */
export function parseAllowedSigners(content: string): readonly TrustedKey[] {
  const out: TrustedKey[] = [];
  for (const line of content.split("\n")) {
    const words = line.trim().split(/\s+/);
    const at = words.indexOf("ssh-ed25519");
    const blob = at > 0 ? fromBase64(words[at + 1] ?? "") : undefined;
    const principal = words[0];
    if (blob === undefined || principal === undefined || principal.startsWith("#")) continue;
    // the blob is: uint32 length, "ssh-ed25519", uint32 length, the 32 bytes of the key
    const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
    if (
      blob.length < 4 + 11 + 4 + 32 ||
      view.getUint32(0) !== 11 ||
      text(blob.subarray(4, 15)) !== "ssh-ed25519" ||
      view.getUint32(15) !== 32
    )
      continue;
    out.push({ principal, raw: blob.slice(19, 51) });
  }
  return out;
}

/** The text of an allowed-signers line for an Ed25519 key: what a harness publishes beside its pack. */
export function allowedSignersLine(principal: string, raw: Uint8Array): string {
  const u32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const blob = Uint8Array.from([...u32(11), ...utf8.encode("ssh-ed25519"), ...u32(raw.length), ...raw]);
  return `${principal} ssh-ed25519 ${btoa(String.fromCharCode(...blob))}\n`;
}

/** The pre-authentication encoding of DSSE: what a signature of an envelope is over. */
export function pae(payloadType: string, payload: Uint8Array): Uint8Array {
  const head = utf8.encode(`DSSEv1 ${utf8.encode(payloadType).length} ${payloadType} ${payload.length} `);
  return Uint8Array.from([...head, ...payload]);
}

async function verifyWith(key: TrustedKey, message: Uint8Array, signature: Uint8Array): Promise<boolean> {
  try {
    const k = await crypto.subtle.importKey("raw", new Uint8Array(key.raw), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "Ed25519" }, k, new Uint8Array(signature), new Uint8Array(message));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------- the checks

const pass = (name: string, detail: string, file?: string): PackCheck => ({
  name,
  status: "pass",
  detail,
  ...(file === undefined ? {} : { file }),
});
const fail = (name: string, detail: string, file?: string): PackCheck => ({
  name,
  status: "fail",
  detail,
  ...(file === undefined ? {} : { file }),
});
const notRun = (name: string, detail: string, file?: string): PackCheck => ({
  name,
  status: "not_run",
  detail,
  ...(file === undefined ? {} : { file }),
});

type Entry = { readonly path: string; readonly sha256: string; readonly bytes: number };

function entriesOf(manifest: unknown): readonly Entry[] | undefined {
  const raw = field(manifest, "files");
  if (!Array.isArray(raw)) return undefined;
  const out: Entry[] = [];
  for (const e of raw as readonly unknown[]) {
    const path = str(field(e, "path"));
    const sha256 = str(field(e, "sha256"));
    const bytes = field(e, "bytes");
    if (path === undefined || sha256 === undefined || typeof bytes !== "number") return undefined;
    out.push({ path, sha256, bytes });
  }
  return out;
}

async function checkFiles(files: PackFiles, entries: readonly Entry[]): Promise<readonly PackCheck[]> {
  const out: PackCheck[] = [];
  const listed = new Set(entries.map((e) => e.path));
  const missing: string[] = [];
  for (const e of entries) {
    const b = files.get(e.path);
    if (b === undefined) {
      missing.push(e.path);
      continue;
    }
    const d = await digestOf(b);
    if (d !== e.sha256) return [fail("files", `${e.path} has the SHA-256 ${d}, and the manifest says ${e.sha256}`, e.path)];
    if (b.length !== e.bytes) return [fail("files", `${e.path} is ${b.length} bytes, and the manifest says ${e.bytes}`, e.path)];
  }
  const extra = [...files.keys()].filter((p) => p !== "manifest.json" && !listed.has(p)).sort(byText);
  if (extra.length > 0) return [fail("files", `${extra[0]} is in the pack and the manifest does not list it`, extra[0])];
  if (missing.length > 0)
    return [
      notRun(
        "files",
        `${missing.length} file${missing.length === 1 ? "" : "s"} the manifest lists ${missing.length === 1 ? "is" : "are"} not in the pack: ${missing.slice(0, 3).join(", ")}`,
        missing[0],
      ),
    ];
  out.push(pass("files", `${entries.length} files, each with the SHA-256 and size the manifest gives`));
  return out;
}

async function checkEvidenceChain(files: PackFiles, manifest: unknown): Promise<PackCheck> {
  const chain = field(manifest, "chain");
  const order = list(field(chain, "files")).filter((p): p is string => typeof p === "string");
  const anchor = str(field(chain, "anchor")) ?? GENESIS_DIGEST;
  const head = str(field(chain, "head"));
  let previous = anchor;
  for (const p of order) {
    const b = files.get(p);
    if (b === undefined) return notRun("evidence-chain", `${p} is not in the pack, so the chain cannot be walked past it`, p);
    const m = EVIDENCE.exec(p);
    const facts = evidenceFacts(b);
    if (m === null || !facts.readable) return fail("evidence-chain", `${p} is not an evidence file`, p);
    if (facts.traceId !== m[1])
      return fail("evidence-chain", `${p} is named for trace ${m[1] ?? ""} and holds trace ${facts.traceId ?? "none"}`, p);
    if (facts.previous === undefined) return fail("evidence-chain", `${p} does not carry ${PREVIOUS_ATTRIBUTE}`, p);
    if (facts.previous !== previous)
      return fail(
        "evidence-chain",
        `the chain breaks at ${p}: it names ${facts.previous} as the digest of the file before it, which is ${previous}`,
        p,
      );
    previous = await digestOf(b);
  }
  const held = [...files.keys()].filter((p) => EVIDENCE.test(p));
  const outside = held.filter((p) => !order.includes(p));
  if (outside.length > 0) return fail("evidence-chain", `${outside[0]} is evidence the chain of the manifest does not name`, outside[0]);
  if (head !== undefined && head !== previous)
    return fail("evidence-chain", `the chain ends at ${previous} and the manifest says it ends at ${head}`);
  return pass(
    "evidence-chain",
    `${order.length} evidence file${order.length === 1 ? "" : "s"} chained from ${anchor === GENESIS_DIGEST ? "64 zeros" : anchor} to ${previous}`,
  );
}

async function checkLedgerChain(files: PackFiles): Promise<PackCheck> {
  const paths = [...files.keys()].filter((p) => RECORD.test(p)).sort(byText);
  let previous = GENESIS_DIGEST;
  for (const [i, p] of paths.entries()) {
    const b = files.get(p);
    const m = RECORD.exec(p);
    const doc = parse(b);
    if (b === undefined || m === null || doc === undefined) return fail("ledger-chain", `${p} is not a record of the ledger`, p);
    if (Number(m[1]) !== i + 1 || field(doc, "seq") !== i + 1) return fail("ledger-chain", `${p} is not record number ${i + 1}`, p);
    if (str(field(field(doc, "event"), "kind")) !== m[2])
      return fail("ledger-chain", `${p} is named for ${m[2] ?? ""} and holds another kind of record`, p);
    if (field(doc, "previous") !== previous)
      return fail(
        "ledger-chain",
        `${p} names ${String(field(doc, "previous"))} as the digest of the file before it, which is ${previous}`,
        p,
      );
    previous = await digestOf(b);
  }
  return pass("ledger-chain", `${paths.length} record${paths.length === 1 ? "" : "s"} of the ledger, chained`);
}

async function checkNotes(files: PackFiles): Promise<PackCheck> {
  const notes = [...files.keys()].filter((p) => p.startsWith("notes/")).sort(byText);
  let stanzas = 0;
  for (const n of notes) {
    for (const stanza of text(files.get(n) ?? new Uint8Array()).split(/\n\s*\n/)) {
      if (stanza.trim() === "") continue;
      const fields = new Map(
        stanza
          .split("\n")
          .flatMap((l) => (l.indexOf(" ") > 0 ? [[l.slice(0, l.indexOf(" ")), l.slice(l.indexOf(" ") + 1).trim()] as const] : [])),
      );
      const path = fields.get("path") ?? "";
      const b = files.get(path);
      if (b === undefined) return fail("notes", `${n} names ${path}, which the pack does not hold`, n);
      if ((await digestOf(b)) !== fields.get("sha256")) return fail("notes", `${n} names ${path} with another SHA-256 than the file's`, n);
      stanzas += 1;
    }
  }
  return pass("notes", `${stanzas} note${stanzas === 1 ? "" : "s"}, each naming a file of the pack with its SHA-256`);
}

async function checkSignatures(files: PackFiles, entries: readonly Entry[]): Promise<readonly PackCheck[]> {
  const envelopes = [...files.keys()].filter((p) => p.startsWith("signatures/") && p.endsWith(".dsse.json")).sort(byText);
  if (envelopes.length === 0) return [notRun("signatures", "the pack holds no signed envelope, so no signature was checked")];
  const keys = parseAllowedSigners(text(files.get("keys/allowed_signers") ?? new Uint8Array()));
  const out: PackCheck[] = [];
  const named = new Set<string>();
  for (const p of envelopes) {
    const name = `signature:${p}`;
    const env = parse(files.get(p));
    const payload = fromBase64(str(field(env, "payload")) ?? "");
    const payloadType = str(field(env, "payloadType"));
    const signatures = list(field(env, "signatures"));
    if (payload === undefined || payloadType === undefined || signatures.length === 0) {
      out.push(fail(name, `${p} is not a signed envelope`, p));
      continue;
    }
    const message = pae(payloadType, payload);
    let verifiedBy: string | undefined;
    let unknownKey: string | undefined;
    for (const s of signatures) {
      const keyid = str(field(s, "keyid"));
      const sig = fromBase64(str(field(s, "sig")) ?? "");
      if (sig === undefined) continue;
      const candidates = keyid === undefined ? keys : keys.filter((k) => k.principal === keyid);
      if (candidates.length === 0 && keyid !== undefined) unknownKey = keyid;
      for (const k of candidates) {
        if (await verifyWith(k, message, sig)) {
          verifiedBy = k.principal;
          break;
        }
      }
      if (verifiedBy !== undefined) break;
    }
    if (verifiedBy === undefined) {
      out.push(
        unknownKey !== undefined
          ? notRun(name, `the pack holds no key for ${unknownKey}, so the signature of ${p} was not checked`, p)
          : fail(name, `no key of the pack verifies the signature of ${p}`, p),
      );
      continue;
    }
    // the statement names files of the pack, and their digests are the files'
    const statement = parse(payload);
    const subjects = list(field(statement, "subject"));
    let wrong: string | undefined;
    let lacking: string | undefined;
    for (const sub of subjects) {
      const file = str(field(sub, "name")) ?? "";
      const b = files.get(file);
      if (b === undefined) {
        if (entries.some((e) => e.path === file)) lacking ??= file;
        else wrong = `${p} names ${file}, which the pack does not hold`;
        if (wrong !== undefined) break;
        continue;
      }
      if ((await digestOf(b)) !== str(field(field(sub, "digest"), "sha256"))) {
        wrong = `${file} is not the file ${p} was signed over: its SHA-256 differs`;
        break;
      }
      named.add(file);
    }
    if (subjects.length === 0) wrong = `${p} signs a statement that names no file`;
    if (wrong !== undefined) out.push(fail(name, wrong, p));
    else if (lacking !== undefined)
      out.push(notRun(name, `${p} is signed over ${lacking}, which the pack lacks, so that digest was not checked`, p));
    else out.push(pass(name, `${p} is signed by ${verifiedBy} over ${subjects.length} files`, p));
  }
  const uncovered = entries.map((e) => e.path).filter((p) => !p.startsWith("signatures/") && !p.startsWith("keys/") && !named.has(p));
  if (out.every((c) => c.status === "pass") && uncovered.length > 0)
    out.push(fail("signed-coverage", `${uncovered[0]} is in the pack and no signature names it`, uncovered[0]));
  return out;
}

function sameFigures(a: Figures, b: unknown): string | undefined {
  for (const [k, v] of Object.entries(a))
    if (field(b, k) !== v) return `${k} is ${String(v)} from the files and ${String(field(b, k))} in the manifest`;
  return undefined;
}

/** Verifies a pack (0001-quality-evidence FR-064, FR-065): see the module's account of the checks and their order. */
export async function verifyPack(files: PackFiles): Promise<PackReport> {
  const checks: PackCheck[] = [];
  const manifest = parse(files.get("manifest.json"));
  const entries = entriesOf(manifest);
  if (field(manifest, "schema") !== "ifqs-pack/1" || entries === undefined) {
    checks.push(fail("manifest", "manifest.json is not the manifest of a pack (schema ifqs-pack/1, with its files)", "manifest.json"));
  } else {
    checks.push(pass("manifest", `the manifest lists ${entries.length} files for ${str(field(manifest, "revision")) ?? "a revision"}`));
    checks.push(...(await checkFiles(files, entries)));
    checks.push(await checkEvidenceChain(files, manifest));
    checks.push(await checkLedgerChain(files));
    checks.push(await checkNotes(files));
    checks.push(...(await checkSignatures(files, entries)));
    const problem = sameFigures(figuresOf(files), field(manifest, "summary"));
    if (checks.some((c) => c.status === "not_run" && (c.name === "files" || c.name === "evidence-chain")))
      checks.push(notRun("figures", "the figures were not compared: a file the manifest lists is not in the pack"));
    else
      checks.push(
        problem === undefined
          ? pass("figures", "the figures of the summary equal the figures computed from the files")
          : fail("figures", problem),
      );
  }
  const first = checks.find((c) => c.status === "fail") ?? checks.find((c) => c.status === "not_run");
  return { verified: checks.every((c) => c.status === "pass"), checks, ...(first === undefined ? {} : { first }) };
}

/** A report as lines of text: each check with its status, then the verdict. */
export function showReport(r: PackReport): string {
  const lines = r.checks.map(
    (c) => `${c.status === "pass" ? "pass   " : c.status === "fail" ? "FAIL   " : "not_run"} ${c.name}: ${c.detail}`,
  );
  lines.push(r.verified ? "verified" : `not verified: ${r.first?.name ?? "manifest"}: ${r.first?.detail ?? ""}`);
  return `${lines.join("\n")}\n`;
}
