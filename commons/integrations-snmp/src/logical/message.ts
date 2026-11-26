// Spec: 0002-snmp-connector FR-004, FR-006
/**
 * The messages of SNMPv3 (RFC 3412, RFC 3414) as typed values over BER: the message with its header and its security parameters, the scoped PDU, and the two requests this connector may send, `GET` and `GETNEXT`. The type of a request has no
 * `SET`, no bulk request and no inform, so a request that writes cannot be built; an answer other than a response or a report is refused.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { decode, encode, int, octets, seq, type Ber } from "./ber.ts";

/** The requests this connector may make, and the answers it reads. */
export type PduType = "get" | "getnext" | "response" | "report";
const TAGS: Readonly<Record<PduType, number>> = { get: 0, getnext: 1, response: 2, report: 8 };

/** A variable binding. */
export type VarBind = { readonly oid: string; readonly value: Ber };
/** A PDU. */
export type Pdu = { readonly type: PduType; readonly requestId: number; readonly errorStatus: number; readonly errorIndex: number; readonly varbinds: readonly VarBind[] };
/** A scoped PDU. */
export type Scoped = { readonly contextEngineId: Uint8Array; readonly contextName: Uint8Array; readonly pdu: Pdu };
/** The security parameters of the user-based security model (RFC 3414). */
export type Usm = { readonly engineId: Uint8Array; readonly boots: number; readonly time: number; readonly user: string; readonly authParams: Uint8Array; readonly privParams: Uint8Array };
/** The flags of a message. */
export type Flags = { readonly auth: boolean; readonly priv: boolean; readonly reportable: boolean };
/** The data of a message: the scoped PDU in the clear, or the bytes of it enciphered. */
export type Data = { readonly kind: "plain"; readonly scoped: Scoped } | { readonly kind: "encrypted"; readonly bytes: Uint8Array };
/** A message of SNMPv3. */
export type Message = { readonly msgId: number; readonly maxSize: number; readonly flags: Flags; readonly usm: Usm; readonly data: Data };

/** Why bytes are not a message this connector reads. */
export type MessageError = { readonly kind: "ber"; readonly at: string } | { readonly kind: "shape"; readonly what: string } | { readonly kind: "version"; readonly version: number } | { readonly kind: "model"; readonly model: number } | { readonly kind: "pdu"; readonly tag: number };

const shape = (what: string): MessageError => ({ kind: "shape", what });
const asNumber = (b: Ber | undefined): number | undefined => (b?.kind === "int" && b.value >= -0x8000_0000n && b.value <= 0xffff_ffffn ? Number(b.value) : undefined);

/** The BER of a PDU. */
export function pduBer(p: Pdu): Ber {
  return { kind: "ctx", tag: TAGS[p.type], items: [int(p.requestId), int(p.errorStatus), int(p.errorIndex), seq(...p.varbinds.map((v) => seq({ kind: "oid", value: v.oid }, v.value)))] };
}

/** The BER of a scoped PDU. */
export const scopedBer = (s: Scoped): Ber => seq(octets(s.contextEngineId), octets(s.contextName), pduBer(s.pdu));

function pduOf(b: Ber | undefined): Result<Pdu, MessageError> {
  if (b?.kind !== "ctx") return err(shape("the PDU"));
  const type = (Object.keys(TAGS) as PduType[]).find((k) => TAGS[k] === b.tag);
  if (type === undefined) return err({ kind: "pdu", tag: b.tag });
  const [id, status, index, binds] = b.items;
  const requestId = asNumber(id);
  const errorStatus = asNumber(status);
  const errorIndex = asNumber(index);
  if (requestId === undefined || errorStatus === undefined || errorIndex === undefined || binds?.kind !== "seq") return err(shape("the fields of the PDU"));
  const varbinds: VarBind[] = [];
  for (const v of binds.items) {
    if (v.kind !== "seq" || v.items.length !== 2 || v.items[0]?.kind !== "oid" || v.items[1] === undefined) return err(shape("a variable binding"));
    varbinds.push({ oid: v.items[0].value, value: v.items[1] });
  }
  return ok({ type, requestId, errorStatus, errorIndex, varbinds });
}

