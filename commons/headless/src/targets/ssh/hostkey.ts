// Spec: 0005-reach-and-targets FR-006
// Spec: 0007-ssh-coverage FR-002
/**
 * The first contact with a host (commons headless 0005-reach-and-targets FR-006; 0007-ssh-coverage FR-002): a host key that does not match is refused and never accepted for the
 * person, and a host not yet known is learned only by a verb of its own that a person runs. `scanHost` fetches what the host shows (through `ssh-keyscan` and `ssh-keygen -l`) and
 * gives the fingerprints; `acceptHostKey` writes the host to the repository's known hosts only where the person gave the fingerprint they checked and it is one of those the host
 * showed. Nothing is accepted by a flag that says yes to everything; `StrictHostKeyChecking=accept-new` is not written anywhere.
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
import { textOf, type Output, type Target } from "@intellectual-frontiers/headless/logical";
import type { RunLocal } from "./executor.ts";
import { FINGERPRINT_ARGV, parseFingerprint, parseScan, scanArgv } from "./hostkeys.ts";

/** What a host showed: each key's line as a known-hosts file holds it, and its fingerprint. */
export type ScannedKey = { readonly line: string; readonly fingerprint: string };

/** The fingerprints of the keys a host shows, through `ssh-keygen -l` (one call for each line, so that a line is never mistaken for another); ed25519 first. */
export async function scanHost(t: Target, run: RunLocal): Promise<Result<readonly ScannedKey[], string>> {
  const scanned: Output = await run(scanArgv(t));
  const lines = parseScan(textOf(scanned.stdout));
  if (scanned.code !== 0 || lines.length === 0) return err(`${t.id} showed no host key (${textOf(scanned.stderr).trim() || `ssh-keyscan ended with ${scanned.code}`})`);
  const keys: ScannedKey[] = [];
  for (const k of lines) {
    const r = await run(FINGERPRINT_ARGV, { input: `${k.line}\n` });
    const fp = parseFingerprint(textOf(r.stdout));
    if (r.code !== 0 || fp === undefined) return err(`the fingerprint of a key of ${t.id} could not be made`);
    keys.push({ line: k.line, fingerprint: fp.fingerprint });
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
