// Spec: 0003-estate-iac-importers FR-001
/**
 * Tests of the importers (commons estate-iac 0003-estate-iac-importers): a state and a plan of OpenTofu or Terraform with a GovCloud instance, a secret that must not be copied, a name, a listener and a certificate; a CloudFormation template; Kubernetes manifests; a Compose file; a Pulumi export; the choice of
 * importer by content; and the reading of files and folders. What is imported is held to the estate: every asset is accepted. Every name and every value is made up.
 *
 * @module
 */
import { defineAsset } from "@intellectual-frontiers/estate/governance";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import type { Imports } from "../src/governance/mod.ts";
import { detectTool, importCloudFormation, importCompose, importKubernetes, importPulumi, importText, importTerraform } from "../src/logical/mod.ts";
import { importPaths } from "../src/physical/mod.ts";

const PROVIDER = (n: string): string => `registry.terraform.io/hashicorp/${n}`;
const SECRET = "hunter2-made-up-password";

const STATE = JSON.stringify({
  format_version: "1.0",
  terraform_version: "1.9.0",
  values: {
    root_module: {
      resources: [
        { address: "aws_instance.web", mode: "managed", type: "aws_instance", name: "web", provider_name: PROVIDER("aws"), values: { id: "i-0abc", arn: "arn:aws-us-gov:ec2:us-gov-west-1:111122223333:instance/i-0abc", availability_zone: "us-gov-west-1a", user_data: SECRET }, depends_on: ["aws_security_group.web"] },
        { address: "aws_security_group.web", mode: "managed", type: "aws_security_group", name: "web", provider_name: PROVIDER("aws"), values: { id: "sg-1", region: "us-gov-west-1" } },
        { address: "aws_lb.front", mode: "managed", type: "aws_lb", name: "front", provider_name: PROVIDER("aws"), values: { id: "lb-1", region: "us-east-1", dns_name: "front.example.test" } },
        { address: "aws_lb_listener.https", mode: "managed", type: "aws_lb_listener", name: "https", provider_name: PROVIDER("aws"), values: { port: 443, protocol: "HTTPS" }, depends_on: ["aws_lb.front", "aws_acm_certificate.site"] },
        { address: "aws_acm_certificate.site", mode: "managed", type: "aws_acm_certificate", name: "site", provider_name: PROVIDER("aws"), values: { domain_name: "site.example.test" } },
        { address: "aws_route53_record.site", mode: "managed", type: "aws_route53_record", name: "site", provider_name: PROVIDER("aws"), values: { name: "site.example.test" }, depends_on: ["aws_lb_listener.https"] },
        { address: "data.aws_ami.base", mode: "data", type: "aws_ami", name: "base", provider_name: PROVIDER("aws"), values: { id: "ami-1" } },
        { address: "azurerm_storage_account.logs", mode: "managed", type: "azurerm_storage_account", name: "logs", provider_name: PROVIDER("azurerm"), values: { id: "/subscriptions/s/logs", location: "usgovvirginia", primary_access_key: SECRET } },
      ],
      child_modules: [{ address: "module.net", resources: [{ address: "module.net.aws_vpc.main", mode: "managed", type: "aws_vpc", name: "main", provider_name: PROVIDER("aws"), values: { id: "vpc-1", region: "us-gov-east-1" } }] }],
    },
  },
});

const PLAN = JSON.stringify({
  planned_values: { root_module: { resources: [
    { address: "aws_subnet.a", mode: "managed", type: "aws_subnet", name: "a", provider_name: PROVIDER("aws"), values: { availability_zone: "us-east-1a" } },
    { address: "aws_instance.app", mode: "managed", type: "aws_instance", name: "app", provider_name: PROVIDER("aws"), values: {} },
  ] } },
  configuration: { root_module: { resources: [
    { address: "aws_subnet.a", mode: "managed", expressions: { vpc_id: { references: ["var.vpc"] } } },
    { address: "aws_instance.app", mode: "managed", expressions: { subnet_id: { references: ["aws_subnet.a.id", "aws_subnet.a"] }, ami: { references: ["data.aws_ami.base.id", "local.x"] } } },
  ] } },
});

