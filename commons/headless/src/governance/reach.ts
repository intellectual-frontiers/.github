// Spec: 0005-reach-and-targets FR-001, FR-002, FR-003
// Spec: 0007-ssh-coverage FR-001
// Spec: 0008-exit-style-consent FR-004
/**
 * Where an action may be reached from and run, as governance (commons headless 0005-reach-and-targets): a reach policy for each action (the channels it
 * may come through, whether it is read-only and idempotent, whether it needs a terminal, whom it runs as, how it is confirmed), the classes of target there
 * are, and the trust policy for them. The action is defined once; where it runs, here or on a target, is a separate choice that these facts bound.
 *
 * @remarks
 * Nothing here names a secret value: the trust policy says how a host is known and what is done when it is not, and a credential is only ever a reference.
 *
 * @example
 * ```ts
 * import { defineReach, reachProblems } from "./reach.ts";
 * import { defineAction } from "./action.ts";
 * const status = defineAction({ id: "status", summary: "Status.", kind: "report" });
 * reachProblems(status, defineReach({ channels: ["local", "ssh", "mcp"], readOnly: true })); // []
 * ```
 *
 * @module
 */
import type { ActionFacts } from "./action.ts";

/** A way an action can be reached: here (`local`), on a target through the system's ssh client (`ssh`), through a tool server (`mcp`) or a REST interface (`rest`). */
export type Channel = "local" | "ssh" | "mcp" | "rest";

/** Every channel. */
export const CHANNELS: readonly Channel[] = ["local", "ssh", "mcp", "rest"];

/** Whom an action runs as on the machine it runs on: the person or program that called it, or a service account of the program. */
export type RunsAs = "caller" | "service";

/**
 * How an action is confirmed where it is confirmed at all: not at all, by a flag of the invocation, by a person, or by a prior consent (0008-exit-style-consent FR-004): an
 * identifier of an approval a person gave earlier, passed as `--consent <id>`, which lets a run that changes something go on with no terminal, and is recorded in the run's log.
 */
export type ConfirmationClass = "none" | "flag" | "person" | "consent";

/** The reach policy of one action. */
export type ReachPolicy = {
  /** The channels it may come through; never empty. */
  readonly channels: readonly Channel[];
  /** Whether it only reads, so that a key that may only read may run it. */
  readonly readOnly: boolean;
  /** Whether repeating it is safe: the same fact as the action's, held here so that a reach decision needs no more than this. */
  readonly idempotent: boolean;
  /** Whether it needs a terminal; false by default, and an action that needs one MUST NOT come through a channel that has none. */
  readonly needsTty: boolean;
  readonly runsAs: RunsAs;
  readonly confirmation: ConfirmationClass;
};

/** What `defineReach` takes: the channels, and any fact that is not the safe default. */
export type ReachDefinition = {
  readonly channels: readonly Channel[];
  readonly readOnly?: boolean;
  readonly idempotent?: boolean;
  readonly needsTty?: boolean;
  readonly runsAs?: RunsAs;
  readonly confirmation?: ConfirmationClass;
};

/** A reach policy with the safe defaults: it changes something, is not assumed idempotent, needs no terminal, runs as the caller, and is not confirmed. */
export function defineReach(d: ReachDefinition): ReachPolicy {
  return {
    channels: d.channels,
    readOnly: d.readOnly ?? false,
    idempotent: d.idempotent ?? false,
    needsTty: d.needsTty ?? false,
    runsAs: d.runsAs ?? "caller",
    confirmation: d.confirmation ?? "none",
  };
}

/** What a target is, for what may be done with it and how it is reached. */
export type TargetClass = "server" | "workstation" | "device" | "network-gear";

/** Every class of target. */
export const TARGET_CLASSES: readonly TargetClass[] = ["server", "workstation", "device", "network-gear"];

/**
 * How a host is known and what is done when it is not: its key is checked against the known-hosts of the repository first and the user's file after, a key that
 * does not match is refused and never accepted for the person, the first contact with a host is a verb of its own that a person runs and confirms by the
 * fingerprint, and a credential is a reference, never a value. Each field has the one value the policy allows, so a policy cannot be loosened by data.
 */
export type TrustPolicy = {
  readonly hostKey: "verify";
  readonly knownHosts: readonly ["repository", "user"];
  readonly onMismatch: "refuse";
  readonly firstContact: "explicit-verb";
  readonly credentials: "reference-only";
};

