// Spec: 0003-server-policy FR-009
/**
 * The host key of the server: generated once (ed25519), kept with mode 600 and never regenerated silently. A file that exists but is not a key is an error, never a reason to make a new key, because a new key makes every device that knew the old one distrust the server.
 *
 * @module
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import ssh2 from "ssh2";
import type { Fingerprint, HostKey } from "@intellectual-frontiers/ssh-server/governance";

const { utils } = ssh2;

/** The fingerprint of a public key blob: `SHA256:` and the base64 of its SHA-256 without padding. */
export function fingerprintOfBlob(blob: Uint8Array): Fingerprint {
  return `SHA256:${createHash("sha256").update(blob).digest("base64").replace(/=+$/, "")}` as Fingerprint;
}

/** The host key in memory: the private key as OpenSSH text for the server, and the public facts. */
export type LoadedHostKey = { readonly privateKey: string; readonly host: HostKey };

function describe(privateKey: string): LoadedHostKey {
  const parsed = utils.parseKey(privateKey);
  if (parsed instanceof Error) throw new Error(`the host key file is not a usable private key: ${parsed.message}`);
  const key = Array.isArray(parsed) ? (parsed[0] as typeof parsed[number]) : parsed;
  const blob = key.getPublicSSH();
  return { privateKey, host: { algo: key.type, fingerprint: fingerprintOfBlob(blob), publicKey: `${key.type} ${blob.toString("base64")}` } };
}

/** Load the host key at `path`, or make it once. The file is made with mode 600 and the flag `wx`, so an existing file is never overwritten; the public key is written beside it as `path.pub`. */
export async function loadOrCreateHostKey(path: string): Promise<LoadedHostKey> {
  let text: string | undefined;
  try {
    text = await readFile(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  if (text !== undefined) return describe(text);
  const pair = utils.generateKeyPairSync("ed25519");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, pair.private, { mode: 0o600, flag: "wx" });
  const made = describe(pair.private);
  await writeFile(`${path}.pub`, `${made.host.publicKey}\n`, { mode: 0o644 });
  return made;
}

/** The fingerprint of a public key line (`algo base64`), or nothing where it does not read. */
export function fingerprintOfLine(line: string): Fingerprint | undefined {
  const [algo, b64] = line.trim().split(/\s+/);
  if (algo === undefined || b64 === undefined || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return undefined;
  return fingerprintOfBlob(Buffer.from(b64, "base64"));
}
