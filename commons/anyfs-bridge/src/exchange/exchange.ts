// Spec: 0007-bridge-exchange FR-003, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010
/**
 * The exchange of replicas through a medium. A medium is any store that can read, write and list, and needs nothing more: not a compare-and-swap, not a transaction. A replica publishes the rows it made as delta
 * files that are written once and never change, takes the files the others published, and is the same as they are when all of them have taken all. Every file is checked before it is taken (its name is its
 * identity, it is the directory's replica that made it), the replica judges it by its own trust, a file that waits for rows it does not hold is kept by the replica until they come, and a file that is not good is put aside and
 * told of, never half taken.
 *
 * @example
 * ```ts
 * import { memoryCursor, syncThrough } from "./mod.ts";
 * // const report = await syncThrough({ self, replica, medium, cursor: memoryCursor() });
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import {
  type Cursor as ListCursor,
  describeProblem,
  expectAbsent,
  expectAny,
  type MergeFinding,
  type MergeOutcome,
  type MergeRefusalKind,
  parseReplicaId,
  type Path,
  type Problem,
  type ReplicaId,
  type Version,
  type VersionVector,
} from "@intellectual-frontiers/anyfs/governance";
import type { Store } from "@intellectual-frontiers/anyfs/logical";
import { DEFAULT_LIMITS, decodeDelta, deltaId, encodeDelta, horizonOf, type Limits } from "@intellectual-frontiers/anyfs/merge";
import { type Cursor, type CursorState } from "./cursor.ts";
import { deltaPath, deltasPrefix, parseDeltaPath, parseVectorPath, vectorPath, vectorsPrefix } from "./names.ts";

/** A store that can be a medium: it reads, writes and lists. */
export type Medium = Store<"read" | "write" | "list">;
/** A medium that can also have what it holds removed. */
export type PrunableMedium = Store<"read" | "write" | "list" | "delete">;
/** A replica as the exchange sees it: it has the merge operations. */
export type Mergeable = Store<"merge">;

/** What the exchange does where checks are concerned: all of them, or (to show that the suite notices) none of its own. */
export type Checks = "all" | "none";

/** How a synchronization goes. */
export type ExchangeOptions = {
  /** Who this replica is. */
  readonly self: ReplicaId;
  readonly replica: Mergeable;
  readonly medium: Medium;
  readonly cursor: Cursor;
  /** The most rows in one delta file: 5,000 where not given. */
  readonly maxRows?: number;
  /** The reasons for which a refused file is put aside for good: every one but a trust that may change and a time that will pass. */
  readonly quarantine?: ReadonlySet<MergeRefusalKind>;
  readonly limits?: Limits;
  /** Whether the exchange checks a file's name and origin itself: `all` where not given. */
  readonly checks?: Checks;
  /** Whether to take the others' files: yes where not given (a replica may only publish). */
  readonly pull?: boolean;
  /** Whether to publish its own rows: yes where not given. */
  readonly publish?: boolean;
};

/** Why a synchronization could not be made at all: the medium or the replica failed. A file that fails is in the report, not here. */
export type ExchangeProblem = { readonly kind: "medium"; readonly problem: Problem } | { readonly kind: "replica"; readonly problem: Problem } | { readonly kind: "cursor"; readonly detail: string };

/** One sentence for a problem. */
export function describeExchangeProblem(p: ExchangeProblem): string {
  return p.kind === "cursor" ? `the cursor: ${p.detail}` : `the ${p.kind}: ${describeProblem(p.problem)}`;
}

/** A file published. */
export type Published = { readonly path: string; readonly versions: number; readonly blobs: number; readonly alreadyThere: boolean };

/** A file put aside or refused, and why. */
export type Aside = { readonly path: string; readonly reason: string; readonly kind: "quarantined" | "refused" | "unreadable" };

/** What was done with the files of the others. */
export type Pulled = {
  readonly applied: number;
  readonly duplicates: number;
  readonly deferred: number;
  readonly versions: number;
  readonly blobs: number;
  readonly aside: readonly Aside[];
  readonly findings: readonly MergeFinding[];
};

/** What a synchronization did. */
export type SyncReport = { readonly published: readonly Published[]; readonly pulled: Pulled; readonly vector: VersionVector };

const DEFAULT_QUARANTINE: ReadonlySet<MergeRefusalKind> = new Set<MergeRefusalKind>(["malformed", "too-large", "bad-sum", "bad-blob", "forged"]);
const DEFAULT_MAX_ROWS = 5000;
const enc = new TextEncoder();
const dec = new TextDecoder();

