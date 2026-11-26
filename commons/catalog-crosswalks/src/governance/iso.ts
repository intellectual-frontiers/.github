// Spec: 0002-crosswalks FR-001, FR-003
/**
 * The proposals from the 93 controls of Annex A of ISO/IEC 27001:2022 to the controls of NIST SP 800-53 (release 5.2.0), as proposals for a person to decide (0002-crosswalks FR-001, FR-003). No published mapping was read, and neither standard was read, so each row is our reading of what the
 * control and the controls ask, from the names of the two sides. The clauses 4 to 10 of the management system are not mapped.
 *
 * @module
 */
import type { Proposal } from "./soc2.ts";

const p = (from: string, to: readonly string[]): Proposal => ({ from, basis: `the control and the ${to.length === 1 ? "control" : "controls"} are about the same matter, as the names of the two sides say`, to });

/** The proposals of Annex A to SP 800-53: one for each of the 93 controls. */
export const ISO_PROPOSALS: readonly Proposal[] = [
  p("A.5.1", ["PL-1", "PM-1"]), p("A.5.2", ["PM-2", "PS-9"]), p("A.5.3", ["AC-5"]), p("A.5.4", ["PL-4", "PS-8"]), p("A.5.5", ["IR-6", "PM-15"]), p("A.5.6", ["PM-15", "SI-5"]), p("A.5.7", ["PM-16", "RA-10", "SI-5"]),
  p("A.5.8", ["SA-3", "SA-8"]), p("A.5.9", ["CM-8", "PM-5"]), p("A.5.10", ["PL-4", "AC-20"]), p("A.5.11", ["PS-4", "PS-5"]), p("A.5.12", ["RA-2"]), p("A.5.13", ["MP-3", "AC-16"]), p("A.5.14", ["AC-4", "AC-21", "SC-8"]),
  p("A.5.15", ["AC-1", "AC-3"]), p("A.5.16", ["AC-2", "IA-4"]), p("A.5.17", ["IA-5"]), p("A.5.18", ["AC-2", "AC-3", "AC-6"]), p("A.5.19", ["SA-9", "SR-2", "SR-3"]), p("A.5.20", ["PS-7", "SA-4", "SA-9"]), p("A.5.21", ["SR-2", "SR-3", "SR-5"]),
  p("A.5.22", ["SA-9", "SR-6"]), p("A.5.23", ["SA-9", "SA-4"]), p("A.5.24", ["IR-1", "IR-2", "IR-8"]), p("A.5.25", ["IR-4", "IR-5"]), p("A.5.26", ["IR-4", "IR-6"]), p("A.5.27", ["IR-4", "IR-8"]), p("A.5.28", ["AU-10", "IR-4"]),
  p("A.5.29", ["CP-2", "CP-13"]), p("A.5.30", ["CP-2", "CP-4", "CP-10"]), p("A.5.31", ["PL-1", "CA-1"]), p("A.5.32", ["CM-10"]), p("A.5.33", ["AU-9", "SI-12"]), p("A.5.34", ["PT-2", "PT-3", "PM-18"]), p("A.5.35", ["CA-2", "CA-7"]),
  p("A.5.36", ["CA-2", "CA-7"]), p("A.5.37", ["SA-5", "CM-9"]),
  p("A.6.1", ["PS-3"]), p("A.6.2", ["PS-6", "PS-7"]), p("A.6.3", ["AT-2", "AT-3", "AT-4"]), p("A.6.4", ["PS-8"]), p("A.6.5", ["PS-4", "PS-5"]), p("A.6.6", ["PS-6"]), p("A.6.7", ["AC-17", "AC-19", "PE-17"]), p("A.6.8", ["IR-6"]),
  p("A.7.1", ["PE-2", "PE-3"]), p("A.7.2", ["PE-2", "PE-3", "PE-8"]), p("A.7.3", ["PE-3", "PE-5"]), p("A.7.4", ["PE-6", "PE-3"]), p("A.7.5", ["PE-9", "PE-10", "PE-13", "PE-14", "PE-15", "PE-18"]), p("A.7.6", ["PE-2", "PE-3"]),
  p("A.7.7", ["AC-11", "MP-2"]), p("A.7.8", ["PE-18", "PE-5"]), p("A.7.9", ["PE-17", "MP-5"]), p("A.7.10", ["MP-2", "MP-4", "MP-5", "MP-6", "MP-7"]), p("A.7.11", ["PE-9", "PE-10", "PE-11"]), p("A.7.12", ["PE-4", "PE-9"]),
  p("A.7.13", ["MA-2", "MA-3", "MA-6"]), p("A.7.14", ["MP-6", "SR-12"]),
  p("A.8.1", ["AC-19", "SC-28"]), p("A.8.2", ["AC-6", "AC-2"]), p("A.8.3", ["AC-3", "AC-6"]), p("A.8.4", ["AC-3", "CM-5"]), p("A.8.5", ["IA-2", "IA-5", "AC-7", "AC-8"]), p("A.8.6", ["AU-4", "SC-5", "CP-2"]), p("A.8.7", ["SI-3", "SI-8"]),
  p("A.8.8", ["RA-5", "SI-2", "SA-11"]), p("A.8.9", ["CM-2", "CM-6", "CM-9"]), p("A.8.10", ["MP-6", "SI-12"]), p("A.8.11", ["SI-19"]), p("A.8.12", ["SC-7", "AC-4", "SI-4"]), p("A.8.13", ["CP-9", "CP-10"]),
  p("A.8.14", ["CP-2", "CP-6", "CP-7"]), p("A.8.15", ["AU-2", "AU-3", "AU-6", "AU-9", "AU-11", "AU-12"]), p("A.8.16", ["AU-6", "SI-4", "CA-7"]), p("A.8.17", ["AU-8"]), p("A.8.18", ["AC-6", "CM-7"]), p("A.8.19", ["CM-5", "CM-7", "CM-11"]),
  p("A.8.20", ["SC-7", "AC-4"]), p("A.8.21", ["SA-9", "SC-7"]), p("A.8.22", ["SC-7", "AC-4"]), p("A.8.23", ["SC-7", "SI-4"]), p("A.8.24", ["SC-12", "SC-13", "SC-17"]), p("A.8.25", ["SA-3", "SA-8", "SA-15"]), p("A.8.26", ["SA-4", "SA-8"]),
  p("A.8.27", ["SA-8", "SA-17"]), p("A.8.28", ["SA-8", "SA-11", "SI-10"]), p("A.8.29", ["SA-11", "CA-8"]), p("A.8.30", ["SA-4", "SA-9", "SA-10"]), p("A.8.31", ["SA-3", "CM-4"]), p("A.8.32", ["CM-3", "CM-4", "CM-5"]), p("A.8.33", ["SA-3", "SA-11"]),
  p("A.8.34", ["CA-2", "AU-9"]),
];
