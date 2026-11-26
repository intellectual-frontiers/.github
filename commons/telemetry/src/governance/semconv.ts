// Spec: 0003-telemetry-reach FR-016
/**
 * The semantic conventions telemetry uses, as one table of data with the exact version they were read from (0003-telemetry-reach FR-016), and the names of ours under the namespace `if.` marked `ours`
 * (FR-017). A signal or an attribute whose name is not an entry is a finding (`unknownNames`), never a string typed at the place of use.
 *
 * @remarks
 * Many of these conventions are `development` upstream and change between versions. A declaration that uses one says so (`uses: "development"`), and a change of `SEMCONV_VERSION` is one commit that lists the
 * renames in `SEMCONV_RENAMES`.
 *
 * @module
 */

/** The version of the OpenTelemetry semantic conventions the table was written against. */
export const SEMCONV_VERSION = "1.38.0";

/** What a name is: a resource attribute, an attribute of a data point or a record, or a metric. */
export type SemconvKind = "attribute" | "metric" | "resource";

/** How settled the convention is upstream. Ours are `stable` by our own rule. */
export type Stability = "stable" | "development" | "deprecated";

/** The instrument that makes a metric. */
export type Instrument = "gauge" | "counter" | "updown" | "histogram";

/** One entry: the name, its kind, its type (an attribute) or its instrument (a metric), its unit, its stability, whether it is ours and a note. */
export type SemconvEntry = {
  readonly name: string;
  readonly kind: SemconvKind;
  readonly type: "string" | "int" | "double" | "boolean" | "number";
  readonly unit: string;
  readonly instrument?: Instrument;
  readonly stability: Stability;
  readonly ours: boolean;
  readonly note: string;
};

const resource = (name: string, note: string, type: SemconvEntry["type"] = "string"): SemconvEntry => ({
  name,
  kind: "resource",
  type,
  unit: "",
  stability: "development",
  ours: false,
  note,
});
const attribute = (name: string, note: string, stability: Stability = "development"): SemconvEntry => ({
  name,
  kind: "attribute",
  type: "string",
  unit: "",
  stability,
  ours: false,
  note,
});
const metric = (name: string, unit: string, instrument: Instrument, note: string, ours = false): SemconvEntry => ({
  name,
  kind: "metric",
  type: "number",
  unit,
  instrument,
  stability: ours ? "stable" : "development",
  ours,
  note,
});
const mine = (name: string, kind: SemconvKind, type: SemconvEntry["type"], note: string): SemconvEntry => ({
  name,
  kind,
  type,
  unit: "",
  stability: "stable",
  ours: true,
  note,
});

/** The table. An entry is added with its note and with the version above, in one commit. */
export const SEMCONV: readonly SemconvEntry[] = [
  resource("host.id", "A unique host id: the machine id on Linux."),
  resource("host.name", "The name of the host."),
  resource("host.arch", "The processor architecture."),
  resource("host.mac", "The MAC addresses of the host, lower case with colons.", "string"),
  resource("host.ip", "The IP addresses of the host."),
  resource("os.type", "The operating system family: linux, darwin or windows."),
  resource("os.version", "The version of the operating system."),
  resource("service.name", "The logical name of the producer."),
  attribute("system.memory.state", "The state of memory a data point is of: used, free, cached or buffers."),
  attribute("system.filesystem.mountpoint", "Where a file system is mounted."),
  attribute("system.filesystem.state", "used or free."),
  metric("system.uptime", "s", "gauge", "Seconds since the machine started."),
  metric("if.host.load.1m", "{thread}", "gauge", "The load average of the last minute (upstream has no load average metric).", true),
  metric("if.host.load.5m", "{thread}", "gauge", "The load average of the last five minutes.", true),
  metric("if.host.load.15m", "{thread}", "gauge", "The load average of the last fifteen minutes.", true),
  metric("system.memory.usage", "By", "updown", "Bytes of memory by state."),
  metric("system.memory.utilization", "1", "gauge", "Fraction of memory in use, 0 to 1."),
  attribute("cpu.mode", "The mode a processor core spent time in: user, system, idle, iowait, nice, interrupt or steal (well-known values upstream), and softirq (a custom value upstream allows)."),
  attribute("cpu.logical_number", "The number of a logical processor core."),
  attribute("network.interface.name", "The name of a network interface."),
  attribute("network.io.direction", "transmit or receive."),
  metric("system.cpu.time", "s", "counter", "Seconds each core spent in each mode, cumulative."),
  metric("system.network.io", "By", "counter", "Bytes through an interface by direction, cumulative."),
  metric("system.filesystem.utilization", "1", "gauge", "Fraction of a file system in use, 0 to 1."),
  mine("if.asset.id", "resource", "string", "The id of the asset a batch is of; set by the receiver from what it authenticated, never by the sender."),
  mine("if.level", "resource", "int", "The capability level of the asset, 0 to 3."),
  mine("if.relay.id", "resource", "string", "The id of the site relay that carried a batch."),
  metric("if.host.updates.pending", "{package}", "gauge", "Packages with an update waiting.", true),
  metric("if.host.drift.requirements", "{requirement}", "gauge", "Requirements of the desired OS state of the host that osQuery says differ from it, in all or by kind.", true),
  mine("if.drift.kind", "attribute", "string", "The kind of requirement a drift count is of: package, user, group, service, file, directory, sysctl or system-setting."),
  metric("if.telemetry.queue.length", "{segment}", "gauge", "Segments waiting in the queue.", true),
  metric("if.telemetry.queue.age", "s", "gauge", "Age of the oldest segment in the queue.", true),
  metric("if.telemetry.dropped", "{segment}", "counter", "Segments the queue dropped, by the kind of signal.", true),
  mine("if.telemetry.signal", "attribute", "string", "The kind of signal a drop count is of: traces, logs or metrics."),
  mine("if.probe.table", "attribute", "string", "The osQuery table a gap record is about."),
  mine("if.probe.gap", "attribute", "string", "A log record: a table the platform lacks or whose query failed. It carries no value."),
];

/** The renames from one version of the conventions to the next, by old name: the receiver maps a name a device sent with an older version. */
export const SEMCONV_RENAMES: Readonly<Record<string, string>> = {};

const BY_NAME: ReadonlyMap<string, SemconvEntry> = new Map(SEMCONV.map((e) => [e.name, e]));

/** The entry of a name, or `undefined`. */
export function semconvEntry(name: string): SemconvEntry | undefined {
  return BY_NAME.get(name);
}

/** The names that are not entries of the table, each a finding; the order is that of the input and a name is told once. */
export function unknownNames(names: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    if (BY_NAME.has(n) || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/** The names of the table that are still `development` upstream and not ours: a declaration that names one says `uses: "development"` (FR-017). */
export function developmentNames(): readonly string[] {
  return SEMCONV.filter((e) => e.stability === "development" && !e.ours).map((e) => e.name);
}

/** The name a receiver reads a device's name as, by the table of renames. */
export function renamed(name: string): string {
  return Object.hasOwn(SEMCONV_RENAMES, name) ? (SEMCONV_RENAMES[name] ?? name) : name;
}
