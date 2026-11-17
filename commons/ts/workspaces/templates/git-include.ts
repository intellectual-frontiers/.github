/**
 * The file the global Git include names (commons 0024-ifws-host FR-016, 0025-ifws FR-020): `<home>/.if-workspaces/git.auto.conf`, generated in the workspace and holding only what the manifest says of the
 * identity (`user.name`, `user.email`) and nothing else, so that `ifws setup --git-include`, which adds one marked `[include]` of it to the user's global Git configuration after showing the change and
 * asking, includes nothing a person has not read. It holds no absolute path.
 *
 * @module
 */
import { err, ok } from "../../kernel/result.ts";
import { generated } from "../render.ts";
import type { Template } from "./data.ts";

/** The template: one file in the workspace's own area. */
export const gitIncludeTemplate: Template = {
  name: "git-include",
  render: (data) => {
    const id = data.manifest.identity;
    const text =
      id === undefined || /[\r\n"\\]/.test(`${id.name}${id.email}`)
        ? "# The manifest names no identity, so this file sets nothing."
        : `[user]\n\tname = "${id.name}"\n\temail = "${id.email}"`;
    const file = generated(".if-workspaces/git.auto.conf", { format: "gitconfig", text }, { generator: "ifws templates/git-include" });
    return file.kind === "err" ? err([file.error]) : ok([file.value]);
  },
};
