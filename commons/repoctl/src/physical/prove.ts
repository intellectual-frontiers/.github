// Spec: 0008-repoctl-prove FR-001
/**
 * What `repoctl prove` does in the world (commons repoctl 0008-repoctl-prove FR-001, FR-006 to FR-008): it asks Git what changed (the files and their text at the merge base and now), reads the import graph of the libraries from their
 * sources, has the compiler emit the declarations of a library at the base and now so that their fingerprints can be compared, asks the planner of the Logical layer for the plan (again, where it needs a surface it was not given), and runs
 * the proofs of the tiers that run on this machine. Each proof is one program run in the folder it belongs to.
 *
 * @remarks
 * The declarations at the base come from `git archive` of the library's folder into a private folder that shares the checkout's `node_modules`, so that the base is compiled by the compiler of the checkout; a library's dependencies are the
 * checkout's, so only the library's own sources differ between the two emits.
 *
 * @limits
 * T4 runs the root tests that run hermetically; T5 and T6 are planned and left to CI, the nightly run and the release, because they need other systems or every library.
 *
 * @example
 * ```ts
 * import { commandOf } from "./prove.ts";
 * commandOf("/repo", { kind: "sync-check" }, "origin/main")?.argv[0]; // "bun"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { affectedBy } from "@intellectual-frontiers/libraries/affected";
import { libraryDirs, readLibraries } from "@intellectual-frontiers/libraries/libraries";
import { LIBRARY_CI } from "@intellectual-frontiers/libraries/workflows/definitions";
import { symlink } from "@intellectual-frontiers/system/fs";
import { join } from "@intellectual-frontiers/system/path";
import { build } from "@intellectual-frontiers/system/proc";
import { FOUNDATION, type LibraryName, parseLibraryName, type Proof, tierOfProof, type ProofTier } from "@intellectual-frontiers/repoctl/governance";
import {
  type ChangedFile,
  classifyFile,
  declarationsOf,
  type Declaration,
  fingerprintOf,
  libraryOfPath,
  type LibraryInfo,
  type LibraryNode,
  type LibrarySurface,
  mentionsOf,
  planProof,
  pool,
  type ProofInput,
  type ProofPlan,
  surfaceDelta,
  tailLines,
  type Use,
  usagesOf,
  type World,
} from "@intellectual-frontiers/repoctl/logical";

/** The revision a plan compares with where none is given. */
export const DEFAULT_BASE = "origin/main";

/** What Git says changed: the merge base and the files with their text there and now, or that it cannot say. */
export type Changes = { readonly known: true; readonly mergeBase: string; readonly changed: readonly ChangedFile[] } | { readonly known: false; readonly why: string };

/** The files changed since the merge base of `base` and the head (the working tree's tracked and new files included), each with its text at the merge base and now. */
export async function gatherChanges(w: World, base: string): Promise<Changes> {
  const git = (...args: readonly string[]) => w.process.run(["git", "-C", w.repo, ...args]);
  const mb = await git("merge-base", base, "HEAD");
  if (mb.code !== 0) return { known: false, why: `git has no merge base of ${base} and HEAD` };
  const mergeBase = mb.stdout.trim();
  const diff = await git("diff", "--name-only", "--no-renames", mergeBase);
  const fresh = await git("ls-files", "--others", "--exclude-standard");
  if (diff.code !== 0 || fresh.code !== 0) return { known: false, why: "git diff failed" };
  const paths = [...new Set([...diff.stdout.split("\n"), ...fresh.stdout.split("\n")])].filter((p) => p !== "").sort();
  const changed = await pool(paths, 8, async (path): Promise<ChangedFile> => {
    const was = await git("show", `${mergeBase}:${path}`);
    return { path, before: was.code === 0 ? was.stdout : undefined, after: await w.files.read(join(w.repo, path)) };
  });
  return { known: true, mergeBase, changed: changed.filter((c) => c.before !== c.after) };
}

