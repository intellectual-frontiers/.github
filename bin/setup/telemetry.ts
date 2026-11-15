// Telemetry: optional, to ArcaSignals, only with ERGA_SIGNALS_URL and its token (009-machine-bootstrap FR-053, FR-054). With them the setup sends a few events
// (it started, each step with its time and outcome, where a failure's log is, how it ended), each one OpenTelemetry log record posted to arca's door as OTLP/JSON:
// environment `bootstrap`, a device id made from the machine, the kind of computer, the host name and the user name. No password, token or file content is
// sent. Without them, or with DO_NOT_TRACK=1 or ERGA_OBSERVE=off, nothing is sent and nothing else changes: it is an aid, never a gate.
import type { Telemetry } from "./options.ts";

export type Value = string | number;
export type Props = Readonly<Record<string, Value>>;

// deno-lint-ignore no-control-regex
const clean = (s: string) => s.replace(/[\u0000-\u001f]/g, "").slice(0, 400);
const attr = (key: string, v: Value) => typeof v === "number" ? { key, value: { doubleValue: Number.isFinite(v) ? v : 0 } } : { key, value: { stringValue: clean(v) } };

/** The device id: the same on every run on this machine, made from its machine id (hashed, so the id itself is never sent), else a random one kept in a file. */
export async function deviceId(file: string): Promise<string> {
  try {
    const kept = (await Deno.readTextFile(file)).trim();
    if (kept !== "") return kept;
  } catch { /* none kept yet */ }
  let mid = "";
  for (const f of ["/etc/machine-id", "/var/lib/dbus/machine-id"]) {
    try {
      mid = (await Deno.readTextFile(f)).trim();
      if (mid !== "") break;
    } catch { /* not this one */ }
  }
  let id: string;
  if (mid !== "") {
    const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`erga-device\0${mid}`)));
    id = `dev-${[...d].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16)}`;
  } else {
    id = `dev-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
  }
  try {
    await Deno.mkdir(file.replace(/\/[^/]*$/, ""), { recursive: true });
    await Deno.writeTextFile(file, `${id}\n`);
  } catch { /* kept next time, perhaps */ }
  return id;
}

export class Signals {
  readonly #pending: Promise<void>[] = [];
  readonly run: string;
  readonly started = Date.now();
  constructor(
    readonly settings: Telemetry,
    readonly journalDir: string,
    readonly device: () => Promise<string>,
    readonly machine: () => Promise<Props>,
    readonly person: () => string,
  ) {
    this.run = `${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 8)}-${new Date().toISOString().slice(11, 19).replaceAll(":", "")}-${Deno.pid}`;
  }

  get on(): boolean {
    return this.settings.kind === "on";
  }

  /** One event, sent in the background (three seconds at most); it never fails the setup. */
  event(name: string, props: Props): void {
    const s = this.settings;
    if (s.kind !== "on") return;
    this.#pending.push(this.#send(s.url, s.token, name, props).catch(() => {}));
  }

  async #send(url: string, token: string, name: string, props: Props): Promise<void> {
    const dev = await this.device();
    const machine = await this.machine();
    const who = this.person() || dev;
    const common: Props = { environment: "bootstrap", device_id: dev, bootstrap_run: this.run, ...machine, ...props };
    const body = {
      resourceLogs: [{
        resource: { attributes: [attr("service.name", "erga-bootstrap"), attr("enduser.id", who), attr("device.id", dev), attr("deployment.environment.name", "bootstrap")] },
        scopeLogs: [{
          scope: { name: "erga-bootstrap" },
          logRecords: [{
            timeUnixNano: `${Math.floor(Date.now() / 1000)}000000000`,
            severityNumber: 9,
            severityText: "INFO",
            eventName: name,
            attributes: Object.entries(common).map(([k, v]) => attr(k, v)),
          }],
        }],
      }],
    };
    let status = 0;
    try {
      // the token goes in a header of this request alone, never on a command line (011-secrets FR-003)
      const res = await fetch(`${url}/v1/logs`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(3000),
      });
      status = res.status;
      await res.body?.cancel();
    } catch { /* no answer: status 0 */ }
    // erga's journal of what was sent, in its state folder: the event, the door's answer and every property, never the token
    try {
      await Deno.mkdir(this.journalDir, { recursive: true });
      const readme = `${this.journalDir}/README.txt`;
      try {
        await Deno.lstat(readme);
      } catch {
        await Deno.writeTextFile(
          readme,
          "This folder is erga's own record of what it reports to ArcaSignals: sent.jsonl has one line for each event sent, with the door's answer and every property; the token is never written here.\n",
        );
      }
      const line = {
        at: new Date().toISOString().slice(0, 19),
        source: "bootstrap",
        event: name,
        url,
        status,
        error: null,
        properties: { environment: "bootstrap", device_id: dev, bootstrap_run: this.run, ...props },
      };
      await Deno.writeTextFile(`${this.journalDir}/sent.jsonl`, `${JSON.stringify(line)}\n`, { append: true });
    } catch { /* the journal is an aid */ }
  }

  /** Wait (a few seconds at most) for what is still being sent. */
  async wait(): Promise<void> {
    await Promise.all(this.#pending.splice(0));
  }
}
