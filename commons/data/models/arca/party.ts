// Spec: 0004-arca FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009
/**
 * Arca's party model as governance (commons data 0004-arca): the people and organizations a business deals with, how they relate, what roles they play, how they are identified and how
 * they are reached. Most business software needs this structure whoever its customers are, which is why it is the first of Arca's typical data models. It says what the business means
 * and what must be true of its data, and names no database: the logical and the physical schema are made from it. It is Arca's own work, written from the documentation of the model it
 * replaces and not copied.
 *
 * @module
 */
import {
  annotate,
  attribute,
  boolean,
  codeList,
  codeOf,
  concept,
  date,
  domain,
  type Domain,
  type DomainError,
  identifier,
  relationship,
  text,
  vocabularies,
} from "@intellectual-frontiers/data/governance";
import type { Result } from "@intellectual-frontiers/core";

const { ownership, privacy, quality, requirements, security, usage } = vocabularies;

/** What a person is held for, in the words of this model. */
const held = (category: vocabularies.privacy.PdTerm, ...purposes: readonly string[]) => annotate(privacy.personal, { category, purposes });
const cites = (...frs: readonly string[]) =>
  annotate(
    requirements.cites,
    frs.map((fr) => `0004-arca ${fr}`),
  );
const confidential = annotate(security.classification, "confidential");
const open = annotate(quality.openness, "open");
const closed = annotate(quality.openness, "closed");

/** The kinds of party: a person or an organization. */
export const partyKind = codeList("partyKind", {
  definition: "The kinds of party: a person or an organization",
  codes: {
    person: { label: "Person", definition: "A human being" },
    organization: { label: "Organization", definition: "A company, agency, club or any other body" },
  },
  annotations: [open, cites("FR-006")],
});

/** The roles a party may play: customer, supplier, employee, and whatever else a business names. */
export const partyRoleKind = codeList("partyRoleKind", {
  definition: "The roles a party may play, such as customer, supplier or employee",
  codes: {
    customer: { label: "Customer", definition: "Buys from the business" },
    supplier: { label: "Supplier", definition: "Sells to the business" },
    employee: { label: "Employee", definition: "Works for the business under a contract of employment" },
    contact: { label: "Contact", definition: "Speaks for another party" },
  },
  annotations: [open, cites("FR-006")],
});

/** The ways one party may be related to another: employed by, parent company of, married to. */
export const partyRelationKind = codeList("partyRelationKind", {
  definition: "The ways one party may be related to another",
  codes: {
    employedBy: { label: "Employed by", definition: "A person works for an organization" },
    memberOf: { label: "Member of", definition: "A party belongs to an organization" },
    subsidiaryOf: { label: "Subsidiary of", definition: "An organization is controlled by another" },
  },
  annotations: [open, cites("FR-006")],
});

/** The kinds of identifier a party may hold: a tax number, a passport number, a company registration. */
export const partyIdentifierKind = codeList("partyIdentifierKind", {
  definition: "The kinds of identifier a party may hold",
  codes: {
    taxNumber: { label: "Tax number", definition: "A number a tax authority issued" },
    passportNumber: { label: "Passport number", definition: "The number of a passport a state issued" },
    companyRegistration: { label: "Company registration", definition: "The number a register of companies issued" },
  },
  annotations: [open, cites("FR-006")],
});

/** The media by which a party may be reached over a network. */
export const contactMedium = codeList("contactMedium", {
  definition: "The media by which a party may be reached over a network",
  codes: { email: { label: "Email" }, telephone: { label: "Telephone" }, web: { label: "Web" } },
  annotations: [closed, cites("FR-006")],
});

/** What a postal address is used for. */
export const addressPurpose = codeList("addressPurpose", {
  definition: "What a postal address is used for: where a party lives, works, is billed or receives deliveries",
  codes: { home: { label: "Home" }, work: { label: "Work" }, billing: { label: "Billing" }, delivery: { label: "Delivery" } },
  annotations: [closed, cites("FR-006")],
});

/**
 * A party: anyone or anything a business deals with as one, whether a person or an organization. What is true of both is here; what is true of one only is in `person` or
 * `organization`, which are identified by their party.
 */