/** A scoped PDU read from its BER. Only the four types of `PduType` are read: a PDU that sets, or any other, is refused. */
export function scopedOf(b: Ber): Result<Scoped, MessageError> {
  if (b.kind !== "seq" || b.items.length !== 3 || b.items[0]?.kind !== "octets" || b.items[1]?.kind !== "octets") return err(shape("the scoped PDU"));
  const pdu = pduOf(b.items[2]);
  if (pdu.kind === "err") return pdu;
  return ok({ contextEngineId: b.items[0].value, contextName: b.items[1].value, pdu: pdu.value });
}

const flagsByte = (f: Flags): number => (f.auth ? 1 : 0) | (f.priv ? 2 : 0) | (f.reportable ? 4 : 0);

/** The BER of a message. */
export function messageBer(m: Message): Ber {
  const usm = seq(octets(m.usm.engineId), int(m.usm.boots), int(m.usm.time), octets(new TextEncoder().encode(m.usm.user)), octets(m.usm.authParams), octets(m.usm.privParams));
  const data: Ber = m.data.kind === "plain" ? scopedBer(m.data.scoped) : octets(m.data.bytes);
  return seq(int(3), seq(int(m.msgId), int(m.maxSize), octets(Uint8Array.of(flagsByte(m.flags))), int(3)), octets(encode(usm)), data);
}

/** The bytes of a message. */
export const encodeMessage = (m: Message): Uint8Array => encode(messageBer(m));

/** A message read from bytes: the version must be 3 and the security model the user-based one. */
export function decodeMessage(bytes: Uint8Array): Result<Message, MessageError> {
  const top = decode(bytes);
  if (top.kind === "err") return err({ kind: "ber", at: top.error.kind });
  const b = top.value;
  if (b.kind !== "seq" || b.items.length !== 4) return err(shape("the message"));
  const [version, header, params, data] = b.items;
  const v = asNumber(version);
  if (v !== 3) return err({ kind: "version", version: v ?? -1 });
  if (header?.kind !== "seq" || header.items.length !== 4) return err(shape("the header"));
  const msgId = asNumber(header.items[0]);
  const maxSize = asNumber(header.items[1]);
  const fl = header.items[2];
  const model = asNumber(header.items[3]);
  if (msgId === undefined || maxSize === undefined || fl?.kind !== "octets" || fl.value.length !== 1 || model === undefined) return err(shape("the header fields"));
  if (model !== 3) return err({ kind: "model", model });
  const f = fl.value[0] ?? 0;
  const flags: Flags = { auth: (f & 1) !== 0, priv: (f & 2) !== 0, reportable: (f & 4) !== 0 };
  if (params?.kind !== "octets") return err(shape("the security parameters"));
  const inner = decode(params.value);
  if (inner.kind === "err") return err({ kind: "ber", at: inner.error.kind });
  const u = inner.value;
  if (u.kind !== "seq" || u.items.length !== 6) return err(shape("the user-based security parameters"));
  const [eid, boots, time, user, auth, priv] = u.items;
  const bootsN = asNumber(boots);
  const timeN = asNumber(time);
  if (eid?.kind !== "octets" || bootsN === undefined || timeN === undefined || user?.kind !== "octets" || auth?.kind !== "octets" || priv?.kind !== "octets") return err(shape("the security parameter fields"));
  const usm: Usm = { engineId: eid.value, boots: bootsN, time: timeN, user: new TextDecoder().decode(user.value), authParams: auth.value, privParams: priv.value };
  if (data?.kind === "octets") return ok({ msgId, maxSize, flags, usm, data: { kind: "encrypted", bytes: data.value } });
  if (data === undefined) return err(shape("the data"));
  const scoped = scopedOf(data);
  if (scoped.kind === "err") return scoped;
  return ok({ msgId, maxSize, flags, usm, data: { kind: "plain", scoped: scoped.value } });
}
