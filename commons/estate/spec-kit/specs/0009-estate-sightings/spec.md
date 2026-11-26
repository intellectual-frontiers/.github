# Feature Specification: Estate sightings

**Spec ID:** 0009-estate-sightings
**Status:** Draft
**Owner:** if
**Domain:** estate

**Input:** A device that cannot be reached is still seen: a site relay receives its syslog, answers its SNMP, reads its NetFlow. An estate has to take that sighting without breaking the rule that a discovered asset is only listed, recognise the same device by the keys it shows (machine id, serial, MAC, SNMP engine id, host key), and let a person promote it. This specification adds the sighting as a document beside the assets, the keys as types, one identity resolution (taken from the enrollment server), the merge rules, the staleness of what is not seen, and the level of an asset. It is governed by commons 0041-telemetry-and-reach (audit rows B1 to B8, B10). **Every requirement that asks for code is Deferred until after the owner's acceptance run of the command line.**

## The sighting

- **FR-001**: A `Sighting` MUST be a typed value `{ id, at, relay, protocol, keys, address?, hostname?, count, provenance }` with `relay` the id of the asset that saw it, `protocol` one of the closed table `syslog`, `snmp`, `netflow`, `redfish`, `prometheus`, `otlp` and `neighbor`, `keys` at least one `IdentityKey`, `count` the number of messages or samples folded into it, and a decoder that refuses what it does not read; a sighting MUST hold no payload (no syslog message, no URL, no user name): only the keys, the address, the host name and the count. Relies on audit rows: B2, B3.
- **FR-002**: `provenance` MUST be present and MUST be written `relay:<relay id>/<protocol>#<key>` (the form of `provenance` of estate-endpoints, B8); a sighting with none MUST be refused (no evidence without attribution, 0003-estate-logical FR-007). Relies on audit rows: B8, B5.
- **FR-003**: Sightings MUST be documents of the fleet store at `sightings/<relay>/<instant>.json` beside the assets and observations (0005-estate-fleet-documents), written once as an observation is (0006-estate-fleet-store FR-004), and MUST NOT be an observation of an asset: a discovered asset still offers nothing and nothing about it is recorded as its own (0002-estate-governance FR-002 and `OFFERED` stand as they are). Relies on audit rows: B3, B5.

## Identity

- **FR-004**: An `IdentityKey` MUST be the closed union `machine-id`, `serial`, `mac`, `snmp-engine-id` and `host-key`, each made only by a smart constructor that normalises it (a MAC lower case with colons and not broadcast or multicast, a machine id 32 hexadecimal digits, an SNMP engine id hexadecimal, a host key `SHA256:` and 43 characters, a serial trimmed and not empty), and each with a strength: `machine-id`, `serial`, `snmp-engine-id` and `host-key` are strong, `mac` is weak (a clone repeats it). Relies on audit rows: B4.
- **FR-005**: `resolveIdentity(keys, known, options)` MUST be a pure total function giving `new`, `adopt { assetId, matchedOn }`, `candidate { assetId, matchedOn }` or `conflict { assetIds }`: no key found is `new`; one asset found by at least one strong key is `adopt`; one asset found by weak keys only is `candidate` (a person confirms) unless `weakAdopts` is true, which gives `adopt` and is how the enrollment server keeps its behaviour; two or more assets found is `conflict`. Relies on audit rows: B4.
- **FR-006**: A resolution MUST never merge by itself: `adopt` names the asset a sighting belongs to and adds its keys to the asset's keys by a person's approval or by the rule of an enrollment (ssh-server 0003 FR-011); the keys of an asset MUST only grow, and a key that two assets hold MUST be a finding that a person settles. Relies on audit rows: B4, E8.
- **FR-007**: The keys of a sighting MUST resolve against the keys of the assets and against the keys of other sightings, so that a device seen by two relays by two protocols is one seen asset; the id of a seen asset MUST be derived from its strongest key (`device-` and the MAC without colons for a MAC, as `deviceIdOf` makes it today, and a short digest of the key for another), so that it is stable. Relies on audit rows: B2.

## What is seen and what is not

