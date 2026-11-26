# Feature Specification: Dossier collectors

**Spec ID:** 0003-dossier-collectors
**Status:** Active
**Owner:** if
**Domain:** commons
**Governed by:** commons 0046-dossiers

**Input:** How the evidence that already exists becomes the sources of a dossier (commons 0046-dossiers FR-001, FR-005): one typed contract, the collector, made of data and one small function of an environment that a product supplies, so that a new kind of source is data plus a function and the dossier of a fleet is never empty because nobody wrote files by hand. No product name and no company fact is asserted here.

## Requirements

- **FR-001**: A collector MUST have an id (lower case words joined by hyphens), a version, the kinds of source it makes and a function that reads evidence through an environment the product gives and returns the parts of its sources and the gaps it found, or says why it could not; the instant of each source MUST be the instant of the evidence and never the clock; `defineCollector` MUST refuse an id of another form and a collector that makes no kind.
- **FR-002**: `collect` MUST run collectors in the order of their ids and MUST give their sources in the order of the ids of the sources, the same sources and hashes for the same evidence whatever the order the collectors are given in; it MUST refuse two collectors with one id (`E-DOSSIER-COLLECTOR-DUPLICATE`), a source of a kind its collector does not declare (`E-DOSSIER-COLLECTOR-KIND`) and a collector that fails (`E-DOSSIER-COLLECTOR`, naming it and why), and it MUST check the sources as a set as a build does.
- **FR-003**: A kind that a collector declares and finds no source of MUST be a gap that names the collector, the kind and why (`none found` where the collector did not say), so that what was looked for and not found is kept and never silent.
- **FR-004**: `withGaps` MUST add the gaps of a collection as one source of kind `collection-gap`, observed at the newest instant among the others, so that a dossier shows its own negative space; where nothing was collected it MUST refuse with `E-DOSSIER-EMPTY` and name the gaps, because there is no instant to give the dossier.
- **FR-005**: A build of a dossier as of `latest` that selects no source MUST be refused with `E-DOSSIER-EMPTY` and MUST NOT be dated at the epoch.
- **FR-006**: This layer MUST read nothing itself: a collector reads only through the environment its product gives, so the same collector runs over a folder, a repository's history at a past instant, or a set of fixtures.

## Acceptance scenarios

1. **Given** two collectors given in either order, **When** they run over the same evidence, **Then** the sources and their hashes are the same, per FR-002.
2. **Given** a collector that declares a kind and finds none, **When** it runs, **Then** the collection holds a gap that names the kind, per FR-003.
3. **Given** nothing collected, **When** the gaps are added, **Then** the collection is refused and says what was not found, per FR-004.
4. **Given** a declaration as of `latest` and no source, **When** it is built, **Then** it is refused, per FR-005.

## Out of scope

- The collectors of a product, which read its own evidence, and the commands that run them.
- The lenses that read what they collect: the plugins of the family.

## Edge cases

- A collector that makes the same id twice with different content is refused when the sources are checked as a set, per FR-002.

## Assumptions

- The product that supplies the environment of a collector keeps its evidence in a form it can read at the instant a dossier is as of.

## Open questions

- None.

## Key entities

- **Collector**, **Collection**, **Gap**, **Collected**.

## Success criteria

- **SC-001**: A new kind of evidence enters a dossier by one collector and no change to the build.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement names the requirements of commons 0046-dossiers it proves
