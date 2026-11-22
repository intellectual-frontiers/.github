// Spec: 0003-evidence-capture-collect FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
/**
 * One run of the collector, with no person: it takes the lock (a second run does not wait), looks at the assets that are due with at most a few at once and a time limit each, keeps the state of an asset on the branch only where it differs from the one
 * kept, journals each look as the policy says in a hash-chained entry, makes a commit when a state changed or the journal's batch interval has run (the entries not yet committed wait in a file of the run's own), and pushes the branch as the policy says,
 * never forcing; a push that fails is an entry of the journal and is tried again by the next run.
 *
 * @example
 * ```ts
 * import { collect } from "./collect.ts";
 * // const done = await collect({ store, policy, assets, observe, now: new Date().toISOString(), runtime: ".git/opsfolio-evidence" });
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { fanOut, type FanOutLimits } from "@intellectual-frontiers/headless/logical";
import type { CapturePolicy } from "@intellectual-frontiers/estate/governance";
import { instantMs, parseDuration } from "@intellectual-frontiers/grc/governance";
import { appendEntry, verifyLedger, type LedgerEntry } from "@intellectual-frontiers/grc/logical";
import type { GitRefStore } from "@intellectual-frontiers/grc/stores/gitref";
import { fs, path } from "@intellectual-frontiers/system";
import { acquireLock } from "@intellectual-frontiers/system/lock";
import { decodeEntries, dueAssets, encodeEntry, entryTypeFor, journalPath, statePath, textDigest, type Found } from "@intellectual-frontiers/evidence-capture/logical";
import type { CaptureFailure, JournalType, Observed, Observer } from "@intellectual-frontiers/evidence-capture/governance";

/** What a run is given. */
export type CollectInput = {
  readonly store: GitRefStore;
  readonly policy: CapturePolicy;
  readonly assets: readonly Observed[];
  readonly observe: Observer;
  /** The instant of the run (ISO 8601). */
  readonly now: string;
  /** The folder of the run's own memory (outside the tracked files: the repository's `.git/opsfolio-evidence`). */
  readonly runtime: string;
  /** How many assets are looked at at once and how long each may take (8 and 15 seconds by default). */
  readonly limits?: FanOutLimits;
  /** Look at these assets only, whether or not they are due. */
  readonly only?: readonly string[];
};

/** What happened to one asset in a run. */
export type AssetOutcome = "changed" | "unchanged" | "unreachable" | "refused" | "unreadable" | "not-due";

/** What a run did. */
export type Collected = {
  readonly assets: readonly { readonly id: string; readonly outcome: AssetOutcome; readonly journaled: boolean }[];
  /** The commit made, where one was. */
  readonly commit: string | undefined;
  /** The entries of the journal waiting for the next commit. */
  readonly pending: number;
  readonly pushed: "not-asked" | "pushed" | "failed" | "not-due";
};

type Memory = { attempts: Record<string, string>; journaled: Record<string, string>; lastJournalCommit: string | null; lastPush: string | null };

const NO_MEMORY: Memory = { attempts: {}, journaled: {}, lastJournalCommit: null, lastPush: null };

async function readMemory(file: string): Promise<Memory> {
  try {
    const v = JSON.parse(await fs.readTextFile(file)) as Partial<Memory>;
    return { attempts: v.attempts ?? {}, journaled: v.journaled ?? {}, lastJournalCommit: v.lastJournalCommit ?? null, lastPush: v.lastPush ?? null };
  } catch {
    return { ...NO_MEMORY, attempts: {}, journaled: {} };
  }
}

const text = (b: Uint8Array | undefined): string | undefined => (b === undefined ? undefined : new TextDecoder().decode(b));

/** The last entry of the journal on the branch, if any. */
async function lastEntryOnBranch(store: GitRefStore): Promise<LedgerEntry | undefined> {
  const files = (await store.list("journal")).filter((f) => f.endsWith(".jsonl"));
  for (const file of files.slice().reverse()) {
    const entries = decodeEntries(text(await store.read(file)) ?? "");
    const last = entries.kind === "ok" ? entries.value.at(-1) : undefined;
    if (last !== undefined) return last;
  }
  return undefined;
}

/** The whole journal of the branch at a revision, read in order and verified: its entries, or the first entry that does not follow. */
export async function readJournal(store: GitRefStore, at?: string): Promise<Result<readonly LedgerEntry[], string>> {
  const entries: LedgerEntry[] = [];
  for (const file of (await store.list("journal", at)).filter((f) => f.endsWith(".jsonl"))) {
    const day = decodeEntries(text(await store.read(file, at)) ?? "");
    if (day.kind === "err") return err(`${file}: ${day.error}`);
    entries.push(...day.value);
  }
  const verified = await verifyLedger(entries);
  return verified.kind === "ok" ? ok(entries) : err(`the journal does not hold: ${verified.error.reason}`);
}