- **FR-008**: `foldSightings(sightings)` MUST give, as a pure function, one `SeenAsset` for each resolved set of keys: its keys, the first and last instant, the count, the relays and the protocols; and `unexpectedSightings(declared, seen)` MUST extend `unexpectedDevices` to every key, giving the assets seen that nobody declared with the provenance of each, and the assets declared and covered by a relay that were not seen within their window. Relies on audit rows: B2, B8.
- **FR-009**: An asset that depends on a relay MUST be `stale` (by `freshness` of `grc`) when it was not seen within the `staleAfter` of its cadence, and MUST NOT be failed, and a relay that is itself stale MUST make the assets behind it `unknown` and not stale (the assets' silence is then not evidence). Relies on audit rows: B7.
- **FR-010**: Sightings older than the window of the capture policy (`CapturePolicy` gains `sightings: { keep }`, an ISO duration, default `P30D`) MUST be folded into their `SeenAsset` and removed, and the folded record MUST be kept by the journal. Relies on audit rows: B7.

## Promotion and level

- **FR-011**: A `discovered` asset made from sightings MUST become `adopted` only by `moveState` with an approval of a person that names, by hash, the sightings the person looked at (the hash of the sorted sighting ids and keys); `managed` MUST NOT be offered for an asset of level `1`, which has no owner for `converge` and `provision` (a move to managed needs an owner for every capability it offers, 0003-estate-logical FR-001). Relies on audit rows: B1.
- **FR-012**: `levelOf({ identified, sshOut, osquery })` MUST be the total function of commons 0041-telemetry-and-reach FR-001 and `missingMinimums` that of FR-011 there, in the logical layer, with an exhaustive `switch` over `AssetLevel`. Relies on audit rows: B1, D1.
- **FR-013**: The origin of an asset adopted from sightings MUST be `scan` as `ORIGINS` already says (an asset seen on the network and adopted from the list of what was found); no new origin MUST be added. Relies on audit rows: B1.

- **FR-014**: From an observation of the shape every connector of Integrations makes, given as a structural type so that estate imports no connector, estate MUST give the pure functions `keysOfProps` (the keys of the properties `machineId`, `serial`, `engineId`, `mac` and `hostKey` of a record, each made by the smart constructor of its kind, the strongest first, none twice, a property that is not a key of its kind left out), `sightingsOf` (one sighting for each record labelled `device` that has at least one key and no property `asset`, with the provenance of the strongest key, the relay and the protocol the record names in its properties `relay` and `protocol` where it names them, and none for a device with no key or one an asset holds) and `storedOf` (the observation of one asset as a stored observation document), so that the connectors of devices (integrations 0010-integrations-network-observers FR-005) share one bridge. Relies on audit rows: B4, B6.

## Acceptance scenarios

1. **Given** a syslog sighting with a MAC that no asset has, **When** the sightings are folded and compared with the declared assets, **Then** it is an unexpected seen asset with provenance `relay:<id>/syslog#<mac>`, per FR-002 and FR-008.
2. **Given** a sighting by SNMP with an engine id and one by NetFlow with the MAC of the same device and a sighting by syslog that has both, **When** they resolve, **Then** they are one seen asset, per FR-007.
3. **Given** two assets that both hold a host key, **When** a sighting shows it, **Then** the resolution is `conflict`, per FR-005 and FR-006.
4. **Given** a sighting with a MAC alone that matches one asset, **When** it resolves with `weakAdopts` false, **Then** it is a `candidate`, per FR-005.
5. **Given** a relay not heard for longer than its window, **When** the assets behind it are judged, **Then** they are `unknown`, not stale, per FR-009.
6. **Given** a discovered asset of level 1, **When** a move to `managed` is asked, **Then** it is refused for want of owners, per FR-011.
7. **Given** a syslog line with a user name and a URL, **When** it becomes a sighting, **Then** neither is in the record, per FR-001.

## Out of scope

- Receiving the sighting: a relay and the connectors of integrations 0010-integrations-network-observers.
- Merging two assets (a typed event that a person approves) is named, not built here.

## Edge cases

- A device whose MAC changes: it is a new key of the same asset where a strong key still matches, per FR-005.
- A key that two sightings of one relay show for two devices (a gateway's MAC seen for the hosts behind it): weak and `candidate` only, never `adopt`, per FR-004 and FR-005.

## Assumptions

- A relay gives the keys the device itself presented and nothing derived from a name.

## Open questions

- None here; OQ-2 of commons 0041-telemetry-and-reach (a separate role to approve).

## Key entities

- **Sighting** - one record that a relay saw a device by a protocol.
- **IdentityKey** - a machine id, serial, MAC, SNMP engine id or host key, with a strength.
- **SeenAsset** - what the sightings of one device fold to.

## Success criteria

- **SC-001**: Every requirement above is proved by a test of this library with synthetic names and no network, or is a row `none` with the note Deferred until the code exists; no row is enforced before it is built.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement names the row of the reuse audit of commons 0041-telemetry-and-reach it relies on
