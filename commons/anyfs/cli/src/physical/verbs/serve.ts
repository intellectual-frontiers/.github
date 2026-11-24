// Spec: 0006-anyfs-cli-serve FR-001, FR-002, FR-003, FR-004
/**
 * The verb that serves a store (commons anyfs-cli 0006-anyfs-cli-serve FR-001 to FR-004): `serve LOCATION` hosts the place a word names as WebDAV through `anyfs-serve`, so that an operating system mounts it with no
 * kernel module. It listens on the loopback with a token it makes and writes to standard error (never to the report, so that a pipe of the report does not carry it), says the address, and waits until the person stops
 * it (SIGINT, SIGTERM) or the host does. A directory below the root of a store is served as the root of the server; a mount that is read-only, or `--read-only`, serves nothing that changes. An address that is not
 * the loopback needs `--allow-host` for the names it may be asked for.
 *
 * @example
 * ```ts
 * import { serveVerbs } from "./serve.ts";
 * // serveVerbs(host).map((v) => v.name); // ["serve"]
 * ```
 *
 * @module
 */
import { outcomeOf, type Command, type Context, type Outcome } from "@intellectual-frontiers/headless/logical";
import { flag, value } from "@intellectual-frontiers/terminal/args";
import { readOnly, sub, type Store } from "@intellectual-frontiers/anyfs/logical";
import { expose, LOOPBACK, type Exposure } from "@intellectual-frontiers/anyfs-serve/governance";
import { serveNfs, serveStore } from "@intellectual-frontiers/anyfs-serve/physical";
import { uid } from "@intellectual-frontiers/system/proc";
import type { Viewable } from "@intellectual-frontiers/anyfs-posix/physical";
import { environment, type Host, usage, viewable } from "@intellectual-frontiers/anyfs-cli/logical";
import { prefixOfBound } from "../bind.ts";
import { bindAll, defineVerb } from "./common.ts";

/** What the command line does with a mode, an owner or a time the store cannot keep when the option is not given: accept it without effect and count it (0006-anyfs-cli-serve FR-005), where the library's own default is to refuse it (0006-anyfs-serve-nfs FR-009). */
export const DEFAULT_NFS_ATTRIBUTES = "ignore" as const;

/** Resolves when the context or the world asks the run to end. */
function untilStopped(ctx: Context, host: Host): Promise<void> {
  return new Promise<void>((resolve) => {
    const signals = [ctx.signal, host.world.stop].filter((s): s is AbortSignal => s !== undefined);
    if (signals.some((s) => s.aborted)) return resolve();
    for (const s of signals) s.addEventListener("abort", () => resolve(), { once: true });
  });
}

const parsePort = (text: string | undefined): number | string => {
  if (text === undefined) return 0;
  const n = Number(text);
  return Number.isInteger(n) && n >= 0 && n <= 65535 ? n : `--port is ${text}: a whole number from 0 to 65535 (0 asks for a free one)`;
};

