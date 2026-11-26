// Spec: 0002-crosswalks FR-001, FR-003
/**
 * The proposals from the 61 criteria of SOC 2 to the controls of NIST SP 800-53 (release 5.2.0), as proposals for a person to decide (0002-crosswalks FR-001, FR-003). No published mapping was read, so each row is our reading of what the criterion and the controls ask; the privacy criteria are
 * mapped to the privacy controls of SP 800-53 (the PT and PM families) as we understand them.
 *
 * @module
 */

/** One proposal: what it starts from, why the two sides are said to meet, and the controls it reaches. */
export type Proposal = { readonly from: string; readonly basis: string; readonly to: readonly string[] };

const p = (from: string, basis: string, to: readonly string[]): Proposal => ({ from, basis, to });

/** The proposals of SOC 2 to SP 800-53: one for each of the 61 criteria. */
export const SOC2_PROPOSALS: readonly Proposal[] = [
  p("CC1.1", "the criterion asks for values and a way to see that people follow them, which the security program, rules of behavior and personnel sanctions give", ["PM-1", "PL-4", "PS-8"]),
  p("CC1.2", "the criterion asks for oversight of internal control by a body apart from management, which the program plan, the security official and the risk strategy give", ["PM-1", "PM-2", "PM-9"]),
  p("CC1.3", "the criterion asks for structure, authority and ownership, which the security official, position descriptions and the system security plan give", ["PM-2", "PS-9", "PL-2"]),
  p("CC1.4", "the criterion asks for competent people, which training, position risk and screening give", ["AT-2", "AT-3", "PS-2", "PS-3"]),
  p("CC1.5", "the criterion asks that people answer for their part in control, which sanctions, rules of behavior and role-based training give", ["PS-8", "PL-4", "AT-3"]),
  p("CC2.1", "the criterion asks for good information to run controls, which continuous monitoring, the inventory and the management of information give", ["CA-7", "PM-5", "SI-12"]),
  p("CC2.2", "the criterion asks for internal communication of control duties, which awareness, rules of behavior, incident reporting and contacts give", ["AT-2", "PL-4", "IR-6", "PM-15"]),
  p("CC2.3", "the criterion asks for communication with outside parties, which incident reporting, contacts with groups and the plan give", ["IR-6", "PM-15", "PL-2"]),
  p("CC3.1", "the criterion asks for clear objectives and risks to them, which the risk management strategy, mission definition and risk policy give", ["PM-9", "PM-11", "RA-1"]),
  p("CC3.2", "the criterion asks that risks to objectives be found and managed, which categorization, risk assessment and the strategy give", ["RA-2", "RA-3", "PM-9"]),
  p("CC3.3", "the criterion asks that fraud and abuse be considered in the risk assessment, which risk assessment and the insider threat program give", ["RA-3", "PM-12"]),
  p("CC3.4", "the criterion asks that changes that alter risk be noticed, which change control, impact analysis and risk assessment give", ["CM-3", "CM-4", "RA-3"]),
  p("CC4.1", "the criterion asks that controls be evaluated, which control assessments and continuous monitoring give", ["CA-2", "CA-7"]),
  p("CC4.2", "the criterion asks that deficiencies be reported and followed, which plans of action and milestones, monitoring and the remediation process give", ["CA-5", "CA-7", "PM-4"]),
  p("CC5.1", "the criterion asks that controls be chosen to bring risk to an accepted level, which the plan, the strategy and security engineering principles give", ["PL-2", "PM-9", "SA-8"]),
  p("CC5.2", "the criterion asks for general controls over technology, which the security architecture, engineering principles and baselines give", ["PL-8", "SA-8", "CM-2"]),
  p("CC5.3", "the criterion asks that controls run through policies and procedures, which the policy controls, the program plan and rules of behavior give", ["PL-1", "PM-1", "PL-4"]),
  p("CC6.1", "the criterion asks for logical access protection, which access enforcement, least privilege, identification, authenticators and protection at rest give", ["AC-3", "AC-6", "IA-2", "IA-5", "SC-28"]),
  p("CC6.2", "the criterion asks that users be registered and authorized before credentials are issued and removed when not justified, which account management, identifier management and authenticators give", ["AC-2", "IA-4", "IA-5"]),
  p("CC6.3", "the criterion asks for roles, least privilege and separation of duties, which account management, access enforcement, separation of duties and least privilege give", ["AC-2", "AC-3", "AC-5", "AC-6"]),
  p("CC6.4", "the criterion asks for control of physical access, which authorizations, access control, monitoring and visitor records give", ["PE-2", "PE-3", "PE-6", "PE-8"]),
  p("CC6.5", "the criterion asks that retired assets be wiped or destroyed, which media sanitization and component disposal give", ["MP-6", "SR-12"]),
  p("CC6.6", "the criterion asks for protection against threats from outside the boundary, which remote access, boundary protection and system monitoring give", ["AC-17", "SC-7", "SI-4"]),
  p("CC6.7", "the criterion asks that information in motion be protected, which media transport, protection in transit, cryptography and flow control give", ["MP-5", "SC-8", "SC-13", "AC-4"]),
  p("CC6.8", "the criterion asks for protection against malicious software, which malicious code protection, least functionality, software restrictions and integrity give", ["CM-7", "CM-11", "SI-3", "SI-7"]),
  p("CC7.1", "the criterion asks that configurations be baselined and weaknesses found, which configuration settings, vulnerability monitoring and flaw remediation give", ["CM-2", "CM-6", "RA-5", "SI-2"]),
  p("CC7.2", "the criterion asks that systems be watched for anomalies, which event logging, review of records, continuous monitoring and system monitoring give", ["AU-2", "AU-6", "CA-7", "SI-4"]),
  p("CC7.3", "the criterion asks that events be judged to be incidents or not, which incident handling, monitoring of incidents and record review give", ["IR-4", "IR-5", "AU-6"]),
  p("CC7.4", "the criterion asks for a response to incidents, which handling, reporting and the response plan give", ["IR-4", "IR-6", "IR-8"]),
  p("CC7.5", "the criterion asks for recovery from incidents, which system recovery, the contingency plan and incident handling give", ["CP-10", "IR-4", "CP-2"]),
  p("CC8.1", "the criterion asks that changes be assessed, approved and tested, which change control, impact analysis, access restrictions for change and the developer configuration management give", ["CM-3", "CM-4", "CM-5", "SA-10"]),
  p("CC9.1", "the criterion asks that business disruption be planned for, which the contingency plan, risk assessment and the strategy give", ["CP-2", "RA-3", "PM-9"]),
  p("CC9.2", "the criterion asks that vendors and partners be assessed and held to obligations, which external services, supply chain controls and external personnel give", ["SA-9", "SR-2", "SR-3", "SR-6", "PS-7"]),
  p("A1.1", "the criterion asks that capacity be watched and added, which the contingency plan and denial of service protection give", ["CP-2", "SC-5"]),
  p("A1.2", "the criterion asks for protection of availability, which alternate storage and sites, backup, power and environmental controls give", ["CP-6", "CP-7", "CP-9", "PE-11", "PE-13", "PE-14"]),
  p("A1.3", "the criterion asks that recovery be tested, which contingency plan testing and system recovery give", ["CP-4", "CP-10"]),
  p("C1.1", "the criterion asks that confidential information be identified and protected, which access enforcement, media marking, protection in transit and at rest give", ["AC-3", "MP-3", "SC-8", "SC-28"]),
  p("C1.2", "the criterion asks that confidential information be disposed of, which media sanitization and information management and retention give", ["MP-6", "SI-12"]),
  p("PI1.1", "the criterion asks that processing specifications be stated, which acquisition and engineering principles give", ["SA-4", "SA-8"]),
  p("PI1.2", "the criterion asks that inputs be checked, which information input validation gives", ["SI-10"]),
  p("PI1.3", "the criterion asks that processing be checked, which integrity verification and input validation give", ["SI-7", "SI-10"]),
  p("PI1.4", "the criterion asks that outputs be checked, which output handling and retention and information output filtering give", ["SI-12", "SI-15"]),
  p("PI1.5", "the criterion asks that stored data be protected and whole, which backup, protection at rest and integrity give", ["CP-9", "SC-28", "SI-7"]),
  p("P1.1", "the criterion asks for a privacy notice, which privacy notice and the dissemination of privacy program information give", ["PT-5", "PM-20"]),
  p("P2.1", "the criterion asks for choice and consent, which authority to process and consent give", ["PT-2", "PT-4"]),
  p("P3.1", "the criterion asks for limited collection, which authority to process and personally identifiable information processing conditions give", ["PT-2", "PT-3"]),
  p("P3.2", "the criterion asks for explicit consent for sensitive data, which authority to process and consent give", ["PT-2", "PT-4"]),
  p("P4.1", "the criterion asks for limited use, which processing purposes and authority give", ["PT-3", "PT-2"]),
  p("P4.2", "the criterion asks for retention only as long as needed, which information management and retention and authority give", ["SI-12", "PT-2"]),
  p("P4.3", "the criterion asks for disposal of personal information, which media sanitization and retention give", ["MP-6", "SI-12"]),
  p("P5.1", "the criterion asks that people can reach their information, which the privacy program and its notice give", ["PM-20", "PT-5"]),
  p("P5.2", "the criterion asks that people can correct their information, which the privacy program and data quality operations give", ["PM-20", "SI-18"]),
  p("P6.1", "the criterion asks that disclosure be with consent or by law, which authority, processing purposes and information sharing give", ["PT-2", "PT-3", "AC-21"]),
  p("P6.2", "the criterion asks for a record of authorized disclosures, which accounting of disclosures and event logging give", ["PM-21", "AU-2"]),
  p("P6.3", "the criterion asks for a record of unauthorized disclosures, which accounting of disclosures and incident reporting give", ["PM-21", "IR-6"]),
  p("P6.4", "the criterion asks that third parties be bound to protect information, which external services, external personnel and processing purposes give", ["SA-9", "PS-7", "PT-3"]),
  p("P6.5", "the criterion asks that third parties report incidents, which incident reporting and notification agreements give", ["IR-6", "SR-8"]),
  p("P6.6", "the criterion asks for notice of breaches, which incident reporting and the response plan give", ["IR-6", "IR-8"]),
  p("P6.7", "the criterion asks for an accounting of disclosures, which accounting of disclosures and information sharing give", ["PM-21", "AC-21"]),
  p("P7.1", "the criterion asks that personal information be accurate and relevant, which data quality operations and authority give", ["SI-18", "PT-2"]),
  p("P8.1", "the criterion asks that privacy compliance be monitored and complaints handled, which the privacy program, monitoring and data quality give", ["PM-18", "CA-7", "SI-18"]),
];
