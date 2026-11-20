// Spec: 0003-host FR-023
/**
 * The `.envrc.auto` template (commons 0003-host FR-023): generated only where the manifest says `direnv` is wanted and a probe found `direnv`, and it only adds the workspace's tools folder to the
 * `PATH`, by a path relative to the file (`PATH_add` reads it from the folder the file is in), so that no absolute path of the user's computer is in it.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { generated } from "../render.ts";
import type { Template } from "./data.ts";

/** The template: no file where `direnv` is not wanted or not found. */
export const envrcTemplate: Template = {
  name: "envrc",
  render: (data) => {
    if (!data.direnv) return ok([]);
    const file = generated(
      ".envrc.auto",
      { format: "envrc", text: 'PATH_add "$HOME/.local/bin"' },
      { generator: "ergonex templates/envrc" },
    );
    return file.kind === "err" ? err([file.error]) : ok([file.value]);
  },
};
