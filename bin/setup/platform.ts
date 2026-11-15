// The computer: Linux of a family the packaging table names, or a Mac with Apple silicon, on x86-64 or Arm (009-machine-bootstrap FR-012, FR-014, FR-017).
import { ok, type Result } from "../../commons/ts/kernel/result.ts";
import * as fs from "../../commons/ts/runtime/fs.ts";
import { firstLine } from "../../commons/ts/runtime/proc.ts";
import { cannot, type Stop } from "./stop.ts";
import { acting, type ActingFamily, family, type FamilyId, familyOf, familyOfUname, type PlatformName } from "./table.ts";

export type Arch = "x86_64" | "aarch64";
export type Platform = {
  readonly os: "linux" | "darwin";
  readonly arch: Arch;
  readonly family: ActingFamily;
  readonly id: string; // os-release ID, or macos
  readonly version: string;
  readonly codename: string;
  readonly pretty: string;
  readonly wsl: boolean;
  readonly tested: boolean;
  /** the name Rust gives the platform, which names rustup-init and uv's release */
  readonly rustTarget: string;
  /** the platform of commons' table, which names the pins */
  readonly name: PlatformName;
};

/** os-release's KEY=value lines (quotes dropped). */
export function osRelease(text: string): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m !== null && m[1] !== undefined && !(m[1] in out)) out[m[1]] = (m[2] ?? "").replace(/["']/g, "");
  }
  return out;
}

/** What to say of a computer whose family the table knows but this setup does not act on, or "". */
export function knownFamilyNote(id: FamilyId | null): string {
  if (id === null) return "";
  const f = family(id);
  return ` (${f.label}: it uses ${f.manager}, and this setup does not support it yet)`;
}

export async function detect(osReleaseFile: string, env: Readonly<Record<string, string>>): Promise<Result<Platform, Stop>> {
  const os = await firstLine(["uname", "-s"]);
  const m = await firstLine(["uname", "-m"]);
  if (os !== "Linux" && os !== "Darwin") {
    return cannot(
      `this is ${os}, and the setup is made for Linux (Debian-family or Arch-family) and for a Mac with Apple silicon.`,
      "use Linux under WSL 2 or in a virtual machine, or a Mac with Apple silicon",
    );
  }
  let arch: Arch;
  if (m === "x86_64" || m === "amd64") arch = "x86_64";
  else if (m === "aarch64" || m === "arm64") arch = "aarch64";
  else return cannot(`there are no programs for ${m} here.`, "use a computer or virtual machine with an amd64 or arm64 processor");
  if (os === "Darwin") {
    // a terminal run under Rosetta says x86_64 on Apple silicon: the hardware is what counts, and the programs fetched are for it
    if ((await firstLine(["sysctl", "-n", "hw.optional.arm64"])) === "1") arch = "aarch64";
    if (arch !== "aarch64") {
      return cannot(
        "this Mac has an Intel processor, and the setup is made for Macs with Apple silicon (M1 and later).",
        "run the setup in a Linux virtual machine on this Mac, or on a Mac with Apple silicon",
      );
    }
    const ver = (await firstLine(["sw_vers", "-productVersion"])) || "0";
    const major = Number(ver.split(".")[0]) || 0;
    if (major < 13) return cannot(`this is macOS ${ver}, and the setup needs macOS 13 (Ventura) or later.`, "update macOS in System Settings, then run it again");
    const fam = acting(familyOfUname("Darwin"));
    if (fam === null) return cannot("the packaging table names no family for a Mac.", "update this repository");
    return ok({
      os: "darwin",
      arch,
      family: fam,
      id: "macos",
      version: ver,
      codename: "",
      pretty: `macOS ${ver}`,
      wsl: false,
      tested: true,
      rustTarget: "aarch64-apple-darwin",
      name: "macos-arm64",
    });
  }
  let rel: Readonly<Record<string, string>> = {};
  try {
    rel = osRelease(await fs.readTextFile(osReleaseFile));
  } catch { /* none: Linux of no known family */ }
  const id = rel.ID || "unknown", like = rel.ID_LIKE ?? "", version = rel.VERSION_ID ?? "", pretty = rel.PRETTY_NAME || "Linux";
  // the family: what differs between distributions (the package manager and the names of its packages) is chosen from it, by the table commons generates
  const named = familyOf([id, ...like.split(/\s+/).filter((w) => w !== "")]);
  const fam = acting(named);
  if (fam === null || fam === "macos") {
    return cannot(
      `this is ${pretty}${
        knownFamilyNote(named)
      }, and the setup is made for the Debian family (Debian, Ubuntu), the Arch family (Arch Linux, Omarchy) and Macs with Apple silicon.`,
      "use Debian 12 or 13, or an Arch-based distribution (from the Microsoft Store under WSL 2, or in a virtual machine)",
    );
  }
  let procVersion = "";
  try {
    procVersion = await fs.readTextFile("/proc/version");
  } catch { /* not Linux's /proc */ }
  const wsl = /microsoft/i.test(procVersion) || (env.WSL_DISTRO_NAME ?? "") !== "";
  const tested = fam === "arch" || /^(debian:1[23](\..*)?|ubuntu:2[46]\.04.*)$/.test(`${id}:${version}`);
  return ok({
    os: "linux",
    arch,
    family: fam,
    id,
    version,
    codename: rel.VERSION_CODENAME ?? "",
    pretty,
    wsl,
    tested,
    rustTarget: `${arch}-unknown-linux-gnu`,
    name: arch === "x86_64" ? "linux-x64" : "linux-arm64",
  });
}

/** What kind of computer: WSL, a container, a virtual machine, or a machine (real hardware, or a Mac). */
export async function hostKind(env: Readonly<Record<string, string>>): Promise<string> {
  const read = async (f: string) => await fs.readTextFile(f).catch(() => "");
  if (/microsoft/i.test(await read("/proc/version")) || (env.WSL_DISTRO_NAME ?? "") !== "") return "wsl";
  const docker = await fs.exists("/.dockerenv").catch(() => false);
  if (docker || /docker|containerd|lxc|kubepods/.test(await read("/proc/1/cgroup"))) return "container";
  const virt = await firstLine(["systemd-detect-virt"]);
  if (virt !== "" && virt !== "none") return `vm-${virt}`;
  if (/\bhypervisor\b/.test(await read("/proc/cpuinfo"))) return "vm";
  if ((await firstLine(["sysctl", "-n", "kern.hv_vmm_present"])) === "1") return "vm";
  return "machine";
}
