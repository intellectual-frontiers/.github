// Spec: 0007-estate-kinds FR-004
/**
 * The common services: the well known network services an estate has endpoints for, by name, with the transport and the port each is usually found on, what kind of service it is, and whether it speaks in the clear. An endpoint names its service from this
 * catalog, so that a passive check, a scope or a query can say "every management service that is open to the internet" and mean the same thing every time. The data is ours: ports and protocols are facts of the standards, the classes are the estate's own words.
 *
 * @example
 * ```ts
 * import { serviceByName } from "./services.ts";
 * serviceByName("postgres")?.port; // 5432
 * ```
 *
 * @module
 */

/** The class of a service, in the estate's own words: what reaching it lets someone do. */
export const SERVICE_CLASSES = ["web", "management", "data", "mail", "directory", "file", "name", "time", "orchestration"] as const;
/** A class of service. */
export type ServiceClass = (typeof SERVICE_CLASSES)[number];

/** A common service. */
export type ServiceSpec = {
  readonly name: string;
  readonly transport: "tcp" | "udp";
  readonly port: number;
  readonly class: ServiceClass;
  /** Whether the service, spoken on this port as it stands, carries its traffic in the clear. */
  readonly cleartext: boolean;
  readonly summary: string;
};

const s = (name: string, transport: "tcp" | "udp", port: number, klass: ServiceClass, cleartext: boolean, summary: string): ServiceSpec => ({ name, transport, port, class: klass, cleartext, summary });

/** The common services, by name. */
export const SERVICES: readonly ServiceSpec[] = [
  s("http", "tcp", 80, "web", true, "Web over HTTP."),
  s("https", "tcp", 443, "web", false, "Web over TLS."),
  s("ssh", "tcp", 22, "management", false, "Secure shell."),
  s("telnet", "tcp", 23, "management", true, "Telnet, a remote shell in the clear."),
  s("rdp", "tcp", 3389, "management", false, "Remote desktop protocol."),
  s("vnc", "tcp", 5900, "management", true, "Virtual network computing."),
  s("winrm", "tcp", 5986, "management", false, "Windows remote management over TLS."),
  s("kubernetes-api", "tcp", 6443, "orchestration", false, "The API server of Kubernetes."),
  s("kubelet", "tcp", 10250, "orchestration", false, "The agent of Kubernetes on a node."),
  s("docker-api", "tcp", 2376, "orchestration", false, "The API of a container engine over TLS."),
  s("dns", "udp", 53, "name", true, "Name resolution."),
  s("ntp", "udp", 123, "time", true, "Network time."),
  s("smtp", "tcp", 25, "mail", true, "Mail transfer between servers."),
  s("submission", "tcp", 587, "mail", false, "Mail submission with STARTTLS."),
  s("smtps", "tcp", 465, "mail", false, "Mail submission over TLS."),
  s("imaps", "tcp", 993, "mail", false, "Mailbox access over TLS."),
  s("pop3s", "tcp", 995, "mail", false, "Mailbox download over TLS."),
  s("ldap", "tcp", 389, "directory", true, "Directory access."),
  s("ldaps", "tcp", 636, "directory", false, "Directory access over TLS."),
  s("kerberos", "tcp", 88, "directory", false, "Kerberos authentication."),
  s("smb", "tcp", 445, "file", false, "File sharing."),
  s("nfs", "tcp", 2049, "file", true, "Network file system."),
  s("ftp", "tcp", 21, "file", true, "File transfer in the clear."),
  s("sftp", "tcp", 22, "file", false, "File transfer over ssh."),
  s("postgres", "tcp", 5432, "data", false, "PostgreSQL."),
  s("mysql", "tcp", 3306, "data", false, "MySQL and MariaDB."),
  s("mssql", "tcp", 1433, "data", false, "Microsoft SQL Server."),
  s("oracle", "tcp", 1521, "data", true, "Oracle database listener."),
  s("mongodb", "tcp", 27017, "data", true, "MongoDB."),
  s("redis", "tcp", 6379, "data", true, "Redis."),
  s("elasticsearch", "tcp", 9200, "data", true, "Elasticsearch."),
  s("memcached", "tcp", 11211, "data", true, "Memcached."),
  s("snmp", "udp", 161, "management", true, "Network management."),
];

/** A service by its name. */
export function serviceByName(name: string): ServiceSpec | undefined {
  return SERVICES.find((x) => x.name === name);
}

/** The services found on a port and transport (more than one where a port is shared, such as ssh and sftp). */
export function servicesOnPort(port: number, transport: "tcp" | "udp"): readonly ServiceSpec[] {
  return SERVICES.filter((x) => x.port === port && x.transport === transport);
}
