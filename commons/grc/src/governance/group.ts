// Spec: 0009-grc-groups FR-001, FR-002, FR-003, FR-004, FR-005
// Spec: 0012-grc-subtenants FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
/**
 * A group of entities (0009-grc-groups): its controls are defined once and scoped to each entity. An entity is an opaque branded identifier; its ledger, evidence store, signing keys and secrets are
 * references the host resolves for that entity alone, never values. An entity may have one parent (0012-grc-subtenants), so that the entities form a tree, held by `EntityTree`. The scope is a
 * document that says which controls apply to which entity, and `applicability` is the pure function that answers it.
 *
 * @remarks
 * The model assumes nothing of how an entity's data is stored or kept apart from another's: a reference is an opaque name. A control scoped to an entity reaches its subtenants unless the nearest rule of
 * an entity on the way up says otherwise.
 *
 * @example
 * ```ts
 * import { entityId } from "./group.ts";
 * entityId("unit-a"); // { kind: "ok", value: "unit-a" }
 * entityId("Unit A"); // { kind: "err", error: "Unit A is not an entity id (lower-case words joined by - or .)" }
 * ```
 *
 * @module
 */
import { absurd, array, type Brand, boolean, type Decoded, type Decoder, err, literal, ok, object, refine, type Result, string, tagged } from "@intellectual-frontiers/core";
import { defineKind } from "./document.ts";
import { type Exception } from "./kinds.ts";
import { STABLE_ID } from "./registry.ts";
import { exceptionApplies } from "./rules.ts";

/** The identifier of an entity of a group: opaque, a stable id. */
export type EntityId = Brand<string, "EntityId">;
/** A reference to a port of one entity (its ledger, its store, a key): a stable id the host resolves for that entity alone. */
export type PortRef = Brand<string, "PortRef">;
/** A reference to a secret of one entity, never its value: `secret:` and a path of stable words. */
export type SecretRef = Brand<string, "SecretRef">;

const SECRET_REF = /^secret:[a-z0-9][a-z0-9._/-]*$/;

const isEntityId = (text: string): boolean => STABLE_ID.test(text);
const isSecretRef = (text: string): boolean => SECRET_REF.test(text);

/**
 * The decoder of an entity identifier.
 *
 * @example
 * ```ts
 * entityIdDecoder("unit-a").kind; // "ok"
 * ```
 */
export const entityIdDecoder: Decoder<EntityId> = refine(string, "EntityId", isEntityId);
/**
 * The decoder of a port reference.
 *
 * @example
 * ```ts
 * portRefDecoder("ledger-a").kind; // "ok"
 * ```
 */
export const portRefDecoder: Decoder<PortRef> = refine(string, "PortRef", isEntityId);
/**
 * The decoder of a secret reference: a value in its place is a decode error.
 *
 * @example
 * ```ts
 * secretRefDecoder("a value").kind; // "err"
 * ```
 */
export const secretRefDecoder: Decoder<SecretRef> = refine(string, "SecretRef", isSecretRef);

function made<B>(decode: Decoder<B>, text: string, what: string): Result<B, string> {
  const r = decode(text);
  return r.kind === "ok" ? ok(r.value) : err(`${text} is not ${what}`);
}

/** The entity identifier of `text`, or why it is not one. */
export function entityId(text: string): Result<EntityId, string> {
  return made(entityIdDecoder, text, "an entity id (lower-case words joined by - or .)");
}

/**
 * The port reference of `text`, or why it is not one.
 *
 * @example
 * ```ts
 * portRef("ledger-unit-a"); // { kind: "ok", value: "ledger-unit-a" }
 * ```
 */
export function portRef(text: string): Result<PortRef, string> {
  return made(portRefDecoder, text, "a port reference (lower-case words joined by - or .)");
}

/**
 * The secret reference of `text`, or why it is not one (`secret:` and a path such as `secret:unit-a/signing`).
 *
 * @example
 * ```ts
 * secretRef("secret:unit-a/signing"); // { kind: "ok", ... }
 * secretRef("hunter2"); // { kind: "err", ... }
 * ```
 */
export function secretRef(text: string): Result<SecretRef, string> {
  return made(secretRefDecoder, text, "a secret reference (secret: and a path)");
}

/**
 * One entity of a group: its identifier, the references to its own ports and, optionally, its parent.
 *
 * @example
 * ```ts
 * // entityDecoder({ id: "unit-a", title: "A", ledger: "l", store: "s", keys: [], secrets: [], parent: "unit" }).kind;
 * ```
 */
export const entityDecoder = object(
  {
    id: entityIdDecoder,
    title: string,
    ledger: portRefDecoder,
    store: portRefDecoder,
    keys: array(portRefDecoder),
    secrets: array(secretRefDecoder),
  },
  { parent: entityIdDecoder },
);
/** An entity of a group. */
export type Entity = Decoded<typeof entityDecoder>;

