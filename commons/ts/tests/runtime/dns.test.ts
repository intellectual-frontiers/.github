/**
 * Tests of `runtime/dns.ts` (commons 0005-typescript-runtime FR-056), with no Internet: a small DNS server on a free UDP port of 127.0.0.1,
 * made here on `node:dgram`, answers from a fixed zone, and `resolveDns` is pointed at it by `nameServer`. Each record type comes back in
 * `Deno.resolveDns`'s shape; a name that does not exist, a name without the record asked for, a server failure and a server that does not
 * answer each give their own error; TXT strings round-trip whatever they hold; and the interface list has a loopback.
 *
 * @module
 */
import { Buffer } from "node:buffer";
import * as dgram from "node:dgram";
import * as net from "node:net";
import fc from "fast-check";
import { type NetworkInterfaceInfo, networkInterfaces, resolveDns } from "../../runtime/dns.ts";
import { assert, assertEquals, proves } from "../../runtime/test.ts";

const DNS = "0005-typescript-runtime FR-056";

type Answer = { readonly type: number; readonly data: Uint8Array };
type Zone = (name: string, type: number) => { readonly rcode: number; readonly answers: readonly Answer[] };

const T = { A: 1, NS: 2, CNAME: 5, MX: 15, TXT: 16, AAAA: 28, SRV: 33 } as const;

function encodeName(name: string): Uint8Array {
  const parts = name.split(".").filter((p) => p !== "");
  return Buffer.concat([...parts.map((p) => Buffer.concat([Buffer.from([p.length]), Buffer.from(p, "ascii")])), Buffer.from([0])]);
}

function u16(n: number): Uint8Array {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(n);
  return b;
}

const rdata = {
  a: (ip: string): Answer => ({ type: T.A, data: Uint8Array.from(ip.split(".").map(Number)) }),
  aaaa: (words: readonly number[]): Answer => ({ type: T.AAAA, data: Buffer.concat(words.map(u16)) }),
  name: (type: number, name: string): Answer => ({ type, data: encodeName(name) }),
  mx: (preference: number, exchange: string): Answer => ({ type: T.MX, data: Buffer.concat([u16(preference), encodeName(exchange)]) }),
  txt: (strings: readonly string[]): Answer => {
    const bytes = strings.map((s) => Buffer.from(s, "utf8"));
    return { type: T.TXT, data: Buffer.concat(bytes.map((b) => Buffer.concat([Buffer.from([b.length]), b]))) };
  },
  srv: (priority: number, weight: number, port: number, target: string): Answer => ({
    type: T.SRV,
    data: Buffer.concat([u16(priority), u16(weight), u16(port), encodeName(target)]),
  }),
};

const NOERROR = 0;
const SERVFAIL = 2;
const NXDOMAIN = 3;

function answerTo(query: Buffer, zone: Zone): Buffer | undefined {
  if (query.length < 17) return undefined;
  let i = 12;
  const labels: string[] = [];
  while (i < query.length && query[i] !== 0) {
    const len = query[i] ?? 0;
    labels.push(query.subarray(i + 1, i + 1 + len).toString("ascii"));
    i += len + 1;
  }
  const end = i + 5;
  if (end > query.length) return undefined;
  const type = query.readUInt16BE(i + 1);
  const { rcode, answers } = zone(labels.join(".").toLowerCase(), type);
  const header = Buffer.alloc(12);
  query.copy(header, 0, 0, 2);
  header.writeUInt16BE(0x8180 | rcode, 2);
  header.writeUInt16BE(1, 4);
  header.writeUInt16BE(answers.length, 6);
  const records = answers.map((a) =>
    Buffer.concat([u16(0xc00c), u16(a.type), u16(1), Buffer.from([0, 0, 0, 60]), u16(a.data.length), a.data]),
  );
  return Buffer.concat([header, query.subarray(12, end), ...records]);
}

/**
 * A DNS server on a free UDP port of 127.0.0.1 answering from `zone`; with `truncate`, it answers over UDP only that the answer is too
 * long (the TC bit) and gives it whole over TCP on the same port. `await using` stops it.
 */
