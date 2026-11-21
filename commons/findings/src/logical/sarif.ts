// Spec: 0003-findings-importers FR-001
/**
 * SARIF 2.1.0: every result of every run is a finding. The severity is the `security-severity` score where the rule or the result has one (9 and over critical, 7 high, 4 medium, above 0 low), else the level (`error` high, `warning` medium, `note` low, `none` info). The weakness is read
 * from the rule's tags (`external/cwe/cwe-79`), the place from the first location (the file and the line). SARIF says what was scanned in its locations, not as a host, so the asset is given (the repository or the system the scan was of).
 *
 * @example
 * ```ts
 * import { importSarif } from "./sarif.ts";
 * importSarif("a.sarif", JSON.stringify({ version: "2.1.0", runs: [] }), "portal").findings; // []
 * ```
 *
 * @module
 */
import { cvesIn, cweOf, redact, type RawFinding, type Severity } from "@intellectual-frontiers/findings/governance";
import type { Imported } from "./result.ts";

type Obj = { readonly [k: string]: unknown };
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);

function severityOf(score: unknown, level: unknown): Severity {
  const n = typeof score === "number" ? score : typeof score === "string" ? Number(score) : Number.NaN;
  if (!Number.isNaN(n)) return n >= 9 ? "critical" : n >= 7 ? "high" : n >= 4 ? "medium" : n > 0 ? "low" : "info";
  return level === "error" ? "high" : level === "warning" ? "medium" : level === "note" ? "low" : level === "none" ? "info" : "medium";
}

/** The findings of a SARIF log of the asset given. */
export function importSarif(file: string, text: string, asset: string): Imported {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return { findings: [], problems: [`${file}: not JSON`] };
  }
  if (!isObj(doc) || !Array.isArray(doc["runs"]) || typeof doc["version"] !== "string") return { findings: [], problems: [`${file}: no version and runs: it is not SARIF`] };
  const findings: RawFinding[] = [];
  for (const run of doc["runs"]) {
    if (!isObj(run) || !isObj(run["tool"]) || !isObj((run["tool"] as Obj)["driver"])) continue;
    const driver = (run["tool"] as Obj)["driver"] as Obj;
    const tool = str(driver["name"]) ?? "sarif";
    const rules = new Map<string, Obj>();
    for (const r of Array.isArray(driver["rules"]) ? driver["rules"] : []) if (isObj(r) && typeof r["id"] === "string") rules.set(r["id"], r);
    for (const r of Array.isArray(run["results"]) ? run["results"] : []) {
      if (!isObj(r)) continue;
      const ruleId = str(r["ruleId"]) ?? "unknown";
      const rule = rules.get(ruleId);
      const props = isObj(rule?.["properties"]) ? (rule?.["properties"] as Obj) : {};
      const resultProps = isObj(r["properties"]) ? r["properties"] : {};
      const tags = Array.isArray(props["tags"]) ? props["tags"].filter((x): x is string => typeof x === "string") : [];
      const loc = Array.isArray(r["locations"]) && isObj(r["locations"][0]) ? (r["locations"][0] as Obj) : {};
      const phys = isObj(loc["physicalLocation"]) ? (loc["physicalLocation"] as Obj) : {};
      const uri = isObj(phys["artifactLocation"]) ? str((phys["artifactLocation"] as Obj)["uri"]) : undefined;
      const line = isObj(phys["region"]) && typeof (phys["region"] as Obj)["startLine"] === "number" ? (phys["region"] as Obj)["startLine"] : undefined;
      const message = isObj(r["message"]) ? (str((r["message"] as Obj)["text"]) ?? "") : "";
      const short = isObj(rule?.["shortDescription"]) ? str((rule?.["shortDescription"] as Obj)["text"]) : undefined;
      const help = isObj(rule?.["help"]) ? str((rule?.["help"] as Obj)["text"]) : undefined;
      const cwe = [...new Set(tags.map((t) => (/cwe/i.test(t) ? cweOf(t) : undefined)).filter((x): x is string => x !== undefined))];
      findings.push({
        rule: ruleId,
        title: short ?? message.split("\n")[0]?.slice(0, 120) ?? ruleId,
        severity: severityOf(resultProps["security-severity"] ?? props["security-severity"], r["level"] ?? (isObj(rule?.["defaultConfiguration"]) ? (rule?.["defaultConfiguration"] as Obj)["level"] : undefined)),
        asset,
        ...(uri === undefined ? {} : { location: `${uri}${line === undefined ? "" : `:${line}`}` }),
        description: redact(message),
        ...(help === undefined ? {} : { solution: help.slice(0, 500) }),
        cwe,
        cve: cvesIn(`${message} ${tags.join(" ")}`),
        source: { tool, ...(str(driver["version"]) === undefined ? {} : { version: str(driver["version"]) as string }), file },
      });
    }
  }
  return { findings, problems: [] };
}
