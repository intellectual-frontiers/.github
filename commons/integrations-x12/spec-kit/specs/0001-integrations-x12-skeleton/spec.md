# Feature Specification: Integrations X12 skeleton

**Spec ID:** 0001-integrations-x12-skeleton
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** X12 is the second standards plugin of Integrations, here a skeleton: the envelope and the acknowledgements, with the schemas of the transaction sets read from the licensed copy of the user and never embedded (X12 sells its standards and guides). The HIPAA 5010 transaction sets 837, 835, 270, 271 and 834 and the purchasing sets 850, 810 and 856 are listed as entries; their segment-level schemas and loops are Planned.

## Requirements

- **FR-001**: The plugin MUST register X12 and the transaction sets 837, 835, 270, 271, 834, 850, 810 and 856 with a licence as data that is `user-supplied` and cites X12 as the seller, and MUST embed no content of any set, guide or companion guide (`EMBEDDED` is empty and a file declared embedded is refused by the publication gate).
- **FR-002**: The codec MUST read the fixed-width ISA (106 characters, the element separator at position 3 and the segment terminator at position 105, each of the sixteen elements of its width) and the GS and ST levels into an interchange of groups of transactions that keep their envelope segments, and MUST write the same text back.
- **FR-003**: The plugin MUST pass `conformPlugin` of Integrations over made-up interchanges and garbage.
- **FR-004**: A text that is not an X12 interchange (not starting with ISA, another delimiter, a width that is wrong, an unbalanced or unfinished envelope) MUST be a syntax failure with a code and an offset that holds no part of the text.
- **FR-005**: The control counts MUST be checked as findings that hold paths and codes only: IEA01 against the groups, IEA02 against ISA13, GE01 against the transactions, GE02 against GS06, SE01 against the segments and SE02 against ST02.
- **FR-006**: A TA1 and a 999 MUST be made from a received interchange (the receiver and the sender swapped) with status A, E or R, written, read back with the same status, and carry no value of the received payload; the loader MUST read a segment list from the user's own transcription of a licensed guide only from a source the licence allows, into a schema that validates a transaction.

## Acceptance scenarios

1. **Given** the synthetic fixtures of the suite, **When** the conformance suites of Integrations run over this plugin, **Then** they find nothing, per FR-001.

## Out of scope

- Everything the plugin does not list above: Planned, and specified in commons integrations 0007-integrations-standards where it is a standard.

## Edge cases

- A fixture that would be real data: never, every fixture is made up, per FR-001.

## Assumptions

- Loops, the HL structure of the 837, composites and the detailed TA1 and 999 codes are Planned; fixtures are made up, never real claims or people.

## Open questions

- None.

## Key entities

- **Integrations X12** - the plugin.

## Success criteria

- **SC-001**: The plugin passes the conformance suite of Integrations.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
