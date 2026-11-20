// Spec: 0003-governance FR-016
/**
 * The quality and lifecycle vocabulary (commons data 0003-governance FR-016): what a value must look like (`pattern`, `range`), how long data is kept (`retention`), and that an element is
 * on its way out (`deprecated`), with what replaces it. A code list is the way to say which values are allowed; these are for the rest.
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { annotationKind, annotationsOf } from "../annotation.ts";
import { elementsOf } from "../elements.ts";
import { conceptId, attributeId } from "../id.ts";
import { type AnyConcept, membersOf } from "../model.ts";
import { finding, type Finding, type Vocabulary } from "../vocabulary.ts";

/** A regular expression a text value must match. */
export const pattern = annotationKind<string>("quality.pattern", ["attribute"]);

/** The least and the greatest a number may be. */
export interface Range {
  readonly min?: number;
  readonly max?: number;
}

/** The range of a number. */
export const range = annotationKind<Range>("quality.range", ["attribute"]);

/** How long data is kept, in days. */
export interface Retention {
  readonly days: number;
}

/** How long a concept's or an attribute's data is kept. */
export const retention = annotationKind<Retention>("quality.retention", ["concept", "attribute"]);

/** An element that is on its way out: since when, and what replaces it, by its identity as text. */
export interface Deprecated {
  readonly since: string;
  readonly replacedBy?: string;
}

/** The element is deprecated. */
export const deprecated = annotationKind<Deprecated>("quality.deprecated", ["concept", "attribute", "relationship", "codelist"]);

/** The value an attribute takes where none is given. */
export const defaultValue = annotationKind<string | number | boolean>("quality.default", ["attribute"]);

/** Members of a concept (attributes or relationships, by name) that are unique together: no two records agree on all of them. */
export interface Unique {
  readonly members: readonly string[];
}

/** Members of a concept that are unique together. */
export const unique = annotationKind<Unique>("quality.unique", ["concept"]);

/** A named rule that two members of a concept must differ. */
export interface Differs {
  /** The rule's name, which a layer below keeps for the constraint that says it. */
  readonly name: string;
  readonly members: readonly [string, string];
}

/** Two members of a concept that must differ. */
export const differs = annotationKind<Differs>("quality.differs", ["concept"]);

/** Whether a record is removed by marking it or for good. */
export type Removal = "mark" | "delete";

/** A domain or a concept keeps who made, changed and removed each record, and when. */
export interface Audited {
  readonly removal: Removal;
}

/** The records of a domain or a concept are audited. */
export const audited = annotationKind<Audited>("quality.audited", ["domain", "concept"]);

/** A concept whose records are only ever added: never changed, never removed. Where it says so, they also form a chain, each naming the one before it. */
export interface AppendOnly {
  /** The records form a hash chain: the members that hold the hash of the record, the hash of the one before it and its place in the chain. */
  readonly chain?: { readonly hash: string; readonly previous: string; readonly sequence: string; readonly genesis: string };
}

/** The records of a concept are added and never changed or removed, and may be a chain. */
export const appendOnly = annotationKind<AppendOnly>("quality.appendOnly", ["concept"]);

/** The moves a code attribute may make: from each code, the codes it may become. A code that is not a key may not be left. */
export interface Transitions {
  readonly allowed: Readonly<Record<string, readonly string[]>>;
}

/** Which moves from one code to another an attribute may make. */
export const transitions = annotationKind<Transitions>("quality.transitions", ["attribute"]);

/** A number that may never be above another of the same record: what is used and what it may be. */
export interface AtMost {
  readonly member: string;
  readonly other: string;
}

/** A member that may never be above another member of the same concept. */
export const atMost = annotationKind<AtMost>("quality.atMost", ["concept"]);

/** A concept whose records hold between two instants: the members that say from when and until when, so that "as of" can be asked of it. */
export interface Temporal {
  readonly validFrom: string;
  /** The member that holds the end; where not named the records have no end and are replaced. */
  readonly validTo?: string;
}

/** The records of a concept are effective-dated: each holds from an instant, and until one where it ends. */
export const temporal = annotationKind<Temporal>("quality.temporal", ["concept"]);

/** A code list is open (the business adds codes of its own) or closed (only the model changes it). */
export type Openness = "open" | "closed";

/** Whether the business may add codes to a code list. */
export const openness = annotationKind<Openness>("quality.openness", ["codelist"]);

const valid = (source: string): boolean => {
  try {
    new RegExp(source);
    return true;
  } catch {
    return false;
  }
};

