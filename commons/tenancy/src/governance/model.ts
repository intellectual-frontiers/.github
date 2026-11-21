// Spec: 0002-tenancy FR-001, FR-002
/**
 * The model of tenancy for a service provider (0002-tenancy FR-001, FR-002): parties (an operator and its clients), the principals who act for a party, and the grants that let a principal act on a client's tenant in a role, for a time. A client's own people are granted on their own tenant;
 * an operator's people are granted on a client only through a live engagement between the two. What a role may do is data here, and nothing is allowed that no live grant gives.
 *
 * @example
 * ```ts
 * import { ROLE_ACTIONS } from "./model.ts";
 * ROLE_ACTIONS.viewer; // ["read"]
 * ```
 *
 * @module
 */

/** What a person may be to a tenant. */
export const ROLES = ["owner", "operator", "auditor", "viewer"] as const;
/** A role. */
export type Role = (typeof ROLES)[number];

/** What can be done to a tenant. */
export const ACTIONS = ["read", "record-evidence", "determine", "approve-change", "administer", "export"] as const;
/** An action. */
export type Action = (typeof ACTIONS)[number];

/** What each role may do: the owner everything; the operator's staff work in the tenant but neither determine an objective, approve a change nor administer; an auditor reads and determines; a viewer reads. */
export const ROLE_ACTIONS: Readonly<Record<Role, readonly Action[]>> = {
  owner: ["read", "record-evidence", "determine", "approve-change", "administer", "export"],
  operator: ["read", "record-evidence", "export"],
  auditor: ["read", "determine", "export"],
  viewer: ["read"],
};

/** A party: an operator (a service provider) or a client (an organization whose tenant it is). */
export type Party = { readonly id: string; readonly kind: "operator" | "client"; readonly name: string };
/** A person or service that acts for a party. */
export type Principal = { readonly id: string; readonly party: string };
/** A grant of a role on a tenant (the client's id), from an instant until another (open where absent). */
export type Grant = { readonly principal: string; readonly tenant: string; readonly role: Role; readonly from: string; readonly until?: string };
/** An engagement: an operator serves a client, from an instant until another (open where absent). */
export type Engagement = { readonly operator: string; readonly client: string; readonly from: string; readonly until?: string };

/** The whole model of one deployment. */
export type Model = { readonly parties: readonly Party[]; readonly principals: readonly Principal[]; readonly engagements: readonly Engagement[]; readonly grants: readonly Grant[] };
