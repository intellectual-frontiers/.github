// Spec: 0001-quality-evidence FR-060
/**
 * The assessor pack (commons 0001-quality-evidence FR-060 to FR-063, FR-066): a self-contained bundle for one revision and one span of time, made from what
 * `PackSource` holds and nothing else, deterministic (the same source gives the same bytes), with a manifest that gives each file's SHA-256, size
 * and media type.
 *
 * | Path | What |
 * | --- | --- |
 * | `quality/evidence/YYYY/MM/DD/<trace>.otlp.json` | the evidence files of the span, as kept, with their chain |
 * | `quality/records/NNNNNN-<kind>.json` | the ledger of nonconformances, CAPA, attestations, plans, samples and mutation runs |
 * | `notes/<commit>.note` | the notes that link a tested commit to its evidence file |
 * | `specs/<slug>/<digest>.md` and `specs/index.json` | the specifications at the tested revisions |
 * | `trace/matrix.tsv` | the traceability matrix: each requirement, its mechanism, grade, freshness, last proof and the strength of its proof |
 * | `oscal/<trace>.assessment-results.json` | the OSCAL assessment results of each run |
 * | `index.json` | the index of the quality branch (0001-quality-evidence FR-024) |
 * | `signatures/pack.dsse.json`, `keys/allowed_signers` | the signed statement over every file and the keys that verify it |
 * | `verify/verify-pack.ts`, `verify/verify.ts` | the verifier, so that the pack checks itself |
 * | `manifest.json` | the audience, the span, the chain, the figures, the redactions and the files |
 *
 * @remarks
 * What a pack must not leak is stopped at the source: the evidence and the ledger are written redacted of secrets and e-mail addresses (0021-ifqs
 * FR-020), and changing a file now would break its chain, so a file that still holds a secret refuses the pack (naming it), and a file that holds an
 * e-mail address (the author of a corrective change, say) is kept as it is and named in the manifest's `retained`. The files made here
 * (matrix, OSCAL, index) are redacted and their redactions counted (FR-061).
 *
 * @module
 */
import { type DsseKey, signStatement, statement } from "@intellectual-frontiers/crypto/dsse";
import { redactText } from "@intellectual-frontiers/telemetry/otel";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { tar } from "@intellectual-frontiers/formats/archive";
import { redactFor } from "../trust/audience.ts";
import type { TrustRequirement } from "../trust/view.ts";
import { digestOf, type Figures, figuresOf, GENESIS_DIGEST, type PackFiles } from "./verify-pack.ts";

/** The predicate type of the statement a pack is signed with. */
export const PACK_PREDICATE = "https://github.com/intellectual-frontiers/.github/tree/main/commons/spec-kit/specs/0022-trust/pack";

/** A file of the pack's source: its path in the pack and its text. */
export type SourceFile = { readonly path: string; readonly text: string };

/** What the pack is made from: the evidence of a harness at a revision, read once. */
export type PackSource = {
  readonly harness: string;
  readonly revision: string;
  readonly asOf: string;
  /** The span of days to include, both ends included; the whole branch where not given. */
  readonly span?: { readonly from?: string; readonly to?: string };
  /** Every evidence file of the branch, in the order they were kept. */
  readonly evidence: readonly SourceFile[];
  /** Every file of the ledger, in order. */
  readonly records: readonly SourceFile[];
  /** The notes of tested commits: the commit and the note's text. */
  readonly notes: readonly { readonly commit: string; readonly text: string }[];
  /** The specifications at the tested revisions, at their paths in the pack, and the index that maps a revision to each. */
  readonly specs: readonly SourceFile[];
  readonly specIndex: string;
  readonly matrix: string;
  readonly index: string;
  readonly oscal: readonly { readonly traceId: string; readonly text: string }[];
  /** The verifier's own source files, copied into the pack byte for byte. */
  readonly verifier: { readonly pack: string; readonly main: string };
  /** The keys that sign it and the allowed-signers file that verifies it; none where the pack is not signed (it then verifies as `not_run`). */
  readonly signing?: { readonly keys: readonly DsseKey[]; readonly allowedSigners: string };
};

/** The manifest's entry for a file. */
export type ManifestFile = { readonly path: string; readonly sha256: string; readonly bytes: number; readonly mediaType: string };

/** A pack: its files, with the manifest among them. */
export type BuiltPack = {
  readonly files: PackFiles;
  readonly manifest: string;
  readonly figures: Figures;
  readonly redactions: number;
};

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const enc = new TextEncoder();
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;

