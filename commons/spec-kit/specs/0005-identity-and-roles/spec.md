# Feature Specification: Identity and roles

**Spec ID:** 0005-identity-and-roles
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** How any company, site or platform of Intellectual Frontiers knows who a person is, what part the person plays, what the person has bought, and what the person may therefore do, so that the first site and every later site, platform and company in the group read the same facts and none keeps its own copy. It names no vendor, no company, no price and no person: the vocabulary of roles and permissions, the depth at which a work is offered, the rule that a role never widens who may see a fact, the rule for how stale an answer from an identity provider may be, and the one interface through which a harness asks. Which provider is used, which roles a company grants, what a layer is called and what it costs are the harness's own, in its own specifications and decision records.

## Identity and pools

- **FR-001**: A harness that identifies people for access beyond what is public MUST keep its own identifier for each person. An identity provider's identifier MUST NOT be the only identifier of a person; the harness's identifier MUST be stored at the provider, so that replacing the provider changes the adapter and nothing else.
- **FR-002**: A **pool** is a named set of identities that one provider recognizes as one set of people. A harness or platform MUST name the pool it uses in its own records, not in commons. A person who is in two pools has two identities, and the harness MUST NOT link them unless the person asks for it.
- **FR-003**: An **organization** is a party people belong to: a company, an imprint, an institution, a team, or one person alone. A **membership** relates one person to one organization and MUST carry the roles that the person holds there. A role belongs to a membership, not to a person in general.

## Roles, permissions and layers

- **FR-004**: A role MUST be an individual of the commons ontology with an identifier (lower-case words joined by hyphens, at most 32 characters), a label, a definition and a kind (`visitor`, `member` or `staff`), and MUST list the permissions it grants. No role MAY be defined by a harness's code only: a role that more than one company would use is added to the ontology.
- **FR-005**: A permission MUST be an individual of the ontology with a slug of lower-case letters, digits and the characters `-`, `:` and `.`, at most 40 characters, a label and a definition. A slug names an action on a kind of thing (`work:edit`), is short because a provider may carry it in a token, and is never reused for another meaning.
- **FR-006**: A role MUST NOT widen who may see a fact. Holding a role makes an action possible; it never makes a fact visible that the person's grants do not already cover under the harness's audience rules. The audience check applies to every request in addition to the permission check.
- **FR-007**: A **layer** is what a person or an organization has bought. A layer MUST come from an entitlement the harness records and MUST NOT be a role; a role is given by a decision, a layer is bought. The ontology defines the concept of a layer and holds no layer's name or price.
- **FR-008**: A role MUST be given only by a decision of a person with the authority to give it, as the harness defines that authority. The person who receives a role, and an agent, MUST NOT give it. The harness MUST record who gave it, why, when, and until when where it is time-bound.
- **FR-009**: A time-bound role MUST end on its date. The harness MUST remove it from the identity provider, and until it is removed the rule of FR-011 limits how long it may still be honoured.
- **FR-010**: An agent (an AI model or a job) is not a role. It acts for a person and MUST hold at most that person's permissions, and every action it takes MUST be attributed to the agent and to the person (`archon 0053-platforms` FR-033).

## Freshness

- **FR-011**: A harness MUST state, in its own specification, a **staleness bound**: the longest time after a role, an entitlement or a grant is revoked during which an answer taken from a token or a cache may still be honoured. The bound MUST be finite and MUST be stated per kind of request.
- **FR-012**: A request whose effect cannot be undone, such as the delivery of a paid or unreleased work as a file, MUST be decided from a check made at the time of the request, and MUST NOT be decided from a claim carried in a token.
- **FR-013**: A session MUST expire. A session MAY carry who the person is; it MUST NOT carry which audiences the person satisfies for longer than the staleness bound.

## The access store

- **FR-014**: A harness MUST ask one interface, the **access store**: given an identified party, an action, a subject and a time, it answers yes or no and gives the reason. The harness MUST NOT read a provider's claim anywhere else. A provider, and later a store of the harness's own, are adapters behind the interface.
- **FR-015**: The access store MUST answer from the harness's recorded policy (the roles and permissions of the ontology, the grants and the audiences of the harness's own records), not from a policy kept only at the provider. A difference between the provider and the recorded policy MUST be reportable.
- **FR-016**: Everything an adapter holds about people, their memberships, roles, entitlements and access MUST be exportable in open formats that any program can read, and the export MUST be tested at least once a year.
- **FR-017**: A request for anything beyond what is public MUST leave a record of which party, which subject and when. The record MUST NOT be committed to a repository, and MUST NOT carry an email address or a name where an identifier is enough.