/** The libraries of the repository as the planner reads them: what each imports from the others, whether it is foundation and the systems it has code of its own for. */
export async function readGraph(w: World): Promise<Result<readonly LibraryNode[], string>> {
  const listed = await w.libraries.list();
  if (listed.kind === "err") return listed;
  const named = listed.value.flatMap((l): readonly { readonly info: LibraryInfo; readonly name: LibraryName }[] => {
    const n = parseLibraryName(l.name);
    return n.kind === "ok" ? [{ info: l, name: n.value }] : [];
  });
  // the metapackage `commons` has no code: what imports `@intellectual-frontiers/commons` imports the kernel, which is no library
  const byPackage = new Map(named.filter((n) => n.name !== "commons").map((n) => [n.info.package, n.name]));
  const nodes = await pool(named, 8, async ({ info, name }): Promise<LibraryNode> => {
    const files = (await w.files.walk(join(w.repo, info.folder))).filter((f) => /\.(?:ts|mts|mjs)$/.test(f));
    const merged = new Map<LibraryName, { all: boolean; names: Set<string> }>();
    for (const f of files) {
      const text = await w.files.read(join(w.repo, info.folder, f));
      if (text === undefined || !text.includes("@intellectual-frontiers/")) continue;
      for (const [pkg, usage] of usagesOf(text)) {
        const provider = byPackage.get(pkg);
        if (provider === undefined || provider === name) continue;
        const e = merged.get(provider) ?? { all: false, names: new Set<string>() };
        merged.set(provider, { all: e.all || usage.all, names: new Set([...e.names, ...usage.names]) });
      }
    }
    const uses: readonly Use[] = [...merged].sort(([a], [b]) => (a < b ? -1 : 1)).map(([provider, e]) => ({ provider, usage: { all: e.all, names: [...e.names].sort() } }));
    const systems = (LIBRARY_CI[name]?.systems ?? []).map((s) => (s === "windows-latest" ? ("windows" as const) : ("macos" as const)));
    return { name, package: info.package, folder: info.folder, foundation: FOUNDATION.includes(name), uses, systems };
  });
  return ok(nodes);
}

const scopeOf = (repo: string): string => repo.replace(/[\\/]$/, "");

/** The entries of a package's `exports` as files from the library's folder. */
function entriesOf(packageJson: string | undefined): readonly string[] {
  if (packageJson === undefined) return [];
  try {
    const x: unknown = JSON.parse(packageJson);
    const e = typeof x === "object" && x !== null && "exports" in x ? x.exports : undefined;
    const targets = (v: unknown): readonly string[] =>
      typeof v === "string" ? [v] : typeof v === "object" && v !== null ? Object.values(v).flatMap(targets) : [];
    return targets(e).filter((t) => /\.(?:ts|mts)$/.test(t));
  } catch {
    return [];
  }
}

/** The declarations the compiler emits for the entries of a library in `dir`, from the checkout `repo` whose compiler and links are used. */
async function emit(w: World, repo: string, dir: string, libDir: string, packageJson: string | undefined): Promise<Result<readonly Declaration[], string>> {
  const entries = entriesOf(packageJson);
  if (entries.length === 0) return err("the package names no TypeScript entry");
  const out = join(dir, "decl");
  const config = {
    extends: join(scopeOf(repo), "commons", "tsconfig.base.json"),
    compilerOptions: {
      lib: ["es2024", "dom", "dom.iterable"],
      skipLibCheck: true,
      declaration: true,
      emitDeclarationOnly: true,
      noEmit: false,
      removeComments: true,
      incremental: false,
      composite: false,
      noEmitOnError: false,
      outDir: out,
      rootDir: libDir,
      typeRoots: [join(scopeOf(repo), "node_modules", "@types")],
    },
    include: entries.map((e) => join(libDir, e)),
  };
  const configFile = join(dir, "tsconfig.json");
  await w.files.write(configFile, JSON.stringify(config));
  const tsc = join(scopeOf(repo), "node_modules", ".bin", build.os === "windows" ? "tsc.cmd" : "tsc");
  await w.process.run([tsc, "-p", configFile, "--pretty", "false"], { cwd: libDir });
  const files = (await w.files.walk(out)).filter((f) => f.endsWith(".d.ts"));
  if (files.length === 0) return err("the compiler emitted no declaration");
  const found: Declaration[] = [];
  for (const f of files) found.push(...declarationsOf(f, (await w.files.read(join(out, f))) ?? ""));
  return ok(found);
}

async function hashesOf(declarations: readonly Declaration[]): Promise<(text: string) => string> {
  const known = new Map<string, string>();
  for (const d of declarations) if (!known.has(d.text)) known.set(d.text, await sha256(d.text));
  return (text) => known.get(text) ?? "";
}

