// Spec: 0002-hipaa-package FR-001, FR-005, FR-006
/**
 * The standards and implementation specifications of the HIPAA Security Rule, 45 CFR 164.308, 164.310, 164.312, 164.314 and 164.316, in the words of Intellectual Frontiers (0002-hipaa-package FR-001, FR-005, FR-006). They were read at the source on 2026-11-26. An
 * identifier is the section and the paragraphs in lower case joined by dots (`164.308.a.1.ii.A` is 164.308(a)(1)(ii)(A)), so that it is a token in OSCAL. A statement starts with what the entry is: a standard, or a required or an addressable implementation specification, as the regulation
 * and its Appendix A mark it. The family is the section.
 *
 * @example
 * ```ts
 * import { ENTRIES } from "./security-rule.ts";
 * ENTRIES.filter((e) => e.statement.startsWith("Standard.")).length; // 22
 * ```
 *
 * @module
 */
import { KINDS } from "./source.ts";

/** One entry of the framework: its identifier, a title, what it says in our words, and the section it belongs to. */
export type Entry = { readonly id: string; readonly title: string; readonly statement: string; readonly family: string };

type Kind = keyof typeof KINDS;
type Row = readonly [id: string, kind: Kind, title: string, statement: string];
const of = (family: string, rows: readonly Row[]): readonly Entry[] => rows.map(([id, kind, title, statement]) => ({ id, title, statement: `${KINDS[kind]} ${statement}`, family }));

/** The five sections, in order. */
export const SECTIONS = [
  ["164.308", "Administrative safeguards"],
  ["164.310", "Physical safeguards"],
  ["164.312", "Technical safeguards"],
  ["164.314", "Organizational requirements"],
  ["164.316", "Policies and procedures and documentation requirements"],
] as const;

