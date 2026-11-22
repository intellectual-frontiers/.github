// Spec: 0006-agents FR-027, FR-028, FR-031, FR-032
/**
 * Reaching a machine over SSH (commons ergonex 0006-agents FR-027, FR-028): the target as `ssh://user@host:port` or a name of the SSH configuration, every connection made with `BatchMode`, no
 * terminal, `StrictHostKeyChecking=yes` and a file of known hosts of Ergonex's own, and the host's key known before the first connection (RFC 4251, section 4.1): from a fingerprint the caller gives,
 * or, with trust on first use, from a scan whose fingerprint is printed and recorded. A changed key is refused. The program is the system's `ssh`, `ssh-keyscan` and `ssh-keygen`, run by arguments.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { existsSync, readTextOr, mkdir, writeTextFile } from "../../platform/r-fs.ts";
import { dirname } from "../../platform/r-path.ts";
import { run } from "../../platform/r-proc.ts";

/** Where to connect. */
export type Target = { readonly host: string; readonly port: number; readonly user: string | undefined; readonly alias: string | undefined; readonly raw?: string };

const HOST = /^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/;
const USER = /^[A-Za-z_][A-Za-z0-9._-]{0,63}$/;
const ALIAS = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** The target a word names: `ssh://user@host:port`, or a name of the SSH configuration (an alias, resolved by `ssh -G`). */
export function parseTarget(word: string): Result<Target, string> {
  if (word.startsWith("ssh://")) {
    let url: URL;
    try {
      url = new URL(word);
    } catch {
      return err(`${JSON.stringify(word)} is not an ssh:// address`);
    }
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const port = url.port === "" ? 22 : Number.parseInt(url.port, 10);
    const user = url.username === "" ? undefined : decodeURIComponent(url.username);
    if (url.password !== "") return err("an ssh:// address carries no password");
    if (!(HOST.test(host) || /^[0-9a-fA-F:]+$/.test(host)) || !(port >= 1 && port <= 65535)) return err(`${JSON.stringify(word)} does not name a host and a port`);
    if (user !== undefined && !USER.test(user)) return err("the user name is not one a login has");
    return ok({ host, port, user, alias: undefined, raw: word });
  }
  if (!ALIAS.test(word) || word.startsWith("-")) return err(`${JSON.stringify(word)} is neither an ssh:// address nor a name of the SSH configuration`);
  return ok({ host: word, port: 22, user: undefined, alias: word });
}

/** The name the policy's `remote` list is matched against: the alias, else the host. */
export const nameOf = (t: Target): string => t.alias ?? t.host;

/** Whether a policy's list names a target (by the alias, the host name or the whole address, exactly). */
export function targetAllowed(list: readonly string[], t: Target): boolean {
  return list.includes(nameOf(t)) || list.includes(t.host) || (t.raw !== undefined && list.includes(t.raw));
}

/** The options of every connection (FR-027). */
export function sshOptions(knownHosts: string): readonly string[] {
  return ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", `UserKnownHostsFile=${knownHosts}`, "-o", "GlobalKnownHostsFile=/dev/null", "-o", "ConnectTimeout=15", "-o", "ServerAliveInterval=15", "-o", "LogLevel=ERROR", "-T"];
}

/** The `ssh` command line that reaches a target and runs `command` there (an argument of its own, so that the remote shell parses it once). */
export function sshArgv(t: Target, knownHosts: string, command: string, identity?: string): readonly string[] {
  const target = t.alias !== undefined ? [t.alias] : [...(t.user === undefined ? [] : ["-l", t.user]), "-p", String(t.port), t.host];
  return ["ssh", ...sshOptions(knownHosts), ...(identity === undefined ? [] : ["-i", identity, "-o", "IdentitiesOnly=yes"]), ...target, "--", command];
}

/** What a remote command did. */
export type Remote = { readonly code: number; readonly stdout: string; readonly stderr: string };

/** Runs a command on a target, with `input` as its standard input, ending it after `timeoutMs`. */
export async function sshRun(t: Target, knownHosts: string, command: string, o: { readonly input?: string; readonly timeoutMs: number; readonly identity?: string }): Promise<Remote> {
  const r = await run(sshArgv(t, knownHosts, command, o.identity), { input: o.input ?? "", signal: AbortSignal.timeout(o.timeoutMs) }).catch((e: unknown) => ({ code: 255, success: false, stdout: "", stderr: e instanceof Error ? e.message : String(e), signal: undefined }));
  return { code: r.code, stdout: r.stdout, stderr: r.stderr };
}

