// Spec: 0004-arca FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009
/**
 * Arca's party model (commons data 0004-arca): it is a valid governance domain, it has the concepts and code lists the model it replaces had, it says what is personal and how sensitive,
 * it carries the reference codes and the business structure, it holds itself to every vocabulary, and each of its citations names a requirement that exists. The old model's tables and
 * columns are listed here as plain text, from its goldens, so that nothing of them is lost without a test saying so.
 *
 * @module
 */
import { path, trace } from "@intellectual-frontiers/commons/ts/runtime";
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import {
  annotationsOf,
  type AnyConcept,
  defaultVocabularies,
  type Domain,
  elementsOf,
  lint,
  vocabularies,
} from "@intellectual-frontiers/data/governance";
import { partyDomain } from "@intellectual-frontiers/data/models/arca";
import { same } from "./governance-fixture.ts";

const { ownership, privacy, quality, requirements, security, usage } = vocabularies;
const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

const arca = (): Domain => {
  if (partyDomain.kind === "err") throw new Error(JSON.stringify(partyDomain.error));
  return partyDomain.value;
};
const conceptOf = (name: string): AnyConcept => {
  const c = arca().concepts.find((x) => x.name === name);
  if (c === undefined) throw new Error(`no concept ${name}`);
  return c;
};

proves(["0004-arca FR-001"], "the party model is a valid domain named arca_party, given as a result", () => {
  assert(partyDomain.kind === "ok");
  same(arca().name, "arca_party");
});

proves(
  ["0004-arca FR-002"],
  "the domain has the concepts and code lists the model it replaces had, with their attributes and relationships",
  () => {
    same(
      arca().concepts.map((c) => c.name),
      ["party", "person", "organization", "party_role", "party_relation", "party_identifier", "electronic_contact", "postal_address"],
    );
    same(
      arca().codeLists.map((l) => l.name),
      ["party_kind", "party_role_kind", "party_relation_kind", "party_identifier_kind", "contact_medium", "address_purpose"],
    );
    const members = (name: string): string[] => {
      const c = conceptOf(name);
      return [...Object.keys(c.attributes), ...Object.keys(c.relationships)];
    };
    same(members("party"), ["party_id", "kind", "display_name"]);
    same(members("person"), ["given_name", "family_name", "birth_date", "party"]);
    same(members("organization"), ["legal_name", "founded_on", "party"]);
    same(members("party_role"), ["party_role_id", "kind", "valid_from", "valid_to", "party"]);
    same(members("party_relation"), ["party_relation_id", "kind", "valid_from", "valid_to", "from", "to"]);
    same(members("party_identifier"), ["party_identifier_id", "kind", "identifier", "issued_by", "party"]);
    same(members("electronic_contact"), ["electronic_contact_id", "medium", "address", "is_primary", "party"]);
    same(members("postal_address"), [
      "postal_address_id",
      "purpose",
      "line_1",
      "line_2",
      "locality",
      "region",
      "postal_code",
      "country_code",
      "party",
    ]);
  },
);

proves(
  ["0004-arca FR-003"],
  "a person and an organization are identified by their party, every other concept by an attribute named for it",
  () => {
    for (const name of ["person", "organization"]) {
      const c = conceptOf(name);
      same(c.identifiedBy, ["party"]);
      same(
        [
          c.relationships["party"]?.cardinality,
          c.relationships["party"] === undefined ? "" : (c.relationships["party"].to as AnyConcept).name,
        ],
        ["one", "party"],
      );
    }
    for (const name of ["party", "party_role", "party_relation", "party_identifier", "electronic_contact", "postal_address"])
      same(conceptOf(name).identifiedBy, [`${name}_id`]);
  },
);

proves(["0004-arca FR-004"], "every element has a definition, and lint with every vocabulary of the library finds nothing", () => {
  const missing = elementsOf(arca()).filter((e) => e.kind !== "code" && e.definition.trim() === "");
  same(missing, []);
  same(lint(arca(), defaultVocabularies), []);
});

