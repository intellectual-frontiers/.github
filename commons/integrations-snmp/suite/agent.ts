/**
 * A device made for the tests: an agent that answers discovery, authenticates and deciphers a request with the same primitives as the library, and answers `GET` and `GETNEXT` from a table of made-up objects. It proves the session against itself (the messages and the security
 * model agree with each other), not against a real device.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { decode, encode, hexOf, type Ber } from "../src/logical/ber.ts";
import { decodeMessage, encodeMessage, type Pdu, type Scoped, type VarBind } from "../src/logical/message.ts";
import type { DatagramPort } from "../src/logical/session.ts";
import { keysFor, openAnswer, sealAnswer, type Keys, type Primitives } from "../src/logical/usm.ts";
import { nodePrimitives } from "../src/physical/node.ts";

/** The arcs of an object identifier. */
const arcs = (oid: string): number[] => oid.split(".").map(Number);
/** Order of two object identifiers by arcs. */
export function compareOid(a: string, b: string): number {
  const x = arcs(a);
  const y = arcs(b);
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    const d = (x[i] ?? -1) - (y[i] ?? -1);
    if (d !== 0) return d;
  }
  return 0;
}

/** What the agent holds and how it behaves. */
export type AgentOptions = {
  readonly engineId: Uint8Array;
  readonly user: string;
  readonly authPassword: string;
  readonly privPassword: string;
  readonly mib: Readonly<Record<string, Ber>>;
  readonly boots?: number;
  readonly time?: () => number;
  /** Where the first answer is not in the window of time (the report that the session must follow). */
  readonly refuseFirstAsLate?: boolean;
  /** An answer that is changed on the way (a flip of one octet). */
  readonly tamper?: boolean;
  readonly prims?: Primitives;
};

const COUNTER = (n: number): Ber => ({ kind: "app", tag: 1, value: Uint8Array.of(n) });

/** A datagram port that is a device. `seen` counts what it received. */
export function fakeDevice(o: AgentOptions): { readonly port: DatagramPort; readonly seen: { requests: number; discoveries: number; setLike: number } } {
  const prims = o.prims ?? nodePrimitives;
  const keys: Keys = (() => {
    const k = keysFor(prims, "hmac-sha-256", o.authPassword, o.privPassword, o.engineId);
    if (k.kind === "err") throw new Error("keys");
    return k.value;
  })();
  const boots = o.boots ?? 7;
  const time = o.time ?? ((): number => 1000);
  const seen = { requests: 0, discoveries: 0, setLike: 0 };
  let late = o.refuseFirstAsLate === true;
  const sorted = Object.keys(o.mib).sort(compareOid);
  const report = (msgId: number, oid: string): Uint8Array => {
    const scoped: Scoped = { contextEngineId: o.engineId, contextName: new Uint8Array(), pdu: { type: "report", requestId: 0, errorStatus: 0, errorIndex: 0, varbinds: [{ oid, value: COUNTER(1) }] } };
    return encodeMessage({ msgId, maxSize: 65507, flags: { auth: false, priv: false, reportable: false }, usm: { engineId: o.engineId, boots, time: time(), user: "", authParams: new Uint8Array(), privParams: new Uint8Array() }, data: { kind: "plain", scoped } });
  };
  const port: DatagramPort = {
    exchange: (request) => {
      const m = decodeMessage(request);
      if (m.kind === "err") return Promise.resolve(err("network" as const));
      if (!m.value.flags.auth) {
        seen.discoveries += 1;
        return Promise.resolve(ok(report(m.value.msgId, "1.3.6.1.6.3.15.1.1.4.0")));
      }
      seen.requests += 1;
      if (m.value.usm.user !== o.user) return Promise.resolve(ok(report(m.value.msgId, "1.3.6.1.6.3.15.1.1.3.0")));
      if (late) {
        late = false;
        return Promise.resolve(ok(report(m.value.msgId, "1.3.6.1.6.3.15.1.1.2.0")));
      }
      const opened = openAnswer(prims, keys, request);
      if (opened.kind === "err") return Promise.resolve(ok(report(m.value.msgId, opened.error.kind === "digest" ? "1.3.6.1.6.3.15.1.1.5.0" : "1.3.6.1.6.3.15.1.1.6.0")));
      const pdu = opened.value.scoped.pdu;
      const answer = (varbinds: readonly VarBind[], errorStatus = 0): Pdu => ({ type: "response", requestId: pdu.requestId, errorStatus, errorIndex: 0, varbinds });
      const varbinds: VarBind[] = [];
      let status = 0;
      for (const v of pdu.varbinds) {
        if (pdu.type === "get") varbinds.push({ oid: v.oid, value: o.mib[v.oid] ?? { kind: "exc", tag: 1 } });
        else {
          const next = sorted.find((k) => compareOid(k, v.oid) > 0);
          varbinds.push(next === undefined ? { oid: v.oid, value: { kind: "exc", tag: 2 } } : { oid: next, value: o.mib[next] ?? { kind: "null" } });
        }
      }
      if (pdu.type !== "get" && pdu.type !== "getnext") {
        seen.setLike += 1;
        status = 5;
      }
      const scoped: Scoped = { contextEngineId: o.engineId, contextName: new Uint8Array(), pdu: answer(varbinds, status) };
      const sealed = sealAnswer(prims, keys, { msgId: m.value.msgId, maxSize: 65507, user: o.user, engine: { id: o.engineId, boots, time: time() }, scoped, salt: Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8) });
      if (sealed.kind === "err") return Promise.resolve(err("network" as const));
      const out = sealed.value.slice();
      if (o.tamper === true) out[out.length - 1] = (out[out.length - 1] ?? 0) ^ 1;
      return Promise.resolve(ok(out));
    },
  };
  return { port, seen };
}

