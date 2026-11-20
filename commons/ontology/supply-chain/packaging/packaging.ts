/**
 * The packaging vocabulary of the software supply chain capability (commons 0002-packaging): what a package manager, a system family, a command and a package name are,
 * so that any harness can name what it installs, where each piece comes from and how to install it the same way on every computer.
 * Terms specialize schema.org where it has a class (schema:SoftwareApplication, schema:Action); an SBOM made from this capability writes a package URL with SPDX 3.0.1's Software/packageUrl;
 * every other term is this namespace's own, because no established vocabulary names it.
 *
 * @remarks
 * The vocabulary is stated as typed values (commons 0012-ontology FR-009): its namespaces and terms, its code lists, the class schemas its data is
 * made with, and the descriptions of its classes and properties, which make its Turtle.
 *
 * @module
 */
import {
  classSchema,
  codes,
  DatatypeProperty,
  DCTERMS,
  dcterms,
  en,
  iriIn,
  many,
  namespace,
  named,
  ObjectProperty,
  one,
  type OntologyFile,
  ontologyOf,
  optional,
  OWL,
  OwlClass,
  OwlOntology,
  range,
  RDFS,
  rdfs,
  SKOS,
  skos,
  vocabulary,
  XSD,
  xsd,
} from "../../../rdf/src/mod.ts";
import { SCHEMA, schema } from "./schema.auto.ts";

/** The namespace of the packaging vocabulary's terms. */
export const PM = namespace("pm", "https://www.intellectualfrontiers.com/ontology/packaging#");
/** The namespace of the packaging individuals: the managers, families, programs, pins and the rest. */
export const PMID = namespace("pmid", "https://www.intellectualfrontiers.com/id/packaging/");
/** The namespace of the versions of the packaging ontology: `owl:versionIRI` names one of them. */
export const PMV = namespace("pmv", "https://www.intellectualfrontiers.com/ontology/packaging/");
export { SCHEMA, schema } from "./schema.auto.ts";
/** The terms of the packaging vocabulary: its classes and properties. */
export const pm = vocabulary(PM, {
  PackageManager: "owl:Class",
  SystemFamily: "owl:Class",
  Command: "owl:Class",
  Prohibition: "owl:Class",
  Program: "owl:Class",
  PackageName: "owl:Class",
  Platform: "owl:Class",
  PinnedDownload: "owl:Class",
  Checksum: "owl:Class",
  Rule: "owl:Class",
  RecordField: "owl:Class",
  Operation: "owl:Class",
  SupportStatus: "owl:Class",
  Assurance: "owl:Class",
  ManagerKind: "owl:Class",
  Tier: "owl:Class",
  executable: "owl:DatatypeProperty",
  kind: "owl:ObjectProperty",
  needsAdministrator: "owl:DatatypeProperty",
  environment: "owl:DatatypeProperty",
  purlType: "owl:DatatypeProperty",
  harnessUse: "owl:DatatypeProperty",
  commandOf: "owl:ObjectProperty",
  operation: "owl:ObjectProperty",
  template: "owl:DatatypeProperty",
  nonInteractive: "owl:DatatypeProperty",
  origin: "owl:DatatypeProperty",
  verifiedOn: "owl:DatatypeProperty",
  prohibitionOf: "owl:ObjectProperty",
  forbiddenTemplate: "owl:DatatypeProperty",
  detectedBy: "owl:DatatypeProperty",
  detectSource: "owl:DatatypeProperty",
  unameName: "owl:DatatypeProperty",
  usesManager: "owl:ObjectProperty",
  preferredManager: "owl:ObjectProperty",
  supportStatus: "owl:ObjectProperty",
  assurance: "owl:ObjectProperty",
  harnessInstallsPackages: "owl:DatatypeProperty",
  removalHint: "owl:DatatypeProperty",
  adminInstall: "owl:DatatypeProperty",
  note: "owl:DatatypeProperty",
  programName: "owl:DatatypeProperty",
  order: "owl:DatatypeProperty",
  tier: "owl:ObjectProperty",
  forProgram: "owl:ObjectProperty",
  forFamily: "owl:ObjectProperty",
  name: "owl:DatatypeProperty",
  platformName: "owl:DatatypeProperty",
  operatingSystem: "owl:DatatypeProperty",
  processor: "owl:DatatypeProperty",
  pinSuffix: "owl:DatatypeProperty",
  pinKey: "owl:DatatypeProperty",
  version: "owl:DatatypeProperty",
  forPin: "owl:ObjectProperty",
  forPlatform: "owl:ObjectProperty",
  sha256: "owl:DatatypeProperty",
  ruleSet: "owl:DatatypeProperty",
  pattern: "owl:DatatypeProperty",
  fieldName: "owl:DatatypeProperty",
  fieldType: "owl:DatatypeProperty",
  allowedValue: "owl:DatatypeProperty",
});