/** The trust policy: there is one. */
export const TRUST: TrustPolicy = {
  hostKey: "verify",
  knownHosts: ["repository", "user"],
  onMismatch: "refuse",
  firstContact: "explicit-verb",
  credentials: "reference-only",
};

/** The ways a reach policy can contradict the action it is of. */
export type ReachRule =
  | "reach/missing"
  | "reach/no-channel"
  | "reach/duplicate-channel"
  | "reach/read-only-mismatch"
  | "reach/idempotent-mismatch"
  | "reach/tty-without-terminal"
  | "reach/destructive-unconfirmed"
  | "reach/human-only-remote"
  | "reach/consent-on-read";

/** A contradiction between an action and its reach policy. */
export type ReachProblem = { readonly rule: ReachRule; readonly message: string };

/** The channels that have no terminal for the person to answer at. */
const NO_TERMINAL: readonly Channel[] = ["ssh", "mcp", "rest"];

/**
 * Every contradiction between an action and its reach policy: a policy with no channel or one twice; `readOnly` that is not whether the action only reads;
 * `idempotent` that is not the action's; a need for a terminal on a channel that has none; a destructive action that is not confirmed; an action for a person
 * that comes through a channel that is a machine's.
 */
export function reachProblems(a: ActionFacts, r: ReachPolicy): readonly ReachProblem[] {
  const out: ReachProblem[] = [];
  if (r.channels.length === 0) out.push({ rule: "reach/no-channel", message: `${a.id} may come through no channel` });
  if (new Set(r.channels).size !== r.channels.length) out.push({ rule: "reach/duplicate-channel", message: `${a.id} lists a channel twice` });
  if (r.readOnly !== (a.effect === "read")) {
    out.push({ rule: "reach/read-only-mismatch", message: `${a.id} has the effect ${a.effect}, so its reach policy cannot say readOnly is ${String(r.readOnly)}` });
  }
  if (r.idempotent !== a.idempotent) out.push({ rule: "reach/idempotent-mismatch", message: `${a.id} and its reach policy disagree on whether it is safe to repeat` });
  if (r.needsTty && r.channels.some((c) => NO_TERMINAL.includes(c))) {
    out.push({ rule: "reach/tty-without-terminal", message: `${a.id} needs a terminal, which a channel of ${r.channels.filter((c) => NO_TERMINAL.includes(c)).join(", ")} does not have` });
  }
  if (a.effect === "destructive" && r.confirmation === "none") out.push({ rule: "reach/destructive-unconfirmed", message: `${a.id} destroys something and its reach policy has no confirmation` });
  if (a.audience === "human" && r.channels.some((c) => c !== "local")) {
    out.push({ rule: "reach/human-only-remote", message: `${a.id} is for a person, so it may come through the local channel only` });
  }
  if (r.confirmation === "consent" && a.effect === "read") {
    out.push({ rule: "reach/consent-on-read", message: `${a.id} only reads, so there is nothing for a consent to allow` });
  }
  return out;
}

/** Whether a call may be interactive (the client may ask, a terminal may be given): only where the action's reach policy says it needs a terminal, which is explicit and never the default. */
export function interactiveAllowed(r: ReachPolicy): boolean {
  return r.needsTty;
}

/** An action with its reach policy, or without one. */
export type Reached = { readonly facts: ActionFacts; readonly reach: ReachPolicy | undefined };

/** The conformance rule: every action MUST have a reach policy (`reach/missing`), and each policy MUST fit its action. */
export function reachConformance(actions: readonly Reached[]): readonly ReachProblem[] {
  return actions.flatMap((a) =>
    a.reach === undefined ? [{ rule: "reach/missing" as const, message: `${a.facts.id} has no reach policy` }] : reachProblems(a.facts, a.reach),
  );
}

/** What a channel of the policy and a key's role let through. */
export type ReachDecision = { readonly kind: "allowed" } | { readonly kind: "refused"; readonly reason: "channel" | "read-only-key"; readonly message: string };

/** Whether an action may be reached through a channel, by a caller that may only read (a probe key) or may do more. */
export function reachDecision(a: ActionFacts, r: ReachPolicy, channel: Channel, caller: { readonly mayOnlyRead: boolean }): ReachDecision {
  if (!r.channels.includes(channel)) return { kind: "refused", reason: "channel", message: `${a.id} may not be reached through ${channel}` };
  if (caller.mayOnlyRead && !r.readOnly) return { kind: "refused", reason: "read-only-key", message: `${a.id} changes something, and this key may only read` };
  return { kind: "allowed" };
}
