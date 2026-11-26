/**
 * The map of the libraries in the root `README.md`: the table between the markers `<!-- libraries-map:begin -->` and `<!-- libraries-map:end -->`, one row for each library of `commons/`, made from
 * the manifests (`library.ts`) and the `summary` of each library's `about.ts`, so that the first page of the repository cannot name a library that is gone or miss one that is new.
 *
 *     bun commons/libraries/src/readme.ts            write the table again from the manifests
 *     bun commons/libraries/src/readme.ts --check    write nothing and exit 1 where README.md is not what the manifests make
 *     other flags: --repo DIR (the repository, the working folder by default)
 *
 * @remarks
 * Both files are read as data and no library is run: the manifest by `readLibraries`, the summary of `about.ts` by reading the string literals that follow `summary:` (joined by `+`). A row has the library's package
 * as a link (to npm where the library is published there, else to its folder), the first clause of the first sentence of its summary, its Kanon shape where the manifest declares a table (`layers`, and
 * `instances` and `plugins` where it declares those), its conformance level and the registries it is published to. Rows are sorted by role, then by name; the role of a library is a closed union
 * held in {@link ROLE_OF}, and a library with no entry there is a problem, never a row of no role. A version is not in the table: versions grow at the release, and a table that held them would be stale at every release.
 *
 * @limits
 * It writes one file, README.md, and only between the markers; it does not judge the prose around them (the test of the README does).
 *
 * @example
 * ```ts
 * import { firstClause } from "./readme.ts";
 * firstClause("Mizan, the IF Spec Profile, as code. The harness holds the rules."); // "Mizan, the IF Spec Profile, as code"
 * ```
 *
 * Spec: 0001-libraries FR-017
 *
 * @module
 */
