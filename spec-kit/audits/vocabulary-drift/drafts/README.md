# Drafts for review: Audience rename

Nothing here is in force. The patches are made against `main` as of 2026-10-09 and were checked with `git apply --check`.

| File | Repository | What it does |
|---|---|---|
| `2026-10-09-audience-rename.github.patch` | `.github` | Renames the class `ifcore:Audience` to `ifcore:AccessAudience` (label "Access audience"), updates its 8 references in `ontology/ifcore.ttl`, adds the Decision `AccessAudienceName` with three rejected alternatives, and names the class in the key entity of `0001-eidolon-architecture`. |
| `2026-10-09-audience-rename.eidolon.patch` | `eidolon` | Updates the one reference in `ontology/ifpriv.ttl` (`ifpriv:retiredAt`). |

## What changes and what does not

- **Renamed:** the class only. Nine references in two files. The individuals `Public` and `CompanyAffiliated`, and the subclasses `Agreement` and `RoleOrGroup`, keep their names and keep their parent.
- **Not renamed:** the property `ifcore:hasAudience`. It is a different term from `schema:audience`, it does not clash, and it appears about 5,100 times in 459 files across the two repositories. `grantsAudience` and `ifpriv:broadensAudienceTo` also keep their names.
- **Prose:** "audience" stays the word in specs and rules (AGENTS.md, 0001 FR-011).
- **Old address:** the draft is a clean break: `ifcore:Audience` stops existing, as for a renamed command (`0006-eid-command-line` FR-034). Any outside consumer of the old address would break. The alternative is to keep the old class as a deprecated twin (`owl:deprecated true` and `owl:equivalentClass`); the repository has no rule for it.
- **Effect on the scan:** `AccessAudience` is excepted by the Decision, and `Agreement` and `RoleOrGroup` follow it. Unmapped falls from 615 to 613.

## To accept

`git apply` each patch in its repository, set the date in `AccessAudienceName` (the draft carries a placeholder), run `agora check` and `eid check ontology`, and push.

## Choices

1. **Rename the class** (this draft), **keep the name** with an exception Decision that records the clash, or **rename the property too** (about 5,100 edits).
2. **Name:** `AccessAudience` (drafted), or `AccessScope`, `Visibility`, `Clearance`.
3. **Old address:** clean break (drafted) or deprecated twin.
