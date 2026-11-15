/**
 * The reference data of Arca's party model: the rows of its code tables, written in TypeScript and loaded as integrations, so that the
 * compiler holds each row to its table and loading them again changes nothing (commons 0009-sql-aide FR-032, FR-047). A business adds
 * its own codes with integrations of its own into the same tables. The same rows are also the data of an ephemeral build of the code
 * tables alone (FR-053).
 *
 * @module
 */
import { dataOf, seed } from "../sql-aide/mod.ts";
import { partyIdentifierKind, partyKind, partyRelationKind, partyRoleKind } from "./party.ts";

/** The rows of the two kinds of party. */
export const partyKindsRows = [
  { code: "person", label: "Person", description: "A human being" },
  { code: "organization", label: "Organization", description: "A company, agency, club or any other body" },
] as const;

/** The kinds of party, loaded as an integration into a database that keeps them. */
export const partyKinds = seed("party_kind_reference", partyKind, partyKindsRows);

/** The rows of the roles most businesses name. */
export const partyRoleKindsRows = [
  { code: "customer", label: "Customer", description: "Buys from the business" },
  { code: "supplier", label: "Supplier", description: "Sells to the business" },
  { code: "employee", label: "Employee", description: "Works for the business under a contract of employment" },
  { code: "contact", label: "Contact", description: "Speaks for another party" },
] as const;

/** The roles, loaded as an integration into a database that keeps them. */
export const partyRoleKinds = seed("party_role_kind_reference", partyRoleKind, partyRoleKindsRows);

/** The rows of the relations most businesses keep between parties. */
export const partyRelationKindsRows = [
  { code: "employed_by", label: "Employed by", description: "A person works for an organization" },
  { code: "member_of", label: "Member of", description: "A party belongs to an organization" },
  { code: "subsidiary_of", label: "Subsidiary of", description: "An organization is controlled by another" },
] as const;

/** The relations, loaded as an integration into a database that keeps them. */
export const partyRelationKinds = seed("party_relation_kind_reference", partyRelationKind, partyRelationKindsRows);

/** The rows of the identifiers most businesses record. */
export const partyIdentifierKindsRows = [
  { code: "tax_number", label: "Tax number", description: "A number a tax authority issued" },
  { code: "passport_number", label: "Passport number", description: "The number of a passport a state issued" },
  { code: "company_registration", label: "Company registration", description: "The number a register of companies issued" },
] as const;

/** The identifiers, loaded as an integration into a database that keeps them. */
export const partyIdentifierKinds = seed("party_identifier_kind_reference", partyIdentifierKind, partyIdentifierKindsRows);

/** The reference data of the party model, in the order it is loaded. */
export const partyReference = [partyKinds, partyRoleKinds, partyRelationKinds, partyIdentifierKinds] as const;

/** The reference data as the rows of an ephemeral build: a database of the code tables alone, made from the TypeScript (FR-053). */
export const partyReferenceData = [
  dataOf(partyKind, partyKindsRows),
  dataOf(partyRoleKind, partyRoleKindsRows),
  dataOf(partyRelationKind, partyRelationKindsRows),
  dataOf(partyIdentifierKind, partyIdentifierKindsRows),
] as const;

/** The code tables, which that database defines. */
export const partyCodeTables = [partyKind, partyRoleKind, partyRelationKind, partyIdentifierKind] as const;
