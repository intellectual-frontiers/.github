// Spec: 0006-estate-fleet-store FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-009, FR-010
/**
 * The fleet store (commons estate 0006-estate-fleet-store): the physical layer of Estate, which keeps an estate as typed documents in a store of AnyFS. The store of the system of record is the primary,
 * typically a host reached by SSH; the replicas are mirrors of it (a branch of a Git repository, a bucket, a folder) and are brought up to it by `settle`. Every write states what it expects, so that two
 * operators who change the same asset are one winner and one conflict; every document comes back with its revision; and what is in a folder and is not a good document is a finding, never a failure.
 *
 * @example
 * ```ts
 * import { devFleetStore } from "./dev.ts";
 * const fleet = await devFleetStore({ kind: "memory" }, { actor: "operator" });
 * fleet.kind; // "ok"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import {
  type Cursor,
  type Expect,
  expectAbsent,
  type Path,
  parsePrefix,
  type Prefix,
  type Problem,
  relativeTo,
  type Revision,
} from "@intellectual-frontiers/anyfs/governance";
import { type Clock, type RetryPolicy, retrying, type Store } from "@intellectual-frontiers/anyfs/logical";
import { canonicalJson, collection, type Collection, type Doc, type DocId, type DocProblem, type Finding, parseDocId, type Saved, toJsonValue, type Updated } from "@intellectual-frontiers/anyfs/docs";
import { forbidDeletes } from "@intellectual-frontiers/anyfs-bridge/governance";
import { type Member, type Mirror, type MirrorEvent, type MirrorPolicy, type Promoted, type ReplicaName, type ReplicaStatus, type Settled, openMirror } from "@intellectual-frontiers/anyfs-bridge/mirror";
import type { Json } from "@intellectual-frontiers/grc/governance";
import { type Asset, parseAssetId } from "@intellectual-frontiers/estate/governance";
import { type AcceptedRisk, acceptRisk as checkRisk } from "@intellectual-frontiers/estate/logical";
import {
  ACCEPTANCES,
  acceptancesCodec,
  ASSETS,
  assetCodec,
  DECLARATIONS,
  declarationCodec,
  EVIDENCE,
  evidenceCodec,
  FLEET_LAYOUT,
  FLEET_SCHEMA,
  flatById,
  instantOf,
  MANIFEST_KEY,
  manifestCodec,
  type Manifest,
  OBSERVATIONS,
  observationCodec,
  observationKey,
  ROOT_FOLDER,
  shardedById,
  type StoredAcceptances,
  type StoredDeclaration,
  type StoredEvidence,
  type StoredObservation,
  type StoredResult,
} from "./documents.ts";
import { documentsProblem, type FleetProblem } from "./problem.ts";
import type { FleetSnapshot, ObservationOf } from "./snapshot.ts";

/** What the primary must have: the core of a store, and revisions that can be expected. */
export type FleetCapabilities = "read" | "write" | "list" | "stat" | "delete" | "cas";

/** The store of the system of record. */
export type PrimaryStore = Store<FleetCapabilities>;

/** A mirror of the system of record: a store that can be read, listed and written, as the bridge asks of a destination. */
export type ReplicaStore = Store<"read" | "write" | "list" | "stat" | "delete">;

/** What a fleet store is opened with, written as code. */
export type FleetConfig = {
  /** The store of the system of record, and the name it has in the mirror. */
  readonly primary: Member<PrimaryStore>;
  /** The mirrors of it. */
  readonly replicas?: readonly Member<ReplicaStore>[];
  /** How the mirror works: it deletes nothing at a replica, a read never falls back to one, and a settlement is made when `settle` is called, unless it says otherwise. */
  readonly mirror?: Partial<MirrorPolicy>;
  /** The name of the fleet: made the manifest's where one is made, and asked for where one is read. The name of the primary where it is not given. */
  readonly identity?: string;
  /** Whether a store with no manifest is made a fleet store. A store is made one only when it is asked to be. */
  readonly create?: boolean;
  /** Who writes: put in the declarations and in the events. */
  readonly actor: string;
  /** The time in milliseconds since the epoch: the system's where not given. */
  readonly clock?: () => number;
  /** How a call that failed because the host could not be reached is repeated. Not at all where not given. */
  readonly retry?: { readonly policy: RetryPolicy; readonly clock: Pick<Clock, "sleep"> };
  /** The attempts of an update that another writer changed first; 5 where not given. */
  readonly attempts?: number;
};