/** The IANA media type of a file of a pack, from its name. */
export function mediaTypeOf(path: string): string {
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".tsv")) return "text/tab-separated-values";
  if (path.endsWith(".md")) return "text/markdown";
  return "text/plain";
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => byText(a, b))
        .map(([k, v]) => [k, sorted(v)]),
    );
  return value;
}

const jsonText = (value: unknown): string => `${JSON.stringify(sorted(value), null, 2)}\n`;

const dayOfEvidence = (path: string): string => path.split("/").slice(2, 5).join("-");

/**
 * The pack of a source (FR-060 to FR-062, FR-066), or why it cannot be made: a span that is not a contiguous part of the chain, a file that holds a
 * secret (it cannot be redacted without breaking its chain: it is named so that its source is fixed), or a key that cannot sign.
 */
export async function buildPack(source: PackSource): Promise<Result<BuiltPack, string>> {
  const from = source.span?.from ?? "0000-00-00";
  const to = source.span?.to ?? "9999-99-99";
  const inSpan = source.evidence.filter((f) => dayOfEvidence(f.path) >= from && dayOfEvidence(f.path) <= to);
  const first = inSpan[0];
  const at = first === undefined ? -1 : source.evidence.findIndex((f) => f.path === first.path);
  if (at >= 0 && source.evidence.slice(at, at + inSpan.length).some((f, i) => f.path !== inSpan[i]?.path))
    return err(`the span ${from} to ${to} is not a contiguous part of the evidence chain: runs outside it lie between runs inside it`);
  const before = at > 0 ? source.evidence[at - 1] : undefined;
  const anchor = before === undefined ? GENESIS_DIGEST : await digestOf(enc.encode(before.text));

  const files = new Map<string, Uint8Array>();
  let redactions = 0;
  const retained: { file: string; kind: string; count: number }[] = [];
  const kept = (f: SourceFile): Result<true, string> => {
    if (redactText(f.text) !== f.text)
      return err(
        `${f.path} holds a secret: it cannot be redacted without breaking its chain, so its source must be fixed before a pack is made`,
      );
    const mails = f.text.match(EMAIL)?.length ?? 0;
    if (mails > 0) retained.push({ file: f.path, kind: "e-mail address", count: mails });
    files.set(f.path, enc.encode(f.text));
    return ok(true);
  };
  for (const f of [...inSpan, ...source.records]) {
    const k = kept(f);
    if (k.kind === "err") return k;
  }
  // a file made here is redacted of secrets and personal data (FR-061) and its redactions counted
  const made = (path: string, text: string): void => {
    const r = redactFor("Assessor", { terms: [] }, text);
    redactions += r.count;
    files.set(path, enc.encode(r.text));
  };
  for (const n of [...source.notes].sort((a, b) => byText(a.commit, b.commit))) {
    const mine = n.text
      .split(/\n\s*\n/)
      .filter((s) => inSpan.some((f) => s.includes(`path ${f.path}\n`) || s.includes(`path ${f.path}`)))
      .join("\n\n");
    if (mine.trim() !== "") files.set(`notes/${n.commit}.note`, enc.encode(`${mine.trim()}\n`));
  }
  for (const s of source.specs) made(s.path, s.text);
  made("specs/index.json", source.specIndex);
  made("trace/matrix.tsv", source.matrix);
  made("index.json", source.index);
  for (const o of [...source.oscal].sort((a, b) => byText(a.traceId, b.traceId)))
    if (inSpan.some((f) => f.path.endsWith(`${o.traceId}.otlp.json`))) made(`oscal/${o.traceId}.assessment-results.json`, o.text);
  files.set("verify/verify-pack.ts", enc.encode(source.verifier.pack));
  files.set("verify/verify.ts", enc.encode(source.verifier.main));

  const figures = figuresOf(files);
  const head = inSpan.length === 0 ? anchor : await digestOf(enc.encode(inSpan[inSpan.length - 1]?.text ?? ""));
  const ledgerHead =
    source.records.length === 0 ? GENESIS_DIGEST : await digestOf(enc.encode(source.records[source.records.length - 1]?.text ?? ""));

  // the signature: one statement over every file made so far, which the manifest then lists with the rest
  if (source.signing !== undefined) {
    const subjects = await Promise.all(
      [...files.keys()].sort(byText).map(async (name) => ({ name, digest: { sha256: await sha256(files.get(name) ?? new Uint8Array()) } })),
    );
    const stmt = statement(subjects, PACK_PREDICATE, { revision: source.revision, asOf: source.asOf, audience: "Assessor", head });
    const env = await signStatement(stmt, source.signing.keys);
    if (env.kind === "err") return err(`a key cannot sign: ${env.error.reason}`);
    files.set("signatures/pack.dsse.json", enc.encode(`${JSON.stringify(env.value)}\n`));
    files.set("keys/allowed_signers", enc.encode(source.signing.allowedSigners));
  }

  const entries: ManifestFile[] = [];
  for (const path of [...files.keys()].sort(byText)) {
    const bytes = files.get(path) ?? new Uint8Array();
    entries.push({ path, sha256: await digestOf(bytes), bytes: bytes.length, mediaType: mediaTypeOf(path) });
  }
  const manifest = jsonText({
    schema: "ifqs-pack/1",
    audience: "Assessor",
    harness: source.harness,
    revision: source.revision,
    asOf: source.asOf,
    span: {
      from: inSpan.length === 0 ? null : dayOfEvidence(inSpan[0]?.path ?? ""),
      to: inSpan.length === 0 ? null : dayOfEvidence(inSpan[inSpan.length - 1]?.path ?? ""),
    },
    chain: { anchor, files: inSpan.map((f) => f.path), head },
    ledger: { files: source.records.length, head: ledgerHead },
    summary: figures,
    redactions: {
      count: redactions,
      note: "Secrets and personal data are redacted where the evidence is written, so that its chain holds; a file made for the pack is redacted here and counted.",
      retained,
    },
    files: entries,
  });
  files.set("manifest.json", enc.encode(manifest));
  return ok({ files, manifest, figures, redactions });
}

