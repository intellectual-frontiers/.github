/**
 * AUTO-GENERATED from the TSDoc comments of arca/party.ts; do not edit: change the comments and write the map again.
 *
 * @module
 */

/** The documentation of arca/party.ts, by the name of each exported constant. */
export const docs = {
  electronicContact: {
    summary: "A way to reach a party over a network: an email address, a telephone number, a web address.",
    members: {
      address: "The address or number itself.",
      electronic_contact_id: "The key of the contact point.",
      is_primary: "Whether this is the first way to try for its medium.",
      medium: "Whether this is an email address, a telephone number or a web address.",
      party_id: "The party reached this way.",
    },
  },
  organization: {
    summary: "An organization: a party that is a company, an agency, a club or any other body. Its key is its party's key.",
    members: {
      founded_on: "The day the organization was founded.",
      legal_name: "The name the organization is registered under.",
      party_id: "The organization's key, which is the key of its party.",
    },
  },
  party: {
    summary:
      "A party: anyone or anything a business deals with as one, whether a person or an organization. What is true of both is here; what is true of one only is in `person` or `organization`, under the same key.",
    members: {
      display_name: "The name the party is shown by, whatever its parts are.",
      party_id: "The party's key, a ULID the application makes.",
      party_kind_code: "Whether the party is a person or an organization.",
    },
  },
  partyIdentifier: {
    summary: "An identifier a party holds, as someone else issued it: a tax number, a passport number. A party holds one of a kind once.",
    members: {
      identifier: "The identifier itself, as it was issued.",
      issued_by: "Who issued the identifier.",
      party_id: "The party who holds the identifier.",
      party_identifier_id: "The key of the identifier as Arca keeps it.",
      party_identifier_kind_code: "The kind of identifier.",
    },
  },
  partyIdentifierKind: {
    summary: "The kinds of identifier a party may hold: a tax number, a passport number, a company registration.",
    members: {},
  },
  partyKind: {
    summary: "The kinds of party: a person or an organization.",
    members: {},
  },
  partyRelation: {
    summary: "A relation between two parties for a time, read from the first to the second: Ada is employed by Analytical Engines.",
    members: {
      from_party_id: "The party the relation is read from.",
      party_relation_id: "The key of the relation.",
      party_relation_kind_code: "The way the first party is related to the second.",
      to_party_id: "The party the relation is read to.",
      valid_from: "The first day the relation held.",
      valid_to: "The last day the relation held; empty while it still does.",
    },
  },
  partyRelationKind: {
    summary: "The ways one party may be related to another: employed by, parent company of, married to.",
    members: {},
  },
  partyRole: {
    summary: "A role a party plays for a time: the same party may be a customer and a supplier at once.",
    members: {
      party_id: "The party who plays the role.",
      party_role_id: "The key of this playing of a role.",
      party_role_kind_code: "The role played.",
      valid_from: "The first day the party played the role.",
      valid_to: "The last day the party played the role; empty while they still do.",
    },
  },
  partyRoleKind: {
    summary: "The roles a party may play: customer, supplier, employee, and whatever else a business names.",
    members: {},
  },
  person: {
    summary: "A person: a party who is a human being. Their key is their party's key.",
    members: {
      birth_date: "The day the person was born.",
      family_name: "The name a person shares with their family, as they write it.",
      given_name: "The name a person is given, as they write it.",
      party_id: "The person's key, which is the key of their party.",
    },
  },
  postalAddress: {
    summary: "A place a party receives post or may be visited.",
    members: {
      country_code: "The country, as its two-letter ISO 3166-1 code.",
      line_1: "The first line: usually the building and the street.",
      line_2: "The second line, where there is one.",
      locality: "The town or city.",
      party_id: "The party found at the address.",
      postal_address_id: "The key of the address.",
      postal_code: "The postal code, where the country uses one.",
      purpose: "What the address is used for: where the party lives, is billed or receives deliveries.",
      region: "The state, province or county, where the country uses one.",
    },
  },
} as const;
