// Spec: 0002-archon-governance FR-003, FR-004
/**
 * A requirement: what a subject must be, said once. It names what must hold and why, for which subjects, of which kind of resource, how much a change to it matters (its change class) and how
 * it is verified. `defineRequirement` is the one way to make one, and it refuses, with every reason, what is not one.
 *
 * @example
 * ```ts
 * import { defineRequirement } from "./requirement.ts";
 * const r = defineRequirement({
 *   id: "baseline.openssh",
 *   summary: "OpenSSH is installed.",
 *   why: ["the only way in"],
 *   subject: { by: "all" },
 *   kind: "package",
 *   desired: { name: "openssh-server" },
 *   change: "additive",
 * });
 * r.kind; // "ok"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { parseRequirementId, parseSubjectName, type RequirementId, type ResourceKindId, type SubjectName } from "./ids.ts";
import { isJson, type JsonValue } from "./json.ts";
import { KINDS, SUBJECT_CLASSES, kindOf, type KindSpec, type SubjectClass } from "./kinds.ts";
import { findSecretLike } from "./secret.ts";

/** How much a change to a resource matters: it adds, it changes what is there, or it destroys. */
export type ChangeClass = "additive" | "mutating" | "destructive";
/** Every change class. */
export const CHANGE_CLASSES: readonly ChangeClass[] = ["additive", "mutating", "destructive"];
/** How a change can be undone. */
export type Rollback = "reversible" | "restore-from-backup" | "none";
/** Every rollback stance. */
export const ROLLBACKS: readonly Rollback[] = ["reversible", "restore-from-backup", "none"];
/** How faithful a plan must be: `faithful` shows what would change, `best-effort` accepts a partial plan. */
export type PlanFidelity = "faithful" | "best-effort";
/** Whether the resource must be there or must not. */
export type Ensure = "present" | "absent";

/** Which subjects a requirement is for: every subject, some by name, or every subject of a class. */
export type SubjectSelector =
  | { readonly by: "all" }
  | { readonly by: "names"; readonly names: readonly SubjectName[] }
  | { readonly by: "class"; readonly class: SubjectClass };

/** How the state of a resource is verified afterwards: by an osquery query, by the dialect's own check, or not (with the reason). */
export type Verification =
  | { readonly by: "osquery"; readonly query: string }
  | { readonly by: "dialect" }
  | { readonly by: "none"; readonly reason: string };

/** A requirement. */
export type Requirement = {
  readonly id: RequirementId;
  readonly summary: string;
  /** Why it holds: the specifications, controls or sentences it answers to; never empty. */
  readonly why: readonly string[];
  readonly subject: SubjectSelector;
  readonly kind: ResourceKindId;
  readonly ensure: Ensure;
  /** What must hold: data, with references to secrets and never secrets. */
  readonly desired: JsonValue;
  readonly change: ChangeClass;
  readonly plan: PlanFidelity;
  /** The name of the tier a person needs to approve a change to it. */
  readonly tier: string;
  readonly verify: Verification;
  readonly rollback: Rollback;
  readonly dependsOn: readonly RequirementId[];
};

/** A selector as written, with its names and class as text. */
export type SubjectSelectorInput =
  | { readonly by: "all" }
  | { readonly by: "names"; readonly names: readonly string[] }
  | { readonly by: "class"; readonly class: string };

/** What `defineRequirement` takes: names as text, and defaults for what is left out (present, a faithful plan, the tier `operator`, verified by the dialect, reversible, no dependencies). */
export type RequirementInput = {
  readonly id: string;
  readonly summary: string;
  readonly why: readonly string[];
  readonly subject: SubjectSelectorInput;
  readonly kind: string;
  readonly desired: unknown;
  readonly change: string;
  readonly ensure?: string;
  readonly plan?: string;
  readonly tier?: string;
  readonly verify?: Verification;
  readonly rollback?: string;
  readonly dependsOn?: readonly string[];
};

function oneOf<T extends string>(values: readonly T[], text: string): T | undefined {
  return values.find((v) => v === text);
}

