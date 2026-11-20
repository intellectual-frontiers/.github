/**
 * Commons installed as a Git dependency and used, as a consumer uses it (commons 0005-typescript-runtime FR-029, FR-030, FR-070): an
 * empty project depends on the repository's root package at one commit by a `git+file:` URL, Bun installs it, and then, on Bun and on
 * Node 26 (through the hook, `--import @intellectual-frontiers/commons/ts/node`), a small program imports the kernel, the runtime and the
 * test registration by the package's name and uses each, and the package's own `ifc test run` runs a small suite and writes its record;
 * and TypeScript 7 checks a consumer against the sources. Any
 * failure, or a runtime that is not on `PATH`, ends with status 1.
 *
 * `bun tools/smoke.ts [--repo DIR] [--commit SHA]`: by default the checkout this file is in, at its `HEAD`; the commit must be committed.
 *
 * @module
 */
import { decodeManifest } from "./manifest.ts";
import { existsSync, makeTempDir, mkdir, readDirSync, readTextFileSync, remove, writeTextFile } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, join, resolve, toFileUrl } from "@intellectual-frontiers/system/path";
import { args, execPath, exit, run, runtimeName, which } from "@intellectual-frontiers/system/proc";

const NAME = "@intellectual-frontiers/commons";

const PROGRAM = `
import { ok } from "@intellectual-frontiers/core";
import { sha256, tar, untar, filesOf } from "${NAME}/ts/kernel";
import { fs, proc, path } from "${NAME}/ts/runtime";
import { assertEquals } from "${NAME}/ts/runtime/test";
assertEquals(ok(1), { kind: "ok", value: 1 });
assertEquals(await sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
const t = tar(new Map([["a/b.txt", new TextEncoder().encode("hi")]]));
if (t.kind !== "ok") throw new Error("tar");
const back = untar(t.value);
if (back.kind !== "ok") throw new Error("untar");
assertEquals(new TextDecoder().decode(filesOf(back.value).get("a/b.txt")), "hi");
const dir = await fs.makeTempDir({ prefix: "ifc-smoke-" });
await fs.writeTextFile(path.join(dir, "x.txt"), "x");
assertEquals(await fs.readTextFile(path.join(dir, "x.txt")), "x");
await fs.remove(dir, { recursive: true });
console.log("ok on " + proc.runtimeName() + " " + proc.runtimeVersion());
`;

const SUITE = `
import { assertEquals, proves } from "${NAME}/ts/runtime/test";
import { ok } from "@intellectual-frontiers/core";
proves(["0005-typescript-runtime FR-030"], "a consumer's test, run by ifc test", () => assertEquals(ok(2), { kind: "ok", value: 2 }));
`;

/** The version of the foundation that the root package depends on, which a consumer names too (commons 0032-lifting-libraries FR-011). */
const CORE_VERSION = "0.1.0";

const CONSUMER = `
import { andThen, ok, type Result } from "@intellectual-frontiers/core";
import { type Sha256, sha256 } from "${NAME}/ts/kernel";
import { errors, fs } from "${NAME}/ts/runtime";
const r: Result<number, string> = andThen(ok(1), (n: number) => ok(n + 1));
const s: Sha256 = await sha256("abc");
const t: string = await fs.readTextFile("x").catch((e: unknown) => (e instanceof errors.NotFound ? "" : String(e)));
// @ts-expect-error a plain string is not a Sha256
const bad: Sha256 = "abc";
export { bad, r, s, t };
`;

const HERE = resolve(dirname(fromFileUrl(import.meta.url)), "..");

/** Stop with a message and status 1. */
function stop(message: string): never {
  console.error(`smoke: ${message}`);
  return exit(1);
}

/** The value after a flag of the command line, if it is given. */
function option(flag: string): string | undefined {
  const at = args.indexOf(flag);
  return at < 0 ? undefined : args[at + 1];
}

