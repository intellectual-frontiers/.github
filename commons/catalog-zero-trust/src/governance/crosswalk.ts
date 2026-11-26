// Spec: 0002-zero-trust-package FR-005
/**
 * The crosswalk from the tenets and the functions of zero trust to the controls of NIST SP 800-53 (release 5.2.0) and of SP 800-171 (revision 3), as proposals for a person to decide (0002-zero-trust-package FR-005, 0047-zero-trust FR-023). The published mapping of the
 * example architecture to SP 800-53 (the supplemental material of NIST SP 1800-35) has not been read, so no row is taken from a source: each row is our reading of what the two sides ask, written as `intersects-with` at the lowest strength, and each carries
 * the words `person-decision-required` and the reason. A consumer MUST NOT count a row that still carries them. Whether a pair holds, and how strongly, is the decision of a person who has read both controls, recorded by removing the words and giving the strength.
 *
 * @example
 * ```ts
 * import { PROPOSALS } from "./crosswalk.ts";
 * PROPOSALS.some((p) => p.from === "cisa-ztmm:ID.AU"); // true
 * ```
 *
 * @module
 */

/** A control to be reached, in a catalog package of this repository. */
export type Side = { readonly framework: string; readonly version: string };

/** The two frameworks the proposals reach. */
export const TARGETS = {
  sp80053: { framework: "nist-800-53", version: "5.2.0" },
  sp800171: { framework: "nist-800-171", version: "3" },
} as const satisfies Readonly<Record<string, Side>>;

/** The framework of each side that the proposals start from: the identifier of a source is `<framework>:<control>`, and the framework is one of this package. */
export const STARTS = { "nist-sp800-207": "2020", "cisa-ztmm": "2.0" } as const;

/** One proposal: what it starts from, why the two sides are said to meet, and the controls of each target it reaches. */
export type Proposal = { readonly from: string; readonly basis: string; readonly sp80053: readonly string[]; readonly sp800171: readonly string[] };

const p = (from: string, basis: string, sp80053: readonly string[], sp800171: readonly string[]): Proposal => ({ from, basis, sp80053, sp800171 });

