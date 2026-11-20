// Spec: 0060-flow-ledger FR-006, FR-007, FR-008, FR-009, FR-010, FR-011
/**
 * The flow ledger at work (commons data 0060-flow-ledger): the code that writes and reads the tables of the flow model (`models/flow`). A load is opened and its id is carried on every row and effect; each stage's
 * confirmation is a row of the ledger, only ever added; the intake of a delivery says whether it is the first, a duplicate or a conflict, never overwriting; a gap query finds what vanished between two stages; the funnel
 * of a manifest says how many entities are unexplained and at which boundary between stages; and a load is undone by its id across the tables it wrote.
 *
 * @module
 */
import { sha256Hex } from "@intellectual-frontiers/data/sql/lifecycle";
import { and, asc, eq, from, inList, insertInto, type Runner, type Table, update, add, deleteFrom, desc } from "@intellectual-frontiers/data/sql/typed";
import { flow } from "@intellectual-frontiers/data/sql/typed/models";

const { batchStage, delivery, deliveryConflict, ledgerEntry, load, loss, manifest } = flow;

/** The stages in the order of a pipeline. */
export const STAGES = ["received", "captured", "parsed", "mapped", "validated", "forwarded", "dest_verdict", "usable"] as const;
/** A stage. */
export type Stage = (typeof STAGES)[number];
/** What a stage confirmed. */
export type Outcome = "passed" | "failed" | "rejected" | "accepted" | "unusable";
/** Why a load was made. */
export type LoadType = "delivery" | "backfill" | "incremental" | "replay";

let counter = 0;
const newId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** What opening a load is told. */
export interface OpenLoad {
  readonly loadType: LoadType;
  readonly source: string;
  readonly tenant?: string;
  /** The id, where the caller gives it; made where not. */
  readonly loadId?: string;
  readonly now?: () => Date;
}

/**
 * Opens a load: an id given at the first stage, to be carried on every row and effect it makes.
 *
 * @returns the load's id
 */
export async function openLoad(on: Runner, spec: OpenLoad): Promise<string> {
  const loadId = spec.loadId ?? newId("load");
  await insertInto(load).values({ loadId, loadType: spec.loadType, source: spec.source, startedAt: (spec.now ?? (() => new Date()))().toISOString(), ...(spec.tenant === undefined ? {} : { tenant: spec.tenant }) }).run(on);
  return loadId;
}

/** What one stage confirmed of one thing. */
export interface Confirmation {
  readonly loadId: string;
  readonly subject: string;
  readonly stage: Stage;
  readonly outcome: Outcome;
  readonly grain?: "message" | "batch" | "entity";
  readonly entities?: number;
  /** The code of the reason, where it did not pass. */
  readonly reason?: string;
  readonly at?: string;
}

/**
 * Adds rows to the ledger: what each stage confirmed. A row is only ever added; the id of a row is its load, subject and stage, so that the same confirmation twice is refused by the database.
 *
 * @param rows - the confirmations
 */
export async function confirm(on: Runner, rows: readonly Confirmation[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200).map((r) => ({
      ledgerEntryId: `${r.loadId}/${r.subject}/${r.stage}`,
      subject: r.subject,
      stage: r.stage,
      outcome: r.outcome,
      grain: r.grain ?? "message",
      at: r.at ?? new Date().toISOString(),
      loadId: r.loadId,
      entities: r.entities ?? null,
      reasonId: r.reason ?? null,
    }));
    if (batch.length > 0) await insertInto(ledgerEntry).values(batch as never).run(on);
  }
}

/** What the intake of a delivery found. */
export interface Intake {
  readonly disposition: "first" | "duplicate" | "conflict";
  /** How many times this message has been delivered with the content it first had. */
  readonly deliveryCount: number;
}

/** What an intake is given. */
export interface Delivery {
  readonly loadId: string;
  readonly tenant: string;
  /** The id the sender gave the message. */
  readonly senderMessageId: string;
  /** The content, or its SHA-256 as hex where the caller has it. */
  readonly content?: string;
  readonly sha256?: string;
  readonly now?: () => Date;
}

/**
 * The idempotent intake of a delivery. The first time a message is seen it is `first` and the caller makes its effect; the same message with the same content again is `duplicate`, counted and no effect; the same id with other content
 * is a `conflict`, queued and never overwriting the original. The database's key is what keeps two racing deliveries to one first. Call it outside a transaction (a refused insert ends one on some engines).
 */
