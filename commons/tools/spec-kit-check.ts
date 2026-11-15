// Check a spec-kit folder against the format every Intellectual Frontiers harness keeps (commons 0003-spec-kit).
//
//     deno run --no-config --allow-read commons/tools/spec-kit-check.ts               check commons/spec-kit
//     deno run --no-config --allow-read commons/tools/spec-kit-check.ts --root DIR    check DIR (a folder holding registry.tsv, enforcement.tsv and specs/)
//
// It imports nothing outside commons/tools, so any harness can run it from a checkout with read access alone, and a harness that wants the findings as data imports `check(root)`.
// It checks the register of numbers, the form of each specification, that edge cases cite requirements that exist, and that the enforcement register has one well-formed row for every
// requirement. It does not read a harness's ontology: who owns a specification, and what a command is, are the harness's to check. Its regular expressions keep the meaning of
// Python's, which the tool was first written in: `\w`, `\d` and `\s` are Unicode's, and `^` and `$` of a line break only at `\n`.
import { assertNever, compareText, firstChars, isKind, isOneOf, pathOfUrl, PY_SPACE, readText, sortedText, splitLines, writeAll } from "./core.ts";

const SECTIONS = [
  "**Input:**",
  "## Out of scope",
  "## Edge cases",
  "## Assumptions",
  "## Open questions",
  "## Key entities",
  "## Success criteria",
  "## Review & acceptance checklist",
] as const;
type Section = (typeof SECTIONS)[number];
const OPTIONAL: ReadonlySet<Section> = new Set(["## Out of scope"]);
const STATUSES = ["Draft", "Adopted", "Superseded"] as const;
const MECHANISMS = ["check", "gate", "review", "none"] as const;
type Mechanism = (typeof MECHANISMS)[number];
const REGISTRY_HEADER = "number\tslug\tstate";
const STATES = ["in force", "retired"] as const;
type State = (typeof STATES)[number];

// Python's classes, for a `str` pattern: \w, \s and \d are Unicode's.
const W = "[\\p{L}\\p{N}_]";
const SPACE = PY_SPACE;
const S = `[${SPACE}]`;
const NS = `[^${SPACE}]`;
const D = "\\p{Nd}";
/** `^` and `$` of Python's multiline mode: only `\n` breaks a line. */
const BOL = "(?<=^|\\n)";
const EOL = "(?=\\n|$)";
const SLUG = "[a-z][a-z0-9]*(?:-[a-z0-9]+)*";
const rx = (source: string, flags = ""): RegExp => new RegExp(source, `u${flags}`);

const FOLDER = rx(`^(${D}{4,})-(${SLUG})\\n?$`);
const ITEM = rx(`${BOL}- \\*\\*(FR-${D}{3}|SC-${D}{3}|OQ-${D}+)\\*\\*`, "g");
const ROW_COMMAND = rx(`^[A-Za-z0-9_.-]+: ${NS}[^\\n]*\\n?$`);
const NUMBER = rx(`^${D}{4,}$`);
const SLUG_ONLY = rx(`^${SLUG}$`);
const FR = rx(`FR-${D}{3}`, "g");
/** A specification of another repository, `<repo> NNNN-slug`, which the search for bare numbers leaves out (Python's `\b`, Unicode's). */
const QUALIFIED = rx(`(?:(?<=${W})(?!${W})|(?<!${W})(?=${W}))[A-Za-z0-9_.-]+ ${D}{4}-[a-z][a-z0-9-]*`, "g");
const BARE = rx(`(?<![\\p{L}\\p{N}_-])(?<!${W} )(${D}{4}-[a-z][a-z0-9]*(?:-[a-z0-9]+)*)`, "g");