/** Every asset an importer gave is accepted by the estate as a discovered asset. */
function accepted(r: Imports): void {
  for (const a of r.assets) {
    const made = defineAsset({ id: a.id, kind: a.kind, state: "discovered", owners: {}, attributes: a.attributes });
    assert(made.kind === "ok", `${a.id}: ${JSON.stringify(made)}`);
    assert(String(a.attributes["provenance"]).startsWith(`${r.tool}:`), a.id);
  }
  const ids = new Set(r.assets.map((a) => a.id));
  assertEquals(ids.size, r.assets.length, "identities are distinct");
  for (const l of r.links) assert(ids.has(l.from) && ids.has(l.to), `${l.from} to ${l.to}`);
}
const by = (r: Imports, id: string) => r.assets.find((a) => a.id === id);

proves(["0003-estate-iac-importers FR-001", "0003-estate-iac-importers FR-002"], "a state is read into assets with the provider, the partition, the type, the region and the identifier; a data source is none; a secret is nowhere in the result; and the references become links", () => {
  const r = importTerraform("opentofu", "infra/state.json", STATE);
  assertEquals(r.problems, []);
  accepted(r);
  assertEquals(r.assets.map((a) => a.id), ["tf-aws-instance-web", "tf-aws-security-group-web", "tf-aws-lb-front", "tf-aws-lb-listener-https", "tf-aws-acm-certificate-site", "tf-aws-route53-record-site", "tf-azurerm-storage-account-logs", "tf-module-net-aws-vpc-main"]);
  assertEquals(by(r, "tf-aws-instance-web")?.attributes, { provider: "aws", partition: "aws-us-gov", type: "aws_instance", region: "us-gov-west-1", identifier: "arn:aws-us-gov:ec2:us-gov-west-1:111122223333:instance/i-0abc", source: "iac", provenance: "opentofu:infra/state.json#aws_instance.web" });
  assertEquals(by(r, "tf-aws-lb-front")?.attributes["partition"], "aws");
  assertEquals(by(r, "tf-azurerm-storage-account-logs")?.attributes["partition"], "azure-government");
  assertEquals(by(r, "tf-module-net-aws-vpc-main")?.attributes["partition"], "aws-us-gov");
  assertEquals(by(r, "tf-aws-lb-listener-https")?.kind, "endpoint");
  assertEquals(by(r, "tf-aws-lb-listener-https")?.attributes["scheme"], "https");
  assertEquals(by(r, "tf-aws-lb-listener-https")?.attributes["port"], 443);
  assertEquals(by(r, "tf-aws-acm-certificate-site")?.kind, "certificate");
  assertEquals(by(r, "tf-aws-route53-record-site")?.kind, "domain");
  assert(!JSON.stringify(r).includes(SECRET), "the values of a resource are never copied");
  assert(!r.assets.some((a) => a.id.includes("ami")), "a data source is not an asset");
  assertEquals(r.links.map((l) => `${l.from} ${l.kind} ${l.to}`), [
    "tf-aws-instance-web depends-on tf-aws-security-group-web",
    "tf-aws-lb-front exposes tf-aws-lb-listener-https",
    "tf-aws-lb-listener-https secured-by tf-aws-acm-certificate-site",
    "tf-aws-route53-record-site resolves-to tf-aws-lb-listener-https",
  ]);
  const plan = importTerraform("terraform", "plan.json", PLAN);
  accepted(plan);
  assertEquals(plan.links.map((l) => `${l.from} ${l.kind} ${l.to}`), ["tf-aws-instance-app depends-on tf-aws-subnet-a"], "a variable, a local and a data source are no link, and the same reference twice is one");
  assertEquals(by(plan, "tf-aws-subnet-a")?.attributes["identifier"], undefined, "a plan has no identifier");
  assertEquals(by(plan, "tf-aws-subnet-a")?.attributes["region"], "us-east-1");
  for (const bad of ["not json", "[]", "{}"]) assertEquals(importTerraform("terraform", "x.json", bad).assets.length + importTerraform("terraform", "x.json", bad).problems.length, 1, bad);
});