/** A word as one argument of a POSIX shell. */
export function shq(word: string): string {
  return `'${word.replaceAll("'", `'\\''`)}'`;
}

/** The host a target resolves to under the SSH configuration (`ssh -G`), for an alias. */
export async function resolveTarget(t: Target): Promise<Result<Target, string>> {
  if (t.alias === undefined) return ok(t);
  const r = await run(["ssh", "-G", t.alias]);
  if (!r.success) return err(`ssh cannot resolve ${t.alias}: ${r.stderr.trim().split("\n")[0] ?? ""}`);
  const field = (k: string): string | undefined => r.stdout.split("\n").find((l) => l.startsWith(`${k} `))?.slice(k.length + 1).trim();
  const host = field("hostname");
  const port = Number.parseInt(field("port") ?? "22", 10);
  if (host === undefined) return err(`ssh -G ${t.alias} names no host`);
  return ok({ host, port, user: field("user"), alias: t.alias });
}

/** One key of a host. */
export type HostKey = { readonly type: string; readonly key: string; readonly fingerprint: string };

/** The keys a host offers, from `ssh-keyscan`, each with its `SHA256:` fingerprint from `ssh-keygen -lf`. */
export async function scanHostKeys(t: Target): Promise<Result<readonly HostKey[], string>> {
  const scan = await run(["ssh-keyscan", "-T", "10", "-p", String(t.port), "-t", "ed25519,ecdsa,rsa", t.host], { signal: AbortSignal.timeout(30_000) }).catch(() => undefined);
  if (scan === undefined || !scan.success) return err(`ssh-keyscan could not reach ${t.host}:${t.port}`);
  const keys: HostKey[] = [];
  for (const line of scan.stdout.split("\n")) {
    if (line.trim() === "" || line.startsWith("#")) continue;
    const [, type, key] = line.trim().split(/\s+/);
    if (type === undefined || key === undefined) continue;
    const fp = await run(["ssh-keygen", "-lf", "-", "-E", "sha256"], { input: `${type} ${key}\n` });
    const m = /\b(SHA256:[A-Za-z0-9+/]+)/.exec(fp.stdout);
    if (m?.[1] !== undefined) keys.push({ type, key, fingerprint: m[1] });
  }
  return keys.length === 0 ? err(`${t.host}:${t.port} offered no key of a type Ergonex reads`) : ok(keys);
}

/** The name a known-hosts file uses for a host: the bare name on port 22, else `[host]:port`. */
export const knownHostName = (t: Target): string => (t.port === 22 ? t.host : `[${t.host}]:${t.port}`);

/** The keys the known-hosts file holds for a target. */
export async function knownKeys(file: string, t: Target): Promise<readonly { readonly type: string; readonly key: string }[]> {
  const text = await readTextOr(file, "");
  const out: { type: string; key: string }[] = [];
  for (const line of text.split("\n")) {
    const [names, type, key] = line.trim().split(/\s+/);
    if (names === undefined || type === undefined || key === undefined || names.startsWith("#")) continue;
    if (names.split(",").includes(knownHostName(t))) out.push({ type, key });
  }
  return out;
}

/** What the pinning decided. */
export type Pinned =
  | { readonly kind: "known" }
  | { readonly kind: "pinned"; readonly fingerprint: string; readonly how: "fingerprint" | "first-use"; readonly line: string }
  | { readonly kind: "refused"; readonly reason: "unknown" | "changed" | "mismatch" | "unreachable"; readonly message: string; readonly fingerprints: readonly string[] };

/** Makes sure the host's key is in the file before the first connection (FR-028). */
export async function pinHostKey(file: string, t: Target, o: { readonly fingerprint?: string; readonly trustOnFirstUse: boolean }, apply: boolean): Promise<Pinned> {
  const scanned = await scanHostKeys(t);
  if (scanned.kind === "err") return { kind: "refused", reason: "unreachable", message: scanned.error, fingerprints: [] };
  const fps = scanned.value.map((k) => `${k.type} ${k.fingerprint}`);
  const have = await knownKeys(file, t);
  if (have.length > 0) {
    if (scanned.value.some((k) => have.some((h) => h.type === k.type && h.key === k.key))) return { kind: "known" };
    return { kind: "refused", reason: "changed", message: `the key of ${t.host}:${t.port} is not the one recorded in ${file}: the host was changed, or something stands between; it was not trusted (RFC 4251, section 4.1)`, fingerprints: fps };
  }
  let chosen: HostKey | undefined;
  let how: "fingerprint" | "first-use" = "fingerprint";
  if (o.fingerprint !== undefined) {
    chosen = scanned.value.find((k) => k.fingerprint === o.fingerprint);
    if (chosen === undefined) return { kind: "refused", reason: "mismatch", message: `no key of ${t.host}:${t.port} has the fingerprint given; the host offers ${fps.join("; ")}`, fingerprints: fps };
  } else if (o.trustOnFirstUse) {
    // the preferred type first: ed25519, then ecdsa, then rsa
    chosen = ["ssh-ed25519", "ecdsa-sha2-nistp256", "ecdsa-sha2-nistp384", "ecdsa-sha2-nistp521", "ssh-rsa"].map((ty) => scanned.value.find((k) => k.type === ty)).find((k) => k !== undefined);
    how = "first-use";
  } else
    return { kind: "refused", reason: "unknown", message: `the key of ${t.host}:${t.port} is not known: check one of these fingerprints by another way (the host's console, or its owner), then give it with --fingerprint, or accept it with --trust-on-first-use`, fingerprints: fps };
  if (chosen === undefined) return { kind: "refused", reason: "unreachable", message: "no key was chosen", fingerprints: fps };
  const line = `${knownHostName(t)} ${chosen.type} ${chosen.key}\n`;
  if (apply) {
    await mkdir(dirname(file), { recursive: true });
    const old = await readTextOr(file, "");
    await writeTextFile(file, `${old === "" || old.endsWith("\n") ? old : `${old}\n`}${line}`);
  }
  return { kind: "pinned", fingerprint: chosen.fingerprint, how, line };
}

/** Whether the file of known hosts exists. */
export const hasKnownHosts = (file: string): boolean => existsSync(file);
