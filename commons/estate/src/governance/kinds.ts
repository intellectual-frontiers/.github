// Spec: 0007-estate-kinds FR-001, FR-002, FR-003
// Spec: 0008-estate-workstations FR-001, FR-002, FR-003, FR-005
/**
 * The kinds of asset that carry typed attributes, and the named kinds of link between assets. An asset of a kind in this catalog states its attributes as data, and each is checked: a required one is there, one that is there is of its type and, where the catalog lists
 * the values, one of them. A kind that is not in the catalog (`server`, `device`) carries none, and still any word is a kind. The catalog is additive: a kind or an attribute is added, never renamed.
 *
 * @example
 * ```ts
 * import { checkAttributes } from "./kinds.ts";
 * checkAttributes("endpoint", { scheme: "https", host: "api.example.test", port: 443 }); // []
 * ```
 *
 * @module
 */
import { serviceByName } from "./services.ts";

/** The value of an attribute. */
export type AttributeValue = string | number | boolean | readonly string[];

/** One attribute of a kind. */
export type AttributeSpec = {
  readonly name: string;
  readonly type: "string" | "number" | "boolean" | "strings";
  readonly required?: boolean;
  /** The values it may have, for a string. */
  readonly values?: readonly string[];
  readonly summary: string;
};

/** A kind of asset that carries attributes. */
export type KindSpec = { readonly kind: string; readonly summary: string; readonly attributes: readonly AttributeSpec[] };

const str = (name: string, summary: string, o: { required?: boolean; values?: readonly string[] } = {}): AttributeSpec => ({ name, type: "string", summary, ...o });
const num = (name: string, summary: string, o: { required?: boolean } = {}): AttributeSpec => ({ name, type: "number", summary, ...o });
const bool = (name: string, summary: string): AttributeSpec => ({ name, type: "boolean", summary });
const strs = (name: string, summary: string): AttributeSpec => ({ name, type: "strings", summary });

/** The coding harnesses an estate knows by name (a harness not here is `other`). */
export const HARNESSES = ["claude-code", "codex", "herdr", "other"] as const;

/** The digest of the typed `agents` policy that bounds what the harnesses of a workshop may do: `sha256:` and 64 hexadecimal digits. */
export const AGENTS_POLICY_DIGEST = /^sha256:[0-9a-f]{64}$/;

