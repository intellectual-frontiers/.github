// Spec: 0002-linux-services-profiles FR-001, FR-002
/**
 * The parsing of a profile: every reason it is refused, and a value only where there is none. A field that looks like a secret is refused.
 *
 * @example
 * ```ts
 * import { parsePostgres } from "./parse.ts";
 * parsePostgres({ machine: "synthetic-server-01", version: 18, port: 5432, listen: ["localhost"] }).kind; // "ok"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { findSecretLike, type JsonValue } from "@intellectual-frontiers/archon/governance";
import { DOMAIN, MAILBOX, NAME, PORTS } from "@intellectual-frontiers/linux-services/governance";
import { authorizedKeysLine } from "@intellectual-frontiers/headless/ssh-inbound";
import type { CertificateProfile, MailRelayProfile, McpAccessProfile, PostgresProfile } from "@intellectual-frontiers/linux-services/governance";

type Obj = { readonly [key: string]: unknown };
const asObj = (v: unknown): Obj | undefined => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Obj) : undefined);

function secretProblems(v: unknown, where: string): string[] {
  const found = findSecretLike(v as JsonValue);
  return found.map((f) => `${where}${f.path.slice(1)}: looks like a secret (${f.why}); a profile carries the path of one, never the secret`);
}

function text(o: Obj, k: string, re: RegExp, what: string, problems: string[]): string {
  const v = o[k];
  if (typeof v !== "string" || !re.test(v)) {
    problems.push(`${k}: ${what}`);
    return "";
  }
  return v;
}

function port(o: Obj, problems: string[]): number {
  const v = o["port"];
  if (typeof v !== "number" || !Number.isInteger(v) || v < PORTS.min || v > PORTS.max) {
    problems.push(`port: a whole number from ${PORTS.min} to ${PORTS.max}`);
    return 0;
  }
  return v;
}

const HOSTPORT = /^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?:[0-9]{2,5}$/;
const LISTEN = /^(localhost|\*|[0-9]{1,3}(\.[0-9]{1,3}){3}|[0-9a-f:]+:[0-9a-f:]*)$/;

/** A PostgreSQL profile from what was written. */
export function parsePostgres(input: unknown): Result<PostgresProfile, readonly string[]> {
  const o = asObj(input);
  if (o === undefined) return err(["a profile is an object"]);
  const problems = secretProblems(input, "profile");
  const machine = text(o, "machine", NAME, "a machine name", problems);
  const version = o["version"];
  if (typeof version !== "number" || !Number.isInteger(version) || version < 14 || version > 99) problems.push("version: a major version from 14");
  const p = port(o, problems);
  const listen = Array.isArray(o["listen"]) && o["listen"].length > 0 && o["listen"].every((a) => typeof a === "string" && LISTEN.test(a)) ? (o["listen"] as string[]) : (problems.push("listen: a list of `localhost` or addresses"), []);
  return problems.length > 0 ? err(problems) : ok({ machine, version: version as number, port: p, listen });
}

/** A mail relay profile from what was written. */
export function parseMailRelay(input: unknown): Result<MailRelayProfile, readonly string[]> {
  const o = asObj(input);
  if (o === undefined) return err(["a profile is an object"]);
  const problems = secretProblems(input, "profile");
  const machine = text(o, "machine", NAME, "a machine name", problems);
  const tag = text(o, "tag", NAME, "a tag: lowercase letters, digits and dashes", problems);
  const domain = text(o, "domain", DOMAIN, "a domain name", problems);
  const mailbox = text(o, "mailbox", MAILBOX, "a mailbox address", problems);
  const relay = text(o, "relay", HOSTPORT, "`host:port`, with no scheme and no path", problems);
  const saslUser = text(o, "saslUser", /^[A-Za-z0-9_.-]{1,64}$/, "a user name", problems);
  return problems.length > 0 ? err(problems) : ok({ machine, tag, domain, mailbox, relay, saslUser });
}

/** A certificate profile from what was written. */
export function parseCertificate(input: unknown): Result<CertificateProfile, readonly string[]> {
  const o = asObj(input);
  if (o === undefined) return err(["a profile is an object"]);
  const problems = secretProblems(input, "profile");
  const machine = text(o, "machine", NAME, "a machine name", problems);
  const contact = text(o, "contact", MAILBOX, "a mailbox address", problems);
  const names = Array.isArray(o["names"]) && o["names"].length > 0 && o["names"].every((n) => typeof n === "string" && DOMAIN.test(n.replace(/^\*\./, ""))) ? (o["names"] as string[]) : (problems.push("names: a list of domain names (`*.` for a wildcard)"), []);
  const directory = o["directory"] === undefined ? "https://acme-v02.api.letsencrypt.org/directory" : text(o, "directory", /^https:\/\/[a-z0-9.-]+(:[0-9]+)?(\/[A-Za-z0-9._~-]*)*$/, "an https address", problems);
  if (o["dns"] !== "cloudflare") problems.push("dns: the plugin that answers the challenge, `cloudflare`");
  return problems.length > 0 ? err(problems) : ok({ machine, names, contact, directory, dns: "cloudflare" });
}

/** A tool-server access profile from what was written: the account, the program and each key as one public key line (a private key or anything else is refused). */
export function parseMcpAccess(input: unknown): Result<McpAccessProfile, readonly string[]> {
  const o = asObj(input);
  if (o === undefined) return err(["a profile is an object"]);
  const problems = secretProblems(input, "profile");
  const machine = text(o, "machine", NAME, "a machine name", problems);
  const user = text(o, "user", /^[a-z_][a-z0-9_-]{0,31}$/, "an account name", problems);
  const program = text(o, "program", /^[A-Za-z0-9_./-]+$/, "a program name that can stand in a forced command", problems);
  const keys: McpAccessProfile["keys"][number][] = [];
  if (!Array.isArray(o["keys"]) || o["keys"].length === 0) problems.push("keys: a list of keys");
  else {
    (o["keys"] as unknown[]).forEach((k, i) => {
      const line = authorizedKeysLine({ program: String(program), mode: "mcp", key: { name: String(asObj(k)?.["name"] ?? ""), publicKey: String(asObj(k)?.["publicKey"] ?? ""), role: asObj(k)?.["role"] === "full" ? "full" : "read-only", ...(Array.isArray(asObj(k)?.["from"]) ? { from: asObj(k)?.["from"] as string[] } : {}) } });
      const name = asObj(k)?.["name"];
      const role = asObj(k)?.["role"];
      if (typeof name !== "string" || !NAME.test(name)) problems.push(`keys[${i}].name: a name`);
      if (role !== "read-only" && role !== "full") problems.push(`keys[${i}].role: read-only or full`);
      if (line.kind === "err") problems.push(`keys[${i}]: ${line.error}`);
      else keys.push({ name: String(name), publicKey: String(asObj(k)?.["publicKey"]).trim(), role: role as "read-only" | "full", ...(Array.isArray(asObj(k)?.["from"]) ? { from: asObj(k)?.["from"] as string[] } : {}) });
    });
  }
  return problems.length > 0 ? err(problems) : ok({ machine, user, program, keys });
}
