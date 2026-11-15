/**
 * A program built into one binary with the pinned Bun (commons 0005-typescript-runtime FR-062): `bun build --compile`, for this computer or
 * for a target given (`linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`, `windows-x64`), with the files it embeds, giving the
 * binary's path and SHA-256. Bun is found as `bun` on `PATH`, or given by its path; where an expected version is given, a Bun of another
 * version is refused, so a build is made only by the pinned one. Everything that can go wrong is a `CompileError` in a `Result`.
 *
 * The argument vector is made by `compileArgv`, a pure function, so what is asked of Bun can be checked without running it; a program
 * built this way runs itself again with `proc.selfCommand()` (FR-053).
 *
 * @example
 * ```ts
 * import { compile } from "./compile.ts";
 * const r = await compile({ entry: "src/main.ts", outfile: "dist/tool", target: "windows-x64" });
 * if (r.kind === "ok") console.log(r.value.path, r.value.sha256); // dist/tool.exe, its SHA-256
 * ```
 *
 * @module
 */
import { absurd } from "../kernel/absurd.ts";
import { err, ok, type Result } from "../kernel/result.ts";
import type { Sha256 } from "../kernel/sha256.ts";
import { exists, sha256File } from "./fs.ts";
import { resolve } from "./path.ts";
import { build, cwd as processCwd, type Arch, type Os, output, which } from "./proc.ts";

/** A system Bun builds a binary for. */
export type Target = "linux-x64" | "linux-arm64" | "darwin-x64" | "darwin-arm64" | "windows-x64";

/** Every target, in a fixed order. */
export const TARGETS: readonly Target[] = ["linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64", "windows-x64"];

/** The target of a system, by `proc.build`'s names; undefined where Bun builds for no such system. */
export function targetOf(os: Os, arch: Arch): Target | undefined {
  const key = `${os}/${arch}`;
  switch (key) {
    case "linux/x86_64":
      return "linux-x64";
    case "linux/aarch64":
      return "linux-arm64";
    case "darwin/x86_64":
      return "darwin-x64";
    case "darwin/aarch64":
      return "darwin-arm64";
    case "windows/x86_64":
      return "windows-x64";
    default:
      return undefined;
  }
}

/** The target of this computer; undefined where Bun builds for no such system. */
export function hostTarget(): Target | undefined {
  return targetOf(build.os, build.arch);
}

/** Whether a target's binaries are Windows programs, named with `.exe`. */
export function isWindows(target: Target): boolean {
  switch (target) {
    case "windows-x64":
      return true;
    case "linux-x64":
    case "linux-arm64":
    case "darwin-x64":
    case "darwin-arm64":
      return false;
    default:
      return absurd(target);
  }
}

/** What to build. */
export type CompileOptions = {
  /** The program's entry point (a `.ts` or `.js` file). */
  readonly entry: string;
  /** Where the binary goes; `.exe` is added for Windows where it is not there, as Bun adds it. */
  readonly outfile: string;
  /** The system to build for; this computer where it is not given. */
  readonly target?: Target;
  /** Files embedded in the binary, beside the code its imports bring in. */
  readonly files?: readonly string[];
  /** Bun's path; `bun` on `PATH` where it is not given. */
  readonly bun?: string;
  /** The version Bun must be (the pin, such as `1.4.4`); any version where it is not given. */
  readonly bunVersion?: string;
  /** The folder the build runs in, against which relative paths are read; the process's working folder by default. */
  readonly cwd?: string;
  /** More of `bun build`'s options, put before the entry point (`--minify`, `--define=...`). */
  readonly extraArgs?: readonly string[];
  /** Stopping the build. */
  readonly signal?: AbortSignal;
};

/** A binary built. */
export type Compiled = {
  /** Its path, absolute. */
  readonly path: string;
  /** Its SHA-256. */
  readonly sha256: Sha256;
  /** The system it is for. */
  readonly target: Target;
  /** The version of Bun that built it. */
  readonly bunVersion: string;
};

/** Why a binary was not built. */
export type CompileError =
  | { readonly kind: "no-bun"; readonly message: string }
  | { readonly kind: "wrong-bun"; readonly expected: string; readonly found: string }
  | { readonly kind: "no-target"; readonly message: string }
  | { readonly kind: "failed"; readonly code: number; readonly stderr: string }
  | { readonly kind: "no-binary"; readonly path: string };

/** A sentence for a `CompileError`. */
export function describeCompileError(e: CompileError): string {
  switch (e.kind) {
    case "no-bun":
      return e.message;
    case "wrong-bun":
      return `Bun ${e.found} is not the pinned ${e.expected}`;
    case "no-target":
      return e.message;
    case "failed":
      return `bun build --compile failed (${e.code}): ${e.stderr.trim()}`;
    case "no-binary":
      return `bun build --compile wrote no binary at ${e.path}`;
    default:
      return absurd(e);
  }
}

/** The binary's path for a target: `outfile`, with `.exe` added for Windows where it is not there. */
export function binaryPath(outfile: string, target: Target): string {
  return isWindows(target) && !/\.exe$/i.test(outfile) ? `${outfile}.exe` : outfile;
}

/**
 * The argument vector that builds the binary (pure): `bun build --compile [--target=bun-<target>] --outfile=<path> [extra...] <entry>
 * [files...]`. A target is named only where one is given; without it Bun builds for the computer it runs on. The files after the entry
 * point are embedded in the binary.
 */
export function compileArgv(bun: string, options: CompileOptions, outfile: string): readonly string[] {
  return [
    bun,
    "build",
    "--compile",
    ...(options.target === undefined ? [] : [`--target=bun-${options.target}`]),
    `--outfile=${outfile}`,
    ...(options.extraArgs ?? []),
    options.entry,
    ...(options.files ?? []),
  ];
}

/** Builds a program into one binary with Bun (FR-062) and gives its path and SHA-256; a `CompileError` where it cannot. */
export async function compile(options: CompileOptions): Promise<Result<Compiled, CompileError>> {
  const target = options.target ?? hostTarget();
  if (target === undefined) return err({ kind: "no-target", message: `Bun builds no binary for ${build.os}/${build.arch}` });
  const bun = options.bun ?? which("bun");
  if (bun === undefined) return err({ kind: "no-bun", message: "no bun on PATH" });
  const where = options.cwd ?? processCwd();
  const run = { cwd: where, ...(options.signal === undefined ? {} : { signal: options.signal }) };
  let version: string;
  try {
    const v = await output([bun, "--version"], run);
    version = new TextDecoder().decode(v.stdout).trim();
    if (!v.success || version === "") return err({ kind: "no-bun", message: `${bun} --version failed (${v.code})` });
  } catch (e) {
    return err({ kind: "no-bun", message: `${bun}: ${e instanceof Error ? e.message : String(e)}` });
  }
  if (options.bunVersion !== undefined && version !== options.bunVersion) {
    return err({ kind: "wrong-bun", expected: options.bunVersion, found: version });
  }
  const path = resolve(where, binaryPath(options.outfile, target));
  const built = await output(compileArgv(bun, options, path), run);
  if (!built.success) return err({ kind: "failed", code: built.code, stderr: new TextDecoder().decode(built.stderr) });
  if (!(await exists(path))) return err({ kind: "no-binary", path });
  return ok({ path, sha256: await sha256File(path), target, bunVersion: version });
}