/** The kinds with attributes. */
export const KINDS: readonly KindSpec[] = [
  {
    kind: "cloud-resource",
    summary: "A resource of a cloud account: a machine, a bucket, a database, a function, a rule, as the cloud names it.",
    attributes: [
      str("provider", "The cloud.", { required: true, values: ["aws", "azure", "cloudflare", "gcp", "other"] }),
      str("partition", "The partition of the cloud, where it has more than one.", { values: ["aws", "aws-us-gov", "azure-public", "azure-government", "cloudflare"] }),
      str("type", "The type of resource as the provider or its tooling names it, for example aws_instance.", { required: true }),
      str("account", "The account, subscription or zone."),
      str("region", "The region."),
      str("identifier", "The provider's own identifier."),
      str("source", "Where the asset was learned from.", { values: ["iac", "connector", "manual"] }),
      str("provenance", "Where the asset was read from, as tool:file#address (written by the importers of infrastructure as code)."),
    ],
  },
  {
    kind: "endpoint",
    summary: "A place a client reaches a service: an address, a port and the protocol spoken there.",
    attributes: [
      str("scheme", "The protocol spoken.", { required: true, values: ["http", "https", "tcp", "udp", "tls", "ssh", "grpc", "ws", "wss"] }),
      str("host", "The name or address.", { required: true }),
      num("port", "The port."),
      str("path", "The path, for a web endpoint."),
      str("service", "The common service, by its name in the services catalog."),
      str("exposure", "Who can reach it.", { values: ["internet", "partner", "internal", "management"] }),
      str("authentication", "How a client proves who it is.", { values: ["none", "basic", "token", "oauth", "mtls", "session", "unknown"] }),
      str("api", "The description of its interface, where it is an API.", { values: ["openapi", "graphql", "grpc", "soap", "none"] }),
      str("provenance", "Where the asset was read from, as tool:file#address (written by the importers of infrastructure as code)."),
    ],
  },
  {
    kind: "application",
    summary: "A piece of software the organization runs or ships.",
    attributes: [
      str("tier", "What it does in the system.", { values: ["web", "api", "worker", "batch", "database", "library", "agent-harness"] }),
      str("harness", "The coding harness, where the tier is agent-harness.", { values: HARNESSES }),
      str("language", "The language it is written in."),
      str("repository", "The address of its source repository."),
      str("image", "The container image it runs from, where it runs from one."),
      strs("handles", "The data classes it handles."),
      str("provenance", "Where the asset was read from, as tool:file#address (written by the importers of infrastructure as code)."),
    ],
  },
  {
    kind: "workstation",
    summary: "Where the operator, a person or an agent, orchestrates from: the harness client, the operator's identity and keys.",
    attributes: [
      str("role", "What the machine is for.", { values: ["developer", "operator", "other"] }),
      str("os-family", "The family of the operating system, as observed.", { values: ["arch", "debian", "rhel", "macos", "windows", "other"] }),
      str("distro", "The distribution, as observed.", { values: ["arch", "ubuntu", "debian", "rocky", "macos", "windows", "other"] }),
      strs("harnesses", "The client harnesses installed on it: claude-code, codex, herdr or other."),
    ],
  },
  {
    kind: "workshop",
    summary: "Where the work happens: a machine, a virtual machine or a container on which coding harnesses work; an agent workspace is one whose role is agent-workspace.",
    attributes: [
      str("role", "What the workshop is for.", { values: ["agent-workspace", "build", "test", "other"] }),
      str("disposability", "Whether it may be thrown away and rebuilt.", { values: ["disposable", "persistent"] }),
      str("isolation", "What isolates it from the machine it runs on.", { values: ["container", "vm", "physical"] }),
      str("os-family", "The family of the operating system, as observed.", { values: ["arch", "debian", "rhel", "macos", "windows", "other"] }),
      str("distro", "The distribution, as observed (the real one: an Omarchy machine is arch).", { values: ["arch", "ubuntu", "debian", "rocky", "macos", "windows", "other"] }),
      bool("omarchy", "Whether the machine is an Omarchy machine (distro arch, with Omarchy on it), as observed."),
      strs("harnesses", "The coding harnesses installed: claude-code, codex, herdr or other."),
      str("agents-policy", "The digest (sha256:, 64 hexadecimal digits) of the typed agents policy that bounds the harnesses, as the person who sets the machine up states it."),
    ],
  },
  {
    kind: "mobile-app",
    summary: "An application on a phone or tablet.",
    attributes: [
      str("platform", "The platform.", { required: true, values: ["ios", "android"] }),
      str("bundle-id", "The bundle or package identifier.", { required: true }),
      str("distribution", "How it reaches devices.", { values: ["app-store", "play-store", "enterprise", "sideload"] }),
      str("min-os", "The oldest system release it runs on."),
      bool("allows-cleartext", "Whether the app is set to allow traffic in the clear."),
      str("provenance", "Where the asset was read from, as tool:file#address (written by the importers)."),
      strs("handles", "The data classes it handles."),
    ],
  },
  {
    kind: "service",
    summary: "A common network service running somewhere (a database, a mail server, a directory).",
    attributes: [str("service", "The common service, by its name in the services catalog.", { required: true }), str("version", "The version."), num("port", "The port, where it is not the usual one."), str("provenance", "Where the asset was read from, as tool:file#address (written by the importers of infrastructure as code).")],
  },
  {
    kind: "domain",
    summary: "A name in the domain name system.",
    attributes: [str("name", "The name.", { required: true }), str("registrar", "The registrar."), bool("dnssec", "Whether it is signed."), str("provenance", "Where the asset was read from, as tool:file#address (written by the importers of infrastructure as code).")],
  },
  {
    kind: "certificate",
    summary: "A certificate of the web or of a service.",
    attributes: [str("subject", "The name it is issued to.", { required: true }), str("issuer", "Who issued it."), str("not-after", "The day it expires, as YYYY-MM-DD."), str("key", "The key type and size, for example rsa-2048."), strs("names", "The names it is valid for (its subject alternative names)."), str("provenance", "Where the asset was read from, as tool:file#address (written by the importers of infrastructure as code).")],
  },
];

/** The kinds with attributes, by name. */
export function kindSpec(kind: string): KindSpec | undefined {
  return KINDS.find((k) => k.kind === kind);
}

