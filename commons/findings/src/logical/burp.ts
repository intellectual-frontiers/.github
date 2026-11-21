// Spec: 0003-findings-importers FR-003
/**
 * Burp Suite: the XML report (`<issues>`). Each issue is a finding with the severity Burp gives it (High, Medium, Low, Information; Burp has no critical), the host as the asset, the path as the place, the CWE from the vulnerability classifications, and the background and remediation text without markup. The
 * requests and responses an issue carries (base64) are never read: they hold what the tester sent and what came back.
 *
 * @example
 * ```ts
 * import { importBurp } from "./burp.ts";
 * importBurp("burp.xml", "<issues/>").findings; // []
 * ```
 *
 * @module
 */
import { formatXmlError, readXml, type XmlElement } from "@intellectual-frontiers/formats/xml";
import { cvesIn, cweOf, type RawFinding, type Severity } from "@intellectual-frontiers/findings/governance";
import type { Imported } from "./result.ts";

const child = (e: XmlElement, name: string): XmlElement | undefined => e.children.find((c): c is XmlElement => c.kind === "element" && c.name === name);
const text = (e: XmlElement | undefined): string => (e === undefined ? "" : e.children.map((c) => (c.kind === "text" ? c.text : text(c))).join(""));
const plain = (html: string): string => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const SEVERITY: Readonly<Record<string, Severity>> = { high: "high", medium: "medium", low: "low", information: "info", info: "info" };

/** The findings of a Burp XML report. */
export function importBurp(file: string, xml: string): Imported {
  const doc = readXml(xml);
  if (doc.kind === "err") return { findings: [], problems: [`${file}: ${formatXmlError(doc.error)}`] };
  if (doc.value.name !== "issues") return { findings: [], problems: [`${file}: no issues: it is not a Burp XML report`] };
  const version = doc.value.attributes.find(([n]) => n === "burpVersion")?.[1];
  const findings: RawFinding[] = [];
  for (const issue of doc.value.children.filter((c): c is XmlElement => c.kind === "element" && c.name === "issue")) {
    const classes = plain(text(child(issue, "vulnerabilityClassifications")));
    const background = plain(text(child(issue, "issueBackground")));
    const detail = plain(text(child(issue, "issueDetail")));
    const fix = plain(`${text(child(issue, "remediationBackground"))} ${text(child(issue, "remediationDetail"))}`);
    const cwe = [...new Set((classes.match(/CWE-\d+/gi) ?? []).map((x) => cweOf(x)).filter((x): x is string => x !== undefined))];
    const path = text(child(issue, "path")).trim();
    findings.push({
      rule: text(child(issue, "type")).trim() || "unknown",
      title: text(child(issue, "name")).trim() || "issue",
      severity: SEVERITY[text(child(issue, "severity")).trim().toLowerCase()] ?? "medium",
      asset: text(child(issue, "host")).trim() || "unknown",
      ...(path === "" ? {} : { location: path }),
      description: `${background} ${detail}`.trim().slice(0, 1000),
      ...(fix === "" ? {} : { solution: fix.slice(0, 500) }),
      cwe,
      cve: cvesIn(`${classes} ${background}`),
      source: { tool: "burp", ...(version === undefined ? {} : { version }), file },
    });
  }
  return { findings, problems: [] };
}
