// Spec: 0002-linux-services-profiles FR-001, FR-007
/**
 * The profiles of the services a machine of a small fleet runs, and the rules their fields obey. A profile is data: it carries no secret and runs nothing.
 *
 * @example
 * ```ts
 * import { PORTS, NAME } from "./profiles.ts";
 * NAME.test("prime"); // true
 * PORTS.min; // 1024
 * ```
 *
 * @module
 */

/** A name of a machine, a cluster or a mailbox tag: lowercase letters, digits and dashes, starting with a letter. */
export const NAME = /^[a-z][a-z0-9-]{0,30}$/;
/** A DNS name: labels of letters, digits and dashes, at least two of them. */
export const DOMAIN = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
/** A mailbox: local part and domain, no display name. */
export const MAILBOX = /^[A-Za-z0-9._%+-]{1,64}@([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
/** The ports a service of a machine listens on, without the privileged ones. */
export const PORTS = { min: 1024, max: 65535 } as const;
/** The marker a DNS record of a profile carries in its comment, so that a plan removes only what a profile made. */
export const MARKER = "managed by archon";

/** A PostgreSQL cluster, the one Ubuntu's package makes (`<version>/main`). */
export type PostgresProfile = {
  /** The subject (machine) it is for. */
  readonly machine: string;
  /** The major version: the archive's own (18 on Ubuntu 26.04). */
  readonly version: number;
  readonly port: number;
  /** The addresses it listens on: `localhost` or addresses of the machine. */
  readonly listen: readonly string[];
};

/** A send-only mail relay: Postfix as a null client that sends everything through the relay of the fleet's mail provider. */
export type MailRelayProfile = {
  readonly machine: string;
  /** The name the machine says in the mail it sends, `<machine>.<tag>.<domain>`: given as its parts. */
  readonly tag: string;
  readonly domain: string;
  /** Where mail for local accounts (root, ops, cron) goes. */
  readonly mailbox: string;
  /** The relay, `host:port` over implicit TLS. */
  readonly relay: string;
  /** The user name of SASL; the secret is a file on the machine, and only its path is here. */
  readonly saslUser: string;
};

/** A certificate by DNS-01 from an ACME authority. */
export type CertificateProfile = {
  readonly machine: string;
  /** The names the certificate is for, the first is its name on the disk. */
  readonly names: readonly string[];
  /** The address of the account's mail, where the authority writes. */
  readonly contact: string;
  /** The ACME directory: Let's Encrypt's production unless the profile says another. */
  readonly directory: string;
  /** The DNS plugin of certbot that answers the challenge. */
  readonly dns: "cloudflare";
};

/** A record of a DNS zone. */
export type DnsRecord = {
  readonly type: "A" | "AAAA" | "CNAME" | "TXT" | "MX";
  readonly name: string;
  readonly content: string;
  readonly ttl: number;
  readonly proxied: boolean;
};

/** The records a profile wants in a zone, and the names it claims (a name it lists is its own whatever its records say). */
export type DnsProfile = {
  readonly zone: string;
  readonly records: readonly DnsRecord[];
};
