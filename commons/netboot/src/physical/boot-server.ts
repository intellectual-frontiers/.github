// Spec: 0004-netboot-physical FR-005, FR-006
/**
 * The boot server: the answers to what a machine asks over TFTP and HTTP, from the pinned files, the menus, the arming kept in a file and what the fleet gives for each host (its install data, its MAC and the secret that is put in as the file is served). A host that is not armed
 * boots its own disk. An install's files are served only under the token it was armed with; the password hash is put in as the file is served and is never kept in a rendered file; the guard's decision is the server's; and the installer's `done` disarms the host, so that its next network boot does not reinstall it.
 *
 * @example
 * ```ts
 * import { startBoot } from "./boot-server.ts";
 * // const s = await startBoot({ stateFile, assets, pins, provider, http: { port: 0 }, tftp: { port: 0 } }); await s.stop();
 * ```
 *
 * @module
 */
import { fs } from "@intellectual-frontiers/system";
import { BASE_PLACEHOLDER, PASSWORD_PLACEHOLDER, type BootProfile } from "@intellectual-frontiers/netboot/governance";
import { answerOf, armedHosts, chooserMenu, classify, decide, describeFacts, done, GUARD_SCRIPT, hostMenu, mainMenu, note, parseFacts, tokenFits, type Progress } from "@intellectual-frontiers/netboot/logical";
import type { Assets } from "./assets.ts";
import { httpServer, type BootRequest, type BootResponse, type HttpServer } from "./http-server.ts";
import { readState, updateState } from "./state.ts";
import { tftpServer, type TftpServer } from "./tftp-server.ts";

/** What the fleet gives the server for its hosts. */
export type BootProvider = {
  /** The hosts that can be installed, with their MAC addresses where the fleet knows them. */
  hosts(): Promise<ReadonlyArray<{ readonly name: string; readonly mac?: string }>>;
  /** The install's `user-data` for a host, as rendered (with the placeholders). */
  userData(host: string): Promise<string | undefined>;
  /** The install's `meta-data` for a host. */
  metaData(host: string): Promise<string | undefined>;
  /** The hash of the administrator's password, kept on the boot machine and never in the fleet's repository. */
  passwordHash(host: string): Promise<string | undefined>;
};

/** What the server is told of as it goes. */
export type BootEvent = { readonly at: string; readonly kind: "http" | "tftp" | "install"; readonly detail: string };

/** What the server is given. */
export type BootOptions = {
  readonly stateFile: string;
  readonly assets: Assets;
  /** The profile of the distribution this server serves: its files, its menu entries and its install document. */
  readonly profile: BootProfile;
  readonly provider: BootProvider;
  readonly http: { readonly port: number; readonly hostname?: string };
  readonly tftp: { readonly port: number; readonly hostname?: string };
  /** The server's own URL as a machine reaches it, ending in a slash; the address the request was made to where it is not given. */
  readonly baseUrl?: string;
  readonly now?: () => string;
  readonly emit?: (e: BootEvent) => void;
};

/** A running boot server. */
export type BootServer = { readonly httpPort: number; readonly tftpPort: number; stop(): Promise<void> };

const text = (body: string, status = 200, type = "text/plain; charset=utf-8"): BootResponse => ({ status, headers: { "Content-Type": type }, body });
const NOT_FOUND = (): BootResponse => text("not found\n", 404);

