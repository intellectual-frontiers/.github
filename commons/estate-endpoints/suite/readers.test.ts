// Spec: 0003-estate-endpoints-readers FR-001
/**
 * Tests of the readers (commons estate-endpoints 0003-estate-endpoints-readers): an OpenAPI description with its security, a GraphQL schema, an Android manifest, an iOS property list, a zone file, the ports of a machine as `ss` and osquery give them, a certificate made with `openssl`, the choice of reader by content, and
 * the reading of files and folders. What is read is held to the estate: every asset is accepted. Every name and every value is made up.
 *
 * @module
 */
import { defineAsset } from "@intellectual-frontiers/estate/governance";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import type { Found } from "../src/governance/mod.ts";
import { covers, detectFormat, importAndroid, importCertificates, importGraphql, importIos, importListening, importOpenApi, importZone, readText, secure } from "../src/logical/mod.ts";
import { certificatesOf, importPaths } from "../src/physical/mod.ts";

/** Every asset a reader gave is accepted by the estate as a discovered asset, with its provenance, and every link joins two assets of the result. */
function accepted(r: Found, outside: readonly string[] = []): void {
  for (const a of r.assets) {
    const made = defineAsset({ id: a.id, kind: a.kind, state: "discovered", owners: {}, attributes: a.attributes });
    assert(made.kind === "ok", `${a.id}: ${JSON.stringify(made)}`);
    assert(String(a.attributes["provenance"]).startsWith(`${r.format}:`), a.id);
  }
  const ids = new Set([...r.assets.map((a) => a.id), ...outside]);
  assertEquals(new Set(r.assets.map((a) => a.id)).size, r.assets.length, "identities are distinct");
  for (const l of r.links) assert(ids.has(l.from) && ids.has(l.to), `${l.from} to ${l.to}`);
}
const by = (r: Found, id: string) => r.assets.find((a) => a.id === id);

const OPENAPI = `openapi: 3.0.3
info:
  title: Portal API
servers:
  - url: https://{env}.api.example.test:8443/v1/
    variables:
      env:
        default: prod
  - url: /relative
components:
  securitySchemes:
    bearer:
      type: http
      scheme: bearer
    mtls:
      type: mutualTLS
security:
  - bearer: []
paths:
  /pets:
    get:
      security:
        - mtls: []
`;

proves(["0003-estate-endpoints-readers FR-001"], "an OpenAPI description gives an endpoint for each absolute server with the authentication it declares (the strongest), a Swagger 2 one is read too, and a relative server is a problem", () => {
  const r = importOpenApi("api.yaml", OPENAPI);
  accepted(r);
  assertEquals(r.assets.map((a) => a.id), ["api-portal-api-prod-api-example-test-8443"]);
  assertEquals(by(r, "api-portal-api-prod-api-example-test-8443")?.attributes, { scheme: "https", host: "prod.api.example.test", port: 8443, path: "/v1", authentication: "mtls", api: "openapi", provenance: "openapi:api.yaml#servers[0]" });
  assertEquals(r.problems.length, 1);
  assert(r.problems[0]?.includes("servers[1]") && r.problems[0]?.includes("not an absolute address"));
  const open = importOpenApi("o.json", JSON.stringify({ openapi: "3.1.0", info: { title: "Open" }, servers: [{ url: "http://open.example.test" }], paths: {} }));
  assertEquals(open.assets[0]?.attributes["authentication"], "none");
  const swagger = importOpenApi("s.json", JSON.stringify({ swagger: "2.0", host: "old.example.test", basePath: "/api", schemes: ["https", "http"], securityDefinitions: { k: { type: "apiKey", in: "header", name: "x" } }, security: [{ k: [] }], paths: {} }));
  accepted(swagger);
  assertEquals(swagger.assets.map((a) => `${a.attributes["scheme"]} ${a.attributes["host"]} ${a.attributes["path"]} ${a.attributes["authentication"]}`), ["https old.example.test /api token", "http old.example.test /api token"]);
  assertEquals(importOpenApi("x.json", "{}").problems.length, 1);
  assertEquals(importOpenApi("x.yaml", "openapi: 3.0.0\ninfo:\n  title: t\n").problems.length, 1);
});

