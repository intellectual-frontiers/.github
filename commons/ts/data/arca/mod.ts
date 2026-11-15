/**
 * Arca: the typical data models of Intellectual Frontiers Commons, built with IFC SQL Aide (commons 0009-sql-aide FR-047). A model is
 * TypeScript: import its tables to make SQL for PostgreSQL, SQLite or DuckDB, to type the rows of an application, or to extend them.
 *
 * @example
 * ```ts
 * import { context, definitions, postgres, render, type RowOf } from "../sql-aide/mod.ts";
 * import { partyDocs, partyModel, person } from "./mod.ts";
 * type Person = RowOf<typeof person>;
 * render(definitions(partyModel), context({ dialect: postgres(), docs: [partyDocs] }));
 * ```
 *
 * @module
 */
import { type Docs, docsOf } from "../sql-aide/mod.ts";
import { docs } from "./party.docs.auto.ts";
import * as partyModule from "./party.ts";
import {
  electronicContact,
  electronicContactByParty,
  organization,
  party,
  partyIdentifier,
  partyIdentifierKind,
  partyKind,
  partyRelation,
  partyRelationByFrom,
  partyRelationByTo,
  partyRelationKind,
  partyRole,
  partyRoleByParty,
  partyRoleKind,
  peopleBornSince,
  person,
  personByName,
  personDirectory,
  postalAddress,
  postalAddressByParty,
  retireParty,
} from "./party.ts";

export { codeTable } from "./patterns.ts";
export type { CodeColumns } from "./patterns.ts";
export {
  electronicContact,
  electronicContactByParty,
  organization,
  party,
  partyIdentifier,
  partyIdentifierKind,
  partyKind,
  partyRelation,
  partyRelationByFrom,
  partyRelationByTo,
  partyRelationKind,
  partyRole,
  partyRoleByParty,
  partyRoleKind,
  peopleBornSince,
  person,
  personByName,
  personDirectory,
  postalAddress,
  postalAddressByParty,
  retireParty,
};

/** Every table of the party model, for whatever takes the tables alone (lint, the row types). */
export const partyTables = [
  partyKind,
  partyRoleKind,
  partyRelationKind,
  partyIdentifierKind,
  party,
  person,
  organization,
  partyRole,
  partyRelation,
  partyIdentifier,
  electronicContact,
  postalAddress,
] as const;

/** The indexes of the party model. */
export const partyIndexes = [
  personByName,
  partyRoleByParty,
  partyRelationByFrom,
  partyRelationByTo,
  electronicContactByParty,
  postalAddressByParty,
] as const;

/** The views of the party model. */
export const partyViews = [personDirectory] as const;

/** The routines of the party model: a function for PostgreSQL and DuckDB, and a procedure for PostgreSQL. */
export const partyRoutines = [peopleBornSince, retireParty] as const;

/** Everything the party model defines for every dialect: its tables, then its indexes and views. */
export const partyModel = [...partyTables, ...partyIndexes, ...partyViews] as const;

/** The documentation of the party model, from its TSDoc comments: pass it to a context and the SQL carries it. */
export const partyDocs: Docs = docsOf(partyModule, docs);
