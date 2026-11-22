// Spec: 0003-planning-reconcile FR-010
/**
 * The plan of a patch and its preview (0037-planning FR-011, FR-032): a plan is what a source would write to carry a patch out, effect by effect (a target, the revision it expects, the text it makes and a
 * sentence); a preview is that, with the SHA-256 of the plan as its hash. A write is held to a hash: with none it is a dry run, with another it is refused, and with the hash of the plan it is that plan.
 *
 * @example
 * ```ts
 * import { decide, previewOf } from "./preview.ts";
 * // const p = await previewOf(plan); (await decide(plan, undefined)).kind === "dry-run"
 * ```
 *
 * @module
 */
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import type { Patch } from "@intellectual-frontiers/planning/governance";
import { canonical } from "./canonical.ts";

/** One thing a plan writes: where, the revision it expects of what is there (none where it must be absent), the text, and a sentence. */
export type Effect = { readonly target: string; readonly expect: string | null; readonly after: string; readonly summary: string };

/** What a source would write to carry a patch out. */
export type Plan = { readonly source: string; readonly place: string; readonly patch: Patch; readonly effects: readonly Effect[] };

/** What a plan says it writes, with the hash a write is held to. */
export type Preview = {
  readonly source: string;
  readonly place: string;
  readonly effects: readonly { readonly target: string; readonly expect: string | null; readonly afterHash: string; readonly summary: string }[];
  readonly hash: string;
};

/** The preview of a plan. */
export async function previewOf(plan: Plan): Promise<Preview> {
  const effects = await Promise.all(plan.effects.map(async (e) => ({ target: e.target, expect: e.expect, afterHash: await sha256(e.after), summary: e.summary })));
  const hash = await sha256(canonical({ source: plan.source, place: plan.place, patch: plan.patch, effects }));
  return { source: plan.source, place: plan.place, effects, hash };
}

/** What a write asked for with a hash comes to. */
export type Decision =
  | { readonly kind: "dry-run"; readonly preview: Preview }
  | { readonly kind: "apply"; readonly preview: Preview }
  | { readonly kind: "stale"; readonly given: string; readonly preview: Preview };

/** A write is a dry run unless it names the hash of the preview of the plan, and a hash that is not that of the plan is refused. */
export async function decide(plan: Plan, given: string | undefined): Promise<Decision> {
  const preview = await previewOf(plan);
  if (given === undefined) return { kind: "dry-run", preview };
  return given === preview.hash ? { kind: "apply", preview } : { kind: "stale", given, preview };
}

/** Whether a plan changes anything. */
export function changes(plan: Plan): boolean {
  return plan.effects.length > 0;
}