const sorted = <T>(xs: readonly T[], key: (x: T) => string): T[] => [...xs].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));

async function listAll(medium: Pick<Medium, "list">, prefix: ReturnType<typeof deltasPrefix>): Promise<Result<readonly string[], Problem>> {
  const out: string[] = [];
  let after: ListCursor | undefined;
  for (;;) {
    const page = await medium.list(prefix, after === undefined ? undefined : { after });
    if (page.kind === "err") return page;
    for (const e of page.value.entries) out.push(e.path);
    if (page.value.next === undefined) break;
    after = page.value.next;
  }
  return ok(out);
}

/**
 * Publishes the rows this replica made since the cursor, as delta files: one or more, of at most `maxRows` rows each, in the order of their numbers, each written once with the expectation that nothing is there (a
 * file that is already there is the same file, since its name is its identity). The cursor moves only after the files are written.
 */
export async function publishOwn(options: ExchangeOptions, state: CursorState): Promise<Result<{ readonly published: readonly Published[]; readonly cursor: CursorState }, ExchangeProblem>> {
  const { self, replica, medium } = options;
  const limits = options.limits ?? DEFAULT_LIMITS;
  const maxRows = Math.min(options.maxRows ?? DEFAULT_MAX_ROWS, limits.maxVersions);
  const vector = await replica.versionVector();
  if (vector.kind === "err") return err({ kind: "replica", problem: vector.error });
  const held = vector.value[self] ?? 0;
  if (held <= state.published) return ok({ published: [], cursor: state });
  const delta = await replica.deltaSince({ ...vector.value, [self]: state.published });
  if (delta.kind === "err") return err({ kind: "replica", problem: delta.error });
  const own = sorted(
    delta.value.versions.filter((v) => v.replica === self && v.seq > state.published),
    (v) => v.seq.toString().padStart(12, "0"),
  );
  const published: Published[] = [];
  let last = state.published;
  for (let i = 0; i < own.length; i += maxRows) {
    const rows: Version[] = own.slice(i, i + maxRows);
    const shas = new Set(rows.flatMap((v) => (v.blob === null ? [] : [v.blob])));
    const blobs = delta.value.blobs.filter((b) => shas.has(b.sha));
    const chunk = { ...delta.value, origin: self, versions: rows, blobs };
    const id = await deltaId(chunk);
    const first = rows[0] as Version;
    const end = rows[rows.length - 1] as Version;
    const path = deltaPath({ replica: self, from: first.seq, to: end.seq, id });
    if (path.kind === "err") return err({ kind: "cursor", detail: path.error });
    const w = await medium.write(path.value, enc.encode(encodeDelta(chunk)), expectAbsent);
    let alreadyThere = false;
    if (w.kind === "err") {
      if (w.error.kind !== "conflict") return err({ kind: "medium", problem: w.error });
      alreadyThere = true;
    }
    published.push({ path: path.value, versions: rows.length, blobs: blobs.length, alreadyThere });
    last = end.seq;
  }
  return ok({ published, cursor: { ...state, published: last } });
}

function refusedKind(o: MergeOutcome): MergeRefusalKind | undefined {
  return o.kind === "refused" ? o.refusal.kind : undefined;
}

