// Spec: 0005-reach-and-targets FR-006
/**
 * The first contact with a host (commons headless 0005-reach-and-targets FR-006): a host key that does not match is refused and never accepted for the person, and
 * a host not yet known is learned only by a verb of its own that a person runs. `scanHost` fetches what the host shows (through `ssh-keyscan` and
 * `ssh-keygen -l`) and gives the fingerprints; `acceptHostKey` writes the host to the repository's known hosts only where the person gave the fingerprint they
 * checked and it is one of those the host showed. Nothing is accepted by a flag that says yes to everything.
 *
 * @example
 * ```ts
 * import { acceptHostKey } from "./hostkey.ts";
 * // const r = await acceptHostKey(alpha, scan, "SHA256:...", (line) => appendToKnownHosts(line));
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { textOf, type Output, type RunOptions, type Target } from "@intellectual-frontiers/headless/logical";
import type { RunLocal } from "./executor.ts";

/** What a host showed: each key's line as a known-hosts file holds it, and its fingerprint. */
export type ScannedKey = { readonly line: string; readonly fingerprint: string };

/** The arguments that fetch the keys a host shows. */
export function scanArgv(t: Target): readonly string[] {
  return ["ssh-keyscan", "-T", "10", ...(t.port === undefined ? [] : ["-p", String(t.port)]), "--", t.address];
}

/** The fingerprints of the keys of some known-hosts lines, through `ssh-keygen -l` (one call for each line, so that a line is never mistaken for another). */
export async function scanHost(t: Target, run: RunLocal): Promise<Result<readonly ScannedKey[], string>> {
  const scanned: Output = await run(scanArgv(t));
  const lines = textOf(scanned.stdout).split("\n").filter((l) => l.trim() !== "" && !l.startsWith("#"));
  if (scanned.code !== 0 || lines.length === 0) return err(`${t.id} showed no host key (${textOf(scanned.stderr).trim() || `ssh-keyscan ended with ${scanned.code}`})`);
  const keys: ScannedKey[] = [];
  for (const line of lines) {
    const opts: RunOptions = { input: `${line}\n` };
    const r = await run(["ssh-keygen", "-l", "-f", "-"], opts);
    const m = /\b(SHA256:[A-Za-z0-9+/=]+)/.exec(textOf(r.stdout));
    if (r.code !== 0 || m?.[1] === undefined) return err(`the fingerprint of a key of ${t.id} could not be made`);
    keys.push({ line, fingerprint: m[1] });
  }
  return ok(keys);
}

/**
 * Writes a host to the known hosts only if `expected`, the fingerprint a person checked by another way, is one that the host showed; `append` writes the line (the
 * caller's: the repository's known-hosts file). A fingerprint that is not among them writes nothing, and says what the host showed.
 */
export async function acceptHostKey(t: Target, scanned: readonly ScannedKey[], expected: string, append: (line: string) => Promise<void> | void): Promise<Result<readonly ScannedKey[], string>> {
  const match = scanned.filter((k) => k.fingerprint === expected.trim());
  if (match.length === 0) return err(`${t.id} did not show ${expected.trim()}; it showed ${scanned.map((k) => k.fingerprint).join(", ")}: nothing was written`);
  for (const k of match) await append(k.line);
  return ok(match);
}
