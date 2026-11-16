/**
 * Names on the network (commons 0005-typescript-runtime FR-056). `resolveDns` asks for `A`, `AAAA`, `CNAME`, `MX`, `NS`, `TXT` and `SRV`
 * records, with the records in these shapes (`MX` as `{ preference, exchange }`, `TXT` as each record's
 * strings, `SRV` as `{ priority, weight, port, target }`), and answers with a `Result` whose error says whether the name does not exist,
 * has no such record, or could not be asked: a name that does not resolve is an expected outcome, not an exception. `networkInterfaces`
 * gives each interface's name, family, address, netmask and whether it is internal; the process module gives it as
 * `proc.networkInterfaces()`.
 *
 * The question is asked here, over `node:dgram` (and `node:net` where the answer is too long for UDP), not through `node:dns`: the two
 * runtimes' `node:dns` can disagree on exactly what this must tell apart (Bun reports a name without the record as one that does not exist),
 * so one small stub resolver (RFC 1035, with EDNS0
 * for answers up to 1232 bytes over UDP) gives the same answer everywhere. The servers asked are the system's (`node:dns`'s `getServers`,
 * which reads `/etc/resolv.conf` or Windows's settings) or the one given; each is tried twice, for two seconds each time.
 *
 * Names in records come without the trailing dot (`mail.example.com`, as Node gives them). The
 * DNS is asked directly, so the hosts file (`localhost`) is not read.
 *
 * @example
 * ```ts
 * import { resolveDns } from "./dns.ts";
 * const r = await resolveDns("example.com", "MX");
 * if (r.kind === "ok") for (const mx of r.value) console.log(mx.preference, mx.exchange);
 * else if (r.error.kind === "not-found") console.log("no such domain");
 * ```
 *
 * @module
 */
import { getServers } from "node:dns";
import * as dgram from "node:dgram";
import * as net from "node:net";
import * as os from "node:os";
import { absurd } from "../kernel/absurd.ts";
import { err, ok, type Result } from "../kernel/result.ts";

/** The record types that can be asked for. */
export type RecordType = "A" | "AAAA" | "CNAME" | "MX" | "NS" | "TXT" | "SRV";

/** A mail exchanger. */
export type MxRecord = { readonly preference: number; readonly exchange: string };

/** A service's host and port. */
export type SrvRecord = { readonly priority: number; readonly weight: number; readonly port: number; readonly target: string };

/** The shape of one record of each type: an address or a name as a string, `TXT` as its strings (join them for the whole text). */
export type RecordOf = {
  readonly A: string;
  readonly AAAA: string;
  readonly CNAME: string;
  readonly NS: string;
  readonly MX: MxRecord;
  readonly TXT: readonly string[];
  readonly SRV: SrvRecord;
};

/**
 * Why there is no answer: the name does not exist (NXDOMAIN), it has no record of that type, or the DNS could not be asked (`code` is
 * `ESERVFAIL`, `EREFUSED`, `EFORMERR`, `ENOTIMP` or `ERCODE<n>` for the server's answer, `ETIMEOUT`, `ECANCELLED`, `EBADRESP` for an
 * answer that cannot be read, `EBADNAME`, `ENOSERVERS`, or the host's error code, such as `ECONNREFUSED`).
 */
export type DnsError =
  | { readonly kind: "not-found"; readonly name: string }
  | { readonly kind: "no-data"; readonly name: string; readonly type: RecordType }
  | { readonly kind: "failed"; readonly name: string; readonly code: string; readonly message: string };

/** The server to ask, instead of the system's. */
export type NameServer = { readonly ipAddr: string; readonly port?: number };

/** How to ask. */
export type ResolveDnsOptions = {
  /** The server to ask; the system's where not given. */
  readonly nameServer?: NameServer;
  /** Aborting it gives up (a `failed` error with code `ECANCELLED`). */
  readonly signal?: AbortSignal;
};

const TYPE_CODE: { readonly [K in RecordType]: number } = { A: 1, NS: 2, CNAME: 5, MX: 15, TXT: 16, AAAA: 28, SRV: 33 };
const CLASS_IN = 1;
const OPT = 41;
const UDP_SIZE = 1232;
const TRY_MS = 2000;
const TRIES = 2;
const RCODE: Readonly<Record<number, string>> = { 1: "EFORMERR", 2: "ESERVFAIL", 4: "ENOTIMP", 5: "EREFUSED" };

type Failed = Extract<DnsError, { kind: "failed" }>;

/** A failure that ends the whole query (the caller gave up), as opposed to one where the next try or server may help. */
class Stop extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function u16(n: number): readonly number[] {
  return [(n >> 8) & 0xff, n & 0xff];
}