import process from "node:process";
import { absurd, type Brand, err, ok, refine, type Result, string } from "@intellectual-frontiers/core";
import { stdio } from "@intellectual-frontiers/system";
import { existsSync, readTextFileSync, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { env } from "@intellectual-frontiers/system/proc";
import { activeMode, type DistributionMode, MODE_VARIABLE, SINGLE } from "./distribution.ts";
import { type Hold, type Library, type Registry, readLibraries } from "./libraries.ts";

/** The marker that opens the generated table. */
export const BEGIN = "<!-- libraries-map:begin -->";
/** The marker that closes the generated table. */
export const END = "<!-- libraries-map:end -->";

/** What a library is for in the whole: a closed union. */
export const ROLES = ["foundation", "pattern", "program", "standard"] as const;
/** A role a reader of the README may be in, as the generated library map names them. */
export type Role = (typeof ROLES)[number];

/** The heading of a role in the table. */
export const ROLE_TITLE: Readonly<Record<Role, string>> = {
  foundation: "Foundation",
  pattern: "Pattern",
  program: "Program",
  standard: "Standard",
};

/** A library's name (its folder), made only by {@link parseLibraryName}. */
export type LibraryName = Brand<string, "library name">;
const nameDecoder = refine(string, "library name", (t) => /^[a-z][a-z0-9-]*$/.test(t));

/** A library name from text, or why the text is not one. */
export function parseLibraryName(text: string): Result<LibraryName, string> {
  const r = nameDecoder(text, "name");
  return r.kind === "ok" ? ok(r.value) : err(`${JSON.stringify(text)} is not a library name`);
}

/** The role of each library, by name. A new library is classified here, or the check names it. */
export const ROLE_OF: ReadonlyMap<string, Role> = new Map<string, Role>([
  ["catalog-nist-sp800", "standard"],
  ["catalog-nist-csf-2", "standard"],
  ["core", "foundation"],
  ["crypto", "foundation"],
  ["formats", "foundation"],
  ["githost", "foundation"],
  ["lint", "foundation"],
  ["net", "foundation"],
  ["rdf", "foundation"],
  ["system", "foundation"],
  ["anyfs", "foundation"],
  ["anyfs-bridge", "foundation"],
  ["anyfs-git", "foundation"],
  ["anyfs-githost", "foundation"],
  ["anyfs-mirror", "foundation"],
  ["telemetry", "foundation"],
  ["terminal", "foundation"],
  ["test", "foundation"],
  ["anyfs-posix", "foundation"],
  ["anyfs-serve", "foundation"],
  ["anyfs-query", "foundation"],
  ["anyfs-s3", "foundation"],
  ["anyfs-onedrive", "foundation"],
  ["anyfs-gdrive", "foundation"],
  ["anyfs-ssh", "foundation"],
  ["anyfs-sql", "foundation"],
  ["anyfs-cli", "program"],
  ["headless", "pattern"],
  ["kanon", "pattern"],
  ["content", "pattern"],
  ["planning", "pattern"],
  ["assessment", "pattern"],
  ["tenancy", "pattern"],
  ["gate", "pattern"],
  ["posture-report", "pattern"],
  ["workbench", "pattern"],
  ["workload", "pattern"],
  ["archon", "program"],
  ["toolchain", "program"],
  ["archon-dialect-native-pinned", "program"],
  ["package-managers", "program"],
  ["archon-dialect-apt", "program"],
  ["archon-dialect-ansible", "program"],
  ["archon-dialect-cloud-init", "program"],
  ["archon-dialect-opentofu", "program"],
  ["archon-converge", "program"],
  ["archon-dns", "program"],
  ["archon-dialect-homebrew", "program"],
  ["archon-dialect-mise", "program"],
  ["archon-dialect-winget", "program"],
  ["archon-tool", "program"],
  ["estate", "program"],
  ["data", "program"],
  ["docs", "program"],
  ["grc", "program"],
  ["integrations", "program"],
  ["integrations-github", "program"],
  ["libraries", "program"],
  ["repoctl", "program"],
  ["machine-probe", "program"],
  ["lab", "program"],
  ["evidence-capture", "program"],
  ["linux-observe", "program"],
  ["ssh-server", "program"],
  ["linux-services", "program"],
  ["lang-sql", "program"],
  ["estate-query", "program"],
  ["change-control", "program"],
  ["estate-iac", "program"],
  ["estate-endpoints", "program"],
  ["pentest", "program"],
  ["findings", "program"],
  ["scanners", "program"],
  ["planning-query", "program"],
  ["integrations-fhir", "standard"],
  ["integrations-x12", "standard"],
  ["mizan", "standard"],
  ["ontology", "standard"],
  ["quality", "standard"],
  ["catalog-soc2", "standard"],
  ["integrations-identity", "standard"],
]);

const roleRank = (r: Role): number => {
  switch (r) {
    case "foundation":
      return 0;
    case "pattern":
      return 1;
    case "program":
      return 2;
    case "standard":
      return 3;
    default:
      return absurd(r);
  }
};

/** One row of the table. */
export type Row = {
  readonly name: LibraryName;
  /** The library's folder from `commons/` where it is not its name (`anyfs/s3`, 0027-commons-libraries FR-026). */
  readonly dir?: string;
  readonly role: Role;
  readonly purpose: string;
  readonly shape: string;
  readonly level: string;
  readonly distribution: readonly Registry[];
  readonly published: boolean;
  /** The typed reason the library is not released, where it has one (0001-libraries FR-024). */
  readonly held: Hold | undefined;
};

/**
 * The `summary` of an `about.ts`, read as data: the double-quoted string literals after `summary:`, joined by `+`, and nothing run.
 * An error where the file has no summary or it is not literals.
 */
export function summaryOf(source: string): Result<string, string> {
  const m = /\bsummary:\s*/.exec(source);
  if (m === null) return err("it has no summary");
  let at = m.index + m[0].length;
  const parts: string[] = [];
  for (;;) {
    const lit = /^"(?:[^"\\\n]|\\.)*"/.exec(source.slice(at));
    if (lit === null) return err("its summary is not a string literal");
    try {
      const v: unknown = JSON.parse(lit[0]);
      if (typeof v !== "string") return err("its summary is not a string literal");
      parts.push(v);
    } catch {
      return err("its summary is not a string literal");
    }
    at += lit[0].length;
    const plus = /^\s*\+\s*/.exec(source.slice(at));
    if (plus === null) break;
    at += plus[0].length;
  }
  return ok(parts.join(""));
}

/** The first sentence of a text: up to the first full stop that is followed by a space or the end, outside parentheses and backticks. */
export function firstSentence(text: string): string {
  let depth = 0;
  let tick = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charAt(i);
    if (c === "`") tick = !tick;
    else if (tick) continue;
    else if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if (c === "." && depth === 0 && (i + 1 === text.length || /\s/.test(text.charAt(i + 1)))) return text.slice(0, i);
  }
  return text.trim();
}