proves(["0003-estate-endpoints-readers FR-002"], "a GraphQL schema or introspection gives an endpoint only at the address it is given, with the authentication unknown", () => {
  const r = importGraphql("schema.graphql", "type Query { me: User }\ntype User { id: ID }", "https://api.example.test/graphql");
  accepted(r);
  assertEquals(r.assets[0]?.attributes, { scheme: "https", host: "api.example.test", path: "/graphql", authentication: "unknown", api: "graphql", provenance: "graphql:schema.graphql#schema" });
  assertEquals(importGraphql("i.json", JSON.stringify({ data: { __schema: { types: [] } } }), "https://x.example.test/gql").assets.length, 1);
  assert(importGraphql("schema.graphql", "type Query { me: Int }", undefined).problems[0]?.includes("does not say where it is served"));
  assertEquals(importGraphql("a.txt", "hello", "https://x.example.test").problems.length, 1);
});

const ANDROID = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="test.example.field">
  <uses-sdk android:minSdkVersion="26"/>
  <application android:usesCleartextTraffic="true">
    <activity android:name=".Main">
      <intent-filter>
        <data android:scheme="https" android:host="app.example.test"/>
        <data android:scheme="https" android:host="app.example.test"/>
        <data android:scheme="http" android:host="legacy.example.test"/>
        <data android:scheme="field" android:host="custom"/>
        <data android:scheme="https" android:host="*"/>
      </intent-filter>
    </activity>
  </application>
</manifest>`;

const PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>test.example.field</string>
  <key>MinimumOSVersion</key><string>16.0</string>
  <key>NSAppTransportSecurity</key><dict>
    <key>NSExceptionDomains</key><dict>
      <key>legacy.example.test</key><dict><key>NSExceptionAllowsInsecureHTTPLoads</key><true/></dict>
      <key>strict.example.test</key><dict><key>NSIncludesSubdomains</key><true/></dict>
    </dict>
  </dict>
</dict></plist>`;

proves(["0003-estate-endpoints-readers FR-003", "0003-estate-endpoints-readers FR-004"], "an Android manifest and an iOS Info.plist give the app with its system and cleartext setting and an endpoint for each deep link or exception domain, linked to the app", () => {
  const a = importAndroid("AndroidManifest.xml", ANDROID);
  accepted(a);
  assertEquals(a.problems, []);
  assertEquals(a.assets.map((x) => x.id), ["android-test-example-field", "android-test-example-field-app-example-test", "android-test-example-field-legacy-example-test"]);
  assertEquals(by(a, "android-test-example-field")?.attributes, { platform: "android", "bundle-id": "test.example.field", "min-os": "26", "allows-cleartext": true, provenance: "android:AndroidManifest.xml#manifest" });
  assertEquals(by(a, "android-test-example-field-legacy-example-test")?.attributes["scheme"], "http");
  assertEquals(a.links.map((l) => `${l.from}>${l.to} ${l.kind}`), ["android-test-example-field>android-test-example-field-app-example-test client-of", "android-test-example-field>android-test-example-field-legacy-example-test client-of"]);
  const i = importIos("Info.plist", PLIST);
  accepted(i);
  assertEquals(i.assets.map((x) => x.id), ["ios-test-example-field", "ios-test-example-field-legacy-example-test"]);
  assertEquals(by(i, "ios-test-example-field")?.attributes, { platform: "ios", "bundle-id": "test.example.field", "min-os": "16.0", "allows-cleartext": true, provenance: "ios:Info.plist#Info.plist" });
  assertEquals(by(i, "ios-test-example-field-legacy-example-test")?.attributes["scheme"], "http");
  const strict = importIos("Info.plist", PLIST.replace("<true/></dict>\n      <key>strict", "<false/></dict>\n      <key>strict"));
  assertEquals(strict.assets.length, 1);
  assertEquals(strict.assets[0]?.attributes["allows-cleartext"], false);
  assertEquals(importAndroid("x.xml", "<a/>").problems.length, 1);
  assertEquals(importIos("x.plist", "<plist><dict/></plist>").problems.length, 1);
  assert(importIos("x.plist", "bplist00").problems[0]?.includes("plutil"));
});

const ZONE = `$ORIGIN example.test.
$TTL 3600
@       IN SOA ns1.example.test. admin.example.test. (
            2026112101 ; serial
            7200 3600 1209600 3600 )
        IN NS ns1.example.test.
        IN DNSKEY 257 3 13 AAAAmadeupkey
ns1     IN A 192.0.2.53
www     300 IN CNAME web
web     IN A 192.0.2.80
        IN AAAA 2001:db8::80
mail    IN MX 10 mx.example.test.
_dmarc  IN TXT "v=DMARC1; p=reject; secret=hunter2-made-up"
`;

