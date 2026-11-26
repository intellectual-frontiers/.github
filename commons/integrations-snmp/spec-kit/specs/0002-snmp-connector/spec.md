# Feature Specification: SNMP connector

**Spec ID:** 0002-snmp-connector
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A site has network devices that answer SNMPv3 and no agent. This library reads them, read-only, from the controller where it can reach them or from a program of ours at a site relay (a decision of the product): the messages and the user-based security model of SNMPv3 with HMAC-SHA-2 authentication and AES-128 privacy as pure functions over a datagram port, a session that discovers the engine and makes only `GET` and `GETNEXT`, a read port with a bounded walk of an allow-list of subtrees, and a connector of Integrations that observes the name, description, uptime, interfaces and entity of a device, gives its posture in the vocabulary of GRC and its identity keys for the estate. It gives effect to commons 0010-integrations-network-observers (FR-001 to FR-011 of its SNMP part) and is governed by commons 0041-telemetry-and-reach (audit rows C1 to C3, C7, C8, B4, B6).

## Requirements

- **FR-001**: The governance MUST be data of the host library: class `network-device`, entity kind `device`, `writes: never`, one read-only grant for each allowed subtree, a credential reference `vault://snmp/<site>-read` with a plain field `user` and the secret fields `authPassword` and `privPassword`, each with a hint, a cadence of one hour, the transport `snmp-v3` at the level `authPriv`, and a denylist that adds nothing and removes nothing. Relies on audit rows: C1, C3, C7.
- **FR-002**: A security setting MUST be a problem where the version is not `3`, where the authentication protocol is not one of HMAC-SHA-224, -256, -384 and -512, or where the privacy protocol is not AES-128; version 1 and 2c, MD5, SHA-1 and DES MUST be refused. Relies on audit rows: C3.
- **FR-003**: A walk MUST be bounded by an allow-list of subtrees as data (the system group, the interfaces table, its extension, the entity table and the LLDP tables), an object identifier outside it MUST be refused, and the bounds (rows, milliseconds, requests each second) MUST be data with a default. Relies on audit rows: C3.
- **FR-004**: The encoding of the messages MUST be BER written as a closed union with a total `encode` and a `decode` that returns the reason it is not one value (a truncated value, a length that is not definite or is over four octets, a trailing octet, an object identifier that does not end, an unknown tag), and a value MUST read back as it was written. Relies on audit rows: C3.
- **FR-005**: The user-based security model MUST be pure functions over a port of primitives (a hash, an HMAC and AES-128 in cipher feedback mode): the key of a password is the hash of one mebibyte of it, the key of an engine is the hash of the key, the engine id and the key, a password shorter than eight characters is refused, a request is enciphered then authenticated with the digest of the protocol in place of zeros, and an answer is accepted only if it is in the form `encode` makes and its digest is right, and is deciphered only after that. Relies on audit rows: C3.
- **FR-006**: A session MUST discover the engine id, boots and time of the device, make only `get` and `getNext` (the type of a request has no `SET`, no bulk request and no inform, and a session has no other operation), follow a report that the request is late with the time the engine gave, and say why a request failed (unreachable, refused as an unknown user, a wrong digest, a decryption error, an unsupported level, a status of the answer) with no password, key or octet of the exchange in it. Relies on audit rows: C3.
- **FR-007**: The read port MUST give `get` of one object and `pages` as a walk that stays under the root it was given and inside the allow-list, ends at the first object outside either, at the bounds, or at the end of the view, spaces its requests by the bound of requests each second, and sends nothing for a path outside the allow-list. Relies on audit rows: C3.
- **FR-008**: The connector MUST observe `sysName`, `sysDescr`, `sysObjectID`, `sysUpTime`, the interfaces with their description, hardware address and administrative and operational state, and the model, firmware and serial of the chassis entity where the view gives them; MUST give the posture facts `device-answers`, `firmware-known`, `interfaces`, `interfaces-down-unexpectedly`, `uptime-seconds` and `has-description` and the policies `snmp-device-answers`, `snmp-firmware-known` and `snmp-interfaces-up`; and MUST make no metric. Relies on audit rows: C3.
- **FR-009**: The record of a device MUST carry the properties `engineId`, `serial` and `mac` that estate 0009-estate-sightings FR-014 reads, so that the keys, the sighting and the stored observation of a device are made by the one bridge of estate and not by this library. Relies on audit rows: B4, B6.
- **FR-010**: A part the view does not give MUST be a gap with the rest observed and its fact absent or false, never a pass; a device that gives not even its name MUST be an error; and no payload, community, password or key MUST be in a failure, a hint or a record. Relies on audit rows: C1, C8.
- **FR-011**: The connector MUST pass `conformConnector` over a recorded, made-up device with no finding, and MUST observe the same twice. Relies on audit rows: C8.

## Acceptance scenarios

1. **Given** version `2c` or a privacy protocol `des`, **When** the setting is read, **Then** each is a problem, per FR-002.
2. **Given** an object identifier outside the allow-list, **When** the read port is asked for it, **Then** it is refused and nothing is sent, per FR-007.
3. **Given** a request that is late, **When** the engine reports the time, **Then** the session sends it again with that time, per FR-006.
4. **Given** an answer with one octet changed, **When** it is opened, **Then** it is refused before it is deciphered, per FR-005.
5. **Given** a switch with one interface administratively up and operationally down, **When** it is observed and checked, **Then** the policy of interfaces warns, per FR-008.
6. **Given** a view with no entity table, **When** it is observed, **Then** the firmware is not known and the policy warns, per FR-010.

## Out of scope

- Writing to a device, SNMP versions 1 and 2c, traps and informs, bulk requests, and any authentication or privacy protocol that is not of FR-002.
- The metrics of devices, which the relay's receivers give.
- Reading the LLDP tables: they are allowed in a walk and the connector does not read them yet.

## Edge cases

- A device that restarts and has a new engine id: the new id is a new key of the same asset where a strong key still matches, never a merge (FR-009).
- A device with an empty entity table: the firmware is unknown and the policy warns, per FR-010.
- A hardware address of zeros is not a key: the record has no `mac` and the estate reads none (FR-009).

## Assumptions

- The privacy key is the first sixteen octets of the localized key (RFC 3826), and a protocol with a key shorter than that is not allowed.

## Open questions

- None.

## UNVERIFIED

- It was run against one agent (net-snmp 5.9.4 with SHA-256 and AES-128) and against an agent written for the tests, and against no other device; the LLDP tables and the entity table of a device that has one were not read.

## Key entities

- **Session** - a discovered engine and the keys of a user at it.
- **Read port** - get and a bounded walk over a session.

## Success criteria

- **SC-001**: A network device that answers SNMPv3 can be read, read-only, into one observation with its identity keys, with no agent on it.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement names the row of the reuse audit of commons 0041-telemetry-and-reach it relies on
