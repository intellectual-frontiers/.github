// Spec: 0002-snmp-connector FR-005, FR-009
/**
 * What touches the world for SNMP (0002-snmp-connector FR-005, FR-009): the primitives of the user-based security model over `node:crypto` (SHA-2, HMAC and AES-128 in cipher feedback mode), a datagram port over UDP with a timeout and one retry,
 * and a clock. The same code runs on the controller and at a relay.
 *
 * @module
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { createSocket } from "node:dgram";
import { err, ok } from "@intellectual-frontiers/core";
import type { AuthProtocol } from "@intellectual-frontiers/integrations-snmp/governance";
import type { DatagramPort, Pace, Primitives, SessionEnv } from "@intellectual-frontiers/integrations-snmp/logical";

const NODE: Readonly<Record<AuthProtocol, string>> = { "hmac-sha-224": "sha224", "hmac-sha-256": "sha256", "hmac-sha-384": "sha384", "hmac-sha-512": "sha512" };

/** The primitives of `node:crypto`. */
export const nodePrimitives: Primitives = {
  hash: (p, data) => new Uint8Array(createHash(NODE[p]).update(data).digest()),
  hmac: (p, key, data) => new Uint8Array(createHmac(NODE[p], key).update(data).digest()),
  aesCfb128: (mode, key, iv, data) => {
    const c = mode === "encrypt" ? createCipheriv("aes-128-cfb", key, iv) : createDecipheriv("aes-128-cfb", key, iv);
    return new Uint8Array(Buffer.concat([c.update(data), c.final()]));
  },
};

/** A datagram port over UDP to one address and port: one request, one answer, `retries` more tries after a silence of `timeoutMs`. */
export function udpPort(host: string, port: number, options: { readonly timeoutMs?: number; readonly retries?: number } = {}): DatagramPort {
  const timeoutMs = options.timeoutMs ?? 3000;
  const retries = options.retries ?? 1;
  return {
    exchange: (request) =>
      new Promise((resolve) => {
        const socket = createSocket(host.includes(":") ? "udp6" : "udp4");
        let tries = 0;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const finish = (r: Awaited<ReturnType<DatagramPort["exchange"]>>): void => {
          if (timer !== undefined) clearTimeout(timer);
          socket.close();
          resolve(r);
        };
        const send = (): void => {
          tries += 1;
          socket.send(request, port, host, (e) => {
            if (e !== null) finish(err("network"));
          });
          timer = setTimeout(() => (tries > retries ? finish(err("timeout")) : send()), timeoutMs);
        };
        socket.on("message", (m) => finish(ok(new Uint8Array(m))));
        socket.on("error", () => finish(err("network")));
        send();
      }),
  };
}

/** The environment of a session on this machine: the primitives of `node:crypto`, its random octets and its clock. */
export function nodeEnv(datagram: DatagramPort): SessionEnv {
  return { datagram, prims: nodePrimitives, random: (n) => new Uint8Array(randomBytes(n)), now: () => Date.now() };
}

/** The pace of a walk on this machine. */
export const nodePace: Pace = { now: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };
