/**
 * The spec kits read for the site (commons 0011-documentation FR-015, FR-024), in either of their two layouts. Commons' layout: the
 * register of numbers, the register of what enforces each requirement, and each specification in force with its header (title, status,
 * owner, domain, part), its `**Input:**` line, its requirements, success criteria and open questions, and its text; it reads what
 * `commons/tools/spec-kit-check.ts` checks, and assumes the folder passes that check. The plain layout of Spec Kit: every folder of the
 * specifications that holds a `spec.md`, its title, status and input where it has them, its requirements in either form
 * (`- **FR-001** text` or `- **FR-001**: text`), the `reviewed.tsv` beside it, and the constitution.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/ifc-ts/runtime";
import type { Finding } from "../check.ts";
import { type SpecKitSource, under } from "../config.ts";

/** How a requirement is enforced, as `enforcement.tsv` says, or `review` where a `reviewed.tsv` gives its reason. */
export type Mechanism = "check" | "gate" | "review" | "none";

/** A row of `enforcement.tsv`, or of a `reviewed.tsv`. */
export interface Enforcement {
  /** The requirement, as `0009-sql-aide FR-001`. */
  readonly requirement: string;
  /** How. */
  readonly mechanism: Mechanism;
  /** Who: `<repository>: <command>`, a requirement that defines the review, or `-`. */
  readonly by: string;
  /** The note, or the reason of a review. */
  readonly note: string;
}

/** A numbered item of a specification: a requirement, a success criterion or an open question, and its text. */
export interface SpecItem {
  /** `FR-001`, `SC-001` or `OQ-1`. */
  readonly id: string;
  /** Its text, after the number, as Markdown. */
  readonly text: string;
}

/** The layout a specification was read in. */
export type Layout = SpecKitSource["layout"];

/** A specification in force. */
export interface Spec {
  /** Its folder's name: `0009-sql-aide`. */
  readonly id: string;
  /** Its `spec.md`, from the root. */
  readonly file: string;
  /** The layout of its spec kit. */
  readonly layout: Layout;
  /** Its title, after `# Feature Specification: ` (or, in the plain layout, after `# NNN: `). */
  readonly title: string;
  /** `Draft`, `Adopted`, `Superseded`, or what a plain specification says; empty where it says nothing. */
  readonly status: string;
  /** Its owner, where it says. */
  readonly owner: string;
  /** Its domain, where it says. */
  readonly domain: string;
  /** The specification it is part of, where it says. */
  readonly partOf?: string;
  /** Its `**Input:**` line, as Markdown; empty where it has none. */
  readonly input: string;
  /** Its text after the header and the input, as Markdown. */
  readonly body: string;
  /** Its requirements, in order. */
  readonly requirements: readonly SpecItem[];
}

/** Where a spec kit's specifications come from, as the register and the matrix say it. */
export interface KitSource {
  /** Its layout. */
  readonly layout: Layout;
  /** Its folder, from the root. */
  readonly dir: string;
}

/** A constitution: its file, its title and its text after the title. */
export interface Constitution {
  /** Its file, from the root. */
  readonly file: string;
  /** Its title, from its first heading. */
  readonly title: string;
  /** Its text after the title, as Markdown. */
  readonly body: string;
}

/** The spec kits: their specifications in force, in order, the enforcement of each requirement, where they come from, and a constitution. */
export interface SpecKit {
  /** The specifications in force. */
  readonly specs: readonly Spec[];
  /** The rows of `enforcement.tsv` and of every `reviewed.tsv`, by requirement. */
  readonly enforcement: ReadonlyMap<string, Enforcement>;
  /** The kits read, in order. */
  readonly sources: readonly KitSource[];
  /** The constitution of a plain kit, where it has one. */
  readonly constitution?: Constitution;
}

/** One spec kit read: its specifications, its enforcement, and its constitution where it has one. */
export interface KitRead {
  /** The specifications in force, in order. */
  readonly specs: readonly Spec[];
  /** The rows of its enforcement, by requirement. */
  readonly enforcement: ReadonlyMap<string, Enforcement>;
  /** Its constitution. */
  readonly constitution?: Constitution;
}

const MECHANISMS: readonly Mechanism[] = ["check", "gate", "review", "none"];
const isMechanism = (s: string): s is Mechanism => MECHANISMS.some((m) => m === s);

/** The value of a header line, `**Label:** value`. */
function header(text: string, label: string): string | undefined {
  const m = new RegExp(`^\\*\\*${label}:\\*\\*[ \\t]*(.*?)[ \\t]*$`, "m").exec(text);
  return m?.[1];
}

