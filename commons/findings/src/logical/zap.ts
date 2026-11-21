// Spec: 0003-findings-importers FR-002
/**
 * OWASP ZAP: the JSON report (`-J`, or the traditional JSON report). Every alert of every site is one finding (the instances of an alert are one finding with the first place and how many there were), with the risk code as the severity (3 high, 2 medium, 1 low, 0 informational: ZAP has no critical), the CWE from `cweid`
 * and the asset the origin of the site. The request, the response and the evidence of an instance are cut short and redacted.
 *
 * @example
 * ```ts
 * import { importZap } from "./zap.ts";
 * importZap("zap.json", JSON.stringify({ site: [] })).findings; // []
 * ```
 *
 * @module
 */
import { cweOf, redact, type RawFinding, type Severity } from "@intellectual-frontiers/findings/governance";
import type { Imported } from "./result.ts";

type Obj = { readonly [k: string]: unknown };
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);
const plain = (html: string | undefined): string => (html ?? "").replace(/<\/?p>/g, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

const RISK: readonly Severity[] = ["info", "low", "medium", "high"];

/** The findings of a ZAP JSON report. */
export function importZap(file: string, text: string): Imported {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return { findings: [], problems: [`${file}: not JSON`] };
  }
  if (!isObj(doc) || !Array.isArray(doc["site"])) return { findings: [], problems: [`${file}: no site: it is not a ZAP JSON report`] };
  const version = str(doc["@version"]);
  const findings: RawFinding[] = [];
  for (const site of doc["site"]) {
    if (!isObj(site)) continue;
    const name = str(site["@name"]) ?? str(site["@host"]) ?? "unknown";
    const asset = (() => {
      try {
        return new URL(name).origin;
      } catch {
        return name;
      }
    })();
    for (const a of Array.isArray(site["alerts"]) ? site["alerts"] : []) {
      if (!isObj(a)) continue;
      const risk = Number(a["riskcode"] ?? 0);
      const instances = Array.isArray(a["instances"]) ? a["instances"].filter(isObj) : [];
      const first = instances[0];
      const uri = str(first?.["uri"]);
      const cwe = cweOf(a["cweid"] as string | number | undefined);
      findings.push({
        rule: str(a["pluginid"]) ?? str(a["alertRef"]) ?? str(a["alert"]) ?? "unknown",
        title: str(a["name"]) ?? str(a["alert"]) ?? "alert",
        severity: RISK[Math.min(Math.max(Number.isNaN(risk) ? 0 : risk, 0), 3)] ?? "info",
        asset,
        ...(uri === undefined ? {} : { location: uri }),
        description: `${plain(str(a["desc"]))}${instances.length > 1 ? ` (${instances.length} places)` : ""}`.trim(),
        ...(plain(str(a["solution"])) === "" ? {} : { solution: plain(str(a["solution"])).slice(0, 500) }),
        cwe: cwe === undefined ? [] : [cwe],
        cve: [],
        ...(str(first?.["evidence"]) === undefined ? {} : { evidence: redact(str(first?.["evidence"]) as string) }),
        source: { tool: "zap", ...(version === undefined ? {} : { version }), file },
      });
    }
  }
  return { findings, problems: [] };
}
