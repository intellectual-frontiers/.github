// Spec: 0002-linux-services-profiles FR-003, FR-004, FR-005, FR-006
/**
 * The requirements of Archon that a profile makes, over the kinds it has (package, directory, file, service), and the text of each file. Nothing here runs a program or reads a machine.
 *
 * @example
 * ```ts
 * import { postgresRequirements } from "./services.ts";
 * const r = postgresRequirements({ machine: "olympia", version: 18, port: 5432, listen: ["localhost"] });
 * r.kind; // "ok"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { defineRequirement, type Requirement, type RequirementInput } from "@intellectual-frontiers/archon/governance";
import { authorizedKeysLine } from "@intellectual-frontiers/headless/ssh-inbound";
import type { CertificateProfile, MailRelayProfile, McpAccessProfile, PostgresProfile } from "@intellectual-frontiers/linux-services/governance";

const HEADER = "# Rendered by archon from the model of the fleet. Do not edit: change the model.\n";

/** Where the secrets of the services are put on a machine, by the owner and never in the model. */
export const SECRET_PATHS = {
  /** `postmap`-style SASL password file of the relay: `[relay]:port user:token`. */
  mailSasl: "/etc/postfix/sasl_passwd",
  /** The credentials file of certbot's Cloudflare plugin. */
  cloudflareCredentials: "/etc/letsencrypt/cloudflare.ini",
} as const;

/** Make the requirements of one profile as a list, or every reason a requirement is refused. */
function build(inputs: readonly RequirementInput[]): Result<readonly Requirement[], readonly string[]> {
  const out: Requirement[] = [];
  const problems: string[] = [];
  for (const input of inputs) {
    const r = defineRequirement(input);
    if (r.kind === "ok") out.push(r.value);
    else problems.push(...r.error.map((p) => `${input.id}: ${p}`));
  }
  return problems.length > 0 ? err(problems) : ok(out);
}

const subjectOf = (machine: string) => ({ by: "names" as const, names: [machine] });
const OWNED = { owner: "root", group: "root" } as const;

/** The drop-in of PostgreSQL's configuration: the port, the addresses, the logs. */
export function postgresDropIn(p: PostgresProfile): string {
  return `${HEADER}port = ${p.port}\nlisten_addresses = '${p.listen.join(",")}'\nlog_connections = on\nlog_disconnections = on\nlog_line_prefix = '%m [%p] %q%u@%d '\n`;
}

/** The requirements of a PostgreSQL cluster, the one Ubuntu's package makes. */
export function postgresRequirements(p: PostgresProfile): Result<readonly Requirement[], readonly string[]> {
  const base = `services.postgresql-${p.version}`;
  const why = ["0002-linux-services-profiles FR-003", "SC-7 boundary protection", "AU-2 event logging"];
  const unit = `postgresql@${p.version}-main.service`;
  const dir = `/etc/postgresql/${p.version}/main/conf.d`;
  return build([
    { id: `${base}.package`, summary: `PostgreSQL ${p.version} is installed from the archive.`, why, subject: subjectOf(p.machine), kind: "package", desired: { name: `postgresql-${p.version}` }, change: "additive" },
    { id: `${base}.confd`, summary: `The drop-in folder of the PostgreSQL ${p.version} cluster is there.`, why, subject: subjectOf(p.machine), kind: "directory", desired: { path: dir, mode: "0755", ...OWNED }, change: "additive", dependsOn: [`${base}.package`] },
    { id: `${base}.config`, summary: `The cluster listens on ${p.listen.join(",")} port ${p.port} and logs connections.`, why, subject: subjectOf(p.machine), kind: "file", desired: { path: `${dir}/50-archon.conf`, content: postgresDropIn(p), mode: "0644", ...OWNED }, change: "mutating", dependsOn: [`${base}.confd`] },
    { id: `${base}.service`, summary: `The cluster ${p.version}/main runs and starts at boot.`, why, subject: subjectOf(p.machine), kind: "service", desired: { name: unit, running: true, enabled: true }, change: "mutating", dependsOn: [`${base}.config`] },
  ]);
}

const re = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** The name the machine says in mail: `<machine>.<tag>.<domain>`. */
export function mailName(p: MailRelayProfile): string {
  return `${p.machine}.${p.tag}.${p.domain}`;
}