/** What an observation is made from. */
export type ObservationInput = {
  readonly asset: string;
  /** When it was observed, as an instant. */
  readonly at: string;
  /** What it is attributed to: a probe, an agent, a connector. Never empty. */
  readonly source: string;
  readonly state: Readonly<Record<string, Json>>;
  readonly results?: readonly StoredResult[];
};

/** What an observation was written as. */
export type Recorded = { readonly created: boolean; readonly path: Path; readonly rev: Revision };

/** The observations of an asset between two instants, as many as asked for. */
export type ObservationRange = { readonly from?: string; readonly to?: string; readonly limit?: number };

/** Documents and what was found beside them. */
export type Listed<T> = { readonly docs: readonly Doc<T, DocId>[]; readonly findings: readonly Finding[] };

/** What an event of a fleet store says. */
export type FleetEvent =
  | { readonly kind: "manifest-made"; readonly at: number; readonly actor: string; readonly store: string }
  | { readonly kind: "asset"; readonly at: number; readonly actor: string; readonly asset: string; readonly rev: Revision; readonly created: boolean }
  | { readonly kind: "observation"; readonly at: number; readonly actor: string; readonly asset: string; readonly observedAt: string; readonly created: boolean }
  | { readonly kind: "declaration"; readonly at: number; readonly actor: string; readonly asset: string; readonly rev: Revision }
  | { readonly kind: "risk"; readonly at: number; readonly actor: string; readonly asset: string; readonly policy: string }
  | { readonly kind: "evidence"; readonly at: number; readonly actor: string; readonly subject: string; readonly digest: string; readonly created: boolean }
  | { readonly kind: "mirror"; readonly at: number; readonly event: MirrorEvent };

/** An event before it is given its time and its actor: the events that have them. */
type Noted = FleetEvent extends infer E ? (E extends { readonly actor: string } ? Omit<E, "at" | "actor"> : never) : never;

/** What a snapshot is asked for. */
export type SnapshotOptions = {
  /** The latest observation of each asset, or all of them. Latest where not given. */
  readonly observations?: "latest" | "all";
  /** Whether the references to evidence are read. Not where not given. */
  readonly evidence?: boolean;
  /** How many times the reading is begun again when a document changed under it. 3 where not given. */
  readonly attempts?: number;
};

