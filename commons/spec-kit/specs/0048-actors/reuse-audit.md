# Reuse audit: actors

**For:** 0048-actors. **Read:** this repository at the commit that carries this file, on 2026-11-26, by reading the manifests of the libraries and the specifications beside them (`quality` 0001-quality-evidence, `repoctl` 0005-repoctl-library-commit-doctor and 0009-repoctl-config, `planning` ontology terms, `grc` 0014 to 0019, `0047-zero-trust`, `0045-boundaries`, the `docs.config.ts` word lint). Nothing was run. Each row says what exists, what is missing, and whether the specification reuses, extends or writes new code.

Paths are under `commons/`. The word provenance is used only where a cited standard uses it.

## A. Where the actor sits

| # | Need | Existing library and symbols | Gap | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| A1 | Roles that only some kinds of actor may hold, enforced in types | `core` (the algebraic types of the libraries), `planning` (its `actorKinds`, three kinds of actor in the ontology), `0047-zero-trust` FR-016 (an agent is a subject of its own kind) | A table of kind by role and a type that cannot be built with an agent as initiator, reviewer or approver | new library `actor` (Kanon) | FR-001, FR-010, FR-011, FR-080: no existing library states which kind may hold which role; the decision of FR-016 of 0047 is one case of it |
| A2 | Directives and taskings as controlled records | `planning` (work orders and their events), `workload` (runbooks and receipts), `grc` (signed documents), the AGENTS.md and CLAUDE.md files of a repository | A directive with an owner and a digest, a tasking with a scope, a level and an expiry, both signed and revocable | extend (`grc` signers, `planning` work orders) and write the records in `actor` | FR-020, FR-030: the work order exists; its owner, digest and the tasking do not |
| A3 | Vocabulary and the mapping to PROV | `ontology` (a namespace per subject; `act:` in 0007-actor-terms), `rdf` (`prov:Agent`, `prov:Activity`, `wasAssociatedWith`, `actedOnBehalfOf`) | The terms and the total mapping; one list of kinds | extend, and replace the list of `planning` | FR-001, FR-060, FR-081: `plan:ActorKind` (person, agent, tool) is a second list of the same thing; `act:ActorKind` becomes the only one, with the tool as a system, with no alias |
| A4 | Signatures with a meaning, and separation of duties | `grc` (0014-grc-sshsig, 0017-grc-sshsig-namespace, 0018-grc-acceptance-attestation), `change-control`, the approval specification of the platform | A meaning field on the signature and the rule that an agent holds none | extend `grc` signatures with the meaning; reuse the approval work | FR-012, FR-013, FR-063: the key and the verifier exist; 21 CFR 11.50 asks for the meaning |
| A5 | Qualification evidence, tasking checks and requalification triggers | `quality` (grades E0 to E5, 0003-quality-case-runs), the acceptance machinery (`test` and `validate`), `grc.access-decision` (0047-zero-trust), `desired-os-state` (the configuration as requirements) | A record of the configuration of an agent and a pure check of tasking at each act | write in `actor`, reuse the evidence and the decision record | FR-030 to FR-041: the cases and the decision record exist; the configuration item does not |
| A6 | Nonconformance, refusal and CAPA | `quality` (nonconformance and CAPA, 0001-quality-evidence), `planning` (findings), `0047-zero-trust` (refusals as decisions) | The rule names and the counts per agent configuration | extend `quality` records with the rule and the actor | FR-022, FR-050, FR-051: the form exists, the rules are new |
| A7 | Digests of transcripts and prompts | `evidence-capture` (a hash-chained journal of entries), `telemetry` (log records with attributes) | An entry kind for a session of an agent | extend `evidence-capture` journal entry kinds, in the next release of that library's spec | FR-062: the chain exists; the new kind is one entry |
| A8 | Trailers, the author rule and a word lint | `repoctl` (the commit builds its trailers in a configured order and a configured identity, 0005 FR-005, 0009 FR-004), `docs.config.ts` (`forbiddenInGuides`, a word lint), `grc` | A codec for `Prepared-by`, `Directive` and `Reviewed-by`, and a lint for the forbidden words of an agent | extend `repoctl` commit rules with the three trailers; write the codec and the lint in `actor` | FR-063 to FR-065: no new commit machinery; the trailers are configuration, the codec is pure |
| A9 | Creators who are not engineers | `workbench` (a guided flow), `terminal` (UI), the work engine of the platform | A scribe that writes in a person's name with their signature | later; stated as a requirement, built with the surfaces | FR-066: no library change is needed in the first version |
| A10 | A report of the roles, taskings and nonconformances | `dossier` and the family `dossier-assurance` (lenses over signed sources), `estate` boundaries | The lens pack `actor` | extend: a plugin of the family | FR-070, FR-071: the core of lenses exists |

## B. The evidence side (not actor concepts)

| # | Need | Existing library and symbols | Gap | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| B1 | The source class of evidence, its lineage, and the prepared marker | `quality` 0001-quality-evidence (grades `ifqs:E0` to `ifqs:E5`; FR-026 says `E1` is stated by a person or an agent; FR-029 grades an agent's review no higher than `E2`), `grc` 0006-grc-evidence, `evidence-capture` (the journal) | The five classes, the lineage by digest, the marker and its clearing, and the rule that agent prepared content is never the sole basis | extend `quality` 0001-quality-evidence with FR-071 to FR-077; `grc` and `evidence-capture` carry the class on their records | The grades and the agent rule live in `quality` already; the actor library holds who, `quality` holds how strong. This keeps the word provenance out of our terms |
| B2 | Seeded defects to test review | `quality` (mutation testing of a suite, 0001 FR-043 to FR-049) | The same idea for review of an artifact | extend `quality` FR-077, pilot only | The measure (share detected) and the floor exist for tests; the canary applies it to review |

## C. What this audit did not decide

- The wire form of the in-toto statement of FR-061 (the predicate type URI): ours, to be named when a verifier is built.
- Whether the key of a person for signing a review is the one of the approval specification: this specification relies on it and does not name it.
- `Assisted-by`: no published convention was read; the trailers of FR-063 are ours.

## D. Collision audit of the words

| Word | Where it is used | Decision |
| --- | --- | --- |
| agent | PROV (every actor); `act:Agent` (an AI actor); `plan:ByAgent`; `0047-zero-trust` FR-016 (a kind of subject) | The word names the AI case only; the PROV class is `prov:Agent`, which `act:Actor` specializes. `plan:ByAgent` is replaced by `act:Agent` (FR-081). |
| actor | `plan:ActorKind`; `act:Actor`; the list of kinds in `planning` | One list, `act:ActorKind` (A3). |
| trust | enrollment trust, the boundary kind `trust`, `0047-zero-trust` | Not used by this specification. |
| tool | `plan:ByTool`; the tool plugins of the platform | A tool is a system when it is a validated mechanism and an instrument otherwise; the kind `System` replaces `ByTool`. |
| review, approval | `quality` (grade `E2` reviewed), `grc` (signed attestation), the approval specification | `review` and `approval` are signature meanings (FR-012); the grade of a review stays in `quality`. |
| directive | none found in the ontologies or specs | New term. |
| nonconformance | `ifqs:Nonconformance` (0001-quality-evidence) | The one record; this specification adds the rule broken (`act:NonconformityRule`) and no second class (FR-050). |
| tasking, qualification | none found | New terms. |
