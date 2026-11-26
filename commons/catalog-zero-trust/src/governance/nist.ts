// Spec: 0002-zero-trust-package FR-001, FR-006
/**
 * The seven tenets and the eight sources of input of NIST SP 800-207 in the words of Intellectual Frontiers (0002-zero-trust-package FR-001, FR-006). The tenets are in section 2.1 of the publication and the sources of input are in section 3.1 (the policy
 * engine's inputs); both were read at the source on 2026-11-26. The statements are a reading, not a quotation. A tenet asks for a decision on evidence, never for a score (0047-zero-trust FR-020).
 *
 * @example
 * ```ts
 * import { TENETS } from "./nist.ts";
 * TENETS.length; // 7
 * ```
 *
 * @module
 */

/** One entry of a framework: its identifier, a title, what it says in our words, and the group it belongs to. */
export type Entry = { readonly id: string; readonly title: string; readonly statement: string; readonly family: string };

type Row = readonly [id: string, title: string, statement: string];
const of = (family: string, rows: readonly Row[]): readonly Entry[] => rows.map(([id, title, statement]) => ({ id, title, statement, family }));

/** The seven tenets, `T1` to `T7`, in the order of the publication. */
export const TENETS: readonly Entry[] = of("tenet", [
  ["T1", "Everything that holds data or serves is a resource", "Every data source and every computing service is a resource: small devices that send data, software run by others, systems that command machines and, where the organization chooses, personally owned devices that reach its resources."],
  ["T2", "Every communication is secured, wherever it comes from", "Communication is protected in the same way whether it starts inside the organization's network or outside it; being on the inside earns nothing, and each communication keeps its content private, whole and tied to an authenticated source."],
  ["T3", "Access is granted for one resource and one session", "A requester is evaluated before it may reach one resource, for one session, with the least privilege the task needs; a grant for one resource is not a grant for another and does not outlast the session."],
  ["T4", "Access is decided by a dynamic policy", "The decision uses the observable state of the requester's identity, of the application and of the asset it comes from, and may add behavior and the environment (the time, the place, reported attacks); the more sensitive the resource, the stricter the rule."],
  ["T5", "The posture of every asset is watched and measured", "The organization monitors and measures the integrity and security posture of every asset it owns or is associated with, and no asset is trusted for what it is; a vulnerable, subverted or unmanaged asset may be treated differently, up to refusing all of its connections."],
  ["T6", "Authentication and authorization are dynamic and enforced before access", "Identity, credential and access management and asset management are in place, and the cycle of granting access, assessing threats, adapting and checking again runs continuously, with a new authentication when an event the policy names occurs."],
  ["T7", "The organization collects what it can and uses it to improve", "As much as possible is collected about the state of assets, the network and the communications, and the collection is used to improve the policy and its enforcement."],
]);

/** The eight sources of input of the policy engine, `S1` to `S8`, in the order of the publication. */
export const INPUTS: readonly Entry[] = of("input", [
  ["S1", "Continuous diagnostics and mitigation", "A system that reports the state of the organization's assets: what each runs, what it lacks and what is wrong with it, so that the decision can use the asset's posture."],
  ["S2", "Compliance rules", "The rules of the regimes the organization answers to (the law, the contract, the standard), as the policy must keep them, so that a decision does not permit what a regime forbids."],
  ["S3", "Threat intelligence", "Feeds and services that tell the engine about new attacks and weaknesses, so that a decision can refuse what is under attack even when its own signals look sound."],
  ["S4", "Activity logs", "Records of what happened on the network and on systems (flows, access, changes), so that a decision can use recent behavior and an investigation can follow a path."],
  ["S5", "Data access policy", "The rules about who and what may reach which data, written by the owners of the data, which the engine takes as the starting point of a decision about a resource."],
  ["S6", "Public key infrastructure", "The system that issues and checks the certificates of people, services and devices, so that a decision can rely on who a certificate says its subject is."],
  ["S7", "Identity management", "The system that holds the subjects, their attributes and their roles, so that a decision knows who is asking and what they may be given."],
  ["S8", "Security information and event management", "The system that gathers the security events of the whole estate and finds patterns in them, so that a decision can use an alert as a signal."],
]);
