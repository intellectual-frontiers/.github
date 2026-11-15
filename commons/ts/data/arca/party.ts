/**
 * Arca's party model: the people and organizations a business deals with, how they relate, what roles they play, how they are identified
 * and how they are reached (commons 0006-sql-aide FR-047). Most business software needs this structure whoever its customers are, which
 * is why it is the first of Arca's typical data models. It is Arca's own work, written for IFC SQL Aide.
 *
 * @module
 */
import { boolean, date, fk, housekeeping, index, ne, oneOf, pk, SQL, table, text, view } from "../sql-aide/mod.ts";
import { codeTable } from "./patterns.ts";

/** The kinds of party: a person or an organization. */
export const partyKind = codeTable("party_kind", "The kinds of party: a person or an organization");

/** The roles a party may play: customer, supplier, employee, and whatever else a business names. */
export const partyRoleKind = codeTable("party_role_kind", "The roles a party may play, such as customer, supplier or employee");

/** The ways one party may be related to another: employed by, parent company of, married to. */
export const partyRelationKind = codeTable("party_relation_kind", "The ways one party may be related to another");

/** The kinds of identifier a party may hold: a tax number, a passport number, a company registration. */
export const partyIdentifierKind = codeTable("party_identifier_kind", "The kinds of identifier a party may hold");

/**
 * A party: anyone or anything a business deals with as one, whether a person or an organization. What is true of both is here; what
 * is true of one only is in `person` or `organization`, under the same key.
 */
export const party = table(
  "party",
  {
    /** The party's key, a ULID the application makes. */
    party_id: pk.ulid(),
    /** Whether the party is a person or an organization. */
    party_kind_code: fk(partyKind.c.code),
    /** The name the party is shown by, whatever its parts are. */
    display_name: text().personal("Name"),
    ...housekeeping(),
  },
  { owner: "arca" },
);

/** A person: a party who is a human being. Their key is their party's key. */
export const person = table(
  "person",
  {
    /** The person's key, which is the key of their party. */
    party_id: fk(party.c.party_id).primaryKey(),
    /** The name a person is given, as they write it. */
    given_name: text().personal("Name"),
    /** The name a person shares with their family, as they write it. */
    family_name: text().personal("Name"),
    /** The day the person was born. */
    birth_date: date().nullable().personal("BirthDate"),
    ...housekeeping(),
  },
  { owner: "arca" },
);

/** An organization: a party that is a company, an agency, a club or any other body. Its key is its party's key. */
export const organization = table(
  "organization",
  {
    /** The organization's key, which is the key of its party. */
    party_id: fk(party.c.party_id).primaryKey(),
    /** The name the organization is registered under. */
    legal_name: text(),
    /** The day the organization was founded. */
    founded_on: date().nullable(),
    ...housekeeping(),
  },
  { owner: "arca" },
);

/** A role a party plays for a time: the same party may be a customer and a supplier at once. */
export const partyRole = table(
  "party_role",
  {
    /** The key of this playing of a role. */
    party_role_id: pk.ulid(),
    /** The party who plays the role. */
    party_id: fk(party.c.party_id),
    /** The role played. */
    party_role_kind_code: fk(partyRoleKind.c.code),
    /** The first day the party played the role. */
    valid_from: date(),
    /** The last day the party played the role; empty while they still do. */
    valid_to: date().nullable(),
    ...housekeeping(),
  },
  { owner: "arca" },
);

/** A relation between two parties for a time, read from the first to the second: Ada is employed by Analytical Engines. */
export const partyRelation = table(
  "party_relation",
  {
    /** The key of the relation. */
    party_relation_id: pk.ulid(),
    /** The party the relation is read from. */
    from_party_id: fk(party.c.party_id),
    /** The party the relation is read to. */
    to_party_id: fk(party.c.party_id),
    /** The way the first party is related to the second. */
    party_relation_kind_code: fk(partyRelationKind.c.code),
    /** The first day the relation held. */
    valid_from: date(),
    /** The last day the relation held; empty while it still does. */
    valid_to: date().nullable(),
    ...housekeeping(),
  },
  { owner: "arca" },
).check("parties_differ", (c) => ne(c.from_party_id, c.to_party_id));