proves(
  ["0004-arca FR-005"],
  "personal data names a category of DPV-PD that exists and what it is held for, and its concepts are confidential",
  () => {
    const held = elementsOf(arca())
      .filter((e) => e.kind === "attribute")
      .flatMap((e) => annotationsOf(e, privacy.personal).map((p) => `${e.id} ${p.category}`));
    same(held, [
      "arca_party/party.display_name Name",
      "arca_party/person.given_name Name",
      "arca_party/person.family_name Name",
      "arca_party/person.birth_date BirthDate",
      "arca_party/party_identifier.identifier Identifier",
      "arca_party/electronic_contact.address Contact",
      "arca_party/postal_address.line_1 PhysicalAddress",
      "arca_party/postal_address.line_2 PhysicalAddress",
      "arca_party/postal_address.locality PhysicalAddress",
      "arca_party/postal_address.region PhysicalAddress",
      "arca_party/postal_address.postal_code PhysicalAddress",
      "arca_party/postal_address.country_code Country",
    ]);
    for (const e of elementsOf(arca()))
      for (const p of annotationsOf(e, privacy.personal))
        assert(p.category !== undefined && p.category in privacy.pd && (p.purposes ?? []).length > 0, e.id);
    const holders = ["party", "person", "party_identifier", "electronic_contact", "postal_address"];
    for (const name of holders) same(annotationsOf(conceptOf(name), security.classification), ["confidential"], name);
    same(
      arca()
        .concepts.filter((c) => !holders.includes(c.name))
        .map((c) => annotationsOf(c, security.classification)),
      [[], [], []],
    );
  },
);

proves(
  ["0004-arca FR-006"],
  "the reference code lists carry the codes the model it replaces loaded, and are open; the two closed lists carry theirs",
  () => {
    const list = (name: string) => {
      const l = arca().codeLists.find((x) => x.name === name);
      if (l === undefined) throw new Error(name);
      return l;
    };
    const codes = (name: string): [string, string, string | undefined][] =>
      Object.entries(list(name).codes).map(([k, v]) => [k, v.label, v.definition]);
    same(codes("party_kind"), [
      ["person", "Person", "A human being"],
      ["organization", "Organization", "A company, agency, club or any other body"],
    ]);
    same(codes("party_role_kind"), [
      ["customer", "Customer", "Buys from the business"],
      ["supplier", "Supplier", "Sells to the business"],
      ["employee", "Employee", "Works for the business under a contract of employment"],
      ["contact", "Contact", "Speaks for another party"],
    ]);
    same(codes("party_relation_kind"), [
      ["employed_by", "Employed by", "A person works for an organization"],
      ["member_of", "Member of", "A party belongs to an organization"],
      ["subsidiary_of", "Subsidiary of", "An organization is controlled by another"],
    ]);
    same(codes("party_identifier_kind"), [
      ["tax_number", "Tax number", "A number a tax authority issued"],
      ["passport_number", "Passport number", "The number of a passport a state issued"],
      ["company_registration", "Company registration", "The number a register of companies issued"],
    ]);
    same(Object.keys(list("contact_medium").codes), ["email", "telephone", "web"]);
    same(Object.keys(list("address_purpose").codes), ["home", "work", "billing", "delivery"]);
    for (const name of ["party_kind", "party_role_kind", "party_relation_kind", "party_identifier_kind"])
      same(annotationsOf(list(name), quality.openness), ["open"], name);
    for (const name of ["contact_medium", "address_purpose"]) same(annotationsOf(list(name), quality.openness), ["closed"], name);
  },
);

proves(["0004-arca FR-007"], "the domain is audited with removal by marking, and says who answers for it", () => {
  same(annotationsOf(arca(), quality.audited), [{ removal: "mark" }]);
  same(annotationsOf(arca(), ownership.owner), ["arca"]);
});

