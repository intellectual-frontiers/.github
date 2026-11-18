/**
 * Three versions of one small domain for the tests of the lifecycle, and a driver for the real engines. Not a test itself.
 *
 * @module
 */
import {
  annotate,
  attribute,
  codeList,
  codeOf,
  concept,
  date,
  domain,
  identifier,
  integer,
  relationship,
  text,
  vocabularies,
} from "@intellectual-frontiers/data/governance";
import type { LogicalSchema } from "@intellectual-frontiers/data/sql/logical";
import type { Driver } from "@intellectual-frontiers/data/sql/lifecycle";
import type { Engine } from "./engines-fixture.ts";
import { projected } from "./logical-fixture.ts";

const { lifecycle, quality, privacy, security, ownership, requirements } = vocabularies;

const genre = (codes: readonly string[]) =>
  codeList("genre", {
    definition: "What a book is",
    codes: Object.fromEntries(codes.map((c) => [c, { label: c.toUpperCase(), definition: `The ${c}` }])),
    annotations: [annotate(quality.openness, "open")],
  });

const governedAuthor = [annotate(ownership.steward, "librarian"), annotate(requirements.cites, ["0004-arca FR-001"])];

/** The domain at a version: 1 is the first, 2 adds columns, a table and a code, 3 renames a column and drops one. */
export function libraryAt(version: 1 | 2 | 3, shim = true, scratch = false, governed = false): LogicalSchema {
  const g = genre(version === 1 ? ["fiction", "poetry"] : ["fiction", "poetry", "drama"]);
  const author = concept("author", {
    definition: "Someone who writes",
    attributes: {
      id: attribute(identifier(), { definition: "What identifies it" }),
      fullName: attribute(text(), {
        definition: "What it is called",
        ...(version === 3 && shim ? { annotations: [annotate(lifecycle.renamedFrom, "name")] } : {}),
      }),
      ...(version === 2 ? { born: attribute(date(), { definition: "The day it was born", multiplicity: "optional" }) } : {}),
    },
    identifiedBy: ["id"],
    annotations: governed ? governedAuthor : [],
  });
  // the version 1 name of the column is `name`: a renamed attribute keeps its key in governance, so the first versions call it `name`
  const authorV1 = concept("author", {
    definition: "Someone who writes",
    attributes: {
      id: attribute(identifier(), { definition: "What identifies it" }),
      name: attribute(text(), { definition: "What it is called" }),
    },
    identifiedBy: ["id"],
    annotations: governed ? governedAuthor : [],
  });
  const authorV2 = concept("author", {
    definition: "Someone who writes",
    attributes: {
      id: attribute(identifier(), { definition: "What identifies it" }),
      name: attribute(text(), { definition: "What it is called" }),
      born: attribute(date(), {
        definition: "The day it was born",
        multiplicity: "optional",
        ...(governed
          ? {
              annotations: [
                annotate(privacy.personal, { category: "BirthDate", purposes: ["catalogue"] }),
                annotate(security.classification, "restricted"),
                annotate(quality.retention, { days: 365 }),
              ],
            }
          : {}),
      }),
    },
    identifiedBy: ["id"],
    annotations: governed ? governedAuthor : [],
  });
  const a = version === 1 ? authorV1 : version === 2 ? authorV2 : author;
  const book = concept("book", {
    definition: "A written work",
    attributes: {
      id: attribute(identifier(), { definition: "What identifies it" }),
      title: attribute(text(), { definition: "What it is called" }),
      genre: attribute(codeOf(g), { definition: "What it is" }),
      ...(version >= 2 ? { pages: attribute(integer(), { definition: "How long it is", multiplicity: "optional" }) } : {}),
    },
    identifiedBy: ["id"],
    relationships: { author: relationship(a, { cardinality: "one", definition: "Who wrote it" }) },
  });
  const concepts =
    version === 1
      ? [a, book]
      : [
          a,
          book,
          concept("publisher", {
            definition: "Who prints",
            attributes: {
              id: attribute(identifier(), { definition: "What identifies it" }),
              name: attribute(text(), { definition: "What it is called" }),
            },
            identifiedBy: ["id"],
          }),
        ];
  const extra = scratch
    ? [
        concept("scratch", {
          definition: "A table that is not kept",
          attributes: { id: attribute(identifier(), { definition: "What identifies it" }) },
          identifiedBy: ["id"],
        }),
      ]
    : [];
  const d = domain("library", { definition: "Books and who wrote them", concepts: [...concepts, ...extra], codeLists: [g] });
  if (d.kind === "err") throw new Error(JSON.stringify(d.error));
  return projected(d.value).schema;
}

/** A driver over an open engine. */
export const driverOf = (e: Engine): Driver => ({ exec: (sql) => e.run(sql), query: (sql) => e.rows(sql) });
