// Spec: 0003-estate-iac-importers FR-005
/**
 * Compose files: every service is an application with its image, an endpoint for each port it publishes (open to the internet where it is published on all interfaces, internal where it is published on the loopback), exposed by the service, and a dependency for each service it `depends_on`.
 * Environment values are never read.
 *
 * @example
 * ```ts
 * import { importCompose } from "./compose.ts";
 * importCompose("compose.yaml", "services:\n  web:\n    image: nginx\n    ports:\n      - \"8080:80\"\n").assets.length; // 2
 * ```
 *
 * @module
 */
import { parseYaml, formatYamlError } from "@intellectual-frontiers/formats/yaml";
import { distinctLinks, IdPool, present, provenanceOf, slug, type Imported, type ImportedLink, type Imports } from "@intellectual-frontiers/estate-iac/governance";

type Obj = { readonly [k: string]: unknown };
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** A published port, as a short or a long form gives it: the host address, the published port and the protocol; nothing where the port is not published. */
function published(p: unknown): { readonly host: string; readonly port: number; readonly udp: boolean } | undefined {
  if (isObj(p)) {
    const port = typeof p["published"] === "number" ? p["published"] : Number(p["published"]);
    return Number.isInteger(port) && port > 0 ? { host: typeof p["host_ip"] === "string" ? p["host_ip"] : "0.0.0.0", port, udp: p["protocol"] === "udp" } : undefined;
  }
  const text = String(p);
  const udp = text.endsWith("/udp");
  const parts = text.replace(/\/(tcp|udp)$/, "").split(":");
  if (parts.length < 2) return undefined;
  const hostPort = Number(parts[parts.length - 2]);
  if (!Number.isInteger(hostPort) || hostPort <= 0) return undefined;
  return { host: parts.length === 3 ? (parts[0] ?? "0.0.0.0") : "0.0.0.0", port: hostPort, udp };
}

/** The services of a Compose file as assets and links. */
export function importCompose(source: string, text: string): Imports {
  const y = parseYaml(text);
  if (y.kind === "err") return { tool: "compose", source, assets: [], links: [], problems: [`${source}: ${formatYamlError(y.error)}`] };
  const doc = y.value;
  if (!isObj(doc) || !isObj(doc["services"])) return { tool: "compose", source, assets: [], links: [], problems: [`${source}: no services: it is not a Compose file`] };
  const ids = new IdPool();
  const assets: Imported[] = [];
  const links: ImportedLink[] = [];
  const apps = new Map<string, Imported>();
  const needs = new Map<string, string[]>();
  for (const [name, svc] of Object.entries(doc["services"])) {
    if (!isObj(svc)) continue;
    const provenance = provenanceOf("compose", source, name);
    const app: Imported = { id: ids.take(slug("compose", name)), kind: "application", attributes: present({ image: typeof svc["image"] === "string" ? svc["image"] : undefined, provenance }) };
    assets.push(app);
    apps.set(name, app);
    const dep = svc["depends_on"];
    needs.set(name, Array.isArray(dep) ? dep.filter((x): x is string => typeof x === "string") : isObj(dep) ? Object.keys(dep) : []);
    for (const p of Array.isArray(svc["ports"]) ? svc["ports"] : []) {
      const pub = published(p);
      if (pub === undefined) continue;
      const loopback = pub.host === "127.0.0.1" || pub.host === "::1" || pub.host === "localhost";
      const e: Imported = { id: ids.take(slug("compose", name, String(pub.port))), kind: "endpoint", attributes: present({ scheme: pub.udp ? "udp" : "tcp", host: pub.host, port: pub.port, exposure: loopback ? "internal" : "internet", provenance }) };
      assets.push(e);
      links.push({ from: app.id, to: e.id, kind: "exposes" });
    }
  }
  for (const [name, list] of needs) {
    const me = apps.get(name);
    for (const d of list) {
      const target = apps.get(d);
      if (me !== undefined && target !== undefined) links.push({ from: me.id, to: target.id, kind: "depends-on" });
    }
  }
  return { tool: "compose", source, assets, links: distinctLinks(links), problems: [] };
}
