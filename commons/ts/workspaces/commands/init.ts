/**
 * `ifws init` (commons 0024-ifws-host FR-002, 0025-ifws FR-025): makes the root and the workspace's own area, and writes a starter manifest where there is none. It is the part of a setup that stays
 * inside the root: it installs nothing and changes nothing outside it, and run again it changes nothing. The starter is written once and never rewritten (0024-ifws-host FR-002).
 *
 * @module
 */
import { ok } from "../../kernel/result.ts";
import { exists, mkdir, writeTextFile } from "../../runtime/fs.ts";
import { err } from "../../kernel/result.ts";
import { GLOBAL_OPTIONS, defineCommand, type IfwsModule } from "../modules/types.ts";
import { AREA, manifestPath } from "../host/workspace.ts";
import { starterManifest } from "../setup/starter.ts";
import { join } from "../../runtime/path.ts";

const init = defineCommand({
  name: "init",
  summary: "Make the root and the workspace's own area, and write a starter manifest where there is none.",
  options: { ...GLOBAL_OPTIONS },
  run: async (ctx) => {
    if (ctx.home === undefined)
      return err({
        kind: "environment",
        message: "no root can be found: set IFC_WORKSPACES_HOME, or HOME (USERPROFILE on Windows), or give --home",
      });
    const home = ctx.home;
    const made: string[] = [];
    try {
      for (const folder of [home, join(home, AREA)]) {
        if (!(await exists(folder))) {
          await mkdir(folder, { recursive: true });
          made.push(folder);
        }
      }
      const manifest = manifestPath(home);
      if (!(await exists(manifest))) {
        await writeTextFile(manifest, starterManifest(), { createNew: true });
        made.push(manifest);
      }
    } catch (e) {
      return err({ kind: "environment", message: `the root ${home} cannot be written: ${e instanceof Error ? e.message : String(e)}` });
    }
    const lines =
      made.length === 0
        ? [`${home} is already a workspace; nothing changed`]
        : [
            `made ${made.length} thing${made.length === 1 ? "" : "s"} in ${home}:`,
            ...made.map((m) => `  ${m}`),
            "next: name your repositories in .if-workspaces/workspace.ts, then run `ifws plan`",
          ];
    return ok({ text: lines.join("\n"), data: { home, made }, findings: [] });
  },
});

/** The module `ifws init`. */
export const initModule: IfwsModule = { name: "init", summary: init.summary, commands: [init] };
