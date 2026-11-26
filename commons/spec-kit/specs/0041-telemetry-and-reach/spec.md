# Feature Specification: Telemetry and reach

**Spec ID:** 0041-telemetry-and-reach
**Status:** Draft
**Owner:** if
**Domain:** commons
**Part of:** 0033-kanon

**Input:** A fleet is made of assets that differ in what they can do: a server that can run a program and reach out over SSH, a router that can only send syslog, a printer that answers SNMP. The SDK of commons has to take all of them into one estate with one identity, one way to ask a question and one way to send signals, without a vendor agent on each and without inventing what commons already has. This specification names the capability levels 0 to 3 of an asset, the paths by which each level reaches the controller (SSH, HTTPS and TLS, osQuery, OpenTelemetry), the three things an enrolled asset has at least, and the rule that every requirement cites the row of the reuse audit (`reuse-audit.md`, this folder) that it relies on. It is built by amending the libraries that the audit says to extend, each with its own specification (telemetry 0003-telemetry-reach, machine-probe 0009-machine-probe-signals, linux-services 0003-linux-services-otel, estate 0009-estate-sightings, integrations 0010-integrations-network-observers, ssh-server 0007-ssh-server-dedupe-and-forward, anyfs 0011-anyfs-queue, headless 0016-headless-ssh-forward, grc 0017-grc-sshsig-namespace, net 0002-net-client-certificate, formats 0002-formats-mime-and-protobuf, estate-query 0006-estate-query-host-tables). The goal is a general SDK in commons that a product composes: a product passes a Brand and the policy data, and commons holds no product code. **Implementation happens after the owner's acceptance run of the command line; until then every requirement that asks for code is a row `none` with the note Deferred.**

## The capability levels

