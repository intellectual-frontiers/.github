// Spec: 0003-governance FR-010, FR-011, FR-012, FR-014, FR-015, FR-016
/**
 * The vocabularies of governance (commons data 0003-governance FR-010 to FR-016): each kind goes where it says and nowhere else, and each rule is shown finding what it looks for and
 * finding nothing where the gap is closed.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import {
  type Annotation,
  annotate,
  type AnyConcept,
  attribute,
  codeList,
  binary,
  boolean,
  codeOf,
  concept,
  type Datatype,
  date,
  decimal,
  defaultVocabularies,
  integer,
  structured,
  domain,
  type Domain,
  identifier,
  lint,
  relationship,
  text,
  type Vocabulary,
  vocabularies,
} from "@intellectual-frontiers/data/governance";
import { same } from "./governance-fixture.ts";

const { docs, ownership, privacy, quality, requirements, security, usage } = vocabularies;

/** What a test puts on which element of a small domain `d` (concept `c` with attribute `v`, relationship `me` and code list `l`). */
interface Put {
  readonly domain?: readonly Annotation[];
  readonly concept?: readonly Annotation[];
  readonly attribute?: readonly Annotation[];
  readonly relationship?: readonly Annotation[];
  readonly list?: readonly Annotation[];
  readonly second?: readonly Annotation[];
}

const build = (put: Put = {}): ReturnType<typeof domain> => {
  const c: AnyConcept = concept("c", {
    definition: "c",
    attributes: {
      id: attribute(identifier(), { definition: "id" }),
      v: attribute(text(), { definition: "v", annotations: put.attribute ?? [] }),
      w: attribute(text(), { definition: "w", annotations: put.second ?? [] }),
    },
    identifiedBy: ["id"],
    relationships: { me: relationship(() => c, { cardinality: "optional", definition: "me", annotations: put.relationship ?? [] }) },
    annotations: put.concept ?? [],
  });
  return domain("d", {
    definition: "d",
    concepts: [c],
    codeLists: [codeList("l", { definition: "l", codes: { a: { label: "A" } }, annotations: put.list ?? [] })],
    annotations: put.domain ?? [],
  });
};

