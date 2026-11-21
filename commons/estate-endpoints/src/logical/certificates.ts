// Spec: 0003-estate-endpoints-readers FR-007
/**
 * Certificates, from the facts of one (read by the physical layer): an asset of the kind certificate, and the endpoints it secures: an endpoint that speaks over TLS whose host is one of the certificate's names (a wildcard name covers one label) is secured by it (`secured-by`).
 *
 * @example
 * ```ts
 * import { names } from "./certificates.ts";
 * names({ subject: "a.example.test", names: ["*.example.test"], issuer: "ca", notAfter: "2027-01-01", key: "rsa-2048" }); // ["a.example.test", "*.example.test"]
 * ```
 *
 * @module
 */
import { IdPool, present, slug, type Imported, type ImportedLink } from "@intellectual-frontiers/estate-iac/governance";
import { provenance, type Found } from "@intellectual-frontiers/estate-endpoints/governance";

/** What is read of a certificate. */
export type CertFacts = { readonly subject: string; readonly names: readonly string[]; readonly issuer: string; readonly notAfter: string; readonly key: string };

/** The names a certificate is valid for: its subject and its alternative names, without repeats. */
export function names(c: CertFacts): readonly string[] {
  return [...new Set([c.subject, ...c.names].filter((n) => n !== ""))];
}

/** Whether a name is covered by a certificate name (a wildcard covers exactly one label). */
export function covers(certName: string, host: string): boolean {
  const [c, h] = [certName.toLowerCase(), host.toLowerCase()];
  if (c === h) return true;
  if (!c.startsWith("*.")) return false;
  const rest = h.split(".").slice(1).join(".");
  return h.split(".").length > 1 && rest === c.slice(2);
}

const TLS_SCHEMES = new Set(["https", "tls", "wss", "grpc"]);

/** The assets of the certificates, as read. */
export function importCertificates(source: string, certs: readonly CertFacts[]): Found {
  if (certs.length === 0) return { format: "certificate", source, assets: [], links: [], problems: [`${source}: no certificate in it`] };
  const ids = new IdPool();
  return {
    format: "certificate",
    source,
    assets: certs.map((c, i): Imported => ({ id: ids.take(slug("cert", c.subject === "" ? (c.names[0] ?? `${i + 1}`) : c.subject)), kind: "certificate", attributes: present({ subject: c.subject === "" ? (c.names[0] ?? "") : c.subject, issuer: c.issuer, "not-after": c.notAfter, key: c.key, names: names(c) as string[], provenance: provenance("certificate", source, `#${i + 1}`) }) })),
    links: [],
    problems: [],
  };
}

/** The links of the endpoints a certificate secures, among the assets given: a certificate is matched to the endpoints that speak over TLS to one of its names. */
export function secure(assets: readonly Imported[]): readonly ImportedLink[] {
  const links: ImportedLink[] = [];
  for (const cert of assets.filter((a) => a.kind === "certificate")) {
    const certNames = Array.isArray(cert.attributes["names"]) ? (cert.attributes["names"] as readonly string[]) : typeof cert.attributes["subject"] === "string" ? [cert.attributes["subject"]] : [];
    for (const ep of assets.filter((a) => a.kind === "endpoint" && TLS_SCHEMES.has(String(a.attributes["scheme"])))) {
      const host = String(ep.attributes["host"] ?? "");
      if (certNames.some((n) => covers(n, host))) links.push({ from: ep.id, to: cert.id, kind: "secured-by" });
    }
  }
  return links;
}