/** What is wrong, and where: the place is a file of the folder, a line of it, or a specification's folder. */
export type Problem =
  | { readonly kind: "registry-missing" }
  | { readonly kind: "registry-header" }
  | { readonly kind: "registry-row" }
  | { readonly kind: "number-twice"; readonly number: string; readonly line: number }
  | { readonly kind: "in-force-missing"; readonly spec: string }
  | { readonly kind: "retired-present"; readonly spec: string }
  | { readonly kind: "gap"; readonly number: number }
  | { readonly kind: "folder-name" }
  | { readonly kind: "not-registered" }
  | { readonly kind: "spec-missing" }
  | { readonly kind: "title" }
  | { readonly kind: "no-line"; readonly label: "Spec ID" | "Owner" | "Domain"; readonly spec: string }
  | { readonly kind: "status" }
  | { readonly kind: "no-section"; readonly section: Section }
  | { readonly kind: "section-order" }
  | { readonly kind: "item-twice" }
  | { readonly kind: "requirement-order" }
  | { readonly kind: "edge-cites-nothing"; readonly item: string }
  | { readonly kind: "edge-cites-unknown"; readonly item: string }
  | { readonly kind: "bare-citation"; readonly cite: string }
  | { readonly kind: "enforcement-missing" }
  | { readonly kind: "row-shape" }
  | { readonly kind: "row-twice"; readonly requirement: string; readonly line: number }
  | { readonly kind: "row-unknown"; readonly requirement: string }
  | { readonly kind: "mechanism"; readonly requirement: string }
  | { readonly kind: "row-command"; readonly requirement: string }
  | { readonly kind: "row-none"; readonly requirement: string }
  | { readonly kind: "row-review"; readonly requirement: string }
  | { readonly kind: "row-missing"; readonly requirement: string };

export type Finding = { readonly where: string; readonly problem: Problem };

/** The sentence a finding is printed with (the Python tool's, word for word: a harness reads them). */
export function message(p: Problem): string {
  switch (p.kind) {
    case "registry-missing":
      return "the register of specification numbers is missing";
    case "registry-header":
      return "the header must be 'number\\tslug\\tstate'";
    case "registry-row":
      return "a row is a number of four or more digits, a slug and one of ['in force', 'retired']";
    case "number-twice":
      return `number ${p.number} is assigned twice, also on line ${p.line}`;
    case "in-force-missing":
      return `${p.spec} is in force but its specification does not exist`;
    case "retired-present":
      return `${p.spec} is retired but still exists`;
    case "gap":
      return `the sequence has a gap at ${String(p.number).padStart(4, "0")}; a number is never skipped`;
    case "folder-name":
      return "a spec folder is named NNNN-slug";
    case "not-registered":
      return "has no row in registry.tsv";
    case "spec-missing":
      return "spec.md is missing";
    case "title":
      return "must begin with '# Feature Specification: <title>'";
    case "no-line":
      return `has no **${p.label}:** line${p.label === "Spec ID" ? ` naming ${p.spec}` : ""}`;
    case "status":
      return "**Status:** must be one of ['Draft', 'Adopted', 'Superseded']";
    case "no-section":
      return `has no ${p.section} section`;
    case "section-order":
      return `its sections are out of the order ${SECTIONS.join(", ")}`;
    case "item-twice":
      return "a requirement, criterion or question number is used twice";
    case "requirement-order":
      return "requirement numbers are out of order";
    case "edge-cites-nothing":
      return `an edge case cites no requirement: ${p.item}`;
    case "edge-cites-unknown":
      return `an edge case cites a requirement that is not here: ${p.item}`;
    case "bare-citation":
      return `cites ${p.cite}, which is not a specification here; name the repository before the number of another's (for example \`archon 0002-specs\`)`;
    case "enforcement-missing":
      return "the enforcement register is missing";
    case "row-shape":
      return "a row is a requirement, a mechanism, who enforces it and a note";
    case "row-twice":
      return `${p.requirement} has two rows, also on line ${p.line}`;
    case "row-unknown":
      return `${p.requirement} is not a requirement of any specification here`;
    case "mechanism":
      return `${p.requirement}: the mechanism must be one of ['check', 'gate', 'review', 'none']`;
    case "row-command":
      return `${p.requirement}: who enforces it is '<repository>: <command>'`;
    case "row-none":
      return `${p.requirement}: a requirement nothing enforces has '-' for who and says why in the note`;
    case "row-review":
      return `${p.requirement}: a review names the requirement that defines it`;
    case "row-missing":
      return `${p.requirement} has no row`;
    default:
      return assertNever(p);
  }
}

type Row = { readonly line: number; readonly number: string; readonly slug: string; readonly state: State };

const strip = (s: string): string => s.replace(rx(`^${S}+|${S}+$`, "g"), "");
const escape = (s: string): string => s.replace(/[\\^$.*+?()[\]{}|\/]/g, "\\$&");
const search = (source: string, text: string): RegExpExecArray | null => rx(source).exec(text);

/** The value of a number of decimal digits, of any script, as Python's `int()` reads it. */
function digitsValue(digits: string): number {
  const nd = rx(`^${D}$`);
  let n = 0;
  for (const ch of digits) {
    let start = ch.codePointAt(0) ?? 0;
    while (start > 0 && nd.test(String.fromCodePoint(start - 1))) start--;
    n = n * 10 + (((ch.codePointAt(0) ?? 0) - start) % 10);
  }
  return n;
}

