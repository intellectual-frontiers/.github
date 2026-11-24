# Glossary and sources

The terms below mean what the specification says in every page of this documentation. Where a term has a section of the specification, its requirement number is given.

## Terms

| Term | Meaning | Where |
| --- | --- | --- |
| **Kanon** | The pattern of six rules, the name of its specification and of the library `@intellectual-frontiers/kanon`. | FR-001 to FR-007 |
| **Layer** | One of Governance, Logical and Physical, with a rank (Governance 1, Logical 2, Physical 3). A higher rank imports a lower one. | FR-001, FR-007 |
| **Governance** | The top layer: what a thing is and what it may do, stated once, in the words of its domain. | FR-001 |
| **Logical** | The middle layer: the model a program reasons with, made from Governance by code. | FR-001, FR-002 |
| **Physical** | The bottom layer: what carries the model out in a place (a dialect, a table, a command, a tool, a route). | FR-001 |
| **Unit** | A folder of a library that is in one layer. | FR-007 |
| **Element** | One thing a layer says, with a stable id, a kind, a name, a definition and a source. | FR-007 |
| **Projection** | The derivation of the elements of one layer from those of the layer above, by code. | FR-002 |
| **Trace edge** | The record that one element was made from another, with how. The edges make a graph with no cycles that runs one layer down. | FR-003 |
| **Surface** | A physical unit that faces a caller: a command line, a tool server, a REST service, and also a reader or a crawler. A surface imports no other surface. | FR-004, FR-030 |
| **Finding** | A sentence about a breach of a rule, with a code, a file, a line and a key that a baseline can hold. | FR-011 |
| **Table** | A library's list of units, each with its layer and what it may import, as data in the manifest. | FR-010 |
| **Own unit** | The library's own checking, such as tests and tools, in no layer, which may import any file of the library by a relative path. | FR-010 |
| **Baseline** | The file `kanon.baseline.txt`: the findings that existed when it was written. A new finding fails the check, and so does a line that does not occur. | FR-011 |
| **Annotation** | A property that Governance gives an element: its effect, its audience, its retention, its audit. | FR-005 |
| **Disposition** | How one annotation ends for one instance: expressed, carried or unexpressed. | FR-005, FR-022 |
| **Expressed, carried, unexpressed** | Enforced by a lower element; passed on as data a program reads at run time; named, with a reason, as not enforced yet. | FR-005 |
| **Dropped** | An annotation that ends in none of the three: the finding `kanon/dropped`. | FR-005 |
| **Matrix** | The table of requirement by instance: a row for each annotation and a cell for each instance, each expressed, carried, unexpressed or dropped. | FR-023 |
| **Instance** | One of several occurrences of a kind of unit in the Physical layer, such as a dialect, declared in the table. | FR-019 |
| **Host** | A library that is Kanon and is extended by packages of its own. | FR-020 |
| **Extension** | A package that extends a host through the host's public `exports` only. | FR-006, FR-020 |
| **Plugin** | An extension that adds a noun to the host's one program, and may depend on other plugins by declaration. | FR-020 |
| **Dialect** | An extension that is an instance of a physical unit of the host, in a package of its own. | FR-019 |
| **Family** | The host with its extensions, and the naming rule of their packages as data of the host's table. | FR-021 |
| **Scope** | Whether a family accepts members of another package scope (`any`) or only its own (`own`). | FR-027 |
| **Relation** | A link between two elements of one layer, with a kind from the model's vocabulary. It is not a trace edge. | FR-029 |
| **Vocabulary** | The kinds of element, the kinds of relation and the names of annotations that a host declares for its model. | FR-028 |
| **Data module** | A typed `.ts` module of a Governance unit whose exports are data and that imports nothing of the library's other units. | FR-025 |
| **Bundle** | The Logical model published as files with a manifest of every file and its SHA-256, loaded by a loader that refuses the whole bundle if any file differs. | FR-026 |
| **Consumer manifest** | The file `kanon.ts` that a package which only consumes the pattern uses for its table. | 0002-kanon-content-checks |
| **Rendition** | One way a claim is published: a web page, its Markdown twin, a feed, a text file for a model. In the content host, each is an instance. | FR-030, FR-033 |
| **Gate policy** | A typed, dated decision of a host about what a finding does to a build. It is not a property of the finding. | FR-034 |

## The finding codes

The codes are a closed list, and each has a sentence. The import checks are in [the page on imports](kanon-imports.md), the model checks in [the trace page](kanon-trace-and-dropped.md), and the family checks in [the page on families](kanon-families.md).

| Group | Codes |
| --- | --- |
| Layers | `layers/unclassified`, `layers/relative`, `layers/private`, `layers/external`, `layers/above`, `layers/around`, `layers/cycle`, `layers/syntax` |
| Instances | `instances/sibling`, `instances/undeclared` |
| Plugins and family | `plugins/inverted`, `plugins/undeclared`, `plugins/contract`, `family/name` |
| Models | `kanon/dropped`, `kanon/kind`, `kanon/annotation`, `kanon/dangling`, `kanon/relation-layer`, `kanon/trace-invalid`, `kanon/trace-missing`, `kanon/disposition-duplicate`, `kanon/duplicate-id` |

## Sources

- The specification: [0033-kanon](../../spec-kit/specs/0033-kanon/spec.md), still a Draft. It states the six rules, the vocabulary, the table, the instances, plugins and families, the content rules and its open questions.
- The checker and its specifications: [the Kanon library](../../kanon/), with the specification of the checker (0001-kanon-checker) and of the content checks (0002-kanon-content-checks) in its own spec kit.
- The worked example of the imports and adoption pages: `commons/kanon/suite/examples/reminders`, tested by `commons/kanon/suite/examples.test.ts`.
- Headless, whose command model, tool server and REST service are projections of one description: [the library](../../headless/).
- AnyFS, a host with twelve extensions: [the library](../../anyfs/). Archon, a host with plugins and dialects: [the library](../../archon/).
- The Content library, for claims and renditions: [the library](../../content/), and the method it serves, [the content method](../../spec-kit/specs/0039-content-method/spec.md), a draft.
- The wider method: [Mizan](concept-mizan.md), and in particular [the ladder](mizan-ladder.md), [standards first](mizan-standards-first.md) and [the typed ontology](mizan-ontology.md).

## How the quoted code is kept honest

Each code block on these pages that names a source file in its first line is compared with that file by a test of the documentation, and the test fails if the block does not match. Each block of output names the command that produced it and the day it was run. A figure on the page `What consumers gain` carries its date and its method. If a figure matters to a decision, run the command again.

Back to the overview: [Kanon](concept-kanon.md).
