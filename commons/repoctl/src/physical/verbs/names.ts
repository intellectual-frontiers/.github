// Spec: 0015-repoctl-names FR-001, FR-006, FR-007
/**
 * `repoctl names` on Headless (commons repoctl 0015-repoctl-names): the files of one or more trees read for the names of the names files, with the allowances those files give and the scope asked for. It reads and changes nothing,
 * and ends with 1 where a name is found, so that a platform repository can hold it in its checks.
 *
 * @example
 * ```ts
 * import { namesVerb } from "@intellectual-frontiers/repoctl/physical";
 * typeof namesVerb; // "function"
 * ```
 *
 * @module
 */
import { type Allowance, DEFAULT_SCOPE, describeName, findNames, finding, type NamedFile } from "@intellectual-frontiers/repoctl/logical";
import { toFileUrl } from "@intellectual-frontiers/system/path";
import { flag, value } from "@intellectual-frontiers/terminal/args";
import { defineVerb, outcomeOfDone, outcomeOfEnvironment } from "../define.ts";

const SKIPPED = /(?:^|\/)(?:\.git|build|dist|node_modules|coverage)\//;
const TEXT = /\.(?:ts|tsx|mts|js|mjs|cjs|json|json5|md|tsv|txt|toml|yml|yaml|ttl|rdf|ofn|sql|html|css)$/u;
const join = (...parts: readonly string[]): string => parts.join("/").replace(/\/{2,}/g, "/");
const absolute = (repo: string, p: string): string => (p.startsWith("/") ? p : join(repo, p));
const list = (text: string): readonly string[] => text.split(",").map((s) => s.trim()).filter((s) => s !== "");

const isTexts = (x: unknown): x is readonly string[] => Array.isArray(x) && x.every((e) => typeof e === "string");
const isAllowance = (x: unknown): x is Allowance => typeof x === "object" && x !== null && !Array.isArray(x) && Object.entries(x).every(([k, v]) => (k === "name" || k === "path") && typeof v === "string");

/** `repoctl names`. */
export const namesVerb = defineVerb({
  name: "names",
  id: "names",
  options: {
    names: value<never>({ help: "The names files: modules, separated by commas, that export `names` (a list of texts) and optionally `allowances` (a list of { name, path } where a name is allowed).", valueName: "FILE,FILE", required: true }),
    tree: value<never>({ help: "The trees to read, separated by commas (the repository repoctl runs in by default).", valueName: "DIR,DIR", default: "" }),
    scope: value<never>({ help: "The globs of the files to read, separated by commas (specifications, ontology, tests, fixtures and what is generated, by default).", valueName: "GLOB,GLOB", default: "" }),
    hide: flag({ help: "Say where a name is and never which, for a report that is kept in a public place." }),
  },
  examples: [
    { args: ["--names", "../tenants/names/parties.ts,../tenants/names/retired.ts"], says: "The files of this repository that hold a name the two files list." },
    { args: ["--names", "names.ts", "--tree", "../commons,../erga", "--hide", "--json"], says: "The same for two other trees, as one JSON document that does not repeat a name." },
  ],
  run: async (args, _ctx, w) => {
    const names: string[] = [];
    const allowances: Allowance[] = [];
    for (const file of list(args.options.names)) {
      const path = absolute(w.repo, file);
      let loaded: Record<string, unknown>;
      try {
        loaded = (await import(toFileUrl(path).href)) as Record<string, unknown>;
      } catch (cause) {
        return outcomeOfEnvironment(`${file} cannot be loaded: ${cause instanceof Error ? cause.message : String(cause)}`);
      }
      if (!isTexts(loaded["names"])) return outcomeOfEnvironment(`${file} does not export \`names\` as a list of texts`);
      names.push(...loaded["names"]);
      const given = loaded["allowances"];
      if (given !== undefined) {
        if (!Array.isArray(given) || !given.every(isAllowance)) return outcomeOfEnvironment(`${file} exports \`allowances\` as something other than a list of { name, path }`);
        allowances.push(...given);
      }
    }
    const trees = args.options.tree === "" ? [w.repo] : list(args.options.tree).map((t) => absolute(w.repo, t));
    const scope = args.options.scope === "" ? DEFAULT_SCOPE : list(args.options.scope);
    const found = [];
    let read = 0;
    for (const root of trees) {
      const files: NamedFile[] = [];
      for (const rel of await w.files.walk(root)) {
        if (!TEXT.test(rel) || SKIPPED.test(`${rel}`) || rel.startsWith("node_modules/")) continue;
        const text = await w.files.read(join(root, rel));
        if (text !== undefined) files.push({ path: rel, text });
      }
      read += files.length;
      found.push(...findNames(files, names, allowances, scope).map((f) => ({ ...f, tree: root })));
    }
    const hide = args.options.hide;
    return outcomeOfDone({
      data: hide ? { trees, read, found: found.map((f) => ({ tree: f.tree, path: f.path, line: f.line })) } : { trees, read, found },
      text: found.length === 0 ? `no name of ${names.length} is in the ${read} files read` : found.map((f) => `${f.tree}: ${describeName(f, hide)}`).join("\n"),
      findings: found.map((f) => finding("fail", "E-NAMES-FOUND", describeName(f, hide), "repoctl explain E-NAMES-FOUND")),
      title: `${found.length} found in ${read} files read`,
    });
  },
});
