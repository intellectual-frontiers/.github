// Spec: 0009-grc-groups FR-006, FR-007, FR-008, FR-009, FR-010
// Spec: 0012-grc-subtenants FR-007, FR-008, FR-009, FR-010, FR-011
/**
 * The group view (0009-grc-groups): an entity gives the group a snapshot of statuses and digests through a reader function it owns, and the group joins the snapshots into coverage and a roll-up with the
 * functions the single-entity view already has (`join`, `coverage`, `rollup`). An entity that cannot be read is `pending`, never an assumed pass. Nothing here takes the data of two entities from
 * one place: the group learns of an entity through its reader alone. The entities form a tree (0012-grc-subtenants): the view gives each entity its own status and its rolled-up status, the join of its own and
 * its subtenants', made from the snapshots alone.
 *
 * @remarks
 * `pending` (a question not yet answered) and `gap` (a control that nothing shows) are `unaligned`: no outside standard defines them.
 *
 * @limits
 * It does not resolve a port, a key or a secret, and it does not say how an entity's data is stored: the host makes each entity's reader.
 *
 * @example
 * ```ts
 * import { groupView } from "./group.ts";
 * // groupView({ tree, scope, controls, readings, exceptions: [], at: "2026-06-01T00:00:00Z" }).overall.worst; // "pending" while an entity is unread
 * ```
 *
 * @module
 */
import { array, type Decoded, err, literal, ok, object, type Result, string } from "@intellectual-frontiers/core";
import {
  type Check,
  type Crosswalk,
  type ControlScope,
  controlUrns,
  defineKind,
  type EntityGroup,
  type EntityId,
  entityIdDecoder,
  type EntityTree,
  type Exception,
  exceptionCovers,
  type Framework,
  instant,
  instantMs,
  appliesTo,
  provenanceOf,
  SEVERITIES,
  type Severity,
} from "@intellectual-frontiers/grc/governance";
import { digestOf } from "./canonical.ts";
import { applyExceptions, COVERAGE_STATES, type CoverageState, coverage, newestResults, type Rollup, rollup } from "./compute.ts";
import { join, joinAll } from "./evaluate.ts";
import { type Result as Outcome, STATUSES, type Status } from "./kinds.ts";

/**
 * What an entity gives the group: statuses and digests of its controls, the head of its ledger, and nothing else.
 *
 * @example
 * ```ts
 * // entitySnapshot.decode(document).kind;
 * ```
 */
export const entitySnapshot = defineKind("grc.entity-snapshot", "1", {
  entity: entityIdDecoder,
  ledgerHead: string,
  controls: array(
    object(
      { control: string, status: literal(...STATUSES), coverage: literal(...COVERAGE_STATES), severity: literal(...SEVERITIES), digests: array(string) },
      { observedAt: instant },
    ),
  ),
});
/** A snapshot of one entity. */
export type EntitySnapshot = Decoded<typeof entitySnapshot.decode>;

/** What an entity's own side is given to make its snapshot: its own results and exceptions, and the group's frameworks, crosswalks and checks, defined once. */
export type SnapshotInput = {
  readonly entity: EntityId;
  readonly frameworks: readonly Framework[];
  readonly crosswalks: readonly Crosswalk[];
  readonly checks: readonly Check[];
  readonly results: readonly Outcome[];
  readonly exceptions: readonly Exception[];
  readonly ledgerHead: string;
};

/**
 * The snapshot of an entity at `at`, made from its own data: the newest results with the exceptions applied, and the coverage of every control.
 *
 * @example
 * ```ts
 * // const made = await snapshotOf({ entity, frameworks, crosswalks, checks, results, exceptions, ledgerHead }, "2026-06-01T00:00:00Z");
 * ```
 */
