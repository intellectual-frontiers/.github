# Feature Specification: Estate Endpoints: the readers

**Spec ID:** 0003-estate-endpoints-readers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Finding the endpoints of an estate from OpenAPI and GraphQL descriptions, Android and iOS manifests, DNS zone files, certificates and the ports a machine reports it listens on. The readers read text and files and reach no network.

## Requirements

- **FR-001**: The OpenAPI reader MUST read OpenAPI 3 and Swagger 2 descriptions as JSON or YAML and give an endpoint (`api: openapi`) for each server (a templated address takes the default of its variable), with the authentication the description declares (`none` where it declares no security, otherwise the strongest of the schemes it uses: basic, token, session, oauth, mtls), and a problem for a server that is not an absolute address; it MUST NOT read operations or schemas.
- **FR-002**: The GraphQL reader MUST read a schema or an introspection, and, because a schema does not say where it is served, give the endpoint (`api: graphql`, authentication unknown) only at an address it is given, and otherwise say so as a problem.
- **FR-003**: The Android reader MUST read a manifest and give the app (the package, the oldest system, whether it allows traffic in the clear where the manifest says) and an endpoint for each web address its deep links claim, linked to the app (`client-of`).
- **FR-004**: The iOS reader MUST read an `Info.plist` as XML and give the app (the bundle identifier, the oldest system), set it to allow the clear where App Transport Security allows arbitrary loads or an exception domain allows insecure ones, and give an endpoint in the clear for each such domain, linked to the app.
- **FR-005**: The zone reader MUST read the master file format (with `$ORIGIN`, `$TTL`, records over several lines in parentheses, a missing owner as the one before, and comments) and give a domain for each name that owns a record, signed where the apex has a DNSKEY, and a dependency for each CNAME to another name of the zone; it MUST NOT copy addresses or text.
- **FR-006**: The listening-ports reader MUST read `ss -tuln` text and osquery's `listening_ports` rows and give an endpoint for each port with the common service its port usually carries and its protocol, `internal` where it is bound to the loopback and no exposure where it is bound to every address, linked from the machine (`exposes`) where the machine is named.
- **FR-007**: The certificate reader MUST give an asset of the kind certificate for each certificate (its subject, names, issuer, the day it ends and its key), and the files reader MUST link each endpoint that speaks over TLS to the certificate that covers its host, a wildcard name covering exactly one label.
- **FR-008**: The reader of a text MUST be chosen by what is in it, and a text no reader reads MUST be a problem and no asset.
- **FR-009**: Reading paths MUST read a file given by name (a problem where no reader reads it) and walk a folder, skipping without a word what no reader reads and the folders of tools, read the certificates of a PEM, link certificates to endpoints, and, where two files give one identity, keep the first and say so once for each file.

## Acceptance scenarios

1. **Given** an OpenAPI description with a bearer scheme, **When** it is read, **Then** its endpoint has the authentication `token`, per FR-001.
2. **Given** a manifest with an https deep link, **When** it is read, **Then** the app is linked to the endpoint, per FR-003.
3. **Given** a certificate for `*.example.test` and an https endpoint at `api.example.test`, **When** the files are read, **Then** the endpoint is secured by the certificate, per FR-007.

## Out of scope

- Fetching a description, a zone or a certificate from the network, and scanning a machine for its ports: the owner makes the files.
- Reading operations, schemas, permissions and components.

## Edge cases

- A binary property list is not read; the problem says how to convert it, per FR-004.

## Assumptions

- The ports a machine reports were reported by the machine itself, with the right to ask it (spec commons estate-query 0005-estate-query-live).

## Open questions

- None.

## Key entities

- **Reader**, **Endpoint**, **Certificate**.

## Success criteria

- **SC-001**: The tests of the library pass, with every asset accepted by the estate.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
