# Acceptance kits of `commons/data`

Acceptance is testing by people, or by agents acting as people, for the experience beyond the code: whether someone who did not write the library can find their way, set it up, use it and trust what it does. The kits here are **synthetic**: they use made-up businesses, tenants and data, and they are meant to be run by a person or an agent following a guide, and also checked by machine so that they do not go stale.

## The words

| Term | What it tests |
| --- | --- |
| **Acceptance** | the family: everything below |
| **OAT**, outcomes acceptance | that the library delivers the outcome a team bought it for, end to end |
| **UAT**, user acceptance | that a person can use it: the guide, the commands, the messages, the tools they meet |
| **AAT**, agent acceptance | that an agent acting as such a person can do the same, from the documentation alone |

A library may have an optional folder for them, named by its own convention: `acceptance/`, `oat/`, `uat/` or `aat/`. This library uses **`acceptance/`**, with one folder for each kit, each kit saying in its README which kind it is.

## Kits

| Kit | Kind | What it is |
| --- | --- | --- |
| [`arcactl-pg/`](arcactl-pg/README.md) | UAT | find a PostgreSQL, set it up with `arcactl`, load a business-to-business multi-tenant schema with row-level security and check it as roles that own nothing, with `psql` and DBeaver |

## Three tiers of specifications, one way

| Tier | Where | What it says |
| --- | --- | --- |
| the repository's | `commons/spec-kit/` | the rules of the repository |
| the library's | `commons/data/spec-kit/` | what `commons/data` does |
| the acceptance kits' | `acceptance/spec-kit/` | what a kit contains and proves |

An acceptance specification may cite the library's and the repository's. **Nothing of the library's or the repository's, and no test of the library's suite, may name an acceptance specification or a kit**: the check finds one that does. What an acceptance run teaches about the library (a missing flag, a connection that does not work) is fixed in the library, specified and tested there, as the first kit's findings were (`arcactl scope`, `doctor --module`, the connection that reads `PGSERVICE` and `.pgpass`).

The library's unit and integration tests are in `suite/` and are never moved here: they run on every change. The kits' own checks (`<kit>/checks/`) are about the kits, and run with them.

## Running

From `commons/data`:

```bash
bun run acceptance
```

It type-checks the kits, holds `acceptance/spec-kit` to the rules of a spec kit, traces each kit's sources and checks to its specifications, checks that the table of enforcement says what the checks say and that the tiers stay apart, and runs the kits' checks. It is not part of `verify`: a synthetic kit does not gate the library. A kit may start a server of its own for its checks where one is installed (`arcactl-pg` does, and says so where none is: set `ACCEPTANCE_REQUIRE_PG=1` to make that a failure).

## Adding a kit

1. Make `acceptance/<kit>/` with a README that says its kind (OAT, UAT or AAT) and gives the steps, and a `FINDINGS.md`.
2. Put what it tests the kit with in `models/`, `scenarios/`, `seed/`, `bin/` and the like, and its checks in `<kit>/checks/*.test.ts`, each `proves([...])` naming a requirement of the next step.
3. Specify it in `acceptance/spec-kit/` (`registry.tsv`, `specs/NNNN-slug/spec.md`, a row for each requirement in `enforcement.tsv`), numbered from 0001 with no gap.
4. Run `bun acceptance/tools/check.ts --write` to write the notes of the table of enforcement, then `bun run acceptance`.
