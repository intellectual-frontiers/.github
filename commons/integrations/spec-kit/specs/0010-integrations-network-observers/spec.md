# Feature Specification: Integrations network observers

**Spec ID:** 0010-integrations-network-observers
**Status:** Draft
**Owner:** if
**Domain:** integrations

**Input:** Three connectors observe what a fleet's own assets do not tell: the network devices that answer SNMP, the server management controllers that answer Redfish, and what a site relay received and the controller's receiver kept. Each is a plugin package of the OBSERVE family (0005-integrations-observe, 0008-integrations-plugins): `integrations-snmp`, `integrations-redfish` and `integrations-otel`, each its own folder of commons that imports Integrations by its exports, writes against the read port that cannot write, declares its governance as data and is proved by the conformance suite over recorded, made-up answers. The type of the transport of SNMPv3 and the class `network-device` exist; no code does (audit rows C2 and C3). This specification gives the rules the three share and the requirements of each. It is governed by commons 0041-telemetry-and-reach (audit rows C1 to C8, B6). **No package folder is made by this specification; each is made when it is built, after the owner's acceptance run of the command line.**

## What the three share

- **FR-001**: Each package MUST be a library of commons named `integrations-snmp`, `integrations-redfish` or `integrations-otel` (the convention of `integrations-github`, `integrations-identity`: no Kanon family checks the name, audit row C6), with `group: "integrations"`, its own spec kit numbered from 0001, a manifest with a table of the three layers (governance, logical, physical) as `integrations-identity` has, a line in 0027-commons-libraries when built, and `verify` that runs the shared checker; it MUST import Integrations only by its exports and MUST NOT import another plugin. Relies on audit rows: C6, C1.
- **FR-002**: Each connector MUST be read-only (`writes: "never"`, every grant `read`), MUST hold its credential as a reference `vault://<store>/<name>` with at least one secret field and a hint on each, MUST have a cadence (`every`, `staleAfter`, never over seven days), MUST add to the generic denylist and never remove from it, and MUST pass `conformConnector` over at least one recorded fixture of made-up answers with no finding. Relies on audit rows: C1, C7, C8.
- **FR-003**: The classes MUST be `network-device` for `integrations-snmp` and for `integrations-otel` and `endpoint` for `integrations-redfish` (a management controller of a computer) (OQ-1 holds the choice), and the entity kind MUST be `device`. Relies on audit rows: C2.
- **FR-004**: The generic denylist denies any field whose name contains `address`, `phone`, `token`, `secret` or `password`; a package MUST name the fields it keeps so that none of them is denied by accident (`mac`, `ip`, `host`, `engineId`, `serial`, never `macAddress`) and MUST NOT rename a field to avoid a pattern it is meant to meet: a field that is denied is a gap, not a bypass. The `serial` of a network device or a controller, which is an identity key (estate 0009-estate-sightings FR-004), MAY be kept for these classes only, and the rule of integrations-identity FR-005 (no serial of a person's device) MUST stand for that package. Relies on audit rows: C7, B4.
- **FR-005**: Each package MUST give a pure function from its observation to the `Sighting` of estate 0009-estate-sightings and to the `StoredObservation` of estate (the bridge of audit row B6), and MUST import estate by `@intellectual-frontiers/estate/governance` only; the host `integrations` MUST NOT import estate. Relies on audit rows: B6, B5.
- **FR-006**: An unreadable part MUST be a gap and the rest observed, never a pass, and an unreachable system MUST be an error (integrations-identity FR-006); no payload, community string, passphrase or token MUST appear in a failure, a hint, a trace or a log (0008-integrations-plugins FR-008). Relies on audit rows: C1, C8.
- **FR-007**: Each package's fixtures MUST be synthetic or taken from a published example whose licence allows it; no real address, serial or MAC of a person's or a company's device MUST be in this repository. Relies on audit rows: C8.

## integrations-snmp

- **FR-008**: The package MUST give a `ReadPort` over SNMPv3 whose only operations are `GET` and `GETNEXT` (the plan of 0004-integrations-physical is that and no more), whose type has no way to `SET`, and whose security is `authPriv` (`snmp-v3` of `TransportPolicy`) with an authentication protocol of HMAC-SHA-2 and a privacy protocol of AES; version 1 and 2c, MD5, SHA-1 and DES MUST be refused by the governance as a problem; the engine is discovered, its id kept as the identity key `snmp-engine-id`, and the time window of the USM kept. Relies on audit rows: C3.
- **FR-009**: The port MUST read from a datagram port the caller gives (`DatagramPort`: send a datagram and await the answer within a time), so that the same code runs on the controller where it can reach the device or at a relay inside a program of ours; which of the two is a decision of the product (OQ-2); the encoding of the messages MUST be BER written as data and tested against recorded messages, using the reader of `formats` `der` where it fits and a module of Formats where it does not (UNVERIFIED). Relies on audit rows: C3, H1.
- **FR-010**: A walk MUST be bounded: an allow-list of subtrees as data (the system group, the interfaces table and its extension, the entity table, and the LLDP tables where present), a maximum number of rows, a maximum time and a maximum number of requests per second; an OID outside the allow-list MUST be refused. Relies on audit rows: C3.
- **FR-011**: It MUST observe, for each target, `sysName`, `sysDescr`, `sysObjectID`, `sysUpTime`, the interfaces with their administrative and operational state, and the entity's model, firmware and serial where the device gives them; and give posture facts and policies in the vocabulary of GRC (for example the device answers, the engine id is stable between observations, firmware is known), and MUST NOT make metrics (those come by the relay). Relies on audit rows: C3, A2.

## integrations-redfish

- **FR-012**: The package MUST use the HTTP read port of Integrations (0004-integrations-physical FR-001 to FR-003) with a TLS policy of a pinned certificate (`trust-on-first-use` or `preconfigured`, `decidePin`), because a management controller commonly has a certificate of its own, and MUST declare the session endpoint (`/redfish/v1/SessionService/Sessions`) as the one token endpoint of the read-only contract if it uses a session, or use HTTP basic with the credential reference otherwise. Relies on audit rows: C4, C1.
- **FR-013**: It MUST read the service root (`/redfish/v1/`), `Systems`, `Chassis`, `Managers` and the firmware inventory by the links of the documents (bounded in depth and in the number of members) and observe, for each system, `Model`, `Manufacturer` (as the vendor's text, never a product name in commons code), `SerialNumber`, `UUID`, `PowerState`, `Status.Health`, the firmware versions and the network interfaces' MAC addresses; and MUST drop the `Oem` extensions and every field the denylist denies. Relies on audit rows: C4.
- **FR-014**: The identity keys of a system MUST be its `UUID` as `machine-id` where it is a UUID of the machine, its `SerialNumber` as `serial` and its MACs; the fixtures MUST be made-up documents in the shape of the Redfish schema (UNVERIFIED: not read here). Relies on audit rows: C4, B4.

## integrations-otel

- **FR-015**: The package MUST be a connector whose `ReadPort` reads what the controller's receiver kept (the batches of the queue's store, telemetry 0003-telemetry-reach and anyfs 0011-anyfs-queue, and the sightings of estate), so that the contract stays pull and read-only: it does not listen and it does not receive. Its credential reference MUST be the access to that store (the contract needs one secret field; OQ-3 asks whether it should not). Relies on audit rows: C5, A6.
- **FR-016**: It MUST fold the batches since a watermark kept in the observation into: one device record for each asset or key set seen (from `if.asset.id`, `if.relay.id`, `host.id`, `host.mac`, `host.name`, `host.ip`), the latest value of each host metric with its instant (as posture facts), and, for logs, counts by severity and by a closed list of event classes for each device and window, and MUST keep no log body and no attribute of a log record that is not in the list (the field `body` MUST be denied). Relies on audit rows: C5, A1, C7.
- **FR-017**: It MUST give a sighting for each key set of a relay's batch that no asset holds, with the provenance `relay:<relay id>/<protocol>#<key>` where the protocol is the one the relay recorded in `if.relay.protocol` (UNVERIFIED that the relay's configuration can set it), and MUST resolve keys with `resolveIdentity` of estate, never by a name alone. Relies on audit rows: C5, B4, B8.
- **FR-018**: Observing twice over the same batches and watermark MUST give the same observation (the idempotence that `conformConnector` checks), and a gap in the sequence numbers of a device MUST be a gap of the observation naming the device and the range. Relies on audit rows: C8, A8.

