// Spec: 0002-headless-governance FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
/**
 * What a headless action is, before any surface draws it (commons headless 0002-headless-governance): its identity, who it is for, what it may
 * do to the world (`read`, `mutate`, `destructive`), whether repeating it is safe, whether it can preview itself, and which of its options only
 * a person may give. A *report* only reads; an *action* changes something. From those facts alone `decide` says whether a run proceeds, previews,
 * asks the person, or is refused, so that a command line, a tool server and a REST route decide it the same way.
 *
 * @remarks
 * This module imports Core alone and names no surface: nothing here prints, prompts or reads the environment.
 *
 * @example
 * ```ts
 * import { defineAction, decide } from "./action.ts";
 * const wipe = defineAction({ id: "cache wipe", summary: "Delete the cache.", kind: "action", effect: "destructive", dryRun: true });
 * decide(wipe, { audience: "human", interactive: false, flagConfirms: true }, { mode: "apply", confirmed: false, given: [] }).kind; // "refuse"
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";

/** A report only reads and says what it found; an action changes something. */
export type Kind = "report" | "action";

/** What a run may do to the world: nothing (`read`), something that can be undone or redone (`mutate`), or something that cannot be undone (`destructive`). */
export type Effect = "read" | "mutate" | "destructive";

/** Who an action is for: a person at a terminal, a program (a script, an agent), or both. */
export type Audience = "human" | "machine" | "both";

/** The facts of an action. */
export type ActionFacts = {
  /** Its words as a person types them (`work build`): lower-case words joined by spaces. */
  readonly id: string;
  readonly summary: string;
  readonly kind: Kind;
  readonly effect: Effect;
  /** Whether running it again with the same input changes nothing more. */
  readonly idempotent: boolean;
  readonly audience: Audience;
  /** Whether `--dry-run` previews what it would change and changes nothing. */
  readonly dryRun: boolean;
  /** Whether `--check` ends with findings where it would change something (a drift check), changing nothing. */
  readonly check: boolean;
  /** The options (by their keys) that only a person may give: a machine surface refuses them. */
  readonly humanOnly: readonly string[];
};

/** What `defineAction` takes: the identity and summary, and the facts that are not the defaults of its kind. */
export type ActionDefinition = {
  readonly id: string;
  readonly summary: string;
  readonly kind: Kind;
  readonly effect?: Effect;
  readonly idempotent?: boolean;
  readonly audience?: Audience;
  readonly dryRun?: boolean;
  readonly check?: boolean;
  readonly humanOnly?: readonly string[];
};

/**
 * An action's facts with the defaults of its kind: a report reads, is idempotent and has no preview; an action mutates, is not assumed
 * idempotent and has no preview until it says so. Everyone is the audience unless it says otherwise.
 */
export function defineAction(d: ActionDefinition): ActionFacts {
  return {
    id: d.id,
    summary: d.summary,
    kind: d.kind,
    effect: d.effect ?? (d.kind === "report" ? "read" : "mutate"),
    idempotent: d.idempotent ?? d.kind === "report",
    audience: d.audience ?? "both",
    dryRun: d.dryRun ?? false,
    check: d.check ?? false,
    humanOnly: d.humanOnly ?? [],
  };
}

/** The ways an action's facts can contradict each other. */
export type ActionRule =
  | "action/id"
  | "action/summary"
  | "action/report-changes"
  | "action/action-reads"
  | "action/destructive-no-preview"
  | "action/idempotent-destructive"
  | "action/human-only-duplicate"
  | "action/check-on-read";

/** A contradiction in an action's facts. */
export type ActionProblem = { readonly rule: ActionRule; readonly message: string };

const ID = /^[a-z][a-z0-9-]*(?: [a-z][a-z0-9-]*)*$/;

