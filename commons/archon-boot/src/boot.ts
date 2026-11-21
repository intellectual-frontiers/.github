// Spec: 0002-boot-command FR-002, FR-003, FR-004, FR-005
/**
 * The install of a blank machine: what the fleet declares for an asset becomes the autoinstall of its first boot and the playbook it converges itself with, both written as generated files for the owner to commit and sign; the boot server serves them to a machine that network boots, after the
 * owner armed the asset. The state of the server (the arming tokens) is kept in a file in the person's own configuration folder, never in a repository.
 *
 * @example
 * ```ts
 * import { defaultStateFile } from "./boot.ts";
 * defaultStateFile("archon", () => undefined).endsWith("state.json"); // true
 * ```
 *
 * @module
 */
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { parseSubjectName, type Requirement } from "@intellectual-frontiers/archon/governance";
import { buildOrder, planOrder } from "@intellectual-frontiers/archon/logical";
import type { BootProfile } from "@intellectual-frontiers/netboot/governance";
import { arm, disarm, newToken } from "@intellectual-frontiers/netboot/logical";
import { assetStatus, readState, updateState } from "@intellectual-frontiers/netboot/physical";
import type { BootSubject } from "./config.ts";

/** The name of a variable the plugin reads: the program's name in capitals, then the suffix. */
export const variable = (program: string, suffix: "BOOT_STATE" | "BOOT_ASSETS" | "SECRETS"): string => `${program.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_${suffix}`;

/** The file the boot server keeps its state in: the program's variable, or a file in the person's own configuration folder (outside any repository, because it holds the tokens of an arming). */
export function defaultStateFile(program: string, env: (n: string) => string | undefined): string {
  const set = env(variable(program, "BOOT_STATE"));
  return set !== undefined && set !== "" ? set : join(env("XDG_CONFIG_HOME") ?? join(homedir(), ".config"), program, "boot", "state.json");
}

/** The folder of the pinned boot files: given, or the program's variable, or a folder next to the state file. */
export function assetsDir(program: string, given: string, stateFile: string, env: (n: string) => string | undefined): string {
  return given !== "" ? given : (env(variable(program, "BOOT_ASSETS")) ?? join(dirname(stateFile), "assets"));
}

/** What `prepare` wrote. */
export type Prepared = { readonly files: readonly string[] };

/** Renders the install and the playbook of an asset into the fleet's folder. */
export async function prepare(asset: string, s: BootSubject): Promise<Result<Prepared, string>> {
  const name = parseSubjectName(asset);
  if (name.kind === "err") return name;
  const subject = { name: name.value, class: "machine" as const };
  const orderFor = (rs: readonly Requirement[], kinds: readonly string[]): ReturnType<typeof buildOrder> =>
    buildOrder({ subject, assurance: "solo", layers: [{ layer: "fleet", requirements: rs.filter((r) => kinds.includes(String(r.kind))) }] });

  const install = orderFor(s.requirements, s.install.guarantees.kinds.map(String));
  if (install.kind === "err") return err(`the install's order cannot be made: ${JSON.stringify(install.error)}`);
  const installed = await s.install.render(install.value, planOrder(install.value, new Map()));
  if (installed.kind === "err") return err(`the install cannot be rendered: ${installed.error.join("; ")}`);

  const play = orderFor(s.requirements, s.playbook.guarantees.kinds.map(String));
  if (play.kind === "err") return err(`the order cannot be made: ${JSON.stringify(play.error)}`);
  const played = await s.playbook.render(play.value, planOrder(play.value, new Map()));
  if (played.kind === "err") return err(`the playbook cannot be rendered: ${played.error.join("; ")}`);

  const written: string[] = [];
  for (const [rel, text] of [...installed.value.files, ...played.value.files]) {
    const file = join(s.dir, rel);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, text);
    written.push(join(s.shown, rel));
  }
  return ok({ files: written });
}

/** Arms an asset for one install and gives its token. */
export async function armAsset(stateFile: string, asset: string, o: { readonly confirmDestroy: boolean; readonly mac?: string; readonly now?: string }): Promise<string> {
  const token = newToken();
  await updateState(stateFile, (s) => ({ state: arm(s, asset, { token, at: o.now ?? new Date().toISOString(), ...(o.confirmDestroy ? { confirmDestroy: true } : {}), ...(o.mac === undefined ? {} : { mac: o.mac }) }), value: 0 }));
  return token;
}

/** Disarms an asset. */
export async function disarmAsset(stateFile: string, asset: string): Promise<void> {
  await updateState(stateFile, (s) => ({ state: disarm(s, asset), value: 0 }));
}

/** What `status` shows. */
export async function statusOf(stateFile: string, dir: string, profile: BootProfile): Promise<{ readonly armed: readonly string[]; readonly installed: readonly string[]; readonly last: readonly string[]; readonly missing: readonly string[] }> {
  const s = await readState(stateFile);
  const a = await assetStatus(dir, profile.pins);
  return {
    armed: Object.entries(s.armed).map(([h, x]) => `${h} (armed ${x.at}${x.confirmDestroy === true ? ", may erase a disk that holds data" : ""})`),
    installed: Object.entries(s.installed).map(([h, x]) => `${h} (${x.at}${x.mac === undefined ? "" : `, ${x.mac}`})`),
    last: s.progress.slice(-8).map((p) => `${p.at} ${p.host} ${p.level} ${p.phase}: ${p.summary}`),
    missing: a.missing,
  };
}
