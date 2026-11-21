// Spec: 0003-findings-importers FR-007
/**
 * Nuclei: the JSON lines of `-jsonl`. Every line is a finding with the template as the rule, the severity the template gives (info, low, medium, high, critical), the host as the asset (the origin of the address), the address it matched as the place, and the CVE and CWE of the template's classification.
 * The request, the response and the command line to repeat it (which hold what was sent) are never read; what the template extracted is cut short and redacted.
 *
 * @example
 * ```ts
 * import { importNuclei } from "./nuclei.ts";
 * importNuclei("n.jsonl", "").findings; // []
 * ```
 *
 * @module
 */
import { cweOf, redact, type RawFinding, type Severity } from "@intellectual-frontiers/findings/governance";
import type { Imported } from "./result.ts";

type Obj = { readonly [k: string]: unknown };
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);
const strs = (v: unknown): readonly string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : typeof v === "string" ? [v] : []);

const SEVERITY: Readonly<Record<string, Severity>> = { info: "info", low: "low", medium: "medium", high: "high", critical: "critical" };

/** The findings of nuclei's JSON lines. */
export function importNuclei(file: string, text: string): Imported {
  const findings: RawFinding[] = [];
  const problems: string[] = [];
  let n = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    n += 1;
    let d: unknown;
    try {
      d = JSON.parse(line);
    } catch {
      problems.push(`${file}: line ${n} is not JSON`);
      continue;
    }
    if (!isObj(d) || typeof d["template-id"] !== "string") {
      problems.push(`${file}: line ${n} has no template-id: it is not nuclei's output`);
      continue;
    }
    const info = isObj(d["info"]) ? d["info"] : {};
    const cls = isObj(info["classification"]) ? info["classification"] : {};
    const host = str(d["host"]) ?? str(d["ip"]) ?? "unknown";
    const asset = (() => {
      try {
        const u = new URL(host);
        return u.protocol === "http:" || u.protocol === "https:" ? u.origin : host;
      } catch {
        return host;
      }
    })();
    const matched = str(d["matched-at"]);
    const extracted = strs(d["extracted-results"]).join(", ");
    findings.push({
      rule: d["template-id"],
      title: str(info["name"]) ?? d["template-id"],
      severity: SEVERITY[String(info["severity"] ?? "info").toLowerCase()] ?? "info",
      asset,
      ...(matched === undefined ? {} : { location: matched }),
      description: (str(info["description"]) ?? "").replace(/\s+/g, " ").trim().slice(0, 1000),
      ...(str(info["remediation"]) === undefined ? {} : { solution: (str(info["remediation"]) as string).slice(0, 500) }),
      cwe: [...new Set(strs(cls["cwe-id"]).map((c) => cweOf(c)).filter((c): c is string => c !== undefined))],
      cve: [...new Set(strs(cls["cve-id"]).map((c) => c.toUpperCase()))],
      ...(extracted === "" ? {} : { evidence: redact(extracted) }),
      source: { tool: "nuclei", file },
    });
  }
  return { findings, problems };
}
