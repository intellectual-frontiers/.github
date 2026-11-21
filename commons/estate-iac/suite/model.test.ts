// Spec: 0002-estate-iac-model FR-001
/**
 * Tests of what an importer gives (commons estate-iac 0002-estate-iac-model): the identities made from words, the links named by the kinds of their ends, and that what is imported is accepted by the estate. Every name is made up.
 *
 * @module
 */
import { defineAsset } from "@intellectual-frontiers/estate/governance";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { distinctLinks, IdPool, linkFor, provenanceOf, slug, type Imported } from "../src/governance/mod.ts";
import { importCompose, importTerraform } from "../src/logical/mod.ts";

proves(["0002-estate-iac-model FR-001"], "an imported asset is accepted by the estate as a discovered asset, and its provenance says the tool, the file and the address", () => {
  assertEquals(provenanceOf("terraform", "infra/plan.json", "aws_instance.web"), "terraform:infra/plan.json#aws_instance.web");
  const r = importCompose("compose.yaml", "services:\n  web:\n    image: nginx:1.27\n    ports:\n      - \"8080:80\"\n");
  assertEquals(r.assets.length, 2);
  for (const a of r.assets) {
    const made = defineAsset({ id: a.id, kind: a.kind, state: "discovered", owners: {}, attributes: a.attributes });
    assert(made.kind === "ok", JSON.stringify(made));
    assert(String(a.attributes["provenance"]).startsWith("compose:compose.yaml#"));
  }
});

proves(["0002-estate-iac-model FR-002"], "an identity is lower case words joined by hyphens, starts with the prefix, and a second one of the same words gets the first free suffix", () => {
  assertEquals(slug("tf", "aws_instance.web[0]"), "tf-aws-instance-web-0");
  assertEquals(slug("k8s", "Default", "My App!"), "k8s-default-my-app");
  assert(slug("x", "a".repeat(300)).length <= 100);
  const pool = new IdPool();
  assertEquals([pool.take("tf-a"), pool.take("tf-a"), pool.take("tf-a"), pool.take("tf-b")], ["tf-a", "tf-a-2", "tf-a-3", "tf-b"]);
  const tf = importTerraform("terraform", "s.json", JSON.stringify({ values: { root_module: { resources: [
    { address: "aws_instance.web[0]", mode: "managed", type: "aws_instance", name: "web", provider_name: "registry.terraform.io/hashicorp/aws", values: {} },
    { address: "aws_instance.web[1]", mode: "managed", type: "aws_instance", name: "web", provider_name: "registry.terraform.io/hashicorp/aws", values: {} },
  ] } } }));
  assertEquals(tf.assets.map((a) => a.id), ["tf-aws-instance-web-0", "tf-aws-instance-web-1"]);
});

proves(["0002-estate-iac-model FR-003"], "a link is named by the kinds of its ends, and repeats and self-links are dropped", () => {
  const a = (id: string, kind: string): Imported => ({ id, kind, attributes: {} });
  assertEquals(linkFor(a("l", "endpoint"), a("lb", "cloud-resource")), { from: "lb", to: "l", kind: "exposes" });
  assertEquals(linkFor(a("l", "endpoint"), a("c", "certificate")), { from: "l", to: "c", kind: "secured-by" });
  assertEquals(linkFor(a("d", "domain"), a("l", "endpoint")), { from: "d", to: "l", kind: "resolves-to" });
  assertEquals(linkFor(a("x", "cloud-resource"), a("y", "cloud-resource")), { from: "x", to: "y", kind: "depends-on" });
  assertEquals(distinctLinks([{ from: "a", to: "b", kind: "depends-on" }, { from: "a", to: "b", kind: "depends-on" }, { from: "a", to: "a", kind: "depends-on" }]).length, 1);
});