/** A requirement, or every reason the input is not one. */
export function defineRequirement(input: RequirementInput, catalogue: readonly KindSpec[] = KINDS): Result<Requirement, readonly string[]> {
  const problems: string[] = [];
  const id = parseRequirementId(input.id);
  if (id.kind === "err") problems.push(id.error);

  if (input.summary.trim() === "") problems.push("a requirement has a summary");
  if (input.why.length === 0 || input.why.some((w) => w.trim() === "")) problems.push("a requirement says why it holds (`why` has at least one reason, none empty)");

  const spec = kindOf(input.kind, catalogue);
  if (spec === undefined) problems.push(`the kind ${JSON.stringify(input.kind)} is not in the catalogue`);

  let subject: SubjectSelector | undefined;
  switch (input.subject.by) {
    case "all":
      subject = { by: "all" };
      break;
    case "names": {
      const names: SubjectName[] = [];
      for (const n of input.subject.names) {
        const r = parseSubjectName(n);
        if (r.kind === "ok") names.push(r.value);
        else problems.push(r.error);
      }
      if (input.subject.names.length === 0) problems.push("a selector by names names at least one subject");
      subject = { by: "names", names };
      break;
    }
    case "class": {
      const c = oneOf(SUBJECT_CLASSES, input.subject.class);
      if (c === undefined) problems.push(`${JSON.stringify(input.subject.class)} is not a class of subject (${SUBJECT_CLASSES.join(", ")})`);
      else {
        subject = { by: "class", class: c };
        if (spec !== undefined && !spec.subjects.includes(c)) problems.push(`the kind ${spec.id} does not apply to a subject of the class ${c}`);
      }
      break;
    }
  }

  let desired: JsonValue = null;
  if (!isJson(input.desired)) problems.push("the desired state is not data (JSON)");
  else {
    desired = input.desired;
    for (const f of findSecretLike(input.desired)) problems.push(`the desired state holds what looks like a secret at ${f.path} (${f.why}): keep a reference to it (secret:<store>/<name>) and never the secret`);
  }

  const change = oneOf(CHANGE_CLASSES, input.change);
  if (change === undefined) problems.push(`${JSON.stringify(input.change)} is not a change class (${CHANGE_CLASSES.join(", ")})`);
  const ensure = input.ensure === undefined ? "present" : oneOf<Ensure>(["present", "absent"], input.ensure);
  if (ensure === undefined) problems.push(`${JSON.stringify(input.ensure)} is not present or absent`);
  const plan = input.plan === undefined ? "faithful" : oneOf<PlanFidelity>(["faithful", "best-effort"], input.plan);
  if (plan === undefined) problems.push(`${JSON.stringify(input.plan)} is not a plan fidelity (faithful, best-effort)`);

  if (ensure === "absent" && change !== undefined && change !== "destructive") problems.push("a requirement that asks for a resource to be absent is destructive");
  let rollback: Rollback | undefined;
  if (input.rollback === undefined) {
    if (change === "destructive") problems.push("a destructive requirement says how it can be rolled back (reversible, restore-from-backup or none)");
    else rollback = "reversible";
  } else {
    rollback = oneOf(ROLLBACKS, input.rollback);
    if (rollback === undefined) problems.push(`${JSON.stringify(input.rollback)} is not a rollback stance (${ROLLBACKS.join(", ")})`);
  }

  const dependsOn: RequirementId[] = [];
  for (const d of input.dependsOn ?? []) {
    const r = parseRequirementId(d);
    if (r.kind === "ok") dependsOn.push(r.value);
    else problems.push(r.error);
  }

  const tier = input.tier ?? "operator";
  if (!/^[a-z][a-z0-9-]*$/.test(tier)) problems.push(`${JSON.stringify(tier)} is not a tier name`);

  const verify: Verification = input.verify ?? { by: "dialect" };
  if (verify.by === "osquery" && verify.query.trim() === "") problems.push("a verification by osquery has a query");
  if (verify.by === "none" && verify.reason.trim() === "") problems.push("a requirement that is not verified says why");

  if (problems.length > 0 || id.kind === "err" || spec === undefined || subject === undefined || change === undefined || ensure === undefined || plan === undefined || rollback === undefined) {
    return err(problems.length > 0 ? problems : ["the requirement is incomplete"]);
  }
  return ok({ id: id.value, summary: input.summary, why: input.why, subject, kind: spec.id, ensure, desired, change, plan, tier, verify, rollback, dependsOn });
}

/** Whether a selector matches a subject of this name and class. */
export function selects(selector: SubjectSelector, subject: { readonly name: SubjectName; readonly class: SubjectClass }): boolean {
  switch (selector.by) {
    case "all":
      return true;
    case "names":
      return selector.names.includes(subject.name);
    case "class":
      return selector.class === subject.class;
  }
}