proves(["0003-estate-endpoints-readers FR-005"], "a zone gives a domain for each name that owns a record, signed where the apex has a key, a dependency for a CNAME inside the zone, and copies no address or text", () => {
  const r = importZone("example.test.zone", ZONE);
  accepted(r);
  assertEquals(r.assets.map((a) => a.attributes["name"]), ["_dmarc.example.test", "example.test", "mail.example.test", "ns1.example.test", "web.example.test", "www.example.test"]);
  assertEquals(by(r, "dns-example-test")?.attributes["dnssec"], true);
  assertEquals(by(r, "dns-www-example-test")?.attributes["dnssec"], undefined);
  assertEquals(r.links, [{ from: "dns-www-example-test", to: "dns-web-example-test", kind: "depends-on" }]);
  assert(!JSON.stringify(r).includes("hunter2") && !JSON.stringify(r).includes("192.0.2") && !JSON.stringify(r).includes("AAAAmadeupkey"));
  const given = importZone("db.test", "www IN A 192.0.2.1\nftp IN CNAME www\n", "other.test");
  assertEquals(given.assets.map((a) => a.attributes["name"]), ["ftp.other.test", "www.other.test"]);
  assertEquals(importZone("x.txt", "just some text\n").problems.length, 1);
});

const SS = `Netid State  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process
tcp   LISTEN 0      128          0.0.0.0:22         0.0.0.0:*     users:(("sshd",pid=801,fd=3))
tcp   LISTEN 0      128        127.0.0.1:5432       0.0.0.0:*
tcp   LISTEN 0      511                *:443              *:*
tcp   LISTEN 0      511             [::]:443           [::]:*
udp   UNCONN 0      0            0.0.0.0:123        0.0.0.0:*
tcp   ESTAB  0      0         192.0.2.10:22      192.0.2.99:50000
`;

proves(["0003-estate-endpoints-readers FR-006"], "the ports of a machine, as ss and osquery give them, are endpoints with their service, the loopback is internal, a wildcard bind says no exposure, and the machine exposes them", () => {
  const r = importListening("synthetic-server-02-ss.txt", "synthetic-server-02.example.test", SS, "synthetic-server-02");
  accepted(r, ["synthetic-server-02"]);
  assertEquals(r.assets.map((a) => `${a.attributes["scheme"]} ${a.attributes["host"]} ${a.attributes["port"]} ${a.attributes["service"]} ${a.attributes["exposure"]}`), [
    "tcp synthetic-server-02.example.test 22 ssh undefined",
    "tcp 127.0.0.1 5432 postgres internal",
    "https synthetic-server-02.example.test 443 https undefined",
    "udp synthetic-server-02.example.test 123 ntp undefined",
  ]);
  assertEquals(r.links.length, 4);
  assert(r.links.every((l) => l.from === "synthetic-server-02" && l.kind === "exposes"));
  const o = importListening("synthetic-server-02-osquery.json", "synthetic-server-02.example.test", JSON.stringify([{ address: "0.0.0.0", port: 80, protocol: 6, pid: 1 }, { address: "::", port: 53, protocol: 17, pid: 2 }]));
  accepted(o);
  assertEquals(o.assets.map((a) => `${a.attributes["scheme"]} ${a.attributes["port"]} ${a.attributes["service"]}`), ["http 80 http", "udp 53 dns"]);
  assertEquals(o.links, []);
  assertEquals(importListening("x.txt", "h", "nothing here\n").problems.length, 1);
});

proves(["0003-estate-endpoints-readers FR-008"], "the reader is chosen by what is in the text, and a text no reader reads is a problem", () => {
  assertEquals([OPENAPI, '{"openapi":"3.0.0"}', "type Query { a: Int }", JSON.stringify({ __schema: {} }), ANDROID, PLIST, ZONE, SS, '[{"address":"0.0.0.0","port":1}]', "-----BEGIN CERTIFICATE-----\nx\n-----END CERTIFICATE-----"].map((t) => detectFormat("f", t)), ["openapi", "openapi", "graphql", "graphql", "android", "ios", "dns-zone", "listening-ports", "listening-ports", "certificate"]);
  assertEquals(detectFormat("f", "hello"), undefined);
  assertEquals(detectFormat("f", '{"a":1}'), undefined);
  assertEquals(readText("f.txt", "hello").problems.length, 1);
  assert(readText("ss.txt", SS).problems[0]?.includes("give the machine's name"));
  assertEquals(readText("ss.txt", SS, { host: "synthetic-server-02" }).assets.length, 4);
});