/** An identifier a party holds, as someone else issued it: a tax number, a passport number. A party holds one of a kind once. */
export const partyIdentifier = table(
  "party_identifier",
  {
    /** The key of the identifier as Arca keeps it. */
    party_identifier_id: pk.ulid(),
    /** The party who holds the identifier. */
    party_id: fk(party.c.party_id),
    /** The kind of identifier. */
    party_identifier_kind_code: fk(partyIdentifierKind.c.code),
    /** The identifier itself, as it was issued. */
    identifier: text().personal("Identifier"),
    /** Who issued the identifier. */
    issued_by: text().nullable(),
    ...housekeeping(),
  },
  { owner: "arca", unique: [["party_id", "party_identifier_kind_code"]] },
);

/** A way to reach a party over a network: an email address, a telephone number, a web address. */
export const electronicContact = table(
  "electronic_contact",
  {
    /** The key of the contact point. */
    electronic_contact_id: pk.ulid(),
    /** The party reached this way. */
    party_id: fk(party.c.party_id),
    /** Whether this is an email address, a telephone number or a web address. */
    medium: oneOf(["email", "telephone", "web"]),
    /** The address or number itself. */
    address: text().personal("Contact"),
    /** Whether this is the first way to try for its medium. */
    is_primary: boolean().default(false),
    ...housekeeping(),
  },
  { owner: "arca" },
);

/** A place a party receives post or may be visited. */
export const postalAddress = table(
  "postal_address",
  {
    /** The key of the address. */
    postal_address_id: pk.ulid(),
    /** The party found at the address. */
    party_id: fk(party.c.party_id),
    /** What the address is used for: where the party lives, is billed or receives deliveries. */
    purpose: oneOf(["home", "work", "billing", "delivery"]),
    /** The first line: usually the building and the street. */
    line_1: text().personal("PhysicalAddress"),
    /** The second line, where there is one. */
    line_2: text().nullable().personal("PhysicalAddress"),
    /** The town or city. */
    locality: text().personal("PhysicalAddress"),
    /** The state, province or county, where the country uses one. */
    region: text().nullable().personal("PhysicalAddress"),
    /** The postal code, where the country uses one. */
    postal_code: text().nullable().personal("PhysicalAddress"),
    /** The country, as its two-letter ISO 3166-1 code. */
    country_code: text(2).personal("Country"),
    ...housekeeping(),
  },
  { owner: "arca" },
);

/** Finds people by their family name, then their given name: how a person is usually looked up. */
export const personByName = index(person, ["family_name", "given_name"]);

/** Finds the roles a party plays. */
export const partyRoleByParty = index(partyRole, ["party_id", "party_role_kind_code"]);

/** Finds the relations that start from a party. */
export const partyRelationByFrom = index(partyRelation, ["from_party_id"]);

/** Finds the relations that end at a party. */
export const partyRelationByTo = index(partyRelation, ["to_party_id"]);

/** Finds the ways to reach a party. */
export const electronicContactByParty = index(electronicContact, ["party_id", "medium"]);

/** Finds the addresses of a party. */
export const postalAddressByParty = index(postalAddress, ["party_id"]);

/** The people in use, each with the name they are shown by: a person whose party or own row is marked as removed is left out. */
export const personDirectory = view(
  "person_directory",
  {
    /** The person's key. */
    party_id: text(),
    /** The name the person is shown by. */
    display_name: text(),
    /** The name the person is given. */
    given_name: text(),
    /** The name the person shares with their family. */
    family_name: text(),
  },
  SQL`
    SELECT ${party.c.party_id}, ${party.c.display_name}, ${person.c.given_name}, ${person.c.family_name}
      FROM ${party}
      JOIN ${person} ON ${person.c.party_id} = ${party.c.party_id}
     WHERE ${party.c.deleted_at} IS NULL AND ${person.c.deleted_at} IS NULL
  `,
  { from: [party, person] },
);