// ---- the words a field may hold, each list the union of its field's type

/** The sets a rule belongs to (commons 0004-rules FR-001). */
export const RULE_SETS = ["shell-portability", "ci-forbidden-program", "ci-forbidden-action", "host-program", "installer"] as const;
/** The types of a field of the setup record (commons 0002-packaging FR-016). */
export const FIELD_TYPES = ["text", "boolean", "date"] as const;
/** Where the IDs that detect a family come from. */
export const DETECT_SOURCES = ["os-release", "platform", "any"] as const;
/** Where a command comes from (commons 0002-packaging FR-003). */
export const ORIGINS = ["upt", "archon", "memory", "upt+memory"] as const;
/** The operating systems of a platform (commons 0002-packaging FR-014). */
export const OPERATING_SYSTEMS = ["linux", "macos", "windows"] as const;
/** The processors of a platform, as `uname -m` says them (commons 0002-packaging FR-014). */
export const PROCESSORS = ["x86_64", "aarch64"] as const;
/** How a harness may use a manager, where it may not drive it as any other. */
export const HARNESS_USES = ["never"] as const;

// ---- the code lists

/** The fields of an individual of a code list: its label, and a definition where the label is not enough. */
const CODE = { label: one(rdfs.label, range.langString), definition: optional(skos.definition, range.langString) } as const;

/** The operations of a package manager, named the same for every manager: a code list, whose keys are the union the tools branch on. */
export const operations = codes(classSchema(pm.Operation, CODE), PM, {
  Install: { label: en("install") },
  Remove: { label: en("remove") },
  Upgrade: { label: en("upgrade") },
  UpgradeAll: { label: en("upgrade all") },
  Search: { label: en("search") },
  Info: { label: en("info") },
  Refresh: { label: en("refresh index") },
  ListInstalled: { label: en("list installed") },
  QueryInstalled: { label: en("query installed"), definition: en("Whether one package is installed: the exit status answers.") },
  QueryVersion: { label: en("query version"), definition: en("The version of one installed package, for an SBOM: the command prints it.") },
  QueryCandidate: { label: en("query candidate"), definition: en("Whether the repositories offer one package, and which version.") },
});

/** Whether a harness acts on a family: a code list, whose keys are the union the tools branch on. */
export const supportStatuses = codes(classSchema(pm.SupportStatus, CODE), PM, {
  Supported: { label: en("supported") },
  Catalogued: { label: en("catalogued") },
});

/** How far a family has been tried: a code list, whose keys are the union the tools branch on. */
export const assurances = codes(classSchema(pm.Assurance, CODE), PM, {
  Verified: { label: en("verified") },
  StandIn: { label: en("stand-in") },
  Untested: { label: en("untested") },
  NoAssurance: { label: en("none") },
});

/** The kinds of package manager: a code list, whose keys are the union the tools branch on. */
export const managerKinds = codes(classSchema(pm.ManagerKind, CODE), PM, {
  SystemKind: { label: en("system") },
  HelperKind: { label: en("helper") },
  UniversalKind: { label: en("universal") },
});

/** The tiers of a program: a code list, whose keys are the union the tools branch on. */
export const tiers = codes(classSchema(pm.Tier, CODE), PM, {
  Required: { label: en("required") },
  Comfort: { label: en("comfort") },
});

// ---- the class schemas the data is made with

/** The schema of a package manager (`pm:PackageManager`). */
export const Manager = classSchema(pm.PackageManager, {
  label: one(rdfs.label, range.langString),
  identifier: one(dcterms.identifier, range.string),
  executable: one(pm.executable, range.string),
  kind: one(pm.kind, range.ref<"pm:ManagerKind">()),
  needsAdministrator: one(pm.needsAdministrator, range.boolean),
  environment: optional(pm.environment, range.string),
  purlType: optional(pm.purlType, range.string),
  harnessUse: optional(pm.harnessUse, range.oneOf(HARNESS_USES)),
  note: optional(pm.note, range.string),
});