const bun = runtimeName() === "bun" ? execPath() : which("bun");
if (bun === undefined) stop("bun is not on PATH");
const repo = resolve(option("--repo") ?? join(HERE, "..", ".."));
const head = await run(["git", "rev-parse", "HEAD"], { cwd: repo });
const commit = option("--commit") ?? (head.success ? head.stdout.trim() : stop(`git rev-parse HEAD failed in ${repo}`));
const url = `git+${toFileUrl(repo).href}#${commit}`;

const root = decodeManifest(readTextFileSync(join(repo, "package.json")));
if (root.kind === "err") stop(root.error);
const dir = await makeTempDir({ prefix: "ifc-ts-smoke-" });
let failed = false;
const fail = (message: string): void => {
  console.error(message);
  failed = true;
};
try {
  await writeTextFile(
    join(dir, "package.json"),
    JSON.stringify({
      name: "smoke",
      private: true,
      type: "module",
      dependencies: { [NAME]: url, "@intellectual-frontiers/core": CORE_VERSION },
    }),
  );
  await writeTextFile(join(dir, "check.ts"), PROGRAM);
  await mkdir(join(dir, "tests"));
  await writeTextFile(join(dir, "tests", "consumer.test.ts"), SUITE);
  await writeTextFile(join(dir, "consumer.ts"), CONSUMER);
  const pkg = join(dir, "node_modules", ...NAME.split("/"));
  await writeTextFile(
    join(dir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "nodenext",
        target: "es2024",
        strict: true,
        noEmit: true,
        allowImportingTsExtensions: true,
        exactOptionalPropertyTypes: true,
        noUncheckedIndexedAccess: true,
        types: ["node"],
        typeRoots: [join(HERE, "node_modules", "@types")],
      },
      files: ["consumer.ts"],
    }),
  );
  const install = await run([bun, "install"], { cwd: dir });
  if (!install.success) stop(`bun install ${url} failed:\n${install.stdout}${install.stderr}`);
  const lock = readTextFileSync(join(dir, "bun.lock"));
  if (lock.includes(commit)) console.log(`bun.lock holds the commit ${commit}`);
  else fail(`smoke: bun.lock does not hold the commit ${commit}`);
  const ifc = join(pkg, ...(root.value.bin?.["ifc"] ?? "./commons/ts/node/ifc.mjs").slice(2).split("/"));
  const hook = `${NAME}/ts/node`;
  const runtimes: readonly {
    readonly name: "bun" | "node";
    readonly program: readonly string[];
    readonly ifc?: readonly string[];
  }[] = [
    { name: "bun", program: ["check.ts"], ifc: [ifc] },
    { name: "node", program: ["--import", hook, "check.ts"], ifc: [ifc] },
  ];
  for (const r of runtimes) {
    const exe = r.name === "bun" ? bun : which(r.name);
    if (exe === undefined) {
      fail(`smoke: ${r.name} is not on PATH`);
      continue;
    }
    const out = await run([exe, ...r.program], { cwd: dir });
    if (out.success) console.log(`${r.name}: ${out.stdout.trim()}`);
    else fail(`${r.name}: failed (${out.code})\n${out.stdout}${out.stderr}`);
    if (r.ifc === undefined) continue;
    const results = join(dir, `results-${r.name}`);
    const test = await run([exe, ...r.ifc, "test", "run", "--runtime", r.name, "--out", results, "tests"], { cwd: dir });
    const records = existsSync(results) ? [...readDirSync(results)].filter((e) => e.name.endsWith(".otlp.json")) : [];
    if (test.success && records.length === 1) console.log(`${r.name}: ifc test run: ${test.stdout.trim().split("\n")[0] ?? ""}`);
    else fail(`${r.name}: ifc test run failed (${test.code}, ${records.length} records)\n${test.stdout}${test.stderr}`);
  }
  const tsc = await run([bun, join(HERE, "node_modules", "typescript", "bin", "tsc"), "-p", dir], { cwd: dir });
  if (tsc.success) console.log("tsc: a consumer type-checks against the sources");
  else fail(`tsc: failed (${tsc.code})\n${tsc.stdout}${tsc.stderr}`);
} finally {
  await remove(dir, { recursive: true }).catch(() => {});
}
if (failed) exit(1);
