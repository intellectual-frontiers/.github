// Spec: 0001-quality-evidence FR-021
/**
 * Where a run's evidence lives and how a file proves the one before it (commons 0001-quality-evidence FR-021 to FR-023, FR-026): the path
 * `quality/evidence/YYYY/MM/DD/<trace id>.otlp.json` (a branded `EvidencePath`), the chain of `ifc.quality.previous.sha256` over the
 * files in the order they were kept and its verification, which names the first file that does not match (as 0007-grc FR-007 does for a
 * ledger), the note a commit carries (`refs/notes/quality`) and the grade evidence is worth given what is known of it.
 *
 * @remarks
 * A file's digest is the SHA-256 of its bytes. The chain cannot see a change to the last file kept, since nothing yet points to it;
 * the note on the tested commit does (`verifyNote`), and so the grade of a commit whose note does not match its file falls to `E0`
 * (0021-ifqs Edge cases).
 *
 * @example
 * ```ts
 * import { evidencePath } from "./chain.ts";
 * // evidencePath("4bf92f3577b34da6a3ce929d0e0e4736", 1_700_000_000_000_000_000n)
 * //   // "quality/evidence/2023/11/14/4bf92f3577b34da6a3ce929d0e0e4736.otlp.json"
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import type { Brand } from "@intellectual-frontiers/core";
import { GENESIS } from "./primitives.ts";
import { type Sha256, sha256, sha256Of } from "@intellectual-frontiers/crypto/sha256";
import { EVIDENCE_ROOT, type Grade, isGrade, NO_GRADE, RUN_GRADE } from "./names.ts";
import { dayOf, formatQualityError, readQuality, type QualityError, type QualityRecord } from "./record.ts";

/** A path of an evidence file on the `quality` branch, made only by `evidencePath` and `parseEvidencePath`. */
export type EvidencePath = Brand<string, "EvidencePath">;

const PATH = new RegExp(`^${EVIDENCE_ROOT}/([0-9]{4})/(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])/([0-9a-f]{32})\\.otlp\\.json$`);

/** The path of the file of a run: its trace id and the UTC day the run ended (FR-021). */
export function evidencePath(traceId: string, endNanos: bigint): Result<EvidencePath, string> {
  if (!/^[0-9a-f]{32}$/.test(traceId)) return err(`${JSON.stringify(traceId)} is not a trace id`);
  return ok(`${EVIDENCE_ROOT}/${dayOf(endNanos)}/${traceId}.otlp.json` as EvidencePath); // checked just now: the brand's constructor
}

/** A path as an evidence path, with its day and trace id, or why it is not one. */
export function parseEvidencePath(
  text: string,
): Result<{ readonly path: EvidencePath; readonly day: string; readonly traceId: string }, string> {
  const m = PATH.exec(text);
  if (m === null) return err(`${JSON.stringify(text)} is not ${EVIDENCE_ROOT}/YYYY/MM/DD/<trace id>.otlp.json`);
  return ok({ path: text as EvidencePath, day: `${m[1]}/${m[2]}/${m[3]}`, traceId: m[4] ?? "" }); // checked just now: the brand's constructor
}

/** The digest of a file (FR-022): the SHA-256 of its bytes. */
export function fileDigest(text: string | Uint8Array): Promise<Sha256> {
  return sha256(text);
}

/** A file of the branch as the verifier is given it: its path and its text, in the order the commits kept them. */
export type KeptFile = { readonly path: string; readonly text: string };

/** The first thing wrong with a chain, naming the file (FR-022). */
export type ChainBreak =
  | { readonly kind: "path"; readonly file: string; readonly reason: string }
  | { readonly kind: "unreadable"; readonly file: string; readonly error: QualityError }
  | { readonly kind: "first"; readonly file: string; readonly found: string }
  | { readonly kind: "unlinked"; readonly file: string }
  | { readonly kind: "mismatch"; readonly file: string; readonly after: string; readonly expected: Sha256; readonly found: Sha256 }
  | { readonly kind: "duplicate"; readonly file: string };

/** A break as one sentence. */
export function formatChainBreak(b: ChainBreak): string {
  switch (b.kind) {
    case "path":
      return `${b.file} is not where evidence is kept: ${b.reason}`;
    case "unreadable":
      return `${b.file} does not read as a record: ${formatQualityError(b.error)}`;
    case "first":
      return `${b.file} is the first file and must name 64 zeros as its predecessor; it names ${b.found}`;
    case "unlinked":
      return `${b.file} does not carry ifc.quality.previous.sha256, so it is not linked to the file before it`;
    case "mismatch":
      return (
        `the chain breaks at ${b.file}: it names ${b.found} as the digest of the file before it, and ${b.after} is ${b.expected}; ` +
        `${b.after} was changed, or a file between them was removed or inserted`
      );
    case "duplicate":
      return `${b.file} keeps a run that an earlier file already keeps`;
    default:
      return absurd(b);
  }
}

