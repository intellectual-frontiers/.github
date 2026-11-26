// Spec: 0003-linux-services-otel FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
/**
 * The site relay: the parsing of its profile, the build as data, the configuration of the Collector as data, the units of systemd and the requirements of Desired OS State. Nothing here runs a program or reads a machine, and no secret is here:
 * a credential is the path of a file the owner puts on the machine.
 *
 * @example
 * ```ts
 * import { parseOtelSiteRelay } from "./relay.ts";
 * parseOtelSiteRelay({}).kind; // "err"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { defineRequirement, findSecretLike, type JsonValue, type Requirement, type RequirementInput } from "@intellectual-frontiers/desired-os-state/governance";
import { toYaml } from "@intellectual-frontiers/formats/yaml";
import { sshForwardArgv } from "@intellectual-frontiers/headless/targets/ssh";
import { target } from "@intellectual-frontiers/headless/logical";
import { COLLECTOR_VERSION, NAME, PORTS, RELAY_PATHS } from "@intellectual-frontiers/linux-services/governance";
import type { OtelSiteRelayProfile, RelayProgram, RelayReceiver } from "@intellectual-frontiers/linux-services/governance";

type Obj = { readonly [key: string]: unknown };
const asObj = (v: unknown): Obj | undefined => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Obj) : undefined);
const SHA256 = /^[0-9a-f]{64}$/;
const HOST = /^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/;
const HOSTPORT = /^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?:[0-9]{2,5}$/;
const ABS = /^\/[A-Za-z0-9._/-]{1,200}$/;
const KEYLINE = /^\[?[A-Za-z0-9.:-]+\]?(:[0-9]+)?\s+ssh-ed25519\s+[A-Za-z0-9+/=]{20,}$/;
/** The words a command of the relay's own program is made of. */
const ARGV_WORD = /^[A-Za-z0-9_@%+=:,./-]{1,200}$/;

const port = (v: unknown, where: string, problems: string[], min: number = PORTS.min): number => {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > PORTS.max) {
    problems.push(`${where}: a whole number from ${min} to ${PORTS.max}`);
    return 0;
  }
  return v;
};

function receiverOf(v: unknown, i: number, program: RelayProgram["kind"] | undefined, problems: string[]): RelayReceiver | undefined {
  const where = `receivers[${i}]`;
  const o = asObj(v);
  if (o === undefined) {
    problems.push(`${where}: a receiver is an object`);
    return undefined;
  }
  const targets = (): readonly string[] => {
    const t = o["targets"];
    if (Array.isArray(t) && t.length > 0 && t.every((x) => typeof x === "string" && HOSTPORT.test(x))) return t as string[];
    problems.push(`${where}.targets: a list of host:port`);
    return [];
  };
  const interval = (): number => {
    const n = o["intervalSec"];
    if (typeof n !== "number" || !Number.isInteger(n) || n < 10 || n > 86_400) {
      problems.push(`${where}.intervalSec: a whole number of seconds from 10 to 86400`);
      return 60;
    }
    return n;
  };
  const credentials = (): string => {
    const f = o["credentialsFile"];
    if (typeof f !== "string" || !ABS.test(f)) {
      problems.push(`${where}.credentialsFile: the absolute path of a file on the machine`);
      return "";
    }
    return f;
  };
  if (program === "command" && o["kind"] !== "syslog" && o["kind"] !== "otlp") problems.push(`${where}: the relay's own program takes syslog over tcp and otlp only`);
  switch (o["kind"]) {
    case "syslog": {
      const transport = o["transport"];
      const format = o["format"];
      if (transport !== "udp" && transport !== "tcp") problems.push(`${where}.transport: udp or tcp`);
      if (format !== "rfc5424" && format !== "rfc3164") problems.push(`${where}.format: rfc5424 or rfc3164`);
      if (program === "command" && transport === "udp") problems.push(`${where}.transport: the relay's own program takes tcp only`);
      return { kind: "syslog", port: port(o["port"], `${where}.port`, problems, 1), transport: transport === "udp" ? "udp" : "tcp", format: format === "rfc3164" ? "rfc3164" : "rfc5424" };
    }
    case "snmp": {
      if (o["version"] !== "v3") problems.push(`${where}.version: v3 only`);
      if (o["security"] !== "authPriv") problems.push(`${where}.security: authPriv only`);
      const scope = Array.isArray(o["scope"]) && o["scope"].length > 0 && o["scope"].every((x) => typeof x === "string" && /^[0-9]+(\.[0-9]+)*$/.test(x)) ? (o["scope"] as string[]) : (problems.push(`${where}.scope: a list of OIDs`), []);
      return { kind: "snmp", targets: targets(), version: "v3", security: "authPriv", scope, intervalSec: interval(), credentialsFile: credentials() };
    }
    case "netflow": {
      const scheme = o["scheme"];
      if (scheme !== "netflow" && scheme !== "sflow" && scheme !== "ipfix") problems.push(`${where}.scheme: netflow, sflow or ipfix`);
      return { kind: "netflow", port: port(o["port"], `${where}.port`, problems, 1), scheme: scheme === "sflow" || scheme === "ipfix" ? scheme : "netflow" };
    }
    case "redfish":
      return { kind: "redfish", targets: targets(), intervalSec: interval(), credentialsFile: credentials() };
    case "prometheus":
      return { kind: "prometheus", targets: targets() };
    case "otlp":
      return { kind: "otlp", port: port(o["port"], `${where}.port`, problems) };
    default:
      problems.push(`${where}.kind: syslog, snmp, netflow, redfish, prometheus or otlp`);
      return undefined;
  }
}

