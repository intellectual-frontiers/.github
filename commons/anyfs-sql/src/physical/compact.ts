// Spec: 0009-sql-compaction FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
/**
 * The collection of rows, and the epoch that makes it last. Rows are only ever added, so a database grows with every write and every delete; they can be collected only when every replica that matters has them, which is
 * known only from what each has said it holds. The horizon of a roster that has all reported is, for each replica, the least number of its rows that any of the roster holds, and a row whose number is covered is dead
 * unless the epoch keeps it: the heads of each path (what the files are made of) are kept, and a path whose only head is a delete is kept by nothing at all. The epoch is written down, and a trigger refuses a dead row that a SQL
 * import brings back, so that an old dump replayed afterwards cannot raise a file that was deleted and collected. An epoch is a record that can be published and adopted by another replica that holds all it covers.
 * A replica that will not return is retired: it is no longer trusted, and that is written down with who did it, when and why.
 *
 * @example
 * ```ts
 * import { compactDatabase } from "./compact.ts";
 * // const done = await compactDatabase(port, ctx, { reports, roster });
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { describeProblem, expectAbsent, parsePath, parsePrefix, parseReplicaId, type ReplicaId, type VersionVector } from "@intellectual-frontiers/anyfs/governance";
import type { Store } from "@intellectual-frontiers/anyfs/logical";
import { compareText, headsOf, horizonOf } from "@intellectual-frontiers/anyfs/merge";
import type { SqlPort, SqlRunner } from "@intellectual-frontiers/anyfs-sql/governance";
import { type Ctx, epochsOfDatabase, heldKeys, latestEpoch, runQ, execQ, stateOf, vectorOfDatabase } from "./merge.ts";
import { numberOf, textOf } from "./sql.ts";

/** An epoch as a record a replica can publish and another can adopt: who made it, what it covers, against which roster, what it keeps and the greatest id it collected. */
export type EpochProposal = {
  readonly format: 1;
  readonly proposer: ReplicaId;
  readonly horizon: VersionVector;
  readonly roster: readonly ReplicaId[];
  readonly retained: readonly string[];
  readonly bound: string;
};

/** What a collection did. */
export type Compacted = { readonly epoch: number; readonly horizon: VersionVector; readonly collected: number; readonly retained: number; readonly blobs: number; readonly proposal: EpochProposal };

/** What a replica says of what it holds, for each replica of the roster. */
export type CompactInput = { readonly reports: Readonly<Record<string, VersionVector>>; readonly roster: readonly ReplicaId[] };

const sortedVector = (v: VersionVector): Record<string, number> => Object.fromEntries(Object.entries(v).sort(([a], [b]) => compareText(a, b)));

/** The text of an epoch record: sorted, so that one epoch is one text. */
export function encodeEpoch(p: EpochProposal): string {
  return JSON.stringify({ format: 1, proposer: p.proposer, horizon: sortedVector(p.horizon), roster: [...p.roster].sort(compareText), retained: [...p.retained].sort(compareText), bound: p.bound });
}

/** The identity of an epoch record: the SHA-256 of its text. */
export const epochId = (p: EpochProposal): Promise<string> => sha256(encodeEpoch(p));

/** An epoch record from its text, or why it is not one. */
export function decodeEpoch(text: string): Result<EpochProposal, string> {
  let x: unknown;
  try {
    x = JSON.parse(text) as unknown;
  } catch {
    return err("an epoch is JSON");
  }
  if (typeof x !== "object" || x === null) return err("an epoch is an object");
  const o = x as { readonly [k: string]: unknown };
  const proposer = typeof o["proposer"] === "string" ? parseReplicaId(o["proposer"]) : err("an epoch names its proposer");
  if (proposer.kind === "err") return proposer;
  const horizon: Record<string, number> = {};
  if (typeof o["horizon"] !== "object" || o["horizon"] === null) return err("an epoch has a horizon");
  for (const [k, v] of Object.entries(o["horizon"] as Record<string, unknown>)) {
    if (parseReplicaId(k).kind === "err" || typeof v !== "number" || !Number.isSafeInteger(v) || v < 0) return err("the horizon of an epoch is a number for each replica");
    horizon[k] = v;
  }
  const strings = (v: unknown): readonly string[] | undefined => (Array.isArray(v) && v.every((e) => typeof e === "string") ? (v as string[]) : undefined);
  const roster = strings(o["roster"]);
  const retained = strings(o["retained"]);
  if (o["format"] !== 1 || roster === undefined || retained === undefined || typeof o["bound"] !== "string") return err("an epoch is format 1 with a roster, what it keeps and a bound");
  const ids: ReplicaId[] = [];
  for (const who of roster) {
    const id = parseReplicaId(who);
    if (id.kind === "err") return id;
    ids.push(id.value);
  }
  return ok({ format: 1, proposer: proposer.value, horizon, roster: ids, retained, bound: o["bound"] });
}

