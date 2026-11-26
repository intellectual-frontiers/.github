// Spec: 0002-zero-trust-package FR-001, FR-006
/**
 * The goals of OMB memorandum M-22-09 for each of the five pillars, in our words (0002-zero-trust-package FR-001, FR-006). The memorandum was read at the source on 2026-11-26 (the passage for each pillar, kept in definitions.md of 0047-zero-trust, section 4);
 * its list of actions for agencies is not carried. The identifiers are those of the pillars of the maturity model (`ID`, `DV`, `NW`, `AW`, `DT`), which the memorandum cites and which CISA aligned version 2.0 to (CISA ZTMM 2.0, page 5).
 *
 * @example
 * ```ts
 * import { GOALS } from "./omb.ts";
 * GOALS.map((g) => g.id).join(" "); // "ID DV NW AW DT"
 * ```
 *
 * @module
 */
import type { Entry } from "./nist.ts";

/** The goal of each pillar, which the memorandum asks federal civilian agencies to meet by the end of fiscal year 2024. */
export const GOALS: readonly Entry[] = [
  ["ID", "Identity", "Staff use identities managed by the enterprise to reach the applications of their work, and phishing-resistant multi-factor authentication protects them from sophisticated online attacks; agencies manage identity centrally, apply strong multi-factor authentication throughout and take at least one device-level signal into account when they authorize a user."],
  ["DV", "Devices", "The agency has a complete inventory of every device it operates and authorizes for government use and can prevent, detect and respond to incidents on them; its assets are inventoried through the continuous diagnostics and mitigation program and its endpoint detection and response tools meet its requirements."],
  ["NW", "Networks", "All DNS requests and HTTP traffic in the environment are encrypted, and the agency has begun to plan how to break its perimeter into isolated environments."],
  ["AW", "Applications and workloads", "Every application is treated as connected to the internet, is tested rigorously and is open to external reports of vulnerabilities."],
  ["DT", "Data", "The agency follows a path to protections that rest on thorough categorization of its data, uses cloud security services that monitor access to sensitive data and logs and shares information across the enterprise."],
].map(([id, title, statement]) => ({ id: id as string, title: title as string, statement: statement as string, family: "goal" }));