/** Every contradiction in an action's facts, in the order of the rules. */
export function actionProblems(a: ActionFacts): readonly ActionProblem[] {
  const out: ActionProblem[] = [];
  if (!ID.test(a.id)) out.push({ rule: "action/id", message: `${JSON.stringify(a.id)} is not lower-case words joined by spaces` });
  if (a.summary.trim() === "") out.push({ rule: "action/summary", message: `${a.id} has no summary` });
  if (a.kind === "report" && a.effect !== "read") {
    out.push({ rule: "action/report-changes", message: `${a.id} is a report, so it only reads, but its effect is ${a.effect}` });
  }
  if (a.kind === "action" && a.effect === "read") {
    out.push({ rule: "action/action-reads", message: `${a.id} is an action but only reads: declare it a report` });
  }
  if (a.effect === "destructive" && !a.dryRun) {
    out.push({ rule: "action/destructive-no-preview", message: `${a.id} is destructive, so it must be able to preview itself with --dry-run` });
  }
  if (a.effect === "destructive" && a.idempotent) {
    out.push({
      rule: "action/idempotent-destructive",
      message: `${a.id} is destructive and so cannot be called safe to repeat: what it destroys is not there the second time`,
    });
  }
  if (new Set(a.humanOnly).size !== a.humanOnly.length) {
    out.push({ rule: "action/human-only-duplicate", message: `${a.id} lists a human-only option twice` });
  }
  if (a.check && a.effect === "read") {
    out.push({ rule: "action/check-on-read", message: `${a.id} only reads, so there is no change for --check to look for` });
  }
  return out;
}

/** How a run is to treat its effect: do it, preview it, or check for the need of it. */
export type Mode = "apply" | "dry-run" | "check";

/** The mode the flags ask for; both flags at once are not one mode. */
export function modeOf(flags: { readonly dryRun: boolean; readonly check: boolean }): Result<Mode, string> {
  if (flags.dryRun && flags.check) return err("--dry-run and --check ask for different things: give one of them");
  return ok(flags.dryRun ? "dry-run" : flags.check ? "check" : "apply");
}

/** Whether a run in this mode may change anything. */
export function mayChange(mode: Mode): boolean {
  return mode === "apply";
}

/** What a surface is, for the decision: who is on the other side, whether it can ask, and whether a flag of the invocation may stand for the answer. */
export type SurfaceFacts = {
  /** `human` for a person at a terminal or in a window; `machine` for a program that calls it (a tool server, a REST route). */
  readonly audience: "human" | "machine";
  /** Whether the person can be asked a question now (a terminal on both ends). */
  readonly interactive: boolean;
  /** Whether `--yes` (or its like) may stand for the person's answer: a command line yes, a tool server no. */
  readonly flagConfirms: boolean;
};

/** What the invocation gave: its mode, whether it carried the confirmation flag, and the keys of the options it set. */
export type Invocation = { readonly mode: Mode; readonly confirmed: boolean; readonly given: readonly string[] };

/** Why a run is refused. */
export type Refusal = "human-only-action" | "human-only-option" | "confirmation-needed" | "confirmation-not-accepted";

/** What to do with a run. */
export type Decision =
  | { readonly kind: "proceed" }
  | { readonly kind: "preview" }
  | { readonly kind: "ask" }
  | { readonly kind: "refuse"; readonly reason: Refusal; readonly message: string };

function refuse(reason: Refusal, message: string): Decision {
  return { kind: "refuse", reason, message };
}

/** The options of an invocation that only a person may give. */
export function humanOnlyGiven(a: ActionFacts, given: readonly string[]): readonly string[] {
  return given.filter((k) => a.humanOnly.includes(k));
}

/**
 * What to do with a run, from the action's facts, the surface and the invocation (FR-004, FR-005): refuse what a machine may not do, preview
 * what is asked to be a preview, proceed with what only reads or can be undone, and for what cannot be undone ask the person, accept the
 * flag where the surface lets a flag stand for the answer, and refuse where there is neither.
 */
export function decide(a: ActionFacts, surface: SurfaceFacts, inv: Invocation): Decision {
  if (surface.audience === "machine") {
    if (a.audience === "human") return refuse("human-only-action", `${a.id} is for a person: it cannot be run through this interface`);
    const first = humanOnlyGiven(a, inv.given)[0];
    if (first !== undefined) return refuse("human-only-option", `${first} is for a person to give: it cannot be given through this interface`);
  }
  if (inv.mode !== "apply") return { kind: "preview" };
  switch (a.effect) {
    case "read":
    case "mutate":
      return { kind: "proceed" };
    case "destructive":
      if (inv.confirmed) {
        return surface.flagConfirms
          ? { kind: "proceed" }
          : refuse("confirmation-not-accepted", `${a.id} destroys something, and this interface does not take a flag for the confirmation: a person must give it`);
      }
      return surface.interactive
        ? { kind: "ask" }
        : refuse("confirmation-needed", `${a.id} destroys something: run it again with --dry-run to see what, then with --yes to do it`);
    default:
      return absurd(a.effect);
  }
}
