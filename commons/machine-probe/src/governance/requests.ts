// Spec: 0002-machine-probe-contract FR-001, FR-002, FR-003
/**
 * What a probe answers and how it is reached: three requests (`facts`, `version`, and one osquery SELECT), the line of `authorized_keys` that restricts a key to the probe and to nothing else, and the command line of the ssh client
 * that asks it. A request that is none of the three is refused here, before anything is run, and the script on the machine refuses it again.
 *
 * @example
 * ```ts
 * import { parseRequest, encodeRequest } from "./requests.ts";
 * const r = parseRequest("facts"); // { kind: "ok", value: { kind: "facts" } }
 * encodeRequest({ kind: "osquery", sql: "SELECT 1" }); // "osquery U0VMRUNUIDE="
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** The name of the probe program on a machine. */
export const PROBE_PROGRAM = "machine-probe";

/** Where the probe is installed for the account that runs it: no root, nothing listening. */
export const PROBE_PATH = `$HOME/.local/bin/${PROBE_PROGRAM}`;

/** A request: the facts of the machine, the version of the probe, or one osquery SELECT. */
export type ProbeRequest = { readonly kind: "facts" } | { readonly kind: "version" } | { readonly kind: "osquery"; readonly sql: string };

function base64(text: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(text)));
}

function fromBase64(text: string): string | undefined {
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(text), (c) => c.charCodeAt(0)));
  } catch {
    return undefined;
  }
}

/** The text of a request as sent to the probe: `facts`, `version` or `osquery <base64 of the SELECT>`. */
export function encodeRequest(r: ProbeRequest): string {
  return r.kind === "osquery" ? `osquery ${base64(r.sql)}` : r.kind;
}

/** A request from its text, or why it is refused: only `facts`, `version` and `osquery <base64>` of one SELECT (or a WITH that ends in one), with no second statement. */
export function parseRequest(text: string): Result<ProbeRequest, string> {
  if (text === "facts") return ok({ kind: "facts" });
  if (text === "version") return ok({ kind: "version" });
  if (!text.startsWith("osquery ")) return err(`unknown probe: ${JSON.stringify(text)} (facts, version, osquery)`);
  const sql = fromBase64(text.slice("osquery ".length).trim());
  if (sql === undefined) return err("the query is not base64");
  const trimmed = sql.trim().replace(/[\s;]+$/, "");
  if (!/^(select|with)\b/i.test(trimmed)) return err("only SELECT");
  if (trimmed.includes(";")) return err("one statement");
  return ok({ kind: "osquery", sql: trimmed });
}

const KEY = /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(?:256|384|521)|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp256@openssh\.com) [A-Za-z0-9+/]+={0,3}$/;

/**
 * The line of `authorized_keys` that restricts a public key to the probe: the program is forced, and `restrict` turns off the terminal, forwarding and every other service. The key and the comment are checked, so that a value
 * cannot add an option or a second line.
 */
export function keyLine(publicKey: string, comment: string): Result<string, string> {
  if (/[\r\n]/.test(publicKey.trim())) return err("the public key is one line");
  const key = publicKey.trim().split(/\s+/).slice(0, 2).join(" ");
  if (!KEY.test(key)) return err("the public key is not one line of a key type and its base64");
  if (!/^[A-Za-z0-9@._-]+$/.test(comment)) return err("the comment is letters, digits and @ . _ - only");
  return ok(`command="${PROBE_PATH}",restrict ${key} ${comment}`);
}

/** A machine the probe is asked of: the account the probe runs as, the address, the key that is restricted to the probe, and the file of known hosts that vouches for the machine. */
export type ProbeTarget = {
  readonly user: string;
  readonly host: string;
  readonly port?: number;
  readonly identityFile: string;
  readonly knownHostsFile: string;
};

const SAFE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * The argument vector of the ssh client that sends one request: the key alone (no agent), the host key checked against the given file and never accepted for the person, no terminal, no forwarding, no password prompt, and the request as
 * the last, single argument.
 */
export function sshArgv(target: ProbeTarget, request: ProbeRequest): Result<readonly string[], string> {
  if (!SAFE.test(target.user)) return err("the account is letters, digits and . _ - only, and starts with a letter or a digit");
  if (!SAFE.test(target.host) && !/^[0-9a-fA-F:]+$/.test(target.host)) return err("the host is a name or an address, and does not start with a hyphen");
  if (target.port !== undefined && (!Number.isInteger(target.port) || target.port < 1 || target.port > 65535)) return err("the port is 1 to 65535");
  return ok([
    "ssh",
    "-T",
    "-a",
    "-x",
    "-o", "BatchMode=yes",
    "-o", "IdentitiesOnly=yes",
    "-o", "StrictHostKeyChecking=yes",
    "-o", `UserKnownHostsFile=${target.knownHostsFile}`,
    "-o", "PasswordAuthentication=no",
    "-i", target.identityFile,
    ...(target.port === undefined ? [] : ["-p", String(target.port)]),
    `${target.user}@${target.host}`,
    encodeRequest(request),
  ]);
}