export const party = concept("party", {
  definition: "Anyone or anything a business deals with as one, whether a person or an organization",
  attributes: {
    partyId: attribute(identifier(), { definition: "What identifies the party, made by the application when the party is created" }),
    kind: attribute(codeOf(partyKind), { definition: "Whether the party is a person or an organization" }),
    displayName: attribute(text(), {
      definition: "The name the party is shown by, whatever its parts are",
      annotations: [held("Name", "show who the party is")],
    }),
  },
  identifiedBy: ["partyId"],
  annotations: [confidential, cites("FR-002", "FR-003", "FR-005")],
});

/** A person: a party who is a human being. Their identity is their party's. */
export const person = concept("person", {
  definition: "A party who is a human being; what is true of a person and not of every party",
  attributes: {
    givenName: attribute(text(), {
      definition: "The name a person is given, as they write it",
      annotations: [held("Name", "address the person by name")],
    }),
    familyName: attribute(text(), {
      definition: "The name a person shares with their family, as they write it",
      annotations: [held("Name", "address the person by name")],
    }),
    birthDate: attribute(date(), {
      definition: "The day the person was born",
      multiplicity: "optional",
      annotations: [held("BirthDate", "know the person's age and what they may do")],
    }),
  },
  identifiedBy: ["party"],
  relationships: { party: relationship(party, { cardinality: "one", definition: "The party the person is" }) },
  annotations: [
    confidential,
    cites("FR-002", "FR-003", "FR-005", "FR-008"),
    annotate(usage.lookup, { members: ["familyName", "givenName"] }),
  ],
});

/** An organization: a party that is a company, an agency, a club or any other body. Its identity is its party's. */
export const organization = concept("organization", {
  definition: "A party that is a company, an agency, a club or any other body",
  attributes: {
    legalName: attribute(text(), { definition: "The name the organization is registered under" }),
    foundedOn: attribute(date(), { definition: "The day the organization was founded", multiplicity: "optional" }),
  },
  identifiedBy: ["party"],
  relationships: { party: relationship(party, { cardinality: "one", definition: "The party the organization is" }) },
  annotations: [cites("FR-002", "FR-003")],
});

/** A role a party plays for a time: the same party may be a customer and a supplier at once. */
export const partyRole = concept("partyRole", {
  definition: "A role a party plays for a time: the same party may be a customer and a supplier at once",
  attributes: {
    partyRoleId: attribute(identifier(), { definition: "What identifies this playing of a role" }),
    kind: attribute(codeOf(partyRoleKind), { definition: "The role played" }),
    validFrom: attribute(date(), { definition: "The first day the party played the role" }),
    validTo: attribute(date(), {
      definition: "The last day the party played the role; empty while they still do",
      multiplicity: "optional",
    }),
  },
  identifiedBy: ["partyRoleId"],
  relationships: { party: relationship(party, { cardinality: "one", definition: "The party who plays the role" }) },
  annotations: [cites("FR-002", "FR-008"), annotate(usage.lookup, { members: ["party", "kind"] })],
});

/** A relation between two parties for a time, read from the first to the second: Ada is employed by Analytical Engines. */
export const partyRelation = concept("partyRelation", {
  definition: "A relation between two parties for a time, read from the first to the second: Ada is employed by Analytical Engines",
  attributes: {
    partyRelationId: attribute(identifier(), { definition: "What identifies the relation" }),
    kind: attribute(codeOf(partyRelationKind), { definition: "The way the first party is related to the second" }),
    validFrom: attribute(date(), { definition: "The first day the relation held" }),
    validTo: attribute(date(), { definition: "The last day the relation held; empty while it still does", multiplicity: "optional" }),
  },
  identifiedBy: ["partyRelationId"],
  relationships: {
    from: relationship(party, { cardinality: "one", definition: "The party the relation is read from" }),
    to: relationship(party, { cardinality: "one", definition: "The party the relation is read to" }),
  },
  annotations: [
    cites("FR-002", "FR-008"),
    annotate(quality.differs, { name: "partiesDiffer", members: ["from", "to"] }),
    annotate(usage.lookup, { members: ["from"] }),
    annotate(usage.lookup, { members: ["to"] }),
  ],
});

