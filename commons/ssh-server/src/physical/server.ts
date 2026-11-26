// Spec: 0003-server-policy FR-001, FR-002, FR-003, FR-004, FR-006, FR-008, FR-012, FR-013
/**
 * The enrollment server on ssh2: the only code that speaks the protocol. It accepts one username, proves a public key only by its verified signature, gives no shell, no pty, no forwarding, no subsystem and no environment, runs one command of the registry
 * a connection, and decides nothing itself: every decision is a function of the logical layer, and this code collects the inputs, calls it and applies its effects to the store.
 *
 * @module
 */
import { createHash, randomBytes } from "node:crypto";
import { reverse } from "node:dns/promises";
import { readFile } from "node:fs/promises";
import ssh2 from "ssh2";
import type { AuthContext, Connection, ServerChannel, Session } from "ssh2";
import { DEFAULT_SERVER_POLICY, PERSON_DECIDES, accountOf } from "@intellectual-frontiers/ssh-server/governance";
import type { AuditEvent, ChainedEvent, EnrollPolicy, EnrollmentSession, Facts, Fingerprint, HostKey, InstallPlan, OfferedKey, ServerPolicy, SessionId, ServiceAccount } from "@intellectual-frontiers/ssh-server/governance";
import {
  CLEAN,
  OSQUERY_PINS,
  authDecision,
  chainNext,
  blocked,
  builtinRegistry,
  checkCidrs,
  commandOf,
  defaultPlan,
  forgive,
  fullBucket,
  runCommand,
  sourceAllowed,
  strike,
  take,
} from "@intellectual-frontiers/ssh-server/logical";
import type { AuthAttempt, Bucket, CommandContext, CryptoPort, Effect, Penalty, Pin, Registry } from "@intellectual-frontiers/ssh-server/logical";
import { fingerprintOfBlob, fingerprintOfLine, loadOrCreateHostKey } from "./hostkey.ts";
import type { EnrollStore } from "./store.ts";

/** What the server looks up about a connection that a person may want to see on a `knock`. Both are best effort and may be replaced. */
export type Lookup = {
  readonly reverseDns: (ip: string) => Promise<string | undefined>;
  readonly neighbourMac: (ip: string) => Promise<string | undefined>;
};

/** The options of the server. */
export type EnrollServerOptions = {
  readonly port?: number;
  readonly host?: string;
  readonly hostKeyPath: string;
  readonly policy?: Partial<ServerPolicy>;
  readonly enroll?: EnrollPolicy;
  readonly store: EnrollStore;
  readonly clock?: () => number;
  readonly onEvent?: (event: AuditEvent) => void;
  readonly registry?: Registry;
  readonly pins?: readonly Pin[];
  readonly planFor?: (facts: Facts) => InstallPlan;
  readonly lookup?: Lookup;
  /** The address of a peer as the server judges it. Identity by default; a deployment behind a proxy that says the true address (and a test) replaces it. */
  readonly peerAddress?: (socketAddress: string) => string;
};

/** A running server. */
export type EnrollServer = {
  readonly address: { readonly host: string; readonly port: number };
  readonly hostKey: HostKey;
  readonly policy: ServerPolicy;
  connections(): number;
  close(): Promise<void>;
};

const { Server, utils } = ssh2;
const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";

/** A new session id: `en-` and 16 characters of base32 from 10 random bytes. */
export function newSessionId(): SessionId {
  const bytes = randomBytes(10);
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return `en-${out}` as SessionId;
}

/** The default lookups: reverse DNS with a timeout, and the neighbour table of Linux (`/proc/net/arp`) where it exists. */
export const DEFAULT_LOOKUP: Lookup = {
  reverseDns: async (ip) => {
    const timeout = new Promise<undefined>((r) => setTimeout(() => r(undefined), 1500).unref());
    const names = await Promise.race([reverse(ip).catch(() => undefined), timeout]);
    return names?.[0]?.slice(0, 253);
  },
  neighbourMac: async (ip) => {
    try {
      const table = await readFile("/proc/net/arp", "utf8");
      for (const row of table.split("\n").slice(1)) {
        const f = row.trim().split(/\s+/);
        if (f[0] === ip && /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(f[3] ?? "") && f[3] !== "00:00:00:00:00:00") return (f[3] as string).toLowerCase();
      }
    } catch {
      /* no neighbour table here */
    }
    return undefined;
  },
};

