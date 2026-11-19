// Spec: 0033-identity-access FR-001, FR-002, FR-003, FR-004
/**
 * Role-based access for every kind of principal (commons data 0033-identity-access): permissions, roles that inherit from roles, roles that hold permissions, rules of separation of duties, the
 * assignment of a role to a principal in a tenant for a time, and the entitlements of a tenant. Every kind of principal (a person, a machine, a device, an agent, a group) is granted by one
 * `roleAssignment`; what a kind may hold is said by the role and the permission, not by a table of its own.
 *
 * @module
 */
import { annotate, type AnyConcept, boolean, codeOf, concept, instant, integer, text, vocabularies } from "@intellectual-frontiers/data/governance";
import { tenant } from "@intellectual-frontiers/data/models/arca-tenancy";
import { citing, confidential, internal, invitation, key, lookup, many, maybe, one, opt, principal, principalKind, req, unique, useStatus } from "@intellectual-frontiers/data/models/identity";
import * as c from "./codes.ts";

const cites = citing("0033-identity-access");
const { quality } = vocabularies;

/** A thing that can be done, named `resource:action`; every module registers its own. */
export const permission = concept("permission", {
  definition: "A thing that can be done, named by its resource and its action",
  attributes: {
    permissionId: key("the permission"),
    permissionKey: req(text(), "The permission as `resource:action`, unique"),
    definition: req(text(), "What the permission lets a principal do"),
    ownerModule: req(text(), "The module that registered the permission"),
    riskLevel: req(codeOf(c.riskLevel), "How much harm it can do if it is misused"),
    sideEffect: req(codeOf(c.sideEffect), "What using it does"),
    appliesTo: many(codeOf(principalKind), "The kinds of principal that may hold it; every kind where none is said"),
    featureKey: opt(text(), "The feature a tenant must be entitled to for the permission to count"),
  },
  identifiedBy: ["permissionId"],
  annotations: [internal, cites("FR-001"), unique("permissionKey"), lookup("riskLevel")],
});

/** A role: a set of permissions that is granted together, and may inherit those of other roles. */
export const accessRole = concept("accessRole", {
  definition: "A set of permissions that is granted together, and that may inherit those of other roles",
  attributes: {
    roleId: key("the role"),
    roleKey: req(text(), "The role's short name, unique within its tenant"),
    name: req(text(), "What the role is called"),
    kind: req(codeOf(c.roleKind), "Whether the platform or a tenant made it"),
    definition: req(text(), "What a holder of the role does"),
    appliesTo: many(codeOf(principalKind), "The kinds of principal that may hold it; people, machines and groups where none is said"),
    isPrivileged: req(boolean(), "Whether it is a role that an agent may never hold, and that needs a time-boxed grant where privileged access is composed"),
    status: req(codeOf(useStatus), "Whether the role is in use"),
  },
  identifiedBy: ["roleId"],
  relationships: { tenant: maybe(tenant, "The tenant that made the role; empty for a role of the platform, usable in every tenant") },
  annotations: [internal, cites("FR-001"), unique("tenant", "roleKey")],
});

/** A role inherits another: whoever holds the senior holds what the junior holds. */
export const roleInheritance = concept("roleInheritance", {
  definition: "A role that inherits another: whoever holds the senior role holds what the junior role holds",
  attributes: {},
  identifiedBy: ["senior", "junior"],
  relationships: { senior: one(accessRole, "The role that inherits"), junior: one(accessRole, "The role that is inherited") },
  annotations: [internal, cites("FR-001"), annotate(quality.differs, { name: "role_not_its_own_junior", members: ["senior", "junior"] })],
});

/** A permission that a role holds. */
export const rolePermission = concept("rolePermission", {
  definition: "A permission that a role holds",
  attributes: {},
  identifiedBy: ["role", "permission"],
  relationships: { role: one(accessRole, "The role"), permission: one(permission, "The permission") },
  annotations: [internal, cites("FR-001")],
});

/** A rule that no principal may hold too many of a set of roles. */
export const separationRule = concept("separationRule", {
  definition: "A rule that no principal may hold too many of a set of roles together",
  attributes: {
    separationRuleId: key("the rule"),
    name: req(text(), "What the rule is called"),
    kind: req(codeOf(c.separationKind), "How the separation is held"),
    limitCount: req(integer(), "How many of the roles together are too many: two for the classic pair"),
    status: req(codeOf(useStatus), "Whether the rule is applied"),
  },
  identifiedBy: ["separationRuleId"],
  relationships: { tenant: maybe(tenant, "The tenant the rule is for; empty for the platform's") },
  annotations: [internal, cites("FR-002")],
});

/** A role that a separation rule is about. */
export const separationRuleRole = concept("separationRuleRole", {
  definition: "A role that a separation rule is about",
  attributes: {},
  identifiedBy: ["rule", "role"],
  relationships: { rule: one(separationRule, "The rule"), role: one(accessRole, "The role") },
  annotations: [internal, cites("FR-002")],
});

/** A role granted to a principal of any kind, in a tenant, perhaps for one resource and for a time. */
export const roleAssignment = concept("roleAssignment", {
  definition: "A role granted to a principal of any kind, in a tenant, perhaps for one resource and for a time",
  attributes: {
    roleAssignmentId: key("the grant"),
    resourceType: opt(text(), "The kind of the one resource the grant is limited to, where it is"),
    resourceId: opt(text(), "The one resource the grant is limited to, where it is"),
    validFrom: req(instant(), "When the grant starts"),
    validTo: opt(instant(), "When the grant ends, where it does"),
    reason: opt(text(), "Why it was granted"),
    status: req(codeOf(c.assignmentStatus), "Where the grant is"),
    revokedAt: opt(instant(), "When it was ended early"),
    via: req(codeOf(c.assignmentVia), "How it came to be"),
    assignmentKey: req(text(), "A hash of the principal, the role, the tenant and the resource, unique, so that a grant is not made twice where the resource is empty"),
  },
  identifiedBy: ["roleAssignmentId"],
  relationships: {
    principal: one(principal, "Who holds the role"),
    role: one(accessRole, "The role"),
    tenant: one(tenant, "The tenant the grant is in"),
    grantedBy: one(principal, "Who granted it"),
  },
  annotations: [confidential, cites("FR-003"), unique("assignmentKey"), lookup("principal", "tenant"), lookup("role")],
});

/** What a tenant may use, as distinct from what a user may do. */
export const entitlement = concept("entitlement", {
  definition: "What a tenant may use, as distinct from what a principal may do",
  attributes: {
    entitlementId: key("the entitlement"),
    featureKey: req(text(), "The feature the tenant may use"),
    limitValue: opt(integer(), "How much of it, where it is limited"),
    validFrom: req(instant(), "When it starts"),
    validTo: opt(instant(), "When it ends, where it does"),
    source: req(codeOf(c.entitlementSource), "Where it comes from"),
  },
  identifiedBy: ["entitlementId"],
  relationships: { tenant: one(tenant, "The tenant") },
  annotations: [internal, cites("FR-004"), lookup("tenant", "featureKey")],
});

/** A role that an invitation grants when it is accepted. */
export const invitationRole = concept("invitationRole", {
  definition: "A role that an invitation grants when it is accepted",
  attributes: {},
  identifiedBy: ["invitation", "role"],
  relationships: { invitation: one(invitation, "The invitation"), role: one(accessRole, "The role") },
  annotations: [internal, cites("FR-003")],
});

export const concepts: readonly AnyConcept[] = [permission, accessRole, roleInheritance, rolePermission, separationRule, separationRuleRole, roleAssignment, entitlement, invitationRole];
