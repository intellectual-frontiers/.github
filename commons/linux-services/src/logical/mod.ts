// Spec: 0001-linux-services-layers FR-001
/**
 * The Logical layer of Linux Services: the profiles parsed, the requirements they make and the plan of a DNS zone.
 *
 * @module
 */
export { parseCertificate, parseMailRelay, parseMcpAccess, parsePostgres } from "./parse.ts";
export { certbotCli, certificateRequirements, issueUnit, mailName, mailRelayRequirements, mainCf, mcpAccessRequirements, mcpAuthorizedKeys, postgresDropIn, postgresRequirements, recipientMap, SECRET_PATHS, senderMap } from "./services.ts";
export { isEmpty, planDns } from "./dns.ts";
export type { DnsPlan, FoundRecord } from "./dns.ts";