const BATCH = 500;

/** Collects the rows a horizon covers, but for the heads of the paths and what is also kept; writes the epoch. */
async function collect(port: SqlPort, c: Ctx, horizon: VersionVector, roster: readonly ReplicaId[], proposer: ReplicaId, keep: ReadonlySet<string>, given = ""): Promise<Result<Compacted, string>> {
  const previous = await latestEpoch(port, c);
  const merged: Record<string, number> = { ...(previous?.horizon ?? {}) };
  for (const [r, n] of Object.entries(horizon)) merged[r] = Math.max(merged[r] ?? 0, n);
  const covered = Object.entries(merged).filter(([, n]) => n > 0);
  if (covered.length === 0) return err("there is nothing to collect: no replica of the roster holds a row that every replica holds");
  // the heads that are covered are kept: they are what the files are made of; a path whose only head is a delete is kept by nothing
  const retained = new Set<string>(keep);
  const paths = new Set<string>();
  const headRows: { readonly id: string; readonly sum: string; readonly path: string; readonly kind: string }[] = [];
  for (const [replica, n] of covered) {
    for (const row of await runQ(port, c.l.selectCoveredHeads(replica, n))) {
      const h = { id: textOf(row["id"] ?? null), sum: textOf(row["sum"] ?? null), path: textOf(row["path"] ?? null), kind: textOf(row["kind"] ?? null) };
      headRows.push(h);
      paths.add(h.path);
    }
  }
  const headCount = new Map<string, number>();
  for (const path of paths) headCount.set(path, headsOf(await stateOf(port, c, [path]), path).length);
  for (const h of headRows) if (!(h.kind === "tombstone" && headCount.get(h.path) === 1)) retained.add(`${h.id}|${h.sum}`);
  const dead: { readonly id: string; readonly sum: string }[] = [];
  let bound = previous?.bound ?? "";
  if (given > bound) bound = given;
  for (const [replica, n] of covered) {
    for (const row of await runQ(port, c.l.selectCovered(replica, n))) {
      const id = textOf(row["id"] ?? null);
      const sum = textOf(row["sum"] ?? null);
      if (retained.has(`${id}|${sum}`)) continue;
      dead.push({ id, sum });
      if (id > bound) bound = id;
    }
  }
  const proposal: EpochProposal = { format: 1, proposer, horizon: merged, roster, retained: [...retained].sort(compareText), bound };
  const number = (previous?.n ?? 0) + 1;
  let blobs = 0;
  await port.transaction(async (tx: SqlRunner) => {
    for (let i = 0; i < dead.length; i += BATCH) for (const d of dead.slice(i, i + BATCH)) await execQ(tx, c.l.deleteVersion(d.id, d.sum));
    const before = numberOf((await runQ(tx, c.l.countBlobs()))[0]?.["n"] ?? null);
    await execQ(tx, c.l.deleteBlobsUnnamed());
    blobs = before - numberOf((await runQ(tx, c.l.countBlobs()))[0]?.["n"] ?? null);
    await execQ(tx, c.l.insertEpoch(number, JSON.stringify(sortedVector(merged)), JSON.stringify([...roster].sort(compareText)), JSON.stringify([...retained].sort(compareText)), bound));
  });
  return ok({ epoch: number, horizon: merged, collected: dead.length, retained: retained.size, blobs, proposal });
}

