// Spec: 0003-machine-probe-observation FR-001, FR-002, FR-003
// Spec: 0008-machine-probe-agent-workspace FR-001
/**
 * The facts a probe gives, as a typed observation: the sections and `key=value` lines of its output read into a record of the operating system, the hardware, the security settings, the software and the ports that listen, with what the probe could
 * not tell said as `unknown`; and the keyed records of that observation that an estate compares with what is declared, which hold nothing that changes only because the time does.
 *
 * @example
 * ```ts
 * import { parseProbe, toObserved } from "./observed.ts";
 * const o = toObserved(parseProbe("@probe\nversion=1\nat=2026-12-01T00:00:00Z\n@os\nfamily=ubuntu\nversion=24.04\n"));
 * o.kind; // "ok"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Json } from "@intellectual-frontiers/grc/governance";

/** A probe's output: sections, each a map of key to value. */
export type ProbeOutput = Readonly<Record<string, Readonly<Record<string, string>>>>;

/** The probe's output read: `@section` lines start a section and `key=value` lines fill it; a blank line is skipped, and a line before any section belongs to none and is skipped. */
export function parseProbe(text: string): ProbeOutput {
  const out: Record<string, Record<string, string>> = {};
  let section: Record<string, string> | undefined;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.startsWith("@")) {
      const name = line.slice(1).trim();
      section = out[name] ?? (out[name] = {});
      continue;
    }
    const eq = line.indexOf("=");
    if (section === undefined || eq <= 0) continue;
    section[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

/** What the probe found on a machine. */
export type Observed = {
  /** When (an instant, ISO 8601) and with which version of the probe. */
  readonly at: string;
  readonly probe: string;
  readonly os: { readonly family: string; readonly name: string; readonly version: string; readonly kernel: string; readonly arch: string; readonly hostname: string; readonly model?: string; readonly serial?: string; readonly flavor?: string; readonly wsl?: boolean };
  readonly hardware: { readonly cpus?: number; readonly memoryMB?: number; readonly diskTotalGB?: number; readonly diskUsedPct?: number };
  /** Security settings: `on`, `off`, `manual` or `unknown`. */
  readonly security: { readonly diskEncryption: string; readonly firewall: string; readonly autoUpdates: string; readonly sshPasswordAuth?: string; readonly antivirus?: string; readonly admins: readonly string[] };
  readonly software: { readonly manager?: string; readonly packages?: number; readonly brewPackages?: number; readonly pendingUpdates?: number; readonly osquery?: string };
  /** The TCP ports that listen, in order. */
  readonly listening: readonly number[];
  /** What the probe found of a machine on which a coding harness works, where it gave the section `@agent` (0008-machine-probe-agent-workspace FR-001). */
  readonly agent?: AgentFacts;
};

/** The facts of the section `@agent`: the version of the coordinator, the persona, the harnesses found, the digest of the typed agents policy that the coordinator recorded, the mode of the token file, the names (never the values) of the variables that look like secrets, the user, and what isolates the machine. */
export type AgentFacts = {
  readonly coordinator?: string;
  readonly persona?: string;
  readonly harnesses: readonly string[];
  readonly policyDigest?: string;
  readonly tokenFileMode?: string;
  readonly ambientSecretNames: readonly string[];
  readonly uid?: number;
  readonly virt?: string;
  readonly isolation?: string;
};

const words = (v: string | undefined): readonly string[] => (v ?? "").split(/\s+/).filter(Boolean);

const num = (v: string | undefined): number | undefined => {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isFinite(n) ? n : undefined;
};

/** The probe's output as an observation, or why not: a probe that gives no time is refused, because an observation with no time is no evidence. */
export function toObserved(p: ProbeOutput): Result<Observed, string> {
  const at = p["probe"]?.["at"];
  if (at === undefined || Number.isNaN(Date.parse(at))) return err("the probe gave no time, and an observation with no time is not evidence");
  const os = p["os"] ?? {};
  const sec = p["security"] ?? {};
  const sw = p["software"] ?? {};
  const hw = p["hardware"] ?? {};
  const some = <K extends string, V>(key: K, value: V | undefined): { readonly [P in K]?: V } => (value === undefined ? {} : ({ [key]: value } as { readonly [P in K]: V }));
  return ok({
    at,
    probe: p["probe"]?.["version"] ?? "?",
    os: {
      family: os["family"] || "unknown",
      name: os["name"] || os["family"] || "unknown",
      version: os["version"] || "",
      kernel: os["kernel"] || "",
      arch: os["arch"] || "",
      hostname: os["hostname"] || "",
      ...some("model", os["model"] || undefined),
      ...some("serial", os["serial"] || undefined),
      ...some("flavor", os["flavor"] || undefined),
      ...some("wsl", os["wsl"] ? true : undefined),
    },
    hardware: { ...some("cpus", num(hw["cpus"])), ...some("memoryMB", num(hw["memory_mb"])), ...some("diskTotalGB", num(hw["disk_total_gb"])), ...some("diskUsedPct", num(hw["disk_used_pct"])) },
    security: {
      diskEncryption: sec["disk_encryption"] || "unknown",
      firewall: sec["firewall"] || "unknown",
      autoUpdates: sec["auto_updates"] || "unknown",
      ...some("sshPasswordAuth", sec["ssh_password_auth"] || undefined),
      ...some("antivirus", sec["antivirus"] || undefined),
      admins: (sec["admins"] ?? "").split(/\s+/).filter(Boolean).sort(),
    },
    software: { ...some("manager", sw["manager"] || undefined), ...some("packages", num(sw["packages"])), ...some("brewPackages", num(sw["brew_packages"])), ...some("pendingUpdates", num(sw["pending_updates"])), ...some("osquery", sw["osquery"] || undefined) },
    listening: (p["listening"]?.["ports"] ?? "").split(/\s+/).map(Number).filter((n) => n > 0).sort((a, b) => a - b),
    ...(p["agent"] === undefined ? {} : { agent: agentFacts(p["agent"]) }),
  });
}

function agentFacts(a: Readonly<Record<string, string>>): AgentFacts {
  const some = <K extends string, V>(key: K, value: V | undefined): { readonly [P in K]?: V } => (value === undefined ? {} : ({ [key]: value } as { readonly [P in K]: V }));
  return {
    harnesses: [...words(a["harnesses"])].sort(),
    ambientSecretNames: [...words(a["ambient-secret-names"])].sort(),
    ...some("coordinator", a["coordinator"] || undefined),
    ...some("persona", a["persona"] || undefined),
    ...some("policyDigest", a["policy-digest"] || undefined),
    ...some("tokenFileMode", a["token-file-mode"] || undefined),
    ...some("uid", num(a["uid"])),
    ...some("virt", a["virt"] || undefined),
    ...some("isolation", a["isolation"] || undefined),
  };
}

/**
 * The keyed records of an observation that an estate compares with what is declared: the system, the security settings, the software and the ports. The time of the observation, the version of the probe and the counters that change
 * on their own (the memory, the disk in use, the updates waiting) are left out, so that two observations of a machine that did not change are the same.
 */
export function observedState(o: Observed): Readonly<Record<string, Json>> {
  const { cpus, diskTotalGB } = o.hardware;
  return {
    "os": { family: o.os.family, version: o.os.version, arch: o.os.arch, hostname: o.os.hostname },
    "hardware": { ...(cpus === undefined ? {} : { cpus }), ...(diskTotalGB === undefined ? {} : { diskTotalGB }) },
    "security": { ...o.security, admins: [...o.security.admins] },
    "software": { ...(o.software.manager === undefined ? {} : { manager: o.software.manager }), ...(o.software.osquery === undefined ? {} : { osquery: o.software.osquery }) },
    "listening": [...o.listening],
    ...(o.agent === undefined
      ? {}
      : {
          "agent": {
            harnesses: [...o.agent.harnesses],
            "ambient-secret-names": [...o.agent.ambientSecretNames],
            ...(o.agent.coordinator === undefined ? {} : { coordinator: o.agent.coordinator }),
            ...(o.agent.persona === undefined ? {} : { persona: o.agent.persona }),
            ...(o.agent.policyDigest === undefined ? {} : { "policy-digest": o.agent.policyDigest }),
            ...(o.agent.tokenFileMode === undefined ? {} : { "token-file-mode": o.agent.tokenFileMode }),
            ...(o.agent.uid === undefined ? {} : { uid: o.agent.uid }),
            ...(o.agent.isolation === undefined ? {} : { isolation: o.agent.isolation }),
          },
        }),
  };
}
