# Feature Specification: Linux Services profiles

**Spec ID:** 0002-linux-services-profiles
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The services that a Linux machine of a small fleet runs (a PostgreSQL cluster, a send-only mail relay, a certificate from an ACME authority, the DNS records of a name, the keys that may call a tool server over ssh) said as typed profiles that are checked, and from which the requirements of Desired OS State are made over the kinds it already has (package, directory, file, service).

## Requirements

- **FR-001**: Each profile (`PostgresProfile`, `MailRelayProfile`, `CertificateProfile`) MUST be parsed by a function that returns every reason it is refused and a value only where there is none; a name, a port, a host name, a domain and a mailbox MUST each be checked against its own rule.
- **FR-002**: A profile MUST NOT carry a secret: a field that looks like one (as `findSecretLike` of Desired OS State decides) MUST be refused, and each rendered file MUST name the path on the machine where the secret is put (an API token of the relay, of the DNS provider), never the secret.
- **FR-003**: `postgresRequirements` MUST give the requirements of the cluster that Ubuntu's own package makes (`<version>/main`): the package `postgresql-<version>`, a drop-in `conf.d/50-desired-os-state.conf` that sets the port, the addresses it listens on and the settings of its logs, and the service `postgresql@<version>-main` running and enabled; the cluster is Ubuntu's, so that Desired OS State adds a file and does not make a cluster of its own.
- **FR-004**: `mailRelayRequirements` MUST give the requirements of a send-only Postfix: the package `postfix`, the `main.cf` that receives nothing from the network (loopback only), delivers nothing locally and relays everything over implicit TLS to the relay host with SASL, the maps that make every sender `<user>+<host>.<tag>@<domain>` and send every local recipient to the mailbox, and the service `postfix` running and enabled.
- **FR-005**: `certificateRequirements` MUST give the requirements of a machine that obtains and renews a certificate by DNS-01 from an ACME authority with Ubuntu's own `certbot` and its DNS plugin: the packages, the `cli.ini`, the folder of the credentials (the file itself is the secret and is not in the model), a unit that issues the certificate once where it is not yet there, and the timer of renewal enabled.
- **FR-006**: Every requirement of a profile MUST be accepted by `defineRequirement` of Desired OS State, MUST say why it holds (the profile and the controls it answers), MUST depend on the requirements it needs (the package before its files, the files before the service) and MUST name the same subject; the ids MUST be stable, `services.<service>.<part>`.
- **FR-007**: The records of a DNS zone MUST be said as data (`DnsRecord`: type, name, content, ttl, proxied); `planDns` MUST give, from the records wanted and the records found, the records to create, to update and to remove, and MUST remove only the records the profile claims (a name it lists, or a record that carries its marker), never the rest of the zone.
- **FR-008**: A DNS provider MUST be a port (`DnsProvider`: list and apply); the Cloudflare provider MUST read and write the zone over HTTPS with the token it is given, MUST page through the list, MUST send no token to any address but the one it was made for and MUST put the token in no error and no log.
- **FR-009**: `mcpAccessRequirements` MUST give the requirements of a machine that serves a program as a tool server over ssh (MCP): the private `.ssh` folder of the account and its `authorized_keys`, made by the generator of the ssh-inbound surface of Headless so that each key forces `<program> mcp` (with `--read-only` for a key that may only read) under `restrict`, and a key that is not one public key line (a private key, a line with options or a name that could break out of the quotes) MUST be refused with the reason; no key is a secret and none is generated here.

## Acceptance scenarios

1. **Given** a profile with a port of 70000, **When** it is parsed, **Then** it is refused with the reason, per FR-001.
2. **Given** a mail profile that has a token in its relay field, **When** it is parsed, **Then** it is refused, per FR-002.
3. **Given** the profile of PostgreSQL 18, **When** its requirements are made, **Then** each is valid, ordered and for the one subject, per FR-003 and FR-006.
4. **Given** a records set and a zone that holds the records of others, **When** it is planned, **Then** only the records of the profile change, per FR-007.
5. **Given** two keys, one that may only read, **When** the access is made, **Then** each line forces the program and `restrict`, and a private key is refused, per FR-009.
6. **Given** a Cloudflare API on a local socket, **When** the provider applies a plan, **Then** the records are as wanted and the token went in the header only, per FR-008.

## Out of scope

- The databases and roles of PostgreSQL, the DKIM of the sending domain and the creation of a DNS zone: each is a change that the kinds of Desired OS State do not have yet.
- Running the programs: the dialect converges, and `linux-observe` observes.

## Edge cases

- A port below 1024 for PostgreSQL: refused, per FR-001.
- A relay host that is an address with a path or a scheme: refused, per FR-001.
- A record of another owner with the name of one the profile lists: updated only where it carries the marker or the profile lists its exact name, per FR-007.
- A page of the provider that fails: the plan is not made, per FR-008.

## Assumptions

- The machine is Ubuntu 26.04 (PostgreSQL 18) or later; a version of the profile that the archive has not is the archive's refusal when the package is installed.

## Open questions

- None.

## Key entities

- **Profile** - the typed description of one service.
- **DnsProvider** - the port to the DNS of a name.

## Success criteria

- **SC-001**: A machine made as the requirements of its profiles say runs PostgreSQL, a send-only mail relay and a certificate timer, with no secret in the model, and a second plan of Desired OS State over it is empty.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
