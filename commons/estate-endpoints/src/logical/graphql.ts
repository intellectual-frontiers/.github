// Spec: 0003-estate-endpoints-readers FR-002
/**
 * GraphQL: a schema (the language of types, or the JSON of an introspection) says what is served and never where, so the address is given; the endpoint is `api: graphql` with the authentication left unknown, because a schema does not say it. A text that is neither a schema nor an introspection is a problem.
 *
 * @example
 * ```ts
 * import { importGraphql } from "./graphql.ts";
 * importGraphql("schema.graphql", "type Query { ok: Boolean }", "https://api.example.test/graphql").assets.length; // 1
 * ```
 *
 * @module
 */
import { present, slug } from "@intellectual-frontiers/estate-iac/governance";
import { parts, provenance, type Found } from "@intellectual-frontiers/estate-endpoints/governance";

/** The endpoint of a GraphQL schema served at `url`. */
export function importGraphql(source: string, text: string, url: string | undefined): Found {
  const none = (message: string): Found => ({ format: "graphql", source, assets: [], links: [], problems: [message] });
  const sdl = /\btype\s+Query\b|\bschema\s*\{/.test(text);
  let introspection = false;
  try {
    const d = JSON.parse(text) as { data?: { __schema?: unknown }; __schema?: unknown };
    introspection = d.__schema !== undefined || d.data?.__schema !== undefined;
  } catch {
    // not JSON: the language of types is judged by `sdl`
  }
  if (!sdl && !introspection) return none(`${source}: neither a GraphQL schema nor an introspection result`);
  if (url === undefined) return none(`${source}: a GraphQL schema does not say where it is served: give the address`);
  const p = parts(url);
  if (p === undefined) return none(`${source}: ${JSON.stringify(url)} is not an absolute address`);
  return { format: "graphql", source, assets: [{ id: slug("api", "graphql", p.host, p.port === undefined ? "" : String(p.port), p.path ?? ""), kind: "endpoint", attributes: present({ scheme: p.scheme, host: p.host, port: p.port, path: p.path, authentication: "unknown", api: "graphql", provenance: provenance("graphql", source, "schema") }) }], links: [], problems: [] };
}
