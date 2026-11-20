// Spec: 0043-sql-invariants FR-001, FR-006
/**
 * What each dialect can enforce in the database (commons data 0043-sql-invariants FR-006), and the vocabulary that says what must always be true of the records of a concept (FR-001): the tiers of
 * the three dialects, where each guarantee is enforced for each, and that every invariant of the identity model is enforced by the database itself on the engines that can.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/test";
import { annotate, attribute, codeList, codeOf, concept, domain, identifier, integer, lint, vocabularies } from "@intellectual-frontiers/data/governance";
import { placed } from "@intellectual-frontiers/data/sql/extensions/invariants";
import { enforcementOf, where } from "@intellectual-frontiers/data/sql/physical";
import { composeModules, moduleOf } from "@intellectual-frontiers/data/governance";
import { partyDomain } from "@intellectual-frontiers/data/models/arca";
import { tenancyModule } from "@intellectual-frontiers/data/models/arca-tenancy";
import { identityModule } from "@intellectual-frontiers/data/models/identity";
import { identityAbacModule } from "@intellectual-frontiers/data/models/identity-abac";
import { identityAccessModule } from "@intellectual-frontiers/data/models/identity-access";
import { identityAgentModule } from "@intellectual-frontiers/data/models/identity-agent";
import { identityDelegationModule } from "@intellectual-frontiers/data/models/identity-delegation";
import { identityRebacModule } from "@intellectual-frontiers/data/models/identity-rebac";
import { projectDomain } from "@intellectual-frontiers/data/sql/logical";
import { DIALECTS } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";

const { quality } = vocabularies;
const [sqlite, duckdb, postgres] = [DIALECTS[0].dialect, DIALECTS[1].dialect, DIALECTS[2].dialect];

proves(
  ["0043-sql-invariants FR-006"],
  "a dialect says what it can enforce in the database (PostgreSQL everything, SQLite checks, keys and triggers, DuckDB checks and keys), and each guarantee is placed in the database or in the application's runtime, with why",
  () => {
    same([enforcementOf(postgres).tier, enforcementOf(sqlite).tier, enforcementOf(duckdb).tier], ["full", "standard", "basic"]);
    same(enforcementOf(postgres).cannot, [], "PostgreSQL can do all of it");
    assert(enforcementOf(postgres).can.includes("event-trigger") && enforcementOf(postgres).can.includes("row-security") && enforcementOf(postgres).can.includes("advisory-lock"));
    assert(enforcementOf(sqlite).can.includes("trigger") && !enforcementOf(sqlite).can.includes("row-security") && !enforcementOf(sqlite).can.includes("grant"));
    assert(!enforcementOf(duckdb).can.includes("trigger") && enforcementOf(duckdb).can.includes("check") && enforcementOf(duckdb).can.includes("foreign-key"));
    assert(enforcementOf(duckdb).cannot.every((c) => c.because.includes("duckdb")));
    same(where(postgres, "append-only"), { by: "database", via: "a trigger" });
    same(where(sqlite, "status-moves").by, "database");
    same(where(duckdb, "status-moves").by, "application");
    same([where(postgres, "row-isolation").by, where(sqlite, "row-isolation").by, where(duckdb, "row-isolation").by], ["database", "application", "application"]);
    same([where(postgres, "no-weakening").by, where(sqlite, "no-weakening").by], ["database", "application"]);
    same([where(postgres, "least-privilege").by, where(sqlite, "least-privilege").by], ["database", "application"]);
    // the identity model: every invariant is enforced in the database where the dialect can
    const d = composeModules("app", {}, [moduleOf(partyDomain.kind === "ok" ? partyDomain.value : (undefined as never)), tenancyModule, identityModule, identityAccessModule, identityAbacModule, identityRebacModule, identityDelegationModule, identityAgentModule]);
    assert(d.kind === "ok");
    if (d.kind !== "ok") return;
    const p = projectDomain(d.value);
    assert(p.kind === "ok");
    if (p.kind !== "ok") return;
    const tables = p.value.schema.tables;
    const pg = placed(tables, postgres);
    assert(pg.length >= 8 && pg.every((i) => i.by === "database"), "on PostgreSQL every invariant is the database's to enforce");
    assert(placed(tables, sqlite).every((i) => i.by === "database"), "and on SQLite");
    assert(placed(tables, duckdb).every((i) => i.by === "application" && i.via.includes("no triggers")), "on DuckDB each is the application's, and says why");
  },
);

proves(
  ["0043-sql-invariants FR-001"],
  "the vocabulary says a concept is append-only (perhaps as a chain), that a status moves only along its moves and that a number is never above another, and lint finds a member or a code that is not there",
  () => {
    const status = codeList("phase", { definition: "A phase", codes: { open: { label: "Open", definition: "Open" }, shut: { label: "Shut", definition: "Shut" } } });
    const make = (attrs: Record<string, ReturnType<typeof attribute>>, annotations: ReturnType<typeof annotate>[]) => {
      const c = concept("thing", { definition: "A thing", attributes: { id: attribute(identifier(), { definition: "Identity" }), ...attrs }, identifiedBy: ["id"], annotations });
      const r = domain("d", { definition: "D", concepts: [c], codeLists: [status] });
      assert(r.kind === "ok", JSON.stringify(r));
      return r.kind === "ok" ? lint(r.value, [quality.vocabulary]).map((f) => `${f.rule}:${f.message}`) : [];
    };
    const n = (d: string) => attribute(integer(), { definition: d });
    same(make({ used: n("Used"), cap: n("Cap") }, [annotate(quality.atMost, { member: "used", other: "cap" })]), []);
    same(make({ used: n("Used") }, [annotate(quality.atMost, { member: "used", other: "nope" })]).length, 1, "a member that is not there");
    same(make({ from: n("From"), to: n("To") }, [annotate(quality.temporal, { validFrom: "from", validTo: "to" })]), [], "an effective-dated concept names its members");
    same(make({ from: n("From") }, [annotate(quality.temporal, { validFrom: "from", validTo: "gone" })]).length, 1, "a temporal end that is not a member");
    same(make({ n: n("N") }, [annotate(quality.appendOnly, { chain: { hash: "n", previous: "n", sequence: "n", genesis: "g" } })]), []);
    same(make({ n: n("N") }, [annotate(quality.appendOnly, { chain: { hash: "missing", previous: "n", sequence: "n", genesis: "g" } })]).length, 1);
    same(make({ s: attribute(codeOf(status), { definition: "Where it is", annotations: [annotate(quality.transitions, { allowed: { open: ["shut"], shut: [] } })] }) }, []), []);
    assert(make({ s: attribute(codeOf(status), { definition: "Where it is", annotations: [annotate(quality.transitions, { allowed: { open: ["gone"] } })] }) }, []).length === 1, "a code that is not in the list");
    assert(make({ s: attribute(integer(), { definition: "Count", annotations: [annotate(quality.transitions, { allowed: {} })] }) }, []).length === 1, "an attribute that is not a code");
  },
);