/**
 * The first clause of a text's first sentence: the sentence where it is short (110 characters or fewer), else the sentence cut at its first `:`, `;` or comma that is
 * outside parentheses and backticks and at least 25 characters in; the whole sentence where it has no such place.
 */
export function firstClause(text: string): string {
  const sentence = firstSentence(text).replace(/\s+/g, " ").trim();
  if (sentence.length <= 110) return sentence;
  let depth = 0;
  let tick = false;
  for (let i = 0; i < sentence.length; i++) {
    const c = sentence.charAt(i);
    if (c === "`") tick = !tick;
    else if (tick) continue;
    else if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0 && i >= 25 && (c === ":" || c === ";" || c === ",")) return sentence.slice(0, i);
  }
  return sentence;
}

/** The Kanon shape of a library: what its manifest declares, in words, or a dash where it declares no table. */
export function shapeOf(l: Library): string {
  const t = l.kanon;
  if (t === undefined) return "-";
  const parts = ["layers", ...(t.instances.length > 0 ? ["instances"] : []), ...(t.plugins.length > 0 ? ["plugins"] : []), ...(t.extends === undefined ? [] : ["extension"])];
  return parts.join(", ");
}

/** A row of the table for a library and its summary, or why there is none. */
export function rowOf(l: Library, summary: string): Result<Row, string> {
  const name = parseLibraryName(l.name);
  if (name.kind === "err") return name;
  const role = ROLE_OF.get(l.name);
  if (role === undefined) return err(`commons/${l.name} has no role in ROLE_OF (commons/libraries/src/readme.ts): say whether it is a foundation, a pattern, a program or a standard`);
  return ok({
    name: name.value,
    ...(l.dir === undefined || l.dir === l.name ? {} : { dir: l.dir }),
    role,
    purpose: firstClause(summary).replace(/\|/g, "\\|"),
    shape: shapeOf(l),
    level: l.level,
    distribution: l.distribution,
    published: l.held === undefined && l.distribution.includes("npm"),
    held: l.held,
  });
}

const REGISTRY_TITLE: Readonly<Record<Registry, string>> = { github: "GitHub", npm: "npm" };

