/**
 * The record a setup script keeps of how an account was set up (commons 0002-packaging FR-016): the fields of ~/.config/erga/install.toml (desired-os-state kept it in ~/.config/desired-os-state/), in the order written, so that the script
 * that writes it and the harness that reads it cannot drift.
 *
 * @module
 */
import { en, type OntologyFile, RDFS, SKOS, term, XSD } from "@intellectual-frontiers/rdf";
import { PM, PMID, RecordField } from "./packaging.ts";

/** The fields of the record of how an account was set up, in the order written. */
export const recordFields = [
  RecordField.make(term(PMID, "record-method"), {
    fieldName: "method",
    fieldType: "text",
    order: 1,
    definition: en("How the account was set up: bootstrap (a computer set up whole) or setup (an account on a computer in use)."),
    allowedValue: ["bootstrap", "setup"],
  }),
  RecordField.make(term(PMID, "record-family"), {
    fieldName: "family",
    fieldType: "text",
    order: 2,
    definition: en("The system family, as the packaging table names it (debian, arch, macos)."),
  }),
  RecordField.make(term(PMID, "record-host"), {
    fieldName: "host",
    fieldType: "text",
    order: 3,
    definition: en("What the computer is: wsl, vm, container or machine."),
    allowedValue: ["wsl", "vm", "container", "machine"],
  }),
  RecordField.make(term(PMID, "record-distro"), {
    fieldName: "distro",
    fieldType: "text",
    order: 4,
    definition: en("The name the operating system gives itself (PRETTY_NAME of os-release, or the macOS version)."),
  }),
  RecordField.make(term(PMID, "record-arch"), {
    fieldName: "arch",
    fieldType: "text",
    order: 5,
    definition: en("The processor, as uname -m says it (x86_64, aarch64)."),
  }),
  RecordField.make(term(PMID, "record-installed"), {
    fieldName: "installed",
    fieldType: "date",
    order: 6,
    definition: en("The day (YYYY-MM-DD) the account was first set up; a rerun keeps it."),
  }),
  RecordField.make(term(PMID, "record-refreshed"), {
    fieldName: "refreshed",
    fieldType: "date",
    order: 7,
    definition: en("The day (YYYY-MM-DD) the setup last ran."),
  }),
] as const;

/** The file this module states: its name, its prefixes and its individuals. */
export const file: OntologyFile = { name: "record", prefixes: [PM, PMID, RDFS, SKOS, XSD], individuals: [...recordFields] };
