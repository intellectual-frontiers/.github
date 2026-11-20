// Spec: 0003-archon-logical FR-001, FR-002, FR-003
/**
 * The order of one subject: the requirements that apply to it, taken from layers (a baseline, a fleet and a host, the higher replacing the lower), in the order they can be carried out. It is made
 * from values and returns a value, and it refuses what cannot be carried out: a requirement twice in a layer, a dependency that is not there and a cycle.
 *
 * @example
 * ```ts
 * import { buildOrder } from "./order.ts";
 * // buildOrder({ subject, assurance: "solo", layers: [{ layer: "baseline", requirements }] })
 * ```
 *
 * @module
 */
import { err, ok, order as sequence, type Result } from "@intellectual-frontiers/core";
import { KINDS, selects, type KindSpec, type ProfileName, type Requirement, type RequirementId, type SubjectClass, type SubjectName } from "@intellectual-frontiers/archon/governance";

/** The layers of precedence, from the lowest to the highest. */
export type Layer = "baseline" | "fleet" | "host";
/** Every layer, from the lowest to the highest. */
export const LAYERS: readonly Layer[] = ["baseline", "fleet", "host"];

/** The requirements of one layer. */
export type LayerOfRequirements = { readonly layer: Layer; readonly requirements: readonly Requirement[] };

/** What an order is for. */
export type Subject = { readonly name: SubjectName; readonly class: SubjectClass };

/** A requirement that a higher layer replaced. */
export type Replaced = { readonly id: RequirementId; readonly was: Layer; readonly by: Layer };

/** The order of a subject. */
export type Order = {
  readonly subject: Subject;
  readonly assurance: ProfileName;
  /** The requirements that apply, each after the ones it depends on. */
  readonly requirements: readonly Requirement[];
  readonly replaced: readonly Replaced[];
};

/** Why an order could not be made. */
export type OrderProblem =
  | { readonly kind: "duplicate"; readonly id: RequirementId; readonly layer: Layer }
  | { readonly kind: "missing-dependency"; readonly id: RequirementId; readonly dependsOn: RequirementId }
  | { readonly kind: "cycle"; readonly ids: readonly RequirementId[] };

/** What `buildOrder` takes. */
export type OrderInput = {
  readonly subject: Subject;
  readonly assurance: ProfileName;
  readonly layers: readonly LayerOfRequirements[];
  readonly catalogue?: readonly KindSpec[];
};

/** The order of a subject, or every reason it cannot be made. */
export function buildOrder(input: OrderInput): Result<Order, readonly OrderProblem[]> {
  const catalogue = input.catalogue ?? KINDS;
  const problems: OrderProblem[] = [];
  const chosen = new Map<RequirementId, { readonly requirement: Requirement; readonly layer: Layer }>();
  const replaced: Replaced[] = [];

  for (const layer of LAYERS) {
    const seen = new Set<RequirementId>();
    for (const group of input.layers.filter((g) => g.layer === layer)) {
      for (const requirement of group.requirements) {
        if (seen.has(requirement.id)) problems.push({ kind: "duplicate", id: requirement.id, layer });
        seen.add(requirement.id);
        if (!selects(requirement.subject, input.subject)) continue;
        const kind = catalogue.find((k) => k.id === requirement.kind);
        if (kind === undefined || !kind.subjects.includes(input.subject.class)) continue;
        const before = chosen.get(requirement.id);
        if (before !== undefined) replaced.push({ id: requirement.id, was: before.layer, by: layer });
        chosen.set(requirement.id, { requirement, layer });
      }
    }
  }

  const graph = new Map<RequirementId, readonly RequirementId[]>();
  for (const [id, { requirement }] of chosen) {
    graph.set(id, requirement.dependsOn);
    for (const d of requirement.dependsOn) if (!chosen.has(d)) problems.push({ kind: "missing-dependency", id, dependsOn: d });
  }
  const sequenced = sequence(graph);
  if (sequenced.kind === "err") problems.push({ kind: "cycle", ids: sequenced.error.nodes });
  if (problems.length > 0 || sequenced.kind === "err") return err(problems);

  const requirements: Requirement[] = [];
  for (const id of sequenced.value) {
    const c = chosen.get(id);
    if (c !== undefined) requirements.push(c.requirement);
  }
  return ok({ subject: input.subject, assurance: input.assurance, requirements, replaced });
}