export async function intake(on: Runner, d: Delivery): Promise<Intake> {
  const sha = d.sha256 ?? sha256Hex(d.content ?? "");
  const deliveryId = `${d.tenant}/${d.senderMessageId}`;
  const at = (d.now ?? (() => new Date()))().toISOString();
  try {
    await insertInto(delivery).values({ deliveryId, tenant: d.tenant, senderMessageId: d.senderMessageId, contentSha256: sha, deliveryCount: 1, firstSeen: at, firstLoadLoadId: d.loadId }).run(on);
    return { disposition: "first", deliveryCount: 1 };
  } catch (thrown) {
    const there = await from(delivery).where((s) => eq(s.delivery.deliveryId, deliveryId)).select((s) => ({ sha: s.delivery.contentSha256, n: s.delivery.deliveryCount })).first(on);
    if (there === undefined) throw thrown;
    if (there.sha === sha) {
      const rows = await update(delivery).set((c) => ({ deliveryCount: add(c.deliveryCount, 1) })).where((c) => and(eq(c.deliveryId, deliveryId), eq(c.contentSha256, sha))).returning((c) => ({ n: c.deliveryCount })).run(on);
      return { disposition: "duplicate", deliveryCount: rows[0]?.n ?? there.n + 1 };
    }
    try {
      await insertInto(deliveryConflict).values({ deliveryConflictId: `${deliveryId}#${sha.slice(0, 16)}`, incomingSha256: sha, status: "open", seenAt: at, deliveryId, loadId: d.loadId }).run(on);
    } catch {
      // the same conflicting content again: it is queued already
    }
    return { disposition: "conflict", deliveryCount: there.n };
  }
}

/** The last stage that confirmed a subject. */
export interface LastConfirmed {
  readonly subject: string;
  readonly stage: Stage;
  readonly outcome: Outcome;
  readonly loadId: string;
}

/**
 * For each subject, the last stage that confirmed it and what it said: the answer to "which stage last confirmed this message".
 *
 * @param loadId - only this load's subjects; every load's where not given
 */
export async function lastConfirmed(on: Runner, loadId?: string): Promise<readonly LastConfirmed[]> {
  const rows = await from(ledgerEntry)
    .where((s) => (loadId === undefined ? and() : eq(s.ledgerEntry.loadId, loadId)))
    .select((s) => ({ subject: s.ledgerEntry.subject, stage: s.ledgerEntry.stage, outcome: s.ledgerEntry.outcome, loadId: s.ledgerEntry.loadId }))
    .orderBy((_, o) => [asc(o.subject)])
    .run(on);
  const best = new Map<string, LastConfirmed>();
  for (const r of rows) {
    const at = STAGES.indexOf(r.stage as Stage);
    const have = best.get(r.subject);
    if (have === undefined || at > STAGES.indexOf(have.stage)) best.set(r.subject, { subject: r.subject, stage: r.stage as Stage, outcome: r.outcome as Outcome, loadId: r.loadId });
  }
  return [...best.values()];
}

/**
 * The subjects that vanished: whose last confirmation is a stage that passed and which have no row after it, although the stage is not the last of the pipeline and nothing said they were refused.
 *
 * @param after - the stage after which a subject is expected to have a row (the last stage a pipeline always confirms), `captured` where not given
 */
export async function gaps(on: Runner, after: Stage = "captured", loadId?: string): Promise<readonly string[]> {
  return (await lastConfirmed(on, loadId)).filter((l) => l.stage === after && l.outcome === "passed" && l.stage !== STAGES[STAGES.length - 1]).map((l) => l.subject);
}

/** The funnel of one batch: from what the sender said to what was accepted, with where it went missing. */
export interface Funnel {
  readonly manifestId: string;
  readonly manifestCount: number;
  /** The entities the destination accepted. */
  readonly accepted: number;
  /** The entities that stopped, with a reason. */
  readonly lost: number;
  /** What is neither accepted nor lost with a reason: it must be 0. */
  readonly unexplained: number;
  /** The boundary between two stages at which entities went missing without a reason, with how many. */
  readonly boundaries: readonly { readonly before: Stage | "manifest"; readonly after: Stage; readonly missing: number }[];
}

