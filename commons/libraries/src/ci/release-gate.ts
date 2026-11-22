// Spec: 0002-libraries-ci-findings FR-008
/**
 * The release gate (commons 0038-build-policy FR-010): `bun commons/libraries/src/ci/release-gate.ts [--day YYYY-MM-DD] [--history REF]` says what the release policy lets the run do on the day, and ends 1 (its own decision, a gate and not a finding) where it does not: after the day
 * of the policy the run carries the finding `owner-review-due` until the owner has reviewed it; the gate ends 1 only where a decision recorded by the owner holds the package. Where the history branch is there it also says how many findings are open for each module, so that what is published regardless is seen when it is.
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
import { heldLibraries, RELEASE_POLICY, releaseDecision, type ReleasePolicy } from "./policy.ts";

/** What the gate says on a day, with the open findings of each module of the history it was given and, from the day the policy holds, the libraries held. `distribution` is the mode of 0036-distribution: in `single` the one package is held while any library is. */
export function gateReport(day: string, history: readonly FindingsFile[], distribution: "single" | "per-library" = "single", policy: ReleasePolicy = RELEASE_POLICY): { readonly proceed: boolean; readonly held: readonly string[]; readonly lines: readonly string[] } {
  const d = releaseDecision(day, policy);
  const lines: string[] = [];
  const rows = deriveRows(history, [], day).filter((r) => r.status === "open");
  const held = d.mode === "hold-critical" ? heldLibraries(rows.map((r) => r.finding)) : [];
  if (d.mode === "publish-regardless") {
    lines.push(`the release policy is "${policy.mode}": a library is released whatever its open findings are, and they are listed here; a hold is a serious decision and only the owner makes it, so the gate holds nothing by itself`);
    if (d.refused !== undefined) lines.push(d.refused);
    if (d.ownerReview !== undefined) lines.push(d.ownerReview.message, `finding ${d.ownerReview.code} (${d.ownerReview.severity}): the owner decides again; it holds nothing by itself`);
  } else {
    lines.push(`the owner (${d.by}) decided to hold from ${d.from}: a library with an open finding of severity error that is not accepted is held, the others are released`);
    for (const m of held) lines.push(`held: ${m} (an open finding of severity error that is not accepted)`);
    if (held.length === 0) lines.push("held: none");
    if (held.length > 0 && distribution === "single") lines.push("the distribution is single: the one package holds every library, so it is held while a library is");
  }
  const by = new Map<string, number>();
  for (const r of rows) by.set(r.finding.module, (by.get(r.finding.module) ?? 0) + 1);
  if (by.size === 0) lines.push("open findings: none recorded in the history");
  for (const [m, n] of [...by].sort()) lines.push(`open findings of ${m}: ${n}`);
  return { proceed: held.length === 0 || distribution === "per-library", held, lines };
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
