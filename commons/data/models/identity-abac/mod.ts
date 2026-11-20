// Spec: 0034-identity-abac FR-001, FR-002, FR-003
/**
 * Attribute-based access as a module (commons data 0034-identity-abac): a registry of the attributes that decisions may use (of the subject, the resource, the environment and the action), the values
 * that principals and resources have, and policies whose conditions are written over them. A principal of any kind has attributes: a person's department, a machine's environment, a device's
 * compliance, an agent's autonomy. A value that is older than its definition allows is unknown, never true.
 *
 * @module
 */
import { type AnyConcept, codeOf, concept, defineModule, instant, integer, structured, text } from "@intellectual-frontiers/data/governance";
import { tenant } from "@intellectual-frontiers/data/models/arca-tenancy";
import { accessRole, permission } from "@intellectual-frontiers/data/models/identity-access";
import { citing, confidential, internal, key, list, lookup, many, maybe, one, opt, principal, principalKind, req, unique, useStatus } from "@intellectual-frontiers/data/models/identity";

const cites = citing("0034-identity-abac");

/** What an attribute is an attribute of. */
export const attributeCategory = list("attributeCategory", "What an attribute is an attribute of", { subject: "The principal that acts", resource: "The thing acted on", environment: "The circumstances of the request", action: "What is being done" });
/** The type of the values of an attribute. */
export const attributeValueType = list("attributeValueType", "The type of the values of an attribute", { text: "Free text", integer: "A whole number", boolean: "True or false", instant: "A point in time", textSet: "A set of texts" });
/** Where the values of an attribute come from. */
export const attributeSource = list("attributeSource", "Where the values of an attribute come from", { stored: "Kept here", request: "Given with the request", posture: "Reported by a device's posture", directory: "Pushed by a directory", derived: "Computed from others" });
/** How sensitive the values of an attribute are. */
export const sensitivityLevel = list("sensitivityLevel", "How sensitive the values of an attribute are", { public: "Anyone may see them", internal: "Staff may", confidential: "Those who need them may", restricted: "Very few may" });
/** What a policy decides. */
export const policyEffect = list("policyEffect", "What a policy decides", { allow: "Allows what it matches", deny: "Refuses what it matches, whatever else allows it" });
/** An attribute that decisions may use, with its type, where its values come from and how old they may be. */
export const obligation = list("obligation", "What must happen before an allowed action is done", { none: "Nothing", stepUp: "The principal proves who they are again", approval: "A person approves it" });
/** An attribute that decisions may use, with its type, where its values come from and how old they may be. */
export const expressionLanguage = list("expressionLanguage", "The language a condition is written in", { expr: "The library's own closed expression tree", cedar: "The Cedar policy language", cel: "The Common Expression Language", rego: "Open Policy Agent's Rego language" }, true);

/** An attribute that decisions may use, with its type, where its values come from and how old they may be. */
export const attributeDefinition = concept("attributeDefinition", {
  definition: "An attribute that decisions may use, with its type, where its values come from and how old they may be",
  attributes: {
    attributeDefinitionId: key("the attribute"),
    attributeKey: req(text(), "The attribute as `category.name`, unique"),
    category: req(codeOf(attributeCategory), "What it is an attribute of"),
    valueType: req(codeOf(attributeValueType), "The type of its values"),
    source: req(codeOf(attributeSource), "Where its values come from"),
    subjectKinds: many(codeOf(principalKind), "The kinds of principal it applies to; every kind where none is said"),
    resourceType: opt(text(), "The kind of resource it applies to"),
    sensitivity: req(codeOf(sensitivityLevel), "How sensitive its values are"),
    freshnessSeconds: opt(integer(), "How old a stored value may be before it reads as unknown"),
    definition: req(text(), "What the attribute means"),
    status: req(codeOf(useStatus), "Whether the attribute is in use"),
  },
  identifiedBy: ["attributeDefinitionId"],
  relationships: { tenant: maybe(tenant, "The tenant that defined it; empty for the platform's") },
  annotations: [internal, cites("FR-001"), unique("attributeKey")],
});

