# Feature Specification: Estate kinds, links and common services

**Spec ID:** 0007-estate-kinds
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The estate describes more than machines: the cloud resources, endpoints, applications and mobile apps of an organization, and the services found on them. Their kinds carry typed attributes, the links between assets have names, and the common network services are a catalog, so that a scope, a check or a query can say the same thing every time.

## Requirements

- **FR-001**: The estate MUST carry a catalog of the kinds of asset that have typed attributes: `cloud-resource`, `endpoint`, `application`, `mobile-app`, `service`, `domain` and `certificate`; for each attribute its type (a string, a number, a boolean or a list of strings), whether it is required and, for a string, the values it may have. The catalog MUST only grow: a kind or an attribute is added, never renamed or removed.
- **FR-002**: An asset MUST be refused when the attributes it states are not right for its kind: an attribute the kind does not have, a required one that is missing, one of the wrong type, or a string that is not one of the values listed. A kind that is not in the catalog (`server`, `workstation`, `device`) MUST accept any word as before and MUST need no attributes.
- **FR-003**: The estate MUST name its kinds of link: `runs-on`, `exposes`, `depends-on`, `resolves-to`, `secured-by` and `client-of`, each with the kinds of asset it may start at and end at; `defineEstate` MUST refuse a link of a named kind whose ends are not of those kinds, and MUST allow a link whose kind is not named, unchecked.
- **FR-004**: The estate MUST carry a catalog of the common services (by name: the transport, the usual port, a class in the estate's own words, whether it speaks in the clear), and an endpoint or a service that names a service MUST name one of the catalog.
- **FR-005**: The attributes MUST be stored in the asset document as an optional field, so that a document written before they existed still decodes with none, an asset with attributes is written and read back with them, and a stored attribute that is not right for its kind is a finding and never read as the asset.

## Acceptance scenarios

1. **Given** an endpoint with a scheme, a host and a port, **When** it is defined, **Then** it is accepted, and one with no host is refused, per FR-002.
2. **Given** a `runs-on` link from a server to an application, **When** the estate is defined, **Then** it is refused, per FR-003.
3. **Given** an asset document with no attributes, **When** it is read, **Then** it decodes, per FR-005.

## Out of scope

- Reading infrastructure as code, discovering endpoints and testing them: later specs build on this vocabulary.
- Links in the stored fleet documents: they stay in the typed estate for now.

## Edge cases

- A link whose end is not an asset is refused as before, and the kinds of its ends are checked only where both ends exist, per FR-003.

## Assumptions

- The ports and protocols of the services are the facts of their standards; the classes are the estate's own words and may be refined by adding, per FR-001.

## Open questions

- None.

## Key entities

- **Kind**, **Attribute**, **Link kind**, **Service**.

## Success criteria

- **SC-001**: The tests of the library pass, and the documents written before the attributes decode.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
