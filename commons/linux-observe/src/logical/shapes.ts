// Spec: 0002-linux-observe-shapes FR-001, FR-002, FR-003
/**
 * What a command printed, read in the shape a requirement declares: pure functions from the text of `getent`, `stat`, `id`, `systemctl`, `dpkg-query` and a file to the value that `desired` of the requirement would equal were the machine as declared, and nothing where the resource is
 * not there. A field the requirement does not declare is not read, so that a requirement that says less is satisfied by more. Nothing here runs a program.
 *
 * @example
 * ```ts
 * import { userShape } from "./shapes.ts";
 * userShape({ name: "ada", shell: "/bin/bash" }, "ada:x:1000:1000:Ada:/home/ada:/bin/bash\n", "ada sudo\n"); // { name: "ada", shell: "/bin/bash" }
 * ```
 *
 * @module
 */
import type { JsonValue } from "@intellectual-frontiers/desired-os-state/governance";

type Obj = { readonly [key: string]: JsonValue };

const str = (d: Obj, k: string): string | undefined => (typeof d[k] === "string" ? (d[k] as string) : undefined);

/** A group from the line of `getent group`, or nothing where there is none. */
export function groupShape(d: Obj, getent: string | undefined): JsonValue | undefined {
  return getent === undefined ? undefined : { name: str(d, "name") ?? "" };
}

/** A user from the line of `getent passwd` and the output of `id -nG`: only the fields the requirement declares, and of the groups it names only those the user is in, in the order it names them. */
export function userShape(d: Obj, passwd: string | undefined, groupsOf: string | undefined): JsonValue | undefined {
  if (passwd === undefined) return undefined;
  const f = passwd.trim().split(":");
  const o: Record<string, JsonValue> = { name: f[0] ?? "" };
  if (d["uid"] !== undefined) o["uid"] = Number(f[2]);
  if (d["comment"] !== undefined) o["comment"] = f[4] ?? "";
  if (d["shell"] !== undefined) o["shell"] = f[6] ?? "";
  if (d["home"] !== undefined) o["home"] = f[5] ?? "";
  if (Array.isArray(d["groups"])) {
    const has = new Set((groupsOf ?? "").trim().split(/\s+/));
    o["groups"] = (d["groups"] as string[]).filter((x) => has.has(x));
  }
  return o;
}

/** The kind of a file as `stat -c %F` says it, with its owner, group and mode (`%a`). */
export type Stat = { readonly type: string; readonly owner: string; readonly group: string; readonly mode: string };

/** `stat -c '%F|%U|%G|%a'` read. */
export function parseStat(text: string): Stat | undefined {
  const [type = "", owner = "", group = "", mode = ""] = text.trim().split("|");
  return type === "" ? undefined : { type, owner, group, mode };
}

/** A file or a directory from its stat and, for a file, its content: the path, and the content, owner, group and mode as far as the requirement declares them (a mode is written as long as the requirement writes it). */
export function pathShape(kind: "file" | "directory", d: Obj, stat: Stat | undefined, content: string | undefined): JsonValue | undefined {
  if (stat === undefined) return undefined;
  if ((kind === "directory") !== (stat.type === "directory")) return undefined;
  const o: Record<string, JsonValue> = { path: str(d, "path") ?? "" };
  if (kind === "file") o["content"] = content ?? "";
  if (d["owner"] !== undefined) o["owner"] = stat.owner;
  if (d["group"] !== undefined) o["group"] = stat.group;
  if (typeof d["mode"] === "string") o["mode"] = stat.mode.padStart((d["mode"] as string).length, "0");
  return o;
}

/** A service: whether it is running (`systemctl is-active` says `active`) and whether it starts at boot (`is-enabled` says `enabled`). A service is always there to ask about. */
export function serviceShape(d: Obj, active: string, enabled: string): JsonValue {
  return { name: str(d, "name") ?? "", running: active.trim() === "active", enabled: enabled.trim() === "enabled" };
}

/** A key: the requirement itself where the key file has the line, and nothing where it has not. */
export function keyShape(d: Obj, fileText: string | undefined): JsonValue | undefined {
  return fileText !== undefined && fileText.split("\n").includes(str(d, "key") ?? "\u0000") ? d : undefined;
}

/** A package from `dpkg-query -W -f '${db:Status-Abbrev}|${Version}'`: there where its status says installed (`ii`), with its version where the requirement names one. */
export function packageShape(d: Obj, dpkg: string | undefined): JsonValue | undefined {
  if (dpkg === undefined) return undefined;
  const [status = "", version = ""] = dpkg.split("|");
  if (!status.trim().startsWith("ii")) return undefined;
  return d["version"] === undefined ? { name: str(d, "name") ?? "" } : { name: str(d, "name") ?? "", version };
}

/** A package of an rpm family from `rpm -q --qf '%{VERSION}-%{RELEASE}'`: the version it prints where it is installed (the command fails, and there is nothing to read, where it is not), with the version of the requirement where it names one. */
export function rpmPackageShape(d: Obj, rpm: string | undefined): JsonValue | undefined {
  if (rpm === undefined || rpm.trim() === "") return undefined;
  const version = rpm.trim();
  return d["version"] === undefined ? { name: str(d, "name") ?? "" } : { name: str(d, "name") ?? "", version };
}

/** A package of Arch from `pacman -Q name`, which prints `name version` where it is installed. */
export function pacmanPackageShape(d: Obj, pacman: string | undefined): JsonValue | undefined {
  if (pacman === undefined) return undefined;
  const [name = "", version = ""] = pacman.trim().split(/\s+/);
  if (name === "") return undefined;
  return d["version"] === undefined ? { name: str(d, "name") ?? "" } : { name: str(d, "name") ?? "", version };
}

/** A setting of the system from the file that holds it: the time zone is where `/etc/localtime` points (after `zoneinfo/`), the keyboard layout is `XKBLAYOUT` of `/etc/default/keyboard` and the locale is `LANG` of `/etc/default/locale`. */
export function settingShape(name: string, text: string | undefined): JsonValue | undefined {
  if (text === undefined) return undefined;
  if (name === "timezone") return { name, value: text.trim().replace(/^.*\/zoneinfo\//, "") };
  const key = name === "keyboard" ? "XKBLAYOUT" : "LANG";
  const m = new RegExp(`^${key}="?([^"\\n]*)"?$`, "m").exec(text);
  return m === null ? undefined : { name, value: m[1] ?? "" };
}

/** The path a key file is at: the requirement's own, or the account's `.ssh/authorized_keys`. */
export function keyFileOf(d: Obj): string {
  const user = str(d, "user") ?? "";
  return str(d, "path") ?? `${user === "root" ? "/root" : `/home/${user}`}/.ssh/authorized_keys`;
}

/** The file a setting is read from on a family: the time zone is the link `/etc/localtime` everywhere; the locale is `LANG` of `/etc/default/locale` on Debian and `/etc/locale.conf` elsewhere; the keyboard layout is `XKBLAYOUT` of `/etc/default/keyboard` on Debian only (the other families keep a console keymap of another name, which is not the same fact). */
export function settingFileOf(family: string, name: string): string | undefined {
  if (name === "timezone") return "/etc/localtime";
  if (name === "locale") return family === "debian" ? "/etc/default/locale" : "/etc/locale.conf";
  return name === "keyboard" && family === "debian" ? "/etc/default/keyboard" : undefined;
}
