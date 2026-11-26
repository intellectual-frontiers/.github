# Feature Specification: Redfish connector

**Spec ID:** 0002-redfish-connector
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A server has a management controller that answers Redfish over HTTPS with JSON, whether or not the server runs an operating system we can reach. This library reads it, read-only: from the service root it follows the links of the documents (systems, chassis, managers and the firmware inventory), bounded in depth and in members, and observes for each system its model, serial, UUID, power state, health, BIOS version and the hardware addresses of its interfaces, drops the vendor extensions, gives its posture in the vocabulary of GRC and its identity keys for the estate. A management controller is of the class `network-device`. It gives effect to commons 0010-integrations-network-observers (the Redfish part) and is governed by commons 0041-telemetry-and-reach (audit rows C1, C2, C4, C7, C8, B4, B6).

## Requirements

- **FR-001**: The governance MUST be data of the host library: class `network-device`, entity kind `device`, `writes: never`, a read-only grant for each of the collections it follows, a credential reference `vault://redfish/<site>-read` with a plain field `user` and the secret field `password`, each with a hint, a cadence of one day, the transport `https` to the hosts given with a pinned certificate (trust on first use unless a digest is given), no token endpoint, and a denylist that adds `Oem` and any field that contains `credential` and removes nothing; a host that is not a name MUST be refused. Relies on audit rows: C1, C2, C4, C7.
- **FR-002**: A path MUST be asked for only if it is under `/redfish/v1/`, has no query and no `..`, and is at most 256 characters; the bounds of the walk (depth and members of a collection) MUST be data. Relies on audit rows: C4.
- **FR-003**: The connector MUST read the service root and follow, by the links of the documents, `Systems`, `Chassis`, `Managers` and `UpdateService` with its `FirmwareInventory`, and MUST observe for each system its `Model`, `Manufacturer` (as the vendor's text), `SerialNumber`, `UUID`, `PowerState`, `Status.Health`, `BiosVersion` and the hardware address of its first network interface, and the firmware versions of the managers and the inventory; it MUST drop every `Oem` extension and every field the denylist denies. Relies on audit rows: C4, C7.
- **FR-004**: It MUST give the posture facts `controller-answers`, `systems`, `systems-unhealthy`, `systems-power-off`, `firmware-known` and `firmware-items` and the policies `redfish-controller-answers`, `redfish-systems-healthy` and `redfish-firmware-known`, and MUST read no more than the bound of members of a collection. Relies on audit rows: C4, C1.
- **FR-005**: The record of a system MUST carry the properties `machineId` (the UUID without its dashes, where it is one), `serial` and `mac` that estate 0009-estate-sightings FR-014 reads, so that the keys, the sighting and the stored observation are made by the one bridge of estate. Relies on audit rows: B4, B6.
- **FR-006**: A document that cannot be read MUST be a gap with the rest observed, a controller that does not answer MUST be an error, and no payload, password or token MUST be in a failure or a record. Relies on audit rows: C1, C8.
- **FR-007**: The connector MUST pass `conformConnector` over a recorded, made-up controller with no finding. Relies on audit rows: C8.
- **FR-012**: The physical layer MUST give the read port of a controller over the HTTP read port of Integrations with HTTP basic authentication made from the credential, on the transport the caller gives (where the certificate pin is kept), and no write MUST be possible through it. Relies on audit rows: C4, C1.

## Acceptance scenarios

1. **Given** a system document with an `Oem` section, **When** it is observed, **Then** the observation has no `Oem` field, per FR-003.
2. **Given** a system whose health is `Critical`, **When** it is checked, **Then** the policy of health fails, per FR-004.
3. **Given** a manager collection that is denied, **When** it is observed, **Then** a gap names it and the systems are observed, per FR-006.
4. **Given** a collection of more members than the bound, **When** it is observed, **Then** no more than the bound are read, per FR-004.

## Out of scope

- Writing to a controller, sessions and tokens, events and the telemetry service of Redfish, and the metrics of a controller.
- A controller of a vendor that does not follow the links of the schema.

## Edge cases

- A UUID that is not 32 hexadecimal digits without its dashes is not a key and the record has no `machineId` (FR-005).
- A controller whose certificate changes: the pinned transport the caller gives refuses it (FR-012).

## Assumptions

- The made-up documents are in the shape of the Redfish schema as named in its specification; none is a capture of a controller.

## Open questions

- None.

## UNVERIFIED

- The Redfish schema is not read here and no real controller was read; the pinned transport is the caller's, and a certificate pin on Bun and Node 26 was not run against a controller.

## Key entities

- **Controller** - a management controller that answers Redfish.

## Success criteria

- **SC-001**: A management controller that answers Redfish can be read, read-only, into one observation with its identity keys.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement names the row of the reuse audit of commons 0041-telemetry-and-reach it relies on
