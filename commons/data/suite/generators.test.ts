// Spec: 0010-sql-generators FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013, FR-014
/**
 * The generators (commons data 0010-sql-generators): the files they make are the same every time and hold every table, column and key of the schema; the diagrams, dictionary, page, row types and
 * register say what they must; a text of governance is escaped for the format it goes into; the Zod module validates rows and the Rust file compiles; and a generator reads nothing but what it
 * is given.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { err, ok } from "@intellectual-frontiers/core";
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { compose } from "@intellectual-frontiers/data/engine";
import {
  annotate,
  attribute,
  boolean,
  codeList,
  codeOf,
  concept,
  date,
  decimal,
  domain,
  identifier,
  instant,
  integer,
  relationship,
  structured,
  text,
  binary,
  vector,
  vocabularies,
} from "@intellectual-frontiers/data/governance";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/dialects/postgres";
import {
  d2,
  dictionary,
  dictionaryHtml,
  generatorExtensions,
  generators,
  mermaid,
  register,
  rust,
  zod,
} from "@intellectual-frontiers/data/sql/extensions/generators";
import { camel, generate, generatorsFrom, type Artifact, type Generator, naming } from "@intellectual-frontiers/data/sql/physical";
import { same } from "./governance-fixture.ts";
import { arcaSchema, projected } from "./logical-fixture.ts";

const { privacy, security, ownership } = vocabularies;

const files = (
  gs: readonly Generator[],
  schema = arcaSchema(),
  options: Parameters<typeof generate>[1] extends infer O ? Partial<O> : never = {},
): readonly Artifact[] => {
  const r = generate(schema, { generators: gs, ...options });
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const textOf = (g: Generator, schema = arcaSchema(), options = {}): string => files([g], schema, options)[0]?.text ?? "";

const kinds = codeList("medium", {
  definition: "How a message travels",
  codes: { email: { label: "Email", definition: "Mail" }, shortMessage: { label: "Short message", definition: "A text" } },
});
const message = concept("message", {
  definition: 'A message | with a pipe, <b>markup</b> and a "quote"\nover two lines',
  attributes: {
    id: attribute(identifier(), { definition: "What identifies it" }),
    medium: attribute(codeOf(kinds), { definition: "How it travels" }),
    body: attribute(text({ max: 100 }), {
      definition: "What it says | really",
      annotations: [
        annotate(privacy.personal, { category: "Name", purposes: ["contact"] }),
        annotate(security.classification, "confidential"),
      ],
    }),
    size: attribute(integer(), { definition: "How long" }),
    cost: attribute(decimal({ precision: 8, scale: 2 }), { definition: "What it costs" }),
    urgent: attribute(boolean(), { definition: "Whether it is urgent" }),
    sentOn: attribute(date(), { definition: "The day" }),
    sentAt: attribute(instant(), { definition: "The moment", multiplicity: "optional" }),
    extra: attribute(structured(), { definition: "More", multiplicity: "optional" }),
    raw: attribute(binary(), { definition: "Bytes", multiplicity: "optional" }),
    embedding: attribute(vector(3), { definition: "Embedding", multiplicity: "optional" }),
  },
  identifiedBy: ["id"],
  annotations: [annotate(ownership.owner, "messaging")],
});
const reply = concept("reply", {
  definition: "A reply",
  attributes: { id: attribute(identifier(), { definition: "What identifies it" }) },
  identifiedBy: ["id"],
  relationships: { message: relationship(message, { cardinality: "one", definition: "What it answers" }) },
});
const small = (() => {
  const d = domain("mail", { definition: "Mail | domain", concepts: [message, reply], codeLists: [kinds] });
  if (d.kind === "err") throw new Error(JSON.stringify(d.error));
  return projected(d.value).schema;
})();

proves(
  ["0010-sql-generators FR-001", "0010-sql-generators FR-003"],
  "extensions contribute generators through the engine and generate returns every file in their order, or every error, and a path made twice is an error value",
  () => {
    const ext = generatorExtensions();
    assert(ext.kind === "ok");
    if (ext.kind !== "ok") return;
    const c = compose(ext.value);
    assert(c.kind === "ok");
    if (c.kind !== "ok") return;
    const from = generatorsFrom(c.value);
    same(
      from.map((g) => g.id),
      generators.map((g) => g.id),
    );
    const made = files(from);
    same(
      made.map((f) => f.path),
      [
        "arca_party.erd.mmd",
        "arca_party.erd.d2",
        "arca_party.dictionary.md",
        "arca_party.dictionary.html",
        "arca_party.rs",
        "arca_party.zod.ts",
        "arca_party.register.md",
      ],
    );
    assert(files(from, small)[0]?.path === "mail.erd.mmd", "the path is made from the domain");
    const twice = generate(arcaSchema(), { generators: [mermaid, mermaid] });
    assert(
      twice.kind === "err" && twice.error.some((e) => e.kind === "path" && e.path === "arca_party.erd.mmd" && e.generators.length === 2),
    );
    const failing: Generator = {
      id: "test.fail",
      describe: "fails",
      generate: () => err([{ kind: "unsupported", generator: "test.fail", element: arcaSchema().tables[0]!.id, why: "no" }]),
    };
    const all = generate(arcaSchema(), { generators: [failing, failing, mermaid] });
    assert(all.kind === "err" && all.error.length === 2, "all the errors together");
    const works: Generator = { id: "test.ok", describe: "ok", generate: () => ok([{ path: "x.txt", text: "x\n" }]) };
    same(
      files([works]).map((f) => f.path),
      ["x.txt"],
    );
  },
);

proves(
  ["0010-sql-generators FR-002", "0010-sql-generators FR-004"],
  "the same input gives the same files, each ending in one newline, with names written by the case style and no reading of anything else",
  () => {
    const a = files(generators);
    const b = files(generators);
    same(a, b);
    for (const f of a) assert(f.text.endsWith("\n") && !f.text.endsWith("\n\n"), f.path);
    const camelFiles = files(generators, arcaSchema(), { naming: naming(camel) });
    const mmd = camelFiles.find((f) => f.path.endsWith(".mmd"))?.text ?? "";
    assert(camelFiles[0]?.path === "arcaParty.erd.mmd" && mmd.includes("partyKindCode") && !mmd.includes("party_kind_code"));
    const dir = new URL("../sql/extensions/generators/", import.meta.url);
    for (const name of readdirSync(dir)) {
      const source = readFileSync(new URL(name, dir), "utf8");
      assert(!/node:|Date\.now|new Date\(|Math\.random|process\.|crypto|fetch\(|Bun\./.test(source), `${name} reads only what it is given`);
    }
  },
);

proves(
  ["0010-sql-generators FR-005"],
  "the Mermaid and D2 diagrams hold every table with its types and key marks and a relationship for each foreign key, and a closed list is an enum",
  () => {
    const m = textOf(mermaid, small);
    assert(
      m.startsWith("erDiagram\n") && m.includes("    message {") && m.includes("        text id PK") && m.includes("        enum medium"),
    );
    assert(m.includes('message ||--o{ reply : "message_id"'));
    const x = textOf(d2, small);
    assert(x.includes("message: {\n  shape: sql_table") && x.includes("id: text {constraint: primary_key}") && x.includes("medium: enum"));
    assert(x.includes("reply.message_id -> message.id"));
    const party = textOf(mermaid);
    assert(party.includes('party ||--o| person : "party_id"'), "a key that is also a foreign key is one to one");
    assert(party.includes("        text party_id PK, FK"));
  },
);

proves(
  ["0010-sql-generators FR-006", "0010-sql-generators FR-007"],
  "the dictionary has each table's description, owner, key and columns with their types, null, target, description and personal data, and the page has the same with links",
  () => {
    const md = textOf(dictionary, small, { dialect: postgres });
    assert(
      md.includes("Types as postgres writes them.") &&
        md.includes("Owner: messaging. Primary key: (id).") &&
        md.includes("| body | VARCHAR(100) | no |  |"),
    );
    assert(md.includes("PersonalData: Name") && md.includes("| sent_at | TIMESTAMPTZ | yes |"));
    assert(
      textOf(dictionary, small).includes("Types are the logical types.") && textOf(dictionary, small).includes("| body | text | no |"),
    );
    assert(md.includes("| message_id | TEXT | no | message.id |"), "what a column points to");
    const page = textOf(dictionaryHtml, small, { dialect: postgres });
    assert(page.startsWith("<!doctype html>") && page.includes('<a href="#message.id">message.id</a>'));
    assert(!/<script|<link|src=|https?:\/\//.test(page), "no script and no outside resource");
  },
);

proves(
  ["0010-sql-generators FR-008", "0010-sql-generators FR-009", "0010-sql-generators FR-011"],
  "Rust gets a struct with Options and an enum for a closed list, Zod a schema with nullable and z.enum, and every logical type has a form in both",
  () => {
    const r = textOf(rust, small);
    assert(
      r.includes("pub enum MessageMedium {") &&
        r.includes("    /// `short_message`\n    ShortMessage,") &&
        r.includes("pub medium: MessageMedium,"),
    );
    for (const t of [
      "pub size: i64,",
      "pub cost: String,",
      "pub urgent: bool,",
      "pub sent_on: String,",
      "pub sent_at: Option<String>,",
      "pub extra: Option<String>,",
      "pub raw: Option<Vec<u8>>,",
      "pub embedding: Option<Vec<f32>>,",
    ])
      assert(r.includes(t), t);
    const z = textOf(zod, small);
    for (const t of [
      'medium: z.enum(["email", "short_message"]),',
      "size: z.number().int(),",
      "urgent: z.boolean(),",
      "sent_on: isoDate,",
      "sent_at: z.date().nullable(),",
      "extra: z.unknown().nullable(),",
      "raw: z.instanceof(Uint8Array).nullable(),",
      "embedding: z.array(z.number()).length(3).nullable(),",
    ])
      assert(z.includes(t), t);
    assert(
      textOf(rust, small, { naming: naming(camel) }).startsWith("//! Rows") &&
        textOf(rust, small, { naming: naming(camel) }).includes("#![allow(non_snake_case)]"),
    );
  },
);

proves(
  ["0010-sql-generators FR-010"],
  "the register lists personal data with its category, class and purposes and every classification, access, scope and mask",
  () => {
    const r = textOf(register, small);
    assert(r.includes("| message | body | Name | PersonalData | contact |"), "personal data");
    assert(r.includes("| message | body | classification: confidential |"), "classification");
    const guarded = concept("guarded", {
      definition: "g",
      attributes: {
        id: attribute(identifier(), { definition: "i" }),
        tenant: attribute(text(), {
          definition: "t",
          annotations: [annotate(security.scope, { name: "tenant" }), annotate(security.mask, "hash")],
        }),
      },
      identifiedBy: ["id"],
      annotations: [annotate(security.access, { read: ["a"], write: [] })],
    });
    const d = domain("g", { definition: "g", concepts: [guarded] });
    assert(d.kind === "ok");
    if (d.kind !== "ok") return;
    const g = textOf(register, projected(d.value).schema);
    assert(g.includes("read: a; write: none"));
    assert(g.includes("scope: tenant") && g.includes("mask: hash"));
  },
);

proves(["0010-sql-generators FR-012"], "a text of governance is escaped for the format it goes into", () => {
  const md = textOf(dictionary, small);
  assert(md.includes("What it says \\| really") && !md.includes("says | really"), "a pipe in a Markdown cell");
  assert(md.includes('A message | with a pipe, <b>markup</b> and a "quote" over two lines'), "a line break is a space");
  const page = textOf(dictionaryHtml, small);
  assert(page.includes("&lt;b&gt;markup&lt;/b&gt;") && page.includes("&quot;quote&quot;") && !page.includes("<b>markup"));
  const r = textOf(rust, small);
  assert(r.includes('/// A message | with a pipe, <b>markup</b> and a "quote" over two lines'), "one documentation line");
});

proves(
  ["0010-sql-generators FR-013"],
  "the Zod module validates rows and refuses what does not fit, and the Rust file compiles",
  async () => {
    const dir = mkdtempSync(join(new URL("..", import.meta.url).pathname, ".gen-"));
    try {
      const generated = files([zod, rust], small);
      const zodFile = join(dir, "mail.zod.mjs");
      writeFileSync(zodFile, generated.find((f) => f.path.endsWith(".zod.ts"))?.text ?? "");
      const m = (await import(zodFile)) as {
        Message: { safeParse(v: unknown): { success: boolean } };
        Reply: { safeParse(v: unknown): { success: boolean } };
      };
      const row = {
        id: "m1",
        medium: "short_message",
        body: "hi",
        size: 2,
        cost: "1.50",
        urgent: false,
        sent_on: "2026-01-02",
        sent_at: null,
        extra: null,
        raw: null,
        embedding: [1, 2, 3],
      };
      assert(m.Message.safeParse(row).success, "a row that fits");
      assert(!m.Message.safeParse({ ...row, medium: "fax" }).success, "a code not in the list");
      assert(!m.Message.safeParse({ ...row, size: "2" }).success, "a wrong type");
      assert(!m.Message.safeParse({ ...row, sent_on: "yesterday" }).success, "a bad date");
      assert(!m.Message.safeParse({ ...row, embedding: [1, 2] }).success, "the wrong dimensions");
      const { id: _id, ...missing } = row;
      assert(!m.Message.safeParse(missing).success, "a missing value");
      assert(m.Reply.safeParse({ id: "r1", message_id: "m1" }).success);
      const rs = join(dir, "mail.rs");
      writeFileSync(rs, generated.find((f) => f.path.endsWith(".rs"))?.text ?? "");
      const which = spawnSync("rustc", ["--version"]);
      if (which.status === 0) {
        const c = spawnSync("rustc", ["--crate-type", "lib", "--edition", "2021", "--deny", "warnings", "--out-dir", dir, rs], {
          encoding: "utf8",
        });
        assert(c.status === 0, `rustc: ${c.stderr}`);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

proves(
  ["0010-sql-generators FR-014"],
  "the files of Arca's party model hold every table, column and foreign key of its logical schema and nothing more",
  () => {
    const schema = arcaSchema();
    const out = files(generators);
    const get = (s: string): string => out.find((f) => f.path.endsWith(s))?.text ?? "";
    const columns = schema.tables.reduce((n, t) => n + t.columns.length, 0);
    const fks = schema.tables.reduce((n, t) => n + t.foreignKeys.length, 0);
    const mmd = get(".mmd");
    same(mmd.split("\n").filter((l) => l.endsWith(" {")).length, schema.tables.length);
    same(mmd.split("\n").filter((l) => /^ {8}\S+ \S+/.test(l)).length, columns);
    same(mmd.split("\n").filter((l) => l.includes("||--")).length, fks);
    same(
      get(".d2")
        .split("\n")
        .filter((l) => l.includes(" -> ")).length,
      fks,
    );
    same(
      get(".dictionary.md")
        .split("\n")
        .filter((l) => l.startsWith("## ")).length,
      schema.tables.length,
    );
    same(
      get(".dictionary.md")
        .split("\n")
        .filter((l) => l.startsWith("| ") && !l.startsWith("| Column") && !l.startsWith("| ---")).length,
      columns,
    );
    same(
      get(".rs")
        .split("\n")
        .filter((l) => l.startsWith("pub struct ")).length,
      schema.tables.length,
    );
    same(
      get(".rs")
        .split("\n")
        .filter((l) => /^ {4}pub \w+: /.test(l)).length,
      columns,
    );
    same(
      get(".zod.ts")
        .split("\n")
        .filter((l) => l.startsWith("export const ")).length,
      schema.tables.length,
    );
    same(
      get(".zod.ts")
        .split("\n")
        .filter((l) => /^ {2}\w+: z\.|^ {2}\w+: isoDate/.test(l)).length,
      columns,
    );
  },
);
