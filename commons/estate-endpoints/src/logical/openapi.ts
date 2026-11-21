// Spec: 0003-estate-endpoints-readers FR-001
/**
 * OpenAPI and Swagger descriptions, as JSON or YAML: every server of the description is an endpoint (a templated address takes the default of its variable; a relative address has no host and is a problem, because it is only where the description was served from), with the way a client proves who it is
 * from the security the description declares (`none` where it declares none, the strongest where it declares several), and `api: openapi`. Operations and schemas are not read.
 *
 * @example
 * ```ts
 * import { importOpenApi } from "./openapi.ts";
 * importOpenApi("api.json", JSON.stringify({ openapi: "3.0.3", servers: [{ url: "https://api.example.test/v1" }] })).assets.length; // 1
 * ```
 *
 * @module
 */
import { formatYamlError, parseYaml } from "@intellectual-frontiers/formats/yaml";
import { IdPool, present, slug, type Imported } from "@intellectual-frontiers/estate-iac/governance";
import { parts, provenance, type Found } from "@intellectual-frontiers/estate-endpoints/governance";

type Obj = { readonly [k: string]: unknown };
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

const STRENGTH = ["none", "basic", "token", "session", "oauth", "mtls"] as const;

/** How a client proves who it is, from a security scheme of the description. */
function schemeAuth(s: unknown): (typeof STRENGTH)[number] | "unknown" {
  if (!isObj(s)) return "unknown";
  const type = String(s["type"] ?? "").toLowerCase();
  if (type === "basic") return "basic";
  if (type === "http") return String(s["scheme"] ?? "").toLowerCase() === "basic" ? "basic" : "token";
  if (type === "apikey") return String(s["in"] ?? "") === "cookie" ? "session" : "token";
  if (type === "oauth2" || type === "openidconnect") return "oauth";
  if (type === "mutualtls") return "mtls";
  return "unknown";
}

/** The authentication the description declares: from the top-level security and the operations'. */
function authOf(doc: Obj): (typeof STRENGTH)[number] | "unknown" {
  const schemes = isObj(doc["components"]) && isObj((doc["components"] as Obj)["securitySchemes"]) ? ((doc["components"] as Obj)["securitySchemes"] as Obj) : isObj(doc["securityDefinitions"]) ? (doc["securityDefinitions"] as Obj) : {};
  const used = new Set<string>();
  const collect = (security: unknown): void => {
    for (const req of Array.isArray(security) ? security : []) if (isObj(req)) for (const name of Object.keys(req)) used.add(name);
  };
  collect(doc["security"]);
  for (const item of Object.values(isObj(doc["paths"]) ? doc["paths"] : {})) if (isObj(item)) for (const op of Object.values(item)) if (isObj(op)) collect(op["security"]);
  if (used.size === 0) return "none";
  const found = [...used].map((n) => schemeAuth(schemes[n]));
  if (found.every((x) => x === "unknown")) return "unknown";
  return found.reduce<(typeof STRENGTH)[number]>((best, x) => (x !== "unknown" && STRENGTH.indexOf(x) > STRENGTH.indexOf(best) ? x : best), "none");
}

/** The addresses a description gives its servers: OpenAPI 3's `servers` (with variables at their defaults), Swagger 2's `host`, `basePath` and `schemes`. */
function serversOf(doc: Obj): readonly string[] {
  if (Array.isArray(doc["servers"])) {
    return doc["servers"].flatMap((s) => {
      if (!isObj(s) || typeof s["url"] !== "string") return [];
      const vars = isObj(s["variables"]) ? s["variables"] : {};
      return [s["url"].replace(/\{([^}]+)\}/g, (_m, name: string) => String((isObj(vars[name]) ? (vars[name] as Obj)["default"] : undefined) ?? `{${name}}`))];
    });
  }
  if (typeof doc["host"] === "string") {
    const schemes = Array.isArray(doc["schemes"]) && doc["schemes"].length > 0 ? doc["schemes"].filter((x): x is string => typeof x === "string") : ["https"];
    return schemes.map((sc) => `${sc}://${doc["host"] as string}${typeof doc["basePath"] === "string" ? doc["basePath"] : ""}`);
  }
  return [];
}

/** The endpoints of a description. */
export function importOpenApi(source: string, text: string): Found {
  const none = (message: string): Found => ({ format: "openapi", source, assets: [], links: [], problems: [message] });
  let doc: unknown;
  if (text.trimStart().startsWith("{")) {
    try {
      doc = JSON.parse(text);
    } catch (e) {
      return none(`${source}: not JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    const y = parseYaml(text);
    if (y.kind === "err") return none(`${source}: ${formatYamlError(y.error)}`);
    doc = y.value;
  }
  if (!isObj(doc) || (typeof doc["openapi"] !== "string" && typeof doc["swagger"] !== "string")) return none(`${source}: no openapi or swagger version: it is not an OpenAPI description`);
  const auth = authOf(doc);
  const title = isObj(doc["info"]) && typeof (doc["info"] as Obj)["title"] === "string" ? String((doc["info"] as Obj)["title"]) : source;
  const ids = new IdPool();
  const assets: Imported[] = [];
  const problems: string[] = [];
  serversOf(doc).forEach((url, i) => {
    const p = parts(url);
    if (p === undefined) {
      problems.push(`${source}: servers[${i}] ${JSON.stringify(url)} is not an absolute address (a relative one is only where the description was served from)`);
      return;
    }
    assets.push({ id: ids.take(slug("api", title, p.host, p.port === undefined ? "" : String(p.port))), kind: "endpoint", attributes: present({ scheme: p.scheme, host: p.host, port: p.port, path: p.path, authentication: auth, api: "openapi", provenance: provenance("openapi", source, `servers[${i}]`) }) });
  });
  if (assets.length === 0 && problems.length === 0) problems.push(`${source}: the description names no server: give the address it is served at`);
  return { format: "openapi", source, assets, links: [], problems };
}
