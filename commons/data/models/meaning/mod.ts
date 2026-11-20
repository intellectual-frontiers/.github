// Spec: 0061-meaning-registers FR-001, FR-002, FR-003, FR-004, FR-005
/**
 * The meaning model (commons data 0061-meaning-registers): what it takes to say what a value means and what its absence means. A mapping of a source's value to the canonical one (with how the two relate, who approved it and
 * when it holds), a variance (a known and decided difference between a source and the canonical form, which expires), a null rule (what a missing value is allowed to be, and what it is taken to mean) and the absence kinds.
 * It names no domain, and it is what the book "Accepted Is Not Correct" calls the meaning layer. It requires nothing.
 *
 * @module
 */
import {
  annotate,
  type AnyConcept,
  attribute,
  codeList,
  codeOf,
  concept,
  defineModule,
  identifier,
  instant,
  text,
  vocabularies,
} from "@intellectual-frontiers/data/governance";

const { quality, requirements, security, usage } = vocabularies;
const spec = "0061-meaning-registers";
const cites = (...frs: readonly string[]) => annotate(requirements.cites, frs.map((f) => `${spec} ${f}`));
const internal = annotate(security.classification, "internal");
const lookup = (...members: readonly string[]) => annotate(usage.lookup, { members });
const unique = (...members: readonly string[]) => annotate(quality.unique, { members });
const keep = (days: number) => annotate(quality.retention, { days });

const list = (name: string, definition: string, codes: Readonly<Record<string, string>>, openness: "open" | "closed" = "closed") =>
  codeList(name, {
    definition,
    codes: Object.fromEntries(Object.entries(codes).map(([code, d]) => [code, { label: code.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()), definition: d }])),
    annotations: [annotate(quality.openness, openness), cites("FR-001")],
  });


/** What a missing value is. */
export const absence = list("absence", "What a missing value is, so that one null is not taken for another", {
  notCollected: "The source never asked for it",
  notApplicable: "It does not apply to this thing",
  unknown: "It applies and the source does not know it",
  notYetKnown: "It will be known later",
  refused: "The person or system declined to give it",
  suppressed: "It was withheld on purpose, for privacy or policy",
  invalid: "It was given and cannot be read",
});
/** What a rule does with a missing value. */
export const nullPolicy = list("nullPolicy", "What a rule does with a missing value", { reject: "A missing value is an error", allowAbsent: "A missing value is kept, with the kind of absence", defaultTo: "A missing value is replaced by a stated default" });
/** How a source value relates to the canonical one. */
export const relationshipType = list("relationshipType", "How a source value relates to the canonical value it is mapped to", {
  equivalent: "They mean the same",
  broader: "The source is broader than the canonical value",
  narrower: "The source is narrower than the canonical value",
  related: "They are related and not the same",
  unmapped: "The source has no canonical value, and that is decided",
});
/** Where a mapping is. */
export const mappingStatus = list("mappingStatus", "Where a mapping is in its approval", { draft: "Proposed, and not used", approved: "Approved, and used", retired: "No longer used" });
/** Where a variance is. */
export const varianceStatus = list("varianceStatus", "Where a variance is", { open: "Found and not decided", accepted: "Decided to live with, until it expires", resolved: "Gone", expired: "Accepted until a date that has passed" });

const key = (what: string) => attribute(identifier(), { definition: `What identifies ${what}` });
const req = (t: Parameters<typeof attribute>[0], definition: string) => attribute(t, { definition });
const opt = (t: Parameters<typeof attribute>[0], definition: string) => attribute(t, { definition, multiplicity: "optional" });

/** A source value mapped to the canonical one. */
export const mapping: AnyConcept = concept("mapping", {
  definition: "A source system's value mapped to the canonical value, with how the two relate, the rule it follows, who approved it and the dates between which it holds",
  attributes: {
    mappingId: key("the mapping"),
    sourceSystem: req(text(), "The system the value is from"),
    sourceField: req(text(), "The field the value is of"),
    sourceValue: req(text(), "The value as the source gives it"),
    targetField: req(text(), "The canonical field"),
    targetValue: opt(text(), "The canonical value; none where the relationship is unmapped"),
    relationshipType: req(codeOf(relationshipType), "How the two relate"),
    rule: opt(text(), "The rule it follows, where it is more than a lookup"),
    status: req(codeOf(mappingStatus), "Where it is in its approval"),
    approvedBy: opt(text(), "Who approved it"),
    approvedAt: opt(instant(), "When it was approved"),
    validFrom: req(instant(), "From when it holds"),
    validTo: opt(instant(), "Until when it holds, where it ends"),
  },
  identifiedBy: ["mappingId"],
  relationships: {},
  annotations: [internal, keep(3650), cites("FR-001", "FR-002"), lookup("sourceSystem", "sourceField", "sourceValue", "status")],
});

/** A decided difference between a source and the canonical form. */
export const variance: AnyConcept = concept("variance", {
  definition: "A known difference between a source and the canonical form, with who decided to live with it and when that ends: a variance is accepted for a time and then expires",
  attributes: {
    varianceId: key("the variance"),
    subject: req(text(), "The source and field it is about"),
    description: req(text(), "What differs, in a sentence"),
    status: req(codeOf(varianceStatus), "Where it is"),
    owner: req(text(), "Who answers for it"),
    decidedBy: opt(text(), "Who decided to accept it"),
    decidedAt: opt(instant(), "When it was decided"),
    expiresAt: opt(instant(), "When the acceptance ends"),
  },
  identifiedBy: ["varianceId"],
  relationships: {},
  annotations: [internal, keep(3650), cites("FR-003"), lookup("subject", "status", "expiresAt")],
});

/** What a missing value may be for one field. */
export const nullRule: AnyConcept = concept("nullRule", {
  definition: "What a missing value is allowed to be for one field, the kind of absence it stands for and the default where it is replaced: the null policy of a field",
  attributes: {
    nullRuleId: key("the rule: its table and column"),
    subject: req(text(), "The table and column it is about"),
    policy: req(codeOf(nullPolicy), "What is done with a missing value"),
    absence: opt(codeOf(absence), "The kind of absence a missing value is taken to be"),
    defaultValue: opt(text(), "The default, where the policy is to replace"),
    rationale: req(text(), "Why"),
  },
  identifiedBy: ["nullRuleId"],
  relationships: {},
  annotations: [internal, keep(3650), cites("FR-004"), unique("subject"), lookup("subject")],
});

/** The meaning model: mappings, variances and null rules. */
export const meaningModule = defineModule({
  name: "meaning",
  definition: "What a value means and what its absence means",
  requires: [],
  concepts: [mapping, variance, nullRule],
  codeLists: [absence, nullPolicy, relationshipType, mappingStatus, varianceStatus],
});
