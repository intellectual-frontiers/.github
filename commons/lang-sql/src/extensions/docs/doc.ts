/**
 * Documentation as a value (commons lang-sql 0004-sql-docs FR-003 to FR-005): a summary, a description and tags, read from the text of comments as TSDoc reads it. The tags `param`, `returns`, `example`,
 * `deprecated`, `since` and `see` are typed; any other is a tag with its name and text, or the value a reader a project gave for it makes.
 *
 * @remarks
 * The summary is the first paragraph with its lines joined by a space; the description is the paragraphs after it, before the first tag, with their line breaks kept; a tag begins on a line whose first character
 * is `@` and a name, and its text goes on until the next tag. The code of an `example` is parsed with the dialect it is given.
 *
 * @example
 * ```ts
 * parseDoc("The people.\n\n@since 2026\n@param id the key").tags.map((t) => t.kind); // ["since", "param"]
 * ```
 *
 * Spec: 0004-sql-docs FR-003, FR-004, FR-005
 *
 * @module
 */
import { ansi, type Dialect, type Parsed, parse } from "../../mod.ts";

/** A `@param name {type} text`. */
export interface ParamTag {
  readonly kind: "param";
  readonly tag: string;
  readonly name: string;
  readonly type: string | undefined;
  readonly text: string;
}

/** A `@returns text`. */
export interface ReturnsTag {
  readonly kind: "returns";
  readonly tag: string;
  readonly text: string;
}

/** An `@example`: its code and what the parser made of it. */
export interface ExampleTag {
  readonly kind: "example";
  readonly tag: string;
  readonly code: string;
  readonly parsed: Parsed;
}

/** A `@deprecated`, `@since` or `@see`. */
export interface NoteTag {
  readonly kind: "deprecated" | "since" | "see";
  readonly tag: string;
  readonly text: string;
}

/** Any other tag, with the value of the reader a project gave for it. */
export interface CustomTag {
  readonly kind: "custom";
  readonly tag: string;
  readonly text: string;
  readonly value: unknown;
}

/** A tag of a documentation. */
export type DocTag = ParamTag | ReturnsTag | ExampleTag | NoteTag | CustomTag;

/** Documentation. */
export interface Doc {
  /** All of the text, with the markers taken off. */
  readonly raw: string;
  readonly summary: string;
  readonly description: string;
  readonly tags: readonly DocTag[];
}

/** What {@link parseDoc} may be given. */
export interface DocOptions {
  /** The dialect the examples are parsed in; the base dialect by default. */
  readonly dialect?: Dialect;
  /** Readers for tags of a project's own, by tag name; each is given the text of the tag. */
  readonly readers?: Readonly<Record<string, (text: string) => unknown>>;
}

const TAG = /^@([A-Za-z][\w-]*)(?:[ \t]+(.*))?$/;

function code(text: string): string {
  const ls = text.split("\n");
  const first = ls[0]?.trim() ?? "";
  if (first.startsWith("```")) {
    ls.shift();
    if ((ls[ls.length - 1] ?? "").trim() === "```") ls.pop();
  }
  return ls.join("\n").trim();
}

function tagOf(name: string, text: string, options: DocOptions): DocTag {
  const tag = name.toLowerCase();
  const reader = options.readers?.[tag];
  if (reader !== undefined) return { kind: "custom", tag, text, value: reader(text) };
  switch (tag) {
    case "param": {
      const m = /^(?:\{([^}]*)\}\s+)?(\S+)(?:\s+\{([^}]*)\})?(?:\s+-)?(?:\s+([\s\S]*))?$/.exec(text);
      return { kind: "param", tag, name: m?.[2] ?? "", type: m?.[1] ?? m?.[3], text: (m?.[4] ?? "").trim() };
    }
    case "returns":
    case "return":
      return { kind: "returns", tag, text };
    case "example": {
      const c = code(text);
      return { kind: "example", tag, code: c, parsed: parse(c, options.dialect ?? ansi) };
    }
    case "deprecated":
    case "since":
    case "see":
      return { kind: tag, tag, text };
    default:
      return { kind: "custom", tag, text, value: undefined };
  }
}

/**
 * Reads documentation from text.
 *
 * @param text - the text of comments with their markers taken off (see `docText`)
 * @param options - the dialect for the examples, and readers for a project's tags
 * @returns the summary, the description and the tags
 */
export function parseDoc(text: string, options: DocOptions = {}): Doc {
  const all = text.split("\n");
  const body: string[] = [];
  const tags: { name: string; lines: string[] }[] = [];
  for (const line of all) {
    const m = TAG.exec(line);
    if (m !== null && m[1] !== undefined) tags.push({ name: m[1], lines: [m[2] ?? ""] });
    else if (tags.length > 0) tags[tags.length - 1]?.lines.push(line);
    else body.push(line);
  }
  const paragraphs: string[][] = [];
  let current: string[] = [];
  for (const line of body) {
    if (line.trim() === "") {
      if (current.length > 0) paragraphs.push(current);
      current = [];
    } else current.push(line);
  }
  if (current.length > 0) paragraphs.push(current);
  const [first, ...rest] = paragraphs;
  return {
    raw: text,
    summary: (first ?? []).map((l) => l.trim()).join(" "),
    description: rest.map((p) => p.join("\n")).join("\n\n"),
    tags: tags.map((t) => tagOf(t.name, t.lines.join("\n").replace(/^\n+/, "").trimEnd(), options)),
  };
}
