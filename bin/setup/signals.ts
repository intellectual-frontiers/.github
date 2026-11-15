// The setup's telemetry, as OpenTelemetry signals (009-machine-bootstrap FR-053, FR-054; commons 0006-signals): the run is the root span, each step a span
// with its outcome, exit status and duration, a pool of steps a span over its jobs, and where a failure's log is a log record. They are declared once here
// and started with commons' runtime/otel; the console renders the steps (ui.ts) whether or not anything is sent.
//
// Sent only with ERGA_SIGNALS_URL and its token (ERGA_SIGNALS_TOKEN, else INFRO_ERGA_SIGNAL_INGEST_PRODUCTION_TOKEN, or kept in secrets.env), and never with
// DO_NOT_TRACK=1, ERGA_OBSERVE=off or in a dry run: then the address is the exporter's endpoint (spans to /v1/traces, the log record to /v1/logs, OTLP/HTTP
// JSON) and the token its Authorization header, given to fetch in this process and never on a command line (011-secrets FR-003). Every signal carries the
// resource: environment `bootstrap`, a device id made from the machine, the kind of computer, the system, kernel, architecture, processors, memory and free
// disk, the host name and the Linux user name (FR-054). No password, token or file content is sent. What is sent is also kept, as OTLP JSON lines, in
// erga's state folder (telemetry/bootstrap.otlp.jsonl). Sending never fails the setup and waits at most three seconds at its end: it is an aid, never a gate.
import { sha256 } from "../../commons/ts/kernel/sha256.ts";
import { SEVERITY } from "../../commons/ts/kernel/otel.ts";
import { defineSignals, type Telemetry } from "../../commons/ts/kernel/signals.ts";
import * as fs from "../../commons/ts/runtime/fs.ts";
import { type Pipeline, startTelemetry } from "../../commons/ts/runtime/otel.ts";
import * as path from "../../commons/ts/runtime/path.ts";
import type { TelemetrySettings } from "./options.ts";
import type { Ui } from "./ui.ts";

export const SETUP_SIGNALS = defineSignals({
  "bootstrap.run": {
    signal: "span",
    role: "none",
    description: "A run of the setup, the root of its steps: how it was run, and how it ended.",
    attributes: {
      method: "string",
      script: "string",
      tty: "boolean",
      "distro?": "string",
      "distro_version?": "string",
      "outcome?": "string",
      "exit_code?": "int",
      "steps?": "int",
      "problems?": "int",
      "log_file?": "string",
    },
  },
  "bootstrap.step": {
    signal: "span",
    role: "step",
    description: "One step: its label, the group it is in, its outcome and exit status; its duration is the span's.",
    attributes: {
      step: "string",
      phase: "string",
      step_no: "int",
      "parallel?": "boolean",
      "attended?": "boolean",
      "outcome?": "string",
      "exit_code?": "int",
    },
  },
  "bootstrap.pool": {
    signal: "span",
    role: "step",
    description: "Steps that do not touch each other, run at the same time (FR-030).",
    attributes: { title: "string", jobs: "int" },
  },
  "bootstrap.failed": {
    signal: "log",
    role: "none",
    severity: SEVERITY.ERROR,
    description: "The step that stopped the run, where its log and support file are (relative to the home folder), and its last lines, tokens removed.",
    attributes: { step: "string", step_no: "int", log_line: "int", log_file: "string", support_file: "string", error_tail: "string" },
  },
});
export type SetupKinds = (typeof SETUP_SIGNALS)["kinds"];

/** The attributes every signal of a run carries, as text (OTEL_RESOURCE_ATTRIBUTES holds text). */
export type Props = Readonly<Record<string, string | number>>;

/** The telemetry of a run: the spans and the log record, rendered always and sent only where the settings say so. */
export class Signals {
  readonly telemetry: Telemetry<SetupKinds>;
  readonly on: boolean;
  readonly pipeline: Pipeline;
  constructor(telemetry: Telemetry<SetupKinds>, on: boolean, pipeline: Pipeline) {
    this.telemetry = telemetry;
    this.on = on;
    this.pipeline = pipeline;
  }
  /** Everything still being sent, waited for three seconds at most; nothing is recorded after. */
  async close(): Promise<void> {
    await this.pipeline.shutdown(3000);
  }
}

// deno-lint-ignore no-control-regex
const clean = (s: string) => s.replace(/[\u0000-\u001f]/g, "").slice(0, 400);

/** The exporter's configuration, in the variables OpenTelemetry reads: the door's address and token where the settings say telemetry is on, else none at all. */
export function exporterEnv(settings: TelemetrySettings, resource: Props): Readonly<Record<string, string>> {
  if (settings.kind !== "on") return { OTEL_SDK_DISABLED: "true" };
  const attributes = Object.entries(resource).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(clean(String(v)))}`).join(",");
  return {
    OTEL_EXPORTER_OTLP_ENDPOINT: settings.url,
    OTEL_EXPORTER_OTLP_HEADERS: `authorization=${encodeURIComponent(`Bearer ${settings.token}`)}`,
    OTEL_EXPORTER_OTLP_PROTOCOL: "http/json",
    OTEL_EXPORTER_OTLP_TIMEOUT: "3000",
    OTEL_METRICS_EXPORTER: "none",
    OTEL_RESOURCE_ATTRIBUTES: attributes,
  };
}

/** The telemetry of a run, rendered by the screen's console; sent, and journalled in `journalDir`, only where the settings say telemetry is on. */
export function startSignals(o: { readonly settings: TelemetrySettings; readonly resource: Props; readonly journalDir: string; readonly ui: Ui }): Signals {
  const on = o.settings.kind === "on";
  const started = startTelemetry({
    registry: SETUP_SIGNALS,
    service: "erga-bootstrap",
    env: exporterEnv(o.settings, o.resource),
    ...(on ? { journal: { path: path.join(o.journalDir, "bootstrap.otlp.jsonl") } } : {}),
    processors: [o.ui.live],
    install: false,
  });
  return new Signals(started.telemetry, on, started.pipeline);
}

/** The resource of a run: environment `bootstrap`, the device and the run, and the machine (FR-054). */
export function resourceOf(device: string, run: string, machine: Props): Props {
  return {
    "service.name": "erga-bootstrap",
    "deployment.environment.name": "bootstrap",
    environment: "bootstrap",
    "device.id": device,
    bootstrap_run: run,
    ...machine,
  };
}

/** The device id: the same on every run on this machine, made from its machine id (hashed, so the id itself is never sent), else a random one kept in a file. */
export async function deviceId(file: string): Promise<string> {
  try {
    const kept = (await fs.readTextFile(file)).trim();
    if (kept !== "") return kept;
  } catch { /* none kept yet */ }
  let mid = "";
  for (const f of ["/etc/machine-id", "/var/lib/dbus/machine-id"]) {
    try {
      mid = (await fs.readTextFile(f)).trim();
      if (mid !== "") break;
    } catch { /* not this one */ }
  }
  const id = mid !== "" ? `dev-${(await sha256(`erga-device\0${mid}`)).slice(0, 16)}` : `dev-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeTextFile(file, `${id}\n`);
  } catch { /* kept next time, perhaps */ }
  return id;
}
