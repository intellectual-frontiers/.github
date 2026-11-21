// Spec: 0003-linux-observe-observe FR-001, FR-002
/**
 * Observing a Linux machine with no change: for each requirement, the programs that read what it declares (`getent`, `id`, `stat`, `cat`, `systemctl is-active`, `systemctl is-enabled`, `dpkg-query`, `readlink`) are run through the way of running a program that is given (here, over ssh, in a
 * container or on the machine itself), with the prefix that raises rights where there is one, and what they print is read by the shapes of the Logical layer. A resource that is not there has no entry. Observation is by this library and change is by a dialect: nothing here writes.
 *
 * @example
 * ```ts
 * import { READERS } from "./observe.ts";
 * READERS.includes("getent"); // true
 * ```
 *
 * @module
 */
import { err, type Result } from "@intellectual-frontiers/core";
import type { Observed } from "@intellectual-frontiers/linux-observe/governance";
import type { JsonValue, Requirement, RequirementId } from "@intellectual-frontiers/archon/governance";
import { textOf, type Executor } from "@intellectual-frontiers/headless/logical";
import { platformOfOsRelease, groupShape, keyFileOf, keyShape, packageShape, pathShape, parseStat, serviceShape, settingShape, userShape } from "@intellectual-frontiers/linux-observe/logical";

/** The programs that observation runs, and no others: every one of them only reads. */
export const READERS = ["getent", "id", "stat", "cat", "systemctl", "dpkg-query", "readlink", "uname"] as const;

type Obj = { readonly [key: string]: JsonValue };
const isObj = (v: JsonValue): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** What is on the machine, in the shape of each requirement's desired state, read with no change: a resource that is not there has no entry. */
export async function observeRequirements(executor: Executor, requirements: readonly Requirement[], elevate: readonly string[] = []): Promise<ReadonlyMap<RequirementId, JsonValue>> {
  const out = new Map<RequirementId, JsonValue>();
  const run = async (argv: readonly string[]): Promise<string | undefined> => {
    const r = await executor.exec([...elevate, ...argv]);
    return r.success ? textOf(r.stdout) : undefined;
  };
  for (const q of requirements) {
    const d = q.desired;
    if (!isObj(d)) continue;
    const s = (k: string): string => (typeof d[k] === "string" ? (d[k] as string) : "");
    let seen: JsonValue | undefined;
    switch (String(q.kind)) {
      case "group":
        seen = groupShape(d, await run(["getent", "group", s("name")]));
        break;
      case "user": {
        const passwd = await run(["getent", "passwd", s("name")]);
        seen = userShape(d, passwd, passwd === undefined || !Array.isArray(d["groups"]) ? undefined : await run(["id", "-nG", s("name")]));
        break;
      }
      case "directory":
      case "file": {
        const kind = String(q.kind) as "file" | "directory";
        const st = await run(["stat", "-c", "%F|%U|%G|%a", s("path")]);
        const stat = st === undefined ? undefined : parseStat(st);
        seen = pathShape(kind, d, stat, kind === "file" && stat !== undefined ? await run(["cat", s("path")]) : undefined);
        break;
      }
      case "service":
        seen = serviceShape(d, (await run(["systemctl", "is-active", s("name")])) ?? "", (await run(["systemctl", "is-enabled", s("name")])) ?? "");
        break;
      case "ssh-authorized-key":
        seen = keyShape(d, await run(["cat", keyFileOf(d)]));
        break;
      case "package":
        seen = packageShape(d, await run(["dpkg-query", "-W", "-f", "${db:Status-Abbrev}|${Version}", s("name")]));
        break;
      case "system-setting": {
        const name = s("name");
        seen = settingShape(name, await run(name === "timezone" ? ["readlink", "/etc/localtime"] : ["cat", name === "keyboard" ? "/etc/default/keyboard" : "/etc/default/locale"]));
        break;
      }
    }
    if (seen !== undefined) out.set(q.id, seen);
  }
  return out;
}

/** The platform of the machine, read with no change from `/etc/os-release` and `uname -m`, or why it is not one Archon knows. */
export async function observePlatform(executor: Executor, elevate: readonly string[] = []): Promise<Result<Observed, string>> {
  const run = async (argv: readonly string[]): Promise<string | undefined> => {
    const r = await executor.exec([...elevate, ...argv]);
    return r.success ? textOf(r.stdout) : undefined;
  };
  const text = (await run(["cat", "/etc/os-release"])) ?? (await run(["cat", "/usr/lib/os-release"]));
  if (text === undefined) return err("the machine has no os-release to read");
  return platformOfOsRelease(text, await run(["uname", "-m"]));
}
