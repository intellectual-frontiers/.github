// Spec: 0018-sql-history FR-003, FR-004, FR-007
/**
 * Freezing a plan (commons data 0018-sql-history FR-003, FR-004, FR-007): the steps that the history does not hold, as files, with the manifest that chains them, the repeatable objects and the
 * state the history adds up to. A file that is there is never rewritten; a plan that does not start where the history ends is an error value.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Repeatable, Step } from "@intellectual-frontiers/data/sql/lifecycle";
import { type Artifact, canonical, sha256Hex } from "./deps.ts";
import { frozenOf, pathOf, renderStep } from "./format.ts";
import { checkHistory, chainOf, GENESIS, type Manifest, type ManifestEntry, type Problem, renderManifest } from "./manifest.ts";

/** What a freeze is given besides the plan. */
export interface FreezeOptions {
  /** The folder the files are in; `migrations` by default. */
  readonly folder?: string;
  /** The state the plan ends in, as a value, which is kept beside the steps. */
  readonly state?: unknown;
}

/** What is wrong with a freeze. */
export type FreezeError =
  | { readonly kind: "history"; readonly problems: readonly Problem[] }
  | { readonly kind: "base"; readonly head: string; readonly from: string };

/** The plan a freeze is given. */
export interface Freezable {
  readonly dialect: string;
  readonly from: string;
  readonly to: string;
  readonly steps: readonly Step[];
  readonly repeatable: readonly Repeatable[];
}

/** The repeatable objects as the file holds them. */
export const renderRepeatable = (r: readonly Repeatable[]): string =>
  `${JSON.stringify({ format: 1, repeatable: r.map((x) => ({ key: x.key, hash: x.hash, of: x.of, statements: x.statements.map((s) => ({ group: s.group, origin: s.origin, of: s.of, sql: s.sql })) })) }, null, 2)}\n`;

/**
 * The files a plan adds to a history.
 *
 * @param existing - the files the history has now
 * @param plan - the plan
 * @param options - the folder and the state
 * @returns the files that are new or changed (the steps that are not frozen yet, the manifest, the repeatable objects and the state), or why not
 */
export function freeze(
  existing: readonly Artifact[],
  plan: Freezable,
  options: FreezeOptions = {},
): Result<readonly Artifact[], readonly FreezeError[]> {
  const folder = options.folder ?? "migrations";
  const { manifest: held, problems } = checkHistory(existing, folder);
  if (problems.length > 0) return err([{ kind: "history", problems }]);
  const manifest: Manifest = held ?? { format: 1, dialect: plan.dialect, base: plan.from, entries: [] };
  const known = new Set(manifest.entries.map((e) => e.id));
  const fresh = plan.steps.filter((s) => !known.has(s.id));
  const head = manifest.entries[manifest.entries.length - 1]?.to ?? manifest.base;
  if (fresh[0] !== undefined && fresh[0].from !== head) return err([{ kind: "base", head, from: fresh[0].from }]);
  const out: Artifact[] = [];
  const entries: ManifestEntry[] = [...manifest.entries];
  let previous = entries[entries.length - 1]?.chain ?? GENESIS;
  for (const step of fresh) {
    const number = entries.length + 1;
    const path = pathOf(folder, number, step.name);
    const text = renderStep(frozenOf(step), number);
    const entry = { number, file: path, id: step.id, from: step.from, to: step.to, sha256: sha256Hex(text) };
    const chain = chainOf(previous, entry);
    entries.push({ ...entry, chain });
    previous = chain;
    out.push({ path, text });
  }
  if (fresh.length > 0) out.push({ path: `${folder}/manifest.json`, text: renderManifest({ ...manifest, entries }) });
  const same = (path: string, text: string): boolean => existing.find((f) => f.path === path)?.text === text;
  const repeatable = renderRepeatable(plan.repeatable);
  if (!same(`${folder}/repeatable.json`, repeatable)) out.push({ path: `${folder}/repeatable.json`, text: repeatable });
  if (options.state !== undefined) {
    const state = `${canonical(options.state)}\n`;
    if (!same(`${folder}/state.json`, state)) out.push({ path: `${folder}/state.json`, text: state });
  }
  return ok(out);
}