/** Why the entities of a group are not a tree. */
export type TreeFault =
  | { readonly kind: "duplicate-entity"; readonly entity: EntityId }
  | { readonly kind: "unknown-parent"; readonly entity: EntityId; readonly parent: EntityId }
  | { readonly kind: "cycle"; readonly entities: readonly EntityId[] };

/**
 * The sentence of a tree fault.
 *
 * @example
 * ```ts
 * // treeFaultMessage({ kind: "cycle", entities: [a, b] }); // "unit-a, unit-b are each other's ancestors"
 * ```
 */
export function treeFaultMessage(f: TreeFault): string {
  switch (f.kind) {
    case "duplicate-entity":
      return `the entity ${f.entity} is held twice`;
    case "unknown-parent":
      return `the parent ${f.parent} of ${f.entity} is not an entity of the group`;
    case "cycle":
      return `${f.entities.join(", ")} ${f.entities.length === 1 ? "is its own parent" : "are each other's ancestors"}`;
    default:
      return absurd(f);
  }
}

const byId = (a: EntityId, b: EntityId): number => (a < b ? -1 : a > b ? 1 : 0);

/** The faults of parents among `entities`: a parent that is not held, and each cycle once, from its least identifier. */
function parentFaults(entities: readonly Entity[]): readonly TreeFault[] {
  const parents = new Map<EntityId, EntityId | undefined>();
  for (const e of entities) if (!parents.has(e.id)) parents.set(e.id, e.parent);
  const ids = [...parents.keys()].sort(byId);
  const out: TreeFault[] = [];
  for (const id of ids) {
    const parent = parents.get(id);
    if (parent !== undefined && !parents.has(parent)) out.push({ kind: "unknown-parent", entity: id, parent });
  }
  const done = new Set<EntityId>();
  for (const start of ids) {
    const path: EntityId[] = [];
    let at: EntityId | undefined = start;
    while (at !== undefined && parents.has(at) && !done.has(at)) {
      const seen = path.indexOf(at);
      if (seen >= 0) {
        const loop = path.slice(seen);
        const least = loop.reduce((a, b) => (byId(b, a) < 0 ? b : a));
        const from = loop.indexOf(least);
        out.push({ kind: "cycle", entities: [...loop.slice(from), ...loop.slice(0, from)] });
        break;
      }
      path.push(at);
      at = parents.get(at);
    }
    for (const x of path) done.add(x);
  }
  return out;
}

/**
 * A group of entities. The id of the document is the group's slug; the decoder refuses a parent the group does not hold and a cycle of parents.
 *
 * @example
 * ```ts
 * // entityGroup.decode(document).kind; // "ok" for a group of entities with references as ports
 * ```
 */
export const entityGroup = defineKind("grc.entity-group", "1", { title: string, entities: array(entityDecoder) }, undefined, (g) => {
  const fault = parentFaults(g.entities)[0];
  return fault === undefined ? undefined : treeFaultMessage(fault);
});
/** A group of entities. */
export type EntityGroup = Decoded<typeof entityGroup.decode>;

/**
 * The entities of a group as a tree (0012-grc-subtenants): each entity has at most one parent and none is its own ancestor. Made only by `entityTree`.
 *
 * @example
 * ```ts
 * // const tree = entityTree(group); if (tree.kind === "ok") tree.value.ancestorsOf(subtenant); // [parent, grandparent]
 * ```
 */
export class EntityTree {
  readonly #parents: ReadonlyMap<EntityId, EntityId>;
  readonly #children: ReadonlyMap<EntityId, readonly EntityId[]>;
  /** The group the tree is of. */
  readonly group: EntityGroup;
  /** Every entity, in the order of the identifiers. */
  readonly entities: readonly EntityId[];
  /** The entities with no parent, in the order of the identifiers. */
  readonly roots: readonly EntityId[];

  private constructor(group: EntityGroup, entities: readonly EntityId[], parents: ReadonlyMap<EntityId, EntityId>, children: ReadonlyMap<EntityId, readonly EntityId[]>) {
    this.group = group;
    this.entities = entities;
    this.#parents = parents;
    this.#children = children;
    this.roots = entities.filter((e) => !parents.has(e));
  }