/** The schema of a command of a manager (`pm:Command`). */
export const Command = classSchema(pm.Command, {
  commandOf: one(pm.commandOf, range.ref<"pm:PackageManager">()),
  operation: one(pm.operation, range.ref<"pm:Operation">()),
  template: one(pm.template, range.string),
  nonInteractive: optional(pm.nonInteractive, range.string),
  origin: one(pm.origin, range.oneOf(ORIGINS)),
  verifiedOn: optional(pm.verifiedOn, range.string),
});

/** The schema of a command never to run (`pm:Prohibition`). */
export const Prohibition = classSchema(pm.Prohibition, {
  prohibitionOf: one(pm.prohibitionOf, range.ref<"pm:PackageManager">()),
  forbiddenTemplate: one(pm.forbiddenTemplate, range.string),
  definition: one(skos.definition, range.langString),
});

/** The schema of a system family (`pm:SystemFamily`). */
export const Family = classSchema(pm.SystemFamily, {
  label: one(rdfs.label, range.langString),
  identifier: one(dcterms.identifier, range.string),
  detectSource: one(pm.detectSource, range.oneOf(DETECT_SOURCES)),
  detectedBy: many(pm.detectedBy, range.string),
  unameName: optional(pm.unameName, range.string),
  usesManager: many(pm.usesManager, range.ref<"pm:PackageManager">()),
  preferredManager: optional(pm.preferredManager, range.ref<"pm:PackageManager">()),
  supportStatus: one(pm.supportStatus, range.ref<"pm:SupportStatus">()),
  assurance: one(pm.assurance, range.ref<"pm:Assurance">()),
  harnessInstallsPackages: optional(pm.harnessInstallsPackages, range.boolean),
  removalHint: optional(pm.removalHint, range.string),
  adminInstall: optional(pm.adminInstall, range.string),
  verifiedOn: optional(pm.verifiedOn, range.string),
  note: optional(pm.note, range.string),
});

/** The schema of a program (`pm:Program`). */
export const Program = classSchema(pm.Program, {
  label: one(rdfs.label, range.langString),
  programName: one(pm.programName, range.string),
  tier: one(pm.tier, range.ref<"pm:Tier">()),
  order: one(pm.order, range.integer),
});

/** The schema of what a family calls a program's package (`pm:PackageName`). */
export const PackageName = classSchema(pm.PackageName, {
  forProgram: one(pm.forProgram, range.ref<"pm:Program">()),
  forFamily: one(pm.forFamily, range.ref<"pm:SystemFamily">()),
  name: one(pm.name, range.string),
});

/** The schema of a platform (`pm:Platform`). */
export const Platform = classSchema(pm.Platform, {
  label: one(rdfs.label, range.langString),
  platformName: one(pm.platformName, range.string),
  operatingSystem: one(pm.operatingSystem, range.oneOf(OPERATING_SYSTEMS)),
  processor: one(pm.processor, range.oneOf(PROCESSORS)),
  pinSuffix: one(pm.pinSuffix, range.string),
});

/** The schema of a pinned download (`pm:PinnedDownload`). */
export const PinnedDownload = classSchema(pm.PinnedDownload, {
  label: one(rdfs.label, range.langString),
  programName: one(pm.programName, range.string),
  pinKey: one(pm.pinKey, range.string),
  version: one(pm.version, range.string),
  note: optional(pm.note, range.langString),
});

/** The schema of the checksum of a pinned download on a platform (`pm:Checksum`). */
export const Checksum = classSchema(pm.Checksum, {
  forPin: one(pm.forPin, range.ref<"pm:PinnedDownload">()),
  forPlatform: one(pm.forPlatform, range.ref<"pm:Platform">()),
  sha256: one(pm.sha256, range.string),
});

/** The schema of a rule (`pm:Rule`). */
export const Rule = classSchema(pm.Rule, {
  ruleSet: one(pm.ruleSet, range.oneOf(RULE_SETS)),
  pattern: one(pm.pattern, range.string),
  label: one(rdfs.label, range.langString),
  definition: one(skos.definition, range.langString),
});

/** The schema of a field of the setup record (`pm:RecordField`). */
export const RecordField = classSchema(pm.RecordField, {
  fieldName: one(pm.fieldName, range.string),
  fieldType: one(pm.fieldType, range.oneOf(FIELD_TYPES)),
  order: one(pm.order, range.integer),
  definition: one(skos.definition, range.langString),
  allowedValue: many(pm.allowedValue, range.string),
});

// ---- the vocabulary's own statements

