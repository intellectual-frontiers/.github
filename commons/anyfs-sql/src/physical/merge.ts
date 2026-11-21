// Spec: 0007-sql-merge FR-001, FR-002, FR-003, FR-004
/**
 * What the database does of merging: the rows of a path as the pure model's state (so that the winner, the heads and the next id are the model's, not a second reading of them), the version vector and the delta since one, the
 * judgement of a delta (whom it is from, its checksums, its time, whether the database holds what its rows replace and the blobs its puts name, until it does the delta waits in the database) and its adding in one step,
 * and the check of every row and blob a database holds, whatever way they came: this is the check of a database that rows were put into by a SQL import, in front of which no check of ours stood.
 *
 * @example
 * ```ts
 * import { verifyDatabase } from "./merge.ts";
 * const findings = await verifyDatabase(port, ctx, Date.now());
 * ```
 *
 * @module
 */
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import {
  type BlobWire,
  DELTA_FORMAT,
  type Delta,
  type IdTime,
  type MergeFinding,
  type MergeOutcome,
  type MergeRefusal,
  parseReplicaId,
  parseVersionId,
  type ReplicaId,
  timeOfId,
  type Version,
  type VersionVector,
} from "@intellectual-frontiers/anyfs/governance";
import {
  compareText,
  compareVersions,
  decodeDelta,
  deltaId,
  encodeDelta,
  fromBase64,
  isSha,
  type MergeConfig,
  type MergeState,
  newState,
  toBase64,
  verifyVersion,
  versionKey,
  viewOf,
  withVersion,
} from "@intellectual-frontiers/anyfs/merge";
import type { SqlRow, SqlRunner } from "@intellectual-frontiers/anyfs-sql/governance";
import { CHUNK, type Layout } from "./layout.ts";
import { bytesOf, numberOf, type Query, textOf } from "./sql.ts";

/** What the merge needs of a store: the statements, who the replica is, what it is told that is not data, and whether the index of search is kept. */
export type Ctx = {
  readonly l: Layout;
  readonly replica: ReplicaId;
  readonly config: MergeConfig;
  readonly searching: boolean;
  readonly searchBytes: number;
};

export const runQ = async (r: SqlRunner, q: Query): Promise<readonly SqlRow[]> => {
  const st = q.done();
  return r.query(st.text, st.params);
};
export const execQ = async (r: SqlRunner, q: Query): Promise<void> => {
  const st = q.done();
  await r.exec(st.text, st.params);
};

/** A row read from the table of versions, as the version it is: the identities are parsed, so that a row that is not one is a failure and never a value. */
export function versionOfRow(row: SqlRow): Version {
  const id = parseVersionId(textOf(row["id"] ?? null));
  const replica = parseReplicaId(textOf(row["replica"] ?? null));
  if (id.kind === "err") throw new Error(`the database holds a row whose id is not one: ${id.error}`);
  if (replica.kind === "err") throw new Error(`the database holds a row whose replica is not one: ${replica.error}`);
  const parentText = row["parent"] ?? null;
  const parent = parentText === null ? null : parseVersionId(textOf(parentText));
  if (parent !== null && parent.kind === "err") throw new Error(`the database holds a row whose parent is not an id: ${parent.error}`);
  let mergedList: unknown;
  try {
    mergedList = JSON.parse(textOf(row["merged"] ?? null));
  } catch {
    throw new Error(`the database holds a row whose merged ids are not a JSON list`);
  }
  if (!Array.isArray(mergedList)) throw new Error("the database holds a row whose merged ids are not a list");
  const merged = (mergedList as unknown[]).map((m) => {
    const p = typeof m === "string" ? parseVersionId(m) : undefined;
    if (p === undefined || p.kind === "err") throw new Error("the database holds a row that merges with something that is not an id");
    return p.value;
  });
  const kind = textOf(row["kind"] ?? null);
  if (kind !== "put" && kind !== "tombstone") throw new Error(`the database holds a row of kind ${JSON.stringify(kind)}`);
  const blobText = row["blob"] ?? null;
  return {
    id: id.value,
    replica: replica.value,
    seq: numberOf(row["seq"] ?? null),
    path: textOf(row["path"] ?? null),
    parent: parent === null ? null : parent.value,
    merged,
    kind,
    blob: blobText === null ? null : textOf(blobText),
    sum: textOf(row["sum"] ?? null),
  };
}

