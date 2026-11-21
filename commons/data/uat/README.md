# UAT kit for `commons/data`

A hands-on walk-through to test `commons/data` the way an application team would, on **a PostgreSQL you already have**: find it, set it up with `arcactl`, load a business-to-business (B2B) multi-tenant schema with **row-level security (RLS)**, connect with `psql` and DBeaver as people who own nothing, and check that every caller sees only the rows it is allowed to.

You do not need to know how `commons/data` is built. Follow the steps in order, copy each command as it is, and compare what you see with what this guide says you should see. When something differs, write it down in [`FINDINGS.md`](FINDINGS.md): a difference is a finding, not a mistake of yours.

**Time:** about 90 minutes. **Safe:** everything happens in one throw-away database, and step 16 takes it all out again.

> **Status of this guide.** The schema, the roles, the seed, the 25 scenarios and `arcactl` are run by this library's tests on a PostgreSQL that runs in process, so those parts are known to work. The shell scripts, `psql` and DBeaver steps need a real server and a person, so they have not been run by the author: if one of them does not work as written, that is the first finding to write down.

---

## 0. What you are testing

A **tenant** is one customer business of the platform. A **B2B platform** serves many tenants from the same tables, so the database itself must make sure that Acme never sees Globex's rows. That protection is **row-level security**: the database adds a hidden `WHERE tenant = <the caller's tenant>` to every query.

The kit has four tenants in a hierarchy, and an example application (accounts, contacts, support tickets, comments) whose every row carries its tenant:

```
platform ─┬─ northwind  (a reseller) ─┬─ acme     (a business)
          │                           └─ initech  (a business)
          └─ globex     (a business)
