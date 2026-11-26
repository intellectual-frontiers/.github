# Feature Specification: Zero trust

**Spec ID:** 0047-zero-trust
**Status:** Draft
**Owner:** if
**Domain:** commons
**Part of:** 0043-asset-properties
**Governs:** grc, estate, dossier

**Input:** Zero trust is a way of deciding access, not a product, a boundary or a framework of controls: every request for access to a resource is decided on its own, with the least privilege the request needs, in a network seen as compromised (`definitions.md`). An organization that does it leaves a trail of decisions and of the state those decisions rested on, and a regime or a customer asks to see how far it has gone. Commons does not become a policy product and does not compete with the products that decide and enforce. It is the **evidence plane**: it names the terms (the ontology of 0006-zero-trust-terms), holds the catalog of the models in our own words, defines the typed record of a decision and the properties that show how far each area has gone, finds the places where trust is still implicit, proves that a revocation works, replays a recorded day against a proposed policy, and gives the lens that shows all of it in a dossier (0046-dossiers). A product that enforces its own access uses the same records for its own operations. Zero trust adds no layer: it rides on the properties and readings (0043-asset-properties), the boundaries (0045-boundaries), the connections (0044-asset-connections) and the evidence the libraries already keep. The owner's decisions of 2026-11-26: evidence plane for customers and enforcement only in a product's own operations; the record is an **access decision** and not a trust record; the catalog of the Department of Defense is in the first version once it has been read; and accountability has no implicit trust (FR-070).

## The model

