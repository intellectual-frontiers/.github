// Spec: 0003-estate-endpoints-readers FR-006
/**
 * The ports a machine listens on, from what it reports: the text of `ss -tuln` (with or without `-p`), or the rows of osquery's `listening_ports`. Each is an endpoint with the common service its port usually carries, the protocol, and `internal` where it is bound to the loopback (a wildcard bind says nothing of who can
 * reach it, and the exposure is left unsaid). The machine is linked to its endpoints (`exposes`). The text is read: nothing is run here.
 *
 * @example
 * ```ts
 * import { importListening } from "./listening.ts";
 * importListening("athens.txt", "athens", "tcp LISTEN 0 128 0.0.0.0:22 0.0.0.0:*\n").assets.length; // 1
 * ```
 *
 * @module
 */
import { servicesOnPort } from "@intellectual-frontiers/estate/governance";
import { distinctLinks, IdPool, present, slug, type Imported, type ImportedLink } from "@intellectual-frontiers/estate-iac/governance";
import { provenance, type Found } from "@intellectual-frontiers/estate-endpoints/governance";

type Listen = { readonly transport: "tcp" | "udp"; readonly address: string; readonly port: number };

const LOOPBACK = (a: string): boolean => a === "127.0.0.1" || a === "::1" || a.startsWith("127.") || a === "localhost";

/** One line of `ss -tuln`: the transport, and the local address and port. */
function ssLine(line: string): Listen | undefined {
  const f = line.trim().split(/\s+/);
  const transport = f[0] === "tcp" || f[0] === "udp" ? f[0] : undefined;
  if (transport === undefined) return undefined;
  if (transport === "tcp" && f[1] !== undefined && f[1] !== "LISTEN") return undefined;
  const local = f.find((x, i) => i >= 4 && /:\d+$/.test(x));
  if (local === undefined) return undefined;
  const at = local.lastIndexOf(":");
  const port = Number(local.slice(at + 1));
  const address = local.slice(0, at).replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  return Number.isInteger(port) && port > 0 ? { transport, address, port } : undefined;
}

/** The endpoints of the ports a machine listens on. `host` is the machine's name or address as a client reaches it, and `asset` its identity in the estate, where it has one. */
export function importListening(source: string, host: string, text: string, asset?: string): Found {
  const rows: Listen[] = [];
  const trimmed = text.trimStart();
  if (trimmed.startsWith("[")) {
    try {
      for (const r of JSON.parse(text) as Record<string, unknown>[]) {
        const port = Number(r["port"]);
        const proto = String(r["protocol"] ?? "");
        if (!Number.isInteger(port) || port <= 0) continue;
        rows.push({ transport: proto === "17" || proto === "udp" ? "udp" : "tcp", address: String(r["address"] ?? ""), port });
      }
    } catch {
      return { format: "listening-ports", source, assets: [], links: [], problems: [`${source}: not JSON`] };
    }
  } else {
    for (const line of text.split(/\r?\n/)) {
      const r = ssLine(line);
      if (r !== undefined) rows.push(r);
    }
  }
  if (rows.length === 0) return { format: "listening-ports", source, assets: [], links: [], problems: [`${source}: no listening port: it is neither \`ss -tuln\` nor osquery's listening_ports`] };
  const ids = new IdPool();
  const seen = new Set<string>();
  const assets: Imported[] = [];
  const links: ImportedLink[] = [];
  for (const r of rows) {
    const key = `${r.transport}/${r.port}/${LOOPBACK(r.address)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const service = servicesOnPort(r.port, r.transport)[0];
    const loop = LOOPBACK(r.address);
    const scheme = service?.name === "http" ? "http" : service?.name === "https" ? "https" : r.transport;
    const ep: Imported = { id: ids.take(slug("listen", host, r.transport, String(r.port), loop ? "loopback" : "")), kind: "endpoint", attributes: present({ scheme, host: loop ? r.address : host, port: r.port, service: service?.name, exposure: loop ? "internal" : undefined, provenance: provenance("listening-ports", source, `${r.transport}/${r.port}`) }) };
    assets.push(ep);
    if (asset !== undefined) links.push({ from: asset, to: ep.id, kind: "exposes" });
  }
  return { format: "listening-ports", source, assets, links: distinctLinks(links), problems: [] };
}
