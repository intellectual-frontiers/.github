/**
 * What the tests of Repoctl share: a real temporary Git repository, real programs (`git`, `bun`) run in it, small generators written as real Bun scripts, and the root of the real checkout.
 *
 * @module
 */
import { ok } from "@intellectual-frontiers/core";
import { run as runCli, hostIo } from "@intellectual-frontiers/headless/cli";
import type { TierName } from "@intellectual-frontiers/headless/governance";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { type Config, type ConfigInput, type Generator, parseConfig, parseStepId, type StepId, TIERS } from "@intellectual-frontiers/repoctl/governance";
import { type Host, repoctlProgram, systemFiles, systemProcess, systemWorld } from "@intellectual-frontiers/repoctl/physical";
import type { World } from "@intellectual-frontiers/repoctl/logical";

/** The root of the real checkout this library is in. */
export const CHECKOUT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "../../..");

/** The `node_modules` that holds the compiler the tests use: the root's where the root is installed, else this library's own (a job that installed only this library has no other). */
export const TOOLS_MODULES: string = fs.existsSync(path.join(CHECKOUT, "node_modules", ".bin")) ? path.join(CHECKOUT, "node_modules") : path.join(CHECKOUT, "commons/repoctl/node_modules");

/** Whether the root of the checkout is installed: a library job installs only its own folder, and the checks that run the root's compiler (`E-TYPES`) cannot run there. */
export const ROOT_INSTALLED: boolean = fs.existsSync(path.join(CHECKOUT, "node_modules", "typescript"));

/**
 * What `check --json` ended with, as a sentence that is empty where it ended as it must: with 0 where the root is installed, and, where only a library is (the library job of CI), with 1 and no failure but those of `E-TYPES`,
 * the checks that run the root's compiler.
 */
export function checkVerdict(status: number, report: string): string {
  if (ROOT_INSTALLED) return status === 0 ? "" : `check ended with ${status}: ${report}`;
  const doc: unknown = (() => {
    try {
      return JSON.parse(report);
    } catch {
      return undefined;
    }
  })();
  const problems: readonly unknown[] = typeof doc === "object" && doc !== null && "problems" in doc && Array.isArray(doc.problems) ? doc.problems : [];
  const others = problems.filter((p) => typeof p === "object" && p !== null && "level" in p && p.level === "fail" && !("code" in p && p.code === "E-TYPES"));
  return others.length === 0 ? "" : `check found more than the root's compiler: ${JSON.stringify(others)}`;
}

/** Runs `git` in a folder as a test identity and gives its output; a failure throws, so that a test never goes on from a step that did not happen. */
export async function git(dir: string, ...args: readonly string[]): Promise<string> {
  const r = await systemProcess.run(["git", "-C", dir, "-c", "user.name=Test", "-c", "user.email=test@example.test", "-c", "commit.gpgsign=false", "-c", "init.defaultBranch=main", ...args]);
  if (r.code !== 0) throw new Error(`git ${args.join(" ")} ended with ${r.code}: ${r.stderr}`);
  return r.stdout;
}

/** A Bun script that is a generator: it makes `out` from the sources `from` (`<name>=<text>` joined by a space), and with `--check` says whether `out` is that, ending with 1 where it is not. */
export function generatorScript(out: string, from: readonly string[]): string {
  return `import { existsSync, readFileSync, writeFileSync } from "node:fs";
const read = (f) => (existsSync(f) ? readFileSync(f, "utf8").trim() : "");
const made = ${JSON.stringify(from)}.map((f) => f.replace(/\\.txt$/, "") + "=" + read(f)).join(" ") + "\\n";
if (process.argv.includes("--check")) process.exit(existsSync(${JSON.stringify(out)}) && readFileSync(${JSON.stringify(out)}, "utf8") === made ? 0 : 1);
writeFileSync(${JSON.stringify(out)}, made);
`;
}

