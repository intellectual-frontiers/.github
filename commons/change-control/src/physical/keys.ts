// Spec: 0004-change-control-keys FR-004, FR-005, FR-006
/**
 * The keys on this machine and what is done with them: the facts read (OpenSSH, the daily key, Git's settings for the repository, the agent, the hook), a key made by OpenSSH itself (so that the passphrase is typed into OpenSSH and nowhere else), Git set to sign with it for the repository alone, a test signature proved against the
 * signers, the pre-push hook. A key is never overwritten, nothing is loaded into an agent, and no passphrase is seen, stored or passed: `ssh-keygen` and `git` ask for it on the terminal (or through the program named in `SSH_ASKPASS`).
 *
 * @example
 * ```ts
 * import { readFacts } from "./keys.ts";
 * // const facts = await readFacts({ repo, keyFile, signersText, recoveryCheckedAt });
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { opensshVersion, sameKey, type Facts } from "@intellectual-frontiers/change-control/logical";

const ENV = { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" };
const exists = async (p: string): Promise<boolean> => fs.stat(p).then(() => true, () => false);
const git = (repo: string, args: readonly string[], more: Record<string, string> = {}) => proc.run(["git", "-C", repo, ...args], { env: { ...(ENV as Record<string, string>), ...more } });

/** The marker of the hook this library installs. */
export const HOOK_MARKER = "# change-control pre-push hook";

/** What is read to know the facts. */
export type FactsInput = {
  readonly repo: string;
  /** The daily key's private file (its public file is beside it, `.pub`). */
  readonly keyFile: string;
  /** The text of the file that lists the signers, and the public keys of the daily and the recovery signers by name where they are listed. */
  readonly dailyPub: string | undefined;
  readonly recoveryListed: boolean;
  readonly recoveryKeyFile: string | undefined;
  readonly recoveryCheckedAt: string | undefined;
  readonly signersText: string;
};

/** The facts of this machine, read with no change and no passphrase asked. */
export async function readFacts(i: FactsInput): Promise<Facts> {
  const v = await proc.run(["ssh", "-V"]);
  const openssh = opensshVersion(`${v.stdout}${v.stderr}`);
  const pubFile = `${i.keyFile}.pub`;
  const keyExists = (await exists(i.keyFile)) && (await exists(pubFile));
  const pub = keyExists ? (await fs.readTextFile(pubFile)).trim() : i.dailyPub;
  const hasPassphrase = keyExists ? !(await proc.run(["ssh-keygen", "-y", "-P", "", "-f", i.keyFile])).success : false;
  let inAgent = false;
  if (keyExists) {
    const agent = await proc.run(["ssh-add", "-l"]);
    const fp = await proc.run(["ssh-keygen", "-lf", pubFile]);
    const fingerprint = fp.stdout.split(" ")[1] ?? "";
    inAgent = agent.success && fingerprint !== "" && agent.stdout.includes(fingerprint);
  }
  const cfg = async (k: string): Promise<string> => (await git(i.repo, ["config", "--local", "--get", k])).stdout.trim();
  const signingKey = await cfg("user.signingkey");
  const signingKeyIsDaily = signingKey !== "" && (signingKey === i.keyFile || signingKey === pubFile || (pub !== undefined && sameKey(signingKey, pub)));
  const hook = path.join(i.repo, ".git", "hooks", "pre-push");
  const hookInstalled = (await exists(hook)) && (await fs.readTextFile(hook)).includes(HOOK_MARKER);
  return {
    openssh,
    daily: { exists: keyExists, hasPassphrase, inAgent },
    git: { signs: (await cfg("commit.gpgsign")) === "true", formatSsh: (await cfg("gpg.format")) === "ssh", signingKeyIsDaily, identity: (await cfg("user.name")) !== "" && (await cfg("user.email")) !== "" },
    signers: { dailyListed: pub !== undefined && i.signersText.includes(pub.split(" ").slice(0, 2).join(" ")), recoveryListed: i.recoveryListed },
    recovery: { privateHere: i.recoveryKeyFile !== undefined && (await exists(i.recoveryKeyFile)), checkedAt: i.recoveryCheckedAt },
    hookInstalled,
  };
}

