# Drafts for review: 2026-10-09 audit

Nothing here is loaded or in force. These files sit outside `ontology/`. Each statement is a proposal for the founder to accept, change or drop.

| File | What it proposes |
|---|---|
| `2026-10-09-mappings.ttl` | 8 tie lines to established terms (schema.org, W3C Organization Ontology, Dublin Core, ODRL). |
| `2026-10-09-decisions.ttl` | 2 new Decisions (Native Alpha and Acquired Alpha; IPLG) and 2 added alternatives on existing Decisions (digital twin; borrowed words). |

Effect, checked on a throwaway copy of both ontologies with the scan: the unmapped count falls from 631 to 615, the reused count rises from 43 to 56 and the excepted count from 108 to 111. Company, Fund, Copyright, Trademark, PatentFamily, TradeSecret and DefensiveDisclosure are tied through their parents, so they need no line of their own.

## How to accept

1. For a mapping: copy the statement onto its subject in `ontology/ifcore.ttl` and add the `odrl:` prefix once.
2. For a Decision: copy it into `ontology/ifcore.ttl` beside the related Decisions, set `ifcore:decidedBy` and `ifcore:decidedAt`, and resolve every reason marked CONFIRM.
3. Run `agora check` and the scan (`python3 -I tools/agora/vocabulary_scan.py --root .github=. --status unmapped`).

## Points that need a person

- **Rejection reasons.** The repository holds no record of why each name was chosen. Reasons marked CONFIRM are drafted from the definitions and the audit's sources.
- **Digital twin.** If you hold that an Eidolon is a digital twin, keep the name and add a `skos:closeMatch` instead of the rejection.
- **Existing Decisions.** Adding an alternative to an accepted Decision changes a record (`0008-decision-records` FR-008, FR-009). The alternative is to write a new Decision that supersedes it.
- **Assets.** `ifcore:Asset` and its seven children cite ISO 55000. The 2014 edition is withdrawn and a 2024 edition replaces it (iso.org committee listing). Cite the current edition, and choose a stable IRI for the tie. No mapping is drafted because no verified IRI was found.
- **Not drafted:** PatentFamily's own class, Disposition, ControlTest, SharedService, Note, Fact. Audience is a rename candidate, not a mapping.