function registry(root: string): { rows: Row[]; found: Finding[] } {
  const path = `${root}/registry.tsv`;
  if (!isKind(path, "file")) return { rows: [], found: [{ where: "registry.tsv", problem: { kind: "registry-missing" } }] };
  const lines = splitLines(readText(path));
  const found: Finding[] = [];
  if (lines[0] !== REGISTRY_HEADER) found.push({ where: "registry.tsv:1", problem: { kind: "registry-header" } });
  const rows: Row[] = [];
  lines.slice(1).forEach((line, i) => {
    const [number, slug, state, ...rest] = line.split("\t");
    if (number === undefined || slug === undefined || state === undefined || rest.length > 0 || !NUMBER.test(number) || !isOneOf(STATES, state) || !SLUG_ONLY.test(slug)) {
      found.push({ where: `registry.tsv:${i + 2}`, problem: { kind: "registry-row" } });
      return;
    }
    rows.push({ line: i + 2, number, slug, state });
  });
  return { rows, found };
}

const requirementsOf = (ids: readonly string[]): string[] => ids.filter((m) => m.startsWith("FR-"));
const items = (text: string): string[] => [...text.matchAll(ITEM)].map((m) => m[1] ?? "");

/** Every finding of the folder at `root`, in the order the tool prints them. */
export function check(root: string): Finding[] {
  const found: Finding[] = [];
  const { rows, found: bad } = registry(root);
  found.push(...bad);
  const folder = `${root}/specs`;
  const present = new Map<string, string>();
  if (isKind(folder, "dir")) {
    for (const name of sortedText([...Deno.readDirSync(folder)].map((e) => e.name))) if (isKind(`${folder}/${name}`, "dir")) present.set(name, `${folder}/${name}`);
  }
  const seen = new Map<number, number>();
  for (const { line, number, slug, state } of rows) {
    const k = digitsValue(number);
    const before = seen.get(k);
    if (before !== undefined) {
      found.push({ where: `registry.tsv:${line}`, problem: { kind: "number-twice", number, line: before } });
      continue;
    }
    seen.set(k, line);
    const spec = `${number}-${slug}`;
    switch (state) {
      case "in force":
        if (!present.has(spec)) found.push({ where: `registry.tsv:${line}`, problem: { kind: "in-force-missing", spec } });
        break;
      case "retired":
        if (present.has(spec)) found.push({ where: `registry.tsv:${line}`, problem: { kind: "retired-present", spec } });
        break;
      default:
        assertNever(state);
    }
  }
  const highest = Math.max(0, ...seen.keys());
  for (let k = 1; k <= highest; k++) if (!seen.has(k)) found.push({ where: "registry.tsv", problem: { kind: "gap", number: k } });
  const registered = new Set(rows.map((r) => `${r.number}-${r.slug}`));
  const requirements = new Map<string, string[]>();
  for (const [name, dir] of present) {
    const where = `specs/${name}`;
    if (!FOLDER.test(name)) {
      found.push({ where, problem: { kind: "folder-name" } });
      continue;
    }
    if (!registered.has(name)) found.push({ where, problem: { kind: "not-registered" } });
    const spec = `${dir}/spec.md`;
    if (!isKind(spec, "file")) {
      found.push({ where, problem: { kind: "spec-missing" } });
      continue;
    }
    found.push(...specFindings(name, readText(spec), present, requirements));
  }
  found.push(...enforcement(root, requirements));
  return found;
}

