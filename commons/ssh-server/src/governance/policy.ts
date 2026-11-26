// Spec: 0003-server-policy FR-005
// Spec: 0005-enrollment-policy FR-001
/**
 * The policies as typed data. The server policy says who may connect and how fast; the enrollment policy says when a session is approved without a person. Both are data, read by pure functions of the logical layer.
 *
 * @module
 */

/** How an anonymous client (one with no key) is let in: by the method `keyboard-interactive` with no prompt (so that a client that has a key is asked for it first), by the method `none`, or not at all. */
export type AnonymousMode = "keyboard-interactive" | "none" | "refuse";

/** The service accounts of the conversation host. The username of an ssh login names the conversation family: it is never a person and never a shell. */
export type ServiceAccount = "s-enroll" | "s-device" | "s-operator" | "s-agent" | "s-assist";

/** What a service account is: how it authenticates, whether it is built, and the audience that may use it. */
export type AccountSpec = { readonly name: ServiceAccount; readonly auth: "none" | "proven-key"; readonly built: boolean; readonly audience: string };

/** The closed table of service accounts. `s-enroll` takes anyone from an allowed network; `s-device` takes only a key that an enrolled device proved; the others are reserved (0006-reserved). */
export const ACCOUNTS: readonly AccountSpec[] = [
  { name: "s-enroll", auth: "none", built: true, audience: "a device that is not yet known: knock, join, bootstrap, report, next, done" },
  { name: "s-device", auth: "proven-key", built: true, audience: "an enrolled device: checkin, leave; reserved: jobs, query, evidence, fetch, health, presence" },
  { name: "s-operator", auth: "proven-key", built: false, audience: "an operator's key: the command line over ssh (reserved)" },
  { name: "s-agent", auth: "proven-key", built: false, audience: "an agent's key: MCP over ssh (reserved)" },
  { name: "s-assist", auth: "proven-key", built: false, audience: "a shared support terminal, recorded (reserved)" },
];

/** The spec of a username, or nothing where it is no service account. */
export function accountOf(username: string): AccountSpec | undefined {
  return ACCOUNTS.find((a) => a.name === username);
}

/**
 * What a product that hosts the server calls itself, given by the product and never by this library (IF Commons holds no product code). It names the things the scripts and the server say or create on a machine.
 */
export type Brand = {
  /** The name of the product as a person reads it (the first line of a script and the answer of `hello`). */
  readonly name: string;
  /** The prefix of the environment variables a script reads (`PREFIX_HOST`, `PREFIX_PORT`, `PREFIX_CONSENT`, ...): capital letters, digits and `_`, starting with a letter. */
  readonly envPrefix: string;
  /** The folder a script keeps its state in on a POSIX machine (an absolute path) and, on Windows, the folder name under `ProgramData`. */
  readonly stateDir: { readonly posix: string; readonly windows: string };
  /** The comment of the key a device makes (`ssh-keygen -C`). */
  readonly keyComment: string;
  /** The identification of the server in the SSH banner (`name-enroll_0.1`). */
  readonly serverIdent: string;
  /** What a person types on the controller to approve a session, given its id and the code the device shows (a string for a person to read, never run by a script). */
  readonly approveHint: (sessionId: string, code: string) => string;
};

/** Whether a brand is well formed: its prefix is a legal variable prefix and its texts are single printable lines without quotes or shell syntax. Returns the reasons it is not. */
export function brandProblems(b: Brand): readonly string[] {
  const out: string[] = [];
  if (!/^[A-Z][A-Z0-9_]*$/.test(b.envPrefix)) out.push("envPrefix is capital letters, digits and _");
  if (!/^[A-Za-z0-9 ._-]{1,64}$/.test(b.name)) out.push("name is 1 to 64 letters, digits, spaces, dots, underscores and hyphens");
  if (!/^\/[A-Za-z0-9._/-]{1,100}$/.test(b.stateDir.posix)) out.push("stateDir.posix is an absolute path of safe characters");
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(b.stateDir.windows)) out.push("stateDir.windows is a folder name of safe characters");
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(b.keyComment)) out.push("keyComment is safe characters");
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(b.serverIdent)) out.push("serverIdent is safe characters");
  const hint = b.approveHint("en-x", "000000");
  if (!/^[A-Za-z0-9 ._:/@=+,%<>-]{1,300}$/.test(hint)) out.push("approveHint gives one line of safe characters (no quote, backslash, dollar or semicolon)");
  return out;
}

