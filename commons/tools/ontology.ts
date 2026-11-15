// The packaging ontology decoded once into typed records (commons 0002-packaging, 0004-rules), with every rule of it the data breaks.
//
// This is the tools' decode boundary: the graph's terms become the vocabulary's unions (a kind, a status, an assurance, an operation...) and branded identifiers here,
// and everything after it works on the `Table`. The order in which things are read, and so the order of the findings and of every list, is the order the Python
// generator (rdflib) gave: subjects sorted by IRI, a property's values in the order written, and one value of a property the least of them.
import { assertNever, type Brand, brand, compareText, err, isOneOf, ok, type Result, sortedBy, sortedText } from "./core.ts";
import { type Graph, type Iri, iri, RDF_TYPE, type Term, textOf } from "./turtle.ts";
import { words } from "./shlex.ts";

export type FamilyId = Brand<string, "FamilyId">;
export type ManagerId = Brand<string, "ManagerId">;
export type ProgramName = Brand<string, "ProgramName">;
export type PlatformName = Brand<string, "PlatformName">;
export type PinName = Brand<string, "PinName">;
/** 64 lower-case hexadecimal digits. */
export type Sha256 = Brand<string, "Sha256">;

export const PM = "https://www.intellectualfrontiers.com/ontology/packaging#";
const pm = (local: string): Iri => iri(`${PM}${local}`);
const OWL = "http://www.w3.org/2002/07/owl#";
const RDFS_LABEL = iri("http://www.w3.org/2000/01/rdf-schema#label");
const DCTERMS_IDENTIFIER = iri("http://purl.org/dc/terms/identifier");
const SKOS_DEFINITION = iri("http://www.w3.org/2004/02/skos/core#definition");

