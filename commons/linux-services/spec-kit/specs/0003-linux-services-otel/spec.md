# Feature Specification: Linux Services OpenTelemetry profiles

**Spec ID:** 0003-linux-services-otel
**Status:** Draft
**Owner:** if
**Domain:** linux-services

**Input:** Two services make telemetry reach the controller from a site: a **site relay**, a pinned OpenTelemetry Collector built with the builder (`ocb`) from only the components the site needs, which receives what devices that cannot run a program send (syslog, SNMP, NetFlow, Redfish, Prometheus, OTLP) and forwards it as OTLP over its own outbound SSH forward; and our own small **exporter** (telemetry 0003-telemetry-reach) on an asset of level 3. Each is said as a typed profile that is checked and from which the requirements of Desired OS State are made, in the way of the profiles that exist (0002-linux-services-profiles). It is governed by commons 0041-telemetry-and-reach (audit rows F1 to F4, G1, G2, A16). **The site relay (FR-001 to FR-006) is built; FR-007 to FR-011 stay Deferred.**

## The site relay

- **FR-001**: `OtelSiteRelayProfile` MUST be a typed profile of: a name; the relay's id; the controller (`host`, `port` of the SSH service, a reference to the pinned host key); the loopback port of the controller's receiver and the local port of the forward; the receivers, a list of a closed union `syslog` (port, `udp` or `tcp`, the format `rfc5424` or `rfc3164`), `snmp` (the targets, the version `v3` and `authPriv` only, the OIDs or the scope, the interval, a reference to the file of the credentials), `netflow` (port, the scheme `netflow`, `sflow` or `ipfix`), `redfish` (the targets, the interval, a reference to the file of the credentials), `prometheus` (the scrape targets) and `otlp` (loopback only); and the pin of the build. `parseOtelSiteRelay(input)` MUST give every reason it is refused and a value only where there is none, as `parsePostgres` does. Relies on audit rows: F1.
- **FR-002**: The profile MUST NOT carry a secret: a community string, an SNMPv3 passphrase, a Redfish password and a token MUST be a path of a file on the machine (`SECRET_PATHS`), never a value, and a field that looks like a secret (as `findSecretLike` decides) MUST be refused; each rendered file MUST name the path where the secret is put. Relies on audit rows: F1, C7.
- **FR-003**: The build MUST be data: `BuilderManifest` (the `dist` with the name and the version of the Collector, and the lists of the receivers, processors, exporters and extensions, each a `gomod` text with an exact version) rendered by `toYaml` (formats), and it MUST hold only what the profile needs: the receivers of the profile's list (the `syslog`, `snmp`, `netflow`, `redfish`, `prometheus` and `otlp` receivers of the Collector distribution that have them), the processors `batch`, `memory_limiter` and `resource`, the exporter `otlphttp`, and the extensions `file_storage` and `bearertokenauth`; a test MUST show that the components of the manifest are exactly those the rendered configuration names (nothing built and unused, nothing named and not built). Relies on audit rows: F3, F4.
- **FR-004**: The configuration of the Collector MUST be rendered as data (`CollectorConfig`, a `Json` value) and written by `toYaml`, not by a template string; it MUST send, in the pipelines `logs` and `metrics`, through `memory_limiter` and `resource` (which adds `if.relay.id`) and `batch`, to the exporter `otlphttp` whose endpoint is `http://127.0.0.1:<local port>` (the forward), whose encoding is `json` (our receiver speaks OTLP JSON and not protobuf, telemetry 0001-telemetry FR-019), whose compression is `gzip`, whose queue is persistent (`file_storage`) and whose retry is on, authenticated by `bearertokenauth` read from a file; and it MUST bind no receiver to a public interface that the profile did not name. Relies on audit rows: F4, A2, A11.
- **FR-005**: `otelSiteRelayRequirements(profile)` MUST give requirements accepted by `defineRequirement`, each saying why it holds, ordered (the unprivileged account and the folders, the pinned program of the relay, the configuration, the unit of the Collector, the key of the forward and the pinned host key of the controller, the unit of the forward, the services running and enabled), for one subject, with the ids `services.otel-site-relay.<part>`; the unit of the Collector MUST run as the account of the profile with `NoNewPrivileges`, and a receiver on a port below 1024 (syslog on 514) MUST be given `AmbientCapabilities=CAP_NET_BIND_SERVICE` for that purpose only; the unit of the forward MUST be run from the argument vector of headless 0016-headless-ssh-forward and restart on failure. Relies on audit rows: F1, A13, G1.
- **FR-006**: The program of the relay MUST be a pin of the packaging ontology (`PinnedDownload` and its `Checksum` for each platform, like `pinOtelcolContrib` and its sum for Linux x64), named by id in the profile; the profile names that pin by id with the version, the address and the SHA-256 of OUR release (`RelayBuild`), and a pin of the builder (`ocb`) MAY be added in the packaging ontology where our CI builds the relay (not made in this version, so no build exists yet and `relay add` says so); the relay's build is OUR release (the Collector built from the manifest by our CI, not downloaded as the publisher released it) and is pinned by the SHA-256 of that release, so `pinned-downloads` installs what our release holds and builds nothing on the machine (pinned-downloads 0001 FR-006 stands). The contrib distribution of the Collector (`pinOtelcolContrib`) MUST NOT be used as a relay. Relies on audit rows: G1, G2, A16, F3.
- **FR-007**: The relay MUST be reported by what `linux-observe` observes of its requirements (the package, the files, the services) and by the signals it sends itself (the Collector's own metrics where its configuration sends them to the same pipeline), and a relay with no recent signal MUST make the assets behind it `unknown` (estate 0009-estate-sightings FR-009). Relies on audit rows: F1.
- **FR-008**: This version MUST make the relay for Linux with systemd only; a relay on macOS or Windows MUST NOT be claimed (UNVERIFIED). The program of a relay MAY instead be a command the machine already has (`RelayProgram` `command`): our own relay, which takes TCP syslog and OTLP only and is the way a relay works before a build of the Collector exists. Relies on audit rows: F1.

## The exporter and the agent

- **FR-009**: `OtelExporterProfile` MUST be a typed profile of: the controller (as for the relay), the forward ports, the paths of the key and of the pinned host key, the queue's folder and cap, the cadence of the probe, and the pin of the exporter; `otelExporterRequirements(profile)` MUST give the requirements of a service that runs the exporter of telemetry 0003-telemetry-reach (the program, its configuration, the queue's folder, the unit of the exporter and the unit of the forward), with the ids `services.otel-exporter.<part>`, for systemd in this version; a unit for launchd and one for a Windows service MUST be listed as requirements that this version does not make (UNVERIFIED). Relies on audit rows: F1, G1.
- **FR-010**: A profile `otel-agent` (a Collector on each device) MUST NOT be made: the audit finds that the exporter alone is enough for a device of level 3 and that a Collector on a device is what the owner decided against; a later specification MAY add it only by a decision of the owner. Relies on audit rows: F3.
- **FR-011**: The mail relay profile (`MailRelayProfile`) MUST be left as it is; where SMTP store and forward is built (commons 0041-telemetry-and-reach FR-009) it MAY be the leg that sends the signed envelope, and MUST NOT be changed before. Relies on audit rows: F2.