/** A value of an attribute for a principal of any kind. */
export const principalAttribute = concept("principalAttribute", {
  definition: "A value of an attribute for a principal of any kind",
  attributes: {
    value: req(structured(), "The value, of the type the definition says"),
    validFrom: req(instant(), "When the value starts to hold"),
    validTo: opt(instant(), "When it stops, where it does"),
    updatedAt: req(instant(), "When it was last asserted"),
  },
  identifiedBy: ["principal", "definition"],
  relationships: {
    principal: one(principal, "The principal"),
    definition: one(attributeDefinition, "The attribute"),
    assertedBy: maybe(principal, "Who asserted it, where a principal did"),
  },
  annotations: [confidential, cites("FR-002")],
});

/** A value of an attribute for a resource. */
export const resourceAttribute = concept("resourceAttribute", {
  definition: "A value of an attribute for a resource",
  attributes: {
    resourceAttributeId: key("the value"),
    resourceType: req(text(), "The kind of resource"),
    resourceId: req(text(), "The resource"),
    value: req(structured(), "The value, of the type the definition says"),
    updatedAt: req(instant(), "When it was last asserted"),
    valueKey: req(text(), "A hash of the tenant, the resource and the attribute, unique, so that a resource has one value of an attribute"),
  },
  identifiedBy: ["resourceAttributeId"],
  relationships: { tenant: one(tenant, "The tenant the resource is in"), definition: one(attributeDefinition, "The attribute") },
  annotations: [internal, cites("FR-002"), unique("valueKey"), lookup("resourceType", "resourceId")],
});

/** A rule of attribute-based access: a condition over attributes that allows or refuses an action. A refusal always wins. */
export const accessPolicy = concept("accessPolicy", {
  definition: "A rule of attribute-based access: a condition over attributes that allows or refuses an action; a refusal always wins",
  attributes: {
    accessPolicyId: key("the policy"),
    name: req(text(), "What the policy is called"),
    definition: req(text(), "What the policy is for"),
    effect: req(codeOf(policyEffect), "What it decides"),
    appliesTo: opt(codeOf(principalKind), "The kind of principal it is about; every kind where it is empty"),
    actionPattern: req(text(), "The permission it is about: exact, or a prefix ending `*`"),
    resourceType: opt(text(), "The kind of resource it is about"),
    expression: req(text(), "When it applies, written in its language"),
    expressionLanguage: req(codeOf(expressionLanguage), "The language of the condition"),
    obligation: req(codeOf(obligation), "What must happen before an allowed action is done"),
    priority: req(integer(), "The order policies are evaluated and explained in; a refusal wins whatever it is"),
    status: req(codeOf(useStatus), "Whether it is applied"),
    version: req(integer(), "Which version of the policy this is"),
    validFrom: opt(instant(), "When it starts to apply"),
    validTo: opt(instant(), "When it stops"),
    policyKey: req(text(), "A hash of the tenant, the name and the version, unique"),
  },
  identifiedBy: ["accessPolicyId"],
  relationships: {
    tenant: maybe(tenant, "The tenant it is for; empty for the platform's"),
    scopePrincipal: maybe(principal, "The principal or group it is scoped to"),
    requiresRole: maybe(accessRole, "A role a principal must also hold for the policy to allow"),
    permission: maybe(permission, "The permission it is about, where it is about exactly one"),
  },
  annotations: [internal, cites("FR-003"), unique("policyKey"), lookup("actionPattern")],
});

export const concepts: readonly AnyConcept[] = [attributeDefinition, principalAttribute, resourceAttribute, accessPolicy];
/** Attribute-based access for every kind of principal. */
export const identityAbacModule = defineModule({
  name: "identityAbac",
  definition: "Attribute-based access for every kind of principal",
  requires: ["identityAccess"],
  concepts,
  codeLists: [attributeCategory, attributeValueType, attributeSource, sensitivityLevel, policyEffect, obligation, expressionLanguage],
});
