// Spec: 0003-estate-iac-importers FR-001, FR-002
/**
 * OpenTofu and Terraform: the JSON of `show -json` for a plan or for a state, read as text. Every managed resource becomes an asset of the estate (a cloud resource; a record of the name system a domain; a load balancer listener an endpoint; a certificate a certificate), with the provider, the partition
 * (the government clouds are told from the others by the region), the type, the region and the identifier where the state has one. Only those facts are copied: the `values` of a resource are never, because a state holds secrets. A link is a reference between resources (a plan's expressions, a state's `depends_on`).
 *
 * @example
 * ```ts
 * import { importTerraform } from "./terraform.ts";
 * importTerraform("opentofu", "plan.json", JSON.stringify({ planned_values: { root_module: { resources: [] } } })).assets; // []
 * ```
 *
 * @module
 */
import { distinctLinks, IdPool, linkFor, present, provenanceOf, slug, type Imported, type ImportedLink, type Imports, type Tool } from "@intellectual-frontiers/estate-iac/governance";

type Obj = { readonly [k: string]: unknown };
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);

const PROVIDERS: Readonly<Record<string, string>> = { aws: "aws", azurerm: "azure", azapi: "azure", azuread: "azure", cloudflare: "cloudflare", google: "gcp", "google-beta": "gcp" };

/** The partition of a cloud from the region or location of a resource: AWS GovCloud regions begin `us-gov-`, Azure Government locations `usgov`, `usdod` or `usdodeast`. */
export function partitionOf(provider: string, region: string | undefined): string | undefined {
  const r = (region ?? "").toLowerCase().replace(/\s+/g, "");
  if (provider === "aws") return r.startsWith("us-gov-") ? "aws-us-gov" : "aws";
  if (provider === "azure") return r.startsWith("usgov") || r.startsWith("usdod") ? "azure-government" : "azure-public";
  if (provider === "cloudflare") return "cloudflare";
  return undefined;
}

type Found = { readonly address: string; readonly type: string; readonly name: string; readonly provider: string; readonly values: Obj; readonly dependsOn: readonly string[] };

function resourcesOf(module: unknown, out: Found[]): void {
  if (!isObj(module)) return;
  for (const r of Array.isArray(module["resources"]) ? module["resources"] : []) {
    if (!isObj(r) || r["mode"] !== "managed") continue;
    const providerName = str(r["provider_name"]) ?? "";
    out.push({
      address: str(r["address"]) ?? `${str(r["type"]) ?? "resource"}.${str(r["name"]) ?? "unnamed"}`,
      type: str(r["type"]) ?? "unknown",
      name: str(r["name"]) ?? "unnamed",
      provider: providerName.split("/").pop() ?? "",
      values: isObj(r["values"]) ? r["values"] : {},
      dependsOn: (Array.isArray(r["depends_on"]) ? r["depends_on"] : []).filter((x): x is string => typeof x === "string"),
    });
  }
  for (const child of Array.isArray(module["child_modules"]) ? module["child_modules"] : []) resourcesOf(child, out);
}

/** The resource addresses a plan's configuration says each resource refers to: from the `references` of its expressions and its `depends_on`. */
function configReferences(configuration: unknown): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const walk = (module: unknown, prefix: string): void => {
    if (!isObj(module)) return;
    for (const r of Array.isArray(module["resources"]) ? module["resources"] : []) {
      if (!isObj(r) || r["mode"] !== "managed") continue;
      const refs: string[] = [];
      const collect = (v: unknown): void => {
        if (Array.isArray(v)) v.forEach(collect);
        else if (isObj(v)) {
          if (Array.isArray(v["references"])) for (const x of v["references"]) if (typeof x === "string") refs.push(x);
          Object.values(v).forEach(collect);
        }
      };
      collect(r["expressions"]);
      for (const d of Array.isArray(r["depends_on"]) ? r["depends_on"] : []) if (typeof d === "string") refs.push(d);
      out.set(`${prefix}${str(r["address"]) ?? ""}`, refs);
    }
    for (const [name, call] of Object.entries(isObj(module["module_calls"]) ? module["module_calls"] : {})) if (isObj(call)) walk(call["module"], `module.${name}.`);
  };
  if (isObj(configuration)) walk(configuration["root_module"], "");
  return out;
}

