/**
 * What the tests of Repoctl share: a real temporary Git repository, real programs (`git`, `bun`) run in it, small generators written as real Bun scripts, and the root of the real checkout.
 *
 * @module
 */
import { ok } from "@intellectual-frontiers/core";
import { run as runCli, hostIo } from "@intellectual-frontiers/headless/cli";
import type { TierName } from "@intellectual-frontiers/headless/governance";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { type Generator, TIERS } from "@intellectual-frontiers/repoctl/governance";
import { type Host, repoctlProgram, systemFiles, systemProcess, systemWorld } from "@intellectual-frontiers/repoctl/physical";
import type { World } from "@intellectual-frontiers/repoctl/logical";

/** The root of the real checkout this library is in. */
export const CHECKOUT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "../../..");

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

/** A generator of the table of a test repository: its script is in the repository, it reads `from` and writes `out`. */
export function generator(id: Generator["id"], script: string, out: string, from: readonly string[]): Generator {
  return { id, summary: `the ${id} of a test`, command: [script], inputs: [...from], outputs: [out] };
}

/** A fresh repository with the generators' scripts committed, and its world; the folder is removed when `use` ends. */
export async function withRepo<T>(table: readonly { readonly id: Generator["id"]; readonly out: string; readonly from: readonly string[] }[], use: (dir: string, world: World, generators: readonly Generator[]) => Promise<T>): Promise<T> {
  return await fs.withTempDir(async (dir) => {
    await git(dir, "init", "-q");
    const generators: Generator[] = [];
    for (const t of table) {
      const script = `gen-${t.id}.mjs`;
      await systemFiles.write(path.join(dir, script), generatorScript(t.out, t.from));
      generators.push(generator(t.id, script, t.out, t.from));
    }
    const world: World = { ...systemWorld(dir, () => undefined), process: systemProcess };
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

/** A host for a world, with generators of its own (none by default, so that a verb makes nothing the test did not give it). */
export function hostOf(world: World, extra: Partial<Host> = {}): Host {
  return { env: () => undefined, world: () => ok(world), generators: [], ...extra };
}

/** The text of a file written to a path, made where it is not (a convenience of the tests that build a repository). */
export async function put(root: string, file: string, text: string): Promise<void> {
  await systemFiles.write(path.join(root, file), text);
}