/** The server policy. */
export type ServerPolicy = {
  /** The service accounts the server accepts (only built ones can be listed). */
  readonly accounts: readonly ServiceAccount[];
  /** The most bytes of a conversation to keep as a transcript in the audit log (0: digests only). */
  readonly transcriptBytes: number;
  readonly anonymous: AnonymousMode;
  /** The CIDR blocks a source may be in, as well as the private ranges (RFC 1918, loopback, link-local, ULA) that are always allowed. Public ranges are refused unless listed here. */
  readonly allowCidrs: readonly string[];
  /** A name and a port the scripts say to a person and call. The product MUST give it: this library has no default name. */
  readonly endpoint: { readonly host: string; readonly port: number };
  /** What the product calls itself in the scripts and the banner. The product MUST give it. */
  readonly brand: Brand;
  readonly maxAuthTries: number;
  readonly maxConnections: number;
  readonly maxConnectionsPerIp: number;
  readonly handshakeTimeoutMs: number;
  readonly idleTimeoutMs: number;
  readonly totalTimeoutMs: number;
  readonly maxStdinBytes: number;
  readonly bucket: { readonly capacity: number; readonly refillPerSecond: number };
  readonly penalty: { readonly baseMs: number; readonly maxMs: number };
  readonly sessionTtlMs: number;
  /** The short authentication string a person types: 6 digits by default, or 4 letters of an alphabet without look-alikes. */
  readonly pairing: PairingConfig;
  /** How long a pairing may take from its first message, and how many wrong codes burn it. */
  readonly pairingTtlMs: number;
  readonly maxPairingAttempts: number;
};

/** The kind and length of a short authentication string. `digits` takes 4 to 9 digits, `letters` 3 to 6 letters of {@link LETTERS}. */
export type PairingConfig = { readonly kind: "digits" | "letters"; readonly length: number };

/** The alphabet of letter codes: no I, L, O (and no 0, 1) so that a person reading aloud or typing cannot mistake one for another. */
export const LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ";

/** What a product must give the server: where devices reach it and what it is called. */
export type ServerIdentity = Pick<ServerPolicy, "endpoint" | "brand">;

/** The defaults of the server policy, with no endpoint and no brand: see {@link serverPolicy}. */
export const SERVER_POLICY_DEFAULTS: Omit<ServerPolicy, "endpoint" | "brand"> = {
  accounts: ["s-enroll", "s-device"],
  transcriptBytes: 0,
  anonymous: "keyboard-interactive",
  allowCidrs: [],
  maxAuthTries: 6,
  maxConnections: 64,
  maxConnectionsPerIp: 8,
  handshakeTimeoutMs: 10_000,
  idleTimeoutMs: 120_000,
  totalTimeoutMs: 600_000,
  maxStdinBytes: 256 * 1024,
  bucket: { capacity: 20, refillPerSecond: 1 },
  penalty: { baseMs: 1000, maxMs: 15 * 60_000 },
  sessionTtlMs: 24 * 3_600_000,
  pairing: { kind: "digits", length: 6 },
  pairingTtlMs: 5 * 60_000,
  maxPairingAttempts: 3,
};

/** The policy of a product: the defaults, its identity and the changes it wants. */
export function serverPolicy(identity: ServerIdentity, changes: Partial<Omit<ServerPolicy, "endpoint" | "brand">> = {}): ServerPolicy {
  return { ...SERVER_POLICY_DEFAULTS, ...changes, endpoint: identity.endpoint, brand: identity.brand };
}

/** An inventory entry by which a device is approved: a serial, a MAC, a machine id or a host key fingerprint. */
export type InventoryEntry = { readonly serial?: string; readonly mac?: string; readonly machineId?: string; readonly hostKey?: string; readonly tenant?: string; readonly fleet?: string; readonly labels?: readonly string[] };

/** A rule of the enrollment policy. The first rule that matches decides. */
export type EnrollRule =
  | { readonly kind: "token"; readonly tenant?: string; readonly fleet?: string; readonly labels?: readonly string[] }
  | { readonly kind: "pairing-code" }
  | { readonly kind: "inventory"; readonly allow: readonly InventoryEntry[] }
  | { readonly kind: "source-network"; readonly cidrs: readonly string[] }
  | { readonly kind: "cloud-attestation"; readonly provider: "aws" | "azure" | "gcp" }
  | { readonly kind: "refuse-network"; readonly cidrs: readonly string[] };

/** The enrollment policy: rules in order, and a session that no rule approves waits for a person. */
export type EnrollPolicy = { readonly rules: readonly EnrollRule[] };

/** The policy that approves nothing: a person decides every session. */
export const PERSON_DECIDES: EnrollPolicy = { rules: [] };
