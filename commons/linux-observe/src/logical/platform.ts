// Spec: 0004-linux-observe-platform FR-002, FR-003
/**
 * The platform of a machine read from the text of `/etc/os-release` and `uname -m`, and the platform a model declares parsed with every reason it is refused. Nothing here runs a program.
 *
 * @example
 * ```ts
 * import { platformOfOsRelease } from "./platform.ts";
 * platformOfOsRelease('ID=debian\nVERSION_ID="13"\n').kind; // "ok"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { ARCHITECTURES, FAMILIES, familyOf, type Architecture, type Declared, type Observed } from "@intellectual-frontiers/linux-observe/governance";

/** The `KEY=value` lines of an `os-release` as a table: a value may be in single or double quotes. */
export function osReleaseTable(text: string): ReadonlyMap<string, string> {
  const table = new Map<string, string>();
  for (const raw of text.split("\n")) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(raw.trim());
    if (m === null) continue;
    const v = (m[2] ?? "").trim();
    table.set(m[1] ?? "", /^(["']).*\1$/.test(v) ? v.slice(1, -1) : v);
  }
  return table;
}

/** The architecture `uname -m` says, where Archon knows it (`arm64` is `aarch64`, `amd64` is `x86_64`). */
export function architectureOf(unameM: string): Architecture | undefined {
  const m = unameM.trim();
  const same = m === "amd64" ? "x86_64" : m === "arm64" ? "aarch64" : m;
  return (ARCHITECTURES as readonly string[]).includes(same) ? (same as Architecture) : undefined;
}

/** The platform an `os-release` describes, or the reason it is not one Archon knows: an `ID` and an `ID_LIKE` of no known family are named, never guessed. */
export function platformOfOsRelease(text: string, unameM?: string): Result<Observed, string> {
  const t = osReleaseTable(text);
  const id = t.get("ID");
  if (id === undefined || id === "") return err("os-release has no ID");
  const family = familyOf(id, t.get("ID_LIKE") ?? "");
  if (family === undefined) return err(`${id} is of no family Archon knows (${FAMILIES.join(", ")}); its ID_LIKE is ${t.get("ID_LIKE") ?? "not said"}`);
  const arch = unameM === undefined ? undefined : architectureOf(unameM);
  return ok({ family, distro: id.toLowerCase(), release: t.get("VERSION_ID") ?? "", ...(arch === undefined ? {} : { arch }) });
}

/** A declared platform from what a model wrote, or every reason it is refused. */
export function parseDeclared(input: unknown): Result<Declared, readonly string[]> {
  const o = typeof input === "object" && input !== null && !Array.isArray(input) ? (input as Record<string, unknown>) : undefined;
  if (o === undefined) return err(["a platform is an object"]);
  const problems: string[] = [];
  if (!(FAMILIES as readonly unknown[]).includes(o["family"])) problems.push(`family is one of ${FAMILIES.join(", ")}`);
  if (typeof o["distro"] !== "string" || !/^[a-z][a-z0-9-]{1,40}$/.test(o["distro"])) problems.push("distro is the ID of its os-release (lowercase)");
  if (typeof o["release"] !== "string" || !/^[A-Za-z0-9.]{0,20}$/.test(o["release"])) problems.push("release is the VERSION_ID of its os-release (it may be empty on a rolling release)");
  if (!(ARCHITECTURES as readonly unknown[]).includes(o["arch"])) problems.push(`arch is one of ${ARCHITECTURES.join(", ")}`);
  if (problems.length > 0) return err(problems);
  const family = familyOf(String(o["distro"]), String(o["family"]));
  if (family !== undefined && family !== o["family"]) return err([`${String(o["distro"])} is of the family ${family}, not ${String(o["family"])}`]);
  return ok({ family: o["family"] as Declared["family"], distro: String(o["distro"]), release: String(o["release"]), arch: o["arch"] as Declared["arch"] });
}

/** What differs between the platform declared and the one observed, one sentence each: a machine that is not what its model says is said, not converged as though it were. */
export function platformDrift(declared: Declared, observed: Observed): readonly string[] {
  const out: string[] = [];
  if (declared.family !== observed.family) out.push(`the model says the family ${declared.family}; the machine is ${observed.family}`);
  if (declared.distro !== observed.distro) out.push(`the model says ${declared.distro}; the machine is ${observed.distro}`);
  if (declared.release !== "" && declared.release !== observed.release) out.push(`the model says release ${declared.release}; the machine is ${observed.release}`);
  if (observed.arch !== undefined && declared.arch !== observed.arch) out.push(`the model says ${declared.arch}; the machine is ${observed.arch}`);
  return out;
}
