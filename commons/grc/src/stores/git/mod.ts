// Spec: 0006-grc-evidence FR-001, FR-002
/**
 * The `git` store (0006-grc-evidence FR-002): the `files` store inside a working tree of Git, where each object put is committed with a message that names its digest, so that the history of the
 * evidence is the repository's. It runs the `git` program (initialising the folder where it is not yet a repository) and never pushes.
 *
 * @module
 */
import { err } from "@intellectual-frontiers/core";
import { proc } from "@intellectual-frontiers/system";
import { directoryStore, type EvidenceStore } from "@intellectual-frontiers/grc/physical";

async function git(dir: string, args: readonly string[]): Promise<{ readonly code: number; readonly text: string }> {
  const r = await proc.run(["git", "-c", "user.name=grc", "-c", "user.email=grc@localhost", "-c", "commit.gpgsign=false", ...args], { cwd: dir });
  return { code: r.code, text: `${r.stdout}${r.stderr}` };
}

/** A store in the working tree `dir`. */
export function gitStore(dir: string): EvidenceStore {
  const inner = directoryStore(dir, "git");
  return {
    ...inner,
    async put(bytes, meta) {
      const put = await inner.put(bytes, meta);
      if (put.kind === "err") return put;
      const e = put.value;
      const init = await git(dir, ["rev-parse", "--git-dir"]);
      if (init.code !== 0) {
        const made = await git(dir, ["init", "--quiet"]);
        if (made.code !== 0) return err({ kind: "failed", digest: e.digest, message: made.text });
      }
      const staged = await git(dir, ["add", "--", "objects", "evidence"]);
      if (staged.code !== 0) return err({ kind: "failed", digest: e.digest, message: staged.text });
      const dirty = await git(dir, ["diff", "--cached", "--quiet"]);
      if (dirty.code !== 0) {
        const committed = await git(dir, ["commit", "--quiet", "-m", `evidence ${e.digest}`]);
        if (committed.code !== 0) return err({ kind: "failed", digest: e.digest, message: committed.text });
      }
      return put;
    },
  };
}
