// Spec: 0035-identity-rebac FR-001, FR-002
/**
 * Relationship-based access as a module (commons data 0035-identity-rebac), in the style of Zanzibar: a model of object types and relations, and the facts (tuples) that say this subject has this
 * relation to this object, with caveats and expiry. A permission relation joins it to the shared registry of permissions, so that holding a relation on an object grants a permission the same way a
 * role does.
 *
 * @module
 */
import { type AnyConcept, codeOf, concept, defineModule, instant, integer, structured, text } from "@intellectual-frontiers/data/governance";
import { tenant } from "@intellectual-frontiers/data/models/arca-tenancy";
import { permission } from "@intellectual-frontiers/data/models/identity-access";
import { citing, internal, key, lookup, maybe, one, opt, req, unique, useStatus } from "@intellectual-frontiers/data/models/identity";

const cites = citing("0035-identity-rebac");

/** The definition of a relationship-based access model: its types, relations and rewrites, and its caveats. */
export const authorizationModel = concept("authorizationModel", {
  definition: "The definition of a relationship-based access model: its object types, relations, rewrites and caveats",
  attributes: {
    authorizationModelId: key("the model"),
    version: req(integer(), "Which version of the model this is"),
    definition: req(structured(), "The types, relations, rewrites and caveats"),
    status: req(codeOf(useStatus), "Whether it is in use"),
  },
  identifiedBy: ["authorizationModelId"],
  relationships: { tenant: maybe(tenant, "The tenant it is for; empty for the platform's") },
  annotations: [internal, cites("FR-001")],
});

/** A fact of relationship-based access: this subject has this relation to this object. */
export const relationTuple = concept("relationTuple", {
  definition: "A fact of relationship-based access: this subject has this relation to this object, perhaps under a caveat and until a time",
  attributes: {
    relationTupleId: key("the fact"),
    tupleKey: req(text(), "A hash of the tenant, the object, the relation and the subject, unique, so that a fact is not recorded twice"),
    objectType: req(text(), "The kind of the object"),
    objectId: req(text(), "The object"),
    relation: req(text(), "The relation"),
    subjectType: req(text(), "The kind of the subject: a kind of principal, or a kind of object"),
    subjectId: req(text(), "The subject"),
    subjectRelation: opt(text(), "The relation of the subject that is meant, where a set is"),
    caveat: opt(text(), "The name of a caveat of the model that must hold"),
    caveatContext: opt(structured(), "The values the caveat is given"),
    expiresAt: opt(instant(), "When the fact stops holding"),
    createdAt: req(instant(), "When the fact was recorded"),
  },
  identifiedBy: ["relationTupleId"],
  relationships: { tenant: one(tenant, "The tenant the fact is in") },
  annotations: [internal, cites("FR-001"), unique("tupleKey"), lookup("objectType", "objectId", "relation"), lookup("subjectType", "subjectId")],
});

/** What holding a relation on an object of a type grants. */
export const permissionRelation = concept("permissionRelation", {
  definition: "What holding a relation on an object of a type grants: the join between relationships and the permissions every kind of access shares",
  attributes: { objectType: req(text(), "The kind of object"), relation: req(text(), "The relation that grants the permission") },
  identifiedBy: ["permission", "objectType"],
  relationships: { permission: one(permission, "The permission granted") },
  annotations: [internal, cites("FR-002")],
});

export const concepts: readonly AnyConcept[] = [authorizationModel, relationTuple, permissionRelation];
/** Relationship-based access. */
export const identityRebacModule = defineModule({ name: "identityRebac", definition: "Relationship-based access", requires: ["identityAccess"], concepts, codeLists: [] });