/** The vocabulary: its kinds and its rules. */
export const vocabulary: Vocabulary = {
  id: "quality",
  kinds: [pattern, range, retention, deprecated, defaultValue, unique, differs, audited, openness, appendOnly, transitions, atMost, temporal],
  rules: [
    {
      id: "quality/pattern-invalid",
      describe: "A pattern that is not a regular expression.",
      check: (d) =>
        elementsOf(d).flatMap((e) =>
          annotationsOf(e, pattern)
            .filter((p) => !valid(p))
            .map((p) => finding("quality/pattern-invalid", e.id, `"${p}" is not a regular expression`, "error")),
        ),
    },
    {
      id: "quality/range-inverted",
      describe: "A range whose minimum is above its maximum.",
      check: (d) =>
        elementsOf(d).flatMap((e) =>
          annotationsOf(e, range)
            .filter((r) => r.min !== undefined && r.max !== undefined && r.min > r.max)
            .map((r) => finding("quality/range-inverted", e.id, `the minimum ${r.min} is above the maximum ${r.max}`, "error")),
        ),
    },
    {
      id: "quality/retention-invalid",
      describe: "A retention that is not a positive whole number of days.",
      check: (d) =>
        elementsOf(d).flatMap((e) =>
          annotationsOf(e, retention)
            .filter((r) => !Number.isInteger(r.days) || r.days <= 0)
            .map((r) => finding("quality/retention-invalid", e.id, `${r.days} is not a positive whole number of days`, "error")),
        ),
    },
    {
      id: "quality/member-unknown",
      describe: "A member named in unique or differs that the concept does not have.",
      check: (d) =>
        d.concepts.flatMap((c) => {
          const has = new Set(membersOf(c));
          const named = [...annotationsOf(c, unique).flatMap((u) => u.members), ...annotationsOf(c, differs).flatMap((x) => x.members)];
          return named
            .filter((m) => !has.has(m))
            .map((m) => finding("quality/member-unknown", conceptId(d.name, c.name), `the concept ${c.name} has no member ${m}`, "error"));
        }),
    },
    {
      id: "quality/invariant-member-unknown",
      describe: "A member named in appendOnly's chain or in atMost that the concept does not have, or a transition between codes that the attribute's list does not have.",
      check: (d) =>
        d.concepts.flatMap((c) => {
          const has = new Set(membersOf(c));
          const out: Finding[] = [];
          const at = conceptId(d.name, c.name);
          for (const a of annotationsOf(c, appendOnly))
            if (a.chain !== undefined)
              for (const m of [a.chain.hash, a.chain.previous, a.chain.sequence]) if (!has.has(m)) out.push(finding("quality/invariant-member-unknown", at, `the chain of ${c.name} names ${m}, which it does not have`, "error"));
          for (const a of annotationsOf(c, temporal)) for (const m of [a.validFrom, ...(a.validTo === undefined ? [] : [a.validTo])]) if (!has.has(m)) out.push(finding("quality/invariant-member-unknown", at, `temporal of ${c.name} names ${m}, which it does not have`, "error"));
          for (const a of annotationsOf(c, atMost)) for (const m of [a.member, a.other]) if (!has.has(m)) out.push(finding("quality/invariant-member-unknown", at, `atMost of ${c.name} names ${m}, which it does not have`, "error"));
          for (const [key, attr] of Object.entries(c.attributes))
            for (const tr of annotationsOf(attr, transitions)) {
              if (attr.type.kind !== "code") {
                out.push(finding("quality/invariant-member-unknown", attributeId(d.name, c.name, key), `transitions are for a code attribute, and ${key} is not one`, "error"));
                continue;
              }
              const codes = new Set(Object.keys(attr.type.list.codes));
              for (const [from, tos] of Object.entries(tr.allowed))
                for (const code of [from, ...tos]) if (!codes.has(code)) out.push(finding("quality/invariant-member-unknown", attributeId(d.name, c.name, key), `${code} is not a code of the list of ${key}`, "error"));
            }
          return out;
        }),
    },
    {
      id: "quality/default-invalid",
      describe: "A default that does not fit its attribute's datatype, or is not a code of its list.",
      check: (d) => d.concepts.flatMap((c) => defaultFindings(d.name, c)),
    },
    {
      id: "quality/deprecated-no-replacement",
      describe: "An element deprecated with nothing to replace it.",
      check: (d) =>
        elementsOf(d)
          .filter((e) => annotationsOf(e, deprecated).some((x) => x.replacedBy === undefined))
          .map((e) => finding("quality/deprecated-no-replacement", e.id, `${e.name} is deprecated and names no replacement`)),
    },
  ],
};

function defaultFindings(domain: string, c: AnyConcept): readonly Finding[] {
  const out: Finding[] = [];
  for (const [key, a] of Object.entries(c.attributes)) {
    for (const v of annotationsOf(a, defaultValue)) {
      const t = a.type;
      const at = attributeId(domain, c.name, key);
      const bad = (why: string): void =>
        void out.push(finding("quality/default-invalid", at, `the default ${JSON.stringify(v)} of ${key} ${why}`, "error"));
      switch (t.kind) {
        case "text":
        case "identifier":
        case "date":
        case "instant":
          if (typeof v !== "string") bad("is not text");
          break;
        case "integer":
          if (typeof v !== "number" || !Number.isInteger(v)) bad("is not a whole number");
          break;
        case "decimal":
          if (typeof v !== "number") bad("is not a number");
          break;
        case "boolean":
          if (typeof v !== "boolean") bad("is not true or false");
          break;
        case "code":
          if (typeof v !== "string" || !(v in t.list.codes)) bad(`is not a code of ${t.list.name}`);
          break;
        case "structured":
        case "binary":
        case "vector":
          bad("is not possible for this datatype");
          break;
        default:
          return absurd(t);
      }
    }
  }
  return out;
}
