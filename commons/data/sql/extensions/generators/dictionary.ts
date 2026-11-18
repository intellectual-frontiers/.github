// Spec: 0010-sql-generators FR-006, FR-007, FR-012
/**
 * The data dictionary (commons data 0010-sql-generators FR-006, FR-007, FR-012): for each table its description, its owner, its primary key and a table of its columns with the type, whether it
 * may be null, what it points to, its description and the personal data it holds, in Markdown and as one self-contained page of HTML. The type is the dialect's where a dialect is given.
 *
 * @module
 */
import { ok } from "@intellectual-frontiers/commons/ts/kernel";
import type { GenerateContext, Generator } from "@intellectual-frontiers/data/sql/physical";
import { cell, type Doc, docOf, type DocColumn, html, lines, oneLine, typeName } from "./model.ts";

const typeOf = (context: GenerateContext, c: DocColumn): string =>
  context.dialect === undefined ? typeName(c.type) : context.dialect.type(c.type);
const personalOf = (c: DocColumn): string =>
  c.personal === undefined
    ? ""
    : c.personal.category === undefined
      ? "PersonalData"
      : `${c.personal.class ?? "PersonalData"}: ${c.personal.category}`;
const intro = (context: GenerateContext): string =>
  context.dialect === undefined ? "Types are the logical types." : `Types as ${context.dialect.name} writes them.`;

/** The Markdown dictionary: `<domain>.dictionary.md`. */
export const dictionary: Generator = {
  id: "sql.generate.dictionary",
  describe: "A data dictionary in Markdown",
  generate: (context) => {
    const doc = docOf(context);
    const out = ["# Data dictionary", "", intro(context)];
    for (const t of doc.tables) {
      out.push("", `## ${t.name}`, "", oneLine(t.comment), "");
      out.push(`${t.owner === undefined ? "" : `Owner: ${t.owner}. `}Primary key: (${t.primaryKey.join(", ")}).`, "");
      out.push("| Column | Type | Null | Points to | Description | Personal data |", "| --- | --- | --- | --- | --- | --- |");
      for (const c of t.columns)
        out.push(
          `| ${cell(c.name)} | ${cell(typeOf(context, c))} | ${c.nullable ? "yes" : "no"} | ${c.points === undefined ? "" : cell(`${c.points.table}.${c.points.column}`)} | ${cell(oneLine(c.comment))} | ${cell(personalOf(c))} |`,
        );
    }
    return ok([{ path: `${doc.stem}.dictionary.md`, text: lines(out) }]);
  },
};

const page = (doc: Doc, context: GenerateContext): string => {
  const head = [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${html(doc.domain)}: data dictionary</title>`,
    "<style>",
    "body{font-family:system-ui,sans-serif;max-width:64rem;margin:2rem auto;padding:0 1rem;line-height:1.5}",
    "table{border-collapse:collapse;width:100%;margin:.5rem 0 2rem}",
    "th,td{border:1px solid #8886;padding:.25rem .5rem;text-align:left;vertical-align:top}",
    "th{background:#8882}code{font-size:.9em}",
    "</style>",
    "</head>",
    "<body>",
    `<h1>${html(doc.domain)}: data dictionary</h1>`,
    `<p>${html(oneLine(doc.comment))}</p>`,
    `<p>${html(intro(context))}</p>`,
    "<nav><ul>",
    ...doc.tables.map((t) => `<li><a href="#${html(t.name)}">${html(t.name)}</a></li>`),
    "</ul></nav>",
  ];
  const body = doc.tables.flatMap((t) => [
    `<section id="${html(t.name)}">`,
    `<h2>${html(t.name)}</h2>`,
    `<p>${html(oneLine(t.comment))}</p>`,
    `<p>${t.owner === undefined ? "" : `Owner: ${html(t.owner)}. `}Primary key: (${html(t.primaryKey.join(", "))}).</p>`,
    "<table>",
    "<thead><tr><th>Column</th><th>Type</th><th>Null</th><th>Points to</th><th>Description</th><th>Personal data</th></tr></thead>",
    "<tbody>",
    ...t.columns.map(
      (c) =>
        `<tr id="${html(`${t.name}.${c.name}`)}"><td><code>${html(c.name)}</code></td><td>${html(typeOf(context, c))}</td><td>${c.nullable ? "yes" : "no"}</td><td>${
          c.points === undefined
            ? ""
            : `<a href="#${html(`${c.points.table}.${c.points.column}`)}">${html(`${c.points.table}.${c.points.column}`)}</a>`
        }</td><td>${html(oneLine(c.comment))}</td><td>${html(personalOf(c))}</td></tr>`,
    ),
    "</tbody>",
    "</table>",
    "</section>",
  ]);
  return lines([...head, ...body, "</body>", "</html>"]);
};

/** The HTML dictionary: `<domain>.dictionary.html`. */
export const dictionaryHtml: Generator = {
  id: "sql.generate.html",
  describe: "A data dictionary as one self-contained page of HTML",
  generate: (context) => {
    const doc = docOf(context);
    return ok([{ path: `${doc.stem}.dictionary.html`, text: page(doc, context) }]);
  },
};
