// Spec: 0002-crosswalks FR-001, FR-003
/**
 * The proposals from the 65 standards and implementation specifications of the HIPAA Security Rule to the controls of NIST SP 800-53 (release 5.2.0), as proposals for a person to decide (0002-crosswalks FR-001, FR-003). The mapping that NIST publishes in SP 800-66 was not read, so each row
 * is our reading of what the paragraph of the regulation and the controls ask.
 *
 * @module
 */
import type { Proposal } from "./soc2.ts";

const p = (from: string, to: readonly string[]): Proposal => ({ from, basis: `the paragraph of the rule and the ${to.length === 1 ? "control" : "controls"} are about the same matter, as the paragraph's own title and the names of the controls say`, to });

/** The proposals of the Security Rule to SP 800-53: one for each of the 65 entries. */
export const HIPAA_PROPOSALS: readonly Proposal[] = [
  p("164.308.a.1", ["RA-1", "PM-9", "PL-1"]), p("164.308.a.1.ii.A", ["RA-3", "RA-1"]), p("164.308.a.1.ii.B", ["RA-7", "PM-9"]), p("164.308.a.1.ii.C", ["PS-8"]), p("164.308.a.1.ii.D", ["AU-6", "CA-7", "SI-4"]),
  p("164.308.a.2", ["PM-2", "PM-1"]), p("164.308.a.3", ["AC-2", "PS-3", "PS-5"]), p("164.308.a.3.ii.A", ["AC-2", "PS-9"]), p("164.308.a.3.ii.B", ["PS-3"]), p("164.308.a.3.ii.C", ["PS-4", "PS-5", "AC-2"]),
  p("164.308.a.4", ["AC-1", "AC-2", "AC-3"]), p("164.308.a.4.ii.A", ["AC-4", "SC-7"]), p("164.308.a.4.ii.B", ["AC-2", "AC-3"]), p("164.308.a.4.ii.C", ["AC-2", "AC-6"]),
  p("164.308.a.5", ["AT-1", "AT-2", "AT-3"]), p("164.308.a.5.ii.A", ["AT-2"]), p("164.308.a.5.ii.B", ["SI-3", "AT-2"]), p("164.308.a.5.ii.C", ["AC-7", "AU-6"]), p("164.308.a.5.ii.D", ["IA-5"]),
  p("164.308.a.6", ["IR-1", "IR-4"]), p("164.308.a.6.ii", ["IR-4", "IR-5", "IR-6", "IR-8"]),
  p("164.308.a.7", ["CP-1", "CP-2"]), p("164.308.a.7.ii.A", ["CP-9"]), p("164.308.a.7.ii.B", ["CP-10", "CP-2"]), p("164.308.a.7.ii.C", ["CP-2", "CP-12"]), p("164.308.a.7.ii.D", ["CP-4"]), p("164.308.a.7.ii.E", ["CP-2", "RA-9"]),
  p("164.308.a.8", ["CA-2", "CA-7"]), p("164.308.b.1", ["SA-9", "PS-7", "CA-3"]), p("164.308.b.3", ["SA-9", "PS-7"]),
  p("164.310.a.1", ["PE-1", "PE-2", "PE-3"]), p("164.310.a.2.i", ["CP-2", "PE-3"]), p("164.310.a.2.ii", ["PE-2", "PE-3", "PE-6"]), p("164.310.a.2.iii", ["PE-2", "PE-3", "PE-8"]), p("164.310.a.2.iv", ["MA-2"]),
  p("164.310.b", ["PL-4", "AC-11", "PE-5"]), p("164.310.c", ["PE-5", "PE-3"]), p("164.310.d.1", ["MP-1", "MP-5", "PE-16"]), p("164.310.d.2.i", ["MP-6"]), p("164.310.d.2.ii", ["MP-6"]), p("164.310.d.2.iii", ["PE-16", "CM-8"]), p("164.310.d.2.iv", ["CP-9"]),
  p("164.312.a.1", ["AC-3", "IA-2"]), p("164.312.a.2.i", ["IA-2", "IA-4"]), p("164.312.a.2.ii", ["AC-2", "CP-2"]), p("164.312.a.2.iii", ["AC-11", "AC-12"]), p("164.312.a.2.iv", ["SC-13", "SC-28"]),
  p("164.312.b", ["AU-2", "AU-3", "AU-12"]), p("164.312.c.1", ["SI-7"]), p("164.312.c.2", ["SI-7"]), p("164.312.d", ["IA-2", "IA-3", "IA-8"]), p("164.312.e.1", ["SC-8", "SC-7"]), p("164.312.e.2.i", ["SC-8", "SI-7"]), p("164.312.e.2.ii", ["SC-8", "SC-13"]),
  p("164.314.a", ["SA-9", "PS-7", "CA-3"]), p("164.314.a.2.i", ["SA-9", "IR-6", "PS-7"]), p("164.314.a.2.ii", ["CA-3", "SA-9"]), p("164.314.a.2.iii", ["SA-9", "PS-7"]), p("164.314.b", ["AC-21", "SA-9"]), p("164.314.b.2", ["SA-9", "IR-6"]),
  p("164.316.a", ["PL-1", "PM-1"]), p("164.316.b.1", ["PL-2", "SA-5"]), p("164.316.b.2.i", ["AU-11", "SI-12"]), p("164.316.b.2.ii", ["PL-2", "SA-5"]), p("164.316.b.2.iii", ["PL-1", "PL-2"]),
];
