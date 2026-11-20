// Spec: 0009-grc-groups FR-001, FR-002, FR-003, FR-004, FR-005
/**
 * A group of entities (0009-grc-groups): its controls are defined once and scoped to each entity. An entity is an opaque branded identifier; its ledger, evidence store, signing keys and secrets are
 * references the host resolves for that entity alone, never values. The scope is a document that says which controls apply to which entity, and `applicability` is the pure function that
 * answers it.
 *
 * @remarks
 * The model assumes nothing of how an entity's data is stored or kept apart from another's: a reference is an opaque name.
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
import { array, type Brand, type Decoded, type Decoder, err, literal, ok, object, refine, type Result, string, tagged } from "@intellectual-frontiers/core";
import { defineKind } from "./document.ts";
import { STABLE_ID } from "./registry.ts";

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
 * One entity of a group: its identifier and the references to its own ports.
 *
 * @example
 * ```ts
 * // entityDecoder({ id: "unit-a", title: "A", ledger: "l", store: "s", keys: [], secrets: [] }).kind;
 * ```
 */
export const entityDecoder = object({
  id: entityIdDecoder,
  title: string,
  ledger: portRefDecoder,
  store: portRefDecoder,
  keys: array(portRefDecoder),
  secrets: array(secretRefDecoder),
});
/** An entity of a group. */
export type Entity = Decoded<typeof entityDecoder>;

/**
 * A group of entities. The id of the document is the group's slug.
 *
 * @example
 * ```ts
 * // entityGroup.decode(document).kind; // "ok" for a group of entities with references as ports
 * ```
 */
export const entityGroup = defineKind("grc.entity-group", "1", { title: string, entities: array(entityDecoder) });
/** A group of entities. */
export type EntityGroup = Decoded<typeof entityGroup.decode>;

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
 * The scoping of a group's controls: a rule names a control and the entities it applies to; a control no rule names applies to every entity.
 *
 * @example
 * ```ts
 * // controlScope.decode(document).kind;
 * ```
 */
export const controlScope = defineKind("grc.control-scope", "1", {
  group: string,
  rules: array(object({ control: string, entities: selector }, { note: string })),
});
/** A control scope. */
export type ControlScope = Decoded<typeof controlScope.decode>;

/** Whether a control applies to an entity. */
export type Applicability = "applies" | "not-applicable";

/** One cell of the matrix: a control and an entity. */
export type ApplicabilityCell = { readonly control: string; readonly entity: EntityId; readonly applicability: Applicability };

function reaches(s: Selector, entity: EntityId): boolean {
  switch (s.kind) {
    case "all":
      return true;
    case "only":
      return s.entities.includes(entity);
    case "except":
      return !s.entities.includes(entity);
  }
}

/**
 * Whether `control` applies to `entity` by the scope: the first rule that names the control decides, and a control no rule names applies.
 *
 * @example
 * ```ts
 * // appliesTo(scope, "urn:grc:ex:1:A-1", unitA); // "applies" where no rule names the control
 * ```
 */
export function appliesTo(scope: ControlScope, control: string, entity: EntityId): Applicability {
  const rule = scope.rules.find((r) => r.control === control);
  return rule === undefined || reaches(rule.entities, entity) ? "applies" : "not-applicable";
}

/**
 * The applicability of every control to every entity of the group, controls first, in the order given.
 *
 * @example
 * ```ts
 * // applicability(group, scope, ["urn:grc:ex:1:A-1"]).map((c) => c.applicability);
 * ```
 */
export function applicability(group: EntityGroup, scope: ControlScope, controls: readonly string[]): readonly ApplicabilityCell[] {
  return controls.flatMap((control) => group.entities.map((e) => ({ control, entity: e.id, applicability: appliesTo(scope, control, e.id) })));
}

/** The rules of `scopeProblems`. */
export type ScopeRule = "entity/duplicate" | "scope/unknown-entity" | "scope/unknown-control" | "scope/duplicate-control" | "scope/duplicate-entity";

/** A problem of a group and its scope. */
export type ScopeProblem = { readonly rule: ScopeRule; readonly id: string; readonly message: string };

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
  const problem = (rule: ScopeRule, id: string, message: string): number => out.push({ rule, id, message });
  const known = new Set<string>();
  for (const e of group.entities) {
    if (known.has(e.id)) problem("entity/duplicate", e.id, `${group.id} holds the entity ${e.id} twice`);
    known.add(e.id);
  }
  const urns = new Set(controls);
  const named = new Set<string>();
  for (const r of scope.rules) {
    if (!urns.has(r.control)) problem("scope/unknown-control", r.control, `${scope.id} names ${r.control}, which is not a control of the group`);
    if (named.has(r.control)) problem("scope/duplicate-control", r.control, `${scope.id} scopes ${r.control} twice`);
    named.add(r.control);
    if (r.entities.kind === "all") continue;
    const seen = new Set<string>();
    for (const id of r.entities.entities) {
      if (!known.has(id)) problem("scope/unknown-entity", id, `${scope.id} names the entity ${id}, which ${group.id} does not hold`);
      if (seen.has(id)) problem("scope/duplicate-entity", id, `${scope.id} lists ${id} twice for ${r.control}`);
      seen.add(id);
    }
  }
  return out;
}