const CFN = JSON.stringify({
  AWSTemplateFormatVersion: "2010-09-09",
  Resources: {
    Vpc: { Type: "AWS::EC2::VPC", Properties: { CidrBlock: "10.0.0.0/16" } },
    Subnet: { Type: "AWS::EC2::Subnet", Properties: { VpcId: { Ref: "Vpc" } } },
    Web: { Type: "AWS::EC2::Instance", DependsOn: ["Subnet"], Properties: { SubnetId: { Ref: "Subnet" }, UserData: SECRET, SecurityGroupIds: [{ "Fn::GetAtt": ["Sg", "GroupId"] }] } },
    Sg: { Type: "AWS::EC2::SecurityGroup", Properties: { VpcId: { Ref: "Vpc" } } },
    Broken: { Properties: {} },
  },
});

proves(["0003-estate-iac-importers FR-003"], "a CloudFormation template, as JSON or as YAML, becomes cloud resources of the provider aws with Ref, GetAtt and DependsOn as links, no property is copied, and a template with tags says how to get the JSON", () => {
  const r = importCloudFormation("stack.json", CFN);
  accepted(r);
  assertEquals(r.assets.map((a) => `${a.id} ${a.attributes["type"]}`), ["cfn-vpc AWS::EC2::VPC", "cfn-subnet AWS::EC2::Subnet", "cfn-web AWS::EC2::Instance", "cfn-sg AWS::EC2::SecurityGroup"]);
  assertEquals(r.problems.length, 1);
  assert(r.problems[0]?.includes("Broken"));
  assertEquals(r.links.map((l) => `${l.from}>${l.to}`).sort(), ["cfn-sg>cfn-vpc", "cfn-subnet>cfn-vpc", "cfn-web>cfn-sg", "cfn-web>cfn-subnet"]);
  assert(!JSON.stringify(r).includes(SECRET));
  const yaml = importCloudFormation("stack.yaml", "AWSTemplateFormatVersion: '2010-09-09'\nResources:\n  Bucket:\n    Type: AWS::S3::Bucket\n  Policy:\n    Type: AWS::S3::BucketPolicy\n    Properties:\n      Bucket:\n        Ref: Bucket\n");
  assertEquals(yaml.assets.map((a) => a.id), ["cfn-bucket", "cfn-policy"]);
  assertEquals(yaml.links, [{ from: "cfn-policy", to: "cfn-bucket", kind: "depends-on" }]);
  const tagged = importCloudFormation("stack.yaml", "Resources:\n  B:\n    Type: AWS::S3::Bucket\n    Properties:\n      Name: !Ref X\n");
  assertEquals(tagged.assets.length, 0);
  assert(tagged.problems[0]?.includes("cfn-flip --json"), tagged.problems.join());
  assertEquals(importCloudFormation("x.json", "{}").problems.length, 1);
});

const K8S = `# manifests of the portal
apiVersion: apps/v1
kind: Deployment
metadata:
  name: portal
  namespace: prod
spec:
  selector:
    matchLabels:
      app: portal
  template:
    metadata:
      labels:
        app: portal
    spec:
      containers:
        - name: web
          image: registry.example.test/portal:1.4
---
apiVersion: v1
kind: Service
metadata:
  name: portal
  namespace: prod
spec:
  type: LoadBalancer
  selector:
    app: portal
  ports:
    - port: 443
    - port: 5353
      protocol: UDP
---
apiVersion: v1
kind: Service
metadata:
  name: internal
  namespace: prod
spec:
  selector:
    app: other
  ports:
    - port: 5432
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: portal
  namespace: prod
spec:
  tls:
    - hosts: [portal.example.test]
  rules:
    - host: portal.example.test
      http:
        paths:
          - path: /
            backend:
              service:
                name: portal
                port:
                  number: 443
    - host: plain.example.test
---
apiVersion: v1
kind: Secret
metadata:
  name: creds
  namespace: prod
data:
  password: bWFkZS11cA==
`;

