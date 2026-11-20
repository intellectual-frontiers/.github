// Spec: 0006-integrations-exchange FR-013, FR-014, FR-015
/**
 * The ledger port of exchange (commons integrations 0006-integrations-exchange): a typed record of functions, each returning a `Result`, with which a consumer keeps the trail of a
 * load without the library knowing where it is kept (a database, a file, memory). It appends stage events, checks the intake of a content by its hash, and records the outcome of a
 * validation or an acknowledgement by code. A stage is an opaque branded text: the consumer's code list of stages lives with the consumer, not here. An event never carries a payload
 * value: its fields are identifiers, a code, an instant and a digest, each made by a smart constructor that admits no free text.
 *
 * @module
 */
import { err, ok, type Brand, type Result } from "@intellectual-frontiers/core";
import { brand, type IdError, type Instant, type Sha256 } from "@intellectual-frontiers/integrations/governance";

/** The identity of one load, as the consumer names it. */
export type LoadId = Brand<string, "LoadId">;
/** A stage of the consumer's pipeline, an opaque code such as `RECEIVED` or `VALIDATED`. */
export type Stage = Brand<string, "Stage">;
/** A code that says why, or what came of a check: lower-case words joined by dashes. */
export type OutcomeCode = Brand<string, "OutcomeCode">;
/** The key that names the same item across loads (a message id, a control number): what two contents of one item share. */
export type ItemKey = Brand<string, "ItemKey">;

const make = <B extends string>(what: B, pattern: RegExp, expected: string, text: string): Result<Brand<string, B>, IdError> => (pattern.test(text) ? ok(brand<B>(text)) : err({ kind: "id", what, expected }));

/** A load id: letters, digits and `. _ : -`, up to 128. Free text is refused, and the refusal does not repeat it. */
export const parseLoadId = (t: string): Result<LoadId, IdError> => make("LoadId", /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/, "letters, digits and . _ : -, up to 128", t);
/** A stage: upper-case words joined by underscores. */
export const parseStage = (t: string): Result<Stage, IdError> => make("Stage", /^[A-Z][A-Z0-9_]{1,31}$/, "upper-case words joined by underscores", t);
/** An outcome or reason code. */
export const parseOutcomeCode = (t: string): Result<OutcomeCode, IdError> => make("OutcomeCode", /^[a-z0-9][a-z0-9-]{0,63}$/, "lower-case words joined by dashes", t);
/** An item key. */
export const parseItemKey = (t: string): Result<ItemKey, IdError> => make("ItemKey", /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/, "letters, digits and . _ : -, up to 128", t);

/** One event of a load: a stage reached, with a reason code and a digest where there are any. Never a payload value. */
export type LedgerEvent = { readonly loadId: LoadId; readonly stage: Stage; readonly reasonCode?: OutcomeCode; readonly at: Instant; readonly contentHash?: Sha256 };

/** What a content is, on intake. */
export type IntakeRequest = { readonly loadId: LoadId; readonly itemKey: ItemKey; readonly contentHash: Sha256; readonly at: Instant };

/** What the ledger says of a content on intake: never seen; the same content seen before (in the load named); or another content of the same item (in the load named). */
export type Intake = { readonly kind: "first-seen" } | { readonly kind: "duplicate"; readonly of: LoadId } | { readonly kind: "conflict"; readonly with: LoadId };

/** Which check an outcome is of. */
export type OutcomeKind = "validation" | "acknowledgement";

/** The outcome of a check, by code. */
export type OutcomeRecord = { readonly loadId: LoadId; readonly kind: OutcomeKind; readonly code: OutcomeCode; readonly at: Instant };

/** Why the ledger could not answer. */
export type LedgerError = { readonly kind: "unavailable" } | { readonly kind: "unknown-load"; readonly loadId: LoadId };

/** The ledger port. */
export type LedgerPort = {
  readonly append: (event: LedgerEvent) => Promise<Result<void, LedgerError>>;
  readonly intake: (request: IntakeRequest) => Promise<Result<Intake, LedgerError>>;
  readonly outcome: (record: OutcomeRecord) => Promise<Result<void, LedgerError>>;
  readonly events: (loadId: LoadId) => Promise<Result<readonly LedgerEvent[], LedgerError>>;
  readonly outcomes: (loadId: LoadId) => Promise<Result<readonly OutcomeRecord[], LedgerError>>;
};

