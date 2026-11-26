// Spec: 0005-reach-and-targets FR-010
// Spec: 0016-headless-ssh-forward FR-002
/**
 * The ban on hand-built `ssh` arguments (commons headless 0005-reach-and-targets FR-010): a program that reaches a machine over ssh does it through the executor,
 * so that the options, the quoting and the host-key policy are in one place. This finds, in the text of a program's sources, an `ssh` argument vector that sets the
 * options only the executor sets (`BatchMode`, `ConnectTimeout`, `ServerAliveInterval`, `StrictHostKeyChecking`, `UserKnownHostsFile`, `ControlMaster`, `-T`) or an
 * option of the host-key policy turned off, and gives a finding for each, to be held by a consumer's own check.
 *
 * @limits
 * It reads the shape of the text, as the layers check does: an `ssh` word in quotes within a few lines of one of the options. It does not run anything.
 *
 * @example
 * ```ts
 * import { sshArgumentFindings } from "./ban.ts";
 * sshArgumentFindings([{ path: "a.ts", text: 'run(["ssh", "-o", "BatchMode=yes", host, cmd]);' }]).length; // 1
 * ```
 *
 * @module
 */

/** A file's path and text. */
export type Source = { readonly path: string; readonly text: string };

/** A hand-built ssh argument. */
export type SshFinding = { readonly file: string; readonly line: number; readonly rule: "ssh/hand-built"; readonly message: string };

const OPTION = /(BatchMode|ConnectTimeout|ServerAliveInterval|ServerAliveCountMax|StrictHostKeyChecking|UserKnownHostsFile|ControlMaster|ControlPath|ControlPersist|IdentitiesOnly)/;
const SSH_WORD = /(["'`])ssh\1|\bssh\s+-[oTpiJ]\b/;

/** Every hand-built `ssh` argument in the sources given, by file and line. A source of the executor itself is not given to it. */
export function sshArgumentFindings(files: readonly Source[]): readonly SshFinding[] {
  const out: SshFinding[] = [];
  for (const f of files) {
    const lines = f.text.split("\n");
    lines.forEach((l, i) => {
      const t = l.trim();
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
      if (!SSH_WORD.test(l)) return;
      const near = lines.slice(i, i + 7).join("\n");
      const forward = /["'`]-[LRD]["'`]/.test(near) || /\bssh\s+(-\S+\s+)*-[LRD]\b/.test(l);
      if (forward) {
        out.push({ file: f.path, line: i + 1, rule: "ssh/hand-built", message: "an ssh forward (-L, -R or -D) made by hand: use sshForwardArgv of @intellectual-frontiers/headless/targets/ssh" });
        return;
      }
      if (OPTION.test(near) || /\bssh\s+-[oT]\b/.test(l) || /["']-o["']/.test(near)) {
        out.push({ file: f.path, line: i + 1, rule: "ssh/hand-built", message: "an ssh command line with options of its own: run it through the executor of @intellectual-frontiers/headless/targets/ssh" });
      }
    });
  }
  return out;
}
