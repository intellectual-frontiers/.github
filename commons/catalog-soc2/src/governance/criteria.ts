// Spec: 0002-soc2-package FR-001, FR-005
/**
 * The criteria of SOC 2 in the words of Intellectual Frontiers (0002-soc2-package FR-001, FR-005). The AICPA's Trust Services Criteria are its copyright, and the package does not carry its text: it carries the identifiers the criteria are known by (`CC6.1`), a title and a statement that each say, in
 * our own words, what the criterion asks an organization to be able to show. The statements are a reading of the criterion, not a quotation and not a substitute for it; an assessment is made against the AICPA's publication.
 *
 * @example
 * ```ts
 * import { CRITERIA } from "./criteria.ts";
 * CRITERIA.length; // 61
 * ```
 *
 * @module
 */

/** One criterion: its identifier, its title, what it asks in our words, and the series it belongs to (`CC6`). */
export type Criterion = { readonly id: string; readonly title: string; readonly statement: string; readonly family: string };

type Row = readonly [id: string, title: string, statement: string];

const rows: readonly Row[] = [
  ["CC1.1", "Integrity and ethics", "Leadership sets and shows the values the organization works by, and has a way to see that people follow them."],
  ["CC1.2", "Independent oversight", "A governing body that is independent of day-to-day management watches over how internal control is designed and whether it works."],
  ["CC1.3", "Structure and authority", "Management has settled who reports to whom, who may decide what, and who answers for which objective, so that security responsibilities have owners."],
  ["CC1.4", "Competent people", "The organization hires, trains and keeps people who can do what their roles need, and plans for the skills it will need next."],
  ["CC1.5", "Accountability", "People are held to account for their part in internal control, with incentives and consequences that fit the objectives and do not push them to cut corners."],
  ["CC2.1", "Useful information", "The organization collects or produces relevant, good-quality information and uses it to run its internal controls."],
  ["CC2.2", "Internal communication", "Staff are told what internal control is for and what their own part in it is, through channels that work in both directions, including a way to raise concerns."],
  ["CC2.3", "External communication", "The organization tells customers, partners and others outside it what they need to know about its commitments and about matters that bear on internal control, and hears from them."],
  ["CC3.1", "Clear objectives", "Objectives are stated clearly enough that the risks to them can be identified and judged."],
  ["CC3.2", "Risk identification", "The organization finds the risks to its objectives across the entity and decides how each is to be managed."],
  ["CC3.3", "Fraud risk", "When assessing risk the organization considers how fraud, by anyone, could affect its objectives."],
  ["CC3.4", "Change and risk", "The organization notices changes that could alter its risks or its internal control, in its environment, its business or its leadership, and assesses them."],
  ["CC4.1", "Evaluating controls", "Controls are checked, continuously or at intervals, to learn whether they are present and working."],
  ["CC4.2", "Reporting deficiencies", "Weaknesses in control are reported in good time to those who must fix them and to leadership, and followed until they are fixed."],
  ["CC5.1", "Control activities", "The organization chooses and builds control activities that bring risks to its objectives down to an acceptable level."],
  ["CC5.2", "Technology controls", "The organization chooses and builds general controls over its technology to help meet its objectives."],
  ["CC5.3", "Policies and procedures", "Control activities are put into effect through written policies that set expectations and procedures that carry them out."],
  ["CC6.1", "Logical access protection", "The systems and information that matter are protected by logical access controls that are designed, put in place and kept up."],
  ["CC6.2", "Access provisioning", "Before credentials are issued, users are registered and authorized, and access is removed when it is no longer justified."],
  ["CC6.3", "Least privilege", "Access to data and assets is granted, changed and removed according to roles, least privilege and separation of duties."],
  ["CC6.4", "Physical access", "Physical access to facilities and protected assets is limited to those authorized, and the limits are enforced."],
  ["CC6.5", "Retiring assets", "Assets that hold protected information are made unreadable or physically destroyed before they are discarded or reused."],
  ["CC6.6", "Outside threats", "The boundary of the system is protected against threats that come from outside it."],
  ["CC6.7", "Information in motion", "The movement, transmission and removal of information is limited to authorized parties, and the information is protected while it moves."],
  ["CC6.8", "Malicious software", "The organization prevents or detects software that is unauthorized or harmful, and acts on it."],
  ["CC7.1", "Detecting weaknesses", "The organization detects changes to configurations and newly found vulnerabilities that could let a threat succeed."],
  ["CC7.2", "Monitoring for anomalies", "Systems and their components are watched for behavior that suggests malicious acts, natural events or mistakes, and what is found is analyzed."],
  ["CC7.3", "Judging events", "Security events are assessed to decide whether they have harmed, or could harm, the organization's objectives, which makes them incidents."],
  ["CC7.4", "Incident response", "Incidents are handled by a defined program of response: contain, remediate, communicate and learn."],
  ["CC7.5", "Recovery from incidents", "The organization restores normal operation after an incident and takes the lessons into its controls."],
  ["CC8.1", "Change management", "Changes to infrastructure, data, software and procedures are authorized, designed, developed, tested, approved and put into effect under control."],
  ["CC9.1", "Business disruption", "The organization identifies the ways its business could be disrupted and chooses how to reduce the risk, including by insurance."],
  ["CC9.2", "Vendors and partners", "The organization assesses and manages the risks that come from its vendors and business partners."],
  ["A1.1", "Capacity", "Processing capacity and use of the system are watched, and capacity is adjusted so that availability commitments can be met."],
  ["A1.2", "Protection of availability", "The organization puts in place the environmental protections, the backups and the recovery infrastructure that availability needs, and looks after them."],
  ["A1.3", "Testing recovery", "The plans for recovering the system are tested, so that it is known whether recovery meets the commitments."],
  ["C1.1", "Confidential information", "Information meant to be confidential is identified and kept protected for as long as the commitments require."],
  ["C1.2", "Disposing of confidential information", "Confidential information is destroyed once it is no longer needed to meet the commitments."],
  ["PI1.1", "Processing specifications", "The organization states what the system's processing must produce, and the definitions that data must meet, and keeps them current and understood."],
  ["PI1.2", "Input checks", "Policies and procedures check that inputs to the system are complete and accurate as the specifications require."],
  ["PI1.3", "Processing checks", "Policies and procedures keep processing complete, valid, accurate and timely, and authorized, as the specifications require."],
  ["PI1.4", "Output checks", "Policies and procedures deliver system output only to the intended recipients, and complete and accurate, as the specifications require."],
  ["PI1.5", "Stored data checks", "Policies and procedures keep stored data complete and accurate for as long as it is held, as the specifications require."],
  ["P1.1", "Privacy notice", "People whose personal information is handled are given a notice of the organization's practices, at the time it is first collected and when it changes."],
  ["P2.1", "Choice and consent", "The organization tells people what choices they have about their personal information and obtains their consent where it is required."],
  ["P3.1", "Limited collection", "Personal information is collected only as far as the objectives stated in the notice need."],
  ["P3.2", "Explicit consent for sensitive data", "Where the information is sensitive, explicit consent is obtained and recorded before it is collected."],
  ["P4.1", "Limited use", "Personal information is used only for the purposes the notice states and the person consented to."],
  ["P4.2", "Retention", "Personal information is kept only as long as the stated purposes and the law need."],
  ["P4.3", "Disposal of personal information", "Personal information that is no longer needed is securely disposed of."],
  ["P5.1", "Access by the person", "People can see the personal information the organization holds about them, subject to stated exceptions."],
  ["P5.2", "Correction", "People can ask for their personal information to be corrected, and the organization acts on valid requests and tells those concerned."],
  ["P6.1", "Disclosure with consent", "Personal information goes to third parties only for the purposes stated and with the person's consent."],
  ["P6.2", "Record of authorized disclosures", "The organization keeps a record of the disclosures of personal information it has authorized."],
  ["P6.3", "Record of unauthorized disclosures", "The organization keeps a record of unauthorized disclosures and of breaches of personal information."],
  ["P6.4", "Third parties' obligations", "Agreements require third parties that handle personal information to meet the organization's privacy commitments, and their compliance is checked."],
  ["P6.5", "Third parties report incidents", "Third parties are bound to tell the organization of breaches and incidents involving personal information so that it can respond."],
  ["P6.6", "Notifying of breaches", "The organization tells those affected, and others as required, of breaches of personal information."],
  ["P6.7", "Accounting of disclosures", "On request the organization can tell a person what personal information it holds about them and to whom it has disclosed it."],
  ["P7.1", "Quality of personal information", "Personal information is kept accurate, complete and relevant for the purposes it is used for."],
  ["P8.1", "Privacy monitoring and enforcement", "The organization handles privacy inquiries, complaints and disputes, and checks that it complies with its privacy commitments."],
];

/** The 61 criteria: the common criteria (security), availability, confidentiality, processing integrity and privacy, in the order of the AICPA's publication. */
export const CRITERIA: readonly Criterion[] = rows.map(([id, title, statement]) => ({ id, title, statement, family: id.slice(0, id.indexOf(".")) }));

/** The criteria that all five categories rely on: a SOC 2 report always covers them (they are the criteria of Security). */
export const COMMON_FAMILIES = ["CC1", "CC2", "CC3", "CC4", "CC5", "CC6", "CC7", "CC8", "CC9"] as const;

/** The category each series of criteria belongs to. */
export const CATEGORY_OF: Readonly<Record<string, "security" | "availability" | "confidentiality" | "processing-integrity" | "privacy">> = {
  CC1: "security", CC2: "security", CC3: "security", CC4: "security", CC5: "security", CC6: "security", CC7: "security", CC8: "security", CC9: "security",
  A1: "availability", C1: "confidentiality", PI1: "processing-integrity",
  P1: "privacy", P2: "privacy", P3: "privacy", P4: "privacy", P5: "privacy", P6: "privacy", P7: "privacy", P8: "privacy",
};