/** The ontology itself: its label, description and version. */
export const packagingOntology = OwlOntology.make(ontologyOf(PM), {
  label: en("Packaging"),
  description: en("The package managers and system families a harness installs software with, the commands that drive them, and the package each program is called."),
  versionInfo: "1.0.0",
  versionIri: named<"owl:Ontology">(iriIn(PMV, "1.0.0")),
});

/** The classes, each with its label and definition. */
export const classes = [
  // ---- classes ----------------------------------------------------------------------------------------------------------------------------------------
  OwlClass.make(pm.PackageManager, {
    label: en("Package manager"),
    subClassOf: [schema.SoftwareApplication],
    definition: en("A program that installs, upgrades and removes the software of a computer or of a user: apt, pacman, dnf, brew and the rest."),
  }),
  OwlClass.make(pm.SystemFamily, {
    label: en("System family"),
    subClassOf: [schema.Thing],
    definition: en(
      "Operating systems that share a package manager and the names of their packages, named in the way a harness detects them: by the ID or ID_LIKE of /etc/os-release, or by the platform where there is none.",
    ),
  }),
  OwlClass.make(pm.Command, {
    label: en("Command"),
    subClassOf: [schema.Action],
    definition: en(
      "One operation of one package manager as a command template: its words, with {packages} or {package} where the names go, and the form a script runs without asking a person.",
    ),
  }),
  OwlClass.make(pm.Prohibition, { label: en("Prohibition"), definition: en("A command a harness must never run, with the reason: the rule is data, not a comment in a script.") }),
  OwlClass.make(pm.Program, {
    label: en("Program"),
    subClassOf: [schema.SoftwareApplication],
    definition: en("A program a computer needs, named once, whatever each family calls its package."),
  }),
  OwlClass.make(pm.PackageName, {
    label: en("Package name"),
    definition: en(
      "What one family calls the package that gives a program: xz-utils on the Debian family and xz on the Arch family, or alternatives (a|b) for releases that renamed it.",
    ),
  }),
  OwlClass.make(pm.Platform, {
    label: en("Platform"),
    definition: en("An operating system on a processor, named the way a harness names its downloads (linux-x64, macos-arm64)."),
  }),
  OwlClass.make(pm.PinnedDownload, {
    label: en("Pinned download"),
    subClassOf: [schema.SoftwareApplication],
    definition: en("A program a script fetches before any harness exists, at one version, whose download is accepted only with the SHA-256 pinned for the platform."),
  }),
  OwlClass.make(pm.Checksum, { label: en("Checksum"), definition: en("The SHA-256 of one pinned download on one platform.") }),
  OwlClass.make(pm.Rule, {
    label: en("Rule"),
    definition: en("A pattern a harness looks for in its scripts, CI or code, in a named set, with a short name and the reason it is not allowed."),
  }),
  OwlClass.make(pm.RecordField, {
    label: en("Record field"),
    definition: en("One field of the record a setup keeps of how an account was set up: its name, its type and, where only some values are allowed, which."),
  }),
  // individuals that name a kind
  OwlClass.make(pm.Operation, { label: en("Operation"), definition: en("A thing a package manager does, named the same for every manager.") }),
  OwlClass.make(pm.SupportStatus, { label: en("Support status"), definition: en("Whether a harness acts on a family (supported), or only knows of it (catalogued).") }),
  OwlClass.make(pm.Assurance, {
    label: en("Assurance"),
    definition: en(
      "How far a family has been tried: on a real computer (verified), only against stand-ins (stand-in), not at all (untested), or not applicable (none, for what is only catalogued).",
    ),
  }),
  OwlClass.make(pm.ManagerKind, {
    label: en("Manager kind"),
    definition: en("system (the computer's own), helper (a front end to another manager or to a user repository) or universal (works on many systems)."),
  }),
  OwlClass.make(pm.Tier, { label: en("Tier"), definition: en("required (what a setup needs from the computer) or comfort (the everyday programs a bootstrap adds).") }),
] as const;