export async function snapshotOf(input: SnapshotInput, at: string): Promise<Result<EntitySnapshot, string>> {
  if (instantMs(at) === undefined) return err(`${at} is not an ISO 8601 instant`);
  const applied = applyExceptions(newestResults(input.results), input.exceptions, at);
  const covered = new Map(coverage(input.frameworks, input.crosswalks, input.checks, applied, at).map((c) => [c.urn, c.state]));
  const controls: EntitySnapshot["controls"][number][] = [];
  for (const urn of [...controlUrns(input.frameworks)].sort()) {
    const own = applied.filter((r) => r.controls.includes(urn));
    const newest = own.map((r) => r.observedAt).sort().at(-1);
    const digests = (await Promise.all(own.map((r) => digestOf(r)))).sort();
    controls.push({
      control: urn,
      status: own.length === 0 ? "gap" : joinAll(own.map((r) => r.status)),
      coverage: covered.get(urn) ?? "gap",
      severity: highest(own.map((r) => r.severity)),
      digests,
      ...(newest === undefined ? {} : { observedAt: newest }),
    });
  }
  return ok({
    kind: "grc.entity-snapshot",
    schema: "1",
    id: `snapshot:${input.entity}:${at}`,
    createdAt: at,
    provenance: provenanceOf([input.ledgerHead]),
    entity: input.entity,
    ledgerHead: input.ledgerHead,
    controls,
  });
}

function highest(severities: readonly Severity[]): Severity {
  return severities.reduce<Severity>((a, b) => (SEVERITIES.indexOf(b) > SEVERITIES.indexOf(a) ? b : a), "medium");
}

/** Why an entity could not be read. */
export type ReadFault = { readonly kind: "unreachable" | "denied" | "malformed"; readonly message: string };

/** The reader of one entity, made by the host for that entity alone: given the instant, nothing else, it answers with a snapshot or a fault. */
export type EntityReader = (at: string) => Promise<Result<EntitySnapshot, ReadFault>>;

/** The readers of a group, by entity. */
export type Readers = ReadonlyMap<EntityId, EntityReader>;

/** What reading an entity gave. */
export type EntityReading =
  | { readonly kind: "read"; readonly snapshot: EntitySnapshot }
  | { readonly kind: "unread"; readonly entity: EntityId; readonly fault: ReadFault };

/**
 * The entity a reading is of.
 *
 * @example
 * ```ts
 * // entityOf({ kind: "unread", entity, fault: { kind: "unreachable", message: "down" } }) === entity;
 * ```
 */
export function entityOf(reading: EntityReading): EntityId {
  return reading.kind === "read" ? reading.snapshot.entity : reading.entity;
}

/**
 * A snapshot rebuilt from its known fields, so that nothing else passes through.
 *
 * @example
 * ```ts
 * // normalizeSnapshot(snapshot); // the same snapshot with nothing but its known fields
 * ```
 */
export function normalizeSnapshot(s: EntitySnapshot): EntitySnapshot {
  return {
    kind: "grc.entity-snapshot",
    schema: "1",
    id: s.id,
    createdAt: s.createdAt,
    provenance: { producer: { name: s.provenance.producer.name, version: s.provenance.producer.version }, inputs: [...s.provenance.inputs] },
    entity: s.entity,
    ledgerHead: s.ledgerHead,
    controls: s.controls.map((c) => ({
      control: c.control,
      status: c.status,
      coverage: c.coverage,
      severity: c.severity,
      digests: [...c.digests],
      ...(c.observedAt === undefined ? {} : { observedAt: c.observedAt }),
    })),
  };
}

/**
 * Reads each entity of the group through its own reader, given the instant and nothing else; a reader that rejects, throws, gives another entity's snapshot or gives what is not a snapshot is a fault, and an entity with no reader is unreachable.
 *
 * @example
 * ```ts
 * // const readings = await readGroup(group, new Map([[unitA, readerOfA]]), "2026-06-01T00:00:00Z"); // the others are unread
 * ```
 */
export async function readGroup(group: EntityGroup, readers: Readers, at: string): Promise<readonly EntityReading[]> {
  const readings = await Promise.all(
    group.entities.map(async (e): Promise<EntityReading> => {
      const unread = (kind: ReadFault["kind"], message: string): EntityReading => ({ kind: "unread", entity: e.id, fault: { kind, message } });
      const reader = readers.get(e.id);
      if (reader === undefined) return unread("unreachable", `no reader for ${e.id}`);
      try {
        const r = await reader(at);
        if (r.kind === "err") return { kind: "unread", entity: e.id, fault: r.error };
        const decoded = entitySnapshot.decode(r.value);
        if (decoded.kind === "err") return unread("malformed", `${decoded.error.path}: expected ${decoded.error.expected}`);
        if (decoded.value.entity !== e.id) return unread("malformed", `the reader of ${e.id} gave the snapshot of ${decoded.value.entity}`);
        return { kind: "read", snapshot: normalizeSnapshot(decoded.value) };
      } catch (x) {
        return unread("unreachable", x instanceof Error ? x.message : String(x));
      }
    }),
  );
  return readings.sort((a, b) => (entityOf(a) < entityOf(b) ? -1 : entityOf(a) > entityOf(b) ? 1 : 0));
}