/** The reasons attributes are not right for a kind: nothing for a kind with no spec (it carries none that are checked), and for one with a spec an unknown attribute, a missing required one, a wrong type or a value that is not one of those listed. */
export function checkAttributes(kind: string, attributes: Readonly<Record<string, AttributeValue>> | undefined): readonly string[] {
  const spec = kindSpec(kind);
  if (spec === undefined) return [];
  const given = attributes ?? {};
  const problems: string[] = [];
  for (const name of Object.keys(given)) if (!spec.attributes.some((a) => a.name === name)) problems.push(`${kind} has no attribute ${name} (${spec.attributes.map((a) => a.name).join(", ")})`);
  for (const a of spec.attributes) {
    const v = given[a.name];
    if (v === undefined) {
      if (a.required === true) problems.push(`${kind} needs the attribute ${a.name}`);
      continue;
    }
    const ok = a.type === "strings" ? Array.isArray(v) && v.every((x) => typeof x === "string") : typeof v === a.type;
    if (!ok) {
      problems.push(`${kind} attribute ${a.name} is ${a.type === "strings" ? "a list of strings" : `a ${a.type}`}`);
      continue;
    }
    if (a.values !== undefined && typeof v === "string" && !a.values.includes(v)) problems.push(`${kind} attribute ${a.name} is ${JSON.stringify(v)}, which is none of ${a.values.join(", ")}`);
  }
  if (kind === "endpoint" || kind === "service") {
    const name = given["service"];
    if (typeof name === "string" && serviceByName(name) === undefined) problems.push(`${kind} names the service ${name}, which the services catalog does not have`);
  }
  if (kind === "application") {
    const harness = given["harness"];
    if (harness !== undefined && given["tier"] !== "agent-harness") problems.push("application attribute harness is for the tier agent-harness");
  }
  if (kind === "workshop") {
    const digest = given["agents-policy"];
    if (typeof digest === "string" && !AGENTS_POLICY_DIGEST.test(digest)) problems.push("workshop attribute agents-policy is not a digest (sha256: and 64 hexadecimal digits)");
    if (given["omarchy"] === true && given["distro"] !== undefined && given["distro"] !== "arch") problems.push("an Omarchy workshop is distro arch");
    if (given["omarchy"] === true && given["os-family"] !== undefined && given["os-family"] !== "arch") problems.push("an Omarchy workshop is os-family arch");
  }
  return problems;
}

/** A named kind of link. `from` and `to` are the kinds of asset the ends may be; `any` is any. */
export type LinkSpec = { readonly kind: string; readonly from: readonly string[] | "any"; readonly to: readonly string[] | "any"; readonly summary: string };

/** The named kinds of link. A link of a kind that is not here is allowed and unchecked; one of these kinds is refused where an end is not of a kind it may join. */
export const LINK_KINDS: readonly LinkSpec[] = [
  { kind: "runs-on", from: ["application", "service"], to: ["server", "workstation", "workshop", "cloud-resource", "device"], summary: "An application or a service runs on a machine or a cloud resource." },
  { kind: "exposes", from: ["server", "cloud-resource", "application", "service", "device"], to: ["endpoint"], summary: "An asset makes an endpoint reachable." },
  { kind: "depends-on", from: "any", to: "any", summary: "An asset cannot work without another." },
  { kind: "resolves-to", from: ["domain"], to: ["endpoint", "server", "cloud-resource", "device"], summary: "A name leads to an asset." },
  { kind: "secured-by", from: ["endpoint", "domain"], to: ["certificate"], summary: "An endpoint or a name is secured with a certificate." },
  { kind: "client-of", from: ["mobile-app", "application"], to: ["endpoint", "application"], summary: "An application talks to an endpoint or to another application." },
];

/** A named kind of link by its name. */
export function linkSpec(kind: string): LinkSpec | undefined {
  return LINK_KINDS.find((l) => l.kind === kind);
}

/** The reasons a link of a kind may not join two assets of the given kinds, or nothing where it may (or where the link kind is not a named one). */
export function checkLink(kind: string, fromKind: string, toKind: string): readonly string[] {
  const spec = linkSpec(kind);
  if (spec === undefined) return [];
  const problems: string[] = [];
  if (spec.from !== "any" && !spec.from.includes(fromKind)) problems.push(`a ${kind} link starts at ${spec.from.join(", ")}, not at a ${fromKind}`);
  if (spec.to !== "any" && !spec.to.includes(toKind)) problems.push(`a ${kind} link ends at ${spec.to.join(", ")}, not at a ${toKind}`);
  return problems;
}
