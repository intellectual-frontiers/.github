// Spec: 0002-iso27001-package FR-001, FR-006
/**
 * The 93 controls of Annex A of ISO/IEC 27001:2022, in the four themes of ISO/IEC 27002:2022, in the words of Intellectual Frontiers (0002-iso27001-package FR-001, FR-006). The standards were not read (see `source.ts`): the numbers and the order are those the controls
 * are known by, the titles and statements are our own understanding and short. An identifier is `A.` and the number of the control, so that it is a token in OSCAL. The themes are the family: `organizational` (37 controls), `people` (8), `physical` (14) and
 * `technological` (34).
 *
 * @example
 * ```ts
 * import { CONTROLS } from "./annex.ts";
 * CONTROLS.length; // 93
 * ```
 *
 * @module
 */
import type { Entry } from "./clauses.ts";

type Row = readonly [id: string, title: string, statement: string];
const of = (family: string, rows: readonly Row[]): readonly Entry[] => rows.map(([id, title, statement]) => ({ id, title, statement, family }));

/** The 93 controls, in the order of the annex. */
export const CONTROLS: readonly Entry[] = [
  ...of("organizational", [
    ["A.5.1", "Policies for information security", "Management defines and approves a security policy and topic-specific policies, publishes them to staff and relevant parties and reviews them at planned intervals and when things change."],
    ["A.5.2", "Roles and responsibilities", "Security roles and responsibilities are defined and allocated to fit the organization's needs."],
    ["A.5.3", "Segregation of duties", "Conflicting duties and areas of responsibility are kept apart so that no one person can misuse or bypass a process alone."],
    ["A.5.4", "Management responsibilities", "Management requires all personnel to apply security according to the policies and procedures."],
    ["A.5.5", "Contact with authorities", "The organization keeps contact with the authorities relevant to security, such as regulators and law enforcement."],
    ["A.5.6", "Contact with special interest groups", "The organization keeps contact with security forums and professional associations."],
    ["A.5.7", "Threat intelligence", "Information about threats is collected and analysed to produce intelligence the organization can act on."],
    ["A.5.8", "Security in project management", "Security is part of every project, whatever its kind."],
    ["A.5.9", "Inventory of information and assets", "An inventory of information and the assets associated with it, with their owners, is made and kept current."],
    ["A.5.10", "Acceptable use of information and assets", "Rules for the acceptable use and handling of information and assets are set, documented and applied."],
    ["A.5.11", "Return of assets", "Personnel and other parties return the assets they hold when their employment, contract or agreement changes or ends."],
    ["A.5.12", "Classification of information", "Information is classified by what it needs in confidentiality, integrity and availability and by what interested parties require."],
    ["A.5.13", "Labelling of information", "Information is labelled according to the classification scheme in use."],
    ["A.5.14", "Information transfer", "Rules, procedures or agreements protect information in every kind of transfer, inside the organization and to others."],
    ["A.5.15", "Access control", "Rules to control physical and logical access to information and assets are set and applied from business and security requirements."],
    ["A.5.16", "Identity management", "The whole life cycle of identities is managed."],
    ["A.5.17", "Authentication information", "The allocation and handling of authentication information is controlled by a process that includes advising people how to handle it."],
    ["A.5.18", "Access rights", "Rights of access to information and assets are provided, reviewed, changed and removed according to the access control rules."],
    ["A.5.19", "Security in supplier relationships", "The organization sets and applies processes to manage the security risks of using suppliers' products and services."],
    ["A.5.20", "Security in supplier agreements", "Security requirements are set and agreed with each supplier according to the kind of relationship."],
    ["A.5.21", "Security in the supply chain of information and communication technology", "The organization manages the security risks in the supply chain of products and services of information and communication technology."],
    ["A.5.22", "Monitoring and change of supplier services", "The organization regularly monitors, reviews and evaluates changes in suppliers' security practices and service delivery."],
    ["A.5.23", "Security for the use of cloud services", "Acquisition, use, management and exit from cloud services follow the organization's security requirements."],
    ["A.5.24", "Planning and preparing for incident management", "The organization plans and prepares for incidents by defining, establishing and communicating a process, roles and responsibilities."],
    ["A.5.25", "Assessing and deciding on events", "The organization assesses security events and decides whether they are incidents."],
    ["A.5.26", "Responding to incidents", "Incidents are responded to according to the documented procedures."],
    ["A.5.27", "Learning from incidents", "Knowledge gained from incidents is used to strengthen and improve the controls."],
    ["A.5.28", "Collecting evidence", "The organization sets and applies procedures to identify, collect, acquire and preserve evidence related to security events."],
    ["A.5.29", "Security during disruption", "The organization plans how to keep security at an appropriate level during a disruption."],
    ["A.5.30", "Readiness of information and communication technology for continuity", "Readiness is planned, implemented, maintained and tested against business continuity objectives and the requirements for the technology."],
    ["A.5.31", "Legal, statutory, regulatory and contractual requirements", "The requirements that bear on security, and the way the organization meets them, are identified, documented and kept up to date."],
    ["A.5.32", "Intellectual property rights", "The organization implements procedures to protect intellectual property rights."],
    ["A.5.33", "Protection of records", "Records are protected from loss, destruction, falsification, unauthorized access and release."],
    ["A.5.34", "Privacy and protection of personal information", "The organization identifies and meets the requirements on the preservation of privacy and the protection of personal information under the law and contracts."],
    ["A.5.35", "Independent review of information security", "The organization's approach to managing security and its implementation is reviewed independently at planned intervals and when significant changes occur."],
    ["A.5.36", "Compliance with policies, rules and standards", "Compliance with the organization's policies, topic-specific policies, rules and standards is regularly reviewed."],
    ["A.5.37", "Documented operating procedures", "Operating procedures are documented and made available to the personnel who need them."],
  ]),
  ...of("people", [
    ["A.6.1", "Screening", "Background checks on candidates are carried out before they join and on an ongoing basis, in proportion to the law, the business needs, the classification of information and the risks."],
    ["A.6.2", "Terms and conditions of employment", "Employment agreements state the personnel's and the organization's security responsibilities."],
    ["A.6.3", "Awareness, education and training", "Personnel and relevant parties get suitable awareness, education and training and regular updates of the policies and procedures relevant to their role."],
    ["A.6.4", "Disciplinary process", "A disciplinary process is formalized and communicated to act against personnel who commit a security policy violation."],
    ["A.6.5", "Responsibilities after termination or change", "Security responsibilities and duties that remain valid after termination or change of employment are defined, enforced and communicated."],
    ["A.6.6", "Confidentiality or non-disclosure agreements", "Agreements that reflect the organization's needs to protect information are identified, documented, reviewed and signed."],
    ["A.6.7", "Remote working", "Security measures are in place when personnel work remotely to protect information accessed, processed or stored outside the premises."],
    ["A.6.8", "Reporting of security events", "The organization provides a mechanism for personnel to report observed or suspected security events promptly through appropriate channels."],
  ]),
  ...of("physical", [
    ["A.7.1", "Physical security perimeters", "Perimeters are defined and used to protect areas that hold information and assets."],
    ["A.7.2", "Physical entry", "Secure areas are protected by entry controls and access points."],
    ["A.7.3", "Securing offices, rooms and facilities", "Physical security for offices, rooms and facilities is designed and implemented."],
    ["A.7.4", "Physical security monitoring", "Premises are continuously monitored for unauthorized physical access."],
    ["A.7.5", "Protecting against physical and environmental threats", "Protection against physical and environmental threats, such as natural disasters and deliberate or accidental ones, is designed and implemented."],
    ["A.7.6", "Working in secure areas", "Security measures for working in secure areas are designed and implemented."],
    ["A.7.7", "Clear desk and clear screen", "Rules for a clear desk for papers and removable media and a clear screen for information processing facilities are defined and enforced."],
    ["A.7.8", "Equipment siting and protection", "Equipment is sited securely and protected."],
    ["A.7.9", "Security of assets off premises", "Off-site assets are protected."],
    ["A.7.10", "Storage media", "Storage media are managed through their life cycle of acquisition, use, transportation and disposal in line with the classification and handling rules."],
    ["A.7.11", "Supporting utilities", "Information processing facilities are protected from power failures and other disruptions caused by failures in supporting utilities."],
    ["A.7.12", "Cabling security", "Cables carrying power, data or supporting services are protected from interception, interference or damage."],
    ["A.7.13", "Equipment maintenance", "Equipment is maintained correctly so that information stays available, whole and confidential."],
    ["A.7.14", "Secure disposal or re-use of equipment", "Items of equipment that hold storage media are checked so that sensitive data and licensed software are removed or securely overwritten before disposal or re-use."],
  ]),
  ...of("technological", [
    ["A.8.1", "User endpoint devices", "Information stored on, processed by or accessible through user endpoint devices is protected."],
    ["A.8.2", "Privileged access rights", "The allocation and use of privileged access rights is restricted and managed."],
    ["A.8.3", "Restriction of access to information", "Access to information and other associated assets is restricted according to the access control policy."],
    ["A.8.4", "Access to source code", "Read and write access to source code, development tools and software libraries is appropriately managed."],
    ["A.8.5", "Secure authentication", "Secure authentication technologies and procedures are implemented according to access restrictions and the access control policy."],
    ["A.8.6", "Capacity management", "The use of resources is monitored and adjusted in line with current and expected capacity requirements."],
    ["A.8.7", "Protection against malware", "Protection against malware is implemented and supported by appropriate user awareness."],
    ["A.8.8", "Management of technical vulnerabilities", "Information about technical vulnerabilities of systems in use is obtained, the organization's exposure is evaluated and appropriate measures are taken."],
    ["A.8.9", "Configuration management", "Configurations, including security configurations, of hardware, software, services and networks are established, documented, implemented, monitored and reviewed."],
    ["A.8.10", "Deletion of information", "Information stored in systems, devices or any other storage media is deleted when no longer required."],
    ["A.8.11", "Data masking", "Data masking is used in accordance with the access control policy and other related policies and business requirements, taking legislation into consideration."],
    ["A.8.12", "Prevention of data leakage", "Measures to prevent data leakage are applied to systems, networks and any other devices that process, store or transmit sensitive information."],
    ["A.8.13", "Backup of information", "Backup copies of information, software and systems are maintained and regularly tested in line with the agreed backup policy."],
    ["A.8.14", "Redundancy of information processing facilities", "Information processing facilities are implemented with enough redundancy to meet availability requirements."],
    ["A.8.15", "Logging", "Logs that record activities, exceptions, faults and other relevant events are produced, stored, protected and analysed."],
    ["A.8.16", "Monitoring activities", "Networks, systems and applications are monitored for anomalous behaviour and appropriate action is taken to evaluate potential incidents."],
    ["A.8.17", "Clock synchronization", "The clocks of information processing systems used by the organization are synchronized to approved time sources."],
    ["A.8.18", "Use of privileged utility programs", "The use of utility programs that can override system and application controls is restricted and tightly controlled."],
    ["A.8.19", "Installation of software on operational systems", "Procedures and measures are implemented to manage the installation of software on operational systems securely."],
    ["A.8.20", "Security of networks", "Networks and network devices are secured, managed and controlled to protect information in systems and applications."],
    ["A.8.21", "Security of network services", "Security mechanisms, service levels and service requirements of network services are identified, implemented and monitored."],
    ["A.8.22", "Segregation of networks", "Groups of information services, users and information systems are segregated in the organization's networks."],
    ["A.8.23", "Web filtering", "Access to external websites is managed to reduce exposure to malicious content."],
    ["A.8.24", "Use of cryptography", "Rules for the effective use of cryptography, including cryptographic key management, are defined and implemented."],
    ["A.8.25", "Secure development life cycle", "Rules for the secure development of software and systems are established and applied."],
    ["A.8.26", "Application security requirements", "Security requirements are identified, specified and approved when developing or acquiring applications."],
    ["A.8.27", "Secure system architecture and engineering principles", "Principles for engineering secure systems are established, documented, maintained and applied to any development activities."],
    ["A.8.28", "Secure coding", "Secure coding principles are applied to software development."],
    ["A.8.29", "Security testing in development and acceptance", "Security testing processes are defined and implemented in the development life cycle."],
    ["A.8.30", "Outsourced development", "The organization directs, monitors and reviews the activities related to outsourced system development."],
    ["A.8.31", "Separation of development, test and production environments", "Development, testing and production environments are separated and secured."],
    ["A.8.32", "Change management", "Changes to information processing facilities and information systems follow change management procedures."],
    ["A.8.33", "Test information", "Test information is appropriately selected, protected and managed."],
    ["A.8.34", "Protection of systems during audit testing", "Audit tests and other assurance activities involving assessment of operational systems are planned and agreed between the tester and the appropriate management."],
  ]),
];
