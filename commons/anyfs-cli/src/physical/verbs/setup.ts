// Spec: 0004-anyfs-cli-surfaces FR-014
/**
 * The verbs of the program that say what it is set up to reach (commons anyfs-cli 0004-anyfs-cli-surfaces FR-014): `places` lists the mounts of the configuration and the kinds of place with what each is today
 * (a store the program has, one a library brings, or none yet), `doctor` says what is wrong with this computer's setup for the program and the command for each, and `trust-host` is the verb of first contact with a
 * host that Headless provides, made for the hosts of the mounts: it shows what a host presents and records it only once a person has checked its fingerprint.
 *
 * @example
 * ```ts
 * import { setupVerbs } from "./setup.ts";
 * // setupVerbs(host, run).map((v) => v.name); // ["places", "doctor", "trust-host"]
 * ```
 *
 * @module
 */
import { outcomeOf, target, type Command, type Outcome, type Target } from "@intellectual-frontiers/headless/logical";
import { trustHostCommand, type RunLocal } from "@intellectual-frontiers/headless/targets/ssh";
import { problem } from "@intellectual-frontiers/headless/governance";
import { flag } from "@intellectual-frontiers/terminal/args";
import { formatPlace, PLACE_KINDS, type PlaceKind } from "@intellectual-frontiers/anyfs/governance";
import { existsSync } from "@intellectual-frontiers/system/fs";
import { dirname } from "@intellectual-frontiers/system/path";
import { runtimeName, runtimeVersion, which } from "@intellectual-frontiers/system/proc";
import { mkdir, readTextFile, writeTextFile } from "@intellectual-frontiers/system/fs";
import { capabilityNames, type Host, problemOf, table } from "@intellectual-frontiers/anyfs-cli/logical";
import { knownHostsOf } from "../openers.ts";
import { defineVerb } from "./common.ts";

/** What a kind of place is in this program: its own store, one the configuration's openers bring, or none yet. */
export function kindStatus(host: Host, kind: PlaceKind): "built in" | "from the configuration" | "no store yet" {
  if (kind === "memory" || kind === "file" || kind === "ssh") return host.config.kinds.some((k) => k.kind === kind) ? "from the configuration" : "built in";
  return host.config.kinds.some((k) => k.kind === kind) ? "from the configuration" : "no store yet";
}

const places = (host: Host): Command =>
  defineVerb(host, {
    name: "places",
    id: "places",
    options: { open: flag({ help: "Open each mount and say its capabilities and consistency (this reaches the host of a mount that is on one)." }) },
    operands: [],
    examples: [{ args: [], says: "The mounts of the configuration, and what each kind of place is today." }, { args: ["--open"], says: "The same, with the capabilities of each store that opens." }],
    run: async (args) => {
      const rows: (readonly string[])[] = [["mount", "place", "mode", "store"]];
      const data: { name: string; place: string; readOnly: boolean; kind: string; capabilities?: readonly string[]; consistency?: string; error?: string }[] = [];
      for (const m of host.config.mounts) {
        const entry: (typeof data)[number] = { name: m.name, place: formatPlace(m.place), readOnly: m.readOnly, kind: kindStatus(host, m.place.kind) };
        let shown = entry.kind;
        if (args.options.open) {
          const opened = await host.world.open(m.place);
          if (opened.kind === "ok") {
            entry.capabilities = capabilityNames(opened.value);
            entry.consistency = opened.value.consistency;
            shown = `${opened.value.consistency}: ${capabilityNames(opened.value).join(" ")}`;
          } else {
            entry.error = opened.error.message;
            shown = `not open: ${opened.error.message}`;
          }
        }
        data.push(entry);
        rows.push([m.name, entry.place, m.readOnly ? "read-only" : "read-write", shown]);
      }
      const kinds = PLACE_KINDS.map((k) => `${k}: ${kindStatus(host, k)}`);
      const mountText = host.config.mounts.length === 0 ? `no mounts${host.configFile === undefined ? " (no anyfs.config.ts was found)" : ""}` : table(rows);
      const base = outcomeOf({ mounts: data, kinds: PLACE_KINDS.map((k) => ({ kind: k, status: kindStatus(host, k) })) }, { text: `${mountText}\n\nkinds of place\n${kinds.map((k) => `  ${k}`).join("\n")}` });
      return host.configProblem === undefined ? base : { ...base, problems: [problemOf(host.configProblem.code, host.configProblem.message)] };
    },
  });

const doctor = (host: Host): Command =>
  defineVerb(host, {
    name: "doctor",
    id: "doctor",
    options: {},
    operands: [],
    examples: [{ args: [], says: "What is wrong with this computer's setup for the program, in the order to fix it." }],
    run: async (): Promise<Outcome> => {
      const stateDir = host.world.stateDir;
      const sshMounts = host.config.mounts.filter((m) => m.place.kind === "ssh");
      const ssh = host.config.ssh.program ?? "ssh";
      const sshPath = which(ssh, host.env("PATH") ?? "");
      const known = knownHostsOf(host.config.ssh, stateDir, host.env);
      const problems = [
        ...(host.configProblem === undefined ? [] : [problemOf(host.configProblem.code, host.configProblem.message)]),
        ...(sshMounts.length > 0 && sshPath === undefined ? [problem("fail", `${ssh} is not on the PATH, and ${sshMounts.length} mount${sshMounts.length === 1 ? "" : "s"} reach a host by SSH`, { code: "E-ENVIRONMENT", fix: "install an OpenSSH client" })] : []),
      ];
      const lines = [
        `runtime   ${runtimeName()} ${runtimeVersion()}`,
        `config    ${host.configFile ?? "none found: plain paths and addresses work without one"}`,
        `mounts    ${host.config.mounts.length}`,
        `state     ${stateDir}`,
        `ssh       ${sshPath ?? "not found"}${sshMounts.length === 0 ? " (no mount needs it)" : ""}`,
        `known     ${known.repository}${existsSync(known.repository) ? "" : " (not there yet)"}; the user's ${known.user}${existsSync(known.user) ? "" : " (not there)"}`,
      ];
      const base = outcomeOf({ runtime: `${runtimeName()} ${runtimeVersion()}`, config: host.configFile ?? null, mounts: host.config.mounts.length, stateDir, ssh: sshPath ?? null }, { text: lines.join("\n"), title: "This setup is in order" });
      return { ...base, problems, next: problems.length > 0 ? ["next: anyfs places"] : [] };
    },
  });

/** The ssh targets of the mounts: each is named for its mount, so that `trust-host fleet` is the host of the mount fleet. */
export function mountTargets(host: Host): readonly Target[] {
  const out: Target[] = [];
  for (const m of host.config.mounts) {
    if (m.place.kind !== "ssh") continue;
    const t = target({ id: m.name, class: "server", address: m.place.host, ...(m.place.user === undefined ? {} : { user: m.place.user }), ...(m.place.port === undefined ? {} : { port: m.place.port }) });
    if (t.kind === "ok") out.push(t.value);
  }
  return out;
}

/** The verbs that say what the program reaches. */
export function setupVerbs(host: Host, run: RunLocal): readonly Command[] {
  const stateDir = host.world.stateDir;
  const file = knownHostsOf(host.config.ssh, stateDir, host.env).repository;
  const trust = trustHostCommand({
    targets: mountTargets(host),
    run,
    append: async (line) => {
      await mkdir(dirname(file), { recursive: true });
      const held = existsSync(file) ? await readTextFile(file) : "";
      await writeTextFile(file, `${held}${held === "" || held.endsWith("\n") ? "" : "\n"}${line}\n`);
    },
  });
  return [places(host), doctor(host), trust];
}
