// Spec: 0047-arcactl-init FR-008
/**
 * Servers for tests that need a real client on a real socket: a server that asks for a password (cleartext) and keeps what it was given, so that the real libpq of `psql` can be seen reading
 * `.pgpass`; and PGlite served on a TCP port, which `psql`, Bun's client and `pg` connect to. Both listen on 127.0.0.1 and are closed by the test.
 *
 * @module
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createServer, type Server, type Socket } from "node:net";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

/** A port nothing is using. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const a = s.address();
      s.close(() => (a !== null && typeof a === "object" ? resolve(a.port) : reject(new Error("no port"))));
    });
    s.on("error", reject);
  });
}

/** What the password server was given by one connection. */
export interface Seen {
  readonly user: string;
  readonly database: string;
  readonly password: string | undefined;
}

/**
 * Waits until the password server has recorded `count` connections. A client that is given no password gives up and exits, and the server records that connection when it sees the socket close, which can be
 * after the client's process has ended where the machine is busy, so a test that reads `seen` right after `psql` returns must wait for it.
 */
export async function settled(seen: readonly Seen[], count: number, ms = 10_000): Promise<void> {
  const until = Date.now() + ms;
  while (seen.length < count && Date.now() < until) await new Promise((r) => setTimeout(r, 10));
}

/** A server that asks every client for a cleartext password, records it, and refuses the query that follows. */
export async function passwordServer(): Promise<{ readonly port: number; readonly seen: Seen[]; close(): Promise<void> }> {
  const seen: Seen[] = [];
  const sockets = new Set<Socket>();
  const server: Server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => undefined);
    let buf = Buffer.alloc(0);
    let phase: "startup" | "password" | "query" = "startup";
    let params: Record<string, string> = {};
    const send = (type: string, body: Buffer): void => {
      const head = Buffer.alloc(5);
      head.write(type, 0, "latin1");
      head.writeInt32BE(body.length + 4, 1);
      socket.write(Buffer.concat([head, body]));
    };
    const int = (n: number): Buffer => {
      const b = Buffer.alloc(4);
      b.writeInt32BE(n);
      return b;
    };
    socket.on("data", (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        if (phase === "startup") {
          if (buf.length < 8) return;
          const len = buf.readInt32BE(0);
          if (buf.length < len) return;
          const code = buf.readInt32BE(4);
          const rest = buf.subarray(8, len);
          buf = buf.subarray(len);
          if (code === 80877103 || code === 80877104) {
            socket.write("N");
            continue;
          }
          const parts = rest.toString("utf8").split("\0");
          params = {};
          for (let i = 0; i + 1 < parts.length; i += 2) if (parts[i] !== "") params[parts[i] as string] = parts[i + 1] as string;
          phase = "password";
          send("R", int(3));
        } else {
          if (buf.length < 5) return;
          const type = String.fromCharCode(buf[0] as number);
          const len = buf.readInt32BE(1);
          if (buf.length < len + 1) return;
          const body = buf.subarray(5, len + 1);
          buf = buf.subarray(len + 1);
          if (phase === "password" && type === "p") {
            seen.push({ user: params["user"] ?? "", database: params["database"] ?? params["user"] ?? "", password: body.toString("utf8").replace(/\0$/, "") });
            phase = "query";
            send("R", int(0));
            send("Z", Buffer.from("I"));
          } else if (type === "Q") {
            send("E", Buffer.from("SERROR\0VERROR\0C0A000\0Mthis server only asks for a password\0\0"));
            send("Z", Buffer.from("I"));
          } else if (type === "X") socket.end();
        }
      }
    });
    socket.on("close", () => {
      if (phase === "password") seen.push({ user: params["user"] ?? "", database: params["database"] ?? params["user"] ?? "", password: undefined });
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const a = server.address();
  const port = a !== null && typeof a === "object" ? a.port : 0;
  return {
    port,
    seen,
    close: () =>
      new Promise((resolve) => {
        for (const s of sockets) s.destroy();
        server.close(() => resolve());
      }),
  };
}

/** PGlite on a TCP port. `statements` are run first, in order. */
export async function pgliteServer(statements: readonly string[] = []): Promise<{ readonly port: number; readonly db: PGlite; close(): Promise<void> }> {
  const db = await PGlite.create();
  for (const s of statements) await db.exec(s);
  const port = await freePort();
  const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 8 });
  await server.start();
  return {
    port,
    db,
    close: async () => {
      await server.stop();
      await db.close();
    },
  };
}

/** Runs a program without blocking this process (a server in it has to answer while the program runs), and gives what it wrote. */
export function run(command: string, args: readonly string[], env: Readonly<Record<string, string>>, input?: string, timeoutMs = 30000, cwd?: string): Promise<{ readonly code: number; readonly out: string; readonly err: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, [...args], { env: { ...env }, stdio: ["pipe", "pipe", "pipe"], ...(cwd === undefined ? {} : { cwd }) });
    let out = "";
    let err = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString("utf8")));
    child.stderr.on("data", (d: Buffer) => (err += d.toString("utf8")));
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, out, err });
    });
    child.stdin.on("error", () => undefined); // a program that exits before it reads its input closes the pipe: EPIPE is not a failure of the run
    child.stdin.end(input ?? "");
  });
}

/** A program on the PATH of this process, where there is one. */
export function which(command: string): string | undefined {
  for (const d of (process.env["PATH"] ?? "").split(process.platform === "win32" ? ";" : ":")) if (d !== "" && existsSync(join(d, command))) return join(d, command);
  return undefined;
}

/** Bun, which the tests run on or find on the PATH (the suite also runs on Node, where the tests that need Bun look for it). */
export function bunPath(): string {
  const found = (globalThis as { Bun?: unknown }).Bun !== undefined ? process.execPath : which("bun");
  if (found === undefined) throw new Error("this test needs bun, which is neither running it nor on the PATH");
  return found;
}

/** Whether this test is running on Bun. */
export const onBun = (): boolean => (globalThis as { Bun?: unknown }).Bun !== undefined;