/** The requirements of a specification's text: `- **FR-001**: text` or `- **FR-001** text`, on one line or more. */
export function requirementsOf(body: string): SpecItem[] {
  return [...body.matchAll(/^- \*\*(FR-\d{3}[a-z]?)\*\*:?[ \t]*([\s\S]*?)(?=\n- |\n\n|\n#|(?![\s\S]))/gm)].map((m) => ({
    id: m[1] ?? "",
    text: (m[2] ?? "").replace(/\n\s+/g, " ").trim(),
  }));
}

/**
 * A specification of commons' layout read into its parts.
 *
 * @param id - its folder's name
 * @param text - the text of its `spec.md`
 * @param file - its `spec.md`, from the root
 */
export function parseSpec(id: string, text: string, file = `${id}/spec.md`): Spec {
  const title = /^# Feature Specification: (.*)$/m.exec(text)?.[1]?.trim() ?? id;
  const inputAt = text.search(/^\*\*Input:\*\*/m);
  const afterInput = inputAt < 0 ? -1 : text.indexOf("\n\n", inputAt);
  const input = inputAt < 0 ? "" : text.slice(inputAt, afterInput < 0 ? text.length : afterInput).replace(/^\*\*Input:\*\*\s*/, "").trim();
  const body = afterInput < 0 ? "" : text.slice(afterInput).trim();
  const partOf = header(text, "Part of");
  return {
    id,
    file,
    layout: "commons",
    title,
    status: header(text, "Status") ?? "",
    owner: header(text, "Owner") ?? "",
    domain: header(text, "Domain") ?? "",
    ...(partOf === undefined ? {} : { partOf }),
    input,
    body,
    requirements: requirementsOf(body),
  };
}

/** The value after a bold label in a header paragraph (`**Status**: Implemented`, `**Status:** Draft`), up to the next label. */
function field(para: string, label: string): string | undefined {
  const m = new RegExp(`\\*\\*${label}(?:\\*\\*:|:\\*\\*)\\s*([\\s\\S]*?)\\s*(?=\\*\\*[A-Z][\\w ]*(?:\\*\\*:|:\\*\\*)|$)`).exec(para);
  return m?.[1]?.replace(/\s+/g, " ").trim();
}

/**
 * A specification of the plain layout of Spec Kit read into its parts: the title from its first heading, the status and input of the
 * header paragraph where it has one, and its requirements in either form.
 *
 * @param id - its folder's name
 * @param text - the text of its `spec.md`
 * @param file - its `spec.md`, from the root
 */