/** Takes the delta files the others published and this replica has not taken: each is checked, judged by the replica and either taken whole, kept by the replica until it holds what the file waits for, or put aside. */
export async function pullOthers(options: ExchangeOptions, state: CursorState): Promise<Result<{ readonly pulled: Pulled; readonly cursor: CursorState }, ExchangeProblem>> {
  const { self, replica, medium } = options;
  const limits = options.limits ?? DEFAULT_LIMITS;
  const quarantine = options.quarantine ?? DEFAULT_QUARANTINE;
  const checks = options.checks ?? "all";
  const listed = await listAll(medium, deltasPrefix());
  if (listed.kind === "err") return err({ kind: "medium", problem: listed.error });
  const done = new Set([...state.applied, ...state.quarantined]);
  const applied = new Set(state.applied);
  const quarantined = new Set(state.quarantined);
  const aside: Aside[] = [];
  const findings: MergeFinding[] = [];
  let nApplied = 0;
  let duplicates = 0;
  let deferred = 0;
  let versions = 0;
  let blobs = 0;
  const files = sorted(
    listed.value.flatMap((path) => {
      const name = parseDeltaPath(path);
      return name.kind === "ok" && name.value.replica !== self && !done.has(path) ? [{ path, name: name.value }] : [];
    }),
    (f) => `${f.name.replica}/${f.name.from.toString().padStart(12, "0")}/${f.path}`,
  );
  for (const file of files) {
    const read = await medium.read(file.path as Path);
    if (read.kind === "err") {
      aside.push({ path: file.path, reason: describeProblem(read.error), kind: "unreadable" });
      continue;
    }
    const put = (kind: Aside["kind"], reason: string): void => {
      aside.push({ path: file.path, reason, kind });
      if (kind === "quarantined") quarantined.add(file.path);
    };
    const decoded = decodeDelta(dec.decode(read.value.bytes), limits);
    if (decoded.kind === "err") {
      put("quarantined", `the file is not a delta: ${decoded.error}`);
      continue;
    }
    if (checks === "all") {
      const id = await deltaId(decoded.value);
      if (id !== file.name.id) {
        put("quarantined", `the file is named by the identity ${file.name.id.slice(0, 12)} and holds the delta ${id.slice(0, 12)}`);
        continue;
      }
      if (decoded.value.origin !== file.name.replica) {
        put("quarantined", `the file is in the directory of replica ${file.name.replica} and the delta is from replica ${decoded.value.origin}`);
        continue;
      }
      const foreign = decoded.value.versions.find((v) => v.replica !== file.name.replica);
      if (foreign !== undefined) {
        put("quarantined", `the file of replica ${file.name.replica} holds the row ${foreign.id} of replica ${foreign.replica}`);
        continue;
      }
    }
    const taken = await replica.applyDelta(decoded.value);
    if (taken.kind === "err") return err({ kind: "replica", problem: taken.error });
    const outcome = taken.value;
    switch (outcome.kind) {
      case "applied":
        nApplied++;
        versions += outcome.versions;
        blobs += outcome.blobs;
        findings.push(...outcome.findings);
        applied.add(file.path);
        break;
      case "duplicate":
        duplicates++;
        applied.add(file.path);
        break;
      case "deferred":
        // the replica keeps the delta until the rows it waits for come: it is taken as far as the exchange is concerned
        deferred++;
        applied.add(file.path);
        break;
      case "refused": {
        const kind = refusedKind(outcome) as MergeRefusalKind;
        put(quarantine.has(kind) ? "quarantined" : "refused", `refused (${kind}): ${outcome.refusal.message}`);
        break;
      }
    }
  }
  const next: CursorState = { ...state, applied: [...applied], quarantined: [...quarantined] };
  return ok({ pulled: { applied: nApplied, duplicates, deferred, versions, blobs, aside, findings }, cursor: next });
}

/**
 * Brings a replica and a medium together: publishes the rows the replica made, takes the files of the others, and keeps the cursor. A second synchronization when nothing changed publishes nothing and takes nothing.
 */
export async function syncThrough(options: ExchangeOptions): Promise<Result<SyncReport, ExchangeProblem>> {
  const loaded = await options.cursor.load();
  if (loaded.kind === "err") return err({ kind: "cursor", detail: loaded.error });
  let state = loaded.value;
  let published: readonly Published[] = [];
  if (options.publish !== false) {
    const made = await publishOwn(options, state);
    if (made.kind === "err") return made;
    published = made.value.published;
    state = made.value.cursor;
  }
  let pulled: Pulled = { applied: 0, duplicates: 0, deferred: 0, versions: 0, blobs: 0, aside: [], findings: [] };
  if (options.pull !== false) {
    const took = await pullOthers(options, state);
    if (took.kind === "err") return took;
    pulled = took.value.pulled;
    state = took.value.cursor;
  }
  const saved = await options.cursor.save(state);
  if (saved.kind === "err") return err({ kind: "cursor", detail: saved.error });
  const vector = await options.replica.versionVector();
  if (vector.kind === "err") return err({ kind: "replica", problem: vector.error });
  return ok({ published, pulled, vector: vector.value });
}

/** What a synchronization would do, found without changing the replica or the medium. */
export type SyncPlan = { readonly toPublish: number; readonly toTake: readonly string[]; readonly vector: VersionVector };

