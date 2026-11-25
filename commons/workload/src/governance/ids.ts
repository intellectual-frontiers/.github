// Spec: 0001-workload-layers FR-004
/**
 * The ids of Workload: a workload, a node, a store and a dialect are lower case words joined by hyphens, a verb is two such names joined by a dot (`store.checkpoint`). Each is branded and made only by a smart constructor
 * that returns a `Result`, so that an id exists only as the result of its check. A citation is a spec id and a requirement id.
 *
 * @example
 * ```ts
 * import { nodeId, verbId } from "./ids.ts";
 * nodeId("take-backup").kind; // "ok"
 * verbId("store.checkpoint").kind; // "ok"
 * nodeId("Take Backup").kind; // "err"
 * ```
 *
 * @module
 */
import { type Brand, err, formatDecodeError, ok, refine, type Result, string } from "@intellectual-frontiers/core";

const WORD = "[a-z][a-z0-9]*(?:-[a-z0-9]+)*";
const NAME = new RegExp(`^${WORD}$`, "u");
const VERB = new RegExp(`^${WORD}\\.${WORD}$`, "u");
const SPEC = /^\d{4}-[a-z][a-z0-9-]*$/u;
const FR = /^[A-Z]{2,3}-\d{3}$/u;

/** The id of a workload, which is also the name of its skill. */
export type WorkloadId = Brand<string, "workload id">;
/** The id of a node of a workload: what a form calls a step, a phase or a job. */
export type NodeId = Brand<string, "node id">;
/** The id of a verb: `<noun>.<action>`. */
export type VerbId = Brand<string, "verb id">;
/** The reference of a store, `synthetic-<kind>-NN` in every example. */
export type StoreRef = Brand<string, "store ref">;
/** The id of a dialect. */
export type DialectId = Brand<string, "dialect id">;
/** The id of a runner. */
export type RunnerId = Brand<string, "runner id">;

const made = <B extends string>(name: B, pattern: RegExp) => {
  const decoder = refine(string, name, (s) => pattern.test(s) && s.length <= 96);
  return (text: unknown): Result<Brand<string, B>, string> => {
    const r = decoder(text);
    return r.kind === "ok" ? ok(r.value) : err(`${formatDecodeError(r.error)}`);
  };
};

/** A workload id from text, or why it is not one. */
export const workloadId = made("workload id", NAME);
/** A node id from text, or why it is not one. */
export const nodeId = made("node id", NAME);
/** A verb id from text, or why it is not one. */
export const verbId = made("verb id", VERB);
/** A store reference from text, or why it is not one. */
export const storeRef = made("store ref", NAME);
/** A dialect id from text, or why it is not one. */
export const dialectId = made("dialect id", NAME);

/** A runner id from text, or why it is not one. */
export const runnerId = made("runner id", NAME);

/** A requirement of a spec that a node answers to. */
export type SpecCite = { readonly spec: string; readonly requirement: string };

/** A citation from text such as `0002-workload-effects FR-001`, or why it is not one. */
export function parseCite(text: string): Result<SpecCite, string> {
  const parts = text.split(" ");
  const [spec, requirement] = parts;
  if (parts.length !== 2 || spec === undefined || requirement === undefined || !SPEC.test(spec) || !FR.test(requirement)) return err(`${JSON.stringify(text.slice(0, 60))} is not a citation: a spec id and a requirement id, as 0002-workload-effects FR-001`);
  return ok({ spec, requirement });
}

/** A citation as text. */
export const citeText = (c: SpecCite): string => `${c.spec} ${c.requirement}`;

/** The value of a `Result` for typed data authored in code (a starter workload, a registry): an id that is wrong is a mistake of the author and stops the program that loads it, never a run. */
export function authored<T>(r: Result<T, string>): T {
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}
