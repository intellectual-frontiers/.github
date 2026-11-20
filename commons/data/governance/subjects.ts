// Spec: 0028-modules FR-008
/**
 * Subjects (commons data 0028-modules FR-008): what a module of models applies to, so that the models can be grouped for a reader and for an agent. A subject is data: an id, a title, a sentence on what its models apply to and a
 * place in the order. A module names its subject (`subject` of `defineModule`), and a module that names none takes the subject the library gives its name here, where it has one.
 *
 * @example
 * ```ts
 * subjectOf("identityPki")?.title; // "Identity and access"
 * ```
 *
 * @module
 */

/** What a module of models applies to. */
export interface Subject {
  /** Its id: lower-case words joined by hyphens. */
  readonly id: string;
  /** Its title, as a reader sees it. */
  readonly title: string;
  /** What the models of the subject apply to, in a sentence. */
  readonly about: string;
  /** Its place among the subjects: lower first. */
  readonly order: number;
}

/** The subjects of this library's own models. */
export const SUBJECTS: readonly Subject[] = Object.freeze([
  { id: "parties", title: "Parties and tenancy", about: "Who a business deals with (people, organizations, how they relate and are reached) and who the customers of a platform are.", order: 1 },
  { id: "identity", title: "Identity and access", about: "Who may do what: principals, sessions, roles, policies, relationships, keys and certificates, machines, devices, delegation and agents.", order: 2 },
  { id: "pipelines", title: "Pipelines and data flow", about: "How data moves through a pipeline and the proof that nothing was lost on the way.", order: 3 },
  { id: "meaning", title: "Meaning and contracts", about: "What a value and its absence mean, and the promises a dataset makes: contracts, periods, controls and consent.", order: 4 },
  { id: "operations", title: "Operations and proof", about: "How a data platform is run and shown to be run: what it waits on, its releases and signals, its drills, calculations and lineage.", order: 5 },
  { id: "project", title: "Project and issues", about: "The open work of a library as data: its issues, their goals and what would close them.", order: 6 },
]);

/** The subject a module of this library's own takes where it names none, by its name. */
const OF_MODULE: Readonly<Record<string, string>> = Object.freeze({
  arcaParty: "parties",
  arcaTenancy: "parties",
  identity: "identity",
  identityAccess: "identity",
  identityAbac: "identity",
  identityRebac: "identity",
  identityPki: "identity",
  identityMachine: "identity",
  identityDevice: "identity",
  identityDelegation: "identity",
  identityAgent: "identity",
  flow: "pipelines",
  meaning: "meaning",
  contract: "meaning",
  operations: "operations",
  proof: "operations",
  issues: "project",
});

/** A subject by its id, or none. */
export const subject = (id: string): Subject | undefined => SUBJECTS.find((s) => s.id === id);

/** The subject of a module, by the id it names or else by its name: none where it has neither. */
export const subjectOf = (moduleName: string, named?: string): Subject | undefined => subject(named ?? OF_MODULE[moduleName] ?? "");
