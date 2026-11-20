# I need to check the evidence

Every claim a library makes is a requirement in a specification, and every requirement has a recorded way of being checked.

- **The traceability matrix** lists every requirement with its mechanism (a check, a gate, or a review), who runs it and a note. Open it from the Specifications section.
- **A specification's page** shows each requirement with its enforcement beside it, and which pages cite it.
- **The record of a run.** A test run is kept as evidence: one OpenTelemetry record per run, its reports (TAP, JUnit, SARIF, OSCAL), and a signed, chained ledger entry. What the evidence is worth is graded; see the Quality library and [the quality system](concept-ifqs.md).
- **The register as OSCAL.** The proof register of the specifications is written as OSCAL in `commons/generated/`, and checked for staleness.
- **Change control.** Each commit names the issue it serves, and each requirement can be followed from its issue to the test run that proved it; see [capabilities configuration](concept-ifccm.md).

**Your first small task:** pick any requirement in the traceability matrix, open its specification, find the test named in its enforcement row, and confirm the test file starts with a `// Spec:` line that names it.
