/**
 * The packed package installed and used, before it is released (commons 0005-typescript-runtime FR-030): an empty project depends on the
 * tarball, Bun installs it, a small program imports the three entry points and uses each on Bun, Node and Deno, and a TypeScript consumer
 * is checked by TypeScript 7 against the declarations the package ships. Any failure, or a runtime that is not on `PATH`, ends with status 1.
 *
 * `bun tools/smoke.ts dist/intellectual-frontiers-ifc-ts-X.Y.Z.tgz`
 *
 * @module
 */
import { makeTempDir, remove, writeTextFile } from "../runtime/fs.ts";
import { dirname, fromFileUrl, join, resolve } from "../runtime/path.ts";
import { args, execPath, exit, run, runtimeName, which } from "../runtime/proc.ts";

const PROGRAM = `
import { ok, sha256, tar, untar, filesOf } from "@intellectual-frontiers/ifc-ts/kernel";
import { fs, proc, path } from "@intellectual-frontiers/ifc-ts/runtime";
import { assertEquals } from "@intellectual-frontiers/ifc-ts/runtime/test";
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

const CONSUMER = `
import { andThen, ok, type Result, type Sha256, sha256 } from "@intellectual-frontiers/ifc-ts/kernel";
import { errors, fs } from "@intellectual-frontiers/ifc-ts/runtime";
const r: Result<number, string> = andThen(ok(1), (n: number) => ok(n + 1));
const s: Sha256 = await sha256("abc");
const t: string = await fs.readTextFile("x").catch((e: unknown) => (e instanceof errors.NotFound ? "" : String(e)));
// @ts-expect-error a plain string is not a Sha256
const bad: Sha256 = "abc";
export { bad, r, s, t };
`;

const TSCONFIG = JSON.stringify({
  compilerOptions: { module: "nodenext", target: "es2024", strict: true, noEmit: true, types: ["node"], typeRoots: [] as string[] },
  files: ["consumer.ts"],
});

const ROOT = resolve(dirname(fromFileUrl(import.meta.url)), "..");

/** Stop with a message and status 1. */
function stop(message: string): never {
  console.error(`smoke: ${message}`);
  return exit(1);
}

const tarball = args[0];
if (tarball === undefined) stop("give the tarball's path");
const bun = runtimeName() === "bun" ? execPath() : which("bun");
if (bun === undefined) stop("bun is not on PATH");
const runtimes: readonly { readonly name: string; readonly argv: (exe: string) => readonly string[] }[] = [
  { name: "bun", argv: (exe) => [exe, "check.mjs"] },
  { name: "node", argv: (exe) => [exe, "check.mjs"] },
  { name: "deno", argv: (exe) => [exe, "run", "-A", "check.mjs"] },
];

const dir = await makeTempDir({ prefix: "ifc-ts-smoke-" });
let failed = false;
try {
  const dependency = { "@intellectual-frontiers/ifc-ts": `file:${resolve(tarball)}` };
  await writeTextFile(
    join(dir, "package.json"),
    JSON.stringify({ name: "smoke", private: true, type: "module", dependencies: dependency }),
  );
  await writeTextFile(join(dir, "check.mjs"), PROGRAM);
  await writeTextFile(join(dir, "consumer.ts"), CONSUMER);
  await writeTextFile(
    join(dir, "tsconfig.json"),
    TSCONFIG.replace('"typeRoots":[]', `"typeRoots":[${JSON.stringify(join(ROOT, "node_modules", "@types"))}]`),
  );
  const install = await run([bun, "install"], { cwd: dir });
  if (!install.success) stop(`bun install failed:\n${install.stdout}${install.stderr}`);
  for (const r of runtimes) {
    const exe = r.name === "bun" ? bun : which(r.name);
    if (exe === undefined) {
      console.error(`smoke: ${r.name} is not on PATH`);
      failed = true;
      continue;
    }
    const out = await run(r.argv(exe), { cwd: dir });
    if (out.success) console.log(`${r.name}: ${out.stdout.trim()}`);
    else {
      console.error(`${r.name}: failed (${out.code})\n${out.stdout}${out.stderr}`);
      failed = true;
    }
  }
  const tsc = await run([bun, join(ROOT, "node_modules", "typescript", "bin", "tsc"), "-p", dir], { cwd: dir });
  if (tsc.success) console.log("tsc: the declarations type-check a consumer");
  else {
    console.error(`tsc: failed (${tsc.code})\n${tsc.stdout}${tsc.stderr}`);
    failed = true;
  }
} finally {
  await remove(dir, { recursive: true }).catch(() => {});
}
if (failed) exit(1);