/** Text as an octet string. */
export const text = (s: string): Ber => ({ kind: "octets", value: new TextEncoder().encode(s) });
/** An integer. */
export const num = (n: number): Ber => ({ kind: "int", value: BigInt(n) });
/** Time ticks. */
export const ticks = (n: number): Ber => ({ kind: "app", tag: 3, value: Uint8Array.of((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff) });
/** Octets from hexadecimal. */
export const hex = (h: string): Ber => ({ kind: "octets", value: Uint8Array.from(h.match(/../gu) ?? [], (x) => parseInt(x, 16)) });

/** The made-up device used by the suite: a switch with two interfaces, one down by fault, and an entity with a model, firmware and serial. */
export function switchMib(): Record<string, Ber> {
  const e = "1.3.6.1.2.1.47.1.1.1.1";
  return {
    "1.3.6.1.2.1.1.1.0": text("Synthetic Switch Software 1.2.3"),
    "1.3.6.1.2.1.1.2.0": { kind: "oid", value: "1.3.6.1.4.1.99999.1" },
    "1.3.6.1.2.1.1.3.0": ticks(8_640_000),
    "1.3.6.1.2.1.1.5.0": text("synthetic-switch-01"),
    "1.3.6.1.2.1.2.2.1.2.1": text("eth0"),
    "1.3.6.1.2.1.2.2.1.2.2": text("eth1"),
    "1.3.6.1.2.1.2.2.1.6.1": hex("02005e100001"),
    "1.3.6.1.2.1.2.2.1.6.2": hex("02005e100002"),
    "1.3.6.1.2.1.2.2.1.7.1": num(1),
    "1.3.6.1.2.1.2.2.1.7.2": num(1),
    "1.3.6.1.2.1.2.2.1.8.1": num(1),
    "1.3.6.1.2.1.2.2.1.8.2": num(2),
    [`${e}.5.1`]: num(3),
    [`${e}.9.1`]: text("fw-9.9.9"),
    [`${e}.11.1`]: text("SYN-0001"),
    [`${e}.13.1`]: text("SYN-SW-24"),
    "1.3.6.1.2.1.25.1.1.0": text("outside the allow-list"),
  };
}

export { decode, encode, hexOf };
