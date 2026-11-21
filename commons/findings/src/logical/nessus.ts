// Spec: 0003-findings-importers FR-004
/**
 * Nessus: the `.nessus` XML export (`NessusClientData_v2`). Each report item of each host is a finding with the severity Nessus gives it (4 critical, 3 high, 2 medium, 1 low, 0 informational), the host as the asset, the port and protocol as the place, the plugin as the rule, the CVEs and the CWE it names, and
 * the synopsis, description and solution. What a plugin printed (`plugin_output`) is cut short and redacted, and the properties of the host (its credentials and its operating system) are not read.
 *
 * @example
 * ```ts
 * import { importNessus } from "./nessus.ts";
 * importNessus("a.nessus", "<NessusClientData_v2><Report name=\"r\"/></NessusClientData_v2>").findings; // []
 * ```
 *
 * @module
 */
import { formatXmlError, readXml, type XmlElement } from "@intellectual-frontiers/formats/xml";
import { cvesIn, cweOf, redact, type RawFinding, type Severity } from "@intellectual-frontiers/findings/governance";
import type { Imported } from "./result.ts";

const kids = (e: XmlElement, name: string): readonly XmlElement[] => e.children.filter((c): c is XmlElement => c.kind === "element" && c.name === name);
const text = (e: XmlElement | undefined): string => (e === undefined ? "" : e.children.map((c) => (c.kind === "text" ? c.text : text(c))).join("")).trim();
const attr = (e: XmlElement, name: string): string | undefined => e.attributes.find(([n]) => n === name)?.[1];

const SEVERITY: readonly Severity[] = ["info", "low", "medium", "high", "critical"];

/** The findings of a Nessus export. */
export function importNessus(file: string, xml: string): Imported {
  const doc = readXml(xml);
  if (doc.kind === "err") return { findings: [], problems: [`${file}: ${formatXmlError(doc.error)}`] };
  if (!doc.value.name.startsWith("NessusClientData")) return { findings: [], problems: [`${file}: no NessusClientData: it is not a Nessus export`] };
  const findings: RawFinding[] = [];
  for (const report of kids(doc.value, "Report")) {
    for (const host of kids(report, "ReportHost")) {
      const asset = attr(host, "name") ?? "unknown";
      for (const item of kids(host, "ReportItem")) {
        const port = attr(item, "port");
        const protocol = attr(item, "protocol");
        const description = `${text(kids(item, "synopsis")[0])} ${text(kids(item, "description")[0])}`.replace(/\s+/g, " ").trim();
        const cves = [...new Set([...kids(item, "cve").map((c) => text(c).toUpperCase()), ...cvesIn(description)])];
        const cwe = kids(item, "cwe").map((c) => cweOf(text(c))).filter((x): x is string => x !== undefined);
        const output = text(kids(item, "plugin_output")[0]);
        const solution = text(kids(item, "solution")[0]);
        findings.push({
          rule: attr(item, "pluginID") ?? "unknown",
          title: attr(item, "pluginName") ?? "plugin",
          severity: SEVERITY[Math.min(Math.max(Number(attr(item, "severity") ?? 0) || 0, 0), 4)] ?? "info",
          asset,
          ...(port === undefined || port === "0" ? {} : { location: `${port}/${protocol ?? "tcp"}` }),
          description: description.slice(0, 1000),
          ...(solution === "" || solution === "n/a" ? {} : { solution: solution.slice(0, 500) }),
          cwe: [...new Set(cwe)],
          cve: cves,
          ...(output === "" ? {} : { evidence: redact(output) }),
          source: { tool: "nessus", file },
        });
      }
    }
  }
  return { findings, problems: [] };
}