## Acceptance scenarios

1. **Given** a profile with an SNMP receiver whose credentials field holds a passphrase, **When** it is parsed, **Then** it is refused, per FR-002.
2. **Given** the profile of a relay with syslog and SNMP, **When** the builder manifest and the configuration are made, **Then** the manifest holds the two receivers, `batch`, `memory_limiter`, `resource`, `otlphttp`, `file_storage` and `bearertokenauth` and no other component, per FR-003.
3. **Given** the configuration, **When** it is read back, **Then** the exporter's endpoint is the loopback of the forward and its encoding is `json`, per FR-004.
4. **Given** the requirements of a relay, **When** each is checked, **Then** each is valid and ordered and the unit of the forward depends on the key, per FR-005.
5. **Given** a relay profile that names the contrib pin, **When** it is parsed, **Then** it is refused, per FR-006.
6. **Given** a request for a profile `otel-agent`, **When** the profiles are listed, **Then** none is there, per FR-010.

## Out of scope

- Building the Collector (a workflow of our CI) and the release of the build.
- The configuration of the devices that send to the relay.

## Edge cases

- A site that needs no SNMP: the receiver is not in the profile and not in the build, per FR-003.
- Syslog on 514: the capability is named in the unit, per FR-005.

## Assumptions

- The names of the components and their configuration keys are those of the Collector at the pinned version (UNVERIFIED: the Collector is version 0.x and several of these receivers are at an early stability level; the netflow and redfish receivers may not exist at the pinned version).

## Open questions

- OQ-3 of commons 0041-telemetry-and-reach: how our build of the relay is published.

## UNVERIFIED

- The existence and the configuration keys of the `netflow` and `redfish` receivers at the pinned version of the Collector; the `encoding: json` option and the `sending_queue` storage of `otlphttp`; `AmbientCapabilities` for a UDP port below 1024 under a unit with `NoNewPrivileges`.

## Key entities

- **OtelSiteRelayProfile** - the profile of a pinned custom Collector with the receivers a site needs.
- **BuilderManifest** - the data that `ocb` builds the Collector from.
- **OtelExporterProfile** - the profile of the service that runs our exporter.

## Success criteria

- **SC-001**: Every requirement above is proved by a test of this library with synthetic names and no network, or is a row `none` with the note Deferred until the code exists; no row is enforced before it is built.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement names the row of the reuse audit of commons 0041-telemetry-and-reach it relies on