  /**
   * The tree of `group`, or why it is not one.
   *
   * @example
   * ```ts
   * // EntityTree.of(group).kind; // "ok"
   * ```
   */
  static of(group: EntityGroup): Result<EntityTree, TreeFault> {
    const seen = new Set<EntityId>();
    for (const e of group.entities) {
      if (seen.has(e.id)) return err({ kind: "duplicate-entity", entity: e.id });
      seen.add(e.id);
    }
    const fault = parentFaults(group.entities)[0];
    if (fault !== undefined) return err(fault);
    const parents = new Map<EntityId, EntityId>();
    const kids = new Map<EntityId, EntityId[]>();
    for (const e of group.entities) {
      if (e.parent === undefined) continue;
      parents.set(e.id, e.parent);
      kids.set(e.parent, [...(kids.get(e.parent) ?? []), e.id]);
    }
    for (const list of kids.values()) list.sort(byId);
    return ok(new EntityTree(group, [...seen].sort(byId), parents, kids));
  }

  /** The parent of `entity`, if it has one. */
  parentOf(entity: EntityId): EntityId | undefined {
    return this.#parents.get(entity);
  }

  /** The children of `entity`, in the order of the identifiers. */
  childrenOf(entity: EntityId): readonly EntityId[] {
    return this.#children.get(entity) ?? [];
  }

