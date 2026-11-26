// Spec: 0009-machine-probe-signals FR-004
/**
 * The mapper from an observation and osQuery rows to signals (0009-machine-probe-signals FR-004 to FR-010): a pure, total function that reads no clock, no environment and no file, gives the same list for the
 * same input, names every signal and attribute by an entry of the table `SEMCONV` of telemetry, gives no value (and a log record `if.probe.gap`) for a table the platform lacks or whose query failed, and keeps no state:
 * a counter is as the system gives it, cumulative.
 *
 * @example
 * ```ts
 * import { signalsOf } from "./signals.ts";
 * // signalsOf(observed, undefined, { platform: "debian" }).signals.map((s) => s.name)
 * ```
 *
 * @module
 */
import type { Observed } from "./observed.ts";

/** One row of an osQuery answer: every value is text. */
export type RowText = Readonly<Record<string, string>>;

/** The rows by table. A table that was not asked, or whose query failed, is not a key. */
export type Rows = ReadonlyMap<string, readonly RowText[]>;

/** The platforms of the pack of desired-os-state. */
export type SignalPlatform = "debian" | "redhat" | "suse" | "alpine" | "macos" | "windows";

/** The instrument of a signal. */
export type SignalKind = "gauge" | "counter" | "updown";

/** A signal declared: the name, the instrument, the unit, the attributes and a value at an instant. */
export type DeclaredSignal = {
  readonly name: string;
  readonly kind: SignalKind;
  readonly unit: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly value: number;
  readonly at: string;
};

/** A table that gave no value, and why. */
export type Gap = { readonly table: string; readonly why: "unsupported" | "absent" | "unreadable" };

/** The drift of the host against its desired OS state, as counts: in all and by kind of requirement (the summary of desired-os-state, which this library does not import). */
export type DriftCounts = { readonly count: number; readonly byKind: Readonly<Record<string, number>> };

/** What the mapper gave: the resource, the signals, the gaps (each becomes a log record `if.probe.gap`) and the count of values refused for not being numbers. */
export type Mapped = {
  readonly resource: Readonly<Record<string, string>>;
  readonly signals: readonly DeclaredSignal[];
  readonly gaps: readonly Gap[];
  readonly refused: number;
};

/** The platforms whose table is proved by a capture: osQuery on Linux. No signal is claimed for another platform until one is (FR-010). */
const LINUX: readonly SignalPlatform[] = ["debian", "redhat", "suse", "alpine"];

/** The tables of level 3, each with the platforms it is claimed for. */
export const SIGNAL_TABLES: readonly { readonly table: string; readonly platforms: readonly SignalPlatform[] }[] = [
  { table: "uptime", platforms: LINUX },
  { table: "load_average", platforms: LINUX },
  { table: "memory_info", platforms: LINUX },
  { table: "cpu_time", platforms: LINUX },
  { table: "interface_details", platforms: LINUX },
];

/** The tables of level 3 that are claimed for a platform: what a device asks of osQuery on it, and no more (a table is never asked of a platform it is not proved for). */
export function tablesFor(platform: SignalPlatform): readonly string[] {
  return SIGNAL_TABLES.filter((t) => t.platforms.includes(platform)).map((t) => t.table);
}

/** The platform of the pack of an operating system family the probe names (`family` and `name` of `@os`), or `undefined` where the family is none of those the pack knows. */
export function platformOfFamily(family: string): SignalPlatform | undefined {
  const f = family.toLowerCase();
  if (f === "windows") return "windows";
  if (f === "macos" || f === "darwin") return "macos";
  if (f.startsWith("debian") || f.startsWith("ubuntu") || f.startsWith("raspbian")) return "debian";
  if (/^(rhel|fedora|centos|rocky|almalinux|ol|amzn)/u.test(f)) return "redhat";
  if (/^(opensuse|sles|suse)/u.test(f)) return "suse";
  if (f.startsWith("alpine")) return "alpine";
  return undefined;
}

/** The ticks per second that osQuery's `cpu_time` counts in on Linux (USER_HZ). */
const TICKS_PER_SECOND = 100;

const osType = (family: string): string => (family === "windows" ? "windows" : family === "macos" || family === "darwin" ? "darwin" : "linux");

