// Spec: 0003-netboot-logical FR-003
/**
 * The blank-disk guard's decision. Before Ubuntu's installer touches a disk it reports what the machine is (its firmware tables, `/proc` and its disks) as key=value lines, and the server answers `ok` or `stop: why`. The install goes on by itself only where every disk is blank,
 * where a person confirmed that the disks may be erased, or where the machine is this host already (it installed as this host from this MAC). Anything else stops before a byte is written. With no answer there is no install: the script fails closed.
 *
 * @example
 * ```ts
 * import { parseFacts, decide } from "./guard.ts";
 * decide("athens", parseFacts("disk=sda 100 sata\n"), {}, undefined, undefined).go; // true
 * ```
 *
 * @module
 */

/** What a machine says about itself. */
export type MachineFacts = {
  vendor?: string;
  model?: string;
  serial?: string;
  memKiB?: number;
  cpus?: number;
  /** Name, size in bytes and how attached. */
  disks: Array<{ name: string; bytes: number; transport?: string }>;
  /** Partition tables and file systems found: `/dev/sda gpt`, `/dev/sda2 ext4`. */
  signatures: string[];
};

const FILLER = /^(to be filled by o\.e\.m\.|default string|system (product name|manufacturer|serial number)|not specified|none|0+|)$/i;

/** The script's key=value lines as facts. Unknown keys are ignored and firmware filler is dropped. */
export function parseFacts(text: string): MachineFacts {
  const f: MachineFacts = { disks: [], signatures: [] };
  const clean = (v: string): string | undefined => (FILLER.test(v.trim()) ? undefined : v.trim());
  for (const line of text.split("\n")) {
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (k === "sys_vendor") {
      const c = clean(v);
      if (c !== undefined) f.vendor = c;
    } else if (k === "board_vendor") {
      const c = clean(v);
      if (f.vendor === undefined && c !== undefined) f.vendor = c;
    } else if (k === "product_name") {
      const c = clean(v);
      if (c !== undefined) f.model = c;
    } else if (k === "board_name") {
      const c = clean(v);
      if (f.model === undefined && c !== undefined) f.model = c;
    } else if (k === "product_serial") {
      const c = clean(v);
      if (c !== undefined) f.serial = c;
    } else if (k === "mem_kib" && /^\d+$/.test(v)) f.memKiB = Number(v);
    else if (k === "cpus" && /^\d+$/.test(v)) f.cpus = Number(v);
    else if (k === "disk") {
      const [name, bytes, transport] = v.split(/\s+/);
      if (name !== undefined && name !== "" && /^\d+$/.test(bytes ?? "")) f.disks.push({ name, bytes: Number(bytes), ...(transport === undefined || transport === "" ? {} : { transport }) });
    } else if (k === "signature" && v !== "") f.signatures.push(v.replace(/\s+/g, " "));
  }
  return f;
}

const gb = (bytes: number): string => (bytes >= 1e12 ? `${(bytes / 1e12).toFixed(1)} TB` : `${Math.round(bytes / 1e9)} GB`);

/** One line, as the machine describes itself. */
export function describeFacts(f: MachineFacts): string {
  const who = [f.vendor, f.model].filter(Boolean).join(" ") || "a machine that does not name itself";
  const ram = f.memKiB === undefined ? "RAM unknown" : `${(f.memKiB / 1048576).toFixed(1)} GiB RAM`;
  const disks = f.disks.map((d) => `${d.name} ${gb(d.bytes)}${d.transport === undefined ? "" : ` ${d.transport}`}`).join(", ") || "no disks";
  return `${who}${f.serial === undefined ? "" : `, serial ${f.serial}`}, ${f.cpus ?? "?"} CPUs, ${ram}, ${disks}`;
}

/** The guard's answer: go (and why), or stop (why, and what lets it go on). */
export type GuardDecision = { readonly go: true; readonly why: string } | { readonly go: false; readonly why: string; readonly fix: string };

/** What the decision knows besides the facts. */
export type GuardContext = {
  /** A person confirmed that the disks may be erased. */
  readonly confirmDestroy?: boolean;
  /** The MAC the host installed from before, if it has. */
  readonly installedMac?: string;
};

/** Whether this install may go on. */
export function decide(host: string, f: MachineFacts, ctx: GuardContext, bootMac: string | undefined): GuardDecision {
  if (f.disks.length === 0) return { go: false, why: "the installer sees no disk to install to", fix: "check the machine's disks and its storage controller setting (AHCI, not RAID) in its firmware" };
  if (f.signatures.length === 0) return { go: true, why: "every disk is blank" };
  if (ctx.confirmDestroy === true) return { go: true, why: `erasing as confirmed (arm ${host} with confirm-destroy)` };
  if (bootMac !== undefined && ctx.installedMac !== undefined && ctx.installedMac.toLowerCase() === bootMac.toLowerCase()) return { go: true, why: `this machine installed as ${host} before (${bootMac}): reinstalling it` };
  return {
    go: false,
    why: `its disks are not blank (${f.signatures.join("; ")}), so the install stopped before writing anything`,
    fix: `if this is the machine you mean and its disks may be erased: arm ${host} again with confirm-destroy, then network-boot it again`,
  };
}

/** The answer the script reads: `ok` and the reason, or `stop: why` and the fix. */
export function answerOf(d: GuardDecision): string {
  return d.go ? `ok: ${d.why}` : `stop: ${d.why}. ${d.fix}`;
}

/** The script the installer runs (as `early-commands`) before it touches a disk, served as `guard.sh` under the install's URL: it reports the machine's facts and does what the server answers; with no answer, nothing is erased. */
export const GUARD_SCRIPT = `#!/bin/sh
# archon: before any disk is touched, report this machine's facts to the boot server and do what it answers. Nothing here writes a disk.
B="$1"
F=/tmp/archon-facts
{
  for k in sys_vendor product_name product_serial board_vendor board_name; do
    echo "$k=$(cat /sys/class/dmi/id/$k 2>/dev/null)"
  done
  echo "mem_kib=$(awk '/^MemTotal:/ { print $2 }' /proc/meminfo)"
  echo "cpus=$(nproc 2>/dev/null)"
  lsblk -dnbro NAME,SIZE,TYPE,TRAN -e 1,7,11 2>/dev/null |
    awk '$3 == "disk" && $1 !~ /^zram/ { print "disk=" $1 " " $2 " " $4 }'
  for d in $(lsblk -dnro NAME,TYPE -e 1,7,11 2>/dev/null | awk '$2 == "disk" && $1 !~ /^zram/ { print "/dev/" $1 }'); do
    command -v wipefs >/dev/null || { echo "signature=$d unchecked (no wipefs)"; continue; }
    for x in $d $(lsblk -nrpo NAME,TYPE "$d" 2>/dev/null | awk '$2 == "part" { print $1 }'); do
      [ "$x" = "$d" ] || echo "signature=$x partition"
      wipefs -n --noheadings -O DEVICE,TYPE "$x" 2>/dev/null | awk 'NF > 1 { print "signature=" $1 " " $2 }' ||
        echo "signature=$x unchecked"
    done
  done
} >"$F"
A=$(curl -fsS --noproxy "*" -m 30 -X POST -H 'content-type: text/plain' --data-binary @"$F" "\${B}facts") ||
  A="stop: the boot server did not answer, so nothing was erased"
case "$A" in
  ok*) exit 0 ;;
esac
echo "archon: $A" | tee /dev/console
echo "archon: nothing was written to any disk; this machine powers off in 30 seconds." | tee /dev/console
sleep 30
poweroff -f
`;
