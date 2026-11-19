// Spec: 0003-host FR-005
/**
 * The two JSON files of the workspace's own area (commons 0003-host FR-005): `<home>/.ergonex/tools.auto.json`, the resolved tool catalog, and `modules.auto.json`, the modules the manifest
 * registers, which `ergonex` reads when it looks for a module (0001-ergonex FR-004).
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/commons/ts/kernel";
import { generated } from "../render.ts";
import type { Template } from "./data.ts";

/** The resolved tool catalog. */
export const toolsJsonTemplate: Template = {
  name: "tools-json",
  render: (data) => {
    const file = generated(
      ".ergonex/tools.auto.json",
      {
        format: "json",
        value: {
          tools: [...data.tools]
            .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
            .map((t) => ({
              name: t.name,
              version: t.version,
              provides: [...t.provides],
              artifacts: [...t.artifacts]
                .sort((x, y) => (`${x.os}/${x.arch}` < `${y.os}/${y.arch}` ? -1 : 1))
                .map((a) => ({
                  os: a.os,
                  arch: a.arch,
                  url: a.url,
                  sha256: a.sha256,
                  kind: a.kind,
                  bin: a.bin,
                })),
            })),
        },
      },
      { generator: "ergonex templates/tools-json" },
    );
    return file.kind === "err" ? err([file.error]) : ok([file.value]);
  },
};

/** The registered modules, by name. */
export const modulesJsonTemplate: Template = {
  name: "modules-json",
  render: (data) => {
    const modules = [...data.manifest.modules]
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      .map((m) => ({
        name: m.name,
        program: m.program,
        ...(m.sha256 === undefined ? {} : { sha256: m.sha256 }),
        ...(m.summary === undefined ? {} : { summary: m.summary }),
      }));
    const file = generated(
      ".ergonex/modules.auto.json",
      { format: "json", value: { modules } },
      { generator: "ergonex templates/modules-json" },
    );
    return file.kind === "err" ? err([file.error]) : ok([file.value]);
  },
};
