// Spec: 0003-telemetry-reach FR-025
/**
 * Our own small site relay (0003-telemetry-reach FR-025): it takes syslog over TCP on a port, one line to a message, and sends the lines as OTLP JSON logs to the controller's receiver with the bearer token of the relay. It is the program of a relay
 * before a build of the Collector exists, and it takes TCP syslog only: no UDP, no SNMP, no NetFlow, no Redfish. What it could not send waits in memory, up to a cap, oldest dropped and counted, and goes on the next flush.
 *
 * @example
 * ```ts
 * import { startSyslogRelay } from "./relay.ts";
 * typeof startSyslogRelay; // "function"
 * ```
 *
 * @module
 */
import { createServer, type Server, type Socket } from "node:net";
import { encodeLogs } from "@intellectual-frontiers/telemetry/otlp";
import { logBatchesOf, parseSyslog, type SyslogLine } from "@intellectual-frontiers/telemetry/syslog";

/** What a relay is given: where it listens, where it sends and with which token, how often, how much it keeps, the clock and the fetch (a test gives its own). */
export type SyslogRelayOptions = {
  readonly port: number;
  readonly host?: string;
  /** The receiver, e.g. `http://127.0.0.1:14318` (the local end of the forward). */
  readonly controller: string;
  /** The token the controller bound to this relay. It is sent, never logged. */
  readonly token: string;
  readonly flushMs?: number;
  /** The most lines held while the controller is away; the oldest are dropped and counted. */
  readonly maxLines?: number;
  readonly maxLineBytes?: number;
  readonly now?: () => number;
  readonly fetch?: typeof fetch;
};

/** A running relay. `flush` sends what is held now and says how many lines went and how many wait. */
export type SyslogRelay = {
  readonly address: { readonly host: string; readonly port: number };
  flush(): Promise<{ readonly sent: number; readonly waiting: number }>;
  dropped(): number;
  stop(): Promise<void>;
};

/** Start a relay. Resolves once it listens. */
export async function startSyslogRelay(o: SyslogRelayOptions): Promise<SyslogRelay> {
  const now = o.now ?? Date.now;
  const doFetch = o.fetch ?? fetch;
  const cap = o.maxLines ?? 10_000;
  const maxLine = o.maxLineBytes ?? 8192;
  let held: SyslogLine[] = [];
  let dropped = 0;
  const sockets = new Set<Socket>();
  const take = (line: string): void => {
    if (line.trim() === "") return;
    held.push(parseSyslog(line.slice(0, maxLine), now()));
    if (held.length > cap) {
      dropped += held.length - cap;
      held = held.slice(held.length - cap);
    }
  };
  const flush = async (): Promise<{ sent: number; waiting: number }> => {
    if (held.length === 0) return { sent: 0, waiting: 0 };
    const batch = held;
    held = [];
    try {
      const res = await doFetch(new URL("/v1/logs", o.controller), {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${o.token}` },
        body: JSON.stringify(encodeLogs(logBatchesOf(batch, now()))),
      });
      await res.body?.cancel().catch(() => undefined);
      if (res.status >= 200 && res.status < 300) return { sent: batch.length, waiting: held.length };
      if (res.status >= 400 && res.status < 500 && res.status !== 429 && res.status !== 401 && res.status !== 403) return { sent: 0, waiting: held.length };
    } catch {
      /* the controller is away: keep the lines */
    }
    held = [...batch, ...held].slice(-cap);
    return { sent: 0, waiting: held.length };
  };
  const server: Server = createServer((socket) => {
    sockets.add(socket);
    let pending = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      pending += chunk;
      let i = pending.indexOf("\n");
      while (i >= 0) {
        take(pending.slice(0, i));
        pending = pending.slice(i + 1);
        i = pending.indexOf("\n");
      }
      if (pending.length > maxLine) {
        take(pending);
        pending = "";
      }
    });
    socket.on("end", () => take(pending));
    socket.on("error", () => undefined);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(o.port, o.host ?? "0.0.0.0", () => resolve());
  });
  const a = server.address();
  const timer = setInterval(() => void flush(), o.flushMs ?? 5000);
  timer.unref();
  return {
    address: typeof a === "object" && a !== null ? { host: a.address, port: a.port } : { host: o.host ?? "0.0.0.0", port: o.port },
    flush,
    dropped: () => dropped,
    stop: async () => {
      clearInterval(timer);
      for (const s of sockets) s.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
