// Spec: 0003-estate-endpoints-readers FR-009
/**
 * Reading files for the readers: a file given by name must be one a reader reads; a folder is walked and a file in it that no reader reads is skipped without a word (a folder holds much besides endpoints), except the folders of tools. A PEM with certificates is read here, with the cryptography of the runtime:
 * the subject, the names, the issuer, the day it ends and the key. After all files are read, each endpoint that speaks over TLS is linked to the certificate that covers its name, and where two files give one identity the first is kept.
 *
 * @example
 * ```ts
 * import { importPaths } from "./files.ts";
 * // await importPaths(["api/openapi.yaml", "mobile/AndroidManifest.xml"]) // { assets, links, problems, files }
 * ```
 *
 * @module
 */
import { X509Certificate } from "node:crypto";
import { fs, path } from "@intellectual-frontiers/system";
import type { Imported, ImportedLink } from "@intellectual-frontiers/estate-iac/governance";
import type { Format } from "@intellectual-frontiers/estate-endpoints/governance";
import { detectFormat, importCertificates, readText, secure, type CertFacts, type ReadOptions } from "@intellectual-frontiers/estate-endpoints/logical";

/** What reading several paths gave. */
export type ImportedPaths = { readonly assets: readonly Imported[]; readonly links: readonly ImportedLink[]; readonly problems: readonly string[]; readonly files: readonly { readonly source: string; readonly format: Format; readonly assets: number }[] };

const SKIPPED = new Set(["node_modules", ".git", ".terraform", ".terragrunt-cache", "build", "Pods"]);
const READABLE = /\.(json|ya?ml|xml|plist|graphql|gql|pem|crt|cer|zone)$/i;

/** The certificates of a PEM text, as facts. */
export function certificatesOf(pem: string): readonly CertFacts[] {
  const out: CertFacts[] = [];
  for (const block of pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? []) {
    let c: X509Certificate;
    try {
      c = new X509Certificate(block);
    } catch {
      continue;
    }
    const cn = (dn: string): string => /(?:^|\n)CN=([^\n]*)/.exec(dn)?.[1] ?? "";
    const san = (c.subjectAltName ?? "").split(/,\s*/).flatMap((x) => (x.startsWith("DNS:") ? [x.slice(4)] : []));
    const d = c.publicKey.asymmetricKeyDetails;
    const type = c.publicKey.asymmetricKeyType ?? "unknown";
    out.push({ subject: cn(c.subject), names: san, issuer: cn(c.issuer) || c.issuer.replace(/\n/g, ", "), notAfter: new Date(c.validTo).toISOString().slice(0, 10), key: type === "rsa" ? `rsa-${d?.modulusLength ?? 0}` : type === "ec" ? `ec-${d?.namedCurve ?? "unknown"}` : type });
  }
  return out;
}

/** The assets and links of the files and folders at the paths. */
export async function importPaths(paths: readonly string[], options: ReadOptions = {}): Promise<ImportedPaths> {
  const assets: Imported[] = [];
  const problems: string[] = [];
  const files: { source: string; format: Format; assets: number }[] = [];
  const links: ImportedLink[] = [];
  const seen = new Map<string, string>();
  const one = async (file: string, explicit: boolean): Promise<void> => {
    const text = await fs.readTextFile(file).catch(() => undefined);
    if (text === undefined) {
      if (explicit) problems.push(`${file}: cannot be read`);
      return;
    }
    const format = detectFormat(file, text);
    if (format === undefined && !explicit) return;
    const r = format === "certificate" ? importCertificates(file, certificatesOf(text)) : readText(file, text, options);
    problems.push(...r.problems);
    const kept = new Set<string>();
    const clashes = new Map<string, number>();
    for (const a of r.assets) {
      const first = seen.get(a.id);
      if (first !== undefined) {
        clashes.set(first, (clashes.get(first) ?? 0) + 1);
        continue;
      }
      seen.set(a.id, file);
      kept.add(a.id);
      assets.push(a);
    }
    for (const [first, n] of clashes) problems.push(`${file}: ${n} identit${n === 1 ? "y is" : "ies are"} also in ${first}; the first is kept`);
    links.push(...r.links.filter((l) => (kept.has(l.from) || options.asset === l.from) && kept.has(l.to)));
    if (r.assets.length > 0 || r.problems.length === 0) files.push({ source: file, format: r.format === "openapi" && format !== "openapi" ? (format ?? r.format) : r.format, assets: kept.size });
  };
  for (const p of paths) {
    const st = await fs.stat(p).catch(() => undefined);
    if (st === undefined) {
      problems.push(`${p}: no such file or folder`);
      continue;
    }
    if (!st.isDirectory) {
      await one(p, true);
      continue;
    }
    for (const rel of await fs.walkFiles(p)) {
      if (rel.split("/").some((part) => SKIPPED.has(part)) || !READABLE.test(rel)) continue;
      await one(path.join(p, rel), false);
    }
  }
  return { assets, links: [...links, ...secure(assets)], problems, files };
}