function programOf(v: unknown, problems: string[]): RelayProgram | undefined {
  const o = asObj(v);
  if (o?.["kind"] === "command") {
    const argv = o["argv"];
    if (!Array.isArray(argv) || argv.length === 0 || !argv.every((w) => typeof w === "string" && ARGV_WORD.test(w)) || !String(argv[0]).startsWith("/")) {
      problems.push("program.argv: a command whose first word is an absolute path, in words of safe characters");
      return undefined;
    }
    return { kind: "command", argv: argv as string[] };
  }
  const b = asObj(o?.["build"]);
  if (o?.["kind"] !== "collector" || b === undefined) {
    problems.push("program: a collector with a build pinned by the SHA-256 of our release, or a command");
    return undefined;
  }
  const t = (k: string): string => (typeof b[k] === "string" ? (b[k] as string) : "");
  if (!/^[a-z0-9][a-z0-9-]*$/.test(t("pin"))) problems.push("program.build.pin: the id of the pin");
  if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(t("version"))) problems.push("program.build.version: an exact version");
  if (!/^https:\/\/[^\s]+$/.test(t("downloadUrl"))) problems.push("program.build.downloadUrl: an https address");
  if (!SHA256.test(t("sha256"))) problems.push("program.build.sha256: 64 hex digits, the SHA-256 of the release");
  if (!/^[A-Za-z0-9._/-]{1,100}$/.test(t("binPath"))) problems.push("program.build.binPath: where the program is in the archive");
  const fmt = b["archiveFormat"];
  if (fmt !== "zip" && fmt !== "tar" && fmt !== "file") problems.push("program.build.archiveFormat: zip, tar or file");
  return { kind: "collector", build: { pin: t("pin"), version: t("version"), downloadUrl: t("downloadUrl"), sha256: t("sha256"), archiveFormat: fmt === "zip" || fmt === "tar" ? fmt : "file", binPath: t("binPath") } };
}

