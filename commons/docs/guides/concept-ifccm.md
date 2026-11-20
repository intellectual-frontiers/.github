# Capabilities configuration (IFCCM)

Intellectual Frontiers Capabilities Configuration Management is how change is controlled: the unit of change is a capability, every commit names the issue it serves, and each requirement can be followed from its issue to the test run that proved it ([commons 0020-ifccm](../../spec-kit/specs/0020-ifccm/spec.md)).

What a specification binds, what a Decision authorizes, what a check verifies and what an issue only plans are kept apart. The abbreviation "CCM" is never used alone, because it is also the name of the Cloud Security Alliance's Cloud Controls Matrix.

**Where to see it.** The terms are in the `ifccm:` ontology, and the check is `commons/libraries/src/changes.ts`. The quality records that a change leaves are the quality system's ([IFQS](concept-ifqs.md)).