async function dnsServer(zone: Zone, truncate = false): Promise<{ readonly port: number; [Symbol.asyncDispose](): Promise<void> }> {
  for (let tries = 0; ; tries++) {
    const socket = dgram.createSocket("udp4");
    socket.on("message", (msg, from) => {
      const reply = answerTo(msg, truncate ? () => ({ rcode: NOERROR, answers: [] }) : zone);
      if (reply === undefined) return;
      if (truncate) reply.writeUInt16BE(reply.readUInt16BE(2) | 0x0200, 2);
      socket.send(reply, from.port, from.address);
    });
    await new Promise<void>((resolve) => socket.bind(0, "127.0.0.1", resolve));
    const port = socket.address().port;
    const closeUdp = (): Promise<void> => new Promise<void>((resolve) => socket.close(() => resolve()));
    if (!truncate) return { port, [Symbol.asyncDispose]: closeUdp };
    const tcp = net.createServer((conn) => {
      let buffered = Buffer.alloc(0);
      conn.on("error", () => undefined);
      conn.on("data", (chunk: Buffer) => {
        buffered = Buffer.concat([buffered, chunk]);
        if (buffered.length < 2 || buffered.length < 2 + buffered.readUInt16BE(0)) return;
        const reply = answerTo(buffered.subarray(2, 2 + buffered.readUInt16BE(0)), zone);
        if (reply !== undefined) conn.end(Buffer.concat([u16(reply.length), reply]));
      });
    });
    const bound = await new Promise<boolean>((resolve) => {
      tcp.once("error", () => resolve(false));
      tcp.listen(port, "127.0.0.1", () => resolve(true));
    });
    if (bound) {
      return {
        port,
        [Symbol.asyncDispose]: async () => {
          await closeUdp();
          await new Promise<void>((resolve) => tcp.close(() => resolve()));
        },
      };
    }
    await closeUdp();
    if (tries > 20) throw new Error("no port free for both UDP and TCP");
  }
}

const ZONE: Zone = (name, type) => {
  const records: Readonly<Record<string, readonly Answer[]>> = {
    "mail.example.test": [
      rdata.a("192.0.2.1"),
      rdata.a("192.0.2.2"),
      rdata.aaaa([0x2001, 0xdb8, 0, 0, 0, 0, 0, 1]),
      rdata.mx(10, "mx1.example.test"),
      rdata.mx(20, "mx2.example.test"),
      rdata.txt(["v=spf1 -all"]),
      rdata.txt(["part one ", "part two"]),
      rdata.name(T.NS, "ns1.example.test"),
    ],
    "www.example.test": [rdata.name(T.CNAME, "mail.example.test")],
    "_sip._tcp.example.test": [rdata.srv(10, 60, 5060, "sip.example.test")],
  };
  if (name === "broken.example.test") return { rcode: SERVFAIL, answers: [] };
  const all = records[name];
  if (all === undefined) return { rcode: NXDOMAIN, answers: [] };
  return { rcode: NOERROR, answers: all.filter((a) => a.type === type) };
};

const sorted = <A>(xs: readonly A[]): A[] => [...xs].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

proves([DNS], "A, AAAA, CNAME, MX, NS, TXT and SRV records come back in the shapes Deno's resolver gave", async () => {
  await using server = await dnsServer(ZONE);
  const nameServer = { ipAddr: "127.0.0.1", port: server.port };
  const a = await resolveDns("mail.example.test", "A", { nameServer });
  assertEquals(a.kind === "ok" ? sorted(a.value) : a, ["192.0.2.1", "192.0.2.2"]);
  assertEquals(await resolveDns("mail.example.test", "AAAA", { nameServer }), { kind: "ok", value: ["2001:db8::1"] });
  assertEquals(await resolveDns("www.example.test", "CNAME", { nameServer }), { kind: "ok", value: ["mail.example.test"] });
  assertEquals(await resolveDns("mail.example.test", "NS", { nameServer }), { kind: "ok", value: ["ns1.example.test"] });
  const mx = await resolveDns("mail.example.test", "MX", { nameServer });
  assertEquals(mx.kind === "ok" ? sorted(mx.value) : mx, [
    { preference: 10, exchange: "mx1.example.test" },
    { preference: 20, exchange: "mx2.example.test" },
  ]);
  const txt = await resolveDns("mail.example.test", "TXT", { nameServer });
  assertEquals(txt.kind === "ok" ? sorted(txt.value) : txt, [["part one ", "part two"], ["v=spf1 -all"]]);
  assertEquals(await resolveDns("_sip._tcp.example.test", "SRV", { nameServer }), {
    kind: "ok",
    value: [{ priority: 10, weight: 60, port: 5060, target: "sip.example.test" }],
  });
});