/** Postfix's main.cf of a null client that relays everything over implicit TLS. */
export function mainCf(p: MailRelayProfile): string {
  const [host = "", port = ""] = p.relay.split(":");
  return [
    "# Rendered by archon from the model of the fleet. Do not edit: change the model.",
    "# A send-only null client: relays this machine's mail to the fleet's relay.",
    "compatibility_level = 3.6",
    `myhostname = ${mailName(p)}`,
    `myorigin = ${mailName(p)}`,
    "mydestination =",
    "local_transport = error:local delivery is disabled",
    "alias_maps =",
    "alias_database =",
    "inet_interfaces = loopback-only",
    "inet_protocols = ipv4",
    "mynetworks = 127.0.0.0/8 [::1]/128",
    `relayhost = [${host}]:${port}`,
    "smtp_tls_wrappermode = yes",
    "smtp_tls_security_level = secure",
    "smtp_tls_CAfile = /etc/ssl/certs/ca-certificates.crt",
    "smtp_sasl_auth_enable = yes",
    "smtp_sasl_security_options = noanonymous",
    `smtp_sasl_password_maps = texthash:${SECRET_PATHS.mailSasl}`,
    "smtp_generic_maps = regexp:/etc/postfix/archon-sender.regexp",
    "recipient_canonical_maps = regexp:/etc/postfix/archon-recipients.regexp",
    "",
  ].join("\n");
}

/** Every sender becomes `<user>+<machine>.<tag>@<domain>`, as RFC 5233 subaddresses. */
export function senderMap(p: MailRelayProfile): string {
  return `${HEADER}/^([^@+]+)(\\+[^@]*)?@.*$/ \${1}+${p.machine}.${p.tag}@${p.domain}\n`;
}

/** Every address of a local account goes to the mailbox of the fleet. */
export function recipientMap(p: MailRelayProfile): string {
  return `${HEADER}/^[^@]+@${re(mailName(p))}$/ ${p.mailbox}\n`;
}

/** The requirements of a send-only mail relay. */
export function mailRelayRequirements(p: MailRelayProfile): Result<readonly Requirement[], readonly string[]> {
  const base = "services.mail-relay";
  const why = ["0002-linux-services-profiles FR-004", "SC-8 transmission confidentiality", "SI-4 system monitoring (the machine can tell its owner)"];
  const files = [["main", "/etc/postfix/main.cf", mainCf(p)], ["sender", "/etc/postfix/archon-sender.regexp", senderMap(p)], ["recipients", "/etc/postfix/archon-recipients.regexp", recipientMap(p)]] as const;
  return build([
    { id: `${base}.package`, summary: "Postfix is installed from the archive.", why, subject: subjectOf(p.machine), kind: "package", desired: { name: "postfix" }, change: "additive" },
    ...files.map(([part, path, content]) => ({ id: `${base}.${part}`, summary: `${path} makes the machine a send-only client of ${p.relay}.`, why, subject: subjectOf(p.machine), kind: "file", desired: { path, content, mode: "0644", ...OWNED }, change: "mutating", dependsOn: [`${base}.package`] })),
    { id: `${base}.service`, summary: "Postfix runs and starts at boot.", why, subject: subjectOf(p.machine), kind: "service", desired: { name: "postfix.service", running: true, enabled: true }, change: "mutating", dependsOn: files.map(([part]) => `${base}.${part}`) },
  ]);
}

/** The `cli.ini` of certbot: the authority, the account's contact, the DNS plugin and where its credentials are. */
export function certbotCli(p: CertificateProfile): string {
  return [
    "# Rendered by archon from the model of the fleet. Do not edit: change the model.",
    `server = ${p.directory}`,
    `email = ${p.contact}`,
    "agree-tos = true",
    "non-interactive = true",
    "authenticator = dns-cloudflare",
    `dns-cloudflare-credentials = ${SECRET_PATHS.cloudflareCredentials}`,
    "dns-cloudflare-propagation-seconds = 30",
    "",
  ].join("\n");
}

/** The unit that obtains the certificate once, where it is not yet there. */
export function issueUnit(p: CertificateProfile): string {
  const name = (p.names[0] ?? "").replace(/^\*\./, "");
  const domains = p.names.map((n) => `-d ${n}`).join(" ");
  return `${HEADER}[Unit]\nDescription=Obtain the certificate ${name}\nConditionPathExists=!/etc/letsencrypt/live/${name}/fullchain.pem\nConditionPathExists=${SECRET_PATHS.cloudflareCredentials}\nAfter=network-online.target\nWants=network-online.target\n\n[Service]\nType=oneshot\nExecStart=/usr/bin/certbot certonly --cert-name ${name} ${domains}\n\n[Install]\nWantedBy=multi-user.target\n`;
}