/** A site relay from what was written: every reason it is refused, and a value only where there is none. A field that looks like a secret is refused. */
export function parseOtelSiteRelay(input: unknown): Result<OtelSiteRelayProfile, readonly string[]> {
  const o = asObj(input);
  if (o === undefined) return err(["a profile is an object"]);
  const problems: string[] = findSecretLike(input as JsonValue).map((f) => `profile${f.path.slice(1)}: looks like a secret (${f.why}); a profile carries the path of one, never the secret`);
  const name = (k: string): string => {
    const v = o[k];
    if (typeof v !== "string" || !NAME.test(v)) {
      problems.push(`${k}: a name of lowercase letters, digits and dashes`);
      return "";
    }
    return v;
  };
  const machine = name("machine");
  const relayName = name("name");
  const relayId = name("relayId");
  const c = asObj(o["controller"]);
  const host = typeof c?.["host"] === "string" && HOST.test(c["host"]) ? c["host"] : (problems.push("controller.host: a host name or address"), "");
  const sshPort = port(c?.["port"], "controller.port", problems, 1);
  const hostKey = typeof c?.["hostKey"] === "string" && KEYLINE.test(c["hostKey"]) ? c["hostKey"] : (problems.push("controller.hostKey: the known-hosts line of the controller's ssh-ed25519 host key"), "");
  const receiverPort = port(o["receiverPort"], "receiverPort", problems);
  const forwardPort = port(o["forwardPort"], "forwardPort", problems);
  const program = programOf(o["program"], problems);
  const list = o["receivers"];
  const receivers: RelayReceiver[] = [];
  if (!Array.isArray(list) || list.length === 0) problems.push("receivers: at least one");
  else list.forEach((v, i) => {
    const r = receiverOf(v, i, program?.kind, problems);
    if (r !== undefined) receivers.push(r);
  });
  const ports = receivers.flatMap((r) => (r.kind === "syslog" || r.kind === "netflow" || r.kind === "otlp" ? [r.port] : []));
  if (new Set(ports).size !== ports.length) problems.push("receivers: two receivers use one port");
  if (receivers.some((r) => r.kind === "otlp" && r.port === forwardPort)) problems.push("receivers: the otlp receiver and the forward use one port");
  if (problems.length > 0 || program === undefined) return err(problems);
  return ok({ machine, name: relayName, relayId, controller: { host, port: sshPort, hostKey }, receiverPort, forwardPort, receivers, program });
}

// --- the build --------------------------------------------------------------------------------------------------------------------

const MODULE = "go.opentelemetry.io/collector";
const CONTRIB = "github.com/open-telemetry/opentelemetry-collector-contrib";
const comp = (path: string): { readonly gomod: string } => ({ gomod: `${path} v${COLLECTOR_VERSION}` });

/** The component of the Collector that receives what a receiver of the profile names. */
const RECEIVER_MODULE: Readonly<Record<RelayReceiver["kind"], { readonly type: string; readonly path: string }>> = {
  syslog: { type: "syslog", path: `${CONTRIB}/receiver/syslogreceiver` },
  snmp: { type: "snmp", path: `${CONTRIB}/receiver/snmpreceiver` },
  netflow: { type: "netflow", path: `${CONTRIB}/receiver/netflowreceiver` },
  redfish: { type: "redfish", path: `${CONTRIB}/receiver/redfishreceiver` },
  prometheus: { type: "prometheus", path: `${CONTRIB}/receiver/prometheusreceiver` },
  otlp: { type: "otlp", path: `${MODULE}/receiver/otlpreceiver` },
};

/** The manifest of the builder (`ocb`): the Collector's name and version, and exactly the components the profile needs: its receivers, the processors `batch`, `memory_limiter` and `resource`, the exporter `otlphttp` and the extensions `file_storage` and `bearertokenauth`. */
export type BuilderManifest = { readonly dist: { readonly name: string; readonly description: string; readonly version: string; readonly output_path: string }; readonly receivers: readonly { readonly gomod: string }[]; readonly processors: readonly { readonly gomod: string }[]; readonly exporters: readonly { readonly gomod: string }[]; readonly extensions: readonly { readonly gomod: string }[] };

/** The manifest of the build of a profile, as data. */
export function builderManifest(p: OtelSiteRelayProfile): BuilderManifest {
  const kinds = [...new Set(p.receivers.map((r) => r.kind))].sort();
  return {
    dist: { name: "ifc-relay", description: `The site relay ${p.relayId}: only the components its receivers need`, version: COLLECTOR_VERSION, output_path: "./dist" },
    receivers: kinds.map((k) => comp(RECEIVER_MODULE[k].path)),
    processors: [comp(`${MODULE}/processor/batchprocessor`), comp(`${MODULE}/processor/memorylimiterprocessor`), comp(`${CONTRIB}/processor/resourceprocessor`)],
    exporters: [comp(`${MODULE}/exporter/otlphttpexporter`)],
    extensions: [comp(`${CONTRIB}/extension/storage/filestorage`), comp(`${CONTRIB}/extension/bearertokenauthextension`)],
  };
}

/** The text of the manifest. */
export function builderManifestYaml(p: OtelSiteRelayProfile): string {
  return toYaml(builderManifest(p) as unknown as JsonValue);
}