proves([DNS], "a name that does not exist, a name without the record, a server failure and an aborted query each say so", async () => {
  await using server = await dnsServer(ZONE);
  const nameServer = { ipAddr: "127.0.0.1", port: server.port };
  assertEquals(await resolveDns("nonexistent.example", "MX", { nameServer }), {
    kind: "err",
    error: { kind: "not-found", name: "nonexistent.example" },
  });
  assertEquals(await resolveDns("mail.example.test", "SRV", { nameServer }), {
    kind: "err",
    error: { kind: "no-data", name: "mail.example.test", type: "SRV" },
  });
  const broken = await resolveDns("broken.example.test", "A", { nameServer });
  assert(broken.kind === "err" && broken.error.kind === "failed" && broken.error.code === "ESERVFAIL", JSON.stringify(broken));
  const aborted = await resolveDns("mail.example.test", "A", { nameServer, signal: AbortSignal.abort() });
  assert(aborted.kind === "err" && aborted.error.kind === "failed" && aborted.error.code === "ECANCELLED", JSON.stringify(aborted));
});

proves([DNS], "an answer too long for UDP is asked again over TCP", async () => {
  const many = Array.from({ length: 40 }, (_, i) => rdata.txt([`record ${i} ${"x".repeat(60)}`]));
  await using server = await dnsServer((name, type) => (type === T.TXT ? { rcode: NOERROR, answers: many } : ZONE(name, type)), true);
  const r = await resolveDns("long.example.test", "TXT", { nameServer: { ipAddr: "127.0.0.1", port: server.port } });
  assertEquals(r.kind === "ok" ? r.value.length : r, 40);
  assertEquals(r.kind === "ok" ? r.value[39] : r, [`record 39 ${"x".repeat(60)}`]);
});

proves([DNS], "a query that does not come back is given up when its signal aborts: failed, not thrown", async () => {
  const socket = dgram.createSocket("udp4");
  socket.on("message", () => undefined); // reads every query, answers none
  await new Promise<void>((resolve) => socket.bind(0, "127.0.0.1", resolve));
  try {
    const r = await resolveDns("mail.example.test", "TXT", {
      nameServer: { ipAddr: "127.0.0.1", port: socket.address().port },
      signal: AbortSignal.timeout(100),
    });
    assert(r.kind === "err" && r.error.kind === "failed", JSON.stringify(r));
  } finally {
    await new Promise<void>((resolve) => socket.close(() => resolve()));
  }
});

proves([DNS], "TXT strings round-trip, whatever printable text and however many strings a record holds", async () => {
  const text = fc.string({ minLength: 0, maxLength: 60 }).filter((s) => /^[\x20-\x7e]*$/.test(s));
  await fc.assert(
    fc.asyncProperty(fc.array(text, { minLength: 1, maxLength: 4 }), async (strings) => {
      await using server = await dnsServer((name, type) =>
        name === "t.example.test" && type === T.TXT ? { rcode: NOERROR, answers: [rdata.txt(strings)] } : { rcode: NXDOMAIN, answers: [] },
      );
      const r = await resolveDns("t.example.test", "TXT", { nameServer: { ipAddr: "127.0.0.1", port: server.port } });
      assertEquals(r, { kind: "ok", value: [strings] });
    }),
    { numRuns: 25 },
  );
});

proves([DNS], "AAAA addresses are written as RFC 5952 says (the URL standard's form): lower case, the longest zero run as ::", async () => {
  const group = fc.oneof(fc.constant(0), fc.integer({ min: 0, max: 0xffff }));
  await fc.assert(
    fc.asyncProperty(fc.array(group, { minLength: 8, maxLength: 8 }), async (words) => {
      await using server = await dnsServer(() => ({ rcode: NOERROR, answers: [rdata.aaaa(words)] }));
      const r = await resolveDns("v6.example.test", "AAAA", { nameServer: { ipAddr: "127.0.0.1", port: server.port } });
      const expected = new URL(`http://[${words.map((w) => w.toString(16)).join(":")}]/`).hostname.slice(1, -1);
      assertEquals(r, { kind: "ok", value: [expected] });
    }),
    { numRuns: 25 },
  );
});

proves([DNS], "networkInterfaces gives each address's name, family, address, netmask and internal, a loopback among them", () => {
  const all = networkInterfaces();
  const loopback = all.filter((i: NetworkInterfaceInfo) => i.internal);
  assert(
    loopback.some((i) => i.address === "127.0.0.1" || i.address === "::1"),
    `a loopback: ${JSON.stringify(all)}`,
  );
  for (const i of all) {
    assert(i.name !== "");
    assert(i.family === "IPv4" ? i.address.includes(".") : i.address.includes(":"), JSON.stringify(i));
    assert(i.netmask !== "");
    assertEquals(typeof i.internal, "boolean");
  }
});
