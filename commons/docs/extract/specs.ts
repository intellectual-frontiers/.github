/**
 * The spec kit read for the site (commons 0011-documentation FR-015): the register of numbers, the register of what enforces each
 * requirement, and each specification in force with its header (title, status, owner, domain, part), its `**Input:**` line, its
 * requirements, success criteria and open questions, and its text. It reads what `commons/tools/spec-kit-check.ts` checks, and assumes
 * the folder passes that check.
 *
 * @module
 */
import { fs, path } from "../../ts/runtime/mod.ts";

/** How a requirement is enforced, as `enforcement.tsv` says. */
export type Mechanism = "check" | "gate" | "review" | "none";

/** A row of `enforcement.tsv`. */
export interface Enforcement {
  /** The requirement, as `0009-sql-aide FR-001`. */
  readonly requirement: string;
  /** How. */
  readonly mechanism: Mechanism;
  /** Who: `<repository>: <command>`, a requirement that defines the review, or `-`. */
  readonly by: string;
  /** The note. */
  readonly note: string;
}

/** A numbered item of a specification: a requirement, a success criterion or an open question, and its text. */
export interface SpecItem {
  /** `FR-001`, `SC-001` or `OQ-1`. */
  readonly id: string;
  /** Its text, after the number, as Markdown. */
  readonly text: string;
}

/** A specification in force. */
export interface Spec {
  /** Its folder's name: `0009-sql-aide`. */
  readonly id: string;
  /** Its title, after `# Feature Specification: `. */
  readonly title: string;
  /** `Draft`, `Adopted` or `Superseded`. */
  readonly status: string;
  /** Its owner. */
  readonly owner: string;
  /** Its domain. */
  readonly domain: string;
  /** The specification it is part of, where it says. */
  readonly partOf?: string;
  /** Its `**Input:**` line, as Markdown. */
  readonly input: string;
  /** Its text after the header and the input, as Markdown. */
  readonly body: string;
  /** Its requirements, in order. */
  readonly requirements: readonly SpecItem[];
}

/** The spec kit: its specifications in force, in the register's order, and the enforcement of each requirement. */
export interface SpecKit {
  /** The specifications in force. */
  readonly specs: readonly Spec[];
  /** The rows of `enforcement.tsv`, by requirement. */
  readonly enforcement: ReadonlyMap<string, Enforcement>;
}

const MECHANISMS: readonly Mechanism[] = ["check", "gate", "review", "none"];
const isMechanism = (s: string): s is Mechanism => MECHANISMS.some((m) => m === s);

/** The value of a header line, `**Label:** value`. */
function header(text: string, label: string): string | undefined {
  const m = new RegExp(`^\\*\\*${label}:\\*\\*[ \\t]*(.*?)[ \\t]*$`, "m").exec(text);
  return m?.[1];
}

/**
 * A specification's text read into its parts.
 *
 * @param id - its folder's name
 * @param text - the text of its `spec.md`
 */
export function parseSpec(id: string, text: string): Spec {
  const title = /^# Feature Specification: (.*)$/m.exec(text)?.[1]?.trim() ?? id;
  const inputAt = text.search(/^\*\*Input:\*\*/m);
  const afterInput = inputAt < 0 ? -1 : text.indexOf("\n\n", inputAt);
  const input = inputAt < 0 ? "" : text.slice(inputAt, afterInput < 0 ? text.length : afterInput).replace(/^\*\*Input:\*\*\s*/, "").trim();
  const body = afterInput < 0 ? "" : text.slice(afterInput).trim();
  const requirements = [...body.matchAll(/^- \*\*(FR-\d{3})\*\*:\s*([\s\S]*?)(?=\n- |\n\n|\n#|(?![\s\S]))/gm)].map((m) => ({
    id: m[1] ?? "",
    text: (m[2] ?? "").replace(/\n\s+/g, " ").trim(),
  }));
  const partOf = header(text, "Part of");
  return {
    id,
    title,
    status: header(text, "Status") ?? "",
    owner: header(text, "Owner") ?? "",
    domain: header(text, "Domain") ?? "",
    ...(partOf === undefined ? {} : { partOf }),
    input,
    body,
    requirements,
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
 * The spec kit of a folder: its specifications in force, in the register's order, and its enforcement.
 *
 * @param root - the spec kit's folder (`commons/spec-kit`)
 */
export function readSpecKit(root: string): SpecKit {
  const specs: Spec[] = [];
  for (const line of fs.readTextFileSync(path.join(root, "registry.tsv")).split("\n").slice(1)) {
    const [number, slug, state] = line.split("\t");
    if (number === undefined || slug === undefined || state !== "in force") continue;
    const id = `${number}-${slug}`;
    specs.push(parseSpec(id, fs.readTextFileSync(path.join(root, "specs", id, "spec.md"))));
  }
  return { specs, enforcement: parseEnforcement(fs.readTextFileSync(path.join(root, "enforcement.tsv"))) };
}