/** The coverage of a group's cell: an entity's own, or `unknown` for one that could not be read. */
export type GroupCoverage = CoverageState | "unknown";

/**
 * Group coverage from the best to the worst; `unknown` is worse than anything an entity shows short of failing.
 *
 * @example
 * ```ts
 * GROUP_COVERAGE_ORDER.indexOf("unknown") > GROUP_COVERAGE_ORDER.indexOf("partial"); // true
 * ```
 */
export const GROUP_COVERAGE_ORDER = ["covered", "accepted", "stale", "partial", "untested", "unknown", "failing", "gap"] as const satisfies readonly GroupCoverage[];

/**
 * The worse of two group coverages: associative, commutative and idempotent.
 *
 * @example
 * ```ts
 * joinCoverage("covered", "unknown"); // "unknown"
 * ```
 */
export function joinCoverage(a: GroupCoverage, b: GroupCoverage): GroupCoverage {
  return GROUP_COVERAGE_ORDER.indexOf(a) >= GROUP_COVERAGE_ORDER.indexOf(b) ? a : b;
}

/** One control of one entity in the group view. */
export type GroupCell = {
  readonly control: string;
  readonly entity: EntityId;
  readonly status: Status;
  readonly coverage: GroupCoverage | "not-applicable";
  readonly severity: Severity;
  readonly reading: "read" | "unread";
};

/** One control across the entities it applies to. */
export type ControlRollup = {
  readonly control: string;
  readonly status: Status;
  readonly coverage: GroupCoverage | "not-applicable";
  readonly applicable: number;
};

/** One entity of the tree in the view: its place, its own status and coverage (the join of its cells), and its rolled-up status and coverage (the join of its own and its subtenants' rolled-up). */
export type EntityRollup = {
  readonly entity: EntityId;
  readonly parent?: EntityId;
  readonly children: readonly EntityId[];
  readonly depth: number;
  readonly own: Status;
  readonly rolledUp: Status;
  readonly ownCoverage: GroupCoverage | "not-applicable";
  readonly rolledUpCoverage: GroupCoverage | "not-applicable";
  readonly reading: "read" | "unread";
  readonly share: number | undefined;
};

/** The view of a group at an instant. */
export type GroupView = {
  readonly at: string;
  readonly roots: readonly EntityId[];
  readonly cells: readonly GroupCell[];
  readonly controls: readonly ControlRollup[];
  readonly entities: readonly EntityRollup[];
  readonly overall: Rollup;
};

/** What `groupView` reads. */
export type GroupViewInput = {
  readonly tree: EntityTree;
  readonly scope: ControlScope;
  readonly controls: readonly string[];
  readonly readings: readonly EntityReading[];
  readonly exceptions: readonly Exception[];
  readonly at: string;
};

function cellOf(input: GroupViewInput, control: string, entity: EntityId, reading: EntityReading | undefined): GroupCell {
  if (appliesTo(input.scope, input.tree, control, entity) === "not-applicable") {
    return { control, entity, status: "not-applicable", coverage: "not-applicable", severity: "info", reading: reading?.kind === "read" ? "read" : "unread" };
  }
  if (reading === undefined || reading.kind === "unread") return { control, entity, status: "pending", coverage: "unknown", severity: "medium", reading: "unread" };
  const state = reading.snapshot.controls.find((c) => c.control === control);
  if (state === undefined) return { control, entity, status: "gap", coverage: "gap", severity: "medium", reading: "read" };
  const excused =
    (state.status === "fail" || state.status === "warn") &&
    input.exceptions.some((e) => e.excuses.type === "control" && e.excuses.ref === control && exceptionCovers(e, input.tree, entity, input.at));
  return excused
    ? { control, entity, status: "accepted", coverage: "accepted", severity: state.severity, reading: "read" }
    : { control, entity, status: state.status, coverage: state.coverage, severity: state.severity, reading: "read" };
}

