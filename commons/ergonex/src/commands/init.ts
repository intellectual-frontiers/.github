// Spec: 0003-host FR-002
/**
 * `ergonex init` (commons 0003-host FR-002, 0001-ergonex FR-025): makes the root and the workspace's own area, and writes a starter manifest where there is none, then puts ergonex on the path by the runtime's global install (0004-onboarding FR-002); it installs no tool and changes nothing else outside the root, and run again it changes nothing. The starter is written once and never rewritten (0003-host FR-002).
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/commons/ts/kernel";
import { flag } from "../platform/k-args.ts";
import { exists, mkdir, writeTextFile } from "../platform/r-fs.ts";
import { GLOBAL_OPTIONS, defineCommand, type ErgonexModule } from "../modules/types.ts";
import { AREA, manifestPath } from "../host/workspace.ts";
import { starterManifest } from "../setup/starter.ts";
import { launchFor } from "../setup/onpath.ts";
import { putOnPath, type PathDeps } from "../setup/host/path.ts";
import { ERGONEX_VERSION } from "../state-record.ts";
import { dirname, fromFileUrl, join } from "../platform/r-path.ts";
import { run as runProgram, runtimeName, which } from "../platform/r-proc.ts";

/** The files that run now: the launcher of this package, where it is. */
const ENTRY = join(dirname(fromFileUrl(import.meta.url)), "..", "..", "bin", "ergonex.mjs");

/** The host as the step of the path uses it. */
const hostDeps: PathDeps = {
  which: (name) => which(name),
  run: (argv) => runProgram(argv),
};

const OPTIONS = {
  ...GLOBAL_OPTIONS,
  noInstall: flag({
    help: "Make the root only: do not put ergonex on the path.",
  }),
  noPath: flag({
    help: "On Windows, do not add the folder of the command files to your path.",
  }),
};

const init = defineCommand({
  name: "init",
  summary: "Make the root and the workspace's own area, write a starter manifest where there is none, and put ergonex on your path.",
  options: OPTIONS,
  run: async (ctx, args) => {
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
        : [`made ${made.length} thing${made.length === 1 ? "" : "s"} in ${home}:`, ...made.map((m) => `  ${m}`)];
    let onPath: { readonly how: string } | undefined;
    if (!args.options.noInstall) {
      const r = await putOnPath(
        hostDeps,
        launchFor({
          runtime: runtimeName(),
          entry: ENTRY,
          version: ERGONEX_VERSION,
        }),
      );
      lines.push(...r.lines);
      onPath = r.data;
    }
    lines.push("next: add a repository with `ergonex add github.com/owner/repo --apply`");
    return ok({
      text: lines.join("\n"),
      data: { home, made, onPath: onPath ?? null },
      findings: [],
    });
  },
});

/** The module `ergonex init`. */
export const initModule: ErgonexModule = {
  name: "init",
  summary: init.summary,
  commands: [init],
};
