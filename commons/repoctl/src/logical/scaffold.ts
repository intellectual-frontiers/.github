// Spec: 0005-repoctl-library-commit-doctor FR-001
/**
 * `repoctl new library <name>` (commons repoctl 0005-repoctl-library-commit-doctor FR-001 to FR-003): the files of a new library of commons, as data. A library is a folder with a manifest that declares the table of its layers (Kanon), a
 * package, a typed `about.ts`, a specification kit with its first specification and the enforcement of it, a test that proves it, the tools `verify` runs, a TypeScript configuration and, made by the license program, its `LICENSE`.
 * The name must be one the register accepts and one that no family holds. Pure: the same name, role and summary give the same files.
 *
 * @example
 * ```ts
 * import { filesOf } from "./scaffold.ts";
 * filesOf({ name: "widget", summary: "Widgets, made by the book." }).map((f) => f.path).includes("commons/widget/library.ts"); // true
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { parseLibraryName, type LibraryName } from "@intellectual-frontiers/repoctl/governance";

/** The roles a library is classified in, for the table of the README. */
export type Role = "foundation" | "pattern" | "program" | "standard";

/** Every role. */
export const ROLES: readonly Role[] = ["foundation", "pattern", "program", "standard"];

/** A name held for a family: the exact name or the prefix, and the host it is held for. */
export type Held = { readonly match: { readonly kind: "exact"; readonly name: string } | { readonly kind: "prefix"; readonly prefix: string }; readonly host: string };

/** What a new library is given. */
export type NewLibrary = { readonly name: string; readonly summary: string; /** The folder (from the repository's root) the libraries are in. */ readonly folder: string };

/** A file to write: its path from the repository's root and its text. */
export type NewFile = { readonly path: string; readonly text: string };

/** The name, once it is one that is valid, not held for a family and not in use; or why not. */
export function acceptName(text: string, held: readonly Held[], existing: readonly string[], folder: string): Result<LibraryName, { readonly code: "E-LIBRARY-NAME" | "E-LIBRARY-RESERVED" | "E-LIBRARY-EXISTS"; readonly message: string }> {
  const name = parseLibraryName(text);
  if (name.kind === "err") return err({ code: "E-LIBRARY-NAME", message: name.error });
  const taken = held.find((h) => (h.match.kind === "exact" ? h.match.name === name.value : name.value.startsWith(h.match.prefix)));
  if (taken !== undefined) return err({ code: "E-LIBRARY-RESERVED", message: `${name.value} is held for the family of the library ${taken.host}` });
  if (existing.includes(name.value)) return err({ code: "E-LIBRARY-EXISTS", message: `${folder}/${name.value} exists` });
  return ok(name.value);
}