function encodeName(name: string): number[] | undefined {
  const trimmed = name.endsWith(".") ? name.slice(0, -1) : name;
  if (trimmed === "") return [0];
  const out: number[] = [];
  for (const label of trimmed.split(".")) {
    const bytes = new TextEncoder().encode(label);
    if (bytes.length === 0 || bytes.length > 63) return undefined;
    out.push(bytes.length, ...bytes);
  }
  out.push(0);
  return out.length > 255 ? undefined : out;
}

function query(id: number, qname: readonly number[], qtype: number): Uint8Array {
  return Uint8Array.from([
    ...u16(id),
    0x01,
    0x00, // a standard query, recursion desired
    ...u16(1),
    ...u16(0),
    ...u16(0),
    ...u16(1), // one question, and one additional record: EDNS0's OPT
    ...qname,
    ...u16(qtype),
    ...u16(CLASS_IN),
    0, // the root
    ...u16(OPT),
    ...u16(UDP_SIZE),
    0,
    0,
    0,
    0,
    ...u16(0),
  ]);
}

/** A reader of a DNS message that throws `RangeError` past its end. */
class Message {
  readonly bytes: Uint8Array;
  pos = 0;
  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }
  byte(at = this.pos++): number {
    const b = this.bytes[at];
    if (b === undefined) throw new RangeError("the answer ends early");
    return b;
  }
  u16(): number {
    return (this.byte() << 8) | this.byte();
  }
  u32(): number {
    return ((this.u16() << 16) >>> 0) + this.u16();
  }
  slice(length: number): Uint8Array {
    if (this.pos + length > this.bytes.length) throw new RangeError("the answer ends early");
    const out = this.bytes.subarray(this.pos, this.pos + length);
    this.pos += length;
    return out;
  }
  /** A name, following compression pointers (at most 64 of them, so a loop ends). */
  name(): string {
    const labels: string[] = [];
    let at = this.pos;
    let jumped = false;
    for (let hops = 0; hops < 64;) {
      const len = this.byte(at);
      if (len === 0) {
        if (!jumped) this.pos = at + 1;
        return labels.join(".");
      }
      if ((len & 0xc0) === 0xc0) {
        const target = ((len & 0x3f) << 8) | this.byte(at + 1);
        if (!jumped) this.pos = at + 2;
        jumped = true;
        at = target;
        hops++;
        continue;
      }
      if ((len & 0xc0) !== 0) throw new RangeError("a label type that is not known");
      if (at + 1 + len > this.bytes.length) throw new RangeError("the answer ends early");
      labels.push(new TextDecoder().decode(this.bytes.subarray(at + 1, at + 1 + len)));
      at += 1 + len;
    }
    throw new RangeError("a loop of compressed names");
  }
}

function ipv6(bytes: Uint8Array): string {
  const groups: number[] = [];
  for (let i = 0; i < 16; i += 2) groups.push(((bytes[i] ?? 0) << 8) | (bytes[i + 1] ?? 0));
  // RFC 5952: the longest run of two or more zero groups (the first, on a tie) becomes `::`.
  let best = -1;
  let bestLen = 1;
  for (let i = 0; i < 8;) {
    let j = i;
    while (j < 8 && groups[j] === 0) j++;
    if (j - i > bestLen) {
      best = i;
      bestLen = j - i;
    }
    i = j === i ? i + 1 : j;
  }
  const hex = groups.map((g) => g.toString(16));
  if (best < 0) return hex.join(":");
  return `${hex.slice(0, best).join(":")}::${hex.slice(best + bestLen).join(":")}`;
}

function characterStrings(data: Uint8Array): string[] {
  const out: string[] = [];
  for (let i = 0; i < data.length;) {
    const len = data[i] ?? 0;
    if (i + 1 + len > data.length) throw new RangeError("a TXT string ends early");
    out.push(new TextDecoder().decode(data.subarray(i + 1, i + 1 + len)));
    i += 1 + len;
  }
  return out;
}

type Parse = { readonly [K in RecordType]: (m: Message, length: number) => RecordOf[K] };

const PARSE: Parse = {
  A: (m, length) => {
    if (length !== 4) throw new RangeError("an A record that is not 4 bytes");
    return Array.from(m.slice(4)).join(".");
  },
  AAAA: (m, length) => {
    if (length !== 16) throw new RangeError("an AAAA record that is not 16 bytes");
    return ipv6(m.slice(16));
  },
  CNAME: (m) => m.name(),
  NS: (m) => m.name(),
  MX: (m) => ({ preference: m.u16(), exchange: m.name() }),
  TXT: (m, length) => characterStrings(m.slice(length)),
  SRV: (m) => ({ priority: m.u16(), weight: m.u16(), port: m.u16(), target: m.name() }),
};