/** The state of the replica, as far as the paths it is given: their rows, and the clock and the number of the replica taken from every row the database holds. */
export async function stateOf(r: SqlRunner, c: Ctx, paths: readonly string[]): Promise<MergeState> {
  let state = newState(c.replica, c.config);
  for (const path of new Set(paths)) for (const row of await runQ(r, c.l.selectRowsOfPath(path))) state = withVersion(state, versionOfRow(row));
  const last = (await runQ(r, c.l.selectLastId()))[0]?.["id"] ?? null;
  const seq = (await runQ(r, c.l.selectLastSeq(c.replica)))[0]?.["seq"] ?? null;
  let time: IdTime | undefined = state.last;
  if (last !== null) {
    const id = parseVersionId(textOf(last));
    if (id.kind === "ok") {
      const t = timeOfId(id.value);
      if (time === undefined || t.ms > time.ms || (t.ms === time.ms && t.counter > time.counter)) time = t;
    }
  }
  return { ...state, last: time, ownSeq: Math.max(state.ownSeq, seq === null ? 0 : numberOf(seq)) };
}

/** An epoch as the database holds it: how far the rows are collected (a horizon), against which roster, which covered rows it keeps (as keys) and the greatest id it collected. */
export type EpochRow = { readonly n: number; readonly horizon: VersionVector; readonly roster: readonly ReplicaId[]; readonly retained: readonly string[]; readonly bound: string };

const numbersOf = (text: string): VersionVector => {
  try {
    const x = JSON.parse(text) as unknown;
    if (typeof x !== "object" || x === null) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) if (typeof v === "number" && Number.isSafeInteger(v) && v >= 0) out[k] = v;
    return out;
  } catch {
    return {};
  }
};

const listOf = (text: string): readonly string[] => {
  try {
    const x = JSON.parse(text) as unknown;
    return Array.isArray(x) ? x.filter((e): e is string => typeof e === "string") : [];
  } catch {
    return [];
  }
};

/** The epochs the database holds, oldest first. */
export async function epochsOfDatabase(r: SqlRunner, c: Ctx): Promise<readonly EpochRow[]> {
  const out: EpochRow[] = [];
  for (const row of await runQ(r, c.l.selectEpochs())) {
    const roster: ReplicaId[] = [];
    for (const who of listOf(textOf(row["roster"] ?? null))) {
      const id = parseReplicaId(who);
      if (id.kind === "ok") roster.push(id.value);
    }
    out.push({ n: numberOf(row["n"] ?? null), horizon: numbersOf(textOf(row["horizon"] ?? null)), roster, retained: listOf(textOf(row["retained"] ?? null)), bound: textOf(row["bound"] ?? null) });
  }
  return out;
}

/** The newest epoch, or nothing where no rows were ever collected. */
export async function latestEpoch(r: SqlRunner, c: Ctx): Promise<EpochRow | undefined> {
  const all = await epochsOfDatabase(r, c);
  return all[all.length - 1];
}

/**
 * The version vector of the database: for each replica, the number of its last row held with none missing before it. Where rows were collected, what an epoch covers counts as held, so the numbers start from its
 * horizon: the rows above it are walked from there.
 */
export async function vectorOfDatabase(r: SqlRunner, c: Ctx): Promise<VersionVector> {
  const out: Record<string, number> = {};
  for (const row of await runQ(r, c.l.selectVector())) out[textOf(row["replica"] ?? null)] = numberOf(row["n"] ?? null);
  const epoch = await latestEpoch(r, c);
  if (epoch === undefined) return out;
  for (const [replica, floor] of Object.entries(epoch.horizon)) {
    let n = floor;
    for (const row of await runQ(r, c.l.selectSeqsAbove(replica, floor))) {
      const seq = numberOf(row["seq"] ?? null);
      if (seq === n + 1) n = seq;
      else if (seq > n + 1) break;
    }
    if (n > 0) out[replica] = n;
  }
  return out;
}

const chunks = <T>(items: readonly T[], size: number): readonly (readonly T[])[] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/** The delta of what the database holds that a replica holding `since` does not: the rows past it and the blobs their puts name. */
export async function deltaOfDatabase(r: SqlRunner, c: Ctx, since: VersionVector): Promise<Delta> {
  const rows = (await runQ(r, c.l.selectRowsSince(since))).map(versionOfRow).sort(compareVersions);
  const shas = [...new Set(rows.flatMap((v) => (v.blob === null ? [] : [v.blob])))].sort(compareText);
  const blobs: BlobWire[] = [];
  for (const sha of shas) {
    const found = (await runQ(r, c.l.selectBlob(sha)))[0];
    if (found !== undefined) blobs.push({ sha, bytes: toBase64(bytesOf(found["bytes"] ?? null)) });
  }
  return { format: DELTA_FORMAT, origin: c.replica, versions: rows, blobs };
}