/** The signals of an observation (level 2) and, given rows, of osQuery (level 3). `hostId` is the machine id where the caller has it. */
export function signalsOf(observed: Observed, rows: Rows | undefined, options: { readonly platform: SignalPlatform; readonly hostId?: string; readonly drift?: DriftCounts }): Mapped {
  const at = observed.at;
  const signals: DeclaredSignal[] = [];
  const gaps: Gap[] = [];
  let refused = 0;
  const push = (name: string, kind: SignalKind, unit: string, value: number | undefined, attributes: Readonly<Record<string, string>> = {}): void => {
    if (value === undefined || !Number.isFinite(value)) {
      refused += 1;
      return;
    }
    signals.push({ name, kind, unit, attributes, value, at });
  };
  const num = (v: string | undefined): number | undefined => {
    if (v === undefined || v.trim() === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const resource: Record<string, string> = {
    "host.name": observed.os.hostname,
    "host.arch": observed.os.arch,
    "os.type": osType(observed.os.family),
    "os.version": observed.os.version,
  };
  if (options.hostId !== undefined) resource["host.id"] = options.hostId;

  if (observed.hardware.diskUsedPct !== undefined) push("system.filesystem.utilization", "gauge", "1", observed.hardware.diskUsedPct / 100);
  if (observed.software.pendingUpdates !== undefined) push("if.host.updates.pending", "gauge", "{package}", observed.software.pendingUpdates);

  if (options.drift !== undefined) {
    push("if.host.drift.requirements", "gauge", "{requirement}", options.drift.count);
    for (const kind of Object.keys(options.drift.byKind).sort()) push("if.host.drift.requirements", "gauge", "{requirement}", options.drift.byKind[kind], { "if.drift.kind": kind });
  }

  if (rows !== undefined) {
    for (const t of SIGNAL_TABLES) {
      if (!t.platforms.includes(options.platform)) {
        gaps.push({ table: t.table, why: "unsupported" });
        continue;
      }
      const r = rows.get(t.table);
      if (r === undefined) {
        gaps.push({ table: t.table, why: "absent" });
        continue;
      }
      switch (t.table) {
        case "uptime":
          push("system.uptime", "gauge", "s", num(r[0]?.["total_seconds"]));
          break;
        case "load_average":
          for (const [period, name] of [["1m", "system.cpu.load_average.1m"], ["5m", "system.cpu.load_average.5m"], ["15m", "system.cpu.load_average.15m"]] as const) {
            const row = r.find((x) => x["period"] === period);
            if (row !== undefined) push(name, "gauge", "{thread}", num(row["average"]));
          }
          break;
        case "memory_info": {
          const m = r[0];
          const total = num(m?.["memory_total"]);
          const free = num(m?.["memory_available"] ?? m?.["memory_free"]);
          if (total === undefined || free === undefined || total <= 0) {
            gaps.push({ table: t.table, why: "unreadable" });
            break;
          }
          push("system.memory.usage", "updown", "By", total - free, { "system.memory.state": "used" });
          push("system.memory.usage", "updown", "By", free, { "system.memory.state": "free" });
          push("system.memory.utilization", "gauge", "1", (total - free) / total);
          break;
        }
        case "cpu_time":
          for (const row of r) {
            for (const [column, mode] of [["user", "user"], ["nice", "nice"], ["system", "system"], ["idle", "idle"], ["iowait", "iowait"], ["irq", "irq"], ["softirq", "softirq"], ["steal", "steal"]] as const) {
              const ticks = num(row[column]);
              if (ticks !== undefined) push("system.cpu.time", "counter", "s", ticks / TICKS_PER_SECOND, { "cpu.logical_number": row["core"] ?? "", "cpu.mode": mode });
            }
          }
          break;
        case "interface_details":
          for (const row of r) {
            const name = row["interface"] ?? "";
            if (name === "") continue;
            push("system.network.io", "counter", "By", num(row["ibytes"]), { "network.interface.name": name, "network.io.direction": "receive" });
            push("system.network.io", "counter", "By", num(row["obytes"]), { "network.interface.name": name, "network.io.direction": "transmit" });
          }
          break;
        default:
          break;
      }
    }
  }
  return { resource, signals, gaps, refused };
}
