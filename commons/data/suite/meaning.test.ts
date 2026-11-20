// Spec: 0061-meaning-registers FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011
/**
 * The meaning registers (commons data 0061-meaning-registers), on SQLite, DuckDB and PostgreSQL, with synthetic healthcare fixtures: an administrative-sex code from two source systems mapped to one canonical code (the
 * unmapped value found by coverage, a mapping that has ended, two that hold at once), null rules that tell a refusal from a field never collected, variances that expire, a profile of counts and a seeded generator.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/test";
import { allModules, defineArca, schemaOf } from "@intellectual-frontiers/data/sql/cli";
import { coverage, dueVariances, profile, resolve, ruleOf, synthetic, translate } from "@intellectual-frontiers/data/sql/meaning";
import { bind } from "@intellectual-frontiers/data/sql/physical";
import { insertInto, type Runner } from "@intellectual-frontiers/data/sql/typed";
import { meaning } from "@intellectual-frontiers/data/sql/typed/models";
import { DIALECTS, load, openEngine, type Engine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { driverOf } from "./lifecycle-fixture.ts";

const must = <T, E>(r: { kind: "ok"; value: T } | { kind: "err"; error: E }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error).slice(0, 400));
  return r.value;
};
async function world(name: Engine["name"]): Promise<{ e: Engine; on: Runner }> {
  const e = await openEngine(name);
  const dialect = DIALECTS.find((x) => x.name === name)!.dialect;
  const schema = must(schemaOf(defineArca({ models: ["meaning"] } as never) as never)).schema;
  await load(e, must(bind(schema, { dialect })), ["setup", "table", "data"]);
  return { e, on: { driver: driverOf(e), dialect } };
}
const each = async (f: (w: { e: Engine; on: Runner }, name: string) => Promise<void>): Promise<void> => {
  for (const { name } of DIALECTS) {
    const w = await world(name);
    try {
      await f(w, name);
    } finally {
      await w.e.close();
    }
  }
};
const map = (id: string, system: string, value: string, to: string | null, extra: Record<string, unknown> = {}) => ({
  mappingId: id, sourceSystem: system, sourceField: "sex", sourceValue: value, targetField: "administrativeSex", targetValue: to,
  relationshipType: to === null ? "unmapped" : "equivalent", status: "approved", approvedBy: "terminology-steward", approvedAt: "2025-01-01T00:00:00Z", validFrom: "2025-01-01T00:00:00Z", validTo: null, rule: null, ...extra,
});

proves(["0061-meaning-registers FR-001", "0061-meaning-registers FR-002", "0061-meaning-registers FR-003", "0061-meaning-registers FR-004", "0061-meaning-registers FR-005"], "the meaning model has mappings with how they relate and when they hold, variances that expire, null rules, and closed code lists for absence, null policy, relationship, mapping status and variance status", () => {
  const m = allModules().find((x) => x.name === "meaning");
  assert(m !== undefined, "the meaning module is one of the models");
  same(m.concepts.map((c) => c.name), ["mapping", "variance", "nullRule"]);
  same(m.codeLists.map((l) => l.name), ["absence", "nullPolicy", "relationshipType", "mappingStatus", "varianceStatus"]);
  same(Object.keys(m.codeLists.find((l) => l.name === "absence")!.codes), ["notCollected", "notApplicable", "unknown", "notYetKnown", "refused", "suppressed", "invalid"]);
  assert(m.concepts.every((c) => c.definition.length > 30), "every concept is defined");
});

proves(["0061-meaning-registers FR-006", "0061-meaning-registers FR-007"], "translate gives the approved mapping that holds at the time, nothing for a value no mapping covers or one that has ended or is only a draft, and says ambiguous where two hold; coverage names the unmapped values most seen first", async () => {
  await each(async ({ on }) => {
    await insertInto(meaning.mapping).values([
      map("a-m", "emr-a", "M", "male"), map("a-f", "emr-a", "F", "female"), map("a-u", "emr-a", "U", "unknown"),
      map("a-x", "emr-a", "X", "other", { status: "draft" }),
      map("a-old", "emr-a", "O", "other", { validTo: "2025-06-01T00:00:00Z" }),
      map("b-1", "emr-a", "T", "other"), map("b-2", "emr-a", "T", "unknown"),
    ] as never).run(on);
    const m = await translate(on, { system: "emr-a", field: "sex", value: "M", asOf: "2025-03-01T00:00:00Z" });
    same(m.kind === "mapped" ? [m.targetValue, m.relationshipType, m.mappingId] : [], ["male", "equivalent", "a-m"]);
    same((await translate(on, { system: "emr-a", field: "sex", value: "X", asOf: "2025-03-01T00:00:00Z" })).kind, "unmapped");
    same((await translate(on, { system: "emr-a", field: "sex", value: "O", asOf: "2025-03-01T00:00:00Z" })).kind, "mapped");
    same((await translate(on, { system: "emr-a", field: "sex", value: "O", asOf: "2025-09-01T00:00:00Z" })).kind, "unmapped");
    same((await translate(on, { system: "emr-a", field: "sex", value: "M", asOf: "2024-01-01T00:00:00Z" })).kind, "unmapped");
    const amb = await translate(on, { system: "emr-a", field: "sex", value: "T", asOf: "2025-03-01T00:00:00Z" });
    same(amb.kind === "ambiguous" ? amb.mappingIds : [], ["b-1", "b-2"]);
    const c = await coverage(on, "emr-a", "sex", ["M", "M", "F", "Q", "Q", "Q", "X", null, "U"], "2025-09-01T00:00:00Z");
    same([c.observed, c.mapped, c.unmapped], [8, 4, [{ value: "Q", seen: 3 }, { value: "X", seen: 1 }]]);
    same(c.share, 0.5);
  });
});

proves(["0061-meaning-registers FR-008"], "a null rule keeps a value that is there, rejects, keeps the kind of absence or replaces with a default as the policy says, and an empty string is as missing as a null", async () => {
  await each(async ({ on }) => {
    await insertInto(meaning.nullRule).values([
      { nullRuleId: "r1", subject: "patient.birthDate", policy: "reject", absence: null, defaultValue: null, rationale: "needed to match" },
      { nullRuleId: "r2", subject: "patient.race", policy: "allow_absent", absence: "refused", defaultValue: null, rationale: "may be declined" },
      { nullRuleId: "r3", subject: "patient.language", policy: "default_to", absence: "not_collected", defaultValue: "und", rationale: "undetermined" },
    ] as never).run(on);
    const r1 = (await ruleOf(on, "patient.birthDate"))!, r2 = (await ruleOf(on, "patient.race"))!, r3 = (await ruleOf(on, "patient.language"))!;
    same(resolve(r1, "1970-01-01"), { kind: "present", value: "1970-01-01" });
    same(resolve(r1, "  ").kind, "rejected");
    same(resolve(r2, null), { kind: "absent", absence: "refused" });
    same(resolve(r3, ""), { kind: "defaulted", value: "und", absence: "not_collected" });
    same(await ruleOf(on, "patient.none"), undefined);
    same(resolve({ policy: "default_to" }, null).kind, "rejected");
  });
});

proves(["0061-meaning-registers FR-009"], "the variance register finds what is accepted past its date and what is open, and leaves accepted ones that have not expired and resolved ones", async () => {
  await each(async ({ on }) => {
    await insertInto(meaning.variance).values([
      { varianceId: "v1", subject: "emr-a.sex", description: "U is sent for unknown and for not asked", status: "accepted", owner: "steward", decidedBy: null, decidedAt: null, expiresAt: "2025-06-30T00:00:00Z" },
      { varianceId: "v2", subject: "emr-b.dob", description: "year only for infants", status: "accepted", owner: "steward", decidedBy: null, decidedAt: null, expiresAt: "2026-06-30T00:00:00Z" },
      { varianceId: "v3", subject: "emr-b.zip", description: "five digits only", status: "open", owner: "steward", decidedBy: null, decidedAt: null, expiresAt: null },
      { varianceId: "v4", subject: "emr-a.name", description: "fixed", status: "resolved", owner: "steward", decidedBy: null, decidedAt: null, expiresAt: null },
    ] as never).run(on);
    const due = await dueVariances(on, "2025-09-01T00:00:00Z");
    same(due.map((d) => [d.varianceId, d.why]), [["v1", "expired"], ["v3", "undecided"]]);
  });
});

proves(["0061-meaning-registers FR-010"], "profile gives rows, nulls, distinct values and the lowest and highest of a column with counts, on every engine", async () => {
  await each(async ({ on }) => {
    await insertInto(meaning.mapping).values([map("p1", "s", "A", "x"), map("p2", "s", "B", "x"), map("p3", "s", "B", null)] as never).run(on);
    const [p] = await profile(on, meaning.mapping as never, ["targetValue"]);
    same([p!.rows, p!.nulls, p!.distinct, p!.min, p!.max], [3, 1, 1, "x", "x"]);
  });
});

proves(["0061-meaning-registers FR-011"], "the generator makes the same rows for the same seed, other rows for another, the rate of absence and of duplicates asked for, and no value that is not synthetic", () => {
  const spec = { seed: 7, rows: 400, duplicates: 0.1, columns: { id: { make: { kind: "sequence", prefix: "P-" } }, sex: { make: { kind: "choice", of: ["M", "F", "U"], weights: [48, 48, 4] }, absent: 0.2 }, born: { make: { kind: "date", from: "1930-01-01", to: "2020-01-01" } }, mrn: { make: { kind: "text", pattern: "@@-####" } } } } as const;
  const a = synthetic(spec), b = synthetic(spec), c = synthetic({ ...spec, seed: 8 });
  same(a, b);
  assert(JSON.stringify(a) !== JSON.stringify(c), "another seed makes other rows");
  const holes = a.filter((r) => r["sex"] === null).length / a.length;
  assert(holes > 0.12 && holes < 0.28, `about a fifth are absent: ${holes}`);
  const ids = new Set(a.map((r) => r["id"])).size;
  assert(ids < 400 && ids > 340, `some rows are repeats: ${ids}`);
  assert(a.every((r) => /^[a-z]{2}-\d{4}$/.test(String(r["mrn"]))), "the pattern is followed");
});