/** The types of component a manifest builds, by section: the last word of the module, without its suffix (`syslogreceiver` is `syslog`). */
export function componentsOf(m: BuilderManifest): Readonly<Record<"receivers" | "processors" | "exporters" | "extensions", readonly string[]>> {
  const type = (g: { readonly gomod: string }, suffix: string): string => {
    const last = (g.gomod.split(" ")[0] ?? "").split("/").at(-1) ?? "";
    const bare = last.endsWith(suffix) ? last.slice(0, -suffix.length) : last;
    return bare === "memorylimiter" ? "memory_limiter" : bare === "filestorage" ? "file_storage" : bare;
  };
  return {
    receivers: m.receivers.map((g) => type(g, "receiver")).sort(),
    processors: m.processors.map((g) => type(g, "processor")).sort(),
    exporters: m.exporters.map((g) => type(g, "exporter")).sort(),
    extensions: m.extensions.map((g) => type(g, "extension")).sort(),
  };
}

// --- the configuration of the Collector ----------------------------------------------------------------------------------------------

type Cfg = { [key: string]: JsonValue };

/** The configuration of the Collector as data: each receiver of the profile, the pipelines `logs` and `metrics` through `memory_limiter`, `resource` and `batch` to `otlphttp` at the local end of the forward, with a persistent queue and a token read from a file. */
export function collectorConfig(p: OtelSiteRelayProfile): Cfg {
  const receivers: Cfg = {};
  const logs: string[] = [];
  const metrics: string[] = [];
  for (const r of p.receivers) {
    const id = (suffix: string): string => `${RECEIVER_MODULE[r.kind].type}/${suffix}`;
    switch (r.kind) {
      case "syslog":
        receivers[id(String(r.port))] = { [r.transport]: { listen_address: `0.0.0.0:${r.port}` }, protocol: r.format };
        logs.push(id(String(r.port)));
        break;
      case "snmp":
        receivers[id("poll")] = { collection_interval: `${r.intervalSec}s`, endpoint: `udp://${r.targets[0] ?? ""}`, version: "v3", security_level: "auth_priv", user: `\${file:${r.credentialsFile}}`, metrics: { scope: r.scope as unknown as JsonValue } };
        metrics.push(id("poll"));
        break;
      case "netflow":
        receivers[id(String(r.port))] = { scheme: r.scheme, endpoint: `0.0.0.0:${r.port}`, sockets: 1 };
        logs.push(id(String(r.port)));
        break;
      case "redfish":
        receivers[id("poll")] = { collection_interval: `${r.intervalSec}s`, servers: r.targets.map((t) => ({ base_url: `https://${t}`, auth_file: r.credentialsFile })) as unknown as JsonValue };
        metrics.push(id("poll"));
        break;
      case "prometheus":
        receivers[id("scrape")] = { config: { scrape_configs: [{ job_name: "site", static_configs: [{ targets: r.targets as unknown as JsonValue }] }] } };
        metrics.push(id("scrape"));
        break;
      case "otlp":
        receivers[id("loopback")] = { protocols: { http: { endpoint: `127.0.0.1:${r.port}` } } };
        logs.push(id("loopback"));
        metrics.push(id("loopback"));
        break;
    }
  }
  const processors = ["memory_limiter", "resource", "batch"];
  return {
    extensions: { file_storage: { directory: RELAY_PATHS.queue }, bearertokenauth: { filename: RELAY_PATHS.token } },
    receivers,
    processors: { memory_limiter: { check_interval: "1s", limit_mib: 128 }, resource: { attributes: [{ key: "if.relay.id", value: p.relayId, action: "upsert" }] }, batch: {} },
    exporters: { otlphttp: { endpoint: `http://127.0.0.1:${p.forwardPort}`, encoding: "json", compression: "gzip", auth: { authenticator: "bearertokenauth" }, sending_queue: { enabled: true, storage: "file_storage" }, retry_on_failure: { enabled: true } } },
    service: {
      extensions: ["file_storage", "bearertokenauth"],
      pipelines: {
        ...(logs.length === 0 ? {} : { logs: { receivers: logs, processors, exporters: ["otlphttp"] } }),
        ...(metrics.length === 0 ? {} : { metrics: { receivers: metrics, processors, exporters: ["otlphttp"] } }),
      },
    },
  };
}

/** The text of the configuration. */
export function collectorConfigYaml(p: OtelSiteRelayProfile): string {
  return `# Rendered by desired-os-state from the model of the fleet. Do not edit: change the model.\n# Secrets are files on this machine: ${RELAY_PATHS.token}${p.receivers.flatMap((r) => ("credentialsFile" in r ? [`, ${r.credentialsFile}`] : [])).join("")}.\n${toYaml(collectorConfig(p) as JsonValue)}`;
}