const serve = (host: Host): Command =>
  defineVerb(host, {
    name: "serve",
    id: "serve",
    options: {
      port: value({ valueName: "N", help: "The port to listen on; a free one where it is left out." }),
      listen: value({ valueName: "ADDRESS", help: "An address to listen on instead of the loopback; needs --allow-host." }),
      allowHost: value({ valueName: "HOST[,HOST]", help: "The host names that may be asked for when the address is not the loopback (the Host header), so that a page of another site cannot reach the server." }),
      readOnly: flag({ help: "Serve nothing that changes the store, whatever the store can do." }),
      nfs: flag({ help: "Serve as NFS version 3 on the loopback instead of WebDAV: no token (the callers are the uid of this account and root), and the mount command is printed." }),
      nfsAttributes: value({ valueName: "refuse|ignore", help: "With --nfs: what to do with a mode, an owner or a time the store cannot keep: accept it without effect and count it (default), or refuse it." }),
    },
    operands: [{ name: "LOCATION", help: "The place to serve: a mount, a folder, an address; a directory below the root of a store is served as the root.", arity: "one" }],
    examples: [
      { args: ["fleet:/"], says: "Serve the mount fleet as WebDAV on the loopback, with the address and the token on standard error." },
      { args: ["--read-only", "--port", "8080", "./docs"], says: "Serve a folder read-only on port 8080." },
    ],
    run: async (args, ctx, h): Promise<Outcome> => {
      const [word] = args.positionals;
      if (word === undefined) return usage("serve needs the place to serve");
      const port = parsePort(args.options.port);
      if (typeof port === "string") return usage(port);
      let exposure: Exposure = LOOPBACK;
      if (args.options.listen !== undefined) {
        const hosts = (args.options.allowHost ?? "").split(",").map((t) => t.trim()).filter((t) => t !== "");
        const made = expose(args.options.listen, hosts);
        if (made.kind === "err") return usage(`--listen: ${made.error}; name them with --allow-host`);
        exposure = made.value;
      } else if (args.options.allowHost !== undefined) return usage("--allow-host needs --listen with an address");
      const attributes = args.options.nfsAttributes;
      if (attributes !== undefined && attributes !== "refuse" && attributes !== "ignore") return usage(`--nfs-attributes is ${attributes}: refuse or ignore`);
      if (!args.options.nfs && attributes !== undefined) return usage("--nfs-attributes needs --nfs");
      if (args.options.nfs && args.options.listen !== undefined) return usage("--nfs serves the loopback only: it cannot be given --listen");
      const bound = await bindAll(h, [word]);
      if (bound.kind === "err") return bound.error;
      const b = bound.value[0];
      if (b === undefined) return usage("serve needs the place to serve");
      const base = viewable(b.store);
      if (base === undefined) return environment("E-OPEN", `${word}: the store cannot be read as files: it lacks read, list or stat`);
      let store: Store<Viewable> = base;
      if (b.inner !== "/") {
        const prefix = prefixOfBound(b);
        if (prefix.kind === "err") return usage(`${word}: ${prefix.error}`);
        store = sub(base, prefix.value);
      }
      const asked = args.options.readOnly || b.readOnly;
      if (asked) store = readOnly(store);
      const mine = uid();
      const protocol = args.options.nfs ? "NFS version 3" : "WebDAV";
      const where = `${b.text} (${asked ? "read-only" : "read-write"}) on ${exposure.kind === "loopback" ? "the loopback" : exposure.hostname}`;
      if (args.options.nfs) {
        if (ctx.mode !== "apply") return outcomeOf({ location: b.text, readOnly: asked, port, served: false, protocol: "nfs" }, { text: `would serve ${where} as ${protocol}` });
        const nfs = await serveNfs(store, { port, readOnly: asked, attributes: attributes ?? DEFAULT_NFS_ATTRIBUTES, ...(mine === undefined ? {} : { uids: [mine, 0] }) });
        if (nfs.kind === "err") return environment("E-OPEN", nfs.error);
        const n = nfs.value;
        h.world.notice(`serving ${where} as ${protocol} on ${n.hostname}:${n.port}`);
        h.world.notice(`mount: ${n.mountCommand("DIRECTORY")}`);
        h.world.notice(`callers: ${mine === undefined ? "any" : `uid ${mine} and root`}; nothing is kept that a store has no place for (modes, owners, times, links)`);
        h.world.notice(`attributes: a mode, an owner or a time that is set is ${(attributes ?? DEFAULT_NFS_ATTRIBUTES) === "ignore" ? "accepted without effect and counted" : "refused"}`);
        h.world.notice("stop with Ctrl-C");
        await untilStopped(ctx, h);
        const failed = await n.close();
        if (failed.length > 0) return environment("E-FILESYSTEM", `not put: ${failed.join(", ")}`);
        return outcomeOf({ location: b.text, readOnly: asked, port: n.port, served: true, protocol: "nfs" }, { text: `stopped serving ${b.text}` });
      }
      if (ctx.mode !== "apply") return outcomeOf({ location: b.text, readOnly: asked, port, served: false }, { text: `would serve ${where} as ${protocol}` });
      const running = await serveStore(store, { port, exposure });
      if (running.kind === "err") return environment("E-OPEN", running.error);
      const s = running.value;
      h.world.notice(`serving ${where} as ${protocol} at ${s.url}`);
      if (s.token !== undefined) h.world.notice(`token: ${s.token}  (basic: any user name with it as the password, or Authorization: Bearer)`);
      h.world.notice("stop with Ctrl-C");
      await untilStopped(ctx, h);
      await s.close();
      return outcomeOf({ location: b.text, readOnly: asked, url: s.url, port: s.port, served: true }, { text: `stopped serving ${b.text}` });
    },
  });

/** The verb that serves a store. */
export function serveVerbs(host: Host): readonly Command[] {
  return [serve(host)];
}
