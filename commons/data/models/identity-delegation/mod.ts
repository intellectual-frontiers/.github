// Spec: 0039-identity-delegation FR-001, FR-002
/**
 * Delegation as a module (commons data 0039-identity-delegation): one principal acting on behalf of another, for any kinds of principals, with attenuation. A delegation can only pass on a subset
 * of what its delegator holds, can only narrow the condition of its parent, can only be shorter than its parent, and can only be re-delegated fewer times. What a delegate may do is derived from the
 * chain at the time of the decision, so that revoking a delegation ends everything below it at once.
 *
 * @module
 */
import { type AnyConcept, boolean, codeOf, concept, defineModule, instant, integer, text } from "@intellectual-frontiers/data/governance";
import { tenant } from "@intellectual-frontiers/data/models/arca-tenancy";
import { permission } from "@intellectual-frontiers/data/models/identity-access";
import { expressionLanguage } from "@intellectual-frontiers/data/models/identity-abac";
import { citing, confidential, key, keep, list, lookup, maybe, one, opt, principal, req } from "@intellectual-frontiers/data/models/identity";
import { annotate, vocabularies } from "@intellectual-frontiers/data/governance";

const cites = citing("0039-identity-delegation");
export const delegationStatus = list("delegationStatus", "Where a delegation is", { active: "In force", revoked: "Ended by a person, or by the end of the delegation above it", expired: "Ended by time" });

/** One principal acting on behalf of another, for a time, for some permissions: attenuated at every step. */
export const delegation: AnyConcept = concept("delegation", {
  definition: "One principal acting on behalf of another, for a time and for some permissions, never more than the one above it",
  attributes: {
    delegationId: key("the delegation"),
    depth: req(integer(), "How many delegations are above it: none for the first"),
    purpose: req(text(), "What it is for"),
    resourceType: opt(text(), "The kind of the one resource it is limited to"),
    resourceId: opt(text(), "The resource it is limited to: exact, or a prefix ending `*`"),
    expression: opt(text(), "An extra condition; the conditions of the delegations above it hold too, so a delegation can only add"),
    expressionLanguage: opt(codeOf(expressionLanguage), "The language of the condition"),
    redelegable: req(boolean(), "Whether the delegate may pass it on"),
    maxDepth: req(integer(), "How many more delegations may be added below it; less than the one above it"),
    validFrom: req(instant(), "When it starts"),
    expiresAt: req(instant(), "When it ends: a delegation always ends, and never after the one above it"),
    status: req(codeOf(delegationStatus), "Where it is", annotate(vocabularies.quality.transitions, { allowed: { active: ["revoked", "expired"], revoked: [], expired: [] } })),
    revokedAt: opt(instant(), "When it was ended early"),
    revokeReason: opt(text(), "Why it was ended early"),
  },
  identifiedBy: ["delegationId"],
  relationships: {
    tenant: one(tenant, "The tenant it is in"),
    delegator: one(principal, "Who passes on what they hold"),
    delegate: one(principal, "Who acts on their behalf"),
    parent: maybe(() => delegation, "The delegation it was made under, where it was made under one"),
    root: maybe(() => delegation, "The first delegation of the chain, where it is not itself the first"),
    revokedBy: maybe(principal, "Who ended it early"),
  },
  annotations: [
    confidential,
    keep(365),
    cites("FR-001"),
    annotate(vocabularies.quality.differs, { name: "delegator_not_delegate", members: ["delegator", "delegate"] }),
    lookup("delegate", "status"),
    lookup("parent"),
    lookup("root"),
  ],
});

/** A permission that a delegation passes on. */
export const delegationPermission = concept("delegationPermission", {
  definition: "A permission that a delegation passes on: a subset of what the delegator held, and of what the delegation above it passed on",
  attributes: {},
  identifiedBy: ["delegation", "permission"],
  relationships: { delegation: one(delegation, "The delegation"), permission: one(permission, "The permission") },
  annotations: [confidential, cites("FR-002")],
});

export const concepts: readonly AnyConcept[] = [delegation, delegationPermission];
export const identityDelegationModule = defineModule({ name: "identityDelegation", definition: "One principal acting on behalf of another, with attenuation", requires: ["identityAccess", "identityAbac"], concepts, codeLists: [delegationStatus] });