proves(["0003-estate-iac-importers FR-004"], "Kubernetes manifests become applications with their images, endpoints by service type and by ingress host, links by selector and by route, and a secret is neither an asset nor copied", () => {
  const r = importKubernetes("deploy/portal.yaml", K8S);
  assertEquals(r.problems, []);
  accepted(r);
  assertEquals(r.assets.map((a) => `${a.id} ${a.kind}`), ["k8s-prod-portal application", "k8s-prod-portal-443 endpoint", "k8s-prod-portal-5353 endpoint", "k8s-prod-internal-5432 endpoint", "k8s-prod-portal-portal-example-test endpoint", "k8s-prod-portal-plain-example-test endpoint"]);
  assertEquals(by(r, "k8s-prod-portal")?.attributes, { tier: "api", image: "registry.example.test/portal:1.4", provenance: "kubernetes:deploy/portal.yaml#apps/v1/Deployment/prod/portal" });
  assertEquals(by(r, "k8s-prod-portal-443")?.attributes["exposure"], "internet");
  assertEquals(by(r, "k8s-prod-portal-5353")?.attributes["scheme"], "udp");
  assertEquals(by(r, "k8s-prod-internal-5432")?.attributes["exposure"], "internal");
  assertEquals(by(r, "k8s-prod-portal-portal-example-test")?.attributes["scheme"], "https");
  assertEquals(by(r, "k8s-prod-portal-plain-example-test")?.attributes["scheme"], "http");
  assertEquals(r.links.map((l) => `${l.from} ${l.kind} ${l.to}`), [
    "k8s-prod-portal exposes k8s-prod-portal-443",
    "k8s-prod-portal exposes k8s-prod-portal-5353",
    "k8s-prod-portal-portal-example-test depends-on k8s-prod-portal-443",
    "k8s-prod-portal-portal-example-test depends-on k8s-prod-portal-5353",
  ]);
  assert(!JSON.stringify(r).includes("bWFkZS11cA") && !r.assets.some((a) => a.id.includes("creds")));
  assertEquals(importKubernetes("bad.yaml", "kind: [unclosed\n").problems.length, 1);
});

const COMPOSE = `services:
  web:
    image: nginx:1.27
    ports:
      - "8080:80"
      - "127.0.0.1:9000:9000"
      - "5353:53/udp"
      - "3000"
    depends_on:
      - db
    environment:
      TOKEN: ${SECRET}
  db:
    image: postgres:17
    ports:
      - target: 5432
        published: 5432
        protocol: tcp
        host_ip: 127.0.0.1
`;

proves(["0003-estate-iac-importers FR-005"], "a Compose file becomes applications with their images, an endpoint for each published port (the loopback is internal), a dependency for each depends_on, and no environment value", () => {
  const r = importCompose("compose.yaml", COMPOSE);
  assertEquals(r.problems, []);
  accepted(r);
  assertEquals(r.assets.map((a) => a.id), ["compose-web", "compose-web-8080", "compose-web-9000", "compose-web-5353", "compose-db", "compose-db-5432"]);
  assertEquals(by(r, "compose-web-8080")?.attributes["exposure"], "internet");
  assertEquals(by(r, "compose-web-9000")?.attributes["exposure"], "internal");
  assertEquals(by(r, "compose-web-5353")?.attributes["scheme"], "udp");
  assertEquals(by(r, "compose-db-5432")?.attributes["exposure"], "internal");
  assert(r.links.some((l) => l.from === "compose-web" && l.to === "compose-db" && l.kind === "depends-on"));
  assert(!JSON.stringify(r).includes(SECRET));
  assertEquals(importCompose("x.yaml", "name: nothing\n").problems.length, 1);
});

const PULUMI = JSON.stringify({
  version: 3,
  deployment: { resources: [
    { urn: "urn:pulumi:prod::app::pulumi:pulumi:Stack::app-prod", type: "pulumi:pulumi:Stack" },
    { urn: "urn:pulumi:prod::app::pulumi:providers:aws::default", type: "pulumi:providers:aws", id: "p" },
    { urn: "urn:pulumi:prod::app::aws:ec2/vpc:Vpc::main", type: "aws:ec2/vpc:Vpc", id: "vpc-1", outputs: { region: "us-gov-west-1", secret: SECRET } },
    { urn: "urn:pulumi:prod::app::aws:ec2/instance:Instance::web", type: "aws:ec2/instance:Instance", id: "i-1", dependencies: ["urn:pulumi:prod::app::aws:ec2/vpc:Vpc::main"], outputs: { region: "us-gov-west-1" } },
    { urn: "urn:pulumi:prod::app::cloudflare:index/record:Record::www", type: "cloudflare:index/record:Record", id: "r-1" },
  ] },
});

