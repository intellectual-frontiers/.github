// Spec: 0002-estate-endpoints-model FR-001
/**
 * Tests of what a reader gives (commons estate-endpoints 0002-estate-endpoints-model): the provenance, and the reading of an address. Every name is made up.
 *
 * @module
 */
import { assertEquals, proves } from "@intellectual-frontiers/test";
import { FORMATS, parts, provenance } from "../src/governance/mod.ts";

proves(["0002-estate-endpoints-model FR-001"], "the formats are named and the provenance says the format, the file and where", () => {
  assertEquals([...FORMATS], ["openapi", "graphql", "android", "ios", "dns-zone", "certificate", "listening-ports"]);
  assertEquals(provenance("openapi", "api.yaml", "servers[0]"), "openapi:api.yaml#servers[0]");
});

proves(["0002-estate-endpoints-model FR-002"], "an absolute address of a scheme the estate has is read as a scheme, a host, a port and a path, and nothing else is", () => {
  assertEquals(parts("https://api.example.test:8443/v1/"), { scheme: "https", host: "api.example.test", port: 8443, path: "/v1" });
  assertEquals(parts("https://api.example.test"), { scheme: "https", host: "api.example.test" });
  assertEquals(parts("wss://x.example.test/socket"), { scheme: "wss", host: "x.example.test", path: "/socket" });
  for (const bad of ["/v1", "api.example.test", "ftp://x.example.test", "https://", "mailto:a@b"]) assertEquals(parts(bad), undefined, bad);
});