export const OPS = ["install", "remove", "upgrade", "upgrade-all", "search", "info", "refresh", "list-installed", "query-installed", "query-candidate", "query-version"] as const;
export type Op = (typeof OPS)[number];
/** The IRIs of a vocabulary's individuals (`pm:Local`), and the word each decodes to. */
const vocab = <T extends string>(words: Readonly<Record<string, T>>): ReadonlyMap<string, T> => new Map(Object.entries(words).map(([local, w]) => [`${PM}${local}`, w]));
const OP_OF = vocab<Op>({
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
});
export type Assurance = "verified" | "stand-in" | "untested" | "none";
const ASSURANCE = vocab<Assurance>({ Verified: "verified", StandIn: "stand-in", Untested: "untested", NoAssurance: "none" });
export type ManagerKind = "system" | "helper" | "universal";
const KIND = vocab<ManagerKind>({ SystemKind: "system", HelperKind: "helper", UniversalKind: "universal" });
export type Tier = "required" | "comfort";
const TIER = vocab<Tier>({ Required: "required", Comfort: "comfort" });
export type SupportStatus = "supported" | "catalogued";
export const RULE_SETS = ["shell-portability", "ci-forbidden-program", "ci-forbidden-action", "host-program", "installer"] as const;
export type RuleSet = (typeof RULE_SETS)[number];
export const FIELD_TYPES = ["text", "boolean", "date"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];
/** A command is a list of words, never a line for a shell. */
const SHELL_SYNTAX = /[;|&<>`()\n]/;
const HEX64 = /^[0-9a-f]{64}$/;

// ---- the table ---------------------------------------------------------------------------------------------------------------------------------------

export type Command = { readonly argv: readonly string[]; readonly noninteractive: readonly string[] | null; readonly origin: string; readonly verified: string };
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
export type Prohibition = { readonly manager: ManagerId; readonly template: string; readonly argv: readonly string[]; readonly reason: string };
export type Program = { readonly tier: Tier; readonly order: number; readonly names: ReadonlyMap<FamilyId, string> };
export type Platform = { readonly os: string; readonly processor: string; readonly suffix: string; readonly label: string };
export type Pin = { readonly key: string; readonly version: string; readonly label: string; readonly note: string; readonly sha256: ReadonlyMap<PlatformName, Sha256> };
export type Rule = { readonly id: string; readonly set: RuleSet; readonly pattern: string; readonly label: string; readonly reason: string };
export type RecordField = { readonly name: string; readonly type: FieldType; readonly order: number; readonly definition: string; readonly values: readonly string[] };

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
      return assertNever(f);
  }
}

// ---- reading the graph ---------------------------------------------------------------------------------------------------------------------------------

/** A text that is there: Python's truthiness of a `str | None`. */
const given = (s: string | null): s is string => s !== null && s !== "";
/** Python's `int()` of a text of digits, or null. */
const integer = (s: string): number | null => (/^\s*[+-]?[0-9]+(?:_[0-9]+)*\s*$/.test(s) ? Number.parseInt(s.replaceAll("_", ""), 10) : null);

class Reader {
  constructor(readonly g: Graph) {}
  /** The subjects of a class, sorted by IRI. */
  all(cls: Iri): Iri[] {
    return sortedBy(this.g.subjects(RDF_TYPE, cls), compareText);
  }
  /** The least of a property's values, as text. */
  one(s: Iri, p: Iri): string | null {
    return sortedText(this.g.objects(s, p).map(textOf))[0] ?? null;
  }
  many(s: Iri, p: Iri): string[] {
    return sortedText(this.g.objects(s, p).map(textOf));
  }
  /** The first value of a property, as read. */
  first(s: Iri, p: Iri): Term | null {
    return this.g.objects(s, p)[0] ?? null;
  }
  /** The first value of a property that names one of `of`'s IRIs, decoded. */
  firstOf<T>(s: Iri, p: Iri, of: ReadonlyMap<string, T>): T | null {
    for (const o of this.g.objects(s, p)) {
      const v = o.kind === "iri" ? of.get(o.iri) : undefined;
      if (v !== undefined) return v;
    }
    return null;
  }
  /** Every value of a property that names one of `of`'s IRIs, decoded, in the order read. */
  allOf<T>(s: Iri, p: Iri, of: ReadonlyMap<string, T>): T[] {
    return this.g.objects(s, p).flatMap((o) => {
      const v = o.kind === "iri" ? of.get(o.iri) : undefined;
      return v === undefined ? [] : [v];
    });
  }
  has(s: Iri, p: Iri, o: Iri): boolean {
    return this.g.objects(s, p).some((t) => t.kind === "iri" && t.iri === o);
  }
  ident(s: Iri): string {
    const id = this.one(s, DCTERMS_IDENTIFIER);
    return given(id) ? id : s.slice(s.lastIndexOf("/") + 1);
  }
}

const lookup = <T>(m: ReadonlyMap<string, T>, t: Term | null): T | undefined => (t !== null && t.kind === "iri" ? m.get(t.iri) : undefined);

type DraftFamily = Omit<Family, "status" | "assurance"> & { readonly status: SupportStatus | null; readonly assurance: Assurance | null };
type DraftManager = Omit<Manager, "kind" | "commands"> & { readonly kind: ManagerKind | null; readonly commands: Map<Op, Command> };
type DraftPin = Omit<Pin, "sha256"> & { readonly sha256: Map<PlatformName, string> };
type DraftProgram = Omit<Program, "names"> & { readonly names: Map<FamilyId, string> };

/** The table the ontology makes, or every rule it breaks, in the order the Python generator named them. */
export function decode(g: Graph): Result<Table, Finding[]> {
  const r = new Reader(g);
  const bad: Finding[] = [];
  const split = (subject: Iri, text: string): string[] => {
    const w = words(text);
    if (w.ok) return w.value;
    bad.push({ kind: "not-words", subject, text, why: w.error });
    return [];
  };
  // 0002-packaging FR-001: every term of the vocabulary is defined, and every class labelled
  for (const kind of ["Class", "DatatypeProperty", "ObjectProperty"]) {
    for (const term of r.all(iri(`${OWL}${kind}`))) {
      if (!term.startsWith(PM)) continue;
      if (!given(r.one(term, SKOS_DEFINITION))) bad.push({ kind: "term-undefined", term: term.slice(PM.length) });
      if (kind === "Class" && !given(r.one(term, RDFS_LABEL))) bad.push({ kind: "class-unlabelled", term: term.slice(PM.length) });
    }
  }
  const text = (s: Iri, p: string): string => r.one(s, pm(p)) ?? "";

  const managers = new Map<ManagerId, DraftManager>();
  const managerOf = new Map<string, ManagerId>();
  for (const m of r.all(pm("PackageManager"))) {
    const id = brand<"ManagerId">(r.ident(m));
    managerOf.set(m, id);
    if (managers.has(id)) bad.push({ kind: "manager-twice", manager: id });
    const kinds = r.allOf(m, pm("kind"), KIND);
    const exe = r.one(m, pm("executable"));
    if (!given(exe)) bad.push({ kind: "manager-no-executable", manager: id });
    if (kinds.length !== 1) bad.push({ kind: "manager-kinds", manager: id });
    managers.set(id, {
      executable: exe ?? "",
      kind: kinds[0] ?? null,
      administrator: r.one(m, pm("needsAdministrator")) === "true",
      environment: text(m, "environment"),
      purlType: text(m, "purlType"),
      harnessUse: text(m, "harnessUse"),
      commands: new Map(),
      note: text(m, "note"),
    });
  }

  const prohibitions: Prohibition[] = [];
  for (const p of r.all(pm("Prohibition"))) {
    const owner = lookup(managerOf, r.first(p, pm("prohibitionOf")));
    const t = r.one(p, pm("forbiddenTemplate"));
    const why = r.one(p, SKOS_DEFINITION);
    if (owner === undefined || !given(t) || !given(why)) {
      bad.push({ kind: "prohibition-incomplete", subject: p });
      continue;
    }
    prohibitions.push({ manager: owner, template: t, argv: split(p, t), reason: why });
  }
  const forbidden = new Set(prohibitions.map((p) => `${p.manager}\0${p.template}`));
  for (const c of r.all(pm("Command"))) {
    const id = lookup(managerOf, r.first(c, pm("commandOf")));
    const op = r.firstOf(c, pm("operation"), OP_OF);
    const t = r.one(c, pm("template"));
    const manager = id === undefined ? undefined : managers.get(id);
    if (id === undefined || manager === undefined || op === null || !given(t)) {
      bad.push({ kind: "command-incomplete", subject: c });
      continue;
    }
    const ni = r.one(c, pm("nonInteractive"));
    const forms: readonly (readonly [Form, string | null])[] = [["template", t], ["non-interactive form", ni]];
    for (const [form, said] of forms) {
      if (said === null) continue;
      if (SHELL_SYNTAX.test(said)) bad.push({ kind: "shell-syntax", manager: id, op, form });
      if (forbidden.has(`${id}\0${said}`)) bad.push({ kind: "forbidden", manager: id, op, form, text: said });
    }
    if (manager.commands.has(op)) bad.push({ kind: "command-twice", manager: id, op });
    manager.commands.set(op, { argv: split(c, t), noninteractive: given(ni) ? split(c, ni) : null, origin: text(c, "origin"), verified: text(c, "verifiedOn") });
  }

  const families = new Map<FamilyId, DraftFamily>();
  const familyOf = new Map<string, FamilyId>();
  const seenIds = new Map<string, FamilyId>();
  for (const f of r.all(pm("SystemFamily"))) {
    const id = brand<"FamilyId">(r.ident(f));
    familyOf.set(f, id);
    const detect = r.many(f, pm("detectedBy"));
    if (detect.length === 0) bad.push({ kind: "family-undetected", family: id });
    for (const d of detect) {
      const before = seenIds.get(d);
      if (before !== undefined && d !== "*") bad.push({ kind: "id-shared", id: d, first: before, second: id });
      seenIds.set(d, id);
    }
    const status: SupportStatus | null = r.has(f, pm("supportStatus"), pm("Supported")) ? "supported" : r.has(f, pm("supportStatus"), pm("Catalogued")) ? "catalogued" : null;
    const assurance = r.firstOf(f, pm("assurance"), ASSURANCE);
    if (status === null) bad.push({ kind: "family-no-status", family: id });
    if (assurance === null) bad.push({ kind: "family-no-assurance", family: id });
    const used = r.allOf(f, pm("usesManager"), managerOf);
    if (used.length !== g.objects(f, pm("usesManager")).length) bad.push({ kind: "family-unknown-manager", family: id });
    const label = r.one(f, RDFS_LABEL);
    families.set(id, {
      label: given(label) ? label : id,
      status,
      assurance,
      detect,
      detectSource: text(f, "detectSource"),
      uname: text(f, "unameName"),
      managers: used,
      preferred: r.firstOf(f, pm("preferredManager"), managerOf),
      installsPackages: r.one(f, pm("harnessInstallsPackages")) !== "false",
      removalHint: text(f, "removalHint"),
      adminInstall: text(f, "adminInstall"),
      verifiedOn: text(f, "verifiedOn"),
      note: text(f, "note"),
    });
  }

  const programs = new Map<ProgramName, DraftProgram>();
  const programOf = new Map<string, ProgramName>();
  for (const p of r.all(pm("Program"))) {
    const name = r.one(p, pm("programName"));
    const tier = r.firstOf(p, pm("tier"), TIER);
    if (!given(name) || tier === null) {
      bad.push({ kind: "program-incomplete", subject: p });
      continue;
    }
    const id = brand<"ProgramName">(name);
    programOf.set(p, id);
    const order = r.one(p, pm("order"));
    const digits = order !== null && /^[0-9]+$/.test(order);
    if (!digits) bad.push({ kind: "program-no-order", program: id });
    programs.set(id, { tier, order: digits ? Number.parseInt(order, 10) : 0, names: new Map() });
  }
  for (const n of r.all(pm("PackageName"))) {
    const prog = lookup(programOf, r.first(n, pm("forProgram")));
    const fam = lookup(familyOf, r.first(n, pm("forFamily")));
    const name = r.one(n, pm("name"));
    const program = prog === undefined ? undefined : programs.get(prog);
    if (program === undefined || fam === undefined || !given(name)) {
      bad.push({ kind: "package-name-incomplete", subject: n });
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
    if (install === undefined || install.noninteractive === null) bad.push({ kind: "install-interactive", family: id, manager: f.preferred });
    else if (install.origin !== "archon") bad.push({ kind: "install-not-harness", family: id, manager: f.preferred, origin: install.origin });
    if (f.adminInstall === "") bad.push({ kind: "no-admin-install", family: id });
    if (!m.commands.has("query-installed")) bad.push({ kind: "no-query-installed", family: id, manager: f.preferred });
    for (const [name, p] of sortedBy(programs, ([a], [b]) => compareText(a, b))) {
      if (p.tier === "required" && !p.names.has(id)) bad.push({ kind: "required-unnamed", program: name, family: id });
    }
  }
  for (const [name, p] of programs) {
    for (const fid of p.names.keys()) if (families.get(fid)?.status !== "supported") bad.push({ kind: "named-for-unsupported", program: name, family: fid });
  }

  const platforms = new Map<PlatformName, Platform>();
  const platformOf = new Map<string, PlatformName>();
  const suffixes = new Set<string>();
  for (const pl of r.all(pm("Platform"))) {
    const name = r.one(pl, pm("platformName"));
    const rec: Platform = { os: text(pl, "operatingSystem"), processor: text(pl, "processor"), suffix: text(pl, "pinSuffix"), label: r.one(pl, RDFS_LABEL) ?? "" };
    if (!given(name) || !Object.values(rec).every((v) => v !== "")) {
      bad.push({ kind: "platform-incomplete", subject: pl });
      continue;
    }
    if (suffixes.has(rec.suffix)) bad.push({ kind: "suffix-shared", suffix: rec.suffix });
    suffixes.add(rec.suffix);
    const id = brand<"PlatformName">(name);
    platformOf.set(pl, id);
    platforms.set(id, rec);
  }
  const pins = new Map<PinName, DraftPin>();
  const pinOf = new Map<string, PinName>();
  const keys = new Set<string>();
  for (const pn of r.all(pm("PinnedDownload"))) {
    const [name, key, version] = [r.one(pn, pm("programName")), r.one(pn, pm("pinKey")), r.one(pn, pm("version"))];
    if (!given(name) || !given(key) || !given(version)) {
      bad.push({ kind: "pin-incomplete", subject: pn });
      continue;
    }
    if (keys.has(key)) bad.push({ kind: "key-shared", key });
    keys.add(key);
    const id = brand<"PinName">(name);
    pinOf.set(pn, id);
    const label = r.one(pn, RDFS_LABEL);
    pins.set(id, { key, version, label: given(label) ? label : name, note: text(pn, "note"), sha256: new Map() });
  }
  for (const c of r.all(pm("Checksum"))) {
    const pin = lookup(pinOf, r.first(c, pm("forPin")));
    const platform = lookup(platformOf, r.first(c, pm("forPlatform")));
    const digest = r.one(c, pm("sha256"));
    const p = pin === undefined ? undefined : pins.get(pin);
    if (pin === undefined || p === undefined || platform === undefined || !given(digest)) {
      bad.push({ kind: "checksum-incomplete", subject: c });
      continue;
    }
    if (!HEX64.test(digest)) bad.push({ kind: "checksum-not-hex", pin, platform });
    if (p.sha256.has(platform)) bad.push({ kind: "checksum-twice", pin, platform });
    p.sha256.set(platform, digest);
  }

  const rules: Rule[] = [];
  for (const rule of r.all(pm("Rule"))) {
    const id = rule.slice(rule.lastIndexOf("rule-") < 0 ? 0 : rule.lastIndexOf("rule-") + "rule-".length);
    const [set, pattern, label, reason] = [r.one(rule, pm("ruleSet")), r.one(rule, pm("pattern")), r.one(rule, RDFS_LABEL), r.one(rule, SKOS_DEFINITION)];
    if (set === null || !isOneOf(RULE_SETS, set) || !given(pattern) || !given(label) || !given(reason)) {
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
  const orderOf = (f: Iri): number => integer(r.one(f, pm("order")) ?? "0") ?? 0;
  for (const f of sortedBy(g.subjects(RDF_TYPE, pm("RecordField")), (a, b) => orderOf(a) - orderOf(b))) {
    const [name, type, order, definition] = [r.one(f, pm("fieldName")), r.one(f, pm("fieldType")), r.one(f, pm("order")), r.one(f, SKOS_DEFINITION)];
    const n = order === null ? null : integer(order);
    if (!given(name) || type === null || !isOneOf(FIELD_TYPES, type) || !given(order) || n === null || !given(definition)) {
      bad.push({ kind: "field-incomplete", subject: f });
      continue;
    }
    if (record.some((x) => x.name === name || x.order === n)) bad.push({ kind: "field-repeated", field: name });
    record.push({ name, type, order: n, definition, values: r.many(f, pm("allowedValue")) });
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