/** The 22 standards and 43 implementation specifications of the five sections, in the order of the regulation. */
export const ENTRIES: readonly Entry[] = [
  ...of("164.308", [
    ["164.308.a.1", "standard", "Security management process", "Put in place policies and procedures to prevent, detect, contain and correct security violations."],
    ["164.308.a.1.ii.A", "required", "Risk analysis", "Assess accurately and thoroughly the risks to the confidentiality, integrity and availability of the electronic health information the organization holds."],
    ["164.308.a.1.ii.B", "required", "Risk management", "Put in place security measures that bring those risks down to a reasonable and appropriate level."],
    ["164.308.a.1.ii.C", "required", "Sanction policy", "Apply sanctions to workforce members who do not follow the organization's security policies."],
    ["164.308.a.1.ii.D", "required", "Information system activity review", "Review records of system activity, such as audit logs, access reports and incident reports, regularly."],
    ["164.308.a.2", "standard", "Assigned security responsibility", "Name the one security official responsible for developing and carrying out the security policies and procedures."],
    ["164.308.a.3", "standard", "Workforce security", "Make sure that workforce members who should have access to electronic health information have it, and that those who should not are kept from it."],
    ["164.308.a.3.ii.A", "addressable", "Authorization and supervision", "Have procedures for authorizing or supervising workforce members who work with the information or in places where it may be."],
    ["164.308.a.3.ii.B", "addressable", "Workforce clearance procedure", "Have procedures to decide that a workforce member's access is appropriate."],
    ["164.308.a.3.ii.C", "addressable", "Termination procedures", "Have procedures to end access when employment or an arrangement ends or when the determination of the previous item says so."],
    ["164.308.a.4", "standard", "Information access management", "Have policies and procedures for authorizing access to electronic health information that fit the privacy rule's limits."],
    ["164.308.a.4.ii.A", "required", "Isolating clearinghouse functions", "Where a clearinghouse is part of a larger organization, protect its information from unauthorized access by the rest of it."],
    ["164.308.a.4.ii.B", "addressable", "Access authorization", "Have policies and procedures for granting access to the information, for example to a workstation, a transaction, a program or a process."],
    ["164.308.a.4.ii.C", "addressable", "Access establishment and modification", "Have policies and procedures that set up, document, review and change a user's right of access."],
    ["164.308.a.5", "standard", "Security awareness and training", "Run a security awareness and training programme for all workforce members, management included."],
    ["164.308.a.5.ii.A", "addressable", "Security reminders", "Send periodic security updates."],
    ["164.308.a.5.ii.B", "addressable", "Protection from malicious software", "Have procedures to guard against, detect and report malicious software."],
    ["164.308.a.5.ii.C", "addressable", "Log-in monitoring", "Have procedures to watch log-in attempts and report discrepancies."],
    ["164.308.a.5.ii.D", "addressable", "Password management", "Have procedures for creating, changing and safeguarding passwords."],
    ["164.308.a.6", "standard", "Security incident procedures", "Have policies and procedures to deal with security incidents."],
    ["164.308.a.6.ii", "required", "Response and reporting", "Identify and respond to suspected or known incidents, reduce their harmful effects where practicable, and document the incidents and their outcomes."],
    ["164.308.a.7", "standard", "Contingency plan", "Have policies and procedures to respond to an emergency or other event, such as a fire, a system failure or a natural disaster, that damages systems holding electronic health information."],
    ["164.308.a.7.ii.A", "required", "Data backup plan", "Create and keep retrievable exact copies of electronic health information."],
    ["164.308.a.7.ii.B", "required", "Disaster recovery plan", "Have procedures to restore any loss of data."],
    ["164.308.a.7.ii.C", "required", "Emergency mode operation plan", "Have procedures to keep critical business processes running, and the information protected, while operating in emergency mode."],
    ["164.308.a.7.ii.D", "addressable", "Testing and revision procedures", "Test and revise the contingency plans periodically."],
    ["164.308.a.7.ii.E", "addressable", "Applications and data criticality analysis", "Assess how critical each application and body of data is to the other parts of the contingency plan."],
    ["164.308.a.8", "standard", "Evaluation", "Evaluate periodically, technically and otherwise, how well the policies and procedures meet the rule's requirements, and again when the environment or operations change in a way that affects the security of the information."],
    ["164.308.b.1", "standard", "Business associate contracts and other arrangements", "Allow a business associate to create, receive, maintain or transmit electronic health information for the organization only on satisfactory assurances that it will protect it."],
    ["164.308.b.3", "required", "Written contract or other arrangement", "Document the assurances in a written contract or other arrangement that meets the requirements of the organizational section."],
  ]),
  ...of("164.310", [
    ["164.310.a.1", "standard", "Facility access controls", "Limit physical access to the electronic information systems and the facilities they are in, while allowing the access that is authorized."],
    ["164.310.a.2.i", "addressable", "Contingency operations", "Have procedures that allow facility access to support restoring lost data under the disaster recovery plan and the emergency mode operation plan."],
    ["164.310.a.2.ii", "addressable", "Facility security plan", "Have policies and procedures to safeguard the facility and the equipment in it from unauthorized physical access, tampering and theft."],
    ["164.310.a.2.iii", "addressable", "Access control and validation procedures", "Have procedures to control and validate a person's access to facilities based on role or function, including visitors and software testing."],
    ["164.310.a.2.iv", "addressable", "Maintenance records", "Document repairs and modifications to the physical parts of a facility that relate to security, such as hardware, walls, doors and locks."],
    ["164.310.b", "standard", "Workstation use", "Have policies and procedures that say the proper functions of a workstation, how they are done and the surroundings of a workstation that can reach electronic health information."],
    ["164.310.c", "standard", "Workstation security", "Put physical safeguards on all workstations that reach electronic health information so that only authorized users reach them."],
    ["164.310.d.1", "standard", "Device and media controls", "Have policies and procedures for the movement of hardware and electronic media that hold electronic health information into, out of and within the facility."],
    ["164.310.d.2.i", "required", "Disposal", "Have policies and procedures for the final disposition of the information and of the hardware or media it was on."],
    ["164.310.d.2.ii", "required", "Media re-use", "Have procedures to remove the information from media before they are used again."],
    ["164.310.d.2.iii", "addressable", "Accountability", "Keep a record of the movements of hardware and media and of who is responsible for them."],
    ["164.310.d.2.iv", "addressable", "Data backup and storage", "Create a retrievable exact copy of the information, when needed, before moving equipment."],
  ]),
  ...of("164.312", [
    ["164.312.a.1", "standard", "Access control", "Have technical policies and procedures that allow only authorized persons or software programs to reach systems that hold electronic health information."],
    ["164.312.a.2.i", "required", "Unique user identification", "Give each user a unique name or number for identifying and tracking identity."],
    ["164.312.a.2.ii", "required", "Emergency access procedure", "Have procedures for getting the information in an emergency."],
    ["164.312.a.2.iii", "addressable", "Automatic logoff", "End an electronic session after a set time of inactivity."],
    ["164.312.a.2.iv", "addressable", "Encryption and decryption", "Have a mechanism to encrypt and decrypt the information."],
    ["164.312.b", "standard", "Audit controls", "Have hardware, software or procedures that record and examine activity in systems that hold or use electronic health information."],
    ["164.312.c.1", "standard", "Integrity", "Have policies and procedures to protect the information from improper change or destruction."],
    ["164.312.c.2", "addressable", "Mechanism to authenticate the information", "Have electronic mechanisms to confirm that the information has not been altered or destroyed in an unauthorized way."],
    ["164.312.d", "standard", "Person or entity authentication", "Have procedures to verify that a person or entity seeking access is the one claimed."],
    ["164.312.e.1", "standard", "Transmission security", "Have technical measures to guard against unauthorized access to information sent over an electronic network."],
    ["164.312.e.2.i", "addressable", "Integrity controls", "Have measures so that information sent electronically is not improperly changed without detection until it is disposed of."],
    ["164.312.e.2.ii", "addressable", "Encryption in transmission", "Encrypt the information whenever that is appropriate."],
  ]),
  ...of("164.314", [
    ["164.314.a", "standard", "Business associate contracts or other arrangements", "A contract or other arrangement with a business associate meets the requirements of the items below."],
    ["164.314.a.2.i", "required", "Business associate contracts", "The contract has the business associate comply with the security rule, make sure its subcontractors that handle the information agree to the same, and report to the organization any security incident it learns of, including breaches of unsecured information."],
    ["164.314.a.2.ii", "required", "Other arrangements", "Where the organization and the business associate are both governmental entities, a memorandum of understanding or the law can give the same assurances."],
    ["164.314.a.2.iii", "required", "Business associate contracts with subcontractors", "A business associate's contract with its subcontractor meets the same requirements."],
    ["164.314.b", "standard", "Requirements for group health plans", "A group health plan may give electronic health information to the plan sponsor only if the plan documents say what the sponsor will do to protect it."],
    ["164.314.b.2", "required", "Plan documents", "The plan documents require the sponsor to implement safeguards for the information, keep the plan's information separate from the rest of its business, make its agents agree to the same safeguards and report security incidents to the plan."],
  ]),
  ...of("164.316", [
    ["164.316.a", "standard", "Policies and procedures", "Implement reasonable and appropriate policies and procedures to comply with the standards and implementation specifications, taking changes in the rule into account."],
    ["164.316.b.1", "standard", "Documentation", "Keep the policies and procedures in written form, which may be electronic, and keep a written record of any action, activity or assessment the rule requires to be documented."],
    ["164.316.b.2.i", "required", "Time limit", "Keep the documentation for six years from when it was created or last in effect, whichever is later."],
    ["164.316.b.2.ii", "required", "Availability", "Make the documentation available to the people responsible for the procedures it describes."],
    ["164.316.b.2.iii", "required", "Updates", "Review the documentation periodically and update it in response to environmental or operational changes that affect the security of the information."],
  ]),
];