/** An identifier a party holds, as someone else issued it: a tax number, a passport number. A party holds one of a kind once. */
export const partyIdentifier = concept("partyIdentifier", {
  definition: "An identifier a party holds, as someone else issued it: a tax number, a passport number; a party holds one of a kind once",
  attributes: {
    partyIdentifierId: attribute(identifier(), { definition: "What identifies the identifier as Arca keeps it" }),
    kind: attribute(codeOf(partyIdentifierKind), { definition: "The kind of identifier" }),
    identifier: attribute(text(), {
      definition: "The identifier itself, as it was issued",
      annotations: [held("Identifier", "identify the party to authorities and counterparties")],
    }),
    issuedBy: attribute(text(), { definition: "Who issued the identifier", multiplicity: "optional" }),
  },
  identifiedBy: ["partyIdentifierId"],
  relationships: { party: relationship(party, { cardinality: "one", definition: "The party who holds the identifier" }) },
  annotations: [confidential, cites("FR-002", "FR-005", "FR-008"), annotate(quality.unique, { members: ["party", "kind"] })],
});

/** A way to reach a party over a network: an email address, a telephone number, a web address. */
export const electronicContact = concept("electronicContact", {
  definition: "A way to reach a party over a network: an email address, a telephone number, a web address",
  attributes: {
    electronicContactId: attribute(identifier(), { definition: "What identifies the contact point" }),
    medium: attribute(codeOf(contactMedium), { definition: "Whether this is an email address, a telephone number or a web address" }),
    address: attribute(text(), { definition: "The address or number itself", annotations: [held("Contact", "reach the party")] }),
    isPrimary: attribute(boolean(), {
      definition: "Whether this is the first way to try for its medium",
      annotations: [annotate(quality.defaultValue, false)],
    }),
  },
  identifiedBy: ["electronicContactId"],
  relationships: { party: relationship(party, { cardinality: "one", definition: "The party reached this way" }) },
  annotations: [confidential, cites("FR-002", "FR-005", "FR-008"), annotate(usage.lookup, { members: ["party", "medium"] })],
});

const addressPart = (definition: string, optional = false) =>
  attribute(text(), {
    definition,
    multiplicity: optional ? "optional" : "required",
    annotations: [held("PhysicalAddress", "reach the party by post", "find where the party is")],
  });

/** A place a party receives post or may be visited. */
export const postalAddress = concept("postalAddress", {
  definition: "A place a party receives post or may be visited",
  attributes: {
    postalAddressId: attribute(identifier(), { definition: "What identifies the address" }),
    purpose: attribute(codeOf(addressPurpose), {
      definition: "What the address is used for: where the party lives, is billed or receives deliveries",
    }),
    line1: addressPart("The first line: usually the building and the street"),
    line2: addressPart("The second line, where there is one", true),
    locality: addressPart("The town or city"),
    region: addressPart("The state, province or county, where the country uses one", true),
    postalCode: addressPart("The postal code, where the country uses one", true),
    countryCode: attribute(text({ max: 2 }), {
      definition: "The country, as its two-letter ISO 3166-1 code",
      annotations: [held("Country", "address the party")],
    }),
  },
  identifiedBy: ["postalAddressId"],
  relationships: { party: relationship(party, { cardinality: "one", definition: "The party found at the address" }) },
  annotations: [confidential, cites("FR-002", "FR-005", "FR-008"), annotate(usage.lookup, { members: ["party"] })],
});

/**
 * The party model as a governance domain, or what is wrong with it: it is a `Result`, never a throw, so that a project holds it to the rules it holds its own to.
 */
export const partyDomain: Result<Domain, readonly DomainError[]> = domain("arcaParty", {
  definition:
    "The people and organizations a business deals with, how they relate, what roles they play, how they are identified and how they are reached",
  concepts: [party, person, organization, partyRole, partyRelation, partyIdentifier, electronicContact, postalAddress],
  codeLists: [partyKind, partyRoleKind, partyRelationKind, partyIdentifierKind, contactMedium, addressPurpose],
  annotations: [annotate(ownership.owner, "arca"), annotate(quality.audited, { removal: "mark" }), cites("FR-001", "FR-007")],
});