export function parsePlainSpec(id: string, text: string, file = `${id}/spec.md`): Spec {
  const heading = /^# (.*)$/m.exec(text);
  const title = (heading?.[1] ?? id).replace(/^Feature Specification:\s*/, "").replace(/^\d+:\s*/, "").trim();
  const rest = heading === null ? text : text.slice(heading.index + heading[0].length);
  const firstSection = rest.search(/^## /m);
  const lead = firstSection < 0 ? rest : rest.slice(0, firstSection);
  const paras = lead.split(/\n\s*\n/);
  const headerAt = paras.findIndex((p) => /\*\*(?:Status|Input)(?:\*\*:|:\*\*)/.test(p));
  const para = headerAt < 0 ? "" : paras[headerAt] ?? "";
  const body = (headerAt < 0 ? rest : [...paras.slice(0, headerAt), ...paras.slice(headerAt + 1)].join("\n\n") + (firstSection < 0 ? "" : `\n\n${rest.slice(firstSection)}`)).trim();
  const status = field(para, "Status")?.replace(/[.;,]$/, "") ?? "";
  return {
    id,
    file,
    layout: "spec-kit",
    title,
    status: /^[A-Za-z][\w -]{0,40}$/.test(status) ? status : "",
    owner: "",
    domain: "",
    input: field(para, "Input") ?? "",
    body,
    requirements: requirementsOf(body),
  };
}

/**
 * The rows of `enforcement.tsv`.
 *
 * @param text - its text
 */
export function parseEnforcement(text: string): Map<string, Enforcement> {
  const out = new Map<string, Enforcement>();
  for (const line of text.split("\n")) {
    if (line === "" || line.startsWith("#") || line.startsWith("requirement\t")) continue;
    const [requirement, mechanism, by, note] = line.split("\t");
    if (requirement === undefined || mechanism === undefined || !isMechanism(mechanism)) continue;
    out.set(requirement, { requirement, mechanism, by: by ?? "-", note: note ?? "" });
  }
  return out;
}

/**
 * The rows of a `reviewed.tsv`: a requirement (`FR-003`, or `096-bun-runtime FR-003`), a tab and the reason it is proven by review.
 *
 * @param id - the specification beside which it is
 * @param text - its text
 */
export function parseReviewed(id: string, text: string): Map<string, Enforcement> {
  const out = new Map<string, Enforcement>();
  for (const line of text.split("\n")) {
    if (line.trim() === "" || line.startsWith("#")) continue;
    const [first = "", ...rest] = line.split("\t");
    const fr = /(?:^|\s)(FR-\d{3}[a-z]?)$/.exec(first.trim())?.[1];
    const spec = first.trim().includes(" ") ? first.trim().split(/\s+/)[0] : id;
    if (fr === undefined || spec !== id) continue;
    const requirement = `${id} ${fr}`;
    out.set(requirement, { requirement, mechanism: "review", by: "-", note: rest.join("\t").trim() });
  }
  return out;
}

/**
 * A spec kit of commons' layout: its specifications in force, in the register's order, and its enforcement.
 *
 * @param root - the repository's root
 * @param dir - the kit's folder, from the root (`commons/spec-kit`)
 */
export function readCommonsKit(root: string, dir: string): KitRead {
  const abs = path.join(root, dir);
  const specs: Spec[] = [];
  for (const line of fs.readTextFileSync(path.join(abs, "registry.tsv")).split("\n").slice(1)) {
    const [number, slug, state] = line.split("\t");
    if (number === undefined || slug === undefined || state !== "in force") continue;
    const id = `${number}-${slug}`;
    const file = under(dir, `specs/${id}/spec.md`);
    specs.push(parseSpec(id, fs.readTextFileSync(path.join(root, file)), file));
  }
  return { specs, enforcement: parseEnforcement(fs.readTextFileSync(path.join(abs, "enforcement.tsv"))) };
}

/**
 * A spec kit of the plain layout: every folder `NNN-slug/` of the folder that holds a `spec.md`, in the order of their names, the rows of
 * the `reviewed.tsv` beside each, and the constitution where it exists.
 *
 * @param root - the repository's root
 * @param dir - the folder of the specifications, from the root (`specs`)
 * @param constitution - the constitution, from the root, where there is one
 */
export function readPlainKit(root: string, dir: string, constitution: string | undefined): KitRead {
  const abs = path.join(root, dir);
  const specs: Spec[] = [];
  const enforcement = new Map<string, Enforcement>();
  const names = fs.existsSync(abs) ? [...fs.readDirSync(abs)].filter((e) => e.isDirectory && /^\d+-[a-z]/.test(e.name)).map((e) => e.name).sort() : [];
  for (const id of names) {
    const file = under(dir, `${id}/spec.md`);
    if (!fs.existsSync(path.join(root, file))) continue;
    specs.push(parsePlainSpec(id, fs.readTextFileSync(path.join(root, file)), file));
    const reviewed = path.join(root, under(dir, `${id}/reviewed.tsv`));
    if (fs.existsSync(reviewed)) for (const [k, v] of parseReviewed(id, fs.readTextFileSync(reviewed))) enforcement.set(k, v);
  }
  if (constitution === undefined || !fs.existsSync(path.join(root, constitution))) return { specs, enforcement };
  const text = fs.readTextFileSync(path.join(root, constitution));
  const heading = /^# (.*)$/m.exec(text);
  const title = heading?.[1]?.trim() ?? "Constitution";
  const body = (heading === null ? text : text.slice(heading.index + heading[0].length)).trim();
  return { specs, enforcement, constitution: { file: constitution, title, body } };
}

/**
 * The spec kits of a configuration, read and merged in order; a specification a kit before already holds is a finding, and is left out.
 *
 * @param root - the repository's root
 * @param kits - the kits
 * @param found - where findings go
 */
export function readSpecKits(root: string, kits: readonly SpecKitSource[], found: Finding[] = []): SpecKit {
  const specs: Spec[] = [];
  const enforcement = new Map<string, Enforcement>();
  let constitution: Constitution | undefined;
  for (const k of kits) {
    const read: KitRead = k.layout === "commons" ? readCommonsKit(root, k.dir) : readPlainKit(root, k.dir, k.constitution);
    for (const s of read.specs) {
      if (specs.some((x) => x.id === s.id)) found.push({ where: s.file, problem: { kind: "duplicate-spec", id: s.id } });
      else specs.push(s);
    }
    for (const [key, v] of read.enforcement) if (!enforcement.has(key)) enforcement.set(key, v);
    if (constitution === undefined) constitution = read.constitution;
  }
  const sources = kits.map((k) => ({ layout: k.layout, dir: k.dir }));
  return constitution === undefined ? { specs, enforcement, sources } : { specs, enforcement, sources, constitution };
}