const ok = (put: Put = {}): Domain => {
  const r = build(put);
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const placed = (put: Put): boolean => build(put).kind === "ok";
/** The findings of one vocabulary's rules; every default vocabulary is given to lint, so that no kind is unknown. */
const found = (v: Vocabulary, put: Put): string[] =>
  lint(ok(put), defaultVocabularies)
    .filter((f) => f.rule.startsWith(`${v.id}/`))
    .map((f) => `${f.rule} ${f.element}`);

proves(["0003-governance FR-010"], "the documentation kinds go where they say, and the vocabulary has no rule", () => {
  same(
    docs.vocabulary.kinds.map((k) => k.name),
    ["docs.synonym", "docs.example", "docs.note"],
  );
  same(docs.vocabulary.rules, []);
  assert(
    placed({
      concept: [annotate(docs.synonym, "client"), annotate(docs.example, "Acme"), annotate(docs.note, "n")],
      attribute: [annotate(docs.example, "x")],
      list: [annotate(docs.synonym, "s")],
    }),
  );
  assert(!placed({ domain: [annotate(docs.synonym, "s")] }), "a synonym is not for a domain");
  assert(!placed({ relationship: [annotate(docs.example, "e")] }), "an example is not for a relationship");
  assert(placed({ domain: [annotate(docs.note, "n")], relationship: [annotate(docs.note, "n")] }));
});

proves(
  ["0003-governance FR-011"],
  "a citation is NNNN-slug FR-nnn, requirementsOf says who cites what, and the rules find an uncited concept and a malformed citation",
  () => {
    assert(requirements.CITATION.test("0003-governance FR-001") && requirements.CITATION.test("0027-commons-libraries FR-011"));
    for (const bad of ["FR-001", "3-x FR-1", "0003-governance FR-1", "0003-Governance FR-001", "0003-governance  FR-001"])
      assert(!requirements.CITATION.test(bad), bad);
    const d = ok({
      concept: [annotate(requirements.cites, ["0003-governance FR-001", "0003-governance FR-002"])],
      attribute: [annotate(requirements.cites, ["0003-governance FR-001"])],
    });
    same(
      [...requirements.requirementsOf(d)],
      [
        ["0003-governance FR-001", ["d/c", "d/c.v"]],
        ["0003-governance FR-002", ["d/c"]],
      ],
    );
    same(found(requirements.vocabulary, {}), ["requirements/uncited d/c"]);
    same(found(requirements.vocabulary, { concept: [annotate(requirements.cites, ["0003-governance FR-001"])] }), []);
    same(found(requirements.vocabulary, { concept: [annotate(requirements.cites, ["nonsense"])] }), ["requirements/malformed d/c"]);
    same(lint(ok({ concept: [annotate(requirements.cites, ["x"])] }), [requirements.vocabulary])[0]?.severity, "error");
  },
);

proves(
  ["0003-governance FR-012"],
  "personal data names a DPV-PD term, whose class and IRI are the vocabulary's, and the rules find a missing category and purpose",
  () => {
    same([privacy.dpvClassOf("Biometric"), privacy.dpvClassOf("Age")], ["SpecialCategoryPersonalData", "PersonalData"]);
    same(privacy.dpvIri("Age"), "https://w3id.org/dpv/pd#Age");
    assert(
      placed({
        concept: [annotate(privacy.personal, { category: "Age", purposes: ["billing"] })],
        attribute: [annotate(privacy.personal, {})],
      }),
    );
    assert(!placed({ list: [annotate(privacy.personal, {})] }), "a code list holds no personal data");
    // @ts-expect-error a category is a term of DPV-PD, and this is not one
    annotate(privacy.personal, { category: "NotATermOfDpv" });
    same(found(privacy.vocabulary, { attribute: [annotate(privacy.personal, {})] }), [
      "privacy/category-missing d/c.v",
      "privacy/purpose-missing d/c.v",
    ]);
    same(found(privacy.vocabulary, { attribute: [annotate(privacy.personal, { category: "Age" })] }), ["privacy/purpose-missing d/c.v"]);
    same(found(privacy.vocabulary, { attribute: [annotate(privacy.personal, { category: "Age", purposes: ["billing"] })] }), []);
    same(found(privacy.vocabulary, {}), []);
  },
);

proves(
  ["0003-governance FR-014"],
  "the security kinds go where they say, and the rules find two scopes, restricted data with no access and personal data that is not protected",
  () => {
    assert(
      placed({
        concept: [annotate(security.access, { read: ["a"], write: [] })],
        attribute: [annotate(security.scope, { name: "tenant" }), annotate(security.mask, "hash")],
        domain: [annotate(security.classification, "internal")],
      }),
    );
    assert(!placed({ concept: [annotate(security.scope, { name: "tenant" })] }), "a scope is for an attribute");
    assert(!placed({ concept: [annotate(security.mask, "redact")] }), "a mask is for an attribute");
    same(
      security.vocabulary.kinds.map((k) => k.name),
      ["security.classification", "security.access", "security.scope", "security.mask"],
    );
    same([security.RANK.public, security.RANK.internal, security.RANK.confidential, security.RANK.restricted], [0, 1, 2, 3]);
    same(found(security.vocabulary, { attribute: [annotate(security.scope, { name: "tenant" })] }), []);
    same(
      found(security.vocabulary, {
        attribute: [annotate(security.scope, { name: "tenant" })],
        second: [annotate(security.scope, { name: "env" })],
      }),
      ["security/scope-multiple d/c"],
    );
    same(found(security.vocabulary, { attribute: [annotate(security.classification, "restricted")] }), [
      "security/restricted-no-access d/c.v",
    ]);
    same(
      found(security.vocabulary, {
        attribute: [annotate(security.classification, "restricted"), annotate(security.access, { read: ["a"], write: ["b"] })],
      }),
      [],
    );
    same(
      found(security.vocabulary, {
        concept: [annotate(security.access, { read: ["a"], write: [] })],
        attribute: [annotate(security.classification, "restricted")],
      }),
      [],
    );
    const personal = annotate(privacy.personal, { category: "Age", purposes: ["billing"] });
    same(found(security.vocabulary, { attribute: [personal] }), ["security/personal-unprotected d/c.v"]);
    same(found(security.vocabulary, { attribute: [personal, annotate(security.classification, "internal")] }), [
      "security/personal-unprotected d/c.v",
    ]);
    same(found(security.vocabulary, { attribute: [personal, annotate(security.classification, "confidential")] }), []);
    const open = annotate(security.access, { read: ["analyst"], write: [] });
    same(found(security.vocabulary, { concept: [annotate(security.classification, "restricted"), open], attribute: [personal] }), []);
    same(found(security.vocabulary, { concept: [personal, annotate(security.classification, "restricted"), open] }), []);
  },
);

proves(
  ["0003-governance FR-015"],
  "an owner or a steward goes on a domain, a concept or a code list, and a concept with no owner where the domain has none is found",
  () => {
    assert(
      placed({
        domain: [annotate(ownership.owner, "finance")],
        concept: [annotate(ownership.steward, "data team")],
        list: [annotate(ownership.owner, "finance")],
      }),
    );
    assert(!placed({ attribute: [annotate(ownership.owner, "finance")] }), "an attribute is looked after through its concept");
    same(found(ownership.vocabulary, {}), ["ownership/owner-missing d/c"]);
    same(found(ownership.vocabulary, { concept: [annotate(ownership.owner, "finance")] }), []);
    same(found(ownership.vocabulary, { domain: [annotate(ownership.owner, "finance")] }), []);
    same(found(ownership.vocabulary, { concept: [annotate(ownership.steward, "data team")] }), ["ownership/owner-missing d/c"]);
  },
);

proves(
  ["0003-governance FR-016"],
  "the quality kinds go where they say, and the rules find a bad pattern, an inverted range, a bad retention and a deprecation with no replacement",
  () => {
    same(
      quality.vocabulary.kinds.map((k) => k.name),
      [
        "quality.pattern",
        "quality.range",
        "quality.retention",
        "quality.deprecated",
        "quality.default",
        "quality.unique",
        "quality.differs",
        "quality.audited",
        "quality.openness",
      ],
    );
    assert(
      placed({
        attribute: [annotate(quality.pattern, "^a+$"), annotate(quality.range, { min: 0 }), annotate(quality.retention, { days: 30 })],
        concept: [annotate(quality.retention, { days: 7 })],
      }),
    );
    assert(!placed({ concept: [annotate(quality.pattern, "x")] }), "a pattern is for an attribute");
    assert(!placed({ domain: [annotate(quality.deprecated, { since: "2026" })] }), "a domain is not deprecated");
    same(found(quality.vocabulary, { attribute: [annotate(quality.pattern, "(")] }), ["quality/pattern-invalid d/c.v"]);
    same(found(quality.vocabulary, { attribute: [annotate(quality.pattern, "^[a-z]+$")] }), []);
    same(found(quality.vocabulary, { attribute: [annotate(quality.range, { min: 5, max: 1 })] }), ["quality/range-inverted d/c.v"]);
    same(found(quality.vocabulary, { attribute: [annotate(quality.range, { min: 1, max: 5 }), annotate(quality.range, { max: 2 })] }), []);
    same(
      found(quality.vocabulary, {
        attribute: [annotate(quality.retention, { days: 0 })],
        concept: [annotate(quality.retention, { days: 1.5 })],
      }),
      ["quality/retention-invalid d/c", "quality/retention-invalid d/c.v"],
    );
    same(found(quality.vocabulary, { attribute: [annotate(quality.retention, { days: 365 })] }), []);
    same(found(quality.vocabulary, { attribute: [annotate(quality.deprecated, { since: "2026-11-18" })] }), [
      "quality/deprecated-no-replacement d/c.v",
    ]);
    same(found(quality.vocabulary, { attribute: [annotate(quality.deprecated, { since: "2026-11-18", replacedBy: "d/c.w" })] }), []);
  },
);

proves(
  ["0003-governance FR-016"],
  "unique, differs, audited, openness and default go where they say, and a member the concept lacks or a default that does not fit is found",
  () => {
    const u = (members: readonly string[]) => annotate(quality.unique, { members });
    assert(
      placed({
        concept: [
          u(["id", "v"]),
          annotate(quality.differs, { name: "vWDiffer", members: ["v", "w"] }),
          annotate(quality.audited, { removal: "mark" }),
        ],
        domain: [annotate(quality.audited, { removal: "delete" })],
        list: [annotate(quality.openness, "open")],
      }),
    );
    assert(!placed({ attribute: [u(["v"])] }), "a uniqueness is for a concept");
    assert(!placed({ domain: [annotate(quality.openness, "closed")] }), "openness is for a code list");
    assert(!placed({ list: [annotate(quality.audited, { removal: "mark" })] }), "a code list is not audited");
    assert(!placed({ concept: [annotate(quality.defaultValue, true)] }), "a default is for an attribute");
    same(found(quality.vocabulary, { concept: [u(["id", "me", "v"])] }), []);
    same(found(quality.vocabulary, { concept: [u(["id", "nope"]), annotate(quality.differs, { name: "x", members: ["v", "ghost"] })] }), [
      "quality/member-unknown d/c",
      "quality/member-unknown d/c",
    ]);
    const def = (value: string | number | boolean): Put => ({ attribute: [annotate(quality.defaultValue, value)] });
    same(found(quality.vocabulary, def("hello")), []);
    same(found(quality.vocabulary, def(3)), ["quality/default-invalid d/c.v"]);
    same(found(quality.vocabulary, { second: [annotate(quality.defaultValue, true)] }), ["quality/default-invalid d/c.w"]);
  },
);

proves(["0003-governance FR-016"], "a default is held to its datatype: text, whole numbers, true or false, and a code of its list", () => {
  const kinds = codeList("kinds", { definition: "k", codes: { a: { label: "A" } } });
  const make = (type: Datatype, value: string | number | boolean): readonly string[] => {
    const c = concept("c", {
      definition: "c",
      attributes: {
        id: attribute(identifier(), { definition: "id" }),
        v: attribute(type, { definition: "v", annotations: [annotate(quality.defaultValue, value)] }),
      },
      identifiedBy: ["id"],
    });
    const r = domain("d", { definition: "d", concepts: [c], codeLists: [kinds] });
    if (r.kind === "err") throw new Error(JSON.stringify(r.error));
    return lint(r.value, defaultVocabularies)
      .filter((f) => f.rule === "quality/default-invalid")
      .map((f) => f.message);
  };
  same(make(integer(), 3), []);
  same(make(integer(), 3.5).length, 1);
  same(make(decimal(), 3.5), []);
  same(make(decimal(), "3.5").length, 1);
  same(make(boolean(), false), []);
  same(make(boolean(), "no").length, 1);
  same(make(date(), "2026-11-18"), []);
  same(make(codeOf(kinds), "a"), []);
  same(make(codeOf(kinds), "b"), ['the default "b" of v is not a code of kinds']);
  same(make(structured(), "x").length, 1);
  same(make(binary(), 1).length, 1);
});

proves(
  ["0003-governance FR-017"],
  "a lookup goes on a concept and says its members, and one that names a member the concept lacks is found",
  () => {
    const l = (members: readonly string[]) => annotate(usage.lookup, { members });
    assert(placed({ concept: [l(["v", "me"]), l(["w"])] }));
    assert(!placed({ attribute: [l(["v"])] }), "a lookup is for a concept");
    same(
      usage.vocabulary.kinds.map((k) => k.name),
      ["usage.lookup"],
    );
    same(found(usage.vocabulary, { concept: [l(["v", "me"])] }), []);
    same(found(usage.vocabulary, { concept: [l(["v", "nope"])] }), ["usage/member-unknown d/c"]);
  },
);
