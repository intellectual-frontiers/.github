// Spec: 0002-libraries-ci-findings FR-008
/**
 * The release gate (commons 0038-build-policy FR-010): `bun commons/libraries/src/ci/release-gate.ts [--day YYYY-MM-DD] [--history REF]` says what the release policy lets the run do on the day, and ends 1 (its own decision, a gate and not a finding) where it does not: after the day
 * of the policy nothing proceeds silently, and the run carries the finding `owner-review-due`. Where the history branch is there it also says how many findings are open for each module, so that what is published regardless is seen when it is.
 *
 * @example
 * ```ts
 * import { gateReport } from "./release-gate.ts";
 * gateReport("2026-11-22", []).proceed; // true
 * ```
 *
 * @module
 */
import { type FindingsFile, deriveRows } from "./findings.ts";
import { readHistory } from "./history.ts";
import { RELEASE_POLICY, releaseDecision } from "./policy.ts";

/** What the gate says on a day, with the open findings of each module of the history it was given. */
export function gateReport(day: string, history: readonly FindingsFile[]): { readonly proceed: boolean; readonly lines: readonly string[] } {
  const d = releaseDecision(day);
  const lines: string[] = [];
  if (d.proceed) lines.push(`the release policy is "${RELEASE_POLICY.mode}" until ${d.until}: a library is released whatever its open findings are, and they are listed here`);
  else lines.push(d.finding.message, `finding ${d.finding.code} (${d.finding.severity}): the owner decides again before anything is released`);
  const rows = deriveRows(history, [], day).filter((r) => r.status === "open");
  const by = new Map<string, number>();
  for (const r of rows) by.set(r.finding.module, (by.get(r.finding.module) ?? 0) + 1);
  if (by.size === 0) lines.push("open findings: none recorded in the history");
  for (const [m, n] of [...by].sort()) lines.push(`open findings of ${m}: ${n}`);
  return { proceed: d.proceed, lines };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const arg = (n: string): string | undefined => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : undefined);
  const day = arg("--day") ?? new Date().toISOString().slice(0, 10);
  const files: FindingsFile[] = [];
  for (const f of readHistory(".", arg("--history"))) {
    try {
      files.push(JSON.parse(f.text) as FindingsFile);
    } catch {
      /* a file that is not a findings file is the history's own finding, not the gate's */
    }
  }
  const r = gateReport(day, files);
  process.stdout.write(`${r.lines.join("\n")}\n`);
  process.exitCode = r.proceed ? 0 : 1;
}
