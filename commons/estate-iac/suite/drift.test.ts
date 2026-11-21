// Spec: 0004-estate-iac-drift FR-001
/**
 * Tests of the comparison of the code with a cloud (commons estate-iac 0004-estate-iac-drift). Every name is made up.
 *
 * @module
 */
import { assertEquals, proves } from "@intellectual-frontiers/test";
import type { Imported } from "../src/governance/mod.ts";
import { driftBetween } from "../src/logical/mod.ts";

const res = (id: string, type: string, identifier: string | undefined, region = "us-gov-west-1"): Imported => ({ id, kind: "cloud-resource", attributes: { provider: "aws", type, ...(identifier === undefined ? {} : { identifier }), region } });

proves(["0004-estate-iac-drift FR-001"], "each difference is said in its own word, matched by provider and identifier", () => {
  const code = [res("tf-web", "aws_instance", "i-1"), res("tf-gone", "aws_instance", "i-2"), res("tf-moved", "aws_instance", "i-3"), res("tf-plan", "aws_instance", undefined)];
  const cloud = [{ provider: "aws", type: "aws_instance", identifier: "i-1", region: "us-gov-west-1" }, { provider: "aws", type: "aws_instance", identifier: "i-3", region: "us-gov-east-1" }, { provider: "aws", type: "aws_instance", identifier: "i-9" }];
  assertEquals(driftBetween(code, cloud).map((d) => `${d.kind} ${d.asset ?? d.identifier}`), ["not-in-cloud tf-gone", "region-differs tf-moved", "no-identifier tf-plan", "not-in-code i-9"]);
  assertEquals(driftBetween(code, [{ provider: "azure", type: "x", identifier: "i-1" }]).filter((d) => d.kind === "region-differs").length, 0, "another provider's identifier is another resource");
});

proves(["0004-estate-iac-drift FR-002"], "a type the code does not cover is not reported as missing from it unless the whole cloud is asked for, and nothing with nothing is no difference", () => {
  const code = [res("tf-web", "aws_instance", "i-1")];
  const cloud = [{ provider: "aws", type: "aws_instance", identifier: "i-1" }, { provider: "aws", type: "aws_s3_bucket", identifier: "b-1" }];
  assertEquals(driftBetween(code, cloud), []);
  assertEquals(driftBetween(code, cloud, { all: true }).map((d) => d.identifier), ["b-1"]);
  assertEquals(driftBetween([], []), []);
});
