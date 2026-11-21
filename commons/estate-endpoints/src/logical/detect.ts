// Spec: 0003-estate-endpoints-readers FR-008
/**
 * Which reader reads a text: by what is in it. A JSON or YAML with `openapi` or `swagger` is OpenAPI; a text with `type Query` or `schema {`, or a JSON with `__schema`, is GraphQL; an XML with `<manifest` is an Android manifest and one with `<plist` an iOS property list; a PEM with a certificate is a
 * certificate; a text with `ss -tuln` lines or osquery's rows is listening ports; a text with `$ORIGIN` or an SOA record is a zone. A certificate is read by the physical layer, which has the cryptography.
 *
 * @example
 * ```ts
 * import { detectFormat } from "./detect.ts";
 * detectFormat("a.xml", '<manifest package="a.b"/>'); // "android"
 * ```
 *
 * @module
 */
import type { Found, Format } from "@intellectual-frontiers/estate-endpoints/governance";
import { importZone } from "./dns.ts";
import { importGraphql } from "./graphql.ts";
import { importListening } from "./listening.ts";
import { importAndroid, importIos } from "./mobile.ts";
import { importOpenApi } from "./openapi.ts";

/** The facts a reader may need that a text does not say. */
export type ReadOptions = { readonly url?: string; readonly host?: string; readonly asset?: string; readonly origin?: string };

/** The format of a text, or nothing where none is read. */
export function detectFormat(_source: string, text: string): Format | undefined {
  const t = text.trimStart();
  if (t.includes("-----BEGIN CERTIFICATE-----")) return "certificate";
  if (t.startsWith("<")) return /<manifest[\s>]/.test(t) ? "android" : /<plist[\s>]/.test(t) ? "ios" : undefined;
  if (t.startsWith("{")) {
    try {
      const d = JSON.parse(text) as Record<string, unknown>;
      if ("openapi" in d || "swagger" in d) return "openapi";
      if ("__schema" in d || (typeof d["data"] === "object" && d["data"] !== null && "__schema" in d["data"])) return "graphql";
    } catch {
      return undefined;
    }
    return undefined;
  }
  if (t.startsWith("[")) return /"port"\s*:/.test(t) && /"address"\s*:/.test(t) ? "listening-ports" : undefined;
  if (/^(openapi|swagger):/m.test(text)) return "openapi";
  if (/\btype\s+Query\b|\bschema\s*\{/.test(text)) return "graphql";
  if (/^(tcp|udp)\s+\S+\s+\d+\s+\d+\s+\S+:\d+/m.test(text)) return "listening-ports";
  if (/^\$ORIGIN\b/m.test(text) || /\bIN\s+SOA\b/.test(text)) return "dns-zone";
  return undefined;
}

/** The assets and links of a text by its format, or a problem where none is read. A certificate is not read here. */
export function readText(source: string, text: string, options: ReadOptions = {}): Found {
  const format = detectFormat(source, text);
  switch (format) {
    case "openapi":
      return importOpenApi(source, text);
    case "graphql":
      return importGraphql(source, text, options.url);
    case "android":
      return importAndroid(source, text);
    case "ios":
      return importIos(source, text);
    case "dns-zone":
      return importZone(source, text, options.origin ?? "");
    case "listening-ports":
      return options.host === undefined ? { format, source, assets: [], links: [], problems: [`${source}: a listing of ports does not say whose it is: give the machine's name`] } : importListening(source, options.host, text, options.asset);
    case "certificate":
      return { format, source, assets: [], links: [], problems: [`${source}: a certificate is read by the physical layer`] };
    default:
      return { format: "openapi", source, assets: [], links: [], problems: [`${source}: no reader reads it (OpenAPI, GraphQL, an Android manifest, an iOS Info.plist, a certificate, a zone file, the ports a machine listens on)`] };
  }
}