proves(
  ["0004-arca FR-008"],
  "the business structure is governance: one identifier of a kind, two parties that differ, a default, and the ways the data is found",
  () => {
    same(annotationsOf(conceptOf("party_identifier"), quality.unique), [{ members: ["party", "kind"] }]);
    same(annotationsOf(conceptOf("party_relation"), quality.differs), [{ name: "parties_differ", members: ["from", "to"] }]);
    same(annotationsOf(conceptOf("electronic_contact").attributes["is_primary"] ?? conceptOf("party"), quality.defaultValue), [false]);
    const lookups = arca().concepts.flatMap((c) => annotationsOf(c, usage.lookup).map((l) => `${c.name}: ${l.members.join(", ")}`));
    same(lookups, [
      "person: family_name, given_name",
      "party_role: party, kind",
      "party_relation: from",
      "party_relation: to",
      "electronic_contact: party, medium",
      "postal_address: party",
    ]);
  },
);

proves(
  ["0004-arca FR-009"],
  "every concept cites requirements, and every citation names a requirement that exists in this library's specifications",
  async () => {
    for (const c of arca().concepts) assert(annotationsOf(c, requirements.cites).flat().length > 0, `${c.name} cites nothing`);
    const specs = await trace.readSpecs(ROOT, "spec-kit/specs");
    const cited = [...requirements.requirementsOf(arca()).keys()];
    same([...cited].sort(), [
      "0004-arca FR-001",
      "0004-arca FR-002",
      "0004-arca FR-003",
      "0004-arca FR-005",
      "0004-arca FR-006",
      "0004-arca FR-007",
      "0004-arca FR-008",
    ]);
    for (const citation of cited) {
      const [slug, fr] = citation.split(" ");
      const spec = specs.find((s) => s.slug === slug);
      assert(spec !== undefined, `${citation}: no specification ${slug}`);
      assert(
        spec?.requirements.some((r) => r.id === fr),
        `${citation}: no requirement ${fr} in ${slug}`,
      );
    }
  },
);

/** The columns the model it replaces had, as its goldens show them, without the six housekeeping columns every table of a concept also had. */
const OLD_TABLES: Readonly<Record<string, readonly string[]>> = {
  party: ["party_id", "party_kind_code", "display_name"],
  person: ["party_id", "given_name", "family_name", "birth_date"],
  organization: ["party_id", "legal_name", "founded_on"],
  party_role: ["party_role_id", "party_id", "party_role_kind_code", "valid_from", "valid_to"],
  party_relation: ["party_relation_id", "from_party_id", "to_party_id", "party_relation_kind_code", "valid_from", "valid_to"],
  party_identifier: ["party_identifier_id", "party_id", "party_identifier_kind_code", "identifier", "issued_by"],
  electronic_contact: ["electronic_contact_id", "party_id", "medium", "address", "is_primary"],
  postal_address: ["postal_address_id", "party_id", "purpose", "line_1", "line_2", "locality", "region", "postal_code", "country_code"],
};

proves(
  ["0004-arca FR-002", "0004-arca FR-006"],
  "every table and column of the model it replaces is accounted for by the domain and the conventions a layer below must follow",
  () => {
    const openLists = arca()
      .codeLists.filter((l) => annotationsOf(l, quality.openness)[0] === "open")
      .map((l) => l.name);
    same(openLists, ["party_kind", "party_role_kind", "party_relation_kind", "party_identifier_kind"]);
    // an open code list is a table of its own (code, label, description); a closed one is a check on the column
    const tables = [...openLists, ...arca().concepts.map((c) => c.name)].sort();
    same(tables, [...openLists, ...Object.keys(OLD_TABLES)].sort());
    for (const c of arca().concepts) {
      const columns = [
        ...Object.entries(c.attributes).map(([name, a]) =>
          a.type.kind === "code" && openLists.includes(a.type.list.name) ? `${a.type.list.name}_code` : name,
        ),
        ...Object.entries(c.relationships).map(([name, r]) => {
          const target = (r.to as AnyConcept).name;
          return name === target ? `${target}_id` : `${name}_${target}_id`;
        }),
      ];
      same([...new Set(columns)].sort(), [...(OLD_TABLES[c.name] ?? [])].sort(), c.name);
    }
  },
);
