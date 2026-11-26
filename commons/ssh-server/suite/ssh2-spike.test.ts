/**
 * The behaviours of ssh2 that the server stands on, proved with the real OpenSSH client on a small server of the test: a signed key is verified and an unsigned one is a query, the client banner is read, a stream of 5 MB arrives whole, a two-way dialogue works, and the exit status and standard error come through.
 * This file is a test and may use ssh2 (a test of the library is not the library).
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { spawn } from "node:child_process";
import ssh2 from "ssh2";
import { keyPair, temp, withKey } from "./helpers.ts";

const { Server, utils } = ssh2;

type Seen = { ident: string; ip: string; methods: string[]; signed: boolean[]; verified: boolean[] };

async function mini(): Promise<{ port: number; seen: Seen; close: () => Promise<void> }> {
  const pair = utils.generateKeyPairSync("ed25519");
  const seen: Seen = { ident: "", ip: "", methods: [], signed: [], verified: [] };
  const server = new Server({ hostKeys: [pair.private] }, (client, info) => {
    seen.ident = String(info.header.identRaw);
    seen.ip = info.ip;
    client.on("authentication", (ctx) => {
      seen.methods.push(ctx.method);
      if (ctx.method === "none") return ctx.reject(["publickey"]);
      if (ctx.method !== "publickey") return ctx.reject(["publickey"]);
      seen.signed.push(ctx.signature !== undefined);
      if (ctx.signature === undefined) return ctx.accept();
      const k = utils.parseKey(`${ctx.key.algo} ${ctx.key.data.toString("base64")}`);
      const ok = !(k instanceof Error) && !Array.isArray(k) && k.verify(ctx.blob as Buffer, ctx.signature, ctx.hashAlgo) === true;
      seen.verified.push(ok);
      return ok ? ctx.accept() : ctx.reject();
    });
    client.on("ready", () => {
      client.on("session", (accept) => {
        const session = accept();
        session.on("exec", (acceptExec, _r, e) => {
          const ch = acceptExec();
          if (e.command === "big") {
            ch.write(Buffer.alloc(5 * 1024 * 1024, 97));
            ch.exit(0);
            ch.end();
          } else if (e.command === "dialogue") {
            let n = 0;
            let buf = "";
            ch.write("HELLO\n");
            ch.on("data", (d: Buffer) => {
              buf += d.toString();
              let i: number;
              while ((i = buf.indexOf("\n")) >= 0) {
                const line = buf.slice(0, i);
                buf = buf.slice(i + 1);
                n += 1;
                ch.write(`ACK ${n} ${line}\n`);
                if (line === "bye") { ch.exit(0); ch.end(); }
              }
            });
          } else {
            ch.write(`you sent: ${e.command}\n`);
            ch.stderr.write("note on stderr\n");
            ch.exit(7);
            ch.end();
          }
        });
      });
    });
    client.on("error", () => {});
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address() as { port: number };
  return { port: addr.port, seen, close: () => new Promise((r) => server.close(() => r())) };
}

function run(port: number, args: string[], input = ""): Promise<{ code: number | null; stdout: Buffer; stderr: string }> {
  return new Promise((resolve) => {
    const c = spawn("ssh", ["-p", String(port), ...args], { stdio: ["pipe", "pipe", "pipe"] });
    const out: Buffer[] = [];
    let stderr = "";
    c.stdout.on("data", (d: Buffer) => out.push(d));
    c.stderr.on("data", (d: Buffer) => (stderr += d));
    c.on("close", (code) => resolve({ code, stdout: Buffer.concat(out), stderr }));
    c.stdin.on("error", () => {});
    c.stdin.end(input);
  });
}

proves(["0001-ssh-server-layers FR-005"], "ssh2 on this runtime: the client banner, an unsigned query and a signed proof, a stream of 5 MB, a two-way dialogue, exit status and standard error", async () => {
  const t = await temp();
  const s = await mini();
  try {
    const key = await keyPair(t.dir, "synthetic-spike-key");
    const base = [...withKey(key.path), "-o", "BatchMode=yes", "s@127.0.0.1"];
    const hello = await run(s.port, [...base, "anything"]);
    assertEquals(hello.code, 7);
    assertEquals(hello.stdout.toString(), "you sent: anything\n");
    assertEquals(hello.stderr.includes("note on stderr"), true);
    assert(s.seen.ident.startsWith("SSH-2.0-OpenSSH"), s.seen.ident);
    assertEquals(s.seen.ip === "127.0.0.1" || s.seen.ip === "::ffff:127.0.0.1", true);
    assertEquals(s.seen.signed, [false, true], "a query without a signature, then the signed proof");
    assertEquals(s.seen.verified, [true]);
    const big = await run(s.port, [...base, "big"]);
    assertEquals(big.code, 0);
    assertEquals(big.stdout.length, 5 * 1024 * 1024);
    const talk = await run(s.port, [...base, "dialogue"], "one\ntwo\nbye\n");
    assertEquals(talk.stdout.toString(), "HELLO\nACK 1 one\nACK 2 two\nACK 3 bye\n");
  } finally {
    await s.close();
    await t.done();
  }
});
