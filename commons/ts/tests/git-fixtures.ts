/**
 * What the tests that run a real `git` here share: the reason a test of it is skipped where it is not installed, and an SSH signing key made by the real
 * `ssh-keygen`, the repository set to sign with it. Nothing here stands in for the code under test. (The fixtures of the quality system are the library
 * `quality`'s own, in its `suite/`.)
 *
 * @module
 */
import { readTextFile, writeTextFile } from "@intellectual-frontiers/system/fs";
import { join } from "@intellectual-frontiers/system/path";
import { run, which } from "@intellectual-frontiers/system/proc";
import { assert } from "@intellectual-frontiers/test";

/** Where git is, or the reason a test of it is skipped. */
export const needsGit = which("git") === undefined ? { skip: "git is not installed" } : {};

/** Where ssh-keygen is, or the reason a test that signs is skipped. */
export const needsSshKeygen =
  which("ssh-keygen") === undefined || which("git") === undefined ? { skip: "ssh-keygen or git is not installed" } : {};

/** git in `repo`, failing the test where it fails. */
async function git(repo: string, ...args: string[]): Promise<string> {
  const r = await run(["git", "-C", repo, ...args], { env: { GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_NOSYSTEM: "1" } });
  assert(r.success, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

/**
 * An SSH key made by `ssh-keygen`, the repository set to sign with it, and an allowed-signers file naming it for the committer `ci`: Git
 * signs and verifies as it does for a harness. The file's path is returned.
 */
export async function sshSigning(repo: string, keyDir: string): Promise<string> {
  const key = join(keyDir, "signing");
  const made = await run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", "ci", "-f", key]);
  assert(made.success, `ssh-keygen: ${made.stderr}`);
  await git(repo, "config", "gpg.format", "ssh");
  await git(repo, "config", "gpg.ssh.program", "ssh-keygen");
  await git(repo, "config", "user.signingkey", `${key}.pub`);
  const pub = (await readTextFile(`${key}.pub`)).trim();
  const allowed = join(keyDir, "allowed_signers");
  await writeTextFile(allowed, `ci@example.com namespaces="git" ${pub}\n`);
  return allowed;
}
