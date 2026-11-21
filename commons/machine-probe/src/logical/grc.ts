// Spec: 0006-machine-probe-grc FR-001, FR-002, FR-003
/**
 * The policies of the probe as evidence for controls (0006-machine-probe-grc): what the policy pack found on each machine becomes the results of `grc`, each for the controls the policy cites that a framework has, and each policy becomes a check that asks one question of a machine and is
 * fresh for a day. A machine that was never observed is in scope for every policy and shows none of them: a gap for each, never a pass. Pure: the framework is given as the identifiers of its controls.
 *
 * @example
 * ```ts
 * import { resultsFor } from "./grc.ts";
 * resultsFor([], { id: "nist-800-53", version: "5.2.0", controls: ["SC-28"] }, "2026-11-21T00:00:00Z"); // { kind: "ok", value: { results: [], checks: [] } }
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { check as checkKind, type Check } from "@intellectual-frontiers/grc/governance";
import { result as resultKind, type Result as Outcome } from "@intellectual-frontiers/grc/logical";
import { POLICIES } from "./policies.ts";

/** One policy's finding for one machine, as the check of an asset gives it. */
export type PolicyRow = { readonly id: string; readonly status: "pass" | "fail" | "warn" | "accepted" | "waiting"; readonly controls: readonly string[]; readonly detail: string };

/** What was found on one machine: when it was observed (nothing where it never was) and each policy's finding. */
export type AssetPolicies = { readonly asset: string; readonly observedAt: string | null; readonly rows: readonly PolicyRow[] };

/** The framework the controls are of: its identifier, its version and the identifiers of its controls. */
export type FrameworkControls = { readonly id: string; readonly version: string; readonly controls: Iterable<string> };

/** The results and the checks. */
export type Evidence = { readonly results: readonly Outcome[]; readonly checks: readonly Check[] };

/** The URN of a control of a framework, as `grc` writes it. */
export const urnOf = (f: Pick<FrameworkControls, "id" | "version">, control: string): string => `urn:grc:${f.id}:${f.version}:${control}`;

/** The results and checks of what the probes found, for the controls of one framework, at an instant. */
export function resultsFor(assets: readonly AssetPolicies[], framework: FrameworkControls, now: string): Result<Evidence, string> {
  const known = new Set(framework.controls);
  const head = (kind: string, id: string): Record<string, unknown> => ({ kind, schema: "1", id, createdAt: now, provenance: { producer: { name: "machine-probe", version: "1" }, inputs: [] } });
  const results: Outcome[] = [];
  const checkControls = new Map<string, Set<string>>();
  for (const a of assets) {
    const rows: readonly PolicyRow[] = a.observedAt === null ? POLICIES.map((p) => ({ id: p.id, status: "waiting" as const, controls: p.controls, detail: "not observed yet" })) : a.rows;
    for (const r of rows) {
      const controls = r.controls.filter((c) => known.has(c)).map((c) => urnOf(framework, c));
      if (controls.length === 0) continue;
      const decoded = resultKind.decode({
        ...head("grc.result", `result:${r.id}:${a.asset}`), check: `probe:${r.id}`, controls, subject: a.asset, status: r.status === "waiting" ? "gap" : r.status, severity: "medium", reason: r.detail, observedAt: a.observedAt ?? now,
      });
      if (decoded.kind === "err") return err(`a result of ${a.asset} is not a result: ${decoded.error.path}: expected ${decoded.error.expected}`);
      results.push(decoded.value);
      checkControls.set(`probe:${r.id}`, new Set([...(checkControls.get(`probe:${r.id}`) ?? []), ...controls]));
    }
  }
  const checks: Check[] = [];
  for (const [id, controls] of checkControls) {
    const made = checkKind.decode({ ...head("grc.check", id), ask: `Does the machine pass the policy ${id.slice(6)}?`, expect: { kind: "empty" }, platforms: ["linux"], freshness: "P1D", controls: [...controls].sort(), runner: { kind: "sql", input: { query: "select 1 where 0" } } });
    if (made.kind === "err") return err(`a check ${id} is not valid: ${made.error.path}: expected ${made.error.expected}`);
    checks.push(made.value);
  }
  return ok({ results, checks });
}
