// Spec: 0002-workspace-model FR-014
/**
 * What the host answers when it is asked (commons 0002-workspace-model FR-014, FR-038, 0003-host FR-023): the version of a tool by running it (`git`, `bun`, `node`, which `ergonex` probes and
 * never installs), the type of the file system the root is on, whether Windows' long paths are on, and whether `direnv` is there. Each answer is a fact for a pure check to judge; none changes anything.
 *
 * @remarks
 * A probe that cannot be made says why and is never a guess: the file system is read by `stat -f` on Linux and by the table of mounts on macOS, never from the look of the path, and on Windows
 * (where `ergonex` has no probe for it yet) it is `not-run` with that reason. A program is run by its argument vector, with no shell.
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/commons/ts/kernel";
import { readTextFile, realPath } from "../platform/r-fs.ts";
import { build, run, which } from "../platform/r-proc.ts";
import type { FsProbe, LongPaths, ToolProbe } from "../doctor.ts";

/** The version a tool's `--version` says: the first run of digits and dots in its first line (`git version 2.50.0` is `2.50.0`, `v26.13.1` is `26.13.1`). */
export function versionIn(text: string): string | undefined {
  return /(\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?)/.exec(text.split("\n")[0] ?? "")?.[1];
}

/** The version of a program on the `PATH`, or undefined where it is not there or does not say. */
export async function probeTool(name: string, path?: string): Promise<ToolProbe> {
  if (which(name, path) === undefined) return { name, version: undefined };
  try {
    const r = await run([name, "--version"], path === undefined ? {} : { env: { PATH: path } });
    return { name, version: r.success ? versionIn(r.stdout) : undefined };
  } catch {
    return { name, version: undefined };
  }
}

/** Whether the system is WSL: Linux whose kernel says it is Microsoft's. */
export async function isWsl(): Promise<boolean> {
  if (build.os !== "linux") return false;
  try {
    return /microsoft/i.test(await readTextFile("/proc/version"));
  } catch {
    return false;
  }
}

/** The type of the file system a folder is on, as the system says it (never guessed from the path), or why the probe was not made. */
export async function probeFileSystem(folder: string): Promise<FsProbe> {
  const wsl = await isWsl();
  try {
    switch (build.os) {
      case "linux": {
        const r = await run(["stat", "-f", "-c", "%T", folder]);
        const type = r.stdout.trim();
        return r.success && type !== ""
          ? { kind: "found", type, wsl }
          : { kind: "not-run", reason: `stat -f did not answer for ${folder}` };
      }
      case "darwin": {
        const real = await realPath(folder);
        const r = await run(["mount"]);
        if (!r.success) return { kind: "not-run", reason: "mount did not answer" };
        let best: { readonly at: string; readonly type: string } | undefined;
        for (const line of r.stdout.split("\n")) {
          const m = /^.* on (.+) \(([^,)]+)/.exec(line);
          if (m?.[1] === undefined || m[2] === undefined) continue;
          const inside = real === m[1] || real.startsWith(m[1].endsWith("/") ? m[1] : `${m[1]}/`);
          if (inside && (best === undefined || m[1].length > best.at.length)) best = { at: m[1], type: m[2] };
        }
        return best === undefined
          ? { kind: "not-run", reason: `no mount holds ${folder}` }
          : { kind: "found", type: best.type, wsl: false };
      }
      case "windows":
      case "freebsd":
      case "netbsd":
      case "openbsd":
      case "solaris":
      case "aix":
      case "android":
      case "other":
        return {
          kind: "not-run",
          reason: `ergonex has no file-system probe for ${build.os} yet`,
        };
      default:
        return absurd(build.os);
    }
  } catch (e) {
    return {
      kind: "not-run",
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Whether Windows' long paths are on, read from the registry; `unknown` elsewhere and where the setting cannot be read. */
export async function probeLongPaths(): Promise<LongPaths> {
  if (build.os !== "windows") return "unknown";
  try {
    const r = await run(["reg", "query", "HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem", "/v", "LongPathsEnabled"]);
    if (!r.success) return "unknown";
    const m = /LongPathsEnabled\s+REG_DWORD\s+0x([0-9a-f]+)/i.exec(r.stdout);
    return m?.[1] === undefined ? "unknown" : Number.parseInt(m[1], 16) === 1 ? "enabled" : "disabled";
  } catch {
    return "unknown";
  }
}

/** Whether this process is elevated on Windows (`net session` succeeds only for an administrator); false elsewhere and where it cannot be told. */
export async function isElevated(): Promise<boolean> {
  if (build.os !== "windows") return false;
  try {
    return (await run(["net", "session"])).success;
  } catch {
    return false;
  }
}

/** Whether `direnv` is on the `PATH` (0003-host FR-023). */
export function direnvFound(path?: string): boolean {
  return which("direnv", path) !== undefined;
}