```

### Words you will meet

| Word | What it means here |
| --- | --- |
| **Scope** | The tenant (or tenants) a database session is acting for. A policy shows a row only if its `tenant_id` is in the session's scope. |
| **Seal / mark** | The scope is not a plain setting a caller could type: it carries a *mark* that only the **issuer** (the service that has authenticated the caller, here `arcactl scope`) can make with a secret key. A scope without a valid mark reaches nothing. |
| **Issuer** | Whoever holds the key and says "this session is for Acme". In your application it is your login service; in this kit it is the `arcactl scope` command. |
| **Reach** | How far a scope goes: one tenant (`--tenant acme`), a list or a tenant and those beneath it (`--subtree northwind`, for a reseller), or every tenant (`--all`, for a platform operator). |
| **Protected layer** | The tables are in the schema `data` and nobody but their owner may touch them; applications use *views* of them in the schema `api`. |
| **Roles** | `uat_reader` reads; `uat_writer` reads and writes; `uat_support` reads and writes tickets and comments; `uat_operator` is a platform operator who reads. None is a superuser or owns anything. |

All commands in this guide run **from the folder `commons/data`** of this repository, in a Bash or Zsh shell (on Windows, use WSL).

---

## 1. Check your tools

```bash
cd commons/data
bun --version          # Bun 1.3 or later
psql --version         # any PostgreSQL client, 14 or later
git --version
```

If `bun` is missing, install it from <https://bun.sh>. If `psql` is missing, install your platform's PostgreSQL *client* package (not necessarily the server).

Install the repository's dependencies once (from the repository's root):

```bash
(cd ../.. && bun install)
```

You will also want **DBeaver** (the free Community edition is enough): <https://dbeaver.io/download/>.

---

## 2. Find your PostgreSQL and set the workstation up

The kit does **not** start a database. It assumes PostgreSQL exists somewhere you can reach — your laptop, a shared dev server, a cloud instance — and part of what you are testing is whether `arcactl` helps you find it and set your workstation up for it.

You need a **superuser** login on that server (to create roles and an event-trigger guard) and an **empty database** that you may throw away.

### 2a. You know where it is

Tell `psql` (and everything built on libpq, including `arcactl`) with the standard variables:

```bash
export PGHOST=localhost        # your server's host name
export PGPORT=5432
export PGUSER=postgres         # a superuser
export PGDATABASE=postgres     # for now; the next command makes the UAT's own
```

If the server asks for a password, put it in `~/.pgpass` (a line `host:port:database:user:password`, file mode `0600`) or `export PGPASSWORD=...` for this shell only.

### 2b. You do not know where it is

Let `arcactl` look. It checks the usual places (your `pg_service.conf`, `.pgpass`, `PG*` variables, local sockets and the default port) and shows what it found; it changes nothing until you agree:

```bash
bun sql/cli/arcactl.ts init --discover
```

To set your workstation up for the instance you choose (it writes your `.pgpass` entry and `pg_service.conf` service, and shows every change before it makes it):

```bash
bun sql/cli/arcactl.ts init --dry-run     # shows what it would change, changes nothing
bun sql/cli/arcactl.ts init               # asks, shows each change, makes it only if you agree
```

`init --undo` takes away exactly what it put in. Then check the workstation:

```bash
bun sql/cli/arcactl.ts doctor --scope workstation
```

You should see `PASS` lines for your files and tools. A `WARN` or `FAIL` line says what to fix and gives a `next:` command. **Write down anything confusing in this step**: how a newcomer finds their database is part of what is being tested.

### 2c. Make the UAT database and check you can reach it

```bash
psql -c 'CREATE DATABASE arca_uat'
export PGDATABASE=arca_uat
psql -c 'SELECT version(), current_user, (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS superuser'
```

Expected: one row, your PostgreSQL version, your user, and `superuser = t`. If `superuser` is `f`, connect as a superuser instead; the next steps need one.

---

## 3. Give your shell what the kit needs

```bash
. uat/bin/env
```

(The leading dot matters: it *sources* the file.) The first time, it makes three secrets in `uat/.env.uat` — a password for the UAT's roles, the key of the seal, and its unlock secret — and tells you so. The file is **not committed** and is only readable by you. It also defines a shell function `arcactl` so that you can type `arcactl ...` in this shell.

Check:

```bash
arcactl --help | head -5
echo "${ARCA_SEAL_KEY:0:5}..."      # the first characters of your key: "seal-..."
```

Source `uat/bin/env` again in every new terminal.

---

## 4. Look before you leap (nothing touches the database)

`arcactl` can describe the models without a database. These commands are read-only:

```bash
arcactl list tables --module uat/models/crm.ts | head -20      # the tables: 4 of the example application, and the party and tenancy tables
arcactl list codes  --module uat/models/crm.ts | tail -5       # the code lists (status values and so on)
arcactl lint --module uat/models/crm.ts                         # holds the models to governance's rules
```

`lint` ends with a line like `0 errors, 13 warnings`. **Errors must be 0.** The warnings are about owners not being named; note them if you think they matter.

See what the SQL looks like *without* the seal (so the key is not in it):

```bash
arcactl sql --module uat/models/crm.ts --schema data --access | grep -A1 "CREATE POLICY" | head -8
```

You should see policies such as `customer_account_tenant_all`, each reading `current_setting('app.tenant', true)`. With the seal (step 6) the policies read the sealed scope instead.

---

## 5. Make the roles

Run this **as the superuser**, in `arca_uat`:

```bash
uat/bin/roles
```

Expected: a few `DO`/`GRANT` lines and `roles: done. Next: bin/schema`. It can be run again safely. Check:

```bash
psql -c "SELECT rolname, rolsuper, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname LIKE 'uat\_%' OR rolname LIKE 'crm\_%' ORDER BY 1"
```

Expected: eight roles. `rolsuper` and `rolbypassrls` are `f` for **every** one; `rolcanlogin` is `t` only for the four `uat_` roles. (A superuser or a role with `BYPASSRLS` ignores row security, so none of these may be one.)

---

## 6. Make the schema with `arcactl` and apply it with `psql`

```bash
uat/bin/schema
```

This runs `arcactl sql --module uat/models/crm.ts --schema data --protect crm_owner --seal --reach set --wildcard` and pipes it into `psql -v ON_ERROR_STOP=1`. What the flags mean:

| Flag | Meaning |
| --- | --- |
| `--module uat/models/crm.ts` | the example application, with arca's party and tenancy models |
| `--schema data` | the tables go in the schema `data` |
| `--protect crm_owner` | the protected layer: a view of each table in `api`, all owned by `crm_owner` |
| `--seal` | the scope must carry the issuer's mark (the key is `ARCA_SEAL_KEY`) |
| `--reach set` | a scope may list several tenants, separated by commas |
| `--wildcard` | the scope `*` reaches every tenant (the platform operator) |

> **Why a pipe?** The statements of a seal contain the key, because the database must hold it. They are piped straight into `psql` and never saved to a file. Do not redirect them to a file or paste them anywhere.

Expected: it ends with `schema: done. Next: bin/seed` and no `ERROR`. Now look at what was made:

```bash
psql -c '\dn'                                   # schemas: api, data, ifc_seal
psql -c '\dt data.*'                            # 17 tables
psql -c '\dv api.*'                             # a view of each
psql -c "SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'data' ORDER BY 1"
psql -c "SELECT relname, relrowsecurity AS rls_on, relforcerowsecurity AS forced FROM pg_class WHERE relnamespace = 'data'::regnamespace AND relname IN ('customer_account','contact','support_ticket','ticket_comment') ORDER BY 1"
```

Expected: four policies (`customer_account_tenant_all`, `contact_tenant_all`, `support_ticket_tenant_all`, `ticket_comment_tenant_all`), and `rls_on = t`, `forced = t` for the four tables. **`forced`** means even the tables' owner is held to the policy.

Look at one policy in full:

```bash
psql -c "SELECT qual FROM pg_policies WHERE tablename = 'contact'"
```

You should see `tenant_id` compared to `ifc_seal.scope('tenant')`: the policy asks the seal function for the *verified* scope, never for the raw setting.

---

## 7. Ask `arcactl doctor` for a health check

```bash
arcactl doctor --module uat/models/crm.ts --schema data --seal
```

Expected (the numbers may differ a little):

```
PASS  ARCA-D001  connection and server
PASS  ARCA-D002  initialised
      all 17 tables of the project's models are in data
