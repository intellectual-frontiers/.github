/**
 * What is really vendored in this repository: the files that are not ours and the license each is under, as data (commons 0035-licensing FR-008). `../license.ts` makes `THIRD_PARTY_NOTICES.md` from it, and its check names an
 * item whose path is gone. Where a license was not checked against its source the item says `unverified: <what to check>` and never a guess.
 *
 * @remarks
 * Packages installed from a registry (TypeScript, fast-check, `@types/node` and the others in `bun.lock`) are not vendored: nothing of them is in this repository, and a package's license is its own. Mermaid is
 * copied into a built site and not into this repository, so its item has no path.
 *
 * Spec: 0001-libraries FR-019
 *
 * @module
 */

/** One third-party item: what it is, where it came from, whose it is and the license it is under. */
export type ThirdPartyItem = {
  /** The path in the repository, or `undefined` for an item that is copied only into a built output. */
  readonly path: string | undefined;
  readonly what: string;
  readonly source: string;
  readonly owner: string;
  readonly license: string;
  /** What was checked, or `unverified: <what to check>`. */
  readonly checked: string;
};

/** The items, in the order the notices list them. */
export const THIRD_PARTY: readonly ThirdPartyItem[] = [
  {
    path: "commons/libraries/src/workflows/schema/github-workflow.schema.json",
    what: "The JSON Schema of GitHub Actions workflows, the copy fetched on 2026-11-19, which the tests validate the generated workflows against",
    source: "https://json.schemastore.org/github-workflow.json (the SchemaStore project, https://github.com/SchemaStore/schemastore)",
    owner: "The SchemaStore authors",
    license: "Apache-2.0",
    checked:
      "The license is that of the SchemaStore repository (its LICENSE is the Apache License 2.0, read on 2026-11-20). unverified: whether the Apache-2.0 text must travel with this one file, which is named here by its address; ask counsel",
  },
  {
    path: "commons/data/sql/extensions/osquery/schema/osquery-5.24.1.auto.json",
    what: "The tables of osquery 5.24.1 (names, columns, types, descriptions), trimmed to the fields the importer reads",
    source: "https://github.com/osquery/osquery-site, commit 055097f8d8fb45c0c33a83c9ed7c56a7df3d7b5f, path src/data/osquery_schema_versions/5.24.1.json",
    owner: "The osquery authors",
    license: "CC-BY-4.0, as the file's own `source.license` records for the osquery-site documentation data; the osquery project is Apache-2.0 OR GPL-2.0-only",
    checked:
      "Taken from the record in the file itself. unverified: the license file of osquery-site at that commit (the address of a LICENSE file at the root returned 404), so check where the CC-BY-4.0 statement comes from and the attribution it asks for",
  },
  {
    path: "commons/ontology/src/standards/nist-sp-800-53/controls.auto.ts",
    what: "The titles and groups of twelve controls of NIST SP 800-53 Rev. 5.2.0, imported from the OSCAL catalog and held to its SHA-256",
    source: "https://github.com/usnistgov/oscal-content, commit f0de6d8d8c059d374f15e0ae07508d82e370fc1d (import manifest commons/libraries/src/imports/nist-sp-800-53.import.ts)",
    owner: "The National Institute of Standards and Technology",
    license: "Public domain (a work of the United States Government, 17 U.S.C. 105)",
    checked: "Taken from the import manifest, which records it with the SHA-256 of the source.",
  },
  {
    path: "commons/ontology/src/supply-chain/packaging/schema.auto.ts",
    what: "The slice of schema.org 30.1 that the packaging ontology specializes, imported and held to its SHA-256",
    source: "https://schema.org/version/30.1/schemaorg-current-https.ttl (import manifest commons/libraries/src/imports/schema-org.import.ts)",
    owner: "The Schema.org Community Group and contributors",
    license: "CC-BY-SA-3.0",
    checked:
      "Taken from the import manifest. unverified: whether the ShareAlike term of CC-BY-SA-3.0 reaches this generated module and what it asks of the files that use it; ask counsel",
  },
  {
    path: "commons/ontology/src/supply-chain/packaging/managers.ts",
    what: "The table of package managers, seeded from the tables of upt (the families file, `families.ts`, is seeded from the same)",
    source: "https://github.com/sigoden/upt, kept as a fixture in tests/fixtures/upt/",
    owner: "The authors of upt",
    license: "MIT OR Apache-2.0, at the user's option",
    checked: "Taken from the files' own headers and from tests/fixtures/upt/README.md. unverified: the license files of the pinned upt commit, which are not kept in this repository",
  },
  {
    path: "commons/ontology/src/supply-chain/packaging/families.ts",
    what: "The families of package managers, seeded from the tables of upt",
    source: "https://github.com/sigoden/upt, kept as a fixture in tests/fixtures/upt/",
    owner: "The authors of upt",
    license: "MIT OR Apache-2.0, at the user's option",
    checked: "Taken from the file's own header and from tests/fixtures/upt/README.md. unverified: the license files of the pinned upt commit, which are not kept in this repository",
  },
  {
    path: undefined,
    what: "Mermaid 11.17.2, the script the generated documentation site serves on a page with a diagram; it is copied into the built site from the package `mermaid` and is not in this repository",
    source: "https://www.npmjs.com/package/mermaid",
    owner: "Knut Sveidqvist and contributors",
    license: "MIT",
    checked: "The LICENSE of the installed package 11.17.2 was read on 2026-11-20: The MIT License (MIT), Copyright (c) 2014 - 2022 Knut Sveidqvist.",
  },
  {
    path: "commons/lang-sql/suite/corpus/calcite",
    what: "SQL statements of Apache Calcite's Quidem scripts (core/src/test/resources/sql/*.iq), sampled",
    source: "https://github.com/apache/calcite, commit 647e8f288b62d3fa594e901da5428f2c545f0609",
    owner: "The Apache Software Foundation (Apache Calcite)",
    license: "Apache-2.0",
    checked: "The license is that of the repository (its LICENSE, read on 2026-11-21, kept in commons/lang-sql/suite/corpus/LICENSES/calcite.txt).",
  },
  {
    path: "commons/lang-sql/suite/corpus/clickhouse",
    what: "SQL statements of ClickHouse's stateless tests (tests/queries/0_stateless), sampled",
    source: "https://github.com/ClickHouse/ClickHouse, commit 2a2f57466616f97b3f6cbbf4dbe29b85b5811dfe",
    owner: "ClickHouse, Inc. and the ClickHouse contributors",
    license: "Apache-2.0",
    checked: "The license is that of the repository (its LICENSE, read on 2026-11-21, kept in commons/lang-sql/suite/corpus/LICENSES/clickhouse.txt).",
  },
  {
    path: "commons/lang-sql/suite/corpus/duckdb",
    what: "SQL statements of DuckDB's tests (test/sql, `statement ok` and `query` blocks), sampled",
    source: "https://github.com/duckdb/duckdb, commit 87d96b7773a10356b11cc15c352125acdc58a9ce",
    owner: "DuckDB Foundation and the DuckDB contributors",
    license: "MIT",
    checked: "The license is that of the repository (its LICENSE, read on 2026-11-21, kept in commons/lang-sql/suite/corpus/LICENSES/duckdb.txt).",
  },
  {
    path: "commons/lang-sql/suite/corpus/postgres_regress",
    what: "SQL statements of PostgreSQL's regression tests (src/test/regress/sql, selected files, psql commands removed)",
    source: "https://github.com/postgres/postgres, commit 207b5293b8d9a217bb918b5b44774b3b4f1e2f89",
    owner: "The PostgreSQL Global Development Group",
    license: "PostgreSQL",
    checked: "The license is that of the repository (its COPYRIGHT, read on 2026-11-21, kept in commons/lang-sql/suite/corpus/LICENSES/postgres_regress.txt).",
  },
  {
    path: "commons/lang-sql/suite/corpus/spark",
    what: "SQL statements of Apache Spark's sql-tests inputs, sampled",
    source: "https://github.com/apache/spark, commit 03a2b318c4ffd2529106a3e1503393a3280ccd64",
    owner: "The Apache Software Foundation (Apache Spark)",
    license: "Apache-2.0",
    checked: "The license is that of the repository (its LICENSE, read on 2026-11-21, kept in commons/lang-sql/suite/corpus/LICENSES/spark.txt).",
  },
  {
    path: "commons/lang-sql/suite/corpus/sqlglot",
    what: "SQL statements taken from the tests of sqlglot (tests/dialects/test_*.py, tests/fixtures), one file for each dialect",
    source: "https://github.com/tobymao/sqlglot, commit b812ff95afa2ab7ab925f95edd5d97c4b761cec9",
    owner: "Toby Mao and the sqlglot contributors",
    license: "MIT",
    checked: "The license is that of the repository (its LICENSE, read on 2026-11-21, kept in commons/lang-sql/suite/corpus/LICENSES/sqlglot.txt).",
  },
  {
    path: "commons/lang-sql/suite/corpus/sqllogictest",
    what: "SQL statements of SQLite's sqllogictest (select1-5 and evidence), sampled",
    source: "https://github.com/gregrahn/sqllogictest, commit c93ac416f05635ff5cc490009add936d9753d01d",
    owner: "D. Richard Hipp and the SQLite authors (gregrahn/sqllogictest mirror)",
    license: "CC0-1.0 OR MIT OR BSD, at the author's offer in COPYRIGHT.md",
    checked: "The license is that of the repository (its COPYRIGHT.md, read on 2026-11-21, kept in commons/lang-sql/suite/corpus/LICENSES/sqllogictest.txt). unverified: its COPYRIGHT.md offers the GPL, BSD, MIT or CC0 at the user's choice without giving the texts; the permissive option is taken; ask counsel",
  },
  {
    path: "commons/lang-sql/suite/corpus/starrocks",
    what: "SQL statements of StarRocks's test/sql inputs, sampled",
    source: "https://github.com/StarRocks/starrocks, commit 576d9cf780b5a5d10b9b95fa8c60ddb82862411f",
    owner: "The StarRocks Project Authors",
    license: "Apache-2.0",
    checked: "The license is that of the repository (its LICENSE.txt, read on 2026-11-21, kept in commons/lang-sql/suite/corpus/LICENSES/starrocks.txt).",
  },
] as const;