const refused = (kind: MergeRefusal["kind"], message: string): MergeOutcome => ({ kind: "refused", refusal: { kind, message } });

async function heldIds(r: SqlRunner, c: Ctx, ids: readonly string[]): Promise<ReadonlySet<string>> {
  const held = new Set<string>();
  for (const part of chunks([...new Set(ids)], CHUNK)) for (const row of await runQ(r, c.l.selectRowsOfIds(part))) held.add(textOf(row["id"] ?? null));
  return held;
}

export async function heldKeys(r: SqlRunner, c: Ctx, ids: readonly string[]): Promise<ReadonlySet<string>> {
  const held = new Set<string>();
  for (const part of chunks([...new Set(ids)], CHUNK)) for (const row of await runQ(r, c.l.selectRowsOfIds(part))) held.add(`${textOf(row["id"] ?? null)}|${textOf(row["sum"] ?? null)}`);
  return held;
}

async function heldBlobs(r: SqlRunner, c: Ctx, shas: readonly string[]): Promise<ReadonlySet<string>> {
  const held = new Set<string>();
  for (const part of chunks([...new Set(shas)], CHUNK)) for (const row of await runQ(r, c.l.selectBlobsHeld(part))) held.add(textOf(row["sha"] ?? null));
  return held;
}

/** The findings a row just added makes: another row of its id, or of its number in its replica's rows. */
async function findingsOfRows(r: SqlRunner, c: Ctx, added: readonly Version[]): Promise<readonly MergeFinding[]> {
  const out: MergeFinding[] = [];
  for (const v of added) {
    if ((await runQ(r, c.l.selectRowsOfIds([v.id]))).length > 1) out.push({ kind: "duplicate-id", subject: v.id, message: `the id ${v.id} is on more than one row, with different sums` });
    if ((await runQ(r, c.l.selectRowsOfSeq(v.replica, v.seq))).length > 1) out.push({ kind: "duplicate-seq", subject: `${v.replica}#${v.seq}`, message: `replica ${v.replica} made number ${v.seq} twice, with different rows` });
  }
  return out;
}

/** What judging a delta ended with: the outcome, and the paths whose files it may have changed. */
export type Judged = { readonly outcome: MergeOutcome; readonly paths: readonly string[] };

/**
 * Judges a delta and, where it is applied, adds its blobs and rows in the transaction the runner is: the trust, the checksums, the clock, whether the database holds what it needs. A delta that has to wait is kept in the
 * database until what it waits for arrives.
 */
