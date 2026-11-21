// Spec: 0003-estate-iac-importers FR-006
/**
 * Pulumi: the JSON of `pulumi stack export`. Every resource except the stack and the providers is a cloud resource whose provider and type come from its type token (`aws:ec2/instance:Instance` is the provider `aws`, the type `ec2/instance:Instance`), and the links are the `dependencies` and the `parent` of each. Only
 * the type and the identifier are copied: the inputs and the outputs of a resource, which hold secrets, are not.
 *
 * @example
 * ```ts
 * import { importPulumi } from "./pulumi.ts";
 * importPulumi("stack.json", JSON.stringify({ deployment: { resources: [] } })).assets; // []
 * ```
 *
 * @module
 */
import { distinctLinks, IdPool, linkFor, present, provenanceOf, slug, type Imported, type ImportedLink, type Imports } from "@intellectual-frontiers/estate-iac/governance";
import { partitionOf } from "./terraform.ts";

type Obj = { readonly [k: string]: unknown };
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);

const PROVIDERS: Readonly<Record<string, string>> = { aws: "aws", "aws-native": "aws", azure: "azure", "azure-native": "azure", cloudflare: "cloudflare", gcp: "gcp", "google-native": "gcp" };

/** The resources of an exported stack as assets and links. */
export function importPulumi(source: string, text: string): Imports {
  const none = (message: string): Imports => ({ tool: "pulumi", source, assets: [], links: [], problems: [message] });
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return none(`${source}: not JSON: \`pulumi stack export\` writes the file`);
  }
  const resources = isObj(doc) && isObj(doc["deployment"]) ? (doc["deployment"] as Obj)["resources"] : undefined;
  if (!Array.isArray(resources)) return none(`${source}: no deployment.resources: it is not an exported stack`);
  const ids = new IdPool();
  const byUrn = new Map<string, Imported>();
  const needs = new Map<string, string[]>();
  for (const r of resources) {
    if (!isObj(r)) continue;
    const urn = str(r["urn"]);
    const type = str(r["type"]);
    if (urn === undefined || type === undefined || type === "pulumi:pulumi:Stack" || type.startsWith("pulumi:providers:")) continue;
    const provider = PROVIDERS[type.split(":")[0] ?? ""] ?? "other";
    const outputs = isObj(r["outputs"]) ? r["outputs"] : {};
    const region = str(outputs["region"]) ?? str(outputs["location"]);
    const name = urn.split("::").pop() ?? urn;
    const partition = partitionOf(provider, region);
    byUrn.set(urn, { id: ids.take(slug("pulumi", name)), kind: "cloud-resource", attributes: present({ provider, ...(partition === undefined ? {} : { partition }), type: type.split(":").slice(1).join(":"), region, identifier: str(r["id"]), source: "iac", provenance: provenanceOf("pulumi", source, urn) }) });
    needs.set(urn, [...(Array.isArray(r["dependencies"]) ? r["dependencies"].filter((x): x is string => typeof x === "string") : []), ...(str(r["parent"]) === undefined ? [] : [str(r["parent"]) as string])]);
  }
  const links: ImportedLink[] = [];
  for (const [urn, list] of needs) {
    const me = byUrn.get(urn);
    for (const d of list) {
      const target = byUrn.get(d);
      if (me !== undefined && target !== undefined) links.push(linkFor(me, target));
    }
  }
  return { tool: "pulumi", source, assets: [...byUrn.values()], links: distinctLinks(links), problems: [] };
}
