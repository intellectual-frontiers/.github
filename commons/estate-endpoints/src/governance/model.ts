// Spec: 0002-estate-endpoints-model FR-001
/**
 * What a reader gives: assets and links of the estate, as the importers of infrastructure as code give them (`Imported`, `ImportedLink` of estate-iac), with the format that was read and what could not be read. Every asset carries `provenance` as `format:file#where`, and is
 * `discovered`: reading a description of an endpoint adopts nothing.
 *
 * @example
 * ```ts
 * import { provenance } from "./model.ts";
 * provenance("openapi", "api.yaml", "servers[0]"); // "openapi:api.yaml#servers[0]"
 * ```
 *
 * @module
 */
import type { Imported, ImportedLink } from "@intellectual-frontiers/estate-iac/governance";

/** The formats read. */
export const FORMATS = ["openapi", "graphql", "android", "ios", "dns-zone", "certificate", "listening-ports"] as const;
/** A format read. */
export type Format = (typeof FORMATS)[number];

/** What a reader gives for one file or one text. */
export type Found = { readonly format: Format; readonly source: string; readonly assets: readonly Imported[]; readonly links: readonly ImportedLink[]; readonly problems: readonly string[] };

/** Where an asset was read from, as `format:file#where`. */
export function provenance(format: Format, source: string, where: string): string {
  return `${format}:${source}#${where}`;
}

/** The host, port and path of a URL, with the scheme: nothing where it is not an absolute URL of a scheme the estate has. */
export function parts(url: string): { readonly scheme: string; readonly host: string; readonly port?: number; readonly path?: string } | undefined {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return undefined;
  }
  const scheme = u.protocol.replace(/:$/, "");
  if (!["http", "https", "ws", "wss", "grpc", "tcp", "tls", "ssh"].includes(scheme) || u.hostname === "") return undefined;
  const port = u.port === "" ? undefined : Number(u.port);
  const path = u.pathname === "/" || u.pathname === "" ? undefined : u.pathname.replace(/\/$/, "");
  return { scheme, host: u.hostname, ...(port === undefined ? {} : { port }), ...(path === undefined ? {} : { path }) };
}