/** A ledger in memory. */
export function memoryLedger(): LedgerPort {
  const events = new Map<LoadId, LedgerEvent[]>();
  const outcomes = new Map<LoadId, OutcomeRecord[]>();
  const byHash = new Map<Sha256, LoadId>();
  const byItem = new Map<ItemKey, { readonly hash: Sha256; readonly loadId: LoadId }>();
  return {
    append: (e) => {
      events.set(e.loadId, [...(events.get(e.loadId) ?? []), e]);
      return Promise.resolve(ok(undefined));
    },
    intake: (r) => {
      const same = byHash.get(r.contentHash);
      if (same !== undefined) return Promise.resolve(ok({ kind: "duplicate", of: same }));
      const item = byItem.get(r.itemKey);
      if (item !== undefined) return Promise.resolve(ok({ kind: "conflict", with: item.loadId }));
      byHash.set(r.contentHash, r.loadId);
      byItem.set(r.itemKey, { hash: r.contentHash, loadId: r.loadId });
      return Promise.resolve(ok({ kind: "first-seen" }));
    },
    outcome: (o) => {
      if (!events.has(o.loadId)) return Promise.resolve(err({ kind: "unknown-load", loadId: o.loadId }));
      outcomes.set(o.loadId, [...(outcomes.get(o.loadId) ?? []), o]);
      return Promise.resolve(ok(undefined));
    },
    events: (id) => Promise.resolve(ok(events.get(id) ?? [])),
    outcomes: (id) => Promise.resolve(events.has(id) ? ok(outcomes.get(id) ?? []) : err({ kind: "unknown-load", loadId: id })),
  };
}

/** What a ledger conformance finds wrong. */
export type LedgerFinding = { readonly rule: string; readonly message: string };

/**
 * The conformance suite of a ledger: `make` gives a fresh, empty ledger each time. It finds a ledger that does not keep events in the order appended, that does not tell first-seen from
 * duplicate from conflict, that accepts an outcome for a load it has no event of, or that does not keep outcomes. Any implementation (memory, a database) runs it.
 */
export async function conformLedger(make: () => LedgerPort, ids: { readonly load: (n: number) => LoadId; readonly stage: (name: string) => Stage; readonly code: (name: string) => OutcomeCode; readonly key: (n: number) => ItemKey; readonly hash: (n: number) => Sha256; readonly at: Instant }): Promise<readonly LedgerFinding[]> {
  const out: LedgerFinding[] = [];
  const bad = (rule: string, message: string): void => void out.push({ rule, message });
  const l = make();
  const a = ids.load(1);
  const b = ids.load(2);
  const c = ids.load(3);
  await l.append({ loadId: a, stage: ids.stage("RECEIVED"), at: ids.at });
  await l.append({ loadId: a, stage: ids.stage("PARSED"), reasonCode: ids.code("ok"), at: ids.at, contentHash: ids.hash(1) });
  const evs = await l.events(a);
  if (evs.kind !== "ok" || evs.value.map((e) => e.stage).join(",") !== "RECEIVED,PARSED") bad("ledger/order", "events are not kept in the order appended");
  const first = await l.intake({ loadId: a, itemKey: ids.key(1), contentHash: ids.hash(1), at: ids.at });
  if (first.kind !== "ok" || first.value.kind !== "first-seen") bad("ledger/first-seen", "a content never seen is not first-seen");
  const dup = await l.intake({ loadId: b, itemKey: ids.key(2), contentHash: ids.hash(1), at: ids.at });
  if (dup.kind !== "ok" || dup.value.kind !== "duplicate" || dup.value.of !== a) bad("ledger/duplicate", "the same content is not a duplicate of the load that had it");
  const conflict = await l.intake({ loadId: c, itemKey: ids.key(1), contentHash: ids.hash(3), at: ids.at });
  if (conflict.kind !== "ok" || conflict.value.kind !== "conflict" || conflict.value.with !== a) bad("ledger/conflict", "another content of the same item is not a conflict");
  const unknown = await l.outcome({ loadId: ids.load(99), kind: "validation", code: ids.code("none"), at: ids.at });
  if (unknown.kind !== "err" || unknown.error.kind !== "unknown-load") bad("ledger/unknown-load", "an outcome for a load with no event is accepted");
  await l.outcome({ loadId: a, kind: "validation", code: ids.code("cardinality-min"), at: ids.at });
  const os = await l.outcomes(a);
  if (os.kind !== "ok" || os.value.length !== 1 || os.value[0]?.code !== "cardinality-min") bad("ledger/outcomes", "an outcome recorded is not read back");
  const other = make();
  const fresh = await other.intake({ loadId: a, itemKey: ids.key(1), contentHash: ids.hash(1), at: ids.at });
  if (fresh.kind !== "ok" || fresh.value.kind !== "first-seen") bad("ledger/fresh", "a fresh ledger remembers another's contents");
  return out;
}