PASS  ARCA-D003  drift from the model
WARN  ARCA-D004  ledger
      there is no ledger (lifecycle_ledger) in data: the tables were not made through the lifecycle ...
PASS  ARCA-D005  invariants in the database
PASS  ARCA-D006  guard against weakening the invariants
PASS  ARCA-D007  row security and the seal
      4 scoped tables: row security on, the seal in place, its key and its mark function closed to application roles
PASS  ARCA-D008  audit chain
PASS  ARCA-D009  what the database enforces

8 passed, 1 warned, 0 failed
```

The one `WARN` is expected: you made the tables with `psql`, not through `arcactl`'s lifecycle, so nothing was recorded in a ledger. **Anything `FAIL` is a finding.**

---

## 8. Load the seed

```bash
uat/bin/seed
```

It makes the five tenants as the superuser, then — for each of Northwind, Acme, Initech and Globex — asks `arcactl scope --tenant <name>` for that tenant's sealed scope and writes the tenant's sample rows **as `uat_writer` through the `api` views**. So every row goes in through the policy's write check. Expected: `seed: northwind`, `seed: acme`, `seed: initech`, `seed: globex`, then `seed: done. Next: bin/rls-check`.

As the superuser, row security does not apply, so you can count everything:

```bash
psql -c "SELECT tenant_id, count(*) FROM data.customer_account GROUP BY 1 ORDER BY 1"
```

Expected: `acme 2`, `globex 2`, `initech 2`, `northwind 2`.

---

## 9. Be a tenant in `psql`

`uat/bin/psql-as` opens `psql` as one of the UAT's people with a scope already set (it asks `arcactl scope` for it and removes its temporary startup file when you leave).

```bash
uat/bin/psql-as uat_reader --tenant acme
```

Try these, one at a time:

```sql
SELECT current_user, current_setting('app.tenant', true) AS scope_setting;
SELECT account_id, name, status FROM api.customer_account ORDER BY 1;
SELECT DISTINCT tenant_id FROM api.support_ticket;
SELECT * FROM data.customer_account;
INSERT INTO api.customer_account VALUES ('x', 'acme', 'X', 'active', now());
SELECT secret FROM ifc_seal.key;
```

| Statement | You should see |
| --- | --- |
| 1 | `uat_reader` and a long value `acme.<64 hex characters>` — the scope and its **mark** |
| 2 | two rows, `acme-a1` and `acme-a2` — Acme's, and nobody else's, though the table holds eight rows |
| 3 | one row: `acme` |
| 4 | `ERROR: permission denied for schema data` — applications use the views |
| 5 | `ERROR: permission denied for view customer_account` — a reader cannot write |
| 6 | `ERROR: permission denied for table key` — the seal's key is closed |

Leave with `\q`. Now the same as no tenant at all, and as a caller who tries to name its own tenant:

```bash
uat/bin/psql-as uat_reader
```

```sql
SELECT count(*) FROM api.customer_account;         -- 0: no scope, no rows (it fails closed)
SET app.tenant = 'acme';                           -- a caller trying to choose its own tenant
SELECT count(*) FROM api.customer_account;         -- still 0: no mark, no trust
SET app.tenant = 'acme.0000000000000000000000000000000000000000000000000000000000000000';
SELECT count(*) FROM api.customer_account;         -- still 0: a forged mark
```

### A writer, a reseller and a platform operator

```bash
uat/bin/psql-as uat_writer --tenant acme
```

```sql
INSERT INTO api.customer_account VALUES ('acme-a3', 'acme', 'Acme Retail', 'active', now());   -- works: INSERT 0 1
INSERT INTO api.customer_account VALUES ('globex-a9', 'globex', 'Sneaky', 'active', now());    -- ERROR: new row violates row-level security policy
UPDATE api.customer_account SET name = 'Hacked' WHERE tenant_id = 'globex';                    -- UPDATE 0: it cannot even see them
DELETE FROM api.customer_account WHERE account_id = 'acme-a3';                                  -- clean up your own row
```

A **reseller** acts for itself and the tenants beneath it. The issuer expands the hierarchy (`--subtree` reads the tenant table's `parent` links) and seals the list:

```bash
arcactl scope --subtree northwind --schema data        # what the issuer prints: the list, sealed
uat/bin/psql-as uat_reader --subtree northwind --schema data
```

```sql
SELECT DISTINCT tenant_id FROM api.customer_account ORDER BY 1;    -- acme, initech, northwind — and not globex
```

A **platform operator** sees every tenant, with the wildcard only the issuer can give:

```bash
uat/bin/psql-as uat_operator --all
```

```sql
SELECT DISTINCT tenant_id FROM api.customer_account ORDER BY 1;    -- acme, globex, initech, northwind
```

---

## 10. What `arcactl scope` prints

```bash
arcactl scope --tenant acme
arcactl scope --tenant acme,initech
arcactl scope --subtree northwind --schema data
arcactl scope --all
arcactl scope --tenant acme --local          # for one transaction only
arcactl scope --tenant acme --json
```

Each prints a statement of the form `SELECT set_config('app.tenant', '<tenants>.<mark>', false);` and says on stderr what it reaches. Read it: the **mark** is a hash that depends on the secret key; the key itself is never printed. Try to answer: *what would an attacker who steals this one statement be able to do?* (They can act for exactly that scope, in a session of their own, until it is cleared. Real issuers make a scope per request or per transaction — `--local`.) Write down what you think.

---

## 11. Be a tenant in DBeaver

1. Open DBeaver. **Database → New Database Connection → PostgreSQL → Next.**
2. Fill in **Host**, **Port** and **Database** (`arca_uat`) from step 2. **Authentication: Database Native.** Username `uat_reader`; Password: the value of `UAT_PASSWORD` in `uat/.env.uat` (`grep UAT_PASSWORD uat/.env.uat`). Leave "Show all databases" off.
3. Click **Test Connection** (let DBeaver download the driver if it asks), then **Finish**.
4. Open **SQL Editor → New SQL script** on that connection and run `SELECT current_user;` (`Ctrl+Enter`). You should see `uat_reader`.
5. Without a scope, run `SELECT count(*) FROM api.customer_account;` → `0`.
6. In a terminal (not DBeaver — it must never hold the key) make the scope: `arcactl scope --tenant acme`. Copy the whole `SELECT set_config(...)` line it prints, paste it into the DBeaver editor and run it.
7. Run the check below → Acme's two rows (and `acme` only).

   ```sql
   SELECT account_id, name FROM api.customer_account ORDER BY 1;
   SELECT DISTINCT tenant_id FROM api.customer_account;
   ```

   Then run [`dbeaver/scopes.sql`](dbeaver/scopes.sql)'s checks and the "things to try" at the bottom: each must be refused or come back empty.
8. **Switch tenant:** make a scope for `globex` the same way and run it; run the select again → Globex's rows.
9. **Clear it:** run `RESET app.tenant;` and the select returns `0` again.

DBeaver works in **autocommit** and keeps one session per editor, so a scope you set stays until you clear it or close the editor/connection. That is why `arcactl scope` sets it for the *session* by default.

**Make a connection that always starts as Acme:** *Edit Connection → Initialization → Bootstrap queries → Configure* and add the `set_config` line. Every new session of that connection starts with that scope. (The mark does not expire. Treat a saved scope like a saved password.)

**Look at the schema:** expand **arca_uat → Schemas → api → Views**; right-click the `api` schema → **View Diagram** for an ER diagram. Open a view → **Properties / Columns / Foreign Keys / DDL**. Do the same for `data` as the **superuser** connection (make a second connection with `PGUSER`'s credentials) — the application roles cannot see the tables.

---

## 12. Run every scenario

```bash
uat/bin/rls-check
```

It connects as the superuser (to read the tenants) and as each role, runs 25 scenarios — each in a transaction it rolls back, so nothing is left behind — and prints:

```
PASS  S01  A tenant sees only its own rows
      tenant_id: acme
