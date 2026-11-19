# Feature Specification: Modules

**Spec ID:** 0028-modules
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** Arca (0004-arca) is one domain. A general-purpose business model is many subject areas (people and organisations, tenancy, identity, products, orders, agreements, billing, ...), and a project wants some of them, not all: a project that invoices by hand needs billing and not subscriptions; one that has no login system needs no identity. A module is one subject area as a value: a name, the modules it requires, and its concepts and code lists, which may refer to the concepts of the modules it requires and so cannot be a validated domain by itself. A project composes the modules it lists into one domain, which is validated whole, and projects that: a module that is not listed has no concept in the domain, so it has no table, and nothing has to be pruned or left dangling. Nothing is added for the project: a module whose required module is not listed is an error value, not a surprise. A reference between modules points only down the requirement (never sideways to a peer, never up), so that an optional link between two peers is a module of its own that requires both (a bridge), not an optional column in either. The element identities of the composed domain are those of the project's domain, so a project keeps one name for it.

## Defining and composing

- **FR-001**: `defineModule` MUST make a module from a name, a definition, the names of the modules it requires, concepts and code lists, and `moduleOf` MUST make one from a domain that is already valid (Arca), so that a model written as a domain is a module without change; a module MUST be a frozen value that is not validated until it is composed.
- **FR-002**: `composeModules` MUST make one domain, named and defined by the project, from the modules the project lists, validated as `domain` validates (names, identifiers, relationships and code lists resolved among all the concepts and code lists of the listed modules), and MUST give errors as values for a required module that is not listed, a cycle among modules, two modules with one name, a concept or code list that two modules both have, and the errors of the domain.
- **FR-003**: A concept of a module MUST refer (by a relationship or a code attribute) only to concepts and code lists of itself or of a module it requires, directly or through the modules those require; a reference to a listed module that it does not require MUST be an error value naming the module, the concept and what it refers to.
- **FR-004**: The domain MUST hold the concepts and code lists of the listed modules in the order of the requirements (a module after those it requires, otherwise as listed), and MUST hold nothing of a module that is not listed, so that projecting it makes no table of that module.
- **FR-005**: `withRequired` MUST give, from the modules that exist and the names a project wants, the modules to compose: those and everything they require, in the order of the requirements, as a plain list the project can read, or an error value for a name that no module has.

## The layers

- **FR-006**: A model MAY import another model through its entry of `exports` (a module imports the modules it requires); the imports among models MUST be acyclic, and `tools/layers.ts` MUST report a cycle among models as a finding (`layers/cycle`).

## Out of scope

- Registering modules with the engine's contribution points: modules are plain values; a project passes the list.
- A schema of a module's own in the database: one namespace, with the collision check (0007).
- Removing a module from a database: a plan of destructive steps, with quarantine (0015).
- Tenant scope as an overlay of the composition: a later specification.

## Edge cases

- A module with no required module: it stands alone, per FR-001.
- A project that lists a module twice: an error value, per FR-002.
- A module that refers to a concept of a peer it does not require, even one that is listed: an error value, per FR-003.

## Assumptions

- A module's concepts are values shared by the modules that require it (Arca's `person` is one object).
- The composed domain's name is the project's, so that identities of elements are the project's.

## Open questions

- **OQ-1**: Whether modules are also contributions of the engine, so that `compose` of extensions gives the list.

## Key entities

- **Module** - a subject area: its name, what it requires, its concepts and code lists.
- **Composition** - the domain made of the modules a project lists.

## Success criteria

- **SC-001**: A project adopts the subject areas it needs and no table of any other is made.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
