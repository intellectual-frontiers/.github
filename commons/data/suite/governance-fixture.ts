/**
 * A small domain for the tests of governance: a party that is a person or an organization, with a code list of its kinds. Not a test itself; the tests build their variations from it.
 *
 * @module
 */
import { assertEquals as strictEquals } from "@intellectual-frontiers/test";
import {
  attribute,
  codeList,
  codeOf,
  concept,
  date,
  domain,
  type Domain,
  identifier,
  relationship,
  text,
} from "@intellectual-frontiers/data/governance";

/** Deep equality of values whose types differ only by a brand: the expected side is written as plain text. */
export const same: (actual: unknown, expected: unknown, message?: string) => void = strictEquals;

/** The kinds of party. */
export const partyKind = codeList("partyKind", {
  definition: "The kinds of party: a person or an organization",
  codes: { person: { label: "Person" }, organization: { label: "Organization", definition: "A body of people acting together" } },
});

/** A party. */
export const party = concept("party", {
  definition: "A person or an organization we deal with",
  attributes: {
    partyId: attribute(identifier(), { definition: "What identifies it" }),
    kind: attribute(codeOf(partyKind), { definition: "Whether it is a person or an organization" }),
    displayName: attribute(text({ max: 200 }), { definition: "What it is called" }),
  },
  identifiedBy: ["partyId"],
});

/** A person, who is a party. */
export const person = concept("person", {
  definition: "A party that is a human being",
  attributes: {
    personId: attribute(identifier(), { definition: "What identifies it" }),
    born: attribute(date(), { definition: "The day it was born", multiplicity: "optional" }),
  },
  identifiedBy: ["personId"],
  relationships: { party: relationship(party, { cardinality: "one", definition: "The party it is" }) },
});

/** The domain of the fixture, which is valid. */
export function arca(): Domain {
  const r = domain("arca", { definition: "Parties and their kinds", concepts: [party, person], codeLists: [partyKind] });
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
}
