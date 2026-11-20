// Spec: 0033-identity-access FR-001
/**
 * The code lists of role-based access (commons data 0033-identity-access).
 *
 * @module
 */
import { list } from "@intellectual-frontiers/data/models/identity";

/** Whether a role is the platform's or a tenant's. */
export const roleKind = list("roleKind", "Whether a role is the platform's or a tenant's", { system: "Made by the platform and the same for every tenant", custom: "Made by a tenant" });
/** How much harm a permission can do if it is misused. */
export const riskLevel = list("riskLevel", "How much harm a permission can do if it is misused", {
  low: "Little harm, and easily undone",
  medium: "Some harm",
  high: "Serious harm, or access to personal data",
  critical: "Harm that cannot be undone, or that reaches many tenants",
});
/** What using a permission does. */
export const sideEffect = list("sideEffect", "What using a permission does", {
  none: "Nothing that outlasts the call",
  read: "Reads data",
  write: "Changes data that can be changed back",
  external: "Does something outside the system",
  irreversible: "Does something that cannot be undone",
});
/** Where a role assignment is. */
export const assignmentStatus = list("assignmentStatus", "Where a role assignment is", { active: "In force", revoked: "Ended by a person or a policy", expired: "Ended by time" });
/** How a role came to be assigned. */
export const assignmentVia = list("assignmentVia", "How a role came to be assigned", {
  direct: "By an administrator",
  privilegedGrant: "By a time-boxed privileged grant",
  directory: "By a directory that maps groups to roles",
  invitation: "By accepting an invitation",
});
/** How a separation of duties is held. */
export const separationKind = list("separationKind", "How a separation of duties is held", { static: "No principal may hold the roles together, at any time" }, true);
/** Where a tenant's entitlement comes from. */
export const entitlementSource = list("entitlementSource", "Where a tenant's entitlement comes from", { plan: "A plan it is on", contract: "An agreement", grant: "Given by the platform" }, true);