/**
 * Collects the rows that every replica of a roster holds. The roster must be known to be complete: every replica of it must have reported what it holds, and the refusal says who has not. The database's own report is
 * the one it makes now.
 */
export async function compactDatabase(port: SqlPort, c: Ctx, input: CompactInput): Promise<Result<Compacted, string>> {
  if (!input.roster.includes(c.replica)) return err(`this replica (${c.replica}) is not on the roster: a replica collects only against a roster it is part of`);
  const own = await vectorOfDatabase(port, c);
  const horizon = horizonOf({ ...input.reports, [c.replica]: own }, input.roster);
  if (horizon.kind === "err") return err(horizon.error);
  return collect(port, c, horizon.value, input.roster, c.replica, new Set());
}

/**
 * Takes an epoch another replica made: the proposer must be one the database takes changes from, and the database must hold every row the epoch covers (otherwise it is not caught up, and the refusal says which). The
 * database collects as the epoch says, and keeps the heads it has itself as well, so that a path never loses what it has not yet seen replaced.
 */
export async function adoptEpoch(port: SqlPort, c: Ctx, proposal: EpochProposal): Promise<Result<Compacted | "nothing", string>> {
  const trust = c.config.trust;
  if (trust.kind === "allowlist" && !trust.replicas.has(proposal.proposer)) return err(`the epoch is from replica ${proposal.proposer}, which this replica does not take changes from`);
  if (trust.kind === "signed") return err("an epoch is not signed: a replica that takes signed changes only does not adopt it");
  const own = await vectorOfDatabase(port, c);
  const behind = Object.entries(proposal.horizon).find(([r, n]) => (own[r] ?? 0) < n);
  if (behind !== undefined) {
    // a database made from a dump of a collected one holds the rows the epoch keeps and none of the rest: it is caught up all the same, for the rest are dead
    const ids = proposal.retained.map((k) => k.slice(0, k.indexOf("|")));
    const held = await heldKeys(port, c, ids);
    const missing = proposal.retained.filter((k) => !held.has(k));
    if (missing.length > 0 || proposal.retained.length === 0 && Object.keys(own).length > 0) {
      return err(`not caught up: the epoch covers rows of replica ${behind[0]} up to ${behind[1]} and this replica holds up to ${own[behind[0]] ?? 0}${missing.length > 0 ? `, and lacks ${missing.length} of the rows the epoch keeps` : ""}`);
    }
  }
  const previous = await latestEpoch(port, c);
  if (previous !== undefined && Object.entries(proposal.horizon).every(([r, n]) => (previous.horizon[r] ?? 0) >= n)) return ok("nothing");
  return collect(port, c, proposal.horizon, proposal.roster, proposal.proposer, new Set(proposal.retained), proposal.bound);
}

/** The epochs of the database, oldest first. */
export const epochsOf = (port: SqlPort, c: Ctx): ReturnType<typeof epochsOfDatabase> => epochsOfDatabase(port, c);

/** A replica that is no longer trusted: who retired it, when and why. */
export type Retired = { readonly replica: ReplicaId; readonly by: ReplicaId; readonly at: string; readonly reason: string };

/**
 * Retires a replica that will not return: it is no longer trusted (its rows are refused from now on, in a delta and by the trigger of an import), and the fact is written down. A replica cannot retire itself, and a
 * reason is required.
 */
export async function retireReplica(port: SqlPort, c: Ctx, replica: ReplicaId, reason: string, at: string): Promise<Result<Retired, string>> {
  if (replica === c.replica) return err("a replica does not retire itself");
  if (reason.trim() === "") return err("retiring a replica needs a reason");
  const record: Retired = { replica, by: c.replica, at, reason };
  await port.transaction(async (tx) => {
    await execQ(tx, c.l.deleteTrust(replica));
    await execQ(tx, c.l.insertRetired(replica, JSON.stringify(record)));
  });
  return ok(record);
}

