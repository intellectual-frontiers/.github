// Spec: 0002-cloud-init-dialect FR-001, FR-007
/**
 * The dialect of Archon for the install of a machine from nothing: it renders an order to the autoinstall `user-data` and `meta-data` of one machine and gives no step, because the installer carries it out at the machine's first boot, not an executor. It carries the
 * kinds that an install can state (the administrator, the administrator's keys, the time zone, the locale, the keyboard layout and the packages) and refuses what it cannot. What the machine becomes after it boots is the Ansible dialect's render, which the machine pulls
 * from its signed repository.
 *
 * @example
 * ```ts
 * import { cloudInit, KINDS_CARRIED } from "./dialect.ts";
 * KINDS_CARRIED.includes("user"); // true
 * ```
 *
 * @module
 */
import { err, type Result } from "@intellectual-frontiers/core";
import { renderedOf, type Dialect, type DialectStep, type Rendered } from "@intellectual-frontiers/archon/dialect";
import { findSecretLike, parseDialectId, parseKindId, type JsonValue, type Requirement } from "@intellectual-frontiers/archon/governance";
import type { Order, Plan } from "@intellectual-frontiers/archon/logical";
import { autoinstall, metaData, type DiskSpec, type InstallSpec } from "./install.ts";

/** The id of the dialect. */
export const DIALECT_ID = "cloud-init";

/** The kinds of resource an install can state. */
export const KINDS_CARRIED = ["user", "ssh-authorized-key", "system-setting", "package"] as const;

/** What the dialect is given besides the order: the facts of the install that are not requirements. */
export type CloudInitOptions = {
  readonly fleet: string;
  readonly repository: InstallSpec["repository"];
  readonly allowedSigners: string;
  /** The boot server's URL for this host, ending in a slash. */
  readonly base: string;
  readonly mac?: string;
  readonly disk?: DiskSpec;
  readonly proxy?: string;
};

type Obj = { readonly [key: string]: JsonValue };
const isObj = (v: JsonValue): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

function must<T>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: string }): T {
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

/** The facts of an install from an order, or every reason there are not enough. */
export function installSpecOf(order: Order, o: CloudInitOptions): Result<InstallSpec, readonly string[]> {
  const problems: string[] = [];
  const settings = new Map<string, string>();
  let admin: { user: string; realname: string } | undefined;
  const keys: Array<{ user: string; key: string }> = [];
  const packages: string[] = [];
  for (const r of order.requirements) {
    if (r.ensure === "absent") {
      problems.push(`${r.id}: an install states what must be there, never what must not`);
      continue;
    }
    if (!(KINDS_CARRIED as readonly string[]).includes(String(r.kind))) {
      problems.push(`${r.id}: the kind ${String(r.kind)} is not carried by this dialect (${KINDS_CARRIED.join(", ")})`);
      continue;
    }
    const found = findSecretLike(r.desired);
    if (found.length > 0) problems.push(`${r.id}: desired holds what looks like a secret`);
    const d: Obj = isObj(r.desired) ? r.desired : {};
    switch (String(r.kind)) {
      case "system-setting":
        if (typeof d["name"] === "string" && typeof d["value"] === "string") settings.set(d["name"], d["value"]);
        break;
      case "user":
        if (admin === undefined && typeof d["name"] === "string") admin = { user: d["name"], realname: typeof d["comment"] === "string" ? d["comment"] : d["name"] };
        break;
      case "ssh-authorized-key":
        if (typeof d["user"] === "string" && typeof d["key"] === "string") keys.push({ user: d["user"], key: d["key"] });
        break;
      case "package":
        if (typeof d["name"] === "string") packages.push(d["name"]);
        break;
    }
  }
  if (admin === undefined) problems.push("an install needs a requirement of the kind user: the administrator");
  const adminKeys = admin === undefined ? [] : keys.filter((k) => k.user === admin?.user).map((k) => k.key);
  if (admin !== undefined && adminKeys.length === 0) problems.push(`an install needs a key for the administrator ${admin.user} (a requirement of the kind ssh-authorized-key): password sign-in is off`);
  for (const name of ["timezone", "locale", "keyboard"]) if (!settings.has(name)) problems.push(`an install needs the system setting ${name}`);
  if (problems.length > 0 || admin === undefined) return err(problems);
  return {
    kind: "ok",
    value: {
      hostname: String(order.subject.name),
      fleet: o.fleet,
      admin: { user: admin.user, realname: admin.realname, sshKeys: adminKeys },
      locale: settings.get("locale") ?? "",
      keyboard: settings.get("keyboard") ?? "",
      timezone: settings.get("timezone") ?? "",
      ...(o.disk === undefined ? {} : { disk: o.disk }),
      ...(o.mac === undefined ? {} : { mac: o.mac }),
      ...(packages.length === 0 ? {} : { packages: [...packages].sort() }),
      repository: o.repository,
      allowedSigners: o.allowedSigners,
      base: o.base,
      ...(o.proxy === undefined ? {} : { proxy: o.proxy }),
    },
  } as const;
}

/** The dialect, as the port of Archon takes it. */
export function cloudInit(o: CloudInitOptions): Dialect {
  return {
    id: must(parseDialectId(DIALECT_ID)),
    tool: { name: "ubuntu-autoinstall", version: "1" },
    guarantees: { kinds: KINDS_CARRIED.map((k) => must(parseKindId(k))), subjects: ["machine"], plan: "none", idempotence: "unproven", destroy: true },
    render: async (order: Order, _plan: Plan): Promise<Result<Rendered, readonly string[]>> => {
      const spec = installSpecOf(order, o);
      if (spec.kind === "err") return err(spec.error);
      const header = "# GENERATED by archon; do not edit";
      return renderedOf(new Map([
        ["cloud-init/user-data", autoinstall(spec.value).replace("#cloud-config\n", `#cloud-config\n${header}\n`)],
        ["cloud-init/meta-data", `${header}\n${metaData(spec.value)}`],
      ]));
    },
    steps: (_plan: Plan, _rendered: Rendered): readonly DialectStep[] => [],
  };
}

/** Whether a requirement is one this dialect states. */
export function carries(r: Requirement): boolean {
  return (KINDS_CARRIED as readonly string[]).includes(String(r.kind));
}
