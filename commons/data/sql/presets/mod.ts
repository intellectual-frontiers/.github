// Spec: 0021-sql-presets FR-001
/**
 * Presets (commons data 0021-sql-presets): the four ways a team works, each a strategy with the features it needs and the settings it calls for. A preset is data; nothing is applied by choosing one.
 *
 * @example
 * ```ts
 * const p = must(preset("autonomous-convergence"));
 * connect(driver, dialect, schema, { dialect }, p.convergence!, { ...p.planOptions, run: p.runOptions(dialect) });
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import { type Convergence, type ConvergenceSettings, settingsOf as convergenceOf } from "@intellectual-frontiers/data/sql/extensions/convergence";
import { type History, type HistorySettings, settingsOf as historyOf } from "@intellectual-frontiers/data/sql/extensions/history";
import { idempotency, type IdempotencySettings } from "@intellectual-frontiers/data/sql/extensions/idempotency";
import { type Report, type ReportSettings, settingsOf as reportOf } from "@intellectual-frontiers/data/sql/extensions/plan-report";
import { safety, type SafetyKit, type SafetySettings } from "@intellectual-frontiers/data/sql/extensions/safety";
import type { PlanOptions, RunOptions } from "@intellectual-frontiers/data/sql/lifecycle";
import type { Dialect } from "@intellectual-frontiers/data/sql/physical";

/** The four ways a team works. */
export const presetNames = ["team-managed", "dba-managed", "reviewed-convergence", "autonomous-convergence"] as const;
export type PresetName = (typeof presetNames)[number];

/** What a project changes of a preset; what is not said is the preset's. */
export interface PresetChanges {
  readonly history?: HistorySettings;
  readonly convergence?: ConvergenceSettings;
  readonly safety?: SafetySettings;
  readonly idempotency?: IdempotencySettings;
  readonly report?: ReportSettings;
}

/** A preset with every setting filled. */
export interface Preset {
  readonly name: PresetName;
  readonly strategy: "history" | "convergence";
  /** Who writes the SQL, who reviews it and who applies it. */
  readonly roles: string;
  readonly history: History | undefined;
  readonly convergence: Convergence | undefined;
  readonly safety: SafetyKit;
  readonly idempotency: IdempotencySettings;
  readonly report: Report;
  /** What `plan` is given: the transforms (quarantine, locks, validation, verification, then idempotency) and whether a step only the ledger guards is refused. */
  readonly planOptions: Pick<PlanOptions, "transforms" | "requireIdempotent">;
  /** What `execute` is given: to try a step again on a lock timeout, where the dialect has one. */
  runOptions(dialect: Dialect): Omit<RunOptions, "empty">;
}

export type PresetError =
  | { readonly kind: "unknown"; readonly name: string; readonly known: readonly string[] }
  | { readonly kind: "not-used"; readonly preset: PresetName; readonly settings: "history" | "convergence" };

interface Base {
  readonly strategy: "history" | "convergence";
  readonly roles: string;
  readonly history?: HistorySettings;
  readonly convergence?: ConvergenceSettings;
  readonly safety: SafetySettings;
  readonly idempotency: IdempotencySettings;
}

const BASES: Readonly<Record<PresetName, Base>> = {
  "team-managed": {
    strategy: "history",
    roles: "the application's team writes the SQL, a reviewer approves it in the change, and the pipeline applies it",
    history: { delivery: "pipeline" },
    safety: {},
    idempotency: {},
  },
  "dba-managed": {
    strategy: "history",
    roles: "people write the SQL, a database administrator checks the release package and runs it by hand, possibly twice",
    history: { delivery: "release-package", unguardable: "refuse" },
    safety: {},
    idempotency: { unguardable: "refuse" },
  },
  "reviewed-convergence": {
    strategy: "convergence",
    roles: "a tool computes the SQL from the database as it is, a person approves the text, and it is applied only if the database is unchanged",
    convergence: { approval: "reviewed" },
    safety: {},
    idempotency: {},
  },
  "autonomous-convergence": {
    strategy: "convergence",
    roles: "a tool computes the SQL on first access and applies what only adds; anything else is held for a person and nothing is changed",
    convergence: { approval: "autonomous" },
    safety: { lockTimeoutMs: 2000, attempts: 5 },
    idempotency: {},
  },
};

/**
 * A preset, with a project's changes.
 *
 * @param name - one of the four names
 * @param changes - what a project changes
 * @returns the preset with every setting, or why not
 */
export function preset(name: string, changes: PresetChanges = {}): Result<Preset, PresetError> {
  const base = (presetNames as readonly string[]).includes(name) ? BASES[name as PresetName] : undefined;
  if (base === undefined) return err({ kind: "unknown", name, known: presetNames });
  const named = name as PresetName;
  for (const s of ["history", "convergence"] as const)
    if (changes[s] !== undefined && base.strategy !== s) return err({ kind: "not-used", preset: named, settings: s });
  const kit = safety({ ...base.safety, ...changes.safety });
  // what quarantine keeps is not drift: the reader leaves out the tables it makes
  const kept = kit.settings.quarantine ? [`*${kit.settings.suffixes.column}`, `*${kit.settings.suffixes.table}`] : [];
  const idem = { ...base.idempotency, ...changes.idempotency };
  return ok({
    name: named,
    strategy: base.strategy,
    roles: base.roles,
    history: base.strategy === "history" ? historyOf({ ...base.history, ...changes.history }) : undefined,
    convergence:
      base.strategy === "convergence"
        ? convergenceOf({ ...base.convergence, ...changes.convergence, ignore: [...kept, ...(changes.convergence?.ignore ?? [])] })
        : undefined,
    safety: kit,
    idempotency: idem,
    report: reportOf(changes.report),
    planOptions: { transforms: [...kit.transforms, idempotency(idem)], requireIdempotent: idem.unguardable === "refuse" },
    runOptions: (dialect) => {
      const retry = kit.retry(dialect);
      return retry === undefined ? {} : { retry };
    },
  });
}
