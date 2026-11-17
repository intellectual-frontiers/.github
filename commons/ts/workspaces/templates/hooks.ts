/**
 * The Git hooks (commons 0024-ifws-host FR-013 to FR-015): `pre-commit` (the plaintext-token scan of the staged changes), `commit-msg` (the issue named by every commit, 0020-ifccm) and `pre-push`
 * (signed commits where the policy requires them), generated into `<home>/.if-workspaces/hooks/` as POSIX `sh` scripts of mode `0755`, which Git for Windows runs with its own `sh`, and which each
 * run their checker, `ifws hook <name>`, with the runtime of the workspace.
 *
 * @remarks
 * A hook only reads: it changes no commit, no tree and no configuration and uses no network. Where it cannot run its checker (no `bun` and no `node`, `ifws` not on the `PATH`, `ifws` ending in
 * a status that is neither 0 nor 1) it says why on standard error and exits non-zero where the manifest names a regulated domain, and exits zero elsewhere. The script holds no absolute path: it finds
 * the root from its own place (`<home>/.if-workspaces/hooks/<name>` is two folders below it), so that the same data gives the same bytes on every computer.
 *
 * @module
 */
import { err, ok } from "../../kernel/result.ts";
import { hookFailsWhenUnableToCheck } from "../policy.ts";
import { generated, type GeneratedFile, type GenerateError, HOOKS_FOLDER } from "../render.ts";
import type { Template } from "./data.ts";

/** The hooks IFWS generates, in the order Git runs them. */
export const HOOK_NAMES = ["pre-commit", "commit-msg", "pre-push"] as const;

/** The name of a hook. */
export type HookName = (typeof HOOK_NAMES)[number];

/** Whether a word names a hook. */
export function isHookName(word: string): word is HookName {
  return HOOK_NAMES.some((h) => h === word);
}

/** What each hook checks, in a sentence. */
export const HOOK_PURPOSE: Readonly<Record<HookName, string>> = {
  "pre-commit": "the plaintext-token scan of the staged changes (0023-if-workspaces FR-031)",
  "commit-msg": "the issue every commit names (0020-ifccm)",
  "pre-push": "signed commits where the policy requires them (0023-if-workspaces FR-032)",
};

/** The text of one hook script. `strict` is whether a hook that cannot run its checker fails (it does where a regulated domain is named). */
export function hookScript(name: HookName, strict: boolean): string {
  return [
    "#!/bin/sh",
    `# ${name}: ${HOOK_PURPOSE[name]}.`,
    "# It only reads: it changes no commit, no tree and no configuration, and it uses no network.",
    'IFWS_HOME=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)',
    "unable() {",
    `  echo "ifws ${name} hook: cannot run its checker: $1" >&2`,
    ...(strict
      ? ['  echo "ifws: this workspace names a regulated domain, so the hook stops here; fix the cause and try again." >&2', "  exit 1"]
      : ['  echo "ifws: this workspace names no regulated domain, so the hook lets it pass." >&2', "  exit 0"]),
    "}",
    "if ! command -v bun >/dev/null 2>&1 && ! command -v node >/dev/null 2>&1; then",
    '  unable "neither bun nor node is on the PATH"',
    "fi",
    "if ! command -v ifws >/dev/null 2>&1; then",
    '  unable "ifws is not on the PATH (add $IFWS_HOME/.if-workspaces/tools/bin, or run: ifws shell --install)"',
    "fi",
    `ifws hook ${name} --home "$IFWS_HOME" -- "$@"`,
    "status=$?",
    'case "$status" in',
    "  0) exit 0 ;;",
    "  1) exit 1 ;;",
    '  *) unable "ifws ended with status $status" ;;',
    "esac",
  ].join("\n");
}

/** The template: the three scripts, of mode 0755, in `.if-workspaces/hooks/`. */
export const hooksTemplate: Template = {
  name: "hooks",
  render: (data) => {
    const strict = hookFailsWhenUnableToCheck(data.manifest.policy);
    const files: GeneratedFile[] = [];
    const errors: GenerateError[] = [];
    for (const name of HOOK_NAMES) {
      const file = generated(
        `${HOOKS_FOLDER}/${name}`,
        { format: "sh", text: hookScript(name, strict) },
        { generator: "ifws templates/hooks", mode: "0755" },
      );
      if (file.kind === "err") errors.push(file.error);
      else files.push(file.value);
    }
    return errors.length > 0 ? err(errors) : ok(files);
  },
};
