// Spec: 0004-findings-lifecycle FR-005
/**
 * The controls of NIST SP 800-53 a finding is evidence against, from what it names: every finding bears on vulnerability monitoring (RA-5); one that names a vulnerability (CVE) or an outdated component bears on flaw remediation (SI-2); and the weakness (CWE) says the rest: injection and
 * unchecked input on input validation (SI-10), broken access on access enforcement (AC-3, AC-6), weak or missing authentication on identification and authentication (IA-2, IA-5), weak cryptography on the protection of information in transit and at rest (SC-8, SC-12, SC-13, SC-28), misconfiguration on
 * configuration settings (CM-6) and exposed information on information handling (SI-11). The table is the estate's own reading, not the standard's.
 *
 * @example
 * ```ts
 * import { controlsOf } from "./controls.ts";
 * controlsOf({ cwe: ["CWE-89"], cve: [] }); // ["RA-5", "SI-10"]
 * ```
 *
 * @module
 */
import type { Finding } from "@intellectual-frontiers/findings/governance";
import { OPEN_STATUSES, type State } from "./lifecycle.ts";

const BY_CWE: Readonly<Record<string, readonly string[]>> = {
  "CWE-20": ["SI-10"], "CWE-22": ["SI-10", "AC-3"], "CWE-77": ["SI-10"], "CWE-78": ["SI-10"], "CWE-79": ["SI-10"], "CWE-80": ["SI-10"], "CWE-89": ["SI-10"], "CWE-94": ["SI-10"], "CWE-502": ["SI-10"], "CWE-611": ["SI-10"], "CWE-917": ["SI-10"],
  "CWE-284": ["AC-3"], "CWE-285": ["AC-3"], "CWE-639": ["AC-3", "AC-6"], "CWE-862": ["AC-3"], "CWE-863": ["AC-3", "AC-6"], "CWE-269": ["AC-6"], "CWE-732": ["AC-3", "CM-6"],
  "CWE-287": ["IA-2"], "CWE-306": ["IA-2"], "CWE-521": ["IA-5"], "CWE-259": ["IA-5"], "CWE-798": ["IA-5"], "CWE-307": ["AC-7"], "CWE-384": ["SC-23"], "CWE-352": ["SC-23"],
  "CWE-319": ["SC-8"], "CWE-311": ["SC-8", "SC-28"], "CWE-326": ["SC-13"], "CWE-327": ["SC-13"], "CWE-328": ["SC-13"], "CWE-295": ["SC-8", "SC-12"], "CWE-297": ["SC-8", "SC-12"], "CWE-757": ["SC-8"], "CWE-614": ["SC-8", "SC-23"],
  "CWE-16": ["CM-6"], "CWE-2": ["CM-6"], "CWE-1021": ["CM-6", "SC-18"], "CWE-693": ["CM-6"], "CWE-942": ["CM-6"],
  "CWE-200": ["SI-11"], "CWE-209": ["SI-11"], "CWE-532": ["SI-11", "AU-9"], "CWE-918": ["SC-7"],
  "CWE-1104": ["SI-2"], "CWE-937": ["SI-2"], "CWE-1035": ["SI-2"],
};

/** The controls a finding is evidence against, sorted, without repeats. */
export function controlsOf(f: Pick<Finding, "cwe" | "cve">): readonly string[] {
  const out = new Set<string>(["RA-5"]);
  if (f.cve.length > 0) out.add("SI-2");
  for (const c of f.cwe) for (const control of BY_CWE[c] ?? []) out.add(control);
  return [...out].sort();
}

/** A row of the posture of an asset: the same shape as the probes' policies, so that the posture documents take findings as they take probes. */
export type Row = { readonly id: string; readonly status: "fail" | "accepted"; readonly controls: readonly string[]; readonly detail: string };

/** The rows of the findings by asset: those that still count against it (`fail`) and those whose risk is accepted (`accepted`); false positives, duplicates and verified fixes are not rows. */
export function rowsByAsset(findings: readonly Finding[], states: readonly State[]): ReadonlyMap<string, readonly Row[]> {
  const byId = new Map(states.map((s) => [s.id, s]));
  const out = new Map<string, Row[]>();
  for (const f of findings) {
    const s = byId.get(f.id);
    const status = s === undefined || OPEN_STATUSES.includes(s.status) ? "fail" : s.status === "accepted" ? "accepted" : undefined;
    if (status === undefined) continue;
    const rows = out.get(f.asset) ?? [];
    rows.push({ id: `finding-${f.id}`, status, controls: controlsOf(f), detail: `${f.severity}: ${f.title}${f.location === undefined ? "" : ` at ${f.location}`} (${f.source.tool}, ${s?.status ?? "open"})` });
    out.set(f.asset, rows);
  }
  return out;
}