- **FR-001**: Commons MUST NOT hold a policy decision point, an enforcement point or a network access product, and MUST NOT add a layer to the libraries it governs: zero trust MUST be carried by the typed terms (ontology 0006-zero-trust-terms), the catalog (FR-021), the access decision record (FR-010), the properties of the areas (FR-025), the checks of FR-040 to FR-043 and the lens of FR-050. Relies on audit rows: A1, A2.
- **FR-002**: The roles of the architecture MUST be named as data and not as products: the **policy engine** that decides, the **policy administrator** that carries the decision out, the **policy enforcement point** that enables, watches and ends the connection, and the eight **sources of input** that the engine decides with (the ontology's `dataSources`). A program or a connector MUST say which role it plays, or which source of input it gives, and MUST NOT claim a role it does not play. Relies on audit rows: A1.
- **FR-003**: The seven tenets MUST be entries of the catalog (FR-021) in our own words, each with the requirements and the properties that give evidence for it (FR-025), so that a person can ask which tenet a reading supports and which tenets have no reading. Relies on audit rows: A3.
- **FR-004**: The areas of effort and the themes MUST be the eight pillars of the ontology (five areas and three themes, from the federal strategy as it cites the maturity model of the Cybersecurity and Infrastructure Security Agency). The seven pillars of the Department of Defense MUST be written as data only when their source has been read (FR-022); until then a pillar of the Department of Defense MUST NOT appear in any file. Relies on audit rows: A3.
- **FR-005**: A connector, a reading or a record of a decision that comes from one of the eight sources of input MUST name it, so that a person can ask which sources of input an organization has and which it lacks. Relies on audit rows: A5.

## The access decision

- **FR-010**: An **access decision** MUST be a typed record of one decision: its id; the **subject** (a person, a service, a device or an agent, with the person and the plan hash it acts for when it is an agent); the posture signals of the subject and of its device (FR-011); the context (the time, the channel, the source, the session); the resource (an asset or a protect surface, FR-030) and the action; the access policy by id and hash; the outcome (`permit`, `deny`, `step-up` or `revoke`); the reasons as typed codes; the id of the evidence it is kept as; when it was decided and when it expires; the decision point that made it and the enforcement point that carried it out. It MUST be signed (the signers of `grc`) and addressed by the hash of its content. Relies on audit rows: B1, B2.
- **FR-011**: A **posture signal** MUST be a reading (0043-asset-properties) of a subject or a device that a decision used: it MUST name its source and its age, and a decision MUST keep each signal by reference and by the digest of the value it used, so that the decision can be replayed (FR-043) and an aged signal can be seen. Relies on audit rows: B1.
- **FR-012**: A decision MUST be recorded whether it permits or refuses: a refusal for a missing right, a changed plan hash, a target outside an approved scope or an act that only a person may do (an agent asking to approve, arm, confirm, tag or sign) is a decision with the outcome `deny` and its reason. An enforcement point that acted with no decision record MUST be a finding (FR-040, rule `unrecorded-access`). Relies on audit rows: B2, C1.
- **FR-013**: The policy of a decision MUST be a policy of the library `gate` (a rule written as code over the subjects of a change) addressed by hash; commons MUST NOT add a second policy language. The evaluation of a policy over a request and its signals MUST be a pure function that returns the outcome and the reasons, with the same result for the same inputs. Relies on audit rows: B3.
- **FR-014**: A decision that permits MUST carry an expiry, and a revocation MUST be a decision of its own with the outcome `revoke` that names the decision it ends; the time from a revocation to the first refusal at each enforcement point MUST be recordable (FR-042). Relies on audit rows: B2.
- **FR-015**: A decision MUST be kept as evidence in the hash-chained journal of the fleet (the one `evidence-capture` and the audit of `ssh-server` already keep) and MUST be mapped to a log record of the telemetry library with attributes that name the decision, the outcome, the resource and the policy hash and never a secret; the attribute names MUST be ours until a semantic convention for access decisions is read. Relies on audit rows: C1, C2.
- **FR-016**: An **agent** MUST be a subject of its own kind. Its authority MUST be scoped to a plan by hash, short lived and revocable, and it MUST NOT approve, arm, confirm, tag or sign anything; every refusal of such an act MUST be a recorded decision (FR-012). A decision that an agent made or was refused MUST name the person who gave it the plan. Relies on audit rows: C3.

## No score

- **FR-020**: Commons MUST NOT compute an opaque trust score of a subject, a device or an organization. A derived value MUST be a coverage and a freshness per pillar, or a stage computed by a published threshold (FR-022), and MUST show the readings it came from with their ages. Relies on audit rows: B1.

## The catalog

- **FR-021**: The catalog MUST be an OSCAL catalog package in the family of `catalog-nist-sp800`, `catalog-soc2` and `catalog-nist-csf-2` (its own library, with its data in our own words): the seven tenets, the eight pillars, the eight sources of input and the goals of the federal strategy for each area, each entry with its source and whether it was read; activities and stages MUST appear only after FR-022. Each entry MUST carry a urn that a property (FR-025) and a control (FR-023) can cite. Relies on audit rows: A3.
- **FR-022**: The maturity stages and the activities of the maturity models (the model of the Cybersecurity and Infrastructure Security Agency, and the strategy and activity list of the Department of Defense with its counts at each level) MUST be written into the catalog only from their source, read and dated; an entry whose source has not been read MUST be marked `unread` and MUST NOT be approved or counted. Until the model is read, a pillar MUST show its coverage and freshness (FR-020) and the words "stage not defined: model not read", and MUST NOT show a stage. Relies on audit rows: A3.
- **FR-023**: A **crosswalk** MUST map the controls of SP 800-53 and SP 800-171 (the claim table's urns, 0043 FR-014) to the pillars and tenets, so that a reading made for a control of a regime counts toward the pillar it supports and the work done for one framework shows progress in the others. A row of the crosswalk MUST say where it came from: the published mappings of the architecture guide when they have been read, or a person's decision with a reason; no row MUST be made by a program. Relies on audit rows: A3, B3.
- **FR-024**: A zero trust overlay of a framework MAY be written as an OSCAL profile over the controls the crosswalk selects, with the parameters a pillar needs. It is not required for the first version.

## The properties

- **FR-025**: The properties of 0043-asset-properties MUST have a set for each pillar, each property with its question, its probes by class of asset (0043 FR-006), its freshness and the urns it gives evidence for. The set of the first version is the one the federal strategy names where it was read: for identity, the share of users with phishing-resistant authentication, centralized identity management and a device signal in authorization; for devices, the completeness of the inventory, the share of devices managed and the presence of endpoint detection and response; for networks, encrypted names and encrypted web traffic and the isolation of environments; for applications and workloads, testing before release and a channel for outside reports of weaknesses; for data, the categorization of data and the logging of access to it; for the themes, the coverage of logging, the share of responses carried out by policy, and a named owner for each policy. A property that rests on a source not read MUST say so. Relies on audit rows: B1, B3.

## Protect surfaces

- **FR-030**: A **protect surface** MUST be a boundary of the kind `trust` (0045-boundaries FR-002) with exactly one access policy; its members are assets, populations or stores of data, selected as any boundary's members are (0045 FR-010). A protect surface MAY lie inside a boundary of another kind and MUST inherit its categorization (0045 FR-006) unless a person records a different one with a reason. Relies on audit rows: A4.
- **FR-031**: An interconnection into a protect surface (0045-boundaries FR-040) MUST name its access policy, and MUST have access decisions in the evidence within the freshness its policy names; an interconnection with none MUST be a finding (rule `no-decisions`). A protect surface with no access policy MUST be a finding. Relies on audit rows: A4.

## Implicit trust

- **FR-040**: The **implicit-trust finder** MUST be a set of typed rules over the estate, its readings and its decisions, each returning findings with where, the evidence and the fix: `network-location` (access that is allowed by an address or a zone), `shared-credential` (a credential used by more than one subject), `long-lived-credential` (older than the age its policy names), `standing-privilege` (a privilege held without a window), `unmanaged-device-allowed`, `flat-zone` (a zone with no managed interface inside), `unauthenticated-internal` (a service that answers with no identity) and `unrecorded-access` (FR-012). A rule that cannot be evaluated for lack of a reading MUST say which reading it lacks and MUST NOT report success. Relies on audit rows: B1, B4.
- **FR-041**: The **standing-privilege ledger** MUST list each privileged role with its holders, which holds are standing and which are windows, and for each window the plan hash that approved it and the times it opened and closed. Relies on audit rows: C1.
- **FR-042**: The **time-to-revoke drill** MUST revoke a subject, a device or a credential (a decision, FR-014) and record the time until each enforcement point refuses it, with the evidence of each refusal; a drill MUST NOT revoke anything a person has not named, and its record MUST be fresh within the period a policy names. Relies on audit rows: C1, C4.
- **FR-043**: **Decision replay** MUST evaluate the recorded requests of a period against a candidate policy and report the permits that would become denials and the denials that would become permits, with the requests and the signals each used; it MUST NOT enforce anything and MUST NOT write a decision of the live record. Relies on audit rows: B3.

## The lens

- **FR-050**: A lens pack `zero-trust` for 0046-dossiers MUST show: a scorecard by pillar (coverage, freshness and, when FR-022 allows, the stage); the findings of the implicit-trust finder as a negative-space plate; the standing-privilege ledger; the records of the drills; and a replay report; each with its disclosure class and its as-of date, and each fact with its anchor to the evidence it rests on. Relies on audit rows: C5.

## Readers

- **FR-060**: The readers that bring the state of other people's products into the estate MUST use the connector contract of 0044-asset-connections (read only, credentials by name, a budget, a conformance suite): the conditional access policies of an identity provider, the compliance state of devices from a device management service, the application inventory and the access log of a network access product, and the activity logs of the cloud accounts; each reader MUST say which source of input it gives (FR-005). The candidate sources and their licences are in `reuse-audit.md` and none has been verified. Relies on audit rows: C6.

## The rule and the product

- **FR-070**: Accountability MUST have no implicit trust: every access that a commons library or program grants MUST be a recorded decision (FR-012), and a program that grants access by an address, an owner or a standing credential MUST be a finding of FR-040. This requirement MUST also be stated in the constitution of the repository that uses commons (0027-commons-libraries). Relies on audit rows: A1.
- **FR-071**: A product that enforces access in its own operations MUST record each decision as FR-010 says, MUST keep the decisions of an agent separate from those of a person (FR-016), and MUST publish its decision log as evidence; the rendering is in the product's own specification and no product is named here. Relies on audit rows: C1.

## Edge cases

- A decision made while the policy is being changed: the decision names the policy by hash, and replay (FR-043) uses that hash, so a change never rewrites a decision (FR-010, FR-013).
- A request from inside a network with no identity: it is refused and recorded (FR-012) and the zone is a finding of `network-location` or `unauthenticated-internal` (FR-040).
- A signal that has aged past what its policy allows: the decision that used it records the age (FR-011), and a decision that permitted on an aged signal is a finding.
- A pillar with a stage the model has not been read for: it shows coverage and freshness only (FR-022).
- A drill that revokes a credential a service still uses: the drill names it first and a person approves (FR-042); the refusal at each enforcement point is the evidence.
- An organization with no decision point of its own: it has the sources of input it has (FR-005) and the findings of FR-040; the scorecard says what is absent and does not score it (FR-020).
- A reader of a product whose licence is not verified: it is a candidate, not a dependency (FR-060).
- An agent that holds a plan and asks to approve it: denied, recorded, and the person named (FR-016).

## Assumptions

- The estate and the properties exist (0043-asset-properties) and the boundary model is typed in `estate` (0045-boundaries); this specification adds terms, a catalog, records, rules and a lens, and no layer.
- A person decides what a regime or a model requires; the library proposes and checks.
- The categories and the wording of the models are data of the catalog, read from the model's source and dated, and a counsel's reading governs where it differs.

## Open questions

- **OQ-1**: Where does the typed `AccessDecision` live? Default: in `grc` beside the signers it uses and the evidence types, because it is evidence, with the properties in `estate`.
- **OQ-2**: Does a protect surface need its own kind of asset? Default: no; it is a boundary of the kind `trust` (FR-030), and a population is already an asset (0044).
- **OQ-3**: What are the names of the attributes of an access decision as a log record? Default: ours (FR-015) until a semantic convention is read.
- **OQ-4**: Are the thresholds of a stage data of the catalog or of a profile? Default: data of the catalog (catalog-zero-trust 0003-zero-trust-stages), with values that are ours and wait for the owner to confirm them.

## UNVERIFIED

- The strategy, pillars, activities and counts (91 at the target level and 152 at the advanced level, as the owner named them) of the Department of Defense: not read, the host refused the download (`definitions.md`, section 5). The model of the Cybersecurity and Infrastructure Security Agency has been read (`definitions.md`, section 4b).
- The published mappings of the architecture guide to SP 800-53 Rev. 5 and to the Cybersecurity Framework: not read (supplemental to SP 1800-35).
- Sections 3.3 onward and section 4 onward of SP 800-207, and the body of SP 800-207A: not read.
- The licences and the formats of the candidate sources of FR-060: not read.
- Whether a semantic convention for access decisions exists: not read.

## Key entities

- **Access decision** - the signed record of one decision about one request.
- **Posture signal** - a reading a decision used, with its source and age.
- **Protect surface** - the smallest boundary that one access policy names.
- **Implicit trust** - access allowed without a decision.
- **Catalog** - the models in our own words, with their sources and what was read.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| NIST SP 800-207 | The definition, the seven tenets, the policy engine, administrator and enforcement point, the eight sources of input, the inputs of the decision | Read (`definitions.md`, sections 1 and 5 for what was not) |
| NIST SP 800-207A | Policies on identities of applications and services over policies on the network | Abstract read |
| NIST SP 1800-35 | The existence of example implementations and of mappings to controls | Abstract and headings read; the mappings not read |
| OMB M-22-09 | The five areas, the three themes and the goal of each | Read |
| CISA Zero Trust Maturity Model 2.0 | The stages and functions | Not read |
| DoD Zero Trust Strategy, activities and overlays | The pillars, activities and counts | Not read |
| NIST SP 800-53 Rev. 5 and SP 800-171 | The controls the crosswalk maps | In the repository (`catalog-nist-sp800`) |
| OSCAL 1.1.2 | The catalog and profile forms for the catalog package and the overlay | The schema read (0045-boundaries) |

## Success criteria

- **SC-001**: Every requirement of this specification that asks for code has a row of the enforcement register with the mechanism `none` and the note Deferred; each row that gets code has a test with synthetic names and no network.
- **SC-002**: Every requirement says which row of the reuse audit it relies on, and no requirement states a history.
- **SC-003**: For a synthetic estate with three protect surfaces, one with no policy, one with an interconnection with no decisions and one with a shared credential, the implicit-trust finder reports exactly those three findings and no other (FR-031, FR-040).
- **SC-004**: A decision signed and verified offline; the same decision replayed against the same policy gives the same outcome and reasons, and against a stricter policy reports the permits that become denials (FR-010, FR-013, FR-043).
- **SC-005**: No file of the catalog names a maturity stage, an activity or a pillar of the Department of Defense while its source is marked `unread` (FR-022).

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement says which row of the reuse audit it relies on, or is about the rule itself
