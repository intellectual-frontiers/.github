/**
 * The ledger of nonconformances and CAPA on the `quality` branch (commons 0021-ifqs FR-026 to FR-031, FR-043), with real `git`: each event is
 * one new file `quality/records/NNNNNN-<kind>.json` in a commit that only appends, chained to the file before it by its digest, signed
 * where Git is set to sign; reading folds the files into the state of every nonconformance and CAPA, refusing a chain that does not verify.
 *
 * @remarks
 * Same plumbing as the evidence files (`branch.ts`): a temporary index, `write-tree`, `commit-tree` and `update-ref` guarded by the tip it
 * read, so a branch that moved is refused and the working tree and the index of the repository are never touched.
 *
 * @module
 */
import { GENESIS } from "../../kernel/evidence.ts";
import { formatAssuranceError, foldAssurance } from "../attestation/rules.ts";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Sha256, sha256 } from "../../kernel/sha256.ts";
import {
  emptyLedger,
  formatLedgerError,
  foldLedger,
  type Ledger,
  type LedgerEvent,
  ledgerFile,
  redactEvent,
  readLedgerFile,
  RECORDS_ROOT,
  recordPath,
  verifyLedgerChain,
} from "../pure/ledger.ts";
import { QUALITY_BRANCH } from "../pure/names.ts";
import { blobAt, branchTip, signingFollowsConfig, writeCommit } from "./branch.ts";
import { formatHostError, gitRaw, gitText, type HostError } from "./git.ts";

/** Why the ledger could not be read or extended. */
export type LedgerHostError = HostError | { readonly kind: "ledger"; readonly reason: string };

/** A ledger error as one sentence. */
export function formatLedgerHostError(e: LedgerHostError): string {
  return e.kind === "ledger" ? `the ledger of nonconformances: ${e.reason}` : formatHostError(e);
}

/** The ledger as it stands on the branch: the state, the number of files and the digest of the last (the next file's predecessor). */
export type LedgerRead = {
  readonly ledger: Ledger;
  /** The events in the order they were kept. */
  readonly events: readonly LedgerEvent[];
  readonly files: number;
  readonly head: Sha256;
  readonly tip: string | undefined;
};

/** The files of the ledger on a commit, in sequence. */
export async function filesAt(
  repo: string,
  tip: string,
): Promise<Result<readonly { readonly path: string; readonly text: string }[], HostError>> {
  const listed = await gitText(repo, ["ls-tree", "-r", "--name-only", tip, "--", RECORDS_ROOT]);
  if (listed.kind === "err") return listed;
  const paths = listed.value
    .split("\n")
    .filter((p) => p !== "")
    .sort();
  const out: { path: string; text: string }[] = [];
  for (const path of paths) {
    const body = await blobAt(repo, tip, path);
    if (body.kind === "err") return body;
    out.push({ path, text: body.value });
  }
  return ok(out);
}

/** Reads the ledger from the tip of the `quality` branch: its chain must verify and its events must follow one another (FR-027 to FR-030). A repository with no branch has the empty ledger. */
export async function readLedger(repo: string): Promise<Result<LedgerRead, LedgerHostError>> {
  const tip = await branchTip(repo);
  if (tip.kind === "err") return tip;
  if (tip.value === undefined) return ok({ ledger: emptyLedger, events: [], files: 0, head: GENESIS, tip: undefined });
  const files = await filesAt(repo, tip.value);
  if (files.kind === "err") return files;
  const chain = await verifyLedgerChain(files.value);
  if (chain.kind === "err") return err({ kind: "ledger", reason: `${chain.error.path}: ${chain.error.reason}` });
  const events: LedgerEvent[] = [];
  for (const f of files.value) {
    const r = readLedgerFile(f.text);
    if (r.kind === "err") return err({ kind: "ledger", reason: `${f.path}: ${r.error}` });
    events.push(r.value.event);
  }
  const folded = foldLedger(events);
  if (folded.kind === "err") return err({ kind: "ledger", reason: formatLedgerError(folded.error) });
  const tier2 = foldAssurance(events);
  if (tier2.kind === "err") return err({ kind: "ledger", reason: formatAssuranceError(tier2.error) });
  return ok({ ledger: folded.value, events, files: files.value.length, head: chain.value, tip: tip.value });
}

/** What `appendEvents` is given. */
export type AppendOptions = {
  /** Whether to sign the commits: true, false, or (not given) as the host's `commit.gpgsign` says. */
  readonly sign?: boolean;
};

/**
 * Appends events to the ledger, each as a new file in a commit of its own on the `quality` branch (created by the first commit where there is
 * none). An event that does not follow the ledger (a CAPA closed before it was verified, a nonconformance closed by editing) is refused and
 * nothing is written; a branch that moved while it was written is refused and the ledger is unchanged.
 */
export async function appendEvents(
  repo: string,
  asked: readonly LedgerEvent[],
  options: AppendOptions = {},
): Promise<Result<LedgerRead, LedgerHostError>> {
  // redaction is at the source (0022-trust FR-017): the ledger judges and keeps the events as they are redacted
  const events = asked.map(redactEvent);
  const before = await readLedger(repo);
  if (before.kind === "err") return before;
  const read = before.value;
  const folded = foldLedger([...read.events, ...events]);
  if (folded.kind === "err") return err({ kind: "ledger", reason: formatLedgerError(folded.error) });
  const tier2 = foldAssurance([...read.events, ...events]);
  if (tier2.kind === "err") return err({ kind: "ledger", reason: formatAssuranceError(tier2.error) });
  const sign = options.sign ?? (await signingFollowsConfig(repo));
  let tip = read.tip;
  let head = read.head;
  let seq = read.files;
  for (const event of events) {
    seq += 1;
    const text = ledgerFile({ schema: "ifqs-record/1", seq, previous: head, event });
    if (text.kind === "err") return err({ kind: "ledger", reason: text.error });
    const path = recordPath(seq, event.kind);
    const commit = await writeCommit(
      repo,
      tip,
      path,
      text.value,
      `Record ${seq}: ${event.kind}\n\nKept by ifc quality (commons 0021-ifqs).`,
      sign,
    );
    if (commit.kind === "err") return commit;
    const guard = tip ?? "0".repeat(commit.value.length);
    const moved = await gitRaw(repo, ["update-ref", "-m", `record ${seq}`, `refs/heads/${QUALITY_BRANCH}`, commit.value, guard]);
    if (moved.kind === "err") return moved;
    if (moved.value.code !== 0) return err({ kind: "moved", branch: QUALITY_BRANCH });
    tip = commit.value;
    head = await sha256(text.value);
  }
  return readLedger(repo);
}
