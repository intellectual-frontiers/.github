// Spec: 0003-findings-importers FR-008
/**
 * Nmap: the XML of `-oX`. Every open port of every host is an informational finding (the rule is `open-port`, the title says the port and the service), with the host name (or the address) as the asset, the port and protocol as the place, and the product and version the scan read from the service. Ports that are
 * closed or filtered are not findings. What an open port means is the passive checks' to say, over the endpoints the estate holds: this importer only says what is open.
 *
 * @example
 * ```ts
 * import { importNmap } from "./nmap.ts";
 * importNmap("n.xml", "<nmaprun/>").findings; // []
 * ```
 *
 * @module
 */
import { formatXmlError, readXml, type XmlElement } from "@intellectual-frontiers/formats/xml";
import type { RawFinding } from "@intellectual-frontiers/findings/governance";
import type { Imported } from "./result.ts";

const kids = (e: XmlElement, name: string): readonly XmlElement[] => e.children.filter((c): c is XmlElement => c.kind === "element" && c.name === name);
const attr = (e: XmlElement | undefined, name: string): string | undefined => e?.attributes.find(([n]) => n === name)?.[1];

/** The findings of an nmap XML report. */
export function importNmap(file: string, xml: string): Imported {
  const doc = readXml(xml);
  if (doc.kind === "err") return { findings: [], problems: [`${file}: ${formatXmlError(doc.error)}`] };
  if (doc.value.name !== "nmaprun") return { findings: [], problems: [`${file}: no nmaprun: it is not an nmap XML report`] };
  const version = attr(doc.value, "version");
  const findings: RawFinding[] = [];
  for (const host of kids(doc.value, "host")) {
    const name = attr(kids(kids(host, "hostnames")[0] ?? host, "hostname")[0], "name");
    const addr = attr(kids(host, "address")[0], "addr");
    const asset = name ?? addr ?? "unknown";
    for (const port of kids(kids(host, "ports")[0] ?? host, "port")) {
      if (attr(kids(port, "state")[0], "state") !== "open") continue;
      const id = attr(port, "portid") ?? "0";
      const proto = attr(port, "protocol") ?? "tcp";
      const svc = kids(port, "service")[0];
      const service = attr(svc, "name") ?? "unknown";
      const product = [attr(svc, "product"), attr(svc, "version")].filter((x): x is string => x !== undefined).join(" ");
      findings.push({
        rule: "open-port",
        title: `Open port ${id}/${proto} (${service})`,
        severity: "info",
        asset,
        location: `${id}/${proto}`,
        description: `${product === "" ? `The service looks like ${service}.` : `The service is ${product}.`}`,
        cwe: [],
        cve: [],
        source: { tool: "nmap", ...(version === undefined ? {} : { version }), file },
      });
    }
  }
  return { findings, problems: [] };
}