export async function judgeDelta(r: SqlRunner, c: Ctx, delta: Delta, wall: number): Promise<Judged> {
  const none = (outcome: MergeOutcome): Judged => ({ outcome, paths: [] });
  const { config } = c;
  if (delta.versions.length > config.limits.maxVersions) return none(refused("too-large", `a delta of ${delta.versions.length} rows: at most ${config.limits.maxVersions}`));
  const replicas = new Set<ReplicaId>([delta.origin, ...delta.versions.map((v) => v.replica)]);
  switch (config.trust.kind) {
    case "open":
      break;
    case "allowlist":
      for (const who of replicas) if (!config.trust.replicas.has(who)) return none(refused("trust", `replica ${who} is not one this replica takes changes from`));
      break;
    case "signed": {
      const id = await deltaId(delta);
      if (delta.signature === undefined || !config.trust.verify(id, delta.signature, delta.origin)) return none(refused("trust", `the delta ${id.slice(0, 12)} has no signature the replica accepts`));
      break;
    }
  }
  const blobs = new Map<string, Uint8Array>();
  for (const b of delta.blobs) {
    const bytes = fromBase64(b.bytes);
    if (bytes === undefined) return none(refused("malformed", `the bytes of blob ${b.sha.slice(0, 12)} are not base64`));
    if (bytes.length > config.limits.maxBlobBytes) return none(refused("too-large", `a blob of ${bytes.length} bytes: at most ${config.limits.maxBlobBytes}`));
    if ((await sha256(bytes)) !== b.sha) return none(refused("bad-blob", `the bytes of blob ${b.sha.slice(0, 12)} are not the bytes it is named by`));
    blobs.set(b.sha, bytes);
  }
  for (const v of delta.versions) {
    const why = await verifyVersion(v);
    if (why !== undefined) return none(refused(why.includes("sum") ? "bad-sum" : "malformed", why));
    if (v.path.length > config.limits.maxPathChars) return none(refused("too-large", `a path of ${v.path.length} characters: at most ${config.limits.maxPathChars}`));
    if (timeOfId(v.id).ms > wall + config.maxDrift) return none(refused("future-id", `the id ${v.id} is more than ${config.maxDrift} ms ahead of the wall time ${wall}`));
  }
  const keysHeld = await heldKeys(r, c, delta.versions.map((v) => v.id));
  const blobsHeld = await heldBlobs(r, c, delta.blobs.map((b) => b.sha));
  if (delta.versions.every((v) => keysHeld.has(versionKey(v))) && delta.blobs.every((b) => blobsHeld.has(b.sha))) return none({ kind: "duplicate" });
  const inDelta = new Set(delta.versions.map((v) => v.id as string));
  const wanted = delta.versions.flatMap((v) => [...(v.parent === null ? [] : [v.parent]), ...v.merged]).filter((id) => !inDelta.has(id));
  const idsHeld = await heldIds(r, c, wanted);
  const bound = (await latestEpoch(r, c))?.bound ?? "";
  const missing = new Set<string>();
  // a row that an epoch collected is not waited for: its id is not above the greatest id the epoch collected
  for (const id of wanted) if (!idsHeld.has(id) && !(bound !== "" && id <= bound)) missing.add(`version ${id}`);
  const needBlobs = delta.versions.flatMap((v) => (v.blob === null || blobs.has(v.blob) ? [] : [v.blob]));
  const needHeld = await heldBlobs(r, c, needBlobs);
  for (const sha of needBlobs) if (!needHeld.has(sha)) missing.add(`blob ${sha}`);
  if (missing.size > 0) return none({ kind: "deferred", missing: [...missing].sort(compareText) });
  let newBlobs = 0;
  for (const [sha, bytes] of blobs) if ((await runQ(r, c.l.insertBlob(sha, bytes))).length > 0) newBlobs++;
  const added: Version[] = [];
  for (const v of delta.versions) if ((await runQ(r, c.l.insertVersion(v))).length > 0) added.push(v);
  const findings = await findingsOfRows(r, c, added);
  return { outcome: { kind: "applied", versions: added.length, blobs: newBlobs, findings }, paths: delta.versions.map((v) => v.path) };
}

/** What taking a delta ended with, and the paths whose files may have changed. */
export type Taken = Judged;

/**
 * Takes a delta into the database. Where the delta is applied, the deltas held back are tried again, for what this one brought may be what they waited for; where it has to wait, it is kept in the database.
 */
export async function takeDelta(r: SqlRunner, c: Ctx, delta: Delta, wall: number): Promise<Taken> {
  const first = await judgeDelta(r, c, delta, wall);
  if (first.outcome.kind === "deferred") {
    await execQ(r, c.l.insertPending(await deltaId(delta), encodeDelta(delta)));
    return first;
  }
  if (first.outcome.kind !== "applied") return first;
  let versions = first.outcome.versions;
  let blobs = first.outcome.blobs;
  let findings = [...first.outcome.findings];
  const paths = new Set(first.paths);
  for (let progress = true; progress; ) {
    progress = false;
    for (const row of await runQ(r, c.l.selectPending())) {
      const key = textOf(row["key"] ?? null);
      const held = decodeDelta(textOf(row["value"] ?? null), c.config.limits);
      if (held.kind === "err") {
        await execQ(r, c.l.deletePending(key));
        continue;
      }
      const again = await judgeDelta(r, c, held.value, wall);
      if (again.outcome.kind === "deferred") continue;
      await execQ(r, c.l.deletePending(key));
      if (again.outcome.kind === "applied") {
        versions += again.outcome.versions;
        blobs += again.outcome.blobs;
        findings = [...findings, ...again.outcome.findings];
        for (const p of again.paths) paths.add(p);
        progress = true;
        break;
      }
    }
  }
  return { outcome: { kind: "applied", versions, blobs, findings }, paths: [...paths] };
}

/** The pages a check reads at a time. */
const PAGE = 2000;