/** What a chain that verifies is: how many files, and the digest of the last (the next file's predecessor). */
export type ChainHead = { readonly count: number; readonly head: Sha256; readonly records: readonly QualityRecord[] };

/**
 * Whether files, in the order they were kept, form the chain (FR-022): each at a path of its trace id and day, each a record that
 * names the digest of the file before it (64 zeros for the first). The first file that does not match is named.
 */
export async function verifyChain(files: readonly KeptFile[]): Promise<Result<ChainHead, ChainBreak>> {
  let previous: Sha256 = GENESIS;
  let before: string | undefined;
  const seen = new Set<string>();
  const records: QualityRecord[] = [];
  for (const f of files) {
    const p = parseEvidencePath(f.path);
    if (p.kind === "err") return err({ kind: "path", file: f.path, reason: p.error });
    const q = readQuality(f.text);
    if (q.kind === "err") return err({ kind: "unreadable", file: f.path, error: q.error });
    if (q.value.traceId !== p.value.traceId)
      return err({
        kind: "path",
        file: f.path,
        reason: `the file is named for trace ${p.value.traceId} and holds trace ${q.value.traceId}`,
      });
    if (seen.has(q.value.traceId)) return err({ kind: "duplicate", file: f.path });
    seen.add(q.value.traceId);
    const named = q.value.previous;
    if (named === undefined) return err({ kind: "unlinked", file: f.path });
    if (before === undefined) {
      if (named !== GENESIS) return err({ kind: "first", file: f.path, found: named });
    } else if (named !== previous) {
      return err({ kind: "mismatch", file: f.path, after: before, expected: previous, found: named });
    }
    previous = await fileDigest(f.text);
    before = f.path;
    records.push(q.value);
  }
  return ok({ count: files.length, head: previous, records });
}

// ---------------------------------------------------------------------------------------------------------------------------- the note (FR-023)

/** What a commit's note says of its evidence: the file's path, its SHA-256 and its grade (FR-023). */
export type EvidenceNote = { readonly path: EvidencePath; readonly sha256: Sha256; readonly grade: Grade };

/** The text of a note: three lines. */
export function formatNote(n: EvidenceNote): string {
  return `path ${n.path}\nsha256 ${n.sha256}\ngrade ${n.grade}\n`;
}

/** The notes of a commit, oldest first: a note holds one stanza for each run kept for the commit, separated by a blank line. */
export function parseNotes(text: string): Result<readonly EvidenceNote[], string> {
  const out: EvidenceNote[] = [];
  for (const stanza of text.split(/\n\s*\n/)) {
    if (stanza.trim() === "") continue;
    const fields = new Map<string, string>();
    for (const line of stanza.split("\n")) {
      const sp = line.indexOf(" ");
      if (sp > 0) fields.set(line.slice(0, sp), line.slice(sp + 1).trim());
    }
    const path = parseEvidencePath(fields.get("path") ?? "");
    if (path.kind === "err") return err(path.error);
    const digest = sha256Of(fields.get("sha256") ?? "");
    if (digest === undefined) return err(`the note's sha256 is not a SHA-256: ${JSON.stringify(fields.get("sha256") ?? "")}`);
    const grade = fields.get("grade") ?? "";
    if (!isGrade(grade)) return err(`the note's grade ${JSON.stringify(grade)} is not E0 to E5`);
    out.push({ path: path.value.path, sha256: digest, grade });
  }
  return ok(out);
}

/** Whether a note matches the file it names (FR-023): the SHA-256 of the file is the note's. */
export async function verifyNote(note: EvidenceNote, file: string | Uint8Array): Promise<boolean> {
  return (await fileDigest(file)) === note.sha256;
}

// ---------------------------------------------------------------------------------------------------------------------------- the grade (FR-026)

/** What is known of a run's evidence when its grade is judged. */
export type EvidenceFacts = {
  /** The record exists, and reads. */
  readonly record: boolean;
  /** It is kept on the `quality` branch, in a chain that verifies. */
  readonly chained: boolean;
  /** The commit that kept it carries a signature (FR-021). */
  readonly signed: boolean;
  /** The tested commit's note names this file and its SHA-256 matches (FR-023). */
  readonly linked: boolean;
  /** A note exists and its SHA-256 does not match the file, or the chain is broken: the evidence is broken. */
  readonly broken: boolean;
};

/**
 * The grade of a run's evidence (FR-026): `E3` where the record exists, `E4` where it is kept on the branch, chained, signed and linked to
 * its commit, and `E0` where the evidence is broken (a note whose SHA-256 differs from its file, or a chain that does not verify) until a
 * new run. The grades `E1`, `E2` and `E5` are those of statements, reviews and probes, which a record of a run does not give.
 */
export function gradeOf(f: EvidenceFacts): Grade {
  if (f.broken || !f.record) return NO_GRADE;
  return f.chained && f.signed && f.linked ? "E4" : RUN_GRADE;
}