function normaliseIp(ip: string | undefined): string {
  if (ip === undefined) return "0.0.0.0";
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

/** Start the enrollment server. Resolves once it listens. */
export async function createEnrollServer(options: EnrollServerOptions): Promise<EnrollServer> {
  const policy: ServerPolicy = { ...DEFAULT_SERVER_POLICY, ...options.policy };
  const cidrs = checkCidrs(policy.allowCidrs);
  if (cidrs.kind === "err") throw new Error(cidrs.error);
  const clock = options.clock ?? Date.now;
  const enroll = options.enroll ?? PERSON_DECIDES;
  const registry = options.registry ?? builtinRegistry();
  const pins = options.pins ?? OSQUERY_PINS;
  const planFor = options.planFor ?? ((facts: Facts) => defaultPlan(facts, pins));
  const lookup = options.lookup ?? DEFAULT_LOOKUP;
  const store = options.store;
  const loaded = await loadOrCreateHostKey(options.hostKeyPath);

  const cryptoPort: CryptoPort = { sha256Hex: (t) => createHash("sha256").update(t).digest("hex"), randomHex: (n) => randomBytes(n).toString("hex"), fingerprintOfLine };
  const buckets = new Map<string, Bucket>();
  const penalties = new Map<string, Penalty>();
  const perIp = new Map<string, number>();
  let total = 0;

  const sha = (text: string): string => createHash("sha256").update(text).digest("hex");
  const past = await store.audit();
  let last = past.length === 0 ? undefined : (past[past.length - 1] as Partial<ChainedEvent>);
  let lastLink: { seq: number; hash: string } | undefined = last?.hash === undefined || last.seq === undefined ? undefined : { seq: last.seq, hash: last.hash };
  last = undefined;
  let chain: Promise<void> = Promise.resolve();
  const emit = (e: AuditEvent): Promise<void> => {
    chain = chain.then(async () => {
      const chained = chainNext(lastLink, e, sha);
      lastLink = { seq: chained.seq, hash: chained.hash };
      await store.appendAudit(chained);
      options.onEvent?.(chained);
    });
    return chain;
  };
  const strikeIp = (ip: string): void => {
    penalties.set(ip, strike(penalties.get(ip) ?? CLEAN, policy.penalty, clock()));
  };

  const server = new Server({ hostKeys: [loaded.privateKey], ident: "opsfolio-enroll_0.1" }, (client: Connection, info) => {
    const ip = options.peerAddress === undefined ? normaliseIp(info.ip) : options.peerAddress(normaliseIp(info.ip));
    const ident = String(info.header.identRaw ?? "").slice(0, 128);
    const event = (kind: AuditEvent["kind"], outcome: AuditEvent["outcome"], detail: string, more: Partial<AuditEvent> = {}): void => {
      void emit({ at: clock(), kind, sourceIp: ip, outcome, detail, ...more });
    };
    const now = clock();
    const pen = forgive(penalties.get(ip) ?? CLEAN, now, 10 * 60_000);
    penalties.set(ip, pen);
    const count = perIp.get(ip) ?? 0;
    const reason = !sourceAllowed(policy, ip)
      ? "source network is not allowed"
      : blocked(pen, now)
        ? "source is penalised"
        : total >= policy.maxConnections
          ? "too many connections"
          : count >= policy.maxConnectionsPerIp
            ? "too many connections from this source"
            : undefined;
    if (reason === undefined) {
      const t = take(buckets.get(ip) ?? fullBucket(policy.bucket, now), policy.bucket, now);
      buckets.set(ip, t.bucket);
      if (!t.allowed) {
        event("limit", "refused", "rate limit");
        strikeIp(ip);
        client.end();
        return;
      }
    } else {
      event("limit", "refused", reason);
      client.end();
      return;
    }
    total += 1;
    perIp.set(ip, count + 1);
    event("connect", "ok", ident);

    const offered: OfferedKey[] = [];
    let failures = 0;
    let executed = false;
    let account: ServiceAccount = "s-enroll";
    const stdinHash = createHash("sha256");
    const stdoutHash = createHash("sha256");
    let bytesIn = 0;
    let bytesOut = 0;
    let transcript = "";
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number, f: () => void): void => {
      const t = setTimeout(f, ms);
      t.unref();
      timers.push(t);
    };
    let idle: ReturnType<typeof setTimeout> | undefined;
    const touch = (): void => {
      if (idle !== undefined) clearTimeout(idle);
      idle = setTimeout(() => client.end(), policy.idleTimeoutMs);
      idle.unref();
    };
    const handshake = setTimeout(() => client.end(), policy.handshakeTimeoutMs);
    handshake.unref();
    later(policy.totalTimeoutMs, () => client.end());
    touch();

    client.on("authentication", (ctx: AuthContext) => {
      touch();
      void authenticate(ctx);
    });
    const authenticate = async (ctx: AuthContext): Promise<void> => {
      let attempt: AuthAttempt;
      let key: { fingerprint: Fingerprint; algo: string } | undefined;
      if (ctx.method === "publickey") {
        const fingerprint = fingerprintOfBlob(ctx.key.data);
        key = { fingerprint, algo: ctx.key.algo };
        let verified = false;
        if (ctx.signature !== undefined && ctx.blob !== undefined) {
          const parsed = utils.parseKey(`${ctx.key.algo} ${ctx.key.data.toString("base64")}`);
          const k = Array.isArray(parsed) ? parsed[0] : parsed;
          verified = !(k instanceof Error) && k !== undefined && k.verify(ctx.blob, ctx.signature, ctx.hashAlgo) === true;
        }
        const spec = accountOf(ctx.username);
        const known = spec !== undefined && spec.auth === "proven-key" ? (await store.assets()).some((a) => a.keys.includes(fingerprint) || (a.pendingKeys ?? []).includes(fingerprint)) : undefined;
        attempt = { username: ctx.username, method: "publickey", key: { fingerprint, signed: ctx.signature !== undefined, verified, ...(known === undefined ? {} : { known }) } };
      } else {
        attempt = { username: ctx.username, method: ctx.method as AuthAttempt["method"] };
      }
      const d = authDecision(policy, attempt, { failures });
      switch (d.kind) {
        case "accept":
          if (d.proven !== undefined && key !== undefined) {
            const i = offered.findIndex((o) => o.fingerprint === key.fingerprint);
            if (i >= 0) offered[i] = { ...(offered[i] as OfferedKey), proven: true };
            else offered.push({ algo: key.algo, fingerprint: key.fingerprint, proven: true });
          }
          account = ctx.username as ServiceAccount;
          event("auth", "ok", d.proven === undefined ? "anonymous" : "key proven", { account: ctx.username, ...(d.proven === undefined ? {} : { fingerprint: d.proven }) });
          ctx.accept();
          return;
        case "accept-query":
          if (key !== undefined && !offered.some((o) => o.fingerprint === key.fingerprint)) offered.push({ algo: key.algo, fingerprint: key.fingerprint, proven: false });
          ctx.accept();
          return;
        case "prompt":
          if (ctx.method === "keyboard-interactive") {
            ctx.prompt([], "", "", () => {
              account = ctx.username as ServiceAccount;
              event("auth", "ok", "anonymous", { account: ctx.username });
              ctx.accept();
            });
          } else ctx.reject(["publickey"]);
          return;
        case "reject":
          if (d.reason !== "a method is needed") {
            failures += 1;
            event("auth", "refused", d.reason);
            if (accountOf(attempt.username) === undefined || d.disconnect) strikeIp(ip);
          }
          if (d.disconnect) client.end();
          else ctx.reject([...d.methods]);
          return;
      }
    };

    client.on("request", (_accept: unknown, reject?: () => void) => {
      event("command", "refused", "a global request (forwarding) was refused");
      reject?.();
    });
    client.on("tcpip", (_accept: unknown, reject: () => void) => reject());
    client.on("openssh.streamlocal", (_accept: unknown, reject: () => void) => reject());

    client.on("ready", () => {
      clearTimeout(handshake);
      client.on("session", (accept: () => Session) => {
        const session = accept();
        const refuse = (what: string) => (_a: unknown, r?: () => void): void => {
          event("refused", "refused", `${what} was refused: this door never gives a shell`);
          r?.();
        };
        session.on("pty", refuse("a pty"));
        session.on("shell", refuse("a shell"));
        session.on("subsystem", refuse("a subsystem"));
        session.on("env", refuse("an environment variable"));
        session.on("x11", refuse("x11"));
        session.on("auth-agent", refuse("agent forwarding"));
        session.on("exec", (acceptExec: () => ServerChannel, rejectExec: () => void, e: { command: string }) => {
          touch();
          if (executed) {
            rejectExec();
            return;
          }
          executed = true;
          void handleExec(acceptExec(), e.command);
        });
      });
    });

    const finish = (ch: ServerChannel, stdout: string, stderr: string, code: number): void => {
      bytesOut += Buffer.byteLength(stdout) + Buffer.byteLength(stderr);
      stdoutHash.update(stdout).update(stderr);
      if (policy.transcriptBytes > 0) transcript = `${transcript}${transcript === "" ? "" : "\n"}> ${stdout}${stderr}`.slice(0, policy.transcriptBytes);
      event("close", code === 0 ? "ok" : "refused", `exit ${code}`, {
        account,
        clientIdent: ident,
        stdinSha256: stdinHash.digest("hex"),
        stdoutSha256: stdoutHash.digest("hex"),
        bytesIn,
        bytesOut,
        ...(policy.transcriptBytes > 0 ? { transcript } : {}),
      });
      if (stdout !== "") ch.write(stdout);
      if (stderr !== "") ch.stderr.write(stderr);
      ch.exit(code);
      ch.end();
    };

    const handleExec = async (ch: ServerChannel, text: string): Promise<void> => {
      const parsed = commandOf(registry, text);
      if (parsed.kind === "err") {
        event("refused", "refused", parsed.error);
        strikeIp(ip);
        finish(ch, "", `enroll: ${parsed.error}\n`, 64);
        return;
      }
      const cmd = parsed.value;
      const def = registry.get(cmd.name);
      if (def === undefined) {
        finish(ch, "", "enroll: unknown command\n", 64);
        return;
      }
      let stdin = "";
      if (def.readsStdin === true) {
        const read = await new Promise<string | undefined>((resolve) => {
          const chunks: Buffer[] = [];
          let size = 0;
          const stop = setTimeout(() => resolve(undefined), policy.idleTimeoutMs);
          stop.unref();
          ch.on("data", (d: Buffer) => {
            touch();
            size += d.length;
            bytesIn += d.length;
            stdinHash.update(d);
            if (policy.transcriptBytes > 0) transcript = `${transcript}< ${d.toString("utf8")}`.slice(0, policy.transcriptBytes);
            if (size > policy.maxStdinBytes) {
              clearTimeout(stop);
              resolve(undefined);
              return;
            }
            chunks.push(d);
          });
          ch.on("end", () => {
            clearTimeout(stop);
            resolve(Buffer.concat(chunks).toString("utf8"));
          });
        });
        if (read === undefined) {
          event("limit", "refused", "the standard input was too large or too slow");
          strikeIp(ip);
          finish(ch, "", "enroll: the input is too large or too slow\n", 65);
          return;
        }
        stdin = read;
      } else {
        let size = 0;
        ch.on("data", (d: Buffer) => {
          size += d.length;
          bytesIn += d.length;
          stdinHash.update(d);
          if (size > policy.maxStdinBytes) ch.close();
        });
      }
      const proven = offered.filter((o) => o.proven).map((o) => o.fingerprint);
      const assets = await store.assets();
      const asset = assets.find((a) => a.keys.some((k) => proven.includes(k))) ?? assets.find((a) => (a.pendingKeys ?? []).some((k) => proven.includes(k)));
      const viaPending = asset !== undefined && !asset.keys.some((k) => proven.includes(k));
      const nonce = def.nonceOf?.(stdin);
      const nonceFresh = nonce === undefined ? undefined : await store.takeNonce(nonce);
      const sessionId = def.sessionOf(cmd.args);
      const session = sessionId === undefined ? undefined : await store.getSession(sessionId);
      let grant: CommandContext["grant"];
      const at = clock();
      if (def.auth === "pairing-code") {
        const code = def.credentialOf(cmd.args);
        const rec = code === undefined ? undefined : await store.takePairing(code, at);
        if (rec !== undefined) grant = { kind: "pairing", id: rec.code.slice(-4), labels: rec.labels, ...(rec.tenant === undefined ? {} : { tenant: rec.tenant }), ...(rec.fleet === undefined ? {} : { fleet: rec.fleet }) };
      }
      if (cmd.token !== undefined) {
        const rec = await store.takeToken(cmd.token, at);
        if (rec === undefined) {
          event("refused", "refused", "a token was refused (unknown, used or expired)");
          strikeIp(ip);
          finish(ch, "", "enroll: the token is unknown, used or expired\n", 77);
          return;
        }
        grant = { kind: "token", id: rec.id, labels: rec.labels, ...(rec.tenant === undefined ? {} : { tenant: rec.tenant }), ...(rec.fleet === undefined ? {} : { fleet: rec.fleet }) };
      }
      const [reverseDns, neighbourMac] = cmd.name === "knock" ? await Promise.all([lookup.reverseDns(ip), lookup.neighbourMac(ip)]) : [undefined, undefined];
      const ctx: CommandContext = {
        now: at,
        policy,
        enroll,
        registry,
        pins,
        account,
        sourceIp: ip,
        clientIdent: ident,
        keys: offered,
        ...(neighbourMac === undefined ? {} : { neighbourMac }),
        ...(reverseDns === undefined ? {} : { reverseDns }),
        ...(session === undefined ? {} : { session }),
        ...(asset === undefined ? {} : { asset }),
        ...(grant === undefined ? {} : { grant }),
        assets,
        stdin,
        crypto: cryptoPort,
        controllerHostKey: loaded.host.publicKey,
        ...(nonceFresh === undefined ? {} : { nonceFresh }),
        ...(viaPending ? { viaPending } : {}),
        newId: newSessionId,
        planFor,
      };
      const r = runCommand(registry, cmd, ctx);
      if (r.kind === "err") {
        event("refused", "refused", `${cmd.name}: ${r.error.message}`, sessionId === undefined ? {} : { session: sessionId });
        if (r.error.exit === 77) strikeIp(ip);
        finish(ch, "", `enroll: ${r.error.message}\n`, r.error.exit);
        return;
      }
      const { reply, effects, script } = r.value;
      const digest = script === undefined ? undefined : createHash("sha256").update(reply.stdout).digest("hex");
      await apply(effects, digest);
      event("command", "ok", cmd.name, sessionId === undefined ? {} : { session: sessionId });
      finish(ch, reply.stdout, reply.stderr, reply.exit);
    };

    const apply = async (effects: readonly Effect[], scriptSha256: string | undefined): Promise<void> => {
      for (const ef of effects) {
        switch (ef.kind) {
          case "put-session": {
            const s: EnrollmentSession = scriptSha256 !== undefined && ef.session.scriptSha256 === undefined ? { ...ef.session, scriptSha256 } : ef.session;
            await store.putSession(s);
            if (scriptSha256 !== undefined) await emit({ at: clock(), kind: "script", sourceIp: ip, session: s.id, outcome: "ok", detail: "script sent", scriptSha256 });
            break;
          }
          case "put-asset":
            await store.putAsset(ef.asset);
            break;
          case "request-removal":
            await store.requestRemoval(ef.assetId);
            break;
          case "audit":
            await emit(ef.event);
            break;
        }
      }
    };

    client.on("error", () => {});
    client.on("close", () => {
      total -= 1;
      perIp.set(ip, Math.max(0, (perIp.get(ip) ?? 1) - 1));
      clearTimeout(handshake);
      if (idle !== undefined) clearTimeout(idle);
      for (const t of timers) clearTimeout(t);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? policy.endpoint.port, options.host ?? "0.0.0.0", () => resolve());
  });
  const addr = server.address();
  const address = typeof addr === "object" && addr !== null ? { host: addr.address, port: addr.port } : { host: "0.0.0.0", port: 0 };
  return {
    address,
    hostKey: loaded.host,
    policy,
    connections: () => total,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
