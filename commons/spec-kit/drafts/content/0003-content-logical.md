# Feature Specification: Content logical (draft)

**Spec ID:** 0003-content-logical
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The Logical layer is made from Governance by code (commons 0033-kanon FR-002): a collector projects the typed content modules into a content model with ids and trace edges kept, and publishes it as a bundle that a read-only service loads across a process boundary.

## Requirements

- **FR-001**: The collector MUST be a projection: a function from the elements of Governance to a `LayeredModel` (0033-kanon FR-013) whose Logical elements are `collected-page` and `collected-claim`, each with a trace edge from the page or claim it was made from (`projects to`) and the relations of Governance kept as relations (0033-kanon FR-029).
- **FR-002**: The collector MUST run the checks of the model (`modelFindings`, `droppedFindings`) and MUST report each finding where there is one (what a finding does to a build is the host's decision, 0033-kanon FR-034, and for this library the dated policy of 0039-content-method FR-014), and MUST add its own findings: a claim with no `evidence` (draft 0002 FR-005), a page that names a claim that does not exist, a record kind the vocabulary does not list, and a page no relation reaches from the pages the body of content names as its roots (an orphan: a finding of this host and not of Kanon, 0033-kanon FR-029).
- **FR-003**: The collector MUST publish the model as the bundle of Kanon (`makeBundle`, kanon 0002-kanon-content-checks FR-008): the five files of the model and the typed content modules it was made from, each with its SHA-256, and a manifest that lists every file and not itself; the same inputs MUST give the same bytes.
- **FR-004**: The contract a service of a rendition builds against MUST be: it loads the bundle folder once, at start; it checks the whole folder against the manifest before it reads any file, and refuses the whole folder, naming each fault (`changed`, `missing`, `extra`, `manifest`, `form`), where any file differs; it runs no module of the bundle before the check has passed; and after it has passed it reads nothing more from the folder. The check is `verifyBundle` of kanon (0002-kanon-content-checks FR-009).
- **FR-005**: The bundle MUST hold no secret and no personal datum of a customer: a record that would hold one is not a record of this library (draft 0002) and is refused by the collector.

## Acceptance scenarios

1. **Given** a claim whose evidence annotation no instance accounts for, **When** the content is collected, **Then** the collection reports `kanon/dropped` naming the instance, and before the end of January 2027 it is a warning that is a planning issue and not a failure, per FR-002 and 0039-content-method FR-014.
2. **Given** the same inputs twice, **When** they are published, **Then** the bytes are the same, per FR-003.
3. **Given** a published bundle with one file changed, one missing and one extra, **When** a service loads it, **Then** it refuses the whole folder and names the three, and runs nothing, per FR-004.

## Out of scope

- The service itself (the content host) and any signature of the manifest (kanon 0002-kanon-content-checks OQ-1).

## Open questions

- **OQ-1**: Whether the typed content modules travel in the bundle as `.ts` files or as data decoded from them; the first keeps the consumer's pattern (modules plus a manifest) and needs a loader that runs nothing before the check, the second needs none. The draft keeps the first and says the service MUST NOT run a module before the check has passed.
