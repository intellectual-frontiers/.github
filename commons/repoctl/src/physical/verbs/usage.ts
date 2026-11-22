// Spec: 0014-repoctl-usage FR-001, FR-002, FR-004, FR-005
/**
 * `repoctl usage` on Headless (commons repoctl 0014-repoctl-usage): what a repository uses of the package `@intellectual-frontiers/commons`, read from its own files and from the sources of the installed package, as a table or as JSON. It reads through the world's ports and
 * changes nothing.
 *
 * @example
 * ```ts
 * import { usageVerb } from "@intellectual-frontiers/repoctl/physical";
 * typeof usageVerb; // "function"
 * ```
 *
 * @module
 */
import { finding, consumerImports, libraryImports, usageOf, usageText, type ConsumerImport, type PackageLibrary } from "@intellectual-frontiers/repoctl/logical";
import { value } from "@intellectual-frontiers/terminal/args";
import { defineVerb, outcomeOfDone, outcomeOfEnvironment } from "../define.ts";

/** The package whose use is read. */
export const USAGE_PACKAGE = "@intellectual-frontiers/commons";

const CODE = /\.(?:ts|tsx|mts|js|mjs|cjs|json5)$/;
const SKIPPED = /(?:^|\/)(?:\.git|build|dist|node_modules)\//;
const bytesOf = (text: string): number => new TextEncoder().encode(text).length;
const join = (...parts: readonly string[]): string => parts.join("/").replace(/\/{2,}/g, "/");

/** `repoctl usage`. */
export const usageVerb = defineVerb({
  name: "usage",
  id: "usage",
  options: {
    root: value<never>({ help: "The repository to read (the repository repoctl runs in by default).", valueName: "DIR", default: "" }),
    package: value<never>({ help: "The folder of the installed package (node_modules/@intellectual-frontiers/commons of the repository by default).", valueName: "DIR", default: "" }),
  },
  examples: [
    { args: [], says: "What this repository uses of the package: the libraries imported, those reached through them and those never touched." },
    { args: ["--root", "../erga", "--package", "../erga/node_modules/@intellectual-frontiers/commons", "--json"], says: "The same for another repository, as one JSON document." },
  ],
  run: async (args, _ctx, w) => {
    const root = args.options.root === "" ? w.repo : args.options.root.startsWith("/") ? args.options.root : join(w.repo, args.options.root);
    const pkg = args.options.package === "" ? join(root, "node_modules", USAGE_PACKAGE) : args.options.package.startsWith("/") ? args.options.package : join(w.repo, args.options.package);
    const libraries = (await w.files.list(pkg)).filter((n) => !n.includes(".") && n !== "bin");
    if (libraries.length === 0 || !(await w.files.exists(join(pkg, "package.json")))) return outcomeOfEnvironment(`the package ${USAGE_PACKAGE} is not installed at ${pkg}: install it, or name its folder with --package`);
    const known = new Set<string>();
    for (const n of libraries) if (await w.files.exists(join(pkg, n, "src"))) known.add(n);
    // the graph of the package: the sources of each library say which libraries it imports; every file of it counts its bytes
    const graph: PackageLibrary[] = [];
    for (const name of [...known].sort()) {
      const imports = new Set<string>();
      let files = 0;
      let bytes = 0;
      for (const rel of await w.files.walk(join(pkg, name))) {
        const text = (await w.files.read(join(pkg, name, rel))) ?? "";
        files += 1;
        bytes += bytesOf(text);
        if (rel.startsWith("src/") && rel.endsWith(".ts") && !rel.endsWith(".d.ts")) for (const i of libraryImports(text, name, USAGE_PACKAGE, known)) imports.add(i);
      }
      graph.push({ name, imports: [...imports].sort(), files, bytes });
    }
    // what the repository imports
    const imports: ConsumerImport[] = [];
    for (const rel of await w.files.walk(root)) {
      if (!CODE.test(rel) || SKIPPED.test(`${rel}`) || rel.startsWith("node_modules/")) continue;
      const text = await w.files.read(join(root, rel));
      if (text !== undefined && text.includes(USAGE_PACKAGE)) imports.push(...consumerImports(text, rel, USAGE_PACKAGE));
    }
    const report = usageOf(USAGE_PACKAGE, imports, graph);
    return outcomeOfDone({
      data: report,
      text: usageText(report),
      findings: report.unknown.map((u) => finding("warn", "E-USAGE-UNKNOWN", `${u} is imported as ${USAGE_PACKAGE}/${u}, and the package holds no such library`, "repoctl usage --help")),
      title: `${report.totals.direct.libraries} imported, ${report.totals.reached.libraries} reached, ${report.totals.untouched.libraries} never touched`,
    });
  },
});
