/**
 * The reference data of Arca's party model: the rows of its code tables, written in TypeScript and loaded as integrations, so that the
 * compiler holds each row to its table and loading them again changes nothing (commons 0009-sql-aide FR-032, FR-047). A business adds
 * its own codes with integrations of its own into the same tables.
 *
 * @module
 */
import { seed } from "../sql-aide/mod.ts";
import { partyIdentifierKind, partyKind, partyRelationKind, partyRoleKind } from "./party.ts";

/** The two kinds of party. */
export const partyKinds = seed("party_kind_reference", partyKind, [
  { code: "person", label: "Person", description: "A human being" },
  { code: "organization", label: "Organization", description: "A company, agency, club or any other body" },
]);

/** The roles most businesses name. */
export const partyRoleKinds = seed("party_role_kind_reference", partyRoleKind, [
  { code: "customer", label: "Customer", description: "Buys from the business" },
  { code: "supplier", label: "Supplier", description: "Sells to the business" },
  { code: "employee", label: "Employee", description: "Works for the business under a contract of employment" },
  { code: "contact", label: "Contact", description: "Speaks for another party" },
]);

/** The relations most businesses keep between parties. */
export const partyRelationKinds = seed("party_relation_kind_reference", partyRelationKind, [
  { code: "employed_by", label: "Employed by", description: "A person works for an organization" },
  { code: "member_of", label: "Member of", description: "A party belongs to an organization" },
  { code: "subsidiary_of", label: "Subsidiary of", description: "An organization is controlled by another" },
]);

/** The identifiers most businesses record. */
export const partyIdentifierKinds = seed("party_identifier_kind_reference", partyIdentifierKind, [
  { code: "tax_number", label: "Tax number", description: "A number a tax authority issued" },
  { code: "passport_number", label: "Passport number", description: "The number of a passport a state issued" },
  { code: "company_registration", label: "Company registration", description: "The number a register of companies issued" },
]);

/** The reference data of the party model, in the order it is loaded. */
export const partyReference = [partyKinds, partyRoleKinds, partyRelationKinds, partyIdentifierKinds] as const;
