// Spec: 0057-sql-describe FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
/**
 * Describing models in layers (commons data 0057-sql-describe), on the real models: a described model for each module with its governance, logical and physical elements, the trace from each to what it is made into
 * (and every endpoint of it is an element), the typed tables that the physical layer names exist, the same models give the same bytes, and what has no definition or holds personal data for no purpose is a finding.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/test";
import { annotate, attribute, concept, defineModule, integer, text, vocabularies } from "@intellectual-frontiers/data/governance";
import { allModules } from "@intellectual-frontiers/data/sql/cli";
import { dialect as postgres } from "../sql/dialects/postgres/mod.ts";
import { dialect as sqlite } from "../sql/dialects/sqlite/mod.ts";
import { describeModels, LAYERS, typeText } from "@intellectual-frontiers/data/sql/describe";
import * as typed from "@intellectual-frontiers/data/sql/typed/models";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { same } from "./governance-fixture.ts";

const must = <T>(r: { kind: "ok"; value: T } | { kind: "err"; error: unknown }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const all = () => must(describeModels({ modules: allModules(), dialects: [postgres, sqlite], domain: "arca" }));
const ROOT = join(import.meta.dirname, "..", "..", "..");

proves(
  ["0057-sql-describe FR-001", "0057-sql-describe FR-002", "0057-sql-describe FR-003"],
  "a model is described in three layers, one described model for each module: governance (module, concept, attribute, relationship, code list, code), logical (table, column, keys, indexes) and physical (the SQL of each dialect, the typed table), each element with a stable id",
  () => {
    const models = all();
    same(models.map((m) => m.name), allModules().map((m) => m.name));
    for (const m of models) {
      same(m.layers.map((l) => l.id), ["governance", "logical", "physical"]);
      same(m.layers, LAYERS);
      assert(m.layers.every((l) => l.summary.length > 60), "each layer says what it is for and what may be edited");
      const kinds = new Set(m.elements.map((e) => `${e.layer}:${e.kind}`));
      for (const k of ["governance:module", "governance:concept", "governance:attribute", "logical:table", "logical:column", "physical:ddl", "physical:typed-table"]) assert(kinds.has(k), `${m.name} has ${k}`);
      assert(new Set(m.elements.map((e) => e.id)).size === m.elements.length, `${m.name}: ids are unique`);
      for (const e of m.elements) assert(e.layer === e.id.split(":")[0] && m.layers.find((l) => l.id === e.layer)?.kinds.includes(e.kind) === true, `${e.id} is of a layer and a kind that the layer holds`);
    }
    const party = models.find((m) => m.name === "arcaParty")!;
    const person = party.elements.find((e) => e.id === "governance:concept/person")!;
    assert(person.definition.length > 10 && (person.properties["identifiedBy"] as string[]).length > 0, "a concept carries its definition and identity");
    const given = party.elements.find((e) => e.id === "governance:attribute/person.givenName")!;
    same([given.properties["type"], given.properties["multiplicity"]], ["text", "required"]);
    same(typeText({ kind: "text", max: 20 }), "text(max 20)");
  },
);

proves(["0057-sql-describe FR-004"], "every element of one layer is traced to what it is made into, every end of a trace is an element, and the typed tables the physical layer names exist in the generated files", () => {
  const models = all();
  const ids = new Set(models.flatMap((m) => m.elements.map((e) => e.id)));
  const typedExports = new Set(Object.values(typed).flatMap((ns) => Object.keys(ns as object)));
  for (const m of models) {
    for (const t of m.trace) assert(ids.has(t.from) && ids.has(t.to), `${m.name}: ${t.from} -> ${t.to}`);
    for (const c of m.elements.filter((e) => e.kind === "concept")) assert(m.trace.some((t) => t.from === c.id && t.how === "projects to" && t.to.startsWith("logical:table")), `${c.id} projects to a table`);
    for (const t of m.elements.filter((e) => e.kind === "table")) {
      assert(m.trace.filter((x) => x.from === t.id && x.how === "written as").length === 2, `${t.id} is written for each dialect`);
      const tt = m.elements.find((e) => e.kind === "typed-table" && e.parent === t.id)!;
      assert(typedExports.has(tt.properties["export"] as string), `${tt.properties["export"]} is a typed table`);
      assert(existsSync(join(ROOT, tt.source?.file ?? "")), `${tt.source?.file} exists`);
    }
    for (const a of m.elements.filter((e) => e.kind === "attribute")) assert(m.trace.some((t) => t.from === a.id), `${a.id} is traced to a column`);
    for (const f of m.elements.filter((e) => e.kind === "foreign-key")) assert(ids.has(f.properties["references"] as string), `${f.id} references a table that is described`);
  }
});

proves(["0057-sql-describe FR-005"], "the same models give the same bytes, as JSON, and the source of an element is what the caller says of it", () => {
  const a = JSON.stringify(all());
  same(a, JSON.stringify(all()));
  const located = must(describeModels({ modules: allModules().slice(0, 2), dialects: [sqlite], domain: "arca", locate: (v, member) => ((v as { name?: string }).name === "person" ? { file: "x.ts", line: member === undefined ? 10 : 20 } : undefined) }));
  const person = located[0]!.elements.find((e) => e.id === "governance:concept/person")!;
  const givenName = located[0]!.elements.find((e) => e.id === "governance:attribute/person.givenName")!;
  same([person.source, givenName.source], [{ file: "x.ts", line: 10 }, { file: "x.ts", line: 20 }]);
});

proves(["0057-sql-describe FR-006"], "what has no definition, an identity or a purpose is a finding that names the element; the real models have none", () => {
  same(all().flatMap((m) => m.findings), []);
  const bad = defineModule({
    name: "scratch",
    concepts: [
      concept("thing", {
        attributes: {
          id: attribute(integer(), { definition: "its number" }),
          email: attribute(text(), { annotations: [annotate(vocabularies.privacy.personal, { category: "EmailAddress" })] }),
        },
        identifiedBy: ["id"],
      }),
    ],
  });
  const f = must(describeModels({ modules: [bad], dialects: [sqlite] }))[0]!.findings.map((x) => `${x.rule}:${x.element}`);
  same(f, ["personal-no-purpose:governance:attribute/thing.email", "undescribed:governance:attribute/thing.email", "undescribed:governance:concept/thing", "undescribed:governance:module/scratch"]);
});
