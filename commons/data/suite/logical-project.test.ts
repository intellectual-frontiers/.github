// Spec: 0006-logical FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010
/**
 * The normalized projection (commons data 0006-logical FR-001 to FR-010): Arca's party model becomes the tables, columns, keys, constraints and indexes of the model it replaces, under the same
 * names once the words are written in snake case; the shapes Arca does not use (a relationship that is many, an attribute that is many, a key of several columns) are made on small domains; names
 * that collide are returned; and every element is traced to what it was made from.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/test";
import { compose, contribute, defineExtension, extensionId } from "@intellectual-frontiers/data/engine";
import {
  annotate,
  type AnyConcept,
  attribute,
  boolean,
  codeOf,
  concept,
  date,
  decimal,
  elementsOf,
  identifier,
  instant,
  integer,
  relationship,
  structured,
  binary,
  text,
  vocabularies,
} from "@intellectual-frontiers/data/governance";
import {
  type Projected,
  projectDomain,
  projectionPoint,
  projectionsFrom,
  referenceWords,
  type Projection,
} from "@intellectual-frontiers/data/sql/logical";
import { OLD_CONSTRAINTS, OLD_INDEXES, OLD_TABLES } from "./arca-old.ts";
import { same } from "./governance-fixture.ts";
import {
  arcaDomain,
  arcaSchema,
  columnNames,
  openKinds,
  projected,
  projectionErrors,
  snake,
  tableOf,
  thing,
  world,
} from "./logical-fixture.ts";

const { quality, usage } = vocabularies;
const AUDIT = ["created_at", "created_by", "updated_at", "updated_by", "deleted_at", "deleted_by"];

proves(
  ["0006-logical FR-001", "0006-logical FR-010", "0001-layers FR-006"],
  "the schema is plain data whose elements have identities of their own and trace to governance elements",
  () => {
    const { schema } = projected(arcaDomain());
    same(JSON.parse(JSON.stringify(schema)), JSON.parse(JSON.stringify(schema)));
    const known = new Set(elementsOf(arcaDomain()).map((e) => e.id));
    const ids: string[] = [schema.id];
    for (const t of schema.tables) {
      assert(known.has(t.from), `${t.id} from ${t.from}`);
      ids.push(t.id);
      for (const c of t.columns) {
        assert(known.has(c.from), `${c.id} from ${c.from}`);
        ids.push(c.id);
      }
      for (const x of [...t.foreignKeys, ...t.uniques, ...t.checks, ...t.indexes]) {
        assert(known.has(x.from), `${x.id} from ${x.from}`);
        ids.push(x.id);
      }
    }
    for (const v of schema.valueSets) {
      assert(known.has(v.from));
      ids.push(v.id);
    }
    same(new Set(ids).size, ids.length, "every identity is its own");
    same([schema.id, schema.from, schema.domain], ["schema:arcaParty", "arcaParty", "arcaParty"]);
    const person = tableOf(schema, "person");
    same([person.id, person.from, person.role], ["table:person", "arcaParty/person", "concept"]);
    const given = person.columns.find((c) => snake(c.name) === "given_name");
    same([given?.id, given?.from, given?.role], ["column:person/given.name", "arcaParty/person.givenName", "attribute"]);
    const partyRef = person.columns.find((c) => snake(c.name) === "party_id");
    same([partyRef?.from, partyRef?.role, partyRef?.nullable], ["arcaParty/person>party", "reference", false]);
    same(tableOf(schema, "party_kind").from, "arcaParty/list:partyKind");
  },
);

proves(["0006-logical FR-002"], "a column's type is a logical type, and none names an engine", () => {
  const c = thing("all", {
    a: attribute(text({ max: 5 })),
    b: attribute(integer()),
    c: attribute(decimal({ precision: 9, scale: 2 })),
    d: attribute(boolean()),
    e: attribute(date()),
    f: attribute(instant()),
    g: attribute(structured()),
    h: attribute(binary()),
    i: attribute(codeOf(openKinds)),
  });
  const t = tableOf(projected(world([c], [openKinds])).schema, "all");
  const type = (name: string) => t.columns.find((x) => snake(x.name) === name)?.type;
  same(type("id"), { kind: "text" });
  same(type("a"), { kind: "text", max: 5 });
  same(type("b"), { kind: "integer" });
  same(type("c"), { kind: "decimal", precision: 9, scale: 2 });
  same(type("d"), { kind: "boolean" });
  same(type("e"), { kind: "date" });
  same(type("f"), { kind: "timestamp", zone: true });
  same(type("g"), { kind: "json" });
  same(type("h"), { kind: "bytes" });
  same(type("kinds_code"), { kind: "text" });
});

proves(
  ["0006-logical FR-003", "0001-layers FR-002"],
  "project returns the schema as a value, and a projection is a value given to it or contributed through the engine",
  () => {
    const r = projectDomain(arcaDomain());
    assert(r.kind === "ok");
    const fixed: Projection = (d) => ({ kind: "ok", value: { ...projected(d), flow: [] } });
    const viaGiven = projectDomain(arcaDomain(), fixed);
    assert(viaGiven.kind === "ok" && viaGiven.value.flow.length === 0);
    const id = extensionId("projection.fixed");
    assert(id.kind === "ok");
    if (id.kind !== "ok") return;
    const c = compose([defineExtension({ id: id.value, version: "1.0.0", contributes: [contribute(projectionPoint, fixed)] })]);
    assert(c.kind === "ok");
    if (c.kind === "ok") same(projectionsFrom(c.value), [fixed]);
    const bad = projectDomain(world([thing("a", {}, [annotate(usage.lookup, { members: ["nope"] })])]));
    assert(bad.kind === "err", "an error of the projection is a value");
  },
);

proves(
  ["0006-logical FR-004"],
  "a concept is a table, an open code list a code table of its codes, and a closed code list no table but a value set",
  () => {
    const s = arcaSchema();
    same(
      s.tables.map((t) => `${t.role} ${snake(t.name)}`),
      [
        "code party_kind",
        "code party_role_kind",
        "code party_relation_kind",
        "code party_identifier_kind",
        "concept party",
        "concept person",
        "concept organization",
        "concept party_role",
        "concept party_relation",
        "concept party_identifier",
        "concept electronic_contact",
        "concept postal_address",
      ],
    );
    const kinds = tableOf(s, "party_kind");
    same(
      [columnNames(kinds), kinds.primaryKey.map(snake), kinds.comment],
      [["code", "label", "description"], ["code"], "The kinds of party: a person or an organization"],
    );
    same(kinds.rows, [
      { code: "person", label: "Person", description: "A human being" },
      { code: "organization", label: "Organization", description: "A company, agency, club or any other body" },
    ]);
    same(
      tableOf(s, "party_relation_kind").rows?.map((r) => r.code),
      ["employedBy", "memberOf", "subsidiaryOf"],
    );
    same(
      s.valueSets.map((v) => snake(v.name)),
      ["contact_medium", "address_purpose"],
    );
    same(
      s.valueSets[0]?.codes.map((c) => [c.code, c.label, c.description]),
      [
        ["email", "Email", null],
        ["telephone", "Telephone", null],
        ["web", "Web", null],
      ],
    );
    assert(!s.tables.some((t) => snake(t.name) === "contact_medium"));
  },
);

proves(
  ["0006-logical FR-005", "0005-naming FR-003", "0001-layers FR-012"],
  "the columns of every table of the model it replaces are what the words of the attributes and relationships make, the key first",
  () => {
    const s = arcaSchema();
    for (const [name, columns] of Object.entries(OLD_TABLES)) {
      const t = tableOf(s, name);
      same(
        columnNames(t)
          .filter((c) => !AUDIT.includes(c))
          .sort(),
        [...columns].sort(),
        name,
      );
      same(
        columnNames(t).filter((c) => AUDIT.includes(c)),
        AUDIT,
        `${name} audit`,
      );
      same(columnNames(t).slice(0, t.primaryKey.length), t.primaryKey.map(snake), `${name}: the key comes first`);
    }
    same(tableOf(s, "party_role").primaryKey.map(snake), ["party_role_id"]);
    same(tableOf(s, "person").primaryKey.map(snake), ["party_id"]);
    same(
      tableOf(s, "party_relation")
        .columns.map((c) => c.nullable)
        .slice(0, 6),
      [false, false, false, true, false, false],
    );
    const optional = ["birth_date", "founded_on", "issued_by", "line_2", "region", "postal_code", "valid_to"];
    for (const t of s.tables)
      for (const c of t.columns)
        if (optional.includes(snake(c.name)) || AUDIT.slice(1).includes(snake(c.name)))
          assert(c.nullable, `${snake(t.name)}.${snake(c.name)}`);
    same(tableOf(s, "party").columns.find((c) => snake(c.name) === "party_kind_code")?.role, "reference");
    const checks = tableOf(s, "electronic_contact").checks.map((c) => c.expression);
    same(checks, [{ kind: "oneOf", column: ["medium"], codes: ["email", "telephone", "web"] }]);
    same(tableOf(s, "postal_address").columns.find((c) => snake(c.name) === "country_code")?.type, { kind: "text", max: 2 });
  },
);

proves(
  ["0006-logical FR-005"],
  "the shapes Arca does not use: a relationship that is many, an attribute that is many, an optional relationship and a key of several columns",
  () => {
    const owner = concept("owner", {
      definition: "o",
      attributes: { a: attribute(identifier(), { definition: "a" }), b: attribute(integer(), { definition: "b" }) },
      identifiedBy: ["a", "b"],
    });
    const holder: AnyConcept = concept("holder", {
      definition: "h",
      attributes: {
        holderId: attribute(identifier(), { definition: "i" }),
        aliases: attribute(text(), { definition: "other names", multiplicity: "many" }),
      },
      identifiedBy: ["holderId"],
      relationships: {
        owner: relationship(owner, { cardinality: "optional", definition: "maybe" }),
        friends: relationship(() => holder, { cardinality: "many", definition: "friends" }),
      },
    });
    const s = projected(world([owner, holder])).schema;
    same(
      s.tables.map((t) => `${t.role} ${snake(t.name)}`),
      ["concept owner", "concept holder", "values holder_aliases", "junction holder_friends"],
    );
    const h = tableOf(s, "holder");
    same(columnNames(h), ["holder_id", "owner_a", "owner_b"]);
    same(
      h.columns.map((c) => c.nullable),
      [false, true, true],
    );
    same(
      h.foreignKeys.map((f) => [snake(f.name), f.columns.map(snake), snake(f.references.table), f.references.columns.map(snake)]),
      [["holder_owner_a_owner_b_fk", ["owner_a", "owner_b"], "owner", ["a", "b"]]],
    );
    same(tableOf(s, "owner").primaryKey.map(snake), ["a", "b"]);
    const aliases = tableOf(s, "holder_aliases");
    same(
      [columnNames(aliases), aliases.primaryKey.map(snake), aliases.comment],
      [["holder_id", "aliases"], ["holder_id", "aliases"], "other names"],
    );
    const friends = tableOf(s, "holder_friends");
    same(
      [columnNames(friends), friends.primaryKey.map(snake)],
      [
        ["holder_id", "friends_holder_id"],
        ["holder_id", "friends_holder_id"],
      ],
    );
    same(
      friends.foreignKeys.map((f) => snake(f.references.table)),
      ["holder", "holder"],
    );
  },
);

proves(["0006-logical FR-005"], "the words of the columns that refer to a key, from 0005-naming FR-003", () => {
  same(referenceWords("party", "party", ["party", "id"]), ["party", "id"]);
  same(referenceWords("from", "party", ["party", "id"]), ["from", "party", "id"]);
  same(referenceWords("owner", "owner", ["a"]), ["owner", "a"]);
  same(referenceWords("boss", "person", ["id"]), ["boss", "person", "id"]);
  same(
    referenceWords(
      "person",
      "person",
      ["personNumber"].flatMap((x) => [x]),
    ),
    ["person", "personNumber"],
  );
});

proves(
  ["0006-logical FR-006"],
  "the constraints and indexes carry the names the model it replaces gave them, and the two inline checks are named too",
  () => {
    const s = arcaSchema();
    const constraints = s.tables
      .flatMap((t) => [...t.foreignKeys, ...t.uniques, ...t.checks])
      .map((x) => snake(x.name))
      .sort();
    same(constraints, [...OLD_CONSTRAINTS, "electronic_contact_medium_ck", "postal_address_purpose_ck"].sort());
    same(
      s.tables
        .flatMap((t) => t.indexes)
        .map((x) => snake(x.name))
        .sort(),
      [...OLD_INDEXES].sort(),
    );
    same(
      tableOf(s, "party_identifier").uniques.map((u) => u.columns.map(snake)),
      [["party_id", "party_identifier_kind_code"]],
    );
    same(
      tableOf(s, "party_relation").checks.map((c) => c.expression),
      [
        {
          kind: "differs",
          columns: [
            ["from", "party", "id"],
            ["to", "party", "id"],
          ],
        },
      ],
    );
    same(
      tableOf(s, "party_relation").foreignKeys.map((f) => [snake(f.name), snake(f.references.table), f.references.columns.map(snake)]),
      [
        ["party_relation_party_relation_kind_code_fk", "party_relation_kind", ["code"]],
        ["party_relation_from_party_id_fk", "party", ["party_id"]],
        ["party_relation_to_party_id_fk", "party", ["party_id"]],
      ],
    );
    same(tableOf(s, "electronic_contact").columns.find((c) => snake(c.name) === "is_primary")?.default, { kind: "literal", value: false });
    same(
      tableOf(s, "person").indexes.map((i) => i.columns.map(snake)),
      [["family_name", "given_name"]],
    );
  },
);

proves(
  ["0006-logical FR-006"],
  "a default, a range, a pattern and a code default are made where the vocabularies say, and a default that is a code stays a name",
  () => {
    const c = thing("rated", {
      score: attribute(integer(), {
        definition: "s",
        annotations: [annotate(quality.range, { min: 0, max: 10 }), annotate(quality.defaultValue, 5)],
      }),
      code: attribute(text(), { definition: "c", annotations: [annotate(quality.pattern, "^[A-Z]+$")] }),
      kind: attribute(codeOf(openKinds), { definition: "k", annotations: [annotate(quality.defaultValue, "betaGamma")] }),
    });
    const t = tableOf(projected(world([c], [openKinds])).schema, "rated");
    same(
      t.checks.map((x) => [snake(x.name), x.expression]),
      [
        ["rated_score_range_ck", { kind: "range", column: ["score"], min: 0, max: 10 }],
        ["rated_code_pattern_ck", { kind: "pattern", column: ["code"], pattern: "^[A-Z]+$" }],
      ],
    );
    same(t.columns.find((x) => snake(x.name) === "score")?.default, { kind: "literal", value: 5 });
    same(t.columns.find((x) => snake(x.name) === "kinds_code")?.default, { kind: "code", name: "betaGamma" });
    same(snake(t.foreignKeys[0]?.name ?? []), "rated_kinds_code_fk");
    const bad = projectionErrors(
      world([thing("a", { x: attribute(text(), { annotations: [] }) }, [annotate(quality.unique, { members: ["nope"] })])]),
    );
    same(bad, [{ kind: "member", concept: "w/a", member: "nope", why: "unknown" }]);
  },
);

proves(
  ["0006-logical FR-007"],
  "an audited domain gives every concept table the audit columns, a code table none, and removal by deleting leaves out the columns of removal",
  () => {
    const s = arcaSchema();
    for (const t of s.tables)
      same(
        columnNames(t).filter((c) => AUDIT.includes(c)),
        t.role === "concept" ? AUDIT : [],
        snake(t.name),
      );
    const party = tableOf(s, "party");
    const col = (n: string) => party.columns.find((c) => snake(c.name) === n);
    same(
      [col("created_at")?.default, col("created_at")?.nullable, col("created_at")?.type],
      [{ kind: "now" }, false, { kind: "timestamp", zone: true }],
    );
    same(
      [col("created_by")?.comment, col("deleted_at")?.comment, col("deleted_by")?.comment],
      ["Who made the row", "When the row was marked as removed", "Who marked the row as removed"],
    );
    same(col("deleted_by")?.from, "arcaParty");
    const hard = projected(world([thing("a")], [], [annotate(quality.audited, { removal: "delete" })])).schema;
    same(columnNames(tableOf(hard, "a")), ["id", "label", "created_at", "created_by", "updated_at", "updated_by"]);
    const own = projected(world([thing("a", {}, [annotate(quality.audited, { removal: "mark" })]), thing("b")])).schema;
    same([columnNames(tableOf(own, "a")).length, columnNames(tableOf(own, "b")).length], [8, 2]);
    same(columnNames(tableOf(projected(world([thing("a")])).schema, "a")), ["id", "label"]);
  },
);

proves(["0006-logical FR-008"], "the comment of a table and of a column is the definition of what it was made from", () => {
  const s = arcaSchema();
  const person = tableOf(s, "person");
  same(person.comment, "A party who is a human being; what is true of a person and not of every party");
  same(person.columns.find((c) => snake(c.name) === "given_name")?.comment, "The name a person is given, as they write it");
  same(person.columns.find((c) => snake(c.name) === "party_id")?.comment, "The party the person is");
  same(
    tableOf(s, "party_kind").columns.map((c) => c.comment),
    [
      "The code other tables point to: a short word that does not change",
      "What a person is shown for the code",
      "What the code means, where the label is not enough",
    ],
  );
  same(
    s.comment,
    "The people and organizations a business deals with, how they relate, what roles they play, how they are identified and how they are reached",
  );
});

proves(
  ["0006-logical FR-009", "0005-naming FR-007"],
  "two tables, two columns of a table, or two constraints that are named alike are returned with the elements that clash",
  () => {
    const clashTable = projectionErrors(world([thing("kinds")], [openKinds]));
    same(clashTable, [{ kind: "collision", what: "table", name: ["kinds"], first: "w/list:kinds", second: "w/kinds" }]);
    const party = thing("party");
    const dup = concept("dup", {
      definition: "d",
      attributes: { id: attribute(identifier(), { definition: "i" }), partyId: attribute(text(), { definition: "x" }) },
      identifiedBy: ["id"],
      relationships: { party: relationship(party, { cardinality: "one", definition: "p" }) },
    });
    const clashColumn = projectionErrors(world([party, dup]));
    same(
      clashColumn.map((e) => [e.kind, e.kind === "collision" ? e.what : "", e.kind === "collision" ? e.first : ""]),
      [["collision", "column", "w/dup.partyId"]],
    );
    const twin = concept("twin", {
      definition: "t",
      attributes: { id: attribute(identifier(), { definition: "i" }), x: attribute(text(), { definition: "x" }) },
      identifiedBy: ["id"],
      annotations: [annotate(usage.lookup, { members: ["x"] }), annotate(usage.lookup, { members: ["x"] })],
    });
    same(
      projectionErrors(world([twin])).map((e) => (e.kind === "collision" ? e.what : e.kind)),
      ["constraint"],
    );
    const a = thing("a");
    const self = concept("selfy", {
      definition: "s",
      attributes: { id: attribute(identifier(), { definition: "i" }) },
      identifiedBy: ["id"],
      relationships: { rel: relationship(() => a, { cardinality: "many", definition: "r" }) },
    });
    assert(projectDomain(world([a, self])).kind === "ok");
  },
);

proves(
  ["0006-logical FR-005", "0006-logical FR-009"],
  "a concept identified through a cycle of identities is an error value, not a hang",
  () => {
    const a: ReturnType<typeof concept> = concept("a", {
      definition: "a",
      attributes: {},
      identifiedBy: ["b"],
      relationships: { b: relationship(() => b, { cardinality: "one", definition: "b" }) },
    });
    const b: ReturnType<typeof concept> = concept("b", {
      definition: "b",
      attributes: {},
      identifiedBy: ["a"],
      relationships: { a: relationship(() => a, { cardinality: "one", definition: "a" }) },
    });
    const errors = projectionErrors(world([a, b]));
    assert(
      errors.some((e) => e.kind === "identity" && e.why === "cycle"),
      JSON.stringify(errors),
    );
  },
);

export type { Projected };
