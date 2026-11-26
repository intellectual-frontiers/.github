// Spec: 0002-iso27001-package FR-001, FR-006
/**
 * The four themes of ISO/IEC 27002:2022 and the values of its five attributes, in the words of Intellectual Frontiers (0002-iso27001-package FR-001, FR-006). The standard was not read (see `source.ts`): the names of the themes and of the attribute values are those
 * it is known by, and what each means is our own understanding. The attribute value of each control is not given: that table is in the text of the standard, which was not read, so a control is not tied to a value here.
 *
 * @example
 * ```ts
 * import { THEMES } from "./themes.ts";
 * THEMES.map((t) => t.id); // ["organizational", "people", "physical", "technological"]
 * ```
 *
 * @module
 */
import type { Entry } from "./clauses.ts";

type Row = readonly [id: string, title: string, statement: string];
const of = (family: string, rows: readonly Row[]): readonly Entry[] => rows.map(([id, title, statement]) => ({ id, title, statement, family }));

/** The four themes of the controls. */
export const THEMES: readonly Entry[] = of("theme", [
  ["organizational", "Organizational controls", "Controls on how the organization governs and runs security: policies, roles, assets, access, suppliers, incidents, continuity and compliance. In Annex A they are the first 37."],
  ["people", "People controls", "Controls on the people who work for or with the organization: screening, terms, awareness, discipline, remote work and reporting. In Annex A they are 8 controls."],
  ["physical", "Physical controls", "Controls on places and equipment: perimeters, entry, monitoring, environmental threats, utilities, cabling, maintenance and disposal. In Annex A they are 14 controls."],
  ["technological", "Technological controls", "Controls on systems and networks: endpoints, privileged access, authentication, malware, vulnerabilities, configuration, logging, network security, cryptography and secure development. In Annex A they are 34 controls."],
]);

/** The values of the five attributes a control may carry, each as a group of its own. */
export const ATTRIBUTES: readonly Entry[] = [
  ...of("control-type", [
    ["preventive", "Preventive", "The control acts before an event, to keep it from happening."],
    ["detective", "Detective", "The control acts when an event happens, to notice it."],
    ["corrective", "Corrective", "The control acts after an event, to limit its effect and restore."],
  ]),
  ...of("information-security-property", [
    ["confidentiality", "Confidentiality", "The control serves keeping information from those who may not see it."],
    ["integrity", "Integrity", "The control serves keeping information accurate and whole."],
    ["availability", "Availability", "The control serves keeping information and services usable when needed."],
  ]),
  ...of("cybersecurity-concept", [
    ["identify", "Identify", "The control helps the organization know its assets, risks and context."],
    ["protect", "Protect", "The control helps put safeguards in place."],
    ["detect", "Detect", "The control helps find events as they happen."],
    ["respond", "Respond", "The control helps act on an event."],
    ["recover", "Recover", "The control helps restore what an event disturbed."],
  ]),
  ...of("operational-capability", [
    ["governance", "Governance", "The capability of setting direction and holding people to it."],
    ["asset-management", "Asset management", "The capability of knowing and looking after assets."],
    ["information-protection", "Information protection", "The capability of protecting information by its kind."],
    ["human-resource-security", "Human resource security", "The capability of managing security across the working life of people."],
    ["physical-security", "Physical security", "The capability of protecting places and equipment."],
    ["system-and-network-security", "System and network security", "The capability of securing systems and the networks that join them."],
    ["application-security", "Application security", "The capability of building and running secure applications."],
    ["secure-configuration", "Secure configuration", "The capability of setting up and keeping systems in a secure state."],
    ["identity-and-access-management", "Identity and access management", "The capability of knowing who and what may reach what."],
    ["threat-and-vulnerability-management", "Threat and vulnerability management", "The capability of finding and acting on threats and weaknesses."],
    ["continuity", "Continuity", "The capability of carrying on through disruption."],
    ["supplier-relationships-security", "Supplier relationships security", "The capability of keeping security across the suppliers the organization depends on."],
    ["legal-and-compliance", "Legal and compliance", "The capability of meeting the rules that apply."],
    ["information-security-event-management", "Information security event management", "The capability of handling events and incidents."],
    ["information-security-assurance", "Information security assurance", "The capability of showing that security works."],
  ]),
  ...of("security-domain", [
    ["governance-and-ecosystem", "Governance and ecosystem", "The domain of security governance and of the relations with others in the ecosystem."],
    ["protection", "Protection", "The domain of safeguards that protect assets."],
    ["defence", "Defence", "The domain of detecting and responding to attacks."],
    ["resilience", "Resilience", "The domain of withstanding and recovering from adverse events."],
  ]),
];
