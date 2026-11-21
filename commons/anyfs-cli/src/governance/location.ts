// Spec: 0002-anyfs-cli-governance FR-005, FR-006
/**
 * Where a word of a command line points (commons anyfs-cli 0002-anyfs-cli-governance FR-005, FR-006): a plain path on this computer, a mount of the configuration (`fleet:/machines`), or the address of a store
 * (`ssh://host/srv/fleet`, `memory:scratch`). The grammar is a pure function of the word and the names of the mounts, so that what a word means never depends on what is on the disk; a word that looks like a
 * mount (`name:`) and is none is an error that says so, never a file.
 *
 * @example
 * ```ts
 * import { parseLocation } from "./location.ts";
 * const mounts = new Set(["fleet"]);
 * parseLocation("fleet:/machines", mounts); // { kind: "ok", value: { kind: "mount", mount: "fleet", path: "/machines" } }
 * parseLocation("./notes.txt", mounts); // { kind: "ok", value: { kind: "local", path: "./notes.txt" } }
 * ```
 *
 * @module
 */
import { err, ok, type Brand, type Result } from "@intellectual-frontiers/core";
import { PLACE_KINDS, parsePlace, type Place } from "@intellectual-frontiers/anyfs/governance";

/** The name of a mount: lower-case words joined by hyphens, two to thirty-two characters, and not the name of a kind of place. */
export type MountName = Brand<string, "anyfs-cli mount name">;

const MOUNT_NAME = /^[a-z][a-z0-9-]{1,31}$/;

/** A mount name from text, or why the text is not one. */
export function parseMountName(text: string): Result<MountName, string> {
  if (!MOUNT_NAME.test(text)) return err(`${JSON.stringify(text)} is not a mount name: lower-case words joined by hyphens, two to thirty-two characters, starting with a letter`);
  if (PLACE_KINDS.some((k) => k === text)) return err(`${JSON.stringify(text)} is the name of a kind of place and cannot name a mount`);
  return ok(text as MountName);
}

/** Where a word points. The path of a place is the path inside the store, which is rooted at the root of the place. */
export type Location =
  | { readonly kind: "local"; readonly path: string }
  | { readonly kind: "mount"; readonly mount: MountName; readonly path: string }
  | { readonly kind: "place"; readonly place: Place; readonly path: string };

/** Why a word is not a location. */
export type LocationProblem = { readonly code: "E-LOCATION" | "E-MOUNT-UNKNOWN"; readonly message: string };

const URI = /^[a-z][a-z0-9+.-]*:\/\//;
const SCHEME_OF_PLACE = /^(memory):/;
const MOUNTLIKE = /^([a-z][a-z0-9-]{1,31}):(.*)$/s;
const DRIVE = /^[A-Za-z]:[\\/]/;

/** Where a word points, given the names of the mounts. A path inside a mount starts with a slash, or is left out for the root of the mount. */
export function parseLocation(text: string, mounts: ReadonlySet<string>): Result<Location, LocationProblem> {
  if (text === "") return err({ code: "E-LOCATION", message: "an empty word is not a place" });
  if (DRIVE.test(text)) return ok({ kind: "local", path: text });
  if (URI.test(text) || SCHEME_OF_PLACE.test(text)) {
    const place = parsePlace(text);
    if (place.kind === "err") return err({ code: "E-LOCATION", message: `${text}: ${place.error}` });
    return ok({ kind: "place", place: place.value, path: place.value.kind === "file" || place.value.kind === "ssh" ? place.value.path : "/" });
  }
  const m = MOUNTLIKE.exec(text);
  if (m !== null && !text.slice(0, text.indexOf(":")).includes("/")) {
    const name = m[1] ?? "";
    const rest = m[2] ?? "";
    if (mounts.has(name)) {
      const mount = parseMountName(name);
      if (mount.kind === "err") return err({ code: "E-LOCATION", message: mount.error });
      const path = rest === "" ? "/" : rest.startsWith("/") ? rest : `/${rest}`;
      return ok({ kind: "mount", mount: mount.value, path });
    }
    return err({ code: "E-MOUNT-UNKNOWN", message: `${name}: is not a mount (the mounts are ${mounts.size === 0 ? "none" : [...mounts].sort().join(", ")}); write ./${text} for a file of that name` });
  }
  return ok({ kind: "local", path: text });
}
