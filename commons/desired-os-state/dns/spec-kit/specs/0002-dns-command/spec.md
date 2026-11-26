# Feature Specification: DNS plugin: the commands

**Spec ID:** 0002-dns-command
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** What the plugin does for `desired-os-state dns plan` and `desired-os-state dns apply` over what a fleet gives it: the options of its own and a function that says, for a zone, the records it wants and the provider that holds them.

## Requirements

- **FR-001**: The plugin MUST contribute the branch `dns` with the verbs `plan` and `apply` to the program it is given (`desired-os-state` by default) and take a function that gives, for a zone and the options the person gave, the records wanted and the provider, or a refusal with a code, an exit and the words; a refusal MUST end the command with that exit and name that code, and the options of the fleet's own MUST reach the function.
- **FR-002**: `plan` MUST read the zone only (never a change), say each record to create, update and remove, and print the hash of the plan, ending with 4 where there is something to approve and 0 where the plan is empty.
- **FR-003**: `apply` MUST carry out exactly the plan of the hash it is given and refuse another (`the plan changed`) with nothing changed, and refuse a plan that removes a record unless `--allow-removal yes` is given.
- **FR-004**: After an apply the plan MUST be made again and, where it is not empty, the command MUST end with 1 and say so; a provider that fails MUST end the command with 3 and the reason, with no token in it.
- **FR-005**: The plugin MUST NOT be given a provider that can change a zone: it MUST read through `provider.list` and MUST change a zone only through `change(plan, permit)` with the `Permit<"apply">` that the fleet's `permit` gave for that zone (a value made only by the estate's `permits`, commons estate 0010-estate-boundaries FR-030), so that a call with no permit does not type-check; `apply` MUST ask for the permit before it plans or calls the provider, and a refusal MUST end the command with the fleet's own code, exit and words and with the provider not called; `plan` is a read and MUST ask for none. Relies on audit rows: F2.

## Acceptance scenarios

1. **Given** a zone and the records wanted, **When** `plan` is run and then `apply` with its hash, **Then** the zone has the records and the next plan is empty, per FR-002 to FR-004.
2. **Given** a plan that was approved and a zone that changed since, **When** `apply` is run, **Then** it is refused and nothing changed, per FR-003.

## Out of scope

- The provider, its token and the records themselves: the fleet's, with the library `linux-services`.

## Edge cases

- A record of another owner in the zone: never changed, per FR-002 (the plan of the library `linux-services` removes only the records it claims).
- A removal not approved: refused with 2, per FR-003.

## Assumptions

- The provider answers over the network; a provider that does not is an exit of 3.

## Open questions

- None.

## Key entities

- **Plan hash**, **Zone**, **Provider**.

## Success criteria

- **SC-001**: A zone made as the fleet says has a second plan that is empty.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
