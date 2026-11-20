# Govern a group of entities with GRC

A group of entities defines its controls once and scopes them to each entity. Every entity keeps its own ledger, evidence store, signing keys and secrets; the group sees only statuses and digests, read through a function each entity owns ([GRC](../../grc/)).

```mermaid
flowchart LR
  controls["Controls, defined once"] --> scope["Scope: which control applies to which entity"]
  scope --> view["Group view"]
  a["Entity A reader"] -->|"statuses and digests"| view
  b["Entity B reader"] -->|"statuses and digests"| view
  c["Entity C reader"] -->|"statuses and digests"| view
  view --> out["Coverage and roll-up by control, by entity, overall"]
```

## The group and its scope

A group is a document of kind `grc.entity-group`: each entity has an identifier and references to its own ports (`ledger`, `store`, `keys`, `secrets`). A reference is a name the host resolves for that entity alone, and a secret is only ever a reference such as `secret:unit-a/signing`; a value in its place does not decode ([commons grc 0009-grc-groups FR-001](../../grc/spec-kit/specs/0009-grc-groups/spec.md)).

The scope is a document of kind `grc.control-scope`. A rule names a control and an entity selector (`all`, `only` or `except`); a control no rule names applies to every entity ([commons grc 0009-grc-groups FR-003](../../grc/spec-kit/specs/0009-grc-groups/spec.md)).

```ts
import { applicability, entityGroup, controlScope, scopeProblems } from "@intellectual-frontiers/grc/governance";

// group and scope are documents decoded with entityGroup.decode and controlScope.decode
const matrix = applicability(group, scope, controls); // one cell per control and entity
const problems = scopeProblems(group, scope, controls); // [] for a sound scope
```

An exception of a control for an entity is the expiring `grc.exception` that governance already has, with the entity identifier among its `subjects` ([commons grc 0009-grc-groups FR-005](../../grc/spec-kit/specs/0009-grc-groups/spec.md)).

## Reading the group

The host makes one reader for each entity. A reader takes the instant and gives that entity's snapshot, which holds the status, coverage, severity and digests of each control and the head of its ledger, and nothing else. The group never receives an evidence payload or a secret, and no function needs the data of two entities in one place ([commons grc 0009-grc-groups FR-006](../../grc/spec-kit/specs/0009-grc-groups/spec.md), [FR-010](../../grc/spec-kit/specs/0009-grc-groups/spec.md)).

```ts
import { groupView, readGroup } from "@intellectual-frontiers/grc/logical";
import { entityReader } from "@intellectual-frontiers/grc/physical";

const readers = new Map([[unitA, entityReader(portsOfUnitA, material)]]);
const readings = await readGroup(group, readers, at); // an entity with no reader, or that fails, is unread
const view = groupView({ group, scope, controls, readings, exceptions: [], at });
view.overall.worst; // "pending" while an entity cannot be read, never "pass"
```

An entity that cannot be read gives `pending` and the coverage `unknown`; it is never assumed to pass ([commons grc 0009-grc-groups FR-008](../../grc/spec-kit/specs/0009-grc-groups/spec.md)). Your own way of making readers is proved with `groupConformance`, which runs it over per-entity ports that throw when another entity's reader touches them ([commons grc 0009-grc-groups FR-011](../../grc/spec-kit/specs/0009-grc-groups/spec.md)).

## The state at an instant

`asOf(input, at)` gives the status, coverage, freshness, exceptions in force and risk of every control at an instant, from what was recorded up to it. Events after the instant are ignored and expirations are judged at the instant, so the view at the end of the ledger equals the current view and a later event never changes an earlier one ([commons grc 0010-grc-as-of FR-006](../../grc/spec-kit/specs/0010-grc-as-of/spec.md)).

```ts
import { asOf } from "@intellectual-frontiers/grc/logical";

const view = asOf(input, "2026-03-01T00:00:00Z");
```

## Verifying a bundle offline

`grc bundle verify` checks a whole evidence bundle with no network: each item's hash and size, the ledger's hash chain, the canonical form, the signature and the signer's role and custody, and the retention of the evidence. Each fault is a finding that names the item, entry, signature or file it concerns, with a code that `grc explain` explains ([commons grc 0011-grc-bundles FR-003](../../grc/spec-kit/specs/0011-grc-bundles/spec.md)).

```sh
grc bundle verify ./bundle --keys keys.json --policy policy.json --at 2026-06-01T00:00:00Z
grc explain E-BUNDLE-ITEM-HASH-MISMATCH
```

The exit is 0 when the bundle verifies, 1 when there are findings, 2 for a wrong command line and 3 when a folder or file cannot be read ([commons grc 0011-grc-bundles FR-011](../../grc/spec-kit/specs/0011-grc-bundles/spec.md)). The keys and the policy are the verifier's: a bundle never vouches for its own signer.
