// Spec: 0071-uat-kit FR-002
/**
 * The example application of the UAT kit (commons data 0071-uat-kit FR-002): the customer relationship data of a business-to-business product, for a platform whose customers are businesses. Every row belongs to a
 * tenant (the `tenantId` of `security.scope`), so that a row-level policy shows a caller only its tenant's rows, and each concept names the roles that may read and write it. The default export is what
 * `arcactl --module` reads: the party and tenancy models of arca that the platform's tenants come from, and this module beside them.
 *
 * @remarks
 * Not here, and said so in the kit's findings: a foreign key from `tenantId` to the tenant table, and a composite key that would stop a row of one tenant pointing at another's row (governance has no scoped-reference form yet).
 *
 * @module
 */
import {
  annotate,
  type AnyConcept,
  attribute,
  codeList,
  codeOf,
  concept,
  defineModule,
  identifier,
  instant,
  moduleOf,
  relationship,
  text,
  vocabularies,
} from "@intellectual-frontiers/data/governance";
import { partyDomain } from "@intellectual-frontiers/data/models/arca";
import { tenancyModule } from "@intellectual-frontiers/data/models/arca-tenancy";

const { privacy, quality, requirements, security } = vocabularies;
const spec = "0071-uat-kit";
const cites = (...frs: readonly string[]) => annotate(requirements.cites, frs.map((f) => `${spec} ${f}`));
const confidential = annotate(security.classification, "confidential");
const tenantScope = annotate(security.scope, { name: "tenant" });

/** The roles of the application: they own nothing and see the data only through the views, in their tenant's scope. */
export const roles = { reader: "crm_reader", writer: "crm_writer", support: "crm_support" } as const;

const list = (name: string, definition: string, codes: Readonly<Record<string, string>>) =>
  codeList(name, {
    definition,
    codes: Object.fromEntries(Object.entries(codes).map(([code, d]) => [code, { label: code.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()), definition: d }])),
    annotations: [annotate(quality.openness, "closed"), cites("FR-002")],
  });

/** Where a customer account is. */
export const accountStatus = list("accountStatus", "Where a customer account is in its life", { active: "In good standing", onHold: "Paused, usually for payment", closed: "Ended" });
/** How urgent a support ticket is. */
export const ticketSeverity = list("ticketSeverity", "How urgent a support ticket is", { low: "Can wait", normal: "This week", high: "Today", urgent: "Now" });
/** Where a support ticket is. */
export const ticketStatus = list("ticketStatus", "Where a support ticket is", { open: "Not yet answered", waiting: "Waiting for the customer", solved: "Answered", closed: "Finished" });

const tenantColumn = attribute(text(), { definition: "The tenant the row belongs to: what row security filters by", annotations: [tenantScope] });

const access = (read: readonly string[], write: readonly string[]) => annotate(security.access, { read, write });
const everyone = [roles.reader, roles.writer, roles.support];

/** A business that is a customer of one of the platform's tenants. */
export const customerAccount: AnyConcept = concept("customerAccount", {
  definition: "A business that is a customer of a tenant of the platform",
  attributes: {
    accountId: attribute(identifier(), { definition: "What identifies the account" }),
    tenantId: tenantColumn,
    name: attribute(text(), { definition: "The customer's trading name" }),
    status: attribute(codeOf(accountStatus), { definition: "Where the account is in its life" }),
    createdAt: attribute(instant(), { definition: "When the account was made" }),
  },
  identifiedBy: ["accountId"],
  annotations: [confidential, access(everyone, [roles.writer]), cites("FR-002")],
});

/** A person at a customer account. */
export const contact: AnyConcept = concept("contact", {
  definition: "A person at a customer account whom the tenant deals with",
  attributes: {
    contactId: attribute(identifier(), { definition: "What identifies the contact" }),
    tenantId: tenantColumn,
    fullName: attribute(text(), { definition: "The person's name", annotations: [annotate(privacy.personal, { category: "Name", purposes: ["address the person by name"] })] }),
    email: attribute(text(), { definition: "Where the person is written to", annotations: [annotate(privacy.personal, { category: "EmailAddress", purposes: ["write to the person"] })] }),
  },
  identifiedBy: ["contactId"],
  relationships: { account: relationship(() => customerAccount, { cardinality: "one", definition: "The account the person is at" }) },
  annotations: [confidential, access(everyone, [roles.writer]), cites("FR-002")],
});

/** A request for help from a customer account. */
export const supportTicket: AnyConcept = concept("supportTicket", {
  definition: "A request for help from a customer account",
  attributes: {
    ticketId: attribute(identifier(), { definition: "What identifies the ticket" }),
    tenantId: tenantColumn,
    subject: attribute(text(), { definition: "What the request is about" }),
    severity: attribute(codeOf(ticketSeverity), { definition: "How urgent it is" }),
    status: attribute(codeOf(ticketStatus), { definition: "Where it is" }),
    openedAt: attribute(instant(), { definition: "When it was opened" }),
  },
  identifiedBy: ["ticketId"],
  relationships: { account: relationship(() => customerAccount, { cardinality: "one", definition: "The account that asked" }) },
  annotations: [confidential, access(everyone, [roles.writer, roles.support]), cites("FR-002")],
});

/** A line of the conversation on a ticket. */
export const ticketComment: AnyConcept = concept("ticketComment", {
  definition: "A line of the conversation on a support ticket",
  attributes: {
    commentId: attribute(identifier(), { definition: "What identifies the comment" }),
    tenantId: tenantColumn,
    author: attribute(text(), { definition: "Who wrote it, as the application knows them" }),
    body: attribute(text(), { definition: "What it says" }),
    writtenAt: attribute(instant(), { definition: "When it was written" }),
  },
  identifiedBy: ["commentId"],
  relationships: { ticket: relationship(() => supportTicket, { cardinality: "one", definition: "The ticket it is on" }) },
  annotations: [confidential, access(everyone, [roles.writer, roles.support]), cites("FR-002")],
});

/** The example application as a module. */
export const crmModule = defineModule({
  name: "uatCrm",
  definition: "The customer relationship data of a business-to-business product: accounts, contacts and support tickets, each in a tenant",
  requires: [],
  concepts: [customerAccount, contact, supportTicket, ticketComment],
  codeLists: [accountStatus, ticketSeverity, ticketStatus],
});

if (partyDomain.kind === "err") throw new Error("the party model is not valid");

/** What `arcactl --module` reads: the party and tenancy models (where the platform's tenants are), and the example application. */
export default [moduleOf(partyDomain.value), tenancyModule, crmModule];
