// Spec: 0002-snmp-connector FR-006, FR-010
/**
 * The read port of a device (0002-snmp-connector FR-006, FR-010): `get` of one object and `pages` as a walk, made over a session whose only requests are `get` and `getNext`, so that a write cannot be made through it. A walk is bounded by an allow-list of subtrees, a number of rows, a time and a number
 * of requests each second, and the object identifier it starts from and every one it reaches must be inside the allow-list. A variable binding is given as a document of its type and value, an octet string as text where it is printable and as hexadecimal always.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { oidAllowed, type WalkBounds } from "@intellectual-frontiers/integrations-snmp/governance";
import type { Json, ReadFailure, ReadPort } from "@intellectual-frontiers/integrations/logical";
import { hexOf, type Ber } from "./ber.ts";
import type { VarBind } from "./message.ts";
import type { Session, SnmpFailure } from "./session.ts";

/** The path that gives the engine id the discovery found: a fact of the session, not an object of the device. */
export const ENGINE_PATH = "/engine";

/** The clock a walk is paced by. */
export type Pace = { readonly now: () => number; readonly sleep: (ms: number) => Promise<void> };

const APP: Readonly<Record<number, string>> = { 0: "ip", 1: "counter32", 2: "gauge32", 3: "timeticks", 4: "opaque", 6: "counter64" };
const EXC: Readonly<Record<number, string>> = { 0: "no-such-object", 1: "no-such-instance", 2: "end-of-mib-view" };
const printable = (b: Uint8Array): string | undefined => {
  if (b.length === 0) return "";
  if (b.some((x) => x < 0x20 || x > 0x7e)) return undefined;
  return new TextDecoder().decode(b);
};
const unsigned = (b: Uint8Array): number => b.reduce((n, x) => n * 256 + x, 0);

/** The document of a variable binding. */
export function jsonOf(v: VarBind): Json {
  const b: Ber = v.value;
  switch (b.kind) {
    case "int":
      return { oid: v.oid, type: "integer", value: Number(b.value) };
    case "octets": {
      const text = printable(b.value);
      return text === undefined ? { oid: v.oid, type: "octets", hex: hexOf(b.value) } : { oid: v.oid, type: "octets", text, hex: hexOf(b.value) };
    }
    case "null":
      return { oid: v.oid, type: "null" };
    case "oid":
      return { oid: v.oid, type: "oid", value: b.value };
    case "app":
      return b.tag === 0 && b.value.length === 4 ? { oid: v.oid, type: "ip", value: Array.from(b.value).join(".") } : { oid: v.oid, type: APP[b.tag] ?? `application-${b.tag}`, value: unsigned(b.value) };
    case "exc":
      return { oid: v.oid, type: "missing", why: EXC[b.tag] ?? "exception" };
    case "seq":
    case "ctx":
      return { oid: v.oid, type: "structure" };
  }
}

/** Why a request failed, in the failures of a read port. */
export function readFailureOf(f: SnmpFailure, subject: string): ReadFailure {
  switch (f.kind) {
    case "unreachable":
    case "discovery":
      return { kind: "network", subject };
    case "refused":
      return { kind: "denied", subject };
    case "protocol":
      return { kind: "decode", subject };
    case "status":
      return f.status === 2 ? { kind: "not-found", subject } : { kind: "server", subject, status: f.status };
  }
}

const pathOid = (path: string): string => (path.startsWith("/") ? path.slice(1) : path);
const inside = (oid: string, root: string): boolean => oid === root || oid.startsWith(`${root}.`);

/** The read port of a session: `get` and a bounded walk. */
export function snmpReadPort(session: Session, bounds: WalkBounds, pace: Pace): ReadPort {
  const gap = Math.ceil(1000 / bounds.maxRequestsPerSecond);
  return {
    get: async (path): Promise<Result<Json, ReadFailure>> => {
      if (path === ENGINE_PATH) return ok({ type: "engine", hex: hexOf(session.engineId) });
      const oid = pathOid(path);
      if (!oidAllowed(oid)) return err({ kind: "denied", subject: path });
      const r = await session.get([oid]);
      if (r.kind === "err") return err(readFailureOf(r.error, path));
      const v = r.value[0];
      if (v === undefined) return err({ kind: "decode", subject: path });
      const j = jsonOf(v);
      return typeof j === "object" && j !== null && !Array.isArray(j) && (j as { type?: Json }).type === "missing" ? err({ kind: "not-found", subject: path }) : ok(j);
    },
    pages: async function* (path): AsyncGenerator<Json, Result<number, ReadFailure>> {
      const root = pathOid(path);
      if (!oidAllowed(root)) return err({ kind: "denied", subject: path });
      const started = pace.now();
      let at = root;
      let rows = 0;
      let last = started - gap;
      for (;;) {
        if (rows >= bounds.maxRows || pace.now() - started > bounds.maxMs) return ok(rows);
        const wait = last + gap - pace.now();
        if (wait > 0) await pace.sleep(wait);
        last = pace.now();
        const r = await session.getNext(at);
        if (r.kind === "err") return r.error.kind === "status" && r.error.status === 2 ? ok(rows) : err(readFailureOf(r.error, path));
        const v = r.value;
        if (v.value.kind === "exc" || !inside(v.oid, root) || !oidAllowed(v.oid)) return ok(rows);
        rows += 1;
        at = v.oid;
        yield jsonOf(v);
      }
    },
  };
}