/** A fleet store. */
export type FleetStore = {
  /** What the store says it is. */
  readonly manifest: Manifest;
  /** The store the documents are in: the primary, with the mirror in front of it where there are replicas. */
  readonly store: PrimaryStore;
  /** Writes an asset: it is made where the expectation is `absent`, changed where it is the revision read, and written over where it is `any`. */
  putAsset(asset: Asset, expect: Expect): Promise<Result<Saved<DocId>, FleetProblem>>;
  /** The asset with the revision it was read at. */
  getAsset(id: string): Promise<Result<Doc<Asset, DocId>, FleetProblem>>;
  /** Changes an asset by reading it, calling `change` with it (or with nothing where there is none) and writing the result expecting the revision read; it is begun again where another writer changed it first. `change` gives the asset to write or nothing to leave it. */
  updateAsset(id: string, change: (current: Asset | undefined) => Asset | undefined | Promise<Asset | undefined>): Promise<Result<Updated<Asset, DocId>, FleetProblem>>;
  /** Every asset, and what is in the folder that is not one. */
  listAssets(): Promise<Result<Listed<Asset>, FleetProblem>>;
  /** Writes an observation once: the same observation again is `created: false`, and a different one at the same instant is refused. */
  recordObservation(input: ObservationInput): Promise<Result<Recorded, FleetProblem>>;
  /** The observations of an asset in the order of their instants, with what is in its folder that is not one. */
  observationsOf(asset: string, range?: ObservationRange): Promise<Result<{ readonly observations: readonly StoredObservation[]; readonly findings: readonly Finding[] }, FleetProblem>>;
  /** The latest observation of an asset, or nothing where it was never observed. */
  latestObservation(asset: string): Promise<Result<StoredObservation | undefined, FleetProblem>>;
  /** Writes what is declared of an asset, with the expectation that says what it replaces. */
  declare(asset: string, declared: Readonly<Record<string, Json>>, expect: Expect): Promise<Result<Saved<DocId>, FleetProblem>>;
  /** What is declared of an asset, or nothing where nothing is. */
  declarationOf(asset: string): Promise<Result<Doc<StoredDeclaration, DocId> | undefined, FleetProblem>>;
  /** Accepts a risk of an asset as the estate's rule allows (a reason in words, a day within a year); the risk of the same policy is replaced. */
  acceptRisk(asset: string, risk: AcceptedRisk): Promise<Result<StoredAcceptances, FleetProblem>>;
  /** The risks accepted of an asset. */
  risksOf(asset: string): Promise<Result<readonly AcceptedRisk[], FleetProblem>>;
  /** Writes the reference to a piece of evidence, once: the same subject and digest again is `created: false`. */
  recordEvidence(ref: StoredEvidence): Promise<Result<{ readonly created: boolean; readonly path: Path }, FleetProblem>>;
  /** The references to the evidence of a subject. */
  evidenceOf(subject: string): Promise<Result<{ readonly refs: readonly StoredEvidence[]; readonly findings: readonly Finding[] }, FleetProblem>>;
  /** Everything the logical layer judges, read from the documents. It is begun again where a document changed under the reading, and says whether it ended up stable. */
  snapshot(options?: SnapshotOptions): Promise<Result<FleetSnapshot, FleetProblem>>;
  /** The versions a replica that keeps history holds of an asset, newest first. */
  history(asset: string, replica: string): Promise<Result<readonly { readonly rev: Revision; readonly size: number; readonly modified?: string }[], FleetProblem>>;
  /** The state of each replica against the primary; nothing is changed. Nothing where there are no replicas. */
  status(): Promise<readonly ReplicaStatus[]>;
  /** Brings the replicas up to the primary. */
  settle(only?: string): Promise<Result<readonly Settled[], FleetProblem>>;
  /** Makes a replica the primary, as the bridge allows it, and says so in an event. */
  promote(replica: string, options?: { readonly acceptLoss?: number; readonly acceptDivergence?: boolean }): Promise<Result<Promoted, FleetProblem>>;
  /** Calls `listener` for each event; the function it gives stops it. */
  subscribe(listener: (event: FleetEvent) => void): () => void;
  /** Waits for the settlements that were started and stops the mirror. */
  close(): Promise<void>;
};

const fail = <T>(problem: FleetProblem): Result<T, FleetProblem> => err(problem);
const docs = <T>(made: Result<T, DocProblem>): Result<T, FleetProblem> => (made.kind === "ok" ? ok(made.value) : err(documentsProblem(made.error)));
const storeFault = (problem: Problem): FleetProblem => documentsProblem({ kind: "store", problem });
const isMissing = (problem: DocProblem): boolean => problem.kind === "store" && problem.problem.kind === "missing";
const isConflict = (problem: DocProblem): boolean => problem.kind === "store" && problem.problem.kind === "conflict";

function prefixOf(base: Prefix, ...segments: readonly string[]): Result<Prefix, string> {
  const joined = [base, ...segments].filter((s) => s !== "").join("/");
  return parsePrefix(joined);
}

type Caps = FleetCapabilities;
type Docs<T> = Collection<T, DocId, Caps>;

function sameValue(a: unknown, b: unknown): boolean {
  const x = toJsonValue(a);
  const y = toJsonValue(b);
  return x.kind === "ok" && y.kind === "ok" && canonicalJson(x.value) === canonicalJson(y.value);
}

