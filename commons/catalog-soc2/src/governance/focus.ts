// Spec: 0003-soc2-focus FR-001, FR-002, FR-004
/**
 * What an organization shows for each criterion of SOC 2, in the words of Intellectual Frontiers (0003-soc2-focus FR-001, FR-002, FR-004). The AICPA's Trust Services Criteria carry points of focus under each criterion; those are the AICPA's copyright and are not carried, and they were not read.
 * This list has the same shape (several matters under each criterion) and is our own: each matter is a thing an assessor can ask to see, written from our understanding of what the criterion is about. It is NOT the AICPA's points of focus, it is not a reading of them, and a person who holds the AICPA's
 * publication decides which of its points of focus a matter answers and which it does not.
 *
 * @example
 * ```ts
 * import { FOCUS } from "./focus.ts";
 * FOCUS.some((f) => f.id === "CC6.1-1"); // true
 * ```
 *
 * @module
 */
import { CRITERIA, type Criterion } from "./criteria.ts";

/** The matters to show for each criterion, in order: the identifier of the criterion and its matters. */
const MATTERS: Readonly<Record<string, readonly string[]>> = {
  "CC1.1": ["A written code of conduct or set of values exists, and people acknowledge it.", "Departures from the values are noticed and dealt with, and leadership is seen to apply the same rules to itself."],
  "CC1.2": ["The oversight body has members who are free of day-to-day management and has stated what it oversees.", "The oversight body meets, reviews the state of internal control and records what it asked for."],
  "CC1.3": ["Reporting lines, roles and authority for security are written down and kept current.", "Each security objective and control has a named owner who knows they own it."],
  "CC1.4": ["Roles state the skills they need, and hiring and training follow that.", "The organization plans for succession and for the skills it will need next."],
  "CC1.5": ["Performance of staff is judged against their part in control, with consequences when they fall short.", "Pressure to meet targets is balanced so that it does not reward cutting corners."],
  "CC2.1": ["The organization knows which information its controls depend on and checks that it is complete and right.", "Information is made available to the people who run controls when they need it."],
  "CC2.2": ["Staff are told the policies and their duties, and can ask questions and raise concerns without penalty.", "Changes to responsibilities and to the system are communicated to those affected."],
  "CC2.3": ["Customers and partners are told what the organization commits to, and how to report problems or incidents.", "Messages from outside are collected and reach the people who must act on them."],
  "CC3.1": ["Objectives are written, measurable where possible and tied to the risks they imply.", "Objectives are reviewed when the business or its environment changes."],
  "CC3.2": ["A risk assessment is done at a stated interval across the whole entity, with owners for each risk.", "Each risk has a decision on how it is handled and the decision is recorded."],
  "CC3.3": ["Ways in which fraud, abuse or misuse could occur are considered in the risk assessment.", "Incentives, pressures and opportunities that could lead to fraud are looked at."],
  "CC3.4": ["Changes in the business, the technology, the law and the leadership are watched for their effect on risk.", "The risk assessment is revisited when such a change happens."],
  "CC4.1": ["Controls are tested on a plan, by people who do not run them where that is practical.", "The scope and frequency of the testing follow the risk of what is tested."],
  "CC4.2": ["Deficiencies are logged with an owner and a date.", "Leadership and the oversight body are told of the serious ones, and the fixes are followed to the end."],
  "CC5.1": ["Controls are chosen to bring each assessed risk to an accepted level, and the choice is traceable.", "Separation of duties is considered in how controls are built."],
  "CC5.2": ["The technology the controls rely on is identified and its general controls are chosen.", "Controls over access, change and operation of technology are in place and automated where sensible."],
  "CC5.3": ["Policies exist for the areas of risk, are approved and are reviewed on a schedule.", "Procedures say who does what, and the people who run them have the competence and the time."],
  "CC6.1": ["Systems and data that matter are inventoried, and access to each is controlled by an enforced rule.", "Authentication is required, and the strength of it is set by what is protected."],
  "CC6.2": ["A new user is registered and authorized by someone who may do so before access is given.", "Access is reviewed and removed when a person leaves, changes role or no longer needs it."],
  "CC6.3": ["Access is given by role with the least needed, and sensitive duties are split between people.", "Changes to access are approved, recorded and periodically reviewed."],
  "CC6.4": ["Access to the places that hold systems and data is limited to those authorized and the access is logged.", "Visitors and physical access rights are managed and reviewed."],
  "CC6.5": ["Assets that held data are wiped or destroyed so the data cannot be read, and this is recorded.", "The organization knows when an asset is retired and who handled it."],
  "CC6.6": ["The system's boundary is protected against threats from outside, with controls on what may enter and leave.", "Remote and external access is limited, authenticated and monitored."],
  "CC6.7": ["Information moved, sent or received is protected, for example by encryption in transit.", "Who may move data out, and by which means, is restricted and checked."],
  "CC6.8": ["Software and devices are protected against malicious code, and the protection is kept current.", "Unauthorized or unapproved software is prevented or noticed."],
  "CC7.1": ["Configurations are baselined and changes against the baseline are detected.", "Vulnerabilities are scanned for on a schedule and the results are acted on by risk."],
  "CC7.2": ["Systems and networks are monitored for unusual activity, with logs kept and reviewed.", "Alerts reach a person who is expected to look at them and who records what they decided."],
  "CC7.3": ["Events are judged against a stated test of what counts as an incident, and the judgement is recorded.", "The people who judge events have the information and the authority to do so."],
  "CC7.4": ["An incident response plan names roles, steps and contacts, and is tested.", "Incidents are contained, remedied and communicated, and what was learnt changes the controls."],
  "CC7.5": ["Plans exist to recover from incidents and are exercised.", "After an incident the organization restores service and records what changed."],
  "CC8.1": ["Changes are requested, assessed, approved, tested and recorded before they reach production.", "Emergency changes follow a defined path and are reviewed afterwards."],
  "CC9.1": ["The organization has assessed which business disruptions matter and how each would be handled.", "Insurance or other means of transferring risk are considered where they fit."],
  "CC9.2": ["Vendors and partners are assessed for risk before they are used and on a schedule after.", "Obligations of vendors are in contract and their performance and reports are reviewed."],
  "A1.1": ["Capacity of the systems is watched and compared with what demand is expected to be.", "Capacity is added or reduced before a shortfall causes a failure."],
  "A1.2": ["Protections against environmental threats, power and similar loss are in place and maintained.", "Backups and the means to recover are made on a schedule and kept safe."],
  "A1.3": ["Recovery plans are tested on a schedule and the results are recorded.", "Gaps found in a test are fixed and the plan is changed."],
  "C1.1": ["Confidential information is identified and kept apart from other information.", "Access to it and its protection in storage and transit follow its confidentiality needs."],
  "C1.2": ["Confidential information is deleted or destroyed at the end of its need, with proof that it was.", "Requests to destroy it are tracked to completion."],
  "PI1.1": ["The organization states what the processing is meant to do and what makes its output correct.", "Definitions of the data and of the outputs are kept current."],
  "PI1.2": ["Inputs are checked for completeness and validity as they arrive.", "Rejected inputs are logged and dealt with."],
  "PI1.3": ["Processing is checked to make sure it is complete, accurate and on time.", "Errors in processing are found and corrected, and the cause is looked at."],
  "PI1.4": ["Outputs are checked to be complete and right before they are released.", "Outputs go only to those intended."],
  "PI1.5": ["Stored data is protected from change and loss, and is checked to be whole.", "Changes to stored data leave a record."],
  "P1.1": ["A notice of privacy practices is given to the people whose information is held.", "The notice is kept current and tells people what is collected, why, and who gets it."],
  "P2.1": ["People are given choices about the collection and use of their information, and their consent is recorded where it is needed.", "A person's choice is honoured in later use."],
  "P3.1": ["Only the personal information the stated purposes need is collected.", "The sources and methods of collection are known."],
  "P3.2": ["Sensitive information is collected only with the person's explicit consent.", "The consent is recorded and can be withdrawn."],
  "P4.1": ["Personal information is used only for the purposes stated.", "A new use is checked against the notice and the consent first."],
  "P4.2": ["Personal information is kept no longer than its purposes and the law need.", "Retention periods are set and applied."],
  "P4.3": ["Personal information is disposed of securely at the end of its retention.", "Disposal is recorded."],
  "P5.1": ["People can ask for the personal information held about them and can have it.", "Requests are authenticated, answered in time, and refusals are explained."],
  "P5.2": ["People can ask to correct or update their information, and the changes are made.", "Those who got the information before are told where the correction matters."],
  "P6.1": ["Information is disclosed to third parties only where the person has agreed or the law requires it.", "The purposes of the disclosure match what the person was told."],
  "P6.2": ["Authorized disclosures are recorded.", "The record is kept for as long as it is needed to answer a request."],
  "P6.3": ["Disclosures that were not authorized are recorded and followed up.", "The organization learns from them."],
  "P6.4": ["Third parties who get personal information agree in writing to protect it as the organization has promised.", "The organization checks that they do."],
  "P6.5": ["Third parties must tell the organization of incidents that touch the information it gave them.", "The organization acts on such reports."],
  "P6.6": ["The organization has a process to tell the people and the authorities concerned of a breach in the time required.", "The process is practised."],
  "P6.7": ["The organization can give a person an account of the disclosures of their information.", "The account is complete for the period asked."],
  "P7.1": ["Personal information is kept accurate, complete and relevant for the purposes it is used for.", "The organization checks it at points where errors enter."],
  "P8.1": ["Complaints and questions about privacy are received, handled and answered.", "Compliance with the privacy commitments is monitored and what is found is fixed."],
};

/** The matters, one entry for each, as `<criterion>-<n>` with the criterion as family. */
export const FOCUS: readonly Criterion[] = CRITERIA.flatMap((c) => (MATTERS[c.id] ?? []).map((m, i) => ({ id: `${c.id}-${i + 1}`, title: `${c.title}, matter ${i + 1}`, statement: m, family: c.id })));
