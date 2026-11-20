// Spec: 0004-onboarding FR-010
/**
 * `ergonex paths` (commons ergonex 0004-onboarding FR-010, commons 0031-install-locations): says where ergonex keeps its files, so that a person who knows XDG or Windows' folders finds each where they expect it: the
 * workspace's root and its own folder `.ergonex/` beside the repositories, the state folder (what ergonex remembers), the data folder and its tools folder (what it installs) and the folder of the shims of those tools.
 * It reads nothing and changes nothing.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { join } from "../platform/r-path.ts";
import { AREA } from "../host/workspace.ts";
import { GLOBAL_OPTIONS, defineCommand, type ErgonexModule } from "../modules/types.ts";

const paths = defineCommand({
  name: "paths",
  summary: "Say where ergonex keeps its files: the workspace, its state, its data, the tools it installs and their shims.",
  options: { ...GLOBAL_OPTIONS },
  run: (ctx) => {
    const places = ctx.places;
    if (places === undefined)
      return Promise.resolve(
        err({
          kind: "environment",
          message:
            "no folder can be found to keep what ergonex remembers and installs: set HOME (USERPROFILE on Windows), or XDG_DATA_HOME and XDG_STATE_HOME",
        }),
      );
    const rows: readonly (readonly [string, string])[] = [
      ["workspace", ctx.home === undefined ? "(no root can be found: set ERGONEX_HOME, or give --home)" : ctx.home],
      ["manifest and generated files", ctx.home === undefined ? "(no root)" : join(ctx.home, AREA)],
      ["state (what ergonex remembers)", places.state],
      ["data (what ergonex installs)", places.data],
      ["tools", places.tools],
      ["shims of the tools", places.shims],
      ["cache", places.cache],
    ];
    const width = Math.max(...rows.map(([k]) => k.length));
    return Promise.resolve(
      ok({
        text: rows.map(([k, v]) => `${k.padEnd(width)}  ${v}`).join("\n"),
        data: Object.fromEntries(rows.map(([k, v]) => [k, v])),
        findings: [],
        noEvidence: true,
      }),
    );
  },
});

/** The module `ergonex paths`. */
export const pathsModule: ErgonexModule = {
  name: "paths",
  summary: paths.summary,
  commands: [paths],
};