function asResult(c: GroupCell, at: string): Outcome {
  return {
    kind: "grc.result",
    schema: "1",
    id: `cell:${c.entity}:${c.control}`,
    createdAt: at,
    provenance: provenanceOf([]),
    check: c.control,
    controls: [c.control],
    subject: c.entity,
    status: c.status,
    severity: c.severity,
    reason: c.reading === "unread" ? "the entity was not read" : "read from the entity's snapshot",
    observedAt: at,
  };
}

/** The worse of two coverages of a cell, `not-applicable` being what nothing applies to. */
function joinCells(a: GroupCoverage | "not-applicable", b: GroupCoverage | "not-applicable"): GroupCoverage | "not-applicable" {
  return a === "not-applicable" ? b : b === "not-applicable" ? a : joinCoverage(a, b);
}

/**
 * The group view at `at`: a cell for every control and entity (the controls and the entities in order), rolled up by control, by entity with its subtenants and overall; the same for any order of the readings,
 * of the controls and of the entities. Nothing is read but the readings: a snapshot holds no evidence.
 *
 * @example
 * ```ts
 * // groupView({ tree, scope, controls, readings, exceptions: [], at }).entities[0]?.rolledUp;
 * ```
 */
export function groupView(input: GroupViewInput): GroupView {
  const controls = [...new Set(input.controls)].sort();
  const entities = input.tree.entities;
  const byEntity = new Map(input.readings.map((r) => [entityOf(r), r]));
  const cells = controls.flatMap((c) => entities.map((e) => cellOf(input, c, e, byEntity.get(e))));
  const results = cells.map((c) => asResult(c, input.at));
  const applicable = (c: GroupCell): boolean => c.status !== "not-applicable";
  const controlRollups = controls.map((control): ControlRollup => {
    const mine = cells.filter((c) => c.control === control && applicable(c));
    return {
      control,
      status: joinAll(mine.map((c) => c.status)),
      coverage: mine.length === 0 ? "not-applicable" : mine.map((c) => c.coverage).reduce<GroupCoverage>((a, b) => (b === "not-applicable" ? a : joinCoverage(a, b)), "covered"),
      applicable: mine.length,
    };
  });
  const own = new Map(
    entities.map((entity) => {
      const mine = cells.filter((c) => c.entity === entity);
      return [entity, { status: mine.map((c) => c.status).reduce<Status>(join, "not-applicable"), coverage: mine.map((c) => c.coverage).reduce(joinCells, "not-applicable" as GroupCoverage | "not-applicable") }] as const;
    }),
  );
  const rolled = new Map<EntityId, { readonly status: Status; readonly coverage: GroupCoverage | "not-applicable" }>();
  const rolledUp = (entity: EntityId): { readonly status: Status; readonly coverage: GroupCoverage | "not-applicable" } => {
    const known = rolled.get(entity);
    if (known !== undefined) return known;
    const mine = own.get(entity) ?? { status: "not-applicable" as Status, coverage: "not-applicable" as const };
    const children = input.tree.childrenOf(entity).map(rolledUp);
    const value = { status: children.reduce<Status>((a, c) => join(a, c.status), mine.status), coverage: children.reduce((a, c) => joinCells(a, c.coverage), mine.coverage) };
    rolled.set(entity, value);
    return value;
  };
  const entityRollups = entities.map((entity): EntityRollup => {
    const parent = input.tree.parentOf(entity);
    const mine = own.get(entity);
    const all = rolledUp(entity);
    return {
      entity,
      ...(parent === undefined ? {} : { parent }),
      children: input.tree.childrenOf(entity),
      depth: input.tree.depthOf(entity),
      own: mine?.status ?? "not-applicable",
      rolledUp: all.status,
      ownCoverage: mine?.coverage ?? "not-applicable",
      rolledUpCoverage: all.coverage,
      reading: byEntity.get(entity)?.kind === "read" ? "read" : "unread",
      share: rollup(results.filter((r) => r.subject === entity)).share,
    };
  });
  return { at: input.at, roots: input.tree.roots, cells, controls: controlRollups, entities: entityRollups, overall: rollup(results) };
}
