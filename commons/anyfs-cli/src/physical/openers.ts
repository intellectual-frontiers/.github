// Spec: 0004-anyfs-cli-surfaces FR-001, FR-002
/**
 * The openers of the stores the program has itself (commons anyfs-cli 0004-anyfs-cli-surfaces FR-001, FR-002): a store in memory by name (one per name for a run, so a mount of it keeps what was written), a store of a
 * folder (`file:`), and a store on a host reached by SSH (`ssh://`), which speaks only through the safe executor of Headless and its first contact with a host is the verb `trust-host`, never a flag. The other kinds of
 * place are brought by their libraries through the `kinds` of the configuration; until one is, the place parses and says it has no store yet.
 *
 * @example
 * ```ts
 * import { builtinKinds } from "./openers.ts";
 * builtinKinds(() => undefined, "/tmp/state", {}).map((k) => k.kind); // ["memory", "file", "ssh"]
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Place } from "@intellectual-frontiers/anyfs/governance";
import { localStore, memoryStore, type MemoryStore } from "@intellectual-frontiers/anyfs/physical";
import { openSshStore } from "@intellectual-frontiers/anyfs-ssh";
import { target } from "@intellectual-frontiers/headless/logical";
import { sshExecutor, type RunLocal } from "@intellectual-frontiers/headless/targets/ssh";
import { homeOf } from "@intellectual-frontiers/system/dirs";
import { join, parse } from "@intellectual-frontiers/system/path";
import { osOf } from "./os.ts";
import type { OpenerContext, PlaceOpener, SshInput } from "@intellectual-frontiers/anyfs-cli/logical";

/** The id a host has as an ssh target: lower-case words joined by hyphens. */
export function targetIdOf(host: string): string {
  const id = host
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
  return /^[a-z]/.test(id) ? id : `h-${id}`;
}

/** The files of known hosts the program uses: its own, in its state folder, then the user's. */
export function knownHostsOf(ssh: SshInput, stateDir: string, env: (name: string) => string | undefined): { readonly repository: string; readonly user: string } {
  const home = homeOf(env, osOf()) ?? "";
  return { repository: ssh.knownHosts ?? join(stateDir, "known_hosts"), user: ssh.userKnownHosts ?? join(home, ".ssh", "known_hosts") };
}

/** The openers of memory, of a folder and of a host reached by SSH. `run` is how the ssh program is run: the system's where it is left out. */
export function builtinKinds(env: (name: string) => string | undefined, stateDir: string, ssh: SshInput, run?: RunLocal): readonly PlaceOpener[] {
  const memories = new Map<string, MemoryStore>();
  const memory: PlaceOpener = {
    kind: "memory",
    open: (place: Place): Promise<Result<MemoryStore, string>> => {
      if (place.kind !== "memory") return Promise.resolve(err("not a memory place"));
      const held = memories.get(place.name);
      if (held !== undefined) return Promise.resolve(ok(held));
      const made = memoryStore({ name: place.name });
      memories.set(place.name, made);
      return Promise.resolve(ok(made));
    },
  };
  const file: PlaceOpener = {
    kind: "file",
    open: async (place) => {
      if (place.kind !== "file") return err("not a file place");
      // a store at the root of the computer's file system is the computer's own: its names are whatever the computer has, and opening it writes nothing
      const root = parse(place.path).root === place.path;
      return await localStore(place.path, root ? { portable: false, caseSensitive: osOf() === "linux", lockDir: join(stateDir, "locks-root") } : {});
    },
  };
  const sshKind: PlaceOpener = {
    kind: "ssh",
    open: async (place, _context: OpenerContext) => {
      if (place.kind !== "ssh") return err("not an ssh place");
      const t = target({ id: targetIdOf(place.host), class: "server", address: place.host, ...(place.user === undefined ? {} : { user: place.user }), ...(place.port === undefined ? {} : { port: place.port }) });
      if (t.kind === "err") return err(t.error);
      const known = knownHostsOf(ssh, stateDir, env);
      const executor = sshExecutor(t.value, [t.value], { knownHostsRepository: known.repository, knownHostsUser: known.user, ...(ssh.program === undefined ? {} : { program: ssh.program }) }, run === undefined ? {} : { run });
      const opened = await openSshStore(executor, { place: { host: place.host, ...(place.user === undefined ? {} : { user: place.user }), ...(place.port === undefined ? {} : { port: place.port }) }, root: place.path });
      return opened.kind === "ok" ? ok(opened.value.store) : err(opened.error);
    },
  };
  return [memory, file, sshKind];
}
