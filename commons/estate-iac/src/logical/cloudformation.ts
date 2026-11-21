// Spec: 0003-estate-iac-importers FR-003
/**
 * CloudFormation: a template, as JSON or as YAML without the short-form tags (`!Ref` and the others are tags, which the YAML reader refuses; `aws cloudformation get-template` and `cfn-flip --json` give the JSON). Every resource becomes an asset (a cloud resource of the provider `aws`; the partition is told from the region where the
 * template says one in a parameter's default), and the links are `DependsOn`, `Ref` and `Fn::GetAtt`. Only the type and the logical name are copied: the properties are not.
 *
 * @example
 * ```ts
 * import { importCloudFormation } from "./cloudformation.ts";
 * importCloudFormation("t.json", JSON.stringify({ Resources: { Web: { Type: "AWS::EC2::Instance" } } })).assets.length; // 1
 * ```
 *
 * @module
 */
import { parseYaml, formatYamlError } from "@intellectual-frontiers/formats/yaml";
import { distinctLinks, IdPool, linkFor, present, provenanceOf, slug, type Imported, type ImportedLink, type Imports } from "@intellectual-frontiers/estate-iac/governance";

type Obj = { readonly [k: string]: unknown };
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** The logical names a value refers to by `Ref` or `Fn::GetAtt`. */
function referencesIn(v: unknown, out: string[]): void {
  if (Array.isArray(v)) return void v.forEach((x) => referencesIn(x, out));
  if (!isObj(v)) return;
  if (typeof v["Ref"] === "string") out.push(v["Ref"]);
  const get = v["Fn::GetAtt"];
  if (Array.isArray(get) && typeof get[0] === "string") out.push(get[0]);
  else if (typeof get === "string") out.push(get.split(".")[0] ?? "");
  for (const x of Object.values(v)) referencesIn(x, out);
}

/** The resources of a template as assets and links. */
export function importCloudFormation(source: string, text: string): Imports {
  const none = (message: string): Imports => ({ tool: "cloudformation", source, assets: [], links: [], problems: [message] });
  let doc: unknown;
  const trimmed = text.trimStart();
  if (trimmed.startsWith("{")) {
    try {
      doc = JSON.parse(text);
    } catch (e) {
      return none(`${source}: not JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    const y = parseYaml(text);
    if (y.kind === "err") return none(`${source}: ${formatYamlError(y.error)} (a template with short-form tags such as !Ref is read as JSON: \`cfn-flip --json\`)`);
    doc = y.value;
  }
  if (!isObj(doc) || !isObj(doc["Resources"])) return none(`${source}: no Resources: it is not a CloudFormation template`);
  const ids = new IdPool();
  const byLogical = new Map<string, Imported>();
  const refs = new Map<string, string[]>();
  const problems: string[] = [];
  for (const [logical, r] of Object.entries(doc["Resources"])) {
    if (!isObj(r) || typeof r["Type"] !== "string") {
      problems.push(`${source}: the resource ${logical} has no Type`);
      continue;
    }
    byLogical.set(logical, { id: ids.take(slug("cfn", logical)), kind: "cloud-resource", attributes: present({ provider: "aws", type: r["Type"], source: "iac", provenance: provenanceOf("cloudformation", source, logical) }) });
    const found: string[] = [];
    referencesIn(r["Properties"], found);
    const dep = r["DependsOn"];
    if (typeof dep === "string") found.push(dep);
    else if (Array.isArray(dep)) for (const d of dep) if (typeof d === "string") found.push(d);
    refs.set(logical, found);
  }
  const links: ImportedLink[] = [];
  for (const [logical, found] of refs) {
    const me = byLogical.get(logical);
    for (const name of found) {
      const target = byLogical.get(name);
      if (me !== undefined && target !== undefined) links.push(linkFor(me, target));
    }
  }
  return { tool: "cloudformation", source, assets: [...byLogical.values()], links: distinctLinks(links), problems };
}
