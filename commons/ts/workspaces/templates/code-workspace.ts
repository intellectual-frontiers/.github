/**
 * The `*.auto.code-workspace` template (commons 0024-ifws-host FR-005, FR-006, 0023-if-workspaces FR-013): one file at the root for each group of repositories the manifest names, which lists each
 * folder of the group by a path relative to the file, with `/` between segments, so that it opens the same on every operating system and no symbolic link is needed.
 *
 * @module
 */
import type { Json } from "../../kernel/json5.ts";
import { err, ok } from "../../kernel/result.ts";
import { generated, type GeneratedFile, type GenerateError } from "../render.ts";
import { segmentsOf } from "../portable.ts";
import type { Template } from "./data.ts";

const GENERATOR = "ifws templates/code-workspace";

/** The template: a file `<group>.auto.code-workspace` for each group, its folders in the order of their paths. */
export const codeWorkspaceTemplate: Template = {
  name: "code-workspace",
  render: (data) => {
    const groups = [...new Set(data.manifest.repositories.flatMap((r) => (r.group === undefined ? [] : [r.group])))].sort();
    const files: GeneratedFile[] = [];
    const errors: GenerateError[] = [];
    for (const group of groups) {
      const folders: Json[] = data.manifest.repositories
        .filter((r) => r.group === group)
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
        .map((r) => ({ name: segmentsOf(r.path).at(-1) ?? r.path, path: r.path }));
      const file = generated(
        `${group}.auto.code-workspace`,
        { format: "json", value: { folders, settings: {} } },
        { generator: GENERATOR },
      );
      if (file.kind === "err") errors.push(file.error);
      else files.push(file.value);
    }
    return errors.length > 0 ? err(errors) : ok(files);
  },
};