/**
 * What is wrong with the rows and blobs the database holds, whatever way they came: a row that is not its checksum, an id that is not an id, a row of a replica the trust does not name, an id from the far future, an id or a number
 * on two rows, a parent or a blob that is not there, bytes that are not the hash they are named by. This is the check of a database that rows were put into by a SQL import, in front of which no check of ours stood.
 */
export async function verifyDatabase(r: SqlRunner, c: Ctx, wall: number): Promise<readonly MergeFinding[]> {
  const out: MergeFinding[] = [];
  const trust = c.config.trust;
  const bound = (await latestEpoch(r, c))?.bound ?? "";
  let after: { readonly id: string; readonly sum: string } | undefined;
  for (;;) {
    const page = await runQ(r, c.l.selectVersionsPage(after, PAGE));
    if (page.length === 0) break;
    const refs: string[] = [];
    const owners = new Map<string, string[]>();
    for (const row of page) {
      const id = textOf(row["id"] ?? null);
      let v: Version;
      try {
        v = versionOfRow(row);
      } catch (thrown) {
        out.push({ kind: "bad-id", subject: id, message: thrown instanceof Error ? thrown.message : String(thrown) });
        continue;
      }
      const why = await verifyVersion(v);
      if (why !== undefined) out.push({ kind: why.includes("sum") ? "bad-sum" : "bad-id", subject: v.id, message: why });
      if (trust.kind === "allowlist" && !trust.replicas.has(v.replica)) out.push({ kind: "untrusted-replica", subject: v.id, message: `the row ${v.id} is from replica ${v.replica}, which this replica does not take changes from` });
      if (timeOfId(v.id).ms > wall + c.config.maxDrift) out.push({ kind: "future-id", subject: v.id, message: `the id ${v.id} is more than ${c.config.maxDrift} ms ahead of the wall time ${wall}` });
      for (const p of [...(v.parent === null ? [] : [v.parent]), ...v.merged]) {
        refs.push(p);
        owners.set(p, [...(owners.get(p) ?? []), v.id]);
      }
    }
    const held = await heldIds(r, c, refs);
    for (const ref of new Set(refs)) if (!held.has(ref) && !(bound !== "" && ref <= bound)) for (const who of owners.get(ref) ?? []) out.push({ kind: "dangling-parent", subject: who, message: `the row ${who} replaces ${ref}, which is not held` });
    const last = page[page.length - 1];
    if (last === undefined || page.length < PAGE) break;
    after = { id: textOf(last["id"] ?? null), sum: textOf(last["sum"] ?? null) };
  }
  for (const row of await runQ(r, c.l.selectMissingBlobs(1000))) out.push({ kind: "missing-blob", subject: textOf(row["id"] ?? null), message: `the row ${textOf(row["id"] ?? null)} names the blob ${textOf(row["ref"] ?? null)}, which is not held` });
  for (const row of await runQ(r, c.l.selectDuplicateIds(1000))) out.push({ kind: "duplicate-id", subject: textOf(row["subject"] ?? null), message: `the id ${textOf(row["subject"] ?? null)} is on more than one row, with different sums` });
  for (const row of await runQ(r, c.l.selectDuplicateSeqs(1000))) {
    const subject = `${textOf(row["replica"] ?? null)}#${numberOf(row["seq"] ?? null)}`;
    out.push({ kind: "duplicate-seq", subject, message: `replica ${textOf(row["replica"] ?? null)} made number ${numberOf(row["seq"] ?? null)} twice, with different rows` });
  }
  let blobAfter: string | undefined;
  for (;;) {
    const page = await runQ(r, c.l.selectBlobsPage(blobAfter, 200));
    if (page.length === 0) break;
    for (const row of page) {
      const sha = textOf(row["sha"] ?? null);
      if (!isSha(sha) || (await sha256(bytesOf(row["bytes"] ?? null))) !== sha) out.push({ kind: "bad-blob", subject: sha, message: `the bytes of blob ${sha.slice(0, 12)} are not the bytes it is named by` });
    }
    const last = page[page.length - 1];
    if (last === undefined || page.length < 200) break;
    blobAfter = textOf(last["sha"] ?? null);
  }
  return out;
}

/** The heads of a path that did not win, as the siblings: read from the rows of the path with the pure model. */
export async function siblingsOfPath(r: SqlRunner, c: Ctx, path: string): Promise<readonly Version[]> {
  return viewOf(await stateOf(r, c, [path]), path).siblings;
}
