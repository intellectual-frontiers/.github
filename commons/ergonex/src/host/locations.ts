// Spec: 0002-workspace-model FR-005
/**
 * Where Ergonex keeps what it remembers and installs, from the environment (commons 0031-install-locations FR-001 to FR-005): the folders `runtime/dirs.ts` gives for the program `ergonex` on this system, and the shims
 * of the tools it installs in `~/.local/bin` (on Windows, in the tools folder of its data). `placesOf` is an error where no home can be found and the `XDG_*` variables name no folder.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import { dirsOf, type Env, type Os } from "../platform/r-dirs.ts";
import { posix, win32 } from "../platform/r-path.ts";
import type { Places } from "../places.ts";

/** The folders for a system and an environment, or what is missing (no home folder and no variable). */
export function placesOf(env: Env, os: Os): Result<Places, string> {
  const d = dirsOf("ergonex", env, os);
  if (d.data === undefined || d.state === undefined || d.cache === undefined)
    return err(
      "no folder can be found to keep what ergonex remembers and installs: set HOME (USERPROFILE on Windows), or XDG_DATA_HOME and XDG_STATE_HOME",
    );
  const rules = os === "windows" ? win32 : posix;
  const tools = rules.join(d.data, "tools");
  const shims = d.bin ?? rules.join(tools, "bin");
  return ok({ os, data: d.data, state: d.state, cache: d.cache, tools, shims });
}