type Answer<T extends RecordType> =
  | { readonly kind: "records"; readonly records: RecordOf[T][] }
  | { readonly kind: "nxdomain" }
  | { readonly kind: "rcode"; readonly rcode: number }
  | { readonly kind: "truncated" }
  | { readonly kind: "not-ours" };

function parseAnswer<T extends RecordType>(bytes: Uint8Array, id: number, qname: string, type: T): Answer<T> {
  const m = new Message(bytes);
  if (m.u16() !== id) return { kind: "not-ours" };
  const flags = m.u16();
  if ((flags & 0x8000) === 0) return { kind: "not-ours" };
  const qd = m.u16();
  const an = m.u16();
  m.u16();
  m.u16();
  for (let i = 0; i < qd; i++) {
    const name = m.name();
    const qtype = m.u16();
    m.u16();
    if (name.toLowerCase() !== qname.toLowerCase() || qtype !== TYPE_CODE[type]) return { kind: "not-ours" };
  }
  if ((flags & 0x0200) !== 0) return { kind: "truncated" };
  const rcode = flags & 0x0f;
  if (rcode === 3) return { kind: "nxdomain" };
  if (rcode !== 0) return { kind: "rcode", rcode };
  const parse: (m: Message, length: number) => RecordOf[T] = PARSE[type];
  const records: RecordOf[T][] = [];
  for (let i = 0; i < an; i++) {
    m.name();
    const rtype = m.u16();
    const rclass = m.u16();
    m.u32();
    const length = m.u16();
    const end = m.pos + length;
    if (end > bytes.length) throw new RangeError("the answer ends early");
    if (rtype === TYPE_CODE[type] && rclass === CLASS_IN) records.push(parse(m, length));
    m.pos = end;
  }
  return { kind: "records", records };
}

type Server = { readonly host: string; readonly port: number };

function systemServers(): Server[] {
  const seen = new Set<string>();
  const out: Server[] = [];
  for (const s of getServers()) {
    let server: Server;
    const v6 = /^\[(.+)\]:(\d+)$/.exec(s);
    const v4 = /^([\d.]+):(\d+)$/.exec(s);
    if (v6?.[1] !== undefined && v6[2] !== undefined) server = { host: v6[1], port: Number(v6[2]) };
    else if (v4?.[1] !== undefined && v4[2] !== undefined) server = { host: v4[1], port: Number(v4[2]) };
    else server = { host: s, port: 53 };
    const key = `${server.host} ${server.port}`;
    if (seen.has(key) || net.isIP(server.host) === 0) continue;
    seen.add(key);
    out.push(server);
  }
  return out;
}

function randomId(): number {
  const b = new Uint16Array(1);
  crypto.getRandomValues(b);
  return b[0] ?? 0;
}

/** Wait for `start` to settle, or for the try's time, or for the signal; `cleanup` runs once whatever happens. */
function attempt<A>(signal: AbortSignal | undefined, start: (settle: (a: A) => void, fail: (e: Error) => void) => () => void): Promise<A> {
  return new Promise<A>((resolve, reject) => {
    let cleanup = (): void => undefined;
    let done = false;
    const finish = (f: () => void): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      cleanup();
      f();
    };
    const onAbort = (): void => finish(() => reject(new Stop("ECANCELLED", "the query was aborted")));
    const timer = setTimeout(
      () => finish(() => reject(Object.assign(new Error("the server did not answer in time"), { code: "ETIMEOUT" }))),
      TRY_MS,
    );
    signal?.addEventListener("abort", onAbort, { once: true });
    cleanup = start(
      (a) => finish(() => resolve(a)),
      (e) => finish(() => reject(e)),
    );
  });
}

function askUdp<T extends RecordType>(server: Server, qname: string, type: T, signal: AbortSignal | undefined): Promise<Answer<T>> {
  const id = randomId();
  const encoded = encodeName(qname) ?? [0];
  return attempt(signal, (settle, fail) => {
    const socket = dgram.createSocket(net.isIPv6(server.host) ? "udp6" : "udp4");
    socket.on("error", fail);
    socket.on("message", (msg: Uint8Array, from) => {
      if (from.port !== server.port) return;
      try {
        const answer = parseAnswer(msg, id, qname, type);
        if (answer.kind !== "not-ours") settle(answer);
      } catch (e) {
        fail(Object.assign(new Error(`the answer cannot be read: ${e instanceof Error ? e.message : String(e)}`), { code: "EBADRESP" }));
      }
    });
    socket.send(query(id, encoded, TYPE_CODE[type]), server.port, server.host);
    return () => socket.close();
  });
}

