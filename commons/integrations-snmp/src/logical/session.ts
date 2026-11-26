// Spec: 0002-snmp-connector FR-005, FR-006, FR-009
/**
 * A session with one device (0002-snmp-connector FR-005, FR-006): the discovery of its engine, the keys of the user at that engine, and the two requests that are allowed, `get` and `getNext`, each sealed, sent through a datagram port the caller gives,
 * opened and checked (the request id, the digest, the error status). The same code runs on the controller where it can reach the device and at a relay inside a program of ours; which of the two is a decision of the product. A failure holds no
 * password, no key and no octet of the exchange.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { AuthProtocol } from "@intellectual-frontiers/integrations-snmp/governance";
import type { Ber } from "./ber.ts";
import type { Pdu, Scoped, VarBind } from "./message.ts";
import { discoveryRequest, keysFor, openAnswer, openPlain, sealRequest, type Keys, type Primitives } from "./usm.ts";

/** Sends a datagram and awaits the answer within a time the port decides. */
export type DatagramPort = { readonly exchange: (request: Uint8Array) => Promise<Result<Uint8Array, "timeout" | "network">> };

/** What a session is given. */
export type SessionEnv = {
  readonly datagram: DatagramPort;
  readonly prims: Primitives;
  /** `n` random octets. */
  readonly random: (n: number) => Uint8Array;
  /** The clock, in milliseconds. */
  readonly now: () => number;
};

/** The user and the two passwords, held for the length of one session and never kept. */
export type SessionCredential = { readonly user: string; readonly protocol: AuthProtocol; readonly authPassword: string; readonly privPassword: string };

/** Why a request failed. */
export type SnmpFailure =
  | { readonly kind: "unreachable"; readonly why: "timeout" | "network" }
  | { readonly kind: "discovery" }
  | { readonly kind: "refused"; readonly what: "unsupported-level" | "unknown-user" | "wrong-digest" | "decryption" | "not-in-time-window" }
  | { readonly kind: "protocol"; readonly what: string }
  | { readonly kind: "status"; readonly status: number; readonly index: number };

/** The reports that say why an engine refused a request (RFC 3414, section 3.2), by the object identifier of the counter. */
export const REPORTS: Readonly<Record<string, "unsupported-level" | "not-in-time-window" | "unknown-user" | "unknown-engine" | "wrong-digest" | "decryption">> = {
  "1.3.6.1.6.3.15.1.1.1.0": "unsupported-level",
  "1.3.6.1.6.3.15.1.1.2.0": "not-in-time-window",
  "1.3.6.1.6.3.15.1.1.3.0": "unknown-user",
  "1.3.6.1.6.3.15.1.1.4.0": "unknown-engine",
  "1.3.6.1.6.3.15.1.1.5.0": "wrong-digest",
  "1.3.6.1.6.3.15.1.1.6.0": "decryption",
};

/** A session with a device. */
export type Session = {
  /** The id of the engine of the device (the identity key `snmp-engine-id`). */
  readonly engineId: Uint8Array;
  readonly get: (oids: readonly string[]) => Promise<Result<readonly VarBind[], SnmpFailure>>;
  readonly getNext: (oid: string) => Promise<Result<VarBind, SnmpFailure>>;
};

const MAX_SIZE = 65_507;
const be = (b: Uint8Array): number => b.reduce((n, x) => (n * 256 + x) % 0x7fff_ffff, 0);

/** The discovery of an engine and a session over it, or why there is none. */
export async function openSession(env: SessionEnv, cred: SessionCredential): Promise<Result<Session, SnmpFailure>> {
  let counter = be(env.random(4));
  const next = (): number => {
    counter = (counter + 1) % 0x7fff_ffff;
    return counter;
  };
  const discovered = await env.datagram.exchange(discoveryRequest(next(), MAX_SIZE, next()));
  if (discovered.kind === "err") return err({ kind: "unreachable", why: discovered.error });
  const first = openPlain(discovered.value);
  if (first.kind === "err" || first.value.message.usm.engineId.length === 0) return err({ kind: "discovery" });
  const engineId = first.value.message.usm.engineId;
  let boots = first.value.message.usm.boots;
  let base = first.value.message.usm.time;
  let at = env.now();
  const keys = keysFor(env.prims, cred.protocol, cred.authPassword, cred.privPassword, engineId);
  if (keys.kind === "err") return err({ kind: "protocol", what: "a password is shorter than eight characters" });
  const k: Keys = keys.value;

  const request = async (type: "get" | "getnext", binds: readonly VarBind[], retry: boolean): Promise<Result<Pdu, SnmpFailure>> => {
    const requestId = next();
    const scoped: Scoped = { contextEngineId: engineId, contextName: new Uint8Array(), pdu: { type, requestId, errorStatus: 0, errorIndex: 0, varbinds: binds } };
    const time = base + Math.max(0, Math.floor((env.now() - at) / 1000));
    const sealed = sealRequest(env.prims, k, { msgId: next(), maxSize: MAX_SIZE, user: cred.user, engine: { id: engineId, boots, time }, scoped, salt: env.random(8) });
    if (sealed.kind === "err") return err({ kind: "protocol", what: sealed.error.kind });
    const answer = await env.datagram.exchange(sealed.value);
    if (answer.kind === "err") return err({ kind: "unreachable", why: answer.error });
    const opened = openAnswer(env.prims, k, answer.value);
    if (opened.kind === "err") {
      const plain = openPlain(answer.value);
      if (plain.kind === "err") return err({ kind: "protocol", what: opened.error.kind === "digest" ? "the digest of the answer is wrong" : "the answer cannot be read" });
      const why = REPORTS[plain.value.scoped.pdu.varbinds[0]?.oid ?? ""];
      if (why === "not-in-time-window" && retry) {
        boots = plain.value.message.usm.boots;
        base = plain.value.message.usm.time;
        at = env.now();
        return request(type, binds, false);
      }
      if (why === "unknown-engine" || why === undefined) return err({ kind: "discovery" });
      return err({ kind: "refused", what: why });
    }
    const pdu = opened.value.scoped.pdu;
    boots = opened.value.message.usm.boots;
    base = opened.value.message.usm.time;
    at = env.now();
    if (pdu.type !== "response" || pdu.requestId !== requestId) return err({ kind: "protocol", what: "the answer is not the response to this request" });
    if (pdu.errorStatus !== 0) return err({ kind: "status", status: pdu.errorStatus, index: pdu.errorIndex });
    return ok(pdu);
  };

  const nul: Ber = { kind: "null" };
  return ok({
    engineId,
    get: async (oids) => {
      const r = await request("get", oids.map((oid) => ({ oid, value: nul })), true);
      return r.kind === "ok" ? ok(r.value.varbinds) : r;
    },
    getNext: async (oid) => {
      const r = await request("getnext", [{ oid, value: nul }], true);
      if (r.kind === "err") return r;
      const v = r.value.varbinds[0];
      return v === undefined ? err({ kind: "protocol", what: "the response has no variable binding" }) : ok(v);
    },
  });
}
