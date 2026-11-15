/**
 * TSDoc as the one source of documentation: the comments of a model module are read into a map, which the emitter turns into SQL
 * comments and the generators into a data dictionary (commons 0006-sql-aide FR-005, FR-025). A runtime erases comments with the types,
 * so the map is generated from the source text and committed beside the module.
 *
 * @module
 */
import type { Docs, EntityDoc } from "../emit/context.ts";

/** A TSDoc comment taken apart: its summary and the tags the library reads. */
export interface ParsedComment {
  /** The text before the first tag, as one paragraph. */
  readonly summary: string;
  /** The `@remarks` block. */
  readonly remarks?: string;
  /** The `@deprecated` text. */
  readonly deprecated?: string;
  /** The `@param name - text` tags, by name. */
  readonly params: Readonly<Record<string, string>>;
}

const oneParagraph = (text: string): string =>
  text
    .split(/\s+/)
    .filter((w) => w !== "")
    .join(" ");

/**
 * Takes a TSDoc comment apart.
 *
 * @param comment - the comment, from its opening to its closing mark
 */
export function parseComment(comment: string): ParsedComment {
  const body = comment
    .replace(/^\/\*\*/, "")
    .replace(/\*\/$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\* ?/, ""))
    .join("\n");
  const blocks = body.split(/^(?=@[a-zA-Z]+)/m);
  const params: Record<string, string> = {};
  let remarks: string | undefined;
  let deprecated: string | undefined;
  for (const block of blocks.slice(1)) {
    const m = /^@([a-zA-Z]+)\s*([\s\S]*)$/.exec(block);
    if (m === null) continue;
    const [, tag = "", rest = ""] = m;
    if (tag === "remarks") remarks = oneParagraph(rest);
    else if (tag === "deprecated") deprecated = oneParagraph(rest);
    else if (tag === "param") {
      const p = /^([A-Za-z_$][\w$]*)\s*(?:-\s*)?([\s\S]*)$/.exec(rest.trim());
      if (p !== null && p[1] !== undefined) params[p[1]] = oneParagraph(p[2] ?? "");
    }
  }
  return {
    summary: oneParagraph(blocks[0] ?? ""),
    params,
    ...(remarks === undefined ? {} : { remarks }),
    ...(deprecated === undefined ? {} : { deprecated }),
  };
}

/**
 * Reads the documentation of a module's exported constants from its source: for each `export const`, its comment, and the comments of
 * the members written inside it (the columns of a table, the arguments of a routine) by the member's name.
 *
 * @param source - the text of a TypeScript module
 * @returns the documentation by the name of the export
 */
export function extractDocs(source: string): Readonly<Record<string, EntityDoc>> {
  const out: Record<string, EntityDoc> = {};
  const exports = [...source.matchAll(/^export const ([A-Za-z_$][\w$]*)/gm)].map((m) => ({ name: m[1] ?? "", at: m.index }));
  const comments = [...source.matchAll(/\/\*\*[\s\S]*?\*\//g)].map((m) => ({ text: m[0], at: m.index, end: m.index + m[0].length }));
  exports.forEach((e, i) => {
    const end = exports[i + 1]?.at ?? source.length;
    const own = comments.findLast((c) => c.end <= e.at && source.slice(c.end, e.at).trim() === "");
    const parsed = own === undefined ? undefined : parseComment(own.text);
    const members: Record<string, string> = { ...(parsed?.params ?? {}) };
    for (const c of comments) {
      if (c.at < e.at || c.at >= end) continue;
      const after = /^\s*(?:([A-Za-z_$][\w$]*)|"([^"]+)")\s*:/.exec(source.slice(c.end));
      const key = after?.[1] ?? after?.[2];
      if (key !== undefined) members[key] = parseComment(c.text).summary;
    }
    if (parsed === undefined && Object.keys(members).length === 0) return;
    out[e.name] = {
      summary: parsed?.summary ?? "",
      members,
      ...(parsed?.remarks === undefined ? {} : { remarks: parsed.remarks }),
      ...(parsed?.deprecated === undefined ? {} : { deprecated: parsed.deprecated }),
    };
  });
  return out;
}

/**
 * Writes a documentation map as the text of a TypeScript module, the same bytes from the same source.
 *
 * @param docs - the map `extractDocs` gave
 * @param from - the module it was read from, as a person would find it
 */
export function docsModule(docs: Readonly<Record<string, EntityDoc>>, from: string): string {
  // a property whose line would be longer than the formatter's width is written as the formatter writes it: the value on its own line
  const property = (indent: string, key: string, value: string): string => {
    const line = `${indent}${key}: ${JSON.stringify(value)},`;
    return line.length <= 140 ? line : `${indent}${key}:\n${indent}  ${JSON.stringify(value)},`;
  };
  const names = Object.keys(docs).sort();
  const lines = [
    "/**",
    ` * AUTO-GENERATED from the TSDoc comments of ${from}; do not edit: change the comments and write the map again.`,
    " *",
    " * @module",
    " */",
    "",
    `/** The documentation of ${from}, by the name of each exported constant. */`,
    "export const docs = {",
  ];
  for (const name of names) {
    const d = docs[name];
    if (d === undefined) continue;
    lines.push(`  ${name}: {`, property("    ", "summary", d.summary));
    if (d.remarks !== undefined) lines.push(property("    ", "remarks", d.remarks));
    if (d.deprecated !== undefined) lines.push(property("    ", "deprecated", d.deprecated));
    const members = Object.keys(d.members).sort();
    if (members.length === 0) lines.push("    members: {},");
    else {
      lines.push("    members: {");
      for (const m of members) lines.push(property("      ", /^[A-Za-z_$][\w$]*$/.test(m) ? m : JSON.stringify(m), d.members[m] ?? ""));
      lines.push("    },");
    }
    lines.push("  },");
  }
  lines.push("} as const;", "");
  return lines.join("\n");
}

/**
 * Joins a module's exports with its documentation map, so that a context can find the documentation of an entity by the entity itself.
 *
 * @param exports - the module, as `import * as m` gives it
 * @param docs - the map generated from its source
 * @example
 * const ctx = context({ dialect: postgres(), docs: [docsOf(party, partyDocs)] });
 */
export function docsOf(exports: Readonly<Record<string, unknown>>, docs: Readonly<Record<string, EntityDoc>>): Docs {
  const out = new Map<object, EntityDoc>();
  for (const [name, value] of Object.entries(exports)) {
    const d = docs[name];
    if (d !== undefined && typeof value === "object" && value !== null) out.set(value, d);
  }
  return out;
}