/** The types of component a configuration names, by section, in the words of the manifest. */
export function namedComponents(c: Cfg): Readonly<Record<"receivers" | "processors" | "exporters" | "extensions", readonly string[]>> {
  const keys = (v: JsonValue | undefined): readonly string[] => (typeof v === "object" && v !== null && !Array.isArray(v) ? Object.keys(v) : []);
  const base = (id: string): string => id.split("/")[0] ?? id;
  return {
    receivers: [...new Set(keys(c["receivers"]).map(base))].sort(),
    processors: keys(c["processors"]).map(base).sort(),
    exporters: keys(c["exporters"]).map(base).sort(),
    extensions: keys(c["extensions"]).map(base).sort(),
  };
}

// --- the units and the requirements ---------------------------------------------------------------------------------------------------

const HEADER = "# Rendered by desired-os-state from the model of the fleet. Do not edit: change the model.\n";

/** The argument vector of the forward: `sshForwardArgv` of headless, with the key and the one pinned host key of the controller. */
export function forwardArgv(p: OtelSiteRelayProfile): Result<readonly string[], string> {
  const t = target({ id: "controller", class: "server", address: p.controller.host, user: "s-device", port: p.controller.port, credential: "forward-key" });
  if (t.kind === "err") return err(t.error);
  return sshForwardArgv(t.value, [t.value], { knownHostsRepository: RELAY_PATHS.knownHosts, knownHostsUser: RELAY_PATHS.knownHosts, family: "pinned", identityFor: () => RELAY_PATHS.forwardKey }, { localPort: p.forwardPort, remotePort: p.receiverPort });
}

const ports = (p: OtelSiteRelayProfile): readonly number[] => p.receivers.flatMap((r) => (r.kind === "syslog" || r.kind === "netflow" || r.kind === "otlp" ? [r.port] : []));

/** The unit of the program of the relay: runs as the account of the relay with `NoNewPrivileges`, and a port below 1024 is given `CAP_NET_BIND_SERVICE` for that and nothing else. */
export function relayUnit(p: OtelSiteRelayProfile): string {
  const privileged = ports(p).some((n) => n < 1024);
  const exec = p.program.kind === "collector" ? [`${RELAY_PATHS.bin}/ifc-relay`, "--config", RELAY_PATHS.config] : p.program.argv;
  return [
    HEADER.trimEnd(),
    "[Unit]",
    `Description=The site relay ${p.relayId}`,
    `After=network-online.target ${p.name}-forward.service`,
    "",
    "[Service]",
    `User=${RELAY_PATHS.account}`,
    `ExecStart=${exec.join(" ")}`,
    "Restart=on-failure",
    "NoNewPrivileges=yes",
    ...(privileged ? ["AmbientCapabilities=CAP_NET_BIND_SERVICE", "CapabilityBoundingSet=CAP_NET_BIND_SERVICE"] : []),
    "",
    "[Install]",
    "WantedBy=multi-user.target",
    "",
  ].join("\n");
}

/** The unit of the forward: run from the argument vector of headless, restarted on failure. */
export function forwardUnit(p: OtelSiteRelayProfile): Result<string, string> {
  const argv = forwardArgv(p);
  if (argv.kind === "err") return argv;
  return ok([HEADER.trimEnd(), "[Unit]", `Description=The forward of the site relay ${p.relayId} to its controller`, "After=network-online.target", "", "[Service]", `User=${RELAY_PATHS.account}`, `ExecStart=${argv.value.join(" ")}`, "Restart=always", "RestartSec=5", "NoNewPrivileges=yes", "", "[Install]", "WantedBy=multi-user.target", ""].join("\n"));
}