/** The address of the resource a reference names (`aws_instance.web.id` is `aws_instance.web`), or nothing where it names a variable, a local, a module output or a data source. */
function addressOfReference(ref: string): string | undefined {
  const parts = ref.split(".");
  if (parts.length < 2 || ["var", "local", "module", "data", "path", "each", "count", "self", "terraform"].includes(parts[0] ?? "")) return undefined;
  return `${parts[0]}.${(parts[1] ?? "").replace(/\[.*$/, "")}`;
}

const SCHEME: Readonly<Record<string, string>> = { HTTP: "http", HTTPS: "https", TCP: "tcp", TLS: "tls", UDP: "udp", TCP_UDP: "tcp", GENEVE: "udp" };

/** An asset for a resource. */
function assetOf(tool: Tool, source: string, f: Found, ids: IdPool): Imported {
  const provider = PROVIDERS[f.provider] ?? "other";
  const where = str(f.values["region"]) ?? str(f.values["location"]) ?? (str(f.values["availability_zone"]) ?? "").replace(/[a-z]$/, "");
  const provenance = provenanceOf(tool, source, f.address);
  const id = ids.take(slug("tf", f.address));
  if (/^(aws_route53_record|cloudflare_(dns_)?record|azurerm_dns_\w+_record)$/.test(f.type)) {
    const name = str(f.values["name"]);
    if (name !== undefined) return { id, kind: "domain", attributes: present({ name, provenance }) };
  }
  if (/^(aws_lb_listener|aws_alb_listener)$/.test(f.type)) {
    const scheme = SCHEME[String(f.values["protocol"] ?? "").toUpperCase()] ?? "tcp";
    const port = typeof f.values["port"] === "number" ? f.values["port"] : undefined;
    return { id, kind: "endpoint", attributes: present({ scheme, host: str(f.values["dns_name"]) ?? "(known after apply)", ...(port === undefined ? {} : { port }), provenance }) };
  }
  if (f.type === "aws_acm_certificate") {
    const subject = str(f.values["domain_name"]);
    if (subject !== undefined) return { id, kind: "certificate", attributes: present({ subject, provenance }) };
  }
  const partition = partitionOf(provider, where);
  const identifier = str(f.values["arn"]) ?? str(f.values["id"]);
  return { id, kind: "cloud-resource", attributes: present({ provider, ...(partition === undefined ? {} : { partition }), type: f.type, region: where === "" ? undefined : where, identifier, source: "iac", provenance }) };
}

/** The resources of a plan or a state, as `show -json` writes it, as assets and links. A text that is not JSON, or not that JSON, is a problem and no asset. */
export function importTerraform(tool: "opentofu" | "terraform", source: string, text: string): Imports {
  const none = (message: string): Imports => ({ tool, source, assets: [], links: [], problems: [message] });
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return none(`${source}: not JSON: run \`${tool === "opentofu" ? "tofu" : "terraform"} show -json\` on the plan or the state and read its output`);
  }
  if (!isObj(doc)) return none(`${source}: not the JSON of \`show -json\``);
  const values = isObj(doc["values"]) ? doc["values"] : isObj(doc["planned_values"]) ? doc["planned_values"] : undefined;
  if (values === undefined) return none(`${source}: no \`values\` and no \`planned_values\`: it is neither a state nor a plan as \`show -json\` writes them`);
  const found: Found[] = [];
  resourcesOf(values["root_module"], found);
  const ids = new IdPool();
  const assets = found.map((f) => assetOf(tool, source, f, ids));
  const byAddress = new Map(found.map((f, i) => [f.address, assets[i] as Imported]));
  const refs = configReferences(doc["configuration"]);
  const links: ImportedLink[] = [];
  for (const f of found) {
    const me = byAddress.get(f.address);
    if (me === undefined) continue;
    for (const ref of [...f.dependsOn, ...(refs.get(f.address) ?? [])]) {
      const target = byAddress.get(ref.includes(".") && byAddress.has(ref) ? ref : (addressOfReference(ref) ?? ""));
      if (target !== undefined) links.push(linkFor(me, target));
    }
  }
  return { tool, source, assets, links: distinctLinks(links), problems: [] };
}