/** The surface of a library now and, where it changed, against the merge base: the delta and what its declarations mention. */
export async function surfaceOfLibrary(w: World, node: LibraryNode, mergeBase: string, changedHere: boolean): Promise<LibrarySurface> {
  const scratch = await w.files.makeTemp("repoctl-prove-");
  try {
    const now = await emit(w, w.repo, join(scratch, "now"), join(w.repo, node.folder), await w.files.read(join(w.repo, node.folder, "package.json")));
    if (now.kind === "err") return { delta: { kind: "unknown", why: now.error }, mentions: [] };
    const mentions = mentionsOf(now.value);
    if (!changedHere) return { delta: { kind: "same" }, mentions };
    const tar = join(scratch, "base.tar");
    const root = join(scratch, "base");
    await w.files.write(join(root, ".keep"), "");
    const pkgThen = await w.process.run(["git", "-C", w.repo, "show", `${mergeBase}:${node.folder}/package.json`]);
    const archived = await w.process.run(["git", "-C", w.repo, "archive", "--format=tar", `--output=${tar}`, mergeBase, node.folder]);
    if (archived.code !== 0 || pkgThen.code !== 0) return { delta: { kind: "unknown", why: `${node.folder} is not at ${mergeBase}` }, mentions };
    const unpacked = await w.process.run(["tar", "-xf", tar, "-C", root]);
    if (unpacked.code !== 0) return { delta: { kind: "unknown", why: "the base could not be unpacked" }, mentions };
    await symlink(join(scopeOf(w.repo), "commons", "node_modules"), join(root, "commons", "node_modules"), { type: "junction" }).catch(() => undefined);
    await symlink(join(scopeOf(w.repo), "node_modules"), join(root, "node_modules"), { type: "junction" }).catch(() => undefined);
    const then = await emit(w, w.repo, join(scratch, "then"), join(root, node.folder), pkgThen.stdout);
    if (then.kind === "err") return { delta: { kind: "unknown", why: `at the base: ${then.error}` }, mentions };
    const hash = await hashesOf([...now.value, ...then.value]);
    return { delta: surfaceDelta(fingerprintOf(then.value, hash), fingerprintOf(now.value, hash)), mentions };
  } finally {
    await w.files.removeTree(scratch);
  }
}

/** What a plan was made from, for the numbers a run reports and the selection of tests: the changed files, the libraries and their surfaces. */
export type Planned = {
  readonly plan: ProofPlan;
  readonly seconds: number;
  readonly surfaces: number;
  readonly changed: readonly ChangedFile[];
  readonly graph: readonly LibraryNode[];
};

/** The plan of the working tree against a base, or why it cannot be made. */
export async function makePlan(w: World, base: string, all: boolean): Promise<Result<Planned, string>> {
  const t0 = performance.now();
  const graph = await readGraph(w);
  if (graph.kind === "err") return graph;
  const changes = await gatherChanges(w, base);
  const changed = changes.known ? changes.changed : [];
  const libraryOf = libraryOfPath(graph.value);
  const outside = changed.filter((c) => {
    const k = classifyFile(c, libraryOf);
    return k.class === "outside";
  });
  const readers = outside.length === 0 ? [] : affectedBy(w.repo, outside.map((c) => c.path), "code").flatMap((l) => (graph.value.some((n) => n.name === l.name) ? [l.name] : []));
  const names = new Set(readers.flatMap((r) => graph.value.filter((n) => n.name === r).map((n) => n.name)));
  const surfaces = new Map<LibraryName, LibrarySurface>();
  const changedLibs = new Set(changed.flatMap((c) => classifyFile(c, libraryOf)).flatMap((f) => (f.class === "source" && f.library !== undefined ? [f.library] : [])));
  for (let round = 0; round <= graph.value.length; round++) {
    const input: ProofInput = {
      base,
      gitKnown: changes.known,
      all,
      changed,
      libraries: graph.value,
      surfaces,
      outsideReaders: [...names].sort(),
    };
    const step = planProof(input);
    if (step.kind === "plan") return ok({ plan: step.plan, seconds: (performance.now() - t0) / 1000, surfaces: surfaces.size, changed, graph: graph.value });
    const mb = changes.known ? changes.mergeBase : base;
    const fresh = step.libraries.filter((n) => !surfaces.has(n));
    const made = await pool(fresh, 4, async (n) => {
      const node = graph.value.find((l) => l.name === n);
      return [n, node === undefined ? ({ delta: { kind: "unknown", why: "no such library" }, mentions: [] } satisfies LibrarySurface) : await surfaceOfLibrary(w, node, mb, changedLibs.has(n))] as const;
    });
    for (const [n, s] of made) surfaces.set(n, s);
    if (fresh.length === 0) return err("the planner kept asking for a surface it was given");
  }
  return err("the planner did not settle");
}

