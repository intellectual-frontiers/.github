# Feature Specification: Estate Iac: what an importer gives

**Spec ID:** 0002-estate-iac-model
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The shape of what an importer of infrastructure as code gives: assets and links of the estate, each asset with where it came from, and the rules that make an identity and a link.

## Requirements

- **FR-001**: An importer MUST give assets of the kinds of the estate's catalog (commons estate 0007-estate-kinds), each with its attributes and, among them, `provenance`, as `tool:file#address`, which says the tool, the file and the address of the resource in it; and links between the identities of the assets it gives. An imported asset MUST be accepted by the estate as a discovered asset: reading code adopts nothing.
- **FR-002**: An identity MUST be made from words as lower case letters and digits joined by hyphens, starting with the tool's prefix (`tf`, `cfn`, `k8s`, `compose`, `pulumi`) so that it starts with a letter, at most 100 characters; two assets that make one identity MUST be given the first free one (`-2`, `-3`).
- **FR-003**: A link MUST be named by the kinds of its ends where the first needs the second: an endpoint that needs a cloud resource is exposed by it (`exposes`, from the resource), an endpoint or a name that needs a certificate is secured by it (`secured-by`), a name that needs an endpoint or a resource resolves to it (`resolves-to`), and any other is a dependency (`depends-on`); a link that repeats or joins an asset to itself MUST be dropped.

## Acceptance scenarios

1. **Given** the words `aws_instance.web[0]`, **When** an identity is made, **Then** it is `tf-aws-instance-web-0`, per FR-002.
2. **Given** a listener that needs a load balancer, **When** the link is made, **Then** it is `exposes` from the balancer to the listener, per FR-003.

## Out of scope

- Reading any file: the importers (0003-estate-iac-importers).

## Edge cases

- Two resources whose addresses make the same identity are kept apart, per FR-002.

## Assumptions

- None.

## Open questions

- None.

## Key entities

- **Imported asset**, **Provenance**, **Link**.

## Success criteria

- **SC-001**: The tests of the library pass.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