/** A step id from a word a test knows to be one. */
export function sid(word: string): StepId {
  const r = parseStepId(word);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

/** The identity and the trailers a test repository commits with (what a repository's configuration says; nothing of the host). */
export const TEST_IDENTITY = { name: "Test Author", email: "author@example.test" } as const;
/** The line that credits the agent in a test repository. */
export const TEST_CO_AUTHOR = "Co-Authored-By: A Helper <helper@example.test>";

/** The input of a minimal configuration, which a test completes with what it exercises. */
export function configInput(extra: Partial<ConfigInput> = {}): ConfigInput {
  return {
    repo: "fixture",
    commit: { identity: TEST_IDENTITY, issue: { prefix: "Refs #", required: false }, trailers: ["issue", "co-author", "session"], coAuthor: TEST_CO_AUTHOR },
    capabilities: { release: true, newLibrary: true, status: true, prove: true, query: true, ci: true },
    libraries: { folder: "commons" },
    docs: {},
    hygiene: { scope: "@family/", gitSources: ["family/platform"], pathSegment: "platform", sourceMarker: "platform/marker.ts" },
    ...extra,
  };
}

/** The settings of libraries a test world reads manifests with. */
export const LIBRARIES: Pick<Config, "libraries"> = { libraries: { folder: "commons", specKit: undefined, versionConstants: false, declaredDependencies: false, linker: undefined, roleFile: undefined, docsFile: undefined } };

/** A generator of a test that is a plain record: it is run as the program `<id>.ts`. */
export function genOf(id: string, inputs: readonly string[], outputs: readonly string[]): Generator {
  const argv = ["bun", `${id}.ts`] as const;
  return { id: sid(id), summary: id, run: { kind: "program", argv }, check: { kind: "program", argv: [...argv, "--check"] }, inputs, outputs, after: [], mixed: [] };
}

/** A configuration made from an input, or the failure of the test. */
export function configOf(extra: Partial<ConfigInput> = {}): Config {
  const r = parseConfig(configInput(extra));
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
}

/** A generator of the table of a test repository: its script is in the repository, it reads `from` and writes `out`. */
export function generator(id: string, script: string, out: string, from: readonly string[]): Generator {
  const config = configOf({ generators: [{ id, summary: `the ${id} of a test`, command: ["bun", script], inputs: [...from], outputs: [out] }] });
  const g = config.generators[0];
  if (g === undefined) throw new Error("no generator");
  return g;
}

/** A fresh repository with the generators' scripts committed, and its world; the folder is removed when `use` ends. */
export async function withRepo<T>(table: readonly { readonly id: string; readonly out: string; readonly from: readonly string[] }[], use: (dir: string, world: World, generators: readonly Generator[]) => Promise<T>): Promise<T> {
  return await fs.withTempDir(async (dir) => {
    await git(dir, "init", "-q");
    const generators: Generator[] = [];
    for (const t of table) {
      const script = `gen-${t.id}.mjs`;
      await systemFiles.write(path.join(dir, script), generatorScript(t.out, t.from));
      generators.push(generator(t.id, script, t.out, t.from));
    }
    const world: World = { ...systemWorld(dir, () => undefined, LIBRARIES), process: systemProcess };
    return await use(dir, world, generators);
  });
}

/** Whether `bun` and `git` can be run here: the tests that run them are left where they cannot. */
export const CAN_RUN: boolean = proc.which("git") !== undefined && proc.which("bun") !== undefined;

/** The result of running the program: the status and what it wrote to each stream. */
export type Ran = { readonly code: number; readonly out: string; readonly err: string };

/** Runs the program for a host (the world, its generators and its release host are the test's) and a tier, as the command line does, and gives what it wrote. */
export async function execute(host: Host, argv: readonly string[], options: { readonly tier?: TierName; readonly env?: Readonly<Record<string, string>> } = {}): Promise<Ran> {
  const { state: _state, ...io } = hostIo();
  const env = options.env ?? {};
  return await runCli(repoctlProgram(host), argv, { ...io, env: (n) => (env[n] === "" ? undefined : env[n]), tier: options.tier ?? TIERS.contributor, terminal: { stdin: false, stdout: false, stderr: false }, columns: 120 });
}

/** A host for a world, with generators of its own (none by default, so that a verb makes nothing the test did not give it) and the configuration the test names. */
export function hostOf(world: World, extra: Partial<Omit<Host, "config">> & { readonly generators?: readonly Generator[]; readonly config?: Partial<ConfigInput> } = {}): Host {
  const { generators, config, ...host } = extra;
  const base = configOf(config);
  return { env: () => undefined, world: () => ok(world), ...host, config: { ...base, generators: generators ?? base.generators } };
}

/** The text of a file written to a path, made where it is not (a convenience of the tests that build a repository). */
export async function put(root: string, file: string, text: string): Promise<void> {
  await systemFiles.write(path.join(root, file), text);
}
