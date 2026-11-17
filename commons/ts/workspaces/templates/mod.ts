/**
 * The templates of IF Workspaces (commons 0024-ifws-host FR-003 to FR-007, FR-014, FR-022, FR-023): typed functions from the manifest's data to generated files. `TEMPLATES` is the list, a value the
 * compiler checks; `renderAll` runs them all, checks the files together (no two paths that are one after case folding, none inside a repository's working tree) and gives them in the order of their
 * paths, so that the same data gives the same files on every operating system.
 *
 * @module
 */
import { err, type Result } from "../../kernel/result.ts";
import { checkFiles, type GeneratedFile, type GenerateError } from "../render.ts";
import { agentsTemplate } from "./agents.ts";
import { codeWorkspaceTemplate } from "./code-workspace.ts";
import type { Template, TemplateData } from "./data.ts";
import { envrcTemplate } from "./envrc.ts";
import { gitIncludeTemplate } from "./git-include.ts";
import { hooksTemplate } from "./hooks.ts";
import { modulesJsonTemplate, toolsJsonTemplate } from "./json-files.ts";
import { lefthookTemplate } from "./lefthook.ts";

export type { Template, TemplateData, ToolEntry } from "./data.ts";
export { HOOK_NAMES, type HookName, hookScript, isHookName } from "./hooks.ts";

/** Every template, in the order of their generators. */
export const TEMPLATES: readonly Template[] = [
  agentsTemplate,
  codeWorkspaceTemplate,
  envrcTemplate,
  gitIncludeTemplate,
  hooksTemplate,
  lefthookTemplate,
  modulesJsonTemplate,
  toolsJsonTemplate,
];

/** Every generated file the data gives, or every reason one was refused. */
export function renderAll(data: TemplateData): Result<readonly GeneratedFile[], readonly GenerateError[]> {
  const files: GeneratedFile[] = [];
  const errors: GenerateError[] = [];
  for (const t of TEMPLATES) {
    const r = t.render(data);
    if (r.kind === "err") errors.push(...r.error);
    else files.push(...r.value);
  }
  if (errors.length > 0) return err(errors);
  return checkFiles(
    files,
    data.manifest.repositories.map((r) => r.path),
  );
}