proves(["0003-estate-iac-importers FR-006"], "a Pulumi export becomes cloud resources by their type tokens, without the stack and the providers, with dependencies as links and no input or output copied", () => {
  const r = importPulumi("stack.json", PULUMI);
  assertEquals(r.problems, []);
  accepted(r);
  assertEquals(r.assets.map((a) => a.id), ["pulumi-main", "pulumi-web", "pulumi-www"]);
  assertEquals(by(r, "pulumi-web")?.attributes, { provider: "aws", partition: "aws-us-gov", type: "ec2/instance:Instance", region: "us-gov-west-1", identifier: "i-1", source: "iac", provenance: "pulumi:stack.json#urn:pulumi:prod::app::aws:ec2/instance:Instance::web" });
  assertEquals(by(r, "pulumi-www")?.attributes["provider"], "cloudflare");
  assertEquals(r.links, [{ from: "pulumi-web", to: "pulumi-main", kind: "depends-on" }]);
  assert(!JSON.stringify(r).includes(SECRET));
  assertEquals(importPulumi("x.json", "{}").problems.length, 1);
});

proves(["0003-estate-iac-importers FR-007"], "the importer of a file is chosen by what is in it, the caller says which of OpenTofu and Terraform, and a file none reads is a problem", () => {
  assertEquals(detectTool("a", STATE), "terraform");
  assertEquals(detectTool("a", PLAN, "opentofu"), "opentofu");
  assertEquals(detectTool("a", CFN), "cloudformation");
  assertEquals(detectTool("a", PULUMI), "pulumi");
  assertEquals(detectTool("a", COMPOSE), "compose");
  assertEquals(detectTool("a", K8S), "kubernetes");
  assertEquals(detectTool("a", "AWSTemplateFormatVersion: x\nResources: {}\n"), "cloudformation");
  assertEquals(detectTool("a", '{"hello":1}'), undefined);
  assertEquals(detectTool("a", "just: text\n"), undefined);
  assertEquals(importText("a.json", "{}").problems.length, 1);
  assertEquals(importText("s.json", STATE, "opentofu").tool, "opentofu");
});

proves(["0003-estate-iac-importers FR-008"], "a folder is walked and what no importer reads is skipped without a word, a file given by name that none reads is a problem, tool folders are not entered, and the first of two identical identities is kept", async () => {
  await fs.withTempDir(async (dir) => {
    await fs.mkdir(path.join(dir, "infra"), { recursive: true });
    await fs.mkdir(path.join(dir, "node_modules", "x"), { recursive: true });
    await fs.mkdir(path.join(dir, ".terraform"), { recursive: true });
    await fs.writeTextFile(path.join(dir, "infra", "state.json"), STATE);
    await fs.writeTextFile(path.join(dir, "infra", "package.json"), '{"name":"x"}');
    await fs.writeTextFile(path.join(dir, "infra", "notes.yaml"), "just: notes\n");
    await fs.writeTextFile(path.join(dir, "compose.yaml"), COMPOSE);
    await fs.writeTextFile(path.join(dir, "node_modules", "x", "compose.yaml"), COMPOSE);
    await fs.writeTextFile(path.join(dir, ".terraform", "state.json"), STATE);
    await fs.writeTextFile(path.join(dir, "also.yaml"), COMPOSE);
    const r = await importPaths([dir]);
    assertEquals(r.files.map((f) => `${f.tool} ${path.relative(dir, f.source)} ${f.assets}`), ["compose also.yaml 6", "compose compose.yaml 0", "terraform infra/state.json 8"]);
    assertEquals(r.problems.length, 1);
    assert(r.problems[0]?.includes("compose.yaml: 6 identities are also in") && r.problems[0]?.includes("also.yaml; the first is kept"), r.problems.join());
    const named = await importPaths([path.join(dir, "infra", "notes.yaml"), path.join(dir, "nothing.json")]);
    assertEquals(named.assets.length, 0);
    assertEquals(named.problems.length, 2);
  });
});
