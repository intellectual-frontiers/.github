// Spec: 0004-anyfs-cli-surfaces FR-005
/**
 * From a word of a command line to the store it points into (commons anyfs-cli 0004-anyfs-cli-surfaces FR-005): the word is parsed as a location (a plain path, a mount, an address), the store of its place is opened once
 * for the run, a mount that is read-only is attenuated so that nothing can change it whatever the verb does, and the POSIX view of the store is made with the path inside it resolved lexically. Every way it can fail
 * is a problem with its code and the exit it ends with: a word that is no place is a usage error, a store that cannot be opened is a problem of the computer.
 *
 * @example
 * ```ts
 * import { bind } from "./bind.ts";
 * // const bound = await bind(host, "scratch:/notes"); bound.kind === "ok" && bound.value.inner; // "/notes"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Place } from "@intellectual-frontiers/anyfs/governance";
import { type AnyStore, type OpCapability, readOnly, type Store } from "@intellectual-frontiers/anyfs/logical";
import { parseAbsolute, prefixOf, type PosixPath } from "@intellectual-frontiers/anyfs-posix/governance";
import { posix } from "@intellectual-frontiers/anyfs-posix/physical";
import type { Posix } from "@intellectual-frontiers/anyfs-posix/logical";
import type { Prefix } from "@intellectual-frontiers/anyfs/governance";
import { type Location, parseLocation, type ProblemCode } from "@intellectual-frontiers/anyfs-cli/governance";
import { type Host, viewable } from "@intellectual-frontiers/anyfs-cli/logical";

/** A word of a command line, bound to the store it points into. */
export type Bound = {
  /** The word as it was typed. */
  readonly text: string;
  readonly location: Location;
  readonly store: AnyStore;
  /** The POSIX view of the whole store. */
  readonly view: Posix;
  /** The path inside the store, absolute and resolved. */
  readonly inner: PosixPath;
  readonly readOnly: boolean;
};

/** Why a word was not bound: the code, the sentence, and whether it is the command line's fault or the computer's. */
export type BindProblem = { readonly code: ProblemCode; readonly message: string; readonly fault: "usage" | "environment" };

/** The names of the mounts. */
function mountNames(host: Host): ReadonlySet<string> {
  return new Set(host.config.mounts.map((m) => m.name));
}

/** The store with nothing that changes it, from a store whose capabilities are known only at run time. */
function attenuated(store: AnyStore): AnyStore {
  return readOnly(store as Store<OpCapability>);
}

/** Binds a word to the store it points into. */
export async function bind(host: Host, text: string): Promise<Result<Bound, BindProblem>> {
  const parsed = parseLocation(text, mountNames(host));
  if (parsed.kind === "err") {
    const p = parsed.error;
    if (p.code === "E-MOUNT-UNKNOWN" && host.configProblem !== undefined) return err({ code: host.configProblem.code, message: `${p.message}; ${host.configProblem.message}`, fault: "environment" });
    return err({ code: p.code, message: p.message, fault: "usage" });
  }
  const location = parsed.value;
  let place: Place;
  let path: string;
  let readOnlyMount = false;
  if (location.kind === "local") {
    const l = host.world.local(location.path);
    place = { kind: "file", path: l.root };
    path = l.inner;
  } else if (location.kind === "mount") {
    const mount = host.config.mounts.find((m) => m.name === location.mount);
    if (mount === undefined) return err({ code: "E-MOUNT-UNKNOWN", message: `${location.mount}: is not a mount`, fault: "usage" });
    place = mount.place;
    path = location.path;
    readOnlyMount = mount.readOnly;
  } else {
    place = location.place.kind === "file" ? { kind: "file", path: "/" } : location.place.kind === "ssh" ? { ...location.place, path: "/" } : location.place;
    path = location.path;
  }
  const opened = await host.world.open(place);
  if (opened.kind === "err") return err({ code: opened.error.code, message: opened.error.message, fault: opened.error.code === "E-PLACE-UNAVAILABLE" || opened.error.code === "E-OPEN" ? "environment" : "usage" });
  const store = readOnlyMount ? attenuated(opened.value) : opened.value;
  const readable = viewable(store);
  if (readable === undefined) return err({ code: "E-OPEN", message: `${text}: the store ${store.id} cannot be read as files: it lacks read, list or stat`, fault: "environment" });
  const inner = parseAbsolute(path);
  if (inner.kind === "err") return err({ code: "E-LOCATION", message: `${text}: ${inner.error}`, fault: "usage" });
  return ok({ text, location, store, view: posix(readable), inner: inner.value, readOnly: readOnlyMount || !store.capabilities.has("write") });
}

/** The prefix of the store that a bound directory is, for a transfer. */
export function prefixOfBound(b: Bound): Result<Prefix, string> {
  return prefixOf(b.inner);
}

/** The label of a bound word in a report: the word as typed. */
export function labelOf(b: Bound): string {
  return b.text;
}
