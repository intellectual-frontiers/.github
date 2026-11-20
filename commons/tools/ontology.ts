/**
 * The packaging ontology decoded once into typed records (commons 0002-packaging, 0004-rules, 0012-ontology), with every rule of it the data breaks.
 *
 * This is the tools' decode boundary. The ontology is TypeScript (commons/ontology/src/supply-chain/packaging/), whose values the compiler has already checked against
 * their class schemas; here its code lists become the tools' unions (a kind, a status, an assurance, an operation...) through tables the compiler holds complete,
 * its identifiers become branded ones, and what a type cannot state is checked. Everything after it works on the `Table`. The order in which things are read, and so
 * the order of the findings and of every list, is the order the Python generator (rdflib) gave: subjects sorted by IRI, a property's values in the order written.
 *
 * @module
 */
import { absurd, type Brand, brand, compareText, err, isOneOf, ok, type Result, sortedBy, sortedText } from "./core.ts";
import {
  assurances,
  codeOf,
  FIELD_TYPES,
  formatRdfFinding,
  type Iri,
  managerKinds,
  type Named,
  type Ontology,
  operations,
  owl,
  PM,
  RULE_SETS,
  supportStatuses,
  tiers,
  validate,
} from "../ontology/src/supply-chain/packaging/mod.ts";
import { words } from "./shlex.ts";

export type FamilyId = Brand<string, "FamilyId">;
export type ManagerId = Brand<string, "ManagerId">;
export type ProgramName = Brand<string, "ProgramName">;
export type PlatformName = Brand<string, "PlatformName">;
export type PinName = Brand<string, "PinName">;
/** 64 lower-case hexadecimal digits. */
export type Sha256 = Brand<string, "Sha256">;

