/**
 * What the model Arca replaces had, as its goldens show it, written here as plain text so that nothing of it is lost without a test saying so: its tables and their columns (without
 * the six housekeeping columns that every table of a concept also had), its constraints and its indexes, by name. Not a test itself.
 *
 * @module
 */

/** The columns the model it replaces had, as its goldens show them, without the six housekeeping columns every table of a concept also had. */
export const OLD_TABLES: Readonly<Record<string, readonly string[]>> = {
  party: ["party_id", "party_kind_code", "display_name"],
  person: ["party_id", "given_name", "family_name", "birth_date"],
  organization: ["party_id", "legal_name", "founded_on"],
  party_role: ["party_role_id", "party_id", "party_role_kind_code", "valid_from", "valid_to"],
  party_relation: ["party_relation_id", "from_party_id", "to_party_id", "party_relation_kind_code", "valid_from", "valid_to"],
  party_identifier: ["party_identifier_id", "party_id", "party_identifier_kind_code", "identifier", "issued_by"],
  electronic_contact: ["electronic_contact_id", "party_id", "medium", "address", "is_primary"],
  postal_address: ["postal_address_id", "party_id", "purpose", "line_1", "line_2", "locality", "region", "postal_code", "country_code"],
};

/** The names of the constraints the old model's SQLite golden gave, in order. */
export const OLD_CONSTRAINTS: readonly string[] = [
  "electronic_contact_party_id_fk",
  "organization_party_id_fk",
  "party_identifier_party_id_fk",
  "party_identifier_party_id_party_identifier_kind_code_uq",
  "party_identifier_party_identifier_kind_code_fk",
  "party_party_kind_code_fk",
  "party_relation_from_party_id_fk",
  "party_relation_parties_differ_ck",
  "party_relation_party_relation_kind_code_fk",
  "party_relation_to_party_id_fk",
  "party_role_party_id_fk",
  "party_role_party_role_kind_code_fk",
  "person_party_id_fk",
  "postal_address_party_id_fk",
];

/** The names of the indexes the old model's SQLite golden gave, in order. */
export const OLD_INDEXES: readonly string[] = [
  "electronic_contact_party_id_medium_idx",
  "party_relation_from_party_id_idx",
  "party_relation_to_party_id_idx",
  "party_role_party_id_party_role_kind_code_idx",
  "person_family_name_given_name_idx",
  "postal_address_party_id_idx",
];
