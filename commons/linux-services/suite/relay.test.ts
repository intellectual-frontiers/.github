/**
 * Tests of the site relay (0003-linux-services-otel FR-001 to FR-006): the profile and its refusals, the build and the configuration as data that agree with each other, the units and the ordered requirements, with synthetic names and no secret.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { builderManifest, collectorConfig, collectorConfigYaml, componentsOf, forwardUnit, namedComponents, otelSiteRelayRequirements, parseOtelSiteRelay, relayUnit } from "../src/logical/mod.ts";
import { RELAY_PATHS } from "../src/governance/mod.ts";
import type { OtelSiteRelayProfile } from "../src/governance/mod.ts";

const S = (n: string): string => `0003-linux-services-otel ${n}`;
const HOST_KEY = "[synthetic-controller.example]:2222 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJpIZoHjrBnCdQcVqJ1Hlul5t9tYwKO6tOstcru13QX7";
const BUILD = { pin: "pin-ifc-relay", version: "0.165.0", downloadUrl: "https://synthetic.example/releases/ifc-relay-0.165.0-linux-amd64.tar.gz", sha256: "a".repeat(64), archiveFormat: "tar", binPath: "ifc-relay" };
const good = (more: Record<string, unknown> = {}): Record<string, unknown> => ({
  machine: "synthetic-relay-01",
  name: "ifc-relay",
  relayId: "synthetic-relay-01",
  controller: { host: "synthetic-controller.example", port: 2222, hostKey: HOST_KEY },
  receiverPort: 14318,
  forwardPort: 14318,
  receivers: [
    { kind: "syslog", port: 514, transport: "udp", format: "rfc3164" },
    { kind: "syslog", port: 6514, transport: "tcp", format: "rfc5424" },
    { kind: "netflow", port: 2055, scheme: "ipfix" },
    { kind: "snmp", targets: ["synthetic-switch-01.example:161"], version: "v3", security: "authPriv", scope: ["1.3.6.1.2.1.1"], intervalSec: 60, credentialsFile: "/etc/ifc-relay/snmp-credentials" },
    { kind: "redfish", targets: ["synthetic-bmc-01.example:443"], intervalSec: 120, credentialsFile: "/etc/ifc-relay/redfish-credentials" },
    { kind: "prometheus", targets: ["synthetic-exporter-01.example:9100"] },
    { kind: "otlp", port: 4318 },
  ],
  program: { kind: "collector", build: BUILD },
  ...more,
});
const profile = (more: Record<string, unknown> = {}): OtelSiteRelayProfile => {
  const r = parseOtelSiteRelay(good(more));
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
};

proves([S("FR-001")], "a profile is parsed, and every reason it is refused is given", () => {
  assertEquals(parseOtelSiteRelay(good()).kind, "ok");
  const bad = parseOtelSiteRelay({ machine: "Bad Name", name: "x", relayId: "y", controller: { host: "h", port: 0, hostKey: "not a key" }, receiverPort: 80, forwardPort: 14318, receivers: [{ kind: "syslog", port: 0, transport: "sctp", format: "json" }, { kind: "snmp", targets: [], version: "v2c", security: "noAuth", scope: [], intervalSec: 1, credentialsFile: "relative" }, { kind: "ftp" }], program: { kind: "collector", build: { sha256: "short" } } });
  assert(bad.kind === "err");
  if (bad.kind === "err") for (const word of ["machine", "controller.port", "controller.hostKey", "receiverPort", "transport", "format", "v3 only", "authPriv only", "credentialsFile", "receivers[2].kind", "program.build.sha256"]) assert(bad.error.some((e) => e.includes(word)), `${word} in ${bad.error.join(" | ")}`);
  assert(parseOtelSiteRelay(good({ receivers: [{ kind: "otlp", port: 14318 }] })).kind === "err", "the otlp receiver and the forward on one port");
  assert(parseOtelSiteRelay(good({ receivers: [{ kind: "syslog", port: 514, transport: "udp", format: "rfc3164" }, { kind: "syslog", port: 514, transport: "tcp", format: "rfc5424" }] })).kind === "err", "two receivers on one port");
  assert(parseOtelSiteRelay("x").kind === "err");
});

proves([S("FR-002")], "a field that looks like a secret is refused and a rendered file names the path where a secret is put, never a value", () => {
  const withSecret = parseOtelSiteRelay(good({ receivers: [{ kind: "snmp", targets: ["synthetic-switch-01.example:161"], version: "v3", security: "authPriv", scope: ["1.3.6.1"], intervalSec: 60, credentialsFile: "/etc/ifc-relay/snmp-credentials", authPassphrase: "synthetic-passphrase-value" }] }));
  assert(withSecret.kind === "err" && withSecret.error.some((e) => e.includes("looks like a secret")), withSecret.kind === "err" ? withSecret.error.join("|") : "ok");
  const yaml = collectorConfigYaml(profile());
  assert(yaml.includes(RELAY_PATHS.token) && yaml.includes("/etc/ifc-relay/snmp-credentials"), "the paths of the secrets are named");
  assert(!/password|passphrase|community/i.test(JSON.stringify(collectorConfig(profile())).replace(/credentials/gi, "")), "no value of a secret");
});

proves([S("FR-003")], "the build holds exactly the components the configuration names: nothing built and unused, nothing named and not built", () => {
  for (const more of [{}, { receivers: [{ kind: "syslog", port: 6514, transport: "tcp", format: "rfc5424" }] }, { receivers: [{ kind: "prometheus", targets: ["synthetic-exporter-01.example:9100"] }, { kind: "otlp", port: 4318 }] }]) {
    const p = profile(more);
    const built = componentsOf(builderManifest(p));
    const named = namedComponents(collectorConfig(p));
    assertEquals(built.receivers, named.receivers);
    assertEquals(built.processors, named.processors);
    assertEquals(built.exporters, named.exporters);
    assertEquals(built.extensions, named.extensions);
  }
  const m = builderManifest(profile());
  assertEquals(m.processors.length, 3);
  assert(m.receivers.every((r) => /\sv0\.165\.0$/.test(r.gomod)), "exact versions");
});

proves([S("FR-004")], "the configuration goes through memory_limiter, resource and batch to otlphttp at the forward, in json, gzipped, with a persistent queue and a token from a file, and binds nothing public that the profile did not name", () => {
  const c = collectorConfig(profile()) as Record<string, any>;
  const http = c["exporters"].otlphttp;
  assertEquals(http.endpoint, "http://127.0.0.1:14318");
  assertEquals([http.encoding, http.compression, http.sending_queue.storage, http.retry_on_failure.enabled, http.auth.authenticator], ["json", "gzip", "file_storage", true, "bearertokenauth"]);
  assertEquals(c["extensions"].bearertokenauth.filename, RELAY_PATHS.token);
  assertEquals(c["processors"].resource.attributes[0], { key: "if.relay.id", value: "synthetic-relay-01", action: "upsert" });
  for (const pipe of Object.values(c["service"].pipelines) as { processors: string[]; exporters: string[] }[]) {
    assertEquals(pipe.processors, ["memory_limiter", "resource", "batch"]);
    assertEquals(pipe.exporters, ["otlphttp"]);
  }
  assertEquals(c["receivers"]["otlp/loopback"].protocols.http.endpoint, "127.0.0.1:4318");
  const listens = JSON.stringify(c["receivers"]).match(/0\.0\.0\.0:\d+/g) ?? [];
  assertEquals([...listens].sort(), ["0.0.0.0:2055", "0.0.0.0:514", "0.0.0.0:6514"], "only the ports the profile named");
});

proves([S("FR-005")], "the requirements are accepted, ordered by what they depend on, with the unit unprivileged and the forward from the vector of headless", () => {
  const r = otelSiteRelayRequirements(profile());
  assert(r.kind === "ok", r.kind === "err" ? r.error.join("|") : "");
  if (r.kind !== "ok") return;
  const ids = r.value.map((x) => String(x.id));
  assertEquals(ids, ["account", "etc", "state", "program", "config", "unit", "host-key", "forward-unit", "forward-service", "service"].map((p) => `services.otel-site-relay.${p}`));
  const seen = new Set<string>();
  for (const x of r.value) {
    for (const d of x.dependsOn ?? []) assert(seen.has(String(d)), `${String(x.id)} depends on ${String(d)} which comes later`);
    seen.add(String(x.id));
  }
  const unit = relayUnit(profile());
  assert(unit.includes("User=ifc-relay") && unit.includes("NoNewPrivileges=yes") && unit.includes("AmbientCapabilities=CAP_NET_BIND_SERVICE"), unit);
  assert(!relayUnit(profile({ receivers: [{ kind: "syslog", port: 6514, transport: "tcp", format: "rfc5424" }] })).includes("CAP_NET_BIND_SERVICE"), "no capability without a port below 1024");
  const f = forwardUnit(profile());
  assert(f.kind === "ok" && f.value.includes("-L 127.0.0.1:14318:127.0.0.1:14318") && f.value.includes("ExitOnForwardFailure=yes") && f.value.includes(`UserKnownHostsFile=${RELAY_PATHS.knownHosts}`) && f.value.includes("Restart=always"), f.kind === "ok" ? f.value : f.error);
});

proves([S("FR-006")], "the program is a pin of our own release by SHA-256 for pinned-downloads, and a command takes tcp syslog and otlp only", () => {
  const r = otelSiteRelayRequirements(profile());
  assert(r.kind === "ok");
  if (r.kind !== "ok") return;
  const program = r.value.find((x) => String(x.id).endsWith(".program"));
  assertEquals(program?.kind, "tool");
  const desired = program?.desired as { dialect: string; source: { sha256: string; pin: string } };
  assertEquals([desired.dialect, desired.source.sha256, desired.source.pin], ["pinned-downloads", "a".repeat(64), "pin-ifc-relay"]);
  const own = parseOtelSiteRelay(good({ program: { kind: "command", argv: ["/usr/local/bin/synthetic-relay", "run"] }, receivers: [{ kind: "syslog", port: 6514, transport: "tcp", format: "rfc5424" }, { kind: "otlp", port: 4318 }] }));
  assert(own.kind === "ok", own.kind === "err" ? own.error.join("|") : "");
  if (own.kind === "ok") {
    const q = otelSiteRelayRequirements(own.value);
    assert(q.kind === "ok" && !q.value.some((x) => String(x.id).endsWith(".program") || String(x.id).endsWith(".config")), "a command installs no program and has no collector configuration");
    assert(relayUnit(own.value).includes("ExecStart=/usr/local/bin/synthetic-relay run"));
  }
  assert(parseOtelSiteRelay(good({ program: { kind: "command", argv: ["/usr/local/bin/synthetic-relay", "run"] } })).kind === "err", "snmp and the others are not for the relay's own program");
  assert(parseOtelSiteRelay(good({ program: { kind: "command", argv: ["relative", "x"] }, receivers: [{ kind: "otlp", port: 4318 }] })).kind === "err", "a command is an absolute path");
  assert(parseOtelSiteRelay(good({ program: { kind: "command", argv: ["/bin/sh", "-c", "x;y"] }, receivers: [{ kind: "otlp", port: 4318 }] })).kind === "err", "a word with shell syntax");
});