export const OPS = [
  "install",
  "remove",
  "upgrade",
  "upgrade-all",
  "search",
  "info",
  "refresh",
  "list-installed",
  "query-installed",
  "query-candidate",
  "query-version",
] as const;
export type Op = (typeof OPS)[number];
/** The word of each operation of the code list (a key left out, or one more, does not compile). */
const OP_OF: { readonly [K in keyof typeof operations]: Op } = {
  Install: "install",
  Remove: "remove",
  Upgrade: "upgrade",
  UpgradeAll: "upgrade-all",
  Search: "search",
  Info: "info",
  Refresh: "refresh",
  ListInstalled: "list-installed",
  QueryInstalled: "query-installed",
  QueryCandidate: "query-candidate",
  QueryVersion: "query-version",
};
export type Assurance = "verified" | "stand-in" | "untested" | "none";
const ASSURANCE: { readonly [K in keyof typeof assurances]: Assurance } = {
  Verified: "verified",
  StandIn: "stand-in",
  Untested: "untested",
  NoAssurance: "none",
};
export type ManagerKind = "system" | "helper" | "universal";
const KIND: { readonly [K in keyof typeof managerKinds]: ManagerKind } = {
  SystemKind: "system",
  HelperKind: "helper",
  UniversalKind: "universal",
};
export type Tier = "required" | "comfort";
const TIER: { readonly [K in keyof typeof tiers]: Tier } = { Required: "required", Comfort: "comfort" };
export type SupportStatus = "supported" | "catalogued";
const STATUS: { readonly [K in keyof typeof supportStatuses]: SupportStatus } = { Supported: "supported", Catalogued: "catalogued" };
export { FIELD_TYPES, RULE_SETS };
export type RuleSet = (typeof RULE_SETS)[number];
export type FieldType = (typeof FIELD_TYPES)[number];
/** A command is a list of words, never a line for a shell. */
const SHELL_SYNTAX = /[;|&<>`()\n]/;
const HEX64 = /^[0-9a-f]{64}$/;

// ---- the table ---------------------------------------------------------------------------------------------------------------------------------------

export type Command = {
  readonly argv: readonly string[];
  readonly noninteractive: readonly string[] | null;
  readonly origin: string;
  readonly verified: string;
};
export type Manager = {
  readonly executable: string;
  readonly kind: ManagerKind;
  readonly administrator: boolean;
  readonly environment: string;
  readonly purlType: string;
  readonly harnessUse: string;
  readonly note: string;
  readonly commands: ReadonlyMap<Op, Command>;
};
export type Family = {
  readonly label: string;
  readonly status: SupportStatus;
  readonly assurance: Assurance;
  /** The IDs that detect it, sorted. */
  readonly detect: readonly string[];
  readonly detectSource: string;
  readonly uname: string;
  /** Its managers, in the order the ontology names them. */
  readonly managers: readonly ManagerId[];
  readonly preferred: ManagerId | null;
  readonly installsPackages: boolean;
  readonly removalHint: string;
  readonly adminInstall: string;
  readonly verifiedOn: string;
  readonly note: string;
};
export type Prohibition = {
  readonly manager: ManagerId;
  readonly template: string;
  readonly argv: readonly string[];
  readonly reason: string;
};
export type Program = { readonly tier: Tier; readonly order: number; readonly names: ReadonlyMap<FamilyId, string> };
export type Platform = { readonly os: string; readonly processor: string; readonly suffix: string; readonly label: string };
export type Pin = {
  readonly key: string;
  readonly version: string;
  readonly label: string;
  readonly note: string;
  readonly sha256: ReadonlyMap<PlatformName, Sha256>;
};
export type Rule = {
  readonly id: string;
  readonly set: RuleSet;
  readonly pattern: string;
  readonly label: string;
  readonly reason: string;
};
export type RecordField = {
  readonly name: string;
  readonly type: FieldType;
  readonly order: number;
  readonly definition: string;
  readonly values: readonly string[];
};

/** The whole table. A map keeps the order the ontology was read in (as the Python dicts did): where an output sorts, it sorts itself. */
export type Table = {
  readonly managers: ReadonlyMap<ManagerId, Manager>;
  readonly families: ReadonlyMap<FamilyId, Family>;
  readonly programs: ReadonlyMap<ProgramName, Program>;
  readonly prohibitions: readonly Prohibition[];
  readonly platforms: ReadonlyMap<PlatformName, Platform>;
  readonly pins: ReadonlyMap<PinName, Pin>;
  readonly rules: readonly Rule[];
  readonly record: readonly RecordField[];
};

// ---- what the ontology may break ----------------------------------------------------------------------------------------------------------------------

export type Finding =
  | { readonly kind: "rdf"; readonly sentence: string }
  | { readonly kind: "term-undefined"; readonly term: string }
  | { readonly kind: "class-unlabelled"; readonly term: string }
  | { readonly kind: "manager-twice"; readonly manager: ManagerId }
  | { readonly kind: "manager-no-executable"; readonly manager: ManagerId }
  | { readonly kind: "manager-kinds"; readonly manager: ManagerId }
  | { readonly kind: "prohibition-incomplete"; readonly subject: Iri }
  | { readonly kind: "command-incomplete"; readonly subject: Iri }
  | { readonly kind: "not-words"; readonly subject: Iri; readonly text: string; readonly why: string }
  | { readonly kind: "shell-syntax"; readonly manager: ManagerId; readonly op: Op; readonly form: Form }
  | { readonly kind: "forbidden"; readonly manager: ManagerId; readonly op: Op; readonly form: Form; readonly text: string }
  | { readonly kind: "command-twice"; readonly manager: ManagerId; readonly op: Op }
  | { readonly kind: "family-undetected"; readonly family: FamilyId }
  | { readonly kind: "id-shared"; readonly id: string; readonly first: FamilyId; readonly second: FamilyId }
  | { readonly kind: "family-no-status"; readonly family: FamilyId }
  | { readonly kind: "family-no-assurance"; readonly family: FamilyId }
  | { readonly kind: "family-unknown-manager"; readonly family: FamilyId }
  | { readonly kind: "program-incomplete"; readonly subject: Iri }
  | { readonly kind: "program-no-order"; readonly program: ProgramName }
  | { readonly kind: "package-name-incomplete"; readonly subject: Iri }
  | { readonly kind: "supported-without-assurance"; readonly family: FamilyId }
  | { readonly kind: "verified-unsaid"; readonly family: FamilyId }
  | { readonly kind: "no-removal-hint"; readonly family: FamilyId }
  | { readonly kind: "no-preferred-manager"; readonly family: FamilyId }
  | { readonly kind: "install-interactive"; readonly family: FamilyId; readonly manager: ManagerId }
  | { readonly kind: "install-not-harness"; readonly family: FamilyId; readonly manager: ManagerId; readonly origin: string }
  | { readonly kind: "no-admin-install"; readonly family: FamilyId }
  | { readonly kind: "no-query-installed"; readonly family: FamilyId; readonly manager: ManagerId }
  | { readonly kind: "required-unnamed"; readonly program: ProgramName; readonly family: FamilyId }
  | { readonly kind: "named-for-unsupported"; readonly program: ProgramName; readonly family: FamilyId }
  | { readonly kind: "platform-incomplete"; readonly subject: Iri }
  | { readonly kind: "suffix-shared"; readonly suffix: string }
  | { readonly kind: "pin-incomplete"; readonly subject: Iri }
  | { readonly kind: "key-shared"; readonly key: string }
  | { readonly kind: "checksum-incomplete"; readonly subject: Iri }
  | { readonly kind: "checksum-not-hex"; readonly pin: PinName; readonly platform: PlatformName }
  | { readonly kind: "checksum-twice"; readonly pin: PinName; readonly platform: PlatformName }
  | { readonly kind: "rule-incomplete"; readonly rule: string }
  | { readonly kind: "rule-pattern"; readonly rule: string; readonly why: string }
  | { readonly kind: "rule-twice"; readonly rule: string }
  | { readonly kind: "field-incomplete"; readonly subject: Iri }
  | { readonly kind: "field-repeated"; readonly field: string };
export type Form = "template" | "non-interactive form";

/** The sentence a finding is printed with (the Python generator's, word for word). */
export function describe(f: Finding): string {
  switch (f.kind) {
    case "rdf":
      return f.sentence;
    case "term-undefined":
      return `the term ${f.term} has no definition`;
    case "class-unlabelled":
      return `the class ${f.term} has no label`;
    case "manager-twice":
      return `two managers are called ${f.manager}`;
    case "manager-no-executable":
      return `manager ${f.manager} has no executable`;
    case "manager-kinds":
      return `manager ${f.manager} must have exactly one kind`;
    case "prohibition-incomplete":
      return `prohibition ${f.subject} needs a manager, a template and a reason`;
    case "command-incomplete":
      return `command ${f.subject} needs a manager, an operation and a template`;
    case "not-words":
      return `${f.subject}: ${JSON.stringify(f.text)} is not a list of words: ${f.why}`;
    case "shell-syntax":
      return `${f.manager} ${f.op}: the ${f.form} holds shell syntax; a command is a list of words`;
    case "forbidden":
      return `${f.manager} ${f.op}: the ${f.form} is a command the ontology forbids (${f.text})`;
    case "command-twice":
      return `${f.manager} has two ${f.op} commands`;
    case "family-undetected":
      return `family ${f.family} has no ID that detects it`;
    case "id-shared":
      return `the ID ${f.id} detects both ${f.first} and ${f.second}`;
    case "family-no-status":
      return `family ${f.family} has no support status`;
    case "family-no-assurance":
      return `family ${f.family} has no assurance`;
    case "family-unknown-manager":
      return `family ${f.family} names a manager that does not exist`;
    case "program-incomplete":
      return `program ${f.subject} needs a name and a tier`;
    case "program-no-order":
      return `program ${f.program} has no order`;
    case "package-name-incomplete":
      return `package name ${f.subject} needs a program, a family and a name`;
    case "supported-without-assurance":
      return `family ${f.family} is supported, so it needs an assurance other than none`;
    case "verified-unsaid":
      return `family ${f.family} is verified but says no where or when`;
    case "no-removal-hint":
      return `family ${f.family} is supported and has no removal hint`;
    case "no-preferred-manager":
      return `family ${f.family} is supported and has no preferred manager`;
    case "install-interactive":
      return `family ${f.family}: ${f.manager} needs an install command with a non-interactive form`;
    case "install-not-harness":
      return `family ${f.family}: the non-interactive install of ${f.manager} must come from a harness (origin archon), not from ${f.origin || "nowhere"}`;
    case "no-admin-install":
      return `family ${f.family} is supported and has no command for a person with administrator rights`;
    case "no-query-installed":
      return `family ${f.family}: ${f.manager} has no query-installed command, so a harness cannot tell what is already there`;
    case "required-unnamed":
      return `required program ${f.program} has no package name for the supported family ${f.family}`;
    case "named-for-unsupported":
      return `program ${f.program} names a package for ${f.family}, which is not supported`;
    case "platform-incomplete":
      return `platform ${f.subject} needs a name, an operating system, a processor, a pin suffix and a label`;
    case "suffix-shared":
      return `two platforms share the pin suffix ${f.suffix}`;
    case "pin-incomplete":
      return `pinned download ${f.subject} needs a name, a key and a version`;
    case "key-shared":
      return `two pinned downloads share the key ${f.key}`;
    case "checksum-incomplete":
      return `checksum ${f.subject} needs a pinned download, a platform and a SHA-256`;
    case "checksum-not-hex":
      return `the checksum of ${f.pin} on ${f.platform} is not 64 lower-case hexadecimal digits`;
    case "checksum-twice":
      return `${f.pin} has two checksums for ${f.platform}`;
    case "rule-incomplete":
      return `rule ${f.rule} needs a set (one of ${RULE_SETS.join(", ")}), a pattern, a name and a reason`;
    case "rule-pattern":
      return `rule ${f.rule}: the pattern is not a regular expression: ${f.why}`;
    case "rule-twice":
      return `two rules are called ${f.rule}`;
    case "field-incomplete":
      return `record field ${f.subject} needs a name, a type (one of ${FIELD_TYPES.join(", ")}), an order and a definition`;
    case "field-repeated":
      return `the record field ${f.field} repeats a name or an order`;
    default:
      return absurd(f);
  }
}

// ---- reading the typed values ---------------------------------------------------------------------------------------------------------------------------

/** A text that is there: Python's truthiness of a `str | None`. */
const given = (s: string | null | undefined): s is string => s !== null && s !== undefined && s !== "";

/** Individuals sorted by IRI, as the Python generator read each class's subjects. */
const byIri = <T extends Named>(xs: readonly T[]): T[] => sortedBy(xs, (a, b) => compareText(a.iri, b.iri));

/** The word a code list's individual names, through the table that maps the list's keys to words; nothing where the node is none of the list's. */
function wordOf<K extends string, W>(list: { readonly [N in K]: Named }, table: { readonly [N in K]: W }, node: Named): W | undefined {
  const key = codeOf(list, node);
  return key === undefined ? undefined : table[key];
}

/** What a subject's identifier is: its `dcterms:identifier`, or the end of its IRI. */
const ident = (s: Named, identifier: string): string => (given(identifier) ? identifier : s.iri.slice(s.iri.lastIndexOf("/") + 1));

type DraftFamily = Omit<Family, "status" | "assurance"> & { readonly status: SupportStatus | null; readonly assurance: Assurance | null };
type DraftManager = Omit<Manager, "kind" | "commands"> & { readonly kind: ManagerKind | null; readonly commands: Map<Op, Command> };
type DraftPin = Omit<Pin, "sha256"> & { readonly sha256: Map<PlatformName, string> };
type DraftProgram = Omit<Program, "names"> & { readonly names: Map<FamilyId, string> };

/** The table the ontology makes, or every rule it breaks, in the order the Python generator named them. */
export function decode(o: Ontology): Result<Table, Finding[]> {
  const bad: Finding[] = [];
  const split = (subject: Iri, text: string): string[] => {
    const w = words(text);
    if (w.ok) return w.value;
    bad.push({ kind: "not-words", subject, text, why: w.error });
    return [];
  };
  // 0012-ontology FR-005: what the kernel finds that a type cannot state (or a run without the type checker let through)
  const everything = [
    ...o.classes,
    ...o.properties,
    ...o.managers,
    ...o.commands,
    ...o.prohibitions,
    ...o.families,
    ...o.programs,
    ...o.packageNames,
    ...o.platforms,
    ...o.pins,
    ...o.checksums,
    ...o.rules,
    ...o.recordFields,
  ];
  for (const f of validate(everything)) bad.push({ kind: "rdf", sentence: formatRdfFinding(f) });
  // 0002-packaging FR-001: every term of the vocabulary is defined, and every class labelled
  const described = [
    ...o.classes.map((c) => ({ iri: c.iri, kind: c.class.iri, label: c.values.label?.value, definition: c.values.definition?.value })),
    ...o.properties.map((p) => ({ iri: p.iri, kind: p.class.iri, label: undefined, definition: p.values.definition?.value })),
  ];
  for (const kind of [owl.Class, owl.DatatypeProperty, owl.ObjectProperty]) {
    for (const term of sortedBy(
      described.filter((d) => d.kind === kind.iri),
      (x, y) => compareText(x.iri, y.iri),
    )) {
      if (!term.iri.startsWith(PM.iri)) continue;
      if (!given(term.definition)) bad.push({ kind: "term-undefined", term: term.iri.slice(PM.iri.length) });
      if (kind === owl.Class && !given(term.label)) bad.push({ kind: "class-unlabelled", term: term.iri.slice(PM.iri.length) });
    }
  }

  const managers = new Map<ManagerId, DraftManager>();
  const managerOf = new Map<string, ManagerId>();
  for (const m of byIri(o.managers)) {
    const v = m.values;
    const id = brand<"ManagerId">(ident(m, v.identifier));
    managerOf.set(m.iri, id);
    if (managers.has(id)) bad.push({ kind: "manager-twice", manager: id });
    const kind = wordOf(managerKinds, KIND, v.kind);
    if (!given(v.executable)) bad.push({ kind: "manager-no-executable", manager: id });
    if (kind === undefined) bad.push({ kind: "manager-kinds", manager: id });
    managers.set(id, {
      executable: v.executable,
      kind: kind ?? null,
      administrator: v.needsAdministrator === true,
      environment: v.environment ?? "",
      purlType: v.purlType ?? "",
      harnessUse: v.harnessUse ?? "",
      commands: new Map(),
      note: v.note ?? "",
    });
  }

  const prohibitions: Prohibition[] = [];
  for (const p of byIri(o.prohibitions)) {
    const owner = managerOf.get(p.values.prohibitionOf.iri);
    const t = p.values.forbiddenTemplate;
    const why = p.values.definition.value;
    if (owner === undefined || !given(t) || !given(why)) {
      bad.push({ kind: "prohibition-incomplete", subject: p.iri });
      continue;
    }
    prohibitions.push({ manager: owner, template: t, argv: split(p.iri, t), reason: why });
  }
  const forbidden = new Set(prohibitions.map((p) => `${p.manager}\0${p.template}`));
  for (const c of byIri(o.commands)) {
    const v = c.values;
    const id = managerOf.get(v.commandOf.iri);
    const op = wordOf(operations, OP_OF, v.operation);
    const t = v.template;
    const manager = id === undefined ? undefined : managers.get(id);
    if (id === undefined || manager === undefined || op === undefined || !given(t)) {
      bad.push({ kind: "command-incomplete", subject: c.iri });
      continue;
    }
    const ni = v.nonInteractive ?? null;
    const forms: readonly (readonly [Form, string | null])[] = [
      ["template", t],
      ["non-interactive form", ni],
    ];
    for (const [form, said] of forms) {
      if (said === null) continue;
      if (SHELL_SYNTAX.test(said)) bad.push({ kind: "shell-syntax", manager: id, op, form });
      if (forbidden.has(`${id}\0${said}`)) bad.push({ kind: "forbidden", manager: id, op, form, text: said });
    }
    if (manager.commands.has(op)) bad.push({ kind: "command-twice", manager: id, op });
    manager.commands.set(op, {
      argv: split(c.iri, t),
      noninteractive: given(ni) ? split(c.iri, ni) : null,
      origin: v.origin,
      verified: v.verifiedOn ?? "",
    });
  }

  const families = new Map<FamilyId, DraftFamily>();
  const familyOf = new Map<string, FamilyId>();
  const seenIds = new Map<string, FamilyId>();
  for (const f of byIri(o.families)) {
    const v = f.values;
    const id = brand<"FamilyId">(ident(f, v.identifier));
    familyOf.set(f.iri, id);
    const detect = sortedText(v.detectedBy ?? []);
    if (detect.length === 0) bad.push({ kind: "family-undetected", family: id });
    for (const d of detect) {
      const before = seenIds.get(d);
      if (before !== undefined && d !== "*") bad.push({ kind: "id-shared", id: d, first: before, second: id });
      seenIds.set(d, id);
    }
    const status = wordOf(supportStatuses, STATUS, v.supportStatus) ?? null;
    const assurance = wordOf(assurances, ASSURANCE, v.assurance) ?? null;
    if (status === null) bad.push({ kind: "family-no-status", family: id });
    if (assurance === null) bad.push({ kind: "family-no-assurance", family: id });
    const named = v.usesManager ?? [];
    const used = named.flatMap((m) => {
      const known = managerOf.get(m.iri);
      return known === undefined ? [] : [known];
    });
    if (used.length !== named.length) bad.push({ kind: "family-unknown-manager", family: id });
    families.set(id, {
      label: given(v.label.value) ? v.label.value : id,
      status,
      assurance,
      detect,
      detectSource: v.detectSource,
      uname: v.unameName ?? "",
      managers: used,
      preferred: v.preferredManager === undefined ? null : (managerOf.get(v.preferredManager.iri) ?? null),
      installsPackages: v.harnessInstallsPackages !== false,
      removalHint: v.removalHint ?? "",
      adminInstall: v.adminInstall ?? "",
      verifiedOn: v.verifiedOn ?? "",
      note: v.note ?? "",
    });
  }

  const programs = new Map<ProgramName, DraftProgram>();
  const programOf = new Map<string, ProgramName>();
  for (const p of byIri(o.programs)) {
    const name = p.values.programName;
    const tier = wordOf(tiers, TIER, p.values.tier);
    if (!given(name) || tier === undefined) {
      bad.push({ kind: "program-incomplete", subject: p.iri });
      continue;
    }
    const id = brand<"ProgramName">(name);
    programOf.set(p.iri, id);
    const order = p.values.order;
    const digits = Number.isSafeInteger(order) && order >= 0;
    if (!digits) bad.push({ kind: "program-no-order", program: id });
    programs.set(id, { tier, order: digits ? order : 0, names: new Map() });
  }
  for (const n of byIri(o.packageNames)) {
    const prog = programOf.get(n.values.forProgram.iri);
    const fam = familyOf.get(n.values.forFamily.iri);
    const name = n.values.name;
    const program = prog === undefined ? undefined : programs.get(prog);
    if (program === undefined || fam === undefined || !given(name)) {
      bad.push({ kind: "package-name-incomplete", subject: n.iri });
      continue;
    }
    program.names.set(fam, name);
  }

  // ---- rules for a family a harness acts on
  for (const [id, f] of sortedBy(families, ([a], [b]) => compareText(a, b))) {
    if (f.status !== "supported") continue;
    if (f.assurance === "none") bad.push({ kind: "supported-without-assurance", family: id });
    if (f.assurance === "verified" && f.verifiedOn === "") bad.push({ kind: "verified-unsaid", family: id });
    if (f.removalHint === "") bad.push({ kind: "no-removal-hint", family: id });
    if (!f.installsPackages) continue;
    const m = f.preferred === null ? undefined : managers.get(f.preferred);
    if (f.preferred === null || m === undefined) {
      bad.push({ kind: "no-preferred-manager", family: id });
      continue;
    }
    const install = m.commands.get("install");
    if (install === undefined || install.noninteractive === null)
      bad.push({ kind: "install-interactive", family: id, manager: f.preferred });
    else if (install.origin !== "archon")
      bad.push({ kind: "install-not-harness", family: id, manager: f.preferred, origin: install.origin });
    if (f.adminInstall === "") bad.push({ kind: "no-admin-install", family: id });
    if (!m.commands.has("query-installed")) bad.push({ kind: "no-query-installed", family: id, manager: f.preferred });
    for (const [name, p] of sortedBy(programs, ([a], [b]) => compareText(a, b))) {
      if (p.tier === "required" && !p.names.has(id)) bad.push({ kind: "required-unnamed", program: name, family: id });
    }
  }
  for (const [name, p] of programs) {
    for (const fid of p.names.keys())
      if (families.get(fid)?.status !== "supported") bad.push({ kind: "named-for-unsupported", program: name, family: fid });
  }

  const platforms = new Map<PlatformName, Platform>();
  const platformOf = new Map<string, PlatformName>();
  const suffixes = new Set<string>();
  for (const pl of byIri(o.platforms)) {
    const v = pl.values;
    const rec: Platform = { os: v.operatingSystem, processor: v.processor, suffix: v.pinSuffix, label: v.label.value };
    if (!given(v.platformName) || !Object.values(rec).every((x) => x !== "")) {
      bad.push({ kind: "platform-incomplete", subject: pl.iri });
      continue;
    }
    if (suffixes.has(rec.suffix)) bad.push({ kind: "suffix-shared", suffix: rec.suffix });
    suffixes.add(rec.suffix);
    const id = brand<"PlatformName">(v.platformName);
    platformOf.set(pl.iri, id);
    platforms.set(id, rec);
  }
  const pins = new Map<PinName, DraftPin>();
  const pinOf = new Map<string, PinName>();
  const keys = new Set<string>();
  for (const pn of byIri(o.pins)) {
    const v = pn.values;
    const [name, key, version] = [v.programName, v.pinKey, v.version];
    if (!given(name) || !given(key) || !given(version)) {
      bad.push({ kind: "pin-incomplete", subject: pn.iri });
      continue;
    }
    if (keys.has(key)) bad.push({ kind: "key-shared", key });
    keys.add(key);
    const id = brand<"PinName">(name);
    pinOf.set(pn.iri, id);
    pins.set(id, { key, version, label: given(v.label.value) ? v.label.value : name, note: v.note?.value ?? "", sha256: new Map() });
  }
  for (const c of byIri(o.checksums)) {
    const pin = pinOf.get(c.values.forPin.iri);
    const platform = platformOf.get(c.values.forPlatform.iri);
    const digest = c.values.sha256;
    const p = pin === undefined ? undefined : pins.get(pin);
    if (pin === undefined || p === undefined || platform === undefined || !given(digest)) {
      bad.push({ kind: "checksum-incomplete", subject: c.iri });
      continue;
    }
    if (!HEX64.test(digest)) bad.push({ kind: "checksum-not-hex", pin, platform });
    if (p.sha256.has(platform)) bad.push({ kind: "checksum-twice", pin, platform });
    p.sha256.set(platform, digest);
  }

  const rules: Rule[] = [];
  for (const rule of byIri(o.rules)) {
    const at = rule.iri.lastIndexOf("rule-");
    const id = rule.iri.slice(at < 0 ? 0 : at + "rule-".length);
    const v = rule.values;
    const [set, pattern, label, reason] = [v.ruleSet, v.pattern, v.label.value, v.definition.value];
    if (!isOneOf(RULE_SETS, set) || !given(pattern) || !given(label) || !given(reason)) {
      bad.push({ kind: "rule-incomplete", rule: id });
      continue;
    }
    try {
      new RegExp(pattern);
    } catch (e) {
      bad.push({ kind: "rule-pattern", rule: id, why: e instanceof Error ? e.message : String(e) });
    }
    if (rules.some((x) => x.id === id)) bad.push({ kind: "rule-twice", rule: id });
    rules.push({ id, set, pattern, label, reason });
  }

  const record: RecordField[] = [];
  for (const f of sortedBy(o.recordFields, (a, b) => a.values.order - b.values.order)) {
    const v = f.values;
    const [name, type, n, definition] = [v.fieldName, v.fieldType, v.order, v.definition.value];
    if (!given(name) || !isOneOf(FIELD_TYPES, type) || !Number.isSafeInteger(n) || !given(definition)) {
      bad.push({ kind: "field-incomplete", subject: f.iri });
      continue;
    }
    if (record.some((x) => x.name === name || x.order === n)) bad.push({ kind: "field-repeated", field: name });
    record.push({ name, type, order: n, definition, values: sortedText(v.allowedValue ?? []) });
  }

  if (bad.length > 0) return err(bad);
  return complete(managers, families, programs, prohibitions, platforms, pins, rules, record);
}

/** The drafts made total: where no rule is broken every family has a status and an assurance, every manager a kind and every checksum is 64 digits. */
function complete(
  managers: ReadonlyMap<ManagerId, DraftManager>,
  families: ReadonlyMap<FamilyId, DraftFamily>,
  programs: ReadonlyMap<ProgramName, DraftProgram>,
  prohibitions: readonly Prohibition[],
  platforms: ReadonlyMap<PlatformName, Platform>,
  pins: ReadonlyMap<PinName, DraftPin>,
  rules: readonly Rule[],
  record: readonly RecordField[],
): Result<Table, Finding[]> {
  const ms = new Map<ManagerId, Manager>();
  for (const [id, m] of managers) {
    if (m.kind === null) return err([{ kind: "manager-kinds", manager: id }]);
    ms.set(id, { ...m, kind: m.kind });
  }
  const fs = new Map<FamilyId, Family>();
  for (const [id, f] of families) {
    if (f.status === null) return err([{ kind: "family-no-status", family: id }]);
    if (f.assurance === null) return err([{ kind: "family-no-assurance", family: id }]);
    fs.set(id, { ...f, status: f.status, assurance: f.assurance });
  }
  const ps = new Map<PinName, Pin>();
  for (const [id, p] of pins) {
    const sums = new Map<PlatformName, Sha256>();
    for (const [platform, digest] of p.sha256) {
      if (!HEX64.test(digest)) return err([{ kind: "checksum-not-hex", pin: id, platform }]);
      sums.set(platform, brand<"Sha256">(digest));
    }
    ps.set(id, { ...p, sha256: sums });
  }
  return ok({ managers: ms, families: fs, programs, prohibitions, platforms, pins: ps, rules, record });
}