/** What a synchronization would do: how many of the replica's own rows are not published yet, and which delta files of the others it has not taken. */
export async function planSync(options: ExchangeOptions): Promise<Result<SyncPlan, ExchangeProblem>> {
  const loaded = await options.cursor.load();
  if (loaded.kind === "err") return err({ kind: "cursor", detail: loaded.error });
  const vector = await options.replica.versionVector();
  if (vector.kind === "err") return err({ kind: "replica", problem: vector.error });
  const listed = await listAll(options.medium, deltasPrefix());
  if (listed.kind === "err") return err({ kind: "medium", problem: listed.error });
  const done = new Set([...loaded.value.applied, ...loaded.value.quarantined]);
  const toTake = sorted(
    listed.value.filter((path) => {
      const name = parseDeltaPath(path);
      return name.kind === "ok" && name.value.replica !== options.self && !done.has(path);
    }),
    (x) => x,
  );
  return ok({ toPublish: Math.max(0, (vector.value[options.self] ?? 0) - loaded.value.published), toTake, vector: vector.value });
}

/** The vectors the replicas published: for each replica, what it held when it last said so. */
export async function readVectors(medium: Pick<Medium, "list" | "read">): Promise<Result<Readonly<Record<string, VersionVector>>, ExchangeProblem>> {
  const listed = await listAll(medium, vectorsPrefix());
  if (listed.kind === "err") return err({ kind: "medium", problem: listed.error });
  const out: Record<string, VersionVector> = {};
  for (const path of listed.value) {
    const who = parseVectorPath(path);
    if (who.kind === "err") continue;
    const r = await medium.read(path as Path);
    if (r.kind === "err") return err({ kind: "medium", problem: r.error });
    try {
      const x = JSON.parse(dec.decode(r.value.bytes)) as { readonly format?: unknown; readonly replica?: unknown; readonly vector?: unknown };
      if (x.format === 1 && x.replica === who.value && typeof x.vector === "object" && x.vector !== null) {
        const v: Record<string, number> = {};
        for (const [k, n] of Object.entries(x.vector as Record<string, unknown>)) if (typeof n === "number" && Number.isSafeInteger(n) && n >= 0 && parseReplicaId(k).kind === "ok") v[k] = n;
        out[who.value] = v;
      }
    } catch {
      // a vector that is not JSON says nothing: the replica has not reported
    }
  }
  return ok(out);
}

/** Publishes the vector this replica holds, as the file of its own: the file is written again each time, and a replica only ever says what it holds. */
export async function publishVector(options: Pick<ExchangeOptions, "self" | "replica" | "medium">): Promise<Result<VersionVector, ExchangeProblem>> {
  const vector = await options.replica.versionVector();
  if (vector.kind === "err") return err({ kind: "replica", problem: vector.error });
  const text = JSON.stringify({ format: 1, replica: options.self, vector: Object.fromEntries(Object.entries(vector.value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) });
  const w = await options.medium.write(vectorPath(options.self), enc.encode(text), expectAny);
  return w.kind === "err" ? err({ kind: "medium", problem: w.error }) : ok(vector.value);
}

/** What pruning did. */
export type Pruned = { readonly removed: readonly string[]; readonly horizon: VersionVector };

/**
 * Removes the delta files that every replica of a roster has taken. Only where every replica of the roster has published its vector (the horizon of a roster is refused otherwise), and only the files whose rows are all
 * within the horizon: what a replica that is not on the roster has not taken is lost to it, so it must be given a new copy and not the old files.
 */
export async function pruneDeltas(medium: PrunableMedium, roster: readonly ReplicaId[]): Promise<Result<Pruned, ExchangeProblem | { readonly kind: "roster"; readonly detail: string }>> {
  const reports = await readVectors(medium);
  if (reports.kind === "err") return reports;
  const horizon = horizonOf(reports.value, roster);
  if (horizon.kind === "err") return err({ kind: "roster", detail: horizon.error });
  const listed = await listAll(medium, deltasPrefix());
  if (listed.kind === "err") return err({ kind: "medium", problem: listed.error });
  const removed: string[] = [];
  for (const path of listed.value) {
    const name = parseDeltaPath(path);
    if (name.kind === "err") continue;
    if (name.value.to > (horizon.value[name.value.replica] ?? 0)) continue;
    const d = await medium.delete(path as Path, expectAny);
    if (d.kind === "err") return err({ kind: "medium", problem: d.error });
    removed.push(path);
  }
  return ok({ removed: removed.sort(), horizon: horizon.value });
}