/** The replicas that were retired, with who retired them and why. */
export async function retiredOf(port: SqlPort, c: Ctx): Promise<readonly Retired[]> {
  const out: Retired[] = [];
  for (const row of await runQ(port, c.l.selectRetired())) {
    try {
      const x = JSON.parse(textOf(row["value"] ?? null)) as { readonly replica?: unknown; readonly by?: unknown; readonly at?: unknown; readonly reason?: unknown };
      const replica = typeof x.replica === "string" ? parseReplicaId(x.replica) : undefined;
      const by = typeof x.by === "string" ? parseReplicaId(x.by) : undefined;
      if (replica?.kind === "ok" && by?.kind === "ok" && typeof x.at === "string" && typeof x.reason === "string") out.push({ replica: replica.value, by: by.value, at: x.at, reason: x.reason });
    } catch {
      // a record that is not JSON says nothing
    }
  }
  return out;
}

/** The path an epoch is published at: below `epochs/`, named by its identity, so that an epoch is one file wherever it is published. */
export async function epochPath(p: EpochProposal): Promise<Result<ReturnType<typeof parsePath> extends Result<infer P, string> ? P : never, string>> {
  return parsePath(`epochs/${await epochId(p)}.json`);
}

/** Publishes an epoch to a medium, written once; where it is there already it is the same file. */
export async function publishEpoch(medium: Store<"write">, p: EpochProposal): Promise<Result<string, string>> {
  const path = await epochPath(p);
  if (path.kind === "err") return path;
  const w = await medium.write(path.value, new TextEncoder().encode(encodeEpoch(p)), expectAbsent);
  if (w.kind === "err" && w.error.kind !== "conflict") return err(describeProblem(w.error));
  return ok(path.value);
}

/** What taking the epochs of a medium did: the epochs adopted, the ones this replica is not yet caught up for, and the files refused. */
export type AdoptedFromMedium = { readonly adopted: readonly Compacted[]; readonly waiting: readonly string[]; readonly refused: readonly string[] };

/**
 * Adopts the epochs a medium holds, oldest horizon first: each file must be the epoch its name says it is, and the database adopts it where it holds what it covers; an epoch it is not caught up for waits for a later
 * synchronization, and one it refuses (not from whom it takes changes) is reported.
 */
export async function adoptPublished(medium: Store<"read" | "list">, port: SqlPort, c: Ctx): Promise<Result<AdoptedFromMedium, string>> {
  const prefix = parsePrefix("epochs");
  if (prefix.kind === "err") return prefix;
  const files: string[] = [];
  const first = await medium.list(prefix.value);
  if (first.kind === "err") return err(describeProblem(first.error));
  let page = first.value;
  for (;;) {
    for (const e of page.entries) files.push(e.path);
    if (page.next === undefined) break;
    const more = await medium.list(prefix.value, { after: page.next });
    if (more.kind === "err") return err(describeProblem(more.error));
    page = more.value;
  }
  const proposals: { readonly path: string; readonly proposal: EpochProposal }[] = [];
  const refused: string[] = [];
  for (const file of files.sort(compareText)) {
    const path = parsePath(file);
    if (path.kind === "err") continue;
    const r = await medium.read(path.value);
    if (r.kind === "err") {
      refused.push(`${file}: ${describeProblem(r.error)}`);
      continue;
    }
    const decoded = decodeEpoch(new TextDecoder().decode(r.value.bytes));
    if (decoded.kind === "err" || `epochs/${await epochId(decoded.value)}.json` !== file) {
      refused.push(`${file}: ${decoded.kind === "err" ? decoded.error : "the file is not the epoch its name says"}`);
      continue;
    }
    proposals.push({ path: file, proposal: decoded.value });
  }
  const total = (p: EpochProposal): number => Object.values(p.horizon).reduce((a, b) => a + b, 0);
  proposals.sort((a, b) => total(a.proposal) - total(b.proposal) || compareText(a.path, b.path));
  const adopted: Compacted[] = [];
  const waiting: string[] = [];
  for (const { path, proposal } of proposals) {
    const r = await adoptEpoch(port, c, proposal);
    if (r.kind === "err") {
      (r.error.startsWith("not caught up") ? waiting : refused).push(`${path}: ${r.error}`);
      continue;
    }
    if (r.value !== "nothing") adopted.push(r.value);
  }
  return ok({ adopted, waiting, refused });
}