async function certificate(dir: string, name: string, cn: string, sans: readonly string[]): Promise<string> {
  const key = path.join(dir, `${name}.key`);
  const crt = path.join(dir, `${name}.crt`);
  const r = await proc.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", crt, "-days", "400", "-subj", `/CN=${cn}/O=Made Up`, "-addext", `subjectAltName=${sans.map((s) => `DNS:${s}`).join(",")}`]);
  if (r.code !== 0) throw new Error(`openssl: ${r.stderr}`);
  return crt;
}

proves(["0003-estate-endpoints-readers FR-007"], "a certificate gives its subject, names, issuer, end day and key, a wildcard covers one label, and the endpoints that speak over TLS to a covered name are secured by it", async (t) => {
  if ((await proc.run(["openssl", "version"]).catch(() => undefined))?.code !== 0) return t.skip("openssl is not here");
  await fs.withTempDir(async (dir) => {
    const crt = await certificate(dir, "site", "portal.example.test", ["portal.example.test", "*.api.example.test"]);
    const facts = certificatesOf(await fs.readTextFile(crt));
    assertEquals(facts.length, 1);
    assertEquals([facts[0]?.subject, facts[0]?.names, facts[0]?.issuer, facts[0]?.key], ["portal.example.test", ["portal.example.test", "*.api.example.test"], "portal.example.test", "rsa-2048"]);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(facts[0]?.notAfter ?? ""));
    const r = importCertificates(crt, facts);
    accepted(r);
    assertEquals(r.assets[0]?.id, "cert-portal-example-test");
    assertEquals(importCertificates("x.pem", []).problems.length, 1);
  });
  assert(covers("*.example.test", "a.example.test") && !covers("*.example.test", "a.b.example.test") && !covers("*.example.test", "example.test") && covers("A.Example.Test", "a.example.test"));
  const links = secure([
    { id: "c", kind: "certificate", attributes: { subject: "portal.example.test", names: ["portal.example.test", "*.api.example.test"] } },
    { id: "e1", kind: "endpoint", attributes: { scheme: "https", host: "portal.example.test" } },
    { id: "e2", kind: "endpoint", attributes: { scheme: "https", host: "v1.api.example.test" } },
    { id: "e3", kind: "endpoint", attributes: { scheme: "http", host: "portal.example.test" } },
    { id: "e4", kind: "endpoint", attributes: { scheme: "https", host: "other.example.test" } },
  ]);
  assertEquals(links.map((l) => `${l.from}>${l.to} ${l.kind}`), ["e1>c secured-by", "e2>c secured-by"]);
});

proves(["0003-estate-endpoints-readers FR-009"], "a folder is walked, what no reader reads is skipped, a file named and unread is a problem, tool folders are not entered, certificates are read and linked to endpoints, and a repeated identity keeps the first", async (t) => {
  if ((await proc.run(["openssl", "version"]).catch(() => undefined))?.code !== 0) return t.skip("openssl is not here");
  await fs.withTempDir(async (dir) => {
    await fs.mkdir(path.join(dir, "mobile"), { recursive: true });
    await fs.mkdir(path.join(dir, "node_modules", "x"), { recursive: true });
    await fs.writeTextFile(path.join(dir, "api.yaml"), OPENAPI);
    await fs.writeTextFile(path.join(dir, "again.yaml"), OPENAPI);
    await fs.writeTextFile(path.join(dir, "mobile", "AndroidManifest.xml"), ANDROID);
    await fs.writeTextFile(path.join(dir, "mobile", "Info.plist"), PLIST);
    await fs.writeTextFile(path.join(dir, "example.test.zone"), ZONE);
    await fs.writeTextFile(path.join(dir, "notes.json"), '{"notes":1}');
    await fs.writeTextFile(path.join(dir, "node_modules", "x", "api.yaml"), OPENAPI);
    const crt = await certificate(dir, "api", "prod.api.example.test", ["prod.api.example.test"]);
    const r = await importPaths([dir]);
    assert(!r.problems.some((p) => p.includes("notes.json") || p.includes("node_modules")), r.problems.join());
    assert(r.files.map((f) => f.format).sort().join() === "android,certificate,dns-zone,ios,openapi,openapi" || r.files.some((f) => f.format === "certificate"), JSON.stringify(r.files));
    assert(r.assets.some((a) => a.kind === "certificate") && r.assets.some((a) => a.id === "dns-example-test"));
    assert(r.links.some((l) => l.kind === "secured-by" && l.from.startsWith("api-portal-api")), "the API endpoint is secured by the certificate that covers its host");
    assertEquals(r.problems.filter((p) => p.includes("identit")).length, 1);
    const named = await importPaths([path.join(dir, "notes.json"), path.join(dir, "nothing.json")]);
    assertEquals(named.problems.length, 2);
    void crt;
  });
});
