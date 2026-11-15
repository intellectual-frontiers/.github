/**
 * Generators: the party model as Mermaid and D2 diagrams, a data dictionary, Rust structures that a Rust compiler accepts and Zod
 * schemas that a program importing Zod runs, each committed (commons 0009-sql-aide FR-045).
 *
 * @module
 */
import { fs, path, proc } from "../../../runtime/mod.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../../../runtime/test.ts";
import { electronicContact, party, partyDocs, partyKind, partyModel, partyReference, partyTables, person } from "../../arca/mod.ts";
import {
  context,
  d2Erd,
  dataDictionary,
  definitions,
  from,
  mermaidErd,
  postgres,
  rustStructs,
  type Sql,
  sqlite,
  sqliteDriver,
  zodSchemas,
} from "../../sql-aide/mod.ts";
import { golden } from "../helpers.ts";
import { ElectronicContact, Party, PartyKind, Person } from "../arca/golden/party.zod.auto.ts";

const pg = context({ dialect: postgres(), docs: [partyDocs] });
const at = (name: string): URL => new URL(`../arca/golden/${name}`, import.meta.url);

proves(
  ["0009-sql-aide FR-045", "0009-sql-aide FR-015"],
  "the party model's diagrams, dictionary, Rust and Zod are what is committed",
  async () => {
    await golden(at("party.erd.mmd"), mermaidErd(partyTables));
    await golden(at("party.erd.d2"), d2Erd(partyTables));
    // the dictionary is Markdown kept as text, so that the formatter of the repository leaves it as generated
    await golden(at("party.dictionary.md.txt"), dataDictionary(partyTables, pg));
    await golden(at("party.rs"), rustStructs(partyTables, pg));
    await golden(at("party.zod.auto.ts"), zodSchemas(partyTables, pg));
    const mmd = mermaidErd(partyTables);
    // a person is one party, a role one of many of a party, and a contact's party is required
    assertStringIncludes(mmd, `party ||--o| person : "party_id"`);
    assertStringIncludes(mmd, `party ||--o{ party_role : "party_id"`);
    assertStringIncludes(mmd, "text party_id PK, FK");
    assertStringIncludes(d2Erd(partyTables), "person.party_id -> party.party_id");
    const dictionary = dataDictionary(partyTables, pg);
    assertStringIncludes(dictionary, "| birth_date | DATE | yes |  | The day the person was born. | PersonalData: BirthDate |");
    assertStringIncludes(dictionary, "Owner: arca. Primary key: (party_id).");
  },
);

proves(
  ["0009-sql-aide FR-045"],
  "the Rust structures of the party model compile, with warnings denied",
  async () => {
    const rustc = proc.which("rustc");
    if (rustc === undefined) {
      console.log("# SKIP the Rust compiler is not on this computer's PATH");
      return;
    }
    const dir = await fs.makeTempDir({ prefix: "ifcsql-rust-" });
    try {
      const source = path.join(dir, "party.rs");
      await fs.writeTextFile(source, rustStructs(partyTables, pg));
      const out = await proc.run([
        rustc,
        "--crate-type",
        "lib",
        "--edition",
        "2021",
        "-D",
        "warnings",
        "-o",
        path.join(dir, "libparty.rlib"),
        source,
      ]);
      assert(out.success, out.stderr);
      // the control: Rust that is wrong does not compile
      await fs.writeTextFile(source, "pub struct X { pub a: Strin }\n");
      const bad = await proc.run([rustc, "--crate-type", "lib", "--edition", "2021", "-o", path.join(dir, "libbad.rlib"), source]);
      assertEquals(bad.success, false);
    } finally {
      await fs.remove(dir, { recursive: true });
    }
  },
  { timeout: 300_000 },
);

proves(
  ["0009-sql-aide FR-045", "0009-sql-aide FR-042"],
  "the Zod schemas of the party model accept the rows a driver reads, and refuse a wrong one",
  async () => {
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(":memory:");
    try {
      const d = sqliteDriver(db, context({ dialect: sqlite(), docs: [partyDocs] }));
      assert((await d.run(definitions(partyModel))).kind === "ok");
      for (const r of partyReference) assert((await d.run(r.load)).kind === "ok");
      db.exec(`INSERT INTO "party" ("party_id", "party_kind_code", "display_name") VALUES ('p1', 'person', 'Ada')`);
      db.exec(
        `INSERT INTO "person" ("party_id", "given_name", "family_name", "birth_date") VALUES ('p1', 'Ada', 'Lovelace', '1815-12-10')`,
      );
      db.exec(
        `INSERT INTO "electronic_contact" ("electronic_contact_id", "party_id", "medium", "address") VALUES ('e1', 'p1', 'email', 'a@example.org')`,
      );
      const rows = async (q: Sql<"statement", unknown, never, string>): Promise<readonly unknown[]> => {
        const r = await d.rows(q);
        assert(r.kind === "ok", r.kind === "err" ? r.error.message : "");
        return r.value;
      };
      for (const row of await rows(from(partyKind))) assertEquals(PartyKind.safeParse(row).success, true);
      for (const row of await rows(from(party))) assertEquals(Party.safeParse(row).success, true, JSON.stringify(row));
      const people = await rows(from(person));
      for (const row of people) assertEquals(Person.safeParse(row).success, true, JSON.stringify(row));
      for (const row of await rows(from(electronicContact))) assertEquals(ElectronicContact.safeParse(row).success, true);
      const ada = people[0];
      assert(typeof ada === "object" && ada !== null);
      // the controls: a birth date that is not a date, and a medium that is not one of three
      assertEquals(Person.safeParse({ ...ada, birth_date: "10 December 1815" }).success, false);
      assertEquals(ElectronicContact.safeParse({ medium: "fax" }).success, false);
    } finally {
      db.close();
    }
  },
);
