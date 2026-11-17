/**
 * The two JSON files of the workspace's own area (commons 0024-ifws-host FR-005): `<home>/.if-workspaces/tools.auto.json`, the resolved tool catalog, and `modules.auto.json`, the modules the manifest
 * registers, which `ifws` reads when it looks for a module (0025-ifws FR-004).
 *
 * @module
 */
import { err, ok } from "../../kernel/result.ts";
import { generated } from "../render.ts";
import type { Template } from "./data.ts";

/** The resolved tool catalog. */
export const toolsJsonTemplate: Template = {
  name: "tools-json",
  render: (data) => {
    const file = generated(
      ".if-workspaces/tools.auto.json",
      {
        format: "json",
        value: {
          tools: [...data.tools]
            .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
            .map((t) => ({ name: t.name, version: t.version })),
        },
      },
      { generator: "ifws templates/tools-json" },
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
      ".if-workspaces/modules.auto.json",
      { format: "json", value: { modules } },
      { generator: "ifws templates/modules-json" },
    );
    return file.kind === "err" ? err([file.error]) : ok([file.value]);
  },
};