/** The proposals: 7 tenets, 22 functions and 3 cross-cutting capabilities, each with its reason. */
export const PROPOSALS: readonly Proposal[] = [
  p("nist-sp800-207:T1", "the tenet asks that every data source and service be known as a resource, which the inventories of components and systems record", ["CM-8", "PM-5"], ["03.04.10"]),
  p("nist-sp800-207:T2", "the tenet asks that communication be protected wherever it starts, which boundary protection and the protection of data in motion and cryptography give", ["SC-7", "SC-8", "SC-13"], ["03.13.01", "03.13.08", "03.13.11"]),
  p("nist-sp800-207:T3", "the tenet asks for access to one resource for one session with least privilege, which access enforcement, least privilege and session termination give", ["AC-3", "AC-6", "AC-12"], ["03.01.02", "03.01.05", "03.01.11"]),
  p("nist-sp800-207:T4", "the tenet asks that a policy over the attributes of the requester decide, which access enforcement, attribute-based access and access control decisions give", ["AC-3", "AC-16", "AC-24"], ["03.01.02"]),
  p("nist-sp800-207:T5", "the tenet asks that the posture of every asset be measured, which baselines, monitoring and vulnerability scanning give", ["CM-2", "CM-6", "CA-7", "RA-5", "SI-4"], ["03.04.01", "03.11.02", "03.12.03", "03.14.06"]),
  p("nist-sp800-207:T6", "the tenet asks for authentication and authorization before access and for repeating them, which identification, authenticators and account management give", ["AC-2", "IA-2", "IA-3", "IA-5"], ["03.01.01", "03.05.01", "03.05.02", "03.05.03"]),
  p("nist-sp800-207:T7", "the tenet asks that as much as possible be collected about assets and communications and used, which event logging, review of audit records and monitoring give", ["AU-2", "AU-6", "CA-7", "SI-4"], ["03.03.01", "03.03.05", "03.12.03", "03.14.06"]),
  p("cisa-ztmm:ID.AU", "the function asks how strongly an identity proves itself, which identification and authentication of users and the management of authenticators give", ["IA-2", "IA-5"], ["03.05.01", "03.05.03", "03.05.12"]),
  p("cisa-ztmm:ID.IS", "the function asks how identities are held and joined, which identifier management and account management give", ["AC-2", "IA-4"], ["03.01.01", "03.05.05"]),
  p("cisa-ztmm:ID.RA", "the function asks that identity risk be judged and used, which risk assessment and system monitoring give", ["RA-3", "SI-4"], ["03.11.01", "03.14.06"]),
  p("cisa-ztmm:ID.AM", "the function asks how access is given and ended, which account management, access enforcement and least privilege give", ["AC-2", "AC-3", "AC-6"], ["03.01.01", "03.01.02", "03.01.05", "03.01.06"]),
  p("cisa-ztmm:DV.PC", "the function asks that device compliance be seen and enforced, which baselines, configuration settings, change control and flaw remediation give", ["CM-2", "CM-3", "CM-6", "SI-2"], ["03.04.01", "03.04.02", "03.14.01"]),
  p("cisa-ztmm:DV.AS", "the function asks that assets be tracked and supply chain risk managed, which the inventory of components and the supply chain controls give", ["CM-8", "SR-1", "SR-2"], ["03.04.10", "03.17.01", "03.17.02"]),
  p("cisa-ztmm:DV.RA", "the function asks that the device be considered in access, which device identification and the controls on remote and mobile access give", ["AC-17", "AC-19", "IA-3"], ["03.01.12", "03.01.18", "03.05.02"]),
  p("cisa-ztmm:DV.TP", "the function asks for threat protection on devices, which malicious code protection, monitoring and flaw remediation give", ["SI-2", "SI-3", "SI-4"], ["03.14.01", "03.14.02", "03.14.06"]),
  p("cisa-ztmm:NW.SG", "the function asks for the division of the network and for service-specific interconnections, which boundary protection, information flow enforcement and system interconnections give", ["AC-4", "CA-3", "SC-7"], ["03.01.03", "03.12.05", "03.13.01", "03.13.06"]),
  p("cisa-ztmm:NW.TM", "the function asks for traffic managed by the profile of an application, which information flow enforcement and boundary protection give", ["AC-4", "SC-5", "SC-7"], ["03.01.03", "03.13.01"]),
  p("cisa-ztmm:NW.TE", "the function asks for traffic encrypted and its keys kept, which the protection of data in motion, key management and cryptography give", ["SC-8", "SC-12", "SC-13"], ["03.13.08", "03.13.10", "03.13.11"]),
  p("cisa-ztmm:NW.RS", "the function asks that the network meet the availability applications need, which alternate telecommunications and the handling of denial of service give", ["CP-8", "SC-5"], []),
  p("cisa-ztmm:AW.AA", "the function asks how access to an application is authorized, which access enforcement, least privilege and access control decisions give", ["AC-3", "AC-6", "AC-24", "IA-2"], ["03.01.02", "03.01.05", "03.05.01"]),
  p("cisa-ztmm:AW.TP", "the function asks that applications be protected from threats, which malicious code protection, monitoring, input validation and the control of mobile code give", ["SC-18", "SI-3", "SI-4", "SI-10"], ["03.13.13", "03.14.02", "03.14.06"]),
  p("cisa-ztmm:AW.AV", "the function asks how far applications can be reached by authorized users from outside, which remote access, boundary protection and publicly accessible content give", ["AC-17", "AC-22", "SC-7"], ["03.01.12", "03.01.22", "03.13.01"]),
  p("cisa-ztmm:AW.DW", "the function asks how code reaches production, which configuration change control, access restrictions for change and developer controls give", ["CM-3", "CM-5", "SA-8", "SA-10"], ["03.04.03", "03.04.05", "03.16.01"]),
  p("cisa-ztmm:AW.ST", "the function asks that applications be tested for security, which developer testing, vulnerability scanning and security assessment give", ["CA-8", "RA-5", "SA-11"], ["03.11.02", "03.12.01"]),
  p("cisa-ztmm:DT.IN", "the function asks how well the organization knows its data, which the inventory of systems and the location of information give", ["CM-12", "PM-5"], ["03.04.11"]),
  p("cisa-ztmm:DT.CT", "the function asks that data be categorized and labeled, which security categorization, security attributes and media marking give", ["AC-16", "MP-3", "RA-2"], ["03.08.04"]),
  p("cisa-ztmm:DT.AV", "the function asks where data is kept to be available, which backup and the alternate storage site give", ["CP-6", "CP-9"], ["03.08.09"]),
  p("cisa-ztmm:DT.AC", "the function asks how access to data is governed, which access enforcement, information flow enforcement and least privilege give", ["AC-3", "AC-4", "AC-6"], ["03.01.02", "03.01.05", "03.08.02"]),
  p("cisa-ztmm:DT.EN", "the function asks how data is encrypted and its keys protected, which protection at rest, in motion, key management and cryptography give", ["SC-8", "SC-12", "SC-13", "SC-28"], ["03.08.09", "03.13.08", "03.13.10", "03.13.11"]),
  p("cisa-ztmm:VA", "the capability asks for logs and events collected and analyzed, which event logging, review of audit records, monitoring and continuous monitoring give", ["AU-2", "AU-6", "CA-7", "SI-4"], ["03.03.01", "03.03.05", "03.12.03", "03.14.06"]),
  p("cisa-ztmm:AO", "the capability asks for response and orchestration to be automated, which incident handling gives", ["IR-4"], ["03.06.01"]),
  p("cisa-ztmm:GV", "the capability asks that policies be defined and enforced across the enterprise, which policy and procedures and the system security plan give", ["PL-1", "PL-2"], ["03.15.01", "03.15.02"]),
];
