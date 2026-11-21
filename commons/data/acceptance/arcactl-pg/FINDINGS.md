# Findings

Record what you find while you follow [`README.md`](README.md). A finding is anything that did not do what the guide said, was hard to understand, or that you think an application team will trip over. A confusing step is a finding too.

## How to write one

Copy the template at the bottom, one for each finding. Say **what you did** (the exact command), **what you expected**, **what happened** (paste the output, **never** a password, the key or a mark) and **how bad** it is:

- **blocker**: you cannot go on, or the data of one tenant could reach another
- **major**: it works but misleads, or an application team would need a workaround
- **minor**: wording, a rough edge, a nicer way

## Known when the kit was made

The kit's author knew of these. They are here so that you can confirm them, judge their weight and decide what to do; they are not a list of things that are fixed.

| # | Finding | Weight (author's view) | Where it is shown |
| --- | --- | --- | --- |
| K1 | **A row may point at another tenant's row.** A foreign key is checked without row security, and governance has no composite key that carries the tenant, so a writer who knows another tenant's account id can create a ticket that references it. The row is still its own tenant's and the writer cannot read what it points at, but the reference exists and a join by a more privileged role would follow it. | major | scenario S25 (`GAP`) |
| K2 | **There is no foreign key from `tenantId` to the tenant table**, so a row can carry a tenant that does not exist. Governance's design notes describe a `scoped()` overlay that would add it; it is not built. | major | `\d data.customer_account` |
| K3 | **The scope is for the session** in a tool that runs in autocommit (DBeaver, `psql -c`), so it stays until it is cleared; and an application on a pool must set it *for the transaction* or it can leak to the next request. The mark does not expire. | major, by design | README steps 11 and 14 |
| K4 | **The statements of `arcactl sql --seal` hold the seal's key**, because the database must hold it. They are for a pipe into `psql`, not for a file or a log. | minor, by design | README step 6 |
| K5 | **A reach of `*` can write too**, not only read: the policy's write check is the same test as its read test. The kit gives the wildcard to a role that can only read (`uat_operator`); an application that gives it to a writer lets that writer write into any tenant. | decide | `arcactl scope --all`, scenario S18 |
| K6 | **A reseller's reach is whatever the issuer lists.** The policies trust the sealed list; the hierarchy is read by `arcactl scope --subtree` from the tenant table's `parent` links when the scope is made. A tenant moved afterwards is not in a scope already issued, and the `ancestry` column is not used (its maintenance is a later specification). | decide | scenario S16 |
| K7 | **`arcactl doctor` warns that there is no ledger** for a database made with `psql`, since nothing was recorded by the lifecycle. Expected here; a team that applies the schema this way will see it on every run. | minor | README step 7 |
| K8 | **DBeaver, macOS and Windows (WSL) were not run.** Everything else in the guide is run by the kit's checks on a real PostgreSQL 16 on Linux (and the schema, roles, seed and scenarios also on PostgreSQL 18 in process). | confirm | README status box |
| K9 | **`arcactl init --discover` finds a local server only on the default port, 5432.** A server on another port or another host that is not already in your `pg_service.conf`, `.pgpass` or `PG*` variables is "no instances were found", though `pg_lsclusters` shows it. The guide tells the reader to give the host and port to `init` by hand. | major, for a newcomer | README step 2b |
| K10 | **`arcactl init` refuses where there is no terminal** (a pipeline, a container) unless `--interactive` is given, and its plan shows what it would write even with `--discover`; it writes nothing without `--yes` or an answer at the terminal. | minor | README step 2b |
| K11 | **A service in `pg_service.conf` wins over the `PG*` variables** (libpq's rule, not `arcactl`'s), so `PGUSER=uat_writer psql` still connects as the service's user. The kit's scripts use `psql -U`. An application that connects through a service must know this. | minor | `bin/seed`, `bin/psql-as` |

## Found while the kit was being made, and fixed

Recorded so that you know the kit's first run already changed `arcactl`; they are the kind of thing a UAT is for.

| # | Finding | What was done |
| --- | --- | --- |
| F1 | `arcactl sql` could not write row security, the protected layer or the seal, and there was no way for a person to make a sealed scope. | `sql` takes `--access`, `--protect`, `--seal`, `--reach`, `--wildcard`, `--prefix` (0051 FR-006); `arcactl scope` makes the scope (0046 FR-012). |
| F2 | The policies could only match one tenant, so a reseller or a platform operator could not be served. | a reach of a set, and a wildcard (0009 FR-020). |
| F3 | `arcactl doctor` could not hold a project's own module, so on the kit's database it reported four tables to drop and no scoped table. | `doctor --module` (0046 FR-013). |
| F4 | `arcactl generate` said it took `mermaid`, `dictionary` and so on, but only accepted `sql.generate.mermaid`-style ids. | both are accepted (0051 FR-004). |
| F5 | A module of a project's own had a domain with no definition, so `lint` reported an error that was not the project's. | the domain is given one. |
| F6 | **Found on the real server:** `arcactl doctor` and `arcactl scope --subtree` could not connect through the service and the `.pgpass` line that `arcactl init` had just written, although `psql` did: Bun's client reads neither file. | `arcactl` resolves `PGSERVICE` and `.pgpass` itself, in libpq's order, and a password found in a file is in no error (0046 FR-014). |
| F7 | **Found on the real server:** `bin/seed` and `bin/psql-as` connected as the service's user, not the role asked for, because the service wins over `PGUSER`. | both use `psql -U`; `rls-check` builds its role connections from the resolved target. |
| F8 | **Found on the real server:** `bin/psql-as` printed the scope and its mark on the screen, and the break step printed the unlock secret. | the result is sent to nowhere (`\o /dev/null`) and the break step uses `\gset`. |
| F9 | **Found on the real server:** the seed could not be run a second time (duplicate keys). | each insert says `ON CONFLICT DO NOTHING`. |

## Template

```
### <short title>
- **Step:** README step N (or scenario Sxx)
- **Weight:** blocker | major | minor
- **I did:**
- **I expected:**
- **What happened:**
- **Notes:**
```

## Your findings

(none yet)
