// Spec: 0021-sql-presets FR-001, FR-002, FR-003, FR-004, FR-005
/**
 * Presets (commons data 0021-sql-presets): the four ways a team works, each a strategy with its features and settings, changeable setting by setting, and the two convergence presets working on
 * real engines.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/test";
import { applyProposal, connect, desiredState, propose, proposalText } from "@intellectual-frontiers/data/sql/extensions/convergence";
import { defaultPreset, preset, presetNames, type Preset } from "@intellectual-frontiers/data/sql/presets";
import { sha256Hex } from "@intellectual-frontiers/data/sql/lifecycle";
import { bind, type Dialect } from "@intellectual-frontiers/data/sql/physical";
import { DIALECTS, load, openEngine, type Engine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { driverOf, libraryAt } from "./lifecycle-fixture.ts";

const get = (name: string, changes: Parameters<typeof preset>[1] = {}): Preset => {
  const r = preset(name, changes);
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const dbAt1 = async (name: Engine["name"], d: Dialect): Promise<Engine> => {
  const e = await openEngine(name);
  const b = bind(libraryAt(1), { dialect: d });
  assert(b.kind === "ok");
  if (b.kind === "ok") await load(e, b.value);
  return e;
};
const wanted = (d: Dialect, v: 2 | 3) => desiredState(libraryAt(v), { dialect: d }) as NonNullable<ReturnType<typeof desiredState>>;

proves(
  ["0021-sql-presets FR-001", "0021-sql-presets FR-002", "0021-sql-presets FR-003"],
  "each of the four presets is a strategy with its features and settings, a name that is not one of them is refused, and every preset has the safety features and idempotency on",
  () => {
    same(presetNames, ["reviewed-convergence", "autonomous-convergence", "team-managed", "dba-managed"], "convergence first");
    same(get(undefined as never).name, defaultPreset, "and the default");
    const [reviewed, auto, team, dba] = presetNames.map((n) => get(n)) as [Preset, Preset, Preset, Preset];
    same([team.strategy, team.history?.delivery, team.convergence], ["history", "pipeline", undefined]);
    same([dba.strategy, dba.history?.delivery, dba.history?.unguardable, dba.planOptions.requireIdempotent], ["history", "release-package", "refuse", true]);
    same([team.planOptions.requireIdempotent, reviewed.planOptions.requireIdempotent], [false, false]);
    same([reviewed.strategy, reviewed.convergence?.approval, reviewed.history], ["convergence", "reviewed", undefined]);
    same([auto.strategy, auto.convergence?.approval, auto.convergence?.policy.enabled], ["convergence", "autonomous", true]);
    same([auto.convergence?.policy.kinds], [["createTable", "addColumn", "addConstraint", "upsertRows"]]);
    assert(auto.safety.settings.lockTimeoutMs < team.safety.settings.lockTimeoutMs && auto.safety.settings.attempts > team.safety.settings.attempts, "a first access does not hold the start");
    for (const p of [team, dba, reviewed, auto]) {
      const s = p.safety.settings;
      same([s.quarantine, s.locks, s.validateLater, s.verify, p.report.steward], [true, true, true, true, true], p.name);
      same(p.planOptions.transforms?.length, 5, `${p.name}: quarantine, locks, validation, verification, idempotency`);
      assert(p.roles.length > 0);
    }
    same(auto.convergence?.ignore, ["lifecycle_ledger", "*quarantine", "*quarantined", "integration_run", "transform_run"], "quarantine is not drift");
    assert(get("reviewed-convergence", { safety: { quarantine: "off" } }).convergence?.ignore.includes("*quarantine"), "a database may hold quarantine tables from before");
    assert(get("reviewed-convergence", { safety: { suffixes: { column: "kept" } } }).convergence?.ignore.includes("*kept"), "and the suffix the project chose");
    const bad = preset("flyway");
    assert(bad.kind === "err" && bad.error.kind === "unknown" && bad.error.known.includes("team-managed"));
  },
);

proves(
  ["0021-sql-presets FR-004"],
  "a project's changes are taken over the preset's setting by setting, and settings for a strategy the preset does not use are refused",
  () => {
    const changed = get("team-managed", { history: { folder: "db/changes" }, safety: { quarantine: "off", attempts: 9 }, idempotency: { mode: "off" }, report: { steward: "off" } });
    same([changed.history?.folder, changed.history?.delivery], ["db/changes", "pipeline"], "what is not said stays the preset's");
    same([changed.safety.settings.quarantine, changed.safety.settings.attempts, changed.safety.settings.locks], [false, 9, true]);
    same([changed.idempotency.mode, changed.report.steward], ["off", false]);
    const wide = get("autonomous-convergence", { convergence: { policy: { classes: ["safe", "data-dependent"] } } });
    same(wide.convergence?.policy.classes, ["safe", "data-dependent"]);
    same(wide.convergence?.approval, "autonomous");
    const refused = preset("team-managed", { convergence: { approval: "autonomous" } });
    assert(refused.kind === "err" && refused.error.kind === "not-used" && refused.error.preset === "team-managed" && refused.error.settings === "convergence");
    assert(preset("reviewed-convergence", { history: { folder: "x" } }).kind === "err");
  },
);

proves(
  ["0021-sql-presets FR-005"],
  "on three engines autonomous-convergence applies what adds on first access, holds what does not and finds the next access current, and reviewed-convergence applies only the approved text, once",
  async () => {
    const auto = get("autonomous-convergence");
    const reviewed = get("reviewed-convergence");
    for (const { name, dialect } of DIALECTS) {
      const e = await dbAt1(name, dialect);
      try {
        const o = { ...auto.planOptions, run: auto.runOptions(dialect) };
        const up = await connect(driverOf(e), dialect, libraryAt(2), { dialect }, auto.convergence!, o);
        assert(up.kind === "applied", `${name}: ${JSON.stringify(up)}`);
        same((await connect(driverOf(e), dialect, libraryAt(2), { dialect }, auto.convergence!, o)).kind, "current", `${name}: the next access`);
        const held = await connect(driverOf(e), dialect, libraryAt(3), { dialect }, auto.convergence!, o);
        assert(held.kind === "held", `${name}: ${held.kind}`);
        // the reviewed preset takes the same database to version 3, by text a person approved
        const r = await propose(driverOf(e), libraryAt(3), { dialect }, { ...reviewed.planOptions, ...(reviewed.convergence === undefined ? {} : { ledgerTable: reviewed.convergence.ledgerTable, ignore: reviewed.convergence.ignore }) });
        assert(r.kind === "ok", `${name}: ${JSON.stringify(r)}`);
        if (r.kind !== "ok") continue;
        const text = proposalText(r.value.proposal);
        const done = await applyProposal(text, sha256Hex(text), driverOf(e), dialect, wanted(dialect, 3), { ...reviewed.runOptions(dialect), ignore: reviewed.convergence?.ignore ?? [] });
        assert(done.kind === "ok" && done.value.steps.length > 0, `${name}: ${JSON.stringify(done)}`);
        const again = await applyProposal(text, sha256Hex(text), driverOf(e), dialect, wanted(dialect, 3), { ...reviewed.runOptions(dialect), ignore: reviewed.convergence?.ignore ?? [] });
        assert(again.kind === "ok" && again.value.steps.length === 0, `${name}: once ${JSON.stringify(again).slice(0, 600)}`);
      } finally {
        await e.close();
      }
    }
  },
);