function specFindings(name: string, text: string, present: ReadonlyMap<string, string>, requirements: Map<string, string[]>): Finding[] {
  const where = `specs/${name}`;
  const found: Finding[] = [];
  const add = (problem: Problem): void => void found.push({ where, problem });
  if (!text.startsWith("# Feature Specification: ")) add({ kind: "title" });
  const lines = [
    ["Spec ID", `${BOL}\\*\\*Spec ID:\\*\\*${S}*${escape(name)}${S}*${EOL}`],
    ["Owner", `${BOL}\\*\\*Owner:\\*\\*${S}*${NS}`],
    ["Domain", `${BOL}\\*\\*Domain:\\*\\*${S}*${NS}`],
  ] as const;
  for (const [label, source] of lines) if (search(source, text) === null) add({ kind: "no-line", label, spec: name });
  const status = search(`${BOL}\\*\\*Status:\\*\\*${S}*([^\\n]+?)${S}*${EOL}`, text);
  if (status === null || !isOneOf(STATUSES, status[1] ?? "")) add({ kind: "status" });
  const at = SECTIONS.map((h) => [search(`${BOL}${escape(h)}`, text)?.index ?? -1, h] as const);
  for (const [pos, h] of at) if (pos < 0 && !OPTIONAL.has(h)) add({ kind: "no-section", section: h });
  const order = at.map(([p]) => p).filter((p) => p >= 0);
  if (order.some((p, i) => i > 0 && p < (order[i - 1] ?? p))) add({ kind: "section-order" });
  const ids = items(text);
  if (ids.length !== new Set(ids).size) add({ kind: "item-twice" });
  const frs = requirementsOf(ids);
  requirements.set(name, frs);
  if (frs.some((r, i) => i > 0 && compareText(r, frs[i - 1] ?? r) < 0)) add({ kind: "requirement-order" });
  const edge = search(`${BOL}## Edge cases`, text);
  const assume = search(`${BOL}## Assumptions`, text);
  if (edge !== null && assume !== null && edge.index + edge[0].length < assume.index) {
    const block = strip(text.slice(edge.index + edge[0].length, assume.index));
    for (const b of block.split(/\n(?=- )/)) {
      if (!strip(b).startsWith("-")) continue;
      const item = b.replaceAll("\n  ", " ");
      const cited = [...item.matchAll(FR)].map((m) => m[0]);
      if (cited.length === 0) add({ kind: "edge-cites-nothing", item: firstChars(item, 60) });
      else if (!cited.every((c) => frs.includes(c))) add({ kind: "edge-cites-unknown", item: firstChars(item, 60) });
    }
  }
  // a specification of another repository is cited as `<repo> NNNN-slug`; a bare one is in this folder
  const bare = new Set([...text.replace(QUALIFIED, "").matchAll(BARE)].map((m) => m[1] ?? ""));
  for (const cite of sortedText(bare)) if (!present.has(cite)) add({ kind: "bare-citation", cite });
  return found;
}

function enforcement(root: string, requirements: ReadonlyMap<string, readonly string[]>): Finding[] {
  const path = `${root}/enforcement.tsv`;
  if (!isKind(path, "file")) return [{ where: "enforcement.tsv", problem: { kind: "enforcement-missing" } }];
  const found: Finding[] = [];
  const want = new Set([...requirements].flatMap(([spec, frs]) => frs.map((fr) => `${spec} ${fr}`)));
  const have = new Map<string, number>();
  splitLines(readText(path)).forEach((line, i) => {
    const n = i + 1;
    if (line === "" || line.startsWith("#") || line.startsWith("requirement\t")) return;
    const where = `enforcement.tsv:${n}`;
    const add = (problem: Problem): void => void found.push({ where, problem });
    const [requirement, mech, by, note, ...rest] = line.split("\t");
    if (requirement === undefined || mech === undefined || by === undefined || note === undefined || rest.length > 0) {
      add({ kind: "row-shape" });
      return;
    }
    const before = have.get(requirement);
    if (before !== undefined) add({ kind: "row-twice", requirement, line: before });
    have.set(requirement, n);
    if (!want.has(requirement)) add({ kind: "row-unknown", requirement });
    if (!isOneOf(MECHANISMS, mech)) {
      add({ kind: "mechanism", requirement });
      return;
    }
    switch (mech) {
      case "check":
      case "gate":
        if (!ROW_COMMAND.test(by)) add({ kind: "row-command", requirement });
        break;
      case "none":
        if (by !== "-" || strip(note) === "") add({ kind: "row-none", requirement });
        break;
      case "review":
        if (!want.has(by)) add({ kind: "row-review", requirement });
        break;
      default:
        assertNever(mech);
    }
  });
  for (const requirement of sortedText([...want].filter((r) => !have.has(r)))) found.push({ where: "enforcement.tsv", problem: { kind: "row-missing", requirement } });
  return found;
}

/** The command line: `--root DIR`, or commons' own folder; every finding on standard error as `where: message`; exit 1 where there is one. */
export function main(argv: readonly string[]): number {
  const i = argv.indexOf("--root");
  let root = pathOfUrl(new URL("../spec-kit", import.meta.url));
  if (i >= 0) {
    const given = argv[i + 1];
    if (given === undefined) {
      writeAll(Deno.stderr, "spec-kit-check: --root needs a folder\n");
      return 1;
    }
    root = given;
  }
  const found = check(root);
  writeAll(Deno.stderr, found.map((f) => `${f.where}: ${message(f.problem)}\n`).join(""));
  return found.length > 0 ? 1 : 0;
}

if (import.meta.main) Deno.exit(main(Deno.args));