function askTcp<T extends RecordType>(server: Server, qname: string, type: T, signal: AbortSignal | undefined): Promise<Answer<T>> {
  const id = randomId();
  const q = query(id, encodeName(qname) ?? [0], TYPE_CODE[type]);
  return attempt(signal, (settle, fail) => {
    const socket = net.connect({ host: server.host, port: server.port });
    let buffered = new Uint8Array(0);
    socket.on("error", fail);
    socket.on("connect", () => socket.write(Uint8Array.from([...u16(q.length), ...q])));
    socket.on("data", (chunk: Uint8Array) => {
      const next = new Uint8Array(buffered.length + chunk.length);
      next.set(buffered);
      next.set(chunk, buffered.length);
      buffered = next;
      if (buffered.length < 2) return;
      const length = ((buffered[0] ?? 0) << 8) | (buffered[1] ?? 0);
      if (buffered.length < 2 + length) return;
      try {
        const answer = parseAnswer(buffered.subarray(2, 2 + length), id, qname, type);
        if (answer.kind === "not-ours" || answer.kind === "truncated")
          fail(Object.assign(new Error("an answer that is not ours"), { code: "EBADRESP" }));
        else settle(answer);
      } catch (e) {
        fail(Object.assign(new Error(`the answer cannot be read: ${e instanceof Error ? e.message : String(e)}`), { code: "EBADRESP" }));
      }
    });
    return () => socket.destroy();
  });
}

function failure(name: string, e: unknown): Failed {
  const code: unknown = typeof e === "object" && e !== null ? Reflect.get(e, "code") : undefined;
  return { kind: "failed", name, code: typeof code === "string" ? code : "", message: e instanceof Error ? e.message : String(e) };
}

/** The records of a type for a name, or why there are none. */
export async function resolveDns<T extends RecordType>(
  name: string,
  type: T,
  options: ResolveDnsOptions = {},
): Promise<Result<readonly RecordOf[T][], DnsError>> {
  const { signal, nameServer } = options;
  const qname = name.endsWith(".") ? name.slice(0, -1) : name;
  if (signal?.aborted === true) return err({ kind: "failed", name, code: "ECANCELLED", message: "the query was aborted" });
  if (encodeName(qname) === undefined) return err({ kind: "failed", name, code: "EBADNAME", message: `not a domain name: ${name}` });
  const servers = nameServer === undefined ? systemServers() : [{ host: nameServer.ipAddr, port: nameServer.port ?? 53 }];
  let last: Failed = { kind: "failed", name, code: "ENOSERVERS", message: "no DNS server is configured" };
  for (const server of servers) {
    for (let t = 0; t < TRIES; t++) {
      try {
        let answer = await askUdp(server, qname, type, signal);
        if (answer.kind === "truncated") answer = await askTcp(server, qname, type, signal);
        switch (answer.kind) {
          case "records":
            return answer.records.length === 0 ? err({ kind: "no-data", name, type }) : ok(answer.records);
          case "nxdomain":
            return err({ kind: "not-found", name });
          case "rcode": {
            const code = RCODE[answer.rcode] ?? `ERCODE${answer.rcode}`;
            last = { kind: "failed", name, code, message: `the server at ${server.host} answered ${code}` };
            t = TRIES; // the next server, not the same one again
            break;
          }
          case "truncated":
          case "not-ours":
            last = { kind: "failed", name, code: "EBADRESP", message: "the server's answer could not be used" };
            break;
          default:
            return absurd(answer);
        }
      } catch (e) {
        if (e instanceof Stop) return err({ kind: "failed", name, code: e.code, message: e.message });
        last = failure(name, e);
      }
    }
  }
  return err(last);
}

/** One address of one network interface. */
export type NetworkInterfaceInfo = {
  /** The interface's name (`lo`, `eth0`, `en0`, `Ethernet`). */
  readonly name: string;
  /** The address's family. */
  readonly family: "IPv4" | "IPv6";
  /** The address. */
  readonly address: string;
  /** Its netmask. */
  readonly netmask: string;
  /** The address with its prefix length (`127.0.0.1/8`), where known. */
  readonly cidr: string | null;
  /** The IPv6 scope, where there is one. */
  readonly scopeid: number | null;
  /** The hardware address (`00:00:00:00:00:00` where there is none). */
  readonly mac: string;
  /** Whether it is internal (a loopback), not reachable from outside. */
  readonly internal: boolean;
};

/** Every address of every network interface of this computer (`proc.networkInterfaces()`). */
export function networkInterfaces(): readonly NetworkInterfaceInfo[] {
  const out: NetworkInterfaceInfo[] = [];
  for (const [name, infos] of Object.entries(os.networkInterfaces())) {
    for (const i of infos ?? []) {
      out.push({
        name,
        family: net.isIPv6(i.address) ? "IPv6" : "IPv4",
        address: i.address,
        netmask: i.netmask,
        cidr: i.cidr,
        scopeid: i.family === "IPv6" ? i.scopeid : null,
        mac: i.mac,
        internal: i.internal,
      });
    }
  }
  return out;
}
