// Spec: 0003-estate-endpoints-readers FR-005
/**
 * DNS zone files (the master file format of RFC 1035): every name that owns a record is a domain (signed where its zone has a DNSKEY at the apex), and a CNAME to another name of the zone links the two (`resolves-to`). The zone is read as text: `$ORIGIN` and `$TTL` are honoured, a record may span lines in
 * parentheses, a missing owner is the one before, and a comment is dropped. Addresses and text are not copied.
 *
 * @example
 * ```ts
 * import { importZone } from "./dns.ts";
 * importZone("z.db", "$ORIGIN example.test.\nwww IN A 192.0.2.1\n").assets.length; // 1
 * ```
 *
 * @module
 */
import { distinctLinks, IdPool, present, slug, type Imported, type ImportedLink } from "@intellectual-frontiers/estate-iac/governance";
import { provenance, type Found } from "@intellectual-frontiers/estate-endpoints/governance";

const TYPES = new Set(["A", "AAAA", "CNAME", "MX", "NS", "TXT", "SRV", "CAA", "DNSKEY", "SOA", "PTR", "DS"]);

/** A line without its comment (a semicolon outside quotes). */
function uncomment(line: string): string {
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i - 1] !== "\\") quoted = !quoted;
    else if (c === ";" && !quoted) return line.slice(0, i);
  }
  return line;
}

/** The records of a zone: logical lines (a parenthesis joins the lines it spans). */
function logicalLines(text: string): readonly string[] {
  const out: string[] = [];
  let open = "";
  let depth = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = uncomment(raw);
    const indented = /^\s/.test(raw);
    if (depth === 0 && line.trim() === "") continue;
    const joined = depth > 0 ? ` ${line.trim()}` : `${indented ? " " : ""}${line.trimEnd()}`;
    depth += (line.match(/\(/g)?.length ?? 0) - (line.match(/\)/g)?.length ?? 0);
    open += joined;
    if (depth <= 0) {
      out.push(open.replace(/[()]/g, " "));
      open = "";
      depth = 0;
    }
  }
  if (open !== "") out.push(open.replace(/[()]/g, " "));
  return out;
}

/** The names of a zone as domains, with the links of its CNAMEs. `origin` is the zone's name where the text does not say it. */
export function importZone(source: string, text: string, origin = ""): Found {
  let base = origin.replace(/\.$/, "").toLowerCase();
  let last = "";
  const owners = new Map<string, { dnssec: boolean }>();
  const cnames: { from: string; to: string }[] = [];
  const absolute = (name: string): string => {
    if (name === "@") return base;
    if (name.endsWith(".")) return name.slice(0, -1).toLowerCase();
    return (base === "" ? name : `${name}.${base}`).toLowerCase();
  };
  for (const line of logicalLines(text)) {
    if (line.startsWith("$ORIGIN")) {
      base = (line.split(/\s+/)[1] ?? "").replace(/\.$/, "").toLowerCase();
      continue;
    }
    if (line.startsWith("$")) continue;
    const startsBlank = /^\s/.test(line);
    const tokens = line.trim().split(/\s+/);
    let i = 0;
    let owner = last;
    if (!startsBlank) {
      owner = absolute(tokens[0] ?? "");
      i = 1;
    }
    while (i < tokens.length && (/^\d+[smhdw]?$/i.test(tokens[i] ?? "") || /^(IN|CH|HS)$/i.test(tokens[i] ?? ""))) i++;
    const type = (tokens[i] ?? "").toUpperCase();
    if (!TYPES.has(type) || owner === "") continue;
    last = owner;
    const entry = owners.get(owner) ?? { dnssec: false };
    if (type === "DNSKEY" && owner === base) entry.dnssec = true;
    owners.set(owner, entry);
    if (type === "CNAME" && tokens[i + 1] !== undefined) cnames.push({ from: owner, to: absolute(tokens[i + 1] as string) });
  }
  if (owners.size === 0) return { format: "dns-zone", source, assets: [], links: [], problems: [`${source}: no records: it is not a zone file`] };
  const ids = new IdPool();
  const byName = new Map<string, Imported>();
  for (const [name, o] of [...owners].sort(([a], [b]) => (a < b ? -1 : 1))) byName.set(name, { id: ids.take(slug("dns", name)), kind: "domain", attributes: present({ name, ...(o.dnssec ? { dnssec: true } : {}), provenance: provenance("dns-zone", source, name) }) });
  const links: ImportedLink[] = [];
  for (const c of cnames) {
    const [a, b] = [byName.get(c.from), byName.get(c.to)];
    if (a !== undefined && b !== undefined) links.push({ from: a.id, to: b.id, kind: "depends-on" });
  }
  return { format: "dns-zone", source, assets: [...byName.values()], links: distinctLinks(links), problems: [] };
}