/** The requirements of a site relay, ordered, for one subject, with the ids `services.otel-site-relay.<part>`: the account and the folders, the program, the configuration, the unit of the program, the pinned host key, the unit of the forward, and the services running and enabled. */
export function otelSiteRelayRequirements(p: OtelSiteRelayProfile): Result<readonly Requirement[], readonly string[]> {
  const unit = forwardUnit(p);
  if (unit.kind === "err") return err([unit.error]);
  const base = "services.otel-site-relay";
  const why = ["0003-linux-services-otel FR-005", "SC-7 boundary protection", "AU-2 event logging"];
  const subject = { by: "names" as const, names: [p.machine] };
  const root = { owner: "root", group: "root" } as const;
  const own = { owner: RELAY_PATHS.account, group: RELAY_PATHS.account } as const;
  const configText = p.program.kind === "collector" ? collectorConfigYaml(p) : undefined;
  const inputs: RequirementInput[] = [
    { id: `${base}.account`, summary: `The unprivileged account ${RELAY_PATHS.account} runs the relay.`, why, subject, kind: "user", desired: { name: RELAY_PATHS.account, system: true, shell: "/usr/sbin/nologin" }, change: "additive" },
    { id: `${base}.etc`, summary: `The folder ${RELAY_PATHS.etc} holds the files of the relay.`, why, subject, kind: "directory", desired: { path: RELAY_PATHS.etc, mode: "0750", owner: "root", group: RELAY_PATHS.account }, change: "additive", dependsOn: [`${base}.account`] },
    { id: `${base}.state`, summary: `The folder ${RELAY_PATHS.state} holds the queue of the relay.`, why, subject, kind: "directory", desired: { path: RELAY_PATHS.state, mode: "0750", ...own }, change: "additive", dependsOn: [`${base}.account`] },
  ];
  const last: string[] = [`${base}.etc`];
  if (p.program.kind === "collector") {
    const b = p.program.build;
    inputs.push({ id: `${base}.program`, summary: `The relay's own build of the Collector ${b.version} is installed as pinned by the SHA-256 of our release.`, why, subject, kind: "tool", desired: { dialect: "pinned-downloads", tool: "ifc-relay", program: "ifc-relay", version: b.version, source: { kind: "download", pin: b.pin, version: b.version, downloadUrl: b.downloadUrl, sha256: b.sha256, archiveFormat: b.archiveFormat, binPath: b.binPath } }, change: "additive", dependsOn: [`${base}.etc`] });
    last.push(`${base}.program`);
    if (configText !== undefined) {
      inputs.push({ id: `${base}.config`, summary: "The configuration of the Collector sends what the receivers take to the controller through the forward.", why, subject, kind: "file", desired: { path: RELAY_PATHS.config, content: configText, mode: "0640", owner: "root", group: RELAY_PATHS.account }, change: "mutating", dependsOn: [`${base}.etc`] });
      last.push(`${base}.config`);
    }
  }
  inputs.push(
    { id: `${base}.unit`, summary: `The unit of the relay runs as ${RELAY_PATHS.account} with no new privileges.`, why, subject, kind: "file", desired: { path: `${RELAY_PATHS.unit}/${p.name}.service`, content: relayUnit(p), mode: "0644", ...root }, change: "mutating", dependsOn: last },
    { id: `${base}.host-key`, summary: "The one host key of the controller is pinned for the forward.", why, subject, kind: "file", desired: { path: RELAY_PATHS.knownHosts, content: `${p.controller.hostKey}\n`, mode: "0640", owner: "root", group: RELAY_PATHS.account }, change: "mutating", dependsOn: [`${base}.etc`] },
    { id: `${base}.forward-unit`, summary: "The unit of the forward carries the relay's signals to the controller's loopback and restarts on failure.", why, subject, kind: "file", desired: { path: `${RELAY_PATHS.unit}/${p.name}-forward.service`, content: unit.value, mode: "0644", ...root }, change: "mutating", dependsOn: [`${base}.host-key`] },
    { id: `${base}.forward-service`, summary: "The forward runs and starts at boot.", why, subject, kind: "service", desired: { name: `${p.name}-forward.service`, running: true, enabled: true }, change: "mutating", dependsOn: [`${base}.forward-unit`] },
    { id: `${base}.service`, summary: "The relay runs and starts at boot.", why, subject, kind: "service", desired: { name: `${p.name}.service`, running: true, enabled: true }, change: "mutating", dependsOn: [`${base}.unit`, `${base}.forward-service`] },
  );
  const out: Requirement[] = [];
  const problems: string[] = [];
  for (const input of inputs) {
    const r = defineRequirement(input);
    if (r.kind === "ok") out.push(r.value);
    else problems.push(...r.error.map((e) => `${input.id}: ${e}`));
  }
  return problems.length > 0 ? err(problems) : ok(out);
}

/** The parts that the profile's relay is known by in `linux-observe`: the service names it should see running. */
export function relayServices(p: OtelSiteRelayProfile): readonly string[] {
  return [`${p.name}.service`, `${p.name}-forward.service`];
}