/**
 * The traceability matrix (FR-060): each requirement of the proof register with its mechanism, grade, freshness, the day and run of its last proof and
 * the strength of that proof, tab separated, sorted by requirement.
 */
export function matrixTsv(
  register: readonly { readonly requirement: string; readonly mechanism: string }[],
  requirements: readonly TrustRequirement[],
): string {
  const mechanism = new Map(register.map((r) => [r.requirement, r.mechanism]));
  const ids = [...new Set([...register.map((r) => r.requirement), ...requirements.map((r) => r.id)])].sort(byText);
  const by = new Map(requirements.map((r) => [r.id, r]));
  const rows = ids.map((id) => {
    const q = by.get(id);
    return [
      id,
      mechanism.get(id) ?? "-",
      q?.grade ?? "E0",
      q?.freshness ?? "None",
      q?.day ?? "-",
      q?.run ?? "-",
      q?.strengthPermille === undefined ? "-" : String(q.strengthPermille),
    ].join("\t");
  });
  return `requirement\tmechanism\tgrade\tfreshness\tlast proof\trun\tstrength (permille)\n${rows.join("\n")}${rows.length === 0 ? "" : "\n"}`;
}

/** The pack as one deterministic tar archive (ustar, no time, no owner), the distribution of FR-063. */
export function packTar(pack: BuiltPack): Result<Uint8Array, string> {
  const t = tar(pack.files);
  return t.kind === "ok" ? t : err(`the pack cannot be archived: ${JSON.stringify(t.error)}`);
}

/** The DCAT distribution of a pack (FR-063): a JSON-LD description of the file, with its SHA-256 beside it. */
export function dcatOf(input: {
  readonly title: string;
  readonly file: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly revision: string;
  readonly downloadUrl?: string;
}): string {
  return jsonText({
    "@context": {
      dcat: "http://www.w3.org/ns/dcat#",
      dcterms: "http://purl.org/dc/terms/",
      spdx: "http://spdx.org/rdf/terms#",
      ifqs: "https://github.com/intellectual-frontiers/.github/tree/main/commons/ontology/ifqs#",
    },
    "@type": ["dcat:Distribution", "ifqs:AssessorPack"],
    "dcterms:title": input.title,
    "dcat:mediaType": "application/x-tar",
    "dcat:byteSize": input.bytes,
    ...(input.downloadUrl === undefined ? {} : { "dcat:downloadURL": input.downloadUrl }),
    "dcterms:identifier": input.file,
    "ifqs:packAudience": "ifqs:Assessor",
    "ifqs:packRevision": input.revision,
    "ifqs:packSha256": input.sha256,
    "spdx:checksum": { "@type": "spdx:Checksum", "spdx:algorithm": "spdx:checksumAlgorithm_sha256", "spdx:checksumValue": input.sha256 },
  });
}
