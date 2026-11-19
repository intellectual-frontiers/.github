// Spec: 0003-host FR-002
/**
 * `ergonex init` (commons 0003-host FR-002, 0001-ergonex FR-025): makes the root and the workspace's own area, and writes a starter manifest where there is none. It is the part of a setup that stays
 * inside the root: it installs nothing and changes nothing outside it, and run again it changes nothing. The starter is written once and never rewritten (0003-host FR-002).
 *
 * @module
 */
import { ok } from "@intellectual-frontiers/commons/ts/kernel";
import { exists, mkdir, writeTextFile } from "../platform/r-fs.ts";
import { err } from "@intellectual-frontiers/commons/ts/kernel";
import { GLOBAL_OPTIONS, defineCommand, type ErgonexModule } from "../modules/types.ts";
import { AREA, manifestPath } from "../host/workspace.ts";
import { starterManifest } from "../setup/starter.ts";
import { join } from "../platform/r-path.ts";

const init = defineCommand({
  name: "init",
  summary: "Make the root and the workspace's own area, and write a starter manifest where there is none.",
  options: { ...GLOBAL_OPTIONS },
  run: async (ctx) => {
    if (ctx.home === undefined)
      return err({
        kind: "environment",
        message: "no root can be found: set ERGONEX_HOME, or HOME (USERPROFILE on Windows), or give --home",
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
      return err({
        kind: "environment",
        message: `the root ${home} cannot be written: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
    const lines =
      made.length === 0
        ? [`${home} is already a workspace; nothing changed`]
        : [
            `made ${made.length} thing${made.length === 1 ? "" : "s"} in ${home}:`,
            ...made.map((m) => `  ${m}`),
            "next: name your repositories in .ergonex/workspace.ts, then run `ergonex plan`",
          ];
    return ok({ text: lines.join("\n"), data: { home, made }, findings: [] });
  },
});

/** The module `ergonex init`. */
export const initModule: ErgonexModule = {
  name: "init",
  summary: init.summary,
  commands: [init],
};