/** The title of a library from its name: `my-lib` is `My Lib`. */
export function titleOf(name: string): string {
  return name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const q = (s: string): string => JSON.stringify(s);

/** An import line of a file that is written out: made here, so that the text of a scaffold is not read as an import of this file. */
const imp = (what: string, from: string): string => `import ${what} from ${JSON.stringify(from)};`;

/** The files of a new library. */
export function filesOf(l: NewLibrary): readonly NewFile[] {
  const n = l.name;
  const t = titleOf(n);
  const spec = `0001-${n}-layers`;
  const root = `${l.folder}/${n}`;
  const file = (path: string, text: string): NewFile => ({ path: `${root}/${path}`, text });
  const pkg = `@intellectual-frontiers/${n}`;
  return [
    file(
      "library.ts",
      `// Spec: ${spec} FR-001
/**
 * The manifest of ${t}, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its \`kanon\` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of \`@intellectual-frontiers/kanon\` holds in \`verify\`.
 *
 * @module
 */
export const library = {
  name: ${q(n)},
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  exports: [".", "./governance", "./logical", "./physical"],
  summary: ${q(l.summary)},
  kanon: {
    package: ${q(pkg)},
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      { folder: "src/logical/", layer: "logical", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      { folder: "src/physical/", layer: "physical", mayImport: ["src/governance/", "src/logical/"], packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/system", subpaths: "any" }] },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
`,
    ),
    file(
      "package.json",
      `${JSON.stringify(
        {
          name: pkg,
          private: true,
          version: "0.1.0",
          description: l.summary,
          type: "module",
          engines: { node: ">=26" },
          exports: { ".": "./src/mod.ts", "./governance": "./src/governance/mod.ts", "./logical": "./src/logical/mod.ts", "./physical": "./src/physical/mod.ts" },
          scripts: {
            check: "tsc -p tsconfig.json",
            test: "bun test suite/",
            "test:node": 'node --test "suite/**/*.test.ts"',
            verify: "tsc -p tsconfig.json && bun ../tools/mizan-check.ts --root spec-kit && bun ../libraries/src/check.ts --root spec-kit --level L1 && bun ../kanon/src/check.ts && bun tools/check.ts && bun test suite/",
          },
          devDependencies: {
            "@intellectual-frontiers/commons": "link:../ts",
            "@intellectual-frontiers/core": "link:../core",
            "@intellectual-frontiers/kanon": "link:../kanon",
            "@intellectual-frontiers/libraries": "link:../libraries",
            "@intellectual-frontiers/mizan": "link:../mizan",
            "@intellectual-frontiers/system": "link:../system",
            "@intellectual-frontiers/test": "link:../test",
            "@types/node": "26.6.6",
            "fast-check": "4.10.2",
            typescript: "7.0.2",
          },
        },
        null,
        2,
      )}\n`,
    ),
    file(
      "release.ts",
      `/**
 * The release record of this work (commons 0026-works-versioning): data, read and never run. \`versions bump\` writes it; never edit it by hand.
 *
 * @module
 */
export const release = {
  slug: ${q(n)},
  kind: "Software",
  title: ${q(`${t}: a library of Intellectual Frontiers Commons`)},
  authors: [
    {
      name: "Intellectual Frontiers",
    },
  ],
  version: "0.1.0",
  repository: "https://github.com/intellectual-frontiers/.github",
};
`,
    ),
    file(
      "tsconfig.json",
      `{
  "extends": "../ts/tsconfig.json",
  "compilerOptions": {
    "lib": ["es2024", "dom", "dom.iterable"],
    "skipLibCheck": true
  },
  "include": ["about.ts", "src/**/*.ts", "suite/**/*.ts", "tools/**/*.ts"]
}
`,
    ),
    file(
      "about.ts",
      `// Spec: ${spec} FR-001
/**
 * The typed facts of ${t}, an independent library of commons (commons 0027-commons-libraries). Its specification is in its own spec kit (\`spec-kit/\`), numbered from 0001; this repository knows it as one requirement of
 * 0027-commons-libraries, proved by \`bun run verify\` in this folder.
 *
 * @module
 */
${imp("type { About }", "@intellectual-frontiers/commons/ts/kernel")}

/** ${t}. */
export const about: About = {
  title: ${q(t)},
  summary: ${q(l.summary)},
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/governance/", what: "Layer 1: what the library is, as data and types.", mayImport: ["core, by package name"] },
    { path: "src/logical/", what: "Layer 2: the model the library reasons with.", mayImport: ["governance, by package name", "core, by package name"] },
    { path: "src/physical/", what: "Layer 3: what reads files, runs programs and reaches the network.", mayImport: ["governance and logical, by package name", "core and the system, by package name"] },
    { path: "suite/", what: "The tests: every requirement.", mayImport: ["src/", "the test module of commons' runtime, by package name"] },
    { path: "tools/", what: "The trace check \`bun run verify\` runs.", mayImport: ["the kernel, the runtime and the packer of commons, by package name"] },
  ],
};
`,
    ),
    file("src/mod.ts", `// Spec: ${spec} FR-001\n/**\n * ${t}: its three layers as namespaces.\n *\n * @module\n */\nexport * as governance from "./governance/mod.ts";\nexport * as logical from "./logical/mod.ts";\nexport * as physical from "./physical/mod.ts";\n`),
    file("src/governance/mod.ts", `// Spec: ${spec} FR-001\n/**\n * The Governance layer of ${t}: what it is, as data and types.\n *\n * @module\n */\nexport {};\n`),
    file("src/logical/mod.ts", `// Spec: ${spec} FR-001\n/**\n * The Logical layer of ${t}: the model it reasons with.\n *\n * @module\n */\nexport {};\n`),
    file("src/physical/mod.ts", `// Spec: ${spec} FR-001\n/**\n * The Physical layer of ${t}: what reads files, runs programs and reaches the network.\n *\n * @module\n */\nexport {};\n`),
    file("spec-kit/registry.tsv", `number\tslug\tstate\n0001\t${n}-layers\tin force\n`),
    file("spec-kit/mizan.baseline.txt", ""),
    file(
      "spec-kit/enforcement.tsv",
      `# What enforces each requirement in this library's specs (0024-spec-format FR-011 - FR-014).
# mechanism: check | gate | review | none. by: "<repo>: <command>" for check and gate, the defining requirement for review, "-" for none.
requirement\tmechanism\tby\tnote
${spec} FR-001\tcheck\t.github: cd commons/${n} && bun run verify\tsuite/layers.test.ts: every file of the real tree is in a unit and no import is outside its row
${spec} FR-002\tcheck\t.github: cd commons/${n} && bun run verify\tsuite/layers.test.ts: verify runs every check of the library
`,
    ),
    file(
      `spec-kit/specs/${spec}/spec.md`,
      `# Feature Specification: ${t} layers

**Spec ID:** ${spec}
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** ${l.summary} It is built to Kanon (commons 0033-kanon): Governance says what it is, Logical is the model it reasons with, and Physical is what touches the world.

## Requirements

- **FR-001**: The library MUST be Kanon: its manifest \`library.ts\` MUST declare the table of its units in the field \`kanon\`, with the units \`src/governance/\`, \`src/logical/\` and \`src/physical/\`, and the shared checker of \`@intellectual-frontiers/kanon\` MUST find no import that the table does not allow.
- **FR-002**: \`bun run verify\` in the folder of the library MUST run the TypeScript 7 compiler, the checks of the specification kit, the check of the level L1, the layers check of Kanon, the trace check and the tests, and MUST fail on any finding that is not held by a baseline that only shrinks.

## Acceptance scenarios

1. **Given** the real tree of the library, **When** the layers check runs, **Then** every file is in a unit and no import is outside its row, per FR-001.
2. **Given** the package of the library, **When** its \`verify\` script is read, **Then** it runs every check, per FR-002.

## Out of scope

- Everything the library will do: its next specifications.

## Edge cases

- A file in no unit of the table: it is a finding of the layers check, per FR-001.
- A \`verify\` that leaves out a check: it is a finding of the test, per FR-002.

## Assumptions

- The shared checker of Kanon and the manifest check of the libraries are on the branch that holds this library.

## Open questions

- None.

## Key entities

- **${t}** - the library.

## Success criteria

- **SC-001**: The layers check of Kanon finds nothing in the real tree.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
`,
    ),
    file(
      "suite/layers.test.ts",
      `/**
 * Tests of the layers of ${t} over the shared checker of Kanon (commons ${n} ${spec} FR-001, FR-002): the table in the manifest holds every file of the real tree with no finding, and \`verify\` runs every check.
 *
 * @module
 */
${imp("{ assert, assertEquals, proves }", "@intellectual-frontiers/test")}
${imp("{ decodeTable }", "@intellectual-frontiers/kanon")}
${imp("{ findings as hostFindings, readTable }", "@intellectual-frontiers/kanon/host")}
${imp("{ fs, path }", "@intellectual-frontiers/system")}
${imp("{ library }", "../library.ts")}

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

proves(["${spec} FR-001"], "the shared checker finds nothing in the real tree", () => {
  assertEquals(readTable(ROOT).kind, "ok");
  assertEquals(decodeTable(library.kanon).kind, "ok");
  const found = hostFindings(ROOT);
  assert(found.kind === "ok", "the real tree is read");
  assertEquals(found.value.map((f) => \`\${f.rule} \${f.file}\`), []);
});

proves(["${spec} FR-002"], "verify runs every check of the library", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { scripts: Record<string, string> };
  const verify = pkg.scripts["verify"] ?? "";
  for (const step of ["tsc -p tsconfig.json", "mizan-check.ts --root spec-kit", "check.ts --root spec-kit --level L1", "bun ../kanon/src/check.ts", "bun tools/check.ts", "bun test suite/"]) {
    assert(verify.includes(step), \`verify runs \${step}\`);
  }
});
`,
    ),
    file("tools/check.ts", CHECK_TOOL(n, t, spec)),
    file("trace.baseline.txt", ""),
  ];
}

function CHECK_TOOL(n: string, t: string, spec: string): string {
  return `// Spec: ${spec} FR-002
/**
 * The check \`bun run verify\` runs on the library (commons ${n} ${spec} FR-002): the trace of its sources and tests to its own specifications (commons 0015-trace), the findings held against \`trace.baseline.txt\`, which only
 * shrinks. It prints the lines of the judgement and exits with 0, or with 1 where a finding is new or a line of the baseline is stale.
 *
 * \`\`\`sh
 * bun tools/check.ts                    check
 * bun tools/check.ts --write-baseline   hold what is found now (the first time only)
 * \`\`\`
 *
 * @module
 */
${imp("* as kernel", "@intellectual-frontiers/mizan/trace")}
${imp("{ fs, path }", "@intellectual-frontiers/system")}
${imp("* as runtime", "@intellectual-frontiers/mizan/host/trace")}

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const BASELINE = "trace.baseline.txt";
const COMMENTS = [
  "# The findings of the trace check of ${t} (tools/check.ts) that existed when each was first held.",
  "# A new finding fails the check, and so does a line below that no longer occurs: when you fix one, delete its line.",
  "# Never add a line to make a check pass.",
] as const;

/** Every finding of the library at \`root\`: the trace of its sources and tests to its specifications. */
export async function findings(root: string): Promise<readonly kernel.Keyed[]> {
  const sources = await runtime.readSources(root, ["about.ts", "src", "tools"]);
  const tests = await runtime.readSources(root, ["suite"]);
  const specs = await runtime.readSpecs(root, "spec-kit/specs");
  return kernel.traceFindings({ specs, sources, tests, ontology: [], specsFolder: "spec-kit/specs" });
}

/** The command line: the exit status, and what to print. */
export async function main(argv: readonly string[]): Promise<{ readonly code: 0 | 1; readonly lines: readonly string[] }> {
  const found = await findings(ROOT);
  if (argv.includes("--write-baseline")) {
    await fs.writeTextFile(path.join(ROOT, BASELINE), kernel.formatBaseline(found, COMMENTS));
    return { code: 0, lines: [\`${n}-check: wrote \${BASELINE} (\${found.length} findings held)\`] };
  }
  const text = await fs.readTextFile(path.join(ROOT, BASELINE)).catch(() => "");
  const judged = kernel.judge(found, kernel.parseBaseline(text));
  return { code: kernel.passes(judged) ? 0 : 1, lines: kernel.report(judged, "${n}-check", BASELINE) };
}

if (import.meta.main) {
  const r = await main(process.argv.slice(2));
  for (const line of r.lines) console.log(line);
  process.exit(r.code);
}
`;
}

/** The README's map of the roles with a line added for the new library: after the last library of its role, or at the end of the map; the source unchanged where the library is there already. */
export function withRole(source: string, name: string, role: Role): Result<string, string> {
  const start = source.indexOf("export const ROLE_OF");
  if (start < 0) return err("readme.ts has no ROLE_OF");
  const end = source.indexOf("\n]);", start);
  if (end < 0) return err("the ROLE_OF of readme.ts does not end where it is read");
  const body = source.slice(start, end);
  const entry = `  [${q(name)}, ${q(role)}],`;
  if (body.includes(`[${q(name)},`)) return ok(source);
  const lastOfRole = body.lastIndexOf(`, ${q(role)}],`);
  if (lastOfRole < 0) return ok(`${source.slice(0, end)}\n${entry}${source.slice(end)}`);
  const at = start + body.indexOf("\n", lastOfRole);
  return ok(`${source.slice(0, at)}\n${entry}${source.slice(at)}`);
}
