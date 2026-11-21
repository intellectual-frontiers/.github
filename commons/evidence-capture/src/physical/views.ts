// Spec: 0005-evidence-capture-views FR-002, FR-003, FR-004, FR-005
/**
 * Reading back what was captured (0005-evidence-capture-views): the structured difference of the state of an asset between two revisions, what changed over a period, what was known at an instant and whether the journal holds. They read the branch of Git that the policy
 * names through its store; what a state is, and how two states differ, is the caller's (a codec), so that this library knows no kind of machine.
 *
 * @example
 * ```ts
 * import { verifyJournalOf } from "./views.ts";
 * // await verifyJournalOf(store, policy.branch)
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { instantMs } from "@intellectual-frontiers/grc/governance";
import type { GitRefStore } from "@intellectual-frontiers/grc/stores/gitref";
import { parseSpan } from "@intellectual-frontiers/evidence-capture/logical";
import { readJournal } from "./collect.ts";

/** How the states kept on the branch are read and compared: `read` gives the state a file's text holds (nothing where it does not), and `diff` the difference of two. */
export type StateCodec<S, D> = { readonly read: (text: string) => S | undefined; readonly diff: (a: S, b: S) => D };

const textOf = (b: Uint8Array | undefined): string | undefined => (b === undefined ? undefined : new TextDecoder().decode(b));

/** A revision named by an instant (the newest commit at or before it), by `latest`, or by a commit. */
async function revisionOf(store: GitRefStore, text: string): Promise<string | undefined> {
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? store.at(text) : text === "latest" ? store.head() : text;
}

async function stateAt<S, D>(store: GitRefStore, codec: StateCodec<S, D>, asset: string, rev: string): Promise<S | undefined> {
  const t = textOf(await store.read(`state/${asset}.json`, rev));
  return t === undefined ? undefined : codec.read(t);
}

/** What `diffAsset` found: the two states compared (with their instants) and what differs. */
export type Diffed<D> = { readonly asset: string; readonly from: { readonly commit: string; readonly at: string }; readonly to: { readonly commit: string; readonly at: string }; readonly diff: D };

/**
 * The structured difference of the state of an asset between two revisions (commits or instants). With none given it is the last change: the state before the newest and the newest. `since` compares the state at `now` minus a span with the newest.
 * Nothing to compare (the asset has been kept once or never) is `undefined`.
 */
export async function diffAsset<S, D>(store: GitRefStore, branch: string, codec: StateCodec<S, D>, asset: string, o: { readonly from: string; readonly to: string; readonly since: string; readonly now: string }): Promise<Result<Diffed<D> | undefined, string>> {
  const history = await store.history(`state/${asset}.json`);
  if (history.length === 0) return err(`no state of ${asset} is kept on the branch ${branch}: collect it first`);
  const newest = history[0];
  let toRev = o.to === "" ? newest?.commit : await revisionOf(store, o.to);
  let fromRev: string | undefined;
  if (o.since !== "") {
    const span = parseSpan(o.since);
    if (span.kind === "err") return span;
    fromRev = await store.at(new Date((instantMs(o.now) ?? Date.now()) - span.value).toISOString());
  } else fromRev = o.from === "" ? (o.to === "" ? history[1]?.commit : history.find((h) => h.commit !== toRev)?.commit) : await revisionOf(store, o.from);
  if (toRev === undefined) return err(`${o.to} is no instant or commit of the branch`);
  if (fromRev === undefined) return ok(undefined);
  const [a, b] = [await stateAt(store, codec, asset, fromRev), await stateAt(store, codec, asset, toRev)];
  if (b === undefined) return err(`${asset} has no state at ${toRev}`);
  if (a === undefined) return ok(undefined);
  const when = (rev: string): string => history.find((h) => h.commit === rev)?.at ?? "";
  toRev = toRev ?? "";
  return ok({ asset, from: { commit: fromRev, at: when(fromRev) }, to: { commit: toRev, at: when(toRev) }, diff: codec.diff(a, b) });
}

/** One change of the state of an asset. */
export type Change<D> = { readonly asset: string; readonly at: string; readonly commit: string; readonly first: boolean; readonly diff: D | undefined };

/** The changes of every asset's state since an instant (or all), newest first, each with its structured difference from the state before. */
export async function changesSince<S, D>(store: GitRefStore, codec: StateCodec<S, D>, o: { readonly since: string; readonly now: string }): Promise<Result<readonly Change<D>[], string>> {
  let after = 0;
  if (o.since !== "") {
    const span = parseSpan(o.since);
    if (span.kind === "err") return span;
    after = (instantMs(o.now) ?? Date.now()) - span.value;
  }
  const changes: Change<D>[] = [];
  for (const file of (await store.list("state")).filter((f) => f.endsWith(".json"))) {
    const asset = file.slice("state/".length, -".json".length);
    const history = await store.history(file);
    for (const [i, h] of history.entries()) {
      if (Date.parse(h.at) < after) continue;
      const prev = history[i + 1];
      const b = await stateAt(store, codec, asset, h.commit);
      const a = prev === undefined ? undefined : await stateAt(store, codec, asset, prev.commit);
      changes.push({ asset, at: h.at, commit: h.commit, first: prev === undefined, diff: a === undefined || b === undefined ? undefined : codec.diff(a, b) });
    }
  }
  return ok(changes.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : x.asset < y.asset ? -1 : 1)));
}

/** What was known of an asset at an instant: the state kept then, when it was last looked at, and how that look ended. */
export type Known<S> = { readonly asset: string; readonly state: S | undefined; readonly lastLookAt: string | undefined; readonly lastLook: string | undefined; readonly ageMs: number | undefined };

/** What was known at an instant: the state of each asset as the branch held it then, and the last look at it that the journal holds up to then. */
export async function knownAt<S, D>(store: GitRefStore, codec: StateCodec<S, D>, at: string): Promise<Result<{ readonly commit: string | undefined; readonly assets: readonly Known<S>[] }, string>> {
  const commit = await store.at(at);
  if (commit === undefined) return ok({ commit: undefined, assets: [] });
  // the journal of the whole branch, filtered by the instant: an entry is stamped and chained, so a batch committed later does not change what was known earlier
  const journal = await readJournal(store);
  if (journal.kind === "err") return err(journal.error);
  const limit = instantMs(at) ?? 0;
  const assets: Known<S>[] = [];
  for (const file of (await store.list("state", commit)).filter((f) => f.endsWith(".json"))) {
    const asset = file.slice("state/".length, -".json".length);
    const looks = journal.value.filter((e) => e.subject === asset && e.type.startsWith("capture.") && (instantMs(e.createdAt) ?? 0) <= limit);
    const last = looks.at(-1);
    assets.push({ asset, state: await stateAt(store, codec, asset, commit), lastLookAt: last?.createdAt, lastLook: last?.type, ageMs: last === undefined ? undefined : limit - (instantMs(last.createdAt) ?? 0) });
  }
  return ok({ commit, assets });
}

/** Whether the journal of the branch holds: its entries and its head, or the first entry that does not follow. */
export async function verifyJournalOf(store: GitRefStore, branch: string): Promise<Result<{ readonly entries: number; readonly head: string | undefined; readonly branch: string }, string>> {
  if ((await store.head()) === undefined) return err(`the branch ${branch} does not exist: nothing was captured`);
  const journal = await readJournal(store);
  return journal.kind === "err" ? journal : ok({ entries: journal.value.length, head: journal.value.at(-1)?.digest, branch });
}
