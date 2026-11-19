// Spec: 0047-arcactl-init FR-013
/**
 * The shell profile (commons data 0047-arcactl-init FR-013): the script `arcactl shell` prints for a person's default instance is kept in a cache file of `arcactl`'s, so that a shell starts
 * fast and does not run `arcactl` each time, and a managed block in the profile of the shell sources it where it is there. The block is `arcactl:shell`, which is not the block of Ergonex
 * (`# >>> ergonex >>>`): both can be in one profile.
 *
 * @module
 */
import { join } from "node:path";
import { quoteFish, quotePosix, quotePwsh, quoteNu, type ShellInput, shellScript } from "./shell.ts";
import type { Known } from "./state.ts";
import type { Paths, Shell } from "./workstation.ts";

/** The file the script of a shell is cached in. */
export const cacheOf = (paths: Paths, shell: Shell): string => join(paths.cache, `shell.${shell === "pwsh" ? "ps1" : shell}`);

/** What the script of a shell is made from, for an instance (none where a person has none yet). */
export function inputOf(shell: Shell, paths: Paths, known: Known | undefined): ShellInput {
  return {
    shell,
    schema: known?.schema ?? "arca",
    home: paths.config,
    ...(known === undefined ? {} : { instance: known.name, service: known.name }),
    ...(known?.env === undefined ? {} : { env: known.env }),
    ...(known?.models === undefined ? {} : { models: known.models }),
  };
}

/** The script that is cached, or why it cannot be made. */
export function scriptFor(shell: Shell, paths: Paths, known: Known | undefined): string {
  const r = shellScript(inputOf(shell, paths, known));
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
}

/** The lines of the block in the profile: source the cache where it is there. */
export function profileBody(shell: Shell, cache: string): string {
  switch (shell) {
    case "bash":
    case "zsh":
    case "sh":
      return `[ -r ${quotePosix(cache)} ] && . ${quotePosix(cache)}`;
    case "fish":
      return `test -r ${quoteFish(cache)}; and source ${quoteFish(cache)}`;
    case "pwsh":
      return `if (Test-Path ${quotePwsh(cache)}) { . ${quotePwsh(cache)} }`;
    case "nu":
      return `source ${quoteNu(cache.replaceAll("\\", "/"))}`;
  }
}