/** The handler of both transports: the file or text a path names, and the install's posts. */
export function bootHandler(o: BootOptions): (r: BootRequest) => Promise<BootResponse> {
  const now = o.now ?? ((): string => new Date().toISOString());
  const say = (kind: BootEvent["kind"], detail: string): void => o.emit?.({ at: now(), kind, detail });
  return async (r) => {
    const route = classify(r.path, Object.keys(o.assets.files));
    const base = o.baseUrl ?? `http://${r.host}/`;
    if (r.method !== "GET" && r.method !== "HEAD" && r.method !== "POST") return text("method not allowed\n", 405);
    switch (route.kind) {
      case "boot-file":
      case "host-boot-file": {
        const file = o.assets.files[route.name];
        return file === undefined ? NOT_FOUND() : { status: 200, headers: {}, body: { file, size: (await fs.stat(file)).size } };
      }
      case "main-menu":
        return text(mainMenu());
      case "mac-menu": {
        const state = await readState(o.stateFile);
        const hosts = await o.provider.hosts();
        const found = hosts.find((h) => h.mac?.toLowerCase() === route.mac) ?? Object.entries(state.armed).map(([name, a]) => ({ name, mac: a.mac })).find((h) => h.mac?.toLowerCase() === route.mac);
        say("http", `menu for ${route.mac}: ${found?.name ?? "unknown machine"}`);
        return text(found === undefined ? chooserMenu(armedHosts(state), o.profile, base) : hostMenu({ name: found.name }, o.profile, base, state.armed[found.name]?.token));
      }
      case "iso": {
        const iso = o.profile.pins.iso;
        if (iso === undefined || route.name !== iso.name || o.assets.iso === undefined) return NOT_FOUND();
        return { status: 200, headers: {}, body: { file: o.assets.iso, size: (await fs.stat(o.assets.iso)).size } };
      }
      case "install": {
        const state = await readState(o.stateFile);
        if (!tokenFits(state, route.host, route.token)) {
          say("install", `refused ${route.file} for ${route.host}: not armed, or the token is not the one`);
          return text("forbidden\n", 403);
        }
        const mac = route.mac === "unknown" ? undefined : route.mac;
        const root = `${base}install/${route.host}/${route.token}/${route.mac}/`;
        const at = now();
        switch (route.file) {
          case "user-data":
          case "preseed.cfg":
          case "ks.cfg":
          case "autoinst.xml": {
            // only the profile's own install document is served: a Debian install does not read a user-data
            if (route.file !== o.profile.document) return NOT_FOUND();
            const [data, hash] = [await o.provider.userData(route.host), await o.provider.passwordHash(route.host)];
            if (data === undefined) return NOT_FOUND();
            if (data.includes(PASSWORD_PLACEHOLDER) && hash === undefined) {
              say("install", `${route.host}: there is no password hash on this machine, so no install data was served`);
              return text("no password hash on the boot machine\n", 500);
            }
            say("install", `serving the install data of ${route.host}`);
            return text(data.split(BASE_PLACEHOLDER).join(root).split(PASSWORD_PLACEHOLDER).join(hash ?? ""), 200, o.profile.documentType);
          }
          case "meta-data": {
            const m = await o.provider.metaData(route.host);
            return m === undefined ? NOT_FOUND() : text(m);
          }
          case "vendor-data":
            return text("");
          case "guard.sh":
            return text(GUARD_SCRIPT);
          case "facts": {
            const facts = parseFacts(new TextDecoder().decode(r.body));
            const arming = state.armed[route.host];
            const d = decide(route.host, facts, { ...(arming?.confirmDestroy === true ? { confirmDestroy: true } : {}), ...(state.installed[route.host]?.mac === undefined ? {} : { installedMac: state.installed[route.host]?.mac as string }) }, mac);
            await updateState(o.stateFile, (s) => ({ state: note(s, { at, host: route.host, level: d.go ? "info" : "fail", phase: "Guard", summary: `${describeFacts(facts)}: ${d.why}` } satisfies Progress), value: 0 }));
            say("install", `${route.host}: the guard says ${d.go ? "go" : "stop"} (${d.why})`);
            return text(answerOf(d));
          }
          case "event": {
            let e: { phase?: unknown; level?: unknown; summary?: unknown } = {};
            try {
              e = JSON.parse(new TextDecoder().decode(r.body)) as typeof e;
            } catch {
              e = { summary: new TextDecoder().decode(r.body).slice(0, 500) };
            }
            await updateState(o.stateFile, (s) => ({ state: note(s, { at, host: route.host, level: String(e.level ?? "info"), phase: String(e.phase ?? "Install"), summary: String(e.summary ?? "").slice(0, 500) }), value: 0 }));
            return text("ok\n");
          }
          case "done": {
            await updateState(o.stateFile, (s) => ({ state: note(done(s, route.host, mac, at), { at, host: route.host, level: "ok", phase: "Install", summary: "the installer is done" }), value: 0 }));
            say("install", `${route.host}: the installer is done; the host is no longer armed`);
            return text("ok\n");
          }
        }
        return NOT_FOUND();
      }
      default:
        return NOT_FOUND();
    }
  };
}

/** Starts the HTTP and TFTP servers over one handler. */
export async function startBoot(o: BootOptions): Promise<BootServer> {
  const handle = bootHandler(o);
  const http: HttpServer = await httpServer({ ...o.http, handle: async (r) => {
    o.emit?.({ at: (o.now ?? (() => new Date().toISOString()))(), kind: "http", detail: `${r.method} ${r.path} from ${r.from}` });
    return handle(r);
  } });
  let tftp: TftpServer;
  try {
    tftp = await tftpServer({
      ...o.tftp,
      read: async (path, from) => {
        const r = await handle({ method: "GET", path, host: "", from, range: undefined, body: new Uint8Array() });
        if (r.status !== 200) return undefined;
        if (typeof r.body === "string") return new TextEncoder().encode(r.body);
        if (r.body instanceof Uint8Array) return r.body;
        return new Uint8Array(await fs.readFile(r.body.file));
      },
      onTransfer: (e) => o.emit?.({ at: (o.now ?? (() => new Date().toISOString()))(), kind: "tftp", detail: `${e.outcome} ${e.file} to ${e.from}` }),
    });
  } catch (e) {
    await http.stop();
    throw e;
  }
  return { httpPort: http.port, tftpPort: tftp.port, stop: async () => void (await Promise.all([http.stop(), tftp.stop()])) };
}
