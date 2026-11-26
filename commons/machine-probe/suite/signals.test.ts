/**
 * Tests of the mapper from an observation and osQuery rows to signals (commons 0009-machine-probe-signals FR-004 to FR-010): the facts alone give the level-2 signals, the rows give the level-3 signals, a table the
 * platform lacks gives a gap and no zero, a value that is not a number is refused and counted, every name is an entry of the table of conventions, and the same input gives the same list.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { parseProbe, toObserved, type Observed } from "../src/logical/observed.ts";
import { platformOfFamily, signalsOf, tablesFor, type Rows } from "../src/logical/signals.ts";
import { namesOutsideTable, toGapLogBatch, toMetricBatch } from "../src/logical/signals-otlp.ts";

const S = (n: string): string => `0009-machine-probe-signals ${n}`;

const PROBE = [
  "@probe",
  "version=1",
  "at=2026-11-26T10:00:00Z",
  "@os",
  "family=debian",
  "name=Debian GNU/Linux",
  "version=13",
  "kernel=6.12.0",
  "arch=x86_64",
  "hostname=synthetic-host-01",
  "@hardware",
  "cpus=4",
  "memory_mb=8192",
  "disk_total_gb=100",
  "disk_used_pct=42",
  "@software",
  "manager=apt",
  "pending_updates=7",
].join("\n");

function observed(): Observed {
  const o = toObserved(parseProbe(PROBE));
  if (o.kind === "err") throw new Error(o.error);
  return o.value;
}

const ROWS: Rows = new Map([
  ["uptime", [{ total_seconds: "3600" }]],
  ["load_average", [{ period: "1m", average: "0.5" }, { period: "5m", average: "0.25" }, { period: "15m", average: "0.1" }]],
  ["memory_info", [{ memory_total: "8000", memory_free: "1000", memory_available: "2000" }]],
  ["cpu_time", [{ core: "0", user: "500", nice: "0", system: "100", idle: "9000", iowait: "0", irq: "0", softirq: "0", steal: "0" }]],
  ["interface_details", [{ interface: "eth0", ibytes: "10", obytes: "20" }]],
]);

proves([S("FR-006")], "from the facts alone the mapper gives the resource, the disk in use and the updates waiting", () => {
  const m = signalsOf(observed(), undefined, { platform: "debian", hostId: "0123456789abcdef0123456789abcdef" });
  assertEquals(m.resource, { "host.name": "synthetic-host-01", "host.arch": "x86_64", "os.type": "linux", "os.version": "13", "host.id": "0123456789abcdef0123456789abcdef" });
  assertEquals(m.signals.map((s) => [s.name, s.value]), [["system.filesystem.utilization", 0.42], ["if.host.updates.pending", 7]]);
  assertEquals(m.gaps, []);
});

proves([S("FR-006")], "with the rows it gives uptime, load, memory, processor time and network bytes, each from the table that names it", () => {
  const m = signalsOf(observed(), ROWS, { platform: "debian" });
  const by = (name: string): number[] => m.signals.filter((s) => s.name === name).map((s) => s.value);
  assertEquals(by("system.uptime"), [3600]);
  assertEquals(by("system.cpu.load_average.1m"), [0.5]);
  assertEquals(by("system.cpu.load_average.15m"), [0.1]);
  assertEquals(by("system.memory.usage"), [6000, 2000]);
  assertEquals(by("system.memory.utilization"), [0.75]);
  assertEquals(by("system.cpu.time").slice(0, 3), [5, 0, 1]);
  assertEquals(by("system.network.io"), [10, 20]);
  assertEquals(m.gaps, []);
  assertEquals(m.refused, 0);
});

proves([S("FR-007")], "a table that is absent or not claimed for the platform gives a gap and no zero; a value that is not a number is refused and counted", () => {
  const partial: Rows = new Map([["uptime", [{ total_seconds: "not a number" }]]]);
  const m = signalsOf(observed(), partial, { platform: "debian" });
  assertEquals(m.signals.some((s) => s.name === "system.uptime"), false);
  assertEquals(m.refused, 1);
  assertEquals(m.gaps.map((g) => `${g.table}:${g.why}`), ["load_average:absent", "memory_info:absent", "cpu_time:absent", "interface_details:absent"]);
  const win = signalsOf(observed(), ROWS, { platform: "windows" });
  assertEquals(win.signals.some((s) => s.name === "system.uptime"), false);
  assert(win.gaps.every((g) => g.why === "unsupported"));
  assertEquals(win.gaps.length, 5);
});

proves([S("FR-004"), S("FR-008")], "the same input gives the same list and a counter is as the system gives it", () => {
  const a = signalsOf(observed(), ROWS, { platform: "debian" });
  const b = signalsOf(observed(), ROWS, { platform: "debian" });
  assertEquals(a, b);
  assertEquals(a.signals.find((s) => s.name === "system.network.io")?.kind, "counter");
});

proves([S("FR-005")], "every name of a signal and an attribute is an entry of the table of conventions", () => {
  const m = signalsOf(observed(), ROWS, { platform: "debian", hostId: "0123456789abcdef0123456789abcdef" });
  assertEquals(namesOutsideTable(m), []);
  const gap = signalsOf(observed(), new Map(), { platform: "debian" });
  assertEquals(namesOutsideTable(gap), []);
});

proves([S("FR-005"), S("FR-008")], "the metrics become one batch with the resource of the exporter beside the mapper's, and a gap becomes a log record naming the table", () => {
  const m = signalsOf(observed(), new Map(), { platform: "debian" });
  const metrics = toMetricBatch(m, { "if.asset.id": "device-01", "if.level": "3" });
  assertEquals(metrics.resource.attributes["if.asset.id"], "device-01");
  assertEquals(metrics.metrics.map((x) => x.name), ["system.filesystem.utilization", "if.host.updates.pending"]);
  const logs = toGapLogBatch(m, observed().at);
  assertEquals(logs.records.length, 5);
  assertEquals(logs.records[0]?.attributes["if.probe.table"], "uptime");
  const full = toMetricBatch(signalsOf(observed(), ROWS, { platform: "debian" }));
  const net = full.metrics.find((x) => x.name === "system.network.io");
  assert(net?.data.kind === "sum" && net.data.monotonic && net.data.temporality === "cumulative");
});

proves([S("FR-012")], "the platform of a family and the tables claimed for it: a platform with none claimed is asked for no table", () => {
  assertEquals(["windows", "macos", "darwin", "debian", "ubuntu", "rocky", "opensuse-leap", "alpine", "freebsd"].map((f) => platformOfFamily(f)), ["windows", "macos", "macos", "debian", "debian", "redhat", "suse", "alpine", undefined]);
  assertEquals(tablesFor("windows"), []);
  assertEquals(tablesFor("macos"), []);
  assertEquals(tablesFor("debian"), ["uptime", "load_average", "memory_info", "cpu_time", "interface_details"]);
  const m = signalsOf(observed(), new Map(), { platform: "windows" });
  assertEquals(m.gaps.map((g) => g.why), ["unsupported", "unsupported", "unsupported", "unsupported", "unsupported"]);
  assertEquals(m.signals.some((s) => s.name === "system.filesystem.utilization"), true);
});

proves([S("FR-013")], "a drift count is a gauge in all and by kind, named by the table of conventions, and none is given where none is passed", () => {
  const none = signalsOf(observed(), undefined, { platform: "debian" });
  assertEquals(none.signals.some((x) => x.name === "if.host.drift.requirements"), false);
  const m = signalsOf(observed(), undefined, { platform: "debian", drift: { count: 3, byKind: { service: 1, package: 2 } } });
  const drift = m.signals.filter((x) => x.name === "if.host.drift.requirements");
  assertEquals(drift.map((x) => [x.attributes["if.drift.kind"] ?? "all", x.value]), [["all", 3], ["package", 2], ["service", 1]]);
  assertEquals(drift.every((x) => x.kind === "gauge" && x.unit === "{requirement}"), true);
  assertEquals(signalsOf(observed(), undefined, { platform: "debian", drift: { count: 0, byKind: {} } }).signals.filter((x) => x.name === "if.host.drift.requirements").map((x) => x.value), [0]);
});