PASS  S02  ...
...
GAP   S25  GAP: a ticket may point at another tenant's account
      the gap is still there: ticket_id: acme-t9

24 passed, 1 known gap, 0 failed
```

**Every scenario must be `PASS`, except S25, which must be `GAP`.** A `FAIL` is a finding; read its line. To see what a scenario does, so you can run it by hand:

```bash
uat/bin/rls-check --explain --only S10,S12
uat/bin/rls-check --only S01,S03
```

`S25` is a limit the kit records on purpose (see `FINDINGS.md`): the scenario passes while the limit is there and **fails when someone fixes it**, so the finding is revisited.

---

## 13. Break row security on purpose, and let `doctor` find it

Row security cannot be switched off by accident:

```bash
psql -c 'ALTER TABLE data.contact DISABLE ROW LEVEL SECURITY'
```

Expected: `ERROR: the table data.contact is changed only by a migration`. A superuser who *means* to must say so twice — that a migration is running, and the unlock secret. Do it, in **one** `psql` session:

```bash
psql <<SQL
SELECT set_config('ifc.ddl_unlock', '$ARCA_UNLOCK_SECRET', false), set_config('lifecycle.migrating', 'on', false);
ALTER TABLE data.contact NO FORCE ROW LEVEL SECURITY;
SQL
arcactl doctor --module uat/models/crm.ts --schema data --seal | grep -A1 D007
```

Expected: `FAIL  ARCA-D007 ... row security is not forced on contact: its owner sees every row`. Repair it and check again:

```bash
psql <<SQL
SELECT set_config('ifc.ddl_unlock', '$ARCA_UNLOCK_SECRET', false), set_config('lifecycle.migrating', 'on', false);
ALTER TABLE data.contact FORCE ROW LEVEL SECURITY;
SQL
arcactl doctor --module uat/models/crm.ts --schema data --seal | grep -A1 D007
```

Expected: `PASS  ARCA-D007`.

---

## 14. Review the schema for your application's integration

Collect the facts an integration needs:

```bash
arcactl generate dictionary --module uat/models/crm.ts | less      # every table and column with its meaning, type and tags
arcactl generate mermaid    --module uat/models/crm.ts | less      # the entity-relationship diagram as text (paste into https://mermaid.live)
arcactl generate register   --module uat/models/crm.ts | less      # a register of personal data and security: who may read what, what is personal
arcactl generate zod        --module uat/models/crm.ts | less      # TypeScript validators for the rows
arcactl generate rust       --module uat/models/crm.ts | less      # Rust types for the rows
arcactl list invariants     --module uat/models/crm.ts             # rules the database enforces
```

The data models of the whole library, by subject, are also on the documentation site's **Models** tab.

Go through this list and record each answer in `FINDINGS.md`:

| Question | Where to look |
| --- | --- |
| Are table and column **names** what the application team expects (snake case, no surprises)? | `\d api.customer_account`, the dictionary |
| Does **every** table that holds customer data carry a tenant column, and is it `NOT NULL`? | `\d data.contact`, the scenarios |
| Are **ids** the right type (text here) for your keys? Who makes them? | the dictionary |
| Are **foreign keys** what you expect, and does anything stop a row pointing at another tenant's row? | scenario S25, `FINDINGS.md` |
| Which **role** may read or write which table, and does that match your job functions? | `\dp api.*` |
| What does the application **do at the start of each request or transaction**? | below |
| Which columns are **personal data**, and are they marked? | the dictionary (`privacy` tags) |

**How an application uses this.** Your login service authenticates the caller, then — on the connection it takes from the pool, **inside the transaction** — runs the sealed scope statement for that caller, then the caller's queries:

```ts
import { scopeStatement } from "@intellectual-frontiers/data/sql/extensions/access";

