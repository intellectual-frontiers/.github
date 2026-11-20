// Spec: 0028-modules FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
/**
 * Modules (commons data 0028-modules): subject areas as values, composed by a project into one domain that is validated whole, so that a module that is not listed has no table; references run
 * only down the requirements; and models may import the models they require, acyclically.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/test";
import {
  attribute,
  codeList,
  codeOf,
  composeModules,
  concept,
  defineModule,
  identifier,
  moduleOf,
  relationship,
  text,
  withRequired,
} from "@intellectual-frontiers/data/governance";
import { person, partyDomain } from "@intellectual-frontiers/data/models/arca";
import { projectDomain } from "@intellectual-frontiers/data/sql/logical";
import { KERNEL, layerFindings } from "../tools/layers.ts";
import { same } from "./governance-fixture.ts";

const id = { id: attribute(identifier(), { definition: "What identifies it" }) };
const name = (d: string) => attribute(text(), { definition: d });
const arca = moduleOf((partyDomain.kind === "ok" ? partyDomain.value : (undefined as never)));
const status = codeList("accountStatus", { definition: "Where an account is", codes: { open: { label: "Open", definition: "Open" }, closed: { label: "Closed", definition: "Closed" } } });
const account = concept("billingAccount", {
  definition: "What is billed",
  attributes: { ...id, label: name("What it is called"), state: attribute(codeOf(status), { definition: "Where it is" }) },
  identifiedBy: ["id"],
  relationships: { owner: relationship(person, { cardinality: "one", definition: "Who owns it" }) },
});
const billing = defineModule({ name: "billing", requires: ["arcaParty"], concepts: [account], codeLists: [status] });
const invoice = concept("invoice", { definition: "What is asked for", attributes: { ...id, total: name("The sum") }, identifiedBy: ["id"], relationships: { account: relationship(account, { cardinality: "one", definition: "Of what" }) } });
const invoicing = defineModule({ name: "invoicing", requires: ["billing"], concepts: [invoice] });
const orderLine = concept("orderLine", { definition: "A line", attributes: { ...id }, identifiedBy: ["id"], relationships: { invoice: relationship(invoice, { cardinality: "one", definition: "On which" }) } });
const ordering = defineModule({ name: "ordering", requires: ["arcaParty"], concepts: [orderLine] });
const tables = (d: ReturnType<typeof composeModules>): string[] => {
  if (d.kind !== "ok") throw new Error(JSON.stringify(d.error));
  const p = projectDomain(d.value);
  if (p.kind !== "ok") throw new Error(JSON.stringify(p.error));
  return p.value.schema.tables.map((t) => t.name.join(".")).sort();
};

proves(
  ["0028-modules FR-001", "0028-modules FR-002", "0028-modules FR-004"],
  "a project composes the modules it lists into one domain, and a module that is not listed has no table",
  () => {
    same(arca.name, "arcaParty");
    assert(Object.isFrozen(arca) && Object.isFrozen(arca.concepts));
    const party = tables(composeModules("shop", { definition: "A shop" }, [arca]));
    const withBilling = tables(composeModules("shop", {}, [billing, arca]));
    assert(party.includes("party") && !party.includes("billing.account"));
    assert(withBilling.includes("billing.account") && withBilling.includes("party") && !withBilling.includes("invoice"), "billing and what it requires, and nothing of invoicing");
    const all = tables(composeModules("shop", {}, [invoicing, billing, arca]));
    same(all.filter((t) => !party.includes(t)), ["billing.account", "invoice"]);
    const d = composeModules("shop", {}, [invoicing, billing, arca]);
    assert(d.kind === "ok");
    if (d.kind === "ok") same(d.value.concepts.slice(-2).map((c) => c.name), ["billingAccount", "invoice"], "a module after those it requires");
    assert(composeModules("shop", { definition: "x" }, [arca]).kind === "ok" && (composeModules("shop", { definition: "x" }, [arca]) as { value: { name: string } }).value.name === "shop", "named by the project");
  },
);

proves(
  ["0028-modules FR-002", "0028-modules FR-003"],
  "a required module that is not listed, a cycle, two modules with one name, a concept twice, a reference sideways and the errors of the domain are errors as values",
  () => {
    const bad = (modules: Parameters<typeof composeModules>[2]): string[] => {
      const r = composeModules("shop", {}, modules);
      return r.kind === "err" ? r.error.map((e) => e.kind) : ["ok"];
    };
    same(bad([billing]), ["missing"], "arca is not listed");
    same(bad([arca, arca]), ["duplicate-module"]);
    const a = defineModule({ name: "a", requires: ["b"], concepts: [] });
    const b = defineModule({ name: "b", requires: ["a"], concepts: [] });
    same(bad([a, b]), ["cycle"]);
    const other = defineModule({ name: "other", requires: ["arcaParty"], concepts: [person] });
    same(bad([arca, other]), ["ok"], "the very same concept in two modules is one concept");
    same(bad([arca, defineModule({ name: "alone", concepts: [person] })]), ["undeclared-dependency"], "and what it refers to must be required");
    const twin = concept("person", { definition: "Another", attributes: { ...id }, identifiedBy: ["id"] });
    same(bad([arca, defineModule({ name: "twin", concepts: [twin] })]), ["duplicate-element"]);
    // ordering refers to invoice, which is listed and is not required by it: sideways
    const r = composeModules("shop", {}, [arca, billing, invoicing, ordering]);
    assert(r.kind === "err" && r.error.length === 1 && r.error[0]?.kind === "undeclared-dependency" && r.error[0].module === "ordering" && r.error[0].refersTo === "invoice" && r.error[0].in === "invoicing", JSON.stringify(r));
    // a code list of a module that is not required
    const other2 = defineModule({ name: "elsewhere", requires: ["arcaParty"], concepts: [concept("thing", { definition: "A thing", attributes: { ...id, state: attribute(codeOf(status), { definition: "s" }) }, identifiedBy: ["id"] })] });
    const c = composeModules("shop", {}, [arca, billing, other2]);
    assert(c.kind === "err" && c.error[0]?.kind === "undeclared-dependency" && c.error[0].refersTo === "accountStatus", JSON.stringify(c));
    // the errors of the domain: a concept with no identifier
    const noKey = defineModule({ name: "nokey", concepts: [concept("loose", { definition: "x", attributes: { n: name("n") }, identifiedBy: [] })] });
    assert(bad([noKey]).join() === "domain");
  },
);

proves(
  ["0028-modules FR-005"],
  "withRequired gives the modules wanted and everything they require, in the order of the requirements, and a name no module has is an error as a value",
  () => {
    const all = [invoicing, billing, ordering, arca];
    const got = withRequired(all, ["invoicing"]);
    assert(got.kind === "ok");
    if (got.kind === "ok") same(got.value.map((m) => m.name), ["arcaParty", "billing", "invoicing"]);
    const two = withRequired(all, ["ordering", "billing"]);
    assert(two.kind === "ok");
    if (two.kind === "ok") same(two.value.map((m) => m.name), ["arcaParty", "ordering", "billing"]);
    const nope = withRequired(all, ["shipping"]);
    assert(nope.kind === "err" && nope.error[0]?.kind === "unknown-module");
    const missing = withRequired([billing], ["billing"]);
    assert(missing.kind === "err" && missing.error[0]?.kind === "missing");
  },
);

proves(
  ["0028-modules FR-006"],
  "a model may import the models it requires, and a cycle among models is a finding",
  () => {
    const exportsMap = { "./models/a": "./models/a/mod.ts", "./models/b": "./models/b/mod.ts", "./governance": "./governance/api.ts" };
    const file = (path: string, ...from: string[]) => ({ path, text: from.map((s) => `import "@intellectual-frontiers/data/${s}";`).join("\n") });
    same(layerFindings([file("models/a/mod.ts", "models/b", "governance"), file("models/b/mod.ts", "governance")], exportsMap).map((f) => f.rule), [], "one way is allowed");
    const cyc = layerFindings([file("models/a/mod.ts", "models/b"), file("models/b/mod.ts", "models/a")], exportsMap);
    same(cyc.map((f) => f.rule), ["layers/cycle"]);
    assert(cyc[0]!.message.includes("models/a/ -> models/b/ -> models/a/") || cyc[0]!.message.includes("models/b/ -> models/a/ -> models/b/"), cyc[0]!.message);
    void KERNEL;
  },
);