## Conformance

- **FR-019**: Each package's suite MUST run `conformConnector` and MUST add these expectations to its fixtures: the denied fields are absent (`salary`-like cases of the generic list, a `community` or `password` field, a log `body`); an SNMP fixture that tries `SET` or version 2c is refused; a Redfish fixture whose `Oem` section is present gives no `Oem` field; an otel fixture with a log body gives none; each fixture repeats to the same observation; a bridge test shows the sightings and the stored observation are valid for estate. Relies on audit rows: C8, B6.

## Acceptance scenarios

1. **Given** the governance of `integrations-snmp` with version `2c`, **When** it is checked, **Then** it is a problem, per FR-008.
2. **Given** an OID outside the allow-list, **When** the walk reaches it, **Then** it is refused, per FR-010.
3. **Given** a Redfish system document with an `Oem` section, **When** it is observed, **Then** the observation has no `Oem` field, per FR-013.
4. **Given** batches of a relay with a device that no asset holds, **When** they are observed, **Then** one sighting with the relay's provenance is given, per FR-017.
5. **Given** the same batches twice, **When** they are observed, **Then** the two observations are equal, per FR-018.
6. **Given** a log record with a body, **When** it is observed, **Then** the body is not in the observation, per FR-016.
7. **Given** a package that renames `macAddress` to `mac`, **When** the denylist is read, **Then** the field is kept and the rename is stated in the package's spec, per FR-004.