## The depth of a work

- **FR-018**: A work MAY be offered in **depth levels** of the ontology, from the shallowest: `answer`, `reader`, `own`, `connect` and `team`. Each level MUST have its own audience, and each is checked like any other (FR-006).
- **FR-019**: What lets a reader check a claim MUST be at the `answer` level: the kind of each claim (fact, opinion, framework, illustration), its sources, the work's identifier and its citation. A claim whose evidence is withheld from every reader MUST NOT be published as a fact.
- **FR-020**: Every visitor, a search or an answer crawler among them, MUST be served the same `answer` view of a work whose deeper levels are not public. A harness MUST NOT serve a deeper level to a crawler that it does not serve to a person with the same grants, and MUST mark the deeper section as not free in the page's structured data.
- **FR-021**: A deeper level MUST NOT appear in the text of the `answer` view, nor in its markup, structured data, feed, machine edition or index of addresses.

## The role catalog and its table

- **FR-022**: The ontology (`commons/ontology/identity/`) MUST hold the catalog of roles and permissions of a book imprint and a think tank, and the depth levels, as data. It MUST hold no person, no company, no layer name or price, and no secret.
- **FR-023**: `commons/tools/generate-identity.py` MUST read the ontology, refuse every rule FR-004, FR-005 and FR-018 states (naming each finding), and write `commons/generated/identity.auto.toml`; with `--check` it MUST write nothing and fail where the file is not what the ontology makes.
- **FR-024**: A harness MUST read the generated table, MUST keep no role or permission of its own that the ontology holds, and MUST report a role at its provider that the table does not hold.

## Out of scope

- Which identity provider, payment provider or analytics provider a harness uses, and what it pays: a decision record of the harness.
- The names, contents and prices of layers, and which roles a company grants to whom.
- The design of a sign-in screen, an interstitial or an email.

## Edge cases

- A role is defined in a harness's code and not in the ontology: the generator cannot see it and the harness reports it, per FR-004 and FR-024.
- A permission slug longer than forty characters, or with a capital letter: the generator refuses it and names it, per FR-005 and FR-023.
- A person holds the role of reviewer and asks for a work that is not in a review round: the permission lets the person comment on a review copy, and the audience check still refuses the work, per FR-006.
- A reviewer's access ends on its date and the provider still lists the role for a short time: the staleness bound limits it for reading, and a download is decided at the time, per FR-009, FR-011 and FR-012.
- An agent acting for a reader asks for a staff action: it holds only the reader's permissions and is refused, per FR-010.
- A reader pays for a layer: the entitlement is recorded, no role is given, and a later lapse needs no decision to remove it, per FR-007.
- A crawler asks for a paper whose full text needs an account: it is served the same answer view as a visitor with no account, per FR-020.
- The answer view of a paper copies a paragraph from its deeper level into its description: the check refuses it, per FR-021.
- A provider disappears or is replaced: a new adapter answers the same interface and the harness's identifiers are intact, per FR-001 and FR-014.
- A person is in two pools, such as a website's and a platform's: they are two identities until the person links them, per FR-002.

## Assumptions

- A harness is told who a person is by a provider it trusts, and the provider signs what it says.
- A role in a token can be a few minutes old; a harness that cannot accept that decides the request at the time (FR-012).
- The generated table is small enough to read at every start of a harness.

## Open questions

- **OQ-1**: Whether a per-work grant (a person approved for one work and not another) belongs to the ontology as a fourth kind of thing next to role, permission and layer, or stays in each harness's own records.
- **OQ-2**: Whether the five depth levels are enough, or a harness may add a level between two.
- **OQ-3**: Whether the staleness bound should have a ceiling that commons states, or stay entirely the harness's choice.

## Key entities

- **Pool** - a named set of identities at one provider.
- **Organization, membership** - a party, and one person's place in it, with the roles held there.
- **Role, permission** - a named part, and an action it makes possible, from the ontology.
- **Layer** - what a person or an organization has bought, held as an entitlement.
- **Staleness bound** - the longest a revoked claim may still be honoured.
- **Access store** - the one interface that answers whether a party may do an action to a subject now.
- **Depth level** - how deeply a work is offered: answer, reader, own, connect, team.

## Success criteria

- **SC-001**: `uv run commons/tools/generate-identity.py --check` exits 0 on commons' own ontology.
- **SC-002**: A role or a permission that breaks FR-004 or FR-005 is refused by the generator in a test.
- **SC-003**: No role grants a permission the ontology does not define, and no permission is granted by no role, in a test.
- **SC-004**: The generated table holds no person, company, layer name, price or secret, in a test.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
