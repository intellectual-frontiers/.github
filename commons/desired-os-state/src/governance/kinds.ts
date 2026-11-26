// Spec: 0002-desired-os-state-governance FR-002
/**
 * The kinds of resource a requirement can be about, as data: each with a sentence, the classes of subject it applies to and whether it can destroy. A dialect says which of them it can carry
 * out, and a fleet that needs a kind that is not here adds it to its own catalogue.
 *
 * @example
 * ```ts
 * import { kindOf } from "./kinds.ts";
 * kindOf("package")?.subjects; // ["machine", "workstation"]
 * ```
 *
 * @module
 */
import { parseKindId, type ResourceKindId } from "./ids.ts";

/** What an order can be for: a machine, a device, a workstation or a cloud account. */
export type SubjectClass = "machine" | "device" | "workstation" | "cloud-account";

/** Every class of subject. */
export const SUBJECT_CLASSES: readonly SubjectClass[] = ["machine", "device", "workstation", "cloud-account"];

/** A kind of resource. */
export type KindSpec = {
  readonly id: ResourceKindId;
  readonly summary: string;
  readonly subjects: readonly SubjectClass[];
  readonly canDestroy: boolean;
};

/** A kind of the catalogue; a wrong id is a mistake in this file that the tests find. */
function kind(id: string, summary: string, subjects: readonly SubjectClass[], canDestroy: boolean): KindSpec {
  const parsed = parseKindId(id);
  if (parsed.kind === "err") throw new Error(parsed.error);
  return { id: parsed.value, summary, subjects, canDestroy };
}

const COMPUTERS: readonly SubjectClass[] = ["machine", "workstation"];

/** The catalogue. */
export const KINDS: readonly KindSpec[] = [
  kind("package", "A software package installed from the system's own sources.", COMPUTERS, true),
  kind("user", "A user account.", COMPUTERS, true),
  kind("group", "A group of users.", COMPUTERS, true),
  kind("file", "A file with its content, owner and mode.", [...COMPUTERS, "device"], true),
  kind("directory", "A directory with its owner and mode.", COMPUTERS, true),
  kind("tool", "A program a computer needs at a pinned version: a compiler, a command line tool, a runtime. What it is, its pin and where it comes from are declared by the toolchain library.", COMPUTERS, true),
  kind("service", "A service that runs, or does not, and starts at boot, or does not.", COMPUTERS, false),
  kind("timer", "A scheduled job.", COMPUTERS, true),
  kind("firewall-rule", "A rule of a host or device firewall.", [...COMPUTERS, "device"], true),
  kind("sysctl", "A setting of the kernel.", ["machine"], false),
  kind("system-setting", "A named setting of the operating system that is not a file or a kernel parameter: the time zone, the locale, the keyboard layout, the host name.", COMPUTERS, false),
  kind("ssh-authorized-key", "A public key that may sign in as a user.", COMPUTERS, true),
  kind("mount", "A file system mounted at a path.", ["machine"], true),
  kind("network-setting", "A setting of a network device: an address, a VLAN, a wireless network.", ["device"], false),
  kind("dns-record", "A record of a DNS zone.", ["cloud-account"], true),
  kind("cloud-resource", "A resource of a cloud account, named by its provider, its type and its settings: an account, a network, an identity, storage, a machine.", ["cloud-account"], true),
];

/** The kind of the catalogue with this id, if there is one. */
export function kindOf(id: string, catalogue: readonly KindSpec[] = KINDS): KindSpec | undefined {
  return catalogue.find((k) => k.id === id);
}
