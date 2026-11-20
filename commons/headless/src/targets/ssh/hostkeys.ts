// Spec: 0007-ssh-coverage FR-005, FR-006
/**
 * The host keys and the key tools of OpenSSH as typed helpers (commons headless 0007-ssh-coverage FR-005): the argument vectors of `ssh-keyscan -T 8 [-p]`, `ssh-keygen -lf -`,
 * `-y`, `-R` and `-Y find-principals`, and generation, and the parsing of what they write (the keys a host showed, deduplicated and in the order that makes ed25519 first, a fingerprint
 * with its size, its comment and its type), and the text of a known-hosts file for the keys pinned for a host. They only make arguments and read text: nothing here runs a program,
 * and nothing records a key as trusted: that is the verb of first contact, which a person confirms.
 *
 * @example
 * ```ts
 * import { parseFingerprint, parseScan } from "./hostkeys.ts";
 * parseFingerprint("256 SHA256:abc alpha (ED25519)\n"); // { bits: 256, fingerprint: "SHA256:abc", comment: "alpha", type: "ED25519" }
 * parseScan("alpha ssh-ed25519 AAAA\n")[0]?.type; // "ssh-ed25519"
 * ```
 *
 * @module
 */
import type { Target } from "@intellectual-frontiers/headless/logical";

/** The seconds `ssh-keyscan` waits for a host. */
export const SCAN_TIMEOUT_SEC = 8;

/** One key a host showed, as a line of a known-hosts file. */
export type HostKey = { readonly host: string; readonly type: string; readonly key: string; readonly line: string };

/** The arguments that fetch the keys a host shows: `ssh-keyscan -T 8 [-p port] -- <address>`. */
export function scanArgv(t: Target): readonly string[] {
  return ["ssh-keyscan", "-T", String(SCAN_TIMEOUT_SEC), ...(t.port === undefined ? [] : ["-p", String(t.port)]), "--", t.address];
}

const TYPE_ORDER = ["ssh-ed25519", "sk-ssh-ed25519@openssh.com", "ecdsa-sha2-nistp256", "ecdsa-sha2-nistp384", "ecdsa-sha2-nistp521", "sk-ecdsa-sha2-nistp256@openssh.com", "ssh-rsa"];
const rank = (type: string): number => {
  const i = TYPE_ORDER.indexOf(type);
  return i < 0 ? TYPE_ORDER.length : i;
};

/** The keys in what `ssh-keyscan` wrote: comment lines and what is not a key are left out, the same key once, and ed25519 first (then the other types in a fixed order, the rest in the order shown). */
export function parseScan(text: string): readonly HostKey[] {
  const seen = new Set<string>();
  const keys: HostKey[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const m = /^(\S+)\s+(\S+)\s+([A-Za-z0-9+/]+={0,2})(?:\s.*)?$/.exec(line);
    if (m?.[1] === undefined || m[2] === undefined || m[3] === undefined || !/^(ssh-|ecdsa-|sk-)/.test(m[2])) continue;
    const id = `${m[1]} ${m[2]} ${m[3]}`;
    if (seen.has(id)) continue;
    seen.add(id);
    keys.push({ host: m[1], type: m[2], key: m[3], line: id });
  }
  return keys.map((k, i) => ({ k, i })).sort((a, b) => rank(a.k.type) - rank(b.k.type) || a.i - b.i).map((x) => x.k);
}

/** The arguments that make the fingerprint of the key or keys on the standard input: `ssh-keygen -l -f -`. */
export const FINGERPRINT_ARGV: readonly string[] = ["ssh-keygen", "-l", "-f", "-"];

/** A fingerprint as `ssh-keygen -l` writes it. */
export type Fingerprint = { readonly bits: number; readonly fingerprint: string; readonly comment: string; readonly type: string };

/** The fingerprint in the output of `ssh-keygen -l` (`256 SHA256:... comment (ED25519)`), or `undefined` where there is none. */
export function parseFingerprint(text: string): Fingerprint | undefined {
  const m = /^\s*(\d+)\s+(SHA256:[A-Za-z0-9+/=]+|MD5:[0-9a-f:]+)\s*(.*?)\s*\(([A-Za-z0-9-]+)\)\s*$/m.exec(text);
  return m?.[1] === undefined || m[2] === undefined || m[4] === undefined ? undefined : { bits: Number(m[1]), fingerprint: m[2], comment: m[3] ?? "", type: m[4] };
}

/** The arguments that make the public key of a private key file: `ssh-keygen -y -f <file>`; the file is named, never read here. */
export function publicKeyArgv(privateKeyFile: string): readonly string[] {
  return ["ssh-keygen", "-y", "-f", privateKeyFile];
}

/** The host as a known-hosts file names it: the address, or `[address]:port` for a port other than 22. */
export function knownHostName(t: Target): string {
  return t.port === undefined || t.port === 22 ? t.address : `[${t.address}]:${t.port}`;
}

/** The arguments that remove a host from a known-hosts file: `ssh-keygen -R <host> -f <file>`. */
export function removeHostArgv(t: Target, knownHostsFile: string): readonly string[] {
  return ["ssh-keygen", "-R", knownHostName(t), "-f", knownHostsFile];
}

/** The arguments that find who signed: `ssh-keygen -Y find-principals -s <signature> -f <allowed signers>`. */
export function findPrincipalsArgv(allowedSigners: string, signatureFile: string): readonly string[] {
  return ["ssh-keygen", "-Y", "find-principals", "-s", signatureFile, "-f", allowedSigners];
}

/** What a key is made with. */
export type KeygenInput = { readonly type: "ed25519" | "rsa"; readonly comment: string; readonly file: string; readonly bits?: number };

/** The arguments that make a key with no passphrase: `ssh-keygen -q -t <type> [-b bits] -N "" -C <comment> -f <file>`. A key a person protects with a passphrase is made by the person, interactively. */
export function keygenArgv(i: KeygenInput): readonly string[] {
  return ["ssh-keygen", "-q", "-t", i.type, ...(i.type === "rsa" ? ["-b", String(i.bits ?? 3072)] : []), "-N", "", "-C", i.comment, "-f", i.file];
}

/** The text of a known-hosts file for the keys pinned for a target: one line for each, the host as the file names it (`[address]:port` where the port is not 22). Used as the file of the family `pinned`. */
export function pinnedKnownHosts(t: Target, keys: readonly HostKey[]): string {
  const name = knownHostName(t);
  return keys.map((k) => `${name} ${k.type} ${k.key}`).join("\n") + (keys.length === 0 ? "" : "\n");
}
