// Spec: 0002-iso27001-package FR-001, FR-006
/**
 * The clauses 4 to 10 of ISO/IEC 27001:2022, the requirements of the management system, in the words of Intellectual Frontiers (0002-iso27001-package FR-001, FR-006). The standard was not read (see `source.ts`): the numbering and the order are those the standard
 * is known by, the titles and statements are our own and short. An identifier is `C` and the number of the clause, so that it is a token in OSCAL.
 *
 * @example
 * ```ts
 * import { CLAUSES } from "./clauses.ts";
 * CLAUSES.some((c) => c.id === "C6.1.3"); // true
 * ```
 *
 * @module
 */

/** One entry of a framework: its identifier, a title, what it says in our words, and the group it belongs to. */
export type Entry = { readonly id: string; readonly title: string; readonly statement: string; readonly family: string };

type Row = readonly [id: string, title: string, statement: string];
const of = (family: string, rows: readonly Row[]): readonly Entry[] => rows.map(([id, title, statement]) => ({ id, title, statement, family }));

/** The groups of the clauses, in order: the number of the clause and its name. */
export const CLAUSE_GROUPS = [
  ["C4", "Context of the organization"],
  ["C5", "Leadership"],
  ["C6", "Planning"],
  ["C7", "Support"],
  ["C8", "Operation"],
  ["C9", "Performance evaluation"],
  ["C10", "Improvement"],
] as const;

/** The clauses 4 to 10 and their sub-clauses, in the order of the standard. */
export const CLAUSES: readonly Entry[] = [
  ...of("C4", [
    ["C4.1", "Know the organization and its context", "The organization works out the outside and inside matters that affect whether its information security management system can reach its intended results."],
    ["C4.2", "Know the interested parties", "The organization names the parties with a stake in its information security and the requirements of theirs that it takes on, including legal and contractual ones."],
    ["C4.3", "Set the scope", "The organization decides and records what the management system covers, using the context, the parties' requirements and the interfaces and dependencies on what is outside the scope."],
    ["C4.4", "Run a management system", "The organization establishes, runs, maintains and keeps improving the management system and the processes it needs."],
  ]),
  ...of("C5", [
    ["C5.1", "Leadership and commitment", "Top management shows commitment: it ties security to the direction of the business, supplies resources, communicates why it matters, backs the people who carry it out and promotes improvement."],
    ["C5.2", "Information security policy", "Top management sets a policy that fits the purpose of the organization, gives a frame for objectives, commits to meet the requirements and to improve, and makes the policy known and available."],
    ["C5.3", "Roles, responsibilities and authorities", "Top management assigns and communicates who is responsible and has authority for the conformity of the system and for reporting on its performance."],
  ]),
  ...of("C6", [
    ["C6.1.1", "Actions on risks and opportunities, in general", "The organization plans actions for the risks and opportunities that bear on the intended results of the system, on preventing unwanted effects and on improvement, and plans how to integrate and evaluate them."],
    ["C6.1.2", "Information security risk assessment", "The organization defines and applies a risk assessment process with criteria, repeatable and comparable results, identification of risks to confidentiality, integrity and availability, owners, and analysis and evaluation against the criteria, and keeps what it records."],
    ["C6.1.3", "Information security risk treatment", "The organization defines and applies a treatment process: it picks treatment options, determines the controls it needs, compares them with the reference list of controls so that none is overlooked, states which are applied and why with the justification for leaving others out, writes a treatment plan and has the owners accept it and the residual risk."],
    ["C6.2", "Objectives and plans to reach them", "The organization sets information security objectives at the relevant functions and levels that are measurable where possible and consistent with the policy, and plans what will be done, with what, by whom, by when and how the result is evaluated."],
    ["C6.3", "Planning of changes", "When the organization finds the need to change the management system, it makes the change in a planned way."],
  ]),
  ...of("C7", [
    ["C7.1", "Resources", "The organization decides and provides the resources the system needs to be established, run, maintained and improved."],
    ["C7.2", "Competence", "The organization decides what competence the people who affect its security performance need, makes sure they have it through education, training or experience, acts where it is lacking and keeps evidence."],
    ["C7.3", "Awareness", "People who work under the organization's control know the policy, how they contribute to the system and what follows if they do not conform."],
    ["C7.4", "Communication", "The organization decides what to communicate about the system, when, to whom, how and who does it, inside and outside."],
    ["C7.5.1", "Documented information, in general", "The system includes the documented information the standard requires and what the organization decides it needs."],
    ["C7.5.2", "Creating and updating documented information", "Documents are identified and described, in a suitable format and medium, and reviewed and approved for suitability and adequacy."],
    ["C7.5.3", "Control of documented information", "Documented information is available where and when it is needed and protected from loss of confidentiality, improper use and loss of integrity, with distribution, access, storage, change control and retention handled, and with documents of external origin that the system needs controlled too."],
  ]),
  ...of("C8", [
    ["C8.1", "Operational planning and control", "The organization plans, implements and controls the processes it needs to meet its requirements and carry out its plans, keeps documented information that the processes ran as planned, controls planned changes and reviews the consequences of unintended ones, and makes sure outsourced processes and products are controlled."],
    ["C8.2", "Risk assessment in operation", "The organization carries out information security risk assessments at planned intervals or when significant changes are proposed or occur, and keeps the results."],
    ["C8.3", "Risk treatment in operation", "The organization implements its risk treatment plan and keeps the results of the treatment."],
  ]),
  ...of("C9", [
    ["C9.1", "Monitoring, measurement, analysis and evaluation", "The organization decides what needs to be monitored and measured, by which methods so that results are valid, when, who does it and when the results are analysed and evaluated, and evaluates the performance and the effectiveness of the system."],
    ["C9.2.1", "Internal audit, in general", "The organization audits the system at planned intervals to see whether it conforms to its own requirements and to the standard and is effectively implemented and maintained."],
    ["C9.2.2", "The internal audit programme", "The organization plans, establishes, implements and maintains an audit programme with frequency, methods, responsibilities and reporting, defines the criteria and scope of each audit, chooses auditors who are objective and impartial, reports results to the relevant management and keeps evidence."],
    ["C9.3.1", "Management review, in general", "Top management reviews the system at planned intervals to confirm that it stays suitable, adequate and effective."],
    ["C9.3.2", "Inputs to the management review", "The review considers the status of earlier actions, changes in external and internal matters, feedback on performance (nonconformities, monitoring and measurement results, audit results and the fulfilment of objectives), feedback from interested parties, results of risk assessment and the status of the treatment plan, and opportunities for improvement."],
    ["C9.3.3", "Results of the management review", "The outputs of the review include decisions on opportunities for improvement and on any need to change the system, and are kept as documented information."],
  ]),
  ...of("C10", [
    ["C10.1", "Continual improvement", "The organization keeps improving the suitability, adequacy and effectiveness of the management system."],
    ["C10.2", "Nonconformity and corrective action", "When a nonconformity occurs the organization reacts and, where it applies, takes action to control and correct it and to deal with the consequences, decides whether to remove the causes so that it does not recur, carries out and reviews the action taken, changes the system if needed, and keeps evidence."],
  ]),
];
