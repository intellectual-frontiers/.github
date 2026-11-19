// Spec: 0029-arca-tenancy FR-001, FR-002, FR-003
/**
 * Arca's tenancy model as a module (commons data 0029-arca-tenancy): the boundary that separates one customer's data from another's, and the hierarchy of boundaries a B2B or B2B2C business has
 * (a platform, the resellers and businesses on it, the pools of consumers of a business). It requires the party model and nothing else, and is written to be required by others (identity, orders,
 * billing, content) that want a scope without depending on each other.
 *
 * @module
 */
import {
  type AnyConcept,
  annotate,
  attribute,
  codeList,
  codeOf,
  concept,
  defineModule,
  identifier,
  instant,
  relationship,
  text,
  vocabularies,
} from "@intellectual-frontiers/data/governance";
import { organization, partyDomain } from "@intellectual-frontiers/data/models/arca";

const { quality, requirements, security, usage } = vocabularies;
const cites = (...frs: readonly string[]) =>
  annotate(
    requirements.cites,
    frs.map((fr) => `0029-arca-tenancy ${fr}`),
  );
const internal = annotate(security.classification, "internal");

/** The kinds of tenant, from the vendor down to a pool of consumers. */
export const tenantKind = codeList("tenantKind", {
  definition: "What a tenant is in the hierarchy of boundaries",
  codes: {
    platform: { label: "Platform", definition: "The vendor's own boundary, the root of every other" },
    reseller: { label: "Reseller", definition: "A business that serves businesses of its own on the platform" },
    business: { label: "Business", definition: "A business that is a customer of the platform" },
    consumerPool: { label: "Consumer pool", definition: "The consumers of a business, kept apart from its staff and from other businesses' consumers" },
  },
  annotations: [annotate(quality.openness, "closed"), cites("FR-002")],
});

/** Where a tenant is in its life. */
export const tenantStatus = codeList("tenantStatus", {
  definition: "Where a tenant is in its life",
  codes: {
    active: { label: "Active", definition: "In use" },
    suspended: { label: "Suspended", definition: "Held: nothing may be done in it, and nothing is lost" },
    closed: { label: "Closed", definition: "Ended: kept only as long as its data is" },
  },
  annotations: [annotate(quality.openness, "closed"), cites("FR-002")],
});

/** How much of the platform a tenant has to itself. */
export const isolation = codeList("isolation", {
  definition: "How much of the platform a tenant has to itself",
  codes: {
    shared: { label: "Shared", definition: "Its rows are kept apart from others' by its scope, in tables others use too" },
    dedicated: { label: "Dedicated", definition: "Its data is kept in a place of its own" },
  },
  annotations: [annotate(quality.openness, "closed"), cites("FR-002")],
});

/**
 * A tenant: the boundary that separates one customer's data from another's. A WorkOS organization or an Okta org is a `business` tenant; the vendor is the root `platform` tenant; the consumers of
 * a business are a `consumerPool` tenant whose parent is that business.
 */
export const tenant: AnyConcept = concept("tenant", {
  definition: "A boundary that separates one customer's data from another's, in a hierarchy of boundaries",
  attributes: {
    tenantId: attribute(identifier(), { definition: "What identifies the tenant, made by the application when it is created" }),
    kind: attribute(codeOf(tenantKind), { definition: "What the tenant is in the hierarchy" }),
    slug: attribute(text(), { definition: "The short name the tenant is addressed by, unique among tenants" }),
    displayName: attribute(text(), { definition: "The name the tenant is shown by" }),
    ancestry: attribute(text(), {
      definition: "The path of the tenant's parents from the root, kept by the operation that moves a tenant, so that a subtree is one query",
    }),
    status: attribute(codeOf(tenantStatus), { definition: "Where the tenant is in its life" }),
    isolation: attribute(codeOf(isolation), { definition: "How much of the platform the tenant has to itself" }),
    createdAt: attribute(instant(), { definition: "When the tenant was made" }),
  },
  identifiedBy: ["tenantId"],
  relationships: {
    organization: relationship(organization, {
      cardinality: "optional",
      definition: "The organization the tenant is for; a pool of consumers has none",
    }),
    parent: relationship(() => tenant, { cardinality: "optional", definition: "The tenant this one is under; the root has none" }),
  },
  annotations: [
    internal,
    cites("FR-001", "FR-002", "FR-003"),
    annotate(quality.unique, { members: ["slug"] }),
    annotate(quality.differs, { name: "tenant_not_its_own_parent", members: ["tenantId", "parent"] }),
    annotate(usage.lookup, { members: ["parent"] }),
  ],
});

/** The tenancy module: the party model's, plus tenants. */
export const tenancyModule = defineModule({
  name: "arcaTenancy",
  definition: "The boundaries that separate one customer's data from another's, and their hierarchy",
  requires: [partyDomain.kind === "ok" ? partyDomain.value.name : "arcaParty"],
  concepts: [tenant],
  codeLists: [tenantKind, tenantStatus, isolation],
});