/** The requirements of a machine that obtains and renews a certificate. */
export function certificateRequirements(p: CertificateProfile): Result<readonly Requirement[], readonly string[]> {
  const name = (p.names[0] ?? "").replace(/^\*\./, "");
  const base = `services.certificate-${name.replace(/[^a-z0-9]+/g, "-")}`;
  const why = ["0002-linux-services-profiles FR-005", "SC-12 key establishment", "SC-17 public key infrastructure certificates"];
  const unit = `archon-cert-${name}.service`;
  return build([
    { id: `${base}.certbot`, summary: "certbot is installed from the archive.", why, subject: subjectOf(p.machine), kind: "package", desired: { name: "certbot" }, change: "additive" },
    { id: `${base}.plugin`, summary: "certbot's Cloudflare DNS plugin is installed from the archive.", why, subject: subjectOf(p.machine), kind: "package", desired: { name: "python3-certbot-dns-cloudflare" }, change: "additive", dependsOn: [`${base}.certbot`] },
    { id: `${base}.cli`, summary: `certbot uses ${p.directory} with the DNS-01 challenge of Cloudflare.`, why, subject: subjectOf(p.machine), kind: "file", desired: { path: "/etc/letsencrypt/cli.ini", content: certbotCli(p), mode: "0644", ...OWNED }, change: "mutating", dependsOn: [`${base}.certbot`] },
    { id: `${base}.issue-unit`, summary: `The unit that obtains ${name} where it is not yet there.`, why, subject: subjectOf(p.machine), kind: "file", desired: { path: `/etc/systemd/system/${unit}`, content: issueUnit(p), mode: "0644", ...OWNED }, change: "additive", dependsOn: [`${base}.plugin`, `${base}.cli`] },
    { id: `${base}.issue`, summary: `The unit that obtains ${name} is enabled, so that a machine without it obtains it at boot.`, why, subject: subjectOf(p.machine), kind: "service", desired: { name: unit, running: false, enabled: true }, change: "mutating", dependsOn: [`${base}.issue-unit`] },
    { id: `${base}.renewal`, summary: "The timer of Ubuntu's package renews the certificate.", why, subject: subjectOf(p.machine), kind: "service", desired: { name: "certbot.timer", running: true, enabled: true }, change: "mutating", dependsOn: [`${base}.cli`] },
  ]);
}

/** The `authorized_keys` of the account: a line for each key that forces `<program> mcp` (with `--read-only` for a key that may only read), and so no shell, no terminal and no forwarding (`restrict`). */
export function mcpAuthorizedKeys(p: McpAccessProfile): Result<string, readonly string[]> {
  const lines: string[] = [];
  const problems: string[] = [];
  for (const key of p.keys) {
    const line = authorizedKeysLine({ program: p.program, mode: "mcp", key });
    if (line.kind === "ok") lines.push(line.value);
    else problems.push(`${key.name}: ${line.error}`);
  }
  return problems.length > 0 ? err(problems) : ok(`# Rendered by archon from the model of the fleet. Do not edit: change the model.\n${lines.join("\n")}\n`);
}

/** The requirements of a machine that serves a program as a tool server over ssh: the account's `.ssh` folder and its `authorized_keys`, which let in only the keys of the profile and only to that program. */
export function mcpAccessRequirements(p: McpAccessProfile): Result<readonly Requirement[], readonly string[]> {
  const content = mcpAuthorizedKeys(p);
  if (content.kind === "err") return content;
  const base = `services.mcp-${p.user}`;
  const home = p.user === "root" ? "/root" : `/home/${p.user}`;
  const why = ["0002-linux-services-profiles FR-009", "AC-3 access enforcement", "AC-6 least privilege", "IA-2 identification and authentication"];
  return build([
    { id: `${base}.ssh-dir`, summary: `The .ssh folder of ${p.user} is private to it.`, why, subject: subjectOf(p.machine), kind: "directory", desired: { path: `${home}/.ssh`, mode: "0700", owner: p.user, group: p.user }, change: "additive" },
    { id: `${base}.keys`, summary: `Only the keys of the profile let in as ${p.user}, each to ${p.program} mcp and nothing else.`, why, subject: subjectOf(p.machine), kind: "file", desired: { path: `${home}/.ssh/authorized_keys`, content: content.value, mode: "0600", owner: p.user, group: p.user }, change: "mutating", dependsOn: [`${base}.ssh-dir`] },
  ]);
}