await tx.exec(scopeStatement(process.env.ARCA_SEAL_KEY!, "tenant", "acme", "app", true)); // `true`: for this transaction only
const rows = await tx.query(`SELECT * FROM api.customer_account`);                         // only Acme's
```

Using the **transaction** form (`SET LOCAL` semantics) matters with a connection pool: the scope cannot leak to the next request that gets the same connection. For a list or the wildcard, build the grant with `grantOf(["acme", "initech"])` or `grantOf("*")`.

---

## 15. Record what you found

Open [`FINDINGS.md`](FINDINGS.md) in your editor:

```bash
${EDITOR:-nano} uat/FINDINGS.md
```

It already lists what the kit knows; add yours using the template. For each finding say **what you did, what you expected, what happened**, and how bad it is.

---

## 16. Clean up

```bash
uat/bin/reset         # asks you to type "yes", then drops the schemas data, api and ifc_seal and the uat_* and crm_* roles
psql -d postgres -c 'DROP DATABASE arca_uat'      # if the whole database was for the UAT
rm uat/.env.uat       # the next run makes new secrets
bun sql/cli/arcactl.ts init --undo                # if you ran `init` in step 2 and want your workstation files back as they were
```

`bin/reset` is itself tested: after it, the schema can be made again from step 5.

---

## Troubleshooting

| You see | It means / do this |
| --- | --- |
| `psql: error: connection to server ... failed` | the `PG*` variables are wrong, or the server is down or not reachable; redo step 2 |
| `permission denied to create role` / `must be superuser` | step 5/6 needs a superuser; set `PGUSER` to one |
| `ERROR: role "crm_owner" does not exist` in step 6 | run `uat/bin/roles` (step 5) first |
| `ERROR: ... changed only by a migration` | the guard is working: it refuses to change a protected table; see step 13 for how a person overrides it deliberately |
| `bin/seed` fails with `password authentication failed for user "uat_writer"` | `UAT_PASSWORD` changed after the roles were made; run `uat/bin/roles` again (it resets the password) |
| `--seal needs a key ... ARCA_SEAL_KEY` | you did not source the environment: `. uat/bin/env` |
| `rls-check` says it needs `ARCA_SEAL_KEY` and `UAT_PASSWORD` | the same |
| every select returns 0 rows in DBeaver | the scope is not set in *that* editor's session; run the `set_config` line again |
| DBeaver "no pg_hba.conf entry" | your server does not allow this user from your address: ask the server's owner, or connect from where it is allowed |
| `could not connect to read the tenants` from `arcactl scope --subtree` | `--subtree` reads the tenant table with *your* connection (`PG*` variables): use the superuser's, not a role's |

---

## What is in this folder

| Path | What it is |
| --- | --- |
| `README.md`, `FINDINGS.md` | this guide, and where to record what you find |
| `models/crm.ts` | the example application: four tables for a B2B support product, each in a tenant |
| `sql/roles.sql`, `sql/reset.sql` | make and remove the roles (and everything else) |
| `seed/` | the tenants and each tenant's sample rows |
| `scenarios/` | the 25 row-security scenarios as data, and the runner |
| `bin/env`, `bin/roles`, `bin/schema`, `bin/seed`, `bin/psql-as`, `bin/rls-check`, `bin/reset` | one script for each step above |
| `dbeaver/scopes.sql` | snippets to paste into a DBeaver editor |
| `.env.uat` | your secrets, made by `bin/env`; **never committed** |

Spec: [`0071-uat-kit`](../spec-kit/specs/0071-uat-kit/spec.md). The row security it exercises is `0009-sql-features` (FR-008 to FR-010, FR-019, FR-020) and `0014-sql-protected-access`; `arcactl` is `0046-arcactl` and `0051-project-cli`.