/** The reasons an asset identity is refused, or the document name it is kept under. */
function keyOfAsset(id: string): Result<DocId, FleetProblem> {
  const parsed = parseAssetId(id);
  if (parsed.kind === "err") return fail({ kind: "refused", reasons: [parsed.error] });
  const key = parseDocId(parsed.value);
  return key.kind === "ok" ? ok(key.value) : fail({ kind: "refused", reasons: [key.error] });
}

/**
 * Opens a fleet store. The mirror is made first where there are replicas, and the documents are read and written through it. The manifest is read: a store of a newer schema or another layout, or another
 * fleet than the one asked for, is refused with the reason; a store with none is made a fleet store only when `create` is set.
 */
export async function openFleetStore(config: FleetConfig): Promise<Result<FleetStore, FleetProblem>> {
  const clock = config.clock ?? ((): number => Date.now());
  const listeners = new Set<(event: FleetEvent) => void>();
  const emit = (event: FleetEvent): void => {
    for (const l of listeners) {
      try {
        l(event);
      } catch {
        // a listener that fails does not fail a write that was made
      }
    }
  };

  const base: PrimaryStore = config.retry === undefined ? config.primary.store : retrying(config.primary.store, config.retry.policy, config.retry.clock);
  const replicas = config.replicas ?? [];
  let mirror: Mirror<Caps> | undefined;
  let store: PrimaryStore = base;
  if (replicas.length > 0) {
    const policy: MirrorPolicy = { deletes: forbidDeletes, fallback: "never", auto: "manual", ...config.mirror };
    const opened = await openMirror<Caps>({ name: config.primary.name, store: base }, replicas, policy);
    if (opened.kind === "err") return fail({ kind: "mirror", problem: opened.error });
    mirror = opened.value;
    store = mirror.store;
    mirror.subscribe((event) => emit({ kind: "mirror", at: clock(), event }));
  }

  const attempts = config.attempts ?? 5;
  const assets: Docs<Asset> = collection(store, { prefix: ASSETS, layout: shardedById, codec: assetCodec, attempts });
  const declarations: Docs<StoredDeclaration> = collection(store, { prefix: DECLARATIONS, layout: shardedById, codec: declarationCodec, attempts });
  const acceptances: Docs<StoredAcceptances> = collection(store, { prefix: ACCEPTANCES, layout: shardedById, codec: acceptancesCodec, attempts });
  const manifests: Docs<Manifest> = collection(store, { prefix: ROOT_FOLDER, layout: flatById, codec: manifestCodec, attempts });
  const observationsFor = (asset: string): Result<Docs<StoredObservation>, FleetProblem> => {
    const prefix = prefixOf(OBSERVATIONS, asset);
    return prefix.kind === "err" ? fail({ kind: "refused", reasons: [prefix.error] }) : ok(collection(store, { prefix: prefix.value, layout: flatById, codec: observationCodec, attempts }));
  };
  const evidenceFor = (subject: string): Result<Docs<StoredEvidence>, FleetProblem> => {
    const prefix = prefixOf(EVIDENCE, subject);
    return prefix.kind === "err" ? fail({ kind: "refused", reasons: [prefix.error] }) : ok(collection(store, { prefix: prefix.value, layout: flatById, codec: evidenceCodec, attempts }));
  };

  // the manifest
  const identity = config.identity ?? config.primary.name;
  let manifest: Manifest;
  const read = await manifests.get(MANIFEST_KEY);
  if (read.kind === "ok") {
    manifest = read.value.value;
  } else if (isMissing(read.error)) {
    if (config.create !== true) return fail({ kind: "no-manifest" });
    const made: Manifest = { store: identity, schema: FLEET_SCHEMA, layout: FLEET_LAYOUT, created: instantOf(clock()) };
    const saved = await manifests.put(MANIFEST_KEY, made, expectAbsent);
    if (saved.kind === "ok") {
      manifest = made;
      emit({ kind: "manifest-made", at: clock(), actor: config.actor, store: identity });
    } else if (isConflict(saved.error)) {
      // another opener made it first: read what it made
      const again = await manifests.get(MANIFEST_KEY);
      if (again.kind === "err") return fail(documentsProblem(again.error));
      manifest = again.value.value;
    } else return fail(documentsProblem(saved.error));
  } else return fail(documentsProblem(read.error));
  if (manifest.schema > FLEET_SCHEMA) return fail({ kind: "newer-schema", found: manifest.schema, reads: FLEET_SCHEMA });
  if (manifest.layout !== FLEET_LAYOUT) return fail({ kind: "other-layout", found: manifest.layout, names: FLEET_LAYOUT });
  if (config.identity !== undefined && manifest.store !== config.identity) return fail({ kind: "other-fleet", asked: config.identity, found: manifest.store });

  const note = (event: Noted): void => emit({ ...event, at: clock(), actor: config.actor });

  // every key of a folder, with the revision, by the listing of the store
  const listFolder = async (prefix: Prefix): Promise<Result<readonly { readonly path: Path; readonly rev: Revision }[], FleetProblem>> => {
    const out: { path: Path; rev: Revision }[] = [];
    let after: Cursor | undefined;
    for (;;) {
      const page = await store.list(prefix, after === undefined ? { limit: 500 } : { limit: 500, after });
      if (page.kind === "err") return fail(storeFault(page.error));
      for (const e of page.value.entries) out.push({ path: e.path, rev: e.rev });
      if (page.value.next === undefined) return ok(out);
      after = page.value.next;
    }
  };

  const scanAll = async <T>(c: Docs<T>): Promise<Listed<T>> => {
    const out: Doc<T, DocId>[] = [];
    const findings: Finding[] = [];
    for await (const item of c.scan()) {
      if (item.kind === "doc") out.push(item.doc);
      else findings.push(item.finding);
    }
    return { docs: out, findings };
  };

  const observationKeys = async (asset: string): Promise<Result<{ readonly keys: readonly { readonly key: DocId; readonly path: Path }[]; readonly findings: readonly Finding[] }, FleetProblem>> => {
    const prefix = prefixOf(OBSERVATIONS, asset);
    if (prefix.kind === "err") return fail({ kind: "refused", reasons: [prefix.error] });
    const listed = await listFolder(prefix.value);
    if (listed.kind === "err") return listed;
    const keys: { key: DocId; path: Path }[] = [];
    const findings: Finding[] = [];
    for (const e of listed.value) {
      const rel = relativeTo(prefix.value, e.path);
      const key = rel === undefined ? undefined : flatById.key(rel);
      if (key === undefined || key.kind === "err") findings.push({ kind: "foreign", path: e.path, detail: key === undefined ? "not below the folder" : key.error });
      else keys.push({ key: key.value, path: e.path });
    }
    keys.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    return ok({ keys, findings });
  };

  const gate = async <T>(f: () => Promise<Result<T, DocProblem>>): Promise<Result<T, FleetProblem>> => docs(await f());

  const fleet: FleetStore = {
    manifest,
    store,

    putAsset: async (asset, expect) => {
      const key = keyOfAsset(asset.id);
      if (key.kind === "err") return key;
      const saved = await gate(() => assets.put(key.value, asset, expect));
      if (saved.kind === "ok") note({ kind: "asset", asset: asset.id, rev: saved.value.rev, created: saved.value.created });
      return saved;
    },

    getAsset: async (id) => {
      const key = keyOfAsset(id);
      return key.kind === "err" ? key : gate(() => assets.get(key.value));
    },

    updateAsset: async (id, change) => {
      const key = keyOfAsset(id);
      if (key.kind === "err") return key;
      const updated = await gate(() => assets.update(key.value, async (current) => {
        const next = await change(current?.value);
        return next === undefined ? { kind: "keep" } : { kind: "put", value: next };
      }));
      if (updated.kind === "ok" && updated.value.kind === "put") note({ kind: "asset", asset: id, rev: updated.value.doc.rev, created: updated.value.created });
      return updated;
    },

    listAssets: async () => ok(await scanAll(assets)),

    recordObservation: async (input) => {
      const keyOf = keyOfAsset(input.asset);
      if (keyOf.kind === "err") return keyOf;
      const key = observationKey(input.at);
      if (key.kind === "err") return fail({ kind: "refused", reasons: [key.error] });
      if (input.source.trim() === "") return fail({ kind: "refused", reasons: ["an observation is attributed to a source: a probe, an agent or a connector"] });
      const folder = observationsFor(input.asset);
      if (folder.kind === "err") return folder;
      const value: StoredObservation = { asset: input.asset, at: instantOf(Date.parse(input.at)), source: input.source, state: input.state, results: input.results ?? [] };
      const saved = await folder.value.put(key.value, value, expectAbsent);
      if (saved.kind === "ok") {
        note({ kind: "observation", asset: input.asset, observedAt: value.at, created: true });
        return ok({ created: true, path: saved.value.path, rev: saved.value.rev });
      }
      if (!isConflict(saved.error)) return fail(documentsProblem(saved.error));
      const existing = await folder.value.get(key.value);
      if (existing.kind === "err") return fail(documentsProblem(existing.error));
      if (!sameValue(existing.value.value, value)) return fail({ kind: "exists", path: existing.value.path });
      return ok({ created: false, path: existing.value.path, rev: existing.value.rev });
    },

    observationsOf: async (asset, range = {}) => {
      const keyOf = keyOfAsset(asset);
      if (keyOf.kind === "err") return keyOf;
      const folder = observationsFor(asset);
      if (folder.kind === "err") return folder;
      const listed = await observationKeys(asset);
      if (listed.kind === "err") return listed;
      const from = range.from === undefined ? undefined : observationKey(range.from);
      const to = range.to === undefined ? undefined : observationKey(range.to);
      if (from?.kind === "err") return fail({ kind: "refused", reasons: [from.error] });
      if (to?.kind === "err") return fail({ kind: "refused", reasons: [to.error] });
      const limit = Math.max(1, range.limit ?? 1000);
      const chosen = listed.value.keys.filter((k) => (from === undefined || k.key >= from.value) && (to === undefined || k.key <= to.value)).slice(0, limit);
      const out: StoredObservation[] = [];
      const findings: Finding[] = [...listed.value.findings];
      for (const k of chosen) {
        const doc = await folder.value.get(k.key);
        if (doc.kind === "ok") out.push(doc.value.value);
        else if (doc.error.kind === "undecodable") findings.push({ kind: "undecodable", path: doc.error.path, reason: doc.error.reason, detail: doc.error.detail });
        else if (!isMissing(doc.error)) return fail(documentsProblem(doc.error));
      }
      return ok({ observations: out, findings });
    },

    latestObservation: async (asset) => {
      const keyOf = keyOfAsset(asset);
      if (keyOf.kind === "err") return keyOf;
      const folder = observationsFor(asset);
      if (folder.kind === "err") return folder;
      const listed = await observationKeys(asset);
      if (listed.kind === "err") return listed;
      for (let i = listed.value.keys.length - 1; i >= 0; i--) {
        const k = listed.value.keys[i];
        if (k === undefined) continue;
        const doc = await folder.value.get(k.key);
        if (doc.kind === "ok") return ok(doc.value.value);
        if (doc.error.kind !== "undecodable" && !isMissing(doc.error)) return fail(documentsProblem(doc.error));
      }
      return ok(undefined);
    },

    declare: async (asset, declared, expect) => {
      const key = keyOfAsset(asset);
      if (key.kind === "err") return key;
      const value: StoredDeclaration = { asset, declared, by: config.actor, at: instantOf(clock()) };
      const saved = await gate(() => declarations.put(key.value, value, expect));
      if (saved.kind === "ok") note({ kind: "declaration", asset, rev: saved.value.rev });
      return saved;
    },

    declarationOf: async (asset) => {
      const key = keyOfAsset(asset);
      if (key.kind === "err") return key;
      const got = await declarations.get(key.value);
      if (got.kind === "ok") return ok(got.value);
      return isMissing(got.error) ? ok(undefined) : fail(documentsProblem(got.error));
    },

    acceptRisk: async (asset, risk) => {
      const key = keyOfAsset(asset);
      if (key.kind === "err") return key;
      const checked = checkRisk(risk, instantOf(clock()));
      if (checked.kind === "err") return fail({ kind: "refused", reasons: checked.error });
      let written: StoredAcceptances | undefined;
      const updated = await gate(() => acceptances.update(key.value, (current) => {
        const others = (current?.value.risks ?? []).filter((r) => r.policy !== checked.value.policy);
        written = { asset, risks: [...others, checked.value].sort((a, b) => (a.policy < b.policy ? -1 : a.policy > b.policy ? 1 : 0)) };
        return { kind: "put", value: written };
      }));
      if (updated.kind === "err") return updated;
      note({ kind: "risk", asset, policy: checked.value.policy });
      return written === undefined ? fail({ kind: "refused", reasons: ["no risk was written"] }) : ok(written);
    },

    risksOf: async (asset) => {
      const key = keyOfAsset(asset);
      if (key.kind === "err") return key;
      const got = await acceptances.get(key.value);
      if (got.kind === "ok") return ok(got.value.value.risks);
      return isMissing(got.error) ? ok([]) : fail(documentsProblem(got.error));
    },

    recordEvidence: async (ref) => {
      const subject = keyOfAsset(ref.subject);
      if (subject.kind === "err") return subject;
      const folder = evidenceFor(ref.subject);
      if (folder.kind === "err") return folder;
      const key = parseDocId(ref.digest);
      if (key.kind === "err") return fail({ kind: "refused", reasons: [key.error] });
      const saved = await folder.value.put(key.value, ref, expectAbsent);
      if (saved.kind === "ok") {
        note({ kind: "evidence", subject: ref.subject, digest: ref.digest, created: true });
        return ok({ created: true, path: saved.value.path });
      }
      if (!isConflict(saved.error)) return fail(documentsProblem(saved.error));
      const pathOf = folder.value.pathOf(key.value);
      return pathOf.kind === "ok" ? ok({ created: false, path: pathOf.value }) : fail(documentsProblem(pathOf.error));
    },

    evidenceOf: async (subject) => {
      const named = keyOfAsset(subject);
      if (named.kind === "err") return named;
      const folder = evidenceFor(subject);
      if (folder.kind === "err") return folder;
      const listed = await scanAll(folder.value);
      return ok({ refs: listed.docs.map((d) => d.value), findings: listed.findings });
    },

    snapshot: async (options = {}) => {
      const wanted = options.observations ?? "latest";
      const tries = Math.max(1, options.attempts ?? 3);
      const watched = [ASSETS, DECLARATIONS, ACCEPTANCES];
      const revisions = async (): Promise<Result<ReadonlyMap<string, Revision>, FleetProblem>> => {
        const all = new Map<string, Revision>();
        for (const p of watched) {
          const listed = await listFolder(p);
          if (listed.kind === "err") return listed;
          for (const e of listed.value) all.set(e.path, e.rev);
        }
        return ok(all);
      };
      for (let attempt = 1; ; attempt++) {
        const before = await revisions();
        if (before.kind === "err") return before;
        const findings: Finding[] = [];
        const listedAssets = await scanAll(assets);
        findings.push(...listedAssets.findings);
        const declared: Record<string, Readonly<Record<string, Json>>> = {};
        const declaredAll = await scanAll(declarations);
        findings.push(...declaredAll.findings);
        for (const d of declaredAll.docs) declared[d.value.asset] = d.value.declared;
        const accepted: Record<string, readonly AcceptedRisk[]> = {};
        const acceptedAll = await scanAll(acceptances);
        findings.push(...acceptedAll.findings);
        for (const a of acceptedAll.docs) accepted[a.value.asset] = a.value.risks;
        const observations: ObservationOf[] = [];
        const results: (StoredResult & { asset: string })[] = [];
        const evidence: StoredEvidence[] = [];
        for (const a of listedAssets.docs) {
          const id = a.value.id;
          const listed = await observationKeys(id);
          if (listed.kind === "err") return listed;
          findings.push(...listed.value.findings);
          const folder = observationsFor(id);
          if (folder.kind === "err") return folder;
          const chosen = wanted === "all" ? listed.value.keys : listed.value.keys.slice(-1);
          let latest: StoredObservation | undefined;
          for (const k of chosen) {
            const doc = await folder.value.get(k.key);
            if (doc.kind === "err") {
              if (doc.error.kind === "undecodable") findings.push({ kind: "undecodable", path: doc.error.path, reason: doc.error.reason, detail: doc.error.detail });
              else if (!isMissing(doc.error)) return fail(documentsProblem(doc.error));
              continue;
            }
            observations.push({ asset: id, observation: { at: doc.value.value.at, source: doc.value.value.source, state: doc.value.value.state } });
            latest = doc.value.value;
          }
          if (latest !== undefined) for (const r of latest.results) results.push({ asset: id, ...r });
          if (options.evidence === true) {
            const refs = await fleet.evidenceOf(id);
            if (refs.kind === "err") return refs;
            evidence.push(...refs.value.refs);
            findings.push(...refs.value.findings);
          }
        }
        const after = await revisions();
        if (after.kind === "err") return after;
        let same = after.value.size === before.value.size;
        if (same) for (const [path, rev] of before.value) if (after.value.get(path) !== rev) same = false;
        if (same || attempt >= tries) {
          return ok({
            manifest,
            assets: listedAssets.docs.map((d) => d.value),
            declared,
            observations,
            results,
            acceptances: accepted,
            evidence,
            findings,
            stable: same,
          });
        }
      }
    },

    history: async (asset, replica) => {
      const key = keyOfAsset(asset);
      if (key.kind === "err") return key;
      const member = replicas.find((r) => r.name === replica);
      if (member === undefined || !member.store.capabilities.has("history")) return fail({ kind: "no-history", replica });
      const path = assets.pathOf(key.value);
      if (path.kind === "err") return fail(documentsProblem(path.error));
      const versions = await member.store.handle({ op: "history", path: path.value, limit: 100 });
      if (versions.kind === "err") return fail(storeFault(versions.error));
      return versions.value.op === "history" ? ok(versions.value.value.versions) : fail(storeFault({ kind: "unavailable", detail: `the replica answered ${versions.value.op} to history`, retryable: false }));
    },

    status: async () => (mirror === undefined ? [] : mirror.status()),

    settle: async (only) => {
      if (mirror === undefined) return ok([]);
      let name: ReplicaName | undefined;
      if (only !== undefined) {
        const parsed = replicas.find((r) => r.name === only);
        if (parsed === undefined) return fail({ kind: "mirror", problem: { kind: "unknown-replica", name: only } });
        name = parsed.name;
      }
      const settled = await mirror.settle(name);
      return settled.kind === "ok" ? ok(settled.value) : fail({ kind: "mirror", problem: settled.error });
    },

    promote: async (replica, options = {}) => {
      if (mirror === undefined) return fail({ kind: "no-mirror" });
      const named = [...replicas, config.primary].find((r) => r.name === replica);
      if (named === undefined) return fail({ kind: "mirror", problem: { kind: "unknown-replica", name: replica } });
      const promoted = await mirror.promote(named.name, { ...(options.acceptLoss === undefined ? {} : { acceptLoss: options.acceptLoss }), ...(options.acceptDivergence === undefined ? {} : { acceptDivergence: options.acceptDivergence }) });
      return promoted.kind === "ok" ? ok(promoted.value) : fail({ kind: "mirror", problem: promoted.error });
    },

    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    close: async () => {
      if (mirror !== undefined) await mirror.close();
      listeners.clear();
    },
  };
  return ok(fleet);
}