/** A program to run for a proof, in a folder, with what is needed to say that it does not apply here. */
export type Command = { readonly argv: readonly string[]; readonly cwd: string; readonly needs?: string };

/** The program a proof runs, from the checkout's root; none where the proof runs elsewhere (CI, the nightly run, the release). */
export function commandOf(repo: string, proof: Proof, base: string, known?: (name: LibraryName) => string): Command | undefined {
  const root = scopeOf(repo);
  // where a library is comes from its manifest: an extension of a host is inside the folder of its host (0027-commons-libraries FR-026)
  let dirs: ReadonlyMap<string, string> | undefined;
  const folderOf = known ?? ((n: LibraryName): string => `commons/${(dirs ??= libraryDirs(readLibraries(root))).get(n) ?? n}`);
  const at = (name: LibraryName): string => join(root, folderOf(name));
  switch (proof.kind) {
    case "docs-check":
      return { argv: ["bun", "main.ts", "check"], cwd: join(root, "commons", "docs"), needs: "main.ts" };
    case "spec-check":
      return proof.scope === "repository" ? { argv: ["bun", "commons/tools/mizan-check.ts"], cwd: root } : { argv: ["bun", "../tools/mizan-check.ts", "--root", "spec-kit"], cwd: at(proof.scope), needs: "spec-kit" };
    case "trace-check":
      return { argv: ["bun", "tools/check.ts"], cwd: at(proof.library), needs: "tools/check.ts" };
    case "types":
      return { argv: [join(root, "node_modules", ".bin", build.os === "windows" ? "tsc.cmd" : "tsc"), "-p", "tsconfig.json", "--pretty", "false"], cwd: at(proof.library), needs: "tsconfig.json" };
    case "sync-check":
      return { argv: ["bun", "commons/repoctl/src/repoctl.ts", "sync", "--check"], cwd: root };
    case "versions-check":
      return { argv: ["bun", "commons/libraries/src/versions.ts", "check", "--base", base], cwd: root };
    case "suite":
    case "smoke":
      return { argv: ["bun", "test", "suite/"], cwd: at(proof.library), needs: "suite" };
    case "seam":
      return { argv: ["bun", "test", "suite/"], cwd: at(proof.consumer), needs: "suite" };
    case "pack":
      return { argv: ["bun", "tools/pack.ts", "--check"], cwd: at(proof.library), needs: "tools/pack.ts" };
    case "end-to-end":
      return { argv: ["bun", "test", "./tests/"], cwd: root, needs: "tests" };
    case "platform":
    case "release-gate":
      return undefined;
    default:
      return undefined;
  }
}

/** How a proof ended on this machine. */
export type ProofOutcome =
  | { readonly kind: "passed"; readonly seconds: number; readonly detail: string }
  | { readonly kind: "failed"; readonly seconds: number; readonly output: readonly string[]; readonly detail: string }
  | { readonly kind: "not-here"; readonly why: string };

/** Runs one proof's program in its folder. */
export async function runProof(w: World, proof: Proof, base: string): Promise<ProofOutcome> {
  const command = commandOf(w.repo, proof, base);
  if (command === undefined) return { kind: "not-here", why: `${tierOfProof(proof)} runs in CI, the nightly run and the release` };
  if (command.needs !== undefined && !(await w.files.exists(join(command.cwd, command.needs)))) return { kind: "not-here", why: `there is no ${command.needs} here` };
  const t0 = performance.now();
  const r = await w.process.run(command.argv, { cwd: command.cwd, env: { CI: "" } });
  const seconds = (performance.now() - t0) / 1000;
  return r.code === 0 ? { kind: "passed", seconds, detail: "" } : { kind: "failed", seconds, output: tailLines(`${r.stdout}\n${r.stderr}`, 30), detail: "" };
}

/** The tiers that run on a machine by default: the cheap ones, which are what an edit and a push need. */
export const LOCAL_TIERS: readonly ProofTier[] = ["T0", "T1", "T2", "T3"];