/**
 * Reconciles batches to what their senders say: for each manifest, the entities accepted at the stage of the destination's verdict and the entities lost with a reason must add up to the manifest, and where they do not the
 * entities that went missing are attributed to the boundary between the two stages where the count fell without a loss to account for it.
 *
 * @param manifests - the batches to reconcile; every batch where not given
 * @param acceptedAt - the stage whose count is what was accepted; `dest_verdict` where not given
 */
export async function funnel(on: Runner, manifests?: readonly string[], acceptedAt: Stage = "dest_verdict"): Promise<readonly Funnel[]> {
  const ms = await from(manifest).where((s) => (manifests === undefined ? and() : inList(s.manifest.manifestId, manifests))).select((s) => ({ id: s.manifest.manifestId, n: s.manifest.manifestCount })).orderBy((_, o) => [asc(o.id)]).run(on);
  if (ms.length === 0) return [];
  const ids = ms.map((m) => m.id);
  const counts = await from(batchStage).where((s) => inList(s.batchStage.manifestId, ids)).select((s) => ({ m: s.batchStage.manifestId, stage: s.batchStage.stage, n: s.batchStage.entities })).run(on);
  const losses = await from(loss).where((s) => inList(s.loss.manifestId, ids)).select((s) => ({ m: s.loss.manifestId, stage: s.loss.stage, n: s.loss.entities })).run(on);
  return ms.map((m): Funnel => {
    const at = new Map(counts.filter((c) => c.m === m.id).map((c) => [c.stage as Stage, c.n]));
    const lost = losses.filter((l) => l.m === m.id);
    const accepted = at.get(acceptedAt) ?? 0;
    const lostTotal = lost.reduce((n, l) => n + l.n, 0);
    const boundaries: { before: Stage | "manifest"; after: Stage; missing: number }[] = [];
    let before: Stage | "manifest" = "manifest";
    let prev = m.n;
    for (const s of STAGES.slice(0, STAGES.indexOf(acceptedAt) + 1)) {
      const here = at.get(s);
      if (here === undefined) continue;
      const stopped = lost.filter((l) => l.stage === s).reduce((n, l) => n + l.n, 0);
      const missing = prev - here - stopped;
      if (missing !== 0) boundaries.push({ before, after: s, missing });
      before = s;
      prev = here;
    }
    return { manifestId: m.id, manifestCount: m.n, accepted, lost: lostTotal, unexplained: m.n - (accepted + lostTotal), boundaries };
  });
}

/** What undoing a load did. */
export interface Rollback {
  readonly loadId: string;
  /** The rows removed from each table, by the table's name. */
  readonly removed: Readonly<Record<string, number>>;
}

/** A table a load wrote to, and the column that holds the load's id. */
export interface Written {
  readonly table: Table<never, never, string>;
  readonly column: string;
}

/** A table a load wrote to and its column of the load's id (a key of its row). */
export const written = <R, I, N extends string>(table: Table<R, I, N>, column: keyof R & string): Written => ({ table: table as unknown as Table<never, never, string>, column });

/**
 * Undoes a load by its id: the rows it wrote are removed from each table that carries its id, the rows of other loads are not touched, and the load is marked as rolled back. The ledger is only ever added to, so what
 * the load confirmed stays as the record that it was made and undone.
 */
export async function rollbackLoad(on: Runner, loadId: string, tables: readonly Written[], now: () => Date = () => new Date()): Promise<Rollback> {
  const removed: Record<string, number> = {};
  for (const w of tables) {
    const t = w.table as unknown as Table<Record<string, unknown>, never, string>;
    const rows = await deleteFrom(t).where((c) => eq((c as unknown as Record<string, never>)[w.column] as never, loadId as never)).returning((c) => ({ n: (c as unknown as Record<string, never>)[w.column] as never })).run(on);
    removed[t.source.kind === "table" ? t.source.name : t.alias] = rows.length;
  }
  await update(load).set({ rolledBackAt: now().toISOString() }).where((c) => eq(c.loadId, loadId)).run(on);
  return { loadId, removed };
}

/** The loads, newest first, with whether they were undone. */
export const loads = (on: Runner) => from(load).select((s) => ({ loadId: s.load.loadId, loadType: s.load.loadType, source: s.load.source, rolledBackAt: s.load.rolledBackAt })).orderBy((s) => [desc(s.load.startedAt)]).run(on);
