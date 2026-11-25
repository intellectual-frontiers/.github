// Spec: 0007-estate-kinds FR-001
/**
 * Tests of the kinds with typed attributes, the named links and the common services (0007-estate-kinds): an asset is refused where its attributes are not right for its kind, a link of a named kind joins only the kinds it may, the services are a catalog, and an asset
 * document written before the attributes existed still decodes. Every name is made up.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { checkAttributes, checkLink, defineAsset, defineEstate, kindSpec, KINDS, LINK_KINDS, SERVICE_CLASSES, SERVICES, serviceByName, servicesOnPort } from "../src/governance/mod.ts";
import { assetCodec } from "../src/physical/mod.ts";
import { bytes } from "./support.ts";

const OWNED = { observe: "archon", verify: "archon" } as const;
const endpoint = (attributes: Record<string, string | number | boolean | readonly string[]>) => defineAsset({ id: "api-public", kind: "endpoint", state: "discovered", owners: {}, attributes });

proves(["0007-estate-kinds FR-001"], "the catalog names the kinds with attributes, each attribute has a type, and the lists of values are not empty", () => {
  assertEquals(KINDS.map((k) => k.kind), ["cloud-resource", "endpoint", "application", "workstation", "mobile-app", "service", "domain", "certificate"]);
  for (const k of KINDS) {
    assert(k.summary !== "" && k.attributes.length > 0, k.kind);
    for (const a of k.attributes) {
      assert(["string", "number", "boolean", "strings"].includes(a.type) && a.summary !== "", `${k.kind}.${a.name}`);
      if (a.values !== undefined) assert(a.values.length > 0 && a.type === "string", `${k.kind}.${a.name}`);
    }
    assertEquals(new Set(k.attributes.map((a) => a.name)).size, k.attributes.length, `${k.kind} names an attribute twice`);
  }
  assertEquals(kindSpec("server"), undefined);
});

proves(["0007-estate-kinds FR-002"], "an asset is refused where its attributes are not right for its kind, and a kind with no spec accepts any word and needs none", () => {
  assertEquals(endpoint({ scheme: "https", host: "api.example.test", port: 443, service: "https", exposure: "internet" }).kind, "ok");
  const missing = endpoint({ scheme: "https" });
  assert(missing.kind === "err" && missing.error.some((m) => m.includes("needs the attribute host")), JSON.stringify(missing));
  const wrong = endpoint({ scheme: "https", host: "x.example.test", port: "443" });
  assert(wrong.kind === "err" && wrong.error.some((m) => m.includes("port is a number")));
  const value = endpoint({ scheme: "gopher", host: "x.example.test" });
  assert(value.kind === "err" && value.error.some((m) => m.includes("scheme") && m.includes("none of")));
  const unknown = endpoint({ scheme: "tcp", host: "x.example.test", colour: "blue" });
  assert(unknown.kind === "err" && unknown.error.some((m) => m.includes("no attribute colour")));
  assert(checkAttributes("endpoint", { scheme: "tcp", host: "h", service: "nosuch" }).some((m) => m.includes("services catalog")));
  const handles = defineAsset({ id: "portal", kind: "application", state: "discovered", owners: {}, attributes: { tier: "web", handles: ["cui", "fci"] } });
  assertEquals(handles.kind, "ok");
  const badList = defineAsset({ id: "portal", kind: "application", state: "discovered", owners: {}, attributes: { handles: "cui" } });
  assert(badList.kind === "err" && badList.error.some((m) => m.includes("list of strings")));
  const cloud = defineAsset({ id: "bucket-a", kind: "cloud-resource", state: "discovered", owners: {}, attributes: { provider: "aws", partition: "aws-us-gov", type: "aws_s3_bucket", region: "us-gov-west-1", source: "iac" } });
  assertEquals(cloud.kind, "ok");
  const mobile = defineAsset({ id: "field-app", kind: "mobile-app", state: "discovered", owners: {}, attributes: { platform: "android", "bundle-id": "test.example.field" } });
  assertEquals(mobile.kind, "ok");
  assertEquals(defineAsset({ id: "synthetic-server-01", kind: "server", state: "adopted", owners: OWNED }).kind, "ok");
  assertEquals(defineAsset({ id: "thing", kind: "gizmo", state: "discovered", owners: {}, attributes: { anything: "goes" } }).kind, "ok");
});

proves(["0007-estate-kinds FR-003"], "a link of a named kind joins only the kinds it may, an unnamed kind is unchecked, and the checks run in defineEstate", () => {
  assertEquals(LINK_KINDS.map((l) => l.kind), ["runs-on", "exposes", "depends-on", "resolves-to", "secured-by", "client-of"]);
  assertEquals(checkLink("runs-on", "application", "server"), []);
  assert(checkLink("runs-on", "server", "application").length === 2);
  assertEquals(checkLink("boots", "anything", "else"), []);
  const assets = {
    "synthetic-server-01": { kind: "server", state: "adopted", owners: OWNED },
    portal: { kind: "application", state: "discovered", owners: {}, attributes: { tier: "web" } },
    "portal-https": { kind: "endpoint", state: "discovered", owners: {}, attributes: { scheme: "https", host: "portal.example.test", service: "https" } },
  } as const;
  const good = defineEstate(assets, [{ from: "portal", to: "synthetic-server-01", kind: "runs-on" }, { from: "synthetic-server-01", to: "portal-https", kind: "exposes" }, { from: "portal", to: "synthetic-server-01", kind: "boots" }]);
  assertEquals(good.kind, "ok");
  const bad = defineEstate(assets, [{ from: "synthetic-server-01", to: "portal", kind: "runs-on" }]);
  assert(bad.kind === "err" && bad.error.some((m) => m.includes("synthetic-server-01 to portal") && m.includes("runs-on")), JSON.stringify(bad));
});

proves(["0007-estate-kinds FR-004"], "the services are a catalog by name with a usual port, a class and whether they speak in the clear", () => {
  assert(SERVICES.length >= 30);
  assertEquals(new Set(SERVICES.map((s) => s.name)).size, SERVICES.length);
  for (const s of SERVICES) assert(s.port > 0 && s.port < 65536 && SERVICE_CLASSES.includes(s.class) && s.summary !== "", s.name);
  assertEquals(serviceByName("postgres")?.port, 5432);
  assertEquals(serviceByName("telnet")?.cleartext, true);
  assertEquals(serviceByName("https")?.cleartext, false);
  assertEquals(servicesOnPort(22, "tcp").map((s) => s.name), ["ssh", "sftp"]);
  assertEquals(serviceByName("nosuch"), undefined);
});

proves(["0007-estate-kinds FR-005"], "a document written before the attributes existed decodes with none, an asset with attributes is written and read back with them, and a stored attribute that is not right for its kind is refused", () => {
  const old = assetCodec.decode(bytes(JSON.stringify({ id: "synthetic-server-01", kind: "server", state: "adopted", origin: "paired", owners: { observe: "archon", verify: "archon" }, $version: 1 })));
  assert(old.kind === "ok" && old.value.value.attributes === undefined, JSON.stringify(old));
  const made = endpoint({ scheme: "https", host: "api.example.test", port: 443 });
  assert(made.kind === "ok");
  const written = assetCodec.encode(made.value);
  assert(written.kind === "ok");
  const back = assetCodec.decode(written.value);
  assert(back.kind === "ok" && JSON.stringify(back.value.value.attributes) === JSON.stringify({ host: "api.example.test", port: 443, scheme: "https" }), "the attributes come back, in the canonical order of the stored JSON");
  const wrong = assetCodec.decode(bytes(JSON.stringify({ id: "api-public", kind: "endpoint", state: "discovered", owners: {}, attributes: { scheme: "https" }, $version: 1 })));
  assert(wrong.kind === "err", "an endpoint with no host is not read as an asset");
});