/** One run of the collector; an error where another run holds the lock or the branch moved while it committed. */
export async function collect(input: CollectInput): Promise<Result<Collected, string>> {
  const { store, policy, now } = input;
  await fs.mkdir(input.runtime, { recursive: true });
  const held = await acquireLock(path.join(input.runtime, "lock"), { wait: false, command: "opsfolio evidence collect" });
  if (held === undefined) return err("another collection is running");
  try {
    const memoryFile = path.join(input.runtime, "memory.json");
    const pendingFile = path.join(input.runtime, "pending.jsonl");
    const memory = await readMemory(memoryFile);
    const pendingRead = decodeEntries(await fs.readTextFile(pendingFile).catch(() => ""));
    if (pendingRead.kind === "err") return err(`the entries waiting for a commit are not readable: ${pendingRead.error}`);
    const pending: LedgerEntry[] = [...pendingRead.value];
    let tail: LedgerEntry | undefined = pending.at(-1) ?? (await lastEntryOnBranch(store));

    const wanted = input.only ?? dueAssets(policy, input.assets, (id) => memory.attempts[id], now);
    const targets = input.assets.filter((a) => wanted.includes(a.id));
    const rows = await fanOut(targets.map((a) => a.id), (id) => input.observe(targets.find((a) => a.id === id) ?? { id, state: "adopted" }), input.limits ?? { concurrency: 8, perHostTimeoutMs: 15_000 });

    const stateChanges: { path: string; bytes: Uint8Array }[] = [];
    const outcomes: { id: string; outcome: AssetOutcome; journaled: boolean }[] = input.assets.filter((a) => !wanted.includes(a.id)).map((a) => ({ id: a.id, outcome: "not-due", journaled: false }));
    for (const row of rows) {
      const id = row.id;
      let found: Found;
      let stateText: string | undefined;
      if (row.kind === "timeout") found = { kind: "failure", failure: { kind: "unreachable", message: "the look took longer than the time allowed" } };
      else if (row.kind === "failed") found = { kind: "failure", failure: { kind: "unreachable", message: row.message } };
      else if (row.value.kind === "err") found = { kind: "failure", failure: row.value.error };
      else {
        stateText = row.value.value.stateText;
        found = { kind: "state", digest: await textDigest(stateText) };
      }
      const kept = text(await store.read(statePath(id)));
      const before = { digest: kept === undefined ? undefined : await textDigest(kept), lastJournaledAt: memory.journaled[id] };
      memory.attempts[id] = now;
      const type = entryTypeFor(found, before, policy, now, input.assets.find((a) => a.id === id) ?? {});
      if (found.kind === "state" && stateText !== undefined && before.digest !== found.digest) stateChanges.push({ path: statePath(id), bytes: new TextEncoder().encode(stateText) });
      if (type !== undefined) {
        const failure: CaptureFailure | undefined = found.kind === "failure" ? found.failure : undefined;
        tail = await appendEntry(tail, { at: now, type, subject: id, evidence: found.kind === "state" ? found.digest : await textDigest(`${failure?.kind}: ${failure?.message}`) });
        pending.push(tail);
        memory.journaled[id] = now;
      }
      outcomes.push({ id, outcome: found.kind === "failure" ? found.failure.kind : before.digest !== found.digest ? "changed" : "unchanged", journaled: type !== undefined });
    }

    const everyMs = parseDuration(policy.journal.commit.every);
    const sinceCommit = memory.lastJournalCommit === null ? undefined : (instantMs(now) ?? 0) - (instantMs(memory.lastJournalCommit) ?? 0);
    const batchDue = pending.length > 0 && (sinceCommit === undefined || everyMs.kind === "err" || sinceCommit >= everyMs.value - 1000);
    let commit: string | undefined;
    if (stateChanges.length > 0 || batchDue) {
      const byDay = new Map<string, string[]>();
      for (const e of pending) byDay.set(journalPath(e.createdAt), [...(byDay.get(journalPath(e.createdAt)) ?? []), encodeEntry(e)]);
      const changes = [...stateChanges];
      for (const [file, lines] of byDay) changes.push({ path: file, bytes: new TextEncoder().encode(`${text(await store.read(file)) ?? ""}${lines.join("")}`) });
      const changed = outcomes.filter((o) => o.outcome === "changed").map((o) => o.id);
      const message = `captured ${now}: ${changed.length > 0 ? `changed ${changed.join(", ")}` : "journal"}; ${pending.length} entries`;
      const made = await store.commit(changes, message, now);
      if (made.kind === "err") {
        await fs.writeTextFile(pendingFile, pending.map(encodeEntry).join(""));
        await fs.writeTextFile(memoryFile, JSON.stringify(memory));
        return err(made.error.message);
      }
      commit = made.value.commit;
      pending.length = 0;
      memory.lastJournalCommit = now;
    }

    let pushed: Collected["pushed"] = "not-asked";
    if (policy.push.mode !== "never") {
      const everyPush = policy.push.every === null ? undefined : parseDuration(policy.push.every);
      const sincePush = memory.lastPush === null ? undefined : (instantMs(now) ?? 0) - (instantMs(memory.lastPush) ?? 0);
      const wantPush = policy.push.mode === "after-commit" ? commit !== undefined || memory.lastPush === null : sincePush === undefined || everyPush === undefined || everyPush.kind === "err" || sincePush >= everyPush.value - 1000;
      if (!wantPush) pushed = "not-due";
      else if ((await store.head()) === undefined) pushed = "not-due";
      else {
        const r = await store.push(policy.push.remote);
        if (r.kind === "ok") {
          pushed = "pushed";
          memory.lastPush = now;
        } else {
          pushed = "failed";
          tail = await appendEntry(tail, { at: now, type: "push.failed" satisfies JournalType, subject: policy.push.remote, evidence: await textDigest(r.error.message) });
          pending.push(tail);
        }
      }
    }

    await fs.writeTextFile(pendingFile, pending.map(encodeEntry).join(""));
    await fs.writeTextFile(memoryFile, JSON.stringify(memory));
    return ok({ assets: outcomes.sort((a, b) => (a.id < b.id ? -1 : 1)), commit, pending: pending.length, pushed });
  } finally {
    held.release();
  }
}
