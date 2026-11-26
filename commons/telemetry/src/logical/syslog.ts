// Spec: 0003-telemetry-reach FR-025
/**
 * Syslog lines as log records, pure (0003-telemetry-reach FR-025): RFC 5424 and RFC 3164 lines are read into their parts, and the lines of one source become the log batch OTLP carries. A line that is neither is kept whole as the body at the
 * severity `INFO` with the mark `syslog.parsed` false, so that nothing a device said is lost.
 *
 * @example
 * ```ts
 * import { parseSyslog } from "./syslog.ts";
 * parseSyslog("<34>1 2026-11-26T10:00:00Z host-01 app 1 ID47 - hello").host; // "host-01"
 * ```
 *
 * @module
 */
import { SEVERITY, type SeverityNumber } from "./otel.ts";
import type { LogBatch } from "./otlp.ts";

/** A syslog line read. `time` is in milliseconds where the line said one that could be read. */
export type SyslogLine = { readonly facility: number; readonly severity: number; readonly host: string; readonly app: string; readonly message: string; readonly time: number | undefined; readonly parsed: boolean };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The OpenTelemetry severity of a syslog severity (0 emergency to 7 debug). */
export function severityOf(syslogSeverity: number): SeverityNumber {
  if (syslogSeverity <= 2) return SEVERITY.FATAL;
  if (syslogSeverity === 3) return SEVERITY.ERROR;
  if (syslogSeverity === 4) return SEVERITY.WARN;
  if (syslogSeverity <= 6) return SEVERITY.INFO;
  return SEVERITY.DEBUG;
}

const nil = (s: string | undefined): string => (s === undefined || s === "-" ? "" : s);

/** Read one line. A line that is not syslog is returned whole as `message`, from an unknown host. */
export function parseSyslog(line: string, now = Date.now()): SyslogLine {
  const text = line.replace(/[\r\n]+$/u, "");
  const pri = /^<(\d{1,3})>(.*)$/su.exec(text);
  if (pri === null) return { facility: 1, severity: 6, host: "", app: "", message: text, time: undefined, parsed: false };
  const n = Number(pri[1]);
  const facility = Math.floor(n / 8);
  const severity = n % 8;
  const rest = pri[2] ?? "";
  const v5 = /^1 (\S+) (\S+) (\S+) (\S+) (\S+) (-|\[(?:[^\]\\]|\\.)*\](?:\[(?:[^\]\\]|\\.)*\])*) ?(.*)$/su.exec(rest);
  if (v5 !== null) {
    const t = Date.parse(v5[1] ?? "");
    return { facility, severity, host: nil(v5[2]), app: nil(v5[3]), message: v5[7] ?? "", time: Number.isNaN(t) ? undefined : t, parsed: true };
  }
  const v3 = /^([A-Z][a-z]{2}) ([ \d]\d) (\d\d):(\d\d):(\d\d) (\S+) (?:([^\s:[]+)(?:\[\d+\])?: ?)?(.*)$/su.exec(rest);
  if (v3 !== null) {
    const month = MONTHS.indexOf(v3[1] ?? "");
    const year = new Date(now).getUTCFullYear();
    const t = month < 0 ? NaN : Date.UTC(year, month, Number((v3[2] ?? "").trim()), Number(v3[3]), Number(v3[4]), Number(v3[5]));
    return { facility, severity, host: v3[6] ?? "", app: v3[7] ?? "", message: v3[8] ?? "", time: Number.isNaN(t) ? undefined : t, parsed: true };
  }
  return { facility, severity, host: "", app: "", message: rest, time: undefined, parsed: false };
}

/** The log batches of some lines: one for each host that sent, with the facility, severity and application as attributes. The device keys (`host.name`) are as the relay read them, and `if.relay.id` is the receiver's to set. */
export function logBatchesOf(lines: readonly SyslogLine[], now: number): readonly LogBatch[] {
  const byHost = new Map<string, SyslogLine[]>();
  for (const l of lines) byHost.set(l.host, [...(byHost.get(l.host) ?? []), l]);
  return [...byHost.entries()].map(([host, ls]) => ({
    resource: { attributes: host === "" ? {} : { "host.name": host } },
    scope: { name: "ifc.syslog" },
    records: ls.map((l) => ({
      time: BigInt(l.time ?? now) * 1_000_000n,
      observedTime: BigInt(now) * 1_000_000n,
      severityNumber: severityOf(l.severity),
      severityText: ["emergency", "alert", "critical", "error", "warning", "notice", "info", "debug"][l.severity] ?? "info",
      body: l.message,
      attributes: { "syslog.facility": l.facility, "syslog.severity": l.severity, "syslog.parsed": l.parsed, ...(l.app === "" ? {} : { "service.name": l.app }) },
      droppedAttributesCount: 0,
    })),
  }));
}