/** The properties, each with its domain, range and definition. */
export const properties = [
  // ---- properties: managers -------------------------------------------------------------------------------------------------------------------------
  DatatypeProperty.make(pm.executable, { domain: pm.PackageManager, range: xsd.string, definition: en("The program that is run (argv[0] of its commands).") }),
  ObjectProperty.make(pm.kind, { domain: pm.PackageManager, range: pm.ManagerKind, definition: en("system, helper or universal.") }),
  DatatypeProperty.make(pm.needsAdministrator, {
    domain: pm.PackageManager,
    range: xsd.boolean,
    definition: en("Whether installing with it needs administrator rights. Not from upt; unverified unless the manager is verified."),
  }),
  DatatypeProperty.make(pm.environment, {
    domain: pm.PackageManager,
    range: xsd.string,
    definition: en("NAME=value that its non-interactive commands run with, such as DEBIAN_FRONTEND=noninteractive."),
  }),
  DatatypeProperty.make(pm.purlType, {
    domain: pm.PackageManager,
    range: xsd.string,
    definition: en("The package URL type of the packages it installs (deb, rpm, apk, alpm, brew); absent where the package URL specification has none."),
  }),
  DatatypeProperty.make(pm.harnessUse, {
    domain: pm.PackageManager,
    range: xsd.string,
    definition: en("never where a harness must not drive it (an AUR helper runs build scripts of unreviewed packages)."),
  }),
  // ---- properties: commands --------------------------------------------------------------------------------------------------------------------------
  ObjectProperty.make(pm.commandOf, { domain: pm.Command, range: pm.PackageManager, definition: en("The manager the command belongs to.") }),
  ObjectProperty.make(pm.operation, { domain: pm.Command, range: pm.Operation, definition: en("What the command does.") }),
  DatatypeProperty.make(pm.template, {
    domain: pm.Command,
    range: xsd.string,
    definition: en("Its words, separated by spaces, with {packages} (one or more names) or {package} (one) where the names go. No shell syntax: it is run as a list of words."),
  }),
  DatatypeProperty.make(pm.nonInteractive, { domain: pm.Command, range: xsd.string, definition: en("The same command in the form a script runs without asking anyone.") }),
  DatatypeProperty.make(pm.origin, {
    domain: pm.Command,
    range: xsd.string,
    definition: en("Where the command comes from: upt, archon (what a harness runs) or memory (written from knowledge, unverified)."),
  }),
  DatatypeProperty.make(pm.verifiedOn, { definition: en("Where and when it was run for real, in words. Without it, a command, a family or a flag is not verified.") }),
  ObjectProperty.make(pm.prohibitionOf, { domain: pm.Prohibition, range: pm.PackageManager, definition: en("The manager the prohibition is about.") }),
  DatatypeProperty.make(pm.forbiddenTemplate, { domain: pm.Prohibition, range: xsd.string, definition: en("The command (a template, as pm:template) that must never be run.") }),
  // ---- properties: families --------------------------------------------------------------------------------------------------------------------------
  DatatypeProperty.make(pm.detectedBy, {
    domain: pm.SystemFamily,
    range: xsd.string,
    definition: en("An ID that puts a computer in the family: a word of the ID or ID_LIKE of /etc/os-release, or a platform name where there is no such file."),
  }),
  DatatypeProperty.make(pm.detectSource, {
    domain: pm.SystemFamily,
    range: xsd.string,
    definition: en("os-release (the IDs are those of /etc/os-release), platform (they are names of a platform), or any (the fallback, the managers found on the PATH)."),
  }),
  DatatypeProperty.make(pm.unameName, {
    domain: pm.SystemFamily,
    range: xsd.string,
    definition: en("What `uname -s` says on a platform family (Darwin for macOS), where /etc/os-release has none."),
  }),
  ObjectProperty.make(pm.usesManager, {
    domain: pm.SystemFamily,
    range: pm.PackageManager,
    definition: en("A manager the family has, in upt's order of preference when pm:preferredManager is not set."),
  }),
  ObjectProperty.make(pm.preferredManager, { domain: pm.SystemFamily, range: pm.PackageManager, definition: en("The manager a harness drives on the family.") }),
  ObjectProperty.make(pm.supportStatus, { domain: pm.SystemFamily, range: pm.SupportStatus, definition: en("Whether a harness acts on the family.") }),
  ObjectProperty.make(pm.assurance, { domain: pm.SystemFamily, range: pm.Assurance, definition: en("How far the family has been tried.") }),
  DatatypeProperty.make(pm.harnessInstallsPackages, {
    domain: pm.SystemFamily,
    range: xsd.boolean,
    definition: en("False where a supported family installs no package (a Mac: the setup fetches what it needs itself)."),
  }),
  DatatypeProperty.make(pm.removalHint, {
    domain: pm.SystemFamily,
    range: xsd.string,
    definition: en("How a user made for a harness is removed with its home folder, with NAME for the user."),
  }),
  DatatypeProperty.make(pm.adminInstall, {
    domain: pm.SystemFamily,
    range: xsd.string,
    definition: en("The command a person with administrator rights runs to install packages (a pm:template with {packages})."),
  }),
  DatatypeProperty.make(pm.note, { definition: en("A sentence a person needs, such as what is not covered by an assurance.") }),
  // ---- properties: programs and names ----------------------------------------------------------------------------------------------------------------
  DatatypeProperty.make(pm.programName, { domain: pm.Program, range: xsd.string, definition: en("What the program is called when it is run.") }),
  DatatypeProperty.make(pm.order, {
    domain: pm.Program,
    range: xsd.integer,
    definition: en("Where the program stands in the lists a harness shows or installs from; lower comes first."),
  }),
  ObjectProperty.make(pm.tier, { domain: pm.Program, range: pm.Tier, definition: en("required or comfort.") }),
  ObjectProperty.make(pm.forProgram, { domain: pm.PackageName, range: pm.Program, definition: en("The program the package gives.") }),
  ObjectProperty.make(pm.forFamily, { domain: pm.PackageName, range: pm.SystemFamily, definition: en("The family that calls the package this.") }),
  DatatypeProperty.make(pm.name, { domain: pm.PackageName, range: xsd.string, definition: en("The package, or alternatives separated by | where a release renamed it.") }),
  DatatypeProperty.make(pm.platformName, { domain: pm.Platform, range: xsd.string, definition: en("The platform's name in a harness's declarations and downloads (linux-x64).") }),
  DatatypeProperty.make(pm.operatingSystem, { domain: pm.Platform, range: xsd.string, definition: en("linux or macos.") }),
  DatatypeProperty.make(pm.processor, { domain: pm.Platform, range: xsd.string, definition: en("What `uname -m` says on the platform (x86_64, aarch64).") }),
  DatatypeProperty.make(pm.pinSuffix, {
    domain: pm.Platform,
    range: xsd.string,
    definition: en("The ending of a pin's variable name for the platform (X86_64 gives MISE_SHA256_X86_64)."),
  }),
  DatatypeProperty.make(pm.pinKey, { domain: pm.PinnedDownload, range: xsd.string, definition: en("The start of a pin's variable names (MISE gives MISE_VERSION).") }),
  DatatypeProperty.make(pm.version, { domain: pm.PinnedDownload, range: xsd.string, definition: en("The one version that is pinned.") }),
  ObjectProperty.make(pm.forPin, { domain: pm.Checksum, range: pm.PinnedDownload, definition: en("The pinned download the checksum is of.") }),
  ObjectProperty.make(pm.forPlatform, { domain: pm.Checksum, range: pm.Platform, definition: en("The platform the checksum is for.") }),
  DatatypeProperty.make(pm.sha256, { domain: pm.Checksum, range: xsd.string, definition: en("The SHA-256 of the download, in lower-case hexadecimal.") }),
  DatatypeProperty.make(pm.ruleSet, {
    domain: pm.Rule,
    range: xsd.string,
    definition: en("The set the rule belongs to: shell-portability, ci-forbidden-program, ci-forbidden-action, host-program or installer."),
  }),
  DatatypeProperty.make(pm.pattern, { domain: pm.Rule, range: xsd.string, definition: en("A regular expression (ECMAScript syntax) the rule looks for.") }),
  DatatypeProperty.make(pm.fieldName, { domain: pm.RecordField, range: xsd.string, definition: en("The name of the field in the record.") }),
  DatatypeProperty.make(pm.fieldType, {
    domain: pm.RecordField,
    range: xsd.string,
    definition: en("text (a quoted string), boolean (true or false) or date (a quoted YYYY-MM-DD)."),
  }),
  DatatypeProperty.make(pm.allowedValue, { domain: pm.RecordField, range: xsd.string, definition: en("A value the field may hold, where it may hold only some.") }),
] as const;

/** The file this module states: its name, its prefixes and its individuals. */
export const file: OntologyFile = {
  name: "packaging",
  prefixes: [DCTERMS, OWL, PM, PMV, RDFS, SCHEMA, SKOS, XSD],
  individuals: [
    packagingOntology,
    ...classes,
    ...Object.values(operations),
    ...Object.values(supportStatuses),
    ...Object.values(assurances),
    ...Object.values(managerKinds),
    ...Object.values(tiers),
    ...properties,
  ],
};