  /** The ancestors of `entity` from the nearest: its parent, then the parent's parent. */
  ancestorsOf(entity: EntityId): readonly EntityId[] {
    const out: EntityId[] = [];
    for (let at = this.#parents.get(entity); at !== undefined; at = this.#parents.get(at)) out.push(at);
    return out;
  }

  /** The descendants of `entity`, depth first, each level in the order of the identifiers. */
  descendantsOf(entity: EntityId): readonly EntityId[] {
    return this.childrenOf(entity).flatMap((c) => [c, ...this.descendantsOf(c)]);
  }

  /** The number of ancestors of `entity`. */
  depthOf(entity: EntityId): number {
    return this.ancestorsOf(entity).length;
  }
}

/**
 * The tree of a group, or why its entities are not one: an entity held twice, a parent the group does not hold, a cycle.
 *
 * @example
 * ```ts
 * // entityTree(group); // { kind: "ok", value: EntityTree } or { kind: "err", error: { kind: "cycle", entities: [...] } }
 * ```
 */
export function entityTree(group: EntityGroup): Result<EntityTree, TreeFault> {
  return EntityTree.of(group);
}

/** Which entities a rule of the scope reaches: all, only those listed, or all but those listed. */
export type Selector =
  | { readonly kind: "all" }
  | { readonly kind: "only"; readonly entities: readonly EntityId[] }
  | { readonly kind: "except"; readonly entities: readonly EntityId[] };

/**
 * The decoder of a selector.
 *
 * @example
 * ```ts
 * selector({ kind: "only", entities: ["unit-a"] }).kind; // "ok"
 * ```
 */
export const selector: Decoder<Selector> = tagged({
  all: object({ kind: literal("all") }),
  only: object({ kind: literal("only"), entities: array(entityIdDecoder) }),
  except: object({ kind: literal("except"), entities: array(entityIdDecoder) }),
});

/**
 * The scoping of a group's controls: a rule names a control and the entities it applies to; a control no rule names applies to every entity. A rule may be the word of one entity on the control (`for`: it ranges
 * over that entity and its descendants), and its selector stands for the descendants of the entities it names unless `inherit` is false (0012-grc-subtenants).
 *
 * @example
 * ```ts
 * // controlScope.decode(document).kind;
 * ```
 */
export const controlScope = defineKind("grc.control-scope", "1", {
  group: string,
  rules: array(object({ control: string, entities: selector }, { for: entityIdDecoder, inherit: boolean, note: string })),
});
/** A control scope. */
export type ControlScope = Decoded<typeof controlScope.decode>;
/** A rule of a control scope. */
export type ScopeRule = ControlScope["rules"][number];

/** Whether a control applies to an entity. */
export type Applicability = "applies" | "not-applicable";

/** One cell of the matrix: a control and an entity. */
export type ApplicabilityCell = { readonly control: string; readonly entity: EntityId; readonly applicability: Applicability };

/** Whether `list` names `entity`, or, where the rule inherits, an ancestor of it. */
function names(rule: ScopeRule, list: readonly EntityId[], tree: EntityTree, entity: EntityId): boolean {
  return list.includes(entity) || (rule.inherit !== false && tree.ancestorsOf(entity).some((a) => list.includes(a)));
}

function reaches(rule: ScopeRule, tree: EntityTree, entity: EntityId): boolean {
  const s = rule.entities;
  switch (s.kind) {
    case "all":
      return true;
    case "only":
      return names(rule, s.entities, tree, entity);
    case "except":
      return !names(rule, s.entities, tree, entity);
    default:
      return absurd(s);
  }
}

/**
 * Whether `control` applies to `entity` by the scope: the nearest explicit rule decides. The rules that name the control are looked at on the way up from the entity (a rule `for` an ancestor counts
 * where it inherits), then the rule of the group; a control no rule on the way names applies.
 *
 * @example
 * ```ts
 * // appliesTo(scope, tree, "urn:grc:ex:1:A-1", unitA); // "applies" where no rule names the control
 * ```
 */
export function appliesTo(scope: ControlScope, tree: EntityTree, control: string, entity: EntityId): Applicability {
  const rules = scope.rules.filter((r) => r.control === control);
  const own = [entity, ...tree.ancestorsOf(entity)].flatMap((x) => rules.filter((r) => r.for === x && (x === entity || r.inherit !== false)));
  const decisive = own[0] ?? rules.find((r) => r.for === undefined);
  return decisive === undefined || reaches(decisive, tree, entity) ? "applies" : "not-applicable";
}

/**
 * The applicability of every control to every entity of the tree, controls first, in the order given and the order of the identifiers.
 *
 * @example
 * ```ts
 * // applicability(tree, scope, ["urn:grc:ex:1:A-1"]).map((c) => c.applicability);
 * ```
 */
export function applicability(tree: EntityTree, scope: ControlScope, controls: readonly string[]): readonly ApplicabilityCell[] {
  return controls.flatMap((control) => tree.entities.map((entity) => ({ control, entity, applicability: appliesTo(scope, tree, control, entity) })));
}

/**
 * Whether an exception excuses `entity` at `at`: it applies to the entity, or, only where it is `inheritable`, to an ancestor of it.
 *
 * @example
 * ```ts
 * // exceptionCovers(exceptionOfParent, tree, subtenant, at); // false unless the exception says inheritable: true
 * ```
 */
export function exceptionCovers(e: Exception, tree: EntityTree, entity: EntityId, at: string): boolean {
  return exceptionApplies(e, entity, at) || (e.inheritable === true && tree.ancestorsOf(entity).some((a) => exceptionApplies(e, a, at)));
}

/** The rules of `scopeProblems`. */
export type ProblemRule =
  | "entity/duplicate"
  | "entity/unknown-parent"
  | "entity/parent-cycle"
  | "scope/unknown-entity"
  | "scope/unknown-control"
  | "scope/duplicate-control"
  | "scope/duplicate-entity"
  | "scope/outside-anchor";

/** A problem of a group and its scope. */
export type ScopeProblem = { readonly rule: ProblemRule; readonly id: string; readonly message: string };

/**
 * Every problem of a group and its scope, as data.
 *
 * @example
 * ```ts
 * // scopeProblems(group, scope, controls).map((p) => p.rule); // [] for a sound scope
 * ```
 */
export function scopeProblems(group: EntityGroup, scope: ControlScope, controls: readonly string[]): readonly ScopeProblem[] {
  const out: ScopeProblem[] = [];
  const problem = (rule: ProblemRule, id: string, message: string): number => out.push({ rule, id, message });
  const known = new Set<string>();
  for (const e of group.entities) {
    if (known.has(e.id)) problem("entity/duplicate", e.id, `${group.id} holds the entity ${e.id} twice`);
    known.add(e.id);
  }
  for (const f of parentFaults(group.entities)) {
    if (f.kind === "unknown-parent") problem("entity/unknown-parent", f.entity, `${group.id}: ${treeFaultMessage(f)}`);
    else if (f.kind === "cycle") problem("entity/parent-cycle", f.entities.join(","), `${group.id}: ${treeFaultMessage(f)}`);
  }
  const built = entityTree(group);
  const tree = built.kind === "ok" ? built.value : undefined;
  const urns = new Set(controls);
  const named = new Set<string>();
  for (const r of scope.rules) {
    if (!urns.has(r.control)) problem("scope/unknown-control", r.control, `${scope.id} names ${r.control}, which is not a control of the group`);
    const key = `${r.control} ${r.for ?? ""}`;
    if (named.has(key)) problem("scope/duplicate-control", r.control, `${scope.id} scopes ${r.control} twice${r.for === undefined ? "" : ` for ${r.for}`}`);
    named.add(key);
    if (r.for !== undefined && !known.has(r.for)) problem("scope/unknown-entity", r.for, `${scope.id} states a rule for the entity ${r.for}, which ${group.id} does not hold`);
    if (r.entities.kind === "all") continue;
    const range = r.for === undefined || tree === undefined ? undefined : new Set<EntityId>([r.for, ...tree.descendantsOf(r.for)]);
    const seen = new Set<string>();
    for (const id of r.entities.entities) {
      if (!known.has(id)) problem("scope/unknown-entity", id, `${scope.id} names the entity ${id}, which ${group.id} does not hold`);
      else if (range !== undefined && !range.has(id)) problem("scope/outside-anchor", id, `${scope.id} names ${id} for ${r.control}, outside what ${r.for} ranges over`);
      if (seen.has(id)) problem("scope/duplicate-entity", id, `${scope.id} lists ${id} twice for ${r.control}`);
      seen.add(id);
    }
  }
  return out;
}