/** A key pair made by OpenSSH (ed25519), the passphrase typed into OpenSSH on the terminal: refused where the file is there (a key is never overwritten). The public key line is given back. */
export async function makeKey(file: string, comment: string): Promise<Result<string, string>> {
  if ((await exists(file)) || (await exists(`${file}.pub`))) return err(`${file} is already there: a key is never overwritten`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const r = await proc.run(["ssh-keygen", "-t", "ed25519", "-C", comment, "-f", file], { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
  if (!r.success) return err("ssh-keygen did not make the key");
  return ok((await fs.readTextFile(`${file}.pub`)).trim());
}

/** Git set to sign every commit of this repository with the key, for this repository alone. */
export async function configureGit(repo: string, keyFile: string): Promise<Result<true, string>> {
  for (const [k, v] of [["gpg.format", "ssh"], ["user.signingkey", `${keyFile}.pub`], ["commit.gpgsign", "true"]] as const) {
    const r = await git(repo, ["config", "--local", k, v]);
    if (!r.success) return err(`git config ${k} failed: ${r.stderr.trim()}`);
  }
  return ok(true);
}

/** A test signature with a key, checked against the public key it should be listed as (OpenSSH asks for the passphrase): proves the key and its passphrase. */
export async function testSign(keyFile: string, expectedPub: string, principal: string): Promise<Result<true, string>> {
  const dir = await fs.makeTempDir({ prefix: "keys-test-" });
  try {
    const message = path.join(dir, "message");
    await fs.writeTextFile(message, `change-control key test ${new Date().toISOString()}\n`);
    const sign = await proc.run(["ssh-keygen", "-Y", "sign", "-f", keyFile, "-n", "git", message], { stdin: "inherit", stdout: "null", stderr: "inherit" });
    if (!sign.success) return err("the key could not sign (a wrong passphrase, or it is not a key)");
    const allowed = path.join(dir, "allowed_signers");
    await fs.writeTextFile(allowed, `${principal} namespaces="git" ${expectedPub.trim()}\n`);
    const verify = await proc.run(["ssh-keygen", "-Y", "verify", "-f", allowed, "-I", principal, "-n", "git", "-s", `${message}.sig`], { input: await fs.readTextFile(message) });
    return verify.success ? ok(true) : err("the signature is not by the key that is listed: this is not the key the fleet has");
  } finally {
    await fs.remove(dir, { recursive: true });
  }
}

/** The pre-push hook: it runs the command with what Git hands it, and is never put over a hook that is not ours. */
export async function installHook(repo: string, command: string): Promise<Result<"installed" | "already", string>> {
  const hook = path.join(repo, ".git", "hooks", "pre-push");
  if (await exists(hook)) {
    const text = await fs.readTextFile(hook);
    if (!text.includes(HOOK_MARKER)) return err(`${hook} is a hook that is not this library's: it is not overwritten`);
    if (text.includes(command)) return ok("already");
  }
  await fs.mkdir(path.dirname(hook), { recursive: true });
  await fs.writeTextFile(hook, `#!/bin/sh\n${HOOK_MARKER}\n# Refuses a push of what no signer of the fleet signed. Written by change-control.\nexec ${command} "$@"\n`);
  await fs.chmod(hook, 0o755);
  return ok("installed");
}

/** A commit made as the key signs it (an empty one where asked), the passphrase typed on the terminal. */
export async function commitSigned(repo: string, keyFile: string, message: string, options: { readonly allowEmpty?: boolean; readonly paths?: readonly string[] } = {}): Promise<Result<string, string>> {
  for (const p of options.paths ?? []) {
    const added = await git(repo, ["add", "--", p]);
    if (!added.success) return err(`git add ${p} failed: ${added.stderr.trim()}`);
  }
  const args = ["-c", "gpg.format=ssh", "-c", `user.signingkey=${keyFile}`, "-c", "commit.gpgsign=true", "commit", "-q", ...(options.allowEmpty === true ? ["--allow-empty"] : []), "-m", message];
  const r = await proc.run(["git", "-C", repo, ...args], { stdin: "inherit", stdout: "inherit", stderr: "inherit", env: ENV as Record<string, string> });
  if (!r.success) return err("the commit was not made (a wrong passphrase, nothing to commit, or no identity)");
  return ok((await git(repo, ["rev-parse", "HEAD"])).stdout.trim());
}
