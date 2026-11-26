// Spec: 0003-server-policy FR-005
/**
 * The source-network policy, pure: an address is read as a number, classified, and held against the private ranges the server always allows and the CIDR blocks the policy lists.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import type { Result } from "@intellectual-frontiers/core";
import type { ServerPolicy } from "@intellectual-frontiers/ssh-server/governance";

/** An address as a family and a number. */
export type Ip = { readonly v: 4 | 6; readonly n: bigint };
/** The class of an address. */
export type NetClass = "loopback" | "private" | "link-local" | "ula" | "public";

function v4(text: string): bigint | undefined {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(text);
  if (m === null) return undefined;
  let n = 0n;
  for (const part of m.slice(1)) {
    if (part.length > 1 && part.startsWith("0")) return undefined;
    const x = Number(part);
    if (x > 255) return undefined;
    n = (n << 8n) | BigInt(x);
  }
  return n;
}

function v6(text: string): bigint | undefined {
  let t = text;
  const zone = t.indexOf("%");
  if (zone >= 0) t = t.slice(0, zone);
  const tail = /:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(t);
  if (tail !== null) {
    const n = v4(tail[1] as string);
    if (n === undefined) return undefined;
    t = `${t.slice(0, t.length - (tail[1] as string).length)}${(n >> 16n).toString(16)}:${(n & 0xffffn).toString(16)}`;
  }
  const halves = t.split("::");
  if (halves.length > 2) return undefined;
  const head = halves[0] === "" ? [] : (halves[0] as string).split(":");
  const rest = halves.length === 2 ? (halves[1] === "" ? [] : (halves[1] as string).split(":")) : [];
  const fill = 8 - head.length - rest.length;
  if (halves.length === 2 ? fill < 1 : head.length !== 8) return undefined;
  const groups = halves.length === 2 ? [...head, ...Array<string>(fill).fill("0"), ...rest] : head;
  let n = 0n;
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return undefined;
    n = (n << 16n) | BigInt(parseInt(g, 16));
  }
  return n;
}

/** Read an address (IPv4, IPv6 or IPv4-mapped IPv6, which is read as IPv4), or nothing where it is none. */
export function parseIp(text: string): Ip | undefined {
  if (text.includes(":")) {
    const n = v6(text);
    if (n === undefined) return undefined;
    if (n >> 32n === 0xffffn) return { v: 4, n: n & 0xffffffffn };
    return { v: 6, n };
  }
  const n = v4(text);
  return n === undefined ? undefined : { v: 4, n };
}

function inBlock(ip: Ip, base: Ip, bits: number): boolean {
  if (ip.v !== base.v) return false;
  const width = ip.v === 4 ? 32 : 128;
  const shift = BigInt(width - bits);
  return ip.n >> shift === base.n >> shift;
}

/** Read a CIDR block (`10.0.0.0/8`, `fd00::/8`, or a single address), or say what is wrong. */
export function parseCidr(text: string): Result<{ readonly base: Ip; readonly bits: number }, string> {
  const [addr, len, extra] = text.split("/");
  if (extra !== undefined || addr === undefined) return err(`${text}: not a CIDR block`);
  const base = parseIp(addr);
  if (base === undefined) return err(`${text}: not an address`);
  const max = base.v === 4 ? 32 : 128;
  const bits = len === undefined ? max : /^\d{1,3}$/.test(len) ? Number(len) : -1;
  if (bits < 0 || bits > max) return err(`${text}: a prefix length from 0 to ${max}`);
  return ok({ base, bits });
}

const PRIVATE_V4: readonly (readonly [string, NetClass, number])[] = [
  ["127.0.0.0", "loopback", 8],
  ["10.0.0.0", "private", 8],
  ["172.16.0.0", "private", 12],
  ["192.168.0.0", "private", 16],
  ["169.254.0.0", "link-local", 16],
];

/** The class of an address: loopback, private (RFC 1918), link-local, ULA or public. An unreadable address is public (the least trusted). */
export function classify(text: string): NetClass {
  const ip = parseIp(text);
  if (ip === undefined) return "public";
  if (ip.v === 4) {
    for (const [base, cls, bits] of PRIVATE_V4) if (inBlock(ip, parseIp(base) as Ip, bits)) return cls;
    return "public";
  }
  if (ip.n === 1n) return "loopback";
  if (inBlock(ip, { v: 6, n: 0xfe80n << 112n }, 10)) return "link-local";
  if (inBlock(ip, { v: 6, n: 0xfc00n << 112n }, 7)) return "ula";
  return "public";
}

/** Whether an address is in any of the blocks. A block that does not read is ignored here, and refused by `checkPolicyCidrs`. */
export function inAnyCidr(text: string, cidrs: readonly string[]): boolean {
  const ip = parseIp(text);
  if (ip === undefined) return false;
  for (const c of cidrs) {
    const b = parseCidr(c);
    if (b.kind === "ok" && inBlock(ip, b.value.base, b.value.bits)) return true;
  }
  return false;
}

/** Whether a source may connect: private, loopback, link-local and ULA always, public only where the policy lists a block that holds it. */
export function sourceAllowed(policy: Pick<ServerPolicy, "allowCidrs">, sourceIp: string): boolean {
  return classify(sourceIp) !== "public" || inAnyCidr(sourceIp, policy.allowCidrs);
}

/** The first block of a list that does not read, as an error. */
export function checkCidrs(cidrs: readonly string[]): Result<readonly string[], string> {
  for (const c of cidrs) {
    const r = parseCidr(c);
    if (r.kind === "err") return r;
  }
  return ok(cidrs);
}
