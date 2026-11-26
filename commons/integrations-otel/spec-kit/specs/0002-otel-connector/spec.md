# Feature Specification: OTel connector

**Spec ID:** 0002-otel-connector
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The controller's receiver keeps the batches that assets and site relays send. Devices that cannot open an SSH connection reach the controller only through a relay, which sends what the devices emit (syslog, SNMP traps and polls, Redfish) as signals with the keys of the device in the resource. This library reads what the receiver kept, read-only and by pull: from the batches since a watermark it makes one device record for each asset or set of keys, the latest value of each of a closed list of host metrics, counts of log records by severity and by a closed list of event classes (never a body or an attribute), and marks a device no asset holds so that the estate reads it as a sighting with the relay and protocol that saw it. It does not listen and it does not receive. It gives effect to commons 0010-integrations-network-observers (the OTel part) and is governed by commons 0041-telemetry-and-reach (audit rows C1, C2, C5, C7, C8, A6, B4, B6).

## Requirements

- **FR-001**: The governance MUST be data of the host library: class `network-device`, entity kind `device`, `writes: never`, one read-only grant for the receiver store, a cadence of five minutes, the transport `local` (a store of our own read with the access of the process, which has no host to reach), a credential made by `localAccess` with one plain field that names the store and no secret field, and a denylist that adds the field `body` and any field that contains `attributes` and removes nothing. Relies on audit rows: C1, C2, C5, C7.
- **FR-002**: The host metrics that are kept MUST be a closed list (`system.uptime`, the three load averages, `system.memory.utilization`, `system.filesystem.utilization` and `if.host.updates.pending`), the severities counted MUST be `trace`, `debug`, `info`, `warn`, `error` and `fatal`, and the classes of event MUST be `probe-gap` for the record `if.probe.gap` and `other` for every other. Relies on audit rows: C5, A1.
- **FR-003**: From the batches since the watermark the connector MUST make one device record for each asset (`if.asset.id`) or set of keys (`host.id` as a machine id and `host.mac`), keep the latest value of each metric of the list by its instant and no other metric, and mark a record held by an asset where the resource names one or where `resolveIdentity` of the estate finds one by a strong key. Relies on audit rows: C5, B4, B8.
- **FR-004**: It MUST count log records by severity and by class and MUST keep no body, no attribute and no text of a record. Relies on audit rows: C5, C7.
- **FR-005**: A record that no asset holds MUST carry the relay (`if.relay.id`) and the protocol the relay recorded (`if.relay.protocol`, where it is one of the protocols of a sighting) in its properties and the keys the estate reads (estate 0009-estate-sightings FR-014), so that the one bridge of estate makes a sighting with the provenance `relay:<relay id>/<protocol>#<key>`; a device is never resolved by a name alone. Relies on audit rows: C5, B4, B8.
- **FR-006**: Observing twice over the same batches and watermark MUST give the same observation; the observation MUST carry the greatest sequence number it saw as the posture fact `watermark`; a batch at or below the watermark MUST NOT be read; and a missing sequence number of a device MUST be a gap that names the device and the range. Relies on audit rows: C8, A8.
- **FR-007**: A store the process may not read MUST be a gap and one that cannot be reached an error; the connector MUST give the posture facts `batches`, `devices`, `devices-silent`, `unidentified-devices`, `sequence-gaps`, `logs-warn`, `logs-error` and `watermark` and the policies `otel-devices-heard`, `otel-no-sequence-gaps` and `otel-devices-identified`, and MUST pass `conformConnector` over recorded, made-up batches. Relies on audit rows: C1, C8.
- **FR-008**: The physical layer MUST give the read port of a folder of kept batches (one JSON document for each batch, named by its sequence number) that reads that folder and no other, never writes, gives the batches above the watermark of the query `since` in order, and leaves out a file that is not a batch. Relies on audit rows: A6, C5.

## Acceptance scenarios

1. **Given** a log record with a body, **When** it is observed, **Then** the body is not in the observation, per FR-004.
2. **Given** batches of a relay for a device that no asset holds, **When** they are observed and bridged, **Then** one sighting with the relay's provenance is made, per FR-005.
3. **Given** the same batches twice, **When** they are observed, **Then** the two observations are equal, per FR-006.
4. **Given** batches 1, 2 and 4 of one device, **When** they are observed, **Then** a gap names the device and the sequence 3, per FR-006.
5. **Given** a watermark of 3, **When** the batches 1 to 5 are observed, **Then** only 4 and 5 are read, per FR-006.

## Out of scope

- Receiving, listening and writing: the receiver is telemetry's (telemetry 0003-telemetry-reach) and this library reads what it kept.
- The metrics of devices as a time series: only the latest value of a closed list is kept.

## Edge cases

- A relay that sends a batch twice: it is the same observation, per FR-006.
- A device silent for more than fifteen minutes is counted in `devices-silent` and the policy warns, per FR-007.

## Assumptions

- The receiver keeps each batch as one JSON document of the shape of the fixtures of this library, named by its sequence number; where the receiver of a product keeps another shape, the product gives this library a read port that gives the same documents.

## Open questions

- None.

## UNVERIFIED

- That a relay's configuration can set `if.relay.protocol` is not run; no receiver of a product was read through this port.

## Key entities

- **Kept batch** - a signal batch the receiver kept, with its sequence number.
- **Device record** - what the receiver's view says of one asset or one set of keys.

## Success criteria

- **SC-001**: What a site relay saw can be read, read-only, into one observation with a sighting for each device no asset holds.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement names the row of the reuse audit of commons 0041-telemetry-and-reach it relies on