## Out of scope

- The metrics of devices (they come by the relay's receivers, linux-services 0003-linux-services-otel) and any write to a device.
- gNMI, and a native OTLP export by a device: neither is relied on.
- A Kanon family for the plugins of Integrations (OQ-1 of 0041).

## Edge cases

- A device that answers SNMP with a new engine id after a reboot: it is a new key of the same asset where a strong key still matches, never a merge, per estate 0009-estate-sightings FR-005.
- A management controller whose certificate changed: `decidePin` refuses a mismatch, per FR-012.
- A relay that sends a batch twice: the observation is the same, per FR-018.

## Assumptions

- The recorded fixtures are made of exchanges the package's own tests define; none is a capture of a real device.

## Open questions

- **OQ-1**: Is a BMC of class `endpoint` or `network-device` (FR-003)?
- **OQ-2**: Where does the SNMP connector run: the controller on the site's network, or a program of ours at a relay (FR-009)?
- **OQ-3**: May a connector have no secret field, for the one that reads the controller's own store (FR-015)?

## UNVERIFIED

- SNMPv3 USM details (RFC 3414, RFC 7860 SHA-2 authentication, RFC 3826 AES), the Redfish schema and the OCSF class of a device record are not read here; the three packages' use of them is specified from names and not checked.

## Key entities

- **integrations-snmp** - a read-only observer of devices that answer SNMPv3.
- **integrations-redfish** - a read-only observer of management controllers.
- **integrations-otel** - a read-only observer of what the receiver kept.

## Success criteria

- **SC-001**: Every requirement above is proved by a test of this library with synthetic names and no network, or is a row `none` with the note Deferred until the code exists; no row is enforced before it is built.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement names the row of the reuse audit of commons 0041-telemetry-and-reach it relies on