- **FR-001**: An asset MUST have one capability level of the closed type `AssetLevel` of `0`, `1`, `2` or `3`, given by a total pure function `levelOf` of what is known of it: level `3` where it can open an SSH connection outward and run osQuery; level `2` where it can open an SSH connection outward and cannot run osQuery; level `1` where it cannot open an SSH connection and has been identified (it was sighted by a site relay and a person approved it); level `0` where it has not been identified. The levels MUST be ordered, and a function of the level MUST be total over the four values (an exhaustive `switch`). Relies on audit rows: B1, D1.
- **FR-002**: The level of an asset MUST be derived and MUST NOT be declared or stored as an authority: it is recomputed from the observation (`osQuery` present, a working outbound SSH path, an approved sighting), and a fall from a higher level to a lower one MUST be a finding that names what was lost, never an error and never a silent change. Relies on audit rows: B1, D3.
- **FR-003**: At level `3` the asset MUST run our own small exporter (a program of the SDK that reads the probe's facts and the osQuery rows, maps them to declared signals, signs, queues and sends them) and MUST NOT be required to run a full OpenTelemetry Collector. The exporter MUST run on Bun, MUST work on Linux, macOS and Windows, and MUST be built from the requirements of telemetry 0003-telemetry-reach and machine-probe 0009-machine-probe-signals. Relies on audit rows: A4, A6, A7, D5, B9.
- **FR-004**: At level `2` the asset MUST be observed by the `facts` request of the probe alone (no `osquery` request), and MAY run the exporter with the signals the facts give; at level `1` the asset MUST run no program of ours and its facts and its signals MUST be only what a site relay received from it and translated; at level `0` the asset MUST be listed only (estate state `discovered`, estate 0002-estate-governance FR-002) and MUST NOT be approved before it is identified or a person names it. Relies on audit rows: B1, B3, C5.

## The reach: egress and ingress

- **FR-005**: The ways an asset or a relay reaches the controller MUST be one closed typed table `Reach` (a value, not prose), with for each row the channel, the direction in which the connection is opened, who authenticates and how, what is carried, the levels that may use it and the status (`required`, `available` or `optional-later`); a surface MUST render the table and decide nothing. The rows are those of the matrix below. Relies on audit rows: A12, A13, E4.
- **FR-006**: Every connection of the matrix MUST be opened outward from the asset or the relay to the controller, except the controller's own read of an asset it can reach (the probe over SSH, the read of a device by a connector); no row MUST need an inbound port opened on a device. Relies on audit rows: A13, D1.
- **FR-007**: An asset that is reached only by being sighted MUST NOT be sent a credential, and MUST NOT be sent a program: level `1` is observation by a relay and nothing else. Relies on audit rows: B1, C2.

| Row | Channel | Opened by | Authentication | Carries | Levels | Status |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | SSH outbound to the controller, account `s-device` | the asset | the key the device proved when it enrolled (ssh-server 0003 FR-002) | the conversations (`checkin`, `leave`, and the reserved `query`, `jobs`, `health`) | 2, 3 and the relay | required |
| R2 | OTLP over HTTPS and TLS to the controller's receiver, with a bearer token | the asset or the relay | a token held as a credential reference, never a value (integrations 0002 FR-007) | OTLP JSON (protobuf optional later), the signed envelope | 2, 3 and the relay | available |
| R3 | OTLP over HTTPS and TLS with mutual TLS | the asset or the relay | a client certificate (net 0002-net-client-certificate) | the same | 2, 3 and the relay | available, where `net` has it |
| R4 | OTLP over an SSH `-L` forward to the controller's loopback receiver | the asset or the relay | the device identity (the same key as R1) | the same, to `127.0.0.1:<one port>` and nothing else | 2, 3 and the relay | available |
| R5 | Syslog, SNMP traps and polls, NetFlow, Redfish polls, Prometheus scrapes and OTLP from the site, received by a site relay | the device sends or the relay polls, on the site's network | the site's network, plus SNMPv3 `authPriv` or a token of the device's own | what the device speaks, translated to OTLP by the relay | 1 | available |
| R6 | The relay forwards what it translated over its own R4 (or R2) | the relay | the relay's device identity | OTLP | the relay | available |
| R7 | The controller runs the probe over SSH on an asset it can reach | the controller | a read-only key (`probeKeyLine`, machine-probe 0002 FR-002) | `facts`, `version`, one osQuery SELECT | 2, 3 | available |
| R8 | SMTP store and forward of the signed envelope | the asset or the relay | the mail system's | the signed envelope as the body or an attachment | any | optional-later |

- **FR-008**: A relay MUST itself be an asset of level `2` or `3` (it opens an SSH connection outward), because it carries the traffic of level `1` assets by R6; a site with no such asset MUST be reported as unreachable for level `1`, never guessed. Relies on audit rows: A13, H1.
- **FR-009**: SMTP (R8) MUST be optional and later: no level and no requirement of this specification MUST need it, no library MUST be changed for it before the owner decides it, and, where it is built, its payload MUST be the signed envelope of telemetry 0003-telemetry-reach and its writer and reader MUST be formats 0002-formats-mime-and-protobuf and net 0002-net-client-certificate (SMTP section). Relies on audit rows: H3, F2.
- **FR-010**: The forward of R4 MUST be to the controller's loopback and to one port only; any other destination, and any forward from another account, MUST be refused (ssh-server 0007-ssh-server-dedupe-and-forward, headless 0016-headless-ssh-forward). Relies on audit rows: A13, E4.

## What every enrolled asset has

- **FR-011**: An enrolled asset MUST have at least three things, as a closed record `EnrollmentMinimum` and a pure function `missingMinimums`: an **identity** (at least one of the keys of FR-012, approved by a person), a **facts-and-query path** (how its facts and an osQuery answer reach the controller: R1 and the reserved `query` conversation, or R7, or for level `1` the relay's translation of what the device sent), and a **telemetry path** (R2, R3, R4 or R6). An asset that lacks one MUST be reported with which, and MUST NOT be called enrolled. Relies on audit rows: B4, B5, D1, E8.
- **FR-012**: The identity of an asset MUST be a set of keys of the closed type `IdentityKey`: `machine-id`, `serial`, `mac`, `snmp-engine-id` and `host-key`; the rules that resolve a set to an asset, and that refuse an ambiguous one, are those of estate 0009-estate-sightings. Relies on audit rows: B4, D3.
- **FR-013**: The receiver MUST attribute every batch to an asset by what it authenticated (the device identity of R4, a token's owner, a certificate's subject) and MUST set the asset id on the resource itself, so that a batch cannot claim to be another asset; for a batch of a site relay it MUST set the relay's id and leave the keys of the devices behind it (`host.mac`, `host.id`, `host.name`, `host.ip`) for estate to resolve. Relies on audit rows: A11, E8.
- **FR-014**: A person MUST approve a sighting before it becomes an asset (`moveState` with an `Approval`, estate 0003-estate-logical FR-001); an agent MUST NOT approve for itself (ssh-server 0003 FR-011); who may approve is decided by `tenancy` `decide` with the action `approve-change` or by a change-control approver, and no new role is made here. Relies on audit rows: B1, H6.

## How the work is done

- **FR-015**: Every requirement of this specification and of each specification it governs MUST be a function or a type of the typed SDK (algebraic types, a `Result` for what can fail, a decoder for what comes from outside), and a surface (the command line, the REST API, the console, the MCP server) MUST only collect a typed input, call the SDK, render the typed result and relay a person's act (headless 0001-headless-layers FR-009). No requirement MUST name a product: a product passes a Brand. Relies on audit rows: E1.
- **FR-016**: A requirement of a specification governed by this one MUST cite, in its text or in the row of its enforcement register, the row of `reuse-audit.md` it relies on (for example `A6`); a requirement that builds what a row marks reuse MUST be refused in review; the counts of the audit's summary MUST be those of its table. A check of this is Deferred. Relies on audit rows: (the rule itself).
- **FR-017**: Each library that is extended MUST be extended by a requirement of its own specification kit and MUST keep its Kanon table (commons 0033-kanon FR-010) satisfied: governance holds types and closed tables, the logical layer pure functions, the physical layer the effects; a library that has no table yet (telemetry) MUST gain one before a requirement of this specification lands in it. Relies on audit rows: A6, E1.
- **FR-018**: Where a requirement is not built, its row in the enforcement register MUST be `none` with a note that begins `Deferred`, and it MUST NOT be enforced before it is built; the order of building is: the audit's duplications first (no wire change), then the queue and the envelope, then the mapper and the exporter, then the forward, then sightings and the relay, then the three connector packages, and last the optional protobuf and SMTP. Relies on audit rows: (the order of building).
- **FR-019**: The behaviour on Windows and macOS MUST be stated where it differs: the exporter and the probe run on all three families (the probe has a script for POSIX and one for PowerShell, machine-probe 0001); the exporter is installed as a service of the family's own (systemd, launchd, Windows service); osQuery is the family's own installer (the pins of ssh-server `OSQUERY_PINS`, moved to the pins of the ontology by 0007-ssh-server-dedupe-and-forward); the `ssh` client is OpenSSH on all three (UNVERIFIED for the forward on Windows). Relies on audit rows: D3, E6, F3.

## Acceptance scenarios

1. **Given** an asset that can open an SSH connection and has osQuery, **When** its level is told, **Then** it is `3`; with no osQuery it is `2`; a sighted and approved asset with no SSH is `1`; one seen and not identified is `0`, per FR-001.
2. **Given** a level 3 asset whose osQuery is removed, **When** it is observed again, **Then** its level is `2` and a finding says osQuery was lost, per FR-002.
3. **Given** a router that sends syslog to a relay, **When** a person approves its sighting, **Then** it is an adopted asset of level `1` whose facts and signals come by the relay, per FR-004, FR-011 and FR-014.
4. **Given** the table `Reach`, **When** each row is read, **Then** every connection is opened outward from the asset or the relay, per FR-006.
5. **Given** an asset with an identity and no telemetry path, **When** `missingMinimums` is run, **Then** it names the telemetry path and the asset is not called enrolled, per FR-011.
6. **Given** a batch that carries another asset's id on its resource, **When** the receiver takes it, **Then** the id is replaced by the authenticated asset's, per FR-013.
7. **Given** a requirement of a governed specification with no cited row, **When** the specifications are read, **Then** it is found, per FR-016.

## Out of scope

- The code. Implementation happens after the owner's acceptance run of the command line (FR-018).
- The product: its Brand, its commands, its screens and its policy data.
- Booting a machine, a vendor agent on a device, and writing to a device (every connector is read-only, integrations 0002 FR-004).
- gNMI, and a native OTLP export from network gear: neither is relied on.

## Edge cases

- A relay that goes offline: its level `1` assets are observed as `stale` by the cadence of their record (`staleAfter`), never as failed, per FR-008 and estate 0009-estate-sightings.
- A device with the same MAC as another (a virtual machine clone): resolution gives a conflict that a person settles, never a merge, per FR-012.
- A level 3 asset that cannot reach the controller for a day: its signals wait in the durable queue and are sent in order, per FR-003 and telemetry 0003-telemetry-reach.
- A forward to any port but the one: refused and audited, per FR-010.

## Assumptions

- The controller is one process that holds the receiver, the estate store and the queue's other end; a product may split them.
- The commons does not receive UDP itself: a site relay's own Collector does (audit H1).

## Open questions

- **OQ-1**: Should `integrations` declare a Kanon `family` so that the name `integrations-<vendor>` is checked (audit C6)?
- **OQ-2**: Is a separate role for approving a sighting wanted, or is `approve-change` enough (audit H6)?
- **OQ-3**: Is our relay build published as our own release (audit F3), and by which workflow?

## UNVERIFIED

- The OpenTelemetry semantic conventions are `Development` in part; the Collector is version 0.x; gNMI is not documented here and not used; no native OTLP export from network gear is confirmed; the `permitopen` and `restrict` behaviour of OpenSSH, `-L` on Windows, and a client certificate with `fetch` on Bun and Node 26 are not run on a real host; Redfish telemetry is not read. The full list is at the end of `reuse-audit.md`.

## Key entities

- **AssetLevel** - the capability level 0 to 3, derived.
- **Reach** - the closed table of the ways to the controller.
- **Site relay** - an asset of level 2 or 3 that receives what level 1 devices send and forwards it as OTLP.
- **EnrollmentMinimum** - the identity, the facts-and-query path and the telemetry path.
- **IdentityKey** - machine id, serial, MAC, SNMP engine id, host key.
- **Sighting** - a record that a relay saw a device by a protocol (estate 0009-estate-sightings).

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| OpenTelemetry (OTLP, the data model, Trace Context) | The wire and the model, JSON first | commons telemetry 0001-telemetry, which already implements them |
| OpenTelemetry semantic conventions | Names of host and system metrics, pinned to one version | Not read here; the table is specified in telemetry 0003-telemetry-reach with the policy for `Development` conventions |
| DSSE and SSHSIG (PROTOCOL.sshsig of OpenSSH) | The signed envelope | commons grc 0014-grc-sshsig and crypto 0001-crypto, already implemented |
| SNMPv3 (RFC 3414, RFC 3411 to 3418) | The security model of the SNMP connector, `authPriv` | Named in integrations 0002 FR-009; not read here |
| DMTF Redfish | The HTTPS JSON service of a baseboard controller | Not read here |
| Kanon (commons 0033-kanon) | Governance, logical, physical, plugins | The files named in the audit |

## Success criteria

- **SC-001**: Every requirement of this specification that asks for code has a row of the enforcement register, and every row is `none` with the note Deferred until the code exists; each row that has code has a test with synthetic names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement says which row of the reuse audit it relies on, or is about the rule itself