/** The table, as Markdown, for the rows given: sorted by role, then by name. */
export function tableOf(rows: readonly Row[]): string {
  const sorted = [...rows].sort((a, b) => roleRank(a.role) - roleRank(b.role) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const head = ["| Library | Role | What it is | Kanon | Level | Published to |", "| --- | --- | --- | --- | --- | --- |"];
  const body = sorted.map((r) => {
    const pkg = `@intellectual-frontiers/${r.name}`;
    const href = r.published ? `https://www.npmjs.com/package/${pkg}` : `commons/${r.dir ?? r.name}`;
    return `| [\`${pkg}\`](${href}) | ${ROLE_TITLE[r.role]} | ${r.purpose} | ${r.shape} | ${r.level} | ${r.held === undefined ? r.distribution.map((d) => REGISTRY_TITLE[d]).join(", ") : `not released (${r.held.kind})`} |`;
  });
  return [...head, ...body].join("\n");
}

/** The rows of a repository, and what is wrong with reading them. */
export function rowsOf(repo: string): { readonly rows: readonly Row[]; readonly problems: readonly string[] } {
  const root = repo.replace(/[\\/]$/, "");
  const rows: Row[] = [];
  const problems: string[] = [];
  for (const f of readLibraries(root)) {
    if ("problem" in f) {
      problems.push(`commons/${f.dir}/library.ts: ${f.problem}`);
      continue;
    }
    if (f.library.bundle !== undefined) continue; // a metapackage has no about.ts and is listed by {@link bundlesOf}
    const file = `${root}/commons/${f.dir}/about.ts`;
    if (!existsSync(file)) {
      problems.push(`commons/${f.dir}/about.ts is missing: the table takes its purpose from the summary there`);
      continue;
    }
    const s = summaryOf(readTextFileSync(file));
    if (s.kind === "err") {
      problems.push(`commons/${f.dir}/about.ts: ${s.error}`);
      continue;
    }
    const r = rowOf(f.library, s.value);
    if (r.kind === "err") problems.push(r.error);
    else rows.push(r.value);
  }
  return { rows, problems };
}

/** One row of the table of the metapackages: the package and what it is. */
export type BundleRow = { readonly name: string; readonly purpose: string };

/** The rows of the metapackages of a repository, in the order of their folders' names: each the package and the first clause of the summary its manifest gives. */
export function bundlesOf(repo: string): readonly BundleRow[] {
  const rows: BundleRow[] = [];
  for (const f of readLibraries(repo.replace(/[\\/]$/, ""))) {
    if ("problem" in f || f.library.bundle === undefined) continue;
    rows.push({ name: f.library.name, purpose: firstClause(f.library.summary ?? "").replace(/\|/g, "\\|") });
  }
  return rows;
}

/** The table of the package or packages that install commons, as Markdown, with the sentence that introduces it: in `single` mode the one package that holds every library, in `per-library` mode the metapackages; nothing where a repository has none. */
export function bundlesTableOf(rows: readonly BundleRow[], mode: DistributionMode = "per-library"): string {
  if (rows.length === 0) return "";
  if (mode === "single") {
    const one = rows.filter((r) => r.name === SINGLE.slug);
    if (one.length === 0) return "";
    return [
      `Distribution \`single\` (commons 0036-distribution FR-019): the whole of commons is one package at one version, and a library is imported as \`${SINGLE.package}/<library>\` (and \`${SINGLE.package}/<library>/<subpath>\`).`,
      "",
      "| Package | What it holds |",
      "| --- | --- |",
      ...one.map((r) => `| \`${SINGLE.package}\` | ${r.purpose} |`),
    ].join("\n");
  }
  const body = rows.map((r) => `| [\`@intellectual-frontiers/${r.name}\`](https://www.npmjs.com/package/@intellectual-frontiers/${r.name}) | ${r.purpose} |`);
  return [
    "Metapackages: no code of their own, each depends on a set of the libraries above at exact versions (commons 0036-distribution). Install one of them, or a library.",
    "",
    "| Metapackage | What it holds |",
    "| --- | --- |",
    ...body,
  ].join("\n");
}

/** The README made again from its text and the table: the text between the markers (on lines of their own) replaced; an error where the markers are missing. */
export function withTable(readme: string, table: string): Result<string, string> {
  const from = readme.indexOf(`\n${BEGIN}\n`);
  const to = readme.indexOf(`\n${END}\n`, from);
  if (from < 0 || to < 0) return err(`README.md has no ${BEGIN} and ${END}, each on a line of its own, around the table of the libraries`);
  return ok(`${readme.slice(0, from + 1 + BEGIN.length)}\n\n${table}\n\n${readme.slice(to + 1)}`);
}

/** The result of a run: whether README.md is stale, and the problems found. With `write`, the file is written where it is stale. */
export function synchronize(repo: string, write: boolean): { readonly stale: boolean; readonly problems: readonly string[] } {
  const root = repo.replace(/[\\/]$/, "");
  const file = `${root}/README.md`;
  const { rows, problems } = rowsOf(root);
  if (!existsSync(file)) return { stale: false, problems: [...problems, "README.md is missing"] };
  const text = readTextFileSync(file).replace(/\r\n/g, "\n");
  const modeOf = activeMode(env.get(MODE_VARIABLE));
  const bundles = bundlesTableOf(bundlesOf(root), modeOf.kind === "ok" ? modeOf.value : "per-library");
  const made = withTable(text, bundles === "" ? tableOf(rows) : `${tableOf(rows)}\n\n${bundles}`);
  if (made.kind === "err") return { stale: false, problems: [...problems, made.error] };
  const stale = made.value !== text;
  if (stale && write && problems.length === 0) writeTextFileSync(file, made.value);
  return { stale, problems };
}

/** The command line: 0, or 1 where a problem was found or, with `--check`, README.md is not what the manifests make. */
export function main(argv: readonly string[]): number {
  const at = argv.indexOf("--repo");
  const repo = at >= 0 ? (argv[at + 1] ?? ".") : ".";
  const check = argv.includes("--check");
  const r = synchronize(repo, !check);
  for (const p of r.problems) stdio.stderr.writeSync(`${p}\n`);
  if (r.stale) stdio.stderr.writeSync(check ? "README.md is not what the manifests make; run: bun commons/libraries/src/readme.ts\n" : "wrote README.md\n");
  return r.problems.length > 0 || (check && r.stale) ? 1 : 0;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
